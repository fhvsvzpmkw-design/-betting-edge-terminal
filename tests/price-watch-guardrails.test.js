const assert = require('assert');
const fs = require('fs');

const runner = fs.readFileSync('runner-core.html', 'utf8');
const contract = fs.readFileSync('BETTING_EDGE_CONTRACT.md', 'utf8');

assert(runner.includes("['ALL','BET','LEAN','WAIT','PASS'].forEach"), 'status filters must remain the original four statuses');
assert(!runner.includes('PASS · PRICE WATCH'), 'PRICE WATCH must never be encoded into status text');

const helperStart = runner.indexOf('function priceWatchMeta(r)');
const helperEnd = runner.indexOf('function card(d,r)', helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'priceWatchMeta helper must exist');
const helper = runner.slice(helperStart, helperEnd);
assert(helper.includes("String(r?.status||'PASS').toUpperCase()!=='PASS'"), 'runner must refuse PRICE WATCH rendering for non-PASS statuses');
assert(helper.includes('w.active===false'), 'inactive PRICE WATCH metadata must not render');
assert(helper.includes('if(!target)return null'), 'PRICE WATCH must have an explicit target');

const weightStart = runner.indexOf('function recWeight(rec)');
const weightEnd = runner.indexOf('function moveSignal(rec)', weightStart);
assert(weightStart >= 0 && weightEnd > weightStart, 'recWeight block must exist');
assert(!/priceWatch|PRICE WATCH/i.test(runner.slice(weightStart, weightEnd)), 'VigScope status weighting must remain blind to PRICE WATCH');

const normalizeStart = runner.indexOf('function normalizeRun(run)');
const normalizeEnd = runner.indexOf('function runKey(run)', normalizeStart);
assert(normalizeStart >= 0 && normalizeEnd > normalizeStart, 'normalizeRun block must exist');
const normalize = runner.slice(normalizeStart, normalizeEnd);
assert(normalize.includes('counts:{bet:Number(c.bet)||0,lean:Number(c.lean)||0,wait:Number(c.wait)||0,pass:Number(c.pass)||0}'), 'runner counts must remain BET/LEAN/WAIT/PASS only');

assert(contract.includes('`PRICE WATCH` is **not a fifth recommendation status**'), 'contract must define PRICE WATCH as metadata, not status');
assert(contract.includes('does **not** alter recommendation status, risk, stake, status counts, runner filters, VigScope meter inputs/weights'), 'contract must protect downstream logic');
assert(contract.includes('`priceWatch.target` is separate from `playTo`'), 'watch target must not become an automatic bet threshold');
assert(contract.includes('not automatically carried forward'), 'later cards must independently qualify PRICE WATCH');
assert(contract.includes('crossing the watch target is informational only'), 'repricing must not auto-promote PRICE WATCH');

console.log('PRICE WATCH guardrails: PASS');
