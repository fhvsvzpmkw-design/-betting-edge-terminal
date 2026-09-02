import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(TEST_PATH), "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

const contract = readJson("data/walters/nfl/qb-performance/stage3c-contract-v1.json");
const current = readJson("data/walters/nfl/qb-performance/stage3-current.json");
const model = readJson("data/walters/nfl/qb-performance/model/stage3c-model-v1.json");
const audit = readJson("data/walters/nfl/qb-performance/model/stage3c-holdout-audit-v1.json");
const candidates = readJson("data/walters/nfl/qb-performance/candidates/qb-candidates-2026-stage3c-v1.json");

test("Stage 3C preserves the untouched 2025 chronological holdout", () => {
  assert.deepEqual(contract.chronology.modelFitSeasonsForTuning, [2022, 2023]);
  assert.equal(contract.chronology.tuningSeason, 2024);
  assert.deepEqual(contract.chronology.finalFitSeasons, [2022, 2023, 2024]);
  assert.equal(contract.chronology.untouchedHoldoutSeason, 2025);
  assert.equal(contract.model.holdoutMayRefitModel, false);
});

test("Stage 3C remains non-operational", () => {
  assert.equal(contract.operational, false);
  assert.equal(contract.productionAuthority, false);
  assert.equal(current.operational, false);
  assert.equal(current.productionAuthority, false);
  assert.equal(current.grahamWritesAllowed, false);
  assert.equal(current.uncertaintyOverlayRetirementAllowed, false);
});

test("The selected configuration came from the pre-locked search space", () => {
  const selected = model.selectedConfiguration;
  assert.ok(contract.predictiveFeatures.longTermWindowCandidatesCompletedSeasons.includes(selected.longTermCompletedSeasons));
  assert.ok(contract.predictiveFeatures.shortTermWindowCandidatesQualifiedGames.includes(selected.shortTermQualifiedGames));
  assert.ok(contract.predictiveFeatures.featurePriorEquivalentDropbackCandidates.includes(selected.featurePriorEquivalentDropbacks));
  assert.ok(contract.model.ridgeAlphaCandidates.includes(selected.ridgeAlpha));
  assert.equal(model.configurationCountEvaluated, 135);
});

test("All twelve Walters long/short feature weights respect their locked direction", () => {
  assert.equal(model.featureNames.length, 12);
  assert.equal(Object.keys(model.weights).length, 12);
  assert.ok(Object.values(model.weights).every((weight) => weight >= 0));
  assert.equal(model.solver.deterministicRefit, true);
  assert.equal(model.solver.converged, true);
});

test("The 2025 holdout clears every pre-locked acceptance gate", () => {
  assert.equal(audit.status, "PASS");
  assert.ok(audit.checks.length >= 15);
  assert.ok(audit.checks.every((check) => check.pass === true));
  assert.ok(audit.holdoutMetrics.sampleCount >= contract.acceptance.minimumHoldoutSamples);
});

test("Stage 3C candidates preserve the full current QB and top-67 populations", () => {
  assert.equal(candidates.players.length, 109);
  assert.equal(candidates.summary.top67Count, 67);
  assert.ok(candidates.summary.experiencedTop67Count >= contract.acceptance.minimumExperiencedTop67ForCalibration);
});

test("Candidate values remain bounded, capped and explicitly non-operational", () => {
  const [minimum, maximum] = contract.candidateCalibration.scale;
  const moveCap = contract.candidateCalibration.maximumAbsoluteMoveFromStage2Prior;
  for (const player of candidates.players) {
    assert.ok(player.candidateValue >= minimum && player.candidateValue <= maximum);
    assert.ok(Math.abs(player.candidateDeltaFromPrior) <= moveCap + 1e-9);
    assert.equal(player.operational, false);
    assert.equal(player.marketViewed, false);
  }
  assert.equal(candidates.summary.allWithinScale, true);
  assert.equal(candidates.summary.allWithinMoveCap, true);
});

test("Low-sample quarterbacks fail closed to the frozen EA prior", () => {
  const blocked = candidates.players.filter((player) => player.status === "BLOCKED_INSUFFICIENT_QB_SAMPLE");
  assert.ok(blocked.length > 0);
  for (const player of blocked) {
    assert.equal(player.candidateValue, player.priorValue);
    assert.equal(player.performanceBlend, 0);
    assert.equal(player.performanceImpliedValue, null);
  }
});

test("Supporting cast and opponent context cannot become another spread addend", () => {
  assert.equal(contract.predictiveFeatures.supportingCastRole, "EXCLUDED_FROM_NUMERIC_MODEL_TO_PREVENT_DOUBLE_COUNTING");
  assert.equal(contract.predictiveFeatures.opponentAndScheduleRole, "TARGET_NORMALIZATION_ONLY_NOT_A_SPREAD_ADDEND");
  assert.ok(candidates.players.every((player) => player.contextNormalization.directSpreadAddendAllowed === false));
});

test("Stage 3C creates research values without changing Graham or activating production authority", () => {
  assert.equal(audit.weightsEstimated, true);
  assert.equal(audit.candidateQbValuesCreated, true);
  assert.equal(audit.candidateValuesOperational, false);
  assert.equal(audit.grahamFairNumbersChanged, false);
  assert.equal(audit.embeddedQbBaselinesChanged, false);
  assert.equal(audit.uncertaintyOverlaysRetired, false);
  assert.equal(audit.protectedArtifactsUnchanged, true);
  assert.equal(audit.productionAuthority, false);
  assert.equal(audit.marketViewed, false);
  assert.equal(current.nextSubstage, "STAGE3D_CANDIDATE_FREEZE_AND_STAGE3_ACCEPTANCE");
});
