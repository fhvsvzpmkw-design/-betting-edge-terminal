#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';
import {selectCompletedResearchReview} from './graham-research-review.mjs';
import {synchronizeGrahamFairBoard} from './graham-fair-decomposition.mjs';

export const baselineComplete = status => /^(TUESDAY|CURRENT)_BASELINE_COMPLETE(?:_|$)/.test(String(status));
const fail = code => { throw Error('GRAHAM_BASELINE_RECOVERY:' + code); };
const blob = bytes => createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const list = value => Array.isArray(value) ? value : [];

// A verified full catch-up can establish the initial current baseline without
// pretending the missed Tuesday run completed or supplying missing weekly inputs.
export function recoverBaseline({active, board, ledger, events, power, policy, effectiveAt, ledgerBlobSha, powerBlobSha}) {
  if (baselineComplete(board.baselineStatus)) return {board:structuredClone(board), changed:false};
  if (board.baselineStatus !== 'PENDING_TUESDAY_GRAHAM_BASELINE' || board.season !== active.season || board.week !== active.week) fail('PENDING_ACTIVE_BASELINE_REQUIRED');
  if (![ledgerBlobSha,powerBlobSha].every(sha => /^[0-9a-f]{40}$/.test(sha || ''))) fail('SOURCE_BINDING_REQUIRED');
  const review = selectCompletedResearchReview({active, ledger, events});
  if (!review) fail('VERIFIED_RESEARCH_REVIEW_REQUIRED');
  const sweep = ledger.sweeps.find(item => item.runEventId === review.runEventId);
  if (events.find(event=>event.runEventId===review.runEventId)?.completionReceipt?.ledgerBlobSha !== ledgerBlobSha) fail('VERIFIED_LEDGER_BYTES_REQUIRED');
  const summary = sweep.summary;
  const gameKeys = list(board.games).map(game => game.gameKey);
  const teamKeys = list(board.games).flatMap(game => [game.away,game.home]);
  const sameSet = (left,right) => left.length === right.length && new Set(left).size === left.length && left.every(key => right.includes(key));
  if (!gameKeys.length || !sameSet(list(sweep.matchupChanges).map(game => game.gameKey),gameKeys)
    || !sameSet(list(sweep.teamFindings).map(team => team.team),teamKeys)
    || summary.teamsReviewed !== teamKeys.length || summary.gamesReviewed !== gameKeys.length
    || summary.marketViewed !== false || !Array.isArray(summary.unresolvedCoverageGaps) || summary.unresolvedCoverageGaps.length
    || list(sweep.teamFindings).some(team => team.marketViewed !== false || !list(team.sourceRefs).length)
    || list(sweep.matchupChanges).some(game => game.marketViewed !== false)) fail('FULL_EXACT_REVIEW_COVERAGE_REQUIRED');
  if (review.taskKey !== 'TUESDAY_BASELINE' && (summary.missedDayCatchUp !== true
    || Date.parse(summary.coverageStart) !== Date.parse(active.manifest.weekActivatedAt)
    || Date.parse(summary.coverageEnd) !== Date.parse(review.completedAt))) fail('ACTIVATION_TO_CURRENT_CATCH_UP_REQUIRED');
  if (!Number.isFinite(Date.parse(effectiveAt)) || Date.parse(effectiveAt) < Math.max(Date.parse(review.completedAt),Date.parse(board.updatedAt))) fail('APPLICATION_TIME_INVALID');
  const receipt = power.weekly90_10;
  if (power.season !== active.season || receipt?.sourceWeek !== active.week - 1 || receipt?.targetWeek !== active.week
    || !['COMPLETE','PARTIAL_BLOCKED'].includes(receipt.state) || receipt.marketViewed !== false) fail('CURRENT_WEEKLY_RECEIPT_REQUIRED');
  const ratings = new Map(power.teams.map(team => [team.abbr,team.currentRating]));
  const blocked = new Set(list(receipt.blockedGames).flatMap(game => [game.away,game.home]));
  const result = structuredClone(board);
  for (const game of result.games) {
    const away = ratings.get(game.away), home = ratings.get(game.home);
    if (![away,home].every(Number.isFinite) || game.ratingCarryForward?.awayRating !== away
      || game.ratingCarryForward?.homeRating !== home || Math.abs(game.neutralBaseHome - Number((away-home).toFixed(3))) > 1e-9) fail('CURRENT_CARRIED_RATING_MISMATCH:' + game.gameKey);
    const change = sweep.matchupChanges.find(item => item.gameKey === game.gameKey);
    if (change.currentExactFairHome !== game.grahamExactFairHome || change.currentDisplayedFairHome !== game.grahamFairHome) fail('REVIEWED_FAIR_CHANGED:' + game.gameKey);
    game.weeklyRatingInput = {state:receipt.state,sourceWeek:receipt.sourceWeek,targetWeek:receipt.targetWeek,
      awayCurrentRating:away,homeCurrentRating:home,awayUpdateState:blocked.has(game.away)?'PRESERVED_BLOCKED':'UPDATED',
      homeUpdateState:blocked.has(game.home)?'PRESERVED_BLOCKED':'UPDATED',blockedTeams:[game.away,game.home].filter(team=>blocked.has(team)),
      sourceBlobSha:powerBlobSha,appliedToFair:true,applicationStatus:'CARRIED_BASE_VERIFIED',marketViewed:false};
    const unresolved = list(game.personnelUnresolvedCases).length || list(game.personnelBlockedGroups).length || String(game.qbPerformanceStatus).startsWith('FAIL_CLOSED');
    game.numberStatus = receipt.state === 'PARTIAL_BLOCKED' ? 'READY_PARTIAL_BLOCKED_WEEKLY_RATING_INPUT'
      : unresolved ? 'READY_WITH_UNRESOLVED_PERSONNEL_OR_QB_INPUTS' : list(game.personnelEstimateCases).length ? 'READY_WITH_PERSONNEL_MODEL_ESTIMATES' : 'READY';
    game.informationStatus = 'VERIFIED_CURRENT_BASELINE_RECOVERED';
    game.grahamAsOf = review.completedAt;
    game.sourceRefs = [...new Set([...list(game.sourceRefs),active.paths.researchLedger])];
  }
  // This verifies existing arithmetic; the recovery itself changes no fair.
  synchronizeGrahamFairBoard(result,{write:false,policy});
  result.baselineStatus = 'CURRENT_BASELINE_COMPLETE' + (receipt.state === 'PARTIAL_BLOCKED' ? '_WITH_PARTIAL_BLOCKED_WEEKLY_90_10' : '');
  result.state = receipt.state === 'PARTIAL_BLOCKED' ? 'INFORMATION_REVIEW_CURRENT_FAIR_PARTIAL_BLOCKED'
    : result.games.some(game => game.numberStatus === 'READY_WITH_UNRESOLVED_PERSONNEL_OR_QB_INPUTS') ? 'INFORMATION_REVIEW_CURRENT_FAIR_WITH_UNRESOLVED_OVERLAYS' : 'INFORMATION_REVIEW_CURRENT_FAIR';
  result.updatedAt = effectiveAt;
  result.lastResearchAt = review.completedAt;
  result.baselineRecovery = {schema:1,state:'APPLIED',effectiveAt,runEventId:review.runEventId,sourceTaskKey:review.taskKey,
    researchCompletedAt:review.completedAt,ledgerBlobSha,powerBlobSha,teamsReviewed:teamKeys.length,gamesReviewed:gameKeys.length,
    originalBaselineStatus:board.baselineStatus,originalTuesdayRunPreserved:true,numericMoves:0,marketViewed:false,
    limitation:'Current baseline recovered from a verified full review. Missing historical weekly inputs and unresolved overlays retain their separate limitations.'};
  return {board:result,changed:true};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(arg => arg !== '--write')) fail('USAGE: node tools/graham-baseline-recovery.mjs [--write]');
  const active = resolveGrahamActiveWeek();
  const read = relative => JSON.parse(fs.readFileSync(relative,'utf8'));
  const boardBytes = fs.readFileSync(active.paths.currentNumbers), ledgerBytes = fs.readFileSync(active.paths.researchLedger);
  const powerPath = 'data/walters/nfl-power-ratings-ledger.json', powerBytes = fs.readFileSync(powerPath);
  const directory = active.paths.researchLedger.replace(/-research-ledger\.json$/,'-research-runtime');
  const events = fs.readdirSync(directory).filter(name => name.endsWith('.json')).map(name => read(path.join(directory,name)));
  const result = recoverBaseline({active,board:JSON.parse(boardBytes),ledger:JSON.parse(ledgerBytes),events,power:JSON.parse(powerBytes),
    policy:read('data/walters/nfl/graham-fair-decomposition-policy-v1.json'),effectiveAt:new Date().toISOString(),ledgerBlobSha:blob(ledgerBytes),powerBlobSha:blob(powerBytes)});
  if (result.changed && process.argv.includes('--write')) {
    if (!boardBytes.equals(fs.readFileSync(active.paths.currentNumbers)) || !ledgerBytes.equals(fs.readFileSync(active.paths.researchLedger))
      || !powerBytes.equals(fs.readFileSync(powerPath)) || JSON.stringify(resolveGrahamActiveWeek().manifest) !== JSON.stringify(active.manifest)) fail('INPUT_CHANGED_DURING_RECOVERY');
    fs.writeFileSync(active.paths.currentNumbers,JSON.stringify(result.board,null,2)+'\n');
  }
  console.log(JSON.stringify({state:result.changed?(process.argv.includes('--write')?'APPLIED':'PREVIEW'):'UNCHANGED',baselineStatus:result.board.baselineStatus,recovery:result.board.baselineRecovery || null}));
}
