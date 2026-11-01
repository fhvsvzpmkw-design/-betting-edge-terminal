(function(root){
  'use strict';
  const list=x=>Array.isArray(x)?x:[],finite=x=>typeof x==='number'&&Number.isFinite(x),time=x=>Date.parse(x||'');
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day=x=>Number.isFinite(time(x))?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x)):null;
  const clock=x=>Number.isFinite(time(x))?new Intl.DateTimeFormat('en-US',{timeZone:'America/Vancouver',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(x))+' PT':'Not captured';
  const american=x=>finite(x)&&x>1?(x>=2?'+'+Math.round((x-1)*100):String(-Math.round(100/(x-1)))):'—';
  const signed=(x,suffix='')=>finite(x)?`${x>0?'+':''}${x.toFixed(2)}${suffix}`:'—';
  const valid=ledger=>ledger?.schema===1&&ledger.characterId==='guy-laflame'&&ledger.policyId==='guy-researched-daily-call-v1'&&Array.isArray(ledger.entries)&&ledger.entries.every(entry=>entry&&typeof entry.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(entry.date));
  const fresh=(observedAt,now,minutes=75)=>Number.isFinite(time(observedAt))&&time(observedAt)<=time(now)&&time(now)-time(observedAt)<=minutes*60000;
  const validCall=call=>call&&typeof call.team==='string'&&typeof call.book==='string'&&finite(call.priceDecimal)&&call.priceDecimal>1&&Number.isFinite(time(call.publishedAt))&&Number.isFinite(time(call.startTime));
  const labels={CURRENT:'PRICE CHECK PASSED',WATCHING:'DAILY CALL · OPEN',LOCKED:'DAILY CALL · LOCKED',PRICE_EXPIRED:'PRICE REFRESH NEEDED',PRICE_OUTSIDE_LIMIT:'PRICE OUTSIDE GUY’S LIMIT',GOALIE_RECHECK_REQUIRED:'GOALIE RECHECK NEEDED',RESEARCH_REQUIRED:'HOCKEY REVIEW NEEDED',WAITING:'DAILY CALL PENDING',NOT_STARTED:'DAILY CALL STARTS NOVEMBER 1',UNAVAILABLE:'LATEST CALL UNAVAILABLE'};
  const projectedRecheckDue=(call,now)=>list(call?.research?.goalies).some(goalie=>goalie.status==='PROJECTED'&&Number.isFinite(time(goalie.recheckAt))&&time(now)>=time(goalie.recheckAt));
  function latestQuote(entry){
    const quote=entry?.liveStatus?.currentQuote;
    return quote&&finite(quote.priceDecimal)&&quote.priceDecimal>1&&typeof quote.book==='string'?quote:null;
  }
  const modelObservedAt=entry=>latestQuote(entry)?.modelObservedAt||entry?.call?.modelObservedAt;
  function review(entry,now){
    if(projectedRecheckDue(entry.call,now))return {state:'GOALIE_RECHECK_REQUIRED',reason:'The starting-goalie information needs a new check before acting.'};
    const state=entry.liveStatus?.state;
    if(['PRICE_OUTSIDE_LIMIT','GOALIE_RECHECK_REQUIRED','RESEARCH_REQUIRED'].includes(state))return {state,reason:entry.liveStatus.reason};
    const quote=latestQuote(entry)||{priceDecimal:entry.call.priceDecimal,observedAt:entry.call.quoteObservedAt};
    if(!fresh(quote.observedAt,now))return {state:'PRICE_EXPIRED',reason:'A fresh sportsbook quote is needed before acting. The saved capture is missing, ahead of this clock or more than 75 minutes old.'};
    if(!fresh(modelObservedAt(entry),now))return {state:'PRICE_EXPIRED',reason:'A fresh MoneyPuck forecast is needed before acting. The latest checked forecast is missing, ahead of this clock or more than 75 minutes old.'};
    if(!finite(entry.call.minDecimalPrice)||entry.call.minDecimalPrice<=1||quote.priceDecimal<entry.call.minDecimalPrice)return {state:'PRICE_OUTSIDE_LIMIT',reason:'The latest captured price is outside Guy’s limit. Do not chase this number.'};
    if(!fresh(entry.call.researchedAt,now,360))return {state:'RESEARCH_REQUIRED',reason:'Guy’s hockey review needs refreshing before acting. The saved review is missing, ahead of this clock or more than six hours old.'};
    return {state:state==='CURRENT'?'CURRENT':state==='PRICE_EXPIRED'||state==='LOCKED'?state:'RESEARCH_REQUIRED',reason:entry.liveStatus?.reason};
  }
  function status(entry,now=new Date().toISOString()){
    if(!validCall(entry?.call))return 'WAITING';
    if(entry.state==='LOCKED'||Number.isFinite(time(entry.lockAt))&&time(now)>=time(entry.lockAt))return 'LOCKED';
    return review(entry,now).state;
  }
  function summary(ledger,now=new Date().toISOString()){
    const picks=valid(ledger)?ledger.entries.filter(e=>validCall(e.call)&&status(e,now)==='LOCKED'):[];
    const settled=picks.filter(e=>['WIN','LOSS'].includes(e.result?.grade)&&finite(e.result.netUnits));
    const netUnits=settled.reduce((n,e)=>n+e.result.netUnits,0);
    return {picks:picks.length,settled:settled.length,wins:settled.filter(e=>e.result.grade==='WIN').length,losses:settled.filter(e=>e.result.grade==='LOSS').length,pending:picks.length-settled.length,netUnits,roiPct:settled.length?netUnits/settled.length*100:null};
  }
  function sourceLinks(section){
    return list(section?.sourceRefs).flatMap((ref,index)=>{
      try{const u=new URL(typeof ref==='string'?ref:ref.url);if(u.protocol!=='https:'||u.username||u.password)return [];
        return [`<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">Source ${index+1}</a>`];
      }catch{return [];}
    }).join(' · ');
  }
  function researchDetails(call){
    const research=call.research||{},goalies=list(research.goalies);
    const goalieRows=goalies.map(goalie=>`<li><b>${esc(goalie.team)}:</b> ${esc(goalie.name||'Goalie not named')} <span class="guy-call-goalie-status">${esc(goalie.status==='CONFIRMED'?'Confirmed':'Projected')}</span>${goalie.status!=='CONFIRMED'?` · recheck ${clock(goalie.recheckAt)}`:''}<small>Checked ${clock(goalie.observedAt)}${sourceLinks(goalie)?' · '+sourceLinks(goalie):''}</small></li>`).join('');
    const section=(key,title)=>{const item=research[key];return item?.summary?`<div class="guy-call-evidence"><h4>${title}</h4><p>${esc(item.summary)}</p><p class="resultsNote">Checked ${clock(item.observedAt)}${sourceLinks(item)?' · '+sourceLinks(item):''}</p></div>`:'';};
    const p=call.pinnacleAssessment;
    return `<details class="methodDetails"><summary>Goalies, hockey checks &amp; price disagreement</summary>${goalies.length?`<h4>Starting goalies</h4><ul class="guy-call-goalies">${goalieRows}</ul>`:''}${section('lineup','Lineup')}${section('restTravel','Rest &amp; travel')}${section('fiveOnFive','Five-on-five play')}${p?.reason?`<div class="guy-call-evidence"><h4>Pinnacle comparison · ${esc(p.status==='DISAGREES'?'Disagreement reviewed':p.status==='AGREES'?'Agreement reviewed':'Comparison unavailable')}</h4><p>${esc(p.reason)}</p></div>`:''}<p class="resultsNote">MoneyPuck starts the shortlist. Guy’s hockey review determines his daily selection; VigScope keeps its own grading.</p></details>`;
  }
  function snapshot(ledger){
    if(!valid(ledger))return null;
    return {schema:ledger.schema,characterId:ledger.characterId,policyId:ledger.policyId,startedAt:ledger.startedAt,effectiveFrom:ledger.effectiveFrom,updatedAt:ledger.updatedAt,entries:ledger.entries.map(entry=>({date:entry.date,state:entry.state,lockAt:entry.lockAt,call:entry.call,liveStatus:entry.liveStatus,result:entry.result}))};
  }
  function render(ledger,{now=new Date().toISOString(),id='guyActualCall',history=false}={}){
    const usable=valid(ledger),today=day(now),entry=usable?ledger.entries.find(e=>e.date===today):null,call=validCall(entry?.call)?entry.call:null,s=summary(ledger,now);
    const beforeLaunch=usable&&time(now)<time(ledger.effectiveFrom||ledger.startedAt),state=!usable?'UNAVAILABLE':beforeLaunch?'NOT_STARTED':status(entry,now);
    const q=latestQuote(entry),qTime=q?.observedAt||call?.quoteObservedAt,qPrice=q?.priceDecimal??call?.priceDecimal,qBook=q?.book??call?.book;
    const lastPriceLabel=state==='CURRENT'&&fresh(qTime,now)?'LATEST CAPTURED PRICE':'LAST CAPTURED PRICE';
    const record=usable?`<p class="guy-call-record"><b>GUY’S PUBLISHED PICKS:</b> ${s.wins}–${s.losses} · ${signed(s.netUnits,'u')} · ROI ${signed(s.roiPct,'%')} <span>(${s.settled} settled · flat 1u risk)</span></p>`:'<p class="guy-call-record">Guy’s published-pick record is unavailable.</p>';
    let body;
    if(!call||beforeLaunch){
      body=`<div class="guy-call-waiting"><h3>${state==='NOT_STARTED'?'A new daily call from November 1.':state==='UNAVAILABLE'?'Guy’s latest call could not be loaded.':'Guy is checking today’s shortlist.'}</h3><p>${state==='UNAVAILABLE'?'Refresh to check the saved selection.':state==='NOT_STARTED'?'One researched NHL moneyline, its recorded price and Guy’s limit.':'His daily play appears here after the hockey and price review.'}</p></div>`;
    }else{
      const checked=review(entry,now);
      const message=state==='LOCKED'?'This is the frozen published selection. Its recorded odds are used for results.':state==='CURRENT'?'Latest captured quote passes Guy’s limit. Check the sportsbook price before acting.':checked.reason||'The published selection is retained. A fresh price or hockey check is needed before acting.';
      const lockedReview=state==='LOCKED'&&['PRICE_EXPIRED','GOALIE_RECHECK_REQUIRED','RESEARCH_REQUIRED','PRICE_OUTSIDE_LIMIT'].includes(checked.state)?`<p class="guy-call-notice needs-review"><b>${labels[checked.state]}</b> · ${esc(checked.reason||'The saved hockey check needs attention.')} The published selection remains frozen.</p>`:'';
      body=`<div class="guy-call-main"><div><p class="key">${esc(call.away)} AT ${esc(call.home)} · ${clock(call.startTime)}</p><h3>${esc(call.team)} <strong>${american(call.priceDecimal)}</strong></h3><p class="guy-call-book">${esc(call.book)} · published ${clock(call.publishedAt)}</p></div><span class="guy-call-result">${esc(entry.result?.grade||'Result pending')}</span></div><div class="guy-call-prices"><div><small>PUBLISHED PRICE</small><b>${american(call.priceDecimal)}</b><span>${esc(call.book)} · ${clock(call.quoteObservedAt)}</span></div><div><small>${lastPriceLabel}</small><b>${american(qPrice)}</b><span>${esc(qBook)} · ${clock(qTime)}</span></div><div><small>DON’T CHASE PAST</small><b>${american(call.minDecimalPrice)}</b><span>That price or better</span></div><div><small>${state==='LOCKED'?'SELECTION FROZEN':'SELECTION LOCKS'}</small><b>${clock(entry.lockAt)}</b><span>One minute before this game</span></div></div><p class="guy-call-notice${state!=='CURRENT'&&state!=='LOCKED'?' needs-review':''}">${esc(message)}</p>${lockedReview}<div class="guy-call-reason"><p class="eyebrow">GUY’S READ</p><p>${esc(call.reason||call.supportReason)}</p>${call.supportReason&&call.supportReason!==call.reason?`<p><b>Strongest reason:</b> ${esc(call.supportReason)}</p>`:''}<p><b>Biggest concern:</b> ${esc(call.contraryReason)}</p></div>${researchDetails(call)}`;
    }
    const historyRows=usable?ledger.entries.filter(e=>validCall(e.call)).slice().sort((a,b)=>b.date.localeCompare(a.date)):[];
    const past=history?`<details class="methodDetails"><summary>Guy’s published selection history · ${historyRows.length} days</summary><div class="resultsScroll"><table><thead><tr><th>DATE / GAME</th><th>PUBLISHED SELECTION</th><th>STATUS / RESULT</th></tr></thead><tbody>${historyRows.map(e=>`<tr><td>${esc(e.date)}<small class="sampleNote">${esc(e.call.away)} at ${esc(e.call.home)}</small></td><td><b>${esc(e.call.team)} ${american(e.call.priceDecimal)}</b><small class="sampleNote">${esc(e.call.book)} · published ${clock(e.call.publishedAt)}</small></td><td>${esc(e.result?.grade||labels[status(e,now)]||'Pending')}<small class="sampleNote">${signed(e.result?.netUnits,'u')}</small></td></tr>`).join('')||'<tr><td colspan="3">The first published selection starts this record.</td></tr>'}</tbody></table></div></details>`:'';
    const encoded=JSON.stringify(snapshot(ledger)).replace(/</g,'\\u003c');
    return `<section id="${esc(id)}" class="resultsBox guy-value-card guy-daily-call" data-guy-call-state="${esc(state)}"><div class="guy-call-heading"><h2 class="resultsSection">GUY’S PLAY // DAILY NHL MONEYLINE</h2><span class="guy-call-state">${labels[state]||'REVIEW NEEDED'}</span></div>${body}${record}${past}<p class="resultsNote guy-call-method">One daily selection, with changes permitted until its own game’s cutoff. The MoneyPuck benchmark below keeps its separate historical record.</p><script type="application/json" data-guy-call-snapshot>${encoded}</script></section>`;
  }
  const timers=new Map();
  function watch({ledger,id='guyActualCall',history=false,document:doc=root.document}={}){
    if(!doc?.getElementById(id)||typeof root.setTimeout!=='function')return;
    if(timers.has(id)&&typeof root.clearTimeout==='function')root.clearTimeout(timers.get(id));
    const fingerprint=at=>{const entry=valid(ledger)?ledger.entries.find(e=>e.date===day(at)):null;return JSON.stringify({day:day(at),state:status(entry,at),review:validCall(entry?.call)?review(entry,at):null,record:summary(ledger,at)});};
    let previous=fingerprint(new Date().toISOString());
    const schedule=()=>{
      const stamp=Date.now(),entry=valid(ledger)?ledger.entries.find(e=>e.date===day(new Date(stamp).toISOString())):null,quote=latestQuote(entry);
      const deadlines=[time(entry?.lockAt),time(quote?.observedAt||entry?.call?.quoteObservedAt)+75*60000,time(modelObservedAt(entry))+75*60000,time(entry?.call?.researchedAt)+360*60000,...list(entry?.call?.research?.goalies).filter(g=>g.status==='PROJECTED').map(g=>time(g.recheckAt))].filter(t=>Number.isFinite(t)&&t>=stamp);
      const delay=Math.max(1,Math.min(60000,...deadlines.map(t=>t-stamp+1)));
      timers.set(id,root.setTimeout(()=>{
        const node=doc.getElementById(id);if(!node){timers.delete(id);return;}
        const at=new Date().toISOString(),next=fingerprint(at);
        if(next!==previous){
          const open=list(Array.from(node.querySelectorAll?.('details')||[])).map(detail=>detail.open);
          node.outerHTML=render(ledger,{now:at,id,history});
          Array.from(doc.getElementById(id)?.querySelectorAll?.('details')||[]).forEach((detail,index)=>{detail.open=!!open[index];});
          previous=next;
        }
        schedule();
      },delay));
    };
    schedule();
  }
  async function boot({base,read,id='guyActualCall'}={}){
    const node=root.document?.getElementById(id);if(!node)return;
    let ledger=null;
    try{
      if(read)ledger=await read('data/characters/guy-laflame/calls-ledger.json');
      else{
        const u=new URL('data/characters/guy-laflame/calls-ledger.json',base||new URL('../../../',root.location.href));u.searchParams.set('v',String(Date.now()));
        const response=await fetch(u,{cache:'no-store'});if(!response.ok)throw Error('Call unavailable');ledger=await response.json();
      }
    }catch{try{ledger=JSON.parse(node.querySelector('[data-guy-call-snapshot]')?.textContent||'null');}catch{}}
    node.outerHTML=render(ledger,{now:new Date().toISOString(),id});
    watch({ledger,id});
  }
  const api={day,clock,american,status,summary,render,watch,boot};root.GuyDailyCall=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
