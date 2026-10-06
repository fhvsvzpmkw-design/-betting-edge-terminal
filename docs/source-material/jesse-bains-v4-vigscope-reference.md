# Jesse Bains v4 — Delphoria House Board

The user’s October 6, 2026 rebuild replaces the live Graham-only NFL v3 edition with a manually issued Betting Edge / VigScope sheet containing BETs, LEANs and the five highest measured edges. This is an explicit new source boundary and shell version. Historical v1/v2/v3 shells, references and issued editions remain preserved.

## Character and world

THE SPORTS DESK AT THE HOTEL DELPHORIA remains the publication. Death Angel remains Jesse’s identity inside it. Preserve the main Jesse portrait and existing matching Delphoria artwork.

Jesse is the feared criminal power figure first and gambler second. He is never a bookmaker, line-maker, quant or independent analyst. Use the existing `jesse-bains-canon-language-guide.md` and `jesse-bains-scene-bank.md`: PQ1/PQ2 identity, controlled economical menace, short practical reactions, implied non-graphic danger and late-1980s language.

Keep the low-rent counter, carbon slips, crooked stamps, cheap yellowed paper, cocktail lounge, back-room poker, worn elevator, private rooms and penthouse atmosphere. Rotate two to four scene modules per edition. A Delphoria House Note contains one specific setting detail, written from inside the Delphoria world. It is not a betting recap, generic biography or explanation of its source. Police Quest, PQ1/PQ2, Sierra, walkthroughs and game-canon commentary are internal production references only and must never appear in published copy. Fiction is atmosphere, never evidence. Current teams and prices live in an edition, never in permanent identity.

## Factual authority and order

1. Read `run-history.json` and choose the latest completed stored report, not live odds alone. Pin its immutable report path, report timestamp, slot, label and Git blob SHA in a new `data/jesse/editions/<id>.json`.
2. Show every report BET first, then every LEAN. Preserve source order within each call. Display exact selection, game, book, recorded price, stake, play-to, start and source rationale. Never promote a call. An empty BET section explicitly states no authorized BET and the report’s risk.
3. Separately rank the five largest finite `benchmarkComparison.edgeProbabilityPoints` values, descending by signed value. Keep the original call and stake on every row. Negative values stay negative. If fewer than five measurements exist, show the available rows. A forecast probability percentage is not an edge and must never be parsed into one.
4. These comparisons are probability points versus a market reference, not independently established fair probability, expected ROI or profit. Forecast-backed LEANs can disagree with that market reference; do not reorder their governed calls around the comparison alone.
5. Include only events with a supplied start after the source report’s issue time. Label the sheet as issued, with recorded quotes, not a live price recheck. Preserve unresolved information, integer-line settlement constraints and zero stakes. Do not manufacture money or betting clearance.

## Manual update

`Update Jesse’s hotline` means prepare a new report-pinned edition and deliberate story in the locked `delphoria-house-board` v4 shell, then run:

```sh
node tools/build-jesse-hotline.mjs --edition data/jesse/editions/<id>.json
node tests/jesse-hotline.test.mjs
```

Use a new edition id. Keep previous issued HTML and edition records immutable. The builder checks the report blob identity, fills static HTML, archives it with working relative artwork links, updates the archive index, the current-edition pointer and character continuity. No research, wager execution or scheduled refresh is created by loading the character.

The page must have no runtime fetch, polling, observers, timers or automatic DOM regeneration. Preserve the masthead, artwork, section order, shell and world during normal edition updates. `data/jesse/current-edition.json` identifies the current issued record. The older v3 instructions apply only to historical v3 editions.

## Publication checks

Before publishing, the builder rejects source-game references in all authored public copy. House and Back Room sections have exactly two grid children: the approved illustration and one complete text container holding the heading and every paragraph. Use a zero-minimum flexible text column so paragraphs remain readable on tablet and stack across the full width on phones. Validate these sections in a rendered layout as well as checking source content and archive continuity.
