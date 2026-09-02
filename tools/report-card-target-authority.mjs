#!/usr/bin/env node
import fs from 'node:fs';

const PREFS = 'data/preferences.json';
const CONTRACT = 'BETTING_EDGE_CONTRACT.md';
const REPORT_AUTHORITY = 'BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md';

function fail(message) {
  throw new Error(message);
}

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

function loadTarget() {
  const prefs = JSON.parse(read(PREFS));
  const module = (prefs.modules || []).find(item => item?.id === 'report_card_target');
  if (!module) fail('report_card_target preference is missing');
  if (!Number.isInteger(module.current)) fail('report_card_target.current must be an integer');
  if (!Array.isArray(module.profiles) || !module.profiles.includes(module.current)) {
    fail('report_card_target.current must be one of the declared profiles');
  }
  if (module.overflowProtection !== true) fail('report_card_target overflowProtection must remain true');
  return { prefs, module };
}

function syncPreferences(prefs, module) {
  const expected = `CURRENT: ${module.current} CARDS · STATUS PROFILES: ${module.profiles.join(' / ')} · OVERFLOW PROTECTION: ON`;
  if (module.summary === expected) return false;
  module.summary = expected;
  write(PREFS, JSON.stringify(prefs, null, 2));
  return true;
}

function normalizeContract(text) {
  return text.replace(
    /The current repository setting is \*\*\d+ cards\*\*\./,
    "The live production target is the module's `current` value; this contract does not hard-code a second current target."
  );
}

function normalizeReportAuthority(text) {
  return text
    .replace(
      /The current target of (?:seven|nine|twelve|\d+) is \*\*soft\*\*, not a hard ceiling\./i,
      'The repository-selected `report_card_target.current` value is **soft**, not a hard ceiling.'
    )
    .replace(
      /may not be discarded merely to keep nine cards\./i,
      'may not be discarded merely to enforce the soft target.'
    );
}

function sync() {
  const { prefs, module } = loadTarget();
  let changed = syncPreferences(prefs, module);

  const contractBefore = read(CONTRACT);
  const contractAfter = normalizeContract(contractBefore);
  if (contractAfter !== contractBefore) {
    write(CONTRACT, contractAfter);
    changed = true;
  }

  const authorityBefore = read(REPORT_AUTHORITY);
  const authorityAfter = normalizeReportAuthority(authorityBefore);
  if (authorityAfter !== authorityBefore) {
    write(REPORT_AUTHORITY, authorityAfter);
    changed = true;
  }

  console.log(`REPORT CARD TARGET SYNC ${changed ? 'UPDATED' : 'NO_CHANGE'} current=${module.current}`);
}

function check() {
  const { module } = loadTarget();
  const expectedSummary = `CURRENT: ${module.current} CARDS · STATUS PROFILES: ${module.profiles.join(' / ')} · OVERFLOW PROTECTION: ON`;
  if (module.summary !== expectedSummary) fail('report_card_target summary is out of sync with current/profile values');

  const contract = read(CONTRACT);
  if (/The current repository setting is \*\*\d+ cards\*\*\./.test(contract)) {
    fail('production contract hard-codes a duplicate current report-card target');
  }
  if (!contract.includes("The live production target is the module's `current` value")) {
    fail('production contract is missing repository-controlled live target wording');
  }

  const reportAuthority = read(REPORT_AUTHORITY);
  if (/The current target of (?:seven|nine|twelve|\d+) is \*\*soft\*\*, not a hard ceiling\./i.test(reportAuthority)) {
    fail('scheduled-report authority hard-codes a duplicate current report-card target');
  }
  if (/may not be discarded merely to keep nine cards\./i.test(reportAuthority)) {
    fail('scheduled-report authority still contains stale nine-card enforcement wording');
  }
  if (!reportAuthority.includes('The repository-selected `report_card_target.current` value is **soft**, not a hard ceiling.')) {
    fail('scheduled-report authority is missing repository-controlled target wording');
  }

  console.log(`REPORT CARD TARGET AUTHORITY OK current=${module.current} overflow=true`);
}

const mode = process.argv[2] || '--check';
try {
  if (mode === '--sync') sync();
  else if (mode === '--check') check();
  else fail('Usage: report-card-target-authority.mjs --sync|--check');
} catch (error) {
  console.error(`REPORT CARD TARGET AUTHORITY ERROR: ${error.message}`);
  process.exit(1);
}
