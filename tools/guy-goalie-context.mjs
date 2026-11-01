// Reuse ESPN's already-collected NHL scoreboard. Its structured starter status
// is source evidence, not a new goalie model or proof of MoneyPuck repricing.
const list=value=>Array.isArray(value)?value:[];
const time=value=>Date.parse(value||'');
const normalized=value=>String(value||'').toLowerCase().replace(/^la /,'los angeles ').replace(/[^a-z0-9]/g,'');
const lower=value=>String(value||'').toLowerCase();

export function parseEspnGoalieContext({competition,event,observedAt,url,sourceField='competitions[0]'}) {
  if(event?.sport!=='NHL'||!Number.isFinite(time(observedAt))||!Number.isFinite(time(event.startTime))
    ||time(observedAt)>=time(event.startTime)||time(competition?.date)!==time(event.startTime)
    ||competition?.status?.type?.state!=='pre'||!/^https:\/\//.test(url||''))return [];
  const competitors=list(competition.competitors);
  if(competitors.length!==2||!['home','away'].every(side=>{
    const matches=competitors.filter(team=>team.homeAway===side);
    return matches.length===1&&normalized(matches[0].team?.displayName)===normalized(event[side]);
  }))return [];
  const output=[];
  for(const [teamIndex,team]of competitors.entries()) {
    const side=team.homeAway,teamId=String(team.team?.id??team.id??'');
    const candidates=list(team.probables).map((row,index)=>({row,index})).filter(({row})=>{
      const athlete=row?.athlete,position=typeof athlete?.position==='string'?athlete.position:athlete?.position?.abbreviation;
      return row?.name==='probableStartingGoalie'&&position==='G'&&athlete?.id
        &&String(row.playerId??athlete.id)===String(athlete.id)
        &&(!athlete.team?.id||String(athlete.team.id)===teamId)
        &&typeof athlete.displayName==='string'&&athlete.displayName.trim();
    });
    // An absent field is not evidence that a previously named goalie withdrew.
    // Keep old observations with their own clocks; do not refresh missing data.
    if(!candidates.length)continue;
    const identities=new Set(candidates.map(({row})=>`${row.athlete.id}|${normalized(row.athlete.displayName)}`));
    const statuses=new Set(candidates.map(({row})=>`${lower(row.status?.type)}|${lower(row.status?.name)}`));
    const selected=candidates[0],raw=selected.row.status||{},type=lower(raw.type),name=lower(raw.name);
    const conflicting=identities.size!==1||statuses.size!==1;
    const confirmed=!conflicting&&type==='confirmed'&&(!name||name==='confirmed');
    const unavailable=['out','scratched','withdrawn','unavailable','injured'].some(status=>type===status||name===status);
    const inconsistent=type==='confirmed'&&name&&name!=='confirmed'||name==='confirmed'&&type&&type!=='confirmed';
    const status=conflicting||unavailable||inconsistent?'UNKNOWN':confirmed?'CONFIRMED':'PROJECTED';
    output.push({...event,kind:'STARTING_GOALIE',sourceId:'espn',sourceEventId:String(competition.id||''),url,observedAt,
      sourceField:`${sourceField}.competitors[${teamIndex}].probables${conflicting?'':`[${selected.index}]`}`,
      details:{team:event[side],side,name:status==='UNKNOWN'?null:selected.row.athlete.displayName.trim(),
        playerId:status==='UNKNOWN'?null:String(selected.row.athlete.id),status,
        confirmationBasis:confirmed?'ESPN_EXPLICIT_CONFIRMED_STATUS':status==='PROJECTED'?'ESPN_STRUCTURED_PROBABLE_ONLY':'SOURCE_RECHECK_REQUIRED',
        sourceStatus:{type:raw.type??null,name:raw.name??null},
        reason:conflicting?'Conflicting named starter observations.':unavailable?'The source-listed probable is marked unavailable.':inconsistent?'The source starter status is internally inconsistent.':
          confirmed?'ESPN explicitly marks this starting goalie confirmed.':'ESPN lists this goalie as a probable or expected starter; confirmation is not established.',
        forecastRepricedForGoalie:false},
      requiresCurrentApplicabilityReview:true,
      limitation:'Source-reported starting-goalie context. Later team news still needs review; this does not establish that MoneyPuck repriced its forecast for this goalie.'});
  }
  return output;
}

export function replaceEspnGoalieFacts(facts,event,incoming) {
  incoming=incoming.filter(fact=>!facts.some(old=>old.sourceId==='espn'&&old.kind==='STARTING_GOALIE'
    &&String(old.eventId)===String(event.eventId)&&time(old.startTime)===time(event.startTime)
    &&old.details?.side===fact.details.side&&time(old.observedAt)>time(fact.observedAt)));
  if(!incoming.length)return facts;
  const sides=new Set(incoming.map(fact=>fact.details.side));
  return [...facts.filter(fact=>!(fact.sourceId==='espn'&&fact.kind==='STARTING_GOALIE'
    &&String(fact.eventId)===String(event.eventId)&&time(fact.startTime)===time(event.startTime)
    &&sides.has(fact.details?.side))),...incoming];
}
