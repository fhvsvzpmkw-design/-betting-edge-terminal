#!/usr/bin/env node
import fs from 'node:fs';

const path='index.html';
let html=fs.readFileSync(path,'utf8');

const labelOld='<div class="sectiontitle">CASH ROI</div><div class="bigprice" id="summaryCashRoi">—</div>';
const labelNew='<div class="sectiontitle">OVERALL ROI</div><div class="bigprice" id="summaryCashRoi">—</div>';
if(!html.includes(labelOld)) throw new Error('CASH ROI label marker not found');
html=html.replace(labelOld,labelNew);

const marker="  const rm=$('summaryResultMix');";
if(!html.includes(marker)) throw new Error('Result mix marker not found');
const insertion="  const overall=statAgg(DATA);put('summaryCashRoi',pct(overall.roi));setTone('summaryCashRoi',overall.roi,'bigprice');\n";
html=html.replace(marker,insertion+marker);

fs.writeFileSync(path,html);

const check=fs.readFileSync(path,'utf8');
if(!check.includes('<div class="sectiontitle">OVERALL ROI</div><div class="bigprice" id="summaryCashRoi">—</div>')) throw new Error('OVERALL ROI label missing');
if(!check.includes("const overall=statAgg(DATA);put('summaryCashRoi',pct(overall.roi));setTone('summaryCashRoi',overall.roi,'bigprice');")) throw new Error('Overall ROI runtime missing');
if(check.includes('<div class="sectiontitle">CASH ROI</div><div class="bigprice" id="summaryCashRoi">—</div>')) throw new Error('Old CASH ROI label survived');
for(const [i,m] of [...check.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].entries()){
  if(m[1].trim()) new Function(m[1]);
}
console.log('F3 OVERALL ROI VALIDATION: PASS');
