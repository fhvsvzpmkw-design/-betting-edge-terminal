import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { opposingMarketCoverage } from '../tools/lib/results-populations.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'results-populations-'));
const write = (file, data) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), JSON.stringify(data));
};
const rec = (event, side, status = 'PASS', extra = {}) => ({
  title: `${event} ${side}`, status, stake: status === 'BET' ? '$12' : '$0', book: 'Bet365', meta: 'MLB',
  feed: { eventId: event, marketKey: 'ml', side, selectionKey: `${event}|ml|${side}||`, sportKey: 'baseball', line: null },
  ...extra
});
const observed = (grade, decimal = 1.91) => ({
  issued: decimal === null ? {} : { analysisPriceState: 'exact', analysisPriceDecimal: decimal, analysisPriceAmerican: -110 },
  completion: { state: 'complete', grade }
});
const runPath = 'data/history/runs/2026-09-11/late.json';
const pendingPath = 'data/history/runs/2026-09-12/open.json';
const obsPath = 'data/history/observations/2026-09-11/late.json';
try {
  const run = { ts: '2026-09-11T18:20:00-07:00', slot: 'late', bankroll: 400,
    recs: [rec('paired', 'home'), rec('paired', 'away'), rec('missing', 'home'),
      rec('bet-priced', 'home', 'BET'), rec('bet-missing', 'home', 'BET'),
      rec('push', 'home', 'LEAN', { forecastRecordIds: ['forecast-exact-1'], forecastReview: { state: 'CONSIDERED' } }), rec('void', 'home', 'WAIT'),
      rec('college', 'home', 'PASS', { meta: 'NCAAF | Team A at Team B' }),
      rec('nfl', 'home', 'PASS', { meta: 'NFL | Team A at Team B' }),
      rec('cfl', 'home', 'PASS', { meta: 'CFL | Team A at Team B' }),
      rec('pre', 'home', 'PASS', { meta: 'NFL preseason | Team A at Team B' })] };
  write(runPath, run);
  write(obsPath, { kind: 'issued-card-observations', sourceRun: runPath,
    recommendations: [observed('WIN'), observed('LOSS'), observed('WIN', null), observed('WIN', 2.3),
      observed('LOSS', null), observed('PUSH'), observed('VOID'), observed('LOSS'), observed('LOSS'), observed('LOSS'), observed('LOSS')] });
  write(pendingPath, { ts: '2026-09-12T06:01:00-07:00', slot: 'open', bankroll: 400,
    recs: [rec('pending', 'home', 'WAIT')] });
  write('run-history.json', { runs: [{ path: runPath }, { path: pendingPath }] });
  write('data/history/odds-index.json', { entries: [] });
  const before = [runPath, pendingPath, obsPath].map(file => fs.readFileSync(path.join(root, file), 'utf8'));
  for (const script of ['build-results-index.mjs', 'add-results-player-value.mjs', 'add-results-shadow-v2.mjs']) {
    execFileSync(process.execPath, [path.join(repo, 'tools', script)], { cwd: root, encoding: 'utf8' });
  }
  const index = JSON.parse(fs.readFileSync(path.join(root, 'data/history/results-index.json'), 'utf8'));
  assert.equal(index.coverage.cards, 12);
  assert.equal(index.coverage.pendingObservationCards, 1);
  assert.equal(index.coverage.pendingObservationRuns, 1);
  assert.equal(index.coverage.observedThroughDate, '2026-09-11');
  assert.equal(index.coverage.lastDate, '2026-09-12');
  assert.equal(index.unresolved[0].reason, 'awaiting_observation');
  const cards = new Map(index.cards.map(card => [card.eventId, card]));
  assert.equal(cards.get('pending').units, null);
  assert.deepEqual(cards.get('push').forecastRecordIds, ['forecast-exact-1']);
  assert.equal(cards.get('push').forecastReview.state, 'CONSIDERED');
  assert.equal(cards.get('missing').units, null);
  assert.equal(cards.get('bet-missing').sizedNetUnits, null);
  assert.equal(cards.get('paired').selectedLine, null, 'missing ML line must not become zero');
  assert.equal(cards.get('college').sport, 'NCAAF');
  assert.equal(cards.get('nfl').sport, 'NFL');
  assert.equal(cards.get('cfl').sport, 'CFL');
  assert.equal(cards.get('pre').sport, 'NFL preseason');
  assert.equal(index.playerValueAnalytics.pricedBets, 1);
  assert.equal(index.issuedBetAnalytics.pricedBets, 1);
  assert.equal(index.issuedBetAnalytics.unpricedSettledBets, 1);
  assert.equal(index.issuedBetAnalytics.riskCad, 12);
  assert.equal(index.issuedBetAnalytics.netCad, 15.6);
  assert.equal(index.issuedBetAnalytics.roiPct, 130);
  assert.equal(index.decisionValueAnalytics.pricedFinalDecisions, 8, 'missing prices must not enter legacy priced denominator');
  assert.equal(index.decisionValueShadowV2.pricedFinalDecisions, 8);
  assert.equal(index.decisionValueShadowV2.shadowRiskUnits, 8, 'priced push and void retain 1u risk');
  assert.equal(index.decisionValueShadowV2.shadowNetUnits, -4.09);
  assert.equal(index.decisionValueShadowV2.shadowRoiPct, -51.12);
  assert.equal(index.decisionValueShadowV2.unresolvedFinalDecisions, 1);
  assert.equal(index.decisionValueShadowV2.opposingMarkets.pairedGroups, 1);
  assert.equal(index.decisionValueShadowV2.opposingMarkets.selectionsInPairedGroups, 2);
  assert.equal(index.decisionValueShadowV2.byStatus.find(row => row.status === 'PASS').calibrationState, 'NEGATIVE SHADOW RETURN');
  assert.match(index.decisionValueShadowV2.notes.join(' '), /bookmaker margin/i);

  // Opposite spread signs use one canonical home line. Alternates stay separate,
  // and the final appearance wins without hindsight selection by result.
  const marketRows = [
    { cardId: 'a', selectionKey: 'spread|spread|home||-2.5', runId: '2026-09-11T10:00:00Z', status: 'PASS' },
    { cardId: 'b', selectionKey: 'spread|spread|away||-2.5', runId: '2026-09-11T10:00:00Z', status: 'PASS' },
    { cardId: 'c', selectionKey: 'spread|spread|home||-2.5', runId: '2026-09-11T11:00:00Z', status: 'LEAN' },
    { cardId: 'd', selectionKey: 'spread|spread|away||-3.5', runId: '2026-09-11T11:00:00Z', status: 'PASS' }
  ];
  const grouping = opposingMarketCoverage(marketRows);
  assert.equal(grouping.groups, 2);
  assert.equal(grouping.pairedGroups, 1);
  assert.equal(grouping.unpairedSelections, 1);
  assert.ok(grouping.rows.find(row => row.opposingSidesPresent).statuses.includes('LEAN'));

  // Exercise the actual rendered shadow copy, including values/denominator.
  const uiFile = fs.readFileSync(path.join(repo, 'assets/decision-shadow-v2-ui.js'), 'utf8');
  const context = { document: { getElementById: () => null }, window: { addEventListener() {} },
    setInterval() {}, clearInterval() {}, fetch: async () => ({ ok: false }),
    console, __index: index };
  vm.createContext(context);
  vm.runInContext(uiFile.replace(/\}\)\(\);\s*$/, "globalThis.__render=render;})();"), context);
  const html = context.__render({ createElement: () => ({}) }, index.decisionValueShadowV2).innerHTML;
  assert.match(html, /BOOKMAKER MARGIN/);
  assert.match(html, /NET UNITS \/ 8 EXACT-PRICED SETTLED SELECTIONS/);
  assert.match(html, /1 PENDING; 1 SETTLED WITHOUT A USABLE EXACT PRICE/);
  assert.doesNotMatch(html, /NEGATIVE HERE IS GOOD|FILTER HELPED|FILTERS HELPED|TOO TIGHT|COUNT EDGE/);
  assert.deepEqual([runPath, pendingPath, obsPath].map(file => fs.readFileSync(path.join(root, file), 'utf8')), before,
    'builders must preserve issued archives and observation grades');
  console.log('RESULTS PERFORMANCE POPULATIONS: PASS // exact prices, issued stakes, opposing markets, pending publication, football and rendered interpretation');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
