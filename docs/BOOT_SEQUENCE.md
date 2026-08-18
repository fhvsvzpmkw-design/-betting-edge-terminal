# VigScope Boot Sequence

**Last updated:** 2026-08-18  
**Status:** Screen 2 deployed with visibility/timing gate

Boot order on every short-link refresh:

1. Existing `r.html` VigScope splash
2. `VigWire Labs` Screen 2 — locked V2V2 artwork
3. `VigScope Terminal UI v1.4`

Implementation boundary:

- `runner.html` is the thin Screen 2 boot wrapper and owns presentation/UI version v1.4.
- `runner-core.html` is the preserved report runner/core v1.3 logic.
- `assets/splash-02-vigwire-labs-v2v2.png` is the deployed Screen 2 asset.
- Screen 2 is displayed in full with `object-fit: contain`; no cropping.
- The wrapper waits until its host is visibly displayed before starting the 3000 ms minimum Screen 2 display window.
- If the Screen 2 asset fails, the wrapper displays an explicit VigWire Labs fallback instead of silently skipping the screen.
- The runner core preloads behind Screen 2 and is revealed only after both the minimum display window and core load complete.
- Existing report payloads, short IDs, local-storage keys, repricing behavior, scheduler, odds workflow, Contract 0.9, and Research Library behavior are unchanged.
