import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { activeReportScope, deriveBoundCoverage, validateCoverageAudit, validateReportMarketScope } from '../tools/major-sport-market-coverage-gate.mjs';
import { auditSelectionContinuity } from '../tools/selection-continuity.mjs';

const policy = JSON.parse(fs.readFileSync('data/major-sport-market-coverage-v1.json', 'utf8'));
const cutover = policy.reportScope.effectiveFrom;
assert.equal(cutover, '2026-09-05T13:00:00-07:00');
assert.deepEqual(policy.reportScope.enabledPropMarkets, []);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'primary-market-scope-'));
fs.mkdirSync(path.join(root, 'data'));
const rawPolicy = fs.readFileSync('data/major-sport-market-coverage-v1.json');
fs.writeFileSync(path.join(root, 'data/major-sport-market-coverage-v1.json'), rawPolicy);
const authoritySha = crypto.createHash('sha1').update(Buffer.from('blob ' + rawPolicy.length + '\0')).update(rawPolicy).digest('hex');

const sports = [
  ['MLB', 'baseball', 'usa-mlb'],
  ['NHL', 'ice-hockey', 'usa-nhl'],
  ['NBA', 'basketball', 'usa-nba'],
  ['WNBA', 'basketball', 'usa-wnba'],
  ['NFL', 'american-football', 'usa-nfl'],
  ['NCAAF', 'american-football', 'usa-college'],
  ['CFL', 'american-football', 'canada-cfl']
];
const feed = { generatedAt: '2026-09-05T19:59:00Z', events: [] };
const report = { ts: cutover, feedGeneratedAt: feed.generatedAt, recs: [] };
for (const [sport, slug, league] of sports) {
  const sportKey = ['NBA', 'WNBA'].includes(sport) ? 'NBA_WNBA' : sport;
  const specs = policy.sports[['NFL', 'NCAAF', 'CFL'].includes(sport) ? 'FOOTBALL' : sportKey].primary;
  const event = { eventId: sport, date: '2026-09-06T00:00:00Z', sport: { slug }, league: { slug: league }, bookmakers: { Bet365: [] } };
  for (const spec of specs) {
    const key = { moneyline: 'ml', spread: 'spread', total: 'totals' }[spec.market];
    const line = key === 'ml' ? '' : key === 'spread' ? -1.5 : 8.5;
    const row = { ...(line === '' ? {} : { hdp: line }), selectionKeys: {} };
    for (const side of spec.requiredSelections) {
      const selectionKey = [sport, key, side, '', line].join('|');
      row[side] = '1.91';
      row.selectionKeys[side] = selectionKey;
      report.recs.push({ title: sport + ' ' + key + ' ' + side, status: 'PASS', stake: '$0',
        feed: { eventId: sport, eventDate: event.date, marketKey: key, side, selectionKey },
        coreAssessment: { context: { sport, marketClass: spec.market, marketDetail: spec.marketDetail } } });
    }
    event.bookmakers.Bet365.push({ marketKey: key, updatedAt: feed.generatedAt, odds: [row] });
  }
  event.bookmakers.Bet365.push({ marketKey: 'player-props', name: 'Player Props', updatedAt: feed.generatedAt,
    odds: [{ label: 'Synthetic Player', hdp: 1.5, over: '2.1', under: '1.8',
      selectionKeys: { over: sport + '|player-props|over|synthetic-player|1.5', under: sport + '|player-props|under|synthetic-player|1.5' } }] });
  feed.events.push(event);
}

function receipt(currentReport = report, currentFeed = feed) {
  const scope = activeReportScope(currentReport, policy);
  const derived = deriveBoundCoverage(currentReport, currentFeed, policy);
  const totals = { gamesInScope: 0, gamesEvaluated: 0, primaryRequired: 0, primaryEvaluated: 0,
    primaryUnavailable: 0, propsReturned: 0, propsScreened: 0, seriousPropsDeepReviewed: 0 };
  if (scope) totals.propsExcludedByScope = 0;
  const rows = {};
  for (const [sport, row] of Object.entries(derived.sports)) {
    rows[sport] = { gamesInScope: row.gamesInScope, gamesEvaluated: row.gamesInScope, primary: row.primary,
      props: { returned: row.propsReturned, screened: scope ? 0 : row.propsReturned, seriousDeepReviewed: 0,
        ...(scope ? { state: 'PAUSED_BY_SCOPE', excludedByScope: row.propsReturned } : {}) } };
    totals.gamesInScope += row.gamesInScope;
    totals.gamesEvaluated += row.gamesInScope;
    totals.primaryRequired += row.primary.required;
    totals.primaryEvaluated += row.primary.evaluated;
    totals.primaryUnavailable += row.primary.unavailable;
    totals.propsReturned += row.propsReturned;
    totals.propsScreened += scope ? 0 : row.propsReturned;
    if (scope) totals.propsExcludedByScope += row.propsReturned;
  }
  const limitations = [...derived.limitations].map(([tuple, reason]) => {
    const [sport, eventId, marketDetail, selection] = tuple.split('|');
    return { sport, eventId, marketDetail, selections: [selection], reason };
  });
  return { provenance: { feedBlobSha: 'a'.repeat(40) },
    recommendations: currentReport.recs.map(rec => ({ coreAssessment: structuredClone(rec.coreAssessment) })),
    coverageAudit: { schema: 1, authorityId: policy.authorityId, authorityPath: 'data/major-sport-market-coverage-v1.json',
      authorityBlobSha: authoritySha, state: 'COMPLETE', feedGeneratedAt: currentReport.feedGeneratedAt,
      evaluationOrder: policy.principles.evaluationOrder, complete: true, sports: rows, totals,
      ...(scope ? { scope: { id: scope.id, effectiveFrom: scope.effectiveFrom, playerProps: scope.playerProps } } : {}),
      availabilityLimitations: limitations,
      presentation: { target: 12, targetIsSoft: true, overflowProtection: true, actionableSuppressedByTarget: 0 } } };
}
function validate(sidecar, currentReport = report, currentFeed = feed) {
  return validateCoverageAudit(currentReport, sidecar, { root, feed: currentFeed });
}
function rejectMutation(mutate, pattern) {
  const copy = receipt();
  mutate(copy);
  assert.throws(() => validate(copy), pattern);
}
try {
  const result = validate(receipt());
  assert.equal(result.calculatedTotals.primaryEvaluated, 42, 'all six primary selections across seven sports remain required and available from one fresh book');
  assert.equal(result.calculatedTotals.propsReturned, 14);
  assert.equal(result.calculatedTotals.propsExcludedByScope, 14);
  assert.equal(result.calculatedTotals.propsScreened, 0);
  assert.equal(result.calculatedTotals.seriousPropsDeepReviewed, 0);
  rejectMutation(s => { delete s.coverageAudit.scope; }, /scope must match/);
  rejectMutation(s => { s.coverageAudit.scope.effectiveFrom = '2026-09-06T13:00:00-07:00'; }, /scope must match/);
  rejectMutation(s => { s.coverageAudit.sports.MLB.props.screened = 2; }, /screening and deeper analysis must be zero/);
  rejectMutation(s => { s.coverageAudit.sports.MLB.props.seriousDeepReviewed = 1; }, /screening and deeper analysis must be zero/);
  rejectMutation(s => { s.coverageAudit.sports.MLB.props.state = 'UNAVAILABLE'; }, /state must be PAUSED_BY_SCOPE/);
  rejectMutation(s => { s.coverageAudit.sports.MLB.props.returned = 0; s.coverageAudit.sports.MLB.props.excludedByScope = 0; s.coverageAudit.totals.propsReturned -= 2; s.coverageAudit.totals.propsExcludedByScope -= 2; }, /does not match exact bound feed/);
  rejectMutation(s => { s.coverageAudit.sports.NFL.primary.evaluated = 4; }, /primary arithmetic/);
  rejectMutation(s => { s.coverageAudit.totals.propsExcludedByScope = 0; }, /does not reconcile/);
  rejectMutation(s => { s.recommendations[0].coreAssessment.context.marketClass = 'player_props'; }, /scope context marketClass differs/);

  for (const [sport] of sports) for (const status of ['BET', 'LEAN', 'WAIT', 'PASS']) {
    const changed = structuredClone(report);
    const rec = changed.recs.find(rec => rec.coreAssessment.context.sport === sport);
    rec.status = status;
    rec.coreAssessment.context.marketClass = 'player_props';
    rec.coreAssessment.context.marketDetail = 'player_stat';
    rec.feed.marketKey = 'player-props';
    assert.throws(() => validate(receipt(changed), changed), /outside PRIMARY_FULL_GAME_ONLY/);
  }
  const disguised = structuredClone(report);
  disguised.recs[0].feed.marketKey = 'player-props';
  assert.throws(() => validateReportMarketScope(disguised, { policy }), /outside PRIMARY_FULL_GAME_ONLY|feed identity is outside/);
  disguised.recs[0].feed.marketKey = 'ml';
  disguised.recs[0].feed.selectionKey = 'MLB|player-props|home|synthetic-player|1.5';
  assert.throws(() => validateReportMarketScope(disguised, { policy }), /selectionKey is outside/);
  const partialGame = structuredClone(report);
  partialGame.recs[0].coreAssessment.context.marketDetail = 'first_half_moneyline';
  assert.throws(() => validateReportMarketScope(partialGame, { policy }), /outside PRIMARY_FULL_GAME_ONLY/);
  const labeledPrimary = structuredClone(report);
  labeledPrimary.recs[2].feed.selectionKey = 'MLB|spread|home|1-1-5|-1.5';
  assert.equal(validateReportMarketScope(labeledPrimary, { policy }).id, 'PRIMARY_FULL_GAME_ONLY',
    'a provider label on a primary spread must not be mistaken for a player prop');
  const unverifiedPrimary = structuredClone(report);
  delete unverifiedPrimary.recs[0].feed.selectionKey;
  unverifiedPrimary.recs[0].price = 'PRICE NOT VERIFIED';
  assert.equal(validateReportMarketScope(unverifiedPrimary, { policy }).id, 'PRIMARY_FULL_GAME_ONLY');

  const staleFeed = structuredClone(feed);
  staleFeed.events[0].bookmakers.Bet365[0].updatedAt = '2026-09-05T19:19:00Z';
  const stale = validate(receipt(report, staleFeed), report, staleFeed);
  assert.equal(stale.calculatedTotals.primaryUnavailable, 2, 'paused props must not excuse a stale main market');
  assert.ok(stale.audit.availabilityLimitations.every(item => item.reason === 'STALE_EXECUTABLE_QUOTE'));
  const noProps = structuredClone(feed);
  for (const event of noProps.events) event.bookmakers.Bet365.pop();
  assert.equal(validate(receipt(report, noProps), report, noProps).calculatedTotals.propsExcludedByScope, 0);

  const priorProp = { status: 'WAIT', title: 'Tracked prop', feed: { marketKey: 'player-props',
    selectionKey: 'MLB|player-props|over|synthetic-player|1.5', eventDate: '2026-09-06T00:00:00Z' } };
  const before = { ...structuredClone(report), ts: '2026-09-05T12:59:59-07:00' };
  const historicalReceipt = receipt(before);
  assert.equal(validate(historicalReceipt, before).calculatedTotals.propsScreened, 14);
  assert.equal(Object.hasOwn(historicalReceipt.coverageAudit, 'scope'), false);
  assert.equal(auditSelectionContinuity({ previous: { recs: [priorProp] }, report: before, scopePolicy: policy }).ok, false);
  const continuity = auditSelectionContinuity({ previous: { recs: [priorProp] }, report, scopePolicy: policy });
  assert.equal(continuity.ok, true);
  assert.equal(continuity.diagnostics[0].state, 'PAUSED_BY_SCOPE');
  const priorPrimary = structuredClone(report.recs[0]);
  priorPrimary.status = 'LEAN';
  assert.equal(auditSelectionContinuity({ previous: { recs: [priorPrimary] }, report: { ...report, recs: [] }, scopePolicy: policy }).ok, false);
  const unapproved = structuredClone(policy);
  unapproved.reportScope.enabledPropMarkets.push('MLB:pitcher_strikeouts');
  assert.throws(() => activeReportScope(report, unapproved), /separately validated scope amendment/);
  const blockedBundle = { ...structuredClone(report), slot: 'evening', label: 'Scope regression',
    bankroll: 100, risk: 0, counts: { bet: 0, lean: 0, wait: 0, pass: report.recs.length } };
  blockedBundle.recs[0].coreAssessment.context.marketClass = 'player_props';
  const reportFile = path.join(root, 'report.json'), sidecarFile = path.join(root, 'sidecar.json');
  const originalBundle = JSON.stringify(blockedBundle);
  fs.writeFileSync(reportFile, originalBundle);
  fs.writeFileSync(sidecarFile, '{}');
  for (const command of ['validate', 'publish']) {
    const run = spawnSync(process.execPath, [path.resolve('tools/report-publication.mjs'), command,
      '--report', reportFile, '--sidecar', sidecarFile], { cwd: root, encoding: 'utf8' });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /outside PRIMARY_FULL_GAME_ONLY/, command + ' must reject props before publication');
    assert.equal(fs.readFileSync(reportFile, 'utf8'), originalBundle);
    assert.equal(fs.existsSync(path.join(root, 'run-history.json')), false);
    assert.equal(fs.existsSync(path.join(root, 'data/history')), false);
  }
  console.log('PRIMARY MARKET SCOPE TEST: PASS — seven sports, six primary selections each, paused inventory, all prop statuses blocked, cutover and continuity');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
