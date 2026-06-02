#!/usr/bin/env node
// Rescue dump of FPL 2025/26 season data into datasets/fpl-2025-26/raw/.
// Resumable: skips any file that already exists and is non-empty.
//
// Usage:
//   node data/snapshot-fpl.mjs
//   node data/snapshot-fpl.mjs --season=2025-26
//   THROTTLE_MS=300 node data/snapshot-fpl.mjs
// Or via npm: npm run snapshot

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const SEASON = args.season || '2025-26';
const OUT_DIR = join(REPO_ROOT, 'datasets', `fpl-${SEASON}`, 'raw');
const FPL_BASE = 'https://fantasy.premierleague.com/api';
const THROTTLE_MS = Number(process.env.THROTTLE_MS || 200);
const UA = 'fplang snapshot/1.0 (+local data script)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exists(path) {
  try {
    const s = await stat(path);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function fetchJson(path, { attempt = 1 } = {}) {
  const url = `${FPL_BASE}${path}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 5) throw new Error(`${res.status} after ${attempt} tries: ${url}`);
    const backoff = 1000 * 2 ** attempt;
    console.warn(`  ${res.status} ${url} — backing off ${backoff}ms`);
    await sleep(backoff);
    return fetchJson(path, { attempt: attempt + 1 });
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

async function dump(relPath, fetchPath) {
  const outPath = join(OUT_DIR, relPath);
  if (await exists(outPath)) {
    return { relPath, status: 'skip' };
  }
  await mkdir(dirname(outPath), { recursive: true });
  const data = await fetchJson(fetchPath);
  await writeFile(outPath, JSON.stringify(data));
  await sleep(THROTTLE_MS);
  return { relPath, status: 'ok', bytes: JSON.stringify(data).length };
}

async function main() {
  console.log(`[snapshot] season=${SEASON} out=${OUT_DIR} throttle=${THROTTLE_MS}ms`);
  await mkdir(OUT_DIR, { recursive: true });

  const counts = {
    bootstrap: 0,
    fixtures: 0,
    setPiece: 0,
    eventLive: 0,
    dreamTeam: 0,
    elementSummary: 0,
    skipped: 0,
  };

  // 1) Bootstrap (drives the rest)
  console.log('[snapshot] bootstrap-static');
  const bootRes = await dump('bootstrap-static.json', '/bootstrap-static/');
  if (bootRes.status === 'ok') counts.bootstrap = 1;
  else counts.skipped++;
  const bootstrap = JSON.parse(
    await (await import('node:fs/promises')).readFile(
      join(OUT_DIR, 'bootstrap-static.json'),
      'utf8',
    ),
  );

  // 2) Fixtures
  console.log('[snapshot] fixtures');
  const fxRes = await dump('fixtures.json', '/fixtures/');
  if (fxRes.status === 'ok') counts.fixtures = 1;
  else counts.skipped++;

  // 3) Set-piece notes
  console.log('[snapshot] set-piece-notes');
  const spRes = await dump('set-piece-notes.json', '/team/set-piece-notes/');
  if (spRes.status === 'ok') counts.setPiece = 1;
  else counts.skipped++;

  // 4) Event live + dream team for every finished/current GW
  const events = bootstrap.events || [];
  const targetGws = events.filter((e) => e.finished || e.is_current).map((e) => e.id);
  console.log(`[snapshot] ${targetGws.length} gameweeks to capture (live + dream-team)`);
  for (const gw of targetGws) {
    const live = await dump(`event/${gw}/live.json`, `/event/${gw}/live/`);
    if (live.status === 'ok') counts.eventLive++;
    else counts.skipped++;

    const dream = await dump(`dream-team/${gw}.json`, `/dream-team/${gw}/`);
    if (dream.status === 'ok') counts.dreamTeam++;
    else counts.skipped++;
  }

  // 5) Per-player element-summary (the rescue priority)
  const players = bootstrap.elements || [];
  console.log(`[snapshot] ${players.length} players to capture (element-summary)`);
  let i = 0;
  for (const p of players) {
    i++;
    const res = await dump(`element-summary/${p.id}.json`, `/element-summary/${p.id}/`);
    if (res.status === 'ok') counts.elementSummary++;
    else counts.skipped++;
    if (i % 50 === 0) {
      console.log(`  player ${i}/${players.length} (${counts.elementSummary} fetched, ${counts.skipped} skipped)`);
    }
  }

  // 6) Manifest
  const manifest = {
    season: SEASON,
    capturedAt: new Date().toISOString(),
    counts,
    gameweeks: targetGws,
    players: players.length,
  };
  await writeFile(join(OUT_DIR, '_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('[snapshot] manifest written');
  console.log('[snapshot] done', counts);
}

main().catch((err) => {
  console.error('[snapshot] FAILED', err);
  process.exit(1);
});
