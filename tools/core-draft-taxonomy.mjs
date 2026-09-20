// Forward-only identity-label repair; never changes a price, fair, status or stake.
import {isDeepStrictEqual} from 'node:util';
import {evaluate, matchCondition} from './core-handicap-framework.mjs';
export const CORE_REVIEW_FROM = '2026-09-20T18:15:00-07:00';
export const CORE_TAXONOMY_VERSION = '2026-09-20.1';
const list = x => Array.isArray(x) ? x : [];
const key = x => x?.feed?.selectionKey || x?.selectionKey;
const time = x => Date.parse(x || '');
function actualBasketballLeague(event) {
  const league = String(event?.league?.slug || event?.identity?.leagueKey || '').toLowerCase();
  if (/(^|-)wnba($|-)/.test(league)) return 'WNBA';
  if (/(^|-)nba($|-)/.test(league)) return 'NBA';
  return null;
}
export function repairDraftCoreTaxonomy(report, sidecar, {feed, framework} = {}) {
  const changes = [], warnings = [];
  if (!(time(report?.ts) >= time(CORE_REVIEW_FROM)) || !feed || !framework) return {changes, warnings};
  for (const rec of list(report.recs)) {
    const old = rec?.coreAssessment, context = old?.context;
    if (!context || !['NBA_WNBA', 'NBA/WNBA'].includes(context.sport)) continue;
    const events = list(feed.events).filter(event => String(event.eventId ?? event.id) === String(rec.feed?.eventId) &&
      Number.isFinite(time(rec.feed?.eventDate)) && time(event.date || event.identity?.startTime) === time(rec.feed.eventDate));
    const sport = events.length === 1 ? actualBasketballLeague(events[0]) : null;
    if (!sport) {warnings.push(`${key(rec)}: actual NBA/WNBA league unresolved; combined label was not guessed.`); continue;}
    const items = list(sidecar?.recommendations).filter(item => key(item) === key(rec));
    const receipts = list(sidecar?.primaryAnalysis?.receipts).filter(row => row.state === 'EVALUATED' && key(row.decision) === key(rec));
    if (items.length !== 1 || receipts.length !== 1) {warnings.push(`${key(rec)}: exact-copy binding requires repair before taxonomy normalization.`); continue;}
    const holders = [rec, items[0], receipts[0].decision, receipts[0].evidence];
    if (holders.some(holder => !isDeepStrictEqual(holder?.coreAssessment, old))) {
      warnings.push(`${key(rec)}: existing Core copies disagree; normalization did not conceal the disagreement.`); continue;
    }
    const nextContext = {...context, sport, coreTaxonomyVersion: CORE_TAXONOMY_VERSION};
    nextContext.graduatedResearchIds = [...new Set(list(framework.graduatedResearchRules)
      .filter(rule => matchCondition(rule.when, nextContext)).map(rule => rule.priorId))].sort();
    const next = {...old, context: nextContext, ...evaluate(framework, nextContext)};
    for (const holder of holders) holder.coreAssessment = structuredClone(next);
    changes.push({selectionKey:key(rec), from:context.sport, to:sport,
      leagueKey:events[0].league?.slug || events[0].identity?.leagueKey, recomputedOnly:'Core classification trace'});
  }
  return {changes, warnings};
}
