# VigScope Value

The primary navigation supplies the page title. `results-value-desk-v2.js` is the sole Value renderer; it loads the full results index once and the separate Graham comparison. Previous Value overlays remain available in source but are not loaded.

Pizza tracking appears first, then Graham versus Pinnacle, calibration highlights, the latest report watchlist, detailed shadow diagnostics, audit counts and the full historical explorer. Follow buttons save device-local pins. Report updates compare saved quotes from the latest two same-day reports and distinguish book switches from price changes.

## Counting rules

- Market, status and sport performance use the last issued appearance of each exact selection. Opposing sides and different lines remain separate. Date and decision filters apply after that selection.
- Report-lane performance and the default card log retain every recommendation appearance. These counts are not customer wagers.
- The full archive is visible through pagination, date/sport/status/lane filters, open/settled filters, every-card/final-selection views and saved-analysis expansion.
- Pending cards stay OPEN and contribute no win, loss or profit. Completed unpriced cards retain their grades but contribute no ROI. Priced pushes and voids remain in the risk denominator.
- BET recommendation ROI uses issued cash stakes. Pizza and shadow retain their historically frozen unit definitions. Historical market/status/sport returns use hypothetical 1u risk at each exact saved price.
- Prices are displayed through the shared American-odds formatter. ROI always includes a percent sign; abbreviated markets have readable names.

## Graham versus Pinnacle

`build-graham-pinnacle-value.mjs` reads saved weekly ledgers and verified final-score receipts without modifying either. Only timestamped observations at or before kickoff qualify. Ordered teams and kickoff must match the final receipt; conflicting receipts remain pending.

Choose home when Graham's home fair line is lower than Pinnacle's home line; otherwise choose away. Identical lines choose the favourite, or home on a pick'em, and still count. Favourites, dogs and Graham selections are graded on the same filtered games. Win rate excludes pushes. Standardized returns risk 1u at -110 for all strategies and are explicitly illustrative; missing away prices are not invented.

The initial weeks 1–3 dataset has 48 settled games: Graham 25–20–3, favourites 22–23–3, dogs 23–22–3. None has a saved CLOSE receipt, so these are labelled latest saved pre-kickoff quotes. Weekly/side/gap filters, score-margin MAE/RMSE, cumulative returns, maximum curve decline and the source-linked game ledger are retained.

The results-index workflow refreshes the comparison when weekly ledgers or final facts change. Rendering and filtering do not rewrite prices, decisions, stakes or settlement grades.
