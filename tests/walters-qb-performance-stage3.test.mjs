import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(TEST_PATH), "..");

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function sha256File(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolute(relativePath))).digest("hex");
}

const contract = readJson("data/walters/nfl/qb-performance/stage3-contract-v1.json");
const current = readJson("data/walters/nfl/qb-performance/stage3-current.json");
const registry = readJson("data/walters/nfl/qb-performance/source-registry-v1.json");

test("Stage 3 remains non-operational", () => {
  assert.equal(contract.operational, false);
  assert.equal(contract.productionAuthority, false);
  assert.equal(current.operational, false);
  assert.equal(current.productionAuthority, false);
  assert.equal(current.grahamWritesAllowed, false);
  assert.equal(current.uncertaintyOverlayRetirementAllowed, false);
});

test("EA-derived quarterback values remain a prior only", () => {
  assert.equal(contract.prior.role, "SHRINKAGE_PRIOR_ONLY");
  assert.equal(contract.prior.directLiveUseAllowed, false);
  assert.equal(contract.prior.mayResolveQbUncertaintyByItself, false);
  assert.equal(contract.prior.mayMoveGrahamFairByItself, false);
});

test("Walters-named performance families are represented", () => {
  const ids = contract.evidence.performanceFeatures.map((feature) => feature.id).sort();
  assert.deepEqual(ids, [
    "fumble_rate",
    "interception_rate",
    "passer_rating",
    "qb_rushing_value",
    "sack_rate",
    "yards_per_attempt"
  ]);
});

test("Attempts and dropbacks measure reliability, not performance points", () => {
  const features = new Map(
    contract.evidence.reliabilityFeatures.map((feature) => [feature.id, feature])
  );
  for (const id of ["attempts", "dropbacks"]) {
    assert.equal(features.get(id)?.role, "RELIABILITY_ONLY");
    assert.equal(features.get(id)?.directPerformancePointsAllowed, false);
  }
});

test("Supporting cast cannot be double-counted as another spread addend", () => {
  const context = contract.evidence.contextFeatures.find(
    (feature) => feature.id === "supporting_offense_context"
  );
  assert.equal(context?.role, "CONFIDENCE_AND_INTERPRETATION_ONLY");
  assert.equal(context?.directSpreadAddendAllowed, false);
  assert.equal(context?.doubleCountProtectionRequired, true);
});

test("Market-derived sources and targets are prohibited", () => {
  assert.equal(contract.marketViewed, false);
  assert.equal(registry.marketSourcesAllowed, false);
  assert.equal(contract.sourcePolicy.marketSourcesAllowed, false);
  assert.equal(contract.candidateWindowSearchSpace.selectionMayUseMarketOrClosingLine, false);
  assert.ok(contract.sourcePolicy.prohibitedEvidence.includes("PINNACLE"));
  assert.ok(contract.sourcePolicy.prohibitedEvidence.includes("MARKET_IMPLIED_QB_VALUE"));
});

test("Stage 3A locks the search space but not the weights", () => {
  assert.equal(contract.candidateWindowSearchSpace.preOutcomeLocked, true);
  assert.deepEqual(contract.candidateWindowSearchSpace.longTermCompletedSeasons, [2, 3, 4]);
  assert.deepEqual(contract.candidateWindowSearchSpace.shortTermQualifiedGames, [4, 6, 8]);
  assert.equal(contract.modelDiscipline.weightsStatus, "UNESTIMATED_LOCKED_OFF");
  assert.equal(current.weightsStatus, "UNESTIMATED_LOCKED_OFF");
});

test("Stage 3 cannot write production Graham artifacts", () => {
  assert.equal(contract.writeBoundary.grahamWeekFilesAllowed, false);
  assert.equal(contract.writeBoundary.grahamFairNumberWritesAllowed, false);
  assert.equal(contract.writeBoundary.personnelProductionWritesAllowed, false);
  assert.equal(contract.writeBoundary.matchupProductionWritesAllowed, false);
  assert.equal(contract.writeBoundary.uncertaintyOverlayRetirementAllowed, false);
});

test("Production authority is reserved for Stage 5", () => {
  assert.equal(contract.authority.candidateMayMoveGrahamFair, false);
  assert.equal(contract.authority.productionTokenMayBeActivatedBeforeStage5, false);
  assert.equal(contract.authority.eventualProductionToken, "APPROVED_WALTERS_QB_PERFORMANCE");
});

if (current.substage === "3A") {
  test("Stage 3A hands off to external data capture and identity audit", () => {
    assert.equal(registry.captureStatus, "PENDING_STAGE3B");
    assert.equal(registry.allExternalAssetsHashPinned, false);
    assert.equal(current.dataCaptureStatus, "NOT_STARTED");
    assert.equal(current.identityAuditStatus, "NOT_STARTED");
    assert.equal(current.nextSubstage, "STAGE3B_DATA_CAPTURE_IDENTITY_AUDIT");
  });
}

if (current.substage === "3B") {
  const stage3B = readJson("data/walters/nfl/qb-performance/stage3b-contract-v1.json");
  const manifest = readJson("data/walters/nfl/qb-performance/source/source-manifest-v1.json");
  const audit = readJson("data/walters/nfl/qb-performance/stage3b-audit-v1.json");
  const crosswalk = readJson("data/walters/nfl/qb-performance/identity-crosswalk-v1.json");

  test("Stage 3B capture window and source population are locked", () => {
    assert.deepEqual(stage3B.captureWindow.seasons, [2021, 2022, 2023, 2024, 2025]);
    assert.equal(stage3B.captureWindow.gameType, "REG");
    assert.ok(stage3B.captureWindow.excludedSeasons.includes(2020));
    assert.equal(manifest.status, "SOURCE_ASSETS_HASH_LOCKED");
    assert.equal(manifest.assetCount, 11);
    assert.equal(manifest.allComputedHashesVerified, true);
    assert.equal(manifest.marketViewed, false);
  });

  test("Every locked raw asset exists and matches both hashes", () => {
    for (const asset of manifest.assets) {
      assert.equal(fs.existsSync(absolute(asset.rawPath)), true, asset.rawPath);
      assert.equal(sha256File(asset.rawPath), asset.computedSha256, asset.assetName);
      assert.equal(asset.upstreamDigest, `sha256:${asset.computedSha256}`, asset.assetName);
      assert.equal(fs.statSync(absolute(asset.rawPath)).size, asset.byteSize, asset.assetName);
    }
  });

  test("Stage 3B resolves the complete current EA QB identity population", () => {
    assert.equal(crosswalk.status, "PASS");
    assert.equal(crosswalk.top67DistributionCohortCount, 67);
    assert.equal(crosswalk.blockedIdentityCount, 0);
    assert.equal(crosswalk.duplicateGsisAssignmentCount, 0);
    assert.equal(crosswalk.players.length, crosswalk.currentEaNflTeamQbCount);
    assert.ok(crosswalk.currentEaNflTeamQbCount >= 67);
  });

  test("Stage 3B weekly and seasonal counting evidence reconciles exactly", () => {
    assert.equal(audit.status, "PASS");
    assert.equal(audit.weeklySeasonalCrosscheck.state, "PASS");
    assert.equal(audit.weeklySeasonalCrosscheck.mismatchCount, 0);
    assert.ok(audit.weeklySeasonalCrosscheck.comparedPlayerSeasons > 0);
  });

  test("Normalized Stage 3B files are non-empty, hash verified and market isolated", () => {
    for (const output of [audit.weeklyNormalized, audit.seasonalNormalized]) {
      assert.equal(fs.existsSync(absolute(output.path)), true, output.path);
      assert.equal(sha256File(output.path), output.sha256, output.path);
      assert.ok(output.rowCount > 0, output.path);
    }
    assert.equal(sha256File(audit.identityCrosswalk.path), audit.identityCrosswalk.sha256);
    assert.deepEqual(audit.forbiddenOutputFields, []);
    assert.equal(audit.marketViewed, false);
  });

  test("Stage 3B produces evidence only, not QB values or Graham changes", () => {
    assert.equal(audit.weightsEstimated, false);
    assert.equal(audit.candidateQbValuesCreated, false);
    assert.equal(audit.grahamFairNumbersChanged, false);
    assert.equal(audit.uncertaintyOverlaysRetired, false);
    assert.equal(audit.productionAuthority, false);
    assert.equal(audit.protectedArtifactsUnchanged, true);
    assert.equal(current.candidateOutputStatus, "NOT_CREATED");
    assert.equal(current.grahamWritesAllowed, false);
  });

  test("Stage 3B hands off only to Stage 3C", () => {
    assert.equal(current.status, stage3B.acceptance.passState);
    assert.equal(current.dataCaptureStatus, "PASS_HASH_LOCKED");
    assert.equal(current.identityAuditStatus, "PASS");
    assert.equal(current.seasonalCrosscheckStatus, "PASS");
    assert.equal(current.nextSubstage, stage3B.acceptance.nextSubstageOnPass);
    assert.equal(current.auditSha256, sha256File("data/walters/nfl/qb-performance/stage3b-audit-v1.json"));
  });
}
