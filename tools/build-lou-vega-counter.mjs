#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CONFIG='data/characters/lou-vega/counter-v1.json';
const LIVE='syndicates/generated/lou-vega/hotline.html';
const ARCHIVE='syndicates/generated/lou-vega/archive';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const json=p=>JSON.parse(read(p));
const encode=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=v=>JSON.stringify(v,null,2)+'\n';
export function renderCounter(config,template,base='./') {
  assert(config.schema===1 && /^\d{4}-\d{2}-\d{2}-tenplay-counter-v\d+$/.test(config.id),'Invalid static counter identity');
  assert(config.product.url==='https://fhvsvzpmkw-design.github.io/Ten-play-web/','Use the verified TenPlay product URL');
  const values={BASE_HREF:base,EDITION_ID:config.id,PRODUCT_URL:config.product.url,WELCOME:config.welcome,SIGNATURE:config.signature};
  return template.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>{assert(key in values,`Unknown counter field ${key}`);return encode(values[key]);});
}
export function build({check=false}={}) {
  const c=json(CONFIG),profile=json('data/characters/lou-vega.json');
  assert(profile.authority.mode==='static-product-counter','Lou must be a static product counter');
  const template=read(c.templatePath),live=renderCounter(c,template),archived=renderCounter(c,template,'../../');
  const archivePath=`${ARCHIVE}/${c.issuedAt.slice(0,10)}/${c.id}.html`;
  const index=json(`${ARCHIVE}/index.json`);
  const entry={id:`${c.id}|lou-vega`,characterId:'lou-vega',profileId:'lou-vega',displayName:'LOU VEGA',publication:'VEGAS BY THE SLICE',date:c.issuedAt.slice(0,10),session:c.id,label:'PIZZA & TENPLAY COUNTER',issuedAt:c.issuedAt,sourceEdition:CONFIG,path:archivePath.slice(ARCHIVE.length+1),shellId:'vegas-by-the-slice',shellVersion:4,editionType:'static-product-counter'};
  const existing=index.issues.find(x=>x.id===entry.id);
  if(existing)assert.deepEqual(existing,entry,'Counter archive metadata is immutable');
  if(fs.existsSync(path.join(ROOT,archivePath)))assert.equal(read(archivePath),archived,'Create a new counter edition before changing an archived page');
  if(check){
    assert.equal(read(LIVE),live,'Static Lou counter needs rebuild');
    assert.equal(read(archivePath),archived,'Static Lou archive missing');
    assert(existing,'Counter archive index entry missing');
    assert.equal(profile.continuity.lastEditionSeen.id,c.id,'Lou continuity mismatch');
    console.log('LOU COUNTER: static page, TenPlay target and immutable archive verified');return;
  }
  if(!existing)index.issues.push(entry);
  index.updatedAt=c.issuedAt;
  profile.updatedAt=c.issuedAt;
  profile.continuity.lastEditionSeen={id:c.id,label:entry.label,timestamp:c.issuedAt,sourceEdition:CONFIG,archivePath};
  for(const [p,value] of [[LIVE,live],[archivePath,archived],[`${ARCHIVE}/index.json`,JSON.stringify(index)+'\n'],['data/characters/lou-vega.json',text(profile)]]){
    fs.mkdirSync(path.dirname(path.join(ROOT,p)),{recursive:true});fs.writeFileSync(path.join(ROOT,p),value);
  }
  console.log(`Built static Lou counter: ${c.id}`);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert(process.argv.slice(2).every(x=>x==='--check'),'Usage: build-lou-vega-counter.mjs [--check]');
  build({check:process.argv.includes('--check')});
}
