from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"{label} not found")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Pizza Plays + Crypto Specials
# ---------------------------------------------------------------------------
special_path = Path("assets/special-desks-ui.js")
s = special_path.read_text()

s = replace_once(
    s,
    '#${PIZZA_PANEL},#${CRYPTO_PANEL}{display:none;margin:0 12px 14px;padding:12px;min-height:65vh;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
    '#${PIZZA_PANEL},#${CRYPTO_PANEL}{display:none;margin:0 10px 16px;padding:14px;min-height:65vh;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
    'shared special-desk shell geometry',
)

s = replace_once(
    s,
    '#${PIZZA_PANEL}{border:1px solid #6d3b20;background:radial-gradient(circle at 50% -20%,rgba(159,68,22,.20),transparent 48%),linear-gradient(180deg,#0d0703,#030303);color:#ecd8c4}',
    '#${PIZZA_PANEL}{--deskAccent:#ff9a49;--deskAccentSoft:#c98a59;--deskLine:#75421f;border:1px solid #75421f;background:radial-gradient(circle at 50% -18%,rgba(183,76,24,.22),transparent 46%),linear-gradient(180deg,#100703,#030303);color:#ecd8c4;box-shadow:inset 0 0 30px rgba(255,137,55,.025),0 0 18px rgba(172,73,24,.08)}',
    'Pizza shell rule',
)

s = replace_once(
    s,
    '#${CRYPTO_PANEL}{border:1px solid #4a3b76;background:radial-gradient(circle at 50% -20%,rgba(76,51,153,.13),transparent 42%),linear-gradient(180deg,#05050b,#020306 58%,#010204);color:#ddd8f6;box-shadow:inset 0 0 28px rgba(109,77,207,.025);font-size:18px}',
    '#${CRYPTO_PANEL}{--deskAccent:#9c87ff;--deskAccentSoft:#9e91dc;--deskLine:#514379;border:1px solid #514379;background:radial-gradient(circle at 50% -18%,rgba(92,63,184,.16),transparent 44%),linear-gradient(180deg,#06050d,#020306 58%,#010204);color:#ddd8f6;box-shadow:inset 0 0 30px rgba(124,91,222,.03),0 0 18px rgba(82,58,164,.08);font-size:18px}',
    'Crypto shell rule',
)

status_pattern = re.compile(
    r'\.specialHead\{[^}]*\}\.specialBadge\{[^}]*\}\.pizzaBadge\{[^}]*\}\.cryptoBadge\{[^}]*\}'
)
status_css = (
    '.specialHead{display:flex;align-items:center;min-height:44px;margin:0 0 13px;padding:9px 11px;'
    'border:1px solid var(--deskLine);background:linear-gradient(180deg,color-mix(in srgb,var(--deskAccent) 8%,#070707),#030305);'
    'box-shadow:inset 3px 0 0 color-mix(in srgb,var(--deskAccent) 70%,transparent),0 0 14px color-mix(in srgb,var(--deskAccent) 7%,transparent)}'
    '.specialBadge{border:0!important;background:transparent!important;padding:0!important;color:var(--deskAccent)!important;'
    'font-size:11px!important;font-weight:950;letter-spacing:.10em;line-height:1.45}'
    '.pizzaBadge,.cryptoBadge{color:var(--deskAccent)!important}'
)
s, count = status_pattern.subn(status_css, s, count=1)
if count != 1:
    raise RuntimeError('special status-rail CSS not found')

style_marker = '`;d.head.appendChild(s)}'
if style_marker not in s:
    raise RuntimeError('special stylesheet terminator not found')

special_polish = r'''
    .deskSectionBar{display:flex;align-items:center;gap:10px;margin:14px 0 9px;color:var(--deskAccent);font-size:10px;font-weight:950;letter-spacing:.12em;line-height:1.35;text-transform:uppercase}.deskSectionBar b{white-space:nowrap}.deskSectionBar span{margin-left:auto;color:var(--deskAccentSoft);font-size:8px;letter-spacing:.08em;text-align:right;order:2}.deskSectionBar:after{content:"";height:1px;flex:1 1 70px;order:1;background:linear-gradient(90deg,color-mix(in srgb,var(--deskAccent) 55%,transparent),transparent)}
    .pizzaPick{border-color:#a85d2b!important;border-left-color:var(--deskAccent)!important;box-shadow:inset 0 0 0 1px rgba(255,174,98,.045),inset 0 -28px 45px rgba(0,0,0,.14),0 0 25px rgba(203,88,28,.12)!important}.pizzaMarketStrip,.pizzaExplain,.pizzaEventMeta{box-shadow:inset 0 0 15px rgba(255,132,49,.018)}.pizzaLouTag{box-shadow:0 0 15px rgba(255,140,58,.18)!important}.pizzaPick h3{font-size:clamp(24px,3vw,31px)!important}
    .cryptoSourceBar{margin-top:0!important}.cryptoSourceCell{border-color:#3d315d!important;background:linear-gradient(180deg,#090814,#05050b)!important;box-shadow:inset 0 0 14px rgba(143,111,238,.022)}.cryptoSummary{border:1px solid #342a4d!important;border-left:4px solid #785dbd!important;background:linear-gradient(180deg,#0a0815,#06060e)!important;box-shadow:inset 0 0 16px rgba(132,96,231,.02)}.cryptoBoard{margin-top:0!important}.cryptoPick{box-shadow:inset 0 0 0 1px rgba(191,176,255,.025),inset 0 -26px 44px rgba(0,0,0,.12),0 0 18px rgba(96,72,166,.09)!important}
    @media(max-width:720px){#${PIZZA_PANEL},#${CRYPTO_PANEL}{margin-left:7px;margin-right:7px;padding:11px}.specialHead{min-height:42px;padding:8px 9px;margin-bottom:11px}.deskSectionBar{margin-top:12px}.deskSectionBar span{display:none}.pizzaPick h3{font-size:24px!important}}
'''
s = s.replace(style_marker, special_polish + '\n  ' + style_marker, 1)

s = replace_once(
    s,
    '<div class="specialHead pizzaHead">',
    '<div class="specialHead deskStatusRail pizzaHead">',
    'Pizza status rail markup',
)

s = replace_once(
    s,
    'return `${head}<div class="pizzaBoard"><article class="pizzaPick">',
    'return `${head}<div class="deskSectionBar"><b>PRIMARY PLAY</b><span>${reportLabel}</span></div><div class="pizzaBoard"><article class="pizzaPick">',
    'Pizza primary-play section',
)

s = s.replace(
    '<div class="specialHead cryptoHead">',
    '<div class="specialHead deskStatusRail cryptoHead">',
)

s = replace_once(
    s,
    '    <div class="cryptoSourceBar">',
    '    <div class="deskSectionBar"><b>INTELLIGENCE</b><span>SOURCE + MARKET PASS</span></div>\n    <div class="cryptoSourceBar">',
    'Crypto intelligence section',
)

s = replace_once(
    s,
    '    ${activeHtml}${passHtml}${generated?`<div class="cryptoTimestamp">',
    '    <div class="deskSectionBar"><b>LIVE BOARD</b><span>${active.length} ACTIVE // ${passes.length} PASS</span></div>\n    ${activeHtml}${passHtml}${generated?`<div class="cryptoTimestamp">',
    'Crypto live-board section',
)

s = replace_once(
    s,
    'return `<div class="specialHead deskStatusRail cryptoHead"><div class="specialBadge cryptoBadge">${badge}</div></div>${items.length?',
    'return `<div class="specialHead deskStatusRail cryptoHead"><div class="specialBadge cryptoBadge">${badge}</div></div><div class="deskSectionBar"><b>SOURCE COLLECTION</b><span>CURATED WEB INTELLIGENCE</span></div>${items.length?',
    'Crypto source-collection section',
)

special_path.write_text(s)


# ---------------------------------------------------------------------------
# Meat Desk
# ---------------------------------------------------------------------------
meat_path = Path("assets/season-previews-ui.js")
m = meat_path.read_text()

m = replace_once(
    m,
    '#${W}{display:none;margin:0 10px 16px;padding:15px;border:1px solid #6b443a;background:radial-gradient(circle at 50% -10%,rgba(126,43,29,.23),transparent 44%),#050303;color:#e6d9d5;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;min-height:65vh}',
    '#${W}{--deskAccent:#ed9179;--deskAccentSoft:#c88f80;--deskLine:#70473c;display:none;margin:0 10px 16px;padding:14px;border:1px solid #70473c;background:radial-gradient(circle at 50% -12%,rgba(140,48,31,.23),transparent 44%),linear-gradient(180deg,#070303,#030202);color:#e6d9d5;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;min-height:65vh;box-shadow:inset 0 0 30px rgba(216,102,76,.025),0 0 18px rgba(119,49,37,.08)}',
    'Meat shell rule',
)

meat_status_pattern = re.compile(r'\.mdHead\{[^}]*\}\.mdBadge\{[^}]*\}')
meat_status_css = (
    '.mdHead{display:flex;align-items:center;min-height:44px;margin:0 0 13px;padding:9px 11px;border:1px solid var(--deskLine);'
    'background:linear-gradient(180deg,color-mix(in srgb,var(--deskAccent) 8%,#070404),#030202);'
    'box-shadow:inset 3px 0 0 color-mix(in srgb,var(--deskAccent) 70%,transparent),0 0 14px color-mix(in srgb,var(--deskAccent) 7%,transparent)}'
    '.mdBadge{border:0;background:transparent;color:var(--deskAccent);padding:0;font-size:11px;font-weight:950;line-height:1.45;letter-spacing:.08em}'
)
m, count = meat_status_pattern.subn(meat_status_css, m, count=1)
if count != 1:
    raise RuntimeError('Meat status-rail CSS not found')

meat_style_marker = '`;q.head.appendChild(s)}'
if meat_style_marker not in m:
    raise RuntimeError('Meat stylesheet terminator not found')

meat_polish = r'''
.deskSectionBar{display:flex;align-items:center;gap:10px;margin:14px 0 9px;color:var(--deskAccent);font-size:10px;font-weight:950;letter-spacing:.12em;line-height:1.35;text-transform:uppercase}.deskSectionBar b{white-space:nowrap}.deskSectionBar span{margin-left:auto;color:var(--deskAccentSoft);font-size:8px;letter-spacing:.08em;text-align:right;order:2}.deskSectionBar:after{content:"";height:1px;flex:1 1 70px;order:1;background:linear-gradient(90deg,color-mix(in srgb,var(--deskAccent) 55%,transparent),transparent)}
.mdPolicy{margin-top:0!important;border-color:#5a3c34!important;background:linear-gradient(180deg,#090504,#050303)!important;box-shadow:inset 0 0 15px rgba(220,112,86,.018)}.mdShelf{margin-top:0!important;border-color:#684238!important;background:radial-gradient(circle at 50% -15%,rgba(120,42,30,.10),transparent 38%),linear-gradient(#100605,#050303)!important;box-shadow:inset 0 0 24px rgba(220,104,78,.02),0 0 16px rgba(90,35,27,.08)}.mdBook{border-color:#68463d!important;box-shadow:0 9px 20px #0009,inset 0 0 14px rgba(223,124,99,.018)!important}.mdBook:hover,.mdBook:focus-visible,.mdBook.sel{border-color:var(--deskAccent)!important;box-shadow:0 11px 24px #000b,0 0 18px rgba(214,107,77,.20)!important}.mdRail{box-shadow:0 7px 13px #000a!important}
@media(max-width:720px){#${W}{margin-left:7px;margin-right:7px;padding:11px}.mdHead{min-height:42px;padding:8px 9px;margin-bottom:11px}.deskSectionBar{margin-top:12px}.deskSectionBar span{display:none}}
'''
m = m.replace(meat_style_marker, meat_polish + '\n' + meat_style_marker, 1)

m = replace_once(
    m,
    'return`<div class="mdHead"><div class="mdBadge">${a.length}/${MAX} SOURCES LOADED // ${an} ANALYZED<br>REVIEW MODE: ${e(mode())} // MANUAL ONLY</div></div><div class="mdPolicy">',
    'return`<div class="mdHead deskStatusRail"><div class="mdBadge">${a.length}/${MAX} SOURCES LOADED // ${an} ANALYZED // REVIEW MODE: ${e(mode())} // MANUAL ONLY</div></div><div class="deskSectionBar"><b>DESK POLICY</b><span>PRIVATE SOURCE CONTROL</span></div><div class="mdPolicy">',
    'Meat status/content section',
)

m = replace_once(
    m,
    '</div><section class="mdShelf"><div class="mdShelfTop"><b>SOURCE BOOKSHELF</b><span>SELECT ONE SOURCE // UP TO FOUR ACTIVE DOCUMENTS</span></div><div class="mdBooks">${slots}</div>',
    '</div><div class="deskSectionBar"><b>SOURCE BOOKSHELF</b><span>SELECT ONE SOURCE // UP TO FOUR ACTIVE DOCUMENTS</span></div><section class="mdShelf"><div class="mdBooks">${slots}</div>',
    'Meat bookshelf section',
)

meat_path.write_text(m)

# Final guards: keep the function-key bars and confirm all shared components exist.
final_special = special_path.read_text()
final_meat = meat_path.read_text()
assert '[F5]' in final_special and '🍕 PIZZA PLAYS 🍕' in final_special
assert '[F6]' in final_special and 'CRYPTO SPECIALS' in final_special
assert '[F7]' in final_meat and 'MEAT DESK' in final_meat
assert final_special.count('deskSectionBar') >= 4
assert final_meat.count('deskSectionBar') >= 3
print('Special desk polish applied successfully.')
