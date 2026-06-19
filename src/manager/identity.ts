/**
 * Identity resolution — ADR-003.
 *
 * Turns a source's native panel into an FPL-element-id-keyed panel
 * so it can be merged via mergePanels().
 *
 * Implementations are stubs (throw TODO) — see tickets 028/029 for the full impl.
 */

import type { Panel } from '../runtime/panel.js';
import type { TeamBroadcastConfig, NameMatchConfig } from './types.js';

// ── fpl_id strategy ───────────────────────────────────────────────────────────

/**
 * 'fpl_id' strategy: the source panel already carries FPL element ids.
 * This is a no-op — the panel is returned unchanged.
 *
 * Used by the fpl source.
 */
export function resolveByFplId(nativePanel: Panel): Panel {
  return nativePanel;
}

// ── team_broadcast strategy ───────────────────────────────────────────────────

/**
 * 'team_broadcast' strategy: broadcast team-level rows from the source panel
 * to all FPL players on each team.
 *
 * Algorithm (deferred — ticket 028):
 *   1. Read the team key column (e.g. `tla`) from the source panel.
 *   2. For each base fpl player row, look up their fpl `team` (short_name):
 *        - Apply the override table for keys that don't match exactly.
 *        - Locate the source row whose team key resolves to this short_name.
 *   3. Copy every non-id, non-team-key column value from the source row into the
 *      corresponding player row; rows with no match → NaN / ''.
 *   4. Return a new Panel keyed by FPL element ids with one row per player.
 *
 * @param nativePanel  - source panel keyed by team (one row per team).
 * @param baseFplPanel - fpl base panel; provides the fpl id and team columns.
 * @param config       - override table and team key column name.
 */
export function resolveByTeamBroadcast(
  _nativePanel: Panel,
  _baseFplPanel: Panel,
  _config: TeamBroadcastConfig,
): Panel {
  throw new Error(
    'resolveByTeamBroadcast: not yet implemented — see ticket 028',
  );
}

// ── name_match strategy ───────────────────────────────────────────────────────

/**
 * 'name_match' strategy: match source player rows to fpl players by name
 * (and optionally dateOfBirth for disambiguation).
 *
 * Algorithm (deferred — ticket 028):
 *   1. Build a Map<normalizedName, fplElementId> from the fpl base panel.
 *   2. For each source row, normalise the name (lowercase, trim, strip accents)
 *      and look up the fpl id. If dobColumn is provided, use it to disambiguate.
 *   3. Build an fpl-id-keyed panel from matched rows; unmatched → NaN / ''.
 *   4. Log warnings for unmatched names (expected; source coverage is partial).
 *
 * @param nativePanel  - source panel keyed by source player id.
 * @param baseFplPanel - fpl base panel; provides the id, web_name columns.
 * @param config       - name and optional DOB column identifiers.
 */
export function resolveByNameMatch(
  _nativePanel: Panel,
  _baseFplPanel: Panel,
  _config: NameMatchConfig,
): Panel {
  throw new Error(
    'resolveByNameMatch: not yet implemented — see ticket 028',
  );
}
