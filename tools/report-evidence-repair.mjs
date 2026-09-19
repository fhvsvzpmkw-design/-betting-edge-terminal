#!/usr/bin/env node
// Draft preparation and read-only publication diagnostics. Never assigns a betting decision.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {derivePrimarySelectionInventory} from './major-sport-market-coverage-gate.mjs';
import {loadBoundMarketObserver, exactMarketReference} from './market-price-assessment.mjs';
import {buildForecastCoverage, attachForecastCoverage} from './forecast-evidence.mjs';
import {assembleCardEvidence} from './assemble-card-evidence.mjs';
import {reviewCardEvidence} from './review-card-evidence.mjs';
import {buildCandidateAssessment, finalizeCandidateAssessmentDraft, candidateAssessmentRequired} from './candidate-assessment.mjs';
import {buildMarketMethodShadow} from './market-method-shadow.mjs';
import {CARD_EVIDENCE_IDENTITY_FROM, CARD_EVIDENCE_IDENTITY_VERSION, inspectCardEvidence, sidecarSelectionKey} from './card-evidence-identity.mjs';

export const EVIDENCE_REPAIR_VERSION = '2026-09-12';
export const EVIDENCE_REPAIR_FROM = '2026-09-12T12:00:00-07:00';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const list = value => Array.isArray(value) ? value : [];
const blobSha = raw => createHash('sha1').update(Buffer.from(`blob ${raw.length}\0`)).update(raw).digest('hex');
const optional = file => {try {return read(file);} catch {return null;}};

function loadContext(root, report, sidecar, feedFile) {
  const warnings = [], registry = optional(path.join(root, 'research/forecast-source-registry.json'));
  const library = optional(path.join(root, 'research/research-library.json'));
  let feed, universe, observer;
  try {
    const sha = sidecar.provenance?.feedBlobSha;
    if (!/^[0-9a-f]{40}$/i.test(sha || '')) throw new Error('Exact feed blob SHA is missing');
    let raw;
    if (feedFile) raw = fs.readFileSync(feedFile);
    else {
      try {raw = execFileSync('git', ['cat-file', 'blob', sha], {cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});}
      catch {raw = fs.readFileSync(path.join(root, 'data/live-odds.json'));}
    }
    if (blobSha(raw) !== sha) throw new Error('Feed bytes differ from the pinned snapshot');
    feed = JSON.parse(raw);
    if (feed.generatedAt !== report.feedGeneratedAt) throw new Error('Feed time differs from report binding');
    const policy = read(path.join(root, 'data/major-sport-market-coverage-v1.json'));
    universe = derivePrimarySelectionInventory(report, feed, policy);
  } catch (error) {warnings.push(`Forecast inventory unavailable: ${error.message}`);}
  try {observer = loadBoundMarketObserver(sidecar, root);} catch (error) {warnings.push(`Blocked-market reference review unavailable: ${error.message}`);}
  const priorRecords = [], priorReceipts = new Map();
  const index = optional(path.join(root, 'run-history.json'));
  for (const entry of list(index?.runs).filter(entry => entry.date === report.ts?.slice(0, 10) && Date.parse(entry.ts) < Date.parse(report.ts)).sort((a,b) => Date.parse(a.ts)-Date.parse(b.ts))) {
    if (!entry.researchFitPath) continue;
    const prior = optional(path.join(root, entry.researchFitPath));
    if (!prior || prior.reportReference?.ts !== entry.ts || prior.reportReference?.feedGeneratedAt !== entry.feedGeneratedAt) continue;
    for (const row of list(prior.primaryAnalysis?.receipts)) priorReceipts.set(row.selectionId, {row, reportPath: entry.path});
    // Reuse still requires the forecast module's explicit current-run revalidation.
    for (const record of list(prior.forecastEvidence?.records)) priorRecords.push(record);
  }
  return {root, feed, universe, observer, registry: registry || undefined, library, priorRecords, priorReceipts, warnings};
}

export function reviewBlockedSelections(report, sidecar, {universe, observer, priorReceipts = new Map()} = {}) {
  const selections = new Map(list(universe?.selections).map(row => [row.selectionId, row]));
  const rows = [], recovered = [];
  for (const receipt of list(sidecar.primaryAnalysis?.receipts)) {
    const prior = priorReceipts.get(receipt.selectionId);
    if (receipt.state === 'EVALUATED') {
      if (prior?.row.state === 'BLOCKED') recovered.push({selectionId: receipt.selectionId, priorReportPath: prior.reportPath, disposition: 'COMPLETED_ASSESSMENT', status: receipt.decision?.status});
      continue;
    }
    if (receipt.state !== 'BLOCKED') continue;
    const blocker = receipt.blocker || {}, selection = selections.get(receipt.selectionId);
    let qualifiedPinnacleAvailable = false, referenceLimitation = null;
    try {
      if (!selection || !observer) throw new Error('Bound selection or observer unavailable');
      const quote = receipt.quote || selection.quotes[0];
      exactMarketReference(report, {...quote, eventDate: selection.eventDate}, observer);
      qualifiedPinnacleAvailable = true;
    } catch (error) {referenceLimitation = error.message;}
    const unfinished = blocker.reason === 'RESEARCH_INCOMPLETE';
    rows.push({selectionId: receipt.selectionId, disposition: unfinished ? 'TARGETED_FOLLOW_UP' : 'REMAINING_BLOCKER',
      reason: blocker.reason || null, missing: blocker.missing || null, impact: blocker.impact || null,
      attempts: list(blocker.attempts), progress: blocker.progress || null, qualifiedPinnacleAvailable, referenceLimitation,
      nextAction: blocker.progress?.nextStep || blocker.nextAction || blocker.followUpCondition || (qualifiedPinnacleAvailable
        ? 'Review recorded personnel and conflicting forecasts against this exact paired reference; complete the existing assessment route if qualified.'
        : 'Pursue the sport/market forecast route and the specific missing input; retain the selection-level blocker if still unsupported.'),
      assessmentRecovered: false});
  }
  return {recoveredCount: recovered.length, stillBlockedCount: rows.length,
    targetedFollowUpCount: rows.filter(row => row.disposition === 'TARGETED_FOLLOW_UP').length,
    qualifiedReferenceReviewCount: rows.filter(row => row.qualifiedPinnacleAvailable).length,
    recovered, selections: rows,
    limitation: 'A qualified reference is a review lead. Only an EVALUATED receipt establishes a completed assessment; this diagnostic creates no status.'};
}

export function buildEvidenceAudit({root = process.cwd(), report, sidecar, feedFile, context} = {}) {
  const ctx = context || loadContext(root, report, sidecar, feedFile);
  let forecasts;
  try {forecasts = buildForecastCoverage({report, sidecar, universe: ctx.universe, feed: ctx.feed, priorRecords: ctx.priorRecords, registry: ctx.registry, now: report.ts});}
  catch (error) {forecasts = {mode: 'ADVISORY_ONLY', publicationBlocking: false, warnings: [`Forecast review unavailable: ${error.message}`]};}
  const review = reviewCardEvidence(report, sidecar, {library: ctx.library});
  const candidateAssessment = buildCandidateAssessment({report, sidecar, universe: ctx.universe, observer: ctx.observer, forecastCoverage: forecasts});
  return {schema: 1, version: EVIDENCE_REPAIR_VERSION, mode: 'ADVISORY_ONLY', publicationBlocking: false,
    reportTs: report.ts, forecastCoverage: forecasts,
    candidateAssessment,
    blockedReview: reviewBlockedSelections(report, sidecar, ctx),
    cardReview: {cardsReviewed: review.cardsReviewed, issueCounts: review.issueCounts, issues: review.issues},
    warnings: [...ctx.warnings, ...list(review.warnings)]};
}

// Only derived draft accounting changes after the producer defers incomplete
// candidates. All remaining recommendation content is preserved byte-for-byte.
function synchronizeCandidateDraft(report, sidecar) {
  report.counts = {bet:0, lean:0, wait:0, pass:0};
  for (const rec of list(report.recs)) report.counts[rec.status.toLowerCase()]++;
  report.risk = list(report.recs).filter(rec => rec.status === 'BET').reduce((sum, rec) => {
    const stake = Number(String(rec.stake).replace(/^\$/, ''));
    if (!Number.isFinite(stake) || stake < 0) throw new Error('Candidate preparation cannot reconcile an invalid issued stake');
    return sum + stake;
  }, 0);
  sidecar.recommendations.forEach((rec, index) => {rec.ordinal = index + 1;});
  const receipts = list(sidecar.primaryAnalysis?.receipts), audit = sidecar.coverageAudit;
  for (const [sport, row] of Object.entries(audit?.sports || {})) {
    const rows = receipts.filter(receipt => receipt.selectionId.split('|')[0] === sport);
    row.primary.evaluated = rows.filter(receipt => receipt.state === 'EVALUATED').length;
    row.primary.blocked = rows.filter(receipt => receipt.state === 'BLOCKED').length;
  }
  if (audit?.totals) {
    audit.totals.primaryEvaluated = receipts.filter(receipt => receipt.state === 'EVALUATED').length;
    audit.totals.primaryBlocked = receipts.filter(receipt => receipt.state === 'BLOCKED').length;
    const t = audit.totals;
    report.summary = `${report.counts.bet} BET; ${report.counts.lean} LEAN; ${report.counts.wait} WAIT; ${report.counts.pass} PASS; new risk $${report.risk}. Primary selections: ${t.primaryAvailable} available; ${t.primaryEvaluated} evaluated; ${t.primaryBlocked} evidence-blocked; ${t.primaryUnavailable} unavailable. Unfinished candidate research is listed separately; player-prop analysis remains paused.`;
  }
  // These are reconstructed by the publisher from the final draft.
  delete report.coverageSummary;
  delete report.instrumentTelemetry;
  delete report.evidenceApplication;
}

export function deferInvalidCardEvidenceDraft(report, sidecar) {
  if (Date.parse(report?.ts || '') < Date.parse(CARD_EVIDENCE_IDENTITY_FROM)) return {selectionIds: [], failures: []};
  const receipts = list(sidecar?.primaryAnalysis?.receipts), selectionIds = [], failures = [], keptRecs = [], keptItems = [];
  for (const [index, rec] of list(report?.recs).entries()) {
    const item = sidecar?.recommendations?.[index], selectionKey = rec?.feed?.selectionKey;
    const inspected = inspectCardEvidence(rec);
    let reason = inspected.state === 'VALID' ? null : inspected.state;
    if (!reason && sidecarSelectionKey(item) !== selectionKey) reason = 'SIDECAR_IDENTITY_MISMATCH';
    if (!reason && !isDeepStrictEqual(item?.cardEvidence, rec.cardEvidence)) reason = 'SIDECAR_COPY_DRIFT';
    const matches = receipts.filter(row => row?.state === 'EVALUATED' && row?.decision?.feed?.selectionKey === selectionKey);
    if (!reason && matches.length !== 1) reason = 'EVALUATED_RECEIPT_IDENTITY_MISMATCH';
    if (!reason && (!isDeepStrictEqual(matches[0].decision?.cardEvidence, rec.cardEvidence) || !isDeepStrictEqual(matches[0].evidence?.cardEvidence, rec.cardEvidence))) reason = 'RECEIPT_COPY_DRIFT';
    if (!reason) { keptRecs.push(rec); keptItems.push(item); continue; }
    if (matches.length !== 1) {
      failures.push({selectionKey, reason, detail: 'Exactly one matching EVALUATED receipt is required for safe selection-level deferral.'});
      keptRecs.push(rec); keptItems.push(item); continue;
    }
    const receipt = matches[0];
    const attempts = list(rec.sourceEvidence).filter(source => source && String(source.eventId) === String(rec.feed?.eventId) && source.finding && source.url && source.checkedAt)
      .map(source => structuredClone(source));
    if (!attempts.length) {
      failures.push({selectionKey, reason, detail: 'At least one recorded event-specific source attempt is required for RESEARCH_INCOMPLETE.'});
      keptRecs.push(rec); keptItems.push(item); continue;
    }
    const decision = structuredClone(receipt.decision), evidence = structuredClone(receipt.evidence);
    delete decision.cardEvidence;
    if (evidence) delete evidence.cardEvidence;
    receipt.candidateDraft = {decision, evidence, authority: 'UNISSUED_INCOMPLETE_DRAFT_ONLY',
      missingResearch: [`CARD_EVIDENCE_${reason}`]};
    receipt.cardEvidenceDetachment = {version: CARD_EVIDENCE_IDENTITY_VERSION, selectionKey, reason,
      attachedSelectionKey: inspected.evidence?.selectionKey || null};
    receipt.state = 'BLOCKED';
    receipt.blocker = {reason: 'RESEARCH_INCOMPLETE', checkedAt: report.ts,
      missing: `Exact-selection structured card evidence is incomplete (${reason}).`,
      impact: 'The unfinished presentation handoff is detached. No BET, LEAN, WAIT or PASS is issued for this selection until it is rebuilt against the exact side, line and price.',
      attempts, progress: {stage: 'CARD_EVIDENCE_REBUILD', stoppingReason: reason,
        nextStep: 'Rebuild cardEvidence from this selection’s recorded sources, rerun draft preparation, then reassess the same current quote.'},
      nextAction: 'Rebuild the exact-selection card evidence and rerun all pre-freeze validators.'};
    for (const field of ['decision', 'evidence', 'fairValueEvidence', 'fair', 'status', 'marketFair']) delete receipt[field];
    selectionIds.push(receipt.selectionId || selectionKey);
  }
  if (selectionIds.length) {
    report.recs = keptRecs;
    sidecar.recommendations = keptItems;
  }
  return {selectionIds, failures};
}

export function validateCandidateCompletion({root = process.cwd(), report, sidecar, feedFile} = {}) {
  if (!candidateAssessmentRequired(report)) return null;
  const audit = buildEvidenceAudit({root, report, sidecar, feedFile});
  const candidate = audit.candidateAssessment;
  if (candidate.state === 'UNIVERSE_UNAVAILABLE') throw new Error('Candidate review requires the same bound inventory as publication');
  const incomplete = candidate.selections.filter(row => row.promising && row.state === 'EVALUATED' && row.reviewState === 'UNFINISHED');
  if (incomplete.length) throw new Error(`Complete or defer the ${incomplete.length} unfinished candidate assessment(s) before freeze using report-evidence-repair.mjs prepare; completed other selections remain publishable: ${incomplete.map(row => `${row.selectionId}: ${row.missingResearch.join(', ')}`).join('; ')}`);
  return candidate;
}

export function prepareEvidenceDraft({root = process.cwd(), report, sidecar, feedFile} = {}) {
  let draftReport = structuredClone(report), draftSidecar = structuredClone(sidecar);
  const ctx = loadContext(root, draftReport, draftSidecar, feedFile);
  const before = JSON.stringify(list(draftReport.recs).map(rec => ({feed:rec.feed,status:rec.status,stake:rec.stake,fair:rec.fair,playTo:rec.playTo,coreAssessment:rec.coreAssessment,marketAssessment:rec.marketAssessment})));
  attachForecastCoverage({report: draftReport, sidecar: draftSidecar, universe: ctx.universe, feed: ctx.feed, priorRecords: ctx.priorRecords, registry: ctx.registry, now: report.ts});
  const assembled = assembleCardEvidence(draftReport, draftSidecar, {library: ctx.library, draft: true});
  draftReport = assembled.report; draftSidecar = assembled.sidecar;
  // The existing receipt gate compares serialized object order. Canonicalize
  // only already-identical objects; never hide differing analytical content.
  for (const receipt of list(draftSidecar.primaryAnalysis?.receipts)) {
    if (receipt.state !== 'EVALUATED') continue;
    const matches = list(draftReport.recs).filter(rec => rec.feed?.selectionKey === receipt.decision?.feed?.selectionKey && rec.book === receipt.decision?.book);
    if (matches.length === 1 && isDeepStrictEqual(matches[0], receipt.decision)) receipt.decision = structuredClone(matches[0]);
  }
  const after = JSON.stringify(list(draftReport.recs).map(rec => ({feed:rec.feed,status:rec.status,stake:rec.stake,fair:rec.fair,playTo:rec.playTo,coreAssessment:rec.coreAssessment,marketAssessment:rec.marketAssessment})));
  if (before !== after) throw new Error('Evidence preparation changed a governed assessment');
  const identityDeferrals = deferInvalidCardEvidenceDraft(draftReport, draftSidecar);
  if (identityDeferrals.selectionIds.length) synchronizeCandidateDraft(draftReport, draftSidecar);
  const candidateForecasts = buildForecastCoverage({report:draftReport, sidecar:draftSidecar, universe:ctx.universe, feed:ctx.feed, priorRecords:ctx.priorRecords, registry:ctx.registry, now:report.ts});
  const candidates = finalizeCandidateAssessmentDraft({report:draftReport, sidecar:draftSidecar, universe:ctx.universe,
    observer:ctx.observer, forecastCoverage:candidateForecasts, draft:true});
  if (candidates.deferredSelectionIds.length) {
    synchronizeCandidateDraft(draftReport, draftSidecar);
    attachForecastCoverage({report:draftReport, sidecar:draftSidecar, universe:ctx.universe, feed:ctx.feed, priorRecords:ctx.priorRecords, registry:ctx.registry, now:report.ts});
  }
  draftSidecar.evidenceRepairVersion = EVIDENCE_REPAIR_VERSION;
  draftSidecar.cardEvidenceIdentityVersion = CARD_EVIDENCE_IDENTITY_VERSION;
  const audit = buildEvidenceAudit({root, report: draftReport, sidecar: draftSidecar, context: ctx});
  audit.warnings.push(...list(assembled.warnings));
  audit.assemblyChanges = assembled.changes;
  draftSidecar.evidenceApplication = audit;
  if (candidateAssessmentRequired(report)) {
    draftReport.candidateAssessment = audit.candidateAssessment;
    draftSidecar.candidateAssessment = structuredClone(audit.candidateAssessment);
    draftSidecar.candidateAssessmentVersion = audit.candidateAssessment.version;
  }
  audit.candidateDeferrals = {selectionIds:candidates.deferredSelectionIds, failures:candidates.deferFailures};
  audit.cardEvidenceDeferrals = identityDeferrals;
  return {report: draftReport, sidecar: draftSidecar, audit, changes: assembled.changes, warnings: assembled.warnings};
}

export function attachPublicationEvidenceAudit({root, report, sidecar, existingReport, existingSidecar}) {
  if (Date.parse(report.ts) < Date.parse(EVIDENCE_REPAIR_FROM) && !sidecar.evidenceRepairVersion) return null;
  // Diagnostic inputs can evolve. An identical publication retry must retain
  // the original audit, while writeImmutableJson still checks every other field.
  if (existingReport && existingSidecar) {
    // Keep first-publication insertion order: immutable JSON compares bytes.
    if (Object.hasOwn(existingReport, 'evidenceApplication')) report.evidenceApplication = structuredClone(existingReport.evidenceApplication);
    else delete report.evidenceApplication;
    if (Object.hasOwn(existingSidecar, 'evidenceApplication')) sidecar.evidenceApplication = structuredClone(existingSidecar.evidenceApplication);
    else delete sidecar.evidenceApplication;
    for (const field of ['candidateAssessment', 'marketMethodShadow']) {
      if (Object.hasOwn(existingReport, field)) report[field] = structuredClone(existingReport[field]);
      else delete report[field];
      if (Object.hasOwn(existingSidecar, field)) sidecar[field] = structuredClone(existingSidecar[field]);
      else delete sidecar[field];
    }
    return sidecar.evidenceApplication || null;
  }
  // Frozen recommendation content is never assembled or amended by the publisher.
  let audit;
  try {audit = buildEvidenceAudit({root, report, sidecar});}
  catch (error) {audit = {schema:1, version:EVIDENCE_REPAIR_VERSION, mode:'ADVISORY_ONLY', publicationBlocking:false, warnings:[error.message]};}
  sidecar.evidenceApplication = audit;
  report.evidenceApplication = {schema:1, version:EVIDENCE_REPAIR_VERSION, publicationBlocking:false,
    forecastCoverage: audit.forecastCoverage, blockedReview: audit.blockedReview,
    issueCounts: audit.cardReview?.issueCounts || {}, warnings: audit.warnings};
  if (candidateAssessmentRequired(report)) {
    const ctx = loadContext(root, report, sidecar);
    report.candidateAssessment = audit.candidateAssessment;
    sidecar.candidateAssessment = structuredClone(audit.candidateAssessment);
    report.marketMethodShadow = buildMarketMethodShadow({report, sidecar, universe:ctx.universe, observer:ctx.observer});
    sidecar.marketMethodShadow = structuredClone(report.marketMethodShadow);
  }
  return audit;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), value = flag => args[args.indexOf(flag)+1];
    if (!['prepare','review','candidates'].includes(args[0]) || !args.includes('--report') || !args.includes('--sidecar')) throw new Error('Usage: report-evidence-repair.mjs prepare|review|candidates --report FILE --sidecar FILE [--root DIR] [--feed FILE]');
    const root = path.resolve(args.includes('--root') ? value('--root') : process.cwd());
    const reportFile = path.resolve(value('--report')), sidecarFile = path.resolve(value('--sidecar'));
    if (args[0] === 'prepare') {
      for (const file of [reportFile, sidecarFile]) {
        const rel = path.relative(root, fs.realpathSync(file)).replaceAll(path.sep, '/');
        if (/^(data\/history\/(runs|research-fit|staging)\/|run-history\.json$)/.test(rel)) throw new Error('Prepare accepts draft files only; frozen staging and issued history remain immutable');
      }
    }
    const input = {root, report:read(reportFile), sidecar:read(sidecarFile), feedFile:args.includes('--feed') ? path.resolve(value('--feed')) : undefined};
    const result = args[0] === 'prepare' ? prepareEvidenceDraft(input) : buildEvidenceAudit(input);
    if (args[0] === 'prepare') {
      fs.writeFileSync(reportFile, JSON.stringify(result.report,null,2)+'\n');
      fs.writeFileSync(sidecarFile, JSON.stringify(result.sidecar,null,2)+'\n');
    }
    const audit = result.audit || result;
    if (args[0] === 'candidates') {
      const candidate = audit.candidateAssessment;
      console.log(JSON.stringify(args.includes('--details') ? candidate : {schema:candidate.schema, version:candidate.version,
        asOf:candidate.asOf, counts:candidate.counts, shortlist:candidate.shortlist, unfinished:candidate.unfinished,
        forecastCoverage:audit.forecastCoverage?.totals, warnings:[...audit.warnings, ...list(candidate.warnings)]},null,2));
      process.exit(0);
    }
    const blocked = audit.blockedReview;
    const blockedSummary = args.includes('--details') ? blocked : blocked && {
      recoveredCount: blocked.recoveredCount, stillBlockedCount: blocked.stillBlockedCount,
      targetedFollowUpCount: blocked.targetedFollowUpCount, qualifiedReferenceReviewCount: blocked.qualifiedReferenceReviewCount};
    console.log(JSON.stringify({mode:args[0] === 'prepare' ? 'DRAFT_PREPARED' : 'ADVISORY_ONLY', publicationBlocking:false, version:EVIDENCE_REPAIR_VERSION,
      forecastCoverage:audit.forecastCoverage?.totals || {state:audit.forecastCoverage?.state},
      candidateAssessment:audit.candidateAssessment?.counts, candidateDeferrals:audit.candidateDeferrals,
      cardEvidenceDeferrals:audit.cardEvidenceDeferrals,
      issueCounts:audit.cardReview?.issueCounts, blockedReview:blockedSummary, changes:result.changes, warnings:audit.warnings},null,2));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
