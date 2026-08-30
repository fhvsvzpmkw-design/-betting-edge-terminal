#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_LEDGER='data/walters/nfl-power-ratings-ledger.json';

function parseArgs(argv){
  const out={sources:[]};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(key==='--dry-run'){out.dryRun=true;continue;}
    const value=argv[++i];
    if(value==null)throw new Error(`Missing value for ${key}`);
    if(key==='--team')out.team=value;
    else if(key==='--delta')out.delta=value;
    else if(key==='--reason')out.reason=value;
    else if(key==='--source')out.sources.push(value);
    else if(key==='--effective-at')out.effectiveAt=value;
    else if(key==='--confidence')out.confidence=value;
    else if(key==='--type')out.type=value;
    else if(key==='--ledger')out.ledger=value;
    else throw new Error(`Unknown argument: ${key}`);
  }
  return out;
}

function usage(){
  return [
    'Usage:',
    '  node tools/update-walters-power-rating.mjs --team BUF --delta 0.5 --reason "Verified personnel upgrade" --source "SOURCE REF" [--source "SECOND REF"] [--effective-at ISO] [--confidence HIGH] [--dry-run]',
    '',
    'Rules:',
    '  * Updates always start from currentRating; there is intentionally no --set option.',
    '  * seedRating is immutable and may never be reset or overwritten.',
    '  * Every update requires an explicit delta, reason, source reference and timestamp.',
    '  * The prior/current transition is appended to team.history before the ledger is written.'
  ].join('\n');
}

function main(){
  const args=parseArgs(process.argv.slice(2));
  if(!args.team||args.delta==null||!args.reason||!args.sources.length){
    throw new Error(`${usage()}\n\nMissing required --team, --delta, --reason or --source.`);
  }
  const delta=Number(args.delta);
  if(!Number.isFinite(delta))throw new Error('--delta must be a finite number');
  const effectiveAt=args.effectiveAt||new Date().toISOString();
  if(Number.isNaN(Date.parse(effectiveAt)))throw new Error('--effective-at must be a valid ISO date/time');
  const ledgerPath=path.resolve(args.ledger||DEFAULT_LEDGER);
  const ledger=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));
  if(ledger?.carryForwardPolicy?.seedResetAllowed!==false)throw new Error('Ledger carry-forward policy is missing seedResetAllowed=false');
  const key=String(args.team).trim().toLowerCase();
  const team=ledger.teams.find(t=>String(t.abbr).toLowerCase()===key||String(t.team).toLowerCase()===key);
  if(!team)throw new Error(`Unknown team: ${args.team}`);
  if(!Number.isFinite(team.seedRating)||!Number.isFinite(team.currentRating))throw new Error(`Invalid rating record for ${team.team}`);

  const immutableSeed=team.seedRating;
  const prior=team.currentRating;
  const next=Number((prior+delta).toFixed(3));
  const history=Array.isArray(team.history)?team.history:[];
  const sequence=history.length?Math.max(...history.map(h=>Number(h.sequence)||0))+1:1;
  const type=args.type||'CARRY_FORWARD';
  const event={
    sequence,
    type,
    fromRating:prior,
    delta,
    toRating:next,
    effectiveAt,
    reason:String(args.reason).trim(),
    sourceRefs:args.sources.map(String)
  };

  team.priorRating=prior;
  team.currentRating=next;
  team.lastDelta=delta;
  team.lastUpdatedAt=effectiveAt;
  team.lastUpdateType=type;
  if(args.confidence)team.confidence=String(args.confidence);
  team.sourceRefs=event.sourceRefs.slice();
  team.history=[...history,event];
  ledger.updatedAt=effectiveAt;

  if(team.seedRating!==immutableSeed)throw new Error('seedRating mutation detected');
  if(team.currentRating!==next||team.priorRating!==prior)throw new Error('carry-forward transition verification failed');

  const summary=`${team.abbr} ${prior} ${delta>=0?'+':''}${delta} -> ${next} // ${event.reason}`;
  if(args.dryRun){
    console.log(`DRY RUN // ${summary}`);
    return;
  }
  fs.writeFileSync(ledgerPath,`${JSON.stringify(ledger,null,2)}\n`);
  const verify=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));
  const verified=verify.teams.find(t=>t.abbr===team.abbr);
  const last=verified?.history?.at(-1);
  if(!verified||verified.seedRating!==immutableSeed||verified.priorRating!==prior||verified.currentRating!==next||last?.sequence!==sequence){
    throw new Error('Ledger write/read-back verification failed');
  }
  console.log(`UPDATED // ${summary}`);
}

try{main();}catch(err){console.error(`POWER RATING UPDATE FAILED // ${err.message}`);process.exit(1);}
