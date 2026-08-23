import fs from 'node:fs';

const path='index.html';
let html=fs.readFileSync(path,'utf8');

const oldMarkup=`<div class="box f3premium" style="margin-top:9px"><div class="f3premiumHead"><div class="f3premiumTitle">ALL-IN PERFORMANCE</div><span class="f3premiumBadge">PREMIUM</span></div><div class="premiumgrid"><div class="premiummetric"><div class="key">OVERALL ROI</div><div class="bigprice" id="summaryOverallRoi">—</div><div class="premiumhint">CASH + PROMO LEDGER</div></div><div class="premiummetric"><div class="key">PROMO / NON-CASH PROFIT</div><div class="bigprice" id="summaryPromoProfit">—</div><div class="premiumhint">BONUS + FREE BET VALUE INCLUDED</div></div></div></div><div class="grid premiumSummaryRow" style="margin-top:9px"><div class="box premiumInsight"><div class="premiumInsightHead"><div class="sectiontitle">PREGAME SINGLE WAGERS</div><span class="premiumInsightBadge">PREMIUM INSIGHT</span></div><div class="bigprice" id="summaryPregameRoi">—</div><div class="small" id="summaryPregameMeta">CALCULATING…</div></div><div class="box premiumInsight"><div class="premiumInsightHead"><div class="sectiontitle">ALL-IN ADVANTAGE</div><span class="premiumInsightBadge">PREMIUM INSIGHT</span></div><div class="bigprice" id="summaryRoiUplift">—</div><div class="advantageMultiple" id="summaryRoiMultiple">—</div><div class="small">PROMO + BONUS ALERTS INCLUDED</div></div></div>`;

const newMarkup=`<div class="box f3premium allInPerformance" style="margin-top:9px"><div class="f3premiumHead"><div><div class="f3premiumTitle">ALL-IN PERFORMANCE</div><div class="premiumDeck">SUBSCRIBER PERFORMANCE LAYER // CASH + PROMO INTELLIGENCE</div></div><span class="f3premiumBadge">PREMIUM</span></div><div class="premiumFourGrid"><div class="premiummetric"><div class="key">OVERALL ROI</div><div class="bigprice" id="summaryOverallRoi">—</div><div class="premiumhint">CASH + PROMO LEDGER</div></div><div class="premiummetric"><div class="key">PROMO / NON-CASH PROFIT</div><div class="bigprice" id="summaryPromoProfit">—</div><div class="premiumhint">BONUS + FREE BET VALUE INCLUDED</div></div><div class="premiummetric"><div class="key">PREGAME SINGLE WAGERS</div><div class="bigprice" id="summaryPregameRoi">—</div><div class="premiumhint" id="summaryPregameMeta">CALCULATING…</div></div><div class="premiummetric"><div class="key">ALL-IN ADVANTAGE</div><div class="bigprice" id="summaryRoiUplift">—</div><div class="advantageMultiple" id="summaryRoiMultiple">—</div><div class="premiumhint">PROMO + BONUS ALERTS INCLUDED</div></div></div></div>`;

if(!html.includes(oldMarkup)) throw new Error('Expected current F3 four-metric markup not found');
html=html.replace(oldMarkup,newMarkup);

const cssAnchor='#history .advantageMultiple{color:#f0c85b;font-size:16px;font-weight:900;margin-top:2px;margin-bottom:4px;letter-spacing:.03em}';
const cssExtra=`\n#history .allInPerformance{border-color:#d3ad43;box-shadow:0 0 24px #d3ad432b,inset 0 0 0 1px #6f5720}\n#history .premiumDeck{margin-top:3px;color:#a99055;font-size:9px;letter-spacing:.06em}\n#history .premiumFourGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}\n#history .premiumFourGrid .premiummetric{position:relative;overflow:hidden;border:1px solid #8b6b28;background:linear-gradient(180deg,#171207 0%,#0b0d11 100%);box-shadow:inset 0 0 0 1px #3e3011,0 0 12px #d3ad4312}\n#history .premiumFourGrid .premiummetric:before{content:\"\";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,#f0c85b 0%,#a57f2f 62%,transparent 100%)}\n#history .premiumFourGrid .premiummetric .key{color:#d0ad59}\n#history .premiumFourGrid .premiummetric .bigprice{color:#ffd96b;text-shadow:0 0 12px #d3ad4340}\n#history .premiumFourGrid .premiumhint{color:#a99055}\n@media(max-width:560px){#history .premiumFourGrid{grid-template-columns:1fr}}`;
if(!html.includes(cssAnchor)) throw new Error('F3 premium CSS anchor not found');
html=html.replace(cssAnchor,cssAnchor+cssExtra);

for(const marker of ['premiumFourGrid','summaryOverallRoi','summaryPromoProfit','summaryPregameRoi','summaryRoiUplift','summaryRoiMultiple']){
  if(!html.includes(marker)) throw new Error(`Missing F3 premium marker: ${marker}`);
}
if(html.includes('class="grid premiumSummaryRow"')) throw new Error('Old split premium row still present');

fs.writeFileSync(path,html);
console.log('F3 All-In Performance unified into four gold-accent premium metrics.');
