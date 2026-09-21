#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditPrimaryLineage } from './primary-lineage.mjs';

const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};

const eventId = '63303549';
const priorSelectionKey = eventId + '|spread|away||-1.5';
const currentSelectionKey = eventId + '|spread|away||1.5';
const prior = {
  ts: '2026-09-21T08:12:00-07:00',
  slot: 'main',
  feedGeneratedAt: '2026-09-21T14:53:58.883Z',
  recs: [{
    title: 'Toronto Blue Jays +1.5',
    status: 'LEAN',
    stake: '$0',
    book: 'Bet365',
    price: '-200',
    fair: 'Market reference: -209',
    playTo: 'NO BET',
    feed: {
      eventId,
      marketKey: 'spread',
      side: 'away',
      hdp: -1.5,
      selectionKey: priorSelectionKey,
      eventDate: '2026-09-21T22:35:00Z'
    },
    coreAssessment: { context: { sport: 'MLB', marketDetail: 'full_game_primary_run_line' } }
  }]
};
const report = {
  ts: '2026-09-21T09:30:00-07:00',
  slot: 'final_morning',
  feedGeneratedAt: '2026-09-21T16:20:00Z',
  recs: []
};
const feed = {
  generatedAt: report.feedGeneratedAt,
  events: [{
    id: eventId,
    date: '2026-09-21T22:35:00Z',
    bookmakers: {
      Bet365: [{
        name: 'Spread',
        marketKey: 'spread',
        updatedAt: '2026-09-21T16:15:00Z',
        odds: [{
          hdp: 1.5,
          home: '1.55',
          away: '2.50',
          selectionKeys: {
            home: eventId + '|spread|home||1.5',
            away: currentSelectionKey
          }
        }]
      }]
    }
  }]
};
const goodReceipt = {
  selectionId: 'MLB|' + eventId + '|full_game_primary_run_line|away',
  quote: {
    book: 'Bet365',
    eventId,
    marketKey: 'spread',
    side: 'away',
    line: 1.5,
    selectionKey: currentSelectionKey,
    priceDecimal: 2.5,
    quoteUpdatedAt: '2026-09-21T16:15:00Z'
  },
  state: 'BLOCKED',
  checkedAt: report.ts,
  blocker: {
    reason: 'RESEARCH_INCOMPLETE',
    missing: 'Current moved-line fair-value assessment is unfinished.',
    impact: 'No current decision or stake is authorized.',
    nextAction: 'Complete the exact current selection review.'
  }
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'primary-lineage-incomplete-'));
try {
  writeJson(path.join(root, 'run-history.json'), {
    runs: [{
      date: '2026-09-21',
      ts: prior.ts,
      slot: prior.slot,
      path: 'data/history/runs/2026-09-21/main-081200.json'
    }]
  });
  writeJson(path.join(root, 'data/history/runs/2026-09-21/main-081200.json'), prior);

  const accepted = auditPrimaryLineage({
    root,
    report,
    sidecar: { primaryAnalysis: { receipts: [goodReceipt] } },
    feed
  }, 'spread');
  assert.equal(accepted.ok, true, accepted.violations.join('; '));
  assert.equal(accepted.diagnostics.length, 1);
  assert.equal(accepted.diagnostics[0].state, 'RESEARCH_INCOMPLETE_CONTINUITY');
  assert.equal(accepted.diagnostics[0].priorSelectionKey, priorSelectionKey);
  assert.equal(accepted.diagnostics[0].currentSelectionKey, currentSelectionKey);
  assert.equal(accepted.diagnostics[0].currentLine, -1.5);

  const missing = auditPrimaryLineage({ root, report, sidecar: { primaryAnalysis: { receipts: [] } }, feed }, 'spread');
  assert.equal(missing.ok, false);
  assert.match(missing.violations.join(' '), /current decision card or an exact current RESEARCH_INCOMPLETE receipt/);

  const mismatched = structuredClone(goodReceipt);
  mismatched.quote.selectionKey = priorSelectionKey;
  const rejected = auditPrimaryLineage({
    root,
    report,
    sidecar: { primaryAnalysis: { receipts: [mismatched] } },
    feed
  }, 'spread');
  assert.equal(rejected.ok, false);
  assert.match(rejected.violations.join(' '), /current decision card or an exact current RESEARCH_INCOMPLETE receipt/);

  console.log('PRIMARY LINEAGE INCOMPLETE CONTINUITY TEST OK');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
