// Describes outside opinions at the offered contract. No fair or status writer.
const list=x=>Array.isArray(x)?x:[];
const time=x=>Date.parse(x||'');
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const sameTime=(a,b)=>Number.isFinite(time(a))&&time(a)===time(b);
const https=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
const unique=xs=>[...new Set(xs.filter(Boolean))];
const market=x=>/moneyline/.test(x)?'moneyline':/spread|run_line|puck_line/.test(x)?'spread':/total/.test(x)?'total':null;
const americanDecimal=x=>finite(x)&&Math.abs(x)>=100?(x>0?1+x/100:1+100/-x):null;
export function validCuratedRecord(row,event,asOf){
  if(!row||row.schema!==1||!row.recordId||!row.originId||!row.originName||!row.sourceId||!row.sourceRecordId||!row.eventId||!row.home||!row.away||
    !['MODEL_PROJECTION','EXPERT_PICK'].includes(row.kind)||!['PUBLIC_PUBLISHER_CSV','PUBLIC_FEATURED_PICK','PERMITTED_STRUCTURED_IMPORT'].includes(row.access)||
    row.state!=='PRE_GAME'||row.period!=='FULL_GAME'||!https(row.url)||!row.excerpt||!row.limitation||
    !Number.isFinite(time(asOf))||!Number.isFinite(time(row.startTime))||!Number.isFinite(time(row.observedAt))||time(row.observedAt)>time(asOf)||time(row.observedAt)>=time(row.startTime)||
    (row.publishedAt!=null&&(!Number.isFinite(time(row.publishedAt))||time(row.publishedAt)>time(row.observedAt))))return false;
  if(event&&(String(row.eventId)!==String(event.eventId)||row.sport!==event.sport||!sameTime(row.startTime,event.startTime)||row.home!==event.home||row.away!==event.away))return false;
  if(row.kind==='MODEL_PROJECTION')return market(row.marketDetail)==='spread'&&finite(row.projection?.homeSpread);
  return !!market(row.marketDetail)&&(market(row.marketDetail)==='total'?['over','under']:['home','away']).includes(row.side)&&
    (market(row.marketDetail)==='moneyline'?row.line===null:finite(row.line))&&
    (row.priceAmerican==null||americanDecimal(row.priceAmerican)!==null);
}
export function currentCuratedRecords(records,event,asOf){
  const latest=new Map();
  for(const row of list(records).filter(row=>validCuratedRecord(row,event,asOf))){
    const key=[row.sourceId,row.originId,row.kind,row.marketDetail,row.sourceField||row.sourceRecordId].join('|');
    if(!latest.has(key)||time(row.observedAt)>time(latest.get(key).observedAt))latest.set(key,row);
  }
  return [...latest.values()].map(row=>({...row,freshness:time(asOf)>=time(row.startTime)?'EVENT_STARTED':
    time(asOf)-time(row.observedAt)>75*60000?'REFRESH_DUE':'RECENT_CAPTURE'}));
}
function modelView(row,event,marketDetail,side,quote){
  if(row.period!=='FULL_GAME'||row.sport!==event.sport||String(row.eventId)!==String(event.eventId)||!sameTime(row.startTime,event.startTime))return null;
  const kind=market(marketDetail),originId=row.originId||row.modelFamily;if(!originId)return null;
  const entry={recordId:row.recordId,originId,originName:row.originName||row.sourceId,sourceId:row.sourceId,url:row.url,
    kind:row.kind,observedAt:row.observedAt,publishedAt:row.publishedAt||row.forecastAt||null,
    publisherTimeLabel:row.publisherTimeLabel||null,sourceLine:row.line??null,sourcePriceAmerican:row.priceAmerican??null,
    direction:'CONTEXT',basis:null,value:row.kind==='EXPERT_PICK'?row.excerpt:undefined,requiresCurrentApplicabilityReview:true,limitation:row.limitation};
  if(row.freshness!=='RECENT_CAPTURE'){entry.reason=row.freshness||'SOURCE_REFRESH_REQUIRED';return entry;}
  if(row.kind==='EXPERT_PICK'){
    if(kind!==market(row.marketDetail))return null;
    entry.basis='PUBLISHED_EXPERT_PICK';
    const sourceContractLine=kind==='spread'&&row.side!==side?-quote.line:quote.line;
    const sameLine=kind==='moneyline'||row.line===sourceContractLine;
    if(!sameLine){entry.reason='SOURCE_PICK_AT_DIFFERENT_LINE';return entry;}
    if(row.side!==side){entry.direction='OPPOSES';entry.value=row.excerpt;entry.reason='OPPOSING_PUBLISHED_PICK';return entry;}
    const original=americanDecimal(row.priceAmerican);
    if(original===null){entry.reason='ORIGINAL_PRICE_NOT_PUBLISHED';return entry;}
    if(quote.priceDecimal+1e-8<original){entry.reason='CURRENT_PRICE_WORSE_THAN_SOURCE_PICK';return entry;}
    entry.direction=row.side===side?'SUPPORTS':'OPPOSES';entry.value=row.excerpt;return entry;
  }
  const spread=row.projection?.homeSpread,total=row.projection?.total;
  if(kind==='spread'&&finite(spread)&&finite(quote.line)){
    const gap=(side==='home'?-spread:spread)+quote.line;
    entry.basis='PUBLISHED_SPREAD_POINT';entry.value=spread;entry.gapPoints=gap;
    entry.direction=Math.abs(gap)<1e-8?'NEUTRAL':gap>0?'SUPPORTS':'OPPOSES';return entry;
  }
  if(kind==='total'&&finite(total)&&finite(quote.line)){
    const gap=side==='over'?total-quote.line:quote.line-total;
    entry.basis='PUBLISHED_TOTAL_POINT';entry.value=total;entry.gapPoints=gap;
    entry.direction=Math.abs(gap)<1e-8?'NEUTRAL':gap>0?'SUPPORTS':'OPPOSES';return entry;
  }
  if(row.kind!=='OUTCOME_PROBABILITY'||row.marketDetail!==marketDetail||row.side!==side||
    (kind!=='moneyline'&&row.line!==quote.line)||!finite(row.probability)||row.probability<0||row.probability>1)return null;
  const p=row.probability,basis=row.probabilityBasis,push=row.pushProbability;
  const noPush=row.settlement?.pushRule==='NO_PUSH'&&(push==null||push===0);
  const conditional=basis==='CONDITIONAL_ON_NO_PUSH';
  const knownPush=basis==='UNCONDITIONAL'&&finite(push)&&push>=0&&push<1&&p+push<=1+1e-8;
  if(!conditional&&!(basis==='UNCONDITIONAL'&&noPush)&&!knownPush){entry.reason='PROBABILITY_SETTLEMENT_UNRESOLVED';return entry;}
  const required=(knownPush&&!noPush?1-push:1)/quote.priceDecimal,gap=p-required;
  entry.basis=conditional?'PUBLISHED_CONDITIONAL_PROBABILITY':'PUBLISHED_PROBABILITY';entry.value=p;entry.gapProbabilityPoints=gap*100;
  entry.direction=Math.abs(gap)<1e-8?'NEUTRAL':gap>0?'SUPPORTS':'OPPOSES';return entry;
}
export function aggregateCuratedOpinions({event,records=[],models=[],markets=[],asOf}){
  const curated=currentCuratedRecords(records,event,asOf),modelRows=list(models).filter(row=>https(row.url)&&row.recordId&&
    Number.isFinite(time(row.observedAt))&&time(row.observedAt)<=time(asOf)&&time(row.observedAt)<time(row.startTime));
  const groups=[];
  for(const m of list(markets))for(const quote of list(m.quotes)){
    const entries=[...curated,...modelRows].map(row=>modelView(row,event,m.marketDetail,m.side,quote)).filter(Boolean);
    if(!entries.length)continue;
    const priceTime=time(quote.observedAt||quote.changedAt),priceCurrent=finite(quote.priceDecimal)&&quote.priceDecimal>1&&
      Number.isFinite(priceTime)&&time(asOf)>=priceTime&&time(asOf)-priceTime<=75*60000&&time(asOf)<time(event.startTime);
    if(!priceCurrent)for(const entry of entries){entry.direction='CONTEXT';entry.reason='CURRENT_PRICE_REFRESH_REQUIRED';}
    const families=new Map();
    for(const entry of entries){if(!families.has(entry.originId))families.set(entry.originId,[]);families.get(entry.originId).push(entry);}
    const origins=[...families].map(([originId,rows])=>{
      const directions=unique(rows.map(r=>r.direction).filter(d=>['SUPPORTS','OPPOSES'].includes(d)));
      return {originId,name:rows[0].originName,sourceIds:unique(rows.map(r=>r.sourceId)),recordIds:unique(rows.map(r=>r.recordId)),
        direction:directions.length>1?'MIXED':directions[0]||'CONTEXT',entries:rows};
    });
    groups.push({selectionId:m.selectionId,marketDetail:m.marketDetail,side:m.side,line:quote.line??null,book:quote.book,
      priceDecimal:quote.priceDecimal,priceObservedAt:quote.observedAt||quote.changedAt||null,priceCurrent,
      supporting:origins.filter(o=>o.direction==='SUPPORTS').length,opposing:origins.filter(o=>o.direction==='OPPOSES').length,
      mixed:origins.filter(o=>o.direction==='MIXED').length,context:origins.filter(o=>o.direction==='CONTEXT').length,origins});
  }
  return {schema:1,kind:'CURATED_OUTSIDE_OPINIONS',decisionAuthority:false,records:curated,
    sourceIds:unique([...curated,...modelRows].map(r=>r.sourceId)),originCount:unique([...curated,...modelRows].map(r=>r.originId||r.modelFamily)).length,groups,
    instruction:'Start with these captured outside views. Retain supporting and contrary origins; compare the exact offered line and price. Review current personnel and applicability once per event, then author the existing BET/LEAN/WAIT/PASS decision. A published pick is useful directional evidence without an invented probability.',
    limitation:'Counts describe distinct named origins, not statistically independent models or a calibrated fair. Point projections, probabilities and expert picks retain their native types. No majority assigns a grade or stake.'};
}

// First actually saved pregame opinion per origin/event/market, never a later
// winning version. Reuses the existing final-score store and grading run.
export function gradeCuratedSources(captures,results,asOf){
  const first=new Map();
  const records=list(captures).filter(c=>Number.isFinite(time(c.collectedAt))&&time(c.collectedAt)<=time(asOf))
    .flatMap(c=>list(c.curatedPicks).filter(r=>time(r.observedAt)<=time(c.collectedAt)&&time(c.collectedAt)<time(r.startTime)))
    .filter(r=>validCuratedRecord(r,null,asOf)).sort((a,b)=>time(a.observedAt)-time(b.observedAt)||a.recordId.localeCompare(b.recordId));
  for(const row of records){const k=[row.originId,row.sport,row.eventId,row.startTime,row.marketDetail,row.kind].join('|');if(!first.has(k))first.set(k,row);}
  const resultMap=new Map(list(results).filter(r=>time(r.verifiedAt)<=time(asOf)).map(r=>[r.eventId+'|'+r.startTime,r]));
  const groups=new Map();let graded=0,pending=0;
  for(const row of first.values()){
    const k=[row.originId,row.sport,row.marketDetail,row.kind].join('|');
    if(!groups.has(k))groups.set(k,{originId:row.originId,name:row.originName,sport:row.sport,marketDetail:row.marketDetail,kind:row.kind,
      observations:0,graded:0,pending:0,unresolved:0,wins:0,losses:0,pushes:0,priced:0,netUnits:0,absolutePointError:0,sourceUrl:row.url});
    const g=groups.get(k);g.observations++;
    const result=resultMap.get(row.eventId+'|'+row.startTime);
    if(!result||result.state!=='FINAL'){g.pending++;pending++;continue;}
    if(result.special||!finite(result.homeScore)||!finite(result.awayScore)){g.unresolved++;continue;}
    if(row.kind==='MODEL_PROJECTION'){
      g.absolutePointError+=Math.abs(-row.projection.homeSpread-(result.homeScore-result.awayScore));g.graded++;graded++;continue;
    }
    const kind=market(row.marketDetail),margin=kind==='moneyline'?(row.side==='home'?result.homeScore-result.awayScore:result.awayScore-result.homeScore):
      kind==='spread'?(row.side==='home'?result.homeScore-result.awayScore:result.awayScore-result.homeScore)+row.line:
      row.side==='over'?result.homeScore+result.awayScore-row.line:row.line-result.homeScore-result.awayScore;
    if(kind==='moneyline'&&margin===0){g.unresolved++;continue;}
    g.graded++;graded++;if(margin>0)g.wins++;else if(margin<0)g.losses++;else g.pushes++;
    const price=americanDecimal(row.priceAmerican);if(price!==null){g.priced++;g.netUnits+=margin>0?price-1:margin<0?-1:0;}
  }
  return {schema:1,decisionAuthority:false,counts:{observations:first.size,graded,pending},byOrigin:[...groups.values()].map(g=>({...g,
    meanAbsolutePointError:g.kind==='MODEL_PROJECTION'&&g.graded?g.absolutePointError/g.graded:null,
    hypotheticalRoi:g.kind==='EXPERT_PICK'&&g.priced?g.netUnits/g.priced:null})),
    population:'First saved pregame opinion per named origin, exact event/start and market. Repeated captures and later revisions do not add samples. Projection error and expert pick returns are separate populations.',
    limitation:'Prospective source feedback, not the wagering ledger. Expert returns use published source odds with hypothetical one-unit risk; missing odds are excluded from ROI. Models without an executable quoted entry receive point error only. No inferred historical record or automatic source weights.'};
}
