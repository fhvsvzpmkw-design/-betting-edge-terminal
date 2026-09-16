import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {prepareEvidenceDraft, validateCandidateCompletion} from '../tools/report-evidence-repair.mjs';
import {marketComparison} from '../tools/market-price-assessment.mjs';
import {evaluateMarketMethodShadow} from '../tools/market-method-shadow.mjs';
import {replay1815, root as repositoryRoot} from './fixtures/market-assessment-1815.mjs';

// SYNTHETIC ONLY: move the saved replay to the first evening or next day.
// All changed clocks and prices are fixture data, never new checks.
const tonight = process.argv.includes('--tonight');
const shiftDays = tonight ? 8 : 9;
const shift = (value, key = '') => {
  if (Array.isArray(value)) return value.map(item => shift(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, shift(item, name)]));
  if (key !== 'effectiveFrom' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const day = new Date(Date.parse(`${value.slice(0,10)}T12:00:00Z`) + shiftDays * 86400000).toISOString().slice(0,10);
    return day + value.slice(10);
  }
  return value;
};
const withoutForecastMetadata = rows => rows.map(({forecastEvidenceIds,forecastReview,...rec})=>rec);
const fixture = replay1815(), historical = JSON.stringify({report:fixture.report,sidecar:fixture.sidecar});
const {report, sidecar, feed, observer} = shift(fixture);
report.label = 'SYNTHETIC candidate-publication fixture — never issued';
sidecar.reportReference.label = report.label;
sidecar.reportReference.reportPath = `data/history/runs/${report.ts.slice(0,10)}/late-183100.json`;
assert.match(report.ts, tonight ? /^2026-09-15T18:31:00/ : /^2026-09-16T18:31:00/);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'candidate-publication-'));
const write = (file, value) => {
  const target = path.join(root, file); fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value,null,2)+'\n');
};
const read = file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const hash = value => execFileSync('git',['hash-object','-w','--stdin'],{cwd:root,input:typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value),encoding:'utf8'}).trim();
const tool = path.join(repositoryRoot,'tools/report-publication.mjs');
const call = command => spawnSync(process.execPath,[tool,command,'--root',root,'--report',path.join(root,'input-report.json'),'--sidecar',path.join(root,'input-sidecar.json')],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
const mustPass = command => {const result=call(command);assert.equal(result.status,0,`${command}: ${result.stderr || result.stdout}`);return result;};
try {
  execFileSync('git',['init','-q',root]);
  for (const file of ['data/major-sport-market-coverage-v1.json','core/core-handicap-framework-v1.4.json','research/forecast-source-registry.json','research/research-library.json']) {
    const raw=fs.readFileSync(path.join(repositoryRoot,file)); write(file,raw);hash(raw);
  }
  write('run-history.json',{schema_version:2,runs:[],updated_at:''});
  const target = sidecar.primaryAnalysis.receipts.find(row => row.quote.marketKey==='ml'&&row.quote.side==='away');
  assert.ok(target);
  const targetIndex = report.recs.findIndex(rec => rec.feed.selectionKey===target.quote.selectionKey && rec.book===target.quote.book);
  const rec = report.recs[targetIndex], positivePrice = Number((1 / rec.pinnacleBenchmark.noVigProbability + 0.25).toFixed(3));
  const event = feed.events.find(row => String(row.eventId||row.id)===String(target.quote.eventId));
  const market = event.bookmakers[target.quote.book].find(row => row.marketKey==='ml' && row.odds.some(odds => odds.selectionKeys?.away===target.quote.selectionKey));
  const odds = market.odds.find(row => row.selectionKeys?.away===target.quote.selectionKey);
  odds.away = positivePrice;
  rec.feed.priceDecimal = positivePrice; target.quote.priceDecimal = positivePrice;
  rec.price = positivePrice>=2?`+${Math.round((positivePrice-1)*100)}`:String(Math.round(-100/(positivePrice-1)));
  rec.benchmarkComparison = marketComparison(positivePrice,rec.pinnacleBenchmark.noVigProbability);
  rec.marketAssessment.informationReview.state = 'UNRESOLVED';
  rec.marketAssessment.informationReview.impact = 'Synthetic pending starter confirmation could change this favorable exact-market assessment.';
  rec.marketAssessment.decisionRationale = 'Synthetic draft PASS retained before the missing starter investigation was finished.';
  rec.analysis = rec.marketAssessment.decisionRationale;
  const evidence = {...sidecar.recommendations[targetIndex],...structuredClone(rec)};
  sidecar.recommendations[targetIndex] = evidence;
  target.decision = structuredClone(rec); target.evidence = structuredClone(evidence);
  // Current exact blobs are written into this isolated repo. No existing blob,
  // report or source check is represented as current production evidence.
  sidecar.provenance.feedBlobSha = hash(feed);
  sidecar.provenance.pinnacleObserverBlobSha = hash(observer);
  sidecar.provenance.coreFrameworkBlobSha = hash(fs.readFileSync(path.join(root,'core/core-handicap-framework-v1.4.json')));
  sidecar.coverageAudit.authorityBlobSha = hash(fs.readFileSync(path.join(root,'data/major-sport-market-coverage-v1.json')));
  write('data/live-odds.json',JSON.stringify(feed)); write('data/oddspapi-observer.json',JSON.stringify(observer));
  const inputBytes = JSON.stringify({report,sidecar});
  write('input-report.json',report); write('input-sidecar.json',sidecar);
  assert.throws(()=>validateCandidateCompletion({root,report,sidecar}),/unfinished candidate assessment/,'skipping preparation cannot silently issue the unfinished positive candidate');
  const bypass=call('validate'); assert.notEqual(bypass.status,0); assert.match(bypass.stderr,/unfinished candidate assessment/);

  const prepared=prepareEvidenceDraft({root,report,sidecar});
  assert.equal(JSON.stringify({report,sidecar}),inputBytes,'prepare clones the draft inputs');
  assert.deepEqual(prepared.audit.candidateDeferrals.selectionIds,[target.selectionId]);
  assert.deepEqual(prepared.audit.candidateDeferrals.failures,[]);
  assert.equal(prepared.report.recs.length,report.recs.length-1);
  assert.deepEqual(withoutForecastMetadata(prepared.report.recs),withoutForecastMetadata(report.recs.filter((_,index)=>index!==targetIndex)),'candidate deferral preserves every existing field of the other cards; forecast preparation only adds advisory metadata');
  assert.equal(prepared.report.counts.pass,5);assert.equal(prepared.report.risk,0);
  assert.deepEqual(prepared.sidecar.recommendations.map(row=>row.ordinal),[1,2,3,4,5]);
  assert.equal(prepared.sidecar.coverageAudit.totals.primaryEvaluated,5);
  assert.equal(prepared.sidecar.coverageAudit.totals.primaryBlocked,1);
  assert.equal(prepared.sidecar.coverageAudit.sports.MLB.primary.evaluated,5);
  assert.equal(prepared.sidecar.coverageAudit.sports.MLB.primary.blocked,1);
  const blocked=prepared.sidecar.primaryAnalysis.receipts.find(row=>row.selectionId===target.selectionId);
  assert.equal(blocked.state,'BLOCKED');assert.equal(blocked.blocker.reason,'RESEARCH_INCOMPLETE');
  assert.equal(blocked.decision,undefined);assert.equal(blocked.evidence,undefined);
  assert.equal(blocked.candidateDraft.authority,'UNISSUED_INCOMPLETE_DRAFT_ONLY');
  assert.ok(blocked.blocker.attempts.length>0,'deferral retains real event-specific source attempts from the replay');
  assert.equal(prepared.report.candidateAssessment.counts.available,6);
  assert.equal(prepared.report.candidateAssessment.counts.unfinished,1);
  assert.equal(prepared.report.candidateAssessment.selections.find(row=>row.selectionId===target.selectionId).status,null);
  assert.doesNotThrow(()=>validateCandidateCompletion({root,report:prepared.report,sidecar:prepared.sidecar}));
  const repeated=prepareEvidenceDraft({root,report:prepared.report,sidecar:prepared.sidecar});
  assert.deepEqual(repeated.report,prepared.report,'repeat preparation preserves the complete report');
  assert.deepEqual(repeated.sidecar.primaryAnalysis,prepared.sidecar.primaryAnalysis,'repeat preparation does not alter receipts or defer again');
  assert.deepEqual(repeated.sidecar.recommendations,prepared.sidecar.recommendations);
  assert.deepEqual(repeated.audit.candidateDeferrals.selectionIds,[]);

  write('input-report.json',prepared.report);write('input-sidecar.json',prepared.sidecar);
  const frozenInputs={report:fs.readFileSync(path.join(root,'input-report.json'),'utf8'),sidecar:fs.readFileSync(path.join(root,'input-sidecar.json'),'utf8')};
  mustPass('validate');mustPass('publish');
  const reportPath=sidecar.reportReference.reportPath,sidecarPath=reportPath.replace('/runs/','/research-fit/');
  const stored=read(reportPath),storedSidecar=read(sidecarPath);
  assert.deepEqual(stored.recs,prepared.report.recs);
  assert.deepEqual(storedSidecar.primaryAnalysis.receipts,prepared.sidecar.primaryAnalysis.receipts);
  for (const [index,card] of stored.recs.entries()) {
    const receipt=storedSidecar.primaryAnalysis.receipts.find(row=>row.decision?.feed?.selectionKey===card.feed.selectionKey);
    assert.deepEqual(receipt.decision,card);
    for (const key of ['feed','status','coreAssessment','sourceEvidence']) assert.deepEqual(receipt.evidence[key],storedSidecar.recommendations[index][key],`remaining receipt evidence ${key} remains bound to the published selection`);
    assert.equal(storedSidecar.recommendations[index].ordinal,index+1);
  }

  assert.equal(stored.coverageSummary.selections.available,6);
  assert.equal(stored.coverageSummary.selections.evaluated,5);
  assert.equal(stored.coverageSummary.selections.blocked,1);
  assert.equal(stored.coverageSummary.researchCompletion.unfinished,1);
  assert.match(stored.summary,/^PARTIAL REPORT: 5 evaluated; 1 unfinished\./);
  assert.equal(stored.marketMethodShadow.mode,tonight ? 'DEVELOPMENT_REPLAY' : 'PROSPECTIVE');
  if (tonight) assert.equal(evaluateMarketMethodShadow({snapshots:[stored.marketMethodShadow]}).summary.samples,0);
  assert.equal(stored.marketMethodShadow.authority,'HYPOTHETICAL_ONLY');
  assert.equal(stored.marketMethodShadow.decisionAuthority,false);
  assert.equal(stored.marketMethodShadow.executionAuthority,false);
  const issuedBytes={report:fs.readFileSync(path.join(root,reportPath),'utf8'),sidecar:fs.readFileSync(path.join(root,sidecarPath),'utf8')};
  const registry=read('research/forecast-source-registry.json');registry.version='synthetic-retry-diagnostic-change';write('research/forecast-source-registry.json',registry);
  mustPass('publish');mustPass('verify');
  assert.equal(fs.readFileSync(path.join(root,reportPath),'utf8'),issuedBytes.report,'publisher retry preserves the issued report snapshot');
  assert.equal(fs.readFileSync(path.join(root,sidecarPath),'utf8'),issuedBytes.sidecar,'publisher retry preserves the issued sidecar snapshot');
  assert.equal(fs.readFileSync(path.join(root,'input-report.json'),'utf8'),frozenInputs.report);
  assert.equal(fs.readFileSync(path.join(root,'input-sidecar.json'),'utf8'),frozenInputs.sidecar);

  const legacy=prepareEvidenceDraft({root:repositoryRoot,report:fixture.report,sidecar:fixture.sidecar});
  assert.deepEqual(withoutForecastMetadata(legacy.report.recs),withoutForecastMetadata(fixture.report.recs),'historical cards are not retroactively deferred');
  assert.equal(legacy.report.candidateAssessment,undefined);
  assert.equal(validateCandidateCompletion({root:'/not-needed',report:fixture.report,sidecar:fixture.sidecar}),null);
  assert.equal(JSON.stringify({report:fixture.report,sidecar:fixture.sidecar}),historical);
  console.log('Candidate publication: synthetic forward draft defers one unfinished positive candidate; five cards publish unchanged, retry/verify preserve immutable snapshots, bypass fails, repeat prepare and legacy behavior remain stable.');
} finally {fs.rmSync(root,{recursive:true,force:true});}
