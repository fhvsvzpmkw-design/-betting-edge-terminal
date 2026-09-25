#!/usr/bin/env node
// Retrospective settlement only. No live odds, report production, or ledger writes.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, x) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(x, null, 2) + '\n'); };
const norm = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
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
function eventInfo(group) {
  const away = new Map(), home = new Map(), dates = new Set(), sports = new Set(), starts = new Set();
  const add = (map, value) => { if (norm(value)) map.set(norm(value), String(value).trim()); };
  for (const { rec, date } of group.rows) {
    const f = rec.feed || {};
    const m = String(rec.meta || '').split('|').map(x => x.trim()).map(x => x.match(/^(.+?)\s+at\s+(.+)$/i)).find(Boolean);
    if (m) { add(away, m[1]); add(home, m[2]); }
    else if (['ml', 'moneyline'].includes(String(f.marketKey || f.market || '').toLowerCase())) {
      if (f.side === 'away') add(away, rec.title);
      if (f.side === 'home') add(home, rec.title);
    }
    const league = String(rec.coreAssessment?.context?.sport || f.league || f.sport || String(rec.meta || '').split('|')[0] || '').trim().toUpperCase();
    if (league) sports.add(league);
    const start = f.eventDate || f.commenceTime || null;
    if (start && !datePattern.test(start) && Number.isFinite(Date.parse(start))) { starts.add(start); dates.add(vancouverDate(start)); }
    else dates.add(datePattern.test(String(start || '')) ? start : date);
  }
  if (away.size !== 1 || home.size !== 1 || dates.size !== 1 || sports.size !== 1) return null;
  return { away: [...away.values()][0], home: [...home.values()][0], date: [...dates][0], sport: [...sports][0], start: starts.size === 1 ? [...starts][0] : null };
}
function buckets(groups) {
  const sorted = [...groups.values()].sort((a, b) => a.firstDate.localeCompare(b.firstDate) || Number(b.capDeferred) - Number(a.capDeferred) || a.id.localeCompare(b.id));
  const a = sorted.filter(g => g.current), b = sorted.filter(g => !g.current);
  return { previous: a.slice(0, 20), backlog: b.slice(0, 10), deferred: [...a.slice(20), ...b.slice(10)] };
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
async function verify(group) {
  const unresolved = reason => ({ eventId: group.id, status: 'unresolved', unresolvedReason: reason });
  const info = eventInfo(group);
  if (!info) return unresolved('identity_conflict');
  try {
    let candidates = [], url;
    if (info.sport === 'MLB') {
      url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${info.date}&hydrate=linescore,team`;
      const data = await fetchJson(url);
      candidates = (data.dates || []).flatMap(d => d.games || []).filter(g => norm(g.teams?.away?.team?.name) === norm(info.away) && norm(g.teams?.home?.team?.name) === norm(info.home)).map(g => ({
        start: g.gameDate, final: g.status?.abstractGameState === 'Final', providerId: g.gamePk,
        special: /shortened|suspend|forfeit|completed early/i.test(g.status?.detailedState || '') || Number(g.linescore?.currentInning || 0) < 9,
        away: g.teams.away.team.name, home: g.teams.home.team.name, awayScore: g.teams.away.score, homeScore: g.teams.home.score
      }));
    } else if (routes[info.sport]) {
      url = `https://site.api.espn.com/apis/site/v2/sports/${routes[info.sport]}/scoreboard?dates=${info.date.replaceAll('-', '')}&limit=300`;
      const data = await fetchJson(url);
      const aliases = c => [c?.team?.displayName, c?.team?.shortDisplayName, c?.team?.location, c?.team?.name, c?.team?.abbreviation].filter(Boolean).map(norm);
      for (const e of data.events || []) for (const c of e.competitions || []) {
        const away = c.competitors?.find(x => x.homeAway === 'away'), home = c.competitors?.find(x => x.homeAway === 'home');
        if (!away || !home || !aliases(away).includes(norm(info.away)) || !aliases(home).includes(norm(info.home))) continue;
        candidates.push({ start: c.date || e.date, final: (c.status || e.status)?.type?.completed === true, providerId: e.id,
          special: /shortened|suspend|forfeit/i.test((c.status || e.status)?.type?.description || ''),
          away: away.team.displayName, home: home.team.displayName, awayScore: away.score, homeScore: home.score });
      }
    } else return unresolved('result_provider_unsupported');
    const match = uniqueMatch(candidates, info.start);
    if (!match) return unresolved(candidates.length > 1 ? 'identity_conflict' : 'result_not_verified');
    if (!match.final) return unresolved('event_not_final');
    if (match.special || !score(match.awayScore) || !score(match.homeScore) || Number(match.awayScore) === Number(match.homeScore)) return unresolved('settlement_ambiguity');
    return { eventId: group.id, status: 'final', away: match.away, home: match.home, awayScore: Number(match.awayScore), homeScore: Number(match.homeScore), source: { name: `${info.sport === 'MLB' ? 'MLB official' : 'ESPN ' + info.sport} historical final ${info.date}; event ${match.providerId}`, url } };
  } catch (error) { return { ...unresolved('result_not_verified'), providerError: String(error.message) }; }
}
async function main(requestPath) {
  const request = read(requestPath);
  assert.equal(request.schema, 1); assert.equal(request.state, 'READY');
  assert.match(request.requestId, /^[a-zA-Z0-9_-]{1,100}$/);
  const target = request.targetDate;
  assert.match(target, datePattern); assert.equal(new Date(target + 'T12:00:00Z').toISOString().slice(0, 10), target);
  assert.ok(target < vancouverDate(), 'Only past Vancouver dates may be graded');
  const runs = [], groups = new Map(), statusCounts = {}; let issuedCards = 0, olderEnteringCards = 0;
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
        if (old) assert.equal(old.selectionKey || null, rec.feed?.selectionKey || null, `Observation identity mismatch: ${p}#${index}`);
        if (String(old?.completion?.state || '').toLowerCase() === 'complete') continue;
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
    const summary = { schema: 1, requestId: request.requestId, targetDate: target, verifiedAt, issuedCards, statusCounts, olderEnteringCards, previousEventsAttempted: batch.previous.length, backlogEventsAttempted: batch.backlog.length, previousEventsVerifiedFinal: batch.previous.filter(g => outcomes.get(g.id)?.status === 'final').length, backlogEventsVerifiedFinal: batch.backlog.filter(g => outcomes.get(g.id)?.status === 'final').length, quotaDeferredEvents: batch.deferred.length, observationPaths: runs.map(x => x.op), verifiedEvents: [...outcomes.values()].filter(e => e.status === 'final'), unresolvedEvents: [...outcomes.values()].filter(e => e.status !== 'final'), isolation: 'historical-only' };
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
  const b = buckets(groups); assert.equal(b.previous.length, 20); assert.equal(b.backlog.length, 10); assert.equal(b.deferred.length, 10);
  console.log('Historical grading self-tests passed: date boundary, finite scores, ambiguous identity, market scope and independent quotas.');
}
if (process.argv[2] === '--self-test') selfTest();
else if (process.argv[2]) main(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
else { console.error('Usage: node tools/grade-issued-card-history.mjs <request.json> | --self-test'); process.exitCode = 1; }
