#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
const W=String(ACTIVE.week).padStart(2,'0');
const p=(x)=>path.join(ROOT,x);
const CONTRACT=p('data/walters/nfl/matchup-stage3/m3-acceptance-contract-v1.json');
const OUT=p(`data/walters/nfl/matchup-stage3/week-${W}-acceptance-result.json`);
const CURRENT=p('data/walters/nfl/matchup-stage3/stage3-current.json');
const protectedFiles={
  currentNumbers:ACTIVE.absolutePaths.currentNumbers,
  personnelLedger:ACTIVE.absolutePaths.personnelLedger,
  powerRatings:p('data/walters/nfl-power-ratings-ledger.json'),
  playerValueRegistry:p('data/walters/nfl/player-values/player-values-2026-v1.json')
};
const deps=[
  'data/walters/nfl/matchup-calibration-v1.json',
  'data/walters/nfl/committee-replacement-calibration-v1.json',
  'data/walters/nfl/committee-replacement-calibration-v2.json',
  'data/walters/nfl/multirole-replacement-calibration-v1.json'
].map(p);

const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const hashes=()=>Object.fromEntries(Object.entries(protectedFiles).map(([k,f])=>[k,hash(f)]));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const eq=(a,b,t=.0001)=>num(a)!==null&&num(b)!==null&&Math.abs(Number(a)-Number(b))<=t;
const fail=m=>{throw new Error(`M3 ACCEPTANCE FAILED: ${m}`)};
const shadowBoundaryOk=r=>{
  if(r.productionAuthority!==false||r.liveBoardMutationAllowed!==false||r.marketViewed!==false)return false;
  if(r.liveBoardChanged===true)return false;
  if(Array.isArray(r.cases)&&r.cases.some(c=>c.liveBoardChanged!==false))return false;
  return true;
};

for(const f of [CONTRACT,...deps,...Object.values(protectedFiles)])if(!fs.existsSync(f))fail(`missing ${path.relative(ROOT,f)}`);
const contract=read(CONTRACT);
if(contract.stage!=='M3'||contract.state!=='LOCKED_ACCEPTANCE_TEST'||contract.productionAuthority!==false||contract.liveBoardMutationAllowed!==false||contract.marketViewed!==false)fail('contract boundary invalid');
if(Number(contract.season)!==ACTIVE.season)fail('contract season mismatch');
for(const f of deps){const d=read(f);if(d.productionAuthority!==false||d.liveBoardMutationAllowed!==false||d.marketViewed!==false)fail(`dependency boundary invalid: ${path.relative(ROOT,f)}`)}

const before=hashes();
const archetypes=contract.shadowArchetypes||[];
if(archetypes.length!==4)fail('four M2 archetypes required');
const R={};
for(const a of archetypes){
  const f=p(a.resultPath);if(!fs.existsSync(f))fail(`missing ${a.resultPath}`);
  const r=read(f);if(Number(r.season)!==ACTIVE.season||Number(r.week)!==ACTIVE.week)fail(`cross-week ${a.id}`);
  if(!shadowBoundaryOk(r))fail(`shadow boundary changed for ${a.id}`);
  R[a.id]=r;
}

const fixtureKeys=['currentNumbers','personnelLedger','powerRatings','playerValueRegistry'];
for(const k of fixtureKeys){
  const vals=archetypes.map(a=>R[a.id].protectedArtifactSha256?.[k]);
  if(vals.some(v=>!v)||new Set(vals).size!==1)fail(`shadow fixture mismatch ${k}`);
}

const decisions=[];
const b=(R.EXACT_ONE_FOR_ONE_MATCHUP_ZERO.cases||[]).find(c=>c.caseKey==='2026-W01-LAC-Tyler-Biadasz');
if(!b||!eq(b.normalTeamLoss,.7)||!eq(b.approvedMatchupIncrement,0)||!eq(b.shadowAdjustedTeamLoss,.7)||!eq(b.shadowGrahamExactFairHome,b.liveGrahamExactFairHome))fail('Biadasz acceptance premise failed');
decisions.push({archetype:'EXACT_ONE_FOR_ONE_MATCHUP_ZERO',caseKey:b.caseKey,decision:'ACCEPT_EXACT_ONE_FOR_ONE',m4Candidate:true,exactFairResolved:true,matchupIncrement:0,productionGuard:'Do not reapply a base personnel loss already present on the live board.'});

const j=R.RANGE_COMMITTEE_DISPLAY_INVARIANT;
if(j.caseKey!=='2026-W01-GB-Josh-Jacobs'||j.exactFairResolved!==false||j.shadowGrahamDisplayHomeEnvelope?.invariant!==true||!eq(j.approvedMatchupIncrementEnvelope?.min,0)||!eq(j.approvedMatchupIncrementEnvelope?.max,0))fail('Jacobs acceptance premise failed');
decisions.push({archetype:'RANGE_COMMITTEE_DISPLAY_INVARIANT',caseKey:j.caseKey,decision:'BLOCK_EXACT_FAIR_UNRESOLVED',m4Candidate:false,exactFairResolved:false,displayResolved:true,productionGuard:'Display invariance cannot substitute for the exact internal Graham fair.'});

const pr=R.VALUE_INVARIANT_COMMITTEE_EXACT;
if(pr.caseKey!=='2026-W01-SF-Ricky-Pearsall'||pr.committeeValueInvariant!==true||pr.exactFairResolvedInShadow!==true||!eq(pr.effectiveReplacementValue,.5)||!eq(pr.teamLoss,.4)||pr.receiverClusterApplied!==false||pr.receiverClusterGuard!=='PASS_SINGLE_RECEIVER_LOSS_NO_CLUSTER_MULTIPLIER'||!Array.isArray(pr.excludedBaselineContributors)||!pr.excludedBaselineContributors.some(x=>x.player==='Mike Evans')||!eq(pr.approvedMatchupIncrement,0))fail('Pearsall acceptance premise failed');
decisions.push({archetype:'VALUE_INVARIANT_COMMITTEE_EXACT',caseKey:pr.caseKey,decision:'ACCEPT_VALUE_INVARIANT_COMMITTEE',m4Candidate:true,exactFairResolved:true,effectiveReplacementValue:pr.effectiveReplacementValue,teamLoss:pr.teamLoss,candidatePointsToHomeSpread:pr.personnelPointsToHomeSpread,shadowDisplayMove:pr.shadowDisplayMove,matchupIncrement:0,productionGuard:'Reverify candidate set, identical locked values, baseline exclusions and cluster guard at every application.'});

const w=R.MULTIROLE_INTERVAL_DISPLAY_NOT_INVARIANT;
if(w.caseKey!=='2026-W01-ATL-Jalon-Walker'||w.exactFairResolvedInShadow!==false||w.displayResolvedInShadow!==false||w.shadowGrahamDisplayHomeEnvelope?.invariant!==false||w.failClosedCode!=='FAIL_CLOSED_MULTIROLE_DISPLAY_NOT_INVARIANT'||!eq(w.approvedMatchupIncrementEnvelope?.min,0)||!eq(w.approvedMatchupIncrementEnvelope?.max,0))fail('Walker acceptance premise failed');
decisions.push({archetype:'MULTIROLE_INTERVAL_DISPLAY_NOT_INVARIANT',caseKey:w.caseKey,decision:'BLOCK_MULTIROLE_UNRESOLVED',m4Candidate:false,exactFairResolved:false,displayResolved:false,productionGuard:'Do not choose a midpoint or endpoint while role shares, vacated-role backfills or concurrent absences remain unresolved.'});

const matchupNums=[b.approvedMatchupIncrement,j.approvedMatchupIncrementEnvelope?.min,j.approvedMatchupIncrementEnvelope?.max,pr.approvedMatchupIncrement,w.approvedMatchupIncrementEnvelope?.min,w.approvedMatchupIncrementEnvelope?.max].map(num).filter(v=>v!==null&&Math.abs(v)>.0001);
if(matchupNums.length)fail('unexpected nonzero opponent matchup sample');
const accepted=decisions.filter(d=>d.m4Candidate),blocked=decisions.filter(d=>!d.m4Candidate);
if(accepted.length!==2||blocked.length!==2)fail('expected 2 accepted and 2 blocked archetypes');

const m4Scope={exactOneForOne:true,valueInvariantCommittee:true,rangeOnlyCommittee:false,multiroleInterval:false,zeroMatchupReview:true,nonzeroOpponentMatchupIncrement:false,note:'Automated nonzero opponent-specific matchup increments remain disabled until a separate nonzero shadow calibration passes.'};
const after=hashes();if(JSON.stringify(before)!==JSON.stringify(after))fail('protected live artifacts changed during M3');
const now=new Date().toISOString();
const result={schema:1,resultId:`walters-matchup-m3-${ACTIVE.season}-week-${W}-acceptance-v1`,stage:'M3',state:contract.m3PassState,season:ACTIVE.season,week:ACTIVE.week,timezone:'America/Vancouver',generatedAt:now,acceptanceId:contract.acceptanceId,productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,m4ActivationCandidate:true,m4Scope,summary:{archetypesTested:4,acceptedArchetypes:2,blockedArchetypes:2,nonzeroOpponentMatchupSamples:0,liveMoves:0},decisions,m5CatchupPolicy:'After M4 activation, rebuild the active-week baseline from current football evidence under the accepted rules. Do not copy stale shadow numbers directly into production.',shadowFixtureSha256:R.EXACT_ONE_FOR_ONE_MATCHUP_ZERO.protectedArtifactSha256,currentProtectedArtifactSha256:after,conclusion:'M3 passes a scoped M4 candidate: exact one-for-one and exact value-invariant committee logic may advance; range-only and unresolved multi-role cases remain blocked; automated nonzero opponent-specific matchup increments remain disabled pending a successful nonzero shadow calibration.'};
fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');
const current={schema:1,stage:'M3',state:result.state,season:ACTIVE.season,week:ACTIVE.week,updatedAt:now,acceptanceId:contract.acceptanceId,productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,m4ActivationCandidate:true,m4Scope,resultPath:path.relative(ROOT,OUT),summary:result.summary,nextGate:['Build M4 production activation only for the accepted scoped classes.','Keep range-only committees and unresolved multi-role cases fail closed.','Keep automated nonzero opponent-specific matchup increments disabled until a separate nonzero shadow case passes acceptance.','After M4, perform the one-time active-week catch-up rebuild from current football evidence rather than copying shadow outputs.']};
fs.writeFileSync(CURRENT,JSON.stringify(current,null,2)+'\n');
const check=read(OUT);if(check.state!==contract.m3PassState||check.m4ActivationCandidate!==true||check.summary.liveMoves!==0)fail('read-back failed');
console.log('WALTERS MATCHUP M3: PASS // 4 ARCHETYPES // 2 ACCEPTED // 2 BLOCKED // NONZERO MATCHUP AUTO AUTHORITY OFF // 0 LIVE MOVES');
