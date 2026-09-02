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

const contract = readJson("data/walters/nfl/qb-performance/stage3-contract-v1.json");
const current = readJson("data/walters/nfl/qb-performance/stage3-current.json");
const registry = readJson("data/walters/nfl/qb-performance/source-registry-v1.json");

test("Stage 3A remains non-operational", () => {
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

test("Stage 3A cannot write production Graham artifacts", () => {
  assert.equal(contract.writeBoundary.grahamWeekFilesAllowed, false);
  assert.equal(contract.writeBoundary.grahamFairNumberWritesAllowed, false);
  assert.equal(contract.writeBoundary.personnelProductionWritesAllowed, false);
  assert.equal(contract.writeBoundary.matchupProductionWritesAllowed, false);
  assert.equal(contract.writeBoundary.uncertaintyOverlayRetirementAllowed, false);
});

test("External football data capture remains a Stage 3B task", () => {
  assert.equal(registry.captureStatus, "PENDING_STAGE3B");
  assert.equal(registry.allExternalAssetsHashPinned, false);
  assert.equal(current.dataCaptureStatus, "NOT_STARTED");
  assert.equal(current.identityAuditStatus, "NOT_STARTED");
  assert.equal(current.nextSubstage, "STAGE3B_DATA_CAPTURE_IDENTITY_AUDIT");
});

test("Production authority is reserved for Stage 5", () => {
  assert.equal(contract.authority.candidateMayMoveGrahamFair, false);
  assert.equal(contract.authority.productionTokenMayBeActivatedBeforeStage5, false);
  assert.equal(contract.authority.eventualProductionToken, "APPROVED_WALTERS_QB_PERFORMANCE");
});
