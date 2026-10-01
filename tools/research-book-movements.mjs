// Reconstruct sampled pregame trajectories. Output is research-only.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import Q from '../assets/quote-observation.js';
import {exactMarketReference} from './market-price-assessment.mjs';

const out='research/pricing-patterns-20261001';
const targets=JSON.parse(fs.readFileSync(`${out}/entries.json`)).firstSelections;
const index=JSON.parse(fs.readFileSync('data/history/odds-index.json'));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const ms=s=>Number.isFinite(Date.parse(s))?Date.parse(s):null;
const byEvent=new Map(), marketTargets=new Map();
for(const t of targets){
  const parts=t.eventKey.split('|'); const eventId=parts[1];
  if(!byEvent.has(eventId))byEvent.set(eventId,[]);
  byEvent.get(eventId).push(t);
  if(!marketTargets.has(t.marketId))marketTargets.set(t.marketId,new Map());
  marketTargets.get(t.marketId).set(t.side,t);
}
const frames=[], lines=[], counters={}, snapshots=[];
const count=k=>counters[k]=(counters[k]||0)+1;
for(const entry of index.entries){
  let feed;
  try{feed=JSON.parse(execFileSync('git',['cat-file','blob',entry.snapshotBlobSha],{encoding:'utf8',maxBuffer:96*1024*1024}));}
  catch{count('feed_blob_missing');continue;}
  if(ms(feed.generatedAt)!==ms(entry.generatedAt)){count('index_time_mismatch');continue;}
  let observer=null, observerSha=null;
  try{
    observerSha=execFileSync('git',['rev-parse',`${entry.snapshotCommitSha}:data/oddspapi-observer.json`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
    observer=JSON.parse(execFileSync('git',['cat-file','blob',observerSha],{encoding:'utf8',maxBuffer:96*1024*1024,stdio:['ignore','pipe','ignore']}));
  }catch{count('observer_blob_missing');}
  const feedAt=ms(feed.generatedAt), observerAt=ms(observer?.generatedAt);
  const at=Math.max(feedAt,observerAt!==null&&observerAt-feedAt<=75*60000?observerAt:feedAt);
  const frameAt=new Date(at).toISOString();
  snapshots.push({feedSha:entry.snapshotBlobSha,feedAt:feed.generatedAt,observerSha,observerAt:observer?.generatedAt||null});
  const observed=Q.requiresObservation(feed), events=observed?Q.mergeObservedEvents(feed):feed.events||[];
  for(const event of events){
    const id=String(event.eventId||event.identity?.eventId||event.id);
    const eventTargets=(byEvent.get(id)||[]).filter(t=>ms(t.eventKey.split('|')[2])===ms(event.date||event.identity?.startTime));
    if(!eventTargets.length||Q.isSuspended(event)||at>=ms(event.date||event.identity?.startTime))continue;
    const wanted=new Map(eventTargets.map(t=>[t.selectionKey,t]));
    const quotes=new Map();
    for(const [book,raw] of Object.entries(event.bookmakers||{})){
      const b=norm(book);if(!['bet365','draftkings'].includes(b))continue;
      for(const key of ['ml','spread','totals']){
        let markets=raw||[];
        if(observed){
          const matches=markets.filter(m=>String(m.marketKey||m.identity?.marketKey).toLowerCase()===key).sort((a,b)=>Q.compareMarketRecency(a,b,feed));
          const latest=matches[0],tied=latest&&matches.filter(m=>Q.compareMarketRecency(latest,m,feed)===0);
          markets=latest&&new Set(tied.map(m=>JSON.stringify(m))).size===1?[latest]:[];
        }
        const offeredLines=new Set();
        for(const m of markets){
          const clock=ms(Q.quoteTimestamp(m,feed));
          if(!Q.quoteIsFresh(m,feed,30)||clock===null||clock>at||(at-clock)>30*60000)continue;
          for(const row of m.odds||[]){
            if(Q.isSuspended(row))continue;
            for(const [field,selectionKey] of Object.entries(row.selectionKeys||row.identity?.selectionKeys||{})){
              const p=Number(row[field]),parts=selectionKey.split('|');
              if(parts[1]!==key||!Number.isFinite(p)||p<=1)continue;
              if(key!=='ml'&&parts[4]!==''&&Number.isFinite(Number(parts[4])))offeredLines.add(Number(parts[4]));
              const t=wanted.get(selectionKey);if(!t||t.market!==key)continue;
              const k=`${t.marketId}|${b}|${t.side}`;
              if(!quotes.has(k))quotes.set(k,[]);
              quotes.get(k).push({price:p,observedAt:Q.quoteTimestamp(m,feed),changedAt:m.updatedAt});
            }
          }
        }
        if(key!=='ml'&&offeredLines.size)lines.push({eventKey:eventTargets[0].eventKey,sport:eventTargets[0].sport,market:key,book:b,at:frameAt,lines:[...offeredLines].sort((a,b)=>a-b),feedSha:entry.snapshotBlobSha});
      }
    }
    for(const marketId of new Set(eventTargets.map(t=>t.marketId))){
      const sides=marketTargets.get(marketId), t=sides.get('home')||sides.get('over');
      const opposite=t?.market==='totals'?'under':'away';
      if(!t||!sides.has(opposite))continue;
      const books={};
      for(const b of ['bet365','draftkings']){
        const a=quotes.get(`${marketId}|${b}|${t.side}`)||[],z=quotes.get(`${marketId}|${b}|${opposite}`)||[];
        if(!a.length||!z.length||new Set(a.map(x=>x.price)).size!==1||new Set(z.map(x=>x.price)).size!==1)continue;
        const overround=1/a[0].price+1/z[0].price;
        books[b]={anchor:a[0],opposite:z[0],p:(1/a[0].price)/overround,marginPct:(overround-1)*100};
      }
      if(!Object.keys(books).length)continue;
      let pinnacle=null;
      if(observer&&observerAt!==null&&observerAt<=at){
        try{
          const line=t.market==='spread'&&t.side==='away'?-t.line:t.line;
          const ref=exactMarketReference({ts:frameAt},{eventId:id,eventDate:event.date||event.identity?.startTime,marketKey:t.market,side:t.side,line},observer);
          pinnacle={p:ref.selected.noVigProbability,anchorPrice:ref.selected.price,oppositePrice:ref.opposite.price,
                    generatedAt:ref.generatedAt,anchorChangedAt:ref.selected.quoteChangedAt,oppositeChangedAt:ref.opposite.quoteChangedAt,
                    anchorObservedAt:ref.selected.quoteObservedAt||null,oppositeObservedAt:ref.opposite.quoteObservedAt||null};
        }catch{count('qualified_exact_reference_unavailable');}
      }
      frames.push({marketId,eventKey:t.eventKey,sport:t.sport,market:t.market,line:t.line,anchorSide:t.side,at:frameAt,
                   feedAt:feed.generatedAt,feedSha:entry.snapshotBlobSha,observerSha,books,pinnacle});
    }
  }
}
frames.sort((a,b)=>ms(a.at)-ms(b.at)||a.marketId.localeCompare(b.marketId));
fs.writeFileSync(`${out}/movement-frames.json`,JSON.stringify({frames,lines,snapshots,counters}));
console.log(JSON.stringify({snapshots:snapshots.length,frames:frames.length,markets:new Set(frames.map(x=>x.marketId)).size,
                           threeBookFrames:frames.filter(x=>x.pinnacle&&x.books.bet365&&x.books.draftkings).length,lineFrames:lines.length,counters}));
