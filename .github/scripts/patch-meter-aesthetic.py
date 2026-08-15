from pathlib import Path

p = Path('runner.html')
s = p.read_text()

def one(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, found {n}')
    s = s.replace(old, new, 1)

old_css = """  .runnerHeadRight{display:flex;flex-direction:column;align-items:flex-end;gap:5px;min-width:286px}
  .instrumentCluster{display:flex;gap:5px;align-items:flex-start;justify-content:flex-end}
  .instrument{width:88px;height:66px;border:1px solid #23342e;background:#010a08;padding:3px 3px 2px;box-sizing:border-box;text-align:center;overflow:hidden;box-shadow:inset 0 0 12px rgba(0,255,135,.05)}
  .instrumentLabel{font-size:8px;font-weight:950;letter-spacing:.06em;color:var(--muted);white-space:nowrap}
  .instrument:last-child .instrumentLabel{font-size:7px;letter-spacing:.025em}
  .instrument svg{display:block;width:80px;height:38px;margin:-1px auto -2px;overflow:visible}
  .instrumentRead{font-size:9px;font-weight:950;line-height:1;color:var(--white);white-space:nowrap}
  .instrumentRead b{font-size:13px;color:var(--cyan);margin-right:3px}
  .instrumentConf{font-size:7px;color:var(--muted);margin-top:2px;white-space:nowrap}
  .gaugeNeedle{transform-origin:40px 34px;transition:transform .55s cubic-bezier(.22,.8,.25,1)}"""

new_css = """  .runnerHeadRight{display:flex;flex-direction:column;align-items:stretch;gap:7px;min-width:min(690px,62vw);flex:1}
  .instrumentCluster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;width:100%;align-items:stretch}
  .instrument{min-width:0;height:132px;border:1px solid #35553f;background:linear-gradient(180deg,#020d09 0%,#010806 100%);padding:7px 6px 6px;box-sizing:border-box;text-align:center;overflow:hidden;box-shadow:inset 0 0 18px rgba(0,255,135,.06)}
  .instrumentLabel{font-size:10px;font-weight:950;letter-spacing:.07em;color:var(--green);white-space:nowrap;margin-bottom:1px}
  .instrument:last-child .instrumentLabel{font-size:9px;letter-spacing:.035em}
  .instrument svg{display:block;width:100%;height:72px;margin:-2px auto -5px;overflow:visible}
  .instrumentRead{font-size:10px;font-weight:950;line-height:1.05;color:var(--white);white-space:nowrap;margin-top:-1px}
  .instrumentRead b{font-size:17px;color:var(--cyan);margin-right:4px}
  .instrumentScale{display:flex;justify-content:space-between;font-size:6px;color:#b7bd88;margin:0 4px -3px;letter-spacing:0}
  .instrumentBand{display:grid;gap:2px;margin:5px 1px 0;height:11px;align-items:end}
  .instrumentBand span{height:4px;display:block;border-top:1px solid currentColor;font-size:5px;line-height:11px;white-space:nowrap;overflow:visible}
  .instrumentBand.heat{grid-template-columns:repeat(7,1fr)}
  .instrumentBand.pressure{grid-template-columns:repeat(3,1fr)}
  .instrumentBand.agreement{grid-template-columns:repeat(4,1fr)}
  .instrumentConf{font-size:6px;color:var(--muted);margin-top:5px;white-space:nowrap}
  .gaugeNeedle{transform-origin:80px 72px;transition:transform .55s cubic-bezier(.22,.8,.25,1)}"""
one(old_css, new_css, 'meter css')

old_mobile = """    .runnerHeadRight{align-items:flex-start;min-width:0;margin-top:7px}
    .instrumentCluster{justify-content:flex-start;max-width:100%;overflow-x:auto}"""
new_mobile = """    .runnerHeadRight{align-items:stretch;min-width:0;width:100%;margin-top:10px}
    .instrumentCluster{grid-template-columns:repeat(3,minmax(0,1fr));width:100%;max-width:none;overflow:visible;gap:5px}
    .instrument{height:124px;padding:6px 3px 5px}
    .instrumentLabel{font-size:8px;letter-spacing:.035em}
    .instrument:last-child .instrumentLabel{font-size:7px}
    .instrument svg{height:68px}
    .instrumentRead{font-size:8px}
    .instrumentRead b{font-size:15px}
    .instrumentBand span{font-size:4px}
    .instrumentConf{font-size:5px}"""
one(old_mobile, new_mobile, 'mobile meter css')

start = s.index('function instrumentGauge(d,title,type,reading){')
end = s.index('\nfunction instrumentCluster(d,run)', start)
new_fn = r'''function instrumentGauge(d,title,type,reading){
  const wrap=el(d,'div','instrument'),lab=el(d,'div','instrumentLabel',title);wrap.appendChild(lab);
  const scale=el(d,'div','instrumentScale');['0','25','50','75','100'].forEach(v=>scale.appendChild(el(d,'span','',v)));wrap.appendChild(scale);
  const ns='http://www.w3.org/2000/svg',svg=d.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 160 88');svg.setAttribute('aria-label',`${title} ${reading.value} ${reading.label}`);
  const colors=gaugePalette(type),angles=[-72,-43.2,-14.4,14.4,43.2,72];
  function polar(a,r=58){const rad=(a-90)*Math.PI/180;return [80+r*Math.cos(rad),72+r*Math.sin(rad)]}
  for(let i=0;i<5;i++){
    const [x1,y1]=polar(angles[i]),[x2,y2]=polar(angles[i+1]);
    const path=d.createElementNS(ns,'path');path.setAttribute('d',`M ${x1.toFixed(2)} ${y1.toFixed(2)} A 58 58 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`);path.setAttribute('fill','none');path.setAttribute('stroke',colors[i]);path.setAttribute('stroke-width','7');path.setAttribute('stroke-linecap','butt');svg.appendChild(path)
  }
  for(let i=0;i<=12;i++){
    const a=-72+i*12,[x1,y1]=polar(a,48),[x2,y2]=polar(a,54),tick=d.createElementNS(ns,'line');
    tick.setAttribute('x1',x1);tick.setAttribute('y1',y1);tick.setAttribute('x2',x2);tick.setAttribute('y2',y2);tick.setAttribute('stroke',i%3===0?'#d8d59a':'#718178');tick.setAttribute('stroke-width',i%3===0?'1.4':'.8');svg.appendChild(tick)
  }
  const needle=d.createElementNS(ns,'g');needle.setAttribute('class','gaugeNeedle');needle.style.transform=`rotate(${-72+clamp(reading.value)*1.44}deg)`;
  const line=d.createElementNS(ns,'line');line.setAttribute('x1','80');line.setAttribute('y1','72');line.setAttribute('x2','80');line.setAttribute('y2','27');line.setAttribute('stroke','#f4fff9');line.setAttribute('stroke-width','2.2');
  const hub=d.createElementNS(ns,'circle');hub.setAttribute('cx','80');hub.setAttribute('cy','72');hub.setAttribute('r','4');hub.setAttribute('fill','#f4fff9');needle.append(line,hub);svg.appendChild(needle);wrap.appendChild(svg);
  const read=el(d,'div','instrumentRead');read.append(el(d,'b','',`${reading.value} / 100`),d.createTextNode(reading.label));wrap.appendChild(read);
  const defs=type==='heat'?[['DORM','g'],['QUIET','g'],['FORM','y'],['ACTIVE','y'],['PRESS','y'],['HOT','r'],['EXTREME','r']]:type==='pressure'?[['AGAINST','r'],['NEUTRAL','y'],['FAVOR','g']]:[['FRAG','r'],['MIXED','y'],['STRONG','g'],['CONSENSUS','g']];
  const band=el(d,'div',`instrumentBand ${type}`);defs.forEach(([label,c])=>band.appendChild(el(d,'span',c,label)));wrap.appendChild(band);
  wrap.appendChild(el(d,'div','instrumentConf',`CONF ${reading.confidence}%${reading.pairs?` • ${reading.pairs} PAIRS`:''}`));
  return wrap
}'''
s = s[:start] + new_fn + s[end:]

required = ['height:132px', 'instrumentScale', 'instrumentBand', "viewBox','0 0 160 88", '`${reading.value} / 100`']
for marker in required:
    if marker not in s:
        raise SystemExit('missing expected meter upgrade marker: ' + marker)
if 'width:88px;height:66px' in s:
    raise SystemExit('old compact meter dimensions still present')

p.write_text(s)
