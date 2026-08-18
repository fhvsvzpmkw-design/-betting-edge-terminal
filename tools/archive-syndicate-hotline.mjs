#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'data/syndicates.json');

function die(message) { throw new Error(message); }
function assert(condition, message) { if (!condition) die(message); }
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { die(`Cannot parse JSON ${file}: ${error.message}`); }
}
function jsonText(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function repoRel(value) {
  const rel = String(value || '').replace(/^\.\//, '').split('?')[0].replaceAll('\\', '/');
  assert(rel && !rel.startsWith('/') && !rel.split('/').includes('..'), `Unsafe repository path: ${value}`);
  return rel;
}
function args(argv) {
  const out = { character: null, session: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--character' || token === '-c') out.character = String(argv[++i] || '').trim() || null;
    else if (token === '--session') out.session = String(argv[++i] || '').replace(':', '').trim() || null;
    else if (token === '--dry-run') out.dryRun = true;
    else die(`Unknown argument: ${token}`);
  }
  assert(out.character, 'Usage: node tools/archive-syndicate-hotline.mjs --character <stable-character-id> [--session HHMM] [--dry-run]');
  return out;
}
function sessionCode(label, timestamp, override) {
  if (override) {
    assert(/^\d{4}$/.test(override), '--session must be HHMM, for example 0930');
    return override;
  }
  const labelMatch = String(label || '').match(/\b(\d{1,2}):(\d{2})\b/);
  if (labelMatch) return `${labelMatch[1].padStart(2, '0')}${labelMatch[2]}`;
  const tsMatch = String(timestamp || '').match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):\d{2}/);
  assert(tsMatch, `Cannot derive archive session from label/timestamp: ${label} / ${timestamp}`);
  return `${tsMatch[1]}${tsMatch[2]}`;
}
function reportPath(lastReportSeen) {
  const ts = String(lastReportSeen.timestamp || '');
  const match = ts.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  assert(match, `continuity.lastReportSeen.timestamp is invalid: ${ts}`);
  assert(lastReportSeen.slot, 'continuity.lastReportSeen.slot is required');
  return `data/history/runs/${match[1]}/${lastReportSeen.slot}-${match[2]}${match[3]}${match[4]}.json`;
}
function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, text, 'utf8');
  fs.renameSync(temp, file);
}
function immutableCopy(source, target) {
  const content = fs.readFileSync(source, 'utf8');
  if (fs.existsSync(target)) {
    assert(fs.readFileSync(target, 'utf8') === content, `Archive issue already exists with different content: ${path.relative(ROOT, target)}`);
    return false;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  return true;
}

const opt = args(process.argv.slice(2));
const manifest = readJson(MANIFEST_PATH);
const roster = (manifest.profiles || []).find((item) => item.characterId === opt.character || item.id === opt.character);
assert(roster, `No Syndicate profile found for character: ${opt.character}`);
assert(roster.characterFile, `Profile ${roster.id} has no characterFile`);
assert(roster.url, `Profile ${roster.id} has no live Hotline url`);

const characterPath = repoRel(roster.characterFile);
const character = readJson(path.join(ROOT, characterPath));
assert(character.id, `Character profile has no stable id: ${characterPath}`);
assert(roster.characterId === character.id, `Roster characterId (${roster.characterId}) does not match character id (${character.id})`);

const last = character.continuity?.lastReportSeen;
assert(last && last.timestamp && last.label && last.slot, `Character ${character.id} has no complete continuity.lastReportSeen to archive`);
const date = String(last.timestamp).slice(0, 10);
assert(/^\d{4}-\d{2}-\d{2}$/.test(date), `Invalid archive date from ${last.timestamp}`);
const session = sessionCode(last.label, last.timestamp, opt.session);
const liveRel = repoRel(roster.url);
const liveAbs = path.join(ROOT, liveRel);
assert(fs.existsSync(liveAbs), `Live Hotline is missing: ${liveRel}`);

const archiveRootRel = `${path.posix.dirname(liveRel)}/archive`;
const archiveRel = `${archiveRootRel}/${date}/${session}.html`;
const indexRel = `${archiveRootRel}/index.json`;
const archiveAbs = path.join(ROOT, archiveRel);
const indexAbs = path.join(ROOT, indexRel);
const sourceReport = reportPath(last);
assert(fs.existsSync(path.join(ROOT, sourceReport)), `Authoritative source report is missing: ${sourceReport}`);

const issue = {
  id: `${date}T${session}|${character.id}`,
  characterId: character.id,
  profileId: character.profileId,
  displayName: character.displayName,
  publication: character.publication,
  date,
  session,
  label: last.label,
  issuedAt: last.timestamp,
  sourceReport,
  path: `${date}/${session}.html`
};

const index = fs.existsSync(indexAbs)
  ? readJson(indexAbs)
  : { schema: 1, characterId: character.id, issues: [] };
assert(index.schema === 1, `Unsupported Hotline archive index schema: ${index.schema}`);
assert(index.characterId === character.id, `Archive index belongs to ${index.characterId}, not ${character.id}`);
assert(Array.isArray(index.issues), 'Hotline archive index must contain an issues array');

const samePath = index.issues.find((item) => item.path === issue.path);
const sameId = index.issues.find((item) => item.id === issue.id);
if (samePath || sameId) {
  const existing = samePath || sameId;
  assert(JSON.stringify(existing) === JSON.stringify(issue), `Archive index already contains a conflicting issue for ${issue.path}`);
} else {
  index.issues.push(issue);
  index.issues.sort((a, b) => String(a.issuedAt).localeCompare(String(b.issuedAt)));
}
index.updatedAt = index.issues.at(-1)?.issuedAt || null;

if (opt.dryRun) {
  process.stdout.write(`${JSON.stringify({ live: liveRel, archive: archiveRel, index: indexRel, issue }, null, 2)}\n`);
  process.exit(0);
}

const copied = immutableCopy(liveAbs, archiveAbs);
writeAtomic(indexAbs, jsonText(index));
process.stdout.write(`${copied ? 'Archived' : 'Verified'} ${character.displayName} ${last.label}\n`);
process.stdout.write(`Issue: ${archiveRel}\n`);
process.stdout.write(`Index: ${indexRel}\n`);
process.stdout.write(`Stable character id: ${character.id}\n`);
