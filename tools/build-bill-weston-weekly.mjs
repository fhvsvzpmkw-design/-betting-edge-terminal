#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CURRENT = 'data/characters/bill-weston/current-edition.json';
const LIVE = 'syndicates/downtown-booth/wire.html';
const ARCHIVE = 'syndicates/downtown-booth/archive';
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = p => JSON.parse(read(p));
const encode = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = v => `${JSON.stringify(v, null, 2)}\n`;
const stamp = v => new Intl.DateTimeFormat('en-US', { timeZone:'America/Vancouver', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(v)) + ' PT';
const kickoff = v => new Intl.DateTimeFormat('en-US', { timeZone:'America/Vancouver', weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(v)) + ' PT';
const numeric = v => typeof v === 'number' && Number.isFinite(v);
export const spread = (g, n) => !numeric(n) ? 'UNAVAILABLE' : n === 0 ? 'PICK' : `${n < 0 ? g.home : g.away} −${Math.abs(n)}`;
const paragraphs = values => values.map(v => `<p>${encode(v)}</p>`).join('\n');

export function validateEdition(e) {
  assert(e.schema === 1 && /^\d{4}-w\d{2}-[a-z0-9-]+$/.test(e.id), 'Invalid edition identity');
  assert(e.source.path === 'data/walters/nfl/current-week-terminal.json', 'Graham source required');
  assert(/^[a-f0-9]{40}$/.test(e.source.commit) && /^[a-f0-9]{64}$/.test(e.source.sha256), 'Pinned source provenance required');
  assert(e.source.season === e.season && e.source.week === e.week, 'Edition/source week mismatch');
  assert(Number.isFinite(Date.parse(e.issuedAt)) && Date.parse(e.source.generatedAt) <= Date.parse(e.issuedAt), 'Invalid edition chronology');
  assert(e.source.games.length > 0 && e.source.games.length === e.reviews.length, 'Full schedule review required');
  const keys = new Set(e.source.games.map(g => g.gameKey));
  assert(keys.size === e.source.games.length && new Set(e.reviews.map(r => r.gameKey)).size === keys.size, 'Duplicate games');
  for (const g of e.source.games) {
    assert(g.gameKey === `${e.season}-W${String(e.week).padStart(2,'0')}-${g.away}-${g.home}`, 'Game identity mismatch');
    assert(Number.isFinite(Date.parse(g.startTimePacific)), 'Kickoff required');
    assert(numeric(g.grahamFairHome) && g.grahamAsOf && g.numberStatus, 'Graham fair/status required');
    assert(!numeric(g.pinnacleSpreadHome) || (g.pinnacleStatus === 'AVAILABLE' && g.pinnacleObservedAt), 'Market timestamp/status required');
    if (numeric(g.pinnacleSpreadHome)) assert(Math.abs(g.grahamHomeStrengthGap - (g.pinnacleSpreadHome - g.grahamFairHome)) < 1e-8, 'Home-coordinate gap mismatch');
    const r = e.reviews.find(r => r.gameKey === g.gameKey);
    assert(r && r.read?.trim() && r.note?.trim(), `Missing Weston read: ${g.gameKey}`);
  }
  for (const section of ['openingMemo','changeMemo','closingWatchlist']) assert(e[section]?.length, `${section} required`);
}

export function renderEdition(e, template, baseHref = './') {
  validateEdition(e);
  const games = [...e.source.games].sort((a,b) => Date.parse(a.startTimePacific) - Date.parse(b.startTimePacific));
  const groups = new Map();
  for (const g of games) groups.set(g.startTimePacific, (groups.get(g.startTimePacific) || 0) + 1);
  const table = '<table class="timeline"><thead><tr><th scope="col">KICKOFF WINDOW</th><th scope="col">DESK LOAD</th></tr></thead><tbody>' + [...groups].map(([time,count]) => `<tr><td>${encode(kickoff(time))}</td><td>${count} ${count === 1 ? 'game' : 'games'}</td></tr>`).join('') + '</tbody></table>';
  const entries = games.map((g,i) => {
    const r = e.reviews.find(r => r.gameKey === g.gameKey);
    const gap = numeric(g.pinnacleSpreadHome) ? (g.grahamHomeStrengthGap === 0 ? 'EVEN' : `${g.grahamHomeStrengthGap > 0 ? g.home : g.away} ${Math.abs(g.grahamHomeStrengthGap)} pts`) : 'UNAVAILABLE';
    const cells = [['KICKOFF',kickoff(g.startTimePacific)],['GRAHAM NUMBER',spread(g,g.grahamFairHome)],['PINNACLE BENCHMARK',spread(g,g.pinnacleSpreadHome)],['GRAHAM / MARKET GAP',gap],['MKT Δ — HOME SPREAD',numeric(g.pinnacleMove) ? `${g.pinnacleMove > 0 ? '+' : ''}${g.pinnacleMove} pts` : 'UNAVAILABLE']];
    return `<section class="window" data-game-key="${encode(g.gameKey)}"><h3>${String(i+1).padStart(2,'0')} // ${encode(g.away)} AT ${encode(g.home)}</h3><div class="grid">${cells.map(([k,v]) => `<div class="cell"><small>${encode(k)}</small><b>${encode(v)}</b></div>`).join('')}</div><p><b>WESTON READ:</b> ${encode(r.read)}</p><div class="note">${encode(r.note)}</div><p class="foot">Graham fair as of ${encode(stamp(g.grahamAsOf))} // Pinnacle observed ${g.pinnacleObservedAt ? encode(stamp(g.pinnacleObservedAt)) : 'unavailable'} // ${/PROVISIONAL/.test(g.numberStatus) ? 'PROVISIONAL FAIR' : encode(g.numberStatus.replaceAll('_',' '))}</p></section>`;
  }).join('\n');
  const values = {
    BASE_HREF:encode(baseHref), PAGE_TITLE:encode(`Bill Weston Private Sheet — Week ${e.week} — ${e.label}`),
    ISSUE_LABEL:encode(`${e.season} // WEEK ${e.week} // ${e.label}`),
    FEED_ISSUED:encode(stamp(e.issuedAt)), ISSUE_COUNTS:encode(`${games.length} GAMES // NO ORDER`),
    WESTON_METHOD:`<b>GRAHAM'S NUMBERS. WESTON'S READ.</b>${paragraphs(e.openingMemo)}`,
    RECONCILIATION:`<p>${encode(e.scheduleMemo)}</p>${table}`,
    CHANGE_MEMO:paragraphs(e.changeMemo), WINDOW_ENTRIES:entries,
    FINAL_DISPOSITION:`<b>FINAL DESK DISPOSITION // NO ORDER</b>${paragraphs(e.closingWatchlist)}<div class="note">${encode(e.signature)}</div>`,
    AUTHORITY_FOOTER:`Dated guest edition: ${encode(stamp(e.issuedAt))}. Graham board captured ${encode(stamp(e.source.generatedAt))}; information review ${encode(stamp(e.source.lastResearchAt))}. Numbers belong to Graham Mercer’s Private Line. Pinnacle is a benchmark at the printed observation time; gaps and margin notes are review priorities, not executable orders. MKT Δ is the saved change in Pinnacle's home spread from the day's retained baseline; 0 means unchanged, unavailable means no usable comparison. The issued execution report retains betting authority.<br><a href="../../syndicates/generated/graham-mercer/hotline.html">Graham’s current Private Line</a> // <a href="../../${encode(e.editionPath)}">This edition’s source record</a><br>HOTLINE SHELL: PRIVATE SHEET v3. Full-week guest fax; refresh the edition, preserve the page.`
  };
  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_,key) => { assert(key in values, `Unknown content zone ${key}`); return values[key]; });
  assert(!/\{\{[A-Z_]+\}\}/.test(html), 'Unfilled template');
  return html;
}

export function build({check = false} = {}) {
  const pointer = json(CURRENT);
  assert(/^data\/characters\/bill-weston\/editions\/[a-z0-9-]+\.json$/.test(pointer.path), 'Invalid edition path');
  const e = json(pointer.path);
  assert(e.editionPath === pointer.path, 'Edition path mismatch');
  const template = read('syndicates/downtown-booth/shell-v3.html');
  const live = renderEdition(e, template);
  const archiveRel = `${e.issuedAt.slice(0,10)}/${e.id}.html`;
  const archivePath = `${ARCHIVE}/${archiveRel}`;
  const archived = renderEdition(e, template, '../../');
  // Validate every immutable output before any mutation. Rebuilds never rewrite an issued opinion.
  if (fs.existsSync(path.join(ROOT,archivePath))) assert.equal(read(archivePath), archived, 'Archived edition is immutable; create a new edition ID');
  const index = json(`${ARCHIVE}/index.json`);
  const entry = {id:`${e.id}|bill-weston`, characterId:'bill-weston', profileId:'vic-fremont', displayName:'BILL WESTON', publication:'PRIVATE SHEET', date:e.issuedAt.slice(0,10), session:e.id, label:e.label, issuedAt:e.issuedAt, sourceEdition:pointer.path, sourceCommit:e.source.commit, sourceSha256:e.source.sha256, path:archiveRel, shellId:'private-sheet', shellVersion:3};
  const existing = index.issues.find(x => x.id === entry.id);
  if (existing) assert.deepEqual(existing, entry, 'Archive metadata is immutable');
  if (check) {
    assert.equal(read(LIVE),live,'Live weekly fax needs rebuild');
    assert.equal(read(archivePath),archived,'Archived weekly fax missing');
    assert(existing,'Archive index missing weekly edition');
    assert.equal(json('data/characters/bill-weston.json').continuity.lastEditionSeen.id,e.id,'Character edition mismatch');
    console.log(`BILL WESTON WEEKLY: ${e.source.games.length} games; frozen source, live edition and archive verified`);
    return;
  }
  const profile = json('data/characters/bill-weston.json');
  profile.updatedAt = e.issuedAt;
  profile.continuity.lastEditionSeen = {id:e.id,label:e.label,timestamp:e.issuedAt,season:e.season,week:e.week,sourceEdition:pointer.path,archivePath};
  profile.continuity.currentMood = e.currentMood;
  if (!existing) index.issues.push(entry);
  index.updatedAt = e.issuedAt;
  for (const [p,value] of [[archivePath,archived],[LIVE,live],[`${ARCHIVE}/index.json`,text(index)],['data/characters/bill-weston.json',text(profile)]]) {
    fs.mkdirSync(path.dirname(path.join(ROOT,p)), {recursive:true});
    fs.writeFileSync(path.join(ROOT,p), value);
  }
  console.log(`Published local weekly fax: ${e.id} (${e.source.games.length} games)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(process.argv.slice(2).every(a => a === '--check'), 'Usage: node tools/build-bill-weston-weekly.mjs [--check]');
  build({check:process.argv.includes('--check')});
}
