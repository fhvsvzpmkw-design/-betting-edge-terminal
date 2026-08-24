import fs from 'node:fs';
import crypto from 'node:crypto';

const SOURCE_PATH = 'data/live-odds.json';
const OUTPUT_PATH = 'data/pizza-plays.json';
const HISTORY_PATH = 'run-history.json';
const STAKE_UNITS = 0.25;
const BOOKS = ['Bet365', 'DraftKings'];
const MIN_BOOKS = 2;
const MAX_FEED_AGE_MINUTES = 75;
const MAX_QUOTE_AGE_MINUTES = 75;
const MIN_START_LEAD_MINUTES = 20;
const MIN_DECIMAL = 1.20;
const MAX_DECIMAL = 3.50;
const MIN_LEG_EV = 0.03;
const MAX_LEG_EV = 0.18;
const MAX_FAIR_DISAGREEMENT = 0.075;
const MIN_TWO_EV = 0.06;
const MIN_THREE_EV = 0.09;

function num(value) { const x = Number(value); return Number.isFinite(x) ? x : null; }
function round(value, digits = 3) { if (!Number.isFinite(value)) return null; const m = 10 ** digits; return Math.round(value * m) / m; }
function decimalToAmerican(decimal) { const d = num(decimal); if (!d || d <= 1) return null; return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)); }
function implied(decimal) { const d = num(decimal); return d && d > 1 ? 1 / d : null; }
function mean(values) { const a = values.filter(Number.isFinite); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }
function minutesBetween(a, b) { return (a - b) / 60_000; }
function lineValue(row) { for (const key of ['hdp', 'line', 'points', 'total']) { const x = num(row?.[key]); if (x !== null) return x; } return null; }
function isHalfLine(line) { if (!Number.isFinite(line)) return false; return Math.abs(line * 2 - Math.round(line * 2)) < 1e-7 && Math.abs(line - Math.round(line)) > 1e-7; }
function marketKind(market) {
  const key = String(market?.marketKey || market?.identity?.marketKey || '').toLowerCase();
  const name = String(market?.name || '').toLowerCase();
  if (key === 'ml' || name === 'ml' || /money\s*line|moneyline|match winner/.test(name)) return 'ml';
  if (key === 'spread' || /spread|run[- ]line|puck[- ]line|handicap/.test(`${key} ${name}`)) return 'spread';
  if (key === 'totals' || name === 'totals') return 'totals';
  return null;
}
function outcomesFor(kind, row) {
  const sides = kind === 'totals' ? ['over', 'under'] : ['home', 'away', ...(kind === 'ml' && num(row?.draw) ? ['draw'] : [])];
  const values = {};
  for (const side of sides) { const d = num(row?.[side]); if (!d || d <= 1) return null; values[side] = d; }
  return values;
}
function noVig(values) {
  const entries = Object.entries(values || {}); if (entries.length < 2) return null;
  const raw = entries.map(([side, decimal]) => [side, implied(decimal)]); if (raw.some(([, p]) => !p)) return null;
  const sum = raw.reduce((t, [, p]) => t + p, 0); return Object.fromEntries(raw.map(([side, p]) => [side, p / sum]));
}
function rowIdentity(kind, row) { if (kind === 'ml') return 'ml'; const line = lineValue(row); if (line === null || !isHalfLine(line)) return null; return `${kind}|${line}`; }
function selectionName(event, side) { if (side === 'home') return event.home; if (side === 'away') return event.away; if (side === 'draw') return 'Draw'; if (side === 'over') return 'Over'; if (side === 'under') return 'Under'; return side; }
function displayMarket(event, kind) { if (kind === 'ml') return 'Moneyline'; if (kind === 'totals') return 'Total'; const sport = String(event?.sport?.slug || '').toLowerCase(); if (sport === 'baseball') return 'Run Line'; if (sport === 'ice-hockey') return 'Puck Line'; return 'Spread'; }
function displayLine(kind, side, homeLine) { if (kind === 'ml') return null; if (kind === 'totals') return homeLine; return side === 'away' ? -homeLine : homeLine; }
function selectionKey(eventId, market, row, side, kind, homeLine) { const explicit = row?.selectionKeys?.[side] || row?.identity?.selectionKeys?.[side]; if (explicit) return String(explicit); const key = market?.marketKey || market?.identity?.marketKey || kind; const line = kind === 'ml' ? '' : String(homeLine); return `${eventId}|${key}|${side}||${line}`; }
function formatSelection(event, kind, side, homeLine) { const name = selectionName(event, side); if (kind === 'ml') return name; if (kind === 'totals') return `${name} ${homeLine}`; const line = displayLine(kind, side, homeLine); return `${name} ${line > 0 ? '+' : ''}${line}`; }

function loadBettingEdgeGate(source) {
  const empty = { report: null, statuses: new Map(), blocked: new Set() };
  if (!fs.existsSync(HISTORY_PATH)) return empty;
  try {
    const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    const runs = (Array.isArray(history.runs) ? history.runs : []).filter(r => r?.path && r.feedGeneratedAt === source.generatedAt).sort((a, b) => Date.parse(b.ts || '') - Date.parse(a.ts || ''));
    const run = runs[0]; if (!run || !fs.existsSync(run.path)) return empty;
    const report = JSON.parse(fs.readFileSync(run.path, 'utf8')); const statuses = new Map(); const blocked = new Set();
    for (const rec of Array.isArray(report.recs) ? report.recs : []) { const key = rec?.feed?.selectionKey; if (!key) continue; const status = String(rec.status || '').toUpperCase(); statuses.set(String(key), status); if (status === 'WAIT' || status === 'PASS') blocked.add(String(key)); }
    return { report: { path: run.path, ts: report.ts || run.ts || null, label: report.label || run.label || null }, statuses, blocked };
  } catch (error) { return { ...empty, warning: `Betting Edge gate unavailable: ${error.message}` }; }
}

function marketRows(event, book) {
  const markets = event?.bookmakers?.[book]; if (!Array.isArray(markets)) return []; const out = [];
  for (const market of markets) { const kind = marketKind(market); if (!kind || !Array.isArray(market.odds)) continue; for (const row of market.odds) { if (!row || typeof row !== 'object') continue; const identity = rowIdentity(kind, row); if (!identity) continue; const values = outcomesFor(kind, row); const fair = noVig(values); if (!values || !fair) continue; out.push({ market, kind, row, identity, values, fair, homeLine: lineValue(row) }); } }
  return out;
}

function extractCandidates(source, gate, nowMs = Date.now()) {
  const sourceTime = Date.parse(source.generatedAt || ''); if (!Number.isFinite(sourceTime)) throw new Error('live-odds.json is missing a valid generatedAt');
  const availableBooks = BOOKS.filter(book => Array.isArray(source.bookmakers) && source.bookmakers.includes(book)); if (availableBooks.length < MIN_BOOKS) throw new Error(`Pizza requires ${MIN_BOOKS} supported books`);
  const candidates = []; let blockedCount = 0;
  for (const event of Array.isArray(source.events) ? source.events : []) {
    if (String(event?.status || '').toLowerCase() !== 'pending') continue;
    const start = Date.parse(event?.date || ''); if (!Number.isFinite(start) || minutesBetween(start, nowMs) < MIN_START_LEAD_MINUTES) continue;
    const eventId = String(event.eventId ?? event.id ?? ''); if (!eventId) continue;
    const byBook = new Map();
    for (const book of availableBooks) { const rows = new Map(); for (const item of marketRows(event, book)) rows.set(item.identity, item); byBook.set(book, rows); }
    const identities = new Set(); for (const rows of byBook.values()) for (const id of rows.keys()) identities.add(id);
    for (const identity of identities) {
      const matched = availableBooks.map(book => ({ book, item: byBook.get(book)?.get(identity) })).filter(x => x.item); if (matched.length < MIN_BOOKS) continue;
      const kind = matched[0].item.kind; const sides = Object.keys(matched[0].item.values);
      for (const offer of matched) {
        const quoteTime = Date.parse(offer.item.market.updatedAt || ''); if (!Number.isFinite(quoteTime) || minutesBetween(sourceTime, quoteTime) > MAX_QUOTE_AGE_MINUTES) continue;
        for (const side of sides) {
          const decimal = offer.item.values[side]; if (decimal < MIN_DECIMAL || decimal > MAX_DECIMAL) continue;
          const key = selectionKey(eventId, offer.item.market, offer.item.row, side, kind, offer.item.homeLine); if (gate.blocked.has(key)) { blockedCount++; continue; }
          const comparisons = matched.filter(x => x.book !== offer.book && Number.isFinite(x.item.values?.[side])); if (!comparisons.length) continue;
          const comparisonQuoteTimes = comparisons.map(x => Date.parse(x.item.market.updatedAt || '')).filter(Number.isFinite); if (comparisonQuoteTimes.length !== comparisons.length || comparisonQuoteTimes.some(t => minutesBetween(sourceTime, t) > MAX_QUOTE_AGE_MINUTES)) continue;
          const bestOtherPrice = Math.max(...comparisons.map(x => x.item.values[side])); if (decimal + 0.005 < bestOtherPrice) continue;
          const otherFair = mean(comparisons.map(x => x.item.fair[side])); const ownFair = offer.item.fair[side]; if (!Number.isFinite(otherFair) || !Number.isFinite(ownFair)) continue;
          const fairDisagreement = Math.abs(otherFair - ownFair); if (fairDisagreement > MAX_FAIR_DISAGREEMENT) continue;
          const ev = otherFair * decimal - 1; if (ev < MIN_LEG_EV || ev > MAX_LEG_EV) continue;
          const homeLine = offer.item.homeLine; const latestStatus = gate.statuses.get(key) || 'UNTRACKED';
          candidates.push({ eventId, eventKey: event.eventKey || event?.identity?.eventKey || null, event: `${event.away} @ ${event.home}`, startTime: event.date, sport: event?.sport?.name || event?.sport?.slug || 'Unknown', sportKey: event?.sport?.slug || null, league: event?.league?.name || null, market: displayMarket(event, kind), marketKey: offer.item.market?.marketKey || offer.item.market?.identity?.marketKey || kind, selection: formatSelection(event, kind, side, homeLine), selectionKey: key, side, line: displayLine(kind, side, homeLine), book: offer.book, decimal: round(decimal, 3), american: decimalToAmerican(decimal), fairMethod: 'OTHER-BOOK NO-VIG', fairProbability: round(otherFair, 5), fairDecimal: round(1 / otherFair, 3), fairAmerican: decimalToAmerican(1 / otherFair), evPct: round(ev * 100, 2), fairDisagreementPct: round(fairDisagreement * 100, 2), bettingEdgeStatus: latestStatus, url: event?.urls?.[offer.book] || null, books: matched.map(x => ({ book: x.book, decimal: round(x.item.values[side], 3), american: decimalToAmerican(x.item.values[side]), noVigProbability: round(x.item.fair[side], 5), updatedAt: x.item.market.updatedAt || null })) });
        }
      }
    }
  }
  const deduped = new Map(); for (const c of candidates) { const key = `${c.book}|${c.selectionKey}`; const prior = deduped.get(key); if (!prior || c.evPct > prior.evPct) deduped.set(key, c); }
  return { candidates: [...deduped.values()].sort((a, b) => b.evPct - a.evPct || b.decimal - a.decimal), blockedCount };
}

function combinations(items, size) { const out = []; function walk(start, chosen) { if (chosen.length === size) { out.push([...chosen]); return; } for (let i = start; i <= items.length - (size - chosen.length); i++) { chosen.push(items[i]); walk(i + 1, chosen); chosen.pop(); } } walk(0, []); return out; }
function noPlay(label, size, reason) { return { status: 'NO_PLAY', label, legCount: size, reason }; }
function buildParlay(label, candidates, size, minParlayEv) {
  let best = null;
  for (const book of BOOKS) {
    const pool = candidates.filter(c => c.book === book).slice(0, 18); if (pool.length < size) continue;
    for (const legs of combinations(pool, size)) {
      if (new Set(legs.map(x => x.eventId)).size !== size) continue;
      const sports = new Set(legs.map(x => x.sportKey || x.sport)); if (sports.size < 2) continue;
      const offeredDecimal = legs.reduce((p, x) => p * x.decimal, 1); const fairProbability = legs.reduce((p, x) => p * x.fairProbability, 1); const fairDecimal = 1 / fairProbability; const ev = fairProbability * offeredDecimal - 1; if (ev < minParlayEv) continue;
      const marketDiversity = new Set(legs.map(x => x.market)).size; const trackedBonus = legs.filter(x => x.bettingEdgeStatus === 'BET' || x.bettingEdgeStatus === 'LEAN').length; const score = ev + sports.size * 0.004 + marketDiversity * 0.001 + trackedBonus * 0.002;
      if (!best || score > best.score) best = { book, legs, offeredDecimal, fairProbability, fairDecimal, ev, score };
    }
  }
  if (!best) return noPlay(label, size, `No same-book cross-sport ${size}-leg combination cleared the Pizza value and Betting Edge gates.`);
  return { status: 'PLAY', label, legCount: size, book: best.book, legs: best.legs, combined: { priceType: 'ESTIMATED', label: 'ESTIMATED COMBINED PRICE', decimal: round(best.offeredDecimal, 3), american: decimalToAmerican(best.offeredDecimal), fairProbability: round(best.fairProbability, 5), fairDecimal: round(best.fairDecimal, 3), fairAmerican: decimalToAmerican(best.fairDecimal), evPct: round(best.ev * 100, 2), breakEvenProbability: round(1 / best.offeredDecimal, 5) }, stakeUnits: STAKE_UNITS, potentialProfitUnits: round(STAKE_UNITS * (best.offeredDecimal - 1), 3), expectedValueUnits: round(STAKE_UNITS * best.ev, 3), note: 'Estimated from independent leg prices at one sportsbook. Confirm the actual parlay quote before wagering.' };
}
function sourceHash(raw) { return crypto.createHash('sha256').update(raw).digest('hex'); }

function build(source, { rawSource = JSON.stringify(source), nowMs = Date.now(), gate = null } = {}) {
  const sourceTime = Date.parse(source.generatedAt || ''); if (!Number.isFinite(sourceTime)) throw new Error('live-odds.json is missing a valid generatedAt');
  const feedAgeMinutes = minutesBetween(nowMs, sourceTime); const effectiveGate = gate || loadBettingEdgeGate(source);
  const base = { schema: 2, title: 'Pizza Plays', description: 'Cross-sport Two-Topping and Three-Topping value parlays built from the latest stored Betting Edge odds snapshot.', access: 'mixed', timezone: 'America/Vancouver', mode: 'MANUAL_ONLY', generatedAt: new Date(nowMs).toISOString(), source: { file: SOURCE_PATH, generatedAt: source.generatedAt || null, generatedAtVancouver: source.generatedAtVancouver || null, provider: source.source || null, eventCount: Array.isArray(source.events) ? source.events.length : null, bookmakers: source.bookmakers || [], sha256: sourceHash(rawSource) }, bettingEdgeGate: { applied: Boolean(effectiveGate.report), report: effectiveGate.report || null, rule: 'Exact selections marked WAIT or PASS by the matching Betting Edge report are ineligible for Pizza.', warning: effectiveGate.warning || null }, methodology: { engine: 'PIZZA MARKET VALUE PASS v2', eligibleMarkets: ['Moneyline', 'Spread', 'Run Line', 'Puck Line', 'Full-Game Total'], pricing: 'ONE SPORTSBOOK PER PARLAY', fairMethod: 'OTHER-BOOK NO-VIG', crossSportRequired: true, sameEventBlocked: true, minBooks: MIN_BOOKS, feedFreshnessMinutes: MAX_FEED_AGE_MINUTES, quoteFreshnessMinutes: MAX_QUOTE_AGE_MINUTES, minLegEvPct: MIN_LEG_EV * 100, maxLegEvPct: MAX_LEG_EV * 100, maxFairDisagreementPct: MAX_FAIR_DISAGREEMENT * 100, legDecimalRange: [MIN_DECIMAL, MAX_DECIMAL], minStartLeadMinutes: MIN_START_LEAD_MINUTES, twoToppingMinEvPct: MIN_TWO_EV * 100, threeToppingMinEvPct: MIN_THREE_EV * 100, stakeUnits: STAKE_UNITS, combinedPriceType: 'ESTIMATED' } };
  if (feedAgeMinutes < -2 || feedAgeMinutes > MAX_FEED_AGE_MINUTES) { const stale = { ...base, status: 'STALE_FEED', message: `Latest odds snapshot is ${round(feedAgeMinutes, 1)} minutes old; Pizza requires ${MAX_FEED_AGE_MINUTES} minutes or fresher.`, candidateCount: 0, blockedByBettingEdgeCount: 0, twoTopping: noPlay('TWO-TOPPING', 2, 'Fresh odds required.'), threeTopping: noPlay('THREE-TOPPING', 3, 'Fresh odds required.') }; stale.items = []; return stale; }
  const { candidates, blockedCount } = extractCandidates(source, effectiveGate, nowMs); const twoTopping = buildParlay('TWO-TOPPING', candidates, 2, MIN_TWO_EV); const threeTopping = buildParlay('THREE-TOPPING', candidates, 3, MIN_THREE_EV); const status = twoTopping.status === 'PLAY' || threeTopping.status === 'PLAY' ? 'READY' : 'NO_QUALIFIED_PIZZA';
  const output = { ...base, status, message: status === 'READY' ? 'Pizza is served from the latest stored odds snapshot.' : 'No qualifying Pizza parlay cleared every gate.', candidateCount: candidates.length, blockedByBettingEdgeCount: blockedCount, twoTopping, threeTopping }; output.items = [twoTopping, threeTopping].filter(x => x.status === 'PLAY'); return output;
}
function validateParlay(parlay, size, minEv) { if (!parlay || !['PLAY', 'NO_PLAY'].includes(parlay.status)) throw new Error(`invalid ${size}-leg parlay state`); if (parlay.status === 'NO_PLAY') return; if (parlay.legCount !== size || !Array.isArray(parlay.legs) || parlay.legs.length !== size) throw new Error(`invalid ${size}-leg count`); if (!parlay.book || new Set(parlay.legs.map(x => x.book)).size !== 1 || parlay.legs[0].book !== parlay.book) throw new Error(`${size}-leg parlay must use one sportsbook`); if (new Set(parlay.legs.map(x => x.eventId)).size !== size) throw new Error(`${size}-leg parlay repeats an event`); if (new Set(parlay.legs.map(x => x.sportKey || x.sport)).size < 2) throw new Error(`${size}-leg parlay is not cross-sport`); if (parlay.combined?.priceType !== 'ESTIMATED') throw new Error(`${size}-leg combined price must be labeled estimated`); if (!(Number(parlay.combined?.evPct) >= minEv * 100)) throw new Error(`${size}-leg EV below threshold`); }
function validateOutput(output) { if (output?.schema !== 2) throw new Error('pizza output schema must be 2'); validateParlay(output.twoTopping, 2, MIN_TWO_EV); validateParlay(output.threeTopping, 3, MIN_THREE_EV); return true; }
function selfTest() {
  const nowMs = Date.parse('2026-08-24T16:00:00Z'); const fixture = { schema: 5, generatedAt: '2026-08-24T15:59:00Z', generatedAtVancouver: '2026-08-24 08:59:00 America/Vancouver', source: 'TEST', bookmakers: ['Bet365', 'DraftKings'], events: [['1', 'Baseball', 'baseball', '18:00:00Z'], ['2', 'Football', 'football', '19:00:00Z'], ['3', 'Ice Hockey', 'ice-hockey', '20:00:00Z']].map(([id, name, slug, time]) => ({ id: Number(id), eventId: id, eventKey: `test:${id}`, home: `Home ${id}`, away: `Away ${id}`, date: `2026-08-24T${time}`, status: 'pending', sport: { name, slug }, league: { name: 'Test League' }, urls: {}, bookmakers: { Bet365: [{ name: 'ML', marketKey: 'ml', updatedAt: '2026-08-24T15:58:00Z', odds: [{ home: '2.05', away: '1.75', selectionKeys: { home: `${id}|ml|home||`, away: `${id}|ml|away||` } }] }], DraftKings: [{ name: 'ML', marketKey: 'ml', updatedAt: '2026-08-24T15:58:00Z', odds: [{ home: '1.80', away: '2.00', selectionKeys: { home: `${id}|ml|home||`, away: `${id}|ml|away||` } }] }] } })) };
  const gate = { report: { path: 'fixture', ts: 'fixture', label: 'fixture' }, statuses: new Map(), blocked: new Set() }; const output = build(fixture, { rawSource: JSON.stringify(fixture), nowMs, gate }); validateOutput(output); if (output.twoTopping.status !== 'PLAY' || output.threeTopping.status !== 'PLAY') throw new Error('self-test failed to build both toppings'); if (output.twoTopping.book !== 'Bet365' || output.threeTopping.book !== 'Bet365') throw new Error('self-test failed single-book pricing'); console.log('Pizza self-test OK');
}
if (process.argv.includes('--self-test')) { selfTest(); } else if (process.argv.includes('--check')) { validateOutput(JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'))); console.log('Pizza output validation OK'); } else { const rawSource = fs.readFileSync(SOURCE_PATH, 'utf8'); const source = JSON.parse(rawSource); const output = build(source, { rawSource }); fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n'); validateOutput(output); console.log(`Pizza Plays built from ${source.generatedAt}: ${output.twoTopping.status} / ${output.threeTopping.status}`); }
