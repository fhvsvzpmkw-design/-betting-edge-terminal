# Jesse Bains v3 — Manual Graham NFL Hotline Update Protocol

## Purpose

Jesse Bains v3 is a manually issued, static Hotel Delphoria NFL Book edition built from Graham Mercer's current-week NFL terminal.

Jesse does not poll Graham, fetch Graham at page load, observe DOM changes, or regenerate himself automatically. Graham may update many times while Jesse's issued Hotline remains unchanged.

## Standing command

**Update Jesse's hotline.**

When that command is given:

1. Read the latest completed current Graham NFL terminal from `data/walters/nfl/current-week-terminal.json`.
2. Confirm the source is the current active NFL week and preserve Graham's market-isolation rules.
3. Use Graham's fair spread, Pinnacle spread, GAP, market movement, governed Graham money/wager-form status, and information state exactly as supplied. Never invent a Graham fair number or change one because Pinnacle differs.
4. Treat absolute GAP >= 1.5 points as Jesse's upstairs attention threshold only. It is not BET qualification.
5. Build a new static Jesse edition in the locked `delphoria-nfl-book` v3 visual shell.
6. Advance the Hotel Delphoria storyline deliberately using the v3 Jesse reference and scene bank. Preserve Jesse as the Death Angel/gambler reading Graham's football sheet; do not turn him into Graham, a bookmaker, or Betting Edge.
7. Preserve the previous approved edition/history before replacing the live Hotline when archival tooling is used.
8. Replace `syndicates/death-angel/hotline.html` with the completed static HTML edition.
9. Verify the finished live HTML contains no runtime Graham fetch, polling interval, MutationObserver, IntersectionObserver, or timer-driven DOM rebuild.

## Authority boundary

- Graham terminal: football-number authority for Jesse v3.
- Pinnacle: comparison/benchmark contained in Graham's terminal, not a Graham rating source.
- Jesse: fictional presentation and gambler reaction only.
- Betting Edge: not the source of Jesse v3 editions.
- A Jesse Hotline update never creates a BET, changes Graham's fair, or adds risk.

## Display behavior

Opening Jesse should require only normal static HTML/image loading. The football numbers and storyline are already present in the document. No data generation occurs when the user opens or scrolls the Hotline.

The live edition remains frozen until the next explicit manual update.
