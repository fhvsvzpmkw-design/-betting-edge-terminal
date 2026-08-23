# Betting Edge Operational Schedule Profile Addendum

**Status:** OPERATIONAL — SCHEDULING LAYER  
**Effective:** 2026-08-19  
**Updated:** 2026-08-22 — Contract v1.0 / VigScope UI v1.5 version consolidation  
**Timezone:** `America/Vancouver`  
**Betting methodology authority:** `BETTING_EDGE_CONTRACT.md` v1.0  
**Schedule definitions:** `data/schedule-profiles.json`  
**Daily profile state:** `data/schedule-state.json`

## Scope

This addendum changes **trigger timing, report-lane clock labels, seasonal pulse placement, History translation and featured Vig Scope checkpoints only**. It does not change Betting Edge pricing, identity, freshness, fair-value, decision, staking, risk, Research Fit, immutable-history or delivery gates.

The fixed lane times listed in Section 5 of `BETTING_EDGE_CONTRACT.md` are the legacy MLB/Summer operating schedule. Production scheduling resolves the active daily profile from `data/schedule-profiles.json` and `data/schedule-state.json` before analysis. The canonical slot keys remain `open`, `main`, `final_morning`, `evening`, and `late`, preserving historical compatibility.

## Daily operating rule

One Vancouver operating day uses one profile. Once that operating day begins, its selected profile is authoritative for the entire day: **the run is the run**. No terminal interaction may change the active day's profile, pulse times or report times.

The active profile supplies exactly five primary odds pulses and five report windows. The Odds-API spending target remains five primary pulls per operating day. Extra GitHub cron wake-ups used for DST/profile coverage must exit before the Odds API is called unless they match the active Vancouver-local profile slot.

Profile configuration may be prepared outside the live terminal for a future operating day. The current Preferences / Operations pane is deliberately **display-only** for active-day scheduling. It may show the active profile, pulse/report pairs, seasonal reference profiles, featured Vig Scope checkpoints and History translation, but it does not change the already-active operating day.

## Canonical History translation

Clock time is profile-specific; canonical slot identity is permanent:

1. `open`
2. `main`
3. `final_morning`
4. `evening`
5. `late`

History compares equivalent canonical slots across different daily profiles. It never rewrites actual issued timestamps, actual feed timestamps, report payloads, odds snapshot SHAs or archived files. Planned pulse/report times are schedule metadata; actual timestamps remain historical truth.

New report-history/index records should retain, when available:

- `scheduleProfileId`
- `scheduleProfileLabel`
- `scheduleProfileSchema`
- `canonicalSlot`
- `scheduledPulseTime`
- `scheduledReportTime`
- `scheduledLabel`
- `featuredVigScope`

Odds snapshots use `scheduleMeta` for the corresponding profile/pulse provenance.

## Vig Scope

The active profile marks exactly three canonical slots as featured Vig Scope checkpoints. This **does not choose or improve the Vig Scope state**. The displayed state must still be derived from the actual Market Heat, Price Pressure and Market Agreement inputs. Profile metadata controls only which three daily readings receive featured checkpoint treatment in the terminal and History.

## Report automation gate

Every possible seasonal report-time trigger must first resolve the active Vancouver profile. If that trigger clock is not a report time in the active profile, it exits before handicapping and before any history write. If it matches, the report uses the profile's canonical slot key, current planned label/time and featured-Vig metadata while obeying the full **Contract v1.0** production rules.

All enabled report automations must therefore verify **Contract v1.0 OPERATIONAL** and the current approved runner boundary **VigScope UI v1.5 / Betting Edge core v1.3** before handicapping. Historical report tasks and issued reports remain immutable evidence under the contract version that governed them at issuance.
