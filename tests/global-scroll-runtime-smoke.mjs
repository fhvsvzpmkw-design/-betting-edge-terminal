import puppeteer from 'puppeteer-core';
const executablePath=process.env.CHROME;
const payload=process.env.PAYLOAD;
if(!executablePath||!payload)throw new Error('CHROME and PAYLOAD are required');
const browser=await puppeteer.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage();
await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.evaluateOnNewDocument(()=>{
  const audit=window.__vigRuntimeAudit={intervals:[],observers:[]};
  const nativeSetInterval=window.setInterval.bind(window),nativeClearInterval=window.clearInterval.bind(window);
  window.setInterval=(fn,ms,...args)=>{const rec={id:null,ms:Number(ms)||0,active:true};const id=nativeSetInterval(fn,ms,...args);rec.id=id;audit.intervals.push(rec);return id};
  window.clearInterval=id=>{for(const rec of audit.intervals)if(rec.id===id)rec.active=false;return nativeClearInterval(id)};
  const NativeMO=window.MutationObserver;
  window.MutationObserver=class{
    constructor(cb){this.rec={active:false,targets:[]};audit.observers.push(this.rec);this.inner=new NativeMO(cb)}
    observe(target,opts){this.rec.active=true;this.rec.targets.push({body:target===document.body,id:target?.id||'',tag:target?.tagName||'',subtree:Boolean(opts?.subtree)});return this.inner.observe(target,opts)}
    disconnect(){this.rec.active=false;return this.inner.disconnect()}
    takeRecords(){return this.inner.takeRecords()}
  };
});
await page.goto(`http://127.0.0.1:8765/runner.html#run=${payload}`,{waitUntil:'domcontentloaded',timeout:45000});
await new Promise(r=>setTimeout(r,5000));
await page.click('.btn[data-view="board"]');
await new Promise(r=>setTimeout(r,900));
const board=await page.evaluate(()=>({cards:document.querySelectorAll('#runnerLive .runnerCard').length,height:document.scrollingElement?.scrollHeight||0,view:document.body.dataset.primaryView||''}));
await page.evaluate(()=>window.scrollTo(0,Math.max(0,(document.scrollingElement?.scrollHeight||0)*0.65)));
await new Promise(r=>setTimeout(r,700));
const scrolled=await page.evaluate(()=>window.scrollY);
await page.evaluate(()=>window.scrollTo(0,0));
await page.click('.btn[data-view="board"]');
await new Promise(r=>setTimeout(r,250));
await page.click('.btn[data-view="engine"]');
await new Promise(r=>setTimeout(r,1200));
const valueReady=await page.evaluate(()=>Boolean(document.querySelector('#engine.resultsDesk')));
await new Promise(r=>setTimeout(r,3500));
const audit=await page.evaluate(()=>({
  fast:window.__vigRuntimeAudit.intervals.filter(x=>x.active&&x.ms<5000).map(x=>x.ms),
  body:window.__vigRuntimeAudit.observers.filter(x=>x.active&&x.targets.some(t=>t.body&&t.subtree)).map(x=>x.targets),
  activeIntervals:window.__vigRuntimeAudit.intervals.filter(x=>x.active).map(x=>x.ms),
  observerTargets:window.__vigRuntimeAudit.observers.filter(x=>x.active).flatMap(x=>x.targets).map(t=>`${t.tag}#${t.id}:${t.subtree?'subtree':'direct'}`)
}));
console.log(JSON.stringify({board,scrolled,valueReady,audit,errors},null,2));
if(board.cards<4)throw new Error(`expected recommendation cards, got ${board.cards}`);
if(board.view!=='board')throw new Error(`board shell did not open: ${board.view}`);
if(board.height<=844||scrolled<50)throw new Error(`native scrolling did not move: height=${board.height} y=${scrolled}`);
if(!valueReady)throw new Error('VigScope Value did not render');
if(audit.fast.length)throw new Error(`fast permanent intervals remain: ${audit.fast.join(',')}`);
if(audit.body.length)throw new Error(`whole-body subtree observers remain: ${JSON.stringify(audit.body)}`);
if(errors.length)throw new Error(`page errors: ${errors.join(' | ')}`);
await browser.close();
