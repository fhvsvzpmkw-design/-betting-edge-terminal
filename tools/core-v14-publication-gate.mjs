#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {evaluate, loadProductionFramework, matchCondition, validateContext} from './core-handicap-framework.mjs';

const CORE_V14_FROM=Date.parse('2026-08-25T17:20:00-07:00');
const PROD_PATH='core/core-v1.4-production.json';
const SHA40=/^[0-9a-f]{40}$/i;
const WALTERS_MODES=new Set(['OFF','ADVISORY','BET_AUTHORITY']);
const WALTERS_AVAILABILITY=new Set(['AVAILABLE','PARTIAL','UNAVAILABLE','OFF','NOT_APPLICABLE']);
const WALTERS_CONTRIBUTION=new Set(['NONE','ADVISORY_ONLY','CORE_FAIR_INPUT','BET_ORIGINATOR']);
const WALTERS_COMPARISON=new Set(['ALIGNED','MIXED','CONFLICT','NOT_COMPARABLE','UNAVAILABLE','OFF']);

function fail(message){throw new Error(message)}
function assert(condition,message){if(!condition) fail(message)}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function nonEmpty(value){return typeof value==='string'&&value.trim().length>0}
function validTimestamp(value,label){assert(nonEmpty(value)&&Number.isFinite(Date.parse(value)),`${label} must be a valid timestamp`)}
function gitBlobSha(file){const data=fs.readFileSync(file);return crypto.createHash('sha1').update(Buffer.from(`blob ${data.length}\0`)).update(data).digest('hex')}
function setEqual(a,b){return a.size===b.size&&[...a].every(value=>b.has(value))}
function parseArgs(argv){
  const [command,...rest]=argv;
  const args={command};
  for(let i=0;i<rest.length;i++){
    const token=rest[i];
    if(!token.startsWith('--')) fail(`Unexpected argument ${token}`);
    const key=token.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    const next=rest[i+1];
    if(next&&!next.startsWith('--')){args[key]=next;i++;}else args[key]=true;
  }
  return args;
}

function loadRuntime(root){
  const prodFile=path.join(root,PROD_PATH);
  assert(fs.existsSync(prodFile),`Missing Core 1.4 production manifest: ${PROD_PATH}`);
  const prod=readJson(prodFile);
  assert(prod.schema===1&&prod.coreVersion==='1.4'&&prod.state==='OPERATIONAL','Core 1.4 production manifest is not operational');
  assert(Date.parse(prod.activatedAt)===CORE_V14_FROM,'Core 1.4 activation timestamp drifted');

  const framework=loadProductionFramework();
  assert(framework.frameworkId===prod.modelErrorFramework.frameworkId,'Core 1.4 framework ID does not match production manifest');
  const frameworkFile=path.join(root,prod.modelErrorFramework.path);
  assert(gitBlobSha(frameworkFile)===prod.modelErrorFramework.blobSha,'Core 1.4 model-error framework blob drifted from production manifest');

  const libraryFile=path.join(root,prod.researchLibrary.path);
  const researchManifestFile=path.join(root,prod.researchLibrary.manifestPath);
  assert(gitBlobSha(libraryFile)===prod.researchLibrary.blobSha,'Core 1.4 Research Library blob drifted from production manifest');
  assert(gitBlobSha(researchManifestFile)===prod.researchLibrary.manifestBlobSha,'Core 1.4 research manifest blob drifted from production manifest');

  const interfaceFile=path.join(root,prod.walters.interfacePath);
  const authorityFile=path.join(root,prod.walters.authorityPath);
  assert(gitBlobSha(interfaceFile)===prod.walters.interfaceBlobSha,'Walters interface blob drifted from Core 1.4 production manifest');
  const waltersInterface=readJson(interfaceFile);
  const waltersAuthority=readJson(authorityFile);
  assert(waltersInterface.state==='OPERATIONAL'&&waltersInterface.targetCoreVersion==='1.4','Walters interface is not operational for Core 1.4');
  assert(waltersAuthority.state==='OPERATIONAL'&&waltersAuthority.targetCoreVersion==='1.4','Walters authority config is not operational for Core 1.4');
  assert(WALTERS_MODES.has(waltersAuthority.mode),`Invalid Walters runtime mode ${waltersAuthority.mode}`);

  return {root,prod,prodFile,framework,frameworkFile,libraryFile,researchManifestFile,waltersInterface,interfaceFile,waltersAuthority,authorityFile};
}

function expectedResearchIds(framework,context){
  return [...new Set((framework.graduatedResearchRules||[]).filter(rule=>matchCondition(rule.when,context)).map(rule=>rule.priorId))].sort();
}

function validateCoreAssessment(runtime,assessment,rec,index,{recompute=true}={}){
  assert(assessment&&typeof assessment==='object'&&!Array.isArray(assessment),`Recommendation ${index+1} requires coreAssessment under Core 1.4`);
  assert(assessment.frameworkId===runtime.framework.frameworkId,`Recommendation ${index+1} coreAssessment.frameworkId mismatch`);
  assert(assessment.context&&typeof assessment.context==='object'&&!Array.isArray(assessment.context),`Recommendation ${index+1} coreAssessment.context is required`);
  validateContext(runtime.framework,assessment.context,`Recommendation ${index+1} Core 1.4 context`);
  const allowedResearchIds=new Set((runtime.framework.graduatedResearchRules||[]).map(rule=>rule.priorId));
  for(const priorId of assessment.context.graduatedResearchIds){
    assert(allowedResearchIds.has(priorId),`Recommendation ${index+1} uses non-graduated research ID ${priorId} in Core 1.4`);
  }
  const expectedIds=expectedResearchIds(runtime.framework,assessment.context);
  assert(setEqual(new Set(assessment.context.graduatedResearchIds),new Set(expectedIds)),`Recommendation ${index+1} graduatedResearchIds must equal the automatically applicable Core 1.4 allowlist: ${expectedIds.join(',')||'none'}`);
  assert(nonEmpty(assessment.fairValueBasisRationale),`Recommendation ${index+1} coreAssessment.fairValueBasisRationale is required`);
  assert(nonEmpty(assessment.uncertaintyStatement),`Recommendation ${index+1} coreAssessment.uncertaintyStatement is required`);
  assert(nonEmpty(assessment.rationale),`Recommendation ${index+1} coreAssessment.rationale is required`);
  assert(typeof assessment.betEligibleByModelError==='boolean',`Recommendation ${index+1} coreAssessment.betEligibleByModelError must be boolean`);
  assert(Array.isArray(assessment.effects),`Recommendation ${index+1} coreAssessment.effects must be an array`);
  assert(Array.isArray(assessment.appliedRules),`Recommendation ${index+1} coreAssessment.appliedRules must be an array`);
  assert(Array.isArray(assessment.reasons),`Recommendation ${index+1} coreAssessment.reasons must be an array`);

  if(recompute){
    const actual=evaluate(runtime.framework,assessment.context);
    assert(assessment.modelErrorState===actual.modelErrorState,`Recommendation ${index+1} Core 1.4 modelErrorState mismatch: recorded=${assessment.modelErrorState} computed=${actual.modelErrorState}`);
    assert(assessment.betEligibleByModelError===actual.betEligibleByModelError,`Recommendation ${index+1} Core 1.4 bet eligibility mismatch`);
    assert(setEqual(new Set(assessment.effects),new Set(actual.effects)),`Recommendation ${index+1} Core 1.4 effects do not match framework evaluation`);
    assert(setEqual(new Set(assessment.appliedRules),new Set(actual.appliedRules)),`Recommendation ${index+1} Core 1.4 appliedRules do not match framework evaluation`);
  }else{
    assert(runtime.framework.modelErrorOrder.includes(assessment.modelErrorState),`Recommendation ${index+1} invalid Core 1.4 modelErrorState`);
  }

  const status=String(rec?.status||'').toUpperCase();
  if(status==='BET') assert(assessment.betEligibleByModelError===true,`Recommendation ${index+1} BET is blocked by Core 1.4 model-error gate`);
  if(status==='WAIT'&&assessment.modelErrorState==='HIGH'){
    assert(['MODERATE','STRONG'].includes(assessment.context.independentCurrentSupport),`Recommendation ${index+1} HIGH-error WAIT requires at least moderate independent current support`);
  }
}

function validateWaltersEvidence(runtime,evidence,assessment,rec,index,mode){
  assert(evidence&&typeof evidence==='object'&&!Array.isArray(evidence),`Recommendation ${index+1} requires waltersEvidence under Core 1.4`);
  assert(typeof evidence.applicable==='boolean',`Recommendation ${index+1} waltersEvidence.applicable must be boolean`);
  assert(evidence.mode===mode,`Recommendation ${index+1} Walters mode does not match report provenance`);
  assert(WALTERS_AVAILABILITY.has(evidence.availability),`Recommendation ${index+1} invalid Walters availability ${evidence.availability}`);
  assert(typeof evidence.originatedCandidate==='boolean',`Recommendation ${index+1} waltersEvidence.originatedCandidate must be boolean`);
  assert(WALTERS_CONTRIBUTION.has(evidence.contribution),`Recommendation ${index+1} invalid Walters contribution ${evidence.contribution}`);
  assert(WALTERS_COMPARISON.has(evidence.comparisonState),`Recommendation ${index+1} invalid Walters comparisonState ${evidence.comparisonState}`);
  assert(nonEmpty(evidence.reviewImpact),`Recommendation ${index+1} waltersEvidence.reviewImpact is required`);

  const context=assessment.context;
  const eligible=context.sport==='NFL'&&['spread','moneyline'].includes(context.marketClass);
  if(eligible){
    assert(evidence.applicable===true,`Recommendation ${index+1} NFL ${context.marketClass} must resolve Walters availability under Core 1.4`);
    if(mode==='OFF'){
      assert(evidence.availability==='OFF',`Recommendation ${index+1} Walters OFF mode must record availability OFF`);
      assert(evidence.originatedCandidate===false,`Recommendation ${index+1} Walters OFF mode cannot originate a candidate`);
    }else{
      assert(['AVAILABLE','PARTIAL','UNAVAILABLE'].includes(evidence.availability),`Recommendation ${index+1} eligible Walters market must record AVAILABLE/PARTIAL/UNAVAILABLE`);
    }
  }else{
    assert(evidence.applicable===false,`Recommendation ${index+1} Walters is currently applicable only to NFL spread/moneyline`);
    assert(evidence.availability==='NOT_APPLICABLE',`Recommendation ${index+1} non-Walters market must record NOT_APPLICABLE`);
    assert(evidence.originatedCandidate===false,`Recommendation ${index+1} non-Walters market cannot be Walters-originated`);
    assert(evidence.contribution==='NONE',`Recommendation ${index+1} non-Walters market must record contribution NONE`);
  }

  if(evidence.originatedCandidate){
    assert(mode==='BET_AUTHORITY',`Recommendation ${index+1} Walters candidate origination requires BET_AUTHORITY mode`);
    assert(eligible&&evidence.availability==='AVAILABLE',`Recommendation ${index+1} Walters-originated candidate requires eligible AVAILABLE Walters analysis`);
    assert(evidence.contribution==='BET_ORIGINATOR',`Recommendation ${index+1} Walters-originated candidate must record BET_ORIGINATOR`);
    assert(evidence.waltersFair!==null&&evidence.waltersFair!==undefined,`Recommendation ${index+1} Walters-originated candidate requires waltersFair`);
    assert(nonEmpty(evidence.proposedMarket)&&nonEmpty(evidence.proposedSelection),`Recommendation ${index+1} Walters-originated candidate requires proposedMarket and proposedSelection`);
    assert(nonEmpty(evidence.betRationale),`Recommendation ${index+1} Walters-originated candidate requires betRationale`);
    validTimestamp(evidence.sourceAsOf,`Recommendation ${index+1} Walters sourceAsOf`);
    validTimestamp(evidence.generatedAt,`Recommendation ${index+1} Walters generatedAt`);
    assert(Date.parse(evidence.sourceAsOf)<=Date.parse(rec.__reportTs),`Recommendation ${index+1} Walters sourceAsOf cannot be after report issuance`);
    assert(Date.parse(evidence.generatedAt)<=Date.parse(rec.__reportTs),`Recommendation ${index+1} Walters generatedAt cannot be after report issuance`);
    assert(assessment.context.fairValueBasis==='INDEPENDENT_MODEL',`Recommendation ${index+1} Walters-originated candidate must use an independent fair-value basis`);
  }else{
    assert(evidence.betRationale===null||evidence.betRationale===undefined||nonEmpty(evidence.betRationale),`Recommendation ${index+1} Walters betRationale must be null/omitted or non-empty`);
  }

  if(evidence.contribution==='CORE_FAIR_INPUT'){
    assert(mode==='BET_AUTHORITY'&&evidence.availability==='AVAILABLE',`Recommendation ${index+1} CORE_FAIR_INPUT requires AVAILABLE BET_AUTHORITY Walters analysis`);
    assert(evidence.waltersFair!==null&&evidence.waltersFair!==undefined,`Recommendation ${index+1} CORE_FAIR_INPUT requires waltersFair`);
    assert(evidence.coreFairBeforeWalters!==null&&evidence.coreFairBeforeWalters!==undefined,`Recommendation ${index+1} CORE_FAIR_INPUT requires coreFairBeforeWalters`);
    assert(evidence.coreFairAfterWalters!==null&&evidence.coreFairAfterWalters!==undefined,`Recommendation ${index+1} CORE_FAIR_INPUT requires coreFairAfterWalters`);
  }
}

function validateProvenance(runtime,provenance,{compareCurrent}){
  assert(provenance&&typeof provenance==='object','Core 1.4 sidecar provenance is required');
  assert(provenance.coreVersion==='1.4','Post-cutover report must declare coreVersion 1.4');
  assert(provenance.coreProductionPath===PROD_PATH,'Core 1.4 coreProductionPath is invalid');
  assert(SHA40.test(String(provenance.coreProductionBlobSha||'')),'Core 1.4 coreProductionBlobSha must be a Git blob SHA');
  assert(provenance.coreFrameworkPath===runtime.prod.modelErrorFramework.path,'Core 1.4 coreFrameworkPath is invalid');
  assert(SHA40.test(String(provenance.coreFrameworkBlobSha||'')),'Core 1.4 coreFrameworkBlobSha must be a Git blob SHA');
  assert(provenance.researchLibraryVersion===runtime.prod.researchLibrary.version,'Core 1.4 requires Research Library v1.8');
  assert(SHA40.test(String(provenance.researchLibraryBlobSha||'')),'Core 1.4 researchLibraryBlobSha is required');
  assert(SHA40.test(String(provenance.researchManifestBlobSha||'')),'Core 1.4 researchManifestBlobSha is required');
  assert(provenance.waltersInterfacePath===runtime.prod.walters.interfacePath,'Core 1.4 waltersInterfacePath is invalid');
  assert(SHA40.test(String(provenance.waltersInterfaceBlobSha||'')),'Core 1.4 waltersInterfaceBlobSha must be a Git blob SHA');
  assert(provenance.waltersAuthorityPath===runtime.prod.walters.authorityPath,'Core 1.4 waltersAuthorityPath is invalid');
  assert(SHA40.test(String(provenance.waltersAuthorityBlobSha||'')),'Core 1.4 waltersAuthorityBlobSha must be a Git blob SHA');
  assert(WALTERS_MODES.has(provenance.waltersMode),`Invalid report Walters mode ${provenance.waltersMode}`);

  if(compareCurrent){
    assert(provenance.coreProductionBlobSha===gitBlobSha(runtime.prodFile),'Core 1.4 report did not use the current production manifest blob');
    assert(provenance.coreFrameworkBlobSha===gitBlobSha(runtime.frameworkFile),'Core 1.4 report did not use the current model-error framework blob');
    assert(provenance.researchLibraryBlobSha===gitBlobSha(runtime.libraryFile),'Core 1.4 report did not use the current Research Library blob');
    assert(provenance.researchManifestBlobSha===gitBlobSha(runtime.researchManifestFile),'Core 1.4 report did not use the current research manifest blob');
    assert(provenance.waltersInterfaceBlobSha===gitBlobSha(runtime.interfaceFile),'Core 1.4 report did not use the current Walters interface blob');
    assert(provenance.waltersAuthorityBlobSha===gitBlobSha(runtime.authorityFile),'Core 1.4 report did not use the current Walters authority blob');
    assert(provenance.waltersMode===runtime.waltersAuthority.mode,`Report Walters mode ${provenance.waltersMode} does not match current runtime mode ${runtime.waltersAuthority.mode}`);
  }
}

function validateBundle(runtime,report,sidecar,{compareCurrent=true,recompute=true,collectRecommendationErrors=false}={}){
  const reportMs=Date.parse(report?.ts);
  assert(Number.isFinite(reportMs),'Report ts must be valid');
  if(reportMs<CORE_V14_FROM) return {core14:false};
  assert(sidecar?.schema===3,'Core 1.4 production requires schema-3 sidecar');
  validateProvenance(runtime,sidecar.provenance,{compareCurrent});
  assert(Array.isArray(report.recs)&&Array.isArray(sidecar.recommendations),'Core 1.4 report/sidecar recommendations are required');
  assert(report.recs.length===sidecar.recommendations.length,'Core 1.4 sidecar recommendation count mismatch');
  const recommendationErrors=[];
  for(let i=0;i<report.recs.length;i++){
    const rec={...report.recs[i],__reportTs:report.ts};
    const item=sidecar.recommendations[i];
    const validateRecommendation=()=>{
      assert(String(item?.status||'').toUpperCase()===String(rec?.status||'').toUpperCase(),`Recommendation ${i+1} status mismatch between report and sidecar`);
      validateCoreAssessment(runtime,item.coreAssessment,rec,i,{recompute});
      validateWaltersEvidence(runtime,item.waltersEvidence,item.coreAssessment,rec,i,sidecar.provenance.waltersMode);
    };
    if(!collectRecommendationErrors){
      validateRecommendation();
      continue;
    }
    try{validateRecommendation();}
    catch(error){recommendationErrors.push(`recommendation ${i+1} ${rec?.title||'UNKNOWN'}: ${error.message}`);}
  }
  if(recommendationErrors.length){
    fail(`Core 1.4 bundle contains ${recommendationErrors.length} recommendation defect(s):\n- ${recommendationErrors.join('\n- ')}`);
  }
  return {core14:true};
}

function syntheticProvenance(runtime){
  return {
    coreVersion:'1.4',
    coreProductionPath:PROD_PATH,
    coreProductionBlobSha:gitBlobSha(runtime.prodFile),
    coreFrameworkPath:runtime.prod.modelErrorFramework.path,
    coreFrameworkBlobSha:gitBlobSha(runtime.frameworkFile),
    researchLibraryVersion:runtime.prod.researchLibrary.version,
    researchLibraryBlobSha:gitBlobSha(runtime.libraryFile),
    researchManifestBlobSha:gitBlobSha(runtime.researchManifestFile),
    waltersInterfacePath:runtime.prod.walters.interfacePath,
    waltersInterfaceBlobSha:gitBlobSha(runtime.interfaceFile),
    waltersAuthorityPath:runtime.prod.walters.authorityPath,
    waltersAuthorityBlobSha:gitBlobSha(runtime.authorityFile),
    waltersMode:runtime.waltersAuthority.mode
  };
}

function buildAssessment(runtime,context){
  const expectedIds=expectedResearchIds(runtime.framework,context);
  const normalized={...context,graduatedResearchIds:expectedIds};
  const result=evaluate(runtime.framework,normalized);
  return {frameworkId:runtime.framework.frameworkId,context:normalized,fairValueBasisRationale:'Synthetic independent fair-value basis for gate regression.',uncertaintyStatement:'Synthetic uncertainty statement for gate regression.',rationale:'Synthetic Core 1.4 assessment.',...result};
}

function expectFailure(fn,label){let failed=false;try{fn()}catch{failed=true}assert(failed,label)}

function selfTest(root){
  const runtime=loadRuntime(root);
  assert(runtime.waltersAuthority.mode==='BET_AUTHORITY','Core 1.4 launch regression expects Walters BET_AUTHORITY active');

  const context={sport:'NFL',marketClass:'spread',marketDetail:'spread',timing:'pregame',fairValueBasis:'INDEPENDENT_MODEL',bookDispersion:'NONE',liquidityRisk:'NORMAL',tailRisk:'NORMAL',directCalibration:'DIRECT',personnelSensitivity:'RESOLVED',independentCurrentSupport:'STRONG',movementPrimaryEvidence:false,historicalDirectionalRecalibrationPrimary:false,graduatedResearchIds:[]};
  const assessment=buildAssessment(runtime,context);
  const report={ts:'2026-08-25T18:15:01-07:00',recs:[{status:'BET',title:'Synthetic NFL Home -3'}]};
  const evidence={applicable:true,mode:'BET_AUTHORITY',availability:'AVAILABLE',originatedCandidate:true,contribution:'BET_ORIGINATOR',waltersFair:-4.5,coreFairBeforeWalters:null,coreFairAfterWalters:-4.5,comparisonState:'ALIGNED',reviewImpact:'Walters originated the synthetic candidate.',betRationale:'Independent Walters fair clears the synthetic market after uncertainty.',proposedMarket:'spread',proposedSelection:'Home -3',sourceAsOf:'2026-08-25T17:55:00-07:00',generatedAt:'2026-08-25T18:00:00-07:00'};
  const sidecar={schema:3,provenance:syntheticProvenance(runtime),recommendations:[{status:'BET',coreAssessment:assessment,waltersEvidence:evidence}]};
  validateBundle(runtime,report,sidecar,{compareCurrent:true,recompute:true});

  const wrongState={...sidecar,recommendations:[{...sidecar.recommendations[0],coreAssessment:{...assessment,modelErrorState:'HIGH'}}]};
  expectFailure(()=>validateBundle(runtime,report,wrongState,{compareCurrent:true,recompute:true}),'Core 1.4 gate must reject a forged model-error state');

  const marketDerived={...context,fairValueBasis:'MARKET_DERIVED_ONLY',independentCurrentSupport:'WEAK'};
  const marketAssessment=buildAssessment(runtime,marketDerived);
  const blockedSidecar={...sidecar,recommendations:[{...sidecar.recommendations[0],coreAssessment:marketAssessment,waltersEvidence:{...evidence,originatedCandidate:false,contribution:'NONE',betRationale:null}}]};
  expectFailure(()=>validateBundle(runtime,report,blockedSidecar,{compareCurrent:true,recompute:true}),'Core 1.4 gate must reject BET when model-error layer blocks it');

  const nonApplicableContext={sport:'MLB',marketClass:'moneyline',marketDetail:'moneyline',timing:'pregame',fairValueBasis:'MARKET_ANCHORED_MODEL',bookDispersion:'NONE',liquidityRisk:'NORMAL',tailRisk:'NORMAL',directCalibration:'DIRECT',personnelSensitivity:'RESOLVED',independentCurrentSupport:'STRONG',movementPrimaryEvidence:false,historicalDirectionalRecalibrationPrimary:false,graduatedResearchIds:[]};
  const passReport={ts:'2026-08-25T18:15:02-07:00',recs:[{status:'PASS',title:'Synthetic MLB'}]};
  const passSidecar={schema:3,provenance:syntheticProvenance(runtime),recommendations:[{status:'PASS',coreAssessment:buildAssessment(runtime,nonApplicableContext),waltersEvidence:{applicable:false,mode:'BET_AUTHORITY',availability:'NOT_APPLICABLE',originatedCandidate:false,contribution:'NONE',waltersFair:null,coreFairBeforeWalters:null,coreFairAfterWalters:null,comparisonState:'NOT_COMPARABLE',reviewImpact:'NOT APPLICABLE',betRationale:null}}]};
  validateBundle(runtime,passReport,passSidecar,{compareCurrent:true,recompute:true});
  console.log('CORE 1.4 PUBLICATION GATE SELF-TEST OK');
}

function verifyHistory(root){
  const runtime=loadRuntime(root);
  const index=readJson(path.join(root,'run-history.json'));
  const errors=[];
  let checked=0;
  for(const [entryIndex,entry] of (index.runs||[]).entries()){
    if(Date.parse(entry.ts)<CORE_V14_FROM) continue;
    try{
      const report=readJson(path.join(root,entry.path));
      assert(entry.researchFitPath,`Core 1.4 indexed report is missing sidecar ${entry.id}`);
      const sidecar=readJson(path.join(root,entry.researchFitPath));
      const currentFramework=sidecar.provenance?.coreFrameworkBlobSha===gitBlobSha(runtime.frameworkFile);
      validateBundle(runtime,report,sidecar,{compareCurrent:false,recompute:currentFramework,collectRecommendationErrors:true});
      checked++;
    }catch(error){
      errors.push(`index[${entryIndex}] ${entry?.id||entry?.ts||'UNKNOWN'}: ${error.message}`);
    }
  }
  if(errors.length){
    fail(`CORE 1.4 HISTORY VERIFY FOUND ${errors.length} bundle defect(s):\n- ${errors.join('\n- ')}`);
  }
  console.log(`CORE 1.4 HISTORY VERIFY OK ${checked} post-cutover bundles`);
}

function main(){
  const args=parseArgs(process.argv.slice(2));
  const root=path.resolve(args.root||process.cwd());
  if(args.command==='validate'){
    assert(nonEmpty(args.report)&&nonEmpty(args.sidecar),'validate requires --report FILE --sidecar FILE');
    const runtime=loadRuntime(root);
    const result=validateBundle(runtime,readJson(path.resolve(args.report)),readJson(path.resolve(args.sidecar)),{compareCurrent:true,recompute:true});
    console.log(result.core14?'CORE 1.4 PUBLICATION GATE OK':'CORE 1.4 GATE NOT APPLICABLE — HISTORICAL CORE 1.3');
    return;
  }
  if(args.command==='verify-history') return verifyHistory(root);
  if(args.command==='self-test') return selfTest(root);
  fail('Usage: core-v14-publication-gate.mjs validate --report FILE --sidecar FILE [--root DIR] | verify-history [--root DIR] | self-test [--root DIR]');
}

try{main()}catch(error){console.error(`CORE 1.4 PUBLICATION GATE ERROR: ${error.message}`);process.exit(1)}
