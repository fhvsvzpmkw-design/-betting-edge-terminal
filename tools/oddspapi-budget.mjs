// Pure planning/accounting for the existing OddsPapi collector. No API calls.
export const ODDSPAPI_BUDGET_SCHEMA = 1;
export const ODDSPAPI_DAILY_LIMIT = 7;
export const ODDSPAPI_MONTH_RESERVE = 5;
export const ODDSPAPI_MAX_EXTRA_BATCHES = 2;
const DEFAULT_REPORT_TIMES = ['06:00', '08:00', '09:30', '15:15', '18:15'];

function integer(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new TypeError(`${label} must be an integer >= ${minimum}`);
  return value;
}

function clock(now) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Budget clock must be valid');
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver', hourCycle: 'h23', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(date).map(part => [part.type, part.value]));
  const days = new Date(Date.UTC(Number(fields.year), Number(fields.month), 0)).getUTCDate();
  return {iso: date.toISOString(), dayKey: `${fields.year}-${fields.month}-${fields.day}`,
    monthKey: `${fields.year}-${fields.month}`, minute: Number(fields.hour) * 60 + Number(fields.minute),
    remainingDays: days - Number(fields.day), daysInMonth: days};
}

function checkedState(state) {
  if (state?.schema !== ODDSPAPI_BUDGET_SCHEMA) throw new TypeError('Unsupported OddsPapi budget state');
  for (const key of ['requestLimit', 'providerObservedCount', 'estimatedRequestCount', 'todayUsed', 'todayExtraBatches', 'unattributedToday']) integer(state[key], key);
  if (state.requestLimit < 1 || state.estimatedRequestCount < state.providerObservedCount) throw new TypeError('Budget state quota is inconsistent');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.dayKey || '') || !/^\d{4}-\d{2}$/.test(state.monthKey || '') ||
    !Number.isFinite(Date.parse(state.updatedAt || ''))) throw new TypeError('Budget state date is missing or invalid');
  return state;
}

function rollDay(state, now) {
  checkedState(state);
  const current = clock(now);
  if (Date.parse(current.iso) < Date.parse(state.updatedAt)) throw new Error('Budget clock moved backwards');
  if (state.dayKey === current.dayKey) return {...state, monthKey: current.monthKey, updatedAt: current.iso};
  // A calendar rollover grants a daily allowance, never a new provider quota.
  return {...state, dayKey: current.dayKey, monthKey: current.monthKey, todayUsed: 0,
    todayExtraBatches: 0, unattributedToday: 0, todayUsageUnknown: false,
    externalUsageEstimatedToday: false, updatedAt: current.iso};
}

export function reconcileBudgetState({state = null, requestLimit, requestCount, now = new Date(), subscriptionId = null}) {
  integer(requestLimit, 'requestLimit', 1);
  integer(requestCount, 'requestCount');
  const current = clock(now);
  const subscription = subscriptionId === null ? null : String(subscriptionId);
  if (!state) {
    // No saved state means today's prior use is unknown. Reserve up to the full
    // daily allowance conservatively; do not call month-to-date use today's fact.
    const unknown = Math.min(ODDSPAPI_DAILY_LIMIT, requestCount);
    return {schema: ODDSPAPI_BUDGET_SCHEMA, subscriptionId: subscription,
      dayKey: current.dayKey, monthKey: current.monthKey, requestLimit,
      providerObservedCount: requestCount, estimatedRequestCount: requestCount,
      todayUsed: unknown, todayExtraBatches: 0, unattributedToday: unknown,
      todayUsageUnknown: requestCount > 0, externalUsageEstimatedToday: requestCount > 0,
      providerCounterReset: false, resetObservedAt: null, updatedAt: current.iso};
  }
  checkedState(state);
  const changedDay = state.dayKey !== current.dayKey;
  const next = rollDay(state, now);
  const subscriptionChanged = subscription !== null && state.subscriptionId !== null && subscription !== state.subscriptionId;
  const reset = requestCount < state.providerObservedCount || subscriptionChanged;
  const unseen = reset ? requestCount : Math.max(0, requestCount - state.estimatedRequestCount);
  return {...next, subscriptionId: subscription ?? state.subscriptionId, requestLimit,
    providerObservedCount: requestCount, estimatedRequestCount: requestCount,
    // The provider's monthly reset can occur before local midnight. Preserve
    // the same Vancouver day's spending so it cannot grant a second daily cap.
    todayUsed: next.todayUsed + unseen,
    todayExtraBatches: next.todayExtraBatches,
    unattributedToday: next.unattributedToday + unseen,
    todayUsageUnknown: next.todayUsageUnknown || ((changedDay || reset) && unseen > 0),
    externalUsageEstimatedToday: next.externalUsageEstimatedToday || unseen > 0,
    providerCounterReset: reset, resetObservedAt: reset ? current.iso : next.resetObservedAt,
    updatedAt: current.iso};
}

export function budgetSummary(state, {now = new Date()} = {}) {
  const next = rollDay(state, now), current = clock(now);
  const pending = Math.max(0, next.estimatedRequestCount - next.providerObservedCount);
  return {schema: 1, requestLimit: next.requestLimit, usedThisMonth: next.estimatedRequestCount,
    remaining: Math.max(0, next.requestLimit - next.estimatedRequestCount), todayUsed: next.todayUsed,
    todayLimit: ODDSPAPI_DAILY_LIMIT, monthReserve: ODDSPAPI_MONTH_RESERVE,
    monthKey: current.monthKey, dayKey: current.dayKey,
    projectedMonthEnd: next.estimatedRequestCount + Math.max(0, ODDSPAPI_DAILY_LIMIT - next.todayUsed) + current.remainingDays * ODDSPAPI_DAILY_LIMIT,
    projectionBasis: 'CURRENT_USAGE_PLUS_SEVEN_REQUEST_DAILY_CEILING',
    usageBasis: 'PROVIDER_ACCOUNT_PLUS_LOCAL_ATTEMPTS', providerObservedCount: next.providerObservedCount,
    pendingRequests: pending, unattributedToday: next.unattributedToday,
    todayUsageUnknown: next.todayUsageUnknown, externalUsageEstimatedToday: next.externalUsageEstimatedToday,
    todayExtraBatches: next.todayExtraBatches, providerCounterReset: next.providerCounterReset,
    resetObservedAt: next.resetObservedAt};
}

export function planOddsPapiBudget({state, now = new Date(), desiredOddsRequests = 1, metadataRequests = 0,
  canonicalSlot = null, reportTimes = DEFAULT_REPORT_TIMES}) {
  integer(desiredOddsRequests, 'desiredOddsRequests');
  integer(metadataRequests, 'metadataRequests');
  if (!Array.isArray(reportTimes) || reportTimes.length !== 5 || reportTimes.some(t => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw new TypeError('Five valid report times are required');
  if (canonicalSlot !== null && (!Number.isInteger(canonicalSlot) || canonicalSlot < 1 || canonicalSlot > 5)) throw new TypeError('canonicalSlot must be 1..5 or null');
  const next = rollDay(state, now), current = clock(now), summary = budgetSummary(next, {now});
  const remainingSlotsToday = canonicalSlot === null
    ? reportTimes.filter(t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) > current.minute).length
    : 5 - canonicalSlot;
  const futureBaseRequests = remainingSlotsToday + current.remainingDays * 5;
  const dailyAvailable = Math.max(0, ODDSPAPI_DAILY_LIMIT - next.todayUsed);
  const monthlyAvailable = Math.max(0, next.requestLimit - next.estimatedRequestCount - ODDSPAPI_MONTH_RESERVE);
  const baseCost = desiredOddsRequests > 0 ? 1 + metadataRequests : 0;
  const result = {allowedOddsRequests: 0, allowedMetadataRequests: 0, allowedTotalRequests: 0,
    desiredOddsRequests, metadataRequests, remainingSlotsToday, futureBaseRequests,
    dailyAvailable, monthlyAvailable, summary, reason: 'NO_ODDS_REQUESTS'};
  if (!desiredOddsRequests) return result;
  if (monthlyAvailable < baseCost) return {...result, reason: 'MONTHLY_RESERVE'};
  if (dailyAvailable < baseCost) return {...result, reason: 'DAILY_LIMIT'};
  // An unbound manual pull must not take the last requests reserved for today's
  // normal reports. A scheduled report can still use its own base request.
  if (canonicalSlot === null && dailyAvailable - baseCost < remainingSlotsToday) return {...result, reason: 'MAIN_SLOTS_RESERVED'};
  const extra = Math.max(0, Math.min(desiredOddsRequests - 1,
    ODDSPAPI_MAX_EXTRA_BATCHES - next.todayExtraBatches,
    dailyAvailable - baseCost - remainingSlotsToday,
    monthlyAvailable - baseCost - futureBaseRequests));
  const allowedOddsRequests = 1 + extra;
  return {...result, allowedOddsRequests, allowedMetadataRequests: metadataRequests,
    allowedTotalRequests: allowedOddsRequests + metadataRequests,
    reason: allowedOddsRequests === desiredOddsRequests ? 'WITHIN_BUDGET' : 'EXTRA_BATCH_DEFERRED'};
}

export function recordBudgetSpend(state, {requests = 1, oddsRequests = 0, extraBatches = 0, now = new Date()} = {}) {
  integer(requests, 'requests');
  integer(oddsRequests, 'oddsRequests');
  integer(extraBatches, 'extraBatches');
  if (oddsRequests > requests || extraBatches > oddsRequests) throw new TypeError('Invalid charged request breakdown');
  const next = rollDay(state, now);
  // Count before transport: HTTP errors and uncertain network failures cannot
  // create a free retry. A later account read verifies actual provider usage.
  return {...next, estimatedRequestCount: next.estimatedRequestCount + requests,
    todayUsed: next.todayUsed + requests, todayExtraBatches: next.todayExtraBatches + extraBatches};
}
