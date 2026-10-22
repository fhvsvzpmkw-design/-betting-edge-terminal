import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {nhlFixture} from './fixtures/forecast-point-opinion.mjs';
import {FORECAST_FOLLOW_UP_PATH} from '../tools/forecast-follow-ups.mjs';
import {captureForecastEvidenceDraft, prepareEvidenceDraft, validateCandidateCompletion} from '../tools/report-evidence-repair.mjs';

const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const blob=raw=>createHash('sha1').update(Buffer.from(`blob ${raw.length}\0`)).update(raw).digest('hex');

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'forecast-follow-up-pipeline-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const write=(name,value)=>{
    const target=path.join(root,name);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n');
    return fs.readFileSync(target);
  };
  for(const name of ['data/major-sport-market-coverage-v1.json','core/core-handicap-framework-v1.4.json',
    'research/forecast-source-registry.json','research/research-library.json'])
    write(name,fs.readFileSync(path.join(repositoryRoot,name)));
  write('run-history.json',{schema_version:2,runs:[]});
  let bytes=JSON.stringify(nhlFixture(4.56));
  for(const [before,after] of [
    ['2026-10-13T07:20:00-07:00','2026-10-22T17:00:00-07:00'],
    ['2026-10-13T14:15:00Z','2026-10-22T23:55:00Z'],
    ['2026-10-13T14:10:00Z','2026-10-22T23:50:00Z'],
    ['2026-10-13T22:00:00Z','2026-10-23T03:00:00Z']]) bytes=bytes.replaceAll(before,after);
  // The opinion helper retains its original MLB selectionId strings; the
  // real inventory builder derives NHL IDs from this synthetic hockey feed.
  const f=JSON.parse(bytes.replaceAll('MLB|','NHL|')),{report,sidecar,observer}=f;
  report.label='SYNTHETIC source follow-up integration fixture — never issued';
  const lead={leadId:'synthetic-root-only-dimers-lead',sourceId:'dimers',sport:'NHL',eventId:'123',
    startTime:f.selections[0].eventDate,marketDetail:'full_game_moneyline',period:'FULL_GAME',side:'home',line:null,
    url:'https://www.dimers.com/nhl/predictions',observedAt:'2026-10-22T18:23:37Z',createdAt:'2026-10-22T23:44:00Z',
    probability:.54,finding:'Synthetic earlier original-provider point requiring report-time review.',
    originPath:'docs/reviews/synthetic-follow-up.json'};
  const feed={generatedAt:report.feedGeneratedAt,events:[{eventId:'123',date:lead.startTime,
    sport:{slug:'ice-hockey'},league:{slug:'usa-nhl'},home:'Synthetic Home',away:'Synthetic Away',
    bookmakers:{Bet365:[{marketKey:'ml',updatedAt:report.feedGeneratedAt,
      odds:[{home:1.9,away:1.9,selectionKeys:{home:'123|ml|home||',away:'123|ml|away||'}}]}]}}]};
  sidecar.provenance={feedBlobSha:blob(write('data/live-odds.json',feed)),
    pinnacleObserverPath:'data/oddspapi-observer.json',
    pinnacleObserverBlobSha:blob(write('data/oddspapi-observer.json',observer))};
  const target=sidecar.primaryAnalysis.receipts.find(receipt=>receipt.quote.side==='home');
  target.candidateAssessment={schema:1,selectionId:target.selectionId,checkedAt:report.ts,
    quote:structuredClone(target.quote),
    forecastDispositions:[{recordId:f.raw.recordId,disposition:'CONTEXT',
      rationale:'Synthetic original point considered for directional interest, without adopting an independent fair.'}],
    personnel:{state:'REVIEW_COMPLETED_UNRESOLVED',sourceIds:['info'],rationale:'Synthetic current personnel review.',
      materialityExplanation:'Starting goalie remains unconfirmed.',remainingUncertainty:'Final goalie confirmation.',
      decisionImpact:'Only a provisional zero-stake opinion could be considered.'},
    decision:{status:'PASS',rationale:'Synthetic one-source rejection before following the saved lead.',
      betEligibility:{state:'NOT_APPLICABLE',rationale:'No independent fair or conservative bound adopted.'},
      directionalReview:{state:'REJECTED',reasonKind:'INSUFFICIENT_CORROBORATION',sourceIds:['model'],
        forecastRecordIds:[f.raw.recordId],rationale:'Synthetic second provider has not yet been checked.',
        provisionalAlternative:{considered:true,rationale:'Corroboration follow-up remains outstanding.'}}},
    priceCondition:{state:'NO_PRICE_ONLY_CHANGE',rationale:'A source/applicability review is required.'}};
  write(FORECAST_FOLLOW_UP_PATH,{schema:1,kind:'KNOWN_FORECAST_FOLLOW_UPS',leads:[lead]});
  return {root,report,sidecar,lead,target,write};
}

test('shared intake pins root-only research and publisher reload prevents a completed PASS bypass',t=>{
  const f=fixture(t),before=JSON.stringify({report:f.report,sidecar:f.sidecar});
  assert.equal(f.sidecar.forecastEvidence.followUps,undefined);
  assert.equal(f.sidecar.forecastEvidence.followUpInputs,undefined);
  assert.equal(f.sidecar.forecastEvidence.records.some(row=>row.sourceId==='dimers'),false);
  assert.throws(()=>validateCandidateCompletion(f),/Known forecast follow-ups must be pinned/,
    'publisher independently sees root-owned work even when the submitted receipt omits it');

  const captured=captureForecastEvidenceDraft(f),pin=captured.sidecar.forecastEvidence.followUpInputs;
  assert.deepEqual(pin.leads,[f.lead]);assert.match(pin.blobSha,/^[a-f0-9]{40}$/);
  assert.equal(captured.sidecar.forecastEvidence.records.some(row=>row.sourceId==='dimers'),false,
    'pinning a lead cannot manufacture a cleared forecast');
  assert.equal(JSON.stringify({report:f.report,sidecar:f.sidecar}),before,'shared intake clones its inputs');
  assert.throws(()=>validateCandidateCompletion({root:f.root,...captured}),/FORECAST_CAPTURE_OR_SOURCE_REJECTION_REQUIRED/,
    'a pinned lead is still unfinished work, not clearance to freeze PASS');

  const prepared=prepareEvidenceDraft({root:f.root,...captured});
  assert.deepEqual(prepared.audit.candidateDeferrals.selectionIds,[f.target.selectionId]);
  assert.deepEqual(prepared.audit.candidateDeferrals.failures,[]);
  assert.deepEqual(prepared.audit.cardEvidenceDeferrals.selectionIds,[]);
  const pending=prepared.sidecar.primaryAnalysis.receipts.find(row=>row.selectionId===f.target.selectionId);
  assert.equal(pending.state,'BLOCKED');assert.equal(pending.blocker.reason,'RESEARCH_INCOMPLETE');
  assert.match(pending.blocker.missing,/FORECAST_CAPTURE_OR_SOURCE_REJECTION_REQUIRED:synthetic-root-only-dimers-lead/);
  assert.equal(pending.candidateDraft.decision.status,'PASS','unissued original work stays in the audit');
  assert.equal(prepared.report.recs.length,1);
  assert.equal(prepared.report.recs[0].feed.side,'away','completed opposing assessment remains publishable');
  assert.equal(prepared.report.recs[0].status,'PASS');assert.equal(prepared.report.risk,0);
  assert.deepEqual(prepared.sidecar.forecastEvidence.followUpInputs.leads,[f.lead]);
  assert.doesNotThrow(()=>validateCandidateCompletion({root:f.root,report:prepared.report,sidecar:prepared.sidecar}));

  // The pinned snapshot must carry known work even if the mutable store later
  // omits it. A producer cannot restore an EVALUATED receipt and erase the lead.
  f.write(FORECAST_FOLLOW_UP_PATH,{schema:1,kind:'KNOWN_FORECAST_FOLLOW_UPS',leads:[]});
  assert.throws(()=>validateCandidateCompletion({root:f.root,...captured}),/FORECAST_CAPTURE_OR_SOURCE_REJECTION_REQUIRED/);
  assert.doesNotThrow(()=>validateCandidateCompletion({root:f.root,report:prepared.report,sidecar:prepared.sidecar}));
  assert.equal(JSON.stringify({report:f.report,sidecar:f.sidecar}),before,'no shared stage mutates original input bytes');
});
