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
    #${CRYPTO_PANEL}{border:1px solid #51418c;background:radial-gradient(circle at 50% -18%,rgba(98,67,201,.28),transparent 43%),radial-gradient(circle at 100% 0,rgba(76,45,145,.16),transparent 28%),linear-gradient(180deg,#080614,#030208 58%,#020203);color:#ddd8f6;box-shadow:inset 0 0 35px rgba(113,80,220,.04),0 0 20px rgba(55,36,110,.10)}
    body.runnerPizzaLoaded .top,body.runnerCryptoLoaded .top{display:none!important}
    body.runnerPizzaLoaded .runnerNavPad,body.runnerCryptoLoaded .runnerNavPad{padding-top:8px!important;padding-bottom:0!important;margin-top:0!important}
    body.runnerPizzaLoaded .runnerNavPad .tabs>.btn:not(#${PIZZA_ID}){display:none!important}
    body.runnerCryptoLoaded .runnerNavPad .tabs>.btn:not(#${CRYPTO_ID}){display:none!important}
    body.runnerPizzaLoaded #${PIZZA_PANEL},body.runnerCryptoLoaded #${CRYPTO_PANEL}{display:block!important;margin-top:0!important}
    body.runnerPizzaLoaded #${PIZZA_PANEL}~*,body.runnerCryptoLoaded #${CRYPTO_PANEL}~*{display:none!important}
    .specialHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.12)}.specialHead h2{margin:0;font-size:18px;letter-spacing:.12em}.pizzaHead h2{color:#ffc078}.cryptoHead h2{color:#c8baff;text-shadow:0 0 12px rgba(157,126,255,.30)}.specialHead p{margin:5px 0 0;color:#998f8a;font-size:8px;line-height:1.5;letter-spacing:.05em}.cryptoHead p{color:#8e83b4}.specialBadge{border:1px solid currentColor;padding:6px 9px;font-size:8px;font-weight:950;letter-spacing:.09em}.pizzaBadge{color:#ffb066;background:#160904}.cryptoBadge{color:#b8a8ff;background:#0d0920;box-shadow:inset 0 0 12px rgba(136,100,255,.07)}
    .specialShelf{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-top:12px}.specialCard{min-height:150px;border:1px solid rgba(255,255,255,.13);background:rgba(0,0,0,.20);padding:14px;display:grid;align-content:center;gap:8px}.specialIcon{font-size:36px}.specialCard b{font-size:13px;letter-spacing:.06em}.specialCard span{font-size:9px;line-height:1.5;color:#9e9691}.specialEmpty{margin-top:16px;border:1px dashed rgba(255,255,255,.25);padding:26px 16px;text-align:center}.specialEmpty strong{display:block;font-size:14px;letter-spacing:.08em}.specialEmpty span{display:block;margin-top:8px;color:#938b87;font-size:9px;line-height:1.55}
    .cryptoSourceBar{display:grid;grid-template-columns:minmax(0,1.35fr) repeat(3,minmax(110px,.65fr));gap:8px;margin-top:11px}.cryptoSourceCell{border:1px solid rgba(147,121,232,.24);background:rgba(18,11,40,.62);padding:9px 10px;min-width:0}.cryptoSourceCell small{display:block;color:#786ca2;font-size:7px;font-weight:950;letter-spacing:.12em;margin-bottom:4px}.cryptoSourceCell strong,.cryptoSourceCell a{display:block;color:#cbbfff;font-size:9px;font-weight:950;line-height:1.35;letter-spacing:.045em;text-decoration:none;overflow-wrap:anywhere}.cryptoSourceCell a:hover{color:#f0ecff}.cryptoSourceCell.cryptoNoVig strong{color:#8f80c8}
    .cryptoSummary{margin-top:10px;border-left:3px solid #8267dc;background:linear-gradient(90deg,rgba(70,47,143,.22),rgba(20,13,42,.12));padding:9px 11px;color:#a99fcf;font-size:8px;line-height:1.55;letter-spacing:.025em}.cryptoSummary b{color:#d7d0f7;letter-spacing:.08em}
    .cryptoBoard{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:11px;margin-top:12px}.cryptoPick{position:relative;min-height:244px;border:1px solid #493a7d;background:linear-gradient(155deg,rgba(22,14,51,.94),rgba(5,4,12,.97));padding:12px;display:flex;flex-direction:column;gap:9px;overflow:hidden;box-shadow:inset 0 0 22px rgba(117,82,220,.035)}.cryptoPick:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:#765acb;opacity:.58}.cryptoPick[data-status="PLAY"]{border-color:#876bdc;box-shadow:inset 0 0 26px rgba(128,91,238,.07),0 0 13px rgba(96,65,190,.08)}.cryptoPick[data-status="PLAY"]:before{background:#b79aff;opacity:1}.cryptoPick[data-status="WAIT"]:before{background:#8d70df;opacity:.9}.cryptoPick[data-status="WATCH"]:before{background:#5e4a96;opacity:.78}.cryptoPickTop{display:flex;justify-content:space-between;gap:8px;align-items:center}.cryptoRank{color:#e1d9ff;font-size:8px;font-weight:950;letter-spacing:.11em;border:1px solid rgba(174,151,255,.38);background:#100a25;padding:4px 6px}.cryptoAction{color:#bcaeff;font-size:8px;font-weight:950;letter-spacing:.11em}.cryptoPick h3{margin:0;color:#f0edff;font-size:14px;line-height:1.25;letter-spacing:.055em;text-transform:uppercase}.cryptoMarket{margin-top:-5px;color:#8f82ba;font-size:8px;font-weight:900;letter-spacing:.08em}.cryptoPrices{display:grid;grid-template-columns:1fr 1fr;gap:7px}.cryptoPriceBox{border:1px solid rgba(139,112,218,.23);background:rgba(6,4,17,.72);padding:8px}.cryptoPriceBox small{display:block;color:#776c9c;font-size:7px;font-weight:950;letter-spacing:.11em;margin-bottom:4px}.cryptoPriceBox strong{display:block;color:#d8ceff;font-size:13px;letter-spacing:.035em}.cryptoMovement{display:flex;align-items:flex-start;gap:7px;border-top:1px solid rgba(139,112,218,.17);border-bottom:1px solid rgba(139,112,218,.17);padding:7px 0;color:#9f92c8;font-size:8px;font-weight:900;line-height:1.4;letter-spacing:.045em}.cryptoMovement b{color:#c3b6ef;font-size:8px;white-space:nowrap}.cryptoWhy{color:#aaa2c4;font-size:8px;line-height:1.55;flex:1}.cryptoWhy b{color:#d8d1ee;font-size:8px;letter-spacing:.07em}.cryptoPickFoot{display:flex;justify-content:space-between;align-items:flex-end;gap:9px;padding-top:2px}.cryptoPickFoot span{color:#71678f;font-size:7px;font-weight:900;line-height:1.35;letter-spacing:.06em}.cryptoPickFoot strong{color:#c4b7f5;font-size:8px;letter-spacing:.08em;text-align:right}.cryptoPasses{margin-top:12px;border:1px solid rgba(94,76,143,.30);background:rgba(8,6,18,.60)}.cryptoPasses summary{cursor:pointer;list-style:none;padding:9px 11px;color:#7e72a1;font-size:8px;font-weight:950;letter-spacing:.11em}.cryptoPasses summary::-webkit-details-marker{display:none}.cryptoPasses[open] summary{border-bottom:1px solid rgba(94,76,143,.24)}.cryptoPassList{display:grid;gap:7px;padding:9px}.cryptoPass{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;border-left:2px solid #3d335c;background:rgba(13,9,27,.62);padding:8px 9px}.cryptoPass strong{color:#9990b6;font-size:9px;letter-spacing:.05em}.cryptoPass span{color:#6f6784;font-size:8px;line-height:1.4}.cryptoPass b{color:#71668f;font-size:8px;letter-spacing:.08em}.cryptoTimestamp{margin-top:10px;text-align:right;color:#655b84;font-size:7px;font-weight:900;letter-spacing:.08em}
    @media(max-width:720px){#${PIZZA_PANEL},#${CRYPTO_PANEL}{margin-left:7px;margin-right:7px;padding:10px}.specialShelf,.cryptoBoard{grid-template-columns:1fr}.cryptoSourceBar{grid-template-columns:1fr 1fr}.cryptoSourceBar .cryptoSourceCell:first-child{grid-column:1/-1}}
    @media(max-width:460px){.cryptoSourceBar{grid-template-columns:1fr}.cryptoSourceBar .cryptoSourceCell:first-child{grid-column:auto}.cryptoPrices{grid-template-columns:1fr 1fr}.cryptoPick{min-height:0}}
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
function cryptoCardHtml(card){
  const status=String(card?.status||'WATCH').toUpperCase();
  const rank=String(card?.rank||'').toUpperCase();
  const label=rank?`${rank} · ${status}`:status;
  return `<article class="cryptoPick" data-status="${esc(status)}">
    <div class="cryptoPickTop"><span class="cryptoRank">${esc(label)}</span><span class="cryptoAction">${esc(card?.actionLabel||status)}</span></div>
    <h3>${esc(card?.selection||card?.title||'UNTITLED')}</h3>
    <div class="cryptoMarket">${esc(card?.market||'MARKET')}</div>
    <div class="cryptoPrices"><div class="cryptoPriceBox"><small>TARGET PRICE</small><strong>${esc(priceText(card?.targetPrice))}</strong></div><div class="cryptoPriceBox"><small>OBSERVED</small><strong>${esc(priceText(card?.observedPrice))}</strong></div></div>
    <div class="cryptoMovement"><b>MARKET</b><span>${esc(card?.movement||card?.marketStatus||'NO MOVEMENT NOTE')}</span></div>
    <div class="cryptoWhy"><b>WHY //</b> ${esc(card?.rationale||'No published rationale.')}</div>
    <div class="cryptoPickFoot"><span>${esc(card?.sourceLabel||crypto?.source?.name||'WEB SOURCE')}<br>${esc(card?.priceNote||'')}</span><strong>${esc(card?.decision||status)}</strong></div>
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
function ensurePanel(d,id,kind,data){
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');const nav=tabs?.parentElement;if(!nav)return null;
  let p=d.getElementById(id);if(!p){p=d.createElement('section');p.id=id;p.setAttribute('aria-label',kind==='pizza'?'Pizza Plays':'Crypto Specials');nav.insertAdjacentElement('afterend',p)}
  const key=JSON.stringify([data||{},kind==='crypto'?cryptoAnalysisModeLabel():'']);if(p.dataset.key!==key){p.dataset.key=key;p.innerHTML=panelHtml(kind,data)}return p;
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
