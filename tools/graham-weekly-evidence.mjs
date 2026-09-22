// Historical input recovery uses existing locked values; it never writes old ledgers or fairs.
import fs from 'node:fs';
import {replacementEstimate,reconciledRoleChainEstimate,MODEL_RESOLUTIONS} from './graham-replacement-model.mjs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {individualDelta,clusterMultiplier,playerValue} from './walters-personnel-calibration.mjs';
export const WEEKLY_EVIDENCE_FROM='2026-09-20T20:30:00-07:00';
const list=x=>Array.isArray(x)?x:[], nonempty=x=>typeof x==='string'&&x.trim().length>0;
const fail=x=>{throw Error(x);};
const exact=x=>typeof x==='number'&&Number.isFinite(x);
const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const gitBlob=bytes=>createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const round=x=>Number(x.toFixed(3));
export function boundJson(root,relative,sha) {
  if(!/^[0-9a-f]{40}$/.test(sha||'')||path.isAbsolute(relative)||relative.split('/').includes('..'))fail('INVALID_EVIDENCE_BINDING');
  let bytes;
  try{bytes=execFileSync('git',['cat-file','blob',sha],{cwd:root,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});}
  catch{bytes=fs.readFileSync(path.join(root,relative));}
  if(gitBlob(bytes)!==sha)fail('EVIDENCE_BLOB_MISMATCH:'+relative);
  return JSON.parse(bytes);
}
function group(position){
  for(const [g,ps] of Object.entries({RECEIVER:['WR','TE'],DEFENSIVE_LINE:['EDGE','LE','RE','DT','NT'],OFFENSIVE_LINE:['LT','LG','C','RG','RT'],DEFENSIVE_BACK:['CB','FS','SS'],LINEBACKER:['LB','MLB','OLB'],RUNNING_BACK:['RB','FB']}))if(ps.includes(position))return g;
  fail('UNSUPPORTED_HISTORICAL_POSITION:'+position);
}
export function evaluateWeeklyEvidence({bundle,personnel,registry,calibration,prior,production,matchupProduction}) {
  if(bundle.schema!==1||bundle.marketViewed!==false||bundle.season!==prior.season||bundle.sourceWeek!==prior.week||personnel.season!==prior.season||personnel.week!==prior.week||!Number.isFinite(Date.parse(bundle.recordedAt)))fail('HISTORICAL_EVIDENCE_IDENTITY');
  if(calibration.status!=='ACTIVE_SOURCE_LOCKED_CALIBRATED'||registry.state!=='STAGE_2_VALIDATED'||production?.state!=='OPERATIONAL'||production.productionAuthority!==true||calibration.calibrationId!==registry.calibrationId||calibration.calibrationId!==personnel.calibrationId)fail('HISTORICAL_VALUE_AUTHORITY');
  if(new Set(list(bundle.games).map(g=>g.gameKey)).size!==list(bundle.games).length)fail('DUPLICATE_EVIDENCE_GAME');
  const sources=new Map();
  for(const s of list(bundle.sources)){
    if(!nonempty(s.id)||sources.has(s.id)||!['OFFICIAL','REPORTING'].includes(s.kind)||!nonempty(s.finding)||!/^https:\/\//.test(s.url||'')||!Number.isFinite(Date.parse(s.checkedAt))||Date.parse(s.checkedAt)>Date.parse(bundle.recordedAt))fail('HISTORICAL_SOURCE_INVALID');sources.set(s.id,s);
  }
  const sourceCheck=(ids,key)=>{
    if(!list(ids).length||!ids.every(id=>list(sources.get(id)?.gameKeys).includes(key)))fail('GAME_SPECIFIC_SOURCE_REQUIRED:'+key);
  };
  const lookup=(name,id)=>{
    const found=list(registry.players).filter(p=>id?String(p.eaPlayerId)===String(id):norm(p.player)===norm(name));
    if(found.length!==1||norm(found[0].player)!==norm(name))fail('LOCKED_PLAYER_IDENTITY:'+name);
    const p=found[0];if(p.valueStatus!=='CALIBRATED'||!exact(p.waltersPoints)||!exact(p.maddenOvr)||p.position==='QB'||playerValue(calibration,{position:p.position,maddenOvr:p.maddenOvr})!==p.waltersPoints)fail('LOCKED_PLAYER_VALUE:'+name);return p;
  };
  const results=[];
  for(const g of list(bundle.games)){
    const game=prior.games.find(p=>p.gameKey===g.gameKey);
    if(!game||g.away!==game.away||g.home!==game.home||Date.parse(bundle.recordedAt)<=Date.parse(game.startTimePacific))fail('HISTORICAL_GAME_IDENTITY:'+g.gameKey);
    if(g.state==='BLOCKED'){
      if(!list(g.blockers).length||!g.blockers.every(b=>nonempty(b.code)&&nonempty(b.finding)&&nonempty(b.nextAction)))fail('ACTIONABLE_BLOCKER_REQUIRED');
      sourceCheck(g.sourceIds,g.gameKey);
      // A resolved individual role can be retained even when the full game is not ready.
      const caseReviews=list(g.caseReviews).map(c=>{
        try{
          if(![game.away,game.home].includes(c.team)||!nonempty(c.caseKey)||!nonempty(c.rationale)||!['OUT','IR','SUSPENDED','COMMISSIONER_EXEMPT'].includes(c.availabilityStatus))fail('CASE_REVIEW_IDENTITY_OR_AVAILABILITY');
          const old=Object.values(personnel.currentCases||{}).find(x=>x.caseKey===c.caseKey);
          if(old?(old.gameKey!==g.gameKey||old.team!==c.team||norm(old.player)!==norm(c.player)):c.newlyIdentified!==true)fail('CASE_REVIEW_ARCHIVE_IDENTITY');
          sourceCheck(c.sourceIds,g.gameKey);sourceCheck(c.roleSourceIds,g.gameKey);
          if(c.baselineDoubleCountReviewed!==true||!nonempty(c.roleRationale))fail('REPLACEMENT_ROLE_REVIEW_REQUIRED');
          const p=lookup(c.player,c.eaPlayerId),rs=list(c.replacements).map(r=>lookup(r.player,r.eaPlayerId));
          if(!rs.length||new Set(rs.map(r=>String(r.eaPlayerId))).size!==rs.length||rs.some(r=>group(r.position)!==group(p.position)||String(r.eaPlayerId)===String(p.eaPlayerId)))fail('CASE_REVIEW_REPLACEMENT_SET');
          const options={lookup,sourceCheck:ids=>sourceCheck(ids,g.gameKey)};
          const estimate=c.resolution==='RECONCILED_ROLE_CHAIN'?reconciledRoleChainEstimate(c,p,rs,options):replacementEstimate(c,p.waltersPoints,rs,options);
          return {caseKey:c.caseKey,team:c.team,state:'CASE_ESTIMATE_ONLY',estimate,limitation:'Individual role estimate only; complete paired game-day coverage and team cluster checks still required.'};
        }catch(e){return {caseKey:c.caseKey,team:c.team,state:'BLOCKED',reason:e.message};}
      });
      results.push({gameKey:g.gameKey,state:'BLOCKED',blockers:g.blockers,teams:[],...(caseReviews.length?{caseReviews}:{})});continue;
    }
    const teams=[],blockers=[];
    if(list(g.teams).length!==2||new Set(g.teams.map(t=>t.team)).size!==2)fail('HISTORICAL_PAIRED_TEAMS_REQUIRED');
    for(const abbr of [game.away,game.home]){
      try{
        const t=g.teams.find(t=>t.team===abbr);if(!t||t.coverage!=='FINAL_GAME_DAY'||t.allAbsencesReviewed!==true||!nonempty(t.coverageRationale))fail('FINAL_GAME_DAY_COVERAGE_REQUIRED');
        sourceCheck(t.sourceIds,g.gameKey);
        if(t.qbAvailability?.state!=='NO_GAME_DAY_LOSS'||!nonempty(t.qbAvailability.rationale))fail('GOVERNED_QB_GAME_DAY_LOSS_REQUIRED');sourceCheck(t.qbAvailability.sourceIds,g.gameKey);
        const archived=Object.values(personnel.currentCases||{}).filter(c=>c.gameKey===g.gameKey&&c.team===abbr);
        const cs=list(t.cases),keys=cs.map(c=>c.caseKey);
        if(new Set(keys).size!==keys.length||archived.some(c=>!keys.includes(c.caseKey)))fail('PRIOR_CASE_OMITTED_OR_DUPLICATED');
        const computed=[];const replacements=new Set(),chainRoles=new Set();
        for(const c of cs){
          const old=archived.find(a=>a.caseKey===c.caseKey);
          if(!nonempty(c.caseKey)||!nonempty(c.rationale)||(!old&&c.newlyIdentified!==true)||(old&&norm(old.player)!==norm(c.player)))fail('HISTORICAL_CASE_IDENTITY');
          sourceCheck(c.sourceIds,g.gameKey);
          if(c.resolution==='UNRESOLVED')fail('UNRESOLVED_CASE:'+c.caseKey);
          const p=lookup(c.player,c.eaPlayerId);
          let value=null,modelEstimate=null;
          if(c.resolution==='ACTIVE_FULL'){
            if(c.availabilityStatus!=='ACTIVE_FULL')fail('FULL_AVAILABILITY_NOT_ESTABLISHED');
          }else{
            if(!['OUT','IR','SUSPENDED','COMMISSIONER_EXEMPT'].includes(c.availabilityStatus))fail('HISTORICAL_AVAILABILITY_UNRESOLVED');
            if(c.baselineDoubleCountReviewed!==true||!nonempty(c.roleRationale))fail('REPLACEMENT_ROLE_REVIEW_REQUIRED');
            sourceCheck(c.roleSourceIds,g.gameKey);
            const rs=list(c.replacements).map(r=>lookup(r.player,r.eaPlayerId));
            if(!rs.length||new Set(rs.map(r=>String(r.eaPlayerId))).size!==rs.length)fail('REPLACEMENT_SET_INVALID');
            if(c.resolution==='ONE_FOR_ONE'&&rs.length!==1)fail('ONE_FOR_ONE_REPLACEMENT_REQUIRED');
            if(c.resolution==='RECONCILED_ROLE_CHAIN'){
              modelEstimate=reconciledRoleChainEstimate(c,p,rs,{lookup,sourceCheck:ids=>sourceCheck(ids,g.gameKey)});
            }else if(MODEL_RESOLUTIONS.includes(c.resolution)){
              modelEstimate=replacementEstimate(c,p.waltersPoints,rs,{sourceCheck:ids=>sourceCheck(ids,g.gameKey)});
            }else if(c.resolution==='VALUE_INVARIANT_COMMITTEE'){
              if(matchupProduction?.state!=='OPERATIONAL_SCOPED'||matchupProduction.productionAuthority!==true||rs.length<2||new Set(rs.map(r=>r.waltersPoints)).size!==1||c.clusterGuardStatus!=='PASS'||c.matchupReview?.status!=='REVIEWED_ZERO'||c.matchupReview.increment!==0)fail('COMMITTEE_NOT_AUTHORIZED_OR_VALUE_INVARIANT');
              if(rs[0].waltersPoints>p.waltersPoints)fail('COMMITTEE_REPLACEMENT_EXCEEDS_HEALTHY');
            }else if(c.resolution!=='ONE_FOR_ONE')fail('UNSUPPORTED_HISTORICAL_RESOLUTION');
            const reserved=modelEstimate?.reservedPlayers?modelEstimate.reservedPlayers.map(r=>lookup(r.player,r.eaPlayerId)):rs;
            for(const row of modelEstimate?.reconciledRoles?.before||[]){if(chainRoles.has(row.role))fail('CHAIN_SIMULTANEOUS_ROLE_OVERLAP');chainRoles.add(row.role);}
            for(const r of reserved){if(String(r.eaPlayerId)===String(p.eaPlayerId)||group(r.position)!==group(p.position)||replacements.has(String(r.eaPlayerId)))fail('REPLACEMENT_ROLE_OR_DOUBLE_COUNT');
              if(modelEstimate?.reservedPlayers&&cs.some(other=>other!==c&&other.resolution!=='ACTIVE_FULL'&&String(lookup(other.player,other.eaPlayerId).eaPlayerId)===String(r.eaPlayerId)))fail('CHAIN_OCCUPANT_UNAVAILABLE_IN_OTHER_CASE');
              replacements.add(String(r.eaPlayerId));}
            for(const ex of list(c.excludedBaselineContributors)){if(!nonempty(ex.player)||!nonempty(ex.rationale)||rs.some(r=>norm(r.player)===norm(ex.player)))fail('BASELINE_EXCLUSION_INVALID');sourceCheck(ex.sourceIds,g.gameKey);}
            value=modelEstimate?.replacementValue??rs[0].waltersPoints;
          }
          const result=modelEstimate||individualDelta(calibration,{availabilityStatus:c.availabilityStatus,healthyValue:p.waltersPoints,replacementValue:value});
          computed.push({caseKey:c.caseKey,player:p.player,group:group(p.position),healthyValue:p.waltersPoints,replacementValue:value,rawTeamContributionDelta:result.rawTeamContributionDelta,...(modelEstimate?{modelEstimate}:{}),sourceIds:c.sourceIds});
        }
        const groups=[];
        for(const name of new Set(computed.map(c=>c.group))){
          const entries=computed.filter(c=>c.group===name),cl=clusterMultiplier(calibration,name,entries);
          if(cl.reviewRequired)fail(cl.code+':'+name);
          if(name==='RECEIVER'&&cl.multiplier>1&&t.topReceiverClusterReviewed!==true)fail('TOP_RECEIVER_CLUSTER_REVIEW_REQUIRED');
          groups.push({group:name,multiplier:cl.multiplier,loss:round(-entries.reduce((s,c)=>s+c.rawTeamContributionDelta,0)*cl.multiplier)});
        }
        const injuryLoss=round(groups.reduce((s,g)=>s+g.loss,0));
        if(injuryLoss<0)fail('REPLACEMENT_UPGRADE_REQUIRES_LOSS_CONVENTION_REVIEW');
        teams.push({team:abbr,state:'GOVERNED',valueBasis:computed.some(c=>c.modelEstimate)?'INCLUDES_GRAHAM_MODEL_ESTIMATE':'EXISTING_CALIBRATED_METHOD',injuryLoss,cases:computed,groups,sourceIds:t.sourceIds});
      }catch(e){blockers.push({team:abbr,code:e.message});}
    }
    results.push({gameKey:g.gameKey,state:blockers.length?'BLOCKED':'READY',teams,blockers});
  }
  return {schema:1,season:bundle.season,sourceWeek:bundle.sourceWeek,recordedAt:bundle.recordedAt,games:results,readyGames:results.filter(g=>g.state==='READY').length,blockedGames:results.filter(g=>g.state==='BLOCKED').length,marketViewed:false};
}
export function loadWeeklyEvidence(root,binding,expected){
  const prefix=`data/walters/nfl/${expected.season}/week-${String(expected.sourceWeek).padStart(2,'0')}-weekly-evidence/`;
  if(!binding?.path?.startsWith(prefix)||!binding.path.endsWith('.json'))fail('WEEKLY_EVIDENCE_PATH_REQUIRED');
  const bundle=boundJson(root,binding.path,binding.blobSha);
  if(bundle.season!==expected.season||bundle.sourceWeek!==expected.sourceWeek||Date.parse(bundle.recordedAt)>Date.parse(expected.effectiveAt))fail('WEEKLY_EVIDENCE_TIME_OR_WEEK');
  const week=`data/walters/nfl/${expected.season}/week-${String(expected.sourceWeek).padStart(2,'0')}`;
  const paths={personnel:week+'-personnel-ledger.json',prior:week+'-current-numbers.json',registry:'data/walters/nfl/player-values/player-values-2026-v1.json',calibration:'data/walters/nfl/personnel-calibration-v1.json',production:'data/walters/nfl/personnel-production-current.json',matchupProduction:'data/walters/nfl/matchup-production-current.json'};
  if(!/^[0-9a-f]{40}$/.test(bundle.inputCommit||''))fail('HISTORICAL_INPUT_COMMIT_REQUIRED');
  execFileSync('git',['merge-base','--is-ancestor',bundle.inputCommit,'HEAD'],{cwd:root,stdio:'pipe'});
  for(const p of Object.values(paths)){
    const sha=execFileSync('git',['rev-parse',`${bundle.inputCommit}:${p}`],{cwd:root,encoding:'utf8'}).trim();
    if(sha!==bundle.inputBlobs?.[p])fail('HISTORICAL_INPUT_PATH_BINDING:'+p);
  }
  const inputs=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,boundJson(root,p,bundle.inputBlobs?.[p])]));
  return evaluateWeeklyEvidence({bundle,...inputs});
}
export function verifyWeeklyGameEvidence(root,input,game){
  const binding=game.gameDayEvidence?.evidenceBinding;
  const result=loadWeeklyEvidence(root,binding,{season:input.season,sourceWeek:input.sourceWeek,effectiveAt:input.effectiveAt});
  const resolved=result.games.find(g=>g.gameKey===game.gameKey);
  if(resolved?.state!=='READY')fail('HISTORICAL_GAME_INPUTS_NOT_READY:'+game.gameKey);
  for(const team of game.teams){const evidence=resolved.teams.find(t=>t.team===team.team);if(!evidence||evidence.injuryLoss!==team.teamInjuryLoss)fail('HISTORICAL_INJURY_TOTAL_MISMATCH:'+team.team);}
  return resolved;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const file=process.argv[2];if(!file)fail('Usage: node tools/graham-weekly-evidence.mjs EVIDENCE_JSON');const bytes=fs.readFileSync(file),bundle=JSON.parse(bytes);console.log(JSON.stringify(loadWeeklyEvidence(process.cwd(),{path:file,blobSha:gitBlob(bytes)},{season:bundle.season,sourceWeek:bundle.sourceWeek,effectiveAt:bundle.recordedAt}),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
}
