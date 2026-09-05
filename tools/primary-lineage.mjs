#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectPrimaryLineMarket, mergedFeedEvents, majorSportKey } from './major-sport-market-coverage-gate.mjs';

export const TOTAL_LINEAGE_FROM = '2026-09-05T13:30:00-07:00';
export const SPREAD_MOVEMENT_FROM = '2026-09-05T14:00:00-07:00';
const SPECS = {
  totals: { sides: ['over', 'under'], details: ['full_game_primary_total', 'full_game_total'], from: TOTAL_LINEAGE_FROM, name: 'total', sideName: 'Over/Under side' },
  spread: { sides: ['home', 'away'], details: ['full_game_primary_spread', 'full_game_spread', 'full_game_primary_run_line', 'full_game_run_line', 'full_game_primary_puck_line', 'full_game_puck_line'], from: SPREAD_MOVEMENT_FROM, name: 'spread', sideName: 'team/side' }
};
const BOOKS = ['Bet365', 'DraftKings'];
const SPORTS = new Set(['MLB', 'NHL', 'NBA', 'WNBA', 'NBA_WNBA', 'NFL', 'NCAAF', 'CFL']);
const ACTIVE = new Set(['BET', 'LEAN', 'WAIT']);
const DECISIONS = new Set([...ACTIVE, 'PASS']);
const EPSILON = 1e-8;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const ms = value => Number.isFinite(Date.parse(value || '')) ? Date.parse(value) : null;
const age = (older, newer) => ms(older) === null || ms(newer) === null ? Infinity : Math.max(0, (ms(newer) - ms(older)) / 60000);
const marketKey = value => String(value?.marketKey || value?.identity?.marketKey || value?.market || '').toLowerCase();
const number = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const lineOf = value => ['hdp', 'line', 'total', 'points'].map(key => number(value?.[key])).find(value => value !== null) ?? null;
const decimal = value => number(value) !== null && Number(value) > 1.001 ? Number(value) : null;
const selectionKey = (row, side) => String(row?.selectionKeys?.[side] || row?.identity?.selectionKeys?.[side] || '');
const eventId = event => String(event?.eventId || event?.identity?.eventId || event?.id || '');
const american = dec => { const n = dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1)); return n > 0 ? '+' + n : String(n); };
function americanToken(value) {
  const match = String(value ?? '').trim().match(/^([+-]\d{2,6})(?=\s|$|@|\()/);
  return match && Math.abs(Number(match[1])) >= 100 ? Number(match[1]) : null;
}
const priceDecimal = value => { const n = americanToken(value); return n === null ? null : n > 0 ? 1 + n / 100 : 1 + 100 / -n; };
const canonicalBook = value => { const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); return ['bet365', 'b365'].includes(key) ? 'Bet365' : key === 'draftkings' ? 'DraftKings' : null; };
const day = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
function ensure(condition, message) { if (!condition) throw new Error(message); }

export function lineageApplies(report, market) {
  return ms(report?.ts) !== null && ms(report.ts) >= ms(SPECS[market].from);
}
export function lineageEventSide(rec, market) {
  const feed = rec?.feed, spec = SPECS[market];
  if (marketKey(feed) !== market || !feed?.eventId || !spec.sides.includes(feed?.side)) return null;
  const detail = rec?.coreAssessment?.context?.marketDetail;
  if (detail && !spec.details.includes(detail)) return null;
  return [feed.eventId, market, feed.side].join('|');
}
function rawRecommendationLine(feed, market) {
  if (market !== 'spread') return lineOf(feed);
  // Archived spread cards may contain only their exact provider selectionKey.
  const parts = String(feed?.selectionKey || '').split('|');
  const keyed = parts.length === 5 && parts[0] === String(feed?.eventId) && parts[1] === market && parts[2] === feed?.side ? number(parts[4]) : null;
  const raw = number(feed?.hdp);
  if (raw !== null && keyed !== null && raw !== keyed) return null;
  return raw ?? keyed;
}
function displayLine(raw, side, market) {
  if (raw === null) return null;
  const line = market === 'spread' && side === 'away' ? -raw : raw;
  return Object.is(line, -0) ? 0 : line;
}
export function lineMovement(side, priorLine, currentLine, market) {
  ensure(SPECS[market].sides.includes(side) && number(priorLine) !== null && number(currentLine) !== null, 'Line movement requires an exact side and both numeric lines');
  const change = currentLine - priorLine;
  if (Math.abs(change) <= EPSILON) return 'LINE UNCHANGED';
  return (market === 'spread' || side === 'under' ? change > 0 : change < 0) ? 'LINE MOVED IN FAVOR' : 'LINE MOVED AGAINST';
}
export function priceMovement(priorPrice, currentPrice) {
  const oldDecimal = priceDecimal(priorPrice), newDecimal = priceDecimal(currentPrice);
  if (oldDecimal === null || newDecimal === null) return 'PRICE COMPARISON UNAVAILABLE';
  if (Math.abs(oldDecimal - newDecimal) <= EPSILON) return 'PRICE UNCHANGED';
  return newDecimal > oldDecimal ? 'PRICE IMPROVED' : 'PRICE WORSENED';
}

export function primaryLineQuote(event, book, side, generatedAt, wantedMarket) {
  const market = (event?.bookmakers?.[book] || []).filter(item => marketKey(item) === wantedMarket)
    .sort((a, b) => (ms(b.updatedAt) ?? -Infinity) - (ms(a.updatedAt) ?? -Infinity))[0];
  if (!market) return { book, state: 'MISSING' };
  if (age(market.updatedAt, generatedAt) > 30) return { book, state: 'STALE', updatedAt: market.updatedAt };
  // Use exactly the same primary-line resolver as the major-sport coverage gate.
  const result = inspectPrimaryLineMarket(market, SPECS[wantedMarket].sides);
  if (result.state !== 'RESOLVED') return { book, state: result.state, updatedAt: market.updatedAt };
  if (result.selections[side] !== 'AVAILABLE') return { book, state: result.selections[side], updatedAt: market.updatedAt };
  const rows = (market.odds || []).filter(row => lineOf(row) !== null &&
    Math.abs(lineOf(row) - result.line) <= EPSILON && decimal(row[side]) && selectionKey(row, side));
  const row = rows.sort((a, b) => Number(b[side]) - Number(a[side]))[0];
  if (!row) return { book, state: 'IDENTITY', updatedAt: market.updatedAt };
  const key = selectionKey(row, side), parts = key.split('|');
  if (parts.length !== 5 || parts[0] !== eventId(event) || parts[1] !== wantedMarket ||
    parts[2] !== side || number(parts[4]) !== result.line) return { book, state: 'IDENTITY', updatedAt: market.updatedAt };
  return { book, state: 'OK', line: displayLine(result.line, side, wantedMarket), rawLine: result.line, selectionKey: key, priceAmerican: american(Number(row[side])),
    priceDecimal: Number(row[side]), updatedAt: market.updatedAt, method: result.method };
}

function priorSelections(root, report, market) {
  const file = path.join(root, 'run-history.json');
  if (!fs.existsSync(file)) return [];
  const entries = (readJson(file).runs || []).filter(entry => ms(entry.ts) !== null &&
    ms(entry.ts) < ms(report.ts) && day(entry.ts) === day(report.ts) && entry.path)
    .sort((a, b) => ms(a.ts) - ms(b.ts));
  const latest = new Map();
  for (const entry of entries) {
    const source = path.join(root, entry.path);
    ensure(fs.existsSync(source), 'Indexed same-day report is missing: ' + entry.path);
    const issued = readJson(source);
    for (const rec of issued.recs || []) {
      const key = lineageEventSide(rec, market);
      if (key) latest.set(key, { rec, sourceTs: issued.ts, sourcePath: entry.path });
    }
  }
  return [...latest.values()];
}
function loadFeed(root, report, sidecar, feedFile) {
  if (feedFile) return readJson(path.resolve(feedFile));
  const sha = sidecar?.provenance?.feedBlobSha;
  if (/^[0-9a-f]{40}$/i.test(String(sha || ''))) {
    try { return JSON.parse(execFileSync('git', ['cat-file', 'blob', sha], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })); }
    catch { /* The live snapshot is usable only with exact generatedAt equality below. */ }
  }
  const feed = readJson(path.join(root, 'data/live-odds.json'));
  ensure(feed.generatedAt === report.feedGeneratedAt, 'Cannot resolve the exact report odds snapshot');
  return feed;
}
function decisionProblems(rec) {
  const problems = [], status = String(rec.status || '').toUpperCase();
  const stake = number(String(rec.stake ?? '').replace(/[$,\s]/g, ''));
  if (!DECISIONS.has(status)) problems.push('requires a current BET/LEAN/WAIT/PASS decision');
  if (status === 'BET' ? !(stake > 0) : stake !== 0) problems.push('current status/stake is inconsistent');
  if (!String(rec.fair || '').trim() || !String(rec.playTo || '').trim()) problems.push('requires current fair and playTo after reassessment');
  return problems;
}
function hasNumber(text, value) {
  return (String(text).match(/[+-]?\d+(?:\.\d+)?/g) || []).some(token => Math.abs(Number(token) - value) <= EPSILON);
}

export function auditPrimaryLineage({ root = process.cwd(), report, sidecar = null, feed = null, feedFile = null }, market) {
  const spec = SPECS[market];
  ensure(spec, 'Unsupported primary movement market');
  ensure(ms(report?.ts) !== null, 'Report ts is invalid');
  if (!lineageApplies(report, market)) return { ok: true, enforced: false, diagnostics: [], violations: [] };
  const tracked = priorSelections(root, report, market);
  if (!tracked.length) return { ok: true, enforced: true, diagnostics: [], violations: [] };
  feed ||= loadFeed(root, report, sidecar, feedFile);
  ensure(feed?.generatedAt === report.feedGeneratedAt, 'Bound feed generatedAt does not match report feedGeneratedAt');
  ensure(age(feed.generatedAt, report.ts) <= 75, 'Report feed is older than 75 minutes at issuance');
  const events = mergedFeedEvents(feed), currentBySide = new Map(), diagnostics = [], violations = [];
  for (const rec of report.recs || []) {
    const key = lineageEventSide(rec, market);
    if (!key) continue;
    if (currentBySide.has(key)) violations.push(key + ': duplicate current full-game ' + spec.name + ' side');
    currentBySide.set(key, rec);
  }
  for (const prior of tracked) {
    const old = prior.rec, key = lineageEventSide(old, market), event = events.get(String(old.feed.eventId));
    const sport = old?.coreAssessment?.context?.sport || majorSportKey(event);
    if (!SPORTS.has(sport)) continue;
    const start = ms(event?.date || event?.identity?.startTime || old.feed.eventDate);
    if (start !== null && start <= ms(report.ts)) continue;
    const current = currentBySide.get(key);
    // Resolved PASS cards may be curated; active BET/LEAN/WAIT candidates cannot vanish.
    if (!current && !ACTIVE.has(String(old.status || '').toUpperCase())) continue;
    const oldLine = displayLine(rawRecommendationLine(old.feed, market), old.feed.side, market);
    const diagnostic = { eventId: String(old.feed.eventId), side: old.feed.side, sport, sourceTs: prior.sourceTs,
      sourcePath: prior.sourcePath, priorSelectionKey: old.feed.selectionKey || null, priorLine: oldLine,
      priorPrice: old.price || null, priorBook: old.book || null, priorStatus: old.status,
      priorFair: old.fair || null, priorPlayTo: old.playTo || null };
    const problems = [];
    if (!current) {
      diagnostic.state = 'RECONCILIATION_REQUIRED';
      diagnostics.push(diagnostic);
      violations.push(key + ': tracked ' + spec.name + ' disappeared; preserve the game and ' + spec.sideName + ' and reconcile the current primary ' + spec.name);
      continue;
    }
    problems.push(...decisionProblems(current));
    const text = String(current.move || '').toUpperCase();
    const primary = BOOKS.map(book => primaryLineQuote(event, book, old.feed.side, feed.generatedAt, market));
    diagnostic.primary = primary;
    const usable = primary.filter(item => item.state === 'OK');
    if (!usable.length) {
      diagnostic.state = !event ? 'EVENT_NOT_IN_FEED' : primary.every(item => item.state === 'MISSING') ? 'MARKET_UNAVAILABLE' : 'PRICE_NOT_VERIFIED';
      const required = diagnostic.state === 'MARKET_UNAVAILABLE' ? /MARKET UNAVAILABLE|PRICE NOT VERIFIED/ : /PRICE NOT VERIFIED|IDENTITY MISMATCH|FEED STALE|CONFLICTING SIGNALS/;
      if (!required.test([text, current.price].join(' '))) problems.push('must explicitly identify the unavailable/unverified current ' + spec.name);
      if (String(current.status).toUpperCase() === 'BET' || priceDecimal(current.price) !== null) problems.push('cannot issue a BET or an executable price without a verified current primary ' + spec.name);
    } else {
      const selected = usable.find(item => item.book === canonicalBook(current.book));
      if (!selected) problems.push('current book does not have a fresh verified primary ' + spec.name + ' for this side');
      else {
        const currentLine = rawRecommendationLine(current.feed, market);
        const suppliedLines = (market === 'spread' ? ['hdp'] : ['hdp', 'line', 'total', 'points']).filter(field => current.feed[field] !== undefined && current.feed[field] !== null);
        if (currentLine !== selected.rawLine || suppliedLines.some(field => number(current.feed[field]) !== selected.rawLine) ||
          current.feed.selectionKey !== selected.selectionKey) problems.push('current identity must match the selected book primary ' + spec.name + ', not an old or alternate line');
        if (americanToken(current.price) !== Number(selected.priceAmerican)) problems.push('current price does not match the selected book exact fresh quote');
        diagnostic.currentLine = selected.line;
        diagnostic.currentPrice = selected.priceAmerican;
        diagnostic.currentBook = selected.book;
        diagnostic.currentSelectionKey = selected.selectionKey;
        const movement = oldLine === null ? 'PRIOR LINE UNVERIFIED' : lineMovement(old.feed.side, oldLine, selected.line, market);
        const oddsMovement = priceMovement(old.price, selected.priceAmerican);
        Object.assign(diagnostic, { state: movement, lineMovement: movement, priceMovement: oddsMovement });
        const unchanged = movement === 'LINE UNCHANGED' && oddsMovement === 'PRICE UNCHANGED' && text.includes('MOVEMENT UNCHANGED');
        if (!unchanged && (!text.includes(movement) || !text.includes(oddsMovement))) problems.push('movement text must report ' + movement + ' and ' + oddsMovement + ' separately');
        if (oldLine !== null && (!hasNumber(current.move, oldLine) || !hasNumber(current.move, selected.line))) problems.push('movement text must show the prior and current ' + spec.name + 's');
        if (oddsMovement !== 'PRICE COMPARISON UNAVAILABLE' &&
          (!hasNumber(current.move, americanToken(old.price)) || !hasNumber(current.move, Number(selected.priceAmerican)))) problems.push('movement text must show prior and current odds');
      }
      const distinct = new Set(usable.map(item => item.line));
      if (distinct.size > 1) {
        diagnostic.bookConflict = true;
        if (!text.includes('CONFLICTING SIGNALS')) problems.push('different book primary ' + spec.name + 's must be reported as CONFLICTING SIGNALS');
        for (const item of usable) if (!text.includes(item.book.toUpperCase()) || !hasNumber(current.move, item.line) || !hasNumber(current.move, Number(item.priceAmerican))) problems.push('preserve each conflicting book ' + spec.name + ' and price');
      }
      if (/MARKET UNAVAILABLE|PRICE NOT VERIFIED/.test(String(current.price || '').toUpperCase())) problems.push('fresh supported primary ' + spec.name + ' exists; it must not be presented as unavailable');
    }
    diagnostics.push(diagnostic);
    violations.push(...problems.map(problem => key + ': ' + problem));
  }
  return { ok: violations.length === 0, enforced: true, diagnostics, violations };
}

