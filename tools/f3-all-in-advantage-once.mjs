import fs from 'node:fs';

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

const oldMarkup = '<div class="box"><div class="sectiontitle">RESULT MIX</div><div id="summaryResultMix">CALCULATING…</div></div>';
const newMarkup = '<div class="box premiumInsight"><div class="premiumInsightHead"><div class="sectiontitle">ALL-IN ADVANTAGE</div><span class="premiumInsightBadge">PREMIUM INSIGHT</span></div><div class="bigprice" id="summaryRoiUplift">—</div><div class="advantageMultiple" id="summaryRoiMultiple">—</div><div class="small">PROMO + BONUS ALERTS INCLUDED</div></div>';

if (!html.includes(oldMarkup)) throw new Error('Expected RESULT MIX markup not found');
html = html.replace(oldMarkup, newMarkup);

const oldCss = '#history .premiumInsight .small{color:#b7a06a}';
const newCss = '#history .premiumInsight .small{color:#b7a06a}\n#history .advantageMultiple{color:#f0c85b;font-size:16px;font-weight:900;margin-top:2px;margin-bottom:4px;letter-spacing:.03em}';
if (!html.includes(oldCss)) throw new Error('Expected premium insight CSS not found');
html = html.replace(oldCss, newCss);

const oldJs = "  const overall=statAgg(DATA),promoProfit=overall.profit-Number(s.cashProfit||0);put('summaryOverallRoi',pct(overall.roi));put('summaryPromoProfit',money(promoProfit));\n  const rm=$('summaryResultMix');if(rm)rm.innerHTML='W '+(mix.Won||0)+' // L '+(mix.Lost||0)+'<br>CASHED OUT '+(mix.CashedOut||0)+'<br>PUSH '+(mix.Push||0)+' // CANCELLED '+(mix.Cancelled||0);";
const newJs = "  const overall=statAgg(DATA),promoProfit=overall.profit-Number(s.cashProfit||0);put('summaryOverallRoi',pct(overall.roi));put('summaryPromoProfit',money(promoProfit));\n  const cashRiskExact=Number(s.cashRisked||0),cashProfitExact=Number(s.cashProfit||0),cashRoiExact=cashRiskExact?cashProfitExact/cashRiskExact*100:0;\n  const roiMultiple=cashRoiExact>0?overall.roi/cashRoiExact:0,roiUplift=cashRoiExact>0?(roiMultiple-1)*100:0;\n  put('summaryRoiUplift',cashRoiExact>0?pct(roiUplift,1):'—');put('summaryRoiMultiple',cashRoiExact>0?roiMultiple.toFixed(2)+'× ROI':'—');";
if (!html.includes(oldJs)) throw new Error('Expected summary result-mix JS not found');
html = html.replace(oldJs, newJs);

fs.writeFileSync(path, html);
console.log('F3 All-In Advantage added using exact cash-risk ROI baseline.');
