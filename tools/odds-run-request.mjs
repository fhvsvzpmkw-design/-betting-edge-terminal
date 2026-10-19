#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolveWorkflowSchedule} from './main-schedule.mjs';

const REQUEST_PATH = 'data/odds-run-request.json';

export function resolveRecoverySlot({scheduledAt,operatingDate,canonicalSlot,now=new Date(),root=process.cwd()}) {
  const scheduled = new Date(typeof scheduledAt === 'string' ? scheduledAt : NaN);
  if (!Number.isFinite(scheduled.getTime()) || scheduled.getUTCSeconds() !== 0 || scheduled.getUTCMilliseconds() !== 0) {
    throw new Error('Scheduled odds recovery requires an exact planned pulse timestamp');
  }
  const slot = resolveWorkflowSchedule({now: scheduled, eventName: 'schedule'}, root);
  const pulseClock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Vancouver', hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
  }).format(scheduled);
  const actualDate = resolveWorkflowSchedule({now, eventName: 'workflow_dispatch'}, root).operatingDate;
  const ageMinutes = (now.getTime() - scheduled.getTime()) / 60000;
  if (!slot.shouldRun || pulseClock !== slot.plannedPulseTime || operatingDate !== slot.operatingDate ||
    canonicalSlot !== slot.canonicalSlot || actualDate !== slot.operatingDate || !Number.isFinite(ageMinutes) ||
    ageMinutes < -2 || ageMinutes > 75) {
    throw new Error('Scheduled odds recovery must match a current-day Main pulse within 75 minutes');
  }
  return slot;
}

export function readFrozenOddsRunRequest({root=process.cwd(),sha=process.env.GITHUB_SHA}={}) {
  if (!/^[a-f0-9]{40}$/i.test(String(sha || ''))) throw new Error('Odds run request requires a valid triggering GITHUB_SHA');
  const bytes = execFileSync('git', ['show', `${sha}:${REQUEST_PATH}`], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(bytes);
}

export function resolveOddsRunRequest(request,{now=new Date(),root=process.cwd()}={}) {
  if (request?.schema !== 1) throw new Error('Odds run request schema must be 1');
  if (!['manual', 'scheduled_recovery'].includes(request.mode)) throw new Error('Odds run request mode must be manual or scheduled_recovery');
  if (typeof request.requestId !== 'string' || !request.requestId.trim()) throw new Error('Odds run request requires a nonempty requestId');
  const requested = typeof request.requestedAt === 'string' ? Date.parse(request.requestedAt) : NaN;
  const ageMinutes = (now.getTime() - requested) / 60000;
  if (!Number.isFinite(ageMinutes) || ageMinutes < -2 || ageMinutes > 10) throw new Error('Odds run request requestedAt is outside the 10-minute request window');
  const eventName = request.mode === 'manual' ? 'workflow_dispatch' : 'schedule';
  const slot = request.mode === 'manual'
    ? resolveWorkflowSchedule({now, eventName}, root)
    : resolveRecoverySlot({...request, now, root});
  return {
    slot,
    effectiveEventName: eventName,
    // Keep the established manual source so a manual refresh can fulfill a slot.
    requestTriggerSource: request.mode === 'manual' ? 'manual' : 'report-task-recovery',
    requestScheduledAt: request.mode === 'scheduled_recovery' ? new Date(request.scheduledAt).toISOString() : '',
  };
}

export function requestOutputLines(result) {
  const slot = result.slot;
  const values = {
    should_run: slot.shouldRun ? 'true' : 'false',
    manual: slot.manual ? 'true' : 'false',
    operating_date: slot.operatingDate || '',
    schedule_id: slot.scheduleId || '',
    schedule_label: slot.scheduleLabel || '',
    canonical_slot: slot.canonicalSlot ?? '',
    slot_name: slot.slotName || '',
    slot_id: slot.slotId || '',
    planned_pulse_time: slot.plannedPulseTime || '',
    planned_report_time: slot.plannedReportTime || '',
    target_minutes: slot.targetMinutes ?? '',
    featured_vig_scope: slot.featuredVigScope ? 'true' : 'false',
    effective_event_name: result.effectiveEventName,
    request_trigger_source: result.requestTriggerSource,
    request_scheduled_at: result.requestScheduledAt,
  };
  return Object.entries(values).map(([key,value]) => `${key}=${String(value).replace(/\r?\n/g, ' ')}`).join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] !== 'resolve') throw new Error('Use odds-run-request.mjs resolve');
    console.log(requestOutputLines(resolveOddsRunRequest(readFrozenOddsRunRequest())));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
