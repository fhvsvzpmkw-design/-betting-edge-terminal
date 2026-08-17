# Hotline Unit — Future Product / Delivery Contract

**Status:** FUTURE VISION — NON-OPERATIONAL  
**Created:** 2026-08-16  
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Relationship to production:** This document does **not** modify Betting Edge production contract v0.9, runner behavior, report generation, scheduled lanes, pricing, staking, history, or current delivery. It preserves an approved future product direction so later implementation does not depend on conversational memory.

---

## 1. Product role

The **Hotline Unit** is the intended future delivery shell for Betting Edge reports.

It is deliberately a **basic pager-style receiver**, not a replacement for the Betting Edge terminal. The Hotline Unit handles subscription/feed loading, incoming-page presentation, light supporting information, and the handoff into the existing terminal report experience.

The terminal remains the analysis destination and does the heavy information work.

Core flow:

`PAGE RECEIVED -> OPEN PAGE -> SPLASH -> LINKED TERMINAL REPORT`

---

## 2. Default Hotline Unit

The default device is a fictional handheld **Hotline Unit** with a vintage pager / compact terminal character.

Design intent:

- retro handheld communications hardware;
- terminal-style display treatment;
- strong pager identity rather than a generic modern app dashboard;
- enough screen space to show useful report/page language clearly;
- tactile, slightly underground/intelligence-desk atmosphere without making the hardware itself unnecessarily complex.

The default Hotline Unit may be more capable and readable than a historically exact pager. That is intentional.

---

## 3. Vintage pager skins

Future alternate **skins** represent different vintage pager hardware copies/styles.

A skin may change:

- pager era and form factor;
- casing shape/material;
- bezel proportions;
- LCD/display size and treatment;
- button arrangement;
- clip/antenna/indicator details;
- historically appropriate colors, plastics and backlighting.

Vintage skins should aim for credible historical pager design rather than making every device a green terminal.

**Skins are hardware appearances only.** They are not syndicate names, feed names, folders, or report categories.

The default Hotline Unit remains the primary product identity; vintage pager looks are optional alternate presentations.

---

## 4. Syndicate loading model

The Hotline Unit supports a maximum of **four syndicate slots**.

The intended in-device action label is:

> **LOAD YOUR SYNDICATE**

A user enters a syndicate code to activate/load a feed entitlement into an available slot.

Each loaded slot may represent a separate paid subscription or add-on.

Conceptual activation flow:

`LOAD YOUR SYNDICATE -> ENTER CODE -> VERIFY -> SLOT LOADED -> STANDING BY FOR PAGES`

The word **syndicate** is approved as in-product flavor language for the Hotline Unit concept. It is not presently intended to be the formal company or app name.

---

## 5. Code and link behavior

The Hotline Unit is a receiver. A syndicate code ultimately gives the unit access to the appropriate report/feed destination.

Future implementation should preserve these principles:

- the user enters a code rather than manually configuring repository/file locations;
- the code resolves an authorized syndicate/feed entitlement;
- the unit can receive/open the link associated with an incoming report;
- the user should not need to know the underlying storage path;
- codes should not expose raw repository credentials or sensitive backend locations;
- entitlement can later be made revocable, renewable or subscription-bound without changing the pager interaction model.

The simplest user mental model remains: **enter code, receive pages, open report**.

---

## 6. Incoming pages

Incoming reports should behave like pager messages.

At minimum, a page may expose:

- source/syndicate slot;
- issued time;
- short alert/title;
- unread/read state;
- report destination.

Opening a page must resolve the exact report that generated the alert rather than merely opening a generic current terminal screen.

The Hotline Unit is allowed to keep page copy short and pager-like even when the linked terminal report is extensive.

---

## 7. Splash and terminal handoff

The intended report-opening path is:

1. user selects an incoming page;
2. Hotline Unit opens the report link;
3. branded splash/transition appears;
4. the exact linked terminal report loads.

The splash is the bridge between the pager-delivery identity and the full Betting Edge terminal identity.

Stable report IDs / stable report links are therefore strategically useful even before the Hotline Unit is implemented.

---

## 8. Additional-information folders

The Hotline Unit may include a small set of **funny / in-world folders** for additional supporting information beyond the incoming report pages.

Their purpose is secondary information, not replacement of the terminal report.

Folder naming and exact contents are intentionally **TBD**. The design should allow humorous personality without confusing these folders with:

- syndicate slots;
- pager skins;
- the primary incoming-page inbox;
- the authoritative terminal report.

---

## 9. Paid subscription model

The four syndicate slots create a natural future entitlement model:

- one Hotline Unit can carry up to four loaded syndicates;
- each slot can be independently authorized;
- a user may pay for one or several syndicate/feed subscriptions;
- adding another paid feed should not require replacing the device or reinstalling the product;
- the Hotline Unit acts as the receiver while the loaded syndicates represent the content subscriptions.

Pricing, billing platform, account system and actual commercial terms are outside the scope of this future contract.

---

## 10. Branding boundary

Company name, app name, Hotline Unit name, syndicate/feed names and pager skins are separate concepts.

Future branding work should support centralized configuration so a company/app rename does not require manual replacement throughout the repository.

The current name-clearance / branding work may proceed before any Hotline Unit implementation.

The Hotline Unit concept must not force the project to retain the current Betting Edge name.

---

## 11. Near-term boundary

The Hotline Unit is **not a current implementation requirement**.

Near-term work may continue on:

- company/app name clearance and renaming;
- centralized branding;
- current terminal/report development;
- scheduled report reliability;
- history/provenance;
- existing compact report links.

No current runner or report-generation behavior should be changed merely to simulate the Hotline Unit early.

Where inexpensive, future-compatible architecture is preferred—for example stable report IDs, stable links and clean separation between delivery shell and terminal destination.

---

## 12. Future implementation phases

When the concept is deliberately activated, implementation should be staged:

### Phase A — Interaction prototype

- default Hotline Unit shell;
- four visible syndicate slots;
- `LOAD YOUR SYNDICATE` interaction;
- basic inbox/page presentation;
- page -> splash -> terminal routing.

### Phase B — Entitlement layer

- syndicate-code verification;
- paid access mapping;
- slot persistence;
- revocation/renewal behavior;
- secure report-link resolution.

### Phase C — Delivery layer

- new-report alerts;
- unread/read state;
- optional pager-style audio/haptics;
- exact report deep linking.

### Phase D — Skin system

- default Hotline Unit retained as flagship;
- historically grounded pager skins added as optional appearances;
- skin choice must not alter feed entitlement or report content.

### Phase E — Supporting folders

- define humorous/in-world folder names;
- define additional-information contents;
- preserve a clear boundary between supplemental information and authoritative reports.

---

## 13. Governing principle

> **The Hotline Unit receives the intelligence; the terminal explains it.**

Keep the receiver simple, preserve the pager illusion, and let the existing terminal remain the deep analytical destination.
