#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

// The customer terminal mixes independent numbers and sportsbook comparisons.
// Keep its bytes in code; neither source objects nor mismatch values may be
// logged. Construct output explicitly so future/nested market fields stay out.
const FEED='graham-mercer-nfl-current-week-terminal-v1';
const ARRAYS=['personnelEstimateCases','personnelUnresolvedCases',
  'personnelBlockedGroups','qbPerformanceFailClosedTeams','qbPriorEstimateTeams',
  'qbPriorEstimates'];
class ReadbackError extends Error {
  constructor(code){super(code);this.code=code;}
}
const fail=code=>{throw new ReadbackError(code);};
function timestamp(value,code,{nullable=false}={}){
  if(nullable&&value===null)return null;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))fail(code);
  return value;
}
function gameIdentity(game,active){
  if(!game||!/^\d{4}-W\d{2}-[A-Z]{2,3}-[A-Z]{2,3}$/.test(game.gameKey)||
    !/^[A-Z]{2,3}$/.test(game.away)||!/^[A-Z]{2,3}$/.test(game.home)||
    game.away===game.home||game.gameKey!==`${active.season}-W${String(active.week).padStart(2,'0')}-${game.away}-${game.home}`)fail('INVALID_GAME_IDENTITY');
}
function verifyTerminal({active,board,terminal,scope}){
  if(terminal?.schema!==1||terminal.feedId!==FEED||terminal.season!==active.season||
    terminal.week!==active.week||terminal.activeWeek?.season!==active.season||
    terminal.activeWeek?.week!==active.week||terminal.activeWeek?.authority!=='GRAHAM_WEEK_ROLLOVER')fail(`${scope}_ACTIVE_WEEK_MISMATCH`);
  if(terminal.state!==board.state||terminal.baselineStatus!==board.baselineStatus)fail(`${scope}_BOARD_STATE_MISMATCH`);
  const generatedAt=timestamp(terminal.generatedAt,`${scope}_INVALID_GENERATION`);
  const lastResearchAt=timestamp(terminal.lastResearchAt??null,`${scope}_INVALID_RESEARCH_TIME`,{nullable:true});
  if(lastResearchAt&&Date.parse(generatedAt)<Date.parse(lastResearchAt))fail(`${scope}_STALE_RESEARCH_PUBLICATION`);
  if(!Array.isArray(terminal.games)||terminal.games.length!==board.games.length)fail(`${scope}_GAME_COUNT_MISMATCH`);
  const byKey=new Map();
  for(const game of terminal.games){
    gameIdentity(game,active);
    if(byKey.has(game.gameKey))fail(`${scope}_DUPLICATE_GAME`);
    byKey.set(game.gameKey,game);
  }
  for(const expected of board.games){
    const actual=byKey.get(expected.gameKey);
    if(!actual)fail(`${scope}_MISSING_GAME`);
    for(const key of ['away','home','startTimePacific','grahamFairHome']){
      if(actual[key]!==expected[key])fail(`${scope}_GAME_${key.toUpperCase()}_MISMATCH`);
    }
    if(actual.grahamAsOf!==(expected.grahamAsOf||null))fail(`${scope}_GAME_ASOF_MISMATCH`);
    if(actual.numberStatus!==(expected.numberStatus||'PENDING')||
      actual.informationStatus!==(expected.informationStatus||'PENDING'))fail(`${scope}_GAME_STATUS_MISMATCH`);
    for(const key of ARRAYS){
      if(!isDeepStrictEqual(actual[key],expected[key]||[]))fail(`${scope}_GAME_${key.toUpperCase()}_MISMATCH`);
    }
    if(expected.grahamAsOf&&Date.parse(generatedAt)<Date.parse(expected.grahamAsOf))fail(`${scope}_STALE_NUMBER_PUBLICATION`);
  }
  return {generatedAt,lastResearchAt};
}

export function verifyGrahamIndependentReadback({active,board,terminal,deployedTerminal}){
  if(active?.manifest?.authority!=='GRAHAM_WEEK_ROLLOVER'||active.manifest.state!=='ACTIVE'||
    !Number.isInteger(active.season)||!Number.isInteger(active.week)||
    board?.season!==active.season||board.week!==active.week||
    !Array.isArray(board.games)||!board.games.length)fail('ACTIVE_BOARD_IDENTITY');
  const seen=new Set();
  for(const game of board.games){
    gameIdentity(game,active);
    if(seen.has(game.gameKey))fail('DUPLICATE_BOARD_GAME');
    seen.add(game.gameKey);
    if(game.grahamFairHome!==null&&!Number.isFinite(game.grahamFairHome))fail('INVALID_BOARD_FAIR');
    timestamp(game.startTimePacific,'INVALID_BOARD_KICKOFF');
    timestamp(game.grahamAsOf||null,'INVALID_BOARD_ASOF',{nullable:true});
    for(const key of ARRAYS)if(game[key]!=null&&!Array.isArray(game[key]))fail('INVALID_BOARD_CASE_ARRAY');
    for(const team of game.qbPerformanceFailClosedTeams||[])if(!/^[A-Z]{2,3}$/.test(team))fail('INVALID_QB_TEAM');
  }
  const repo=verifyTerminal({active,board,terminal,scope:'REPOSITORY'});
  const deployed=deployedTerminal===undefined?null:verifyTerminal({active,board,terminal:deployedTerminal,scope:'DEPLOYED'});
  if(deployed&&deployed.lastResearchAt!==repo.lastResearchAt)fail('DEPLOYED_RESEARCH_TIME_MISMATCH');
  return {
    schema:1,verificationScope:'INDEPENDENT_PUBLICATION_FIELDS_ONLY',
    season:active.season,week:active.week,repositoryReadback:'VERIFIED',
    deployedReadback:deployed?'VERIFIED':'NOT_CHECKED',
    repositoryGeneratedAt:repo.generatedAt,deployedGeneratedAt:deployed?.generatedAt??null,
    lastResearchAt:repo.lastResearchAt,marketFieldsExposed:false,
    // A successful readback does not certify football research or input readiness.
    games:board.games.map(game=>({gameKey:game.gameKey,away:game.away,home:game.home,
      startTimePacific:game.startTimePacific,grahamFairHome:game.grahamFairHome,
      grahamAsOf:game.grahamAsOf||null,
      personnelUnresolvedCount:(game.personnelUnresolvedCases||[]).length,
      personnelBlockedGroupCount:(game.personnelBlockedGroups||[]).length,
      personnelEstimateCount:(game.personnelEstimateCases||[]).length,
      qbBlockedTeams:[...(game.qbPerformanceFailClosedTeams||[])]}))
  };
}

async function main(argv){
  const args={root:process.cwd()};
  for(let i=0;i<argv.length;i++){
    const key={'--root':'root','--terminal':'terminal','--deployed-file':'deployedFile','--deployed-url':'deployedUrl'}[argv[i]];
    if(!key||!argv[i+1]||argv[i+1].startsWith('--')||args[key]!==undefined&&key!=='root')fail('INVALID_ARGUMENT');
    args[key]=argv[++i];
  }
  if(args.deployedFile&&args.deployedUrl)fail('AMBIGUOUS_DEPLOYED_INPUT');
  const root=path.resolve(args.root),read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
  // No daily-market ledger, odds feed or observer is needed by this resolver.
  const active=resolveGrahamActiveWeek({root,requireFiles:false});
  const board=read(path.join(root,active.paths.currentNumbers));
  const terminal=read(args.terminal?path.resolve(args.terminal):path.join(root,'data/walters/nfl/current-week-terminal.json'));
  let deployedTerminal;
  if(args.deployedFile)deployedTerminal=read(path.resolve(args.deployedFile));
  if(args.deployedUrl){
    const url=new URL(args.deployedUrl);
    if(url.protocol!=='https:'||url.username||url.password)fail('INVALID_DEPLOYED_URL');
    url.searchParams.set('grahamReadback',Date.now().toString());
    const response=await fetch(url,{cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});
    if(!response.ok)fail('DEPLOYED_FETCH_FAILED');
    deployedTerminal=await response.json();
  }
  console.log(JSON.stringify(verifyGrahamIndependentReadback({active,board,terminal,deployedTerminal}),null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main(process.argv.slice(2)).catch(error=>{
    // Never echo a response body, source object, price, or untrusted error text.
    console.error(`GRAHAM INDEPENDENT READBACK FAILED // ${error instanceof ReadbackError?error.code:'READBACK_INPUT_UNAVAILABLE'}`);
    process.exitCode=1;
  });
}
