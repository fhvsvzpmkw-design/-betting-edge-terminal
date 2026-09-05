#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOTAL_LINEAGE_FROM, lineageApplies, lineageEventSide, lineMovement, priceMovement, primaryLineQuote, auditPrimaryLineage } from './primary-lineage.mjs';

export { TOTAL_LINEAGE_FROM };
export const totalLineageApplies = report => lineageApplies(report, 'totals');
export const totalEventSide = rec => lineageEventSide(rec, 'totals');
export const totalMovement = (side, prior, current) => lineMovement(side, prior, current, 'totals');
export const totalPriceMovement = priceMovement;
export const primaryTotal = (event, book, side, generatedAt) => primaryLineQuote(event, book, side, generatedAt, 'totals');
export const auditTotalLineage = args => auditPrimaryLineage(args, 'totals');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function ensure(condition, message) { if (!condition) throw new Error(message); }

function main() {
  const [command, ...tokens] = process.argv.slice(2), args = {};
  ensure(command === 'audit', 'Usage: total-lineage.mjs audit --report FILE [--sidecar FILE] [--feed FILE] [--root DIR]');
  for (let i = 0; i < tokens.length; i += 2) {
    ensure(tokens[i].startsWith('--') && tokens[i + 1], 'Invalid command argument');
    args[tokens[i].slice(2)] = tokens[i + 1];
  }
  ensure(args.report, 'audit requires --report FILE');
  const result = auditTotalLineage({ root: path.resolve(args.root || process.cwd()), report: readJson(path.resolve(args.report)),
    sidecar: args.sidecar ? readJson(path.resolve(args.sidecar)) : null, feedFile: args.feed || null });
  for (const item of result.diagnostics) console.log('TOTAL LINEAGE ' + JSON.stringify(item));
  ensure(result.ok, result.violations.join('; '));
  console.log('TOTAL LINEAGE AUDIT OK ' + result.diagnostics.length + ' reconciliation(s)' + (result.enforced ? '' : ' — pre-cutover'));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error('TOTAL LINEAGE ERROR: ' + error.message); process.exit(1); }
}
