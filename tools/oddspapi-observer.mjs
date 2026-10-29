import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {annotatePinnacle,AUTHORITY,isFullGameAlternateTotalMarket} from './pinnacle-sharp-benchmark.mjs';
import {majorSportKey} from './primary-sport-identity.mjs';
import {reconcileBudgetState,planOddsPapiBudget,recordBudgetSpend,budgetSummary} from './oddspapi-budget.mjs';
import {formatOddsPapiUsage} from './oddspapi-usage-summary.mjs';

const API_BASE='https://api.oddspapi.io/v4';
const API_KEY=String(process.env.ODDSPAPI_API_KEY||'').trim();
const PRIMARY_FILE=path.join('data','live-odds.json');
const OUTFILE=path.join('data','oddspapi-observer.json');
const BUDGET_FILE=path.join('data','oddspapi-budget-state.json');
const MARKET_CACHE_FILE=path.join('data','oddspapi-market-cache.json');
const RESERVE=5;
const MAX_TOURNAMENT_IDS_PER_REQUEST=5;
export const ODDS_REQUEST_SPACING_MS=1000;
const QUOTE_FRESHNESS_MINUTES=30;
const FUTURE_CLOCK_SKEW_TOLERANCE_MINUTES=5;
// Keep enough regular-season NFL runway for Graham's current-week board to be
// initialized before Week 1 while leaving the tighter preseason horizon alone.
const RETENTION_HORIZONS_HOURS={default:30,NFL:384,NFL_PRESEASON:192,BOXING:30};
const ALWAYS_OBSERVE=new Set(['NFL']);
export const TOURNAMENTS=[
  {key:'NBA',id:132},{key:'NFL',id:31},{key:'NFL_PRESEASON',id:233},
  {key:'CFL',id:790},{key:'NCAAF',id:27653},{key:'BOXING',id:24327},
  {key:'MLB',id:109},{key:'WNBA',id:486},{key:'NHL',id:234}
];

function readJson(f){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{return null}}
function writeJson(f,v){fs.mkdirSync(path.dirname(f),{recursive:true});const next=f+'.next';fs.writeFileSync(next,JSON.stringify(v,null,2)+'\n');fs.renameSync(next,f)}
function norm(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ')}
function token(v){return norm(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function safeError(e){return String(e?.message||e||'Unknown OddsPapi error').replace(API_KEY,'REDACTED').slice(0,700)}
function pause(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
export function categoryKey(e){
  const sport=norm(e?.sport?.slug||e?.identity?.sportKey||e?.sport?.name).replace(/-/g,' ');
  const league=norm([e?.league?.name,e?.league?.slug,e?.identity?.leagueKey].filter(Boolean).join(' '));
  if(sport==='american football'&&/\bnfl\b/.test(league)&&/pre[\s_-]*season/.test(league))return'NFL_PRESEASON';
  const category=majorSportKey(e);
  if(category==='NBA_WNBA')return /\bwnba\b/i.test([e?.league?.name,e?.league?.slug,e?.identity?.leagueKey].join(' '))?'WNBA':'NBA';
  if(category)return category;
  const s=norm(e?.sport?.slug||e?.sport?.name);
  if(s==='boxing'||/boxing/.test(s))return'BOXING';
  return null;
}

// Spend benchmark requests on executable upcoming primary markets, plus the
// existing regular-season NFL runway used by Graham. Catalogue order must not
// push NHL/NBA into the optional batch.
export function selectRelevantTournaments(primary,now=Date.now()){
  const observed=Date.parse(primary?.generatedAt||''),active=new Set();
  const books=Array.isArray(primary?.bookmakers)?primary.bookmakers:['FanDuel','DraftKings','Bet365'];
  const unavailable=value=>value?.active===false||value?.marketActive===false||value?.suspended===true||
    /^(suspended|inactive|disabled|cancelled|canceled|closed|settled|ended|final)$/i.test(String(value?.status||value?.state||''));
  const price=value=>(typeof value==='string'||typeof value==='number')&&Number.isFinite(Number(value))&&Number(value)>1;
  for(const event of primary?.events||[]){
    const start=Date.parse(event?.date||'');
    if(!Number.isFinite(start)||start<=now||start>now+30*3600000||unavailable(event))continue;
    const priced=books.some(book=>(event?.bookmakers?.[book]||[]).some(m=>{
      const key=norm(m?.marketKey||m?.name).replace(/[^a-z]/g,'');
      if(!['ml','moneyline','spread','spreads','total','totals'].includes(key)||unavailable(m))return false;
      const stamp=Date.parse(primary?.quoteObservationVersion===1?m?.observedAt:m?.updatedAt),age=(observed-stamp)/60000;
      return Number.isFinite(age)&&age>=0&&age<=QUOTE_FRESHNESS_MINUTES&&(m.odds||[]).some(row=>!unavailable(row)&&
        (['ml','moneyline'].includes(key)||((typeof row?.hdp==='number'||typeof row?.hdp==='string')&&Number.isFinite(Number(row.hdp))))&&
        (key.includes('total')?price(row?.over)&&price(row?.under):price(row?.home)&&price(row?.away)));
    }));
    if(priced){const key=categoryKey(event);if(key)active.add(key);}
  }
  const priority={NHL:0,NBA:1,NFL:2,NFL_PRESEASON:3,NCAAF:4,MLB:5,CFL:6,WNBA:7,BOXING:8};
  const selected=TOURNAMENTS.filter(t=>ALWAYS_OBSERVE.has(t.key)||active.has(t.key)).sort((a,b)=>priority[a.key]-priority[b.key]);
  return {selected,activeCategories:[...active].sort(),excluded:TOURNAMENTS.filter(t=>!selected.includes(t)).map(t=>({...t,reason:'NO_UPCOMING_PRICED_PRIMARY_EVENT'}))};
}

// Hockey regulation and overtime markets can share the same handicap and
// Pinnacle path suffix. Retain provider definitions; never infer the clock.
export function hockeyDefinitions(payload){
  if(!Array.isArray(payload))throw new Error('OddsPapi market catalogue is not an array');
  const rows=payload.filter(m=>Number(m.sportId)===15&&m.playerProp===false&&m.period==='result'&&
    Number(m.marketLength)===2&&['Winner (incl. overtime and penalties)','Handicap (incl. overtime and penalties)','Total (incl. overtime and penalties)'].includes(m.marketName))
    .map(m=>({marketId:String(m.marketId),sportId:15,marketName:m.marketName,period:m.period,playerProp:false,marketLength:2,handicap:m.handicap,marketType:m.marketType}));
  if(!rows.some(m=>m.marketId==='151'))throw new Error('NHL overtime moneyline definition missing');
  if(new Set(rows.map(m=>m.marketId)).size!==rows.length)throw new Error('Duplicate NHL market definitions');
  return rows;
}
function fixtureHorizonHours(f){const tournament=TOURNAMENTS.find(t=>t.id===Number(f?.tournamentId));return RETENTION_HORIZONS_HOURS[tournament?.key]??RETENTION_HORIZONS_HOURS.default}
export function planTournamentBatches(selected,maxIds=MAX_TOURNAMENT_IDS_PER_REQUEST){
  if(!Array.isArray(selected))throw new TypeError('Selected tournaments must be an array.');
  if(!Number.isInteger(maxIds)||maxIds<1)throw new TypeError('Tournament batch size must be a positive integer.');
  const batches=[];
  for(let i=0;i<selected.length;i+=maxIds)batches.push(selected.slice(i,i+maxIds));
  return batches;
}

async function apiGet(endpoint,params={}){const u=new URL(API_BASE+endpoint);u.searchParams.set('apiKey',API_KEY);for(const[k,v]of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v));const r=await fetch(u,{headers:{accept:'application/json','user-agent':'betting-edge-terminal/1.4-oddspapi-pinnacle'},signal:AbortSignal.timeout(120000)});const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{if(r.ok)throw new Error(`OddsPapi ${endpoint} returned invalid JSON`);body=text}if(!r.ok){const d=typeof body==='string'?body:JSON.stringify(body||{});throw new Error(`OddsPapi ${endpoint} ${r.status}: ${d.slice(0,500)}`)}return body}
function activeSubscription(a){const c=String(a?.current_subscription_id||''),r=Array.isArray(a?.subscriptions)?a.subscriptions:[];return r.find(x=>String(x?.subscription_id||'')===c)||r.find(x=>x?.is_active)||r[0]||null}
function payloadRows(p){if(Array.isArray(p))return p;if(Array.isArray(p?.fixtures))return p.fixtures;if(p?.fixtureId)return[p];return[]}
function playerRows(o,observedAt){const rows=[];for(const[id,q]of Object.entries(o?.players||{})){const price=Number(q?.price);if(!Number.isFinite(price))continue;rows.push({playerId:id,playerName:q?.playerName||null,bookmakerOutcomeId:q?.bookmakerOutcomeId??null,bookmakerChangedAt:q?.bookmakerChangedAt??null,price,priceAmerican:q?.priceAmerican??null,active:q?.active!==false,mainLine:q?.mainLine===true,limit:Number.isFinite(Number(q?.limit))?Number(q.limit):null,changedAt:q?.changedAt||null,observedAt})}return rows}
export function summarizePinnacle(book,observedAt,hockeyCatalogue=null){
  if(!book||typeof book!=='object')return null;
  const markets=[];
  let activeQuotes=0,suspendedQuotes=0,legacyRetained=0;
  for(const[mid,m]of Object.entries(book?.markets||{})){
    const definition=hockeyCatalogue?.find(d=>d.marketId===String(mid));
    if(hockeyCatalogue&&!definition)continue;
    const alternateTotal=isFullGameAlternateTotalMarket(m);
    // Preserve the original first-12/main-line budget for ordinary markets.
    // Exact alternate totals must survive even when they arrive after that budget.
    if(legacyRetained>=24&&!alternateTotal&&!definition)continue;
    const outcomes=[];let main=false;
    for(const[oid,o]of Object.entries(m?.outcomes||{})){
      const players=playerRows(o,observedAt);
      if(!players.length)continue;
      if(players.some(p=>p.mainLine))main=true;
      for(const p of players)p.active?activeQuotes++:suspendedQuotes++;
      outcomes.push({outcomeId:oid,players});
    }
    if(!outcomes.length)continue;
    const retainedByOriginalRules=legacyRetained<24&&(main||legacyRetained<12);
    if(retainedByOriginalRules)legacyRetained++;
    if(retainedByOriginalRules||alternateTotal||definition)markets.push({marketId:String(mid),marketActive:m?.marketActive!==false,bookmakerMarketId:m?.bookmakerMarketId||null,outcomes,...(definition?{definition}:{})});
  }
  return{bookmakerIsActive:book?.bookmakerIsActive!==false,suspended:book?.suspended===true,activeQuotes,suspendedQuotes,marketCount:Object.keys(book?.markets||{}).length,markets};
}
function matchPrimary(f,events){const a=token(f?.participant1Name),b=token(f?.participant2Name),st=Date.parse(f?.startTime||'');if(!a||!b||!Number.isFinite(st))return null;for(const e of events||[]){const h=token(e?.home),aw=token(e?.away),es=Date.parse(e?.date||'');if(!h||!aw||!Number.isFinite(es)||Math.abs(es-st)>3*3600000)continue;if((a===h&&b===aw)||(a===aw&&b===h))return{eventId:String(e?.id||''),eventKey:String(e?.eventKey||e?.identity?.eventKey||''),matchedBy:'exact-participant-pair+start-time'}}return null}

const primary=readJson(PRIMARY_FILE),now=Date.now();
const primaryBooks=Array.isArray(primary?.bookmakers)?primary.bookmakers:['FanDuel','DraftKings'];
const observation={schema:3,quoteObservationVersion:1,collectionStartedAt:new Date(now).toISOString(),mode:'official-sharp-benchmark',authoritative:true,authorityScope:'sharp-market-benchmark-only',benchmarkAuthority:AUTHORITY,executionAuthority:false,decisionAuthority:false,fairValueAuthority:false,source:'OddsPapi v4',generatedAt:new Date(now).toISOString(),horizonHours:RETENTION_HORIZONS_HOURS.default,retentionHorizonsHours:{...RETENTION_HORIZONS_HOURS},benchmarkPolicy:{path:'core/pinnacle-sharp-benchmark-v1.4.json',policyId:'pinnacle-sharp-benchmark-v1.4-2026-09-01',quoteFreshnessMinutes:QUOTE_FRESHNESS_MINUTES,futureClockSkewToleranceMinutes:FUTURE_CLOCK_SKEW_TOLERANCE_MINUTES,requiresExactMarketAndSelectionMatchAtReportTime:true},sourceOfTruth:{...Object.fromEntries(primaryBooks.map(book=>[book,'Odds-API.io v3'])),Pinnacle:'OddsPapi v4'},status:'not-run',acquisitionComplete:false,coverageStatus:'NOT_REQUESTED',quota:null,budget:null,requestedBookmaker:'pinnacle',tournaments:[],fixtureCountRaw:0,fixtureCount:0,primaryMatches:0,qualifiedBenchmarkMarkets:0,fixtures:[],diagnostics:{billableRequestsThisRun:0,discoveryRequests:0,oddsRequests:0,plannedOddsRequests:0,allowedOddsRequests:0,requestSpacingMs:ODDS_REQUEST_SPACING_MS,tournamentBatches:[],requestedTournaments:[],deferredTournaments:[],activePrimaryCategories:[],alwaysObservedCategories:[...ALWAYS_OBSERVE].sort(),excludedCompetitions:[],skippedCategories:[],errors:[]}};
let budgetState=null;
function saveBudget(){
  if(!budgetState)return;
  writeJson(BUDGET_FILE,budgetState);
  observation.budget=budgetSummary(budgetState,{now:new Date()});
}
function finish(){
  saveBudget();
  if(observation.status!=='ok')observation.generatedAt=new Date().toISOString();
  writeJson(OUTFILE,observation);
  console.log(formatOddsPapiUsage(observation));
  if(observation.diagnostics.deferredTournaments.length)console.log('Pinnacle deferred by budget:',observation.diagnostics.deferredTournaments.map(t=>t.key).join(', '));
}
async function chargedGet(endpoint,params={},extraBatch=false){
  budgetState=recordBudgetSpend(budgetState,{requests:1,oddsRequests:endpoint==='/odds-by-tournaments'?1:0,extraBatches:extraBatch?1:0,now:new Date()});
  observation.diagnostics.billableRequestsThisRun++;
  if(endpoint==='/markets')observation.diagnostics.discoveryRequests++;
  else observation.diagnostics.oddsRequests++;
  // Persist before transport; errors and uncertain timeouts are never free retries.
  saveBudget();
  return apiGet(endpoint,params);
}
function cachedDefinitions(){
  const existing=readJson(MARKET_CACHE_FILE),legacy=readJson(OUTFILE);
  const source=existing?.schema===1?existing:legacy;
  const stamp=source?.marketDefinitionsObservedAt,age=now-Date.parse(stamp||'');
  if(!Number.isFinite(age)||age<0||age>30*86400000||!Array.isArray(source?.marketDefinitions))return null;
  try{
    const definitions=hockeyDefinitions(source.marketDefinitions);
    if(existing?.schema!==1)writeJson(MARKET_CACHE_FILE,{schema:1,updatedAt:new Date(now).toISOString(),marketDefinitionsObservedAt:stamp,marketDefinitions:definitions});
    return {definitions,observedAt:stamp};
  }catch{return null;}
}
async function main(){
  if(!primary||!Array.isArray(primary.events)){observation.status='primary-snapshot-unavailable';finish();return;}
  if(!API_KEY){observation.status='missing-secret';observation.diagnostics.errors.push('ODDSPAPI_API_KEY is not available.');finish();return;}
  const selection=selectRelevantTournaments(primary,now),selected=selection.selected;
  observation.diagnostics.activePrimaryCategories=selection.activeCategories;
  observation.diagnostics.excludedCompetitions=selection.excluded;
  observation.diagnostics.candidateTournaments=selected;
  if(!selected.length){observation.status='no-supported-active-tournaments';finish();return;}
  const batches=planTournamentBatches(selected);
  observation.diagnostics.plannedOddsRequests=batches.length;
  observation.diagnostics.tournamentBatches=batches.map(batch=>batch.map(t=>t.id));
  const hockeySelected=selected.some(t=>t.key==='NHL'),cache=cachedDefinitions();
  let plan;
  try{
    const account=await apiGet('/account'),sub=activeSubscription(account);
    if(!sub)throw new Error('No active OddsPapi subscription found.');
    // Do not coerce missing/null quota into invented free usage.
    budgetState=reconcileBudgetState({state:readJson(BUDGET_FILE),requestLimit:sub.request_limit,requestCount:sub.request_count,subscriptionId:sub.subscription_id,now:new Date()});
    saveBudget();
    const rawSlot=String(process.env.ODDSPAPI_CANONICAL_SLOT||'').trim();
    const schedule=readJson(path.join('data','main-schedule.json'));
    plan=planOddsPapiBudget({state:budgetState,now:new Date(),desiredOddsRequests:batches.length,metadataRequests:hockeySelected&&!cache?1:0,canonicalSlot:rawSlot?Number(rawSlot):null,...(schedule?.slots?.length===5?{reportTimes:schedule.slots.map(s=>s.reportTime)}:{})});
    const remaining=Math.max(0,sub.request_limit-sub.request_count);
    observation.quota={requestLimit:sub.request_limit,requestCountBefore:sub.request_count,remainingBefore:remaining,protectedReserve:RESERVE,estimatedRemainingAfter:remaining-plan.allowedTotalRequests};
    observation.budgetPlan={...plan,summary:undefined};
  }catch(error){observation.status='account-error';observation.diagnostics.errors.push(safeError(error));finish();return;}
  const permitted=batches.slice(0,plan.allowedOddsRequests);
  observation.diagnostics.allowedOddsRequests=permitted.length;
  observation.diagnostics.allowedTournaments=permitted.flat();
  observation.diagnostics.deferredTournaments=batches.slice(permitted.length).flat().map(t=>({...t,reason:plan.reason}));
  if(!permitted.length){
    observation.status={MONTHLY_RESERVE:'quota-reserve-protected',DAILY_LIMIT:'daily-budget-protected',MAIN_SLOTS_RESERVED:'main-slots-budget-protected'}[plan.reason]||'monthly-budget-protected';
    observation.coverageStatus='UNAVAILABLE_BUDGET';finish();return;
  }
  let collectionError=null;
  const latestFixtures=new Map();
  try{
    if(hockeySelected){
      try{
        const definitions=cache||{definitions:hockeyDefinitions(await chargedGet('/markets',{language:'en'})),observedAt:new Date().toISOString()};
        observation.marketDefinitions=definitions.definitions;
        observation.marketDefinitionsObservedAt=definitions.observedAt;
        if(!cache)writeJson(MARKET_CACHE_FILE,{schema:1,updatedAt:definitions.observedAt,marketDefinitionsObservedAt:definitions.observedAt,marketDefinitions:definitions.definitions});
      }catch(error){
        observation.marketDefinitions=[];
        observation.diagnostics.errors.push(safeError(error));
        observation.diagnostics.skippedCategories.push({category:'NHL',reason:'SETTLEMENT_CATALOGUE_UNAVAILABLE'});
      }
    }
    for(const [index,batch] of permitted.entries()){
      if(index>0)await pause(ODDS_REQUEST_SPACING_MS);
      observation.tournaments.push(...batch);
      observation.diagnostics.requestedTournaments.push(...batch);
      const payload=await chargedGet('/odds-by-tournaments',{bookmaker:'pinnacle',tournamentIds:batch.map(t=>t.id).join(','),language:'en',verbosity:3,oddsFormat:'american'},index>0);
      const observedAt=new Date().toISOString();
      if(!Array.isArray(payload)&&!Array.isArray(payload?.fixtures)&&!payload?.fixtureId)throw new Error('OddsPapi odds response has no fixture collection');
      for(const fixture of payloadRows(payload)){
        observation.fixtureCountRaw++;
        if(!fixture?.fixtureId||!batch.some(t=>t.id===Number(fixture.tournamentId)))throw new Error('OddsPapi fixture identity differs from requested tournaments');
        latestFixtures.set(String(fixture.fixtureId),{fixture,observedAt});
      }
    }
  }catch(error){collectionError=error;}
  observation.generatedAt=new Date().toISOString();
  // An acquisition error never revives the prior saved observer's prices.
  if(!collectionError){
    for(const {fixture:f,observedAt} of latestFixtures.values()){
      const st=Date.parse(f?.startTime||''),retentionHorizonHours=fixtureHorizonHours(f),end=now+retentionHorizonHours*3600000;
      if(!Number.isFinite(st)||st<now-2*3600000||st>end)continue;
      const hockey=Number(f.sportId)===15;if(hockey&&!observation.marketDefinitions?.length)continue;
      const pinnacle=summarizePinnacle(f?.bookmakerOdds?.pinnacle,observedAt,hockey?observation.marketDefinitions:null);if(!pinnacle)continue;
      const match=matchPrimary(f,primary.events);if(match)observation.primaryMatches++;
      annotatePinnacle(pinnacle,{generatedAt:observation.generatedAt,primaryMatch:match,quoteObservationVersion:observation.quoteObservationVersion,quoteFreshnessMinutes:QUOTE_FRESHNESS_MINUTES,futureClockSkewToleranceMinutes:FUTURE_CLOCK_SKEW_TOLERANCE_MINUTES});
      observation.qualifiedBenchmarkMarkets+=Number(pinnacle.qualifiedBenchmarkMarkets||0);
      observation.fixtures.push({fixtureId:f.fixtureId,sportId:f.sportId??null,tournamentId:f.tournamentId??null,startTime:f.startTime,updatedAt:f.updatedAt||null,statusName:f.statusName||null,participant1Name:f.participant1Name||null,participant2Name:f.participant2Name||null,retentionHorizonHours,primaryMatch:match,pinnacle});
    }
    // 'ok' describes successful acquisition of the declared requested subset.
    // Completeness and deferred competitions are explicit; exact-match gates
    // still reject every absent/stale/suspended benchmark selection.
    observation.status='ok';
    observation.acquisitionComplete=permitted.length===batches.length&&observation.diagnostics.skippedCategories.length===0;
    observation.coverageStatus=observation.diagnostics.skippedCategories.length?'PARTIAL_SOURCE':observation.acquisitionComplete?'COMPLETE':'PARTIAL_BUDGET';
  }else{observation.status='odds-error';observation.coverageStatus='UNAVAILABLE_SOURCE';observation.diagnostics.errors.push(safeError(collectionError));}
  observation.fixtureCount=observation.fixtures.length;
  finish();
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)main().catch(error=>{observation.status='fatal-error';observation.coverageStatus='UNAVAILABLE_SOURCE';observation.diagnostics.errors.push(safeError(error));finish();process.exitCode=0;});
