# Full Week 3 recovery — method review

Status: draft, not production authority. Scope: every one of the 16 Week 3 games.

The published receipt still records one completed Week 2 pair (CLE–TB). Its two Week 3 rating-base refreshes remain intact. This draft does not stage another rating batch, change a fair number, or claim that the remaining games are complete.

## Concrete proposed calculation changes

`graham-historical-exposure.mjs` implements an elapsed-game-time estimate for a documented absence. Exact departure/return times produce an exact time fraction; imprecise reports produce a bounded interval and an explicitly assumed midpoint. The value loss is the existing replacement-aware difference multiplied by that fraction. Active play is valued normally as an explicit modelling assumption, not a medical conclusion. Rotation and performance benchings cannot be inferred to be injuries from snap counts.

The proposed evaluator integration also supports a historical QB replacement difference on the original locked Madden conversion, without changing the current-week QB performance model. This historical valuation choice needs reconciliation with the activated QB-performance authority before adoption. The draft supports a value-invariant healthy-QB competition; it rejects unequal candidate values and missing identities. It does not charge two unavailable quarterbacks as two starting roles.

For position groups whose calibration requests review rather than specifying a multiplier, the draft accepts an explicit disjoint-role assessment with an additive, no-extra-multiplier estimate. Existing calibrated receiver and defensive-line multipliers remain unchanged. The extra interaction effect is an assumption requiring adoption, not a measured zero.

These are proposed extensions beyond the currently documented v1.5 completion methods. They are not silently presented as existing approved numerical authority.

## Source reconciliation findings

- Detroit's game-day offensive line used Borom, Bartch and Scruggs for Miller, Mahogany and Mays. [Official postgame observations](https://www.detroitlions.com/news/detroit-lions-week-2-observations-stbrown-hutchinson-gibbs).
- Buffalo lost Oliver before kickoff and Moore during the second quarter. [Official injury review](https://www.buffalobills.com/news/injury-updates-following-tnf-deone-walker-s-steady-play-and-bills-using-upcoming-rest-to-their-advantage).
- Minnesota's reserve inventory includes Mason; Chicago's Williams left during the fourth quarter and Bagent finished. [Vikings transaction](https://www.vikings.com/news/jordan-mason-injured-reserve-deejay-dallas-signing-2026), [Bears recap](https://www.chicagobears.com/news/game-recap-bears-fall-to-1-1-with-loss-to-vikings).
- Miami's earlier Chop Robinson committee cannot be reused unchanged: its transactions show Ojabo released and Trey Moore on injured reserve. [Official transactions](https://www.miamidolphins.com/team/transactions/2026).
- Indianapolis lost Pierce in the first quarter; Dulin and Giddens were inactive. Treadwell supplied documented relief at receiver. [Final inactive list](https://www.colts.com/news/colts-announce-6-inactive-players-for-week-2-game-vs-kansas-city-chiefs), [Pierce report](https://www.colts.com/news/x-rays-on-left-heel-negative-for-wr-alec-pierce), [role review](https://www.colts.com/news/5-colts-things-daniel-jones-offense-handle-steve-spagnuolo-s-blitzes-laquon-treadwell-steps-up-kapena-gushiken-flashes-in-week-2-loss-to-chiefs).

The adjacent working inventory covers all 30 remaining teams and 278 discovery entries. It deliberately is not an absence total: some names need aliases, retained-roster checks, camp-role exclusions, or game-time participation review. Dallas's transaction endpoint was unavailable. No unavailable endpoint is treated as evidence of no injuries.

## Missing-value boundary

Some independent pages report ratings for identities absent from both the frozen registry and the committed official EA supplement, for example [Elijah Mitchell, 72](https://www.maddenratings.com/elijah-mitchell). Other pages explicitly have no rating, including [Sione Takitaki](https://www.maddenratings.com/sione-takitaki), [D.J. Turner](https://www.maddenratings.com/dj-turner), and [Terrell Jennings](https://www.maddenratings.com/terrell-jennings). An absent rating cannot become zero. The currently accepted supplement path only permits a bound official EA capture. Secondary-source values have not been admitted by this draft.

Completing every pair requires either resolving these players' actual baseline duties and recovering supported values, or explicitly adopting a broader estimation policy. Such a policy would need to state its permitted source hierarchy, treatment of genuinely unrated established contributors and specialists, uncertainty ranges, and publication labels. No substitute point values have been invented here.

## Verification and next gate

The six time-exposure unit checks and the existing historical completion, weekly evidence, role-chain, routing, rating-base-refresh and exact 90/10 tests pass locally. This does not validate real game totals. Before production: complete final coverage for each pair, reconcile/adopt the new methods, add integration acceptance cases, run immutable evidence validation, stage through the existing updater, verify remote receipt, then separately refresh and verify the full Week 3 board.
