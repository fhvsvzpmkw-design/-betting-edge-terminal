#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import A from '../assets/value-analytics.js';

const stamp=x=>Date.parse(x||'');
export function buildComparison(ledgers,factFiles,{generatedAt=new Date().toISOString()}={}){
  const facts=new Map(),conflicts=new Set();
  for(const file of factFiles)for(const week of file.data.weeks||[])for(const g of week.games||[]){
    if(g.state!=='FINAL'||!A.finite(g.homeScore)||!A.finite(g.awayScore))continue;
    const p=facts.get(g.gameKey);
    if(p&&['away','home','homeScore','awayScore','startTimePacific'].some(k=>p.game[k]!==g[k]))conflicts.add(g.gameKey);
    facts.set(g.gameKey,{game:g,path:file.path,verifiedAt:file.data.verifiedAt});
  }
  const rows=[],excluded=[];
  for(const file of ledgers)for(const g of file.data.games||[]){
    const kickoff=stamp(g.startTimePacific);
    const candidates=(g.dailySnapshots||[]).filter(s=>s.pinnacleStatus==='AVAILABLE'&&A.finite(s.grahamFairHome)&&A.finite(s.pinnacleSpreadHome)&&
      Number.isFinite(stamp(s.pinnacleObservedAt))&&stamp(s.pinnacleObservedAt)<=kickoff&&Number.isFinite(stamp(s.grahamAsOf))&&stamp(s.grahamAsOf)<=kickoff);
    candidates.sort((a,b)=>stamp(b.pinnacleObservedAt)-stamp(a.pinnacleObservedAt)||Number(b.sequence)-Number(a.sequence));
    const s=candidates[0];if(!s){excluded.push({gameKey:g.gameKey,reason:'No timestamped pre-kickoff Graham / Pinnacle pair'});continue;}
    const f=facts.get(g.gameKey),exact=f&&!conflicts.has(g.gameKey)&&f.game.away===g.away&&f.game.home===g.home&&stamp(f.game.startTimePacific)===kickoff;
    const line=Number(s.pinnacleSpreadHome),fair=Number(s.grahamFairHome),favoriteSide=line<=0?'home':'away',tie=Math.abs(fair-line)<1e-8;
    rows.push({gameKey:g.gameKey,season:file.data.season,week:file.data.week,away:g.away,home:g.home,startTime:g.startTimePacific,
      grahamHomeFair:fair,pinnacleHomeLine:line,favoriteSide,valueSide:tie?favoriteSide:fair<line?'home':'away',sameLine:tie,gap:Math.abs(fair-line),
      resultState:exact?'FINAL':'PENDING',homeScore:exact?Number(f.game.homeScore):null,awayScore:exact?Number(f.game.awayScore):null,
      resultSource:exact?f.game.sourceUrl:null,factsPath:exact?f.path:null,resultVerifiedAt:exact?f.verifiedAt:null,
      quoteKind:s.type==='CLOSE'?'RECORDED_CLOSE':'LAST_SAVED_PREGAME',pinnacleObservedAt:s.pinnacleObservedAt,grahamAsOf:s.grahamAsOf,
      hoursBeforeKickoff:(kickoff-stamp(s.pinnacleObservedAt))/3600000,recordedHomeOdds:s.pinnacleHomePriceAmerican||null,
      ledgerPath:file.path,snapshotSequence:s.sequence,sourceRefs:s.sourceRefs||[]});
  }
  rows.sort((a,b)=>stamp(a.startTime)-stamp(b.startTime)||a.gameKey.localeCompare(b.gameKey));
  const settled=rows.filter(r=>r.resultState==='FINAL'),strategies=Object.fromEntries(['graham','favorites','dogs'].map(key=>[key,A.summary(A.strategyRows(settled,key))]));
  return {schema:1,kind:'graham-pinnacle-value',generatedAt,seasons:[...new Set(rows.map(r=>r.season))],
    methodology:{quote:'Latest saved Pinnacle observation at or before kickoff, paired with a Graham fair timestamp at or before kickoff.',
      selection:'Choose home when the Graham home fair is lower than the Pinnacle home line; otherwise choose away. Identical lines choose the Pinnacle favourite; home on a pick’em.',
      returns:'Illustrative only: 1u risk at -110 for every strategy, including pushes in the risk denominator. Saved home odds are audit data and are not used to invent missing away odds.',
      history:'No issued report, fair, market snapshot, stake or settlement is rewritten.'},
    coverage:{games:rows.length,settled:settled.length,pending:rows.length-settled.length,excluded:excluded.length,recordedCloses:settled.filter(r=>r.quoteKind==='RECORDED_CLOSE').length,
      sameLines:settled.filter(r=>r.sameLine).length,quoteAgeHours:settled.length?{min:Math.min(...settled.map(r=>r.hoursBeforeKickoff)),max:Math.max(...settled.map(r=>r.hoursBeforeKickoff))}:null},
    strategies,accuracy:{graham:A.predictionAccuracy(settled,'grahamHomeFair'),pinnacle:A.predictionAccuracy(settled,'pinnacleHomeLine')},excluded,rows};
}
export function buildFromRoot(root=process.cwd()){
  const parent=path.join(root,'data/walters/nfl'),ledgers=[],facts=[];
  for(const season of fs.readdirSync(parent).filter(x=>/^\d{4}$/.test(x)).sort()){
    const dir=path.join(parent,season);
    for(const name of fs.readdirSync(dir).sort()){
      const file=path.join(dir,name),relative=path.relative(root,file).split(path.sep).join('/');
      if(/^week-\d+-daily-market-ledger\.json$/.test(name))ledgers.push({path:relative,data:JSON.parse(fs.readFileSync(file))});
      if(/final-facts.*\.json$/.test(name))facts.push({path:relative,data:JSON.parse(fs.readFileSync(file))});
    }
  }
  const result=buildComparison(ledgers,facts),out=path.join(root,'data/history/graham-pinnacle-value.json');
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log(`Graham / Pinnacle value: ${result.coverage.settled} settled, ${result.coverage.pending} pending, ${result.coverage.excluded} excluded`);return result;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))buildFromRoot();
