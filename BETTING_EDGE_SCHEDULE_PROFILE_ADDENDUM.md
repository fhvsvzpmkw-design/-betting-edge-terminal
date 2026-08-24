# Betting Edge Operational Schedule Profile Addendum

**Status:** OPERATIONAL — SCHEDULING LAYER  
**Effective:** 2026-08-19  
**Updated:** 2026-08-24 — Cloudflare scheduler cutover / 10-minute odds lead  
**Timezone:** `America/Vancouver`  
**Betting methodology authority:** `BETTING_EDGE_CONTRACT.md` v1.0  
**Schedule definitions:** `data/schedule-profiles.json`  
**Daily profile state:** `data/schedule-state.json`

## Scope

This addendum changes **trigger timing, report-lane clock labels, seasonal pulse placement, History translation and featured Vig Scope checkpoints only**. It does not change Betting Edge pricing, identity, freshness, fair-value, decision, staking, risk, Research Fit, immutable-history or delivery gates.

The fixed lane times listed in Section 5 of `BETTING_EDGE_CONTRACT.md` are the legacy MLB/Summer operating schedule. Production scheduling resolves the active daily profile from `data/schedule-profiles.json` and `data/schedule-state.json` before analysis. The canonical slot keys remain `open`, `main`, `final_morning`, `evening`, and `late`, preserving historical compatibility.

## Daily operating rule

One Vancouver operating day uses one profile. Once that operating day begins, its selected profile is authoritative for the entire day: **the run is the run**. No terminal interaction may change the active day's profile, pulse times or report times.

The active profile supplies exactly five primary odds pulses and five report windows. The Odds-API spending target remains five primary pulls per operating day. Every primary odds pulse is scheduled **10 minutes before its corresponding report window**.

Cloudflare Worker Cron is the primary timing layer during cutover. It wakes only at minute marks `:05`, `:20` and `:50`, resolves the Vancouver-local active profile, and dispatches the existing GitHub odds workflow only when that exact minute is a configured pulse. The Worker does not perform the quota-heavy odds collection itself.

GitHub cron remains temporarily enabled as a fallback. Its UTC wake coverage is deliberately placed about five minutes after the corresponding Cloudflare pulse across PDT and PST. If Cloudflare has already produced the slot, the canonical-slot duplicate gate exits before another Odds-API request. Once Cloudflare scheduling has demonstrated stable production operation, the fallback cron layer can be removed without changing the five canonical slots or report times.

Profile configuration may be prepared outside the live terminal for a future operating day. The current Preferences / Operations pane is deliberately **display-only** for active-day scheduling. It may show the active profile, pulse/report pairs, seasonal reference profiles, featured Vig Scope checkpoints and History translation, but it does not change the already-active operating day.

## Active profile timing

### MLB / Summer

- 05:50 odds → 06:00 report
- 07:50 odds → 08:00 report
- 09:20 odds → 09:30 report
- 15:05 odds → 15:15 report
- 18:05 odds → 18:15 report

### NFL / Football

- 05:50 odds → 06:00 report
- 07:50 odds → 08:00 report
- 08:50 odds → 09:00 report
- 12:05 odds → 12:15 report
- 16:50 odds → 17:00 report

### NBA + NHL / Winter

- 05:50 odds → 06:00 report
- 10:50 odds → 11:00 report
- 13:50 odds → 14:00 report
- 15:50 odds → 16:00 report
- 17:50 odds → 18:00 report

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

Odds snapshots use `scheduleMeta` for the corresponding profile/pulse provenance and identify the trigger source when available (`cloudflare-cron`, `github-cron`, or `manual`).

## Vig Scope

The active profile marks exactly three canonical slots as featured Vig Scope checkpoints. This **does not choose or improve the Vig Scope state**. The displayed state must still be derived from the actual Market Heat, Price Pressure and Market Agreement inputs. Profile metadata controls only which three daily readings receive featured checkpoint treatment in the terminal and History.

## Report automation gate

Every possible seasonal report-time trigger must first resolve the active Vancouver profile. If that trigger clock is not a report time in the active profile, it exits before handicapping and before any history write. If it matches, the report uses the profile's canonical slot key, current planned label/time and featured-Vig metadata while obeying the full **Contract v1.0** production rules.

All enabled report automations must therefore verify **Contract v1.0 OPERATIONAL** and the current approved runner boundary **VigScope UI v1.5 / Betting Edge core v1.3** before handicapping. Historical report tasks and issued reports remain immutable evidence under the contract version that governed them at issuance.
