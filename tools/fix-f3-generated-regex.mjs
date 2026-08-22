import fs from 'node:fs';

const path='index.html';
let html=fs.readFileSync(path,'utf8');
const start=html.indexOf('function publicBetType(x){');
const end=html.indexOf('\nfunction wagerYear',start);
if(start<0||end<0) throw new Error('Generated publicBetType function markers not found');
const good=`function publicBetType(x){const t=[x.desc,...x.legs].join(' ').toLowerCase();if(/goalscorer|touchdown|rush yds|rushing yards|receiv|passing|shots|rebounds|assists|strikeouts|total bases|hits, runs|player |offsides|saves|aces|double faults|home runs|rbis|runs scored|stolen base|fight outcome|round betting/.test(t))return 'Props';if(/spread|point spread|run line|puck line|handicap/.test(t))return 'Spread';if(/money line|moneyline|to advance|match winner|draw no bet| to win\\b/.test(t))return 'Moneyline';if(/total|over |under |o\\/u|team points|team total/.test(t))return 'Totals';return 'Props'}`;
html=html.slice(0,start)+good+html.slice(end);
fs.writeFileSync(path,html);
console.log('F3 generated publicBetType function normalized.');
