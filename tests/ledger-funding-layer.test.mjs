import fs from 'node:fs';
const ledger=JSON.parse(fs.readFileSync('data/ledger/public-ledger.json','utf8'));
const funding=JSON.parse(fs.readFileSync('data/ledger/funding-layer.json','utf8'));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const round2=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
assert(funding.schema===1,'funding schema must be 1');
assert(funding.publicProjection===true,'funding layer must be public-safe');
assert(funding.classification?.default==='CASH','default funding class must be CASH');
assert(Array.isArray(funding.promotionalWagers),'promotionalWagers missing');
assert(Number(funding.validation?.uniqueWagers)===ledger.wagers.length,'funding/ledger wager count drift');
assert(Number(funding.validation?.promotionalWagers)===funding.promotionalWagers.length,'promotional count drift');
const seen=new Set();
const overrides=new Map();
for(const r of funding.promotionalWagers){
  assert(Array.isArray(r)&&r.length===4,'invalid funding override row');
  const [id,kind,nominal,actual]=r;
  assert(Number.isInteger(id)&&id>=1&&id<=ledger.wagers.length,'invalid public wager id');
  assert(!seen.has(id),'duplicate public wager id in funding layer'); seen.add(id);
  assert(ledger.wagers[id-1]?.[0]===id,'funding row is not aligned with public ledger');
  assert(kind==='FREE_BET'||kind==='MIXED_PROMO','invalid promotional funding class');
  assert(Math.abs(Number(ledger.wagers[id-1][9])-Number(nominal))<0.00001,'nominal risk mismatch');
  assert(Number(actual)>=0&&Number(actual)<=Number(nominal),'actual capital risk out of range');
  if(kind==='FREE_BET') assert(Number(actual)===0,'FREE_BET actual risk must be zero');
  if(kind==='MIXED_PROMO') assert(Number(actual)>0,'MIXED_PROMO actual risk must be positive');
  overrides.set(id,{kind,actual:Number(actual)});
}
let nominal=0,actual=0,profit=0,cashRisk=0,cashProfit=0,promoProfit=0,free=0,mixed=0;
for(const r of ledger.wagers){
  const id=r[0],risk=Number(r[9]||0),pnl=Number(r[11]||0),o=overrides.get(id);
  nominal+=risk; profit+=pnl;
  if(o){ actual+=o.actual; promoProfit+=pnl; if(o.kind==='FREE_BET')free++; else mixed++; }
  else { actual+=risk; cashRisk+=risk; cashProfit+=pnl; }
}
const s=funding.summary;
assert(s.allIn.wagers===ledger.wagers.length,'all-in wager count mismatch');
assert(round2(nominal)===s.allIn.nominalRiskCad,'all-in nominal risk mismatch');
assert(round2(actual)===s.allIn.actualCapitalRiskCad,'all-in actual-capital risk mismatch');
assert(round2(profit)===s.allIn.profitCad,'all-in profit mismatch');
assert(round2(profit/actual*100)===s.allIn.actualCapitalRoiPercent,'all-in ROI mismatch');
assert(round2(cashRisk)===s.cash.riskCad&&round2(cashProfit)===s.cash.profitCad,'cash summary mismatch');
assert(s.cash.wagers===ledger.wagers.length-overrides.size,'cash wager count mismatch');
assert(round2(promoProfit)===s.promotional.profitCad,'promo profit mismatch');
assert(s.promotional.wagers===overrides.size&&s.promotional.freeBetWagers===free&&s.promotional.mixedPromoWagers===mixed,'promo classification counts mismatch');
console.log(`LEDGER FUNDING LAYER PASS: ${ledger.wagers.length} wagers, ${overrides.size} promotional, all-in ROI ${s.allIn.actualCapitalRoiPercent}%`);
