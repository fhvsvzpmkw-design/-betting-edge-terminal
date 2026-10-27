// Acquisition diagnostics are not handicapping or permission to repeat a pull.
export const PRIMARY_FEED_HEALTH_FROM = '2026-10-27T07:15:00-07:00';
const categories = new Set(['MLB','NHL','NBA','WNBA','NFL','NCAAF','CFL']);
const day = value => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));

export function inspectPrimaryFeedHealth(report, feed, availableSelections) {
  const at = Date.parse(report?.ts);
  const pending = row => categories.has(row.category) && Number.isFinite(Date.parse(row.startTime || row.date)) &&
    Date.parse(row.startTime || row.date) > at && day(row.startTime || row.date) === day(at);
  const rows = (feed?.diagnostics?.coreMarketAvailability || []).filter(pending);
  const omitted = (feed?.diagnostics?.primaryEventsNotPriced || []).filter(pending);
  const events = new Set([...rows,...omitted].map(row => String(row.eventId)));
  return {state:availableSelections > 0 ? 'PRICES_AVAILABLE' : events.size ? 'PRIMARY_PRICES_UNAVAILABLE' : 'NO_PRIMARY_EVENTS_IN_DIAGNOSTICS',
    availableSelections, pendingPrimaryEvents:events.size,
    failedOrUnattemptedEvents:rows.filter(row => Object.values(row.acquisition || {}).some(state => /FAILED|DENIED|NOT_ATTEMPTED|INVALID|REJECTED/.test(state))).length,
    omittedPrimaryEvents:omitted.length,
    bookmakerAccess:feed?.diagnostics?.bookmakerAccess || {},
    errors:(feed?.errors || []).map(row => ({stage:row.stage,bookmaker:row.bookmaker || null,message:row.message}))};
}

export function validatePrimaryFeedHealth(report, feed, availableSelections) {
  const health = inspectPrimaryFeedHealth(report, feed, availableSelections);
  // Preserve immutable issued reports and their historical verification.
  if (Date.parse(report?.ts) >= Date.parse(PRIMARY_FEED_HEALTH_FROM) && health.state === 'PRIMARY_PRICES_UNAVAILABLE')
    throw Error(`PRIMARY ODDS ACQUISITION BLOCK: ${health.pendingPrimaryEvents} upcoming primary events were discovered but no eligible primary prices are available. Inspect feed access/errors and request budget; this is not an empty slate or a completed no-value analysis. Do not repeat collection without checking the existing request and provider budget.`);
  return health;
}
