#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ODDS_REQUEST_SPACING_MS,planTournamentBatches,selectRelevantTournaments} from '../tools/oddspapi-observer.mjs';

const observer=fs.readFileSync('tools/oddspapi-observer.mjs','utf8');
const primary=fs.readFileSync('tools/odds-refresh-worker-source.yml','utf8');
assert.ok(observer.includes('RETENTION_HORIZONS_HOURS={default:30,NFL:384,NFL_PRESEASON:192,BOXING:30}'),'regular-season NFL384h, actual preseason192h and default/boxing30h remain');
const now=Date.parse('2026-11-01T14:00:00Z');
const empty=selectRelevantTournaments({events:[]},now);
assert.deepEqual(empty.selected.map(t=>t.key),['NFL'],'Graham regular-season runway remains, preseason is no longer unconditional');
const preseason=selectRelevantTournaments({quoteObservationVersion:1,generatedAt:new Date(now).toISOString(),bookmakers:['DraftKings'],events:[{
  id:'preseason',date:new Date(now+3600000).toISOString(),sport:{slug:'american-football'},league:{name:'NFL Preseason'},bookmakers:{DraftKings:[{name:'ML',observedAt:new Date(now).toISOString(),odds:[{home:2,away:1.9}]}]}
}]},now);
assert.ok(preseason.selected.some(t=>t.key==='NFL_PRESEASON'),'real upcoming priced preseason still receives its own tournament');
assert.ok(observer.includes('retentionHorizonHours=fixtureHorizonHours(f)'),'fixture-specific retention applies after collection');
assert.ok(observer.includes('retentionHorizonHours,primaryMatch:match,pinnacle'),'retained fixtures expose their actual horizon');
assert.ok(observer.includes("bookmaker:'pinnacle'"),'observer stays Pinnacle-specific');
assert.ok(observer.includes('const RESERVE=5;'),'five-request reserve retained');
const selected=Array.from({length:6},(_,i)=>({key:`TEST_${i+1}`,id:i+1}));
const batches=planTournamentBatches(selected);
assert.equal(batches.length,2);assert.ok(batches.every(batch=>batch.length<=5));
assert.deepEqual(batches.flat().map(t=>t.id),[1,2,3,4,5,6],'batching preserves selected order');
assert.ok(ODDS_REQUEST_SPACING_MS>=750,'spacing remains beyond the observed524ms throttle');
assert.ok(observer.includes('if(index>0)await pause(ODDS_REQUEST_SPACING_MS)'),'batch pacing retained');
assert.ok(observer.includes('recordBudgetSpend')&&observer.includes('metadataRequests:'),'shared budget includes both odds and metadata');
assert.ok(primary.includes('const HORIZON_HOURS = 30;'),'primary worker horizon remains30h');
console.log('ODDSPAPI RETENTION: NFL384h, actual preseason192h, no automatic preseason, five-ID batches and pacing PASS');
