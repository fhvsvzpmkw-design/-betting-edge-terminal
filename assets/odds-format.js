(function(root){
  'use strict';
  // Decimal prices remain authoritative calculation inputs. Only display text
  // is converted; point lines, percentages, money and source records stay intact.
  function fromDecimal(value){
    if(value===null||value===undefined||value==='')return '—';
    const d=Number(value);if(!Number.isFinite(d)||d<=1)return '—';
    const a=d>=2?Math.round((d-1)*100):-Math.round(100/(d-1));
    return `${a>0?'+':''}${a}`;
  }
  function price(value){
    const s=String(value??'').trim().replace(/−/g,'-');
    if(!s)return '—';
    if(/^[+-]?\d+(?:\.\d+)?$/.test(s)){
      const n=Number(s);
      if(Math.abs(n)>=100)return `${n>0?'+':''}${Math.round(n)}`;
      if(!/^[+-]/.test(s))return fromDecimal(n);
    }
    const target=s.match(/^(~?)(\d+(?:\.\d+)?)(\s+(?:or better|or longer|or higher|or shorter|or lower)\b.*)$/i);
    if(target&&Number(target[2])>1&&Number(target[2])<100)return `${target[1]}${fromDecimal(target[2])}${target[3]}`;
    return text(s);
  }
  function decimalValues(record){
    const values=new Set();
    function visit(v,key,depth){
      if(depth>9||!v||typeof v!=='object')return;
      for(const [k,x] of Object.entries(v)){
        if(/(?:priceDecimal|previousPrice|referenceBreakEvenPriceDecimal)$/i.test(k)&&Number.isFinite(Number(x))&&Number(x)>1){
          values.add(Number(x));
        }else if(x&&typeof x==='object')visit(x,k,depth+1);
      }
    }
    visit(record,'',0);return [...values];
  }
  function text(value,knownDecimals=[]){
    let s=String(value??'');
    const number='(\\d+(?:\\.\\d+)?)';
    const known=knownDecimals.filter(n=>Number.isFinite(Number(n))&&Number(n)>1).map(Number);
    const format=n=>fromDecimal(known.find(d=>d===Number(n))??known.find(d=>Number(d.toFixed(3))===Number(n))??n);
    // An explicit decimal label identifies odds without guessing other numbers.
    s=s.replace(new RegExp('\\bdecimal(?:\\s+odds)?\\s*[:=]?\\s*'+number+'(?!\\d|\\.\\d|%)','gi'),(_,n)=>format(n));
    s=s.replace(new RegExp('(?<![\\d.+\\-−])'+number+'\\s+decimal(?:\\s+odds)?\\b','gi'),(_,n)=>format(n));
    s=s.replace(new RegExp('\\b(odds|priced?|price)\\s*(?:of|at|[:=])?\\s*'+number+'(?!\\d|\\.\\d|%)','gi'),(_,label,n)=>`${label} ${format(n)}`);
    // Report rationales also put the executable number before its odds label,
    // e.g. "recorded DraftKings 1.72 price". Require that explicit label so
    // percentages, signed point lines, money and ordinary decimals stay intact.
    s=s.replace(/(?<![\d.+\-−$])(\d+(?:\.\d+)?)(?!\d|\.\d|%)\s+(price|odds)\b/gi,(_,n,label)=>`${format(n)} ${label}`);
    // Bare narrative odds are converted only when bound to this record's
    // structured price and introduced as a price, not a point/probability value.
    s=s.replace(/\b(break[- ]even(?:\s+rate)?|quoted|offered|available)\s+at\s+(\d+(?:\.\d+)?)(?!\d|\.\d|%)\b(?!\s*(?:pp\b|probability|percentage|points?\b|runs?\b|goals?\b|units?\b|percent\b|seconds?\b|minutes?\b))/gi,(all,label,n)=>known.some(d=>d===Number(n)||Number(d.toFixed(3))===Number(n))?`${label} at ${format(n)}`:all);
    // Retire redundant dual-format suffixes from older issued reports.
    s=s.replace(/([+\-]\d{3,})\s*\((\d+(?:\.\d+)?)\)/g,(all,a,d)=>format(d)===a?a:all);
    s=s.replace(/([+\-]\d{3,})\s+at\s+([+\-]\d{3,})/g,(all,a,b)=>a===b?a:all);
    return s;
  }
  function record(value){
    if(!value||typeof value!=='object')return value;
    const out={...value},known=decimalValues(value);
    for(const key of ['analysis','support','contrary','edge','fair','move','hist','source','summary','reason','decisionRationale','decision','action','actionLabel','priceNote','movement','edgeRead','whyWatch','whyThisOne','lousRead','watchOut','vigScopeNote','sourceNote']){
      if(typeof value[key]==='string')out[key]=text(value[key],known);
    }
    for(const key of ['price','observedPrice','fairPrice','targetPrice','playTo','betAt'])if(value[key]!==undefined)out[key]=price(value[key]);
    if(value.priceWatch)out.priceWatch={...value.priceWatch,target:price(value.priceWatch.target),reason:text(value.priceWatch.reason,known)};
    if(value.priceComparison)out.priceComparison={...value.priceComparison,price:price(value.priceComparison.price)};
    if(value.priceCondition)out.priceCondition={...value.priceCondition,text:text(value.priceCondition.text,known),rationale:text(value.priceCondition.rationale,known)};
    return out;
  }
  const api=Object.freeze({fromDecimal,price,text,record,decimalValues});
  root.VigScopeOddsFormat=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
