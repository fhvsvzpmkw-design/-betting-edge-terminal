# Full Week 3 recovery — method review

Status: complete weekly learning for all 32 teams under user-approved v1.6 historical-estimate authority; all 16 Week 3 rating bases refreshed from the applied production receipt.

The existing CLE–TB pair is preserved byte-for-byte. PR #107 merged the other fifteen pairs, and the production workflow published commit `a0513e44` with a verified COMPLETE cumulative receipt: 16 games, 32 teams, 30 new team updates, one already-applied pair and no blocked pairs. This separate current-week propagation refreshes all 16 Week 3 matchups from those published ratings. It preserves the existing current-week personnel, QB, matchup and home-field overlays and clears the obsolete partial-weekly-rating warning.

## Adopted calculation changes

`graham-historical-exposure.mjs` implements an elapsed-game-time estimate for a documented absence. Exact departure/return times produce an exact time fraction; imprecise reports produce a bounded interval and an explicitly assumed midpoint. The value loss is the existing replacement-aware difference multiplied by that fraction. Active play is valued normally as an explicit modelling assumption, not a medical conclusion. Rotation and performance benchings cannot be inferred to be injuries from snap counts.

The evaluator integration also supports a historical QB replacement difference on the original locked Madden conversion, without changing the current-week QB performance model. Authority v1.6 adopts this as a separate historical estimate and explicitly disclaims performance validation of the Madden-only scale; it does not modify the activated QB-performance model. The implementation supports a value-invariant healthy-QB competition; it rejects unequal candidate values and missing identities. It does not charge two unavailable quarterbacks as two starting roles.

For position groups whose calibration requests review rather than specifying a multiplier, the approved implementation accepts an explicit disjoint-role assessment with an additive, no-extra-multiplier estimate. Existing calibrated receiver and defensive-line multipliers remain unchanged. The extra interaction effect is an adopted modelling assumption, not a measured zero.

The user approved broader estimates on September 22. Authority v1.6 records adoption, scope and limitations; real coverage has passed the evidence evaluator and the complete publication rehearsal.

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

### Approved fallback policy — implemented

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

The user approved this broader policy. It is implemented in the historical-only value loader, documented in authority v1.6 and applied through the complete Week 2 production batch. Complete role and final-availability research remains required for future batches. Estimates retain provenance and cannot overwrite the frozen registry.

## Production verification

The main-branch carried-rating workflow completed successfully. Readback verifies the applied receipt, 30 new team-history events, unchanged CLE/TB records and no duplicate application. The separate board refresh passes schedule authority and fair-decomposition validation for all 16 games. Replaying it produces zero new changes. These checks establish implementation and publication consistency; they do not establish predictive accuracy for the new estimates.

## Publication validation

115 checks pass across weekly evidence, routing, replacement roles, missing-value provenance, exposure assumptions, paired arithmetic and rating-base propagation. The complete receipt clears only weekly-rating blockers; unresolved current-week personnel or QB inputs remain explicitly identified. Missing identities, double-counted replacements, changed historical receipts and mismatched evidence blobs remain rejected.

The adjacent discovery inventory is retained as research history. The authoritative final absence classifications and assumptions are in `data/walters/nfl/2026/week-02-weekly-evidence/2026-09-22-full-slate-approved-estimates.json`. Estimated values, brief-return duration priors, snap-based upper bounds and historical QB-scale limitations are disclosed there; these are modelling estimates, not measured medical effects.
