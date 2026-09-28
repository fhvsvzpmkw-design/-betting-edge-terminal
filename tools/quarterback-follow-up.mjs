// Current starter research is separate from confirmation and numerical authority.
export const QB_FOLLOW_UP_FROM = '2026-09-28T07:30:00-07:00';
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim() : '';
const time = value => Date.parse(value || '');
const qb = /\b(qb|quarterbacks?)\b/i;
const unresolved = /\b(unresolved|unconfirmed|uncertain|expected|projected|questionable|backup|replacement)\b/i;
const joined = values => values.flat(Infinity).filter(value => typeof value === 'string').join(' ');
const webUrl = value => {try {const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}};
const current = (value,report) => Number.isFinite(time(value)) && time(value)>=time(report.feedGeneratedAt) && time(value)<=time(report.ts);

/** Inspect recorded research only. Never infer a starter, confirm news or set a fair. */
export function inspectQuarterbackFollowUp({report={},selection={},receipt={}}={}) {
  const rec=receipt.decision || receipt.candidateDraft?.decision || {};
  const evidence=rec.personnelEvidence || receipt.evidence?.personnelEvidence || receipt.candidateDraft?.evidence?.personnelEvidence || {};
  const review=receipt.candidateAssessment?.personnel || {};
  const sport=String(selection.sport || rec.coreAssessment?.context?.sport || rec.sport || '').toUpperCase();
  const dependency=joined([evidence.dependencyTarget,evidence.dependencyRationale,evidence.unresolved,
    review.remainingUncertainty,review.rationale,rec.marketAssessment?.informationReview?.impact]);
  const remaining=joined([evidence.unresolved,review.remainingUncertainty]);
  const uncertain=qb.test(remaining) ||
    (evidence.personnelState==='STRONG PROJECTION' && qb.test(evidence.dependencyTarget||'')) ||
    (!text(remaining) && (['PARTIAL','UNKNOWN'].includes(evidence.personnelState) || unresolved.test(dependency)));
  const follow=evidence.quarterbackFollowUp;
  const required=time(report.ts)>=time(QB_FOLLOW_UP_FROM) && ['NFL','NCAAF','CFB','CFL','FOOTBALL'].includes(sport) &&
    qb.test(dependency) && (uncertain || Boolean(follow));
  if(!required)return {required:false,complete:true,missing:[]};
  const missing=[];
  const need=(condition,code)=>{if(!condition)missing.push(code);};
  const official=list(evidence.officialSources),fallback=list(evidence.fallbackSources);
  const sources=[...official,...fallback];
  const linked=list(follow?.sourceUrls).map(url=>sources.find(source=>source.url===url && webUrl(url) &&
    text(source.origin) && text(source.fact) && current(source.asOf,report))).filter(Boolean);
  const direct=linked.some(source=>fallback.includes(source)&&source.sourceType==='REPORTING'&&source.directReporting===true);
  // Explicit originating reporter/family prevents a syndicated story multiplying votes.
  const origins=new Set(linked.filter(source=>fallback.includes(source)).map(source=>text(source.independentOrigin)).filter(Boolean));
  const attempts=list(follow?.searchAttempts).filter(attempt=>text(attempt.query)&&current(attempt.checkedAt,report)&&text(attempt.result));
  const shortfall=text(follow?.sourceShortfall)&&attempts.length>0;
  need(follow&&current(follow.checkedAt,report),'QB_CURRENT_TARGETED_RESEARCH_REQUIRED');
  need(list(follow?.queries).some(query=>qb.test(query)||/\b(starter|starts?)\b/i.test(query)),'QB_TARGETED_QUERY_REQUIRED');
  need(linked.length>0,'QB_SOURCE_LINKED_FINDING_REQUIRED');
  need(official.some(source=>linked.includes(source)&&source.sourceType==='OFFICIAL'&&source.finalRecheck===true) ||
    (shortfall&&follow?.authoritativeSourceUnavailable===true),'QB_CURRENT_TEAM_CHECK_REQUIRED');
  const status=follow?.status;
  need(['CONFIRMED_STARTER','EXPECTED_STARTER','UNRESOLVED'].includes(status),'QB_RESEARCH_DISPOSITION_REQUIRED');
  if(status==='CONFIRMED_STARTER') {
    need(text(follow.playerName)&&linked.some(source=>source.sourceType==='OFFICIAL'&&source.confirmsStarter===true&&
      source.fact.toLowerCase().includes(follow.playerName.toLowerCase())),'QB_OFFICIAL_NAMED_STARTER_REQUIRED');
  } else if(status==='EXPECTED_STARTER') {
    need(text(follow.playerName)&&linked.some(source=>source.fact.toLowerCase().includes(follow.playerName.toLowerCase())),'QB_EXPECTED_STARTER_NAME_REQUIRED');
    need(direct||origins.size>=3||shortfall,'QB_CREDIBLE_STARTER_FOLLOW_UP_REQUIRED');
    need(text(follow.remainingUncertainty),'QB_EXPECTATION_LIMITATION_REQUIRED');
    need(evidence.personnelState!=='CONFIRMED','QB_EXPECTED_IS_NOT_CONFIRMED');
  } else {
    need(origins.size>=3||shortfall,'QB_CREDIBLE_STARTER_FOLLOW_UP_REQUIRED');
    need(text(follow?.remainingUncertainty),'QB_UNRESOLVED_FACT_REQUIRED');
  }
  return {required:true,complete:missing.length===0,missing:[...new Set(missing)],
    status:status||null,playerName:follow?.playerName||null,checkedAt:follow?.checkedAt||null,
    nextAction:'Check the current team report and targeted starter reporting now; record the named expected/confirmed starter or actual search attempts and remaining gap. Reassess model applicability separately. See docs/QUARTERBACK_FOLLOW_UP.md.'};
}
