import fs from 'node:fs';
import path from 'node:path';

const API_BASE='https://api.oddspapi.io/v4';
const API_KEY=String(process.env.ODDSPAPI_API_KEY||'').trim();
const PRIMARY_FILE=path.join('data','live-odds.json');
const OUTFILE=path.join('data','oddspapi-observer.json');
const RESERVE=25;
const HORIZON_HOURS=30;
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

async function apiGet(endpoint,params={}){const u=new URL(API_BASE+endpoint);u.searchParams.set('apiKey',API_KEY);for(const[k,v]of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v));const r=await fetch(u,{headers:{accept:'application/json','user-agent':'betting-edge-terminal/1.4-oddspapi-pinnacle'},signal:AbortSignal.timeout(120000)});const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}if(!r.ok){const d=typeof body==='string'?body:JSON.stringify(body||{});throw new Error(`OddsPapi ${endpoint} ${r.status}: ${d.slice(0,500)}`)}return body}
function activeSubscription(a){const c=String(a?.current_subscription_id||''),r=Array.isArray(a?.subscriptions)?a.subscriptions:[];return r.find(x=>String(x?.subscription_id||'')===c)||r.find(x=>x?.is_active)||r[0]||null}
function payloadRows(p){if(Array.isArray(p))return p;if(Array.isArray(p?.fixtures))return p.fixtures;if(p?.fixtureId)return[p];return[]}
function playerRows(o){const rows=[];for(const[id,q]of Object.entries(o?.players||{})){const price=Number(q?.price);if(!Number.isFinite(price))continue;rows.push({playerId:id,playerName:q?.playerName||null,price,priceAmerican:q?.priceAmerican??null,active:q?.active!==false,mainLine:q?.mainLine===true,limit:Number.isFinite(Number(q?.limit))?Number(q.limit):null,changedAt:q?.changedAt||null})}return rows}
function summarizePinnacle(book){if(!book||typeof book!=='object')return null;const markets=[];let activeQuotes=0,suspendedQuotes=0;for(const[mid,m]of Object.entries(book?.markets||{})){const outcomes=[];let main=false;for(const[oid,o]of Object.entries(m?.outcomes||{})){const players=playerRows(o);if(!players.length)continue;if(players.some(p=>p.mainLine))main=true;for(const p of players)p.active?activeQuotes++:suspendedQuotes++;outcomes.push({outcomeId:oid,players})}if(!outcomes.length)continue;if(main||markets.length<12)markets.push({marketId:String(mid),marketActive:m?.marketActive!==false,bookmakerMarketId:m?.bookmakerMarketId||null,outcomes});if(markets.length>=24)break}return{bookmakerIsActive:book?.bookmakerIsActive!==false,suspended:book?.suspended===true,activeQuotes,suspendedQuotes,marketCount:Object.keys(book?.markets||{}).length,markets}}
function matchPrimary(f,events){const a=token(f?.participant1Name),b=token(f?.participant2Name),st=Date.parse(f?.startTime||'');if(!a||!b||!Number.isFinite(st))return null;for(const e of events||[]){const h=token(e?.home),aw=token(e?.away),es=Date.parse(e?.date||'');if(!h||!aw||!Number.isFinite(es)||Math.abs(es-st)>3*3600000)continue;if((a===h&&b===aw)||(a===aw&&b===h))return{eventId:String(e?.id||''),eventKey:String(e?.eventKey||e?.identity?.eventKey||''),matchedBy:'exact-participant-pair+start-time'}}return null}

const primary=readJson(PRIMARY_FILE),now=Date.now();
const observation={schema:2,mode:'observation-only',authoritative:false,source:'OddsPapi v4',generatedAt:new Date(now).toISOString(),horizonHours:HORIZON_HOURS,sourceOfTruth:{Bet365:'Odds-API.io v3',DraftKings:'Odds-API.io v3',Pinnacle:'OddsPapi v4'},status:'not-run',quota:null,requestedBookmaker:'pinnacle',tournaments:[],fixtureCountRaw:0,fixtureCount:0,primaryMatches:0,fixtures:[],diagnostics:{billableRequestsThisRun:0,discoveryRequests:0,oddsRequests:0,activePrimaryCategories:[],skippedCategories:[],errors:[]}};

async function main(){
  if(!primary||!Array.isArray(primary.events)){observation.status='primary-snapshot-unavailable';writeJson(OUTFILE,observation);return}
  if(!API_KEY){observation.status='missing-secret';observation.diagnostics.errors.push('ODDSPAPI_API_KEY is not available.');writeJson(OUTFILE,observation);return}
  const active=new Set(primary.events.map(categoryKey).filter(Boolean));observation.diagnostics.activePrimaryCategories=[...active].sort();
  const selected=TOURNAMENTS.filter(t=>active.has(t.key)||(t.key==='NFL_PRESEASON'&&active.has('NFL')));observation.tournaments=selected;
  if(!selected.length){observation.status='no-supported-active-tournaments';writeJson(OUTFILE,observation);return}
  try{const account=await apiGet('/account');const sub=activeSubscription(account);if(!sub)throw new Error('No active OddsPapi subscription found.');const limit=Number(sub?.request_limit),count=Number(sub?.request_count),remaining=Number.isFinite(limit)&&Number.isFinite(count)?Math.max(0,limit-count):null;observation.quota={requestLimit:Number.isFinite(limit)?limit:null,requestCountBefore:Number.isFinite(count)?count:null,remainingBefore:remaining,protectedReserve:RESERVE,estimatedRemainingAfter:remaining===null?null:remaining-1};if(remaining!==null&&remaining<=RESERVE){observation.status='quota-reserve-protected';writeJson(OUTFILE,observation);return}}catch(e){observation.status='account-error';observation.diagnostics.errors.push(safeError(e));writeJson(OUTFILE,observation);return}
  try{
    const payload=await apiGet('/odds-by-tournaments',{bookmaker:'pinnacle',tournamentIds:selected.map(t=>t.id).join(','),language:'en',verbosity:3,oddsFormat:'american'});
    observation.diagnostics.billableRequestsThisRun=1;observation.diagnostics.oddsRequests=1;
    const rows=payloadRows(payload);observation.fixtureCountRaw=rows.length;const end=now+HORIZON_HOURS*3600000;
    for(const f of rows){const st=Date.parse(f?.startTime||'');if(!Number.isFinite(st)||st<now-2*3600000||st>end)continue;const pinnacle=summarizePinnacle(f?.bookmakerOdds?.pinnacle);if(!pinnacle)continue;const match=matchPrimary(f,primary.events);if(match)observation.primaryMatches++;observation.fixtures.push({fixtureId:f?.fixtureId||null,sportId:f?.sportId??null,tournamentId:f?.tournamentId??null,startTime:f?.startTime||null,updatedAt:f?.updatedAt||null,statusName:f?.statusName||null,participant1Name:f?.participant1Name||null,participant2Name:f?.participant2Name||null,primaryMatch:match,pinnacle})}
    observation.fixtureCount=observation.fixtures.length;observation.status='ok';
  }catch(e){observation.diagnostics.billableRequestsThisRun=1;observation.diagnostics.oddsRequests=1;observation.status='odds-error';observation.diagnostics.errors.push(safeError(e))}
  writeJson(OUTFILE,observation);
}
main().catch(e=>{observation.status='fatal-error';observation.diagnostics.errors.push(safeError(e));writeJson(OUTFILE,observation);process.exitCode=0});
