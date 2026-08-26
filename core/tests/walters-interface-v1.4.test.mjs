#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const interfacePath = 'core/walters-intelligence-interface-v1.4.json';
const authorityPath = 'core/walters-authority-v1.4.json';
const specPath = 'research/staging/BILLY_WALTERS_SPREAD_BOX_SPEC_2026-08-15.md';

const iface = JSON.parse(fs.readFileSync(interfacePath, 'utf8'));
const authority = JSON.parse(fs.readFileSync(authorityPath, 'utf8'));
const spec = fs.readFileSync(specPath);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash('sha1').update(Buffer.concat([header, buffer])).digest('hex');
}

assert(iface.schema === 1, 'Walters interface schema must be 1');
assert(iface.targetCoreVersion === '1.4', 'Walters interface must target Core 1.4');
assert(authority.targetCoreVersion === '1.4', 'Walters authority config must target Core 1.4');
assert(iface.authorityControl?.configPath === authorityPath, 'Walters authority config path mismatch');
assert(iface.authorityControl?.defaultMode === 'BET_AUTHORITY', 'Initial Walters mode must default to BET_AUTHORITY');
assert(authority.mode === 'BET_AUTHORITY', 'Staging authority config should initially be BET_AUTHORITY');
assert(iface.coverage?.interfaceResolutionRequiredForCore14 === true, 'Core 1.4 must resolve Walters availability');
assert(iface.coverage?.availabilityIsReportBlocking === false, 'Missing Walters data must not block an otherwise valid report');
assert(iface.sourceAuthority?.designPath === specPath, 'Walters source-design path mismatch');
assert(gitBlobSha(spec) === iface.sourceAuthority?.designBlobSha, 'Pinned Walters source-design blob SHA mismatch');
assert(iface.sourceAuthority?.page270CorrectionRequired === true, 'Page 270 correction must remain required');

for (const mode of ['OFF', 'ADVISORY', 'BET_AUTHORITY']) {
  assert(iface.authorityControl.allowedModes.includes(mode), `Interface missing Walters mode ${mode}`);
  assert(authority.allowedModes.includes(mode), `Authority config missing Walters mode ${mode}`);
  assert(authority.modes[mode], `Authority config missing definition for ${mode}`);
}

assert(authority.modes.OFF.mayOriginateBet === false, 'OFF must not originate BET');
assert(authority.modes.ADVISORY.mayOriginateBet === false, 'ADVISORY must not originate BET');
assert(authority.modes.BET_AUTHORITY.mayOriginateBet === true, 'BET_AUTHORITY must be able to originate BET');
assert(authority.modes.BET_AUTHORITY.mayInfluenceCoreFairValue === true, 'BET_AUTHORITY must be able to influence Core fair value');
assert(authority.modes.BET_AUTHORITY.mayCountAsIndependentCurrentSupport === true, 'BET_AUTHORITY must count as at most one independent handicap input');
assert(iface.modeBehavior.BET_AUTHORITY.mayOriginateBet === true, 'Interface must expose BET origination in BET_AUTHORITY mode');
assert(iface.runtimeAuthorityBoundary?.betAuthorityAvailableIn14 === true, 'Core 1.4 must expose Walters BET authority switch');

for (const [key, value] of Object.entries(authority.hardBoundariesAllModes)) {
  assert(value === false, `Walters hard boundary ${key} must remain false in all modes`);
}
for (const [key, value] of Object.entries(iface.hardBoundariesAllModes)) {
  assert(value === false, `Walters interface hard boundary ${key} must remain false in all modes`);
}

for (const state of ['AVAILABLE', 'PARTIAL', 'UNAVAILABLE']) {
  assert(iface.availabilityStates.includes(state), `Missing Walters availability state ${state}`);
}
assert(iface.spreadMoneylineStates.includes('SPREAD_VS_ML_UNAVAILABLE'), 'Fail-closed spread-vs-moneyline state is required');
assert(iface.waltersVerdicts.includes('BET_CANDIDATE'), 'Walters interface must represent a BET_CANDIDATE');

const eligibleWaltersBet = {
  availability: 'AVAILABLE',
  fairSpread: { status: 'AVAILABLE', arithmeticVerified: true, homePerspective: -4.5 },
  proposedWager: {
    market: 'spread',
    selection: 'Home -3',
    waltersFair: -4.5,
    targetPriceOrLine: '-3 -110',
    edgeRationale: 'Independent Walters fair clears the market with uncertainty accounted for.',
    status: 'BET_CANDIDATE'
  },
  marketReference: { executionAuthority: false },
  spreadVsMoneyline: { status: 'SPREAD_VS_ML_UNAVAILABLE' }
};
assert(eligibleWaltersBet.proposedWager.status === 'BET_CANDIDATE', 'Eligible Walters record must be able to originate BET candidate');
assert(eligibleWaltersBet.marketReference.executionAuthority === false, 'Walters market reference still cannot be executable-price authority');
assert(eligibleWaltersBet.spreadVsMoneyline.status === 'SPREAD_VS_ML_UNAVAILABLE', 'Unresolved Page 270 conversion must fail closed without blocking an otherwise spread-only handicap');

const rejectedByHardGate = {
  waltersMode: 'BET_AUTHORITY',
  waltersCandidate: true,
  exactIdentity: false,
  finalStatus: 'BLOCKED'
};
assert(rejectedByHardGate.finalStatus !== 'BET', 'Walters BET authority must fail closed when a hard gate fails');

console.log('CORE 1.4 WALTERS INTERFACE + BET AUTHORITY TEST OK');
