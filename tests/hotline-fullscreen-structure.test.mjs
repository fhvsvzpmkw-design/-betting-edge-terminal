#!/usr/bin/env node
import fs from 'node:fs';
const src=fs.readFileSync('syndicates/slot-host.html','utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
assert(src.includes("const TOP_OVERLAY_ID='vigwireHotlineFullscreenOverlay'"),'top-level Hotline overlay id missing');
assert(src.includes("frame.className='vigwireHotlineDirectFrame'"),'direct fullscreen Hotline iframe missing');
assert(src.includes("frame.src=currentTarget"),'fullscreen iframe must load the direct current Hotline URL');
assert(src.includes('.vigwireHotlineDirectFrame{position:absolute!important;inset:0!important;display:block!important;width:100%!important;height:100%!important'),'direct fullscreen iframe must use container height, not viewport-height nesting');
assert(src.includes("function enterFullscreen(){closeLibrary();if(openTopFullscreen())return;"),'top-level direct overlay must be the primary fullscreen path');
assert(src.includes("close.className='vigwireHotlineTopClose'"),'top-level close control missing');
assert(src.includes("share.className='vigwireHotlineTopShare'"),'top-level share control missing');
const overlayCss=(src.match(/function ensureTopOverlayStyle\(d\)\{[\s\S]*?\nfunction closeTopFullscreen/)||[''])[0];
assert(overlayCss&&!overlayCss.includes('100vh'),'top-level Hotline overlay must not use 100vh');
assert(src.includes('body.hotlineFullscreen .frame{width:100%;height:100%}'),'fallback Hotline iframe must use container height');
const fallback=(src.match(/function ensureParentFullscreenStyle\(\)\{[\s\S]*?\nfunction enterFullscreen/)||[''])[0];
assert(fallback&&!fallback.includes('100vh'),'fallback parent fullscreen path must not force viewport height');
console.log('HOTLINE FULLSCREEN STRUCTURE: PASS');
