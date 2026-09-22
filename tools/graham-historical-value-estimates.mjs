// Explicit historical-only estimates. Never mutates the frozen production registry.
import {playerValue} from './walters-personnel-calibration.mjs';
export const VALUE_ESTIMATE_POLICY='graham-historical-value-estimates-v1';
const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const need=(x,message)=>{if(!x)throw Error(message);};
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const groups={RUNNING_BACK:['RB','FB'],RECEIVER:['WR','TE'],OFFENSIVE_LINE:['LT','LG','C','RG','RT'],DEFENSIVE_LINE:['EDGE','LE','RE','DT','NT'],LINEBACKER:['LB','MLB','OLB'],DEFENSIVE_BACK:['CB','FS','SS']};
export function estimateGroup(position){return Object.keys(groups).find(g=>groups[g].includes(position));}
const percentile=(xs,q)=>{const i=(xs.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return Number((xs[lo]+(xs[hi]-xs[lo])*(i-lo)).toFixed(3));};
export function historicalValueEstimates({bundle,registry,calibration,supplementalPlayers=[],sourceCheck}){
  const result=[];
  for(const row of bundle.valueEstimates||[]){
    need(bundle.estimationPolicy===VALUE_ESTIMATE_POLICY&&row.estimateAcknowledged===true&&nonempty(row.rationale),'VALUE_ESTIMATE_POLICY_REQUIRED');
    need(nonempty(row.player)&&/^estimate:[a-z0-9-]+$/.test(row.identity||'')&&Array.isArray(row.gameKeys)&&row.gameKeys.length,'VALUE_ESTIMATE_IDENTITY');
    for(const key of row.gameKeys){sourceCheck(row.sourceIds,key);sourceCheck(row.roleSourceIds,key);}
    need(![...registry.players,...supplementalPlayers,...result].some(p=>norm(p.player)===norm(row.player)||String(p.eaPlayerId)===row.identity),'VALUE_ESTIMATE_OVERRIDE_OR_DUPLICATE');
    const g=estimateGroup(row.position);
    need(g,'NON_QB_ESTIMATE_POSITION_REQUIRED');
    let value,range,details;
    if(row.method==='INDEPENDENT_MADDEN_27'){
      need(Number.isInteger(row.maddenOvr)&&row.maddenOvr>=0&&row.maddenOvr<=99&&row.ratingVersion==='MADDEN_NFL_27'&&nonempty(row.provider),'INDEPENDENT_RATING_REQUIRED');
      value=playerValue(calibration,{position:row.position,maddenOvr:row.maddenOvr});range=[value,value];
      details={maddenOvr:row.maddenOvr,ratingVersion:row.ratingVersion,provider:row.provider,limitation:'Independent rating source; range does not measure player-value uncertainty.'};
    }else{
      need(row.method==='POSITION_GROUP_MEDIAN'&&row.officialAndIndependentSearchCompleted===true&&nonempty(row.searchFinding),'IMPUTATION_SEARCH_REQUIRED');
      const cohort=registry.players.filter(p=>estimateGroup(p.position)===g&&p.valueStatus==='CALIBRATED'&&Number.isFinite(p.waltersPoints)).map(p=>p.waltersPoints).sort((a,b)=>a-b);
      need(cohort.length>0,'IMPUTATION_COHORT_EMPTY');value=percentile(cohort,.5);range=[percentile(cohort,.1),percentile(cohort,.9)];
      details={group:g,cohortSize:cohort.length,searchFinding:row.searchFinding,limitation:'Imputed from the frozen position group; 10th–90th percentile sensitivity, not a confidence interval or measured player value.'};
    }
    result.push({player:row.player,eaPlayerId:row.identity,position:row.position,maddenOvr:row.method==='INDEPENDENT_MADDEN_27'?row.maddenOvr:null,waltersPoints:value,valueStatus:'HISTORICAL_ESTIMATE',valueProvenance:{type:row.method,policy:VALUE_ESTIMATE_POLICY,valueRange:range,...details,rationale:row.rationale,sourceIds:row.sourceIds,roleSourceIds:row.roleSourceIds,gameKeys:row.gameKeys}});
  }
  return result;
}
