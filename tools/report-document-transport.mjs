// Lossless repository transport for large producer checkpoints and staging files.
// Issued reports, decisions and source records retain their existing schemas.
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {isDeepStrictEqual} from 'node:util';

export const TRANSPORT_FORMAT='BETTING_EDGE_GZIP_JSON_V1';
export const MAX_DOCUMENT_BYTES=64*1024*1024;
export const COMPRESSION_THRESHOLD=256*1024;
const json=value=>JSON.stringify(value,null,2)+'\n';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function serializeReportDocument(value,documentType){
  if(!['REPORT_CHECKPOINT','STAGED_REPORT'].includes(documentType))throw Error('Unknown report document type');
  let bytes=Buffer.from(json(value));
  if(bytes.length>MAX_DOCUMENT_BYTES)throw Error('Report document exceeds the supported decoded size');
  if(bytes.length<COMPRESSION_THRESHOLD)return bytes.toString('utf8');
  // A frozen checkpoint already contains the exact sealed report and sidecar.
  // Store that single authoritative copy and restore the ordinary in-memory
  // checkpoint on read, rather than duplicating the whole candidate again.
  if(documentType==='REPORT_CHECKPOINT'&&value.frozen?.serializedBundle &&
    ['FROZEN','STAGED','PUBLISHED'].includes(value.phase)){
    const bundle=parseReportDocument(value.frozen.serializedBundle,'STAGED_REPORT');
    if(isDeepStrictEqual(bundle.report,value.report)&&isDeepStrictEqual(bundle.sidecar,value.sidecar)){
      const wire={...value,draftFromFrozenBundle:true};delete wire.report;delete wire.sidecar;
      bytes=Buffer.from(json(wire));
    }
  }
  const packed=json({schema:1,format:TRANSPORT_FORMAT,documentType,encoding:'gzip-base64',
    decodedBytes:bytes.length,sha256:hash(bytes),data:gzipSync(bytes,{level:9}).toString('base64')});
  return Buffer.byteLength(packed)<bytes.length?packed:bytes.toString('utf8');
}

export function parseReportDocument(bytes,documentType){
  const envelope=JSON.parse(bytes);
  if(!String(envelope?.format||'').startsWith('BETTING_EDGE_GZIP_JSON_'))return restoreFrozenDraft(envelope,documentType);
  if(envelope.format!==TRANSPORT_FORMAT||envelope.schema!==1||envelope.encoding!=='gzip-base64' ||
    envelope.documentType!==documentType)throw Error('Invalid report transport envelope');
  if(!Number.isSafeInteger(envelope.decodedBytes)||envelope.decodedBytes<1||envelope.decodedBytes>MAX_DOCUMENT_BYTES ||
    !/^[a-f0-9]{64}$/.test(envelope.sha256||'')||typeof envelope.data!=='string' ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(envelope.data))throw Error('Invalid report transport integrity metadata');
  let decoded;
  try{decoded=gunzipSync(Buffer.from(envelope.data,'base64'),{maxOutputLength:envelope.decodedBytes});}
  catch{throw Error('Report transport decompression failed');}
  if(decoded.length!==envelope.decodedBytes||hash(decoded)!==envelope.sha256)throw Error('Report transport integrity mismatch');
  const value=JSON.parse(decoded);
  if(String(value?.format||'').startsWith('BETTING_EDGE_GZIP_JSON_'))throw Error('Nested report transport is invalid');
  return restoreFrozenDraft(value,documentType);
}

function restoreFrozenDraft(value,documentType){
  if(value?.draftFromFrozenBundle!==true)return value;
  if(documentType!=='REPORT_CHECKPOINT'||value.report||value.sidecar||!value.frozen?.serializedBundle ||
    !['FROZEN','STAGED','PUBLISHED'].includes(value.phase))throw Error('Invalid frozen checkpoint transport');
  const bundle=parseReportDocument(value.frozen.serializedBundle,'STAGED_REPORT');
  const restored={...value,report:bundle.report,sidecar:bundle.sidecar};
  delete restored.draftFromFrozenBundle;
  return restored;
}
