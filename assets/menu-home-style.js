(()=>{
  'use strict';

  // Presentation only. The canonical menu keeps every button and click/key handler.
  const VERSION='20261012-menu-2';
  const STYLE_ID='vigMenuHomeStyle';
  const BRAND_SRC='/site-assets/product-badges/vigscope-small.png';
  const ART_BASE='./assets/menu-home/';
  const ITEMS={
    board:{name:'VigScope',emoji:'📺',art:'board.webp'},
    market:{name:'Market',emoji:'📈',art:'market.webp'},
    history:{name:'Bet History',emoji:'🎟️',art:'history.webp'},
    syndicate:{name:'Syndicate',emoji:'💵',art:'syndicate.webp'},
    pizza:{name:'Pizza Plays',emoji:'🍕',art:'pizza.webp'},
    crypto:{name:'Crypto Specials',emoji:'🔒',art:'crypto.webp'},
    meat:{name:'Meat Desk',emoji:'🥩',art:'meat.webp'},
    engine:{name:'VigScope Value',emoji:'🧠',art:'value.webp'},
    preferences:{name:'Preferences',emoji:'⚙️',art:null}
  };
  const ORDER=Object.keys(ITEMS);
  const originals=new WeakMap();
  let ready=false,attached=false,scheduled=false,grid=null,top=null,brand=null,overlay=null;

  function layoutForViewport(width,height){
    width=Math.max(1,Number(width)||1);height=Math.max(1,Number(height)||1);
    const landscape=width>height&&width>=480;
    const columns=landscape?4:2,rows=landscape?2:4;
    const padding=width<360?6:width<650?8:12;
    const gap=height<350?6:width>=650?10:8;
    const header=Math.round(Math.min(landscape?70:104,Math.max(landscape?30:46,height*0.13)));
    const preferences=height<600?44:48;
    const tileHeight=(height-header-padding*2-preferences-gap*rows-2)/rows;
    const tileWidth=(Math.min(width,1440)-padding*2-gap*(columns-1)-2)/columns;
    const roomy=landscape&&height>=560&&tileHeight>=tileWidth*.62;
    let icon,font;
    if(landscape&&!roomy){
      icon=Math.floor(Math.min(128,Math.max(24,Math.min(tileHeight-20,tileWidth*.36))));
      font=Math.min(28,Math.max(13,Math.min((tileWidth-icon-26)/6.1,(tileHeight-18)/2.2)));
    }else{
      font=Math.min(30,Math.max(16,Math.min((tileWidth-20)/6.1,tileHeight*.18)));
      icon=Math.floor(Math.min(roomy?172:142,tileWidth*.64,Math.max(24,tileHeight-font*2.15-24)));
    }
    return {landscape,roomy,columns,rows,padding,gap,header,preferences,tileHeight,tileWidth,icon,font:Math.round(font*10)/10};
  }

  function menuOpen(){
    return document.body.classList.contains('runnerMenuHome');
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;sync()});
  }
  function setViewport(){
    if(!menuOpen()||!document.body.classList.contains('vigMenuStyled'))return;
    const view=window.visualViewport;
    const height=Math.min(window.innerHeight,view?.height||window.innerHeight);
    const width=Math.min(window.innerWidth,view?.width||window.innerWidth);
    const computed=window.getComputedStyle(document.body);
    const vertical=(parseFloat(computed.paddingTop)||0)+(parseFloat(computed.paddingBottom)||0);
    const horizontal=(parseFloat(computed.paddingLeft)||0)+(parseFloat(computed.paddingRight)||0);
    const fit=layoutForViewport(width-horizontal,height-vertical);
    const style=document.documentElement.style;
    const values={height,pad:fit.padding,gap:fit.gap,header:fit.header,prefs:fit.preferences,art:fit.icon,font:fit.font};
    for(const [key,value] of Object.entries(values))style.setProperty('--vig-menu-'+key,value+'px');
    document.body.classList.toggle('vigMenuLandscape',fit.landscape);
    document.body.classList.toggle('vigMenuRoomy',fit.roomy);
  }
  function faceFor(id){
    const existing=overlay.querySelector('.vigMenuTile[data-vig-menu-id="'+id+'"]');
    if(existing)return existing;
    const item=ITEMS[id];
    const face=document.createElement('span');face.className='vigMenuFace vigMenuTile';face.setAttribute('data-vig-menu-id',id);
    const art=document.createElement('span');art.className='vigMenuArt';
    const fallback=document.createElement('span');fallback.className='vigMenuEmoji';fallback.textContent=item.emoji;
    art.appendChild(fallback);
    if(item.art){
      const image=document.createElement('img');image.alt='';image.decoding='async';image.draggable=false;
      image.addEventListener('load',()=>art.classList.add('vigMenuArtReady'));
      image.addEventListener('error',()=>art.classList.remove('vigMenuArtReady'));
      image.src=ART_BASE+item.art+'?v='+VERSION;
      art.appendChild(image);
    }
    const name=document.createElement('span');name.className='vigMenuName';name.textContent=item.name;
    face.appendChild(art);face.appendChild(name);overlay.appendChild(face);
    return face;
  }
  function mount(){
    const buttons=ORDER.map(id=>grid.querySelector('.btn[data-menu-id="'+id+'"]'));
    if(buttons.some(button=>!button))return;
    // Specialty renderers compare their buttons' complete innerHTML. A separate,
    // pointer-transparent artwork layer leaves those contents byte-for-byte intact.
    if(!overlay||overlay.parentElement!==grid){
      overlay=document.createElement('div');overlay.className='vigMenuOverlay';overlay.setAttribute('aria-hidden','true');grid.appendChild(overlay);
    }
    buttons.forEach((button,i)=>{
      if(!originals.has(button))originals.set(button,{ariaLabel:button.getAttribute('aria-label')});
      faceFor(ORDER[i]);
      button.setAttribute('aria-label',ITEMS[ORDER[i]].name);
    });
    if(!brand){
      brand=document.createElement('div');brand.id='vigMenuBrand';
      const image=document.createElement('img');image.alt='VigScope — VigWire Labs';image.decoding='async';image.draggable=false;
      image.setAttribute('fetchpriority','high');image.src=BRAND_SRC;
      const fallback=document.createElement('span');fallback.className='vigMenuBrandFallback';fallback.textContent='VigScope';
      image.addEventListener('error',()=>brand?.classList.add('vigMenuBrandError'));
      brand.appendChild(image);brand.appendChild(fallback);top.appendChild(brand);
    }
    if(!document.body.classList.contains('vigMenuStyled'))document.body.classList.add('vigMenuStyled');
    setViewport();
  }
  function unmount(){
    document.body.classList.remove('vigMenuStyled','vigMenuLandscape','vigMenuRoomy');
    if(overlay){overlay.remove();overlay=null}
    grid?.querySelectorAll('.btn[data-menu-id]').forEach(button=>{
      const original=originals.get(button);if(!original)return;
      if(original.ariaLabel===null)button.removeAttribute('aria-label');else button.setAttribute('aria-label',original.ariaLabel);
      originals.delete(button);
    });
    if(brand){brand.remove();brand=null}
  }
  function sync(){
    if(!attached||!ready)return;
    if(menuOpen())mount();else if(document.body.classList.contains('vigMenuStyled')||brand)unmount();
  }
  function attach(){
    if(attached)return true;
    grid=document.querySelector('.runnerNavPad .tabs');top=document.querySelector('main.term>header.top');
    if(!grid||!top||ORDER.some(id=>!grid.querySelector('.btn[data-menu-id="'+id+'"]')))return false;
    attached=true;
    const stateObserver=new MutationObserver(schedule);
    stateObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
    const menuObserver=new MutationObserver(()=>{if(menuOpen())schedule()});
    menuObserver.observe(grid,{childList:true,subtree:true});
    window.addEventListener('resize',schedule,{passive:true});
    window.visualViewport?.addEventListener('resize',schedule,{passive:true});
    window.addEventListener('pageshow',schedule,{passive:true});
    schedule();return true;
  }
  function boot(){
    let sheet=document.getElementById(STYLE_ID);
    if(!sheet){
      sheet=document.createElement('link');sheet.id=STYLE_ID;sheet.rel='stylesheet';
      sheet.addEventListener('load',()=>{ready=true;schedule()});
      sheet.href='./assets/menu-home-style.css?v='+VERSION;
      document.head.appendChild(sheet);
    }else{ready=!!sheet.sheet}
    let attempts=0;
    const timer=setInterval(()=>{attempts++;if(attach()||attempts>=160)clearInterval(timer)},50);
    attach();
    document.addEventListener('vigscope-app-ready',()=>{attach();schedule()});
  }

  // Read-only artwork map supports replacing one graphic without touching routing.
  window.VigScopeMenuHome={version:VERSION,artwork:Object.fromEntries(ORDER.map(id=>[id,ITEMS[id].art?ART_BASE+ITEMS[id].art:null])),refresh:schedule};
  boot();
})();
