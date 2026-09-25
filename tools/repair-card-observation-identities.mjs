#!/usr/bin/env node
// Explicit, source-pinned metadata correction. Never regrades a completed card.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const ID = 'legacy-identities-20260925-v1';
const AUDIT = `data/history/grading/corrections/${ID}.json`;
const TEMP = '/tmp/card-identity-cleanup.json';
const BEFORE_INDEX = '/tmp/card-identity-index-before.json';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, value) => { fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n'); };
const blob = p => execFileSync('git', ['hash-object', '--', p], {encoding:'utf8'}).trim();
const clone = value => structuredClone(value);
const entries = [
  {date:'2026-08-27', file:'main-080856.json', sourceSha:'9753eab6f44b8f29a8f68708b4ab59bf4dc362e5', observationSha:'b706873a164ddae2a6ffd9a1d3e9f659eb38e48e', count:9, indices:[7], keys:['68096250|totals|over||167.5'], eventCorrection:true},
  {date:'2026-09-19', file:'evening-151645.json', sourceSha:'2d36af65ddfaf62e37caf0ea2a98038581f8c2be', observationSha:'3d4bb78b000f9055838f45d823a5d73cc0ddaa5b', count:6, keys:['70923768|totals|over||54.5','70923768|totals|under||54.5','68096230|ml|away||','68096230|ml|home||','68096230|totals|over||175.5','68096230|totals|under||175.5']},
  {date:'2026-09-19', file:'final_morning-093100.json', sourceSha:'060cbfab38f123a3417fb9c3c8d34f04c6e947a0', observationSha:'53bb855f936d26536512d3717e61751867059b21', count:8, keys:['63301435|totals|over||7','63301435|totals|under||7','63301411|ml|away||','63301411|ml|home||','63303543|totals|over||8.5','63303543|totals|under||8.5','63301201|ml|home||','63301201|ml|away||']},
  {date:'2026-09-19', file:'late-182534.json', sourceSha:'2768aaaaa63d486e710ef339b644ba95c421c25e', observationSha:'a087797668ded89032a046e7725f42345d86a400', count:6, keys:['63301653|ml|away||','63301653|ml|home||','70898634|ml|away||','70898634|ml|home||','70918820|spread|away||26.5','70918820|spread|home||26.5']},
  {date:'2026-09-19', file:'main-081200.json', sourceSha:'36cb4714d15664e31da587071a2bbe72bf32b4ef', observationSha:'ee5b710749c05220cc75026ff1680eb975648b3c', count:14, keys:['63299337|totals|over||8','63299337|totals|under||8','63299447|totals|over||8.5','63299447|totals|under||8.5','63301201|totals|over||8','63301201|totals|under||8','63301823|totals|over||9.5','63301823|totals|under||9.5','63301839|totals|over||8','63301839|totals|under||8','63301839|ml|away||','63301839|ml|home||','63303543|ml|away||','63303543|ml|home||']}
];

function validateSettlement(rec, completion) {
  assert.equal(completion.state, 'complete');
  assert.equal(completion.verificationState, 'verified');
  assert.ok(completion.source?.name && completion.source?.url, 'Existing settlement source required');
  assert.ok(['BET','LEAN','WAIT','PASS'].includes(rec.status));
  assert.equal(completion.official, rec.status === 'BET');
  assert.equal(completion.hypothetical, rec.status !== 'BET');
  const f = rec.feed, parts = String(f.selectionKey).split('|');
  assert.equal(parts[0], String(f.eventId), 'Issued event/key conflict');
  const market = String(f.marketKey || f.market).toLowerCase();
  assert.equal(parts[1], market); assert.equal(parts[2], f.side);
  assert.equal(completion.settlementMethod, 'final_score', 'Only ordinary final-score settlements are in scope');
  assert.ok(completion.settlementComponents === null || completion.settlementComponents === undefined);
  const score = completion.finalScore;
  for (const value of [score?.homeScore, score?.awayScore]) assert.ok(typeof value === 'number' && Number.isInteger(value) && value >= 0, 'Verified finite score required');
  assert.ok(score.home && score.away && score.home !== score.away);
  let delta;
  if (market === 'ml') {
    assert.ok(['home','away'].includes(f.side));
    assert.notEqual(score.homeScore, score.awayScore, 'Tied moneyline is outside this correction');
    assert.equal(completion.line, null);
    delta = f.side === 'home' ? score.homeScore - score.awayScore : score.awayScore - score.homeScore;
  } else {
    assert.ok(['totals','spread'].includes(market), 'Unsupported settlement market');
    const raw = f.hdp ?? f.line;
    assert.ok(typeof raw === 'number' && Number.isFinite(raw) && Number.isInteger(raw * 2), 'Only whole/half lines are in scope');
    assert.equal(Number(parts.at(-1)), raw);
    if (market === 'totals') {
      assert.ok(['over','under'].includes(f.side));
      assert.equal(completion.line, raw);
      assert.equal(completion.observedValue, score.homeScore + score.awayScore);
      delta = (score.homeScore + score.awayScore - raw) * (f.side === 'over' ? 1 : -1);
    } else {
      assert.ok(['home','away'].includes(f.side));
      const line = f.side === 'home' ? raw : -raw;
      assert.equal(completion.line, line, 'Home/away handicap semantics conflict');
      delta = (f.side === 'home' ? score.homeScore - score.awayScore : score.awayScore - score.homeScore) + line;
    }
  }
  assert.equal(completion.grade, delta === 0 ? 'PUSH' : delta > 0 ? 'WIN' : 'LOSS', 'Existing grade does not match exact issued selection');
}

function repairRow(rec, old, eventCorrection = false) {
  validateSettlement(rec, old.completion);
  const next = clone(old);
  if (eventCorrection) {
    assert.equal(rec.title, 'Mystics–Mercury over 167.5 points');
    assert.equal(rec.feed.selectionKey, '68096250|totals|over||167.5');
    assert.equal(rec.feed.eventDate, '2026-08-28T02:00:00Z');
    assert.equal(old.selectionKey, '68096342|totals|over||167.5');
    assert.equal(old.completion.eventId, '68096342');
    assert.equal(old.title, rec.title); assert.equal(old.status, rec.status);
    assert.equal(old.commenceTime, rec.feed.eventDate);
    assert.deepEqual(old.completion.finalScore, {home:'Phoenix Mercury',away:'Washington Mystics',homeScore:73,awayScore:80});
    assert.equal(old.completion.grade, 'LOSS');
    next.selectionKey = rec.feed.selectionKey;
    next.completion.eventId = String(rec.feed.eventId);
    const allowed = clone(next); allowed.selectionKey = old.selectionKey; allowed.completion.eventId = old.completion.eventId;
    assert.deepEqual(allowed, old, 'Only two identity fields may change');
  } else {
    assert.equal(old.selectionKey ?? null, null, 'Nonempty selection keys require separate review');
    assert.equal(String(old.completion.eventId), String(rec.feed.eventId), 'Do not repair a reordered or wrong-event result');
    const identity = {title:rec.title ?? null,status:rec.status,book:rec.book ?? null,selectionKey:rec.feed.selectionKey,commenceTime:rec.feed.eventDate ?? null};
    for (const [key, value] of Object.entries(identity)) {
      if (Object.hasOwn(old, key) && old[key] !== null) assert.deepEqual(old[key], value, `Conflicting ${key}`);
      next[key] = value;
    }
    assert.deepEqual(next.completion, old.completion, 'Existing settlements must remain exact');
    for (const key of Object.keys(old)) if (!Object.hasOwn(identity,key)) assert.deepEqual(next[key], old[key], `Unrelated field changed: ${key}`);
  }
  return next;
}

function prepare(requestPath) {
  const request = read(requestPath);
  if (request.identityCleanup === undefined) { write(TEMP,{state:'NOT_REQUESTED',observationPaths:[],auditPath:null}); return; }
  assert.equal(request.identityCleanup, ID, 'Only this explicitly approved, pinned correction is permitted');
  assert.equal(request.schema,1); assert.equal(request.state,'READY');
  assert.equal(request.targetDate,'2026-09-24');
  assert.ok(!fs.existsSync(AUDIT), 'Correction already recorded; do not replay it');
  const plans = [], repairs = [], sourceBlobs = {}, beforeBlobs = {};
  for (const item of entries) {
    const source = `data/history/runs/${item.date}/${item.file}`;
    const output = source.replace('/runs/','/observations/');
    assert.equal(blob(source),item.sourceSha,`Immutable source changed: ${source}`);
    assert.equal(blob(output),item.observationSha,`Observation changed since review: ${output}`);
    sourceBlobs[source] = item.sourceSha; beforeBlobs[output] = item.observationSha;
    const run = read(source), obs = read(output), result = clone(obs);
    assert.equal(obs.sourceRun,source); assert.equal(obs.runId,run.ts);
    assert.equal(obs.recommendations.length,item.count); assert.equal(run.recs.length,item.count);
    const indices = item.indices || item.keys.map((_,i)=>i);
    for (const [position,index] of indices.entries()) {
      const rec = run.recs[index], old = obs.recommendations[index];
      assert.equal(rec.feed.selectionKey,item.keys[position],`Issued row order mismatch: ${source}#${index}`);
      const next = repairRow(rec,old,Boolean(item.eventCorrection));
      result.recommendations[index] = next;
      repairs.push({sourceRun:source,observationPath:output,index,sourceBlobSha:item.sourceSha,reason:item.eventCorrection?'Correct observation-only event ID to exact immutable issued ID; teams, time, line and result agree':'Restore missing observation identity from pinned issued row; completion event ID, line and grade validated',issuedIdentity:{title:rec.title,status:rec.status,book:rec.book,feed:rec.feed},before:old,after:next,gradeChanged:false,sourceEvidencePreserved:true});
    }
    for (const [index,old] of obs.recommendations.entries()) if (!indices.includes(index)) assert.deepEqual(result.recommendations[index],old);
    plans.push({source,output,result});
  }
  assert.equal(repairs.length,35);
  // All five inputs and all 35 row mappings must validate before any output write.
  write(BEFORE_INDEX,read('data/history/results-index.json'));
  const audit = {schema:1,correctionId:ID,state:'METADATA_VALIDATED',requestId:request.requestId,authorizedBy:'Explicit user request to clean up the remaining August 27 and September 19 integrity warnings',appliedAt:new Date().toISOString(),inputCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceBlobs,beforeObservationBlobs:beforeBlobs,cardsCorrected:35,missingKeysRestored:34,eventIdCorrections:1,gradesChanged:0,priceAnalyticsChanged:false,externalScoreCrossCheck:{reviewedOn:'2026-09-25',eventDate:'2026-08-27',away:'Washington Mystics',home:'Phoenix Mercury',awayScore:80,homeScore:73,sources:[{name:'CBS Sports / AP final scoreboard',url:'https://www.cbssports.com/wnba/gametracker/live/WNBA_20260827_WAS%40PHO/'},{name:'Basketball-Reference box score',url:'https://www.basketball-reference.com/wnba/boxscores/202608270PHO.html'}]},repairs,isolation:'Historical observation metadata only. All original completions, prices, timestamps and source evidence preserved except the explicitly corrected August 27 completion.eventId; issued reports and live production unchanged.'};
  for (const p of plans) { write(p.output,p.result); assert.equal(blob(p.source),sourceBlobs[p.source]); }
  audit.afterObservationBlobs = Object.fromEntries(plans.map(p=>[p.output,blob(p.output)]));
  write(AUDIT,audit);
  write(TEMP,{state:'METADATA_VALIDATED',correctionId:ID,observationPaths:plans.map(p=>p.output),auditPath:AUDIT,cardsCorrected:35,missingKeysRestored:34,eventIdCorrections:1,gradesChanged:0});
  console.log('Validated and prepared 35 pinned historical identity corrections; grades unchanged.');
}

function checkIndex() {
  const summary = read(TEMP); if (summary.state === 'NOT_REQUESTED') return;
  const before = read(BEFORE_INDEX), after = read('data/history/results-index.json'), comparison = {};
  for (const date of ['2026-08-27','2026-09-19']) {
    const a = before.byDate.find(x=>x.name===date), b = after.byDate.find(x=>x.name===date);
    assert.ok(a && b, `Missing affected date in results index: ${date}`);
    const fields = ['issued','complete','unresolved','grades','priced','netUnits','roiPct'];
    const pick = obj => Object.fromEntries(fields.map(key=>[key,obj[key]??null]));
    assert.deepEqual(pick(b),pick(a),`Metadata correction changed results for ${date}`);
    comparison[date] = {before:pick(a),after:pick(b)};
  }
  const audit = read(AUDIT);
  for (const r of audit.repairs) {
    assert.deepEqual(read(r.observationPath).recommendations[r.index],r.after,'Corrected row changed during grading');
    assert.equal(blob(r.sourceRun),r.sourceBlobSha,'Issued report changed');
  }
  const runtime = read('/tmp/card-grading-runtime.json');
  const remaining = (runtime.legacyIntegrityWarnings||[]).filter(w=>audit.repairs.some(r=>r.sourceRun===w.sourceRun && r.index===w.index));
  assert.equal(remaining.length,0,'Targeted integrity warnings remain');
  audit.state = 'VERIFIED'; audit.indexReconciliation = {passed:true,dates:comparison};
  audit.remainingTargetedWarnings = remaining.length;
  audit.remainingHistoricalWarnings = (runtime.legacyIntegrityWarnings||[]).length;
  write(AUDIT,audit);
  Object.assign(summary,{state:'VERIFIED',indexReconciled:true,remainingTargetedWarnings:0,remainingHistoricalWarnings:audit.remainingHistoricalWarnings});
  write(TEMP,summary); console.log(JSON.stringify(summary));
}

function selfTest() {
  const rec = {title:'Example over 7',status:'PASS',book:'Bet365',feed:{eventId:'1',selectionKey:'1|totals|over||7',eventDate:'2026-09-19T20:00:00Z',marketKey:'totals',side:'over',hdp:7,line:7}};
  const old = {completion:{state:'complete',verificationState:'verified',grade:'WIN',official:false,hypothetical:true,eventId:'1',finalScore:{home:'Home',away:'Away',homeScore:5,awayScore:4},settlementMethod:'final_score',line:7,observedValue:9,settlementComponents:null,source:{name:'Fixture source',url:'https://example.test/final'},verifiedAt:'2026-09-20T00:00:00Z'}};
  const immutable = clone(old), repaired = repairRow(rec,old);
  assert.equal(repaired.selectionKey,rec.feed.selectionKey); assert.deepEqual(old,immutable); assert.deepEqual(repaired.completion,old.completion);
  let bad = clone(old); bad.completion.eventId='2'; assert.throws(()=>repairRow(rec,bad));
  bad=clone(old); bad.completion.grade='LOSS'; assert.throws(()=>repairRow(rec,bad));
  bad=clone(old); bad.selectionKey='2|totals|over||7'; assert.throws(()=>repairRow(rec,bad));
  bad=clone(old); bad.completion.finalScore.homeScore=null; assert.throws(()=>repairRow(rec,bad));
  bad=clone(old); bad.title='Another card'; assert.throws(()=>repairRow(rec,bad));
  const spread=clone(rec), spreadOld=clone(old); Object.assign(spread.feed,{marketKey:'spread',side:'away',hdp:26.5,line:26.5,selectionKey:'1|spread|away||26.5'}); Object.assign(spreadOld.completion,{grade:'LOSS',line:-26.5,observedValue:null,finalScore:{home:'Home',away:'Away',homeScore:10,awayScore:31}});
  assert.equal(repairRow(spread,spreadOld).completion.grade,'LOSS');
  bad=clone(spreadOld); bad.completion.line=26.5; assert.throws(()=>repairRow(spread,bad));
  const aug=clone(rec), augOld=clone(old); aug.title='Mystics–Mercury over 167.5 points'; Object.assign(aug.feed,{eventId:'68096250',eventDate:'2026-08-28T02:00:00Z',selectionKey:'68096250|totals|over||167.5',hdp:167.5,line:167.5}); Object.assign(augOld,{title:aug.title,status:'PASS',commenceTime:aug.feed.eventDate,selectionKey:'68096342|totals|over||167.5'}); Object.assign(augOld.completion,{eventId:'68096342',grade:'LOSS',line:167.5,observedValue:153,finalScore:{home:'Phoenix Mercury',away:'Washington Mystics',homeScore:73,awayScore:80}});
  assert.equal(repairRow(aug,augOld,true).completion.eventId,'68096250');
  bad=clone(augOld); bad.completion.finalScore.away='Other team'; assert.throws(()=>repairRow(aug,bad,true));
  assert.throws(()=>repairRow(rec,repaired));
  assert.equal(entries.reduce((n,e)=>n+e.keys.length,0),35);
  console.log('identity-cleanup self-tests PASS: exact mapping, immutable completions, wrong-event/grade/key/score/title rejection, spread sign, pinned event correction and replay rejection');
}
const mode = process.argv[2];
if (mode === '--self-test') selfTest();
else if (mode === '--request' && process.argv[3]) prepare(process.argv[3]);
else if (mode === '--check-index') checkIndex();
else throw new Error('Usage: --self-test | --request <request.json> | --check-index');
