#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const STAGING=path.join(ROOT,process.argv[2]||'data/walters/nfl/personnel-staging.json');
const PROD=path.join(ROOT,'data/walters/nfl/personnel-production-current.json');
const ACTIVE=path.join(ROOT,'data/walters/nfl/active-week.json');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));

const staging=read(STAGING);
const prod=read(PROD);
const active=read(ACTIVE);
const gate=prod.materialPersonnelClosureGate;
if(!gate||gate.state!=='OPERATIONAL')throw new Error('MATERIAL_PERSONNEL_CLOSURE_GATE_NOT_OPERATIONAL');
if(Number(staging.season)!==Number(active.season)||Number(staging.week)!==Number(active.week))throw new Error('MATERIAL_PERSONNEL_CLOSURE_ACTIVE_WEEK_MISMATCH');

const week=String(Number(staging.week)).padStart(2,'0');
const ledgerPath=path.join(ROOT,`data/walters/nfl/${staging.season}/week-${week}-personnel-ledger.json`);
if(fs.existsSync(ledgerPath)){
  const ledger=read(ledgerPath);
  if((ledger.processedBatchIds||[]).includes(staging.batchId)){
    console.log(`GRAHAM MATERIAL PERSONNEL CLOSURE: IDEMPOTENT SKIP // ${staging.batchId}`);
    process.exit(0);
  }
}

const materialStatuses=new Set(gate.appliesToAvailability||[]);
const classifications=new Set(gate.replacementClassifications||[]);
const conclusions=new Set(gate.conclusions||[]);
const requiredBooleanFields=[
  'availabilityVerified',
  'rosterChecked',
  'roleEvidenceChecked',
  'replacementSearchCompleted',
  'unavailablePlayerValueChecked',
  'candidateValuesChecked',
  'baselineDoubleCountReviewed',
  'm4CommitteeEligibilityReviewed'
];

let reviewed=0;
for(const c of staging.cases||[]){
  const status=String(c.availabilityStatus||'').toUpperCase();
  if(!materialStatuses.has(status))continue;
  reviewed++;
  const audit=c.closureReview;
  if(!audit||typeof audit!=='object')throw new Error(`MATERIAL_PERSONNEL_CLOSURE_REVIEW_MISSING:${c.personnelEventId||c.player}`);
  for(const key of requiredBooleanFields){
    if(audit[key]!==true)throw new Error(`MATERIAL_PERSONNEL_CLOSURE_${key.toUpperCase()}_NOT_TRUE:${c.personnelEventId||c.player}`);
  }
  if(!Array.isArray(audit.replacementCandidatesConsidered))throw new Error(`MATERIAL_PERSONNEL_CLOSURE_CANDIDATE_SET_MISSING:${c.personnelEventId||c.player}`);
  if(!classifications.has(audit.replacementClassification))throw new Error(`MATERIAL_PERSONNEL_CLOSURE_CLASSIFICATION_INVALID:${c.personnelEventId||c.player}`);
  if(!conclusions.has(audit.conclusion))throw new Error(`MATERIAL_PERSONNEL_CLOSURE_CONCLUSION_INVALID:${c.personnelEventId||c.player}`);

  if(c.resolutionStatus==='RESOLVED_ONE_FOR_ONE'){
    if(audit.replacementClassification!=='ONE_FOR_ONE'||audit.conclusion!=='RESOLVED_NUMERIC')throw new Error(`MATERIAL_PERSONNEL_CLOSURE_ONE_FOR_ONE_MISMATCH:${c.personnelEventId||c.player}`);
    if(!c.replacementPlayer)throw new Error(`MATERIAL_PERSONNEL_CLOSURE_REPLACEMENT_PLAYER_MISSING:${c.personnelEventId||c.player}`);
    if(!audit.replacementCandidatesConsidered.includes(c.replacementPlayer))throw new Error(`MATERIAL_PERSONNEL_CLOSURE_REPLACEMENT_NOT_IN_CANDIDATE_SET:${c.personnelEventId||c.player}`);
  } else {
    if(audit.conclusion==='RESOLVED_NUMERIC')throw new Error(`MATERIAL_PERSONNEL_CLOSURE_UNRESOLVED_MARKED_NUMERIC:${c.personnelEventId||c.player}`);
    if(!c.failClosedCode&&audit.conclusion==='FAIL_CLOSED_AFTER_FULL_REVIEW')throw new Error(`MATERIAL_PERSONNEL_CLOSURE_FAIL_CODE_MISSING:${c.personnelEventId||c.player}`);
  }
}

console.log(`GRAHAM MATERIAL PERSONNEL CLOSURE: PASS // ${staging.batchId} // ${reviewed} MATERIAL CASES`);
