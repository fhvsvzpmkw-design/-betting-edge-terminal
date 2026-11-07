// Shared research feedback. No network requests, model calls or wagering actions.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const ADAPTIVE_RESEARCH_FROM = '2026-11-06T17:00:00Z';
export const adaptiveResearchActive = report => Date.parse(report?.ts) >= Date.parse(ADAPTIVE_RESEARCH_FROM);
const list = x => Array.isArray(x) ? x : [];
const time = x => Date.parse(x || '');
const finite = x => typeof x === 'number' && Number.isFinite(x);
const read = file => {try {return JSON.parse(fs.readFileSync(file));} catch {return null;}};
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sameEvent = (a,b) => String(a.eventId) === String(b.eventId) && a.sport === b.sport && time(a.startTime) === time(b.startTime);
const mean = xs => xs.length ? xs.reduce((s,x)=>s+x,0)/xs.length : null;

export function loadStrategyResearch(root, asOf) {
  if (!adaptiveResearchActive({ts:asOf})) return null;
  const registry = read(path.join(root,'research/strategy-registry.json'));
  if (registry?.schema !== 1 || time(registry.effectiveFrom) > time(asOf)) return null;
  const performance = read(path.join(root,'data/game-intelligence/performance.json'));
  const available = Number.isFinite(time(performance?.asOf)) && time(performance.asOf) <= time(asOf);
  return {schema:1,asOf,registryDigest:hash(registry),methods:registry.methods,
    feedback:available ? {asOf:performance.asOf,sourceForm:performance.sourceForm||sourceFormFeedback(performance.rows),
      strategies:performance.strategyLearning ? {asOf:performance.strategyLearning.asOf,byMethod:performance.strategyLearning.byMethod,
        interpretation:performance.strategyLearning.interpretation,limitation:performance.strategyLearning.limitation} : null,
      curatedSources:performance.curatedSources||null} : null,
    instruction:'Use these methods before forming a candidate. Propose and test additional methods, explain current applicability and contrary evidence, and use saved feedback to revise analytical preferences. Pinnacle, source counts and old opinion thresholds are inputs, not universal research vetoes. Current data integrity and BET risk requirements still apply.'};
}

export function sourceFormFeedback(rows) {
  const groups = new Map();
  for (const row of list(rows).filter(r=>r.state==='GRADED' && finite(r.brier))) {
    const key = [row.sourceId,row.sport,row.marketDetail].join('|');
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(row);
  }
  return [...groups.values()].map(group=>{
    // Last 30 games is a descriptive display window, never a confidence rule.
    const unique = [...new Map(group.sort((a,b)=>time(a.startTime)-time(b.startTime)).map(r=>[[r.eventId,r.startTime].join('|'),r])).values()];
    const recent = unique.slice(-30);
    return {sourceId:group[0].sourceId,sport:group[0].sport,marketDetail:group[0].marketDetail,
      games:unique.length,brier:mean(unique.map(r=>r.brier)),recentGames:recent.length,recentBrier:mean(recent.map(r=>r.brier)),
      interpretation:'Lower Brier loss is better. Overlapping recent/all samples are descriptive; compare applicability and uncertainty before changing source influence.'};
  });
}

export function eventStrategyResearch(event, inputs, facts = []) {
  if (!inputs) return null;
  // Inventory groups NBA/WNBA, while source feedback and methods use the actual
  // league. Resolve it only from this exact event's preserved source facts.
  const exactFacts = list(facts).filter(f=>String(f.eventId)===String(event.eventId) && time(f.startTime)===time(event.startTime));
  const basketballSports = [...new Set(exactFacts.map(f=>f.sport).filter(s=>['NBA','WNBA'].includes(s)))];
  const sport = event.sport==='NBA_WNBA' && basketballSports.length===1 ? basketballSports[0] : event.sport;
  const methods = list(inputs.methods).filter(m=>list(m.sports).some(s=>s==='ALL'||s===sport));
  return {schema:1,registryDigest:inputs.registryDigest,
    methods:methods.map(({id,version,kind,name,question,limitation})=>({id,version,kind,name,question,limitation})),
    registryPath:'research/strategy-registry.json',
    sourceForm:list(inputs.feedback?.sourceForm).filter(row=>row.sport===sport),
    performance:list(inputs.feedback?.strategies?.byMethod).filter(row=>row.sport===sport),
    curatedPerformance:list(inputs.feedback?.curatedSources?.byOrigin).filter(row=>row.sport===sport),
    recentGameFacts:list(facts).filter(row=>row.kind==='RECENT_GAMES'),
    feedbackAsOf:inputs.feedback?.asOf||null,instruction:inputs.instruction};
}

function validQuote(q, at, feedAt) {
  return finite(q.priceDecimal) && q.priceDecimal > 1 && Number.isFinite(time(q.observedAt)) &&
    time(q.observedAt) <= time(feedAt) && time(feedAt)-time(q.observedAt) <= 30*60000 &&
    time(feedAt) <= time(at) && time(at)-time(feedAt) <= 75*60000 && time(at) < time(q.startTime);
}
function forecastMatches(record,q,at) {
  return Boolean(record.recordId&&record.sourceId) && sameEvent(record,q) && record.state==='PRE_GAME' && record.kind==='OUTCOME_PROBABILITY' && record.period==='FULL_GAME' &&
    record.marketDetail===q.marketDetail && record.side===q.side && (record.line??null)===(q.line??null) &&
    finite(record.probability) && record.probability>0 && record.probability<1 && /^https:\/\//.test(record.url||'') &&
    Number.isFinite(time(record.observedAt)) && time(record.observedAt)<=time(at) && time(at)-time(record.observedAt)<=60*60000 &&
    time(record.observedAt)<time(record.startTime) && typeof record.settlement?.includesOvertime==='boolean' &&
    (record.probabilityBasis==='CONDITIONAL_ON_NO_PUSH' || (record.probabilityBasis==='UNCONDITIONAL' &&
      (record.settlement?.pushRule==='NO_PUSH' || finite(record.pushProbability)&&record.pushProbability>=0&&record.pushProbability<1&&record.probability+record.pushProbability<=1))) &&
    ['NO_PUSH','REFUND'].includes(record.settlement?.pushRule);
}
function conditionalPoint(record) {
  return record.probabilityBasis==='CONDITIONAL_ON_NO_PUSH' || record.settlement.pushRule==='NO_PUSH'
    ? record.probability : record.pushProbability<1 ? record.probability/(1-record.pushProbability) : null;
}

export function buildStrategyTrials({registry,records=[],quotes=[],facts=[],at,feedGeneratedAt}) {
  if (!adaptiveResearchActive({ts:at}) || registry?.schema!==1 || time(registry.effectiveFrom)>time(at)) return [];
  const methods = new Map(list(registry.methods).filter(m=>m.kind==='PROSPECTIVE_TEST' && (!m.effectiveFrom || time(m.effectiveFrom)<=time(at))).map(m=>[m.id,m]));
  const trials=[];
  function add(method,q,source,{recordIds=[],sourceUrls=[],probability=null,trigger=null,checks={},settlement={includesOvertime:true,pushRule:'NO_PUSH'}}={}) {
    if (!method || !validQuote(q,at,feedGeneratedAt)) return;
    const ruleFingerprint=hash(method),key=[method.id,method.version,ruleFingerprint,source,q.sport,q.eventId,q.startTime,q.marketDetail,q.side,q.line??'',q.book];
    trials.push({schema:1,trialId:hash(key),methodId:method.id,methodVersion:method.version,ruleFingerprint,
      rule:method.rule,source,...q,observedAt:at,quoteObservedAt:q.observedAt,feedGeneratedAt,
      recordIds,sourceUrls,probability,trigger,checks,settlement,
      authority:'RESEARCH_ONLY',limitation:'Frozen prospective research sample; not an issued recommendation, actual wager or calibrated fair.'});
  }
  for (const q of quotes.filter(q=>validQuote(q,at,feedGeneratedAt))) {
    const matching=records.filter(r=>forecastMatches(r,q,at));
    const latest=new Map();
    for(const r of matching) {
      const family=r.modelFamily||r.sourceId,old=latest.get(family);
      if(!old || time(r.observedAt)>time(old.observedAt)) latest.set(family,r);
      else if(time(r.observedAt)===time(old.observedAt) && r.probability!==old.probability) latest.set(family,{...old,conflicting:true});
    }
    const supporting=[...latest.values()].filter(r=>!r.conflicting && conditionalPoint(r)>1/q.priceDecimal);
    for (const r of supporting) add(methods.get('forecast_price'),q,r.modelFamily||r.sourceId,
      {recordIds:[r.recordId],sourceUrls:[r.url],probability:conditionalPoint(r),settlement:r.settlement,
        checks:{pinnacleDirection:q.pinnacleDirection||'UNAVAILABLE',supportingFamilies:supporting.length}});
  }
  // The provider's captured recent-game sequence supplies the window. Never
  // infer a streak from the incomplete population of games in our archive.
  const hot=new Map();
  for (const original of facts.filter(f=>f.kind==='RECENT_GAMES' && Number.isFinite(time(f.observedAt)) &&
    time(f.observedAt)<=time(at) && time(at)-time(f.observedAt)<=60*60000 && time(at)<time(f.startTime) && /^https:\/\//.test(f.url||''))) {
    const fact={...original,team:original.details?.team??original.team,events:original.details?.events??original.events};
    const games=list(fact.events).filter(g=>Number.isFinite(time(g.date)) && time(g.date)<time(fact.observedAt)).sort((a,b)=>time(b.date)-time(a.date));
    const wins=games.findIndex(g=>!/^W(?:IN)?$/i.test(String(g.result||'')));
    const consecutive=wins<0?games.length:wins;
    const method=methods.get('recent_form_follow'),minimum=method?.parameters?.consecutiveWins;
    if(!Number.isInteger(minimum)||games.length<minimum||consecutive<minimum)continue;
    const key=[fact.sport,fact.eventId,fact.startTime].join('|');
    if(!hot.has(key)) hot.set(key,[]);hot.get(key).push({fact,consecutive});
  }
  for(const entries of hot.values()) {
    const teams=[...new Set(entries.map(e=>e.fact.team))];
    if(teams.length!==1)continue;
    const {fact,consecutive}=entries.sort((a,b)=>time(b.fact.observedAt)-time(a.fact.observedAt))[0];
    const side=fact.team===fact.home?'home':fact.team===fact.away?'away':null;
    if(!side)continue;
    for(const q of quotes.filter(q=>sameEvent(q,fact)&&q.marketDetail==='full_game_moneyline' && ['NBA','WNBA','NHL','MLB'].includes(q.sport))) {
      const method=methods.get(q.side===side?'recent_form_follow':'recent_form_fade');
      if(method?.parameters?.consecutiveWins!==methods.get('recent_form_follow')?.parameters?.consecutiveWins)continue;
      add(method,q,'ESPN_RECENT_GAMES',{sourceUrls:[fact.url],trigger:{team:fact.team,windowGames:list(fact.events).length,consecutiveWins:consecutive,sourceObservedAt:fact.observedAt}});
    }
  }
  return [...new Map(trials.map(t=>[t.trialId,t])).values()];
}

function scoreTrial(trial,result) {
  if (!result || result.state!=='FINAL') return {state:'PENDING'};
  if (result.special) return {state:'UNRESOLVED'};
  if(!finite(result.homeScore)||!finite(result.awayScore))return {state:'UNRESOLVED'};
  const margin=/moneyline/.test(trial.marketDetail) ? (trial.side==='home'?1:-1)*(result.homeScore-result.awayScore) :
    /spread|run_line|puck_line/.test(trial.marketDetail) ? (trial.side==='home'?1:-1)*(result.homeScore-result.awayScore)+trial.line :
    /total/.test(trial.marketDetail) ? (trial.side==='over'?1:-1)*(result.homeScore+result.awayScore-trial.line) : NaN;
  if(!finite(margin))return {state:'UNRESOLVED'};
  if(margin===0)return trial.settlement?.pushRule==='REFUND'?{state:'SETTLED',outcome:'PUSH',units:0,brier:null}:{state:'UNRESOLVED'};
  const won=margin>0;
  return {state:'SETTLED',outcome:won?'WIN':'LOSS',units:won?trial.priceDecimal-1:-1,
    brier:finite(trial.probability)?(trial.probability-(won?1:0))**2:null};
}
function summarizeTrials(rows) {
  const settled=rows.filter(r=>r.state==='SETTLED'),events=new Map();
  const units=settled.reduce((s,r)=>s+r.units,0),roi=settled.length?units/settled.length:null;
  for(const r of settled){const key=[r.eventId,r.startTime].join('|'),e=events.get(key)||{units:0,n:0};e.units+=r.units;e.n++;events.set(key,e);}
  const se=events.size>=30?Math.sqrt(events.size/(events.size-1)*[...events.values()].reduce((s,e)=>s+(e.units-roi*e.n)**2,0))/settled.length:null;
  return {observations:rows.length,settled:settled.length,events:events.size,pending:rows.filter(r=>r.state==='PENDING').length,unresolved:rows.filter(r=>r.state==='UNRESOLVED').length,
    wins:settled.filter(r=>r.outcome==='WIN').length,losses:settled.filter(r=>r.outcome==='LOSS').length,pushes:settled.filter(r=>r.outcome==='PUSH').length,
    units,roi,approximateEventCluster95PercentInterval:se===null?null:[roi-1.96*se,roi+1.96*se],
    brier:mean(settled.map(r=>r.brier).filter(finite))};
}
export function gradeStrategyTrials(captures,results,at) {
  const first=new Map(),resultMap=new Map(list(results).filter(r=>Number.isFinite(time(r.verifiedAt))&&time(r.verifiedAt)<=time(at)).map(r=>[[r.eventId,r.startTime].join('|'),r]));
  for(const c of [...captures].filter(c=>Number.isFinite(time(c.collectedAt))&&time(c.collectedAt)<=time(at)).sort((a,b)=>time(a.collectedAt)-time(b.collectedAt))) {
    for(const t of list(c.strategyTrials)) {
      if(t.schema!==1||t.authority!=='RESEARCH_ONLY'||!t.trialId||!t.ruleFingerprint||!adaptiveResearchActive({ts:t.observedAt})||
        time(t.observedAt)!==time(c.collectedAt)||!validQuote({...t,observedAt:t.quoteObservedAt},t.observedAt,t.feedGeneratedAt)||
        list(t.recordIds).some(id=>!list(c.records).some(r=>r.recordId===id&&sameEvent(r,t)&&time(r.observedAt)<=time(t.observedAt)))||first.has(t.trialId))continue;
      first.set(t.trialId,t);
    }
  }
  const rows=[...first.values()].map(t=>({...t,...scoreTrial(t,resultMap.get([t.eventId,t.startTime].join('|')))}));
  const groups=new Map();
  for(const row of rows){const key=[row.methodId,row.methodVersion,row.ruleFingerprint,row.source,row.sport,row.marketDetail].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  return {schema:1,asOf:at,effectiveFrom:ADAPTIVE_RESEARCH_FROM,decisionAuthority:false,
    byMethod:[...groups.values()].map(group=>{const r=group[0],latestEvents=[...new Set([...group].sort((a,b)=>time(b.startTime)-time(a.startTime)).map(r=>[r.eventId,r.startTime].join('|')))].slice(0,30),recent=group.filter(r=>latestEvents.includes([r.eventId,r.startTime].join('|')));
      return {methodId:r.methodId,version:r.methodVersion,ruleFingerprint:r.ruleFingerprint,source:r.source,sport:r.sport,marketDetail:r.marketDetail,
        all:summarizeTrials(group),recent:summarizeTrials(recent),
        ...(r.methodId==='forecast_price'?{comparisons:{pinnacleSupports:summarizeTrials(group.filter(r=>r.checks.pinnacleDirection==='FAVORABLE')),
          pinnacleOpposes:summarizeTrials(group.filter(r=>r.checks.pinnacleDirection==='UNFAVORABLE')),
          pinnacleUnavailable:summarizeTrials(group.filter(r=>r.checks.pinnacleDirection==='UNAVAILABLE')),
          twoFamiliesSupport:summarizeTrials(group.filter(r=>r.checks.supportingFamilies>=2))}}:{})};}),rows,
    interpretation:'First actually captured entry per versioned rule, source family, exact side/line and book. Results can inform research and revisions. Recent/all and comparison subsets overlap; repeated books and opposing methods are correlated.',
    limitation:'Hypothetical one-unit risk at frozen observed prices; not cash results. Approximate intervals are descriptive and uncorrected for multiple experiments. No automatic fitted weight, fair or stake follows.'};
}
