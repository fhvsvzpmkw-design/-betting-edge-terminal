import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {FORECAST_FOLLOW_UP_FROM, FORECAST_FOLLOW_UP_PATH, loadForecastFollowUps, bindForecastFollowUps} from '../tools/forecast-follow-ups.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forecast-follow-ups-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const report = {ts:'2026-10-22T17:00:00-07:00'}, sidecar = {forecastEvidence:{schema:1,records:[],attempts:[],revalidations:[]}};
  const lead = {leadId:'synthetic-dimers-home', sport:'NHL', eventId:'synthetic', startTime:'2026-10-23T02:00:00Z',
    marketDetail:'full_game_moneyline', period:'FULL_GAME', side:'home', line:null, sourceId:'dimers',
    url:'https://www.dimers.com/nhl/predictions', observedAt:'2026-10-22T18:23:37Z', createdAt:'2026-10-22T23:55:00Z',
    probability:.514, finding:'Synthetic earlier exact-team win point; requires current applicability review.',
    originPath:'docs/reviews/synthetic-source-follow-up.json'};
  const universe = {selections:[{selectionId:'NHL|synthetic|full_game_moneyline|home',sport:'NHL',eventId:'synthetic',
    eventDate:lead.startTime,marketDetail:lead.marketDetail,side:'home',quotes:[{line:null,priceDecimal:1.95}]}]};
  const registry = {sources:{dimers:{routes:['https://www.dimers.com/{sport}/predictions']}}};
  const write = leads => {
    const file = path.join(root, FORECAST_FOLLOW_UP_PATH);
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, JSON.stringify({schema:1,kind:'KNOWN_FORECAST_FOLLOW_UPS',leads},null,2)+'\n');
  };
  return {root,report,sidecar,lead,universe,registry,write};
}

test('root-known lead survives an omitted report capture and pins original clocks without creating a forecast', t => {
  const f=fixture(t);f.write([f.lead]);
  const before=JSON.stringify(f.sidecar), loaded=loadForecastFollowUps(f);
  assert.equal(JSON.stringify(f.sidecar),before);assert.equal(loaded.leads.length,1);
  assert.deepEqual(loaded.leads[0],f.lead);assert.equal(loaded.binding.blobSha.length,40);
  const bound=bindForecastFollowUps(f);
  assert.deepEqual(f.sidecar.forecastEvidence.followUpInputs,bound.binding);
  assert.deepEqual(f.sidecar.forecastEvidence.records,[]);assert.deepEqual(f.sidecar.forecastEvidence.attempts,[]);
  assert.deepEqual(loadForecastFollowUps(f).leads,[f.lead]);
});

test('exact sport, event, start, market and side identity determine operative follow-up scope', t => {
  const f=fixture(t);f.write([f.lead]);
  for(const change of [{sport:'NFL'},{eventId:'other'},{eventDate:'2026-10-23T02:01:00Z'},
    {marketDetail:'full_game_primary_total'},{side:'away'}]) {
    const universe=structuredClone(f.universe);Object.assign(universe.selections[0],change);
    assert.equal(loadForecastFollowUps({...f,universe}).leads.length,0);
  }
  assert.equal(loadForecastFollowUps({...f,universe:null}).leads.length,0);
});

test('future observations or entry times and started events do not retroactively affect a report', t => {
  const f=fixture(t);
  for(const change of [{observedAt:'2026-10-23T00:30:00Z',createdAt:'2026-10-23T00:31:00Z'},
    {createdAt:'2026-10-23T00:30:00Z'}]) {
    f.write([{...f.lead,...change}]);assert.equal(loadForecastFollowUps(f).leads.length,0);
  }
  const expired={...f.lead,startTime:'2026-10-22T23:30:00Z',createdAt:'2026-10-22T23:45:00Z'};
  f.write([expired]);assert.equal(loadForecastFollowUps(f).leads.length,0);
  f.report.ts='2026-10-22T16:49:59-07:00';
  fs.writeFileSync(path.join(f.root,FORECAST_FOLLOW_UP_PATH),'invalid JSON');
  assert.deepEqual(loadForecastFollowUps(f),{active:false,leads:[],binding:null});
  assert.equal(FORECAST_FOLLOW_UP_FROM,'2026-10-22T16:50:00-07:00');
});

test('bound leads persist when current inputs omit them and current known additions cannot be hidden by an older pin', t => {
  const f=fixture(t);f.write([f.lead]);bindForecastFollowUps(f);
  f.write([]);assert.deepEqual(loadForecastFollowUps(f).leads,[f.lead]);
  const next={...f.lead,leadId:'synthetic-second-original-lead',probability:.52};
  f.write([next]);assert.equal(loadForecastFollowUps(f).leads.length,2);
  f.sidecar.forecastEvidence.followUpInputs.leads[0].probability=.99;
  assert.throws(()=>loadForecastFollowUps(f),/snapshot is malformed or changed/);
});

test('sidecar and prior follow-up union is immutable and rejects conflicting IDs', t => {
  const f=fixture(t);f.sidecar.forecastEvidence.followUps=[f.lead];
  const prior={...f.lead,leadId:'synthetic-prior',probability:.53};
  const before=JSON.stringify({sidecar:f.sidecar,prior});
  assert.equal(loadForecastFollowUps({...f,priorFollowUps:[prior]}).leads.length,2);
  assert.equal(JSON.stringify({sidecar:f.sidecar,prior}),before);
  assert.throws(()=>loadForecastFollowUps({...f,priorFollowUps:[{...f.lead,probability:.99}]}),/conflicting immutable leadId/);
});

test('malformed active source data fails explicitly while an absent queue does not block unrelated reports', t => {
  const f=fixture(t);
  const absent=loadForecastFollowUps({...f,registry:undefined});
  assert.equal(absent.active,true);assert.equal(absent.leads.length,0);assert.equal(absent.binding.blobSha,null);
  for(const change of [{sourceId:'unregistered'},{url:'https://dimers.com.evil.example/nhl'},
    {url:'https://user@www.dimers.com/nhl'},{probability:51.4},{originPath:'../outside.json'},
    {createdAt:'2026-10-22T18:20:00Z'},{period:'FIRST_PERIOD'}]) {
    f.write([{...f.lead,...change}]);assert.throws(()=>loadForecastFollowUps(f),/Forecast follow-up:/);
  }
  fs.writeFileSync(path.join(f.root,FORECAST_FOLLOW_UP_PATH),'{}');
  assert.throws(()=>loadForecastFollowUps(f),/known-lead store requires/);
});

test('selected-side handicap is matched without leaking a different line', t => {
  const f=fixture(t),lead={...f.lead,side:'away',marketDetail:'full_game_primary_puck_line',line:1.5};
  f.write([lead]);
  Object.assign(f.universe.selections[0],{side:'away',marketDetail:lead.marketDetail,quotes:[{line:-1.5}]});
  assert.equal(loadForecastFollowUps(f).leads.length,1);
  f.universe.selections[0].quotes[0].line=-2.5;
  assert.equal(loadForecastFollowUps(f).leads.length,0);
});
