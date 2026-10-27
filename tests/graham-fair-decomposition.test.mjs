#!/usr/bin/env node
import assert from 'node:assert/strict';
import {deriveGrahamFairDecomposition,formatGrahamFairSummary,roundHalf,POLICY_ID} from '../tools/graham-fair-decomposition.mjs';

const policy={
  schema:1,
  policyId:POLICY_ID,
  state:'OPERATIONAL',
  marketViewed:false,
  adjustmentClassification:{
    homeFieldTypes:['HOME_FIELD','VENUE'],
    personnelTypes:['PERSONNEL_CALIBRATED_PRODUCTION'],
    matchupTypes:['MATCHUP_CALIBRATED_PRODUCTION']
  }
};

const pacheco={
  gameKey:'2026-W01-NO-DET',
  neutralBaseHome:-4,
  grahamExactFairHome:-5.582,
  grahamFairHome:-5.5,
  homeFieldPointsToHomeSpread:-2.082,
  personnelOverlayPointsToHomeSpread:0.5,
  adjustments:[
    {type:'HOME_FIELD',pointsToHomeSpread:-2.082},
    {type:'PERSONNEL_CALIBRATED_PRODUCTION',pointsToHomeSpread:0.5}
  ]
};
const pd=deriveGrahamFairDecomposition(pacheco,policy);
assert.equal(pd.neutralTeamBaseHome,-4);
assert.equal(pd.homeFieldPointsToHomeSpread,-2.082);
assert.equal(pd.prePersonnelExactFairHome,-6.082);
assert.equal(pd.personnelPointsToHomeSpread,0.5);
assert.equal(pd.matchupPointsToHomeSpread,0);
assert.equal(pd.otherGovernedPointsToHomeSpread,0);
assert.equal(pd.exactFairHome,-5.582);
assert.equal(pd.displayedFairHome,-5.5);
assert.equal(roundHalf(pd.exactFairHome),-5.5);
const summary=formatGrahamFairSummary(pd);
assert.match(summary,/pre-personnel exact -6\.082/);
assert.match(summary,/personnel \+0\.500/);
assert.match(summary,/exact Graham home fair -5\.582/);
assert.match(summary,/displayed -5\.5/);

const otherAdjustment={
  gameKey:'2026-W01-DAL-NYG',
  neutralBaseHome:2,
  grahamExactFairHome:0.418,
  grahamFairHome:0.5,
  homeFieldPointsToHomeSpread:-2.082,
  adjustments:[
    {type:'HOME_FIELD',pointsToHomeSpread:-2.082},
    {type:'PERSONNEL_UNCERTAINTY',pointsToHomeSpread:0.5}
  ]
};
const od=deriveGrahamFairDecomposition(otherAdjustment,policy);
assert.equal(od.otherGovernedPointsToHomeSpread,0.5);
assert.equal(od.prePersonnelExactFairHome,0.418);
assert.equal(od.exactFairHome,0.418);
assert.equal(od.displayedFairHome,0.5);

const tampered={...pacheco,grahamExactFairHome:-6.082};
assert.throws(()=>deriveGrahamFairDecomposition(tampered,policy),/GRAHAM_FAIR_EXACT_MISMATCH/);

const sharedVenueFailClosed={
  gameKey:'2026-W08-LAC-LAR',
  venueClass:'SHARED_VENUE_OR_METRO',
  homeFieldVenueClass:'SHARED_VENUE_OR_METRO',
  numberStatus:'FAIL_CLOSED_H4_SHARED_VENUE_METHOD_REQUIRED',
  neutralBaseHome:-7.198714828,
  grahamExactFairHome:null,
  grahamFairHome:null,
  homeFieldPointsToHomeSpread:null,
  homeFieldAdvantagePoints:null,
  personnelOverlayPointsToHomeSpread:0,
  matchupOverlayPointsToHomeSpread:0,
  adjustments:[
    {type:'HOME_FIELD',venueClass:'SHARED_VENUE_OR_METRO',pointsToHomeSpread:null,homeLocationAdvantagePoints:null},
    {type:'QB_PERFORMANCE_PRODUCTION',pointsToHomeSpread:-0.59}
  ]
};
const sd=deriveGrahamFairDecomposition(sharedVenueFailClosed,policy);
assert.equal(sd.neutralTeamBaseHome,-7.199);
assert.equal(sd.homeFieldPointsToHomeSpread,null);
assert.equal(sd.otherGovernedPointsToHomeSpread,-0.59);
assert.equal(sd.exactFairHome,null);
assert.equal(sd.displayedFairHome,null);
assert.equal(sd.arithmeticVerified,false);
assert.match(formatGrahamFairSummary(sd),/no exact or displayed Graham fair published/);
assert.throws(()=>deriveGrahamFairDecomposition({...sharedVenueFailClosed,homeFieldPointsToHomeSpread:0},policy),/SHARED_VENUE_FAIL_CLOSED_INVALID/);

console.log('GRAHAM FAIR DECOMPOSITION REGRESSION: PASS // PACHECO PERSONNEL + OTHER-GOVERNED + SHARED-VENUE FAIL-CLOSED + MISMATCH FAIL-CLOSED');
