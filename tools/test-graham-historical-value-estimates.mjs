import assert from 'node:assert/strict';
import fs from 'node:fs';
import {historicalValueEstimates,VALUE_ESTIMATE_POLICY} from './graham-historical-value-estimates.mjs';
const registry=JSON.parse(fs.readFileSync('data/walters/nfl/player-values/player-values-2026-v1.json'));
const calibration=JSON.parse(fs.readFileSync('data/walters/nfl/personnel-calibration-v1.json'));
const row={player:'Synthetic Missing Receiver',identity:'estimate:test-receiver',position:'WR',method:'POSITION_GROUP_MEDIAN',estimateAcknowledged:true,rationale:'Test explicit broad position prior',gameKeys:['test-game'],sourceIds:['source'],roleSourceIds:['source'],officialAndIndependentSearchCompleted:true,searchFinding:'Test search exhausted'};
const input=()=>({bundle:{estimationPolicy:VALUE_ESTIMATE_POLICY,valueEstimates:[structuredClone(row)]},registry,calibration,sourceCheck:ids=>assert.deepEqual(ids,['source'])});
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
test('median estimate has no fictitious Madden rating and retains sensitivity',()=>{const [r]=historicalValueEstimates(input());assert.equal(r.waltersPoints,0);assert.equal(r.maddenOvr,null);assert.equal(r.valueStatus,'HISTORICAL_ESTIMATE');assert.deepEqual(r.valueProvenance.valueRange,[0,.9]);});
test('independent rating uses unchanged conversion',()=>{const i=input();Object.assign(i.bundle.valueEstimates[0],{method:'INDEPENDENT_MADDEN_27',maddenOvr:76,ratingVersion:'MADDEN_NFL_27',provider:'Test provider'});assert.equal(historicalValueEstimates(i)[0].waltersPoints,.5);});
test('cannot overwrite frozen identity by name',()=>{const i=input();i.bundle.valueEstimates[0].player=registry.players[0].player;assert.throws(()=>historicalValueEstimates(i),/OVERRIDE/);});
test('cannot overwrite official supplement',()=>{const i=input();i.supplementalPlayers=[{player:row.player,eaPlayerId:'ea-test'}];assert.throws(()=>historicalValueEstimates(i),/OVERRIDE/);});
test('QB imputation prohibited',()=>{const i=input();i.bundle.valueEstimates[0].position='QB';assert.throws(()=>historicalValueEstimates(i),/NON_QB/);});
test('specialist cannot acquire a fictitious calibrated value',()=>{const i=input();i.bundle.valueEstimates[0].position='LS';assert.throws(()=>historicalValueEstimates(i),/NON_QB/);});
test('search declaration required before imputation',()=>{const i=input();delete i.bundle.valueEstimates[0].officialAndIndependentSearchCompleted;assert.throws(()=>historicalValueEstimates(i),/SEARCH/);});
test('sources and role identity are required',()=>{const i=input();i.bundle.valueEstimates[0].roleSourceIds=[];assert.throws(()=>historicalValueEstimates(i));});
test('unapproved policy rejected',()=>{const i=input();delete i.bundle.estimationPolicy;assert.throws(()=>historicalValueEstimates(i),/POLICY/);});
console.log(`HISTORICAL VALUE ESTIMATES: ${n} PASS`);
