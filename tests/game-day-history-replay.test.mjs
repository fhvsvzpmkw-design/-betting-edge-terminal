import fs from 'node:fs';
import assert from 'node:assert/strict';
import {inspectOpinionReview} from '../tools/opinion-review.mjs';
import {validateReportEvidence} from '../tools/report-evidence-gate.mjs';
const names=['open-062747','main-081824','final_morning-094624'];
const paths=names.flatMap(name=>['runs','research-fit'].map(kind=>`data/history/${kind}/2026-10-03/${name}.json`));
const bytes=paths.map(p=>fs.readFileSync(p));
const reports=names.map(name=>JSON.parse(fs.readFileSync(`data/history/runs/2026-10-03/${name}.json`)));
assert.deepEqual(reports.map(r=>r.counts),[
  {bet:0,lean:2,wait:0,pass:78},{bet:0,lean:2,wait:0,pass:85},{bet:0,lean:0,wait:0,pass:18}
]);
const main=reports[1],final=reports[2];
const sidecar=JSON.parse(fs.readFileSync(paths[5]));
let matched=0;
for (const earlier of main.recs.filter(r=>r.status==='LEAN')) {
  const receipt=sidecar.primaryAnalysis.receipts.find(row=>row.quote?.selectionKey===earlier.feed.selectionKey);
  assert.equal(receipt?.decision?.status,'PASS');
  const forecastComparisons=(receipt.decision.forecastReview?.records||[]).filter(row=>row.eligibility==='ELIGIBLE_EXACT').map(row=>({recordId:row.recordId,...row.comparison}));
  const priorReceipt=JSON.parse(fs.readFileSync(paths[3])).primaryAnalysis.receipts.find(row=>row.quote?.selectionKey===earlier.feed.selectionKey);
  const prior={reportTs:main.ts,row:priorReceipt};
  assert.equal(inspectOpinionReview({report:final,receipt,forecastComparisons,prior}).required,false,'issued morning history retains original eligibility');
  const forward={...final,ts:'2026-10-03T11:40:00-07:00'};
  const review=inspectOpinionReview({report:forward,receipt,forecastComparisons,prior});
  assert.equal(review.required,true);assert.equal(review.complete,false);
  assert.ok(review.missing.includes('PRIOR_LEAN_CHANGE_EXPLANATION_REQUIRED'));
  matched++;
}
assert.equal(matched,2,'both Dodgers and Rays opinions are independently reviewed');
validateReportEvidence(final,sidecar);
assert.throws(()=>validateReportEvidence({...final,ts:'2026-10-03T11:40:00-07:00'},sidecar),/directional review incomplete/,'publisher independently rejects the same weak directional rejection prospectively');
paths.forEach((p,i)=>assert.deepEqual(fs.readFileSync(p),bytes[i]));
console.log('GAME DAY HISTORY REPLAY: PASS // all three issued reports unchanged; weak same-price LEAN removals rejected only prospectively');
