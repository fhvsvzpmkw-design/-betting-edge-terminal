(function(root){
  'use strict';
  const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
  const time=x=>Number.isFinite(Date.parse(x||''))?Date.parse(x):0;
  function units(c){return c?.completionState==='complete'&&c?.analysisPrice?.state==='exact'&&finite(c.analysisPrice.decimal)&&Number(c.analysisPrice.decimal)>1&&finite(c.units)?Number(c.units):null;}
  function finalRows(cards){
    const map=new Map();
    for(const c of cards||[]){const key=c.selectionKey||`card:${c.cardId}`,p=map.get(key);if(!p||time(c.runId)>time(p.runId)||time(c.runId)===time(p.runId)&&String(c.cardId)>=String(p.cardId))map.set(key,c);}
    return [...map.values()];
  }
  function filterRows(rows,f={}){return (rows||[]).filter(c=>(!f.start||String(c.date||'')>=f.start)&&(!f.end||String(c.date||'')<=f.end)&&(!f.sport||f.sport==='ALL'||c.sport===f.sport)&&(!f.status||f.status==='ALL'||c.status===f.status)&&(!f.lane||f.lane==='ALL'||c.slot===f.lane));}
  function summary(rows){
    const grades={WIN:0,LOSS:0,PUSH:0,VOID:0,HALF_WIN:0,HALF_LOSS:0};let complete=0,priced=0,netUnits=0;
    for(const c of rows||[]){if(c.completionState==='complete'){complete++;if(Object.hasOwn(grades,c.grade))grades[c.grade]++;}const u=units(c);if(u!==null){priced++;netUnits+=u;}}
    const decisive=grades.WIN+grades.LOSS+grades.HALF_WIN+grades.HALF_LOSS;
    return {issued:(rows||[]).length,complete,unresolved:(rows||[]).length-complete,grades,priced,netUnits,roiPct:priced?netUnits/priced*100:null,winPct:decisive?(grades.WIN+grades.HALF_WIN*.5)/decisive*100:null};
  }
  function aggregate(rows,key){const groups=new Map();for(const c of rows||[]){const name=typeof key==='function'?key(c):c[key]||'Other';if(!groups.has(name))groups.set(name,[]);groups.get(name).push(c);}return [...groups].map(([name,items])=>({name,...summary(items)}));}
  function curve(rows){let total=0,peak=0,drawdown=0;const points=[{value:0,date:null}];for(const c of [...(rows||[])].sort((a,b)=>time(a.runId)-time(b.runId)||String(a.cardId).localeCompare(String(b.cardId)))){const u=units(c);if(u===null)continue;total+=u;peak=Math.max(peak,total);drawdown=Math.max(drawdown,peak-total);points.push({value:total,date:c.date});}return {points,drawdown};}
  function marketName(v){return ({'ml-ht':'First-half moneyline','ml-q1':'First-quarter moneyline','ml-p1':'First-period moneyline','ml-3way':'Three-way moneyline',ml:'Moneyline',moneyline:'Moneyline',spread:'Spread',totals:'Totals'})[String(v||'').toLowerCase()]||v||'Other';}
  function chronological(rows){return [...(rows||[])].sort((a,b)=>time(a.startTime)-time(b.startTime)||String(a.gameKey).localeCompare(String(b.gameKey)));}
  function strategyRows(rows,strategy='graham'){
    return chronological(rows).map(g=>{const side=strategy==='favorites'?g.favoriteSide:strategy==='dogs'?(g.favoriteSide==='home'?'away':'home'):g.valueSide;
      const cover=g.homeScore!==null&&g.awayScore!==null&&g.resultState==='FINAL'?(g.homeScore-g.awayScore+g.pinnacleHomeLine)*(side==='home'?1:-1):null;
      const grade=cover===null?null:Math.abs(cover)<1e-8?'PUSH':cover>0?'WIN':'LOSS';
      return {...g,selectedSide:side,selectedTeam:g[side],selectedLine:side==='home'?g.pinnacleHomeLine:-g.pinnacleHomeLine,grade,
        cardId:g.gameKey,runId:g.startTime,date:g.startTime.slice(0,10),completionState:grade?'complete':'unresolved',analysisPrice:{state:'exact',decimal:21/11,american:-110},units:grade==='WIN'?10/11:grade==='LOSS'?-1:grade==='PUSH'?0:null};
    });
  }
  function predictionAccuracy(rows,key){const settled=rows.filter(r=>r.resultState==='FINAL'&&finite(r.homeScore)&&finite(r.awayScore)&&finite(r[key]));if(!settled.length)return {games:0,mae:null,rmse:null};const errors=settled.map(r=>r.homeScore-r.awayScore+Number(r[key]));return {games:settled.length,mae:errors.reduce((n,x)=>n+Math.abs(x),0)/errors.length,rmse:Math.sqrt(errors.reduce((n,x)=>n+x*x,0)/errors.length)};}
  const api=Object.freeze({finite,time,units,finalRows,filterRows,summary,aggregate,curve,marketName,strategyRows,predictionAccuracy});
  root.VigScopeValueAnalytics=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
