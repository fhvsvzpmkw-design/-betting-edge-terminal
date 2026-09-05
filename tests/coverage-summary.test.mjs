import assert from 'node:assert/strict';
import {validateVisibleCoverageSummary} from '../tools/major-sport-market-coverage-gate.mjs';

const audit = {totals: {primaryEvaluated: 110, primaryUnavailable: 136}};
const old = {ts: '2026-09-05T15:26:00-07:00', summary: 'Full-game primary markets covered.'};
assert.doesNotThrow(() => validateVisibleCoverageSummary(old, audit));
const current = {...old, ts: '2026-09-05T17:00:00-07:00'};
assert.throws(() => validateVisibleCoverageSummary(current, audit), /136 unavailable/);
assert.throws(() => validateVisibleCoverageSummary({...current, summary: 'Primary selections: 246 evaluated; 0 unavailable.'}, audit), /actual coverage limitation/);
assert.doesNotThrow(() => validateVisibleCoverageSummary({...current, summary: 'No BETs. Primary selections: 110 evaluated; 136 unavailable. Player-prop analysis paused.'}, audit));
assert.doesNotThrow(() => validateVisibleCoverageSummary(current, {totals: {primaryEvaluated: 12, primaryUnavailable: 0}}));
assert.throws(() => validateVisibleCoverageSummary(current, {totals: {primaryEvaluated: 110, primaryUnavailable: -1}}), /non-negative integer/);
console.log('Coverage summary regression: historical report preserved; current missing/misleading counts rejected; exact limitations accepted.');
