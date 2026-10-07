#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),blue=require('../assets/guy-blue-line.js'),value=require('../assets/guy-value.js');
const time=x=>Date.parse(x||''),list=x=>Array.isArray(x)?x:[],finite=x=>typeof x==='number'&&Number.isFinite(x);
const LEGACY_POLICY='daily-peak-before-first-puck-v1';
const POLICY={id:'daily-peak-before-selected-puck-v2',timeZone:'America/Vancouver',market:'full_game_moneyline',source:'moneypuck',onePickPerDay:true,positiveEdgeOnly:true,lockReference:'SELECTED_GAME_START',lockMinutesBeforeSelectedGame:1,maxQuoteAgeMinutes:75,riskUnits:1};
const cutoff=start=>new Date(time(start)-60000).toISOString();
export function newLedger(at){return {schema:1,characterId:'guy-laflame',startedAt:at,updatedAt:at,policy:POLICY,entries:[]};}
function closeEntry(entry,at){
  if(entry.state!=='WATCHING'||value.status(entry,at)==='WATCHING')return;
  entry.state=entry.pick?'LOCKED':'SKIPPED';if(!entry.pick)entry.skipReason='NO_POSITIVE_EDGE';entry.lockConfirmedAt=at;
}
function migrate(ledger,at){
  if(ledger.policy.id!==LEGACY_POLICY)return;
  for(const entry of ledger.entries){
    entry.policyId=LEGACY_POLICY;
    // A publicly frozen legacy selection or skipped day must never reopen.
    closeEntry(entry,at);
    if(entry.state==='WATCHING'){
      entry.policyId=POLICY.id;entry.lockAt=entry.pick?cutoff(entry.pick.startTime):null;entry.watchUntil=null;
    }
  }
  ledger.policyHistory=[...list(ledger.policyHistory),{id:LEGACY_POLICY,startedAt:ledger.startedAt,endedAt:at}];
  ledger.policy=POLICY;ledger.policyChangedAt=at;
}
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
  if(ledger.schema!==1||ledger.characterId!=='guy-laflame'||![POLICY.id,LEGACY_POLICY].includes(ledger.policy?.id)||!Array.isArray(ledger.entries)||!Number.isFinite(time(ledger.startedAt))||time(at)<time(ledger.updatedAt))throw Error('Invalid or out-of-order Guy ledger');
  migrate(ledger,at);
  for(const entry of ledger.entries){
    closeEntry(entry,at);
    settle(entry,results,at);
  }
  const date=value.day(at),games=list(board?.games).filter(g=>g.sport==='NHL'&&value.day(g.startTime)===date);
  if(games.length){
    const lastStartTime=games.map(g=>g.startTime).sort((a,b)=>time(b)-time(a))[0],watchUntil=cutoff(lastStartTime);
    let entry=ledger.entries.find(e=>e.date===date);
    if(!entry){entry={date,policyId:POLICY.id,lastStartTime,watchUntil,lockAt:null,firstRecordedAt:at,state:time(at)>=time(watchUntil)?'SKIPPED':'WATCHING',pick:null,observations:[]};
      if(entry.state==='SKIPPED')entry.skipReason=time(ledger.startedAt)>=time(watchUntil)?'STARTED_BEFORE_TRACKING':'MISSED_CUTOFF';ledger.entries.push(entry);}
    if(entry.state==='WATCHING'&&!entry.pick){
      // Without a leader, keep looking while an upcoming game remains on the slate.
      entry.lastStartTime=lastStartTime;entry.watchUntil=watchUntil;
    }
    closeEntry(entry,at);
    if(entry.state==='WATCHING'&&time(board.asOf)>=time(ledger.startedAt)&&time(board.asOf)<=time(at)&&time(at)-time(board.asOf)<=75*60000){
      // Filter before ranking: a stale best price must not conceal a fresh runner-up.
      const eligible={...board,games:games.filter(g=>time(at)<time(g.startTime)-60000).map(g=>({...g,markets:list(g.markets).map(m=>({...m,quotes:list(m.quotes).filter(q=>time(at)-time(q.observedAt)>=0&&time(at)-time(q.observedAt)<=75*60000)}))}))};
      const row=blue.selectBoard(eligible,{date}).rows.find(r=>finite(r.edge)&&r.edge>0&&time(r.startTime)>time(at));
      const candidate=row?{eventId:row.eventId,home:row.home,away:row.away,startTime:row.startTime,side:row.side,team:row.team,book:row.book,priceDecimal:row.priceDecimal,americanOdds:blue.american(row.priceDecimal),selectionKey:row.selectionKey??null,
        probability:row.probability,breakEven:row.breakEven,edge:row.edge,marketEdge:row.marketEdge,quoteObservedAt:row.quoteObservedAt,modelObservedAt:row.modelObservedAt,modelRecordIds:row.modelRecordIds,modelUrl:row.modelUrl,marketBlended:row.marketBlended,boardAsOf:board.asOf,recordedAt:at}:null;
      const id=crypto.createHash('sha256').update(JSON.stringify({asOf:board.asOf,candidate:candidate&&{...candidate,recordedAt:null}})).digest('hex');
      if(!entry.observations.some(o=>o.id===id)){
        entry.observations.push({id,recordedAt:at,boardAsOf:board.asOf,candidate});
        if(candidate&&(!entry.pick||candidate.edge>entry.pick.edge)){
          entry.pick={...candidate,observationId:id};entry.lockAt=cutoff(candidate.startTime);
        }
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
