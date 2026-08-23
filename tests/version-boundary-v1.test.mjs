import fs from 'node:fs';

const contract=fs.readFileSync('BETTING_EDGE_CONTRACT.md','utf8');
const runner=fs.readFileSync('runner.html','utf8');
const core=fs.readFileSync('runner-core.html','utf8');
const manifest=JSON.parse(fs.readFileSync('research/manifest.json','utf8'));
const provenance=JSON.parse(fs.readFileSync('data/history/report-provenance-schema.json','utf8'));
const acceptance=fs.readFileSync('BETTING_EDGE_V1.0_ACCEPTANCE_2026-08-22.md','utf8');

if(!contract.includes('Contract version:** 1.0')) throw new Error('Contract is not v1.0');
if(!contract.includes('Document status:** OPERATIONAL')) throw new Error('Contract is not operational');
if(!contract.includes('VigScope outer runner v1.5 / Betting Edge core runner v1.3')) throw new Error('Contract runner boundary mismatch');
if(!runner.includes('name="vigscope-ui-version" content="1.5"')) throw new Error('Runner meta is not v1.5');
if(!runner.includes("const UI_VERSION='1.5'")) throw new Error('Runner runtime is not v1.5');
if(!/v1\.3/i.test(core)) throw new Error('Report core no longer identifies as v1.3');
if(manifest.activeLibraryVersion!=='1.7') throw new Error('Research Library version changed unexpectedly');
if(manifest.contractCompatibility?.productionVersion!=='1.0') throw new Error('Research manifest contract compatibility mismatch');
if(manifest.contractCompatibility?.productionContractBlobShaAtActivation!=='815a511301bd7a5aa3770baf0e32a00a28e2f548') throw new Error('Research manifest contract blob mismatch');
if(provenance.schema!==3) throw new Error('Provenance schema changed unexpectedly');
if(!provenance.provenance?.fields?.productionContractVersion?.includes('currently 1.0')) throw new Error('Provenance current contract mismatch');
if(!acceptance.includes('9de8bf2b5a6e95dc2545fa8011f493d46aedc93f')) throw new Error('Rollback main commit missing');
if(!acceptance.includes('59d8dda8d8e491255d5792329a9446eb01960a34')) throw new Error('Final v0.9 rollback blob missing');
if(!fs.existsSync('BETTING_EDGE_V0.9_ACCEPTANCE_2026-08-15.md')) throw new Error('Historical v0.9 acceptance missing');

console.log('BETTING EDGE VERSION BOUNDARY: v1.5 UI / v1.3 CORE / v1.0 CONTRACT / v1.7 RESEARCH — PASS');
