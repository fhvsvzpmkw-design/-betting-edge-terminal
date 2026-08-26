#!/usr/bin/env node
import fs from 'node:fs';

function assert(condition,message){if(!condition)throw new Error(message)}
function replaceOnce(text,from,to,label){
  const first=text.indexOf(from);
  assert(first>=0,`Missing release-state anchor: ${label}`);
  assert(text.indexOf(from,first+from.length)<0,`Non-unique release-state anchor: ${label}`);
  return text.slice(0,first)+to+text.slice(first+from.length);
}

// Public/version-boundary README.
{
  const file='README.md';
  let text=fs.readFileSync(file,'utf8');
  text=replaceOnce(text,
    'The underlying `runner-core.html` / `index.html` report engine/core remains **v1.3**. The authoritative governance contract is **Betting Edge Contract v1.0 OPERATIONAL**. The production Research Library is **v1.8 R3 live read-only**.',
    'The underlying Betting Edge report engine/core is now **Core v1.4 OPERATIONAL**, with `core/core-v1.4-production.json` as its production manifest and `runner-core.html` / `index.html` as the inner presentation/runtime shell. The authoritative governance contract remains **Betting Edge Contract v1.0 OPERATIONAL**. The production Research Library is **v1.8 R3 live read-only**. Walters launches in switchable **BET_AUTHORITY** mode for eligible NFL spread/moneyline work.',
    'README core version paragraph');
  text=replaceOnce(text,'- **Report engine/core:** v1.3','- **Report engine/core:** v1.4','README core version bullet');
  fs.writeFileSync(file,text,'utf8');
}

// Project-state checkpoint. Keep historical checkpoint references to v1.3 unchanged.
{
  const file='docs/PROJECT_STATE.md';
  let text=fs.readFileSync(file,'utf8');
  text=replaceOnce(text,
    '# Betting Edge — Project State\n\n**Last updated:** 2026-08-25 — Research Library v1.8 R3 promotion checkpoint',
    '# Betting Edge — Project State\n\n**Last updated:** 2026-08-25 — Core 1.4 production integration checkpoint',
    'Project State heading');
  text=replaceOnce(text,
    '- **Current Contract v1.0 blob:** `8bb1756a573d50d03ef99cd24eedb228d08d7632`.',
    '- **Current Contract v1.0 blob:** `0951371364e8e888af6007da9865a84d3ffe113c`.',
    'Project State Contract blob');
  text=replaceOnce(text,
    '- **Report engine/core:** `runner-core.html` + `index.html` — **v1.3**, unchanged by the v1.0/v1.5 promotion and v1.8 Research Library promotion.',
    '- **Report engine/core:** **Core v1.4 OPERATIONAL** — production authority `core/core-v1.4-production.json`; `runner-core.html` + `index.html` remain the inner UI/runtime shell.',
    'Project State current core');
  text=replaceOnce(text,
    '- **Report provenance:** schema **3**; new reports record Contract v1.0 provenance and active Research Library version, historical sidecars remain immutable.',
    '- **Report provenance:** schema **3**; post-Core-1.4 reports additionally record Core production/framework SHAs, model-error assessment, Walters interface/authority SHAs and runtime mode; historical sidecars remain immutable.',
    'Project State provenance');
  text=replaceOnce(text,
    '- **Betting Edge core v1.3**;',
    '- **Betting Edge Core v1.4 OPERATIONAL** with the current Core production/framework provenance resolved before handicapping;',
    'Project State automation core requirement');
  text=replaceOnce(text,
    '- **R-track:** R3 — live read-only Research Fit using production Research Library v1.8.\n- **H-track:** H3 — live immutable issued-report/provenance history.',
    '- **R-track:** R3 — live read-only Research Fit using production Research Library v1.8.\n- **Core track:** v1.4 operational — explicit fair-value basis/model-error framework with Walters runtime authority switch currently at BET_AUTHORITY.\n- **H-track:** H3 — live immutable issued-report/provenance history.',
    'Project State governance tracks');
  const researchCheckpoint='### 2026-08-25 — Research Library v1.8 R3 promotion\n\nThe previously tested 120-item v1.8 candidate was reopened after sufficient v1.7 live-production soak. A focused R3 gap-closure pass added 10 logical items, 8 sources and 4 evidence clusters, producing the active 130-item / 108-source / 30-cluster v1.8 library. Validation passed all ID, source, cluster, market-boundary and R3 hard-boundary checks. The active manifest was switched to v1.8 without changing core v1.3, Contract v1.0, supported books, staking/risk rules, report lanes or Odds-API budget.';
  const coreCheckpoint=researchCheckpoint+'\n\n### 2026-08-25 — Core 1.4 production integration\n\nCore 1.4 was activated forward-only at `2026-08-25T17:20:00-07:00`. It consolidates the proven 1.3 handicap foundation with explicit fair-value-basis/model-error states, fixed Research Library v1.8 uncertainty graduation, Stage 2 personnel sensitivity, WAIT discipline and switchable Walters authority. Walters launches at `BET_AUTHORITY` and may originate eligible NFL spread/moneyline candidates, but cannot bypass identity, freshness, personnel, price-quality/model-error, playTo, exposure or staking gates. Post-cutover sidecars require structured `coreAssessment` and `waltersEvidence`; the publication verification recomputes Core 1.4 model error. Results/CLV learning, Shadow History, learned associations and personal-ledger calibration remain deliberately deferred. Supported books, staking, report schedules and Odds-API budget are unchanged.';
  text=replaceOnce(text,researchCheckpoint,coreCheckpoint,'Project State Core 1.4 checkpoint');
  fs.writeFileSync(file,text,'utf8');
}

// Inner runtime labels only. Preserve runnerHistory.v1.3 localStorage key intentionally so saved history survives.
{
  const file='index.html';
  let text=fs.readFileSync(file,'utf8');
  text=replaceOnce(text,'<title>VigScope Terminal UI v1.3</title>','<title>VigScope Core v1.4</title>','index title');
  text=replaceOnce(text,'<div class="title">VIGSCOPE TERMINAL UI v1.3</div>','<div class="title">VIGSCOPE CORE v1.4</div>','index visible core label');
  text=replaceOnce(text,'<div class="sectiontitle">v1.3 RUN ARCHIVE // FIVE DAILY SNAPSHOTS</div>','<div class="sectiontitle">CORE v1.4 RUN ARCHIVE // FIVE DAILY SNAPSHOTS</div>','index archive label');
  text=replaceOnce(text,'<div class="sectiontitle">v1.3 SOURCE MONITOR // FREE STACK</div>','<div class="sectiontitle">CORE v1.4 SOURCE MONITOR // FREE STACK</div>','index source monitor label');
  fs.writeFileSync(file,text,'utf8');
}
{
  const file='runner-core.html';
  let text=fs.readFileSync(file,'utf8');
  text=replaceOnce(text,'<title>VigScope Terminal UI v1.3 Runner</title>','<title>VigScope Core v1.4 Runner</title>','runner-core title');
  text=replaceOnce(text,'<iframe id="app" title="VigScope Terminal UI v1.3"></iframe>','<iframe id="app" title="VigScope Core v1.4"></iframe>','runner-core iframe title');
  assert(text.includes("const HISTORY_KEY='bettingEdge.runnerHistory.v1.3';"),'Runner history localStorage key must remain v1.3 for continuity');
  fs.writeFileSync(file,text,'utf8');
}

console.log('CORE 1.4 RELEASE STATE SYNC OK');
