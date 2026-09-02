import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  GRAHAM_SCHEDULE_AUTHORITY_ID,
  buildResearchCadenceProjection,
  buildResearchLedgerCadenceProjection,
  buildScheduleAuthorityMetadata,
  loadGrahamScheduleAuthority,
  synchronizeGrahamResearchLedgerScheduleMetadata,
  synchronizeGrahamScheduleMetadata,
  validateGrahamBoardScheduleMetadata,
  validateGrahamResearchLedgerScheduleMetadata
} from '../tools/graham-schedule-authority.mjs';

const authority = loadGrahamScheduleAuthority();
assert.equal(authority.authorityId, GRAHAM_SCHEDULE_AUTHORITY_ID);
assert.equal(authority.state, 'OPERATIONAL');
assert.equal(authority.timezone, 'America/Vancouver');
assert.equal(authority.timingMode, 'exact_schedule');
assert.equal(authority.tasks.length, 5);

const byKey = new Map(authority.tasks.map(task => [task.taskKey, task]));
assert.deepEqual([...byKey.keys()].sort(), ['DAILY_REVIEW', 'DELTA_1645', 'SUNDAY_PREGAME', 'TUESDAY_BASELINE', 'WEEK_ROLLOVER'].sort());

// The repository owns only one set of times: the manifest. Every generated
// board view must project directly from those values rather than repeating
// independent hard-coded schedule constants.
const cadence = buildResearchCadenceProjection(authority);
assert.ok(cadence.tuesdayBaseline.startsWith(`${byKey.get('TUESDAY_BASELINE').time} PT`));
assert.ok(cadence.wednesdayFriday.startsWith(`${byKey.get('DAILY_REVIEW').time} PT`));
assert.ok(cadence.saturday.startsWith(`${byKey.get('DAILY_REVIEW').time} PT`));
assert.ok(cadence.sunday.startsWith(`${byKey.get('SUNDAY_PREGAME').time} PT`));
assert.ok(cadence.pre315Delta.startsWith(`${byKey.get('DELTA_1645').time} PT`));

const ledgerCadence = buildResearchLedgerCadenceProjection(authority);
assert.equal(ledgerCadence.find(x => x.type === 'FULL_WEEKLY_BASELINE')?.timePacific, byKey.get('TUESDAY_BASELINE').time);
assert.equal(ledgerCadence.find(x => x.type === 'MAIN_DAILY_SWEEP')?.timePacific, byKey.get('DAILY_REVIEW').time);
assert.equal(ledgerCadence.find(x => x.type === 'MAIN_WEEKEND_SWEEP')?.timePacific, byKey.get('DAILY_REVIEW').time);
assert.equal(ledgerCadence.find(x => x.type === 'PREGAME_SWEEP')?.timePacific, byKey.get('SUNDAY_PREGAME').time);
assert.equal(ledgerCadence.find(x => x.type === 'LATE_DAY_DELTA')?.timePacific, byKey.get('DELTA_1645').time);

const board = {
  schema: 1,
  season: 2026,
  week: 1,
  researchCadence: {
    tuesdayBaseline: 'STALE',
    wednesdayFriday: 'STALE',
    saturday: 'STALE',
    sunday: 'STALE',
    pre315Delta: 'STALE'
  },
  games: [
    {
      gameKey: 'TEST',
      grahamFairHome: -5.5,
      grahamExactFairHome: -5.582,
      neutralBaseHome: -4,
      adjustments: [{ type: 'HOME_FIELD', pointsToHomeSpread: -2.082 }, { type: 'PERSONNEL_CALIBRATED_PRODUCTION', pointsToHomeSpread: 0.5 }]
    }
  ]
};
const gamesBefore = JSON.stringify(board.games);
assert.equal(synchronizeGrahamScheduleMetadata(board, authority), true);
assert.equal(JSON.stringify(board.games), gamesBefore, 'schedule synchronization must not mutate game numbers or adjustments');
assert.deepEqual(board.scheduleAuthority, buildScheduleAuthorityMetadata(authority));
assert.deepEqual(board.researchCadence, cadence);
assert.equal(validateGrahamBoardScheduleMetadata(board, authority), true);
assert.equal(synchronizeGrahamScheduleMetadata(board, authority), false, 'second board synchronization must be idempotent');
assert.equal(JSON.stringify(board.games), gamesBefore, 'idempotent board synchronization must preserve game state');

const researchLedger = {
  schema: 1,
  season: 2026,
  week: 1,
  policy: { appendOnly: true },
  scheduledCadence: [
    { day: 'TUESDAY', timePacific: '10:30', type: 'FULL_WEEKLY_BASELINE', scope: 'STALE' },
    { day: 'TUESDAY-SATURDAY', timePacific: '14:45', type: 'PRE_1515_DELTA', scope: 'STALE' }
  ],
  sweeps: [
    {
      sequence: 7,
      type: 'TEST_NO_CHANGE',
      summary: { marketViewed: false, note: 'immutable research evidence' }
    }
  ]
};
const sweepsBefore = JSON.stringify(researchLedger.sweeps);
assert.equal(synchronizeGrahamResearchLedgerScheduleMetadata(researchLedger, authority), true);
assert.equal(JSON.stringify(researchLedger.sweeps), sweepsBefore, 'schedule synchronization must not mutate research sweeps');
assert.deepEqual(researchLedger.scheduleAuthority, buildScheduleAuthorityMetadata(authority));
assert.deepEqual(researchLedger.scheduledCadence, ledgerCadence);
assert.equal(validateGrahamResearchLedgerScheduleMetadata(researchLedger, authority), true);
assert.equal(synchronizeGrahamResearchLedgerScheduleMetadata(researchLedger, authority), false, 'second ledger synchronization must be idempotent');
assert.equal(JSON.stringify(researchLedger.sweeps), sweepsBefore, 'idempotent ledger synchronization must preserve research history');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graham-schedule-authority-'));
try {
  fs.writeFileSync(path.join(tmp, 'projection.json'), `${JSON.stringify({
    boardScheduleAuthority: board.scheduleAuthority,
    boardResearchCadence: board.researchCadence,
    ledgerScheduleAuthority: researchLedger.scheduleAuthority,
    ledgerScheduledCadence: researchLedger.scheduledCadence
  }, null, 2)}\n`);
  assert.ok(fs.statSync(path.join(tmp, 'projection.json')).size > 0);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('GRAHAM SCHEDULE AUTHORITY TEST: PASS // SINGLE MANIFEST -> BOARD + RESEARCH LEDGER // GAME + SWEEP STATE PRESERVED');
