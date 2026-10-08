import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/runner-core-runtime.js','utf8');
const instrumented=source.replace('\nactiveRun=payload();','\nglobalThis.picksApi={recSport,runSports,filteredPicks,pickEdge,pickMeta,pickReason,pickMarket,pickCounts,pickMovement,compareRunPicks,fetchPriorChangeRun,setFilters:(status,sport,market="ALL",book="ALL",search="",sort="CALL")=>{statusFilter=status;sportFilter=sport;marketFilter=market;bookFilter=book;pickSearch=search;pickSort=sort}};\nactiveRun=payload();');
const archive=JSON.parse(fs.readFileSync('run-history.json','utf8'));
const reads=[];
const context={console,Intl,Date,URLSearchParams,TextDecoder,TextEncoder,Uint8Array,
  document:{querySelector:()=>({addEventListener(){}})},location:{hash:''},
  localStorage:{getItem:()=>null},
  fetch:async url=>{reads.push(url);return{ok:true,json:async()=>url.startsWith('./run-history.json')?archive:JSON.parse(fs.readFileSync(url.split('?')[0].replace(/^\.\//,''),'utf8'))}},
};
vm.runInNewContext(instrumented,context);const api=context.picksApi;
const rec=(sport,eventId,marketKey,side,line,status='PASS',price='-110',book='Bet365')=>({title:`${sport} ${eventId} ${side}${line===null?'':' '+line}`,status,price,book,
  meta:`${sport} | Away @ Home | 2026-10-02T00:00:00Z`,
  coreAssessment:{context:{sport,marketDetail:marketKey}},
  feed:{eventId,marketKey,side,line,selectionKey:`${eventId}|${marketKey}|${side}||${line??''}`,eventDate:'2026-10-02T00:00:00Z'}});
const nfl=rec('NFL','1','spread','home',3,'LEAN'),nhl=rec('NHL','2','ml','home',null,'BET'),other=rec('NFL','1','spread','away',3);
const mixed={recs:[other,nfl,nhl]};
assert.equal(api.filteredPicks({recs:[{...nhl,edge:'-2.528 probability points'},{...nfl,edge:'+1.25 pp'},{...other,edge:'UNKNOWN'}]}).map(r=>r.status).join(','),'BET,LEAN,PASS','initial view prioritizes calls ahead of signed edge');
api.setFilters('LEAN','NFL');assert.equal(api.filteredPicks(mixed).length,1);assert.equal(api.filteredPicks(mixed)[0].status,'LEAN');
api.setFilters('BET','NFL');assert.equal(api.filteredPicks(mixed).length,0,'sport and status intersect, including honest empty views');
api.setFilters('ALL','ALL','ALL','ALL','','CALL');assert.equal(api.filteredPicks(mixed).map(r=>r.status).join(','),'BET,LEAN,PASS');
const callRanked={recs:[
 {...other,title:'pass-high',edge:'+99 pp'},
 {...nfl,title:'lean-low',edge:'-1 pp'},
 {...nhl,title:'bet-missing',edge:'UNKNOWN'},
 {...nhl,title:'bet-low',edge:'-2 pp'},
 {...nhl,title:'bet-high',edge:'+2 pp'},
 {...nhl,title:'bet-tie',edge:'+2 pp'},
 {...nfl,title:'lean-high',edge:'+4 pp'},
 {...nfl,title:'lean-missing',edge:'UNKNOWN'},
 {...other,status:'WAIT',title:'wait-low',edge:'-1 pp'},
 {...other,status:'WAIT',title:'wait-high',edge:'+3 pp'},
 {...other,status:'WAIT',title:'wait-missing',edge:'UNKNOWN'},
 {...other,title:'pass-low',edge:'-2 pp'},
 {...other,title:'pass-missing',edge:'UNKNOWN'}
]},callBefore=JSON.stringify(callRanked);
assert.equal(api.filteredPicks(callRanked).map(r=>r.title).join(','),'bet-high,bet-tie,bet-low,bet-missing,lean-high,lean-low,lean-missing,wait-high,wait-low,wait-missing,pass-high,pass-low,pass-missing','Call Priority groups calls first, then signed descending edge, keeping equal edges stable and unknown edges last within their group');
assert.equal(JSON.stringify(callRanked),callBefore,'combined ordering cannot mutate issued records');
assert.equal(mixed.recs[0].status,'PASS','view ordering must not reorder report data');
assert.equal(api.runSports(mixed).join(','),'NFL,NHL');
assert.equal(api.recSport({feed:{sportKey:'icehockey_nhl'}}),'NHL');
assert.equal(api.recSport({meta:'WNBA | Away @ Home'}),'WNBA');
const picks={recs:[nfl,{...nhl,book:'DraftKings'},other,rec('MLB','3','spread','away',1.5,'WAIT')]},unchanged=JSON.stringify(picks);
assert.equal(api.pickMarket(picks.recs[3]),'RUN');
assert.equal(api.pickMarket(rec('NHL','4','spread','home',-1.5)),'PUCK');
assert.equal(api.pickMarket(rec('NFL','5','totals','under',42.5)),'TOTAL');
api.setFilters('LEAN','NFL','SPREAD','Bet365','Away @ Home');
assert.equal(api.filteredPicks(picks).length,1,'all five filters intersect');
assert.equal(api.pickCounts(picks).ALL,2,'call counts include all statuses matching the other filters');
assert.equal(api.pickCounts(picks).PASS,1);
assert.equal(api.pickCounts(picks).BET,0,'zero call counts remain visible');
api.setFilters('ALL','ALL','ML','DraftKings');assert.equal(api.filteredPicks(picks)[0].status,'BET');
api.setFilters('ALL','ALL','ALL','ALL','no such team');assert.equal(api.filteredPicks(picks).length,0);
api.setFilters('ALL','ALL');assert.equal(api.filteredPicks(picks).length,4,'clearing all filters restores the full list');
const ranked={recs:[{...nfl,edge:'-2.528 probability points',feed:{...nfl.feed,eventDate:'2026-10-02T04:00:00Z'},move:'NEW SELECTION — current -110'},
 {...nhl,edge:'+1.25 pp',feed:{...nhl.feed,eventDate:'2026-10-02T02:00:00Z'},move:'Bet365 -110 → -120'},
 {...other,edge:'UNKNOWN',feed:{...other.feed,eventDate:''},meta:'NFL | Away @ Home',move:'Price worsened'}]};
api.setFilters('ALL','ALL','ALL','ALL','','EDGE');assert.equal(api.filteredPicks(ranked)[0].edge,'+1.25 pp');assert.equal(api.filteredPicks(ranked).at(-1).edge,'UNKNOWN');
const forecastPick=(probability,priceDecimal)=>({...nhl,status:'LEAN',edge:`MoneyPuck published ${(probability*100).toFixed(2)}% for this exact selection. This is a forecast point, not an independently established fair or profit estimate.`,feed:{...nhl.feed,priceDecimal},forecastLean:{schema:1,basis:'REVIEWED_FORECAST_POINT',selectionKey:nhl.feed.selectionKey,probability}});
const forecast=forecastPick(0.4457965615899814,2.5),lowerGap=forecastPick(0.9,1.1);
assert.ok(Math.abs(api.pickEdge(forecast)-4.57965615899814)<1e-10,'forecast ordering uses the full stored probability and exact quote');
assert.ok(api.pickEdge(lowerGap)<0,'a high win probability alone is not a positive edge');
const forecastRanked={recs:[{...other,edge:'-2.528 probability points'},lowerGap,{...nfl,status:'PASS',edge:'+0.798 pp'},forecast]},forecastBefore=JSON.stringify(forecastRanked);
assert.equal(api.filteredPicks(forecastRanked).map(api.pickEdge).map(v=>v.toFixed(3)).join(','),'4.580,0.798,-0.909,-2.528','forecast and market gaps share a signed descending order');
assert.ok(api.pickEdge(forecastPick(0.4457965615899814,3))>api.pickEdge(forecast),'the same forecast ranks higher at a better quote');
for(const probability of [null,undefined,NaN,Infinity,0,1,-0.1,1.1,'0.4458'])assert.equal(api.pickEdge(forecastPick(probability,2.5)),null,'invalid forecasts remain unranked');
for(const priceDecimal of [null,undefined,NaN,Infinity,0,1,''])assert.equal(api.pickEdge(forecastPick(0.4458,priceDecimal)),null,'missing or invalid quotes cannot create an edge');
assert.equal(api.pickEdge({...forecast,forecastLean:{...forecast.forecastLean,selectionKey:'wrong-side'}}),null,'forecast must bind to this exact selection');
assert.equal(api.pickEdge({...forecast,forecastLean:{...forecast.forecastLean,selectionKey:''},feed:{...forecast.feed,selectionKey:''}}),null,'empty identities cannot bind a forecast');
assert.equal(api.pickEdge({...forecast,forecastLean:{...forecast.forecastLean,schema:2}}),null,'unknown forecast schemas remain unranked');
assert.equal(api.pickEdge({...forecast,edge:'not a percentage'}),api.pickEdge(forecast),'narrative wording cannot change a structured forecast gap');
assert.equal(api.filteredPicks({...forecastRanked,recs:[...forecastRanked.recs,{...other,edge:'UNKNOWN'}]}).at(-1).edge,'UNKNOWN','unranked cards remain below measured negative edges');
assert.equal(JSON.stringify(forecastRanked),forecastBefore,'forecast sorting preserves issued probabilities, quotes, calls and all report data');
const reported=JSON.parse(fs.readFileSync('data/history/runs/2026-10-08/final_morning-094758.json','utf8')),reportedBefore=JSON.stringify(reported),reportedLeans=reported.recs.filter(r=>r.status==='LEAN');
assert.equal(reportedLeans.length,6,'regression reproduces the reported six-LEAN snapshot');
assert.ok(reportedLeans.every(r=>Number.isFinite(api.pickEdge(r))&&api.pickEdge(r)>0),'all six reviewed forecast leans have a measured positive gap');
const ordered=api.filteredPicks(reported);
assert.equal(ordered.slice(0,2).map(r=>r.title).join(','),'Philadelphia Flyers,San Jose Sharks','forecast leans outrank the smaller PASS gaps in the actual issued report');
assert.ok(ordered.filter(r=>api.pickEdge(r)<0).every(r=>ordered.indexOf(r)>Math.max(...reportedLeans.map(lean=>ordered.indexOf(lean)))),'positive forecast leans precede every negative edge');
assert.equal(JSON.stringify(reported),reportedBefore,'the issued regression snapshot remains unchanged');
api.setFilters('ALL','ALL','ALL','ALL','','CALL');
assert.equal(api.filteredPicks(reported).slice(0,6).map(r=>r.status).join(','),'LEAN,LEAN,LEAN,LEAN,LEAN,LEAN','Call Priority keeps all six LEAN calls above PASS');
assert.equal(api.filteredPicks(reported).slice(0,6).map(r=>r.title).join(','),'Philadelphia Flyers,San Jose Sharks,Carolina Hurricanes,Montreal Canadiens,Chicago White Sox,Colorado Avalanche','Call Priority ranks forecast leans by highest edge within the LEAN group');
assert.equal(JSON.stringify(reported),reportedBefore,'combined call and edge sorting preserves the issued snapshot');
api.setFilters('ALL','ALL','ALL','ALL','','START');assert.equal(api.filteredPicks(ranked)[0].status,'BET');assert.equal(api.filteredPicks(ranked).at(-1).edge,'UNKNOWN');
api.setFilters('ALL','ALL','ALL','ALL','','MOVE');assert.equal(api.filteredPicks(ranked)[0].move,'Bet365 -110 → -120');
assert.equal(api.pickMovement(ranked.recs[0]),null,'a first snapshot is not measured movement');
assert.equal(api.pickMovement(ranked.recs[2]),null,'qualitative movement receives no invented magnitude');
assert.equal(JSON.stringify(picks),unchanged,'filters and sorting leave issued report records untouched');
api.setFilters('ALL','ALL');
assert.match(api.pickMeta(nfl),/Oct 1.*5:00.*PT/,'UTC kickoff is displayed in Pacific time');
assert.equal(api.pickReason({analysis:'Edge is 2.16 probability points. Full personnel review follows.'}),'Edge is 2.16 probability points.','decimal points must not truncate the reason');
const prior={recs:[nfl,nhl,other]},saved=JSON.stringify(prior);
const current={recs:[{...nfl,status:'BET',price:'-120'},nhl,other]};
let changes=api.compareRunPicks(current,prior);
assert.equal(changes.length,1);assert.match(changes[0].labels.join(' '),/LEAN → BET/);assert.match(changes[0].labels.join(' '),/PRICE: -110 → -120/);
assert.equal(api.compareRunPicks(current,prior,'NHL').length,0,'changes follow the selected sport');
assert.equal(JSON.stringify(prior),saved,'comparison must preserve historical report data');
changes=api.compareRunPicks({recs:[{...nfl,price:'-111'}]},prior);
assert.equal(changes.length,0,'tiny price noise below half a probability point stays out of the highlight list');
changes=api.compareRunPicks({recs:[{...nfl,book:'DraftKings',price:'-150'}]},prior);
assert.match(changes[0].labels.join(' '),/BOOK:/);assert.doesNotMatch(changes[0].labels.join(' '),/PRICE:/,'a book switch is not same-book movement');
const total=rec('NHL','2','totals','over',5.5,'WAIT');
changes=api.compareRunPicks({recs:[rec('NHL','2','totals','over',6.5,'WAIT','+120')]},{recs:[total]});
assert.equal(changes[0].newSelection,false,'line changes retain logical side identity');assert.match(changes[0].labels.join(' '),/LINE CHANGED/);assert.doesNotMatch(changes[0].labels.join(' '),/PRICE:/,'prices on different lines are not compared');
changes=api.compareRunPicks({recs:[rec('NHL','2','totals','under',5.5)]},{recs:[total]});
assert.equal(changes[0].newSelection,true,'opposite sides must not be matched');
assert.equal(api.compareRunPicks({recs:[nfl]},{recs:[nfl,{...nfl,price:'-115'}]}).length,0,'ambiguous duplicate identities cannot produce a claimed change');
assert.equal(api.compareRunPicks({recs:[{title:'unbound',status:'BET'}]},prior).length,0,'unbound titles are not enough to claim a new selection');
const run=JSON.parse(fs.readFileSync('data/history/runs/2026-10-01/final_morning-094212.json','utf8'));
const previous=await api.fetchPriorChangeRun(run);assert.equal(previous.ts,'2026-10-01T08:12:30-07:00');
assert.match(reads.at(-1),/main-081230/,'compare against the newest earlier issued report');
assert.equal(await api.fetchPriorChangeRun({...run,ts:'2026-10-01T06:26:00-07:00',slot:'open'}),null,'first daily report does not compare against yesterday');
console.log('Published-pick filters and report comparison: PASS');
