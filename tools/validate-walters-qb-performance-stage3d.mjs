#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const FILES = {
  contract: "data/walters/nfl/qb-performance/stage3d-contract-v1.json",
  current: "data/walters/nfl/qb-performance/stage3-current.json",
  model: "data/walters/nfl/qb-performance/model/stage3c-model-v1.json",
  audit: "data/walters/nfl/qb-performance/model/stage3c-holdout-audit-v1.json",
  candidates: "data/walters/nfl/qb-performance/candidates/qb-candidates-2026-stage3c-v1.json",
  freeze: "data/walters/nfl/qb-performance/freeze/stage3d-freeze-manifest-v1.json",
  review: "data/walters/nfl/qb-performance/review/stage3d-candidate-review-v1.json",
  acceptance: "data/walters/nfl/qb-performance/stage3-acceptance-v1.json",
};

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(relativePath) {
  const target = absolute(relativePath);
  if (!fs.existsSync(target)) throw new Error(`Missing required Stage 3D file: ${relativePath}`);
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function sha256File(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolute(relativePath))).digest("hex");
}

function canonicalPayload(value) {
  if (Array.isArray(value)) return value.map(canonicalPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => key !== "contentSha256Canonical")
        .sort()
        .map((key) => [key, canonicalPayload(value[key])]),
    );
  }
  return value;
}

function canonicalSha(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalPayload(value))).digest("hex");
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function validateCanonicalMarker(value, label) {
  assertCondition(typeof value.contentSha256Canonical === "string" && value.contentSha256Canonical.length === 64, `${label} canonical hash marker is invalid.`);
}

function validate() {
  const contract = readJson(FILES.contract);
  const current = readJson(FILES.current);
  const model = readJson(FILES.model);
  const audit = readJson(FILES.audit);
  const candidates = readJson(FILES.candidates);
  const freeze = readJson(FILES.freeze);
  const review = readJson(FILES.review);
  const acceptance = readJson(FILES.acceptance);
  const checks = [];

  assertCondition(contract.stage === 3 && contract.substage === "3D", "Stage 3D contract identity is invalid.");
  assertCondition(contract.status === "CANDIDATE_FREEZE_AND_STAGE3_ACCEPTANCE_LOCKED_NON_OPERATIONAL", "Stage 3D contract is not locked.");
  assertCondition(contract.operational === false && contract.productionAuthority === false && contract.marketViewed === false, "Stage 3D contract violates the non-operational boundary.");
  assertCondition(contract.starterAuthority.starterInferenceAllowed === false, "Stage 3D may not infer starter identities.");
  checks.push("stage3d-contract-and-starter-boundary");

  assertCondition(model.status === "HOLDOUT_VALIDATED_NON_OPERATIONAL", "The frozen Stage 3C model is not accepted research evidence.");
  assertCondition(audit.status === "PASS" && audit.checks.every((check) => check.pass === true), "The Stage 3C holdout audit is not fully green.");
  assertCondition(candidates.status === "NON_OPERATIONAL_SHADOW_CANDIDATES", "The Stage 3C candidate registry state changed.");
  assertCondition(model.productionAuthority === false && audit.productionAuthority === false && candidates.productionAuthority === false, "A Stage 3C dependency became production authority.");
  assertCondition(model.marketViewed === false && audit.marketViewed === false && candidates.marketViewed === false, "A Stage 3C dependency became market exposed.");
  checks.push("stage3c-dependency-acceptance");

  assertCondition(freeze.status === "STAGE3C_INPUTS_HASH_FROZEN", "Stage 3D freeze manifest status is invalid.");
  assertCondition(freeze.inputCount === contract.freezePolicy.immutableInputPaths.length, "Stage 3D freeze input count changed.");
  assertCondition(freeze.entries.length === freeze.inputCount, "Stage 3D freeze entries are incomplete.");
  assertCondition(freeze.allInputsPresent === true && freeze.modelReestimated === false && freeze.candidateValuesRevised === false, "Stage 3D freeze semantics are invalid.");
  const expectedFreezePaths = [...contract.freezePolicy.immutableInputPaths].sort();
  const actualFreezePaths = freeze.entries.map((entry) => entry.path);
  assertCondition(JSON.stringify(actualFreezePaths) === JSON.stringify(expectedFreezePaths), "Stage 3D freeze paths do not match the contract.");
  for (const entry of freeze.entries) {
    assertCondition(fs.existsSync(absolute(entry.path)), `Frozen input disappeared: ${entry.path}`);
    assertCondition(sha256File(entry.path) === entry.sha256, `Frozen input hash mismatch: ${entry.path}`);
    if (entry.path.endsWith(".json")) {
      assertCondition(typeof entry.canonicalJsonSha256 === "string" && entry.canonicalJsonSha256.length === 64, `Frozen JSON canonical hash marker is invalid: ${entry.path}`);
    }
  }
  validateCanonicalMarker(freeze, "Stage 3D freeze manifest");
  checks.push("immutable-stage3c-freeze");

  assertCondition(["PASS", "PASS_WITH_REVIEW_FLAGS"].includes(review.status), "Stage 3D candidate review did not pass.");
  assertCondition(review.summary.playerCount === contract.candidateReview.expectedCurrentQbCount, "Stage 3D did not review the complete quarterback population.");
  assertCondition(review.summary.uniquePlayerIdCount === review.summary.playerCount, "Stage 3D candidate review has duplicate identities.");
  assertCondition(review.summary.top67Count === contract.candidateReview.expectedTop67Count, "Stage 3D candidate review lost the top-67 cohort.");
  assertCondition(review.summary.hardErrorCount === 0, "Stage 3D candidate review contains hard errors.");
  assertCondition(review.summary.requiredCaseStudiesPresent === true, "Stage 3D required case studies are incomplete.");
  assertCondition(review.players.length === review.summary.playerCount, "Stage 3D player review count is inconsistent.");
  const reviewedIds = new Set(review.players.map((player) => player.playerId));
  assertCondition(reviewedIds.size === review.players.length, "Stage 3D reviewed a player more than once.");
  const sourceIds = new Set(candidates.players.map((player) => String(player.playerId)));
  assertCondition(reviewedIds.size === sourceIds.size && [...reviewedIds].every((id) => sourceIds.has(String(id))), "Stage 3D review does not exactly cover the Stage 3C candidate registry.");
  const allowedFlags = new Set(contract.candidateReview.allowedReviewFlags);
  for (const player of review.players) {
    assertCondition(player.operational === false && player.marketViewed === false, `${player.playerName} became operational or market exposed in review.`);
    assertCondition(player.reviewFlags.every((flag) => allowedFlags.has(flag)), `${player.playerName} has an unrecognized review flag.`);
    assertCondition(player.reviewFlagCount === player.reviewFlags.length, `${player.playerName} review flag count is inconsistent.`);
  }
  const requiredCaseNames = review.requiredCaseStudies.map((player) => player.playerName);
  assertCondition(JSON.stringify(requiredCaseNames) === JSON.stringify(contract.candidateReview.requiredCaseStudies), "Stage 3D case-study order or identity changed.");
  assertCondition(review.teamCandidateLeaders.every((record) => record.authority === "CANDIDATE_VALUE_LEADER_ONLY_NOT_STARTER_AUTHORITY"), "A team candidate leader was incorrectly promoted to starter authority.");
  validateCanonicalMarker(review, "Stage 3D candidate review");
  checks.push("complete-candidate-and-case-study-review");

  const allowedModelFlags = new Set(contract.modelReview.allowedCautionFlags);
  assertCondition(review.modelReview.cautionFlags.every((flag) => allowedModelFlags.has(flag)), "Stage 3D model review has an unrecognized caution flag.");
  assertCondition(review.modelReview.cautionCount === review.modelReview.cautionFlags.length, "Stage 3D model caution count is inconsistent.");
  checks.push("model-limitations-carried-forward");

  assertCondition(acceptance.status === "PASS", "Stage 3 acceptance did not pass.");
  assertCondition(acceptance.decision === contract.acceptance.passState, "Stage 3 acceptance decision is invalid.");
  assertCondition(acceptance.acceptedFor === contract.acceptance.acceptedFor, "Stage 3 acceptance scope changed.");
  assertCondition(JSON.stringify(acceptance.notAcceptedFor) === JSON.stringify(contract.acceptance.notAcceptedFor), "Stage 3 production exclusions changed.");
  assertCondition(acceptance.checks.every((check) => check.pass === true), "One or more Stage 3D acceptance gates failed.");
  assertCondition(acceptance.freezeManifestSha256 === sha256File(FILES.freeze), "Stage 3 acceptance freeze hash mismatch.");
  assertCondition(acceptance.candidateReviewSha256 === sha256File(FILES.review), "Stage 3 acceptance review hash mismatch.");
  assertCondition(acceptance.stage3CModelSha256 === sha256File(FILES.model), "Stage 3 acceptance model hash mismatch.");
  assertCondition(acceptance.stage3CHoldoutAuditSha256 === sha256File(FILES.audit), "Stage 3 acceptance audit hash mismatch.");
  assertCondition(acceptance.stage3CCandidatesSha256 === sha256File(FILES.candidates), "Stage 3 acceptance candidate hash mismatch.");
  assertCondition(acceptance.protectedArtifactsUnchanged === true, "Stage 3D did not preserve protected Graham artifacts.");
  assertCondition(JSON.stringify(acceptance.protectedArtifactSha256Before) === JSON.stringify(acceptance.protectedArtifactSha256After), "Stage 3D protected artifact hashes differ.");
  assertCondition(acceptance.candidateValuesOperational === false && acceptance.grahamFairNumbersChanged === false, "Stage 3D activated candidates or changed a Graham fair.");
  assertCondition(acceptance.embeddedQbBaselinesChanged === false && acceptance.uncertaintyOverlaysRetired === false, "Stage 3D changed embedded baselines or uncertainty overlays.");
  assertCondition(acceptance.productionAuthority === false && acceptance.grahamWritesAllowed === false && acceptance.marketViewed === false, "Stage 3D acceptance violates authority isolation.");
  assertCondition(acceptance.nextStage === contract.acceptance.nextStageOnPass, "Stage 3D handoff target is invalid.");
  validateCanonicalMarker(acceptance, "Stage 3 acceptance");
  checks.push("stage3-shadow-only-acceptance");

  assertCondition(current.substage === "3D", "Current QB authority did not advance to Stage 3D.");
  assertCondition(current.status === contract.acceptance.passState, "Current QB authority does not carry the Stage 3 acceptance state.");
  assertCondition(current.operational === false && current.productionAuthority === false && current.marketViewed === false, "Current Stage 3D authority boundary is invalid.");
  assertCondition(current.candidateOutputStatus === "FROZEN_NON_OPERATIONAL", "Current Stage 3D candidates are not frozen as non-operational.");
  assertCondition(current.grahamWritesAllowed === false && current.uncertaintyOverlayRetirementAllowed === false, "Current Stage 3D state permits a prohibited production write.");
  assertCondition(current.freezeManifestSha256 === sha256File(FILES.freeze), "Current Stage 3D freeze SHA mismatch.");
  assertCondition(current.candidateReviewSha256 === sha256File(FILES.review), "Current Stage 3D review SHA mismatch.");
  assertCondition(current.stage3AcceptanceSha256 === sha256File(FILES.acceptance), "Current Stage 3D acceptance SHA mismatch.");
  assertCondition(current.nextStage === contract.acceptance.nextStageOnPass && current.nextSubstage === contract.acceptance.nextStageOnPass, "Current Stage 3D handoff is invalid.");
  validateCanonicalMarker(current, "Current Stage 3D authority");
  checks.push("stage4-shadow-handoff");

  const serialized = JSON.stringify({ contract, current, model, audit, candidates, freeze, review, acceptance });
  assertCondition(!serialized.includes('"APPROVED_WALTERS_QB_PERFORMANCE"'), "Stage 3D prematurely activated the production authority token.");
  checks.push("no-production-authority-token");

  return {
    schemaVersion: "walters-qb-performance-stage3d-validation-v1",
    status: "PASS",
    stage: 3,
    substage: "3D",
    checks,
    freezeInputCount: freeze.inputCount,
    candidateSummary: review.summary,
    modelCautionFlags: review.modelReview.cautionFlags,
    decision: acceptance.decision,
    productionAuthority: false,
    marketViewed: false,
    nextStage: acceptance.nextStage,
  };
}

try {
  process.stdout.write(`${JSON.stringify(validate(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    schemaVersion: "walters-qb-performance-stage3d-validation-v1",
    status: "FAIL",
    error: error.message,
    productionAuthority: false,
  }, null, 2)}\n`);
  process.exitCode = 1;
}
