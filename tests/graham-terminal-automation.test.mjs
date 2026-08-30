#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {matchNflFixture,extractPinnacleHomeSpread} from '../tools/graham-market-utils.mjs';

const numbers=JSON.parse(fs.readFileSync('data/walters/nfl/2026/week-01-current-numbers.json','utf8'));
const research=JSON.parse(fs.readFileSync('data/walters/nfl/2026/week-01-research-ledger.json','utf8'));
const hotline=fs.readFileSync('syndicates/generated/graham-mercer/hotline.html','utf8');
const builder=fs.readFileSync('tools/build-graham-current-week.mjs','utf8');
const capture=fs.readFileSync('tools/capture-graham-daily-pinnacle.mjs','utf8');
const observer=fs.readFileSync('tools/oddspapi-observer.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/graham-terminal-refresh.yml','utf8');

assert.equal(numbers.games.length,16,'Week 1 current-number board must contain 16 games');
assert.equal(new Set(numbers.games.map(g=>g.gameKey)).size,16,'Week 1 game keys must be unique');
assert.equal(numbers.rules.marketIsolation.includes('before viewing'),true,'current-number state must enforce market isolation');
assert.equal(research.policy.appendOnly,true,'research ledger must be append-only');
assert.equal(research.scheduledCadence.some(x=>x.day==='TUESDAY'&&x.timePacific==='10:30'),true,'Tuesday 10:30 baseline schedule missing');
assert.equal(research.scheduledCadence.some(x=>x.day==='WEDNESDAY-FRIDAY'&&x.timePacific==='11:30'),true,'Wed-Fri 11:30 sweep missing');
assert.equal(research.scheduledCadence.some(x=>x.day==='TUESDAY-SATURDAY'&&x.timePacific==='14:45'),true,'pre-15:15 delta schedule missing');
assert.match(hotline,/current-week-terminal\.json/,'Hotline must load the current-week terminal feed');
assert.match(hotline,/setInterval\(load,60000\)/,'Hotline must refresh the feed without rewriting the page');
assert.match(builder,/function numeric\(v\)\{if\(v===null\|\|v===undefined\|\|v===''/,'builder must not coerce pending nulls to zero');
assert.match(capture,/reportTime!=='15:15'/,'official daily comparison must be tied to the 15:15 report');
assert.match(observer,/bookmakerOutcomeId:q\?\.bookmakerOutcomeId/,'OddsPapi observer must preserve bookmaker outcome handles for spread parsing');
assert.doesNotMatch(workflow,/oddspapi\.io|odds-api\.io|fetch\(/i,'Graham post-processing workflow must not call an external odds API');
assert.match(workflow,/capture-graham-daily-pinnacle\.mjs/);
assert.match(workflow,/build-graham-current-week\.mjs/);

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
