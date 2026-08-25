#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..');
const DEFAULT_FRAMEWORK=path.join(ROOT,'core/core-handicap-framework-v1.3-r1.json');
const DEFAULT_CASES=path.join(ROOT,'core/tests/core-handicap-framework-v1.3-r1-cases.json');
const LIBRARY=path.join(ROOT,'research/research-library.json');
const MANIFEST=path.join(ROOT,'research/manifest.json');

function fail(message){throw new Error(message)}
function assert(condition,message){if(!condition)fail(message)}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function gitBlobSha(file){const data=fs.readFileSync(file);return crypto.createHash('sha1').update(Buffer.from(`blob ${data.length}\0`)).update(data).digest('hex')}
function nonEmpty(v){return typeof v==='string'&&v.trim().length>0}

function matchCondition(condition,context){
  if(!condition||typeof condition!=='object'||Array.isArray(condition)) return false;
  if(Array.isArray(condition.all)) return condition.all.every(c=>matchCondition(c,context));
  if(Array.isArray(condition.any)) return condition.any.some(c=>matchCondition(c,context));
  if(condition.not) return !matchCondition(condition.not,context);
  return Object.entries(condition).every(([key,allowed])=>{
    const values=Array.isArray(allowed)?allowed:[allowed];
    return values.some(value=>context[key]===value);
  });
}

function validateFramework(framework,library,manifest){
  assert(framework?.schema===1,'Framework schema must be 1');
  assert(framework.state==='STAGING_CANDIDATE_NOT_RUNTIME_AUTHORITY','R1 must remain staging until explicit promotion');
  assert(framework.coreFamilyVersion==='1.3','Framework must target core family 1.3');
  assert(framework.researchAuthority?.libraryVersion==='1.8','Framework must pin Research Library v1.8');
  assert(library?.library?.version==='1.8','Active Research Library must be v1.8');
  assert(manifest?.activeLibraryVersion==='1.8','Active research manifest must be v1.8');
  assert(gitBlobSha(LIBRARY)===framework.researchAuthority.libraryBlobSha,'Pinned Research Library blob SHA drifted');
  assert(gitBlobSha(MANIFEST)===framework.researchAuthority.manifestBlobSha,'Pinned research manifest blob SHA drifted');

  const states=framework.controlledValues?.modelErrorState||[];
  assert(JSON.stringify(states)===JSON.stringify(framework.modelErrorOrder),'modelErrorState values must match modelErrorOrder');
  assert(states.length===4,'Expected four model-error states');
  const stateSet=new Set(states);
  for(const rule of framework.baseRules||[]){
    assert(nonEmpty(rule.id), 'Every base rule requires id');
    assert(stateSet.has(rule.floor),`Invalid base-rule floor ${rule.floor}`);
    assert(rule.when&&typeof rule.when==='object',`Base rule ${rule.id} requires condition`);
  }

  const libraryIds=new Set((library.items||[]).map(item=>item.priorId));
  for(const rule of framework.graduatedResearchRules||[]){
    assert(nonEmpty(rule.priorId),'Every graduated rule requires priorId');
    assert(libraryIds.has(rule.priorId),`Graduated research prior does not resolve in v1.8: ${rule.priorId}`);
    assert(stateSet.has(rule.floor),`Invalid graduated-rule floor ${rule.floor}`);
    assert(rule.when&&typeof rule.when==='object',`Graduated rule ${rule.priorId} requires condition`);
    assert(Array.isArray(rule.effects),`Graduated rule ${rule.priorId} effects must be an array`);
  }

  const boundaries=framework.firstPhaseBoundaries||{};
  assert(boundaries.researchMayRaiseModelErrorFloor===true,'First phase must allow only explicit upward model-error graduation');
  assert(boundaries.researchMayLowerModelErrorFloor===false,'First phase must prohibit research-driven model-error compression');
  assert(boundaries.researchMayMoveFairValuePointEstimate===false,'First phase must not move fair-value point estimates');
  assert(boundaries.researchMayCreateIndependentCurrentSupport===false,'Research cannot manufacture independent current support');
  assert(boundaries.researchMayCreateBet===false,'Research cannot create BET');
  assert(boundaries.researchMaySetStake===false,'Research cannot set stake');
}

function evaluate(framework,context){
  const order=new Map(framework.modelErrorOrder.map((state,index)=>[state,index]));
  let state='STANDARD';
  const reasons=[];
  const effects=new Set();
  const appliedRules=[];
  const raise=(floor,source,reason)=>{
    if(order.get(floor)>order.get(state)) state=floor;
    appliedRules.push(source);
    if(reason) reasons.push(reason);
  };

  for(const rule of framework.baseRules||[]){
    if(matchCondition(rule.when,context)) raise(rule.floor,`base:${rule.id}`,rule.reason);
  }

  const enabled=new Set(Array.isArray(context.graduatedResearchIds)?context.graduatedResearchIds:[]);
  for(const rule of framework.graduatedResearchRules||[]){
    if(!enabled.has(rule.priorId)) continue;
    if(!matchCondition(rule.when,context)) continue;
    raise(rule.floor,`research:${rule.priorId}`,rule.reason);
    for(const effect of rule.effects||[]) effects.add(effect);
  }

  const supportRank={NONE:0,WEAK:1,MODERATE:2,STRONG:3};
  const support=supportRank[context.independentCurrentSupport]??0;
  let betEligible=true;
  if(state==='UNQUANTIFIED') betEligible=false;
  if(state==='HIGH' && (support<3 || context.fairValueBasis==='MARKET_DERIVED_ONLY')) betEligible=false;
  if(state==='ELEVATED' && support<2) betEligible=false;
  if(effects.has('PROHIBIT_MARKET_ONLY_BET') && context.fairValueBasis==='MARKET_DERIVED_ONLY') betEligible=false;

  return {
    modelErrorState:state,
    betEligibleByModelError:betEligible,
    effects:[...effects].sort(),
    appliedRules,
    reasons
  };
}

function validateContext(framework,context,label){
  const c=framework.controlledValues;
  for(const key of ['fairValueBasis','bookDispersion','liquidityRisk','tailRisk','directCalibration','personnelSensitivity','independentCurrentSupport']){
    assert((c[key]||[]).includes(context[key]),`${label} has invalid ${key}: ${context[key]}`);
  }
  assert(nonEmpty(context.sport),`${label} sport is required`);
  assert(nonEmpty(context.marketClass),`${label} marketClass is required`);
  assert(nonEmpty(context.marketDetail),`${label} marketDetail is required`);
  assert(nonEmpty(context.timing),`${label} timing is required`);
  assert(typeof context.movementPrimaryEvidence==='boolean',`${label} movementPrimaryEvidence must be boolean`);
  assert(typeof context.historicalDirectionalRecalibrationPrimary==='boolean',`${label} historicalDirectionalRecalibrationPrimary must be boolean`);
  assert(Array.isArray(context.graduatedResearchIds),`${label} graduatedResearchIds must be an array`);
}

function selfTest(frameworkFile=DEFAULT_FRAMEWORK,casesFile=DEFAULT_CASES){
  const framework=readJson(frameworkFile);
  const cases=readJson(casesFile);
  const library=readJson(LIBRARY);
  const manifest=readJson(MANIFEST);
  validateFramework(framework,library,manifest);
  assert(cases.frameworkId===framework.frameworkId,'Test suite frameworkId mismatch');
  assert(Array.isArray(cases.cases)&&cases.cases.length>0,'Test suite must contain cases');

  const failures=[];
  for(const test of cases.cases){
    validateContext(framework,test.context,`Case ${test.id}`);
    const actual=evaluate(framework,test.context);
    const expected=test.expected||{};
    if(actual.modelErrorState!==expected.modelErrorState){
      failures.push(`${test.id}: modelErrorState expected ${expected.modelErrorState}, got ${actual.modelErrorState}`);
    }
    if(actual.betEligibleByModelError!==expected.betEligibleByModelError){
      failures.push(`${test.id}: betEligible expected ${expected.betEligibleByModelError}, got ${actual.betEligibleByModelError}`);
    }
    for(const effect of expected.requiredEffects||[]){
      if(!actual.effects.includes(effect)) failures.push(`${test.id}: missing effect ${effect}`);
    }
  }
  if(failures.length) fail(`Core handicap framework self-test failed:\n${failures.join('\n')}`);
  console.log(`CORE HANDICAP FRAMEWORK SELF-TEST OK ${cases.cases.length} cases framework=${framework.frameworkId}`);
}

function main(){
  const [command='self-test',frameworkFile=DEFAULT_FRAMEWORK,casesFile=DEFAULT_CASES]=process.argv.slice(2);
  if(command==='self-test') return selfTest(path.resolve(frameworkFile),path.resolve(casesFile));
  if(command==='evaluate'){
    const framework=readJson(path.resolve(frameworkFile));
    const context=JSON.parse(fs.readFileSync(0,'utf8'));
    validateContext(framework,context,'stdin context');
    console.log(JSON.stringify(evaluate(framework,context),null,2));
    return;
  }
  fail('Usage: core-handicap-framework.mjs self-test [FRAMEWORK] [CASES] | evaluate FRAMEWORK < context.json');
}

try{main()}catch(error){console.error(`CORE HANDICAP FRAMEWORK ERROR: ${error.message}`);process.exit(1)}
