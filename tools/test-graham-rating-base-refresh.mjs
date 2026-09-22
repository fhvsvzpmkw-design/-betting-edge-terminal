import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {refreshRatingBases} from './graham-refresh-rating-bases.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const boardPath='data/walters/nfl/2026/week-03-current-numbers.json';
// Immutable real pre-refresh baseline and published learning receipt.
const at=(commit,p)=>JSON.parse(execFileSync('git',['show',`${commit}:${p}`],{maxBuffer:8*1024*1024}));
const f={board:at('7edf9f1aa9da6496b0d0f7c95b796da9075d8205',boardPath),power:at('7edf9f1aa9da6496b0d0f7c95b796da9075d8205','data/walters/nfl-power-ratings-ledger.json'),staging:at('7edf9f1aa9da6496b0d0f7c95b796da9075d8205','data/walters/nfl/carried-rating-audit-staging.json'),policy:read('data/walters/nfl/graham-fair-decomposition-policy-v1.json'),active:{season:2026,week:3},effectiveAt:'2026-09-22T19:40:00Z',powerBlobSha:execFileSync('git',['rev-parse','7edf9f1aa9da6496b0d0f7c95b796da9075d8205:data/walters/nfl-power-ratings-ledger.json'],{encoding:'utf8'}).trim()};
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
const r=refreshRatingBases(f);
test('separate refresh carries both published team changes into two current games',()=>{assert.deepEqual(r.games.map(g=>[g.gameKey,g.after.exactFairHome,g.after.displayedFairHome]),[['2026-W03-CAR-CLE',-1.172,-1],['2026-W03-MIN-TB',-.067,0]]);});
test('all other games and all adjustment values are preserved',()=>{for(const [i,g] of r.board.games.entries()){assert.deepEqual(g.adjustments,f.board.games[i].adjustments);if(!r.games.some(c=>c.gameKey===g.gameKey))assert.deepEqual(g,f.board.games[i]);}assert.equal(r.board.lastResearchAt,f.board.lastResearchAt);});
test('repeating refresh makes no changes',()=>{const again=refreshRatingBases({...f,board:r.board});assert.equal(again.games.length,0);assert.deepEqual(again.board,r.board);});
test('new carried ratings cannot be used without applied matching receipt',()=>{const c=structuredClone(f);c.staging.state='READY';assert.throws(()=>refreshRatingBases(c),/APPLIED_WEEKLY_RECEIPT/);});
test('intervening unrelated rating cannot be overwritten',()=>{const c=structuredClone(f);c.power.teams.find(t=>t.abbr==='CAR').currentRating+=1;assert.throws(()=>refreshRatingBases(c),/UNRELATED_STALE/);});
test('initial baseline and active week are required',()=>{const c=structuredClone(f);c.active.week=4;assert.throws(()=>refreshRatingBases(c),/ACTIVE_BASELINE/);});
test('unfinished opponents remain explicitly blocked',()=>{for(const g of r.board.games.filter(g=>['CLE','TB'].includes(g.home))){assert.equal(g.weeklyRatingInput.homeUpdateState,'UPDATED');assert.deepEqual(g.weeklyRatingInput.blockedTeams,[g.away]);}});
console.log(`RATING BASE REFRESH: ${n} PASS`);
