import fs from 'node:fs';

const p='syndicates/sharp-room/incoming.html';
let s=fs.readFileSync(p,'utf8');

const helper="const money=x=>CAD.format(+x||0),sm=x=>(+x>0?'+':'')+money(x),pct=x=>(isFinite(x)?+x:0).toFixed(1)+'%',tone=(e,x)=>{e.classList.remove('up','dn','gold');e.classList.add(x>0?'up':x<0?'dn':'gold')},set=(id,v)=>$(id).textContent=v;";
const helperFixed="const money=x=>CAD.format(+x||0),sm=x=>(+x>0?'+':'')+money(x),pct=x=>(isFinite(x)?+x:0).toFixed(1)+'%',tone=(e,x)=>{e.classList.remove('up','dn','gold');e.classList.add(x>0?'up':x<0?'dn':'gold')},set=(id,v)=>$(id).textContent=v,html=(id,v)=>$(id).innerHTML=v;";
if(!s.includes(helper)) throw new Error('Eddie helper line not found');
s=s.replace(helper,helperFixed);

const call="set('tickets',last.map((x,i)=>`<div class=\"ticket ${x.result==='Won'?'win':x.result==='Lost'?'loss':''}\"><small>#${i+1} · ${x.book}</small><b>${x.result==='Won'?'W':x.result==='Lost'?'L':x.result==='CashedOut'?'CO':x.result==='Push'?'P':'X'}</b><b class=\"${x.p>0?'up':x.p<0?'dn':'gold'}\">${sm(x.p)}</b><small>${money(x.risk)} risk</small></div>`).join(''));";
const callFixed="html('tickets',last.map((x,i)=>`<div class=\"ticket ${x.result==='Won'?'win':x.result==='Lost'?'loss':''}\"><small>#${i+1} · ${x.book}</small><b>${x.result==='Won'?'W':x.result==='Lost'?'L':x.result==='CashedOut'?'CO':x.result==='Push'?'P':'X'}</b><b class=\"${x.p>0?'up':x.p<0?'dn':'gold'}\">${sm(x.p)}</b><small>${money(x.risk)} risk</small></div>`).join(''));";
if(!s.includes(call)) throw new Error('Eddie ticket render call not found');
s=s.replace(call,callFixed);
fs.writeFileSync(p,s);

const testPath='tests/muddy-ledger-desk.test.mjs';
let t=fs.readFileSync(testPath,'utf8');
const anchor="assert(live.includes(\"cache:'no-store'\"),'Ledger fetch must bypass browser cache');";
const guard="assert(live.includes(\"html('tickets',last.map\"),'Recent ticket tape must render ticket cards as HTML');";
if(!t.includes(anchor)) throw new Error('Eddie test anchor not found');
if(!t.includes(guard)) t=t.replace(anchor,anchor+'\n'+guard);
fs.writeFileSync(testPath,t);

console.log('Eddie Recent Tape HTML rendering fixed.');
