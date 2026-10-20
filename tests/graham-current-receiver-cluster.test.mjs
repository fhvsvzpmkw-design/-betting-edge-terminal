import assert from 'node:assert/strict';
import {currentReceiverClusterMultiplier} from '../tools/graham-current-personnel-estimates.mjs';
const players=[{player:'Primary WR',eaPlayerId:'1',position:'WR',waltersPoints:1.7},{player:'Primary TE',eaPlayerId:'2',position:'TE',waltersPoints:1.2},{player:'Reserve WR',eaPlayerId:'3',position:'WR',waltersPoints:.5},{player:'Reserve TE',eaPlayerId:'4',position:'TE',waltersPoints:.2}];
const lookup=(_name,id)=>players.find(p=>p.eaPlayerId===id);
const fixture=ids=>{
 const review={estimateAcknowledged:true,inventoryComplete:true,rationale:'Complete source-bound expected receiving inventory; highest pair evaluated with active common baseline preserved.',sourceRefs:['official-roster','official-depth'],expectedReceivers:players.map(p=>({...p,healthyExpectedRole:'Expected receiving role',availabilityStatus:ids.includes(p.eaPlayerId)?'IR':'ACTIVE_FULL'}))};
 return ids.map(id=>({playerEaId:id,availabilityStatus:'IR',rawTeamContributionDelta:-.2,sourceRefs:review.sourceRefs,receiverClusterReview:review}));
};
let n=0;const test=(s,f)=>{f();n++;console.log('PASS '+s);};
const run=cases=>currentReceiverClusterMultiplier(cases,{lookup,multiplier:1.5});
test('several reserve absences retain linear loss with both top options available',()=>assert.equal(run(fixture(['3','4'])).multiplier,1));
test('one primary plus reserve absence does not remove the highest pair',()=>assert.equal(run(fixture(['1','3'])).multiplier,1));
test('both highest expected receivers unavailable triggers calibrated multiplier',()=>assert.equal(run(fixture(['1','2','3'])).multiplier,1.5));
test('missing review blocks unsupported automatic multiplication',()=>{const c=fixture(['1','2']);delete c[0].receiverClusterReview;assert.throws(()=>run(c),/REVIEW_REQUIRED/);});
test('omitted absent receiving identity blocks incomplete inventory',()=>{const c=fixture(['1','2']);c[0].receiverClusterReview.expectedReceivers=c[0].receiverClusterReview.expectedReceivers.filter(p=>p.eaPlayerId!=='1');assert.throws(()=>run(c),/INCOMPLETE/);});
test('highest-value tie with another available option cannot choose convenient absentees',()=>{const c=fixture(['1','2']);players[2].waltersPoints=1.2;try{assert.equal(run(c).multiplier,1);}finally{players[2].waltersPoints=.5;}});
test('unresolved top option stays outside presumed simultaneous confirmed absence',()=>{const c=fixture(['1','3']);c[0].receiverClusterReview.expectedReceivers[1].availabilityStatus='UNRESOLVED';assert.equal(run(c).multiplier,1);});
console.log(`CURRENT RECEIVER CLUSTER: ${n} PASS`);
