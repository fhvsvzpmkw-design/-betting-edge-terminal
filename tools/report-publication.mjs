#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const STRICT_BUNDLE_FROM = Date.parse('2026-08-17T15:15:00-07:00');
// The 2026-08-22 18:15 lane remains the final same-day Contract v0.9 historical reference.
// All report bundles dated 2026-08-23 or later are Contract v1.0 production evidence.
const CONTRACT_V1_FROM = Date.parse('2026-08-23T00:00:00-07:00');
// The 2026-08-25 15:24:43 evening report is immutable historical evidence. Every later
// report must prove material Stage 2 personnel work before publication when the card
// still depends on lineup, participation, role, minutes, starter or identity context.
const STAGE2_EVIDENCE_FROM = Date.parse('2026-08-25T15:24:44-07:00');
// The same forward-only cutover also tightens WAIT semantics: WAIT must represent a
// genuinely live candidate with current independent non-market support, not merely a
// sportsbook outlier, cross-book gap or positive no-vig residual waiting on another gate.
const WAIT_QUALIFICATION_FROM = STAGE2_EVIDENCE_FROM;
const SLOT_CODES = Object.freeze({open:'o', main:'m', final_morning:'f', evening:'e', late:'l'});
const STATUS_KEYS = Object.freeze(['bet','lean','wait','pass']);
const SHA40 = /^[0-9a-f]{40}$/i;
const PERSONNEL_STATES = new Set(['CONFIRMED','STRONG PROJECTION','PARTIAL','UNKNOWN']);
const SOURCE_CONFLICT_STATES = new Set(['NONE','MINOR','MATERIAL']);
const PERSONNEL_SIGNAL = /\b(lineup|batting order|participation|role|minutes?|identity(?:-|\s)?context|starter|starting lineup|active\/inactive)\b/i;
const MARKET_ONLY_WAIT_ORIGIN = /\b(bet\s*365|draftkings|odds[-\s]?api(?:\.io)?|live[-\s]?odds|sportsbook(?:\s+pair)?|two[-\s]?book|no[-\s]?vig|market consensus|market-derived)\b/i;

function die(message){
  throw new Error(message);
}
function assert(condition, message){
  if(!condition) die(message);
}
function parseArgs(argv){
  const [command, ...rest] = argv;
  const args = {command};
  for(let i=0;i<rest.length;i++){
    const token = rest[i];
    if(!token.startsWith('--')) die(`Unexpected argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    const next = rest[i+1];
    if(next && !next.startsWith('--')){args[key]=next;i++;}
    else args[key]=true;
  }
  return args;
}
function readJson(file){
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){die(`Cannot parse JSON ${file}: ${error.message}`);}
}
function jsonText(value){return JSON.stringify(value,null,2)+'\n';}
function normalizedJson(value){return JSON.stringify(value);}
function ensureDir(file){fs.mkdirSync(path.dirname(file),{recursive:true});}
function writeAtomic(file,text){
  ensureDir(file);
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp,text,'utf8');
  fs.renameSync(temp,file);
}
function writeImmutableJson(file,value,label){
  if(fs.existsSync(file)){
    const existing = readJson(file);
    assert(normalizedJson(existing)===normalizedJson(value),`${label} already exists with different content: ${file}`);
    return false;
  }
  writeAtomic(file,jsonText(value));
  return true;
}
function validTimestamp(value,label){
  assert(typeof value==='string' && value.length>=20,`${label} must be an ISO timestamp`);
  assert(Number.isFinite(Date.parse(value)),`${label} is not parseable: ${value}`);
}
function reportDate(ts){return ts.slice(0,10);}
function reportClock(ts){
  const match = ts.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):(\d{2})/);
  assert(match,`run.ts must include HH:MM:SS: ${ts}`);
  return `${match[1]}${match[2]}${match[3]}`;
}
function expectedPaths(report){
  const date = reportDate(report.ts);
  const stem = `${report.slot}-${reportClock(report.ts)}`;
  return {
    reportPath:`data/history/runs/${date}/${stem}.json`,
    sidecarPath:`data/history/research-fit/${date}/${stem}.json`
  };
}
function shortId(report){
  const match = report.ts.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  assert(match,`Cannot derive short ID from ${report.ts}`);
  return `${match[1].slice(2)}${match[2]}${match[3]}${SLOT_CODES[report.slot]}${match[4]}${match[5]}${match[6]}`;
}
function expectedContractVersion(report){
  const reportMs = Date.parse(report?.ts);
  assert(Number.isFinite(reportMs),`Cannot resolve production contract version from report timestamp: ${report?.ts}`);
  return reportMs>=CONTRACT_V1_FROM ? '1.0' : '0.9';
}
function canonicalCounts(counts){
  assert(counts && typeof counts==='object' && !Array.isArray(counts),'Counts must be an object');
  const canonical={};
  for(const key of STATUS_KEYS){
    assert(Number.isInteger(counts[key]) && counts[key]>=0,`counts.${key} must be a non-negative integer`);
    canonical[key]=counts[key];
  }
  return canonical;
}
function countsEqual(left,right){
  if(!left || !right) return false;
  return STATUS_KEYS.every(key=>left[key]===right[key]);
}
function normalizeIndexCounts(index){
  let changed=false;
  for(const entry of index.runs||[]){
    const canonical=canonicalCounts(entry.counts);
    if(normalizedJson(entry.counts)!==normalizedJson(canonical)){
      entry.counts=canonical;
      changed=true;
    }
  }
  return changed;
}
function actualCounts(recs){
  const counts = {bet:0,lean:0,wait:0,pass:0};
  for(const [index,rec] of recs.entries()){
    const status = String(rec?.status||'').toLowerCase();
    assert(STATUS_KEYS.includes(status),`Recommendation ${index+1} has invalid status: ${rec?.status}`);
    counts[status]++;
  }
  return counts;
}
function verificationReport(report){
  const calculated=actualCounts(Array.isArray(report?.recs)?report.recs:[]);
  const existing=(report?.counts && typeof report.counts==='object' && !Array.isArray(report.counts))?report.counts:{};
  const canonical={};
  for(const key of STATUS_KEYS){
    const upper=key.toUpperCase();
    const hasLower=Object.hasOwn(existing,key);
    const hasUpper=Object.hasOwn(existing,upper);
    if(hasLower && hasUpper){
      assert(existing[key]===existing[upper],`Stored report has conflicting count keys ${key}/${upper}: ${report?.ts}`);
    }
    const value=hasLower?existing[key]:(hasUpper?existing[upper]:undefined);
    if(Number.isInteger(value) && value>=0){
      canonical[key]=value;
      continue;
    }
    assert(!hasLower && !hasUpper && calculated[key]===0,`Stored report counts.${key} is invalid or omits a non-zero value: ${report?.ts}`);
    canonical[key]=0;
  }
  return {...report,counts:canonical};
}
function validateReport(report){
  assert(report && typeof report==='object' && !Array.isArray(report),'Report must be a JSON object');
  assert(Object.hasOwn(SLOT_CODES,report.slot),`Invalid report slot: ${report.slot}`);
  assert(typeof report.label==='string' && report.label.trim(), 'Report label is required');
  validTimestamp(report.ts,'run.ts');
  validTimestamp(report.feedGeneratedAt,'feedGeneratedAt');
  assert(reportDate(report.ts)===report.ts.slice(0,10),'Report date derivation failed');
  assert(Number.isFinite(report.bankroll),'Report bankroll must be numeric');
  assert(Number.isFinite(report.risk) && report.risk>=0,'Report risk must be a non-negative number');
  assert(report.counts && typeof report.counts==='object','Report counts are required');
  assert(Array.isArray(report.recs),'Report recs must be an array');
  const calculated = actualCounts(report.recs);
  for(const key of STATUS_KEYS){
    assert(Number.isInteger(report.counts[key]) && report.counts[key]>=0,`Report counts.${key} must be a non-negative integer`);
    assert(report.counts[key]===calculated[key],`Report counts.${key}=${report.counts[key]} does not match recommendations=${calculated[key]}`);
  }
  return report;
}
function materialPersonnelSignal(rec){
  const text=[rec?.meta,rec?.playTo,rec?.support,rec?.contrary,rec?.analysis]
    .filter(value=>typeof value==='string' && value.trim())
    .join(' ');
  return PERSONNEL_SIGNAL.test(text);
}
function nonEmptyString(value){return typeof value==='string' && value.trim().length>0;}
function normalizePublicationSidecar(sidecar,report){
  if(!sidecar || typeof sidecar!=='object' || Array.isArray(sidecar)) return sidecar;
  const items=Array.isArray(sidecar.recommendations)?sidecar.recommendations:[];
  for(const [index,item] of items.entries()){
    const evidence=item?.personnelEvidence;
    if(evidence && evidence.sourceShortfall===false) evidence.sourceShortfall=null;
    if(item && typeof item==='object' && !Array.isArray(item) && report?.recs?.[index]){
      item.displayText=report.recs[index].hist;
    }
  }
  return sidecar;
}
function normalizedSourceOrigin(value){
  const normalized=String(value).trim().toLowerCase().replace(/\s+/g,' ');
  const withoutProtocol=normalized.replace(/^https?:\/\//,'').replace(/^www\./,'');
  return withoutProtocol.includes('.') ? withoutProtocol.split('/')[0] : withoutProtocol.replace(/\/+$/,'');
}
function validateWaitQualification(qualification,index){
  assert(qualification && typeof qualification==='object' && !Array.isArray(qualification),`Sidecar recommendation ${index+1} WAIT requires waitQualification before publication`);
  assert(qualification.actionableIfResolved===true,`Sidecar recommendation ${index+1} WAIT must be plausibly actionable if its blockers resolve`);
  assert(Array.isArray(qualification.blockers) && qualification.blockers.length>0,`Sidecar recommendation ${index+1} waitQualification.blockers must be a non-empty array`);
  for(const [blockerIndex,blocker] of qualification.blockers.entries()){
    assert(nonEmptyString(blocker),`Sidecar recommendation ${index+1} waitQualification.blockers[${blockerIndex}] must be non-empty`);
  }
  assert(Array.isArray(qualification.independentSignals) && qualification.independentSignals.length>0,`Sidecar recommendation ${index+1} WAIT requires at least one current independent non-market signal`);
  for(const [signalIndex,signal] of qualification.independentSignals.entries()){
    assert(signal && typeof signal==='object' && !Array.isArray(signal),`Sidecar recommendation ${index+1} waitQualification.independentSignals[${signalIndex}] must be an object`);
    assert(nonEmptyString(signal.origin),`Sidecar recommendation ${index+1} waitQualification.independentSignals[${signalIndex}].origin is required`);
    assert(nonEmptyString(signal.finding),`Sidecar recommendation ${index+1} waitQualification.independentSignals[${signalIndex}].finding is required`);
    assert(!MARKET_ONLY_WAIT_ORIGIN.test(signal.origin),`Sidecar recommendation ${index+1} WAIT independent signal cannot be a sportsbook, odds feed, no-vig calculation or market consensus`);
  }
  assert(nonEmptyString(qualification.rationale),`Sidecar recommendation ${index+1} waitQualification.rationale is required`);
}
function validatePersonnelEvidence(evidence,index){
  assert(evidence && typeof evidence==='object' && !Array.isArray(evidence),`Sidecar recommendation ${index+1} requires personnelEvidence before publication`);
  validTimestamp(evidence.stage2CheckedAt,`Sidecar recommendation ${index+1} personnelEvidence.stage2CheckedAt`);
  assert(nonEmptyString(evidence.dependencyTarget),`Sidecar recommendation ${index+1} personnelEvidence.dependencyTarget is required`);
  assert(nonEmptyString(evidence.dependencyRationale),`Sidecar recommendation ${index+1} personnelEvidence.dependencyRationale is required`);
  assert(Array.isArray(evidence.officialSources) && evidence.officialSources.length>0,`Sidecar recommendation ${index+1} personnelEvidence.officialSources must contain at least one authoritative source`);
  assert(Array.isArray(evidence.fallbackSources),`Sidecar recommendation ${index+1} personnelEvidence.fallbackSources must be an array`);
  const fallbackOrigins=evidence.fallbackSources.map((source,sourceIndex)=>{
    assert(source && typeof source==='object' && !Array.isArray(source),`Sidecar recommendation ${index+1} personnelEvidence.fallbackSources[${sourceIndex}] must be an object`);
    assert(nonEmptyString(source.origin),`Sidecar recommendation ${index+1} personnelEvidence.fallbackSources[${sourceIndex}].origin is required`);
    return normalizedSourceOrigin(source.origin);
  });
  assert(new Set(fallbackOrigins).size===fallbackOrigins.length,`Sidecar recommendation ${index+1} personnelEvidence.fallbackSources must use distinct source origins`);
  assert(Number.isInteger(evidence.fallbackSourceCount) && evidence.fallbackSourceCount>=0,`Sidecar recommendation ${index+1} personnelEvidence.fallbackSourceCount must be a non-negative integer`);
  assert(evidence.fallbackSourceCount===evidence.fallbackSources.length,`Sidecar recommendation ${index+1} personnelEvidence.fallbackSourceCount must match fallbackSources length`);
  assert(evidence.sourceShortfall===null || nonEmptyString(evidence.sourceShortfall),`Sidecar recommendation ${index+1} personnelEvidence.sourceShortfall must be null or a non-empty explanation`);
  assert(Array.isArray(evidence.facts),`Sidecar recommendation ${index+1} personnelEvidence.facts must be an array`);
  assert(PERSONNEL_STATES.has(evidence.personnelState),`Sidecar recommendation ${index+1} personnelEvidence.personnelState is invalid`);
  assert(SOURCE_CONFLICT_STATES.has(evidence.sourceConflict),`Sidecar recommendation ${index+1} personnelEvidence.sourceConflict is invalid`);
  assert(Array.isArray(evidence.unresolved),`Sidecar recommendation ${index+1} personnelEvidence.unresolved must be an array`);
  assert(nonEmptyString(evidence.decisionSensitivity),`Sidecar recommendation ${index+1} personnelEvidence.decisionSensitivity is required`);
  assert(nonEmptyString(evidence.preStage2Fair),`Sidecar recommendation ${index+1} personnelEvidence.preStage2Fair is required`);
  assert(nonEmptyString(evidence.postStage2Fair),`Sidecar recommendation ${index+1} personnelEvidence.postStage2Fair is required`);
  assert(nonEmptyString(evidence.decisionImpact),`Sidecar recommendation ${index+1} personnelEvidence.decisionImpact is required`);

  const unresolvedMaterial=evidence.personnelState!=='CONFIRMED' || evidence.unresolved.length>0;
  if(unresolvedMaterial){
    const hasDepth=evidence.fallbackSourceCount>=3;
    const hasShortfall=nonEmptyString(evidence.sourceShortfall);
    assert(hasDepth || hasShortfall,`Sidecar recommendation ${index+1} Stage 2 unresolved personnel requires at least 3 fallback sources or an explicit sourceShortfall`);
    if(!hasDepth){
      assert(['PARTIAL','UNKNOWN'].includes(evidence.personnelState),`Sidecar recommendation ${index+1} cannot claim ${evidence.personnelState} with fewer than 3 fallback sources`);
    }
  }
  if(evidence.sourceConflict==='MATERIAL'){
    assert(evidence.personnelState!=='STRONG PROJECTION',`Sidecar recommendation ${index+1} cannot claim STRONG PROJECTION with MATERIAL source conflict`);
  }
}
function validateSidecar(sidecar,report,reportPath,{strict=false}={}){
  assert(sidecar && typeof sidecar==='object' && !Array.isArray(sidecar),'Sidecar must be a JSON object');
  assert(sidecar.schema===2 || sidecar.schema===3,`Unsupported sidecar schema: ${sidecar.schema}`);
  const ref = sidecar.reportReference;
  assert(ref && typeof ref==='object','Sidecar reportReference is required');
  assert(ref.slot===report.slot,'Sidecar slot does not match report');
  assert(ref.label===report.label,'Sidecar label does not match report');
  assert(ref.ts===report.ts,'Sidecar ts does not match report');
  assert(ref.reportPath===reportPath,'Sidecar reportPath does not match report path');
  assert(ref.feedGeneratedAt===report.feedGeneratedAt,'Sidecar feedGeneratedAt does not match report');
  assert(Array.isArray(sidecar.recommendations),'Sidecar recommendations must be an array');

  if(sidecar.schema===3 || strict){
    assert(sidecar.schema===3,'Strict bundle publication requires schema 3');
    const provenance = sidecar.provenance;
    assert(provenance && typeof provenance==='object','Schema-3 provenance is required');
    const requiredContractVersion = expectedContractVersion(report);
    assert(
      provenance.productionContractVersion===requiredContractVersion,
      `Schema-3 productionContractVersion must be ${requiredContractVersion} for report ${report.ts}`
    );
    assert(provenance.productionContractOperational===true,'Schema-3 production contract must be operational');
    assert(provenance.productionContractPath==='BETTING_EDGE_CONTRACT.md','Schema-3 production contract path is invalid');
    assert(SHA40.test(String(provenance.productionContractBlobSha||'')),'Schema-3 productionContractBlobSha must be a Git SHA');
    assert(SHA40.test(String(provenance.feedBlobSha||'')),'Schema-3 feedBlobSha must be a Git SHA');
    assert(typeof provenance.researchLibraryVersion==='string' && provenance.researchLibraryVersion,'Schema-3 researchLibraryVersion is required');

    const stage2Enforced=Date.parse(report.ts)>=STAGE2_EVIDENCE_FROM;
    const waitQualificationEnforced=Date.parse(report.ts)>=WAIT_QUALIFICATION_FROM;
    if(stage2Enforced){
      assert(provenance.personnelSweepPath==='BETTING_EDGE_PERSONNEL_SWEEP.md','Schema-3 personnelSweepPath is required after the Stage 2 publication-gate cutover');
      assert(SHA40.test(String(provenance.personnelSweepBlobSha||'')),'Schema-3 personnelSweepBlobSha must be a Git SHA after the Stage 2 publication-gate cutover');
    }

    assert(sidecar.recommendations.length===report.recs.length,'Sidecar recommendation count does not match report');
    for(let i=0;i<report.recs.length;i++){
      const item = sidecar.recommendations[i];
      const rec = report.recs[i];
      assert(item && typeof item==='object',`Sidecar recommendation ${i+1} is invalid`);
      assert(item.ordinal===i+1,`Sidecar recommendation ${i+1} has invalid ordinal`);
      assert(item.title===rec.title,`Sidecar recommendation ${i+1} title does not match report`);
      assert(item.status===rec.status,`Sidecar recommendation ${i+1} status does not match report`);
      assert(item.displayText===rec.hist,`Sidecar recommendation ${i+1} displayText does not match report hist`);
      assert(Array.isArray(item.priorIds),`Sidecar recommendation ${i+1} priorIds must be an array`);
      assert(Array.isArray(item.synthesisIds),`Sidecar recommendation ${i+1} synthesisIds must be an array`);
      assert(Array.isArray(item.clusterIds),`Sidecar recommendation ${i+1} clusterIds must be an array`);
      if(stage2Enforced){
        assert(typeof item.personnelRequired==='boolean',`Sidecar recommendation ${i+1} personnelRequired must be an explicit boolean after the Stage 2 publication-gate cutover`);
        const textSignal=materialPersonnelSignal(rec);
        if(textSignal){
          assert(item.personnelRequired===true,`Sidecar recommendation ${i+1} cannot mark personnelRequired=false while the issued card signals material personnel dependence`);
        }
        if(item.personnelEvidence){
          assert(item.personnelRequired===true,`Sidecar recommendation ${i+1} cannot carry personnelEvidence while personnelRequired=false`);
        }
        if(item.personnelRequired){
          validatePersonnelEvidence(item.personnelEvidence,i);
        }
      }
      if(waitQualificationEnforced){
        const status=String(rec.status||'').toUpperCase();
        if(status==='WAIT'){
          validateWaitQualification(item.waitQualification,i);
        }else{
          assert(!item.waitQualification,`Sidecar recommendation ${i+1} waitQualification is only valid for WAIT status`);
        }
      }
    }
  }
  return sidecar;
}
function buildIndexEntry(report,sidecar,paths){
  return {
    id:`${report.ts}|${report.slot}`,
    date:reportDate(report.ts),
    slot:report.slot,
    label:report.label,
    ts:report.ts,
    feedGeneratedAt:report.feedGeneratedAt,
    path:paths.reportPath,
    bankroll:report.bankroll,
    risk:report.risk,
    counts:canonicalCounts(report.counts),
    recCount:report.recs.length,
    researchFitPath:paths.sidecarPath,
    feedBlobSha:sidecar.provenance.feedBlobSha,
    researchLibraryVersion:sidecar.provenance.researchLibraryVersion
  };
}
function entryMatches(existing,expected){
  for(const key of Object.keys(expected)){
    if(key==='counts'){
      if(!countsEqual(existing.counts,expected.counts)) return false;
      continue;
    }
    if(normalizedJson(existing[key])!==normalizedJson(expected[key])) return false;
  }
  return true;
}
function loadIndex(root){
  const file = path.join(root,'run-history.json');
  const index = readJson(file);
  assert(index && typeof index==='object' && Array.isArray(index.runs),'run-history.json must contain a runs array');
  return {file,index};
}
function publish(root,reportFile,sidecarFile){
  const report = validateReport(readJson(reportFile));
  const paths = expectedPaths(report);
  const sidecar = validateSidecar(normalizePublicationSidecar(readJson(sidecarFile),report),report,paths.reportPath,{strict:true});
  const reportAbs = path.join(root,paths.reportPath);
  const sidecarAbs = path.join(root,paths.sidecarPath);
  const reportCreated = writeImmutableJson(reportAbs,report,'Issued report');
  const sidecarCreated = writeImmutableJson(sidecarAbs,sidecar,'Research Fit sidecar');

  const {file:indexFile,index} = loadIndex(root);
  const expected = buildIndexEntry(report,sidecar,paths);
  const sameId = index.runs.filter(entry=>entry.id===expected.id);
  assert(sameId.length<=1,`run-history.json contains duplicate ID ${expected.id}`);
  const samePath = index.runs.filter(entry=>entry.path===expected.path && entry.id!==expected.id);
  assert(samePath.length===0,`Report path is already indexed to another run: ${expected.path}`);
  let indexChanged = normalizeIndexCounts(index);
  if(sameId.length===1){
    assert(entryMatches(sameId[0],expected),`Existing index entry conflicts with report bundle: ${expected.id}`);
  }else{
    index.runs.push(expected);
    index.runs.sort((a,b)=>String(a.ts).localeCompare(String(b.ts)));
    indexChanged = true;
  }
  const newest = index.runs.reduce((max,entry)=>String(entry.ts)>max?String(entry.ts):max,'');
  if(index.updated_at!==newest){index.updated_at=newest;indexChanged=true;}
  if(indexChanged) writeAtomic(indexFile,jsonText(index));

  verifyIndex(root,{targetTs:report.ts});
  emitOutputs({
    report_ts:report.ts,
    report_path:paths.reportPath,
    sidecar_path:paths.sidecarPath,
    short_id:shortId(report),
    changed:String(reportCreated||sidecarCreated||indexChanged)
  });
  console.log(`REPORT BUNDLE OK ${shortId(report)} ${paths.reportPath}`);
}
function walkJson(dir){
  if(!fs.existsSync(dir)) return [];
  const found=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,item.name);
    if(item.isDirectory()) found.push(...walkJson(full));
    else if(item.isFile() && item.name.endsWith('.json')) found.push(full);
  }
  return found;
}
function rel(root,file){return path.relative(root,file).split(path.sep).join('/');}
function verifyIndex(root,{targetTs}={}){
  const {index} = loadIndex(root);
  const ids = new Set(), paths = new Set(), shortIds = new Set();
  let targetFound = !targetTs;
  for(const entry of index.runs){
    assert(entry && typeof entry==='object','Index entry must be an object');
    assert(!ids.has(entry.id),`Duplicate index ID: ${entry.id}`); ids.add(entry.id);
    assert(!paths.has(entry.path),`Duplicate report path in index: ${entry.path}`); paths.add(entry.path);
    const reportAbs = path.join(root,entry.path);
    assert(fs.existsSync(reportAbs),`Indexed report is missing: ${entry.path}`);
    const report = validateReport(verificationReport(readJson(reportAbs)));
    const expected = expectedPaths(report);
    assert(entry.path===expected.reportPath,`Indexed path does not match report timestamp/slot: ${entry.path}`);
    assert(entry.id===`${report.ts}|${report.slot}`,`Index ID does not match report: ${entry.id}`);
    assert(entry.date===reportDate(report.ts),`Index date does not match report: ${entry.id}`);
    assert(entry.slot===report.slot,`Index slot does not match report: ${entry.id}`);
    assert(entry.label===report.label,`Index label does not match report: ${entry.id}`);
    assert(entry.ts===report.ts,`Index ts does not match report: ${entry.id}`);
    assert(entry.feedGeneratedAt===report.feedGeneratedAt,`Index feedGeneratedAt does not match report: ${entry.id}`);
    assert(entry.bankroll===report.bankroll,`Index bankroll does not match report: ${entry.id}`);
    assert(entry.risk===report.risk,`Index risk does not match report: ${entry.id}`);
    assert(countsEqual(entry.counts,report.counts),`Index counts do not match report: ${entry.id}`);
    assert(entry.recCount===report.recs.length,`Index recCount does not match report: ${entry.id}`);
    const sid=shortId(report);
    assert(!shortIds.has(sid),`Duplicate deterministic short ID: ${sid}`); shortIds.add(sid);

    const strict = Date.parse(report.ts)>=STRICT_BUNDLE_FROM;
    if(strict) assert(entry.researchFitPath===expected.sidecarPath,`Post-cutover run is missing exact researchFitPath: ${entry.id}`);
    if(entry.researchFitPath){
      assert(entry.researchFitPath===expected.sidecarPath,`Sidecar path does not match report timestamp/slot: ${entry.id}`);
      const sidecarAbs=path.join(root,entry.researchFitPath);
      assert(fs.existsSync(sidecarAbs),`Indexed sidecar is missing: ${entry.researchFitPath}`);
      const sidecar=validateSidecar(readJson(sidecarAbs),report,entry.path,{strict});
      if(sidecar.provenance?.feedBlobSha && entry.feedBlobSha){
        assert(entry.feedBlobSha===sidecar.provenance.feedBlobSha,`Index feedBlobSha does not match sidecar: ${entry.id}`);
      }
      if(sidecar.provenance?.researchLibraryVersion && entry.researchLibraryVersion){
        assert(entry.researchLibraryVersion===sidecar.provenance.researchLibraryVersion,`Index researchLibraryVersion does not match sidecar: ${entry.id}`);
      }
    }
    if(report.ts===targetTs) targetFound=true;
  }
  assert(targetFound,`Target report is not indexed: ${targetTs}`);

  const payloadFiles=walkJson(path.join(root,'data/history/runs'));
  for(const file of payloadFiles){
    const report=validateReport(verificationReport(readJson(file)));
    const reportPath=rel(root,file);
    const entry=index.runs.find(item=>item.id===`${report.ts}|${report.slot}`);
    assert(entry,`Stored issued report is not indexed: ${reportPath}`);
    assert(entry.path===reportPath,`Stored issued report index path mismatch: ${reportPath}`);
  }
  const sidecarFiles=walkJson(path.join(root,'data/history/research-fit'));
  for(const file of sidecarFiles){
    const sidecar=readJson(file);
    const ref=sidecar.reportReference;
    assert(ref && typeof ref.ts==='string' && typeof ref.slot==='string',`Sidecar has invalid reportReference: ${rel(root,file)}`);
    const entry=index.runs.find(item=>item.id===`${ref.ts}|${ref.slot}`);
    assert(entry,`Sidecar has no indexed report: ${rel(root,file)}`);
    assert(entry.researchFitPath===rel(root,file),`Sidecar is not linked by the matching index entry: ${rel(root,file)}`);
  }
  const newest=index.runs.reduce((max,entry)=>String(entry.ts)>max?String(entry.ts):max,'');
  assert(index.updated_at===newest,`run-history.json updated_at=${index.updated_at} does not match newest run=${newest}`);
  console.log(`REPORT HISTORY VERIFY OK ${index.runs.length} runs${targetTs?` target=${targetTs}`:''}`);
}

function expectValidationFailure(fn,label){
  let failed=false;
  try{fn();}
  catch{failed=true;}
  assert(failed,label);
}

function selfTest(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'betting-edge-report-publication-'));
  try{
    writeAtomic(path.join(root,'run-history.json'),jsonText({
      schema_version:2,
      terminal_version:'1.3',
      timezone:'America/Vancouver',
      updated_at:'',
      storage:{},
      schedule:[],
      runs:[]
    }));

    // Historical schema-3 Contract v0.9 bundle remains valid and immutable.
    const historicalReport={
      slot:'evening',
      label:'15:15 EVENING',
      ts:'2026-08-17T15:15:01-07:00',
      bankroll:450.1,
      risk:0,
      counts:{bet:0,lean:0,wait:1,pass:1},
      feedGeneratedAt:'2026-08-17T21:55:00.000Z',
      recs:[
        {status:'WAIT',title:'Alpha ML',hist:'B — direct fit'},
        {status:'PASS',title:'Beta ML',hist:'C — limited fit'}
      ]
    };
    const historicalSidecar={
      schema:3,
      reportReference:{
        slot:historicalReport.slot,
        label:historicalReport.label,
        ts:historicalReport.ts,
        reportPath:'data/history/runs/2026-08-17/evening-151501.json',
        feedGeneratedAt:historicalReport.feedGeneratedAt
      },
      provenance:{
        productionContractVersion:'0.9',
        productionContractOperational:true,
        productionContractPath:'BETTING_EDGE_CONTRACT.md',
        productionContractBlobSha:'27e485c3974fb6ef78e3fbf8036d81281c440a0b',
        feedBlobSha:'1111111111111111111111111111111111111111',
        researchLibraryVersion:'1.7'
      },
      recommendations:[
        {ordinal:1,title:'Alpha ML',status:'WAIT',grade:'B',priorIds:[],synthesisIds:[],clusterIds:[],directness:'direct',transportability:'high',mechanism:'x',limitation:'y',displayText:'B — direct fit'},
        {ordinal:2,title:'Beta ML',status:'PASS',grade:'C',priorIds:[],synthesisIds:[],clusterIds:[],directness:'related',transportability:'medium',mechanism:'x',limitation:'y',displayText:'C — limited fit'}
      ],
      boundaries:{}
    };
    const historicalReportFile=path.join(root,'input-historical-report.json');
    const historicalSidecarFile=path.join(root,'input-historical-sidecar.json');
    writeAtomic(historicalReportFile,jsonText(historicalReport));
    writeAtomic(historicalSidecarFile,jsonText(historicalSidecar));
    publish(root,historicalReportFile,historicalSidecarFile);
    publish(root,historicalReportFile,historicalSidecarFile);
    verifyIndex(root,{targetTs:historicalReport.ts});

    // New production bundles dated 2026-08-23 onward require Contract v1.0 provenance.
    const currentReport={
      ...historicalReport,
      slot:'main',
      label:'08:00 MAIN',
      ts:'2026-08-23T08:00:01-07:00',
      feedGeneratedAt:'2026-08-23T14:55:00.000Z',
      recs:[
        {...historicalReport.recs[0]},
        {
          ...historicalReport.recs[1],
          hist:'C+ — related MLB/no-vig evidence; direct full-game totals calibration is limited.'
        }
      ]
    };
    const currentSidecar={
      ...historicalSidecar,
      reportReference:{
        slot:currentReport.slot,
        label:currentReport.label,
        ts:currentReport.ts,
        reportPath:'data/history/runs/2026-08-23/main-080001.json',
        feedGeneratedAt:currentReport.feedGeneratedAt
      },
      provenance:{
        ...historicalSidecar.provenance,
        productionContractVersion:'1.0',
        productionContractBlobSha:'815a511301bd7a5aa3770baf0e32a00a28e2f548',
        feedBlobSha:'2222222222222222222222222222222222222222'
      },
      recommendations:[
        {...historicalSidecar.recommendations[0]},
        {
          ...historicalSidecar.recommendations[1],
          displayText:'C+ — related MLB/no-vig evidence; direct totals calibration is limited.'
        }
      ]
    };
    const currentReportFile=path.join(root,'input-current-report.json');
    const currentSidecarFile=path.join(root,'input-current-sidecar.json');
    writeAtomic(currentReportFile,jsonText(currentReport));
    writeAtomic(currentSidecarFile,jsonText(currentSidecar));
    publish(root,currentReportFile,currentSidecarFile);
    publish(root,currentReportFile,currentSidecarFile);
    verifyIndex(root,{targetTs:currentReport.ts});

    const storedCurrentSidecar=readJson(path.join(root,'data/history/research-fit/2026-08-23/main-080001.json'));
    assert(
      storedCurrentSidecar.recommendations[1].displayText===currentReport.recs[1].hist,
      'Publication must derive sidecar displayText from report hist'
    );
    const tamperedCurrentSidecar=JSON.parse(JSON.stringify(storedCurrentSidecar));
    tamperedCurrentSidecar.recommendations[1].displayText='C+ — related MLB/no-vig evidence; direct totals calibration is limited.';
    expectValidationFailure(
      ()=>validateSidecar(tamperedCurrentSidecar,currentReport,currentSidecar.reportReference.reportPath,{strict:true}),
      'Stored verifier must reject sidecar displayText drift from report hist'
    );

    const wrongCurrentSidecar={
      ...currentSidecar,
      provenance:{...currentSidecar.provenance,productionContractVersion:'0.9'}
    };
    expectValidationFailure(
      ()=>validateSidecar(wrongCurrentSidecar,currentReport,currentSidecar.reportReference.reportPath,{strict:true}),
      'Current Contract v1.0 report must reject v0.9 sidecar provenance'
    );

    // Stage 2 publication gate: unresolved personnel cannot serialize with only an official-source check.
    const stage2Report={
      slot:'late',
      label:'18:15 LATE',
      ts:'2026-08-25T18:15:01-07:00',
      bankroll:450.1,
      risk:0,
      counts:{bet:0,lean:0,wait:1,pass:0},
      feedGeneratedAt:'2026-08-26T01:10:00.000Z',
      recs:[
        {
          status:'WAIT',
          title:'Gamma over 0.5 doubles',
          meta:'MLB | LINEUP PENDING',
          playTo:'RECHECK AFTER STARTING LINEUP CONFIRMATION',
          support:'Exact quote is fresh.',
          contrary:'Starting lineup remains unconfirmed.',
          analysis:'WAIT / LINEUP PENDING.',
          hist:'NR — direct fit unavailable'
        }
      ]
    };
    const validWaitQualification={
      actionableIfResolved:true,
      blockers:['Starting lineup confirmation'],
      independentSignals:[{origin:'internal matchup model',finding:'Conditional on a confirmed start, the current matchup estimate remains materially stronger than the market-derived benchmark.'}],
      rationale:'The candidate has current independent matchup support and can become actionable if the participation blocker clears under fresh pricing.'
    };
    const stage2BaseSidecar={
      schema:3,
      reportReference:{
        slot:stage2Report.slot,
        label:stage2Report.label,
        ts:stage2Report.ts,
        reportPath:'data/history/runs/2026-08-25/late-181501.json',
        feedGeneratedAt:stage2Report.feedGeneratedAt
      },
      provenance:{
        productionContractVersion:'1.0',
        productionContractOperational:true,
        productionContractPath:'BETTING_EDGE_CONTRACT.md',
        productionContractBlobSha:'3333333333333333333333333333333333333333',
        personnelSweepPath:'BETTING_EDGE_PERSONNEL_SWEEP.md',
        personnelSweepBlobSha:'4444444444444444444444444444444444444444',
        feedBlobSha:'5555555555555555555555555555555555555555',
        researchLibraryVersion:'1.7'
      },
      recommendations:[
        {ordinal:1,title:'Gamma over 0.5 doubles',status:'WAIT',grade:'NR',priorIds:[],synthesisIds:[],clusterIds:[],directness:'gap',transportability:'not_applicable',mechanism:'x',limitation:'y',displayText:'NR — direct fit unavailable',personnelRequired:true,waitQualification:validWaitQualification}
      ],
      boundaries:{}
    };
    expectValidationFailure(
      ()=>validateSidecar(stage2BaseSidecar,stage2Report,stage2BaseSidecar.reportReference.reportPath,{strict:true}),
      'Stage 2 gate must reject a personnel-dependent WAIT without personnelEvidence'
    );

    const evasionSidecar={
      ...stage2BaseSidecar,
      recommendations:[{...stage2BaseSidecar.recommendations[0],personnelRequired:false}]
    };
    expectValidationFailure(
      ()=>validateSidecar(evasionSidecar,stage2Report,evasionSidecar.reportReference.reportPath,{strict:true}),
      'Stage 2 gate must reject personnelRequired=false when issued wording signals material personnel dependence'
    );

    const twoSourceEvidence={
      stage2CheckedAt:'2026-08-25T18:12:00-07:00',
      dependencyTarget:'Exact batter participation and batting order',
      dependencyRationale:'Plate-appearance opportunity materially changes the doubles probability.',
      officialSources:[{origin:'official league lineup board'}],
      fallbackSources:[{origin:'source-a'},{origin:'source-b'}],
      fallbackSourceCount:2,
      sourceShortfall:null,
      facts:[],
      personnelState:'PARTIAL',
      sourceConflict:'NONE',
      conflictSummary:null,
      conflictResolution:null,
      unresolved:['Starting lineup not yet confirmed'],
      decisionSensitivity:'A confirmed start and favorable batting position can materially change fair value and status.',
      preStage2Fair:'Provisional fair +500 with elevated lineup uncertainty.',
      postStage2Fair:'Fair unchanged; uncertainty remains elevated.',
      decisionImpact:'NO MATERIAL CHANGE'
    };
    const twoSourceSidecar={
      ...stage2BaseSidecar,
      recommendations:[{...stage2BaseSidecar.recommendations[0],personnelEvidence:twoSourceEvidence}]
    };
    expectValidationFailure(
      ()=>validateSidecar(twoSourceSidecar,stage2Report,twoSourceSidecar.reportReference.reportPath,{strict:true}),
      'Stage 2 gate must reject unresolved personnel with fewer than 3 fallback sources and no sourceShortfall'
    );

    const threeSourceSidecar={
      ...stage2BaseSidecar,
      recommendations:[{
        ...stage2BaseSidecar.recommendations[0],
        personnelEvidence:{
          ...twoSourceEvidence,
          fallbackSources:[...twoSourceEvidence.fallbackSources,{origin:'source-c'}],
          fallbackSourceCount:3
        }
      }]
    };
    validateSidecar(threeSourceSidecar,stage2Report,threeSourceSidecar.reportReference.reportPath,{strict:true});

    const duplicateSourceSidecar={
      ...stage2BaseSidecar,
      recommendations:[{
        ...stage2BaseSidecar.recommendations[0],
        personnelEvidence:{
          ...twoSourceEvidence,
          fallbackSources:[{origin:'Source-A'},{origin:' source-a '},{origin:'source-c'}],
          fallbackSourceCount:3
        }
      }]
    };
    expectValidationFailure(
      ()=>validateSidecar(duplicateSourceSidecar,stage2Report,duplicateSourceSidecar.reportReference.reportPath,{strict:true}),
      'Stage 2 gate must reject duplicate normalized fallback-source origins'
    );

    const shortfallSidecar={
      ...stage2BaseSidecar,
      recommendations:[{
        ...stage2BaseSidecar.recommendations[0],
        personnelEvidence:{
          ...twoSourceEvidence,
          sourceShortfall:'Only two distinct credible current event-specific fallback origins were available after the sweep.'
        }
      }]
    };
    validateSidecar(shortfallSidecar,stage2Report,shortfallSidecar.reportReference.reportPath,{strict:true});

    // WAIT qualification gate: a market-only outlier is PASS material, not WAIT material.
    const marketOnlyWaitSidecar={
      ...threeSourceSidecar,
      recommendations:[{
        ...threeSourceSidecar.recommendations[0],
        waitQualification:{
          actionableIfResolved:true,
          blockers:['Book agreement'],
          independentSignals:[{origin:'Bet365',finding:'Bet365 is much longer than DraftKings on the exact selection.'}],
          rationale:'The apparent edge is the book gap.'
        }
      }]
    };
    expectValidationFailure(
      ()=>validateSidecar(marketOnlyWaitSidecar,stage2Report,marketOnlyWaitSidecar.reportReference.reportPath,{strict:true}),
      'WAIT gate must reject a sportsbook/book-gap observation as the required independent signal'
    );

    const notActionableWaitSidecar={
      ...threeSourceSidecar,
      recommendations:[{
        ...threeSourceSidecar.recommendations[0],
        waitQualification:{...validWaitQualification,actionableIfResolved:false}
      }]
    };
    expectValidationFailure(
      ()=>validateSidecar(notActionableWaitSidecar,stage2Report,notActionableWaitSidecar.reportReference.reportPath,{strict:true}),
      'WAIT gate must reject a candidate that is not plausibly actionable even if blockers clear'
    );

    console.log('REPORT HISTORY SELF-TEST OK — historical v0.9 + current v1.0 + Stage 2 personnel gate + independent WAIT qualification');
  }finally{
    fs.rmSync(root,{recursive:true,force:true});
  }
}

function emitOutputs(values){
  if(!process.env.GITHUB_OUTPUT) return;
  const lines=Object.entries(values).map(([key,value])=>`${key}=${value}`).join('\n')+'\n';
  fs.appendFileSync(process.env.GITHUB_OUTPUT,lines,'utf8');
}
function main(){
  const args=parseArgs(process.argv.slice(2));
  const root=path.resolve(args.root||process.cwd());
  if(args.command==='publish'){
    assert(typeof args.report==='string','publish requires --report <file>');
    assert(typeof args.sidecar==='string','publish requires --sidecar <file>');
    publish(root,path.resolve(args.report),path.resolve(args.sidecar));
  }else if(args.command==='verify'){
    verifyIndex(root,{targetTs:typeof args.ts==='string'?args.ts:undefined});
  }else if(args.command==='self-test'){
    selfTest();
  }else{
    die('Usage: report-publication.mjs publish --report FILE --sidecar FILE [--root DIR] | verify [--ts ISO] [--root DIR] | self-test');
  }
}
try{main();}
catch(error){console.error(`REPORT HISTORY ERROR: ${error.message}`);process.exit(1);}
