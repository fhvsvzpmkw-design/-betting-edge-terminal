# VigScope main-menu artwork

Each menu graphic is a separate transparent 360 × 360 WebP file. Button frames,
colors, labels, and viewport sizing live in `../menu-home-style.css` and
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

Preferences uses the native gear emoji. The header reuses the authentic corporate
VigScope product badge at `/site-assets/product-badges/vigscope-small.png`.

To replace one graphic, replace its file, preserve transparency, and increment
`VERSION` in `menu-home-style.js` to refresh cached artwork. If changing the theme
or script, update its version in `report-dashboard-vigscope.js` as well.

The theme runs only while `runnerMenuHome` is active. Its pointer-transparent
artwork layer sits beside the existing buttons, leaving their contents, handlers,
function keys, and secondary-screen rendering unchanged. Leaving the menu removes
the layer, temporary header, theme classes, and temporary accessibility labels.

Validation: `node tests/menu-home-style.test.mjs` and
`node tests/f8-nav-theme-authority.test.mjs`.

Rollback: remove the `menuHomeStyleLoader` block from
`report-dashboard-vigscope.js`. No report, ledger, schedule, or section file needs
to be reverted.
