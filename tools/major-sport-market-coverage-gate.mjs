#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import quoteObservation from '../assets/quote-observation.js';
import { validateRecommendationEvidence } from './report-evidence-gate.mjs';
import { validatePersonnelSemantics } from './personnel-semantic-gate.mjs';
import { evaluate as evaluateCore, loadProductionFramework, matchCondition, validateContext } from './core-handicap-framework.mjs';

const AUTHORITY_PATH = 'data/major-sport-market-coverage-v1.json';
const FEED_PATH = 'data/live-odds.json';
const EXPECTED_AUTHORITY_ID = 'major-sport-market-coverage-v1';
const BOOKS = Object.freeze(['Bet365', 'DraftKings']);
const QUOTE_MAX_AGE_MINUTES = 30;
const PRIMARY_SCORE_EPSILON = 1e-8;
const FEED_MARKET_KEYS = Object.freeze({ moneyline: 'ml', spread: 'spread', total: 'totals' });

function die(message) { throw new Error(message); }
function ensure(condition, message) { if (!condition) die(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function isObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function int(value, label) { ensure(Number.isInteger(value) && value >= 0, `${label} must be a non-negative integer`); }
function parseMs(value) { const ms = Date.parse(value || ''); return Number.isFinite(ms) ? ms : null; }
function ageMinutes(older, newer) { const a = parseMs(older), b = parseMs(newer); return a === null || b === null ? Infinity : Math.max(0, (b - a) / 60000); }
function quoteFresh(market, feed) { return (quoteObservation.requiresObservation(feed) ? quoteObservation.quoteAgeMinutes(market, feed) : ageMinutes(market?.updatedAt, feed?.generatedAt || feed)) <= QUOTE_MAX_AGE_MINUTES; }
function decimalOdds(value) { const n = Number(value); return Number.isFinite(n) && n > 1.001 ? n : null; }
function implied(value) { const odds = decimalOdds(value); return odds ? 1 / odds : null; }
function marketKey(market) { return String(market?.marketKey || market?.identity?.marketKey || '').toLowerCase(); }
function eventId(event) { return String(event?.eventId || event?.identity?.eventId || event?.id || '').trim(); }
function rowLine(row) {
  for (const key of ['hdp', 'line', 'total', 'points']) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}
function selectionKey(row, side) { return String(row?.selectionKeys?.[side] || row?.identity?.selectionKeys?.[side] || '').trim(); }
function explicitPrimaryRow(row) { return row?.primary === true || row?.isPrimary === true || row?.main === true || row?.isMain === true || row?.mainLine === true || row?.isMainLine === true; }
function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(buffer).digest('hex');
}

function localDateKey(timestamp, timeZone) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year && values.month && values.day ? `${values.year}-${values.month}-${values.day}` : null;
}

function normalizedText(...values) {
  return values.filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function majorSportKey(event) {
  const sport = normalizedText(event?.sport?.slug || event?.identity?.sportKey || event?.sport?.name);
  const leagueSlug = normalizedText(event?.league?.slug || event?.identity?.leagueKey);
  const league = normalizedText(event?.league?.slug, event?.league?.name, event?.identity?.leagueKey);

  if (sport === 'baseball' && (leagueSlug === 'usa mlb' || /\bmlb\b|major league baseball/.test(league))) return 'MLB';
  if (sport === 'ice hockey' && (leagueSlug === 'usa nhl' || /\bnhl\b|national hockey league/.test(league))) return 'NHL';
  if (sport === 'basketball' && (['usa nba', 'usa wnba'].includes(leagueSlug) || /\bnba\b|\bwnba\b|national basketball association/.test(league))) return 'NBA_WNBA';
  if (sport !== 'american football') return null;
  if (leagueSlug === 'usa nfl' || /\bnfl\b|national football league/.test(league)) return 'NFL';
  if (['usa college', 'usa ncaaf'].includes(leagueSlug) || /\bncaaf\b|\bncaa\b|college/.test(league)) return 'NCAAF';
  if (['canada cfl', 'canadian football league'].includes(leagueSlug) || /\bcfl\b|canadian football league/.test(league)) return 'CFL';
  return null;
}

export function mergedFeedEvents(feed) {
  if (quoteObservation.requiresObservation(feed)) {
    const retained = new Set((feed.events || []).map(eventId));
    return new Map(quoteObservation.mergeObservedEvents(feed).filter(event => retained.has(eventId(event))).map(event => [eventId(event), event]));
  }
  const merged = new Map();
  for (const event of feed?.events || []) {
    const id = eventId(event);
    if (id) merged.set(id, { ...event, bookmakers: { ...(event?.bookmakers || {}) } });
  }
  for (const collection of [feed?.deepMarkets || [], feed?.baseballProps || []]) {
    for (const event of collection) {
      const id = eventId(event);
      if (!id || !merged.has(id)) continue;
      const current = merged.get(id);
      const next = { ...event, ...current, bookmakers: { ...(current?.bookmakers || {}) } };
      for (const [book, markets] of Object.entries(event?.bookmakers || {})) {
        next.bookmakers[book] = [...(next.bookmakers[book] || []), ...(Array.isArray(markets) ? markets : [])];
      }
      merged.set(id, next);
    }
  }
  return merged;
}

export function latestMarket(event, book, wantedKey, feed) {
  const markets = Array.isArray(event?.bookmakers?.[book]) ? event.bookmakers[book] : [];
  const candidates = markets.filter(market => marketKey(market) === wantedKey);
  // An unobserved v1 copy cannot silently lose to an older valid quote.
  if (quoteObservation.requiresObservation(feed)) {
    const invalid = candidates.find(market => !Number.isFinite(quoteObservation.quoteAgeMinutes(market, feed)));
    if (invalid) return invalid;
  }
  return candidates.sort((a, b) => quoteObservation.requiresObservation(feed) ? quoteObservation.compareMarketRecency(a, b, feed) : (parseMs(b?.updatedAt) ?? -Infinity) - (parseMs(a?.updatedAt) ?? -Infinity))[0] || null;
}

function inspectFixedMarket(market, selections) {
  const states = {};
  for (const side of selections) {
    let pricedWithoutIdentity = false;
    for (const row of market?.odds || []) {
      if (!decimalOdds(row?.[side])) continue;
      if (selectionKey(row, side)) { states[side] = 'AVAILABLE'; break; }
      pricedWithoutIdentity = true;
    }
    if (!states[side]) states[side] = pricedWithoutIdentity ? 'IDENTITY' : 'INCOMPLETE';
  }
  return { state: 'RESOLVED', selections: states };
}

export function inspectPrimaryLineMarket(market, selections) {
  const rows = (market?.odds || []).filter(row => rowLine(row) !== null);
  if (!rows.length) return { state: 'INCOMPLETE' };

  const marked = rows.filter(explicitPrimaryRow);
  let candidates;
  if (marked.length) {
    candidates = marked;
  } else {
    const priced = rows.map(row => {
      const first = implied(row?.[selections[0]]);
      const second = implied(row?.[selections[1]]);
      return first && second ? { row, balance: Math.abs(first - second) } : null;
    }).filter(Boolean);
    if (!priced.length) return { state: 'INCOMPLETE' };
    const minimum = Math.min(...priced.map(item => item.balance));
    candidates = priced.filter(item => Math.abs(item.balance - minimum) <= PRIMARY_SCORE_EPSILON).map(item => item.row);
  }

  const lines = [...new Set(candidates.map(rowLine))];
  if (lines.length !== 1) return { state: 'AMBIGUOUS' };
  const line = lines[0];
  const lineRows = rows.filter(row => Math.abs(rowLine(row) - line) <= 0.001);
  const states = {};
  for (const side of selections) {
    const priced = lineRows.filter(row => decimalOdds(row?.[side]));
    if (priced.some(row => selectionKey(row, side))) states[side] = 'AVAILABLE';
    else states[side] = priced.length ? 'IDENTITY' : 'INCOMPLETE';
  }
  return { state: 'RESOLVED', selections: states, line, method: marked.length ? 'PROVIDER_PRIMARY' : 'MARKET_CENTER' };
}

function inspectBookPrimary(event, book, spec, feedGeneratedAt) {
  const wantedKey = FEED_MARKET_KEYS[spec.market];
  const market = latestMarket(event, book, wantedKey, feedGeneratedAt);
  if (!market) return { state: 'MISSING' };
  if (!quoteFresh(market, feedGeneratedAt)) return { state: 'STALE' };
  if (quoteObservation.requiresObservation(feedGeneratedAt) && (quoteObservation.isSuspended(event) || quoteObservation.isSuspended(market))) return { state: 'INCOMPLETE' };
  return spec.primaryLineOnly
    ? inspectPrimaryLineMarket(market, spec.requiredSelections)
    : inspectFixedMarket(market, spec.requiredSelections);
}

function unavailableReason(bookResults, selection) {
  const resolved = bookResults.filter(result => result.state === 'RESOLVED');
  if (resolved.some(result => result.selections?.[selection] === 'IDENTITY')) return 'IDENTITY_UNRESOLVED';
  if (resolved.length) return 'INCOMPLETE_TWO_SIDED_MARKET';
  if (bookResults.some(result => result.state === 'AMBIGUOUS')) return 'PRIMARY_LINE_UNRESOLVED';
  if (bookResults.some(result => result.state === 'INCOMPLETE')) return 'INCOMPLETE_TWO_SIDED_MARKET';
  if (bookResults.some(result => result.state === 'STALE')) return 'STALE_EXECUTABLE_QUOTE';
  return 'MARKET_NOT_RETURNED';
}

function primarySpecs(policy, sport) {
  return sport === 'NFL' || sport === 'NCAAF' || sport === 'CFL'
    ? policy.sports.FOOTBALL.primary
    : policy.sports[sport].primary;
}

function isPlayerPropMarket(market) {
  const text = normalizedText(marketKey(market), market?.name);
  if (/\bteam total\b|\bwinning margin\b|\bfirst team\b|\blast team\b/.test(text)) return false;
  return /\bplayer\b|\bpitcher\b|\bbatter\b|\bstrikeouts?\b|\bruns batted in\b|\brbi\b|\btotal bases?\b|\bhome runs?\b|\bstolen bases?\b|\bhits? o u\b|\bruns? o u\b|\bdoubles? o u\b|\btriples? o u\b|\bdouble double\b|\btriple double\b|\bpoint assist and rebound\b|\btouchdown scor|\bpassing\b|\brushing\b|\breceiving\b|\breceptions?\b|\bgoalie\b|\bshots on goal\b|\bgoalscorer\b|\bthree pointers?\b/.test(text);
}

function freshPropSelectionKeys(event, feedGeneratedAt) {
  const keys = new Set();
  for (const book of BOOKS) {
    for (const market of event?.bookmakers?.[book] || []) {
      if (!isPlayerPropMarket(market) || !quoteFresh(market, feedGeneratedAt)) continue;
      for (const row of market?.odds || []) {
        const supplied = { ...(row?.identity?.selectionKeys || {}), ...(row?.selectionKeys || {}) };
        for (const [side, key] of Object.entries(supplied)) {
          if (nonEmpty(String(key)) && decimalOdds(row?.[side])) keys.add(String(key));
        }
      }
    }
  }
  return keys;
}

export function deriveBoundCoverage(report, feed, policy) {
  ensure(isObject(feed), 'Bound odds feed must be an object');
  ensure(Array.isArray(feed.events), 'Bound odds feed events must be an array');
  ensure(String(feed.generatedAt || '') === String(report?.feedGeneratedAt || ''), `Bound feed ${feed.generatedAt || 'unknown'} does not match report ${report?.feedGeneratedAt || 'unknown'}`);
  ensure(parseMs(feed.generatedAt) !== null, 'Bound odds feed generatedAt must be parseable');
  const reportMs = parseMs(report?.ts);
  const reportDate = localDateKey(report?.ts, policy.timezone);
  ensure(reportMs !== null && reportDate, 'Cannot derive coverage from an invalid report timestamp');

  const sportKeys = policy.coverageAudit.sportKeys;
  const games = Object.fromEntries(sportKeys.map(sport => [sport, new Map()]));
  for (const event of feed?.events || []) {
    const sport = majorSportKey(event);
    if (!sport) continue;
    const id = eventId(event);
    const startMs = parseMs(event?.date || event?.identity?.startTime);
    const eventDate = localDateKey(event?.date || event?.identity?.startTime, policy.timezone);
    ensure(id, `Bound feed ${sport} event is missing exact event identity`);
    ensure(startMs !== null && eventDate, `Bound feed ${sport} event ${id} has an invalid start time`);
    if (startMs <= reportMs || eventDate !== reportDate) continue;
    games[sport].set(id, event);
  }

  const merged = mergedFeedEvents(feed);
  const sports = {};
  const limitations = new Map();
  for (const sport of sportKeys) {
    let evaluated = 0;
    let unavailable = 0;
    const propKeys = new Set();
    for (const [id, primaryEvent] of games[sport]) {
      const event = merged.get(id) || primaryEvent;
      for (const spec of primarySpecs(policy, sport)) {
        const results = BOOKS.map(book => inspectBookPrimary(event, book, spec, feed));
        for (const selection of spec.requiredSelections) {
          const available = results.some(result => result.state === 'RESOLVED' && result.selections?.[selection] === 'AVAILABLE');
          if (available) { evaluated += 1; continue; }
          unavailable += 1;
          limitations.set(`${sport}|${id}|${spec.marketDetail}|${selection}`, unavailableReason(results, selection));
        }
      }
      for (const key of freshPropSelectionKeys(event, feed)) propKeys.add(key);
    }
    sports[sport] = {
      eventIds: [...games[sport].keys()].sort(),
      gamesInScope: games[sport].size,
      primary: {
        required: games[sport].size * policy.coverageAudit.primarySelectionsPerGame,
        evaluated,
        unavailable
      },
      propsReturned: propKeys.size
    };
  }
  return { sports, limitations };
}

// Forward-only: availability is an exact quote inventory, never an analysis verdict.
export const PRIMARY_ANALYSIS_FROM = '2026-09-06T00:00:00-07:00';
export const UNBOUNDED_PRESENTATION_FROM = PRIMARY_ANALYSIS_FROM;
export function primaryAnalysisRequired(report) { return parseMs(report?.ts) >= Date.parse(PRIMARY_ANALYSIS_FROM); }
export function unboundedPresentationRequired(report) { return parseMs(report?.ts) >= Date.parse(UNBOUNDED_PRESENTATION_FROM); }
function quoteClosed(value) {
  return value?.suspended === true || value?.isSuspended === true || value?.active === false || value?.isActive === false ||
    /^(suspended|closed|settled|cancelled|canceled|unavailable|disabled)$/i.test(String(value?.status || value?.state || ''));
}
function exactSelectionIdentity(key, id, wantedMarket, side, line) {
  const parts = String(key || '').split('|');
  if (parts.length !== 5 || parts[0] !== id || parts[1] !== wantedMarket || parts[2] !== side) return false;
  // The optional fourth component is the provider's row label. The fifth stores
  // the feed's HOME spread line for BOTH sides, not an away-oriented handicap.
  return line === null ? parts[4] === '' : parts[4] !== '' && Number.isFinite(Number(parts[4])) && Math.abs(Number(parts[4]) - line) < 1e-8;
}
function inspectExactPrimary(event, book, spec, feedGeneratedAt) {
  const closed = quoteObservation.requiresObservation(feedGeneratedAt) ? quoteObservation.isSuspended : quoteClosed;
  const candidates = (event?.bookmakers?.[book] || []).filter(market => marketKey(market) === FEED_MARKET_KEYS[spec.market]);
  const market = latestMarket(event, book, FEED_MARKET_KEYS[spec.market], feedGeneratedAt);
  if (!market) return { state: 'MISSING', quotes: {} };
  const newest = candidates.filter(candidate => quoteObservation.quoteTimeMs(candidate, feedGeneratedAt) === quoteObservation.quoteTimeMs(market, feedGeneratedAt));
  const stable = value => Array.isArray(value) ? value.map(stable) : isObject(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
  if (new Set(newest.map(candidate => JSON.stringify(stable(candidate)))).size > 1) return { state: 'INCOMPLETE', quotes: {} };
  const period = market.period ?? market.periodKey ?? market.periodName ?? market.identity?.period;
  const partialLabel = /\b(?:first|second|third|fourth|1st|2nd|3rd|4th)\s+(?:half|quarter|period|[1-9]\s+innings?)\b|\b(?:half[- ]time|[1-9]\s+innings?|quarter|period)\b/i.test(String(market.name || ''));
  if (partialLabel || (period != null && !['0', 'full', 'full_game', 'full game', 'game', 'match', 'ft'].includes(String(period).toLowerCase()))) return { state: 'INCOMPLETE', quotes: {} };
  const updatedMs = quoteObservation.quoteTimeMs(market, feedGeneratedAt), feedMs = parseMs(feedGeneratedAt?.generatedAt || feedGeneratedAt);
  if (updatedMs === null || updatedMs > feedMs || !quoteFresh(market, feedGeneratedAt)) return { state: 'STALE', quotes: {} };
  if (closed(event) || closed(market)) return { state: 'INCOMPLETE', quotes: {} };
  const inspected = spec.primaryLineOnly ? inspectPrimaryLineMarket(market, spec.requiredSelections) : inspectFixedMarket(market, spec.requiredSelections);
  if (inspected.state !== 'RESOLVED') return { ...inspected, quotes: {} };
  const id = eventId(event), wantedMarket = FEED_MARKET_KEYS[spec.market];
  const line = spec.primaryLineOnly ? inspected.line : null;
  const states = {}, quotes = {};
  for (const side of spec.requiredSelections) {
    const rows = (market.odds || []).filter(row => !spec.primaryLineOnly || Math.abs(rowLine(row) - line) < 1e-8);
    const priced = rows.filter(row => !closed(row) && decimalOdds(row[side]));
    const exact = priced.filter(row => exactSelectionIdentity(selectionKey(row, side), id, wantedMarket, side, line));
    // Conflicting prices/identities at the same newest market timestamp are not
    // silently resolved by array order or by rescuing an older quote.
    const unique = new Map(exact.map(row => [JSON.stringify([selectionKey(row, side), decimalOdds(row[side])]), row]));
    if (unique.size !== 1) { states[side] = priced.length ? 'IDENTITY' : 'INCOMPLETE'; continue; }
    const row = [...unique.values()][0];
    states[side] = 'AVAILABLE';
    quotes[side] = { book, eventId: id, marketKey: wantedMarket, side, line, selectionKey: selectionKey(row, side), priceDecimal: decimalOdds(row[side]), quoteUpdatedAt: quoteObservation.requiresObservation(feedGeneratedAt) ? market.updatedAt ?? null : market.updatedAt, ...(quoteObservation.requiresObservation(feedGeneratedAt) ? { quoteObservedAt: market.observedAt } : {}) };
  }
  return { ...inspected, selections: states, quotes };
}

export function derivePrimarySelectionInventory(report, feed, policy) {
  const bound = deriveBoundCoverage(report, feed, policy); // Retain exact scope/clock checks.
  const merged = mergedFeedEvents(feed), selections = [], limitations = new Map(), sports = {};
  for (const sport of policy.coverageAudit.sportKeys) {
    const expected = bound.sports[sport];
    let available = 0, unavailable = 0;
    for (const id of expected.eventIds) {
      const event = merged.get(id);
      for (const spec of primarySpecs(policy, sport)) {
        const results = BOOKS.map(book => inspectExactPrimary(event, book, spec, feed));
        for (const side of spec.requiredSelections) {
          const selectionId = `${sport}|${id}|${spec.marketDetail}|${side}`;
          const quotes = results.map(result => result.quotes?.[side]).filter(Boolean);
          if (!quotes.length) { unavailable++; limitations.set(selectionId, unavailableReason(results, side)); continue; }
          available++;
          selections.push({ selectionId, sport, eventId: id, eventDate: event.date || event.identity?.startTime, marketClass: spec.market, marketDetail: spec.marketDetail, side, quotes });
        }
      }
    }
    sports[sport] = { ...expected, primary: { required: expected.primary.required, available, unavailable } };
  }
  selections.sort((a, b) => a.selectionId.localeCompare(b.selectionId));
  return { selections, sports, limitations };
}

const PRIMARY_BLOCKER_REASONS = new Set(['SOURCE_UNAVAILABLE', 'FAIR_MODEL_UNAVAILABLE', 'PERSONNEL_UNRESOLVED', 'CALIBRATION_UNAVAILABLE', 'CONFLICTING_EVIDENCE', 'RESEARCH_INCOMPLETE']);
function exactObject(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function closeNumber(left, right) { return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1e-8; }
function sameQuote(left, right) { return isObject(left) && Object.keys(right).every(key => left[key] === right[key]) && Object.keys(left).length === Object.keys(right).length; }
function receiptTime(value, report, label) {
  const ms = parseMs(value);
  ensure(ms !== null && ms >= parseMs(report.feedGeneratedAt) && ms <= parseMs(report.ts), `${label} must be at/after this feed and no later than report issuance`);
  return ms;
}
function validatePrimaryBlocker(report, receipt, selection) {
  const label = `Primary receipt ${selection.selectionId}`, blocker = receipt.blocker;
  ensure(isObject(blocker) && PRIMARY_BLOCKER_REASONS.has(blocker.reason), `${label} requires a controlled evidence blocker reason`);
  ensure(nonEmpty(blocker.missing) && nonEmpty(blocker.impact), `${label} requires concrete missing evidence and decision impact`);
  const checkedMs = receiptTime(blocker.checkedAt, report, `${label} blocker.checkedAt`);
  ensure(Array.isArray(blocker.attempts) && blocker.attempts.length > 0, `${label} requires recorded event-specific source/check attempts`);
  for (const attempt of blocker.attempts) {
    ensure(isObject(attempt) && String(attempt.eventId) === selection.eventId && nonEmpty(attempt.finding), `${label} blocker attempt requires exact eventId and finding`);
    const attemptedMs = parseMs(attempt.checkedAt);
    ensure(attemptedMs !== null && attemptedMs <= checkedMs, `${label} source attempt checkedAt cannot follow blocker review`);
    let url; try { url = new URL(attempt.url); } catch { die(`${label} source attempt requires a specific URL`); }
    ensure(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && (url.pathname !== '/' || url.search), `${label} source attempt requires a specific HTTP(S) page or artifact`);
  }
  for (const field of ['decision', 'evidence', 'fairValueEvidence', 'fair', 'status', 'marketFair']) ensure(receipt[field] == null, `${label} BLOCKED cannot carry a fabricated decision or fair`);
}
function receiptCore(decision, evidence, framework, label) {
  const assessment = decision.coreAssessment, context = assessment?.context;
  ensure(isObject(assessment) && isObject(context) && exactObject(assessment, evidence.coreAssessment), `${label} requires identical recorded Core assessment in decision and evidence`);
  ensure(assessment.frameworkId === framework.frameworkId, `${label} Core framework identity mismatch`);
  validateContext(framework, context, label);
  ensure(['INDEPENDENT_MODEL', 'MARKET_ANCHORED_MODEL'].includes(context.fairValueBasis), `${label} market-only/unavailable fair must be BLOCKED, not an evaluated value decision`);
  ensure(['MODERATE', 'STRONG'].includes(context.independentCurrentSupport), `${label} evaluated value decision requires independent current support`);
  const researchIds = [...new Set((framework.graduatedResearchRules || []).filter(rule => matchCondition(rule.when, context)).map(rule => rule.priorId))].sort();
  ensure(exactObject([...context.graduatedResearchIds].sort(), researchIds), `${label} Core graduated research allowlist mismatch`);
  const actual = evaluateCore(framework, context);
  for (const field of ['modelErrorState', 'betEligibleByModelError']) ensure(assessment[field] === actual[field], `${label} Core ${field} does not recompute`);
  for (const field of ['effects', 'appliedRules']) ensure(Array.isArray(assessment[field]) && exactObject([...assessment[field]].sort(), [...actual[field]].sort()), `${label} Core ${field} does not recompute`);
  for (const field of ['fairValueBasisRationale', 'uncertaintyStatement', 'rationale']) ensure(nonEmpty(assessment[field]), `${label} Core ${field} is required`);
  if (decision.status === 'BET') ensure(actual.betEligibleByModelError, `${label} BET blocked by Core model error`);
}
function canonicalReceiptFair(selection, quote, fair) {
  const referenceSide = selection.marketClass === 'total' ? 'over' : 'home';
  const reverse = selection.side !== referenceSide;
  let unit = fair.unit, estimate = fair.estimate, low = fair.range.low, high = fair.range.high;
  const probability = value => value > 0 ? 100 / (value + 100) : -value / (-value + 100);
  if (unit === 'selection_american_odds') {
    unit = 'selection_probability';
    estimate = probability(estimate);
    [low, high] = [probability(low), probability(high)].sort((a, b) => a - b);
  }
  if (unit === 'selection_probability') {
    if (reverse) [estimate, low, high] = [1 - estimate, 1 - high, 1 - low];
  } else if (unit === 'selection_spread_points' || unit === 'home_spread_points') {
    unit = 'home_spread_points';
    if (reverse) [estimate, low, high] = [-estimate, -high, -low];
  }
  // Probability at different primary spread/total lines is a different contract.
  const line = unit === 'selection_probability' ? quote.line : null;
  return { key: `${selection.sport}|${selection.eventId}|${selection.marketDetail}|${unit}|${line ?? ''}`, unit, estimate, low, high };
}

export function summarizePrimaryAnalysis(receipts) {
  const outcomeCounts = { BET: 0, LEAN: 0, WAIT: 0, PASS: 0 };
  let primaryEvaluated = 0, primaryBlocked = 0;
  for (const receipt of receipts || []) {
    if (receipt.state === 'BLOCKED') primaryBlocked++;
    else if (receipt.state === 'EVALUATED') { primaryEvaluated++; outcomeCounts[receipt.decision.status]++; }
  }
  return { primaryAvailable: primaryEvaluated + primaryBlocked, primaryEvaluated, primaryBlocked, outcomeCounts };
}

export function validatePrimaryAnalysis(report, sidecar, { feed = null, policy = null, inventory = null, framework = null } = {}) {
  if (!primaryAnalysisRequired(report)) return { enforced: false, reason: 'pre-cutover' };
  ensure(inventory || (feed && policy), 'Primary analysis validation requires the exact bound feed and coverage policy');
  const bound = inventory || derivePrimarySelectionInventory(report, feed, policy), analysis = sidecar?.primaryAnalysis;
  ensure(isObject(analysis) && analysis.schema === 1 && analysis.feedGeneratedAt === report.feedGeneratedAt && Array.isArray(analysis.receipts), 'primaryAnalysis schema 1, bound feedGeneratedAt and complete receipts are required');
  const required = new Map(bound.selections.map(selection => [selection.selectionId, selection])), seen = new Set(), fairGroups = new Map(), fairBases = new Map();
  let runtime = framework;
  const sports = Object.fromEntries(Object.entries(bound.sports).map(([sport, row]) => [sport, { available: row.primary.available, evaluated: 0, blocked: 0 }]));
  for (const [index, receipt] of analysis.receipts.entries()) {
    const selection = required.get(receipt?.selectionId), label = `Primary receipt ${receipt?.selectionId || index}`;
    ensure(selection && !seen.has(receipt.selectionId), `${label} is missing from available inventory or duplicated`);
    seen.add(receipt.selectionId);
    ensure(selection.quotes.some(quote => sameQuote(receipt.quote, quote)), `${label} quote identity/book/line/price/time differs from exact bound feed`);
    ensure(['EVALUATED', 'BLOCKED'].includes(receipt.state), `${label} requires EVALUATED or BLOCKED`);
    if (receipt.state === 'BLOCKED') { validatePrimaryBlocker(report, receipt, selection); sports[selection.sport].blocked++; continue; }
    receiptTime(receipt.checkedAt, report, `${label} checkedAt`);
    ensure(receipt.blocker == null, `${label} EVALUATED cannot also carry a blocker`);
    const decision = receipt.decision, evidence = receipt.evidence, quote = receipt.quote;
    ensure(isObject(decision) && isObject(evidence) && ['BET', 'LEAN', 'WAIT', 'PASS'].includes(decision.status), `${label} requires a recorded decision and matching evidence`);
    ensure(evidence.status === decision.status, `${label} decision/evidence status mismatch`);
    const context = decision.coreAssessment?.context || {};
    const canonicalSport = ['NBA', 'WNBA', 'NBA/WNBA'].includes(context.sport) ? 'NBA_WNBA' : context.sport;
    ensure(canonicalSport === selection.sport && context.marketClass === selection.marketClass && context.marketDetail === selection.marketDetail, `${label} decision Core context differs from exact inventory`);
    for (const field of ['eventId', 'marketKey', 'side', 'selectionKey']) ensure(String(decision.feed?.[field]) === String(quote[field]), `${label} decision ${field} differs from inventory`);
    ensure(parseMs(decision.feed?.eventDate) !== null && parseMs(decision.feed.eventDate) === parseMs(selection.eventDate), `${label} decision eventDate differs from inventory`);
    for (const [kind, binding] of [['decision', decision.feed], ['evidence', evidence.feed]]) {
      if (binding == null) continue;
      ensure(isObject(binding), `${label} ${kind} feed must be an object`);
      for (const field of ['eventId', 'marketKey', 'side', 'selectionKey', 'book']) if (Object.hasOwn(binding, field)) ensure(String(binding[field]) === String(quote[field]), `${label} ${kind} feed ${field} differs from inventory`);
      if (Object.hasOwn(binding, 'eventDate')) ensure(parseMs(binding.eventDate) === parseMs(selection.eventDate), `${label} ${kind} feed eventDate differs from inventory`);
      for (const field of ['line', 'hdp', 'total', 'points']) if (Object.hasOwn(binding, field)) ensure(quote.line === null ? binding[field] === null : binding[field] != null && closeNumber(Number(binding[field]), quote.line), `${label} ${kind} feed ${field} differs from inventory line`);
      if (Object.hasOwn(binding, 'quoteUpdatedAt')) ensure(binding.quoteUpdatedAt === quote.quoteUpdatedAt, `${label} ${kind} feed quoteUpdatedAt differs from inventory`);
      if (Object.hasOwn(quote, 'quoteObservedAt') && Object.hasOwn(binding, 'quoteObservedAt')) ensure(binding.quoteObservedAt === quote.quoteObservedAt, `${label} ${kind} feed quoteObservedAt differs from inventory`);
      if (Object.hasOwn(binding, 'priceDecimal')) ensure(closeNumber(Number(binding.priceDecimal), quote.priceDecimal), `${label} ${kind} feed priceDecimal differs from inventory`);
    }
    ensure(decision.book === quote.book, `${label} decision book differs from receipt quote`);
    const american = quote.priceDecimal >= 2 ? Math.round((quote.priceDecimal - 1) * 100) : Math.round(-100 / (quote.priceDecimal - 1));
    ensure(Number(String(decision.price).replace('−', '-')) === american, `${label} decision price differs from exact executable quote`);
    ensure(nonEmpty(decision.analysis), `${label} requires event-specific analysis and decision rationale`);
    if (decision.status !== 'BET') ensure(/^\$?0(?:\.0+)?$/.test(String(decision.stake)), `${label} non-BET decision must carry zero stake`);
    validateRecommendationEvidence(report, decision, evidence, index);
    ensure(isObject(decision.fairValueEvidence), `${label} evaluated PASS requires a numeric documented fair; use BLOCKED when fair cannot be established`);
    const sourceKinds = new Map((decision.sourceEvidence || []).map(source => [source.id, source.kind]));
    ensure(decision.fairValueEvidence.inputs.some(input => input.sourceIds.some(id => sourceKinds.get(id) !== 'MARKET' && sourceKinds.has(id))), `${label} numeric fair requires non-market source-linked inputs`);
    runtime ||= loadProductionFramework();
    receiptCore(decision, evidence, runtime, label);
    validatePersonnelSemantics({ ...report, recs: [decision] }, { ...sidecar, recommendations: [evidence] });
    const fair = canonicalReceiptFair(selection, quote, decision.fairValueEvidence), prior = fairGroups.get(fair.key);
    const contractKey = `${selection.sport}|${selection.eventId}|${selection.marketDetail}|${quote.line ?? ''}`;
    ensure(!fairBases.has(contractKey) || fairBases.get(contractKey) === fair.unit, `${label} opposing selections must share a coherent fair unit/basis`);
    fairBases.set(contractKey, fair.unit);
    if (prior) for (const field of ['estimate', 'low', 'high']) ensure(closeNumber(fair[field], prior[field]), `${label} opposing selections have incoherent shared market fair ${field}`);
    else fairGroups.set(fair.key, fair);
    const matchingCard = (report.recs || []).find(card => card.feed?.selectionKey === quote.selectionKey && String(card.feed?.eventId) === quote.eventId && card.book === quote.book);
    ensure(matchingCard && exactObject(matchingCard, decision), `${label} evaluated decision must match its published card; card-count curation is not permitted`);
    sports[selection.sport].evaluated++;
  }
  const missing = [...required.keys()].filter(key => !seen.has(key));
  ensure(!missing.length, `Primary analysis missing ${missing.length} required receipt(s): ${missing.slice(0, 8).join(', ')}`);
  // Every primary card also needs the matching independently recorded receipt.
  for (const [index, card] of (report.recs || []).entries()) {
    const receipt = analysis.receipts.find(item => item.state === 'EVALUATED' && exactObject(item.decision, card));
    if (receipt) continue;
    // A required continuity card can explain a now-unavailable quote. It is
    // neither an available selection nor a newly evaluated value decision.
    const context = card.coreAssessment?.context || {};
    const sport = ['NBA', 'WNBA', 'NBA/WNBA'].includes(context.sport) ? 'NBA_WNBA' : context.sport;
    const tuple = `${sport}|${card.feed?.eventId}|${context.marketDetail}|${card.feed?.side}`;
    const unavailablePass = bound.limitations.has(tuple) && card.status === 'PASS' && isObject(card.sourceShortfall) && card.fairValueEvidence == null && /^\$?0(?:\.0+)?$/.test(String(card.stake)) && /\b(?:unavailable|unverified|not rated|not assessed|not established|not calculated|withheld|no fair|n\/a)\b/i.test(String(card.fair || '')) && !/[+\-−]?\d+(?:\.\d+)?/.test(String(card.fair || ''));
    ensure(unavailablePass, `Published primary card ${card.title || card.feed?.selectionKey || 'unknown'} has no matching evaluated receipt`);
    validateRecommendationEvidence(report, card, sidecar.recommendations?.[index], index);
  }
  return { enforced: true, inventory: bound, sports, ...summarizePrimaryAnalysis(analysis.receipts) };
}

function loadBoundFeed(root, report, sidecar, feedFile = null) {
  const sha = String(sidecar?.provenance?.feedBlobSha || '');
  ensure(/^[0-9a-f]{40}$/i.test(sha), 'Sidecar provenance.feedBlobSha must be a Git SHA');
  let raw = null;
  if (feedFile) {
    raw = fs.readFileSync(path.isAbsolute(feedFile) ? feedFile : path.join(root, feedFile));
  } else {
    try { raw = execFileSync('git', ['cat-file', 'blob', sha], { cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { /* exact checked working-tree fallback below */ }
    if (!raw) {
      const livePath = path.join(root, FEED_PATH);
      ensure(fs.existsSync(livePath), `Cannot resolve exact bound odds snapshot ${sha}`);
      raw = fs.readFileSync(livePath);
    }
  }
  ensure(gitBlobSha(raw) === sha, `Resolved odds snapshot does not match provenance.feedBlobSha ${sha}`);
  let feed;
  try { feed = JSON.parse(raw.toString('utf8')); }
  catch { die(`Bound odds snapshot ${sha} is not valid JSON`); }
  ensure(String(feed?.generatedAt || '') === String(report?.feedGeneratedAt || ''), `Bound feed ${feed?.generatedAt || 'unknown'} does not match report ${report?.feedGeneratedAt || 'unknown'}`);
  return feed;
}
function loadBoundCoreFramework(root, sidecar, requireCurrentAuthority) {
  const relativePath = 'core/core-handicap-framework-v1.4.json';
  ensure(sidecar?.provenance?.coreFrameworkPath === relativePath, 'Primary analysis requires the controlled Core framework provenance path');
  const sha = String(sidecar?.provenance?.coreFrameworkBlobSha || '');
  ensure(/^[0-9a-f]{40}$/i.test(sha), 'Primary analysis requires a pinned Core framework blob SHA');
  const currentPath = path.join(root, relativePath);
  let raw;
  try { raw = execFileSync('git', ['cat-file', 'blob', sha], {cwd: root, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore']}); } catch { /* hash-checked fallback below */ }
  if (!raw) {
    ensure(fs.existsSync(currentPath), `Cannot resolve pinned Core framework ${sha}`);
    raw = fs.readFileSync(currentPath);
  }
  ensure(gitBlobSha(raw) === sha, `Resolved Core framework does not match pinned blob ${sha}`);
  if (requireCurrentAuthority) ensure(fs.existsSync(currentPath) && gitBlobSha(fs.readFileSync(currentPath)) === sha, 'Primary analysis Core framework differs from current operational framework');
  return JSON.parse(raw.toString('utf8'));
}

function authority(root = process.cwd(), pinnedSha = null) {
  const file = path.join(root, AUTHORITY_PATH);
  let raw;
  if (pinnedSha !== null) {
    ensure(/^[0-9a-f]{40}$/i.test(pinnedSha), 'Historical coverage requires a pinned authority blob SHA');
    try { raw = execFileSync('git', ['cat-file', 'blob', pinnedSha], {cwd: root, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore']}); } catch { /* hash-checked fallback below */ }
    if (!raw) {
      ensure(fs.existsSync(file), `Cannot resolve pinned coverage authority ${pinnedSha}`);
      raw = fs.readFileSync(file);
    }
    ensure(gitBlobSha(raw) === pinnedSha, `Resolved coverage authority does not match pinned blob ${pinnedSha}`);
  } else {
    raw = fs.readFileSync(file);
  }
  const policy = JSON.parse(raw.toString('utf8'));
  ensure(policy.schema === 1, 'Major-sport coverage authority schema must be 1');
  ensure(policy.authorityId === EXPECTED_AUTHORITY_ID, 'Major-sport coverage authority id mismatch');
  ensure(policy.state === 'OPERATIONAL', 'Major-sport coverage authority must be OPERATIONAL');
  ensure(isObject(policy.coverageAudit), 'Major-sport coverage authority is missing coverageAudit policy');
  return { policy, blobSha: gitBlobSha(raw) };
}

const SELECTIONS_BY_DETAIL = Object.freeze({
  full_game_moneyline: ['home', 'away'],
  full_game_primary_run_line: ['home', 'away'],
  full_game_primary_puck_line: ['home', 'away'],
  full_game_primary_spread: ['home', 'away'],
  full_game_primary_total: ['over', 'under']
});

function allowedDetailsForSport(sport) {
  if (sport === 'MLB') return new Set(['full_game_moneyline', 'full_game_primary_run_line', 'full_game_primary_total']);
  if (sport === 'NHL') return new Set(['full_game_moneyline', 'full_game_primary_puck_line', 'full_game_primary_total']);
  if (sport === 'NBA_WNBA') return new Set(['full_game_moneyline', 'full_game_primary_spread', 'full_game_primary_total']);
  if (['NFL', 'NCAAF', 'CFL'].includes(sport)) return new Set(['full_game_moneyline', 'full_game_primary_spread', 'full_game_primary_total']);
  return new Set();
}

export function activeReportScope(report, policy) {
  const scope = policy?.reportScope;
  if (!scope) return null; // Historical authority before the scope amendment.
  ensure(parseMs(scope.effectiveFrom) !== null, 'reportScope.effectiveFrom must be parseable');
  ensure(parseMs(report?.ts) !== null, 'Cannot resolve report scope without a valid report timestamp');
  if (parseMs(report.ts) < parseMs(scope.effectiveFrom)) return null;
  ensure(scope.id === 'PRIMARY_FULL_GAME_ONLY', 'Unsupported report scope');
  ensure(scope.playerProps === 'PAUSED_BY_SCOPE', 'Player props must remain paused under the current report scope');
  ensure(Array.isArray(scope.enabledPropMarkets) && scope.enabledPropMarkets.length === 0,
    'Prop markets require a separately validated scope amendment before activation');
  return scope;
}

export function isPlayerPropRecommendation(rec) {
  const context = rec?.coreAssessment?.context || {};
  return /player.?props?|pitcher|batter|goalie/i.test(String(context.marketClass || '')) ||
    isPlayerPropMarket({ marketKey: rec?.feed?.marketKey, name: rec?.feed?.market });
}

// Scope belongs to the checked-out report code, even when bundle files/cwd are temporary.
export function validateReportMarketScope(report, { root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), policy = null } = {}) {
  const selectedPolicy = policy || authority(root).policy;
  const scope = activeReportScope(report, selectedPolicy);
  if (!scope) return null;
  ensure(Array.isArray(report?.recs), 'Scoped report requires a recommendations array');
  for (const [index, rec] of report.recs.entries()) {
    const context = rec?.coreAssessment?.context || {};
    const sport = ['NBA', 'WNBA'].includes(context.sport) ? 'NBA_WNBA' : context.sport;
    const spec = selectedPolicy.coverageAudit.sportKeys.includes(sport)
      ? primarySpecs(selectedPolicy, sport).find(item => item.marketDetail === context.marketDetail)
      : null;
    ensure(spec && context.marketClass === spec.market && !isPlayerPropRecommendation(rec),
      `Recommendation ${index + 1} is outside PRIMARY_FULL_GAME_ONLY: ${rec?.title || 'untitled'}; props are PAUSED_BY_SCOPE`);
    ensure(marketKey(rec?.feed) === FEED_MARKET_KEYS[spec.market] &&
      spec.requiredSelections.includes(rec?.feed?.side),
      `Recommendation ${index + 1} feed identity is outside the allowed full-game market/side`);
    // Some legitimate primary rows carry provider labels (for example a spread label).
    // Unverified primary PASS cards may lack a selection key; execution identity remains
    // governed by the existing gates. Scope only cross-checks keys when supplied.
    if (nonEmpty(rec?.feed?.selectionKey)) {
      const exactKey = rec.feed.selectionKey.split('|');
      ensure(exactKey.length === 5 && exactKey[1] === FEED_MARKET_KEYS[spec.market] &&
        exactKey[2] === rec.feed.side,
        `Recommendation ${index + 1} selectionKey is outside the allowed full-game market/side`);
    }
  }
  return scope;
}

function sumSports(sports, sportKeys, propsPaused = false, receiptRequired = false) {
  const totals = {
    gamesInScope: 0,
    gamesEvaluated: 0,
    primaryRequired: 0,
    primaryEvaluated: 0,
    primaryUnavailable: 0,
    propsReturned: 0,
    propsScreened: 0,
    seriousPropsDeepReviewed: 0
  };
  if (propsPaused) totals.propsExcludedByScope = 0;
  if (receiptRequired) { totals.primaryAvailable = 0; totals.primaryBlocked = 0; }
  for (const key of sportKeys) {
    const row = sports[key];
    totals.gamesInScope += row.gamesInScope;
    totals.gamesEvaluated += row.gamesEvaluated;
    totals.primaryRequired += row.primary.required;
    totals.primaryEvaluated += row.primary.evaluated;
    if (receiptRequired) { totals.primaryAvailable += row.primary.available; totals.primaryBlocked += row.primary.blocked; }
    totals.primaryUnavailable += row.primary.unavailable;
    totals.propsReturned += row.props.returned;
    totals.propsScreened += row.props.screened;
    totals.seriousPropsDeepReviewed += row.props.seriousDeepReviewed;
    if (propsPaused) totals.propsExcludedByScope += row.props.excludedByScope;
  }
  return totals;
}

export function validateVisibleCoverageSummary(report, audit) {
  if (Date.parse(report?.ts || '') < Date.parse('2026-09-05T17:00:00-07:00')) return;
  const evaluated = audit?.totals?.primaryEvaluated;
  const unavailable = audit?.totals?.primaryUnavailable;
  int(evaluated, 'coverage summary evaluated count');
  int(unavailable, 'coverage summary unavailable count');
  if (primaryAnalysisRequired(report)) {
    int(audit?.totals?.primaryAvailable, 'coverage summary available count');
    int(audit?.totals?.primaryBlocked, 'coverage summary blocked count');
    const required = `Primary selections: ${audit.totals.primaryAvailable} available; ${evaluated} evaluated; ${audit.totals.primaryBlocked} evidence-blocked; ${unavailable} unavailable.`;
    ensure(String(report?.summary || '').includes(required), `Visible report summary must disclose its actual coverage limitation: ${required}`);
    return;
  }
  if (!unavailable) return;
  const required = `Primary selections: ${evaluated} evaluated; ${unavailable} unavailable.`;
  ensure(String(report?.summary || '').includes(required),
    `Visible report summary must disclose its actual coverage limitation: ${required}`);
}

export function validatePresentationAudit(report, presentation) {
  ensure(isObject(presentation), 'coverageAudit.presentation must be an object');
  if (unboundedPresentationRequired(report)) {
    ensure(presentation.mode === 'UNBOUNDED_ANALYSIS_OUTPUT', 'coverageAudit.presentation.mode must be UNBOUNDED_ANALYSIS_OUTPUT');
    ensure(presentation.allEvaluatedPublished === true, 'coverageAudit.presentation.allEvaluatedPublished must be true');
    int(presentation.fillerAdded, 'coverageAudit.presentation.fillerAdded');
    ensure(presentation.fillerAdded === 0, 'coverageAudit.presentation.fillerAdded must be zero');
    for (const field of ['target', 'targetIsSoft', 'overflowProtection', 'actionableSuppressedByTarget']) {
      ensure(presentation[field] == null, `coverageAudit.presentation.${field} is retired at/after ${UNBOUNDED_PRESENTATION_FROM}`);
    }
    return 'UNBOUNDED_ANALYSIS_OUTPUT';
  }
  int(presentation.target, 'coverageAudit.presentation.target');
  ensure(presentation.targetIsSoft === true, 'coverageAudit.presentation.targetIsSoft must be true');
  ensure(presentation.overflowProtection === true, 'coverageAudit.presentation.overflowProtection must be true');
  int(presentation.actionableSuppressedByTarget, 'coverageAudit.presentation.actionableSuppressedByTarget');
  ensure(presentation.actionableSuppressedByTarget === 0, 'coverageAudit may not suppress actionable recommendations to meet the historical card target');
  return 'LEGACY_SOFT_TARGET';
}

export function validateCoverageAudit(report, sidecar, { root = process.cwd(), requireCurrentAuthority = true, feed = null, feedFile = null } = {}) {
  ensure(isObject(report), 'Coverage gate report must be an object');
  ensure(isObject(sidecar), 'Coverage gate sidecar must be an object');
  const { policy, blobSha } = authority(root, requireCurrentAuthority ? null : String(sidecar?.coverageAudit?.authorityBlobSha || ''));
  const auditPolicy = policy.coverageAudit;
  const cutover = Date.parse(auditPolicy.requiredFrom);
  const reportMs = Date.parse(report.ts || '');
  ensure(Number.isFinite(reportMs), 'Coverage gate report.ts must be parseable');
  if (reportMs < cutover) return { enforced: false, reason: 'pre-cutover' };
  const scope = validateReportMarketScope(report, { policy });
  const propsPaused = Boolean(scope);
  const receiptRequired = primaryAnalysisRequired(report);

  const audit = sidecar[auditPolicy.sidecarField];
  ensure(isObject(audit), `Sidecar ${auditPolicy.sidecarField} is required for reports at/after ${auditPolicy.requiredFrom}`);
  ensure(audit.schema === auditPolicy.schema, 'coverageAudit schema mismatch');
  ensure(audit.authorityId === policy.authorityId, 'coverageAudit authorityId mismatch');
  ensure(audit.authorityPath === AUTHORITY_PATH, 'coverageAudit authorityPath mismatch');
  ensure(/^[0-9a-f]{40}$/i.test(String(audit.authorityBlobSha || '')), 'coverageAudit authorityBlobSha must be a Git SHA');
  if (requireCurrentAuthority) ensure(audit.authorityBlobSha === blobSha, 'coverageAudit authorityBlobSha does not match current operational authority');
  ensure(audit.state === auditPolicy.state, `coverageAudit state must be ${auditPolicy.state}`);
  ensure(audit.feedGeneratedAt === report.feedGeneratedAt, 'coverageAudit feedGeneratedAt must match report.feedGeneratedAt');
  ensure(/^[0-9a-f]{40}$/i.test(String(sidecar?.provenance?.feedBlobSha || '')), 'Sidecar provenance.feedBlobSha must be a Git SHA');
  ensure(audit.evaluationOrder === policy.principles.evaluationOrder, 'coverageAudit evaluationOrder mismatch');
  ensure(audit.complete === true, 'coverageAudit complete must be true');
  if (propsPaused) {
    ensure(audit.scope?.id === scope.id && audit.scope?.effectiveFrom === scope.effectiveFrom &&
      audit.scope?.playerProps === scope.playerProps, 'coverageAudit.scope must match the active report scope');
    ensure(Array.isArray(sidecar.recommendations), 'Scoped sidecar requires recommendations');
    ensure(sidecar.recommendations.length === report.recs.length, 'Scoped report/sidecar recommendation counts must match');
    for (const [index, item] of sidecar.recommendations.entries()) {
      const actual = item?.coreAssessment?.context || {};
      const expected = report.recs[index]?.coreAssessment?.context || {};
      for (const field of ['sport', 'marketClass', 'marketDetail']) {
        ensure(actual[field] === expected[field], `Sidecar recommendation ${index + 1} scope context ${field} differs from report`);
      }
    }
  }

  ensure(isObject(audit.sports), 'coverageAudit.sports must be an object');
  const sportKeys = auditPolicy.sportKeys;
  ensure(Object.keys(audit.sports).length === sportKeys.length, 'coverageAudit.sports must contain exactly the controlled sport keys');
  for (const sport of sportKeys) {
    const row = audit.sports[sport];
    ensure(isObject(row), `coverageAudit.sports.${sport} is required`);
    int(row.gamesInScope, `coverageAudit.sports.${sport}.gamesInScope`);
    int(row.gamesEvaluated, `coverageAudit.sports.${sport}.gamesEvaluated`);
    ensure(row.gamesEvaluated === row.gamesInScope, `coverageAudit.sports.${sport}.gamesEvaluated must equal gamesInScope`);
    ensure(isObject(row.primary), `coverageAudit.sports.${sport}.primary is required`);
    for (const key of ['required', 'evaluated', 'unavailable']) int(row.primary[key], `coverageAudit.sports.${sport}.primary.${key}`);
    ensure(row.primary.required === row.gamesInScope * auditPolicy.primarySelectionsPerGame, `coverageAudit.sports.${sport}.primary.required must equal gamesInScope * ${auditPolicy.primarySelectionsPerGame}`);
    if (receiptRequired) {
      int(row.primary.available, `coverageAudit.sports.${sport}.primary.available`);
      int(row.primary.blocked, `coverageAudit.sports.${sport}.primary.blocked`);
      ensure(row.primary.evaluated + row.primary.blocked === row.primary.available, `coverageAudit.sports.${sport} evaluated + blocked must equal available`);
      ensure(row.primary.available + row.primary.unavailable === row.primary.required, `coverageAudit.sports.${sport} available + unavailable must equal required`);
    } else {
      ensure(row.primary.evaluated + row.primary.unavailable === row.primary.required, `coverageAudit.sports.${sport} primary arithmetic does not reconcile`);
    }
    ensure(isObject(row.props), `coverageAudit.sports.${sport}.props is required`);
    for (const key of ['returned', 'screened', 'seriousDeepReviewed']) int(row.props[key], `coverageAudit.sports.${sport}.props.${key}`);
    if (propsPaused) {
      ensure(row.props.state === 'PAUSED_BY_SCOPE', `coverageAudit.sports.${sport}.props.state must be PAUSED_BY_SCOPE`);
      int(row.props.excludedByScope, `coverageAudit.sports.${sport}.props.excludedByScope`);
      ensure(row.props.excludedByScope === row.props.returned, `coverageAudit.sports.${sport}.props.excludedByScope must equal props.returned`);
      ensure(row.props.screened === 0 && row.props.seriousDeepReviewed === 0,
        `coverageAudit.sports.${sport} props are paused: screening and deeper analysis must be zero`);
    } else {
      ensure(row.props.screened === row.props.returned, `coverageAudit.sports.${sport}.props.screened must equal props.returned`);
    }
    ensure(row.props.seriousDeepReviewed <= row.props.screened, `coverageAudit.sports.${sport}.props.seriousDeepReviewed cannot exceed props.screened`);
  }

  ensure(Array.isArray(audit.availabilityLimitations), 'coverageAudit.availabilityLimitations must be an array');
  const allowedReasons = new Set(auditPolicy.availabilityReasonCodes);
  const unavailableTuples = new Map();
  let limitationsSelectionCount = 0;
  for (const [index, item] of audit.availabilityLimitations.entries()) {
    ensure(isObject(item), `coverageAudit.availabilityLimitations[${index}] must be an object`);
    ensure(nonEmpty(item.eventId), `coverageAudit.availabilityLimitations[${index}].eventId is required`);
    ensure(sportKeys.includes(item.sport), `coverageAudit.availabilityLimitations[${index}].sport is invalid`);
    ensure(allowedDetailsForSport(item.sport).has(item.marketDetail), `coverageAudit.availabilityLimitations[${index}].marketDetail is invalid for ${item.sport}`);
    ensure(allowedReasons.has(item.reason), `coverageAudit.availabilityLimitations[${index}].reason is invalid`);
    ensure(Array.isArray(item.selections) && item.selections.length > 0, `coverageAudit.availabilityLimitations[${index}].selections must be non-empty`);
    const permittedSelections = new Set(SELECTIONS_BY_DETAIL[item.marketDetail] || []);
    for (const selection of item.selections) {
      ensure(permittedSelections.has(selection), `coverageAudit.availabilityLimitations[${index}] selection ${selection} is invalid for ${item.marketDetail}`);
      const tuple = `${item.sport}|${item.eventId}|${item.marketDetail}|${selection}`;
      ensure(!unavailableTuples.has(tuple), `coverageAudit availability limitation duplicates ${tuple}`);
      unavailableTuples.set(tuple, item.reason);
      limitationsSelectionCount++;
    }
  }

  validatePresentationAudit(report, audit.presentation);

  ensure(isObject(audit.totals), 'coverageAudit.totals must be an object');
  const calculatedTotals = sumSports(audit.sports, sportKeys, propsPaused, receiptRequired);
  for (const [key, expected] of Object.entries(calculatedTotals)) {
    int(audit.totals[key], `coverageAudit.totals.${key}`);
    ensure(audit.totals[key] === expected, `coverageAudit.totals.${key} does not reconcile with sport rows`);
  }
  validateVisibleCoverageSummary(report, audit);
  ensure(limitationsSelectionCount === calculatedTotals.primaryUnavailable, 'coverageAudit availabilityLimitations selection count must equal total primaryUnavailable');

  const boundFeed = feed || loadBoundFeed(root, report, sidecar, feedFile);
  const bound = receiptRequired ? derivePrimarySelectionInventory(report, boundFeed, policy) : deriveBoundCoverage(report, boundFeed, policy);
  const framework = receiptRequired && sidecar?.primaryAnalysis?.receipts?.some(receipt => receipt.state === 'EVALUATED') ? loadBoundCoreFramework(root, sidecar, requireCurrentAuthority) : null;
  const primaryAnalysis = receiptRequired ? validatePrimaryAnalysis(report, sidecar, { inventory: bound, framework }) : null;
  const mismatches = [];
  for (const sport of sportKeys) {
    const actual = audit.sports[sport];
    const expected = bound.sports[sport];
    if (actual.gamesInScope !== expected.gamesInScope) {
      mismatches.push(`${sport}.gamesInScope ${actual.gamesInScope} != ${expected.gamesInScope} [${expected.eventIds.join(',') || 'none'}]`);
    }
    if (actual.gamesEvaluated !== expected.gamesInScope) mismatches.push(`${sport}.gamesEvaluated ${actual.gamesEvaluated} != ${expected.gamesInScope}`);
    const expectedPrimary = receiptRequired ? { ...expected.primary, evaluated: primaryAnalysis.sports[sport].evaluated, blocked: primaryAnalysis.sports[sport].blocked } : expected.primary;
    for (const [field, value] of Object.entries(expectedPrimary)) {
      if (actual.primary[field] !== value) mismatches.push(`${sport}.primary.${field} ${actual.primary[field]} != ${value}`);
    }
    if (actual.props.returned !== expected.propsReturned) mismatches.push(`${sport}.props.returned ${actual.props.returned} != ${expected.propsReturned}`);
    const expectedScreened = propsPaused ? 0 : expected.propsReturned;
    if (actual.props.screened !== expectedScreened) mismatches.push(`${sport}.props.screened ${actual.props.screened} != ${expectedScreened}`);
  }

  for (const [tuple, reason] of bound.limitations) {
    if (!unavailableTuples.has(tuple)) mismatches.push(`missing limitation ${tuple} (${reason})`);
    else if (unavailableTuples.get(tuple) !== reason) mismatches.push(`limitation ${tuple} reason ${unavailableTuples.get(tuple)} != ${reason}`);
  }
  for (const [tuple, reason] of unavailableTuples) {
    if (!bound.limitations.has(tuple)) mismatches.push(`extra limitation ${tuple} (${reason})`);
  }
  ensure(mismatches.length === 0, `coverageAudit does not match exact bound feed: ${mismatches.slice(0, 24).join('; ')}${mismatches.length > 24 ? `; +${mismatches.length - 24} more` : ''}`);

  return { enforced: true, audit, calculatedTotals, boundCoverage: bound, primaryAnalysis, authorityBlobSha: blobSha };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith('--')) die(`Unexpected argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) { args[key] = next; i++; }
    else args[key] = true;
  }
  return args;
}

function makeSport(gamesInScope, evaluated, unavailable, propsReturned, serious = 0) {
  return {
    gamesInScope,
    gamesEvaluated: gamesInScope,
    primary: { required: gamesInScope * 6, evaluated, unavailable },
    props: { returned: propsReturned, screened: propsReturned, seriousDeepReviewed: serious }
  };
}

function selfTest() {
  const { policy, blobSha } = authority();
  const report = { ts: policy.coverageAudit.requiredFrom, feedGeneratedAt: '2026-09-02T14:55:00.000Z' };
  const feed = {
    generatedAt: report.feedGeneratedAt,
    events: [{
      id: '63301763',
      eventId: '63301763',
      date: '2026-09-02T20:00:00.000Z',
      sport: { slug: 'baseball' },
      league: { slug: 'usa-mlb', name: 'USA - MLB' },
      bookmakers: {
        Bet365: [
          {
            marketKey: 'ml', updatedAt: '2026-09-02T14:50:00.000Z',
            odds: [{ home: '1.80', away: '2.10', selectionKeys: { home: '63301763|ml|home||', away: '63301763|ml|away||' } }]
          },
          {
            marketKey: 'totals', updatedAt: '2026-09-02T14:50:00.000Z',
            odds: [{ hdp: 8.5, over: '1.91', under: '1.91', selectionKeys: { over: '63301763|totals|over||8.5', under: '63301763|totals|under||8.5' } }]
          },
          {
            marketKey: 'player-props', name: 'Player Props', updatedAt: '2026-09-02T14:50:00.000Z',
            odds: [{ label: 'Synthetic Player (Hits)', hdp: 0.5, over: '1.80', under: '2.05', selectionKeys: { over: '63301763|player-props|over|synthetic-player-hits|0.5', under: '63301763|player-props|under|synthetic-player-hits|0.5' } }]
          }
        ]
      }
    }]
  };
  const sports = {
    MLB: makeSport(1, 4, 2, 2, 1),
    NHL: makeSport(0, 0, 0, 0),
    NBA_WNBA: makeSport(0, 0, 0, 0),
    NFL: makeSport(0, 0, 0, 0),
    NCAAF: makeSport(0, 0, 0, 0),
    CFL: makeSport(0, 0, 0, 0)
  };
  const totals = sumSports(sports, policy.coverageAudit.sportKeys);
  const sidecar = {
    schema: 3,
    provenance: { feedBlobSha: '0'.repeat(40) },
    coverageAudit: {
      schema: 1,
      authorityId: policy.authorityId,
      authorityPath: AUTHORITY_PATH,
      authorityBlobSha: blobSha,
      state: 'COMPLETE',
      feedGeneratedAt: report.feedGeneratedAt,
      evaluationOrder: 'EVALUATE_BEFORE_CARD_SELECTION',
      sports,
      availabilityLimitations: [{
        eventId: '63301763',
        sport: 'MLB',
        marketDetail: 'full_game_primary_run_line',
        selections: ['home', 'away'],
        reason: 'MARKET_NOT_RETURNED'
      }],
      presentation: {
        target: 12,
        targetIsSoft: true,
        overflowProtection: true,
        actionableSuppressedByTarget: 0
      },
      totals,
      complete: true
    }
  };
  const result = validateCoverageAudit(report, sidecar, { feed });
  assert.equal(result.enforced, true);
  assert.equal(result.calculatedTotals.primaryUnavailable, 2);

  const badArithmetic = structuredClone(sidecar);
  badArithmetic.coverageAudit.sports.MLB.primary.evaluated = 5;
  assert.throws(() => validateCoverageAudit(report, badArithmetic, { feed }), /primary arithmetic/i);

  const missingLimitation = structuredClone(sidecar);
  missingLimitation.coverageAudit.availabilityLimitations = [];
  assert.throws(() => validateCoverageAudit(report, missingLimitation, { feed }), /availabilityLimitations selection count/i);

  const suppressed = structuredClone(sidecar);
  suppressed.coverageAudit.presentation.actionableSuppressedByTarget = 1;
  assert.throws(() => validateCoverageAudit(report, suppressed, { feed }), /may not suppress actionable/i);

  const unboundedReport = { ts: UNBOUNDED_PRESENTATION_FROM };
  assert.equal(validatePresentationAudit(unboundedReport, { mode: 'UNBOUNDED_ANALYSIS_OUTPUT', allEvaluatedPublished: true, fillerAdded: 0 }), 'UNBOUNDED_ANALYSIS_OUTPUT');
  assert.throws(() => validatePresentationAudit(unboundedReport, { mode: 'UNBOUNDED_ANALYSIS_OUTPUT', allEvaluatedPublished: true, fillerAdded: 0, target: 12 }), /retired/i);
  assert.throws(() => validatePresentationAudit(unboundedReport, { mode: 'UNBOUNDED_ANALYSIS_OUTPUT', allEvaluatedPublished: false, fillerAdded: 0 }), /allEvaluatedPublished/i);

  const omittedNcaaf = structuredClone(feed);
  omittedNcaaf.events.push({
    id: 'ncaaf-1', eventId: 'ncaaf-1', date: '2026-09-02T23:00:00.000Z',
    sport: { slug: 'american-football' }, league: { slug: 'usa-college', name: 'USA - College' },
    bookmakers: { Bet365: [{
      marketKey: 'ml', updatedAt: '2026-09-02T14:50:00.000Z',
      odds: [{ home: '1.50', away: '2.60', selectionKeys: { home: 'ncaaf-1|ml|home||', away: 'ncaaf-1|ml|away||' } }]
    }] }
  });
  assert.throws(() => validateCoverageAudit(report, sidecar, { feed: omittedNcaaf }), /NCAAF\.gamesInScope 0 != 1/);

  const freshSpread = structuredClone(feed);
  freshSpread.events[0].bookmakers.Bet365.push({
    marketKey: 'spread', updatedAt: '2026-09-02T14:35:00.000Z',
    odds: [{ hdp: -1.5, home: '1.91', away: '1.91', selectionKeys: { home: '63301763|spread|home||-1.5', away: '63301763|spread|away||-1.5' } }]
  });
  assert.throws(() => validateCoverageAudit(report, sidecar, { feed: freshSpread }), /MLB\.primary\.evaluated 4 != 6/);

  const preCutover = { ts: '2026-09-02T07:59:59-07:00', feedGeneratedAt: report.feedGeneratedAt };
  assert.equal(validateCoverageAudit(preCutover, { schema: 3 }).enforced, false);

  console.log('MAJOR SPORT COVERAGE GATE SELF-TEST OK');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'self-test') { selfTest(); return; }
  if (args.command !== 'validate' || !args.report || !args.sidecar) {
    die('Usage: major-sport-market-coverage-gate.mjs validate --report FILE --sidecar FILE [--feed FILE] [--root DIR] | self-test');
  }
  const root = path.resolve(args.root || process.cwd());
  const report = readJson(path.resolve(args.report));
  const sidecar = readJson(path.resolve(args.sidecar));
  const result = validateCoverageAudit(report, sidecar, { root, feedFile: args.feed || null });
  if (!result.enforced) {
    console.log(`MAJOR SPORT COVERAGE GATE PRE-CUTOVER ${report.ts}`);
    return;
  }
  console.log(`MAJOR SPORT COVERAGE GATE OK games=${result.calculatedTotals.gamesInScope} primary=${result.calculatedTotals.primaryRequired} props=${result.calculatedTotals.propsScreened}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(`MAJOR SPORT COVERAGE GATE ERROR: ${error.message}`); process.exit(1); }
}
