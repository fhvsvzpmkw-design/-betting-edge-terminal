#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolveGrahamActiveWeek, grahamWeekPaths} from './graham-active-week.mjs';

const ROOT=process.cwd();
const PROD='data/walters/nfl/personnel-production-current.json';
const ACCESS='data/walters/nfl/player-values/player-values-access-v1.json';
const REGISTRY='data/walters/nfl/player-values/player-values-2026-v1.json';
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const nameKey=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const hasText=s=>typeof s==='string'&&s.trim().length>0;
const requiredBooleans=['availabilityVerified','rosterChecked','roleEvidenceChecked','replacementSearchCompleted','unavailablePlayerValueChecked','candidateValuesChecked','baselineDoubleCountReviewed','m4CommitteeEligibilityReviewed'];
const descriptor=v=>typeof v==='string'?{player:v}:({player:v?.player||v?.name,eaPlayerId:v?.eaPlayerId||v?.playerEaId});

export function collectCandidates(c){
  const list=[...(c.closureReview?.replacementCandidatesConsidered||[]),...(c.replacementCandidates||[]),...(c.committeeCandidates||[]),...(c.committee||[])].map(descriptor);
  if(c.replacementPlayer)list.push({player:c.replacementPlayer,eaPlayerId:c.replacementEaId});
  const out=new Map();
  for(const item of list){
    if(!hasText(item.player))continue;
    const key=nameKey(item.player),prior=out.get(key);
    if(prior?.eaPlayerId&&item.eaPlayerId&&String(prior.eaPlayerId)!==String(item.eaPlayerId))throw new Error(`CANDIDATE_ID_CONFLICT:${item.player}`);
    out.set(key,{...prior,...item,eaPlayerId:item.eaPlayerId||prior?.eaPlayerId});
  }
  return [...out.values()];
}

export function lookupPlayer(registry,name,id){
  const players=registry.players||[];
  const matches=id?players.filter(p=>String(p.eaPlayerId)===String(id)):players.filter(p=>nameKey(p.player)===nameKey(name));
  const base={requestedPlayer:name,requestedEaPlayerId:id==null?null:String(id)};
  if(matches.length!==1)return {...base,status:matches.length?'AMBIGUOUS':'NOT_FOUND',matches:matches.map(p=>({player:p.player,eaPlayerId:String(p.eaPlayerId)}))};
  const p=matches[0];
  if(nameKey(name)!==nameKey(p.player))return {...base,status:'IDENTITY_CONFLICT',matchedPlayer:p.player,matchedEaPlayerId:String(p.eaPlayerId)};
  const valid=p.valueStatus==='CALIBRATED'&&typeof p.waltersPoints==='number'&&Number.isFinite(p.waltersPoints);
  return {...base,status:valid?'FOUND':'VALUE_UNAVAILABLE',player:p.player,eaPlayerId:String(p.eaPlayerId),frozenTeamAbbr:p.teamAbbr,position:p.position,maddenOvr:p.maddenOvr,waltersPoints:valid?p.waltersPoints:null,valueStatus:p.valueStatus,rankingCapturedAt:p.rankingCapturedAt,calibrationId:p.calibrationId};
}

export function inspectCase(c,gate,registry,provenance={}){
  const audit=c.closureReview||{},errors=[];
  if(!c.closureReview)errors.push('REVIEW_MISSING');
  for(const key of requiredBooleans)if(audit[key]!==true)errors.push(`${key.toUpperCase()}_NOT_TRUE`);
  const considered=Array.isArray(audit.replacementCandidatesConsidered)?audit.replacementCandidatesConsidered:[];
  if(!Array.isArray(audit.replacementCandidatesConsidered))errors.push('CANDIDATE_SET_MISSING');
  if(considered.some(x=>!hasText(descriptor(x).player)))errors.push('CANDIDATE_NAME_INVALID');
  let candidates=[];
  try{candidates=collectCandidates(c);}catch(err){errors.push(err.message);}
  const declared=new Set(considered.map(x=>nameKey(descriptor(x).player)));
  for(const p of candidates)if(!declared.has(nameKey(p.player)))errors.push(`CANDIDATE_NOT_REVIEWED:${p.player}`);
  if(!(gate.replacementClassifications||[]).includes(audit.replacementClassification))errors.push('CLASSIFICATION_INVALID');
  if(!(gate.conclusions||[]).includes(audit.conclusion))errors.push('CONCLUSION_INVALID');
  if(!Array.isArray(c.sourceRefs)||!c.sourceRefs.length)errors.push('SOURCE_REFS_MISSING');
  if(c.resolutionStatus==='RESOLVED_ONE_FOR_ONE'){
    if(audit.replacementClassification!=='ONE_FOR_ONE'||audit.conclusion!=='RESOLVED_NUMERIC')errors.push('ONE_FOR_ONE_MISMATCH');
    if(!hasText(c.replacementPlayer))errors.push('REPLACEMENT_PLAYER_MISSING');
  }else{
    if(audit.conclusion==='RESOLVED_NUMERIC')errors.push('UNRESOLVED_MARKED_NUMERIC');
    if(!c.failClosedCode&&audit.conclusion==='FAIL_CLOSED_AFTER_FULL_REVIEW')errors.push('FAIL_CODE_MISSING');
  }
  if(!candidates.length&&!(audit.replacementClassification==='UNRESOLVED_AFTER_COMPLETE_SEARCH'&&hasText(audit.noReplacementCandidatesReason)&&Array.isArray(audit.replacementSearchSourceRefs)&&audit.replacementSearchSourceRefs.some(hasText)))errors.push('EMPTY_CANDIDATE_SET_REQUIRES_DOCUMENTED_SEARCH');
  const unavailablePlayer=lookupPlayer(registry,c.player,c.playerEaId);
  const replacements=candidates.map(p=>lookupPlayer(registry,p.player,p.eaPlayerId));
  const gaps=[unavailablePlayer,...replacements].filter(p=>p.status!=='FOUND').map(p=>({player:p.requestedPlayer,status:p.status}));
  const roleResolved=c.resolutionStatus==='RESOLVED_ONE_FOR_ONE';
  const state=errors.length?'RESEARCH_INCOMPLETE':gaps.length?'LOOKUP_GAP':roleResolved?'READY_FOR_GOVERNED_CALCULATOR':'ROLE_OR_COMMITTEE_UNRESOLVED';
  return {schema:1,state,errors,lookupGaps:gaps,unavailablePlayer,replacements,...provenance,marketViewed:false,numericAuthority:false};
}

function loadRegistry(){
  const access=read(ACCESS),bytes=fs.readFileSync(path.join(ROOT,REGISTRY));
  const blob=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const rawSha=crypto.createHash('sha256').update(bytes).digest('hex');
  if(access.state!=='ACTIVE'||access.marketViewed!==false||access.sourceRegistryPath!==REGISTRY||blob!==access.sourceRegistryGitBlobSha||rawSha!==access.sourceRegistryRawSha256)throw new Error('MATERIAL_PERSONNEL_CLOSURE_REGISTRY_BINDING_FAILED');
  return {registry:JSON.parse(bytes.toString('utf8')),provenance:{checkedAt:new Date().toISOString(),sourceRegistryPath:REGISTRY,sourceRegistryGitBlobSha:blob,sourceRegistryRawSha256:rawSha}};
}

function auditWeek(active,gate,registry,provenance,prior){
  const week=prior?active.week-1:active.week;
  if(week<1){console.log('GRAHAM PERSONNEL LOOKUP AUDIT: NOT_APPLICABLE');return;}
  const paths=grahamWeekPaths(active.season,week).relative;
  if(!fs.existsSync(path.join(ROOT,paths.personnelLedger))){console.log(JSON.stringify({state:'PERSONNEL_LEDGER_ABSENT',season:active.season,week,numericAuthority:false}));return;}
  const ledger=read(paths.personnelLedger);
  if(ledger.season!==active.season||ledger.week!==week||ledger.marketViewed!==false)throw new Error('PERSONNEL_AUDIT_LEDGER_IDENTITY_INVALID');
  const research=fs.existsSync(path.join(ROOT,paths.researchLedger))?read(paths.researchLedger):{sweeps:[]};
  const rows=[];
  for(const c of Object.values(ledger.currentCases||{})){
    if(c.valueStatus==='NUMERIC_ELIGIBLE')continue;
    const evidence=inspectCase(c,gate,registry,provenance);
    const candidates=evidence.replacements.map(p=>p.requestedPlayer);
    const leads=(research.sweeps||[]).filter(s=>{const text=JSON.stringify(s);return text.includes(c.player)&&candidates.some(n=>text.includes(n));}).map(s=>s.runEventId||s.auditId||s.batchId||`sweep-sequence-${s.sequence}`);
    rows.push({caseKey:c.caseKey,player:c.player,gameKey:c.gameKey,storedClosureReviewPresent:!!c.closureReview,storedLookupEvidencePresent:!!c.closureReview?.lookupEvidence,researchLeadIds:leads,evidence});
  }
  console.log(JSON.stringify({schema:1,state:'READ_ONLY_LOOKUP_AUDIT',season:active.season,week,checkedAt:provenance.checkedAt,unresolvedCases:rows.length,researchIncomplete:rows.filter(r=>r.evidence.state==='RESEARCH_INCOMPLETE').length,casesWithLookupGaps:rows.filter(r=>r.evidence.lookupGaps.length).length,casesWithNoNamedCandidates:rows.filter(r=>!r.evidence.replacements.length).length,lookupCount:rows.reduce((n,r)=>n+1+r.evidence.replacements.length,0),rows,marketViewed:false,numericAuthority:false,note:'Lookups were performed now. Research lead IDs are navigation aids, not proof of completed research or game-day replacement roles. No historic event, injury loss, rating or fair was changed.'},null,2));
}

function selfTest(){
  const gate={replacementClassifications:['ONE_FOR_ONE','COMMITTEE','MULTIROLE','UNRESOLVED_AFTER_COMPLETE_SEARCH'],conclusions:['RESOLVED_NUMERIC','MATCHUP_M4_CANDIDATE','FAIL_CLOSED_AFTER_FULL_REVIEW']};
  const registry={players:[{player:'Starter',eaPlayerId:'1',waltersPoints:0.9,valueStatus:'CALIBRATED'},{player:'Replacement',eaPlayerId:'2',waltersPoints:0.2,valueStatus:'CALIBRATED'},{player:'Other',eaPlayerId:'3',waltersPoints:0.2,valueStatus:'CALIBRATED'},{player:'No value',eaPlayerId:'4',waltersPoints:null,valueStatus:'UNCALIBRATED'}]};
  const good={player:'Starter',playerEaId:'1',replacementPlayer:'Replacement',replacementEaId:'2',resolutionStatus:'RESOLVED_ONE_FOR_ONE',sourceRefs:['official-role-source'],closureReview:{...Object.fromEntries(requiredBooleans.map(k=>[k,true])),replacementCandidatesConsidered:['Replacement'],replacementClassification:'ONE_FOR_ONE',conclusion:'RESOLVED_NUMERIC'}};
  const check=c=>inspectCase(c,gate,registry),copy=()=>structuredClone(good);let count=0;
  function test(name,fn){fn();count++;console.log(`PASS ${name}`);}
  test('valid selected replacement',()=>assert.equal(check(good).state,'READY_FOR_GOVERNED_CALCULATOR'));
  test('exact registry values, not claimed points',()=>{const c=copy();c.replacementWaltersPoints=99;assert.equal(check(c).replacements[0].waltersPoints,0.2);});
  test('missing review is incomplete',()=>{const c=copy();delete c.closureReview;assert.equal(check(c).state,'RESEARCH_INCOMPLETE');});
  test('false lookup flag is incomplete',()=>{const c=copy();c.closureReview.candidateValuesChecked=false;assert.equal(check(c).state,'RESEARCH_INCOMPLETE');});
  test('all named candidates checked',()=>{const c=copy();c.replacementCandidates=['Replacement','Other'];assert.equal(check(c).replacements.length,2);assert.equal(check(c).state,'RESEARCH_INCOMPLETE');});
  test('consistent duplicates deduplicated',()=>{const c=copy();c.replacementCandidates=['Replacement'];assert.equal(check(c).replacements.length,1);});
  test('identity conflict not numeric',()=>{const c=copy();c.replacementEaId='1';assert.equal(check(c).state,'LOOKUP_GAP');});
  test('missing value is not zero',()=>assert.equal(lookupPlayer(registry,'No value','4').waltersPoints,null));
  test('missing player explicit',()=>assert.equal(lookupPlayer(registry,'Absent').status,'NOT_FOUND'));
  test('ambiguous name explicit',()=>assert.equal(lookupPlayer({players:[...registry.players,registry.players[0]]},'Starter').status,'AMBIGUOUS'));
  test('frozen team does not identify present role',()=>{const c=copy();c.team='NEW';assert.equal(check(c).state,'READY_FOR_GOVERNED_CALCULATOR');});
  test('empty unexplained list not complete',()=>{const c=copy();delete c.replacementPlayer;c.resolutionStatus='UNRESOLVED';c.failClosedCode='REVIEW_REQUIRED';c.closureReview.replacementCandidatesConsidered=[];c.closureReview.replacementClassification='MULTIROLE';c.closureReview.conclusion='FAIL_CLOSED_AFTER_FULL_REVIEW';assert.equal(check(c).state,'RESEARCH_INCOMPLETE');});
  test('documented empty search remains nonnumeric',()=>{const c=copy();delete c.replacementPlayer;c.resolutionStatus='UNRESOLVED';c.failClosedCode='REVIEW_REQUIRED';Object.assign(c.closureReview,{replacementCandidatesConsidered:[],replacementClassification:'UNRESOLVED_AFTER_COMPLETE_SEARCH',conclusion:'FAIL_CLOSED_AFTER_FULL_REVIEW',noReplacementCandidatesReason:'No verified role candidate found after roster and role review',replacementSearchSourceRefs:['official-roster']});assert.equal(check(c).state,'ROLE_OR_COMMITTEE_UNRESOLVED');});
  test('equal values alone cannot approve committee',()=>{const c=copy();delete c.replacementPlayer;c.resolutionStatus='UNRESOLVED_ROLE_COMMITTEE';c.failClosedCode='REVIEW_REQUIRED';Object.assign(c.closureReview,{replacementCandidatesConsidered:['Replacement','Other'],replacementClassification:'COMMITTEE',conclusion:'MATCHUP_M4_CANDIDATE'});assert.equal(check(c).state,'ROLE_OR_COMMITTEE_UNRESOLVED');});
  test('source case immutable',()=>{const before=JSON.stringify(good);check(good);assert.equal(JSON.stringify(good),before);});
  test('conflicting candidate IDs rejected',()=>{const c=copy();c.committee=[{player:'Replacement',eaPlayerId:'3'}];assert.equal(check(c).state,'RESEARCH_INCOMPLETE');assert.ok(check(c).errors.some(e=>e.startsWith('CANDIDATE_ID_CONFLICT')));});
  test('lookup evidence cannot authorize a number',()=>assert.equal(check(good).numericAuthority,false));
  test('case source references required',()=>{const c=copy();c.sourceRefs=[];assert.equal(check(c).state,'RESEARCH_INCOMPLETE');});
  console.log(`GRAHAM MATERIAL PERSONNEL CLOSURE SELF-TEST: PASS // ${count} checks`);
}

function main(){
  const args=process.argv.slice(2);
  if(args.includes('--self-test')){selfTest();return;}
  const active=resolveGrahamActiveWeek({root:ROOT,requireFiles:true}),prod=read(PROD),gate=prod.materialPersonnelClosureGate;
  if(!gate||gate.state!=='OPERATIONAL')throw new Error('MATERIAL_PERSONNEL_CLOSURE_GATE_NOT_OPERATIONAL');
  if(args.includes('--audit')||args.includes('--audit-prior-week')){const {registry,provenance}=loadRegistry();auditWeek(active,gate,registry,provenance,args.includes('--audit-prior-week'));return;}
  const relative=args.find(a=>!a.startsWith('--'))||'data/walters/nfl/personnel-staging.json',staging=read(relative);
  if(staging.schema!==1||staging.state!=='READY'||staging.marketViewed!==false)throw new Error('MATERIAL_PERSONNEL_CLOSURE_INVALID_STAGING');
  if(Number(staging.season)!==active.season||Number(staging.week)!==active.week)throw new Error('MATERIAL_PERSONNEL_CLOSURE_ACTIVE_WEEK_MISMATCH');
  if(fs.existsSync(path.join(ROOT,active.paths.personnelLedger))&&(read(active.paths.personnelLedger).processedBatchIds||[]).includes(staging.batchId)){console.log(`GRAHAM MATERIAL PERSONNEL CLOSURE: IDEMPOTENT SKIP // ${staging.batchId} // not a new review`);return;}
  const {registry,provenance}=loadRegistry();let reviewed=0;const failures=[];
  for(const c of staging.cases||[]){
    if(!(gate.appliesToAvailability||[]).includes(String(c.availabilityStatus||'').toUpperCase()))continue;
    reviewed++;const evidence=inspectCase(c,gate,registry,provenance);
    if(evidence.errors.length)failures.push({caseKey:c.caseKey,player:c.player,errors:evidence.errors});
    else c.closureReview={...c.closureReview,lookupEvidence:evidence};
  }
  if(failures.length)throw new Error(`MATERIAL_PERSONNEL_RESEARCH_INCOMPLETE:${JSON.stringify(failures)}; preserve affected numbers, complete or separately record these cases, and submit unrelated complete cases separately`);
  if(args.includes('--write'))fs.writeFileSync(path.join(ROOT,relative),JSON.stringify(staging,null,2)+'\n');
  console.log(`GRAHAM MATERIAL PERSONNEL CLOSURE: PASS // ${staging.batchId} // ${reviewed} MATERIAL CASES // REGISTRY EVIDENCE ${args.includes('--write')?'ATTACHED FOR DURABLE PERSONNEL EVENTS':'VERIFIED READ ONLY'}`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(err){console.error(err.message);process.exitCode=1;}
}
