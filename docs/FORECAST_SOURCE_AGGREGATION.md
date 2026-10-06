# Expanded forecast intake and aggregation

Effective from 2026-10-06 10:05:06 America/Vancouver. Applies to all five Main lanes through `BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md`. Historical captures, reports and decisions retain their original evidence and timing.

Customer value includes possible BETs, directional LEANs and resolution of genuinely close or conflicting cases. Review BET first, then LEAN, WAIT or PASS under the existing decision contracts. More source names do not by themselves justify stronger confidence or more cards.

## Source routes

| Source | Useful fields and scope | Current intake |
|---|---|---|
| [The Prediction Tracker](https://www.thepredictiontracker.com/) | NFL/NCAAF spreads and totals; NBA routes; catalogs multiple original systems | Research or permitted import. Preserve the original model family; a catalog is not an independent model or proof of live forecasts. |
| [Bet Better](https://betbetter.world/predicted-scores/nfl) | NFL/NCAAF/MLB/NBA/WNBA/NHL score projections and published home win probability when available | Public score CSV under CC BY 4.0, with attribution. One shared request per sport; no locked picks endpoint. Empty/missing rows remain unavailable. |
| [PlayerWon](https://www.playerwon.ca/) | NHL published win probabilities | Research or permitted import; no established free commercial feed. Related versions count as one family. |
| [Covers / OddsShark](https://www.covers.com/picks/nhl) | Projected scores and matchup context across supported sports | Research or permitted import. Book-implied percentages and expert picks are separate from computer model probabilities. |
| [The Margin](https://margin.mcconnelldigital.com/data/) | NFL/CFB weekly spreads, ratings and published model fields | Research or permitted import; verify current export and reuse permission. NFL `market_total` is the book total, not a predicted total. SP+ and market priors remain disclosed dependencies. |
| [MoneyPuck](https://www.moneypuck.com/) | Both native NHL full-game win probabilities, separately preserved regulation/OT and raw model/book components | Verified non-commercial public CSV collector. Exact daily preview plus game/team-code matching; 15-minute cache. Displayed probabilities have observed market dependence. Original clocks and report-time goalie/settlement reviews remain required. |
| [Podium Oracle](https://podiumoracle.com/) | NHL published win probabilities | Research or permitted import; commercial/bulk reuse needs written permission. Do not treat absent xG or unconfirmed goalie inputs as resolved. |

Current VigScope use is **non-commercial**, as confirmed by the user on October 6, 2026. MoneyPuck's live native forecast collection was verified for all nine current games before connection and feeds the existing exact-market assessment path. Use actual captured forecasts in possible BET and LEAN reviews, retaining contrary evidence; a source route alone is not collected coverage. Historical/statistical downloads remain context, and are never relabeled as pregame predictions.

The registry owns precise URLs, fields, market roles and access limitations. Free public reading is distinct from permission to operate a commercial feed. Never bypass a lock or describe research-only routes as collected predictions. Preserve source links, published fields, original observation/model clocks, exact identity, units, dependence, limitations and attribution.

## Intake and review

`collect-game-intelligence.mjs` retrieves the documented Bet Better score CSV for applicable upcoming events. Require unique ordered teams and exact UTC kickoff. Preserve home margin as a negative home handicap, total as total points and home win probability only as actually published. Missing probabilities do not become 50%; no away complement, interval, cover probability or overtime/tie convention is inferred. The original row and export URL remain in each record. A failed request preserves original prior observations and records its failure without restamping them. Score rows enter context; unknown probability settlement requires actual review before exact-price use.

Other permitted findings use `tools/import-forecast-evidence.mjs` / the standard `forecastCapture` contract, or a permitted structured game-intelligence import. Capture permission does not establish decision eligibility. Revalidate current personnel, settlement and event assumptions. Record real inaccessibility, missing exact fields and stopped research rather than fabricating an attempt.

Prediction Tracker is a discovery catalog and context route. For an original model, reuse its registered originating source ID or add a verified original source entry with its actual family and permissions before import. Do not override a registered family to invent independence; a catalog-only record remains catalog context.

The event work plan includes applicable unattempted source routes even when ESPN or a completed market decision already exists. Share one retrieval across the event's selections. Captured fields awaiting review come first. Finish supported decisions incrementally; source coverage gaps do not veto unrelated completed cards.

## Aggregation and decisions

`tools/forecast-aggregation.mjs` groups only compatible reviewed exact-price comparisons. Different events, kickoffs, periods, sides, lines, prices, conditional/unconditional probability bases, push mass or settlement stay separate. Related versions and syndicated copies share a family; family disagreement stays visible. Descriptive ranges and family-balanced medians summarize source points, not calibration, independence or uncertainty bounds. Market-dependent families remain marked.

Native score/spread/total ranges stay in their original units as context. Do not average them with win probabilities or convert them without a supported model. The producer combines all applicable external points, internal Graham/Walters fair, official personnel, event research, executable prices and Pinnacle reference. Disposition every eligible exact record, including opposition. Existing card evidence and publication validation remain authoritative.

BET still requires a defensible fair/range, conservative-bound clearance, model-error and independence support, material personnel checks, current execution, playTo, exposure and staking. A family majority does not award BET. When those checks fail, assess directional LEAN and then WAIT/PASS on their own rules. Preserve the actual reason and any named recheck; unfinished work is not a completed status.

The game board displays captured source fields, projection context and reviewed support/opposition at the exact price. Its source coverage reports actual collection state. It issues no grade or stake. The shared scheduled authority carries this behavior to the 06:00, 08:00, 09:30, 15:15 and 18:15 reports.

## Verified MoneyPuck connection

From 2026-10-06 10:55 America/Vancouver, the shared collector uses the current non-commercial project scope to read the public daily preview and its matched native CSVs. All nine October 6 CSVs returned HTTP 200 before implementation. Daily team labels, logo codes, Eastern date/time and native game/team codes must match. The two `preGame*TeamWinOverallScore` fields must sum to one, equal each side's regulation plus OT components and match the rounded daily display. Preserve actual values for both sides; no complement or book-implied probability is substituted. Empty, duplicate, mismatched, inconsistent, started and failed responses do not become fresh forecasts.

The verified sample's overall home field equals the mean of `preGameMoneyPuckHomeWinPrediction` and `preGameBettingOddsHomeWinPrediction`. This is an inference from all nine native rows, and is retained as observed market dependence. Preserve both raw components and the arithmetic receipt; count one MoneyPuck family. The connected paired fields correspond to the displayed full-game probabilities, while the raw model component and source betting probability remain separate context.

The connection is authorized by the user for the current non-commercial deployment. MoneyPuck's policy separately requests publisher approval for scraping unlisted data; none is asserted by this connector. Requests use a named client, bounded concurrency and a 15-minute cache, with ordinary HTTP only and no access-control bypass. Original observations survive refresh failure; the source snapshot does not supply report-time personnel clearance, calibration or BET authority.
