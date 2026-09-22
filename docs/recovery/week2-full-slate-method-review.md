# Full Week 3 recovery — method review

Status: implementation in progress under user-approved v1.6 historical-estimate authority. Scope: every one of the 16 Week 3 games.

The published receipt still records one completed Week 2 pair (CLE–TB). Its two Week 3 rating-base refreshes remain intact. This draft does not stage another rating batch, change a fair number, or claim that the remaining games are complete.

## Adopted calculation changes

`graham-historical-exposure.mjs` implements an elapsed-game-time estimate for a documented absence. Exact departure/return times produce an exact time fraction; imprecise reports produce a bounded interval and an explicitly assumed midpoint. The value loss is the existing replacement-aware difference multiplied by that fraction. Active play is valued normally as an explicit modelling assumption, not a medical conclusion. Rotation and performance benchings cannot be inferred to be injuries from snap counts.

The evaluator integration also supports a historical QB replacement difference on the original locked Madden conversion, without changing the current-week QB performance model. Authority v1.6 adopts this as a separate historical estimate and explicitly disclaims performance validation of the Madden-only scale; it does not modify the activated QB-performance model. The implementation supports a value-invariant healthy-QB competition; it rejects unequal candidate values and missing identities. It does not charge two unavailable quarterbacks as two starting roles.

For position groups whose calibration requests review rather than specifying a multiplier, the draft accepts an explicit disjoint-role assessment with an additive, no-extra-multiplier estimate. Existing calibrated receiver and defensive-line multipliers remain unchanged. The extra interaction effect is an adopted modelling assumption, not a measured zero.

The user approved broader estimates on September 22. Authority v1.6 records adoption, scope and limitations; real game coverage still requires validation before production.

## Source reconciliation findings

- Detroit's game-day offensive line used Borom, Bartch and Scruggs for Miller, Mahogany and Mays. [Official postgame observations](https://www.detroitlions.com/news/detroit-lions-week-2-observations-stbrown-hutchinson-gibbs).
- Buffalo lost Oliver before kickoff and Moore during the second quarter. [Official injury review](https://www.buffalobills.com/news/injury-updates-following-tnf-deone-walker-s-steady-play-and-bills-using-upcoming-rest-to-their-advantage).
- Minnesota's reserve inventory includes Mason; Chicago's Williams left during the fourth quarter and Bagent finished. [Vikings transaction](https://www.vikings.com/news/jordan-mason-injured-reserve-deejay-dallas-signing-2026), [Bears recap](https://www.chicagobears.com/news/game-recap-bears-fall-to-1-1-with-loss-to-vikings).
- Miami's earlier Chop Robinson committee cannot be reused unchanged: its transactions show Ojabo released and Trey Moore on injured reserve. [Official transactions](https://www.miamidolphins.com/team/transactions/2026).
- Indianapolis lost Pierce in the first quarter; Dulin and Giddens were inactive. Treadwell supplied documented relief at receiver. [Final inactive list](https://www.colts.com/news/colts-announce-6-inactive-players-for-week-2-game-vs-kansas-city-chiefs), [Pierce report](https://www.colts.com/news/x-rays-on-left-heel-negative-for-wr-alec-pierce), [role review](https://www.colts.com/news/5-colts-things-daniel-jones-offense-handle-steve-spagnuolo-s-blitzes-laquon-treadwell-steps-up-kapena-gushiken-flashes-in-week-2-loss-to-chiefs).

The adjacent working inventory covers all 30 remaining teams and 278 discovery entries. It deliberately is not an absence total: some names need aliases, retained-roster checks, camp-role exclusions, or game-time participation review. Dallas's transaction endpoint was unavailable. No unavailable endpoint is treated as evidence of no injuries.

## Missing-value boundary

Some independent pages report ratings for identities absent from both the frozen registry and the committed official EA supplement, for example [Elijah Mitchell, 72](https://www.maddenratings.com/elijah-mitchell). Other pages explicitly have no rating, including [Sione Takitaki](https://www.maddenratings.com/sione-takitaki), [D.J. Turner](https://www.maddenratings.com/dj-turner), and [Terrell Jennings](https://www.maddenratings.com/terrell-jennings). An absent rating cannot become zero. The new historical-only value loader permits source-bound independent values and explicit position-group priors; the production registry remains unchanged.

The approved v1.6 policy below resolves missing values through a disclosed source hierarchy. Final availability and role assessments remain separate requirements.

### Approved fallback policy — implementation in progress

1. Use the locked registry first, then the bound official EA supplement. Reconcile aliases before declaring an identity unrated.
2. For a still-missing identity with a verifiable Madden 27 rating from an independent source, retain the source, retrieval date and version and apply the unchanged conversion curve. Label this an independent-source historical estimate; do not claim official EA capture or overwrite the production registry.
3. For a documented non-QB role with no available rating, use the median of the corresponding position group in the locked registry as an explicitly imputed value. Retain the group's 10th–90th percentile spread as a sensitivity range, not a confidence interval. This is a broad position prior; it is not validated for unrated players and can misrepresent their strength. Do not impute a QB or use imputation to hide unresolved role identity.
4. For an unpriced specialist replaced by an available professional specialist, use a disclosed neutral replacement-difference assumption in the approximate point estimate and flag unquantified specialist uncertainty. This is not proof of zero loss. If the specialist role was unfilled or materially disrupted, keep it unresolved.
5. Apply the time-exposure method only to source-supported injury absences. Preserve all assumptions in the evidence and label affected outputs as approximate. Keep the unchanged 90/10 arithmetic, paired application, prior history, and betting gates.

The currently locked registry produces these cohort values mechanically:

| Position group | Players | Median points | 10th–90th percentile points |
|---|---:|---:|---:|
| RB/FB | 169 | 0.2 | 0.0–1.2 |
| WR/TE | 429 | 0.0 | 0.0–0.9 |
| Offensive line | 425 | 0.0 | 0.0–0.9 |
| Defensive line | 458 | 0.2 | 0.0–0.9 |
| Linebacker | 219 | 0.0 | 0.0–0.9 |
| Defensive back | 453 | 0.2 | 0.0–0.9 |

The user approved this broader policy. It is now implemented in the historical-only value loader and documented in authority v1.6. No new production game has yet been applied. Complete role and final-availability research remains required. Estimates retain provenance and cannot overwrite the frozen registry.

## Verification and next gate

The six time-exposure unit checks and the existing historical completion, weekly evidence, role-chain, routing, rating-base-refresh and exact 90/10 tests pass locally. This does not validate real game totals. Before production: complete final coverage for each pair, reconcile/adopt the new methods, add integration acceptance cases, run immutable evidence validation, stage through the existing updater, verify remote receipt, then separately refresh and verify the full Week 3 board.
