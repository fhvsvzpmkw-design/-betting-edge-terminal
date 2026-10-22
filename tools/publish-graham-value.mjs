#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const OUTPUT='data/history/graham-pinnacle-value.json';
const SOURCE=/^(?:tools\/build-graham-pinnacle-value\.mjs|assets\/value-analytics\.js|data\/walters\/nfl\/\d{4}\/(?:week-\d+-daily-market-ledger|[^/]*final-facts[^/]*)\.json)$/;
const meaningful=content=>{const data=JSON.parse(content);delete data.generatedAt;return JSON.stringify(data);};

// This publisher owns only the derived comparison. Retry builds consume the
// latest sources instead of rebasing an older generated file over new inputs.
export function publishGrahamValue({root=process.cwd(),maxAttempts=4}={}){
  if(!Number.isInteger(maxAttempts)||maxAttempts<1)throw Error('Invalid publication attempt limit');
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
  if(git('status','--porcelain'))throw Error('Graham Value publication requires a clean workflow checkout');
  if(git('branch','--show-current')!=='main')throw Error('Graham Value publication requires the main workflow branch');
  const sources=ref=>Object.fromEntries(git('ls-tree','-r',ref,'--','tools/build-graham-pinnacle-value.mjs','assets/value-analytics.js','data/walters/nfl').split('\n').filter(Boolean).map(row=>{
    const [metadata,file]=row.split('\t');return [file,metadata.split(' ')[2]];
  }).filter(([file])=>SOURCE.test(file)));
  const outputAt=ref=>git('show',`${ref}:${OUTPUT}`);
  let lastFailure='';
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    git('fetch','origin','main');
    git('reset','--hard','origin/main');
    const inputCommit=git('rev-parse','HEAD'),sourceBlobs=sources('HEAD'),previous=outputAt('HEAD');
    execFileSync(process.execPath,['tools/build-graham-pinnacle-value.mjs'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
    const file=path.join(root,OUTPUT),data=JSON.parse(fs.readFileSync(file,'utf8'));
    if(!data.rows||!data.coverage||data.kind!=='graham-pinnacle-value')throw Error('Graham Value builder returned an invalid comparison');
    data.sourceBlobs=sourceBlobs;
    const built=JSON.stringify(data,null,2)+'\n';fs.writeFileSync(file,built);
    const changed=meaningful(previous)!==meaningful(built);
    if(changed){
      git('add','--',OUTPUT);
      git('commit','-m','Refresh Graham Value from latest saved ledger and final facts');
      try{git('push','origin','HEAD:main');}catch(error){lastFailure=error.stderr?.toString().trim()||error.message;continue;}
    }else{
      // A new clock alone is not a changed record and must not create a commit.
      git('restore','--',OUTPUT);
    }
    const published=git('rev-parse','HEAD'),blob=git('rev-parse',`HEAD:${OUTPUT}`);
    git('fetch','origin','main');
    const currentSources=sources('origin/main'),currentBlob=git('rev-parse',`origin/main:${OUTPUT}`);
    if(JSON.stringify(sourceBlobs)!==JSON.stringify(currentSources)||blob!==currentBlob){
      lastFailure='Remote inputs or derived comparison advanced during publication';
      continue;
    }
    if(meaningful(outputAt('origin/main'))!==meaningful(built))throw Error('Remote Graham Value comparison does not match the verified build');
    const receipt={state:changed?'PUBLISHED':'CURRENT',attempts:attempt,inputCommit,publishedCommit:published,verifiedMain:git('rev-parse','origin/main'),outputBlob:blob,sourceBlobs,coverage:data.coverage};
    console.log(JSON.stringify(receipt,null,2));return receipt;
  }
  throw Error(`Graham Value could not be published from current sources after ${maxAttempts} attempts: ${lastFailure}`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)publishGrahamValue();
