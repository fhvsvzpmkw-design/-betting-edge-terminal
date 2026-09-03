#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
};
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const padWeek = week => String(Number(week)).padStart(2, '0');
const isoMillis = (value, error) => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(error);
  return parsed;
};
const requireFields = (object, fields, prefix) => {
  for (const field of fields) {
    if (!has(object, field)) throw new Error(`${prefix}_FIELD_MISSING:${field}`);
  }
};

const policyPath = path.resolve(
  ROOT,
  flag('--policy', 'data/walters/nfl/graham-research-runtime-policy-v1.json'),
);
const policy = read(policyPath);
if (
  policy.schema !== 1 ||
  policy.state !== 'OPERATIONAL' ||
  policy.policyId !== 'graham-research-runtime-v1' ||
  !Array.isArray(policy.eventContract?.commonRequiredFields) ||
  !Number.isFinite(Number(policy.lifecycle?.defaultLeaseMinutes)) ||
  !Number.isFinite(Number(policy.lifecycle?.maximumLeaseMinutes)) ||
  Number(policy.lifecycle.defaultLeaseMinutes) <= 0 ||
  Number(policy.lifecycle.maximumLeaseMinutes) < Number(policy.lifecycle.defaultLeaseMinutes)
) {
  throw new Error('GRAHAM_RESEARCH_RUNTIME_POLICY_NOT_OPERATIONAL');
}

const fixturePath = flag('--fixture');
const suppliedEventsRoot = flag('--events-root');
const activePath = path.resolve(
  ROOT,
  flag('--active', 'data/walters/nfl/active-week.json'),
);

let active;
let eventEntries;

const discoverLiveEvents = eventsRoot => {
  const entries = [];
  if (!fs.existsSync(eventsRoot)) return entries;
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && entry.name.endsWith('.json')) {
        const relative = path.relative(ROOT, absolute).replaceAll('\\', '/');
        if (!/(?:^|\/)week-\d{2}-research-runtime\/[^/]+\.json$/.test(relative)) continue;
        entries.push({
          path: relative,
          absolute,
          event: read(absolute),
        });
      }
    }
  };
  walk(eventsRoot);
  return entries;
};

if (fixturePath) {
  const fixture = read(path.resolve(ROOT, fixturePath));
  active = fixture.active;
  eventEntries = (fixture.events || []).map(item => ({
    path: item.path,
    absolute: null,
    event: item.event,
  }));
} else {
  active = read(activePath);
  const eventsRoot = path.resolve(ROOT, suppliedEventsRoot || 'data/walters/nfl');
  eventEntries = discoverLiveEvents(eventsRoot);
}

if (
  active?.schema !== 1 ||
  active?.state !== 'ACTIVE' ||
  active?.authority !== 'GRAHAM_WEEK_ROLLOVER'
) {
  throw new Error('GRAHAM_RESEARCH_RUNTIME_ACTIVE_WEEK_INVALID');
}

const commonFields = policy.eventContract.commonRequiredFields;
const activeWeek = `${Number(active.season)}-W${padWeek(active.week)}`;
const seenRunEventIds = new Set();
const stateCounts = Object.fromEntries(policy.lifecycle.allowedStates.map(state => [state, 0]));

for (const entry of eventEntries) {
  const event = entry.event;
  requireFields(event, commonFields, 'GRAHAM_RESEARCH_RUNTIME');
  if (event.schema !== 1) throw new Error(`GRAHAM_RESEARCH_RUNTIME_SCHEMA_INVALID:${entry.path}`);
  if (event.policyId !== policy.policyId) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_POLICY_ID_MISMATCH:${entry.path}`);
  }
  if (!policy.appliesToTaskKeys.includes(event.taskKey)) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_TASK_NOT_COVERED:${event.taskKey}`);
  }
  if (!policy.lifecycle.allowedStates.includes(event.state)) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_STATE_INVALID:${event.state}`);
  }
  if (!policy.lifecycle.allowedCheckpoints.includes(event.checkpoint)) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_CHECKPOINT_INVALID:${event.checkpoint}`);
  }
  if (policy.lifecycle.marketViewedMustBeFalse && event.marketViewed !== false) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_MARKET_ISOLATION_NOT_PROVEN:${event.runEventId}`);
  }
  if (typeof event.ledgerSweepPresent !== 'boolean') {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_LEDGER_FLAG_INVALID:${event.runEventId}`);
  }
  if (seenRunEventIds.has(event.runEventId)) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_DUPLICATE_RUN_EVENT_ID:${event.runEventId}`);
  }
  seenRunEventIds.add(event.runEventId);

  const season = Number(event.season);
  const week = Number(event.week);
  if (!Number.isInteger(season) || !Number.isInteger(week) || week < 1) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_SEASON_WEEK_INVALID:${event.runEventId}`);
  }
  const expectedLedgerPath = `data/walters/nfl/${season}/week-${padWeek(week)}-research-ledger.json`;
  if (event.ledgerPath !== expectedLedgerPath) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_LEDGER_PATH_MISMATCH:${event.runEventId}`);
  }
  const expectedDirectory = `data/walters/nfl/${season}/week-${padWeek(week)}-research-runtime`;
  const normalizedPath = String(entry.path || '').replaceAll('\\', '/');
  if (!normalizedPath.endsWith(`${expectedDirectory}/${event.runEventId}.json`)) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_EVENT_PATH_MISMATCH:${normalizedPath}`);
  }

  const slug = policy.taskSlugByKey[event.taskKey];
  const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const runEventPattern = new RegExp(
    `^graham-${escapedSlug}-${season}-w${padWeek(week)}-\\d{8}T\\d{6}[+-]\\d{4}$`,
  );
  if (typeof event.runEventId !== 'string' || !runEventPattern.test(event.runEventId)) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_RUN_EVENT_ID_INVALID:${event.runEventId}`);
  }

  const startedAt = isoMillis(
    event.startedAt,
    `GRAHAM_RESEARCH_RUNTIME_STARTED_AT_INVALID:${event.runEventId}`,
  );
  const lastCheckpointAt = isoMillis(
    event.lastCheckpointAt,
    `GRAHAM_RESEARCH_RUNTIME_CHECKPOINT_AT_INVALID:${event.runEventId}`,
  );
  const staleAfter = isoMillis(
    event.staleAfter,
    `GRAHAM_RESEARCH_RUNTIME_STALE_AFTER_INVALID:${event.runEventId}`,
  );
  if (lastCheckpointAt < startedAt) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_TIME_ORDER_INVALID:${event.runEventId}`);
  }
  if (staleAfter <= startedAt) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_STALE_AFTER_ORDER_INVALID:${event.runEventId}`);
  }

  if (event.state === 'RUN_STARTED') {
    const leaseMillis = staleAfter - lastCheckpointAt;
    if (leaseMillis <= 0 || leaseMillis > Number(policy.lifecycle.maximumLeaseMinutes) * 60_000) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_LEASE_INVALID:${event.runEventId}`);
    }
    if (season !== Number(active.season) || week !== Number(active.week)) {
      throw new Error(
        `GRAHAM_RESEARCH_RUNTIME_STARTED_NOT_ACTIVE_WEEK:${season}-W${padWeek(week)}:${activeWeek}`,
      );
    }
    if (!['STARTED', 'PREFLIGHT_VERIFIED', 'RESEARCH_IN_PROGRESS', 'COMPLETION_PENDING'].includes(event.checkpoint)) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_STARTED_CHECKPOINT_INVALID:${event.checkpoint}`);
    }
    if (event.checkpoint === 'STARTED' && event.ledgerSweepPresent !== false) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_STARTED_LEDGER_FLAG_INVALID:${event.runEventId}`);
    }
    if (event.completionResult !== null || event.completionReceipt !== null || event.failure !== null) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_STARTED_TERMINAL_DATA_PRESENT:${event.runEventId}`);
    }
    if (has(event, 'completedAt') || has(event, 'blockedAt')) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_STARTED_TERMINAL_TIME_PRESENT:${event.runEventId}`);
    }
  }

  if (event.state === 'COMPLETED') {
    if (event.checkpoint !== 'COMPLETED' || event.ledgerSweepPresent !== true || event.failure !== null) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_COMPLETED_SEMANTICS_INVALID:${event.runEventId}`);
    }
    if (!policy.completionBinding.allowedCompletionResults.includes(event.completionResult)) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_COMPLETION_RESULT_INVALID:${event.runEventId}`);
    }
    if (!has(event, 'completedAt') || has(event, 'blockedAt')) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_COMPLETED_TIME_FIELDS_INVALID:${event.runEventId}`);
    }
    const completedAt = isoMillis(
      event.completedAt,
      `GRAHAM_RESEARCH_RUNTIME_COMPLETED_AT_INVALID:${event.runEventId}`,
    );
    if (completedAt !== lastCheckpointAt || completedAt < startedAt) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_COMPLETED_TIME_ORDER_INVALID:${event.runEventId}`);
    }
    const receipt = event.completionReceipt;
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_RECEIPT_MISSING:${event.runEventId}`);
    }
    requireFields(
      receipt,
      [
        'path',
        'state',
        'policyId',
        'verifiedAt',
        'runEventId',
        'taskKey',
        'season',
        'week',
        'completionResult',
        'marketViewed',
        'ledgerBlobSha',
        'receiptBlobSha',
      ],
      'GRAHAM_RESEARCH_RUNTIME_RECEIPT',
    );
    if (
      receipt.path !== policy.completionBinding.receiptPath ||
      receipt.state !== policy.completionBinding.receiptState ||
      receipt.policyId !== policy.completionBinding.policyId ||
      receipt.runEventId !== event.runEventId ||
      receipt.taskKey !== event.taskKey ||
      Number(receipt.season) !== season ||
      Number(receipt.week) !== week ||
      receipt.completionResult !== event.completionResult ||
      receipt.marketViewed !== false
    ) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_RECEIPT_BINDING_INVALID:${event.runEventId}`);
    }
    const verifiedAt = isoMillis(
      receipt.verifiedAt,
      `GRAHAM_RESEARCH_RUNTIME_RECEIPT_VERIFIED_AT_INVALID:${event.runEventId}`,
    );
    if (completedAt < verifiedAt) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_RECEIPT_TIME_ORDER_INVALID:${event.runEventId}`);
    }
    for (const shaField of ['ledgerBlobSha', 'receiptBlobSha']) {
      if (!/^[0-9a-f]{40}$/.test(receipt[shaField])) {
        throw new Error(`GRAHAM_RESEARCH_RUNTIME_RECEIPT_SHA_INVALID:${shaField}:${event.runEventId}`);
      }
    }
  }

  if (event.state === 'BLOCKED_WITH_DURABLE_RECORD') {
    if (
      !['CONTROLLED_FAILURE', 'WATCHDOG_CLOSED'].includes(event.checkpoint) ||
      event.completionResult !== 'BLOCKED_WITH_DURABLE_RECORD' ||
      event.completionReceipt !== null
    ) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_BLOCKED_SEMANTICS_INVALID:${event.runEventId}`);
    }
    if (!has(event, 'blockedAt') || has(event, 'completedAt')) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_BLOCKED_TIME_FIELDS_INVALID:${event.runEventId}`);
    }
    const blockedAt = isoMillis(
      event.blockedAt,
      `GRAHAM_RESEARCH_RUNTIME_BLOCKED_AT_INVALID:${event.runEventId}`,
    );
    if (blockedAt !== lastCheckpointAt || blockedAt < startedAt) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_BLOCKED_TIME_ORDER_INVALID:${event.runEventId}`);
    }
    const failure = event.failure;
    if (!failure || typeof failure !== 'object' || Array.isArray(failure)) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_FAILURE_MISSING:${event.runEventId}`);
    }
    requireFields(
      failure,
      ['phase', 'code', 'summary', 'automatic'],
      'GRAHAM_RESEARCH_RUNTIME_FAILURE',
    );
    if (
      !failure.phase ||
      !failure.code ||
      !failure.summary ||
      typeof failure.automatic !== 'boolean'
    ) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_FAILURE_INVALID:${event.runEventId}`);
    }
    if (
      event.checkpoint === 'WATCHDOG_CLOSED' &&
      (
        failure.automatic !== true ||
        failure.phase !== policy.watchdog.staleFailurePhase ||
        failure.code !== policy.watchdog.staleFailureCode
      )
    ) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_WATCHDOG_FAILURE_INVALID:${event.runEventId}`);
    }
    if (event.checkpoint === 'CONTROLLED_FAILURE' && failure.automatic !== false) {
      throw new Error(`GRAHAM_RESEARCH_RUNTIME_CONTROLLED_FAILURE_INVALID:${event.runEventId}`);
    }
  }

  stateCounts[event.state] += 1;
}

console.log(
  `GRAHAM RESEARCH RUNTIME: PASS // ${eventEntries.length} EVENTS // ` +
    policy.lifecycle.allowedStates.map(state => `${state}=${stateCounts[state]}`).join(' // '),
);
