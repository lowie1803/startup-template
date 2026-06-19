/**
 * DataManager implementation — ADR-003.
 *
 * Orchestrates: load → coefficients → fill → identity resolve → merge → validate.
 *
 * The fpl source (strategy: 'fpl_id') must be bound first — it is the merge base.
 *
 * Wire-in to evaluate()/analyze() is deferred to ticket 029. Until then:
 *
 *   // Usage sketch (not live yet):
 *   //
 *   // import { dataManager } from './manager/index.js';
 *   // import { fplSource } from '../data/fplSource.js';
 *   //
 *   // dataManager.bind({ source: fplSource, strategy: 'fpl_id' });
 *   // dataManager.bind({ source: fdSource, strategy: 'team_broadcast',
 *   //   teamBroadcast: { teamKeyColumn: 'tla', overrides: { NOT: "Nott'm Forest", ... } }
 *   // });
 *   //
 *   // const { fields, panel } = await dataManager.panel();
 *   // const result = evaluate(text, panel, fields);   // ← ticket 029 wires this in natively
 */

import { applyFills } from '../sources/fill.js';
import { mergePanels } from '../runtime/merge.js';
import { validateDataset } from '../validate.js';

import {
  resolveByFplId,
  resolveByTeamBroadcast,
  resolveByNameMatch,
} from './identity.js';

import type { FieldDef } from '../types.js';
import type { Panel } from '../runtime/panel.js';
import type { ValidationReport } from '../sources/types.js';
import type {
  DataManager,
  ManagedDataset,
  SourceBinding,
} from './types.js';

export class DataManagerImpl implements DataManager {
  private readonly bindings: SourceBinding[] = [];
  private lastReports: Record<string, ValidationReport> = {};

  // ── Registration ────────────────────────────────────────────────────────────

  bind(binding: SourceBinding): void {
    const id = binding.source.id;
    if (this.bindings.some(b => b.source.id === id)) {
      throw new Error(`DataManager: source '${id}' is already bound`);
    }
    if (this.bindings.length === 0 && binding.strategy !== 'fpl_id') {
      throw new Error(
        `DataManager: the first bound source must use strategy 'fpl_id' ` +
        `(it provides the merge base). Got strategy '${binding.strategy}' for '${id}'.`,
      );
    }
    this.bindings.push(binding);
  }

  sourceIds(): string[] {
    return this.bindings.map(b => b.source.id);
  }

  // ── Field catalog ───────────────────────────────────────────────────────────

  fields(): FieldDef[] {
    return this.bindings.flatMap(b => b.source.fields);
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  validateAll(): Record<string, ValidationReport> {
    return { ...this.lastReports };
  }

  // ── Pipeline ─────────────────────────────────────────────────────────────────

  async panel(opts?: Record<string, unknown>): Promise<ManagedDataset> {
    if (this.bindings.length === 0) {
      throw new Error('DataManager: no sources bound. Call bind() first.');
    }

    const reports: Record<string, ValidationReport> = {};

    // Step 1: Load and process each source into an fpl-id-keyed panel.
    const resolvedPanels: Panel[] = [];
    let baseFplPanel: Panel | undefined;

    for (const binding of this.bindings) {
      const { source, strategy } = binding;

      // 1a. Load (pre-fill panel)
      const rawPanel = await Promise.resolve(source.load(opts));

      // 1b. Apply coefficients (ADR-003: formerly a no-op dead field, now active)
      const scaledPanel = applyCoefficients(rawPanel, source.coefficients);

      // 1c. Fill
      const filledPanel = applyFills(scaledPanel, source.fields, source);

      // 1d. Validate the individual source panel
      const report = validateDataset(source.fields, filledPanel);
      reports[source.id] = report;

      // 1e. Identity resolve → fpl-id-keyed panel
      let resolvedPanel: Panel;
      if (strategy === 'fpl_id') {
        resolvedPanel = resolveByFplId(filledPanel);
        baseFplPanel = resolvedPanel;   // first binding must be fpl_id
      } else if (strategy === 'team_broadcast') {
        if (baseFplPanel === undefined) throw new Error('DataManager: fpl base panel not loaded');
        if (!binding.teamBroadcast) {
          throw new Error(
            `DataManager: strategy 'team_broadcast' requires a teamBroadcast config for '${source.id}'`,
          );
        }
        resolvedPanel = resolveByTeamBroadcast(filledPanel, baseFplPanel, binding.teamBroadcast);
      } else if (strategy === 'name_match') {
        if (baseFplPanel === undefined) throw new Error('DataManager: fpl base panel not loaded');
        if (!binding.nameMatch) {
          throw new Error(
            `DataManager: strategy 'name_match' requires a nameMatch config for '${source.id}'`,
          );
        }
        resolvedPanel = resolveByNameMatch(filledPanel, baseFplPanel, binding.nameMatch);
      } else {
        const _exhaustive: never = strategy;
        throw new Error(`DataManager: unknown strategy '${_exhaustive}'`);
      }

      resolvedPanels.push(resolvedPanel);
    }

    // Step 2: Merge all resolved panels (base first, sources after)
    // resolvedPanels is guaranteed non-empty (we checked bindings.length > 0 above).
    const base = resolvedPanels[0] as Panel;
    const rest = resolvedPanels.slice(1);
    const mergedPanel: Panel = rest.length > 0 ? mergePanels(base, ...rest) : base;

    // Step 3: Validate merged result against the full field catalog
    const allFields = this.fields();
    const mergedReport = validateDataset(allFields, mergedPanel);
    reports['__merged__'] = mergedReport;

    this.lastReports = reports;

    return {
      fields: allFields,
      panel: mergedPanel,
      validationReports: { ...reports },
    };
  }
}

// ── Coefficients helper ───────────────────────────────────────────────────────

/**
 * Apply static per-field multipliers from DataSource.coefficients (ADR-003).
 * Called after load() and before applyFills().
 * Returns the same panel if coefficients is undefined or empty.
 */
function applyCoefficients(
  panel: Panel,
  coefficients: Record<string, number> | undefined,
): Panel {
  if (!coefficients || Object.keys(coefficients).length === 0) return panel;

  // TODO (ticket 028): implement column-wise scalar multiply.
  // For now, warn and pass through (no behavior change for existing sources).
  console.warn(
    'DataManager: coefficients detected but scaling is not yet implemented — ' +
    'column values are unscaled. See ticket 028.',
  );
  return panel;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

/** Default singleton Data Manager instance. */
export const dataManager: DataManager = new DataManagerImpl();
