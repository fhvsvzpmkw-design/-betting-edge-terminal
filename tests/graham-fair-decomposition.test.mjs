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

console.log('GRAHAM FAIR DECOMPOSITION REGRESSION: PASS // PACHECO PERSONNEL + OTHER-GOVERNED + MISMATCH FAIL-CLOSED');
