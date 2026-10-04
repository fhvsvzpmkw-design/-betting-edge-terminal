import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadCurrentValueEstimates} from '../tools/graham-current-value-estimates.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const fixture={"effectiveAt": "2026-10-04T20:46:03.133416+00:00", "valueSupplements": [{"path": "data/walters/nfl/2026/week-01-weekly-evidence/2026-09-21-ea-week1-missing-player-capture.json", "blobSha": "7bd98ecfd85aee88630be9f1204cc0b09379d494", "eaPlayerIds": ["1831", "10852"], "estimateAcknowledged": true, "rationale": "Later official EA capture supplies missing non-QB identities. Convert with the frozen curve and label current estimates; never overwrite a locked player."}, {"path": "data/walters/nfl/2026/week-03-weekly-evidence/2026-10-04-ea-missing-player-capture.json", "blobSha": "6fc13b03177ec7688ab574246d45e374b94489a1", "eaPlayerIds": ["2507", "11489", "12948"], "estimateAcknowledged": true, "rationale": "Later official EA capture supplies missing non-QB identities. Convert with the frozen curve and label current estimates; never overwrite a locked player."}], "cases": [{"gameKey": "2026-W04-GB-TB", "playerEaId": "1831", "sourceRefs": ["data/walters/nfl/2026/week-01-weekly-evidence/2026-09-21-ea-week1-missing-player-capture.json"]}, {"gameKey": "2026-W04-GB-TB", "playerEaId": "10852", "sourceRefs": ["data/walters/nfl/2026/week-01-weekly-evidence/2026-09-21-ea-week1-missing-player-capture.json"]}, {"gameKey": "2026-W04-GB-TB", "playerEaId": "2507", "sourceRefs": ["data/walters/nfl/2026/week-03-weekly-evidence/2026-10-04-ea-missing-player-capture.json"]}, {"gameKey": "2026-W04-GB-TB", "playerEaId": "11489", "sourceRefs": ["data/walters/nfl/2026/week-03-weekly-evidence/2026-10-04-ea-missing-player-capture.json"]}, {"gameKey": "2026-W04-GB-TB", "playerEaId": "12948", "sourceRefs": ["data/walters/nfl/2026/week-03-weekly-evidence/2026-10-04-ea-missing-player-capture.json"]}]};
const setup=()=>({root:process.cwd(),input:structuredClone(fixture),registry:read('data/walters/nfl/player-values/player-values-2026-v1.json'),calibration:read('data/walters/nfl/personnel-calibration-v1.json'),production:read('data/walters/nfl/personnel-production-current.json')});
test('source-bound current supplements preserve locked identities and provenance',()=>{
 const a=setup(),before=JSON.stringify(a.registry),values=loadCurrentValueEstimates(a);
 assert.equal(values.length,5);assert.equal(JSON.stringify(a.registry),before);
 const gulbin=values.find(p=>p.eaPlayerId==='1831');assert.equal(gulbin.waltersPoints,0);assert.equal(gulbin.valueProvenance.type,'CURRENT_EA_SUPPLEMENT');
 assert.equal(values.find(p=>p.eaPlayerId==='11489').waltersPoints,1.2);
 assert.ok(values.every(p=>p.valueStatus==='CURRENT_ESTIMATE'&&p.valueProvenance.blobSha));
});
test('supplements reject invalid authority, hashes, duplicates, timestamps and unbound cases',()=>{
 for(const mutate of [
  a=>a.production.currentWeekReplacementEstimates.sourceBoundValueEstimatesAllowed=false,
  a=>a.input.valueSupplements[0].blobSha='0'.repeat(40),
  a=>a.input.valueSupplements[0].estimateAcknowledged=false,
  a=>a.input.valueSupplements[0].eaPlayerIds.push('1831'),
  a=>a.input.effectiveAt='2026-09-01T00:00:00Z',
  a=>a.input.valueSupplements[0].eaPlayerIds=['missing'],
  a=>a.input.cases.find(c=>c.playerEaId==='1831').sourceRefs=a.input.cases.find(c=>c.playerEaId==='1831').sourceRefs.filter(r=>r!==a.input.valueSupplements[0].path),
 ]) {const a=setup();mutate(a);assert.throws(()=>loadCurrentValueEstimates(a),/CURRENT_VALUE_ESTIMATE/);}
});
