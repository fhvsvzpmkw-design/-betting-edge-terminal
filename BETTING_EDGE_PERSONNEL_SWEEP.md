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

### Stage 2 completion standard

Stage 2 is not complete merely because an official source still shows `TBD`, `unconfirmed`, `questionable`, `lineup not posted`, or an equivalent unresolved state.

When a material personnel fact remains unresolved after the official-source check, Stage 2 must perform a **fixture-specific or participant-specific fallback sweep across 3 to 5 distinct credible current fallback sources, in addition to the official-source check, where those sources are available**.

This 3-to-5-source fallback standard is **sport-wide**. It applies whenever material personnel information remains unresolved in soccer, college football, NFL, NHL, NBA, WNBA, MLB and any other supported sport where personnel can materially affect the wager.

The fallback sweep must:

- search the exact event, team or participant rather than relying only on generic league/team pages;
- seek expected or projected lineups, likely starters, injuries, suspensions, scratches, rotation, rest, role, batting position, minutes/usage, goalkeeper/QB/pitcher status and other facts material to the wager;
- prefer genuinely independent source origins rather than duplicated syndication, mirrors or five pages repeating the same report;
- include local/beat reporting, reputable competition-focused reporting, established lineup/injury services and high-quality projected-lineup sources when useful;
- continue beyond the first useful secondary source when additional credible sources can materially strengthen, contradict or refine the personnel picture;
- use **3 strong independent fallback sources as the minimum target**, and continue toward **4 or 5** when sources disagree, information is stale/ambiguous, the projection remains weak, or the personnel question could materially create, remove or flip an actionable edge;
- never add weak, stale or anonymous sources merely to reach the source-count target.

If fewer than 3 credible current fallback sources can be found after a reasonable event-specific search, Stage 2 must record the source shortfall rather than pretending the search was complete. The personnel state should remain appropriately `PARTIAL` or `UNKNOWN` unless the available evidence is strong enough to support another state.

A Stage 2 record should distinguish **no information exists yet** from **information was not searched deeply enough**. At minimum, material Stage 2 work must retain the official source checked, the fallback sources checked, the check time, the personnel confidence state, the material facts found, and the unresolved facts that remain.

### Universal Stage 2 closing authoritative re-check

For reports issued at or after **2026-09-02 11:15:00 America/Vancouver**, Stage 2 has one universal closing rule across sports:

> **If a personnel-dependent serious candidate still has a material unresolved dependency, re-check the best authoritative source for that exact dependency once near the end of Stage 2 before assigning `BET`, `LEAN`, `WAIT`, or `PASS`.**

The closing re-check is required because release practices differ by sport and league, while the analytical need is the same. The publisher does not need a separate fixed late-game clock for each sport.

- The authoritative source may legitimately still say `TBD`, `unconfirmed`, `questionable`, `lineup not posted`, inactive list not released, or equivalent. The rule requires a real closing check, not forced confirmation.
- Record the closing check in the existing `officialSources` evidence with a traceable `origin`, `url`, `asOf`, a dependency-specific `fact`, and `finalRecheck: true`.
- The closing source must actually address the unresolved dependency. A generic league injury page cannot satisfy an unresolved batting-order question merely because it is authoritative.
- One event/team-level closing check may support several recommendations when it genuinely addresses the same exact dependency; do not repeat identical searches merely because multiple cards share the dependency.
- If the authoritative source genuinely cannot be reached or no authoritative channel exists for that dependency, record that exact authoritative-source shortfall in the existing `sourceShortfall` field and retain an appropriately uncertain `PARTIAL` or `UNKNOWN` state rather than fabricating a check.
- If `decisionSensitivity` is explicitly `NO MATERIAL PERSONNEL SENSITIVITY`, a redundant closing re-check is not required for a dependency that is no longer material to the decision.

The sport-specific time windows below remain **research-urgency and fallback-depth guidance**. They help Stage 2 know when projected lineups, inactive information, goalie news, minutes limits or other late facts deserve extra attention. They no longer define separate publisher-specific final-recheck cutoffs; the universal closing rule above governs that final proof step.

### Stage 2 dependency validation safeguard

Before the deep source hunt, Stage 2 must identify the **actual personnel dependency of the exact wager** and verify that the dependency is oriented to the correct team, opponent, participant and role.

The research target may not be assumed from the event alone. Stage 2 must state why the personnel fact can materially affect the exact market/selection being handicapped.

Examples:

- an MLB hitter prop depends on the hitter's own participation/batting position **and the opposing pitcher**, not the hitter's own-team pitcher;
- an MLB pitcher prop depends on that pitcher's role/workload and the opposing batting order;
- an NFL/CFB receiver prop may depend on the receiver's own role/QB status and material opposing coverage/secondary personnel;
- an NHL scorer/shot prop may depend on the player's own line/PP role and the opposing goalie/defensive matchup;
- an NBA/WNBA player prop may depend on the player's active/minutes/starting role and teammate absences that materially change usage or assists/rebounds opportunities;
- a soccer side/total/player market must identify which starting-XI, goalkeeper, striker, creator, defender or rotation facts actually affect that specific handicap.

If Stage 2 discovers that the initial dependency target was wrong, incomplete or pointed at the wrong side of the matchup, it must correct the dependency **before finalizing the research**, repeat the relevant source search against the correct dependency where necessary, and reapply the corrected information to the handicap. A wrong dependency may not be preserved merely because it appeared in an earlier lane or card.

### Source-conflict and decision-sensitivity safeguard

Stage 2 must evaluate whether the credible current sources **converge or conflict** on each material personnel fact.

- Record source conflict as `NONE`, `MINOR`, or `MATERIAL`, with the material disagreement summarized when present.
- A `STRONG PROJECTION` may not be assigned while a **material unresolved source conflict** remains. It may be used only when higher-quality, more direct or more current evidence clearly resolves the disagreement and the resolution rationale is recorded.
- When credible sources disagree and no clear quality/recency hierarchy resolves them, preserve `PARTIAL` or `UNKNOWN`, widen uncertainty/model error, and continue toward the 4-to-5-source end of the fallback range when useful.
- Do not average incompatible personnel claims into a false consensus.

For every personnel-dependent serious candidate, Stage 2 must also record **decision sensitivity**: the specific plausible personnel outcome or outcomes that would materially change fair value, uncertainty, `playTo`, or final status.

Examples include `QB OUT -> PASS`, `STARTING GOALIE CONFIRMED -> REPRICE`, `PLAYER STARTS WITHOUT MINUTES LIMIT -> EDGE REMAINS`, or `FULL-STRENGTH XI -> DRAW EDGE GONE`.

If no plausible remaining personnel outcome would materially change the decision, record `NO MATERIAL PERSONNEL SENSITIVITY`. Later lanes should prioritize the unresolved facts named in decision sensitivity rather than repeating unrelated research.

### Major-sport Stage 2 search depth and timing

Time to game increases the required urgency, not the permission to stop early. The exact release pattern differs by sport, so Stage 2 must seek the information that is normally meaningful for that sport rather than applying a soccer-only lineup model.

#### Soccer

For a soccer candidate that reaches Stage 2, explicitly seek:

- confirmed or projected XI for both sides;
- injuries, suspensions and key absences;
- expected rotation and competition-specific squad changes;
- goalkeeper changes;
- role/status of any player specifically material to the handicap;
- credible local/team news that may not yet appear on the official lineup page.

Timing:

- **More than 2 hours before kickoff:** use the best available projections and team news; official confirmation may reasonably be unavailable.
- **Within 2 hours of kickoff:** treat projected XI, local/team reporting and material role news as high-priority Stage 2 inputs.
- **Within 90 minutes of kickoff:** if the official XI is still unavailable, the 3-to-5-source fallback sweep is mandatory for a personnel-dependent serious candidate unless fewer credible sources genuinely exist and the shortfall is recorded.
- **Within 75 minutes of kickoff:** re-check the authoritative lineup source once near the end of Stage 2 before final status assignment when lineup confirmation remains a material blocker.

#### College football and NFL

For a college-football or NFL candidate that reaches Stage 2, explicitly seek:

- starting quarterback status and credible backup expectation;
- official injury/availability designation and game-status changes;
- major offensive-line absences or reshuffles;
- material skill-position absences, snap/role changes and depth-chart movement;
- defensive front, secondary or other unit absences that materially change the matchup;
- suspensions, late scratches, travel/disciplinary absences and credible pregame reports;
- local beat/practice reporting when the official designation does not resolve expected participation or workload.

Timing:

- **Game day:** current official injury/availability information, depth-chart context and credible local/beat reporting are mandatory Stage 2 inputs for personnel-dependent serious candidates.
- **Within 3 hours of kickoff:** unresolved QB, major-line, key-skill or other material availability questions require the 3-to-5-source fallback sweep unless a source shortfall is recorded.
- **Inside the normal pregame inactive/availability window:** re-check the authoritative league/team status source before final assignment when the unresolved player is material. For NFL this includes the official inactive release; for college football use the best authoritative team/conference availability channel because release practices vary.

#### NHL

For an NHL candidate that reaches Stage 2, explicitly seek:

- confirmed or strongly projected starting goalie for both teams;
- morning-skate participation and line rushes;
- scratches, late injury status and rest decisions;
- material line-combination changes;
- power-play-unit and top-six/top-four role changes when relevant;
- credible beat/team reporting when official status is incomplete.

Timing:

- **Game day:** goalie expectation, morning-skate information and key injury/scratch context are mandatory Stage 2 inputs where material.
- **Within 4 hours of puck drop:** unresolved starting-goalie or key-player questions on a serious candidate require the 3-to-5-source fallback sweep unless a source shortfall is recorded.
- **Within 90 minutes of puck drop:** re-check current goalie, scratch and lineup/line-combination reporting when those facts remain material to the wager.

#### NBA and WNBA

For an NBA or WNBA candidate that reaches Stage 2, explicitly seek:

- official injury-report status and active/inactive information;
- expected starters;
- credible minutes limits or workload restrictions;
- rest management and back-to-back decisions;
- usage/role changes caused by absences;
- shootaround/practice participation and credible coach/beat reporting;
- late scratches and lineup changes, especially for player props.

Timing:

- **Game day:** the current official injury report plus credible team/beat context are mandatory Stage 2 inputs for personnel-dependent serious candidates.
- **Within 3 hours of tipoff:** unresolved participation, starting-role or material minutes questions require the 3-to-5-source fallback sweep unless a source shortfall is recorded.
- **Within 90 minutes of tipoff:** re-check active/inactive status, expected starters and material minutes/role reporting.
- **Near the final starting-lineup window:** if a player-specific market still depends on an unresolved starter/role assumption, re-check the authoritative or highest-quality current lineup source before final assignment.

#### MLB

For an MLB candidate that reaches Stage 2, explicitly seek:

- confirmed or projected starting lineup and batting order;
- confirmed/probable opposing starter and any opener/bullpen-game indication;
- scratches, rest days and late role changes;
- platoon expectation and material batting-order movement;
- credible beat/team reporting when the official lineup or starter board remains incomplete.

Timing:

- **More than 3 hours before first pitch:** use credible lineup projections, starter information and team/beat context; official batting order may reasonably be unavailable.
- **Within 2 hours of first pitch:** unresolved lineup, batting-order or opposing-starter questions on a serious candidate require the 3-to-5-source fallback sweep unless a source shortfall is recorded.
- **Within 90 minutes of first pitch:** re-check the authoritative lineup/starter source when confirmation remains material, especially for player props.

These timing rules do not create extra scheduled report lanes and do not trigger additional Odds-API requests. They govern the depth of personnel research performed inside the current report lane.

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
- `STRONG PROJECTION` — multiple credible current sources, or one high-quality direct source, support the expected state but it is not official and no material unresolved source conflict remains.
- `PARTIAL` — some material facts are known while important components remain unresolved or materially conflicting.
- `UNKNOWN` — material personnel information cannot be supported well enough to use.

Projected information must never be presented as confirmed.

## Decision use

1. Material unresolved starter, participant, role or lineup questions widen the uncertainty/model-error margin.
2. A nominal edge that does not comfortably clear this added uncertainty remains `WAIT` or `PASS` with zero stake.
3. A `STRONG PROJECTION` may keep a candidate alive for later review but does not satisfy a hard rule that explicitly requires official confirmation.
4. When official confirmation is a condition in `playTo` or player-prop participation/identity rules, the recommendation cannot become `BET` until confirmation exists and the executable price still passes all ordinary gates.
5. Personnel information may create, remove, strengthen or weaken apparent value, but may not override identity, freshness, exposure, staking or other hard gates.
6. Stage 1 information may create a serious candidate; Stage 2 and the normal Betting Edge gates determine whether that candidate can become actionable.
7. For material Stage 2 work, retain the pre-sweep fair-value/uncertainty state and the post-sweep fair-value/uncertainty state. If no material change results, record `NO MATERIAL CHANGE`; do not silently carry the provisional number forward without showing that Stage 2 was applied.
8. A final decision may not rely on a personnel fact until the dependency-validation safeguard establishes why that fact is relevant to the exact wager.
9. Material unresolved source conflict must be reflected in the personnel state and uncertainty margin; it may not be hidden behind a consensus label.
10. Decision sensitivity must identify which unresolved personnel outcome could still alter the recommendation, or explicitly state that none remains material.

## Later-lane behavior

Every later scheduled lane must repeat the Stage 1 Material Information Scan over the remaining eligible slate so newly released personnel information can create or destroy value even in markets that were not serious candidates in the prior lane.

Within Stage 2, later lanes should prioritize unresolved `STRONG PROJECTION`, `PARTIAL` and `UNKNOWN` states for tracked `BET`, `LEAN` and `WAIT` candidates. Re-check the unresolved facts and decision-sensitivity triggers first instead of repeating the entire deep research process unless new information materially changes event context.

Any promotion or downgrade after new personnel information must also reconcile the current exact sportsbook quote and all normal Betting Edge execution gates.

## Source/timestamp capture

When personnel information materially affects a recommendation, the report/card source text must identify the source class and the date/time checked closely enough for the next lane to distinguish fresh information from an earlier projection.

The Stage 1 scan may be summarized at event level when the same fact informs several markets. Stage 2 material facts should be attributable closely enough to support later re-check and audit.

For new reports, structured Stage 2 evidence belongs in the durable report provenance sidecar rather than bloating the runner card. For a personnel-dependent serious candidate, retain enough structured evidence to show:

- `stage2CheckedAt`;
- the validated `dependencyTarget` and why it is material to the exact wager;
- authoritative/official sources checked;
- the closing authoritative source entry with `finalRecheck: true` when a material dependency remained unresolved at Stage 2 close, or an explicit authoritative `sourceShortfall`;
- 3 to 5 distinct fallback sources when the official state remained unresolved and credible fallback sources were available;
- any `sourceShortfall` when fewer than 3 credible fallback sources existed;
- material `facts` found;
- `personnelState` (`CONFIRMED`, `STRONG PROJECTION`, `PARTIAL`, or `UNKNOWN`);
- material `sourceConflict` and any conflict-resolution rationale;
- material `unresolved` facts;
- `decisionSensitivity` identifying the personnel outcome that could still change the recommendation, or `NO MATERIAL PERSONNEL SENSITIVITY`;
- pre-Stage-2 and post-Stage-2 fair-value/uncertainty state; and
- the resulting decision impact, including `NO MATERIAL CHANGE` when appropriate.

The source-count rule measures distinct credible source origins, not the number of URLs opened.

## Change note — 2026-08-25 ordering correction

The original activation wording placed the Personnel Sweep only after a candidate survived an initial value screen. That ordering could miss value created by injuries, absences, rotation or role changes because the relevant information was not guaranteed to enter fair value before screening.

The operational correction is the two-stage process above: **Material Information Scan before provisional fair value; Deep Personnel Sweep after the provisional screen; then explicit re-evaluation before final status.** No pricing-freshness, book, staking, exposure or odds-budget rule is changed by this correction.

## Change note — 2026-08-25 Stage 2 depth correction

Stage 2 now requires an event-specific 3-to-5-source fallback sweep when official material personnel information remains unresolved and credible fallback sources are available. The rule is sport-wide, with explicit search targets and time-to-game escalation for soccer, college football, NFL, NHL, NBA, WNBA and MLB. Material Stage 2 work must be recorded in provenance so `TBD` cannot function as an undocumented stopping point.

## Change note — 2026-08-25 Stage 2 safeguard correction

Stage 2 now validates the causal personnel dependency of the exact wager before deep research, corrects wrong-side or wrong-participant dependencies, treats unresolved material source conflict as a confidence/uncertainty constraint, and records decision sensitivity so later lanes know which personnel outcome could actually change the recommendation.

## Change note — 2026-09-02 universal closing re-check

The prior sport-specific late-source reminders remain useful research timing guidance, but production publication now uses one cross-sport closing rule: every still-material unresolved Stage 2 dependency receives one final dependency-specific authoritative-source re-check before final status, recorded with `finalRecheck: true`, or a truthful authoritative-source shortfall. This closes the football inactive/availability enforcement mismatch without inventing a universal football clock or changing any betting threshold.
