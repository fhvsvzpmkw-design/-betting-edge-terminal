import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(TEST_PATH), "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function sha256File(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, relativePath))).digest("hex");
}

const contract = readJson("data/walters/nfl/qb-performance/stage3d-contract-v1.json");
const current = readJson("data/walters/nfl/qb-performance/stage3-current.json");
const model = readJson("data/walters/nfl/qb-performance/model/stage3c-model-v1.json");
const audit = readJson("data/walters/nfl/qb-performance/model/stage3c-holdout-audit-v1.json");
const candidates = readJson("data/walters/nfl/qb-performance/candidates/qb-candidates-2026-stage3c-v1.json");
const freeze = readJson("data/walters/nfl/qb-performance/freeze/stage3d-freeze-manifest-v1.json");
const review = readJson("data/walters/nfl/qb-performance/review/stage3d-candidate-review-v1.json");
const acceptance = readJson("data/walters/nfl/qb-performance/stage3-acceptance-v1.json");

test("Stage 3D freezes every contracted Stage 3 input by raw SHA-256", () => {
  assert.equal(freeze.status, "STAGE3C_INPUTS_HASH_FROZEN");
  assert.equal(freeze.inputCount, contract.freezePolicy.immutableInputPaths.length);
  assert.deepEqual(freeze.entries.map((entry) => entry.path), [...contract.freezePolicy.immutableInputPaths].sort());
  for (const entry of freeze.entries) {
    assert.equal(sha256File(entry.path), entry.sha256);
  }
  assert.equal(freeze.modelReestimated, false);
  assert.equal(freeze.candidateValuesRevised, false);
});

test("Stage 3D reviews the complete current quarterback population exactly once", () => {
  assert.equal(review.summary.playerCount, 109);
  assert.equal(review.players.length, 109);
  assert.equal(new Set(review.players.map((player) => player.playerId)).size, 109);
  assert.equal(review.summary.top67Count, 67);
  assert.equal(review.summary.hardErrorCount, 0);
  assert.deepEqual(
    new Set(review.players.map((player) => String(player.playerId))),
    new Set(candidates.players.map((player) => String(player.playerId))),
  );
});

test("Every Stage 3D player flag is governed and non-operational", () => {
  const allowed = new Set(contract.candidateReview.allowedReviewFlags);
  for (const player of review.players) {
    assert.ok(player.reviewFlags.every((flag) => allowed.has(flag)));
    assert.equal(player.reviewFlagCount, player.reviewFlags.length);
    assert.equal(player.operational, false);
    assert.equal(player.marketViewed, false);
  }
  assert.equal(review.candidateValuesRevised, false);
  assert.equal(review.productionAuthority, false);
  assert.equal(review.grahamWritesAllowed, false);
});

test("Kirk Cousins and the two high-impact elite cases receive explicit review", () => {
  assert.deepEqual(
    review.requiredCaseStudies.map((player) => player.playerName),
    ["Kirk Cousins", "Patrick Mahomes", "Joe Burrow"],
  );
  for (const player of review.requiredCaseStudies) {
    assert.ok(Number.isFinite(player.priorValue));
    assert.ok(Number.isFinite(player.candidateValue));
    assert.equal(player.operational, false);
  }
});

test("Stage 3D does not invent a starter map", () => {
  assert.equal(contract.starterAuthority.status, "NOT_AVAILABLE_IN_STAGE3_INPUTS");
  assert.equal(contract.starterAuthority.starterInferenceAllowed, false);
  assert.equal(contract.starterAuthority.teamCandidateLeaderIsStarterAuthority, false);
  assert.ok(review.teamCandidateLeaders.length > 0);
  assert.ok(review.teamCandidateLeaders.every((record) => record.authority === "CANDIDATE_VALUE_LEADER_ONLY_NOT_STARTER_AUTHORITY"));
  assert.equal(acceptance.starterBindingStatus, "DEFERRED_TO_STAGE4_GOVERNED_BINDING");
});

test("Stage 3C model limitations remain visible in the Stage 4 handoff", () => {
  const allowed = new Set(contract.modelReview.allowedCautionFlags);
  assert.ok(review.modelReview.cautionFlags.every((flag) => allowed.has(flag)));
  assert.equal(review.modelReview.cautionCount, review.modelReview.cautionFlags.length);
  assert.deepEqual(acceptance.modelCautionFlags, review.modelReview.cautionFlags);
});

test("Stage 3 acceptance is limited to regression and shadow testing", () => {
  assert.equal(acceptance.status, "PASS");
  assert.equal(acceptance.decision, "STAGE3_ACCEPTED_FOR_STAGE4_SHADOW_TESTING_NON_OPERATIONAL");
  assert.equal(acceptance.acceptedFor, "STAGE4_QB_REGRESSION_AND_SHADOW_TESTING_ONLY");
  assert.ok(acceptance.notAcceptedFor.includes("PRODUCTION_QB_AUTHORITY"));
  assert.ok(acceptance.notAcceptedFor.includes("GRAHAM_FAIR_NUMBER_WRITES"));
  assert.equal(acceptance.productionAuthority, false);
  assert.equal(acceptance.grahamWritesAllowed, false);
  assert.equal(acceptance.candidateValuesOperational, false);
  assert.equal(acceptance.grahamFairNumbersChanged, false);
  assert.equal(acceptance.embeddedQbBaselinesChanged, false);
  assert.equal(acceptance.uncertaintyOverlaysRetired, false);
});

test("Stage 3D preserves all protected Graham artifacts", () => {
  assert.equal(audit.protectedArtifactsUnchanged, true);
  assert.equal(acceptance.protectedArtifactsUnchanged, true);
  assert.deepEqual(acceptance.protectedArtifactSha256Before, acceptance.protectedArtifactSha256After);
});

test("Current authority advances only to Stage 4 shadow testing", () => {
  assert.equal(current.substage, "3D");
  assert.equal(current.status, contract.acceptance.passState);
  assert.equal(current.operational, false);
  assert.equal(current.productionAuthority, false);
  assert.equal(current.marketViewed, false);
  assert.equal(current.candidateOutputStatus, "FROZEN_NON_OPERATIONAL");
  assert.equal(current.grahamWritesAllowed, false);
  assert.equal(current.uncertaintyOverlayRetirementAllowed, false);
  assert.equal(current.nextStage, "STAGE4_QB_REGRESSION_AND_SHADOW_TESTING");
});

test("Stage 3D output hashes and authority token boundaries read back", () => {
  assert.equal(current.freezeManifestSha256, sha256File("data/walters/nfl/qb-performance/freeze/stage3d-freeze-manifest-v1.json"));
  assert.equal(current.candidateReviewSha256, sha256File("data/walters/nfl/qb-performance/review/stage3d-candidate-review-v1.json"));
  assert.equal(current.stage3AcceptanceSha256, sha256File("data/walters/nfl/qb-performance/stage3-acceptance-v1.json"));
  const serialized = JSON.stringify({ contract, current, model, audit, candidates, freeze, review, acceptance });
  assert.equal(serialized.includes('"APPROVED_WALTERS_QB_PERFORMANCE"'), false);
});
