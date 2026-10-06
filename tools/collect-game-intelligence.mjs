#!/usr/bin/env node
// Shared acquisition: one board per sport/date, one summary per event, cached
// across report lanes. No odds API requests and no language-model calls.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {mergedFeedEvents,derivePrimarySelectionInventory} from './major-sport-market-coverage-gate.mjs';
import {forecastCandidate} from './forecast-evidence.mjs';
import {teamAbbr} from './graham-market-utils.mjs';
import {list,number,digest,readOptional,eventIdentity,sameEvent,recordId,validateCapture} from './game-intelligence.mjs';
import {loadForecastSourceRegistry} from './forecast-evidence.mjs';
import {mlbScheduleUrl,parseOfficialMlb} from './official-personnel.mjs';

export const ROUTES={NFL:'football/nfl',NCAAF:'football/college-football',CFL:'football/cfl',MLB:'baseball/mlb',NBA:'basketball/nba',WNBA:'basketball/wnba',NHL:'hockey/nhl'};
export const NFELO_URL='https://raw.githubusercontent.com/greerreNFL/nfelo/main/output_data/nfelo_games.csv';
export const BET_BETTER_FROM='2026-10-06T17:05:06Z';
export const BET_BETTER_SPORTS=['NFL','NCAAF','MLB','NBA','WNBA','NHL'];
export const betBetterUrl=sport=>`https://betbetter.world/predicted-scores/${sport.toLowerCase()}?format=csv`;
const time=x=>Date.parse(x||'');
const date=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const norm=x=>String(x||'').toLowerCase().replace(/^la /,'los angeles ').replace(/[^a-z0-9]/g,'');
const json=x=>JSON.stringify(x,null,2)+'\n';
export function parseCsv(text) {
  text=text.replace(/^\uFEFF/,'');
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(field);field='';}
    else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw Error('Incomplete CSV');
  if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  const header=rows.shift()||[];
  return rows.filter(r=>r.length===header.length).map(r=>Object.fromEntries(header.map((key,i)=>[key,r[i]])));
}
function betBetterKickoff(row) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date_utc||'')||!/^\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(row.time_utc||''))return null;
  const value=`${row.date_utc}T${row.time_utc}${/(?:Z|[+-]\d{2}:\d{2})$/.test(row.time_utc)?'':'Z'}`;
  return Number.isFinite(time(value))?new Date(value).toISOString():null;
}
function betBetterTeam(label,team,sport) {
  if(sport==='NFL')return teamAbbr(label)===teamAbbr(team);
  const clean=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  return clean(label)!==''&&clean(label)===clean(team);
}
export function parseBetBetter(rows,event,observedAt,registry) {
  if(!BET_BETTER_SPORTS.includes(event.sport)||time(observedAt)>=time(event.startTime))return [];
  const matches=list(rows).filter(row=>row.locked!==true&&row.locked!=='true'&&
    time(betBetterKickoff(row))===time(event.startTime)&&betBetterTeam(row.away_team,event.away,event.sport)&&betBetterTeam(row.home_team,event.home,event.sport));
  if(matches.length!==1)return [];
  const row=matches[0],margin=number(row.home_margin),total=number(row.total),p=number(row.home_win_prob);
  // The documented score export omits unpriced rows. A fixture shell or locked
  // pick is not a model. Never fill its probability with 50% or a book price.
  if(margin===null||total===null||total<0)return [];
  const url=`https://betbetter.world/predicted-scores/${event.sport.toLowerCase()}`,output=[],inputUrl=betBetterUrl(event.sport);
  const make=fields=>makeRecord(event,'bet_better',registry.sources.bet_better,observedAt,{url,inputUrl,
    evidenceRef:`${inputUrl}#${digest(row)}`,attribution:'Bet Better — https://betbetter.world',licence:'CC BY 4.0',sourceValues:row,...fields});
  const homeScore=number(row.pred_home_score),awayScore=number(row.pred_away_score);
  if(homeScore!==null&&homeScore<0||awayScore!==null&&awayScore<0)return [];
  if(homeScore!==null&&awayScore!==null&&
    (Math.abs(homeScore-awayScore-margin)>.11||Math.abs(homeScore+awayScore-total)>.11))return [];
  const spreadDetail={MLB:'full_game_primary_run_line',NHL:'full_game_primary_puck_line'}[event.sport]||'full_game_primary_spread';
  output.push(make({kind:'SCORE_CONTEXT',marketDetail:spreadDetail,side:'home',line:null,
    projection:{homeSpread:-margin,...(homeScore!==null&&awayScore!==null?{homeScore,awayScore}:{})},sourceField:'home_margin',
    limitation:'Published home winning margin is negated to the home handicap convention. Native points only; no cover probability is inferred.'}));
  output.push(make({kind:'SCORE_CONTEXT',marketDetail:'full_game_primary_total',side:'over',line:null,
    projection:{total},sourceField:'total',limitation:'Published projected combined score only; not an exact Over/Under probability or uncertainty interval.'}));
  if(p!==null&&p>0&&p<1)output.push(make({kind:'OUTCOME_PROBABILITY',marketDetail:'full_game_moneyline',side:'home',line:null,
    probability:p,probabilityBasis:'UNKNOWN',settlement:null,sourceField:'home_win_prob',
    limitation:'Published home-win probability is preserved as supplied. Full-game overtime/tie/refund interpretation, model time and current personnel require an actual source/applicability review; no away complement is invented.'}));
  return output;
}
export function matchEspnEvent(event,rows) {
  const matches=list(rows).filter(row=>{
    const competition=row.competitions?.[0];
    if(time(competition?.date||row.date)!==time(event.startTime))return false;
    return ['home','away'].every(side=>{
      const team=list(competition.competitors).find(c=>c.homeAway===side)?.team;
      if(event.sport==='NFL')return teamAbbr(event[side])===teamAbbr(team?.abbreviation);
      return [team?.displayName,team?.shortDisplayName,team?.name].some(n=>norm(n)===norm(event[side]));
    });
  });
  return matches.length===1?matches[0]:null;
}
function makeRecord(event,sourceId,source,observedAt,fields) {
  const row={...event,sourceId,modelFamily:source.modelFamily,marketDependence:source.marketDependence,
    state:'PRE_GAME',period:'FULL_GAME',forecastAt:null,observedAt,timingBasis:'OBSERVED_PREGAME_SNAPSHOT',...fields};
  row.excerpt=`${row.sourceField}: ${row.probability??row.projection?.homeSpread??row.projection?.total??'published value'}`;
  row.limitation ||= 'Publisher model calculation time is not supplied. Current event, personnel and settlement applicability require review.';
  row.capture={observedAt,sourceUrl:row.url,eventLabel:`${event.away} @ ${event.home}`,probabilityField:row.sourceField,
    publishedProbability:row.probability??null,pageState:'PRE_GAME',evidenceRef:row.evidenceRef};
  row.recordId=recordId(row);
  return row;
}
export function parseNfelo(rows,event,espn,observedAt,registry) {
  const week=espn?.week?.number,season=espn?.season?.year;
  if(!week||!season)return [];
  const alias=abbr=>({WSH:'WAS',LA:'LAR',OAK:'LV',SD:'LAC',STL:'LAR'}[abbr]||abbr);
  const matches=rows.filter(row=>{
    const [year,w,away,home]=String(row.game_id).split('_');
    return Number(year)===season&&Number(w)===week&&alias(home)===teamAbbr(event.home)&&alias(away)===teamAbbr(event.away);
  });
  if(matches.length!==1)return [];
  const row=matches[0],source=registry.sources.nfelo,output=[];
  const make=fields=>makeRecord(event,'nfelo',source,observedAt,{url:'https://www.nfeloapp.com/games',inputUrl:NFELO_URL,
    evidenceRef:`${NFELO_URL}#${row.game_id}`,sourceGameId:row.game_id,...fields});
  const probability=number(row.nfelo_home_probability_close),fair=number(row.nfelo_home_line_close),line=number(row.home_line_close);
  if(probability!==null) output.push(make({kind:'OUTCOME_PROBABILITY',marketDetail:'full_game_moneyline',side:'home',line:null,
    probability,probabilityBasis:'UNKNOWN',settlement:null,sourceField:'nfelo_home_probability_close',
    limitation:'NFL tie treatment for this win field is not established; display as a published model value until reviewed.'}));
  if(fair!==null)output.push(make({kind:'PROJECTED_SPREAD',marketDetail:'full_game_primary_spread',side:'home',line:null,
    projection:{homeSpread:fair},sourceField:'nfelo_home_line_close'}));
  for(const side of ['home','away']) {
    const p=number(row[`nfelo_${side}_cover_prob_close`]),push=number(row[`nfelo_${side}_push_prob_close`]),loss=number(row[`nfelo_${side}_loss_prob_close`]);
    if(line===null||p===null||push===null||loss===null||Math.abs(p+push+loss-1)>0.0003)continue;
    output.push(make({kind:'OUTCOME_PROBABILITY',marketDetail:'full_game_primary_spread',side,line:side==='home'?line:-line,
      probability:p,pushProbability:push,probabilityBasis:'UNCONDITIONAL',settlement:{includesOvertime:true,pushRule:Number.isInteger(line)?'REFUND':'NO_PUSH'},
      sourceField:`nfelo_${side}_cover_prob_close`,sourceValues:{cover:p,push,loss,homeLine:line},
      limitation:'Market-regressed nfelo probability at its published line. A changed line requires a different probability; personnel applicability remains to review.'}));
  }
  return output;
}
export function parseEspn(summary,event,observedAt,registry) {
  const competition=summary.header?.competitions?.[0];
  if(competition?.status?.type?.state!=='pre'||time(competition.date)!==time(event.startTime)||time(observedAt)>=time(event.startTime))return {records:[],facts:[]};
  if(!matchEspnEvent(event,[{competitions:[competition]}]))throw Error('ESPN summary identity changed');
  const url=`https://www.espn.com/${event.sport.toLowerCase()==='ncaaf'?'college-football':event.sport.toLowerCase()}/game/_/gameId/${summary.header.id}`;
  const records=[];
  const homeProjection=number(summary.predictor?.homeTeam?.gameProjection),awayProjection=number(summary.predictor?.awayTeam?.gameProjection);
  const noTie=['MLB','NBA','WNBA','NHL'].includes(event.sport)&&homeProjection!==null&&awayProjection!==null&&Math.abs(homeProjection+awayProjection-100)<=.11;
  for(const side of ['home','away']) {
    const prediction=summary.predictor?.[`${side}Team`];
    const team=list(competition.competitors).find(c=>c.homeAway===side);
    const p=number(prediction?.gameProjection);
    if(!prediction||String(prediction.id)!==String(team?.id)||p===null||p<0||p>100)continue;
    records.push(makeRecord(event,'espn',registry.sources.espn,observedAt,{kind:'OUTCOME_PROBABILITY',
      marketDetail:'full_game_moneyline',side,line:null,probability:p/100,probabilityBasis:noTie?'UNCONDITIONAL':'UNKNOWN',
      settlement:noTie?{includesOvertime:true,pushRule:'NO_PUSH'}:null,...(noTie?{pushProbability:0}:{}),url,
      evidenceRef:`ESPN:${summary.header.id}:predictor`,sourceField:`predictor.${side}Team.gameProjection`,
      limitation:noTie?'Published whole-game win forecast for a no-draw game; verify current personnel and your book’s settlement. Model calculation time is not supplied.':
        'Published matchup probability. Settlement/tie convention and model calculation time are not supplied; no invented complement or expected return.'}));
  }
  const facts=[];
  const add=(kind,details)=>{if(details!=null)facts.push({...event,sourceId:'espn',url,observedAt,kind,details,requiresCurrentApplicabilityReview:true});};
  add('VENUE',summary.gameInfo?.venue?{name:summary.gameInfo.venue.fullName,indoor:summary.gameInfo.venue.indoor,neutralSite:competition.neutralSite}:null);
  if(summary.gameInfo?.weather)add('WEATHER',summary.gameInfo.weather);
  for(const group of list(summary.injuries)) {
    add('INJURIES',{team:group.team?.displayName||group.team?.abbreviation,players:list(group.injuries).map(i=>({
      name:i.athlete?.displayName,status:i.status,updatedAt:i.date||null,position:i.athlete?.position?.abbreviation,
      detail:i.details?.detail||i.details?.type||null}))});
  }
  for(const team of list(competition.competitors))add('TEAM_RECORD',{team:team.team?.displayName,records:list(team.record||team.records).map(r=>({type:r.type,summary:r.summary,displayValue:r.displayValue}))});
  // Raw scores and dates, not an invented predictive adjustment for a streak.
  for(const team of list(summary.lastFiveGames))add('RECENT_GAMES',{team:team.team?.displayName,events:list(team.events).map(g=>({date:g.gameDate||g.date,opponent:g.opponent?.displayName,score:g.score,result:g.gameResult}))});
  return {records,facts};
}

async function pool(items,fn,concurrency=3) {
  let next=0;const output=[];
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(next<items.length){const i=next++;output[i]=await fn(items[i]);}}));
  return output;
}
export async function collect({root=process.cwd(),at=new Date().toISOString(),fetchImpl=fetch,force=false}={}) {
  if(!Number.isFinite(time(at)))throw Error('Actual collection time required');
  const startedAt=time(at),elapsedStart=Date.now(),clock=()=>new Date(startedAt+Date.now()-elapsedStart).toISOString();
  const registry=loadForecastSourceRegistry(root),feed=readOptional(path.join(root,'data/live-odds.json'));
  if(!feed)throw Error('Live event inventory unavailable');
  const events=[...mergedFeedEvents(feed).values()].map(eventIdentity).filter(e=>ROUTES[e.sport]&&time(e.startTime)>time(at)&&time(e.startTime)-time(at)<=48*3600000);
  const prior=readOptional(path.join(root,'data/game-intelligence/current.json'));
  const previousUsable=prior&&time(prior.collectedAt)<=time(at);
  const records=previousUsable?list(prior.records).filter(r=>events.some(e=>sameEvent(r,e))):[];
  const facts=previousUsable?list(prior.facts).filter(r=>events.some(e=>sameEvent(r,e))):[];
  const policy=readOptional(path.join(root,'data/major-sport-market-coverage-v1.json'));
  const inventory=policy?derivePrimarySelectionInventory({ts:at,feedGeneratedAt:feed.generatedAt},feed,policy):{selections:[]};
  const quoteRows=list(inventory.selections).flatMap(selection=>list(selection.quotes).map(quote=>{
    const c=forecastCandidate({...selection,quote},{feed});
    return {eventId:c.eventId,startTime:c.startTime,sport:c.sport,marketDetail:c.marketDetail,side:c.side,line:c.line,
      book:quote.book,priceDecimal:quote.priceDecimal,observedAt:quote.quoteObservedAt||quote.quoteUpdatedAt};
  }));
  const quoteGroups=new Map();
  for(const q of [...(previousUsable?list(prior.quoteHistory):[]),...quoteRows]){
    if(!events.some(e=>sameEvent(q,e))||!Number.isFinite(time(q.observedAt))||time(q.observedAt)>time(at))continue;
    const key=[q.eventId,q.startTime,q.book,q.marketDetail,q.side].join('|');
    if(!quoteGroups.has(key))quoteGroups.set(key,new Map());quoteGroups.get(key).set(q.observedAt,q);
  }
  const quoteHistory=[...quoteGroups.values()].flatMap(group=>[...group.values()].sort((a,b)=>time(b.observedAt)-time(a.observedAt)).slice(0,2));
  const requests=[],sources=[],cache=previousUsable?{...prior.requestCache}:{};
  async function get(url,format='json') {
    const response=await fetchImpl(url,{headers:{Accept:format==='json'?'application/json':'text/csv','User-Agent':'VigWireLabs-GameIntelligence/1.0'},signal:AbortSignal.timeout(20000)});
    requests.push({url,status:response.status,checkedAt:clock()});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const bytes=await response.text();
    if(bytes.length>8*1024*1024)throw Error('Source response exceeds 8 MiB');
    return format==='json'?JSON.parse(bytes):bytes;
  }
  const boards=new Map(),matches=new Map();
  const boardKeys=[...new Set(events.map(e=>`${e.sport}|${date(e.startTime)}`))];
  await pool(boardKeys,async key=>{
    const [sport,day]=key.split('|'),url=`https://site.api.espn.com/apis/site/v2/sports/${ROUTES[sport]}/scoreboard?dates=${day.replaceAll('-','')}&limit=300`;
    try{boards.set(key,await get(url));}catch(error){sources.push({sourceId:'espn',scope:key,state:'UNAVAILABLE',checkedAt:clock(),reason:error.message,url});}
  });
  for(const event of events){const match=matchEspnEvent(event,boards.get(`${event.sport}|${date(event.startTime)}`)?.events);if(match)matches.set(event.eventId,match);}
  await pool(events,async event=>{
    const match=matches.get(event.eventId),key=`espn:${event.eventId}:${event.startTime}`;
    if(!match){sources.push({sourceId:'espn',eventId:event.eventId,state:'NO_EXACT_EVENT',checkedAt:clock()});return;}
    const competition=match.competitions?.[0];
    if(competition?.status?.type?.state!=='pre'){sources.push({sourceId:'espn',eventId:event.eventId,state:'EVENT_STARTED',checkedAt:clock()});return;}
    const ttl=time(event.startTime)-time(at)<2*3600000?15*60000:60*60000;
    if(!force&&cache[key]&&time(at)-time(cache[key])<ttl){sources.push({sourceId:'espn',eventId:event.eventId,state:'CACHED',checkedAt:cache[key]});return;}
    try {
      const summary=await get(`https://site.api.espn.com/apis/site/v2/sports/${ROUTES[event.sport]}/summary?event=${match.id}`),observedAt=clock();
      const parsed=parseEspn(summary,event,observedAt,registry);
      for(let i=records.length-1;i>=0;i--)if(records[i].sourceId==='espn'&&sameEvent(records[i],event))records.splice(i,1);
      for(let i=facts.length-1;i>=0;i--)if(facts[i].sourceId==='espn'&&sameEvent(facts[i],event))facts.splice(i,1);
      records.push(...parsed.records);facts.push(...parsed.facts);cache[key]=observedAt;
      sources.push({sourceId:'espn',eventId:event.eventId,state:parsed.records.length?'COLLECTED':'CONTEXT_ONLY',records:parsed.records.length,facts:parsed.facts.length,checkedAt:observedAt});
    }catch(error){sources.push({sourceId:'espn',eventId:event.eventId,state:'UNAVAILABLE',checkedAt:clock(),reason:error.message});}
  });
  // One official schedule request serves every MLB side on that date. Keep
  // original source clocks independent from the latest executable price clock.
  const mlbDays=[...new Set(events.filter(e=>e.sport==='MLB').map(e=>date(e.startTime)))];
  await pool(mlbDays,async day=>{
    const url=mlbScheduleUrl(day),key=`mlb_official:${day}`;
    const due=force||!cache[key]||time(at)-time(cache[key])>=15*60000;
    if(!due){sources.push({sourceId:'mlb_official',scope:day,state:'CACHED',checkedAt:cache[key],url});return;}
    try{
      const schedule=await get(url),observedAt=clock();
      for(const event of events.filter(e=>e.sport==='MLB'&&date(e.startTime)===day)){
        const parsed=parseOfficialMlb(schedule,event,observedAt,url);
        for(let i=facts.length-1;i>=0;i--)if(facts[i].sourceId==='mlb_official'&&sameEvent(facts[i],event))facts.splice(i,1);
        facts.push(...parsed.facts);
        sources.push({sourceId:'mlb_official',eventId:event.eventId,state:parsed.state,checkedAt:observedAt,url});
      }
      cache[key]=observedAt;
    }catch(error){sources.push({sourceId:'mlb_official',scope:day,state:'UNAVAILABLE',checkedAt:clock(),reason:error.message,url});}
  });
  const nfl=events.filter(e=>e.sport==='NFL'&&matches.has(e.eventId));
  if(nfl.length) {
    const due=force||!cache.nfelo||time(at)-time(cache.nfelo)>=30*60000||nfl.some(event=>!records.some(r=>r.sourceId==='nfelo'&&sameEvent(r,event)));
    if(!due)sources.push({sourceId:'nfelo',state:'CACHED',checkedAt:cache.nfelo});
    else try {
      const rows=parseCsv(await get(NFELO_URL,'csv')),observedAt=clock();let count=0;
      for(const event of nfl) {
        if(matches.get(event.eventId).competitions?.[0]?.status?.type?.state!=='pre'||time(observedAt)>=time(event.startTime))continue;
        const parsed=parseNfelo(rows,event,matches.get(event.eventId),observedAt,registry);
        for(let i=records.length-1;i>=0;i--)if(records[i].sourceId==='nfelo'&&sameEvent(records[i],event))records.splice(i,1);
        records.push(...parsed);count+=parsed.length;
      }
      cache.nfelo=observedAt;sources.push({sourceId:'nfelo',state:count?'COLLECTED':'NO_EXACT_EVENT',records:count,checkedAt:observedAt,url:NFELO_URL});
    }catch(error){sources.push({sourceId:'nfelo',state:'UNAVAILABLE',checkedAt:clock(),reason:error.message,url:NFELO_URL});}
  }
  if(registry.sources.bet_better&&time(at)>=time(BET_BETTER_FROM))await pool([...new Set(events.filter(event=>BET_BETTER_SPORTS.includes(event.sport)).map(event=>event.sport))],async sport=>{
    const key=`bet_better:${sport}`,url=betBetterUrl(sport),sportEvents=events.filter(event=>event.sport===sport);
    const complete=sportEvents.every(event=>records.some(row=>row.sourceId==='bet_better'&&sameEvent(row,event)));
    if(!force&&complete&&cache[key]&&time(at)-time(cache[key])<15*60000){sources.push({sourceId:'bet_better',scope:sport,state:'CACHED',checkedAt:cache[key],url});return;}
    try {
      const csv=await get(url,'csv'),rows=parseCsv(csv),observedAt=clock();
      const header=csv.split(/\r?\n/,1)[0].replace(/^\uFEFF/,'').split(',').map(field=>field.replace(/^"|"$/g,''));
      if(new Set(header).size!==header.length||!['date_utc','time_utc','away_team','home_team','home_margin','total','home_win_prob'].every(field=>header.includes(field)))throw Error('Documented Bet Better score-export columns are unavailable');
      let count=0;
      for(const event of sportEvents){
        const parsed=parseBetBetter(rows,event,observedAt,registry);
        for(let i=records.length-1;i>=0;i--)if(records[i].sourceId==='bet_better'&&sameEvent(records[i],event))records.splice(i,1);
        records.push(...parsed);count+=parsed.length;
        sources.push({sourceId:'bet_better',scope:sport,eventId:event.eventId,state:parsed.length?'COLLECTED':'NO_EXACT_EVENT',
          records:parsed.length,checkedAt:observedAt,url,reason:parsed.length?null:'No unique priced row with exact ordered teams and UTC kickoff. Empty, locked and mismatched rows are not forecasts.'});
      }
      cache[key]=observedAt;sources.push({sourceId:'bet_better',scope:sport,state:count?'COLLECTED':'NO_EXACT_EVENT',records:count,checkedAt:observedAt,url});
    }catch(error){sources.push({sourceId:'bet_better',scope:sport,state:'UNAVAILABLE',checkedAt:clock(),reason:error.message,url});}
  });
  for(const [sourceId,source] of Object.entries(registry.sources)){
    if(['espn','nfelo','bet_better'].includes(sourceId)||source.collection?.sports&&!events.some(event=>source.collection.sports.includes(event.sport)))continue;
    sources.push({sourceId,state:'RESEARCH_OR_LICENSED_IMPORT',reason:source.collection?.reason||'No verified automated feed configured. Use a permitted source capture; do not infer coverage from the source name.',
      automatedReuse:source.automatedReuse||'NO_API_OR_LICENSE_ASSUMED',urls:source.routes||Object.values(source.sportBoards||{})});
  }
  const capture={schema:1,collectedAt:clock(),feedGeneratedAt:feed.generatedAt,records,facts,quoteHistory,sources,requestCache:cache,
    acquisition:{requests:requests.length,oddsApiRequests:0,modelCalls:0,receipts:requests}};
  capture.snapshotId=digest(capture);
  validateCapture(capture,registry);
  return capture;
}
export function saveCapture(root,capture) {
  if(capture.snapshotId!==digest(Object.fromEntries(Object.entries(capture).filter(([key])=>key!=='snapshotId'))))throw Error('Capture digest mismatch');
  const dir=path.join(root,'data/game-intelligence/captures',capture.collectedAt.slice(0,10));fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,`${capture.snapshotId}.json`),bytes=json(capture);
  if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')!==bytes)throw Error('Immutable collection collision');
  if(!fs.existsSync(file))fs.writeFileSync(file,bytes,{flag:'wx'});
  const current=path.join(root,'data/game-intelligence/current.json'),prior=readOptional(current);
  if(prior&&time(prior.collectedAt)>time(capture.collectedAt))throw Error('Cannot replace newer collection');
  const temp=current+'.tmp';fs.writeFileSync(temp,bytes);fs.renameSync(temp,current);
  return file;
}
export function mergeCapture(prior,incoming,registry){
  validateCapture(incoming,registry);
  if(prior&&time(incoming.collectedAt)<time(prior.collectedAt))throw Error('Import collection time is older than the current store; original observedAt still remains unchanged');
  const records=new Map(list(prior?.records).map(row=>[row.recordId,row]));
  for(const row of incoming.records){
    if(records.has(row.recordId)&&!isDeepStrictEqual(records.get(row.recordId),row))throw Error('Conflicting immutable source record');
    records.set(row.recordId,row);
  }
  const importedSources=[...new Set(incoming.records.map(r=>r.sourceId))];
  const output={schema:1,collectedAt:incoming.collectedAt,feedGeneratedAt:incoming.feedGeneratedAt||prior?.feedGeneratedAt||null,
    records:[...records.values()],facts:[...list(prior?.facts),...list(incoming.facts)],quoteHistory:list(prior?.quoteHistory),
    sources:[...list(prior?.sources).filter(s=>!importedSources.includes(s.sourceId)),...importedSources.map(sourceId=>({sourceId,state:'COLLECTED',checkedAt:incoming.collectedAt,acquisition:'PERMITTED_STRUCTURED_IMPORT'}))],
    requestCache:prior?.requestCache||{},acquisition:{requests:0,oddsApiRequests:0,modelCalls:0,mode:'STRUCTURED_IMPORT'}};
  output.snapshotId=digest(output);return validateCapture(output,registry);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1],root=path.resolve(args.includes('--root')?value('--root'):'.');
    const capture=args.includes('--import')?mergeCapture(readOptional(path.join(root,'data/game-intelligence/current.json')),JSON.parse(fs.readFileSync(value('--import'))),loadForecastSourceRegistry(root)):
      await collect({root,at:args.includes('--at')?value('--at'):undefined,force:args.includes('--force')});
    saveCapture(root,capture);console.log(json({snapshotId:capture.snapshotId,collectedAt:capture.collectedAt,records:capture.records.length,facts:capture.facts.length,sources:capture.sources,acquisition:capture.acquisition}));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
