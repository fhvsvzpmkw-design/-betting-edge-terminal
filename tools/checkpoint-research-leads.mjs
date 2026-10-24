// Committed unfinished runs are research leads, never issued decisions.
import {execFileSync} from 'node:child_process';
import {parseReportDocument} from './report-document-transport.mjs';
import {derivePrimarySelectionInventory} from './major-sport-market-coverage-gate.mjs';
import fs from 'node:fs';
import path from 'node:path';

const list=value=>Array.isArray(value)?value:[];
const time=value=>Date.parse(value||'');
const git=(root,args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});

export function loadCheckpointResearchLeads({root,report,universe}={}) {
  const bySelection=new Map(),warnings=[],checkpoints=[];
  if(!universe?.selections?.length)return {bySelection,warnings,checkpoints};
  let entries;
  try{entries=git(root,['ls-tree','-r','HEAD','--','data/report-production/checkpoints']).toString().trim().split('\n');}
  catch{return {bySelection,warnings,checkpoints};}
  const day=report.ts.slice(0,10),compact=day.replaceAll('-','');
  const current=new Map(universe.selections.map(row=>[row.selectionId,row]));
  const policy=JSON.parse(fs.readFileSync(path.join(root,'data/major-sport-market-coverage-v1.json')));
  const candidates=[];
  for(const entry of entries){
    const match=entry.match(/^100644 blob ([a-f0-9]{40})\t(data\/report-production\/checkpoints\/([^/]+)\.json)$/);
    if(!match||(!match[3].includes(day)&&!match[3].includes(compact)))continue;
    const [,sha,file]=match;
    try{
      const saved=parseReportDocument(git(root,['cat-file','blob',sha]),'REPORT_CHECKPOINT');
      // A published run already has the separately verified History route.
      if(!['DRAFT','PREPARED','FROZEN','STAGED'].includes(saved.phase)||saved.report?.ts?.slice(0,10)!==day||
        !Number.isFinite(time(saved.report.ts))||time(saved.report.ts)>=time(report.ts)||
        saved.identity?.ts!==saved.report.ts||saved.identity?.feedBlobSha!==saved.sidecar?.provenance?.feedBlobSha||
        saved.sidecar?.reportReference?.ts!==saved.report.ts)continue;
      const feed=JSON.parse(git(root,['cat-file','blob',saved.identity.feedBlobSha]));
      const inventory=derivePrimarySelectionInventory(saved.report,feed,policy);
      candidates.push({saved,file,sha,inventory});
    }catch(error){warnings.push(`Checkpoint research lead unavailable at ${file}: ${error.message}`);}
  }
  candidates.sort((a,b)=>time(a.saved.report.ts)-time(b.saved.report.ts));
  for(const {saved,file,sha,inventory}of candidates){
    const prior=new Map(inventory.selections.map(row=>[row.selectionId,row]));
    const validSource=source=>Number.isFinite(time(source?.checkedAt||source?.asOf))&&time(source.checkedAt||source.asOf)<=time(saved.report.ts);
    let count=0;
    for(const receipt of list(saved.sidecar.primaryAnalysis?.receipts)){
      const selection=current.get(receipt.selectionId),previous=prior.get(receipt.selectionId);
      if(!selection||!previous||selection.sport!==previous.sport||String(selection.eventId)!==String(previous.eventId)||time(selection.eventDate)!==time(previous.eventDate))continue;
      const rec=receipt.decision||receipt.candidateDraft?.decision||{};
      const evidence=receipt.evidence||receipt.candidateDraft?.evidence||{};
      const sources=[...list(rec.sourceEvidence),...list(evidence.sourceEvidence),...list(receipt.blocker?.attempts)].filter(validSource);
      const personnel=rec.personnelEvidence||evidence.personnelEvidence;
      const official=list(personnel?.officialSources).filter(validSource);
      if(!sources.length&&!official.length)continue;
      // Deliberately omit status, fair, stake, market assessment and review
      // clearance. Only event source observations can enter the work plan.
      const row={decision:{feed:{eventDate:previous.eventDate},sourceEvidence:sources,
        ...(official.length?{personnelEvidence:{officialSources:official}}:{})}};
      const lead={row,checkpointPath:file,checkpointBlobSha:sha,reportTs:saved.report.ts,issued:false,requiresCurrentApplicabilityReview:true};
      if(!bySelection.has(selection.selectionId))bySelection.set(selection.selectionId,[]);
      bySelection.get(selection.selectionId).push(lead);count++;
    }
    if(count)checkpoints.push({path:file,blobSha:sha,reportTs:saved.report.ts,selections:count,issued:false});
  }
  return {bySelection,warnings,checkpoints};
}
