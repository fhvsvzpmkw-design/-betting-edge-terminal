import fs from 'node:fs';

const path='index.html';
let html=fs.readFileSync(path,'utf8');
const fixes=[
  ['o\\\\/u','o\\/u'],
  ['to win\\\\b','to win\\b']
];
for(const [bad,good] of fixes){
  if(!html.includes(bad)) throw new Error(`Expected generated regex token not found: ${bad}`);
  html=html.split(bad).join(good);
}
fs.writeFileSync(path,html);
console.log('F3 generated regex escaping fixed.');
