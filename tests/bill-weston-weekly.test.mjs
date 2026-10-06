import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build, renderEdition, validateEdition, spread, performanceSummaries } from '../tools/build-bill-weston-weekly.mjs';

const pointer = JSON.parse(fs.readFileSync('data/characters/bill-weston/current-edition.json','utf8'));
const edition = JSON.parse(fs.readFileSync(pointer.path,'utf8'));
const template = fs.readFileSync('syndicates/downtown-booth/shell-v3.html','utf8');
build({check:true});
const original = JSON.stringify(edition);
const html = renderEdition(edition,template);
assert.equal(JSON.stringify(edition),original,'Rendering must not mutate source values');
assert.equal((html.match(/data-game-key=/g)||[]).length,edition.source.games.length);
const renderedKeys = [...html.matchAll(/data-game-key="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(renderedKeys,[...edition.source.games].sort((a,b)=>Date.parse(a.startTimePacific)-Date.parse(b.startTimePacific)).map(g=>g.gameKey));
assert(!/<script|fetch\(|\{\{[A-Z_]+\}\}/.test(html),'No live data injection or missing content zones');
assert(html.includes('VigScope Value // Graham ATS') && !html.includes('The Week’s Schedule'),'Performance replaces the schedule overview');
assert(edition.performance,'Current edition must retain the frozen performance snapshot');
const latest=performanceSummaries(edition.performance,edition.performance.throughWeek).graham;
assert(latest.complete>0 && edition.performance.rows.length===edition.performance.coverage.settled,'Last-week and season samples must be complete');
assert(html.includes(`${latest.grades.WIN}–${latest.grades.LOSS}–${latest.grades.PUSH}`),'Last-week ATS result missing');
assert(html.includes('ILLUSTRATIVE RETURN CURVE') && html.includes('not issued wagers or actual account returns'),'Standardized return disclosure missing');
const mastheadCss=fs.readFileSync('assets/syndicates/bill-weston/private-sheet-fax.css','utf8');
assert(/\.fax\{display:block/.test(mastheadCss) && /\.weston-masthead\{width:100%;max-width:none/.test(mastheadCss),'Masthead must span the full fax width');
for (const [file,base] of [['syndicates/downtown-booth/wire.html','./'],[JSON.parse(fs.readFileSync('data/characters/bill-weston.json','utf8')).continuity.lastEditionSeen.archivePath,'../../']]) {
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const target=match[1].split('?')[0];
    if(target==='./')continue;
    if(/^https:\/\//.test(target))continue;
    assert(fs.existsSync(path.resolve(path.dirname(file),base,target)),`Missing linked asset: ${file} -> ${target}`);
  }
}
const sample={away:'GB',home:'MIN'};
assert.equal(spread(sample,1.5),'GB −1.5');
assert.equal(spread(sample,-1),'MIN −1');
assert.equal(spread(sample,0),'PICK');
assert.equal(spread(sample,null),'UNAVAILABLE');
const missing=structuredClone(edition);missing.reviews.pop();
assert.throws(()=>validateEdition(missing),/Full schedule/);
const duplicate=structuredClone(edition);duplicate.reviews[1]=duplicate.reviews[0];
assert.throws(()=>validateEdition(duplicate),/Duplicate/);
const wrongGap=structuredClone(edition);wrongGap.source.games[0].grahamHomeStrengthGap+=1;
assert.throws(()=>validateEdition(wrongGap),/gap mismatch/);
const wrongRecord=structuredClone(edition);wrongRecord.performance.strategies.graham.grades.WIN+=1;
assert.throws(()=>validateEdition(wrongRecord),/Performance totals mismatch/);
const afterKickoff=structuredClone(edition);afterKickoff.performance.rows[0].grahamAsOf=new Date(Date.parse(afterKickoff.performance.rows[0].startTime)+1000).toISOString();
assert.throws(()=>validateEdition(afterKickoff),/pre-kickoff/);
const openResult=structuredClone(edition);openResult.performance.rows[0].resultState='PENDING';
assert.throws(()=>validateEdition(openResult),/final performance scores/);
const noMarket=structuredClone(edition);Object.assign(noMarket.source.games[0],{pinnacleSpreadHome:null,pinnacleMove:null,pinnacleObservedAt:null,pinnacleStatus:'UNAVAILABLE',grahamHomeStrengthGap:null});
const unavailable=renderEdition(noMarket,template);
assert(unavailable.includes('UNAVAILABLE'),'Missing quote must not become a numeric zero');
console.log('BILL WEEKLY: full schedule, source signs, unavailable quotes, immutable rendering and live/archive links PASS');
