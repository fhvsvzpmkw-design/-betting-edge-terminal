import test from 'node:test';
import assert from 'node:assert/strict';
import {loadForecastSourceRegistry,forecastRoutes,evaluateForecast,buildForecastCoverage} from '../tools/forecast-evidence.mjs';
import {parseEspn} from '../tools/collect-game-intelligence.mjs';
import {compareMoneyPuckComponents} from '../tools/grade-game-intelligence.mjs';

const registry=loadForecastSourceRegistry();
const activation=registry.markets['NBA:moneyline'].sourceEffectiveFrom.espn;
const shift=(t,minutes)=>new Date(Date.parse(t)+minutes*60000).toISOString();

function fixture(sport,at=shift(activation,5)){
  const startTime=shift(at,60),event={eventId:'pricing-fixture',sport,
    home:sport==='NFL'?'Denver Broncos':'Fixture Home',away:sport==='NFL'?'Los Angeles Rams':'Fixture Away',startTime};
  const competition={date:startTime,status:{type:{state:'pre'}},competitors:[
    {id:'1',homeAway:'home',team:{displayName:event.home,...(sport==='NFL'?{abbreviation:'DEN'}:{})}},
    {id:'2',homeAway:'away',team:{displayName:event.away,...(sport==='NFL'?{abbreviation:'LAR'}:{})}}]};
  const summary={header:{id:'pricing-fixture',competitions:[competition]},predictor:{
    homeTeam:{id:'1',gameProjection:'55'},awayTeam:{id:'2',gameProjection:'45'}}};
  const record=parseEspn(summary,event,at,registry).records[0];
  const candidate={selectionId:`${sport}|pricing-fixture|full_game_moneyline|home`,eventId:event.eventId,
    sport,startTime,marketClass:'moneyline',marketDetail:'full_game_moneyline',period:'FULL_GAME',side:'home',line:null,priceDecimal:2};
  const review={recordId:record.recordId,forReportAt:at,checkedAt:at,eventMatch:true,
    freshnessStatus:'CURRENT',freshnessRationale:'Fixture current pregame observation.',
    personnelStatus:'NOT_MATERIAL',personnelRationale:'Fixture assumptions checked.',
    settlementMatch:true,settlementRationale:'Fixture full-game, overtime included, no push.',
    observedSnapshotReviewed:true,modelTimeLimitation:'Native published pregame snapshot; calculation time absent.'};
  return {event,summary,record,candidate,review,at};
}

test('NBA and NCAAF native ESPN moneyline fields become usable forward, while prior reports keep context-only capability',()=>{
  for(const sport of ['NBA','NCAAF']){
    const current=fixture(sport);
    assert.equal(current.record.probabilityBasis,'UNCONDITIONAL');
    const result=evaluateForecast(current.record,current.candidate,{asOf:current.at,registry,revalidations:[current.review]});
    assert.equal(result.eligibility,'ELIGIBLE_EXACT',JSON.stringify(result.reasons));
    assert.equal(result.comparison.direction,'SUPPORTS_PRICE');
    const before=shift(activation,-5),past=fixture(sport,before);
    // Supply a known basis only to isolate the source-capability cutover.
    const prior=evaluateForecast({...past.record,probabilityBasis:'UNCONDITIONAL',pushProbability:0,
      settlement:{includesOvertime:true,pushRule:'NO_PUSH'}},past.candidate,{asOf:before,registry,revalidations:[past.review]});
    assert.equal(prior.eligibility,'CONTEXT_ONLY');
    assert.ok(prior.reasons.includes('SOURCE_EXACT_CAPABILITY_UNVERIFIED'));
    assert.ok(!forecastRoutes(sport,'moneyline',registry,before).exact.includes('espn'));
  }
});

test('current ESPN coverage binds the actual report clock and requires material-information review',()=>{
  const f=fixture('NBA');
  const inventory={selections:[{selectionId:f.candidate.selectionId,sport:'NBA',eventId:f.event.eventId,
    eventDate:f.event.startTime,marketDetail:'full_game_moneyline',side:'home',quotes:[{
      eventId:f.event.eventId,marketKey:'ml',side:'home',line:null,priceDecimal:2,selectionKey:'pricing-fixture|ml|home||'}]}]};
  const coverage=buildForecastCoverage({report:{ts:f.at},sidecar:{forecastEvidence:{records:[f.record],revalidations:[f.review]}},universe:inventory,registry});
  assert.equal(coverage.selections[0].eligibleExactRecordIds.length,1);
  const unresolved=evaluateForecast(f.record,f.candidate,{asOf:f.at,registry,revalidations:[{...f.review,personnelStatus:'UNRESOLVED'}]});
  assert.ok(unresolved.reasons.includes('PERSONNEL_APPLICABILITY_UNRESOLVED'));
  assert.notEqual(unresolved.eligibility,'ELIGIBLE_EXACT');
});

test('college settlement remains unknown before cutover or for incomplete pairs; NFL tie mass and spread scope stay explicit',()=>{
  const f=fixture('NCAAF');
  const incomplete=structuredClone(f.summary);delete incomplete.predictor.awayTeam;
  assert.equal(parseEspn(incomplete,f.event,f.at,registry).records[0].probabilityBasis,'UNKNOWN');
  const mismatched=structuredClone(f.summary);mismatched.predictor.awayTeam.gameProjection='44';
  assert.equal(parseEspn(mismatched,f.event,f.at,registry).records[0].probabilityBasis,'UNKNOWN');
  assert.equal(fixture('NCAAF',shift(activation,-5)).record.probabilityBasis,'UNKNOWN');
  assert.equal(fixture('NFL').record.probabilityBasis,'UNKNOWN');
  const result=evaluateForecast(f.record,{...f.candidate,marketClass:'spread',marketDetail:'full_game_primary_spread',line:-2.5},
    {asOf:f.at,registry,revalidations:[f.review]});
  assert.equal(result.comparison,null);
  assert.notEqual(result.eligibility,'ELIGIBLE_EXACT');
});

function componentFixture(side='home'){
  const record={recordId:'native-component-fixture',sourceId:'moneypuck',sport:'NHL',eventId:'component-game',
    startTime:'2026-10-20T23:00:00Z',observedAt:'2026-10-20T22:30:00Z',period:'FULL_GAME',state:'PRE_GAME',
    marketDetail:'full_game_moneyline',side,marketBlendObservation:{modelHomeProbability:side==='home'?.8:.2,
      bookmakerHomeProbability:.5}};
  const row={...record,state:'GRADED',outcome:1,scoredProbability:.65};
  return {record,row};
}
test('component scores compare identical games, orient away probabilities and do not claim Pinnacle or wagering authority',()=>{
  for(const side of ['home','away']){
    const {record,row}=componentFixture(side),result=compareMoneyPuckComponents([record],[row]);
    assert.equal(result.all.games,1);
    assert.ok(Math.abs(result.all.brier.rawModel-.04)<1e-10);
    assert.ok(Math.abs(result.all.brier.publishedBlend-.1225)<1e-10);
    assert.equal(result.all.brier.embeddedBookComponent,.25);
    assert.ok(Math.abs(result.all.rawMinusMarket.mean+.21)<1e-10);
    assert.equal(result.all.rawMinusMarket.approximate95PercentInterval,null);
    assert.equal(result.postStudy.games,1);
    assert.equal(result.decisionAuthority,false);
    assert.equal(result.benchmark,'MONEYPUCK_EMBEDDED_BOOK_COMPONENT');
  }
});
test('component scoring excludes missing components, postgame records, wrong identities and repeated game orientations',()=>{
  const {record,row}=componentFixture();
  assert.equal(compareMoneyPuckComponents([record],[row,row]).all.games,1);
  assert.equal(compareMoneyPuckComponents([{...record,observedAt:record.startTime}],[row]).all.games,0);
  assert.equal(compareMoneyPuckComponents([{...record,marketBlendObservation:null}],[row]).all.games,0);
  assert.equal(compareMoneyPuckComponents([record],[{...row,eventId:'different-game'}]).all.games,0);
  assert.equal(compareMoneyPuckComponents([record],[{...row,state:'PENDING'}]).all.games,0);
  assert.equal(compareMoneyPuckComponents([record],[{...row,scoredProbability:null}]).all.games,0);
});
