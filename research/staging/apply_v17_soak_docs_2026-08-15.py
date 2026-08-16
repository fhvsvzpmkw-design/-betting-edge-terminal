#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[2]
roadmap = root / "docs" / "ROADMAP.md"
state = root / "docs" / "PROJECT_STATE.md"

r = roadmap.read_text(encoding="utf-8")
r = r.replace("**Last updated:** 2026-08-15 — after v0.9 production promotion", "**Last updated:** 2026-08-15 — v1.8 candidate frozen; v1.7 production soak active")
anchor = "- Research Library **1.7** is canonical and read-only.\n"
insert = anchor + "- Research Library **1.8** promotion candidate is fully built/tested in staging only: 120 logical items, 100 source records, 26 evidence clusters; Candidate Freeze R2 24/24, narrative tests 15/15, hard-boundary tests 9/9.\n- v1.8 promotion is explicitly **ON HOLD** while production v1.7 completes an operational soak and shadow comparison period.\n"
if "v1.8 promotion candidate is fully built/tested" not in r:
    r = r.replace(anchor, insert)

p0_anchor = "### P0.6 — Trace any remaining `UNCATEGORIZED` output\n"
soak = """### P0.7 — Complete v1.7 History Fit soak before any v1.8 promotion\n\nProduction Research Library **v1.7** remains the runtime authority. The completed v1.8 candidate stays frozen in staging.\n\nMinimum gate before reopening promotion:\n\n1. observe at least one complete five-lane production day on v1.7;\n2. review real History Fit retrieval relevance, grade reasonableness, explanation quality, NR handling and deduplication;\n3. shadow-compare v1.8 against the same real candidates without changing issued reports;\n4. confirm no R3 hard-boundary regression;\n5. require explicit promotion approval.\n\nThe frozen v1.8 candidate may be used for shadow evaluation only. It must not alter fair value, play-to, status, model error, stake, executable price, runner output, production manifest or scheduled-report authority.\n\n"""
if "### P0.7 — Complete v1.7 History Fit soak" not in r:
    # place after P0.6 block, before Priority 1
    r = r.replace("## Priority 1 — History and learning evidence", soak + "## Priority 1 — History and learning evidence")
roadmap.write_text(r, encoding="utf-8")

s = state.read_text(encoding="utf-8")
s = s.replace("**Last updated:** 2026-08-15 — v0.9 production promotion", "**Last updated:** 2026-08-15 — v1.8 candidate ready; promotion held for v1.7 soak")
research_anchor = "- Library: **Betting Edge Research Library 1.7**.\n"
research_insert = research_anchor + "- **Production runtime authority remains v1.7** during the soak period.\n- A complete **v1.8 promotion candidate exists in staging only**: 120 logical items, 100 source records and 26 evidence clusters.\n- Candidate Freeze R2 structural inventory passed **24/24**; frozen History Fit narrative tests passed **15/15**; hard-boundary tests passed **9/9**.\n- v1.8 promotion is explicitly **ON HOLD** pending v1.7 operational soak, same-candidate shadow comparisons and later explicit approval.\n- v1.8 shadow output may be compared with live v1.7 History Fit but may not modify any issued report, fair value, play-to, status, model error, stake or executable price.\n"
if "complete **v1.8 promotion candidate exists in staging only**" not in s:
    s = s.replace(research_anchor, research_insert)

next_stage_old = "- Next stage: `VERIFY_FIRST_POST_CUTOVER_LANE`.\n"
next_stage_new = "- Next stage: `V1_7_PRODUCTION_SOAK_WITH_V1_8_SHADOW_COMPARISON`.\n"
s = s.replace(next_stage_old, next_stage_new)

rtrack_old = "- **R-track:** R3 — live read-only History Fit with durable sidecar provenance; Evening/Late live acceptance passed.\n"
rtrack_new = "- **R-track:** R3 — live read-only History Fit on production v1.7 with durable sidecar provenance; v1.8 is frozen staging-only pending soak/shadow comparison and explicit promotion approval.\n"
s = s.replace(rtrack_old, rtrack_new)

boundary_anchor = "- Do not couple Research Library **writes** to normal report runs.\n"
boundary_insert = boundary_anchor + "- Do not promote Research Library v1.8 merely because the staging validation package is green; complete the v1.7 soak/shadow gate and obtain explicit promotion approval first.\n"
if "Do not promote Research Library v1.8 merely because" not in s:
    s = s.replace(boundary_anchor, boundary_insert)

state.write_text(s, encoding="utf-8")
