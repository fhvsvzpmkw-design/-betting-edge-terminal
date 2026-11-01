import assert from 'node:assert/strict';
import fs from 'node:fs';

// GitHub's default permits only one pending run even with cancel-in-progress
// false. Distinct numerical producers must queue without replacing each other.
const writers = ['personnel-production','matchup-production','carried-rating-audit',
  'qb-performance-production','rating-base-refresh','fair-decomposition',
  'research-input','baseline-recovery'];
for (const name of writers) {
  const yaml=fs.readFileSync(`.github/workflows/graham-${name}.yml`,'utf8');
  const concurrency=yaml.match(/^concurrency:\n((?:[ \t]+.*\n)+)/m)?.[1];
  assert.ok(concurrency,`${name}: explicit serialization`);
  const group=name==='baseline-recovery'?'graham-baseline-recovery':'graham-personnel-production';
  assert.ok(concurrency.includes(`  group: ${group}\n`),name);
  assert.match(concurrency,/^  cancel-in-progress: false$/m,name);
  assert.match(concurrency,/^  queue: max$/m,`${name}: preserve queued producers`);
}
console.log(`GRAHAM PRODUCTION QUEUE: ${writers.length} writers retain pending work; baseline metadata cannot starve numerical reconciliation`);
