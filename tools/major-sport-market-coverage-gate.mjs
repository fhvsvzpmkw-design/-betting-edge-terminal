#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AUTHORITY_PATH = 'data/major-sport-market-coverage-v1.json';
const PREFERENCES_PATH = 'data/preferences.json';
const FEED_PATH = 'data/live-odds.json';
const EXPECTED_AUTHORITY_ID = 'major-sport-market-coverage-v1';
const BOOKS = Object.freeze(['Bet365', 'DraftKings']);
const QUOTE_MAX_AGE_MINUTES = 30;
const PRIMARY_SCORE_EPSILON = 1e-8;
const FEED_MARKET_KEYS = Object.freeze({ moneyline: 'ml', spread: 'spread', total: 'totals' });

function die(message) { throw new Error(message); }
function ensure(condition, message) { if (!condition) die(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function isObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function int(value, label) { ensure(Number.isInteger(value) && value >= 0, `${label} must be a non-negative integer`); }
function parseMs(value) { const ms = Date.parse(value || ''); return Number.isFinite(ms) ? ms : null; }
function ageMinutes(older, newer) { const a = parseMs(older), b = parseMs(newer); return a === null || b === null ? Infinity : Math.max(0, (b - a) / 60000); }
function quoteFresh(updatedAt, generatedAt) { return ageMinutes(updatedAt, generatedAt) <= QUOTE_MAX_AGE_MINUTES; }
function decimalOdds(value) { const n = Number(value); return Number.isFinite(n) && n > 1.001 ? n : null; }
function implied(value) { const odds = decimalOdds(value); return odds ? 1 / odds : null; }
function marketKey(market) { return String(market?.marketKey || market?.identity?.marketKey || '').toLowerCase(); }
function eventId(event) { return String(event?.eventId || event?.identity?.eventId || event?.id || '').trim(); }
function rowLine(row) {
  for (const key of ['hdp', 'line', 'total', 'points']) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}
function selectionKey(row, side) { return String(row?.selectionKeys?.[side] || row?.identity?.selectionKeys?.[side] || '').trim(); }
function explicitPrimaryRow(row) { return row?.primary === true || row?.isPrimary === true || row?.main === true || row?.isMain === true || row?.mainLine === true || row?.isMainLine === true; }
function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(buffer).digest('hex');
}

function localDateKey(timestamp, timeZone) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year && values.month && values.day ? `${values.year}-${values.month}-${values.day}` : null;
}

function normalizedText(...values) {
  return values.filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function majorSportKey(event) {
  const sport = normalizedText(event?.sport?.slug || event?.identity?.sportKey || event?.sport?.name);
  const leagueSlug = normalizedText(event?.league?.slug || event?.identity?.leagueKey);
  const league = normalizedText(event?.league?.slug, event?.league?.name, event?.identity?.leagueKey);

  if (sport === 'baseball' && (leagueSlug === 'usa mlb' || /\bmlb\b|major league baseball/.test(league))) return 'MLB';
  if (sport === 'ice hockey' && (leagueSlug === 'usa nhl' || /\bnhl\b|national hockey league/.test(league))) return 'NHL';
  if (sport === 'basketball' && (['usa nba', 'usa wnba'].includes(leagueSlug) || /\bnba\b|\bwnba\b|national basketball association/.test(league))) return 'NBA_WNBA';
  if (sport !== 'american football') return null;
  if (leagueSlug === 'usa nfl' || /\bnfl\b|national football league/.test(league)) return 'NFL';
  if (['usa college', 'usa ncaaf'].includes(leagueSlug) || /\bncaaf\b|\bncaa\b|college/.test(league)) return 'NCAAF';
  if (['canada cfl', 'canadian football league'].includes(leagueSlug) || /\bcfl\b|canadian football league/.test(league)) return 'CFL';
  return null;
}

export function mergedFeedEvents(feed) {
  const merged = new Map();
  for (const event of feed?.events || []) {
    const id = eventId(event);
    if (id) merged.set(id, { ...event, bookmakers: { ...(event?.bookmakers || {}) } });
  }
  for (const collection of [feed?.deepMarkets || [], feed?.baseballProps || []]) {
    for (const event of collection) {
      const id = eventId(event);
      if (!id || !merged.has(id)) continue;
      const current = merged.get(id);
      const next = { ...event, ...current, bookmakers: { ...(current?.bookmakers || {}) } };
      for (const [book, markets] of Object.entries(event?.bookmakers || {})) {
        next.bookmakers[book] = [...(next.bookmakers[book] || []), ...(Array.isArray(markets) ? markets : [])];
      }
      merged.set(id, next);
    }
  }
  return merged;
}

function latestMarket(event, book, wantedKey) {
  const markets = Array.isArray(event?.bookmakers?.[book]) ? event.bookmakers[book] : [];
  return markets
    .filter(market => marketKey(market) === wantedKey)
    .sort((a, b) => (parseMs(b?.updatedAt) ?? -Infinity) - (parseMs(a?.updatedAt) ?? -Infinity))[0] || null;
}

function inspectFixedMarket(market, selections) {
  const states = {};
  for (const side of selections) {
    let pricedWithoutIdentity = false;
    for (const row of market?.odds || []) {
      if (!decimalOdds(row?.[side])) continue;
      if (selectionKey(row, side)) { states[side] = 'AVAILABLE'; break; }
      pricedWithoutIdentity = true;
    }
    if (!states[side]) states[side] = pricedWithoutIdentity ? 'IDENTITY' : 'INCOMPLETE';
  }
  return { state: 'RESOLVED', selections: states };
}

export function inspectPrimaryLineMarket(market, selections) {
  const rows = (market?.odds || []).filter(row => rowLine(row) !== null);
  if (!rows.length) return { state: 'INCOMPLETE' };

  const marked = rows.filter(explicitPrimaryRow);
  let candidates;
  if (marked.length) {
    candidates = marked;
  } else {
    const priced = rows.map(row => {
      const first = implied(row?.[selections[0]]);
      const second = implied(row?.[selections[1]]);
      return first && second ? { row, balance: Math.abs(first - second) } : null;
    }).filter(Boolean);
    if (!priced.length) return { state: 'INCOMPLETE' };
    const minimum = Math.min(...priced.map(item => item.balance));
    candidates = priced.filter(item => Math.abs(item.balance - minimum) <= PRIMARY_SCORE_EPSILON).map(item => item.row);
  }

  const lines = [...new Set(candidates.map(rowLine))];
  if (lines.length !== 1) return { state: 'AMBIGUOUS' };
  const line = lines[0];
  const lineRows = rows.filter(row => Math.abs(rowLine(row) - line) <= 0.001);
  const states = {};
  for (const side of selections) {
    const priced = lineRows.filter(row => decimalOdds(row?.[side]));
    if (priced.some(row => selectionKey(row, side))) states[side] = 'AVAILABLE';
    else states[side] = priced.length ? 'IDENTITY' : 'INCOMPLETE';
  }
  return { state: 'RESOLVED', selections: states, line, method: marked.length ? 'PROVIDER_PRIMARY' : 'MARKET_CENTER' };
}

function inspectBookPrimary(event, book, spec, feedGeneratedAt) {
  const wantedKey = FEED_MARKET_KEYS[spec.market];
  const market = latestMarket(event, book, wantedKey);
  if (!market) return { state: 'MISSING' };
  if (!quoteFresh(market?.updatedAt, feedGeneratedAt)) return { state: 'STALE' };
  return spec.primaryLineOnly
    ? inspectPrimaryLineMarket(market, spec.requiredSelections)
    : inspectFixedMarket(market, spec.requiredSelections);
}

function unavailableReason(bookResults, selection) {
  const resolved = bookResults.filter(result => result.state === 'RESOLVED');
  if (resolved.some(result => result.selections?.[selection] === 'IDENTITY')) return 'IDENTITY_UNRESOLVED';
  if (resolved.length) return 'INCOMPLETE_TWO_SIDED_MARKET';
  if (bookResults.some(result => result.state === 'AMBIGUOUS')) return 'PRIMARY_LINE_UNRESOLVED';
  if (bookResults.some(result => result.state === 'INCOMPLETE')) return 'INCOMPLETE_TWO_SIDED_MARKET';
  if (bookResults.some(result => result.state === 'STALE')) return 'STALE_EXECUTABLE_QUOTE';
  return 'MARKET_NOT_RETURNED';
}

function primarySpecs(policy, sport) {
  return sport === 'NFL' || sport === 'NCAAF' || sport === 'CFL'
    ? policy.sports.FOOTBALL.primary
    : policy.sports[sport].primary;
}

function isPlayerPropMarket(market) {
  const text = normalizedText(marketKey(market), market?.name);
  if (/\bteam total\b|\bwinning margin\b|\bfirst team\b|\blast team\b/.test(text)) return false;
  return /\bplayer\b|\bpitcher\b|\bbatter\b|\bstrikeouts?\b|\bruns batted in\b|\brbi\b|\btotal bases?\b|\bhome runs?\b|\bstolen bases?\b|\bhits? o u\b|\bruns? o u\b|\bdoubles? o u\b|\btriples? o u\b|\bdouble double\b|\btriple double\b|\bpoint assist and rebound\b|\btouchdown scor|\bpassing\b|\brushing\b|\breceiving\b|\breceptions?\b|\bgoalie\b|\bshots on goal\b|\bgoalscorer\b|\bthree pointers?\b/.test(text);
}

function freshPropSelectionKeys(event, feedGeneratedAt) {
  const keys = new Set();
  for (const book of BOOKS) {
    for (const market of event?.bookmakers?.[book] || []) {
      if (!isPlayerPropMarket(market) || !quoteFresh(market?.updatedAt, feedGeneratedAt)) continue;
      for (const row of market?.odds || []) {
        const supplied = { ...(row?.identity?.selectionKeys || {}), ...(row?.selectionKeys || {}) };
        for (const [side, key] of Object.entries(supplied)) {
          if (nonEmpty(String(key)) && decimalOdds(row?.[side])) keys.add(String(key));
        }
      }
    }
  }
  return keys;
}

export function deriveBoundCoverage(report, feed, policy) {
  ensure(isObject(feed), 'Bound odds feed must be an object');
  ensure(Array.isArray(feed.events), 'Bound odds feed events must be an array');
  ensure(String(feed.generatedAt || '') === String(report?.feedGeneratedAt || ''), `Bound feed ${feed.generatedAt || 'unknown'} does not match report ${report?.feedGeneratedAt || 'unknown'}`);
  ensure(parseMs(feed.generatedAt) !== null, 'Bound odds feed generatedAt must be parseable');
  const reportMs = parseMs(report?.ts);
  const reportDate = localDateKey(report?.ts, policy.timezone);
  ensure(reportMs !== null && reportDate, 'Cannot derive coverage from an invalid report timestamp');

  const sportKeys = policy.coverageAudit.sportKeys;
  const games = Object.fromEntries(sportKeys.map(sport => [sport, new Map()]));
  for (const event of feed?.events || []) {
    const sport = majorSportKey(event);
    if (!sport) continue;
    const id = eventId(event);
    const startMs = parseMs(event?.date || event?.identity?.startTime);
    const eventDate = localDateKey(event?.date || event?.identity?.startTime, policy.timezone);
    ensure(id, `Bound feed ${sport} event is missing exact event identity`);
    ensure(startMs !== null && eventDate, `Bound feed ${sport} event ${id} has an invalid start time`);
    if (startMs <= reportMs || eventDate !== reportDate) continue;
    games[sport].set(id, event);
  }

  const merged = mergedFeedEvents(feed);
  const sports = {};
  const limitations = new Map();
  for (const sport of sportKeys) {
    let evaluated = 0;
    let unavailable = 0;
    const propKeys = new Set();
    for (const [id, primaryEvent] of games[sport]) {
      const event = merged.get(id) || primaryEvent;
      for (const spec of primarySpecs(policy, sport)) {
        const results = BOOKS.map(book => inspectBookPrimary(event, book, spec, feed.generatedAt));
        for (const selection of spec.requiredSelections) {
          const available = results.some(result => result.state === 'RESOLVED' && result.selections?.[selection] === 'AVAILABLE');
          if (available) { evaluated += 1; continue; }
          unavailable += 1;
          limitations.set(`${sport}|${id}|${spec.marketDetail}|${selection}`, unavailableReason(results, selection));
        }
      }
      for (const key of freshPropSelectionKeys(event, feed.generatedAt)) propKeys.add(key);
    }
    sports[sport] = {
      eventIds: [...games[sport].keys()].sort(),
      gamesInScope: games[sport].size,
      primary: {
        required: games[sport].size * policy.coverageAudit.primarySelectionsPerGame,
        evaluated,
        unavailable
      },
      propsReturned: propKeys.size
    };
  }
  return { sports, limitations };
}

function loadBoundFeed(root, report, sidecar, feedFile = null) {
  const sha = String(sidecar?.provenance?.feedBlobSha || '');
  ensure(/^[0-9a-f]{40}$/i.test(sha), 'Sidecar provenance.feedBlobSha must be a Git SHA');
  let raw = null;
  if (feedFile) {
    raw = fs.readFileSync(path.isAbsolute(feedFile) ? feedFile : path.join(root, feedFile));
  } else {
    try { raw = execFileSync('git', ['cat-file', 'blob', sha], { cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { /* exact checked working-tree fallback below */ }
    if (!raw) {
      const livePath = path.join(root, FEED_PATH);
      ensure(fs.existsSync(livePath), `Cannot resolve exact bound odds snapshot ${sha}`);
      raw = fs.readFileSync(livePath);
    }
  }
  ensure(gitBlobSha(raw) === sha, `Resolved odds snapshot does not match provenance.feedBlobSha ${sha}`);
  let feed;
  try { feed = JSON.parse(raw.toString('utf8')); }
  catch { die(`Bound odds snapshot ${sha} is not valid JSON`); }
  ensure(String(feed?.generatedAt || '') === String(report?.feedGeneratedAt || ''), `Bound feed ${feed?.generatedAt || 'unknown'} does not match report ${report?.feedGeneratedAt || 'unknown'}`);
  return feed;
}
function authority(root = process.cwd()) {
  const file = path.join(root, AUTHORITY_PATH);
  const raw = fs.readFileSync(file);
  const policy = JSON.parse(raw.toString('utf8'));
  ensure(policy.schema === 1, 'Major-sport coverage authority schema must be 1');
  ensure(policy.authorityId === EXPECTED_AUTHORITY_ID, 'Major-sport coverage authority id mismatch');
  ensure(policy.state === 'OPERATIONAL', 'Major-sport coverage authority must be OPERATIONAL');
  ensure(isObject(policy.coverageAudit), 'Major-sport coverage authority is missing coverageAudit policy');
  return { policy, blobSha: gitBlobSha(raw) };
}
function cardTarget(root = process.cwd()) {
  const preferences = readJson(path.join(root, PREFERENCES_PATH));
  const module = (preferences.modules || []).find(item => item?.id === 'report_card_target');
  ensure(module, 'report_card_target preference is missing');
  int(module.current, 'report_card_target.current');
  ensure(module.overflowProtection === true, 'report_card_target overflowProtection must be true');
  return module.current;
}

const SELECTIONS_BY_DETAIL = Object.freeze({
  full_game_moneyline: ['home', 'away'],
  full_game_primary_run_line: ['home', 'away'],
  full_game_primary_puck_line: ['home', 'away'],
  full_game_primary_spread: ['home', 'away'],
  full_game_primary_total: ['over', 'under']
});

function allowedDetailsForSport(sport) {
  if (sport === 'MLB') return new Set(['full_game_moneyline', 'full_game_primary_run_line', 'full_game_primary_total']);
  if (sport === 'NHL') return new Set(['full_game_moneyline', 'full_game_primary_puck_line', 'full_game_primary_total']);
  if (sport === 'NBA_WNBA') return new Set(['full_game_moneyline', 'full_game_primary_spread', 'full_game_primary_total']);
  if (['NFL', 'NCAAF', 'CFL'].includes(sport)) return new Set(['full_game_moneyline', 'full_game_primary_spread', 'full_game_primary_total']);
  return new Set();
}

export function activeReportScope(report, policy) {
  const scope = policy?.reportScope;
  if (!scope) return null; // Historical authority before the scope amendment.
  ensure(parseMs(scope.effectiveFrom) !== null, 'reportScope.effectiveFrom must be parseable');
  ensure(parseMs(report?.ts) !== null, 'Cannot resolve report scope without a valid report timestamp');
  if (parseMs(report.ts) < parseMs(scope.effectiveFrom)) return null;
  ensure(scope.id === 'PRIMARY_FULL_GAME_ONLY', 'Unsupported report scope');
  ensure(scope.playerProps === 'PAUSED_BY_SCOPE', 'Player props must remain paused under the current report scope');
  ensure(Array.isArray(scope.enabledPropMarkets) && scope.enabledPropMarkets.length === 0,
    'Prop markets require a separately validated scope amendment before activation');
  return scope;
}

export function isPlayerPropRecommendation(rec) {
  const context = rec?.coreAssessment?.context || {};
  return /player.?props?|pitcher|batter|goalie/i.test(String(context.marketClass || '')) ||
    isPlayerPropMarket({ marketKey: rec?.feed?.marketKey, name: rec?.feed?.market });
}

// Scope belongs to the checked-out report code, even when bundle files/cwd are temporary.
export function validateReportMarketScope(report, { root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), policy = null } = {}) {
  const selectedPolicy = policy || authority(root).policy;
  const scope = activeReportScope(report, selectedPolicy);
  if (!scope) return null;
  ensure(Array.isArray(report?.recs), 'Scoped report requires a recommendations array');
  for (const [index, rec] of report.recs.entries()) {
    const context = rec?.coreAssessment?.context || {};
    const sport = ['NBA', 'WNBA'].includes(context.sport) ? 'NBA_WNBA' : context.sport;
    const spec = selectedPolicy.coverageAudit.sportKeys.includes(sport)
      ? primarySpecs(selectedPolicy, sport).find(item => item.marketDetail === context.marketDetail)
      : null;
    ensure(spec && context.marketClass === spec.market && !isPlayerPropRecommendation(rec),
      `Recommendation ${index + 1} is outside PRIMARY_FULL_GAME_ONLY: ${rec?.title || 'untitled'}; props are PAUSED_BY_SCOPE`);
    ensure(marketKey(rec?.feed) === FEED_MARKET_KEYS[spec.market] &&
      spec.requiredSelections.includes(rec?.feed?.side),
      `Recommendation ${index + 1} feed identity is outside the allowed full-game market/side`);
    // Some legitimate primary rows carry provider labels (for example a spread label).
    // Unverified primary PASS cards may lack a selection key; execution identity remains
    // governed by the existing gates. Scope only cross-checks keys when supplied.
    if (nonEmpty(rec?.feed?.selectionKey)) {
      const exactKey = rec.feed.selectionKey.split('|');
      ensure(exactKey.length === 5 && exactKey[1] === FEED_MARKET_KEYS[spec.market] &&
        exactKey[2] === rec.feed.side,
        `Recommendation ${index + 1} selectionKey is outside the allowed full-game market/side`);
    }
  }
  return scope;
}

function sumSports(sports, sportKeys, propsPaused = false) {
  const totals = {
    gamesInScope: 0,
    gamesEvaluated: 0,
    primaryRequired: 0,
    primaryEvaluated: 0,
    primaryUnavailable: 0,
    propsReturned: 0,
    propsScreened: 0,
    seriousPropsDeepReviewed: 0
  };
  if (propsPaused) totals.propsExcludedByScope = 0;
  for (const key of sportKeys) {
    const row = sports[key];
    totals.gamesInScope += row.gamesInScope;
    totals.gamesEvaluated += row.gamesEvaluated;
    totals.primaryRequired += row.primary.required;
    totals.primaryEvaluated += row.primary.evaluated;
    totals.primaryUnavailable += row.primary.unavailable;
    totals.propsReturned += row.props.returned;
    totals.propsScreened += row.props.screened;
    totals.seriousPropsDeepReviewed += row.props.seriousDeepReviewed;
    if (propsPaused) totals.propsExcludedByScope += row.props.excludedByScope;
  }
  return totals;
}

export function validateCoverageAudit(report, sidecar, { root = process.cwd(), requireCurrentAuthority = true, feed = null, feedFile = null } = {}) {
  ensure(isObject(report), 'Coverage gate report must be an object');
  ensure(isObject(sidecar), 'Coverage gate sidecar must be an object');
  const { policy, blobSha } = authority(root);
  const auditPolicy = policy.coverageAudit;
  const cutover = Date.parse(auditPolicy.requiredFrom);
  const reportMs = Date.parse(report.ts || '');
  ensure(Number.isFinite(reportMs), 'Coverage gate report.ts must be parseable');
  if (reportMs < cutover) return { enforced: false, reason: 'pre-cutover' };
  const scope = validateReportMarketScope(report, { policy });
  const propsPaused = Boolean(scope);

  const audit = sidecar[auditPolicy.sidecarField];
  ensure(isObject(audit), `Sidecar ${auditPolicy.sidecarField} is required for reports at/after ${auditPolicy.requiredFrom}`);
  ensure(audit.schema === auditPolicy.schema, 'coverageAudit schema mismatch');
  ensure(audit.authorityId === policy.authorityId, 'coverageAudit authorityId mismatch');
  ensure(audit.authorityPath === AUTHORITY_PATH, 'coverageAudit authorityPath mismatch');
  ensure(/^[0-9a-f]{40}$/i.test(String(audit.authorityBlobSha || '')), 'coverageAudit authorityBlobSha must be a Git SHA');
  if (requireCurrentAuthority) ensure(audit.authorityBlobSha === blobSha, 'coverageAudit authorityBlobSha does not match current operational authority');
  ensure(audit.state === auditPolicy.state, `coverageAudit state must be ${auditPolicy.state}`);
  ensure(audit.feedGeneratedAt === report.feedGeneratedAt, 'coverageAudit feedGeneratedAt must match report.feedGeneratedAt');
  ensure(/^[0-9a-f]{40}$/i.test(String(sidecar?.provenance?.feedBlobSha || '')), 'Sidecar provenance.feedBlobSha must be a Git SHA');
  ensure(audit.evaluationOrder === policy.principles.evaluationOrder, 'coverageAudit evaluationOrder mismatch');
  ensure(audit.complete === true, 'coverageAudit complete must be true');
  if (propsPaused) {
    ensure(audit.scope?.id === scope.id && audit.scope?.effectiveFrom === scope.effectiveFrom &&
      audit.scope?.playerProps === scope.playerProps, 'coverageAudit.scope must match the active report scope');
    ensure(Array.isArray(sidecar.recommendations), 'Scoped sidecar requires recommendations');
    ensure(sidecar.recommendations.length === report.recs.length, 'Scoped report/sidecar recommendation counts must match');
    for (const [index, item] of sidecar.recommendations.entries()) {
      const actual = item?.coreAssessment?.context || {};
      const expected = report.recs[index]?.coreAssessment?.context || {};
      for (const field of ['sport', 'marketClass', 'marketDetail']) {
        ensure(actual[field] === expected[field], `Sidecar recommendation ${index + 1} scope context ${field} differs from report`);
      }
    }
  }

  ensure(isObject(audit.sports), 'coverageAudit.sports must be an object');
  const sportKeys = auditPolicy.sportKeys;
  ensure(Object.keys(audit.sports).length === sportKeys.length, 'coverageAudit.sports must contain exactly the controlled sport keys');
  for (const sport of sportKeys) {
    const row = audit.sports[sport];
    ensure(isObject(row), `coverageAudit.sports.${sport} is required`);
    int(row.gamesInScope, `coverageAudit.sports.${sport}.gamesInScope`);
    int(row.gamesEvaluated, `coverageAudit.sports.${sport}.gamesEvaluated`);
    ensure(row.gamesEvaluated === row.gamesInScope, `coverageAudit.sports.${sport}.gamesEvaluated must equal gamesInScope`);
    ensure(isObject(row.primary), `coverageAudit.sports.${sport}.primary is required`);
    for (const key of ['required', 'evaluated', 'unavailable']) int(row.primary[key], `coverageAudit.sports.${sport}.primary.${key}`);
    ensure(row.primary.required === row.gamesInScope * auditPolicy.primarySelectionsPerGame, `coverageAudit.sports.${sport}.primary.required must equal gamesInScope * ${auditPolicy.primarySelectionsPerGame}`);
    ensure(row.primary.evaluated + row.primary.unavailable === row.primary.required, `coverageAudit.sports.${sport} primary arithmetic does not reconcile`);
    ensure(isObject(row.props), `coverageAudit.sports.${sport}.props is required`);
    for (const key of ['returned', 'screened', 'seriousDeepReviewed']) int(row.props[key], `coverageAudit.sports.${sport}.props.${key}`);
    if (propsPaused) {
      ensure(row.props.state === 'PAUSED_BY_SCOPE', `coverageAudit.sports.${sport}.props.state must be PAUSED_BY_SCOPE`);
      int(row.props.excludedByScope, `coverageAudit.sports.${sport}.props.excludedByScope`);
      ensure(row.props.excludedByScope === row.props.returned, `coverageAudit.sports.${sport}.props.excludedByScope must equal props.returned`);
      ensure(row.props.screened === 0 && row.props.seriousDeepReviewed === 0,
        `coverageAudit.sports.${sport} props are paused: screening and deeper analysis must be zero`);
    } else {
      ensure(row.props.screened === row.props.returned, `coverageAudit.sports.${sport}.props.screened must equal props.returned`);
    }
    ensure(row.props.seriousDeepReviewed <= row.props.screened, `coverageAudit.sports.${sport}.props.seriousDeepReviewed cannot exceed props.screened`);
  }

  ensure(Array.isArray(audit.availabilityLimitations), 'coverageAudit.availabilityLimitations must be an array');
  const allowedReasons = new Set(auditPolicy.availabilityReasonCodes);
  const unavailableTuples = new Map();
  let limitationsSelectionCount = 0;
  for (const [index, item] of audit.availabilityLimitations.entries()) {
    ensure(isObject(item), `coverageAudit.availabilityLimitations[${index}] must be an object`);
    ensure(nonEmpty(item.eventId), `coverageAudit.availabilityLimitations[${index}].eventId is required`);
    ensure(sportKeys.includes(item.sport), `coverageAudit.availabilityLimitations[${index}].sport is invalid`);
    ensure(allowedDetailsForSport(item.sport).has(item.marketDetail), `coverageAudit.availabilityLimitations[${index}].marketDetail is invalid for ${item.sport}`);
    ensure(allowedReasons.has(item.reason), `coverageAudit.availabilityLimitations[${index}].reason is invalid`);
    ensure(Array.isArray(item.selections) && item.selections.length > 0, `coverageAudit.availabilityLimitations[${index}].selections must be non-empty`);
    const permittedSelections = new Set(SELECTIONS_BY_DETAIL[item.marketDetail] || []);
    for (const selection of item.selections) {
      ensure(permittedSelections.has(selection), `coverageAudit.availabilityLimitations[${index}] selection ${selection} is invalid for ${item.marketDetail}`);
      const tuple = `${item.sport}|${item.eventId}|${item.marketDetail}|${selection}`;
      ensure(!unavailableTuples.has(tuple), `coverageAudit availability limitation duplicates ${tuple}`);
      unavailableTuples.set(tuple, item.reason);
      limitationsSelectionCount++;
    }
  }

  ensure(isObject(audit.presentation), 'coverageAudit.presentation must be an object');
  int(audit.presentation.target, 'coverageAudit.presentation.target');
  ensure(audit.presentation.target === cardTarget(root), 'coverageAudit.presentation.target does not match repository report_card_target');
  ensure(audit.presentation.targetIsSoft === true, 'coverageAudit.presentation.targetIsSoft must be true');
  ensure(audit.presentation.overflowProtection === true, 'coverageAudit.presentation.overflowProtection must be true');
  int(audit.presentation.actionableSuppressedByTarget, 'coverageAudit.presentation.actionableSuppressedByTarget');
  ensure(audit.presentation.actionableSuppressedByTarget === 0, 'coverageAudit may not suppress actionable recommendations to meet the card target');

  ensure(isObject(audit.totals), 'coverageAudit.totals must be an object');
  const calculatedTotals = sumSports(audit.sports, sportKeys, propsPaused);
  for (const [key, expected] of Object.entries(calculatedTotals)) {
    int(audit.totals[key], `coverageAudit.totals.${key}`);
    ensure(audit.totals[key] === expected, `coverageAudit.totals.${key} does not reconcile with sport rows`);
  }
  ensure(limitationsSelectionCount === calculatedTotals.primaryUnavailable, 'coverageAudit availabilityLimitations selection count must equal total primaryUnavailable');

  const boundFeed = feed || loadBoundFeed(root, report, sidecar, feedFile);
  const bound = deriveBoundCoverage(report, boundFeed, policy);
  const mismatches = [];
  for (const sport of sportKeys) {
    const actual = audit.sports[sport];
    const expected = bound.sports[sport];
    if (actual.gamesInScope !== expected.gamesInScope) {
      mismatches.push(`${sport}.gamesInScope ${actual.gamesInScope} != ${expected.gamesInScope} [${expected.eventIds.join(',') || 'none'}]`);
    }
    if (actual.gamesEvaluated !== expected.gamesInScope) mismatches.push(`${sport}.gamesEvaluated ${actual.gamesEvaluated} != ${expected.gamesInScope}`);
    for (const field of ['required', 'evaluated', 'unavailable']) {
      if (actual.primary[field] !== expected.primary[field]) mismatches.push(`${sport}.primary.${field} ${actual.primary[field]} != ${expected.primary[field]}`);
    }
    if (actual.props.returned !== expected.propsReturned) mismatches.push(`${sport}.props.returned ${actual.props.returned} != ${expected.propsReturned}`);
    const expectedScreened = propsPaused ? 0 : expected.propsReturned;
    if (actual.props.screened !== expectedScreened) mismatches.push(`${sport}.props.screened ${actual.props.screened} != ${expectedScreened}`);
  }

  for (const [tuple, reason] of bound.limitations) {
    if (!unavailableTuples.has(tuple)) mismatches.push(`missing limitation ${tuple} (${reason})`);
    else if (unavailableTuples.get(tuple) !== reason) mismatches.push(`limitation ${tuple} reason ${unavailableTuples.get(tuple)} != ${reason}`);
  }
  for (const [tuple, reason] of unavailableTuples) {
    if (!bound.limitations.has(tuple)) mismatches.push(`extra limitation ${tuple} (${reason})`);
  }
  ensure(mismatches.length === 0, `coverageAudit does not match exact bound feed: ${mismatches.slice(0, 24).join('; ')}${mismatches.length > 24 ? `; +${mismatches.length - 24} more` : ''}`);

  return { enforced: true, audit, calculatedTotals, boundCoverage: bound, authorityBlobSha: blobSha };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith('--')) die(`Unexpected argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) { args[key] = next; i++; }
    else args[key] = true;
  }
  return args;
}

function makeSport(gamesInScope, evaluated, unavailable, propsReturned, serious = 0) {
  return {
    gamesInScope,
    gamesEvaluated: gamesInScope,
    primary: { required: gamesInScope * 6, evaluated, unavailable },
    props: { returned: propsReturned, screened: propsReturned, seriousDeepReviewed: serious }
  };
}

function selfTest() {
  const { policy, blobSha } = authority();
  const report = { ts: policy.coverageAudit.requiredFrom, feedGeneratedAt: '2026-09-02T14:55:00.000Z' };
  const feed = {
    generatedAt: report.feedGeneratedAt,
    events: [{
      id: '63301763',
      eventId: '63301763',
      date: '2026-09-02T20:00:00.000Z',
      sport: { slug: 'baseball' },
      league: { slug: 'usa-mlb', name: 'USA - MLB' },
      bookmakers: {
        Bet365: [
          {
            marketKey: 'ml', updatedAt: '2026-09-02T14:50:00.000Z',
            odds: [{ home: '1.80', away: '2.10', selectionKeys: { home: '63301763|ml|home||', away: '63301763|ml|away||' } }]
          },
          {
            marketKey: 'totals', updatedAt: '2026-09-02T14:50:00.000Z',
            odds: [{ hdp: 8.5, over: '1.91', under: '1.91', selectionKeys: { over: '63301763|totals|over||8.5', under: '63301763|totals|under||8.5' } }]
          },
          {
            marketKey: 'player-props', name: 'Player Props', updatedAt: '2026-09-02T14:50:00.000Z',
            odds: [{ label: 'Synthetic Player (Hits)', hdp: 0.5, over: '1.80', under: '2.05', selectionKeys: { over: '63301763|player-props|over|synthetic-player-hits|0.5', under: '63301763|player-props|under|synthetic-player-hits|0.5' } }]
          }
        ]
      }
    }]
  };
  const sports = {
    MLB: makeSport(1, 4, 2, 2, 1),
    NHL: makeSport(0, 0, 0, 0),
    NBA_WNBA: makeSport(0, 0, 0, 0),
    NFL: makeSport(0, 0, 0, 0),
    NCAAF: makeSport(0, 0, 0, 0),
    CFL: makeSport(0, 0, 0, 0)
  };
  const totals = sumSports(sports, policy.coverageAudit.sportKeys);
  const sidecar = {
    schema: 3,
    provenance: { feedBlobSha: '0'.repeat(40) },
    coverageAudit: {
      schema: 1,
      authorityId: policy.authorityId,
      authorityPath: AUTHORITY_PATH,
      authorityBlobSha: blobSha,
      state: 'COMPLETE',
      feedGeneratedAt: report.feedGeneratedAt,
      evaluationOrder: 'EVALUATE_BEFORE_CARD_SELECTION',
      sports,
      availabilityLimitations: [{
        eventId: '63301763',
        sport: 'MLB',
        marketDetail: 'full_game_primary_run_line',
        selections: ['home', 'away'],
        reason: 'MARKET_NOT_RETURNED'
      }],
      presentation: {
        target: cardTarget(),
        targetIsSoft: true,
        overflowProtection: true,
        actionableSuppressedByTarget: 0
      },
      totals,
      complete: true
    }
  };
  const result = validateCoverageAudit(report, sidecar, { feed });
  assert.equal(result.enforced, true);
  assert.equal(result.calculatedTotals.primaryUnavailable, 2);

  const badArithmetic = structuredClone(sidecar);
  badArithmetic.coverageAudit.sports.MLB.primary.evaluated = 5;
  assert.throws(() => validateCoverageAudit(report, badArithmetic, { feed }), /primary arithmetic/i);

  const missingLimitation = structuredClone(sidecar);
  missingLimitation.coverageAudit.availabilityLimitations = [];
  assert.throws(() => validateCoverageAudit(report, missingLimitation, { feed }), /availabilityLimitations selection count/i);

  const suppressed = structuredClone(sidecar);
  suppressed.coverageAudit.presentation.actionableSuppressedByTarget = 1;
  assert.throws(() => validateCoverageAudit(report, suppressed, { feed }), /may not suppress actionable/i);

  const omittedNcaaf = structuredClone(feed);
  omittedNcaaf.events.push({
    id: 'ncaaf-1', eventId: 'ncaaf-1', date: '2026-09-02T23:00:00.000Z',
    sport: { slug: 'american-football' }, league: { slug: 'usa-college', name: 'USA - College' },
    bookmakers: { Bet365: [{
      marketKey: 'ml', updatedAt: '2026-09-02T14:50:00.000Z',
      odds: [{ home: '1.50', away: '2.60', selectionKeys: { home: 'ncaaf-1|ml|home||', away: 'ncaaf-1|ml|away||' } }]
    }] }
  });
  assert.throws(() => validateCoverageAudit(report, sidecar, { feed: omittedNcaaf }), /NCAAF\.gamesInScope 0 != 1/);

  const freshSpread = structuredClone(feed);
  freshSpread.events[0].bookmakers.Bet365.push({
    marketKey: 'spread', updatedAt: '2026-09-02T14:35:00.000Z',
    odds: [{ hdp: -1.5, home: '1.91', away: '1.91', selectionKeys: { home: '63301763|spread|home||-1.5', away: '63301763|spread|away||-1.5' } }]
  });
  assert.throws(() => validateCoverageAudit(report, sidecar, { feed: freshSpread }), /MLB\.primary\.evaluated 4 != 6/);

  const preCutover = { ts: '2026-09-02T07:59:59-07:00', feedGeneratedAt: report.feedGeneratedAt };
  assert.equal(validateCoverageAudit(preCutover, { schema: 3 }).enforced, false);

  console.log('MAJOR SPORT COVERAGE GATE SELF-TEST OK');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'self-test') { selfTest(); return; }
  if (args.command !== 'validate' || !args.report || !args.sidecar) {
    die('Usage: major-sport-market-coverage-gate.mjs validate --report FILE --sidecar FILE [--feed FILE] [--root DIR] | self-test');
  }
  const root = path.resolve(args.root || process.cwd());
  const report = readJson(path.resolve(args.report));
  const sidecar = readJson(path.resolve(args.sidecar));
  const result = validateCoverageAudit(report, sidecar, { root, feedFile: args.feed || null });
  if (!result.enforced) {
    console.log(`MAJOR SPORT COVERAGE GATE PRE-CUTOVER ${report.ts}`);
    return;
  }
  console.log(`MAJOR SPORT COVERAGE GATE OK games=${result.calculatedTotals.gamesInScope} primary=${result.calculatedTotals.primaryRequired} props=${result.calculatedTotals.propsScreened}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(`MAJOR SPORT COVERAGE GATE ERROR: ${error.message}`); process.exit(1); }
}
