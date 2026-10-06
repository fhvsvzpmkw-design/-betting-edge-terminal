// Descriptive aggregation of reviewed, exact-price evidence. Never issues a grade.
const list = value => Array.isArray(value) ? value : [];
const finite = value => typeof value === 'number' && Number.isFinite(value);
const unique = values => [...new Set(values.filter(Boolean))].sort();
const median = values => {const sorted=[...values].sort((a,b)=>a-b),i=Math.floor(sorted.length/2);return sorted.length ? sorted.length%2 ? sorted[i] : (sorted[i-1]+sorted[i])/2 : null;};

export function aggregateForecastComparisons(comparisons = []) {
  const records = [...new Map(list(comparisons).filter(row => row.recordId && finite(row.probability) && finite(row.edgeProbabilityPoints))
    .map(row => [row.recordId, row])).values()];
  const contracts = new Map();
  for (const row of records) {
    // NFL tie/refund and conditional probabilities cannot share a numeric median.
    const key=JSON.stringify([row.eventId,row.sport,Date.parse(row.startTime||''),row.period,row.marketDetail,row.side,row.line??null,row.priceDecimal,
      row.probabilityBasis, row.pushProbability ?? null,
      row.settlement?.includesOvertime ?? null, row.settlement?.pushRule ?? null]);
    if(!contracts.has(key))contracts.set(key,[]);
    contracts.get(key).push(row);
  }
  const groups=[...contracts.values()].map(rows => {
    const families=new Map();
    for(const row of rows){const key=row.modelFamily || `UNKNOWN:${row.sourceId}`;if(!families.has(key))families.set(key,[]);families.get(key).push(row);}
    const familyRows=[...families].map(([modelFamily, members]) => {
      const directions=unique(members.map(row=>row.direction));
      return {modelFamily, recordIds:unique(members.map(row=>row.recordId)),sourceIds:unique(members.map(row=>row.sourceId)),
        marketDependence:unique(members.map(row=>row.marketDependence)),
        direction:directions.length===1 ? directions[0] : 'RELATED_MODEL_DISAGREEMENT',
        minProbability:Math.min(...members.map(row=>row.probability)),maxProbability:Math.max(...members.map(row=>row.probability)),
        descriptiveProbability:median(members.map(row=>row.probability))};
    }).sort((a,b)=>a.modelFamily.localeCompare(b.modelFamily));
    const values=familyRows.map(row=>row.descriptiveProbability),first=rows[0];
    return {eventId:first.eventId,sport:first.sport,startTime:first.startTime,period:first.period,
      marketDetail:first.marketDetail,side:first.side,line:first.line??null,priceDecimal:first.priceDecimal,
      probabilityBasis:first.probabilityBasis,pushProbability:first.pushProbability ?? null,settlement:first.settlement ?? null,
      families:familyRows,sourceIds:unique(rows.map(row=>row.sourceId)),recordIds:unique(rows.map(row=>row.recordId)),
      supportingFamilies:familyRows.filter(row=>row.direction==='SUPPORTS_PRICE').length,
      opposingFamilies:familyRows.filter(row=>row.direction==='OPPOSES_PRICE').length,
      mixedFamilies:familyRows.filter(row=>row.direction==='RELATED_MODEL_DISAGREEMENT').length,
      descriptiveMedian:median(values),minProbability:Math.min(...rows.map(row=>row.probability)),
      maxProbability:Math.max(...rows.map(row=>row.probability)),
      disagreementPoints:(Math.max(...rows.map(row=>row.probability))-Math.min(...rows.map(row=>row.probability)))*100};
  });
  return {schema:1,kind:'REVIEWED_EXACT_PRICE_AGGREGATION',decisionAuthority:false,
    records:records.length,sources:unique(records.map(row=>row.sourceId)).length,
    modelFamilies:unique(records.map(row=>row.modelFamily || `UNKNOWN:${row.sourceId}`)).length,
    recordIds:unique(records.map(row=>row.recordId)),groups,
    betReviewRequired:records.some(row=>row.direction==='SUPPORTS_PRICE'),reviewOrder:['BET','LEAN','WAIT','PASS'],
    limitation:'Family agreement and medians describe reviewed source points. They do not establish independence, a calibrated fair, uncertainty bounds, BET eligibility or stakes.'};
}

export function summarizeProjectionContext(records = []) {
  const groups=new Map();
  for(const row of list(records))for(const [field,unit] of [['homeSpread','home_spread_points'],['total','total_points']]){
    const value=row.projection?.[field];if(!finite(value))continue;
    const key=JSON.stringify([row.eventId,row.sport,row.startTime,row.period,unit]);
    if(!groups.has(key))groups.set(key,{unit,rows:[]});groups.get(key).rows.push({...row,value});
  }
  return [...groups.values()].map(({unit,rows})=>{
    const families=new Map();for(const row of rows){const key=row.modelFamily||`UNKNOWN:${row.sourceId}`;if(!families.has(key))families.set(key,[]);families.get(key).push(row.value);}
    return {kind:'DESCRIPTIVE_PROJECTION_RANGE',unit,families:families.size,sourceIds:unique(rows.map(row=>row.sourceId)),
      recordIds:unique(rows.map(row=>row.recordId)),descriptiveMedian:median([...families.values()].map(median)),
      min:Math.min(...rows.map(row=>row.value)),max:Math.max(...rows.map(row=>row.value)),
      limitation:'Native score/spread/total context only. No score-to-probability conversion, betting fair or uncertainty interval is implied.'};
  });
}
