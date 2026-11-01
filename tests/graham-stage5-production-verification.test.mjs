#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {sharedVenueFairWithheld} from '../tools/graham-fair-decomposition.mjs';
import {weeklyCompletion} from '../tools/graham-weekly-completion.mjs';
import {
  grahamWeekPaths,
  resolveGrahamActiveWeek
} from '../tools/graham-active-week.mjs';
import {
  loadGrahamScheduleAuthority,
  synchronizeGrahamResearchLedgerScheduleMetadata,
  synchronizeGrahamScheduleMetadata,
  validateGrahamBoardScheduleMetadata,
  validateGrahamResearchLedgerScheduleMetadata
} from '../tools/graham-schedule-authority.mjs';

const ROOT = process.cwd();
const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const round = (n, d = 3) => Number(Number(n).toFixed(d));
const close = (a, b, tol = 0.0005) => Math.abs(Number(a) - Number(b)) <= tol;

function run(relScript, args = []) {
  const result = spawnSync(process.execPath, [path.join(ROOT, relScript), ...args], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  const combined = `${result.stdout || ''}${result.stderr || ''}`;
  assert.equal(result.status, 0, `${relScript} failed with ${result.status}. Output:\n${combined}`);
  return combined;
}

function writeJson(root, rel, value) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const policy = readJson('data/walters/nfl/graham-stage5-production-verification-policy-v1.json');
assert.equal(policy.policyId, 'graham-stage5-production-verification-v1');
assert.equal(policy.state, 'ACTIVE_VERIFICATION');
assert.equal(policy.liveMutationAllowed, false);
assert.equal(policy.marketViewed, false);

const stage4 = readJson('data/walters/nfl/graham-stage4-regression-current.json');
assert.equal(stage4.state, 'PASS', 'Stage 5 requires a passing Stage 4 receipt');
assert.equal(stage4.cases?.length, 6, 'Stage 4 receipt must preserve six passing cases');
assert.equal(stage4.cases.every(c => c.result === 'PASS'), true, 'Every Stage 4 case must pass');

const activeBeforeRaw = fs.readFileSync(path.join(ROOT, 'data/walters/nfl/active-week.json'), 'utf8');
const active = resolveGrahamActiveWeek();
assert.equal(active.season, 2026, 'Stage 5 production verification is scoped to 2026');

// 1) Verify production integrity for the manifest's actual active slate.
const numbers = readJson(active.paths.currentNumbers);
const research = readJson(active.paths.researchLedger);
const market = readJson(active.paths.dailyMarketLedger);
const h4 = readJson('data/walters/nfl/home-field/home-field-production-current.json');
const ratings = readJson('data/walters/nfl-power-ratings-ledger.json');
const scheduleAuthority = loadGrahamScheduleAuthority();
assert.ok(numbers.scheduleSource?.factsPath, 'Active board must bind its verified schedule facts');
const scheduleFacts = readJson(numbers.scheduleSource.factsPath);
const protectedPaths=['data/walters/nfl/active-week.json',active.paths.currentNumbers,active.paths.researchLedger,active.paths.dailyMarketLedger,'data/walters/nfl-power-ratings-ledger.json'];
const protectedBytes=new Map(protectedPaths.map(p=>[p,fs.readFileSync(path.join(ROOT,p),'utf8')]));

function verifySlateIdentity(board,facts){
  assert.equal(facts.schema,1);assert.equal(facts.season,active.season);assert.equal(facts.week,active.week);
  assert.equal(facts.marketViewed,false);assert.ok(Number.isFinite(Date.parse(facts.verifiedAt)));
  assert.ok(Array.isArray(facts.games)&&facts.games.length>0,'Verified schedule must contain the actual slate');
  assert.equal(board.games.length,facts.games.length,'Active board must contain the complete verified slate');
  assert.equal(new Set(board.games.map(g=>g.gameKey)).size,board.games.length,'Active game identities must be unique');
  assert.equal(new Set(facts.games.map(g=>g.gameKey)).size,facts.games.length,'Schedule game identities must be unique');
  const teams=new Set();
  for(const game of board.games){
    const scheduled=facts.games.find(g=>g.gameKey===game.gameKey);
    assert.ok(scheduled,`${game.gameKey} is absent from verified schedule`);
    assert.equal(game.gameKey,`${active.season}-W${String(active.week).padStart(2,'0')}-${game.away}-${game.home}`);
    assert.equal(game.away,scheduled.away);assert.equal(game.home,scheduled.home);
    assert.notEqual(game.away,game.home);
    assert.ok(Number.isFinite(Date.parse(game.startTimePacific)),`${game.gameKey} kickoff missing`);
    assert.equal(Date.parse(game.startTimePacific),Date.parse(scheduled.startTimePacific),`${game.gameKey} kickoff differs from verified schedule`);
    for(const team of [game.away,game.home]){assert.ok(ratings.teams.some(t=>t.abbr===team),`Unknown active team ${team}`);assert.equal(teams.has(team),false,`Repeated active team ${team}`);teams.add(team);}
  }
}

assert.equal(numbers.season, active.season);
assert.equal(numbers.week, active.week);
assert.equal(research.season, active.season);
assert.equal(research.week, active.week);
assert.equal(market.season, active.season);
assert.equal(market.week, active.week);
verifySlateIdentity(numbers,scheduleFacts);
for(const mutate of [
  b=>b.games.pop(),
  b=>{b.games[0].away='UNKNOWN';},
  b=>{b.games[0].startTimePacific='2000-01-01T00:00:00Z';},
  b=>{b.games[1].gameKey=b.games[0].gameKey;},
]){const invalid=structuredClone(numbers);mutate(invalid);assert.throws(()=>verifySlateIdentity(invalid,scheduleFacts),'Corrupt active slate must fail production verification');}
assert.equal(h4.state, 'OPERATIONAL_SCOPED');
assert.equal(h4.productionAuthority, true);
assert.equal(h4.marketViewed, false);
assert.equal(ratings.teams.length, 32, 'Graham power-rating ledger must carry all 32 teams');
assert.equal(new Set(ratings.teams.map(t => t.abbr)).size, 32, 'Power-rating team identities must be unique');
assert.equal(ratings.teams.every(t => Number.isFinite(t.currentRating)), true, 'All current team ratings must be numeric');

const fairReadback = run('tools/graham-fair-decomposition.mjs', ['--path', active.paths.currentNumbers]);
assert.match(fairReadback, /READBACK VERIFIED/);
const boardScheduleReadback = run('tools/graham-schedule-authority.mjs', ['--path', active.paths.currentNumbers]);
const ledgerScheduleReadback = run('tools/graham-schedule-authority.mjs', ['--path', active.paths.researchLedger]);
assert.match(boardScheduleReadback, /CURRENT_NUMBERS/);
assert.match(ledgerScheduleReadback, /RESEARCH_LEDGER/);

const domesticHfa = Number(h4.productionScope.domesticLeagueBaseline.pointsToHomeSpread);
const neutralClasses = new Set(h4.productionScope.neutralZeroBase.eligibleVenueClasses || []);
let domesticGames = 0;
let neutralGames = 0;
let personnelOverlayGames = 0;
let matchupOverlayGames = 0;
let withheldGames = 0;
const frozenStartedGames = [];
const verificationTime = Date.now();
for (const game of numbers.games) {
  assert.ok(game.gameKey);
  const withheld=sharedVenueFairWithheld(game);
  if(withheld){
    withheldGames+=1;
    assert.equal(game.fairDecomposition?.arithmeticVerified,false);
    assert.equal(game.fairDecomposition?.failClosedCode,'FAIL_CLOSED_H4_SHARED_VENUE_METHOD_REQUIRED');
    assert.match(game.researchSummary||'',/^Fail closed fair decomposition:/);
  }else{
    assert.equal(Number.isFinite(game.grahamExactFairHome), true, `${game.gameKey} exact fair missing`);
    assert.equal(Number.isFinite(game.grahamFairHome), true, `${game.gameKey} display fair missing`);
    assert.equal(game.fairDecomposition?.arithmeticVerified, true, `${game.gameKey} arithmetic not verified`);
    assert.match(game.researchSummary || '', /^Governed fair decomposition:/, `${game.gameKey} generated explanation missing`);
  }
  assert.equal(game.fairDecomposition?.exactFairHome, game.grahamExactFairHome, `${game.gameKey} exact decomposition drift`);
  assert.equal(game.fairDecomposition?.displayedFairHome, game.grahamFairHome, `${game.gameKey} display decomposition drift`);

  assert.ok(Number.isFinite(game.ratingCarryForward?.awayRating)&&Number.isFinite(game.ratingCarryForward?.homeRating),`${game.gameKey} carried ratings missing`);
  assert.equal(close(game.neutralBaseHome,game.ratingCarryForward.awayRating-game.ratingCarryForward.homeRating,1e-8),true,`${game.gameKey} frozen neutral base drift`);
  if(Date.parse(game.startTimePacific)<=verificationTime){
    frozenStartedGames.push(game.gameKey);
    assert.ok(Number.isFinite(Date.parse(game.grahamAsOf))&&Date.parse(game.grahamAsOf)<=Date.parse(game.startTimePacific),`${game.gameKey} issued prediction timestamp is after kickoff`);
  }else{
    assert.equal(game.ratingCarryForward.awayRating,ratings.teams.find(t=>t.abbr===game.away).currentRating,`${game.gameKey} away current base stale`);
    assert.equal(game.ratingCarryForward.homeRating,ratings.teams.find(t=>t.abbr===game.home).currentRating,`${game.gameKey} home current base stale`);
  }

  const venueAdjustment = (game.adjustments || []).find(a => ['HOME_FIELD', 'VENUE'].includes(a.type));
  const venueClass = game.homeFieldVenueClass || venueAdjustment?.venueClass;
  assert.ok(venueClass, `${game.gameKey} venue class missing`);
  if(withheld){
    assert.equal(venueClass,'SHARED_VENUE_OR_METRO');
  }else if (venueClass === 'DOMESTIC_HOME') {
    domesticGames += 1;
    assert.equal(close(game.homeFieldPointsToHomeSpread, domesticHfa), true, `${game.gameKey} domestic HFA mismatch`);
  } else if (neutralClasses.has(venueClass)) {
    neutralGames += 1;
    assert.equal(close(game.homeFieldPointsToHomeSpread, 0), true, `${game.gameKey} neutral HFA must be zero`);
  } else {
    throw new Error(`${game.gameKey} unsupported production venue class ${venueClass}`);
  }

  const personnelSum = round((game.adjustments || [])
    .filter(a => a.type === 'PERSONNEL_CALIBRATED_PRODUCTION')
    .reduce((s, a) => s + Number(a.pointsToHomeSpread || 0), 0));
  const storedPersonnel = round(Number(game.personnelOverlayPointsToHomeSpread || 0));
  assert.equal(close(personnelSum, storedPersonnel), true, `${game.gameKey} personnel overlay mismatch`);
  if (Math.abs(storedPersonnel) > 0.0005) personnelOverlayGames += 1;

  const matchupSum = round((game.adjustments || [])
    .filter(a => a.type === 'MATCHUP_CALIBRATED_PRODUCTION')
    .reduce((s, a) => s + Number(a.pointsToHomeSpread || 0), 0));
  const storedMatchup = round(Number(game.matchupOverlayPointsToHomeSpread || 0));
  assert.equal(close(matchupSum, storedMatchup), true, `${game.gameKey} matchup overlay mismatch`);
  if (Math.abs(storedMatchup) > 0.0005) matchupOverlayGames += 1;
}
assert.equal(domesticGames + neutralGames + withheldGames, numbers.games.length, 'Every active venue must resolve or remain explicitly withheld');
assert.equal(numbers.rules?.marketIsolation?.includes('before viewing'), true, 'Active board market-isolation rule missing');
assert.equal(research.policy?.marketIsolation?.includes('before contemporaneous Pinnacle comparison'), true, 'Research ledger market-isolation rule missing');

// 2) Verify the four actual live research tasks against repository schedule/completion authority.
const taskAttestation = readJson('data/walters/nfl/graham-stage5-live-task-attestation.json');
const completionPolicy = readJson('data/walters/nfl/graham-research-completion-policy-v1.json');
assert.equal(taskAttestation.source, 'CHATGPT_SCHEDULED_TASKS_LIVE_READBACK');
assert.equal(taskAttestation.executionAuthority, scheduleAuthority.executionAuthority);
assert.equal(taskAttestation.timezone, scheduleAuthority.timezone);
assert.equal(taskAttestation.timingMode, scheduleAuthority.timingMode);

const requiredTaskKeys = [...completionPolicy.appliesToTaskKeys].sort();
assert.deepEqual(taskAttestation.tasks.map(t => t.taskKey).sort(), requiredTaskKeys, 'Live task attestation must contain exactly the four Graham research tasks');
const authorityByKey = new Map(scheduleAuthority.tasks.map(t => [t.taskKey, t]));
const requiredMarkers = [
  'activeWeekAuthority',
  'waltersKnowledgeLibrary',
  'homeFieldH4',
  'personnelProduction',
  'matchupM4',
  'marketIsolation',
  'researchCompletionGate',
  'taskKeyBound'
];
for (const task of taskAttestation.tasks) {
  const expected = authorityByKey.get(task.taskKey);
  assert.ok(expected, `No repository schedule authority for ${task.taskKey}`);
  assert.equal(task.enabled, true, `${task.taskKey} is not enabled`);
  assert.equal(task.title, expected.title, `${task.taskKey} title mismatch`);
  assert.equal(task.rrule, expected.rrule, `${task.taskKey} RRULE mismatch`);
  for (const marker of requiredMarkers) assert.equal(task.promptMarkers?.[marker], true, `${task.taskKey} prompt marker missing: ${marker}`);
}

// 3) Dry-run the future-week rollover entirely in a temporary root.
const nextWeek = active.week + 1;
const liveActivePath = path.join(ROOT, 'data/walters/nfl/active-week.json');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graham-stage5-rollover-'));
try {
  const next = grahamWeekPaths(active.season, nextWeek, { root: tmp });
  const carriedRatings = ratings.teams.map(t => ({
    abbr: t.abbr,
    currentRating: t.currentRating,
    sourceWeek: active.week
  }));
  assert.equal(carriedRatings.length, 32);

  const simulatedBoard = {
    schema: 1,
    boardId: `SIMULATED-graham-${active.season}-week-${String(nextWeek).padStart(2, '0')}`,
    season: active.season,
    week: nextWeek,
    timezone: 'America/Vancouver',
    state: 'SIMULATED_BASELINE_PENDING',
    simulationOnly: true,
    carriedRatings,
    homeFieldProductionId: h4.productionId,
    games: []
  };
  synchronizeGrahamScheduleMetadata(simulatedBoard, scheduleAuthority);
  validateGrahamBoardScheduleMetadata(simulatedBoard, scheduleAuthority);

  const simulatedResearch = {
    schema: 1,
    ledgerId: `SIMULATED-graham-${active.season}-week-${String(nextWeek).padStart(2, '0')}-research`,
    season: active.season,
    week: nextWeek,
    timezone: 'America/Vancouver',
    state: 'SIMULATED_BASELINE_PENDING',
    simulationOnly: true,
    policy: { ...research.policy },
    sweeps: []
  };
  synchronizeGrahamResearchLedgerScheduleMetadata(simulatedResearch, scheduleAuthority);
  validateGrahamResearchLedgerScheduleMetadata(simulatedResearch, scheduleAuthority);

  const simulatedMarket = {
    schema: 1,
    ledgerId: `SIMULATED-graham-${active.season}-week-${String(nextWeek).padStart(2, '0')}-market`,
    season: active.season,
    week: nextWeek,
    timezone: 'America/Vancouver',
    state: 'SIMULATED_BASELINE_PENDING',
    simulationOnly: true,
    games: []
  };

  // Atomic rollover ordering: required files and research-event location exist before manifest activation.
  writeJson(tmp, next.relative.currentNumbers, simulatedBoard);
  writeJson(tmp, next.relative.researchLedger, simulatedResearch);
  writeJson(tmp, next.relative.dailyMarketLedger, simulatedMarket);
  fs.mkdirSync(next.absolute.researchEventsDir, { recursive: true });
  for (const key of ['currentNumbers', 'researchLedger', 'dailyMarketLedger']) {
    assert.equal(fs.existsSync(next.absolute[key]), true, `Simulated next-week ${key} missing before activation`);
    const j = JSON.parse(fs.readFileSync(next.absolute[key], 'utf8'));
    assert.equal(j.season, active.season);
    assert.equal(j.week, nextWeek);
  }
  assert.equal(fs.existsSync(next.absolute.researchEventsDir), true, 'Simulated research-events directory missing');

  const simulatedManifest = {
    ...active.manifest,
    week: nextWeek,
    weekActivatedAt: 'SIMULATED_STAGE5',
    lastVerifiedAt: 'SIMULATED_STAGE5',
    history: [
      ...(active.manifest.history || []),
      { season: active.season, week: nextWeek, activatedAt: 'SIMULATED_STAGE5', reason: 'STAGE5_DRY_RUN' }
    ]
  };
  writeJson(tmp, 'data/walters/nfl/active-week.json', simulatedManifest);
  const simulatedActive = resolveGrahamActiveWeek({ root: tmp });
  assert.equal(simulatedActive.season, active.season);
  assert.equal(simulatedActive.week, nextWeek);
  assert.equal(simulatedActive.paths.currentNumbers, next.relative.currentNumbers);
  assert.equal(simulatedActive.paths.researchLedger, next.relative.researchLedger);
  assert.equal(simulatedActive.paths.dailyMarketLedger, next.relative.dailyMarketLedger);

  const carriedReadback = JSON.parse(fs.readFileSync(next.absolute.currentNumbers, 'utf8')).carriedRatings;
  assert.deepEqual(carriedReadback, carriedRatings, 'All 32 current ratings must carry forward unchanged in the rollover dry-run');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const activeAfterRaw = fs.readFileSync(liveActivePath, 'utf8');
assert.equal(activeAfterRaw, activeBeforeRaw, 'Stage 5 rollover dry-run mutated live active-week.json');
const activeAfter = resolveGrahamActiveWeek();
assert.equal(activeAfter.season, active.season);
assert.equal(activeAfter.week, active.week);
for(const [relative,bytes]of protectedBytes)assert.equal(fs.readFileSync(path.join(ROOT,relative),'utf8'),bytes,`Verification mutated protected input ${relative}`);

// A valid calculator/deployment chain can faithfully preserve a provisional
// board. Report its football limitations rather than converting PASS into a
// claim that the weekly baseline, learning and availability are complete.
const completion=weeklyCompletion({active,board:numbers,power:ratings,staging:readJson('data/walters/nfl/carried-rating-audit-staging.json')});

const receipt = {
  schema: 1,
  policyId: policy.policyId,
  state: 'PASS',
  verificationScope: 'PRODUCTION_INTEGRITY_NOT_FOOTBALL_READINESS',
  testedCommit: process.env.GITHUB_SHA || null,
  testedAt: new Date().toISOString(),
  marketViewed: false,
  activeWeekPreserved: { season: active.season, week: active.week },
  checks: [
    {
      checkKey: 'ACTIVE_WEEK_PRODUCTION_READBACK',
      result: 'PASS',
      season:active.season,
      week:active.week,
      gamesVerified: numbers.games.length,
      exactAndDisplayedFairsVerified: numbers.games.length-withheldGames,
      withheldFairGames:withheldGames,
      explanationsVerified: numbers.games.length,
      frozenStartedGamesVerified:frozenStartedGames,
      domesticHomeGames: domesticGames,
      neutralGames,
      personnelOverlayGames,
      matchupOverlayGames,
      powerRatingsVerified: 32
    },
    {
      checkKey: 'FOUR_RESEARCH_TASKS',
      result: 'PASS',
      tasksVerified: requiredTaskKeys,
      attestationCapturedAt:taskAttestation.capturedAt,
      evidenceScope:'RECORDED_ATTESTATION_NOT_CURRENT_SCHEDULER_OR_RESEARCH_COMPLETION'
    },
    {
      checkKey: 'FUTURE_WEEK_ROLLOVER_DRY_RUN',
      result: 'PASS',
      simulatedFromWeek: active.week,
      simulatedToWeek: nextWeek,
      ratingsCarriedForward: 32,
      liveActiveWeekUnchanged: true
    }
  ],
  footballReadiness:{state:completion.state,baselineStatus:numbers.baselineStatus,
    components:completion.components,problems:completion.problems},
  fiveStagePlan: 'PRODUCTION_INTEGRITY_VERIFIED',
  nextGate: completion.state==='COMPLETE'?'NONE_PRODUCTION_INTEGRITY_VERIFIED':'COMPLETE_ACTIVE_WEEK_FOOTBALL_INPUTS'
};

const receiptIndex = process.argv.indexOf('--receipt-out');
if (receiptIndex >= 0) {
  const out = process.argv[receiptIndex + 1];
  if (!out) throw new Error('--receipt-out requires a path');
  fs.writeFileSync(path.resolve(ROOT, out), `${JSON.stringify(receipt, null, 2)}\n`);
}

console.log(`GRAHAM STAGE 5 PRODUCTION VERIFICATION: PASS // WEEK ${active.week} ${numbers.games.length} GAMES (${withheldGames} FAIR WITHHELD) // TASK ATTESTATION 4/4 // FOOTBALL INPUTS ${completion.state} // ROLLOVER DRY-RUN W${String(active.week).padStart(2, '0')}->W${String(nextWeek).padStart(2, '0')} // LIVE WEEK PRESERVED`);
