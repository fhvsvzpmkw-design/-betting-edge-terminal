#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_LEDGER='data/walters/nfl/2026/week-01-daily-market-ledger.json';

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

  const ledgerPath=path.resolve(args.ledger||DEFAULT_LEDGER);
  const ledger=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));
  if(ledger?.capturePolicy?.immutabilityRule==null)throw new Error('Ledger append-only policy missing');
  const key=String(args.game).trim().toUpperCase().replace(/^2026-W01-/,'');
  const game=ledger.games.find(g=>g.gameKey.toUpperCase()===`2026-W01-${key}`||`${g.away}-${g.home}`===key);
  if(!game)throw new Error(`Unknown Week 1 game: ${args.game}`);
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
  if(args.dryRun){console.log(`DRY RUN // ${summary}`);return;}
  fs.writeFileSync(ledgerPath,`${JSON.stringify(ledger,null,2)}\n`);
  const verify=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));
  const vgame=verify.games.find(g=>g.gameKey===game.gameKey);
  const last=vgame?.dailySnapshots?.at(-1);
  if(!last||last.sequence!==sequence||last.grahamFairHome!==graham||last.pinnacleSpreadHome!==pinnacle||last.grahamHomeStrengthGap!==gap){
    throw new Error('Daily comparison write/read-back verification failed');
  }
  console.log(`RECORDED // ${summary}`);
}

try{main();}catch(err){console.error(`PINNACLE COMPARISON FAILED // ${err.message}`);process.exit(1);}
