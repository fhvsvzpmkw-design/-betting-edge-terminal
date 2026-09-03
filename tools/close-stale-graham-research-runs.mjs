#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
};
const write = argv.includes('--write');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policyPath = path.resolve(
  ROOT,
  flag('--policy', 'data/walters/nfl/graham-research-runtime-policy-v1.json'),
);
const eventsRoot = path.resolve(ROOT, flag('--events-root', 'data/walters/nfl'));
const nowText = flag('--now', new Date().toISOString());
const now = Date.parse(nowText);

if (Number.isNaN(now)) throw new Error('GRAHAM_RESEARCH_RUNTIME_WATCHDOG_NOW_INVALID');
const policy = read(policyPath);
if (
  policy.schema !== 1 ||
  policy.state !== 'OPERATIONAL' ||
  policy.policyId !== 'graham-research-runtime-v1'
) {
  throw new Error('GRAHAM_RESEARCH_RUNTIME_POLICY_NOT_OPERATIONAL');
}

const eventFiles = [];
if (fs.existsSync(eventsRoot)) {
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (
        entry.isFile() &&
        entry.name.endsWith('.json') &&
        /week-\d{2}-research-runtime/.test(absolute.replaceAll('\\', '/'))
      ) {
        eventFiles.push(absolute);
      }
    }
  };
  walk(eventsRoot);
}

let closed = 0;
for (const file of eventFiles) {
  const event = read(file);
  if (event.state !== 'RUN_STARTED') continue;
  if (event.policyId !== policy.policyId) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_WATCHDOG_POLICY_MISMATCH:${file}`);
  }
  const staleAfter = Date.parse(event.staleAfter);
  if (Number.isNaN(staleAfter)) {
    throw new Error(`GRAHAM_RESEARCH_RUNTIME_WATCHDOG_STALE_AFTER_INVALID:${file}`);
  }
  if (now <= staleAfter) continue;

  const closedAt = new Date(now).toISOString();
  event.state = policy.watchdog.staleTerminalState;
  event.checkpoint = 'WATCHDOG_CLOSED';
  event.lastCheckpointAt = closedAt;
  event.blockedAt = closedAt;
  event.ledgerSweepPresent = false;
  event.completionResult = 'BLOCKED_WITH_DURABLE_RECORD';
  event.completionReceipt = null;
  event.failure = {
    phase: policy.watchdog.staleFailurePhase,
    code: policy.watchdog.staleFailureCode,
    summary:
      'No completed or controlled-failure checkpoint was recorded before staleAfter; the watchdog closed this run fail-closed.',
    automatic: true,
  };
  if (write) fs.writeFileSync(file, `${JSON.stringify(event, null, 2)}\n`);
  closed += 1;
  console.log(
    `GRAHAM RESEARCH RUNTIME WATCHDOG: ${write ? 'CLOSED' : 'WOULD_CLOSE'} // ${event.runEventId}`,
  );
}

console.log(
  `GRAHAM RESEARCH RUNTIME WATCHDOG: PASS // SCANNED=${eventFiles.length} // CLOSED=${closed} // WRITE=${write}`,
);
