#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const ODDS_INDEX = path.join(ROOT, 'data/history/odds-index.json');

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

function americanToDecimal(value) {
  const text = String(value ?? '').trim().replace(/[^0-9+.-]/g, '');
  const n = Number(text);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + (n / 100) : 1 + (100 / Math.abs(n));
}

function decimalToAmerican(value) {
  const d = Number(value);
  if (!Number.isFinite(d) || d <= 1) return null;
  if (d >= 2) return `+${Math.round((d - 1) * 100)}`;
  return String(Math.round(-100 / (d - 1)));
}

function compareOffer(issuedDecimal, observedDecimal) {
  if (!Number.isFinite(issuedDecimal) || !Number.isFinite(observedDecimal)) {
    return { relativeToIssued: 'unknown', issuedVsLater: 'unknown' };
  }
  const delta = observedDecimal - issuedDecimal;
  if (Math.abs(delta) < 1e-9) {
    return { relativeToIssued: 'same', issuedVsLater: 'same' };
  }
  if (delta > 0) {
    return { relativeToIssued: 'better_for_bettor', issuedVsLater: 'worse_than_later_price' };
  }
  return { relativeToIssued: 'worse_for_bettor', issuedVsLater: 'beat_later_price' };
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

function findExactQuote(snapshot, rec) {
  const selectionKey = rec?.feed?.selectionKey;
  const eventId = String(rec?.feed?.eventId || '');
  const wantedBook = normalizeBook(rec?.book);
  if (!selectionKey || !eventId || !wantedBook) return null;

  const event = (snapshot?.events || []).find((candidate) => String(candidate?.id) === eventId);
  if (!event) return null;

  const bookmakerEntry = Object.entries(event?.bookmakers || {})
    .find(([bookName]) => normalizeBook(bookName) === wantedBook);
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
          marketKey: market?.marketKey || market?.identity?.marketKey || null,
          quoteUpdatedAt: market?.updatedAt || null,
          decimal
        };
      }
    }
  }
  return null;
}

const { source, output } = parseArgs(process.argv.slice(2));
const sourcePath = path.resolve(ROOT, source);
if (!fs.existsSync(sourcePath)) fail(`source run not found: ${source}`);
if (!fs.existsSync(ODDS_INDEX)) fail('data/history/odds-index.json not found');

const issued = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const oddsIndex = JSON.parse(fs.readFileSync(ODDS_INDEX, 'utf8'));
const sourceFeedMs = parseTime(issued?.feedGeneratedAt);
const runMs = parseTime(issued?.ts);
if (sourceFeedMs === null) fail('source run has no valid feedGeneratedAt');
if (runMs === null) fail('source run has no valid ts');

const runDate = String(issued.ts).slice(0, 10);
const outputPath = output ? path.resolve(ROOT, output) : defaultOutputPath(sourcePath, runDate);
const snapshots = (oddsIndex?.entries || [])
  .map((entry) => ({ ...entry, _generatedMs: parseTime(entry?.generatedAt) }))
  .filter((entry) => entry._generatedMs !== null)
  .sort((a, b) => a._generatedMs - b._generatedMs);

const recommendations = (issued?.recs || []).map((rec) => {
  const selectionKey = rec?.feed?.selectionKey || null;
  const commenceTime = rec?.feed?.eventDate || null;
  const commenceMs = parseTime(commenceTime);
  const base = {
    title: rec?.title || null,
    status: rec?.status || null,
    book: rec?.book || null,
    bookKey: normalizeBook(rec?.book) || null,
    selectionKey,
    commenceTime,
    issued: {
      priceAmerican: rec?.price || null,
      priceDecimal: americanToDecimal(rec?.price),
      feedGeneratedAt: issued.feedGeneratedAt
    }
  };

  if (!selectionKey || !rec?.feed?.eventId) {
    return { ...base, observation: { state: 'unavailable', reason: 'missing_feed_identity' } };
  }
  if (commenceMs === null) {
    return { ...base, observation: { state: 'unavailable', reason: 'invalid_commence_time' } };
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

  const quote = findExactQuote(snapshot, rec);
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

  const observedAmerican = decimalToAmerican(quote.decimal);
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
      ...compareOffer(base.issued.priceDecimal, quote.decimal)
    }
  };
});

const result = {
  schemaVersion: 1,
  kind: 'issued-price-observations',
  sourceRun: toRepoPath(sourcePath),
  runId: issued.ts,
  slot: issued.slot || null,
  method: {
    identity: 'exact rec.feed.selectionKey',
    book: 'exact normalized rec.book to snapshot bookmaker key',
    window: 'snapshot generated after source feedGeneratedAt and before recommendation commenceTime',
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
