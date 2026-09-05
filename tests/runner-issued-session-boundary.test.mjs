import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimePath='assets/runner-core-runtime.js';
const runtimeSource=fs.readFileSync(runtimePath,'utf8');
const exportMarker='\nactiveRun=payload();';
assert.ok(runtimeSource.includes(exportMarker),'runtime export injection marker must exist');
const instrumented=runtimeSource.replace(exportMarker,`\nglobalThis.__runnerBoundary={normalizeRun,withoutComparison,safeHistory,saveCurrentRun,sessionRuns,newestSessionRun,rememberIssuedRun,catalogRuns,telemetryIntegrityState,deriveInstrumentReadings,marketState,sessionKey,recoverCanonicalIssuedRun};${exportMarker}`);
const assertJsonEqual=(actual,expected,message)=>assert.equal(JSON.stringify(actual),JSON.stringify(expected),message);

const store=new Map();
const app={addEventListener(){}};
const RealDate=Date;
class FakeDate extends RealDate{
  constructor(...args){super(...(args.length?args:['2026-09-02T20:30:00-07:00']))}
  static now(){return RealDate.parse('2026-09-02T20:30:00-07:00')}
}
const finalMorningPath='data/history/runs/2026-09-02/final_morning-093430.json';
const mainPath='data/history/runs/2026-09-02/main-080700.json';
const openPath='data/history/runs/2026-09-02/open-060215.json';
const finalMorning=JSON.parse(fs.readFileSync(finalMorningPath,'utf8'));
const main0800=JSON.parse(fs.readFileSync(mainPath,'utf8'));
const open0600=JSON.parse(fs.readFileSync(openPath,'utf8'));
const firstSameDayPath='data/history/runs/2026-09-05/final_morning-093653.json';
const firstSameDay=JSON.parse(fs.readFileSync(firstSameDayPath,'utf8'));
const fetchStub=async url=>{
  const u=String(url);
  if(u.startsWith('./run-history.json'))return {ok:true,json:async()=>({runs:[{ts:finalMorning.ts,slot:finalMorning.slot,path:finalMorningPath},{ts:firstSameDay.ts,slot:firstSameDay.slot,path:firstSameDayPath}]})};
  if(u.startsWith(`./${finalMorningPath}`))return {ok:true,json:async()=>JSON.parse(JSON.stringify(finalMorning))};
  if(u.startsWith(`./${firstSameDayPath}`))return {ok:true,json:async()=>JSON.parse(JSON.stringify(firstSameDay))};
  return {ok:false,json:async()=>({})};
};
const context={
  console,
  localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
  location:{hash:'',pathname:'/runner.html',search:''},
  history:{replaceState(){}},
  document:{querySelector:s=>s==='#app'?app:null},
  confirm:()=>true,
  Intl,URLSearchParams,TextDecoder,TextEncoder,Uint8Array,
  atob:s=>Buffer.from(s,'base64').toString('binary'),
  btoa:s=>Buffer.from(s,'binary').toString('base64'),
  Date:FakeDate,
  fetch:fetchStub,
  setTimeout,clearTimeout
};
vm.runInNewContext(instrumented,context,{filename:runtimePath});
const api=context.__runnerBoundary;
assert.ok(api,'runner boundary exports must be available to the regression');

assert.equal(finalMorning.instrumentTelemetry?.heat?.value,17);
assert.equal(finalMorning.instrumentTelemetry?.pressure?.value,52);
assert.equal(finalMorning.instrumentTelemetry?.agreement?.score,91);

const futureField={schema:1,name:'future-issued-field',nested:{kept:true}};
const futureRun={...JSON.parse(JSON.stringify(finalMorning)),futureIssuedField:futureField};
const normalized=api.normalizeRun(futureRun);
assertJsonEqual(normalized.instrumentTelemetry,finalMorning.instrumentTelemetry,'normalization must preserve issued telemetry exactly');
assertJsonEqual(normalized.futureIssuedField,futureField,'normalization must preserve unknown future issued fields');
assert.equal('prior_runs' in normalized,false,'navigation envelope must not be duplicated into individual cached runs');

const repriced={...JSON.parse(JSON.stringify(futureRun)),comparison:{instrumentTelemetry:{authority:'REPRICE_COMPARISON_ONLY',agreement:{score:1}}},refreshDelta:{matched:1},recs:futureRun.recs.map((r,i)=>i?{...r}:{...r,priceComparison:{state:'MATCHED'}})};
const stripped=api.withoutComparison(repriced);
assert.equal(stripped.comparison,undefined,'comparison overlay must be stripped');
assert.equal(stripped.refreshDelta,undefined,'refresh delta must be stripped');
assert.equal(stripped.recs[0].priceComparison,undefined,'recommendation price comparison must be stripped');
assertJsonEqual(stripped.instrumentTelemetry,finalMorning.instrumentTelemetry,'issued telemetry must never be stripped with comparison data');
assertJsonEqual(stripped.futureIssuedField,futureField,'unknown issued fields must survive overlay stripping');
assert.doesNotMatch(runtimeSource,/^\s*instrumentTelemetry:buildInstrumentTelemetry\(recs,feed\),\s*$/m,'REPRICE must not overwrite root issued telemetry');
assert.match(runtimeSource,/comparison:\{[^\n]*instrumentTelemetry:buildInstrumentTelemetry\(recs,feed\)/,'comparison telemetry may live only inside the transient comparison overlay');

const contaminated=JSON.parse(JSON.stringify(finalMorning));
delete contaminated.instrumentTelemetry;
store.set('bettingEdge.runnerHistory.v1.3',JSON.stringify([contaminated]));
assert.equal(api.safeHistory().length,0,'v1.3 contaminated browser cache must not be read after the schema bump');

api.rememberIssuedRun(finalMorning);
api.rememberIssuedRun(main0800);
api.rememberIssuedRun(open0600);
api.saveCurrentRun(finalMorning);
const selected0800=api.newestSessionRun(finalMorning,'08:00');
assert.equal(selected0800.ts,main0800.ts);
api.saveCurrentRun(selected0800);
const selected0600=api.newestSessionRun(selected0800,'06:00');
assert.equal(selected0600.ts,open0600.ts);
api.saveCurrentRun(selected0600);
const returned0930=api.newestSessionRun(selected0600,'09:30');
assert.equal(returned0930.ts,finalMorning.ts);
assert.equal(returned0930.instrumentTelemetry?.heat?.value,17);
assert.equal(returned0930.instrumentTelemetry?.pressure?.value,52);
assert.equal(returned0930.instrumentTelemetry?.agreement?.score,91);
assertJsonEqual(returned0930.instrumentTelemetry,finalMorning.instrumentTelemetry,'09:30 -> 08:00 -> 06:00 -> 09:30 must restore the exact issued receipt');

store.set('bettingEdge.runnerHistory.v1.4',JSON.stringify([contaminated]));
const catalogWins=api.newestSessionRun(selected0600,'09:30');
assertJsonEqual(catalogWins.instrumentTelemetry,finalMorning.instrumentTelemetry,'canonical in-memory issued run must outrank a damaged local duplicate');

const synthetic=(slot,label,ts,heat,pressure,agreement)=>{
  const run=api.normalizeRun({...futureRun,slot,label,ts});
  run.instrumentTelemetry={...JSON.parse(JSON.stringify(finalMorning.instrumentTelemetry)),derivedAt:ts,heat:{...finalMorning.instrumentTelemetry.heat,value:heat,rawValue:heat},pressure:{...finalMorning.instrumentTelemetry.pressure,value:pressure,rawValue:pressure},agreement:{...finalMorning.instrumentTelemetry.agreement,score:agreement,rawScore:agreement}};
  run.futureIssuedField={slot,kept:true};
  return run
};
const run1515=synthetic('evening','15:15 EVENING','2026-09-02T15:15:00.000-07:00',44,61,82);
const run1815=synthetic('late','18:15 LATE / WEST COAST','2026-09-02T18:15:00.000-07:00',57,48,76);
api.rememberIssuedRun(run1515);
api.rememberIssuedRun(run1815);
const picked1515=api.newestSessionRun(run1815,'15:15');
assert.equal(picked1515.instrumentTelemetry.heat.value,44,'15:15 must use the same issued-session preservation rule');
assertJsonEqual(picked1515.futureIssuedField,{slot:'evening',kept:true},'15:15 unknown issued fields must survive');
const returned1815=api.newestSessionRun(picked1515,'18:15');
assert.equal(returned1815.instrumentTelemetry.heat.value,57,'18:15 must use the same issued-session preservation rule');
assertJsonEqual(returned1815.futureIssuedField,{slot:'late',kept:true},'18:15 unknown issued fields must survive');

assert.equal(api.telemetryIntegrityState(main0800),'LEGACY','08:00 remains exempt before the cutover');
assert.equal(api.telemetryIntegrityState(finalMorning),'VALID','09:30 publisher-bound receipt must validate');
assert.equal(api.telemetryIntegrityState(run1515),'VALID','15:15 publisher-bound receipt must validate generically');
assert.equal(api.telemetryIntegrityState(run1815),'VALID','18:15 publisher-bound receipt must validate generically');
assert.equal(api.telemetryIntegrityState(contaminated),'ERROR','post-cutover missing telemetry must fail closed');
const failedReadings=api.deriveInstrumentReadings(contaminated);
assert.equal(failedReadings.heat.confidence,0);
assert.equal(failedReadings.heat.label,'INTEGRITY ERROR');
assert.equal(api.marketState(contaminated).label,'TELEMETRY INTEGRITY ERROR');

const recovered=await api.recoverCanonicalIssuedRun(contaminated);
assert.ok(recovered,'damaged post-cutover URL/session payload should recover from the canonical archive when available');
assertJsonEqual(recovered.instrumentTelemetry,finalMorning.instrumentTelemetry,'archive recovery must restore the exact publisher-bound receipt');

// The real Sep 5 report passed the publisher gate with no earlier same-day
// report. The browser must accept that receipt while displaying no readings.
assert.equal(firstSameDay.instrumentTelemetry.source.reason,'NO_PRIOR_SAME_DAY_RUN');
assert.equal(api.telemetryIntegrityState(firstSameDay),'VALID','first same-day unmeasured receipt is valid');
const firstReadings=api.deriveInstrumentReadings(firstSameDay);
assert.equal(firstReadings.heat.label,'NO DATA');
assert.equal(firstReadings.pressure.label,'NO DATA');
assert.equal(firstReadings.agreement.label,'UNMEASURED');
for(const reading of Object.values(firstReadings))assert.equal(reading.confidence,0,'no measurement may be invented');
assert.equal(api.marketState(firstSameDay).label,'MARKET STATE UNMEASURED');
for(const mutate of [
  t=>{t.source.reason='PINNED_FEED_UNAVAILABLE_OR_MISMATCHED'},
  t=>{t.source.priorRunTs=finalMorning.ts},
  t=>{t.source.priorRunPath=finalMorningPath},
  t=>{t.source.feedBlobSha='invalid'},
  t=>{t.source.feedGeneratedAt=finalMorning.feedGeneratedAt},
  t=>{t.derivedAt=finalMorning.ts},
  t=>{t.heat.rawValue=40},
  t=>{t.pressure.rawValue=99},
  t=>{t.agreement.confidence=80},
  t=>{t.movement.comparableSelections=1},
  t=>{delete t.movement}
]){
  const damaged=JSON.parse(JSON.stringify(firstSameDay));mutate(damaged.instrumentTelemetry);
  assert.equal(api.telemetryIntegrityState(damaged),'ERROR','unsupported or damaged unmeasured receipts remain blocked');
}
const damagedFirst=JSON.parse(JSON.stringify(firstSameDay));delete damagedFirst.instrumentTelemetry;
const recoveredFirst=await api.recoverCanonicalIssuedRun(damagedFirst);
assert.ok(recoveredFirst,'archive recovery must also accept the valid first same-day receipt');
assertJsonEqual(recoveredFirst.instrumentTelemetry,firstSameDay.instrumentTelemetry);

// Presentation must not convert the visible no-reading dash into numeric zero
// and select adverse-market artwork. A measured zero still remains a number.
const dashboardSource=fs.readFileSync('assets/report-dashboard-vigscope.js.old','utf8');
const presentationSource=dashboardSource.slice(dashboardSource.indexOf('  function numberFromInstrument('),dashboardSource.indexOf('  function updateContributorMeters('));
const presentation={};vm.runInNewContext(presentationSource,presentation);
const cluster=(values,textContent='')=>({textContent,querySelectorAll:()=>values.map(value=>({querySelector:()=>({textContent:value})}))});
assert.equal(presentation.stateFromCluster(cluster(['—','—','—'])).file,null,'unmeasured inputs must not choose market artwork');
assert.equal(presentation.stateFromCluster(cluster(['—','—','—'])).key,'MARKET STATE UNMEASURED');
assert.equal(presentation.stateFromCluster(cluster(['—','—','—'],'INTEGRITY ERROR')).key,'TELEMETRY INTEGRITY ERROR');
assert.equal(presentation.stateFromCluster(cluster(['17','—','91'])).key,'MARKET STATE PARTIAL');
assert.equal(presentation.stateFromCluster(cluster(['0','50','91'])).file,'vig-low-neutral-high.jpg','measured zero must not become missing data');
assert.equal(presentation.stateFromCluster(cluster(['17','52','91'])).file,'vig-low-neutral-high.jpg','existing measured presentation must remain available');

console.log(JSON.stringify({state:'PASS',sequence:'09:30 -> 08:00 -> 06:00 -> 09:30',meters:{heat:returned0930.instrumentTelemetry.heat.value,pressure:returned0930.instrumentTelemetry.pressure.value,agreement:returned0930.instrumentTelemetry.agreement.score},futureSlots:['15:15','18:15'],cache:'v1.4',archiveRecovery:'PASS'},null,2));
