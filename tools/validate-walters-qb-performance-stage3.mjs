#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");

const FILES = {
  contract: "data/walters/nfl/qb-performance/stage3-contract-v1.json",
  stage3BContract: "data/walters/nfl/qb-performance/stage3b-contract-v1.json",
  current: "data/walters/nfl/qb-performance/stage3-current.json",
  registry: "data/walters/nfl/qb-performance/source-registry-v1.json",
  sourceManifest: "data/walters/nfl/qb-performance/source/source-manifest-v1.json",
  stage3BAudit: "data/walters/nfl/qb-performance/stage3b-audit-v1.json",
  identityCrosswalk: "data/walters/nfl/qb-performance/identity-crosswalk-v1.json",
  stage2: "data/walters/nfl/player-values/stage2-current.json",
  stage2Audit: "data/walters/nfl/player-values/calibration-audit-v1.json",
  eaCalibration: "data/walters/nfl/personnel-calibration-v1.json",
  eaFreeze: "data/walters/nfl/madden27/madden27-current.json"
};

function absolute(relativePath) {
  return path.join(REPO_ROOT, relativePath);
}

function readJson(relativePath) {
  const target = absolute(relativePath);
  if (!fs.existsSync(target)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(target, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON in ${relativePath}: ${error.message}`);
  }
}

function sha256File(relativePath) {
  const target = absolute(relativePath);
  if (!fs.existsSync(target)) throw new Error(`Missing hash target: ${relativePath}`);
  return crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
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

function validateStage3AFoundation(contract, current, registry, dependencies, checks) {
  const { stage2, stage2Audit, eaCalibration, eaFreeze } = dependencies;

  assertCondition(contract.stage === 3 && contract.substage === "3A",
    "Foundation contract must identify Stage 3A.");
  checks.push("stage3a-identity");

  assertCondition(contract.operational === false && contract.productionAuthority === false,
    "Stage 3A foundation must remain non-operational and without production authority.");
  assertCondition(current.operational === false && current.productionAuthority === false,
    "Current Stage 3 state must remain non-operational and without production authority.");
  checks.push("non-operational-boundary");

  assertCondition(contract.marketViewed === false && current.marketViewed === false,
    "Stage 3 must attest marketViewed:false.");
  assertCondition(registry.marketSourcesAllowed === false,
    "Source registry must prohibit market sources.");
  checks.push("market-isolation");

  assertCondition(contract.scale.minimum === 6.0 && contract.scale.maximum === 9.5,
    "QB scale must remain bounded from 6.00 through 9.50.");
  assertCondition(Math.abs(contract.scale.publishedWaltersMean - 7.74) < 1e-9,
    "Published Walters mean anchor must remain 7.74.");
  assertCondition(Math.abs(contract.scale.stage2PriorMean - 7.75) < 1e-9,
    "Stage 2 prior mean anchor must remain 7.75.");
  assertCondition(contract.scale.fullQuarterbackValueMayBeAddedToExistingTeamRating === false,
    "Full QB value must never be added on top of an existing team rating.");
  checks.push("scale-and-differential");

  assertCondition(contract.prior.role === "SHRINKAGE_PRIOR_ONLY",
    "EA value must remain a shrinkage prior only.");
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
    "Candidate window search space must remain locked before outcome inspection.");
  assertCondition(contract.candidateWindowSearchSpace.selectionMayUseMarketOrClosingLine === false,
    "Model selection cannot use market or closing-line targets.");
  assertCondition(contract.modelDiscipline.weightsStatus === "UNESTIMATED_LOCKED_OFF",
    "Stage 3A foundation cannot contain estimated model weights.");
  assertCondition(current.weightsStatus === "UNESTIMATED_LOCKED_OFF",
    "Current Stage 3 state cannot activate model weights before Stage 3C.");
  checks.push("pre-outcome-method-lock");

  assertCondition(contract.writeBoundary.grahamFairNumberWritesAllowed === false,
    "Stage 3 cannot write Graham fair numbers.");
  assertCondition(contract.writeBoundary.uncertaintyOverlayRetirementAllowed === false,
    "Stage 3 cannot retire QB uncertainty overlays.");
  assertCondition(current.grahamWritesAllowed === false,
    "Current Stage 3 state cannot permit Graham writes.");
  assertCondition(!containsForbiddenWriteTarget(contract.writeBoundary.stage3AAllowedWrites),
    "Stage 3A allowed-write list includes a prohibited production target.");
  checks.push("no-graham-write");

  assertCondition(hasStringValue(stage2, "VALIDATED_NON_OPERATIONAL"),
    "Stage 2 dependency is not in VALIDATED_NON_OPERATIONAL state.");
  assertCondition(findKeyValues(stage2, "stage3Authority").includes(false),
    "Stage 2 must explicitly retain stage3Authority:false.");
  assertCondition(findKeyValues(stage2, "productionAuthority").includes(false),
    "Stage 2 must explicitly retain productionAuthority:false.");
  assertCondition(hasStringValue(stage2Audit, "PASS"),
    "Stage 2 calibration audit must contain a PASS status.");
  checks.push("stage2-fail-closed-dependency");

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
}

function validateStage3B(contract, current, registry, checks) {
  const stage3B = readJson(FILES.stage3BContract);
  const manifest = readJson(FILES.sourceManifest);
  const audit = readJson(FILES.stage3BAudit);
  const crosswalk = readJson(FILES.identityCrosswalk);

  assertCondition(stage3B.stage === 3 && stage3B.substage === "3B",
    "Stage 3B contract identity is invalid.");
  assertCondition(stage3B.status === "CONTRACT_LOCKED_NON_OPERATIONAL",
    "Stage 3B contract is not locked.");
  assertCondition(stage3B.operational === false && stage3B.productionAuthority === false,
    "Stage 3B contract must remain non-operational.");
  assertCondition(stage3B.marketViewed === false,
    "Stage 3B contract must attest marketViewed:false.");
  checks.push("stage3b-contract-lock");

  const expectedSeasons = [2021, 2022, 2023, 2024, 2025];
  assertCondition(JSON.stringify(stage3B.captureWindow.seasons) === JSON.stringify(expectedSeasons),
    "Stage 3B capture seasons must remain 2021-2025.");
  assertCondition(stage3B.captureWindow.gameType === "REG",
    "Stage 3B may capture regular-season evidence only.");
  assertCondition(stage3B.captureWindow.excludedSeasons.includes(2020),
    "Stage 3B must retain the explicit 2020 exclusion.");
  checks.push("stage3b-window-lock");

  assertCondition(manifest.status === "SOURCE_ASSETS_HASH_LOCKED",
    "Stage 3B source manifest is not hash locked.");
  assertCondition(manifest.assetCount === stage3B.acceptance.requiredSourceAssets,
    "Stage 3B source asset count does not match the contract.");
  assertCondition(JSON.stringify(manifest.seasons) === JSON.stringify(expectedSeasons),
    "Stage 3B source manifest seasons do not match the contract.");
  assertCondition(manifest.allComputedHashesVerified === true,
    "Stage 3B source manifest does not attest verified hashes.");
  assertCondition(manifest.marketViewed === false,
    "Stage 3B source manifest must attest marketViewed:false.");
  const names = new Set(manifest.assets.map((asset) => asset.assetName));
  assertCondition(names.has("players.csv.gz"), "Stage 3B player identity asset is missing.");
  for (const season of expectedSeasons) {
    assertCondition(names.has(`stats_player_week_${season}.csv.gz`),
      `Stage 3B weekly source asset is missing for ${season}.`);
    assertCondition(names.has(`stats_player_reg_${season}.csv.gz`),
      `Stage 3B seasonal source asset is missing for ${season}.`);
  }
  for (const asset of manifest.assets) {
    assertCondition(typeof asset.computedSha256 === "string" && asset.computedSha256.length === 64,
      `Stage 3B source SHA-256 is invalid for ${asset.assetName}.`);
    assertCondition(typeof asset.upstreamDigest === "string" && asset.upstreamDigest.startsWith("sha256:"),
      `Stage 3B upstream digest is missing for ${asset.assetName}.`);
    assertCondition(Number(asset.byteSize) > 0,
      `Stage 3B source byte size is invalid for ${asset.assetName}.`);
    assertCondition(fs.existsSync(absolute(asset.rawPath)),
      `Stage 3B raw source is missing: ${asset.rawPath}`);
    assertCondition(sha256File(asset.rawPath) === asset.computedSha256,
      `Stage 3B raw source hash mismatch: ${asset.assetName}`);
    assertCondition(fs.statSync(absolute(asset.rawPath)).size === Number(asset.byteSize),
      `Stage 3B raw source size mismatch: ${asset.assetName}`);
    assertCondition(asset.upstreamDigest.slice("sha256:".length) === asset.computedSha256,
      `Stage 3B raw source does not match the upstream digest: ${asset.assetName}`);
  }
  checks.push("stage3b-source-lock");

  assertCondition(registry.substage === "3B",
    "Stage 3B source registry has not advanced to 3B.");
  assertCondition(registry.captureStatus === "CAPTURED_HASH_LOCKED",
    "Stage 3B source registry is not captured and hash locked.");
  assertCondition(registry.allExternalAssetsHashPinned === true,
    "Stage 3B source registry does not attest all hashes pinned.");
  assertCondition(registry.marketSourcesAllowed === false && registry.marketViewed === false,
    "Stage 3B source registry violates market isolation.");
  checks.push("stage3b-source-registry");

  assertCondition(audit.status === "PASS",
    `Stage 3B audit is not PASS: ${audit.status}`);
  assertCondition(audit.productionAuthority === false,
    "Stage 3B audit cannot grant production authority.");
  assertCondition(audit.weightsEstimated === false,
    "Stage 3B audit cannot contain estimated weights.");
  assertCondition(audit.candidateQbValuesCreated === false,
    "Stage 3B audit cannot create candidate QB values.");
  assertCondition(audit.grahamFairNumbersChanged === false,
    "Stage 3B audit cannot change Graham fair numbers.");
  assertCondition(audit.uncertaintyOverlaysRetired === false,
    "Stage 3B audit cannot retire uncertainty overlays.");
  assertCondition(audit.marketViewed === false,
    "Stage 3B audit must attest marketViewed:false.");
  assertCondition(audit.checks.every((check) => check.pass === true),
    "One or more Stage 3B acceptance checks failed.");
  checks.push("stage3b-audit-pass");

  assertCondition(crosswalk.status === "PASS",
    "Stage 3B identity crosswalk is not PASS.");
  assertCondition(crosswalk.top67DistributionCohortCount === 67,
    "Stage 3B identity crosswalk does not preserve the 67-QB cohort.");
  assertCondition(crosswalk.blockedIdentityCount === 0,
    "Stage 3B identity crosswalk contains blocked current QB identities.");
  assertCondition(crosswalk.duplicateGsisAssignmentCount === 0,
    "Stage 3B identity crosswalk contains duplicate GSIS assignments.");
  assertCondition(crosswalk.marketViewed === false,
    "Stage 3B identity crosswalk must attest marketViewed:false.");
  assertCondition(crosswalk.players.length === crosswalk.currentEaNflTeamQbCount,
    "Stage 3B identity crosswalk player count is inconsistent.");
  checks.push("stage3b-identity-pass");

  assertCondition(audit.weeklySeasonalCrosscheck.state === "PASS",
    "Stage 3B weekly/seasonal crosscheck is not PASS.");
  assertCondition(audit.weeklySeasonalCrosscheck.mismatchCount === 0,
    "Stage 3B weekly/seasonal crosscheck contains mismatches.");
  checks.push("stage3b-seasonal-crosscheck");

  for (const output of [audit.weeklyNormalized, audit.seasonalNormalized]) {
    assertCondition(fs.existsSync(absolute(output.path)),
      `Stage 3B normalized output is missing: ${output.path}`);
    assertCondition(sha256File(output.path) === output.sha256,
      `Stage 3B normalized output hash mismatch: ${output.path}`);
    assertCondition(Number(output.rowCount) > 0,
      `Stage 3B normalized output is empty: ${output.path}`);
  }
  assertCondition(sha256File(audit.identityCrosswalk.path) === audit.identityCrosswalk.sha256,
    "Stage 3B identity crosswalk hash mismatch.");
  assertCondition(Array.isArray(audit.forbiddenOutputFields) && audit.forbiddenOutputFields.length === 0,
    "Stage 3B normalized outputs contain forbidden market fields.");
  checks.push("stage3b-normalized-output-integrity");

  assertCondition(audit.protectedArtifactsUnchanged === true,
    "Stage 3B changed a protected Graham artifact.");
  assertCondition(JSON.stringify(audit.protectedArtifactSha256Before) ===
    JSON.stringify(audit.protectedArtifactSha256After),
    "Stage 3B protected artifact hashes changed.");
  checks.push("stage3b-protected-artifacts");

  assertCondition(current.status === stage3B.acceptance.passState,
    "Current Stage 3 state does not record the Stage 3B pass state.");
  assertCondition(current.substage === "3B",
    "Current Stage 3 state does not identify substage 3B.");
  assertCondition(current.dataCaptureStatus === "PASS_HASH_LOCKED",
    "Current Stage 3 data capture status is not PASS_HASH_LOCKED.");
  assertCondition(current.identityAuditStatus === "PASS",
    "Current Stage 3 identity audit status is not PASS.");
  assertCondition(current.seasonalCrosscheckStatus === "PASS",
    "Current Stage 3 seasonal crosscheck status is not PASS.");
  assertCondition(current.candidateOutputStatus === "NOT_CREATED",
    "Stage 3B cannot create candidate outputs.");
  assertCondition(current.nextSubstage === stage3B.acceptance.nextSubstageOnPass,
    "Stage 3B next substage must be Stage 3C model estimation and holdout validation.");
  assertCondition(current.auditSha256 === sha256File(FILES.stage3BAudit),
    "Current Stage 3 audit SHA does not match the Stage 3B audit file.");
  checks.push("stage3b-handoff");

  return { audit, crosswalk };
}

function validate() {
  const contract = readJson(FILES.contract);
  const current = readJson(FILES.current);
  const registry = readJson(FILES.registry);
  const dependencies = {
    stage2: readJson(FILES.stage2),
    stage2Audit: readJson(FILES.stage2Audit),
    eaCalibration: readJson(FILES.eaCalibration),
    eaFreeze: readJson(FILES.eaFreeze)
  };
  const checks = [];

  validateStage3AFoundation(contract, current, registry, dependencies, checks);

  if (current.substage === "3A") {
    assertCondition(current.nextSubstage === "STAGE3B_DATA_CAPTURE_IDENTITY_AUDIT",
      "Stage 3A next substage must be data capture and identity audit.");
    assertCondition(registry.captureStatus === "PENDING_STAGE3B",
      "External football data capture must remain pending in Stage 3A.");
    assertCondition(registry.allExternalAssetsHashPinned === false,
      "Stage 3A must not falsely attest external asset hash completion.");
    checks.push("stage3a-to-stage3b-handoff");
  } else if (current.substage === "3B") {
    validateStage3B(contract, current, registry, checks);
  } else {
    throw new Error(`Unsupported Stage 3 substage for this validator: ${current.substage}`);
  }

  return {
    schemaVersion: "walters-qb-performance-stage3-validation-v1",
    status: "PASS",
    stage: 3,
    substage: current.substage,
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
