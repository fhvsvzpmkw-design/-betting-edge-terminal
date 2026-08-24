(()=>{
'use strict';

const MANIFEST_URL='./research/season-previews/manifest.json';
const BUTTON_ID='runnerSeasonPreviewF6';
const PREF_BUTTON_ID='runnerPreferencesF6';
const PANEL_ID='runnerSeasonPreviewsWorkspace';
const STYLE_ID='runnerSeasonPreviewsUiStyle';
const ANALYSIS_MODE_KEY='bettingEdge.preferences.meatDeskAnalysisMode';

let manifest=null,lastDoc=null,observer=null,manifestRequested=false;

function appDoc(){
  try{
    const core=document.getElementById('core');
    const app=core?.contentDocument?.getElementById('app');
    return app?.contentDocument||null;
  }catch{return null}
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function cardStyle(){
  let v='normal';
  try{v=localStorage.getItem('bettingEdge.preferences.cardView')||'normal'}catch{}
  return ({normal:'NORMAL',excited:'EXCITED',neon:'NEON',vigscope:'VIG SCOPE'})[v]||String(v).toUpperCase();
}
function analysisModeLabel(){
  let value='god_mode';
  try{value=localStorage.getItem(ANALYSIS_MODE_KEY)||'god_mode'}catch{}
  return ({basic_readthrough:'BASIC READ-THROUGH',in_depth_report:'IN-DEPTH REPORT',god_mode:'GOD MODE'})[value]||'GOD MODE';
}
function shortDesk(item){return String(item?.desk||item?.season||item?.kind||'GENERAL').toUpperCase()}
function sizeText(bytes){
  const n=Number(bytes);if(!Number.isFinite(n)||n<=0)return '';
  return n>1048576?`${(n/1048576).toFixed(1)} MB`:`${Math.round(n/1024)} KB`;
}
function iconFor(item){
  const desk=shortDesk(item),kind=String(item?.kind||'').toUpperCase();
  if(desk.includes('NHL')||kind.includes('HOCKEY'))return '🏒';
  if(desk.includes('NBA')||desk.includes('CBB')||desk.includes('NCAAB')||kind.includes('BASKETBALL'))return '🏀';
  if(desk.includes('RACING')||kind.includes('HORSE'))return '🐎';
  if(desk.includes('CFB')||kind.includes('COLLEGE FOOTBALL'))return '🏟️';
  if(desk.includes('NFL')||desk.includes('FANTASY'))return '🏈';
  return '📚';
}
function statusLabel(item){
  const raw=String(item?.status||'').trim().toUpperCase();
  if(raw.includes('NOT ANALYZED')||raw.includes('PENDING'))return 'SOURCE AVAILABLE // NOT ANALYZED';
  if(raw.includes('SUPERSEDED'))return 'SUPERSEDED';
  if(raw.includes('VERIFIED'))return 'CURRENTLY VERIFIED';
  if(item?.reviewedAt||raw.includes('ANALYZED')||raw.includes('REVIEWED'))return 'ANALYZED // PRESEASON RESEARCH';
  return 'SOURCE AVAILABLE // NOT ANALYZED';
}
function statusClass(item){
  const label=statusLabel(item);
  if(label.startsWith('ANALYZED'))return 'analyzed';
  if(label==='CURRENTLY VERIFIED')return 'verified';
  if(label==='SUPERSEDED')return 'superseded';
  return 'available';
}
function sportKeys(){
  const seen=[];
  (manifest?.sources||[]).forEach(item=>{const key=shortDesk(item);if(key&&!seen.includes(key))seen.push(key)});
  return seen.sort((a,b)=>a.localeCompare(b));
}
function sortSources(items){
  return items.slice().sort((a,b)=>{
    const sa=String(a.season||''),sb=String(b.season||'');
    if(sa!==sb)return sb.localeCompare(sa,undefined,{numeric:true});
    return String(a.title||a.file||'').localeCompare(String(b.title||b.file||''));
  });
}
function groupSources(items){
  const groups=new Map();
  sortSources(items).forEach(item=>{
    const key=`${shortDesk(item)}|||${String(item.season||'CURRENT').toUpperCase()}`;
    if(!groups.has(key))groups.set(key,{desk:shortDesk(item),season:String(item.season||'CURRENT').toUpperCase(),items:[]});
    groups.get(key).items.push(item);
  });
  return Array.from(groups.values()).sort((a,b)=>a.desk.localeCompare(b.desk)||b.season.localeCompare(a.season,undefined,{numeric:true}));
}
function analyzedSources(){return (manifest?.sources||[]).filter(x=>statusLabel(x).startsWith('ANALYZED')&&x?.publicFindings)}

function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    #${BUTTON_ID}{grid-column:1/-1!important;display:grid!important;place-items:center!important;gap:7px!important;padding:10px 8px!important;border-color:#9b5b50!important;color:#ffd0bb!important;background:#0a0505!important;box-shadow:inset 0 0 0 1px rgba(255,160,130,.05),0 0 10px rgba(175,72,52,.08)!important;text-shadow:0 0 6px rgba(255,166,132,.16)!important}
    #${BUTTON_ID} .f6Main{display:block;font-size:inherit}.f6Message{display:block;color:#c88f80;font-size:8px;font-weight:900;letter-spacing:.11em;line-height:1.35}
    #${BUTTON_ID}.active,#${BUTTON_ID}:hover{border-color:#e38a75!important;color:#ffe3d6!important;background:#120706!important;box-shadow:inset 0 0 0 1px rgba(255,190,165,.10),0 0 14px rgba(210,100,75,.14)!important}
    #${PREF_BUTTON_ID}{grid-column:1/-1!important;display:grid!important;place-items:center!important;gap:7px!important;padding-top:10px!important;padding-bottom:10px!important}
    #${PREF_BUTTON_ID} .prefMain{display:block;font-size:inherit}.prefMessage{display:block;color:#83a6b7;font-size:8px;font-weight:900;letter-spacing:.11em;line-height:1.35}
    #${PANEL_ID}{display:none;margin:0 12px 14px;padding:12px;border:1px solid #5f4039;background:radial-gradient(circle at 50% -20%,rgba(128,43,28,.20),transparent 48%),linear-gradient(180deg,#090504,#030303);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#d8e8ee;min-height:65vh}
    body.runnerSeasonPreviewsLoaded .top{display:none!important}
    body.runnerSeasonPreviewsLoaded .runnerNavPad{padding-top:8px!important;padding-bottom:0!important;margin-top:0!important}
    body.runnerSeasonPreviewsLoaded .runnerNavPad .tabs>.btn:not(#${BUTTON_ID}){display:none!important}
    body.runnerSeasonPreviewsLoaded #${BUTTON_ID}{grid-column:1/-1!important;display:grid!important}
    body.runnerSeasonPreviewsLoaded #${PANEL_ID}{display:block!important;margin-top:0!important}
    body.runnerSeasonPreviewsLoaded #${PANEL_ID}~*{display:none!important}

    .meatDeskHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #4a302b;padding-bottom:10px;flex-wrap:wrap}
    .meatDeskHead h2{margin:0;color:#ffd0bb;font-size:18px;letter-spacing:.12em}.meatDeskHead p{margin:5px 0 0;color:#9c827b;font-size:8px;line-height:1.55;letter-spacing:.05em}
    .meatDeskBadge{border:1px solid #81584d;color:#f0b5a4;background:#100705;padding:6px 9px;font-size:8px;font-weight:950;letter-spacing:.09em;line-height:1.45}
    .meatDeskPrivacy{margin:10px 0 0;border:1px solid #49342f;background:#070403;padding:8px 10px;color:#b9968b;font-size:8px;font-weight:850;line-height:1.5;letter-spacing:.06em}.meatDeskPrivacy b{color:#f0b5a4}

    .meatBoard{margin-top:13px;border:1px solid #5e3f37;background:#080403;padding:10px}
    .meatBoardHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;border-bottom:1px solid #3e2a25;padding-bottom:8px}
    .meatBoardTitle{color:#ffd1bf;font-size:11px;font-weight:950;letter-spacing:.11em}.meatBoardState{margin-top:4px;color:#c79586;font-size:7px;font-weight:900;letter-spacing:.08em}
    .meatBoardCount{border:1px solid #665045;background:#0c0705;padding:6px 8px;color:#dcb7a9;font-size:7px;font-weight:950;line-height:1.45;text-align:right}
    .meatBoardWarn{margin-top:8px;border:1px solid #6d5732;background:#0d0903;color:#e6c78b;padding:7px 8px;font-size:7px;font-weight:900;line-height:1.45;letter-spacing:.055em}
    .meatSectionTitle{margin:12px 0 6px;color:#ba8374;font-size:8px;font-weight:950;letter-spacing:.12em}
    .meatFindingsGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}
    .meatFinding{border:1px solid #46332e;background:#070403;padding:8px;min-width:0}
    .meatFindingTop{display:flex;align-items:flex-start;justify-content:space-between;gap:7px}.meatFindingTier{font-size:6.5px;font-weight:950;letter-spacing:.09em;border:1px solid #5e5441;padding:3px 5px;color:#dbc58e;white-space:nowrap}.meatFindingTier.strong{color:#bde7c5;border-color:#466a4c}.meatFindingTier.carry{color:#d7dca1;border-color:#61633f}
    .meatFindingTitle{color:#f0d6ce;font-size:9px;font-weight:950;line-height:1.3}.meatFindingLine{margin-top:4px;color:#e6b087;font-size:7px;font-weight:950;letter-spacing:.06em}
    .meatFindingWhy{margin-top:6px;color:#a9948d;font-size:7px;line-height:1.45}.meatFindingNext{margin-top:5px;color:#7f9aa6;font-size:6.8px;line-height:1.4}
    .meatCompactList{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:7px}.meatCompact{border:1px solid #3d302b;background:#060303;padding:7px}.meatCompact b{color:#e8c5b8;font-size:8px}.meatCompact span{display:block;margin-top:3px;color:#9b8881;font-size:6.8px;line-height:1.4}
    .meatConflict{border-color:#66413e}.meatConflict b{color:#e2a19c}
    .meatSystem{margin-top:7px;border:1px solid #5c5732;background:#090803;padding:8px}.meatSystemTitle{color:#e0d38e;font-size:8px;font-weight:950;letter-spacing:.09em}.meatSystemRule{margin-top:5px;color:#a9a176;font-size:7px;line-height:1.45}.meatSystemExamples{margin-top:5px;color:#8fa3a8;font-size:6.8px;line-height:1.5}.meatSystemState{margin-top:6px;color:#d9b36e;font-size:6.8px;font-weight:950;letter-spacing:.06em}

    .meatShelfTools{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:13px 0 8px}.meatSearch{flex:1 1 220px;min-height:36px;border:1px solid #4a302b;background:#080404;color:#e9d8d1;padding:8px 10px;font:800 10px ui-monospace,SFMono-Regular,Menlo,monospace;outline:none}.meatFilter{border:1px solid #594039;background:#080404;color:#a98f87;padding:7px 9px;font:900 8px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;cursor:pointer}.meatFilter.active{border-color:#d88672;color:#ffd5c6;background:#190908}
    .meatGroup{margin-top:14px}.meatGroup[hidden]{display:none!important}.meatGroupHead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 2px;border-bottom:1px solid #34231f;color:#d8a99b;font-size:9px;font-weight:950;letter-spacing:.11em}.meatGroupCount{color:#755f58;font-size:7px}
    .meatShelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:11px;padding:10px 0 5px}.meatSource{min-width:0;border:1px solid #51362f;border-left:4px solid #784b3f;background:linear-gradient(145deg,#100706,#050303);padding:10px;display:grid;grid-template-columns:38px minmax(0,1fr);gap:9px;align-items:start;box-shadow:inset 0 0 0 1px rgba(255,220,205,.025)}.meatSourceIcon{width:38px;height:45px;border:1px solid #553930;background:#0b0504;display:grid;place-items:center;font-size:22px}.meatSourceMain{min-width:0}.meatSourceKicker{color:#a47b70;font-size:7px;font-weight:950;letter-spacing:.09em}.meatSourceTitle{margin-top:4px;color:#f2d8cf;font-size:10px;font-weight:950;line-height:1.3}.meatSourceMeta{margin-top:5px;color:#866f68;font-size:7px;line-height:1.45}.meatSourceStatus{grid-column:1/-1;margin-top:2px;border:1px solid #523b34;background:#090504;padding:6px 7px;font-size:7px;font-weight:950;letter-spacing:.08em}.meatSourceStatus.available{color:#efb39f;border-color:#775044}.meatSourceStatus.analyzed{color:#b9e6c5;border-color:#44634c}.meatSourceStatus.verified{color:#cfe8ff;border-color:#466477}.meatSourceStatus.superseded{color:#9b8f8a;border-color:#514845}.meatSourceFoot{grid-column:1/-1;color:#6f5b55;font-size:6.5px;line-height:1.4;letter-spacing:.06em}.meatEmpty{margin-top:14px;border:1px dashed #81584d;padding:18px;text-align:center;color:#c99c8e;font-size:10px}
    @media(max-width:760px){#${PANEL_ID}{margin-left:7px;margin-right:7px;padding:9px}.meatShelf{grid-template-columns:1fr}.meatDeskBadge{width:100%}.meatFindingsGrid,.meatCompactList{grid-template-columns:1fr}}
  `;
  d.head.appendChild(s);
}

function setButtonCopy(b){
  const count=Array.isArray(manifest?.sources)?manifest.sources.length:null;
  const analyzed=analyzedSources().length;
  const msg=count===null
    ?`PRIVATE RESEARCH DESK&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F7] TO OPEN`
    :`${count} SOURCE${count===1?'':'S'} REGISTERED&nbsp;&nbsp; // &nbsp;&nbsp;${analyzed} ANALYZED&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F7] TO OPEN`;
  const html=`<span class="f6Main"><b>[F7]</b>&nbsp; 🥩 MEAT DESK 🥩</span><span class="f6Message">${msg}</span>`;
  if(b.innerHTML!==html)b.innerHTML=html;
}
function setPreferenceCopy(pref){
  const style=cardStyle();
  if(pref.dataset.cardStyleLabel===style&&pref.dataset.tabified==='1')return;
  pref.dataset.tabified='1';pref.dataset.cardStyleLabel=style;
  pref.innerHTML=`<span class="prefMain"><b>[TAB]</b>&nbsp; PREFERENCES</span><span class="prefMessage">CARD STYLE: ${esc(style)}&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [TAB] TO CONFIGURE</span>`;
  pref.setAttribute('aria-label','Preferences');
}
function patchLegacyPreferenceCopy(d){
  d.querySelectorAll('.prefFrameworkRule,.prefModulePolicy,.sp-note,.sp-control-lock').forEach(root=>{
    const walker=d.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){
      const next=String(node.nodeValue||'').replace(/F6 observes/g,'Preferences observes').replace(/F6 remains/g,'Preferences remains').replace(/\bF6\b/g,'[TAB] PREFERENCES');
      if(next!==node.nodeValue)node.nodeValue=next;
    }
  });
}
function filtersHtml(){
  return ['ALL',...sportKeys()].map(x=>`<button type="button" class="meatFilter${x==='ALL'?' active':''}" data-meat-filter="${esc(x)}">${esc(x)}</button>`).join('');
}
function sourceHtml(item){
  const title=esc(item.title||item.file||'UNTITLED SOURCE');
  const desk=shortDesk(item),season=String(item.season||'CURRENT').toUpperCase();
  const publisher=esc(item.publisher||item.format||'DESK SOURCE');
  const size=esc(sizeText(item.bytes));
  const status=statusLabel(item),klass=statusClass(item);
  const search=esc([item.title,item.kind,item.season,item.desk,item.publisher,(item.tags||[]).join(' '),status].filter(Boolean).join(' ').toUpperCase());
  return `<article class="meatSource" data-meat-item data-desk="${esc(desk)}" data-search="${search}">
    <div class="meatSourceIcon" aria-hidden="true">${iconFor(item)}</div>
    <div class="meatSourceMain"><div class="meatSourceKicker">${esc(desk)} // ${esc(season)}</div><div class="meatSourceTitle">${title}</div><div class="meatSourceMeta">${publisher}${size?` // ${size}`:''}</div></div>
    <div class="meatSourceStatus ${klass}">${esc(status)}</div>
    <div class="meatSourceFoot">PRIVATE SOURCE DOCUMENT // DOCUMENT ACCESS DISABLED // SANITIZED FINDINGS ONLY</div>
  </article>`;
}
function findingCard(x){
  const strong=String(x?.tier||'').toUpperCase().includes('STRONG');
  const tierClass=strong?'strong':'carry';
  return `<article class="meatFinding">
    <div class="meatFindingTop"><div class="meatFindingTitle">${esc(x?.title||'UNTITLED')}</div><span class="meatFindingTier ${tierClass}">${esc(x?.tier||'CARRY')}</span></div>
    ${x?.sourceLine?`<div class="meatFindingLine">SOURCE LINE // ${esc(x.sourceLine)}</div>`:''}
    ${x?.why?`<div class="meatFindingWhy">${esc(x.why)}</div>`:''}
    ${x?.next?`<div class="meatFindingNext">NEXT // ${esc(x.next)}</div>`:''}
  </article>`;
}
function compactCard(x,kind='watch'){
  const main=kind==='watch'?[x?.title,x?.angle].filter(Boolean).join(' // '):x?.title;
  const detail=kind==='watch'?x?.reason:x?.detail;
  return `<article class="meatCompact${kind==='conflict'?' meatConflict':''}"><b>${esc(main||'UNTITLED')}</b>${detail?`<span>${esc(detail)}</span>`:''}</article>`;
}
function boardHtml(item){
  const f=item?.publicFindings||{},carries=Array.isArray(f.carries)?f.carries:[],watch=Array.isArray(f.watch)?f.watch:[],conflicts=Array.isArray(f.conflicts)?f.conflicts:[],system=f.earlySeason||null;
  return `<section class="meatBoard">
    <div class="meatBoardHead">
      <div><div class="meatBoardTitle">${esc(f.label||`${item.title} // PRESEASON BOARD`)}</div><div class="meatBoardState">${esc(f.state||'PRESEASON RESEARCH')}</div></div>
      <div class="meatBoardCount">${carries.length} CARRIES // ${watch.length} WATCH<br>${conflicts.length} CONFLICTS // BETTING EDGE REVIEW PENDING</div>
    </div>
    ${f.disclaimer?`<div class="meatBoardWarn">${esc(f.disclaimer)}</div>`:''}
    ${carries.length?`<div class="meatSectionTitle">CARRY BOARD // SOURCE-DERIVED CANDIDATES</div><div class="meatFindingsGrid">${carries.map(findingCard).join('')}</div>`:''}
    ${watch.length?`<div class="meatSectionTitle">WATCH BOARD // NEEDS PRICE, FACT OR MARKET CONFIRMATION</div><div class="meatCompactList">${watch.map(x=>compactCard(x,'watch')).join('')}</div>`:''}
    ${conflicts.length?`<div class="meatSectionTitle">CONFLICT BOARD // DO NOT FORCE CONSENSUS</div><div class="meatCompactList">${conflicts.map(x=>compactCard(x,'conflict')).join('')}</div>`:''}
    ${system?`<div class="meatSectionTitle">EARLY-SEASON SYSTEM</div><div class="meatSystem"><div class="meatSystemTitle">${esc(system.title||'EARLY-SEASON SYSTEM')}</div><div class="meatSystemRule">${esc(system.rule||'')}</div><div class="meatSystemExamples">${(system.sourceExamples||[]).map(x=>`• ${esc(x)}`).join('<br>')}</div><div class="meatSystemState">${esc(system.state||'VERIFY BEFORE USE')}</div></div>`:''}
  </section>`;
}
function libraryHtml(){
  const sources=Array.isArray(manifest?.sources)?manifest.sources:[];
  const groups=groupSources(sources),analyzed=analyzedSources();
  return `<div class="meatDeskHead"><div><h2>🥩 MEAT DESK</h2><p>PRESEASON TOUT + RESEARCH DESK // SPORT → SEASON → SOURCE</p></div><div class="meatDeskBadge">${sources.length} SOURCE${sources.length===1?'':'S'} // ${analyzed.length} ANALYZED<br>REVIEW MODE: ${esc(analysisModeLabel())} // MANUAL ONLY</div></div>
    <div class="meatDeskPrivacy"><b>DESK POLICY:</b> SOURCE DOCUMENTS AND DETAILED RESEARCH STAY PRIVATE. THE SCREEN SHOWS ONLY APPROVED, SANITIZED FINDINGS. THESE ARE PRESEASON CANDIDATES — NOT CURRENT BETTING EDGE PLAYS.</div>
    ${analyzed.map(boardHtml).join('')}
    <div class="meatShelfTools"><input class="meatSearch" type="search" placeholder="SEARCH SOURCES…" aria-label="Search Meat Desk sources">${filtersHtml()}</div>
    ${groups.length?groups.map(group=>`<section class="meatGroup" data-meat-group="${esc(group.desk)}"><div class="meatGroupHead"><span>${esc(group.desk)} // ${esc(group.season)}</span><span class="meatGroupCount">${group.items.length} SOURCE${group.items.length===1?'':'S'}</span></div><div class="meatShelf">${group.items.map(sourceHtml).join('')}</div></section>`).join(''):`<div class="meatEmpty">NO RESEARCH SOURCES REGISTERED.</div>`}`;
}
function renderPanel(d){
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs'),nav=tabs?.parentElement;if(!nav)return;
  let p=d.getElementById(PANEL_ID);
  if(!p){p=d.createElement('section');p.id=PANEL_ID;p.setAttribute('aria-label','Meat Desk research board');nav.insertAdjacentElement('afterend',p)}
  p.innerHTML=libraryHtml();
}
function applyShelfFilter(d){
  const p=d.getElementById(PANEL_ID);if(!p)return;
  const q=String(p.querySelector('.meatSearch')?.value||'').trim().toUpperCase();
  const active=p.querySelector('.meatFilter.active')?.dataset.meatFilter||'ALL';
  p.querySelectorAll('[data-meat-item]').forEach(card=>{
    const search=String(card.dataset.search||''),desk=String(card.dataset.desk||'');
    const show=(active==='ALL'||desk===active)&&(!q||search.includes(q));
    card.style.display=show?'grid':'none';
  });
  p.querySelectorAll('[data-meat-group]').forEach(group=>{group.hidden=!Array.from(group.querySelectorAll('[data-meat-item]')).some(card=>card.style.display!=='none')});
}
function bindPanel(d){
  if(d.documentElement.dataset.meatDeskPanelBound==='1')return;
  d.documentElement.dataset.meatDeskPanelBound='1';
  d.addEventListener('click',e=>{
    const p=e.target.closest?.(`#${PANEL_ID}`);if(!p)return;
    const filter=e.target.closest('[data-meat-filter]');if(!filter)return;
    p.querySelectorAll('.meatFilter').forEach(x=>x.classList.toggle('active',x===filter));
    applyShelfFilter(d);
  });
  d.addEventListener('input',e=>{if(e.target.matches?.('.meatSearch'))applyShelfFilter(d)});
  d.addEventListener('change',()=>setTimeout(()=>{const pref=d.getElementById(PREF_BUTTON_ID);if(pref)setPreferenceCopy(pref)},0));
}
function closeDesk(d,b){d.body.classList.remove('runnerSeasonPreviewsLoaded');if(b){b.classList.remove('active');b.setAttribute('aria-pressed','false')}}
function bindNav(d,b,pref,tabs){
  if(b.dataset.bound!=='1'){
    b.dataset.bound='1';
    b.addEventListener('click',()=>{
      const open=!d.body.classList.contains('runnerSeasonPreviewsLoaded');
      d.body.classList.remove('runnerSyndicateLoaded','runnerPreferencesLoaded');pref?.classList.remove('active');
      d.body.classList.toggle('runnerSeasonPreviewsLoaded',open);b.classList.toggle('active',open);b.setAttribute('aria-pressed',String(open));
      if(open)renderPanel(d);
      try{d.defaultView?.scrollTo({top:0,left:0,behavior:'auto'})}catch{}
    });
  }
  if(pref&&pref.dataset.meatDeskBound!=='1'){pref.dataset.meatDeskBound='1';pref.addEventListener('click',()=>closeDesk(d,b))}
  if(tabs.dataset.meatDeskBound!=='1'){tabs.dataset.meatDeskBound='1';tabs.addEventListener('click',e=>{const x=e.target.closest('.btn');if(x&&x!==b)closeDesk(d,b)})}
  if(d.documentElement.dataset.meatDeskKeysBound!=='1'&&pref){
    d.documentElement.dataset.meatDeskKeysBound='1';
    d.addEventListener('keydown',e=>{
      if(e.key==='F7'){e.preventDefault();b.click();return}
      if(e.key==='Tab'&&!d.body.classList.contains('runnerPreferencesLoaded')){
        const target=e.target;if(target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
        e.preventDefault();pref.click();
      }
    },true);
  }
}
function ensureUi(d){
  if(!d?.body)return false;ensureStyle(d);
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');if(!tabs)return false;
  const pref=d.getElementById(PREF_BUTTON_ID);if(!pref)return false;
  let b=d.getElementById(BUTTON_ID);
  if(!b){b=d.createElement('button');b.type='button';b.id=BUTTON_ID;b.className='btn';b.setAttribute('aria-pressed','false');tabs.appendChild(b)}
  setButtonCopy(b);setPreferenceCopy(pref);
  if(tabs.lastElementChild!==pref)tabs.appendChild(pref);
  if(!d.getElementById(PANEL_ID))renderPanel(d);
  patchLegacyPreferenceCopy(d);bindPanel(d);bindNav(d,b,pref,tabs);return true;
}
async function loadManifest(){
  if(manifestRequested)return;manifestRequested=true;
  try{const r=await fetch(`${MANIFEST_URL}?v=${Date.now()}`,{cache:'no-store'});if(r.ok)manifest=await r.json()}catch{}
  const d=appDoc();if(d){ensureUi(d);setButtonCopy(d.getElementById(BUTTON_ID));if(d.body.classList.contains('runnerSeasonPreviewsLoaded'))renderPanel(d)}
}
function attach(){
  const d=appDoc();if(!d?.body)return false;
  if(d!==lastDoc){
    lastDoc=d;
    if(observer)observer.disconnect();
    observer=new MutationObserver(()=>requestAnimationFrame(()=>ensureUi(d)));
    observer.observe(d.body,{subtree:true,childList:true});
  }
  ensureUi(d);loadManifest();return true;
}
let tries=0;
const timer=setInterval(()=>{tries++;if(attach()||tries>200)clearInterval(timer)},100);
setInterval(()=>{const d=appDoc();if(d)ensureUi(d)},1200);
})();