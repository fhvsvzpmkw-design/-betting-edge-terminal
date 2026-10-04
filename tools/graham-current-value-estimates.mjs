import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {playerValue} from './walters-personnel-calibration.mjs';
const blob=bytes=>createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const fail=s=>{throw Error('CURRENT_VALUE_ESTIMATE:'+s);};
const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
export function loadCurrentValueEstimates({root,input,registry,calibration,production}) {
 const bindings=input.valueSupplements||[];
 if(input.valueEstimates?.length)fail('CURRENT_IMPUTATION_NOT_AUTHORIZED');
 if(!bindings.length)return [];
 if(production.currentWeekReplacementEstimates.sourceBoundValueEstimatesAllowed!==true)fail('POLICY_REQUIRED');
 const registrySha=blob(fs.readFileSync(path.join(root,production.sourceAuthority.playerValueRegistry))),result=[];
 const refs=new Set(input.cases.flatMap(c=>c.sourceRefs||[]));
 for(const b of bindings){
  if(!/^data\/walters\/nfl\/2026\/week-\d{2}-weekly-evidence\/.+\.json$/.test(b.path||'')||!/^[0-9a-f]{40}$/.test(b.blobSha||'')||b.estimateAcknowledged!==true||!b.rationale?.trim()||!refs.has(b.path)||!b.eaPlayerIds?.length)fail('SUPPLEMENT_BINDING');
  const bytes=fs.readFileSync(path.join(root,b.path));if(blob(bytes)!==b.blobSha)fail('SUPPLEMENT_BLOB');
  const capture=JSON.parse(bytes);if(capture.sourceAuthority!=='EA_OFFICIAL_MADDEN_NFL_27'||capture.marketViewed!==false||capture.lockedRegistryBlob!==registrySha||!Number.isFinite(Date.parse(capture.recordedAt))||Date.parse(capture.recordedAt)>Date.parse(input.effectiveAt))fail('SUPPLEMENT_AUTHORITY');
  for(const id of b.eaPlayerIds){
   const rows=capture.playersAbsentFromLockedRegistry.filter(p=>String(p.eaPlayerId)===String(id));
   if(rows.length!==1||[...registry.players,...result].some(p=>String(p.eaPlayerId)===String(id)||norm(p.player)===norm(rows[0].fullName)))fail('IDENTITY_OVERRIDE');
   const consumers=input.cases.filter(c=>String(c.playerEaId)===String(id)||(c.replacementModel?.replacements||[]).some(r=>String(r.eaPlayerId)===String(id)));
   if(!consumers.length||consumers.some(c=>!c.sourceRefs.includes(b.path)))fail('SUPPLEMENT_CASE_BINDING');
   const p=rows[0];if(p.position==='QB'||!Number.isInteger(p.overall)||p.iteration!==capture.iteration)fail('NON_QB_SOURCE_VALUE');
   result.push({player:p.fullName,eaPlayerId:String(id),position:p.position,maddenOvr:p.overall,waltersPoints:playerValue(calibration,{position:p.position,maddenOvr:p.overall}),valueStatus:'CURRENT_ESTIMATE',valueProvenance:{type:'CURRENT_EA_SUPPLEMENT',...b,iteration:capture.iteration,capturedAt:capture.capturedAt,limitation:'Source-bound later EA capture converted with the frozen curve; not a rewrite of the frozen registry.'}});
  }
 }
 return result;
}
