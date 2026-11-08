(function(root){
  'use strict';
  // Read-only presentation of the issued assessment. Never creates a call,
  // target, fair value, or a new source from narrative text.
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const validProbability=value=>Number.isFinite(value)&&value>0&&value<1;
  const same=(a,b)=>a===b||(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-9);
  const pp=value=>`${value>=0?'+':'−'}${Math.abs(value).toFixed(2)} pp`;
  function exactForecastComparison(rec,forecast){
    const feed=rec?.feed||{},price=feed.priceDecimal,parts=String(feed.selectionKey||'').split('|'),c=forecast?.comparison,p=forecast?.probability;
    const sideValid=feed.marketKey==='totals'?['over','under'].includes(feed.side):['ml','spread'].includes(feed.marketKey)&&['home','away'].includes(feed.side);
    const exactLine=feed.marketKey==='ml'?parts[4]===''&&feed.line==null:Number.isFinite(feed.line)&&Number(parts[4])===feed.line;
    const line=feed.marketKey==='spread'&&feed.side==='away'?-feed.line:feed.line??null;
    const regular=same(c?.breakEvenProbability,1/price);
    const refunded=forecast?.probabilityBasis==='UNCONDITIONAL'&&c?.probabilityBasis==='UNCONDITIONAL'&&
      Number.isFinite(c.breakEvenProbability)&&c.breakEvenProbability>0&&c.breakEvenProbability<1/price&&
      p+1-c.breakEvenProbability*price<=1+1e-8&&Number.isFinite(c.evPerUnit)&&same(c.evPerUnit,(p-c.breakEvenProbability)*price);
    if(!sideValid||parts.length!==5||parts[0]!==String(feed.eventId)||parts[1]!==feed.marketKey||parts[2]!==feed.side||parts[3]!==''||
      !exactLine||!Number.isFinite(price)||price<=1||!(rec?.forecastReview?.eligibleExactRecordIds||[]).includes(forecast?.recordId)||
      forecast?.eligibility!=='ELIGIBLE_EXACT'||forecast.side!==feed.side||forecast.marketDetail!==rec?.coreAssessment?.context?.marketDetail||
      forecast.period!=='FULL_GAME'||!same(forecast.line,line)||!same(c?.priceDecimal,price)||!validProbability(p)||
      !(regular||refunded)||!same(c.edgeProbabilityPoints,(p-c.breakEvenProbability)*100))return null;
    return {probability:p,breakEven:c.breakEvenProbability,gap:c.edgeProbabilityPoints,refundedPushes:!regular&&refunded};
  }
  function firstSentence(value){
    const text=clean(value);
    for(const match of text.matchAll(/[.!?](?:\s+|$)/g)){
      const before=text.slice(0,match.index);
      if(match[0][0]==='.'&&/\b(?:St|Dr|Mr|Mrs|Ms|vs|No)$/i.test(before))continue;
      return text.slice(0,match.index+1);
    }
    return text;
  }
  function describe(rec){
    const feed=rec?.feed||{},market=rec?.marketAssessment,comparisons=[];
    const price=feed.priceDecimal,parts=String(feed.selectionKey||'').split('|');
    const sideValid=feed.marketKey==='totals'?['over','under'].includes(feed.side):['ml','spread'].includes(feed.marketKey)&&['home','away'].includes(feed.side);
    const bound=sideValid&&parts.length===5&&parts[0]===String(feed.eventId)&&parts[1]===feed.marketKey&&parts[2]===feed.side&&parts[3]==='';
    const exactLine=feed.marketKey==='ml'?parts[4]===''&&(feed.line===null||feed.line===undefined):Number.isFinite(feed.line)&&Number(parts[4])===feed.line;
    const quote=bound&&exactLine&&Number.isFinite(price)&&price>1;
    let marketGap=null;
    if(quote&&market?.schema===1&&market.basis==='QUALIFIED_PINNACLE'&&market.selectionKey===feed.selectionKey&&validProbability(market.referenceProbability)){
      marketGap=(market.referenceProbability-1/price)*100;
      comparisons.push({label:'Pinnacle gap',value:pp(marketGap),basis:'No-vig market reference; not an independent fair value.'});
    }
    const eligible=new Set(rec?.forecastReview?.eligibleExactRecordIds||[]),bySource=new Map();
    for(const forecast of rec?.forecastReview?.records||[]){
      if(!quote||!eligible.has(forecast?.recordId)||!exactForecastComparison(rec,forecast))continue;
      // A source update is one opinion, not an extra supporting vote.
      const key=forecast.sourceId||forecast.publisher;
      const previous=bySource.get(key);
      const stamp=item=>{const time=Date.parse(item.revalidatedAt||item.observedAt||'');return Number.isFinite(time)?time:-Infinity};
      if(!previous||stamp(forecast)>stamp(previous))bySource.set(key,forecast);
    }
    for(const forecast of bySource.values())comparisons.push({label:`${clean(forecast.publisher||forecast.sourceId)} gap`,value:pp(forecast.comparison.edgeProbabilityPoints),basis:exactForecastComparison(rec,forecast).refundedPushes?'Published forecast versus break-even with refunded pushes; not an independent calibrated fair value.':'Published forecast versus break-even; not an independent calibrated fair value.'});
    const checks=[...new Set((rec?.personnelEvidence?.unresolved||[]).map(clean).filter(Boolean))];
    let reason=firstSentence(rec?.marketAssessment?.decisionRationale||rec?.coreAssessment?.rationale||rec?.analysis||rec?.edge||rec?.support||'Open details for the recorded reasoning.');
    const marketPass=String(rec.status).toUpperCase()==='PASS'&&!rec.forecastLean&&market?.basis==='QUALIFIED_PINNACLE'&&/versus the qualified paired Pinnacle reference/.test(market.decisionRationale||'');
    if(marketGap!==null&&marketPass){
      if(marketGap<-.005)reason='Price is worse than Pinnacle’s no-vig reference.';
      else if(marketGap<=.005)reason='Price matches Pinnacle’s no-vig reference.';
      else if(String(rec.status).toUpperCase()==='PASS'&&checks.length)reason='Favorable Pinnacle comparison; material checks remain unresolved.';
    }
    // Keep arbitrary historical decisions intact when no structured summary is
    // available. The complete original wording remains in the evidence drawer.
    if(reason.length>220)reason=reason.slice(0,217).replace(/\s+\S*$/,'')+'…';
    return {reason,comparisons,checks,marketGap};
  }
  const api={describe,firstSentence,exactForecastComparison};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BettingEdgeCardSummary=api;
})(typeof globalThis!=='undefined'?globalThis:this);
