/**
 * build-field-dictionary.ts
 *
 * Generates two artifacts from the combined FPL + football-data field catalogs:
 *   docs/field-dictionary.json  — machine-readable full field list
 *   docs/14-field-dictionary.md — human-readable table + opportunities
 *
 * Usage:
 *   npx tsx scripts/build-field-dictionary.ts
 *   npm run gen:dictionary
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FieldDef } from '../src/types.js';
import { FPL_FIELDS } from '../src/catalog/fields.js';
import {
  FD_PLAYER_FIELDS,
  FD_TEAM_FIELDS,
  FD_PRIOR_FIELDS,
} from '../football-data-planning/fields.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Types ─────────────────────────────────────────────────────────────────────

type EntityLevel = 'player' | 'team-broadcast' | 'transfer-prior';
type Status = 'live' | 'proposed';

interface DictionaryEntry extends FieldDef {
  status: Status;
  entityLevel: EntityLevel;
}

// ── Build entries ─────────────────────────────────────────────────────────────

const fplEntries: DictionaryEntry[] = FPL_FIELDS.map(f => ({
  ...f,
  status: 'live',
  entityLevel: 'player',
}));

const fdPlayerEntries: DictionaryEntry[] = FD_PLAYER_FIELDS.map(f => ({
  ...f,
  status: 'proposed',
  entityLevel: 'player',
}));

const fdTeamEntries: DictionaryEntry[] = FD_TEAM_FIELDS.map(f => ({
  ...f,
  status: 'proposed',
  entityLevel: 'team-broadcast',
}));

const fdPriorEntries: DictionaryEntry[] = FD_PRIOR_FIELDS.map(f => ({
  ...f,
  status: 'proposed',
  entityLevel: 'transfer-prior',
}));

const ALL: DictionaryEntry[] = [
  ...fplEntries,
  ...fdPlayerEntries,
  ...fdTeamEntries,
  ...fdPriorEntries,
];

// ── Safety assertions ─────────────────────────────────────────────────────────

const VALID_NAME = /^[a-z][a-z0-9_]*$/;
// 'id' is the join-key column — allowed as a field name (see validate.ts comment).
// Only function names, constants, 'series', and 'source' are truly reserved.
const RESERVED = new Set(['series', 'source']);

for (const e of ALL) {
  if (!VALID_NAME.test(e.name)) {
    throw new Error(`Invalid field name: '${e.name}' (source: ${e.source})`);
  }
  if (RESERVED.has(e.name)) {
    throw new Error(`Reserved field name: '${e.name}' (source: ${e.source})`);
  }
}

// Unique within each source
const bySource = new Map<string, Set<string>>();
for (const e of ALL) {
  if (!bySource.has(e.source)) bySource.set(e.source, new Set());
  const names = bySource.get(e.source)!;
  if (names.has(e.name)) {
    throw new Error(`Duplicate field name '${e.name}' within source '${e.source}'`);
  }
  names.add(e.name);
}

// FD names must not collide with FPL names
const fplNames = new Set(fplEntries.map(e => e.name));
for (const e of [...fdPlayerEntries, ...fdTeamEntries, ...fdPriorEntries]) {
  if (fplNames.has(e.name)) {
    throw new Error(`football_data field '${e.name}' collides with an fpl field name`);
  }
}

// ── Opportunities ─────────────────────────────────────────────────────────────
// Each entry is a runnable fplang factor expression + the fields it uses + a brief note.

interface Opportunity {
  factor: string;
  expression: string;
  uses: string[];
  note: string;
}

const OPPORTUNITIES: Opportunity[] = [
  // --- current-season player scorer stats ---
  {
    factor: 'fd_goal_rate',
    expression: 'football_data.fd_goals_per_90',
    uses: ['football_data.fd_goals_per_90'],
    note: 'Raw scoring rate from an independent source; cross-check on FPL goals_scored.',
  },
  {
    factor: 'fd_involvement_rate',
    expression: 'football_data.fd_goals_per_90 + football_data.fd_assists_per_90',
    uses: ['football_data.fd_goals_per_90', 'football_data.fd_assists_per_90'],
    note: 'Total attacking contribution rate (goals + assists per 90). No FPL equivalent.',
  },
  {
    factor: 'finishing_edge',
    expression: 'football_data.fd_goals - expected_goals',
    uses: ['football_data.fd_goals', 'expected_goals'],
    note: 'Goals scored (fd) minus xG (FPL): positive = outperforming expected; negative = underperforming.',
  },
  {
    factor: 'assist_over_xa',
    expression: 'football_data.fd_assists - expected_assists',
    uses: ['football_data.fd_assists', 'expected_assists'],
    note: 'Same over/under concept for assists. Highlights creative players who convert chances.',
  },
  {
    factor: 'involvement_over_xgi',
    expression: 'football_data.fd_goal_involvements - expected_goal_involvements',
    uses: ['football_data.fd_goal_involvements', 'expected_goal_involvements'],
    note: 'Combined outperformance vs expected goal involvements.',
  },
  {
    factor: 'penalty_reliance',
    expression: 'football_data.fd_penalties / (football_data.fd_goals + 1)',
    uses: ['football_data.fd_penalties', 'football_data.fd_goals'],
    note: 'How penalty-dependent is the scorer? High = risky if penalty duties change. +1 avoids div-zero.',
  },
  {
    factor: 'non_pen_goals',
    expression: 'football_data.fd_goals - football_data.fd_penalties',
    uses: ['football_data.fd_goals', 'football_data.fd_penalties'],
    note: 'Open-play goals only — filters out penalty-takers for a "pure" scoring signal.',
  },
  {
    factor: 'value_output',
    expression: 'football_data.fd_goal_involvements / price',
    uses: ['football_data.fd_goal_involvements', 'price'],
    note: 'Direct goal contributions per £m of price. Surfaces value picks.',
  },
  {
    factor: 'scoring_signal',
    expression: 'z(football_data.fd_goals_per_90) + z(goals_scored) + z(expected_goals)',
    uses: ['football_data.fd_goals_per_90', 'goals_scored', 'expected_goals'],
    note: 'Composite: independent scorer rate + FPL goals + FPL xG. Three-source confirmation.',
  },

  // --- team context (standings broadcast) ---
  {
    factor: 'team_strength',
    expression: 'z(-football_data.table_position) + z(football_data.goal_difference)',
    uses: ['football_data.table_position', 'football_data.goal_difference'],
    note: 'Team quality blend: inverted rank + goal difference. Prefer over FPL static strength.',
  },
  {
    factor: 'team_attack_ctx',
    expression: 'z(football_data.goals_for) + z(football_data.wins)',
    uses: ['football_data.goals_for', 'football_data.wins'],
    note: 'Attacking team context. Boosts attackers and midfielders on prolific sides.',
  },
  {
    factor: 'team_defensive_ctx',
    expression: 'z(-football_data.goals_against) + z(football_data.wins)',
    uses: ['football_data.goals_against', 'football_data.wins'],
    note: 'Defensive team quality. Boosts keepers and defenders on low-conceding sides.',
  },
  {
    factor: 'table_adjusted_form',
    expression: 'z(form) * z(-football_data.table_position)',
    uses: ['form', 'football_data.table_position'],
    note: 'FPL rolling form weighted by team league standing. Discounts form on weak sides.',
  },
  {
    factor: 'attacker_team_boost',
    expression: 'z(threat) + z(football_data.goals_for)',
    uses: ['threat', 'football_data.goals_for'],
    note: 'Individual threat (FPL) × team scoring output (fd). Targets attackers on high-scoring teams.',
  },
  {
    factor: 'defender_cs_proxy',
    expression: 'z(-football_data.goals_against) + z(clean_sheets)',
    uses: ['football_data.goals_against', 'clean_sheets'],
    note: 'Team concession rate + player clean sheets: double-signal for defenders and goalkeepers.',
  },

  // --- cross-league transfer priors ---
  {
    factor: 'new_signing_form',
    expression: 'z(football_data.prior_goals_per_90) + z(football_data.prior_assists_per_90)',
    uses: ['football_data.prior_goals_per_90', 'football_data.prior_assists_per_90'],
    note: 'Prior-season rate signal for newly transferred EPL players. 0 for players with no SA/FL1 record.',
  },
  {
    factor: 'transfer_blend',
    expression: 'z(football_data.prior_goals_per_90) * 2 + z(form)',
    uses: ['football_data.prior_goals_per_90', 'form'],
    note: 'Weighted blend: prior-season rate (double weight) + current FPL form. Best for early-season GW.',
  },
  {
    factor: 'prior_value',
    expression: 'football_data.prior_goals + football_data.prior_assists',
    uses: ['football_data.prior_goals', 'football_data.prior_assists'],
    note: 'Raw prior-league involvement total. Quick scan for which signings had the most output.',
  },

  // --- shots gap: proxies using FPL volume signals ---
  {
    factor: 'shot_volume_proxy',
    expression: 'z(threat) + z(expected_goals)',
    uses: ['threat', 'expected_goals'],
    note: 'Shots not available in football-data.org. This pair from FPL is the best free-tier proxy for shot volume.',
  },
  {
    factor: 'attacker_pick',
    expression: 'z(threat) + z(expected_goals) + z(football_data.prior_goals_per_90)',
    uses: ['threat', 'expected_goals', 'football_data.prior_goals_per_90'],
    note: 'Shot proxy + transfer prior: full signal for an attacker new to the EPL.',
  },
  {
    factor: 'captain_score',
    expression: 'z(form) + z(football_data.fd_goals_per_90) + z(-football_data.table_position)',
    uses: ['form', 'football_data.fd_goals_per_90', 'football_data.table_position'],
    note: 'Captaincy signal: recent form + scoring rate + team quality. Three independent dimensions.',
  },
];

// ── Emit JSON ─────────────────────────────────────────────────────────────────

const jsonPath = resolve(root, 'docs', 'field-dictionary.json');
writeFileSync(jsonPath, JSON.stringify(ALL, null, 2) + '\n');

// ── Emit Markdown ─────────────────────────────────────────────────────────────

function fillStr(f: FieldDef): string {
  const p = f.fill;
  if (p.kind === 'none') return 'none';
  if (p.kind === 'zero') return 'zero';
  if (p.kind === 'mean') return 'mean';
  if (p.kind === 'median') return 'median';
  if (p.kind === 'constant') return `constant(${p.value})`;
  return '—';
}

function entityLabel(e: DictionaryEntry): string {
  if (e.entityLevel === 'player') return 'player';
  if (e.entityLevel === 'team-broadcast') return 'team → player';
  if (e.entityLevel === 'transfer-prior') return 'prior → player';
  return e.entityLevel;
}

function statusBadge(s: Status): string {
  return s === 'live' ? '✅ live' : '🔷 proposed';
}

const fplCount = fplEntries.length;
const fdPlayerCount = fdPlayerEntries.length;
const fdTeamCount = fdTeamEntries.length;
const fdPriorCount = fdPriorEntries.length;
const fdTotal = fdPlayerCount + fdTeamCount + fdPriorCount;
const total = ALL.length;

// Render table rows
function row(e: DictionaryEntry): string {
  const unit = e.unit ? ` (${e.unit})` : '';
  const range = e.range ? ` [${e.range[0]}–${e.range[1]}]` : '';
  const col = e.source === 'fpl' ? `\`${e.name}\`` : `\`football_data.${e.name}\``;
  return `| ${col} | ${e.source} | ${statusBadge(e.status)} | ${e.type}${unit} | ${entityLabel(e)} | ${e.description}${range} |`;
}

const tableHeader = `| Field | Source | Status | Type | Entity | Description |
|-------|--------|--------|------|--------|-------------|`;

const fplRows = fplEntries.map(row).join('\n');
const fdPlayerRows = fdPlayerEntries.map(row).join('\n');
const fdTeamRows = fdTeamEntries.map(row).join('\n');
const fdPriorRows = fdPriorEntries.map(row).join('\n');

// Render opportunities
const oppLines = OPPORTUNITIES.map(o => {
  const usesStr = o.uses.map(u => `\`${u}\``).join(', ');
  return `\`\`\`\n${o.factor} = ${o.expression}\n\`\`\`\n> Uses: ${usesStr}. ${o.note}`;
}).join('\n\n');

const md = `# fplang Field Dictionary

> **Generated** by \`scripts/build-field-dictionary.ts\` — do not edit directly.
> Regenerate with \`npm run gen:dictionary\`.

Combined field catalog for all player-level data sources available to fplang factor expressions.
Fields are the atoms: every factor is a formula over these names.

## Summary

| Source | Fields | Status |
|--------|--------|--------|
| \`fpl\` | ${fplCount} | ✅ live (implemented) |
| \`football_data\` (player scorer) | ${fdPlayerCount} | 🔷 proposed (ticket 028) |
| \`football_data\` (team standings) | ${fdTeamCount} | 🔷 proposed (ticket 028) |
| \`football_data\` (transfer prior) | ${fdPriorCount} | 🔷 proposed (ticket 028) |
| **Total** | **${total}** | |

**Status**: ✅ live = implemented and loaded from snapshot. 🔷 proposed = field catalog defined; source not yet implemented.

**Entity levels**:
- \`player\` — one value per FPL player, directly.
- \`team → player\` — one value per team (standings), broadcast to every player on that team.
- \`prior → player\` — previous-season value from SA/FL1, matched by name+DOB; 0 for no prior.

**Shots note**: football-data.org does not expose shot counts at any tier. Use \`threat\` + \`expected_goals\` (FPL) as a shot-volume proxy — see Opportunities §shot gap below.

---

## FPL fields (\`fpl\` source — ${fplCount} fields, live)

Access as bare names in factor expressions (e.g. \`goals_scored\`, \`form\`, \`price\`).
The \`fpl.\` prefix is also accepted but optional.

${tableHeader}
${fplRows}

---

## football-data.org fields (\`football_data\` source — ${fdTotal} fields, proposed)

Access as qualified names: \`football_data.<field>\` (e.g. \`football_data.fd_goals\`).

### Player scorer stats (${fdPlayerCount} fields)

From \`GET /v4/competitions/{code}/scorers\`. Sparse — only players who scored appear;
all others receive 0. Matched via \`name_match\` (name + dateOfBirth).

${tableHeader}
${fdPlayerRows}

### Team standings (${fdTeamCount} fields)

From \`GET /v4/competitions/PL/standings\`. Dense — every team has a row.
Broadcast to all FPL players on that team via \`team_broadcast\` strategy.

${tableHeader}
${fdTeamRows}

### Cross-league transfer priors (${fdPriorCount} fields)

From \`GET /v4/competitions/{SA|FL1}/scorers?season=PREV\`. Sparse — only players
who scored in the prior league appear; all others receive 0.
Matched via \`name_match\` across leagues (name + dateOfBirth).

> **Risk**: historical /scorers free-tier reachability is **unverified**. Verify with:
> \`\`\`bash
> FOOTBALL_DATA_TOKEN=<token> curl -s \\
>   "https://api.football-data.org/v4/competitions/SA/scorers?season=2024&limit=5" \\
>   -H "X-Auth-Token: $FOOTBALL_DATA_TOKEN"
> \`\`\`
> If 403 → cross-league priors require a paid plan; \`prior_*\` fields are unavailable.

${tableHeader}
${fdPriorRows}

---

## Opportunities

Cross-source factor examples — each combines at least one FPL field with at least one
football-data field (or documents a proxy where data is unavailable). Every expression
is valid fplang syntax once ticket 028 is implemented.

${oppLines}
`;

const mdPath = resolve(root, 'docs', '14-field-dictionary.md');
writeFileSync(mdPath, md);

// ── Print summary ─────────────────────────────────────────────────────────────

console.log(`\nField dictionary generated:`);
console.log(`  fpl (live):                ${fplCount} fields`);
console.log(`  football_data player:      ${fdPlayerCount} fields`);
console.log(`  football_data team:        ${fdTeamCount} fields`);
console.log(`  football_data prior:       ${fdPriorCount} fields`);
console.log(`  Total:                     ${total} fields`);
console.log(`  Opportunities:             ${OPPORTUNITIES.length}`);
console.log(`\n  → docs/field-dictionary.json`);
console.log(`  → docs/14-field-dictionary.md`);
