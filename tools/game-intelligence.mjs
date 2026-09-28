// One event dossier shared by the collector, producer and issued report.
// Observations are evidence to assess. A descriptive consensus never sets stakes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {mergedFeedEvents, majorSportKey} from './major-sport-market-coverage-gate.mjs';
import {forecastCandidate, forecastMarketClass, forecastPriceComparison} from './forecast-evidence.mjs';
import {teamAbbr} from './graham-market-utils.mjs';
import {exactMarketReference,marketComparison} from './market-price-assessment.mjs';
import {loadGrahamHandoffInputs} from './graham-fair-handoff.mjs';

export const INTELLIGENCE_FROM = '2026-09-27T12:00:00-07:00';
export const list = x => Array.isArray(x) ? x : [];
export const number = x => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x)) ? Number(x) : null;
export const digest = x => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
export const readOptional = file => {try {return JSON.parse(fs.readFileSync(file));} catch {return null;}};
const time = x => Date.parse(x || '');
const sameTime = (a,b) => Number.isFinite(time(a)) && time(a) === time(b);
const unique = xs => [...new Set(xs.filter(Boolean))];
export const sportOf = event => majorSportKey(event) === 'NBA_WNBA' ? (/wnba/.test(event.league?.slug || '') ? 'WNBA' : 'NBA') : majorSportKey(event);
export const eventIdentity = event => ({eventId:String(event.eventId || event.id), sport:sportOf(event),
  home:event.home, away:event.away, startTime:event.date || event.identity?.startTime});
export const sameEvent = (record,event) => String(record.eventId) === String(event.eventId) && record.sport === event.sport && sameTime(record.startTime,event.startTime);
export function recordId(record) {const {recordId:ignored,...value}=record; return digest(value);}
export function validateCapture(capture,registry) {
  if(capture?.schema!==1 || !Number.isFinite(time(capture.collectedAt)) || !Array.isArray(capture.records)) throw Error('Invalid aggregation capture');
  const ids=new Map();
  for(const row of capture.records) {
    const source=registry.sources?.[row.sourceId];
    if(!source || row.modelFamily!==source.modelFamily || !row.eventId || !row.sport ||
      !Number.isFinite(time(row.startTime)) || !Number.isFinite(time(row.observedAt)) || time(row.observedAt)>time(capture.collectedAt) ||
      time(row.observedAt)>=time(row.startTime) || row.state!=='PRE_GAME' || !/^https:\/\//.test(row.url||'') || !row.sourceField || !row.recordId)
      throw Error('Invalid source observation: '+(row.recordId||row.sourceId));
    if(row.forecastAt!=null && (!Number.isFinite(time(row.forecastAt)) || time(row.forecastAt)>time(row.observedAt))) throw Error('Future or invalid model time');
    if(row.kind==='OUTCOME_PROBABILITY' && (typeof row.probability!=='number' || row.probability<0 || row.probability>1)) throw Error('Invalid probability');
    if(row.marketDetail!=='full_game_moneyline' && row.kind==='OUTCOME_PROBABILITY' && number(row.line)===null) throw Error('Exact probability line missing');
    if(ids.has(row.recordId)&&!isDeepStrictEqual(ids.get(row.recordId),row)) throw Error('Conflicting observation ID');
    ids.set(row.recordId,row);
  }
  return capture;
}

export function loadCapture(root,asOf) {
  const current=readOptional(path.join(root,'data/game-intelligence/current.json'));
  if(current && time(current.collectedAt)<=time(asOf)) return current;
  // A historical report may never borrow a later snapshot.
  return null;
}

function internalModels(root,events,asOf,sidecar) {
  if(!events.some(e=>e.sport==='NFL'))return [];
  const inputs=loadGrahamHandoffInputs(root,{ts:asOf},sidecar);
  if(!sidecar.grahamFairHandoffInputs)sidecar.grahamFairHandoffInputs=structuredClone(inputs.binding);
  if(inputs.state!=='BOUND')return [];
  const {board,boardPath:sourcePath}=inputs;
  return events.filter(e=>e.sport==='NFL').flatMap(event=>{
    const matches=list(board?.games).filter(g=>g.home===teamAbbr(event.home)&&g.away===teamAbbr(event.away)&&sameTime(g.startTimePacific,event.startTime));
    if(matches.length!==1) return [];
    const g=matches[0];
    if(time(g.grahamAsOf)>time(asOf) || !Number.isFinite(time(g.grahamAsOf))) return [];
    return [{...event,sourceId:'graham_walters',publisher:'Graham / Walters',modelFamily:'GRAHAM_WALTERS',
      kind:'PROJECTED_SPREAD',homeFairPoints:number(g.grahamExactFairHome),observedAt:g.grahamAsOf,
      sourcePath,sourceDigest:digest(g),numberStatus:g.numberStatus,summary:g.researchSummary,
      decomposition:g.fairDecomposition||null,adjustments:list(g.adjustments).map(a=>({type:a.type,pointsToHomeSpread:a.pointsToHomeSpread,reason:a.reason})),
      unresolved:{personnel:list(g.personnelUnresolvedCases),groups:list(g.personnelBlockedGroups),qb:list(g.qbPerformanceFailClosedTeams)},
      sourceRefs:list(g.sourceRefs),limitation:'One related internal model family. Native spread points; current personnel review is still required.'}];
  });
}
function knowledge(root,sports) {
  const library=readOptional(path.join(root,'research/research-library.json'));
  return list(library?.items).filter(item=>list(item.scope?.sports).some(s=>s==='Cross-Sport'||sports.includes(s))).map(item=>({
    id:item.priorId,topic:item.topic,sports:item.scope?.sports,markets:item.scope?.marketClasses,
    finding:item.finding,guidance:item.guidance,evidenceTier:item.evidence?.tier,
    sourceIds:item.provenance?.sourceIds,clusterIds:item.clusterIds,
    role:'RESEARCH_GUIDANCE_REQUIRES_GAME_APPLICABILITY'}));
}
export function bindIntelligence({root,report,sidecar,feed,universe,liveBoard=false}) {
  if(!liveBoard&&time(report.ts)<time(INTELLIGENCE_FROM)) return null;
  if(sidecar.gameIntelligenceInputs) return sidecar.gameIntelligenceInputs;
  const available=new Set(list(universe?.selections).map(s=>String(s.eventId)));
  const events=[...mergedFeedEvents(feed).values()].map(eventIdentity).filter(e=>available.has(e.eventId));
  const capture=loadCapture(root,report.ts);
  const records=list(capture?.records).filter(row=>time(row.observedAt)<=time(report.ts)&&events.some(e=>sameEvent(row,e)));
  const news=readOptional(path.join(root,'data/game-intelligence/personnel-news.json'));
  const personnelFacts=news?.schema===1?list(news.facts).filter(row=>
    row.requiresCurrentApplicabilityReview===true && /^https:\/\//.test(row.url||'') &&
    Number.isFinite(time(row.observedAt)) && time(row.observedAt)<=time(report.ts) && time(row.observedAt)<time(row.startTime) &&
    events.some(e=>sameEvent(row,e)&&row.home===e.home&&row.away===e.away)):[];
  const facts=[...list(capture?.facts),...personnelFacts].filter(row=>time(row.observedAt)<=time(report.ts)&&events.some(e=>sameEvent(row,e)));
  const inputs={schema:1,asOf:report.ts,collectedAt:capture?.collectedAt||null,snapshotId:capture?.snapshotId||null,
    personnelNewsDigest:personnelFacts.length?digest(personnelFacts):null,
    sources:list(capture?.sources),records,facts,quoteHistory:list(capture?.quoteHistory),internalModels:internalModels(root,events,report.ts,sidecar),
    knowledge:knowledge(root,unique(events.map(e=>e.sport))),
    limitation:'Original observation times are preserved. Report decisions must assess current event, personnel and exact quote applicability.'};
  sidecar.gameIntelligenceInputs=inputs;
  // Feed the existing assessment path, not a parallel model-decision engine.
  sidecar.forecastEvidence ||= {schema:1,records:[],attempts:[],revalidations:[]};
  sidecar.forecastEvidence.records ||= [];
  for(const row of records.filter(r=>r.kind==='OUTCOME_PROBABILITY'||r.kind==='SCORE_CONTEXT')) {
    const existing=sidecar.forecastEvidence.records.find(r=>r.recordId===row.recordId);
    if(existing&&!isDeepStrictEqual(existing,row)) throw Error('Conflicting immutable forecast in game dossier');
    if(!existing) sidecar.forecastEvidence.records.push(structuredClone(row));
  }
  return inputs;
}

export function summarizeModels(records,asOf) {
  // Latest observation per source/field. Syndication does not multiply votes.
  const latest=new Map();
  for(const row of records) {
    if(time(row.observedAt)>time(asOf)||time(row.observedAt)>=time(row.startTime)) continue;
    const key=[row.sourceId,row.kind,row.marketDetail,row.side,row.line??''].join('|');
    if(!latest.has(key)||time(row.observedAt)>time(latest.get(key).observedAt))latest.set(key,row);
  }
  const rows=[...latest.values()].map(row=>({...row,
    ageMinutes:(time(asOf)-time(row.observedAt))/60000,
    freshness:time(asOf)>=time(row.startTime)?'EVENT_STARTED':time(asOf)-time(row.observedAt)>60*60000?'REFRESH_DUE':'RECENT_CAPTURE'}));
  const groups=new Map();
  for(const row of rows.filter(r=>r.kind==='OUTCOME_PROBABILITY'&&r.freshness==='RECENT_CAPTURE'&&
    ['UNCONDITIONAL','CONDITIONAL_ON_NO_PUSH'].includes(r.probabilityBasis)&&r.settlement)) {
    const key=[row.marketDetail,row.side,row.line??'',row.probabilityBasis||'UNKNOWN',JSON.stringify(row.settlement||null)].join('|');
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(row);
  }
  const consensus=[...groups.values()].map(group=>{
    const families=new Map();
    for(const row of group) {
      const previous=families.get(row.modelFamily);
      if(!previous||time(row.observedAt)>time(previous.observedAt))families.set(row.modelFamily,row);
    }
    const values=[...families.values()].map(r=>r.probability).sort((a,b)=>a-b),first=group[0];
    const mid=Math.floor(values.length/2),median=values.length%2?values[mid]:(values[mid-1]+values[mid])/2;
    return {marketDetail:first.marketDetail,side:first.side,line:first.line??null,probabilityBasis:first.probabilityBasis||'UNKNOWN',
      families:families.size,sources:unique(group.map(r=>r.sourceId)),median,min:values[0],max:values.at(-1),
      disagreementPoints:(values.at(-1)-values[0])*100,kind:'DESCRIPTIVE_MODEL_RANGE',
      limitation:'Describes published model values. It is not a calibrated fair value, confidence interval or count of independent models.'};
  });
  return {rows,consensus};
}

// The full catalogue is pinned in the report, but do not resend it for every
// game in an agent's working context. Resolve a relevant prior by its stable ID.
export function projectGameIntelligence(intelligence,eventId){
  if(!intelligence)return null;
  const games=intelligence.games.filter(g=>g.eventId===String(eventId)),ids=new Set(games.flatMap(g=>g.knowledgeIds));
  const {knowledge,...view}=intelligence;
  return {...view,games,sources:list(view.sources).filter(s=>!s.eventId||String(s.eventId)===String(eventId)),
    knowledgeIndex:{path:'research/research-library.json',instruction:'Read the applicable items by priorId from the shared library; the full original guidance is pinned in gameIntelligenceInputs and displayed in the report.',
      items:list(knowledge).filter(k=>ids.has(k.id)).map(k=>({priorId:k.id,topic:k.topic,evidenceTier:k.evidenceTier}))}};
}

export function buildGameIntelligence({report,sidecar={},feed,universe,forecastCoverage,candidateAssessment,eventResearchPlan,observer}) {
  const inputs=sidecar.gameIntelligenceInputs;
  if(!inputs) return null;
  const sourceEvents=mergedFeedEvents(feed),ids=unique(list(universe?.selections).map(s=>String(s.eventId)));
  const records=[...list(inputs.records),...list(sidecar.forecastEvidence?.records)].filter((row,i,all)=>all.findIndex(x=>x.recordId===row.recordId)===i);
  const games=ids.map(id=>{
    const event=eventIdentity(sourceEvents.get(id)),selections=list(universe.selections).filter(s=>String(s.eventId)===id);
    const models=summarizeModels(records.filter(r=>sameEvent(r,event)),report.ts);
    const plan=list(eventResearchPlan?.events).find(e=>String(e.eventId)===id);
    const facts=[...list(inputs.facts).filter(r=>sameEvent(r,event)),...list(plan?.researchPackage?.sources).map(({source,priorReportPath})=>({
      ...event,sourceId:source.id,url:source.url,observedAt:source.checkedAt||source.asOf,kind:source.kind,
      finding:source.finding||source.fact,priorReportPath,requiresCurrentApplicabilityReview:true}))];
    const markets=selections.map(selection=>{
      const candidate=forecastCandidate(selection,{feed}),assessed=list(candidateAssessment?.selections).find(s=>s.selectionId===selection.selectionId);
      const coverage=list(forecastCoverage?.selections).find(s=>s.selectionId===selection.selectionId);
      const comparisons=list(selection.quotes).map(quote=>{
        const c=forecastCandidate({...selection,quote},{feed});
        const observedAt=quote.quoteObservedAt||quote.observedAt||null,changedAt=quote.quoteUpdatedAt||quote.updatedAt||null;
        const ageMinutes=(time(report.ts)-time(observedAt||changedAt))/60000;
        const previous=list(inputs.quoteHistory).filter(q=>q.eventId===event.eventId&&sameTime(q.startTime,event.startTime)&&
          q.book===quote.book&&q.marketDetail===candidate.marketDetail&&q.side===quote.side&&time(q.observedAt)<time(observedAt||changedAt))
          .sort((a,b)=>time(b.observedAt)-time(a.observedAt))[0];
        let benchmark=null,benchmarkUnavailable=null;
        if(observer)try{
          const reference=exactMarketReference(report,{...quote,eventDate:event.startTime},observer);
          benchmark={...marketComparison(quote.priceDecimal,reference.selected.noVigProbability),observedAt:reference.generatedAt};
        }catch(error){benchmarkUnavailable=error.message;}
        return {book:quote.bookmaker||quote.book,selectionKey:quote.selectionKey,side:quote.side,line:c.line,priceDecimal:quote.priceDecimal,
          observedAt,changedAt,ageMinutes:Number.isFinite(ageMinutes)?ageMinutes:null,
          priceState:Number.isFinite(ageMinutes)&&ageMinutes>=0&&ageMinutes<=75?'RECENT_SNAPSHOT':'REFRESH_REQUIRED',
          movement:previous?{from:previous.observedAt,to:observedAt||changedAt,previousLine:previous.line,previousPrice:previous.priceDecimal,
            lineChange:c.line===null?null:c.line-previous.line,priceChangeAtSameLine:c.line===previous.line?quote.priceDecimal-previous.priceDecimal:null}:null,
          benchmark,benchmarkUnavailable,
          breakEvenProbability:1/quote.priceDecimal,
          forecasts:models.rows.filter(r=>r.kind==='OUTCOME_PROBABILITY'&&r.marketDetail===c.marketDetail&&r.side===c.side&&
            (c.marketClass==='moneyline'||r.line===c.line)).map(r=>{
              const review=list(coverage?.records).find(x=>x.recordId===r.recordId);
              return {recordId:r.recordId,sourceId:r.sourceId,probability:r.probability,
                reviewState:review?.eligibility||'REVIEW_REQUIRED',reasons:review?.reasons||[],
                comparison:review?.eligibility==='ELIGIBLE_EXACT'?forecastPriceComparison(r,c.priceDecimal):null};
            })};
      });
      return {selectionId:selection.selectionId,marketDetail:candidate.marketDetail,side:candidate.side,quotes:comparisons,
        marketComparison:assessed?.marketComparison||null,nativeFairComparison:assessed?.nativeFairComparison||null,
        status:assessed?.status||null,reviewState:assessed?.reviewState||'UNASSESSED'};
    });
    const internal=list(inputs.internalModels).filter(r=>sameEvent(r,event));
    const familyCount=unique(models.rows.map(r=>r.modelFamily)).length;
    return {...event,label:`${event.away} @ ${event.home}`,priceSnapshotAt:feed.generatedAt,externalModels:models.rows,consensus:models.consensus,
      internalModels:internal,facts,markets,
      knowledgeIds:list(inputs.knowledge).filter(k=>list(k.sports).includes('Cross-Sport')||list(k.sports).includes(event.sport)).map(k=>k.id),
      summary:{sources:unique(models.rows.map(r=>r.sourceId)).length,modelFamilies:familyCount,internalFamilies:internal.length?1:0,
        exactReviewed:list(forecastCoverage?.selections).filter(r=>String(r.eventId)===id&&r.coverage==='EXACT_ELIGIBLE').length,
        completed:plan?.completed||0,available:selections.length},
      nextAction:'Review source timing and personnel once for this game; explain agreement and conflict for the exact available market and price.'};
  }).sort((a,b)=>time(a.startTime)-time(b.startTime)||a.eventId.localeCompare(b.eventId));
  return {schema:1,version:'2026-09-27.1',asOf:report.ts,collectedAt:inputs.collectedAt,snapshotId:inputs.snapshotId,
    decisionAuthority:false,sources:inputs.sources,games,knowledge:inputs.knowledge,
    counts:{games:games.length,withExternalModels:games.filter(g=>g.externalModels.length).length,
      withInternalModels:games.filter(g=>g.internalModels.length).length,observations:games.reduce((n,g)=>n+g.externalModels.length,0)},
    limitation:'Source agreement is descriptive. Current price, applicable research and uncertainty determine the issued decision.'};
}
