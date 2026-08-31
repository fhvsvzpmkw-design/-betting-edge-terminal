from pathlib import Path
import re

outer = Path('runner.html').read_text(encoding='utf-8')
app = Path('runner-app.html').read_text(encoding='utf-8')

outer_scripts = re.findall(r'<script>([\s\S]*?)</script>', outer, re.I)
if not outer_scripts:
    raise SystemExit('runner outer runtime not found')
outer_runtime = outer_scripts[0]

old_boot = "art.addEventListener('error',()=>splash.classList.add('asset-error'),{once:true});core.addEventListener('load',()=>{coreLoaded=true;watchHierarchy();reveal()},{once:true});const coreUrl=new URL('./runner-app.html',location.href);for(const [k,v] of new URLSearchParams(location.search))coreUrl.searchParams.set(k,v);coreUrl.searchParams.set('build',String(Date.now()));coreUrl.hash=location.hash;core.src=coreUrl.pathname+coreUrl.search+coreUrl.hash;startWhenVisible();"
new_boot = "art.addEventListener('error',()=>splash.classList.add('asset-error'),{once:true});coreLoaded=true;watchHierarchy();reveal();startWhenVisible();"
if old_boot not in outer_runtime:
    raise SystemExit('runner boot sequence not found')
outer_runtime = outer_runtime.replace(old_boot, new_boot, 1)

body_close = app.lower().rfind('</body>')
if body_close < 0:
    raise SystemExit('runner-app body close not found')

single_shell = r'''
<style id="singleDocumentSplashStyle">
#core{display:none!important}
#splash2{position:fixed;z-index:2147483000;inset:0;display:grid;place-items:center;background:#01040a;opacity:1;transition:opacity 320ms ease;overflow:hidden}
#splash2.fade{opacity:0;pointer-events:none}
#splash2art{display:block;width:100%;height:100%;object-fit:contain;object-position:center;background:#01040a}
#fallback{display:none;color:#58ff88;font:700 clamp(14px,2.2vw,24px) ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:.08em;text-align:center}
#splash2.asset-error #splash2art{display:none}
#splash2.asset-error #fallback{display:block}
@media(prefers-reduced-motion:reduce){#splash2{transition:none}}
</style>
<div id="core" aria-hidden="true"></div>
<div id="splash2" aria-label="VigWire Labs boot screen">
  <img id="splash2art" src="./assets/splash-02-vigwire-labs-v2v2.png" alt="VigWire Labs Market Intelligence boot screen">
  <div id="fallback">VIGWIRE LABS // LOADING VIGSCOPE</div>
</div>
<script>
(()=>{
  const core=document.getElementById('core');
  try{Object.defineProperty(core,'contentDocument',{configurable:true,get:()=>document})}catch(e){}
  try{Object.defineProperty(core,'contentWindow',{configurable:true,get:()=>window})}catch(e){}
})();
</script>
<script id="singleDocumentOuterRuntime">
''' + outer_runtime + r'''
</script>
<script>
(()=>{const s=document.createElement('script');s.src=`./assets/report-dashboard-vigscope.js?build=${Date.now()}`;s.async=false;document.head.appendChild(s)})();
</script>
'''

single = app[:body_close] + single_shell + app[body_close:]
single = single.replace('<title>VigScope Terminal UI v1.5 App</title>','<title>VigScope Terminal UI v1.5</title>',1)

if '<iframe' in single.lower():
    raise SystemExit('static iframe leaked into single-document runner')
for legacy in [
    'CORE v1.4 RUN ARCHIVE',
    'NEW YORK LIBERTY @ INDIANA FEVER',
    'CORE v1.4 SOURCE MONITOR // FREE STACK',
    'CURRENT REFERENCE BOARD // SNAPSHOT + ATTRIBUTION',
]:
    if legacy in single:
        raise SystemExit(f'legacy content leaked into single document: {legacy}')

Path('runner.html').write_text(single, encoding='utf-8')
