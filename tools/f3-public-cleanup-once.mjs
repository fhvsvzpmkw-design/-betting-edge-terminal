#!/usr/bin/env node
import fs from 'node:fs';

const p='index.html';
let html=fs.readFileSync(p,'utf8');
function once(oldText,newText,label){
  const first=html.indexOf(oldText);
  if(first<0)throw new Error(label+' marker not found');
  if(html.indexOf(oldText,first+oldText.length)>=0)throw new Error(label+' marker not unique');
  html=html.slice(0,first)+newText+html.slice(first+oldText.length);
}

const styleMarker='</style><style>\n.healthgrid';
const styleAdd=`
#history .sourceNote{color:var(--cyan);opacity:.82}
#ledger .filters{grid-template-columns:2fr repeat(4,1fr)}
.f3source,.f3source .small,.f3source p,.f3source .g,.f3source .y,.f3source .c{color:var(--cyan)}
.f3source{border-color:var(--blue)}
.f3source .sourcecard{border-color:var(--blue)}
.foot{color:var(--cyan)}
@media(max-width:900px){#ledger .filters{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){#ledger .filters{grid-template-columns:1fr}}
`;
once(styleMarker,styleAdd+styleMarker,'F3 style insertion');

const oldTabs='<section id="history" class="view pad hidden"><div class="subtabs"><button class="subbtn active" data-h="summary">SUMMARY</button><button class="subbtn" data-h="sports">SPORTS</button><button class="subbtn" data-h="types">BET TYPES</button><button class="subbtn" data-h="timing">TIMING</button><button class="subbtn" data-h="prices">PRICES</button><button class="subbtn" data-h="books">BOOKS</button><button class="subbtn" data-h="time">TIME</button><button class="subbtn" data-h="clv">CLV</button><button class="subbtn" data-h="ledger">FULL LEDGER</button></div>';
const newTabs='<section id="history" class="view pad hidden"><div class="subtabs"><button class="subbtn active" data-h="summary">SUMMARY</button><button class="subbtn" data-h="sports">SPORTS</button><button class="subbtn" data-h="types">BET TYPES</button><button class="subbtn" data-h="books">BOOKS</button><button class="subbtn" data-h="time">TIME</button><button class="subbtn" data-h="ledger">FULL LEDGER</button></div>';
once(oldTabs,newTabs,'F3 tabs');

once('<div id="historySource" class="sourceNote">LIVE PUBLIC STATS // loading sanitized ledger projection.</div>','<div id="historySource" class="sourceNote">PUBLIC STATS // loading sanitized public ledger.</div>','F3 source note');

const ledgerStart=html.indexOf('<div id="ledger" class="hview hidden" style="margin-top:10px">');
const engineStart=html.indexOf('<section id="engine" class="view pad hidden">',ledgerStart);
if(ledgerStart<0||engineStart<0)throw new Error('Ledger section boundary not found');
const ledgerHtml=`<div id="ledger" class="hview hidden" style="margin-top:10px"><div class="box"><div class="cardhead"><div><div class="sectiontitle">PUBLIC BETTING LEDGER</div><div id="ledgerStatus" class="g small">LOADING PUBLIC LEDGER</div></div><span class="tag g" id="ledgerCountTag">1,624 UNIQUE // 163 PAGES</span></div></div><div class="box filters" style="margin-top:8px"><label><span class="key">SEARCH</span><input id="search" placeholder="bet, event, team, player…"></label><label><span class="key">SPORT</span><select id="sport"><option value="">ALL</option></select></label><label><span class="key">RESULT</span><select id="result"><option value="">ALL</option><option>Won</option><option>Lost</option><option>CashedOut</option><option>Push</option><option>Cancelled</option></select></label><label><span class="key">BOOK</span><select id="book"><option value="">ALL</option></select></label><label><span class="key">SORT</span><select id="sort"><option value="new">NEWEST</option><option value="old">OLDEST</option><option value="risk">STAKE HIGH</option><option value="pl">P/L HIGH</option><option value="odds">ODDS HIGH</option></select></label></div><div class="box scroll" style="margin-top:8px"><table class="datatable"><thead><tr><th>DATE (PT)</th><th>SPORT</th><th>BET</th><th>BOOK</th><th>ODDS</th><th>STAKE</th><th>RESULT</th><th>P/L</th></tr></thead><tbody id="ledgerBody"></tbody></table></div><div class="box pager" style="margin-top:8px"><button id="prev" class="pagebtn">◀ PREV 10</button><div style="text-align:center"><b id="range">SHOWING</b><br><span id="pageInfo" class="muted small"></span></div><div class="jump"><span class="key">PAGE</span><input id="pageJump" inputmode="numeric" value="1"><button id="goPage" class="pagebtn">GO</button></div><button id="next" class="pagebtn">NEXT 10 ▶</button></div></div></section>\n`;
html=html.slice(0,ledgerStart)+ledgerHtml+html.slice(engineStart);

once('<div class="box" style="margin-top:9px"><div class="sectiontitle">EVIDENCE GOVERNANCE // v1.3</div>','<div class="box f3source" style="margin-top:9px"><div class="sectiontitle">PUBLIC DATA SOURCES</div>','Lower source block');
once('Fresh supported sportsbook prices remain the execution gate. Research Fit is read-only and cannot create a BET or override identity, freshness, fair value, playTo, status, or stake.','Public performance data is read-only. Private account identifiers and sportsbook ticket/reference IDs are not displayed.','Lower source copy');

once("function corpus(x){return [x.id,x.book,x.sport,x.league,x.desc,x.result,x.timing,...x.events,...x.legs,x.tags].join(' ').toLowerCase()}","function corpus(x){return [x.book,x.sport,x.league,x.desc,x.result,...x.events,...x.legs].join(' ').toLowerCase()}",'Ledger search corpus');
once("function filtered(){let d=DATA.slice(),q=$('search').value.trim().toLowerCase(),sp=$('sport').value,res=$('result').value,tm=$('ledgerTiming').value,bk=$('book').value,s=$('sort').value;if(q)d=d.filter(x=>corpus(x).includes(q));if(sp)d=d.filter(x=>x.sport.includes(sp));if(res)d=d.filter(x=>x.result===res);if(tm)d=d.filter(x=>x.timing===tm);if(bk)d=d.filter(x=>x.book===bk);const t=x=>Date.parse(x.placed)||0;if(s==='new')d.sort((a,b)=>t(b)-t(a)||b.id-a.id);if(s==='old')d.sort((a,b)=>t(a)-t(b)||a.id-b.id);if(s==='risk')d.sort((a,b)=>b.risk-a.risk);if(s==='pl')d.sort((a,b)=>b.pl-a.pl);if(s==='odds')d.sort((a,b)=>b.odds-a.odds);return d}","function filtered(){let d=DATA.slice(),q=$('search').value.trim().toLowerCase(),sp=$('sport').value,res=$('result').value,bk=$('book').value,s=$('sort').value;if(q)d=d.filter(x=>corpus(x).includes(q));if(sp)d=d.filter(x=>x.sport.includes(sp));if(res)d=d.filter(x=>x.result===res);if(bk)d=d.filter(x=>x.book===bk);const t=x=>Date.parse(x.placed)||0;if(s==='new')d.sort((a,b)=>t(b)-t(a)||b.id-a.id);if(s==='old')d.sort((a,b)=>t(a)-t(b)||a.id-b.id);if(s==='risk')d.sort((a,b)=>b.risk-a.risk);if(s==='pl')d.sort((a,b)=>b.pl-a.pl);if(s==='odds')d.sort((a,b)=>b.odds-a.odds);return d}",'Ledger filters');

const detailStart=html.indexOf('function showDetail(x){');
const renderStart=html.indexOf('function render(){',detailStart);
if(detailStart<0||renderStart<0)throw new Error('Ledger detail/render boundary not found');
html=html.slice(0,detailStart)+html.slice(renderStart);
const renderNow=html.indexOf('function render(){');
const resultStart=html.indexOf('function resultSettled(x){',renderNow);
if(renderNow<0||resultStart<0)throw new Error('Ledger render boundary not found');
const newRender=`function render(){const d=filtered(),pages=Math.max(1,Math.ceil(d.length/ROWS));page=Math.max(0,Math.min(page,pages-1));const start=page*ROWS;const body=$('ledgerBody');body.replaceChildren();d.slice(start,start+ROWS).forEach(x=>{const tr=document.createElement('tr');td(tr,localDate(x.placed));td(tr,x.sport||'—');td(tr,(x.legs.length>1?x.legs.length+'-LEG // ':'')+x.desc);td(tr,x.book);td(tr,odds(x.odds));td(tr,'$'+x.risk.toFixed(2));td(tr,x.result==='CashedOut'?'CASHED OUT':String(x.result||'—').toUpperCase(),x.result==='Won'?'g':x.result==='Lost'?'r':'y');td(tr,money(x.pl),x.pl>0?'g':x.pl<0?'r':'');body.appendChild(tr)});$('range').textContent=d.length?\`SHOWING \${start+1}–\${Math.min(start+ROWS,d.length)} OF \${d.length.toLocaleString()}\`:'NO MATCHES';$('pageInfo').textContent=\`PAGE \${page+1} / \${pages} // PUBLIC LEDGER \${DATA.length.toLocaleString()}\`;$('pageJump').value=page+1;$('prev').disabled=page===0;$('next').disabled=page>=pages-1}\n`;
html=html.slice(0,renderNow)+newRender+html.slice(resultStart);

once("const src=$('historySource');if(src)src.textContent='LIVE PUBLIC STATS // '+(LEDGER_META.deliverySource||'PUBLIC PROJECTION')+' // cash accounting uses the authoritative private-ledger summary; detailed tabs are calculated from sanitized wager rows.';","const src=$('historySource');if(src)src.textContent='PUBLIC STATS // SANITIZED PUBLIC LEDGER // '+(LEDGER_META.deliverySource||'CLOUDFLARE');",'History source runtime');
once("$('ledgerStatus').textContent='READY // '+count.toLocaleString()+' UNIQUE WAGERS // '+pages+' PAGES // SYNC '+new Date(LEDGER_META.generatedAt).toLocaleString('en-CA',{timeZone:'America/Vancouver',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' // '+(LEDGER_META.deliverySource||'PUBLIC F3 DATASET');","$('ledgerStatus').textContent='READY // '+count.toLocaleString()+' WAGERS // '+pages+' PAGES // UPDATED '+new Date(LEDGER_META.generatedAt).toLocaleString('en-CA',{timeZone:'America/Vancouver',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});",'Ledger status runtime');
once("[\"search\",\"sport\",\"result\",\"ledgerTiming\",\"book\",\"sort\"].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;$('rowDetail').classList.add('hidden');render()}));","[\"search\",\"sport\",\"result\",\"book\",\"sort\"].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;render()}));",'Ledger listeners');

const tabs=[...html.matchAll(/data-h="([^"]+)"/g)].map(m=>m[1]);
const want=['summary','sports','types','books','time','ledger'];
if(JSON.stringify(tabs)!==JSON.stringify(want))throw new Error('Unexpected F3 tabs: '+tabs.join(','));
for(const marker of ['PUBLIC BETTING LEDGER','<th>DATE (PT)</th><th>SPORT</th><th>BET</th><th>BOOK</th><th>ODDS</th><th>STAKE</th><th>RESULT</th><th>P/L</th>','PUBLIC DATA SOURCES','#history .sourceNote{color:var(--cyan)','PUBLIC STATS // SANITIZED PUBLIC LEDGER'])if(!html.includes(marker))throw new Error('Missing marker: '+marker);
if(html.includes('id="ledgerTiming"'))throw new Error('Public ledger timing filter survived');
if(html.includes('b.onclick=()=>showDetail(x)'))throw new Error('Technical ledger detail click survived');
const scripts=[...html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
scripts.forEach((code,i)=>{try{new Function(code)}catch(e){throw new Error('Inline script '+i+' syntax: '+e.message)}});
fs.writeFileSync(p,html);
console.log('F3 PUBLIC CLEANUP VALIDATION: PASS');
