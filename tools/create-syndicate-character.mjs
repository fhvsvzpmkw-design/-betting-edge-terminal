#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POOLS_PATH = path.join(ROOT, 'data/characters/trait-pools.json');
const TEMPLATE_PATH = path.join(ROOT, 'syndicates/_templates/blank-hotline.html');
const SHELL_TEMPLATE_PATH = path.join(ROOT, 'syndicates/_templates/blank-shell.html');
const MANIFEST_PATH = path.join(ROOT, 'data/syndicates.json');
const SHELL_MANIFEST_PATH = path.join(ROOT, 'data/hotline-shells.json');

function args(argv) {
  const out = { dryRun: false, seed: null, name: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--seed') out.seed = Number(argv[++i]);
    else if (a === '--name') out.name = String(argv[++i] || '').trim() || null;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function rngFromSeed(seed) {
  if (seed == null || !Number.isFinite(seed)) return Math.random;
  let s = (Math.trunc(seed) >>> 0) || 1;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, rnd) {
  if (!Array.isArray(list) || !list.length) throw new Error('Trait pool is empty');
  return list[Math.floor(rnd() * list.length)];
}

function pickDistinct(list, count, rnd) {
  const copy = [...list];
  const out = [];
  while (copy.length && out.length < count) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
  return out;
}

function slugify(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'new-character';
}

function uniqueSlug(base, manifest) {
  const used = new Set((manifest.profiles || []).map(p => String(p.id)));
  let id = base;
  let n = 2;
  while (used.has(id) || fs.existsSync(path.join(ROOT, `data/characters/${id}.json`))) id = `${base}-${n++}`;
  return id;
}

function publicationName(displayName, theme, rnd) {
  const surname = displayName.trim().split(/\s+/).at(-1).toUpperCase();
  const options = [
    `${surname} NUMBERS`,
    `${surname}'S PRIVATE LINE`,
    `THE ${surname} SHEET`,
    `${surname} SPORTS WIRE`,
    `${surname}'S HOTLINE`,
    `THE ${surname} BOARD`
  ];
  if (/radio/i.test(theme)) options.push(`${surname} AFTER DARK`);
  if (/newspaper|hotel/i.test(theme)) options.push(`THE ${surname} SPORTS DESK`);
  return pick(options, rnd);
}

function buildProfile({ id, displayName, nickname, publication, pools, rnd, now, shellId, shellRel }) {
  const primary = pickDistinct(pools.primaryFocus, 3, rnd);
  const secondary = pickDistinct(pools.secondaryFocus, 2, rnd);
  const tone = pick(pools.voiceToneSets, rnd);
  const visualTheme = pick(pools.visualThemes, rnd);
  const era = pick(pools.eras, rnd);
  return {
    schema: 1,
    id,
    profileId: id,
    displayName: displayName.toUpperCase(),
    nickname,
    publication,
    editable: true,
    updatedAt: now,
    identity: {
      role: pick(pools.roles, rnd),
      corePromise: pick(pools.corePromises, rnd)
    },
    voice: {
      tone,
      humor: pick(pools.humor, rnd),
      slang: pick(pools.slang, rnd),
      verbosity: pick(pools.verbosity, rnd),
      seriousness: 3 + Math.floor(rnd() * 8),
      catchphraseStyle: `Short recurring lines shaped by ${tone.join(', ')} delivery and the character's current desk setting.`
    },
    hotlineStyle: {
      visualTheme,
      era,
      layoutStyle: pick(pools.layoutStyles, rnd),
      headlineStyle: pick(pools.headlineStyles, rnd),
      informationDensity: pick(pools.informationDensity, rnd),
      signatureSections: pick(pools.signatureSectionSets, rnd),
      shell: {
        id: shellId,
        version: 1,
        status: 'editable',
        path: shellRel,
        portable: true
      }
    },
    editorial: {
      primaryFocus: primary,
      secondaryFocus: secondary,
      reactionToBet: 'Treat a qualifying BET as earned action. Preserve the exact price, reason, buying limit and stake.',
      reactionToLean: 'Show the interesting disagreement while keeping the missing margin or confirmation obvious.',
      reactionToWait: 'Explain the exact fresh price, identity, lineup or information still required before action.',
      reactionToPass: 'Treat PASS as a useful decision and explain why the offered transaction did not qualify.'
    },
    continuity: {
      mode: 'rolling Hotline publication',
      track: ['prior report price', 'current price', 'status changes', 'recurring candidates', 'character-specific ongoing threads'],
      currentMood: 'New character. No report loaded.',
      ongoingThreads: [],
      lastReportSeen: null,
      stateRule: 'Advance only when this character is deliberately updated to an authoritative issued Betting Edge report.'
    },
    guardrails: {
      bettingAuthority: 'Presentation only. Betting Edge issued report remains authoritative.',
      preserveStatuses: true,
      preservePrices: true,
      preserveRisk: true,
      mayAddFictionalFlavor: true,
      fictionMustNotBecomeEvidence: true
    }
  };
}

function replaceTokens(template, replacements) {
  return Object.entries(replacements).reduce((html, [token, value]) => html.split(token).join(String(value)), template);
}

function renderHotline(template, profile, accent) {
  return replaceTokens(template, {
    '{{DISPLAY_NAME}}': profile.displayName,
    '{{PUBLICATION}}': profile.publication,
    '{{ACCENT}}': accent,
    '{{VOICE}}': `${profile.voice.tone.join(', ')}; ${profile.voice.humor}`,
    '{{THEME}}': `${profile.hotlineStyle.visualTheme}; ${profile.hotlineStyle.era}`,
    '{{FOCUS}}': profile.editorial.primaryFocus.join(' / ')
  });
}

function renderShell(template, profile, accent, shellId) {
  return replaceTokens(template, {
    '{{SHELL_ID}}': shellId,
    '{{DISPLAY_NAME}}': profile.displayName,
    '{{PUBLICATION}}': profile.publication,
    '{{ACCENT}}': accent,
    '{{THEME}}': `${profile.hotlineStyle.visualTheme}; ${profile.hotlineStyle.era}`
  });
}

const opt = args(process.argv.slice(2));
const rnd = rngFromSeed(opt.seed);
const pools = JSON.parse(fs.readFileSync(POOLS_PATH, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const shellManifest = JSON.parse(fs.readFileSync(SHELL_MANIFEST_PATH, 'utf8'));
const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
const shellTemplate = fs.readFileSync(SHELL_TEMPLATE_PATH, 'utf8');

const generatedName = `${pick(pools.firstNames, rnd)} ${pick(pools.lastNames, rnd)}`;
const displayName = opt.name || generatedName;
const id = uniqueSlug(slugify(displayName), manifest);
const nickname = pick(pools.nicknames, rnd);
const now = new Date().toISOString();
const visualPreview = pick(pools.visualThemes, rnd);
const publication = publicationName(displayName, visualPreview, rnd);
const accent = pick(pools.accentColors, rnd);
const hotlineRel = `./syndicates/generated/${id}/hotline.html`;
const shellRel = `./syndicates/generated/${id}/shell.html`;
const profileRel = `./data/characters/${id}.json`;
const shellId = `${id}-default`;
const profile = buildProfile({ id, displayName, nickname, publication, pools, rnd, now, shellId, shellRel });
profile.hotlineStyle.visualTheme = visualPreview;

const rosterEntry = {
  id,
  name: profile.displayName,
  title: `${profile.publication} // CHARACTER BANK`,
  status: 'READY',
  fallback: '👤',
  headshot: null,
  headshotAlt: `Temporary avatar placeholder for ${profile.displayName}`,
  headshotPosition: '50% 30%',
  accent,
  enabled: true,
  characterId: id,
  characterFile: profileRel,
  url: hotlineRel
};

const shellEntry = {
  id: shellId,
  version: 1,
  name: `${profile.publication} DEFAULT`,
  description: `Generated editable v1 Hotline shell for ${profile.displayName}.`,
  characterId: id,
  defaultForCharacter: true,
  path: shellRel,
  liveUrl: hotlineRel,
  preview: null,
  status: 'editable',
  portable: true,
  installable: true,
  author: { type: 'generated', name: 'Syndicate Character Factory' },
  compatibility: {
    characterProfileSchema: 1,
    contentZoneSchema: 1,
    requiredZones: ['masthead', 'issue-meta', 'report-summary', 'recommendations', 'character-voice', 'footer']
  }
};

const hotline = renderHotline(template, profile, accent);
const shell = renderShell(shellTemplate, profile, accent, shellId);
const result = { id, profile, rosterEntry, shellEntry, hotlinePath: hotlineRel, shellPath: shellRel, profilePath: profileRel };

if (opt.dryRun) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
}

const profileAbs = path.join(ROOT, profileRel.replace(/^\.\//, ''));
const hotlineAbs = path.join(ROOT, hotlineRel.replace(/^\.\//, ''));
const shellAbs = path.join(ROOT, shellRel.replace(/^\.\//, ''));
fs.mkdirSync(path.dirname(profileAbs), { recursive: true });
fs.mkdirSync(path.dirname(hotlineAbs), { recursive: true });
fs.writeFileSync(profileAbs, `${JSON.stringify(profile, null, 2)}\n`);
fs.writeFileSync(hotlineAbs, hotline);
fs.writeFileSync(shellAbs, shell);

manifest.profiles = Array.isArray(manifest.profiles) ? manifest.profiles : [];
manifest.profiles.push(rosterEntry);
manifest.updatedAt = now;
fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

shellManifest.shells = Array.isArray(shellManifest.shells) ? shellManifest.shells : [];
shellManifest.shells.push(shellEntry);
shellManifest.updatedAt = now;
fs.writeFileSync(SHELL_MANIFEST_PATH, `${JSON.stringify(shellManifest, null, 2)}\n`);

process.stdout.write(`Created ${profile.displayName} (${id})\n`);
process.stdout.write(`Profile: ${profileRel}\n`);
process.stdout.write(`Hotline: ${hotlineRel}\n`);
process.stdout.write(`Shell: ${shellRel} (${shellId} v1 EDITABLE)\n`);
process.stdout.write('Avatar: 👤 placeholder; headshot null\n');
process.stdout.write('Default F1-F4 slot assignments were not changed.\n');
