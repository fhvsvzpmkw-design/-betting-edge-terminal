// Acquisition diagnostics are not handicapping or permission to repeat a pull.
import {majorSportKey} from './primary-sport-identity.mjs';
export const PRIMARY_FEED_HEALTH_FROM = '2026-10-27T07:15:00-07:00';
export const PRIMARY_FEED_MANIFEST_FROM = '2026-10-27T08:00:00-07:00';
const categories = new Set(['MLB','NHL','NBA','WNBA','NFL','NCAAF','CFL']);
const day = value => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));

export function inspectPrimaryFeedHealth(report, feed, availableSelections) {
  const at = Date.parse(report?.ts);
  const sourceEvents = new Map((feed?.events || []).map(event=>[String(event.id ?? event.eventId),event]));
  const forward = at >= Date.parse(PRIMARY_FEED_MANIFEST_FROM);
  const pending = row => categories.has(row.category) &&
    (!forward || !sourceEvents.has(String(row.eventId)) || majorSportKey(sourceEvents.get(String(row.eventId))) !== null) &&
    Number.isFinite(Date.parse(row.startTime || row.date)) &&
    Date.parse(row.startTime || row.date) > at && day(row.startTime || row.date) === day(at);
  const rows = (feed?.diagnostics?.coreMarketAvailability || []).filter(pending);
  const omitted = (feed?.diagnostics?.primaryEventsNotPriced || []).filter(pending);
  const events = new Set([...rows,...omitted].map(row => String(row.eventId)));
  if(forward)for(const event of sourceEvents.values()){
    const sport=majorSportKey(event);
    if(sport&&pending({category:sport==='NBA_WNBA'?'NBA':sport,startTime:event.date||event.identity?.startTime,eventId:event.id??event.eventId}))events.add(String(event.id??event.eventId));
  }
  const discoveryErrors=forward?(feed?.errors||[]).filter(row=>row.stage==='events'&&['baseball','ice-hockey','basketball','american-football'].includes(row.sport)):[];
  return {state:availableSelections > 0 ? 'PRICES_AVAILABLE' : events.size ? 'PRIMARY_PRICES_UNAVAILABLE' : discoveryErrors.length ? 'PRIMARY_DISCOVERY_FAILED' : 'NO_PRIMARY_EVENTS_IN_DIAGNOSTICS',
    availableSelections, pendingPrimaryEvents:events.size,
    failedOrUnattemptedEvents:rows.filter(row => Object.values(row.acquisition || {}).some(state => /FAILED|DENIED|NOT_ATTEMPTED|INVALID|REJECTED/.test(state))).length,
    omittedPrimaryEvents:omitted.length,
    discoveryFailures:discoveryErrors.length,
    bookmakerAccess:feed?.diagnostics?.bookmakerAccess || {},
    errors:(feed?.errors || []).map(row => ({stage:row.stage,bookmaker:row.bookmaker || null,message:row.message}))};
}

export function validatePrimaryFeedHealth(report, feed, availableSelections) {
  const health = inspectPrimaryFeedHealth(report, feed, availableSelections);
  // Preserve immutable issued reports and their historical verification.
  if (Date.parse(report?.ts) >= Date.parse(PRIMARY_FEED_HEALTH_FROM) && health.state === 'PRIMARY_DISCOVERY_FAILED')
    throw Error('PRIMARY ODDS ACQUISITION BLOCK: primary-sport discovery failed and no eligible primary prices are available. The slate could not be established; this is not a verified empty slate. Inspect the saved provider errors and budget before recovery.');
  if (Date.parse(report?.ts) >= Date.parse(PRIMARY_FEED_HEALTH_FROM) && ['PRIMARY_PRICES_UNAVAILABLE','PRIMARY_DISCOVERY_FAILED'].includes(health.state))
    throw Error(`PRIMARY ODDS ACQUISITION BLOCK: ${health.pendingPrimaryEvents} upcoming primary events were discovered but no eligible primary prices are available. Inspect feed access/errors and request budget; this is not an empty slate or a completed no-value analysis. Do not repeat collection without checking the existing request and provider budget.`);
  return health;
}
