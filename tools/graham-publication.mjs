import fs from 'node:fs';

// A verification clock is not new football information. Preserve the last
// actual publication when an overlapping status check produces identical data.
export function sameGrahamPublication(previous, next, {terminal=false}={}) {
  const content=value=>{
    const copy=structuredClone(value);
    delete copy.generatedAt;
    if(terminal&&copy.weeklyReadiness)delete copy.weeklyReadiness.generatedAt;
    return JSON.stringify(copy);
  };
  return content(previous)===content(next);
}

export function writeGrahamPublication(file, value, options={}) {
  if(fs.existsSync(file)&&sameGrahamPublication(JSON.parse(fs.readFileSync(file,'utf8')),value,options))return false;
  fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
  return true;
}
