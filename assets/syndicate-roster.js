(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VigwireSyndicateRoster=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const COUNT=8,KEY='bettingEdge.syndicateSlots.v4',ORDER_KEY='bettingEdge.syndicateSlots.defaultOrderRevision';
  const FALLBACK=['eddie-numbers','graham-mercer','vic-fremont','guy-laflame','lou-vega',null,null,null];
  function normalize(source){return Array.from({length:COUNT},(_,i)=>source[i]==null?null:String(source[i]));}
  function defaults(manifest){return normalize(Array.isArray(manifest?.defaults)&&[4,COUNT].includes(manifest.defaults.length)?manifest.defaults:FALLBACK);}
  function revision(manifest){return String(manifest?.defaultOrderRevision||3);}
  function validSource(source){return Array.isArray(source)&&[4,COUNT].includes(source.length);}
  function migrate(source,wanted){
    const next=normalize(source),count=wanted.reduce((n,id,i)=>id==null?n:i+1,0),displaced=next.slice(4,count).filter(Boolean);
    wanted.slice(0,count).forEach((id,i)=>next[i]=id);
    const used=new Set(next.slice(0,count).filter(Boolean));
    for(let i=count;i<COUNT;i++){if(next[i]&&used.has(next[i]))next[i]=null;else if(next[i])used.add(next[i]);}
    for(const id of displaced){const free=next.findIndex((value,i)=>i>=count&&!value);if(!used.has(id)&&free>=0){next[free]=id;used.add(id);}}
    return next;
  }
  function validate(source,manifest){
    if(!Array.isArray(manifest?.profiles)||!manifest.profiles.length)throw new Error('Syndicate character library unavailable');
    const ids=new Set(manifest.profiles.filter(p=>p?.id&&p.enabled!==false&&p.url).map(p=>String(p.id)));
    const wanted=defaults(manifest),used=new Set();
    if(wanted.filter(Boolean).some(id=>!ids.has(id)))throw new Error('Syndicate character library incomplete');
    return normalize(source).map((id,i)=>{
      if(id!==null&&!ids.has(id))id=ids.has(wanted[i])?wanted[i]:null;
      if(id&&used.has(id))id=null;
      if(id)used.add(id);
      return id;
    });
  }
  function resolve(manifest,{stored,storedRevision,session,sessionRevision}={}){
    const wanted=defaults(manifest),current=revision(manifest);
    // Persistent choices take precedence over an older open-tab copy.
    const source=validSource(stored)?stored:validSource(session)?session:wanted;
    const savedRevision=validSource(stored)?storedRevision:validSource(session)?sessionRevision:current;
    return validate(String(savedRevision)===current?source:migrate(source,wanted),manifest);
  }
  function write(source,manifest,context){
    const assignments=validate(source,manifest),current=revision(manifest);
    try{const top=context.top||context;top.__vigwireSyndicateAssignments=assignments.slice();top.__vigwireSyndicateOrderRevision=current;}catch{}
    try{context.localStorage.setItem(KEY,JSON.stringify(assignments));context.localStorage.setItem(ORDER_KEY,current);}catch{}
    return assignments;
  }
  function read(manifest,context){
    const state={};
    try{state.stored=JSON.parse(context.localStorage.getItem(KEY)||'null');state.storedRevision=context.localStorage.getItem(ORDER_KEY);}catch{}
    try{const top=context.top||context;state.session=top.__vigwireSyndicateAssignments;state.sessionRevision=top.__vigwireSyndicateOrderRevision;}catch{}
    return write(resolve(manifest,state),manifest,context);
  }
  return {normalize,defaults,revision,migrate,validate,resolve,read,write};
});
