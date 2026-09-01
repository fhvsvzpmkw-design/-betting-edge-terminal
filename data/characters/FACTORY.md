# Syndicate Character Factory

This factory creates additional saved Syndicate characters without increasing the four-slot runner capacity.

## What a new character receives

- a stable character/profile ID;
- a randomly assembled editable trait profile using `trait-pools.json`;
- a generated display name, nickname and publication name that may all be changed later;
- a generic `👤` card/avatar placeholder;
- `headshot: null` until a permanent image is supplied;
- the shared Syndicate-card accent so character selection remains visually consistent;
- a dedicated blank live Hotline showing `NO REPORT LOADED`;
- a dedicated editable `shell.html` visual shell;
- a portable shell entry in `data/hotline-shells.json`;
- an enabled roster entry in `data/syndicates.json` so the character appears in the LOAD selector;
- no automatic assignment to F1–F4;
- `continuity.lastReportSeen: null` until the character is deliberately updated to an issued report.

The character library may grow beyond four. The loaded Syndicate remains four slots maximum.

## Create

```sh
node tools/create-syndicate-character.mjs
```

Optional deterministic seed:

```sh
node tools/create-syndicate-character.mjs --seed 12345
```

Optional initial display name:

```sh
node tools/create-syndicate-character.mjs --name "Frank DeMarco"
```

Preview without writing:

```sh
node tools/create-syndicate-character.mjs --dry-run --seed 12345
```

The script never modifies `defaults` or `slots` in `data/syndicates.json`.

## Character + shell + edition

The Syndicate system deliberately separates three layers:

1. **Character** — identity, voice, editorial behavior and continuity.
2. **Hotline shell** — visual presentation, CSS, masthead, page architecture and content zones.
3. **Hotline edition** — the current authoritative source rendered through that character and shell.

A character may later use another compatible shell without becoming a different character. A shell may later be distributed independently as a free or paid installable asset without carrying character identity or source authority with it.

## Shell lifecycle

A generated character begins with:

`SHELL v1 // EDITABLE`

After deliberate visual review it may become:

`SHELL v1 // APPROVED / LOCKED`

A later deliberate redesign creates v2 rather than silently rewriting the approved v1 design.

Normal Hotline report updates follow one rule:

**REFRESH THE EDITION; PRESERVE THE PAGE.**

Report content, stories, recommendations and reactions may change. Approved-shell CSS, masthead construction, page width, major section order, typography hierarchy and responsive rules do not change unless a new shell version is intentionally created.

## Conversational editing

Natural-language commands remain the preferred editing interface. Examples:

- `Rename Frank DeMarco to Frankie D.`
- `Make him more sarcastic and less serious.`
- `Keep the private-sheet personality but make the Hotline look like a late-1980s casino newsletter.`
- `Make underdogs his primary obsession.`
- `Redesign his visual shell and create v2.`
- `Reset his current storyline without changing his stable personality.`

### Rename rule

A visible rename is not a replacement character. Keep the character JSON `id`, `profileId`, roster `characterId`, existing live Hotline URL/folder and archived history stable. Change only visible identity fields that should actually change.

Previously archived Hotline issues retain the visible name and presentation that were published at issue time. Future issues use the new visible name.

Only change stable IDs when the user intentionally replaces the character with a different character.

## Add a permanent avatar

A newly created profile uses:

- `fallback: "👤"`
- `headshot: null`

When an image is supplied, save it under repository assets and change only that character's headshot metadata. Do not recreate the character, shell or Hotline.

## Source-specific live desks

A character may deliberately stop being a normal Betting Edge report derivative and declare another durable source of truth. This is a product-boundary change, not fictional flavor.

When a source-specific desk is created:

1. add an explicit `authority` block to the character profile;
2. name the exact authoritative repository source;
3. state whether the desk itself has betting authority;
4. create a new shell version when the page architecture materially changes;
5. preserve all earlier shell files and archived issues unchanged;
6. use `cache: 'no-store'` when the live desk reads a current repository feed;
7. add/update guardrail tests so the live source path and authority boundary are verified.

A source-specific live desk does **not** need to equal the latest archived report edition byte-for-byte. The pre-transition archive remains immutable historical evidence; the new live desk follows its declared source.

Example: Jesse Bains v3 declares `data/walters/nfl/current-week-terminal.json` as an NFL-only Graham-terminal source. Jesse is presentation/reaction only and is not betting authority. His v1/v2 Betting Edge editions remain frozen in `syndicates/death-angel/archive/`.

## First and later report-driven Hotline updates

For a normal report-driven character, build the edition from:

1. the authoritative issued Betting Edge report;
2. the character profile;
3. the active approved shell from `data/hotline-shells.json`;
4. the current/previous Hotline;
5. the most recent archived Hotline when prior-session continuity is relevant.

The Betting Edge recommendation remains authoritative. The shell is presentation only.

Then update the live Hotline and the character's `continuity.lastReportSeen`, `currentMood`, and `ongoingThreads` only when the character actually advances to a newer report.

Once the issued Hotline is finalized, freeze the same edition into the character archive:

```sh
node tools/archive-syndicate-hotline.mjs --character <stable-character-id>
```

The archive lives beside the character's live Hotline and uses `archive/YYYY-MM-DD/HHMM.html` plus `archive/index.json`. Archive files are immutable.

The live Hotline remains the current edition. Archiving or changing shells does not change F1–F4, the slot host, or Betting Edge runner logic.
