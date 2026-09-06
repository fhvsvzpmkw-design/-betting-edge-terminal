#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import QuoteObservation from '../assets/quote-observation.js';

const ROOT = process.cwd();
const OBS_ROOT = path.join(ROOT, 'data/history/observations');
const ODDS_INDEX = path.join(ROOT, 'data/history/odds-index.json');
const OUTPUT = path.join(ROOT, 'data/history/results-index.json');
const GRADE_KEYS = ['WIN', 'LOSS', 'PUSH', 'VOID', 'HALF_WIN', 'HALF_LOSS'];

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}
function repoPath(file) { return path.relative(ROOT, file).split(path.sep).join('/'); }
function walkJson(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJson(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out.sort();
}
function cleanText(v) { return String(v ?? '').trim(); }
function normBook(v) { return cleanText(v).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function parseTime(v) { const n = Date.parse(v || ''); return Number.isFinite(n) ? n : null; }
function americanFromDecimal(d) {
  d = Number(d);
  if (!Number.isFinite(d) || d <= 1) return null;
  return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
}
function selectedLine(rec) {
  const raw = Number(rec?.feed?.hdp ?? rec?.feed?.line);
  if (!Number.isFinite(raw)) return null;
  const market = cleanText(rec?.feed?.marketKey || rec?.feed?.market).toLowerCase();
  const side = cleanText(rec?.feed?.side).toLowerCase();
  if (market === 'spread') return side === 'away' ? -raw : side === 'home' ? raw : null;
  return raw;
}
function marketFamily(rec) {
  const m = cleanText(rec?.feed?.marketKey || rec?.feed?.market).toLowerCase();
  if (m === 'ml' || m === 'moneyline') return 'Moneyline';
  if (m === 'spread') return 'Spread';
  if (m.includes('total')) return 'Totals';
  if (m.includes('player-prop') || m.includes('player prop')) return 'Player props';
  return m || 'Other';
}
function sportFamily(rec) {
  const meta = cleanText(rec?.meta).toUpperCase();
  const s = cleanText(rec?.feed?.sportKey).toLowerCase();
  if (meta.includes('MLB')) return 'MLB';
  if (meta.includes('NFL')) return 'NFL preseason';
  if (meta.includes('WNBA') || s === 'basketball') return 'Basketball/WNBA';
  if (s === 'american-football') return 'NFL preseason';
  if (s === 'football' || s === 'soccer') return 'Soccer';
  if (s === 'hockey') return 'Hockey';
  if (s === 'baseball') return 'Other baseball';
  return s || 'Other';
}
function gradeBucket() { return Object.fromEntries(GRADE_KEYS.map(k => [k, 0])); }
function addGrade(bucket, grade) {
  const g = cleanText(grade).toUpperCase();
  if (g in bucket) bucket[g] += 1;
}
function settledUnits(grade, decimal) {
  const d = Number(decimal);
  if (!Number.isFinite(d) || d <= 1) return null;
  switch (cleanText(grade).toUpperCase()) {
    case 'WIN': return d - 1;
    case 'LOSS': return -1;
    case 'PUSH':
    case 'VOID': return 0;
    case 'HALF_WIN': return (d - 1) / 2;
    case 'HALF_LOSS': return -0.5;
    default: return null;
  }
}
function bookNames(text) {
  const s = cleanText(text).toLowerCase();
  const names = [];
  if (s.includes('bet365')) names.push('bet365');
  if (s.includes('draftkings')) names.push('draftkings');
  return names;
}

const oddsIndex = readJson(ODDS_INDEX) || { entries: [] };
const oddsByGenerated = new Map((oddsIndex.entries || []).filter(x => x?.generatedAt).map(x => [x.generatedAt, x]));
const blobCache = new Map();
function snapshotBlob(blobSha) {
  if (!blobSha) return null;
  if (blobCache.has(blobSha)) return blobCache.get(blobSha);
  try {
    const raw = execFileSync('git', ['cat-file', 'blob', blobSha], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    });
    const parsed = JSON.parse(raw);
    blobCache.set(blobSha, parsed);
    return parsed;
  } catch {
    blobCache.set(blobSha, null);
    return null;
  }
}
function exactAnalysisPrice(run, rec, obsRec) {
  const issued = obsRec?.issued || {};
  if (issued.analysisPriceState === 'exact' && Number.isFinite(Number(issued.analysisPriceDecimal))) {
    return {
      state: 'exact',
      decimal: Number(issued.analysisPriceDecimal),
      american: Number(issued.analysisPriceAmerican),
      book: issued.analysisBook || null,
      bookKey: issued.analysisBookKey || null,
      quoteUpdatedAt: issued.analysisQuoteUpdatedAt || null,
      ...(issued.analysisQuoteObservedAt !== undefined ? { quoteObservedAt: issued.analysisQuoteObservedAt } : {}),
      snapshotBlobSha: issued.analysisSnapshotBlobSha || null,
      source: 'sidecar-normalized'
    };
  }

  const entry = oddsByGenerated.get(run?.feedGeneratedAt);
  if (!entry) return { state: 'unavailable', reason: 'issued_snapshot_not_indexed' };
  const snapshot = snapshotBlob(entry.snapshotBlobSha);
  if (!snapshot) return { state: 'unavailable', reason: 'issued_snapshot_blob_unavailable' };

  const eventId = String(rec?.feed?.eventId || '');
  const selectionKey = rec?.feed?.selectionKey;
  const observed = QuoteObservation.requiresObservation(snapshot);
  const events = observed ? QuoteObservation.mergeObservedEvents(snapshot) : (snapshot.events || []);
  const event = events.find(x => String(observed ? (x?.eventId || x?.identity?.eventId || x?.id) : x?.id) === eventId);
  if (!event || !selectionKey) return { state: 'unavailable', reason: 'issued_identity_missing' };
  if (observed && QuoteObservation.isSuspended(event)) return { state: 'unavailable', reason: 'no_fresh_exact_issued_quote' };

  const allowed = new Set(bookNames(rec?.book));
  if (!allowed.size) return { state: 'unavailable', reason: 'issued_book_not_resolved' };
  const feedMs = parseTime(run.feedGeneratedAt);
  const candidates = [];

  for (const [bookName, markets] of Object.entries(event.bookmakers || {})) {
    const bookKey = normBook(bookName);
    if (!allowed.has(bookKey)) continue;
    let currentMarkets = markets || [];
    if (observed) {
      // Resolve the current canonical market before looking for a selection.
      // A removed side or malformed latest observation must not revive an older price.
      const wantedMarket = cleanText(rec?.feed?.marketKey || selectionKey.split('|')[1]).toLowerCase();
      const matches = currentMarkets.filter(market => cleanText(market?.marketKey || market?.identity?.marketKey).toLowerCase() === wantedMarket)
        .sort((a, b) => QuoteObservation.compareMarketRecency(a, b, snapshot));
      const latest = matches[0];
      const tied = latest && matches.filter(market => QuoteObservation.compareMarketRecency(latest, market, snapshot) === 0);
      currentMarkets = latest && new Set(tied.map(market => JSON.stringify(market))).size === 1 ? [latest] : [];
    }
    for (const market of currentMarkets) {
      if (observed) {
        if (!QuoteObservation.quoteIsFresh(market, snapshot, 30)) continue;
      } else {
        const quoteMs = parseTime(market?.updatedAt);
        const age = feedMs !== null && quoteMs !== null ? (feedMs - quoteMs) / 60000 : null;
        if (age === null || age < 0 || age > 30) continue;
      }
      for (const row of market?.odds || []) {
        if (observed && QuoteObservation.isSuspended(row)) continue;
        const keys = row?.selectionKeys || row?.identity?.selectionKeys || {};
        for (const [field, key] of Object.entries(keys)) {
          if (key !== selectionKey) continue;
          const decimal = Number(row?.[field]);
          if (Number.isFinite(decimal) && decimal > 1) {
            candidates.push({ decimal, book: bookName, bookKey, quoteUpdatedAt: market.updatedAt || null,
              ...(observed ? { quoteObservedAt: market.observedAt } : {}) });
          }
        }
      }
    }
  }

  if (!candidates.length) return { state: 'unavailable', reason: 'no_fresh_exact_issued_quote' };
  candidates.sort((a, b) => b.decimal - a.decimal || a.bookKey.localeCompare(b.bookKey));
  const best = candidates[0];
  return {
    state: 'exact',
    decimal: best.decimal,
    american: americanFromDecimal(best.decimal),
    book: best.book,
    bookKey: best.bookKey,
    quoteUpdatedAt: best.quoteUpdatedAt,
    ...(observed ? { quoteObservedAt: best.quoteObservedAt } : {}),
    snapshotBlobSha: entry.snapshotBlobSha,
    source: 'immutable-issued-snapshot'
  };
}

const runCache = new Map();
function loadRun(sourceRun) {
  if (!sourceRun) return null;
  if (runCache.has(sourceRun)) return runCache.get(sourceRun);
  const run = readJson(path.join(ROOT, sourceRun));
  runCache.set(sourceRun, run);
  return run;
}

const cards = [];
for (const obsFile of walkJson(OBS_ROOT)) {
  const obs = readJson(obsFile);
  if (!obs || obs.kind !== 'issued-card-observations' || !Array.isArray(obs.recommendations)) continue;
  const run = loadRun(obs.sourceRun);
  if (!run || !Array.isArray(run.recs)) continue;

  obs.recommendations.forEach((o, index) => {
    const rec = run.recs[index];
    if (!rec) return;
    const completion = o?.completion || {};
    const price = exactAnalysisPrice(run, rec, o);
    const grade = cleanText(completion.grade).toUpperCase() || null;
    const units = completion.state === 'complete' ? settledUnits(grade, price.decimal) : null;

    cards.push({
      cardId: `${obs.sourceRun}#${index}`,
      sourceRun: obs.sourceRun,
      observationPath: repoPath(obsFile),
      runId: obs.runId || run.ts || null,
      date: cleanText(obs.runId || run.ts).slice(0, 10) || null,
      slot: obs.slot || run.slot || null,
      title: rec.title || o.title || null,
      status: cleanText(rec.status || o.status).toUpperCase() || null,
      eventId: String(rec?.feed?.eventId || completion.eventId || '') || null,
      selectionKey: rec?.feed?.selectionKey || o.selectionKey || null,
      sport: sportFamily(rec),
      market: marketFamily(rec),
      marketKey: rec?.feed?.marketKey || rec?.feed?.market || null,
      side: rec?.feed?.side || null,
      selectedLine: selectedLine(rec),
      book: rec.book || o.book || null,
      issuedPriceText: rec.price || o?.issued?.priceAmerican || null,
      analysisPrice: price,
      completionState: completion.state || 'unresolved',
      unresolvedReason: completion.state === 'complete' ? null : (completion.reason || 'unresolved'),
      grade,
      official: Boolean(completion.official),
      hypothetical: completion.hypothetical !== false,
      units,
      verifiedAt: completion.verifiedAt || null,
      commenceTime: rec?.feed?.eventDate || o.commenceTime || null,
      finalScore: completion.finalScore || null,
      settlementMethod: completion.settlementMethod || null,
      settlementComponents: completion.settlementComponents || null
    });
  });
}

cards.sort((a, b) => String(a.runId || '').localeCompare(String(b.runId || '')) || String(a.cardId).localeCompare(String(b.cardId)));

function aggregateRows(items, keyFn) {
  const map = new Map();
  for (const c of items) {
    const key = keyFn(c) || 'Other';
    if (!map.has(key)) map.set(key, { name: key, issued: 0, complete: 0, unresolved: 0, grades: gradeBucket(), priced: 0, netUnits: 0 });
    const x = map.get(key);
    x.issued += 1;
    if (c.completionState === 'complete') {
      x.complete += 1;
      addGrade(x.grades, c.grade);
      if (c.units !== null) { x.priced += 1; x.netUnits += c.units; }
    } else {
      x.unresolved += 1;
    }
  }
  return [...map.values()].map(x => ({
    ...x,
    netUnits: Number(x.netUnits.toFixed(4)),
    roiPct: x.priced ? Number((x.netUnits / x.priced * 100).toFixed(2)) : null
  }));
}

const selectionMap = new Map();
for (const c of cards) {
  const key = c.selectionKey || `card:${c.cardId}`;
  if (!selectionMap.has(key)) {
    selectionMap.set(key, {
      selectionKey: c.selectionKey,
      eventId: c.eventId,
      title: c.title,
      sport: c.sport,
      market: c.market,
      marketKey: c.marketKey,
      side: c.side,
      selectedLine: c.selectedLine,
      timeline: []
    });
  }
  selectionMap.get(key).timeline.push({
    cardId: c.cardId,
    runId: c.runId,
    date: c.date,
    slot: c.slot,
    status: c.status,
    issuedPriceText: c.issuedPriceText,
    analysisPrice: c.analysisPrice,
    completionState: c.completionState,
    grade: c.grade,
    units: c.units
  });
}
const selections = [...selectionMap.values()].map(s => {
  s.timeline.sort((a, b) => String(a.runId || '').localeCompare(String(b.runId || '')));
  const completed = s.timeline.find(x => x.completionState === 'complete');
  return {
    ...s,
    completionState: completed ? 'complete' : 'unresolved',
    grade: completed?.grade || null,
    statusPath: [...new Set(s.timeline.map(x => x.status).filter(Boolean))]
  };
}).sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));

const eventMap = new Map();
for (const c of cards) {
  if (!c.eventId) continue;
  if (!eventMap.has(c.eventId)) eventMap.set(c.eventId, { eventId: c.eventId, cards: 0, completeCards: 0, unresolvedCards: 0, titles: new Set() });
  const e = eventMap.get(c.eventId);
  e.cards += 1;
  e.titles.add(c.title);
  if (c.completionState === 'complete') e.completeCards += 1;
  else e.unresolvedCards += 1;
}
const events = [...eventMap.values()].map(e => ({ ...e, titles: [...e.titles], state: e.unresolvedCards ? 'unresolved' : 'complete' }));

const statusOrder = ['BET', 'LEAN', 'WAIT', 'PASS'];
const statusRows = aggregateRows(cards, c => c.status).sort((a, b) => statusOrder.indexOf(a.name) - statusOrder.indexOf(b.name));
const dailyRows = aggregateRows(cards, c => c.date).sort((a, b) => String(a.name).localeCompare(String(b.name)));
const marketRows = aggregateRows(cards, c => c.market).sort((a, b) => b.complete - a.complete || a.name.localeCompare(b.name));
const sportRows = aggregateRows(cards, c => c.sport).sort((a, b) => b.complete - a.complete || a.name.localeCompare(b.name));
const laneOrder = ['open', 'main', 'final_morning', 'evening', 'late'];
const laneRows = aggregateRows(cards, c => c.slot).sort((a, b) => laneOrder.indexOf(a.name) - laneOrder.indexOf(b.name));

const pricedCompleted = cards.filter(c => c.completionState === 'complete' && c.units !== null);
const netUnits = pricedCompleted.reduce((n, c) => n + c.units, 0);
const completeCards = cards.filter(c => c.completionState === 'complete').length;
const completeSelections = selections.filter(s => s.completionState === 'complete').length;
const unresolvedEvents = events.filter(e => e.state === 'unresolved');

const result = {
  schemaVersion: 1,
  kind: 'betting-edge-results-index',
  generatedAt: new Date().toISOString(),
  authority: {
    runs: 'data/history/runs/**',
    observations: 'data/history/observations/**',
    odds: 'data/history/odds-index.json + immutable Git blobs',
    indexAuthoritative: false
  },
  coverage: {
    firstDate: cards[0]?.date || null,
    lastDate: cards.at(-1)?.date || null,
    cards: cards.length,
    completeCards,
    unresolvedCards: cards.length - completeCards,
    selections: selections.length,
    completeSelections,
    unresolvedSelections: selections.length - completeSelections,
    events: events.length,
    unresolvedEvents: unresolvedEvents.length
  },
  priceAnalytics: {
    methodology: 'flat 1-unit risk per completed card with an exact fresh issued-snapshot quote; HALF_WIN/HALF_LOSS settle at half stake',
    pricedCards: pricedCompleted.length,
    netUnits: Number(netUnits.toFixed(4)),
    roiPct: pricedCompleted.length ? Number((netUnits / pricedCompleted.length * 100).toFixed(2)) : null
  },
  byStatus: statusRows,
  byDate: dailyRows,
  byMarket: marketRows,
  bySport: sportRows,
  byLane: laneRows,
  unresolved: cards.filter(c => c.completionState !== 'complete').map(c => ({
    cardId: c.cardId,
    eventId: c.eventId,
    selectionKey: c.selectionKey,
    title: c.title,
    date: c.date,
    slot: c.slot,
    status: c.status,
    sport: c.sport,
    market: c.market,
    commenceTime: c.commenceTime,
    reason: c.unresolvedReason
  })),
  unresolvedEvents: unresolvedEvents.map(e => ({ eventId: e.eventId, cards: e.cards, unresolvedCards: e.unresolvedCards, titles: e.titles })),
  cards,
  selections
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`${repoPath(OUTPUT)}: ${result.coverage.cards} cards, ${result.coverage.selections} selections, ${result.coverage.events} events, ${result.coverage.unresolvedEvents} unresolved events`);
