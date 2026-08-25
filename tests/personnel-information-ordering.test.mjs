import fs from 'node:fs';

const contract = fs.readFileSync('BETTING_EDGE_CONTRACT.md', 'utf8');
const personnel = fs.readFileSync('BETTING_EDGE_PERSONNEL_SWEEP.md', 'utf8');
const provenance = fs.readFileSync('data/history/report-provenance-schema.json', 'utf8');

function requireText(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`${label} missing: ${needle}`);
}

function requireOrder(text, needles, label) {
  let previous = -1;
  for (const needle of needles) {
    const index = text.indexOf(needle);
    if (index < 0) throw new Error(`${label} missing: ${needle}`);
    if (index <= previous) throw new Error(`${label} out of order at: ${needle}`);
    previous = index;
  }
}

requireText(
  contract,
  'Personnel information is an input to fair value',
  'production contract personnel principle'
);
requireText(
  contract,
  'Betting Edge must not require a candidate to survive a pre-information value screen before personnel information is allowed to influence fair value.',
  'production contract anti-blind-screen rule'
);
requireOrder(
  contract,
  [
    '3. Stage 1 Material Information Scan over the eligible current slate',
    '4. provisional independent current handicap, fair-value construction and value screen using the Stage 1 information',
    '5. Stage 2 Deep Personnel Sweep for serious candidates',
    '6. apply material Stage 2 findings back into the current handicap',
    '7. Research Fit read-only pass'
  ],
  'production delivery sequence'
);

requireText(
  personnel,
  'before the provisional fair-value/value screen',
  'personnel Stage 1 timing'
);
requireText(
  personnel,
  'A market or selection that looked weak before Stage 1 must be admitted into the serious-candidate pool when newly identified personnel information plausibly creates or materially improves value.',
  'personnel candidate-creation rule'
);
requireOrder(
  personnel,
  [
    '## Stage 1 — Material Information Scan',
    '## Stage 2 — Deep Personnel Sweep',
    'The findings from Stage 2 must be applied back into the current handicap.'
  ],
  'personnel two-stage process'
);

requireText(
  personnel,
  'fallback sweep across 3 to 5 distinct credible current fallback sources, in addition to the official-source check',
  'Stage 2 fallback source-depth rule'
);
requireText(
  personnel,
  'If fewer than 3 credible current fallback sources can be found after a reasonable event-specific search, Stage 2 must record the source shortfall',
  'Stage 2 source-shortfall rule'
);
requireText(
  personnel,
  'Within 90 minutes of kickoff',
  'soccer Stage 2 timing escalation'
);
requireText(
  personnel,
  'Within 75 minutes of kickoff',
  'soccer authoritative-lineup recheck'
);
requireText(
  personnel,
  'record `NO MATERIAL CHANGE`',
  'Stage 2 explicit re-handicap result'
);

requireText(
  provenance,
  '"personnelEvidence"',
  'personnel provenance block'
);
requireText(
  provenance,
  '"fallbackSources"',
  'personnel fallback-source provenance'
);
requireText(
  provenance,
  '"sourceShortfall"',
  'personnel source-shortfall provenance'
);
requireText(
  provenance,
  '"preStage2Fair"',
  'personnel pre-Stage-2 fair provenance'
);
requireText(
  provenance,
  '"postStage2Fair"',
  'personnel post-Stage-2 fair provenance'
);
requireText(
  provenance,
  '"decisionImpact"',
  'personnel decision-impact provenance'
);

if (personnel.includes('survives the initial event/market/selection identity, price-freshness and value screen')) {
  throw new Error('Old post-value-only Personnel Sweep rule is still present');
}

console.log('BETTING EDGE PERSONNEL INFORMATION ORDERING + STAGE 2 DEPTH — PASS');
