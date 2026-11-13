// Cheap, advisory planning in the existing producer. No model calls or grades.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseReportDocument} from './report-document-transport.mjs';
import {reportRunHealth} from './report-run-health.mjs';

export const SLATE_FOCUSED_FROM = '2026-11-13T02:15:00Z';
const list = value => Array.isArray(value) ? value : [];
const stamp = value => Date.parse(value || '');
const eventOf = row => String(row.eventId ?? row.primaryMatch?.eventId ?? row.quote?.eventId ?? row.decision?.feed?.eventId ?? row.selectionId?.split('|')[1] ?? '');
const iso = value => Number.isFinite(stamp(value)) ? new Date(value).toISOString() : null;
const keyOf = event => JSON.stringify([event.sport, String(event.eventId), iso(event.eventDate || event.startTime)]);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
// A repeated collection timestamp is not a material change. Original times
// still enter the real freshness/applicability validators, never this digest.
const clockKeys = new Set(['observedAt','checkedAt','asOf','collectedAt','generatedAt','updatedAt','forecastAt',
  'recordId','snapshotId','factId','id','retrievedAt','revalidatedAt','ageMinutes','capturePath','changedAt','bookmakerChangedAt']);
function content(value) {
  if (Array.isArray(value)) return value.map(content);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !clockKeys.has(key)).map(([key,item]) => [key,content(item)]));
  return value;
}
function uniqueContent(rows) {
  return [...new Map(rows.map(row => {const value=stable(content(row));return [JSON.stringify(value),value];})).values()]
    .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
const setDigest=rows=>digest(rows.map(stable).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
function matching(rows,event) {
  return list(rows).filter(row => eventOf(row) === String(event.eventId) &&
    (!row.sport || row.sport === event.sport || event.sport === 'NBA_WNBA' && ['NBA','WNBA'].includes(row.sport)) &&
    (!row.startTime || iso(row.startTime) === iso(event.eventDate || event.startTime)));
}
export function eventSnapshot({event, selections = [], inputs = {}, observer = null}) {
  const rows=matching(selections,event);
  const quotes=rows.flatMap(row => list(row.quotes).length ? row.quotes : row.quote ? [row.quote] : row.decision?.feed ? [row.decision.feed] : []);
  const contracts=rows.map(row => ({selectionId:row.selectionId,marketDetail:row.marketDetail,period:row.period,settlement:row.settlement,
    quotes:quotes.filter(quote=>eventOf(quote)===String(event.eventId)&&(!row.selectionId ||
      list(row.quotes).includes(quote)||row.quote===quote||row.decision?.feed===quote))
      .map(quote=>({selectionKey:quote.selectionKey,marketKey:quote.marketKey,side:quote.side,line:quote.line ?? null,
        book:quote.book || quote.bookmaker,period:quote.period,settlement:quote.settlement}))
      .map(stable).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))}));
  const facts=matching(inputs.facts,event);
  const models=[...matching(inputs.records,event),...matching(inputs.curatedPicks,event),...matching(inputs.internalModels,event)];
  // Include sharp prices as a research change; they never create a decision.
  const sharp=observer ? matching(observer.fixtures || observer.events,event) : [];
  return {eventKey:keyOf(event),eventId:String(event.eventId),sport:event.sport,eventDate:iso(event.eventDate || event.startTime),
    signatures:{contracts:setDigest(contracts),prices:setDigest(quotes.map(quote=>({selectionKey:quote.selectionKey,
      book:quote.book || quote.bookmaker,priceDecimal:quote.priceDecimal,line:quote.line ?? null}))),
      facts:digest(stable(uniqueContent(facts))),forecasts:digest(stable(uniqueContent(models))),
      benchmark:digest(stable(uniqueContent(sharp)))}};
}

// Keep one small reference per reviewed game INSIDE its existing checkpoint.
// The full findings stay in the same report/sidecar; nothing is re-issued here.
export function rememberEventAssessment(state,eventId,inventory,{reviewedAt,observer}={}) {
  const rows=list(inventory?.selections).filter(row=>String(row.eventId)===String(eventId));
  if(!rows.length)return;
  const event=rows[0],key=keyOf(event),receipts=list(state.sidecar?.primaryAnalysis?.receipts).filter(row=>eventOf(row)===String(eventId));
  const subset={...state,sidecar:{...state.sidecar,primaryAnalysis:{...state.sidecar?.primaryAnalysis,receipts}}};
  const health=reportRunHealth(subset);
  const incomplete=receipts.length!==rows.length||health.continuationRequired||health.forecastReviewHandoff.pending>0;
  state.gameAssessments ||= {};
  state.gameAssessments[key]={...eventSnapshot({event,selections:rows,inputs:state.sidecar?.gameIntelligenceInputs,observer}),
    candidateId:state.identity.candidateId,feedBlobSha:state.identity.feedBlobSha,
    reviewedAt:reviewedAt || state.report.ts,reportTs:state.report.ts,
    state:incomplete?'UNFINISHED':'REVIEWED',available:rows.length,evaluated:receipts.filter(row=>row.state==='EVALUATED').length,
    documentedShortfalls:health.remainingWork.documentedShortfalls,
    rechecks:[...new Set(receipts.flatMap(row=>{
      const rec=row.decision || row.candidateDraft?.decision || {};
      return [rec.forecastLean?.recheckCondition,rec.forecastWait?.recheckCondition,
        rec.cardEvidence?.waitCondition?.trigger,...list(rec.personnelEvidence?.unresolved)];
    }).filter(value=>typeof value==='string'&&value.trim()))]};
}

export function loadGameAssessments(root,report,{excludeCheckpoint}={}) {
  const assessments=new Map(),warnings=[],dir=path.join(root,'data/report-production/checkpoints');
  if(!fs.existsSync(dir))return {assessments,warnings};
  const day=report.ts.slice(0,10),compact=day.replaceAll('-','');
  for(const name of fs.readdirSync(dir).filter(name=>/\.json$/.test(name)&&(name.includes(day)||name.includes(compact)))){
    const file=path.join(dir,name);
    if(excludeCheckpoint&&path.resolve(file)===path.resolve(excludeCheckpoint))continue;
    try{
      const state=parseReportDocument(fs.readFileSync(file),'REPORT_CHECKPOINT');
      if(state.report?.ts?.slice(0,10)!==day||stamp(state.report.ts)>=stamp(report.ts)||
        state.identity?.ts!==state.report.ts||state.identity?.feedBlobSha!==state.sidecar?.provenance?.feedBlobSha)continue;
      for(const row of Object.values(state.gameAssessments || {})){
        if(!row.eventKey||!row.signatures||!['REVIEWED','UNFINISHED'].includes(row.state)||
          !Number.isFinite(stamp(row.reviewedAt))||stamp(row.reviewedAt)>stamp(report.ts)||
          row.feedBlobSha!==state.identity.feedBlobSha||row.eventKey!==keyOf(row)||
          !Number.isFinite(stamp(row.reportTs))||stamp(row.reportTs)>stamp(state.report.ts)||
          !list(state.events).some(trace=>trace.command==='checkpoint'&&String(trace.eventId)===row.eventId))continue;
        const prior=assessments.get(row.eventKey);
        if(!prior||stamp(row.reviewedAt)>stamp(prior.reviewedAt))assessments.set(row.eventKey,{...row,checkpointPath:path.relative(root,file).split(path.sep).join('/')});
      }
    }catch(error){warnings.push('Saved assessment unavailable at '+name+': '+error.message);}
  }
  return {assessments,warnings};
}

export function buildSlateWorkload({report,events=[],inventory={},inputs={},observer=null,previous=new Map(),acquisition=null}={}) {
  const games=list(events).filter(event=>stamp(event.eventDate || event.startTime)>stamp(report.ts)).map(event=>{
    const current=eventSnapshot({event,selections:inventory.selections,inputs,observer}),prior=previous.get(current.eventKey);
    const changed=prior?Object.keys(current.signatures).filter(key=>current.signatures[key]!==prior.signatures?.[key]):[];
    const mode=!prior?'INITIAL_REVIEW':prior.state!=='REVIEWED'?'RESUME_REVIEW':changed.some(key=>['contracts','facts','forecasts'].includes(key))?
      'TARGETED_RESEARCH':changed.length?'REPRICE':'REVALIDATE';
    return {eventId:current.eventId,sport:event.sport,startTime:current.eventDate,label:event.label || [event.away,event.home].filter(Boolean).join(' @ '),
      mode,changed,priorAssessment:prior?{checkpointPath:prior.checkpointPath,candidateId:prior.candidateId,reviewedAt:prior.reviewedAt,
        state:prior.state,documentedShortfalls:prior.documentedShortfalls}:null,
      rechecks:prior?.rechecks || [],
      nextAction:mode==='REVALIDATE'?'Reuse the saved game reasoning. Check current applicability, exact prices and named rechecks; do not repeat broad source discovery.':
        mode==='REPRICE'?'Reassess the changed exact quote or sharp comparison using the saved game research. Research further only if it changes the judgment.':
        mode==='TARGETED_RESEARCH'?'Review the changed contract, personnel facts or forecast, then update affected decisions in the existing queue.':
        mode==='RESUME_REVIEW'?'Resume the saved unfinished event review and its named gaps; preserve completed source work.':
        'Assess this game once using captured forecasts, current personnel and exact prices; share the facts across its markets and hotlines.'};
  });
  const priced=games.filter(game=>list(inventory.selections).some(row=>String(row.eventId)===game.eventId));
  const feedAge=stamp(report.ts)-stamp(report.feedGeneratedAt);
  const slateUnverified=!Number.isFinite(feedAge)||feedAge<0||feedAge>75*60000||
    acquisition?.discoveryFailures>0||acquisition?.pendingPrimaryEvents>games.length||
    list(acquisition?.errors).some(error=>error.stage==='events');
  return {schema:1,mode:'SLATE_FOCUSED_WORKLOAD',decisionAuthority:false,
    state:games.length===0?(slateUnverified?'SLATE_UNVERIFIED':'NO_UPCOMING_GAMES'):priced.length===0?'PRICES_UNAVAILABLE':'WORK_AVAILABLE',
    games:games.length,pricedGames:priced.length,counts:games.reduce((counts,game)=>({...counts,[game.mode]:(counts[game.mode] || 0)+1}),{}),
    staffing:{initialWorkers:0,routineWorkers:0,maxTargetedWorkers:priced.length>6?1:0,
      instruction:priced.length<=6?'One analyst covers this slate. No routine delegation.':'One coordinator screens the slate. At most one targeted worker for a named consequential question.'},
    assessments:games,
    instruction:'Use the existing checkpoints as the shared game record. Reuse facts, preserve original source clocks, assess every current exact contract, and deepen only decision-changing questions. This plan never grants freshness, personnel clearance, a grade or publication approval.'};
}
