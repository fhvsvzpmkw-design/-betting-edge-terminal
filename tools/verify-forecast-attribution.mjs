#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const before=read(process.argv[2]),after=read('data/history/results-index.json');
const strip=({forecastRecordIds,forecastEvidenceIds,adoptedForecastRecordIds,...rest})=>rest;
assert.deepEqual(after.cards.map(strip),before.cards.map(strip),'Forecast repair must preserve card decisions, prices, grades and stakes');
for(const key of ['coverage','priceAnalytics','byStatus','byDate','byMarket','bySport','byLane','finalSelectionAnalytics','issuedBetAnalytics','playerValueAnalytics','decisionValueAnalytics','pizzaPlayAnalytics','decisionValueShadowV2'])
  assert.deepEqual(after[key],before[key],`Unchanged performance population: ${key}`);
const cleanSelections=rows=>rows.map(row=>({...row,timeline:row.timeline.map(strip)}));
assert.deepEqual(cleanSelections(after.selections),cleanSelections(before.selections));
const cache=new Map(),ids=(...groups)=>[...new Set(groups.flatMap(group=>Array.isArray(group)?group:[]).filter(id=>typeof id==='string'&&id.trim()))];
const timelines=new Map(after.selections.flatMap(row=>row.timeline).map(row=>[row.cardId,row]));
for(const card of after.cards){
  if(!cache.has(card.sourceRun))cache.set(card.sourceRun,read(card.sourceRun));
  const rec=cache.get(card.sourceRun).recs[Number(card.cardId.split('#').at(-1))];
  const reviewed=ids(rec.forecastEvidenceIds,rec.forecastRecordIds,rec.forecastReview?.eligibleExactRecordIds,rec.forecastReview?.contextRecordIds);
  const adopted=ids(rec.fairValueEvidence?.forecastRecordIds);
  assert.deepEqual(card.forecastEvidenceIds,reviewed,card.cardId);
  assert.deepEqual(card.adoptedForecastRecordIds,adopted,card.cardId);
  assert.deepEqual(card.forecastRecordIds,ids(reviewed,adopted),card.cardId);
  const timeline=timelines.get(card.cardId);
  assert.deepEqual(timeline.adoptedForecastRecordIds,adopted);
}
console.log(JSON.stringify({state:'VERIFIED',cards:after.cards.length,linkedCards:after.cards.filter(c=>c.forecastRecordIds.length).length,
  adoptedCards:after.cards.filter(c=>c.adoptedForecastRecordIds.length).length,decisionsAndPerformanceUnchanged:true}));
