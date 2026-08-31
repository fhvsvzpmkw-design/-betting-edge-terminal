from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected pattern not found in {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

# Results desk: the page is built once from the current index. Do not wake the
# entire app every 700 ms just to re-read the same bankroll text.
replace_once(
    'assets/results-desk-ui.js',
    "setInterval(()=>{const d=appDoc();if(d)install(d)},700);",
    "function refreshCachedValue(){const d=appDoc();if(d&&cached)refreshCash(d,cached.priceAnalytics||{})}window.addEventListener('pageshow',refreshCachedValue);window.addEventListener('focus',refreshCachedValue);"
)

# Card-log pagination: replace a 150 ms perpetual sorter/DOM probe with a
# narrow observer on the Value page. The observer only wakes when the engine
# actually rerenders (scope/status changes, initial results render, etc.).
replace_once(
    'assets/results-card-log-pagination.js',
    "load().then(tick);\nsetInterval(tick,150);\nsetInterval(()=>load().then(tick),60000);",
    """function bindResultsCardLogObserver(){
  const d=appDoc(),engine=d?.getElementById('engine');
  if(!engine)return false;
  if(engine.dataset.resultsCardLogObserver==='1')return true;
  engine.dataset.resultsCardLogObserver='1';
  let queued=false;
  const observer=new MutationObserver(()=>{
    if(queued||applying)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;apply(d)});
  });
  observer.observe(engine,{childList:true,subtree:true});
  return true;
}
load().then(()=>{bindResultsCardLogObserver();tick()});
let observerTries=0;
const observerBoot=setInterval(()=>{
  observerTries+=1;
  if(bindResultsCardLogObserver()){
    tick();
    clearInterval(observerBoot);
  }else if(observerTries>120)clearInterval(observerBoot);
},100);
window.addEventListener('pageshow',()=>load().then(tick));"""
)

# Player-value overlay: scope the mutation observer to F8 itself and remove
# permanent 700 ms / 60 s background loops.
replace_once(
    'assets/results-player-base-v5.js',
    "function obs(d){if(d.documentElement.dataset.resultsPlayerBaseV5===VERSION)return;d.documentElement.dataset.resultsPlayerBaseV5=VERSION;let q=false;new MutationObserver(()=>{if(!cached||q||applying)return;q=true;requestAnimationFrame(()=>{q=false;apply(d,cached)})}).observe(d.body,{childList:true,subtree:true})}",
    "function obs(d){if(d.documentElement.dataset.resultsPlayerBaseV5===VERSION)return;d.documentElement.dataset.resultsPlayerBaseV5=VERSION;const target=d.getElementById('engine');if(!target)return;let q=false;new MutationObserver(()=>{if(!cached||q||applying)return;q=true;requestAnimationFrame(()=>{q=false;apply(d,cached)})}).observe(target,{childList:true,subtree:true})}"
)
replace_once(
    'assets/results-player-base-v5.js',
    "setInterval(()=>{patch();if(!cached&&!loading)load().then(patch)},700);setInterval(()=>load().then(patch),60000);",
    "window.addEventListener('pageshow',()=>load().then(patch));"
)

# Decision-shadow overlay: same change — watch only F8, not the entire terminal,
# and stop periodic background wakeups once initial boot has settled.
replace_once(
    'assets/decision-shadow-v2-ui.js',
    "function obs(d){if(d.documentElement.dataset.shadowV2Observer===VERSION)return;d.documentElement.dataset.shadowV2Observer=VERSION;let q=false;new MutationObserver(()=>{if(!cached||q||applying)return;q=true;requestAnimationFrame(()=>{q=false;apply(d,cached)})}).observe(d.body,{childList:true,subtree:true})}",
    "function obs(d){if(d.documentElement.dataset.shadowV2Observer===VERSION)return;d.documentElement.dataset.shadowV2Observer=VERSION;const target=d.getElementById('engine');if(!target)return;let q=false;new MutationObserver(()=>{if(!cached||q||applying)return;q=true;requestAnimationFrame(()=>{q=false;apply(d,cached)})}).observe(target,{childList:true,subtree:true})}"
)
replace_once(
    'assets/decision-shadow-v2-ui.js',
    "setInterval(()=>{patch();if(!cached&&!loading)load().then(patch)},700);setInterval(()=>load().then(patch),60000);",
    "window.addEventListener('pageshow',()=>load().then(patch));"
)

# Why VigScope: replace its 700 ms repatcher with a narrow engine observer so
# it still reapplies after Value-page filters rerender without polling forever.
replace_once(
    'assets/why-vigscope-v2.js',
    "function patch(){const d=doc();if(!d||!cached)return false;return apply(d,cached)}\nload().then(patch);",
    """function patch(){const d=doc();if(!d||!cached)return false;return apply(d,cached)}
function obs(){const d=doc(),engine=d?.getElementById('engine');if(!engine||engine.dataset.whyVigScopeObserver==='1')return false;engine.dataset.whyVigScopeObserver='1';let q=false;new MutationObserver(()=>{if(!cached||q||applying)return;q=true;requestAnimationFrame(()=>{q=false;apply(d,cached)})}).observe(engine,{childList:true,subtree:true});return true}
load().then(()=>{obs();patch()});"""
)
replace_once(
    'assets/why-vigscope-v2.js',
    "setInterval(()=>patch(),700);\nsetInterval(()=>load().then(patch),60000);",
    "window.addEventListener('pageshow',()=>load().then(()=>{obs();patch()}));"
)

# F3's overall-profit helper only needs to observe F3. It previously watched
# every character and child mutation in the entire app, including F8 renders.
replace_once(
    'assets/f3-overall-profit.js',
    "observer.observe(d.body,{subtree:true,childList:true,characterData:true});",
    "const target=d.getElementById('history')||d.body;observer.observe(target,{subtree:true,childList:true,characterData:true});"
)
