import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import './menu-home-cascade.test.mjs';
import './primary-nav-return.test.mjs';

const source=fs.readFileSync('assets/menu-home-style.js','utf8');
const css=fs.readFileSync('assets/menu-home-style.css','utf8');
const loader=fs.readFileSync('assets/report-dashboard-vigscope.js','utf8');
const runner=fs.readFileSync('runner.html','utf8');
const menuVersion=source.match(/const VERSION='([^']+)'/)[1];
const order=['board','market','history','syndicate','pizza','crypto','meat','engine','preferences'];
const labels=['VigScope','Market','Bet History','Syndicate','Pizza Plays','Crypto Specials','Meat Desk','VigScope Value','Preferences'];

// Exercise the shipped script against existing button identities and callbacks.
// Mutation records intentionally include same-value class writes to detect loops.
function fixture(startOnMenu=true,complete=true,preloaded=false){
  const frames=[],observers=[],intervals=[];
  let document;
  const notify=(target,type,attributeName)=>{
    for(const observer of observers){
      for(const watch of observer.watches){
        const inScope=watch.target===target||(watch.options.subtree&&watch.target.contains(target));
        if(!inScope||!watch.options[type])continue;
        if(type==='attributes'&&watch.options.attributeFilter&&!watch.options.attributeFilter.includes(attributeName))continue;
        observer.pending=true;
      }
    }
  };
  class Element{
    constructor(tag){
      this.tagName=tag;this.children=[];this.attrs=new Map();this.listeners=new Map();this.parentElement=null;
      this.textContent='';this.dataset={};this.style={values:new Map(),setProperty(key,value){this.values.set(key,value)}};
      const owner=this;
      this.classList={
        contains(name){return String(owner.className).split(/\s+/).includes(name)},
        add(...names){const set=new Set(String(owner.className).split(/\s+/).filter(Boolean));names.forEach(name=>set.add(name));owner.className=[...set].join(' ')},
        remove(...names){owner.className=String(owner.className).split(/\s+/).filter(name=>name&&!names.includes(name)).join(' ')},
        toggle(name,force){const present=this.contains(name),wanted=force??!present;if(present!==wanted){if(wanted)this.add(name);else this.remove(name)}return wanted}
      };
    }
    get className(){return this.attrs.get('class')||''}
    set className(value){this.attrs.set('class',value);notify(this,'attributes','class')}
    get id(){return this.attrs.get('id')||''}
    set id(value){this.attrs.set('id',value)}
    setAttribute(name,value){this.attrs.set(name,String(value));notify(this,'attributes',name)}
    getAttribute(name){return this.attrs.has(name)?this.attrs.get(name):null}
    removeAttribute(name){this.attrs.delete(name);notify(this,'attributes',name)}
    addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn)}
    emit(name){for(const fn of this.listeners.get(name)||[])fn({target:this})}
    appendChild(child){child.parentElement=this;this.children.push(child);notify(this,'childList');return child}
    remove(){const parent=this.parentElement;if(!parent)return;parent.children=parent.children.filter(child=>child!==this);this.parentElement=null;notify(parent,'childList')}
    contains(child){return this===child||this.children.some(item=>item.contains(child))}
    all(){return this.children.flatMap(child=>[child,...child.all()])}
    matches(selector){
      if(selector.startsWith('.')){
        const parsed=selector.match(/^\.([\w-]+)(?:\[([\w-]+)(?:="([^"]*)")?\])?$/);
        return !!parsed&&this.classList.contains(parsed[1])&&(!parsed[2]||(this.attrs.has(parsed[2])&&(parsed[3]===undefined||this.attrs.get(parsed[2])===parsed[3])));
      }
      return false;
    }
    querySelectorAll(selector){return this.all().filter(child=>child.matches(selector))}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null}
    click(){this.emit('click');this.onclick?.({target:this,currentTarget:this})}
  }
  const html=new Element('html'),head=new Element('head'),body=new Element('body');
  html.dataset.vigMenuStartup='pending';
  html.appendChild(head);html.appendChild(body);
  const term=new Element('main');term.className='term';body.appendChild(term);
  const top=new Element('header');top.className='top';term.appendChild(top);
  const originalHeader=new Element('div');originalHeader.textContent='EXISTING HEADER, BANKROLL AND CONTROLS';top.appendChild(originalHeader);
  const pad=new Element('section');pad.className='runnerNavPad';term.appendChild(pad);
  const grid=new Element('div');grid.className='tabs';pad.appendChild(grid);
  const routed=[],callbacks=[],buttons=[];
  order.forEach((id,i)=>{
    const button=new Element('button');button.className='btn';button.id='original-'+id;
    if(complete)button.setAttribute('data-menu-id',id);
    button.setAttribute('aria-keyshortcuts',i<8?'F'+(i+1):'Tab');
    if(i===3)button.setAttribute('aria-label','Original syndicate label');
    const original=new Element('span');original.className='original-label';original.textContent='ORIGINAL SCREEN CONTROL '+id;button.appendChild(original);
    button.onclick=()=>{routed.push(id);body.classList.remove('runnerMenuHome');body.classList.add('section-open')};
    callbacks.push(button.onclick);buttons.push(button);grid.appendChild(button);
  });
  if(startOnMenu)body.classList.add('runnerMenuHome');else body.classList.add('section-open');
  document={head,body,documentElement:html,createElement:tag=>new Element(tag),listeners:new Map(),events:[],
    getElementById:id=>[html,...html.all()].find(element=>element.id===id)||null,
    querySelector:selector=>selector==='.runnerNavPad .tabs'?grid:selector==='main.term>header.top'?top:selector==='main.term'?term:null,
    addEventListener(name,fn){this.listeners.set(name,fn)},
    dispatchEvent(event){this.events.push(event.type);this.listeners.get(event.type)?.(event)}
  };
  if(preloaded){const sheet=new Element('link');sheet.id='vigMenuHomeStyle';sheet.sheet={};head.appendChild(sheet)}
  class MutationObserver{
    constructor(callback){this.callback=callback;this.watches=[];this.pending=false;observers.push(this)}
    observe(target,options){this.watches.push({target,options})}
  }
  // The existing specialty module watches the nav and restores complete labels.
  // Any art inside a button would fight that renderer forever. Keep this watcher
  // running during every state transition to catch that integration regression.
  const oldChildren=buttons.map(button=>button.children[0]);
  const specialtyObserver=new MutationObserver(()=>{
    buttons.forEach((button,i)=>{
      for(const child of [...button.children])if(child!==oldChildren[i])child.remove();
    });
  });
  specialtyObserver.observe(pad,{childList:true,subtree:true});
  const context={document,MutationObserver,CustomEvent:class{constructor(type){this.type=type}},console,WeakMap,Math,Object,Number,parseFloat,
    innerWidth:414,innerHeight:700,visualViewport:{width:414,height:700,addEventListener(){}},
    requestAnimationFrame:fn=>{frames.push(fn);return frames.length},setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval(){},
    getComputedStyle:()=>({paddingTop:'0',paddingBottom:'0',paddingLeft:'0',paddingRight:'0'}),listeners:new Map(),
    addEventListener(name,fn){this.listeners.set(name,fn)}
  };
  context.window=context;
  vm.runInNewContext(source.replace('  boot();','  globalThis.testAPI={layoutForViewport};\n  boot();'),context);
  function drain(){
    let passes=0;
    while(frames.length||observers.some(observer=>observer.pending)){
      assert.ok(++passes<20,'menu observer must settle without a mutation loop');
      for(const observer of observers){if(observer.pending){observer.pending=false;observer.callback([])}}
      const run=frames.splice(0);run.forEach(fn=>fn());
    }
  }
  return {context,document,body,top,grid,buttons,callbacks,routed,originalHeader,drain,intervals,get menu(){return document.getElementById('vigMainMenu')}};
}

const app=fixture();
app.drain();
assert.equal(app.body.classList.contains('vigMenuStyled'),false,'failed or unfinished CSS must retain the working original menu');
app.document.getElementById('vigMenuHomeStyle').emit('load');app.drain();
assert.equal(app.body.classList.contains('vigMenuStyled'),true);
assert.equal(app.menu.querySelectorAll('.vigMenuFace').length,9,'all nine selections visible in the menu presentation');
assert.equal(app.top.children[0],app.originalHeader,'original header is retained, not rebuilt');
assert.equal(app.document.getElementById('vigMenuBrand'),null,'the main menu must not add a top badge');
assert.equal(app.context.VigScopeMenuHome.ready,false,'startup waits for artwork rather than revealing loading emoji');
const initialImages=app.menu.all().filter(element=>element.tagName==='img');
assert.equal(initialImages.length,8);
for(const image of initialImages.slice(0,-1))image.emit('load');app.drain();
assert.equal(app.document.documentElement.dataset.vigMenuStartup,'pending');
initialImages.at(-1).emit('load');app.drain();
assert.equal(app.document.documentElement.dataset.vigMenuStartup,'ready');
assert.equal(app.context.VigScopeMenuHome.ready,true);
assert.equal(app.document.events.filter(type=>type==='vigscope-menu-ready').length,1);
app.buttons.forEach((button,i)=>{
  assert.equal(button.children.length,1,'original complete button contents must remain intact while the artwork is visible');
  assert.equal(button.getAttribute('aria-label'),i===3?'Original syndicate label':null,'the original secondary controls retain their accessibility labels');
  assert.equal(app.menu.children[i].getAttribute('aria-label'),labels[i]);
  assert.equal(app.menu.children[i].tagName,'button','each main-menu selection is its own real button');
  assert.equal(button.onclick,app.callbacks[i],'existing click handler is preserved');
  assert.equal(button.listeners.has('click'),false,'presentation must not add a competing click handler');
  assert.equal(button.getAttribute('aria-keyshortcuts'),i<8?'F'+(i+1):'Tab');
});
assert.equal(app.context.listeners.has('keydown'),false,'function-key authority stays with existing modules');
assert.equal(app.document.listeners.has('click'),false,'no new routing or event interception');

// The new buttons delegate to existing section controls and keep their images prepared.
for(let i=0;i<9;i++){
  app.menu.children[i].click();app.drain();
  assert.equal(app.routed.at(-1),order[i]);
  assert.equal(app.body.classList.contains('vigMenuStyled'),false,'section must never inherit the menu theme');
  assert.equal(app.body.classList.contains('vigMenuLandscape'),false);
  assert.equal(app.body.classList.contains('vigMenuRoomy'),false);
  assert.equal(app.menu.hidden,true,'the standalone main menu is absent from the visible secondary screen');
  assert.deepEqual(app.menu.all().filter(element=>element.tagName==='img'),initialImages,'artwork is not recreated between visits');
  assert.deepEqual(app.top.children,[app.originalHeader]);
  app.buttons.forEach((button,j)=>{
    assert.equal(button.children.length,1);
    assert.equal(button.children[0].textContent,'ORIGINAL SCREEN CONTROL '+order[j]);
    assert.equal(button.getAttribute('aria-label'),j===3?'Original syndicate label':null);
    assert.equal(button.onclick,app.callbacks[j]);
  });
  app.body.classList.remove('section-open');app.body.classList.add('runnerMenuHome');
  app.context.VigScopeMenuHome.show();
  assert.equal(app.body.classList.contains('vigMenuStyled'),true,'the menu is prepared synchronously before any animation frame');
  assert.equal(app.menu.hidden,false);
  app.drain();
  assert.equal(app.menu.querySelectorAll('.vigMenuFace').length,9,'returning to menu restores the new appearance');
}

// Existing section renderers can refresh controls without touching the new menu.
const face=app.menu.querySelector('.vigMenuTile[data-vig-menu-id="pizza"]');
app.buttons[4].appendChild(app.document.createElement('span'));app.drain();
assert.equal(app.menu.querySelectorAll('.vigMenuFace').length,9);
assert.equal(app.menu.querySelector('.vigMenuTile[data-vig-menu-id="pizza"]'),face);
assert.equal(app.buttons[4].onclick,app.callbacks[4]);
const art=app.menu.querySelector('.vigMenuTile[data-vig-menu-id="board"]').querySelector('.vigMenuArt'),image=art.children.find(child=>child.tagName==='img');
image.emit('load');assert.equal(art.classList.contains('vigMenuArtReady'),true);
image.emit('error');assert.equal(art.classList.contains('vigMenuArtReady'),false,'image failure leaves the classic emoji fallback available');

// A direct Syndicate entry starts and remains on its existing secondary screen.
const direct=fixture(false);direct.document.getElementById('vigMenuHomeStyle').emit('load');direct.drain();
assert.equal(direct.menu.hidden,true);
assert.equal(direct.menu.children.length,9,'prepare the standalone menu without altering a direct section entry');
assert.equal(direct.body.classList.contains('vigMenuStyled'),false);
direct.body.classList.add('runnerSyndicateLoaded');direct.drain();
assert.equal(direct.context.VigScopeMenuHome.ready,true,'a direct secondary-screen entry must not wait for unused menu artwork');

const early=fixture(true,true,true);early.drain();
assert.equal(early.body.classList.contains('vigMenuStyled'),true,'reuse the stylesheet loaded in the document head');
assert.equal(early.document.head.children.filter(element=>element.id==='vigMenuHomeStyle').length,1);
const failed=fixture();failed.document.getElementById('vigMenuHomeStyle').emit('error');failed.drain();
for(const image of failed.menu.all().filter(element=>element.tagName==='img'))image.emit('error');failed.drain();
assert.equal(failed.document.documentElement.dataset.vigMenuStartup,'fallback');
assert.equal(failed.body.classList.contains('vigMenuFallback'),true,'failed CSS uses the same standalone buttons');
assert.equal(failed.menu.hidden,false);

let releaseStartup;const startupRoot={dataset:{}},startupEvents=[];
const startupListeners=new Map();
vm.runInNewContext(runner.match(/<script id="vigMenuBootGuardRuntime">([\s\S]*?)<\/script>/)[1],{
  document:{documentElement:startupRoot,addEventListener:(type,handler)=>startupListeners.set(type,handler),dispatchEvent:event=>{startupEvents.push(event.type);startupListeners.get(event.type)?.()}},
  CustomEvent:class{constructor(type){this.type=type}},
  setTimeout:(handler,ms)=>{assert.equal(ms,10000);releaseStartup=handler;return 1},clearTimeout:()=>{}
});
assert.equal(startupRoot.dataset.vigMenuStartup,'pending');releaseStartup();
assert.equal(startupRoot.dataset.vigMenuStartup,'fallback','missing menu code cannot leave the app permanently hidden');
assert.deepEqual(startupEvents,['vigscope-menu-ready']);

const late=fixture(true,false);late.document.getElementById('vigMenuHomeStyle').emit('load');late.drain();
late.buttons.forEach((button,i)=>button.setAttribute('data-menu-id',order[i]));
late.intervals.forEach(fn=>fn());late.drain();
assert.equal(late.menu.querySelectorAll('.vigMenuFace').length,9,'boot waits for canonical buttons rather than creating replacements');

const sizes=[[320,480],[375,550],[390,650],[414,700],[768,1024],[375,720],[568,220],[667,280],[844,220],[844,300],[896,330],[1024,768],[1366,768],[1440,900]];
const results=sizes.map(([width,height])=>{
  const fit=app.context.testAPI.layoutForViewport(width,height);
  assert.equal(fit.columns,width>height&&width>=480?4:2);
  assert.equal(fit.header,0,'only the eight buttons and Preferences consume the menu viewport');
  assert.ok(fit.tileHeight>=44&&fit.tileWidth>=44,'buttons retain a useful touch target');
  assert.ok(fit.preferences>=44,'Preferences retains the same minimum touch height');
  const total=fit.header+fit.padding*2+fit.preferences+fit.gap*fit.rows+fit.tileHeight*fit.rows+2;
  assert.ok(Math.abs(total-height)<.01,'eight tiles and Preferences fit the available height');
  const textHeight=fit.font*2.14;
  assert.ok(textHeight+12<fit.tileHeight,'two-line labels fit');
  if(!fit.landscape||fit.roomy)assert.ok(fit.icon+textHeight+22<=fit.tileHeight+.2,'portrait artwork and two-line label fit together');
  return {width,height,columns:fit.columns,rows:fit.rows,tileHeight:+fit.tileHeight.toFixed(1),font:fit.font};
});
app.context.innerWidth=844;app.context.innerHeight=300;app.context.visualViewport.width=844;app.context.visualViewport.height=280;
app.context.listeners.get('resize')();app.drain();
assert.equal(app.body.classList.contains('vigMenuLandscape'),true);
assert.equal(app.document.documentElement.style.values.get('--vig-menu-height'),'280px','fit uses the shorter actual browser viewport');
app.context.innerWidth=1024;app.context.innerHeight=768;app.context.visualViewport.width=1024;app.context.visualViewport.height=768;
app.context.listeners.get('resize')();app.drain();
assert.equal(app.body.classList.contains('vigMenuRoomy'),true,'tablet landscape uses the space for centered artwork and labels');
app.buttons[0].click();app.drain();
assert.equal(app.body.classList.contains('vigMenuRoomy'),false,'tablet layout must be cleared on secondary screens');

// The real Preferences transition can retain runnerMenuHome alongside its
// loaded class. Every secondary state must override that stale home marker.
app.body.classList.remove('section-open');app.body.classList.add('runnerMenuHome');app.drain();
for(const state of ['runnerPrimaryViewLoaded','runnerSyndicateLoaded','runnerPizzaLoaded','runnerCryptoLoaded','runnerSeasonPreviewsLoaded','runnerPreferencesLoaded']){
  app.body.classList.add(state);app.drain();
  assert.equal(app.body.classList.contains('runnerMenuHome'),true,'presentation must not rewrite the original state authority');
  assert.equal(app.body.classList.contains('vigMenuStyled'),false,`${state}: section state takes priority over a lingering menu class`);
  assert.equal(app.menu.hidden,true);
  assert.deepEqual(app.top.children,[app.originalHeader]);
  app.body.classList.remove(state);app.drain();
  assert.equal(app.body.classList.contains('vigMenuStyled'),true,'closing the section restores the menu');
}

const artwork=Object.values(app.context.VigScopeMenuHome.artwork).filter(Boolean);
assert.equal(new Set(artwork).size,8,'each graphic can be replaced independently');
for(const path of artwork){assert.ok(fs.statSync(path).size<50000,'menu artwork is mobile-sized')}
for(const [,selector] of css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{/g)){
  const clean=selector.trim();if(clean.startsWith('@'))continue;
  assert.ok(clean.startsWith('body.vigMenuStyled.runnerMenuHome'),'all menu CSS is scoped away from secondary pages: '+clean);
}
assert.doesNotMatch(source,/fetch\(|localStorage|BettingEdgeRunnerPayload|\.onclick\s*=/,'menu appearance cannot fetch or change report data, storage, or routes');
assert.match(loader,/if\(!document\.getElementById\('menuHomeStyleLoader'\)\)/,'the compatibility wrapper must not load the early menu script twice');
assert.ok(runner.indexOf('id="vigMenuBootGuard"')<runner.indexOf('<body>'),'guard legacy content before it can paint');
assert.match(runner,/body:not\(\.runnerPrimaryViewLoaded\):not\(\.runnerSyndicateLoaded\):not\(\.runnerPizzaLoaded\):not\(\.runnerCryptoLoaded\):not\(\.runnerSeasonPreviewsLoaded\):not\(\.runnerPreferencesLoaded\) main\.term>:not\(#vigMainMenu\)\{display:none!important\}/,'old home content must also stay hidden during a return with no home or section marker');
assert.ok(runner.indexOf('id="vigMenuHomeStyle"')<runner.indexOf('<body>'));
assert.ok(runner.includes(`<script id="menuHomeStyleLoader" defer src="./assets/menu-home-style.js?v=${menuVersion}"></script>`));
assert.ok(runner.includes(`href="./assets/menu-home-style.css?v=${menuVersion}"`));
for(const path of artwork)assert.ok(runner.includes(`as="image" href="${path}?v=${menuVersion}"`),'preload the same individually replaceable artwork URLs');
assert.match(runner,/function reveal\(\)\{if\(!coreLoaded\|\|!timerDone\|\|document\.documentElement\.dataset\.vigMenuStartup==='pending'\)return;/,'the existing splash must wait for the finished menu');
assert.match(runner,/document\.addEventListener\('vigscope-menu-ready',reveal\)/);
assert.doesNotMatch(source,/vigMenuOverlay/,'the main menu must not be an overlay on the original navigation');
assert.match(fs.readFileSync('assets/primary-nav-shell.js','utf8'),/d\.defaultView\?\.VigScopeMenuHome\?\.show\(\)/,'return transitions render the standalone menu immediately');
console.log(`Menu style: PASS // 9 existing button handlers, standalone button delegation, synchronous return, retained artwork, direct Syndicate entry, delayed bootstrap, image fallback, observer settling, 8 independent assets, ${sizes.length} viewport fits`);
console.log(JSON.stringify(results));
