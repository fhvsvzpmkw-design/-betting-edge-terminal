#!/usr/bin/env node
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const markerPath=process.argv[2]||'data/walters/nfl/current-research-input.json';
const marker=JSON.parse(fs.readFileSync(markerPath,'utf8'));
if(marker?.schema!==1||marker?.marketViewed!==false||!Array.isArray(marker.parts)||!marker.parts.length)throw new Error('Invalid Graham multipart marker');
let combined={schema:1,marketViewed:false,teamRatingUpdates:[],sourcesChecked:[],teamFindings:[],games:[],espnFpi:{}};
for(const partPath of marker.parts){
  const p=JSON.parse(fs.readFileSync(partPath,'utf8'));
  if(p?.schema!==1)throw new Error(`Invalid part schema: ${partPath}`);
  if(p.marketViewed===true)throw new Error(`Market isolation violation in ${partPath}`);
  if(p.effectiveAt){if(combined.effectiveAt&&combined.effectiveAt!==p.effectiveAt)throw new Error('effectiveAt mismatch');combined.effectiveAt=p.effectiveAt;}
  if(p.startedAt)combined.startedAt=p.startedAt;
  if(p.espnFpiSource)combined.espnFpiSource=p.espnFpiSource;
  if(p.initialBuildPolicy)combined.initialBuildPolicy=p.initialBuildPolicy;
  if(p.espnFpi)Object.assign(combined.espnFpi,p.espnFpi);
  if(Array.isArray(p.teamRatingUpdates))combined.teamRatingUpdates.push(...p.teamRatingUpdates);
  if(Array.isArray(p.sourcesChecked))combined.sourcesChecked.push(...p.sourcesChecked);
  if(Array.isArray(p.teamFindings))combined.teamFindings.push(...p.teamFindings);
  if(Array.isArray(p.games))combined.games.push(...p.games);
}
if(!combined.effectiveAt)combined.effectiveAt=marker.effectiveAt;
if(!combined.startedAt)combined.startedAt=marker.startedAt||combined.effectiveAt;
const tmp='/tmp/graham-research-combined.json';
fs.writeFileSync(tmp,JSON.stringify(combined,null,2)+'\n');
const result=spawnSync(process.execPath,['tools/apply-graham-research-input.mjs',tmp],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
