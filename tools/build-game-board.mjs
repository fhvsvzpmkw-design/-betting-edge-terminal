#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {bindIntelligence,buildGameIntelligence,readOptional} from './game-intelligence.mjs';
import {derivePrimarySelectionInventory} from './major-sport-market-coverage-gate.mjs';
import {loadNovigCapture} from './novig-market-data.mjs';
export function buildBoard(root=process.cwd(),at=null){
  const feed=readOptional(path.join(root,'data/live-odds.json')),capture=readOptional(path.join(root,'data/game-intelligence/current.json'));
  const now=new Date().toISOString(),novig=loadNovigCapture(root,now);
  // Optional collection finishes after forecast collection. The board must
  // represent both captures without advancing either source's own clock.
  const boardAt=[capture?.collectedAt,novig?.collectedAt].filter(t=>Number.isFinite(Date.parse(t))&&Date.parse(t)<=Date.parse(now))
    .sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)||now;
  const report={ts:at||boardAt,feedGeneratedAt:feed.generatedAt};
  const universe=derivePrimarySelectionInventory(report,feed,readOptional(path.join(root,'data/major-sport-market-coverage-v1.json'))),sidecar={};
  bindIntelligence({root,report,sidecar,feed,universe,liveBoard:true});
  const observer=readOptional(path.join(root,'data/oddspapi-observer.json'));
  return {...buildGameIntelligence({report,sidecar,feed,universe,observer}),view:'CURRENT_GAME_BOARD',feedGeneratedAt:feed.generatedAt,
    sourcePerformance:readOptional(path.join(root,'data/game-intelligence/performance.json')),
    limitation:'Current research board. Issued decisions remain in their timestamped reports. Source observations and available prices retain separate clocks.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const board=buildBoard();fs.mkdirSync('data/game-intelligence',{recursive:true});fs.writeFileSync('data/game-intelligence/board.json',JSON.stringify(board,null,2)+'\n');
  console.log(JSON.stringify({asOf:board.asOf,...board.counts}));
}
