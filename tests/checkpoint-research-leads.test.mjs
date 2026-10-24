import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {serializeReportDocument} from '../tools/report-document-transport.mjs';
import {loadCheckpointResearchLeads} from '../tools/checkpoint-research-leads.mjs';
import {derivePrimarySelectionInventory} from '../tools/major-sport-market-coverage-gate.mjs';
import {buildEventResearchPlan,buildResearchWorkPlan} from '../tools/event-research-plan.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'checkpoint-research-'));
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const write=(p,v)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),typeof v==='string'?v:JSON.stringify(v));};
try{
  git(['init','-q']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);
  const policy=JSON.parse(fs.readFileSync('data/major-sport-market-coverage-v1.json'));
  write('data/major-sport-market-coverage-v1.json',policy);
  const feed={generatedAt:'2026-10-24T15:00:00Z',events:[{id:'A',date:'2026-10-24T23:00:00Z',home:'Home',away:'Away',sport:{slug:'baseball'},league:{slug:'usa-mlb'},bookmakers:{Bet365:[{
    marketKey:'ml',updatedAt:'2026-10-24T14:59:00Z',odds:[{home:'1.80',away:'2.10',selectionKeys:{home:'A|ml|home||',away:'A|ml|away||'}}]
  }]}}]};
  write('data/live-odds.json',feed);const feedBlob=git(['hash-object','-w','data/live-odds.json']);
  const report={ts:'2026-10-24T09:30:00-07:00',feedGeneratedAt:feed.generatedAt};
  const source={id:'actual-saved-source',eventId:'A',sport:'MLB',kind:'OFFICIAL',url:'https://example.org/game/A',checkedAt:'2026-10-24T15:01:00Z',finding:'Synthetic original event observation.'};
  const previous={schema:1,phase:'DRAFT',identity:{ts:'2026-10-24T08:10:00-07:00',feedBlobSha:feedBlob},report:{...report,ts:'2026-10-24T08:10:00-07:00'},sidecar:{provenance:{feedBlobSha:feedBlob},reportReference:{ts:'2026-10-24T08:10:00-07:00'},primaryAnalysis:{receipts:[{
    selectionId:'MLB|A|full_game_moneyline|home',state:'EVALUATED',decision:{status:'BET',stake:'$99',fair:'old fair',sourceEvidence:[source,{...source,id:'future',checkedAt:'2026-10-24T16:00:00Z'}]}
  }]}},events:[]};
  const file='data/report-production/checkpoints/2026-10-24-unpublished.json';write(file,serializeReportDocument(previous,'REPORT_CHECKPOINT'));
  const published=structuredClone(previous);published.phase='PUBLISHED';write(file.replace('unpublished','published'),serializeReportDocument(published,'REPORT_CHECKPOINT'));
  const later=structuredClone(previous);later.report.ts=later.identity.ts=later.sidecar.reportReference.ts='2026-10-24T10:00:00-07:00';write(file.replace('unpublished','later'),serializeReportDocument(later,'REPORT_CHECKPOINT'));
  const broken=structuredClone(previous);broken.identity.feedBlobSha='a'.repeat(40);write(file.replace('unpublished','wrong-binding'),serializeReportDocument(broken,'REPORT_CHECKPOINT'));
  git(['add','.']);git(['commit','-qm','Saved synthetic research']);
  const universe=derivePrimarySelectionInventory(report,feed,policy),leads=loadCheckpointResearchLeads({root,report,universe});
  assert.equal(leads.checkpoints.length,1);assert.equal(leads.checkpoints[0].issued,false);
  const entry=leads.bySelection.get('MLB|A|full_game_moneyline|home')[0];
  assert.equal(entry.row.decision.status,undefined);assert.equal(entry.row.decision.stake,undefined);assert.equal(entry.row.decision.fair,undefined);
  assert.equal(entry.row.decision.sourceEvidence.length,1,'a fact observed after the original draft is never inherited');
  assert.equal(entry.row.decision.sourceEvidence[0].checkedAt,source.checkedAt);
  const rows=universe.selections.map(row=>({...row,state:'BLOCKED',marketComparison:{edgeProbabilityPoints:-2,direction:'UNFAVORABLE'},missingResearch:['EXACT_CANDIDATE_REVIEW_REQUIRED']}));
  const plan=buildEventResearchPlan({report,candidateAssessment:{selections:rows},checkpointResearch:leads.bySelection});
  const work=buildResearchWorkPlan(plan,{eventId:'A'});
  assert.equal(plan.counts.completed,0,'unissued assessments never confer completion');
  assert.equal(work.events[0].sourceLeads[0].priorCheckpointPath,file);
  assert.equal(work.events[0].sourceLeads[0].checkpointBlobSha,git(['rev-parse',`HEAD:${file}`]));
  assert.equal(work.events[0].sourceLeads[0].issued,false);
  assert.deepEqual(work.events[0].selections[0].missingResearch,['EXACT_CANDIDATE_REVIEW_REQUIRED']);
  const original=fs.readFileSync(path.join(root,file));
  write(file,serializeReportDocument({...previous,phase:'PUBLISHED'},'REPORT_CHECKPOINT'));
  write(file.replace('unpublished','uncommitted'),serializeReportDocument(previous,'REPORT_CHECKPOINT'));
  assert.equal(loadCheckpointResearchLeads({root,report,universe}).checkpoints.length,1,'only exact committed bytes are read');
  fs.writeFileSync(path.join(root,file),original);
  const changed={...feed,events:[{...feed.events[0],date:'2026-10-25T00:00:00Z'}]};
  assert.equal(loadCheckpointResearchLeads({root,report,universe:derivePrimarySelectionInventory(report,changed,policy)}).bySelection.size,0,'same id with different kickoff cannot share research');
  assert.deepEqual(loadCheckpointResearchLeads({root,report:{...report,ts:'2026-10-25T09:30:00-07:00'},universe}).checkpoints,[]);
  assert.deepEqual(fs.readFileSync(path.join(root,file)),original,'lead discovery never changes saved evidence');
  console.log('Unpublished checkpoint research: committed identity, source clocks, changed kickoff, grade isolation, exact gaps and immutable bytes verified.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
