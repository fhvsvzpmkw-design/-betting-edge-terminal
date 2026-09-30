import assert from 'node:assert/strict';
import fs from 'node:fs';
import {confirmedStarterPrior,validatePriorEstimateBinding,PRIOR_ESTIMATE_METHOD} from '../tools/walters-qb-prior-estimate.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const registry=read('data/walters/nfl/qb-performance/candidates/qb-candidates-2026-stage3c-v1.json');
const policy=read('data/walters/nfl/qb-production/production-contract-v1.json').priorFallbackPolicy;
const candidate=registry.players.find(p=>p.playerId==='16312');
const url='https://www.buccaneers.com/news/synthetic-regression-fixture';
const item={team:'TB',currentStarterStatus:'CONFIRMED_NAMED_STARTER',sourceRefs:[url],starterEvidence:{kind:'OFFICIAL',team:'TB',playerId:'16312',url,observedAt:'2026-09-30T19:00:00Z',finding:'Synthetic confirmed-starter test fixture.'}};
const args={candidate,item,policy,effectiveAt:'2026-09-30T19:01:00Z'}, before=JSON.stringify(args);
const estimate=confirmedStarterPrior(args);
assert.equal(estimate.value,6);assert.equal(estimate.confidence,'LOW');assert.equal(estimate.evidenceDropbacks,0);assert.equal(JSON.stringify(args),before);
for(const mutate of [a=>a.policy.state='PAUSED',a=>a.item.currentStarterStatus='PROJECTED',a=>a.item.starterEvidence.kind='REPORTING',a=>a.item.starterEvidence.playerId='other',a=>a.item.starterEvidence.observedAt='2026-10-01T00:00:00Z',a=>a.item.sourceRefs=[],a=>a.candidate.priorValue=null,a=>a.candidate.performanceBlend=.5,a=>a.candidate.status='STAGE3_CANDIDATE_NON_OPERATIONAL']){const a=structuredClone(args);mutate(a);assert.throws(()=>confirmedStarterPrior(a),/QB_PRIOR_ESTIMATE/);}
const binding={team:'TB',currentStarterStatus:item.currentStarterStatus,sampleTreatment:PRIOR_ESTIMATE_METHOD,currentStarterPlayer:{playerId:'16312',candidateStatus:PRIOR_ESTIMATE_METHOD},approvedProductionStarterValue:6,priorEstimate:estimate,evidence:{sourceRefs:[url]},lastUpdatedAt:args.effectiveAt};
validatePriorEstimateBinding(binding,{registry,policy});
assert.throws(()=>validatePriorEstimateBinding({...binding,approvedProductionStarterValue:7},{registry,policy}),/VALUE_MISMATCH/);
const wrongHost=structuredClone(args);wrongHost.item.starterEvidence.url='https://example.com/news/fixture';wrongHost.item.sourceRefs=[wrongHost.item.starterEvidence.url];assert.throws(()=>confirmedStarterPrior(wrongHost),/OFFICIAL_STARTER_EVIDENCE/);
console.log('QB prior estimates: frozen value, confirmation, time, identity, sample classification and manifest revalidation verified.');
