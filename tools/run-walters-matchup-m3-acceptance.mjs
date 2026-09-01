#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
const W=String(ACTIVE.week).padStart(2,'0');
const CONTRACT=path.join(ROOT,'data/walters/nfl/matchup-stage3/m3-acceptance-contract-v1.json');
const MATCHUP=path.join(ROOT,'data/walters/nfl/matchup-calibration-v1.json');
const COMMITTEE1=path.join(ROOT,'data/walters/nfl/committee-replacement-calibration-v1.json');
const COMMITTEE2=path.join(ROOT,'data/walters/nfl/committee-replacement-calibration-v2.json');
const MULTIROLE=path.join(ROOT,'data/walters/nfl/multirole-replacement-calibration-v1.json');
const OUT=path.join(ROOT,`data/walters/nfl/matchup-stage3/week-${W}-acceptance-result.json`);
const CURRENT=path.join(ROOT,'data/walters/nfl/matchup-stage3/stage3-current.json');
const NUMBERS=ACTIVE.absolutePaths.currentNumbers;
const PERSONNEL=ACTIVE.absolutePaths.personnelLedger;
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');

function readJson(f){return JSON.parse(fs.readFileSync(f,'utf8'))}
function hashFile(f){return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function fail(msg){throw new Error(`M3 ACCEPTANCE FAILED: ${msg}`)}
function same(a,b,tol=0.0001){return Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=tol}

for(const f of [CONTRACT,MATCHUP,COMMITTEE1,COMMITTEE2,MULTIROLE,NUMBERS,PERSONNEL,POWER,REGISTRY])if(!fs.existsSync(f))fail(`missing ${path.relative(ROOT,f)}`);
const contract=readJson(CONTRACT);
const matchup=readJson(MATCHUP);
const committee1=readJson(COMMITTEE1);
const committee2=readJson(COMMITTEE2);
const multirole=readJson(MULTIROLE);

if(contract.stage!=='M3'||contract.state!=='LOCKED_ACCEPTANCE_TEST'||contract.productionAuthority!==false||contract.liveBoardMutationAllowed!==false||contract.marketViewed!==false)fail('M3 contract boundary invalid');
for(const [name,obj] of [['matchup',matchup],['committee-v1',committee1],['committee-v2',committee2],['multirole',multirole]]){
  if(obj.productionAuthority!==false||obj.liveBoardMutationAllowed!==false||obj.marketViewed!==false)fail(`${name} shadow authority boundary invalid`);
}
if(Number(contract.season)!==ACTIVE.season)fail('contract season does not match active season');

const protectedBefore={
  currentNumbers:hashFile(NUMBERS),
  personnelLedger:hashFile(PERSONNEL),
  powerRatings:hashFile(POWER),
  playerValueRegistry:hashFile(REGISTRY)
};

const archetypes=Array.isArray(contract.shadowArchetypes)?contract.shadowArchetypes:[];
if(archetypes.length!==4)fail(`expected four archetypes, found ${archetypes.length}`);
const results=new Map();
for(const a of archetypes){
  const f=path.join(ROOT,a.resultPath);
  if(!fs.existsSync(f))fail(`missing archetype result ${a.resultPath}`);
  const r=readJson(f);
  if(Number(r.season)!==ACTIVE.season||Number(r.week)!==ACTIVE.week)fail(`cross-week archetype ${a.id}`);
  if(r.productionAuthority!==false||r.liveBoardMutationAllowed!==false||r.marketViewed!==false||r.liveBoardChanged!==false)fail(`shadow boundary changed for ${a.id}`);
  results.set(a.id,r);
}

// All four M2 archetypes must have been produced against the same protected shadow fixture.
const hashKeys=['currentNumbers','personnelLedger','powerRatings','playerValueRegistry'];
const fixtureHashes=archetypes.map(a=>results.get(a.id).protectedArtifactSha256);
for(const key of hashKeys){
  const vals=fixtureHashes.map(h=>h?.[key]);
  if(vals.some(v=>!v)||new Set(vals).size!==1)fail(`M2 shadow fixture hash mismatch for ${key}`);
}

const decisions=[];

const biadasz=results.get('EXACT_ONE_FOR_ONE_MATCHUP_ZERO');
const bcase=(biadasz.cases||[]).find(c=>c.caseKey==='2026-W01-LAC-Tyler-Biadasz');
if(!bcase)fail('Biadasz case missing');
if(!same(bcase.normalTeamLoss,0.7)||!same(bcase.approvedMatchupIncrement,0)||!same(bcase.shadowAdjustedTeamLoss,0.7))fail('Biadasz exact arithmetic changed');
if(!same(bcase.shadowGrahamExactFairHome,bcase.liveGrahamExactFairHome))fail('Biadasz zero-matchup review changed exact fair');
decisions.push({
  archetype:'EXACT_ONE_FOR_ONE_MATCHUP_ZERO',caseKey:bcase.caseKey,
  decision:'ACCEPT_EXACT_ONE_FOR_ONE',m4Candidate:true,
  exactPersonnelValueResolved:true,exactFairResolved:true,displayResolved:true,
  matchupIncrement:0,
  productionGuard:'Base personnel loss may be used only once. Because this loss is already on the live Graham board, M4 must not reapply it; only a separately accepted future matchup delta could be new.',
  reason:'Resolved one-for-one personnel arithmetic is exact and the opponent-specific review validly resolves to zero additional points.'
});

const jacobs=results.get('RANGE_COMMITTEE_DISPLAY_INVARIANT');
if(jacobs.caseKey!=='2026-W01-GB-Josh-Jacobs')fail('Jacobs identity changed');
if(jacobs.exactFairResolved!==false||jacobs.shadowGrahamDisplayHomeEnvelope?.invariant!==true)fail('Jacobs acceptance premise changed');
if(!same(jacobs.approvedMatchupIncrementEnvelope?.min,0)||!same(jacobs.approvedMatchupIncrementEnvelope?.max,0))fail('Jacobs matchup increment is no longer zero');
decisions.push({
  archetype:'RANGE_COMMITTEE_DISPLAY_INVARIANT',caseKey:jacobs.caseKey,
  decision:'BLOCK_EXACT_FAIR_UNRESOLVED',m4Candidate:false,
  exactPersonnelValueResolved:false,exactFairResolved:false,displayResolved:true,
  matchupIncrementEnvelope:jacobs.approvedMatchupIncrementEnvelope,
  productionGuard:'A single rounded display bucket cannot substitute for the exact internal Graham fair.',
  reason:'The replacement/workload interval remains unresolved even though every valid shadow endpoint displays PICK.'
});

const pearsall=results.get('VALUE_INVARIANT_COMMITTEE_EXACT');
if(pearsall.caseKey!=='2026-W01-SF-Ricky-Pearsall')fail('Pearsall identity changed');
if(pearsall.committeeValueInvariant!==true||pearsall.exactFairResolvedInShadow!==true)fail('Pearsall exact committee premise changed');
if(!same(pearsall.effectiveReplacementValue,0.5)||!same(pearsall.teamLoss,0.4))fail('Pearsall committee arithmetic changed');
if(pearsall.receiverClusterApplied!==false||pearsall.receiverClusterGuard!=='PASS_SINGLE_RECEIVER_LOSS_NO_CLUSTER_MULTIPLIER')fail('Pearsall receiver cluster guard failed');
if(!Array.isArray(pearsall.excludedBaselineContributors)||!pearsall.excludedBaselineContributors.some(p=>p.player==='Mike Evans'))fail('Pearsall baseline double-count exclusion missing');
if(!same(pearsall.approvedMatchupIncrement,0))fail('Pearsall opponent matchup increment is no longer zero');
decisions.push({
  archetype:'VALUE_INVARIANT_COMMITTEE_EXACT',caseKey:pearsall.caseKey,
  decision:'ACCEPT_VALUE_INVARIANT_COMMITTEE',m4Candidate:true,
  exactPersonnelValueResolved:true,exactFairResolved:true,displayResolved:true,
  effectiveReplacementValue:pearsall.effectiveReplacementValue,
  teamLoss:pearsall.teamLoss,
  candidatePointsToHomeSpread:pearsall.personnelPointsToHomeSpread,
  shadowDisplayMove:pearsall.shadowDisplayMove,
  matchupIncrement:pearsall.approvedMatchupIncrement,
  productionGuard:'The replacement set must remain verified and value-invariant at application time; baseline contributors and cluster effects must be rechecked before every application.',
  reason:'Unknown workload shares do not affect the exact replacement value because every included replacement is locked at the same Walters value and the baseline/cluster double-count guards pass.'
});

const walker=results.get('MULTIROLE_INTERVAL_DISPLAY_NOT_INVARIANT');
if(walker.caseKey!=='2026-W01-ATL-Jalon-Walker')fail('Walker identity changed');
if(walker.exactFairResolvedInShadow!==false||walker.displayResolvedInShadow!==false||walker.shadowGrahamDisplayHomeEnvelope?.invariant!==false)fail('Walker fail-closed premise changed');
if(walker.failClosedCode!=='FAIL_CLOSED_MULTIROLE_DISPLAY_NOT_INVARIANT')fail('Walker fail-closed code changed');
if(!same(walker.approvedMatchupIncrementEnvelope?.min,0)||!same(walker.approvedMatchupIncrementEnvelope?.max,0))fail('Walker matchup increment is no longer zero');
decisions.push({
  archetype:'MULTIROLE_INTERVAL_DISPLAY_NOT_INVARIANT',caseKey:walker.caseKey,
  decision:'BLOCK_MULTIROLE_UNRESOLVED',m4Candidate:false,
  exactPersonnelValueResolved:false,exactFairResolved:false,displayResolved:false,
  replacementValueEnvelope:walker.replacementValueEnvelope,
  teamLossEnvelope:walker.teamLossEnvelope,
  productionGuard:'Do not choose a midpoint or an endpoint. Resolve role shares, vacated-role backfills and concurrent absences through separate governed events first.',
  reason:'The valid multi-role interval spans multiple Graham display outcomes and therefore must remain fail closed.'
});

const nonzeroMatchupSamples=[
  finite(bcase.approvedMatchupIncrement),
  finite(jacobs.approvedMatchupIncrementEnvelope?.min),finite(jacobs.approvedMatchupIncrementEnvelope?.max),
  finite(pearsall.approvedMatchupIncrement),
  finite(walker.approvedMatchupIncrementEnvelope?.min),finite(walker.approvedMatchupIncrementEnvelope?.max)
].filter(v=>v!==null&&Math.abs(v)>0.0001).length;
if(nonzeroMatchupSamples!==0)fail('unexpected nonzero opponent-specific matchup sample in M3 fixture');

const accepted=decisions.filter(d=>d.m4Candidate);
const blocked=decisions.filter(d=>!d.m4Candidate);
if(accepted.length!==2||blocked.length!==2)fail(`unexpected acceptance split ${accepted.length}/${blocked.length}`);

const m4Scope={
  exactOneForOne:true,
  valueInvariantCommittee:true,
  rangeOnlyCommittee:false,
  multiroleInterval:false,
  zeroMatchupReview:true,
  nonzeroOpponentMatchupIncrement:false,
  note:'M3 approves a scoped M4 candidate only. Automated nonzero opponent-specific matchup increments remain disabled until a separate nonzero shadow calibration passes.'
};

const protectedAfter={
  currentNumbers:hashFile(NUMBERS),
  personnelLedger:hashFile(PERSONNEL),
  powerRatings:hashFile(POWER),
  playerValueRegistry:hashFile(REGISTRY)
};
if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))fail('protected live artifacts changed during M3');

const now=new Date().toISOString();
const result={
  schema:1,
  resultId:`walters-matchup-m3-${ACTIVE.season}-week-${W}-acceptance-v1`,
  stage:'M3',state:contract.m3PassState,
  season:ACTIVE.season,week:ACTIVE.week,timezone:'America/Vancouver',generatedAt:now,
  acceptanceId:contract.acceptanceId,
  productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,
  m4ActivationCandidate:true,
  m4Scope,
  summary:{archetypesTested:decisions.length,acceptedArchetypes:accepted.length,blockedArchetypes:blocked.length,nonzeroOpponentMatchupSamples:nonzeroMatchupSamples,liveMoves:0},
  decisions,
  m5CatchupPolicy:'After M4 activation, rebuild the active-week baseline from current football evidence under the accepted rules. Do not copy stale shadow numbers directly into production.',
  shadowFixtureSha256:fixtureHashes[0],
  currentProtectedArtifactSha256:protectedAfter,
  conclusion:'M3 passes a scoped production-activation candidate: exact one-for-one and exact value-invariant committee personnel logic may advance to M4, zero matchup decisions are valid, range-only and multi-role intervals remain blocked, and automated nonzero opponent-specific matchup increments remain disabled pending a separate successful shadow calibration.'
};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');

const current={
  schema:1,stage:'M3',state:result.state,season:ACTIVE.season,week:ACTIVE.week,updatedAt:now,
  acceptanceId:contract.acceptanceId,productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,
  m4ActivationCandidate:true,m4Scope,
  resultPath:path.relative(ROOT,OUT),summary:result.summary,
  nextGate:[
    'Build M4 production activation only for the accepted scoped classes.',
    'Keep range-only committees and unresolved multi-role cases fail closed.',
    'Keep automated nonzero opponent-specific matchup increments disabled until a separate nonzero shadow case passes acceptance.',
    'After M4, perform the one-time active-week catch-up rebuild from current football evidence rather than copying shadow outputs.'
  ]
};
fs.writeFileSync(CURRENT,JSON.stringify(current,null,2)+'\n');

const verify=readJson(OUT);
if(verify.state!==contract.m3PassState||verify.m4ActivationCandidate!==true||verify.summary.liveMoves!==0)fail('M3 result read-back failed');
console.log(`WALTERS MATCHUP M3: PASS // 4 ARCHETYPES // 2 ACCEPTED // 2 BLOCKED // NONZERO MATCHUP AUTO AUTHORITY OFF // 0 LIVE MOVES`);
