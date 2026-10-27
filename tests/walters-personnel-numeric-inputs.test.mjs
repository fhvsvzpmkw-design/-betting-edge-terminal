import test from 'node:test';
import assert from 'node:assert/strict';
import {individualDelta,applyTeamPersonnel} from '../tools/walters-personnel-calibration.mjs';
const cal={availabilityRules:{OUT:{},PLAYING_LIMITED:{},ACTIVE_FULL:{},UNKNOWN:{action:'REVIEW_REQUIRED_AVAILABILITY'}},clusterRules:{DEFENSIVE_LINE:{multiplier:1.4}}};
const missing=[null,undefined,'',' ',true,false,[],{},Infinity,NaN];
test('missing replacement values do not become zero and exaggerate an injury loss',()=>{
 for(const value of missing)assert.throws(()=>individualDelta(cal,{availabilityStatus:'OUT',healthyValue:3,replacementValue:value}),{code:'REVIEW_REQUIRED_REPLACEMENT_VALUE'});
});
test('missing healthy values do not become zero',()=>{
 for(const value of missing)assert.throws(()=>individualDelta(cal,{availabilityStatus:'OUT',healthyValue:value,replacementValue:1}),{code:'REVIEW_REQUIRED_PLAYER_VALUE'});
});
test('blank effectiveness cannot become zero percent',()=>{
 for(const value of missing)assert.throws(()=>individualDelta(cal,{availabilityStatus:'PLAYING_LIMITED',healthyValue:3,approvedEffectivenessPct:value}),{code:'REVIEW_REQUIRED_EFFECTIVENESS'});
});
test('legitimate numeric zeros and numeric strings retain their arithmetic',()=>{
 for(const zero of [0,'0']){
  assert.equal(individualDelta(cal,{availabilityStatus:'OUT',healthyValue:'3',replacementValue:zero}).rawTeamContributionDelta,-3);
  assert.equal(individualDelta(cal,{availabilityStatus:'PLAYING_LIMITED',healthyValue:3,approvedEffectivenessPct:zero}).rawTeamContributionDelta,-3);
 }
 const result=applyTeamPersonnel(cal,{side:'AWAY',group:'DEFENSIVE_LINE',entries:[{availabilityStatus:'OUT',healthyValue:3,replacementValue:1},{availabilityStatus:'OUT',healthyValue:2,replacementValue:1}]});
 assert.equal(result.clusterMultiplier,1.4);assert.equal(result.rawTeamContributionDelta,-3);assert.equal(result.finalTeamContributionDelta,-4.2);assert.equal(result.pointsToHomeSpread,-4.2);
});
