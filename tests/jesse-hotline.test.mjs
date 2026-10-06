#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {selectBoard,renderHotline} from '../tools/build-jesse-hotline.mjs';
const read = file => fs.readFileSync(file,'utf8'), json = file => JSON.parse(read(file));
const pointer=json('data/jesse/current-edition.json'),edition=json(pointer.path),raw=read(edition.sourceReport),report=JSON.parse(raw);
assert.equal(crypto.createHash('sha1').update(`blob ${Buffer.byteLength(raw)}\0`).update(raw).digest('hex'),edition.sourceBlobSha,'Edition must pin the exact stored report');
assert.equal(report.ts,edition.reportTimestamp);
const html=read('syndicates/death-angel/hotline.html'),shell=read('syndicates/death-angel/shell-v4.html');
assert.equal(renderHotline(edition,report,shell).html,html,'The issued page must match the pinned report and authored edition');
assert.equal(html.replace('<base href="./">','<base href="../../">'),read(`syndicates/death-angel/archive/${edition.date}/${edition.id}.html`));
assert.ok(!/fetch\(|<script\b|MutationObserver|IntersectionObserver|setInterval\(|setTimeout\(|\{\{/.test(html),'Opening Jesse must not refresh his edition');
assert.ok(html.includes('data-update-mode="manual-static"'));
assert.ok(html.indexOf('id="top-bets"')<html.indexOf('id="top-leans"')&&html.indexOf('id="top-leans"')<html.indexOf('id="five-edges"'),'BETs and LEANs must lead the five-edge file');
for(const asset of ['delphoria-logo.png?v=2','delphoria-hero.png?v=2','delphoria-house-badge.png?v=2','delphoria-phone-badge.png?v=2'])assert.ok(html.includes(asset),'Keep the approved artwork');

// Opposing calls, a large forecast percentage, negative edges and closed events catch the old ranking errors.
const synthetic = (key,status,edge,eventDate='2026-10-07T01:00:00Z') => ({selectionKey:key,status,edge:'ESPN published 99.90% for this exact selection.',feed:{eventDate},benchmarkComparison:{edgeProbabilityPoints:edge}});
const fixture={ts:'2026-10-06T16:50:00Z',recs:[synthetic('bet-second','BET',-1),synthetic('pass-positive','PASS',5),synthetic('lean-first','LEAN',-2),synthetic('bet-first','BET',4),synthetic('lean-second','LEAN',3),synthetic('pass-small','PASS',2),synthetic('negative-large','PASS',-99),synthetic('forecast-only','LEAN',undefined),synthetic('not-finite','PASS',NaN),synthetic('already-started','BET',100,'2026-10-06T15:00:00Z'),synthetic('missing-date','PASS',200,null)]};
const board=selectBoard(fixture);
assert.deepEqual(board.bets.map(x=>x.selectionKey),['bet-second','bet-first'],'Calls retain source order rather than being governed by numerical edge');
assert.deepEqual(board.leans.map(x=>x.selectionKey),['lean-first','lean-second','forecast-only']);
assert.deepEqual(board.edges.map(x=>x.selectionKey),['pass-positive','bet-first','lean-second','pass-small','bet-second'],'Only finite measured signed edges enter the top five');
assert.equal(board.edges[0].status,'PASS','An edge ranking must never promote a PASS');
assert.equal(board.edges[4].benchmarkComparison.edgeProbabilityPoints,-1,'A negative fifth edge stays negative');
assert.equal(board.expiredCount,2);
assert.equal(board.unmeasuredCount,2);

// This approved current edition has no BETs, three LEANs and two positive comparisons in its top five.
if(edition.id==='2026-10-06-delphoria-v4'){
 const current=selectBoard(report);
 assert.equal(current.bets.length,0);assert.ok(html.includes('The drawer stays shut.'));
 assert.deepEqual(current.leans.map(x=>x.selectionKey),['75065656|ml|home||','75065682|ml|home||','75065682|totals|over||6']);
 assert.deepEqual(current.edges.map(x=>x.selectionKey),['75065682|totals|over||6','70898780|totals|over||50.5','72908952|totals|over||6','72886456|spread|away||1.5','75065656|ml|away||']);
 assert.deepEqual(current.edges.map(x=>x.status),['LEAN','PASS','PASS','PASS','PASS']);
 assert.ok(current.edges.every(x=>x.stake==='$0'&&x.playTo==='NO BET'));
 for(const value of ['+1.920','+1.212','-0.478','-0.724','-0.884'])assert.ok(html.includes(value));
 assert.equal((html.match(/data-edge-rank=/g)||[]).length,5);
 assert.equal((html.match(/<article class="card lean"/g)||[]).length,3);
 const old=read('syndicates/death-angel/archive/2026-08-31/2026-w01-manual-v3.html').replace('<head>\n<base href="../../">','<head>');
 assert.equal(crypto.createHash('sha1').update(`blob ${Buffer.byteLength(old)}\0`).update(old).digest('hex'),'ffdd15e872b53592217d931ee9c7b703f8ed099b','The previous v3 issue copy must remain intact');
}
console.log('JESSE HOTLINE: PASS // pinned calls, five signed edges, no forecast ranking, static archive');
