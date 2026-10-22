#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import labels from '../assets/selection-label.js';

// Existing issued reports stay byte-for-byte immutable. Their display uses the
// same identity-derived formatter; newly prepared reports freeze complete titles.
export const SELECTION_LABEL_FROM='2026-10-12T11:58:55-07:00';
const enforced=report=>Date.parse(report?.ts)>=Date.parse(SELECTION_LABEL_FROM);
const copyFields=new Set(['analysis','support','contrary','rationale','decisionRationale','decisionExplanation','decisionImpact','application']);
function repairCopy(holder,rec){
  if(!holder||typeof holder!=='object')return;
  for(const [key,value] of Object.entries(holder)){
    if(copyFields.has(key)&&typeof value==='string')holder[key]=labels.repairText(rec,value);
    else if(value&&typeof value==='object')repairCopy(value,rec);
  }
}
function repairCandidateCopies(holder,rec,title){
  if(!holder||typeof holder!=='object')return;
  if(holder.quote?.selectionKey===rec.feed.selectionKey){
    if('title' in holder)holder.title=title;
    if('recordedTitle' in holder)holder.recordedTitle=title;
    repairCopy(holder,rec);return;
  }
  for(const value of Object.values(holder))if(value&&typeof value==='object')repairCandidateCopies(value,rec,title);
}
export function selectionLabelViolations(report){
  if(!enforced(report))return [];
  return (report.recs||[]).flatMap((rec,index)=>{
    // Customer-visible labels are derived from this identity, so freely written
    // title disagreements are repairable text, not a reason to block a report.
    const problem=labels.describe(rec).problem;
    return problem?[`Recommendation ${index+1}: ${problem}`]:[];
  });
}
export function validateSelectionLabels(report){
  if(!enforced(report))return {enforced:false,checked:0};
  const problems=selectionLabelViolations(report);
  if(problems.length)throw new Error(problems.join('; '));
  const checked=(report.recs||[]).filter(rec=>labels.describe(rec).applicable).length;
  return {enforced:true,checked};
}
export function normalizeSelectionLabels(report,sidecar){
  if(!enforced(report))return {report,sidecar};
  // Rebuild all title copies from the exact selection before freeze. Text-only
  // mistakes are repaired automatically; conflicting selection data still fails.
  if(!Array.isArray(report.recs)||sidecar?.recommendations?.length!==report.recs.length)throw Error('Selection labels require aligned report and sidecar recommendations');
  const replacements=[];
  for(const [index,rec] of report.recs.entries()){
    const matches=(report.gameIntelligence?.games||[]).filter(game=>String(game.eventId)===String(rec.feed?.eventId));
    const display=labels.withEventMetadata(rec,matches.length===1?matches[0]:null);
    const item=sidecar.recommendations[index],info=labels.describe(display);
    if(!item||typeof item!=='object'||Array.isArray(item))throw Error(`Recommendation ${index+1}: invalid sidecar recommendation`);
    if(!info.applicable)continue;
    if(info.problem)throw Error(`Recommendation ${index+1}: ${info.problem}`);
    const key=rec.feed.selectionKey;
    const itemKey=item.feed?.selectionKey||item.selectionKey||item.cardEvidence?.selectionKey;
    if(itemKey&&itemKey!==key)throw Error(`Recommendation ${index+1}: sidecar selection identity differs from report`);
    replacements.push({index,title:info.title,display});
  }
  const result=structuredClone({report,sidecar});
  for(const replacement of replacements){
    const {index,title,display}=replacement,key=report.recs[index].feed.selectionKey;
    result.report.recs[index].title=title;result.sidecar.recommendations[index].title=title;
    if('meta' in display)result.report.recs[index].meta=display.meta;
    if('meta' in result.sidecar.recommendations[index])result.sidecar.recommendations[index].meta=display.meta;
    repairCopy(result.report.recs[index],display);repairCopy(result.sidecar.recommendations[index],display);
    for(const receipt of result.sidecar.primaryAnalysis?.receipts||[])
      if(receipt.state==='EVALUATED'&&receipt.decision?.feed?.selectionKey===key){
        for(const copy of [receipt.decision,receipt.evidence])if(copy){copy.title=title;if('meta' in copy)copy.meta=display.meta;repairCopy(copy,display);}
        repairCopy(receipt.candidateAssessment,display);
      }
    for(const assessment of [result.report.candidateAssessment,result.sidecar.candidateAssessment])repairCandidateCopies(assessment,display,title);
  }
  validateSelectionLabels(result.report);return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const [command,...args]=process.argv.slice(2),options={};
    for(let i=0;i<args.length;i+=2){if(!['--report','--sidecar'].includes(args[i])||!args[i+1])throw Error('Invalid label gate arguments');options[args[i].slice(2)]=args[i+1];}
    if(!options.report||!['normalize','validate'].includes(command))throw Error('Usage: selection-label-gate.mjs normalize|validate --report FILE [--sidecar FILE]');
    const report=JSON.parse(fs.readFileSync(options.report));
    if(command==='normalize'){
      if(!options.sidecar)throw Error('Normalization requires --sidecar');
      for(const file of [options.report,options.sidecar])if(/(?:^|\/)data\/history\/(?:runs|research-fit|staging)\//.test(fs.realpathSync(file).split(path.sep).join('/')))throw Error('Normalize accepts draft files only');
      const result=normalizeSelectionLabels(report,JSON.parse(fs.readFileSync(options.sidecar)));
      fs.writeFileSync(options.report,JSON.stringify(result.report,null,2)+'\n');fs.writeFileSync(options.sidecar,JSON.stringify(result.sidecar,null,2)+'\n');
    }else validateSelectionLabels(report);
    console.log('SELECTION LABELS OK');
  }catch(error){console.error('SELECTION LABEL ERROR: '+error.message);process.exitCode=1;}
}

