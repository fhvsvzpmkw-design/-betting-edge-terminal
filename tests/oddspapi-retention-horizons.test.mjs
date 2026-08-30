#!/usr/bin/env node
import fs from 'node:fs';

const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const observer=fs.readFileSync('tools/oddspapi-observer.mjs','utf8');
const primary=fs.readFileSync('tools/odds-refresh-worker-source.yml','utf8');

assert(observer.includes("RETENTION_HORIZONS_HOURS={default:30,NFL:192,NFL_PRESEASON:192,BOXING:30}"),'OddsPapi retention horizons must keep NFL at 192h and Boxing/default at 30h');
assert(observer.includes("ALWAYS_OBSERVE=new Set(['NFL','NFL_PRESEASON'])"),'NFL regular season and preseason must be observed even when outside the primary 30h snapshot');
assert(observer.includes("const selected=TOURNAMENTS.filter(t=>ALWAYS_OBSERVE.has(t.key)||active.has(t.key)"),'OddsPapi tournament selection must include always-observed NFL categories');
assert(observer.includes("const retentionHorizonHours=fixtureHorizonHours(f)"),'fixture-specific retention horizon must be applied after the shared OddsPapi response');
assert(observer.includes("retentionHorizonHours,primaryMatch:match,pinnacle"),'each retained fixture must expose its applied horizon for auditability');
assert(observer.includes("bookmaker:'pinnacle'"),'OddsPapi observer must remain Pinnacle-specific');
assert(observer.includes('const RESERVE=25;'),'25-request OddsPapi reserve must remain protected');

const oddsCalls=observer.match(/apiGet\('\/odds-by-tournaments'/g)||[];
assert(oddsCalls.length===1,`expected exactly one OddsPapi odds request path, found ${oddsCalls.length}`);
assert(observer.includes('observation.diagnostics.billableRequestsThisRun=1;observation.diagnostics.oddsRequests=1;'),'observer diagnostics must continue to record one odds request');

assert(primary.includes('const HORIZON_HOURS = 30;'),'primary Betting Edge odds worker must retain its 30-hour event horizon');

console.log('ODDSPAPI RETENTION HORIZONS: PASS // NFL 192h // BOXING 30h // ONE PINNACLE ODDS CALL');
