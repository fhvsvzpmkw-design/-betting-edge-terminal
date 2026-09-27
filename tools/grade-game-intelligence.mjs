#!/usr/bin/env node
// Prospective source scoring. Uses only snapshots actually observed pregame.
// This does not change card grades, issued decisions or the betting ledger.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {list,readOptional,number} from './game-intelligence.mjs';
import {ROUTES,matchEspnEvent} from './collect-game-intelligence.mjs';
const time=x=>Date.parse(x||'');
const day=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
export function latestForecasts(captures,at){
  const latest=new Map();
  for(const capture of captures)for(const row of list(capture.records)){
    if(row.kind!=='OUTCOME_PROBABILITY'||row.state!=='PRE_GAME'||time(row.observedAt)>=time(row.startTime)||time(row.observedAt)>time(at)||time(capture.collectedAt)>time(at))continue;
    const key=[row.sourceId,row.sport,row.eventId,row.startTime,row.marketDetail,row.side].join('|');
    if(!latest.has(key)||time(row.observedAt)>time(latest.get(key).observedAt))latest.set(key,row);
  }
  // One orientation per game/market/source; opposing probabilities are not two
  // independent results. Keep the last genuinely observed line for that market.
  const grouped=new Map();
  for(const row of latest.values()){
    const key=[row.sourceId,row.sport,row.eventId,row.startTime,row.marketDetail].join('|');
    const previous=grouped.get(key);
    if(!previous||(['home','over'].includes(row.side)&&!['home','over'].includes(previous.side)))grouped.set(key,row);
  }
  return [...grouped.values()];
}
export function scoreForecast(record,result){
  if(!result||result.state!=='FINAL'||result.eventId!==record.eventId||time(result.startTime)!==time(record.startTime))return {state:'PENDING'};
  if(result.special)return {state:'UNRESOLVED',reason:'Special settlement needs review'};
  const home=number(result.homeScore),away=number(result.awayScore);
  if(home===null||away===null)return {state:'UNRESOLVED',reason:'Final score missing'};
  let margin;
  if(/moneyline/.test(record.marketDetail))margin=record.side==='home'?home-away:away-home;
  else if(/spread|run_line|puck_line/.test(record.marketDetail)&&number(record.line)!==null)margin=(record.side==='home'?home-away:away-home)+record.line;
  else if(/total/.test(record.marketDetail)&&number(record.line)!==null)margin=record.side==='over'?home+away-record.line:record.line-home-away;
  else return {state:'UNRESOLVED',reason:'Unsupported forecast market'};
  if(margin===0)return {state:'PUSH_OR_TIE',brier:null};
  // The game outcome is observable even when a provider leaves its probability
  // basis unspecified. Such rows get an outcome, not a fabricated Brier score.
  const outcome=margin>0?1:0,p=record.probability;
  let scoredProbability=null;
  if(record.probabilityBasis==='CONDITIONAL_ON_NO_PUSH')scoredProbability=p;
  if(record.probabilityBasis==='UNCONDITIONAL'&&number(record.pushProbability)!==null&&record.pushProbability<1)scoredProbability=p/(1-record.pushProbability);
  if(record.probabilityBasis==='UNCONDITIONAL'&&record.settlement?.pushRule==='NO_PUSH')scoredProbability=p;
  return {state:'GRADED',outcome,forecastProbability:p,scoredProbability,
    brier:scoredProbability!==null?(scoredProbability-outcome)**2:null,
    scoringBasis:scoredProbability!==null?'RESOLVED_OUTCOMES':'PUBLISHED_BASIS_UNRESOLVED'};
}
export async function grade({root=process.cwd(),at=new Date().toISOString(),fetchImpl=fetch}={}){
  const dir=path.join(root,'data/game-intelligence/captures'),captures=[];
  if(fs.existsSync(dir))for(const dayName of fs.readdirSync(dir).filter(x=>/^\d{4}-\d\d-\d\d$/.test(x)).sort())
    for(const file of fs.readdirSync(path.join(dir,dayName)).filter(x=>x.endsWith('.json')))captures.push(readOptional(path.join(dir,dayName,file))||{});
  const forecasts=latestForecasts(captures,at),previous=readOptional(path.join(root,'data/game-intelligence/performance.json'));
  const results=new Map(list(previous?.results).map(r=>[`${r.eventId}|${r.startTime}`,r])),boards=new Map(),errors=[];
  const events=[...new Map(forecasts.filter(r=>time(r.startTime)<time(at)-6*3600000).map(r=>[`${r.eventId}|${r.startTime}`,r])).values()];
  for(const event of events){
    const key=`${event.eventId}|${event.startTime}`;if(results.has(key))continue;
    const boardKey=`${event.sport}|${day(event.startTime)}`;
    if(!boards.has(boardKey)){
      const url=`https://site.api.espn.com/apis/site/v2/sports/${ROUTES[event.sport]}/scoreboard?dates=${day(event.startTime).replaceAll('-','')}&limit=300`;
      try{const response=await fetchImpl(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`HTTP ${response.status}`);boards.set(boardKey,{...(await response.json()),url});}
      catch(error){boards.set(boardKey,null);errors.push({scope:boardKey,reason:error.message});}
    }
    const board=boards.get(boardKey),matched=matchEspnEvent(event,board?.events),competition=matched?.competitions?.[0];
    if(competition?.status?.type?.completed!==true)continue;
    const home=list(competition.competitors).find(c=>c.homeAway==='home'),away=list(competition.competitors).find(c=>c.homeAway==='away');
    if(number(home?.score)===null||number(away?.score)===null)continue;
    results.set(key,{eventId:event.eventId,startTime:event.startTime,state:'FINAL',homeScore:Number(home.score),awayScore:Number(away.score),
      special:/shortened|suspend|forfeit/i.test(competition.status.type.description||''),url:board.url,verifiedAt:at});
  }
  const rows=forecasts.map(record=>({recordId:record.recordId,sourceId:record.sourceId,modelFamily:record.modelFamily,eventId:record.eventId,
    startTime:record.startTime,marketDetail:record.marketDetail,side:record.side,line:record.line,observedAt:record.observedAt,
    ...scoreForecast(record,results.get(`${record.eventId}|${record.startTime}`))}));
  const groups=new Map();for(const row of rows){const key=`${row.sourceId}|${row.marketDetail}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  const bySource=[...groups.values()].map(group=>{const scored=group.filter(r=>r.brier!==null&&r.brier!==undefined);return {
    sourceId:group[0].sourceId,marketDetail:group[0].marketDetail,observations:group.length,
    graded:group.filter(r=>r.state==='GRADED').length,pending:group.filter(r=>r.state==='PENDING').length,
    scored:scored.length,brier:scored.length?scored.reduce((n,r)=>n+r.brier,0)/scored.length:null};});
  return {schema:1,asOf:at,counts:{observations:rows.length,graded:rows.filter(r=>r.state==='GRADED').length,
    events:new Set(rows.filter(r=>r.state==='GRADED').map(r=>r.eventId+'|'+r.startTime)).size},bySource,rows,results:[...results.values()],errors,
    population:'Last observed pregame forecast per source, game and market, one orientation. No reconstructed pregame values. Pushes/ties excluded from resolved-outcome Brier.',
    limitation:'Source tracking is prospective and descriptive. No automatic weighting, ROI claim, stake or decision change.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const performance=await grade();fs.mkdirSync('data/game-intelligence',{recursive:true});fs.writeFileSync('data/game-intelligence/performance.json',JSON.stringify(performance,null,2)+'\n');console.log(JSON.stringify(performance.counts));
}
