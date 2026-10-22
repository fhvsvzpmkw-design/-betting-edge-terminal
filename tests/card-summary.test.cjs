const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const summary=require('../assets/card-summary.js');

const report=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/history/runs/2026-10-22/final_morning-100627.json'),'utf8'));
const clone=value=>JSON.parse(JSON.stringify(value));
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
const minnesota=report.recs.find(rec=>rec.title==='Minnesota Wild Moneyline');
const exactForecast=rec=>rec.forecastReview.records.find(f=>f.eligibility==='ELIGIBLE_EXACT');
const forecastGaps=rec=>summary.describe(rec).comparisons.filter(item=>item.label!=='Pinnacle gap');

test('the issued 09:30 report retains every call, quote, condition and evidence byte',()=>{
  const before=JSON.stringify(report);
  freeze(report);
  assert.equal(report.recs.length,104);
  assert.ok(report.recs.every(rec=>rec.status==='PASS'));
  const summaries=report.recs.map(summary.describe);
  assert.ok(summaries.every(item=>item.comparisons.some(c=>c.label==='Pinnacle gap')));
  assert.ok(summaries.every(item=>item.checks.length>0),'unresolved personnel stays visible');
  for(let i=0;i<report.recs.length;i++){
    assert.deepEqual(summaries[i].checks,[...new Set(report.recs[i].personnelEvidence.unresolved)]);
  }
  const moneyPuck=summaries.flatMap(item=>item.comparisons).filter(item=>item.label==='MoneyPuck gap');
  assert.equal(moneyPuck.length,24,'only the 24 eligible exact NHL moneylines have MoneyPuck gaps');
  assert.equal(moneyPuck.filter(item=>item.value.startsWith('+')).length,6,'six positive source gaps must not create LEAN calls');
  assert.equal(JSON.stringify(report),before);
});

test('model and market disagreement remain explicit on a PASS card',()=>{
  const result=summary.describe(minnesota);
  assert.equal(result.comparisons.find(c=>c.label==='Pinnacle gap').value,'−2.11 pp');
  assert.equal(result.comparisons.find(c=>c.label==='MoneyPuck gap').value,'+2.27 pp');
  assert.deepEqual(result.checks,['Starting goalies, scratches and final lineup']);
  assert.equal(minnesota.status,'PASS');
  assert.equal(minnesota.stake,'$0');
});

test('the leading favorable total remains PASS with its outstanding checks',()=>{
  const rec=report.recs.find(rec=>rec.title==='Florida Panthers @ Pittsburgh Penguins Under 6.5 — Total');
  assert.ok(rec,'the regression uses the actual Florida–Pittsburgh total');
  const result=summary.describe(rec);
  assert.equal(result.comparisons[0].value,'+1.30 pp');
  assert.match(result.reason,/unresolved/i);
  assert.equal(rec.status,'PASS');
  assert.equal(forecastGaps(rec).length,0,'moneyline probabilities must not appear as total probabilities');
});

test('unknown or mismatched issued selection identities cannot produce comparisons',()=>{
  for(const mutate of [
    rec=>rec.feed.eventId='other-event',
    rec=>rec.feed.side='home',
    rec=>rec.feed.marketKey='totals',
    rec=>rec.feed.line=1.5,
    rec=>rec.feed.selectionKey='unbound',
    rec=>rec.feed.priceDecimal=null,
    rec=>rec.feed.priceDecimal=1,
  ]){
    const rec=clone(minnesota);mutate(rec);
    assert.equal(summary.describe(rec).comparisons.length,0);
  }
  const rec=clone(minnesota);rec.marketAssessment.selectionKey='other-event|ml|away||';
  assert.ok(summary.describe(rec).comparisons.every(c=>c.label!=='Pinnacle gap'));
});

test('forecast rows require the exact eligible side, line, market, period and issued quote',()=>{
  for(const [label,mutate] of [
    ['opposite side',f=>f.side='home'],
    ['different line',f=>f.line=1.5],
    ['different market',f=>f.marketDetail='full_game_total'],
    ['different period',f=>f.period='FIRST_PERIOD'],
    ['context only',f=>f.eligibility='CONTEXT_ONLY'],
    ['outdated price',f=>f.comparison.priceDecimal=1.51],
    ['outdated break-even',f=>f.comparison.breakEvenProbability=.7],
    ['missing probability',f=>f.probability=null],
    ['invalid probability',f=>f.probability=1],
    ['missing measured gap',f=>f.comparison.edgeProbabilityPoints=null],
    ['inconsistent measured gap',f=>f.comparison.edgeProbabilityPoints=99],
  ]){
    const rec=clone(minnesota);mutate(exactForecast(rec));
    assert.equal(forecastGaps(rec).length,0,label);
  }
  const rec=clone(minnesota);rec.forecastReview.eligibleExactRecordIds=[];
  assert.equal(forecastGaps(rec).length,0,'a stale or unapproved record cannot be revived by its eligibility string alone');
});

test('one publisher remains one opinion when a newer observation is present',()=>{
  const rec=clone(minnesota),forecast=exactForecast(rec),newer=clone(forecast);
  newer.recordId='newer-observation';newer.revalidatedAt='2026-10-22T11:00:00-07:00';
  rec.forecastReview.records.push(newer);
  rec.forecastReview.eligibleExactRecordIds.push(newer.recordId);
  assert.equal(forecastGaps(rec).length,1);
});

test('sentence previews preserve abbreviations, decimals and a complete older decision',()=>{
  assert.equal(summary.firstSentence('PASS — St. Louis is 3.35 points behind. Full review follows.'),'PASS — St. Louis is 3.35 points behind.');
  assert.equal(summary.firstSentence('Edge is 2.16 probability points. Full personnel review follows.'),'Edge is 2.16 probability points.');
  assert.equal(summary.describe({analysis:'WAIT for confirmed starting pitchers. No wager.'}).reason,'WAIT for confirmed starting pitchers.');
  assert.deepEqual(summary.describe({analysis:'A legacy selection.'}).comparisons,[]);
});

test('a contrary market reference cannot replace the actual LEAN, WAIT or BET explanation',()=>{
  for(const status of ['LEAN','WAIT','BET']){
    const rec=clone(minnesota);rec.status=status;
    rec.marketAssessment.decisionRationale=`${status} — source-backed opinion with a named recheck. Further evidence follows.`;
    assert.equal(summary.describe(rec).reason,`${status} — source-backed opinion with a named recheck.`);
  }
});
