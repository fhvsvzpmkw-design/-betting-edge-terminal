#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SEMANTIC_ENFORCEMENT_FROM = Date.parse('2026-09-02T10:40:00-07:00');
const FINAL_RECHECK_FROM = Date.parse('2026-09-02T11:15:00-07:00');
const MINUTE = 60 * 1000;
const FINAL_RECHECK_STAGE2_TOLERANCE_MINUTES = 30;

function die(message){ throw new Error(message); }
function ensure(condition,message){ if(!condition) die(message); }
function readJson(file){ return JSON.parse(fs.readFileSync(file,'utf8')); }
function nonEmpty(value){ return typeof value === 'string' && value.trim().length > 0; }
function parseTime(value,label){
  const ms = Date.parse(value || '');
  ensure(Number.isFinite(ms), `${label} must be a parseable timestamp`);
  return ms;
}
function text(values){
  return values.flat(Infinity).filter(value => nonEmpty(value)).join(' ');
}
function sourceText(source){
  if(!source || typeof source !== 'object' || Array.isArray(source)) return '';
  return text([source.origin, source.url, source.fact]);
}
function sourceAsOf(source){
  const ms = Date.parse(source?.asOf || '');
  return Number.isFinite(ms) ? ms : null;
}
function sourceMatches(source,pattern){ return pattern.test(sourceText(source)); }
function semanticShortfall(evidence,concept){
  return nonEmpty(evidence?.sourceShortfall) && concept.evidence.test(evidence.sourceShortfall);
}
function finalRecheckShortfall(evidence,concept){
  return semanticShortfall(evidence,concept) && /\b(official|authoritative|league|team|club|conference)\b/i.test(evidence.sourceShortfall);
}
function canonicalSport(value){
  const sport = String(value || '').trim().toUpperCase();
  if(sport === 'MLB') return 'MLB';
  if(['NFL','NCAAF','CFB','CFL','FOOTBALL'].includes(sport)) return 'FOOTBALL';
  if(sport === 'NHL') return 'NHL';
  if(['NBA','WNBA','NBA_WNBA','NBA/WNBA'].includes(sport)) return 'NBA_WNBA';
  if(['SOCCER','FOOTBALL_SOCCER'].includes(sport)) return 'SOCCER';
  return sport;
}

const CONCEPTS = Object.freeze({
  MLB: [
    {key:'lineup', dependency:/\b(lineups?|batting orders?|batting positions?|platoon)\b/i, evidence:/\b(lineups?|batting orders?|batting positions?|platoon)\b/i, fallbackWindow:120},
    {key:'starter', dependency:/\b(starting pitchers?|probable[- ]pitchers?|probable starters?|listed starters?|opener|bullpen[- ]game)\b/i, evidence:/\b(starting pitchers?|probable[- ]pitchers?|probable starters?|listed starters?|opener|bullpen[- ]game)\b/i, fallbackWindow:120},
    {key:'bullpen', dependency:/\b(bullpens?|relievers?|relief corps|closers?|leverage[- ]bullpen)\b/i, evidence:/\b(bullpens?|relievers?|relief corps|closers?|leverage[- ]bullpen)\b/i, fallbackWindow:120},
    {key:'participation', dependency:/\b(participation|active|inactive|injur(?:y|ies)|scratch(?:es)?|rest days?|resting|role changes?)\b/i, evidence:/\b(participation|active|inactive|injur(?:y|ies)|scratch(?:es)?|rest days?|resting|role changes?)\b/i, fallbackWindow:120}
  ],
  FOOTBALL: [
    {key:'quarterback', dependency:/\b(qb|quarterbacks?|backup quarterback)\b/i, evidence:/\b(qb|quarterbacks?|backup quarterback)\b/i, fallbackWindow:180},
    {key:'offensive-line', dependency:/\b(offensive line|o[- ]?line|left tackle|right tackle|guards?|centers?)\b/i, evidence:/\b(offensive line|o[- ]?line|left tackle|right tackle|guards?|centers?)\b/i, fallbackWindow:180},
    {key:'skill-position', dependency:/\b(receiver|wideout|running back|rb\b|tight end|te\b|skill[- ]position|snap share|role)\b/i, evidence:/\b(receiver|wideout|running back|rb\b|tight end|te\b|skill[- ]position|snap share|role)\b/i, fallbackWindow:180},
    {key:'defense', dependency:/\b(secondary|cornerback|safety|defensive front|edge rusher|linebacker|defense)\b/i, evidence:/\b(secondary|cornerback|safety|defensive front|edge rusher|linebacker|defense)\b/i, fallbackWindow:180},
    {key:'availability', dependency:/\b(inactive|active|availability|injur(?:y|ies)|questionable|doubtful|suspension|scratch(?:es)?|participation)\b/i, evidence:/\b(inactive|active|availability|injur(?:y|ies)|questionable|doubtful|suspension|scratch(?:es)?|participation)\b/i, fallbackWindow:180}
  ],
  NHL: [
    {key:'goalie', dependency:/\b(goalies?|goaltenders?|starting goalie|starting goaltender)\b/i, evidence:/\b(goalies?|goaltenders?|starting goalie|starting goaltender)\b/i, fallbackWindow:240},
    {key:'lineup', dependency:/\b(line combinations?|line rushes?|scratch(?:es)?|lineups?)\b/i, evidence:/\b(line combinations?|line rushes?|scratch(?:es)?|lineups?)\b/i, fallbackWindow:240},
    {key:'power-play', dependency:/\b(power[- ]play|pp1|pp2|power play unit)\b/i, evidence:/\b(power[- ]play|pp1|pp2|power play unit)\b/i, fallbackWindow:240},
    {key:'availability', dependency:/\b(participation|injur(?:y|ies)|active|inactive|scratch(?:es)?|rest)\b/i, evidence:/\b(participation|injur(?:y|ies)|active|inactive|scratch(?:es)?|rest)\b/i, fallbackWindow:240}
  ],
  NBA_WNBA: [
    {key:'starter', dependency:/\b(expected starters?|starting lineup|starting role|starters?)\b/i, evidence:/\b(expected starters?|starting lineup|starting role|starters?)\b/i, fallbackWindow:180},
    {key:'minutes', dependency:/\b(minutes?|minutes limit|workload|restriction)\b/i, evidence:/\b(minutes?|minutes limit|workload|restriction)\b/i, fallbackWindow:180},
    {key:'usage-role', dependency:/\b(usage|role changes?|rotation|bench role)\b/i, evidence:/\b(usage|role changes?|rotation|bench role)\b/i, fallbackWindow:180},
    {key:'availability', dependency:/\b(active|inactive|availability|injur(?:y|ies)|questionable|doubtful|out|rest|back[- ]to[- ]back)\b/i, evidence:/\b(active|inactive|availability|injur(?:y|ies)|questionable|doubtful|out|rest|back[- ]to[- ]back)\b/i, fallbackWindow:180}
  ],
  SOCCER: [
    {key:'starting-XI', dependency:/\b(starting xi|confirmed xi|projected xi|lineups?|starting eleven)\b/i, evidence:/\b(starting xi|confirmed xi|projected xi|lineups?|starting eleven)\b/i, fallbackWindow:90},
    {key:'goalkeeper', dependency:/\b(goalkeepers?|keeper|starting keeper)\b/i, evidence:/\b(goalkeepers?|keeper|starting keeper)\b/i, fallbackWindow:90},
    {key:'rotation', dependency:/\b(rotation|squad changes?|rest)\b/i, evidence:/\b(rotation|squad changes?|rest)\b/i, fallbackWindow:90},
    {key:'availability', dependency:/\b(injur(?:y|ies)|suspensions?|absences?|availability|active|inactive)\b/i, evidence:/\b(injur(?:y|ies)|suspensions?|absences?|availability|active|inactive)\b/i, fallbackWindow:90}
  ]
});

function evidenceCorpus(evidence){
  return text([
    (evidence.officialSources || []).map(sourceText),
    (evidence.fallbackSources || []).map(sourceText),
    evidence.facts || []
  ]);
}
function dependencyCorpus(evidence){
  return text([
    evidence.dependencyTarget,
    evidence.dependencyRationale,
    evidence.unresolved || [],
    evidence.decisionSensitivity
  ]);
}
function unresolvedCorpus(evidence){ return text(evidence.unresolved || []); }
function matchingSources(sources,concept){ return (sources || []).filter(source => sourceMatches(source,concept.evidence)); }
function timelySources(sources,concept,eventMs,windowMinutes,reportMs){
  const floor = eventMs - windowMinutes * MINUTE;
  return matchingSources(sources,concept).filter(source => {
    const asOf = sourceAsOf(source);
    return asOf !== null && asOf >= floor && asOf <= reportMs + MINUTE;
  });
}
function validateMarkedFinalSources(evidence,index,stage2Ms,reportMs){
  for(const [sourceIndex,source] of (evidence.officialSources || []).entries()){
    if(source?.finalRecheck !== true) continue;
    ensure(source && typeof source === 'object' && !Array.isArray(source),`Recommendation ${index+1} official final re-check ${sourceIndex+1} must be an object`);
    ensure(nonEmpty(source.origin),`Recommendation ${index+1} official final re-check ${sourceIndex+1} requires origin`);
    ensure(nonEmpty(source.url),`Recommendation ${index+1} official final re-check ${sourceIndex+1} requires url`);
    ensure(nonEmpty(source.fact),`Recommendation ${index+1} official final re-check ${sourceIndex+1} requires a specific fact/finding`);
    const asOf = parseTime(source.asOf,`Recommendation ${index+1} official final re-check ${sourceIndex+1} asOf`);
    ensure(asOf <= reportMs + MINUTE,`Recommendation ${index+1} official final re-check ${sourceIndex+1} cannot be after report.ts`);
    ensure(asOf >= stage2Ms - FINAL_RECHECK_STAGE2_TOLERANCE_MINUTES * MINUTE,`Recommendation ${index+1} official final re-check ${sourceIndex+1} must occur near Stage 2 close`);
  }
}

export function validatePersonnelSemantics(report,sidecar){
  ensure(report && typeof report === 'object' && !Array.isArray(report),'Personnel semantic gate report must be an object');
  ensure(sidecar && typeof sidecar === 'object' && !Array.isArray(sidecar),'Personnel semantic gate sidecar must be an object');
  const reportMs = parseTime(report.ts,'report.ts');
  if(reportMs < SEMANTIC_ENFORCEMENT_FROM) return {enforced:false, reason:'pre-cutover'};
  ensure(Array.isArray(report.recs),'Personnel semantic gate report.recs must be an array');
  ensure(Array.isArray(sidecar.recommendations),'Personnel semantic gate sidecar.recommendations must be an array');
  ensure(report.recs.length === sidecar.recommendations.length,'Personnel semantic gate report/sidecar recommendation count mismatch');

  let checked = 0;
  for(let index=0; index<report.recs.length; index++){
    const rec = report.recs[index];
    const item = sidecar.recommendations[index];
    if(item?.personnelRequired !== true) continue;
    checked++;
    const evidence = item?.personnelEvidence;
    ensure(evidence && typeof evidence === 'object' && !Array.isArray(evidence),`Recommendation ${index+1} personnelRequired=true requires personnelEvidence`);
    const sport = canonicalSport(item?.coreAssessment?.context?.sport || rec?.coreAssessment?.context?.sport || rec?.sport);
    const concepts = CONCEPTS[sport];
    if(!concepts) continue;

    const dependency = dependencyCorpus(evidence);
    const matched = concepts.filter(concept => concept.dependency.test(dependency));
    ensure(matched.length > 0,`Recommendation ${index+1} ${sport} personnel dependency is too vague for semantic enforcement: ${evidence.dependencyTarget || 'UNKNOWN'}`);

    const corpus = evidenceCorpus(evidence);
    const unresolved = unresolvedCorpus(evidence);
    const state = String(evidence.personnelState || '').toUpperCase();
    const noMaterialSensitivity = /\bNO MATERIAL PERSONNEL SENSITIVITY\b/i.test(String(evidence.decisionSensitivity || ''));
    const eventMs = parseTime(rec?.feed?.eventDate,`Recommendation ${index+1} feed.eventDate`);
    const minutesToEvent = (eventMs - reportMs) / MINUTE;
    const stage2Ms = parseTime(evidence.stage2CheckedAt,`Recommendation ${index+1} personnelEvidence.stage2CheckedAt`);
    ensure(stage2Ms <= reportMs + MINUTE,`Recommendation ${index+1} personnelEvidence.stage2CheckedAt cannot be after report.ts`);
    if(reportMs >= FINAL_RECHECK_FROM) validateMarkedFinalSources(evidence,index,stage2Ms,reportMs);

    for(const concept of matched){
      ensure(concept.evidence.test(corpus),`Recommendation ${index+1} named ${sport} personnel dependency "${concept.key}" is not addressed by recorded source facts`);
      const conceptUnresolved = state !== 'CONFIRMED' && !noMaterialSensitivity && (concept.dependency.test(unresolved) || (!nonEmpty(unresolved) && concept.dependency.test(dependency)));
      if(!conceptUnresolved || minutesToEvent < 0) continue;

      if(Number.isFinite(concept.fallbackWindow) && minutesToEvent <= concept.fallbackWindow){
        const semanticFallback = timelySources(evidence.fallbackSources,concept,eventMs,concept.fallbackWindow,reportMs);
        if(semanticFallback.length === 0){
          ensure(semanticShortfall(evidence,concept),`Recommendation ${index+1} unresolved ${sport} dependency "${concept.key}" inside ${concept.fallbackWindow} minutes requires a dependency-specific fallback source or semantic sourceShortfall`);
          ensure(['PARTIAL','UNKNOWN'].includes(state),`Recommendation ${index+1} semantic source shortfall for "${concept.key}" requires personnelState PARTIAL or UNKNOWN`);
        }
      }

      if(reportMs >= FINAL_RECHECK_FROM){
        const finalRechecks = matchingSources(evidence.officialSources,concept).filter(source => source?.finalRecheck === true);
        if(finalRechecks.length === 0){
          ensure(finalRecheckShortfall(evidence,concept),`Recommendation ${index+1} unresolved ${sport} dependency "${concept.key}" requires one final authoritative re-check before final status`);
          ensure(['PARTIAL','UNKNOWN'].includes(state),`Recommendation ${index+1} authoritative final-recheck shortfall for "${concept.key}" requires personnelState PARTIAL or UNKNOWN`);
        }
      }
    }
  }
  return {enforced:true, checked, finalRecheckEnforced:reportMs >= FINAL_RECHECK_FROM};
}

function parseArgs(argv){
  const [command,...rest] = argv;
  const args = {command};
  for(let i=0;i<rest.length;i++){
    const token = rest[i];
    if(!token.startsWith('--')) die(`Unexpected argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    const next = rest[i+1];
    if(next && !next.startsWith('--')){ args[key]=next; i++; }
    else args[key]=true;
  }
  return args;
}

function makeSource(origin,fact,asOf,finalRecheck=false){ return {origin,url:'https://example.test/source',fact,asOf,...(finalRecheck?{finalRecheck:true}:{})}; }
function makeAssessment(sport){ return {context:{sport}}; }
function makeBundle({reportTs,eventDate,sport='MLB',dependencyTarget,dependencyRationale='Material personnel inputs affect the exact wager.',unresolved=[],state='PARTIAL',officialSources=[],fallbackSources=[],sourceShortfall=null,decisionSensitivity='Resolution could require a fresh fair.'}){
  const evidence = {
    stage2CheckedAt: reportTs,
    dependencyTarget,
    dependencyRationale,
    officialSources,
    fallbackSources,
    fallbackSourceCount:fallbackSources.length,
    sourceShortfall,
    facts:[],
    personnelState:state,
    sourceConflict:'NONE',
    conflictSummary:null,
    conflictResolution:null,
    unresolved,
    decisionSensitivity,
    preStage2Fair:'+120',
    postStage2Fair:'+125',
    decisionImpact:'Synthetic semantic-gate test.'
  };
  const rec = {title:'Synthetic',status:'PASS',feed:{eventDate},coreAssessment:makeAssessment(sport)};
  const item = {ordinal:1,title:'Synthetic',status:'PASS',personnelRequired:true,personnelEvidence:evidence,coreAssessment:makeAssessment(sport)};
  return {report:{ts:reportTs,recs:[rec]},sidecar:{schema:3,recommendations:[item]}};
}
function expectFailure(fn,pattern,label){
  let error = null;
  try{ fn(); }catch(caught){ error = caught; }
  assert(error,label);
  if(pattern) assert.match(String(error.message),pattern,label);
}
function selfTest(){
  const pre = makeBundle({
    reportTs:'2026-09-02T09:34:30-07:00',
    eventDate:'2026-09-02T16:40:00Z',
    dependencyTarget:'listed starters, final lineups and bullpens',
    unresolved:['Final confirmed batting orders','Late bullpen availability','Any late starter change'],
    officialSources:[makeSource('MLB probable pitchers','Probable pitchers were checked.','2026-09-02T09:34:30-07:00')],
    fallbackSources:[makeSource('Reuters matchup report','Current matchup was reviewed.','2026-09-02T09:34:30-07:00')]
  });
  assert.equal(validatePersonnelSemantics(pre.report,pre.sidecar).enforced,false,'09:30 historical report must remain pre-cutover');

  const badMlb = makeBundle({
    reportTs:'2026-09-02T15:15:00-07:00',
    eventDate:'2026-09-02T23:10:00Z',
    dependencyTarget:'final starting lineup, batting order and probable starting pitcher',
    unresolved:['Final confirmed batting order','Probable starter confirmation'],
    officialSources:[makeSource('MLB probable pitchers','The probable starting pitcher was checked.','2026-09-02T15:15:00-07:00')],
    fallbackSources:[
      makeSource('Baseball Savant probable pitchers','Probable starting pitcher context was reviewed.','2026-09-02T15:15:00-07:00'),
      makeSource('Reuters matchup report','Current matchup form was reviewed.','2026-09-02T15:15:00-07:00'),
      makeSource('ESPN injuries','Current injuries were reviewed.','2026-09-02T15:15:00-07:00')
    ]
  });
  expectFailure(()=>validatePersonnelSemantics(badMlb.report,badMlb.sidecar),/lineup.*not addressed/i,'MLB lineup dependency must not pass on generic sources');

  const goodMlb = structuredClone(badMlb);
  goodMlb.sidecar.recommendations[0].personnelEvidence.officialSources.push(
    makeSource('MLB starting lineups and probable pitchers','Official starting lineup, batting order and probable starting pitcher were re-checked; lineup confirmation remained pending.','2026-09-02T15:15:00-07:00',true)
  );
  goodMlb.sidecar.recommendations[0].personnelEvidence.fallbackSources[1] =
    makeSource('Local team beat report','Projected starting lineup and batting order were reported.','2026-09-02T15:12:00-07:00');
  assert.equal(validatePersonnelSemantics(goodMlb.report,goodMlb.sidecar).finalRecheckEnforced,true,'Dependency-specific MLB evidence with final authoritative re-check should pass');

  const unmarkedMlb = structuredClone(goodMlb);
  delete unmarkedMlb.sidecar.recommendations[0].personnelEvidence.officialSources[1].finalRecheck;
  expectFailure(()=>validatePersonnelSemantics(unmarkedMlb.report,unmarkedMlb.sidecar),/final authoritative re-check/i,'Dependency-specific official evidence without finalRecheck marker must fail');

  const staleFinal = structuredClone(goodMlb);
  staleFinal.sidecar.recommendations[0].personnelEvidence.officialSources[1].asOf='2026-09-02T14:30:00-07:00';
  expectFailure(()=>validatePersonnelSemantics(staleFinal.report,staleFinal.sidecar),/near Stage 2 close/i,'Final authoritative re-check cannot be stale relative to Stage 2 close');

  const semanticShortfallBundle = structuredClone(goodMlb);
  semanticShortfallBundle.sidecar.recommendations[0].personnelEvidence.fallbackSources = [
    makeSource('Baseball Savant probable pitchers','Probable starting pitcher context was reviewed.','2026-09-02T15:10:00-07:00'),
    makeSource('Reuters matchup report','Current matchup form was reviewed.','2026-09-02T15:09:00-07:00'),
    makeSource('ESPN injuries','Current injuries were reviewed.','2026-09-02T15:08:00-07:00')
  ];
  semanticShortfallBundle.sidecar.recommendations[0].personnelEvidence.fallbackSourceCount=3;
  semanticShortfallBundle.sidecar.recommendations[0].personnelEvidence.sourceShortfall='No credible projected lineup or batting-order fallback source was available after the event-specific search.';
  assert.equal(validatePersonnelSemantics(semanticShortfallBundle.report,semanticShortfallBundle.sidecar).enforced,true,'Fallback semantic sourceShortfall should preserve a genuine PARTIAL state when the final official re-check exists');

  const nfl = makeBundle({
    reportTs:'2026-09-02T15:15:00-07:00',
    eventDate:'2026-09-03T00:45:00Z',
    sport:'NFL',
    dependencyTarget:'starting quarterback availability and backup quarterback expectation',
    unresolved:['Starting quarterback availability'],
    officialSources:[makeSource('Official NFL/team injury status','Starting quarterback availability was re-checked and remained unresolved.','2026-09-02T15:14:00-07:00',true)],
    fallbackSources:[
      makeSource('Team beat reporter','Quarterback practice and expected status were reported.','2026-09-02T15:12:00-07:00'),
      makeSource('Local football desk','Quarterback availability was independently reported.','2026-09-02T15:10:00-07:00'),
      makeSource('National football reporter','Quarterback and backup expectation were checked.','2026-09-02T15:08:00-07:00')
    ]
  });
  assert.equal(validatePersonnelSemantics(nfl.report,nfl.sidecar).enforced,true,'Football quarterback evidence must pass with the universal final authoritative re-check');

  const unmarkedNfl = structuredClone(nfl);
  delete unmarkedNfl.sidecar.recommendations[0].personnelEvidence.officialSources[0].finalRecheck;
  expectFailure(()=>validatePersonnelSemantics(unmarkedNfl.report,unmarkedNfl.sidecar),/final authoritative re-check/i,'Football must no longer have a final authoritative re-check enforcement hole');

  const nhl = makeBundle({
    reportTs:'2026-09-02T15:15:00-07:00',
    eventDate:'2026-09-02T23:45:00Z',
    sport:'NHL',
    dependencyTarget:'starting goalie and late scratches',
    unresolved:['Starting goalie confirmation'],
    officialSources:[makeSource('Official team game notes','Starting goalie remained unconfirmed after the closing official check.','2026-09-02T15:14:00-07:00',true)],
    fallbackSources:[
      makeSource('Team beat reporter','Starting goalie was strongly projected from morning skate.','2026-09-02T15:12:00-07:00'),
      makeSource('Local hockey desk','Goalie expectation was independently reported.','2026-09-02T15:10:00-07:00'),
      makeSource('Line-combination service','Goalie and scratch context was checked.','2026-09-02T15:08:00-07:00')
    ]
  });
  assert.equal(validatePersonnelSemantics(nhl.report,nhl.sidecar).enforced,true,'NHL goalie-specific evidence should pass under the same universal closing rule');

  const noMaterial = makeBundle({
    reportTs:'2026-09-02T15:15:00-07:00',
    eventDate:'2026-09-03T03:30:00Z',
    sport:'MLB',
    dependencyTarget:'projected starting lineup and batting order',
    unresolved:[],
    state:'STRONG PROJECTION',
    decisionSensitivity:'NO MATERIAL PERSONNEL SENSITIVITY',
    officialSources:[makeSource('MLB starting lineups','Projected lineup context was checked.','2026-09-02T14:55:00-07:00')],
    fallbackSources:[
      makeSource('Beat source A','Projected lineup was reported.','2026-09-02T14:52:00-07:00'),
      makeSource('Beat source B','Batting order projection was reported.','2026-09-02T14:50:00-07:00'),
      makeSource('Lineup service','Projected lineup was reviewed.','2026-09-02T14:48:00-07:00')
    ]
  });
  assert.equal(validatePersonnelSemantics(noMaterial.report,noMaterial.sidecar).enforced,true,'Explicit no-material personnel sensitivity should not force a redundant final re-check');

  const authoritativeShortfall = structuredClone(nfl);
  authoritativeShortfall.sidecar.recommendations[0].personnelEvidence.officialSources = [makeSource('Official team injury report','Earlier quarterback status was checked.','2026-09-02T14:30:00-07:00')];
  authoritativeShortfall.sidecar.recommendations[0].personnelEvidence.sourceShortfall='The authoritative team/NFL quarterback availability channel could not be reached for the final re-check; quarterback status remains unresolved.';
  assert.equal(validatePersonnelSemantics(authoritativeShortfall.report,authoritativeShortfall.sidecar).enforced,true,'Truthful authoritative final-recheck sourceShortfall should fail closed as PARTIAL rather than fabricate a check');

  const vague = makeBundle({
    reportTs:'2026-09-02T15:15:00-07:00',
    eventDate:'2026-09-03T02:10:00Z',
    dependencyTarget:'team personnel status',
    unresolved:['Some personnel questions'],
    officialSources:[makeSource('Official source','Personnel was checked.','2026-09-02T15:15:00-07:00',true)],
    fallbackSources:[makeSource('Beat source','Personnel was reviewed.','2026-09-02T15:15:00-07:00')]
  });
  expectFailure(()=>validatePersonnelSemantics(vague.report,vague.sidecar),/too vague/i,'Known-sport dependency target must identify the actual personnel dependency');

  console.log('PERSONNEL SEMANTIC GATE SELF-TEST OK — universal final authoritative re-check');
}

function main(){
  const args = parseArgs(process.argv.slice(2));
  if(args.command === 'self-test'){ selfTest(); return; }
  if(args.command !== 'validate' || !args.report || !args.sidecar){
    die('Usage: personnel-semantic-gate.mjs validate --report FILE --sidecar FILE | self-test');
  }
  const report = readJson(args.report);
  const sidecar = readJson(args.sidecar);
  const result = validatePersonnelSemantics(report,sidecar);
  if(!result.enforced){
    console.log(`PERSONNEL SEMANTIC GATE PRE-CUTOVER ${report.ts}`);
    return;
  }
  console.log(`PERSONNEL SEMANTIC GATE OK ${report.ts} checked=${result.checked} finalRecheck=${result.finalRecheckEnforced?'required':'pre-cutover'}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if(isCli) main();
