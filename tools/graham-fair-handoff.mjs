import fs from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {teamAbbr} from './graham-market-utils.mjs';
export const GRAHAM_HANDOFF_FROM='2026-09-21T06:00:00-07:00';
export const grahamHandoffRequired=(report,selection)=>Date.parse(report?.ts)>=Date.parse(GRAHAM_HANDOFF_FROM) && selection?.sport==='NFL' && selection.marketClass==='spread' && selection.marketDetail==='full_game_primary_spread';
const list=x=>Array.isArray(x)?x:[], finite=x=>typeof x==='number'&&Number.isFinite(x), text=x=>typeof x==='string'&&x.trim().length>0;
const close=(a,b)=>finite(a)&&finite(b)&&Math.abs(a-b)<1e-8;
const blob=bytes=>createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ACTIVE='data/walters/nfl/active-week.json', AUTH='core/walters-authority-v1.4.json';
export function loadGrahamHandoffInputs(root,report,sidecar={}) {
  const binding=sidecar.grahamFairHandoffInputs;
  if(binding && (binding.schema!==1 || binding.reportTs!==report.ts)) throw Error('Graham handoff snapshot/report mismatch');
  if(binding?.state==='UNAVAILABLE')return {state:'UNAVAILABLE',reason:binding.reason,binding};
  const refs={};
  const get=relative=>{
    let bytes;
    if(binding) {
      const sha=binding.blobs?.[relative];
      if(!/^[0-9a-f]{40}$/.test(sha||'')) throw Error('Graham handoff snapshot binding missing: '+relative);
      try {bytes=execFileSync('git',['cat-file','blob',sha],{cwd:root,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});}
      catch {bytes=fs.readFileSync(path.join(root,relative));}
      if(blob(bytes)!==sha) throw Error('Graham handoff snapshot bytes differ: '+relative);
    } else bytes=fs.readFileSync(path.join(root,relative));
    refs[relative]=blob(bytes);return JSON.parse(bytes);
  };
  try {
    const active=get(ACTIVE),authority=get(AUTH);
    if(active.schema!==1 || active.state!=='ACTIVE' || active.authority!=='GRAHAM_WEEK_ROLLOVER' || !Number.isInteger(active.season) || !Number.isInteger(active.week) || active.week<1 || active.week>30) throw Error('Active Graham week unresolved');
    const boardPath=`data/walters/nfl/${active.season}/week-${String(active.week).padStart(2,'0')}-current-numbers.json`;
    const board=get(boardPath);
    if(board.season!==active.season || board.week!==active.week || !Array.isArray(board.games)) throw Error('Graham board/active-week conflict');
    if(authority.state!=='OPERATIONAL' || !['OFF','ADVISORY','BET_AUTHORITY'].includes(authority.mode)) throw Error('Walters authority unresolved');
    if(!Number.isFinite(Date.parse(board.updatedAt)) || Date.parse(board.updatedAt)>Date.parse(report.ts) || !Number.isFinite(Date.parse(active.weekActivatedAt)) || Date.parse(active.weekActivatedAt)>Date.parse(report.ts)) throw Error('Graham snapshot contains future state');
    return {active,authority,board,boardPath,binding:{schema:1,reportTs:report.ts,blobs:refs},state:'BOUND'};
  } catch(error) {
    // A pinned snapshot must not silently turn into a new unavailable source.
    if(binding) throw error;
    const reason=error.code ? `Graham inputs unavailable (${error.code})` : error.message;
    return {state:'UNAVAILABLE',reason,binding:{schema:1,reportTs:report.ts,state:'UNAVAILABLE',reason}};
  }
}
export function compareGrahamFair({report,selection,quote,feed,inputs}) {
  if(!grahamHandoffRequired(report,selection))return null;
  const identity={selectionId:selection.selectionId,selectionKey:quote?.selectionKey,eventId:selection.eventId,eventDate:selection.eventDate,side:quote?.side,line:quote?.line,book:quote?.book,priceDecimal:quote?.priceDecimal};
  const result={schema:1,source:'GRAHAM_WALTERS_NFL_SPREAD',...identity,state:'UNAVAILABLE',reason:null,inputBinding:inputs?.binding||null,limitations:[],decisionAuthority:false,statusEffect:'NONE',unit:'selection_spread_points'};
  const finish=()=>({...result,recordId:digest({identity,binding:inputs?.binding,state:result.state,reason:result.reason,fair:result.selectedFairPoints,limitations:result.limitations})});
  const unavailable=reason=>{result.reason=reason;return finish();};
  if(inputs?.state!=='BOUND')return unavailable(inputs?.reason||'Graham inputs unavailable');
  result.mode=inputs.authority.mode;result.inputBinding=inputs.binding;
  if(result.mode==='OFF')return unavailable('Walters authority OFF');
  const events=list(feed?.events).filter(e=>String(e.eventId||e.id)===String(selection.eventId));
  if(events.length!==1)return unavailable('Exact feed event unavailable or ambiguous');
  const event=events[0];
  if(!/^usa-nfl$/.test(event.league?.slug||'') || !['home','away'].includes(quote?.side) || quote.side!==selection.side || quote.marketKey!=='spread' || String(quote.eventId)!==String(selection.eventId) || !finite(quote.line))return unavailable('NFL full-game quote identity mismatch');
  const kickoff=Date.parse(selection.eventDate);
  if(!Number.isFinite(kickoff) || kickoff!==Date.parse(event.date) || Date.parse(report.ts)>=kickoff)return unavailable('Kickoff identity mismatch or event started');
  const games=inputs.board.games.filter(g=>g.home===teamAbbr(event.home) && g.away===teamAbbr(event.away) && Date.parse(g.startTimePacific)===kickoff);
  if(games.length!==1)return unavailable('Exact ordered teams and kickoff do not identify one Graham game');
  const game=games[0],d=game.fairDecomposition;
  result.gameKey=game.gameKey;result.sourceAsOf=game.grahamAsOf;result.boardUpdatedAt=inputs.board.updatedAt;
  result.sourcePath=inputs.boardPath;result.sourceUrl=`https://api.github.com/repos/fhvsvzpmkw-design/-betting-edge-terminal/git/blobs/${inputs.binding.blobs[inputs.boardPath]}`;
  if(!Number.isFinite(Date.parse(game.grahamAsOf)) || Date.parse(game.grahamAsOf)>Date.parse(report.ts) || !list(game.sourceRefs).length)return unavailable('Fair source timing or lineage missing/future');
  if(!finite(game.grahamExactFairHome) || d?.arithmeticVerified!==true || !close(d.exactFairHome,game.grahamExactFairHome) || !close(d.displayedFairHome,game.grahamFairHome) || !close(d.neutralTeamBaseHome+d.homeFieldPointsToHomeSpread+d.otherGovernedPointsToHomeSpread+d.personnelPointsToHomeSpread+d.matchupPointsToHomeSpread,game.grahamExactFairHome))return unavailable('Fair decomposition missing or inconsistent');
  if(game.qbPerformanceStatus!=='OPERATIONAL_SCOPED_APPLIED' || game.qbPerformanceAuthorityToken!=='APPROVED_WALTERS_QB_PERFORMANCE')return unavailable('QB production is unresolved; preserved fair cannot be adopted');
  if(!String(game.numberStatus).startsWith('READY') || !String(inputs.board.baselineStatus).startsWith('TUESDAY_BASELINE_COMPLETE'))return unavailable('Graham baseline/fair not ready');
  result.homeFairPoints=game.grahamExactFairHome;
  result.selectedFairPoints=quote.side==='home'?game.grahamExactFairHome:-game.grahamExactFairHome;
  result.selectedLinePoints=quote.side==='home'?quote.line:-quote.line;
  result.pointMargin=result.selectedLinePoints-result.selectedFairPoints;
  result.supportsPointReview=result.pointMargin>1e-8;
  result.sourceAgeHours=(Date.parse(report.ts)-Date.parse(game.grahamAsOf))/3600000;
  result.sourceRefs=game.sourceRefs;
  result.limitations=['CURRENT_INFORMATION_REVALIDATION_REQUIRED','NO_CALIBRATED_COVER_PROBABILITY_OR_UNCERTAINTY_RANGE'];
  if(game.weeklyRatingInput?.state!=='COMPLETE')result.limitations.push('WEEKLY_RATING_INPUT_NOT_COMPLETE');
  if(list(game.personnelUnresolvedCases).length)result.limitations.push('UNRESOLVED_PERSONNEL_CASES');
  if(list(game.personnelBlockedGroups).length)result.limitations.push('BLOCKED_PERSONNEL_GROUPS');
  if(list(game.qbPerformanceFailClosedTeams).length)result.limitations.push('QB_FAIL_CLOSED_TEAMS');
  result.unresolvedInputs={weeklyRatingInput:game.weeklyRatingInput||null,personnelCases:list(game.personnelUnresolvedCases),personnelGroups:list(game.personnelBlockedGroups),qbTeams:list(game.qbPerformanceFailClosedTeams),numberStatus:game.numberStatus};
  result.state='EXACT_FAIR_REQUIRES_REVIEW';result.reason='Native fair in selected-side points; not EV, a range or a betting decision';
  return finish();
}
export function reviewGrahamHandoff({handoff,receipt,report}) {
  if(!handoff)return {required:false,complete:true,missing:[]};
  const review=receipt?.candidateAssessment?.grahamFairReview,rec=receipt?.decision;
  const missing=[];
  if(!review || review.recordId!==handoff.recordId || review.selectionKey!==receipt?.quote?.selectionKey || review.selectionKey!==handoff.selectionKey || !['ADOPTED_FAIR','CONTEXT','REJECTED','UNAVAILABLE'].includes(review.disposition) || !text(review.rationale) || !text(review.decisionImpact) || review.status!==rec?.status || !(Date.parse(review.checkedAt)>=Date.parse(report.feedGeneratedAt)&&Date.parse(review.checkedAt)<=Date.parse(report.ts)))missing.push('GRAHAM_FAIR_DISPOSITION_REQUIRED');
  if(!isDeepStrictEqual(rec?.grahamFairReview,review))missing.push('GRAHAM_CARD_DECISION_IMPACT_REQUIRED');
  if(handoff.state==='UNAVAILABLE' && review?.disposition!=='UNAVAILABLE')missing.push('GRAHAM_UNAVAILABLE_FAIR_CANNOT_BE_ADOPTED');
  if(handoff.state!=='UNAVAILABLE') {
    if(review?.disposition==='UNAVAILABLE')missing.push('GRAHAM_EXACT_FAIR_REQUIRES_EXPLICIT_DISPOSITION');
    if(!list(handoff.limitations).every(code=>list(review?.limitationsAddressed).some(x=>x.code===code&&text(x.explanation))))missing.push('GRAHAM_LIMITATIONS_REVIEW_REQUIRED');
    const sourceIds=list(review?.currentSourceIds),sources=list(rec?.sourceEvidence);
    if(!sourceIds.length || !sourceIds.every(id=>sources.some(s=>s.id===id && String(s.eventId)===String(handoff.eventId) && ['OFFICIAL','REPORTING'].includes(s.kind) && /^https?:\/\//.test(s.url||'') && text(s.finding) && Date.parse(s.checkedAt)>=Date.parse(report.feedGeneratedAt) && Date.parse(s.checkedAt)<=Date.parse(report.ts))))missing.push('GRAHAM_CURRENT_SOURCE_REVALIDATION_REQUIRED');
  }
  if(review?.disposition!=='ADOPTED_FAIR' && rec?.fairValueEvidence?.grahamHandoffRecordId===handoff.recordId)missing.push('GRAHAM_DISPOSITION_CONFLICTS_WITH_ADOPTED_FAIR');
  if(review?.disposition==='ADOPTED_FAIR') {
    const fair=rec?.fairValueEvidence,w=rec?.waltersEvidence;
    const boundSource=list(rec?.sourceEvidence).find(source=>source.kind==='MODEL' && source.url===handoff.sourceUrl && source.asOf===handoff.sourceAsOf && String(source.eventId)===String(handoff.eventId) && text(source.finding));
    if(!boundSource || !list(fair?.inputs).some(input=>list(input.sourceIds).includes(boundSource.id)))missing.push('GRAHAM_ADOPTION_SOURCE_LINEAGE_REQUIRED');
    if(handoff.mode!=='BET_AUTHORITY' || fair?.unit!=='selection_spread_points' || !close(fair.estimate,handoff.selectedFairPoints) || fair.selectionKey!==handoff.selectionKey || fair.grahamHandoffRecordId!==handoff.recordId || !['CORE_FAIR_INPUT','BET_ORIGINATOR'].includes(w?.contribution) || w.availability!=='AVAILABLE')missing.push('GRAHAM_ADOPTION_NOT_BOUND_TO_FAIR');
  }
  return {required:true,complete:missing.length===0,missing,disposition:review?.disposition||null,rationale:review?.rationale||null,decisionImpact:review?.decisionImpact||null};
}
