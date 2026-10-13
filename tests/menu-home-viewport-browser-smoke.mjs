import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
let page;
try{
  for(const framed of [false,true]){
    page=await browser.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    // Reproduce browser chrome moving the visible origin independently of the
    // document viewport. Child frames keep their native visualViewport.
    await page.evaluateOnNewDocument(()=>{
      if(window!==window.top||!window.visualViewport)return;
      window.menuViewportRect={width:834,height:980,top:50,left:0,cachedHeight:null};
      const view=window.visualViewport,state=window.menuViewportRect;
      for(const [property,key] of [['width','width'],['height','height'],['offsetTop','top'],['offsetLeft','left']])Object.defineProperty(view,property,{configurable:true,get:()=>state[key]});
      Object.defineProperty(window,'innerHeight',{configurable:true,get:()=>state.cachedHeight??document.documentElement.clientHeight});
    });
    if(framed){
      await page.setRequestInterception(true);
      page.on('request',request=>{
        if(new URL(request.url()).pathname==='/menu-viewport-host.html')return request.respond({status:200,contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#01040a}#app{width:100%;height:100%;border:0;display:block}</style></head><body><iframe id="app" src="/runner.html"></iframe></body></html>'});
        return request.continue();
      });
    }
    await page.setViewport({width:834,height:1080,deviceScaleFactor:1});
    await page.goto('http://127.0.0.1:8765/'+(framed?'menu-viewport-host.html':'runner.html'),{waitUntil:'domcontentloaded',timeout:60000});
    const target=framed?page.frames().find(frame=>frame.url().includes('/runner.html')):page.mainFrame();
    assert.ok(target);
    const ready=()=>target.waitForFunction(()=>window.VigScopeMenuHome?.ready&&document.body.classList.contains('vigMenuStyled')&&!document.getElementById('splash2'),{timeout:60000});
    await ready();
    fs.mkdirSync('.qa',{recursive:true});
    const scenarios=[
      {name:'portrait-bars',width:834,height:1080,rect:{width:834,height:980,top:50,left:0,cachedHeight:null}},
      {name:'landscape',width:1194,height:750,rect:{width:1194,height:650,top:0,left:0,cachedHeight:null}},
      {name:'portrait-after-rotation',width:834,height:1080,rect:{width:834,height:1010,top:24,left:0,cachedHeight:930}},
      {name:'portrait-bars-settle',width:834,height:1080,rect:{width:834,height:1000,top:60,left:0,cachedHeight:930},scrollOnly:true}
    ];
    for(const scenario of scenarios){
      await page.setViewport({width:scenario.width,height:scenario.height,deviceScaleFactor:1});
      await page.evaluate(({rect,scrollOnly})=>{
        Object.assign(window.menuViewportRect,rect);
        window.visualViewport.dispatchEvent(new Event(scrollOnly?'scroll':'resize'));
        if(!scrollOnly)window.dispatchEvent(new Event('orientationchange'));
      },scenario);
      await target.waitForFunction(height=>Math.abs(parseFloat(document.documentElement.style.getPropertyValue('--vig-menu-height'))-height)<.5,{},scenario.rect.height);
      await target.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const result=await target.evaluate(()=>{
        const term=document.querySelector('main.term'),r=term.getBoundingClientRect();
        return {box:{top:r.top,left:r.left,width:r.width,height:r.height,bottom:r.bottom,right:r.right},scroll:document.documentElement.scrollHeight,layoutHeight:document.documentElement.clientHeight,
          buttons:[...document.querySelectorAll('#vigMainMenu>.vigMenuButton')].map(button=>{const b=button.getBoundingClientRect();return {top:b.top,left:b.left,right:b.right,bottom:b.bottom,hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('.vigMenuButton')===button}})};
      });
      const expected=framed?{...scenario.rect,top:0,left:0}:scenario.rect;
      assert.ok(Math.abs(result.box.top-expected.top)<1,'the full top border must start at the visible viewport origin');
      assert.ok(Math.abs(result.box.left-expected.left)<1);
      assert.ok(Math.abs(result.box.bottom-(expected.top+expected.height))<1,'the menu must use the available bottom space');
      assert.ok(Math.abs(result.box.right-(expected.left+expected.width))<1);
      assert.ok(result.scroll<=result.layoutHeight+1,'the main menu cannot introduce document scrolling');
      assert.equal(result.buttons.length,9);
      for(const button of result.buttons){assert.ok(button.top>=expected.top&&button.left>=expected.left&&button.bottom<=expected.top+expected.height&&button.right<=expected.left+expected.width);assert.ok(button.hit,'every selection remains visible and clickable')}
      if(framed){
        const host=await page.$eval('#app',frame=>{const r=frame.getBoundingClientRect();return {top:r.top,height:r.height,pinned:frame.classList.contains('vigMenuHostViewport')}});
        assert.equal(host.pinned,true);assert.ok(Math.abs(host.top-scenario.rect.top)<1&&Math.abs(host.height-scenario.rect.height)<1);
      }
      await page.screenshot({path:`.qa/menu-viewport-${framed?'framed':'direct'}-${scenario.name}.png`});
      console.log(`MENU VIEWPORT ${framed?'framed':'direct'} ${scenario.name}: PASS // top/bottom aligned; 9 visible clickable selections; no scrolling`);
    }
    await target.click('#vigMainMenu>[data-vig-menu-id="preferences"]');
    await target.waitForFunction(()=>document.body.classList.contains('runnerPreferencesLoaded')&&!document.body.classList.contains('vigMenuStyled'));
    if(framed){
      const host=await page.$eval('#app',frame=>{const r=frame.getBoundingClientRect();return {top:r.top,height:r.height,pinned:frame.classList.contains('vigMenuHostViewport')}});
      assert.equal(host.pinned,false);assert.equal(host.top,0);assert.equal(host.height,1080,'secondary screens retain the original report-frame sizing');
    }
    await target.click('#runnerPreferencesF6');await ready();
    if(framed)assert.equal(await page.$eval('#app',frame=>frame.classList.contains('vigMenuHostViewport')),true);
    assert.deepEqual(errors,[]);await page.close();page=null;
  }
  console.log('MENU VIEWPORT BROWSER: PASS // direct and framed Safari-style visible origins, rotation, delayed layout height, scroll-only viewport changes, original secondary-frame restoration');
}catch(error){
  if(page){fs.mkdirSync('.qa',{recursive:true});await page.screenshot({path:'.qa/menu-viewport-failure.png'})}
  throw error;
}finally{await browser.close()}
