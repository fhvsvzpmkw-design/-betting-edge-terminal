import fs from 'node:fs';
import {FORECAST_LEAN_FROM} from '../../tools/forecast-lean.mjs';
import {evaluateForecast} from '../../tools/forecast-evidence.mjs';
import {exactMarketReference,marketComparison} from '../../tools/market-price-assessment.mjs';
import {evaluate,matchCondition} from '../../tools/core-handicap-framework.mjs';
const framework=JSON.parse(fs.readFileSync('core/core-handicap-framework-v1.4.json'));
function originalFixture() {
  // Entirely synthetic clock, sources, price and applicability judgments.
  const ts=FORECAST_LEAN_FROM, generatedAt='2026-10-01T18:55:00Z', eventDate='2026-10-01T22:00:00Z';
  const selection=side=>({selectionId:`MLB|123|full_game_moneyline|${side}`,sport:'MLB',eventId:'123',
    eventDate,marketClass:'moneyline',marketDetail:'full_game_moneyline',side,
    quotes:[{book:'Bet365',eventId:'123',marketKey:'ml',side,line:null,selectionKey:`123|ml|${side}||`,priceDecimal:1.9,quoteUpdatedAt:generatedAt}]});
  const selections=['home','away'].map(selection);
  const observer={schema:3,mode:'official-sharp-benchmark',status:'ok',authoritative:true,
    benchmarkAuthority:'OFFICIAL_NON_EXECUTABLE_SHARP_BENCHMARK',executionAuthority:false,generatedAt,
    fixtures:[{fixtureId:'1',primaryMatch:{eventId:'123'},startTime:eventDate,pinnacle:{bookmakerIsActive:true,suspended:false,
      markets:[{bookmakerMarketId:'line/a/b/c/d/0/moneyline',marketActive:true,outcomes:['home','away'].map(side=>({outcomeId:side,
        players:[{playerId:'0',bookmakerOutcomeId:side,bookmakerChangedAt:generatedAt,price:1.9,priceAmerican:'-111',active:true,mainLine:true,limit:1000}]}))}]}}]};
  const raw={recordId:'fixture-espn',sourceId:'espn',sport:'MLB',eventId:'123',startTime:eventDate,state:'PRE_GAME',
    url:'https://www.espn.com/mlb/game/_/gameId/123',excerpt:'Synthetic model fixture: home 60 percent.',
    kind:'OUTCOME_PROBABILITY',marketDetail:'full_game_moneyline',period:'FULL_GAME',side:'home',line:null,
    probability:.6,probabilityBasis:'UNCONDITIONAL',forecastAt:'2026-10-01T18:50:00Z',observedAt:generatedAt,
    settlement:{includesOvertime:true,pushRule:'NO_PUSH'},limitation:'Synthetic point; uncertainty and dependence unquantified.'};
  const revalidation={recordId:raw.recordId,forReportAt:ts,checkedAt:ts,eventMatch:true,freshnessStatus:'CURRENT',
    freshnessRationale:'Synthetic current-source check.',personnelStatus:'NOT_MATERIAL',
    personnelRationale:'Only a provisional opinion is under test; no validated starter assumptions or fair claimed.',
    settlementMatch:true,settlementRationale:'Synthetic full-game no-draw outcome.'};
  const report={ts,feedGeneratedAt:generatedAt,recs:[],counts:{bet:0,lean:0,wait:0,pass:2},risk:0};
  const ids=[{id:'market',kind:'MARKET',sport:'MLB',eventId:'123',checkedAt:ts,url:'https://example.org/fixture/pinnacle',title:'Fixture paired reference',finding:'Synthetic exact paired market.'},
    {id:'info',kind:'OFFICIAL',sport:'MLB',eventId:'123',checkedAt:ts,url:'https://example.org/fixture/lineups',title:'Fixture personnel check',finding:'Synthetic confirmed starters and lineups remain unresolved.'},
    {id:'model',kind:'MODEL',sport:'MLB',eventId:'123',checkedAt:generatedAt,url:raw.url,title:'Fixture ESPN point',finding:raw.excerpt}];
  const recs=selections.map(s=>{
    const q={...s.quotes[0],eventDate},ref=exactMarketReference(report,q,observer),p=ref.selected;
    const context={sport:'MLB',marketClass:'moneyline',marketDetail:'full_game_moneyline',timing:'pregame',fairValueBasis:'MARKET_DERIVED_ONLY',
      bookDispersion:'NONE',liquidityRisk:'NORMAL',tailRisk:'NORMAL',directCalibration:'GAP',personnelSensitivity:'UNRESOLVED',
      independentCurrentSupport:'NONE',movementPrimaryEvidence:false,historicalDirectionalRecalibrationPrimary:false,graduatedResearchIds:[]};
    context.graduatedResearchIds=[...new Set(framework.graduatedResearchRules.filter(r=>matchCondition(r.when,context)).map(r=>r.priorId))];
    const coreAssessment={frameworkId:framework.frameworkId,context,...evaluate(framework,context),fairValueBasisRationale:'Market reference only.',
      uncertaintyStatement:'No independent calibrated fair or forecast interval is claimed.',rationale:'Synthetic exact market price does not justify a bet.'};
    const reviewed=evaluateForecast(raw,{...s,startTime:eventDate,period:'FULL_GAME',line:null,priceDecimal:1.9},
      {asOf:ts,revalidations:[revalidation]});
    return {title:`Fixture ${s.side}`,status:'PASS',stake:'$0',book:q.book,price:'-111',playTo:'NO BET',fair:`Market reference: ${p.noVigPriceAmerican}`,
      analysis:'Synthetic exact market price does not justify a bet.',hist:'NR — synthetic test, not real analysis.',feed:q,
      coreAssessment,source:'Fixture sources.',sourceEvidence:structuredClone(ids),sourceShortfall:null,fairValueEvidence:null,
      personnelRequired:false,personnelEvidence:null,waitQualification:null,
      pinnacleBenchmark:{state:'QUALIFIED',authority:observer.benchmarkAuthority,executionAuthority:false,eventId:'123',marketKey:'ml',selectionKey:q.selectionKey,
        price:p.priceAmerican,pairedPrice:ref.opposite.priceAmerican,noVigProbability:p.noVigProbability,noVigPriceAmerican:p.noVigPriceAmerican,quoteChangedAt:p.quoteChangedAt,limit:p.limit},
      benchmarkComparison:marketComparison(1.9,p.noVigProbability),
      marketAssessment:{schema:1,basis:'QUALIFIED_PINNACLE',selectionKey:q.selectionKey,referenceGeneratedAt:generatedAt,
        referenceProbability:p.noVigProbability,referencePriceDecimal:1/p.noVigProbability,probabilityBasis:'CONDITIONAL_ON_NO_PUSH',referenceSourceIds:['market'],
        settlementRationale:'Exact full-game paired synthetic contract.',informationReview:{checkedAt:ts,sourceIds:['info'],state:'UNRESOLVED',impact:'Starter and lineup uncertainty is retained.'},
        limitations:'Market-only reference, no independent fair.',decisionRationale:'Synthetic exact market price does not justify a bet.'},
      forecastReview:{eligibleExactRecordIds:reviewed.eligibility==='ELIGIBLE_EXACT'?[raw.recordId]:[],records:[reviewed]},
      cardEvidence:{schema:1,selectionKey:q.selectionKey,findings:[{stance:'CONTRARY',sourceIds:['market'],finding:'Exact price is unfavorable versus paired reference.',application:'Synthetic quote comparison.',limitation:'Market reference only.'}],decisionExplanation:'Synthetic exact market price does not justify a bet.'}};
  });
  report.recs=recs;
  const sidecar={recommendations:recs.map((r,i)=>({...structuredClone(r),ordinal:i+1,selectionKey:r.feed.selectionKey,displayText:r.hist})),
    forecastEvidence:{schema:1,records:[raw],revalidations:[revalidation],attempts:[]},
    primaryAnalysis:{schema:1,feedGeneratedAt:generatedAt,receipts:selections.map((s,i)=>({selectionId:s.selectionId,quote:s.quotes[0],state:'EVALUATED',checkedAt:ts,
      decision:structuredClone(recs[i]),evidence:structuredClone(recs[i])}))}};
  const universe={selections,sports:{MLB:{primary:{available:2}}}};
  const judgment={forecastRecordId:raw.recordId,sourceIds:['model'],provisional:true,
    rationale:'The reviewed forecast favours home at this price, so home is the directional preference.',
    uncertainty:'The forecast has no established confidence interval or independent BET-grade fair.',
    conflictReview:'Pinnacle disagrees with this price; the model point does not establish profitable value.',
    limitations:'Synthetic test judgment; external model dependence remains unknown.',recheckCondition:'Recheck confirmed starters and batting orders.'};
  return {report,sidecar,observer,universe,selections,raw,judgment};
}

export function nhlFixture(edge=.5) {
  let json=JSON.stringify(originalFixture());
  for (const [oldValue,newValue] of [
    [FORECAST_LEAN_FROM,'2026-10-13T07:20:00-07:00'],
    ['2026-10-01T18:55:00Z','2026-10-13T14:15:00Z'],
    ['2026-10-01T18:50:00Z','2026-10-13T14:10:00Z'],
    ['2026-10-01T22:00:00Z','2026-10-13T22:00:00Z']]) json=json.replaceAll(oldValue,newValue);
  const f=JSON.parse(json.replaceAll('"MLB"','"NHL"'));
  f.raw.sourceId='moneypuck';
  f.raw.url='https://moneypuck.com/moneypuck/predictions/2026020999.csv';
  f.raw.probability=1/1.9+edge/100;
  f.raw.excerpt='Synthetic current published outcome probability; market dependence retained.';
  f.raw.marketDetail='full_game_moneyline';
  const fixture=f.observer.fixtures[0];fixture.sportId=15;
  fixture.pinnacle.markets[0].marketId='synthetic-nhl-winner';
  fixture.pinnacle.markets[0].definition={marketId:'synthetic-nhl-winner',sportId:15,period:'result',playerProp:false,
    marketLength:2,marketName:'Winner (incl. overtime and penalties)'};
  const reviews=f.sidecar.forecastEvidence.revalidations;
  for (const [i,rec] of f.report.recs.entries()) {
    rec.sourceEvidence.find(x=>x.id==='model').url=f.raw.url;
    rec.sourceEvidence.find(x=>x.id==='model').finding=f.raw.excerpt;
    rec.coreAssessment.context.graduatedResearchIds=[...new Set(framework.graduatedResearchRules
      .filter(r=>matchCondition(r.when,rec.coreAssessment.context)).map(r=>r.priorId))];
    Object.assign(rec.coreAssessment,evaluate(framework,rec.coreAssessment.context));
    const review=evaluateForecast(f.raw,{...f.selections[i],startTime:f.selections[i].eventDate,period:'FULL_GAME',line:null,priceDecimal:1.9},
      {asOf:f.report.ts,revalidations:reviews});
    rec.forecastReview={eligibleExactRecordIds:review.eligibility==='ELIGIBLE_EXACT'?[f.raw.recordId]:[],records:[review]};
    f.sidecar.recommendations[i]={...structuredClone(rec),ordinal:i+1,selectionKey:rec.feed.selectionKey,displayText:rec.hist};
    Object.assign(f.sidecar.primaryAnalysis.receipts[i],{decision:structuredClone(rec),evidence:structuredClone(rec)});
  }
  f.sidecar.forecastEvidence.records=[f.raw];
  return f;
}
