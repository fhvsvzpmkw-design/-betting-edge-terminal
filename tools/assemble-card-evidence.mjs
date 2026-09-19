#!/usr/bin/env node
// Presentation of producer-reviewed evidence on unfrozen drafts only. This is
// deliberately not a handicap engine and cannot complete a blocked assessment.
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath} from 'node:url';
import {inspectCardEvidence, sidecarSelectionKey} from './card-evidence-identity.mjs';

export const CARD_EVIDENCE_VERSION = '2026-09-19-r2';
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim() : '';
const unique = values => [...new Set(values.filter(Boolean))];
const sentence = value => { const s = text(value); return s ? /[.!?]$/.test(s) ? s : `${s}.` : ''; };
const join = values => unique(values.map(sentence)).join(' ');
const gapOnly = item => item?.historyFitRole === 'gap' || item?.evidence?.tierAssignment === 'gap_summary';
const number = value => Number.isFinite(value) ? value : null;

export function renderForecastFinding(record) {
  const name = text(record.publisher) || text(record.sourceId) || text(record.recordId) || 'Recorded forecast';
  const dependence = /MARKET_(?:INFLUENCE|REGRESSION)_DISCLOSED/.test(text(record.marketDependence)) ? 'The provider discloses influence from betting-market inputs; this is not a fully market-independent forecast.' :
    ['UNCLEAR', 'NOT_FULLY_AUDITED'].includes(record.marketDependence) ? 'The forecast’s independence from betting-market inputs has not been established.' : '';
  const limitation = join([record.limitation, dependence]);
  if (record.eligibility === 'ELIGIBLE_EXACT' && number(record.probability) !== null && record.comparison) {
    const comparison = record.comparison;
    if (number(comparison.breakEvenProbability) === null || number(comparison.edgeProbabilityPoints) === null) return null;
    const edge = comparison.edgeProbabilityPoints;
    const stance = edge > 1e-8 ? 'SUPPORT' : edge < -1e-8 ? 'CONTRARY' : 'CONTEXT';
    const conditional = record.probabilityBasis === 'CONDITIONAL_ON_NO_PUSH';
    const basis = conditional ? 'conditional on a non-push settlement' : 'for this exact selection';
    const relationship = stance === 'SUPPORT' ? 'supports' : stance === 'CONTRARY' ? 'opposes' : 'is neutral to';
    return {stance, text: join([`${name} forecasts ${(record.probability * 100).toFixed(2)}% ${basis}, against ${(comparison.breakEvenProbability * 100).toFixed(2)}% break-even at decimal ${comparison.priceDecimal}; it ${relationship} this price by ${Math.abs(edge).toFixed(2)} probability points`, limitation,
      conditional ? 'This comparison does not establish unconditional expected return without push treatment' : ''])};
  }
  if (record.eligibility === 'CONTEXT_ONLY') {
    const detail = number(record.probability) !== null ? `${(record.probability * 100).toFixed(2)}% for ${record.marketDetail || 'its source market'}` : 'a projected score or contextual estimate';
    return {stance: 'CONTEXT', text: join([`${name} provides ${detail}; this is context and does not establish the settlement probability for this exact bet`, limitation, list(record.reasons).join('; ')])};
  }
  return null;
}

function benchmarkText(rec) {
  const comparison = rec.benchmarkComparison, price = number(rec.feed?.priceDecimal);
  if (rec.pinnacleBenchmark?.state !== 'QUALIFIED' || !comparison || price === null || price <= 1 || number(comparison.benchmarkNoVigProbability) === null) return null;
  const edge = 100 * (comparison.benchmarkNoVigProbability - 1 / price);
  // Do not mask malformed numeric evidence; the existing validators own it.
  if (number(comparison.edgeProbabilityPoints) === null || Math.abs(edge - comparison.edgeProbabilityPoints) > 1e-6) return null;
  return {stance: edge > 1e-8 ? 'SUPPORT' : edge < -1e-8 ? 'CONTRARY' : 'CONTEXT', text: `The exact executable price is ${Math.abs(edge).toFixed(2)} probability points ${edge > 1e-8 ? 'favorable' : edge < -1e-8 ? 'unfavorable' : 'neutral'} to the qualified paired Pinnacle market reference. This reference is not an independent fair-value model.`};
}

function pacificCheck(value) {
  return Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Vancouver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}).format(new Date(value)) + ' PT' : 'check time unavailable';
}

export function assembleCardEvidence(inputReport, inputSidecar, {library = null, draft = false} = {}) {
  const report = structuredClone(inputReport), sidecar = structuredClone(inputSidecar), changes = [], warnings = [], detached = [];
  const result = {report, sidecar, changes, warnings, detached, version: CARD_EVIDENCE_VERSION, mode: 'DRAFT_PRESENTATION_ONLY', publicationBlocking: false};
  if (!draft) { warnings.push('No unfrozen-draft authorization; presentation unchanged.'); return result; }
  const research = new Map(list(library?.items).map(item => [item.priorId, item]));
  const recs = list(report?.recs), recByKey = new Map(recs.map(rec => [text(rec?.feed?.selectionKey), rec]).filter(([key]) => key));
  const detach = (holder, selectionKey, scope, sourceRec) => {
    if (!holder?.cardEvidence) return false;
    const inspected = inspectCardEvidence({...sourceRec, feed: {selectionKey}, cardEvidence: holder.cardEvidence});
    if (inspected.state === 'VALID') return false;
    delete holder.cardEvidence;
    detached.push({scope, selectionKey, reason: inspected.state, attachedSelectionKey: text(inspected.evidence?.selectionKey) || null});
    return true;
  };

  // Detach invalid presentation handoffs from the cloned draft only. Decision
  // fields and issued history are never changed by this operation.
  for (const rec of recs) detach(rec, text(rec?.feed?.selectionKey), 'report', rec);
  for (const [index, item] of list(sidecar?.recommendations).entries()) {
    const claimedKey = sidecarSelectionKey(item), rec = recByKey.get(claimedKey);
    if (item?.cardEvidence && (!rec || detach(item, claimedKey, `sidecar recommendation ${index + 1}`, rec))) {
      if (!rec) {
        const attachedSelectionKey = text(item.cardEvidence?.selectionKey) || claimedKey || null;
        delete item.cardEvidence;
        detached.push({scope: `sidecar recommendation ${index + 1}`, selectionKey: null, reason: 'IDENTITY_MISMATCH', attachedSelectionKey});
      }
    }
    if (item?.selectionKey && !recByKey.has(text(item.selectionKey))) delete item.selectionKey;
  }
  for (const receipt of list(sidecar?.primaryAnalysis?.receipts).filter(row => row?.state === 'EVALUATED')) {
    const selectionKey = text(receipt?.decision?.feed?.selectionKey), rec = recByKey.get(selectionKey) || receipt.decision;
    detach(receipt.decision, selectionKey, `receipt decision ${receipt.selectionId || selectionKey}`, rec);
    detach(receipt.evidence, selectionKey, `receipt evidence ${receipt.selectionId || selectionKey}`, rec);
  }
  if (detached.length) warnings.push(`${detached.length} mismatched or invalid cardEvidence attachment(s) were detached from the unfrozen draft; governed decisions were preserved and each affected card must be rebuilt or deferred before freeze.`);

  const itemCandidates = new Map();
  for (const item of list(sidecar?.recommendations)) {
    const selectionKey = sidecarSelectionKey(item);
    if (!selectionKey) continue;
    if (!itemCandidates.has(selectionKey)) itemCandidates.set(selectionKey, []);
    itemCandidates.get(selectionKey).push(item);
  }
  const itemByKey = new Map([...itemCandidates].filter(([, items]) => items.length === 1).map(([key, items]) => [key, items[0]]));
  if (recs.length === list(sidecar?.recommendations).length && recs.every(rec => itemByKey.has(text(rec?.feed?.selectionKey)))) {
    const ordered = recs.map((rec, index) => {
      const item = itemByKey.get(text(rec.feed.selectionKey));
      item.ordinal = index + 1;
      item.selectionKey = rec.feed.selectionKey;
      return item;
    });
    if (!ordered.every((item, index) => item === sidecar.recommendations[index])) changes.push({scope: 'sidecar', fields: ['recommendationOrder'], identity: 'selectionKey'});
    sidecar.recommendations = ordered;
  }
  for (const [index, rec] of list(report?.recs).entries()) {
    const selectionKey = text(rec?.feed?.selectionKey), item = itemByKey.get(selectionKey);
    const candidates = [rec.cardEvidence, item?.cardEvidence].filter(Boolean);
    if (candidates.length > 1 && !isDeepStrictEqual(candidates[0], candidates[1])) {
      warnings.push(`Recommendation ${index + 1}: report and sidecar cardEvidence disagree for ${selectionKey}; both attachments were detached and the decision was preserved.`);
      delete rec.cardEvidence;
      delete item.cardEvidence;
      detached.push({scope: `recommendation ${index + 1}`, selectionKey, reason: 'COPY_DRIFT', attachedSelectionKey: selectionKey});
      continue;
    }
    const evidence = candidates[0];
    if (!evidence) continue;
    const warn = message => warnings.push(`Recommendation ${index + 1}: ${message}`);
    const receipts = list(sidecar?.primaryAnalysis?.receipts).filter(row => row.state === 'EVALUATED' && row.decision?.feed?.selectionKey === rec.feed?.selectionKey);
    if (!item || item.title !== rec.title || sidecarSelectionKey(item) !== rec.feed?.selectionKey || receipts.length > 1) { warn('Ambiguous report/sidecar/receipt identity; presentation unchanged.'); continue; }
    if (sidecar.primaryAnalysis && receipts.length !== 1) { warn('No matching completed receipt; presentation unchanged.'); continue; }
    if (evidence.schema !== 1 || !text(evidence.selectionKey) || evidence.selectionKey !== rec.feed?.selectionKey || !Array.isArray(evidence.findings) || !text(evidence.decisionExplanation)) { warn('Structured card evidence needs schema 1, exact selectionKey, findings and the completed decision explanation; presentation unchanged.'); continue; }
    const sources = new Map(list(rec.sourceEvidence).map(source => [source.id, source]));
    const buckets = {SUPPORT: [], CONTRARY: [], CONTEXT: [], UNRESOLVED: []};
    let invalid = false;
    for (const finding of evidence.findings) {
      const sourceIds = list(finding.sourceIds);
      if (!Object.hasOwn(buckets, finding.stance) || !text(finding.finding) || !text(finding.application) || !text(finding.limitation) || !sourceIds.length || sourceIds.some(id => !sources.has(id))) {
        invalid = true; warn('A finding lacks its source, finding, exact-selection application, limitation or stance; presentation unchanged.'); break;
      }
      // MODEL numbers are routed through the exact-market forecast assessment.
      // A human-written SUPPORT label must not override the numerical comparison.
      if (sourceIds.some(id => sources.get(id)?.kind === 'MODEL')) { warn('MODEL source finding is rendered from forecastReview; retain substantive interpretation in decisionExplanation.'); continue; }
      buckets[finding.stance].push(join([finding.finding, finding.application, finding.limitation]));
    }
    if (invalid) continue;
    const benchmark = benchmarkText(rec);
    if (benchmark) buckets[benchmark.stance].push(benchmark.text);
    for (const forecast of list(rec.forecastReview?.records)) {
      const rendered = renderForecastFinding(forecast);
      if (rendered) buckets[rendered.stance].push(rendered.text);
    }
    const support = join(buckets.SUPPORT) || 'No additional supporting finding was recorded for this selection.';
    const contrary = join([...buckets.CONTRARY, ...buckets.UNRESOLVED]) || 'No additional opposing finding was recorded; the stated assessment limitations still apply.';
    const wait = evidence.waitCondition;
    const waitText = rec.status === 'WAIT' && text(wait?.trigger) && text(wait?.checkSource) && text(wait?.remainingBetRequirements)
      ? join([`Reassess when ${wait.trigger}`, `Check: ${wait.checkSource}`, `BET still requires: ${wait.remainingBetRequirements}`]) : '';
    if (rec.status === 'WAIT' && !waitText) warn('WAIT needs a concrete trigger, check source and remaining BET requirements; no condition was invented.');
    const rendered = {support, contrary, analysis: join([evidence.decisionExplanation, ...buckets.CONTEXT, waitText]),
      source: list(rec.sourceEvidence).map(source => `${source.title} (${text(source.kind).toLowerCase()}, checked ${pacificCheck(source.checkedAt)})`).join('; '),
      cardEvidence: structuredClone(evidence)};
    const fit = evidence.historyFit;
    let fitFields = null;
    if (fit) {
      const ids = unique([...list(fit.priorIds), ...list(fit.synthesisIds)]);
      if (!library) warn('History Library unavailable; structured History Fit was not rendered.');
      else if (!/^(NR|[ABCD][+-]?)$/.test(text(fit.grade)) || !text(fit.finding) || !text(fit.application) || !text(fit.limitation) || !text(fit.directness) || !text(fit.transportability) || ids.some(id => !research.has(id)) || (fit.grade !== 'NR' && !ids.length)) warn('History Fit needs canonical references, finding, application, limitation and applicability; existing History Fit retained for producer review.');
      else {
        const onlyGaps = ids.length > 0 && ids.every(id => gapOnly(research.get(id)));
        const grade = onlyGaps ? 'NR' : fit.grade;
        const finding = onlyGaps ? ids.map(id => research.get(id).finding).join(' ') : fit.finding;
        const application = onlyGaps ? 'The linked research establishes a calibration gap; it supplies no supportive historical fit for this selection.' : fit.application;
        rendered.hist = `${grade} — ${join([finding, application, fit.limitation])}`;
        fitFields = {grade, priorIds: list(fit.priorIds), synthesisIds: list(fit.synthesisIds), clusterIds: list(fit.clusterIds),
          directness: onlyGaps ? 'gap' : fit.directness, transportability: onlyGaps ? 'not_applicable' : fit.transportability,
          mechanism: application, limitation: fit.limitation, displayText: rendered.hist};
        if (onlyGaps && fit.grade !== 'NR') warn(`Gap-only canonical evidence renders NR under existing History Fit policy; requested ${fit.grade} is retained in cardEvidence for audit.`);
      }
    }
    const before = Object.fromEntries(Object.keys(rendered).map(key => [key, rec[key]]));
    Object.assign(rec, rendered); Object.assign(item, {selectionKey, ...structuredClone(rendered)}, fitFields || {});
    if (rendered.hist) item.displayText = rendered.hist;
    if (receipts[0]) {
      Object.assign(receipts[0].decision, structuredClone(rendered));
      if (receipts[0].evidence) Object.assign(receipts[0].evidence, {selectionKey, ...structuredClone(rendered)}, fitFields || {});
    }
    const fields = Object.keys(rendered).filter(key => JSON.stringify(before[key]) !== JSON.stringify(rendered[key]));
    if (fields.length || fitFields) changes.push({ordinal: index + 1, selectionKey: rec.feed.selectionKey, fields, historyFitPolicyApplied: Boolean(fitFields)});
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), value = flag => args[args.indexOf(flag) + 1];
    if (args[0] !== 'assemble' || !['--report', '--sidecar', '--out-report', '--out-sidecar', '--draft'].every(flag => args.includes(flag))) throw new Error('Usage: assemble-card-evidence.mjs assemble --report FILE --sidecar FILE --out-report FILE --out-sidecar FILE --draft [--root DIR]');
    const inputs = [path.resolve(value('--report')), path.resolve(value('--sidecar'))], outputs = [path.resolve(value('--out-report')), path.resolve(value('--out-sidecar'))];
    if (outputs.some(output => inputs.includes(output) || /(?:^|\/)data\/history\//.test(output)) || new Set(outputs).size !== 2 || outputs.some(output => fs.existsSync(output))) throw new Error('Write separate new draft outputs outside history; input or existing files cannot be overwritten.');
    const root = path.resolve(args.includes('--root') ? value('--root') : process.cwd());
    let library = null; try { library = JSON.parse(fs.readFileSync(path.join(root, 'research/research-library.json'), 'utf8')); } catch { /* advisory only */ }
    const result = assembleCardEvidence(JSON.parse(fs.readFileSync(inputs[0], 'utf8')), JSON.parse(fs.readFileSync(inputs[1], 'utf8')), {library, draft: true});
    fs.writeFileSync(outputs[0], JSON.stringify(result.report, null, 2) + '\n', {flag: 'wx'});
    fs.writeFileSync(outputs[1], JSON.stringify(result.sidecar, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify({mode: result.mode, publicationBlocking: false, version: result.version, changes: result.changes, warnings: result.warnings}, null, 2));
  } catch (error) { console.error(`CARD EVIDENCE DRAFT: ${error.message}`); process.exitCode = 1; }
}
