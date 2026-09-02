#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");

const FILES = {
  contract: "data/walters/nfl/qb-performance/stage3-contract-v1.json",
  current: "data/walters/nfl/qb-performance/stage3-current.json",
  registry: "data/walters/nfl/qb-performance/source-registry-v1.json",
  stage2: "data/walters/nfl/player-values/stage2-current.json",
  stage2Audit: "data/walters/nfl/player-values/calibration-audit-v1.json",
  eaCalibration: "data/walters/nfl/personnel-calibration-v1.json",
  eaFreeze: "data/walters/nfl/madden27/madden27-current.json"
};

function readJson(relativePath) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON in ${relativePath}: ${error.message}`);
  }
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasStringValue(value, expected) {
  if (typeof value === "string") return value === expected;
  if (Array.isArray(value)) return value.some((item) => hasStringValue(item, expected));
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => hasStringValue(item, expected));
  }
  return false;
}

function findKeyValues(value, key, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) findKeyValues(item, key, found);
    return found;
  }
  if (value && typeof value === "object") {
    for (const [candidateKey, candidateValue] of Object.entries(value)) {
      if (candidateKey === key) found.push(candidateValue);
      findKeyValues(candidateValue, key, found);
    }
  }
  return found;
}

function containsForbiddenWriteTarget(targets) {
  const normalized = targets.map((target) => String(target).toLowerCase());
  const forbiddenFragments = [
    "week-01-current-numbers",
    "current-week-terminal",
    "personnel-production-current",
    "matchup-production-current",
    "nfl-power-ratings-ledger"
  ];
  return normalized.some((target) =>
    forbiddenFragments.some((fragment) => target.includes(fragment))
  );
}

function validate() {
  const contract = readJson(FILES.contract);
  const current = readJson(FILES.current);
  const registry = readJson(FILES.registry);
  const stage2 = readJson(FILES.stage2);
  const stage2Audit = readJson(FILES.stage2Audit);
  const eaCalibration = readJson(FILES.eaCalibration);
  const eaFreeze = readJson(FILES.eaFreeze);

  const checks = [];

  assertCondition(contract.stage === 3 && contract.substage === "3A",
    "Contract must identify Stage 3A.");
  checks.push("stage3a-identity");

  assertCondition(contract.operational === false && contract.productionAuthority === false,
    "Stage 3A must remain non-operational and without production authority.");
  assertCondition(current.operational === false && current.productionAuthority === false,
    "Current state must remain non-operational and without production authority.");
  checks.push("non-operational-boundary");

  assertCondition(contract.marketViewed === false && current.marketViewed === false,
    "Stage 3A must attest marketViewed:false.");
  assertCondition(registry.marketSourcesAllowed === false,
    "Source registry must prohibit market sources.");
  checks.push("market-isolation");

  assertCondition(contract.scale.minimum === 6.0 && contract.scale.maximum === 9.5,
    "QB candidate scale must remain bounded from 6.00 through 9.50.");
  assertCondition(Math.abs(contract.scale.publishedWaltersMean - 7.74) < 1e-9,
    "Published Walters mean anchor must remain 7.74.");
  assertCondition(Math.abs(contract.scale.stage2PriorMean - 7.75) < 1e-9,
    "Stage 2 prior mean anchor must remain 7.75.");
  assertCondition(contract.scale.fullQuarterbackValueMayBeAddedToExistingTeamRating === false,
    "Full QB value must never be added on top of an existing team rating.");
  checks.push("scale-and-differential");

  assertCondition(contract.prior.role === "SHRINKAGE_PRIOR_ONLY",
    "EA value must be a shrinkage prior only.");
  assertCondition(contract.prior.directLiveUseAllowed === false,
    "EA prior cannot be used directly in live Graham calculations.");
  assertCondition(contract.prior.mayMoveGrahamFairByItself === false,
    "EA prior cannot move a Graham fair by itself.");
  checks.push("ea-prior-only");

  const expectedPerformance = new Set([
    "passer_rating",
    "yards_per_attempt",
    "interception_rate",
    "sack_rate",
    "fumble_rate",
    "qb_rushing_value"
  ]);
  const actualPerformance = new Set(
    contract.evidence.performanceFeatures.map((feature) => feature.id)
  );
  assertCondition(expectedPerformance.size === actualPerformance.size &&
    [...expectedPerformance].every((id) => actualPerformance.has(id)),
    "Performance feature set does not match the Stage 3A lock.");
  checks.push("walters-performance-features");

  const reliability = new Map(
    contract.evidence.reliabilityFeatures.map((feature) => [feature.id, feature])
  );
  for (const id of ["attempts", "dropbacks"]) {
    const feature = reliability.get(id);
    assertCondition(feature?.role === "RELIABILITY_ONLY",
      `${id} must remain reliability-only.`);
    assertCondition(feature?.directPerformancePointsAllowed === false,
      `${id} cannot create direct performance points.`);
  }
  checks.push("sample-reliability-separation");

  const supportContext = contract.evidence.contextFeatures.find(
    (feature) => feature.id === "supporting_offense_context"
  );
  assertCondition(supportContext?.directSpreadAddendAllowed === false,
    "Supporting offense context cannot become a direct spread addend.");
  assertCondition(supportContext?.doubleCountProtectionRequired === true,
    "Supporting offense context must require double-count protection.");
  checks.push("supporting-cast-double-count-protection");

  assertCondition(contract.candidateWindowSearchSpace.preOutcomeLocked === true,
    "Candidate window search space must be locked before outcome inspection.");
  assertCondition(contract.candidateWindowSearchSpace.selectionMayUseMarketOrClosingLine === false,
    "Model selection cannot use market or closing-line targets.");
  assertCondition(contract.modelDiscipline.weightsStatus === "UNESTIMATED_LOCKED_OFF",
    "Stage 3A cannot contain estimated model weights.");
  assertCondition(current.weightsStatus === "UNESTIMATED_LOCKED_OFF",
    "Current state cannot activate model weights.");
  checks.push("pre-outcome-method-lock");

  assertCondition(contract.writeBoundary.grahamFairNumberWritesAllowed === false,
    "Stage 3A cannot write Graham fair numbers.");
  assertCondition(contract.writeBoundary.uncertaintyOverlayRetirementAllowed === false,
    "Stage 3A cannot retire QB uncertainty overlays.");
  assertCondition(current.grahamWritesAllowed === false,
    "Current state cannot permit Graham writes.");
  assertCondition(!containsForbiddenWriteTarget(contract.writeBoundary.stage3AAllowedWrites),
    "Stage 3A allowed-write list includes a prohibited production target.");
  checks.push("no-graham-write");

  assertCondition(current.nextSubstage === "STAGE3B_DATA_CAPTURE_IDENTITY_AUDIT",
    "Stage 3A next substage must be the data-capture and identity audit.");
  assertCondition(registry.captureStatus === "PENDING_STAGE3B",
    "External performance capture must remain pending until Stage 3B.");
  assertCondition(registry.allExternalAssetsHashPinned === false,
    "Stage 3A must not falsely attest external asset hash completion.");
  checks.push("stage3b-handoff");

  assertCondition(hasStringValue(stage2, "VALIDATED_NON_OPERATIONAL"),
    "Stage 2 dependency is not in VALIDATED_NON_OPERATIONAL state.");
  const stage3AuthorityValues = findKeyValues(stage2, "stage3Authority");
  assertCondition(stage3AuthorityValues.includes(false),
    "Stage 2 must explicitly retain stage3Authority:false.");
  const productionAuthorityValues = findKeyValues(stage2, "productionAuthority");
  assertCondition(productionAuthorityValues.includes(false),
    "Stage 2 must explicitly retain productionAuthority:false.");
  checks.push("stage2-fail-closed-dependency");

  assertCondition(hasStringValue(stage2Audit, "PASS"),
    "Stage 2 calibration audit must contain a PASS status.");
  assertCondition(eaFreeze.state === "FROZEN_STAGE_1",
    "EA source snapshot must remain in its frozen Stage 1 state.");
  assertCondition(eaFreeze.stage2Authority === false,
    "EA source snapshot cannot grant Stage 2 or later authority by itself.");
  assertCondition(eaCalibration.rankingLayer?.role === "PUBLIC_PLAYER_RANKING_INPUT_ONLY",
    "EA rankings must remain a public ranking input only.");
  assertCondition(eaCalibration.marketIsolation?.required === true,
    "Existing EA calibration must retain market isolation.");
  assertCondition(
    eaCalibration.qbConversion?.performanceValidation?.requiredBeforeProductionUse === true,
    "Existing EA calibration must still require QB performance validation before production use."
  );
  checks.push("frozen-prior-lineage");

  assertCondition(contract.authority.candidateMayMoveGrahamFair === false,
    "Stage 3 candidate authority cannot move Graham fairs.");
  assertCondition(contract.authority.productionTokenMayBeActivatedBeforeStage5 === false,
    "Production token cannot be activated before Stage 5.");
  checks.push("promotion-boundary");

  return {
    schemaVersion: "walters-qb-performance-stage3-validation-v1",
    status: "PASS",
    stage: 3,
    substage: "3A",
    checks,
    productionAuthority: false,
    marketViewed: false,
    nextSubstage: current.nextSubstage
  };
}

try {
  const result = validate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    schemaVersion: "walters-qb-performance-stage3-validation-v1",
    status: "FAIL",
    error: error.message,
    productionAuthority: false
  }, null, 2)}\n`);
  process.exitCode = 1;
}
