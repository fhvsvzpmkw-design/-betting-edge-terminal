#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

function parseArgs(argv){
  const out={sources:[]};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(key==='--dry-run'){out.dryRun=true;continue;}
    const value=argv[++i];
    if(value==null)throw new Error(`Missing value for ${key}`);
    if(key==='--game')out.game=value;
    else if(key==='--graham')out.graham=value;
    else if(key==='--graham-as-of')out.grahamAsOf=value;
    else if(key==='--pinnacle')out.pinnacle=value;
    else if(key==='--pinnacle-price')out.pinnaclePrice=value;
    else if(key==='--pinnacle-status')out.pinnacleStatus=value;
    else if(key==='--observed-at')out.observedAt=value;
    else if(key==='--captured-at')out.capturedAt=value;
    else if(key==='--review-date')out.reviewDate=value;
    else if(key==='--source')out.sources.push(value);
    else if(key==='--type')out.type=value;
    else if(key==='--note')out.note=value;
    else if(key==='--ledger')out.ledger=value;
    else throw new Error(`Unknown argument: ${key}`);
  }
  return out;
}

function usage(){
  return [
    'Usage:',
    '  node tools/record-walters-pinnacle-comparison.mjs --game BUF-HOU --graham -5.5 --graham-as-of ISO --pinnacle -4.5 --observed-at ISO --source "OddsPapi Pinnacle" [--pinnacle-price -110] [--review-date YYYY-MM-DD] [--captured-at ISO] [--type DAILY] [--note TEXT] [--dry-run]',
    '',
    'Unavailable Pinnacle:',
    '  use --pinnacle-status PINNACLE_UNAVAILABLE and omit --pinnacle; a null market observation is appended rather than substituting another book.',
    '',
    'Rules:',
    '  * The default ledger is resolved from data/walters/nfl/active-week.json.',
    '  * Graham fair must already be complete before recording the market comparison.',
    '  * Daily snapshots are append-only; this tool never replaces an earlier observation.',
    '  * Positive grahamHomeStrengthGap means Graham rates the home team stronger than Pinnacle.'
  ].join('\n');
}

const finite=(v)=>Number.isFinite(Number(v));

function main(){
  const args=parseArgs(process.argv.slice(2));
  if(!args.game||args.graham==null||!args.grahamAsOf||!args.sources.length){
    throw new Error(`${usage()}\n\nMissing required --game, --graham, --graham-as-of or --source.`);
  }
  const graham=Number(args.graham);
  if(!Number.isFinite(graham))throw new Error('--graham must be a finite number');
  if(Number.isNaN(Date.parse(args.grahamAsOf)))throw new Error('--graham-as-of must be a valid ISO date/time');

  const status=args.pinnacleStatus||'AVAILABLE';
  const allowedStatuses=new Set(['AVAILABLE','PINNACLE_UNAVAILABLE','SUSPENDED']);
  if(!allowedStatuses.has(status))throw new Error(`Unsupported --pinnacle-status: ${status}`);
  let pinnacle=null;
  if(status==='AVAILABLE'){
    if(args.pinnacle==null||!finite(args.pinnacle))throw new Error('AVAILABLE Pinnacle snapshot requires finite --pinnacle');
    pinnacle=Number(args.pinnacle);
    if(!args.observedAt||Number.isNaN(Date.parse(args.observedAt)))throw new Error('AVAILABLE Pinnacle snapshot requires valid --observed-at');
  }else if(args.pinnacle!=null){
    throw new Error('Do not supply --pinnacle when Pinnacle is unavailable or suspended');
  }

  const capturedAt=args.capturedAt||new Date().toISOString();
  if(Number.isNaN(Date.parse(capturedAt)))throw new Error('--captured-at must be a valid ISO date/time');
  const reviewDate=args.reviewDate||capturedAt.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(reviewDate))throw new Error('--review-date must be YYYY-MM-DD');
  const type=args.type||'DAILY';
  const allowedTypes=new Set(['DAILY','GAME_DAY','CLOSE','BACKFILL','CORRECTION']);
  if(!allowedTypes.has(type))throw new Error(`Unsupported --type: ${type}`);

  const active=args.ledger?null:resolveGrahamActiveWeek();
  const ledgerPath=path.resolve(args.ledger||active.paths.dailyMarketLedger);
  const ledger=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));
  if(ledger?.capturePolicy?.immutabilityRule==null)throw new Error('Ledger append-only policy missing');
  if(active&&(Number(ledger.season)!==active.season||Number(ledger.week)!==active.week))throw new Error('Default comparison ledger does not match active Graham week');

  const key=String(args.game).trim().toUpperCase();
  const game=(ledger.games||[]).find(g=>{
    const full=String(g.gameKey||'').toUpperCase();
    const short=`${String(g.away||'').toUpperCase()}-${String(g.home||'').toUpperCase()}`;
    return full===key||short===key||full.endsWith(`-${key}`);
  });
  if(!game)throw new Error(`Unknown game in ${ledger.season} Week ${ledger.week}: ${args.game}`);
  const kick=Date.parse(game.startTimePacific);
  if(!Number.isNaN(kick)&&Date.parse(capturedAt)>=kick&&type!=='CORRECTION'){
    throw new Error('Ordinary comparison capture must be timestamped before kickoff');
  }

  const history=Array.isArray(game.dailySnapshots)?game.dailySnapshots:[];
  const sequence=history.length?Math.max(...history.map(s=>Number(s.sequence)||0))+1:1;
  const gap=pinnacle==null?null:Number((pinnacle-graham).toFixed(3));
  const snapshot={
    sequence,
    type,
    reviewDate,
    capturedAt,
    grahamFairHome:graham,
    grahamAsOf:args.grahamAsOf,
    pinnacleSpreadHome:pinnacle,
    pinnaclePriceHome:args.pinnaclePrice==null?null:Number(args.pinnaclePrice),
    pinnacleObservedAt:args.observedAt||null,
    pinnacleStatus:status,
    sourceRefs:args.sources.map(String),
    grahamHomeStrengthGap:gap,
    note:args.note||null
  };
  if(args.pinnaclePrice!=null&&!Number.isFinite(snapshot.pinnaclePriceHome))throw new Error('--pinnacle-price must be numeric');

  game.dailySnapshots=[...history,snapshot];
  ledger.updatedAt=capturedAt;
  ledger.state='DAILY_CAPTURE_ACTIVE';

  const summary=`${game.away}@${game.home} // Graham ${graham} // Pinnacle ${pinnacle==null?status:pinnacle} // gap ${gap==null?'n/a':gap}`;
  if(args.dryRun){console.log(`DRY RUN // ${ledger.season} W${String(ledger.week).padStart(2,'0')} // ${summary}`);return;}
  fs.writeFileSync(ledgerPath,`${JSON.stringify(ledger,null,2)}\n`);
  const verify=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));
  const vgame=verify.games.find(g=>g.gameKey===game.gameKey);
  const last=vgame?.dailySnapshots?.at(-1);
  if(!last||last.sequence!==sequence||last.grahamFairHome!==graham||last.pinnacleSpreadHome!==pinnacle||last.grahamHomeStrengthGap!==gap){
    throw new Error('Daily comparison write/read-back verification failed');
  }
  console.log(`RECORDED // ${verify.season} W${String(verify.week).padStart(2,'0')} // ${summary}`);
}

try{main();}catch(err){console.error(`PINNACLE COMPARISON FAILED // ${err.message}`);process.exit(1);}
