import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
let page;
try{
  page=await browser.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  let artworkRequests=0;page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/assets/menu-home/'))artworkRequests++});
  await page.evaluateOnNewDocument(()=>{
    window.menuBootCheck={frames:0,legacyFrames:0,earlyFadeFrames:0};
    const check=()=>{
      const state=window.menuBootCheck,body=document.body,term=document.querySelector('main.term'),splash=document.getElementById('splash2');
      state.frames++;
      const section=body&&['runnerPrimaryViewLoaded','runnerSyndicateLoaded','runnerPizzaLoaded','runnerCryptoLoaded','runnerSeasonPreviewsLoaded','runnerPreferencesLoaded'].some(name=>body.classList.contains(name));
      if(term&&!section&&!body.classList.contains('vigMenuStyled')&&getComputedStyle(term).visibility!=='hidden')state.legacyFrames++;
      if(splash?.classList.contains('fade')&&document.documentElement.dataset.vigMenuStartup==='pending')state.earlyFadeFrames++;
      if(!state.done)requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
  const ready=()=>page.waitForFunction(()=>window.VigScopeMenuHome?.ready&&document.documentElement.dataset.vigMenuStartup==='ready'&&document.body.classList.contains('vigMenuStyled')&&document.querySelectorAll('.vigMenuTile').length===9&&(!document.getElementById('splash2')||getComputedStyle(document.getElementById('splash2')).display==='none'||getComputedStyle(document.getElementById('splash2')).visibility==='hidden'),{timeout:60000});
  await page.setViewport({width:834,height:1000,deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:8765/runner.html',{waitUntil:'domcontentloaded',timeout:60000});await ready();
  await page.waitForFunction(()=>[...document.querySelectorAll('.vigMenuArt img')].every(image=>image.complete&&image.naturalWidth>0),{timeout:30000});
  const assertBoot=async()=>{
    const result=await page.evaluate(()=>{window.menuBootCheck.done=true;return window.menuBootCheck});
    assert.ok(result.frames>0);assert.equal(result.legacyFrames,0,'the old terminal menu must never paint before the new menu');
    assert.equal(result.earlyFadeFrames,0,'the splash must not fade before the menu is ready');
  };
  await assertBoot();
  fs.mkdirSync('.qa',{recursive:true});
  const viewports=[[834,1000],[1194,650],[390,650],[844,290],[568,220],[1920,900]];
  for(const [width,height] of viewports){
    await page.setViewport({width,height,deviceScaleFactor:1});
    await page.waitForFunction((landscape)=>document.body.classList.contains('vigMenuLandscape')===landscape,{},width>height);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const layout=await page.evaluate(()=>{
      const rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
      return {width:innerWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,
        headerDisplay:getComputedStyle(document.querySelector('main.term>header.top')).display,badge:!!document.getElementById('vigMenuBrand'),
        oldNavDisplay:getComputedStyle(document.querySelector('.runnerNavPad')).display,
        buttons:[...document.querySelectorAll('#vigMainMenu>.vigMenuButton')].map(button=>{
          const id=button.dataset.vigMenuId,face=button.querySelector('.vigMenuFace'),name=face.querySelector('.vigMenuName'),art=face.querySelector('.vigMenuArt'),box=rect(button);
          return {id,box,face:rect(face),name:rect(name),art:rect(art),textWidth:name.scrollWidth,textBoxWidth:name.clientWidth,display:getComputedStyle(button).display,
            hit:document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)?.closest('.vigMenuButton')===button};
        })};
    });
    assert.equal(layout.buttons.length,9);
    assert.equal(layout.headerDisplay,'none');assert.equal(layout.badge,false);assert.equal(layout.oldNavDisplay,'none','the original navigation cannot be the main-menu surface');
    assert.ok(layout.buttons[0].box.y<16,'the buttons must start at the top edge rather than reserving a header row');
    assert.ok(layout.scrollHeight<=height+1&&layout.scrollWidth<=width+1,`${width}x${height}: menu must fit without scrolling`);
    for(const button of layout.buttons){
      const {box,face}=button;
      assert.notEqual(button.display,'none');assert.ok(button.hit,`${button.id}: artwork must leave the original button clickable`);
      assert.ok(box.width>=44&&box.height>=44,`${button.id}: touch target is too small`);
      assert.ok(box.x>=0&&box.y>=0&&box.right<=width+1&&box.bottom<=height+1,`${button.id}: button must be fully on screen`);
      assert.ok(face.x>=box.x&&face.y>=box.y&&face.right<=box.right&&face.bottom<=box.bottom,'each real button contains its own artwork and title');
      for(const content of [button.art,button.name])assert.ok(content.x>=box.x-1&&content.y>=box.y-1&&content.right<=box.right+1&&content.bottom<=box.bottom+1,`${width}x${height}: ${button.id} graphic and title must fit inside its button`);
      assert.ok(button.textWidth<=button.textBoxWidth+1,`${width}x${height}: ${button.id} title must not overflow its text box`);
    }
    await page.screenshot({path:`.qa/menu-${width}x${height}.png`});
    console.log(`MENU BROWSER ${width}x${height}: PASS // 9 aligned, clickable targets; labels/graphics fit; no scrolling`);
  }
  const requestsBeforeReturn=artworkRequests;
  await page.evaluate(()=>{
    window.preparedMenuArt=[...document.querySelectorAll('#vigMainMenu img')];
    window.preparedMenuButtons=[...document.querySelectorAll('#vigMainMenu>.vigMenuButton')];
    window.returnCheck={frames:0,legacyFrames:0,loadingArtFrames:0};
    const inspect=()=>{
      const state=window.returnCheck,body=document.body,menu=document.getElementById('vigMainMenu'),nav=document.querySelector('.runnerNavPad');
      const section=['runnerPrimaryViewLoaded','runnerSyndicateLoaded','runnerPizzaLoaded','runnerCryptoLoaded','runnerSeasonPreviewsLoaded','runnerPreferencesLoaded'].some(name=>body.classList.contains(name));
      state.frames++;
      if(body.classList.contains('runnerMenuHome')&&!section){
        if(getComputedStyle(nav).display!=='none'&&nav.getBoundingClientRect().height>0)state.legacyFrames++;
        if(menu&&!menu.hidden&&[...menu.querySelectorAll('.vigMenuArt img')].some(image=>!image.parentElement.classList.contains('vigMenuArtReady')))state.loadingArtFrames++;
      }
      if(!state.done)requestAnimationFrame(inspect);
    };
    requestAnimationFrame(inspect);
  });
  const sections={board:'runnerPrimaryViewLoaded',market:'runnerPrimaryViewLoaded',history:'runnerPrimaryViewLoaded',syndicate:'runnerSyndicateLoaded',pizza:'runnerPizzaLoaded',crypto:'runnerCryptoLoaded',meat:'runnerSeasonPreviewsLoaded',engine:'runnerPrimaryViewLoaded',preferences:'runnerPreferencesLoaded'};
  for(const [width,height] of [[390,650],[1194,650]]){
    await page.setViewport({width,height,deviceScaleFactor:1});
    for(const [id,section] of Object.entries(sections)){
      await page.click(`#vigMainMenu>[data-vig-menu-id="${id}"]`);
      await page.waitForFunction((section)=>document.body.classList.contains(section)&&!document.body.classList.contains('vigMenuStyled')&&document.getElementById('vigMainMenu').hidden,{},section);
      if(id==='board')assert.match(await page.$eval('.tabs>.btn[data-menu-id="board"]',button=>button.innerHTML),/PRESS \[F1\] TO RETURN TO MENU/);
      await page.waitForFunction(id=>{
        const button=document.querySelector(`.tabs>.btn[data-menu-id="${id}"]`),box=button?.getBoundingClientRect();
        return box?.width>0&&box.height>0&&getComputedStyle(button).visibility!=='hidden';
      },{timeout:5000},id);
      await page.click(`.tabs>.btn[data-menu-id="${id}"]`);await ready();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const result=await page.evaluate(()=>({
        legacy:window.returnCheck.legacyFrames,loading:window.returnCheck.loadingArtFrames,
        retainedArt:window.preparedMenuArt.every((image,i)=>document.querySelectorAll('#vigMainMenu img')[i]===image),
        retainedButtons:window.preparedMenuButtons.every((button,i)=>document.querySelectorAll('#vigMainMenu>.vigMenuButton')[i]===button)
      }));
      assert.equal(result.legacy,0,`${id}: returning may not show the old navigation`);
      assert.equal(result.loading,0,`${id}: prepared artwork must not reload on return`);
      assert.ok(result.retainedArt&&result.retainedButtons,'the new main menu must remain prepared between visits');
      assert.equal(artworkRequests,requestsBeforeReturn,'no artwork requests on menu return');
      console.log(`MENU RETURN ${width}x${height} ${id}: PASS // actual standalone buttons; zero legacy/loading frames; no rebuild or image requests`);
    }
  }
  await page.evaluate(()=>{window.returnCheck.done=true});

  // Delay beyond the existing three-second splash minimum. Neither the old
  // layout nor half-loaded graphics may become visible while resources arrive.
  await page.setCacheEnabled(false);await page.setViewport({width:834,height:1000,deviceScaleFactor:1});
  await page.setRequestInterception(true);
  let delayedPath='';
  page.on('request',async request=>{
    if(new URL(request.url()).pathname.endsWith(delayedPath))await new Promise(resolve=>setTimeout(resolve,4500));
    await request.continue();
  });
  for(const path of ['/assets/menu-home-style.js','/assets/menu-home/pizza.webp']){
    delayedPath=path;
    const navigation=page.goto('http://127.0.0.1:8765/runner.html',{waitUntil:'domcontentloaded',timeout:60000});
    await new Promise(resolve=>setTimeout(resolve,3600));
    const waiting=await page.evaluate(()=>({state:document.documentElement.dataset.vigMenuStartup,hidden:getComputedStyle(document.querySelector('main.term')).visibility,splash:!!document.getElementById('splash2'),fading:document.getElementById('splash2')?.classList.contains('fade')}));
    assert.equal(waiting.state,'pending');assert.equal(waiting.hidden,'hidden');assert.equal(waiting.splash,true);assert.equal(waiting.fading,false);
    await navigation;await ready();await assertBoot();
    console.log(`MENU STARTUP ${path}: PASS // delayed resource; splash held; zero legacy menu frames`);
  }
  assert.deepEqual(errors,[]);
  console.log('MENU HOME BROWSER: PASS // six full-screen viewport fits, no header, no old-menu flash with slow script/artwork, all nine section returns in both orientations without rebuilding or old-menu frames');
}catch(error){
  if(page){fs.mkdirSync('.qa',{recursive:true});await page.screenshot({path:'.qa/menu-failure.png'});console.error(await page.evaluate(()=>{
    const inspect=element=>{
      if(!element)return null;
      const style=getComputedStyle(element),box=element.getBoundingClientRect();
      return {tag:element.tagName,id:element.id,classes:element.className,inline:element.getAttribute('style'),display:style.display,visibility:style.visibility,box:{x:box.x,y:box.y,width:box.width,height:box.height}};
    };
    const button=document.getElementById('runnerPreferencesF6'),ancestors=[];
    for(let element=button;element;element=element.parentElement)ancestors.push(inspect(element));
    return {classes:document.body.className,width:innerWidth,height:innerHeight,scroll:scrollY,preferences:ancestors,children:[...document.querySelector('main.term').children].map(inspect)};
  }));}
  throw error;
}finally{await browser.close();}
