#!/usr/bin/env node
import fs from 'node:fs';

const path='index.html';
let html=fs.readFileSync(path,'utf8');

const cssMarker='#ledger .filters{grid-template-columns:2fr 1fr}\n';
if(!html.includes(cssMarker)) throw new Error('F3 CSS marker not found');
const premiumCss=`#history .f3premium{border:1px solid #b99036;background:linear-gradient(180deg,#151108 0%,#0b0d13 100%);box-shadow:inset 0 0 0 1px #4d3b14}\n#history .f3premiumTitle{color:#e0b94f;font-weight:900;letter-spacing:.06em}\n#history .premiumgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}\n#history .premiummetric{border:1px solid #6d5421;background:#0c0d0c;padding:10px}\n#history .premiummetric .key{color:#ba9b55}\n#history .premiummetric .bigprice{color:#f0c85b}\n#history .premiumhint{color:#9f8959;font-size:10px;margin-top:4px;letter-spacing:.03em}\n@media(max-width:560px){#history .premiumgrid{grid-template-columns:1fr}}\n`;
html=html.replace(cssMarker,cssMarker+premiumCss);

const oldBox='<div class="grid cols" style="margin-top:9px"><div class="box"><div class="sectiontitle">OVERALL ROI</div><div class="bigprice" id="summaryCashRoi">—</div><div class="small" id="summaryFreeBetProfit">FREE BET PROFIT // CALCULATING…</div></div><div class="box"><div class="sectiontitle">PREGAME SINGLE WAGERS</div>';
const newBox='<div class="box f3premium" style="margin-top:9px"><div class="f3premiumTitle">ALL-IN PERFORMANCE</div><div class="premiumgrid"><div class="premiummetric"><div class="key">OVERALL ROI</div><div class="bigprice" id="summaryOverallRoi">—</div><div class="premiumhint">CASH + PROMO LEDGER</div></div><div class="premiummetric"><div class="key">PROMO / NON-CASH PROFIT</div><div class="bigprice" id="summaryPromoProfit">—</div><div class="premiumhint">BONUS + FREE BET VALUE INCLUDED</div></div></div></div><div class="grid cols" style="margin-top:9px"><div class="box"><div class="sectiontitle">CASH ROI</div><div class="bigprice" id="summaryCashRoi">—</div></div><div class="box"><div class="sectiontitle">PREGAME SINGLE WAGERS</div>';
if(!html.includes(oldBox)) throw new Error('Current Overall ROI summary box marker not found');
html=html.replace(oldBox,newBox);

const recOld='clv:r[13],free:!!r[14],events:';
const recNew='clv:r[13],boosted:!!r[14],events:';
if(!html.includes(recOld)) throw new Error('Incorrect free flag mapping marker not found');
html=html.replace(recOld,recNew);

const runtimeOld="  const overall=statAgg(DATA);put('summaryCashRoi',pct(overall.roi));setTone('summaryCashRoi',overall.roi,'bigprice');\n  const freeProfit=DATA.filter(x=>x.free).reduce((t,x)=>t+(Number(x.pl)||0),0);put('summaryFreeBetProfit','FREE BET PROFIT // '+money(freeProfit));setTone('summaryFreeBetProfit',freeProfit,'small');\n";
const runtimeNew="  const overall=statAgg(DATA),promoProfit=overall.profit-Number(s.cashProfit||0);put('summaryOverallRoi',pct(overall.roi));put('summaryPromoProfit',money(promoProfit));\n";
if(!html.includes(runtimeOld)) throw new Error('Current Overall/free-profit runtime marker not found');
html=html.replace(runtimeOld,runtimeNew);

fs.writeFileSync(path,html);

const check=fs.readFileSync(path,'utf8');
for(const marker of ['>CASH ROI<','id="summaryOverallRoi"','id="summaryPromoProfit"','>ALL-IN PERFORMANCE<','PROMO / NON-CASH PROFIT','boosted:!!r[14]']){
  if(!check.includes(marker)) throw new Error('Missing marker: '+marker);
}
for(const bad of ['summaryFreeBetProfit','DATA.filter(x=>x.free)','clv:r[13],free:!!r[14]']){
  if(check.includes(bad)) throw new Error('Obsolete marker survived: '+bad);
}
for(const m of check.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)){
  if(m[1].trim()) new Function(m[1]);
}
console.log('F3 CASH + PREMIUM VALIDATION: PASS');
