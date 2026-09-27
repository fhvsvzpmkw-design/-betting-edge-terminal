(function(root){
  'use strict';
  const list=x=>Array.isArray(x)?x:[];
  const pct=x=>typeof x==='number'?(x*100).toFixed(1)+'%':'—';
  const names={espn:'ESPN',nfelo:'nfelo',dimers:'Dimers',dratings:'DRatings',moneypuck:'MoneyPuck',fangraphs:'FanGraphs',stats_insider:'Stats Insider',dunks_threes:'Dunks & Threes',puckcast:'PuckCast',oddstrader:'OddsTrader'};
  const market=x=>/moneyline/.test(x)?'Moneyline':/spread|run_line|puck_line/.test(x)?'Spread':/total/.test(x)?'Total':x;
  const signed=n=>typeof n==='number'?(n>0?'+':'')+n:'—';
  const clock=x=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(x))+' PT';}catch{return 'Time unavailable';}};
  function node(d,tag,text,className){const e=d.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
  function sourceLink(d,label,url){
    const a=node(d,'a',label);try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)return node(d,'span',label);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}catch{return node(d,'span',label);}return a;
  }
  function style(d){if(d.getElementById('gameIntelligenceStyle'))return;const s=node(d,'style');s.id='gameIntelligenceStyle';s.textContent=`
    .gi-panel{border:1px solid #2c6650;background:#071b14;color:#d9f5e8;padding:14px;margin:14px 0;border-radius:8px;font:13px/1.5 ui-monospace,monospace;overflow-wrap:anywhere}
    .gi-panel h2{font-size:17px;margin:0 0 7px;color:#a7f3ce}.gi-panel h3{font-size:13px;margin:15px 0 7px;color:#a7f3ce}.gi-meta{color:#9dbdad;font-size:12px}.gi-panel a{color:#8ce9ba}.gi-game{border-top:1px solid #28533e;padding:12px 0}.gi-game>summary{cursor:pointer;font-weight:bold;list-style-position:outside;margin-left:14px}.gi-scroll{overflow-x:auto;margin:8px 0}.gi-panel table{border-collapse:collapse;width:100%;font:inherit;min-width:490px}.gi-panel th,.gi-panel td{text-align:left;border-bottom:1px solid #244835;padding:7px 9px;vertical-align:top}.gi-panel th{font-size:11px;color:#a7d8bd}.gi-warning{color:#eacb82}.gi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.gi-fact{padding:8px;background:#10291e;border-radius:5px}.gi-panel details details{margin:10px 0}.gi-panel button,.gi-panel input,.gi-panel select{font:inherit;color:inherit;background:#10291e;border:1px solid #3f7157;border-radius:4px;padding:7px}.gi-controls{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}.gi-controls input{flex:1;min-width:150px}
  `;d.head.appendChild(s);}
  function table(d,headers,rows){const wrap=node(d,'div',undefined,'gi-scroll'),t=node(d,'table'),head=node(d,'tr');for(const h of headers)head.append(node(d,'th',h));const thead=node(d,'thead');thead.append(head);t.append(thead);const body=node(d,'tbody');for(const cells of rows){const tr=node(d,'tr');for(const value of cells){const td=node(d,'td');if(value&&typeof value==='object'&&value.nodeType)td.append(value);else td.textContent=value??'—';tr.append(td);}body.append(tr);}t.append(body);wrap.append(t);return wrap;}
  function factText(f){if(f.finding)return f.finding;const x=f.details||{};if(f.kind==='INJURIES')return `${x.team||''}: ${list(x.players).map(p=>`${p.name}: ${p.status}`).join('; ')||'No entries supplied'}`;if(f.kind==='TEAM_RECORD')return `${x.team||''}: ${list(x.records).map(r=>r.summary||r.displayValue).filter(Boolean).join(' / ')||'Not supplied'}`;if(f.kind==='VENUE')return `${x.name||'Venue not supplied'}${x.indoor===true?' · Indoors':''}${x.neutralSite?' · Neutral site':''}`;if(f.kind==='RECENT_GAMES')return `${x.team||''}: ${list(x.events).map(e=>[e.result,e.score,e.opponent].filter(Boolean).join(' ')).join('; ')}`;return JSON.stringify(x);}
  function game(d,g,knowledge){
    const details=node(d,'details',undefined,'gi-game');details.id='game-intelligence-'+g.eventId;
    details.append(node(d,'summary',`${g.label} · ${g.sport} · ${clock(g.startTime)}`));
    details.append(node(d,'div',`${g.summary.sources} outside sources · ${g.summary.modelFamilies} external model families · ${g.summary.internalFamilies} internal family · ${g.summary.exactReviewed} exact selections reviewed`,'gi-meta'));
    const rows=list(g.externalModels).map(r=>{
      const side=['home','away'].includes(r.side)?g[r.side]:r.side;
      const value=r.kind==='OUTCOME_PROBABILITY'?pct(r.probability):r.projection?.homeSpread!=null?`${g.home} ${signed(r.projection.homeSpread)}`:r.projection?JSON.stringify(r.projection):r.pick||'—';
      return [sourceLink(d,names[r.sourceId]||r.sourceId,r.url),`${market(r.marketDetail)}${r.line!=null?' '+signed(r.line):''}`,side,value,
        `${clock(r.observedAt)}${r.freshness==='REFRESH_DUE'?' · Refresh due':''}`];
    });
    details.append(node(d,'h3','OUTSIDE MODELS'));
    details.append(rows.length?table(d,['SOURCE','MARKET / LINE','SIDE','PUBLISHED VALUE','OBSERVED'],rows):node(d,'div','No captured outside prediction for this game yet.','gi-meta'));
    const ranges=list(g.consensus).filter(c=>c.families>1);
    for(const c of ranges)details.append(node(d,'div',`${market(c.marketDetail)} ${g[c.side]||c.side}${c.line!=null?' '+signed(c.line):''}: ${pct(c.min)}–${pct(c.max)} across ${c.families} families; median ${pct(c.median)}. Descriptive range, not a confidence interval.`,'gi-meta'));
    if(g.internalModels?.length){details.append(node(d,'h3','GRAHAM / WALTERS'));for(const m of g.internalModels){details.append(node(d,'div',`${g.home} ${signed(m.homeFairPoints)} · ${clock(m.observedAt)}`));details.append(node(d,'p',m.summary));if(m.numberStatus?.includes('UNRESOLVED'))details.append(node(d,'div','Personnel or quarterback inputs remain unresolved. Review the current game assessment.','gi-warning'));}}
    details.append(node(d,'h3','AVAILABLE PRICES'));
    details.append(node(d,'div',`Odds snapshot ${clock(g.priceSnapshotAt)}. Verify an executable current price before acting.`,'gi-meta'));
    const quotes=list(g.markets).flatMap(m=>list(m.quotes).map(q=>[market(m.marketDetail),g[m.side]||m.side,q.line!=null?signed(q.line):'—',q.book||'—',q.priceDecimal?.toFixed(3)||'—',pct(q.breakEvenProbability),
      `${clock(q.observedAt||q.changedAt)}${q.priceState==='REFRESH_REQUIRED'?' · Refresh required':''}`]));
    details.append(table(d,['MARKET','SIDE','LINE','BOOK','DECIMAL','BREAK-EVEN','OBSERVED'],quotes));
    const benchmarks=list(g.markets).flatMap(m=>list(m.quotes).filter(q=>q.benchmark).map(q=>[market(m.marketDetail),g[m.side]||m.side,q.line!=null?signed(q.line):'—',q.book,pct(q.benchmark.benchmarkNoVigProbability),q.benchmark.edgeProbabilityPoints.toFixed(2)+' pp']));
    if(benchmarks.length){details.append(node(d,'h3','PINNACLE PRICE COMPARISON'));details.append(table(d,['MARKET','SIDE','LINE','EXECUTION BOOK','NO-VIG REFERENCE','PRICE DIFFERENCE'],benchmarks));}
    else details.append(node(d,'div','A current exact Pinnacle comparison is unavailable in this snapshot.','gi-meta'));
    const moves=list(g.markets).flatMap(m=>list(m.quotes).filter(q=>q.movement).map(q=>`${q.book} ${market(m.marketDetail)} ${g[m.side]||m.side}: ${q.movement.lineChange?`line ${signed(q.movement.previousLine)} → ${signed(q.line)}`:`decimal ${q.movement.previousPrice} → ${q.priceDecimal}`} since ${clock(q.movement.from)}`));
    if(moves.length){const movement=node(d,'details');movement.append(node(d,'summary','PRICE MOVEMENT'));for(const text of moves)movement.append(node(d,'p',text));details.append(movement);}
    if(g.facts?.length){const f=node(d,'details');f.append(node(d,'summary',`EVENT RESEARCH · ${g.facts.length} observations`));const grid=node(d,'div',undefined,'gi-grid');for(const fact of g.facts){const box=node(d,'div',undefined,'gi-fact');box.append(node(d,'b',fact.kind||'RESEARCH'),node(d,'div',factText(fact)),sourceLink(d,clock(fact.observedAt),fact.url));grid.append(box);}f.append(grid);details.append(f);}
    const relevant=list(knowledge).filter(k=>list(g.knowledgeIds).includes(k.id));
    if(relevant.length){const k=node(d,'details');k.append(node(d,'summary',`KNOWLEDGE BASE · ${relevant.length} research references`));k.append(node(d,'p','These principles need an explicit connection to the game. They are not extra model votes.','gi-meta'));for(const item of relevant){const p=node(d,'p');p.append(node(d,'b',item.topic+' · '),d.createTextNode(item.guidance||item.finding));k.append(p);}details.append(k);}
    if(g.externalModels?.length){const limits=node(d,'details');limits.append(node(d,'summary','MODEL NOTES'));for(const r of g.externalModels)limits.append(node(d,'p',`${names[r.sourceId]||r.sourceId}: ${r.limitation||'Review applicability.'}`));details.append(limits);}
    return details;
  }
  function render(d,intelligence){
    if(!intelligence?.games)return null;style(d);const panel=node(d,'section',undefined,'gi-panel');panel.id='gameIntelligence';
    panel.append(node(d,'h2','GAME INTELLIGENCE'),node(d,'div',`${intelligence.counts?.games||0} games · ${intelligence.counts?.withExternalModels||0} with outside models · ${intelligence.counts?.withInternalModels||0} with internal fair lines`),node(d,'p',`Snapshot ${clock(intelligence.asOf)}. Published forecasts, available prices and game research shown together.`,'gi-meta'));
    if(intelligence.view==='CURRENT_GAME_BOARD'){
      const age=(Date.now()-Date.parse(intelligence.asOf))/60000;
      if(age>75)panel.append(node(d,'p',`This board was collected ${Math.floor(age)} minutes ago. Some games may have started and sources need refreshing. The Refresh board button reloads the latest saved collection.`,'gi-warning'));
    }
    const controls=node(d,'div',undefined,'gi-controls'),search=node(d,'input'),sport=node(d,'select');search.placeholder='Find a team or game';search.setAttribute('aria-label','Find a team or game');sport.setAttribute('aria-label','Filter sport');sport.append(node(d,'option','All sports'));for(const s of [...new Set(intelligence.games.map(g=>g.sport))])sport.append(node(d,'option',s));controls.append(search,sport);panel.append(controls);
    const games=node(d,'div');panel.append(games);const draw=()=>{games.replaceChildren();const visible=intelligence.games.filter(g=>(sport.value==='All sports'||g.sport===sport.value)&&g.label.toLowerCase().includes(search.value.toLowerCase()));for(const g of visible)games.append(game(d,g,intelligence.knowledge));if(!visible.length)games.append(node(d,'p','No matching games in this snapshot.','gi-meta'));};search.oninput=draw;sport.onchange=draw;draw();
    const status=node(d,'details');status.append(node(d,'summary','SOURCE COVERAGE'));const grouped=new Map();for(const s of list(intelligence.sources)){if(!grouped.has(s.sourceId))grouped.set(s.sourceId,new Set());grouped.get(s.sourceId).add(s.state);}for(const [id,states] of grouped)status.append(node(d,'p',`${names[id]||id}: ${[...states].map(s=>({COLLECTED:'data collected',CACHED:'saved data reused',CONTEXT_ONLY:'game context available',UNAVAILABLE:'currently unavailable',RESEARCH_OR_LICENSED_IMPORT:'source research or permitted feed needed',NO_EXACT_EVENT:'no exact game match',EVENT_STARTED:'game already started'}[s]||s)).join('; ')}`));panel.append(status);
    if(intelligence.sourcePerformance){const p=intelligence.sourcePerformance;panel.append(node(d,'h3','SOURCE TRACKING'));panel.append(node(d,'p',`${p.counts?.graded||0} forecasts graded across ${p.counts?.events||0} games. Each source and market is counted once per game; repeated pulls do not add results.`,'gi-meta'));if(p.bySource?.length)panel.append(table(d,['SOURCE','MARKET','GRADED','BASIS VERIFIED','BRIER SCORE'],p.bySource.map(s=>[names[s.sourceId]||s.sourceId,market(s.marketDetail),s.graded,s.scored,s.brier==null?'Pending':s.brier.toFixed(4)])));}
    return panel;
  }
  root.BettingEdgeIntelligence={render};
})(typeof globalThis!=='undefined'?globalThis:this);
