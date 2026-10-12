#!/usr/bin/env node
// Retrospective settlement only. No live odds, report production, or ledger writes.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, x) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(x, null, 2) + '\n'); };
const teamAliases = new Map([
  ['britishcolumbialions', 'bclions'], ['samhoustonstatebearkats', 'samhoustonbearkats'],
  ['connecticuthuskies', 'uconnhuskies'], ['miamiohioredhawks', 'miamiohredhawks'],
  ['marshallherd', 'marshallthunderingherd'], ['umassminutemen','massachusettsminutemen'],
  ['appalachianstatemountaineers','appstatemountaineers'], ['stthomasmntommies','stthomastommies'],
  ['southeasternlouisianalions','selouisianalions'], ['gramblingstatetigers','gramblingtigers']
]);
const norm = s => { const key = String(s || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, ''); return teamAliases.get(key) || key; };
const realTeam = value => Boolean(norm(value)) && !['away', 'home', 'unknown', 'tbd'].includes(norm(value));
const digest = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const knownStatuses = new Set(['BET', 'LEAN', 'WAIT', 'PASS']);
const routes = { NFL: 'football/nfl', NCAAF: 'football/college-football', CFB: 'football/college-football', CFL: 'football/cfl', NBA: 'basketball/nba', WNBA: 'basketball/wnba', NHL: 'hockey/nhl' };
function vancouverDate(value = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function score(value) { return value !== null && value !== undefined && value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0; }
function uniqueMatch(candidates, start) {
  if (candidates.length === 1) return candidates[0];
  const time = Date.parse(start || '');
  if (!Number.isFinite(time)) return null;
  const exact = candidates.filter(c => Math.abs(Date.parse(c.start || '') - time) <= 15 * 60000);
  return exact.length === 1 ? exact[0] : null;
}
function primaryScoreMarket(rec) {
  const feed = rec.feed || {};
  const market = String(feed.marketKey || feed.market || '').toLowerCase();
  if (!['ml', 'moneyline', 'spread', 'total', 'totals'].includes(market)) return false;
  const scope = [feed.marketName, feed.period, feed.marketScope, rec.marketName, rec.title, rec.meta].join(' ');
  if (/regulation.only|first\s*(?:half|quarter|period|five|5)|1st\s*(?:half|quarter|period)|player.?prop|shortened|suspended/i.test(scope)) return false;
  if (!['ml', 'moneyline'].includes(market)) {
    const raw = feed.hdp ?? feed.line ?? String(feed.selectionKey || '').split('|').at(-1);
    if (raw === null || raw === undefined || raw === '' || !Number.isFinite(Number(raw))) return false;
  }
  return true;
}
export function eventInfo(group) {
  const away = new Map(), home = new Map(), dates = new Set(), fallbackDates = new Set(), sports = new Set(), starts = new Set();
  const add = (map, value) => { if (realTeam(value)) map.set(norm(value), String(value).trim()); };
  for (const { rec, date } of group.identityRows || group.rows) {
    const f = rec.feed || {};
    const m = String(rec.meta || '').split('|').map(x => x.trim()).map(x => x.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i)).find(Boolean);
    if (m) { add(away, m[1]); add(home, m[2]); }
    else if (['ml', 'moneyline'].includes(String(f.marketKey || f.market || '').toLowerCase())) {
      const title = String(rec.title || '').replace(/\s+moneyline$/i, '');
      if (f.side === 'away') add(away, title);
      if (f.side === 'home') add(home, title);
    }
    add(away, f.away); add(home, f.home);
    let league = String(rec.coreAssessment?.context?.sport || f.league || f.sport || String(rec.meta || '').split('|')[0] || '').trim().toUpperCase();
    league = ({CFB:'NCAAF', NBA_WNBA:'WNBA', NBA_NBA:'NBA', NFL_PRESEASON:'NFL', NHL_PRESEASON:'NHL'})[league] || league;
    if (league) sports.add(league);
    const start = f.eventDate || f.commenceTime || null;
    if (start && !datePattern.test(start) && Number.isFinite(Date.parse(start))) { starts.add(start); dates.add(vancouverDate(start)); }
    else if (datePattern.test(String(start || ''))) dates.add(start);
    else fallbackDates.add(date);
  }
  const binding = group.historicalIdentity;
  if (binding) {
    add(away, binding.away); add(home, binding.home);
    if (binding.start && Number.isFinite(Date.parse(binding.start))) { starts.add(binding.start); dates.add(vancouverDate(binding.start)); }
  }
  if (!dates.size) for (const date of fallbackDates) dates.add(date);
  if (away.size !== 1 || home.size !== 1 || dates.size !== 1 || sports.size !== 1) return null;
  return { away: [...away.values()][0], home: [...home.values()][0], date: [...dates][0], sport: [...sports][0], start: starts.size === 1 ? [...starts][0] : null };
}
const snapshotIdentityCache = new Map();
function historicalIdentity(group) {
  // Resolve missing display names only from the exact immutable issued snapshot.
  const entries = fs.existsSync('data/history/odds-index.json') ? read('data/history/odds-index.json').entries || [] : [];
  for (const row of group.identityRows || group.rows) {
    const entry = entries.find(e => e.generatedAt === row.feedGeneratedAt);
    if (!entry?.snapshotBlobSha) continue;
    try {
      if (!snapshotIdentityCache.has(entry.snapshotBlobSha)) {
        const snap = JSON.parse(execFileSync('git', ['show', entry.snapshotBlobSha], {encoding:'utf8', maxBuffer:128*1024*1024, timeout:30000}));
        const identities = new Map();
        for (const e of [...(snap.events || []), ...(snap.deepMarkets || [])]) {
          const id = String(e.eventId || e.identity?.eventId || e.id || '');
          if (realTeam(e.away) && realTeam(e.home)) identities.set(id, {away:e.away, home:e.home, start:e.date || e.identity?.startTime, snapshotBlobSha:entry.snapshotBlobSha});
        }
        snapshotIdentityCache.set(entry.snapshotBlobSha, identities);
      }
      const binding = snapshotIdentityCache.get(entry.snapshotBlobSha).get(group.id);
      if (!binding) continue;
      const issuedStart = row.rec.feed?.eventDate || row.rec.feed?.commenceTime;
      if (!issuedStart || Date.parse(issuedStart) !== Date.parse(binding.start)) continue;
      return binding;
    } catch { /* Missing archival evidence remains unresolved, never use live odds. */ }
  }
  return null;
}
export function buckets(groups) {
  // Every pending past event gets a turn. Provider requests are cached by league/date,
  // so the number of issued events no longer imposes a settlement quota.
  const sorted = [...groups.values()].sort((a, b) => Number(b.capDeferred) - Number(a.capDeferred) || a.firstDate.localeCompare(b.firstDate) || a.id.localeCompare(b.id));
  return { previous: sorted.filter(g => g.current), backlog: sorted.filter(g => !g.current), deferred: [] };
}
const cache = new Map();
async function fetchJson(url) {
  if (!cache.has(url)) cache.set(url, (async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'user-agent': 'Betting-Edge-Historical-Grader/2.0' } });
    if (!response.ok) throw new Error(`Historical provider HTTP ${response.status}`);
    return response.json();
  })());
  return cache.get(url);
}
export async function verify(group, getJson = fetchJson) {
  const unresolved = reason => ({ eventId: group.id, status: 'unresolved', unresolvedReason: reason });
  let info = eventInfo(group);
  if (!info && !group.historicalIdentity) { group.historicalIdentity = historicalIdentity(group); info = eventInfo(group); }
  if (!info) return {...unresolved('identity_conflict'), identity: {titles:[...new Set(group.rows.map(x => x.rec.title))], firstDate:group.firstDate}};
  try {
    let candidates = [], url;
    if (info.sport === 'MLB') {
      url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${info.date}&hydrate=linescore,team`;
      const data = await getJson(url);
      candidates = (data.dates || []).flatMap(d => d.games || []).filter(g => norm(g.teams?.away?.team?.name) === norm(info.away) && norm(g.teams?.home?.team?.name) === norm(info.home)).map(g => ({
        start: g.gameDate, final: g.status?.abstractGameState === 'Final', providerId: g.gamePk,
        cancelledUnplayed: /^cancelled$/i.test(g.status?.detailedState || '') && !g.linescore?.innings?.length,
        special: /shortened|suspend|forfeit|completed early/i.test(g.status?.detailedState || '') || Number(g.linescore?.currentInning || 0) < 9,
        away: g.teams.away.team.name, home: g.teams.home.team.name, awayScore: g.teams.away.score, homeScore: g.teams.home.score
      }));
    } else if (info.sport === 'CFL') {
      url = 'https://cflscoreboard.cfl.ca/json/scoreboard/rounds.json';
      const data = await getJson(url);
      // Only exact historical identities and final scores are consumed; ignore embedded markets.
      candidates = (Array.isArray(data) ? data : []).flatMap(round => round.tournaments || [])
        .filter(g => vancouverDate(g.date) === info.date && norm(g.awaySquad?.name) === norm(info.away) && norm(g.homeSquad?.name) === norm(info.home))
        .map(g => ({start:g.date, final:g.status === 'complete', providerId:g.cflId || g.id, special:false,
          away:g.awaySquad.name, home:g.homeSquad.name, awayScore:g.awaySquad.score, homeScore:g.homeSquad.score}));
    } else if (routes[info.sport]) {
      const base = `https://site.api.espn.com/apis/site/v2/sports/${routes[info.sport]}/scoreboard?dates=${info.date.replaceAll('-', '')}&limit=300`;
      const urls = info.sport === 'NCAAF' ? [base + '&groups=80', base + '&groups=81'] : [base];
      const utcDate = info.start?.slice(0,10);
      if (utcDate && utcDate !== info.date) {
        const alternate = base.replace(info.date.replaceAll('-',''),utcDate.replaceAll('-',''));
        urls.push(...(info.sport === 'NCAAF' ? [alternate + '&groups=80', alternate + '&groups=81'] : [alternate]));
      }
      const aliases = c => [c?.team?.displayName, c?.team?.shortDisplayName, c?.team?.location, c?.team?.name, c?.team?.abbreviation,
        c?.team?.abbreviation && c?.team?.name ? `${c.team.abbreviation} ${c.team.name}` : null].filter(Boolean).map(norm);
      const seen = new Set(), providerErrors = [];
      for (const sourceUrl of urls) {
        let data;
        try { data = await getJson(sourceUrl); } catch (error) { providerErrors.push(String(error.message)); continue; }
        for (const e of data.events || []) for (const c of e.competitions || []) {
          const away = c.competitors?.find(x => x.homeAway === 'away'), home = c.competitors?.find(x => x.homeAway === 'home');
          if (!away || !home || !aliases(away).includes(norm(info.away)) || !aliases(home).includes(norm(info.home))) continue;
          const id = `${e.id}|${c.id}`; if (seen.has(id)) continue; seen.add(id);
          candidates.push({ start: c.date || e.date, final: (c.status || e.status)?.type?.completed === true, providerId: e.id, url:sourceUrl,
            special: /shortened|suspend|forfeit|cancel/i.test((c.status || e.status)?.type?.description || ''),
            away: away.team.displayName, home: home.team.displayName, awayScore: away.score, homeScore: home.score });
        }
      }
      url = candidates[0]?.url || urls[0];
    } else return {...unresolved('result_provider_unsupported'), identity:info};
    const match = uniqueMatch(candidates, info.start);
    if (!match) return {...unresolved(candidates.length > 1 ? 'identity_conflict' : 'result_not_verified'), identity:info, sourceUrl:url};
    const source = {name:`${info.sport === 'MLB' ? 'MLB official' : info.sport === 'CFL' ? 'CFL official' : 'ESPN ' + info.sport} historical ${match.cancelledUnplayed ? 'unplayed cancellation' : 'final'} ${info.date}; event ${match.providerId}`, url:match.url || url};
    if (match.cancelledUnplayed) return {eventId:group.id, status:'settled', away:match.away, home:match.home,
      selectionOutcomes:[...new Map(group.rows.filter(x => primaryScoreMarket(x.rec)).map(x => [x.rec.feed.selectionKey, {selectionKey:x.rec.feed.selectionKey, grade:'VOID', basis:'Officially cancelled before play; full-game stake returned.'}])).values()], source};
    if (!match.final) return {...unresolved('event_not_final'), identity:info, sourceUrl:url};
    if (match.special || !score(match.awayScore) || !score(match.homeScore) || (Number(match.awayScore) === Number(match.homeScore) && !['NFL','CFL'].includes(info.sport))) return {...unresolved('settlement_ambiguity'), identity:info, sourceUrl:url};
    return { eventId: group.id, status: 'final', away: match.away, home: match.home, awayScore: Number(match.awayScore), homeScore: Number(match.homeScore), source,
      ...(Number(match.awayScore) === Number(match.homeScore) ? {twoWayMoneylineTie:true, selectionOutcomes:group.rows.filter(x => primaryScoreMarket(x.rec) && ['ml','moneyline'].includes(x.rec.feed.marketKey) && ['home','away'].includes(x.rec.feed.side)).map(x => {
        const book = String(x.rec.feed.book || x.rec.book || '').toLowerCase().replace(/[^a-z0-9]/g,'');
        const rule = book === 'draftkings' ? {grade:'PUSH',url:'https://sportsbook.draftkings.com/help/general-betting-rules/general-rules'} : book === 'bet365' ? {grade:'VOID',url:'https://help.bet365.com/s/en-ca/terms-and-conditions'} : null;
        return rule ? {selectionKey:x.rec.feed.selectionKey,book,grade:rule.grade,basis:'Two-way full-game moneyline tied after overtime; stake returned.',ruleSource:rule.url} : null;
      }).filter(Boolean)} : {}),
      ...(group.historicalIdentity ? {identitySnapshotBlobSha:group.historicalIdentity.snapshotBlobSha} : {}) };
  } catch (error) { return { ...unresolved('result_not_verified'), identity:info, providerError:String(error.message) }; }
}
async function main(requestPath) {
  const request = read(requestPath);
  assert.equal(request.schema, 1); assert.equal(request.state, 'READY');
  assert.match(request.requestId, /^[a-zA-Z0-9_-]{1,100}$/);
  const target = request.targetDate;
  assert.match(target, datePattern); assert.equal(new Date(target + 'T12:00:00Z').toISOString().slice(0, 10), target);
  assert.ok(target < vancouverDate(), 'Only past Vancouver dates may be graded');
  const runs = [], groups = new Map(), identityRows = new Map(), statusCounts = {}, legacyIntegrityWarnings = []; let issuedCards = 0, olderEnteringCards = 0;
  const root = 'data/history/runs';
  for (const date of fs.readdirSync(root).filter(x => datePattern.test(x) && x <= target).sort()) {
    for (const name of fs.readdirSync(`${root}/${date}`).filter(x => x.endsWith('.json')).sort()) {
      const p = `${root}/${date}/${name}`, run = read(p), op = p.replace('/runs/', '/observations/');
      const obs = fs.existsSync(op) ? read(op) : null;
      if (obs) { assert.equal(obs.sourceRun, p); assert.equal(obs.recommendations.length, (run.recs || []).length); }
      const pending = [];
      for (const [index, rec] of (run.recs || []).entries()) {
        const status = String(rec.status || '').toUpperCase(); if (!knownStatuses.has(status)) continue;
        if (date === target) { issuedCards++; statusCounts[status] = (statusCounts[status] || 0) + 1; }
        const old = obs?.recommendations?.[index];
        const eventId = String(rec.feed?.eventId || '');
        if (eventId) {
          if (!identityRows.has(eventId)) identityRows.set(eventId, []);
          identityRows.get(eventId).push({date, feedGeneratedAt:run.feedGeneratedAt, rec:{title:rec.title, meta:rec.meta, feed:rec.feed, coreAssessment:{context:{sport:rec.coreAssessment?.context?.sport}}}});
        }
        if (String(old?.completion?.state || '').toLowerCase() === 'complete') {
          if ((old.selectionKey || null) !== (rec.feed?.selectionKey || null)) legacyIntegrityWarnings.push({ sourceRun: p, index, issuedSelectionKey: rec.feed?.selectionKey || null, observedSelectionKey: old.selectionKey || null, reason: 'previously_complete_identity_conflict_preserved_for_separate_review' });
          continue;
        }
        if (old) assert.equal(old.selectionKey || null, rec.feed?.selectionKey || null, `Observation identity mismatch: ${p}#${index}`);
        if (date < target) olderEnteringCards++;
        const row = { rec, date, index }; pending.push(row);
        const id = String(rec.feed?.eventId || ''); if (!id) continue;
        if (!groups.has(id)) groups.set(id, { id, rows: [], current: false, firstDate: date, capDeferred: false });
        const g = groups.get(id); g.rows.push(row); g.current ||= date === target;
        g.capDeferred ||= old?.completion?.reason === 'verification_deferred_event_cap';
      }
      if (pending.length) runs.push({ p, op, obs, pending, hash: digest(p) });
    }
  }
  for (const g of groups.values()) g.identityRows = identityRows.get(g.id);
  const batch = buckets(groups), attempted = [...batch.previous, ...batch.backlog];
  const outcomes = new Map();
  for (const g of attempted) outcomes.set(g.id, await verify(g));
  const verifiedAt = new Date().toISOString(), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'be-grading-'));
  try {
    let n = 0;
    for (const item of runs) {
      const ids = new Set(item.pending.map(x => String(x.rec.feed?.eventId || '')));
      const payload = { verifiedAt, attemptedEventIds: attempted.filter(g => ids.has(g.id)).map(g => g.id), deferredEventIds: batch.deferred.filter(g => ids.has(g.id)).map(g => g.id), events: [...outcomes.values()].filter(e => ids.has(e.eventId)) };
      const vf = path.join(temp, `${n++}.json`); write(vf, payload);
      execFileSync('node', ['tools/verify-issued-results.mjs', item.p, vf], { stdio: 'inherit' });
      execFileSync('node', ['tools/observe-issued-prices.mjs', item.p], { stdio: 'inherit' });
      const result = read(item.op);
      for (const [index, old] of (item.obs?.recommendations || []).entries()) if (String(old.completion?.state).toLowerCase() === 'complete') result.recommendations[index] = old;
      for (const { rec, index } of item.pending) {
        if (!rec.feed?.eventId || !rec.feed?.selectionKey || !primaryScoreMarket(rec)) {
          const entry = result.recommendations[index], prior = item.obs?.recommendations?.[index]?.completion || {};
          entry.completion = { ...prior, state: 'unresolved', reason: !rec.feed?.eventId || !rec.feed?.selectionKey ? 'identity_conflict' : 'market_requires_exact_selection_verification', firstUnresolvedAt: prior.firstUnresolvedAt || verifiedAt };
        }
      }
      result.resultMethod = { ...(result.resultMethod || {}), isolation: 'historical result providers and immutable issued snapshots only; no live odds or report-production inputs' };
      write(item.op, result); assert.equal(digest(item.p), item.hash, 'Issued report mutation forbidden');
    }
    const summary = { schema: 1, requestId: request.requestId, targetDate: target, verifiedAt, issuedCards, statusCounts, olderEnteringCards, legacyIntegrityWarnings, previousEventsAttempted: batch.previous.length, backlogEventsAttempted: batch.backlog.length, previousEventsVerifiedFinal: batch.previous.filter(g => ['final','settled'].includes(outcomes.get(g.id)?.status)).length, backlogEventsVerifiedFinal: batch.backlog.filter(g => ['final','settled'].includes(outcomes.get(g.id)?.status)).length, quotaDeferredEvents: batch.deferred.length, pendingEventsAttempted:attempted.length, providerRequests:cache.size, pendingPolicy:'all past issued events; no fixed event quotas', observationPaths: runs.map(x => x.op), verifiedEvents: [...outcomes.values()].filter(e => ['final','settled'].includes(e.status)), unresolvedEvents: [...outcomes.values()].filter(e => !['final','settled'].includes(e.status)), isolation: 'historical-only' };
    write('/tmp/card-grading-runtime.json', summary); console.log(JSON.stringify(summary));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
function selfTest() {
  assert.equal(vancouverDate('2026-09-25T01:00:00Z'), '2026-09-24');
  assert.equal(vancouverDate('2026-09-25T10:30:00Z'), '2026-09-25');
  for (const invalid of [null, undefined, '', 'NaN', -1, 2.5]) assert.equal(score(invalid), false);
  assert.equal(score('0'), true); assert.equal(score(35), true);
  assert.equal(uniqueMatch([{ start: '2026-09-24T17:00:00Z' }, { start: '2026-09-24T23:00:00Z' }], null), null);
  assert.equal(uniqueMatch([{ start: '2026-09-24T17:00:00Z' }, { start: '2026-09-24T23:00:00Z' }], '2026-09-24T23:00:00Z').start, '2026-09-24T23:00:00Z');
  assert.equal(primaryScoreMarket({ feed: { marketKey: 'spread', hdp: -1.5 } }), true);
  assert.equal(primaryScoreMarket({ feed: { marketKey: 'spread', hdp: null } }), false);
  assert.equal(primaryScoreMarket({ feed: { marketKey: 'ml' }, meta: 'regulation only' }), false);
  const groups = new Map(Array.from({ length: 40 }, (_, i) => [String(i), { id: String(i), firstDate: '2026-09-24', current: i < 25 }]));
  const b = buckets(groups); assert.equal(b.previous.length, 25); assert.equal(b.backlog.length, 15); assert.equal(b.deferred.length, 0);
  console.log('Historical grading self-tests passed: date boundary, finite scores, ambiguous identity, market scope and uncapped historical coverage.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
if (process.argv[2] === '--self-test') selfTest();
else if (process.argv[2]) main(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
else { console.error('Usage: node tools/grade-issued-card-history.mjs <request.json> | --self-test'); process.exitCode = 1; }

}
