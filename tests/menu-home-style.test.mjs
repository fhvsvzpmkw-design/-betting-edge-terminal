import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/menu-home-style.js','utf8');
const css=fs.readFileSync('assets/menu-home-style.css','utf8');
const loader=fs.readFileSync('assets/report-dashboard-vigscope.js','utf8');
const order=['board','market','history','syndicate','pizza','crypto','meat','engine','preferences'];
const labels=['VigScope','Market','Bet History','Syndicate','Pizza Plays','Crypto Specials','Meat Desk','VigScope Value','Preferences'];

// Exercise the shipped script against existing button identities and callbacks.
// Mutation records intentionally include same-value class writes to detect loops.
function fixture(startOnMenu=true,complete=true){
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
      this.textContent='';this.style={values:new Map(),setProperty(key,value){this.values.set(key,value)}};
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
    click(){this.onclick?.({target:this,currentTarget:this})}
  }
  const html=new Element('html'),head=new Element('head'),body=new Element('body');
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
  document={head,body,documentElement:html,createElement:tag=>new Element(tag),listeners:new Map(),
    getElementById:id=>[html,...html.all()].find(element=>element.id===id)||null,
    querySelector:selector=>selector==='.runnerNavPad .tabs'?grid:selector==='main.term>header.top'?top:null,
    addEventListener(name,fn){this.listeners.set(name,fn)}
  };
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
  const context={document,MutationObserver,console,WeakMap,Math,Object,Number,parseFloat,
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
  return {context,document,body,top,grid,buttons,callbacks,routed,originalHeader,drain,intervals};
}

const app=fixture();
app.drain();
assert.equal(app.body.classList.contains('vigMenuStyled'),false,'failed or unfinished CSS must retain the working original menu');
app.document.getElementById('vigMenuHomeStyle').emit('load');app.drain();
assert.equal(app.body.classList.contains('vigMenuStyled'),true);
assert.equal(app.grid.querySelectorAll('.vigMenuFace').length,9,'all nine selections visible in the menu presentation');
assert.equal(app.top.children[0],app.originalHeader,'original header is retained, not rebuilt');
assert.equal(app.document.getElementById('vigMenuBrand').children[0].src,'/site-assets/product-badges/vigscope-small.png','reuse the authentic product badge');
app.buttons.forEach((button,i)=>{
  assert.equal(button.children.length,1,'original complete button contents must remain intact while the artwork is visible');
  assert.equal(button.getAttribute('aria-label'),labels[i]);
  assert.equal(button.onclick,app.callbacks[i],'existing click handler is preserved');
  assert.equal(button.listeners.has('click'),false,'presentation must not add a competing click handler');
  assert.equal(button.getAttribute('aria-keyshortcuts'),i<8?'F'+(i+1):'Tab');
});
assert.equal(app.context.listeners.has('keydown'),false,'function-key authority stays with existing modules');
assert.equal(app.document.listeners.has('click'),false,'no new routing or event interception');

// Opening every existing section removes all menu artwork and theme state.
for(let i=0;i<9;i++){
  app.buttons[i].click();app.drain();
  assert.equal(app.routed.at(-1),order[i]);
  assert.equal(app.body.classList.contains('vigMenuStyled'),false,'section must never inherit the menu theme');
  assert.equal(app.body.classList.contains('vigMenuLandscape'),false);
  assert.equal(app.grid.querySelectorAll('.vigMenuFace').length,0,'secondary controls retain original markup');
  assert.deepEqual(app.top.children,[app.originalHeader]);
  app.buttons.forEach((button,j)=>{
    assert.equal(button.children.length,1);
    assert.equal(button.children[0].textContent,'ORIGINAL SCREEN CONTROL '+order[j]);
    assert.equal(button.getAttribute('aria-label'),j===3?'Original syndicate label':null);
    assert.equal(button.onclick,app.callbacks[j]);
  });
  app.body.classList.remove('section-open');app.body.classList.add('runnerMenuHome');app.drain();
  assert.equal(app.grid.querySelectorAll('.vigMenuFace').length,9,'returning to menu restores the new appearance');
}

// Existing renderers can refresh labels; add artwork without replacing buttons.
const face=app.grid.querySelector('.vigMenuTile[data-vig-menu-id="pizza"]');face.remove();app.drain();
assert.equal(app.grid.querySelectorAll('.vigMenuFace').length,9);
assert.equal(app.buttons[4].onclick,app.callbacks[4]);
const art=app.grid.querySelector('.vigMenuTile[data-vig-menu-id="board"]').querySelector('.vigMenuArt'),image=art.children.find(child=>child.tagName==='img');
image.emit('load');assert.equal(art.classList.contains('vigMenuArtReady'),true);
image.emit('error');assert.equal(art.classList.contains('vigMenuArtReady'),false,'image failure leaves the classic emoji fallback available');

// A direct Syndicate entry starts and remains on its existing secondary screen.
const direct=fixture(false);direct.document.getElementById('vigMenuHomeStyle').emit('load');direct.drain();
assert.equal(direct.grid.querySelectorAll('.vigMenuFace').length,0);
assert.equal(direct.body.classList.contains('vigMenuStyled'),false);

const late=fixture(true,false);late.document.getElementById('vigMenuHomeStyle').emit('load');late.drain();
late.buttons.forEach((button,i)=>button.setAttribute('data-menu-id',order[i]));
late.intervals.forEach(fn=>fn());late.drain();
assert.equal(late.grid.querySelectorAll('.vigMenuFace').length,9,'boot waits for canonical buttons rather than creating replacements');

const sizes=[[320,480],[375,550],[390,650],[414,700],[768,1024],[375,720],[844,220],[844,300],[896,330],[1024,768],[1366,768],[1440,900]];
const results=sizes.map(([width,height])=>{
  const fit=app.context.testAPI.layoutForViewport(width,height);
  assert.equal(fit.columns,width>height&&width>=580?4:2);
  assert.ok(fit.tileHeight>=44&&fit.tileWidth>=44,'buttons retain a useful touch target');
  const total=fit.header+fit.padding*2+fit.preferences+fit.gap*fit.rows+fit.tileHeight*fit.rows+2;
  assert.ok(Math.abs(total-height)<.01,'eight tiles and Preferences fit the available height');
  const textHeight=fit.font*2.14;
  assert.ok(textHeight+12<fit.tileHeight,'two-line labels fit');
  if(!fit.landscape)assert.ok(fit.icon+textHeight+16<=fit.tileHeight+.2,'portrait artwork and two-line label fit together');
  return {width,height,columns:fit.columns,rows:fit.rows,tileHeight:+fit.tileHeight.toFixed(1),font:fit.font};
});
app.context.innerWidth=844;app.context.innerHeight=300;app.context.visualViewport.width=844;app.context.visualViewport.height=280;
app.context.listeners.get('resize')();app.drain();
assert.equal(app.body.classList.contains('vigMenuLandscape'),true);
assert.equal(app.document.documentElement.style.values.get('--vig-menu-height'),'280px','fit uses the shorter actual browser viewport');

const artwork=Object.values(app.context.VigScopeMenuHome.artwork).filter(Boolean);
assert.equal(new Set(artwork).size,8,'each graphic can be replaced independently');
for(const path of artwork){assert.ok(fs.statSync(path).size<50000,'menu artwork is mobile-sized')}
for(const [,selector] of css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{/g)){
  const clean=selector.trim();if(clean.startsWith('@'))continue;
  assert.ok(clean.startsWith('body.vigMenuStyled.runnerMenuHome'),'all menu CSS is scoped away from secondary pages: '+clean);
}
assert.doesNotMatch(source,/fetch\(|localStorage|BettingEdgeRunnerPayload|\.onclick\s*=/,'menu appearance cannot fetch or change report data, storage, or routes');
assert.equal((loader.match(/menuHomeStyleLoader/g)||[]).length,1);
console.log('Menu style: PASS // 9 existing button handlers, section cleanup/return, direct Syndicate entry, delayed bootstrap, image fallback, observer settling, 8 independent assets, 12 viewport fits');
console.log(JSON.stringify(results));
