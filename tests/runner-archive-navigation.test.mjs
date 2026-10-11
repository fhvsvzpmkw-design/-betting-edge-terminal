import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const runtime=fs.readFileSync('assets/runner-core-runtime.js','utf8');
const exports='loadSessionIndex,loadIndexedSession,sessionChoice,sessionStrip,selectSession,mergedPriorRuns,isLatestSessionRun,catalogRuns,fetchPriorChangeRun,setRenderer:fn=>{apply=fn}';
const source=runtime.replace('\nactiveRun=payload();',`\nglobalThis.api={${exports}};\nactiveRun=payload();`);
const clock=Date.parse('2026-10-11T10:58:00-07:00');
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[clock]))}static now(){return clock}}
const element=()=>({children:[],style:{},appendChild(child){this.children.push(child)},addEventListener(){}});
function boot(current,index,respond=async path=>read(path)){
  const reads=[],listeners=new Map(),renders=[],frame=element(),error=element();
  frame.addEventListener=(event,fn)=>listeners.set(event,fn);
  const context={
    console:{warn(){}},location:{hash:'#runRef=current',pathname:'/runner.html',search:''},
    document:{querySelector:selector=>selector==='#app'?frame:error,createElement:element},
    frameElement:{__vigscopeReport:{ref:'current',run:current}},
    // Reproduce mobile storage quota exhaustion: navigation must use the archive.
    localStorage:{getItem:()=>null,setItem(){throw new Error('Quota exceeded')}},
    URLSearchParams,TextEncoder,TextDecoder,Intl,Date:FixedDate,Uint8Array,
    atob:value=>Buffer.from(value,'base64').toString('binary'),btoa:value=>Buffer.from(value,'binary').toString('base64'),
    fetch:async url=>{
      const path=String(url).split('?')[0].replace(/^\.\//,'');reads.push(path);
      return {ok:true,json:async()=>path==='run-history.json'?index:respond(path)};
    }
  };
  context.window=context;vm.runInNewContext(source,context);
  context.api.setRenderer(run=>renders.push(run));
  return {...context,reads,listeners,renders,error};
}

const index=read('run-history.json');
const fixturePaths=['open-062700','main-090000','final_morning-095700'].map(name=>`data/history/runs/2026-10-11/${name}.json`);
const today=index.runs.filter(entry=>fixturePaths.includes(entry.path));
assert.equal(today.length,3,'fixture includes the three issued morning reports');
const entryFor=slot=>today.find(entry=>entry.slot===slot);
const current=read(entryFor('final_morning').path);
const invalidEntries=[
  {...entryFor('main'),ts:'2026-10-10T08:00:00-07:00'},
  {...entryFor('main'),ts:'2026-10-11T15:15:00-07:00',slot:'evening'},
  {...entryFor('open'),ts:'2026-10-11T06:28:00-07:00',path:'../../untrusted.json'}
];
const app=boot(current,{runs:[...today,...invalidEntries]});
assert.equal(app.reads.length,0,'current report handoff starts without any archive fetch');
app.listeners.get('load')();
assert.equal(app.renders.length,1,'current report renders before history completes');
assert.equal(app.renders[0].ts,current.ts);
await app.api.loadSessionIndex(current);await Promise.resolve();
assert.deepEqual(app.reads,['run-history.json'],'availability reads only the small index, not multi-MB reports');
assert.equal(app.api.catalogRuns().length,1,'index metadata must never become an issued report');
const strip=app.api.sessionStrip(app.document,current);
assert.deepEqual(strip.children.map(button=>button.disabled),[false,false,false,true,true],'published morning sessions enable on a fresh device; future slots stay disabled');
assert.equal(app.api.mergedPriorRuns(current).length,2,'same-day report history shows both archived earlier reports');

for(const slot of ['main','open','final_morning']){
  const key={main:'08:00',open:'06:00',final_morning:'09:30'}[slot];
  await app.api.selectSession(app.BettingEdgeRunnerPayload(),key);
  const selected=app.BettingEdgeRunnerPayload(),issued=slot==='final_morning'?current:read(entryFor(slot).path);
  assert.equal(selected.ts,issued.ts);
  assert.equal(JSON.stringify(selected.recs),JSON.stringify(issued.recs),'all cards and issued evidence survive switching');
  assert.equal(JSON.stringify(selected.instrumentTelemetry),JSON.stringify(issued.instrumentTelemetry),'meters stay bound to the selected issued report');
  assert.equal(selected.comparison,undefined);
  assert.equal(app.api.isLatestSessionRun(selected),slot==='final_morning','earlier sessions cannot be repriced even before later reports are loaded');
}
assert.deepEqual(app.reads,['run-history.json',entryFor('main').path,entryFor('open').path],'switching back reuses the preserved current report');
const prior=await app.api.fetchPriorChangeRun(current);
assert.equal(prior.ts,entryFor('main').ts);
assert.equal(app.reads.length,3,'comparison reuses the same full report rather than fetching it twice');

// Small legacy reports isolate network failures and click races from the
// independent publisher-telemetry recovery, covered with real reports above.
const small=entry=>({ts:entry.ts,slot:entry.slot,label:entry.label,feedGeneratedAt:entry.feedGeneratedAt,recs:[{title:entry.slot,status:'PASS'}]});
const smallEntries=today.map(entry=>({...entry,ts:entry.ts.replace('2026-10-11','2026-08-11'),path:entry.path.replace('2026-10-11','2026-08-11'),recCount:1}));
const smallEntryFor=slot=>smallEntries.find(entry=>entry.slot===slot);
const latest=small(smallEntries.find(entry=>entry.slot==='final_morning'));
let attempts=0;
const retry=boot(latest,{runs:smallEntries},async path=>{
  const entry=smallEntries.find(entry=>entry.path===path);
  attempts++;return {...small(entry),slot:attempts===1?'wrong':entry.slot};
});
await retry.api.loadSessionIndex(latest);
await retry.api.selectSession(latest,'06:00');
assert.equal(retry.BettingEdgeRunnerPayload().ts,latest.ts,'identity failure leaves the active report intact');
assert.equal(retry.error.style.display,'block','load failure is visible and retryable');
await retry.api.selectSession(latest,'06:00');
assert.equal(retry.BettingEdgeRunnerPayload().slot,'open','failed fetch is evicted so a retry can succeed');
assert.equal(retry.error.style.display,'none');

const resolves=new Map();
const race=boot(latest,{runs:smallEntries},path=>new Promise(resolve=>resolves.set(path,resolve)));
await race.api.loadSessionIndex(latest);
const first=race.api.selectSession(latest,'06:00');await new Promise(setImmediate);
const second=race.api.selectSession(latest,'08:00');await new Promise(setImmediate);
resolves.get(smallEntryFor('main').path)(small(smallEntryFor('main')));await second;
resolves.get(smallEntryFor('open').path)(small(smallEntryFor('open')));await first;
assert.equal(race.BettingEdgeRunnerPayload().slot,'main','a slower previous click cannot overwrite the latest selection');
console.log('Archive navigation: PASS // fresh device, index-only availability, 08:00 → 06:00 → 09:30, exact cards/meters, quota exhaustion, retry and overlapping clicks');
