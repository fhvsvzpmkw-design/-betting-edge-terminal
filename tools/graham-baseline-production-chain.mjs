import {roundHalf} from './graham-fair-decomposition.mjs';

const list=value=>Array.isArray(value)?value:[];
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const fail=code=>{throw Error('GRAHAM_BASELINE_RECOVERY:PRODUCTION_FOLLOWUP_'+code);};
const rounded=value=>Number(value.toFixed(3));
const finite=Number.isFinite;
const kinds={
  PERSONNEL_PRODUCTION_BATCH:{productionId:'walters-personnel-production-v1',ids:'processedBatchIds',meta:'personnelProduction',eventProduction:'productionId',gameProduction:'personnelProductionId',gameTime:'personnelLastAppliedAt',scope:'Governed Walters personnel production batch '},
  MATCHUP_EXPANSION_PRODUCTION_BATCH:{productionId:'walters-nfl-matchup-production-v1',ids:'processedMatchupBatchIds',meta:'matchupExpansionProduction',eventProduction:'matchupProductionId',gameProduction:'matchupExpansionProductionId',gameTime:'matchupExpansionLastAppliedAt',scope:'Scoped M4 value-invariant committee production batch '},
};

// Replay only the published arithmetic endpoints of existing production
// writers. This does not revalue a player, invent a source, or write a fair.
export function verifyBaselineProductionChain({active,board,reviewSweep,followups,personnelLedger,productionStaging={}}){
  const fairs=new Map(list(reviewSweep.matchupChanges).map(change=>[change.gameKey,{exact:change.currentExactFairHome,display:change.currentDisplayedFairHome}]));
  const proofs=[],seen=new Set(),latestByKind=new Map(),latestByGame=new Map();
  if(followups.length&&(!personnelLedger||personnelLedger.season!==active.season||personnelLedger.week!==active.week||personnelLedger.marketViewed!==false))fail('PERSONNEL_LEDGER_BINDING');
  for(const sweep of followups){
    const kind=kinds[sweep.type];
    if(!kind||sweep.summary?.productionId!==kind.productionId||sweep.summary?.marketViewed!==false||list(sweep.ratingChanges).length||sweep.summary?.carriedRatingMoves!==0
      ||sweep.type==='MATCHUP_EXPANSION_PRODUCTION_BATCH'&&sweep.summary.nonzeroOpponentMatchupIncrements!==0)fail('UNSUPPORTED_SWEEP');
    const ids=list(personnelLedger[kind.ids]).filter(id=>typeof id==='string'&&sweep.scope?.startsWith(kind.scope+id+'.'));
    if(ids.length!==1||seen.has(ids[0]))fail('UNIQUE_BATCH_REQUIRED');
    const batchId=ids[0];seen.add(batchId);
    const events=list(personnelLedger.events).filter(event=>event.batchId===batchId);
    if(!events.length||events.length!==sweep.summary.newEventsRecorded||new Set(events.map(e=>e.personnelEventId)).size!==events.length
      ||events.some(event=>!event.personnelEventId||event.marketViewed!==false||event[kind.eventProduction]!==sweep.summary.productionId
        ||event.effectiveAt!==sweep.completedAt||!list(event.sourceRefs).length))fail('EVENT_PROVENANCE');
    if(list(sweep.teamFindings).length!==events.length||list(sweep.teamFindings).some(finding=>{
      const matches=events.filter(event=>event.team===finding.team&&event.player===finding.player);
      return matches.length!==1||['availabilityStatus','resolutionStatus','valueStatus','reason','sourceRefs'].some(key=>!same(matches[0][key],finding[key]));
    }))fail('EVENT_FINDINGS_MISMATCH');
    const changes=list(sweep.matchupChanges);
    if(changes.length!==sweep.summary.gamesRecomputed||new Set(changes.map(c=>c.gameKey)).size!==changes.length)fail('GAME_INVENTORY');
    if(new Set(events.map(e=>e.gameKey)).size!==changes.length||events.some(e=>!changes.some(c=>c.gameKey===e.gameKey)))fail('EVENT_GAME_INVENTORY');
    for(const change of changes){
      const prior=fairs.get(change.gameKey),game=list(board.games).find(g=>g.gameKey===change.gameKey);
      if(!prior||!game||prior.display!==change.priorPublishedFairHome||!finite(change.priorPersonnelOverlay)||!finite(change.newPersonnelOverlay))fail('PRIOR_FAIR_BINDING');
      if(prior.exact===null&&prior.display===null){
        if(change.baselineExactFairHome!==null||change.newExactFairHome!==null||change.newPublishedFairHome!==null)fail('WITHHELD_FAIR_MUTATION');
      }else if(![prior.exact,change.baselineExactFairHome,change.newExactFairHome,change.newPublishedFairHome].every(finite)
        ||rounded(change.baselineExactFairHome+change.priorPersonnelOverlay)!==prior.exact
        ||rounded(change.baselineExactFairHome+change.newPersonnelOverlay)!==change.newExactFairHome
        ||roundHalf(change.newExactFairHome)!==change.newPublishedFairHome)fail('ARITHMETIC');
      fairs.set(change.gameKey,{exact:change.newExactFairHome,display:change.newPublishedFairHome});
      latestByGame.set(change.gameKey,{change,sweep,kind});
    }
    proofs.push({batchId,type:sweep.type,productionId:sweep.summary.productionId,completedAt:sweep.completedAt,
      personnelEventIds:events.map(e=>e.personnelEventId),gameKeys:changes.map(c=>c.gameKey)});
    latestByKind.set(sweep.type,{sweep,kind,batchId,events});
  }
  for(const {sweep,kind,batchId,events}of latestByKind.values()){
    const meta=board[kind.meta],staging=productionStaging[sweep.type];
    if(meta?.marketViewed!==false||meta.productionId!==sweep.summary.productionId||meta.lastBatchId!==batchId||meta.lastAppliedAt!==sweep.completedAt)fail('BOARD_PRODUCTION_BINDING');
    if(!staging||!['READY','APPLIED'].includes(staging.state)||staging.marketViewed!==false||staging.batchId!==batchId||staging.season!==active.season||staging.week!==active.week
      ||staging.effectiveAt!==sweep.completedAt||list(staging.cases).length!==events.length
      ||list(staging.cases).some(input=>{const event=events.find(e=>e.personnelEventId===input.personnelEventId);return !event||Object.entries(input).some(([key,value])=>!same(event[key],value));}))fail('STAGING_BINDING');
  }
  for(const game of board.games){
    const expected=fairs.get(game.gameKey);
    if(!expected||expected.exact!==game.grahamExactFairHome||expected.display!==game.grahamFairHome)fail('CURRENT_FAIR_DRIFT:'+game.gameKey);
    const last=latestByGame.get(game.gameKey);
    if(last&&(game.personnelOverlayPointsToHomeSpread!==last.change.newPersonnelOverlay||game.personnelBaselineExactFairHome!==last.change.baselineExactFairHome
      ||game[last.kind.gameProduction]!==last.sweep.summary.productionId||game[last.kind.gameTime]!==last.sweep.completedAt))fail('CURRENT_COMPONENT_DRIFT:'+game.gameKey);
  }
  return {fairs,proofs,changedGameKeys:new Set(latestByGame.keys())};
}
