#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import labels from '../assets/selection-label.js';

// Existing issued reports stay byte-for-byte immutable. Their display uses the
// same identity-derived formatter; newly prepared reports freeze complete titles.
export const SELECTION_LABEL_FROM='2026-10-12T11:58:55-07:00';
const enforced=report=>Date.parse(report?.ts)>=Date.parse(SELECTION_LABEL_FROM);
export function selectionLabelViolations(report){
  if(!enforced(report))return [];
  return (report.recs||[]).flatMap((rec,index)=>{
    const problem=labels.titleProblem(rec);
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
  // Validate every proposed change before changing any copy. Explicitly wrong
  // side/line/name/market text is a conflict, not something to silently repair.
  if(!Array.isArray(report.recs)||sidecar?.recommendations?.length!==report.recs.length)throw Error('Selection labels require aligned report and sidecar recommendations');
  const replacements=[];
  for(const [index,rec] of report.recs.entries()){
    const item=sidecar.recommendations[index],info=labels.describe(rec);
    if(item.title!==rec.title)throw Error(`Recommendation ${index+1}: sidecar title differs from report`);
    if(!info.applicable)continue;
    const problem=labels.titleProblem(rec,{allowMissing:true});
    if(problem)throw Error(`Recommendation ${index+1}: ${problem}`);
    const key=rec.feed.selectionKey;
    const receipts=(sidecar.primaryAnalysis?.receipts||[]).filter(r=>r.state==='EVALUATED'&&r.decision?.feed?.selectionKey===key);
    for(const receipt of receipts)for(const copy of [receipt.decision,receipt.evidence])
      if(copy?.title!==undefined&&copy.title!==rec.title&&copy.title!==info.title)throw Error(`Recommendation ${index+1}: receipt title disagrees with the issued selection`);
    replacements.push({index,title:info.title,receipts});
  }
  const result=structuredClone({report,sidecar});
  for(const replacement of replacements){
    const {index,title}=replacement,key=report.recs[index].feed.selectionKey;
    result.report.recs[index].title=title;result.sidecar.recommendations[index].title=title;
    for(const receipt of result.sidecar.primaryAnalysis?.receipts||[])
      if(receipt.state==='EVALUATED'&&receipt.decision?.feed?.selectionKey===key)
        for(const copy of [receipt.decision,receipt.evidence])if(copy&&Object.hasOwn(copy,'title'))copy.title=title;
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
