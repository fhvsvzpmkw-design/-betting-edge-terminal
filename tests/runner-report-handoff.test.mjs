import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const index=read('run-history.json');
const current=read('data/history/runs/2026-09-08/evening-152410.json');
const id='260908e152410';
const clock=Date.parse('2026-09-08T15:40:00-07:00');
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[clock]))}static now(){return clock}}
const timers=[],listeners=new Map(),classes=new Set();
const element=()=>({textContent:'',style:{},setAttribute(){},classList:{add:name=>classes.add(name)},remove(){this.removed=true},addEventListener(name,fn){listeners.set(name,fn)}});
const frame=element(),splash=element(),msg=element();
let resolveNavigation;
const navigation=new Promise(resolve=>{resolveNavigation=resolve});
Object.defineProperty(frame,'src',{get(){return this.url},set(value){this.url=value;resolveNavigation(value)}});
const context={
  window:{addEventListener(){}},document:{getElementById:id=>({app:frame,splash,msg})[id]||element()},
  location:{search:'?id='+id},URLSearchParams,TextEncoder,Intl,Date:FixedDate,console,
  setTimeout:fn=>{timers.push(fn)},
  fetch:async url=>({ok:true,json:async()=>read(String(url).split('?')[0].replace(/^\.\//,''))})
};
const outer=fs.readFileSync('r.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInNewContext(outer,context);
const url=await navigation;
assert.ok(url.length<120,'full report data must never be serialized into iframe navigation');
assert.ok(url.endsWith('#runRef='+id));
assert.equal(frame.__vigscopeReport.ref,id);
const hydrated=frame.__vigscopeReport.run;
assert.deepEqual(hydrated.recs,current.recs,'all 67 issued cards survive the handoff');
assert.equal(JSON.stringify(hydrated.counts),JSON.stringify({bet:0,lean:1,wait:0,pass:66}));
assert.equal(JSON.stringify(hydrated.prior_runs.map(r=>r.slot).sort()),JSON.stringify(['final_morning','main','open']));
for(const prior of hydrated.prior_runs){
  const entry=index.runs.find(r=>r.ts===prior.ts&&r.slot===prior.slot);
  assert.deepEqual(prior,read(entry.path),'prior sessions retain their full issued data');
}
const previousUrlBytes=Buffer.from(JSON.stringify(hydrated)).toString('base64url').length;
assert.ok(previousUrlBytes>2*1024*1024,'fixture must reproduce the oversized September 8 handoff');
listeners.get('load')();
while(timers.length)timers.shift()();
assert.ok(classes.has('ready')&&classes.has('fade')&&splash.removed,'loaded report advances beyond splash');

const runtime=fs.readFileSync('assets/runner-core-runtime.js','utf8');
const instrumented=runtime.replace('\nactiveRun=payload();','\nglobalThis.api={payload,updateRunnerHash,catalogRuns,setActive:run=>{activeRun=run}};\nactiveRun=payload();');
function boot(hash,host=frame){
  const storage=new Map(),historyUrls=[];
  const c={console,location:{hash,pathname:'/runner.html',search:''},
    document:{querySelector:()=>({addEventListener(){}})},frameElement:host,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    history:{replaceState:(_state,_title,url)=>historyUrls.push(url)},
    URLSearchParams,TextEncoder,TextDecoder,Intl,Date:FixedDate,Uint8Array,
    atob:value=>Buffer.from(value,'base64').toString('binary'),btoa:value=>Buffer.from(value,'binary').toString('base64'),
    setTimeout(){},fetch:async()=>({ok:false})};
  c.window=c;
  vm.runInNewContext(instrumented,c);
  return {...c,historyUrls};
}
const app=boot('#runRef='+id);
assert.equal(app.api.catalogRuns().length,4,'runtime retains all four issued sessions');
assert.equal(JSON.stringify(app.BettingEdgeRunnerPayload()),JSON.stringify(hydrated));
const isolated=app.api.payload();isolated.recs[0].title='MUTATED';
assert.notEqual(hydrated.recs[0].title,'MUTATED','runtime reads cannot mutate original handoff');
const morning=hydrated.prior_runs.find(r=>r.slot==='main');
const comparison={...morning,comparison:{feedGeneratedAt:'2026-09-08T22:05:00Z'}};
app.api.updateRunnerHash(comparison);
app.api.setActive(comparison);
assert.equal(app.api.payload().slot,'main','session changes update the in-memory handoff');
assert.equal(boot('#runRef='+id).api.payload().slot,'main','iframe reload retains the selected session');
assert.equal(app.BettingEdgeRunnerPayload().comparison.feedGeneratedAt,comparison.comparison.feedGeneratedAt);
assert.equal(app.historyUrls.length,0,'session/reprice updates cannot reintroduce huge navigation URLs');
app.api.updateRunnerHash(morning);app.api.setActive(morning);
assert.equal(app.api.payload().comparison,undefined,'restoration clears the comparison');
assert.ok(boot('#runRef=wrong').api.payload().__error,'mismatched handoff fails visibly');
assert.ok(boot('#runRef='+id,null).api.payload().__error,'missing host cannot silently load another report');
for(const hash of ['#run='+Buffer.from(JSON.stringify(current)).toString('base64url'),'#json='+encodeURIComponent(JSON.stringify(current))]){
  assert.equal(JSON.stringify(boot(hash,null).api.payload()),JSON.stringify(current),'legacy payload links remain supported');
}
const badges=fs.readFileSync('assets/event-timing-badges.js','utf8').replace('  function vancouverDay(value){','  window.decodeTimingRun=decodeRun;\n  function vancouverDay(value){');
const badgeContext={window:app,document:{getElementById:()=>null,addEventListener(){}},location:app.location,URLSearchParams};
vm.runInNewContext(badges,badgeContext);
assert.equal(app.decodeTimingRun().slot,'main','timing badges follow the selected session');
console.log(`Report handoff passed: ${current.recs.length} cards, 4 sessions, ${previousUrlBytes} old payload characters → ${url.length} URL characters; legacy links, restoration and timing preserved.`);
