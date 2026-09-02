#!/usr/bin/env node
import fs from 'node:fs';

export const DEFAULT_POLICY_PATH = 'data/report-event-eligibility-v1.json';

export function loadPolicy(path = DEFAULT_POLICY_PATH) {
  const policy = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (policy?.schema !== 1) throw new Error('REPORT_EVENT_ELIGIBILITY_POLICY_SCHEMA_INVALID');
  if (policy?.policyId !== 'betting-edge-report-event-eligibility-v1') throw new Error('REPORT_EVENT_ELIGIBILITY_POLICY_ID_INVALID');
  if (policy?.state !== 'OPERATIONAL') throw new Error('REPORT_EVENT_ELIGIBILITY_POLICY_NOT_OPERATIONAL');
  if (typeof policy?.timezone !== 'string' || !policy.timezone) throw new Error('REPORT_EVENT_ELIGIBILITY_POLICY_TIMEZONE_INVALID');
  return policy;
}

export function localDateKey(timestamp, timeZone = 'America/Vancouver') {
  const d = new Date(timestamp);
  if (!Number.isFinite(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  if (!values.year || !values.month || !values.day) return null;
  return `${values.year}-${values.month}-${values.day}`;
}

function violation(code, index, rec, detail = {}) {
  return {
    code,
    index,
    title: rec?.title ?? null,
    eventId: rec?.feed?.eventId ?? null,
    eventDate: rec?.feed?.eventDate ?? null,
    ...detail
  };
}

export function auditReport(report, policy = loadPolicy()) {
  const timeZone = policy.timezone;
  const reportTs = report?.ts;
  const reportMs = Date.parse(reportTs ?? '');
  const reportDate = localDateKey(reportTs, timeZone);
  if (!Number.isFinite(reportMs) || !reportDate) {
    return {
      ok: false,
      policyId: policy.policyId,
      timeZone,
      reportTs: reportTs ?? null,
      reportDate: null,
      eligible: [],
      violations: [violation(policy.failureCodes.invalidReportTimestamp, -1, null)]
    };
  }

  if (!Array.isArray(report?.recs)) {
    return {
      ok: false,
      policyId: policy.policyId,
      timeZone,
      reportTs,
      reportDate,
      eligible: [],
      violations: [violation('REPORT_RECOMMENDATIONS_INVALID', -1, null)]
    };
  }

  const eligible = [];
  const violations = [];

  report.recs.forEach((rec, index) => {
    const eventTs = rec?.feed?.eventDate;
    const eventMs = Date.parse(eventTs ?? '');
    const eventDate = localDateKey(eventTs, timeZone);

    if (!Number.isFinite(eventMs) || !eventDate) {
      violations.push(violation(policy.failureCodes.invalidEventTimestamp, index, rec));
      return;
    }

    if (eventMs <= reportMs) {
      violations.push(violation(policy.failureCodes.alreadyStarted, index, rec, { reportDate, eventLocalDate: eventDate }));
      return;
    }

    if (eventDate !== reportDate) {
      violations.push(violation(policy.failureCodes.outsideReportDate, index, rec, { reportDate, eventLocalDate: eventDate }));
      return;
    }

    eligible.push({
      index,
      title: rec?.title ?? null,
      eventId: rec?.feed?.eventId ?? null,
      eventDate: eventTs,
      eventLocalDate: eventDate
    });
  });

  return {
    ok: violations.length === 0,
    policyId: policy.policyId,
    timeZone,
    reportTs,
    reportDate,
    total: report.recs.length,
    eligible,
    violations
  };
}

export function validateReport(report, policy = loadPolicy()) {
  const audit = auditReport(report, policy);
  if (!audit.ok) {
    const codes = [...new Set(audit.violations.map(v => v.code))];
    const err = new Error(`REPORT_EVENT_ELIGIBILITY_FAILED: ${codes.join(', ')}; violations=${audit.violations.length}`);
    err.code = codes[0] ?? 'REPORT_EVENT_ELIGIBILITY_FAILED';
    err.audit = audit;
    throw err;
  }
  return audit;
}

function syntheticReport(reportTs, eventDates) {
  return {
    ts: reportTs,
    recs: eventDates.map((eventDate, index) => ({
      title: `Synthetic ${index + 1}`,
      feed: { eventId: `synthetic-${index + 1}`, eventDate }
    }))
  };
}

function expect(condition, message) {
  if (!condition) throw new Error(`SELF_TEST_FAILED: ${message}`);
}

export function selfTest() {
  const policy = loadPolicy();
  const reportTs = '2026-09-01T18:15:00-07:00';

  const sameDay = auditReport(syntheticReport(reportTs, ['2026-09-02T01:38:00Z']), policy);
  expect(sameDay.ok && sameDay.eligible.length === 1, 'same-day later event must pass');

  const alreadyStarted = auditReport(syntheticReport(reportTs, ['2026-09-02T01:10:00Z']), policy);
  expect(!alreadyStarted.ok && alreadyStarted.violations[0]?.code === policy.failureCodes.alreadyStarted, 'already-started event must fail');

  const nextDay = auditReport(syntheticReport(reportTs, ['2026-09-02T07:05:00Z']), policy);
  expect(!nextDay.ok && nextDay.violations[0]?.code === policy.failureCodes.outsideReportDate, 'next Vancouver day must fail');

  const utcTomorrowButVancouverToday = auditReport(syntheticReport(reportTs, ['2026-09-02T06:30:00Z']), policy);
  expect(utcTomorrowButVancouverToday.ok, 'UTC date change must not exclude a Vancouver same-day event');

  const lateSameDay = auditReport(syntheticReport(reportTs, ['2026-09-02T06:59:00Z']), policy);
  expect(lateSameDay.ok, 'Vancouver 23:59 same-day event must pass');

  const exactStart = auditReport(syntheticReport(reportTs, [reportTs]), policy);
  expect(!exactStart.ok && exactStart.violations[0]?.code === policy.failureCodes.alreadyStarted, 'event exactly at report.ts must fail');

  return { state: 'PASS', policyId: policy.policyId, cases: 6 };
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function main() {
  const command = process.argv[2];
  if (command === 'self-test') {
    console.log(JSON.stringify(selfTest(), null, 2));
    return;
  }

  if (command === 'validate' || command === 'audit') {
    const reportPath = argValue('--report');
    if (!reportPath) throw new Error('--report is required');
    const policyPath = argValue('--policy') || DEFAULT_POLICY_PATH;
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const policy = loadPolicy(policyPath);
    const result = command === 'validate' ? validateReport(report, policy) : auditReport(report, policy);
    console.log(JSON.stringify(result, null, 2));
    if (command === 'audit') return;
    return;
  }

  throw new Error('Usage: node tools/report-event-eligibility.mjs self-test | validate --report <path> [--policy <path>] | audit --report <path> [--policy <path>]');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    main();
  } catch (err) {
    console.error(err?.message || String(err));
    if (err?.audit) console.error(JSON.stringify(err.audit, null, 2));
    process.exitCode = 1;
  }
}
