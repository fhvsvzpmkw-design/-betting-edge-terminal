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
let pizza=null,crypto=null,lastDoc=null,observer=null;

function appDoc(){
  try{
    const core=document.getElementById('core');
    const app=core?.contentDocument?.getElementById('app');
    return app?.contentDocument||null;
  }catch{return null}
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
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
    #${PIZZA_ID}{border-color:#c97035!important;color:#ffd7a3!important;background:#100704!important;box-shadow:inset 0 0 0 1px rgba(255,166,80,.05),0 0 10px rgba(220,105,35,.08)!important}
    #${PIZZA_ID}:hover,#${PIZZA_ID}.active{border-color:#ff9a49!important;color:#fff0c9!important;background:#1a0a04!important}
    #${CRYPTO_ID}{border-color:#6552a8!important;color:#cfc4ff!important;background:#070611!important;box-shadow:inset 0 0 0 1px rgba(156,130,255,.05),0 0 10px rgba(93,70,180,.08)!important}
    #${CRYPTO_ID}:hover,#${CRYPTO_ID}.active{border-color:#9c87ff!important;color:#eee9ff!important;background:#0d0a1c!important}
    .specialMain{display:block;font-size:inherit}.specialMessage{display:block;font-size:8px;font-weight:900;letter-spacing:.11em;line-height:1.35}.pizzaMessage{color:#c98a59}.cryptoMessage{color:#8f83c7}
    #${PIZZA_PANEL},#${CRYPTO_PANEL}{display:none;margin:0 12px 14px;padding:12px;min-height:65vh;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    #${PIZZA_PANEL}{border:1px solid #6d3b20;background:radial-gradient(circle at 50% -20%,rgba(159,68,22,.20),transparent 48%),linear-gradient(180deg,#0d0703,#030303);color:#ecd8c4}
    #${CRYPTO_PANEL}{border:1px solid #453a72;background:radial-gradient(circle at 50% -20%,rgba(70,50,150,.20),transparent 48%),linear-gradient(180deg,#070611,#030303);color:#ddd8f6}
    body.runnerPizzaLoaded .top,body.runnerCryptoLoaded .top{display:none!important}
    body.runnerPizzaLoaded .runnerNavPad,body.runnerCryptoLoaded .runnerNavPad{padding-top:8px!important;padding-bottom:0!important;margin-top:0!important}
    body.runnerPizzaLoaded .runnerNavPad .tabs>.btn:not(#${PIZZA_ID}){display:none!important}
    body.runnerCryptoLoaded .runnerNavPad .tabs>.btn:not(#${CRYPTO_ID}){display:none!important}
    body.runnerPizzaLoaded #${PIZZA_PANEL},body.runnerCryptoLoaded #${CRYPTO_PANEL}{display:block!important;margin-top:0!important}
    body.runnerPizzaLoaded #${PIZZA_PANEL}~*,body.runnerCryptoLoaded #${CRYPTO_PANEL}~*{display:none!important}
    .specialHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.12)}.specialHead h2{margin:0;font-size:18px;letter-spacing:.12em}.pizzaHead h2{color:#ffc078}.cryptoHead h2{color:#b9aaff}.specialHead p{margin:5px 0 0;color:#998f8a;font-size:8px;line-height:1.5;letter-spacing:.05em}.specialBadge{border:1px solid currentColor;padding:6px 9px;font-size:8px;font-weight:950;letter-spacing:.09em}.pizzaBadge{color:#ffb066;background:#160904}.cryptoBadge{color:#ac9cff;background:#0b0818}
    .specialShelf{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-top:12px}.specialCard{min-height:150px;border:1px solid rgba(255,255,255,.13);background:rgba(0,0,0,.20);padding:14px;display:grid;align-content:center;gap:8px}.specialIcon{font-size:36px}.specialCard b{font-size:13px;letter-spacing:.06em}.specialCard span{font-size:9px;line-height:1.5;color:#9e9691}.specialEmpty{margin-top:16px;border:1px dashed rgba(255,255,255,.25);padding:26px 16px;text-align:center}.specialEmpty strong{display:block;font-size:14px;letter-spacing:.08em}.specialEmpty span{display:block;margin-top:8px;color:#938b87;font-size:9px;line-height:1.55}
    @media(max-width:720px){#${PIZZA_PANEL},#${CRYPTO_PANEL}{margin-left:7px;margin-right:7px;padding:10px}.specialShelf{grid-template-columns:1fr}}
  `;d.head.appendChild(s)
}
function itemCard(item,kind){
  const icon=kind==='pizza'?'🍕':'🔒';
  const title=esc(item?.title||item?.name||'UNTITLED');
  const meta=esc(item?.summary||item?.description||item?.type||'');
  const url=String(item?.url||'').trim();
  return `<article class="specialCard"><div class="specialIcon">${icon}</div><b>${title}</b>${meta?`<span>${meta}</span>`:''}${url?`<a href="${esc(url)}" target="_blank" rel="noopener" style="color:#8edfff;font-size:9px;font-weight:900;text-decoration:none">OPEN LINK</a>`:''}</article>`;
}
function panelHtml(kind,data){
  const isPizza=kind==='pizza';const items=Array.isArray(data?.items)?data.items:[];
  const title=isPizza?'PIZZA PLAYS':'CRYPTO SPECIALS';
  const desc=isPizza?'LONG SHOTS // PREMIUM PLAYS // SPECIAL COLLECTION':'PREMIUM WEB LINKS // CRYPTO ANALYSIS // SPECIAL COLLECTION';
  const badge=isPizza?'COLLECTION RESERVED':'PREMIUM / LOCKED';
  const emptyTitle=isPizza?'THE OVEN IS EMPTY':'THE VAULT IS EMPTY';
  const emptyText=isPizza?'Long-shot and premium Pizza Plays will live here when the collection is defined.':'Premium crypto links and analysis will live here when the collection is defined.';
  return `<div class="specialHead ${isPizza?'pizzaHead':'cryptoHead'}"><div><h2>${title}</h2><p>${desc}</p></div><div class="specialBadge ${isPizza?'pizzaBadge':'cryptoBadge'}">${badge}</div></div>${items.length?`<div class="specialShelf">${items.map(x=>itemCard(x,kind)).join('')}</div>`:`<div class="specialEmpty"><strong>${emptyTitle}</strong><span>${emptyText}</span></div>`}`;
}
function ensurePanel(d,id,kind,data){
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');const nav=tabs?.parentElement;if(!nav)return null;
  let p=d.getElementById(id);if(!p){p=d.createElement('section');p.id=id;p.setAttribute('aria-label',kind==='pizza'?'Pizza Plays':'Crypto Specials');nav.insertAdjacentElement('afterend',p)}
  const key=JSON.stringify(data||{});if(p.dataset.key!==key){p.dataset.key=key;p.innerHTML=panelHtml(kind,data)}return p;
}
function buttonHtml(key,title,msg,kind){return `<span class="specialMain"><b>[${key}]</b>&nbsp; ${title}</span><span class="specialMessage ${kind}Message">${msg}</span>`}
function ensureButtons(d){
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');if(!tabs)return false;
  const meat=d.getElementById(MEAT_ID),pref=d.getElementById(PREF_ID),f5=d.getElementById('runnerSyndicateF5');if(!meat||!pref)return false;
  ensureStyle(d);
  let p=d.getElementById(PIZZA_ID);if(!p){p=d.createElement('button');p.type='button';p.id=PIZZA_ID;p.className='btn';p.innerHTML=buttonHtml('F6','🍕 PIZZA PLAYS 🍕','LONG SHOTS + PREMIUM&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F6] TO OPEN','pizza');p.addEventListener('click',()=>{const open=!d.body.classList.contains('runnerPizzaLoaded');closeAllDesks(d);if(open){d.body.classList.add('runnerPizzaLoaded');p.classList.add('active');ensurePanel(d,PIZZA_PANEL,'pizza',pizza)}})}
  let c=d.getElementById(CRYPTO_ID);if(!c){c=d.createElement('button');c.type='button';c.id=CRYPTO_ID;c.className='btn';c.innerHTML=buttonHtml('F7','🔒 CRYPTO SPECIALS 🔒','PREMIUM LINKS + ANALYSIS&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F7] TO OPEN','crypto');c.addEventListener('click',()=>{const open=!d.body.classList.contains('runnerCryptoLoaded');closeAllDesks(d);if(open){d.body.classList.add('runnerCryptoLoaded');c.classList.add('active');ensurePanel(d,CRYPTO_PANEL,'crypto',crypto)}})}
  const count=(window.__meatDeskSourceCount??null);
  meat.innerHTML=`<span class="f6Main"><b>[F8]</b>&nbsp; 🥩 MEAT DESK 🥩</span><span class="f6Message">${count==null?'SOURCE DESK':`${count} SOURCES ON DESK`}&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F8] TO OPEN</span>`;
  meat.setAttribute('aria-label','Meat Desk');
  if(f5){if(f5.nextElementSibling!==p)f5.insertAdjacentElement('afterend',p);if(p.nextElementSibling!==c)p.insertAdjacentElement('afterend',c);if(c.nextElementSibling!==meat)c.insertAdjacentElement('afterend',meat)}else{tabs.append(p,c,meat)}
  if(tabs.lastElementChild!==pref)tabs.appendChild(pref);
  if(meat.dataset.specialDeskBound!=='1'){meat.dataset.specialDeskBound='1';meat.addEventListener('click',()=>closeSpecial(d))}
  if(pref.dataset.specialDeskBound!=='1'){pref.dataset.specialDeskBound='1';pref.addEventListener('click',()=>closeSpecial(d))}
  if(tabs.dataset.specialDeskCloseBound!=='1'){tabs.dataset.specialDeskCloseBound='1';tabs.addEventListener('click',e=>{const b=e.target.closest?.('.btn');if(b&&!['runnerPizzaF6','runnerCryptoF7','runnerSeasonPreviewF6'].includes(b.id))closeSpecial(d)})}
  ensurePanel(d,PIZZA_PANEL,'pizza',pizza);ensurePanel(d,CRYPTO_PANEL,'crypto',crypto);
  return true;
}
function bindKeys(d){
  const w=d.defaultView;if(!w||w.__specialDeskKeysBound)return;w.__specialDeskKeysBound=true;
  w.addEventListener('keydown',e=>{
    if(!['F6','F7','F8'].includes(e.key))return;
    const target=e.target;if(target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(e.key==='F6')d.getElementById(PIZZA_ID)?.click();
    if(e.key==='F7')d.getElementById(CRYPTO_ID)?.click();
    if(e.key==='F8')d.getElementById(MEAT_ID)?.click();
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
