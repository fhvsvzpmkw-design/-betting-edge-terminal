# VigScope main-menu artwork

Each menu graphic is a separate transparent 360 × 360 WebP file. Button frames,
saturated edge lights, inset bevels, textures, labels, and viewport sizing live in `../menu-home-style.css` and
`../menu-home-style.js`; they are not baked into these images.

| Menu selection | Graphic |
| --- | --- |
| VigScope | `board.webp` |
| Market | `market.webp` |
| Bet History | `history.webp` |
| Syndicate | `syndicate.webp` |
| Pizza Plays | `pizza.webp` |
| Crypto Specials | `crypto.webp` |
| Meat Desk | `meat.webp` |
| VigScope Value | `value.webp` |

Preferences uses the native gear emoji. The full-screen main menu contains only
the eight buttons and Preferences bar. The original terminal header stays in the
document for the existing secondary screens; the menu does not add a badge.

To replace one graphic, replace its file, preserve transparency, and increment
`VERSION` in `menu-home-style.js` to refresh cached artwork. Keep that version in
sync with the stylesheet, script, and artwork preload URLs in `runner.html`, plus
the compatibility loader in `report-dashboard-vigscope.js`.

The original buttons and artwork share named CSS grid areas: two columns and
four rows in portrait, four columns and two rows in landscape, with Preferences
across the final row. Short landscape screens put the icons beside the labels;
roomier tablet screens center them above. The menu-only CSS explicitly outranks
legacy specialty-button ID rules without changing those rules or section screens.

The theme runs only while `runnerMenuHome` is active and no secondary screen is
loaded. Its pointer-transparent
artwork layer sits beside the existing buttons, leaving their contents, handlers,
function keys, and secondary-screen rendering unchanged. Leaving the menu removes
the layer, theme classes, and temporary accessibility labels.

`runner.html` loads the stylesheet, script, and graphics from its head. The
startup guard hides the original terminal until the new menu and artwork are
ready, and the existing splash then fades using its original timing. Failed
artwork uses the native emoji fallback. A stylesheet failure or ten-second
startup timeout releases the application rather than leaving a blank screen.

Validation: `node tests/menu-home-style.test.mjs` and
`node tests/f8-nav-theme-authority.test.mjs`.
The menu test includes the actual legacy CSS selectors in both stylesheet load
orders, with normal, hover, and pressed states, to catch frame/artwork drift.
The existing browser CI runs `tests/menu-home-browser-smoke.mjs`, including six
viewport fits and startup with delayed menu code and artwork.

Rollback: remove the menu startup block, menu-ready reveal check, and menu-ready
event listener from `runner.html`, plus the compatibility loader from
`report-dashboard-vigscope.js`. No report, ledger, schedule, or section renderer
needs to be reverted.
