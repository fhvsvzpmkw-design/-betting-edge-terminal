(function(root){
  'use strict';
  // Provider spread handicaps are home-oriented. Derive customer text from the
  // exact selection, never from the odds sign or a freely written card title.
  const clean=value=>String(value??'').replace(/−/g,'-').replace(/\s+/g,' ').trim();
  const number=value=>value===null||value===undefined||value===''?null:Number.isFinite(Number(value))?Number(value):null;
  const same=(a,b)=>Math.abs(a-b)<0.000001;
  const signed=value=>`${value>=0?'+':''}${Object.is(value,-0)?0:value}`;
  const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const placeholder=value=>/^(?:away|home|visitors?|hosts?)$/i.test(clean(value));
  function withEventMetadata(rec,event){
    // Repair display metadata only from the same dated event. Never infer teams
    // from an unbound headline, prose finding or a different day's matchup.
    if(!event||String(event.eventId)!==String(rec?.feed?.eventId)||!clean(event.home)||!clean(event.away)||placeholder(event.home)||placeholder(event.away))return rec;
    const start=Date.parse(event.startTime),recorded=Date.parse(rec?.feed?.eventDate);
    if(!Number.isFinite(start)||start!==recorded)return rec;
    const parts=String(rec?.meta||'').split('|').map(clean),index=parts.findIndex(v=>v.includes(' @ '));
    if(index<0)return rec;
    const teams=parts[index].split(' @ ');
    if(teams.length!==2||!teams.some(placeholder))return rec;
    if(teams.some((team,i)=>!placeholder(team)&&clean(team)!==clean(i===0?event.away:event.home)))return rec;
    parts[index]=`${clean(event.away)} @ ${clean(event.home)}`;
    return {...rec,meta:parts.join(' | ')};
  }
  function describe(rec,{event}={}){
    rec=withEventMetadata(rec,event);
    const feed=rec?.feed||{},key=clean(feed.marketKey).toLowerCase();
    const detail=clean(rec?.coreAssessment?.context?.marketDetail||feed.market).toLowerCase();
    const applicable=['ml','spread','totals'].includes(key)&&(!detail||!/(prop|player|first_|quarter|half|period)/.test(detail));
    if(!applicable)return {applicable:false,title:clean(rec?.title)};
    const bad=problem=>({applicable:true,problem,title:'SELECTION NOT VERIFIED'});
    const side=clean(feed.side).toLowerCase(),parts=String(feed.selectionKey||'').split('|');
    if(parts.length!==5||parts[0]!==String(feed.eventId)||parts[1]!==key||parts[2]!==side)
      return bad('selectionKey disagrees with event, market or side');
    if(!(key==='totals'?['over','under']:['home','away']).includes(side))return bad('unsupported selection side');
    const keyed=number(parts[4]),supplied=['hdp','line','total','points'].filter(k=>feed[k]!==null&&feed[k]!==undefined&&feed[k]!=='').map(k=>number(feed[k]));
    if(key==='ml'?(keyed!==null||supplied.length>0):(keyed===null||supplied.some(v=>v===null||!same(v,keyed))))
      return bad('selectionKey disagrees with the recorded handicap or total');
    const matchup=String(rec?.meta||'').split('|').map(clean).find(v=>v.includes(' @ '));
    const teams=matchup?.split(' @ ');
    let base=teams?.length===2?(key==='totals'?matchup:teams[side==='away'?0:1]):clean(feed.label);
    // Without matchup metadata, a feed label can still identify the participant.
    base=base.replace(/\s+(?:[+-]\d+(?:\.\d+)?|(?:over|under)\s+\d+(?:\.\d+)?|ML|moneyline)(?:\s*[—–-]\s*(?:run line|puck line|spread|total))?$/i,'');
    if(!base||parts[3])return bad('primary selection participant is missing or inconsistent');
    const sport=clean(rec?.coreAssessment?.context?.sport||String(rec?.meta||'').split('|')[0]).toUpperCase();
    let suffix,market;
    if(key==='ml'){suffix='Moneyline';market='Moneyline';}
    else if(key==='totals'){suffix=`${side==='over'?'Over':'Under'} ${keyed}`;market='Total';}
    else {suffix=signed(side==='away'?-keyed:keyed);market=/run_line/.test(detail)||sport==='MLB'?'Run line':/puck_line/.test(detail)||sport==='NHL'?'Puck line':'Spread';}
    const short=`${base} ${suffix}`,title=key==='ml'?short:`${short} — ${market}`;
    return {applicable:true,title,base,short,suffix,market,key,side,line:key==='spread'?(side==='away'?-keyed:keyed):keyed};
  }
  function repairText(rec,value){
    if(typeof value!=='string')return value;
    const info=describe(rec);if(!info.applicable||info.problem||!['spread','totals'].includes(info.key))return value;
    // Producer copy sometimes used the provider's home-oriented handicap. Only
    // repair this participant's exact-size line immediately before its price;
    // leave previous lines, opposing selections and quoted source facts alone.
    const prefix=info.key==='spread'?`${escape(info.base)}\\s+(?:Spread|Puck\\s+Line|Run\\s+Line)`:`${info.side==='over'?'Over':'Under'}\\s+Total`;
    const pattern=new RegExp(`(?<![\\w])${prefix}\\s+([+−-]?\\d+(?:\\.\\d+)?)(?=\\s+at\\s+[+−-]?\\d)`,'gi');
    return value.replace(pattern,(match,line)=>same(Math.abs(Number(line.replace('−','-'))),Math.abs(info.line))?info.title:match);
  }
  function titleProblem(rec,{allowMissing=false}={}){
    const info=describe(rec);if(!info.applicable)return null;if(info.problem)return info.problem;
    const actual=clean(rec.title),equal=value=>actual.toLowerCase()===clean(value).toLowerCase();
    if(equal(info.title)||equal(info.short)||(info.key==='ml'&&equal(`${info.base} ML`)))return null;
    if(allowMissing&&equal(info.base))return null;
    return `visible title must identify ${info.title}; received ${actual||'an empty title'}`;
  }
  const api={describe,titleProblem,withEventMetadata,repairText,title:rec=>describe(rec).title};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BettingEdgeSelectionLabel=api;
})(typeof globalThis!=='undefined'?globalThis:this);

