#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DEFAULT_MANIFEST='data/walters/nfl/active-week.json';

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function int(v){const n=Number(v);return Number.isInteger(n)?n:null}
function weekToken(week){return String(week).padStart(2,'0')}

export function grahamWeekPaths(season,week,{root=process.cwd()}={}){
  const s=int(season),w=int(week);
  if(s===null||s<2000||s>2100)throw new Error(`Invalid Graham season: ${season}`);
  if(w===null||w<1||w>30)throw new Error(`Invalid Graham week: ${week}`);
  const tag=`week-${weekToken(w)}`;
  const baseRel=`data/walters/nfl/${s}`;
  const rel={
    currentNumbers:`${baseRel}/${tag}-current-numbers.json`,
    researchLedger:`${baseRel}/${tag}-research-ledger.json`,
    dailyMarketLedger:`${baseRel}/${tag}-daily-market-ledger.json`,
    personnelLedger:`${baseRel}/${tag}-personnel-ledger.json`,
    researchEventsDir:`${baseRel}/${tag}-research-events`
  };
  const abs=Object.fromEntries(Object.entries(rel).map(([k,v])=>[k,path.join(root,v)]));
  return {season:s,week:w,weekToken:weekToken(w),weekTag:tag,relative:rel,absolute:abs};
}

function validateWeekFile(file,season,week,label){
  const obj=readJson(file);
  if(int(obj?.season)!==season||int(obj?.week)!==week){
    throw new Error(`${label} season/week mismatch: expected ${season} W${weekToken(week)}`);
  }
  return obj;
}

export function resolveGrahamActiveWeek({root=process.cwd(),manifestPath=null,requireFiles=true}={}){
  const manifestRel=manifestPath||process.env.GRAHAM_ACTIVE_WEEK_MANIFEST||DEFAULT_MANIFEST;
  const manifestAbs=path.isAbsolute(manifestRel)?manifestRel:path.join(root,manifestRel);
  if(!fs.existsSync(manifestAbs))throw new Error(`Graham active-week manifest missing: ${manifestRel}`);
  const manifest=readJson(manifestAbs);
  if(manifest?.schema!==1)throw new Error('Unsupported Graham active-week schema');
  if(manifest?.state!=='ACTIVE')throw new Error(`Graham active-week state is not ACTIVE: ${manifest?.state}`);
  if(manifest?.authority!=='GRAHAM_WEEK_ROLLOVER')throw new Error(`Unexpected Graham active-week authority: ${manifest?.authority}`);
  const season=int(manifest.season),week=int(manifest.week);
  const paths=grahamWeekPaths(season,week,{root});

  if(requireFiles){
    for(const [key,label] of [
      ['currentNumbers','current numbers'],
      ['researchLedger','research ledger'],
      ['dailyMarketLedger','daily market ledger']
    ]){
      const file=paths.absolute[key];
      if(!fs.existsSync(file))throw new Error(`Active Graham ${label} missing: ${paths.relative[key]}`);
      validateWeekFile(file,season,week,label);
    }
    if(fs.existsSync(paths.absolute.personnelLedger))validateWeekFile(paths.absolute.personnelLedger,season,week,'personnel ledger');
  }

  return {
    manifest,
    manifestPath:path.relative(root,manifestAbs).replaceAll(path.sep,'/'),
    season,
    week,
    weekToken:paths.weekToken,
    weekTag:paths.weekTag,
    paths:paths.relative,
    absolutePaths:paths.absolute
  };
}

function parseCli(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a==='--json'){out.json=true;continue}
    if(a==='--no-require-files'){out.requireFiles=false;continue}
    if(a==='--manifest'){out.manifestPath=argv[++i];continue}
    if(a==='--path'){out.pathKey=argv[++i];continue}
    if(a==='--preview'){
      out.previewSeason=argv[++i];out.previewWeek=argv[++i];continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function main(){
  const args=parseCli(process.argv.slice(2));
  if(args.previewSeason!=null||args.previewWeek!=null){
    const preview=grahamWeekPaths(args.previewSeason,args.previewWeek);
    console.log(JSON.stringify(preview,null,2));
    return;
  }
  const active=resolveGrahamActiveWeek({manifestPath:args.manifestPath,requireFiles:args.requireFiles!==false});
  if(args.pathKey){
    if(!(args.pathKey in active.paths))throw new Error(`Unknown active-week path key: ${args.pathKey}`);
    console.log(active.paths[args.pathKey]);
    return;
  }
  if(args.json){console.log(JSON.stringify(active,null,2));return}
  console.log(`GRAHAM ACTIVE WEEK // ${active.season} W${active.weekToken} // ${active.paths.currentNumbers}`);
}

const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  try{main()}catch(err){console.error(`GRAHAM ACTIVE WEEK FAILED // ${err.message}`);process.exit(1)}
}
