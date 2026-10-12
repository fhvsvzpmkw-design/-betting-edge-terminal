#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function scheduledRequest(eventName, now = new Date(), receiptExists = () => false) {
  if (eventName !== 'schedule') return {active:true, request:null};
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  // Two UTC cron entries cover PST/PDT. Accept normal scheduler delays within the local hour.
  if (parts.hour !== '03') return {active:false,request:null};
  const prior=new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);prior.setUTCDate(prior.getUTCDate()-1);
  const targetDate=prior.toISOString().slice(0,10), requestId=`card-grading-native-${targetDate.replaceAll('-','')}-v1`;
  if (receiptExists(requestId)) return {active:false,request:null};
  return {active:true,request:{schema:1,state:'READY',requestId,targetDate,reason:'Native daily historical grading of all pending past events; independent of conversational task availability.'}};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result=scheduledRequest(process.env.GITHUB_EVENT_NAME,new Date(),id=>fs.existsSync(`data/history/grading/receipts/${id}.json`));
  if (result.request) fs.writeFileSync('data/history/grading/request.json',JSON.stringify(result.request,null,2)+'\n');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,`active=${result.active}\n`);
  console.log(JSON.stringify({active:result.active,requestId:result.request?.requestId||null,targetDate:result.request?.targetDate||null}));
}
