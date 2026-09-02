import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {deriveInstrumentTelemetry} from '../tools/vigscope-meter-telemetry.mjs';

const priorPath='data/history/runs/2026-09-02/open-060215.json';
const currentPath='data/history/runs/2026-09-02/main-080700.json';
const sidecarPath='data/history/research-fit/2026-09-02/main-080700.json';
const prior=JSON.parse(fs.readFileSync(priorPath,'utf8'));
const current=JSON.parse(fs.readFileSync(currentPath,'utf8'));
const sidecar=JSON.parse(fs.readFileSync(sidecarPath,'utf8'));
const feedBlobSha=sidecar?.provenance?.feedBlobSha;
assert.match(feedBlobSha,/^[0-9a-f]{40}$/i);
const feed=JSON.parse(execFileSync('git',['cat-file','blob',feedBlobSha],{encoding:'utf8'}));
assert.equal(feed.generatedAt,current.feedGeneratedAt);

const telemetry=deriveInstrumentTelemetry({
  report:current,
  priorReport:prior,
  feed,
  feedBlobSha,
  priorRunPath:priorPath
});

assert.equal(telemetry.source.state,'PINNED');
assert.equal(telemetry.source.priorRunTs,prior.ts);
assert.ok(telemetry.movement.comparableSelections>0,'08:00 must have at least one exact same-book comparison to 06:00');
assert.ok(telemetry.movement.confidence>0,'08:00 movement telemetry must be measured');
assert.ok(telemetry.heat.confidence>0,'08:00 heat must be measurable from the pinned production evidence');
assert.ok(telemetry.pressure.confidence>0,'08:00 pressure must be measurable from the pinned production evidence');
assert.ok(telemetry.agreement.pairs>0,'08:00 must have at least one exact Bet365/DraftKings pair');
assert.ok(telemetry.agreement.confidence>0,'08:00 agreement must be measured');

// Session-switch regression: the 09:30 publisher-bound meter receipt must
// survive 09:30 -> 08:00 -> 06:00 -> 09:30 navigation. Pre-cutover runs stay
// unmeasured, and REPRICE comparison telemetry must never replace the issued
// publisher-bound receipt.
const finalMorningPath='data/history/runs/2026-09-02/final_morning-093430.json';
const finalMorning=JSON.parse(fs.readFileSync(finalMorningPath,'utf8'));
const runtimeSource=fs.readFileSync('assets/runner-core-runtime.js','utf8');
const normalizeLine=runtimeSource.split(/\r?\n/).find(line=>line.startsWith('function normalizeRun(run){'));
const withoutComparisonLine=runtimeSource.split(/\r?\n/).find(line=>line.startsWith('function withoutComparison(run){'));
assert.ok(normalizeLine,'runner normalizeRun must be present');
assert.ok(withoutComparisonLine,'runner withoutComparison must be present');
const txtForSessionTest=(v,f='—')=>(v===null||v===undefined||v==='')?f:String(v);
const deepCloneForSessionTest=v=>JSON.parse(JSON.stringify(v));
const normalizeRunForTest=new Function('txt','deepClone',`${normalizeLine}; return normalizeRun;`)(txtForSessionTest,deepCloneForSessionTest);
const withoutComparisonForTest=new Function('deepClone',`${withoutComparisonLine}; return withoutComparison;`)(deepCloneForSessionTest);
const normalized0800=normalizeRunForTest(withoutComparisonForTest(current));
const normalized0600=normalizeRunForTest(withoutComparisonForTest(prior));
assert.equal(normalized0800.instrumentTelemetry,null,'08:00 remains pre-cutover/unmeasured');
assert.equal(normalized0600.instrumentTelemetry,null,'06:00 remains pre-cutover/unmeasured');
const returned0930=normalizeRunForTest(withoutComparisonForTest(finalMorning));
assert.equal(returned0930.instrumentTelemetry?.authority,'PUBLISHER_BOUND_FEED_V1');
assert.equal(returned0930.instrumentTelemetry?.heat?.value,17);
assert.equal(returned0930.instrumentTelemetry?.pressure?.value,52);
assert.equal(returned0930.instrumentTelemetry?.agreement?.score,91);
assert.deepEqual(returned0930.instrumentTelemetry,finalMorning.instrumentTelemetry,'09:30 telemetry must survive session normalization unchanged');
const transient=normalizeRunForTest({...finalMorning,instrumentTelemetry:{authority:'REPRICE_COMPARISON_ONLY',heat:{value:99}}});
assert.equal(transient.instrumentTelemetry,null,'non-publisher comparison telemetry must not become saved issued history');
assert.doesNotMatch(runtimeSource,/instrumentTelemetry:buildInstrumentTelemetry\(recs,feed\),/,'REPRICE must not overwrite issued report meters');

console.log(JSON.stringify({
  state:'PASS',
  fixture:'2026-09-02 06:00 -> 08:00 plus 09:30 session telemetry persistence',
  feedBlobSha,
  telemetry,
  sessionTelemetry:{
    heat:returned0930.instrumentTelemetry.heat.value,
    pressure:returned0930.instrumentTelemetry.pressure.value,
    agreement:returned0930.instrumentTelemetry.agreement.score
  }
},null,2));
