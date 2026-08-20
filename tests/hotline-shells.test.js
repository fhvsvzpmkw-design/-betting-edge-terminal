#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const json=p=>JSON.parse(read(p));
function assert(ok,msg){if(!ok)throw new Error(msg)}

const syndicates=json('data/syndicates.json');
assert(JSON.stringify(syndicates.defaults)===JSON.stringify(['eddie-numbers','lou-vega',null,null]),'Default Syndicate roster must remain Eddie / Lou / Empty / Empty');

const shellManifest=json('data/hotline-shells.json');
assert(shellManifest.schema===1,'Hotline shell manifest schema must be 1');
assert(shellManifest.rules?.normalUpdate==='REFRESH THE EDITION; PRESERVE THE PAGE.','Normal shell update rule missing');
const expected={
  'eddie-numbers':['muddy-broadcast','syndicates/sharp-room/shell.html','MUDDY LEDGER // LAST 10 TICKETS'],
  'bill-weston':['private-sheet','syndicates/downtown-booth/shell.html','BILL WESTON // PRIVATE SHEET'],
  'larry-lombardo':['lizard-line','syndicates/lock-line/shell.html','THE LIZARD LINE!!!'],
  'jesse-bains':['delphoria-counter-sheet','syndicates/death-angel/shell.html','<div>SPORTS DESK</div><div>HOTEL DELPHORIA</div>'],
  'lou-vega':['vegas-by-the-slice','syndicates/generated/lou-vega/shell.html','VEGAS BY THE SLICE']
};
for(const [characterId,[id,file,fingerprint]] of Object.entries(expected)){
  const shell=shellManifest.shells.find(x=>x.characterId===characterId&&x.id===id);
  assert(shell,`Missing shell registry entry for ${characterId}`);
  assert(shell.version===1&&shell.status==='locked',`${characterId} v1 shell must be locked`);
  assert(shell.portable===true&&shell.installable===true,`${characterId} shell must be portable/installable`);
  assert(fs.existsSync(path.join(ROOT,file)),`Missing ${file}`);
  assert(read(file).includes(fingerprint),`${characterId} shell fingerprint missing`);
}

const prefs=json('data/preferences.json');
const shellPrefs=prefs.modules.find(x=>x.id==='hotline_shells');
assert(shellPrefs?.state==='display_only','F6 HOTLINE SHELLS must be display-only');
assert(shellPrefs?.source==='data/hotline-shells.json','F6 HOTLINE SHELLS must use shell manifest');
const prefFramework=read('assets/preferences-framework.js');
assert(prefFramework.includes("HOTLINE_SHELLS_URL='./data/hotline-shells.json'"),'F6 framework must load shell manifest');
assert(prefFramework.includes('prefShellGrid'),'F6 framework must render the shell list');

const slotHost=read('syndicates/slot-host.html');
assert(slotHost.includes('BUILD YOUR SYNDICATE'),'Load Syndicate title bar missing');
assert(slotHost.includes('CHARACTER LIBRARY'),'Visual character library missing');
assert(slotHost.includes("const FALLBACK_DEFAULTS=['eddie-numbers','lou-vega',null,null]"),'Slot-host fallback defaults changed');
assert(slotHost.includes('CHOOSE CHARACTER'),'Empty-slot choose action missing');

const factory=read('tools/create-syndicate-character.mjs');
assert(factory.includes('SHELL_MANIFEST_PATH'),'Character factory does not update shell manifest');
assert(factory.includes("shellRel = `./syndicates/generated/${id}/shell.html`"),'Character factory does not create shell path');
assert(factory.includes("status: 'editable'"),'Generated character shell must start editable');
assert(factory.includes("process.stdout.write('Default F1-F4 slot assignments were not changed."),'Factory must preserve F1-F4 defaults');

const template=json('data/characters/character-template.json');
assert(template.hotlineStyle?.shell?.version===1,'Character template shell version missing');
assert(template.hotlineStyle?.shell?.portable===true,'Character template shell portability missing');

console.log('HOTLINE SHELL + SYNDICATE LOAD guardrails: PASS');
