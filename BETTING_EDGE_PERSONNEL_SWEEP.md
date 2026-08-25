# Betting Edge Personnel Sweep — Operational Addendum

**Status:** OPERATIONAL  
**Activated:** 2026-08-25  
**Scope:** report-generation research only; no change to odds-refresh/API budget, supported books, staking, or price-freshness gates.

## Purpose

For every recommendation candidate that survives the initial event/market/selection identity, price-freshness and value screen, Betting Edge must build the best currently available personnel picture before assigning the final `BET`, `LEAN`, `WAIT`, or `PASS` status.

An officially unconfirmed lineup, starter, batting order, goalie or participant is the beginning of the personnel research step, not the end of it.

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

Research depth is proportional: candidates still live after the initial screen receive the deeper sweep; weak candidates need not receive equal work merely to fill a report-card target.

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
5. Personnel information may remove, strengthen or revalue a candidate but may not override identity, freshness, exposure, staking or other hard gates.

## Source/timestamp capture and later-lane recheck

When personnel information materially affects a recommendation, the report/card source text must identify the source class and the date/time checked closely enough for the next lane to distinguish fresh information from an earlier projection.

Later scheduled lanes must specifically re-check unresolved `STRONG PROJECTION`, `PARTIAL` and `UNKNOWN` states for tracked `BET`, `LEAN` and `WAIT` candidates. Re-check the unresolved facts first instead of repeating the entire research process unless new information materially changes event context.

Any promotion or downgrade after new personnel information must also reconcile the current exact sportsbook quote and all normal Betting Edge execution gates.
