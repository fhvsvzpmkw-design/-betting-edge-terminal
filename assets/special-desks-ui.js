(()=>{
'use strict';

const PIZZA_URL='./data/pizza-plays.json';
const CRYPTO_URL='./data/crypto-specials.json';
const PIZZA_ID='runnerPizzaF6';
const CRYPTO_ID='runnerCryptoF7';
const MEAT_ID='runnerSeasonPreviewF6';
const PREF_ID='runnerPreferencesF6';
const PIZZA_PANEL='runnerPizzaWorkspace';
const CRYPTO_PANEL='runnerCryptoWorkspace';
const STYLE_ID='runnerSpecialDesksStyle';
const CRYPTO_ANALYSIS_MODE_KEY='bettingEdge.preferences.cryptoSpecialsAnalysisMode';
let pizza=null,crypto=null,lastDoc=null,observer=null;

function appDoc(){
  try{
    const core=document.getElementById('core');
    const app=core?.contentDocument?.getElementById('app');
    return app?.contentDocument||null;
  }catch{return null}
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safeUrl(v){
  try{const u=new URL(String(v||''),location.href);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}
}
function cryptoAnalysisModeLabel(){
  let value='basic_readthrough';
  try{value=localStorage.getItem(CRYPTO_ANALYSIS_MODE_KEY)||'basic_readthrough'}catch{}
  return ({basic_readthrough:'BASIC READ-THROUGH',in_depth_report:'IN-DEPTH REPORT',god_mode:'GOD MODE'})[value]||'BASIC READ-THROUGH';
}
function publishedModeLabel(){
  const value=String(crypto?.board?.analysisMode||crypto?.dailyPolicy?.analysisMode||'').toLowerCase();
  return ({basic_readthrough:'BASIC READ-THROUGH',in_depth_report:'IN-DEPTH REPORT',god_mode:'GOD MODE'})[value]||cryptoAnalysisModeLabel();
}
function cryptoButtonMessage(){
  const sourceCount=crypto?.source?.url?1:(Array.isArray(crypto?.items)?crypto.items.length:0);
  const cardCount=Array.isArray(crypto?.board?.cards)?crypto.board.cards.filter(x=>String(x?.status||'').toUpperCase()!=='PASS').length:0;
  const cardText=cardCount?` // ${cardCount} LIVE CARD${cardCount===1?'':'S'}`:'';
  return `${sourceCount} WEB SOURCE${sourceCount===1?'':'S'} // ${publishedModeLabel()}${cardText}&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F6] TO OPEN`;
}
function closeSpecial(d){
  d.body.classList.remove('runnerPizzaLoaded','runnerCryptoLoaded');
  d.getElementById(PIZZA_ID)?.classList.remove('active');
  d.getElementById(CRYPTO_ID)?.classList.remove('active');
}
function closeAllDesks(d){
  closeSpecial(d);
  d.body.classList.remove('runnerSeasonPreviewsLoaded','runnerSyndicateLoaded','runnerPreferencesLoaded');
  d.getElementById(MEAT_ID)?.classList.remove('active');
  d.getElementById(PREF_ID)?.classList.remove('active');
}
function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');s.id=STYLE_ID;s.textContent=`
    #${PIZZA_ID},#${CRYPTO_ID},#${MEAT_ID}{grid-column:1/-1!important;display:grid!important;place-items:center!important;gap:7px!important;padding:10px 8px!important}
    #runnerSyndicateF5{box-shadow:inset 0 0 0 1px rgba(255,232,145,.10),0 0 12px rgba(216,173,56,.18),0 0 26px rgba(216,173,56,.08)!important;text-shadow:0 0 7px rgba(255,216,106,.34),0 0 14px rgba(255,216,106,.14)!important}
    #runnerSyndicateF5:hover,#runnerSyndicateF5.loaded{box-shadow:inset 0 0 0 1px rgba(255,240,170,.16),0 0 16px rgba(255,210,80,.26),0 0 30px rgba(255,210,80,.12)!important;text-shadow:0 0 8px rgba(255,225,125,.42),0 0 16px rgba(255,216,106,.18)!important}
    #${PIZZA_ID}{border-color:#c97035!important;color:#ffd7a3!important;background:#100704!important;box-shadow:inset 0 0 0 1px rgba(255,166,80,.05),0 0 10px rgba(220,105,35,.08)!important}
    #${PIZZA_ID}:hover,#${PIZZA_ID}.active{border-color:#ff9a49!important;color:#fff0c9!important;background:#1a0a04!important}
    #${CRYPTO_ID}{border-color:#6552a8!important;color:#cfc4ff!important;background:#070611!important;box-shadow:inset 0 0 0 1px rgba(156,130,255,.05),0 0 10px rgba(93,70,180,.08)!important}
    #${CRYPTO_ID}:hover,#${CRYPTO_ID}.active{border-color:#9c87ff!important;color:#eee9ff!important;background:#0d0a1c!important;box-shadow:inset 0 0 0 1px rgba(185,165,255,.08),0 0 15px rgba(130,94,255,.16)!important}
    .specialMain{display:block;font-size:inherit}.specialMessage{display:block;font-size:8px;font-weight:900;letter-spacing:.11em;line-height:1.35}.pizzaMessage{color:#c98a59}.cryptoMessage{color:#9e91dc}
    #${PIZZA_PANEL},#${CRYPTO_PANEL}{display:none;margin:0 12px 14px;padding:12px;min-height:65vh;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    #${PIZZA_PANEL}{border:1px solid #6d3b20;background:radial-gradient(circle at 50% -20%,rgba(159,68,22,.20),transparent 48%),linear-gradient(180deg,#0d0703,#030303);color:#ecd8c4}
    #${CRYPTO_PANEL}{border:1px solid #4a3b76;background:radial-gradient(circle at 50% -20%,rgba(76,51,153,.13),transparent 42%),linear-gradient(180deg,#05050b,#020306 58%,#010204);color:#ddd8f6;box-shadow:inset 0 0 28px rgba(109,77,207,.025);font-size:16px}
    body.runnerPizzaLoaded .top,body.runnerCryptoLoaded .top{display:none!important}
    body.runnerPizzaLoaded .runnerNavPad,body.runnerCryptoLoaded .runnerNavPad{padding-top:8px!important;padding-bottom:0!important;margin-top:0!important}
    body.runnerPizzaLoaded .runnerNavPad .tabs>.btn:not(#${PIZZA_ID}){display:none!important}
    body.runnerCryptoLoaded .runnerNavPad .tabs>.btn:not(#${CRYPTO_ID}){display:none!important}
    body.runnerPizzaLoaded #${PIZZA_PANEL},body.runnerCryptoLoaded #${CRYPTO_PANEL}{display:block!important;margin-top:0!important}
    body.runnerPizzaLoaded #${PIZZA_PANEL}~*,body.runnerCryptoLoaded #${CRYPTO_PANEL}~*{display:none!important}
    .specialHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.12)}.specialHead h2{margin:0;font-size:18px;letter-spacing:.12em}.pizzaHead h2{color:#ffc078}.cryptoHead h2{color:#d9d1ff;text-shadow:0 0 10px rgba(157,126,255,.18);font-size:20px}.specialHead p{margin:5px 0 0;color:#998f8a;font-size:8px;line-height:1.5;letter-spacing:.05em}.cryptoHead p{color:#8e83b4;font-size:10px}.specialBadge{border:1px solid currentColor;padding:6px 9px;font-size:8px;font-weight:950;letter-spacing:.09em}.pizzaBadge{color:#ffb066;background:#160904}.cryptoBadge{color:#c6b8ff;background:#0b0818;font-size:10px}
    .specialShelf{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-top:12px}.specialCard{min-height:150px;border:1px solid rgba(255,255,255,.13);background:rgba(0,0,0,.20);padding:14px;display:grid;align-content:center;gap:8px}.specialIcon{font-size:36px}.specialCard b{font-size:13px;letter-spacing:.06em}.specialCard span{font-size:9px;line-height:1.5;color:#9e9691}.specialEmpty{margin-top:16px;border:1px dashed rgba(255,255,255,.25);padding:26px 16px;text-align:center}.specialEmpty strong{display:block;font-size:14px;letter-spacing:.08em}.specialEmpty span{display:block;margin-top:8px;color:#938b87;font-size:9px;line-height:1.55}
    .cryptoSourceBar{display:grid;grid-template-columns:minmax(0,1.35fr) repeat(3,minmax(110px,.65fr));gap:8px;margin-top:11px}.cryptoSourceCell{border:1px solid rgba(147,121,232,.24);background:#070711;padding:10px 11px;min-width:0}.cryptoSourceCell small{display:block;color:#8177a5;font-size:9px;font-weight:950;letter-spacing:.12em;margin-bottom:4px}.cryptoSourceCell strong,.cryptoSourceCell a{display:block;color:#d1c8f4;font-size:12px;font-weight:950;line-height:1.35;letter-spacing:.045em;text-decoration:none;overflow-wrap:anywhere}.cryptoSourceCell a:hover{color:#fff}.cryptoSourceCell.cryptoNoVig strong{color:#9a90bc}
    .cryptoSummary{margin-top:10px;border-left:4px solid #785dbd;background:#090711;padding:10px 12px;color:#aba2c5;font-size:11px;line-height:1.55;letter-spacing:.025em}.cryptoSummary b{color:#ddd7ef;letter-spacing:.08em}
    .cryptoBoard{display:grid;grid-template-columns:1fr;gap:11px;margin-top:11px}
    .cryptoPick{--status:#9c87ff;position:relative;width:100%;border:2px solid #50456e;border-left:4px solid var(--status);background:#060812;padding:14px;box-shadow:inset 0 0 0 1px rgba(191,176,255,.025),0 0 12px rgba(0,0,0,.26);font-size:16px}
    .cryptoPick[data-status="PLAY"]{--status:#58ff88}.cryptoPick[data-status="WAIT"]{--status:#5edcff}.cryptoPick[data-status="WATCH"]{--status:#ffd36b}.cryptoPick[data-status="PASS"]{--status:#ff738a}
    .cryptoPickHead{display:flex;justify-content:space-between;gap:15px;align-items:flex-start}.cryptoPickIdentity{min-width:0}.cryptoStatusTag{display:inline-block;border:1px solid var(--status);color:var(--status);background:#03060b;padding:4px 8px;font-size:11px;font-weight:950;letter-spacing:.10em;box-shadow:0 0 9px color-mix(in srgb,var(--status) 18%,transparent)}
    .cryptoPick h3{margin:9px 0 0;color:#f3f1fb;font-size:19px;line-height:1.2;letter-spacing:.055em;text-transform:uppercase}.cryptoMarket{margin-top:5px;color:#9187ad;font-size:12px;font-weight:900;letter-spacing:.08em}.cryptoPickState{text-align:right;min-width:170px}.cryptoPickState small{display:block;color:#827899;font-size:10px;font-weight:950;letter-spacing:.11em;margin-bottom:4px}.cryptoPickState strong{display:block;color:var(--status);font-size:16px;font-weight:950;letter-spacing:.07em;line-height:1.35}.cryptoDecisionTag{display:inline-block;margin-top:6px;border:1px solid var(--status);color:var(--status);padding:3px 7px;font-size:11px;font-weight:950;letter-spacing:.07em}
    .cryptoMarketStrip{margin-top:12px;background:#040710;border:1px solid #654f94;padding:11px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.cryptoMarketCell{min-width:0}.cryptoMarketCell small{display:block;color:#807696;font-size:10px;font-weight:950;letter-spacing:.10em;margin-bottom:5px}.cryptoMarketCell strong{display:block;color:#e9e5f6;font-size:20px;font-weight:950;line-height:1.25;overflow-wrap:anywhere}.cryptoMarketCell.marketMove strong{color:#c4b8e8;font-size:16px;line-height:1.4}.cryptoMarketCell.marketDecision strong{color:var(--status);font-size:16px}
    .cryptoSourceNote{margin-top:8px;color:#807790;font-size:11px;line-height:1.45;letter-spacing:.035em}.cryptoSourceNote b{color:#b8aecb}.cryptoWhy{margin-top:10px;border-left:4px solid var(--status);padding:9px 11px;background:#0b0912;color:#b9b3c5;font-size:16px;line-height:1.5}.cryptoWhy b{color:var(--status);letter-spacing:.06em}.cryptoAnalysisBtn{width:100%;margin-top:10px;font:inherit;font-weight:950;padding:9px;background:#100b1c;color:#d7ccff;border:1px solid #725bb0;cursor:pointer;letter-spacing:.06em}.cryptoAnalysisBtn:hover{border-color:#a68cff;color:#fff}.cryptoDetail{margin-top:8px;border:1px dotted #574774;background:#03050a;padding:10px;display:none;color:#9d95ad;font-size:14px;line-height:1.55}.cryptoDetail.open{display:block}.cryptoDetailGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.cryptoDetailCell{border:1px solid #302942;background:#070711;padding:8px}.cryptoDetailCell small{display:block;color:#746b83;font-size:10px;font-weight:950;letter-spacing:.10em;margin-bottom:4px}.cryptoDetailCell strong{display:block;color:#c8bfd8;font-size:13px;line-height:1.4}
    .cryptoPasses{margin-top:12px;border:1px solid rgba(94,76,143,.30);background:rgba(8,6,18,.60)}.cryptoPasses summary{cursor:pointer;list-style:none;padding:9px 11px;color:#9a90b3;font-size:11px;font-weight:950;letter-spacing:.11em}.cryptoPasses summary::-webkit-details-marker{display:none}.cryptoPasses[open] summary{border-bottom:1px solid rgba(94,76,143,.24)}.cryptoPassList{display:grid;gap:7px;padding:9px}.cryptoPass{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;border-left:3px solid #ff738a;background:#07070d;padding:9px}.cryptoPass strong{color:#bbb4c7;font-size:13px;letter-spacing:.05em}.cryptoPass span{display:block;margin-top:3px;color:#817a8d;font-size:11px;line-height:1.4}.cryptoPass b{color:#ff8295;font-size:11px;letter-spacing:.08em}.cryptoTimestamp{margin-top:10px;text-align:right;color:#6e667e;font-size:10px;font-weight:900;letter-spacing:.08em}
    @media(max-width:900px){.cryptoMarketStrip{grid-template-columns:repeat(2,minmax(0,1fr))}.cryptoDetailGrid{grid-template-columns:1fr}}
    @media(max-width:720px){#${PIZZA_PANEL},#${CRYPTO_PANEL}{margin-left:7px;margin-right:7px;padding:10px}.specialShelf{grid-template-columns:1fr}.cryptoSourceBar{grid-template-columns:1fr 1fr}.cryptoSourceBar .cryptoSourceCell:first-child{grid-column:1/-1}}
    @media(max-width:560px){.cryptoSourceBar{grid-template-columns:1fr}.cryptoSourceBar .cryptoSourceCell:first-child{grid-column:auto}.cryptoPickHead{display:block}.cryptoPickState{text-align:left;min-width:0;margin-top:10px}.cryptoMarketStrip{grid-template-columns:1fr}.cryptoPick h3{font-size:18px}.cryptoWhy{font-size:14px}}
  `;d.head.appendChild(s)
}
function itemCard(item,kind){
  const icon=kind==='pizza'?'🍕':'🔒';
  const title=esc(item?.title||item?.name||'UNTITLED');
  const meta=esc(item?.summary||item?.description||item?.type||'');
  const url=safeUrl(item?.url);
  const review=kind==='crypto'?`<span>REVIEW: ${esc(item?.status||'PENDING ANALYSIS')} // NEXT: ${esc(cryptoAnalysisModeLabel())}</span>`:'';
  return `<article class="specialCard"><div class="specialIcon">${icon}</div><b>${title}</b>${meta?`<span>${meta}</span>`:''}${review}${url?`<a href="${esc(url)}" target="_blank" rel="noopener" style="color:#8edfff;font-size:9px;font-weight:900;text-decoration:none">OPEN SOURCE PAGE</a>`:''}</article>`;
}
function displayDate(value){
  const text=String(value||'').trim();if(!text)return 'TODAY';
  const m=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return text.toUpperCase();
  const d=new Date(`${text}T12:00:00`);return d.toLocaleDateString('en-CA',{month:'short',day:'numeric',timeZone:'America/Vancouver'}).toUpperCase();
}
function priceText(v){return String(v??'').trim()||'—'}
function cryptoCardHtml(card,index){
  const status=String(card?.status||'WATCH').toUpperCase();
  const rank=String(card?.rank||'').toUpperCase();
  const label=rank?`${rank} · ${status}`:status;
  const detailId=`cryptoDetail${String(card?.id||index).replace(/[^a-zA-Z0-9_-]/g,'')}`;
  return `<article class="cryptoPick" data-status="${esc(status)}">
    <div class="cryptoPickHead">
      <div class="cryptoPickIdentity"><span class="cryptoStatusTag">${esc(label)}</span><h3>${esc(card?.selection||card?.title||'UNTITLED')}</h3><div class="cryptoMarket">${esc(card?.market||'MARKET')}</div></div>
      <div class="cryptoPickState"><small>PRICE STATUS</small><strong>${esc(card?.actionLabel||status)}</strong><span class="cryptoDecisionTag">${esc(card?.decision||status)}</span></div>
    </div>
    <div class="cryptoMarketStrip">
      <div class="cryptoMarketCell"><small>TARGET PRICE</small><strong>${esc(priceText(card?.targetPrice))}</strong></div>
      <div class="cryptoMarketCell"><small>OBSERVED</small><strong>${esc(priceText(card?.observedPrice))}</strong></div>
      <div class="cryptoMarketCell marketMove"><small>MARKET</small><strong>${esc(card?.movement||card?.marketStatus||'NO MOVEMENT NOTE')}</strong></div>
      <div class="cryptoMarketCell marketDecision"><small>ACTION</small><strong>${esc(card?.decision||status)}</strong></div>
    </div>
    <div class="cryptoSourceNote"><b>SOURCE //</b> ${esc(card?.sourceLabel||crypto?.source?.name||'WEB SOURCE')} &nbsp; // &nbsp; ${esc(card?.priceNote||'')}</div>
    <div class="cryptoWhy"><b>WHY ${status}?</b> ${esc(card?.rationale||'No published rationale.')}</div>
    <button class="cryptoAnalysisBtn" type="button" data-crypto-detail="${esc(detailId)}">▶ VIEW ANALYSIS</button>
    <div id="${esc(detailId)}" class="cryptoDetail"><div class="cryptoDetailGrid"><div class="cryptoDetailCell"><small>ANALYSIS SOURCE</small><strong>${esc(card?.sourceLabel||crypto?.source?.name||'WEB SOURCE')}</strong></div><div class="cryptoDetailCell"><small>PRICE DISCIPLINE</small><strong>${esc(card?.priceNote||'NONE')}</strong></div><div class="cryptoDetailCell"><small>FINAL CALL</small><strong>${esc(card?.decision||status)}</strong></div></div></div>
  </article>`;
}
function cryptoPanelHtml(data){
  const board=data?.board||{};const cards=Array.isArray(board.cards)?board.cards:[];
  const active=cards.filter(x=>String(x?.status||'').toUpperCase()!=='PASS');const passes=cards.filter(x=>String(x?.status||'').toUpperCase()==='PASS');
  const sourceUrl=safeUrl(data?.source?.url);const sourceName=esc(data?.source?.name||'WEB SOURCE');
  const date=displayDate(board.analysisDate);const mode=esc(({god_mode:'GOD MODE',in_depth_report:'IN-DEPTH REPORT',basic_readthrough:'BASIC READ-THROUGH'})[String(board.analysisMode||data?.dailyPolicy?.analysisMode||'').toLowerCase()]||publishedModeLabel());
  const badge=`${date} // ${active.length} CARD${active.length===1?'':'S'}`;
  const sourceHtml=sourceUrl?`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener">${sourceName}</a>`:`<strong>${sourceName}</strong>`;
  const summary=esc(board.summary||'Daily source intelligence converted into ranked, price-aware specials.');
  const generated=esc(board.analyzedAt||board.publishedAt||'');
  const activeHtml=active.length?`<div class="cryptoBoard">${active.map(cryptoCardHtml).join('')}</div>`:`<div class="specialEmpty"><strong>NO LIVE SPECIALS</strong><span>The daily analysis completed without an actionable PLAY, WAIT or WATCH card.</span></div>`;
  const passHtml=passes.length?`<details class="cryptoPasses"><summary>PASS DESK // ${passes.length} INVESTIGATED + REJECTED</summary><div class="cryptoPassList">${passes.map(card=>`<div class="cryptoPass"><div><strong>${esc(card?.selection||card?.title||'PASS')}</strong><span>${esc(card?.rationale||card?.movement||'Rejected by the daily analysis.')}</span></div><b>PASS</b></div>`).join('')}</div></details>`:'';
  return `<div class="specialHead cryptoHead"><div><h2>CRYPTO SPECIALS</h2><p>DAILY WEB INTELLIGENCE // LEVEL 3 ANALYSIS // PRICE-AWARE SPECIALS BOARD</p></div><div class="specialBadge cryptoBadge">${badge}</div></div>
    <div class="cryptoSourceBar">
      <div class="cryptoSourceCell"><small>SOURCE 01 // ENTRY POINT</small>${sourceHtml}</div>
      <div class="cryptoSourceCell"><small>ANALYSIS</small><strong>LEVEL 3 · ${mode}</strong></div>
      <div class="cryptoSourceCell"><small>MARKET PASS</small><strong>BETTING EDGE</strong></div>
      <div class="cryptoSourceCell cryptoNoVig"><small>VIGSCOPE</small><strong>NOT INVOLVED</strong></div>
    </div>
    <div class="cryptoSummary"><b>DAILY READ //</b> ${summary}</div>
    ${activeHtml}${passHtml}${generated?`<div class="cryptoTimestamp">ANALYZED ${generated} // AMERICA/VANCOUVER</div>`:''}`;
}
function panelHtml(kind,data){
  if(kind==='crypto'&&data?.board)return cryptoPanelHtml(data);
  const isPizza=kind==='pizza';const items=Array.isArray(data?.items)?data.items:[];
  const title=isPizza?'PIZZA PLAYS':'CRYPTO SPECIALS';
  const desc=isPizza?'LONG SHOTS // PREMIUM PLAYS // SPECIAL COLLECTION':'PREMIUM WEB LINKS // CRYPTO ANALYSIS // SPECIAL COLLECTION';
  const badge=isPizza?'COLLECTION RESERVED':`${items.length} WEB SOURCE${items.length===1?'':'S'} // ${cryptoAnalysisModeLabel()}`;
  const emptyTitle=isPizza?'THE OVEN IS EMPTY':'THE VAULT IS EMPTY';
  const emptyText=isPizza?'Long-shot and premium Pizza Plays will live here when the collection is defined.':'Add one curated web-page URL here. New sources remain pending until an analysis is published.';
  return `<div class="specialHead ${isPizza?'pizzaHead':'cryptoHead'}"><div><h2>${title}</h2><p>${desc}</p></div><div class="specialBadge ${isPizza?'pizzaBadge':'cryptoBadge'}">${badge}</div></div>${items.length?`<div class="specialShelf">${items.map(x=>itemCard(x,kind)).join('')}</div>`:`<div class="specialEmpty"><strong>${emptyTitle}</strong><span>${emptyText}</span></div>`}`;
}
function bindCryptoDetails(d){
  const panel=d.getElementById(CRYPTO_PANEL);if(!panel||panel.dataset.detailBound==='1')return;panel.dataset.detailBound='1';
  panel.addEventListener('click',e=>{const b=e.target.closest?.('[data-crypto-detail]');if(!b)return;const id=b.dataset.cryptoDetail;const detail=id?d.getElementById(id):null;if(!detail)return;const open=detail.classList.toggle('open');b.textContent=open?'▼ HIDE ANALYSIS':'▶ VIEW ANALYSIS'});
}
function ensurePanel(d,id,kind,data){
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');const nav=tabs?.parentElement;if(!nav)return null;
  let p=d.getElementById(id);if(!p){p=d.createElement('section');p.id=id;p.setAttribute('aria-label',kind==='pizza'?'Pizza Plays':'Crypto Specials');nav.insertAdjacentElement('afterend',p)}
  const key=JSON.stringify([data||{},kind==='crypto'?cryptoAnalysisModeLabel():'']);if(p.dataset.key!==key){p.dataset.key=key;p.innerHTML=panelHtml(kind,data);if(kind==='crypto')p.dataset.detailBound=''}if(kind==='crypto')bindCryptoDetails(d);return p;
}
function buttonHtml(key,title,msg,kind){return `<span class="specialMain"><b>[${key}]</b>&nbsp; ${title}</span><span class="specialMessage ${kind}Message">${msg}</span>`}
function ensureButtons(d){
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');if(!tabs)return false;
  const meat=d.getElementById(MEAT_ID),pref=d.getElementById(PREF_ID),f5=d.getElementById('runnerSyndicateF5');if(!meat||!pref||!f5)return false;
  const board=d.getElementById('runnerBoardF1')||tabs.querySelector('.btn[data-view="board"]'),market=d.getElementById('runnerMarketF2')||tabs.querySelector('.btn[data-view="market"]'),history=d.getElementById('runnerHistoryF3')||tabs.querySelector('.btn[data-view="history"]'),engine=d.getElementById('runnerEngineF8')||tabs.querySelector('.btn[data-view="engine"]');
  ensureStyle(d);
  let p=d.getElementById(PIZZA_ID);if(!p){p=d.createElement('button');p.type='button';p.id=PIZZA_ID;p.className='btn';p.innerHTML=buttonHtml('F5','🍕 PIZZA PLAYS 🍕','LONG SHOTS + PREMIUM&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F5] TO OPEN','pizza');p.addEventListener('click',()=>{const open=!d.body.classList.contains('runnerPizzaLoaded');closeAllDesks(d);if(open){d.body.classList.add('runnerPizzaLoaded');p.classList.add('active');ensurePanel(d,PIZZA_PANEL,'pizza',pizza)}})}
  let c=d.getElementById(CRYPTO_ID);if(!c){c=d.createElement('button');c.type='button';c.id=CRYPTO_ID;c.className='btn';c.addEventListener('click',()=>{const open=!d.body.classList.contains('runnerCryptoLoaded');closeAllDesks(d);if(open){d.body.classList.add('runnerCryptoLoaded');c.classList.add('active');ensurePanel(d,CRYPTO_PANEL,'crypto',crypto)}})}
  const cryptoHtml=buttonHtml('F6','🔒 CRYPTO SPECIALS 🔒',cryptoButtonMessage(),'crypto');if(c.innerHTML!==cryptoHtml)c.innerHTML=cryptoHtml;
  meat.setAttribute('aria-label','Meat Desk');
  const ordered=[board,market,history,f5,p,c,meat,engine,pref].filter(Boolean),current=[...tabs.children].filter(node=>ordered.includes(node));
  if(current.length!==ordered.length||ordered.some((node,index)=>current[index]!==node))ordered.forEach(node=>tabs.appendChild(node));
  if(meat.dataset.specialDeskBound!=='1'){meat.dataset.specialDeskBound='1';meat.addEventListener('click',()=>closeSpecial(d))}
  if(pref.dataset.specialDeskBound!=='1'){pref.dataset.specialDeskBound='1';pref.addEventListener('click',()=>closeSpecial(d))}
  if(tabs.dataset.specialDeskCloseBound!=='1'){tabs.dataset.specialDeskCloseBound='1';tabs.addEventListener('click',e=>{const b=e.target.closest?.('.btn');if(b&&!['runnerPizzaF6','runnerCryptoF7','runnerSeasonPreviewF6'].includes(b.id))closeSpecial(d)})}
  ensurePanel(d,PIZZA_PANEL,'pizza',pizza);ensurePanel(d,CRYPTO_PANEL,'crypto',crypto);
  return true;
}
function bindKeys(d){
  const w=d.defaultView;if(!w||w.__specialDeskKeysBound)return;w.__specialDeskKeysBound=true;
  w.addEventListener('keydown',e=>{
    if(!['F5','F6'].includes(e.key))return;
    const target=e.target;if(target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(e.key==='F5')d.getElementById(PIZZA_ID)?.click();
    if(e.key==='F6')d.getElementById(CRYPTO_ID)?.click();
  },true);
}
function attach(){
  const d=appDoc();if(!d?.body)return false;
  if(d!==lastDoc){lastDoc=d;if(observer)observer.disconnect();bindKeys(d);observer=new MutationObserver(()=>requestAnimationFrame(()=>ensureButtons(d)));observer.observe(d.body,{subtree:true,childList:true,characterData:true})}
  bindKeys(d);ensureButtons(d);return true;
}
Promise.all([
  fetch(`${PIZZA_URL}?v=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch(`${CRYPTO_URL}?v=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)
]).then(([p,c])=>{pizza=p;crypto=c;const d=appDoc();if(d)ensureButtons(d)});
let tries=0;const timer=setInterval(()=>{tries++;if(attach()||tries>250)clearInterval(timer)},40);
setInterval(()=>{const d=appDoc();if(d){bindKeys(d);ensureButtons(d)}},600);
})();