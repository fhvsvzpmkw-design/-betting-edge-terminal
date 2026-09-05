#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { moneylineApplies } from './moneyline-lineage.mjs';

const BOOKS = ['Bet365', 'DraftKings'];
const ACTIVE = new Set(['BET', 'LEAN', 'WAIT']);
const QUOTE_MAX_AGE_MINUTES = 30;

function die(message) { throw new Error(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function parseMs(value) { const ms = Date.parse(value || ''); return Number.isFinite(ms) ? ms : null; }
function ageMinutes(older, newer) { const a = parseMs(older), b = parseMs(newer); if (a === null || b === null) return Infinity; return Math.max(0, (b - a) / 60000); }
function quoteFresh(updatedAt, generatedAt) { return ageMinutes(updatedAt, generatedAt) <= QUOTE_MAX_AGE_MINUTES; }
function eventIdentity(event) { return String(event?.eventId || event?.identity?.eventId || event?.id || ''); }
function marketIdentity(market) { return String(market?.marketKey || market?.identity?.marketKey || '').toLowerCase(); }
function rowLabel(row) { return String(row?.label || row?.player || row?.participant || row?.name || row?.selection || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function rowLine(row) { for (const key of ['hdp', 'line', 'total', 'points']) { const n = Number(row?.[key]); if (Number.isFinite(n)) return n; } return null; }
function decimalOdds(value) { const n = Number(value); return Number.isFinite(n) && n > 1.001 ? n : null; }
function americanOdds(value) { const d = decimalOdds(value); if (!d) return null; const n = d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)); return n > 0 ? `+${n}` : String(n); }
function americanPriceToken(value) {
  const source = String(value || '').replace(/−/g, '-');
  const match = source.match(/(?:^|[^0-9])([+-]\d{2,4})(?!\d)/);
  return match ? match[1] : null;
}
function selectionIdentity(row, side, event, market) {
  const s = String(side || '').toLowerCase();
  const supplied = row?.selectionKeys?.[s] || row?.identity?.selectionKeys?.[s] || row?.selectionKey || row?.identity?.selectionKey;
  if (supplied) return String(supplied);
  const line = rowLine(row);
  return [eventIdentity(event), marketIdentity(market), s, rowLabel(row), line === null ? '' : String(line)].join('|');
}
function isSpread(rec) { return String(rec?.feed?.marketKey || rec?.feed?.market || '').toLowerCase() === 'spread'; }
function canonicalBook(value) {
  const source = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (source === 'BET365' || source === 'B365') return 'Bet365';
  if (source === 'DRAFTKINGS' || source === 'DK') return 'DraftKings';
  return null;
}
function bookAliases(book) { return book === 'Bet365' ? ['BET365', 'B365'] : ['DRAFTKINGS', 'DK']; }
function escaped(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function quotedBookPrice(text, book, american) {
  const source = String(text || '').toUpperCase().replace(/−/g, '-');
  const price = escaped(String(american));
  return bookAliases(book).some(alias => {
    const a = escaped(alias);
    return new RegExp(`${a}[^+\\-]{0,24}${price}(?!\\d)`).test(source) || new RegExp(`${price}[^A-Z0-9]{0,24}${a}`).test(source);
  });
}
function anyNumericBookPrice(text, book) {
  const source = String(text || '').toUpperCase().replace(/−/g, '-');
  return bookAliases(book).some(alias => {
    const a = escaped(alias);
    return new RegExp(`${a}[^+\\-]{0,24}[+\\-]\\d{2,4}`).test(source) || new RegExp(`[+\\-]\\d{2,4}[^A-Z0-9]{0,24}${a}`).test(source);
  });
}

function allEvents(feed) {
  const merged = new Map();
  for (const event of [...(feed?.events || []), ...(feed?.deepMarkets || []), ...(feed?.baseballProps || [])]) {
    const id = eventIdentity(event);
    if (!id) continue;
    if (!merged.has(id)) { merged.set(id, event); continue; }
    const prior = merged.get(id);
    const next = { ...prior, ...event, bookmakers: { ...(prior?.bookmakers || {}) } };
    for (const [book, markets] of Object.entries(event?.bookmakers || {})) next.bookmakers[book] = [...(next.bookmakers[book] || []), ...(markets || [])];
    merged.set(id, next);
  }
  return merged;
}

export function exactBookQuotes(feed, rec) {
  const event = allEvents(feed).get(String(rec?.feed?.eventId || ''));
  if (!event) return [];
  const wantedMarket = String(rec?.feed?.marketKey || '').toLowerCase();
  const wantedSelection = String(rec?.feed?.selectionKey || '');
  const side = String(rec?.feed?.side || '').toLowerCase();
  if (!wantedMarket || !wantedSelection || !side) return [];
  const quotes = [];
  for (const book of BOOKS) {
    let best = null;
    for (const market of event?.bookmakers?.[book] || []) {
      if (marketIdentity(market) !== wantedMarket || !quoteFresh(market?.updatedAt, feed?.generatedAt)) continue;
      for (const row of market?.odds || []) {
        if (selectionIdentity(row, side, event, market) !== wantedSelection) continue;
        const dec = decimalOdds(row?.[side]);
        if (!dec) continue;
        const quote = { book, american: americanOdds(dec), updatedAt: market.updatedAt };
        if (!best || (parseMs(quote.updatedAt) ?? 0) > (parseMs(best.updatedAt) ?? 0)) best = quote;
      }
    }
    if (best) quotes.push(best);
  }
  return quotes;
}

function structuredCurrentQuote(rec) {
  const suppliedBook = String(rec?.book || '').trim();
  if (!suppliedBook) return null;
  return {
    suppliedBook,
    book: canonicalBook(suppliedBook),
    american: americanPriceToken(rec?.price)
  };
}

export function auditTrackedAvailability({ previous, report, feed }) {
  const currentByKey = new Map((report?.recs || []).map(rec => [String(rec?.feed?.selectionKey || '').trim(), rec]).filter(([key]) => key));
  const reportMs = parseMs(report?.ts);
  const diagnostics = [];
  const violations = [];

  for (const prior of previous?.recs || []) {
    if (!ACTIVE.has(String(prior?.status || '').toUpperCase()) || isSpread(prior)) continue;
    if (moneylineApplies(report) && String(prior?.feed?.marketKey || prior?.feed?.market || '').toLowerCase() === 'ml') {
      diagnostics.push({ selectionKey: prior?.feed?.selectionKey || null, state: 'DEFERRED_TO_MONEYLINE_LINEAGE' });
      continue;
    }
    const key = String(prior?.feed?.selectionKey || '').trim();
    if (!key) continue;
    const eventMs = parseMs(prior?.feed?.eventDate);
    if (eventMs !== null && reportMs !== null && reportMs >= eventMs) continue;
    const current = currentByKey.get(key);
    if (!current) continue;

    const quotes = exactBookQuotes(feed, prior);
    const available = new Map(quotes.map(q => [q.book, q]));
    const priceText = String(current?.price || '');
    const structured = structuredCurrentQuote(current);
    diagnostics.push({
      selectionKey: key,
      title: prior.title,
      quotes,
      currentBook: current?.book || null,
      currentPrice: current?.price || null,
      representation: structured ? 'STRUCTURED_BOOK_PRICE' : 'LEGACY_PRICE_TEXT'
    });

    if (quotes.length) {
      if (structured) {
        if (!structured.book) {
          violations.push(`${prior.title}: current book ${structured.suppliedBook} is not a supported execution book`);
        } else if (!structured.american) {
          violations.push(`${prior.title}: fresh exact supported-book quote exists but current price ${priceText || 'EMPTY'} is not an American price`);
        } else {
          const bound = available.get(structured.book);
          if (!bound) {
            violations.push(`${prior.title}: current ${structured.book} ${structured.american} is not fresh/exact in the bound snapshot; fresh supported quotes are ${quotes.map(q => `${q.book} ${q.american}`).join(', ')}`);
          } else if (bound.american !== structured.american) {
            violations.push(`${prior.title}: current ${structured.book} ${structured.american} does not match bound fresh exact ${structured.book} ${bound.american}`);
          }
        }
      } else {
        for (const quote of quotes) {
          if (!quotedBookPrice(priceText, quote.book, quote.american)) {
            violations.push(`${prior.title}: fresh exact ${quote.book} ${quote.american} exists in the bound snapshot but legacy current price text does not show it`);
          }
        }
      }
    } else if (structured?.book && structured.american) {
      violations.push(`${prior.title}: current field shows ${structured.book} ${structured.american} even though no fresh exact supported-book quote exists in the bound snapshot`);
    }

    for (const book of BOOKS) {
      const mentionsNumericBookPrice = anyNumericBookPrice(priceText, book);
      if (!mentionsNumericBookPrice) continue;
      const bound = available.get(book);
      if (!bound) {
        violations.push(`${prior.title}: current price text shows a numeric ${book} quote even though no fresh exact ${book} quote exists in the bound snapshot`);
      } else if (!quotedBookPrice(priceText, book, bound.american)) {
        violations.push(`${prior.title}: current price text shows ${book} with a price that does not match bound fresh exact ${book} ${bound.american}`);
      }
    }
  }

  return { ok: violations.length === 0, diagnostics, violations };
}

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
function loadPrior(root, report) {
  const index = readJson(path.join(root, 'run-history.json'));
  const day = String(report?.ts || '').slice(0, 10);
  const reportMs = parseMs(report?.ts);
  const prior = (index?.runs || []).filter(entry => entry?.path && String(entry?.ts || '').slice(0, 10) === day && parseMs(entry.ts) < reportMs).sort((a, b) => parseMs(b.ts) - parseMs(a.ts))[0];
  return prior ? readJson(path.join(root, prior.path)) : null;
}
function loadFeed(root, report, sidecar) {
  const sha = String(sidecar?.provenance?.feedBlobSha || '');
  if (/^[0-9a-f]{40}$/i.test(sha)) {
    try { return JSON.parse(execFileSync('git', ['cat-file', 'blob', sha], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })); }
    catch { /* exact live snapshot fallback below */ }
  }
  const live = readJson(path.join(root, 'data/live-odds.json'));
  if (String(live?.generatedAt || '') !== String(report?.feedGeneratedAt || '')) die('Cannot resolve exact bound odds snapshot for selection availability audit');
  return live;
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command !== 'audit' || !args.report || !args.sidecar) die('Usage: selection-availability.mjs audit --report FILE --sidecar FILE [--root DIR]');
  const root = path.resolve(args.root || process.cwd());
  const report = readJson(path.resolve(args.report));
  const sidecar = readJson(path.resolve(args.sidecar));
  const previous = loadPrior(root, report);
  if (!previous) { console.log('SELECTION AVAILABILITY OK: no prior same-day report'); return; }
  const feed = loadFeed(root, report, sidecar);
  if (String(feed?.generatedAt || '') !== String(report?.feedGeneratedAt || '')) die(`Bound feed ${feed?.generatedAt || 'unknown'} does not match report ${report?.feedGeneratedAt || 'unknown'}`);
  const result = auditTrackedAvailability({ previous, report, feed });
  if (!result.ok) die(`SELECTION AVAILABILITY VIOLATION: ${result.violations.join('; ')}`);
  const deferred = result.diagnostics.filter(item => item.state === 'DEFERRED_TO_MONEYLINE_LINEAGE').length;
  console.log(`SELECTION AVAILABILITY OK: ${result.diagnostics.length - deferred} carried non-spread selections checked${deferred ? `; ${deferred} moneylines handled by the complete moneyline gate` : ''}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`SELECTION AVAILABILITY ERROR: ${error.message}`); process.exit(1); }
}
