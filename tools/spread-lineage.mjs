#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import quoteObservation from '../assets/quote-observation.js';
import { latestMarket } from './major-sport-market-coverage-gate.mjs';
import { lineageApplies, auditPrimaryLineage } from './primary-lineage.mjs';

const BOOKS = ['Bet365', 'DraftKings'];
const FEED_MAX_AGE_MINUTES = 75;
const QUOTE_MAX_AGE_MINUTES = 30;
const PRIMARY_SCORE_EPSILON = 1e-8;

function die(message) { throw new Error(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function parseMs(value) { const ms = Date.parse(value || ''); return Number.isFinite(ms) ? ms : null; }
function marketKey(market) { return String(market?.marketKey || market?.identity?.marketKey || '').toLowerCase(); }
function isSpreadRec(rec) { return String(rec?.feed?.marketKey || rec?.feed?.market || '').toLowerCase() === 'spread' && rec?.feed?.eventId && rec?.feed?.side && Number.isFinite(Number(rec?.feed?.hdp)); }
function lineFromRaw(raw, side) { const n = Number(raw); if (!Number.isFinite(n)) return null; const line = String(side).toLowerCase() === 'away' ? -n : n; return Object.is(line, -0) ? 0 : line; }
function lineText(value) { const n = Number(value); if (!Number.isFinite(n)) return '—'; return n > 0 ? `+${n}` : String(n); }
function decimalOdds(value) { const n = Number(value); return Number.isFinite(n) && n > 1 ? n : null; }
function americanOdds(value) { const d = decimalOdds(value); if (!d) return null; const n = d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)); return n > 0 ? `+${n}` : String(n); }
function implied(value) { const d = decimalOdds(value); return d ? 1 / d : null; }
function ageMinutes(older, newer) { const a = parseMs(older), b = parseMs(newer); if (a === null || b === null) return Infinity; return Math.max(0, (b - a) / 60000); }
function feedFresh(feedGeneratedAt, reportTs) { return ageMinutes(feedGeneratedAt, reportTs) <= FEED_MAX_AGE_MINUTES; }
function quoteFresh(market, feed) { return (quoteObservation.requiresObservation(feed) ? quoteObservation.quoteAgeMinutes(market, feed) : ageMinutes(market?.updatedAt, feed?.generatedAt || feed)) <= QUOTE_MAX_AGE_MINUTES; }
function recKey(rec) { return `${rec.feed.eventId}|${String(rec.feed.side).toLowerCase()}`; }
function combinedText(rec) { return [rec?.title, rec?.move, rec?.analysis, rec?.price, rec?.source].filter(Boolean).join(' // ').toUpperCase(); }
function unavailableText(text) { return /(MARKET UNAVAILABLE|PRICE NOT VERIFIED|FEED STALE|IDENTITY MISMATCH)/.test(text); }
function explicitPrimaryRow(row) { return row?.primary === true || row?.isPrimary === true || row?.main === true || row?.isMain === true || row?.mainLine === true || row?.isMainLine === true; }

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) die(`Unexpected argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) { args[key] = next; i += 1; }
    else args[key] = true;
  }
  return args;
}

function feedFromGit(root, sha) {
  if (!/^[0-9a-f]{40}$/i.test(String(sha || ''))) return null;
  try {
    const raw = execFileSync('git', ['cat-file', 'blob', sha], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(raw);
  } catch { return null; }
}

function loadFeed(root, report, sidecar, feedFile) {
  if (feedFile) return readJson(path.resolve(feedFile));
  const sha = sidecar?.provenance?.feedBlobSha;
  const fromGit = feedFromGit(root, sha);
  if (fromGit) return fromGit;
  const livePath = path.join(root, 'data/live-odds.json');
  if (!fs.existsSync(livePath)) die('Cannot resolve report odds snapshot: data/live-odds.json is missing');
  const live = readJson(livePath);
  if (String(live?.generatedAt || '') !== String(report?.feedGeneratedAt || '')) {
    die(`Cannot resolve exact report odds snapshot: live feed ${live?.generatedAt || 'unknown'} != report ${report?.feedGeneratedAt || 'unknown'}`);
  }
  return live;
}

function allEvents(feed) {
  if (quoteObservation.requiresObservation(feed)) return new Map(quoteObservation.mergeObservedEvents(feed).map(event => [String(event?.eventId || event?.identity?.eventId || event?.id || ''), event]));
  const map = new Map();
  for (const event of [...(feed?.events || []), ...(feed?.deepMarkets || []), ...(feed?.baseballProps || [])]) {
    const id = String(event?.eventId || event?.identity?.eventId || event?.id || '');
    if (!id) continue;
    if (!map.has(id)) { map.set(id, event); continue; }
    const prior = map.get(id);
    const merged = { ...prior, ...event, bookmakers: { ...(prior?.bookmakers || {}) } };
    for (const [book, markets] of Object.entries(event?.bookmakers || {})) {
      const old = Array.isArray(merged.bookmakers[book]) ? merged.bookmakers[book] : [];
      const add = Array.isArray(markets) ? markets : [];
      const byKey = new Map();
      for (const market of [...old, ...add]) byKey.set(`${marketKey(market)}|${market?.updatedAt || ''}`, market);
      merged.bookmakers[book] = [...byKey.values()];
    }
    map.set(id, merged);
  }
  return map;
}

function latestCanonicalSpreadMarket(event, book, feed) {
  if (quoteObservation.requiresObservation(feed)) return latestMarket(event, book, 'spread', feed);
  const markets = event?.bookmakers?.[book];
  if (!Array.isArray(markets)) return null;
  return markets
    .filter((item) => marketKey(item) === 'spread')
    .sort((a, b) => (parseMs(b?.updatedAt) ?? -Infinity) - (parseMs(a?.updatedAt) ?? -Infinity))[0] || null;
}

function primarySpread(event, book, side, feedGeneratedAt) {
  const market = latestCanonicalSpreadMarket(event, book, feedGeneratedAt);
  if (!market) return { state: 'MISSING', book };
  if (!quoteFresh(market, feedGeneratedAt)) return { state: 'STALE', book, updatedAt: market.updatedAt || null };

  if (quoteObservation.requiresObservation(feedGeneratedAt) && (quoteObservation.isSuspended(event) || quoteObservation.isSuspended(market))) return { state: 'SUSPENDED', book };
  const rows = (market.odds || []).map((row) => {
    if (quoteObservation.requiresObservation(feedGeneratedAt) && quoteObservation.isSuspended(row)) return null;
    const home = decimalOdds(row?.home), away = decimalOdds(row?.away), raw = Number(row?.hdp);
    if (!home || !away || !Number.isFinite(raw)) return null;
    const ph = implied(home), pa = implied(away);
    return { row, raw, home, away, balance: Math.abs(ph - pa) };
  }).filter(Boolean);
  if (!rows.length) return { state: 'MISSING', book, updatedAt: market.updatedAt || null };

  const marked = rows.filter((item) => explicitPrimaryRow(item.row));
  let candidates;
  let method;
  if (marked.length) {
    candidates = marked;
    method = 'PROVIDER_PRIMARY';
  } else {
    const minBalance = Math.min(...rows.map((item) => item.balance));
    candidates = rows.filter((item) => Math.abs(item.balance - minBalance) <= PRIMARY_SCORE_EPSILON);
    method = 'MARKET_CENTER';
  }

  const distinctLines = [...new Set(candidates.map((item) => item.raw))];
  if (distinctLines.length !== 1) {
    return {
      state: 'AMBIGUOUS',
      book,
      method,
      updatedAt: market.updatedAt || null,
      candidateRawHdps: distinctLines.sort((a, b) => a - b)
    };
  }

  const raw = distinctLines[0];
  const sameLine = candidates.filter((item) => Math.abs(item.raw - raw) <= 0.001);
  const picked = sameLine.sort((a, b) => (decimalOdds(b.row?.[side]) || 0) - (decimalOdds(a.row?.[side]) || 0))[0];
  const dec = decimalOdds(picked?.row?.[side]);
  if (!dec) return { state: 'MISSING', book, updatedAt: market.updatedAt || null };

  return {
    state: 'OK',
    book,
    method,
    rawHdp: raw,
    displayLine: lineFromRaw(raw, side),
    priceAmerican: americanOdds(dec),
    updatedAt: market.updatedAt
  };
}

function exactFreshQuotes(event, priorRec, feedGeneratedAt) {
  const out = [];
  const side = String(priorRec.feed.side).toLowerCase();
  const selectionKey = String(priorRec.feed.selectionKey || '');
  const rawHdp = Number(priorRec.feed.hdp);
  for (const book of BOOKS) {
    const market = latestCanonicalSpreadMarket(event, book, feedGeneratedAt);
    if (!market || !quoteFresh(market, feedGeneratedAt)) continue;
    if (quoteObservation.requiresObservation(feedGeneratedAt) && (quoteObservation.isSuspended(event) || quoteObservation.isSuspended(market))) continue;
    for (const row of market.odds || []) {
      if (quoteObservation.requiresObservation(feedGeneratedAt) && quoteObservation.isSuspended(row)) continue;
      const raw = Number(row?.hdp);
      if (!Number.isFinite(raw) || Math.abs(raw - rawHdp) > 0.001) continue;
      const keys = row?.selectionKeys || row?.identity?.selectionKeys || {};
      if (selectionKey && String(keys?.[side] || '') !== selectionKey) continue;
      const dec = decimalOdds(row?.[side]);
      if (!dec) continue;
      out.push({ book, rawHdp: raw, displayLine: lineFromRaw(raw, side), priceAmerican: americanOdds(dec), updatedAt: market.updatedAt });
    }
  }
  return out;
}

function priorTrackedSpreads(root, report) {
  const indexPath = path.join(root, 'run-history.json');
  if (!fs.existsSync(indexPath)) return [];
  const index = readJson(indexPath);
  const day = String(report.ts).slice(0, 10);
  const currentMs = parseMs(report.ts);
  const entries = (index?.runs || []).filter((entry) => entry?.date === day && parseMs(entry.ts) < currentMs).sort((a, b) => parseMs(a.ts) - parseMs(b.ts));
  const latest = new Map();
  for (const entry of entries) {
    const file = path.join(root, entry.path || '');
    if (!fs.existsSync(file)) continue;
    const issued = readJson(file);
    for (const rec of issued?.recs || []) {
      if (!isSpreadRec(rec)) continue;
      latest.set(recKey(rec), { rec, sourceTs: issued.ts, sourcePath: entry.path });
    }
  }
  return [...latest.values()];
}

function movementLabel(oldLine, newLine) {
  if (newLine > oldLine + 0.001) return 'LINE MOVED IN FAVOR';
  if (newLine < oldLine - 0.001) return 'LINE MOVED AGAINST';
  return 'PRICE MOVED';
}

function auditLineage({ root, report, sidecar = null, feed = null }) {
  const reportMs = parseMs(report?.ts);
  if (reportMs === null) die('Report ts is invalid');
  if (!feed) feed = loadFeed(root, report, sidecar, null);
  if (String(feed?.generatedAt || '') !== String(report?.feedGeneratedAt || '')) {
    die(`Resolved feed generatedAt ${feed?.generatedAt || 'unknown'} does not match report feedGeneratedAt ${report?.feedGeneratedAt || 'unknown'}`);
  }
  if (!feedFresh(feed.generatedAt, report.ts)) die(`Report feed is older than ${FEED_MAX_AGE_MINUTES} minutes at issuance`);

  const events = allEvents(feed);
  const currentSpreads = new Map();
  for (const rec of report?.recs || []) if (isSpreadRec(rec)) currentSpreads.set(recKey(rec), rec);

  const diagnostics = [];
  const violations = [];
  for (const tracked of priorTrackedSpreads(root, report)) {
    const prior = tracked.rec;
    const commenceMs = parseMs(prior?.feed?.eventDate);
    if (commenceMs !== null && commenceMs <= reportMs) continue;
    const oldLine = lineFromRaw(prior.feed.hdp, prior.feed.side);
    const currentRec = currentSpreads.get(recKey(prior));
    const event = events.get(String(prior.feed.eventId));
    if (!event) {
      diagnostics.push({ eventId: String(prior.feed.eventId), side: prior.feed.side, priorLine: oldLine, priorLineText: lineText(oldLine), sourceTs: tracked.sourceTs, sourcePath: tracked.sourcePath, state: 'EVENT_NOT_IN_FEED', primary: [] });
      if (!currentRec) {
        violations.push(`${prior.title}: tracked ${lineText(oldLine)} event is absent from the feed but still pregame; preserve the card and mark it unavailable/unverified`);
      } else if (!unavailableText(combinedText(currentRec))) {
        violations.push(`${prior.title}: event is absent from the feed; draft must state unavailable/unverified`);
      }
      continue;
    }

    const exact = exactFreshQuotes(event, prior, feed);
    if (exact.length) continue;

    const primaryResults = BOOKS.map((book) => primarySpread(event, book, String(prior.feed.side).toLowerCase(), feed));
    const primaries = primaryResults.filter((item) => item.state === 'OK');
    const ambiguous = primaryResults.filter((item) => item.state === 'AMBIGUOUS');
    const diagnostic = {
      eventId: String(prior.feed.eventId),
      side: String(prior.feed.side).toLowerCase(),
      priorLine: oldLine,
      priorLineText: lineText(oldLine),
      sourceTs: tracked.sourceTs,
      sourcePath: tracked.sourcePath,
      primary: primaries,
      primaryStates: primaryResults
    };

    if (!currentRec) {
      diagnostic.state = ambiguous.length ? 'PRIMARY_AMBIGUOUS' : primaries.length ? 'RECONCILIATION_REQUIRED' : 'UNAVAILABLE_RECONCILIATION_REQUIRED';
      diagnostics.push(diagnostic);
      violations.push(`${prior.title}: tracked ${lineText(oldLine)} spread disappeared from the draft; preserve the same event/side and reconcile it before publication`);
      continue;
    }

    const text = combinedText(currentRec);
    if (ambiguous.length) {
      diagnostic.state = 'PRIMARY_AMBIGUOUS';
      diagnostics.push(diagnostic);
      if (!/(PRICE NOT VERIFIED|CONFLICTING SIGNALS)/.test(text)) {
        violations.push(`${prior.title}: current primary spread is ambiguous at ${ambiguous.map((x) => x.book).join(', ')}; draft must fail closed as PRICE NOT VERIFIED or CONFLICTING SIGNALS`);
      }
      continue;
    }

    if (!primaries.length) {
      diagnostic.state = 'NO_FRESH_PRIMARY';
      diagnostics.push(diagnostic);
      if (!unavailableText(text)) {
        violations.push(`${prior.title}: exact ${lineText(oldLine)} is not fresh and no fresh primary spread exists; draft must state unavailable/unverified`);
      }
      continue;
    }

    const uniqueLines = [...new Set(primaries.map((item) => item.displayLine))];
    if (uniqueLines.length > 1) {
      diagnostic.state = 'BOOK_CONFLICT';
      diagnostics.push(diagnostic);
      if (!/(CONFLICTING SIGNALS|PRICE NOT VERIFIED)/.test(text)) {
        violations.push(`${prior.title}: Bet365/DraftKings primary spreads disagree (${primaries.map((x) => `${x.book} ${lineText(x.displayLine)}`).join(', ')}); draft must preserve the conflict`);
      }
      continue;
    }

    const newLine = uniqueLines[0];
    const expected = movementLabel(oldLine, newLine);
    diagnostic.state = expected;
    diagnostic.currentLine = newLine;
    diagnostic.currentLineText = lineText(newLine);
    diagnostics.push(diagnostic);
    if (!text.includes(expected)) {
      violations.push(`${prior.title}: expected ${expected} ${lineText(oldLine)} -> ${lineText(newLine)} in draft movement text`);
    }
    if (expected !== 'PRICE MOVED' && (!text.includes(lineText(oldLine).toUpperCase()) || !text.includes(lineText(newLine).toUpperCase()))) {
      violations.push(`${prior.title}: movement text must show archived ${lineText(oldLine)} and current ${lineText(newLine)}`);
    }
  }

  return { ok: violations.length === 0, diagnostics, violations };
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'betting-edge-spread-lineage-'));
  writeJson(path.join(root, 'run-history.json'), {
    runs: [{ date: '2026-08-19', ts: '2026-08-19T08:00:00-07:00', slot: 'main', path: 'data/history/runs/2026-08-19/main-080000.json' }]
  });
  writeJson(path.join(root, 'data/history/runs/2026-08-19/main-080000.json'), {
    slot: 'main', ts: '2026-08-19T08:00:00-07:00', feedGeneratedAt: '2026-08-19T14:55:00Z', recs: [{
      status: 'WAIT', title: 'Toronto Tempo +11.5', feed: { eventId: '68096572', marketKey: 'spread', market: 'Spread', side: 'away', hdp: -11.5, selectionKey: '68096572|spread|away||-11.5', eventDate: '2026-08-19T23:30:00Z' }
    }]
  });
  return root;
}

function spreadRow(raw, home, away, extra = {}) {
  return {
    hdp: raw,
    home: String(home),
    away: String(away),
    selectionKeys: { home: `68096572|spread|home||${raw}`, away: `68096572|spread|away||${raw}` },
    ...extra
  };
}

function spreadFeed(rows, { updatedAt = '2026-08-19T16:14:00Z', generatedAt = '2026-08-19T16:15:00Z', draftKings = null, extraMarkets = [] } = {}) {
  const bookmakers = { Bet365: [{ name: 'Spread', marketKey: 'spread', updatedAt, odds: rows }, ...extraMarkets] };
  if (draftKings) bookmakers.DraftKings = draftKings;
  return { generatedAt, events: [{ id: 68096572, home: 'Washington Mystics', away: 'Toronto Tempo', bookmakers }] };
}

function movedRec(raw, titleLine, move) {
  return {
    status: 'WAIT', title: `Toronto Tempo ${titleLine}`, move, stake: '$0',
    feed: { eventId: '68096572', marketKey: 'spread', market: 'Spread', side: 'away', hdp: raw, selectionKey: `68096572|spread|away||${raw}`, eventDate: '2026-08-19T23:30:00Z' }
  };
}

function selfTest() {
  const root = fixtureRoot();
  try {
    assert.equal(lineFromRaw(-11.5, 'home'), -11.5);
    assert.equal(lineFromRaw(-11.5, 'away'), 11.5);

    const feed = spreadFeed([
      spreadRow(-10.5, 1.80, 1.95),
      spreadRow(-11, 1.91, 1.91)
    ]);
    const base = { slot: 'final_morning', label: '09:30 FINAL MORNING', ts: '2026-08-19T09:16:00-07:00', feedGeneratedAt: feed.generatedAt, recs: [] };

    const missing = auditLineage({ root, report: base, feed });
    assert.equal(missing.ok, false);
    assert.match(missing.violations.join(' '), /preserve the same event\/side/i);

    const corrected = structuredClone(base);
    corrected.recs = [movedRec(-11, '+11', 'LINE MOVED AGAINST — Toronto +11.5 -> +11; current line requires independent requalification')];
    const passed = auditLineage({ root, report: corrected, feed });
    assert.equal(passed.ok, true, passed.violations.join('; '));
    assert.equal(passed.diagnostics[0].state, 'LINE MOVED AGAINST');
    assert.equal(passed.diagnostics[0].currentLine, 11);
    assert.equal(passed.diagnostics[0].primary[0].method, 'MARKET_CENTER');

    const favorableFeed = spreadFeed([
      spreadRow(-11, 1.78, 2.00),
      spreadRow(-12, 1.91, 1.91)
    ]);
    const favorableDraft = { ...base, feedGeneratedAt: favorableFeed.generatedAt, recs: [movedRec(-12, '+12', 'LINE MOVED IN FAVOR — Toronto +11.5 -> +12; current line requires independent requalification')] };
    const favorable = auditLineage({ root, report: favorableDraft, feed: favorableFeed });
    assert.equal(favorable.ok, true, favorable.violations.join('; '));
    assert.equal(favorable.diagnostics[0].state, 'LINE MOVED IN FAVOR');
    assert.equal(favorable.diagnostics[0].currentLine, 12);

    const conflictFeed = structuredClone(feed);
    conflictFeed.events[0].bookmakers.DraftKings = [{ name: 'Spread', marketKey: 'spread', updatedAt: '2026-08-19T16:14:30Z', odds: [spreadRow(-10.5, 1.91, 1.91)] }];
    const conflictDraft = structuredClone(base);
    conflictDraft.recs = [movedRec(-11, '+11', 'CONFLICTING SIGNALS — Bet365 +11 / DraftKings +10.5')];
    const conflict = auditLineage({ root, report: conflictDraft, feed: conflictFeed });
    assert.equal(conflict.ok, true, conflict.violations.join('; '));
    assert.equal(conflict.diagnostics[0].state, 'BOOK_CONFLICT');

    const freshnessFeed = spreadFeed([
      spreadRow(-11, 1.91, 1.91),
      spreadRow(-11.5, 2.05, 1.74)
    ], { updatedAt: '2026-08-19T15:50:00Z' });
    const laterReport = { ...base, ts: '2026-08-19T09:31:00-07:00', feedGeneratedAt: freshnessFeed.generatedAt, recs: [] };
    assert.equal(ageMinutes('2026-08-19T15:50:00Z', laterReport.ts), 41);
    assert.equal(ageMinutes('2026-08-19T15:50:00Z', freshnessFeed.generatedAt), 25);
    const exactStillFresh = auditLineage({ root, report: laterReport, feed: freshnessFeed });
    assert.equal(exactStillFresh.ok, true, exactStillFresh.violations.join('; '));
    assert.equal(exactStillFresh.diagnostics.length, 0, 'quote freshness must be measured at feed time, not report time');

    const staleFeed = spreadFeed([spreadRow(-11, 1.91, 1.91)], { updatedAt: '2026-08-19T15:44:00Z' });
    const staleDraft = { ...base, feedGeneratedAt: staleFeed.generatedAt, recs: [movedRec(-11, '+11', 'PRICE NOT VERIFIED — no fresh current primary spread')] };
    const stale = auditLineage({ root, report: staleDraft, feed: staleFeed });
    assert.equal(stale.ok, true, stale.violations.join('; '));
    assert.equal(stale.diagnostics[0].state, 'NO_FRESH_PRIMARY');

    const ambiguousFeed = spreadFeed([
      spreadRow(-11, 1.91, 1.91),
      spreadRow(-12, 1.91, 1.91)
    ]);
    const ambiguousDraft = { ...base, feedGeneratedAt: ambiguousFeed.generatedAt, recs: [movedRec(-11, '+11', 'PRICE NOT VERIFIED — current primary spread is ambiguous')] };
    const ambiguous = auditLineage({ root, report: ambiguousDraft, feed: ambiguousFeed });
    assert.equal(ambiguous.ok, true, ambiguous.violations.join('; '));
    assert.equal(ambiguous.diagnostics[0].state, 'PRIMARY_AMBIGUOUS');

    const providerMarkedFeed = spreadFeed([
      spreadRow(-11, 1.91, 1.91),
      spreadRow(-12, 1.80, 2.00, { isMain: true })
    ]);
    const providerMarkedDraft = { ...base, feedGeneratedAt: providerMarkedFeed.generatedAt, recs: [movedRec(-12, '+12', 'LINE MOVED IN FAVOR — Toronto +11.5 -> +12; provider primary row')] };
    const providerMarked = auditLineage({ root, report: providerMarkedDraft, feed: providerMarkedFeed });
    assert.equal(providerMarked.ok, true, providerMarked.violations.join('; '));
    assert.equal(providerMarked.diagnostics[0].primary[0].method, 'PROVIDER_PRIMARY');
    assert.equal(providerMarked.diagnostics[0].currentLine, 12);

    const duplicateFeed = spreadFeed([
      spreadRow(-10.5, 1.91, 1.91)
    ], { updatedAt: '2026-08-19T16:00:00Z' });
    duplicateFeed.events[0].bookmakers.Bet365.push({ name: 'Spread', marketKey: 'spread', updatedAt: '2026-08-19T16:14:00Z', odds: [spreadRow(-11, 1.91, 1.91)] });
    duplicateFeed.events[0].bookmakers.Bet365.push({ name: 'Alternative Spread', marketKey: 'alternative-spread', updatedAt: '2026-08-19T16:14:30Z', odds: [spreadRow(-12, 1.91, 1.91)] });
    const duplicateDraft = { ...base, feedGeneratedAt: duplicateFeed.generatedAt, recs: [movedRec(-11, '+11', 'LINE MOVED AGAINST — Toronto +11.5 -> +11; newest canonical spread only')] };
    const duplicate = auditLineage({ root, report: duplicateDraft, feed: duplicateFeed });
    assert.equal(duplicate.ok, true, duplicate.violations.join('; '));
    assert.equal(duplicate.diagnostics[0].currentLine, 11);

    const noMarketFeed = { generatedAt: feed.generatedAt, events: [{ id: 68096572, home: 'Washington Mystics', away: 'Toronto Tempo', bookmakers: {} }] };
    const unavailableDraft = { ...base, feedGeneratedAt: noMarketFeed.generatedAt, recs: [movedRec(-11, '+11', 'MARKET UNAVAILABLE — no fresh canonical spread returned')] };
    const unavailable = auditLineage({ root, report: unavailableDraft, feed: noMarketFeed });
    assert.equal(unavailable.ok, true, unavailable.violations.join('; '));
    assert.equal(unavailable.diagnostics[0].state, 'NO_FRESH_PRIMARY');

    const eventMissingFeed = { generatedAt: feed.generatedAt, events: [] };
    const eventMissingDraft = { ...base, feedGeneratedAt: eventMissingFeed.generatedAt, recs: [movedRec(-11.5, '+11.5', 'PRICE NOT VERIFIED — tracked event not returned in exact report snapshot')] };
    const eventMissing = auditLineage({ root, report: eventMissingDraft, feed: eventMissingFeed });
    assert.equal(eventMissing.ok, true, eventMissing.violations.join('; '));
    assert.equal(eventMissing.diagnostics[0].state, 'EVENT_NOT_IN_FEED');

    console.log('SPREAD LINEAGE SELF-TEST OK');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'self-test') { selfTest(); return; }
  if (args.command !== 'audit') die('Usage: spread-lineage.mjs audit --report FILE [--sidecar FILE] [--feed FILE] [--root DIR] | self-test');
  if (!args.report) die('audit requires --report FILE');
  const root = path.resolve(args.root || process.cwd());
  const report = readJson(path.resolve(args.report));
  const sidecar = args.sidecar ? readJson(path.resolve(args.sidecar)) : null;
  const feed = args.feed ? readJson(path.resolve(args.feed)) : loadFeed(root, report, sidecar, null);
  const modern = lineageApplies(report, 'spread');
  const result = modern ? auditPrimaryLineage({ root, report, sidecar, feed }, 'spread') : auditLineage({ root, report, sidecar, feed });
  for (const item of result.diagnostics) {
    if (modern) { console.log('SPREAD LINEAGE ' + JSON.stringify(item)); continue; }
    const primary = (item.primary || []).map((x) => `${x.book} ${lineText(x.displayLine)} ${x.priceAmerican || ''}`).join(' / ');
    console.log(`SPREAD LINEAGE ${item.eventId} ${item.side} ${item.priorLineText || ''} // ${item.state}${primary ? ` // ${primary}` : ''}`);
  }
  if (!result.ok) {
    for (const problem of result.violations) console.error(`SPREAD LINEAGE ERROR: ${problem}`);
    process.exit(1);
  }
  console.log(`SPREAD LINEAGE AUDIT OK ${result.diagnostics.length} reconciliation(s)`);
}

try { main(); }
catch (error) { console.error(`SPREAD LINEAGE ERROR: ${error.message}`); process.exit(1); }
