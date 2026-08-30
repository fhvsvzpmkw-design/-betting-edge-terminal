import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'https://api.oddspapi.io/v4';
const API_KEY = String(process.env.ODDSPAPI_API_KEY || '').trim();
const PRIMARY_FILE = path.join('data', 'live-odds.json');
const OUTFILE = path.join('data', 'oddspapi-observer.json');
const TARGET_BOOKS = ['pinnacle', 'bet365', 'draftkings'];
const RESERVE = 25;
const HORIZON_HOURS = 30;
const MAX_FIXTURES = 180;
const MAX_MARKETS_PER_BOOK = 16;

const STATIC_TOURNAMENTS = [
  { key: 'NBA', sportId: 11, tournamentId: 132, tournamentName: 'NBA', category: 'NBA' },
  { key: 'NFL', sportId: 14, tournamentId: 31, tournamentName: 'NFL', category: 'NFL' },
  { key: 'NFL_PRESEASON', sportId: 14, tournamentId: 233, tournamentName: 'NFL Preseason', category: 'NFL' },
  { key: 'CFL', sportId: 14, tournamentId: 790, tournamentName: 'CFL', category: 'CFL' },
  { key: 'NCAAF', sportId: 14, tournamentId: 27653, tournamentName: 'NCAA, Regular Season', category: 'NCAAF' },
  { key: 'BOXING', sportId: 21, tournamentId: 24327, tournamentName: 'International Matchups', category: 'BOXING' }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalized(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function token(value) {
  return normalized(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function categoryKey(event) {
  const sport = normalized(event?.sport?.slug || event?.sport?.name);
  const text = normalized([
    event?.league?.name,
    event?.league?.slug,
    event?.tournament?.name,
    event?.sport?.name,
    event?.sport?.slug
  ].filter(Boolean).join(' '));

  if (/\bmlb\b|major league baseball/.test(text)) return 'MLB';
  if (/\bnhl\b|national hockey league/.test(text)) return 'NHL';
  if (/\bnba\b/.test(text)) return 'NBA';
  if (/\bwnba\b/.test(text)) return 'WNBA';
  if (/\bnfl\b/.test(text)) return 'NFL';
  if (sport === 'american-football' && /\bncaaf\b|\bncaa\b|college/.test(text)) return 'NCAAF';
  if (/\bcfl\b|canadian football/.test(text)) return 'CFL';
  if (sport === 'boxing' || /boxing/.test(sport)) return 'BOXING';
  if (sport === 'mma' || /mma|mixed-martial|ufc/.test(sport)) return 'MMA';
  return null;
}

function safeError(error) {
  return String(error?.message || error || 'Unknown OddsPapi error')
    .replace(API_KEY, 'REDACTED')
    .slice(0, 600);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeObservation(observation) {
  fs.mkdirSync(path.dirname(OUTFILE), { recursive: true });
  fs.writeFileSync(OUTFILE, JSON.stringify(observation, null, 2) + '\n', 'utf8');
}

function activeSubscription(account) {
  const current = String(account?.current_subscription_id || '');
  const rows = Array.isArray(account?.subscriptions) ? account.subscriptions : [];
  return rows.find(row => String(row?.subscription_id || '') === current) ||
    rows.find(row => row?.is_active) || rows[0] || null;
}

async function apiGet(endpoint, params = {}) {
  const url = new URL(API_BASE + endpoint);
  url.searchParams.set('apiKey', API_KEY);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(name, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'betting-edge-terminal/1.4-oddspapi-observer'
    },
    signal: AbortSignal.timeout(120000)
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }

  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body || {});
    const error = new Error(`OddsPapi ${endpoint} ${response.status}: ${detail.slice(0, 400)}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function payloadRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.fixtures)) return payload.fixtures;
  if (payload?.fixtureId) return [payload];
  return [];
}

function tournamentEntry(key, sportId, row) {
  const tournamentId = Number(row?.tournamentId);
  if (!Number.isFinite(tournamentId)) return null;
  return {
    key,
    sportId,
    tournamentId,
    tournamentName: row?.tournamentName || key,
    categoryName: row?.categoryName || null
  };
}

function findNamedTournament(rows, key, sportId, name) {
  const exact = (Array.isArray(rows) ? rows : [])
    .filter(row => normalized(row?.tournamentName) === normalized(name))
    .sort((a, b) => {
      const score = row => Number(row?.upcomingFixtures || 0) + Number(row?.liveFixtures || 0) + Number(row?.futureFixtures || 0);
      return score(b) - score(a);
    })[0];
  return exact ? tournamentEntry(key, sportId, exact) : null;
}

function moneylineIds(sportId) {
  if (sportId === 11) return new Set(['111']);
  if (sportId === 13) return new Set(['131']);
  if (sportId === 14) return new Set(['141']);
  if (sportId === 15) return new Set(['151']);
  if (sportId === 20) return new Set(['201', '241']);
  if (sportId === 21) return new Set(['201', '211']);
  return new Set();
}

function playerRows(outcome) {
  const rows = [];
  for (const [playerId, quote] of Object.entries(outcome?.players || {})) {
    if (!quote || typeof quote !== 'object') continue;
    const price = Number(quote.price);
    if (!Number.isFinite(price)) continue;
    rows.push({
      playerId,
      playerName: quote.playerName || null,
      price,
      priceAmerican: quote.priceAmerican ?? null,
      active: quote.active !== false,
      mainLine: quote.mainLine === true,
      limit: Number.isFinite(Number(quote.limit)) ? Number(quote.limit) : null,
      changedAt: quote.changedAt || null
    });
  }
  return rows;
}

function summarizeBook(book, sportId) {
  if (!book || typeof book !== 'object') return null;
  const moneylines = moneylineIds(Number(sportId));
  const selected = [];
  let totalMarkets = 0;
  let activeQuotes = 0;
  let suspendedQuotes = 0;

  for (const [marketId, market] of Object.entries(book?.markets || {})) {
    totalMarkets++;
    const outcomes = [];
    let hasMainLine = false;

    for (const [outcomeId, outcome] of Object.entries(market?.outcomes || {})) {
      const players = playerRows(outcome);
      if (!players.length) continue;
      if (players.some(row => row.mainLine)) hasMainLine = true;
      for (const row of players) {
        if (row.active) activeQuotes++;
        else suspendedQuotes++;
      }
      outcomes.push({ outcomeId, players });
    }

    if (!outcomes.length) continue;
    if (!moneylines.has(String(marketId)) && !hasMainLine) continue;

    selected.push({
      marketId: String(marketId),
      marketActive: market?.marketActive !== false,
      bookmakerMarketId: market?.bookmakerMarketId || null,
      outcomes
    });
    if (selected.length >= MAX_MARKETS_PER_BOOK) break;
  }

  return {
    bookmakerIsActive: book?.bookmakerIsActive !== false,
    suspended: book?.suspended === true,
    totalMarkets,
    selectedMarketCount: selected.length,
    activeQuotes,
    suspendedQuotes,
    markets: selected
  };
}

function primaryMatch(fixture, primaryEvents) {
  const a = token(fixture?.participant1Name);
  const b = token(fixture?.participant2Name);
  const start = Date.parse(fixture?.startTime || '');
  if (!a || !b || !Number.isFinite(start)) return null;

  for (const event of primaryEvents || []) {
    const home = token(event?.home);
    const away = token(event?.away);
    const eventStart = Date.parse(event?.date || '');
    if (!home || !away || !Number.isFinite(eventStart)) continue;
    if (Math.abs(eventStart - start) > 3 * 3600000) continue;
    if (!((a === home && b === away) || (a === away && b === home))) continue;
    return {
      eventId: String(event?.id || ''),
      eventKey: String(event?.eventKey || event?.identity?.eventKey || ''),
      source: 'Odds-API.io v3',
      matchedBy: 'exact-participant-pair+start-time'
    };
  }
  return null;
}

const primary = readJson(PRIMARY_FILE);
const previous = readJson(OUTFILE);
const now = new Date();
const generatedAt = now.toISOString();

const observation = {
  schema: 1,
  mode: 'observation-only',
  authoritative: false,
  source: 'OddsPapi v4',
  generatedAt,
  horizonHours: HORIZON_HOURS,
  sourceOfTruth: {
    Bet365: 'Odds-API.io v3',
    DraftKings: 'Odds-API.io v3',
    Pinnacle: 'OddsPapi v4'
  },
  status: 'not-run',
  quota: null,
  requestedBookmakers: [],
  tournaments: [],
  tournamentCache: previous?.tournamentCache || {},
  fixtureCountRaw: 0,
  fixtureCount: 0,
  primaryMatches: 0,
  fixtures: [],
  diagnostics: {
    billableRequestsThisRun: 0,
    discoveryRequests: 0,
    oddsRequests: 0,
    activePrimaryCategories: [],
    skippedCategories: [],
    errors: []
  }
};

async function main() {
  if (!primary || !Array.isArray(primary.events)) {
    observation.status = 'primary-snapshot-unavailable';
    writeObservation(observation);
    return;
  }

  const activeCategories = new Set(primary.events.map(categoryKey).filter(Boolean));
  observation.diagnostics.activePrimaryCategories = [...activeCategories].sort();

  if (!API_KEY) {
    observation.status = 'missing-secret';
    observation.diagnostics.errors.push('ODDSPAPI_API_KEY is not available.');
    writeObservation(observation);
    return;
  }

  let subscription;
  try {
    const account = await apiGet('/account');
    subscription = activeSubscription(account);
    if (!subscription) throw new Error('No active OddsPapi subscription found.');
  } catch (error) {
    observation.status = 'account-error';
    observation.diagnostics.errors.push(safeError(error));
    writeObservation(observation);
    return;
  }

  const requestLimit = Number(subscription?.request_limit);
  const requestCount = Number(subscription?.request_count);
  const remaining = Number.isFinite(requestLimit) && Number.isFinite(requestCount)
    ? Math.max(0, requestLimit - requestCount)
    : null;

  observation.quota = {
    requestLimit: Number.isFinite(requestLimit) ? requestLimit : null,
    requestCountBefore: Number.isFinite(requestCount) ? requestCount : null,
    remainingBefore: remaining,
    protectedReserve: RESERVE
  };

  if (remaining !== null && remaining <= RESERVE) {
    observation.status = 'quota-reserve-protected';
    writeObservation(observation);
    return;
  }

  const allowedSports = new Set(
    (Array.isArray(subscription?.sport_ids) ? subscription.sport_ids : [])
      .map(Number).filter(Number.isFinite)
  );
  const supported = sportId => !allowedSports.size || allowedSports.has(Number(sportId));
  const categoryPresent = category => activeCategories.has(category);
  const canSpend = (amount = 1) => remaining === null ||
    remaining - observation.diagnostics.billableRequestsThisRun - amount >= RESERVE;

  const accountBooks = Object.keys(subscription?.bookmakers || {});
  const books = TARGET_BOOKS.filter(book => !accountBooks.length || accountBooks.includes(book));
  observation.requestedBookmakers = books.length ? books : ['pinnacle'];

  const cache = { ...(observation.tournamentCache || {}) };
  const selected = STATIC_TOURNAMENTS
    .filter(row => categoryPresent(row.category) && supported(row.sportId))
    .map(row => ({ ...row, source: 'verified-static' }));

  async function discoverNamed(sportId, cacheKey, name, category) {
    if (!categoryPresent(category) || !supported(sportId)) return;
    if (cache?.[cacheKey]?.tournamentId) {
      selected.push({ ...cache[cacheKey], category, source: 'cache' });
      return;
    }
    if (!canSpend()) {
      observation.diagnostics.skippedCategories.push(`${category}:quota-reserve`);
      return;
    }
    try {
      const rows = await apiGet('/tournaments', { sportId, language: 'en' });
      observation.diagnostics.billableRequestsThisRun++;
      observation.diagnostics.discoveryRequests++;
      const found = findNamedTournament(rows, cacheKey, sportId, name);
      if (found) {
        cache[cacheKey] = { ...found, discoveredAt: generatedAt };
        selected.push({ ...found, category, source: 'discovered' });
      } else {
        observation.diagnostics.skippedCategories.push(`${category}:tournament-not-found`);
      }
    } catch (error) {
      observation.diagnostics.billableRequestsThisRun++;
      observation.diagnostics.discoveryRequests++;
      observation.diagnostics.errors.push(safeError(error));
    }
    await sleep(1100);
  }

  await discoverNamed(13, 'MLB', 'MLB', 'MLB');
  await discoverNamed(11, 'WNBA', 'WNBA', 'WNBA');
  await discoverNamed(15, 'NHL', 'NHL', 'NHL');

  if (categoryPresent('MMA') && supported(20)) {
    const cacheTime = Date.parse(cache?.MMA_UPDATED_AT || '');
    const fresh = Number.isFinite(cacheTime) && Date.now() - cacheTime < 20 * 3600000;
    if (fresh && Array.isArray(cache?.MMA)) {
      for (const row of cache.MMA) selected.push({ ...row, category: 'MMA', source: 'cache' });
    } else if (canSpend()) {
      try {
        const rows = await apiGet('/tournaments', { sportId: 20, language: 'en' });
        observation.diagnostics.billableRequestsThisRun++;
        observation.diagnostics.discoveryRequests++;
        const live = (Array.isArray(rows) ? rows : [])
          .filter(row => Number(row?.futureFixtures || 0) + Number(row?.upcomingFixtures || 0) + Number(row?.liveFixtures || 0) > 0)
          .slice(0, 20)
          .map((row, index) => tournamentEntry(`MMA_${index + 1}`, 20, row))
          .filter(Boolean);
        cache.MMA = live;
        cache.MMA_UPDATED_AT = generatedAt;
        for (const row of live) selected.push({ ...row, category: 'MMA', source: 'discovered' });
      } catch (error) {
        observation.diagnostics.billableRequestsThisRun++;
        observation.diagnostics.discoveryRequests++;
        observation.diagnostics.errors.push(safeError(error));
      }
      await sleep(1100);
    } else {
      observation.diagnostics.skippedCategories.push('MMA:quota-reserve');
    }
  }

  observation.tournamentCache = cache;
  observation.tournaments = [...new Map(
    selected.filter(row => Number.isFinite(Number(row?.tournamentId)))
      .map(row => [Number(row.tournamentId), row])
  ).values()];

  if (!observation.tournaments.length) {
    observation.status = 'no-target-tournaments';
    writeObservation(observation);
    return;
  }
  if (!canSpend()) {
    observation.status = 'quota-reserve-protected';
    writeObservation(observation);
    return;
  }

  let payload;
  try {
    payload = await apiGet('/odds-by-tournaments', {
      tournamentIds: observation.tournaments.map(row => row.tournamentId).join(','),
      bookmakers: observation.requestedBookmakers.join(','),
      language: 'en',
      oddsFormat: 'american',
      verbosity: 3
    });
    observation.diagnostics.billableRequestsThisRun++;
    observation.diagnostics.oddsRequests++;
  } catch (error) {
    observation.diagnostics.billableRequestsThisRun++;
    observation.diagnostics.oddsRequests++;
    observation.status = 'odds-error';
    observation.diagnostics.errors.push(safeError(error));
    observation.quota.estimatedRemainingAfter = remaining === null ? null :
      Math.max(0, remaining - observation.diagnostics.billableRequestsThisRun);
    writeObservation(observation);
    return;
  }

  const rows = payloadRows(payload);
  observation.fixtureCountRaw = rows.length;
  const horizonMs = HORIZON_HOURS * 3600000;
  const within = rows
    .filter(fixture => {
      const start = Date.parse(fixture?.startTime || '');
      if (!Number.isFinite(start)) return false;
      const delta = start - now.getTime();
      return delta >= -30 * 60000 && delta <= horizonMs;
    })
    .sort((a, b) => String(a?.startTime || '').localeCompare(String(b?.startTime || '')))
    .slice(0, MAX_FIXTURES);

  observation.fixtures = within.map(fixture => {
    const bookmakerSummaries = {};
    for (const book of observation.requestedBookmakers) {
      const summary = summarizeBook(fixture?.bookmakerOdds?.[book], fixture?.sportId);
      if (summary) bookmakerSummaries[book] = summary;
    }
    const match = primaryMatch(fixture, primary.events);
    if (match) observation.primaryMatches++;
    return {
      fixtureId: String(fixture?.fixtureId || ''),
      sportId: Number(fixture?.sportId) || null,
      tournamentId: Number(fixture?.tournamentId) || null,
      participant1Name: fixture?.participant1Name || null,
      participant2Name: fixture?.participant2Name || null,
      startTime: fixture?.startTime || null,
      updatedAt: fixture?.updatedAt || null,
      statusId: fixture?.statusId ?? null,
      primaryMatch: match,
      bookmakers: bookmakerSummaries
    };
  });

  observation.fixtureCount = observation.fixtures.length;
  observation.status = 'ok';
  observation.quota.estimatedRemainingAfter = remaining === null ? null :
    Math.max(0, remaining - observation.diagnostics.billableRequestsThisRun);
  writeObservation(observation);
}

main()
  .then(() => {
    const result = readJson(OUTFILE);
    console.log(
      `OddsPapi observer ${result?.status || 'unknown'}; ` +
      `${result?.fixtureCount || 0} fixtures; ` +
      `${result?.primaryMatches || 0} primary matches; ` +
      `${result?.diagnostics?.billableRequestsThisRun || 0} billable request(s).`
    );
  })
  .catch(error => {
    observation.status = 'observer-error';
    observation.diagnostics.errors.push(safeError(error));
    writeObservation(observation);
    console.warn('OddsPapi observer non-blocking error:', safeError(error));
    process.exitCode = 0;
  });
