# Betting Edge Governance & Report-Generation Contract — v1.0

**Document status:** OPERATIONAL — AUTHORITATIVE PRODUCTION CONTRACT  
**Contract version:** 1.0  
**Activated:** 2026-08-22  
**Promotion basis:** consolidation of the final operational v0.9 rule set; no new staking, risk, freshness, execution-book or odds-budget gate is introduced by this promotion  
**Supersedes production contract:** v0.9 final blob `59d8dda8d8e491255d5792329a9446eb01960a34`  
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Authoritative branch:** `main`  
**Production filename:** `BETTING_EDGE_CONTRACT.md`  
**Validated runner family:** VigScope outer runner v1.5 / Betting Edge core runner v1.3  
**Promotion acceptance:** `BETTING_EDGE_V1.0_ACCEPTANCE_2026-08-22.md`

> **THIS FILE IS OPERATIONAL.**
>
> Every production Betting Edge scheduled report must resolve this file from the authoritative repository/branch before handicapping, verify that it declares version `1.0` and `OPERATIONAL`, resolve the current approved runner, and obey this contract as governing authority. If production-contract or runner authority cannot be resolved, stop before analysis and surface `PREFLIGHT BLOCK — ANALYSIS NOT STARTED`.

---

# 1. Contract composition and precedence

v1.0 is the deliberate production consolidation of the final operational v0.9 contract. It preserves the validated v0.8 execution baseline, the v0.9 durable-history/provenance delta, the v0.9 player-prop identity delta, and the production clarifications already operating before this promotion, including fair-value benchmark confidence labeling, spread-lineage reconciliation, PRICE WATCH informational metadata and the repository-controlled report-card target.

The following exact historical design artifacts remain incorporated into this production contract by reference:

1. `BETTING_EDGE_CONTRACT_DRAFT_v0.8.md` — Git blob `7c4780aba635a6f8d1ccc38e45e8a780b94ae1e4` — inherited execution, pricing, risk, payload, Research Library and report-generation baseline.
2. `BETTING_EDGE_CONTRACT_DRAFT_v0.9.md` — Git blob `0e2eacb9e8209c9d99113381a5e11258f20f664e` — durable issued-report history, provenance, short-link delivery, H-track and same-day lineage delta.
3. `BETTING_EDGE_CONTRACT_DRAFT_v0.9_PLAYER_PROP_DELTA.md` — Git blob `444e10329c3e74c584f641cfc1fbb8d3326ab909` — executable player-prop identity tightening.

Those files remain historical artifacts and are not independently operational. Their rules become operational only through this production contract.

Conflict precedence is:

1. explicit wording in this production file;
2. incorporated player-prop delta;
3. incorporated v0.9 durable-history/provenance delta;
4. incorporated v0.8 baseline.

Draft-status language such as `DRAFT`, `NOT YET OPERATIONAL`, proposed/future activation wording, or activation holds in the incorporated artifacts is superseded by this file and is not imported as an operational restriction.

The v0.9 draft statement that runner payload shape is wholly unchanged remains clarified as follows:

> Core visible recommendation fields and runner behavior remain compatible; player-specific props may additionally carry the existing runner-supported `rec.feed` structured identity object required for exact issuance, durable-history integrity and exact repricing.

No inherited v0.8 or final-v0.9 execution safeguard is weakened by the v1.0 promotion.

---

# 2. Governing operating principle

Betting Edge minimizes variability in execution without minimizing variability in analysis.

> **Hard-code the guardrails; keep the handicapper adaptive.**

The system continues to separate:

- **hard gates** — binary requirements that analytical enthusiasm cannot override;
- **decision framework** — structured market/matchup/evidence judgment;
- **discovery space** — new metrics, sources, timing and methods that require separate promotion before becoming hard rules.

When evidence or layers conflict, inherited precedence remains:

1. data validity;
2. event / market / selection identity;
3. executable-price freshness;
4. fair-value availability;
5. exposure and staking constraints;
6. analytical judgment;
7. secondary expert/context signals.

---

# 3. Production preflight — mandatory before handicapping

Every scheduled lane must perform this sequence before analysis:

1. resolve `BETTING_EDGE_CONTRACT.md` from `fhvsvzpmkw-design/-betting-edge-terminal` branch `main`;
2. verify `Document status` is operational and `Contract version` is `1.0`;
3. retain the exact production-contract Git blob SHA for durable provenance;
4. resolve the current approved `runner.html` in the same repository context and verify the expected production runner family/version;
5. only then read and validate the live odds feed and begin handicapping.

If steps 1-4 cannot be completed or authority conflicts, stop with:

`PREFLIGHT BLOCK — ANALYSIS NOT STARTED`

A preflight failure must not be converted into a betting opinion.

---

# 4. Inherited execution and pricing gates

The full incorporated v0.8 baseline remains operational. The following high-value gates are reiterated because they are production critical:

- Live odds source: `data/live-odds.json` from the authoritative repository path, with an approved fallback route only when the primary read fails.
- Feed freshness: maximum **75 minutes**, measured as `run.ts - feed.generatedAt`.
- Exact executable sportsbook quote freshness: maximum **30 minutes**, measured as `feed.generatedAt - market.updatedAt`. Do **not** substitute report issuance time (`run.ts`) for `feed.generatedAt` when evaluating the 30-minute quote-age gate.
- A report-generation or lineage check must use the exact odds snapshot bound to that report. Prefer the report provenance `feedBlobSha` when available; `data/live-odds.json` is valid for the check only when its `generatedAt` exactly matches the report's `feedGeneratedAt`.
- Primary supported user pricing books: **Bet365** and **DraftKings**.
- Exact event, market and selection identity precedes price use. When an archived recommendation carries `selectionKey`, a current row is the same exact selection only when the same event, market, side and `selectionKey` all match; a matching numeric handicap without the archived `selectionKey` is not sufficient to bypass lineage reconciliation.
- For the current Odds-API.io spread schema, row `hdp` is the **home-side handicap**. The bettor-facing home line equals `hdp`; the bettor-facing away line is the opposite sign. Example: raw `hdp: -11.5` means home `-11.5` and away `+11.5`.
- Fair-value work must exist before a BET can be issued.
- Every recommendation includes `playTo` or an explicit non-action threshold state.
- `BET`, `LEAN`, `WAIT`, and `PASS` semantics remain distinct.
- Only `BET` may carry a non-zero stake.
- `LEAN`, `WAIT`, and `PASS` carry zero stake.
- Total new risk equals the sum of BET stakes only.
- Zero BETs is a valid output.
- Routine risk remains conservative and subject to the inherited exposure controls; no production promotion increases risk tolerance.
- Immediately before serialization, `run.ts` must be freshly generated in `America/Vancouver` and must agree with the intended report date and feed-date integrity rules.
- Payloads must be serialized with a real JSON serializer, parse successfully, Base64URL round-trip successfully, and satisfy status/stake/risk/count/timestamp/identity invariants before delivery.
- A failed hard gate cannot be overridden by matchup confidence, market narrative, expert opinion, historical fit or user-history fit.

Equal-price deterministic sportsbook behavior and all inherited `playTo`, risk and fair-value rules remain unchanged.

## 4.1 Fair-value benchmark confidence and labeling

Fair value must distinguish the source and strength of the estimate rather than presenting every de-vigged number as an equally strong independent handicap.

1. A price derived primarily by removing sportsbook margin is a **market-derived no-vig fair benchmark**. It is not, by itself, an independently modeled true price.
2. An **independent fair value** requires material matchup/model work that is meaningfully separate from the quoted sportsbook pair or consensus being evaluated.
3. When the available benchmark is single-book, two-book, thin-market, lower-liquidity, stale-near-boundary, or materially book-disagreed, analytical confidence must be reduced and the uncertainty/model-error margin widened rather than treating a small apparent edge as precise.
4. Large disagreement between supported books is evidence of uncertainty or price-quality risk unless additional independent evidence resolves the conflict. A one-book outlier may not be promoted to BET merely because its de-vigged comparison appears positive.
5. Three-way markets must account for the draw and total market margin before describing an underdog price as value. The resulting de-vigged price remains a market benchmark unless independent fair-value work also exists.
6. A single-book paired-market no-vig estimate may support PASS/WAIT analysis, but it is weaker than a multi-book/sharp benchmark and must not be described as equally robust.
7. Recommendation text should use wording such as `market-derived fair`, `no-vig benchmark`, or `independent fair` when the distinction is material. Do not imply model precision that the evidence does not support.
8. On thin or weakly calibrated competitions, a small positive market-derived edge is not a near-BET by default. It must still clear uncertainty, model-error, identity, freshness and multiple-independent-signal requirements.
9. These rules clarify confidence and presentation only. They do not loosen existing BET thresholds, freshness requirements, `playTo`, staking, or risk controls.

---

# 5. Report lanes and live-feed schedule boundary

Standard production report lanes remain:

- `06:00 OPEN / OVERNIGHT` — slot `open`;
- `08:00 MAIN` — slot `main`;
- `09:30 FINAL MORNING` — slot `final_morning`;
- `15:15 EVENING` — slot `evening`;
- `18:15 LATE / WEST COAST` — slot `late`.

The report schedule itself is unchanged by v1.0. The odds-refresh workflow remains operationally separate from this contract promotion. v1.0 does not increase Odds-API request volume or alter the production refresh budget.

## 5.1 Repository-controlled recommendation-card target

Before final recommendation selection for each scheduled lane, resolve `data/preferences.json` from the same authoritative `main` branch and locate the module with `id: "report_card_target"`.

The module's `current` value is the production **soft target** for the number of recommendation cards in that report. Allowed profiles are `7`, `9`, and `12`. The current repository setting is **9 cards**.

The target governs report breadth only:

1. Do **not** pad the report with weak, redundant or unqualified recommendations merely to reach the target. Fewer than the target is valid when the board does not support more useful cards.
2. `overflowProtection` must remain `true`. A tracked or actionable `BET`, `LEAN`, or `WAIT` may not be dropped merely to enforce the target. A current qualifying `BET` may never be suppressed by the card target. The report may therefore exceed the target.
3. All ordinary identity, freshness, fair-value, information, uncertainty, status and staking gates remain unchanged. Raising the target does not lower recommendation quality or BET standards.
4. The target does not increase odds-refresh/API usage and does not require additional feed pulls.
5. F6 may display this repository-controlled value while remaining non-editable until user-selectable report-card profiles are deliberately activated.
6. If `data/preferences.json` or the module is temporarily unreadable or invalid, use **9** as the fallback soft target for this contract version and continue the report; this presentation/breadth setting is not a betting-safety preflight blocker.

---

# 6. Controlled decision / comparison language

Decision status, analytical reason and odds-comparison state must remain distinct.

Production vocabulary includes:

- `VALUE CONFIRMED` — current validated price qualifies;
- `VALUE IMPROVED` — better current price still qualifies;
- `VALUE HOLDS` — changed current price remains inside `playTo`;
- `EDGE GONE` — only when the same validated market/selection previously had a documented qualifying BET or LEAN edge and now no longer qualifies;
- `PASS / NO VALUE` — current price exists but the selection did not previously qualify or does not qualify now without a documented lost edge;
- `PRICE MOVED` — verified current sportsbook odds moved beyond `playTo`, or the same spread remains but its juice changes materially;
- `LINE MOVED IN FAVOR` — a tracked same-side spread has moved to a numerically greater handicap for the bettor;
- `LINE MOVED AGAINST` — a tracked same-side spread has moved to a numerically smaller handicap for the bettor;
- `FAIR VALUE CHANGED` — updated analysis/fair value, not sportsbook movement, removed a prior qualifying edge;
- `MARKET UNAVAILABLE` — exact market confirmed absent after any required spread-lineage reconciliation;
- `PRICE NOT VERIFIED` — exact feed quote cannot be confidently retrieved/matched;
- `LINEUP/INFORMATION PENDING` — material input unresolved;
- `CONFLICTING SIGNALS` — evidence materially disagrees;
- `FEED STALE` — freshness gate fails;
- `POLICY BLOCK` — governance gate prevents action;
- `EVENT STARTED/CLOSED` — pregame betting window ended;
- `DUPLICATE EXPOSURE` — correlated exposure blocks additional risk;
- `IDENTITY MISMATCH` — event/player/market/selection identity cannot be validated.

`EDGE GONE` is not a generic PASS label. `UNRESOLVED` is a technical state, not an analytical verdict.

## 6.1 Spread-lineage reconciliation when a tracked spread disappears

When a later scheduled lane has a same-day tracked spread from an archived Betting Edge lane and the exact prior spread/handicap no longer appears as a fresh executable row, the report must reconcile the current line before using `MARKET UNAVAILABLE` or removing that recommendation from the board.

1. Resolve the archived prior recommendation under the source-backed same-day lineage rule. Preserve its exact event identity, side/team, prior handicap, `selectionKey`, sportsbook price, status, fair value and `playTo` as historical reference.
2. Using only the exact already-fetched odds snapshot bound to the current report, inspect the current primary spread for the **same event and same side** at Bet365 and DraftKings. Resolve that snapshot by report `feedBlobSha` when available; use `data/live-odds.json` only when its `generatedAt` exactly matches the report's `feedGeneratedAt`. Apply the normal 75-minute feed gate and the 30-minute executable-quote gate defined in Section 4. This reconciliation must **not** trigger an additional Odds-API request or refresh solely because the old handicap disappeared.
3. For spread-lineage purposes, inspect only the newest fresh canonical market with `marketKey: spread` for each supported book. Do not use `alternative-spread` or other alternate-spread markets to establish the current primary line. If the provider supplies a unique explicit primary/main marker on a canonical spread row, use it. Otherwise define the market-center row as the canonical spread row whose home/away prices have the smallest absolute difference in implied probability. If more than one distinct handicap ties for that best market-center score, do not break the tie heuristically; fail closed as `PRICE NOT VERIFIED` or `CONFLICTING SIGNALS`.
4. If a fresh current spread exists for that same side, compare its bettor-facing numeric handicap with the archived bettor-facing handicap. Apply the home/away `hdp` orientation rule in Section 4 before comparing:
   - `LINE MOVED IN FAVOR` when the current same-side handicap is numerically greater. Examples: `+10.5 -> +11.5` and `-3.5 -> -2.5`.
   - `LINE MOVED AGAINST` when the current same-side handicap is numerically smaller. Examples: `+10.5 -> +9.5` and `-3.5 -> -4.5`.
   - `PRICE MOVED` when the handicap is unchanged but the executable price/juice changed.
5. If fresh supported books show different current primary spreads, preserve the book-specific lines/prices and use `CONFLICTING SIGNALS` or cautious `PRICE NOT VERIFIED` as appropriate. Do not invent a consensus line.
6. Use `MARKET UNAVAILABLE` only when no fresh current spread for the same event and same side can be found after this reconciliation. Use `PRICE NOT VERIFIED` when candidate rows exist but identity, primary-line resolution or freshness cannot be validated.
7. Preserve the tracked spread recommendation on the current pregame report instead of silently dropping it. Its movement text should show the archived line and the reconciled current line, or state why the current line is unavailable/unverified.
8. A changed handicap is a **new current selection**, not an exact reprice of the archived selection. Prior fair value, `playTo`, BET/LEAN status or stake does not automatically transfer. The current line must independently satisfy all ordinary identity, freshness, fair-value and staking gates before action; otherwise stake remains zero.
9. This reconciliation is a report-generation continuity check only. It does not redesign the runner, change staking methodology, alter the supported execution books, or authorize additional odds pulls.

---

# 7. Mandatory first-review Personnel Sweep

Before a candidate can receive its final `BET`, `LEAN`, `WAIT`, or `PASS` decision in a scheduled lane, the handicapper must build the best currently available personnel picture for that event or player. The absence of an officially confirmed starting lineup is the beginning of this research step, not the end of it.

This Personnel Sweep is a report-generation research requirement. It is deliberately separate from the odds-refresh workflow and must not trigger additional Odds-API requests.

## 7.1 Research priority

For every candidate that survives the initial identity, freshness and value screen, research personnel/context in this order:

1. **Official primary sources first:** league, club/team, official injury report, official roster/squad release, transaction wire, probable-starter board, official game notes and official team channels used for lineup publication.
2. **Reliable secondary confirmation:** established beat reporters, local media and reputable lineup/injury services with direct team coverage.
3. **Projected information when confirmation is unavailable:** expected lineup, likely starter, likely batting position, probable minutes/role, rotation expectation or likely availability may be used as contextual evidence only when its source and uncertainty are explicit.

Do not stop at `TBD`, `unconfirmed` or `lineup not posted` when reliable current information can establish a materially better expected personnel picture.

## 7.2 Required sport-specific questions

The Personnel Sweep should answer the materially relevant questions for the candidate, including at minimum:

- **Soccer:** confirmed or projected XI, key absences/suspensions, expected rotation, goalkeeper changes and competition-specific squad rotation.
- **MLB:** confirmed or projected starting lineup and batting order, confirmed/probable opposing starter, scratches, rest days and role changes affecting the prop or side.
- **NBA/WNBA:** active/inactive status, expected starters, material minutes/usage restrictions, rest and role changes.
- **NFL/CFB:** starting quarterback, official injury/availability status, significant skill-position or line absences and announced role changes.
- **NHL:** starting goalie, scratches, significant line-combination or power-play-role changes when material.
- **Other sports:** identify the equivalent participation, starter, role or availability facts that materially affect the wager.

The sweep should remain proportional. Deep personnel research is required for candidates that remain live after the initial screen; weak candidates need not receive equal research depth merely to fill the card target.

## 7.3 Personnel confidence states

Record the best-supported state for material personnel information:

- `CONFIRMED` — authoritative current source confirms the relevant lineup/starter/availability fact.
- `STRONG PROJECTION` — multiple credible current sources, or one high-quality direct source, support the expected personnel state but it is not yet official.
- `PARTIAL` — some material personnel facts are known but important components remain unresolved.
- `UNKNOWN` — material personnel information cannot be supported well enough to use.

Projected information must never be presented as confirmed. A strong projection can reduce uncertainty in the handicap, but it cannot satisfy a contract rule that specifically requires official confirmation.

## 7.4 Decision use and fail-closed behavior

Personnel findings are part of the handicap and must be reflected in uncertainty, fair-value confidence and recommendation status.

1. A material unresolved starter, participant, role or lineup question must widen the uncertainty/model-error margin.
2. A nominal edge that does not comfortably clear that added uncertainty remains `WAIT` or `PASS` with zero stake.
3. A `STRONG PROJECTION` may keep a candidate alive for later review but may not be silently treated as `CONFIRMED`.
4. When official confirmation is a hard execution condition in `playTo` or the player-prop identity/participation rules, the recommendation cannot become `BET` until that condition is actually confirmed and the executable price remains valid.
5. Personnel information may remove a candidate, strengthen a candidate or change fair value, but it may not override identity, price freshness, risk or other hard gates.

## 7.5 Source and timestamp capture

When personnel information materially affects a recommendation, the card/report source text should identify the source class and the time/date checked closely enough that a later lane can distinguish fresh information from an earlier projection.

Later scheduled lanes should re-check unresolved `STRONG PROJECTION`, `PARTIAL` and `UNKNOWN` personnel states for tracked `BET`, `LEAN` and `WAIT` candidates. The re-check should focus on the unresolved facts rather than repeating the entire earlier research process unless new information materially changes the event context.

A later lane may promote or downgrade the recommendation only after reconciling the new personnel information with the current exact sportsbook price and all ordinary execution gates.

---

# 8. Contract continuity

All sections and safeguards incorporated by reference from the v0.8/v0.9 artifacts remain operational unless explicitly superseded above. This Personnel Sweep strengthens information gathering and uncertainty handling; it does not loosen any existing betting standard, increase the odds-request budget, change supported execution books, or alter staking methodology.
