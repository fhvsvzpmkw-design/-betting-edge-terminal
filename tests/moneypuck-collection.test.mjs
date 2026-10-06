import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseCsv,parseMoneyPuckDaily,matchMoneyPuckEvent,parseMoneyPuck,collect,saveCapture,moneyPuckDailyUrl,moneyPuckCsvUrl} from '../tools/collect-game-intelligence.mjs';
import {validateCapture,bindIntelligence,buildGameIntelligence} from '../tools/game-intelligence.mjs';
import {loadForecastSourceRegistry,evaluateForecast} from '../tools/forecast-evidence.mjs';

// Public native source fixtures inspected 2026-10-06; credit MoneyPuck.com.
const html=fs.readFileSync('tests/fixtures/moneypuck-20261006.htm','utf8');
const csv=fs.readFileSync('tests/fixtures/moneypuck-2026020044.csv','utf8');
const registry=loadForecastSourceRegistry(),day='2026-10-06',at='2026-10-06T18:00:00Z';
const event={eventId:'fixture-nhl',sport:'NHL',home:'Toronto Maple Leafs',away:'Nashville Predators',startTime:'2026-10-06T23:00:00Z'};
const board=parseMoneyPuckDaily(html),match=matchMoneyPuckEvent(event,board,day),rows=parseCsv(csv);
const parse=(values=rows,e=event,m=match,observed=at)=>parseMoneyPuck(values,e,m,day,observed,registry);

test('real daily preview matches ordered teams, Eastern kickoff, exact IDs and avoids goalie percentages',()=>{
  assert.equal(board.length,9);assert.equal(match.sourceGameId,'2026020044');assert.equal(match.homeCode,'TOR');assert.equal(match.awayCode,'NSH');
  assert.equal(match.homePercent,58.8);assert.equal(match.awayPercent,41.2);
  assert.equal(matchMoneyPuckEvent({...event,home:event.away,away:event.home},board,day),null);
  assert.equal(matchMoneyPuckEvent({...event,startTime:'2026-10-07T00:00:00Z'},board,day),null);
  assert.equal(matchMoneyPuckEvent(event,[match,match],day),null);
  assert.equal(matchMoneyPuckEvent(event,board,'2026-10-07'),null);
  assert.equal(matchMoneyPuckEvent({...event,sport:'NBA'},board,day),null);
  assert.equal(parseMoneyPuckDaily(html.replaceAll('Preview','Final')).length,0);
  assert.throws(()=>moneyPuckCsvUrl('../escape'));
  assert.throws(()=>moneyPuckDailyUrl('bad-date'));
});

test('native paired full-game fields remain distinct from regulation, raw model and book inputs',()=>{
  const captured=parse();assert.equal(captured.length,2);
  assert.equal(captured[0].probability,Number(rows[0].preGameHomeTeamWinOverallScore));
  assert.equal(captured[1].probability,Number(rows[0].preGameAwayTeamWinOverallScore));
  assert.notEqual(captured[0].probability,Number(rows[0].preGameMoneyPuckHomeWinPrediction));
  assert.notEqual(captured[0].probability,Number(rows[0].preGameBettingOddsHomeWinPrediction));
  assert.notEqual(captured[0].probability,Number(rows[0].preGameHomeTeamWinInRegScore));
  assert.deepEqual(captured[0].sourceValues,rows[0]);assert.equal(captured[0].marketBlendObservation.observedEqualWeightBlend,true);
  assert.ok(captured.every(r=>r.forecastAt===null&&r.observedAt===at&&r.attribution.includes('MoneyPuck.com')));
  assert.ok(captured.every(r=>r.probabilityBasis==='UNCONDITIONAL'&&r.settlement.includesOvertime===true&&r.settlement.pushRule==='NO_PUSH'&&r.pushProbability===0));
  assert.ok(captured.every(r=>r.sourceField.endsWith('WinOverallScore')&&r.marketDetail==='full_game_moneyline'));
  validateCapture({schema:1,collectedAt:at,records:captured},registry);
});

test('missing, duplicate, reversed, stale and inconsistent fields cannot create a fresh forecast',()=>{
  for(const change of [{gameID:'2026020045'},{homeTeamCode:'NSH',roadTeamCode:'TOR'},
    {preGameAwayTeamWinOverallScore:''},{preGameHomeTeamWinInOTScore:''},
    {preGameHomeTeamWinOverallScore:'0.8'},{preGameHomeTeamWinInRegScore:'0.8'},
    {preGameHomeTeamWinOverallScore:'58.8'}])assert.deepEqual(parse([{...rows[0],...change}]),[],JSON.stringify(change));
  assert.deepEqual(parse([rows[0],rows[0]]),[]);assert.deepEqual(parse([]),[]);
  assert.deepEqual(parse(rows,event,{...match,homePercent:60}),[]);
  assert.deepEqual(parse(rows,event,match,event.startTime),[]);
});

test('real captures enter the shared report path but require actual current applicability before price use',()=>{
  const records=parse(),r=records[0],candidate={eventId:r.eventId,sport:r.sport,startTime:r.startTime,period:'FULL_GAME',marketDetail:r.marketDetail,marketClass:'moneyline',side:r.side,line:null,priceDecimal:2};
  const unreviewed=evaluateForecast(r,candidate,{asOf:at,registry});assert.equal(unreviewed.comparison,null);
  assert.ok(unreviewed.reasons.includes('CURRENT_REVALIDATION_REQUIRED'));
  const review={recordId:r.recordId,forReportAt:at,checkedAt:at,eventMatch:true,freshnessStatus:'CURRENT',freshnessRationale:'Synthetic test review of current native capture',personnelStatus:'SUITABLE_PROJECTION',personnelRationale:'Synthetic test fixture only',settlementMatch:true,settlementRationale:'Native overall components include regulation and OT; synthetic full-game contract',observedSnapshotReviewed:true,modelTimeLimitation:'Source does not publish model calculation time'};
  assert.equal(evaluateForecast(r,candidate,{asOf:at,registry,revalidations:[review]}).eligibility,'ELIGIBLE_EXACT');
  assert.equal(evaluateForecast(r,candidate,{asOf:'2026-10-06T22:15:00Z',registry,revalidations:[review]}).comparison,null,'earlier review is not inherited by 15:15');
  assert.ok(evaluateForecast(r,{...candidate,marketDetail:'full_game_primary_puck_line',marketClass:'spread',line:1.5},{asOf:at,registry,revalidations:[review]}).reasons.includes('WRONG_MARKET_OR_SIDE'));
});

const feed={generatedAt:at,events:[{id:event.eventId,home:event.home,away:event.away,date:event.startTime,sport:{slug:'ice-hockey'},league:{slug:'usa-nhl'}}]};
function tempRoot(r=registry){const root=fs.mkdtempSync(path.join(os.tmpdir(),'moneypuck-collector-'));fs.mkdirSync(path.join(root,'research'));fs.mkdirSync(path.join(root,'data'));fs.writeFileSync(path.join(root,'research/forecast-source-registry.json'),JSON.stringify(r));fs.writeFileSync(path.join(root,'data/live-odds.json'),JSON.stringify(feed));return root;}
const fakeFetch=(urls=[])=>async (url,options)=>{
  urls.push(url);assert.equal(options.headers['User-Agent'],'VigWireLabs-GameIntelligence/1.0');
  const body=url===moneyPuckDailyUrl(day)?html:url===moneyPuckCsvUrl(match.sourceGameId)?csv:url.includes('scoreboard')?'{}':
    'date_utc,time_utc,away_team,home_team,home_margin,total,home_win_prob\n';
  return {ok:true,status:200,text:async()=>body};
};

test('shared collector retrieves real MoneyPuck fields once, reuses unchanged captures and preserves source time on failure',async()=>{
  const root=tempRoot(),urls=[];
  try{
    const fetchImpl=fakeFetch(urls),first=await collect({root,at,fetchImpl});saveCapture(root,first);
    const original=first.records.filter(r=>r.sourceId==='moneypuck');assert.equal(original.length,2);
    assert.equal(urls.filter(u=>u===moneyPuckDailyUrl(day)).length,1);assert.equal(urls.filter(u=>u===moneyPuckCsvUrl(match.sourceGameId)).length,1);
    const second=await collect({root,at:'2026-10-06T18:05:00Z',fetchImpl});
    assert.deepEqual(second.records.filter(r=>r.sourceId==='moneypuck'),original);
    assert.ok(second.sources.some(s=>s.sourceId==='moneypuck'&&s.state==='CACHED'));
    assert.equal(urls.filter(u=>u===moneyPuckCsvUrl(match.sourceGameId)).length,1);
    for(const failing of [moneyPuckDailyUrl(day),moneyPuckCsvUrl(match.sourceGameId)]){
      const failed=await collect({root,at:'2026-10-06T18:20:00Z',fetchImpl:async (url,options)=>url===failing?{ok:false,status:403}:fetchImpl(url,options)});
      assert.deepEqual(failed.records.filter(r=>r.sourceId==='moneypuck'),original);
      assert.ok(failed.sources.some(s=>s.sourceId==='moneypuck'&&s.state==='UNAVAILABLE'&&s.reason==='HTTP 403'));
      assert.equal(failed.requestCache['moneypuck:'+day],first.requestCache['moneypuck:'+day]);
    }
    const universe={selections:['home','away'].map(side=>({selectionId:'NHL|fixture-nhl|full_game_moneyline|'+side,eventId:event.eventId,sport:'NHL',eventDate:event.startTime,marketDetail:'full_game_moneyline',side,quotes:[]}))};
    const report={ts:first.collectedAt},sidecar={};bindIntelligence({root,report,sidecar,feed,universe,liveBoard:true});
    assert.equal(sidecar.forecastEvidence.records.length,2);assert.equal(buildGameIntelligence({report,sidecar,feed,universe}).counts.withExternalModels,1);
    assert.equal(first.acquisition.oddsApiRequests,0);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('connection is restricted to the confirmed non-commercial deployment and forward cutoff',async()=>{
  for(const [r,when] of [[{...registry,projectUse:{mode:'COMMERCIAL'}},at],[registry,'2026-10-06T17:54:59Z']]){
    const root=tempRoot(r),urls=[];
    try{const capture=await collect({root,at:when,fetchImpl:fakeFetch(urls)});assert.equal(capture.records.some(r=>r.sourceId==='moneypuck'),false);assert.equal(urls.some(u=>u.includes('moneypuck.com')),false);}
    finally{fs.rmSync(root,{recursive:true,force:true});}
  }
});
