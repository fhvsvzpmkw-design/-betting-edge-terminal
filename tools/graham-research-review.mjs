import fs from 'node:fs';
import path from 'node:path';

// INFO describes completed research, independently of when a fair last changed.
// Join the existing durable completion record to its exact active-week sweep.
export function selectCompletedResearchReview({active, ledger, events}) {
  if (ledger.state !== 'ACTIVE' || Number(ledger.season) !== active.season || Number(ledger.week) !== active.week) return null;
  const reviews = [];
  for (const event of events) {
    const receipt = event.completionReceipt;
    if (event.schema !== 1 || event.policyId !== 'graham-research-runtime-v1'
      || event.state !== 'COMPLETED' || event.checkpoint !== 'COMPLETED'
      || event.ledgerSweepPresent !== true || event.failure !== null || event.marketViewed !== false
      || Number(event.season) !== active.season || Number(event.week) !== active.week
      || event.ledgerPath !== active.paths.researchLedger
      || !['TUESDAY_BASELINE', 'DAILY_REVIEW', 'DELTA_1645', 'SUNDAY_PREGAME'].includes(event.taskKey)
      || !['MATERIAL_CHANGE', 'NO_MATERIAL_CHANGE'].includes(event.completionResult)
      || !receipt || receipt.state !== 'VERIFIED' || receipt.policyId !== 'graham-research-completion-v1'
      || receipt.path !== 'data/walters/nfl/research-completion-current.json'
      || receipt.runEventId !== event.runEventId || receipt.taskKey !== event.taskKey
      || Number(receipt.season) !== active.season || Number(receipt.week) !== active.week
      || receipt.completionResult !== event.completionResult || receipt.marketViewed !== false
      || !/^[0-9a-f]{40}$/.test(receipt.ledgerBlobSha) || !/^[0-9a-f]{40}$/.test(receipt.receiptBlobSha)) continue;

    const matches = (ledger.sweeps || []).filter(sweep => sweep.runEventId === event.runEventId);
    if (matches.length !== 1) continue;
    const sweep = matches[0];
    if (sweep.sourceTaskKey !== event.taskKey || sweep.completionResult !== event.completionResult
      || sweep.startedAt !== event.startedAt || sweep.summary?.marketViewed !== false) continue;
    const times = [event.startedAt, sweep.completedAt, receipt.verifiedAt, event.completedAt].map(Date.parse);
    if (times.some(time => !Number.isFinite(time)) || times.some((time, index) => index > 0 && time < times[index - 1])) continue;
    reviews.push({runEventId: event.runEventId, taskKey: event.taskKey, completedAt: sweep.completedAt, scope: sweep.scope || null});
  }
  return reviews.sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0] || null;
}

export function loadCompletedResearchReview({active, root = process.cwd()}) {
  const ledger = JSON.parse(fs.readFileSync(active.absolutePaths.researchLedger, 'utf8'));
  const directory = path.join(root, active.paths.researchLedger.replace(/-research-ledger\.json$/, '-research-runtime'));
  const events = fs.existsSync(directory)
    ? fs.readdirSync(directory).filter(name => name.endsWith('.json')).map(name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')))
    : [];
  return selectCompletedResearchReview({active, ledger, events});
}
