import fs from 'node:fs';

const PATH='index.html';
let html=fs.readFileSync(PATH,'utf8');

const historyStart=html.indexOf('<div id="summary" class="hview"');
const ledgerStart=html.indexOf('<div id="ledger" class="hview hidden"',historyStart);
if(historyStart<0||ledgerStart<0) throw new Error('F3 history block markers not found');

const liveHistory=`<div id="summary" class="hview" style="margin-top:10px"><div class="grid" style="grid-template-columns:repeat(4,1fr)"><div class="stat"><div class="key">UNIQUE WAGERS</div><b class="c" id="summaryWagers">—</b></div><div class="stat"><div class="key">CASH BETS</div><b id="summaryCashBets">—</b></div><div class="stat"><div class="key">CASH RISKED</div><b id="summaryCashRisked">—</b></div><div class="stat"><div class="key">CASH PROFIT</div><b id="summaryCashProfit">—</b></div></div><div class="grid cols" style="margin-top:9px"><div class="box"><div class="sectiontitle">CASH ROI</div><div class="bigprice" id="summaryCashRoi">—</div></div><div class="box"><div class="sectiontitle">PREGAME SINGLE WAGERS</div><div class="bigprice" id="summaryPregameRoi">—</div><div class="small" id="summaryPregameMeta">CALCULATING…</div></div><div class="box"><div class="sectiontitle">RESULT MIX</div><div id="summaryResultMix">CALCULATING…</div></div></div><div id="historySource" class="sourceNote">LIVE PUBLIC STATS // loading sanitized ledger projection.</div></div>
<div id="sports" class="hview hidden box" style="margin-top:10px"><div class="sectiontitle">ALL SETTLED WAGERS // SPORT</div><div class="scroll"><table class="datatable"><thead><tr><th>SPORT</th><th>BETS</th><th>PROFIT</th><th>ROI</th></tr></thead><tbody id="sportsBody"></tbody></table></div><div class="sourceNote">Public performance view. Cash-accounting totals remain authoritative in Summary.</div></div>
<div id="types" class="hview hidden box" style="margin-top:10px"><div class="sectiontitle">PREGAME SINGLE WAGERS // BET TYPES</div><div class="scroll"><table class="datatable"><thead><tr><th>TYPE</th><th>BETS</th><th>RISKED</th><th>PROFIT</th><th>ROI</th></tr></thead><tbody id="typesBody"></tbody></table></div><div class="sourceNote">Live descriptive taxonomy derived from public wager descriptions and leg labels.</div></div>
<div id="timing" class="hview hidden box" style="margin-top:10px"><div class="sectiontitle">TIMING // SETTLED WAGERS</div><div class="scroll"><table class="datatable"><thead><tr><th>TIMING</th><th>BETS</th><th>RISKED</th><th>PROFIT</th><th>ROI</th></tr></thead><tbody id="timingBody"></tbody></table></div><div id="timingNote" class="sourceNote">Calculated live from the public projection.</div></div>
<div id="prices" class="hview hidden box" style="margin-top:10px"><div class="sectiontitle">PREGAME SINGLE WAGERS // PRICE BANDS</div><div class="scroll"><table class="datatable"><thead><tr><th>ODDS</th><th>BETS</th><th>PROFIT</th><th>ROI</th></tr></thead><tbody id="pricesBody"></tbody></table></div><div class="sourceNote">Descriptive only. No broad odds band is treated as a betting rule.</div></div>
<div id="books" class="hview hidden box" style="margin-top:10px"><div class="sectiontitle">SPORTSBOOK PERFORMANCE // SETTLED WAGERS</div><div class="scroll"><table class="datatable"><thead><tr><th>BOOK</th><th>BETS</th><th>RISKED</th><th>PROFIT</th><th>ROI</th></tr></thead><tbody id="booksBody"></tbody></table></div><div class="sourceNote">Book names are public-facing; sportsbook ticket/reference IDs remain removed.</div></div>
<div id="time" class="hview hidden box" style="margin-top:10px"><div class="sectiontitle">SETTLED PERFORMANCE // YEAR</div><div class="scroll"><table class="datatable"><thead><tr><th>YEAR</th><th>BETS</th><th>PROFIT</th><th>ROI</th></tr></thead><tbody id="timeBody"></tbody></table></div></div>
<div id="clv" class="hview hidden box" style="margin-top:10px"><div class="sectiontitle">CLOSING-LINE VALUE</div><div class="grid cols" style="margin-top:9px"><div><div class="key">WAGERS WITH CLV</div><b id="clvCount">—</b></div><div><div class="key">MEAN CLV</div><b id="clvMean">—</b></div><div><div class="key">MEDIAN CLV</div><b id="clvMedian">—</b></div></div><div id="clvCoverage" class="sourceNote">Coverage is calculated live from the public projection.</div></div>
`;

html=html.slice(0,historyStart)+liveHistory+html.slice(ledgerStart);

const oldRec="function rec(r){return {id:r[0],book:r[1],bookid:r[2],placed:r[3],settled:r[4],sport:r[5]||'',league:r[6]||'',desc:r[7]||'',odds:+r[8],risk:+r[9],result:r[10]||'',pl:+r[11],timing:r[12]||'UNKNOWN',clv:r[13],boosted:!!r[14],events:r[15]||[],legs:r[16]||[],tags:r[17]||''}}";
const newRec="function rec(r){return {id:r[0],book:r[1]||'Unknown',placed:r[3],settled:r[4],sport:r[5]||'',league:r[6]||'',desc:r[7]||'',odds:+r[8],risk:+r[9]||0,result:r[10]||'',pl:+r[11]||0,timing:r[12]||'UNKNOWN',clv:r[13],boosted:!!r[14],events:Array.isArray(r[15])?r[15]:[],legs:Array.isArray(r[16])?r[16]:[],tags:r[17]||''}}";
if(!html.includes(oldRec)) throw new Error('F3 record parser marker not found');
html=html.replace(oldRec,newRec);

const oldCorpus="function corpus(x){return [x.id,x.book,x.bookid,x.sport,x.league,x.desc,x.result,x.timing,...x.events,...x.legs,x.tags].join(' ').toLowerCase()}";
const newCorpus="function corpus(x){return [x.id,x.book,x.sport,x.league,x.desc,x.result,x.timing,...x.events,...x.legs,x.tags].join(' ').toLowerCase()}";
if(!html.includes(oldCorpus)) throw new Error('F3 search corpus marker not found');
html=html.replace(oldCorpus,newCorpus);

const insertMarker='function setLedgerText(){';
const insertAt=html.indexOf(insertMarker);
if(insertAt<0) throw new Error('F3 setLedgerText marker not found');

const liveStatsJs=String.raw`function resultSettled(x){return ['Won','Lost','CashedOut','Push','Cancelled'].includes(x.result)}
function statAgg(rows){const risk=rows.reduce((t,x)=>t+(Number(x.risk)||0),0),profit=rows.reduce((t,x)=>t+(Number(x.pl)||0),0);return {bets:rows.length,risk,profit,roi:risk?profit/risk*100:0}}
function statTone(n){return n>0?'g':n<0?'r':'y'}
function pct(n,d=2){return (Number(n)>0?'+':'')+Number(n||0).toFixed(d)+'%'}
function setTone(id,n,base=''){const x=$(id);if(x)x.className=(base?base+' ':'')+statTone(Number(n)||0)}
function tableRow(body,cells){const tr=document.createElement('tr');for(const c of cells)td(tr,c.text,c.cls||'');body.appendChild(tr)}
function groupStats(rows,keyFn){const m=new Map();for(const x of rows){const k=keyFn(x)||'Other / Unclassified';if(!m.has(k))m.set(k,[]);m.get(k).push(x)}return [...m].map(([name,a])=>({name,...statAgg(a)}))}
function publicBetType(x){const t=[x.desc,...x.legs].join(' ').toLowerCase();if(/goalscorer|touchdown|rush yds|rushing yards|receiv|passing|shots|rebounds|assists|strikeouts|total bases|hits, runs|player |offsides|saves|aces|double faults|home runs|rbis|runs scored|stolen base|fight outcome|round betting/.test(t))return 'Props';if(/spread|point spread|run line|puck line|handicap/.test(t))return 'Spread';if(/money line|moneyline|to advance|match winner|draw no bet| to win\b/.test(t))return 'Moneyline';if(/total|over |under |o\/u|team points|team total/.test(t))return 'Totals';return 'Props'}
function wagerYear(x){const d=new Date(x.placed);if(!Number.isFinite(d.getTime()))return 'Unknown';try{return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric'}).format(d)}catch(e){return String(d.getUTCFullYear())}}
function renderHistoryStats(){
  const settled=DATA.filter(resultSettled),single=x=>x.legs.length<=1,pregameSingles=settled.filter(x=>x.timing==='PREGAME'&&single(x)),pre=statAgg(pregameSingles);
  const preRoi=$('summaryPregameRoi');if(preRoi){preRoi.textContent=pct(pre.roi);preRoi.className='bigprice '+statTone(pre.roi)}
  const preMeta=$('summaryPregameMeta');if(preMeta)preMeta.textContent=pre.bets.toLocaleString()+' bets // '+money(pre.profit)+' // $'+pre.risk.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})+' risked';
  const src=$('historySource');if(src)src.textContent='LIVE PUBLIC STATS // '+(LEDGER_META.deliverySource||'PUBLIC PROJECTION')+' // cash accounting uses the authoritative private-ledger summary; detailed tabs are calculated from sanitized wager rows.';

  const sports=$('sportsBody');if(sports){sports.replaceChildren();for(const s of groupStats(settled,x=>x.sport).sort((a,b)=>b.profit-a.profit||b.bets-a.bets))tableRow(sports,[{text:s.name},{text:s.bets.toLocaleString()},{text:money(s.profit),cls:statTone(s.profit)},{text:pct(s.roi),cls:statTone(s.roi)}])}

  const types=$('typesBody');if(types){types.replaceChildren();const grouped=Object.fromEntries(groupStats(pregameSingles,publicBetType).map(x=>[x.name,x]));for(const name of ['Spread','Props','Moneyline','Totals']){const s=grouped[name]||{bets:0,risk:0,profit:0,roi:0};tableRow(types,[{text:name},{text:s.bets.toLocaleString()},{text:'$'+s.risk.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})},{text:money(s.profit),cls:statTone(s.profit)},{text:pct(s.roi),cls:statTone(s.roi)}])}}

  const timing=$('timingBody');if(timing){timing.replaceChildren();const grouped=Object.fromEntries(groupStats(settled,x=>x.timing||'UNKNOWN').map(x=>[x.name,x]));for(const name of ['PREGAME','AFTER START','UNKNOWN']){const s=grouped[name];if(!s)continue;tableRow(timing,[{text:name},{text:s.bets.toLocaleString()},{text:'$'+s.risk.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})},{text:money(s.profit),cls:statTone(s.profit)},{text:pct(s.roi),cls:statTone(s.roi)}])}const p=grouped.PREGAME,a=grouped['AFTER START'],note=$('timingNote');if(note&&p&&a)note.textContent='Pregame '+pct(p.roi)+' ROI vs after-start '+pct(a.roi)+' ROI across the sanitized settled-wager sample. Descriptive history, not an automatic betting rule.'}

  const bands=[['≤ -131',x=>x.odds<=-131],['-130 to -101',x=>x.odds>=-130&&x.odds<=-101],['-100 to +130',x=>x.odds>=-100&&x.odds<=130],['+131 to +200',x=>x.odds>=131&&x.odds<=200],['+201+',x=>x.odds>=201]];const prices=$('pricesBody');if(prices){prices.replaceChildren();for(const [name,test] of bands){const s=statAgg(pregameSingles.filter(test));tableRow(prices,[{text:name},{text:s.bets.toLocaleString()},{text:money(s.profit),cls:statTone(s.profit)},{text:pct(s.roi),cls:statTone(s.roi)}])}}

  const books=$('booksBody');if(books){books.replaceChildren();for(const s of groupStats(settled,x=>x.book).sort((a,b)=>b.bets-a.bets||b.profit-a.profit))tableRow(books,[{text:s.name},{text:s.bets.toLocaleString()},{text:'$'+s.risk.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})},{text:money(s.profit),cls:statTone(s.profit)},{text:pct(s.roi),cls:statTone(s.roi)}])}

  const time=$('timeBody');if(time){time.replaceChildren();for(const s of groupStats(settled,wagerYear).sort((a,b)=>String(a.name).localeCompare(String(b.name))))tableRow(time,[{text:s.name},{text:s.bets.toLocaleString()},{text:money(s.profit),cls:statTone(s.profit)},{text:pct(s.roi),cls:statTone(s.roi)}])}

  const clv=settled.map(x=>x.clv).filter(v=>v!==null&&v!==''&&Number.isFinite(Number(v))).map(Number).sort((a,b)=>a-b),mean=clv.length?clv.reduce((t,x)=>t+x,0)/clv.length:0,median=clv.length?(clv.length%2?clv[(clv.length-1)/2]:(clv[clv.length/2-1]+clv[clv.length/2])/2):0;const count=$('clvCount'),mn=$('clvMean'),md=$('clvMedian'),cov=$('clvCoverage');if(count)count.textContent=clv.length.toLocaleString();if(mn){mn.textContent=pct(mean*100);mn.className=statTone(mean)}if(md){md.textContent=pct(median*100);md.className=statTone(median)}if(cov)cov.textContent='CLV coverage '+(settled.length?((clv.length/settled.length)*100).toFixed(1):'0.0')+'% of settled public wagers // calculated live.';
}
`;

html=html.slice(0,insertAt)+liveStatsJs+'\n'+html.slice(insertAt);

const oldInit="function init(){[...new Set(DATA.map(x=>x.sport).filter(Boolean))].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;$('sport').appendChild(o)});[...new Set(DATA.map(x=>x.book).filter(Boolean))].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;$('book').appendChild(o)});setLedgerText();render()}";
const newInit="function init(){[...new Set(DATA.map(x=>x.sport).filter(Boolean))].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;$('sport').appendChild(o)});[...new Set(DATA.map(x=>x.book).filter(Boolean))].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;$('book').appendChild(o)});setLedgerText();renderHistoryStats();render()}";
if(!html.includes(oldInit)) throw new Error('F3 init marker not found');
html=html.replace(oldInit,newInit);

const summaryMarker="put('summaryCashProfit',(Number(s.cashProfit||0)>=0?'+':'-')+'$'+Math.abs(Number(s.cashProfit||0)).toFixed(2));put('summaryCashRoi',(Number(s.cashRoiPercent||0)>=0?'+':'')+Number(s.cashRoiPercent||0).toFixed(2)+'%');";
const summaryReplacement=summaryMarker+"setTone('summaryCashProfit',Number(s.cashProfit||0));setTone('summaryCashRoi',Number(s.cashRoiPercent||0),'bigprice');";
if(!html.includes(summaryMarker)) throw new Error('F3 summary tone marker not found');
html=html.replace(summaryMarker,summaryReplacement);

for(const stale of ['+9.32% ROI','752 bets // +$388.66','180</b></div><div><div class="key">MEAN CLV'])if(html.includes(stale))throw new Error('Static F3 statistic survived: '+stale);
for(const marker of ['id="sportsBody"','id="typesBody"','id="timingBody"','id="pricesBody"','id="booksBody"','id="timeBody"','function renderHistoryStats()','PRIVATE MASTER // CLOUDFLARE'])if(!html.includes(marker))throw new Error('Missing F3 live marker: '+marker);

fs.writeFileSync(PATH,html);
console.log('F3 public stats converted to live sanitized-ledger calculations.');
