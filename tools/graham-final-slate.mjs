import fs from 'node:fs';
import path from 'node:path';

// A timestamp or a Tuesday is not evidence that a slate finished.
export function verifyFinalSlate({board, facts, effectiveAt}) {
  const invalid = reason => ({state:'UNVERIFIED', reason, gamesVerified:0, gamesExpected:board.games?.length||0});
  if(facts?.schema!==1 || facts.season!==board.season || facts.marketViewed!==false ||
      !Number.isFinite(Date.parse(facts.verifiedAt)) || Date.parse(facts.verifiedAt)>Date.parse(effectiveAt)) return invalid('FINAL_SOURCE_IDENTITY_OR_TIME');
  const rows=facts.weeks?.find(w=>w.week===board.week)?.games;
  if(!Array.isArray(rows)||!board.games?.length||rows.length!==board.games.length||new Set(rows.map(g=>g.gameKey)).size!==rows.length) return invalid('EXACT_FINAL_SLATE_REQUIRED');
  for(const game of board.games){
    const row=rows.find(r=>r.gameKey===game.gameKey);
    if(!row||row.away!==game.away||row.home!==game.home||row.state!=='FINAL'||
        ![row.awayScore,row.homeScore].every(n=>Number.isInteger(n)&&n>=0)||
        !/^https:\/\//.test(row.sourceUrl||'')||!Number.isFinite(Date.parse(game.startTimePacific))||
        Date.parse(game.startTimePacific)>=Date.parse(facts.verifiedAt)) return invalid('FINAL_GAME_IDENTITY_OR_SOURCE:'+game.gameKey);
  }
  return {state:'COMPLETE',gamesVerified:rows.length,gamesExpected:rows.length,verifiedAt:facts.verifiedAt};
}

export function loadFinalSlate({root=process.cwd(),board,effectiveAt=new Date().toISOString()}){
  const directory=path.join(root,'data/walters/nfl',String(board.season));
  const prefix=`week-${String(board.week).padStart(2,'0')}-final-facts-`;
  const candidates=[];
  if(fs.existsSync(directory)) for(const name of fs.readdirSync(directory).filter(n=>n.startsWith(prefix)&&n.endsWith('.json'))){
    const relative=path.relative(root,path.join(directory,name)).replaceAll(path.sep,'/');
    const facts=JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));
    candidates.push({...verifyFinalSlate({board,facts,effectiveAt}),path:relative});
  }
  candidates.sort((a,b)=>Date.parse(b.verifiedAt||0)-Date.parse(a.verifiedAt||0));
  return candidates.find(c=>c.state==='COMPLETE')||candidates[0]||{state:'UNVERIFIED',reason:'FINAL_FACTS_NOT_RECORDED',gamesVerified:0,gamesExpected:board.games?.length||0};
}
