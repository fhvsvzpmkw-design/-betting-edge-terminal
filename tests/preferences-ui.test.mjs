import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const roster=createRequire(import.meta.url)('../assets/syndicate-roster.js');
const prefs=JSON.parse(fs.readFileSync('data/preferences.json','utf8'));
const syndicates=JSON.parse(fs.readFileSync('data/syndicates.json','utf8'));
const shells=JSON.parse(fs.readFileSync('data/hotline-shells.json','utf8'));
const source=fs.readFileSync('assets/preferences-framework.js','utf8');

function fixture(seed={}){
  const saved=new Map(Object.entries(seed)),timers=[],events=[],status=new Map();
  const storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,String(value))};
  const card={value:'neon',dispatchEvent:event=>events.push({type:event.type,value:card.value,bubbles:event.bubbles})};
  const box={dataset:{},listeners:[],addEventListener(type,handler){this.listeners.push({type,handler})}};
  const document={documentElement:{dataset:{}},defaultView:{Event:class{constructor(type,options){this.type=type;Object.assign(this,options)}}},
    getElementById:id=>id==='runnerPreferenceModuleOverview'?box:null,
    querySelector:selector=>{
      if(selector==='[data-pref-choice="card_view"]')return card;
      if(selector.startsWith('[data-pref-status=')){if(!status.has(selector))status.set(selector,{classList:{toggle(){}},textContent:''});return status.get(selector)}
      return null;
    },querySelectorAll:()=>[]};
  const context={window:{top:{},localStorage:storage,VigwireSyndicateRoster:roster},localStorage:storage,location:{href:'https://vigwirelabs.com/runner.html',hash:''},history:{replaceState(){}},URL,URLSearchParams,CSS:{escape:value=>String(value)},setTimeout:handler=>timers.push(handler)};
  const code=source.slice(0,source.indexOf('\nPromise.all(['))+
    'prefs='+JSON.stringify(prefs)+';syndicates='+JSON.stringify(syndicates)+';hotlineShells='+JSON.stringify(shells)+';'+
    'globalThis.api={currentHotlineShells,groupedControls,resetAppearance,resetSyndicateLineup,bindControls,applyStartup,feedback,setShells:value=>hotlineShells=value};render=()=>true;})();';
  vm.runInNewContext(code,context);
  return {api:context.api,saved,document,timers,events,box,context};
}

const app=fixture();
const current=JSON.parse(JSON.stringify(app.api.currentHotlineShells()));
const shellKeys=shells.shells.map(shell=>`${shell.id}@${shell.version}`);
assert.equal(new Set(shellKeys).size,shellKeys.length,'shell versions must remain unique');
for(const key of ["muddy-broadcast@1","muddy-ledger-desk@3","private-sheet@1","private-sheet@2","private-sheet@3","lizard-line@2","delphoria-counter-sheet@2","delphoria-nfl-book@3","crown-and-lance@1","vegas-by-the-slice@3","vegas-by-the-slice@4","graham-mercer-default@1","delphoria-house-board@4","guy-blue-line@1"])assert.ok(shellKeys.includes(key),`historical shell ${key} remains available`);
assert.equal(current.length,8);assert.equal(new Set(current.map(shell=>shell.characterId)).size,8);
assert.equal(current.find(shell=>shell.characterId==='bill-weston').version,4);
assert.equal(current.find(shell=>shell.characterId==='jesse-bains').version,4);
assert.deepEqual(current.slice(0,5).map(shell=>shell.characterId),['eddie-numbers','graham-mercer','bill-weston','guy-laflame','lou-vega']);
app.api.setShells({...shells,shells:[...shells.shells,{...current[0],version:999,defaultForCharacter:false},{...current[0],version:2,defaultForCharacter:true}]});
assert.equal(app.api.currentHotlineShells().length,8,'multiple packages may never duplicate a member');
assert.equal(app.api.currentHotlineShells()[0].version,3,'a historical higher version is not an approved current design');
const html=app.api.groupedControls();
assert.equal((html.match(/data-pref-group=/g)||[]).length,4);
assert.equal((html.match(/data-preference-module=/g)||[]).length,9);
assert.ok(!/terminal_interface|prefStateCounts|prefStateBadge|prefModulePolicy/.test(html));
assert.ok(html.includes('Slot 8'));assert.ok(html.includes('Main Menu'));assert.ok(html.includes('VigScope Value'));
app.api.bindControls(app.document);app.api.bindControls(app.document);
assert.equal(app.box.listeners.filter(listener=>listener.type==='change').length,1,'rebuilding child controls must not stack delegated save handlers');
assert.equal(app.box.listeners.filter(listener=>listener.type==='click').length,1);

const custom=['lou-vega','graham-mercer','vic-fremont','eddie-numbers','alex-daventry',null,null,null];
const seed={
  'bettingEdge.preferences.meterPresentation':'rails','bettingEdge.preferences.cardView':'neon',
  'bettingEdge.preferences.startupScreen':'engine','bettingEdge.preferences.historyLanding':'ledger',
  'bettingEdge.preferences.meatDeskAnalysisMode':'god_mode','bettingEdge.preferences.cryptoSpecialsAnalysisMode':'in_depth_report',
  'bettingEdge.syndicateSlots.v4':JSON.stringify(custom),'bettingEdge.syndicateSlots.defaultOrderRevision':String(syndicates.defaultOrderRevision),
  'bettingEdge.savedHistoryTest':'issued-history-sentinel'
};
const reset=fixture(seed);reset.api.resetAppearance(reset.document);
assert.equal(reset.saved.get('bettingEdge.preferences.meterPresentation'),'blocks');
assert.equal(reset.saved.get('bettingEdge.preferences.cardView'),'normal');
for(const [key,value] of Object.entries(seed).filter(([key])=>!['bettingEdge.preferences.meterPresentation','bettingEdge.preferences.cardView'].includes(key)))assert.equal(reset.saved.get(key),value,`appearance reset must preserve ${key}`);
assert.deepEqual(reset.events,[{type:'change',value:'normal',bubbles:true}],'the existing card renderer receives the reset immediately');
reset.api.resetSyndicateLineup(reset.document);
assert.deepEqual(JSON.parse(reset.saved.get('bettingEdge.syndicateSlots.v4')),syndicates.defaults);
for(const [key,value] of Object.entries(seed).filter(([key])=>!['bettingEdge.preferences.meterPresentation','bettingEdge.preferences.cardView','bettingEdge.syndicateSlots.v4','bettingEdge.syndicateSlots.defaultOrderRevision'].includes(key)))assert.equal(reset.saved.get(key),value,`lineup reset must preserve ${key}`);

const launch=fixture({'bettingEdge.preferences.startupScreen':'market'});let clicked=0;
const button={classList:{contains:()=>false},click:()=>clicked++};
const originalQuery=launch.document.querySelector;launch.document.querySelector=selector=>selector==='.btn[data-view="market"]'?button:originalQuery(selector);
launch.api.applyStartup(launch.document);assert.equal(clicked,0);assert.equal(launch.timers.length,1);
launch.document.documentElement.dataset.primaryNavShellBound='5';launch.timers.shift()();assert.equal(clicked,1);
const main=fixture();main.api.applyStartup(main.document);assert.equal(main.timers.length,0,'Main Menu is the default and requires no synthetic tab opening');
const direct=fixture({'bettingEdge.preferences.startupScreen':'market'});direct.context.location.hash='#view=syndicate';direct.api.applyStartup(direct.document);assert.equal(direct.timers.length,0,'an explicit Syndicate link takes priority over saved startup navigation');
console.log('PREFERENCES UI: PASS // 8 unique current shells; 4 groups; focused resets preserve history/navigation/research; single save handlers; saved startup respects Main Menu and explicit links');
