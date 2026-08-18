# Syndicate Character Factory

This factory creates additional saved Syndicate characters without increasing the four-slot runner capacity.

## What a new character receives

- a stable character/profile ID;
- a randomly assembled editable trait profile using `trait-pools.json`;
- a generated display name, nickname and publication name that may all be changed later;
- a generic `👤` card/avatar placeholder;
- `headshot: null` until a permanent JPEG is supplied;
- the shared Syndicate-card accent `#c9a43b` so every character selection uses the same gold outline;
- a dedicated blank Hotline file showing `NO REPORT LOADED`;
- an enabled roster entry in `data/syndicates.json` so the character appears in the LOAD selector;
- no automatic assignment to F1–F4;
- `continuity.lastReportSeen: null` until the character is deliberately updated to an issued report.

The shared card accent is presentation-only. Individual Hotline pages may still use their own independent color palettes and visual themes.

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

These requests should be translated into edits to the character JSON.

### Rename rule

A visible rename is not a replacement character. Keep the character JSON `id`, `profileId`, roster `characterId`, character file path, and existing live Hotline URL/folder stable. Change only the visible identity fields that should actually change, such as `displayName`, nickname, roster `name`, title/publication text, avatar, or style.

Previously archived Hotline issues are frozen under the same stable identity and retain the name that appeared when each issue was published. Future issues use the new visible name. This produces one continuous Hotline history across a rename without moving folders or rewriting old editions.

Only change the stable IDs when the user intentionally replaces the character with a different character.

## Add a permanent avatar

A newly created profile uses:

- `fallback: "👤"`
- `headshot: null`

When a JPEG is uploaded, save it under the repository assets and change only that character's `headshot`/`headshotAlt`/position as needed. Do not recreate the character or Hotline.

## First and later Hotline updates

When the character receives a report, build the edition from:

1. the authoritative issued Betting Edge report;
2. the character profile;
3. the current blank/previous Hotline;
4. the most recent archived Hotline when prior-session continuity is relevant.

Then update the live Hotline and the character's `continuity.lastReportSeen`, `currentMood`, and `ongoingThreads`. The Betting Edge recommendation remains authoritative.

Once the issued Hotline is finalized, freeze the same edition into the character's archive:

```sh
node tools/archive-syndicate-hotline.mjs --character <stable-character-id>
```

The archive lives beside the character's existing live Hotline and uses `archive/YYYY-MM-DD/HHMM.html` plus `archive/index.json`. The helper keys the archive to the stable character ID, records the visible name at issue time, and refuses to overwrite a different issue at the same date/session.

The live Hotline remains the current edition. Archiving does not change F1–F4, the slot host, or the Betting Edge runner.
