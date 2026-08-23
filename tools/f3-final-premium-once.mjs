#!/usr/bin/env node
import fs from 'node:fs';

const path='index.html';
let html=fs.readFileSync(path,'utf8');

const cssOld=`#history .f3premium{border:1px solid #b99036;background:linear-gradient(180deg,#151108 0%,#0b0d13 100%);box-shadow:inset 0 0 0 1px #4d3b14}\n#history .f3premiumTitle{color:#e0b94f;font-weight:900;letter-spacing:.06em}\n#history .premiumgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}\n#history .premiummetric{border:1px solid #6d5421;background:#0c0d0c;padding:10px}\n#history .premiummetric .key{color:#ba9b55}\n#history .premiummetric .bigprice{color:#f0c85b}\n#history .premiumhint{color:#9f8959;font-size:10px;margin-top:4px;letter-spacing:.03em}\n@media(max-width:560px){#history .premiumgrid{grid-template-columns:1fr}}`;
const cssNew=`#history .cashProfitLine{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}\n#history .cashRoiInline{color:var(--f3soft);font-size:11px;white-space:nowrap}\n#history .cashRoiInline b{color:var(--green);font-size:14px}\n#history .f3premium{position:relative;border:2px solid #d3ad43;background:radial-gradient(circle at 50% 0%,#2a210b 0%,#171207 34%,#090b10 100%);box-shadow:0 0 20px #d3ad4324,inset 0 0 0 1px #6f5720;padding:13px}\n#history .f3premiumHead,#history .premiumInsightHead{display:flex;align-items:center;justify-content:space-between;gap:10px}\n#history .f3premiumTitle{color:#f0c85b;font-weight:900;letter-spacing:.08em;font-size:13px}\n#history .f3premiumBadge,#history .premiumInsightBadge{border:1px solid #d3ad43;color:#f0c85b;background:#211a07;padding:3px 7px;font-size:9px;font-weight:900;letter-spacing:.08em}\n#history .premiumgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}\n#history .premiummetric{border:1px solid #806426;background:linear-gradient(180deg,#151006,#0b0d11);padding:12px}\n#history .premiummetric .key{color:#c4a65c}\n#history .premiummetric .bigprice{color:#ffd96b;font-size:29px;text-shadow:0 0 12px #d3ad4340}\n#history .premiumhint{color:#a99055;font-size:10px;margin-top:5px;letter-spacing:.04em}\n#history .premiumSummaryRow{grid-template-columns:1fr 1fr}\n#history .premiumInsight{border:2px solid #b99036;background:linear-gradient(180deg,#171208 0%,#0a0d12 100%);box-shadow:0 0 16px #b9903620,inset 0 0 0 1px #4d3b14}\n#history .premiumInsight .sectiontitle{color:#e7bd53}\n#history .premiumInsight .bigprice{color:#ffd96b;font-size:28px;text-shadow:0 0 10px #d3ad4338}\n#history .premiumInsight .small{color:#b7a06a}\n@media(max-width:560px){#history .premiumgrid,#history .premiumSummaryRow{grid-template-columns:1fr}}`;
if(!html.includes(cssOld)) throw new Error('premium CSS marker not found');
html=html.replace(cssOld,cssNew);

const topOld='<div class="stat"><div class="key">CASH PROFIT</div><b id="summaryCashProfit">—</b></div></div>';
const topNew='<div class="stat"><div class="key">CASH PROFIT</div><div class="cashProfitLine"><b id="summaryCashProfit">—</b><span class="cashRoiInline">// ROI <b id="summaryCashRoi">—</b></span></div></div></div>';
if(!html.includes(topOld)) throw new Error('cash profit tile marker not found');
html=html.replace(topOld,topNew);

const premiumHeadOld='<div class="box f3premium" style="margin-top:9px"><div class="f3premiumTitle">ALL-IN PERFORMANCE</div><div class="premiumgrid">';
const premiumHeadNew='<div class="box f3premium" style="margin-top:9px"><div class="f3premiumHead"><div class="f3premiumTitle">ALL-IN PERFORMANCE</div><span class="f3premiumBadge">PREMIUM</span></div><div class="premiumgrid">';
if(!html.includes(premiumHeadOld)) throw new Error('all-in panel marker not found');
html=html.replace(premiumHeadOld,premiumHeadNew);

const lowerOld='<div class="grid cols" style="margin-top:9px"><div class="box"><div class="sectiontitle">CASH ROI</div><div class="bigprice" id="summaryCashRoi">—</div></div><div class="box"><div class="sectiontitle">PREGAME SINGLE WAGERS</div><div class="bigprice" id="summaryPregameRoi">—</div><div class="small" id="summaryPregameMeta">CALCULATING…</div></div><div class="box"><div class="sectiontitle">RESULT MIX</div><div id="summaryResultMix">CALCULATING…</div></div></div>';
const lowerNew='<div class="grid premiumSummaryRow" style="margin-top:9px"><div class="box premiumInsight"><div class="premiumInsightHead"><div class="sectiontitle">PREGAME SINGLE WAGERS</div><span class="premiumInsightBadge">PREMIUM INSIGHT</span></div><div class="bigprice" id="summaryPregameRoi">—</div><div class="small" id="summaryPregameMeta">CALCULATING…</div></div><div class="box"><div class="sectiontitle">RESULT MIX</div><div id="summaryResultMix">CALCULATING…</div></div></div>';
if(!html.includes(lowerOld)) throw new Error('lower summary row marker not found');
html=html.replace(lowerOld,lowerNew);

const toneOld="setTone('summaryCashRoi',Number(s.cashRoiPercent||0),'bigprice');";
const toneNew="setTone('summaryCashRoi',Number(s.cashRoiPercent||0));";
if(!html.includes(toneOld)) throw new Error('cash ROI tone marker not found');
html=html.replace(toneOld,toneNew);

fs.writeFileSync(path,html);

const check=fs.readFileSync(path,'utf8');
for(const marker of [
  'cashRoiInline',
  'f3premiumBadge',
  'PREMIUM INSIGHT',
  'premiumSummaryRow',
  '<b id="summaryCashProfit">—</b><span class="cashRoiInline">// ROI <b id="summaryCashRoi">—</b></span>',
  "setTone('summaryCashRoi',Number(s.cashRoiPercent||0));"
]) if(!check.includes(marker)) throw new Error('missing marker: '+marker);
if(check.includes('<div class="sectiontitle">CASH ROI</div><div class="bigprice" id="summaryCashRoi">—</div>')) throw new Error('standalone cash ROI survived');
for(const m of check.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)) if(m[1].trim()) new Function(m[1]);
console.log('F3 FINAL PREMIUM PASS: PASS');
