import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import A from '../assets/value-analytics.js';
import O from '../assets/odds-format.js';
const require=createRequire(import.meta.url),ui=require('../assets/guy-daily-call.js'),benchmark=require('../assets/guy-value.js');
const now='2026-11-01T17:00:00Z',start='2026-11-01T19:00:00Z';
const source={url:'https://www.nhl.com/news/goalies',observedAt:'2026-11-01T16:40:00Z'};
function fixture(){
  const call={publicationId:'pub-1',researchId:'research-1',eventId:'nhl-1',away:'Away Club',home:'Home Club',startTime:start,side:'home',team:'Home Club',book:'DraftKings',priceDecimal:1+100/110,quoteObservedAt:'2026-11-01T16:45:00Z',publishedAt:'2026-11-01T16:50:00Z',minDecimalPrice:1+100/120,reason:'Bon. I like the chances they create in the slot.',supportReason:'Five-on-five chance quality supports the matchup.',contraryReason:'The opponent has the rest advantage.',pinnacleAssessment:{status:'DISAGREES',reason:'The price disagreement stays visible; the goalie matchup is why Guy prefers this side.'},research:{goalies:[{team:'Home Club',name:'Goalie One',status:'CONFIRMED',observedAt:source.observedAt,sourceRefs:[source]},{team:'Away Club',name:'Goalie Two',status:'PROJECTED',observedAt:source.observedAt,recheckAt:'2026-11-01T18:00:00Z',sourceRefs:[source]}],...Object.fromEntries(['lineup','restTravel','fiveOnFive'].map(key=>[key,{summary:key+' reviewed from current source.',observedAt:source.observedAt,sourceRefs:[source]}]))}};
  call.modelObservedAt='2026-11-01T16:40:00Z';call.researchedAt='2026-11-01T16:45:00Z';
  return {schema:1,characterId:'guy-laflame',policyId:'guy-researched-daily-call-v1',startedAt:'2026-11-01T07:00:00Z',effectiveFrom:'2026-11-01T07:00:00Z',updatedAt:now,entries:[{date:'2026-11-01',state:'WATCHING',lockAt:'2026-11-01T18:59:00Z',call,publications:[call],liveStatus:{state:'CURRENT',checkedAt:now,currentQuote:{book:'FanDuel',priceDecimal:1+100/115,observedAt:'2026-11-01T16:55:00Z',modelObservedAt:call.modelObservedAt}}}]};
}
const visible=html=>html.replace(/<script[\s\S]*?<\/script>/g,'');

test('actual call preserves published American odds alongside current price, price limit and hockey reasoning',()=>{
  const ledger=fixture(),before=JSON.stringify(ledger),html=ui.render(ledger,{now});
  assert.match(html,/data-guy-call-state="CURRENT"/);
  for(const text of ['GUY’S PLAY','Home Club','-110','-115','-120','Biggest concern','Goalie One','Confirmed','Goalie Two','Projected','Disagreement reviewed'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(visible(html),/>1\.9|>1\.8/);
  assert.match(html,/published Nov 1/);assert.match(html,/LATEST CAPTURED PRICE/);
  assert.equal(JSON.stringify(ledger),before,'rendering never changes the saved actual decision or result');
});

test('a saved CURRENT flag cannot keep stale or future prices actionable in the browser',()=>{
  for(const observedAt of ['2026-11-01T14:00:00Z','2026-11-01T17:01:00Z']){
    const ledger=fixture();ledger.entries[0].liveStatus.currentQuote.observedAt=observedAt;
    ledger.entries[0].liveStatus.reason='The source quote was fresh at publication.';
    const html=ui.render(ledger,{now});
    assert.equal(ui.status(ledger.entries[0],now),'PRICE_EXPIRED');assert.match(html,/PRICE REFRESH NEEDED/);
    assert.doesNotMatch(visible(html),/PRICE CHECK PASSED|source quote was fresh/);
  }
});

test('model and hockey-review freshness expire independently of a fresh quote and preserve the published record',()=>{
  for(const [field,deadline,state,message]of [['modelObservedAt','2026-11-01T15:45:00Z','PRICE_EXPIRED',/fresh MoneyPuck forecast/],['researchedAt','2026-11-01T11:00:00Z','RESEARCH_REQUIRED',/hockey review needs refreshing/]]){
    const ledger=fixture(),entry=ledger.entries[0];entry.call[field]=deadline;
    if(field==='modelObservedAt')entry.liveStatus.currentQuote.modelObservedAt=deadline;
    const before=JSON.stringify(ledger);
    assert.equal(ui.status(entry,now),'CURRENT','the exact freshness boundary remains valid');
    const at='2026-11-01T17:00:00.001Z',html=ui.render(ledger,{now:at,history:true});
    assert.equal(ui.status(entry,at),state);assert.match(html,message);assert.doesNotMatch(visible(html),/PRICE CHECK PASSED|Latest captured quote passes/);
    assert.match(html,/Home Club <strong>-110<\/strong>/);assert.match(html,/published selection history/);assert.equal(JSON.stringify(ledger),before);
    entry.state='LOCKED';entry.result={grade:'WIN',netUnits:entry.call.priceDecimal-1};
    const lockedBefore=JSON.stringify(ledger),locked=ui.render(ledger,{now:at,history:true});
    assert.match(locked,/DAILY CALL · LOCKED/);assert.match(locked,message);assert.match(locked,/1–0 · \+0\.91u/);
    assert.equal(JSON.stringify(ledger),lockedBefore,'expiry cannot alter the frozen selection, odds, history or grading');
  }
});

test('the latest checked model timestamp supersedes the original publication without rewriting it',()=>{
  const ledger=fixture(),entry=ledger.entries[0];entry.call.modelObservedAt='2026-11-01T15:00:00Z';
  entry.liveStatus.currentQuote.modelObservedAt='2026-11-01T16:55:00Z';const before=JSON.stringify(ledger);
  assert.equal(ui.status(entry,now),'CURRENT');assert.equal(JSON.stringify(ledger),before);
  delete entry.liveStatus.currentQuote.modelObservedAt;
  assert.equal(ui.status(entry,now),'PRICE_EXPIRED','without a newer checked timestamp the published model capture is the fallback');
  for(const field of ['modelObservedAt','researchedAt'])for(const value of [undefined,'2026-11-01T17:01:00Z']){
    const missing=fixture(),current=missing.entries[0];current.call[field]=value;
    if(field==='modelObservedAt')current.liveStatus.currentQuote.modelObservedAt=value;
    assert.notEqual(ui.status(current,now),'CURRENT','missing and future timestamps cannot pass freshness checks');
  }
});

test('the latest quote cannot replace the published price or bypass the play-to and goalie checks',()=>{
  const ledger=fixture(),entry=ledger.entries[0];
  entry.liveStatus.currentQuote.priceDecimal=1.7;
  assert.equal(ui.status(entry,now),'PRICE_OUTSIDE_LIMIT');assert.match(ui.render(ledger,{now}),/Do not chase this number/);
  assert.equal(entry.call.priceDecimal,1+100/110);
  entry.liveStatus.state='GOALIE_RECHECK_REQUIRED';entry.liveStatus.reason='A different starter has been reported.';
  assert.equal(ui.status(entry,now),'GOALIE_RECHECK_REQUIRED');assert.match(ui.render(ledger,{now}),/A different starter has been reported/);
});

test('a projected goalie deadline is rechecked from the browser clock without changing the saved call',()=>{
  const ledger=fixture(),entry=ledger.entries[0],before=JSON.stringify(ledger),at='2026-11-01T17:30:00Z';
  entry.call.research.goalies[1].recheckAt=at;const withDeadline=JSON.stringify(ledger);
  assert.equal(ui.status(entry,'2026-11-01T17:29:59Z'),'CURRENT');
  assert.equal(ui.status(entry,at),'GOALIE_RECHECK_REQUIRED');
  assert.match(ui.render(ledger,{now:at}),/GOALIE RECHECK NEEDED/);
  entry.state='LOCKED';
  const locked=ui.render(ledger,{now:at});assert.match(locked,/DAILY CALL · LOCKED/);assert.match(locked,/GOALIE RECHECK NEEDED/);
  entry.state='WATCHING';assert.equal(JSON.stringify(ledger),withDeadline);assert.notEqual(before,withDeadline);
});

test('the selected game cutoff freezes the recorded call and never presents it as a new executable quote',()=>{
  const ledger=fixture(),at='2026-11-01T18:59:00Z';
  ledger.entries[0].liveStatus.currentQuote.priceDecimal=2.2;
  assert.equal(ui.status(ledger.entries[0],at),'LOCKED');
  const html=ui.render(ledger,{now:at});assert.match(html,/DAILY CALL · LOCKED|This is the frozen published selection/);
  assert.match(html,/Home Club <strong>-110<\/strong>/);assert.doesNotMatch(visible(html),/PRICE CHECK PASSED|Latest captured quote passes/);
  ledger.entries[0].liveStatus={state:'GOALIE_RECHECK_REQUIRED',reason:'A changed starter still needs review.'};
  const warning=ui.render(ledger,{now:at});assert.match(warning,/GOALIE RECHECK NEEDED|A changed starter still needs review/);
  assert.equal(ui.summary(ledger,at).picks,1,'a later hockey alert does not erase the locked published record');
});

test('actual published-pick results count settled calls only and never borrow MoneyPuck benchmark results',()=>{
  const ledger=fixture();ledger.entries=[];
  for(const [date,grade,net]of [['2026-10-29','WIN',1.5],['2026-10-30','LOSS',-1],['2026-10-31',null,null]]){
    const entry=structuredClone(fixture().entries[0]);entry.date=date;entry.state='LOCKED';entry.result=grade?{grade,netUnits:net}:null;ledger.entries.push(entry);
  }
  ledger.moneyPuckBenchmark={wins:9,losses:13,netUnits:-4.629};
  assert.deepEqual(ui.summary(ledger,now),{picks:3,settled:2,wins:1,losses:1,pending:1,netUnits:.5,roiPct:25});
  const html=ui.render(ledger,{now,history:true});assert.match(html,/1–1 · \+0\.50u · ROI \+25\.00%/);assert.doesNotMatch(html,/9–13|-4\.63u/);
});

test('pending and prelaunch records never manufacture a daily choice or reset a missing record to zero',()=>{
  const ledger=fixture();ledger.entries=[];
  const pending=ui.render(ledger,{now});
  assert.match(pending,/No researched pick has been published today/);
  assert.doesNotMatch(pending,/Guy is checking today’s shortlist/);
  assert.match(ui.render(ledger,{now:'2026-11-01T06:59:00Z'}),/DAILY CALL STARTS NOVEMBER 1/);
  const html=ui.render(null,{now});assert.match(html,/latest call could not be loaded|published-pick record is unavailable/);assert.doesNotMatch(html,/0–0/);
});

test('all displayed research is escaped and embedded fallback preserves exact source text safely',()=>{
  const ledger=fixture(),payload='</script><img src=x onerror="bad()">';
  ledger.entries[0].call.reason=payload;ledger.entries[0].call.research.goalies[0].name=payload;
  ledger.entries[0].call.research.lineup.sourceRefs.push({url:'javascript:bad()',observedAt:now});
  const html=ui.render(ledger,{now}),raw=html.match(/<script type="application\/json" data-guy-call-snapshot>([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(visible(html),/<img|javascript:/);assert.match(html,/&lt;\/script&gt;/);
  assert.equal(JSON.parse(raw).entries[0].call.reason,payload,'fallback is an exact stored snapshot, not changed research');
});

test('failed live refresh rechecks the saved fallback against the browser clock',async()=>{
  const old=fixture();old.entries[0].call.quoteObservedAt='2026-11-01T13:45:00Z';old.entries[0].liveStatus.currentQuote.observedAt='2026-11-01T13:55:00Z';
  const saved=ui.render(old,{now:'2026-11-01T14:00:00Z'}).match(/data-guy-call-snapshot>([\s\S]*?)<\/script>/)[1];
  let painted='';const node={querySelector:()=>({textContent:saved}),set outerHTML(html){painted=html;}};
  class BrowserDate extends Date{constructor(value){super(value??now);}static now(){return Date.parse(now);}}
  const context={Date:BrowserDate,Intl,URL,document:{getElementById:()=>node},console};vm.createContext(context);
  vm.runInContext(fs.readFileSync('assets/guy-daily-call.js','utf8'),context);
  await context.GuyDailyCall.boot({read:async()=>{throw Error('offline');}});
  assert.match(painted,/PRICE REFRESH NEEDED/);assert.doesNotMatch(visible(painted),/PRICE CHECK PASSED/);
  assert.match(ui.render({...old,entries:[null]},{now}),/published-pick record is unavailable/);
});

test('a pending refresh immediately clock-checks the embedded call and keeps its timer running before the network completes',async()=>{
  let at='2026-11-01T17:16:00Z',painted='',callback,release,reads=0,clears=0;const ledger=fixture(),entry=ledger.entries[0];
  entry.call.modelObservedAt=entry.liveStatus.currentQuote.modelObservedAt='2026-11-01T16:00:00Z';
  entry.call.research.goalies[1].recheckAt='2026-11-01T17:17:00Z';const before=JSON.stringify(ledger);
  const saved=ui.render(ledger,{now}).match(/data-guy-call-snapshot>([\s\S]*?)<\/script>/)[1];
  const node={querySelector:()=>({textContent:saved}),querySelectorAll:()=>[],set outerHTML(html){painted=html;}};
  class BrowserDate extends Date{constructor(value){super(value??at);}static now(){return Date.parse(at);}}
  const context={Date:BrowserDate,Intl,URL,document:{getElementById:()=>node},setTimeout(fn){callback=fn;return 1;},clearTimeout(){clears++;},console};
  vm.createContext(context);vm.runInContext(fs.readFileSync('assets/guy-daily-call.js','utf8'),context);
  const pending=context.GuyDailyCall.boot({read:()=>{reads++;return new Promise(resolve=>{release=resolve;});}});
  assert.match(painted,/fresh MoneyPuck forecast/);assert.doesNotMatch(visible(painted),/PRICE CHECK PASSED/);
  assert.equal(typeof callback,'function','the local watcher starts before the saved feed resolves');
  at='2026-11-01T17:17:00Z';callback();assert.match(painted,/GOALIE RECHECK NEEDED/);assert.equal(reads,1);assert.equal(JSON.stringify(ledger),before);
  const refreshed=fixture();refreshed.entries[0].liveStatus.currentQuote.observedAt=refreshed.entries[0].liveStatus.currentQuote.modelObservedAt=at;
  refreshed.entries[0].call.research.goalies.forEach(goalie=>{goalie.status='CONFIRMED';});
  release(refreshed);await pending;assert.match(painted,/PRICE CHECK PASSED/);assert.ok(clears>0,'successful refresh replaces the fallback watcher');
  at='2026-11-01T18:33:00Z';callback();assert.match(painted,/PRICE REFRESH NEEDED/);assert.equal(reads,1,'later local expiry consumes no extra source requests');
});

test('Blue Line starts the actual-call refresh before a pending shared board request',()=>{
  const events=[],never=new Promise(()=>{}),doc={getElementById:()=>null};
  const context={document:doc,URL,Date,Intl,console,location:{href:'https://fixture.local/syndicates/generated/guy-laflame/'},GuyDailyCall:{boot({read}){events.push('actual-call');return read('data/characters/guy-laflame/calls-ledger.json');}},fetch(url){events.push(new URL(url).pathname);return never;}};
  vm.createContext(context);vm.runInContext(fs.readFileSync('assets/guy-blue-line.js','utf8'),context);
  void context.GuyBlueLine.boot({base:'https://fixture.local/',container:{innerHTML:''},notice:{textContent:''}});
  assert.deepEqual(events,['actual-call','/data/characters/guy-laflame/calls-ledger.json','/data/game-intelligence/board.json']);
});

test('an open page changes its status locally when a goalie check becomes due, without fetching or rewriting research',()=>{
  let at=now,painted='',callback,networkCalls=0;const ledger=fixture();ledger.entries[0].call.research.goalies[1].recheckAt='2026-11-01T17:01:00Z';const before=JSON.stringify(ledger);
  const node={querySelectorAll:()=>[],set outerHTML(html){painted=html;}};
  class BrowserDate extends Date{constructor(value){super(value??at);}static now(){return Date.parse(at);}}
  const context={Date:BrowserDate,Intl,URL,document:{getElementById:()=>node},setTimeout(fn){callback=fn;return 1;},clearTimeout(){},fetch(){networkCalls++;},console};
  vm.createContext(context);vm.runInContext(fs.readFileSync('assets/guy-daily-call.js','utf8'),context);
  context.GuyDailyCall.watch({ledger});assert.equal(painted,'');
  at='2026-11-01T17:01:00Z';callback();assert.match(painted,/GOALIE RECHECK NEEDED/);
  assert.equal(networkCalls,0);assert.equal(JSON.stringify(ledger),before);
});

test('an open page expires model and hockey-review checks locally without fetching or rewriting its published history',()=>{
  for(const field of ['modelObservedAt','researchedAt']){
    let at=now,painted='',callback,delay,networkCalls=0;const ledger=fixture(),entry=ledger.entries[0];
    entry.call[field]=field==='modelObservedAt'?'2026-11-01T15:45:30Z':'2026-11-01T11:00:30Z';
    if(field==='modelObservedAt')entry.liveStatus.currentQuote.modelObservedAt=entry.call[field];
    const before=JSON.stringify(ledger),node={querySelectorAll:()=>[],set outerHTML(html){painted=html;}};
    class BrowserDate extends Date{constructor(value){super(value??at);}static now(){return Date.parse(at);}}
    const context={Date:BrowserDate,Intl,URL,document:{getElementById:()=>node},setTimeout(fn,ms){callback=fn;delay=ms;return 1;},clearTimeout(){},fetch(){networkCalls++;},console};
    vm.createContext(context);vm.runInContext(fs.readFileSync('assets/guy-daily-call.js','utf8'),context);
    context.GuyDailyCall.watch({ledger,history:true});assert.equal(painted,'');assert.equal(delay,30001,'the local timer targets the independent source deadline');
    at='2026-11-01T17:00:30.001Z';callback();
    assert.match(painted,field==='modelObservedAt'?/fresh MoneyPuck forecast/:/hockey review needs refreshing/);
    assert.match(painted,/Home Club <strong>-110<\/strong>/);assert.match(painted,/published selection history/);
    assert.equal(networkCalls,0);assert.equal(JSON.stringify(ledger),before);
  }
});

test('F8 renders actual-call history before the preserved benchmark and loads its optional saved ledger independently',()=>{
  const engine={innerHTML:'',dataset:{},classList:{add(){}},querySelectorAll:()=>[],querySelector:()=>null};
  const doc={getElementById:id=>id==='engine'?engine:id==='runnerResultsDeskStyle'?{}:null,head:{appendChild(){}},createElement:()=>({})};
  const context={VigScopeValueAnalytics:A,VigScopeOddsFormat:O,GuyValue:benchmark,GuyDailyCall:ui,document:doc,window:{addEventListener(){}},setInterval(){},clearInterval(){},Intl,Date,console,localStorage:{getItem:()=>null}};
  vm.createContext(context);const src=fs.readFileSync('assets/results-value-desk-v2.js','utf8');vm.runInContext(src,context);
  context.VigScopeValueDesk.setGuyCalls(fixture());context.VigScopeValueDesk.setGuyRecord({schema:1,characterId:'guy-laflame',startedAt:'2026-10-07T00:50:00Z',entries:[]});
  context.VigScopeValueDesk.render(doc,{cards:[],coverage:{},issuedBetAnalytics:{},decisionValueShadowV2:{byStatus:[]}});
  assert.ok(engine.innerHTML.indexOf('GUY’S PLAY')<engine.innerHTML.indexOf('MONEYPUCK BENCHMARK'));
  assert.match(engine.innerHTML,/GUY’S BLUE LINE \/\/ MONEYPUCK VALUE/);
  assert.match(src,/calls-ledger\.json/);assert.match(src,/GUY_CALLS_URL[^\n]+catch\(\(\)=>null\)/);
  const loader=fs.readFileSync('assets/report-dashboard-vigscope.js','utf8');
  assert.ok(loader.indexOf('guy-daily-call.js')<loader.indexOf('results-value-desk-v2.js'));
});

test('an unavailable actual-call feed does not stop the F8 history and benchmark renderer',async()=>{
  const engine={innerHTML:'',dataset:{},classList:{add(){}},querySelectorAll:()=>[],querySelector:()=>null};
  const doc={getElementById:id=>id==='engine'?engine:id==='runnerResultsDeskStyle'?{}:null,head:{appendChild(){}},createElement:()=>({})};
  let install;const requested=[];
  const context={VigScopeValueAnalytics:A,VigScopeOddsFormat:O,GuyValue:benchmark,GuyDailyCall:ui,document:doc,window:{addEventListener(){}},setInterval(fn){install=fn;return 1;},clearInterval(){},Intl,Date,console,localStorage:{getItem:()=>null},fetch:async url=>{requested.push(url);if(url.includes('results-index.json'))return{ok:true,json:async()=>({cards:[],coverage:{},issuedBetAnalytics:{},decisionValueShadowV2:{byStatus:[]}})};throw Error('optional source offline');}};
  vm.createContext(context);vm.runInContext(fs.readFileSync('assets/results-value-desk-v2.js','utf8'),context);install();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.ok(requested.some(url=>url.includes('calls-ledger.json')));
  assert.match(engine.innerHTML,/Guy’s latest call could not be loaded/);
  assert.match(engine.innerHTML,/UNIQUE SELECTION LOG|ISSUED CARD LOG/);
  assert.doesNotMatch(engine.innerHTML,/Results history unavailable/);
});
