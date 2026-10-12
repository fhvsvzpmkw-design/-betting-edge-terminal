#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function publishHistoricalOutputs({root=process.cwd(),paths,receiptPath,messagePath,buildCommands=[['node','tools/build-results-index.mjs'],['node','tools/add-results-player-value.mjs'],['node','tools/add-results-shadow-v2.mjs']]}={}) {
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,GIT_EDITOR:'true'}}).trim();
  const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
  const write=(p,data)=>fs.writeFileSync(path.join(root,p),JSON.stringify(data,null,2)+'\n');
  git('add','--',...paths);git('commit','-F',messagePath);
  for(let attempt=1;attempt<=3;attempt++) {
    git('fetch','origin','main');
    const upstream=git('rev-parse','origin/main'),priorBase=git('rev-parse','HEAD^');
    if(upstream!==priorBase) {
      try {git('rebase','origin/main');}
      catch(error) {
        const conflicts=git('diff','--name-only','--diff-filter=U').split('\n').filter(Boolean);
        if(conflicts.length!==1 || conflicts[0]!=='data/history/results-index.json') {
          try {git('rebase','--abort');}catch{}
          throw new Error(`Historical publish refused non-index conflict: ${conflicts.join(', ')||error.message}`);
        }
        // The index is derived. Keep upstream here, then rebuild from merged immutable
        // reports plus our verified observations. Never choose a side for a source conflict.
        git('checkout','--ours','data/history/results-index.json');git('add','data/history/results-index.json');git('rebase','--continue');
      }
      for(const command of buildCommands)execFileSync(command[0],command.slice(1),{cwd:root,stdio:'inherit'});
      const receipt=read(receiptPath),idx=read('data/history/results-index.json');
      for(const [file,sha] of Object.entries(receipt.outputBlobs)) {
        if(file==='data/history/results-index.json')continue;
        assert.equal(git('hash-object',file),sha,`Verified output changed during rebase: ${file}`);
      }
      const historical=(idx.cards||[]).filter(x=>String(x.date||'')<=receipt.targetDate);
      const pending=historical.filter(x=>x.completionState!=='complete');
      assert.equal(historical.length,receipt.historicalCoverage.cards,'Historical issued population changed during publish');
      assert.equal(pending.length,receipt.historicalCoverage.unresolvedCards,'Historical settlement count changed during publish');
      const target=(idx.byDate||[]).find(x=>x.name===receipt.targetDate)||null;
      if(receipt.target.issued) {
        assert.equal(target?.issued,receipt.target.issued);assert.equal(target?.complete,receipt.target.complete);assert.equal(target?.unresolved,receipt.target.unresolved);
        for(const [grade,count] of Object.entries(receipt.target.grades))assert.equal(target?.grades?.[grade]||0,count);
      }
      receipt.coverage=idx.coverage;receipt.targetIndex=target;
      receipt.outputBlobs['data/history/results-index.json']=git('hash-object','data/history/results-index.json');
      receipt.publishReconciliation={upstreamCommit:upstream,attempt,reconciledAt:new Date().toISOString(),method:'Rebase verified observations; rebuild derived index from latest merged history.'};
      write(receiptPath,receipt);git('add','data/history/results-index.json',receiptPath);git('commit','--amend','--no-edit');
    }
    try {git('push','origin','HEAD:main');return git('rev-parse','HEAD');}
    catch(error) {
      const message=String(error.stderr||error.message);
      if(attempt===3 || !/non-fast-forward|fetch first|rejected/i.test(message))throw error;
    }
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const paths=JSON.parse(fs.readFileSync('/tmp/card-grading-paths.json','utf8'));
  const request=JSON.parse(fs.readFileSync('data/history/grading/request.json','utf8'));
  const sha=publishHistoricalOutputs({paths,receiptPath:`data/history/grading/receipts/${request.requestId}.json`,messagePath:'/tmp/card-grading-commit.txt'});
  console.log(`HISTORICAL OUTPUTS PUBLISHED ${sha}`);
}
