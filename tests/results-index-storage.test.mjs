import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {forecastReviewSummary, writeResultsIndex, assertIndexSize} from '../tools/lib/results-index-storage.mjs';

const review = {state:'CONSIDERED', eligibleExactRecordIds:['used'], contextRecordIds:['context'],
  gapReasons:['NO_CURRENT_GOALIE'], records:[{recordId:'used', sourceId:'moneypuck', probability:0.61,
    eligibility:'ELIGIBLE', reasons:[], side:'home', period:'FULL_GAME', line:null,
    limitation:'Historical source explanation. '.repeat(1000), comparison:{diagnostic:'duplicate '.repeat(1000)}}]};
const original = JSON.stringify(review);
const summary = forecastReviewSummary(review);
assert.equal(JSON.stringify(review), original, 'Source research must remain unchanged');
for (const key of ['state','eligibleExactRecordIds','contextRecordIds','gapReasons']) assert.deepEqual(summary[key],review[key]);
for (const key of ['recordId','sourceId','probability','eligibility','reasons','side','period','line']) assert.deepEqual(summary.records[0][key],review.records[0][key]);
assert.ok(JSON.stringify(summary).length < original.length / 10, 'Duplicate research must leave the results index');
assert.deepEqual(forecastReviewSummary({state:'CONSIDERED'}),{state:'CONSIDERED'});
assert.equal(forecastReviewSummary(null),null);
const root = fs.mkdtempSync(path.join(os.tmpdir(),'results-storage-'));
try {
  const file = path.join(root,'index.json'), value = {cards:[{grade:'WIN',units:0.9,forecastReview:summary}]};
  writeResultsIndex(file,value); assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),value);
  assert.equal(fs.readFileSync(file,'utf8').split('\n').length,2);
  const saved = fs.readFileSync(file,'utf8');
  assert.throws(()=>writeResultsIndex(file,value,10),/publication budget/);
  assert.equal(fs.readFileSync(file,'utf8'),saved,'Oversize rejection must preserve the saved index');
  assert.throws(()=>assertIndexSize(file,10),/publication budget/);
} finally {fs.rmSync(root,{recursive:true,force:true});}
console.log('Results storage passed: source provenance retained, duplicate detail removed, compact data roundtrip and publication size guard.');
