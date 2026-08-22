# Season Preview Source PDFs

Upload Meat Desk source PDFs to this folder.

Examples: season magazines, annual guides, preview books, team/league guides, and other long-form preseason reference material.

This folder is the source of truth for the active Meat Desk shelf. When a PDF is added or deleted on `main`, the `Sync Meat Desk sources` workflow automatically rebuilds `research/season-previews/manifest.json`.

- New PDFs are registered as `PENDING ANALYSIS` and queued for a one-time full-source review.
- Existing source metadata and publication state are preserved while the PDF remains in this folder.
- Deleting a PDF removes that source from the active Meat Desk manifest automatically.
- The saved research index and published analysis are separate outputs; raw source material does not create or upgrade a BET by itself.

The existing Betting Edge engine remains the betting-decision layer. Meat Desk sources provide reference and season-context intelligence.

Because this repository is public, only commit PDFs you are permitted to redistribute publicly.
