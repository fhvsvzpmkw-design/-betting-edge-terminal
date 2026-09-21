import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const CORE_V15_FROM = Date.parse('2026-09-21T06:00:00-07:00');
export const CORE_V15_PATH = 'core/core-v1.5-production.json';
export function resolveCoreRelease(root, reportTs) {
  const ts = Date.parse(reportTs);
  if (!Number.isFinite(ts)) throw new Error('Core release requires a valid report timestamp');
  const current = ts >= CORE_V15_FROM;
  const coreVersion = current ? '1.5' : '1.4';
  const coreProductionPath = current ? CORE_V15_PATH : 'core/core-v1.4-production.json';
  const file = path.join(root, coreProductionPath);
  const bytes = fs.readFileSync(file), manifest = JSON.parse(bytes);
  if (manifest.schema !== 1 || manifest.state !== 'OPERATIONAL' || manifest.coreVersion !== coreVersion)
    throw new Error('Core release manifest authority conflict');
  if (current) {
    if (Date.parse(manifest.activatedAt) !== CORE_V15_FROM) throw new Error('Core 1.5 cutover drift');
    const baseline = JSON.parse(fs.readFileSync(path.join(root, 'core/core-v1.4-production.json')));
    for (const key of ['modelErrorFramework', 'liquidityClassification', 'researchLibrary', 'walters', 'personnel', 'sharpMarketBenchmark', 'unchanged', 'explicitlyDeferred']) {
      if (JSON.stringify(manifest[key]) !== JSON.stringify(baseline[key])) throw new Error('Core 1.5 component drift: ' + key);
    }
    if (manifest.operatingContractPath !== 'core/CORE_V1_5_OPERATING_CONTRACT.md' || !fs.existsSync(path.join(root, manifest.operatingContractPath)))
      throw new Error('Core 1.5 operating contract missing');
  }
  const coreProductionBlobSha = crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
  return {coreVersion, coreProductionPath, coreProductionBlobSha};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(resolveCoreRelease(process.cwd(), process.argv[2]), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
