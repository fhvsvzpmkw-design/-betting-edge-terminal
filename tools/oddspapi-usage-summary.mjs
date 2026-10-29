#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const UNAVAILABLE = 'OddsPapi usage unavailable';
const count = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

// Read only the saved observer. This summary never requests or refreshes odds.
export function formatOddsPapiUsage(observer) {
  const budget = observer?.budget;
  if (!budget || typeof budget !== 'object' || Array.isArray(budget) ||
      !count(budget.requestLimit) || budget.requestLimit === 0 || !count(budget.usedThisMonth)) {
    return UNAVAILABLE;
  }
  const estimated = count(budget.pendingRequests) && budget.pendingRequests > 0;
  const monthly = `${budget.usedThisMonth}/${budget.requestLimit} ${estimated ? 'estimated used' : 'used'} this month`;
  const remaining = count(budget.remaining) ? `${budget.remaining} remaining` : 'remaining unavailable';
  const todayEstimated = budget.externalUsageEstimatedToday === true ||
    (count(budget.unattributedToday) && budget.unattributedToday > 0);
  const today = count(budget.todayUsed) && count(budget.todayLimit) && budget.todayLimit > 0
    ? `today ${budget.todayUsed}/${budget.todayLimit}${todayEstimated ? ' (estimated)' : ''}`
    : 'today unavailable';
  const projection = typeof budget.projectedMonthEnd === 'number' &&
    Number.isFinite(budget.projectedMonthEnd) && budget.projectedMonthEnd >= 0
    ? `projected month-end ${Math.ceil(budget.projectedMonthEnd)}/${budget.requestLimit}`
    : 'projected month-end unavailable';
  return `OddsPapi: ${monthly} · ${remaining} · ${today} · ${projection}`;
}

export function readOddsPapiUsage(filename = 'data/oddspapi-observer.json') {
  try {
    return formatOddsPapiUsage(JSON.parse(fs.readFileSync(filename, 'utf8')));
  } catch {
    return UNAVAILABLE;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(readOddsPapiUsage(process.argv[2]));
}
