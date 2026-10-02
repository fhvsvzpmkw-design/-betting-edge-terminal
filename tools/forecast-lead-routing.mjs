// Route actual typed source captures and keep prose-only probabilities in the
// producer's work queue. A prose lead is never eligible forecast evidence.
import {createHash} from 'node:crypto';
import {importForecastCapture} from './import-forecast-evidence.mjs';
import {forecastCandidate, loadForecastSourceRegistry} from './forecast-evidence.mjs';

export const FORECAST_ROUTING_FROM = '2026-10-01T18:47:44-07:00';
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim() : '';
const time = value => Date.parse(value || '');
const active = (report, replay) => replay || time(report?.ts) >= time(FORECAST_ROUTING_FROM);
const sourcesOf = receipt => [...list(receipt?.decision?.sourceEvidence), ...list(receipt?.evidence?.sourceEvidence),
  ...list(receipt?.candidateDraft?.decision?.sourceEvidence), ...list(receipt?.candidateDraft?.evidence?.sourceEvidence),
  ...list(receipt?.blocker?.attempts)];
const normalized = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sameTeam = (label, team) => normalized(label) === normalized(team) || normalized(team).startsWith(normalized(label) + ' ');
function sourceIdFor(source, registry) {
  if (registry.sources?.[source.sourceId]) return source.sourceId;
  // Only this documented, explicitly named legacy board format is parsed.
  // Generic percentages, sportsbook prices and score projections are not fields.
  try {if (/(^|\.)dratings\.com$/i.test(new URL(source.url).hostname)) return 'dratings';} catch {}
  return null;
}

export function collectForecastLeads({report, sidecar, selection, receipt, feed, registry = loadForecastSourceRegistry()}) {
  const candidate = forecastCandidate(selection, {receipt, feed});
  const record = receipt?.decision || receipt?.candidateDraft?.decision;
  const event = list(feed?.events).find(row => String(row.eventId || row.id || row.identity?.eventId) === candidate.eventId);
  const team = record?.title || event?.[candidate.side]?.name || event?.[candidate.side];
  const inputs = [...sourcesOf(receipt).filter(source => source.kind === 'MODEL'),
    ...list(sidecar.forecastEvidence?.attempts).filter(attempt => attempt.selectionId === candidate.selectionId)];
  const leads = new Map();
  for (const source of inputs) {
    const sourceId = sourceIdFor(source, registry), checkedAt = source.checkedAt || source.asOf;
    const finding = text(source.finding || source.fact);
    if (!sourceId || !finding || !Number.isFinite(time(checkedAt)) || time(checkedAt) > time(report.ts) ||
        time(checkedAt) >= time(candidate.startTime) || (source.eventId && String(source.eventId) !== candidate.eventId)) continue;
    let probability = null;
    if (candidate.marketClass === 'moneyline' && sourceId === 'dratings' && typeof team === 'string') {
      const pair = finding.match(/DRatings showed\s+([^,%]+?)\s+(\d+(?:\.\d+)?)%,\s+([^,%]+?)\s+(\d+(?:\.\d+)?)%/i);
      if (pair) {
        const matches = [[pair[1], Number((Number(pair[2]) / 100).toFixed(12))], [pair[3], Number((Number(pair[4]) / 100).toFixed(12))]].filter(([label]) => sameTeam(label, team));
        if (matches.length === 1 && matches[0][1] > 0 && matches[0][1] < 1) probability = matches[0][1];
      }
    }
    // Typed captures are inspected by the ordinary importer, not parsed here.
    for (const raw of list(source.forecastCapture?.records)) {
      if (raw.kind === 'OUTCOME_PROBABILITY' && raw.sourceId === sourceId && raw.url === source.url &&
          String(raw.eventId) === candidate.eventId && raw.sport === candidate.sport && raw.marketDetail === candidate.marketDetail &&
          raw.side === candidate.side && raw.period === candidate.period && (raw.line ?? null) === candidate.line &&
          raw.probability > 0 && raw.probability < 1) probability = raw.probability;
    }
    if (probability == null) continue;
    const signature = JSON.stringify([candidate.selectionId, sourceId, source.url, checkedAt, probability]);
    const leadId = 'forecast-lead-' + createHash('sha256').update(signature).digest('hex').slice(0, 24);
    const previous = leads.get(leadId);
    leads.set(leadId, {leadId, selectionId:candidate.selectionId, selectionKey:candidate.selectionKey,
      sourceId, sourceIds:[...new Set([...(previous?.sourceIds || []), source.id].filter(Boolean))], url:source.url,
      observedAt:checkedAt, finding, probability, authority:'UNVERIFIED_SOURCE_FIELD_REQUIRES_CAPTURE_REVIEW',
      supportsPrice:probability > 1 / candidate.priceDecimal,
      nextAction:'Preserve the original published field in forecastCapture, review event/personnel/settlement applicability, then assess BET and LEAN. Prose alone cannot issue a grade.'});
  }
  return [...leads.values()];
}

export function inspectForecastLeadReview({report, sidecar, selection, receipt, forecast, feed, registry, developmentReplay = false}) {
  if (!active(report, developmentReplay)) return {required:false, complete:true, leads:[], missing:[]};
  const leads = collectForecastLeads({report, sidecar, selection, receipt, feed, registry});
  const candidate = forecastCandidate(selection, {receipt, feed}), missing = [];
  const dispositions = list(receipt?.candidateAssessment?.forecastLeadDispositions);
  const sources = new Map(sourcesOf(receipt).map(source => [source.id, source]));
  const results = leads.map(lead => {
    const records = list(sidecar.forecastEvidence?.records).filter(raw => raw.sourceId === lead.sourceId && raw.url === lead.url &&
      raw.sport === candidate.sport && String(raw.eventId) === candidate.eventId && time(raw.startTime) === time(candidate.startTime) &&
      raw.marketDetail === candidate.marketDetail && raw.period === candidate.period && raw.side === candidate.side &&
      (raw.line ?? null) === candidate.line && raw.probability === lead.probability && time(raw.observedAt) === time(lead.observedAt));
    const captured = records.some(raw => list(forecast?.records).some(row => row.recordId === raw.recordId && row.eligibility === 'ELIGIBLE_EXACT'));
    if (captured) return {...lead, state:'CAPTURED', recordIds:records.map(raw => raw.recordId)};
    const reviews = dispositions.filter(row => row.leadId === lead.leadId);
    const review = reviews[0];
    const linked = list(review?.sourceIds).length && review.sourceIds.every(id => {
      const source = sources.get(id);
      return source && String(source.eventId) === candidate.eventId && text(source.finding || source.fact) &&
        time(source.checkedAt || source.asOf) <= time(report.ts);
    });
    const rejected = reviews.length === 1 && review.state === 'REJECTED' && text(review.rationale) &&
      time(review.checkedAt) >= time(report.feedGeneratedAt) && time(review.checkedAt) <= time(report.ts) &&
      list(review.sourceIds).some(id => lead.sourceIds.includes(id)) && linked &&
      ['EVENT_OR_MARKET_MISMATCH','STALE_ASSUMPTIONS','PERSONNEL_CONFLICT','SETTLEMENT_UNRESOLVED','SOURCE_UNVERIFIABLE','NO_DIRECTIONAL_PREFERENCE'].includes(review.objectionKind) &&
      (!lead.supportsPrice || (review.directionalReview?.state === 'REJECTED' && text(review.directionalReview.rationale)));
    if (!rejected && lead.supportsPrice) missing.push('FORECAST_CAPTURE_OR_SOURCE_REJECTION_REQUIRED:' + lead.leadId);
    return {...lead, state:rejected ? 'REJECTED' : 'REVIEW_REQUIRED', recordIds:records.map(raw => raw.recordId)};
  });
  return {required:leads.some(lead => lead.supportsPrice), complete:missing.length === 0, leads:results, missing};
}

export function routeForecastCaptures({report, sidecar, universe, feed, registry = loadForecastSourceRegistry(), developmentReplay = false}) {
  const output = structuredClone(sidecar), captures = [];
  if (!active(report, developmentReplay)) return {sidecar:output, imported:[], applied:false};
  if (report.frozen || report.issued || report.immutable || sidecar.frozen || sidecar.issued || sidecar.immutable)
    throw Error('Forecast routing requires an unfrozen draft');
  // The producer can embed the standard capture next to its actual MODEL finding
  // or put event-wide captures in forecastEvidence.pendingCaptures.
  captures.push(...list(sidecar.forecastEvidence?.pendingCaptures));
  for (const receipt of list(sidecar.primaryAnalysis?.receipts)) {
    for (const source of sourcesOf(receipt)) if (source.kind === 'MODEL' && source.forecastCapture) {
      for (const raw of list(source.forecastCapture.records)) {
        if (raw.url !== source.url || String(raw.eventId) !== String(source.eventId) || (source.sport && raw.sport !== source.sport))
          throw Error('Embedded forecast capture must match its original MODEL source');
      }
      captures.push(source.forecastCapture);
    }
  }
  for (const attempt of list(sidecar.forecastEvidence?.attempts)) if (attempt.forecastCapture) {
    if (list(attempt.forecastCapture.records).some(raw => raw.sourceId !== attempt.sourceId || raw.url !== attempt.url))
      throw Error('Attempt capture must match its original source');
    captures.push(attempt.forecastCapture);
  }
  let routed = output;
  const imported = [];
  for (const capture of captures) {
    const result = importForecastCapture({report, sidecar:routed, capture, universe, feed, registry});
    routed = result.sidecar;
    imported.push(...result.diagnostics);
  }
  if (routed.forecastEvidence) delete routed.forecastEvidence.pendingCaptures;
  return {sidecar:routed, imported:[...new Map(imported.map(row => [row.recordId, row])).values()], applied:true};
}
