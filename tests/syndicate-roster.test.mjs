import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const roster=createRequire(import.meta.url)('../assets/syndicate-roster.js');
const manifest=JSON.parse(fs.readFileSync('data/syndicates.json','utf8'));
const defaults=manifest.defaults;
const key='bettingEdge.syndicateSlots.v4',orderKey='bettingEdge.syndicateSlots.defaultOrderRevision';
function environment(saved,savedRevision,session,sessionRevision){
  const values=new Map([[key,JSON.stringify(saved)],[orderKey,savedRevision]]),top={__vigwireSyndicateAssignments:session,__vigwireSyndicateOrderRevision:sessionRevision};
  return {values,context:{top,localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))}}};
}
test('recover the legacy empty first four without losing optional characters; persist recovery across reopening',()=>{
  const e=environment([null,null,null,null,'lou-vega','jesse-bains',null,null],'2');
  const expected=[...defaults.slice(0,5),'jesse-bains',null,null];
  assert.deepEqual(roster.read(manifest,e.context),expected);
  assert.equal(e.values.get(orderKey),'3');
  assert.deepEqual(roster.read(manifest,e.context),expected);
});
test('fresh storage and damaged records load the published five members',()=>{
  for(const source of [null,[],{slot:1},[null,null,null,null],['unknown','unknown','unknown','unknown','unknown',null,null,null]]){
    const e=environment(source,'3');assert.deepEqual(roster.read(manifest,e.context),defaults);
  }
});
test('current explicit empty slots and custom choices survive reload; saved choices beat a stale open-tab roster',()=>{
  const chosen=[null,'graham-mercer','vic-fremont','guy-laflame','lou-vega','jesse-bains','eddie-numbers',null];
  const e=environment(chosen,'3',defaults,'3');
  assert.deepEqual(roster.read(manifest,e.context),chosen);
  assert.deepEqual(e.context.top.__vigwireSyndicateAssignments,chosen);
  roster.write(Array(8).fill(null),manifest,e.context);
  assert.deepEqual(roster.read(manifest,e.context),Array(8).fill(null));
});
test('unavailable or partial character libraries never overwrite saved assignments',()=>{
  const e=environment(defaults,'3');
  for(const profiles of [undefined,[],manifest.profiles.filter(p=>p.id==='lou-vega')]){
    assert.throws(()=>roster.read({...manifest,profiles},e.context),/library (unavailable|incomplete)/);
    assert.equal(e.values.get(key),JSON.stringify(defaults));
    assert.equal(e.values.get(orderKey),'3');
  }
});
test('private browsing uses the session fallback without emptying the defaults',()=>{
  const context={top:{},localStorage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}};
  assert.deepEqual(roster.read(manifest,context),defaults);
  const custom=[...defaults];custom[5]='jesse-bains';roster.write(custom,manifest,context);
  assert.deepEqual(roster.read(manifest,context),custom);
});
test('first tab paint uses resolved assignments, including recovery and intentional empties',async()=>{
  const source=fs.readFileSync('runner.html','utf8'),start=source.indexOf('async function loadSyndicateManifest('),end=source.indexOf('\nfunction renderSyndicateSlot(',start);
  const chosen=[null,'graham-mercer','vic-fremont','guy-laflame','lou-vega','jesse-bains',null,null];
  for(const [saved,revision,expected] of [[Array(8).fill(null),'2',defaults],[chosen,'3',chosen]]){
    const e=environment(saved,revision);e.context.VigwireSyndicateRoster=roster;
    const context={window:e.context,fetch:async()=>({ok:true,json:async()=>manifest}),normalizeSyndicateManifest:raw=>raw.slots};
    vm.runInNewContext("const SYNDICATE_MANIFEST='manifest';"+source.slice(start,end)+';globalThis.load=loadSyndicateManifest;',context);
    const slots=await context.load();
    assert.deepEqual(Array.from(slots,s=>s.name),expected.map((id,i)=>manifest.profiles.find(p=>p.id===id)?.name||`EMPTY ${i+1}`));
    assert.ok(slots.every((s,i)=>s.url===manifest.slots[i].url),'empty slots retain their character-picker host');
  }
});
