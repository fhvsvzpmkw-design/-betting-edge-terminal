import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ADAPTIVE_RESEARCH_FROM,buildStrategyTrials,gradeStrategyTrials,loadStrategyResearch,eventStrategyResearch,sourceFormFeedback} from '../tools/strategy-research.mjs';
import {createSourceLedForecastLean,validateForecastLean,forecastLeanDefault} from '../tools/forecast-lean.mjs';
import {validateMarketAssessment,validateBoundMarketAssessment} from '../tools/market-price-assessment.mjs';
import {evaluateForecast,validateBoundForecastLean} from '../tools/forecast-evidence.mjs';
import {validateReportEvidence} from '../tools/report-evidence-gate.mjs';
import {validatePrimaryAnalysis} from '../tools/major-sport-market-coverage-gate.mjs';
import {nhlCorroborationApplies} from '../tools/nhl-forecast-corroboration.mjs';
import {grade} from '../tools/grade-game-intelligence.mjs';
import {exactMarketReference,marketComparison} from '../tools/market-price-assessment.mjs';
const registry=JSON.parse(fs.readFileSync('research/strategy-registry.json'));
const at='2026-11-06T17:05:00Z',startTime='2026-11-06T22:00:00Z';
const event={sport:'NHL',eventId:'fixture',startTime,home:'Fixture Home',away:'Fixture Away'};
const quote={...event,marketDetail:'full_game_moneyline',side:'home',line:null,book:'DraftKings',priceDecimal:2,observedAt:at,pinnacleDirection:'UNFAVORABLE'};
const record={...event,recordId:'raw',sourceId:'moneypuck',modelFamily:'MONEYPUCK',kind:'OUTCOME_PROBABILITY',state:'PRE_GAME',period:'FULL_GAME',
  marketDetail:quote.marketDetail,side:'home',line:null,observedAt:at,forecastAt:at,probability:.505,probabilityBasis:'UNCONDITIONAL',
  settlement:{includesOvertime:true,pushRule:'NO_PUSH'},url:'https://moneypuck.com/fixture'};
const build=overrides=>buildStrategyTrials({registry,at,feedGeneratedAt:at,quotes:[quote],records:[record],...overrides});
const capture=(trials,clock=at,records=[record])=>({collectedAt:clock,records,strategyTrials:trials});
const final={eventId:event.eventId,startTime,state:'FINAL',homeScore:3,awayScore:2,verifiedAt:'2026-11-07T06:00:00Z'};

test('restored methods are available before candidate formation, with as-of source and strategy feedback',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'strategy-research-'));
  try{
    fs.mkdirSync(path.join(root,'research'),{recursive:true});fs.writeFileSync(path.join(root,'research/strategy-registry.json'),JSON.stringify(registry));
    fs.mkdirSync(path.join(root,'data/game-intelligence'),{recursive:true});
    fs.writeFileSync(path.join(root,'data/game-intelligence/performance.json'),JSON.stringify({asOf:at,rows:[],strategyLearning:{byMethod:[]}}));
    const inputs=loadStrategyResearch(root,at),view=eventStrategyResearch(event,inputs);
    assert.ok(view.methods.some(m=>m.id==='wong_price_and_settlement'));
    assert.ok(view.methods.some(m=>m.id==='movement_and_reversal'));
    assert.equal(inputs.feedback.asOf,at);
    assert.equal(loadStrategyResearch(root,'2026-11-06T16:59:00Z'),null);
    assert.equal(loadStrategyResearch(root,ADAPTIVE_RESEARCH_FROM).feedback,null,'later feedback cannot enter an earlier report');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('positive forecasts are captured without Pinnacle or two sources; stale, wrong-line and unknown-settlement records are excluded',()=>{
  const trials=build();assert.equal(trials.length,1);assert.equal(trials[0].probability,.505);assert.equal(trials[0].checks.supportingFamilies,1);
  assert.equal(build({quotes:[{...quote,pinnacleDirection:'UNAVAILABLE'}]}).length,1);
  for(const bad of [{line:1.5},{observedAt:'2026-11-06T18:00:00Z'},{probabilityBasis:'UNKNOWN'},{settlement:{}},{kind:'SCORE_CONTEXT'}])
    assert.equal(build({records:[{...record,...bad}]}).length,0);
  assert.equal(build({quotes:[{...quote,observedAt:'2026-11-06T15:00:00Z'}]}).length,0);
});

test('first captured price survives repeat appearances and method revisions receive separate identities',()=>{
  const trials=build(),laterAt='2026-11-06T17:10:00Z',later=build({at:laterAt,quotes:[{...quote,priceDecimal:2.2}]});
  assert.equal(trials[0].trialId,later[0].trialId);
  const grade=gradeStrategyTrials([capture(later,laterAt),capture(trials)],[final],'2026-11-07T07:00:00Z');
  assert.equal(grade.rows.length,1);assert.equal(grade.rows[0].priceDecimal,2);assert.equal(grade.byMethod[0].all.roi,1);
  const revised=structuredClone(registry);revised.methods.find(m=>m.id==='forecast_price').version++;
  assert.notEqual(build({registry:revised})[0].trialId,trials[0].trialId);
  assert.equal(gradeStrategyTrials([capture(trials)],[{...final,verifiedAt:'2026-11-08T00:00:00Z'}],'2026-11-07T07:00:00Z').byMethod[0].all.settled,0);
});

test('form experiments use a current provider sequence and keep follow/fade correlated results separate',()=>{
  const fact={...event,sourceId:'espn',kind:'RECENT_GAMES',observedAt:at,url:'https://espn.com/fixture',
    details:{team:event.home,events:[1,2,3].map(day=>({date:`2026-11-0${day}T04:00:00Z`,result:'W'}))}};
  const away={...quote,side:'away',priceDecimal:1.8};
  const trials=build({records:[],quotes:[quote,away],facts:[fact]});
  assert.deepEqual(trials.map(t=>t.methodId).sort(),['recent_form_fade','recent_form_follow']);
  const grade=gradeStrategyTrials([capture(trials,at,[])],[final],'2026-11-07T07:00:00Z');
  assert.equal(grade.byMethod.find(m=>m.methodId==='recent_form_follow').all.wins,1);
  assert.equal(grade.byMethod.find(m=>m.methodId==='recent_form_fade').all.losses,1);
  const both={...fact,details:{...fact.details,team:event.away}};
  assert.equal(build({records:[],quotes:[quote,away],facts:[fact,both]}).length,0);
  assert.equal(build({records:[],facts:[{...fact,observedAt:'2026-11-06T14:00:00Z'}]}).length,0);
});

test('recent source feedback separates sport and market and does not count opposite orientations twice',()=>{
  const rows=[{sourceId:'source',sport:'NHL',marketDetail:'full_game_moneyline',eventId:'1',startTime,state:'GRADED',brier:.25},
    {sourceId:'source',sport:'NHL',marketDetail:'full_game_moneyline',eventId:'1',startTime,state:'GRADED',brier:.25},
    {sourceId:'source',sport:'NBA',marketDetail:'full_game_moneyline',eventId:'2',startTime,state:'GRADED',brier:.16}];
  const forms=sourceFormFeedback(rows);assert.equal(forms.length,2);assert.equal(forms[0].games,1);
});

test('the existing grader feeds settled strategy results into the next saved research package without another request',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'strategy-feedback-'));
  try{
    fs.mkdirSync(path.join(root,'research'),{recursive:true});fs.writeFileSync(path.join(root,'research/strategy-registry.json'),JSON.stringify(registry));
    const dir=path.join(root,'data/game-intelligence');fs.mkdirSync(path.join(dir,'captures/2026-11-06'),{recursive:true});
    fs.writeFileSync(path.join(dir,'captures/2026-11-06/fixture.json'),JSON.stringify(capture(build())));
    fs.writeFileSync(path.join(dir,'performance.json'),JSON.stringify({results:[final]}));
    const result=await grade({root,at:'2026-11-07T07:00:00Z',fetchImpl:()=>{throw Error('Unexpected additional result request');}});
    assert.equal(result.strategyLearning.byMethod[0].all.wins,1);assert.equal(result.sourceForm[0].games,1);
    fs.writeFileSync(path.join(dir,'performance.json'),JSON.stringify(result));
    const view=eventStrategyResearch({...event,eventId:'next-game'},loadStrategyResearch(root,'2026-11-07T17:00:00Z'));
    assert.equal(view.performance[0].all.wins,1);assert.equal(view.sourceForm[0].games,1);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

function opinionFixture(){
  const report={ts:at,feedGeneratedAt:at,recs:[],risk:0};
  const feed={eventId:event.eventId,eventDate:startTime,marketKey:'ml',side:'home',line:null,selectionKey:'fixture|ml|home||',book:'DraftKings',priceDecimal:2,quoteUpdatedAt:at};
  const raw={...record,url:'https://moneypuck.com/fixture',excerpt:'Synthetic current probability',sourceField:'probability'};
  const review={recordId:raw.recordId,forReportAt:at,checkedAt:at,eventMatch:true,freshnessStatus:'CURRENT',freshnessRationale:'Synthetic source recheck',
    personnelStatus:'NOT_MATERIAL',personnelRationale:'Synthetic assumptions checked',settlementMatch:true,settlementRationale:'Full game including overtime, no push'};
  const selection={selectionId:'NHL|fixture|full_game_moneyline|home',sport:'NHL',eventId:event.eventId,eventDate:startTime,
    marketClass:'moneyline',marketDetail:'full_game_moneyline',side:'home',quotes:[Object.fromEntries(Object.entries(feed).filter(([k])=>k!=='eventDate'))]};
  const reviewed=evaluateForecast(raw,{...selection,startTime,period:'FULL_GAME',line:null,priceDecimal:2},{asOf:at,revalidations:[review]});
  assert.equal(reviewed.eligibility,'ELIGIBLE_EXACT',JSON.stringify(reviewed.reasons));
  const sourceEvidence=[{id:'model',kind:'MODEL',sport:'NHL',eventId:event.eventId,checkedAt:at,url:raw.url,title:'Fixture model',finding:'Synthetic exact point'},
    {id:'info',kind:'OFFICIAL',sport:'NHL',eventId:event.eventId,checkedAt:at,url:'https://nhl.com/fixture',title:'Fixture personnel',finding:'Synthetic current assumptions reviewed'}];
  const base={title:'Fixture home',feed,book:'DraftKings',price:'+100',status:'PASS',stake:'$0',playTo:'NO BET',sourceEvidence,sourceShortfall:null,
    pinnacleBenchmark:{state:'PINNACLE_BENCHMARK_UNAVAILABLE'},benchmarkComparison:null,fairValueEvidence:null,
    personnelRequired:false,personnelEvidence:null,waitQualification:null,
    coreAssessment:{context:{sport:'NHL',marketClass:'moneyline',marketDetail:'full_game_moneyline',timing:'pregame',
      bookDispersion:'NONE',liquidityRisk:'NORMAL',tailRisk:'NORMAL',directCalibration:'GAP',personnelSensitivity:'NONE',
      independentCurrentSupport:'NONE',movementPrimaryEvidence:false,historicalDirectionalRecalibrationPrimary:false,graduatedResearchIds:[]}},
    forecastReview:{records:[reviewed],eligibleExactRecordIds:[raw.recordId]},
    cardEvidence:{schema:1,selectionKey:feed.selectionKey,findings:[],decisionExplanation:'Fixture'}};
  const judgment={forecastRecordId:raw.recordId,sourceIds:['model'],provisional:false,rationale:'A small reviewed source advantage merits a directional opinion after current research.',
    uncertainty:'Published point uncertainty remains unquantified.',conflictReview:'The Pinnacle reference is unavailable; price support is from the original model.',
    limitations:'A single source and small gap; no calibrated fair or wager is asserted.',settlementRationale:'Full-game winner including overtime, no push.',
    informationReview:{checkedAt:at,sourceIds:['info'],state:'NO_MATERIAL_CONFLICT',impact:'Current event assumptions have been checked.'}};
  const rec=createSourceLedForecastLean(report,base,judgment);
  report.recs=[rec];
  const receipt={selectionId:selection.selectionId,quote:selection.quotes[0],state:'EVALUATED',checkedAt:at,decision:rec,evidence:structuredClone(rec)};
  const sidecar={recommendations:[structuredClone(rec)],forecastEvidence:{schema:1,records:[raw],revalidations:[review],attempts:[]},
    primaryAnalysis:{schema:1,feedGeneratedAt:at,receipts:[receipt]}};
  return {report,rec,sidecar,receipt,selection};
}

test('a single sub-one-point NHL forecast can publish a real source-led LEAN without Pinnacle',()=>{
  const f=opinionFixture();assert.equal(f.rec.coreAssessment.modelErrorState,'UNQUANTIFIED');assert.equal(f.rec.coreAssessment.betEligibleByModelError,false);
  assert.equal(validateForecastLean(f.report,f.rec),true);assert.equal(validateMarketAssessment(f.report,f.rec,f.rec,new Map(f.rec.sourceEvidence.map(s=>[s.id,s]))),true);
  assert.equal(validateBoundMarketAssessment(f.report,f.rec,null),null);
  assert.equal(validateBoundForecastLean({report:f.report,sidecar:f.sidecar,selection:f.selection,receipt:f.receipt}),true);
  assert.equal(validateReportEvidence(f.report,f.sidecar).checked,1);
  assert.equal(validatePrimaryAnalysis(f.report,f.sidecar,{inventory:{selections:[f.selection],sports:{NHL:{primary:{available:1}}}}}).primaryEvaluated,1);
  assert.equal(nhlCorroborationApplies(f.report,f.rec),false);
  assert.equal(forecastLeanDefault(f.report,f.rec).flexible,true);
});

test('flexibility does not permit pre-cutover opinions, altered original forecasts, fake comparison or stake',()=>{
  for(const mutate of [f=>f.report.ts='2026-11-06T16:59:00Z',f=>f.rec.stake='$1',f=>f.rec.status='BET',
    f=>f.rec.forecastLean.probability=.8]){
    const f=opinionFixture();mutate(f);assert.throws(()=>validateForecastLean(f.report,f.rec));
  }
  const f=opinionFixture();f.rec.benchmarkComparison={direction:'FAVORABLE'};
  assert.throws(()=>validateMarketAssessment(f.report,f.rec,f.rec,new Map(f.rec.sourceEvidence.map(s=>[s.id,s]))),/invented comparison/);
});

test('a source-led opinion retains an available exact signed Pinnacle comparison and cannot hide contrary original forecasts',()=>{
  const f=opinionFixture(),observer={schema:3,mode:'official-sharp-benchmark',status:'ok',authoritative:true,
    benchmarkAuthority:'OFFICIAL_NON_EXECUTABLE_SHARP_BENCHMARK',executionAuthority:false,generatedAt:at,
    fixtures:[{fixtureId:'fixture',primaryMatch:{eventId:event.eventId},startTime,pinnacle:{bookmakerIsActive:true,suspended:false,
      markets:[{bookmakerMarketId:'line/a/b/c/d/0/moneyline',marketActive:true,outcomes:['home','away'].map((side,i)=>({outcomeId:side,
        players:[{playerId:'0',bookmakerOutcomeId:side,bookmakerChangedAt:at,price:i?1.8:2.1,priceAmerican:i?'-125':'+110',active:true,mainLine:true,limit:1000}]}))}]}}]};
  assert.throws(()=>validateBoundMarketAssessment(f.report,f.rec,observer),/retain an available/);
  const ref=exactMarketReference(f.report,f.rec.feed,observer),b=ref.selected;
  f.rec.pinnacleBenchmark={state:'QUALIFIED',authority:observer.benchmarkAuthority,executionAuthority:false,eventId:event.eventId,
    marketKey:'ml',selectionKey:f.rec.feed.selectionKey,price:b.priceAmerican,pairedPrice:ref.opposite.priceAmerican,
    noVigProbability:b.noVigProbability,noVigPriceAmerican:b.noVigPriceAmerican,quoteChangedAt:b.quoteChangedAt,limit:b.limit};
  f.rec.benchmarkComparison=marketComparison(f.rec.feed.priceDecimal,b.noVigProbability);
  assert.equal(f.rec.benchmarkComparison.direction,'UNFAVORABLE');
  assert.doesNotThrow(()=>validateBoundMarketAssessment(f.report,f.rec,observer));
  const raw={...f.sidecar.forecastEvidence.records[0],recordId:'contrary',probability:.45};
  f.sidecar.forecastEvidence.records.push(raw);
  f.sidecar.forecastEvidence.revalidations.push({...f.sidecar.forecastEvidence.revalidations[0],recordId:'contrary'});
  assert.throws(()=>validateBoundForecastLean({report:f.report,sidecar:f.sidecar,selection:f.selection,receipt:f.receipt}),/omit or alter/);
});
