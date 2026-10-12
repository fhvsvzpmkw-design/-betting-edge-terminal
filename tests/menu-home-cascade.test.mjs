import assert from 'node:assert/strict';
import fs from 'node:fs';

// Regress the real legacy ID rules that displaced the button frames on iPad.
// This checks selector matching, specificity and grid shorthand precedence;
// it is not a replacement for browser rendering.
const menu=fs.readFileSync('assets/menu-home-style.css','utf8');
const originals=['runner.html','assets/menu-order-controller.js','assets/primary-nav-shell.js','assets/special-desks-ui.js','assets/preferences-framework.js','assets/report-dashboard-vigscope.js'].map(path=>fs.readFileSync(path,'utf8'));
const ids={board:'',market:'',history:'',syndicate:'runnerSyndicateF5',pizza:'runnerPizzaF6',crypto:'runnerCryptoF7',meat:'runnerSeasonPreviewF6',engine:'',preferences:'runnerPreferencesF6'};

function split(value,separator=','){
  const out=[];let start=0,depth=0,quote='';
  for(let i=0;i<value.length;i++){
    const c=value[i];if(quote){if(c===quote&&value[i-1]!=='\\')quote='';continue}
    if(c==='"'||c==="'"){quote=c;continue}
    if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;
    else if(!depth&&c===separator){out.push(value.slice(start,i).trim());start=i+1}
  }
  out.push(value.slice(start).trim());return out.filter(Boolean);
}
function replaceFunctions(selector,callback){
  let out='',cursor=0;
  const pattern=/:(is|not|where)\(/g;let match;
  while((match=pattern.exec(selector))){
    let depth=1,end=pattern.lastIndex;
    while(end<selector.length&&depth){if(selector[end]==='(')depth++;else if(selector[end]===')')depth--;end++}
    out+=selector.slice(cursor,match.index)+callback(match[1],selector.slice(pattern.lastIndex,end-1));
    cursor=end;pattern.lastIndex=end;
  }
  return out+selector.slice(cursor);
}
const compare=(a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2];
function specificity(selector){
  const score=[0,0,0];
  let plain=replaceFunctions(selector,(name,args)=>{
    if(name!=='where'){const max=split(args).map(specificity).sort(compare).at(-1);max.forEach((n,i)=>score[i]+=n)}
    return '';
  });
  plain=plain.replace(/\[[^\]]+\]/g,()=>{score[1]++;return ''});
  plain=plain.replace(/#[\w-]+/g,()=>{score[0]++;return ''});
  plain=plain.replace(/\.[\w-]+|:(?!:)[\w-]+/g,()=>{score[1]++;return ''});
  score[2]+=(plain.match(/(?:^|[\s>+~])\s*[a-z][\w-]*/gi)||[]).length;
  return score;
}
assert.deepEqual(specificity('.btn:is([data-view],#runnerSyndicateF5)'),[1,1,0]);
assert.deepEqual(specificity('body.runnerMenuHome #runnerSyndicateF5:hover'),[1,2,1]);
function node(tag,classes,attrs={},parent=null){return {tag,classes:new Set(classes.split(/\s+/)),attrs,parent}}
const body=node('body','vigMenuStyled runnerMenuHome');
const term=node('main','term',{},body),pad=node('section','runnerNavPad',{},term),tabs=node('div','tabs',{},pad);
const layer=node('div','vigMenuOverlay',{},tabs);
function compoundMatches(selector,element,states){
  let okay=true;
  selector=replaceFunctions(selector,(name,args)=>{
    const found=split(args).some(part=>compoundMatches(part,element,states));
    if(name==='not'?found:!found)okay=false;return '';
  });
  if(/::|:(before|after)\b/.test(selector))return false;
  selector=selector.replace(/\[([\w-]+)(?:=["']?([^"'\]]+)["']?)?\]/g,(_,key,value)=>{
    if(!(key in element.attrs)||(value!==undefined&&element.attrs[key]!==value))okay=false;return '';
  });
  selector=selector.replace(/#([\w-]+)/g,(_,id)=>{if(element.attrs.id!==id)okay=false;return ''});
  selector=selector.replace(/\.([\w-]+)/g,(_,name)=>{if(!element.classes.has(name))okay=false;return ''});
  selector=selector.replace(/:([\w-]+)/g,(_,name)=>{if(!states.has(name))okay=false;return ''});
  const tag=selector.trim();return okay&&(!tag||tag==='*'||tag===element.tag);
}
function matches(selector,element,states){
  // Hide internal whitespace/combinators until the ancestor chain is split.
  const saved=[];
  selector=replaceFunctions(selector,(name,args)=>{saved.push(`:${name}(${args})`);return `FUNCTION${saved.length-1}`});
  selector=selector.replace(/\s*>\s*/g,'>');
  const parts=selector.split(/(>|\s+)/).filter(Boolean);
  const restore=s=>s.replace(/FUNCTION(\d+)/g,(_,i)=>saved[+i]);
  let at=parts.length-1,current=element;
  if(!compoundMatches(restore(parts[at--]),current,states))return false;
  while(at>=0){
    const relation=parts[at--],wanted=restore(parts[at--]);current=current.parent;
    if(relation==='>'){if(!current||!compoundMatches(wanted,current,states))return false}
    else{while(current&&!compoundMatches(wanted,current,states))current=current.parent;if(!current)return false}
  }
  return true;
}
function rules(text){
  return [...text.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([,selectors,body])=>{
    const declarations=split(body,';').flatMap(declaration=>{
      const colon=declaration.indexOf(':');if(colon<0)return [];
      const property=declaration.slice(0,colon).trim(),raw=declaration.slice(colon+1).trim();
      const important=/!important\s*$/.test(raw),value=raw.replace(/!important\s*$/,'').trim();
      const properties=property==='grid-area'?['grid-row-start','grid-column-start','grid-row-end','grid-column-end']:property==='grid-column'?['grid-column-start','grid-column-end']:property==='grid-row'?['grid-row-start','grid-row-end']:[property];
      return properties.map((key,i)=>({key,value:properties.length>1?split(value,'/')[i]||value:value,important}));
    });
    return split(selectors).filter(selector=>!selector.startsWith('@')).map(selector=>({selector,declarations,score:specificity(selector)}));
  });
}
const legacy=originals.flatMap(text=>{
  const values=Object.fromEntries([...text.matchAll(/\bconst\s+(\w+)=['"]([^'"]+)['"]/g)].map(([,key,value])=>[key,value]));
  const sheets=[...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),...text.matchAll(/\.textContent\s*=\s*`([\s\S]*?)`/g)].map(match=>match[1].replace(/\$\{(\w+)\}/g,(_,key)=>values[key]||'UNRESOLVED'));
  return sheets.flatMap(rules);
});
assert.ok(legacy.some(rule=>rule.selector==='#runnerSyndicateF5'&&rule.declarations.some(d=>d.key==='grid-column-start')),'test must include the original Syndicate span rule');
assert.ok(legacy.some(rule=>rule.selector==='#runnerPizzaF6'&&rule.declarations.some(d=>d.key==='grid-column-start')),'test must include the original specialty span rule');
function cascade(all,element,states){
  const result=new Map();
  all.forEach((rule,index)=>{if(!matches(rule.selector,element,states))return;
    for(const declaration of rule.declarations){
      const old=result.get(declaration.key),priority=[+declaration.important,...rule.score,index];
      if(!old||priority.some((n,i)=>n!==old.priority[i]&&priority.slice(0,i).every((v,j)=>v===old.priority[j])&&n>old.priority[i]))result.set(declaration.key,{...declaration,priority});
    }
  });return result;
}
let checks=0;
for(const all of [[...rules(menu),...legacy],[...legacy,...rules(menu)]]){
  for(const id of Object.keys(ids)){
    const attrs={'data-menu-id':id,id:ids[id]};if(!ids[id])attrs['data-view']=id;
    const button=node('button','btn loaded',attrs,tabs),face=node('span','vigMenuFace vigMenuTile',{'data-vig-menu-id':id},layer);
    for(const states of [new Set(),new Set(['hover']),new Set(['active'])]){
      const target=cascade(all,button,states),art=cascade(all,face,states);
      for(const key of ['grid-row-start','grid-column-start','grid-row-end','grid-column-end']){
        assert.equal(target.get(key)?.value,id,`${id} ${key} must defeat the legacy full-width span`);
        assert.equal(art.get(key)?.value,id,`${id} artwork must occupy the same area as its hit target`);
      }
      assert.equal(target.get('display')?.value,'block');
      assert.equal(target.get('--menu-rgb')?.value,art.get('--menu-rgb')?.value);
      assert.match(target.get('background')?.value||'',/repeating-linear-gradient/,'legacy dark fills cannot replace the menu surfaces');
      checks++;
    }
  }
  for(const orientation of ['', 'vigMenuLandscape', 'vigMenuLandscape vigMenuRoomy']){
    body.classes=new Set(`vigMenuStyled runnerMenuHome ${orientation}`.split(/\s+/));
    const target=cascade(all,tabs,new Set()),art=cascade(all,layer,new Set());
    for(const key of ['grid-template-areas','grid-template-columns','grid-template-rows','gap']){
      assert.equal(target.get(key)?.value,art.get(key)?.value,`${orientation||'portrait'}: button and artwork grids must match`);
    }
    assert.equal(art.get('position')?.value,'absolute','the artwork must not introduce an extra grid row');
    assert.equal(art.get('height')?.value,'100%');
  }
  body.classes=new Set(['vigMenuStyled','runnerMenuHome']);
}
console.log(`Menu CSS cascade: PASS // ${checks} button/load-order/state combinations against the existing styles`);
