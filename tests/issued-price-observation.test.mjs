import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../tools/observe-issued-prices.mjs', import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'issued-observation-'));
const generated = '2026-09-06T16:22:00.000Z';
const changed = '2026-09-06T12:00:00.000Z';
const key = '1|ml|home||';
const quote = (observedAt, decimal = 2) => ({marketKey:'ml', updatedAt:changed, observedAt,
  odds:[{home:decimal,away:1.8,selectionKeys:{home:key,away:'1|ml|away||'}}]});
const feed = () => ({quoteObservationVersion:1, generatedAt:generated, events:[{id:'1',
  bookmakers:{Bet365:[quote('2026-09-06T16:21:00.000Z')]}}]});
const run = {ts:'2026-09-06T16:24:00.000Z',feedGeneratedAt:generated,slot:'final_morning',recs:[{
  title:'Home ML',status:'PASS',price:'+100',book:'Bet365',feed:{eventId:'1',eventDate:'2026-09-06T20:00:00Z',marketKey:'ml',side:'home',selectionKey:key}
}]};
const write = (rel, data) => {const target=path.join(root,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(data));};
const blob = data => execFileSync('git',['hash-object','-w','--stdin'],{cwd:root,input:JSON.stringify(data),encoding:'utf8'}).trim();
function observe(first, later) {
  const snapshots = [first, later].filter(Boolean);
  write('data/history/odds-index.json',{entries:snapshots.map(snapshot => ({generatedAt:snapshot.generatedAt,snapshotBlobSha:blob(snapshot)}))});
  const resultPath=path.join(root,'observed.json');
  fs.rmSync(resultPath,{force:true});
  execFileSync(process.execPath,[script,'run.json','--output',resultPath],{cwd:root,stdio:'pipe'});
  return JSON.parse(fs.readFileSync(resultPath,'utf8'));
}
try {
  execFileSync('git',['init','--quiet'],{cwd:root});
  write('run.json',run);
  const later=feed();later.generatedAt='2026-09-06T18:00:00.000Z';
  later.events[0].bookmakers.Bet365=[quote('2026-09-06T17:59:00.000Z')];
  const result=observe(feed(),later), rec=result.recommendations[0];
  assert.equal(rec.issued.analysisPriceState,'verified_exact_issued_snapshot');
  assert.equal(rec.issued.analysisQuoteUpdatedAt,changed);
  assert.equal(rec.issued.analysisQuoteObservedAt,'2026-09-06T16:21:00.000Z');
  assert.equal(rec.observation.quoteUpdatedAt,changed);
  assert.equal(rec.observation.quoteObservedAt,'2026-09-06T17:59:00.000Z');
  assert.equal(rec.observation.relativeToIssued,'same','fresh confirmation is not price movement');
  later.events[0].bookmakers.Bet365[0].odds[0].home=2.1;
  assert.equal(observe(feed(),later).recommendations[0].observation.relativeToIssued,'better_for_bettor');
  for (const stamp of [undefined,'','invalid','2026-09-06T16:23:00Z','2026-09-06T15:51:00Z']) {
    const bad=feed();bad.events[0].bookmakers.Bet365[0].observedAt=stamp;
    assert.equal(observe(bad).recommendations[0].issued.analysisPriceState,'unavailable');
  }
  for (const mutate of [
    f => {f.deepMarkets=[{id:'1',bookmakers:{Bet365:[]},bookmakerObservedAt:{Bet365:generated}}];},
    f => {f.events[0].bookmakers.Bet365.push({...quote(generated),odds:[{away:1.8,selectionKeys:{away:'1|ml|away||'}}]});},
    f => {f.events[0].bookmakers.Bet365.push({...quote(generated),suspended:true});},
    f => {f.events[0].bookmakers.Bet365.push(quote('2026-09-06T16:21:00.000Z',2.2));},
    f => {f.events[0].bookmakers.Bet365[0].odds[0].isActive=false;}
  ]) {const bad=feed();mutate(bad);assert.equal(observe(bad).recommendations[0].issued.analysisPriceState,'unavailable');}
  const staleLater=structuredClone(later);staleLater.events[0].bookmakers.Bet365[0].observedAt=generated;
  assert.equal(observe(feed(),staleLater).recommendations[0].observation.state,'unavailable');
  const legacy=feed();delete legacy.quoteObservationVersion;
  assert.equal(observe(legacy).recommendations[0].issued.analysisPriceState,'unavailable');
  legacy.events[0].bookmakers.Bet365[0].updatedAt=generated;
  const old=observe(legacy).recommendations[0].issued;
  assert.equal(old.analysisPriceState,'verified_exact_issued_snapshot');
  assert.equal(Object.hasOwn(old,'analysisQuoteObservedAt'),false);
  console.log('issued price observations: clocks, exact movement, replacement, suspension, invalid observations and historical behavior passed');
} finally {fs.rmSync(root,{recursive:true,force:true});}
