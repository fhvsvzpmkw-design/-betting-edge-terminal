import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {annotatePinnacle,AUTHORITY} from './pinnacle-sharp-benchmark.mjs';

const API_BASE='https://api.oddspapi.io/v4';
const API_KEY=String(process.env.ODDSPAPI_API_KEY||'').trim();
const PRIMARY_FILE=path.join('data','live-odds.json');
const OUTFILE=path.join('data','oddspapi-observer.json');
const RESERVE=25;
const MAX_TOURNAMENT_IDS_PER_REQUEST=5;
const QUOTE_FRESHNESS_MINUTES=30;
const FUTURE_CLOCK_SKEW_TOLERANCE_MINUTES=5;
// Keep enough regular-season NFL runway for Graham's current-week board to be
// initialized before Week 1 while leaving the tighter preseason horizon alone.
const RETENTION_HORIZONS_HOURS={default:30,NFL:384,NFL_PRESEASON:192,BOXING:30};
const ALWAYS_OBSERVE=new Set(['NFL','NFL_PRESEASON']);
const TOURNAMENTS=[
  {key:'NBA',id:132},{key:'NFL',id:31},{key:'NFL_PRESEASON',id:233},
  {key:'CFL',id:790},{key:'NCAAF',id:27653},{key:'BOXING',id:24327},
  {key:'MLB',id:109},{key:'WNBA',id:486}
];

function readJson(f){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{return null}}
function writeJson(f,v){fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n')}
function norm(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ')}
function token(v){return norm(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function safeError(e){return String(e?.message||e||'Unknown OddsPapi error').replace(API_KEY,'REDACTED').slice(0,700)}
function categoryKey(e){const s=norm(e?.sport?.slug||e?.sport?.name),t=norm([e?.league?.name,e?.league?.slug,e?.tournament?.name,e?.sport?.name,e?.sport?.slug].filter(Boolean).join(' '));if(/\bmlb\b|major league baseball/.test(t))return'MLB';if(/\bnba\b/.test(t))return'NBA';if(/\bwnba\b/.test(t))return'WNBA';if(/\bnfl\b/.test(t))return'NFL';if(s==='american-football'&&/\bncaaf\b|\bncaa\b|college/.test(t))return'NCAAF';if(/\bcfl\b|canadian football/.test(t))return'CFL';if(s==='boxing'||/boxing/.test(s))return'BOXING';return null}
function fixtureHorizonHours(f){const tournament=TOURNAMENTS.find(t=>t.id===Number(f?.tournamentId));return RETENTION_HORIZONS_HOURS[tournament?.key]??RETENTION_HORIZONS_HOURS.default}
export function planTournamentBatches(selected,maxIds=MAX_TOURNAMENT_IDS_PER_REQUEST){
  if(!Array.isArray(selected))throw new TypeError('Selected tournaments must be an array.');
  if(!Number.isInteger(maxIds)||maxIds<1)throw new TypeError('Tournament batch size must be a positive integer.');
  const batches=[];
  for(let i=0;i<selected.length;i+=maxIds)batches.push(selected.slice(i,i+maxIds));
  return batches;
}

async function apiGet(endpoint,params={}){const u=new URL(API_BASE+endpoint);u.searchParams.set('apiKey',API_KEY);for(const[k,v]of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v));const r=await fetch(u,{headers:{accept:'application/json','user-agent':'betting-edge-terminal/1.4-oddspapi-pinnacle'},signal:AbortSignal.timeout(120000)});const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}if(!r.ok){const d=typeof body==='string'?body:JSON.stringify(body||{});throw new Error(`OddsPapi ${endpoint} ${r.status}: ${d.slice(0,500)}`)}return body}
function activeSubscription(a){const c=String(a?.current_subscription_id||''),r=Array.isArray(a?.subscriptions)?a.subscriptions:[];return r.find(x=>String(x?.subscription_id||'')===c)||r.find(x=>x?.is_active)||r[0]||null}
function payloadRows(p){if(Array.isArray(p))return p;if(Array.isArray(p?.fixtures))return p.fixtures;if(p?.fixtureId)return[p];return[]}
function playerRows(o){const rows=[];for(const[id,q]of Object.entries(o?.players||{})){const price=Number(q?.price);if(!Number.isFinite(price))continue;rows.push({playerId:id,playerName:q?.playerName||null,bookmakerOutcomeId:q?.bookmakerOutcomeId??null,bookmakerChangedAt:q?.bookmakerChangedAt??null,price,priceAmerican:q?.priceAmerican??null,active:q?.active!==false,mainLine:q?.mainLine===true,limit:Number.isFinite(Number(q?.limit))?Number(q.limit):null,changedAt:q?.changedAt||null})}return rows}
function summarizePinnacle(book){if(!book||typeof book!=='object')return null;const markets=[];let activeQuotes=0,suspendedQuotes=0;for(const[mid,m]of Object.entries(book?.markets||{})){const outcomes=[];let main=false;for(const[oid,o]of Object.entries(m?.outcomes||{})){const players=playerRows(o);if(!players.length)continue;if(players.some(p=>p.mainLine))main=true;for(const p of players)p.active?activeQuotes++:suspendedQuotes++;outcomes.push({outcomeId:oid,players})}if(!outcomes.length)continue;if(main||markets.length<12)markets.push({marketId:String(mid),marketActive:m?.marketActive!==false,bookmakerMarketId:m?.bookmakerMarketId||null,outcomes});if(markets.length>=24)break}return{bookmakerIsActive:book?.bookmakerIsActive!==false,suspended:book?.suspended===true,activeQuotes,suspendedQuotes,marketCount:Object.keys(book?.markets||{}).length,markets}}
function matchPrimary(f,events){const a=token(f?.participant1Name),b=token(f?.participant2Name),st=Date.parse(f?.startTime||'');if(!a||!b||!Number.isFinite(st))return null;for(const e of events||[]){const h=token(e?.home),aw=token(e?.away),es=Date.parse(e?.date||'');if(!h||!aw||!Number.isFinite(es)||Math.abs(es-st)>3*3600000)continue;if((a===h&&b===aw)||(a===aw&&b===h))return{eventId:String(e?.id||''),eventKey:String(e?.eventKey||e?.identity?.eventKey||''),matchedBy:'exact-participant-pair+start-time'}}return null}

const primary=readJson(PRIMARY_FILE),now=Date.now();
const observation={schema:3,mode:'official-sharp-benchmark',authoritative:true,authorityScope:'sharp-market-benchmark-only',benchmarkAuthority:AUTHORITY,executionAuthority:false,decisionAuthority:false,fairValueAuthority:false,source:'OddsPapi v4',generatedAt:new Date(now).toISOString(),horizonHours:RETENTION_HORIZONS_HOURS.default,retentionHorizonsHours:{...RETENTION_HORIZONS_HOURS},benchmarkPolicy:{path:'core/pinnacle-sharp-benchmark-v1.4.json',policyId:'pinnacle-sharp-benchmark-v1.4-2026-09-01',quoteFreshnessMinutes:QUOTE_FRESHNESS_MINUTES,futureClockSkewToleranceMinutes:FUTURE_CLOCK_SKEW_TOLERANCE_MINUTES,requiresExactMarketAndSelectionMatchAtReportTime:true},sourceOfTruth:{Bet365:'Odds-API.io v3',DraftKings:'Odds-API.io v3',Pinnacle:'OddsPapi v4'},status:'not-run',quota:null,requestedBookmaker:'pinnacle',tournaments:[],fixtureCountRaw:0,fixtureCount:0,primaryMatches:0,qualifiedBenchmarkMarkets:0,fixtures:[],diagnostics:{billableRequestsThisRun:0,discoveryRequests:0,oddsRequests:0,plannedOddsRequests:0,tournamentBatches:[],activePrimaryCategories:[],alwaysObservedCategories:[...ALWAYS_OBSERVE].sort(),skippedCategories:[],errors:[]}};

async function main(){
  if(!primary||!Array.isArray(primary.events)){observation.status='primary-snapshot-unavailable';writeJson(OUTFILE,observation);return}
  if(!API_KEY){observation.status='missing-secret';observation.diagnostics.errors.push('ODDSPAPI_API_KEY is not available.');writeJson(OUTFILE,observation);return}
  const active=new Set(primary.events.map(categoryKey).filter(Boolean));observation.diagnostics.activePrimaryCategories=[...active].sort();
  const selected=TOURNAMENTS.filter(t=>ALWAYS_OBSERVE.has(t.key)||active.has(t.key)||(t.key==='NFL_PRESEASON'&&active.has('NFL')));observation.tournaments=selected;
  if(!selected.length){observation.status='no-supported-active-tournaments';writeJson(OUTFILE,observation);return}
  const batches=planTournamentBatches(selected);
  observation.diagnostics.plannedOddsRequests=batches.length;
  observation.diagnostics.tournamentBatches=batches.map(batch=>batch.map(t=>t.id));
  try{const account=await apiGet('/account');const sub=activeSubscription(account);if(!sub)throw new Error('No active OddsPapi subscription found.');const limit=Number(sub?.request_limit),count=Number(sub?.request_count),remaining=Number.isFinite(limit)&&Number.isFinite(count)?Math.max(0,limit-count):null;const estimatedRemainingAfter=remaining===null?null:remaining-batches.length;observation.quota={requestLimit:Number.isFinite(limit)?limit:null,requestCountBefore:Number.isFinite(count)?count:null,remainingBefore:remaining,protectedReserve:RESERVE,estimatedRemainingAfter};if(estimatedRemainingAfter!==null&&estimatedRemainingAfter<RESERVE){observation.status='quota-reserve-protected';writeJson(OUTFILE,observation);return}}catch(e){observation.status='account-error';observation.diagnostics.errors.push(safeError(e));writeJson(OUTFILE,observation);return}
  try{
    const rows=[];
    for(const batch of batches){
      observation.diagnostics.billableRequestsThisRun++;
      observation.diagnostics.oddsRequests++;
      const payload=await apiGet('/odds-by-tournaments',{bookmaker:'pinnacle',tournamentIds:batch.map(t=>t.id).join(','),language:'en',verbosity:3,oddsFormat:'american'});
      rows.push(...payloadRows(payload));
    }
    observation.fixtureCountRaw=rows.length;
    for(const f of rows){const st=Date.parse(f?.startTime||'');const retentionHorizonHours=fixtureHorizonHours(f);const end=now+retentionHorizonHours*3600000;if(!Number.isFinite(st)||st<now-2*3600000||st>end)continue;const pinnacle=summarizePinnacle(f?.bookmakerOdds?.pinnacle);if(!pinnacle)continue;const match=matchPrimary(f,primary.events);if(match)observation.primaryMatches++;annotatePinnacle(pinnacle,{generatedAt:observation.generatedAt,primaryMatch:match,quoteFreshnessMinutes:QUOTE_FRESHNESS_MINUTES,futureClockSkewToleranceMinutes:FUTURE_CLOCK_SKEW_TOLERANCE_MINUTES});observation.qualifiedBenchmarkMarkets+=Number(pinnacle.qualifiedBenchmarkMarkets||0);observation.fixtures.push({fixtureId:f?.fixtureId||null,sportId:f?.sportId??null,tournamentId:f?.tournamentId??null,startTime:f?.startTime||null,updatedAt:f?.updatedAt||null,statusName:f?.statusName||null,participant1Name:f?.participant1Name||null,participant2Name:f?.participant2Name||null,retentionHorizonHours,primaryMatch:match,pinnacle})}
    observation.fixtureCount=observation.fixtures.length;observation.status='ok';
  }catch(e){observation.status='odds-error';observation.diagnostics.errors.push(safeError(e))}
  writeJson(OUTFILE,observation);
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)main().catch(e=>{observation.status='fatal-error';observation.diagnostics.errors.push(safeError(e));writeJson(OUTFILE,observation);process.exitCode=0});
