#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const FILES = {
  contract: "data/walters/nfl/qb-performance/stage3c-contract-v1.json",
  current: "data/walters/nfl/qb-performance/stage3-current.json",
  model: "data/walters/nfl/qb-performance/model/stage3c-model-v1.json",
  audit: "data/walters/nfl/qb-performance/model/stage3c-holdout-audit-v1.json",
  candidates: "data/walters/nfl/qb-performance/candidates/qb-candidates-2026-stage3c-v1.json",
  stage3B: "data/walters/nfl/qb-performance/stage3b-audit-v1.json",
  crosswalk: "data/walters/nfl/qb-performance/identity-crosswalk-v1.json",
  weekly: "data/walters/nfl/qb-performance/normalized/qb-weekly-2021-2025-v1.csv"
};

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(relativePath) {
  const target = absolute(relativePath);
  if (!fs.existsSync(target)) throw new Error(`Missing required Stage 3C file: ${relativePath}`);
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function sha256File(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolute(relativePath))).digest("hex");
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function within(value, bounds) {
  return Number(value) >= Number(bounds[0]) && Number(value) <= Number(bounds[1]);
}

function validate() {
  const contract = readJson(FILES.contract);
  const current = readJson(FILES.current);
  const model = readJson(FILES.model);
  const audit = readJson(FILES.audit);
  const candidates = readJson(FILES.candidates);
  const stage3B = readJson(FILES.stage3B);
  const crosswalk = readJson(FILES.crosswalk);
  const checks = [];

  assertCondition(contract.stage === 3 && contract.substage === "3C", "Stage 3C contract identity is invalid.");
  assertCondition(contract.status === "MODEL_SPECIFICATION_LOCKED_NON_OPERATIONAL", "Stage 3C contract is not locked.");
  assertCondition(contract.operational === false && contract.productionAuthority === false, "Stage 3C contract must remain non-operational.");
  assertCondition(contract.marketViewed === false, "Stage 3C contract must attest marketViewed:false.");
  checks.push("stage3c-contract-lock");

  assertCondition(JSON.stringify(contract.chronology.modelFitSeasonsForTuning) === JSON.stringify([2022, 2023]), "Stage 3C tuning fit seasons changed.");
  assertCondition(contract.chronology.tuningSeason === 2024, "Stage 3C tuning season must remain 2024.");
  assertCondition(JSON.stringify(contract.chronology.finalFitSeasons) === JSON.stringify([2022, 2023, 2024]), "Stage 3C final fit seasons changed.");
  assertCondition(contract.chronology.untouchedHoldoutSeason === 2025, "Stage 3C holdout season must remain 2025.");
  assertCondition(contract.model.holdoutMayRefitModel === false, "The 2025 holdout cannot refit the model.");
  assertCondition(contract.validationTarget.marketOrSpreadTargetAllowed === false, "Market or spread targets cannot enter Stage 3C.");
  checks.push("chronological-holdout-lock");

  assertCondition(stage3B.status === "PASS", "Stage 3B dependency is not PASS.");
  assertCondition(stage3B.productionAuthority === false && stage3B.marketViewed === false, "Stage 3B dependency violates authority isolation.");
  assertCondition(sha256File(FILES.weekly) === stage3B.weeklyNormalized.sha256, "Stage 3B weekly evidence hash changed.");
  assertCondition(crosswalk.status === "PASS" && crosswalk.blockedIdentityCount === 0, "Stage 3B identity crosswalk is not clean.");
  assertCondition(crosswalk.currentEaNflTeamQbCount === 109 && crosswalk.top67DistributionCohortCount === 67, "Stage 3B QB population changed.");
  checks.push("stage3b-source-and-identity-lineage");

  assertCondition(model.status === "HOLDOUT_VALIDATED_NON_OPERATIONAL", `Stage 3C model is not accepted: ${model.status}`);
  assertCondition(model.productionAuthority === false && model.grahamWritesAllowed === false && model.marketViewed === false, "Stage 3C model violates the non-operational boundary.");
  assertCondition(model.holdoutSeason === 2025, "Model holdout season changed.");
  assertCondition(model.configurationCountEvaluated === 135, `Expected 135 configurations, found ${model.configurationCountEvaluated}.`);
  assertCondition(model.featureNames.length === 12 && Object.keys(model.weights).length === 12, "Stage 3C must retain twelve long/short Walters feature inputs.");
  assertCondition(Object.values(model.weights).every((value) => Number(value) >= -1e-12), "A Stage 3C feature sign reversed.");
  assertCondition(model.solver.deterministicRefit === true, "Stage 3C deterministic refit failed.");
  assertCondition(model.solver.converged === true, "Stage 3C solver did not converge.");
  checks.push("model-fit-and-sign-discipline");

  const selected = model.selectedConfiguration;
  assertCondition(contract.predictiveFeatures.longTermWindowCandidatesCompletedSeasons.includes(selected.longTermCompletedSeasons), "Selected long-term window was not pre-locked.");
  assertCondition(contract.predictiveFeatures.shortTermWindowCandidatesQualifiedGames.includes(selected.shortTermQualifiedGames), "Selected short-term window was not pre-locked.");
  assertCondition(contract.predictiveFeatures.featurePriorEquivalentDropbackCandidates.includes(selected.featurePriorEquivalentDropbacks), "Selected shrinkage prior was not pre-locked.");
  assertCondition(contract.model.ridgeAlphaCandidates.includes(selected.ridgeAlpha), "Selected ridge alpha was not pre-locked.");
  checks.push("prelocked-configuration-selection");

  assertCondition(audit.status === "PASS", `Stage 3C holdout audit is not PASS: ${audit.status}`);
  assertCondition(audit.checks.every((check) => check.pass === true), "One or more Stage 3C acceptance gates failed.");
  assertCondition(audit.weightsEstimated === true && audit.candidateQbValuesCreated === true, "Stage 3C did not create its research outputs.");
  assertCondition(audit.candidateValuesOperational === false, "Stage 3C candidates cannot be operational.");
  assertCondition(audit.grahamFairNumbersChanged === false && audit.embeddedQbBaselinesChanged === false, "Stage 3C changed a Graham number or embedded baseline.");
  assertCondition(audit.uncertaintyOverlaysRetired === false, "Stage 3C retired a QB uncertainty overlay.");
  assertCondition(audit.productionAuthority === false && audit.marketViewed === false, "Stage 3C audit violates authority or market isolation.");
  assertCondition(audit.protectedArtifactsUnchanged === true, "Protected Graham artifacts changed during Stage 3C.");
  assertCondition(JSON.stringify(audit.protectedArtifactSha256Before) === JSON.stringify(audit.protectedArtifactSha256After), "Protected artifact hashes do not read back identically.");
  checks.push("holdout-acceptance-and-protected-artifacts");

  assertCondition(candidates.status === "NON_OPERATIONAL_SHADOW_CANDIDATES", "Stage 3C candidate registry state is invalid.");
  assertCondition(candidates.players.length === 109, `Expected 109 current QB candidates, found ${candidates.players.length}.`);
  assertCondition(candidates.summary.top67Count === 67, "Stage 3C candidate registry lost the top-67 cohort.");
  assertCondition(candidates.summary.experiencedTop67Count >= contract.acceptance.minimumExperiencedTop67ForCalibration, "Experienced top-67 calibration population is insufficient.");
  assertCondition(within(candidates.summary.top67CandidateMean, contract.acceptance.candidateMeanRangeTop67), "Top-67 candidate mean is outside the Walters guardrail.");
  assertCondition(candidates.summary.allWithinScale === true && candidates.summary.allWithinMoveCap === true, "Candidate scale or movement cap failed.");
  assertCondition(candidates.players.every((player) => player.operational === false && player.marketViewed === false), "An individual Stage 3C candidate became operational or market-exposed.");
  assertCondition(candidates.players.every((player) => within(player.candidateValue, contract.candidateCalibration.scale)), "An individual candidate is outside 6.00-9.50.");
  assertCondition(candidates.players.every((player) => Math.abs(Number(player.candidateDeltaFromPrior)) <= Number(contract.candidateCalibration.maximumAbsoluteMoveFromStage2Prior) + 1e-9), "An individual candidate exceeded the Stage 3C move cap.");
  checks.push("candidate-registry-guardrails");

  assertCondition(typeof candidates.contentSha256Canonical === "string" && candidates.contentSha256Canonical.length === 64, "Stage 3C candidate canonical hash marker is invalid.");
  assertCondition(typeof model.contentSha256Canonical === "string" && model.contentSha256Canonical.length === 64, "Stage 3C model canonical hash marker is invalid.");
  assertCondition(candidates.modelContentSha256Canonical === model.contentSha256Canonical, "Candidate registry does not reference the active Stage 3C model hash.");
  checks.push("output-integrity");

  assertCondition(current.substage === "3C", "Current QB authority did not advance to Stage 3C.");
  assertCondition(current.status === contract.acceptance.passState, `Current Stage 3C state is not ${contract.acceptance.passState}.`);
  assertCondition(current.operational === false && current.productionAuthority === false && current.marketViewed === false, "Current Stage 3C authority boundary is invalid.");
  assertCondition(current.weightsStatus === "ESTIMATED_FROZEN_STAGE3C_SHADOW", "Current Stage 3C weights are not frozen as shadow evidence.");
  assertCondition(current.holdoutValidationStatus === "PASS", "Current Stage 3C holdout status is not PASS.");
  assertCondition(current.candidateOutputStatus === "CREATED_NON_OPERATIONAL", "Current Stage 3C candidate status is invalid.");
  assertCondition(current.grahamWritesAllowed === false && current.uncertaintyOverlayRetirementAllowed === false, "Current Stage 3C state permits a prohibited production write.");
  assertCondition(current.nextSubstage === contract.acceptance.nextSubstageOnPass, "Stage 3C handoff target is invalid.");
  assertCondition(sha256File(FILES.audit) === current.holdoutAuditSha256, "Current Stage 3C audit SHA mismatch.");
  assertCondition(sha256File(FILES.candidates) === current.candidatesSha256, "Current Stage 3C candidate SHA mismatch.");
  checks.push("stage3d-handoff");

  const serialized = JSON.stringify({ contract, current, model, audit, candidates });
  assertCondition(!serialized.includes('"APPROVED_WALTERS_QB_PERFORMANCE"'), "Stage 3C prematurely activated the production authority token.");
  return {
    schemaVersion: "walters-qb-performance-stage3c-validation-v1",
    status: "PASS",
    stage: 3,
    substage: "3C",
    checks,
    holdoutMetrics: audit.holdoutMetrics,
    candidateSummary: audit.candidateSummary,
    productionAuthority: false,
    marketViewed: false,
    nextSubstage: current.nextSubstage
  };
}

try {
  process.stdout.write(`${JSON.stringify(validate(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    schemaVersion: "walters-qb-performance-stage3c-validation-v1",
    status: "FAIL",
    error: error.message,
    productionAuthority: false
  }, null, 2)}\n`);
  process.exitCode = 1;
}
