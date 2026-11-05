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

export function weeklyReceiptsBySourceWeek(power, season) {
  const receipts = new Map();
  const pending = power.weekly90_10 ? [power.weekly90_10] : [];
  while (pending.length) {
    const receipt = pending.shift();
    if (!receipt) continue;
    if ((receipt.season ?? power.season ?? season) === season && !receipts.has(receipt.sourceWeek)) {
      receipts.set(receipt.sourceWeek, receipt);
    }
    if (Array.isArray(receipt.previousReceipts)) pending.push(...receipt.previousReceipts);
  }
  return receipts;
}

function validWeeklyReceipt(receipt, sourceWeek) {
  if (!receipt || receipt.sourceWeek !== sourceWeek || receipt.targetWeek !== sourceWeek + 1 ||
      receipt.marketViewed !== false || !Number.isInteger(receipt.gamesProcessed) ||
      receipt.gamesProcessed < 1 || receipt.gamesProcessed > 16 || !Number.isInteger(receipt.gamesUpdated) ||
      receipt.gamesUpdated < 0 || receipt.teamsUpdated !== receipt.gamesUpdated * 2 ||
      !Array.isArray(receipt.blockedGames) || receipt.gamesUpdated + receipt.blockedGames.length !== receipt.gamesProcessed ||
      receipt.state !== (receipt.blockedGames.length ? 'PARTIAL_BLOCKED' : 'COMPLETE')) return false;
  const teams = receipt.blockedGames.flatMap(game => [game.away, game.home]);
  return teams.every(team => typeof team === 'string' && team.length > 0) && new Set(teams).size === teams.length;
}

export function weeklyLearningSourceWeek(active, power, receipts = weeklyReceiptsBySourceWeek(power, active.season)) {
  if (active.week < 2) return null;
  const latest = power.weekly90_10;
  const start = power.weeklyLearningStart?.season === active.season ?
    power.weeklyLearningStart.sourceWeek :
    latest && (latest.season ?? power.season ?? active.season) === active.season ? latest.sourceWeek : 1;
  if (!Number.isInteger(start) || start < 1 || start >= active.week) throw Error('WEEKLY_LEARNING_CURSOR_INVALID');
  for (let week = start; week < active.week - 1; week++) {
    const receipt = receipts.get(week);
    if (!validWeeklyReceipt(receipt, week) || receipt.state !== 'COMPLETE') return week;
  }
  return active.week - 1;
}

export function weeklyGameDependencyWeeks(receipts, oldest, sourceWeek, game) {
  const blocking = [];
  for (let week = oldest; week < sourceWeek; week++) {
    const receipt = receipts.get(week);
    if (!validWeeklyReceipt(receipt, week) || receipt.blockedGames.some(pair =>
      [pair.away, pair.home].includes(game.away) || [pair.away, pair.home].includes(game.home))) blocking.push(week);
  }
  return blocking;
}

// Resolve the oldest pending completed-game work before opening dated recovery material.
// This is read-only discovery: it neither validates numerical inputs nor authorizes a write.
export function weeklyRecoveryContext({root=process.cwd(),manifestPath=null,sourceWeek:requestedSourceWeek=null}={}) {
  const list=x=>Array.isArray(x)?x:[];
  const fail=message=>{throw Error(message);};
  const active=resolveGrahamActiveWeek({root,manifestPath});
  const base={schema:1,season:active.season,activeWeek:active.week,marketViewed:false,
    activeManifestPath:active.manifestPath,currentWeekPaths:active.paths,
    initialBaselineOwner:'TUESDAY_BASELINE',
    baselineRule:'An initial current-week baseline is required independently of new 90/10 updates. A later rating change requires a separate governed refresh.'};
  if(active.week===1)return {...base,state:'NOT_APPLICABLE',sourceWeek:null,targetWeek:null,evidencePathsNewestFirst:[]};
  const read=relative=>JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));
  const power=read('data/walters/nfl-power-ratings-ledger.json');
  if(power.season!==active.season)fail('RECOVERY_RATING_SEASON_IDENTITY');
  const receipts=weeklyReceiptsBySourceWeek(power,active.season);
  const oldestSourceWeek=weeklyLearningSourceWeek(active,power,receipts);
  const sourceWeek=requestedSourceWeek??oldestSourceWeek,targetWeek=sourceWeek+1;
  if(!Number.isInteger(sourceWeek)||sourceWeek<oldestSourceWeek||sourceWeek>=active.week)fail('RECOVERY_SOURCE_WEEK_OUTSIDE_WINDOW');
  const prior=grahamWeekPaths(active.season,sourceWeek,{root});
  const priorBoard=read(prior.relative.currentNumbers);
  if(priorBoard.season!==active.season||priorBoard.week!==sourceWeek)fail('RECOVERY_PRIOR_WEEK_IDENTITY');
  const receipt=receipts.get(sourceWeek)??null;
  const matches=receipt&&receipt.sourceWeek===sourceWeek&&receipt.targetWeek===targetWeek&&
    (receipt.season==null||receipt.season===active.season);
  const summarize=x=>({season:x.season??power.season,sourceWeek:x.sourceWeek,targetWeek:x.targetWeek,
    state:x.state,gamesUpdated:x.gamesUpdated??null,teamsUpdated:x.teamsUpdated??null,
    blockedGameKeys:list(x.blockedGames).map(g=>g.gameKey)});
  const directory=`data/walters/nfl/${active.season}/${prior.weekTag}-weekly-evidence`;
  const bundles=[],discoveryErrors=[];
  if(fs.existsSync(path.join(root,directory))){
    for(const name of fs.readdirSync(path.join(root,directory)).sort()){
      if(!name.endsWith('.json'))continue;
      const relative=directory+'/'+name;
      try{
        const b=read(relative);
        // Adjacent source captures are not evaluator bundles. Never select them as one.
        if(b.schema!==1||!Array.isArray(b.games))continue;
        if(b.season!==active.season||b.sourceWeek!==sourceWeek||b.marketViewed!==false||
          !Number.isFinite(Date.parse(b.recordedAt)))throw Error('RECOVERY_BUNDLE_IDENTITY_OR_TIME');
        bundles.push({path:relative,recordedAt:b.recordedAt});
      }catch(e){discoveryErrors.push({path:relative,reason:e.message});}
    }
  }
  bundles.sort((a,b)=>Date.parse(b.recordedAt)-Date.parse(a.recordedAt)||a.path.localeCompare(b.path));
  return {...base,state:discoveryErrors.length?'EVIDENCE_DISCOVERY_BLOCKED':'CONTEXT_RESOLVED',sourceWeek,targetWeek,oldestSourceWeek,
    independentGames:priorBoard.games?.filter(game=>!weeklyGameDependencyWeeks(receipts,oldestSourceWeek,sourceWeek,game).length).map(game=>game.gameKey)??[],
    priorWeekPaths:prior.relative,receiptState:matches?receipt.state:'MISSING_MATCHING_RECEIPT',
    currentReceipt:matches?summarize(receipt):null,
    olderUnresolvedReceipts:[...receipts.values()].filter(x=>x.sourceWeek<sourceWeek&&x.state==='PARTIAL_BLOCKED').map(summarize),
    evidenceDirectory:directory,evidencePathsNewestFirst:bundles.map(b=>b.path),discoveryErrors,
    evidenceRule:'Reuse additive evidence for this source week. Older archived exceptions remain visible for governed correction. Discovery identifies work for the existing numerical validator.'};
}

function parseCli(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a==='--weekly-recovery-context'){out.weeklyRecovery=true;continue}
    if(a==='--source-week'){out.sourceWeek=int(argv[++i]);if(out.sourceWeek===null)throw Error('Invalid source week');continue}
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
  if(args.weeklyRecovery){
    if(args.requireFiles===false||args.previewWeek!=null||args.previewSeason!=null||args.pathKey)throw Error('Weekly recovery context requires validated active files and cannot be combined with preview/path');
    const context=weeklyRecoveryContext({manifestPath:args.manifestPath,sourceWeek:args.sourceWeek});
    console.log(JSON.stringify(context,null,2));
    if(context.state==='EVIDENCE_DISCOVERY_BLOCKED')process.exitCode=1;
    return;
  }
  if(args.sourceWeek!=null)throw Error('--source-week requires --weekly-recovery-context');
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
