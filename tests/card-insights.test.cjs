const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const insights=require('../assets/card-insights.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
  const observedAt='2026-11-07T16:00:00Z',start='2026-11-08T03:00:00Z';
  const fact=(kind,details)=>({eventId:'game',sport:'NHL',startTime:start,observedAt,sourceId:'espn',url:'https://www.espn.com/game',kind,details});
  const forecast={recordId:'home-point',sourceId:'moneypuck',modelFamily:'MONEYPUCK',eligibility:'ELIGIBLE_EXACT',eventId:'game',
    side:'home',marketDetail:'full_game_moneyline',period:'FULL_GAME',line:null,probability:.58,observedAt,url:'https://moneypuck.com/game',
    comparison:{priceDecimal:2,breakEvenProbability:.5,edgeProbabilityPoints:8}};
  const rec={title:'Home Moneyline',status:'LEAN',stake:'$0',playTo:'NO BET',feed:{eventId:'game',eventDate:start,
    marketKey:'ml',side:'home',line:null,selectionKey:'game|ml|home||',priceDecimal:2},
    coreAssessment:{context:{sport:'NHL',marketDetail:'full_game_moneyline'}},
    forecastReview:{eligibleExactRecordIds:['home-point'],records:[forecast]},
    forecastLean:{rationale:'The published point supports the issued price.',recheckCondition:'Confirm Home starter before reassessing at +100.'},
    personnelEvidence:{unresolved:['Confirm Home starter before reassessing at +100.']},
    cardEvidence:{findings:[{stance:'CONTEXT',finding:'Home played the previous evening.'},{stance:'CONTEXT',finding:'WRONG_MARKET_OR_SIDE'}]}};
  const game={eventId:'game',sport:'NHL',home:'Home',away:'Away',startTime:start,label:'Away @ Home',facts:[
    fact('VENUE',{name:'Home Arena'}),fact('TEAM_RECORD',{team:'Home',records:[{type:'total',summary:'8-4-1'},{type:'home',summary:'5-1-0'}]}),
    fact('INJURIES',{team:'Away',players:[{name:'Named Forward',status:'Out',detail:'Ankle'}]}),
    fact('INJURIES',{team:'Home',players:[]}),
    fact('STARTING_GOALIE',{team:'Home',name:'Named Goalie',status:'PROJECTED'}),
    fact('RECENT_GAMES',{team:'Home',events:[
      {date:'2026-11-07T03:00:00Z',opponent:'Recent Opponent',result:'L',score:'3-2 OT'},
      {date:'2026-11-05T03:00:00Z',opponent:'Older Opponent',result:'W',score:'4-1'},
      {date:'2026-11-09T03:00:00Z',opponent:'Future Opponent',result:'W',score:'9-0'}]})]};
  return {rec,game,run:{ts:'2026-11-07T17:00:00Z',gameIntelligence:{asOf:'2026-11-07T16:05:00Z',games:[game]}}};
}
test('game context uses the exact issued event, sport and kickoff and never a later board',()=>{
  const {rec,game,run}=fixture(),before=JSON.stringify({rec,run});
  const view=insights.describe(rec,run);assert.equal(view.teams[1].record,'8-4-1');assert.equal(view.venue,'Home Arena');
  assert.equal(JSON.stringify({rec,run}),before);
  for(const change of [{eventId:'other'},{startTime:'2026-11-09T03:00:00Z'},{sport:'NBA'}]){
    const altered=clone(run);Object.assign(altered.gameIntelligence.games[0],change);assert.deepEqual(insights.describe(rec,altered).teams,[]);
  }
  assert.equal(insights.describe(rec,{...run,gameIntelligence:{asOf:'2026-11-08T03:00:00Z',games:[game]}}).teams.length,0);
  assert.equal(insights.describe(rec,{...run,gameIntelligence:{games:[game,game]}}).teams.length,0,'ambiguous duplicate event cannot supply context');
  assert.equal(insights.describe({...rec,feed:{...rec.feed,selectionKey:'other|ml|home||'}},run).teams.length,0);
});
test('form preserves source results, excludes future games, and does not turn projections or empty lists into clearance',()=>{
  const {rec,run}=fixture(),view=insights.describe(rec,run),home=view.teams[1];
  assert.equal(home.form,'1W–1L in last 2 recorded');assert.match(home.lastGame,/L vs Recent Opponent · 3-2 OT/);
  assert.equal(home.rest,'Played the previous day');assert.equal(home.goalie.status,'Projected');assert.deepEqual(home.injuries,[]);
  assert.equal(view.teams[0].injuries[0].name,'Named Forward');
  run.gameIntelligence.games[0].facts.push({...run.gameIntelligence.games[0].facts[1],observedAt:'2026-11-07T18:00:00Z',details:{team:'Home',records:[{type:'total',summary:'99-0'}]}});
  assert.equal(insights.describe(rec,run).teams[1].record,'8-4-1','later facts cannot rewrite the report snapshot');
  run.gameIntelligence.games[0].facts.find(x=>x.kind==='STARTING_GOALIE').details.status='UNRESOLVED';
  assert.equal(insights.describe(rec,run).teams[1].goalie.status,'Unconfirmed');
});
test('published views retain the exact eligible side, market, line and price rather than an opposing probability',()=>{
  const {rec,run}=fixture();assert.equal(insights.describe(rec,run).views[0].probability,.58);
  for(const change of [{side:'away'},{marketDetail:'full_game_primary_total'},{line:1.5},{period:'REGULATION'},
    {eligibility:'CONTEXT_ONLY'},{eventId:'other'},{startTime:'2026-11-09T03:00:00Z'},{observedAt:'2026-11-07T18:00:00Z'}]){
    const altered=clone(rec);Object.assign(altered.forecastReview.records[0],change);assert.equal(insights.describe(altered,run).views.length,0);
  }
  const altered=clone(rec);altered.forecastReview.records[0].comparison.priceDecimal=3;assert.equal(insights.describe(altered,run).views.length,0);
  altered.forecastReview.records[0].comparison.priceDecimal=2;altered.forecastReview.eligibleExactRecordIds=[];assert.equal(insights.describe(altered,run).views.length,0);
  const sourceLed=clone(rec);sourceLed.marketAssessment={basis:'SOURCE_LED_OPINION'};
  sourceLed.pinnacleBenchmark={state:'QUALIFIED',selectionKey:rec.feed.selectionKey,eventId:'game',marketKey:'ml',noVigProbability:.48};
  assert.ok(Math.abs(insights.describe(sourceLed,run).benchmark+2)<1e-8,'source-led opinions retain their signed contrary Pinnacle reference');
  sourceLed.pinnacleBenchmark.selectionKey='other|ml|home||';assert.equal(insights.describe(sourceLed,run).benchmark,null);
});
class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this._text='';}
  set textContent(x){this._text=String(x);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join(' ');}
  append(...nodes){this.children.push(...nodes);}appendChild(node){this.children.push(node);return node;}setAttribute(k,v){this.attributes[k]=v;}
}
const document={createElement:t=>new Element(t)};
test('away spread insights use the selected handicap rather than the home-oriented feed line',()=>{
  const {rec,run}=fixture(),detail='full_game_primary_puck_line';
  Object.assign(rec.feed,{marketKey:'spread',side:'away',line:1.5,selectionKey:'game|spread|away||1.5'});
  rec.coreAssessment.context.marketDetail=detail;
  Object.assign(rec.forecastReview.records[0],{side:'away',line:-1.5,marketDetail:detail,sourceId:'dimers',publisher:'Dimers'});
  const before=JSON.stringify({rec,run}),view=insights.describe(rec,run);
  assert.equal(view.views.length,1);assert.equal(view.views[0].probability,.58);
  assert.match(insights.render(document,rec,run).textContent,/Dimers: 58.0%/);
  assert.equal(JSON.stringify({rec,run}),before);
  rec.forecastReview.records[0].line=1.5;
  assert.equal(insights.describe(rec,run).views.length,0,'opposing handicap cannot supply this insight');
});
test('integer-contract insights preserve the issued push-adjusted break-even comparison',()=>{
  const {rec,run}=fixture(),model=rec.forecastReview.records[0],detail='full_game_primary_total';
  Object.assign(rec.feed,{marketKey:'totals',side:'over',line:6,selectionKey:'game|totals|over||6'});
  rec.coreAssessment.context.marketDetail=detail;
  Object.assign(model,{side:'over',line:6,marketDetail:detail,sourceId:'dimers',publisher:'Dimers',probability:.49,probabilityBasis:'UNCONDITIONAL'});
  model.comparison={priceDecimal:2,probabilityBasis:'UNCONDITIONAL',breakEvenProbability:.46,edgeProbabilityPoints:3,evPerUnit:.06};
  const before=JSON.stringify({rec,run}),view=insights.describe(rec,run);
  assert.equal(view.views.length,1);assert.equal(view.views[0].breakEven,.46);
  assert.match(insights.render(document,rec,run).textContent,/46.0% to break even.*refunded pushes/);
  assert.equal(JSON.stringify({rec,run}),before);
  for(const change of [c=>c.edgeProbabilityPoints=4,c=>c.evPerUnit=.1,c=>c.breakEvenProbability=.8,c=>c.probabilityBasis='CONDITIONAL_ON_NO_PUSH']){
    const altered=clone(rec);change(altered.forecastReview.records[0].comparison);assert.equal(insights.describe(altered,run).views.length,0);
  }
});
test('expanded analysis leads with four betting questions and keeps generic team statistics out of the brief',()=>{
  const {rec,run}=fixture(),before=JSON.stringify({rec,run});const node=insights.render(document,rec,run),text=node.textContent;
  for(const question of ['WHY THIS PLAY TONIGHT?','WHY THIS PRICE?','STRONGEST CONCERN','ACT NOW OR WAIT?'])assert.ok(text.includes(question));
  assert.doesNotMatch(text,/8-4-1|Named Forward|Named Goalie/);
  assert.match(text,/MoneyPuck: 58.0%/);assert.match(text,/Lean only; no stake is recommended/);assert.match(text,/SOURCES & SNAPSHOT/);
  assert.equal(text.match(/Confirm Home starter before reassessing at \+100\./g).length,1);
  assert.doesNotMatch(text,/WRONG_MARKET_OR_SIDE|No injuries|No entries supplied|RECORDED DECISION|JSON/);
  assert.equal(JSON.stringify({rec,run}),before);assert.equal(rec.status,'LEAN');assert.equal(rec.stake,'$0');
  assert.match(insights.render(document,{status:'PASS',analysis:'A specific earlier decision.'},{ts:run.ts}).textContent,/A specific earlier decision/);
});
test('a source-bound contrary finding becomes the concern while a named recheck remains the action',()=>{
  const {rec,run}=fixture();rec.cardEvidence.selectionKey=rec.feed.selectionKey;
  rec.sourceEvidence=[{id:'lineup',title:'Team update',url:'https://www.nhl.com/news',checkedAt:'2026-11-07T16:00:00Z'}];
  rec.cardEvidence.decisionExplanation='Home creates more high-danger chances against this depleted defence.';
  rec.cardEvidence.findings.push({stance:'CONTRARY',sourceIds:['lineup'],finding:'Home is playing its third game in four nights.',application:'Fatigue could weaken the late-game advantage.'});
  const view=insights.brief(rec,run);
  assert.match(view.whyTonight,/high-danger/);assert.match(view.risk,/third game in four nights/);assert.match(view.timing,/Confirm Home starter/);
  rec.cardEvidence.selectionKey='other|ml|home||';assert.doesNotMatch(insights.brief(rec,run).risk,/third game in four nights/);
});
test('legacy price boilerplate is not repeated as the strongest game concern',()=>{
  const {rec,run}=fixture();rec.status='PASS';delete rec.forecastLean;
  rec.marketAssessment={basis:'QUALIFIED_PINNACLE',selectionKey:rec.feed.selectionKey,referenceProbability:.48,
    decisionRationale:'Home at +100 is unfavorable to the exact paired Pinnacle benchmark.'};
  rec.contrary='The exact executable-to-benchmark difference was unfavorable. Used only for a zero-stake exact-price assessment.';
  const view=insights.brief(rec,run);assert.match(view.whyTonight,/Pass: the available odds/);
  assert.match(view.risk,/Confirm Home starter/);assert.doesNotMatch(view.risk,/zero-stake|executable-to-benchmark/);
  assert.equal(view.timing,'Pass at this price.');
});
test('both shared runner entry points load the insights before the common card renderer',()=>{
  for(const name of ['runner.html','runner-app.html']){const html=fs.readFileSync(name,'utf8');assert.ok(html.indexOf('assets/card-insights.js')<html.indexOf('assets/runner-core-runtime.js'));}
  const runtime=fs.readFileSync('assets/runner-core-runtime.js','utf8');assert.match(runtime,/CardInsights\.render\(d,r,activeRun\)/);
  assert.doesNotMatch(runtime,/const notes=el\(d,'div','runnerCardNotes'\)/);assert.match(runtime,/ORIGINAL REPORT & SOURCES/);
});
