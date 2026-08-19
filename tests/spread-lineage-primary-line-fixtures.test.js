const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const tool = path.join(repo, 'tools', 'spread-lineage.mjs');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'spread-lineage-primary-lines.json'), 'utf8'));

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

for (const testCase of fixture.cases) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'betting-edge-primary-line-'));
  try {
    const priorPath = 'data/history/runs/2026-08-19/main-080000.json';
    writeJson(path.join(root, 'run-history.json'), {
      runs: [{ date: '2026-08-19', ts: '2026-08-19T08:00:00-07:00', slot: 'main', path: priorPath }]
    });
    writeJson(path.join(root, priorPath), {
      slot: 'main',
      ts: '2026-08-19T08:00:00-07:00',
      feedGeneratedAt: '2026-08-19T14:55:00Z',
      recs: [{
        status: 'WAIT',
        title: 'Toronto Tempo +11.5',
        feed: {
          eventId: String(testCase.eventId || 68096572),
          marketKey: 'spread',
          market: 'Spread',
          side: testCase.side || 'away',
          hdp: -11.5,
          selectionKey: `${testCase.eventId || 68096572}|spread|${testCase.side || 'away'}||-11.5`,
          eventDate: '2026-08-19T23:30:00Z'
        }
      }]
    });

    const book = testCase.book || 'Bet365';
    const feed = {
      generatedAt: testCase.generatedAt,
      events: [{
        id: testCase.eventId || 68096572,
        home: testCase.home || 'Washington Mystics',
        away: testCase.away || 'Toronto Tempo',
        bookmakers: {
          [book]: [{
            name: 'Spread',
            marketKey: 'spread',
            updatedAt: testCase.marketUpdatedAt,
            odds: testCase.rows
          }, ...(testCase.extraMarkets || [])]
        }
      }]
    };

    let currentRec;
    if (testCase.expected.state === 'OK') {
      currentRec = {
        status: 'WAIT',
        title: `Toronto Tempo +${testCase.expected.displayLine}`,
        move: `LINE MOVED AGAINST — Toronto +11.5 -> +${testCase.expected.displayLine}; current line requires independent requalification`,
        stake: '$0',
        feed: {
          eventId: String(testCase.eventId || 68096572),
          marketKey: 'spread',
          market: 'Spread',
          side: testCase.side || 'away',
          hdp: testCase.expected.rawHdp,
          selectionKey: `${testCase.eventId || 68096572}|spread|${testCase.side || 'away'}||${testCase.expected.rawHdp}`,
          eventDate: '2026-08-19T23:30:00Z'
        }
      };
    } else {
      currentRec = {
        status: 'WAIT',
        title: 'Toronto Tempo +11.5',
        move: 'PRICE NOT VERIFIED — current primary spread is ambiguous',
        stake: '$0',
        feed: {
          eventId: String(testCase.eventId || 68096572),
          marketKey: 'spread',
          market: 'Spread',
          side: testCase.side || 'away',
          hdp: -11.5,
          selectionKey: `${testCase.eventId || 68096572}|spread|${testCase.side || 'away'}||-11.5`,
          eventDate: '2026-08-19T23:30:00Z'
        }
      };
    }

    const reportTs = new Date(Math.max(Date.parse('2026-08-19T08:01:00-07:00'), Date.parse(testCase.generatedAt) + 60000)).toISOString();
    const report = {
      slot: 'final_morning',
      label: 'SPREAD LINEAGE FIXTURE',
      ts: reportTs,
      feedGeneratedAt: testCase.generatedAt,
      recs: [currentRec]
    };
    const reportPath = path.join(root, 'current.json');
    const feedPath = path.join(root, 'feed.json');
    writeJson(reportPath, report);
    writeJson(feedPath, feed);

    const run = spawnSync(process.execPath, [tool, 'audit', '--root', root, '--report', reportPath, '--feed', feedPath], {
      cwd: repo,
      encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${testCase.name}: ${run.stderr || run.stdout}`);
    if (testCase.expected.state === 'OK') {
      assert.match(run.stdout, new RegExp(`LINE MOVED AGAINST.*${book} \\+${testCase.expected.displayLine}`), testCase.name);
    } else {
      assert.match(run.stdout, /PRIMARY_AMBIGUOUS/, testCase.name);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

console.log('spread-lineage primary-line fixtures: PASS');
