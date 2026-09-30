// League observations only. No fair, status, stake or confirmation is invented.
const list=x=>Array.isArray(x)?x:[];
const ms=x=>Date.parse(x||'');
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const mlbScheduleUrl=day=>`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${day}&hydrate=probablePitcher,lineups`;
export function parseOfficialMlb(schedule,event,observedAt,url){
  if(!Number.isFinite(ms(observedAt))||!Number.isFinite(ms(event.startTime)))return {state:'INVALID_OBSERVATION_TIME',facts:[]};
  const games=list(schedule.dates).flatMap(d=>list(d.games)).filter(g=>
    ms(g.gameDate)===ms(event.startTime)&&['away','home'].every(side=>norm(g.teams?.[side]?.team?.name)===norm(event[side])));
  if(games.length!==1)return {state:games.length?'AMBIGUOUS_EVENT':'NO_EXACT_EVENT',facts:[]};
  const game=games[0];
  if(ms(observedAt)>=ms(event.startTime)||game.status?.abstractGameState!=='Preview')return {state:'EVENT_STARTED_OR_NOT_PREGAME',facts:[]};
  const probablePitchers={},lineups={},unresolved=[];
  for(const side of ['away','home']){
    const pitcher=game.teams?.[side]?.probablePitcher;
    probablePitchers[side]=pitcher?.id&&pitcher?.fullName?{id:String(pitcher.id),name:pitcher.fullName,status:'OFFICIAL_PROBABLE'}:null;
    lineups[side]=list(game.lineups?.[side+'Players']).map(p=>({id:String(p.id),name:p.fullName,position:p.primaryPosition?.abbreviation||null}));
    if(!probablePitchers[side])unresolved.push(`${side.toUpperCase()}_PROBABLE_PITCHER_NOT_PUBLISHED`);
    if(lineups[side].length!==9||new Set(lineups[side].map(p=>p.id)).size!==9||lineups[side].some(p=>!p.name||p.id==='undefined'))unresolved.push(`${side.toUpperCase()}_FINAL_LINEUP_NOT_PUBLISHED`);
  }
  return {state:'COLLECTED',facts:[{...event,sourceId:'mlb_official',sourceKind:'OFFICIAL',url,observedAt,
    kind:'OFFICIAL_PERSONNEL',requiresCurrentApplicabilityReview:true,
    details:{gamePk:String(game.gamePk),probablePitchers,lineups,unresolved,
      limitation:'Official probable pitchers and published lineup entries; probable does not mean confirmed. Injuries, bullpen use and later changes require their own review.'}}]};
}
