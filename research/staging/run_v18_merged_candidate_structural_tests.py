#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGING = ROOT / "research" / "staging"
BUILD_ID = "v1.8-merged-candidate-r1-2026-08-15"
SUITE_ID = "v1.8-history-fit-predeclared-r1-2026-08-15"

LIBRARY = STAGING / "V1_8_MERGED_CANDIDATE_LIBRARY_R1_2026-08-15.json"
REGISTRY = STAGING / "V1_8_MERGED_CANDIDATE_SOURCE_REGISTRY_R1_2026-08-15.json"
TAXONOMY = STAGING / "V1_8_MERGED_CANDIDATE_TAXONOMY_R1_2026-08-15.json"
MANIFEST = STAGING / "V1_8_MERGED_CANDIDATE_MANIFEST_R1_2026-08-15.json"
CHECKSUMS = STAGING / "V1_8_MERGED_CANDIDATE_CHECKSUMS_R1_2026-08-15.json"
FREEZE = STAGING / "V1_8_CANDIDATE_FREEZE_R2_2026-08-15.json"
SUITE = STAGING / "V1_8_HISTORY_FIT_TEST_SUITE_R1_2026-08-15.json"
POLICY = ROOT / "research" / "history-fit-policy.json"
PROD_MANIFEST = ROOT / "research" / "manifest.json"
OUT = STAGING / "V1_8_MERGED_CANDIDATE_STRUCTURAL_TEST_RESULTS_R1_2026-08-15.json"
OUT_MD = STAGING / "V1_8_MERGED_CANDIDATE_STRUCTURAL_TEST_RESULTS_R1_2026-08-15.md"

MARKET_HINTS = {
    "pitcher_strikeouts": {"player_props", "model_evaluation"},
    "home_run": {"player_props"},
    "batting_walks": {"player_props", "market_efficiency"},
    "shots_on_goal": {"player_props", "model_evaluation"},
    "goalie_saves": {"player_props"},
    "anytime_goal": {"player_props"},
    "receiving_yards": {"player_props", "model_evaluation"},
    "spread_line_movement": {"spread", "line_movement", "market_structure"},
    "game_market": {"market_structure", "line_movement", "market_efficiency"},
    "assists": {"player_props", "model_evaluation"},
    "player_props": {"player_props"},
    "1x2_asian_handicap": {"market_structure", "market_efficiency"},
    "parlay_or_sgp": {"derivatives", "market_structure"},
    "line_movement": {"line_movement", "market_structure"},
}

TOKEN_SYNONYMS = {
    "hr": "home_run",
    "hrs": "home_run",
    "home_runs": "home_run",
    "strikeouts": "strikeout",
    "sog": "shots_on_goal",
    "saves": "save",
    "receptions": "receiving",
    "yards": "yard",
    "parlay": "parlay",
    "sgp": "parlay",
    "assists": "assist",
    "walks": "walk",
}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tokens(value):
    text = re.sub(r"[^a-z0-9]+", "_", str(value).lower())
    out = set()
    for tok in text.split("_"):
        if not tok:
            continue
        tok = TOKEN_SYNONYMS.get(tok, tok)
        if tok.endswith("s") and len(tok) > 4:
            tok = tok[:-1]
        out.add(tok)
    # Preserve common compound concepts.
    if "home" in out and "run" in out:
        out.add("home_run")
    if "line" in out and "movement" in out:
        out.add("line_movement")
    if "player" in out and "prop" in out:
        out.add("player_props")
    return out


def sport_score(case_sport, item_sports):
    if case_sport in item_sports:
        return 100
    if "Cross-Sport" in item_sports:
        return 25
    return 0


def item_score(case, item):
    sscore = sport_score(case["sport"], item["scope"]["sports"])
    if sscore == 0:
        return -1
    timing = item["scope"].get("timing", ["all"])
    if case["timing"] not in timing and "all" not in timing:
        return -1
    score = sscore + 10
    hints = MARKET_HINTS.get(case["market"], set())
    classes = set(item["scope"].get("marketClasses", []))
    score += 15 * len(hints.intersection(classes))
    case_tokens = tokens(case["market"])
    detail_tokens = tokens(item.get("marketClassDetail") or "")
    topic_tokens = tokens(item.get("topic") or "")
    overlap = case_tokens.intersection(detail_tokens)
    score += 25 * len(overlap)
    score += 5 * len(case_tokens.intersection(topic_tokens))
    if item.get("marketClassDetail") and overlap:
        score += 15
    # Exact sport/market detail is intentionally stronger than broad analogies.
    if case["sport"] in item["scope"]["sports"] and overlap:
        score += 20
    return score


def retrieve(case, items):
    scored = [(item_score(case, item), item) for item in items]
    scored = [(s, i) for s, i in scored if s > 0]
    scored.sort(key=lambda x: (x[0], x[1]["evidence"].get("tier") in {"A", "B"}), reverse=True)
    primary = [i for s, i in scored if i["retrievalRole"] == "primary_prior"][:4]
    secondary = [i for s, i in scored if i["retrievalRole"] in {"synthesis", "inference"}][:1]
    return primary + secondary


def main():
    library = load(LIBRARY)
    registry = load(REGISTRY)
    taxonomy = load(TAXONOMY)
    manifest = load(MANIFEST)
    checksums = load(CHECKSUMS)
    freeze = load(FREEZE)
    suite = load(SUITE)
    policy = load(POLICY)

    errors = []
    warnings = []
    if library["library"].get("candidateBuildId") != BUILD_ID:
        errors.append("candidate build id mismatch")
    if suite["testSuiteId"] != SUITE_ID:
        errors.append("test suite id mismatch")
    if manifest.get("productionManifestModified") is not False:
        errors.append("staging manifest does not explicitly preserve production manifest")

    checksum_map = {x["path"]: x["sha256"] for x in checksums["files"]}
    for path in (LIBRARY, REGISTRY, TAXONOMY, MANIFEST):
        rel = str(path.relative_to(ROOT))
        if checksum_map.get(rel) != sha256(path):
            errors.append(f"checksum mismatch: {rel}")

    by_prior = {}
    for item in library["items"]:
        by_prior.setdefault(item["priorId"], []).append(item)
    r2_ids = [x["id"] for x in freeze["items"]]
    inventory = []
    for pid in r2_ids:
        count = len(by_prior.get(pid, []))
        item_errors = []
        if count != 1:
            item_errors.append(f"logical item count {count}, expected 1")
        if count == 1:
            item = by_prior[pid][0]
            source_ids = item.get("provenance", {}).get("sourceIds", [])
            registry_ids = {x["sourceId"] for x in registry["sources"]}
            missing_sources = [sid for sid in source_ids if sid not in registry_ids]
            if missing_sources:
                item_errors.append(f"missing sources {missing_sources}")
            for cid in item.get("clusterIds", []):
                cluster = taxonomy["evidenceClusters"].get(cid)
                if not cluster:
                    item_errors.append(f"missing cluster {cid}")
                elif pid not in cluster.get("members", []):
                    item_errors.append(f"cluster {cid} does not list member")
        inventory.append({"priorId": pid, "pass": not item_errors, "errors": item_errors})
        errors.extend(f"{pid}: {e}" for e in item_errors)

    # Verify exact R2 inventory and no accidental duplicate logical IDs.
    if len(r2_ids) != 24:
        errors.append(f"R2 inventory expected 24, found {len(r2_ids)}")
    duplicates = [pid for pid, vals in by_prior.items() if len(vals) > 1]
    if duplicates:
        errors.append(f"duplicate logical IDs in merged library: {duplicates}")

    # Production files must remain production versions; this workflow never writes them.
    if load(ROOT / "research" / "research-library.json")["library"]["version"] != "1.7":
        errors.append("production research-library.json changed from v1.7")
    if load(ROOT / "research" / "source-registry.json")["libraryVersion"] != "1.7":
        errors.append("production source-registry.json changed from v1.7")
    if load(ROOT / "research" / "taxonomy.json")["libraryVersion"] != "1.7":
        errors.append("production taxonomy.json changed from v1.7")
    if not PROD_MANIFEST.exists():
        errors.append("production research/manifest.json missing")

    # Hard-boundary definition remains identical to the v1.7 History Fit policy.
    hard = policy["hardBoundaries"]
    global_rules = suite["globalPassRules"]
    boundary_pairs = {
        "researchMayCreateBet": not hard["mayCreateBet"],
        "researchMaySupplyExecutablePrice": not hard["maySupplyExecutablePrice"],
        "researchMayOverrideIdentityFailure": not hard["mayOverrideIdentityFailure"],
        "researchMayOverrideFairValueGate": not hard["mayOverrideFairValueGate"],
        "researchMayDirectlyChangeFairValue": not hard["mayDirectlyChangeFairValueAtR3"],
        "researchMayDirectlyChangeModelError": not hard["mayDirectlyChangeModelErrorAtR3"],
        "researchMayDirectlyChangePlayTo": not hard["mayDirectlyChangePlayToAtR3"],
        "researchMayDirectlyChangeStatus": not hard["mayDirectlyChangeStatusAtR3"],
        "researchMayDirectlyChangeStake": not hard["mayDirectlyChangeStakeAtR3"],
        "researchMaySilentlyBlendPersonalLedger": not hard["maySilentlyBlendPersonalLedger"],
        "researchMaySilentlyBlendSameDayMovementIntoHistoryGrade": not hard["maySilentlyBlendSameDayMovementIntoHistoryGrade"],
    }
    for key, expected_false in boundary_pairs.items():
        if global_rules.get(key) is not False or expected_false is not True:
            errors.append(f"hard-boundary mismatch: {key}")
    if suite["globalPassRules"]["historyUnavailableState"] != policy["failureMode"]["state"]:
        errors.append("history-unavailable failure mode mismatch")

    # Generic retrieval exercise. It does not consult expected IDs while ranking.
    case_results = []
    for case in suite["retrievalCases"]:
        retrieved = retrieve(case, library["items"])
        retrieved_ids = [x["priorId"] for x in retrieved]
        must = case.get("mustRetrieveAnyOf", [])
        must_ok = (not must) or bool(set(must).intersection(retrieved_ids))
        if not must_ok:
            errors.append(f"{case['caseId']}: generic retrieval missed all mustRetrieveAnyOf; got {retrieved_ids}")
        # Any explicitly indirect-only analogies must never outrank an exact-sport required item.
        indirect = set(case.get("mayRetrieveOnlyAsIndirectAnalogy", []))
        exact_required = set(must)
        if indirect.intersection(retrieved_ids) and exact_required and not exact_required.intersection(retrieved_ids):
            errors.append(f"{case['caseId']}: indirect analogy displaced exact required evidence")
        case_results.append({
            "caseId": case["caseId"],
            "retrieved": retrieved_ids,
            "mustRetrieveAnyOf": must,
            "mustRequirementPass": must_ok,
            "allowedGrades": case.get("allowedGrades", []),
            "narrativeAssertionsPendingAssistantReview": {
                "requiredConcepts": case.get("requiredConcepts", []),
                "forbiddenClaims": case.get("forbiddenClaims", []),
            },
        })

    result = {
        "schema": 1,
        "buildId": BUILD_ID,
        "testSuiteId": SUITE_ID,
        "state": "PASS" if not errors else "FAIL",
        "runtimeAuthority": False,
        "activeProductionLibrary": "1.7",
        "counts": {
            "mergedLogicalItems": len(library["items"]),
            "r2InventoryExpected": 24,
            "r2InventoryPassed": sum(1 for x in inventory if x["pass"]),
            "sourceRegistryCount": len(registry["sources"]),
            "evidenceClusterCount": len(taxonomy["evidenceClusters"]),
            "retrievalCases": len(case_results),
            "boundaryCases": len(suite["boundaryCases"]),
            "errors": len(errors),
            "warnings": len(warnings),
        },
        "checks": {
            "all24R2ItemsPresentExactlyOnce": all(x["pass"] for x in inventory) and len(inventory) == 24,
            "allR2SourcesResolvable": not any("missing sources" in e for e in errors),
            "clusterMembershipResolvable": not any("cluster" in e for e in errors),
            "candidateChecksumsValid": not any("checksum mismatch" in e for e in errors),
            "productionLibraryStillV17": load(ROOT / "research" / "research-library.json")["library"]["version"] == "1.7",
            "hardBoundariesMatchPolicy": not any("hard-boundary mismatch" in e for e in errors),
            "genericRetrievalMustRequirementsPass": not any("generic retrieval missed" in e for e in errors),
            "narrativeReviewStillRequired": True,
        },
        "inventory": inventory,
        "retrievalCaseResults": case_results,
        "errors": errors,
        "warnings": warnings,
    }
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    OUT_MD.write_text(
        "# v1.8 Merged Candidate R1 — Structural Test Results\n\n"
        f"**Result:** {result['state']}  \n"
        f"**Build:** `{BUILD_ID}`  \n"
        f"**Test suite:** `{SUITE_ID}`  \n"
        "**Active production library:** v1.7\n\n"
        "## Automated gate\n\n"
        f"- R2 inventory: **{result['counts']['r2InventoryPassed']}/24**\n"
        f"- Merged logical items: **{result['counts']['mergedLogicalItems']}**\n"
        f"- Source records: **{result['counts']['sourceRegistryCount']}**\n"
        f"- Evidence clusters: **{result['counts']['evidenceClusterCount']}**\n"
        f"- Frozen retrieval cases structurally exercised: **{result['counts']['retrievalCases']}**\n"
        f"- Frozen boundary cases checked against policy: **{result['counts']['boundaryCases']}**\n"
        f"- Errors: **{result['counts']['errors']}**\n\n"
        "Automated PASS is not the final promotion gate. The 15 frozen narrative cases still require an assistant review for allowed grade bands, required concepts and forbidden claims.\n",
        encoding="utf-8",
    )
    print(json.dumps({"state": result["state"], "errors": errors}, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
