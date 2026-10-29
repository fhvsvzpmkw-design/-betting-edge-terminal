import assert from 'node:assert/strict';
import {reconcileBudgetState, planOddsPapiBudget, recordBudgetSpend, budgetSummary} from '../tools/oddspapi-budget.mjs';

const at = (day, hour = 6, month = 11) => new Date(Date.UTC(2026, month - 1, day, hour + 8));
let s = reconcileBudgetState({requestLimit: 250, requestCount: 0, now: at(1)});
assert.equal(planOddsPapiBudget({state:s, now:at(1), canonicalSlot:1, desiredOddsRequests:2}).allowedOddsRequests,2);
assert.equal(planOddsPapiBudget({state:s, now:at(1), canonicalSlot:1, desiredOddsRequests:2, metadataRequests:1}).allowedTotalRequests,3);
s = recordBudgetSpend(s,{requests:3,oddsRequests:2,extraBatches:1,now:at(1)});
assert.equal(s.todayUsed,3);
const reconciled = reconcileBudgetState({state:s,requestLimit:250,requestCount:3,now:at(1,8)});
assert.equal(reconciled.todayUsed,3,'confirmed calls are not counted twice');
s = reconciled;
const second = planOddsPapiBudget({state:s,now:at(1,8),canonicalSlot:2,desiredOddsRequests:2});
assert.equal(second.allowedOddsRequests,1,'metadata and future base slots constrain optional batch');
s = recordBudgetSpend(s,{requests:1,oddsRequests:1,now:at(1,8)});
for(const [slot,hour] of [[3,9],[4,15],[5,18]]) {
  const plan=planOddsPapiBudget({state:s,now:at(1,hour),canonicalSlot:slot,desiredOddsRequests:2});
  assert.equal(plan.allowedOddsRequests,1);
  s=recordBudgetSpend(s,{requests:1,oddsRequests:1,now:at(1,hour)});
}
assert.equal(s.todayUsed,7);
assert.equal(planOddsPapiBudget({state:s,now:at(1,19),desiredOddsRequests:1}).reason,'DAILY_LIMIT');
assert.equal(budgetSummary(s,{now:at(1,19)}).pendingRequests,4);

const extraBase = reconcileBudgetState({requestLimit:250,requestCount:0,now:at(1)});
let extras = recordBudgetSpend(extraBase,{requests:2,oddsRequests:2,extraBatches:1,now:at(1)});
extras=recordBudgetSpend(extras,{requests:2,oddsRequests:2,extraBatches:1,now:at(1,8)});
assert.equal(planOddsPapiBudget({state:extras,now:at(1,9),canonicalSlot:3,desiredOddsRequests:2}).allowedOddsRequests,1,'only two extra batches per day');

const external = reconcileBudgetState({state:s,requestLimit:250,requestCount:11,now:at(2)});
assert.equal(external.todayUsed,4,'unseen use is charged conservatively after day rollover');
assert.equal(external.unattributedToday,4);
assert.equal(external.todayUsageUnknown,true);
assert.equal(external.estimatedRequestCount,11);
const unchanged = reconcileBudgetState({state:external,requestLimit:250,requestCount:11,now:at(3)});
assert.equal(unchanged.todayUsed,0);
assert.equal(unchanged.estimatedRequestCount,11,'new date cannot grant monthly credits');

const cold = reconcileBudgetState({requestLimit:250,requestCount:244,now:at(28,18,10)});
assert.equal(cold.todayUsed,7);
assert.equal(cold.todayUsageUnknown,true);
assert.equal(planOddsPapiBudget({state:cold,now:at(28,18,10),desiredOddsRequests:2}).allowedOddsRequests,0);
const preReset = reconcileBudgetState({state:cold,requestLimit:250,requestCount:244,now:at(1,6,11)});
assert.equal(preReset.estimatedRequestCount,244,'November date alone does not reset October account usage');
const reset = reconcileBudgetState({state:preReset,requestLimit:250,requestCount:0,now:at(1,8,11)});
assert.equal(reset.providerCounterReset,true);
assert.equal(reset.todayUsed,0);
assert.equal(reset.estimatedRequestCount,0);
assert.equal(planOddsPapiBudget({state:reset,now:at(1,8,11),canonicalSlot:2,desiredOddsRequests:2}).allowedOddsRequests,2);

let resetDay = reconcileBudgetState({requestLimit:250,requestCount:0,now:at(31,6,10)});
resetDay = recordBudgetSpend(resetDay,{requests:7,oddsRequests:7,extraBatches:2,now:at(31,15,10)});
resetDay = reconcileBudgetState({state:resetDay,requestLimit:250,requestCount:7,now:at(31,16,10)});
resetDay = reconcileBudgetState({state:resetDay,requestLimit:250,requestCount:0,now:at(31,18,10)});
assert.equal(resetDay.providerCounterReset,true);
assert.equal(resetDay.todayUsed,7,'provider monthly reset cannot grant another seven calls on the same Vancouver date');
assert.equal(resetDay.todayExtraBatches,2);
assert.equal(planOddsPapiBudget({state:resetDay,now:at(31,18,10),canonicalSlot:5}).reason,'DAILY_LIMIT');
resetDay = reconcileBudgetState({state:resetDay,requestLimit:250,requestCount:0,now:at(1,6,11)});
assert.equal(resetDay.todayUsed,0,'the next actual Vancouver day restores daily allowance');

const tight = {...reset,providerObservedCount:95,estimatedRequestCount:95};
const tightPlan=planOddsPapiBudget({state:tight,now:at(1,8,11),canonicalSlot:2,desiredOddsRequests:2,metadataRequests:1});
assert.equal(tightPlan.futureBaseRequests,148);
assert.equal(tightPlan.allowedOddsRequests,1,'optional call cannot consume the final future-base runway');
assert.equal(tightPlan.allowedMetadataRequests,1,'required cached-definition refresh is charged');

let month = reconcileBudgetState({requestLimit:250,requestCount:0,now:at(1,6,12)});
for(let day=1;day<=31;day++) {
  month=reconcileBudgetState({state:month,requestLimit:250,requestCount:month.estimatedRequestCount,now:at(day,6,12)});
  for(const [slot,hour] of [[1,6],[2,8],[3,9],[4,15],[5,18]]) {
    const plan=planOddsPapiBudget({state:month,now:at(day,hour,12),canonicalSlot:slot,desiredOddsRequests:2});
    assert.ok(plan.allowedOddsRequests>=1,`day ${day} slot ${slot} retains base coverage`);
    month=recordBudgetSpend(month,{requests:plan.allowedTotalRequests,oddsRequests:plan.allowedOddsRequests,extraBatches:Math.max(0,plan.allowedOddsRequests-1),now:at(day,hour,12)});
  }
  assert.ok(month.todayUsed<=7);
}
assert.equal(month.estimatedRequestCount,217,'31-day worst-case routine spend remains 217');
assert.equal(budgetSummary(month,{now:at(31,18,12)}).remaining,33);

for(const input of [{requestLimit:0,requestCount:0},{requestLimit:250,requestCount:NaN},{requestLimit:250,requestCount:-1},{requestLimit:'250',requestCount:0}]) assert.throws(()=>reconcileBudgetState(input));
assert.throws(()=>reconcileBudgetState({state:{schema:99},requestLimit:250,requestCount:0}));
assert.throws(()=>recordBudgetSpend(reset,{requests:1,oddsRequests:2}));
assert.throws(()=>planOddsPapiBudget({state:reset,now:at(1),canonicalSlot:6}));
console.log('ODDSPAPI BUDGET: 31-day pacing, provider-confirmed reset, daily/monthly limits, required metadata, external usage and base-slot runway PASS');
