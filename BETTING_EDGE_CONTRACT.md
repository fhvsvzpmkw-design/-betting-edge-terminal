# Betting Edge Governance & Report-Generation Contract — v0.9

**Document status:** OPERATIONAL — AUTHORITATIVE PRODUCTION CONTRACT  
**Contract version:** 0.9  
**Activated:** 2026-08-15  
**Clarified:** 2026-08-21 — report-card target profile; no change to contract version, staking, risk, freshness or execution gates  
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Authoritative branch:** `main`  
**Production filename:** `BETTING_EDGE_CONTRACT.md`  
**Validated runner family:** VigScope outer runner v1.4 / Betting Edge core runner v1.3  
**Live acceptance:** `BETTING_EDGE_V0.9_ACCEPTANCE_2026-08-15.md`

> **THIS FILE IS OPERATIONAL.**
>
> Every production Betting Edge scheduled report must resolve this file from the authoritative repository/branch before handicapping, verify that it declares version `0.9` and `OPERATIONAL`, resolve the current approved runner, and obey this contract as governing authority. If production-contract or runner authority cannot be resolved, stop before analysis and surface `PREFLIGHT BLOCK — ANALYSIS NOT STARTED`.

---

# 1. Contract composition and precedence

v0.9 is the production composition of the validated v0.8 execution baseline, the v0.9 durable-history/provenance delta, and the v0.9 player-prop identity delta.

The following exact historical design artifacts are incorporated into this production contract by reference:

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

The v0.9 draft statement that runner payload shape is wholly unchanged is clarified as follows:

> Core visible recommendation fields and runner behavior remain compatible; player-specific props may additionally carry the existing runner-supported `rec.feed` structured identity object required for exact issuance, durable-history integrity and exact repricing.

No other inherited v0.8 rule is weakened by activation.

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
2. verify `Document status` is operational and `Contract version` is `0.9`;
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

The report schedule itself is unchanged by v0.9. The odds-refresh workflow remains operationally separate from this contract promotion. v0.9 does not increase Odds-API request volume or alter the production refresh budget merely because history and player-prop identity are now governed here.

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

---

# 7. Research Library — production R3 behavior

The Betting Edge Research Library remains a **read-only** report input.

Current approved library at activation: **1.7**.

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

# 8. Invariants 9-22 — durable history and delivery are operational

The v0.9 durable-history/provenance invariants are now production requirements.

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

- `productionContractVersion: "0.9"`;
- `productionContractOperational: true`;
- `productionContractPath: "BETTING_EDGE_CONTRACT.md"`;
- exact `productionContractBlobSha` fetched for that report;
- current runner version/blob SHA where available;
- exact feed blob SHA where available;
- Research Library version/blob SHA;
- History Fit policy blob SHA;
- Research manifest blob SHA;
- active R2 validation blob SHA.

Historical schema-2 sidecars issued before cutover remain valid historical evidence and must not be rewritten merely to adopt schema 3.

Draft files may still be recorded as historical design provenance, but they are not production authority after this cutover.

---

# 11. Production delivery sequence

For every valid scheduled report:

1. production contract / runner preflight;
2. live-feed freshness and identity validation;
3. independent current handicap;
4. Research Fit read-only pass;
5. payload construction and all inherited hard-gate validation;
6. create and retain validated long fallback;
7. store the exact issued payload;
8. store matching production-provenance/Research Fit sidecar;
9. append/merge the exact `run-history.json` entry without overwriting prior issued evidence;
10. after history success, deliver deterministic compact `r.html?id=` link as primary;
11. if history publication fails after report validation, deliver the unchanged long fallback with `HISTORY SAVE FAILED — REPORT VALID`.

History/share work may not create, change or suppress a betting decision that has already passed the core report gates.

---

# 12. Activation tracks

At production activation:

- **C-track: C1 — v0.9 OPERATIONAL.** `BETTING_EDGE_CONTRACT.md` is authoritative production governance.
- **R-track: R3 — LIVE READ-ONLY HISTORY FIT.** The Evening/Late acceptance pair validated live sidecar behavior; all five scheduled lanes are cut over to production authority.
- **H-track: H3 — LIVE ISSUED-REPORT / PROVENANCE HISTORY.** The Evening/Late pair validated archive + sidecar + index + same-day lineage/navigation behavior. Full five-lane day coverage remains an operational observation to verify, not a prerequisite to v0.9 authority.
- **S-track: S0 — INACTIVE.** Shadow History remains separate and is not activated by v0.9.

The first post-cutover scheduled lane must be checked for production-contract preflight plus normal report/history/share behavior. That check is post-activation verification, not permission to silently change the contract.

---

# 13. Change control and rollback

The following artifacts remain historical and must not be deleted as part of promotion:

- `BETTING_EDGE_CONTRACT_DRAFT_v0.8.md`;
- `BETTING_EDGE_CONTRACT_DRAFT_v0.9.md`;
- `BETTING_EDGE_CONTRACT_DRAFT_v0.9_PLAYER_PROP_DELTA.md`;
- `BETTING_EDGE_V0.9_PREFLIGHT_2026-08-15.md`;
- `BETTING_EDGE_V0.9_ACCEPTANCE_2026-08-15.md`.

Git history is the authoritative rollback system. Existing issued reports and sidecars are append-only historical evidence.

Do not bundle unrelated UI development, richer lower History-box work, Shadow History activation, new staking methodology, new books, or odds-refresh budget changes into this contract activation.

Any future contract version requires explicit change control, regression/equivalence review and deliberate production promotion.

---

# 14. Production declaration

Betting Edge governance version **0.9 is operational** on the authoritative `main` branch.

The production system now treats durable issued-report history, source-backed same-day lineage, compact archive-backed sharing, production provenance, and exact player-prop identity as first-class governed behavior while preserving the inherited v0.8 pricing, freshness, fair-value, staking, risk and payload safeguards.
