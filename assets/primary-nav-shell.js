(()=>{
'use strict';

const STYLE_ID='runnerPrimaryNavShellStyle';
const SHELL_CLASS='runnerPrimaryViewLoaded';
const VIEWS={
  market:{key:'F2',label:'MARKET',sub:'MARKET VIEW'},
  history:{key:'F3',label:'BET HISTORY',sub:'BET HISTORY'},
  engine:{key:'F4',label:'ENGINE',sub:'ENGINE STATUS'}
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
    body.${SHELL_CLASS} .top{display:none!important}
    body.${SHELL_CLASS} .runnerNavPad{padding-top:8px!important;padding-bottom:0!important;margin-top:0!important}
    body.${SHELL_CLASS} .runnerNavPad .tabs>.btn{display:none!important}
    body.${SHELL_CLASS} .runnerNavPad .tabs>.btn.primaryShellActive{grid-column:1/-1!important;display:grid!important;place-items:center!important;gap:7px!important;min-height:62px!important;padding:10px 8px!important;border-color:var(--cyan)!important;background:#03101b!important;color:var(--cyan)!important;box-shadow:inset 0 0 0 1px rgba(57,231,255,.05),0 0 10px rgba(57,231,255,.08)!important;text-shadow:0 0 6px rgba(57,231,255,.16)!important}
    .primaryShellMain{display:block;font-size:inherit;font-weight:900}.primaryShellMessage{display:block;color:#83a6b7;font-size:8px;font-weight:900;letter-spacing:.11em;line-height:1.35}
    @media(max-width:560px){body.${SHELL_CLASS} .runnerNavPad .tabs>.btn.primaryShellActive{min-height:58px!important}.primaryShellMessage{font-size:7.5px}}
  `;
  d.head.appendChild(s);
}
function btn(d,view){return d.querySelector(`.runnerNavPad .tabs>.btn[data-view="${view}"]`)||d.querySelector(`.tabs>.btn[data-view="${view}"]`)}
function saveCompact(b){if(b&&!b.dataset.primaryCompact)b.dataset.primaryCompact=b.innerHTML}
function restoreCompact(b){if(!b)return;b.classList.remove('primaryShellActive');if(b.dataset.primaryCompact&&b.innerHTML!==b.dataset.primaryCompact)b.innerHTML=b.dataset.primaryCompact}
function closeShell(d){
  d.body.classList.remove(SHELL_CLASS);
  delete d.body.dataset.primaryView;
  Object.keys(VIEWS).forEach(v=>restoreCompact(btn(d,v)));
}
function openShell(d,view){
  const meta=VIEWS[view],b=btn(d,view);if(!meta||!b)return;
  Object.keys(VIEWS).forEach(v=>restoreCompact(btn(d,v)));
  saveCompact(b);
  d.body.classList.remove('runnerSyndicateLoaded','runnerPizzaLoaded','runnerCryptoLoaded','runnerSeasonPreviewsLoaded','runnerPreferencesLoaded');
  d.body.classList.add(SHELL_CLASS);
  d.body.dataset.primaryView=view;
  b.classList.add('primaryShellActive');
  b.innerHTML=`<span class="primaryShellMain"><b>[${meta.key}]</b>&nbsp; ${meta.label}</span><span class="primaryShellMessage">${meta.sub}&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [${meta.key}] TO RETURN TO BOARD</span>`;
  try{d.defaultView?.scrollTo({top:0,left:0,behavior:'auto'})}catch{}
}
function bind(d){
  if(d.documentElement.dataset.primaryNavShellBound==='1')return;
  d.documentElement.dataset.primaryNavShellBound='1';
  ensureStyle(d);
  Object.keys(VIEWS).forEach(v=>saveCompact(btn(d,v)));

  d.addEventListener('click',e=>{
    const b=e.target.closest?.('.tabs>.btn[data-view]');if(!b)return;
    const view=b.dataset.view;
    if(VIEWS[view]){
      if(d.body.classList.contains(SHELL_CLASS)&&d.body.dataset.primaryView===view){
        e.preventDefault();e.stopImmediatePropagation();closeShell(d);btn(d,'board')?.click();return;
      }
      closeShell(d);
      requestAnimationFrame(()=>openShell(d,view));
      return;
    }
    if(view==='board')closeShell(d);
  },true);

  d.addEventListener('keydown',e=>{
    const target=e.target;if(target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
    const map={F1:'board',F2:'market',F3:'history',F4:'engine'},view=map[e.key];if(!view)return;
    e.preventDefault();e.stopImmediatePropagation();btn(d,view)?.click();
  },true);
}
function attach(){
  const d=appDoc();if(!d?.body)return false;
  if(d!==lastDoc){lastDoc=d;bind(d)}
  ensureStyle(d);return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(attach()||tries>250)clearInterval(timer)},40);
setInterval(attach,900);
})();
