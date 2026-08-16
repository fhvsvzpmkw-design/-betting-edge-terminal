# Betting Edge v0.9 Production Acceptance — 2026-08-15

**Status:** ACCEPTED FOR PRODUCTION PROMOTION  
**Acceptance window:** 15:15 EVENING + 18:15 LATE / WEST COAST, America/Vancouver  
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Branch:** `main`  
**Runner:** Betting Edge Terminal v1.3  
**Preflight source:** `BETTING_EDGE_V0.9_PREFLIGHT_2026-08-15.md`

This record closes the activation hold defined by the v0.9 preflight. It records acceptance of the live Evening/Late sequence and authorizes the explicit v0.9 production promotion approved by the user on 2026-08-15.

---

## Acceptance evidence

### 15:15 issued run

- Indexed in `run-history.json`.
- Exact issued payload stored at `data/history/runs/2026-08-15/evening-152124.json`.
- Matching Research Fit/provenance sidecar stored at `data/history/research-fit/2026-08-15/evening-152124.json`.
- Same-day report was subsequently available to the 18:15 session navigation/history layer.

### 18:15 issued run

- Slot: `late`.
- Label: `18:15 LATE / WEST COAST`.
- Issued timestamp: `2026-08-15T18:21:00-07:00`.
- Feed timestamp: `2026-08-16T01:05:44.182Z` (18:05:44 PT).
- Bankroll: `$450.10`.
- New risk: `$0`.
- Counts: `0 BET / 0 LEAN / 0 WAIT / 5 PASS`.
- Exact issued payload stored at `data/history/runs/2026-08-15/late-182100.json`.
- Issued payload Git blob SHA at acceptance: `4456bfb5fab4dce4d3ce5508fa55e63bb47d148f`.
- Matching sidecar stored at `data/history/research-fit/2026-08-15/late-182100.json`.
- Sidecar Git blob SHA at acceptance: `73e5225575a3c71127ec3d4a64ba81f6a2ee662f`.
- `run-history.json` contains the corresponding `late` entry.
- Runner v1.3 blob recorded by the sidecar: `b8ea86b1f232191947974c034ead87954f7aab5b`.
- Compact resolver `r.html` blob at acceptance: `29c1a92d510a10e3f16d597369fdcf8f048992d9`.
- Deterministic short ID for the accepted Late run: `260815l182100`.

---

## Pre-activation checklist closure

1. **Fresh valid odds snapshot:** PASS. The issued run records the 18:05 PT feed for an 18:21 PT report, inside inherited freshness limits.
2. **Current runner renders normally:** PASS. Live user acceptance screenshots showed normal v1.3 rendering after the meter-only UI patch.
3. **Stake/risk reconciliation:** PASS. Zero BETs, all non-BET stakes zero, total new risk `$0`.
4. **Player-prop structured identity:** PASS / NOT EXERCISED BY THIS RUN. No player prop was displayed in the five accepted recommendations; the staged player-prop gate remains active for future player props.
5. **Exact issued payload archive:** PASS. `late-182100.json` exists and matches the issued content inspected in the runner.
6. **Matching Research Fit/provenance sidecar:** PASS. `late-182100.json` sidecar exists with matching slot, timestamp, report path and feed timestamp.
7. **Correct `run-history.json` entry:** PASS. The Late run is indexed with correct path, counts, risk, sidecar and feed provenance.
8. **Resolving compact short-link path:** PASS. The accepted report was opened in the live runner and the deterministic resolver/index architecture is present; short ID is `260815l182100`.
9. **Long fallback equivalence:** PASS BY CONSTRUCTION + LIVE CONTENT CHECK. The scheduled lane generated the fallback from the validated payload object before archive publication; the stored issued payload and displayed active content agree.
10. **Source-backed Evening lineage:** PASS. The 18:15 report referenced the actual stored 15:15 report for earlier Phillies/Brewers state rather than reconstructing it from memory.
11. **Same-day Evening navigation hydration:** PASS. The user opened 15:15 from the 18:15 report-history/session interface.
12. **Different-date exclusion:** PASS BY RESOLVER RULE. `r.html` restricts hydrated prior runs to the active Vancouver date and validates timestamp/slot/feed provenance before hydration.
13. **History/share isolation from betting decision:** PASS. History/archive operations did not create a bet, alter the five recommendations, change risk, or suppress report delivery.

---

## Reprice regression check

After the 18:15 report loaded, `UPDATE ODDS / REPRICE NOW` was exercised. The runner correctly returned `NO NEWER ODDS SNAPSHOT` because the latest published odds snapshot was not newer than the report feed. The issued report remained unchanged. This confirms the current reprice path remains an overlay and does not mutate decision-time history.

---

## Acceptance decision

The preflight activation hold is closed.

**Approved next action:** promote v0.9 to the authoritative production contract, update all five scheduled report lanes to resolve and obey that production contract before handicapping, record production-contract provenance in new sidecars, preserve the v0.8/v0.9 draft artifacts as historical design records, and verify the first post-cutover scheduled lane.

The richer lower History-box UI remains outside this cutover.
