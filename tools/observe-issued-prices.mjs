#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const ODDS_INDEX = path.join(ROOT, 'data/history/odds-index.json');
const MAX_EXECUTABLE_QUOTE_AGE_MS = 30 * 60 * 1000;
const EPSILON = 1e-9;

function fail(message) {
  console.error(`observe-issued-prices: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let source = null;
  let output = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--output') {
      output = argv[i + 1];
      i += 1;
    } else if (!arg.startsWith('-') && !source) {
      source = arg;
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  if (!source) {
    fail('usage: node tools/observe-issued-prices.mjs <issued-run.json> [--output <observations.json>]');
  }
  return { source, output };
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail(`cannot parse ${file}: ${error.message}`); }
}

function toRepoPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function defaultOutputPath(sourcePath, runDate) {
  const rel = toRepoPath(sourcePath);
  if (rel.startsWith('data/history/runs/')) {
    return path.join(ROOT, rel.replace('data/history/runs/', 'data/history/observations/'));
  }
  return path.join(ROOT, 'data/history/observations', runDate, path.basename(sourcePath));
}

function parseTime(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : null;
}

function normalizeBook(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function splitBookCandidates(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const parts = raw.split(/\s*(?:\/|,|&|\+)\s*/).map((part) => part.trim()).filter(Boolean);
  const seen = new Set();
  const candidates = [];
  for (const part of parts.length ? parts : [raw]) {
    const key = normalizeBook(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    candidates.push({ label: part, key });
  }
  return candidates;
}

function decimalToAmericanNumber(value) {
  const d = Number(value);
  if (!Number.isFinite(d) || d <= 1) return null;
  if (d >= 2) return Math.round((d - 1) * 100);
  return Math.round(-100 / (d - 1));
}

function decimalToAmericanString(value) {
  const american = decimalToAmericanNumber(value);
  if (!Number.isFinite(american)) return null;
  return american > 0 ? `+${american}` : String(american);
}

function compareOffer(issuedDecimal, observedDecimal) {
  if (!Number.isFinite(issuedDecimal) || !Number.isFinite(observedDecimal)) {
    return { relativeToIssued: 'unknown', issuedVsLater: 'unknown' };
  }
  const delta = observedDecimal - issuedDecimal;
  if (Math.abs(delta) < EPSILON) {
    return { relativeToIssued: 'same', issuedVsLater: 'same' };
  }
  if (delta > 0) {
    return { relativeToIssued: 'better_for_bettor', issuedVsLater: 'worse_than_later_price' };
  }
  return { relativeToIssued: 'worse_for_bettor', issuedVsLater: 'beat_later_price' };
}

function normalizeMarket(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSide(value) {
  return String(value || '').trim().toLowerCase();
}

function parseLine(rec) {
  const direct = rec?.feed?.hdp ?? rec?.feed?.line;
  if (Number.isFinite(Number(direct))) return Number(direct);
  const parts = String(rec?.feed?.selectionKey || '').split('|');
  const tail = parts.at(-1);
  return Number.isFinite(Number(tail)) && tail !== '' ? Number(tail) : null;
}

function selectedSpreadLine(rec) {
  const rawLine = parseLine(rec);
  if (!Number.isFinite(rawLine)) return null;
  const side = normalizeSide(rec?.feed?.side);
  if (side === 'away') return -rawLine;
  if (side === 'home') return rawLine;
  return null;
}

function selectedLineForAnalytics(rec) {
  const market = normalizeMarket(rec?.feed?.marketKey || rec?.feed?.market);
  if (market === 'ml' || market === 'moneyline') return null;
  if (market === 'spread') return selectedSpreadLine(rec);
  return parseLine(rec);
}

const blobCache = new Map();
function readSnapshotBlob(blobSha) {
  if (blobCache.has(blobSha)) return blobCache.get(blobSha);
  try {
    const raw = execFileSync('git', ['cat-file', 'blob', blobSha], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const parsed = JSON.parse(raw);
    blobCache.set(blobSha, parsed);
    return parsed;
  } catch {
    blobCache.set(blobSha, null);
    return null;
  }
}

function findExactQuote(snapshot, rec, wantedBookKey) {
  const selectionKey = rec?.feed?.selectionKey;
  const eventId = String(rec?.feed?.eventId || '');
  if (!selectionKey || !eventId || !wantedBookKey) return null;

  const event = (snapshot?.events || []).find((candidate) => String(candidate?.id) === eventId);
  if (!event) return null;

  const bookmakerEntry = Object.entries(event?.bookmakers || {})
    .find(([bookName]) => normalizeBook(bookName) === wantedBookKey);
  if (!bookmakerEntry) return null;

  const [bookName, markets] = bookmakerEntry;
  for (const market of markets || []) {
    for (const row of market?.odds || []) {
      const keys = row?.selectionKeys || row?.identity?.selectionKeys || {};
      for (const [field, key] of Object.entries(keys)) {
        if (key !== selectionKey) continue;
        const decimal = Number(row?.[field]);
        if (!Number.isFinite(decimal) || decimal <= 1) return null;
        return {
          book: bookName,
          bookKey: normalizeBook(bookName),
          marketKey: market?.marketKey || market?.identity?.marketKey || null,
          quoteUpdatedAt: market?.updatedAt || null,
          decimal
        };
      }
    }
  }
  return null;
}

function quoteAgeMs(snapshotGeneratedAt, quoteUpdatedAt) {
  const snapshotMs = parseTime(snapshotGeneratedAt);
  const quoteMs = parseTime(quoteUpdatedAt);
  if (snapshotMs === null || quoteMs === null) return null;
  return snapshotMs - quoteMs;
}

function isFreshExecutableQuote(snapshotGeneratedAt, quoteUpdatedAt) {
  const age = quoteAgeMs(snapshotGeneratedAt, quoteUpdatedAt);
  return age !== null && age >= 0 && age <= MAX_EXECUTABLE_QUOTE_AGE_MS;
}

function unavailableAnalytics(rec, reason, snapshotEntry = null) {
  return {
    analysisPriceState: 'unavailable',
    analysisPriceReason: reason,
    analysisPriceAmerican: null,
    analysisPriceDecimal: null,
    analysisBook: null,
    analysisBookKey: null,
    analysisQuoteUpdatedAt: null,
    analysisSnapshotBlobSha: snapshotEntry?.snapshotBlobSha || null,
    marketKey: normalizeMarket(rec?.feed?.marketKey || rec?.feed?.market) || null,
    side: normalizeSide(rec?.feed?.side) || null,
    selectedLine: selectedLineForAnalytics(rec)
  };
}

function resolveIssuedAnalytics(rec, issuedSnapshotEntry, issuedSnapshot, feedGeneratedAt) {
  if (!issuedSnapshotEntry || !issuedSnapshot) {
    return unavailableAnalytics(rec, issuedSnapshotEntry ? 'issued_snapshot_blob_unavailable' : 'issued_snapshot_not_indexed', issuedSnapshotEntry);
  }

  const candidates = splitBookCandidates(rec?.book);
  if (!candidates.length) return unavailableAnalytics(rec, 'issued_book_not_resolved', issuedSnapshotEntry);

  const quotes = [];
  for (const candidate of candidates) {
    const quote = findExactQuote(issuedSnapshot, rec, candidate.key);
    if (!quote) continue;
    if (!isFreshExecutableQuote(feedGeneratedAt, quote.quoteUpdatedAt)) continue;
    quotes.push(quote);
  }

  if (!quotes.length) {
    return unavailableAnalytics(rec, 'no_fresh_exact_issued_quote', issuedSnapshotEntry);
  }

  quotes.sort((a, b) => b.decimal - a.decimal || candidates.findIndex((candidate) => candidate.key === a.bookKey) - candidates.findIndex((candidate) => candidate.key === b.bookKey));
  const best = quotes[0];
  return {
    analysisPriceState: 'verified_exact_issued_snapshot',
    analysisPriceReason: null,
    analysisPriceAmerican: decimalToAmericanNumber(best.decimal),
    analysisPriceDecimal: best.decimal,
    analysisBook: best.book,
    analysisBookKey: best.bookKey,
    analysisQuoteUpdatedAt: best.quoteUpdatedAt,
    analysisSnapshotBlobSha: issuedSnapshotEntry.snapshotBlobSha || null,
    marketKey: normalizeMarket(rec?.feed?.marketKey || rec?.feed?.market) || best.marketKey || null,
    side: normalizeSide(rec?.feed?.side) || null,
    selectedLine: selectedLineForAnalytics(rec)
  };
}

function existingRecommendation(existingResult, rec, index) {
  const selectionKey = rec?.feed?.selectionKey || null;
  const rows = Array.isArray(existingResult?.recommendations) ? existingResult.recommendations : [];
  if (selectionKey) {
    const exact = rows.find((row) => row?.selectionKey === selectionKey);
    if (exact) return exact;
  }
  return rows[index] || null;
}

const { source, output } = parseArgs(process.argv.slice(2));
const sourcePath = path.resolve(ROOT, source);
if (!fs.existsSync(sourcePath)) fail(`source run not found: ${source}`);
if (!fs.existsSync(ODDS_INDEX)) fail('data/history/odds-index.json not found');

const issued = readJson(sourcePath);
const oddsIndex = readJson(ODDS_INDEX);
const sourceFeedMs = parseTime(issued?.feedGeneratedAt);
const runMs = parseTime(issued?.ts);
if (sourceFeedMs === null) fail('source run has no valid feedGeneratedAt');
if (runMs === null) fail('source run has no valid ts');

const runDate = String(issued.ts).slice(0, 10);
const outputPath = output ? path.resolve(ROOT, output) : defaultOutputPath(sourcePath, runDate);
const existingResult = fs.existsSync(outputPath) ? readJson(outputPath) : null;
const snapshots = (oddsIndex?.entries || [])
  .map((entry) => ({ ...entry, _generatedMs: parseTime(entry?.generatedAt) }))
  .filter((entry) => entry._generatedMs !== null)
  .sort((a, b) => a._generatedMs - b._generatedMs);

const issuedSnapshotEntry = [...snapshots].reverse().find((entry) => entry.generatedAt === issued.feedGeneratedAt) || null;
const issuedSnapshot = issuedSnapshotEntry ? readSnapshotBlob(issuedSnapshotEntry.snapshotBlobSha) : null;

const recommendations = (issued?.recs || []).map((rec, index) => {
  const selectionKey = rec?.feed?.selectionKey || null;
  const commenceTime = rec?.feed?.eventDate || null;
  const commenceMs = parseTime(commenceTime);
  const analytics = resolveIssuedAnalytics(rec, issuedSnapshotEntry, issuedSnapshot, issued.feedGeneratedAt);
  const existing = existingRecommendation(existingResult, rec, index) || {};
  const issuedFields = {
    ...(existing?.issued || {}),
    priceAmerican: rec?.price || null,
    priceDecimal: analytics.analysisPriceDecimal,
    feedGeneratedAt: issued.feedGeneratedAt,
    ...analytics
  };
  const base = {
    ...existing,
    title: rec?.title || null,
    status: rec?.status || null,
    book: rec?.book || null,
    bookKey: analytics.analysisBookKey || existing?.bookKey || null,
    selectionKey,
    commenceTime,
    issued: issuedFields
  };

  if (!selectionKey || !rec?.feed?.eventId) {
    return { ...base, observation: { state: 'unavailable', reason: 'missing_feed_identity' } };
  }
  if (commenceMs === null) {
    return { ...base, observation: { state: 'unavailable', reason: 'invalid_commence_time' } };
  }
  if (analytics.analysisPriceState !== 'verified_exact_issued_snapshot' || !analytics.analysisBookKey) {
    return {
      ...base,
      observation: {
        ...(existing?.observation || {}),
        state: 'unavailable',
        reason: 'issued_analysis_price_unavailable'
      }
    };
  }

  const eligible = snapshots.filter((entry) => (
    entry._generatedMs > sourceFeedMs &&
    entry._generatedMs < commenceMs
  ));
  if (!eligible.length) {
    return { ...base, observation: { state: 'unavailable', reason: 'no_later_prestart_snapshot' } };
  }

  const snapshotEntry = eligible[eligible.length - 1];
  const snapshot = readSnapshotBlob(snapshotEntry.snapshotBlobSha);
  if (!snapshot) {
    return {
      ...base,
      observation: {
        state: 'unavailable',
        reason: 'snapshot_blob_unavailable',
        snapshotGeneratedAt: snapshotEntry.generatedAt,
        snapshotBlobSha: snapshotEntry.snapshotBlobSha,
        snapshotCommitSha: snapshotEntry.snapshotCommitSha || null
      }
    };
  }

  const quote = findExactQuote(snapshot, rec, analytics.analysisBookKey);
  if (!quote) {
    return {
      ...base,
      observation: {
        state: 'unavailable',
        reason: 'no_exact_quote_in_later_prestart_snapshot',
        snapshotGeneratedAt: snapshotEntry.generatedAt,
        snapshotBlobSha: snapshotEntry.snapshotBlobSha,
        snapshotCommitSha: snapshotEntry.snapshotCommitSha || null
      }
    };
  }

  const observedAmerican = decimalToAmericanString(quote.decimal);
  return {
    ...base,
    observation: {
      state: 'observed_exact',
      snapshotGeneratedAt: snapshotEntry.generatedAt,
      snapshotBlobSha: snapshotEntry.snapshotBlobSha,
      snapshotCommitSha: snapshotEntry.snapshotCommitSha || null,
      quoteUpdatedAt: quote.quoteUpdatedAt,
      marketKey: quote.marketKey,
      priceDecimal: quote.decimal,
      priceAmerican: observedAmerican,
      ...compareOffer(analytics.analysisPriceDecimal, quote.decimal)
    }
  };
});

const result = {
  ...(existingResult || {}),
  schemaVersion: existingResult?.schemaVersion || 1,
  kind: 'issued-card-observations',
  sourceRun: toRepoPath(sourcePath),
  runId: issued.ts,
  slot: issued.slot || null,
  method: {
    ...(existingResult?.method || {}),
    identity: 'exact rec.feed.selectionKey',
    issuedPrice: 'best fresh exact quote among the books named on the issued card, resolved from the immutable snapshot whose generatedAt exactly matches source feedGeneratedAt',
    issuedPriceFreshness: 'quoteUpdatedAt must be no more than 30 minutes before source feedGeneratedAt',
    comparisonBook: 'same normalized sportsbook selected for analysisPrice at issuance',
    window: 'comparison snapshot generated after source feedGeneratedAt and before recommendation commenceTime',
    snapshotSource: 'data/history/odds-index.json + immutable Git blob SHA',
    label: 'last observed pre-start price; not a verified closing line',
    closingLine: false,
    newOddsApiRequests: 0
  },
  recommendations
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`${toRepoPath(outputPath)}: ${recommendations.length} recommendation observations written`);
