#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const argv=process.argv.slice(2);
const flag=(name, fallback=null)=>{const i=argv.indexOf(name);return i>=0?argv[i+1]:fallback;};
const fixturePath=flag('--fixture');
const policyPath=path.resolve(ROOT,flag('--policy','data/walters/nfl/graham-research-completion-policy-v1.json'));
const receiptOut=flag('--receipt-out');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');
const padWeek=w=>String(Number(w)).padStart(2,'0');

const policy=read(policyPath);
if(policy.schema!==1||policy.state!=='OPERATIONAL'||policy.policyId!=='graham-research-completion-v1')throw new Error('GRAHAM_RESEARCH_COMPLETION_POLICY_NOT_OPERATIONAL');
if(policy.runtimeCheckpoint?.policyId!=='graham-research-runtime-v1'||policy.runtimeCheckpoint?.requireDurableRunStartedBeforeExpensiveSourceLoading!==true||policy.runtimeCheckpoint?.requireCompletedEventAfterVerifiedReceipt!==true||policy.runtimeCheckpoint?.requireControlledFailureEventWhenCompletionCannotFinish!==true)throw new Error('GRAHAM_RESEARCH_COMPLETION_RUNTIME_CHECKPOINT_INVALID');
const runtimePolicy=read(path.resolve(ROOT,policy.runtimeCheckpoint.policyPath));
if(runtimePolicy.schema!==1||runtimePolicy.state!=='OPERATIONAL'||runtimePolicy.policyId!==policy.runtimeCheckpoint.policyId)throw new Error('GRAHAM_RESEARCH_COMPLETION_RUNTIME_POLICY_NOT_OPERATIONAL');

let active,staging,ledger,ledgerPathForReceipt;
if(fixturePath){
  const fixture=read(path.resolve(ROOT,fixturePath));
  active=fixture.active;
  staging=fixture.staging;
  ledger=fixture.ledger;
  ledgerPathForReceipt=staging?.ledgerPath||'FIXTURE_LEDGER';
}else{
  const activePath=path.resolve(ROOT,flag('--active','data/walters/nfl/active-week.json'));
  const stagingPath=path.resolve(ROOT,flag('--staging','data/walters/nfl/research-completion-staging.json'));
  active=read(activePath);
  staging=read(stagingPath);
  const expectedActiveLedger=`data/walters/nfl/${Number(active.season)}/week-${padWeek(active.week)}-research-ledger.json`;
  const suppliedLedger=flag('--ledger',staging?.ledgerPath||expectedActiveLedger);
  ledgerPathForReceipt=String(suppliedLedger).replaceAll('\\','/');
  ledger=read(path.resolve(ROOT,suppliedLedger));
}

if(active?.schema!==1||active?.state!=='ACTIVE'||active?.authority!=='GRAHAM_WEEK_ROLLOVER')throw new Error('GRAHAM_RESEARCH_COMPLETION_ACTIVE_WEEK_INVALID');
if(staging?.schema!==1||staging?.state!=='READY')throw new Error('GRAHAM_RESEARCH_COMPLETION_STAGING_NOT_READY');
if(staging.policyId!==policy.policyId)throw new Error('GRAHAM_RESEARCH_COMPLETION_POLICY_ID_MISMATCH');
if(!policy.appliesToTaskKeys.includes(staging.taskKey))throw new Error(`GRAHAM_RESEARCH_COMPLETION_TASK_NOT_COVERED:${staging.taskKey}`);
if(Number(staging.season)!==Number(active.season)||Number(staging.week)!==Number(active.week))throw new Error('GRAHAM_RESEARCH_COMPLETION_ACTIVE_WEEK_MISMATCH');

const expectedLedgerPath=`data/walters/nfl/${Number(active.season)}/week-${padWeek(active.week)}-research-ledger.json`;
if(staging.ledgerPath!==expectedLedgerPath)throw new Error(`GRAHAM_RESEARCH_COMPLETION_LEDGER_PATH_MISMATCH:${staging.ledgerPath}:${expectedLedgerPath}`);
if(!fixturePath&&ledgerPathForReceipt!==expectedLedgerPath)throw new Error(`GRAHAM_RESEARCH_COMPLETION_SUPPLIED_LEDGER_MISMATCH:${ledgerPathForReceipt}:${expectedLedgerPath}`);
if(Number(ledger?.season)!==Number(active.season)||Number(ledger?.week)!==Number(active.week)||ledger?.state!=='ACTIVE')throw new Error('GRAHAM_RESEARCH_COMPLETION_LEDGER_WEEK_INVALID');

for(const field of policy.completionStaging.requiredFields){
  if(staging[field]===undefined||staging[field]===null||staging[field]==='')throw new Error(`GRAHAM_RESEARCH_COMPLETION_STAGING_FIELD_MISSING:${field}`);
}
if(Number.isNaN(Date.parse(staging.submittedAt)))throw new Error('GRAHAM_RESEARCH_COMPLETION_SUBMITTED_AT_INVALID');
if(!policy.researchSweepRule.allowedCompletionResults.includes(staging.expectedCompletionResult))throw new Error('GRAHAM_RESEARCH_COMPLETION_EXPECTED_RESULT_INVALID');

const slug=policy.taskSlugByKey[staging.taskKey];
const prefix=`graham-${slug}-${Number(active.season)}-w${padWeek(active.week)}-`;
if(typeof staging.runEventId!=='string'||!staging.runEventId.startsWith(prefix)||staging.runEventId.length<=prefix.length)throw new Error(`GRAHAM_RESEARCH_COMPLETION_RUN_EVENT_ID_INVALID:${staging.runEventId}`);

const sweeps=Array.isArray(ledger.sweeps)?ledger.sweeps:[];
const matches=sweeps.filter(s=>s?.runEventId===staging.runEventId);
if(matches.length!==1)throw new Error(`GRAHAM_RESEARCH_COMPLETION_RUN_EVENT_MATCH_COUNT:${matches.length}`);
const sweep=matches[0];

for(const field of policy.researchSweepRule.requiredExistingFields){
  if(sweep[field]===undefined||sweep[field]===null)throw new Error(`GRAHAM_RESEARCH_COMPLETION_SWEEP_FIELD_MISSING:${field}`);
}
for(const field of policy.researchSweepRule.requiredAdditiveFields){
  if(sweep[field]===undefined||sweep[field]===null||sweep[field]==='')throw new Error(`GRAHAM_RESEARCH_COMPLETION_ADDITIVE_FIELD_MISSING:${field}`);
}
for(const field of ['sourcesChecked','teamFindings','ratingChanges','matchupChanges']){
  if(!Array.isArray(sweep[field]))throw new Error(`GRAHAM_RESEARCH_COMPLETION_SWEEP_ARRAY_INVALID:${field}`);
}
if(typeof sweep.espnFpiCapture!=='object'||Array.isArray(sweep.espnFpiCapture))throw new Error('GRAHAM_RESEARCH_COMPLETION_FPI_CAPTURE_INVALID');
if(typeof sweep.summary!=='object'||Array.isArray(sweep.summary))throw new Error('GRAHAM_RESEARCH_COMPLETION_SUMMARY_INVALID');
if(Number.isNaN(Date.parse(sweep.startedAt))||Number.isNaN(Date.parse(sweep.completedAt)))throw new Error('GRAHAM_RESEARCH_COMPLETION_SWEEP_TIME_INVALID');
if(sweep.sourceTaskKey!==staging.taskKey)throw new Error(`GRAHAM_RESEARCH_COMPLETION_TASK_KEY_MISMATCH:${sweep.sourceTaskKey}:${staging.taskKey}`);
if(sweep.completionResult!==staging.expectedCompletionResult)throw new Error(`GRAHAM_RESEARCH_COMPLETION_RESULT_MISMATCH:${sweep.completionResult}:${staging.expectedCompletionResult}`);
if(!policy.researchSweepRule.allowedCompletionResults.includes(sweep.completionResult))throw new Error('GRAHAM_RESEARCH_COMPLETION_SWEEP_RESULT_INVALID');
if(policy.researchSweepRule.marketViewedMustBeFalse&&sweep.summary.marketViewed!==false)throw new Error('GRAHAM_RESEARCH_COMPLETION_MARKET_ISOLATION_NOT_PROVEN');

if(sweep.completionResult==='NO_MATERIAL_CHANGE'){
  if(sweep.ratingChanges.length!==0||sweep.matchupChanges.length!==0)throw new Error('GRAHAM_RESEARCH_COMPLETION_NO_CHANGE_HAS_NUMERIC_CHANGES');
}

const ledgerText=JSON.stringify(ledger);
const receipt={
  schema:1,
  state:'VERIFIED',
  policyId:policy.policyId,
  verifiedAt:new Date().toISOString(),
  runEventId:staging.runEventId,
  taskKey:staging.taskKey,
  season:Number(active.season),
  week:Number(active.week),
  ledgerPath:expectedLedgerPath,
  ledgerId:ledger.ledgerId||null,
  ledgerUpdatedAt:ledger.updatedAt||null,
  ledgerContentSha256:sha256(ledgerText),
  sweepSequence:sweep.sequence,
  sweepType:sweep.type,
  sweepCompletedAt:sweep.completedAt,
  completionResult:sweep.completionResult,
  marketViewed:false
};

if(receiptOut){
  const out=path.resolve(ROOT,receiptOut);
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(receipt,null,2)+'\n');
}
console.log(`GRAHAM RESEARCH COMPLETION: PASS // ${receipt.runEventId} // ${receipt.completionResult}`);
