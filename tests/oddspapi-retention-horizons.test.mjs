#!/usr/bin/env node
import fs from 'node:fs';
import {ODDS_REQUEST_SPACING_MS,planTournamentBatches} from '../tools/oddspapi-observer.mjs';

const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const observer=fs.readFileSync('tools/oddspapi-observer.mjs','utf8');
const primary=fs.readFileSync('tools/odds-refresh-worker-source.yml','utf8');

assert(observer.includes("RETENTION_HORIZONS_HOURS={default:30,NFL:384,NFL_PRESEASON:192,BOXING:30}"),'OddsPapi retention horizons must keep regular-season NFL at 384h, preseason at 192h, and Boxing/default at 30h');
assert(observer.includes("ALWAYS_OBSERVE=new Set(['NFL','NFL_PRESEASON'])"),'NFL regular season and preseason must be observed even when outside the primary 30h snapshot');
assert(observer.includes("const selected=TOURNAMENTS.filter(t=>ALWAYS_OBSERVE.has(t.key)||active.has(t.key)"),'OddsPapi tournament selection must include always-observed NFL categories');
assert(observer.includes("const retentionHorizonHours=fixtureHorizonHours(f)"),'fixture-specific retention horizon must be applied after the batched OddsPapi responses');
assert(observer.includes("retentionHorizonHours,primaryMatch:match,pinnacle"),'each retained fixture must expose its applied horizon for auditability');
assert(observer.includes("bookmaker:'pinnacle'"),'OddsPapi observer must remain Pinnacle-specific');
assert(observer.includes('const RESERVE=25;'),'25-request OddsPapi reserve must remain protected');

const selected=Array.from({length:6},(_,i)=>({key:`TEST_${i+1}`,id:i+1}));
const batches=planTournamentBatches(selected);
assert(batches.length===2,'six selected tournaments must be split into two OddsPapi calls');
assert(batches.every(batch=>batch.length<=5),'OddsPapi requests must never contain more than five tournament IDs');
assert(batches.flat().map(t=>t.id).join(',')==='1,2,3,4,5,6','tournament batching must preserve all selected IDs and their order');
assert(ODDS_REQUEST_SPACING_MS>=750,'batched OddsPapi calls must be spaced beyond the observed 524ms endpoint throttle');
assert(observer.includes('if(index>0)await pause(ODDS_REQUEST_SPACING_MS)'),'the observer must apply governed pacing between tournament batches');
assert(observer.includes('estimatedRemainingAfter=remaining===null?null:remaining-batches.length'),'quota projection must account for every planned odds request');
assert(observer.includes('observation.diagnostics.billableRequestsThisRun++'),'observer diagnostics must count every attempted odds request');

assert(primary.includes('const HORIZON_HOURS = 30;'),'primary Betting Edge odds worker must retain its 30-hour event horizon');

console.log('ODDSPAPI RETENTION HORIZONS: PASS // NFL 384h // BOXING 30h // MAX 5 IDS // BATCHES PACED');
