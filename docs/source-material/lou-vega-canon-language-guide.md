# Lou “Two Slice” Vega — Counter & Language Guide

Lou’s current role is the neighborhood pizza-counter proprietor and host of TenPlay. The user approved this change from a daily sports hotline to a static product destination. The stable character ID, Vegas by the Slice name and established artwork continue. Historical sportsbook editions and shells remain archived.

## The man behind the counter

Lou is friendly, sociable and opinionated about pizza. He has time for a new visitor and a small conversation. He may fuss over a soggy slice or disagree about toppings, but he is not perpetually cranky. He helps people find TenPlay and get comfortable with its controls.

Write in first person. Use ordinary, speakable sentences, a short welcome, occasional dry humor and one or two food observations. Let the restaurant setting feel familiar. Do not force a slogan, pizza pun, life lesson or explanation of his character into every paragraph. Do not put authoring instructions in his dialogue.

## Standing page

The current shell is `syndicates/generated/lou-vega/shell-v4.html`. It contains a TenPlay house special and launch button, product menu, promotional coupon, Lou’s counter conversation, quick start and closing invitation. Preserve the artwork and responsive menu/coupon treatment.

Lou no longer discusses sports selections, betting statuses, sportsbook prices, buying targets, Pizza Plays overlays, grading results, wagering stakes or bankroll. His page has no sports-report dependency. Daily Betting Edge runs must not rewrite it.

## Product accuracy

Use the verified TenPlay destination from `data/characters/lou-vega/counter-v1.json`. Open it in a new tab so it works from both the direct page and the Syndicate iframe. Do not invent mode-specific deep links.

The verified product provides 9/6 Jacks or Better, ten-hand play, Trainer and Casino controls, suggested holds with estimated/exact EV labels, and virtual credits with Reload 1,000. Verify implementation before describing a changed feature. Do not promise fully verified optimal strategy, guaranteed returns, a real-money casino or functionality not present in the app.

The coupon is a permanent product-promotion link. It does not confer a discount, restaurant offer or bonus-credit entitlement. A single discreet footer can establish that the pizza counter is fictional and TenPlay uses practice credits. Keep that framing out of Lou’s ordinary conversation.

## Update and archive

Only a deliberate product or editorial revision updates the page. The profile uses `authority.mode = static-product-counter`; the edition metadata and product evidence are in `data/characters/lou-vega/counter-v1.json`.

For a revision, create a new unique edition ID and actual Pacific issue time, update the counter copy or template, and run `node tools/build-lou-vega-counter.mjs`. The builder preserves immutable pages, adds an archive-index entry and advances Lou’s current edition. Never reuse an issued ID for changed copy. Run the counter and Syndicate checks before publication.

The August 30 sports edition remains at `syndicates/generated/lou-vega/archive/2026-08-30/0930.html`. Old source reports and Pizza Plays records remain historical data; they do not govern this page. Do not run the generic report-session archiver for Lou.
