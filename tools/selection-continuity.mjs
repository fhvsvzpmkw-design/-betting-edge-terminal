#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { activeReportScope, isPlayerPropRecommendation } from './major-sport-market-coverage-gate.mjs';
import { totalEventSide, totalLineageApplies } from './total-lineage.mjs';

const ACTIVE = new Set(['BET', 'LEAN', 'WAIT']);
const RESOLVED = new Set(['BET', 'LEAN', 'WAIT', 'PASS']);

function die(message) { throw new Error(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function parseMs(value) { const ms = Date.parse(value || ''); return Number.isFinite(ms) ? ms : null; }
function selectionKey(rec) { return String(rec?.feed?.selectionKey || '').trim(); }
function marketKey(rec) { return String(rec?.feed?.marketKey || rec?.feed?.market || '').toLowerCase(); }
function spreadEventSide(rec) {
  if (marketKey(rec) !== 'spread' || !rec?.feed?.eventId || !rec?.feed?.side) return null;
  return `${rec.feed.eventId}|${String(rec.feed.side).toLowerCase()}`;
}
function stakeNumber(value) { return Number(String(value ?? '0').replace(/[$,\s]/g, '')); }

export function auditSelectionContinuity({ previous, report, scopePolicy = null }) {
  const reportMs = parseMs(report?.ts);
  if (reportMs === null) die('Report ts is invalid');
  const scope = scopePolicy ? activeReportScope(report, scopePolicy) : null;

  const currentByKey = new Map();
  const currentSpreadByEventSide = new Map();
  const currentTotalByEventSide = new Map();
  const violations = [];
  const diagnostics = [];

  for (const rec of report?.recs || []) {
    const key = selectionKey(rec);
    if (key) {
      if (currentByKey.has(key)) violations.push(`current report contains duplicate selectionKey ${key}`);
      currentByKey.set(key, rec);
    }
    const spreadKey = spreadEventSide(rec);
    if (spreadKey) currentSpreadByEventSide.set(spreadKey, rec);
    const totalKey = totalEventSide(rec);
    if (totalKey) currentTotalByEventSide.set(totalKey, rec);
  }

  for (const rec of previous?.recs || []) {
    const priorStatus = String(rec?.status || '').toUpperCase();
    if (!ACTIVE.has(priorStatus)) continue;
    const key = selectionKey(rec);
    if (!key) continue;
    if (scope && isPlayerPropRecommendation(rec)) {
      diagnostics.push({ selectionKey: key, priorStatus, state: 'PAUSED_BY_SCOPE' });
      continue;
    }

    const current = currentByKey.get(key);
    if (current) {
      const nextStatus = String(current?.status || '').toUpperCase();
      if (!RESOLVED.has(nextStatus)) {
        violations.push(`${key} must receive a fresh BET/LEAN/WAIT/PASS decision; got ${current?.status}`);
        continue;
      }
      const stake = stakeNumber(current?.stake);
      if (nextStatus === 'BET') {
        if (!(Number.isFinite(stake) && stake > 0)) violations.push(`${key} resolved to BET without positive stake`);
        if (!String(current?.price || '').trim() || !String(current?.fair || '').trim() || !String(current?.playTo || '').trim()) {
          violations.push(`${key} resolved to BET without current price, fair value and playTo`);
        }
      } else if (Number.isFinite(stake) && stake !== 0) {
        violations.push(`${key} resolved to ${nextStatus} with non-zero stake`);
      }
      diagnostics.push({ selectionKey: key, priorStatus, nextStatus, state: 'RE_EVALUATED' });
      continue;
    }

    const eventDate = String(rec?.feed?.eventDate || '').trim();
    const eventMs = parseMs(eventDate);
    if (eventMs !== null && reportMs >= eventMs) {
      diagnostics.push({ selectionKey: key, priorStatus, state: 'EVENT_STARTED_OR_CLOSED' });
      continue;
    }

    const lineageKey = spreadEventSide(rec);
    if (lineageKey) {
      const movedSpread = currentSpreadByEventSide.get(lineageKey);
      if (movedSpread) {
        diagnostics.push({
          selectionKey: key,
          priorStatus,
          state: 'DEFERRED_TO_SPREAD_LINEAGE',
          currentSelectionKey: selectionKey(movedSpread) || null
        });
        continue;
      }
    }

    const totalKey = totalLineageApplies(report) ? totalEventSide(rec) : null;
    const movedTotal = totalKey ? currentTotalByEventSide.get(totalKey) : null;
    if (movedTotal) {
      diagnostics.push({ selectionKey: key, priorStatus, state: 'DEFERRED_TO_TOTAL_LINEAGE',
        currentSelectionKey: selectionKey(movedTotal) || null });
      continue;
    }
    violations.push(`${rec.status} ${rec.title} [${key}] event=${eventDate || 'UNKNOWN'} vanished before event start`);
  }

  return { ok: violations.length === 0, diagnostics, violations };
}

function loadPrior(root, report) {
  const index = readJson(path.join(root, 'run-history.json'));
  const reportMs = parseMs(report?.ts);
  const day = String(report?.ts || '').slice(0, 10);
  const prior = (index?.runs || [])
    .filter(entry => String(entry?.ts || '').slice(0, 10) === day && parseMs(entry?.ts) < reportMs && entry?.path)
    .sort((a, b) => parseMs(b.ts) - parseMs(a.ts))[0];
  return prior ? { entry: prior, report: readJson(path.join(root, prior.path)) } : null;
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

function selfTest() {
  const priorKey = 'event-1|ml|away||';
  const prior = {
    recs: [{ status: 'LEAN', title: 'Away moneyline', feed: { eventId: 'event-1', marketKey: 'ml', side: 'away', selectionKey: priorKey, eventDate: '2026-08-30T20:00:00Z' } }]
  };
  const base = { ts: '2026-08-30T09:30:00-07:00', recs: [] };

  const carried = structuredClone(base);
  carried.recs = [{ status: 'PASS', title: 'Away moneyline', stake: '$0', feed: prior.recs[0].feed }];
  assert.equal(auditSelectionContinuity({ previous: prior, report: carried }).ok, true);

  const missing = auditSelectionContinuity({ previous: prior, report: base });
  assert.equal(missing.ok, false);
  assert.match(missing.violations.join(' '), /vanished before event start/i);

  const betWithoutStake = structuredClone(carried);
  betWithoutStake.recs[0] = { ...betWithoutStake.recs[0], status: 'BET', price: '+120', fair: '+100', playTo: '+110', stake: '$0' };
  const badBet = auditSelectionContinuity({ previous: prior, report: betWithoutStake });
  assert.equal(badBet.ok, false);
  assert.match(badBet.violations.join(' '), /without positive stake/i);

  const startedPrior = structuredClone(prior);
  startedPrior.recs[0].feed.eventDate = '2026-08-30T15:00:00Z';
  assert.equal(auditSelectionContinuity({ previous: startedPrior, report: base }).ok, true);

  const spreadPrior = {
    recs: [{ status: 'WAIT', title: 'Away +3.5', feed: { eventId: 'spread-1', marketKey: 'spread', side: 'away', hdp: -3.5, selectionKey: 'spread-1|spread|away||-3.5', eventDate: '2026-08-30T20:00:00Z' } }]
  };
  const moved = structuredClone(base);
  moved.recs = [{ status: 'WAIT', title: 'Away +4', stake: '$0', feed: { eventId: 'spread-1', marketKey: 'spread', side: 'away', hdp: -4, selectionKey: 'spread-1|spread|away||-4', eventDate: '2026-08-30T20:00:00Z' } }];
  const deferred = auditSelectionContinuity({ previous: spreadPrior, report: moved });
  assert.equal(deferred.ok, true, deferred.violations.join('; '));
  assert.equal(deferred.diagnostics[0].state, 'DEFERRED_TO_SPREAD_LINEAGE');

  const duplicate = structuredClone(carried);
  duplicate.recs.push(structuredClone(duplicate.recs[0]));
  const duplicateAudit = auditSelectionContinuity({ previous: prior, report: duplicate });
  assert.equal(duplicateAudit.ok, false);
  assert.match(duplicateAudit.violations.join(' '), /duplicate selectionKey/i);

  console.log('SELECTION CONTINUITY SELF-TEST OK');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'self-test') { selfTest(); return; }
  if (args.command !== 'audit' || !args.report) die('Usage: selection-continuity.mjs audit --report FILE [--root DIR] | self-test');
  const root = path.resolve(args.root || process.cwd());
  const report = readJson(path.resolve(args.report));
  const prior = loadPrior(root, report);
  if (!prior) { console.log('SELECTION CONTINUITY OK: no prior same-day report'); return; }

  const scopePolicy = readJson(path.join(root, 'data/major-sport-market-coverage-v1.json'));
  const result = auditSelectionContinuity({ previous: prior.report, report, scopePolicy });
  for (const item of result.diagnostics) {
    if (item.state === 'RE_EVALUATED') console.log(`SELECTION CONTINUITY RE-EVALUATED: ${item.selectionKey} ${item.priorStatus} -> ${item.nextStatus}`);
    else if (item.state === 'DEFERRED_TO_SPREAD_LINEAGE') console.log(`SELECTION CONTINUITY DEFERRED TO SPREAD LINEAGE: ${item.selectionKey} -> ${item.currentSelectionKey || 'NEW LINE'}`);
    else if (item.state === 'DEFERRED_TO_TOTAL_LINEAGE') console.log(`SELECTION CONTINUITY DEFERRED TO TOTAL LINEAGE: ${item.selectionKey} -> ${item.currentSelectionKey || 'NEW LINE'}`);
    else if (item.state === 'PAUSED_BY_SCOPE') console.log(`SELECTION CONTINUITY PAUSED BY SCOPE: ${item.selectionKey} ${item.priorStatus}; issued history retained`);
  }
  if (!result.ok) {
    die(`a tracked BET/LEAN/WAIT failed continuity before event start. Prior=${prior.entry.path}. ${result.violations.join('; ')}`);
  }
  console.log(`SELECTION CONTINUITY OK: ${prior.entry.path}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(`SELECTION CONTINUITY ERROR: ${error.message}`); process.exit(1); }
}
