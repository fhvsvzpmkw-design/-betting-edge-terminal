(function(root){
  'use strict';
  const list=x=>Array.isArray(x)?x:[];
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const time=x=>Date.parse(x);
  const escape=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const day=x=>Number.isFinite(time(x))?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x)):null;
  const clock=x=>Number.isFinite(time(x))?new Intl.DateTimeFormat('en-US',{timeZone:'America/Vancouver',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(x))+' PT':'Not captured';
  const pct=x=>finite(x)?(x*100).toFixed(1)+'%':'Not captured';
  const points=x=>finite(x)?(x>=0?'+':'')+x.toFixed(2)+' pp':'Not measured';
  function american(d){if(!finite(d)||d<=1)return 'Not quoted';const n=d>=2?Math.round((d-1)*100):-Math.round(100/(d-1));return (n>0?'+':'')+n;}
  function url(x){try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
  function moneyPuckPair(game,asOf){
    const records=list(game.externalModels).filter(r=>r.sourceId==='moneypuck'&&r.kind==='OUTCOME_PROBABILITY'&&r.marketDetail==='full_game_moneyline'&&r.period==='FULL_GAME'&&r.state==='PRE_GAME'&&r.line==null&&r.probabilityBasis==='UNCONDITIONAL'&&r.pushProbability===0&&r.settlement?.includesOvertime===true&&r.settlement?.pushRule==='NO_PUSH'&&['home','away'].includes(r.side)&&finite(r.probability)&&r.probability>=0&&r.probability<=1&&String(r.eventId)===String(game.eventId)&&r.home===game.home&&r.away===game.away&&time(r.startTime)===time(game.startTime)&&Number.isFinite(time(r.observedAt))&&time(r.observedAt)<time(game.startTime)&&(!asOf||time(r.observedAt)<=time(asOf)));
    const home=records.filter(r=>r.side==='home').sort((a,b)=>time(b.observedAt)-time(a.observedAt))[0];
    if(!home)return null;
    const away=records.find(r=>r.side==='away'&&r.sourceGameId===home.sourceGameId&&r.observedAt===home.observedAt);
    if(!away||Math.abs(home.probability+away.probability-1)>0.000001)return null;
    const conflicting=records.some(r=>r.observedAt===home.observedAt&&r.side===home.side&&r.probability!==home.probability)||records.some(r=>r.observedAt===away.observedAt&&r.side===away.side&&r.probability!==away.probability);
    return conflicting?null:{home,away};
  }
  function selectBoard(board,{date=day(board?.asOf),report=null}={}){
    const rows=[],seen=new Set();
    for(const g of list(board?.games)){
      if(g.sport!=='NHL'||day(g.startTime)!==date||seen.has(String(g.eventId)))continue;
      seen.add(String(g.eventId));
      const pair=moneyPuckPair(g,board.asOf),choices=[];
      for(const m of list(g.markets)){
        if(m.marketDetail!=='full_game_moneyline'||!['home','away'].includes(m.side))continue;
        for(const q of list(m.quotes)){
          if(!finite(q.priceDecimal)||q.priceDecimal<=1||q.line!=null||q.side!==m.side||!q.book||q.book.toLowerCase()==='pinnacle')continue;
          if(!Number.isFinite(time(q.observedAt))||time(q.observedAt)>time(board.asOf)||time(q.observedAt)>=time(g.startTime))continue;
          const forecast=pair?.[m.side],breakEven=1/q.priceDecimal;
          choices.push({side:m.side,team:g[m.side],book:q.book,priceDecimal:q.priceDecimal,price:american(q.priceDecimal),quoteObservedAt:q.observedAt,selectionKey:q.selectionKey,breakEven,probability:forecast?.probability??null,edge:forecast?(forecast.probability-breakEven)*100:null,marketEdge:finite(q.benchmark?.edgeProbabilityPoints)?q.benchmark.edgeProbabilityPoints:null});
        }
      }
      choices.sort((a,b)=>(b.edge??-Infinity)-(a.edge??-Infinity)||(b.marketEdge??-Infinity)-(a.marketEdge??-Infinity)||b.priceDecimal-a.priceDecimal||a.side.localeCompare(b.side)||a.book.localeCompare(b.book));
      const quote=choices[0]??{side:null,team:null,book:null,price:null,priceDecimal:null,breakEven:null,probability:null,edge:null,marketEdge:null};
      const sourceCall=list(report?.recs).find(r=>String(r.feed?.eventId)===String(g.eventId)&&r.feed?.side===quote.side&&r.feed?.marketKey==='ml'&&r.feed?.market==='full_game_moneyline'&&time(r.feed?.eventDate)===time(g.startTime));
      const rawHome=pair?.home.marketBlendObservation?.modelHomeProbability;
      rows.push({...quote,eventId:String(g.eventId),home:g.home,away:g.away,label:g.label,startTime:g.startTime,homeProbability:pair?.home.probability??null,awayProbability:pair?.away.probability??null,modelComponent:finite(rawHome)?quote.side==='away'?1-rawHome:rawHome:null,marketInput:pair?.home.marketBlendObservation?.bookmakerHomeProbability??null,modelObservedAt:pair?.home.observedAt??null,modelUrl:url(pair?.home.url),modelBoardUrl:url(pair?.home.boardUrl),modelRecordIds:pair?[pair.home.recordId,pair.away.recordId]:[],marketBlended:pair?.home.marketBlendObservation?.observedEqualWeightBlend===true,call:sourceCall?.status??null,callAt:sourceCall?report.ts:null,callPrice:sourceCall?american(sourceCall.feed.priceDecimal):null,callQuoteMatches:!!sourceCall&&sourceCall.feed.book===quote.book&&Math.abs(sourceCall.feed.priceDecimal-quote.priceDecimal)<0.000001,venue:list(g.facts).find(f=>f.kind==='VENUE')?.details?.name??null,injuries:list(g.facts).filter(f=>f.kind==='INJURIES').map(f=>({team:f.details?.team,players:list(f.details?.players).slice(0,3).map(p=>({name:p.name,status:p.status})),observedAt:f.observedAt,url:url(f.url)}))});
    }
    rows.sort((a,b)=>(b.edge??-Infinity)-(a.edge??-Infinity)||(b.marketEdge??-Infinity)-(a.marketEdge??-Infinity)||time(a.startTime)-time(b.startTime)||a.eventId.localeCompare(b.eventId));
    return {schema:1,date,asOf:board?.asOf??null,priceSnapshotAt:board?.feedGeneratedAt??null,reportAt:report?.ts??null,reportLabel:report?.label??null,rows};
  }
  function guySays(row,index){
    if(row.priceDecimal==null)return 'No moneyline price on this slip yet, mon chum. Bring me the number before we argue about it.';
    if(row.edge==null)return 'No proper forecast on this slip yet, mon chum. I can eat the poutine while we wait.';
    if(row.edge>0){const opening=index===0?'Bon. This one goes at the top of my sheet.':'Tabarnak, there is something to look at here.';return `${opening} MoneyPuck is above the price’s break-even mark for ${row.team}.${row.marketEdge<0?' Pinnacle disagrees on value; that argument stays on the table.':''} A circle on the sheet is not a BET.`;}
    return ['At that price, the book can buy its own poutine. MoneyPuck is below the break-even mark.','Ostie. A team can win the game and still be a lousy price. MoneyPuck does not cover this number.','Keep the wallet shut on the model comparison. I’ve seen more room in the ashtray.'][index%3];
  }
  function modelDetails(row){
    if(row.homeProbability==null)return '<p class="muted">No matched MoneyPuck pregame forecast captured for this game.</p>';
    const link=row.modelUrl?`<a href="${escape(row.modelUrl)}" target="_blank" rel="noopener noreferrer">MoneyPuck source</a>`:'MoneyPuck';
    return `<div class="model-pair"><span>${escape(row.away)} <b>${pct(row.awayProbability)}</b></span><span>${escape(row.home)} <b>${pct(row.homeProbability)}</b></span></div><p class="small muted">Published full-game forecast · OT included · captured ${clock(row.modelObservedAt)}</p><details class="source-note"><summary>MoneyPuck details &amp; rink notes</summary><p>${row.marketBlended?'The published forecast includes market input.':'Published source probabilities are shown as captured.'}${row.modelComponent!=null?` The model component for ${escape(row.team)} is ${pct(row.modelComponent)}; it stays separate from the published overall forecast.`:''}</p><p>${link}${row.venue?' · '+escape(row.venue):''}</p>${row.injuries.map(f=>`<p class="small"><b>${escape(f.team)}:</b> ${f.players.map(p=>escape(p.name)+' — '+escape(p.status)).join('; ')||'No entries captured'} <span class="muted">(${clock(f.observedAt)})</span></p>`).join('')}</details>`;
  }
  function render(state,{now=new Date().toISOString()}={}){
    const rows=list(state.rows),positive=rows.filter(r=>finite(r.edge)&&r.edge>0).length;
    const dateText=state.date?new Intl.DateTimeFormat('en-US',{timeZone:'America/Vancouver',weekday:'long',month:'long',day:'numeric'}).format(new Date(state.date+'T12:00:00-07:00')):'Daily NHL';
    return `<div class="rundown-heading"><div><p class="eyebrow">DAILY NHL // MONEYLINES</p><h2>${escape(dateText)}</h2><p class="muted">Highest MoneyPuck price gap first · one entry per game</p></div><span class="sheet-count">${rows.length} GAMES<br><b>${positive} POSITIVE GAPS</b></span></div><div class="capture-strip"><span>Prices: ${clock(state.priceSnapshotAt)}</span><span>MoneyPuck board: ${clock(state.asOf)}</span>${state.reportAt?`<span>Last issued calls: ${clock(state.reportAt)}</span>`:''}</div>${rows.length?`<div class="game-grid">${rows.map((r,i)=>`<article class="game-card" data-event-id="${escape(r.eventId)}" data-rank="${i+1}"><div class="game-top"><b class="rank">${String(i+1).padStart(2,'0')}</b><span>${clock(r.startTime)}<br><small>${time(now)>=time(r.startTime)?'STARTED · PREGAME RECORD':'PREGAME SNAPSHOT'}</small></span></div><h3>${escape(r.away)}<span>at ${escape(r.home)}</span></h3><div class="pick-line"><div><small>PRICE TO COMPARE</small><b>${escape(r.team??'Moneyline not quoted')}</b><span>${escape(r.book??'Awaiting quote')}</span></div><strong class="price">${escape(r.price??'—')}</strong></div><div class="metrics"><div class="gap ${r.edge>0?'positive':''}"><small>MONEYPUCK EDGE</small><b>${points(r.edge)}</b></div><div><small>WIN FORECAST</small><b>${pct(r.probability)}</b></div><div><small>BREAK-EVEN</small><b>${pct(r.breakEven)}</b></div><div><small>PINNACLE EDGE</small><b>${points(r.marketEdge)}</b></div></div>${modelDetails(r)}<blockquote><b>GUY’S READ</b>${escape(guySays(r,i))}</blockquote><div class="issued-call"><span>VigScope last call: <b>${escape(r.call??'Not issued')}</b>${r.callAt&&!r.callQuoteMatches?` · at recorded ${escape(r.callPrice)}`:''}</span><span>Quote captured ${clock(r.quoteObservedAt)}</span></div></article>`).join('')}</div>`:'<div class="empty-night"><h3>The rink is quiet.</h3><p>No NHL games for this date are in the latest saved board. Refresh the rundown after the next collection.</p></div>'}`;
  }
  async function boot({base,container=document.getElementById('dailyRundown'),notice=document.getElementById('feedNotice')}={}){
    const locationBase=base||new URL('../../../',root.location.href);
    const read=async p=>{const u=new URL(p,locationBase);u.searchParams.set('v',String(Date.now()));const response=await fetch(u,{cache:'no-store'});if(!response.ok)throw Error('Saved feed unavailable');return response.json();};
    const button=document.getElementById('refreshRundown');
    if(button)button.disabled=true;
    try{
      const board=await read('data/game-intelligence/board.json');
      if(!Array.isArray(board.games)||!day(board.asOf))throw Error('Invalid saved board');
      let report=null;
      try{const history=await read('run-history.json');const latest=list(history.runs).filter(r=>day(r.ts)===day(board.asOf)&&/^data\/history\/runs\/\d{4}-\d{2}-\d{2}\/[a-z0-9_-]+\.json$/.test(r.path)).sort((a,b)=>time(b.ts)-time(a.ts))[0];if(latest){const candidate=await read(latest.path);if(candidate.ts===latest.ts&&Array.isArray(candidate.recs))report=candidate;}}catch{}
      const state=selectBoard(board,{report});
      container.innerHTML=render(state);
      const today=day(new Date().toISOString());
      notice.textContent=state.date!==today?`Saved ${state.date} rundown. Today’s NHL board has not arrived yet.`:'Recorded pregame prices and captured forecasts. Refresh loads the latest saved rundown.';
    }catch{notice.textContent='The refreshed feed is unavailable. The dated saved rundown below remains on the sheet.';}
    finally{if(button)button.disabled=false;}
    if(button&&!button.dataset.bound){button.dataset.bound='1';button.addEventListener('click',()=>boot({base:locationBase,container,notice}));}
  }
  const api={day,american,moneyPuckPair,selectBoard,render,boot};root.GuyBlueLine=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
