import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  GRAHAM_SCHEDULE_AUTHORITY_ID,
  buildResearchCadenceProjection,
  buildScheduleAuthorityMetadata,
  loadGrahamScheduleAuthority,
  synchronizeGrahamScheduleMetadata,
  validateGrahamBoardScheduleMetadata
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
assert.equal(synchronizeGrahamScheduleMetadata(board, authority), false, 'second synchronization must be idempotent');
assert.equal(JSON.stringify(board.games), gamesBefore, 'idempotent schedule synchronization must preserve game state');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graham-schedule-authority-'));
try {
  fs.writeFileSync(path.join(tmp, 'projection.json'), `${JSON.stringify({ scheduleAuthority: board.scheduleAuthority, researchCadence: board.researchCadence }, null, 2)}\n`);
  assert.ok(fs.statSync(path.join(tmp, 'projection.json')).size > 0);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('GRAHAM SCHEDULE AUTHORITY TEST: PASS // SINGLE MANIFEST -> BOARD METADATA // GAME STATE PRESERVED');
