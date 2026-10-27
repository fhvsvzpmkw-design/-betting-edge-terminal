import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Run the real collector against a fake transport. This consumes no provider
// requests and never changes production observations or report decisions.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'oddspapi-quota-'));
try{
  fs.mkdirSync(path.join(temp,'data'));
  // Same seven-tournament/two-request shape as the blocked October 26 Open.
  fs.writeFileSync(path.join(temp,'data/live-odds.json'),JSON.stringify({events:
    [['NBA','basketball'],['NFL','american-football'],['CFL','american-football'],['MLB','baseball'],['WNBA','basketball'],['NHL','ice-hockey']].map(([name,sport],i)=>({id:String(i),league:{name},sport:{slug:sport}}))}));
  const hook=path.join(temp,'transport.mjs');
  fs.writeFileSync(hook,`
    import fs from 'node:fs';
    let calls=[];
    const nativeTimeout=setTimeout;globalThis.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,0,...args);
    globalThis.fetch=async input=>{
      const u=new URL(input),endpoint=u.pathname.split('/').at(-1);
      calls.push({endpoint,ids:u.searchParams.get('tournamentIds')});
      fs.writeFileSync('calls.json',JSON.stringify(calls));
      if(endpoint==='account'){
        if(process.env.CASE==='account-error')return {ok:false,status:503,text:async()=>'unavailable'};
        return {ok:true,text:async()=>JSON.stringify({current_subscription_id:'active',subscriptions:[{
          subscription_id:'active',request_limit:250,request_count:Number(process.env.COUNT)
        }]})};
      }
      if(endpoint==='markets')return {ok:true,text:async()=>JSON.stringify([{
        marketId:151,sportId:15,playerProp:false,period:'result',marketLength:2,
        marketName:'Winner (incl. overtime and penalties)'
      }])};
      if(endpoint==='odds-by-tournaments')return {ok:true,text:async()=>'[]'};
      throw Error('Unexpected endpoint '+endpoint);
    };
  `);
  for(const [name,count,status,requests]of [
    ['morning-224-of-250',224,'ok',2],
    ['exact-reserve-boundary',243,'ok',2],
    ['would-cross-reserve',244,'quota-reserve-protected',0],
    ['provider-quota-exhausted',250,'quota-reserve-protected',0],
    ['provider-over-limit',251,'quota-reserve-protected',0],
    ['account-error',224,'account-error',0]
  ]){
    fs.rmSync(path.join(temp,'data/oddspapi-observer.json'),{force:true});
    execFileSync(process.execPath,['--import',hook,path.join(root,'tools/oddspapi-observer.mjs')],{
      cwd:temp,env:{...process.env,ODDSPAPI_API_KEY:'FAKE_TEST_KEY',CASE:name,COUNT:String(count)},stdio:'pipe'
    });
    const result=JSON.parse(fs.readFileSync(path.join(temp,'data/oddspapi-observer.json')));
    const calls=JSON.parse(fs.readFileSync(path.join(temp,'calls.json')));
    assert.equal(result.status,status,name);
    assert.equal(result.diagnostics.plannedOddsRequests,2,name);
    assert.equal(result.diagnostics.billableRequestsThisRun,requests,name);
    assert.equal(calls.filter(x=>x.endpoint==='odds-by-tournaments').length,requests,name);
    assert.equal(result.diagnostics.oddsRequests,requests,name);
    if(status!=='account-error'){
      assert.equal(result.quota.protectedReserve,5,name);
      assert.equal(result.quota.remainingBefore,Math.max(0,250-count),name);
    }
    if(status==='ok')assert.ok(result.quota.estimatedRemainingAfter>=5,name);
    else assert.equal(calls.filter(x=>x.endpoint==='markets').length,0,'blocked acquisition must not request a catalogue');
    for(const call of calls.filter(x=>x.ids))assert.ok(call.ids.split(',').length<=5,name);
  }
  console.log('OddsPapi quota: actual 224/250 case, exact five-request reserve, insufficient/exhausted quota and account failures PASS; no live requests.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
