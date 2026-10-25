#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const FAILURE='GRAHAM_INDEPENDENT_PREFLIGHT_FAILED';
const invalid=()=>{throw new Error(FAILURE);};

// The existing resolver verifies required active-week files, including the
// market ledger, entirely in code. Never return its manifest or file contents,
// and never surface an upstream error that might contain an untrusted value.
export function verifyGrahamIndependentPreflight({root=process.cwd()}={}) {
  let active;
  try{active=resolveGrahamActiveWeek({root:path.resolve(root),requireFiles:true});}
  catch{invalid();}
  return {
    schema:1,state:'VERIFIED_ACTIVE_WEEK',season:active.season,week:active.week,
    manifestPath:'data/walters/nfl/active-week.json',
    paths:{
      currentNumbers:active.paths.currentNumbers,
      researchLedger:active.paths.researchLedger,
      dailyMarketLedger:active.paths.dailyMarketLedger,
      personnelLedger:active.paths.personnelLedger,
      researchEventsDir:active.paths.researchEventsDir
    },
    marketViewed:false
  };
}

function main(argv){
  let root=process.cwd();
  if(argv.length){
    if(argv.length!==2||argv[0]!=='--root'||!argv[1]||argv[1].startsWith('--'))invalid();
    root=argv[1];
  }
  console.log(JSON.stringify(verifyGrahamIndependentPreflight({root}),null,2));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main(process.argv.slice(2));}
  catch{console.error(JSON.stringify({state:'FAIL',code:FAILURE}));process.exitCode=1;}
}
