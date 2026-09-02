#!/usr/bin/env node
import fs from 'node:fs';

const PUBLISHER='tools/report-publication.mjs';
const RUNTIME='assets/runner-core-runtime.js';

function fail(message){throw new Error(message);}
function replaceOnce(text,from,to,label){
  const count=text.split(from).length-1;
  if(count!==1) fail(`${label}: expected exactly one match, found ${count}`);
  return text.replace(from,to);
}

let publisher=fs.readFileSync(PUBLISHER,'utf8');
publisher=replaceOnce(
  publisher,
  "import os from 'node:os';\n",
  "import os from 'node:os';\nimport {attachPublisherInstrumentTelemetry} from './vigscope-meter-telemetry.mjs';\n",
  'publisher telemetry import'
);
publisher=replaceOnce(
  publisher,
  "  const sidecar = validateSidecar(normalizePublicationSidecar(readJson(sidecarFile),report),report,paths.reportPath,{strict:true});\n  const reportAbs = path.join(root,paths.reportPath);\n  const sidecarAbs = path.join(root,paths.sidecarPath);\n  const reportCreated = writeImmutableJson(reportAbs,report,'Issued report');\n  const sidecarCreated = writeImmutableJson(sidecarAbs,sidecar,'Research Fit sidecar');\n\n  const {file:indexFile,index} = loadIndex(root);\n",
  "  const sidecar = validateSidecar(normalizePublicationSidecar(readJson(sidecarFile),report),report,paths.reportPath,{strict:true});\n  const {file:indexFile,index} = loadIndex(root);\n  const decisionFingerprint=normalizedJson({slot:report.slot,label:report.label,ts:report.ts,feedGeneratedAt:report.feedGeneratedAt,bankroll:report.bankroll,risk:report.risk,counts:report.counts,recs:report.recs});\n  attachPublisherInstrumentTelemetry({root,index,report,sidecar});\n  assert(normalizedJson({slot:report.slot,label:report.label,ts:report.ts,feedGeneratedAt:report.feedGeneratedAt,bankroll:report.bankroll,risk:report.risk,counts:report.counts,recs:report.recs})===decisionFingerprint,'VigScope meter telemetry derivation must not mutate betting decisions or recommendation content');\n  const reportAbs = path.join(root,paths.reportPath);\n  const sidecarAbs = path.join(root,paths.sidecarPath);\n  const reportCreated = writeImmutableJson(reportAbs,report,'Issued report');\n  const sidecarCreated = writeImmutableJson(sidecarAbs,sidecar,'Research Fit sidecar');\n\n",
  'publisher telemetry attachment'
);
fs.writeFileSync(PUBLISHER,publisher,'utf8');

let runtime=fs.readFileSync(RUNTIME,'utf8');
runtime=replaceOnce(
  runtime,
  "  const agreementQuality=agreementEvidenceQuality(agreementConfidence);\n  return {\n    heat:{value:Math.round(heat),rawValue:heat,label:heatConf?heatLabel(heat):'NO DATA',confidence:Math.round(heatConf)},\n    pressure:{value:Math.round(pressure),rawValue:pressure,label:pressureConf?pressureLabel(pressure):'NO DATA',confidence:Math.round(pressureConf)},\n    agreement:{value:Math.round(agreementScore),rawValue:agreementScore,label:agreementConfidence?agreementLabel(agreementScore):'UNMEASURED',confidence:Math.round(agreementConfidence),rawConfidence:agreementConfidence,evidenceQuality:agreementQuality,pairs:agreement.pairs||0}\n  }\n",
  "  const agreementQuality=agreementEvidenceQuality(agreementConfidence);\n  const telemetry=run?.instrumentTelemetry,structured=telemetry?.authority==='PUBLISHER_BOUND_FEED_V1'&&telemetry?.calibrationId===VIG_METER_CALIBRATION_ID;\n  const structuredHeat=telemetry?.heat||{},structuredPressure=telemetry?.pressure||{};\n  const structuredHeatValue=clamp(structuredHeat.rawValue??structuredHeat.value??0),structuredHeatConfidence=clamp(structuredHeat.rawConfidence??structuredHeat.confidence??0);\n  const structuredPressureValue=clamp(structuredPressure.rawValue??structuredPressure.value??50),structuredPressureConfidence=clamp(structuredPressure.rawConfidence??structuredPressure.confidence??0);\n  return {\n    heat:structured?{value:Math.round(structuredHeatValue),rawValue:structuredHeatValue,label:structuredHeatConfidence?heatLabel(structuredHeatValue):'NO DATA',confidence:Math.round(structuredHeatConfidence)}:{value:Math.round(heat),rawValue:heat,label:heatConf?heatLabel(heat):'NO DATA',confidence:Math.round(heatConf)},\n    pressure:structured?{value:Math.round(structuredPressureValue),rawValue:structuredPressureValue,label:structuredPressureConfidence?pressureLabel(structuredPressureValue):'NO DATA',confidence:Math.round(structuredPressureConfidence)}:{value:Math.round(pressure),rawValue:pressure,label:pressureConf?pressureLabel(pressure):'NO DATA',confidence:Math.round(pressureConf)},\n    agreement:{value:Math.round(agreementScore),rawValue:agreementScore,label:agreementConfidence?agreementLabel(agreementScore):'UNMEASURED',confidence:Math.round(agreementConfidence),rawConfidence:agreementConfidence,evidenceQuality:agreementQuality,pairs:agreement.pairs||0}\n  }\n",
  'runtime structured telemetry authority'
);
fs.writeFileSync(RUNTIME,runtime,'utf8');

console.log('VIGSCOPE PUBLISHER TELEMETRY INTEGRATION APPLIED');
