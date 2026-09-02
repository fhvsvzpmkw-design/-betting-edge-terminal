import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveGrahamActiveWeek } from './graham-active-week.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '..');
export const GRAHAM_SCHEDULE_MANIFEST = 'data/walters/nfl/graham-schedule-authority-v1.json';
export const GRAHAM_SCHEDULE_AUTHORITY_ID = 'graham-schedule-metadata-v1';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function taskMap(authority) {
  return new Map(authority.tasks.map(task => [task.taskKey, task]));
}

export function loadGrahamScheduleAuthority({ root = DEFAULT_ROOT } = {}) {
  const file = path.join(root, GRAHAM_SCHEDULE_MANIFEST);
  if (!fs.existsSync(file)) throw new Error(`Graham schedule manifest missing: ${GRAHAM_SCHEDULE_MANIFEST}`);
  const authority = readJson(file);
  validateGrahamScheduleAuthority(authority);
  return authority;
}

export function validateGrahamScheduleAuthority(authority) {
  if (authority?.schema !== 1) throw new Error('Graham schedule authority schema must be 1');
  if (authority?.authorityId !== GRAHAM_SCHEDULE_AUTHORITY_ID) throw new Error('Graham schedule authorityId mismatch');
  if (authority?.state !== 'OPERATIONAL' || authority?.metadataAuthority !== true) throw new Error('Graham schedule authority not operational');
  if (authority?.timezone !== 'America/Vancouver') throw new Error('Graham schedule timezone must be America/Vancouver');
  if (authority?.timingMode !== 'exact_schedule') throw new Error('Graham schedule timingMode must be exact_schedule');
  if (!Array.isArray(authority?.tasks)) throw new Error('Graham schedule tasks missing');

  const required = ['WEEK_ROLLOVER', 'TUESDAY_BASELINE', 'DAILY_REVIEW', 'DELTA_1645', 'SUNDAY_PREGAME'];
  const seen = new Set();
  for (const task of authority.tasks) {
    if (!task?.taskKey || seen.has(task.taskKey)) throw new Error(`Duplicate or missing Graham taskKey: ${task?.taskKey}`);
    seen.add(task.taskKey);
    if (!task.title || !Array.isArray(task.days) || task.days.length === 0) throw new Error(`Incomplete Graham schedule task ${task.taskKey}`);
    if (!/^\d{2}:\d{2}$/.test(task.time || '')) throw new Error(`Invalid Graham schedule time ${task.taskKey}`);
    if (!/^FREQ=WEEKLY;/.test(task.rrule || '')) throw new Error(`Invalid Graham schedule RRULE ${task.taskKey}`);
  }
  for (const key of required) if (!seen.has(key)) throw new Error(`Required Graham schedule task missing: ${key}`);
  if (seen.size !== required.length) throw new Error('Unexpected Graham schedule task found; update authority contract deliberately');
  return true;
}

function requireTask(authority, key) {
  const task = taskMap(authority).get(key);
  if (!task) throw new Error(`Graham schedule task missing: ${key}`);
  return task;
}

export function buildResearchCadenceProjection(authority) {
  const baseline = requireTask(authority, 'TUESDAY_BASELINE');
  const daily = requireTask(authority, 'DAILY_REVIEW');
  const delta = requireTask(authority, 'DELTA_1645');
  const sunday = requireTask(authority, 'SUNDAY_PREGAME');
  return {
    tuesdayBaseline: `${baseline.time} PT Tuesday full 32-team weekly review after Monday Night Football`,
    wednesdayFriday: `${daily.time} PT Monday/Wednesday/Thursday/Friday/Saturday main information review`,
    saturday: `${daily.time} PT Saturday review is included in Graham Daily Review; no separate active Saturday task`,
    sunday: `${sunday.time} PT Sunday pregame information review`,
    pre315Delta: `${delta.time} PT Tuesday through Saturday late-day change-only delta review`
  };
}

export function buildScheduleAuthorityMetadata(authority) {
  return {
    schema: 1,
    authorityId: authority.authorityId,
    state: 'SYNCHRONIZED',
    manifestPath: GRAHAM_SCHEDULE_MANIFEST,
    timezone: authority.timezone,
    timingMode: authority.timingMode,
    executionAuthority: authority.executionAuthority,
    tasks: authority.tasks.map(({ taskKey, title, days, time, rrule, purpose }) => ({ taskKey, title, days, time, rrule, purpose }))
  };
}

export function synchronizeGrahamScheduleMetadata(board, authority) {
  if (!board || typeof board !== 'object') throw new Error('Graham board object required');
  const expectedAuthority = buildScheduleAuthorityMetadata(authority);
  const expectedCadence = buildResearchCadenceProjection(authority);
  const changed = !same(board.scheduleAuthority, expectedAuthority) || !same(board.researchCadence, expectedCadence);
  board.scheduleAuthority = expectedAuthority;
  board.researchCadence = expectedCadence;
  return changed;
}

export function validateGrahamBoardScheduleMetadata(board, authority) {
  const expectedAuthority = buildScheduleAuthorityMetadata(authority);
  const expectedCadence = buildResearchCadenceProjection(authority);
  if (!same(board?.scheduleAuthority, expectedAuthority)) throw new Error('Graham board scheduleAuthority is not synchronized to controlled manifest');
  if (!same(board?.researchCadence, expectedCadence)) throw new Error('Graham board researchCadence projection is not synchronized to controlled manifest');
  return true;
}

function parseArgs(argv) {
  const args = { write: false, manifestOnly: false, file: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') args.write = true;
    else if (arg === '--manifest') args.manifestOnly = true;
    else if (arg === '--path') args.file = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const authority = loadGrahamScheduleAuthority();
  if (args.manifestOnly) {
    console.log(`GRAHAM SCHEDULE AUTHORITY: PASS // ${authority.authorityId} // ${authority.timezone} // ${authority.tasks.length} TASKS`);
    return;
  }

  const active = resolveGrahamActiveWeek();
  const file = args.file || active.paths.currentNumbers;
  const absolute = path.isAbsolute(file) ? file : path.join(DEFAULT_ROOT, file);
  const board = readJson(absolute);
  if (Number(board.season) !== Number(active.season) || Number(board.week) !== Number(active.week)) {
    throw new Error(`Graham schedule metadata target ${board.season} W${board.week} does not match active ${active.season} W${active.week}`);
  }

  if (args.write) {
    const changed = synchronizeGrahamScheduleMetadata(board, authority);
    if (changed) fs.writeFileSync(absolute, `${JSON.stringify(board, null, 2)}\n`);
  }

  validateGrahamBoardScheduleMetadata(readJson(absolute), authority);
  console.log(`GRAHAM SCHEDULE METADATA: PASS // ACTIVE ${active.season} W${active.weekToken} // ${authority.authorityId}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
