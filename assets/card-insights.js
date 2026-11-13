(function(root){
  'use strict';
  // Display the issued game's research. Never fetch a newer board, change a
  // selection, infer a fair probability, or turn a reported starter into confirmed.
  const list=x=>Array.isArray(x)?x:[],clean=x=>String(x??'').replace(/\s+/g,' ').trim();
  const time=x=>Date.parse(x||''),same=(a,b)=>a===b||Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-8;
  const summary=typeof module==='object'&&module.exports?require('./card-summary.js'):root.BettingEdgeCardSummary;
  const names={espn:'ESPN',moneypuck:'MoneyPuck',dratings:'DRatings',nfelo:'nfelo',prediction_tracker:'The Prediction Tracker',bet_better:'Bet Better'};
  const technical=/\b(?:WRONG_[A-Z_]+|[A-Z]+_[A-Z_]{5,}|selectionKey|fairValueEvidence|schema|calibrated|calibration|calculation time|uncertainty interval|independent fair|market independence)\b/i;
  const clock=x=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(x))+' PT';}catch{return '';}};
  const day=x=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));}catch{return '';}};
  const short=x=>{const value=clean(x);return value.length>300?value.slice(0,297).replace(/\s+\S*$/,'')+'…':value;};
  const first=x=>{const value=clean(x);for(const m of value.matchAll(/[.!?](?:\s|$)/g)){if(m[0][0]==='.'&&/\b(?:St|Dr|Mr|vs|No)$/i.test(value.slice(0,m.index)))continue;return value.slice(0,m.index+1);}return value;};
  const readable=x=>Boolean(clean(x))&&!technical.test(clean(x))&&!/^(?:NR\b|No additional supporting|Current event evidence and applicable strategy|The current source review addressed)/i.test(clean(x));
  const repeatedPrice=x=>/exact executable-to-benchmark|exact paired Pinnacle benchmark|qualified paired Pinnacle reference|used only for a zero-stake exact-price/i.test(clean(x));
  function validSelection(rec){
    const f=rec?.feed||{},p=String(f.selectionKey||'').split('|');
    return Number.isFinite(time(f.eventDate))&&p.length===5&&p[0]===String(f.eventId)&&p[1]===f.marketKey&&p[2]===f.side&&p[3]===''&&
      (f.marketKey==='ml'?['home','away'].includes(f.side)&&p[4]===''&&f.line==null:
        ['spread','totals'].includes(f.marketKey)&&Number.isFinite(f.line)&&Number(p[4])===f.line)&&
      Number.isFinite(f.priceDecimal)&&f.priceDecimal>1;
  }
  function describe(rec,run){
    const asOf=time(run?.ts),f=rec?.feed||{},sport=rec?.coreAssessment?.context?.sport;
    const exact=validSelection(rec),snapshot=run?.gameIntelligence;
    const candidates=exact&&Number.isFinite(asOf)&&(!snapshot?.asOf||time(snapshot.asOf)<=asOf)?list(snapshot?.games).filter(g=>
      String(g.eventId)===String(f.eventId)&&Number.isFinite(time(g.startTime))&&time(g.startTime)===time(f.eventDate)&&
      (!sport||sport===g.sport||sport==='NBA_WNBA'&&['NBA','WNBA'].includes(g.sport))):[];
    const game=candidates.length===1?candidates[0]:null;
    const current=x=>Number.isFinite(time(x.observedAt))&&time(x.observedAt)<=asOf&&time(x.observedAt)<time(f.eventDate);
    const facts=list(game?.facts).filter(x=>current(x)&&(!x.eventId||String(x.eventId)===String(f.eventId))&&
      (!x.startTime||time(x.startTime)===time(f.eventDate))&&(!x.sport||x.sport===game.sport));
    const latest=(kind,team)=>facts.filter(x=>x.kind===kind&&x.details?.team===team).sort((a,b)=>time(b.observedAt)-time(a.observedAt))[0];
    const sources=[];const cite=x=>{if(x?.url)sources.push({url:x.url,sourceId:x.sourceId,observedAt:x.observedAt});};
    const teams=game?[game.away,game.home].map((team,index)=>{
      const record=latest('TEAM_RECORD',team),recent=latest('RECENT_GAMES',team),injury=latest('INJURIES',team),goalie=latest('STARTING_GOALIE',team);
      const games=[...new Map(list(recent?.details?.events).filter(e=>Number.isFinite(time(e.date))&&time(e.date)<asOf&&/^[WL](?:IN|OSS)?$/i.test(e.result||''))
        .sort((a,b)=>time(b.date)-time(a.date)).map(e=>[[e.date,e.opponent].join('|'),e])).values()].slice(0,5);
      const rows=list(record?.details?.records),overall=rows.find(x=>['total','overall'].includes(x.type)),split=rows.find(x=>x.type===(index?'home':'road'));
      const wins=games.filter(x=>/^W/i.test(x.result)).length;
      const last=games[0];let rest=null;
      if(last){const a=day(last.date),b=day(game.startTime);if(a&&b&&Date.parse(b)-Date.parse(a)===86400000)rest='Played the previous day';}
      [record,recent,injury,goalie].forEach(cite);
      return {team,location:index?'Home':'Away',record:clean(overall?.summary||overall?.displayValue),
        split:split?`${index?'Home':'Away'} ${clean(split.summary||split.displayValue)}`:null,
        form:games.length?`${wins}W–${games.length-wins}L in last ${games.length} recorded`:null,
        lastGame:last?`${/^W/i.test(last.result)?'W':'L'} vs ${clean(last.opponent)}${last.score?' · '+clean(last.score):''}`:null,rest,
        goalie:goalie?.details?.name?{name:clean(goalie.details.name),status:({CONFIRMED:'Confirmed',PROJECTED:'Projected',EXPECTED:'Projected',PROBABLE:'Probable'})[clean(goalie.details.status).toUpperCase()]||'Unconfirmed'}:null,
        injuries:list(injury?.details?.players).filter(p=>clean(p.name)&&clean(p.status)).map(p=>({name:clean(p.name),status:clean(p.status),detail:clean(p.detail)==='Not Specified'?'':clean(p.detail)}))};
    }):[];
    const eligible=new Set(list(rec?.forecastReview?.eligibleExactRecordIds)),forecasts=new Map();
    for(const model of list(rec?.forecastReview?.records)){
      if(!exact||!Number.isFinite(asOf)||!eligible.has(model?.recordId)||!summary?.exactForecastComparison(rec,model)||
        model.observedAt&&(!Number.isFinite(time(model.observedAt))||time(model.observedAt)>asOf)||
        model.eventId&&String(model.eventId)!==String(f.eventId)||model.startTime&&time(model.startTime)!==time(f.eventDate))continue;
      const key=model.modelFamily||model.sourceId,previous=forecasts.get(key);
      if(!previous||time(model.observedAt)>time(previous.observedAt))forecasts.set(key,model);
    }
    const views=[...forecasts.values()].map(m=>{cite(m);return {name:names[m.sourceId]||clean(m.publisher||m.sourceId),probability:m.probability,
      breakEven:m.comparison.breakEvenProbability,gap:m.comparison.edgeProbabilityPoints,
      refundedPushes:m.comparison.breakEvenProbability<1/f.priceDecimal-1e-8};});
    const findingRows=list(rec?.cardEvidence?.findings).filter(x=>['CONTEXT','SUPPORT','CONTRARY'].includes(x.stance)&&readable(x.finding));
    const authoredNotes=findingRows.filter(x=>x.stance==='CONTEXT').map(x=>short(x.finding));
    const procedural=/\b(?:review clock|source clock|not backdated|captured dossier|NOT YET SUBMITTED|source identity|concrete recheck|no official|authoritatively confirmed)\b/i;
    const reportedNotes=facts.filter(x=>['OFFICIAL','REPORTING','MATCHUP','REST_TRAVEL'].includes(x.kind)&&readable(x.finding)&&!procedural.test(x.finding))
      .map(x=>{cite(x);return short(x.finding);});
    const notes=[...new Set(authoredNotes.length?authoredNotes:reportedNotes)].slice(0,2);
    const opinion=rec?.forecastLean||rec?.forecastWait;
    const reason=first(opinion?.rationale||rec?.marketAssessment?.decisionRationale||rec?.analysis||rec?.support);
    const checks=[opinion?.recheckCondition,rec?.cardEvidence?.waitCondition?.trigger,...list(rec?.personnelEvidence?.unresolved)].filter(readable).map(short);
    const uniqueChecks=[...new Set(checks)].filter((x,i,all)=>!all.some((other,j)=>j<i&&other.includes(x)));
    if(facts.some(x=>/source identity anomaly/i.test(x.finding||'')))uniqueChecks.push('Verify the flagged player/team identity in the reported availability.');
    const boundBenchmark=rec?.pinnacleBenchmark;
    const reference=exact&&rec?.marketAssessment?.basis==='QUALIFIED_PINNACLE'&&rec.marketAssessment.selectionKey===f.selectionKey
      ?rec.marketAssessment.referenceProbability:exact&&boundBenchmark?.state==='QUALIFIED'&&boundBenchmark.selectionKey===f.selectionKey&&
        String(boundBenchmark.eventId)===String(f.eventId)&&boundBenchmark.marketKey===f.marketKey?boundBenchmark.noVigProbability:null;
    const benchmark=Number.isFinite(reference)&&reference>0&&reference<1?(reference-1/f.priceDecimal)*100:null;
    return {snapshotAt:run?.ts||null,gameLabel:game?.label||null,venue:clean(facts.find(x=>x.kind==='VENUE')?.details?.name),
      teams,views,notes,reason:readable(reason)?short(reason):null,checks:uniqueChecks,benchmark,
      sources:[...new Map(sources.map(s=>[s.url+'|'+s.observedAt,s])).values()]};
  }
  function brief(rec,run){
    const data=describe(rec,run),exact=validSelection(rec),evidence=rec?.cardEvidence,
      bound=exact&&evidence?.selectionKey===rec.feed.selectionKey;
    const sourceIds=new Set(list(rec?.sourceEvidence).map(source=>source.id));
    const findings=bound?list(evidence.findings).filter(row=>list(row.sourceIds).length&&row.sourceIds.every(id=>sourceIds.has(id))):[];
    const opinion=rec?.forecastLean || rec?.forecastWait;
    const rationale=[bound?evidence.decisionExplanation:null,opinion?.rationale,
      exact&&rec?.marketAssessment&&rec.marketAssessment.selectionKey===rec.feed.selectionKey?rec.marketAssessment.decisionRationale:null,
      data.reason,rec?.analysis].find(readable);
    const whyTonight=clean(rec?.status).toUpperCase()==='PASS'&&data.benchmark<0&&repeatedPrice(rationale)?
      'Pass: the available odds fall short of the recorded Pinnacle reference.':
      rationale?short(rationale):'A clear game-specific reason was not recorded in this report.';
    const f=rec?.feed || {},american=exact?(f.priceDecimal>=2?'+'+Math.round((f.priceDecimal-1)*100):String(-Math.round(100/(f.priceDecimal-1)))):null;
    const price=exact?[clean(rec.book),american].filter(Boolean).join(' '):null;
    const forecasts=data.views.slice(0,2).map(v=>v.name+': '+(v.probability*100).toFixed(1)+'% versus '+
      (v.breakEven*100).toFixed(1)+'% to break even'+(v.refundedPushes?' after allowing for refunded pushes':'')+'.');
    const target=readable(rec?.playTo || rec?.betAt)?clean(rec.playTo || rec.betAt):'';
    const whyPrice=exact?[price+'.',...forecasts,target&&target!=='NO BET'?'Price limit: '+target+'.':'',
      data.benchmark!==null?'Pinnacle comparison: '+(data.benchmark>=0?'+':'−')+Math.abs(data.benchmark).toFixed(2)+' percentage points.':''].filter(Boolean).join(' '):'An executable price was not verified.';
    const opposing=findings.find(row=>row.stance==='CONTRARY'&&readable(row.finding)&&!repeatedPrice(row.finding));
    const unresolved=findings.find(row=>row.stance==='UNRESOLVED'&&readable(row.finding));
    const risk=opposing?short([opposing.finding,opposing.application].filter(readable).join(' ')):
      readable(rec?.contrary)&&!repeatedPrice(rec.contrary)&&!/^No additional opposing/i.test(clean(rec.contrary))?short(rec.contrary):
      unresolved?short(unresolved.finding):data.checks[0] || (data.benchmark<0?'Pinnacle prices this side below the offered break-even chance.':'A specific opposing case was not recorded in this report.');
    const status=clean(rec?.status).toUpperCase();
    const action={BET:'Use the recorded stake and price limit.',LEAN:'Lean only; no stake is recommended.',
      WAIT:'Wait for the stated condition before reconsidering.',PASS:'Pass at this price.'}[status] || 'The decision needs review.';
    const checks=[...new Set(data.checks)].filter(check=>clean(check)!==clean(risk)).slice(0,2);
    const timing=[action,...checks].join(' ');
    const sources=[...data.sources,...list(rec?.sourceEvidence).filter(source=>Number.isFinite(time(source.checkedAt || source.asOf))&&
      time(source.checkedAt || source.asOf)<=time(run?.ts)&&time(source.checkedAt || source.asOf)<time(f.eventDate))
      .map(source=>({url:source.url,sourceId:source.title || source.id,observedAt:source.checkedAt || source.asOf}))];
    return {whyTonight,whyPrice,risk,timing,snapshotAt:data.snapshotAt,oddsAt:run?.feedGeneratedAt || null,
      sources:[...new Map(sources.map(source=>[source.url+'|'+source.observedAt,source])).values()]};
  }
  function node(d,tag,text,cls){const e=d.createElement(tag);if(text!==undefined)e.textContent=root.VigScopeOddsFormat?root.VigScopeOddsFormat.text(text):text;if(cls)e.className=cls;return e;}
  function style(d){if(!d.head||d.getElementById?.('cardInsightsStyle'))return;const s=node(d,'style');s.id='cardInsightsStyle';s.textContent=`
    .runnerInsights{border-top:1px solid var(--line,#16445a);margin-top:10px;padding-top:12px;font-size:13px;line-height:1.55;overflow-wrap:anywhere}
    .runnerInsights h4{font-size:12px;letter-spacing:.04em;color:var(--cyan,#39e7ff);margin:0 0 7px}.runnerInsights p{margin:5px 0}.runnerInsightsMeta{font-size:11px;color:var(--muted,#7ea0ad);margin-bottom:12px}
    .runnerInsightsTeams{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.runnerInsightsTeam,.runnerInsightsSection{padding:11px;background:var(--panel,#071321);border:1px solid var(--line,#16445a);border-radius:5px;min-width:0}
    .runnerInsightsSection{margin-top:10px}.runnerInsightsTeam strong{display:block}.runnerInsightsRecord{color:var(--text,#d9f6ff);font-weight:700}.runnerInsights ul{padding-left:18px;margin:5px 0}.runnerInsights li{margin:5px 0}.runnerInsightsWatch{border-left:3px solid var(--yellow,#ffe96b)}
    .runnerInsightsSources{display:flex;gap:7px 14px;flex-wrap:wrap;margin-top:10px;font-size:11px}.runnerInsightsSources a{color:var(--muted,#7ea0ad)}.runnerInsights .runnerInsightsEmpty{color:var(--muted,#7ea0ad)}
    .runnerExpanded>.runnerEvidence{margin-top:12px}.runnerExpanded>.runnerEvidence>summary{font-size:11px;color:var(--muted,#7ea0ad);cursor:pointer;padding:8px 0}
    @media(max-width:600px){.runnerInsightsTeams{grid-template-columns:1fr}.runnerInsights{font-size:13px}.runnerInsightsTeam,.runnerInsightsSection{padding:10px}}
  `;d.head.appendChild(s);}
  function render(d,rec,run){
    const data=brief(rec,run);style(d);const panel=node(d,'section',undefined,'runnerInsights');panel.setAttribute('aria-label','Tonight betting analysis for this selection');
    for(const [title,text] of [['WHY THIS PLAY TONIGHT?',data.whyTonight],['WHY THIS PRICE?',data.whyPrice],
      ['STRONGEST CONCERN',data.risk],['ACT NOW OR WAIT?',data.timing]]){
      const box=node(d,'section',undefined,'runnerInsightsSection');box.append(node(d,'h4',title),node(d,'p',text));panel.append(box);
    }
    const sources=node(d,'details',undefined,'runnerEvidence');sources.append(node(d,'summary','SOURCES & SNAPSHOT'));
    sources.append(node(d,'div',[data.snapshotAt?'Report · '+clock(data.snapshotAt):'',data.oddsAt?'Odds · '+clock(data.oddsAt):''].filter(Boolean).join(' · '),'runnerInsightsMeta'));
    const links=node(d,'div',undefined,'runnerInsightsSources');
    for(const source of data.sources){try{const u=new URL(source.url);if(u.protocol!=='https:'||u.username||u.password)continue;
      const raw=clean(source.sourceId),name=names[raw]||(/^Pinned exact Pinnacle/i.test(raw)?'Pinnacle':
        /^\d{5,}|current-info|selectionKey|checkpoint|schema|\|/i.test(raw)?u.hostname.replace(/^www\./,''):raw||u.hostname.replace(/^www\./,''));
      const a=node(d,'a',`${name} · ${clock(source.observedAt)}`);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}catch{}}
    if(links.children.length)sources.append(links);panel.append(sources);return panel;
  }
  const api={describe,brief,render};if(typeof module==='object'&&module.exports)module.exports=api;else root.BettingEdgeCardInsights=api;
})(typeof globalThis!=='undefined'?globalThis:this);
