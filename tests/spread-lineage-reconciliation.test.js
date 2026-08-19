const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tool = path.join(__dirname, '..', 'tools', 'spread-lineage.mjs');
const run = spawnSync(process.execPath, [tool, 'self-test'], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8'
});

assert.equal(run.status, 0, run.stderr || run.stdout);
assert.match(run.stdout, /SPREAD LINEAGE SELF-TEST OK/);
console.log('spread-lineage reconciliation regression: PASS');
