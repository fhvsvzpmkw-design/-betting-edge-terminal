const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'betting-edge-spread-sign-'));
const issuedPath = path.join(tmp, 'issued.json');
const verificationPath = path.join(tmp, 'verification.json');
const outputPath = path.join(tmp, 'observations.json');

// Odds-API.io spread hdp is the HOME-side handicap. Washington -11.5
// therefore means the away selection Toronto is +11.5.
fs.writeFileSync(issuedPath, JSON.stringify({
  slot: 'open',
  ts: '2026-08-19T06:02:23-07:00',
  feedGeneratedAt: '2026-08-19T12:53:12.320Z',
  recs: [{
    status: 'PASS',
    title: 'Toronto Tempo +11.5',
    book: 'Bet365',
    price: '+11.5 -116',
    feed: {
      eventId: '68096572',
      market: 'Spread',
      marketKey: 'spread',
      side: 'away',
      hdp: -11.5,
      selectionKey: '68096572|spread|away||-11.5',
      eventDate: '2026-08-19T23:30:00Z'
    }
  }]
}, null, 2));

fs.writeFileSync(verificationPath, JSON.stringify({
  verifiedAt: '2026-08-20T12:00:00Z',
  events: [{
    eventId: '68096572',
    status: 'final',
    home: 'Washington Mystics',
    away: 'Toronto Tempo',
    homeScore: 90,
    awayScore: 80,
    source: { name: 'test fixture', url: 'https://example.invalid/' }
  }]
}, null, 2));

const run = spawnSync(process.execPath, [
  path.join(repo, 'tools/verify-issued-results.mjs'),
  issuedPath,
  verificationPath,
  '--output',
  outputPath
], { cwd: repo, encoding: 'utf8' });

assert.equal(run.status, 0, run.stderr || run.stdout);
const result = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
const completion = result.recommendations[0].completion;
assert.equal(completion.state, 'complete');
assert.equal(completion.grade, 'WIN');
assert.equal(completion.line, 11.5);
assert.equal(completion.hypothetical, true);
assert.match(result.resultMethod.spreadHdpSemantics, /away selected handicap is the opposite sign/);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('verify-issued-results away spread sign: PASS');
