#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergedFeedEvents, majorSportKey } from './major-sport-market-coverage-gate.mjs';
import { timestampMs, ageMinutes, americanToken, canonicalBook, hasNumber, priceMovement,
  loadBoundFeed, priorSelections, decisionProblems } from './primary-lineage.mjs';

export const MONEYLINE_MOVEMENT_FROM = '2026-09-05T14:15:00-07:00';
const BOOKS = ['Bet365', 'DraftKings'];
const SPORTS = new Set(['MLB', 'NHL', 'NBA', 'WNBA', 'NBA_WNBA', 'NFL', 'NCAAF', 'CFL']);
const ACTIVE = new Set(['BET', 'LEAN', 'WAIT']);
const keyOf = value => String(value?.marketKey || value?.identity?.marketKey || value?.market || '').toLowerCase();
const eventId = event => String(event?.eventId || event?.identity?.eventId || event?.id || '');
const odds = value => Number.isFinite(Number(value)) && Number(value) > 1.001 ? Number(value) : null;
const american = value => value >= 2 ? '+' + Math.round((value - 1) * 100) : String(Math.round(-100 / (value - 1)));
const normalize = value => String(value ?? '').replace(/−/g, '-');
const paused = value => value?.suspended === true || value?.active === false || ['suspended', 'closed', 'inactive'].includes(String(value?.status || '').toLowerCase());
const rowKey = (row, side) => String(row?.selectionKeys?.[side] || row?.identity?.selectionKeys?.[side] || '');
function ensure(condition, message) { if (!condition) throw new Error(message); }

export function moneylineApplies(report) {
  return timestampMs(report?.ts) !== null && timestampMs(report.ts) >= timestampMs(MONEYLINE_MOVEMENT_FROM);
}
export function moneylineEventSide(rec) {
  const feed = rec?.feed, detail = rec?.coreAssessment?.context?.marketDetail;
  if (keyOf(feed) !== 'ml' || !feed?.eventId || !['home', 'away'].includes(feed?.side)) return null;
  if (detail && !['full_game_moneyline', 'moneyline'].includes(detail)) return null;
  return [feed.eventId, 'ml', feed.side].join('|');
}
function exactKey(key, id, side) {
  const parts = key.split('|');
  return parts.length === 5 && parts[0] === id && parts[1] === 'ml' && parts[2] === side && parts[4] === '';
}
function quoteFromMarket(market, id, side) {
  if (paused(market)) return { state: 'SUSPENDED' };
  const rows = Array.isArray(market.odds) ? market.odds : [];
  if (rows.some(row => odds(row.draw))) return { state: 'MARKET_VARIANT_UNVERIFIED' };
  const priced = rows.filter(row => odds(row[side]));
  if (!priced.length) return { state: 'SIDE_UNAVAILABLE' };
  if (priced.some(paused)) return { state: 'SUSPENDED' };
  if (priced.some(row => !exactKey(rowKey(row, side), id, side))) return { state: 'IDENTITY' };
  const values = new Map(priced.map(row => {
    const selectionKey = rowKey(row, side), priceDecimal = odds(row[side]);
    return [selectionKey + '|' + priceDecimal, { selectionKey, priceDecimal, priceAmerican: american(priceDecimal) }];
  }));
  if (values.size !== 1) return { state: 'AMBIGUOUS' };
  return { state: 'OK', ...values.values().next().value };
}

export function newestMoneylineQuote(event, book, side, generatedAt) {
  const markets = (event?.bookmakers?.[book] || []).filter(market => keyOf(market) === 'ml')
    .sort((a, b) => (timestampMs(b.updatedAt) ?? -Infinity) - (timestampMs(a.updatedAt) ?? -Infinity));
  if (!markets.length) return { book, state: 'MISSING' };
  const updatedAt = markets[0].updatedAt;
  if (ageMinutes(updatedAt, generatedAt) > 30) return { book, state: 'STALE', updatedAt };
  // Only the newest entry is authoritative. Equal-time copies must agree.
  const latest = markets.filter(market => timestampMs(market.updatedAt) === timestampMs(updatedAt));
  const results = latest.map(market => quoteFromMarket(market, eventId(event), side));
  const distinct = new Set(results.map(result => JSON.stringify(result)));
  if (distinct.size !== 1) return { book, state: 'AMBIGUOUS', updatedAt };
  return { book, updatedAt, ...results[0] };
}

function movementProblems(rec, prior, diagnostic) {
  const current = americanToken(normalize(rec.price));
  const previous = americanToken(normalize(prior?.rec?.price));
  const text = normalize(rec.move).toUpperCase(), problems = [];
  const expected = prior ? priceMovement(normalize(prior.rec.price), normalize(rec.price)) : 'NEW SELECTION';
  diagnostic.priceMovement = expected;
  if (expected === 'NEW SELECTION') {
    if (!/NEW SELECTION|FIRST LOOK|PRICE COMPARISON UNAVAILABLE/.test(text)) problems.push('new moneyline must identify that no prior same-day price comparison is available');
  } else if (!(text.includes(expected) || expected === 'PRICE UNCHANGED' && text.includes('MOVEMENT UNCHANGED'))) {
    problems.push('movement text must report ' + expected);
  }
  for (const label of ['PRICE IMPROVED', 'PRICE WORSENED', 'PRICE UNCHANGED', 'MOVEMENT UNCHANGED']) {
    if (text.includes(label) && label !== expected && !(label === 'MOVEMENT UNCHANGED' && expected === 'PRICE UNCHANGED')) problems.push('movement text contradicts the verified price comparison: ' + label);
  }
  if (current !== null && !hasNumber(text, current)) problems.push('movement text must show the current odds');
  if (prior && previous !== null && !hasNumber(text, previous)) problems.push('movement text must show the prior odds');
  return problems;
}

export function auditMoneylineLineage({ root = process.cwd(), report, sidecar = null, feed = null, feedFile = null }) {
  ensure(timestampMs(report?.ts) !== null, 'Report ts is invalid');
  if (!moneylineApplies(report)) return { ok: true, enforced: false, diagnostics: [], violations: [] };
  const references = priorSelections(root, report, moneylineEventSide);
  const priorBySide = new Map(references.map(prior => [moneylineEventSide(prior.rec), prior]));
  const currentBySide = new Map(), diagnostics = [], violations = [];
  for (const [index, rec] of (report.recs || []).entries()) {
    if (keyOf(rec?.feed) !== 'ml' && rec?.coreAssessment?.context?.marketClass !== 'moneyline') continue;
    const key = moneylineEventSide(rec);
    if (!key) { violations.push('Recommendation ' + (index + 1) + ': invalid full-game moneyline event/market/side identity'); continue; }
    if (currentBySide.has(key)) violations.push(key + ': duplicate displayed moneyline side');
    currentBySide.set(key, rec);
  }
  if (!references.length && !currentBySide.size) return { ok: !violations.length, enforced: true, diagnostics, violations };
  feed ||= loadBoundFeed(root, report, sidecar, feedFile);
  ensure(feed?.generatedAt === report.feedGeneratedAt, 'Bound feed generatedAt does not match report feedGeneratedAt');
  ensure(ageMinutes(feed.generatedAt, report.ts) <= 75, 'Report feed is older than 75 minutes at issuance');
  const events = mergedFeedEvents(feed);
  for (const key of new Set([...priorBySide.keys(), ...currentBySide.keys()])) {
    const prior = priorBySide.get(key), current = currentBySide.get(key), rec = current || prior.rec;
    const event = events.get(String(rec.feed.eventId));
    const sport = rec?.coreAssessment?.context?.sport || majorSportKey(event);
    if (!SPORTS.has(sport)) { if (current) violations.push(key + ': unsupported or unresolved moneyline sport'); continue; }
    const start = timestampMs(event?.date || event?.identity?.startTime || rec.feed.eventDate);
    if (!current) {
      if (!ACTIVE.has(String(prior.rec.status).toUpperCase()) || start !== null && start <= timestampMs(report.ts)) continue;
      violations.push(key + ': tracked BET/LEAN/WAIT moneyline disappeared before event start');
      diagnostics.push({ eventId: String(rec.feed.eventId), side: rec.feed.side, sport, state: 'RECONCILIATION_REQUIRED', sourcePath: prior.sourcePath, sourceTs: prior.sourceTs });
      continue;
    }
    const diagnostic = { eventId: String(rec.feed.eventId), side: rec.feed.side, sport,
      sourcePath: prior?.sourcePath || null, sourceTs: prior?.sourceTs || null,
      priorSelectionKey: prior?.rec?.feed?.selectionKey || null, priorPrice: prior?.rec?.price || null,
      priorBook: prior?.rec?.book || null, priorStatus: prior?.rec?.status || null,
      priorFair: prior?.rec?.fair || null, priorPlayTo: prior?.rec?.playTo || null };
    const problems = decisionProblems(current);
    if (current.feed.selectionKey && !exactKey(current.feed.selectionKey, String(current.feed.eventId), current.feed.side)) problems.push('current selectionKey does not match the exact moneyline event/market/side');
    const books = BOOKS.map(book => newestMoneylineQuote(event, book, current.feed.side, feed.generatedAt));
    diagnostic.books = books;
    const usable = books.filter(book => book.state === 'OK');
    if (!usable.length) {
      diagnostic.state = !event ? 'EVENT_NOT_IN_FEED' : books.every(book => book.state === 'MISSING') ? 'MARKET_UNAVAILABLE' : 'PRICE_NOT_VERIFIED';
      const text = normalize(current.price).toUpperCase();
      if (!/PRICE NOT VERIFIED|MARKET UNAVAILABLE/.test(normalize(current.move).toUpperCase())) problems.push('movement text must identify the unavailable/unverified current quote');
      if (!/PRICE NOT VERIFIED|MARKET UNAVAILABLE/.test(text)) problems.push('no valid newest-entry moneyline quote exists; current price must be explicitly unavailable/unverified');
      if (diagnostic.state !== 'MARKET_UNAVAILABLE' && text.includes('MARKET UNAVAILABLE')) problems.push('stale, missing-side or unresolved newest entries require PRICE NOT VERIFIED');
      if (String(current.status).toUpperCase() === 'BET' || /[+-]\d{2,6}/.test(text)) problems.push('cannot issue a BET or display executable odds without a verified newest-entry quote');
    } else {
      const selectedBook = canonicalBook(current.book) || (String(current.book).toUpperCase() === 'DK' ? 'DraftKings' : null);
      const selected = usable.find(book => book.book === selectedBook);
      diagnostic.state = 'CURRENT_QUOTE_VERIFIED';
      if (!selected) problems.push('selected book has no fresh exact newest-entry moneyline quote; use a verified supported quote');
      else {
        if (current.feed.selectionKey !== selected.selectionKey) problems.push('current selectionKey must equal the selected book exact newest-entry moneyline key');
        if (americanToken(normalize(current.price)) !== Number(selected.priceAmerican)) problems.push('current price does not match the selected book exact newest-entry quote');
        Object.assign(diagnostic, { currentSelectionKey: selected.selectionKey, currentBook: selected.book, currentPrice: selected.priceAmerican });
        problems.push(...movementProblems({ ...current, price: selected.priceAmerican }, prior, diagnostic));
      }
      if (/PRICE NOT VERIFIED|MARKET UNAVAILABLE/.test(normalize(current.price).toUpperCase())) problems.push('a fresh supported moneyline exists and must not be represented as unavailable');
    }
    diagnostics.push(diagnostic);
    violations.push(...problems.map(problem => key + ': ' + problem));
  }
  return { ok: !violations.length, enforced: true, diagnostics, violations };
}

function main() {
  const [command, ...tokens] = process.argv.slice(2), args = {};
  ensure(command === 'audit', 'Usage: moneyline-lineage.mjs audit --report FILE [--sidecar FILE] [--feed FILE] [--root DIR]');
  for (let i = 0; i < tokens.length; i += 2) {
    ensure(tokens[i].startsWith('--') && tokens[i + 1], 'Invalid command argument');
    args[tokens[i].slice(2)] = tokens[i + 1];
  }
  ensure(args.report, 'audit requires --report FILE');
  const read = file => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const result = auditMoneylineLineage({ root: path.resolve(args.root || process.cwd()), report: read(args.report), sidecar: args.sidecar ? read(args.sidecar) : null, feedFile: args.feed || null });
  for (const item of result.diagnostics) console.log('MONEYLINE LINEAGE ' + JSON.stringify(item));
  ensure(result.ok, result.violations.join('; '));
  console.log('MONEYLINE LINEAGE AUDIT OK ' + result.diagnostics.length + ' selection(s)' + (result.enforced ? '' : ' — pre-cutover'));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error('MONEYLINE LINEAGE ERROR: ' + error.message); process.exit(1); }
}
