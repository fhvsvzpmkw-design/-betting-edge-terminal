import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluate, matchCondition} from '../tools/core-handicap-framework.mjs';
import {deriveRequiredLiquidityRisk} from '../tools/core-liquidity-classification.mjs';
import {repairDraftCoreTaxonomy} from '../tools/core-draft-taxonomy.mjs';
import {compareRecordedFair} from '../tools/native-fair-review.mjs';
const read = p => JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const framework=read('core/core-handicap-framework-v1.4.json'), policy=read('data/major-sport-market-coverage-v1.json');
const clone=x=>structuredClone(x);
const baseContext={sport:'MLB',marketClass:'moneyline',marketDetail:'full_game_moneyline',timing:'pregame',fairValueBasis:'INDEPENDENT_MODEL',bookDispersion:'NONE',liquidityRisk:'NORMAL',tailRisk:'NORMAL',directCalibration:'GAP',personnelSensitivity:'NONE',independentCurrentSupport:'WEAK',movementPrimaryEvidence:false,historicalDirectionalRecalibrationPrimary:false,graduatedResearchIds:[]};
function assessment(context) {
  context={...context};context.graduatedResearchIds=[...new Set(framework.graduatedResearchRules.filter(rule=>matchCondition(rule.when,context)).map(rule=>rule.priorId))].sort();
  return {frameworkId:framework.frameworkId,context,...evaluate(framework,context),fairValueBasisRationale:'Synthetic sourced model for regression only.',uncertaintyStatement:'Synthetic sensitivity band crosses break-even; no BET is authorized.',rationale:'Keep forecast direction separate from BET risk clearance.'};
}
function fixture(early=false) {
  const ts=early?'2026-09-20T18:14:00-07:00':'2026-09-20T18:25:00-07:00';
  const generatedAt=early?'2026-09-20T18:05:00-07:00':'2026-09-20T18:20:00-07:00';
  const eventDate='2026-09-20T20:00:00-07:00';
  const report={ts,feedGeneratedAt:generatedAt,recs:[]};
  const selections=['home','away'].map(side=>({selectionId:`MLB|fixture|full_game_moneyline|${side}`,sport:'MLB',eventId:'fixture',eventDate,marketClass:'moneyline',marketDetail:'full_game_moneyline',side,
    quotes:[{book:'Bet365',eventId:'fixture',marketKey:'ml',side,line:null,selectionKey:`fixture|ml|${side}||`,priceDecimal:2,quoteUpdatedAt:generatedAt}]}));
  const source={id:'model1',kind:'MODEL',sport:'MLB',eventId:'fixture',checkedAt:generatedAt,url:'https://example.org/model/fixture',title:'Synthetic exact model',finding:'Fixture probabilities 54 percent home and 46 percent away; not live research.'};
  const recs=selections.map(s=>{
    const p=s.side==='home'?0.54:0.46,status=s.side==='home'?'LEAN':'PASS';
    const rec={title:'Synthetic '+s.side,status,stake:'$0',book:'Bet365',price:'+100',playTo:'NO BET',fair:String(p),analysis:'Synthetic source supports a directional review, not a wager. The sensitivity lower bound does not qualify for BET.',feed:{...s.quotes[0],eventDate},coreAssessment:assessment(baseContext),personnelRequired:false,sourceEvidence:[clone(source)],
      fairValueEvidence:{selectionKey:s.quotes[0].selectionKey,unit:'selection_probability',estimate:p,result:p,displayValue:String(p),range:{low:p-0.05,high:p+0.05},method:'Synthetic exact probability model',calculation:'Named synthetic source output, no market-implied probability substitution.',limitations:'Illustration only; interval is not a calibrated confidence statement.',inputs:[{name:'Synthetic point',value:p,unit:'probability',sourceIds:['model1']}],personnelBasis:{sensitive:false,rationale:'Synthetic no-personnel fixture.'},probabilityBasis:'CONDITIONAL_ON_NO_PUSH'},
      cardEvidence:{schema:1,selectionKey:s.quotes[0].selectionKey,findings:[{sourceIds:['model1'],stance:'CONTEXT',finding:source.finding,application:'Assess exact side against its current quote.',limitation:'Synthetic, not a live prediction.'}],decisionExplanation:'No BET; assess the point separately from conservative clearance.'}};
    return rec;
  });
  report.recs=clone(recs);
  const sidecar={recommendations:clone(recs),primaryAnalysis:{schema:1,feedGeneratedAt:generatedAt,receipts:selections.map((s,i)=>({selectionId:s.selectionId,quote:clone(s.quotes[0]),state:'EVALUATED',checkedAt:ts,decision:clone(recs[i]),evidence:clone(recs[i])}))}};
  const universe={selections,sports:{MLB:{primary:{required:6,available:2,unavailable:4}}},limitations:new Map()};
  return {report,sidecar,universe};
}
const f=fixture(), row=f.universe.selections[0], receipt=f.sidecar.primaryAnalysis.receipts[0];
const original=JSON.stringify(f), positive=compareRecordedFair(f.report,row,row.quotes[0],receipt);
assert.equal(positive.supportsPointReview,true);assert.equal(positive.conservativeBoundClears,false);assert.equal(positive.statusEffect,'NONE');
assert.equal(JSON.stringify(f),original,'review is read-only');
assert.equal(compareRecordedFair({...f.report,ts:'2026-09-20T18:14:00-07:00'},row,row.quotes[0],receipt),null,'forward only');
for (const change of [r=>r.decision.fairValueEvidence.selectionKey='other',r=>r.decision.sourceEvidence[0].eventId='other',r=>r.decision.sourceEvidence[0].checkedAt='2030-01-01T00:00:00Z',r=>r.checkedAt='2026-09-20T08:00:00-07:00',r=>r.decision.fairValueEvidence.inputs[0].sourceIds=['missing']]) {
  const bad=clone(receipt);change(bad);assert.equal(compareRecordedFair(f.report,row,row.quotes[0],bad),null);
}
const unknownPush=clone(receipt);delete unknownPush.decision.fairValueEvidence.probabilityBasis;
const pending=compareRecordedFair(f.report,row,row.quotes[0],unknownPush);assert.equal(pending.settlementPending,true);assert.equal(pending.conservativeBoundClears,false);
const spread=clone(receipt), spreadRow={...row,marketClass:'spread',marketDetail:'full_game_primary_spread',side:'away'}, sq={...row.quotes[0],marketKey:'spread',side:'away',line:-6.5,selectionKey:'fixture|spread|away||-6.5'};
spread.quote=sq;spread.decision.feed={...sq,eventDate:row.eventDate};spread.decision.fairValueEvidence={...spread.decision.fairValueEvidence,selectionKey:sq.selectionKey,unit:'selection_spread_points',estimate:4.5,range:{low:3.5,high:7}};
const sp=compareRecordedFair(f.report,spreadRow,sq,spread);assert.equal(sp.pointMargin,2);assert.equal(sp.comparisonUnit,'spread_points');assert.equal(sp.conservativeBoundClears,false);
assert.equal(compareRecordedFair(f.report,spreadRow,{...sq,line:-7},spread),null,'different lines cannot inherit a fair');
for (const [detail,cls] of [['full_game_primary_total','total'],['full_game_primary_run_line','spread']]) assert.equal(deriveRequiredLiquidityRisk({sport:'MLB',marketClass:cls,marketDetail:detail})?.requiredLiquidityRisk,'NORMAL');
assert.equal(deriveRequiredLiquidityRisk({sport:'MLB',marketClass:'player_props',marketDetail:'home_runs'}),null);
const basketball=fixture();for(const holder of [...basketball.report.recs,...basketball.sidecar.recommendations,...basketball.sidecar.primaryAnalysis.receipts.flatMap(r=>[r.decision,r.evidence])]) holder.coreAssessment=assessment({...baseContext,sport:'NBA_WNBA',marketClass:'total',marketDetail:'full_game_primary_total'});
const feed={events:[{eventId:'fixture',date:row.eventDate,league:{slug:'usa-wnba'}}]};
const governed=basketball.report.recs.map(r=>({status:r.status,stake:r.stake,feed:clone(r.feed),fair:r.fair}));
const repaired=repairDraftCoreTaxonomy(basketball.report,basketball.sidecar,{feed,framework});assert.equal(repaired.changes.length,2);
for(const r of basketball.report.recs){assert.equal(r.coreAssessment.context.sport,'WNBA');assert.ok(r.coreAssessment.effects.includes('ERA_TRANSPORTABILITY_CAUTION'));}
assert.deepEqual(basketball.report.recs.map(r=>({status:r.status,stake:r.stake,feed:r.feed,fair:r.fair})),governed);
const ambiguous=fixture();ambiguous.report.recs[0].coreAssessment.context.sport='NBA_WNBA';
assert.equal(repairDraftCoreTaxonomy(ambiguous.report,ambiguous.sidecar,{feed:{events:[]},framework}).changes.length,0);
const legacy=fixture(true);legacy.report.recs[0].coreAssessment.context.sport='NBA_WNBA';const legacyBefore=JSON.stringify(legacy);
assert.equal(repairDraftCoreTaxonomy(legacy.report,legacy.sidecar,{feed,framework}).changes.length,0);assert.equal(JSON.stringify(legacy),legacyBefore);
console.log('Core 1.4 review unit checks passed: native-unit opportunity review, no grade/risk mutation, alias and exact-league repair, source/time/line boundaries.');
if(process.argv.includes('--integration')) {
  const {validatePrimaryAnalysis}=await import('../tools/major-sport-market-coverage-gate.mjs');
  const {buildCandidateAssessment}=await import('../tools/candidate-assessment.mjs');
  const validate=x=>validatePrimaryAnalysis(x.report,x.sidecar,{inventory:x.universe,framework});
  const next=fixture();assert.equal(validate(next).primaryEvaluated,2,'supported WEAK non-bets no longer inherit BET-level support gate');
  const old=fixture(true);assert.throws(()=>validate(old),/requires independent current support/,'old semantics retained; demonstrates original false block');
  const bet=fixture();bet.sidecar.primaryAnalysis.receipts[0].decision.status='BET';bet.sidecar.primaryAnalysis.receipts[0].evidence=clone(bet.sidecar.primaryAnalysis.receipts[0].decision);bet.report.recs[0]=clone(bet.sidecar.primaryAnalysis.receipts[0].decision);
  assert.throws(()=>validate(bet),/requires independent current support|BET blocked/,'BET support/error requirements unchanged');
  const noSource=fixture();noSource.sidecar.primaryAnalysis.receipts[0].decision.sourceEvidence=[];noSource.sidecar.primaryAnalysis.receipts[0].evidence=clone(noSource.sidecar.primaryAnalysis.receipts[0].decision);noSource.report.recs[0]=clone(noSource.sidecar.primaryAnalysis.receipts[0].decision);
  assert.throws(()=>validate(noSource),/source/i,'source removal cannot bypass evidence');
  const drift=fixture();drift.sidecar.primaryAnalysis.receipts[0].decision.feed.line=1.5;drift.sidecar.primaryAnalysis.receipts[0].evidence=clone(drift.sidecar.primaryAnalysis.receipts[0].decision);drift.report.recs[0]=clone(drift.sidecar.primaryAnalysis.receipts[0].decision);
  assert.throws(()=>validate(drift),/differs from inventory/,'exact quote protections unchanged');
  const triage=buildCandidateAssessment({...next,forecastCoverage:{selections:[]}});
  assert.equal(triage.selections.find(r=>r.side==='home').promising,true,'recorded fair survives absent registry probability and absent Pinnacle');
  assert.equal(next.report.recs[0].status,'LEAN');assert.equal(next.report.recs[0].stake,'$0');
  assert.equal(triage.selections.find(r=>r.side==='away').promising,false);
  console.log('Core 1.4 review integration passed: original support-floor block reproduced; forward non-bet route accepts documented fair; BET, identity and missing-source failures remain enforced.');
}
