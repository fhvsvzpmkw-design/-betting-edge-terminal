import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {derivePrimarySelectionInventory} from '../tools/major-sport-market-coverage-gate.mjs';
import {evaluate} from '../tools/core-handicap-framework.mjs';

const tool = path.resolve('tools/report-publication.mjs');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policyRaw = fs.readFileSync('data/major-sport-market-coverage-v1.json', 'utf8'), policy = JSON.parse(policyRaw);
const frameworkRaw = fs.readFileSync('core/core-handicap-framework-v1.4.json', 'utf8'), framework = JSON.parse(frameworkRaw);

for (const observed of [false, true]) for (const unfinished of [0, 1, 3, 6]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partial-research-publication-'));
  const write = (file, value) => {const dest = path.join(root, file); fs.mkdirSync(path.dirname(dest), {recursive:true}); fs.writeFileSync(dest, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');};
  const hash = raw => execFileSync('git', ['hash-object', '-w', '--stdin'], {cwd:root, input:raw, encoding:'utf8'}).trim();
  const call = command => spawnSync(process.execPath, [tool, command, '--root', root, '--report', path.join(root, 'input-report.json'), '--sidecar', path.join(root, 'input-sidecar.json')], {cwd:root, encoding:'utf8'});
  try {
    execFileSync('git', ['init', '-q', root]);
    write('data/major-sport-market-coverage-v1.json', policyRaw);
    write('core/core-handicap-framework-v1.4.json', frameworkRaw);
    write('run-history.json', {schema_version:2, runs:[], updated_at:''});
    const report = {ts:'2026-09-06T18:21:30-07:00', feedGeneratedAt:'2026-09-07T01:08:00Z', slot:'late', label:'Synthetic partial-publication fixture', bankroll:100, risk:0, counts:{bet:0, lean:0, wait:0, pass:6 - unfinished}, recs:[], summary:`Primary selections: 6 available; ${6 - unfinished} evaluated; ${unfinished} evidence-blocked; 0 unavailable. Player-prop analysis paused.`};
    const makeFeed = ts => ({generatedAt:ts, ...(observed ? {quoteObservationVersion:1} : {}), events:[{eventId:'fixture', home:'Fixture Home', away:'Fixture Away', date:'2026-09-07T02:00:00Z', sport:{slug:'baseball'}, league:{slug:'usa-mlb'}, bookmakers:{Bet365:['ml', 'spread', 'totals'].map(marketKey => {
      const sides = marketKey === 'totals' ? ['over', 'under'] : ['home', 'away'];
      const line = marketKey === 'ml' ? null : marketKey === 'spread' ? -1.5 : 8.5;
      return {marketKey, updatedAt:observed ? '2026-09-06T12:00:00Z' : ts, ...(observed ? {observedAt:ts} : {}), odds:[{...(line === null ? {} : {hdp:line}), [sides[0]]:'1.9', [sides[1]]:'1.9', selectionKeys:Object.fromEntries(sides.map(side => [side, `fixture|${marketKey}|${side}||${line ?? ''}`]))}]};
    })}}]});
    const feed = makeFeed(report.feedGeneratedAt), feedRaw = JSON.stringify(feed), feedSha = hash(feedRaw);
    write('data/live-odds.json', feedRaw);
    const baseline = makeFeed('2026-09-07T00:08:00Z');
    const oddsIndex = JSON.stringify({entries:[{generatedAt:baseline.generatedAt, snapshotBlobSha:hash(JSON.stringify(baseline)), indexedAtUtc:'2026-09-07T00:09:00Z'}]});
    write('data/history/odds-index.json', oddsIndex); hash(oddsIndex);
    const inventory = derivePrimarySelectionInventory(report, feed, policy);
    assert.equal(inventory.selections.length, 6);
    const sidecar = read('data/history/research-fit/2026-09-05/late-182130.json');
    sidecar.reportReference = {slot:report.slot, label:report.label, ts:report.ts, feedGeneratedAt:report.feedGeneratedAt, reportPath:'data/history/runs/2026-09-06/late-182130.json'};
    Object.assign(sidecar.provenance, {feedBlobSha:feedSha, coreFrameworkPath:'core/core-handicap-framework-v1.4.json', coreFrameworkBlobSha:hash(frameworkRaw)});
    const receipts = inventory.selections.map((selection, index) => {
      const quote = selection.quotes[0];
      if (index >= 6 - unfinished) return {selectionId:selection.selectionId, quote, state:'BLOCKED', blocker:{reason:'RESEARCH_INCOMPLETE', checkedAt:report.ts, missing:'Synthetic selection sensitivity review remains unfinished.', impact:'No decision for this selection. Continue the missing review; other completed decisions remain valid.', attempts:[{eventId:'fixture', checkedAt:report.feedGeneratedAt, url:'https://example.org/fixtures/research-attempt', finding:'Synthetic source check completed; follow-up work interrupted by a fixture tool failure.'}]}};
      const context = {sport:'MLB', marketClass:selection.marketClass, marketDetail:selection.marketDetail, timing:'pregame', fairValueBasis:'INDEPENDENT_MODEL', bookDispersion:'NONE', liquidityRisk:'NORMAL', tailRisk:'NORMAL', directCalibration:'DIRECT', personnelSensitivity:'NONE', independentCurrentSupport:'STRONG', movementPrimaryEvidence:false, historicalDirectionalRecalibrationPrimary:false, graduatedResearchIds:[]};
      const coreAssessment = {frameworkId:framework.frameworkId, context, fairValueBasisRationale:'Synthetic independent model fixture.', uncertaintyStatement:'Synthetic model interval.', rationale:'Fixture price does not clear the supported range.', ...evaluate(framework, context)};
      const decision = {title:`Fixture ${selection.marketDetail} ${selection.side}`, status:'PASS', stake:'$0', book:quote.book, price:'-111', fair:'0.5', playTo:'NO BET', hist:'No historical prior used in synthetic fixture.', analysis:'Synthetic model probability and range do not clear the offered price.', feed:{...quote, eventDate:selection.eventDate}, coreAssessment,
        sourceEvidence:[{id:'model', kind:'MODEL', sport:'MLB', eventId:'fixture', checkedAt:report.feedGeneratedAt, url:'https://example.org/fixtures/model-output', title:'Synthetic model output', finding:'Test-supplied probability 0.5 with interval 0.48 to 0.52; not a production forecast.'}],
        fairValueEvidence:{selectionKey:quote.selectionKey, unit:'selection_probability', estimate:0.5, result:0.5, displayValue:'0.5', range:{low:0.48, high:0.52}, method:'Synthetic model output', calculation:'Test-supplied probability output; opposing probabilities and bounds are complementary.', limitations:'Synthetic receipt fixture, not a live handicap.', inputs:[{name:'Model output', value:0.5, unit:'probability', sourceIds:['model']}], personnelBasis:{sensitive:false, rationale:'Synthetic non-personnel fixture.'}}
      };
      const evidence = {...structuredClone(decision), ordinal:index + 1, displayText:decision.hist, priorIds:[], synthesisIds:[], clusterIds:[], personnelRequired:false, personnelEvidence:null, waitQualification:null};
      return {selectionId:selection.selectionId, quote, state:'EVALUATED', checkedAt:report.ts, decision, evidence};
    });
    sidecar.primaryAnalysis = {schema:1, feedGeneratedAt:feed.generatedAt, receipts};
    report.recs = receipts.filter(receipt => receipt.state === 'EVALUATED').map(receipt => receipt.decision);
    sidecar.recommendations = receipts.filter(receipt => receipt.state === 'EVALUATED').map(receipt => receipt.evidence);
    const audit = sidecar.coverageAudit;
    Object.assign(audit, {feedGeneratedAt:feed.generatedAt, authorityBlobSha:hash(policyRaw), availabilityLimitations:[], presentation:{mode:'UNBOUNDED_ANALYSIS_OUTPUT', allEvaluatedPublished:true, fillerAdded:0}});
    audit.sports = Object.fromEntries(Object.entries(inventory.sports).map(([sport, row]) => [sport, {gamesInScope:row.gamesInScope, gamesEvaluated:row.gamesInScope, primary:{...row.primary, evaluated:sport === 'MLB' ? 6 - unfinished : 0, blocked:sport === 'MLB' ? unfinished : 0}, props:{state:'PAUSED_BY_SCOPE', returned:0, screened:0, seriousDeepReviewed:0, excludedByScope:0}}]));
    audit.totals = {gamesInScope:1, gamesEvaluated:1, primaryRequired:6, primaryAvailable:6, primaryEvaluated:6 - unfinished, primaryBlocked:unfinished, primaryUnavailable:0, propsReturned:0, propsScreened:0, seriousPropsDeepReviewed:0, propsExcludedByScope:0};
    write('input-report.json', report); write('input-sidecar.json', sidecar);
    const before = JSON.stringify({report, sidecar});
    const expectedNotice = unfinished ? `${unfinished === 6 ? 'ANALYSIS INCOMPLETE' : 'PARTIAL REPORT'}: ${6 - unfinished} evaluated; ${unfinished} unfinished.` : null;
    for (const command of ['validate', 'publish', 'publish', 'verify']) {
      const result = call(command); assert.equal(result.status, 0, `${command}, observed=${observed}, unfinished=${unfinished}: ${result.stderr}`);
    }
    const stored = read(path.join(root, sidecar.reportReference.reportPath));
    const storedSidecar = read(path.join(root, 'data/history/research-fit/2026-09-06/late-182130.json'));
    assert.deepEqual(stored.recs, report.recs, 'every completed decision publishes unchanged');
    assert.deepEqual(storedSidecar.primaryAnalysis.receipts, receipts, 'no blocker becomes a fake fair, PASS or stake');
    assert.deepEqual(stored.counts, report.counts);
    assert.equal(stored.coverageSummary.researchCompletion.unfinished, unfinished);
    assert.equal(stored.coverageSummary.researchCompletion.notice, expectedNotice);
    if (expectedNotice) {
      assert.ok(stored.summary.startsWith(expectedNotice));
      assert.equal(stored.summary.split(expectedNotice).length - 1, 1, 'retries do not duplicate the notice');
      const tampered = {...stored, summary:report.summary}; write(sidecar.reportReference.reportPath, tampered);
      const result = call('verify'); assert.notEqual(result.status, 0); assert.match(result.stderr, /partial\/incomplete research notice/);
    }
    assert.equal(JSON.stringify({report:read(path.join(root, 'input-report.json')), sidecar:read(path.join(root, 'input-sidecar.json'))}), before, 'publisher preserves frozen inputs');
  } finally {fs.rmSync(root, {recursive:true, force:true});}
}
console.log('PARTIAL RESEARCH PUBLICATION: 6/0, 5/1, 3/3 and 0/6 evaluated/unfinished publish, retry and verify in both freshness modes; cards and evidence preserved; truthful notices enforced.');
