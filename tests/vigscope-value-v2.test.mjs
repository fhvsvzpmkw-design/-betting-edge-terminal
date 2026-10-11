import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import A from '../assets/value-analytics.js';
import GuyValue from '../assets/guy-value.js';
import O from '../assets/odds-format.js';
import {buildComparison} from '../tools/build-graham-pinnacle-value.mjs';

const base={date:'2026-10-02',runId:'2026-10-02T15:00:00Z',sport:'NFL',status:'LEAN',slot:'main',market:'ML-HT',completionState:'complete',analysisPrice:{state:'exact',decimal:2.15,american:115}};
const cards=[
 {...base,cardId:'win',selectionKey:'home',grade:'WIN',units:1.15,title:'Home',issuedPriceText:'2.15'},
 {...base,cardId:'loss',selectionKey:'away',grade:'LOSS',units:-1,title:'Away',issuedPriceText:'-110'},
 {...base,cardId:'push',selectionKey:'push',grade:'PUSH',units:0,title:'Push'},
 {...base,cardId:'missing',selectionKey:'missing',grade:'WIN',units:null,analysisPrice:{state:'unavailable'},title:'Missing'},
 {...base,cardId:'open',selectionKey:'open',completionState:'unresolved',grade:null,units:100,unresolvedReason:'awaiting_observation',title:'Open'}
];
const summary=A.summary(cards);
assert.equal(summary.complete,4);assert.equal(summary.unresolved,1);assert.equal(summary.priced,3);
assert.ok(Math.abs(summary.netUnits-.15)<1e-8);assert.ok(Math.abs(summary.roiPct-5)<1e-8);
assert.ok(Math.abs(summary.winPct-200/3)<1e-8);assert.equal(A.units(cards[4]),null);
assert.equal(A.summary([cards[4]]).roiPct,null);
const earlier={...cards[0],cardId:'old',status:'WAIT',runId:'2026-10-02T13:00:00Z'};
assert.equal(A.finalRows([cards[0],earlier]).find(c=>c.selectionKey==='home').status,'LEAN');
assert.equal(A.filterRows([earlier,...cards],{status:'WAIT'}).length,1);
assert.equal(A.curve(cards).drawdown,1);

const start='2026-09-10T00:00:00Z',snapshot={sequence:1,type:'DAILY',pinnacleStatus:'AVAILABLE',pinnacleObservedAt:'2026-09-09T20:00:00Z',grahamAsOf:'2026-09-09T20:00:00Z',grahamFairHome:-4,pinnacleSpreadHome:-3};
const game={gameKey:'test',away:'A',home:'H',startTimePacific:start,dailySnapshots:[snapshot,{...snapshot,sequence:2,pinnacleObservedAt:'2026-09-10T01:00:00Z',grahamFairHome:20}]};
const ledger={path:'ledger.json',data:{season:2026,week:1,games:[game]}};
const fact={path:'facts.json',data:{verifiedAt:'2026-09-11T00:00:00Z',weeks:[{games:[{gameKey:'test',away:'A',home:'H',startTimePacific:start,state:'FINAL',awayScore:10,homeScore:14}]}]}};
let comparison=buildComparison([ledger],[fact]);
assert.equal(comparison.rows[0].valueSide,'home');assert.equal(comparison.rows[0].snapshotSequence,1);
assert.equal(comparison.strategies.graham.grades.WIN,1);assert.equal(comparison.strategies.dogs.grades.LOSS,1);
const tie=structuredClone(ledger);tie.data.games[0].dailySnapshots[0].grahamFairHome=-3;
assert.equal(buildComparison([tie],[fact]).coverage.sameLines,1);
assert.equal(buildComparison([tie],[fact]).strategies.graham.grades.WIN,1,'identical lines still contribute a result');
const wrong=structuredClone(fact);wrong.data.weeks[0].games[0].home='Other';
assert.equal(buildComparison([ledger],[wrong]).coverage.settled,0);
assert.equal(buildComparison([ledger],[fact,wrong]).coverage.settled,0,'conflicting score receipts are not graded');
const real=JSON.parse(fs.readFileSync(new URL('../data/history/graham-pinnacle-value.json',import.meta.url)));
const firstThree=real.rows.filter(r=>r.season===2026&&r.week<=3);
assert.equal(firstThree.length,48);
for(const [strategy,w,l,p]of [['graham',25,20,3],['favorites',22,23,3],['dogs',23,22,3]]){
 const g=A.summary(A.strategyRows(firstThree,strategy)).grades;assert.deepEqual([g.WIN,g.LOSS,g.PUSH],[w,l,p]);
}
assert.equal(firstThree.filter(r=>r.quoteKind==='RECORDED_CLOSE').length,0);

const engine={innerHTML:'',dataset:{},classList:{add(){}},querySelectorAll:()=>[],querySelector:()=>null};
const doc={getElementById:id=>id==='engine'?engine:id==='runnerResultsDeskStyle'?{}:null,head:{appendChild(){}},createElement:()=>({})};
const context={VigScopeValueAnalytics:A,VigScopeOddsFormat:O,GuyValue,document:doc,window:{addEventListener(){}},setInterval(){},clearInterval(){},Intl,Date,console,localStorage:{getItem:()=>null}};
vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../assets/results-value-desk-v2.js',import.meta.url),'utf8'),context);
const index={cards,coverage:{cards:5,selections:5,completeCards:4,unresolvedCards:1},issuedBetAnalytics:{netCad:12,roiPct:25,pricedBets:2},decisionValueShadowV2:{byStatus:[{status:'LEAN',shadowRoiPct:25,priced:2,grades:{WIN:1,LOSS:1}}]}};
const before=JSON.stringify(index);const desk=context.VigScopeValueDesk;
desk.setComparison(real);desk.setGuyRecord({schema:1,characterId:'guy-laflame',startedAt:'2026-10-07T00:50:00Z',entries:[]});desk.render(doc,index);
const displayedGraham=A.summary(A.strategyRows(real.rows,'graham')).grades;
assert.ok(engine.innerHTML.includes(`${displayedGraham.WIN}–${displayedGraham.LOSS}–${displayedGraham.PUSH}`),'display reflects the current saved ATS population');
assert.match(engine.innerHTML,/LATEST SAVED PRE-KICKOFF QUOTES/);
assert.match(engine.innerHTML,/awaiting_observation/);assert.match(engine.innerHTML,/First-half moneyline/);
assert.match(engine.innerHTML,/American|AMERICAN/);assert.doesNotMatch(engine.innerHTML,/resultsTitle/);
assert.match(engine.innerHTML,/\+115/);assert.doesNotMatch(engine.innerHTML,/>2\.15</);
assert.ok(engine.innerHTML.indexOf('PIZZA PLAYS')<engine.innerHTML.indexOf('GRAHAM × PINNACLE'));
assert.match(engine.innerHTML,/GUY’S BLUE LINE \/\/ MONEYPUCK VALUE/);assert.match(engine.innerHTML,/New record — collecting results/);
assert.ok(engine.innerHTML.indexOf('GRAHAM × PINNACLE')<engine.innerHTML.indexOf('GUY’S BLUE LINE'));
const completedWeek=Math.max(...real.rows.filter(r=>real.rows.filter(g=>g.week===r.week).every(g=>g.resultState==='FINAL')).map(r=>r.week));
assert.equal(desk.grahamLedgerWeek(real).week,String(completedWeek));
assert.equal(desk.grahamLedgerWeek({rows:[{week:1,resultState:'FINAL'},{week:2,resultState:'FINAL'},{week:2,resultState:'PENDING'}]}).week,'1','partly settled weeks do not become the completed default');
assert.equal(desk.grahamLedgerWeek({rows:[{week:1,resultState:'PENDING'}]}).completed,false);
assert.equal(desk.grahamLedgerWeek({rows:[]}).week,'ALL');
assert.doesNotMatch(engine.innerHTML,/<details[^>]*id="grahamGameLog"[^>]*\sopen(?:\s|>)/,'ledger starts collapsed');
assert.match(engine.innerHTML,new RegExp(`Game-by-game ledger • Week ${completedWeek}`));
const historical=engine.innerHTML.split('HISTORICAL PERFORMANCE // SELECTED SAMPLE')[1].split('MARKET PERFORMANCE // ROI')[0];
assert.doesNotMatch(historical,/<svg/);assert.match(historical,/WEEK BY WEEK/);
const weekly=desk.historyWeeks(cards);
assert.equal(weekly[0].name,'2026-09-28');
assert.equal(weekly.reduce((n,w)=>n+w.priced,0),summary.priced);
assert.equal(weekly.reduce((n,w)=>n+w.unresolved,0),summary.unresolved);
assert.equal(weekly.reduce((n,w)=>n+w.netUnits,0),summary.netUnits,'weekly results reconcile to the full selected sample');
assert.equal(desk.historyWeeks([{...cards[0],date:'2026-10-04'},{...cards[1],date:'2026-10-05'}]).length,2,'Pacific Sunday and Monday belong to different report weeks');
desk.state.gLogWeek='1';desk.state.gWeek='2';desk.render(doc,index);
const gameLog=engine.innerHTML.split('id="grahamGameLog"')[1].split('</section>')[0];
assert.match(gameLog,/W1 •/);assert.doesNotMatch(gameLog,/W2 •/,'ledger week is independent of the comparison week');
desk.state.gLogWeek='LATEST';desk.state.gWeek='ALL';
desk.state.grade='OPEN';assert.equal(desk.cardLogRows(index).length,1);
desk.state.grade='ALL';desk.state.status='LEAN';assert.equal(desk.cardLogRows(index).length,5);
assert.equal(JSON.stringify(index),before,'display and filtering preserve archive inputs');
console.log('VIGSCOPE VALUE V2: PASS // graded samples, pending exclusions, fair sign, identical lines, no lookahead, source identity, 48-game regression, American display and archive');
