import assert from 'node:assert/strict';
import labels from '../assets/selection-label.js';
import {normalizeSelectionLabels} from '../tools/selection-label-gate.mjs';

const card=(side,line,marketKey='spread')=>({
  title:'Denver Nuggets',status:'PASS',stake:'$0',price:'-111',book:'Bet365',
  meta:'NBA | Denver Nuggets @ Oklahoma City Thunder | 2026-10-23T01:30:00Z',
  feed:{eventId:'73682538',eventDate:'2026-10-23T01:30:00Z',marketKey,side,line,
    selectionKey:`73682538|${marketKey}|${side}||${line??''}`,priceDecimal:1.9},
  coreAssessment:{context:{sport:'NBA',marketDetail:marketKey==='spread'?'full_game_primary_spread':'full_game_primary_total'}}
});
const away=card('away',-8.5);
const wrong='PASS — Denver Nuggets Spread -8.5 at -111 is 0.44 probability points unfavorable.';
const corrected='PASS — Denver Nuggets +8.5 — Spread at -111 is 0.44 probability points unfavorable.';
assert.equal(labels.repairText(away,wrong),corrected);
assert.equal(labels.repairText(away,corrected),corrected,'display repair is idempotent');
assert.equal(labels.repairText(away,'Oklahoma City Thunder Spread -8.5 at -105 is the opposing side.'),'Oklahoma City Thunder Spread -8.5 at -105 is the opposing side.');
assert.equal(labels.repairText(away,'Denver Nuggets Spread -7.5 at -111 was a previous line.'),'Denver Nuggets Spread -7.5 at -111 was a previous line.');
assert.equal(labels.repairText(away,'Source discussed Denver Nuggets Spread -8.5 without a quote.'),'Source discussed Denver Nuggets Spread -8.5 without a quote.');
assert.equal(labels.repairText({...away,feed:{...away.feed,selectionKey:'different|spread|away||-8.5'}},wrong),wrong,'invalid identity never repairs narrative');
const puck={...card('away',1.5),meta:'NHL | Vegas Golden Knights @ St. Louis Blues | 2026-10-23T01:30:00Z',coreAssessment:{context:{sport:'NHL',marketDetail:'full_game_primary_puck_line'}}};
assert.equal(labels.repairText(puck,'Vegas Golden Knights Puck Line +1.5 at +200 is unfavorable.'),'Vegas Golden Knights -1.5 — Puck line at +200 is unfavorable.');
const total=card('over',236.5,'totals');
assert.equal(labels.repairText(total,'Over Total +236.5 at -111 is unfavorable.'),'Denver Nuggets @ Oklahoma City Thunder Over 236.5 — Total at -111 is unfavorable.');
assert.equal(labels.repairText(total,'Under Total +236.5 at -111 is opposing evidence.'),'Under Total +236.5 at -111 is opposing evidence.');
const escaped={...away,meta:'NBA | Team (A) @ Hosts | 2026-10-23T01:30:00Z'};
assert.equal(labels.repairText(escaped,'Team (A) Spread -8.5 at -111'),'Team (A) +8.5 — Spread at -111');

const jmu={...card('away',null,'ml'),meta:'NCAAF | Away @ Home | 2026-10-23T01:30:00Z',coreAssessment:{context:{sport:'NCAAF',marketDetail:'full_game_moneyline'}}};
const event={eventId:jmu.feed.eventId,away:'James Madison Dukes',home:'Appalachian State Mountaineers',startTime:jmu.feed.eventDate};
const jmuBefore=JSON.stringify(jmu),hydrated=labels.withEventMetadata(jmu,event);
assert.equal(labels.describe(jmu,{event}).title,'James Madison Dukes Moneyline');
assert.equal(hydrated.meta,'NCAAF | James Madison Dukes @ Appalachian State Mountaineers | 2026-10-23T01:30:00Z');
assert.equal(JSON.stringify(jmu),jmuBefore,'display cannot rewrite issued metadata');
for(const other of [{...event,eventId:'wrong'},{...event,startTime:'2026-10-24T01:30:00Z'},{...event,away:'Away'}])assert.equal(labels.withEventMetadata(jmu,other),jmu,'unmatched events cannot supply teams');
assert.equal(labels.withEventMetadata(away,event),away,'real participant names are never overwritten');

away.analysis=wrong;away.coreAssessment.rationale=wrong;
away.marketAssessment={selectionKey:away.feed.selectionKey,decisionRationale:wrong};
away.cardEvidence={selectionKey:away.feed.selectionKey,decisionExplanation:wrong,findings:[{application:wrong}]};
away.sourceEvidence=[{finding:wrong}];
const selection={quote:{...away.feed},title:away.title,decision:{rationale:wrong}};
const report={ts:'2026-10-22T12:00:00-07:00',recs:[away,jmu],gameIntelligence:{games:[event]},candidateAssessment:{selections:[selection],markets:[{selections:[structuredClone(selection)]}]}};
const sidecar={recommendations:structuredClone(report.recs),candidateAssessment:structuredClone(report.candidateAssessment),primaryAnalysis:{receipts:report.recs.map(rec=>({state:'EVALUATED',decision:structuredClone(rec),evidence:structuredClone(rec),candidateAssessment:{decision:{rationale:rec.analysis}}}))}};
const input=JSON.stringify({report,sidecar}),normalized=normalizeSelectionLabels(report,sidecar);
assert.equal(JSON.stringify({report,sidecar}),input,'normalizer operates on unfrozen draft copies');
assert.equal(normalized.report.recs[0].analysis,corrected);
assert.equal(normalized.report.recs[0].coreAssessment.rationale,corrected);
assert.equal(normalized.sidecar.recommendations[0].cardEvidence.findings[0].application,corrected);
assert.equal(normalized.sidecar.primaryAnalysis.receipts[0].decision.analysis,corrected);
assert.equal(normalized.sidecar.primaryAnalysis.receipts[0].candidateAssessment.decision.rationale,corrected);
assert.equal(normalized.report.candidateAssessment.markets[0].selections[0].decision.rationale,corrected);
assert.equal(normalized.report.recs[0].sourceEvidence[0].finding,wrong,'original source findings remain verbatim');
assert.equal(normalized.report.recs[1].title,'James Madison Dukes Moneyline');
assert.deepEqual(normalized.report.recs[0].feed,away.feed,'quote, side and provider-oriented handicap remain exact');
assert.equal(normalized.report.recs[0].status,away.status);
assert.equal(normalized.report.recs[0].stake,away.stake);
assert.deepEqual(normalizeSelectionLabels(normalized.report,normalized.sidecar),normalized);
console.log('SELECTION COPY: exact signed narratives, event-bound placeholders, consistent draft copies and immutable evidence PASS');
