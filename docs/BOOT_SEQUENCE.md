# VigScope Boot Sequence

**Last updated:** 2026-08-16  
**Status:** Screen 2 deployed with Safari paint gate

Boot order on every short-link refresh:

1. Existing `r.html` VigScope splash (unchanged)
2. `VigWire Labs` Screen 2 — locked V2 artwork
3. `VigScope Terminal UI v1.3`

Implementation boundary:

- `runner.html` is the thin Screen 2 boot wrapper.
- `runner-core.html` is the preserved pre-wrapper v1.3 runner logic.
- `assets/splash-02-vigwire-labs-v2.webp` is the deployed Screen 2 asset.
- Screen 2 is displayed in full with `object-fit: contain`; no cropping.
- Safari visibility hardening requires artwork load/decode, actual wrapper visibility, two paint frames, and a 3000 ms minimum display window before Screen 2 may hand off.
- If the Screen 2 asset fails, the wrapper displays an explicit VigWire Labs fallback instead of silently skipping the screen.
- The runner core preloads behind Screen 2 and is revealed only after both the paint/display gate and core load complete.
- Existing report payloads, short IDs, local-storage keys, repricing behavior, scheduler, odds workflow, Contract 0.9, and Research Library behavior are unchanged.
