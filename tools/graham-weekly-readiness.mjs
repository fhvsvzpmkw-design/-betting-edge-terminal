#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolveGrahamActiveWeek,grahamWeekPaths} from './graham-active-week.mjs';
import {weeklyCompletion} from './graham-weekly-completion.mjs';
import {loadFinalSlate} from './graham-final-slate.mjs';

export const READINESS_PATH='data/walters/nfl/weekly-readiness.json';
const list=x=>Array.isArray(x)?x:[];
const blob=bytes=>createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const done=value=>/^(COMPLETE|RECONCILED|VERIFIED|READY)(?:_|$)/.test(String(value));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Read-only projection. It cannot approve an estimate, set a rating or activate a week.
export function recoveryQueue({season,sourceWeek,schedule,power,evidence,effectiveAt,previous=[]}){
  const receipt=power.weekly90_10;
  const matches=receipt?.season===season&&receipt.sourceWeek===sourceWeek&&receipt.targetWeek===sourceWeek+1;
  const rows=[];
  for(const game of schedule){
    const records=evidence.flatMap(b=>list(b.games).filter(g=>g.gameKey===game.gameKey).map(g=>({bundle:b,game:g})))
      .sort((a,b)=>Date.parse(b.bundle.recordedAt)-Date.parse(a.bundle.recordedAt)||a.bundle.path.localeCompare(b.bundle.path));
    const latest=records[0],checklist={};
    // New additive evidence can supersede a field; absent fields retain their provenance.
    for(const record of [...records].reverse())for(const [key,state]of Object.entries(record.game.checklist||{}))checklist[key]={state,path:record.bundle.path};
    const pair=[game.away,game.home].map((team,i)=>list(power.teams.find(t=>t.abbr===team)?.history).filter(e=>
      e.type==='WALTERS_WEEKLY_90_10'&&e.season===season&&e.sourceWeek===sourceWeek&&e.targetWeek===sourceWeek+1&&
      e.gameKey===game.gameKey&&e.opponent===(i?game.away:game.home)));
    const events=pair.map(p=>p[0]);
    const paired=pair.every(p=>p.length===1)&&events[0].auditId===events[1].auditId&&
      events[0].effectiveAt===events[1].effectiveAt&&events.every(e=>e.marketViewed===false&&e.gameDayEvidenceBinding);
    const receiptBlocked=matches?list(receipt.blockedGames).find(g=>g.gameKey===game.gameKey):null;
    const applied=matches&&paired&&!receiptBlocked;
    const conflict=pair.some(p=>p.length)&&!paired;
    const oldReasons=list(receiptBlocked?.reasons);
    const blockers=applied?[]:conflict?[{code:'PAIRED_HISTORY_CONFLICT',finding:'Missing, duplicate or mismatched paired weekly history.',nextAction:'Reconcile the original paired transaction; do not replay either side.',owner:'GRAHAM_WALTERS_90_10'}]:
      latest?.game.state==='READY'?[]:latest?list(latest.game.blockers):oldReasons.map(finding=>({code:'RECEIPT_ONLY_BLOCKER',finding,nextAction:'Bind the current missing input in a source-week evidence bundle.',owner:'GRAHAM_WALTERS_90_10'}));
    const state=applied?'APPLIED':conflict?'BLOCKED_HISTORY':latest?.game.state==='READY'?'VALIDATE_AND_PUBLISH':latest?'RECONCILE':'PREPARE';
    const workClass=state==='APPLIED'?'DONE':state==='VALIDATE_AND_PUBLISH'?'READY_FOR_VALIDATION':
      blockers.some(b=>['SOURCE_NOT_YET_AVAILABLE','METHOD_DECISION_REQUIRED'].includes(b.code))?'WAITING_SOURCE_OR_METHOD':
      blockers.some(b=>['REPLACEMENT_OR_VALUE_UNRESOLVED','IDENTITY_CONFLICT','PAIRED_HISTORY_CONFLICT'].includes(b.code))?'TARGETED_RECONCILIATION':'AVAILABLE_WORK';
    const fingerprint=digest({state,checklist,blockers});
    const old=previous.find(p=>p.gameKey===game.gameKey);
    const firstSeenAt=old?.firstSeenAt||records.at(-1)?.bundle.recordedAt||effectiveAt;
    const lastEvidenceAt=latest?.bundle.recordedAt||null;
    const unchangedSince=old?.fingerprint===fingerprint?old.unchangedSince:(lastEvidenceAt||firstSeenAt);
    const stalled=state!=='APPLIED'&&Date.parse(effectiveAt)-Date.parse(unchangedSince)>=6*3600000;
    rows.push({gameKey:game.gameKey,away:game.away,home:game.home,state,workClass,
      latestEvidence:latest?{path:latest.bundle.path,blobSha:latest.bundle.blobSha,recordedAt:lastEvidenceAt}:null,
      checklist,blockers,firstSeenAt,lastEvidenceAt,unchangedSince,stalled,fingerprint,
      receiptBlockerSuperseded:!applied&&!!receiptBlocked&&!!latest&&Date.parse(lastEvidenceAt)>Date.parse(receipt.appliedAt),
      owner:'GRAHAM_WALTERS_90_10',nextAction:state==='APPLIED'?'PRESERVE_PAIRED_HISTORY':state==='VALIDATE_AND_PUBLISH'?'RUN_BOUND_EVALUATOR_THEN_STAGE_WITH_EXISTING_UPDATER':
        blockers[0]?.nextAction||'Complete the paired final-game inventory from the official gamebook, then validate supported estimates.',
      escalation:stalled?'UNRESOLVED_ACROSS_RUNS: report the exact missing fact or method decision; another generic pending note is insufficient.':null});
  }
  // Work that can actually close a pair comes before a repeatedly unavailable
  // source. The latter stays visible as an escalation, without starving the slate.
  const rank={READY_FOR_VALIDATION:0,AVAILABLE_WORK:1,TARGETED_RECONCILIATION:2,WAITING_SOURCE_OR_METHOD:3,DONE:4};
  return rows.sort((a,b)=>rank[a.workClass]-rank[b.workClass]||Number(b.stalled)-Number(a.stalled)||Date.parse(a.firstSeenAt)-Date.parse(b.firstSeenAt)||a.gameKey.localeCompare(b.gameKey));
}

export function buildWeeklyReadiness({active,board,power,staging,prior,evidence,activeEvidence=[],activeFinals,effectiveAt,previous=null}){
  if(board.season!==active.season||board.week!==active.week||!Number.isFinite(Date.parse(effectiveAt)))throw Error('READINESS_ACTIVE_IDENTITY_OR_TIME');
  const completion=weeklyCompletion({active,board,power,staging});
  const historical=active.week===1?[]:recoveryQueue({season:active.season,sourceWeek:active.week-1,schedule:prior.games,power,evidence,effectiveAt,previous:previous?.historicalGames});
  const preparation=recoveryQueue({season:active.season,sourceWeek:active.week,schedule:board.games.filter(g=>Date.parse(g.startTimePacific)<Date.parse(effectiveAt)),power,evidence:activeEvidence,effectiveAt,previous:previous?.activeWeekPreparation});
  const historicalComplete=completion.components.historicalLearning.state==='COMPLETE';
  const pendingRatings=board.games.filter(g=>{
    const t=new Map(power.teams.map(t=>[t.abbr,t.currentRating]));
    return g.ratingCarryForward?.awayRating!==t.get(g.away)||g.ratingCarryForward?.homeRating!==t.get(g.home);
  });
  const latestBatch=new Set(list(staging.result?.ratingChanges).map(c=>c.team));
  const missedEarlierBatches=pendingRatings.filter(g=>[g.away,g.home].some((team,i)=>{
    const stored=g.ratingCarryForward?.[i?'homeRating':'awayRating'];return stored!==power.teams.find(t=>t.abbr===team)?.currentRating&&!latestBatch.has(team);
  }));
  const cycle=completion.components.initialBaseline.state!=='COMPLETE'&&pendingRatings.length>0;
  const nextWeekRequired=activeFinals.state==='COMPLETE';
  const rolloverBlockers=nextWeekRequired&&!historicalComplete?['HISTORICAL_LEARNING_INCOMPLETE']:[];
  const problems=[...(cycle?[{code:'BASELINE_PROPAGATION_CYCLE',finding:'A pending initial baseline and unpublished carried bases coexist; mechanical propagation must not wait for research completion.'}]:[]),
    ...(missedEarlierBatches.length?[{code:'EARLIER_PUBLISHED_BATCHES_NOT_PROPAGATED',games:missedEarlierBatches.map(g=>g.gameKey)}]:[]),
    ...(historical.some(g=>g.stalled)?[{code:'STALLED_HISTORICAL_RECOVERY',games:historical.filter(g=>g.stalled).map(g=>g.gameKey)}]:[]),
    ...(nextWeekRequired?[{code:'NEXT_WEEK_NOT_ACTIVATED',expectedWeek:active.week+1,reason:rolloverBlockers.length?'Historical learning still incomplete.':'Run the mechanical rollover owner now; previous-game display refresh is not a new-week rating input.'}]:[])];
  const counts={historicalApplied:historical.filter(g=>g.state==='APPLIED').length,historicalExpected:historical.length,
    historicalReadyToValidate:historical.filter(g=>g.state==='VALIDATE_AND_PUBLISH').length,stalledHistoricalGames:historical.filter(g=>g.stalled).length,
    activeWeekEvidenceReady:preparation.filter(g=>g.state==='VALIDATE_AND_PUBLISH').length,activeWeekEvidenceExpected:preparation.length,
    ratingBasesBehind:pendingRatings.length,initialBaseline:completion.components.initialBaseline.state};
  return {schema:1,policyId:'graham-weekly-production-v2',season:active.season,activeWeek:active.week,generatedAt:effectiveAt,
    state:nextWeekRequired||completion.state!=='COMPLETE'?'BLOCKED':'VERIFIED_CURRENT',counts,
    rollover:{required:nextWeekRequired,nextWeek:nextWeekRequired?active.week+1:null,activeFinals,blockers:rolloverBlockers,
      nextAction:!nextWeekRequired?'PREPARE_EVIDENCE_AS_GAMES_FINISH':historicalComplete?'RUN_WEEK_ROLLOVER':'FINISH_OLDEST_HISTORICAL_INPUTS'},
    completion,historicalGames:historical,activeWeekPreparation:preparation,processProblems:problems,
    customerMessage:nextWeekRequired?`Week ${active.week+1} has not been published. Historical rating updates: ${counts.historicalApplied}/${counts.historicalExpected}; completed Week ${active.week} evidence ready: ${counts.activeWeekEvidenceReady}/${counts.activeWeekEvidenceExpected}.`:
      `Week ${active.week}: historical rating updates ${counts.historicalApplied}/${counts.historicalExpected}; ${counts.initialBaseline==='COMPLETE'?'baseline verified':'baseline incomplete'}.`,
    marketViewed:false,numericAuthority:false,completionRule:'A finished worker is not published completion. Publication requires the correct week, supported ratings and baseline, production readback and deployed-feed verification.'};
}

export function loadWeeklyReadiness({root=process.cwd(),effectiveAt=new Date().toISOString()}={}){
  const active=resolveGrahamActiveWeek({root}),bindings={};
  const read=relative=>{const bytes=fs.readFileSync(path.join(root,relative));bindings[relative]=blob(bytes);return JSON.parse(bytes);};
  const board=read(active.paths.currentNumbers),power=read('data/walters/nfl-power-ratings-ledger.json'),staging=read('data/walters/nfl/carried-rating-audit-staging.json');
  const prior=active.week===1?{games:[]}:read(grahamWeekPaths(active.season,active.week-1,{root}).relative.currentNumbers);
  const evidenceFor=week=>{
    const directory=`data/walters/nfl/${active.season}/week-${String(week).padStart(2,'0')}-weekly-evidence`,result=[];
    if(fs.existsSync(path.join(root,directory)))for(const name of fs.readdirSync(path.join(root,directory)).sort())if(name.endsWith('.json')){
      const relative=directory+'/'+name,bundle=read(relative);
      if(!Array.isArray(bundle.games))continue;
      if(bundle.schema!==1||bundle.season!==active.season||bundle.sourceWeek!==week||bundle.marketViewed!==false||
          !Number.isFinite(Date.parse(bundle.recordedAt))||Date.parse(bundle.recordedAt)>Date.parse(effectiveAt))throw Error('READINESS_EVIDENCE_IDENTITY_OR_TIME:'+relative);
      result.push({...bundle,path:relative,blobSha:bindings[relative]});
    }
    return result;
  };
  const oldPath=path.join(root,READINESS_PATH),previous=fs.existsSync(oldPath)?JSON.parse(fs.readFileSync(oldPath)):null;
  const result=buildWeeklyReadiness({active,board,power,staging,prior,evidence:active.week===1?[]:evidenceFor(active.week-1),activeEvidence:evidenceFor(active.week),
    activeFinals:loadFinalSlate({root,board,effectiveAt}),effectiveAt,previous});
  result.inputBlobs=bindings;
  return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.slice(2).some(a=>a!=='--write'))throw Error('Usage: graham-weekly-readiness.mjs [--write]');
  const result=loadWeeklyReadiness();
  if(process.argv.includes('--write'))fs.writeFileSync(READINESS_PATH,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}
