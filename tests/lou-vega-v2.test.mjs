#!/usr/bin/env node
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8'),assert=(x,m)=>{if(!x)throw new Error(m)};
const shell=read('syndicates/generated/lou-vega/shell-v2.html');
const archived=read('syndicates/generated/lou-vega/archive/2026-08-23/0930.html');
assert(shell.includes('data-shell-version="2"'),'Lou v2 shell must remain preserved');
assert(archived.includes('data-shell-version="2"'),'Lou 09:30 v2 archive must retain shell v2');
assert(archived.includes('09:30 FINAL MORNING'),'Lou v2 historical issue missing');
assert(fs.existsSync('syndicates/generated/lou-vega/shell.html'),'Lou v1 shell must remain preserved');
console.log('LOU VEGA // HISTORICAL VEGAS BY THE SLICE v2: PASS');
