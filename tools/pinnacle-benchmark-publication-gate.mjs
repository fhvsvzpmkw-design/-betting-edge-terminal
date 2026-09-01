#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {AUTHORITY,QUALIFIED,UNAVAILABLE,validateObserver} from './pinnacle-sharp-benchmark.mjs';

const PROD_PATH='core/core-v1.4-production.json';
const SHA40=/^[0-9a-f]{40}$/i;
const EXECUTION_BOOKS=new Set(['Bet365','DraftKings']);

function fail(message){throw new Error(message)}
function check(condition,message){if(!condition)fail(message)}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function writeJson(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')}
function blobSha(file){const data=fs.readFileSync(file);return crypto.createHash('sha1').update(Buffer.from(`blob ${data.length}\0`)).update(data).digest('hex')}
function parseArgs(argv){const [command,...rest]=argv,args={command};for(let i=0;i<rest.length;i++){const token=rest[i];if(!token.startsWith('--'))fail(`Unexpected argument ${token}`);const key=token.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());const next=rest[i+1];if(next&&!next.startsWith('--')){args[key]=next;i++;}else args[key]=true;}return args}
function officialObserverShape(observer){return observer?.schema===3&&observer?.mode==='official-sharp-benchmark'&&observer?.authoritative===true&&observer?.authorityScope==='sharp-market-benchmark-only'&&observer?.benchmarkAuthority===AUTHORITY&&observer?.executionAuthority===false;}

function runtime(root='.'){
  const prodFile=path.join(root,PROD_PATH);
  const prod=readJson(prodFile);
  check(prod?.schema===1&&prod?.coreVersion==='1.4'&&prod?.state==='OPERATIONAL','Core 1.4 production manifest is not operational');
  const cfg=prod.sharpMarketBenchmark;
  check(cfg&&cfg.state==='OPERATIONAL','Core 1.4 Pinnacle benchmark is not operational');
  check(cfg.book==='Pinnacle'&&cfg.source==='OddsPapi v4','Pinnacle benchmark source drifted');
  check(cfg.authority===AUTHORITY,'Pinnacle benchmark authority drifted');
  check(cfg.executionAuthority===false&&cfg.maySupplyExecutablePrice===false&&cfg.mayOriginateBet===false&&cfg.maySetStake===false,'Pinnacle execution boundary weakened');
  check(cfg.mayDirectlyChangeFairValuePointEstimate===false&&cfg.mayDirectlyChangePlayTo===false&&cfg.mayDirectlyChangeStatus===false,'Pinnacle decision boundary weakened');
  check(cfg.unavailableIsReportBlocking===false,'Missing Pinnacle must remain non-blocking');
  check(Array.isArray(prod?.unchanged?.executionBooks)&&prod.unchanged.executionBooks.length===2&&prod.unchanged.executionBooks.every(book=>EXECUTION_BOOKS.has(book)),'Execution books must remain Bet365 and DraftKings only');
  const policyFile=path.join(root,cfg.policyPath);
  check(fs.existsSync(policyFile),`Missing Pinnacle benchmark policy ${cfg.policyPath}`);
  check(SHA40.test(String(cfg.policyBlobSha||''))&&blobSha(policyFile)===cfg.policyBlobSha,'Pinnacle benchmark policy blob drifted');
  const policy=readJson(policyFile);
  check(policy.policyId===cfg.policyId&&policy.targetCoreVersion==='1.4'&&policy.state==='OPERATIONAL','Pinnacle benchmark policy identity/state mismatch');
  check(policy.authority===AUTHORITY&&policy.executionAuthority===false&&policy.decisionAuthority===false&&policy.fairValueAuthority===false,'Pinnacle benchmark policy authority boundary drifted');
  check(Array.isArray(policy.executionBooksRemain)&&policy.executionBooksRemain.length===2&&policy.executionBooksRemain.every(book=>EXECUTION_BOOKS.has(book)),'Pinnacle policy execution books drifted');
  return {root,prod,prodFile,cfg,policy,policyFile,activatedAt:Date.parse(policy.activatedAt)};
}

function afterCutover(report,rt){const ts=Date.parse(report?.ts||'');check(Number.isFinite(ts),'report.ts must be a valid timestamp');return ts>=rt.activatedAt}

function normalize(rt,report,sidecar){
  if(!afterCutover(report,rt)) return false;
  check(sidecar&&typeof sidecar==='object'&&!Array.isArray(sidecar),'Sidecar is required');
  sidecar.provenance=sidecar.provenance&&typeof sidecar.provenance==='object'?sidecar.provenance:{};
  const p=sidecar.provenance;
  const observerPath=rt.policy.observerPath;
  const observerFile=path.join(rt.root,observerPath);
  p.pinnacleBenchmarkPolicyPath=rt.cfg.policyPath;
  p.pinnacleBenchmarkPolicyBlobSha=blobSha(rt.policyFile);
  p.pinnacleBenchmarkPolicyId=rt.policy.policyId;
  p.pinnacleBenchmarkAuthority=AUTHORITY;
  p.pinnacleBenchmarkExecutionAuthority=false;
  p.pinnacleObserverPath=observerPath;
  if(fs.existsSync(observerFile)){
    const observer=readJson(observerFile);
    const currentSha=blobSha(observerFile);
    if(p.pinnacleObserverBlobSha&&p.pinnacleObserverBlobSha!==currentSha) fail('Staged report Pinnacle observer blob does not match the bound current observer');
    p.pinnacleObserverBlobSha=currentSha;
    p.pinnacleGeneratedAt=observer.generatedAt||p.pinnacleGeneratedAt||null;
    p.pinnacleObserverSourceStatus=observer.status||null;
    if(observer.status==='ok'&&officialObserverShape(observer)){
      p.pinnacleStatus='ok';
      p.pinnacleBenchmarkState='OFFICIAL_BENCHMARK_AVAILABLE';
    }else{
      p.pinnacleStatus=observer.status==='ok'?'benchmark-incompatible':(observer.status||'unknown');
      p.pinnacleBenchmarkState=UNAVAILABLE;
    }
  }else{
    p.pinnacleBenchmarkState=UNAVAILABLE;
    p.pinnacleStatus='observer-missing';
    p.pinnacleObserverSourceStatus=null;
  }
  return true;
}

function validate(rt,report,sidecar){
  if(!afterCutover(report,rt)) return;
  const p=sidecar?.provenance;
  check(p&&typeof p==='object','Post-cutover sidecar requires Pinnacle benchmark provenance');
  check(p.pinnacleBenchmarkPolicyPath===rt.cfg.policyPath,'Pinnacle benchmark policy path mismatch');
  check(p.pinnacleBenchmarkPolicyBlobSha===blobSha(rt.policyFile),'Pinnacle benchmark policy SHA mismatch');
  check(p.pinnacleBenchmarkPolicyId===rt.policy.policyId,'Pinnacle benchmark policy ID mismatch');
  check(p.pinnacleBenchmarkAuthority===AUTHORITY,'Pinnacle benchmark authority missing or invalid');
  check(p.pinnacleBenchmarkExecutionAuthority===false,'Pinnacle benchmark must remain non-executable');
  for(const [index,rec] of (report.recs||[]).entries()){
    check(rec?.book!=='Pinnacle',`Recommendation ${index+1} cannot use Pinnacle as the executable book`);
    if(rec?.pinnacleBenchmark!==undefined){
      const b=rec.pinnacleBenchmark;
      check(b&&typeof b==='object'&&!Array.isArray(b),`Recommendation ${index+1} pinnacleBenchmark must be an object`);
      check([QUALIFIED,UNAVAILABLE].includes(b.state),`Recommendation ${index+1} pinnacleBenchmark state is invalid`);
      check(b.authority===AUTHORITY,`Recommendation ${index+1} pinnacleBenchmark authority is invalid`);
      check(b.executionAuthority===false,`Recommendation ${index+1} pinnacleBenchmark cannot be executable`);
      if(b.state===QUALIFIED){
        check(b.price!==undefined&&b.noVigProbability!==undefined&&b.noVigPriceAmerican!==undefined,`Recommendation ${index+1} QUALIFIED Pinnacle benchmark is incomplete`);
      }
    }
  }
  const observerFile=path.join(rt.root,rt.policy.observerPath);
  if(p.pinnacleStatus==='ok'){
    check(fs.existsSync(observerFile),'Pinnacle observer is missing despite status ok');
    check(SHA40.test(String(p.pinnacleObserverBlobSha||''))&&p.pinnacleObserverBlobSha===blobSha(observerFile),'Pinnacle observer SHA mismatch');
    const observer=readJson(observerFile);
    check(officialObserverShape(observer),'Official Pinnacle observer authority/schema shape is invalid');
    const result=validateObserver(observer,{observerFreshnessMinutes:rt.policy.rules.observerFreshnessMinutes,quoteFreshnessMinutes:rt.policy.rules.quoteFreshnessMinutes,futureClockSkewToleranceMinutes:rt.policy.rules.futureClockSkewToleranceMinutes,asOf:report.ts});
    check(result.ok,`Pinnacle observer validation failed: ${result.errors.join('; ')}`);
  }else{
    check(p.pinnacleBenchmarkState===UNAVAILABLE,'Non-ok Pinnacle observer must be explicitly unavailable');
  }
}

function selfTest(){const rt=runtime('.');check(rt.cfg.authority===AUTHORITY,'runtime authority');check(officialObserverShape({schema:3,mode:'official-sharp-benchmark',authoritative:true,authorityScope:'sharp-market-benchmark-only',benchmarkAuthority:AUTHORITY,executionAuthority:false}),'official observer shape');check(!officialObserverShape({schema:2,mode:'observation-only',authoritative:false}),'legacy observer must not qualify');console.log('Pinnacle benchmark publication gate self-test passed')}

const args=parseArgs(process.argv.slice(2));
if(args.command==='self-test'||args.command==='validate-runtime') selfTest();
else if(args.command==='normalize'){
  check(args.report&&args.sidecar,'normalize requires --report and --sidecar');
  const rt=runtime('.'),report=readJson(args.report),sidecar=readJson(args.sidecar);
  if(normalize(rt,report,sidecar)) writeJson(args.sidecar,sidecar);
  validate(rt,report,sidecar);
  console.log('Pinnacle benchmark sidecar normalized');
}else if(args.command==='validate'){
  check(args.report&&args.sidecar,'validate requires --report and --sidecar');
  validate(runtime('.'),readJson(args.report),readJson(args.sidecar));
  console.log('Pinnacle benchmark publication gate passed');
}else fail('Usage: pinnacle-benchmark-publication-gate.mjs self-test|validate-runtime|normalize --report FILE --sidecar FILE|validate --report FILE --sidecar FILE');
