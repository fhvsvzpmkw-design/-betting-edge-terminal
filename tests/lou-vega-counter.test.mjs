#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from '../tools/build-lou-vega-counter.mjs';
const read=p=>fs.readFileSync(p,'utf8'),json=p=>JSON.parse(read(p));
build({check:true});
const profile=json('data/characters/lou-vega.json');
const livePath='syndicates/generated/lou-vega/hotline.html',live=read(livePath);
assert.equal(profile.authority.mode,'static-product-counter');
assert.equal(profile.guardrails.readsSportsReports,false);
assert.equal(profile.guardrails.readsPizzaPlays,false);
assert.equal(profile.guardrails.readsGradingResults,false);
assert.equal(profile.continuity.automaticReportUpdates,false);
assert(!profile.continuity.lastReportSeen && !profile.sourceMaterial.pizzaPlays && !profile.sourceMaterial.pizzaResults);
assert(!/<script|fetch\(|\{\{[A-Z_]+\}\}/.test(live),'Counter must be static with filled content');
assert(!/PIZZA PLAY|SOURCE STATUS|PLAY TO|NEW RISK|Bet365|DraftKings|tracking bankroll|data-zone="recommendations"/i.test(live),'Sports feed content must not return');
const actions=[...live.matchAll(/<a\b[^>]*data-tenplay-link[^>]*>/g)].map(m=>m[0]);
assert(actions.length>=2,'Main counter and coupon must launch the product');
for(const a of actions){assert(a.includes('href="https://fhvsvzpmkw-design.github.io/Ten-play-web/"'));assert(a.includes('target="_blank"') && a.includes('noopener'),'Product must open outside the Syndicate frame');}
for(const [file,base] of [[livePath,'./'],[profile.continuity.lastEditionSeen.archivePath,'../../']]){
 for(const m of live.matchAll(/(?:src|href)="([^"#]+)"/g)){
  const target=m[1];if(target==='./'||/^https:/.test(target))continue;
  assert(fs.existsSync(path.resolve(path.dirname(file),base,target)),`Broken asset: ${file} -> ${target}`);
 }
}
const ids=[...live.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate page IDs');
for(const m of live.matchAll(/href="#([^"]+)"/g))assert(ids.includes(m[1]),`Broken menu link: ${m[1]}`);
const historical=read(profile.continuity.historicalSportsArchive);
assert(historical.includes('09:30 FINAL MORNING')&&historical.includes('PIZZA PLAY #1'),'Historical issue retained');
const oldArchive=fs.statSync(profile.continuity.historicalSportsArchive).mtimeMs;
const attempted=spawnSync(process.execPath,['tools/archive-syndicate-hotline.mjs','--character','lou-vega','--dry-run'],{encoding:'utf8'});
assert.notEqual(attempted.status,0,'Report archiver must reject static Lou');
assert(attempted.stderr.includes('Static product counters do not use report-session archives'));
assert.equal(fs.statSync(profile.continuity.historicalSportsArchive).mtimeMs,oldArchive);
console.log('LOU COUNTER: product actions, static authority, menu/asset links and history protection PASS');
