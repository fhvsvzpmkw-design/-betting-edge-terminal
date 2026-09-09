#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {matchNflFixture,extractPinnacleHomeSpread} from '../tools/graham-market-utils.mjs';
import {selectCompletedResearchReview} from '../tools/graham-research-review.mjs';
import {
  buildResearchLedgerCadenceProjection,
  loadGrahamScheduleAuthority,
  validateGrahamResearchLedgerScheduleMetadata
} from '../tools/graham-schedule-authority.mjs';

const numbers=JSON.parse(fs.readFileSync('data/walters/nfl/2026/week-01-current-numbers.json','utf8'));
const research=JSON.parse(fs.readFileSync('data/walters/nfl/2026/week-01-research-ledger.json','utf8'));
const authority=loadGrahamScheduleAuthority();
const hotline=fs.readFileSync('syndicates/generated/graham-mercer/hotline.html','utf8');
const builder=fs.readFileSync('tools/build-graham-current-week.mjs','utf8');
const capture=fs.readFileSync('tools/capture-graham-daily-pinnacle.mjs','utf8');
const observer=fs.readFileSync('tools/oddspapi-observer.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/graham-terminal-refresh.yml','utf8');

assert.equal(numbers.games.length,16,'Week 1 current-number board must contain 16 games');
assert.equal(new Set(numbers.games.map(g=>g.gameKey)).size,16,'Week 1 game keys must be unique');
assert.equal(numbers.rules.marketIsolation.includes('before viewing'),true,'current-number state must enforce market isolation');
assert.equal(research.policy.appendOnly,true,'research ledger must be append-only');
assert.deepEqual(research.scheduledCadence,buildResearchLedgerCadenceProjection(authority),'research ledger cadence must be generated from controlled Graham schedule authority');
assert.equal(validateGrahamResearchLedgerScheduleMetadata(research,authority),true,'research ledger schedule metadata must match controlled authority');
assert.match(hotline,/current-week-terminal\.json/,'Hotline must load the current-week terminal feed');
assert.match(hotline,/setInterval\(load,60000\)/,'Hotline must refresh the feed without rewriting the page');
assert.match(builder,/function numeric\(v\)\{if\(v===null\|\|v===undefined\|\|v===''/,'builder must not coerce pending nulls to zero');
assert.match(builder,/marketObservedAt:marketStatus==='ok'\?/,'failed market observations must not advertise a successful observation timestamp');
assert.doesNotMatch(capture,/reportTime!=='15:15'/,'manual and other scheduled odds pulls must not be excluded from daily capture');
assert.match(observer,/bookmakerOutcomeId:q\?\.bookmakerOutcomeId/,'OddsPapi observer must preserve bookmaker outcome handles for spread parsing');
assert.doesNotMatch(workflow,/oddspapi\.io|odds-api\.io|fetch\(/i,'Graham post-processing workflow must not call an external odds API');
assert.match(workflow,/capture-graham-daily-pinnacle\.mjs/);
assert.match(workflow,/build-graham-current-week\.mjs/);
assert.match(workflow,/data\/walters\/nfl\/20\*\/week-\*-research-runtime\/\*\.json/,'completed runtime writes must refresh INFO even when fair numbers are unchanged');
assert.match(builder,/lastResearchAt:researchReview\?\.completedAt\|\|null/,'INFO must use completed research rather than the number-board timestamp');

const reviewActive={season:2026,week:1,paths:{researchLedger:'data/walters/nfl/2026/week-01-research-ledger.json'}};
const reviewSweep={runEventId:'graham-daily-review-2026-w01-20260907T113228-0700',sourceTaskKey:'DAILY_REVIEW',
  startedAt:'2026-09-07T11:32:28-07:00',completedAt:'2026-09-07T11:38:53-07:00',
  completionResult:'NO_MATERIAL_CHANGE',summary:{marketViewed:false},scope:'DEN-KC review; remaining games retain their prior coverage.'};
const reviewEvent={schema:1,policyId:'graham-research-runtime-v1',state:'COMPLETED',checkpoint:'COMPLETED',
  runEventId:reviewSweep.runEventId,taskKey:'DAILY_REVIEW',season:2026,week:1,ledgerPath:reviewActive.paths.researchLedger,
  ledgerSweepPresent:true,failure:null,marketViewed:false,completionResult:reviewSweep.completionResult,
  startedAt:reviewSweep.startedAt,completedAt:'2026-09-07T11:43:42-07:00',completionReceipt:{
    state:'VERIFIED',policyId:'graham-research-completion-v1',path:'data/walters/nfl/research-completion-current.json',
    runEventId:reviewSweep.runEventId,taskKey:'DAILY_REVIEW',season:2026,week:1,marketViewed:false,
    completionResult:reviewSweep.completionResult,verifiedAt:'2026-09-07T18:43:12.957Z',
    ledgerBlobSha:'a'.repeat(40),receiptBlobSha:'b'.repeat(40)}};
const reviewLedger={state:'ACTIVE',season:2026,week:1,sweeps:[reviewSweep]};
const selectReview=(events,ledger=reviewLedger,active=reviewActive)=>selectCompletedResearchReview({active,ledger,events});
const completedReview=selectReview([reviewEvent]);
assert.equal(completedReview.completedAt,reviewSweep.completedAt,'a no-change review advances INFO to its research cutoff, not publication time');
assert.equal(completedReview.scope,reviewSweep.scope,'retain limited review coverage without implying every game was re-reviewed');
for(const [label,mutate] of [
  ['started',event=>{event.state='RUN_STARTED';event.checkpoint='COMPLETION_PENDING';event.completionReceipt=null;}],
  ['blocked',event=>{event.state='BLOCKED_WITH_DURABLE_RECORD';}],
  ['blocked completion',event=>{event.completionResult='BLOCKED_WITH_DURABLE_RECORD';event.completionReceipt.completionResult=event.completionResult;}],
  ['receipt missing',event=>{event.completionReceipt=null;}],
  ['receipt wrong run',event=>{event.completionReceipt.runEventId='different-run';}],
  ['receipt wrong week',event=>{event.completionReceipt.week=2;}],
  ['receipt missing proof',event=>{event.completionReceipt.receiptBlobSha=null;}],
  ['prior week',event=>{event.week=2;}],
  ['wrong task',event=>{event.taskKey='DELTA_1645';}],
  ['wrong ledger',event=>{event.ledgerPath='data/walters/nfl/2026/week-02-research-ledger.json';}],
  ['invalid chronology',event=>{event.completedAt='2026-09-07T11:00:00-07:00';}],
  ['market viewed',event=>{event.marketViewed=true;}]
]){
  const event=structuredClone(reviewEvent);mutate(event);
  assert.equal(selectReview([event]),null,`${label} cannot advertise fresh research`);
  assert.deepEqual(selectReview([reviewEvent,event]),completedReview,`${label} must retain the prior verified review`);
}
assert.equal(selectReview([]),null,'a week with no completed runtime records must remain pending');
assert.equal(selectReview([reviewEvent],{...reviewLedger,sweeps:[]}),null,'a receipt without its sweep cannot advance INFO');
assert.equal(selectReview([reviewEvent],{...reviewLedger,sweeps:[reviewSweep,reviewSweep]}),null,'ambiguous sweep identity cannot advance INFO');
assert.equal(selectReview([reviewEvent],{...reviewLedger,week:2},{...reviewActive,week:2}),null,'rollover must not carry prior-week freshness');
const laterSweep={...reviewSweep,runEventId:'later-run',startedAt:'2026-09-07T19:00:00Z',completedAt:'2026-09-07T19:02:00Z'};
const laterEvent={...reviewEvent,runEventId:laterSweep.runEventId,startedAt:laterSweep.startedAt,completedAt:'2026-09-07T19:05:00Z',
  completionReceipt:{...reviewEvent.completionReceipt,runEventId:laterSweep.runEventId,verifiedAt:'2026-09-07T19:03:00Z'}};
assert.equal(selectReview([reviewEvent,laterEvent],{...reviewLedger,sweeps:[laterSweep,reviewSweep]}).completedAt,laterSweep.completedAt,
  'use actual time ordering across UTC/Pacific offsets and unordered records');

const helperSource=hotline.slice(hotline.indexOf('function finiteNumber'),hotline.indexOf('function moneylinePair'));
const helperContext={};
vm.runInNewContext(helperSource,helperContext);
assert.match(helperContext.line(null,'AWAY','HOME'),/PENDING/,'a missing Pinnacle spread must display PENDING, never PICK');
assert.match(helperContext.signed(null),/—/,'a missing gap or market move must display an em dash, never zero');
assert.equal(helperContext.american(null),null,'a missing Pinnacle moneyline must remain pending, never 0 / 0');
assert.equal(helperContext.line(0,'AWAY','HOME'),'PICK','a genuine numeric zero spread must still display PICK');

const game={home:'SEA',away:'NE',startTimePacific:'2026-09-09T17:20:00-07:00'};
const fixture={fixtureId:'x',tournamentId:31,startTime:'2026-09-10T00:20:00.000Z',participant1Name:'Seattle Seahawks',participant2Name:'New England Patriots'};
assert.equal(matchNflFixture(game,[fixture])?.matchedBy,'home-away+kickoff','OddsPapi NFL participant 1 must match the home team');

const parsed=extractPinnacleHomeSpread({
  updatedAt:'2026-09-01T20:00:00Z',
  pinnacle:{bookmakerIsActive:true,suspended:false,markets:[
    {marketId:'a',marketActive:true,bookmakerMarketId:'spread/a',outcomes:[
      {players:[{active:true,bookmakerOutcomeId:'-3/home',price:1.75,priceAmerican:'-133',limit:500,changedAt:'2026-09-01T20:00:00Z'}]},
      {players:[{active:true,bookmakerOutcomeId:'3/away',price:2.15,priceAmerican:'115',limit:500,changedAt:'2026-09-01T20:00:00Z'}]}
    ]},
    {marketId:'b',marketActive:true,bookmakerMarketId:'spread/b',outcomes:[
      {players:[{active:true,bookmakerOutcomeId:'-3.5/home',price:1.91,priceAmerican:'-110',limit:1800,changedAt:'2026-09-01T20:01:00Z'}]},
      {players:[{active:true,bookmakerOutcomeId:'3.5/away',price:1.95,priceAmerican:'-105',limit:1700,changedAt:'2026-09-01T20:01:00Z'}]}
    ]}
  ]}
},'2026-09-01T20:02:00Z');
assert.equal(parsed.homeSpread,-3.5,'headline Pinnacle rung should prefer the highest two-sided limit');

console.log('GRAHAM TERMINAL AUTOMATION: PASS');
