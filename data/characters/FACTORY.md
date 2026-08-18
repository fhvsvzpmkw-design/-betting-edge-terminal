# Syndicate Character Factory

This factory creates additional saved Syndicate characters without increasing the four-slot runner capacity.

## What a new character receives

- a stable character/profile ID;
- a randomly assembled editable trait profile using `trait-pools.json`;
- a generated display name, nickname and publication name that may all be changed later;
- a generic `👤` card/avatar placeholder;
- `headshot: null` until a permanent JPEG is supplied;
- a dedicated blank Hotline file showing `NO REPORT LOADED`;
- an enabled roster entry in `data/syndicates.json` so the character appears in the LOAD selector;
- no automatic assignment to F1–F4;
- `continuity.lastReportSeen: null` until the character is deliberately updated to an issued report.

## Create

From a checkout of the repository:

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

## Conversational editing

Natural-language commands remain the preferred editing interface. Examples:

- `Rename Frank DeMarco to Frankie D.`
- `Make him more sarcastic and less serious.`
- `Keep the private-sheet personality but make the Hotline look like a late-1980s casino newsletter.`
- `Make underdogs his primary obsession.`
- `Reset his current storyline without changing his stable personality.`

These requests should be translated into edits to the character JSON. Keep the stable `id` and `profileId` unless the character is intentionally being replaced rather than renamed.

## Add a permanent avatar

A newly created profile uses:

- `fallback: "👤"`
- `headshot: null`

When a JPEG is uploaded, save it under the repository assets and change only that character's `headshot`/`headshotAlt`/position as needed. Do not recreate the character or Hotline.

## First Hotline update

When the character receives a report, build the edition from:

1. the authoritative issued Betting Edge report;
2. the character profile;
3. the current blank/previous Hotline.

Then update the Hotline and the character's `continuity.lastReportSeen`, `currentMood`, and `ongoingThreads`. The Betting Edge recommendation remains authoritative.
