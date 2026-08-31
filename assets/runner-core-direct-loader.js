(()=>{
  'use strict';
  const READY_EVENT='vigscope-core-ready';
  function showError(message){
    let err=document.getElementById('err');
    if(!err){err=document.createElement('div');err.id='err';document.body.appendChild(err)}
    err.textContent='VigScope core loader error: '+message;
    err.style.display='block';
  }
  async function boot(){
    const shim=document.getElementById('app');
    if(!shim)throw new Error('direct app compatibility shim missing');
    const response=await fetch(`./runner-core.html?runtime=${Date.now()}`,{cache:'no-store'});
    if(!response.ok)throw new Error(`runner-core ${response.status}`);
    const html=await response.text();
    const blocks=[...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
    const match=blocks.find(item=>item[1].includes("const HISTORY_KEY='bettingEdge.runnerHistory.v1.3'"));
    if(!match)throw new Error('runner-core runtime script not found');
    const runtime=document.createElement('script');
    runtime.id='runnerCoreDirectRuntime';
    runtime.textContent=match[1]+'\n//# sourceURL=runner-core-direct-runtime.js';
    document.head.appendChild(runtime);
    shim.dispatchEvent(new Event('load'));
    document.dispatchEvent(new CustomEvent(READY_EVENT,{detail:{mode:'direct'}}));
  }
  boot().catch(error=>{
    console.error(error);
    showError(error&&error.message?error.message:String(error));
    document.dispatchEvent(new CustomEvent(READY_EVENT,{detail:{mode:'direct',error:String(error)}}));
  });
})();
