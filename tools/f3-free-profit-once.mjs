#!/usr/bin/env node
import fs from 'node:fs';

const path='index.html';
let html=fs.readFileSync(path,'utf8');

const boxOld='<div class="box"><div class="sectiontitle">OVERALL ROI</div><div class="bigprice" id="summaryCashRoi">—</div></div>';
const boxNew='<div class="box"><div class="sectiontitle">OVERALL ROI</div><div class="bigprice" id="summaryCashRoi">—</div><div class="small" id="summaryFreeBetProfit">FREE BET PROFIT // CALCULATING…</div></div>';
if(!html.includes(boxOld)) throw new Error('OVERALL ROI box marker not found');
html=html.replace(boxOld,boxNew);

const recOld='clv:r[13],boosted:!!r[14],events:';
const recNew='clv:r[13],free:!!r[14],events:';
if(!html.includes(recOld)) throw new Error('free-bet row flag marker not found');
html=html.replace(recOld,recNew);

const overall="  const overall=statAgg(DATA);put('summaryCashRoi',pct(overall.roi));setTone('summaryCashRoi',overall.roi,'bigprice');\n";
if(!html.includes(overall)) throw new Error('overall ROI runtime marker not found');
const free="  const freeProfit=DATA.filter(x=>x.free).reduce((t,x)=>t+(Number(x.pl)||0),0);put('summaryFreeBetProfit','FREE BET PROFIT // '+money(freeProfit));setTone('summaryFreeBetProfit',freeProfit,'small');\n";
html=html.replace(overall,overall+free);

fs.writeFileSync(path,html);

const check=fs.readFileSync(path,'utf8');
if(!check.includes('id="summaryFreeBetProfit"')) throw new Error('free bet profit line missing');
if(!check.includes('free:!!r[14]')) throw new Error('free bet flag mapping missing');
if(!check.includes("DATA.filter(x=>x.free)")) throw new Error('free bet profit calculation missing');
if(check.includes('boosted:!!r[14]')) throw new Error('old row flag name survived');
for(const [i,m] of [...check.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].entries()){
  if(m[1].trim()) new Function(m[1]);
}
console.log('F3 FREE BET PROFIT VALIDATION: PASS');
