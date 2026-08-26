#!/usr/bin/env node
import fs from 'node:fs';

function assert(condition,message){if(!condition) throw new Error(message)}
function replaceOnce(text,from,to,label){
  assert(text.includes(from),`Promotion patch anchor missing: ${label}`);
  const first=text.indexOf(from);
  assert(text.indexOf(from,first+from.length)===-1,`Promotion patch anchor is not unique: ${label}`);
  return text.slice(0,first)+to+text.slice(first+from.length);
}

const contractPath='BETTING_EDGE_CONTRACT.md';
let contract=fs.readFileSync(contractPath,'utf8');

contract=replaceOnce(
  contract,
  '**Validated runner family:** VigScope outer runner v1.5 / Betting Edge core runner v1.3',
  '**Validated runner family:** VigScope outer runner v1.5 / Betting Edge core runner v1.4',
  'validated core family'
);

const preflightAnchor='If steps 1-4 cannot be completed or authority conflicts, stop with:';
const preflightInsert=`For report timestamps at or after **2026-08-25 17:20:00 America/Vancouver**, production preflight must additionally resolve \`core/core-v1.4-production.json\`, verify \`coreVersion: "1.4"\` and \`state: "OPERATIONAL"\`, retain its exact Git blob SHA, resolve its pinned model-error framework and Walters interface, and resolve the current \`core/walters-authority-v1.4.json\` runtime mode before handicapping. The current Walters authority blob SHA and mode must be retained for report provenance. A Core 1.4 authority conflict is a preflight failure. Governance Contract v1.0 and Core version 1.4 are independent version tracks.\n\n`;
assert(!contract.includes('core/core-v1.4-production.json`'), 'Core 1.4 preflight already appears to be promoted');
contract=replaceOnce(contract,preflightAnchor,preflightInsert+preflightAnchor,'Core 1.4 preflight insertion');

contract=replaceOnce(
  contract,
  'Current approved library at activation: **1.7**.',
  'Current approved production library: **1.8** (R3 live read-only).',
  'Research Library active version'
);

const section8='---\n\n# 8. Invariants 9-22 — durable history and delivery are operational';
const core14Section=`---\n\n## 7.1 Core 1.4 — operational handicap/model-error and Walters authority\n\nCore 1.4 is operational for report timestamps at or after **2026-08-25T17:20:00-07:00**. Earlier issued reports remain immutable Core 1.3 historical evidence. The authoritative Core 1.4 manifest is \`core/core-v1.4-production.json\`.\n\nEvery Core 1.4 serious candidate must carry a structured Core assessment in the durable sidecar. The production model-error framework classifies the fair-value basis, supported-book dispersion, liquidity risk, tail risk, exact-market calibration, personnel sensitivity and independent current support, then assigns \`STANDARD\`, \`ELEVATED\`, \`HIGH\` or \`UNQUANTIFIED\`. The production publication gate recomputes this state from the recorded inputs. A \`BET\` is prohibited when that recomputation says the candidate is not eligible by the Core 1.4 model-error layer.\n\nResearch Library v1.8 remains read-only and may not itself create a BET or directly move the fair-value point estimate. Core 1.4 may use only the fixed graduated allowlist in its operational model-error framework, and those approved findings may **raise** the model-error floor or prevent false precision; they may not lower the floor, manufacture independent current support or set stake. The set of applicable graduated research IDs is derived from the Core context and may not be selectively omitted to evade an uncertainty rule.\n\nBilly Walters-derived handicapping is a separate Core 1.4 specialist engine, not a Research Library vote. Runtime authority is controlled by \`core/walters-authority-v1.4.json\` and may be switched forward-only without re-versioning Core 1.4:\n\n- \`OFF\` — Walters is not used for current handicapping;\n- \`ADVISORY\` — Walters may be compared with the Core and trigger review but may not originate a recommendation;\n- \`BET_AUTHORITY\` — an eligible, current, arithmetic-verified Walters handicap may originate an exact NFL spread or moneyline BET candidate and may stand as/contribute an independent fair-value input.\n\nCore 1.4 activates with Walters in **\`BET_AUTHORITY\`**. Walters BET authority is handicap/recommendation authority only. It may not override exact identity, feed freshness, executable-quote freshness, personnel requirements, price-quality/model-error boundaries, exposure controls or final staking policy; it may not supply a fabricated executable price or rewrite issued history. Walters-created candidates must record their Walters fair, source timing, exact proposed market/selection and rationale. Missing or unavailable Walters data does not block an otherwise valid report.\n\nCore 1.4 consciously does **not** activate the Results/CLV feedback learning loop, Shadow History, learned player/team associations or personal-ledger calibration. Those remain later tracks and are not prerequisites for Core 1.4.\n\n# 8. Invariants 9-22 — durable history and delivery are operational`;
contract=replaceOnce(contract,section8,core14Section,'Core 1.4 operational section');

contract=replaceOnce(
  contract,
  '- **R-track: R3 — LIVE READ-ONLY HISTORY FIT.** Production Research Library remains v1.7 and read-only; this contract promotion does not promote the staged v1.8 candidate.',
  '- **R-track: R3 — LIVE READ-ONLY HISTORY FIT.** Production Research Library is v1.8 and read-only. Core 1.4 may consume only its fixed graduated model-error allowlist under Section 7.1; normal History Fit remains non-authoritative for BET creation.',
  'activation track research version'
);

const bottomAnchor='The associated v1.5 runner change is a version-boundary declaration for already-deployed presentation work; it does not change the v1.3 report engine/core.';
contract=replaceOnce(
  contract,
  bottomAnchor,
  'The VigScope v1.5 runner remains the presentation shell. Core 1.4 is the operational report-engine/handicap version for post-cutover reports and is versioned independently from the runner and Governance Contract.',
  'bottom version boundary'
);

const gitHistoryAnchor='Git history is the authoritative rollback system.';
const changeRecord=`### Operational change record — 2026-08-25 — Core 1.4 production integration\n\n**Decision:** Promote the tested Core 1.4 model-error framework and production manifest at 17:20 PT; require structured Core assessment and machine recomputation during publication; keep Research Library v1.8 one-way for model-error only; activate the Walters runtime authority switch in \`BET_AUTHORITY\` so an eligible Walters handicap may originate a BET candidate while preserving all hard execution/staking gates.\n\n**Intentionally deferred:** Results/CLV feedback learning, Shadow History, learned player/team associations and personal-ledger calibration.\n\n**Intentionally unchanged:** Bet365/DraftKings execution boundary; 75-minute feed freshness; 30-minute executable-quote freshness; staking/exposure methodology; scheduled report lanes; odds/API request budget; issued-report immutability.\n\n`;
contract=replaceOnce(contract,gitHistoryAnchor,changeRecord+gitHistoryAnchor,'Core 1.4 operational change record');

fs.writeFileSync(contractPath,contract,'utf8');

const schemaPath='data/history/report-provenance-schema.json';
const schema=JSON.parse(fs.readFileSync(schemaPath,'utf8'));
schema.purpose='Durable research/Core/provenance sidecar for an issued Betting Edge report. The sidecar enriches immutable history, records production contract and Core authority used at issuance, and retains structured Core 1.4 model-error, Walters, personnel-sweep and WAIT-qualification evidence where applicable.';
schema.compatibility.rule='Schema-2 and previously issued schema-3 sidecars remain valid immutable historical evidence. Stage 2, WAIT qualification, Core 1.4 coreAssessment and waltersEvidence are additive forward-only extensions and do not require rewriting historical sidecars.';
Object.assign(schema.provenance.fields,{
  coreVersion:'string; required for reports at/after the Core 1.4 cutover and currently 1.4',
  coreProductionPath:'string; required for Core 1.4 and currently core/core-v1.4-production.json',
  coreProductionBlobSha:'exact Git blob SHA of the operational Core 1.4 production manifest resolved before handicapping',
  coreFrameworkPath:'string; operational Core 1.4 model-error framework path',
  coreFrameworkBlobSha:'exact Git blob SHA of the Core 1.4 model-error framework used for the report',
  waltersInterfacePath:'string; operational Walters Core 1.4 interface path',
  waltersInterfaceBlobSha:'exact Git blob SHA of the Walters interface used for the report',
  waltersAuthorityPath:'string; runtime Walters authority config path',
  waltersAuthorityBlobSha:'exact Git blob SHA of the Walters authority config resolved for the report',
  waltersMode:'OFF|ADVISORY|BET_AUTHORITY; exact Walters mode resolved before handicapping'
});
schema.provenance.productionRule += ' For report timestamps at/after 2026-08-25T17:20:00-07:00, sidecars must additionally record Core 1.4 production/framework provenance, Research Library v1.8 provenance, and exact Walters interface/authority blob SHA plus active Walters mode.';
schema.recommendations.coreAssessment={
  requiredWhen:'Every recommendation in a report at/after the Core 1.4 cutover.',
  fields:{
    frameworkId:'must match the operational Core 1.4 framework ID',
    context:'structured fairValueBasis, bookDispersion, liquidityRisk, tailRisk, directCalibration, personnelSensitivity, independentCurrentSupport, sport/market/timing, movement flags and automatically applicable graduatedResearchIds',
    fairValueBasisRationale:'why the fair is independent, market-anchored, market-derived-only or unavailable',
    uncertaintyStatement:'candidate-specific uncertainty/model-error statement',
    modelErrorState:'STANDARD|ELEVATED|HIGH|UNQUANTIFIED',
    betEligibleByModelError:'boolean recomputed by the production Core 1.4 gate',
    effects:'array of framework effects',
    appliedRules:'array of applied base/research rules',
    reasons:'array of framework reasons',
    rationale:'concise decision interpretation'
  },
  rule:'The production gate recomputes modelErrorState and bet eligibility from the context and rejects forged/omitted applicable research rules. A BET may not publish when Core 1.4 recomputation blocks it.'
};
schema.recommendations.waltersEvidence={
  requiredWhen:'Every recommendation in a report at/after the Core 1.4 cutover; non-eligible markets record NOT_APPLICABLE. Eligible NFL spread/moneyline candidates resolve Walters availability whenever Walters mode is not OFF.',
  fields:{
    applicable:'boolean',mode:'OFF|ADVISORY|BET_AUTHORITY',availability:'AVAILABLE|PARTIAL|UNAVAILABLE|OFF|NOT_APPLICABLE',originatedCandidate:'boolean',contribution:'NONE|ADVISORY_ONLY|CORE_FAIR_INPUT|BET_ORIGINATOR',waltersFair:'number|string|null',coreFairBeforeWalters:'number|string|null',coreFairAfterWalters:'number|string|null',comparisonState:'ALIGNED|MIXED|CONFLICT|NOT_COMPARABLE|UNAVAILABLE|OFF',reviewImpact:'concise effect on review',betRationale:'required for Walters-originated candidate',proposedMarket:'required for Walters-originated candidate',proposedSelection:'required for Walters-originated candidate',sourceAsOf:'required timestamp for Walters-originated candidate',generatedAt:'required timestamp for Walters-originated candidate'
  },
  rule:'BET_AUTHORITY may originate an eligible NFL spread/moneyline candidate, but the final recommendation must still pass Core 1.4 model-error and all normal Betting Edge hard gates. Walters is at most one independent handicap input.'
};
Object.assign(schema.boundaries,{
  researchMayRaiseModelErrorFloorThroughCore14Allowlist:true,
  researchMayLowerModelErrorFloor:false,
  waltersMayOriginateBetWhenBetAuthority:true,
  waltersMayContributeIndependentFairWhenBetAuthority:true,
  waltersMayOverrideIdentityFreshnessPersonnelPriceExposureOrStaking:false
});
fs.writeFileSync(schemaPath,JSON.stringify(schema,null,2)+'\n','utf8');

console.log('CORE 1.4 CONTRACT + PROVENANCE PROMOTION PATCH OK');
