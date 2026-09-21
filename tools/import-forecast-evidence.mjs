#!/usr/bin/env node
// Import an actually inspected source capture into a draft. No fetching, fair
// adoption, applicability invention, probability complementation or decisions.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {derivePrimarySelectionInventory} from './major-sport-market-coverage-gate.mjs';
import {forecastCandidate, evaluateForecast, loadForecastSourceRegistry} from './forecast-evidence.mjs';
const list = value => Array.isArray(value) ? value : [];
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

export function importForecastCapture({report, sidecar, capture, universe, feed, registry = loadForecastSourceRegistry()}) {
  if (capture?.schema !== 1 || !Array.isArray(capture.records) || !capture.records.length) throw Error('Capture requires schema 1 and actual records');
  const evidence = structuredClone(sidecar.forecastEvidence || {schema:1, records:[], attempts:[], revalidations:[]});
  evidence.records ||= []; evidence.attempts ||= []; evidence.revalidations ||= [];
  const merge = (rows, incoming, identity) => {
    for (const row of incoming) {
      const matches = rows.filter(existing => identity(existing) === identity(row));
      if (matches.some(existing => !isDeepStrictEqual(existing, row))) throw Error('Conflicting immutable capture identity: '+identity(row));
      if (!matches.length) rows.push(structuredClone(row));
    }
  };
  merge(evidence.revalidations, list(capture.revalidations), row => `${row.recordId}|${row.forReportAt}|${row.checkedAt}`);
  const selections = list(universe?.selections || universe), diagnostics = [];
  for (const record of capture.records) {
    const matches = selections.filter(selection => String(selection.eventId) === String(record.eventId) &&
      selection.marketDetail === record.marketDetail && selection.side === record.side);
    if (matches.length !== 1) throw Error('Capture must map to exactly one available selection: '+record.recordId);
    const candidate = forecastCandidate(matches[0], {feed});
    const review = evaluateForecast(record, candidate, {asOf:report.ts, registry, revalidations:evidence.revalidations});
    if (review.eligibility === 'INELIGIBLE') throw Error(`${record.recordId}: ${review.reasons.join(', ')}`);
    diagnostics.push({recordId:record.recordId, selectionId:candidate.selectionId, eligibility:review.eligibility, reasons:review.reasons});
  }
  merge(evidence.records, capture.records, row => row.recordId);
  for (const attempt of list(capture.attempts)) {
    if (!attempt.attemptId || !registry.sources[attempt.sourceId] || !attempt.finding ||
      !/^https?:\/\//.test(attempt.url || '') || !Number.isFinite(Date.parse(attempt.checkedAt)) ||
      Date.parse(attempt.checkedAt) > Date.parse(report.ts) || !selections.some(row => row.selectionId === attempt.selectionId) ||
      !['FOUND','INACCESSIBLE','STALE','WRONG_LINE','WRONG_MARKET','MISSING_PROBABILITY','INELIGIBLE','NOT_FOUND'].includes(attempt.outcome)) throw Error('Invalid capture attempt');
    if (attempt.outcome === 'FOUND' && (!list(attempt.recordIds).length || !attempt.recordIds.every(id => diagnostics.some(row => row.recordId === id && row.selectionId === attempt.selectionId)))) throw Error('FOUND attempt must bind its actual selection records');
  }
  merge(evidence.attempts, list(capture.attempts), row => row.attemptId);
  return {sidecar:{...structuredClone(sidecar), forecastEvidence:evidence}, diagnostics,
    decisionAuthority:false, instruction:'Run shared draft preparation; explicitly disposition eligible forecasts before publication.'};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2), value=flag=>args[args.indexOf(flag)+1];
    for(const flag of ['--report','--sidecar','--capture','--feed','--out']) if(!args.includes(flag)) throw Error('Required '+flag);
    const root=path.resolve(args.includes('--root')?value('--root'):'.');
    const out=path.resolve(value('--out'));
    const resolvedParent=fs.realpathSync(path.dirname(out));
    const actual=path.join(resolvedParent,path.basename(out));
    const rel=path.relative(root,actual).split(path.sep).join('/');
    if (/^(data\/history\/|run-history\.json$)/.test(rel) || fs.existsSync(out)) throw Error('Output must be a new draft outside History; never overwrite issued/frozen data');
    const report=read(value('--report')), sidecar=read(value('--sidecar')), feedBytes=fs.readFileSync(value('--feed')), feed=JSON.parse(feedBytes);
    const feedSha=createHash('sha1').update(Buffer.from(`blob ${feedBytes.length}\0`)).update(feedBytes).digest('hex');
    if(sidecar.provenance?.feedBlobSha!==feedSha || report.feedGeneratedAt!==feed.generatedAt) throw Error('Feed does not match the draft binding');
    const universe=derivePrimarySelectionInventory(report,feed,read(path.join(root,'data/major-sport-market-coverage-v1.json')));
    const result=importForecastCapture({report,sidecar,feed,universe,capture:read(value('--capture')),registry:loadForecastSourceRegistry(root)});
    fs.writeFileSync(out,JSON.stringify(result.sidecar,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({diagnostics:result.diagnostics,decisionAuthority:false,instruction:result.instruction},null,2));
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
