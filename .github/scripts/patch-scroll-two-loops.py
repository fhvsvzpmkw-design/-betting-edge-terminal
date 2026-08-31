from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one target, found {count}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "assets/card-view-preference.js",
    """  const timer=setInterval(()=>{\n    const d=appDoc();\n    if(d)attach(d);\n    const current=readValue();\n    if(d&&current!==lastValue)apply(d,current)\n  },150);\n\n  window.addEventListener('beforeunload',()=>{\n    clearInterval(timer);\n    if(observer)observer.disconnect()\n  },{once:true});""",
    """  let bootTries=0;\n  function boot(){\n    const d=appDoc();\n    if(d&&attach(d))return;\n    bootTries+=1;\n    if(bootTries<150)setTimeout(boot,40)\n  }\n  boot();\n  window.addEventListener('pageshow',()=>{\n    const d=appDoc();\n    if(d)attach(d)\n  });\n  window.addEventListener('storage',event=>{\n    if(event.key!==STORAGE_KEY)return;\n    const d=appDoc();\n    if(d)apply(d,readValue())\n  });\n  window.addEventListener('beforeunload',()=>{\n    if(observer)observer.disconnect()\n  },{once:true});""",
)

replace_once(
    "assets/special-desks-ui.js",
    """let tries=0;const timer=setInterval(()=>{tries++;if(attach()||tries>250)clearInterval(timer)},40);\nsetInterval(()=>{const d=appDoc();if(d){bindKeys(d);ensureButtons(d)}},600);\n})();""",
    """let tries=0;const timer=setInterval(()=>{tries++;if(attach()||tries>250)clearInterval(timer)},40);\nwindow.addEventListener('pageshow',()=>{const d=appDoc();if(d){bindKeys(d);ensureButtons(d)}});\n})();""",
)
