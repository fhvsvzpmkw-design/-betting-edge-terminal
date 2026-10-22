// Durable research leads only. Loading a lead never supplies forecast eligibility,
// a directional decision, a fair value or wagering authority.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

export const FORECAST_FOLLOW_UP_FROM = '2026-10-22T16:50:00-07:00';
export const FORECAST_FOLLOW_UP_PATH = 'data/report-production/forecast-follow-ups.json';
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' && value.trim().length > 0;
const time = value => typeof value === 'string' && /(Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;
const digest = leads => createHash('sha256').update(JSON.stringify(leads)).digest('hex');
const blob = bytes => createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const fail = message => {throw new Error(`Forecast follow-up: ${message}`);};

function providerHosts(source) {
  const urls = [...list(source?.routes), ...Object.values(source?.sportBoards || {}),
    source?.methodUrl, source?.usageUrl, source?.collection?.url, source?.collection?.urlTemplate,
    source?.collection?.dailyUrlTemplate, source?.collection?.gameUrlTemplate];
  return [...new Set(urls.filter(text).flatMap(value => {
    try {return [new URL(value.replaceAll('{sport}', 'nhl')).hostname.toLowerCase().replace(/^www\./, '')];}
    catch {return [];}
  }))];
}

function validateLead(lead, registry) {
  if (!lead || typeof lead !== 'object' || Array.isArray(lead)) fail('lead must be an object');
  for (const field of ['leadId', 'sport', 'eventId', 'marketDetail', 'sourceId', 'url', 'finding', 'originPath'])
    if (!text(lead[field])) fail(`lead ${lead.leadId || '(missing ID)'} requires ${field}`);
  if (!/^[A-Za-z0-9:_-]{1,200}$/.test(lead.leadId) || !/^[A-Z0-9_]+$/.test(lead.sport) ||
      !/^[A-Za-z0-9_-]+$/.test(lead.eventId) || !/^[a-z][a-z0-9_]*$/.test(lead.marketDetail))
    fail(`lead ${lead.leadId} has malformed identity`);
  if (lead.period !== 'FULL_GAME' || !['home', 'away', 'over', 'under'].includes(lead.side))
    fail(`lead ${lead.leadId} requires exact period and side`);
  if (!(lead.line === null || (typeof lead.line === 'number' && Number.isFinite(lead.line))) ||
      (lead.marketDetail === 'full_game_moneyline' && (lead.line !== null || !['home', 'away'].includes(lead.side))))
    fail(`lead ${lead.leadId} requires its exact line`);
  if (!(typeof lead.probability === 'number' && lead.probability > 0 && lead.probability < 1))
    fail(`lead ${lead.leadId} requires its original probability`);
  const observed = time(lead.observedAt), created = time(lead.createdAt), start = time(lead.startTime);
  // Recording an old missed lead after a game is allowed; it stays out of the
  // operative queue. Never change its original observation to the entry time.
  if (![observed, created, start].every(Number.isFinite) || observed >= start || created < observed)
    fail(`lead ${lead.leadId} has invalid observation, creation or start time`);
  if (path.posix.isAbsolute(lead.originPath) || lead.originPath.includes('\\') ||
      path.posix.normalize(lead.originPath).split('/').includes('..') || path.posix.normalize(lead.originPath) === '.')
    fail(`lead ${lead.leadId} requires a repository-relative originPath`);
  const source = registry?.sources?.[lead.sourceId];
  if (!source) fail(`lead ${lead.leadId} has an unregistered provider`);
  let url;
  try {url = new URL(lead.url);} catch {fail(`lead ${lead.leadId} requires an original-provider URL`);}
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (url.protocol !== 'https:' || url.username || url.password ||
      !providerHosts(source).some(original => host === original || host.endsWith(`.${original}`)))
    fail(`lead ${lead.leadId} requires an original-provider URL`);
  return structuredClone(lead);
}

function matchingSelection(lead, universe) {
  const selections = Array.isArray(universe) ? universe : universe?.selections;
  if (!Array.isArray(selections)) return false;
  return selections.some(selection => {
    const parts = String(selection.selectionId || '').split('|');
    const sport = selection.sport || parts[0], eventId = String(selection.eventId || parts[1] || '');
    const market = selection.marketDetail || parts[2], side = selection.side || parts[3];
    if (!(sport === lead.sport || (sport === 'NBA_WNBA' && ['NBA', 'WNBA'].includes(lead.sport))) ||
        eventId !== lead.eventId || market !== lead.marketDetail || side !== lead.side ||
        time(selection.startTime || selection.eventDate) !== time(lead.startTime)) return false;
    if (market === 'full_game_moneyline') return lead.line === null;
    // Feed handicap lines are home-oriented; a lead uses the selected side's line.
    const quotes = list(selection.quotes).length ? selection.quotes : [selection.quote || selection];
    return quotes.some(quote => {
      const line = quote.line;
      return typeof line === 'number' && Number.isFinite(line) &&
        Math.abs((side === 'away' && /spread|run_line|puck_line/.test(market) ? -line : line) - lead.line) < 1e-8;
    });
  });
}

/** Merge root-owned known leads with carried research; input objects stay intact. */
export function loadForecastFollowUps({root = process.cwd(), report, sidecar = {}, universe, priorFollowUps = [], registry} = {}) {
  const reportAt = time(report?.ts);
  if (!(reportAt >= time(FORECAST_FOLLOW_UP_FROM))) return {active:false, leads:[], binding:null};
  let storeBytes = null, store = null;
  try {storeBytes = fs.readFileSync(path.join(root, FORECAST_FOLLOW_UP_PATH));}
  catch (error) {if (error.code !== 'ENOENT') throw error;}
  if (storeBytes !== null) {
    try {store = JSON.parse(storeBytes.toString('utf8'));} catch {fail('known-lead store is malformed JSON');}
    if (store?.schema !== 1 || store.kind !== 'KNOWN_FORECAST_FOLLOW_UPS' || !Array.isArray(store.leads))
      fail('known-lead store requires schema 1 and a leads array');
  }
  const pinned = sidecar?.forecastEvidence?.followUpInputs;
  if (pinned && (pinned.schema !== 1 || pinned.sourcePath !== FORECAST_FOLLOW_UP_PATH || !Array.isArray(pinned.leads) ||
      !(pinned.blobSha === null || /^[a-f0-9]{40}$/.test(pinned.blobSha || '')) || pinned.leadsSha256 !== digest(pinned.leads)))
    fail('pinned lead snapshot is malformed or changed');
  const embedded = sidecar?.forecastEvidence?.followUps;
  if (embedded !== undefined && !Array.isArray(embedded)) fail('queued followUps must be an array');
  if (!Array.isArray(priorFollowUps)) fail('priorFollowUps must be an array');
  const inputs = [...list(store?.leads), ...list(pinned?.leads), ...list(embedded), ...priorFollowUps];
  if (inputs.length && !registry) {
    try {registry = JSON.parse(fs.readFileSync(path.join(root, 'research/forecast-source-registry.json'), 'utf8'));}
    catch {fail('provider registry is required for known leads');}
  }
  const known = new Map();
  for (const raw of inputs) {
    const lead = validateLead(raw, registry), previous = known.get(lead.leadId);
    if (previous && !isDeepStrictEqual(previous, lead)) fail(`conflicting immutable leadId ${lead.leadId}`);
    known.set(lead.leadId, lead);
  }
  const leads = [...known.values()].filter(lead => time(lead.observedAt) <= reportAt && time(lead.createdAt) <= reportAt &&
    time(lead.startTime) > reportAt && matchingSelection(lead, universe)).sort((a,b) => a.leadId.localeCompare(b.leadId));
  const binding = {schema:1, sourcePath:FORECAST_FOLLOW_UP_PATH, blobSha:storeBytes === null ? null : blob(storeBytes),
    leadsSha256:digest(leads), leads:structuredClone(leads)};
  return {active:true, leads, binding};
}

/** Draft intake pins known work; completion and decisions remain separate. */
export function bindForecastFollowUps(options = {}) {
  const result = loadForecastFollowUps(options);
  if (result.active) {
    if (!options.sidecar || typeof options.sidecar !== 'object') fail('draft sidecar is required for binding');
    options.sidecar.forecastEvidence ||= {schema:1, records:[], attempts:[], revalidations:[]};
    options.sidecar.forecastEvidence.followUpInputs = structuredClone(result.binding);
  }
  return result;
}
