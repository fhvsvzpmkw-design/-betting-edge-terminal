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
function pizzaButtonMessage(){
  if(String(pizza?.status||'').toUpperCase()==='PLAY'&&pizza?.play)return `LOU TWO SLICE // 1 COMPELLED VIGSCOPE CARD&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F5] TO OPEN`;
  return `LOU TWO SLICE // OVEN CLOSED&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F5] TO OPEN`;
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
    #${PIZZA_PANEL},#${CRYPTO_PANEL}{display:none;margin:0 10px 16px;padding:14px;min-height:65vh;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    #${PIZZA_PANEL}{--deskAccent:#ff9a49;--deskAccentSoft:#c98a59;--deskLine:#75421f;border:1px solid #75421f;background:radial-gradient(circle at 50% -18%,rgba(183,76,24,.22),transparent 46%),linear-gradient(180deg,#100703,#030303);color:#ecd8c4;box-shadow:inset 0 0 30px rgba(255,137,55,.025),0 0 18px rgba(172,73,24,.08)}
    #${CRYPTO_PANEL}{--deskAccent:#9c87ff;--deskAccentSoft:#9e91dc;--deskLine:#514379;border:1px solid #514379;background:radial-gradient(circle at 50% -18%,rgba(92,63,184,.16),transparent 44%),linear-gradient(180deg,#06050d,#020306 58%,#010204);color:#ddd8f6;box-shadow:inset 0 0 30px rgba(124,91,222,.03),0 0 18px rgba(82,58,164,.08);font-size:18px}
    body.runnerPizzaLoaded .top,body.runnerCryptoLoaded .top{display:none!important}
    body.runnerPizzaLoaded .runnerNavPad,body.runnerCryptoLoaded .runnerNavPad{padding-top:8px!important;padding-bottom:0!important;margin-top:0!important}
    body.runnerPizzaLoaded .runnerNavPad .tabs>.btn:not(#${PIZZA_ID}){display:none!important}
    body.runnerCryptoLoaded .runnerNavPad .tabs>.btn:not(#${CRYPTO_ID}){display:none!important}
    body.runnerPizzaLoaded #${PIZZA_PANEL},body.runnerCryptoLoaded #${CRYPTO_PANEL}{display:block!important;margin-top:0!important}
    body.runnerPizzaLoaded #${PIZZA_PANEL}~*,body.runnerCryptoLoaded #${CRYPTO_PANEL}~*{display:none!important}
    .specialHead{display:flex;align-items:center;min-height:44px;margin:0 0 13px;padding:9px 11px;border:1px solid var(--deskLine);background:linear-gradient(180deg,color-mix(in srgb,var(--deskAccent) 8%,#070707),#030305);box-shadow:inset 3px 0 0 color-mix(in srgb,var(--deskAccent) 70%,transparent),0 0 14px color-mix(in srgb,var(--deskAccent) 7%,transparent)}.specialBadge{border:0!important;background:transparent!important;padding:0!important;color:var(--deskAccent)!important;font-size:11px!important;font-weight:950;letter-spacing:.10em;line-height:1.45}.pizzaBadge,.cryptoBadge{color:var(--deskAccent)!important}
    .specialShelf{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-top:12px}.specialCard{min-height:150px;border:1px solid rgba(255,255,255,.13);background:rgba(0,0,0,.20);padding:14px;display:grid;align-content:center;gap:8px}.specialIcon{font-size:36px}.specialCard b{font-size:13px;letter-spacing:.06em}.specialCard span{font-size:9px;line-height:1.5;color:#9e9691}.specialEmpty{margin-top:16px;border:1px dashed rgba(255,255,255,.25);padding:26px 16px;text-align:center}.specialEmpty strong{display:block;font-size:14px;letter-spacing:.08em}.specialEmpty span{display:block;margin-top:8px;color:#938b87;font-size:9px;line-height:1.55}
    .pizzaBoard{display:grid;grid-template-columns:1fr;gap:12px;margin-top:12px}.pizzaPick{position:relative;border:2px solid #a95625;border-left:5px solid #ff8c3a;background:linear-gradient(180deg,#130904,#080402);padding:16px;box-shadow:inset 0 0 0 1px rgba(255,166,80,.04),0 0 18px rgba(178,72,18,.10);font-size:17px}.pizzaPickHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.pizzaIdentity{min-width:0}.pizzaLouTag{display:inline-block;border:2px solid #ff9346;color:#ffd09a;background:#1b0a03;padding:6px 10px;font-size:14px;font-weight:950;letter-spacing:.10em;box-shadow:0 0 11px rgba(255,140,58,.14)}.pizzaPick h3{margin:10px 0 0;color:#fff0dc;font-size:24px;line-height:1.2;letter-spacing:.04em;text-transform:uppercase}.pizzaSourceState{text-align:right;min-width:190px}.pizzaSourceState small{display:block;color:#9d6f52;font-size:11px;font-weight:950;letter-spacing:.11em;margin-bottom:5px}.pizzaSourceState strong{display:block;color:#ffb36f;font-size:20px;font-weight:950;letter-spacing:.08em}.pizzaSourceState span{display:block;margin-top:5px;color:#a47d65;font-size:10px;font-weight:900;letter-spacing:.06em}.pizzaMarketStrip{margin-top:14px;background:#090402;border:1px solid #7e3f1e;padding:13px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.pizzaMarketCell{min-width:0}.pizzaMarketCell small{display:block;color:#9a6c4f;font-size:11px;font-weight:950;letter-spacing:.10em;margin-bottom:6px}.pizzaMarketCell strong{display:block;color:#ffe5c7;font-size:20px;font-weight:950;line-height:1.35;overflow-wrap:anywhere}.pizzaMarketCell.target strong{color:#ffc17f}.pizzaMarketCell.edge strong{color:#ffad62}.pizzaEventMeta{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:10px;padding:10px 12px;border:1px solid #4c2817;background:#080403;color:#c9a991;font-size:13px;font-weight:800;line-height:1.5;letter-spacing:.025em}.pizzaEventMeta b{color:#ffb16a;font-size:10px;letter-spacing:.09em}.pizzaExplainGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:11px}.pizzaExplain{border:1px solid #55301d;background:#0b0503;padding:12px;min-height:118px}.pizzaExplain small{display:block;color:#ff9d54;font-size:11px;font-weight:950;letter-spacing:.11em;margin-bottom:8px}.pizzaExplain strong{display:block;color:#dcc1ac;font-size:15px;font-weight:800;line-height:1.5}.pizzaExplain.lou{border-color:#8f4721;background:#100603}.pizzaExplain.lou strong{color:#ffe0bd}.pizzaExplain.watch{border-color:#6d3624}.pizzaExplain.watch small{color:#e58a5c}.pizzaSourceNote{margin-top:10px;color:#906e59;font-size:11px;line-height:1.5;letter-spacing:.025em}.pizzaSourceNote b{color:#c98b61}.pizzaTimestamp{margin-top:10px;text-align:right;color:#765442;font-size:10px;font-weight:900;letter-spacing:.08em}
    .cryptoSourceBar{display:grid;grid-template-columns:minmax(0,1.35fr) repeat(3,minmax(110px,.65fr));gap:0;margin-top:11px;border:1px solid #3d315d;background:linear-gradient(180deg,#090814,#05050b)}.cryptoSourceCell{border:0;border-left:1px solid #302744;background:transparent;padding:8px 10px;min-width:0}.cryptoSourceCell:first-child{border-left:0}.cryptoSourceCell small{display:block;color:#746b91;font-size:8px;font-weight:950;letter-spacing:.12em;margin-bottom:3px}.cryptoSourceCell strong,.cryptoSourceCell a{display:block;color:#c8c0e5;font-size:11px;font-weight:950;line-height:1.3;letter-spacing:.04em;text-decoration:none;overflow-wrap:anywhere}.cryptoSourceCell a:hover{color:#fff}.cryptoSourceCell.cryptoNoVig strong{color:#8f86ab}
    .cryptoSummary{margin-top:9px;border-left:3px solid #785dbd;background:#080710;padding:9px 11px;color:#9f97b7;font-size:11px;line-height:1.5;letter-spacing:.02em}.cryptoSummary b{color:#d6d0e8;letter-spacing:.08em}
    .cryptoBoard{display:grid;grid-template-columns:1fr;gap:11px;margin-top:12px}
    .cryptoPick{--status:#9c87ff;position:relative;width:100%;border:1px solid #4b4163;border-left:4px solid var(--status);background:linear-gradient(180deg,#070914,#04060c);padding:13px 14px;box-shadow:inset 0 0 0 1px rgba(191,176,255,.018),0 0 10px rgba(0,0,0,.22);font-size:16px}
    .cryptoPick[data-status="PLAY"]{--status:#58ff88}.cryptoPick[data-status="WAIT"]{--status:#5edcff}.cryptoPick[data-status="WATCH"]{--status:#ffd36b}.cryptoPick[data-status="PASS"]{--status:#ff738a}
    .cryptoTopLine{display:flex;justify-content:space-between;align-items:center;gap:12px}.cryptoStatusTag{display:inline-block;border:1px solid var(--status);color:var(--status);background:color-mix(in srgb,var(--status) 6%,#03060b);padding:5px 10px;font-size:14px;font-weight:950;letter-spacing:.11em;box-shadow:0 0 9px color-mix(in srgb,var(--status) 14%,transparent)}.cryptoGrade{color:#9e96b3;font-size:10px;font-weight:950;letter-spacing:.12em;white-space:nowrap}.cryptoGrade b{color:#d8d1e9;font-size:13px;margin-left:4px}.cryptoPick h3{margin:9px 0 0;color:#f2eff8;font-size:22px;line-height:1.18;letter-spacing:.045em;text-transform:uppercase}.cryptoMarket{margin-top:5px;color:#8d85a4;font-size:12px;font-weight:900;letter-spacing:.075em}
    .cryptoValueStrip{margin-top:12px;background:#040710;border:1px solid #514172;padding:10px 11px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.cryptoValueCell{min-width:0}.cryptoValueCell small{display:block;color:#776e8b;font-size:9px;font-weight:950;letter-spacing:.11em;margin-bottom:5px}.cryptoValueCell strong{display:block;color:#ebe7f5;font-size:21px;font-weight:950;line-height:1.2;overflow-wrap:anywhere}.cryptoValueCell.fair strong{color:#c9c1df}.cryptoValueCell.target strong{color:var(--status)}
    .cryptoActionLine{margin-top:8px;display:flex;align-items:center;gap:9px;border-left:3px solid var(--status);background:color-mix(in srgb,var(--status) 4%,#070811);padding:8px 10px;color:#c5bed5;font-size:12px;font-weight:900;letter-spacing:.055em}.cryptoActionLine b{color:var(--status);font-size:13px;letter-spacing:.08em}.cryptoActionLine span{color:#938aa7}
    .cryptoEventMeta{display:flex;flex-wrap:wrap;gap:5px 14px;margin-top:8px;padding:7px 1px 0;border:0;border-top:1px solid #272237;background:transparent;color:#91899f;font-size:11px;font-weight:800;line-height:1.4;letter-spacing:.025em}.cryptoEventMeta span{white-space:normal}.cryptoEventMeta b{color:#aaa1bf;font-size:9px;letter-spacing:.08em}.cryptoEventMeta .eventStart{color:#c7c0d5}.cryptoEventMeta .eventStart b{color:var(--status)}
    .cryptoWhy{margin-top:9px;padding:0 1px;color:#b6afc2;font-size:14px;line-height:1.5}.cryptoWhy b{display:block;margin-bottom:3px;color:var(--status);font-size:10px;letter-spacing:.10em}.cryptoSourceNote{margin-top:8px;color:#716a7d;font-size:10px;line-height:1.4;letter-spacing:.025em}.cryptoSourceNote b{color:#938b9f}.cryptoAnalysisBtn{width:100%;margin-top:9px;font:inherit;font-size:11px;font-weight:950;padding:8px 10px;background:#0b0814;color:#b9ace6;border:1px solid #574586;cursor:pointer;letter-spacing:.075em}.cryptoAnalysisBtn:hover{border-color:#8d75d5;color:#eee9ff}
    .cryptoDetail{margin-top:8px;border:1px dotted #4b3e64;background:#03050a;padding:10px;display:none;color:#9d95ad;font-size:13px;line-height:1.5}.cryptoDetail.open{display:block}.cryptoDetailFull{padding:1px 2px 10px;border-bottom:1px solid #292237;margin-bottom:9px}.cryptoDetailFull small{display:block;color:#827993;font-size:9px;font-weight:950;letter-spacing:.11em;margin-bottom:5px}.cryptoDetailFull p{margin:0;color:#b8b0c4;font-size:13px;line-height:1.55}.cryptoDetailGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.cryptoDetailCell{border:1px solid #292337;background:#060710;padding:8px}.cryptoDetailCell small{display:block;color:#71697f;font-size:9px;font-weight:950;letter-spacing:.10em;margin-bottom:4px}.cryptoDetailCell strong{display:block;color:#c3bbd2;font-size:12px;line-height:1.4}
    .cryptoPasses{margin-top:12px;border:1px solid rgba(94,76,143,.30);background:rgba(8,6,18,.60)}.cryptoPasses summary{cursor:pointer;list-style:none;padding:9px 11px;color:#9a90b3;font-size:11px;font-weight:950;letter-spacing:.11em}.cryptoPasses summary::-webkit-details-marker{display:none}.cryptoPasses[open] summary{border-bottom:1px solid rgba(94,76,143,.24)}.cryptoPassList{display:grid;gap:7px;padding:9px}.cryptoPass{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;border-left:3px solid #ff738a;background:#07070d;padding:9px}.cryptoPass strong{color:#bbb4c7;font-size:13px;letter-spacing:.05em}.cryptoPass span{display:block;margin-top:3px;color:#817a8d;font-size:11px;line-height:1.4}.cryptoPass b{color:#ff8295;font-size:11px;letter-spacing:.08em}.cryptoTimestamp{margin-top:10px;text-align:right;color:#6e667e;font-size:10px;font-weight:900;letter-spacing:.08em}
    @media(max-width:900px){.pizzaMarketStrip{grid-template-columns:repeat(2,minmax(0,1fr))}.pizzaExplainGrid{grid-template-columns:1fr}.cryptoDetailGrid{grid-template-columns:1fr}}
    @media(max-width:720px){#${PIZZA_PANEL},#${CRYPTO_PANEL}{margin-left:7px;margin-right:7px;padding:10px}.specialShelf{grid-template-columns:1fr}.cryptoSourceBar{grid-template-columns:1fr 1fr}.cryptoSourceCell:nth-child(3){border-left:0;border-top:1px solid #302744}.cryptoSourceCell:nth-child(4){border-top:1px solid #302744}}
    @media(max-width:560px){.pizzaPickHead{display:block}.pizzaSourceState{text-align:left;min-width:0;margin-top:11px}.pizzaMarketStrip{grid-template-columns:1fr}.pizzaPick h3{font-size:21px}.pizzaMarketCell strong{font-size:18px}.pizzaExplain strong{font-size:14px}.cryptoPick{padding:12px 11px}.cryptoPick h3{font-size:20px}.cryptoStatusTag{font-size:13px}.cryptoGrade{font-size:9px}.cryptoGrade b{font-size:12px}.cryptoValueStrip{padding:8px;gap:4px}.cryptoValueCell small{font-size:8px}.cryptoValueCell strong{font-size:17px}.cryptoActionLine{display:block;font-size:11px}.cryptoActionLine span{display:block;margin-top:3px}.cryptoEventMeta{font-size:10px}.cryptoWhy{font-size:13px}.cryptoSourceBar{grid-template-columns:1fr}.cryptoSourceCell,.cryptoSourceCell:nth-child(3),.cryptoSourceCell:nth-child(4){border-left:0;border-top:1px solid #302744}.cryptoSourceCell:first-child{border-top:0}}

    .deskSectionBar{display:flex;align-items:center;gap:10px;margin:14px 0 9px;color:var(--deskAccent);font-size:10px;font-weight:950;letter-spacing:.12em;line-height:1.35;text-transform:uppercase}.deskSectionBar b{white-space:nowrap}.deskSectionBar span{margin-left:auto;color:var(--deskAccentSoft);font-size:8px;letter-spacing:.08em;text-align:right;order:2}.deskSectionBar:after{content:"";height:1px;flex:1 1 70px;order:1;background:linear-gradient(90deg,color-mix(in srgb,var(--deskAccent) 55%,transparent),transparent)}
    .pizzaPick{border-color:#a85d2b!important;border-left-color:var(--deskAccent)!important;box-shadow:inset 0 0 0 1px rgba(255,174,98,.045),inset 0 -28px 45px rgba(0,0,0,.14),0 0 25px rgba(203,88,28,.12)!important}.pizzaMarketStrip,.pizzaExplain,.pizzaEventMeta{box-shadow:inset 0 0 15px rgba(255,132,49,.018)}.pizzaLouTag{box-shadow:0 0 15px rgba(255,140,58,.18)!important}.pizzaPick h3{font-size:clamp(24px,3vw,31px)!important}
    .cryptoSourceBar{margin-top:0!important}.cryptoBoard{margin-top:0!important}.cryptoPick{box-shadow:inset 0 0 0 1px rgba(191,176,255,.02),inset 0 -22px 38px rgba(0,0,0,.10),0 0 15px rgba(96,72,166,.07)!important}
    @media(max-width:720px){#${PIZZA_PANEL},#${CRYPTO_PANEL}{margin-left:7px;margin-right:7px;padding:11px}.specialHead{min-height:42px;padding:8px 9px;margin-bottom:11px}.deskSectionBar{margin-top:12px}.deskSectionBar span{display:none}.pizzaPick h3{font-size:24px!important}}

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
function ptDateTime(value){
  const d=new Date(String(value||''));if(!Number.isFinite(d.getTime()))return '';
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(d).toUpperCase();
}
function priceText(v){return String(v??'').trim()||'—'}
function pizzaPanelHtml(data){
  const play=data?.play;const source=data?.source||{};const live=String(data?.status||'').toUpperCase()==='PLAY'&&play;
  const reportLabel=esc(source.reportLabel||source.slot||'CURRENT REPORT');
  const badge=live?`ONE SLICE // ${reportLabel}`:`OVEN CLOSED // ${reportLabel}`;
  const head=`<div class="specialHead deskStatusRail pizzaHead"><div class="specialBadge pizzaBadge">${badge}</div></div>`;
  if(!live){return `${head}<div class="specialEmpty"><strong>LOU KEEPS THE DOUGH IN THE DRAWER</strong><span>${esc(data?.reason||'Every current VigScope card is PASS. No Pizza Play is forced.')}</span></div>`}
  const eventStart=ptDateTime(play?.feed?.eventDate);const sourceOrdinal=Number(play?.sourceOrdinal)||1;
  const eventMeta=[play?.meta?`<span><b>EVENT //</b> ${esc(play.meta)}</span>`:'',eventStart?`<span><b>START //</b> ${esc(eventStart)} PT</span>`:''].filter(Boolean).join('');
  return `${head}<div class="deskSectionBar"><b>PRIMARY PLAY</b><span>${reportLabel}</span></div><div class="pizzaBoard"><article class="pizzaPick">
    <div class="pizzaPickHead"><div class="pizzaIdentity"><span class="pizzaLouTag">LOU TWO SLICE // ONE PLAY</span><h3>${esc(play?.title||'UNTITLED VIGSCOPE CARD')}</h3></div><div class="pizzaSourceState"><small>VIGSCOPE CARD STATUS</small><strong>${esc(play?.vigScopeStatus||'—')}</strong><span>CARD ${sourceOrdinal} // ${reportLabel}</span></div></div>
    <div class="pizzaMarketStrip">
      <div class="pizzaMarketCell"><small>BOOK / PRICE</small><strong>${esc(play?.book||'—')} // ${esc(priceText(play?.price))}</strong></div>
      <div class="pizzaMarketCell target"><small>TARGET PRICE</small><strong>${esc(priceText(play?.targetPrice))}</strong></div>
      <div class="pizzaMarketCell"><small>FAIR VALUE</small><strong>${esc(priceText(play?.fair))}</strong></div>
      <div class="pizzaMarketCell edge"><small>PUBLISHED EDGE</small><strong>${esc(priceText(play?.edge))}</strong></div>
    </div>
    ${eventMeta?`<div class="pizzaEventMeta">${eventMeta}</div>`:''}
    <div class="pizzaExplainGrid">
      <div class="pizzaExplain"><small>WHY THIS ONE</small><strong>${esc(play?.whyThisOne||'Highest-ranked live VigScope card.')}</strong></div>
      <div class="pizzaExplain"><small>THE EDGE</small><strong>${esc(play?.edgeRead||[play?.fair,play?.edge].filter(Boolean).join(' // '))}</strong></div>
      <div class="pizzaExplain lou"><small>LOU'S READ</small><strong>${esc(play?.lousRead||'Lou makes this his one Pizza Play.')}</strong></div>
      <div class="pizzaExplain watch"><small>WATCH OUT</small><strong>${esc(play?.watchOut||play?.vigScopeNote||'Respect the original VigScope conditions.')}</strong></div>
    </div>
    <div class="pizzaSourceNote"><b>VIGSCOPE NOTE //</b> ${esc(play?.vigScopeNote||'')} ${play?.sourceNote?`<br><b>SOURCE //</b> ${esc(play.sourceNote)}`:''}${data?.selectionRule?.note?`<br><b>RULE //</b> ${esc(data.selectionRule.note)}`:''}</div>
    ${data?.generatedAt?`<div class="pizzaTimestamp">BUILT FROM ${esc(data.generatedAt)} // AMERICA/VANCOUVER</div>`:''}
  </article></div>`;
}
function fallbackEvent(card){
  const key=[card?.selection,card?.market].filter(Boolean).join(' ').toUpperCase();
  if(key.includes('CAMERON'))return {event:'MVPW-06 · UK VS USA',eventDate:'AUG 29, 2026',eventStartPt:'11:00 AM PT',venue:'BP PULSE LIVE · BIRMINGHAM'};
  if(key.includes('HRGOVIC')||key.includes('BERINCHYK')||key.includes('NOAKES'))return {event:'ITAUMA vs HRGOVIC',eventDate:'AUG 29, 2026',eventStartPt:'11:00 AM PT',venue:'THE O2 · LONDON'};
  if(key.includes('MARTINEZ')||key.includes('PLANTIC'))return {event:'PROBOXTV · MARTINEZ vs PLANTIC',eventDate:'AUG 29, 2026',eventStartPt:'2:30 PM PT',venue:'GALEN CENTER · LOS ANGELES'};
  return {};
}
function eventMetaHtml(card){
  const fallback=fallbackEvent(card);
  const event=card?.event||fallback.event||'';
  const date=card?.eventDate||fallback.eventDate||'';
  const start=card?.eventStartPt||fallback.eventStartPt||'';
  const venue=card?.venue||fallback.venue||'';
  const cells=[];
  if(event)cells.push(`<span><b>EVENT //</b> ${esc(event)}</span>`);
  if(date)cells.push(`<span><b>DATE //</b> ${esc(date)}</span>`);
  if(start)cells.push(`<span class="eventStart"><b>START //</b> ${esc(start)}</span>`);
  if(venue)cells.push(`<span><b>VENUE //</b> ${esc(venue)}</span>`);
  return cells.length?`<div class="cryptoEventMeta">${cells.join('')}</div>`:'';
}
function fairPriceText(card){
  const direct=String(card?.fairPrice||card?.fair||'').trim();if(direct)return direct;
  const text=[card?.priceNote,card?.movement].filter(Boolean).join(' · ');
  const m=text.match(/(?:NO-VIG|FAIR)\s*(~?\s*[+-]\d+(?:\.\d+)?)/i);
  return m?m[1].replace(/\s+/g,''):'—';
}
function shortRationale(card){
  const text=String(card?.rationale||'').trim();if(!text)return 'No published rationale.';
  const sentences=text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[text];
  const out=sentences.slice(0,2).join(' ').trim();
  return out.length>260?`${out.slice(0,257).trimEnd()}…`:out;
}
function actionLineText(card,status){
  const action=String(card?.actionLabel||status).trim()||status;
  const target=priceText(card?.targetPrice);
  if(target!=='—'&&!action.toUpperCase().includes(target.toUpperCase()))return `${action} // ${target}`;
  return action;
}
function cryptoCardHtml(card,index){
  const status=String(card?.status||'WATCH').toUpperCase();
  const rank=String(card?.rank||'').toUpperCase();
  const detailId=`cryptoDetail${String(card?.id||index).replace(/[^a-zA-Z0-9_-]/g,'')}`;
  const gradeHtml=rank?`<span class="cryptoGrade">GRADE <b>${esc(rank)}</b></span>`:'';
  return `<article class="cryptoPick" data-status="${esc(status)}">
    <div class="cryptoTopLine"><span class="cryptoStatusTag">${esc(status)}</span>${gradeHtml}</div>
    <h3>${esc(card?.selection||card?.title||'UNTITLED')}</h3>
    <div class="cryptoMarket">${esc(card?.market||'MARKET')}</div>
    <div class="cryptoValueStrip">
      <div class="cryptoValueCell"><small>CURRENT</small><strong>${esc(priceText(card?.observedPrice))}</strong></div>
      <div class="cryptoValueCell fair"><small>FAIR</small><strong>${esc(fairPriceText(card))}</strong></div>
      <div class="cryptoValueCell target"><small>TARGET</small><strong>${esc(priceText(card?.targetPrice))}</strong></div>
    </div>
    <div class="cryptoActionLine"><b>${esc(actionLineText(card,status))}</b><span>${esc(card?.decision||status)}</span></div>
    ${eventMetaHtml(card)}
    <div class="cryptoWhy"><b>WHY ${esc(status)}?</b>${esc(shortRationale(card))}</div>
    <div class="cryptoSourceNote"><b>SOURCE //</b> ${esc(card?.sourceLabel||crypto?.source?.name||'WEB SOURCE')}</div>
    <button class="cryptoAnalysisBtn" type="button" data-crypto-detail="${esc(detailId)}">▶ VIEW ANALYSIS</button>
    <div id="${esc(detailId)}" class="cryptoDetail">
      <div class="cryptoDetailFull"><small>FULL RATIONALE</small><p>${esc(card?.rationale||'No published rationale.')}</p></div>
      <div class="cryptoDetailGrid">
        <div class="cryptoDetailCell"><small>MARKET MOVEMENT</small><strong>${esc(card?.movement||card?.marketStatus||'NO MOVEMENT NOTE')}</strong></div>
        <div class="cryptoDetailCell"><small>PRICE DISCIPLINE</small><strong>${esc(card?.priceNote||'NONE')}</strong></div>
        <div class="cryptoDetailCell"><small>FINAL CALL</small><strong>${esc(card?.decision||status)}</strong></div>
      </div>
    </div>
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
  return `<div class="specialHead deskStatusRail cryptoHead"><div class="specialBadge cryptoBadge">${badge}</div></div>
    <div class="deskSectionBar"><b>INTELLIGENCE</b><span>SOURCE + MARKET PASS</span></div>
    <div class="cryptoSourceBar">
      <div class="cryptoSourceCell"><small>SOURCE 01 // ENTRY POINT</small>${sourceHtml}</div>
      <div class="cryptoSourceCell"><small>ANALYSIS</small><strong>LEVEL 3 · ${mode}</strong></div>
      <div class="cryptoSourceCell"><small>MARKET PASS</small><strong>BETTING EDGE</strong></div>
      <div class="cryptoSourceCell cryptoNoVig"><small>VIGSCOPE</small><strong>NOT INVOLVED</strong></div>
    </div>
    <div class="cryptoSummary"><b>DAILY READ //</b> ${summary}</div>
    <div class="deskSectionBar"><b>LIVE BOARD</b><span>${active.length} ACTIVE // ${passes.length} PASS</span></div>
    ${activeHtml}${passHtml}${generated?`<div class="cryptoTimestamp">ANALYZED ${generated} // AMERICA/VANCOUVER</div>`:''}`;
}
function panelHtml(kind,data){
  if(kind==='pizza')return pizzaPanelHtml(data||{});
  if(kind==='crypto'&&data?.board)return cryptoPanelHtml(data);
  const items=Array.isArray(data?.items)?data.items:[];
  const title='CRYPTO SPECIALS';
  const desc='PREMIUM WEB LINKS // CRYPTO ANALYSIS // SPECIAL COLLECTION';
  const badge=`${items.length} WEB SOURCE${items.length===1?'':'S'} // ${cryptoAnalysisModeLabel()}`;
  const emptyTitle='THE VAULT IS EMPTY';
  const emptyText='Add one curated web-page URL here. New sources remain pending until an analysis is published.';
  return `<div class="specialHead deskStatusRail cryptoHead"><div class="specialBadge cryptoBadge">${badge}</div></div><div class="deskSectionBar"><b>SOURCE COLLECTION</b><span>CURATED WEB INTELLIGENCE</span></div>${items.length?`<div class="specialShelf">${items.map(x=>itemCard(x,kind)).join('')}</div>`:`<div class="specialEmpty"><strong>${emptyTitle}</strong><span>${emptyText}</span></div>`}`;
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
  let p=d.getElementById(PIZZA_ID);if(!p){p=d.createElement('button');p.type='button';p.id=PIZZA_ID;p.className='btn'}
  if(p.dataset.specialDeskOpenBound!=='1'){p.dataset.specialDeskOpenBound='1';p.addEventListener('click',()=>{const open=!d.body.classList.contains('runnerPizzaLoaded');closeAllDesks(d);if(open){d.body.classList.add('runnerPizzaLoaded');p.classList.add('active');ensurePanel(d,PIZZA_PANEL,'pizza',pizza)}})}
  const pizzaHtml=buttonHtml('F5','🍕 PIZZA PLAYS 🍕',pizzaButtonMessage(),'pizza');if(p.innerHTML!==pizzaHtml)p.innerHTML=pizzaHtml;
  let c=d.getElementById(CRYPTO_ID);if(!c){c=d.createElement('button');c.type='button';c.id=CRYPTO_ID;c.className='btn'}
  if(c.dataset.specialDeskOpenBound!=='1'){c.dataset.specialDeskOpenBound='1';c.addEventListener('click',()=>{const open=!d.body.classList.contains('runnerCryptoLoaded');closeAllDesks(d);if(open){d.body.classList.add('runnerCryptoLoaded');c.classList.add('active');ensurePanel(d,CRYPTO_PANEL,'crypto',crypto)}})}
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
  if(d!==lastDoc){lastDoc=d;if(observer)observer.disconnect();bindKeys(d);observer=new MutationObserver(()=>requestAnimationFrame(()=>ensureButtons(d)));const target=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');if(target)observer.observe(target,{subtree:true,childList:true})}
  bindKeys(d);ensureButtons(d);return true;
}
Promise.all([
  fetch(`${PIZZA_URL}?v=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch(`${CRYPTO_URL}?v=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)
]).then(([p,c])=>{pizza=p;crypto=c;const d=appDoc();if(d)ensureButtons(d)});
let tries=0;const boot=()=>{tries++;if(attach()||tries>250)return;setTimeout(boot,40)};boot();
window.addEventListener('pageshow',()=>{const d=appDoc();if(d){bindKeys(d);ensureButtons(d)}});
})();
