#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..');
const DEFAULT_POLICY=path.join(ROOT,'core/core-liquidity-classification-v1.4.json');
const PROD=path.join(ROOT,'core/core-v1.4-production.json');

function fail(message){throw new Error(message)}
function assert(condition,message){if(!condition)fail(message)}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function gitBlobSha(file){const data=fs.readFileSync(file);return crypto.createHash('sha1').update(Buffer.from(`blob ${data.length}\0`)).update(data).digest('hex')}

function matchCondition(condition,context){
  if(!condition||typeof condition!=='object'||Array.isArray(condition))return false;
  return Object.entries(condition).every(([key,allowed])=>{
    const values=Array.isArray(allowed)?allowed:[allowed];
    return values.some(value=>context?.[key]===value);
  });
}

export function loadLiquidityPolicy({verifyManifest=true}={}){
  assert(fs.existsSync(DEFAULT_POLICY),'Missing Core 1.4 liquidity policy');
  const policy=readJson(DEFAULT_POLICY);
  assert(policy.schema===1,'Liquidity policy schema must be 1');
  assert(policy.state==='OPERATIONAL','Liquidity policy must be OPERATIONAL');
  assert(policy.targetCoreVersion==='1.4','Liquidity policy must target Core 1.4');
  assert(Array.isArray(policy.deterministicRules)&&policy.deterministicRules.length>0,'Liquidity policy requires deterministicRules');
  const allowed=new Set(policy.controlledValues||[]);
  for(const rule of policy.deterministicRules){
    assert(typeof rule.id==='string'&&rule.id.length>0,'Liquidity rule id is required');
    assert(rule.when&&typeof rule.when==='object','Liquidity rule condition is required');
    assert(allowed.has(rule.requiredLiquidityRisk),`Invalid requiredLiquidityRisk ${rule.requiredLiquidityRisk}`);
  }
  if(verifyManifest){
    assert(fs.existsSync(PROD),'Missing Core 1.4 production manifest');
    const prod=readJson(PROD);
    const pinned=prod.liquidityClassification;
    assert(pinned?.state==='OPERATIONAL','Production manifest liquidityClassification must be OPERATIONAL');
    assert(pinned.policyId===policy.policyId,'Production manifest liquidity policyId mismatch');
    assert(path.normalize(pinned.path)===path.normalize(path.relative(ROOT,DEFAULT_POLICY)),'Production manifest liquidity policy path mismatch');
    assert(pinned.blobSha===gitBlobSha(DEFAULT_POLICY),'Production manifest liquidity policy blob drifted');
  }
  return policy;
}

export function deriveRequiredLiquidityRisk(context,policy=loadLiquidityPolicy()){
  const matches=(policy.deterministicRules||[]).filter(rule=>matchCondition(rule.when,context));
  if(!matches.length)return null;
  const required=[...new Set(matches.map(rule=>rule.requiredLiquidityRisk))];
  if(required.length!==1)fail(`Conflicting deterministic liquidity rules for ${context?.sport||'UNKNOWN'} ${context?.marketClass||'UNKNOWN'} ${context?.marketDetail||'UNKNOWN'}`);
  return {
    requiredLiquidityRisk:required[0],
    ruleIds:matches.map(rule=>rule.id),
    reasons:matches.map(rule=>rule.reason).filter(Boolean)
  };
}

export function auditLiquidityReport(report,policy=loadLiquidityPolicy()){
  const errors=[];
  for(let i=0;i<(report?.recs||[]).length;i++){
    const rec=report.recs[i];
    const context=rec?.coreAssessment?.context;
    if(!context)continue;
    const derived=deriveRequiredLiquidityRisk(context,policy);
    if(!derived)continue;
    if(context.liquidityRisk!==derived.requiredLiquidityRisk){
      errors.push(`recommendation ${i+1} ${rec?.title||'UNKNOWN'} liquidityRisk=${context.liquidityRisk} but ${derived.ruleIds.join(',')} requires ${derived.requiredLiquidityRisk}`);
    }
  }
  return errors;
}

function selfTest(){
  const policy=loadLiquidityPolicy();
  const base={sport:'MLB',marketClass:'moneyline',marketDetail:'full_game_moneyline'};
  const required=deriveRequiredLiquidityRisk({...base,liquidityRisk:'NORMAL'},policy);
  assert(required?.requiredLiquidityRisk==='NORMAL','MLB full-game moneyline must deterministically classify NORMAL');
  const thinReport={recs:[{title:'Synthetic MLB moneyline',coreAssessment:{context:{...base,liquidityRisk:'THIN'}}}]};
  assert(auditLiquidityReport(thinReport,policy).length===1,'THIN mainstream MLB moneyline must fail liquidity audit');
  const normalReport={recs:[{title:'Synthetic MLB moneyline',coreAssessment:{context:{...base,liquidityRisk:'NORMAL'}}}]};
  assert(auditLiquidityReport(normalReport,policy).length===0,'NORMAL mainstream MLB moneyline must pass liquidity audit');
  const prop={sport:'MLB',marketClass:'player_props',marketDetail:'home_runs',liquidityRisk:'THIN'};
  assert(deriveRequiredLiquidityRisk(prop,policy)===null,'MLB player props must remain outside the current deterministic primary-market scope');
  console.log(`CORE LIQUIDITY CLASSIFICATION SELF-TEST OK policy=${policy.policyId}`);
}

function parseArgs(argv){
  const [command,...rest]=argv;
  const args={command};
  for(let i=0;i<rest.length;i++){
    const token=rest[i];
    if(!token.startsWith('--'))fail(`Unexpected argument ${token}`);
    const key=token.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    const next=rest[i+1];
    if(next&&!next.startsWith('--')){args[key]=next;i++;}else args[key]=true;
  }
  return args;
}

function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.command==='self-test')return selfTest();
  if(!['validate','audit'].includes(args.command)||!args.report)fail('Usage: core-liquidity-classification.mjs self-test | validate --report FILE | audit --report FILE');
  const report=readJson(path.resolve(args.report));
  const errors=auditLiquidityReport(report);
  if(args.command==='validate'&&errors.length)fail(`Liquidity classification contains ${errors.length} defect(s):\n- ${errors.join('\n- ')}`);
  if(args.command==='audit'){
    console.log(JSON.stringify({policyId:loadLiquidityPolicy().policyId,recommendations:report?.recs?.length||0,defects:errors.length,errors},null,2));
    return;
  }
  console.log(`CORE LIQUIDITY CLASSIFICATION OK ${report?.recs?.length||0} recommendation(s)`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main()}catch(error){console.error(`CORE LIQUIDITY CLASSIFICATION ERROR: ${error.message}`);process.exit(1)}
}
