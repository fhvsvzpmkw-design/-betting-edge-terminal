import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/primary-nav-shell.js','utf8');
const bindSource=source.slice(0,source.indexOf('\nfunction attach(){'))+'globalThis.bindForTest=bind;})();';
const sections={syndicate:'runnerSyndicateLoaded',pizza:'runnerPizzaLoaded',crypto:'runnerCryptoLoaded',meat:'runnerSeasonPreviewsLoaded',preferences:'runnerPreferencesLoaded'};

// Trusted browser events may drain microtasks between capture and target
// listeners. A return queued in capture therefore runs before the desk closes.
for(const [id,section] of Object.entries(sections)){
  for(const closing of [true,false]){
    const classes=new Set([closing?section:'runnerMenuHome']),listeners=[],microtasks=[],timers=[];
    let shown=0;
    const syndicate={dataset:{state:closing&&id==='syndicate'?'connected':'disconnected'}};
    const document={
      documentElement:{dataset:{}},
      body:{dataset:{},classList:{contains:name=>classes.has(name),add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name))}},
      defaultView:{VigScopeMenuHome:{show:()=>shown++},scrollTo(){}},
      getElementById:name=>name==='runnerPrimaryNavShellStyle'?{}:name==='runnerSyndicateF5'?syndicate:null,
      querySelector:()=>null,querySelectorAll:()=>[],
      addEventListener:(type,handler,capture=false)=>listeners.push({type,handler,capture})
    };
    const context={document,window:{},queueMicrotask:handler=>microtasks.push(handler),setTimeout:(handler,ms)=>timers.push({handler,ms}),console};
    vm.runInNewContext(bindSource,context);context.bindForTest(document);shown=0;
    let labelAttached=true;
    const button={dataset:{menuId:id}};
    const label={closest:()=>labelAttached?button:null};
    const event={target:label,isTrusted:true,preventDefault(){},stopImmediatePropagation(){}};
    const checkpoint=()=>{while(microtasks.length)microtasks.shift()()};
    for(const listener of listeners.filter(l=>l.type==='click'&&l.capture)){listener.handler(event);checkpoint()}
    // The existing desk handler owns its loaded flag and connection state.
    if(closing){classes.delete(section);if(id==='syndicate'){syndicate.dataset.state='disconnected';labelAttached=false}}
    else {classes.add(section);if(id==='syndicate')syndicate.dataset.state='connected'}
    checkpoint();
    for(const listener of listeners.filter(l=>l.type==='click'&&!l.capture)){listener.handler(event);checkpoint()}
    assert.equal(classes.has('runnerMenuHome'),closing,`${id}: home state must be correct when the click finishes`);
    assert.equal(shown,closing?1:0,`${id}: restore the prepared menu after the desk closes, before any timer or animation frame`);
    assert.equal(timers.length,0,`${id}: navigation must not depend on a delayed return`);
  }
}
console.log('Specialty menu returns: PASS // all five trusted-event paths finish on the prepared menu without timers; opening preserves each secondary screen');
