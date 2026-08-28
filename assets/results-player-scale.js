(()=>{
'use strict';
const bust=Date.now();
for(const src of ['./assets/results-player-base-v5.js','./assets/decision-shadow-v2-ui.js','./assets/f3-overall-profit.js']){
  const s=document.createElement('script');
  s.src=`${src}?b=${bust}`;
  s.async=false;
  document.head.appendChild(s);
}
})();
