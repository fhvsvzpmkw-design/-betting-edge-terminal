# Betting Edge Operational Schedule Profile Addendum

**Status:** OPERATIONAL — SCHEDULING LAYER  
**Effective:** 2026-08-19  
**Updated:** 2026-08-29 — football primary-market coverage requirement  
**Timezone:** `America/Vancouver`  
**Betting methodology authority:** `BETTING_EDGE_CONTRACT.md` v1.0 + Core v1.4 production manifest  
**Schedule definitions:** `data/schedule-profiles.json`  
**Daily profile state:** `data/schedule-state.json`

## Scope

This addendum governs trigger timing, report-lane clock labels, seasonal pulse placement, History translation, featured VigScope checkpoints and required scheduled-sweep market coverage. It does not change Betting Edge pricing, identity, freshness, fair-value, model-error, decision, staking, risk, Research Fit, Walters authority, immutable-history or delivery rules.

The canonical slot keys remain `open`, `main`, `final_morning`, `evening` and `late`, preserving historical compatibility. Production scheduling resolves the active daily profile from `data/schedule-profiles.json` and `data/schedule-state.json` before analysis.

## Daily operating rule

One Vancouver operating day uses one profile. Once that operating day begins, its selected profile is authoritative for the entire day: **the run is the run**. No terminal interaction may change the active day's profile, pulse times or report times.

The active profile supplies exactly five primary odds pulses and five report windows. The Odds-API spending target remains five primary pulls per operating day. Every configured primary odds pulse is scheduled 10 minutes before its corresponding report window.

Profile configuration may be prepared for a future operating day. The current Preferences / Operations pane remains display-only for active-day scheduling.

## Automatic odds scheduling

Cloudflare Worker Cron remains the **primary odds scheduler**. It wakes at the configured minute marks, resolves the Vancouver-local active profile and dispatches the existing GitHub odds workflow only when that exact minute is a configured pulse. The Worker does not perform the quota-heavy odds collection itself.

Because the Cloudflare→GitHub handoff missed the 18:05 MLB pulse on 2026-08-25, `.github/workflows/odds-refresh-backstop.yml` is now an operational safety layer.

The backstop:

1. wakes two minutes after every currently configured possible seasonal pulse;
2. resolves the active Vancouver profile using the same schedule-profile logic;
3. checks whether that operating date/profile/canonical slot already published in `data/live-odds.json.scheduleMeta`;
4. does nothing when the slot is already present;
5. otherwise dispatches the existing protected `odds-refresh.yml` workflow using same-repository GitHub Actions authority.

The target odds workflow retains its serialization, profile gate, canonical-slot duplicate protection and five-primary-pull cap. The backstop therefore provides dispatch recovery without intentionally adding a second Odds-API pull for a successful slot.

`workflow_dispatch` remains available as the intentional manual recovery path. A manual pull should be used only after confirming that neither the primary dispatch nor the backstop has produced a usable fresh snapshot and that a new pull is still operationally useful.

The first live proof of the new backstop remains pending the next due slot. Cloudflare scheduler authentication/dispatch reliability remains a separate infrastructure issue to diagnose; it is not a Core v1.4 methodology issue.

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

## NFL / NCAAF primary-market coverage

Every scheduled Betting Edge report that includes an NFL or NCAAF game must treat the three standard full-game markets as independent primary candidates whenever an executable market is available:

- spread;
- moneyline;
- total.

For each covered football game, each available primary market must be independently handicapped and independently passed through the normal Betting Edge decision gates. The resulting market-level decision is independently `BET`, `LEAN`, `WAIT` or `PASS` under the existing contract/Core rules.

A decision in one market never substitutes for evaluation of another. In particular:

- a moneyline BET/LEAN/WAIT/PASS does not satisfy the spread requirement;
- a spread BET/LEAN/WAIT/PASS does not satisfy the moneyline requirement;
- neither side-market decision satisfies the total requirement;
- discovering or citing an external spread or total during matchup research is not equivalent to handicapping that market through the Betting Edge gate.

The sweep must compare the independently evaluated markets before selecting the report's meaningful cards. A game may therefore produce more than one meaningful card when separate markets independently qualify. The nine-card presentation target remains a presentation target, not a reason to suppress a stronger football market or manufacture filler.

If a normally expected primary football market cannot be evaluated because no executable market is available in the supported feed, the run should preserve that as an availability limitation rather than silently treating another market as its substitute.

This requirement applies to NFL and NCAAF games regardless of which seasonal schedule profile is active. It changes market-coverage completeness only; all existing freshness, identity, personnel, model-error, price, staking, risk, Walters and publication requirements remain authoritative.

## Canonical History translation

Clock time is profile-specific; canonical slot identity is permanent:

1. `open`
2. `main`
3. `final_morning`
4. `evening`
5. `late`

History compares equivalent canonical slots across profiles. It never rewrites actual issued timestamps, feed timestamps, report payloads, odds snapshot SHAs or archived files. Planned pulse/report times are metadata; actual timestamps remain historical truth.

New report-history/index records should retain, when available:

- `scheduleProfileId`
- `scheduleProfileLabel`
- `scheduleProfileSchema`
- `canonicalSlot`
- `scheduledPulseTime`
- `scheduledReportTime`
- `scheduledLabel`
- `featuredVigScope`

Odds snapshots use `scheduleMeta` for corresponding profile/pulse provenance. Existing automatic snapshots may identify `triggerSource: cloudflare-cron`; intentional manual refreshes identify `triggerSource: manual`. The current backstop dispatches through the scheduled target mode, so a recovered snapshot may still carry `cloudflare-cron` trigger-source text until provenance is separately refined. Do not infer scheduler origin from that field alone while this known limitation exists.

## VigScope

The active profile marks exactly three canonical slots as featured VigScope checkpoints. This does not choose or improve the VigScope state. The displayed state remains derived from actual Market Heat, Price Pressure and Market Agreement inputs. Profile metadata controls only which three daily readings receive featured checkpoint treatment in the terminal and History.

## Report automation gate

Every possible seasonal report-time trigger first resolves the active Vancouver profile. If that trigger clock is not a report time in the active profile, it exits before handicapping and before any history write.

When the trigger matches, the report must require:

- `BETTING_EDGE_CONTRACT.md` v1.0 OPERATIONAL;
- VigScope Terminal UI v1.5;
- `core/core-v1.4-production.json` Core v1.4 OPERATIONAL;
- Research Library v1.8 / R3 live read-only;
- current Walters authority mode and exact provenance;
- the normal freshness, identity, personnel, model-error, price, stake/risk and immutable-history gates;
- for NFL/NCAAF, complete independent spread + moneyline + total primary-market evaluation as specified above.

Scheduled report lanes target up to **nine meaningful cards**. Nine is a presentation/review target, not a quota: reports may contain fewer cards and zero BETs, and weak filler must not be manufactured to reach nine.

Historical report tasks and issued reports remain immutable evidence under the contract/core/research state that governed them at issuance.
