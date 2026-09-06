import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {primaryAnalysisRequired, validateCoverageAudit} from './major-sport-market-coverage-gate.mjs';

const BOOKS = ['Bet365', 'DraftKings'];
const SPORTS = new Set(['MLB', 'NHL', 'NBA', 'WNBA', 'NBA_WNBA', 'NFL', 'NCAAF', 'CFL']);
const keyFor = detail => detail.includes('moneyline') ? 'ml' : detail.includes('total') ? 'totals' : 'spread';
const localDay = ts => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Vancouver', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(ts));
const eventId = event => String(event.eventId || event.identity?.eventId || event.id || '');
const eventLabel = (feed, id) => {
  const event = (feed.events || []).find(event => eventId(event) === String(id));
  return event?.away && event?.home ? `${event.away} at ${event.home}` : `Event ${id}`;
};

// Acquisition diagnostics explain exclusions; they never make a quote executable.
export function explainUnavailableSelections(report, audit, feed) {
  const diagnostics = new Map((feed.diagnostics?.coreMarketAvailability || []).map(row => [String(row.eventId), row]));
  const reasonCounts = new Map();
  const details = [];
  for (const limitation of audit.availabilityLimitations || []) {
    const diagnostic = diagnostics.get(String(limitation.eventId));
    const market = diagnostic?.markets?.[keyFor(limitation.marketDetail)];
    let reason = limitation.reason;
    if (reason === 'MARKET_NOT_RETURNED' && market && market.available === false) {
      const states = BOOKS.map(book => market.books?.[book]);
      const old = BOOKS.filter(book => market.books?.[book] === 'STALE_BEYOND_RETENTION');
      const staleEvidence = old.length > 0 && old.every(book => {
        const age = (Date.parse(feed.generatedAt) - Date.parse(market.updatedAtByBook?.[book])) / 60000;
        return Number.isFinite(age) && age > (feed.maxMarketAgeMinutes || 90);
      });
      if (staleEvidence && states.every(state => ['STALE_BEYOND_RETENTION', 'NOT_RETURNED'].includes(state))) reason = 'STALE_BEYOND_RETENTION';
    }
    const count = limitation.selections.length;
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + count);
    details.push({eventId:String(limitation.eventId), label:eventLabel(feed, limitation.eventId), sport:limitation.sport, marketDetail:limitation.marketDetail, selections:[...limitation.selections], reason});
  }
  const retained = new Set((feed.events || []).map(eventId));
  const discoveryOmissions = [...diagnostics.values()].filter(row => {
    const start = Date.parse(row.startTime);
    return SPORTS.has(row.category) && !retained.has(String(row.eventId)) && Number.isFinite(start) &&
      start > Date.parse(report.ts) && localDay(row.startTime) === localDay(report.ts);
  }).map(row => ({eventId:String(row.eventId), sport:row.category,
    reason:BOOKS.every(book => row.acquisition?.[book] === 'EVENT_NOT_RETURNED') ? 'EVENT_NOT_RETURNED' : 'EVENT_ACQUISITION_INCOMPLETE',
    acquisition:Object.fromEntries(BOOKS.map(book => [book, row.acquisition?.[book] || 'UNKNOWN']))
  })).sort((a,b) => a.eventId.localeCompare(b.eventId));
  return {unavailableReasons:[...reasonCounts].sort(([a],[b]) => a.localeCompare(b)).map(([reason,count]) => ({reason,count})), unavailableDetails:details, discoveryOmissions};
}

export function deriveReportCoverageSummary(report, sidecar, feed) {
  if (!primaryAnalysisRequired(report)) return null;
  const audit = sidecar.coverageAudit, totals = audit.totals;
  const receipts = sidecar.primaryAnalysis.receipts;
  const decisions = {bet:0, lean:0, wait:0, pass:0};
  for (const receipt of receipts) if (receipt.state === 'EVALUATED') decisions[receipt.decision.status.toLowerCase()]++;
  const blockers = receipts.filter(receipt => receipt.state === 'BLOCKED').map(receipt => {
    const [sport,eventId,marketDetail,side] = receipt.selectionId.split('|');
    return {selectionId:receipt.selectionId, sport, eventId, label:eventLabel(feed,eventId), marketDetail, side,
      reason:receipt.blocker.reason, missing:receipt.blocker.missing, impact:receipt.blocker.impact};
  });
  return {schema:1, source:{feedBlobSha:sidecar.provenance.feedBlobSha, feedGeneratedAt:feed.generatedAt, maxMarketAgeMinutes:feed.maxMarketAgeMinutes || 90},
    scope:'RETAINED_SAME_DAY_PREGAME_EVENTS', games:totals.gamesInScope,
    selections:{required:totals.primaryRequired, available:totals.primaryAvailable, evaluated:totals.primaryEvaluated,
      blocked:totals.primaryBlocked, unavailable:totals.primaryUnavailable},
    decisions, blockers, ...explainUnavailableSelections(report, audit, feed)};
}

function boundFeed(root, sidecar) {
  const sha = sidecar.provenance?.feedBlobSha;
  if (!/^[0-9a-f]{40}$/.test(String(sha))) throw new Error('Coverage summary requires the exact feed blob');
  const raw = execFileSync('git', ['cat-file','blob',sha], {cwd:root, encoding:'utf8', maxBuffer:128*1024*1024});
  const actual = createHash('sha1').update(`blob ${Buffer.byteLength(raw)}\0`).update(raw).digest('hex');
  if (actual !== sha) throw new Error('Coverage summary feed blob mismatch');
  return JSON.parse(raw);
}

export function validateReportCoverageSummary({root, report, sidecar, required=false}) {
  if (!primaryAnalysisRequired(report)) return null;
  const feed = boundFeed(root, sidecar);
  validateCoverageAudit(report, sidecar, {root, feed, requireCurrentAuthority:!required});
  const expected = deriveReportCoverageSummary(report, sidecar, feed);
  if ((required || report.coverageSummary !== undefined) && !isDeepStrictEqual(report.coverageSummary, expected)) {
    throw new Error('Report coverage summary does not reproduce from the verified analysis and bound feed');
  }
  return expected;
}

export function attachPublisherCoverageSummary({root, report, sidecar}) {
  const expected = validateReportCoverageSummary({root, report, sidecar});
  if (expected) report.coverageSummary = expected;
  return expected;
}
