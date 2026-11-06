# Opportunity pricing and source feedback

The user reported low value for the usage consumed and asked for a concrete change. The November 5 15:15 report had 94 PASS, no BET/LEAN/WAIT and eight distinct source gaps. Its saved researcher receipt records proposed UTSA/Miami opinions that did not reach the candidate because their captured forecasts failed structural eligibility. This is a research-to-decision capability gap, not evidence that those opinions would win or support wagers.

## Verified cause and forward correction

The shared collector already saves ESPN native `predictor.homeTeam.gameProjection` and `predictor.awayTeam.gameProjection` fields with exact ordered teams, kickoff, provider URLs, original observation clocks and source excerpts. November 5 preserved records contain these actual probabilities for NBA and NCAAF. The registry still restricted ESPN in both sports to context-only use. Separately, NCAAF collection kept its settlement/basis unknown even when both native pregame probabilities were present and summed to 100 percent for an ordinary no-draw full-game contest.

NBA and NCAAF moneyline routes now admit ESPN exact-source candidates from their explicit `sourceEffectiveFrom` timestamps. Both the direct evaluator and coverage builder use the actual report clock, so earlier report eligibility does not change. New NCAAF collection supplies unconditional/no-push full-game semantics only after that cutover and only with both native sides present and a consistent total. A missing/inconsistent pair stays unknown. NFL/CFL tie semantics and all spread/total probability requirements retain their own routes. Original records, source clocks and issued History are not rewritten.

This verifies the availability and scope of a published outcome field. It does not establish statistical calibration, model independence, a fair-value interval or betting authority. Current event/personnel/settlement revalidation and normal directional/BET assessment remain necessary. A newly eligible field does not automatically change PASS to LEAN or BET.

Provider evidence: preserved `data/game-intelligence/current.json` at source commit `be396f5673b2c90fc0f75e0ac70e35a08583e12c`, native ESPN field captures and their originating provider URLs. ESPN's own BPI explanation describes its predictive team-strength model; its February 2021 enhanced-BPI article describes player availability and separate betting probabilities. Use the actual captured moneyline field rather than converting a rating, score or cover field.

## Cheap empirical comparison inside existing grading

The existing source grader now publishes `moneyPuckComponents` in `data/game-intelligence/performance.json`. It compares raw MoneyPuck, published overall probability and MoneyPuck's own embedded bookmaker component on identical already-graded NHL games, one selected orientation per game. Both raw components are taken from the preserved native record; away-side components are oriented explicitly. Missing components, unresolved outcomes, wrong identities and postgame observations are excluded. The benchmark is labelled `MONEYPUCK_EMBEDDED_BOOK_COMPONENT`, never Pinnacle.

It reports Brier losses and a paired raw-minus-market difference, with an approximate descriptive interval only when at least 30 pairs exist. It also reports a fixed subset starting October 14 at midnight Pacific, after the earlier October 13 study. This subset overlaps the all-games population and is a later descriptive check, not an independently preregistered validation result. No weights are fitted. No return, executable price edge, source independence or staking authority is inferred.

Before this change, the saved November 5 source-performance file contained 203 scored MoneyPuck game observations and 194 scored ESPN observations. These counts establish useful saved material, not profitable betting samples. Older ESPN records with unresolved probability basis remain unscored rather than being retrospectively repaired.

The earlier saved movement study found that following sustained moves at final prices returned -12.2 percent over 245 cases, while its favorable-price first-move subset returned +7.1 percent over 59 cases with a wide interval spanning a loss. Its raw-MoneyPuck result was also exploratory. These findings justify a narrow price-and-source question; they do not justify unqualified movement chasing or source weights.

## Existing analysts, clearer duty

The existing complete-game owners now own opportunity pricing within their games. Their meaningful candidate returns lead with executable American odds/break-even, the signed Pinnacle comparison, applicable model/native fair, strongest contrary finding and the remaining decision-sensitive question. They reuse the event package and existing typed fields. The existing reviewer challenges those numerical claims and consequential rejections. Routine broad staffing is reduced from two researchers plus one reviewer to one researcher plus one reviewer, with the coordinator owning the remaining games. Update runs still start with zero workers and allow one targeted worker routinely. Expansion needs the existing named consequential exception. No recurring task or odds pull is added.

## Verification

Focused regression coverage checks forward NBA/NCAAF source eligibility, pre-cutover context-only replay, the actual coverage clock, unresolved personnel, incomplete/inconsistent source pairs, NFL tie treatment, moneyline-versus-spread separation, component orientation, same-game deduplication and missing/late/wrong-identity exclusions. Existing forecast, source-collection, aggregation and directional-publication tests are included. The shared intelligence workflow runs the new checks and derives component results during its existing deterministic grading step.
