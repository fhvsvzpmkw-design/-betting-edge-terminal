import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
let page;
try{
  // The local test server contains the terminal repo; the real badge is served
  // by the separate corporate site in production. Reuse that exact PNG here.
  const brand=await fetch('https://fhvsvzpmkw-design.github.io/vigwire-labs-main/assets/product-badges/vigscope-small.png');
  assert.ok(brand.ok,'the authentic corporate badge must be available');
  const badge=Buffer.from(await brand.arrayBuffer());
  page=await browser.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.setRequestInterception(true);
  page.on('request',request=>{
    if(new URL(request.url()).pathname==='/site-assets/product-badges/vigscope-small.png')request.respond({status:200,contentType:'image/png',body:badge});
    else request.continue();
  });
  const ready=()=>page.waitForFunction(()=>document.body.classList.contains('vigMenuStyled')&&document.querySelectorAll('.vigMenuTile').length===9&&(!document.getElementById('splash2')||getComputedStyle(document.getElementById('splash2')).display==='none'||getComputedStyle(document.getElementById('splash2')).visibility==='hidden'),{timeout:60000});
  await page.setViewport({width:834,height:1000,deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:8765/runner.html',{waitUntil:'domcontentloaded',timeout:60000});await ready();
  await page.waitForFunction(()=>[...document.querySelectorAll('#vigMenuBrand img,.vigMenuArt img')].every(image=>image.complete&&image.naturalWidth>0),{timeout:30000});
  fs.mkdirSync('.qa',{recursive:true});
  const viewports=[[834,1000],[1194,650],[390,650],[844,290],[568,220]];
  for(const [width,height] of viewports){
    await page.setViewport({width,height,deviceScaleFactor:1});
    await page.waitForFunction((landscape)=>document.body.classList.contains('vigMenuLandscape')===landscape,{},width>height);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const layout=await page.evaluate(()=>{
      const rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
      return {width:innerWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,
        buttons:[...document.querySelectorAll('.tabs>.btn[data-menu-id]')].map(button=>{
          const id=button.dataset.menuId,face=document.querySelector(`.vigMenuTile[data-vig-menu-id="${id}"]`),name=face.querySelector('.vigMenuName'),art=face.querySelector('.vigMenuArt'),box=rect(button);
          return {id,box,face:rect(face),name:rect(name),art:rect(art),textWidth:name.scrollWidth,textBoxWidth:name.clientWidth,display:getComputedStyle(button).display,
            hit:document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)?.closest('.btn')===button};
        })};
    });
    assert.equal(layout.buttons.length,9);
    assert.ok(layout.scrollHeight<=height+1&&layout.scrollWidth<=width+1,`${width}x${height}: menu must fit without scrolling`);
    for(const button of layout.buttons){
      const {box,face}=button;
      assert.notEqual(button.display,'none');assert.ok(button.hit,`${button.id}: artwork must leave the original button clickable`);
      assert.ok(box.width>=44&&box.height>=44,`${button.id}: touch target is too small`);
      assert.ok(box.x>=0&&box.y>=0&&box.right<=width+1&&box.bottom<=height+1,`${button.id}: button must be fully on screen`);
      for(const key of ['x','y','width','height'])assert.ok(Math.abs(box[key]-face[key])<1,`${width}x${height}: ${button.id} frame/artwork drift (${key})`);
      for(const content of [button.art,button.name])assert.ok(content.x>=box.x-1&&content.y>=box.y-1&&content.right<=box.right+1&&content.bottom<=box.bottom+1,`${width}x${height}: ${button.id} graphic and title must fit inside its button`);
      assert.ok(button.textWidth<=button.textBoxWidth+1,`${width}x${height}: ${button.id} title must not overflow its text box`);
    }
    await page.screenshot({path:`.qa/menu-${width}x${height}.png`});
    console.log(`MENU BROWSER ${width}x${height}: PASS // 9 aligned, clickable targets; labels/graphics fit; no scrolling`);
  }
  await page.click('.tabs>.btn[data-menu-id="board"]');
  await page.waitForFunction(()=>document.body.classList.contains('runnerPrimaryViewLoaded')&&!document.body.classList.contains('vigMenuStyled')&&!document.querySelector('.vigMenuOverlay'));
  assert.match(await page.$eval('.tabs>.btn[data-menu-id="board"]',button=>button.innerHTML),/PRESS \[F1\] TO RETURN TO MENU/);
  await page.click('.tabs>.btn[data-menu-id="board"]');await ready();
  await page.click('#runnerPreferencesF6');
  await page.waitForFunction(()=>document.body.classList.contains('runnerPreferencesLoaded')&&!document.body.classList.contains('vigMenuStyled')&&!document.querySelector('.vigMenuOverlay'));
  await page.click('#runnerPreferencesF6');await ready();
  assert.deepEqual(errors,[]);
  console.log('MENU HOME BROWSER: PASS // actual layout at five viewport sizes, authentic badge and eight assets, existing Board/Preferences entry and menu return');
}catch(error){
  if(page){fs.mkdirSync('.qa',{recursive:true});await page.screenshot({path:'.qa/menu-failure.png'});console.error(await page.evaluate(()=>({classes:document.body.className,width:innerWidth,height:innerHeight})));}
  throw error;
}finally{await browser.close();}
