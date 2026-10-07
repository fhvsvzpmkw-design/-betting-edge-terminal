#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),blue=require('../assets/guy-blue-line.js'),value=require('../assets/guy-value.js');
const time=x=>Date.parse(x||''),list=x=>Array.isArray(x)?x:[],finite=x=>typeof x==='number'&&Number.isFinite(x);
const POLICY={id:'daily-peak-before-first-puck-v1',timeZone:'America/Vancouver',market:'full_game_moneyline',source:'moneypuck',onePickPerDay:true,positiveEdgeOnly:true,lockMinutesBeforeFirstGame:1,maxQuoteAgeMinutes:75,riskUnits:1};
export function newLedger(at){return {schema:1,characterId:'guy-laflame',startedAt:at,updatedAt:at,policy:POLICY,entries:[]};}
function settle(entry,results,at){
  if(value.status(entry,at)!=='LOCKED'||!entry.pick||['WIN','LOSS'].includes(entry.result?.grade))return;
  const p=entry.pick,r=list(results).find(r=>String(r.eventId)===p.eventId&&time(r.startTime)===time(p.startTime)&&r.state==='FINAL'&&Number.isFinite(time(r.verifiedAt))&&time(r.verifiedAt)<=time(at));
  if(!r||time(p.startTime)>=time(at))return;
  if(r.special||!finite(r.homeScore)||!finite(r.awayScore)||r.homeScore===r.awayScore){entry.result={grade:'UNRESOLVED',netUnits:null,reason:'Final settlement needs review',verifiedAt:r.verifiedAt,url:r.url};return;}
  const won=p.side==='home'?r.homeScore>r.awayScore:r.awayScore>r.homeScore;
  entry.result={grade:won?'WIN':'LOSS',netUnits:won?p.priceDecimal-1:-1,riskUnits:1,homeScore:r.homeScore,awayScore:r.awayScore,verifiedAt:r.verifiedAt,url:r.url};
}
export function updateLedger(previous,board,{at=new Date().toISOString(),results=[]}={}){
  if(!Number.isFinite(time(at)))throw Error('Invalid tracking clock');
  const ledger=structuredClone(previous||newLedger(at));
  if(ledger.schema!==1||ledger.characterId!=='guy-laflame'||ledger.policy?.id!==POLICY.id||!Array.isArray(ledger.entries)||!Number.isFinite(time(ledger.startedAt))||time(at)<time(ledger.updatedAt))throw Error('Invalid or out-of-order Guy ledger');
  for(const entry of ledger.entries){
    if(entry.state==='WATCHING'&&time(at)>=time(entry.lockAt)){entry.state=entry.pick?'LOCKED':'SKIPPED';if(!entry.pick)entry.skipReason='NO_POSITIVE_EDGE';entry.lockConfirmedAt=at;}
    settle(entry,results,at);
  }
  const date=value.day(at),games=list(board?.games).filter(g=>g.sport==='NHL'&&value.day(g.startTime)===date);
  if(games.length){
    const firstStartTime=games.map(g=>g.startTime).sort((a,b)=>time(a)-time(b))[0],lockAt=new Date(time(firstStartTime)-60000).toISOString();
    let entry=ledger.entries.find(e=>e.date===date);
    if(!entry){entry={date,firstStartTime,lockAt,firstRecordedAt:at,state:time(at)>=time(lockAt)?'SKIPPED':'WATCHING',pick:null,observations:[]};
      if(entry.state==='SKIPPED')entry.skipReason=time(ledger.startedAt)>=time(lockAt)?'STARTED_BEFORE_TRACKING':'MISSED_CUTOFF';ledger.entries.push(entry);}
    // A newly discovered earlier start may close the window; it never reopens it.
    if(entry.state==='WATCHING'&&time(lockAt)<time(entry.lockAt)){
      entry.firstStartTime=firstStartTime;entry.lockAt=lockAt;
      entry.pick=entry.observations.filter(o=>time(o.recordedAt)<time(lockAt)&&o.candidate).sort((a,b)=>b.candidate.edge-a.candidate.edge||time(a.recordedAt)-time(b.recordedAt)).map(o=>({...o.candidate,observationId:o.id}))[0]||null;
    }
    if(entry.state==='WATCHING'&&time(at)>=time(entry.lockAt)){entry.state=entry.pick?'LOCKED':'SKIPPED';if(!entry.pick)entry.skipReason='MISSED_CUTOFF';entry.lockConfirmedAt=at;}
    if(entry.state==='WATCHING'&&time(board.asOf)>=time(ledger.startedAt)&&time(board.asOf)<=time(at)&&time(at)-time(board.asOf)<=75*60000){
      // Filter before ranking: a stale best price must not conceal a fresh runner-up.
      const eligible={...board,games:games.map(g=>({...g,markets:list(g.markets).map(m=>({...m,quotes:list(m.quotes).filter(q=>time(at)-time(q.observedAt)>=0&&time(at)-time(q.observedAt)<=75*60000)}))}))};
      const row=blue.selectBoard(eligible,{date}).rows.find(r=>finite(r.edge)&&r.edge>0&&time(r.startTime)>time(at));
      const candidate=row?{eventId:row.eventId,home:row.home,away:row.away,startTime:row.startTime,side:row.side,team:row.team,book:row.book,priceDecimal:row.priceDecimal,americanOdds:blue.american(row.priceDecimal),selectionKey:row.selectionKey??null,
        probability:row.probability,breakEven:row.breakEven,edge:row.edge,marketEdge:row.marketEdge,quoteObservedAt:row.quoteObservedAt,modelObservedAt:row.modelObservedAt,modelRecordIds:row.modelRecordIds,modelUrl:row.modelUrl,marketBlended:row.marketBlended,boardAsOf:board.asOf,recordedAt:at}:null;
      const id=crypto.createHash('sha256').update(JSON.stringify({asOf:board.asOf,candidate:candidate&&{...candidate,recordedAt:null}})).digest('hex');
      if(!entry.observations.some(o=>o.id===id)){
        entry.observations.push({id,recordedAt:at,boardAsOf:board.asOf,candidate});
        if(candidate&&(!entry.pick||candidate.edge>entry.pick.edge))entry.pick={...candidate,observationId:id};
      }
    }
    settle(entry,results,at);
  }
  ledger.entries.sort((a,b)=>a.date.localeCompare(b.date));ledger.updatedAt=at;ledger.summary=value.summary(ledger,at);return ledger;
}
export function track({root=process.cwd(),at=new Date().toISOString()}={}){
  const read=file=>fs.existsSync(path.join(root,file))?JSON.parse(fs.readFileSync(path.join(root,file),'utf8')):null;
  const file='data/characters/guy-laflame/value-ledger.json',board=read('data/game-intelligence/board.json');
  const ledger=updateLedger(read(file),board,{at,results:read('data/game-intelligence/performance.json')?.results||board?.sourcePerformance?.results});
  fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),JSON.stringify(ledger,null,2)+'\n');return ledger;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const ledger=track();console.log(JSON.stringify({startedAt:ledger.startedAt,updatedAt:ledger.updatedAt,...ledger.summary}));}
