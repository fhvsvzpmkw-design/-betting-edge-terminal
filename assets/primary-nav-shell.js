(()=>{
'use strict';

const STYLE_ID='runnerPrimaryNavShellStyle';
const SHELL_CLASS='runnerPrimaryViewLoaded';
const MENU_CLASS='runnerMenuHome';
const VIEWS={
  board:{key:'F1',label:'📺 VIG SCOPE 📺',sub:'FULL VIG SCOPE + PICK CARDS'},
  market:{key:'F2',label:'📈 MARKET 📉',sub:'MARKET VIEW'},
  history:{key:'F3',label:'🎟️ BET HISTORY 🎟️',sub:'BET HISTORY'},
  engine:{key:'F8',label:'🧠 VIGSCOPE VALUE 🧠',sub:'VALUE + PERFORMANCE'}
};
let lastDoc=null;

function appDoc(){
  try{
    const core=document.getElementById('core');
    const app=core?.contentDocument?.getElementById('app');
    return app?.contentDocument||null;
  }catch{return null}
}
function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    /* The terminal identity/header is permanent console chrome. */
    body.${MENU_CLASS} main.term>header.top,
    body.${SHELL_CLASS} main.term>header.top,
    body.runnerSyndicateLoaded main.term>header.top,
    body.runnerPizzaLoaded main.term>header.top,
    body.runnerCryptoLoaded main.term>header.top,
    body.runnerSeasonPreviewsLoaded main.term>header.top,
    body.runnerPreferencesLoaded main.term>header.top{display:flex!important;position:sticky!important;top:0!important;z-index:120!important;background:#030811!important;box-shadow:0 8px 18px rgba(0,0,0,.42)!important}

    body.${MENU_CLASS} .runnerNavPad{padding-top:14px!important;padding-bottom:10px!important;margin-top:0!important}
    body.${MENU_CLASS} .runnerNavPad~*{display:none!important}
    body.${MENU_CLASS} .runnerNavPad .tabs{grid-template-columns:1fr!important;gap:9px!important}
    body.${MENU_CLASS} .runnerNavPad .tabs>.btn[data-view]{grid-column:1/-1!important;display:grid!important;place-items:center!important;gap:7px!important;min-height:62px!important;padding:10px 8px!important;background:#03101b!important;box-shadow:inset 0 0 0 1px rgba(57,231,255,.04),0 0 8px rgba(57,231,255,.05)!important}
    body.${MENU_CLASS} .runnerNavPad .tabs>.btn[data-view].active{background:inherit!important}
    body.${MENU_CLASS} .runnerNavPad .tabs>.btn[data-view="board"]{border-color:var(--green)!important;color:var(--green)!important;background:#03140b!important;box-shadow:inset 0 0 0 1px rgba(88,255,136,.06),0 0 10px rgba(88,255,136,.09)!important;text-shadow:0 0 6px rgba(88,255,136,.18)!important}
    body.${MENU_CLASS} .runnerNavPad .tabs>.btn[data-view="market"]{border-color:var(--cyan)!important;color:var(--cyan)!important;background:#03101b!important;box-shadow:inset 0 0 0 1px rgba(57,231,255,.05),0 0 9px rgba(57,231,255,.07)!important;text-shadow:0 0 6px rgba(57,231,255,.16)!important}
    body.${MENU_CLASS} .runnerNavPad .tabs>.btn[data-view="history"]{border-color:var(--blue)!important;color:var(--blue)!important;background:#061126!important;box-shadow:inset 0 0 0 1px rgba(47,132,255,.07),0 0 9px rgba(47,132,255,.09)!important;text-shadow:0 0 6px rgba(47,132,255,.18)!important}
    body.${MENU_CLASS} .runnerNavPad .tabs>.btn[data-view="engine"]{border-color:#6f8faa!important;color:#c7d2dc!important;background:#09131d!important;box-shadow:inset 0 0 0 1px rgba(111,143,170,.10),0 0 12px rgba(111,143,170,.12)!important;text-shadow:none!important}
    .primaryMenuMain{display:block;font-size:inherit;font-weight:900}.primaryMenuMessage{display:block;color:#83a6b7;font-size:8px;font-weight:900;letter-spacing:.11em;line-height:1.35}
    body.${MENU_CLASS} .runnerNavPad .tabs>.btn[data-view="board"] .primaryMenuMessage{color:#8fc7a2}
    body.${MENU_CLASS} .runnerNavPad .tabs>.btn[data-view="market"] .primaryMenuMessage{color:#83c8d8}
    body.${MENU_CLASS} .runnerNavPad .tabs>.btn[data-view="history"] .primaryMenuMessage{color:#83a9ea}
    body.${MENU_CLASS} .runnerNavPad .tabs>.btn[data-view="engine"] .primaryMenuMessage{color:#8ea0af!important}

    body.${SHELL_CLASS} .runnerNavPad{padding-top:8px!important;padding-bottom:0!important;margin-top:0!important}
    body.${SHELL_CLASS} .runnerNavPad .tabs>.btn{display:none!important}
    body.${SHELL_CLASS} .runnerNavPad .tabs>#runnerSyndicateF5,
    body.${SHELL_CLASS} .runnerNavPad .tabs>#runnerPizzaF6,
    body.${SHELL_CLASS} .runnerNavPad .tabs>#runnerCryptoF7,
    body.${SHELL_CLASS} .runnerNavPad .tabs>#runnerSeasonPreviewF6,
    body.${SHELL_CLASS} .runnerNavPad .tabs>#runnerPreferencesF6{display:none!important}
    body.${SHELL_CLASS} .runnerNavPad .tabs>.btn.primaryShellActive{grid-column:1/-1!important;display:grid!important;place-items:center!important;gap:7px!important;min-height:62px!important;padding:10px 8px!important;border-color:var(--cyan)!important;background:#03101b!important;color:var(--cyan)!important;box-shadow:inset 0 0 0 1px rgba(57,231,255,.05),0 0 10px rgba(57,231,255,.08)!important;text-shadow:0 0 6px rgba(57,231,255,.16)!important}
    body.${SHELL_CLASS}[data-primary-view="board"] .runnerNavPad .tabs>.btn.primaryShellActive{border-color:var(--green)!important;color:var(--green)!important;background:#03140b!important;box-shadow:inset 0 0 0 1px rgba(88,255,136,.06),0 0 10px rgba(88,255,136,.09)!important;text-shadow:0 0 6px rgba(88,255,136,.18)!important}
    body.${SHELL_CLASS}[data-primary-view="history"] .runnerNavPad .tabs>.btn.primaryShellActive{border-color:var(--blue)!important;color:var(--blue)!important;background:#061126!important;box-shadow:inset 0 0 0 1px rgba(47,132,255,.07),0 0 10px rgba(47,132,255,.10)!important;text-shadow:0 0 6px rgba(47,132,255,.18)!important}
    body.${SHELL_CLASS}[data-primary-view="engine"] .runnerNavPad .tabs>.btn.primaryShellActive{border-color:#6f8faa!important;color:#c7d2dc!important;background:#09131d!important;box-shadow:inset 0 0 0 1px rgba(111,143,170,.10),0 0 12px rgba(111,143,170,.12)!important;text-shadow:none!important}
    .primaryShellMain{display:block;font-size:inherit;font-weight:900}.primaryShellMessage{display:block;color:#83a6b7;font-size:8px;font-weight:900;letter-spacing:.11em;line-height:1.35}
    body.${SHELL_CLASS}[data-primary-view="board"] .primaryShellMessage{color:#8fc7a2}
    body.${SHELL_CLASS}[data-primary-view="market"] .primaryShellMessage{color:#83c8d8}
    body.${SHELL_CLASS}[data-primary-view="history"] .primaryShellMessage{color:#83a9ea}
    body.${SHELL_CLASS}[data-primary-view="engine"] .primaryShellMessage{color:#8ea0af!important}
    @media(max-width:560px){body.${MENU_CLASS} main.term>header.top,body.${SHELL_CLASS} main.term>header.top,body.runnerSyndicateLoaded main.term>header.top,body.runnerPizzaLoaded main.term>header.top,body.runnerCryptoLoaded main.term>header.top,body.runnerSeasonPreviewsLoaded main.term>header.top,body.runnerPreferencesLoaded main.term>header.top{display:block!important}body.${MENU_CLASS} .runnerNavPad .tabs>.btn[data-view],body.${SHELL_CLASS} .runnerNavPad .tabs>.btn.primaryShellActive{min-height:58px!important}.primaryMenuMessage,.primaryShellMessage{font-size:7.5px}}
  `;
  d.head.appendChild(s);
}
function btn(d,view){return d.querySelector(`.runnerNavPad .tabs>.btn[data-view="${view}"]`)||d.querySelector(`.tabs>.btn[data-view="${view}"]`)}
function menuHtml(view){const m=VIEWS[view];return m?`<span class="primaryMenuMain"><b>[${m.key}]</b>&nbsp; ${m.label}</span><span class="primaryMenuMessage">${m.sub}&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [${m.key}] TO OPEN</span>`:''}
function restoreMenuButton(d,view){
  const b=btn(d,view);if(!b)return;
  b.classList.remove('primaryShellActive');
  const html=menuHtml(view);if(html&&b.innerHTML!==html)b.innerHTML=html;
}
function restoreAllMenuButtons(d){Object.keys(VIEWS).forEach(v=>restoreMenuButton(d,v))}
function clearPrimaryActive(d){d.querySelectorAll('.tabs>.btn[data-view].active').forEach(x=>x.classList.remove('active'))}
function workspaceOpen(d){
  const body=d.body;
  const pageClasses=['runnerSyndicateLoaded','runnerPizzaLoaded','runnerCryptoLoaded','runnerSeasonPreviewsLoaded','runnerPreferencesLoaded'];
  if(pageClasses.some(c=>body.classList.contains(c)))return true;
  const f5=d.getElementById('runnerSyndicateF5');
  return f5?.dataset?.state==='connecting';
}
function leaveMenu(d){d.body.classList.remove(MENU_CLASS)}
function enterMenu(d){
  d.body.classList.remove(SHELL_CLASS);
  delete d.body.dataset.primaryView;
  restoreAllMenuButtons(d);
  clearPrimaryActive(d);
  d.body.classList.add(MENU_CLASS);
  try{d.defaultView?.scrollTo({top:0,left:0,behavior:'auto'})}catch{}
}
function closeShell(d){
  d.body.classList.remove(SHELL_CLASS);
  delete d.body.dataset.primaryView;
  restoreAllMenuButtons(d);
}
function openShell(d,view){
  const meta=VIEWS[view],b=btn(d,view);if(!meta||!b)return;
  leaveMenu(d);closeShell(d);
  d.body.classList.remove('runnerSyndicateLoaded','runnerPizzaLoaded','runnerCryptoLoaded','runnerSeasonPreviewsLoaded','runnerPreferencesLoaded');
  d.body.classList.add(SHELL_CLASS);
  d.body.dataset.primaryView=view;
  b.classList.add('primaryShellActive');
  b.innerHTML=`<span class="primaryShellMain"><b>[${meta.key}]</b>&nbsp; ${meta.label}</span><span class="primaryShellMessage">${meta.sub}&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [${meta.key}] TO RETURN TO MENU</span>`;
  try{d.defaultView?.scrollTo({top:0,left:0,behavior:'auto'})}catch{}
}
function syncMenu(d){
  if(d.body.classList.contains(MENU_CLASS)||d.body.classList.contains(SHELL_CLASS)||workspaceOpen(d))return;
  enterMenu(d);
}
function bind(d){
  if(d.documentElement.dataset.primaryNavShellBound==='5')return;
  d.documentElement.dataset.primaryNavShellBound='5';
  ensureStyle(d);
  restoreAllMenuButtons(d);
  enterMenu(d);

  d.addEventListener('click',e=>{
    const navButton=e.target.closest?.('.runnerNavPad .tabs>.btn,.tabs>.btn');if(!navButton)return;
    const view=navButton.dataset?.view;

    if(view&&VIEWS[view]){
      if(d.body.classList.contains(SHELL_CLASS)&&d.body.dataset.primaryView===view){
        e.preventDefault();e.stopImmediatePropagation();enterMenu(d);return;
      }
      leaveMenu(d);closeShell(d);
      queueMicrotask(()=>openShell(d,view));
      return;
    }

    // Syndicate, Pizza, Crypto, Meat and Preferences own their page logic.
    // Remove the menu/shell before their handlers run, then return to the menu
    // whenever they close.
    leaveMenu(d);closeShell(d);
    setTimeout(()=>syncMenu(d),0);
    setTimeout(()=>syncMenu(d),180);
  },true);

  d.addEventListener('keydown',e=>{
    const target=e.target;if(target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
    if(e.key==='F4'){
      e.preventDefault();e.stopImmediatePropagation();d.getElementById('runnerSyndicateF5')?.click();return;
    }
    const map={F1:'board',F2:'market',F3:'history',F8:'engine'},view=map[e.key];if(!view)return;
    e.preventDefault();e.stopImmediatePropagation();btn(d,view)?.click();
  },true);
}
function attach(){
  const d=appDoc();if(!d?.body)return false;
  if(d!==lastDoc){lastDoc=d;bind(d)}
  ensureStyle(d);
  if(!d.body.classList.contains(MENU_CLASS)&&!d.body.classList.contains(SHELL_CLASS)&&!workspaceOpen(d))syncMenu(d);
  return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(attach()||tries>250)clearInterval(timer)},40);
setInterval(attach,650);
})();
