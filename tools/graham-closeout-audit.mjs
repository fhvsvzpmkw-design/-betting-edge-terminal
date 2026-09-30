#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const list=x=>Array.isArray(x)?x:[], close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-8;
const fail=code=>{throw Error('GRAHAM_CLOSEOUT:'+code);};
export function auditCloseout({facts,boards,power}) {
  if(facts.schema!==1||facts.marketViewed!==false||!Number.isFinite(Date.parse(facts.verifiedAt)))fail('VERIFIED_FINAL_FACT_PACKET_REQUIRED');
  const receipts=[];const visit=r=>{if(r){receipts.push(r);list(r.previousReceipts).forEach(visit);}};visit(power.weekly90_10);
  const games=[],issues=[];
  for(const board of boards) {
    const finals=list(facts.weeks.find(w=>w.week===board.week)?.games);
    if(finals.length!==board.games.length||new Set(finals.map(g=>g.gameKey)).size!==finals.length)fail('EXACT_WEEK_COVERAGE_REQUIRED:'+board.week);
    for(const game of board.games) {
      const final=finals.find(g=>g.gameKey===game.gameKey);
      if(!final||final.state!=='FINAL'||final.away!==game.away||final.home!==game.home||Date.parse(final.startTimePacific)!==Date.parse(game.startTimePacific)
        ||![final.awayScore,final.homeScore].every(n=>Number.isInteger(n)&&n>=0)||!/^https:\/\/www\.espn\.com\/nfl\/game\/_\/gameId\/\d+$/.test(final.sourceUrl))fail('FINAL_IDENTITY_OR_SCORE_INVALID:'+game.gameKey);
      const histories=[game.away,game.home].map(team=>list(power.teams.find(t=>t.abbr===team)?.history).filter(h=>h.type==='WALTERS_WEEKLY_90_10'&&h.sourceWeek===board.week&&h.gameKey===game.gameKey));
      let state='MISSING_PAIRED_HISTORICAL_INPUTS';
      if(histories.every(h=>h.length===1)) {
        state='GOVERNED_UPDATE_AUDITED';
        for(let index=0;index<2;index++) {
          const h=histories[index][0],peer=histories[1-index][0],i=h.tgplInputs;
          const margin=index===0?final.awayScore-final.homeScore:final.homeScore-final.awayScore;
          const tgpl=i.scoreMargin+i.opponentOldRating+i.teamInjuryLoss-i.opponentInjuryLoss-i.teamLocationAdvantage;
          const tests=[i.scoreMargin===margin,close(i.opponentOldRating,peer.fromRating),close(i.teamInjuryLoss,peer.tgplInputs.opponentInjuryLoss),
            close(i.opponentInjuryLoss,peer.tgplInputs.teamInjuryLoss),close(i.teamLocationAdvantage,-peer.tgplInputs.teamLocationAdvantage),
            close(h.tgpl,tgpl),close(h.toRating,.9*h.fromRating+.1*tgpl),close(h.delta,h.toRating-h.fromRating),
            h.marketViewed===false,(h.kickoff==null||Date.parse(h.kickoff)===Date.parse(game.startTimePacific)),h.targetWeek===board.week+1];
          if(tests.some(ok=>!ok)){state='AUDIT_ERROR';issues.push({gameKey:game.gameKey,team:index===0?game.away:game.home,code:'HISTORICAL_ARITHMETIC_OR_SOURCE_IDENTITY_MISMATCH'});}
        }
      } else if(histories.some(h=>h.length)) {state='AUDIT_ERROR';issues.push({gameKey:game.gameKey,code:'UNPAIRED_OR_DUPLICATE_HISTORY'});}
      const receipt=receipts.filter(r=>r.sourceWeek===board.week).sort((a,b)=>Date.parse(b.appliedAt)-Date.parse(a.appliedAt))[0];
      const blocker=list(receipt?.blockedGames).find(g=>g.gameKey===game.gameKey);
      games.push({...final,week:board.week,ratingState:state,
        ratingUpdates:state==='GOVERNED_UPDATE_AUDITED'?histories.map((h,index)=>({team:index===0?game.away:game.home,fromRating:h[0].fromRating,toRating:h[0].toRating,tgpl:h[0].tgpl,appliedAt:h[0].effectiveAt})):[],
        legacyBindingLimitations:histories.flat().some(h=>h.kickoff==null||!h.gameDayEvidenceBinding)?['LEGACY_HISTORY_LACKS_MODERN_KICKOFF_AND_GAME_DAY_BLOB_BINDING']:[],
        blockers:state==='MISSING_PAIRED_HISTORICAL_INPUTS'?list(blocker?.reasons):[],
        recoveryRoute:state==='MISSING_PAIRED_HISTORICAL_INPUTS'?(board.week===1?'Reconcile complete historical injury/replacement evidence, then replay the chronological rating chain; a late Week 1 update cannot overwrite Week 2.':'Bind complete paired final game-day evidence and evaluate with the existing weekly calculator.'):'NO_REWRITE_REQUIRED'});
    }
  }
  const byWeek=boards.map(board=>{const rows=games.filter(g=>g.week===board.week);return {week:board.week,finalsVerified:rows.length,governedGameUpdatesAudited:rows.filter(g=>g.ratingState==='GOVERNED_UPDATE_AUDITED').length,missingPairedInputs:rows.filter(g=>g.ratingState==='MISSING_PAIRED_HISTORICAL_INPUTS').length,auditErrors:rows.filter(g=>g.ratingState==='AUDIT_ERROR').length};});
  return {schema:1,season:facts.season,asOf:facts.verifiedAt,state:issues.length?'AUDIT_ERROR':'RESULTS_CLOSED_RATING_INPUTS_PARTIAL',marketViewed:false,
    summary:{finalsVerified:games.length,governedGameUpdatesAudited:games.filter(g=>g.ratingState==='GOVERNED_UPDATE_AUDITED').length,legacyBindingGameUpdates:games.filter(g=>g.legacyBindingLimitations.length).length,missingPairedInputs:games.filter(g=>g.ratingState==='MISSING_PAIRED_HISTORICAL_INPUTS').length,auditErrors:issues.length},byWeek,games,issues,
    limitation:'Final-score closeout is complete. Missing historical injury/replacement evidence is not zero loss and does not become a completed 90/10 update. This audit creates no rating, fair, bet, stake or performance claim.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [factPath,outPath]=process.argv.slice(2);if(!factPath||!outPath)fail('USAGE: node tools/graham-closeout-audit.mjs <facts.json> <audit.json>');
  const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),facts=read(factPath);
  const result=auditCloseout({facts,boards:facts.weeks.map(w=>read(`data/walters/nfl/${facts.season}/week-${String(w.week).padStart(2,'0')}-current-numbers.json`)),power:read('data/walters/nfl-power-ratings-ledger.json')});
  fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({state:result.state,summary:result.summary,byWeek:result.byWeek,issues:result.issues}));
  if(result.issues.length)process.exitCode=1;
}
