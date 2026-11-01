#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';

const require=createRequire(import.meta.url),blue=require('../assets/guy-blue-line.js');
const list=x=>Array.isArray(x)?x:[],time=x=>Date.parse(x||''),finite=Number.isFinite;
const fail=code=>{throw Error('GUY_DAILY_SELECTION:'+code);};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const gitBlobSha=bytes=>createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const same=isDeepStrictEqual;
const copy=structuredClone;
const text=x=>typeof x==='string'&&x.trim().length>0;
const fresh=(observedAt,at,minutes)=>finite(time(observedAt))&&time(observedAt)<=time(at)&&time(at)-time(observedAt)<=minutes*60000;
const cutoff=(start,policy)=>new Date(time(start)-policy.lockMinutesBeforeSelectedGame*60000).toISOString();
const identity=(a,b)=>String(a.eventId)===String(b.eventId)&&a.home===b.home&&a.away===b.away&&time(a.startTime)===time(b.startTime);
const validUrl=x=>{try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
export function americanPriceLimit(decimal){
  if(!finite(decimal)||decimal<=1)fail('PRICE_LIMIT_INVALID');
  const american=Math.ceil((decimal>=2?(decimal-1)*100:-100/(decimal-1))-1e-9);
  return (american>0?'+':'')+american;
}
const decimalFromAmerican=american=>Number(american)>0?1+Number(american)/100:1+100/-Number(american);
const normalized=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
function personnelSnapshot(game,at){
  const latest=new Map();
  for(const fact of list(game?.facts).filter(f=>['INJURIES','LINEUP','STARTING_LINEUP','LINEUP_CHANGES'].includes(f.kind)&&time(f.observedAt)<=time(at))){
    const team=fact.details?.team;if(![game.home,game.away].includes(team))continue;
    const players=list(fact.details?.players||fact.details?.starters||fact.details?.changes).map(p=>({name:typeof p==='string'?p:p.name||p.player,status:typeof p==='string'?'listed':p.status||p.role||'listed'}))
      .filter(p=>text(p.name)).sort((a,b)=>normalized(a.name).localeCompare(normalized(b.name))||normalized(a.status).localeCompare(normalized(b.status)));
    const semantic={players:players.map(p=>({name:normalized(p.name),status:normalized(p.status)})),summary:players.length?null:normalized(fact.details?.summary)};
    const key=fact.kind+'|'+normalized(team),old=latest.get(key);
    if(!old||time(fact.observedAt)>time(old.observedAt))latest.set(key,{key,team,observedAt:fact.observedAt,players,semantic});
  }
  return [...latest.values()].sort((a,b)=>a.key.localeCompare(b.key));
}

function lineupChange(call,game,at){
  if(!game)return null;
  const prior=new Map(list(call.personnelSnapshot).map(row=>[row.key,row]));
  for(const row of personnelSnapshot(game,at)){
    if(time(row.observedAt)<=time(call.research?.lineup?.observedAt))continue;
    const old=prior.get(row.key);if(old&&same(old.semantic,row.semantic))continue;
    const oldPlayers=new Map(list(old?.players).map(p=>[normalized(p.name),p])),newPlayers=new Map(row.players.map(p=>[normalized(p.name),p]));
    const names=[...new Set([...oldPlayers.keys(),...newPlayers.keys()])].filter(name=>normalized(oldPlayers.get(name)?.status)!==normalized(newPlayers.get(name)?.status))
      .map(name=>newPlayers.get(name)?.name||oldPlayers.get(name)?.name);
    return {state:'RESEARCH_REQUIRED',reviewType:'LINEUP',requirementAt:row.observedAt,affectedNames:names,reason:`Newer personnel information needs a lineup recheck for ${row.team}${names.length?': '+names.join(', '):'.'}`};
  }
  return null;
}

export const DEFAULT_POLICY={schema:1,id:'guy-researched-daily-call-v1',characterId:'guy-laflame',
  effectiveFrom:'2026-11-01T00:00:00-07:00',timeZone:'America/Vancouver',sport:'NHL',market:'full_game_moneyline',
  shortlistGames:3,maxQuoteAgeMinutes:75,maxForecastAgeMinutes:75,maxResearchAgeMinutes:360,
  lockMinutesBeforeSelectedGame:1,riskUnits:1,onePickPerDay:true,requiresHumanResearch:true,
  preservesMoneyPuckBenchmark:true,newOddsRequestsAllowed:false};

function checkPolicy(policy){
  if(policy?.schema!==1||policy.id!==DEFAULT_POLICY.id||policy.characterId!=='guy-laflame'||policy.timeZone!=='America/Vancouver'
    ||policy.sport!=='NHL'||policy.market!=='full_game_moneyline'||policy.shortlistGames!==3||policy.lockMinutesBeforeSelectedGame!==1
    ||policy.riskUnits!==1||policy.onePickPerDay!==true||policy.newOddsRequestsAllowed!==false
    ||!finite(time(policy.effectiveFrom))||!['maxQuoteAgeMinutes','maxForecastAgeMinutes','maxResearchAgeMinutes'].every(k=>finite(policy[k])&&policy[k]>0))fail('POLICY_INVALID');
}

function eligibleGames(board,{at,date,policy}){
  if(!fresh(board?.asOf,at,policy.maxQuoteAgeMinutes))return [];
  return list(board.games).filter(game=>game.sport==='NHL'&&list(board.games).filter(g=>String(g.eventId)===String(game.eventId)).length===1&&blue.day(game.startTime)===date
    &&finite(time(game.startTime))&&time(at)<time(cutoff(game.startTime,policy))).map(game=>({...game,
    markets:list(game.markets).map(m=>({...m,quotes:list(m.quotes).filter(q=>fresh(q.observedAt,at,policy.maxQuoteAgeMinutes)).map(q=>({...q,
      benchmark:fresh(q.benchmark?.observedAt,at,policy.maxQuoteAgeMinutes)?q.benchmark:null}))})),
    externalModels:list(game.externalModels).filter(m=>fresh(m.observedAt,at,policy.maxForecastAgeMinutes))}));
}

export function buildShortlist(board,{at=new Date().toISOString(),date=blue.day(at),policy=DEFAULT_POLICY}={}){
  checkPolicy(policy);if(!finite(time(at))||!date)fail('CLOCK_INVALID');
  const games=eligibleGames(board,{at,date,policy}),rows=blue.selectBoard({...board,games},{date}).rows
    .filter(row=>finite(row.probability)&&finite(row.edge)&&finite(row.priceDecimal)&&row.priceDecimal>1).slice(0,policy.shortlistGames);
  return {schema:1,policyId:policy.id,date,asOf:at,boardAsOf:board?.asOf||null,
    activationState:time(at)>=time(policy.effectiveFrom)?'ACTIVE':'PRELAUNCH',
    rows:rows.map(row=>({...row,expectedProfitPer100:Number(((row.probability*row.priceDecimal-1)*100).toFixed(2)),
      goalieFacts:list(games.find(g=>String(g.eventId)===row.eventId)?.facts).filter(f=>['STARTING_GOALIE','GOALIE','GOALIES'].includes(f.kind)),
      hockeyFacts:list(games.find(g=>String(g.eventId)===row.eventId)?.facts).filter(f=>['INJURIES','LINEUP','STARTING_LINEUP','LINEUP_CHANGES','STARTING_GOALIE','GOALIE','GOALIES','VENUE','REST','TRAVEL'].includes(f.kind))})),
    limitation:'MoneyPuck orders a three-game research shortlist. Guy must make a source-backed hockey choice; no model probability or VigScope grade is changed.'};
}

function sectionEvidence(section,researchedAt,policy,label){
  if(!section||!text(section.summary)||!fresh(section.observedAt,researchedAt,policy.maxResearchAgeMinutes)||!list(section.sourceRefs).length)fail('EVIDENCE_REQUIRED:'+label);
  for(const source of section.sourceRefs)if(!validUrl(source?.url)||!fresh(source.observedAt,researchedAt,policy.maxResearchAgeMinutes))fail('SOURCE_REQUIRED:'+label);
}

function validateGoalies(goalies,game,researchedAt,policy){
  if(list(goalies).length!==2||new Set(goalies.map(g=>g.team)).size!==2)fail('BOTH_GOALIES_REQUIRED');
  for(const goalie of goalies){
    if(![game.home,game.away].includes(goalie.team)||!text(goalie.name)||!['CONFIRMED','PROJECTED'].includes(goalie.status))fail('GOALIE_IDENTITY_REQUIRED');
    sectionEvidence({...goalie,summary:goalie.name},researchedAt,policy,'goalies');
    if(goalie.status==='PROJECTED'&&(!finite(time(goalie.recheckAt))||time(goalie.recheckAt)<=time(researchedAt)
      ||time(goalie.recheckAt)>time(cutoff(game.startTime,policy))))fail('PROJECTED_GOALIE_RECHECK_REQUIRED');
  }
}

function sideQuote(game,side,boardAsOf,at,policy){
  const pair=blue.moneyPuckPair(game,boardAsOf);
  if(!pair||!fresh(pair.home.observedAt,at,policy.maxForecastAgeMinutes))return null;
  const choices=list(game.markets).filter(m=>m.marketDetail==='full_game_moneyline'&&m.side===side).flatMap(m=>list(m.quotes))
    .filter(q=>q.side===side&&q.line==null&&text(q.book)&&q.book.toLowerCase()!=='pinnacle'&&finite(q.priceDecimal)&&q.priceDecimal>1
      &&fresh(q.observedAt,at,policy.maxQuoteAgeMinutes)&&time(q.observedAt)<=time(boardAsOf)&&time(q.observedAt)<time(game.startTime))
    .sort((a,b)=>b.priceDecimal-a.priceDecimal||time(b.observedAt)-time(a.observedAt)||a.book.localeCompare(b.book));
  if(!choices.length)return null;
  const q=choices[0],probability=pair[side].probability;
  return {...q,probability,breakEven:1/q.priceDecimal,edge:(probability-1/q.priceDecimal)*100,
    marketEdge:finite(q.benchmark?.edgeProbabilityPoints)&&fresh(q.benchmark?.observedAt,at,policy.maxQuoteAgeMinutes)?q.benchmark.edgeProbabilityPoints:null,
    modelObservedAt:pair.home.observedAt,modelRecordIds:[pair.home.recordId,pair.away.recordId],modelUrl:pair.home.url,
    modelComponent:finite(pair.home.marketBlendObservation?.modelHomeProbability)?side==='home'?pair.home.marketBlendObservation.modelHomeProbability:1-pair.home.marketBlendObservation.modelHomeProbability:null,
    marketBlended:pair.home.marketBlendObservation?.observedEqualWeightBlend===true};
}

function goalieChange(call,game,at){
  for(const goalie of list(call.research?.goalies)){
    const review=(reason,requirementAt)=>({state:'GOALIE_RECHECK_REQUIRED',reason,requirementAt,affectedTeams:[goalie.team]});
    if(goalie.status==='PROJECTED'&&time(at)>=time(goalie.recheckAt))return review('Projected starter needs its scheduled recheck: '+goalie.team+'.',goalie.recheckAt);
    for(const fact of list(game?.facts).filter(f=>time(f.observedAt)>time(goalie.observedAt)&&time(f.observedAt)<=time(at))){
      if(['STARTING_GOALIE','GOALIE','GOALIES'].includes(fact.kind)&&fact.details?.team===goalie.team){
        const name=fact.details.name||fact.details.player;
        if(!name||name.toLowerCase()!==goalie.name.toLowerCase())return review('Newer goalie information requires review for '+goalie.team+'.',fact.observedAt);
      }
      if(fact.kind==='INJURIES'&&fact.details?.team===goalie.team&&list(fact.details.players).some(p=>String(p.name).toLowerCase()===goalie.name.toLowerCase()
        &&/out|injured.reserve|suspend|inactive/i.test(String(p.status))))return review('Newer unavailable-goalie report requires review for '+goalie.team+'.',fact.observedAt);
    }
  }
  return null;
}

export function validateResearch(staging,{board,at=new Date().toISOString(),policy=DEFAULT_POLICY,sourceBoardBytes=null}={}){
  checkPolicy(policy);
  if(staging?.schema!==1||staging.state!=='READY'||staging.policyId!==policy.id||!text(staging.researchId)||staging.date!==blue.day(at)
    ||!fresh(staging.researchedAt,at,policy.maxResearchAgeMinutes)||!fresh(staging.boardAsOf,staging.researchedAt,policy.maxQuoteAgeMinutes)
    ||time(staging.boardAsOf)>time(board?.asOf))fail('CURRENT_RESEARCH_REQUIRED');
  if(!/^[0-9a-f]{40}$/.test(staging.sourceBoardBlobSha||'')||!sourceBoardBytes||gitBlobSha(Buffer.from(sourceBoardBytes))!==staging.sourceBoardBlobSha)fail('RESEARCH_SNAPSHOT_REQUIRED');
  const researchBoard=JSON.parse(Buffer.from(sourceBoardBytes).toString('utf8'));
  if(time(researchBoard?.asOf)!==time(staging.boardAsOf))fail('RESEARCH_BOARD_TIME_MISMATCH');
  const shortlist=buildShortlist(researchBoard,{at:staging.researchedAt,date:staging.date,policy});
  if(!shortlist.rows.length)fail('FRESH_SHORTLIST_REQUIRED');
  const candidates=list(staging.candidates),ids=candidates.map(c=>String(c.eventId));
  if(candidates.length!==shortlist.rows.length||new Set(ids).size!==ids.length||shortlist.rows.some(r=>!ids.includes(r.eventId)))fail('FULL_SHORTLIST_REVIEW_REQUIRED');
  for(const candidate of candidates){
    const row=shortlist.rows.find(r=>r.eventId===String(candidate.eventId)),game=researchBoard.games.find(g=>String(g.eventId)===row.eventId);
    if(!identity(candidate,game)||!['home','away'].includes(candidate.preferredSide)||!same(candidate.modelRecordIds,row.modelRecordIds))fail('RESEARCH_IDENTITY_OR_MODEL_CHANGED');
    validateGoalies(candidate.assessment?.goalies,game,staging.researchedAt,policy);
    for(const key of ['lineup','restTravel','fiveOnFive'])sectionEvidence(candidate.assessment?.[key],staging.researchedAt,policy,key);
    if(!text(candidate.supportReason)||!text(candidate.contraryReason))fail('SUPPORT_AND_CONTRARY_REQUIRED');
  }
  const chosen=staging.chosen,candidate=candidates.find(c=>String(c.eventId)===String(chosen?.eventId));
  if(!candidate||chosen.side!==candidate.preferredSide||!finite(chosen.minDecimalPrice)||chosen.minDecimalPrice<=1||!text(chosen.reason))fail('CHOSEN_DECISION_REQUIRED');
  const games=list(board?.games).filter(g=>g.sport==='NHL'&&identity(candidate,g));if(games.length!==1)fail('CURRENT_GAME_IDENTITY_REQUIRED');
  const game=games[0],row=shortlist.rows.find(r=>r.eventId===String(chosen.eventId));
  if(!fresh(board?.asOf,at,policy.maxQuoteAgeMinutes)||time(at)>=time(cutoff(game.startTime,policy)))fail('FRESH_PREGAME_BOARD_REQUIRED');
  const quote=sideQuote(game,chosen.side,board.asOf,at,policy);if(!quote)fail('FRESH_CHOSEN_PRICE_REQUIRED');
  const originalPair=blue.moneyPuckPair(researchBoard.games.find(g=>identity(candidate,g)),researchBoard.asOf);
  if(!originalPair||Math.abs(originalPair[chosen.side].probability-quote.probability)>1e-12)fail('MODEL_CHANGED_REVIEW_REQUIRED');
  const originalComponent=originalPair.home.marketBlendObservation?.modelHomeProbability;
  if(finite(originalComponent)&&(!finite(quote.modelComponent)||Math.abs((chosen.side==='home'?originalComponent:1-originalComponent)-quote.modelComponent)>1e-12))fail('MODEL_COMPONENT_CHANGED_REVIEW_REQUIRED');
  const playToAmerican=americanPriceLimit(chosen.minDecimalPrice),minDecimalPrice=decimalFromAmerican(playToAmerican);
  if(quote.priceDecimal+1e-12<minDecimalPrice)fail('PRICE_OUTSIDE_LIMIT');
  if((row.side!==chosen.side||quote.edge<=0)&&!text(chosen.modelDisagreementReason))fail('MONEYPUCK_DISAGREEMENT_REASON_REQUIRED');
  const expected=quote.marketEdge===null?'UNAVAILABLE':quote.marketEdge<0?'DISAGREES':'AGREES';
  if(chosen.pinnacleAssessment?.status!==expected||!text(chosen.pinnacleAssessment.reason))fail('PINNACLE_ASSESSMENT_REQUIRED');
  const call={publicationId:null,researchId:staging.researchId,eventId:String(game.eventId),home:game.home,away:game.away,startTime:game.startTime,
    side:chosen.side,team:game[chosen.side],book:quote.book,priceDecimal:quote.priceDecimal,americanOdds:blue.american(quote.priceDecimal),
    quoteObservedAt:quote.observedAt,selectionKey:quote.selectionKey||null,modelObservedAt:quote.modelObservedAt,modelRecordIds:quote.modelRecordIds,
    modelUrl:quote.modelUrl,modelComponent:quote.modelComponent,marketBlended:quote.marketBlended,probability:quote.probability,breakEven:quote.breakEven,edge:quote.edge,marketEdge:quote.marketEdge,
    expectedProfitPer100:Number(((quote.probability*quote.priceDecimal-1)*100).toFixed(2)),publishedAt:at,researchedAt:staging.researchedAt,
    requestedMinDecimalPrice:chosen.minDecimalPrice,minDecimalPrice,playToAmerican,reason:chosen.reason,
    sourceBoardBlobSha:staging.sourceBoardBlobSha||null,sourceBoardAsOf:staging.boardAsOf,revisionReason:staging.revisionReason||null,
    supportReason:candidate.supportReason,contraryReason:candidate.contraryReason,pinnacleAssessment:copy(chosen.pinnacleAssessment),
    modelDisagreementReason:chosen.modelDisagreementReason||null,research:copy(candidate.assessment),
    personnelSnapshot:personnelSnapshot(researchBoard.games.find(g=>identity(candidate,g)),staging.researchedAt),
    shortlistReviewed:candidates.map(c=>({eventId:String(c.eventId),preferredSide:c.preferredSide,supportReason:c.supportReason,contraryReason:c.contraryReason}))};
  const goalieReason=goalieChange(call,game,at);if(goalieReason)fail('GOALIE_RECHECK_REQUIRED:'+goalieReason.reason);
  const lineupReason=lineupChange(call,game,at);if(lineupReason)fail('LINEUP_RECHECK_REQUIRED:'+lineupReason.reason);
  call.publicationId=digest({researchId:staging.researchId,eventId:call.eventId,side:call.side,book:call.book,priceDecimal:call.priceDecimal,
    quoteObservedAt:call.quoteObservedAt,researchedAt:staging.researchedAt});
  return {call,shortlist};
}

function assessCall(entry,board,at,policy){
  if(entry.reviewRequired?.researchId===entry.call?.researchId){
    const {researchId,detectedAt,...review}=entry.reviewRequired;return {...review,checkedAt:at};
  }
  const call=entry.call,game=list(board?.games).find(g=>identity(g,call));
  const goalieReason=goalieChange(call,game,at);
  if(goalieReason)return {...goalieReason,checkedAt:at};
  const lineupReason=lineupChange(call,game,at);if(lineupReason)return {...lineupReason,checkedAt:at};
  const quote=game&&fresh(board?.asOf,at,policy.maxQuoteAgeMinutes)?sideQuote(game,call.side,board.asOf,at,policy):null;
  if(!quote)return {state:'PRICE_EXPIRED',checkedAt:at,reason:'A current eligible quote and MoneyPuck forecast are required before following this call.'};
  const currentQuote={book:quote.book,priceDecimal:quote.priceDecimal,americanOdds:blue.american(quote.priceDecimal),observedAt:quote.observedAt,modelObservedAt:quote.modelObservedAt,
    marketEdge:quote.marketEdge,pinnacleStatus:quote.marketEdge===null?'UNAVAILABLE':quote.marketEdge<0?'DISAGREES':'AGREES'};
  if(quote.priceDecimal<call.minDecimalPrice)return {state:'PRICE_OUTSIDE_LIMIT',checkedAt:at,currentQuote,reason:'The latest available price is worse than Guy’s published limit.'};
  if(quote.marketEdge!==null&&quote.marketEdge<0&&call.pinnacleAssessment?.status!=='DISAGREES')
    return {state:'RESEARCH_REQUIRED',checkedAt:at,currentQuote,reason:'The current Pinnacle comparison is newly unfavorable; Guy must explain that disagreement before this call is actionable again.'};
  if(Math.abs(quote.probability-call.probability)>1e-12)return {state:'RESEARCH_REQUIRED',checkedAt:at,currentQuote,reason:'The captured model forecast changed; recheck the hockey decision without rewriting the published call.'};
  if(finite(call.modelComponent)&&(!finite(quote.modelComponent)||Math.abs(quote.modelComponent-call.modelComponent)>1e-12))return {state:'RESEARCH_REQUIRED',checkedAt:at,currentQuote,reason:'The underlying captured model component changed; recheck the hockey decision.'};
  if(!fresh(call.researchedAt,at,policy.maxResearchAgeMinutes))return {state:'RESEARCH_REQUIRED',checkedAt:at,currentQuote,reason:'The hockey review needs refreshing.'};
  if(entry.state==='LOCKED')return {state:'LOCKED',checkedAt:at,currentQuote,reason:'Published selection and price are frozen for grading.'};
  return {state:'CURRENT',checkedAt:at,currentQuote,reason:'Current quote remains inside the published price limit.'};
}

function settle(entry,results,at){
  if(entry.state!=='LOCKED'||['WIN','LOSS'].includes(entry.result?.grade))return;
  const c=entry.call,r=list(results).find(r=>String(r.eventId)===c.eventId&&time(r.startTime)===time(c.startTime)&&r.state==='FINAL'
    &&finite(time(r.verifiedAt))&&time(r.verifiedAt)<=time(at));
  if(!r||time(at)<=time(c.startTime))return;
  if(r.special||r.sport&&r.sport!=='NHL'||!Number.isInteger(r.homeScore)||!Number.isInteger(r.awayScore)||r.homeScore<0||r.awayScore<0
    ||r.homeScore===r.awayScore||time(r.verifiedAt)<time(c.startTime)||!validUrl(r.url)){
    entry.result={grade:'UNRESOLVED',netUnits:null,reason:'Final settlement needs review',verifiedAt:r.verifiedAt,url:r.url};return;
  }
  const win=c.side==='home'?r.homeScore>r.awayScore:r.awayScore>r.homeScore;
  entry.result={grade:win?'WIN':'LOSS',riskUnits:1,netUnits:win?c.priceDecimal-1:-1,homeScore:r.homeScore,awayScore:r.awayScore,verifiedAt:r.verifiedAt,url:r.url};
}

export function newCallsLedger(at,policy=DEFAULT_POLICY){return {schema:1,characterId:'guy-laflame',policyId:policy.id,startedAt:at,updatedAt:at,
  effectiveFrom:policy.effectiveFrom,entries:[],processedResearchIds:[],limitation:'Guy’s actual published daily calls. The existing MoneyPuck peak-edge benchmark and its history remain separate and unchanged.'};}

export function callsSummary(ledger){
  const picks=list(ledger?.entries).filter(e=>e.state==='LOCKED'&&e.call),settled=picks.filter(e=>['WIN','LOSS'].includes(e.result?.grade)&&finite(e.result.netUnits));
  const netUnits=settled.reduce((s,e)=>s+e.result.netUnits,0);
  return {picks:picks.length,settled:settled.length,wins:settled.filter(e=>e.result.grade==='WIN').length,losses:settled.filter(e=>e.result.grade==='LOSS').length,
    pending:picks.length-settled.length,netUnits,roiPct:settled.length?netUnits/settled.length*100:null};
}

// Publication is committed only while its own game is still open. A workflow
// may spend time building the page after selection, so it must repeat this
// check against the remote ledger immediately before committing and pushing.
export function assertPublicationWindow(previousLedger,nextLedger,{at=new Date().toISOString()}={}){
  if(!finite(time(at)))fail('CLOCK_INVALID');
  const known=new Set(list(previousLedger?.entries).flatMap(e=>[e.call,...list(e.publications)]).filter(Boolean).map(c=>c.publicationId));
  for(const entry of list(nextLedger?.entries)){
    const added=[entry.call,...list(entry.publications)].filter(c=>c?.publicationId&&!known.has(c.publicationId));
    for(const publication of added){
      const lockAt=cutoff(publication.startTime,DEFAULT_POLICY);
      if(time(at)>=time(lockAt))fail('PUBLICATION_WINDOW_CLOSED:'+publication.publicationId);
    }
  }
  return true;
}

export function updateCallsLedger(previous,board,{staging=null,at=new Date().toISOString(),results=[],policy=DEFAULT_POLICY,sourceBoardBytes=null}={}){
  checkPolicy(policy);if(!finite(time(at)))fail('CLOCK_INVALID');
  const ledger=copy(previous||newCallsLedger(at,policy));
  if(ledger.schema!==1||ledger.characterId!=='guy-laflame'||ledger.policyId!==policy.id||!Array.isArray(ledger.entries)||!Array.isArray(ledger.processedResearchIds)
    ||!finite(time(ledger.updatedAt))||time(at)<time(ledger.updatedAt))fail('LEDGER_INVALID_OR_OUT_OF_ORDER');
  const before=JSON.stringify(ledger);
  for(const entry of ledger.entries){
    if(entry.state==='WATCHING'&&time(at)>=time(entry.lockAt)){entry.state='LOCKED';entry.lockConfirmedAt=at;entry.lockedPublicationId=entry.call.publicationId;}
    settle(entry,results,at);
    entry.liveStatus=assessCall(entry,board,at,policy);
    if(['GOALIE_RECHECK_REQUIRED','RESEARCH_REQUIRED'].includes(entry.liveStatus.state)&&!entry.reviewRequired)
      entry.reviewRequired={researchId:entry.call.researchId,state:entry.liveStatus.state,detectedAt:at,reason:entry.liveStatus.reason,
        ...(entry.liveStatus.reviewType?{reviewType:entry.liveStatus.reviewType}:{}),
        ...(entry.liveStatus.requirementAt?{requirementAt:entry.liveStatus.requirementAt}:{}),
        ...(entry.liveStatus.affectedNames?{affectedNames:entry.liveStatus.affectedNames}:{}),
        ...(entry.liveStatus.affectedTeams?{affectedTeams:entry.liveStatus.affectedTeams}:{})};
  }
  if(time(at)>=time(policy.effectiveFrom)&&staging?.state==='READY'&&staging.date===blue.day(at)){
    const old=ledger.entries.find(e=>e.date===staging.date);
    const processed=ledger.processedResearchIds.find(item=>item.researchId===staging.researchId),stagingDigest=digest(staging);
    if(processed&&processed.digest!==stagingDigest)fail('RESEARCH_ID_REUSED_WITH_DIFFERENT_BYTES');
    if(!processed&&old?.state!=='LOCKED'){
      const {call}=validateResearch(staging,{board,at,policy,sourceBoardBytes});
      if(old&&time(staging.researchedAt)<=time(old.call.researchedAt))fail('RESEARCH_NOT_NEWER_THAN_PUBLISHED_CALL');
      if(old&&!text(staging.revisionReason))fail('REVISION_REASON_REQUIRED');
      if(old&&identity(old.call,call)){
        const review=old.reviewRequired,requiredAt=review?.requirementAt||review?.detectedAt;
        if(review?.state==='GOALIE_RECHECK_REQUIRED'&&call.research.goalies.some(g=>(!list(review.affectedTeams).length||review.affectedTeams.includes(g.team))&&time(g.observedAt)<time(requiredAt)))fail('NEW_GOALIE_REVIEW_REQUIRED');
        if(review?.reviewType==='LINEUP'&&time(call.research.lineup.observedAt)<time(requiredAt))fail('NEW_LINEUP_REVIEW_REQUIRED');
      }
      const publication={...copy(call),previousPublicationId:old?.call?.publicationId||null};
      const entry=old||{date:staging.date,state:'WATCHING',firstPublishedAt:at,publications:[]};
      entry.call=call;delete entry.reviewRequired;entry.lockAt=cutoff(call.startTime,policy);entry.publications.push(publication);entry.liveStatus=assessCall(entry,board,at,policy);
      if(!old)ledger.entries.push(entry);
      ledger.processedResearchIds.push({researchId:staging.researchId,digest:stagingDigest,publicationId:call.publicationId,recordedAt:at});
    }
  }
  ledger.entries.sort((a,b)=>a.date.localeCompare(b.date));ledger.summary=callsSummary(ledger);
  // Checks retain their last evidence timestamp when the status/value is the
  // same. A timer alone must not create an endless publication chain.
  for(const entry of ledger.entries){const old=list(previous?.entries).find(e=>e.date===entry.date);if(old&&same({...old.liveStatus,checkedAt:null},{...entry.liveStatus,checkedAt:null}))entry.liveStatus=copy(old.liveStatus);}
  if(JSON.stringify(ledger)!==before)ledger.updatedAt=at;
  return ledger;
}

export function publish({root=process.cwd(),at=new Date().toISOString(),refreshOnly=false,stagingPath='data/characters/guy-laflame/call-staging.json'}={}){
  const read=p=>fs.existsSync(path.join(root,p))?JSON.parse(fs.readFileSync(path.join(root,p),'utf8')):null;
  const policy=read('data/characters/guy-laflame/selection-policy.json')||DEFAULT_POLICY,board=read('data/game-intelligence/board.json');
  const sourcePath=path.resolve(root,stagingPath);
  const staging=refreshOnly?null:fs.existsSync(sourcePath)?JSON.parse(fs.readFileSync(sourcePath,'utf8')):null;
  let sourceBoardBytes=null;
  if(staging?.sourceBoardBlobSha){
    if(!/^[0-9a-f]{40}$/.test(staging.sourceBoardBlobSha))fail('RESEARCH_SNAPSHOT_INVALID');
    sourceBoardBytes=execFileSync('git',['cat-file','blob',staging.sourceBoardBlobSha],{cwd:root,maxBuffer:16*1024*1024});
  }
  const ledger=updateCallsLedger(read('data/characters/guy-laflame/calls-ledger.json'),board,{staging,sourceBoardBytes,
    at,policy,results:read('data/game-intelligence/performance.json')?.results||board?.sourcePerformance?.results||[]});
  const file=path.join(root,'data/characters/guy-laflame/calls-ledger.json'),bytes=JSON.stringify(ledger,null,2)+'\n';
  fs.mkdirSync(path.dirname(file),{recursive:true});if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==bytes)fs.writeFileSync(file,bytes);
  return ledger;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const args=process.argv.slice(2),options={},flags=new Set(['--shortlist','--refresh-only']),values=new Set(['--root','--at','--date','--staging']);
    for(let i=0;i<args.length;i++){
      const arg=args[i];if(Object.hasOwn(options,arg)||!flags.has(arg)&&!values.has(arg))fail('CLI_USAGE');
      if(flags.has(arg))options[arg]=true;
      else {if(!args[i+1]||args[i+1].startsWith('--'))fail('CLI_VALUE_REQUIRED:'+arg);options[arg]=args[++i];}
    }
    if(options['--shortlist']&&(options['--staging']||options['--refresh-only'])||options['--date']&&!options['--shortlist'])fail('CLI_USAGE');
    const value=flag=>options[flag],root=path.resolve(value('--root')||'.');
    if(args.includes('--shortlist')){
      const policyFile=path.join(root,'data/characters/guy-laflame/selection-policy.json'),policy=fs.existsSync(policyFile)?JSON.parse(fs.readFileSync(policyFile,'utf8')):DEFAULT_POLICY;
      const bytes=fs.readFileSync(path.join(root,'data/game-intelligence/board.json'));
      const shortlist=buildShortlist(JSON.parse(bytes),{policy,at:args.includes('--at')?value('--at'):undefined,...(args.includes('--date')?{date:value('--date')}:{})});
      console.log(JSON.stringify({...shortlist,sourceBoard:{path:'data/game-intelligence/board.json',blobSha:gitBlobSha(bytes),asOf:JSON.parse(bytes).asOf}},null,2));
    }else{
      const at=value('--at')||new Date().toISOString(),ledger=publish({root,at,refreshOnly:options['--refresh-only']===true,...(value('--staging')?{stagingPath:value('--staging')}:{})});
      const entry=ledger.entries.find(e=>e.date===blue.day(at));
      console.log(JSON.stringify({updatedAt:ledger.updatedAt,date:blue.day(at),state:entry?.liveStatus?.state||(time(at)<time(ledger.effectiveFrom)?'PRELAUNCH':'AWAITING_RESEARCH'),
        callState:entry?.state||null,researchId:entry?.call?.researchId||null,publicationId:entry?.call?.publicationId||null,...ledger.summary}));
    }
  }catch(error){console.error(error.message);process.exitCode=1;}
}
