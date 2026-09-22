import assert from 'node:assert/strict';
import {historicalExposure,exposureWeightedLoss} from './graham-historical-exposure.mjs';
const sourceCheck=ids=>assert.deepEqual(ids,['game']);
const base={modelId:'graham-historical-time-exposure-v1',estimateAcknowledged:true,
  assumptionRationale:'Time weights value; no medical-effectiveness percentage is inferred.',
  activeEffectivenessConvention:'NORMAL_WHILE_ACTIVE_ESTIMATE',gameDurationSeconds:3600,
  durationSourceIds:['game'],unavailableIntervals:[{startEarliest:2700,startLatest:3150,endEarliest:3600,endLatest:3600,rationale:'Reported fourth-quarter departure, no return.',sourceIds:['game']}]};
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
test('imprecise time retains interval and uses disclosed midpoint',()=>{
  const e=historicalExposure(base,sourceCheck),r=exposureWeightedLoss(9.25,6,e);
  assert.deepEqual(e.fractionRange,{min:.125,max:.25});assert.equal(e.fraction,.1875);
  assert.equal(r.injuryLoss,.609);assert.deepEqual(r.injuryLossRange,{min:.406,max:.813});
});
test('full-game replacement and replacement upgrade floor',()=>{
  const b=structuredClone(base);b.unavailableIntervals[0].startEarliest=0;b.unavailableIntervals[0].startLatest=0;
  const e=historicalExposure(b,sourceCheck);assert.equal(exposureWeightedLoss(8.25,7,e).injuryLoss,1.25);
  assert.equal(exposureWeightedLoss(7,8.25,e).injuryLoss,0);
});
test('separate temporary absences sum only unavailable time',()=>{
  const b=structuredClone(base);b.unavailableIntervals=[{startEarliest:60,startLatest:60,endEarliest:120,endLatest:120,rationale:'First absence',sourceIds:['game']},{startEarliest:3000,startLatest:3000,endEarliest:3120,endLatest:3120,rationale:'Second absence',sourceIds:['game']}];
  assert.equal(historicalExposure(b,sourceCheck).fraction,.05);
});
test('overlapping absence intervals cannot double charge',()=>{
  const b=structuredClone(base);b.unavailableIntervals.push({...b.unavailableIntervals[0]});
  assert.throws(()=>historicalExposure(b,sourceCheck),/INTERVAL_INVALID/);
});
test('missing timing source and silent effectiveness assumption fail',()=>{
  const b=structuredClone(base);delete b.activeEffectivenessConvention;
  assert.throws(()=>historicalExposure(b,sourceCheck),/DECLARATION/);
  assert.throws(()=>historicalExposure({...base,durationSourceIds:[]},sourceCheck));
});
test('invalid duration and reversed timing fail',()=>{
  assert.throws(()=>historicalExposure({...base,gameDurationSeconds:0},sourceCheck),/DURATION/);
  const b=structuredClone(base);b.unavailableIntervals[0].startLatest=3601;
  assert.throws(()=>historicalExposure(b,sourceCheck),/INTERVAL_INVALID/);
});
console.log(`HISTORICAL EXPOSURE: ${count} PASS`);
