# Betting Edge Personnel Sweep — Operational Addendum

**Status:** OPERATIONAL  
**Activated:** 2026-08-25  
**Scope:** report-generation research only; no change to odds-refresh/API budget, supported books, staking, or price-freshness gates.

## Purpose

Personnel information is an input to the current handicap and fair value, not merely a confirmation check performed after value has already been decided.

Betting Edge therefore uses a **two-stage personnel-information process**:

1. a broad, fast **Material Information Scan** before provisional fair-value screening; and
2. a deeper **Personnel Sweep** on serious candidates before final status assignment.

This structure is intended to prevent two opposite errors:

- discarding a market before discovering personnel information that creates or materially changes value; and
- performing exhaustive deep research on every raw market or player prop when the board does not justify it.

An officially unconfirmed lineup, starter, batting order, goalie or participant is the beginning of the information process, not the end of it.

## Stage 1 — Material Information Scan

After live-feed/data validity, event/market/selection identity and basic executable-price eligibility have been established, but **before the provisional fair-value/value screen**, perform a current-information scan across the eligible slate where personnel could materially affect the priced market.

The Stage 1 scan is deliberately broad and efficient:

- Prefer one event/team-level scan that can inform multiple markets rather than repeating the same research for every selection.
- Check player-specific information at Stage 1 when the visible market is player-specific, when a known role/availability change is already material, or when a participant is central to the event handicap.
- Focus on information capable of materially changing the baseline: confirmed or expected absences, starters, major rotation, scratches, rest, suspensions, batting-order/role changes, starting goalie/QB/pitcher, minutes restrictions and comparable sport-specific factors.
- Use the best current information available even when the final official lineup is not yet published.

Stage 1 is **not** an exhaustive source hunt and does not itself authorize a BET. Its purpose is to prevent the provisional fair-value screen from being built on an obviously incomplete personnel baseline.

A market or selection that looked weak before Stage 1 must be admitted into the serious-candidate pool when newly identified personnel information plausibly creates or materially improves value. Betting Edge must not require a candidate to survive a pre-information value screen before personnel information is allowed to influence fair value.

## Stage 2 — Deep Personnel Sweep

After Stage 1 has informed the provisional current handicap and fair-value/value screen, perform the deeper Personnel Sweep on:

- serious candidates that remain live;
- candidates newly created or materially strengthened by Stage 1 information; and
- candidates whose apparent value materially depends on an unresolved starter, participant, role or lineup assumption.

Stage 2 must build the best currently supportable personnel picture before final `BET`, `LEAN`, `WAIT`, or `PASS` assignment.

The findings from Stage 2 must be applied back into the current handicap. Reassess fair value, uncertainty/model error and `playTo` as appropriate before final status. A final status may not simply reuse a provisional pre-sweep fair value when the deep sweep found material new information.

## Source priority

1. **Official primary sources first:** league/team/club sites, official injury or availability reports, roster/squad releases, transaction wires, probable-starter boards, game notes, and official team channels used for lineup publication.
2. **Reliable secondary confirmation:** established beat reporters, local media and reputable lineup/injury services with direct team coverage.
3. **Projected information when official confirmation is unavailable:** expected lineup, likely starter, batting position, minutes/role, rotation expectation or availability may be used only as contextual evidence when source and uncertainty are explicit.

Do not stop at `TBD`, `unconfirmed`, or `lineup not posted` when current reliable reporting can materially improve the personnel picture.

## Sport-specific minimum checks

- **Soccer:** confirmed/projected XI, key absences and suspensions, expected rotation, goalkeeper change, competition-specific rotation.
- **MLB:** confirmed/projected starting lineup and batting order, confirmed/probable opposing starter, scratches, rest days and material role changes.
- **NBA/WNBA:** active/inactive status, expected starters, material minutes/usage restrictions, rest and role changes.
- **NFL/CFB:** starting quarterback, official injury/availability status, significant skill-position or line absences, announced role changes.
- **NHL:** starting goalie, scratches and material line-combination/power-play-role changes.
- **Other sports:** equivalent starter, participant, role and availability facts that materially affect the wager.

Research depth is proportional. Stage 1 protects the breadth of the board from information blindness; Stage 2 concentrates deeper work where it can affect an actual decision. The report-card target never justifies weaker research or padded candidates.

## Personnel confidence states

Record the best-supported state of material personnel information:

- `CONFIRMED` — an authoritative current source confirms the relevant fact.
- `STRONG PROJECTION` — multiple credible current sources, or one high-quality direct source, support the expected state but it is not official.
- `PARTIAL` — some material facts are known while important components remain unresolved.
- `UNKNOWN` — material personnel information cannot be supported well enough to use.

Projected information must never be presented as confirmed.

## Decision use

1. Material unresolved starter, participant, role or lineup questions widen the uncertainty/model-error margin.
2. A nominal edge that does not comfortably clear this added uncertainty remains `WAIT` or `PASS` with zero stake.
3. A `STRONG PROJECTION` may keep a candidate alive for later review but does not satisfy a hard rule that explicitly requires official confirmation.
4. When official confirmation is a condition in `playTo` or player-prop participation/identity rules, the recommendation cannot become `BET` until confirmation exists and the executable price still passes all ordinary gates.
5. Personnel information may create, remove, strengthen or weaken apparent value, but may not override identity, freshness, exposure, staking or other hard gates.
6. Stage 1 information may create a serious candidate; Stage 2 and the normal Betting Edge gates determine whether that candidate can become actionable.

## Later-lane behavior

Every later scheduled lane must repeat the Stage 1 Material Information Scan over the remaining eligible slate so newly released personnel information can create or destroy value even in markets that were not serious candidates in the prior lane.

Within Stage 2, later lanes should prioritize unresolved `STRONG PROJECTION`, `PARTIAL` and `UNKNOWN` states for tracked `BET`, `LEAN` and `WAIT` candidates. Re-check the unresolved facts first instead of repeating the entire deep research process unless new information materially changes event context.

Any promotion or downgrade after new personnel information must also reconcile the current exact sportsbook quote and all normal Betting Edge execution gates.

## Source/timestamp capture

When personnel information materially affects a recommendation, the report/card source text must identify the source class and the date/time checked closely enough for the next lane to distinguish fresh information from an earlier projection.

The Stage 1 scan may be summarized at event level when the same fact informs several markets. Stage 2 material facts should be attributable closely enough to support later re-check and audit.

## Change note — 2026-08-25 ordering correction

The original activation wording placed the Personnel Sweep only after a candidate survived an initial value screen. That ordering could miss value created by injuries, absences, rotation or role changes because the relevant information was not guaranteed to enter fair value before screening.

The operational correction is the two-stage process above: **Material Information Scan before provisional fair value; Deep Personnel Sweep after the provisional screen; then explicit re-evaluation before final status.** No pricing-freshness, book, staking, exposure or odds-budget rule is changed by this correction.
