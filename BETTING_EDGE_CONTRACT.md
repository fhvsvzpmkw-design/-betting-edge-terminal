# Betting Edge Governance & Report-Generation Contract — v1.0

**Document status:** OPERATIONAL — AUTHORITATIVE PRODUCTION CONTRACT  
**Contract version:** 1.0  
**Activated:** 2026-08-22  
**Promotion basis:** consolidation of the final operational v0.9 rule set; no new staking, risk, freshness, execution-book or odds-budget gate is introduced by this promotion  
**Supersedes production contract:** v0.9 final blob `59d8dda8d8e491255d5792329a9446eb01960a34`  
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Authoritative branch:** `main`  
**Production filename:** `BETTING_EDGE_CONTRACT.md`  
**Validated runner family:** VigScope outer runner v1.5 / Betting Edge core runner v1.4  
**Promotion acceptance:** `BETTING_EDGE_V1.0_ACCEPTANCE_2026-08-22.md`
**Operational amendment:** 2026-08-30 — fail-closed staged publication ownership  

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

For report timestamps at or after **2026-08-25 17:20:00 America/Vancouver**, production preflight must additionally resolve `core/core-v1.4-production.json`, verify `coreVersion: "1.4"` and `state: "OPERATIONAL"`, retain its exact Git blob SHA, resolve its pinned model-error framework and Walters interface, and resolve the current `core/walters-authority-v1.4.json` runtime mode before handicapping. The current Walters authority blob SHA and mode must be retained for report provenance. A Core 1.4 authority conflict is a preflight failure. Governance Contract v1.0 and Core version 1.4 are independent version tracks.

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

The module's `current` value is the production **soft target** for the number of recommendation cards in that report. Allowed profiles are `7`, `9`, and `12`. The live production target is the module's `current` value; this contract does not hard-code a second current target.

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
9. This reconciliation is a report-generation continuity check only. It does not redesign the runner, change staking methodology, add books, or increase the production odds-refresh/API budget.

## 6.2 PRICE WATCH — informational PASS metadata

`PRICE WATCH` is **not a fifth recommendation status**. It is optional, lane-specific informational metadata that may be attached only to an otherwise valid `PASS` recommendation when price is the primary remaining blocker.

A qualifying recommendation may carry:

```json
"priceWatch": {
  "active": true,
  "target": "+160 OR BETTER",
  "reason": "PRICE IS PRIMARY BLOCKER"
}
```

A report may emit `priceWatch` only when **all** of the following are true:

1. `status` remains exactly `PASS` and `stake` remains zero.
2. The current event/market/selection identity and executable-price freshness gates pass, and defensible fair-value work exists.
3. The non-price analytical case is acceptable enough to revisit if the price improves; price is the primary remaining blocker. Do not use PRICE WATCH to mask `FEED STALE`, `PRICE NOT VERIFIED`, `MARKET UNAVAILABLE`, `IDENTITY MISMATCH`, `POLICY BLOCK`, material `LINEUP/INFORMATION PENDING`, or material `CONFLICTING SIGNALS`.
4. `priceWatch.target` is a defensible **re-evaluation threshold** that ordinary market movement could plausibly reach. It is not a guaranteed LEAN threshold, BET threshold, or substitute for fresh handicapping.
5. `priceWatch.reason` states why price, rather than another unresolved factor, is the primary blocker.

Guardrails are mandatory:

- PRICE WATCH does **not** alter recommendation status, risk, stake, status counts, runner filters, VigScope meter inputs/weights, history weighting, carry-forward priority, or promotion criteria.
- A PRICE WATCH recommendation counts only as `PASS`; it never increments `LEAN`, `WAIT`, or `BET`.
- For a PRICE WATCH PASS, `playTo` remains the normal non-action state such as `NO BET`. `priceWatch.target` is separate from `playTo` and means **re-evaluate here**, not **bet here**.
- Update Odds / Reprice may compare the issued recommendation with a newer validated price, but crossing the watch target is informational only. Repricing must not silently promote the recommendation, rewrite fair value, rewrite `playTo`, assign stake, or re-handicap the issued card.
- Each scheduled report lane independently determines whether PRICE WATCH applies from that lane's current snapshot and analysis. The tag is **not automatically carried forward** from 06:00 to 08:00, 09:30, 15:15, 18:15, or any other card.
- If the next lane no longer independently satisfies these conditions, omit `priceWatch`. If the recommendation becomes `LEAN`, `WAIT`, or `BET`, omit `priceWatch` and use the normal status semantics.
- An archived issued report may retain its historical `priceWatch` metadata exactly as issued. That historical tag has no authority over a later report.
- A malformed payload that combines `priceWatch` with a non-`PASS` status must not cause the runner to display a PRICE WATCH badge or influence calculations.

PRICE WATCH therefore distinguishes a **price-sensitive PASS** from an ordinary PASS without weakening the existing four-status decision system.

## 6.3 Mandatory two-stage personnel-information process

Personnel information is an input to fair value and must not be treated only as a confirmation check after the value decision has already been made. Every scheduled lane must resolve and apply `BETTING_EDGE_PERSONNEL_SWEEP.md` from the authoritative `main` branch using the following two-stage order.

**Stage 1 — Material Information Scan:** after live-feed/data validity, exact event/market/selection identity and basic executable-price eligibility are established, but before the provisional current handicap and fair-value/value screen, perform the broad current-information scan defined in the addendum. Its purpose is to identify material absences, starters, rotation, scratches, role changes and comparable information early enough to affect the baseline handicap. A selection may enter the serious-candidate pool because Stage 1 information creates or materially improves apparent value. Betting Edge must not require a candidate to survive a pre-information value screen before personnel information is allowed to influence fair value.

**Stage 2 — Deep Personnel Sweep:** after Stage 1 has informed the provisional current handicap and fair-value/value screen, perform deeper personnel research on serious candidates, candidates created or materially strengthened by Stage 1, and candidates whose apparent value materially depends on unresolved personnel assumptions.

Stage 2 has a mandatory completion standard:

1. **Correct dependency first.** Before the deep source hunt, identify the actual personnel dependency of the exact wager and orient it to the correct team, opponent, participant and role. A wrong or incomplete dependency must be corrected and the relevant research repeated before final status. For example, an MLB hitter prop depends on the hitter's participation/batting position and the **opposing pitcher**, not the hitter's own-team pitcher.
2. **Official source first, then 3-to-5 fallback when unresolved.** When a material personnel fact remains `TBD`, unconfirmed, questionable, not posted or otherwise unresolved after the authoritative-source check, perform an event-/participant-specific sweep across **3 to 5 distinct credible current fallback source origins** where available. Three strong independent sources are the minimum target; continue toward four or five when sources disagree, are stale or ambiguous, the projection remains weak, or the personnel question could create, remove or flip an actionable edge. Duplicated syndication, mirrors and weak/stale sources do not count merely to satisfy the target. If fewer than three credible current fallback sources genuinely exist, record the source shortfall.
3. **Sport-wide application.** This depth rule applies to soccer, college football, NFL, NHL, NBA, WNBA, MLB and other supported sports. The sport-specific targets and time-to-game escalation in `BETTING_EDGE_PERSONNEL_SWEEP.md` are mandatory; the research target must reflect the sport's actual release pattern rather than forcing every sport into a generic lineup model.
4. **Confidence state.** Record the material personnel state as `CONFIRMED`, `STRONG PROJECTION`, `PARTIAL`, or `UNKNOWN`. Projected information may not be represented as confirmed.
5. **Source conflict.** Classify credible-source disagreement as `NONE`, `MINOR`, or `MATERIAL`. A material unresolved conflict prevents `STRONG PROJECTION`. When no clear quality/directness/recency hierarchy resolves the disagreement, preserve `PARTIAL` or `UNKNOWN`, widen uncertainty/model error, and continue toward the four-to-five-source end of the fallback range when useful. Do not average incompatible personnel claims into a false consensus.
6. **Decision sensitivity.** For every personnel-dependent serious candidate, identify the plausible personnel outcome or outcomes that would materially change fair value, uncertainty, `playTo`, or final status. When none remains, record `NO MATERIAL PERSONNEL SENSITIVITY`. Later lanes prioritize the unresolved facts named by this sensitivity rather than repeating unrelated research.
7. **Re-handicap explicitly.** Material Stage 2 findings must be applied back into the current handicap. Fair value, uncertainty/model error and `playTo` must be reassessed as appropriate before final `BET`, `LEAN`, `WAIT`, or `PASS` assignment. Retain the pre-Stage-2 and post-Stage-2 fair-value/uncertainty state; if the deep sweep produces no material change, record `NO MATERIAL CHANGE` rather than silently carrying the provisional number forward.
8. **Structured evidence.** For material Stage 2 work, the durable sidecar must retain enough evidence to audit the search and decision: check time, dependency target/rationale, official sources, fallback sources/count, source shortfall where applicable, material facts, personnel state, source conflict and any resolution, unresolved facts, decision sensitivity, pre-/post-Stage-2 fair-value/uncertainty state and decision impact.

The addendum is operational report-generation policy and is subordinate to this production contract; if wording conflicts, this contract controls. Its source hierarchy, confidence states, sport-specific checks, time-to-game escalation, source-depth standard, dependency validation, conflict handling, decision-sensitivity treatment, materiality treatment and later-lane behavior are mandatory.

The two-stage personnel process is current-information research, not Research Library evidence. It may create, remove, strengthen or weaken apparent value but may not override event/market/selection identity, executable-price freshness, supported-book, fair-value, exposure, staking or other hard gates. It must not trigger an additional Odds-API request or alter the production refresh budget.

---

# 7. Research Library — production R3 behavior

The Betting Edge Research Library remains a **read-only** report input.

Current approved production library: **1.8** (R3 live read-only).

Scheduled reports must form the provisional current handicap first, then read the approved Research Library manifest/policy/taxonomy/library and apply History Fit under the inherited rules.

Research may not by itself:

- create a BET;
- supply an executable sportsbook quote;
- override identity failure;
- override feed or exact-quote freshness;
- directly rewrite fair value;
- directly rewrite `playTo`;
- directly rewrite recommendation status;
- directly rewrite stake.

Direct sport/market/timing evidence outranks analogy. Conflicts, era drift and explicit research gaps must be preserved rather than hidden. Normal scheduled reports do not write to `research/*`.

Visible `rec.hist` remains concise. Structured research/provenance belongs in the durable sidecar rather than bloating the runner payload.

---

## 7.1 Core 1.4 — operational handicap/model-error and Walters authority

Core 1.4 is operational for report timestamps at or after **2026-08-25T17:20:00-07:00**. Earlier issued reports remain immutable Core 1.3 historical evidence. The authoritative Core 1.4 manifest is `core/core-v1.4-production.json`.

Every Core 1.4 serious candidate must carry a structured Core assessment in the durable sidecar. The production model-error framework classifies the fair-value basis, supported-book dispersion, liquidity risk, tail risk, exact-market calibration, personnel sensitivity and independent current support, then assigns `STANDARD`, `ELEVATED`, `HIGH` or `UNQUANTIFIED`. The production publication gate recomputes this state from the recorded inputs. A `BET` is prohibited when that recomputation says the candidate is not eligible by the Core 1.4 model-error layer.

Research Library v1.8 remains read-only and may not itself create a BET or directly move the fair-value point estimate. Core 1.4 may use only the fixed graduated allowlist in its operational model-error framework, and those approved findings may **raise** the model-error floor or prevent false precision; they may not lower the floor, manufacture independent current support or set stake. The set of applicable graduated research IDs is derived from the Core context and may not be selectively omitted to evade an uncertainty rule.

Billy Walters-derived handicapping is a separate Core 1.4 specialist engine, not a Research Library vote. Runtime authority is controlled by `core/walters-authority-v1.4.json` and may be switched forward-only without re-versioning Core 1.4:

- `OFF` — Walters is not used for current handicapping;
- `ADVISORY` — Walters may be compared with the Core and trigger review but may not originate a recommendation;
- `BET_AUTHORITY` — an eligible, current, arithmetic-verified Walters handicap may originate an exact NFL spread or moneyline BET candidate and may stand as/contribute an independent fair-value input.

Core 1.4 activates with Walters in **`BET_AUTHORITY`**. Walters BET authority is handicap/recommendation authority only. It may not override exact identity, feed freshness, executable-quote freshness, personnel requirements, price-quality/model-error boundaries, exposure controls or final staking policy; it may not supply a fabricated executable price or rewrite issued history. Walters-created candidates must record their Walters fair, source timing, exact proposed market/selection and rationale. Missing or unavailable Walters data does not block an otherwise valid report.

Core 1.4 consciously does **not** activate the Results/CLV feedback learning loop, Shadow History, learned player/team associations or personal-ledger calibration. Those remain later tracks and are not prerequisites for Core 1.4.

# 8. Invariants 9-22 — durable history and delivery are operational

The durable-history/provenance invariants promoted under v0.9 remain production requirements under v1.0.

## 8.1 Issued report immutability

Once delivered, an issued report is historical evidence. Later odds, results, repricing, Research Library changes, contract changes or corrections may not silently rewrite it.

## 8.2 Exact issued-payload authority

Validated issued payloads are stored under:

`data/history/runs/YYYY-MM-DD/<slot>-HHMMSS.json`

The stored payload is authoritative for what Betting Edge issued. `run-history.json`, sidecars and resolvers are indexes/enrichment layers and may not override it.

## 8.3 Research/provenance sidecars

New post-cutover sidecars are stored under:

`data/history/research-fit/YYYY-MM-DD/<slot>-HHMMSS.json`

They must match the issued slot, exact `run.ts`, exact report path and exact `feedGeneratedAt`. They enrich history but do not become decision authority.

## 8.4 History failure isolation

Once the live feed has been successfully read and a report payload has passed all analysis/payload validation gates, later GitHub archive/index/sidecar failure is a history/publishing failure only.

Do not:

- pull odds again solely because history saving failed;
- rerun the handicap;
- generate a replacement recommendation set;
- mutate the validated payload;
- block the next scheduled lane.

Use the validated self-contained long fallback and surface:

`HISTORY SAVE FAILED — REPORT VALID`

## 8.5 Odds history authority

The exact historical `data/live-odds.json` Git blob is authoritative. `data/history/odds-index.json` is a compact discovery/provenance index and must not replace or duplicate the full feed on every refresh.

## 8.6 Source-backed same-day lineage

When a later lane describes an earlier Betting Edge lane, use the actual archived earlier report where available. Do not reconstruct prior status/price/`playTo`/fair/stake/History Fit from memory when repository history is readable.

## 8.7 Reprice immutability

`UPDATE ODDS / REPRICE NOW` is a comparison overlay. It must not mutate the issued report or be falsely represented as centrally archived decision-time history.

## 8.8 Long fallback before history dependency

A validated self-contained `runner.html#run=<payload>` link must exist before history-dependent delivery is assumed.

## 8.9 Primary compact share link

After exact payload storage and successful `run-history.json` indexing (and sidecar success where required by the scheduled lane), the normal primary share form is:

`r.html?id=<shortId>`

Current deterministic ID format:

`YYMMDD + slotCode + HHMMSS`

Slot codes:

- `open = o`;
- `main = m`;
- `final_morning = f`;
- `evening = e`;
- `late = l`.

A short ID must resolve uniquely. Short-link and long-link active issued content must agree.

## 8.10 Same-day hydration boundary

The compact resolver may hydrate at most the newest valid archived run for each lane from the active report's exact Vancouver date. It must validate archived timestamp/slot/feed provenance, must not duplicate the active run, and must not allow a failed optional prior-run fetch to prevent the active report from opening.

Repository-backed session history is navigation/presentation context; it does not become Research Library evidence merely by being visible.

---

# 9. Invariant 23 — executable player-prop identity integrity

For every player-specific prop, event and selection identity must remain exact from current-feed validation through issuance, durable history and later repricing.

A player prop may not receive `BET` unless all applicable elements validate:

1. exact event/game;
2. exact player/participant;
3. current player-to-game/team participation context when the feed alone is insufficient;
4. exact prop market;
5. exact side/selection;
6. exact line/handicap/total when line-based;
7. exact approved-book quote satisfying inherited freshness rules.

If player/team/game identity is ambiguous, missing or conflicting, use `IDENTITY MISMATCH` or `PRICE NOT VERIFIED` / `WAIT` as appropriate and force stake to zero.

When feed context is insufficient, a current authoritative roster, lineup, injury, transaction or official game-status source may validate participation identity. External context validates identity only; it does not replace the sportsbook quote in `data/live-odds.json`.

Every displayed player prop must preserve machine-readable `rec.feed` identity copied from the exact live-odds row used for issuance.

Minimum required fields for delivery:

- `eventId`;
- `marketKey`;
- `side`;
- `selectionKey`;
- player/participant label;
- line/`hdp` for line-based markets.

Preserve `eventKey`, `market`, and other structured identity when present.

A later different prop line is a different selection for exact comparison. It must not be presented as an exact reprice of the issued line. `rec.feed` is part of the immutable issued payload and survives later team changes or market changes unchanged.

This rule does not create a roster database, increase odds API usage, activate Shadow History, or change fair-value/staking methodology.

---

# 10. Production sidecar provenance — schema 3

Post-cutover sidecars use the current `data/history/report-provenance-schema.json` production schema and record production authority explicitly.

Required production-contract provenance includes:

- `productionContractVersion: "1.0"`;
- `productionContractOperational: true`;
- `productionContractPath: "BETTING_EDGE_CONTRACT.md"`;
- exact `productionContractBlobSha` fetched for that report;
- `personnelSweepPath: "BETTING_EDGE_PERSONNEL_SWEEP.md"` when the operational personnel process is in force;
- exact `personnelSweepBlobSha` resolved for that report;
- current runner version/blob SHA where available;
- exact feed blob SHA where available;
- Research Library version/blob SHA;
- History Fit policy blob SHA;
- Research manifest blob SHA;
- active R2 validation blob SHA.

For a recommendation where Stage 2 personnel work is material to a serious candidate or materially affects `BET`/`LEAN`/`WAIT`, fair value, uncertainty or `playTo`, the sidecar must also carry the current schema's structured `personnelEvidence` record. That record must be sufficient to audit dependency orientation, official/fallback source depth, source conflict, confidence state, unresolved facts, decision sensitivity, the pre-/post-Stage-2 fair-value or uncertainty state, and the decision impact. Historical sidecars are not backfilled.

Historical schema-2 sidecars issued before the v0.9 cutover remain valid historical evidence and must not be rewritten merely to adopt schema 3. Schema-3 sidecars issued under contract v0.9 likewise remain immutable valid historical evidence; new sidecars after this promotion record contract v1.0.

Draft files may still be recorded as historical design provenance, but they are not production authority after this cutover.

---

# 11. Production delivery sequence

For every valid scheduled report:

1. production contract / runner preflight;
2. live-feed freshness, exact identity and basic executable-price eligibility validation;
3. Stage 1 Material Information Scan over the eligible current slate under `BETTING_EDGE_PERSONNEL_SWEEP.md`;
4. provisional independent current handicap, fair-value construction and value screen using the Stage 1 information;
5. Stage 2 Deep Personnel Sweep for serious candidates, candidates created or materially strengthened by Stage 1, and candidates materially dependent on unresolved personnel assumptions; validate the exact wager dependency, apply the sport-wide 3-to-5-source fallback completion rule when official material information remains unresolved, and resolve/record source conflict and decision sensitivity;
6. apply material Stage 2 findings back into the current handicap; reassess fair value, uncertainty/model error and `playTo`, record the pre-/post-Stage-2 state and decision impact, then form the provisional current recommendation;
7. Research Fit read-only pass;
8. payload construction and all inherited hard-gate validation;
9. create and retain validated long fallback;
10. store the exact issued payload;
11. store matching production-provenance/Research Fit sidecar, including required material `personnelEvidence`;
12. append/merge the exact `run-history.json` entry without overwriting prior issued evidence;
13. after history success, deliver deterministic compact `r.html?id=` link as primary;
14. if history publication fails after report validation, deliver the unchanged long fallback with `HISTORY SAVE FAILED — REPORT VALID`.

History/share work may not create, change or suppress a betting decision that has already passed the core report gates.

---

# 12. Activation tracks

At v1.0 production activation:

- **C-track: C2 — v1.0 OPERATIONAL.** `BETTING_EDGE_CONTRACT.md` is authoritative production governance. C2 represents a controlled consolidation of the final v0.9 operating rule set, not a new betting methodology.
- **R-track: R3 — LIVE READ-ONLY HISTORY FIT.** Production Research Library is v1.8 and read-only. Core 1.4 may consume only its fixed graduated model-error allowlist under Section 7.1; normal History Fit remains non-authoritative for BET creation.
- **H-track: H3 — LIVE ISSUED-REPORT / PROVENANCE HISTORY.** Existing archive + sidecar + index + same-day lineage/navigation behavior remains operational.
- **S-track: S0 — INACTIVE.** Shadow History remains separate and is not activated by v1.0.

The first post-v1.0 scheduled lane must be checked for production-contract preflight plus normal report/history/share behavior. That check is post-activation verification, not permission to silently change the contract. The 2026-08-22 18:15 issuance remains immutable v0.9 historical evidence and is not relabeled by this promotion.

---

# 13. Change control and rollback

The following artifacts remain historical and must not be deleted as part of promotion:

- `BETTING_EDGE_CONTRACT_DRAFT_v0.8.md`;
- `BETTING_EDGE_CONTRACT_DRAFT_v0.9.md`;
- `BETTING_EDGE_CONTRACT_DRAFT_v0.9_PLAYER_PROP_DELTA.md`;
- `BETTING_EDGE_V0.9_PREFLIGHT_2026-08-15.md`;
- `BETTING_EDGE_V0.9_ACCEPTANCE_2026-08-15.md`.

The current v1.0 promotion is recorded in `BETTING_EDGE_V1.0_ACCEPTANCE_2026-08-22.md`, including the exact rollback boundary and equivalence statement. That historical acceptance record is not rewritten by later v1.0 operational clarifications.

### Operational change record — 2026-08-25 — personnel-information ordering correction

**Issue:** The first Personnel Sweep activation placed deep personnel research only after a candidate survived an initial value screen. Because injuries, lineups, starters, rotation and role changes are themselves legitimate fair-value inputs, that sequence could discard a market before discovering information capable of creating or materially changing value.

**Decision:** Replace the single post-screen sweep with the two-stage personnel-information process in Section 6.3 and `BETTING_EDGE_PERSONNEL_SWEEP.md`: Stage 1 Material Information Scan before provisional fair value; Stage 2 Deep Personnel Sweep after the provisional screen; then explicit current-evidence re-evaluation before final status.

**Intentionally unchanged:** feed and exact-quote freshness rules; Bet365/DraftKings supported-book boundary; fair-value quality requirements; BET/LEAN/WAIT/PASS semantics; staking/exposure limits; Research Library authority; odds-refresh schedule and request budget; issued-report immutability.

### Operational change record — 2026-08-25 — Stage 2 depth, dependency and conflict safeguards

**Issue:** A generic instruction to perform deeper personnel research could still stop too early at `TBD`/unconfirmed official information, search the wrong personnel dependency for an exact wager, treat duplicated or conflicting projections as consensus, or fail to show whether newly found personnel information actually changed the handicap.

**Decision:** Clarify Section 6.3 and the operational addendum so Stage 2 now requires: correct-wager dependency validation; authoritative-source-first research; a sport-wide 3-to-5-distinct-source fallback sweep when material official information remains unresolved; sport-specific time-to-game escalation; `CONFIRMED`/`STRONG PROJECTION`/`PARTIAL`/`UNKNOWN` confidence states; explicit `NONE`/`MINOR`/`MATERIAL` source-conflict handling; a prohibition on `STRONG PROJECTION` while material unresolved conflict remains; decision-sensitivity capture; explicit pre-/post-Stage-2 re-handicapping; and structured material personnel evidence in the durable sidecar.

**Classification:** This is an analytical-depth and auditability clarification within Contract v1.0. It does not change sportsbooks, feed/quote freshness, staking, exposure, risk tolerance, report lanes, runner/core versions, Research Library authority, odds-refresh cadence or API request budget.

### Operational change record — 2026-08-25 — Core 1.4 production integration

**Decision:** Promote the tested Core 1.4 model-error framework and production manifest at 17:20 PT; require structured Core assessment and machine recomputation during publication; keep Research Library v1.8 one-way for model-error only; activate the Walters runtime authority switch in `BET_AUTHORITY` so an eligible Walters handicap may originate a BET candidate while preserving all hard execution/staking gates.

**Intentionally deferred:** Results/CLV feedback learning, Shadow History, learned player/team associations and personal-ledger calibration.

**Intentionally unchanged:** Bet365/DraftKings execution boundary; 75-minute feed freshness; 30-minute executable-quote freshness; staking/exposure methodology; scheduled report lanes; odds/API request budget; issued-report immutability.

Git history is the authoritative rollback system. Existing issued reports and sidecars are append-only historical evidence.

Do not bundle unrelated UI feature development, Shadow History activation, new staking methodology, new books, Research Library promotion, or odds-refresh budget changes into this contract activation. The VigScope v1.5 runner remains the presentation shell. Core 1.4 is the operational report-engine/handicap version for post-cutover reports and is versioned independently from the runner and Governance Contract.

Any future contract version requires explicit change control, regression/equivalence review and deliberate production promotion.

---

# 14. Production declaration

Betting Edge governance version **1.0 is operational** on the authoritative `main` branch.

This promotion formalizes the final proven v0.9 operating state as the first 1.x production contract. It changes governance/version identity and provenance requirements for new reports, while preserving the inherited pricing, freshness, identity, fair-value, status, staking, risk, payload, five-lane schedule and odds-budget safeguards. Durable issued-report history, source-backed same-day lineage, compact archive-backed sharing, exact player-prop identity, fair-value confidence labeling, spread-lineage reconciliation, PRICE WATCH, the repository-controlled report-card target and the operational two-stage personnel-information process—including sport-wide Stage 2 source depth, exact-wager dependency validation, source-conflict handling, decision sensitivity and explicit re-handicapping—remain governed behavior.

---

# 15. Operational amendment — 2026-08-30 — fail-closed staged publication ownership

**Status:** OPERATIONAL CLARIFICATION WITHIN CONTRACT v1.0.  
**Effective:** 2026-08-30, America/Vancouver.  
**Version effect:** Governance Contract remains `1.0`; Core remains `1.4`.

This amendment governs production publication after its effective date and **supersedes any conflicting earlier wording in Sections 8.4, 8.8 and 11**, including the former assumption that a scheduled ChatGPT task may first write permanent History and only afterward discover a durable-history verification failure, or that a failed publication may be presented as an issued report through `HISTORY SAVE FAILED — REPORT VALID` / long-link fallback behavior.

## 15.1 Candidate / issuance boundary

A scheduled ChatGPT Betting Edge lane is a **candidate producer only**. Completing handicapping, report construction or schema-3 sidecar construction does not by itself create an issued report.

After all normal analysis and payload gates, the task must freeze the complete report candidate and matching schema-3 sidecar. It may then write only the repository-controlled staging bundle used by the production staged-publication workflow. It must not directly create, update, delete, repair or index:

- `data/history/runs/**`;
- `data/history/research-fit/**`;
- `run-history.json`.

A pre-publication serialized/long payload may exist as diagnostic or recovery transport, but it does not confer issuance authority and must not be presented as a successfully issued scheduled report when staged publication is blocked or pending.

## 15.2 Publisher ownership and fail-closed validation

The repository-controlled production publisher alone owns permanent Betting Edge History. Before any new candidate enters permanent History it must require clean existing durable history and validate the frozen candidate through the current production gates, including as applicable:

1. Core 1.4 schema and controlled-value validation;
2. framework recomputation of `modelErrorState`, `betEligibleByModelError`, `effects`, `appliedRules` and `reasons`;
3. report/sidecar recommendation consistency and required WAIT qualification;
4. current Walters authority/provenance requirements;
5. same-day tracked-selection continuity;
6. tracked non-spread availability;
7. spread-lineage reconciliation;
8. ordinary report-publication integrity and path/index invariants.

The publisher may accept the frozen candidate unchanged or reject it fail-closed. Publication validation may not silently repair, reinterpret or mutate the candidate merely to make a gate pass.

A candidate that fails a required publication gate is **not an issued report** and must not be written into permanent History. Surface:

`PUBLICATION BLOCKED — CANDIDATE NOT STORED`

If the candidate has been staged but publication has not completed by the scheduled task's end, surface:

`PUBLICATION PENDING — CANDIDATE STAGED`

Neither state authorizes a compact short link, a claim of durable storage, or presentation of the candidate as issued History.

## 15.3 Atomic durable issuance and read-back

Only after all required publication gates pass may the publisher atomically write the exact frozen report payload, matching schema-3 sidecar and complete updated `run-history.json` without overwriting prior issued evidence.

The publisher must then fetch authoritative `main` again and remotely read back/verify the exact report, sidecar and History index. **Successful durable read-back is the issuance boundary.** Only then does the candidate become a durable issued Betting Edge report and only then may the deterministic compact `r.html?id=` link be released as the normal scheduled-report share link.

A publication failure must not trigger a fresh odds pull, a rerun of the handicap, a replacement recommendation set, mutation of the frozen candidate, or blockage of the next independently scheduled lane.

## 15.4 Intentionally unchanged

This amendment changes publication ownership and failure semantics only. It does **not** change:

- the five standard production report lanes: `06:00`, `08:00`, `09:30`, `15:15`, `18:15` America/Vancouver;
- Bet365 / DraftKings execution-book authority;
- the 75-minute feed-freshness gate;
- the 30-minute executable-quote-freshness gate;
- handicap or fair-value methodology;
- BET / LEAN / WAIT / PASS semantics;
- Core 1.4 version or model-error framework;
- Research Library v1.8 authority;
- Walters runtime authority model;
- staking, exposure or risk tolerance;
- odds-refresh cadence or API request budget;
- immutable treatment of reports that were already validly issued before this amendment.

**Reason for amendment:** post-cutover scheduled runs demonstrated that newly generated sidecar metadata could be written into durable History before exact production recomputation exposed defects such as unsupported controlled values, missing required WAIT qualification or recorded model-error state inconsistent with the current framework. This amendment makes the already-deployed fail-closed staged publisher the formal Contract v1.0 governance boundary so those defects are rejected before permanent issuance rather than discovered after storage.
