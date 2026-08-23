import fs from 'node:fs';
const live=fs.readFileSync('syndicates/lock-line/hotline.html','utf8'),shell=fs.readFileSync('syndicates/lock-line/shell.html','utf8'),arc=fs.readFileSync('syndicates/lock-line/archive/2026-08-22/1815.html','utf8');
if(!live.includes('LIZARD_LINE_ORIGINAL_ANIMATED_GIFS'))throw new Error('Original Larry GIF payload missing');
if((live.match(/data-gif=/g)||[]).length<12)throw new Error('Larry live animated layer too thin');
if((shell.match(/data-gif=/g)||[]).length<6)throw new Error('Larry shell animated layer too thin');
if(!live.includes('data-zone=\"animated-gif-layer\"'))throw new Error('Larry animated GIF rail missing');
if(live!==arc)throw new Error('Larry live/current archive mismatch');
console.log('LARRY ORIGINAL ANIMATED GIF LAYER: PASS');
