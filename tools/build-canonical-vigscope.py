from pathlib import Path
import re

index = Path('index.html').read_text(encoding='utf-8')
core = Path('runner-core.html').read_text(encoding='utf-8')
runner = Path('runner.html').read_text(encoding='utf-8')

style_match = re.search(r'<style>([\s\S]*?)</style>', index, re.I)
history_match = re.search(r'<section id="history"[\s\S]*?</section>', index, re.I)
if not style_match or not history_match:
    raise SystemExit('Could not extract base VigScope style/history shell')

index_scripts = re.findall(r'<script>([\s\S]*?)</script>', index, re.I)
# Preserve shared ledger/history runtime, but retire the obsolete five-window
# archive module that belonged to the old F1 page.
base_scripts = [s for s in index_scripts if not ('run-history.json' in s and 'runArchiveSync' in s)]

core_scripts = re.findall(r'<script>([\s\S]*?)</script>', core, re.I)
runtime = next((s for s in core_scripts if "const HISTORY_KEY='bettingEdge.runnerHistory.v1.3'" in s), None)
if runtime is None:
    raise SystemExit('Could not extract runner-core runtime')
# The canonical app is the document itself; there is no nested index.html iframe.
runtime = runtime.replace("$('#app').src='./index.html?build='+Date.now();\n", '')
# runner-core.html used to have its own global scope. Preserve that isolation
# now that its logic shares one document with the retained history runtime.
runtime = "(()=>{\n" + runtime.strip() + "\n})();\n"
Path('assets/runner-core-runtime.js').write_text(runtime, encoding='utf-8')

style = style_match.group(1)
history = history_match.group(0)
base_runtime = '\n'.join(f'<script>\n{s}\n</script>' for s in base_scripts)

app = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
<title>VigScope Terminal UI v1.5 App</title>
<style>{style}</style>
</head>
<body>
<main class="term">
<header class="top"><div><div class="title">VIGSCOPE TERMINAL UI v1.5</div><div class="small muted">CURRENT APPLICATION SHELL</div></div></header>
<section class="stats grid">
<div class="stat"><div class="key">BANKROLL</div><b class="g" id="masterBankroll">$0.00</b></div>
<div class="stat"><div class="key">NEW RISK</div><b>$0.00</b></div>
<div class="stat"><div class="key">MASTER WAGERS</div><b class="c" id="masterWagers">—</b></div>
<div class="stat"><div class="key">LEDGER PAGES</div><b class="g" id="masterPages">—</b></div>
<div class="stat"><div class="key">BET</div><b class="y">0</b></div>
<div class="stat"><div class="key">LEAN</div><b class="y">0</b></div>
<div class="stat"><div class="key">WAIT / PASS</div><b class="c">0 / 0</b></div>
</section>
<div class="pad"><div class="qa"><span class="tag g" id="qaCount">LEDGER: CHECKING</span></div></div>
<div class="pad"><nav class="tabs">
<button class="btn" data-view="board">[F1] BOARD</button>
<button class="btn" data-view="market">[F2] MARKET</button>
<button class="btn" data-view="history">[F3] BET HISTORY</button>
<button class="btn" data-view="engine">[F4] ENGINE</button>
</nav></div>
<section id="board" class="view pad hidden"></section>
<section id="market" class="view pad hidden"></section>
{history}
<section id="engine" class="view pad hidden"></section>
<footer class="foot"></footer>
</main>
<div id="app" style="display:none!important" aria-hidden="true"></div>
<div id="err" style="display:none;position:fixed;z-index:2147482000;left:10px;right:10px;top:10px;padding:10px;background:#25060d;color:#ff9cad;border:1px solid #ff6178;font:12px ui-monospace,SFMono-Regular,Menlo,monospace"></div>
<script>
(()=>{{
  const app=document.getElementById('app');
  try{{Object.defineProperty(app,'contentDocument',{{configurable:true,get:()=>document}})}}catch(e){{}}
  try{{Object.defineProperty(app,'contentWindow',{{configurable:true,get:()=>window}})}}catch(e){{}}
}})();
</script>
{base_runtime}
<script src="./assets/runner-core-runtime.js"></script>
<script>
(()=>{{
  const app=document.getElementById('app');
  app.dispatchEvent(new Event('load'));
  document.dispatchEvent(new CustomEvent('vigscope-app-ready'));
}})();
</script>
</body>
</html>
'''

for text in [
    'CORE v1.4 RUN ARCHIVE',
    'NEW YORK LIBERTY @ INDIANA FEVER',
    'CURRENT REFERENCE BOARD // SNAPSHOT + ATTRIBUTION',
    'CORE v1.4 SOURCE MONITOR // FREE STACK',
    'CUSTOMER SPORTSBOOK MODEL // v1.3 ACTIVE DESIGN',
]:
    if text in app:
        raise SystemExit(f'Legacy page content leaked into canonical app: {text}')

Path('runner-app.html').write_text(app, encoding='utf-8')

old = "const coreUrl=new URL('./runner-core.html',location.href);"
new = "const coreUrl=new URL('./runner-app.html',location.href);"
if old not in runner:
    raise SystemExit('runner.html core target not found')
Path('runner.html').write_text(runner.replace(old, new, 1), encoding='utf-8')
