import assert from 'node:assert/strict';
import {categoryKey,TOURNAMENTS,planTournamentBatches,hockeyDefinitions,summarizePinnacle} from '../tools/oddspapi-observer.mjs';
import {annotatePinnacle,AUTHORITY} from '../tools/pinnacle-sharp-benchmark.mjs';
import {exactMarketReference} from '../tools/market-price-assessment.mjs';

// Synthetic market fixtures exercise acquisition scope and settlement identity.
assert.equal(categoryKey({sport:{slug:'ice-hockey'},league:{slug:'usa-nhl',name:'USA - NHL'}}),'NHL');
assert.equal(categoryKey({sport:{slug:'ice-hockey'},league:{slug:'canada-whl'}}),null);
assert.equal(categoryKey({sport:{slug:'basketball'},league:{name:'WNBA',slug:'usa-wnba'}}),'WNBA');
assert.equal(TOURNAMENTS.find(t=>t.key==='NHL').id,234);
assert.ok(planTournamentBatches(TOURNAMENTS).flat().some(t=>t.id===234));
assert.ok(planTournamentBatches(TOURNAMENTS).every(batch=>batch.length<=5));
const defs=[['151','Winner (incl. overtime and penalties)',0],['15228','Handicap (incl. overtime and penalties)',-1.5],['15178','Total (incl. overtime and penalties)',6.5]]
  .map(([marketId,marketName,handicap])=>({marketId,sportId:15,marketName,handicap,period:'result',playerProp:false,marketLength:2,marketType:'synthetic'}));
const regulation={...defs[2],marketId:'1530',period:'fulltime',marketName:'Total'};
assert.deepEqual(hockeyDefinitions([...defs,regulation,{...defs[2],marketId:'prop',playerProp:true}]),defs);
assert.throws(()=>hockeyDefinitions([regulation]),/moneyline definition missing/);
const observedAt='2026-09-30T23:00:00Z',startTime='2026-10-01T02:00:00Z';
const market=(suffix,sides,line=null)=>({marketActive:true,bookmakerMarketId:`line/2/0/1/2/0/${suffix}`,
  outcomes:Object.fromEntries(sides.map((side,i)=>[String(i+1),{players:{'0':{price:i?2.2:1.8,priceAmerican:i?'+120':'-125',active:true,mainLine:true,
    bookmakerOutcomeId:line===null?side:`${line}/${side}`,bookmakerChangedAt:observedAt}}}]))});
const book={bookmakerIsActive:true,suspended:false,markets:{
  '151':market('moneyline',['home','away']),
  '15228':market('spreads',['home','away'],-1.5),
  '15178':market('totals',['over','under'],6.5),
  '1530':market('totals',['over','under'],6.5)
}};
const pinnacle=summarizePinnacle(book,observedAt,defs);
assert.equal(pinnacle.markets.length,3,'same-line regulation markets must never enter the NHL result reference');
annotatePinnacle(pinnacle,{generatedAt:observedAt,primaryMatch:{eventId:'nhl-test'},quoteObservationVersion:1});
const observer={schema:3,mode:'official-sharp-benchmark',status:'ok',authoritative:true,benchmarkAuthority:AUTHORITY,executionAuthority:false,
  generatedAt:observedAt,quoteObservationVersion:1,fixtures:[{fixtureId:'synthetic-nhl',sportId:15,startTime,primaryMatch:{eventId:'nhl-test'},pinnacle}]};
const report={ts:'2026-09-30T16:05:00-07:00'};
for(const [marketKey,side,line] of [['ml','home',null],['spread','away',-1.5],['totals','over',6.5]]){
  const quote={eventId:'nhl-test',eventDate:startTime,marketKey,side,line};
  const ref=exactMarketReference(report,quote,observer);
  assert.equal(ref.selected.noVigProbability,side==='away'?.45:.55);
  const bad=structuredClone(observer);
  bad.fixtures[0].pinnacle.markets.forEach(m=>m.definition.period='fulltime');
  assert.throws(()=>exactMarketReference(report,quote,bad),/exact full-game paired reference/);
  bad.fixtures[0].pinnacle.markets.forEach(m=>delete m.definition);
  assert.throws(()=>exactMarketReference(report,quote,bad),/exact full-game paired reference/);
}
console.log('Pinnacle NHL coverage: category, tournament, batching and exact overtime settlement PASS');
