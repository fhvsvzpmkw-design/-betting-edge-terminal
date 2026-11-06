// Public, publisher-linked source collection for the existing shared dossier.
// A captured pick or point estimate is never a probability or betting decision.
import {createHash} from 'node:crypto';
const list=x=>Array.isArray(x)?x:[];
const time=x=>Date.parse(x||'');
const number=x=>x!==null&&x!==undefined&&String(x).trim()!==''&&String(x).trim()!=='.'&&Number.isFinite(Number(x))?Number(x):null;
const id=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const key=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/\bst\.?\b/g,'state').replace(/[^a-z0-9]/g,'');
const easternDate=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
const aliases={'nyjets':'newyorkjets','nygiants':'newyorkgiants','lac':'losangeleschargers','laachargers':'losangeleschargers',
  'lachargers':'losangeleschargers','lar':'losangelesrams','larams':'losangelesrams','laclippers':'losangelesclippers',
  'lalakers':'losangeleslakers','jac':'jax','pho':'phx','gs':'gsw','no':'nop','ny':'nyk','sa':'sas'};
const canonical=x=>aliases[key(x)]||key(x);
export function sourceTeamMatches(label,event,side){
  const labels=[event[side],...list(event.sourceAliases?.[side])];
  return labels.some(value=>canonical(value)===canonical(label));
}
export function parseSourceCsv(text){
  const rows=[];let row=[],value='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(value);value='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value='';}
    else value+=c;
  }
  if(quoted)throw Error('Unclosed CSV field');
  if(value||row.length){row.push(value);rows.push(row);}
  const header=rows.shift()?.map(x=>x.replace(/^\uFEFF/,'').trim());
  if(!header||new Set(header).size!==header.length)throw Error('Invalid source CSV header');
  return rows.map(values=>Object.fromEntries(header.map((h,i)=>[h,values[i]?.trim()??''])));
}
const models=[
  {id:'SAGARIN',name:'Sagarin',fields:['linesag'],url:'https://sagarin.com/'},
  {id:'MASSEY',name:'Massey',fields:['linemassey','linemass'],url:'https://masseyratings.com/'},
  {id:'DUNKEL',name:'Dunkel',fields:['linedunkel','linedunk'],url:'https://www.dunkelindex.com/'},
  {id:'SONNY_MOORE',name:'Sonny Moore',fields:['linemoore'],url:'https://sonnymoorepowerratings.com/'},
  {sourceId:'dratings',name:'DRatings',fields:['linedonchess','linedonc'],url:'https://www.dratings.com/'},
  {sourceId:'espn',name:'ESPN',fields:['lineespn','linefpi'],url:'https://www.espn.com/'}
];
export const TRACKER_ROUTES={NFL:{page:'https://www.thepredictiontracker.com/prednfl.html',csv:'https://www.thepredictiontracker.com/nflpredictions.csv'},
  NCAAF:{page:'https://www.thepredictiontracker.com/predncaa.html',csv:'https://www.thepredictiontracker.com/ncaapredictions.csv'},
  NBA:{page:'https://www.thepredictiontracker.com/prednba.html',csv:'https://www.thepredictiontracker.com/nbapreds.csv'}};
export const BETTINGPROS_PUBLIC_PAGE='https://www.bettingpros.com/nfl/picks/';
export function trackerPublication(html,sport,observedAt){
  const plain=String(html).replace(/<[^>]*>/g,' '),nba=plain.match(/Games of\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+Updated\s+([^\n<]+)/i);
  const updated=plain.match(/Updated:\s*([A-Za-z]+,\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+[^\n<]+)/i);
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const date=nba?`${nba[3]}-${nba[1].padStart(2,'0')}-${nba[2].padStart(2,'0')}`:updated?
    `${updated[4]}-${String(months.findIndex(m=>m.toLowerCase()===updated[2].toLowerCase())+1).padStart(2,'0')}-${updated[3].padStart(2,'0')}`:null;
  if(!date||!Number.isFinite(time(date)))throw Error('Publisher board date unavailable');
  const age=(time(easternDate(observedAt))-time(date))/86400000;
  if(age<0||age>3)throw Error('Publisher board date is future or older than three days');
  if(sport==='NBA'&&!nba)throw Error('NBA game date missing');
  return {date,label:(nba?`Games of ${nba[1]}/${nba[2]}/${nba[3]} Updated ${nba[4]}`:updated[1]).trim(),timeZone:'NOT_PUBLISHED'};
}
export function parsePredictionTracker({csv,html,sport,events,observedAt,registry}){
  const route=TRACKER_ROUTES[sport];if(!route)throw Error('Unsupported tracker sport');
  const publication=trackerPublication(html,sport,observedAt),rows=parseSourceCsv(csv),output=[],seen=new Set();
  if(rows.some(row=>!('home'in row)||!('road'in row)||!('line'in row)))throw Error('Tracker identity columns missing');
  for(const row of rows){
    const matches=events.filter(event=>event.sport===sport&&time(event.startTime)>time(observedAt)&&
      sourceTeamMatches(row.home,event,'home')&&sourceTeamMatches(row.road,event,'away')&&
      (sport!=='NBA'||easternDate(event.startTime)===publication.date));
    if(matches.length!==1)continue;
    const event=matches[0],eventKey=event.eventId+'|'+event.startTime;if(seen.has(eventKey))throw Error('Duplicate tracker event row');seen.add(eventKey);
    for(const model of models){
      const field=model.fields.find(field=>number(row[field])!==null);if(!field)continue;
      const value=number(row[field]);if(Math.abs(value)>100)continue;
      const record={schema:1,...event,sourceAliases:undefined,kind:'MODEL_PROJECTION',sourceId:'prediction_tracker',
        originId:model.sourceId?registry.sources[model.sourceId].modelFamily:model.id,originName:model.name,originUrl:model.url,
        sourceField:field,sourceRecordId:[sport,row.home,row.road,field,publication.date].join('|'),
        marketDetail:'full_game_primary_spread',period:'FULL_GAME',side:'home',line:null,
        projection:{homeSpread:-value},sourceReferenceLine:number(row.line)===null?null:-number(row.line),
        publishedAt:null,publisherDate:publication.date,publisherTimeLabel:publication.label,observedAt,
        url:route.page,inputUrl:route.csv,access:'PUBLIC_PUBLISHER_CSV',state:'PRE_GAME',
        originalConvention:'Positive source value is the home winning margin; home spread is its negative.',
        excerpt:`${model.name}: home winning margin ${value} points.`,
        limitation:'Catalog attribution to the named originating model. Model calculation time, personnel assumptions and statistical independence are unverified. No probability, executable price or betting fair is supplied.'};
      delete record.sourceAliases;record.recordId=id(record);output.push(record);
    }
  }
  return output;
}
function utcSchedule(value){return typeof value==='string'&&/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)?value.replace(' ','T')+'Z':value;}
export function parseBettingProsPublic({html,events,observedAt}){
  const output=[];
  for(const match of String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    if(!/type\s*=\s*["']application\/json["']/i.test(match[1])||!/class\s*=\s*["'][^"']*\bisland-props\b/i.test(match[1]))continue;
    let data;try{data=JSON.parse(match[2]);}catch{continue;}
    // Only the public featured pick deliberately rendered on this page. Never
    // walk offers, locked events, private users, props or inferred API endpoints.
    const pick=data.showPickOfTheDay===true?data.pickOfTheDayPick:null;
    if(!pick||pick.status!=='active'||pick.player_id!=null||list(pick.parlay).length||pick.event?.status!=='created'||
      pick.is_free===false||pick.is_locked===true||pick.is_premium===true)continue;
    if(!/^(?:spread|moneyline|total|points total)$/i.test(String(pick.sub_label||'').trim()))continue;
    const start=utcSchedule(pick.event.scheduled),participants=list(pick.event.participants);
    const labels=side=>{
      const p=participants.find(p=>p.id===pick.event[side==='home'?'home':'visitor']);
      return [p?.id,p?.name,p?.team?.abbreviation,[p?.team?.city,p?.name].filter(Boolean).join(' ')].filter(Boolean);
    };
    const matches=events.filter(event=>event.sport===pick.sport&&time(event.startTime)===time(start)&&time(start)>time(observedAt)&&
      labels('home').some(x=>sourceTeamMatches(x,event,'home'))&&labels('away').some(x=>sourceTeamMatches(x,event,'away')));
    if(matches.length!==1||!pick.user?.username||!pick.line)continue;
    const event=matches[0],type=pick.line.type,side=type==='total'?String(pick.selection?.selection||'').toLowerCase():
      pick.team_id===pick.event.home?'home':pick.team_id===pick.event.visitor?'away':null;
    if(!['home','away','over','under'].includes(side)||!['moneyline','spread','total'].includes(type))continue;
    const line=type==='moneyline'?null:number(pick.line.line),american=number(pick.line.cost);
    if(type!=='moneyline'&&line===null||american!==null&&Math.abs(american)<100)continue;
    const record={schema:1,...event,sourceAliases:undefined,kind:'EXPERT_PICK',sourceId:'bettingpros',
      originId:`BETTINGPROS_AUTHOR:${pick.user.username.toLowerCase()}`,originName:pick.user.name||pick.user.username,
      sourceRecordId:String(pick.id),sourceField:'pickOfTheDayPick',sourceMarketLabel:pick.sub_label,marketDetail:type==='moneyline'?'full_game_moneyline':
        type==='spread'?'full_game_primary_spread':'full_game_primary_total',period:'FULL_GAME',side,line,
      priceAmerican:american,publishedAt:null,publisherTimeLabel:pick.published||null,observedAt,
      url:BETTINGPROS_PUBLIC_PAGE,access:'PUBLIC_FEATURED_PICK',state:'PRE_GAME',excerpt:String(pick.label||'Published featured pick'),
      limitation:'Public featured pick only; not the full BettingPros expert feed. Original publication timezone and independently verified long-term performance are unavailable. This is a directional pick, not a probability.'};
    delete record.sourceAliases;record.recordId=id(record);output.push(record);
  }
  return [...new Map(output.map(row=>[row.recordId,row])).values()];
}
export async function collectCuratedSources({events,get,prior,registry,at,clock=()=>at,force=false}){
  const config=registry.curatedAggregation;if(config?.enabled!==true||time(at)<time(config.effectiveFrom))return {picks:[],sources:[],cache:{}};
  const picks=list(prior?.curatedPicks).filter(row=>events.some(event=>event.eventId===row.eventId&&time(event.startTime)===time(row.startTime))),sources=[],cache={};
  const replace=(sourceId,sport,rows)=>{for(let i=picks.length-1;i>=0;i--)if(picks[i].sourceId===sourceId&&(!sport||picks[i].sport===sport))picks.splice(i,1);picks.push(...rows);};
  for(const sport of [...new Set(events.map(e=>e.sport))].filter(sport=>TRACKER_ROUTES[sport])){
    const scope=`curated:prediction_tracker:${sport}`,last=prior?.requestCache?.[scope],route=TRACKER_ROUTES[sport];
    if(!force&&last&&time(at)-time(last)<60*60000){sources.push({sourceId:'prediction_tracker',scope:sport,state:'CACHED',checkedAt:last,records:picks.filter(p=>p.sourceId==='prediction_tracker'&&p.sport===sport).length});continue;}
    try{
      const html=await get(route.page,'html'),csv=await get(route.csv,'csv'),observedAt=clock();
      const rows=parsePredictionTracker({csv,html,sport,events,observedAt,registry});replace('prediction_tracker',sport,rows);cache[scope]=observedAt;
      sources.push({sourceId:'prediction_tracker',scope:sport,state:rows.length?'COLLECTED':'NO_EXACT_EVENT',records:rows.length,checkedAt:observedAt,url:route.page,inputUrl:route.csv});
    }catch(error){sources.push({sourceId:'prediction_tracker',scope:sport,state:'UNAVAILABLE',checkedAt:clock(),url:route.page,reason:error.message});}
  }
  if(events.length){
    const scope='curated:bettingpros:featured',last=prior?.requestCache?.[scope];
    if(!force&&last&&time(at)-time(last)<60*60000)sources.push({sourceId:'bettingpros',state:'CACHED',checkedAt:last});
    else try{
      const html=await get(BETTINGPROS_PUBLIC_PAGE,'html'),observedAt=clock(),rows=parseBettingProsPublic({html,events,observedAt});
      replace('bettingpros',null,rows);cache[scope]=observedAt;
      sources.push({sourceId:'bettingpros',state:rows.length?'COLLECTED':'NO_CURRENT_PUBLIC_PICK',records:rows.length,checkedAt:observedAt,url:BETTINGPROS_PUBLIC_PAGE,
        reason:'Public featured pick only; full expert feed and paid picks are not connected.'});
    }catch(error){sources.push({sourceId:'bettingpros',state:'UNAVAILABLE',checkedAt:clock(),url:BETTINGPROS_PUBLIC_PAGE,reason:error.message});}
  }
  return {picks,sources,cache};
}
