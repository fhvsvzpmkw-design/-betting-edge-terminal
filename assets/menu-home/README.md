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

The main menu is a standalone `nav#vigMainMenu` containing nine real buttons.
Each button owns its frame, artwork and label. The original navigation pad is
retired from the home screen and retained only for the existing secondary-screen
controls. New buttons delegate to those established handlers; keyboard authority
and the secondary screens remain unchanged.

The same prepared menu buttons and decoded images are retained between visits.
Returning calls `VigScopeMenuHome.show()` synchronously in the existing navigation
transition. Body state changes also synchronize presentation immediately. The
menu is hidden on a secondary screen rather than removed and rebuilt.

`runner.html` loads the stylesheet, script, and graphics from its head. The
startup guard hides the terminal until the new menu and artwork are ready, then
the existing splash fades. Artwork failures use the native emoji fallback. CSS
failures use the same standalone buttons with basic isolated styling; missing
menu code produces a reload message rather than revealing the old home menu.

Validation: `node tests/menu-home-style.test.mjs` and
`node tests/f8-nav-theme-authority.test.mjs`.
The menu test includes the actual legacy CSS selectors in both stylesheet load
orders, with normal, hover, and pressed states, to catch frame/artwork drift.
The existing browser CI runs `tests/menu-home-browser-smoke.mjs`, including six
viewport fits, startup with delayed resources, and all nine section return paths
in both orientations. Return checks detect old-navigation frames, graphic reloads,
new image requests, and recreated main-menu buttons.

Rollback: remove the menu startup block, menu-ready reveal check, and menu-ready
event listener from `runner.html`, plus the compatibility loader from
`report-dashboard-vigscope.js` and the `VigScopeMenuHome.show()` presentation call
in `primary-nav-shell.js`. No report, ledger, schedule, or section renderer
needs to be reverted.
