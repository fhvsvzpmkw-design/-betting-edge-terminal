import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {derivePrimaryMarketInstrumentTelemetry,attachPublisherInstrumentTelemetry,usesPrimaryMarketTelemetry} from '../tools/vigscope-meter-telemetry.mjs';

const policy=JSON.parse(fs.readFileSync('data/major-sport-market-coverage-v1.json','utf8'));
const key=(market,side,line='')=>`1|${market}|${side}||${line}`;
const makeFeed=(ts,{ml=[2.1,1.8],spread=-3.5,total=45.5,dkDelta=0}={})=>({generatedAt:ts,events:[{id:1,date:'2026-09-06T23:10:00Z',sport:{slug:'american-football'},league:{slug:'usa-nfl'},bookmakers:Object.fromEntries(['Bet365','DraftKings'].map(book=>[book,[
  {marketKey:'ml',updatedAt:ts,odds:[{home:ml[0]+(book==='DraftKings'?dkDelta:0),away:ml[1],selectionKeys:{home:key('ml','home'),away:key('ml','away')}}]},
  {marketKey:'spread',updatedAt:ts,odds:[{hdp:spread,home:1.91,away:1.91,selectionKeys:{home:key('spread','home',spread),away:key('spread','away',spread)}}]},
  {marketKey:'totals',updatedAt:ts,odds:[{hdp:total,over:1.91,under:1.91,selectionKeys:{over:key('totals','over',total),under:key('totals','under',total)}}]}
]]))}]});
const feed=makeFeed('2026-09-06T22:05:00Z',{dkDelta:.05});
const before=makeFeed('2026-09-06T21:00:00Z',{ml:[2,1.9]});
const report={slot:'evening',ts:'2026-09-06T15:15:00-07:00',feedGeneratedAt:feed.generatedAt,recs:[]};
const args={report,feed,policy,feedBlobSha:'a'.repeat(40),coverageAuthorityBlobSha:'c'.repeat(40),oddsSnapshots:[{blobSha:'b'.repeat(40),feed:before}]};
const derive=overrides=>derivePrimaryMarketInstrumentTelemetry({...args,...overrides});
const rec=(side='home',status='BET',market='ml',line='')=>({status,book:'Bet365',price:'+110',playTo:'+100',feed:{selectionKey:key(market,side,line)}});
const original=JSON.stringify({report,feed,before});
const zero=derive();
assert.equal(zero.calculationVersion,3);
assert.equal(zero.sample.requiredSelections,6);
assert.equal(zero.sample.availableSelections,6);
assert.equal(zero.sample.quoteCount,12);
assert.equal(zero.movement.comparableSelections,6);
assert.equal(zero.movement.changedSelections,2);
assert.equal(zero.agreement.pairs,6);
assert.equal(zero.heat.state,'MEASURED');
assert.ok(zero.heat.value>0,'verified market movement survives zero displayed cards');
assert.equal(zero.pressure.state,'UNMEASURED');
assert.equal(zero.pressure.reason,'NO_DIRECTIONAL_REFERENCE');
assert.equal(zero.pressure.confidence,0);
assert.equal(JSON.stringify({report,feed,before}),original,'market telemetry cannot mutate inputs or decisions');

const noBaseline=derive({oddsSnapshots:[]});
assert.equal(noBaseline.agreement.state,'MEASURED');
assert.equal(noBaseline.heat.state,'PARTIAL');
assert.equal(noBaseline.heat.reason,'CURRENT_AGREEMENT_ONLY');
assert.equal(noBaseline.movement.state,'UNMEASURED');
const unchangedFeed=makeFeed(feed.generatedAt),unchangedBefore=makeFeed(before.generatedAt);
const unchanged=derive({feed:unchangedFeed,oddsSnapshots:[{blobSha:'b'.repeat(40),feed:unchangedBefore}],report:{...report,recs:[rec()]}});
assert.equal(unchanged.movement.state,'MEASURED');
assert.equal(unchanged.movement.changedSelections,0);
assert.equal(unchanged.heat.value,0,'measured zero heat is a valid result');
assert.equal(unchanged.pressure.state,'MEASURED');
assert.equal(unchanged.pressure.value,50,'unchanged real stance prices are measured neutral');
assert.equal(unchanged.pressure.confidence,100);

const withStance=derive({report:{...report,recs:[rec()]}});
assert.deepEqual(withStance.sample,zero.sample);
assert.deepEqual(withStance.heat,zero.heat);
assert.deepEqual(withStance.agreement,zero.agreement);
assert.equal(withStance.pressure.directionalSelections,1);
assert.equal(withStance.pressure.comparableSelections,1);
assert.ok(withStance.pressure.value>50);
const pass=derive({report:{...report,recs:[rec('home','PASS')]}});
assert.equal(pass.pressure.reason,'NO_DIRECTIONAL_REFERENCE','a curated PASS card does not imply a price preference');
const statusChange=derive({report:{...report,recs:[{...rec('home','WAIT'),playTo:'+900'}]}});
assert.deepEqual(statusChange.heat,withStance.heat,'card status/threshold cannot alter market-wide heat');
assert.deepEqual(statusChange.pressure,withStance.pressure,'directional referents are uniformly weighted');
const duplicate=derive({report:{...report,recs:[rec(),rec()]}});
assert.deepEqual(duplicate.pressure,withStance.pressure,'duplicate cards cannot overweight a stance');
const conflict=derive({report:{...report,recs:[rec('home'),rec('away','LEAN')]}});
assert.equal(conflict.pressure.reason,'CONFLICTING_DIRECTIONAL_REFERENCES');
assert.equal(conflict.pressure.conflictingSelections,2);
assert.equal(conflict.pressure.state,'UNMEASURED','opposing sides cannot cancel to fabricated neutral pressure');

const movedLines=derive({oddsSnapshots:[{blobSha:'b'.repeat(40),feed:makeFeed(before.generatedAt,{spread:-4,total:46})}]});
assert.equal(movedLines.movement.comparableSelections,2,'line changes do not become same-contract price movement');
assert.ok(movedLines.movement.comparisons.every(c=>c.selectionKey.includes('|ml|')));
const differingBooks=structuredClone(feed);
const dkSpread=differingBooks.events[0].bookmakers.DraftKings[1];dkSpread.odds[0]={hdp:-4,home:1.91,away:1.91,selectionKeys:{home:key('spread','home',-4),away:key('spread','away',-4)}};
assert.equal(derive({feed:differingBooks}).agreement.pairs,4,'cross-book agreement cannot compare different primary lines');
const crossBefore=structuredClone(before),crossCurrent=structuredClone(feed);
delete crossBefore.events[0].bookmakers.Bet365;delete crossCurrent.events[0].bookmakers.DraftKings;
assert.equal(derive({feed:crossCurrent,oddsSnapshots:[{blobSha:'b'.repeat(40),feed:crossBefore}]}).movement.comparableSelections,0);

for(const stamp of ['2026-09-05T22:04:59Z',feed.generatedAt,'2026-09-06T22:06:00Z']){
  assert.equal(derive({oddsSnapshots:[{blobSha:'b'.repeat(40),feed:makeFeed(stamp)}]}).movement.comparableSelections,0);
}
const invalid=structuredClone(feed);
for(const markets of Object.values(invalid.events[0].bookmakers))for(const market of markets)market.updatedAt='2026-09-06T21:34:59Z';
assert.equal(derive({feed:invalid}).sample.availableSelections,0,'stale current quotes are excluded');
const future=structuredClone(feed);
for(const markets of Object.values(future.events[0].bookmakers))for(const market of markets)market.updatedAt='2026-09-06T22:05:01Z';
assert.equal(derive({feed:future}).sample.availableSelections,0,'future-dated quotes are excluded');
const suspended=structuredClone(feed);
for(const markets of Object.values(suspended.events[0].bookmakers)){
  for(const market of [...markets]){const newest=structuredClone(market);market.updatedAt='2026-09-06T22:04:00Z';newest.suspended=true;markets.push(newest);}
}
assert.equal(derive({feed:suspended}).sample.availableSelections,0,'newest suspension cannot be rescued with an older quote in that feed');
const suspendedBaseline=structuredClone(before);
for(const markets of Object.values(suspendedBaseline.events[0].bookmakers))for(const market of markets)market.suspended=true;
assert.equal(derive({oddsSnapshots:[{blobSha:'b'.repeat(40),feed:suspendedBaseline}]}).movement.comparableSelections,0);
const staleBaseline=structuredClone(before);
for(const markets of Object.values(staleBaseline.events[0].bookmakers))for(const market of markets)market.updatedAt='2026-09-06T20:29:00Z';
assert.equal(derive({oddsSnapshots:[{blobSha:'b'.repeat(40),feed:staleBaseline}]}).movement.comparableSelections,0);
const onlyPinnacle=structuredClone(feed);onlyPinnacle.events[0].bookmakers={Pinnacle:onlyPinnacle.events[0].bookmakers.Bet365};
assert.equal(derive({feed:onlyPinnacle}).sample.availableSelections,0);
const identityMismatch=structuredClone(feed);
for(const markets of Object.values(identityMismatch.events[0].bookmakers))for(const market of markets)for(const row of market.odds)for(const side of Object.keys(row.selectionKeys))row.selectionKeys[side]=row.selectionKeys[side].replace(/^1\|/,'999|');
assert.equal(derive({feed:identityMismatch}).sample.availableSelections,0);
const thirteenSnapshots=Array.from({length:13},(_,i)=>{
  const snapshot=makeFeed(new Date(Date.parse(feed.generatedAt)-(i+1)*60000).toISOString());
  if(i<12)for(const markets of Object.values(snapshot.events[0].bookmakers))for(const market of markets)market.suspended=true;
  return {blobSha:(i+1).toString(16).padStart(40,'0'),feed:snapshot};
});
assert.equal(derive({oddsSnapshots:thirteenSnapshots}).movement.comparableSelections,0,'a thirteenth older snapshot cannot expand the bounded baseline search');
assert.equal(usesPrimaryMarketTelemetry({ts:'2026-09-05T23:59:59-07:00'}),false);
assert.equal(usesPrimaryMarketTelemetry({ts:'2026-09-06T00:00:00-07:00'}),true);

const root=fs.mkdtempSync(path.join(os.tmpdir(),'primary-market-meter-'));
const gate=path.resolve('tools/vigscope-meter-telemetry-gate.mjs');
const write=(file,value)=>{const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});const raw=JSON.stringify(value,null,2)+'\n';fs.writeFileSync(dest,raw);return execFileSync('git',['hash-object','-w','--stdin'],{cwd:root,input:raw,encoding:'utf8'}).trim();};
try{
  execFileSync('git',['init','-q',root]);
  const currentSha=write('data/live-odds.json',feed),beforeSha=write('before.json',before),authoritySha=write('data/major-sport-market-coverage-v1.json',policy);
  const archive={entries:[{generatedAt:before.generatedAt,snapshotBlobSha:beforeSha,indexedAtUtc:'2026-09-06T21:01:00Z'}]};
  write('data/history/odds-index.json',archive);
  const index={runs:[]};write('run-history.json',index);
  const sidecar={provenance:{feedBlobSha:currentSha},coverageAudit:{authorityBlobSha:authoritySha}};
  const issued=structuredClone(report);attachPublisherInstrumentTelemetry({root,index,report:issued,sidecar});
  const reportPath='data/history/runs/2026-09-06/evening-test.json';write(reportPath,issued);write('sidecar.json',sidecar);
  index.runs.push({date:'2026-09-06',ts:report.ts,slot:report.slot,path:reportPath});write('run-history.json',index);
  const validate=()=>spawnSync(process.execPath,[gate,'validate','--root',root,'--report',reportPath,'--sidecar','sidecar.json'],{encoding:'utf8'});
  let result=validate();assert.equal(result.status,0,result.stderr);
  const late=makeFeed('2026-09-06T22:00:00Z',{ml:[3,3]}),lateSha=write('late.json',late);
  archive.entries.push({generatedAt:late.generatedAt,snapshotBlobSha:lateSha,indexedAtUtc:'2026-09-06T22:30:00Z'});write('data/history/odds-index.json',archive);
  write('data/major-sport-market-coverage-v1.json',{...policy,purpose:'later edit'});
  result=validate();assert.equal(result.status,0,result.stderr);
  const replay=structuredClone(report);attachPublisherInstrumentTelemetry({root,index,report:replay,sidecar});
  assert.deepEqual(replay.instrumentTelemetry,issued.instrumentTelemetry,'issued run replays pinned feed, policy and odds index despite later files');
  for(const field of ['heat','pressure','agreement']){
    const tampered=structuredClone(issued);tampered.instrumentTelemetry[field].rawValue=99;write(reportPath,tampered);
    result=validate();assert.notEqual(result.status,0);assert.match(result.stderr,/does not reproduce/);
  }
  const wrongVersion=structuredClone(issued);wrongVersion.instrumentTelemetry.calculationVersion=2;write(reportPath,wrongVersion);
  result=validate();assert.notEqual(result.status,0);assert.match(result.stderr,/version 3/);
  write(reportPath,issued);
  const noIssued=structuredClone(report);attachPublisherInstrumentTelemetry({root,index:{runs:[]},report:noIssued,sidecar});
  assert.ok(noIssued.instrumentTelemetry.movement.comparisons.every(c=>c.baselineFeedBlobSha===beforeSha),'future-indexed snapshots cannot become hindsight baselines');
  console.log('PRIMARY MARKET METERS: PASS // ZERO CARDS + REAL ZERO + NO DIRECTION + EXACT LINES + FRESHNESS/SUSPENSION + PINNED REPLAY');
}finally{fs.rmSync(root,{recursive:true,force:true});}
