// A scheduled report accepts one exact snapshot at run start. Issuance keeps
// its actual clock; analysis duration does not refresh or invalidate that snapshot.
export const SNAPSHOT_ACCEPTANCE_FROM='2026-10-20T07:43:53-07:00';
const MINUTE_MS=60000;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const requireValue=(ok,message)=>{if(!ok)throw Error(message);};

export function validateReportSnapshot(report,sidecar,{startedAt}={}){
  const snapshot=report?.oddsSnapshot;
  if(!snapshot){
    requireValue(!sidecar?.oddsSnapshot,'Sidecar snapshot has no matching report binding');
    return report.ts; // Immutable historical reports retain issuance-time rules.
  }
  requireValue(snapshot.schema===1&&snapshot.mode==='RUN_BOUND_SNAPSHOT','Invalid report snapshot binding');
  requireValue(snapshot.feedGeneratedAt===report.feedGeneratedAt&&snapshot.slot===report.slot,'Snapshot feed/slot binding changed');
  requireValue(/^[a-f0-9]{40}$/i.test(snapshot.feedBlobSha||''),'Snapshot requires exact feed blob SHA');
  const accepted=Date.parse(snapshot.acceptedAt),generated=Date.parse(snapshot.feedGeneratedAt),issued=Date.parse(report.ts);
  requireValue(/(Z|[+-]\d\d:\d\d)$/.test(snapshot.acceptedAt||'')&&issued>=Date.parse(SNAPSHOT_ACCEPTANCE_FROM),'Snapshot acceptance requires the forward policy and an explicit timezone');
  requireValue(Number.isFinite(accepted)&&Number.isFinite(generated)&&Number.isFinite(issued)&&accepted<=issued,'Snapshot acceptance must precede actual issuance');
  requireValue(accepted>=generated&&accepted-generated<=75*MINUTE_MS,'Report feed is older than 75 minutes or future at run acceptance');
  const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  requireValue(day(accepted)===day(issued),'Snapshot cannot move to another operating day');
  if(sidecar){
    requireValue(same(snapshot,sidecar.oddsSnapshot),'Report/sidecar snapshot bindings differ');
    requireValue(snapshot.feedBlobSha===sidecar.provenance?.feedBlobSha&&snapshot.canonicalSlot===sidecar.provenance?.canonicalSlot,'Snapshot provenance differs from pinned feed/lane');
  }
  if(startedAt!==undefined)requireValue(snapshot.acceptedAt===startedAt,'Snapshot acceptance differs from saved run start');
  return snapshot.acceptedAt;
}

export function snapshotReferenceAt(report,sidecar){return validateReportSnapshot(report,sidecar);}

export function bindReportSnapshot(report,sidecar,{startedAt}={}){
  if(!report.oddsSnapshot&&Date.parse(report.ts)<Date.parse(SNAPSHOT_ACCEPTANCE_FROM))return;
  if(!report.oddsSnapshot){
    requireValue(Number.isFinite(Date.parse(startedAt)),'Snapshot acceptance requires the saved actual run start');
    report.oddsSnapshot={schema:1,mode:'RUN_BOUND_SNAPSHOT',acceptedAt:startedAt,
      feedGeneratedAt:report.feedGeneratedAt,feedBlobSha:sidecar.provenance?.feedBlobSha,
      slot:report.slot,canonicalSlot:sidecar.provenance?.canonicalSlot};
    sidecar.oddsSnapshot={...report.oddsSnapshot};
  }
  // Start may precede the final retime; full acceptance/issue ordering is checked
  // independently by every publication path after actual issuance is bound.
  validateReportSnapshot({...report,ts:Date.parse(report.ts)<Date.parse(startedAt)?startedAt:report.ts},sidecar,{startedAt});
}
