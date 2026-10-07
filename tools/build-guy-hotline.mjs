#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),api=require('../assets/guy-blue-line.js'),value=require('../assets/guy-value.js');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const board=json('data/game-intelligence/board.json'),history=json('run-history.json');
const latest=history.runs.filter(r=>api.day(r.ts)===api.day(board.asOf)).sort((a,b)=>Date.parse(b.ts)-Date.parse(a.ts))[0];
const report=latest&&fs.existsSync(latest.path)?json(latest.path):null;
const state=api.selectBoard(board,{report});
const shell=fs.readFileSync('syndicates/generated/guy-laflame/shell.html','utf8');
const ledgerPath='data/characters/guy-laflame/value-ledger.json',ledger=fs.existsSync(ledgerPath)?json(ledgerPath):null;
const html=shell.replace('{{DAILY_PICK_RECORD}}',value.render(ledger,{now:ledger?.updatedAt||board.asOf,id:'guyDailyPick',history:false,valueHref:'runner.html'})).replace('{{DAILY_RUNDOWN}}',api.render(state,{now:report?.ts||board.asOf}));
const live='syndicates/generated/guy-laflame/hotline.html';
fs.writeFileSync(live,html);
if(!process.argv.includes('--preview')){
  const digest=crypto.createHash('sha256').update(JSON.stringify(ledger?{state,valueLedger:ledger}:state)).digest('hex');
  const id=`${state.date}-blue-line-${digest.slice(0,12)}`;
  const editionPath=`data/characters/guy-laflame/editions/${id}.json`;
  const archivePath=`syndicates/generated/guy-laflame/archive/${state.date}/${id}.html`;
  const edition={schema:1,id,characterId:'guy-laflame',shellId:'guy-blue-line',shellVersion:1,source:'data/game-intelligence/board.json',sourceReport:latest?.path??null,state,...(ledger?{valueLedger:ledger}:{})};
  const archive=html.replace('<base href="../../../">','<base href="../../../../../">').replace(/<script data-blue-line-live>[\s\S]*?<\/script>/,'');
  for(const [file,text] of [[editionPath,JSON.stringify(edition,null,2)+'\n'],[archivePath,archive]]){
    if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')!==text)throw Error(`Published Guy edition is immutable: ${file}`);
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);
  }
  const pointer={schema:1,id,path:editionPath,archivePath,asOf:state.asOf};
  fs.writeFileSync('data/characters/guy-laflame/current-edition.json',JSON.stringify(pointer,null,2)+'\n');
  const characterPath='data/characters/guy-laflame.json',character=json(characterPath);
  character.continuity.lastEditionSeen=pointer;
  character.continuity.lastReportSeen=report?{slot:report.slot,label:report.label,timestamp:report.ts}:null;
  fs.writeFileSync(characterPath,JSON.stringify(character,null,2)+'\n');
  const indexPath='syndicates/generated/guy-laflame/archive/index.json';
  const index=fs.existsSync(indexPath)?json(indexPath):{schema:1,characterId:'guy-laflame',issues:[]};
  if(!index.issues.some(issue=>issue.id===id))index.issues.push({id,date:state.date,asOf:state.asOf,path:`${state.date}/${id}.html`,editionPath});
  index.issues.sort((a,b)=>Date.parse(b.asOf)-Date.parse(a.asOf));
  fs.writeFileSync(indexPath,JSON.stringify(index,null,2)+'\n');
}
console.log(JSON.stringify({date:state.date,games:state.rows.length,positiveGaps:state.rows.filter(r=>r.edge>0).length,live}));
