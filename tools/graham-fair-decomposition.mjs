#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const POLICY_ID='graham-fair-decomposition-v1';
export const POLICY_PATH='data/walters/nfl/graham-fair-decomposition-policy-v1.json';
const TOL=0.0005;
const round=(n,d=3)=>Number(Number(n).toFixed(d));
export const roundHalf=n=>Math.round((Number(n)+Number.EPSILON)*2)/2;
const finite=v=>Number.isFinite(Number(v));
const num=(v,label)=>{if(!finite(v))throw new Error(`GRAHAM_FAIR_DECOMPOSITION_MISSING:${label}`);return Number(v);};
const close=(a,b)=>Math.abs(Number(a)-Number(b))<=TOL;
const fmt=(n,d=3)=>`${Number(n)>=0?'+':''}${Number(n).toFixed(d)}`;
const fmtDisplay=n=>`${Number(n)>=0?'+':''}${Number(n).toFixed(1)}`;

function loadPolicy(root=process.cwd()){
  const p=path.join(root,POLICY_PATH);
  if(!fs.existsSync(p))throw new Error('GRAHAM_FAIR_DECOMPOSITION_POLICY_MISSING');
  const policy=JSON.parse(fs.readFileSync(p,'utf8'));
  if(policy.schema!==1||policy.policyId!==POLICY_ID||policy.state!=='OPERATIONAL'||policy.marketViewed!==false)throw new Error('GRAHAM_FAIR_DECOMPOSITION_POLICY_INVALID');
  return policy;
}

function sumAdjustments(adjustments,types){
  const set=new Set(types||[]);
  return round((adjustments||[]).filter(a=>set.has(String(a?.type||''))&&finite(a?.pointsToHomeSpread)).reduce((s,a)=>s+Number(a.pointsToHomeSpread),0));
}

function classifiedTypeSets(policy){
  return {
    home:new Set(policy.adjustmentClassification?.homeFieldTypes||[]),
    personnel:new Set(policy.adjustmentClassification?.personnelTypes||[]),
    matchup:new Set(policy.adjustmentClassification?.matchupTypes||[])
  };
}

export function deriveGrahamFairDecomposition(game,policy){
  if(!game?.gameKey)throw new Error('GRAHAM_FAIR_DECOMPOSITION_GAME_KEY_MISSING');
  const neutral=num(game.neutralBaseHome,`${game.gameKey}:neutralBaseHome`);
  const storedExact=num(game.grahamExactFairHome,`${game.gameKey}:grahamExactFairHome`);
  const storedDisplay=num(game.grahamFairHome,`${game.gameKey}:grahamFairHome`);
  const adjustments=Array.isArray(game.adjustments)?game.adjustments:[];
  const sets=classifiedTypeSets(policy);

  const locationAdjustments=adjustments.filter(a=>sets.home.has(String(a?.type||''))&&finite(a?.pointsToHomeSpread));
  const locationSum=round(locationAdjustments.reduce((s,a)=>s+Number(a.pointsToHomeSpread),0));
  const homeField=finite(game.homeFieldPointsToHomeSpread)?Number(game.homeFieldPointsToHomeSpread):locationSum;
  if(locationAdjustments.length&& !close(homeField,locationSum))throw new Error(`GRAHAM_FAIR_HOME_FIELD_COMPONENT_MISMATCH:${game.gameKey}:${homeField}:${locationSum}`);

  const personnelAdjustments=adjustments.filter(a=>sets.personnel.has(String(a?.type||''))&&finite(a?.pointsToHomeSpread));
  const personnelSum=round(personnelAdjustments.reduce((s,a)=>s+Number(a.pointsToHomeSpread),0));
  const personnel=finite(game.personnelOverlayPointsToHomeSpread)?Number(game.personnelOverlayPointsToHomeSpread):personnelSum;
  if(personnelAdjustments.length&& !close(personnel,personnelSum))throw new Error(`GRAHAM_FAIR_PERSONNEL_COMPONENT_MISMATCH:${game.gameKey}:${personnel}:${personnelSum}`);

  const matchupAdjustments=adjustments.filter(a=>sets.matchup.has(String(a?.type||''))&&finite(a?.pointsToHomeSpread));
  const matchupSum=round(matchupAdjustments.reduce((s,a)=>s+Number(a.pointsToHomeSpread),0));
  const matchup=finite(game.matchupOverlayPointsToHomeSpread)?Number(game.matchupOverlayPointsToHomeSpread):matchupSum;
  if(matchupAdjustments.length&& !close(matchup,matchupSum))throw new Error(`GRAHAM_FAIR_MATCHUP_COMPONENT_MISMATCH:${game.gameKey}:${matchup}:${matchupSum}`);

  const other=round(adjustments.filter(a=>{
    const t=String(a?.type||'');
    return finite(a?.pointsToHomeSpread)&&!sets.home.has(t)&&!sets.personnel.has(t)&&!sets.matchup.has(t);
  }).reduce((s,a)=>s+Number(a.pointsToHomeSpread),0));

  const prePersonnel=round(neutral+homeField+other+matchup,3);
  const computedExact=round(neutral+homeField+personnel+matchup+other,3);
  const computedDisplay=roundHalf(computedExact);
  if(!close(storedExact,computedExact))throw new Error(`GRAHAM_FAIR_EXACT_MISMATCH:${game.gameKey}:stored=${storedExact}:computed=${computedExact}`);
  if(!close(storedDisplay,computedDisplay))throw new Error(`GRAHAM_FAIR_DISPLAY_MISMATCH:${game.gameKey}:stored=${storedDisplay}:computed=${computedDisplay}`);

  return {
    schema:1,
    policyId:POLICY_ID,
    neutralTeamBaseHome:round(neutral),
    homeFieldPointsToHomeSpread:round(homeField),
    otherGovernedPointsToHomeSpread:round(other),
    prePersonnelExactFairHome:prePersonnel,
    personnelPointsToHomeSpread:round(personnel),
    matchupPointsToHomeSpread:round(matchup),
    exactFairHome:computedExact,
    displayedFairHome:computedDisplay,
    arithmeticVerified:true
  };
}

export function formatGrahamFairSummary(d){
  return `Governed fair decomposition: neutral/team base ${fmt(d.neutralTeamBaseHome)}; home field ${fmt(d.homeFieldPointsToHomeSpread)}; other governed ${fmt(d.otherGovernedPointsToHomeSpread)}; pre-personnel exact ${fmt(d.prePersonnelExactFairHome)}; personnel ${fmt(d.personnelPointsToHomeSpread)}; matchup ${fmt(d.matchupPointsToHomeSpread)}; exact Graham home fair ${fmt(d.exactFairHome)}; displayed ${fmtDisplay(d.displayedFairHome)}.`;
}

function sameJson(a,b){return JSON.stringify(a)===JSON.stringify(b);}

export function synchronizeGrahamFairBoard(board,{write=false,policy}={}){
  if(!board||!Array.isArray(board.games))throw new Error('GRAHAM_FAIR_BOARD_INVALID');
  const activePolicy=policy||loadPolicy();
  let changed=0;
  for(const game of board.games){
    const decomposition=deriveGrahamFairDecomposition(game,activePolicy);
    const summary=formatGrahamFairSummary(decomposition);
    if(write){
      if(!sameJson(game.fairDecomposition,decomposition)||game.researchSummary!==summary)changed++;
      game.fairDecomposition=decomposition;
      game.researchSummary=summary;
    }else{
      if(!sameJson(game.fairDecomposition,decomposition))throw new Error(`GRAHAM_FAIR_DECOMPOSITION_STALE:${game.gameKey}`);
      if(game.researchSummary!==summary)throw new Error(`GRAHAM_FAIR_SUMMARY_STALE:${game.gameKey}`);
    }
  }
  if(write){
    board.fairDecompositionPolicyId=POLICY_ID;
    board.fairExplanationState='SYNCHRONIZED';
  }else{
    if(board.fairDecompositionPolicyId!==POLICY_ID||board.fairExplanationState!=='SYNCHRONIZED')throw new Error('GRAHAM_FAIR_BOARD_POLICY_STATE_STALE');
  }
  return {changed,games:board.games.length,policyId:POLICY_ID};
}

function parseArgs(argv){
  const out={write:false,path:null};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--write')out.write=true;
    else if(argv[i]==='--path')out.path=argv[++i];
    else throw new Error(`UNKNOWN_ARG:${argv[i]}`);
  }
  return out;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const args=parseArgs(process.argv.slice(2));
  if(!args.path)throw new Error('USAGE: node tools/graham-fair-decomposition.mjs --path <current-numbers.json> [--write]');
  const root=process.cwd();
  const policy=loadPolicy(root);
  const target=path.resolve(root,args.path);
  const board=JSON.parse(fs.readFileSync(target,'utf8'));
  const before=JSON.stringify((board.games||[]).map(g=>({gameKey:g.gameKey,grahamExactFairHome:g.grahamExactFairHome,grahamFairHome:g.grahamFairHome})));
  const result=synchronizeGrahamFairBoard(board,{write:args.write,policy});
  const after=JSON.stringify((board.games||[]).map(g=>({gameKey:g.gameKey,grahamExactFairHome:g.grahamExactFairHome,grahamFairHome:g.grahamFairHome})));
  if(before!==after)throw new Error('GRAHAM_FAIR_SYNC_ATTEMPTED_NUMERIC_MUTATION');
  if(args.write)fs.writeFileSync(target,JSON.stringify(board,null,2)+'\n');
  console.log(`GRAHAM FAIR DECOMPOSITION: PASS // ${result.games} GAMES // ${args.write?`${result.changed} EXPLANATIONS SYNCHRONIZED`:'READBACK VERIFIED'} // POLICY ${result.policyId} // NUMERIC FAIRS UNCHANGED`);
}
