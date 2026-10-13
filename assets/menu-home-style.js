(()=>{
  'use strict';

  // The main menu owns real buttons. Existing controls keep section routing and keys.
  const VERSION='20261012-menu-6';
  const STYLE_ID='vigMenuHomeStyle';
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
  const SECTION_CLASSES=['runnerPrimaryViewLoaded','runnerSyndicateLoaded','runnerPizzaLoaded','runnerCryptoLoaded','runnerSeasonPreviewsLoaded','runnerPreferencesLoaded'];
  let ready=false,attached=false,scheduled=false,startupSettled=false,grid=null,menu=null;
  const pendingArt=new Set();

  function layoutForViewport(width,height){
    width=Math.max(1,Number(width)||1);height=Math.max(1,Number(height)||1);
    const landscape=width>height&&width>=480;
    const columns=landscape?4:2,rows=landscape?2:4;
    const padding=width<360?6:width<650?8:12;
    const gap=height<350?6:width>=650?10:8;
    const header=0;
    const preferences=height<600?44:48;
    const tileHeight=(height-header-padding*2-preferences-gap*rows-2)/rows;
    const tileWidth=(width-padding*2-gap*(columns-1)-2)/columns;
    const roomy=landscape&&height>=560&&tileHeight>=tileWidth*.62;
    let icon,font;
    if(landscape&&!roomy){
      icon=Math.floor(Math.min(128,Math.max(24,Math.min(tileHeight-20,tileWidth*(tileWidth<165?.25:.36)))));
      font=Math.min(28,Math.max(tileWidth<165?12.5:13,Math.min((tileWidth-icon-26)/6.1,(tileHeight-18)/2.2)));
    }else{
      font=Math.min(30,Math.max(16,Math.min((tileWidth-20)/6.1,tileHeight*.18)));
      icon=Math.floor(Math.min(roomy?172:142,tileWidth*.64,Math.max(24,tileHeight-font*2.15-24)));
    }
    return {landscape,roomy,columns,rows,padding,gap,header,preferences,tileHeight,tileWidth,icon,font:Math.round(font*10)/10};
  }

  function menuOpen(){
    const state=document.body.classList;
    // Some legacy transitions briefly retain the home class while opening a desk.
    // The section's state takes priority; its original screen owns presentation.
    return state.contains('runnerMenuHome')&&!SECTION_CLASSES.some(name=>state.contains(name));
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
    const values={height,pad:fit.padding,gap:fit.gap,prefs:fit.preferences,art:fit.icon,font:fit.font};
    for(const [key,value] of Object.entries(values))style.setProperty('--vig-menu-'+key,value+'px');
    document.body.classList.toggle('vigMenuLandscape',fit.landscape);
    document.body.classList.toggle('vigMenuRoomy',fit.roomy);
  }
  function faceFor(id){
    const existing=menu.querySelector('.vigMenuTile[data-vig-menu-id="'+id+'"]');
    if(existing)return existing;
    const item=ITEMS[id];
    const button=document.createElement('button');button.type='button';button.className='vigMenuButton vigMenuTile';button.setAttribute('data-vig-menu-id',id);
    button.setAttribute('aria-label',item.name);
    button.setAttribute('aria-keyshortcuts',grid.querySelector('.btn[data-menu-id="'+id+'"]').getAttribute('aria-keyshortcuts')||'');
    button.addEventListener('click',()=>{
      if(!menuOpen())return;
      const target=grid.querySelector('.btn[data-menu-id="'+id+'"]');
      if(!target)return;
      document.documentElement.dataset.primaryNavUserActivated='1';
      target.click();
    });
    const face=document.createElement('span');face.className='vigMenuFace';
    const art=document.createElement('span');art.className='vigMenuArt';
    const fallback=document.createElement('span');fallback.className='vigMenuEmoji';fallback.textContent=item.emoji;
    art.appendChild(fallback);
    if(item.art){
      const image=document.createElement('img');image.alt='';image.decoding='sync';image.draggable=false;
      pendingArt.add(image);
      image.addEventListener('load',()=>{art.classList.add('vigMenuArtReady');pendingArt.delete(image);schedule()});
      image.addEventListener('error',()=>{art.classList.remove('vigMenuArtReady');pendingArt.delete(image);schedule()});
      image.src=ART_BASE+item.art+'?v='+VERSION;
      art.appendChild(image);
    }
    const name=document.createElement('span');name.className='vigMenuName';name.textContent=item.name;
    face.appendChild(art);face.appendChild(name);button.appendChild(face);menu.appendChild(button);
    return button;
  }
  function prepare(){
    if(!menu){
      menu=document.createElement('nav');menu.id='vigMainMenu';menu.hidden=true;
      menu.setAttribute('aria-label','Main menu');
      document.querySelector('main.term').appendChild(menu);
    }
    ORDER.forEach(faceFor);
  }
  function mount(){
    prepare();
    if(!document.body.classList.contains('vigMenuStyled'))document.body.classList.add('vigMenuStyled');
    setViewport();
    menu.hidden=false;
  }
  function unmount(){
    if(menu)menu.hidden=true;
    if(document.body.classList.contains('vigMenuStyled'))document.body.classList.remove('vigMenuStyled','vigMenuLandscape','vigMenuRoomy');
  }
  function finishStartup(status='ready'){
    if(startupSettled)return;
    startupSettled=true;
    document.documentElement.dataset.vigMenuStartup=status;
    document.dispatchEvent(new CustomEvent('vigscope-menu-ready'));
  }
  function sync(){
    if(!attached||!ready)return;
    prepare();
    if(menuOpen()){
      mount();
      // Reveal the finished menu rather than the original labels or loading icons.
      if(pendingArt.size===0)finishStartup(document.body.classList.contains('vigMenuFallback')?'fallback':'ready');
    }else{
      unmount();
      if(SECTION_CLASSES.some(name=>document.body.classList.contains(name)))finishStartup();
    }
  }
  function attach(){
    if(attached)return true;
    grid=document.querySelector('.runnerNavPad .tabs');
    if(!grid||ORDER.some(id=>!grid.querySelector('.btn[data-menu-id="'+id+'"]')))return false;
    attached=true;
    const stateObserver=new MutationObserver(sync);
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
    const loaded=()=>{ready=true;schedule()};
    const failed=()=>{ready=true;document.body.classList.add('vigMenuFallback');schedule()};
    if(!sheet){
      sheet=document.createElement('link');sheet.id=STYLE_ID;sheet.rel='stylesheet';
      sheet.addEventListener('load',loaded);sheet.addEventListener('error',failed);
      sheet.href='./assets/menu-home-style.css?v='+VERSION;
      document.head.appendChild(sheet);
    }else{
      ready=!!sheet.sheet;
      sheet.addEventListener('load',loaded);sheet.addEventListener('error',failed);
      if(sheet.dataset?.failed==='1')failed();
    }
    let attempts=0;
    const timer=setInterval(()=>{attempts++;if(attach()||attempts>=160)clearInterval(timer)},50);
    attach();
    document.addEventListener('vigscope-app-ready',()=>{attach();schedule()});
  }

  // Keep artwork and the main menu prepared; original section controls own routing.
  window.VigScopeMenuHome={version:VERSION,get ready(){return startupSettled},show:sync,artwork:Object.fromEntries(ORDER.map(id=>[id,ITEMS[id].art?ART_BASE+ITEMS[id].art:null])),refresh:schedule};
  boot();
})();
