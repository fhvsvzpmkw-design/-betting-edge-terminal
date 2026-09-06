(()=>{
const $=s=>document.querySelector(s);
const HISTORY_KEY='bettingEdge.runnerHistory.v1.4';
const LEGACY_HISTORY_KEYS=['bettingEdge.runnerHistory.v1.3','bettingEdge.runnerHistory.v1.2.5','bettingEdge.runnerHistory.v1.2.4','bettingEdge.runnerHistory.v1.2.3','bettingEdge.runnerHistory.v1.2.2'];
const HISTORY_LIMIT=30;
const FEED_URL='./data/live-odds.json';
const REPRICE_QUOTE_MAX_AGE_MINUTES=30;
const QuoteObservation=globalThis.BettingEdgeQuoteObservation;
const BOOK_PRIORITY=['Bet365','DraftKings'];
const VIG_METER_CALIBRATION_ID='vigscope-meter-calibration-v1';
const VIG_METER_TELEMETRY_CUTOVER='2026-09-02T08:43:00-07:00';
const VIG_METER_RESILIENT_CUTOVER='2026-09-05T11:00:00-07:00';
const VIG_PRIMARY_MARKET_CUTOVER='2026-09-06T00:00:00-07:00';
const RUN_HISTORY_URL='./run-history.json';
const VIG_HEAT_LOW_MAX=20,VIG_HEAT_HIGH_MIN=40,VIG_PRESSURE_ADVERSE_MAX=48,VIG_PRESSURE_FAVORABLE_MIN=52,VIG_AGREEMENT_HIGH_MIN=45;
let activeRun=null;
let originalRun=null;
let refreshBusy=false;
let statusFilter='ALL';
const issuedSessionCatalog=new Map();

function deepClone(v){try{return JSON.parse(JSON.stringify(v))}catch(e){return v}}
function b64u(v){try{v=v.replace(/-/g,'+').replace(/_/g,'/');while(v.length%4)v+='=';const bin=atob(v);const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes)}catch(e){return null}}
function b64ue(v){const bytes=new TextEncoder().encode(v);let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function payload(){const h=location.hash.slice(1);if(!h)return null;const p=new URLSearchParams(h);let raw=null;if(p.has('run'))raw=b64u(p.get('run'));else if(p.has('json'))raw=p.get('json');if(!raw)return null;try{return JSON.parse(raw)}catch(e){return {__error:String(e)}}}
function txt(v,f='—'){return(v===null||v===undefined||v==='')?f:String(v)}
function money(v){const n=Number(v);return Number.isFinite(n)?'$'+n.toFixed(2):txt(v,'$0.00')}
function displayPrice(v){const raw=txt(v,'VERIFY PRICE').trim();const m=raw.match(/([+−-]\d{2,4})(?![\d.])/);return m?m[1]:'—'}
function displayPriceTime(v){const raw=String(v||'');let m=raw.match(/\bsnapshot\s+([^)]+?)(?:\)|$)/i);if(m)return m[1].trim();m=raw.match(/\bupdated\s+(.+)$/i);return m?m[1].trim():''}
function isEventStartedClosed(rec){return /EVENT\s+STARTED\s*\/\s*CLOSED/i.test([rec?.price,rec?.move,rec?.analysis,rec?.title].filter(Boolean).join(' '))}
function americanFromText(v){const m=String(v||'').replace(/−/g,'-').match(/[+-]?\d{2,4}/);return m?Number(m[0]):null}
function cls(s){s=String(s||'WAIT').toUpperCase();return s==='BET'?'g':s==='LEAN'?'y':s==='WAIT'?'c':'muted'}
function border(s){s=String(s||'WAIT').toUpperCase();return s==='BET'?'var(--green)':s==='LEAN'?'var(--yellow)':s==='WAIT'?'var(--cyan)':'var(--muted)'}
function el(d,t,c,text){const x=d.createElement(t);if(c)x.className=c;if(text!==undefined)x.textContent=text;return x}

function normalizeRun(run){
  const source=withoutComparison(run)||{},c=source.counts||{},out=deepClone(source)||{};
  out.slot=txt(source.slot,'');
  out.label=txt(source.label,'');
  out.ts=txt(source.ts,'');
  out.bankroll=source.bankroll;
  out.risk=source.risk;
  out.counts={bet:Number(c.bet)||0,lean:Number(c.lean)||0,wait:Number(c.wait)||0,pass:Number(c.pass)||0};
  out.summary=txt(source.summary,'');
  out.feedGeneratedAt=txt(source.feedGeneratedAt,'');
  out.repriceBaseLabel=txt(source.repriceBaseLabel,'');
  out.recs=Array.isArray(source.recs)?deepClone(source.recs):[];
  // prior_runs is a navigation envelope, not part of the individual issued report.
  delete out.prior_runs;
  return out
}
function runKey(run){return [txt(run.ts,''),txt(run.slot,''),txt(run.label,'')].join('|')}
function rememberIssuedRun(run,replace=false){
  if(!run||run.__error||!run.ts)return null;
  const issued=normalizeRun(run),key=runKey(issued);
  if(replace||!issuedSessionCatalog.has(key))issuedSessionCatalog.set(key,issued);
  return deepClone(issuedSessionCatalog.get(key))
}
function catalogRuns(){return [...issuedSessionCatalog.values()].map(deepClone)}
function safeHistory(){try{const map=new Map();const raw=localStorage.getItem(HISTORY_KEY),parsed=raw?JSON.parse(raw):[];if(Array.isArray(parsed))parsed.forEach(x=>map.set(runKey(x),x));return [...map.values()]}catch(e){return []}}
function saveCurrentRun(run){if(!run||run.__error||!run.ts)return;try{const current=rememberIssuedRun(run)||normalizeRun(run),key=runKey(current);let h=safeHistory().filter(x=>runKey(x)!==key);h.push(current);h.sort((a,b)=>String(a.ts||'').localeCompare(String(b.ts||'')));if(h.length>HISTORY_LIMIT)h=h.slice(-HISTORY_LIMIT);localStorage.setItem(HISTORY_KEY,JSON.stringify(h))}catch(e){console.warn('History save failed',e)}}
function localDateKey(ts){const m=String(ts||'').match(/^(\d{4}-\d{2}-\d{2})/);return m?m[1]:''}
function historyFamilyKey(run){const label=txt(run&&run.repriceBaseLabel||run&&run.label||run&&run.slot,'').replace(/\s*\/\/\s*REPRICE\s+\d{1,2}:\d{2}\s*$/i,'').trim();return [localDateKey(run&&run.ts),txt(run&&run.slot,''),label].join('|')}
function mergedPriorRuns(run){
  const currentKey=runKey(run),day=localDateKey(run.ts),embedded=Array.isArray(run.prior_runs)?run.prior_runs:[];
  const exact=new Map();
  [...embedded,...catalogRuns(),...safeHistory()].forEach(x=>{if(!x)return;const k=runKey(x);if(!k||k===currentKey)return;if(day&&localDateKey(x.ts)!==day)return;if(!exact.has(k))exact.set(k,normalizeRun(x))});
  const grouped=new Map();
  [...exact.values()].forEach(x=>{const k=historyFamilyKey(x),prior=grouped.get(k);if(!prior){grouped.set(k,{...x,snapshotCount:1});return}const newer=String(x.ts||'')>String(prior.ts||'')?x:prior;grouped.set(k,{...newer,snapshotCount:(prior.snapshotCount||1)+1})});
  return [...grouped.values()].sort((a,b)=>String(b.ts||'').localeCompare(String(a.ts||'')))
}
function updateRunnerHash(run){try{history.replaceState(null,'',location.pathname+location.search+'#run='+b64ue(JSON.stringify(run)))}catch(e){console.warn('Could not update runner URL',e)}}

function normName(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim()}
function normMarket(v){return normName(v).replace(/\bstrikeouts?\b/g,'strikeout').replace(/\bhome runs?\b/g,'home run').replace(/\brbis?\b/g,'rbi').replace(/\btotal bases?\b/g,'total base').replace(/\bhits?\b/g,'hit').replace(/\bpassing yards?\b/g,'passing yard').replace(/\breceiving yards?\b/g,'receiving yard').replace(/\brushing yards?\b/g,'rushing yard').replace(/\bgoals?\b/g,'goal').replace(/\bshots?\b/g,'shot').replace(/\bpoints?\b/g,'point').replace(/\brebounds?\b/g,'rebound').replace(/\bassists?\b/g,'assist')}
function keywordMatch(a,b){const x=normMarket(a),y=normMarket(b);if(!x||!y)return false;return x===y||x.includes(y)||y.includes(x)}
function decimalOdds(v){const n=Number(v);return Number.isFinite(n)&&n>1.001?n:null}
function americanNumber(dec){const d=Number(dec);if(!Number.isFinite(d)||d<=1)return null;return d>=2?Math.round((d-1)*100):Math.round(-100/(d-1))}
function americanText(dec){const n=americanNumber(dec);return n===null?'UNAVAILABLE':(n>0?'+':'')+n}
function americanProb(a){const n=Number(a);if(!Number.isFinite(n)||n===0)return null;return n>0?100/(n+100):(-n)/((-n)+100)}
function inheritedFairProb(fair){const text=String(fair||'');if(/RECALC|UNVERIFIED|UNAVAILABLE|N\/A/i.test(text))return null;const m=text.match(/([+-]\d{3,4})/);return m?americanProb(Number(m[1])):null}
function clamp(v,min=0,max=100){return Math.max(min,Math.min(max,Number(v)||0))}
function mean(values){const a=(values||[]).filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function signedOdds(v){return [...String(v||'').replace(/−/g,'-').matchAll(/([+-]\d{2,4})(?![\d.])/g)].map(m=>Number(m[1])).filter(Number.isFinite)}
function explicitMovementOddsPairs(v){const text=String(v||'').replace(/−/g,'-'),pairs=[],re=/([+-]\d{2,4})\s*(?:→|->|=>|\bTO\b)\s*([+-]\d{2,4})/gi;for(const m of text.matchAll(re))pairs.push([Number(m[1]),Number(m[2])]);return pairs}
function recWeight(rec){const s=String(rec?.status||'PASS').toUpperCase();return s==='BET'?1.5:s==='LEAN'?1.2:s==='WAIT'?0.8:0.45}
function moveSignal(rec){
  const issued=americanFromText(rec?.price),pc=rec?.priceComparison;
  if(pc?.state==='MATCHED'){
    const current=americanFromText(pc.price),a=americanProb(issued),b=americanProb(current);
    if(a!==null&&b!==null)return {favor:a-b,magnitude:Math.abs(a-b),source:'REPRICE'};
  }
  const pairs=explicitMovementOddsPairs(rec?.move);
  if(pairs.length){const favors=[],mags=[];for(const [from,to] of pairs){const a=americanProb(from),b=americanProb(to);if(a!==null&&b!==null){favors.push(a-b);mags.push(Math.abs(a-b))}}if(favors.length)return {favor:mean(favors)||0,magnitude:mean(mags)||0,source:'MOVE'}}
  const text=String(rec?.move||'').toUpperCase();
  if(/\b(?:PRICE|LINE|MARKET)\s+(?:UNCHANGED|STABLE|FLAT|HELD)\b|\bNO MOVE\b/.test(text))return {favor:0,magnitude:0,source:'TEXT'};
  if(/\bVALUE IMPROVED\b|\bLINE MOVED IN FAVOR\b|\b(?:PRICE|LINE|MARKET)\s+(?:IMPROVED|DRIFTED|EASED)\b|\bBETTER (?:PRICE|LINE)\b/.test(text))return {favor:.005,magnitude:.005,source:'TEXT'};
  if(/\bLINE MOVED AGAINST\b|\bPRICE MOVED AGAINST\b|\b(?:PRICE|LINE|MARKET)\s+(?:WORSENED|SHORTENED|STEAMED)\b|\bMORE EXPENSIVE\b/.test(text))return {favor:-.005,magnitude:.005,source:'TEXT'};
  return {favor:0,magnitude:0,source:'NONE'}
}
function thresholdActivity(rec){
  const status=String(rec?.status||'PASS').toUpperCase();if(!['BET','LEAN'].includes(status))return null;
  const play=americanFromText(rec?.playTo||rec?.betAt),current=rec?.priceComparison?.state==='MATCHED'?americanFromText(rec.priceComparison.price):americanFromText(rec?.price);
  const p=americanProb(play),c=americanProb(current);if(p===null||c===null)return null;
  return clamp(1-Math.abs(c-p)/.03,0,1)
}
function bookOddsFromText(rec,book){
  const text=[rec?.source,rec?.analysis,rec?.price].filter(Boolean).join(' // ').replace(/−/g,'-');
  const re=new RegExp(book+'[^+\\-]{0,28}([+-]\\d{2,4})','i'),m=text.match(re);return m?Number(m[1]):null
}
function fallbackAgreement(run){
  const recs=Array.isArray(run?.recs)?run.recs:[],diffs=[];
  let aligned=0,conflicted=0,stable=0,signals=0;
  for(const rec of recs){
    const a=bookOddsFromText(rec,'Bet365'),b=bookOddsFromText(rec,'DraftKings'),pa=americanProb(a),pb=americanProb(b);
    if(pa!==null&&pb!==null)diffs.push(Math.abs(pa-pb));
    const text=[rec?.move,rec?.analysis,rec?.source,rec?.contrary].filter(Boolean).join(' ').toUpperCase();
    if(!text)continue;
    if(/DISAGREE|DIVERG|CONFLICT|SPLIT|OPPOSITE|MIXED BOOK|BOOKS? (?:ARE )?MIXED/.test(text)){conflicted++;signals++;continue}
    if(/CONVERG|CONSENSUS|AGREE|ALIGNED|IN TANDEM|SAME DIRECTION|BROADLY (?:STEADY|STABLE)/.test(text)){aligned++;signals++;continue}
    if(/UNCHANGED|STABLE|FLAT|HELD|NO MOVE|STEADY/.test(text)){stable++;signals++}
  }
  if(diffs.length){
    const avg=mean(diffs)||0,priceScore=clamp(100-(avg/.10)*100);
    const qualitative=signals?clamp(50+aligned*12+stable*4-conflicted*18):priceScore;
    const score=signals?priceScore*.8+qualitative*.2:priceScore;
    return {score,confidence:clamp(((diffs.length*2+signals)/Math.max(1,recs.length*2))*100),pairs:diffs.length,source:'REPORT + BOOKS'}
  }
  if(!signals)return {score:50,confidence:0,pairs:0,source:'NO COHESION DATA'};
  const score=clamp(50+aligned*14+stable*5-conflicted*20);
  return {score,confidence:clamp((signals/Math.max(1,recs.length))*70),pairs:0,source:'REPORT COHESION'}
}
function requiresPublisherTelemetry(run){const t=Date.parse(run?.ts),cut=Date.parse(VIG_METER_TELEMETRY_CUTOVER);return Number.isFinite(t)&&Number.isFinite(cut)&&t>=cut}
function hasFirstSameDayTelemetry(run){
  const t=run?.instrumentTelemetry,s=t?.source;
  if(!s||s.state!=='UNAVAILABLE'||s.reason!=='NO_PRIOR_SAME_DAY_RUN'||s.priorRunTs!==null||s.priorRunPath!==null)return false;
  if(t.derivedAt!==run.ts||s.feedGeneratedAt!==run.feedGeneratedAt||!Number.isFinite(Date.parse(s.feedGeneratedAt))||!/^[0-9a-f]{40}$/i.test(String(s.feedBlobSha||'')))return false;
  const matches=(actual,expected)=>actual&&Object.entries(expected).every(([key,value])=>actual[key]===value);
  // The publisher explicitly emits these unmeasured defaults for the first
  // same-day run. Missing feeds, fabricated readings and other errors remain blocked.
  return Boolean(
    matches(t.movement,{eligibleSelections:Array.isArray(run.recs)?run.recs.length:0,identityEligibleSelections:0,comparableSelections:0,changedSelections:0,sameBookComparisons:0,averageMagnitude:0,breadth:0,weightedFavor:0,confidence:0,rawConfidence:0,state:'UNMEASURED'})&&
    matches(t.heat,{value:0,rawValue:0,confidence:0,rawConfidence:0,state:'UNMEASURED'})&&
    matches(t.pressure,{value:50,rawValue:50,confidence:0,rawConfidence:0,state:'UNMEASURED'})&&
    matches(t.agreement,{score:50,rawScore:50,confidence:0,rawConfidence:0,pairs:0,source:'BOUND_FEED_BET365_DRAFTKINGS',state:'UNMEASURED'})
  )
}
function hasPublisherTelemetry(run){
  const t=run?.instrumentTelemetry;
  if(Date.parse(run?.ts)>=Date.parse(VIG_PRIMARY_MARKET_CUTOVER)){if(!hasPrimaryMarketTelemetry(run))return false;}
  else if(Date.parse(run?.ts)>=Date.parse(VIG_METER_RESILIENT_CUTOVER)&&!hasResilientMeterTelemetry(run))return false;
  return Boolean(t&&Number(t.schema)===1&&t.authority==='PUBLISHER_BOUND_FEED_V1'&&t.calibrationId===VIG_METER_CALIBRATION_ID&&t.derivedAt&&(t.source?.state==='PINNED'||hasFirstSameDayTelemetry(run))&&t.heat&&t.pressure&&t.agreement)
}
function hasResilientMeterTelemetry(run){
  const t=run?.instrumentTelemetry,s=t?.source,m=t?.movement;
  const sha=v=>/^[0-9a-f]{40}$/i.test(String(v||'')),score=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100;
  return Boolean(t?.calculationVersion===2&&s?.state==='PINNED'&&s.baselinePolicy==='LATEST_REPORT_THEN_ODDS_24H'&&s.maxBaselineAgeHours===24&&sha(s.feedBlobSha)&&s.feedGeneratedAt===run.feedGeneratedAt&&t.derivedAt===run.ts&&
    (s.oddsIndexBlobSha===null||sha(s.oddsIndexBlobSha))&&(s.priorRunBlobSha===null||sha(s.priorRunBlobSha))&&
    m&&Array.isArray(m.comparisons)&&m.comparisons.length===m.comparableSelections&&m.comparableSelections<=(run.recs||[]).length&&m.reportComparisons+m.snapshotComparisons===m.comparableSelections&&score(m.rawConfidence)&&
    m.comparisons.every(c=>['PRIOR_REPORT','ODDS_SNAPSHOT'].includes(c.basis)&&BOOK_PRIORITY.includes(c.book)&&Number.isFinite(Date.parse(c.baselineTs))&&Date.parse(c.baselineTs)<Date.parse(run.ts)&&(c.basis!=='ODDS_SNAPSHOT'||sha(c.baselineFeedBlobSha)))&&
    [t.heat,t.pressure,t.agreement].every(r=>r&&score(r.rawConfidence)&&['MEASURED','PARTIAL','UNMEASURED'].includes(r.state))&&score(t.heat.rawValue)&&score(t.pressure.rawValue)&&score(t.agreement.rawScore))
}
function hasPrimaryMarketTelemetry(run){
  const t=run?.instrumentTelemetry,s=t?.source,m=t?.movement,p=t?.pressure,a=t?.agreement,sample=t?.sample;
  const sha=v=>/^[0-9a-f]{40}$/i.test(String(v||'')),count=v=>Number.isSafeInteger(v)&&v>=0,score=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100;
  if(!(t?.calculationVersion===3&&s?.state==='PINNED'&&s.baselinePolicy==='LATEST_EXACT_PRIMARY_ODDS_24H'&&s.maxBaselineAgeHours===24&&s.maxBaselineSnapshots===12&&sha(s.feedBlobSha)&&sha(s.coverageAuthorityBlobSha)&&(s.oddsIndexBlobSha===null||sha(s.oddsIndexBlobSha))&&s.priorRunTs===null&&s.priorRunPath===null&&s.priorRunBlobSha===null&&s.feedGeneratedAt===run.feedGeneratedAt&&Number.isFinite(Date.parse(s.feedGeneratedAt))&&t.derivedAt===run.ts))return false;
  if(!(sample?.scope==='PRIMARY_FULL_GAME_ONLY'&&sample.basis==='VERIFIED_PRIMARY_MARKET_QUOTES'&&sample.weighting==='EQUAL_LOGICAL_SELECTION'&&sample.thresholdActivityIncluded===false&&['requiredSelections','availableSelections','unavailableSelections','quoteCount','gamesWithQuotes'].every(k=>count(sample[k]))&&sample.requiredSelections===sample.availableSelections+sample.unavailableSelections&&sample.quoteCount>=sample.availableSelections&&sample.quoteCount<=sample.availableSelections*2&&Array.isArray(sample.selectionIds)&&sample.selectionIds.length===sample.availableSelections&&new Set(sample.selectionIds).size===sample.selectionIds.length))return false;
  const ids=new Set(sample.selectionIds),validComparisons=rows=>Array.isArray(rows)&&new Set(rows.map(c=>c.selectionId)).size===rows.length&&rows.every(c=>ids.has(c.selectionId)&&c.basis==='ODDS_SNAPSHOT'&&BOOK_PRIORITY.includes(c.book)&&sha(c.baselineFeedBlobSha)&&Number.isFinite(Date.parse(c.baselineTs))&&Date.parse(c.baselineTs)<Date.parse(run.feedGeneratedAt)&&Date.parse(run.feedGeneratedAt)-Date.parse(c.baselineTs)<=24*3600000&&typeof c.selectionKey==='string'&&c.selectionKey.length>0);
  if(!(m&&m.eligibleSelections===sample.availableSelections&&m.identityEligibleSelections===sample.availableSelections&&count(m.comparableSelections)&&m.comparableSelections<=sample.availableSelections&&m.sameBookComparisons===m.comparableSelections&&m.reportComparisons===0&&m.snapshotComparisons===m.comparableSelections&&score(m.rawConfidence)&&validComparisons(m.comparisons)&&m.comparisons.length===m.comparableSelections))return false;
  if(!(p?.basis==='VERIFIED_BET_LEAN_WAIT_REFERENTS'&&['directionalSelections','comparableSelections','conflictingSelections','unverifiedReferences'].every(k=>count(p[k]))&&p.comparableSelections<=p.directionalSelections&&p.directionalSelections<=sample.availableSelections&&validComparisons(p.comparisons)&&p.comparisons.length===p.comparableSelections&&p.comparisons.every(c=>(run.recs||[]).some(r=>['BET','LEAN','WAIT'].includes(String(r.status||'').toUpperCase())&&r.book===c.book&&r.feed?.selectionKey===c.selectionKey))))return false;
  if(!p.comparableSelections&&(p.state!=='UNMEASURED'||p.rawConfidence!==0||p.rawValue!==50||!['NO_DIRECTIONAL_REFERENCE','CONFLICTING_DIRECTIONAL_REFERENCES','UNVERIFIED_DIRECTIONAL_REFERENCES','NO_EXACT_DIRECTIONAL_SAME_BOOK_BASELINE'].includes(p.reason)))return false;
  if(!(a?.source==='BOUND_PRIMARY_FEED_BET365_DRAFTKINGS'&&count(a.pairs)&&a.pairs<=sample.availableSelections&&Array.isArray(a.comparisons)&&a.comparisons.length===a.pairs&&new Set(a.comparisons.map(c=>c.selectionId)).size===a.pairs&&a.comparisons.every(c=>ids.has(c.selectionId))))return false;
  if(![t.heat,p,a].every(r=>r&&score(r.rawConfidence)&&['MEASURED','PARTIAL','UNMEASURED'].includes(r.state))||!score(t.heat.rawValue)||!score(p.rawValue)||!score(a.rawScore))return false;
  const coverage=run.coverageSummary;
  return !coverage||(coverage.source?.feedBlobSha===s.feedBlobSha&&coverage.source?.feedGeneratedAt===s.feedGeneratedAt&&coverage.selections?.required===sample.requiredSelections&&coverage.selections?.available===sample.availableSelections&&coverage.selections?.unavailable===sample.unavailableSelections);
}
function coverageSummaryState(run){
  const coverage=run?.coverageSummary;
  if(!coverage)return Date.parse(run?.ts)>=Date.parse(VIG_PRIMARY_MARKET_CUTOVER)?'MISSING':'HISTORICAL';
  const c=coverage.selections,d=coverage.decisions,source=coverage.source,meterSource=run.instrumentTelemetry?.source;
  const count=v=>Number.isSafeInteger(v)&&v>=0;
  if(!(coverage.schema===1&&coverage.scope==='RETAINED_SAME_DAY_PREGAME_EVENTS'&&count(coverage.games)&&source?.feedGeneratedAt===run.feedGeneratedAt&&/^[0-9a-f]{40}$/i.test(String(source.feedBlobSha||''))&&Number.isFinite(Date.parse(source.feedGeneratedAt))&&meterSource?.feedBlobSha===source.feedBlobSha&&c&&d&&['required','available','evaluated','blocked','unavailable'].every(k=>count(c[k]))&&['bet','lean','wait','pass'].every(k=>count(d[k]))&&c.required===c.available+c.unavailable&&c.available===c.evaluated+c.blocked&&c.evaluated===d.bet+d.lean+d.wait+d.pass))return 'ERROR';
  if(!(Array.isArray(coverage.unavailableReasons)&&coverage.unavailableReasons.every(r=>typeof r.reason==='string'&&count(r.count))&&coverage.unavailableReasons.reduce((n,r)=>n+r.count,0)===c.unavailable&&Array.isArray(coverage.discoveryOmissions)&&Array.isArray(coverage.blockers)&&coverage.blockers.length===c.blocked))return 'ERROR';
  return 'VALID';
}
function coverageReasonText(reason,coverage){
  const retention=coverage?.source?.maxMarketAgeMinutes;
  const observation=Number(coverage?.source?.quoteObservationVersion)>=1;
  if(observation&&reason==='STALE_EXECUTABLE_QUOTE')return 'Observation older than 30m or observation timestamp invalid';
  if(observation&&reason==='STALE_BEYOND_RETENTION')return Number.isFinite(retention)?`Observation older than ${retention}m retention`:'Observation beyond feed retention';
  if(observation&&reason==='MARKET_SUSPENDED')return 'Market suspended';
  return ({STALE_EXECUTABLE_QUOTE:'Quote older than 30m or timestamp invalid',STALE_BEYOND_RETENTION:Number.isFinite(retention)?`Quote older than ${retention}m retention`:'Quote beyond feed retention',MARKET_NOT_RETURNED:'Market not returned',IDENTITY_UNRESOLVED:'Selection identity unresolved',PRIMARY_LINE_UNRESOLVED:'Primary line unresolved',INCOMPLETE_TWO_SIDED_MARKET:'Incomplete two-sided market',EVENT_NOT_RETURNED:'Event not returned by either book',EVENT_ACQUISITION_INCOMPLETE:'Event acquisition incomplete',SOURCE_UNAVAILABLE:'Research source unavailable',FAIR_MODEL_UNAVAILABLE:'Fair-value model unavailable',PERSONNEL_UNRESOLVED:'Personnel unresolved',CALIBRATION_UNAVAILABLE:'Calibration unavailable',CONFLICTING_EVIDENCE:'Conflicting evidence',RESEARCH_INCOMPLETE:'Research incomplete'})[reason]||String(reason||'Unspecified limitation').replace(/_/g,' ').toLowerCase();
}
function noPublishedCardsText(run){
  if((run?.recs||[]).length)return `No published selections match ${statusFilter}. Choose ALL to see the published cards.`;
  const state=coverageSummaryState(run),c=run?.coverageSummary?.selections;
  if(state==='VALID')return `No cards published. ${c.evaluated} documented decisions; ${c.blocked} selections blocked by evidence; ${c.unavailable} without usable odds. Reviewed decisions and published cards are counted separately.`;
  if(state==='HISTORICAL')return 'No cards published in this issued report. Selection-by-selection analysis coverage was not recorded in this historical report; zero cards does not establish that zero markets were available.';
  return 'No cards published. Analysis coverage cannot be verified from this report.';
}
function coveragePanel(d,run){
  const state=coverageSummaryState(run);
  if(state==='HISTORICAL')return null;
  const panel=el(d,'section','runnerCoverage');panel.id='runnerCoverage';panel.setAttribute('aria-label','Primary market analysis coverage');
  panel.appendChild(el(d,'div','runnerCoverageTitle','PRIMARY MARKET COVERAGE'));
  if(state!=='VALID'){
    panel.dataset.coverageState=state;
    panel.appendChild(el(d,'div','runnerCoverageNote','COVERAGE UNVERIFIED • The saved coverage record is missing or inconsistent. Published card counts do not establish analysis completeness.'));
    return panel;
  }
  panel.dataset.coverageState='VALID';
  const coverage=run.coverageSummary,c=coverage.selections,grid=el(d,'div','runnerCoverageGrid');
  panel.appendChild(el(d,'div','runnerCoverageScope',`${coverage.games} retained pregame games • ${c.required} required primary sides • same betting day`));
  [['ODDS AVAILABLE',c.available],['DOCUMENTED REVIEWS',c.evaluated],['EVIDENCE BLOCKED',c.blocked],['ODDS UNAVAILABLE',c.unavailable]].forEach(([label,value])=>{
    const fact=el(d,'div','runnerCoverageFact');fact.append(el(d,'b','',String(value)),el(d,'span','',label));grid.appendChild(fact);
  });
  panel.appendChild(grid);
  panel.appendChild(el(d,'div','runnerCoverageNote',`${c.available} available = ${c.evaluated} reviewed + ${c.blocked} evidence blocked. Pick counts show published cards only.`));
  if(!(run.recs||[]).length)panel.appendChild(el(d,'div','runnerCoverageEmpty','NO CARDS PUBLISHED • See coverage and limitations below.'));
  if(coverage.discoveryOmissions.length)panel.appendChild(el(d,'div','runnerCoverageWarning',`${coverage.discoveryOmissions.length} additional discovered game${coverage.discoveryOmissions.length===1?' was':'s were'} not retained in the feed; excluded from the coverage counts above.`));
  const details=el(d,'details','runnerCoverageDetails');details.appendChild(el(d,'summary','',`REVIEW OUTCOMES & LIMITATIONS${c.blocked+c.unavailable?' • '+(c.blocked+c.unavailable)+' sides':''}`));
  const decisions=coverage.decisions;details.appendChild(el(d,'p','',`Documented decisions: ${decisions.bet} BET / ${decisions.lean} LEAN / ${decisions.wait} WAIT / ${decisions.pass} PASS. These are analysis outcomes, not published-card counts.`));
  if(coverage.unavailableReasons.length){const list=el(d,'ul');coverage.unavailableReasons.forEach(r=>list.appendChild(el(d,'li','',`${r.count} sides: ${coverageReasonText(r.reason,coverage)}.`)));details.appendChild(list);}
  if(coverage.blockers.length){
    details.appendChild(el(d,'div','runnerCoverageSubhead','EVIDENCE BLOCKERS'));
    const list=el(d,'ul');coverage.blockers.forEach(b=>list.appendChild(el(d,'li','',`${b.label||'Event '+b.eventId} • ${String(b.marketDetail||'').replace(/_/g,' ')} • ${b.side}: ${coverageReasonText(b.reason,coverage)}. Missing: ${b.missing} Impact: ${b.impact}`)));details.appendChild(list);
  }
  if(coverage.unavailableDetails?.length){
    details.appendChild(el(d,'div','runnerCoverageSubhead','ODDS LIMITATIONS'));
    const list=el(d,'ul');coverage.unavailableDetails.forEach(b=>list.appendChild(el(d,'li','',`${b.label||'Event '+b.eventId} • ${String(b.marketDetail||'').replace(/_/g,' ')} • ${(b.selections||[]).join(', ')}: ${coverageReasonText(b.reason,coverage)}.`)));details.appendChild(list);
  }
  if(coverage.discoveryOmissions.length){const list=el(d,'ul');coverage.discoveryOmissions.forEach(b=>list.appendChild(el(d,'li','',`${b.label||'Event '+b.eventId}: ${coverageReasonText(b.reason,coverage)}.`)));details.appendChild(list);}
  panel.appendChild(details);return panel;
}
function pressureReasonText(reason){return ({NO_DIRECTIONAL_REFERENCE:'No BET, LEAN or WAIT selection supplies a direction.',CONFLICTING_DIRECTIONAL_REFERENCES:'Opposing selections conflict; pressure cannot use them.',UNVERIFIED_DIRECTIONAL_REFERENCES:'Directional selections do not match verified primary quotes.',NO_EXACT_DIRECTIONAL_SAME_BOOK_BASELINE:'No earlier exact quote from the same book for the selected direction.'})[reason]||''}
function meterBaselineText(run){
  if(telemetryIntegrityState(run)!=='VALID')return '';
  const t=run.instrumentTelemetry,m=t.movement;
  if(t.calculationVersion===3){
    const sample=t.sample;
    return `METERS: ${sample.availableSelections} VERIFIED PRIMARY SIDES • ${m.comparableSelections} SAME-BOOK COMPARISONS${!m.comparableSelections?' • MOVEMENT UNAVAILABLE':''}${t.pressure.reason==='NO_DIRECTIONAL_REFERENCE'?' • NO DIRECTIONAL REFERENCE':''}`;
  }
  if(t.calculationVersion!==2)return '';
  if(!(run.recs||[]).length)return 'METERS: NO PUBLISHED SELECTIONS IN METER SAMPLE';
  if(!m.comparableSelections)return 'METERS: CURRENT QUOTES ONLY • MOVEMENT UNAVAILABLE';
  const times=m.comparisons.map(c=>c.baselineTs).sort((a,b)=>Date.parse(a)-Date.parse(b));
  const clock=ts=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(ts));
  const range=times[0]===times[times.length-1]?clock(times[0]):`${clock(times[0])} – ${clock(times[times.length-1])}`;
  return `METER BASELINE: ${m.reportComparisons} REPORT / ${m.snapshotComparisons} SAVED ODDS • ${range} PT`;
}
function telemetryIntegrityState(run){return requiresPublisherTelemetry(run)?(hasPublisherTelemetry(run)?'VALID':'ERROR'):'LEGACY'}
async function recoverCanonicalIssuedRun(run){
  if(telemetryIntegrityState(run)!=='ERROR')return null;
  try{
    const indexRes=await fetch(`${RUN_HISTORY_URL}?t=${Date.now()}`,{cache:'no-store'});if(!indexRes.ok)return null;
    const index=await indexRes.json(),entry=(index?.runs||[]).find(x=>String(x?.ts||'')===String(run?.ts||'')&&String(x?.slot||'')===String(run?.slot||''));
    if(!entry?.path)return null;
    const reportRes=await fetch(`./${entry.path}?t=${Date.now()}`,{cache:'no-store'});if(!reportRes.ok)return null;
    const canonical=await reportRes.json();
    if(String(canonical?.ts||'')!==String(run?.ts||'')||String(canonical?.slot||'')!==String(run?.slot||''))return null;
    if(telemetryIntegrityState(canonical)!=='VALID')return null;
    rememberIssuedRun(canonical,true);
    return normalizeRun(canonical)
  }catch(e){return null}
}
function recoverActiveRunIfNeeded(){
  const candidate=activeRun;if(!candidate||telemetryIntegrityState(candidate)!=='ERROR')return;
  recoverCanonicalIssuedRun(candidate).then(recovered=>{
    if(!recovered||runKey(activeRun)!==runKey(candidate))return;
    activeRun=recovered;originalRun=deepClone(recovered);saveCurrentRun(recovered);updateRunnerHash(recovered);
    try{apply(activeRun)}catch(e){console.warn('Canonical run recovery render failed',e)}
  }).catch(e=>console.warn('Canonical run recovery failed',e))
}
function instrumentAgreement(run){return run?.instrumentTelemetry?.agreement||fallbackAgreement(run)}
function heatLabel(v){return v<15?'DORMANT':v<28?'QUIET':v<40?'FORMING':v<55?'ACTIVE':v<70?'PRESSURED':v<85?'HOT':'EXTREME'}
function pressureLabel(v){return v<15?'HEAVY AGAINST':v<30?'AGAINST':v<48?'LEAN AGAINST':v<52?'NEUTRAL':v<71?'LEAN FAVORABLE':v<86?'FAVORABLE':'STRONG FAVORABLE'}
function agreementLabel(v){return v<15?'FRACTURED':v<30?'WIDE':v<45?'MIXED':v<60?'NORMAL':v<75?'TIGHT':v<90?'STRONG':'LOCKSTEP'}
function agreementEvidenceQuality(confidence){const c=clamp(confidence);return c===0?'UNMEASURED':c<25?'LIMITED':'SUPPORTED'}
function deriveInstrumentReadings(run){
  if(telemetryIntegrityState(run)==='ERROR'){
    const failure={value:0,rawValue:0,label:'INTEGRITY ERROR',confidence:0};
    return {heat:{...failure},pressure:{...failure},agreement:{...failure,rawConfidence:0,evidenceQuality:'INTEGRITY ERROR',pairs:0}}
  }
  const recs=Array.isArray(run?.recs)?run.recs:[],signals=recs.map(r=>({...moveSignal(r),weight:recWeight(r)}));
  const weighted=signals.reduce((n,x)=>n+x.weight,0)||1;
  const fav=signals.reduce((n,x)=>n+x.favor*x.weight,0)/weighted;
  const mags=signals.map(x=>x.magnitude),avgMag=mean(mags)||0;
  const breadth=recs.length?signals.filter(x=>x.magnitude>=.0025).length/recs.length:0;
  const th=(recs.map(thresholdActivity).filter(x=>x!==null));const threshold=mean(th)||0;
  const agreement=instrumentAgreement(run),agreementScore=clamp(agreement?.score??50),agreementConfidence=clamp(agreement?.confidence??0);
  const dispersion=agreementConfidence>0?(100-agreementScore)/100:0;
  const confidenceFactor=agreementConfidence===0?0:0.50+0.50*Math.sqrt(agreementConfidence/100);
  const heat=clamp((avgMag/.03)*40+breadth*25+threshold*20+dispersion*15*confidenceFactor);
  const pressure=clamp(50+50*Math.tanh(fav/0.028));
  const movementCoverage=recs.length?signals.filter(x=>x.source!=='NONE').length/recs.length:0;
  const pressureConf=clamp(movementCoverage*100),heatConf=clamp((movementCoverage*.7+(agreementConfidence/100)*.3)*100);
  const agreementQuality=agreementEvidenceQuality(agreementConfidence);
  const telemetry=run?.instrumentTelemetry,structured=telemetry?.authority==='PUBLISHER_BOUND_FEED_V1'&&telemetry?.calibrationId===VIG_METER_CALIBRATION_ID;
  const structuredHeat=telemetry?.heat||{},structuredPressure=telemetry?.pressure||{};
  const structuredHeatValue=clamp(structuredHeat.rawValue??structuredHeat.value??0),structuredHeatConfidence=clamp(structuredHeat.rawConfidence??structuredHeat.confidence??0);
  const structuredPressureValue=clamp(structuredPressure.rawValue??structuredPressure.value??50),structuredPressureConfidence=clamp(structuredPressure.rawConfidence??structuredPressure.confidence??0);
  return {
    heat:structured?{value:Math.round(structuredHeatValue),rawValue:structuredHeatValue,label:structuredHeatConfidence?(structuredHeat.state==='PARTIAL'?'PARTIAL':heatLabel(structuredHeatValue)):'NO DATA',confidence:Math.round(structuredHeatConfidence)}:{value:Math.round(heat),rawValue:heat,label:heatConf?heatLabel(heat):'NO DATA',confidence:Math.round(heatConf)},
    pressure:structured?{value:Math.round(structuredPressureValue),rawValue:structuredPressureValue,label:structuredPressureConfidence?pressureLabel(structuredPressureValue):(structuredPressure.reason==='NO_DIRECTIONAL_REFERENCE'?'NO DIRECTION':'NO DATA'),reason:structuredPressure.reason,conflictingSelections:structuredPressure.conflictingSelections,unverifiedReferences:structuredPressure.unverifiedReferences,confidence:Math.round(structuredPressureConfidence)}:{value:Math.round(pressure),rawValue:pressure,label:pressureConf?pressureLabel(pressure):'NO DATA',confidence:Math.round(pressureConf)},
    agreement:{value:Math.round(agreementScore),rawValue:agreementScore,label:agreementConfidence?agreementLabel(agreementScore):'UNMEASURED',confidence:Math.round(agreementConfidence),rawConfidence:agreementConfidence,evidenceQuality:agreementQuality,pairs:agreement.pairs||0}
  }
}
function vancouverIso(date=new Date()){try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'longOffset'}).formatToParts(date);const o=Object.fromEntries(parts.map(p=>[p.type,p.value]));const hh=o.hour==='24'?'00':o.hour;let off=String(o.timeZoneName||'GMT-07:00').replace('GMT','');if(!/^[+-]\d{2}:\d{2}$/.test(off))off='-07:00';return `${o.year}-${o.month}-${o.day}T${hh}:${o.minute}:${o.second}${off}`}catch(e){return date.toISOString()}}
function vancouverClock(ts){const d=new Date(ts);if(!Number.isFinite(d.getTime()))return txt(ts,'');return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',hour:'numeric',minute:'2-digit',hour12:true,month:'short',day:'numeric'}).format(d)}
function ageLabel(ts){const t=Date.parse(ts);if(!Number.isFinite(t))return 'PRICE TIME UNKNOWN';const m=Math.max(0,Math.round((Date.now()-t)/60000));return m<2?'JUST UPDATED':m<60?`${m}m OLD`:`${Math.floor(m/60)}h ${m%60}m OLD`}

function mergeEvent(a,b){const out={...(a||{}),...(b||{})};out.bookmakers={...(a?.bookmakers||{})};for(const [book,markets] of Object.entries(b?.bookmakers||{})){const old=Array.isArray(out.bookmakers[book])?out.bookmakers[book]:[];const add=Array.isArray(markets)?markets:[];const key=m=>normMarket(m?.name)+'|'+String(m?.updatedAt||'');out.bookmakers[book]=[...new Map([...old,...add].map(m=>[key(m),m])).values()]}out.urls={...(a?.urls||{}),...(b?.urls||{})};out.bookmakerIds={...(a?.bookmakerIds||{}),...(b?.bookmakerIds||{})};return out}
function allEvents(feed){if(Object.prototype.hasOwnProperty.call(feed||{},'quoteObservationVersion')&&!QuoteObservation)return [];if(QuoteObservation?.requiresObservation(feed))return QuoteObservation.mergeObservedEvents(feed).map(event=>({...event,bookmakers:Object.fromEntries(Object.entries(event.bookmakers||{}).map(([book,markets])=>{const groups=new Map();for(const market of markets){const key=marketIdentity(market);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(market)}return [book,[...groups.values()].map(copies=>newestMarket(copies,feed))]}))}));const map=new Map();for(const e of [...(feed?.events||[]),...(feed?.deepMarkets||[]),...(feed?.baseballProps||[])]){if(!e?.id)continue;map.set(String(e.id),map.has(String(e.id))?mergeEvent(map.get(String(e.id)),e):e)}return [...map.values()]}
function stableQuoteValue(value){return Array.isArray(value)?value.map(stableQuoteValue):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableQuoteValue(value[key])])):value}
function newestMarket(markets,feed){
  if(!Array.isArray(markets)||!markets.length)return null;
  if(Object.prototype.hasOwnProperty.call(feed||{},'quoteObservationVersion')&&!QuoteObservation)return null;
  if(!QuoteObservation?.requiresObservation(feed))return markets[0];
  const sorted=[...markets].sort((a,b)=>QuoteObservation.compareMarketRecency(a,b,feed)),newest=sorted[0],time=QuoteObservation.quoteTimeMs(newest,feed);
  const simultaneous=sorted.filter(market=>QuoteObservation.quoteTimeMs(market,feed)===time);
  if(new Set(simultaneous.map(market=>JSON.stringify(stableQuoteValue(market)))).size>1)return {...newest,suspended:true,observationConflict:true};
  return newest;
}
function marketByName(event,book,name,feed){const arr=event?.bookmakers?.[book];if(!Array.isArray(arr))return null;const exact=newestMarket(arr.filter(m=>normMarket(m?.name)===normMarket(name)),feed);if(exact)return exact;return newestMarket(arr.filter(m=>keywordMatch(m?.name,name)),feed)}
function canonicalMarketKey(v){return normMarket(v).replace(/\s+/g,'-')}
function eventIdentity(e){return String(e?.eventId||e?.identity?.eventId||e?.id||'')}
function eventKey(e){return String(e?.eventKey||e?.identity?.eventKey||(eventIdentity(e)?`odds-api-io:${eventIdentity(e)}`:''))}
function marketIdentity(m){return String(m?.marketKey||m?.identity?.marketKey||canonicalMarketKey(m?.name||''))}
function rowLabel(row){return normName(row?.label||row?.player||row?.participant||row?.name||row?.selection||'')}
function rowLine(row){for(const k of ['hdp','line','total','points']){const n=Number(row?.[k]);if(Number.isFinite(n))return n}return null}
function selectionIdentity(row,side,event=null,market=null){const s=String(side||'').toLowerCase();const supplied=row?.selectionKeys?.[s]||row?.identity?.selectionKeys?.[s]||row?.selectionKey||row?.identity?.selectionKey;if(supplied)return String(supplied);const id=eventIdentity(event),mk=marketIdentity(market||{}),label=rowLabel(row),line=rowLine(row);return [id,mk,s,label,line===null?'':String(line)].join('|')}
function quoteFromStructured(event,book,feedRef,feed){const arr=event?.bookmakers?.[book];const wantedKey=String(feedRef.marketKey||'');let market=null;if(Array.isArray(arr)&&wantedKey)market=newestMarket(arr.filter(m=>marketIdentity(m)===wantedKey),feed);if(!market&&feedRef.market)market=marketByName(event,book,feedRef.market,feed);if(!market||!Array.isArray(market.odds)||(QuoteObservation?.requiresObservation(feed)&&(QuoteObservation.isSuspended(event)||QuoteObservation.isSuspended(market))))return null;const side=String(feedRef.side||'').toLowerCase();const label=normName(feedRef.label||'');const wantedSelection=String(feedRef.selectionKey||'');const hasHdp=feedRef.hdp!==undefined&&feedRef.hdp!==null&&feedRef.hdp!=='';const hdp=hasHdp?Number(feedRef.hdp):null;for(const row of market.odds){if(QuoteObservation?.requiresObservation(feed)&&QuoteObservation.isSuspended(row))continue;if(wantedSelection&&selectionIdentity(row,side,event,market)!==wantedSelection)continue;if(label&&rowLabel(row)!==label)continue;if(hasHdp){const line=rowLine(row);if(line===null||Math.abs(line-hdp)>0.001)continue}const dec=decimalOdds(row?.[side]);if(dec)return {book,dec,updatedAt:market.updatedAt,...(market.observedAt!==undefined?{observedAt:market.observedAt}:{}),event,market:market.name,marketObj:market,side,row}}return null}
function nickName(v){const a=normName(v).split(' ').filter(Boolean);return a[a.length-1]||''}
function teamExact(value,wanted){const a=normName(value),b=normName(wanted);return Boolean(a&&b&&a===b)}
function teamLoose(value,wanted){const a=normName(value),b=normName(wanted);return Boolean(a&&b&&(a===b||nickName(value)===b||a===nickName(wanted)||nickName(value)===nickName(wanted)))}
function sportKeyFromMeta(meta){const s=normName(String(meta||'').split('|')[0]);if(/\bmlb\b|baseball/.test(s))return 'baseball';if(/\bwnba\b|\bnba\b|basketball/.test(s))return 'basketball';if(/\bnhl\b|hockey/.test(s))return 'ice-hockey';if(/\bnfl\b|\bncaaf\b|\bcfl\b|american football/.test(s))return 'american-football';if(/nwsl|soccer|football/.test(s))return 'football';if(/tennis/.test(s))return 'tennis';if(/boxing/.test(s))return 'boxing';if(/mma|ufc|mixed martial/.test(s))return 'mma';return ''}
function eventSportKey(e){const s=normName(e?.identity?.sportKey||e?.sport?.slug||e?.sport?.name||'');if(/mixed martial|mma|ufc/.test(s))return 'mma';return s}
function expectedEventTime(rec,run){const meta=String(rec?.meta||'');const m=meta.match(/\b(\d{1,2}):(\d{2})\s*(?:(a|p)\.?\s*m\.?\s*)?(?:PT|PST|PDT)\b/i);const day=localDateKey(run?.ts);if(!m||!day)return null;let hour=Number(m[1]);const meridiem=String(m[3]||'').toLowerCase();if(meridiem)hour=(hour%12)+(meridiem==='p'?12:0);if(!Number.isInteger(hour)||hour<0||hour>23)return null;const hh=String(hour).padStart(2,'0'),mm=m[2],off=String(run?.ts||'').match(/([+-]\d{2}:\d{2})$/)?.[1]||'-07:00';const t=Date.parse(`${day}T${hh}:${mm}:00${off}`);return Number.isFinite(t)?t:null}
function matchContext(rec,run){return {eventId:String(rec?.feed?.eventId||''),sportKey:sportKeyFromMeta(rec?.meta),expectedTime:expectedEventTime(rec,run)}}
function resolveTeamEvent(feed,team,opponent='',ctx={}){const events=allEvents(feed);if(ctx.eventId){const exact=events.find(e=>eventIdentity(e)===ctx.eventId);if(exact)return {event:exact,reason:''}}const n=normName(team);if(!n)return {event:null,reason:'IDENTITY MISMATCH — TEAM MISSING'};let matches=events.filter(e=>teamExact(e.home,team)||teamExact(e.away,team));if(!matches.length)matches=events.filter(e=>teamLoose(e.home,team)||teamLoose(e.away,team));if(opponent){let narrowed=matches.filter(e=>teamExact(e.home,opponent)||teamExact(e.away,opponent));if(!narrowed.length)narrowed=matches.filter(e=>teamLoose(e.home,opponent)||teamLoose(e.away,opponent));if(narrowed.length)matches=narrowed}if(ctx.sportKey){const narrowed=matches.filter(e=>eventSportKey(e)===ctx.sportKey);if(narrowed.length)matches=narrowed}if(!matches.length)return {event:null,reason:'IDENTITY MISMATCH — EVENT NOT FOUND'};if(matches.length===1)return {event:matches[0],reason:''};if(Number.isFinite(ctx.expectedTime)){const ranked=matches.map(e=>({e,d:Math.abs((Date.parse(e?.date)||Infinity)-ctx.expectedTime)})).filter(x=>Number.isFinite(x.d)).sort((a,b)=>a.d-b.d);if(ranked.length&&ranked[0].d<=3*3600000&&(ranked.length===1||ranked[1].d-ranked[0].d>=30*60000))return {event:ranked[0].e,reason:''}}return {event:null,reason:'IDENTITY MISMATCH — MULTIPLE EVENTS'} }
function quoteIdentity(q){if(!q?.event||!q?.marketObj||!q?.side)return null;const line=rowLine(q.row);const rawLabel=q.row?.label||q.row?.player||q.row?.participant||q.row?.name||q.row?.selection||'';const out={eventId:eventIdentity(q.event),eventKey:eventKey(q.event),eventDate:q.event?.date||'',sportKey:eventSportKey(q.event),market:q.market||q.marketObj?.name||'',marketKey:marketIdentity(q.marketObj),side:String(q.side).toLowerCase(),selectionKey:selectionIdentity(q.row,q.side,q.event,q.marketObj)};if(line!==null)out.hdp=line;if(rawLabel)out.label=rawLabel;return out}
function playerEvents(feed,player,keyword){const p=normName(player),hits=[];for(const e of allEvents(feed)){for(const book of ['Bet365','DraftKings']){const markets=e?.bookmakers?.[book];if(!Array.isArray(markets))continue;for(const m of markets){if(keyword&&!keywordMatch(m?.name,keyword))continue;if((m.odds||[]).some(row=>rowLabel(row)===p)){hits.push(e);break}}}}return [...new Map(hits.map(e=>[String(e.id),e])).values()]}
function quoteAgeMinutesAtFeed(q,feed){if(Object.prototype.hasOwnProperty.call(feed||{},'quoteObservationVersion'))return QuoteObservation?QuoteObservation.quoteAgeMinutes(q?.marketObj||q,feed):Infinity;const qt=Date.parse(q?.updatedAt),ft=Date.parse(feed?.generatedAt);if(!Number.isFinite(qt)||!Number.isFinite(ft))return Infinity;return Math.max(0,(ft-qt)/60000)}
function staleQuoteReason(feed){return QuoteObservation?.requiresObservation(feed)?'PRICE NOT VERIFIED — OBSERVATION STALE OR INVALID':'PRICE NOT VERIFIED — QUOTE STALE'}
function bestBookQuote(quotes,feed,issuedBook=''){const fresh=(quotes||[]).filter(q=>quoteAgeMinutesAtFeed(q,feed)<=REPRICE_QUOTE_MAX_AGE_MINUTES&&(!QuoteObservation?.requiresObservation(feed)||(!QuoteObservation.isSuspended(q.event)&&!QuoteObservation.isSuspended(q.marketObj)&&!QuoteObservation.isSuspended(q.row))));if(!fresh.length)return null;const bestDec=Math.max(...fresh.map(q=>q.dec));const tied=fresh.filter(q=>Math.abs(q.dec-bestDec)<1e-12);if(issuedBook){const retained=tied.find(q=>q.book===issuedBook);if(retained)return retained}return tied.sort((a,b)=>{const ai=BOOK_PRIORITY.indexOf(a.book),bi=BOOK_PRIORITY.indexOf(b.book);return (ai<0?999:ai)-(bi<0?999:bi)})[0]||null}
function buildInstrumentTelemetry(recs,feed){
  const diffs=[];let eligible=0;
  for(const rec of recs||[]){
    const ref=rec?.feed;if(!ref?.eventId||!(ref.market||ref.marketKey)||!ref.side)continue;
    const event=allEvents(feed).find(e=>eventIdentity(e)===String(ref.eventId));if(!event)continue;eligible++;
    const a=quoteFromStructured(event,'Bet365',ref,feed),b=quoteFromStructured(event,'DraftKings',ref,feed);
    if(!a||!b)continue;if(quoteAgeMinutesAtFeed(a,feed)>REPRICE_QUOTE_MAX_AGE_MINUTES||quoteAgeMinutesAtFeed(b,feed)>REPRICE_QUOTE_MAX_AGE_MINUTES)continue;
    const pa=americanProb(americanNumber(a.dec)),pb=americanProb(americanNumber(b.dec));if(pa!==null&&pb!==null)diffs.push(Math.abs(pa-pb));
  }
  if(!diffs.length)return {agreement:{score:50,confidence:0,pairs:0,eligible,source:'LIVE FEED'}};
  const avg=mean(diffs)||0;return {agreement:{score:clamp(100-(avg/.10)*100),confidence:clamp((diffs.length/Math.max(1,eligible))*100),pairs:diffs.length,eligible,source:'LIVE FEED'}}
}

function matchMoneyline(title,feed,books,ctx={},issuedBook=''){const m=title.match(/^(.*?)\s+(?:(?:3[- ]?way)\s+)?(?:ML|moneyline)(?:\s+(?:vs\.?|v\.?|at)\s+(.+))?$/i);if(!m)return null;const team=m[1].trim(),opponent=(m[2]||'').trim(),resolved=resolveTeamEvent(feed,team,opponent,ctx),event=resolved.event;if(!event)return {quote:null,reason:resolved.reason};const side=teamExact(event.home,team)||(!teamExact(event.away,team)&&teamLoose(event.home,team))?'home':'away';const quotes=[];let marketSeen=false;for(const book of books){const market=marketByName(event,book,'ML',feed)||marketByName(event,book,'Moneyline',feed);if(!market||(QuoteObservation?.requiresObservation(feed)&&QuoteObservation.isSuspended(market)))continue;marketSeen=true;const row=market.odds?.find(x=>decimalOdds(x?.[side]));const dec=decimalOdds(row?.[side]);if(dec)quotes.push({book,dec,updatedAt:market.updatedAt,...(market.observedAt!==undefined?{observedAt:market.observedAt}:{}),event,market:market.name,marketObj:market,side,row})}const quote=bestBookQuote(quotes,feed,issuedBook);return quote?{quote,reason:''}:{quote:null,reason:quotes.length?staleQuoteReason(feed):marketSeen?'PRICE NOT VERIFIED — BOOK PRICE MISSING':'MARKET UNAVAILABLE — ML NOT RETURNED'}}
function matchSpread(title,feed,books,ctx={},issuedBook=''){const m=title.match(/^(.*?)\s+([+-]\d+(?:\.\d+)?)(?:\s+(?:vs\.?|v\.?|at)\s+(.+))?$/i);if(!m)return null;const team=m[1].trim(),line=Number(m[2]),opponent=(m[3]||'').trim(),resolved=resolveTeamEvent(feed,team,opponent,ctx),event=resolved.event;if(!event)return {quote:null,reason:resolved.reason};const side=teamExact(event.home,team)||(!teamExact(event.away,team)&&teamLoose(event.home,team))?'home':'away';const quotes=[];let marketSeen=false,lineSeen=false;for(const book of books){const market=marketByName(event,book,'Spread',feed);if(!market||(QuoteObservation?.requiresObservation(feed)&&QuoteObservation.isSuspended(market)))continue;marketSeen=true;let rows=(market.odds||[]).filter(row=>{const rl=rowLine(row);if(rl===null)return false;if(Math.abs(Math.abs(rl)-Math.abs(line))>0.001)return false;lineSeen=true;return decimalOdds(row?.[side])});rows.sort((a,b)=>Math.abs((rowLine(a)??99)-line)-Math.abs((rowLine(b)??99)-line));const row=rows[0],dec=decimalOdds(row?.[side]);if(dec)quotes.push({book,dec,updatedAt:market.updatedAt,...(market.observedAt!==undefined?{observedAt:market.observedAt}:{}),event,market:market.name,marketObj:market,side,row})}const quote=bestBookQuote(quotes,feed,issuedBook);return quote?{quote,reason:''}:{quote:null,reason:quotes.length?staleQuoteReason(feed):!marketSeen?'MARKET UNAVAILABLE — SPREAD NOT RETURNED':!lineSeen?'PRICE NOT VERIFIED — LINE NOT RETURNED':'PRICE NOT VERIFIED — BOOK PRICE MISSING'}}
function parsePropTitle(title){let m=title.match(/^(.*?)\s+([OU])\s*(\d+(?:\.\d+)?)\s+(.+)$/i);if(m)return {player:m[1].trim(),side:m[2].toUpperCase()==='O'?'over':'under',line:Number(m[3]),keyword:m[4].trim()};m=title.match(/^(.*?)\s+(over|under)\s+(\d+(?:\.\d+)?)\s+(.+)$/i);if(m)return {player:m[1].trim(),side:m[2].toLowerCase(),line:Number(m[3]),keyword:m[4].trim()};return null}
function matchProp(title,feed,books,issuedBook=''){const p=parsePropTitle(title);if(!p)return null;const events=playerEvents(feed,p.player,p.keyword);if(!events.length){const playerAnywhere=playerEvents(feed,p.player,'');return {quote:null,reason:playerAnywhere.length?'PROP NOT RETURNED':'PLAYER / EVENT NOT FOUND'}}const quotes=[];let marketSeen=false,lineSeen=false;for(const event of events){for(const book of books){const markets=event?.bookmakers?.[book]||[];for(const market of markets){if(!keywordMatch(market?.name,p.keyword))continue;marketSeen=true;for(const row of market.odds||[]){if(rowLabel(row)!==normName(p.player))continue;const rl=rowLine(row);if(rl===null||Math.abs(rl-p.line)>0.001)continue;lineSeen=true;const dec=decimalOdds(row?.[p.side]);if(dec)quotes.push({book,dec,updatedAt:market.updatedAt,...(market.observedAt!==undefined?{observedAt:market.observedAt}:{}),event,market:market.name,marketObj:market,side:p.side,row})}}}}const quote=bestBookQuote(quotes,feed,issuedBook);return quote?{quote,reason:''}:{quote:null,reason:quotes.length?staleQuoteReason(feed):!marketSeen?'PROP NOT RETURNED':!lineSeen?'PROP LINE NOT RETURNED':'BOOK PRICE MISSING'}}
function matchGameTotal(title,feed,books,ctx={},issuedBook=''){const m=title.match(/^(.*?)\s+(over|under|[OU])\s*(\d+(?:\.\d+)?)\s+(?:total|runs?|points?|goals?)$/i);if(!m)return null;const team=m[1].trim(),side=/^(over|o)$/i.test(m[2])?'over':'under',line=Number(m[3]),resolved=resolveTeamEvent(feed,team,'',ctx),event=resolved.event;if(!event)return {quote:null,reason:resolved.reason};const quotes=[];let marketSeen=false,lineSeen=false;for(const book of books){const market=marketByName(event,book,'Total',feed)||marketByName(event,book,'Totals',feed);if(!market||(QuoteObservation?.requiresObservation(feed)&&QuoteObservation.isSuspended(market)))continue;marketSeen=true;for(const row of market.odds||[]){const rl=rowLine(row);if(rl===null||Math.abs(rl-line)>0.001)continue;lineSeen=true;const dec=decimalOdds(row?.[side]);if(dec)quotes.push({book,dec,updatedAt:market.updatedAt,...(market.observedAt!==undefined?{observedAt:market.observedAt}:{}),event,market:market.name,marketObj:market,side,row})}}const quote=bestBookQuote(quotes,feed,issuedBook);return quote?{quote,reason:''}:{quote:null,reason:quotes.length?staleQuoteReason(feed):!marketSeen?'MARKET UNAVAILABLE — TOTAL NOT RETURNED':!lineSeen?'PRICE NOT VERIFIED — LINE NOT RETURNED':'PRICE NOT VERIFIED — BOOK PRICE MISSING'}}
function matchTitle(v){return String(v||'').trim().replace(/^(?:(?:NEW\s+)?LEAN|NEW\s+BET|STILL\s+BET|DOWNGRADE|UPGRADE|PRICE\s+GONE|STILL\s+PASS|PASS\s*\/\s*NO\s+VALUE|PASS|WAIT|BET|CONFLICTING\s+SIGNALS|LINEUP\/INFORMATION\s+PENDING|EDGE\s+GONE|NO\s+VALUE|VALUE\s+CONFIRMED|VALUE\s+IMPROVED|VALUE\s+HOLDS|PRICE\s+MOVED|FAIR\s+VALUE\s+CHANGED|MARKET\s+UNAVAILABLE|PRICE\s+NOT\s+VERIFIED|FEED\s+STALE|POLICY\s+BLOCK|EVENT\s+STARTED\/CLOSED|DUPLICATE\s+EXPOSURE|IDENTITY\s+MISMATCH)\s*(?:[-–—:]|\/\/)\s*/i,'').trim()}
function bestQuoteForRec(rec,feed,run){const books=['Bet365','DraftKings'],issuedBook=String(rec?.book||'');if(rec?.feed?.eventId&&(rec?.feed?.market||rec?.feed?.marketKey)&&rec?.feed?.side){const event=allEvents(feed).find(e=>eventIdentity(e)===String(rec.feed.eventId));if(event){const quotes=[];for(const book of books){const q=quoteFromStructured(event,book,rec.feed,feed);if(q)quotes.push(q)}if(quotes.length){const quote=bestBookQuote(quotes,feed,issuedBook);return quote?{quote,reason:'',method:'STRUCTURED'}:{quote:null,reason:staleQuoteReason(feed),method:'STRUCTURED'}}const arr=Object.values(event?.bookmakers||{}).flat();const marketExists=arr.some(m=>rec.feed.marketKey?marketIdentity(m)===String(rec.feed.marketKey):keywordMatch(m?.name,rec.feed.market));return {quote:null,reason:marketExists?'PRICE NOT VERIFIED — SELECTION NOT RETURNED':'MARKET UNAVAILABLE — STRUCTURED MARKET NOT RETURNED',method:'STRUCTURED'}}return {quote:null,reason:'IDENTITY MISMATCH — STRUCTURED EVENT NOT FOUND',method:'STRUCTURED'}}const title=matchTitle(rec?.title),ctx=matchContext(rec,run);const attempts=[['MONEYLINE',()=>matchMoneyline(title,feed,books,ctx,issuedBook)],['SPREAD',()=>matchSpread(title,feed,books,ctx,issuedBook)],['PROP',()=>matchProp(title,feed,books,issuedBook)],['TOTAL',()=>matchGameTotal(title,feed,books,ctx,issuedBook)]];for(const [method,fn] of attempts){const r=fn();if(r)return {...r,method}}return {quote:null,reason:'PRICE NOT VERIFIED — TITLE FORMAT NOT RECOGNIZED',method:'NONE'}}
// A price check is an overlay only. The issued recommendation remains immutable.
function compareRec(rec,feed,run){
  const out=deepClone(rec),result=bestQuoteForRec(rec,feed,run),q=result.quote;
  if(!q){
    if(isEventStartedClosed(rec)&&/EVENT NOT FOUND/i.test(String(result.reason||''))){
      out.priceComparison={state:'EVENT STARTED/CLOSED',movement:'EVENT STARTED/CLOSED',reason:'EVENT STARTED/CLOSED',checkedAt:feed.generatedAt,method:result.method};
      return {rec:out,matched:false,reason:'EVENT STARTED/CLOSED',retained:true,movement:'EVENT STARTED/CLOSED'}
    }
    const reason=String(result.reason||'PRICE NOT VERIFIED');
    const state=/^IDENTITY MISMATCH/i.test(reason)?'IDENTITY MISMATCH':/^MARKET UNAVAILABLE/i.test(reason)?'MARKET UNAVAILABLE':'PRICE NOT VERIFIED';
    out.priceComparison={state,movement:state,reason,checkedAt:feed.generatedAt,method:result.method};
    return {rec:out,matched:false,reason:state,retained:true,movement:state}
  }
  const issued=americanFromText(rec.price),current=americanNumber(q.dec);let movement='UNCHANGED';
  const issuedP=americanProb(issued),currentP=americanProb(current);
  if(issuedP!==null&&currentP!==null){if(currentP<issuedP-.0001)movement='IMPROVED';else if(currentP>issuedP+.0001)movement='WORSENED'}
  const feedIdentity=quoteIdentity(q);if(feedIdentity)out.feed={...(out.feed||{}),...feedIdentity};
  out.priceComparison={state:'MATCHED',movement,book:q.book,price:americanText(q.dec),updatedAt:QuoteObservation?.requiresObservation(feed)?q.updatedAt:(q.updatedAt||feed.generatedAt),...(QuoteObservation?.requiresObservation(feed)?{observedAt:q.observedAt,quoteObservationVersion:feed.quoteObservationVersion}:{}),checkedAt:feed.generatedAt,method:result.method};
  return {rec:out,matched:true,reason:'',retained:false,movement}
}
function withoutComparison(run){const out=deepClone(run);if(!out)return out;delete out.comparison;delete out.refreshDelta;out.recs=(out.recs||[]).map(r=>{const x={...r};delete x.priceComparison;return x});return out}
function feedAgeMinutes(feed){const t=Date.parse(feed?.generatedAt);return Number.isFinite(t)?(Date.now()-t)/60000:Infinity}
function restoreOriginal(){if(!originalRun)return;activeRun=withoutComparison(originalRun);originalRun=deepClone(activeRun);statusFilter='ALL';updateRunnerHash(activeRun);apply(activeRun)}

async function refreshAndReprice(statusEl,button){
  if(refreshBusy||!activeRun)return;
  if(!isLatestSessionRun(activeRun)){
    statusEl.textContent='HISTORICAL REPORT — issued snapshot is frozen. Open the newest same-day report to reprice.';
    return
  }
  refreshBusy=true;button.disabled=true;button.textContent='UPDATING…';
  statusEl.textContent='Fetching latest published Bet365/DraftKings snapshot…';
  try{
    const res=await fetch(FEED_URL+'?t='+Date.now(),{cache:'no-store'});
    if(!res.ok)throw new Error('Feed HTTP '+res.status);
    const feed=await res.json();
    if(!feed||!Array.isArray(feed.events)||!feed.generatedAt)throw new Error('Malformed odds feed');
    const age=feedAgeMinutes(feed);
    if(age>75){statusEl.textContent=`FEED STALE — latest snapshot ${vancouverClock(feed.generatedAt)} (${Math.round(age)}m old). Existing verified prices were left untouched.`;return}
    const issued=originalRun||withoutComparison(activeRun);
    const issuedFeedTime=Date.parse(issued&&issued.feedGeneratedAt),newFeedTime=Date.parse(feed.generatedAt);
    if(Number.isFinite(issuedFeedTime)&&Number.isFinite(newFeedTime)&&newFeedTime<=issuedFeedTime){
      statusEl.textContent=`NO NEWER ODDS SNAPSHOT — latest published odds ${vancouverClock(feed.generatedAt)} are not newer than this report. Run or await a new odds pull first.`;
      return
    }
    let matched=0,retained=0,improved=0,worsened=0,unchanged=0;
    const reasons={};
    const recs=(issued.recs||[]).map(r=>{
      const x=compareRec(r,feed,issued);
      if(x.matched){
        matched++;
        if(x.movement==='IMPROVED')improved++;else if(x.movement==='WORSENED')worsened++;else unchanged++;
      }else{
        retained++;
        reasons[x.reason]=(reasons[x.reason]||0)+1;
      }
      return x.rec
    });
    const now=vancouverIso();
    const reasonText=Object.entries(reasons).map(([k,v])=>`${v} ${k}`).join('; ');
    activeRun={...deepClone(issued),
      comparison:{checkedAt:now,feedGeneratedAt:feed.generatedAt,schema:feed.schema||1,matched,retained,reasonText,instrumentTelemetry:buildInstrumentTelemetry(recs,feed)},
      refreshDelta:{matched,retained,improved,worsened,unchanged},
      recs
    };
    updateRunnerHash(activeRun);
    const identityRun=withoutComparison(activeRun);
    originalRun=deepClone(identityRun);
    saveCurrentRun(identityRun);
    apply(activeRun)
  }catch(e){
    statusEl.textContent='UPDATE FAILED — existing verified prices retained. '+String(e?.message||e)
  }finally{
    refreshBusy=false;button.disabled=false;button.textContent='↻ REPRICE NOW'
  }
}

function injectStyle(d){
  const old=d.getElementById('runnerStyle130');if(old)old.remove();
  const prior=d.getElementById('runnerStyle125');if(prior)prior.remove();
  const st=d.createElement('style');st.id='runnerStyle130';
  st.textContent=`
  #runnerLive{margin-top:8px;border:2px solid var(--green);background:#031009;padding:12px}
  .stats{grid-template-columns:repeat(5,minmax(0,1fr))!important}
  .stats .stat:nth-child(3),.stats .stat:nth-child(4){display:none!important}
  .runnerHead{display:grid;grid-template-columns:1fr;gap:8px;align-items:stretch}
  .runnerTitle{font-size:clamp(18px,2.4vw,27px);font-weight:950;letter-spacing:.06em;line-height:1.1;color:var(--cyan);text-shadow:0 0 7px rgba(0,220,255,.16)}
  .runnerFresh{font-size:10px;border:1px solid var(--green);color:var(--green);padding:5px 7px;display:grid;grid-template-columns:1fr;gap:3px;text-align:center;line-height:1.35}
  .feedMeta,.marketStateLabel{display:block}
  .marketStateLabel{order:1;white-space:nowrap}
  .feedMeta{order:2}
  .runnerHeadRight{display:flex;flex-direction:column;align-items:stretch;gap:7px;min-width:0;width:100%;flex:none}
  .instrumentCluster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;width:100%;align-items:stretch}
  .instrument{min-width:0;min-height:134px;height:auto;border:1px solid #456e50;background:repeating-linear-gradient(0deg,rgba(0,255,135,.018) 0,rgba(0,255,135,.018) 1px,transparent 1px,transparent 3px),linear-gradient(180deg,#020d09 0%,#010806 100%);padding:7px 6px 7px;box-sizing:border-box;text-align:center;overflow:hidden;box-shadow:inset 0 0 20px rgba(0,255,135,.075),inset 0 0 0 1px rgba(170,255,205,.025)}
  .instrumentLabel{font-size:10px;font-weight:950;letter-spacing:.07em;color:var(--green);white-space:nowrap;margin-bottom:1px;text-shadow:0 0 6px rgba(0,255,135,.18)}
  .instrument:last-child .instrumentLabel{font-size:9px;letter-spacing:.035em}
  .instrument svg{display:block;width:100%;height:72px;margin:-2px auto -5px;overflow:visible;filter:drop-shadow(0 0 2px rgba(0,255,135,.12))}
  .instrumentRead{display:flex;justify-content:center;align-items:baseline;gap:5px;flex-wrap:wrap;min-height:18px;padding:0 3px;font-size:10px;font-weight:950;line-height:1.1;color:var(--white);white-space:normal;overflow-wrap:anywhere;margin-top:-1px}
  .instrumentRead b{flex:0 0 auto;font-size:17px;color:var(--cyan);margin-right:0;text-shadow:0 0 6px rgba(0,220,255,.16)}
  .instrumentScale{display:flex;justify-content:space-between;font-size:6px;color:#b7bd88;margin:0 4px -3px;letter-spacing:0}
  .instrumentBand{display:grid;gap:2px;margin:5px 1px 0;height:11px;align-items:end}
  .instrumentBand span{height:4px;display:block;border-top:1px solid currentColor;font-size:5px;line-height:11px;white-space:nowrap;overflow:hidden;text-overflow:clip}
  .instrumentBand.heat{grid-template-columns:repeat(7,1fr)}
  .instrumentBand.pressure{grid-template-columns:repeat(3,1fr)}
  .instrumentBand.agreement{grid-template-columns:repeat(4,1fr)}
  .instrumentConf{font-size:6px;color:var(--muted);margin-top:5px;white-space:nowrap}
  .gaugeNeedle{transform-origin:80px 72px;transition:transform .55s cubic-bezier(.22,.8,.25,1)}
  .sessionStrip{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:10px}
  .sessionChip{font:inherit;border:1px solid var(--line);background:#020912;color:var(--cyan);padding:8px 5px;text-align:center;font-weight:900;font-size:11px;cursor:pointer}
  .sessionChip.active{border:2px solid var(--green);color:var(--green);background:#04170b}
  .sessionChip.unavailable{color:var(--muted);opacity:.45;cursor:default}
  .runnerSummary{margin-top:9px;border-left:4px solid var(--cyan);background:#04111d;padding:10px;font-size:12px;line-height:1.45}
  .runnerCoverage{margin-top:10px;padding:10px;border:1px solid var(--cyan);background:#03131b;min-width:0;overflow-wrap:anywhere}
  .runnerCoverageTitle{font-size:12px;color:var(--cyan);font-weight:950;letter-spacing:.07em}
  .runnerCoverageScope,.runnerCoverageNote,.runnerCoverageWarning,.runnerCoverageEmpty{font-size:11px;line-height:1.45;margin-top:6px}
  .runnerCoverageScope,.runnerCoverageNote{color:var(--muted)}
  .runnerCoverageWarning,.runnerCoverageEmpty,.runnerCoverage[data-coverage-state='ERROR'],.runnerCoverage[data-coverage-state='MISSING']{color:var(--yellow)}
  .runnerCoverageGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:8px}
  .runnerCoverageFact{padding:7px;border:1px solid var(--line);text-align:center;min-width:0}
  .runnerCoverageFact b{display:block;font-size:23px;line-height:1.2;color:var(--white)}
  .runnerCoverageFact span{display:block;font-size:9px;line-height:1.4;margin-top:3px}
  .runnerCoverageDetails{font-size:11px;line-height:1.45;margin-top:8px;border-top:1px solid var(--line);padding-top:7px}
  .runnerCoverageDetails summary{cursor:pointer;color:var(--cyan);font-weight:900}
  .runnerCoverageDetails ul{padding-left:20px;margin:7px 0}
  .runnerCoverageDetails li+li{margin-top:6px}
  .runnerCoverageSubhead{font-weight:900;color:var(--muted);margin-top:10px}
  @media(max-width:520px){.runnerCoverageGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.runnerCoverage{padding:8px}}
  .runnerCounts{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:9px}
  .runnerCount{border:1px solid var(--line);padding:9px;background:#020912;text-align:center}
  .runnerCount b{display:block;font-size:clamp(27px,4vw,39px);line-height:1;margin-top:4px}
  .runnerCount .callName{font-size:12px;font-weight:950;letter-spacing:.12em}
  .runnerRefresh{margin-top:9px;border:1px solid var(--cyan);padding:9px;background:#01131a}
  .runnerRefreshActions{display:grid;grid-template-columns:1fr auto;gap:7px}
  .runnerRefreshBtn,.runnerRestoreBtn{font:inherit;font-weight:950;padding:10px;cursor:pointer}
  .runnerRefreshBtn{background:#05222b;color:var(--cyan);border:1px solid var(--cyan)}
  .runnerRestoreBtn{background:#171403;color:var(--yellow);border:1px solid var(--yellow)}
  .runnerRestoreBtn:hover,.runnerRestoreBtn:focus{background:#251f03;color:#fff3a6}
  .runnerRestoreBtn:disabled{opacity:.4;cursor:default}
  .runnerRefreshBtn:disabled{opacity:.55;cursor:default}
  .runnerRefreshStatus{margin-top:7px;font-size:11px;color:var(--muted);line-height:1.4}
  .deltaStrip{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
  .deltaItem{border:1px solid var(--line);padding:7px;background:#020912;text-align:center;font-size:10px}
  .deltaItem b{display:block;font-size:17px;margin-bottom:2px}
  .runnerTools{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
  .filterBtn{font:inherit;font-size:10px;font-weight:900;padding:7px 9px;border:1px solid var(--line);background:#020912;color:var(--muted);cursor:pointer}
  .filterBtn.active{border-color:var(--cyan);color:var(--cyan);background:#03151e}
  .runnerCard{border:2px solid var(--cyan);padding:13px;background:var(--panel);margin-top:10px}
  .runnerTop{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:start}
  .callBadge{display:inline-block;font-size:clamp(25px,4vw,36px);font-weight:1000;line-height:1;letter-spacing:.08em;margin-bottom:8px}
  .runnerBadgeRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
  .runnerBadgeRow .callBadge{margin-bottom:0}
  .priceWatchBadge{display:inline-block;padding:4px 7px;border:1px solid var(--yellow);background:#171403;color:var(--yellow);font-size:10px;font-weight:950;letter-spacing:.08em;line-height:1.2}
  .priceWatchTarget{margin-top:4px;color:var(--yellow);font-weight:900;letter-spacing:.03em}
  .runnerCard h3{font-size:clamp(16px,2.1vw,22px);line-height:1.2;margin:2px 0 5px}
  .runnerMeta{font-size:11px;color:var(--muted)}
  .execution{text-align:right;min-width:120px}
  .execution .book{font-size:11px;color:var(--muted);font-weight:900}
  .bigExec{display:block;font-size:clamp(28px,5vw,43px);line-height:1;font-weight:1000;color:var(--cyan);margin:4px 0}
  .priceState{display:inline-block;margin-top:4px;padding:3px 6px;border:1px solid var(--line);font-size:9px;letter-spacing:.06em;color:var(--muted)}
  .priceState.updated{border-color:var(--green);color:var(--green)}
  .priceState.unresolved{border-color:var(--yellow);color:var(--yellow)}
  .comparisonPanel{margin-top:10px;border:1px solid var(--cyan);background:#01131a;padding:9px}
  .comparisonTitle{font-size:10px;font-weight:950;letter-spacing:.08em;color:var(--cyan);margin-bottom:7px}
  .comparisonGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
  .comparisonFact{border:1px solid var(--line);background:#020912;padding:8px;font-size:10px}
  .comparisonFact b{display:block;margin-top:3px;font-size:14px;color:var(--white)}
  .decisionLine{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr;gap:7px;margin-top:10px}
  .decisionFact{border:1px solid var(--line);background:#020912;padding:9px}
  .decisionFact .value{font-size:14px;font-weight:900;margin-top:3px;line-height:1.25}
  .stakeFact .value{font-size:19px}
  .runnerFacts{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:7px}
  .runnerFact{border:1px solid var(--line);padding:8px;background:#020912;font-size:11px;line-height:1.35}
  .runnerFact b{color:var(--muted);font-size:9px;letter-spacing:.07em}
  .runnerBtn{width:100%;margin-top:8px;font:inherit;font-weight:900;padding:9px;background:#201a03;color:var(--yellow);border:1px solid var(--yellow);cursor:pointer}
  .runnerDetail{display:none;margin-top:8px;border:1px dotted var(--line);padding:10px;background:#01070d;white-space:pre-wrap;line-height:1.5;font-size:12px}
  .runnerDetail.open{display:block}
  #runnerPrior{margin-top:10px;border:1px solid var(--line);padding:10px;background:#020912}
  .runnerPriorHead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
  .runnerPriorList{display:grid;gap:6px;margin-top:8px}
  .runnerPriorItem{border:1px solid var(--line);padding:8px;background:#01070d}
  .runnerPriorItem summary{cursor:pointer;font-weight:900;color:var(--cyan)}
  .runnerPriorMeta{margin-top:5px;font-size:10px;color:var(--muted)}
  .runnerPriorSummary{margin-top:6px;font-size:11px}
  .runnerPriorActions{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:8px}
  .runnerClear{font:inherit;font-size:9px;padding:5px 7px;background:#090d13;color:var(--muted);border:1px solid var(--line);cursor:pointer}
  #runnerMarket{margin-bottom:9px}
  .runnerMarketTable{width:100%;border-collapse:collapse}
  .runnerMarketTable th,.runnerMarketTable td{padding:8px;border-top:1px dotted var(--line);font-size:11px;text-align:left;vertical-align:top}
  .runnerMarketTable th{color:var(--cyan);font-size:9px;letter-spacing:.06em}
  .runnerMarketTable td:first-child{font-weight:1000;font-size:13px}
  .runnerMarketTable td:nth-child(3){font-weight:950;font-size:13px;color:var(--cyan)}
  @media(orientation:portrait){
    .top{padding-top:max(34px,calc(13px + env(safe-area-inset-top)))!important}
  }
  @media(max-width:760px){
    .stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    .runnerCounts{grid-template-columns:repeat(4,1fr)}
    .sessionStrip{grid-template-columns:repeat(5,1fr)}
    .runnerFacts{grid-template-columns:1fr}
    .decisionLine{grid-template-columns:1fr 1fr}
    .comparisonGrid{grid-template-columns:1fr 1fr}
  }
  @media(max-width:520px){
    .stats{grid-template-columns:1fr!important}
    .runnerHead{display:grid}
    .runnerHeadRight{align-items:stretch;min-width:0;width:100%;margin-top:0}
    .instrumentCluster{grid-template-columns:1fr;width:100%;max-width:none;overflow:visible;gap:8px}
    .instrument{min-height:128px;height:auto;padding:7px 7px 6px}
    .instrumentLabel{font-size:10px;letter-spacing:.06em}
    .instrument:last-child .instrumentLabel{font-size:9px}
    .instrument svg{height:72px}
    .instrumentRead{font-size:10px}
    .instrumentRead b{font-size:17px}
    .instrumentBand span{font-size:5px}
    .instrumentConf{font-size:6px}
    .runnerFresh{margin-top:1px;white-space:normal;overflow-wrap:anywhere}
    .runnerTop{grid-template-columns:minmax(0,1fr) auto;gap:10px}
    .runnerTop>div:first-child{min-width:0}
    .execution{text-align:right;min-width:110px}
    .decisionLine{grid-template-columns:1fr 1fr}
    .decisionFact:nth-child(1),.decisionFact:nth-child(2){grid-column:1 / -1}
    .runnerCounts{grid-template-columns:repeat(2,1fr)}
    .sessionStrip{grid-template-columns:repeat(5,1fr);overflow-x:auto}
    .sessionChip{font-size:9px;min-width:58px}
    .runnerRefreshActions{grid-template-columns:1fr}
    .deltaStrip{grid-template-columns:repeat(2,1fr)}
  }`;
  d.head.appendChild(st)
}
function gaugePalette(type){
  if(type==='pressure')return ['#ff334f','#ff6b35','#ffd43b','#a9d92e','#00ff78'];
  if(type==='agreement')return ['#ff334f','#ff6b35','#ffd43b','#a9d92e','#00ff78'];
  return ['#00ff78','#a9d92e','#ffd43b','#ff7a2f','#ff334f']
}
function instrumentGauge(d,title,type,reading){
  const wrap=el(d,'div','instrument'),lab=el(d,'div','instrumentLabel',title);if(reading.reason){wrap.dataset.meterReason=reading.reason;wrap.title=pressureReasonText(reading.reason)}wrap.appendChild(lab);
  const scale=el(d,'div','instrumentScale');['0','25','50','75','100'].forEach(v=>scale.appendChild(el(d,'span','',v)));wrap.appendChild(scale);
  const ns='http://www.w3.org/2000/svg',svg=d.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 160 88');svg.setAttribute('aria-label',`${title} ${Number(reading.confidence)>0?reading.value:'unmeasured'} ${reading.label}`);
  const colors=gaugePalette(type),angles=[-72,-43.2,-14.4,14.4,43.2,72];
  function polar(a,r=58){const rad=(a-90)*Math.PI/180;return [80+r*Math.cos(rad),72+r*Math.sin(rad)]}
  for(let i=0;i<5;i++){
    const [x1,y1]=polar(angles[i]),[x2,y2]=polar(angles[i+1]);
    const path=d.createElementNS(ns,'path');path.setAttribute('d',`M ${x1.toFixed(2)} ${y1.toFixed(2)} A 58 58 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`);path.setAttribute('fill','none');path.setAttribute('stroke',colors[i]);path.setAttribute('stroke-width','7');path.setAttribute('stroke-linecap','butt');svg.appendChild(path)
  }
  for(let i=0;i<=12;i++){
    const a=-72+i*12,[x1,y1]=polar(a,48),[x2,y2]=polar(a,54),tick=d.createElementNS(ns,'line');
    tick.setAttribute('x1',x1);tick.setAttribute('y1',y1);tick.setAttribute('x2',x2);tick.setAttribute('y2',y2);tick.setAttribute('stroke',i%3===0?'#d8d59a':'#718178');tick.setAttribute('stroke-width',i%3===0?'1.4':'.8');svg.appendChild(tick)
  }
  const needle=d.createElementNS(ns,'g');needle.setAttribute('class','gaugeNeedle');needle.style.transform=`rotate(${-72+clamp(reading.value)*1.44}deg)`;if(Number(reading.confidence)<=0)needle.style.opacity='0';
  const line=d.createElementNS(ns,'line');line.setAttribute('x1','80');line.setAttribute('y1','72');line.setAttribute('x2','80');line.setAttribute('y2','27');line.setAttribute('stroke','#f4fff9');line.setAttribute('stroke-width','2.2');
  const hub=d.createElementNS(ns,'circle');hub.setAttribute('cx','80');hub.setAttribute('cy','72');hub.setAttribute('r','4');hub.setAttribute('fill','#f4fff9');needle.append(line,hub);svg.appendChild(needle);wrap.appendChild(svg);
  const displayValue=Number(reading.confidence)>0?`${reading.value}`:'—';const read=el(d,'div','instrumentRead');read.append(el(d,'b','',displayValue),d.createTextNode(reading.label));wrap.appendChild(read);
  const defs=type==='heat'?[['DORM','g'],['QUIET','g'],['FORM','y'],['ACTIVE','y'],['PRESS','y'],['HOT','r'],['EXTREME','r']]:type==='pressure'?[['AGAINST','r'],['NEUTRAL','y'],['FAVOR','g']]:[['FRAG','r'],['MIXED','y'],['STRONG','g'],['CONSENSUS','g']];
  const band=el(d,'div',`instrumentBand ${type}`);defs.forEach(([label,c])=>band.appendChild(el(d,'span',c,label)));wrap.appendChild(band);
  const evidence=reading.evidenceQuality?` • ${reading.evidenceQuality}`:'',excluded=`${reading.conflictingSelections?` • ${reading.conflictingSelections} CONFLICTING SIDES EXCLUDED`:''}${reading.unverifiedReferences?` • ${reading.unverifiedReferences} UNVERIFIED REFERENCES EXCLUDED`:''}`;wrap.appendChild(el(d,'div','instrumentConf',`CONF ${reading.confidence}%${evidence}${reading.pairs?` • ${reading.pairs} PAIRS`:''}${excluded}`));
  return wrap
}
function instrumentCluster(d,run){const r=deriveInstrumentReadings(run),cluster=el(d,'div','instrumentCluster');cluster.append(instrumentGauge(d,'MARKET HEAT','heat',r.heat),instrumentGauge(d,'PRICE PRESSURE','pressure',r.pressure),instrumentGauge(d,'MARKET AGREEMENT','agreement',r.agreement));return cluster}
function marketState(run){
  if(telemetryIntegrityState(run)==='ERROR')return {emoji:'🔴',label:'TELEMETRY INTEGRITY ERROR',agreementState:'ERROR',agreementRender:'ERROR'};
  const r=deriveInstrumentReadings(run);
  const h=r.heat.rawValue??r.heat.value,p=r.pressure.rawValue??r.pressure.value,a=r.agreement.rawValue??r.agreement.value;
  const agreementConfidence=r.agreement.rawConfidence??r.agreement.confidence;
  const heatConfidence=Number(r.heat.confidence)||0,pressureConfidence=Number(r.pressure.confidence)||0;
  const heat=h<VIG_HEAT_LOW_MAX?'LOW':h<VIG_HEAT_HIGH_MIN?'MEDIUM':'HIGH';
  const pressure=p<VIG_PRESSURE_ADVERSE_MAX?'ADVERSE':p<VIG_PRESSURE_FAVORABLE_MIN?'NEUTRAL':'FAVORABLE';
  const agreement=agreementConfidence>0?(a<VIG_AGREEMENT_HIGH_MIN?'LOW':'HIGH'):'LOW';
  if(heatConfidence<=0||pressureConfidence<=0){const label=heatConfidence<=0&&pressureConfidence<=0?'MARKET STATE UNMEASURED':'MARKET STATE PARTIAL';return {emoji:'⚪',label,agreementState:agreementConfidence>0?agreement:'UNMEASURED',agreementRender:agreement}}
  const key=[heat,pressure,agreement].join('|');
  const states={
    'HIGH|FAVORABLE|HIGH':['🟢','COORDINATED FAVORABLE'],
    'HIGH|ADVERSE|HIGH':['🔴','COORDINATED ADVERSE'],
    'HIGH|FAVORABLE|LOW':['🟡','FAVORABLE BUT DISPUTED'],
    'HIGH|ADVERSE|LOW':['🟠','ADVERSE BUT DISPUTED'],
    'HIGH|NEUTRAL|LOW':['🟠','TURBULENT'],
    'HIGH|NEUTRAL|HIGH':['⚪','ACTIVE / BALANCED'],
    'MEDIUM|FAVORABLE|HIGH':['🟢','CONSTRUCTIVE'],
    'MEDIUM|ADVERSE|HIGH':['🔴','DETERIORATING'],
    'MEDIUM|FAVORABLE|LOW':['🟡','FAVORABLE / MIXED'],
    'MEDIUM|ADVERSE|LOW':['🟠','ADVERSE / MIXED'],
    'MEDIUM|NEUTRAL|HIGH':['⚪','ORDERLY'],
    'MEDIUM|NEUTRAL|LOW':['🟠','MIXED'],
    'LOW|FAVORABLE|LOW':['🟡','ISOLATED FAVORABLE'],
    'LOW|FAVORABLE|HIGH':['🟢','QUIET FAVORABLE'],
    'LOW|ADVERSE|HIGH':['🔴','QUIET ADVERSE'],
    'LOW|ADVERSE|LOW':['🟠','FRAGMENTED ADVERSE'],
    'LOW|NEUTRAL|HIGH':['⚪','SETTLED'],
    'LOW|NEUTRAL|LOW':['🔵','FRAGMENTED QUIET']
  };
  const s=states[key]||['⚪','MIXED'];
  return {emoji:s[0],label:s[1],agreementState:agreementConfidence>0?agreement:'UNMEASURED',agreementRender:agreement}
}
function setStats(d,run){
  const vals=[...d.querySelectorAll('.stats .stat b')],c=run.counts||{};
  if(vals[0])vals[0].textContent=money(run.bankroll??455.47);
  if(vals[1])vals[1].textContent=money(run.risk??0);
  if(vals[4])vals[4].textContent=txt(c.bet,0);
  if(vals[5])vals[5].textContent=txt(c.lean,0);
  if(vals[6])vals[6].textContent=txt(c.wait,0)+' / '+txt(c.pass,0)
}
function sessionKey(run){
  const s=String(run?.slot||run?.label||'').toLowerCase();
  if(s.includes('late')||s.includes('18')||s.includes('6:15'))return '18:15';
  if(s.includes('evening')||s.includes('15')||s.includes('3:15'))return '15:15';
  if(s.includes('final')||s.includes('09')||s.includes('9:30'))return '09:30';
  if(s.includes('main')||s.includes('08')||s.includes('8:00'))return '08:00';
  if(s.includes('open')||s.includes('06')||s.includes('6:00'))return '06:00';
  return '';
}
const SESSION_MINUTES={'06:00':360,'08:00':480,'09:30':570,'15:15':915,'18:15':1095};
function vancouverSessionNow(now=new Date()){
  try{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now);
    const value=t=>parts.find(p=>p.type===t)?.value||'';
    return {day:`${value('year')}-${value('month')}-${value('day')}`,minutes:Number(value('hour'))*60+Number(value('minute'))}
  }catch(e){return {day:'',minutes:-1}}
}
function sessionWindowApplicable(key,day,now=new Date()){
  const current=vancouverSessionNow(now),minutes=SESSION_MINUTES[key];
  if(!day||!Number.isFinite(minutes)||!current.day)return false;
  if(day<current.day)return true;
  if(day>current.day)return false;
  return current.minutes>=minutes
}
function sessionRuns(run){
  const day=localDateKey(run?.ts),map=new Map();
  const embedded=Array.isArray(run?.prior_runs)?run.prior_runs:[];
  [run,...catalogRuns(),...embedded,...safeHistory()].forEach(x=>{
    const key=sessionKey(x);
    if(!x||x.__error||!key)return;
    if(day&&localDateKey(x.ts)!==day)return;
    if(day&&!sessionWindowApplicable(key,day))return;
    const k=runKey(x);if(!map.has(k))map.set(k,normalizeRun(x))
  });
  return [...map.values()]
}
function newestSessionRun(run,key){
  return sessionRuns(run)
    .filter(x=>sessionKey(x)===key)
    .sort((a,b)=>(Date.parse(b.ts)||0)-(Date.parse(a.ts)||0))[0]||null
}
function isLatestSessionRun(run){
  const current=withoutComparison(run),day=localDateKey(current&&current.ts);
  const candidates=sessionRuns(current).filter(x=>!day||localDateKey(x&&x.ts)===day);
  candidates.push(current);
  candidates.sort((a,b)=>(Date.parse(b&&b.ts)||0)-(Date.parse(a&&a.ts)||0));
  const latest=candidates[0]||current;
  return String(current&&current.ts||'')===String(latest&&latest.ts||'')&&String(current&&current.slot||'')===String(latest&&latest.slot||'')
}
function selectSession(run,key){
  const selected=newestSessionRun(run,key);if(!selected)return;
  saveCurrentRun(activeRun);
  activeRun=normalizeRun(selected);
  originalRun=deepClone(activeRun);
  statusFilter='ALL';
  updateRunnerHash(activeRun);
  apply(activeRun);
  recoverActiveRunIfNeeded()
}
function sessionStrip(d,run){
  const strip=el(d,'div','sessionStrip');
  const active=sessionKey(run);
  ['06:00','08:00','09:30','15:15','18:15'].forEach(t=>{
    const available=Boolean(newestSessionRun(run,t));
    const q=el(d,'button','sessionChip'+(t===active?' active':'')+(!available?' unavailable':''),t);
    q.type='button';q.disabled=!available;
    q.title=available?`Load latest ${t} run`:`No ${t} run available for this betting day`;
    if(available)q.onclick=()=>selectSession(run,t);
    strip.appendChild(q)
  });
  return strip
}
function filterTools(d,run,container){
  const tools=el(d,'div','runnerTools');
  ['ALL','BET','LEAN','WAIT','PASS'].forEach(k=>{
    const b=el(d,'button','filterBtn'+(statusFilter===k?' active':''),k);
    b.onclick=()=>{statusFilter=k;apply(run)};
    tools.appendChild(b)
  });
  container.appendChild(tools)
}
function priceWatchMeta(r){
  if(String(r?.status||'PASS').toUpperCase()!=='PASS')return null;
  const w=r?.priceWatch;if(!w||w.active===false)return null;
  const target=txt(w.target,'').trim();if(!target)return null;
  return {target,reason:txt(w.reason,'').trim()}
}
function card(d,r){
  const c=el(d,'div','runnerCard');c.style.borderColor=border(r.status);
  const top=el(d,'div','runnerTop'),l=el(d,'div');
  const watch=priceWatchMeta(r),badge=el(d,'div','callBadge '+cls(r.status),txt(r.status,'WAIT'));
  const badges=el(d,'div','runnerBadgeRow');badges.appendChild(badge);
  if(watch)badges.appendChild(el(d,'span','priceWatchBadge','PRICE WATCH'));
  l.append(badges,el(d,'h3','',txt(r.title,'Untitled market')),el(d,'div','runnerMeta',txt(r.meta,'')));
  if(watch)l.appendChild(el(d,'div','runnerMeta priceWatchTarget',`WATCH TARGET: ${watch.target}${watch.reason?` // ${watch.reason}`:''}`));
  const rr=el(d,'div','execution');
  const snapshotTime=displayPriceTime(r.price);
  rr.append(el(d,'div','book',txt(r.book,'PRICE SOURCE')),el(d,'b','bigExec',displayPrice(r.price)));
  const state=isEventStartedClosed(r)?'EVENT STARTED/CLOSED':txt(r.priceState,'ISSUED SNAPSHOT');
  const stateLabel=snapshotTime&&state==='ISSUED SNAPSHOT'?`${state} • ${snapshotTime}`:state;
  rr.appendChild(el(d,'div','priceState '+(state==='UPDATED'?'updated':state==='REFRESH UNRESOLVED'?'unresolved':''),stateLabel));
  top.append(l,rr);c.appendChild(top);

  if(r.priceComparison){
    const pc=r.priceComparison,panel=el(d,'div','comparisonPanel');
    panel.appendChild(el(d,'div','comparisonTitle','CURRENT PRICE COMPARISON // ISSUED REPORT UNCHANGED'));
    const grid=el(d,'div','comparisonGrid'),closed=pc.state==='EVENT STARTED/CLOSED'||pc.state==='CLOSED';
    const values=[
      ['ISSUED',[txt(r.book,'—'),displayPrice(r.price)].join(' ')],
      ['CURRENT',pc.state==='MATCHED'?[txt(pc.book,'—'),txt(pc.price,'—')].join(' '):closed?'EVENT STARTED/CLOSED':txt(pc.state,'PRICE NOT VERIFIED')],
      ['MOVEMENT',txt(pc.movement,'—')],
      [pc.state==='MATCHED'?(pc.quoteObservationVersion?'LAST OBSERVED':'PRICE TIME'):closed?'STATE':'REASON',pc.state==='MATCHED'?vancouverClock(pc.quoteObservationVersion?pc.observedAt:pc.updatedAt):txt(pc.reason,'NOT RETURNED')],
      ...(pc.state==='MATCHED'&&pc.quoteObservationVersion?[['LAST PRICE CHANGE',pc.updatedAt?vancouverClock(pc.updatedAt):'NOT PROVIDED']]:[])
    ];
    values.forEach(([k,v])=>{const f=el(d,'div','comparisonFact',k);f.appendChild(el(d,'b','',v));grid.appendChild(f)});
    panel.appendChild(grid);c.appendChild(panel)
  }

  const decision=el(d,'div','decisionLine');
  const fair=el(d,'div','decisionFact');fair.append(el(d,'div','key','FAIR / EDGE'),el(d,'div','value',[r.fair,r.edge].filter(Boolean).join(' / ')||'—'));
  const move=el(d,'div','decisionFact');move.append(el(d,'div','key','MOVE'),el(d,'div','value',txt(r.move,'—')));
  const stake=el(d,'div','decisionFact stakeFact');stake.append(el(d,'div','key','STAKE'),el(d,'div','value',txt(r.stake,'$0')));
  const fallbackPlayTo=String(r.status||'WAIT').toUpperCase()==='PASS'?'NO BET':(/STALE|UNVERIFIED/i.test(String(r.priceState||''))?'WAIT FOR FRESH PRICE':'NOT SET');
  const playTo=el(d,'div','decisionFact');playTo.append(el(d,'div','key','BET AT / PLAY TO'),el(d,'div','value',txt(r.playTo||r.betAt,fallbackPlayTo)));
  decision.append(fair,move,stake,playTo);c.appendChild(decision);

  const facts=el(d,'div','runnerFacts');
  [['HIST FIT',r.hist],['SUPPORT',r.support],['CONTRARY',r.contrary],['SOURCE',r.source]].forEach(([k,v])=>{
    if(v===undefined||v===null||v==='')return;
    const f=el(d,'div','runnerFact');f.append(el(d,'b','',k),d.createElement('br'),d.createTextNode(txt(v)));facts.appendChild(f)
  });
  if(facts.children.length)c.appendChild(facts);

  if(r.analysis){
    const b=el(d,'button','runnerBtn','▶ VIEW ANALYSIS'),det=el(d,'div','runnerDetail',r.analysis);
    b.onclick=()=>{det.classList.toggle('open');b.textContent=det.classList.contains('open')?'▼ HIDE ANALYSIS':'▶ VIEW ANALYSIS'};
    c.append(b,det)
  }
  return c
}
function priorSection(d,run){
  const arr=mergedPriorRuns(run),sec=el(d,'div');sec.id='runnerPrior';
  const head=el(d,'div','runnerPriorHead'),left=el(d,'div');
  left.append(el(d,'div','sectiontitle','SAME-DAY RUNS // REPORT HISTORY'),el(d,'div','small muted','Earlier runs available for this betting day from the report archive or this browser.'),el(d,'div','runnerPriorMeta','SAME-DAY REPORT HISTORY // ARCHIVE + LOCAL'));
  head.append(left,el(d,'span','tag c',String(arr.length)+' RUNS'));sec.appendChild(head);
  const list=el(d,'div','runnerPriorList');
  if(!arr.length){
    const q=el(d,'div','runnerPriorItem');q.append(el(d,'b','muted','NO EARLIER RUNS AVAILABLE YET'),el(d,'div','runnerPriorMeta','Archived same-day runs appear here when available; this browser may also retain opened runs.'));list.appendChild(q)
  }else{
    arr.forEach(p=>{
      const item=el(d,'details','runnerPriorItem');
      item.appendChild(el(d,'summary','',txt(p.label||p.slot,'PRIOR RUN')));
      const grouped=p.snapshotCount>1?` // ${p.snapshotCount} SNAPSHOTS GROUPED`:'';
      item.append(el(d,'div','runnerPriorMeta',txt(p.ts,'')+grouped),el(d,'div','runnerPriorSummary',txt(p.summary,'No summary supplied.')));
      const c=p.counts||{};
      item.appendChild(el(d,'div','runnerPriorMeta','BET '+txt(c.bet,0)+' // LEAN '+txt(c.lean,0)+' // WAIT '+txt(c.wait,0)+' // PASS '+txt(c.pass,0)));
      list.appendChild(item)
    })
  }
  sec.appendChild(list);
  const actions=el(d,'div','runnerPriorActions');actions.appendChild(el(d,'div','small muted','Same-day history can come from the archive or this browser.'));
  const clear=el(d,'button','runnerClear','CLEAR LOCAL HISTORY');
  clear.onclick=()=>{if(confirm('Clear VigScope saved runner history on this device?')){[HISTORY_KEY,...LEGACY_HISTORY_KEYS].forEach(k=>localStorage.removeItem(k));apply(run)}};
  actions.appendChild(clear);sec.appendChild(actions);return sec
}
function hideStaticBoard(board){[...board.children].forEach(x=>{if(x.id!=='runnerLive'&&x.id!=='runnerPrior')x.style.display='none'})}
function hideStaticMarket(market){[...market.children].forEach(x=>{if(x.id!=='runnerMarket')x.style.display='none'})}

function apply(run){
  const frame=$('#app'),d=frame.contentDocument;if(!d)return;
  injectStyle(d);
  const archive=d.getElementById('runArchive');if(archive)archive.style.display='none';
  const terminalTitle=d.querySelector('.top .title');if(terminalTitle)terminalTitle.textContent='VIGSCOPE TERMINAL UI v1.3';
  const build=d.querySelector('.top .small.muted');if(build)build.textContent='CHATGPT LIVE-RUNNER // v1.3 UI';
  [...d.querySelectorAll('.sectiontitle')].forEach(x=>{if(/^SOURCE GOVERNANCE\s*\/\//i.test(x.textContent))x.textContent='SOURCE GOVERNANCE // v1.3'});
  const footer=d.querySelector('.foot');if(footer)footer.textContent=footer.textContent.replace(/v1\.2/g,'v1.3');
  const qa=d.querySelector('.qa');if(qa)qa.style.display='none';
  if(!run){
    const board=d.getElementById('board');
    if(board){
      hideStaticBoard(board);
      let empty=d.getElementById('runnerEmpty');
      if(!empty){
        empty=el(d,'div','runnerSummary','NO RUN LOADED // Open a VigScope report link to load the current selections and controls.');
        empty.id='runnerEmpty';board.prepend(empty)
      }
    }
    const market=d.getElementById('market');if(market)hideStaticMarket(market);
    return
  }
  const empty=d.getElementById('runnerEmpty');if(empty)empty.remove();
  if(run.__error){const e=$('#err');e.textContent='VigScope runner payload error: '+run.__error;e.style.display='block';return}
  setStats(d,run);

  const board=d.getElementById('board');
  if(board){
    ['runnerLive','runnerPrior','runnerBaseLabel'].forEach(id=>{const x=d.getElementById(id);if(x)x.remove()});
    hideStaticBoard(board);
    const box=el(d,'div');box.id='runnerLive';

    const head=el(d,'div','runnerHead'),left=el(d,'div'),right=el(d,'div','runnerHeadRight');
    left.append(el(d,'div','runnerTitle',txt(run.label||run.slot,'CURRENT RUN')),el(d,'div','small muted',txt(run.ts,'')));
    const issuedMeterRun=run.comparison?(originalRun||withoutComparison(run)):run,state=marketState(issuedMeterRun);
    const priceStateText=run.comparison?`COMPARED ${vancouverClock(run.comparison.feedGeneratedAt)} • ISSUED SNAPSHOT SAVED`:run.feedGeneratedAt?`ODDS ${vancouverClock(run.feedGeneratedAt)} • ${ageLabel(run.feedGeneratedAt)}`:'SNAPSHOT PRICE STATE';
    const fresh=el(d,'div','runnerFresh');
    fresh.append(el(d,'span','feedMeta',priceStateText),el(d,'span','marketStateLabel',`${state.emoji} ${state.label}${state.agreementState==='UNMEASURED'?' • AGREEMENT UNMEASURED':''}`));
    const baselineText=meterBaselineText(issuedMeterRun);
    if(baselineText){const baseline=el(d,'span','feedMeta meterBaseline',baselineText);baseline.style.cssText='flex-basis:100%;white-space:normal;font-size:10px;line-height:1.3';fresh.append(baseline);}
    right.append(instrumentCluster(d,issuedMeterRun),fresh);head.append(left,right);box.appendChild(head);
    const coverage=coveragePanel(d,issuedMeterRun);if(coverage)box.appendChild(coverage);
    box.appendChild(sessionStrip(d,run));

    const counts=el(d,'div','runnerCounts'),cc=run.counts||{};
    [['BET',cc.bet],['LEAN',cc.lean],['WAIT',cc.wait],['PASS',cc.pass]].forEach(([k,v])=>{
      const q=el(d,'div','runnerCount');q.append(el(d,'div','callName '+cls(k),k),el(d,'b',cls(k),txt(v,0)));counts.appendChild(q)
    });
    box.appendChild(counts);

    const summary=el(d,'div','runnerSummary',txt(run.summary,'No summary supplied.'));box.appendChild(summary);

    const refresh=el(d,'div','runnerRefresh'),latestReport=isLatestSessionRun(run);
    let refreshStatus=null,refreshBtn=null;
    if(latestReport){
      const actions=el(d,'div','runnerRefreshActions');
      refreshBtn=el(d,'button','runnerRefreshBtn','↻ REPRICE NOW');
      actions.append(refreshBtn);
      const feedLabel=run.comparison?`Current prices checked ${vancouverClock(run.comparison.feedGeneratedAt)}. The issued report, grades, fair values, stakes, reasoning, and report meters are unchanged.`:'Checks the latest published Bet365/DraftKings snapshot as a comparison. This does not run an odds pull; the issued report remains unchanged.';
      refreshStatus=el(d,'div','runnerRefreshStatus',feedLabel);
      refreshBtn.onclick=()=>refreshAndReprice(refreshStatus,refreshBtn);
      refresh.append(actions,refreshStatus)
    }else{
      refreshStatus=el(d,'div','runnerRefreshStatus','HISTORICAL REPORT // ISSUED SNAPSHOT FROZEN // Reprice is available only on the newest same-day report.');
      refresh.appendChild(refreshStatus)
    }

    if(run.refreshDelta){
      const delta=el(d,'div','deltaStrip');
      [['MATCHED',run.refreshDelta.matched,'g'],['IMPROVED',run.refreshDelta.improved,'g'],['WORSENED',run.refreshDelta.worsened,'y'],['UNRESOLVED',run.refreshDelta.retained,'y']].forEach(([k,v,c])=>{
        const q=el(d,'div','deltaItem');q.append(el(d,'b',c,txt(v,0)),d.createTextNode(k));delta.appendChild(q)
      });
      refresh.appendChild(delta)
    }
    box.appendChild(refresh);
    filterTools(d,run,box);

    const recs=(Array.isArray(run.recs)?run.recs:[]).filter(r=>statusFilter==='ALL'||String(r.status||'WAIT').toUpperCase()===statusFilter);
    recs.forEach(r=>box.appendChild(card(d,r)));
    if(!recs.length)box.appendChild(el(d,'div','runnerSummary runnerNoCards',noPublishedCardsText(run)));

    board.prepend(box);box.after(priorSection(d,run))
  }

  const market=d.getElementById('market');
  if(market){
    const old=d.getElementById('runnerMarket');if(old)old.remove();
    hideStaticMarket(market);
    const m=el(d,'div','box');m.id='runnerMarket';
    m.append(el(d,'div','sectiontitle','CURRENT RUN // MARKET SNAPSHOT'),el(d,'div','small muted',[txt(run.label||run.slot,''),txt(run.ts,'')].filter(Boolean).join(' // ')));
    const wrap=el(d,'div','scroll'),table=el(d,'table','runnerMarketTable'),thead=el(d,'thead'),trh=el(d,'tr');
    ['CALL','MARKET','BOOK / PRICE','BET AT / PLAY TO','STATE','FAIR / EDGE','MOVE'].forEach(x=>trh.appendChild(el(d,'th','',x)));thead.appendChild(trh);
    const tb=el(d,'tbody');
    (Array.isArray(run.recs)?run.recs:[]).forEach(r=>{
      const tr=el(d,'tr');
      const playTo=txt(r.playTo||r.betAt,String(r.status||'WAIT').toUpperCase()==='PASS'?'NO BET':'NOT SET');
      [txt(r.status),txt(r.title),[r.book,displayPrice(r.price)].filter(Boolean).join(' // '),playTo,txt(r.priceState,'LAST VERIFIED'),[r.fair,r.edge].filter(Boolean).join(' // '),txt(r.move)].forEach(v=>tr.appendChild(el(d,'td','',v)));
      tb.appendChild(tr)
    });
    table.append(thead,tb);wrap.appendChild(table);m.appendChild(wrap);market.prepend(m)
  }
}

activeRun=payload();
if(activeRun&&!activeRun.__error){
  rememberIssuedRun(activeRun);
  (Array.isArray(activeRun.prior_runs)?activeRun.prior_runs:[]).forEach(x=>rememberIssuedRun(x));
  originalRun=normalizeRun(activeRun);
  (Array.isArray(activeRun.prior_runs)?activeRun.prior_runs:[]).forEach(saveCurrentRun);
  saveCurrentRun(originalRun);
  recoverActiveRunIfNeeded()
}
$('#app').addEventListener('load',()=>{try{apply(activeRun)}catch(e){const x=$('#err');x.textContent='VigScope runner error: '+e.message;x.style.display='block';console.error(e)}});
})();
