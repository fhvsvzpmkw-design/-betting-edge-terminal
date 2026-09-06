import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {derivePrimaryMarketInstrumentTelemetry, deriveResilientInstrumentTelemetry} from '../tools/vigscope-meter-telemetry.mjs';

// Minimal DOM fixture exercises the actual renderer and active dashboard
// rearrangement without a browser/network dependency in publication checks.
class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.className='';this.id='';this.dataset={};this.style={setProperty(k,v){this[k]=v}};this.attributes={};this._text='';this.classList={add:(c)=>this.className=[...new Set([...this.className.split(' ').filter(Boolean),c])].join(' '),contains:c=>this.className.split(' ').includes(c),toggle:(c,on)=>{const set=new Set(this.className.split(' ').filter(Boolean));if(on??!set.has(c))set.add(c);else set.delete(c);this.className=[...set].join(' ');}};}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  set textContent(v){this._text=String(v);for(const c of this.children)c.parentElement=null;this.children=[];}
  get firstChild(){return this.children[0]||null;}
  get nextElementSibling(){return this.parentElement?.children[this.parentElement.children.indexOf(this)+1]||null;}
  append(...nodes){for(const n of nodes)this.appendChild(n);}
  appendChild(n){n.remove();this.children.push(n);n.parentElement=this;return n;}
  insertBefore(n,ref){n.remove();const i=ref?this.children.indexOf(ref):-1;this.children.splice(i<0?this.children.length:i,0,n);n.parentElement=this;return n;}
  insertAdjacentElement(where,n){assert.equal(where,'afterend');return this.parentElement.insertBefore(n,this.nextElementSibling);}
  remove(){if(this.parentElement){const p=this.parentElement;p.children.splice(p.children.indexOf(this),1);this.parentElement=null;}}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='id')this.id=String(v);if(k==='class')this.className=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  removeAttribute(k){delete this.attributes[k];}
  matches(selector){if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector.startsWith('.'))return selector.slice(1).split('.').every(c=>this.classList.contains(c));return this.tagName.toLowerCase()===selector.toLowerCase();}
  querySelectorAll(selector){const direct=selector.startsWith(':scope > ');if(direct)selector=selector.slice(9);const parts=selector.split(/\s+/),all=direct?this.children:this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);return all.filter(n=>{if(selector==='*')return true;if(!n.matches(parts.at(-1)))return false;if(parts.length===1)return true;let ancestor=n.parentElement;for(let i=parts.length-2;i>=0;i--){while(ancestor&&!ancestor.matches(parts[i]))ancestor=ancestor.parentElement;if(!ancestor)return false;ancestor=ancestor.parentElement;}return true;});}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  addEventListener(){}
}
class Document extends Element {
  constructor(){super('document');this.head=new Element('head');this.body=new Element('body');this.append(this.head,this.body);}
  createElement(tag){return new Element(tag);}
  createElementNS(ns,tag){return new Element(tag);}
  createTextNode(text){const node=new Element('#text');node.textContent=text;return node;}
  getElementById(id){return this.querySelector('#'+id);}
}
const document=new Document();const app=document.createElement('iframe');app.id='app';document.body.appendChild(app);
const context={console,document,location:{hash:'',search:''},localStorage:{getItem:()=>null},Intl,URLSearchParams,Date,setTimeout,clearTimeout};context.window={top:null};
let source=fs.readFileSync('assets/runner-core-runtime.js','utf8');
const marker='\nactiveRun=payload();';
vm.runInNewContext(source.replace(marker,'\nglobalThis.api={telemetryIntegrityState,deriveInstrumentReadings,meterBaselineText,coverageSummaryState,coveragePanel,noPublishedCardsText,instrumentCluster};'+marker),context);
const api=context.api;
source=fs.readFileSync('assets/report-dashboard-vigscope.js.old','utf8');
const tail=source.lastIndexOf("  const core=document.getElementById('core');");
vm.runInNewContext(source.slice(0,tail)+'globalThis.dashboardApi={patchDashboard,stateFromCluster};\n})();',context);

const policy=JSON.parse(fs.readFileSync('data/major-sport-market-coverage-v1.json','utf8'));
const feed={generatedAt:'2026-09-06T23:05:00Z',events:[{id:'1',eventId:'1',date:'2026-09-07T02:00:00Z',sport:{slug:'baseball'},league:{slug:'usa-mlb'},bookmakers:{}}]};
for(const book of ['Bet365','DraftKings'])feed.events[0].bookmakers[book]=[{marketKey:'ml',updatedAt:feed.generatedAt,odds:[{home:2.2,away:1.8,selectionKeys:{home:'1|ml|home||',away:'1|ml|away||'}}]}];
const report={ts:'2026-09-06T16:15:00-07:00',feedGeneratedAt:feed.generatedAt,recs:[],counts:{bet:0,lean:0,wait:0,pass:0}};
const snapshot=structuredClone(feed);snapshot.generatedAt='2026-09-06T22:05:00Z';for(const markets of Object.values(snapshot.events[0].bookmakers)){markets[0].updatedAt=snapshot.generatedAt;markets[0].odds[0].home=2;}
report.instrumentTelemetry=derivePrimaryMarketInstrumentTelemetry({report,feed,policy,feedBlobSha:'a'.repeat(40),coverageAuthorityBlobSha:'b'.repeat(40),oddsSnapshots:[{blobSha:'c'.repeat(40),feed:snapshot}]});
assert.equal(report.instrumentTelemetry.sample.availableSelections,2);
report.coverageSummary={schema:1,source:{feedBlobSha:'a'.repeat(40),feedGeneratedAt:feed.generatedAt,maxMarketAgeMinutes:90},scope:'RETAINED_SAME_DAY_PREGAME_EVENTS',games:1,selections:{required:6,available:2,evaluated:0,blocked:2,unavailable:4},decisions:{bet:0,lean:0,wait:0,pass:0},unavailableReasons:[{reason:'STALE_EXECUTABLE_QUOTE',count:2},{reason:'STALE_BEYOND_RETENTION',count:2}],discoveryOmissions:[{eventId:'3',reason:'EVENT_NOT_RETURNED'}],blockers:['home','away'].map(side=>({selectionId:'MLB|1|full_game_moneyline|'+side,eventId:'1',label:'Visitors at Hosts',marketDetail:'full_game_moneyline',side,reason:'RESEARCH_INCOMPLETE',missing:'Independent current support.',impact:'Cannot establish a supported fair.'}))};
const immutable=JSON.stringify(report);
assert.equal(api.telemetryIntegrityState(report),'VALID','an empty card list must accept verified primary market telemetry');
assert.equal(api.coverageSummaryState(report),'VALID');
assert.ok(api.deriveInstrumentReadings(report).heat.confidence>0);
assert.equal(api.deriveInstrumentReadings(report).pressure.label,'NO DIRECTION');
assert.match(api.meterBaselineText(report),/2 VERIFIED PRIMARY SIDES.*2 SAME-BOOK COMPARISONS.*NO DIRECTIONAL REFERENCE/);
assert.match(api.noPublishedCardsText(report),/0 documented decisions; 2 selections blocked by evidence; 4 without usable odds/);
const panel=api.coveragePanel(document,report);
assert.match(panel.textContent,/ODDS AVAILABLE.*DOCUMENTED REVIEWS.*EVIDENCE BLOCKED.*ODDS UNAVAILABLE/);
assert.match(panel.textContent,/older than 30m/);assert.match(panel.textContent,/older than 90m/);
assert.match(panel.textContent,/1 additional discovered game was not retained/);
assert.match(panel.textContent,/Independent current support/);
assert.equal(panel.querySelectorAll('.runnerCoverageFact b').map(n=>n.textContent).join(','),'2,0,2,4');

// The live .js.old overlay must retain coverage before all instrument/cards,
// and remain stable after the mutation observer runs a second time.
const live=document.createElement('div');live.id='runnerLive';document.body.appendChild(live);
const head=document.createElement('div');head.className='runnerHead';const cluster=api.instrumentCluster(document,report);head.appendChild(cluster);
const counts=document.createElement('div');counts.className='runnerCounts';for(const key of ['bet','lean','wait','pass']){const count=document.createElement('b');count.textContent=report.counts[key];counts.appendChild(count);}
const summary=document.createElement('div');summary.className='runnerSummary';summary.textContent='No cards published.';
live.append(head,panel,counts,summary);
context.dashboardApi.patchDashboard(document);context.dashboardApi.patchDashboard(document);
assert.equal(head.nextElementSibling,panel);assert.equal(panel.nextElementSibling.id,'runnerMarketIntel');
assert.equal(document.getElementById('runnerMarketIntel').querySelector('.runnerSummary'),summary);
assert.equal(document.getElementById('runnerVigPicks').querySelector('.runnerVigSectionTitle').textContent,'PUBLISHED CARDS');
assert.match(document.getElementById('runnerVigScope').textContent,/COMBINED STATE UNMEASURED.*No BET, LEAN or WAIT direction/);
assert.equal(cluster.querySelectorAll('.instrument')[1].querySelector('.instrumentRead b').textContent,'—','no neutral 50 may be shown as measured pressure');
assert.equal(counts.textContent,'0000','no PASS cards may be synthesized');
assert.equal(JSON.stringify(report),immutable,'rendering may never rewrite the report');
assert.match(api.noPublishedCardsText({...report,recs:[{status:'PASS'}]}),/No published selections match ALL/,'filter-empty text is distinct from zero cards');

for(const mutate of [r=>{r.instrumentTelemetry.calculationVersion=2;},r=>{delete r.instrumentTelemetry.source.coverageAuthorityBlobSha;},r=>{r.instrumentTelemetry.source.state='UNAVAILABLE';},r=>{r.instrumentTelemetry.movement.comparisons[0].book='Other';},r=>{r.instrumentTelemetry.movement.comparisons[0].baselineTs=feed.generatedAt;},r=>{r.instrumentTelemetry.pressure.rawConfidence=100;},r=>{r.coverageSummary.source.feedBlobSha='d'.repeat(40);}]){const bad=structuredClone(report);mutate(bad);assert.equal(api.telemetryIntegrityState(bad),'ERROR');assert.equal(api.deriveInstrumentReadings(bad).heat.label,'INTEGRITY ERROR');}
const missing=structuredClone(report);delete missing.coverageSummary;assert.equal(api.coverageSummaryState(missing),'MISSING');assert.match(api.coveragePanel(document,missing).textContent,/COVERAGE UNVERIFIED/);
const fabricated=structuredClone(report);fabricated.coverageSummary.selections.evaluated=2;assert.equal(api.coverageSummaryState(fabricated),'ERROR');assert.match(api.coveragePanel(document,fabricated).textContent,/COVERAGE UNVERIFIED/);

// Historical empty-card receipts keep their telemetry and receive truthful
// presentation: no claims of current quote sampling or completed analysis.
const historical={ts:'2026-09-05T18:21:30-07:00',feedGeneratedAt:'2026-09-06T01:08:00Z',recs:[]};
const historicalFeed={generatedAt:historical.feedGeneratedAt,events:[]};historical.instrumentTelemetry=deriveResilientInstrumentTelemetry({report:historical,feed:historicalFeed,feedBlobSha:'a'.repeat(40),oddsSnapshots:[]});
const before=JSON.stringify(historical);
assert.equal(api.telemetryIntegrityState(historical),'VALID');
assert.match(api.meterBaselineText(historical),/NO PUBLISHED SELECTIONS IN METER SAMPLE/);
assert.equal(api.coveragePanel(document,historical),null);
assert.match(api.noPublishedCardsText(historical),/analysis coverage was not recorded/);
assert.equal(JSON.stringify(historical),before);
console.log('PRIMARY DASHBOARD: PASS // VERIFIED COVERAGE + NO-CARD MARKET METERS + DIRECTION EXPLANATION + DOM ORDER + INTEGRITY + HISTORICAL PRESERVATION');
