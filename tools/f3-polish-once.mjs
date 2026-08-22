#!/usr/bin/env node
import fs from 'node:fs';

const p='index.html';
let html=fs.readFileSync(p,'utf8');
const must=(cond,msg)=>{if(!cond)throw new Error(msg)};
const replaceOnce=(oldText,newText,label)=>{
  const i=html.indexOf(oldText);
  must(i>=0,label+' marker not found');
  must(html.indexOf(oldText,i+oldText.length)<0,label+' marker not unique');
  html=html.slice(0,i)+newText+html.slice(i+oldText.length);
};

// F3-only palette: darker blue accents with softer blue supporting text.
const styleStart=html.indexOf('#history .sourceNote{color:var(--cyan);opacity:.82}');
const styleEnd=html.indexOf('</style><style>\n.healthgrid',styleStart);
must(styleStart>=0&&styleEnd>styleStart,'F3 style block not found');
const newStyle=`#history{--f3accent:var(--blue);--f3soft:#8ca9c5}\n#history .subbtn{color:var(--f3accent);border-color:var(--f3accent);background:#06101f}\n#history .subbtn.active{color:var(--yellow);border-color:var(--yellow);background:#211e08}\n#history .sectiontitle,#history .datatable th{color:var(--f3accent)}\n#history .key,#history .sourceNote{color:var(--f3soft);opacity:1}\n#history .stat,#history .box{border-color:#173a63}\n#history .datatable td{border-top-color:#173a63}\n#history .pagebtn{color:var(--f3accent);border-color:var(--f3accent)}\n#history .filters input,#history .filters select,#history .jump input{border-color:#173a63}\n#ledger .filters{grid-template-columns:2fr 1fr}\n.f3sourcebar{margin-top:9px;padding:9px 12px;border-top:1px solid #173a63;border-bottom:1px solid #173a63;color:#8ca9c5;font-size:11px;letter-spacing:.03em;background:#050d19}\n.f3sourcebar b{color:var(--blue)}\n.foot{color:#7894ae;border-top-color:#173a63}\n@media(max-width:560px){#ledger .filters{grid-template-columns:1fr}}\n`;
html=html.slice(0,styleStart)+newStyle+html.slice(styleEnd);

replaceOnce('data-h="ledger">FULL LEDGER</button>','data-h="ledger">LEDGER</button>','Ledger tab label');
replaceOnce('<div id="historySource" class="sourceNote">PUBLIC STATS // loading sanitized public ledger.</div>','<div id="historySource" class="hidden"></div>','Summary source line');

// Replace the visible ledger with a compact public-facing record.
const ledgerStart=html.indexOf('<div id="ledger" class="hview hidden" style="margin-top:10px">');
const engineStart=html.indexOf('<section id="engine" class="view pad hidden">',ledgerStart);
must(ledgerStart>=0&&engineStart>ledgerStart,'Ledger section boundary not found');
const ledger=`<div id="ledger" class="hview hidden" style="margin-top:10px"><div class="box"><div class="sectiontitle">LEDGER</div><div id="ledgerStatus" class="sourceNote">LOADING…</div><span id="ledgerCountTag" class="hidden"></span></div><div class="box filters" style="margin-top:8px"><label><span class="key">SEARCH</span><input id="search" placeholder="bet, event, team, player…"></label><label><span class="key">RESULT</span><select id="result"><option value="">ALL</option><option>Won</option><option>Lost</option><option>CashedOut</option><option>Push</option><option>Cancelled</option></select></label></div><div class="box scroll" style="margin-top:8px"><table class="datatable"><thead><tr><th>DATE</th><th>BET</th><th>ODDS</th><th>STAKE</th><th>RESULT</th><th>P/L</th></tr></thead><tbody id="ledgerBody"></tbody></table></div><div class="box pager" style="margin-top:8px"><button id="prev" class="pagebtn">◀ PREV 10</button><div style="text-align:center"><b id="range">SHOWING</b><br><span id="pageInfo" class="sourceNote"></span></div><div class="jump"><span class="key">PAGE</span><input id="pageJump" inputmode="numeric" value="1"><button id="goPage" class="pagebtn">GO</button></div><button id="next" class="pagebtn">NEXT 10 ▶</button></div></div></section>\n`;
html=html.slice(0,ledgerStart)+ledger+html.slice(engineStart);

// Collapse the large source panel to one restrained line.
const sourceStart=html.indexOf('<div class="box f3source" style="margin-top:9px">');
const footerStart=html.indexOf('<footer class="foot">',sourceStart);
must(sourceStart>=0&&footerStart>sourceStart,'F3 source block boundary not found');
html=html.slice(0,sourceStart)+'<div class="f3sourcebar"><b>DATA SOURCES</b> // BET365 · DRAFTKINGS · RESEARCH LIBRARY · OFFICIAL INTEL</div>'+html.slice(footerStart);

// Compact public ledger behavior: search/result only, newest first.
const filteredStart=html.indexOf('function filtered(){');
const tdStart=html.indexOf('function td(',filteredStart);
must(filteredStart>=0&&tdStart>filteredStart,'Filtered function boundary not found');
html=html.slice(0,filteredStart)+`function filtered(){let d=DATA.slice(),q=$('search').value.trim().toLowerCase(),res=$('result').value;if(q)d=d.filter(x=>corpus(x).includes(q));if(res)d=d.filter(x=>x.result===res);const t=x=>Date.parse(x.placed)||0;d.sort((a,b)=>t(b)-t(a)||b.id-a.id);return d}\n`+html.slice(tdStart);

const renderStart=html.indexOf('function render(){');
const resultStart=html.indexOf('function resultSettled(x){',renderStart);
must(renderStart>=0&&resultStart>renderStart,'Render function boundary not found');
const render=`function render(){const d=filtered(),pages=Math.max(1,Math.ceil(d.length/ROWS));page=Math.max(0,Math.min(page,pages-1));const start=page*ROWS;const body=$('ledgerBody');body.replaceChildren();d.slice(start,start+ROWS).forEach(x=>{const tr=document.createElement('tr');const bet=x.legs.length>1?(x.desc||x.legs.length+'-LEG PARLAY'):x.desc;td(tr,localDate(x.placed).split(' ')[0]);td(tr,bet||'—');td(tr,odds(x.odds));td(tr,'$'+x.risk.toFixed(2));td(tr,x.result==='CashedOut'?'CASHED OUT':String(x.result||'—').toUpperCase(),x.result==='Won'?'g':x.result==='Lost'?'r':'y');td(tr,money(x.pl),x.pl>0?'g':x.pl<0?'r':'');body.appendChild(tr)});$('range').textContent=d.length?\`SHOWING \${start+1}–\${Math.min(start+ROWS,d.length)} OF \${d.length.toLocaleString()}\`:'NO MATCHES';$('pageInfo').textContent=\`PAGE \${page+1} / \${pages}\`;$('pageJump').value=page+1;$('prev').disabled=page===0;$('next').disabled=page>=pages-1}\n`;
html=html.slice(0,renderStart)+render+html.slice(resultStart);

replaceOnce("function init(){[...new Set(DATA.map(x=>x.sport).filter(Boolean))].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;$('sport').appendChild(o)});[...new Set(DATA.map(x=>x.book).filter(Boolean))].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;$('book').appendChild(o)});setLedgerText();renderHistoryStats();render()}","function init(){setLedgerText();renderHistoryStats();render()}",'Ledger init');
replaceOnce("[\"search\",\"sport\",\"result\",\"book\",\"sort\"].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;render()}));","[\"search\",\"result\"].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;render()}));",'Ledger listeners');
replaceOnce("$('ledgerStatus').textContent='READY // '+count.toLocaleString()+' WAGERS // '+pages+' PAGES // UPDATED '+new Date(LEDGER_META.generatedAt).toLocaleString('en-CA',{timeZone:'America/Vancouver',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});","$('ledgerStatus').textContent='UPDATED '+new Date(LEDGER_META.generatedAt).toLocaleString('en-CA',{timeZone:'America/Vancouver',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true})+' PT';",'Ledger status');

fs.writeFileSync(p,html);

// Validate visible simplicity and browser JS syntax.
const out=fs.readFileSync(p,'utf8');
must(out.includes('data-h="ledger">LEDGER</button>'),'LEDGER tab missing');
must(!out.includes('data-h="ledger">FULL LEDGER</button>'),'FULL LEDGER survived');
must(out.includes('<div class="sectiontitle">LEDGER</div>'),'Ledger heading missing');
must(out.includes('<th>DATE</th><th>BET</th><th>ODDS</th><th>STAKE</th><th>RESULT</th><th>P/L</th>'),'Compact ledger columns missing');
must(!out.includes('id="sport"')&&!out.includes('id="book"')&&!out.includes('id="sort"'),'Extra ledger filters survived');
must(out.includes('.f3sourcebar')&&out.includes('--f3accent:var(--blue)'),'F3 palette/source polish missing');
must(!out.includes('PUBLIC DATA SOURCES'),'Large source block survived');
const scripts=[...out.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
for(const [i,code] of scripts.entries()){try{new Function(code)}catch(e){throw new Error('Inline script '+i+' syntax: '+e.message)}}
console.log('F3 FINAL POLISH VALIDATION: PASS');
