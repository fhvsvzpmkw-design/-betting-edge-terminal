import fs from 'node:fs';

const HISTORY_PATH = 'run-history.json';
const OUTPUT_PATH = 'data/pizza-plays.json';
const ACTIVE = new Set(['BET', 'LEAN', 'WAIT']);
const STATUS_WEIGHT = { BET: 300, LEAN: 200, WAIT: 100 };

function text(value, fallback = '') {
  const s = String(value ?? '').trim();
  return s || fallback;
}

function edgePct(rec) {
  const match = text(rec?.edge).replace(/−/g, '-').match(/([+-]?\d+(?:\.\d+)?)\s*%\s*EV/i);
  return match ? Number(match[1]) : 0;
}

function cardScore(rec, index) {
  const status = text(rec?.status).toUpperCase();
  return (STATUS_WEIGHT[status] || 0) + edgePct(rec) - index / 1000;
}

function chooseCard(report) {
  const ranked = (Array.isArray(report?.recs) ? report.recs : [])
    .map((rec, index) => ({ rec, index, status: text(rec?.status).toUpperCase(), score: cardScore(rec, index), edgePct: edgePct(rec) }))
    .filter(item => ACTIVE.has(item.status))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0] || null;
}

function louRead(item) {
  const rec = item.rec;
  const support = text(rec?.support, 'The card remains live on the current VigScope report.');
  if (item.status === 'BET') return `Lou takes the issued VigScope BET as his one slice. ${support}`;
  if (item.status === 'LEAN') return `Lou pushes the strongest VigScope LEAN onto the orange board as his one personal play. ${support}`;
  return `Lou is compelled by the strongest live VigScope value shape and makes it his one Pizza Play. VigScope itself remains WAIT; the orange board does not upgrade the source status. ${support}`;
}

function buildFromReport(report, reportPath) {
  const item = chooseCard(report);
  const base = {
    schema: 3,
    title: 'Pizza Plays',
    description: "Lou Two Slice's single compelled play from the current VigScope cards.",
    timezone: 'America/Vancouver',
    persona: { id: 'lou-two-slice', name: 'Lou Two Slice', rule: 'One play only.' },
    source: {
      type: 'BETTING_EDGE_REPORT',
      reportPath,
      slot: report?.slot || null,
      reportLabel: report?.label || null,
      reportTs: report?.ts || null,
      feedGeneratedAt: report?.feedGeneratedAt || null
    },
    generatedAt: report?.ts || null,
    selectionRule: {
      oneCardOnly: true,
      excludedStatuses: ['PASS'],
      statusPriority: ['BET', 'LEAN', 'WAIT'],
      withinStatus: 'Higher published EV first; issued report order breaks ties.',
      note: 'Pizza Plays is a Lou Two Slice overlay. It never changes the VigScope status, stake, target price, fair value, or ledger.'
    }
  };

  if (!item) {
    return {
      ...base,
      status: 'NO_PLAY',
      play: null,
      reason: 'Every current VigScope card is PASS or the report contains no live card.'
    };
  }

  const rec = item.rec;
  const status = item.status;
  const why = `Highest-ranked live VigScope card after Lou's status-and-edge sort. ${text(rec?.support, 'The card remains live on the current report.')}`;
  const edgeRead = [text(rec?.fair), text(rec?.edge)].filter(Boolean).join(' // ');
  const watchOut = [text(rec?.contrary), text(rec?.analysis)].filter(Boolean).join(' ');

  return {
    ...base,
    status: 'PLAY',
    play: {
      status: 'PLAY',
      vigScopeStatus: status,
      sourceOrdinal: item.index + 1,
      score: Number(item.score.toFixed(3)),
      publishedEdgePct: item.edgePct,
      title: text(rec?.title, 'UNTITLED VIGSCOPE CARD'),
      meta: text(rec?.meta),
      book: text(rec?.book, '—'),
      price: text(rec?.price, '—'),
      targetPrice: text(rec?.playTo, '—'),
      fair: text(rec?.fair, '—'),
      edge: text(rec?.edge, '—'),
      movement: text(rec?.move),
      sourceStake: text(rec?.stake, '$0'),
      whyThisOne: why,
      edgeRead: edgeRead || 'No published fair-value note.',
      lousRead: louRead(item),
      watchOut: watchOut || 'No additional caution was published on the source card.',
      vigScopeNote: text(rec?.analysis, `${status} on the source VigScope card.`),
      sourceNote: text(rec?.source),
      historyNote: text(rec?.hist),
      feed: rec?.feed || null
    }
  };
}

function latestReportPath() {
  if (!fs.existsSync(HISTORY_PATH)) throw new Error(`${HISTORY_PATH} is missing`);
  const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  const runs = Array.isArray(history) ? history : Array.isArray(history?.runs) ? history.runs : [];
  const candidates = runs
    .filter(run => run?.path && fs.existsSync(run.path))
    .sort((a, b) => Date.parse(b?.ts || 0) - Date.parse(a?.ts || 0));
  if (!candidates.length) throw new Error('No published Betting Edge report was found in run-history.json');
  return candidates[0].path;
}

function validate(output) {
  if (output?.schema !== 3 || output?.title !== 'Pizza Plays') throw new Error('Pizza output schema/title invalid');
  if (!['PLAY', 'NO_PLAY'].includes(output?.status)) throw new Error('Pizza output status invalid');
  if (output.status === 'PLAY') {
    if (!output?.play?.title || !ACTIVE.has(String(output?.play?.vigScopeStatus || '').toUpperCase())) throw new Error('Pizza play is not tied to a live VigScope card');
  }
  return output;
}

function selfTest() {
  const fixture = {
    slot: 'test', label: 'TEST', ts: '2026-08-24T10:00:00-07:00', feedGeneratedAt: '2026-08-24T16:59:00Z',
    recs: [
      { status: 'WAIT', title: 'Card A', edge: '+4.0% EV', support: 'A support.' },
      { status: 'WAIT', title: 'Card B', edge: '+7.5% EV', support: 'B support.' },
      { status: 'PASS', title: 'Card C', edge: '+20.0% EV' }
    ]
  };
  const output = validate(buildFromReport(fixture, 'fixture.json'));
  if (output.play.title !== 'Card B' || output.play.vigScopeStatus !== 'WAIT') throw new Error('Pizza self-test ranking failed');
  console.log('Pizza Plays self-test OK');
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  selfTest();
} else if (args.includes('--check')) {
  validate(JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')));
  console.log('Pizza Plays output validation OK');
} else {
  const reportFlag = args.indexOf('--report');
  const reportPath = reportFlag >= 0 && args[reportFlag + 1] ? args[reportFlag + 1] : latestReportPath();
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const output = validate(buildFromReport(report, reportPath));
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`Pizza Plays built from ${reportPath}: ${output.status}${output.play ? ` // ${output.play.title}` : ''}`);
}
