#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const assert = (ok, message) => { if (!ok) throw new Error(message); };
function absolute(relative) {
  assert(typeof relative === 'string' && relative && !path.isAbsolute(relative) && !relative.split('/').includes('..'), `Unsafe repository path: ${relative}`);
  return path.join(ROOT, relative);
}
const read = relative => fs.readFileSync(absolute(relative), 'utf8');
const readJson = relative => JSON.parse(read(relative));
const gitBlobSha = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const when = value => new Intl.DateTimeFormat('en-US', { timeZone:'America/Vancouver', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true }).format(new Date(value)) + ' PT';

// A forecast percentage is never an edge. Calls and their original ordering belong to the report.
export function selectBoard(report) {
  assert(Array.isArray(report.recs) && Number.isFinite(Date.parse(report.ts)), 'A completed report with an issue time is required');
  const active = report.recs.filter(rec => Number.isFinite(Date.parse(rec.feed?.eventDate)) && Date.parse(rec.feed.eventDate) > Date.parse(report.ts));
  const measured = active.filter(rec => typeof rec.benchmarkComparison?.edgeProbabilityPoints === 'number' && Number.isFinite(rec.benchmarkComparison.edgeProbabilityPoints));
  return {
    bets: active.filter(rec => rec.status === 'BET'),
    leans: active.filter(rec => rec.status === 'LEAN'),
    edges: [...measured].sort((a,b) => b.benchmarkComparison.edgeProbabilityPoints - a.benchmarkComparison.edgeProbabilityPoints).slice(0,5),
    expiredCount: report.recs.length - active.length,
    unmeasuredCount: active.length - measured.length
  };
}

function facts(rec) {
  return [['Recorded price',rec.price],['Book',rec.book],['Stake',rec.stake],['Play to',rec.playTo],['Start',when(rec.feed.eventDate)],['Market reference',rec.fair]]
    .map(([label,value]) => `<div class="fact"><small>${escape(label)}</small><b>${escape(value)}</b></div>`).join('');
}
function record(rec) {
  const reason = rec.marketAssessment?.decisionRationale || rec.coreAssessment?.rationale || rec.analysis;
  const information = rec.marketAssessment?.informationReview;
  return `<details class="record"><summary>Read the report slip</summary><p><b>Report decision:</b> ${escape(reason)}</p><p><b>Information:</b> ${escape(information?.impact || 'No separate information note supplied.')}</p><p><b>Quote observed:</b> ${escape(rec.feed.quoteObservedAt || 'Not supplied')} · <b>Quote updated:</b> ${escape(rec.feed.quoteUpdatedAt || 'Not supplied')}</p><p><b>Source:</b> ${escape(rec.source)}</p></details>`;
}
function card(rec, edition) {
  const note = edition.selectionNotes?.[rec.selectionKey];
  return `<article class="card ${rec.status.toLowerCase()}" data-call="${escape(rec.status)}" data-selection-key="${escape(rec.selectionKey)}"><div class="cardhead"><span>${escape(rec.meta)}</span><span class="status">${escape(rec.status)}</span></div><h3 class="team">${escape(rec.title)}</h3><div class="facts">${facts(rec)}</div><p class="source-edge"><b>ON THE SHEET:</b> ${escape(rec.edge)}</p>${note?.desk ? `<p class="desk-note">${escape(note.desk)}</p>` : ''}<div class="jesse">JESSE SAYS: “${escape(note?.jesse || (rec.status === 'BET' ? 'Get the number on the slip.' : 'Keep it close. No money yet.'))}”</div><div class="phone"><b>PHONE SLIP:</b> ${escape(note?.phone || rec.marketAssessment?.informationReview?.impact || 'Use only the recorded selection, price, stake and play-to on the source sheet.')}</div>${record(rec)}</article>`;
}
function edgeBoard(rows) {
  if (!rows.length) return '<p>No measured probability-point edges are available on this sheet.</p>';
  return `<div class="counterWrap" tabindex="0" aria-label="Scroll the five-edge board horizontally"><table><caption>Ranked highest to lowest · original calls preserved</caption><thead><tr><th scope="col">#</th><th scope="col">Selection / game</th><th scope="col">Recorded quote</th><th scope="col">Call</th><th scope="col">Edge (pp)</th><th scope="col">Stake</th></tr></thead><tbody>${rows.map((rec,index) => {
    const edge = rec.benchmarkComparison.edgeProbabilityPoints;
    return `<tr data-edge-rank="${index+1}" data-call="${escape(rec.status)}" data-selection-key="${escape(rec.selectionKey)}"><td>${index+1}</td><th scope="row">${escape(rec.title)}<small>${escape(rec.meta.split('|').slice(0,2).join(' · '))}<br>${escape(when(rec.feed.eventDate))}</small></th><td>${escape(rec.price)}<small>${escape(rec.book)}</small></td><td><span class="status">${escape(rec.status)}</span></td><td class="gap ${edge >= 0 ? 'pos' : 'neg'}">${edge >= 0 ? '+' : ''}${edge.toFixed(3)}</td><td>${escape(rec.stake)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

export function renderHotline(edition, report, shell) {
  const board = selectBoard(report);
  const fills = {
    BASE: './', COUNTER_DATE: `${edition.date} // COUNTER COPY`,
    ISSUE_STAMPS: `<span class="stamp">${escape(report.label)}</span><span class="stamp">ISSUED ${escape(when(report.ts))}</span><span class="stamp hot">${report.counts.bet} BET · ${report.counts.lean} LEAN · NEW RISK $${escape(report.risk)}</span><span class="stamp">MANUAL EDITION // v4</span>`,
    STORY: edition.story.map(paragraph => `<p>${escape(paragraph)}</p>`).join(''),
    BET_CARDS: board.bets.length ? board.bets.map(rec => card(rec,edition)).join('') : `<div class="empty"><span class="status">NO BET</span><h3>The drawer stays shut.</h3><p>No BET was authorized in this report. New sports risk: $${escape(report.risk)}.</p><div class="jesse">JESSE SAYS: “${escape(edition.noBetLine)}”</div></div>`,
    LEAN_CARDS: board.leans.length ? board.leans.map(rec => card(rec,edition)).join('') : '<p>No LEANs on the issued sheet. Nothing to carry upstairs.</p>',
    EDGE_BOARD: edgeBoard(board.edges),
    EDGE_STORY: edition.edgeStory.map(paragraph => `<p>${escape(paragraph)}</p>`).join(''),
    HOUSE_NOTE: `<h2>Delphoria House Note</h2><p>${escape(edition.houseNote)}</p>`,
    BACK_ROOM: `<h2>Back Room // The poker game keeps going</h2>${edition.backRoom.map(paragraph => `<p>${escape(paragraph)}</p>`).join('')}`,
    LAST_WORD: `<h2>Last Word</h2><p>${escape(edition.lastWord)}</p>`,
    AUTHORITY_FOOTER: `SOURCE AUTHORITY: BETTING EDGE / VIGSCOPE ISSUED REPORT. ${escape(edition.sourceReport)} · ${escape(report.ts)} · ${escape(report.label)}. ${report.recs.length} evaluated: ${report.counts.bet} BET / ${report.counts.lean} LEAN / ${report.counts.wait} WAIT / ${report.counts.pass} PASS. BANKROLL $${escape(report.bankroll)} · NEW RISK $${escape(report.risk)}. Prices are the report's recorded quotes, not a live recheck. BETs then LEANs retain report order; the separate five-edge file uses signed probability points versus the market reference. Forecast percentages are not edges. ${board.expiredCount} started/undated selections omitted; ${board.unmeasuredCount} unmeasured selections excluded from edge ranking. FICTIONAL DELPHORIA SCENES ARE ATMOSPHERE, NEVER BETTING EVIDENCE. MANUAL STATIC JESSE v4 · NO RUNTIME FETCH. NO POLLING. NO OBSERVERS. NO TIMER-DRIVEN DOM REBUILD.`
  };
  let html = shell.replace(/\{\{([A-Z_]+)\}\}/g, (_,key) => { assert(Object.hasOwn(fills,key), `Unknown shell zone: ${key}`); return fills[key]; });
  assert(!/\{\{|fetch\(|<script\b|MutationObserver|setInterval\(/.test(html), 'Jesse must remain a complete static edition');
  return { html, board };
}

function immutable(relative, content) {
  const file = absolute(relative);
  if (fs.existsSync(file)) assert(fs.readFileSync(file,'utf8') === content, `Issued archive cannot be rewritten: ${relative}`);
  else { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file,content); }
}
function build(editionPath) {
  const edition = readJson(editionPath), raw = read(edition.sourceReport), report = JSON.parse(raw);
  assert(edition.schema === 1 && edition.characterId === 'jesse-bains', 'Expected a Jesse edition');
  assert(gitBlobSha(raw) === edition.sourceBlobSha, 'The pinned report blob does not match this edition');
  assert(report.ts === edition.reportTimestamp && report.slot === edition.slot && report.label === edition.label, 'Report identity mismatch');
  assert(edition.date === report.ts.slice(0,10), 'Edition date must match the report date');
  const shellPath = 'syndicates/death-angel/shell-v4.html';
  const {html,board} = renderHotline(edition,report,read(shellPath));
  const archivePath = `syndicates/death-angel/archive/${edition.date}/${edition.id}.html`;
  immutable(archivePath,html.replace('<base href="./">','<base href="../../">'));
  const indexPath = 'syndicates/death-angel/archive/index.json', index = readJson(indexPath);
  const issue = {id:edition.id,characterId:'jesse-bains',profileId:'jesse-bains',displayName:'JESSE BAINS',publication:'THE SPORTS DESK AT THE HOTEL DELPHORIA',date:edition.date,label:report.label,issuedAt:edition.publishedAt,reportTimestamp:report.ts,sourceReport:edition.sourceReport,sourceBlobSha:edition.sourceBlobSha,path:`${edition.date}/${edition.id}.html`,shellId:'delphoria-house-board',shellVersion:4};
  const existing = index.issues.find(item => item.id === issue.id || item.path === issue.path);
  if (existing) assert(JSON.stringify(existing) === JSON.stringify(issue), 'Archive index issue is immutable');
  else index.issues.push(issue);
  index.updatedAt = edition.publishedAt;
  const characterPath = 'data/characters/jesse-bains.json', character = readJson(characterPath);
  character.updatedAt = edition.publishedAt;
  character.continuity.lastReportSeen = {slot:report.slot,label:report.label,timestamp:report.ts};
  character.continuity.lastEditionSeen = {id:edition.id,path:editionPath,archivePath,issuedAt:edition.publishedAt,sourceReport:edition.sourceReport,sourceBlobSha:edition.sourceBlobSha,sceneModules:edition.sceneModules,houseNoteTopic:edition.houseNoteTopic};
  character.continuity.automaticReportUpdates = false;
  fs.writeFileSync(absolute('syndicates/death-angel/hotline.html'),html);
  fs.writeFileSync(absolute(indexPath),json(index));
  fs.writeFileSync(absolute(characterPath),json(character));
  fs.mkdirSync(absolute('data/jesse'),{recursive:true});
  fs.writeFileSync(absolute('data/jesse/current-edition.json'),json({schema:1,id:edition.id,path:editionPath}));
  console.log(`JESSE v4 // ${board.bets.length} BET / ${board.leans.length} LEAN / ${board.edges.length} highest edges // ${report.ts}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(process.argv[2] === '--edition' && process.argv[3] && process.argv.length === 4, 'Usage: node tools/build-jesse-hotline.mjs --edition data/jesse/editions/<edition>.json');
  build(process.argv[3]);
}
