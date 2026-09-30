# Confirmed starters without a qualifying QB sample

Operational under the user's September 30, 2026 project authorization. The existing QB calculator remains the sole numeric writer. The frozen player registry and embedded team baselines are unchanged.

Use `RESOLVED_CURRENT_STARTER_PRIOR_ESTIMATE` in a unique active-week QB staging batch only for an officially confirmed named starter whose frozen registry status is `BLOCKED_INSUFFICIENT_QB_SAMPLE`, whose performance blend and sample reliability are zero, and whose candidate equals its numeric frozen prior. Bind exact player identity, team, an allowed official league/team source URL, its actual observation time and a clear starter finding in `starterEvidence`. Unnamed, expected, conditional and out-of-registry starters stay unresolved. Numeric staging times cannot be in the future.

The calculator takes the frozen prior directly; producers cannot submit a new value. It labels the method `GRAHAM_FROZEN_QB_PRIOR_ESTIMATE_V1`, confidence LOW and the lack of an NFL sample. Both the production validator and Core handoff retain this limitation. This is a Graham model estimate, not an empirical probability, a performance-approved candidate or a reason to bypass BET or staking checks.

September 30 example: Tampa Bay's official club report names Jalon Daniels for Week 4 while Baker Mayfield is out. Daniels' frozen prior is 6.0 against the unchanged 8.5 embedded baseline. The calculator replaces the old QB differential once and preserves personnel, home field, neutral ratings and history. Chicago and Washington remain unresolved; conditional possibilities are not promoted to named starters.

Verify with `node tests/walters-qb-prior-estimate.test.mjs`, the full QB production regression suite, `--check`, the production validator and remote workflow/board readback.
