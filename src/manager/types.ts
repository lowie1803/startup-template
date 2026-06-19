/**
 * Data Manager types — ADR-003.
 *
 * The Data Manager sits above the DataSource contract and below evaluate/analyze.
 * It centralises identity resolution, coefficients application, fill, merge, and
 * validation so individual sources can stay close to their raw data shape.
 *
 * See docs/13-source-discovery.md for the discovery profile standard.
 * See .project/decisions/ADR-003-data-manager.md for the design rationale.
 */

import type { FieldDef } from '../types.js';
import type { Panel } from '../runtime/panel.js';
import type { DataSource, ValidationReport } from '../sources/types.js';

// ── Discovery profile ─────────────────────────────────────────────────────────

/**
 * Machine-readable capability manifest for a data source.
 * Every source integrated via the Data Manager produces one of these
 * (see docs/discovery/<source-id>.md for the human-readable form).
 */
export interface DiscoveryProfile {
  /** Matches DataSource.id — the namespace prefix in factor expressions. */
  sourceId: string;
  /** Base URL of the upstream API or data file. */
  baseUrl: string;
  /** ISO date of the most recent crawl. */
  crawlDate: string;
  /** Authentication model. */
  auth: 'api-key' | 'open' | 'oauth';
  /**
   * Rate limit of the target subscription tier (requests per minute).
   * Used by snapshot scripts to pace fetches.
   */
  rateLimit: number;
  /** HTTP response header that carries remaining request quota, if any. */
  rateLimitHeader?: string;
  /** Narrative description of this source's capabilities and constraints. */
  notes: string;
  /**
   * Candidate fields the source can contribute to factor expressions.
   * Informational — the authoritative field list lives in SourceBinding.source.fields.
   */
  candidateFields: CandidateField[];
}

/** A single field candidate from the discovery crawl — informational only. */
export interface CandidateField {
  /** Proposed FieldDef name (lowercase+underscore). */
  name: string;
  /** Path into the raw API response, e.g. 'standings.table[n].position'. */
  nativePath: string;
  /** Granularity of the raw data before any broadcast/join. */
  entityLevel: 'competition' | 'team' | 'player' | 'match';
  /** True if every row in the raw data has a value without special handling. */
  dense: boolean;
  /** Brief note on marginal value vs existing fpl source. */
  notes?: string;
}

// ── Identity strategy ─────────────────────────────────────────────────────────

/**
 * How a source's native panel is mapped to FPL-element-id rows.
 * The Data Manager applies the strategy; source load() returns its native shape.
 *
 * - 'fpl_id'         — panel already carries integer FPL element ids in the `id` column.
 *                      No mapping needed. Used by the fpl source.
 * - 'team_broadcast' — source is team-keyed; each team's row is broadcast to all fpl
 *                      players on that team. Requires a tla→fpl-short-name lookup table
 *                      and access to the fpl base panel's player→team mapping.
 * - 'name_match'     — player rows are matched to fpl players by name (+/- dateOfBirth).
 *                      Fragile; only use for non-dense supplemental fields.
 */
export type IdentityStrategy = 'fpl_id' | 'team_broadcast' | 'name_match';

/**
 * Configuration for the 'team_broadcast' strategy.
 * Maps the source's team identifier to the fpl team short_name so the manager
 * can look up which fpl players belong to each team.
 */
export interface TeamBroadcastConfig {
  /**
   * Column in the source's native panel that holds the team identifier
   * (e.g. the `tla` string column). Used as the lookup key.
   */
  teamKeyColumn: string;
  /**
   * Static override table: source team key → fpl short_name.
   * Only entries that differ from the default (exact string match) are needed.
   * e.g. { 'NOT': "Nott'm Forest", 'TOT': 'Spurs', 'MUN': 'Man Utd' }
   */
  overrides?: Record<string, string>;
}

/**
 * Configuration for the 'name_match' strategy.
 * Allows optional DOB tie-breaking when names are ambiguous.
 */
export interface NameMatchConfig {
  /** Column in the source panel containing the player name. */
  nameColumn: string;
  /** Column containing dateOfBirth (ISO string) for disambiguation. Optional. */
  dobColumn?: string;
}

// ── Source binding ────────────────────────────────────────────────────────────

/**
 * Pairs a DataSource with its identity strategy and any strategy-specific config.
 * This is what callers register with DataManager.bind() rather than a raw DataSource.
 */
export interface SourceBinding {
  source: DataSource;
  strategy: IdentityStrategy;
  /** Required when strategy === 'team_broadcast'. */
  teamBroadcast?: TeamBroadcastConfig;
  /** Required when strategy === 'name_match'. */
  nameMatch?: NameMatchConfig;
}

// ── Data Manager interface ────────────────────────────────────────────────────

/** The resolved output of a full pipeline run — ready for evaluate()/analyze(). */
export interface ManagedDataset {
  /** Merged FieldDef catalog across all bound sources. */
  fields: FieldDef[];
  /** Merged, filled, identity-resolved, validated Panel (base fpl + all sources). */
  panel: Panel;
  /** Per-source validation reports from the last pipeline run. */
  validationReports: Record<string, ValidationReport>;
}

/**
 * The Data Manager orchestrates the full data pipeline from multiple sources.
 *
 * Lifecycle:
 *   1. bind() — register each source with its identity strategy.
 *   2. panel() — run the pipeline: load → coefficients → fill → identity resolve
 *                → merge → validate → return ManagedDataset.
 *
 * The fpl source (strategy: 'fpl_id') must be bound first — it provides the base
 * panel that all team_broadcast and name_match strategies reference.
 *
 * Wire-in to evaluate()/analyze() is deferred to ticket 029. Until then, spread the
 * ManagedDataset manually:
 *   const { fields, panel } = await manager.panel();
 *   const result = evaluate(text, panel, fields);
 */
export interface DataManager {
  /**
   * Register a source + its identity binding.
   * Throws if a source with the same id is already bound.
   * The fpl source (strategy: 'fpl_id') should be bound first.
   */
  bind(binding: SourceBinding): void;

  /**
   * Run the full pipeline and return a merged, validated dataset.
   * Calls each source's load(), applies coefficients, fill, identity resolution,
   * merges all panels onto the fpl base, and validates the result.
   */
  panel(opts?: Record<string, unknown>): Promise<ManagedDataset>;

  /**
   * Return the merged FieldDef catalog for all currently bound sources.
   * Safe to call before panel() — reads only the static source.fields arrays.
   */
  fields(): FieldDef[];

  /**
   * Run validateDataset() against the last resolved panel for each source.
   * Returns a map of sourceId → ValidationReport.
   * Returns an empty object if panel() has not yet been called.
   */
  validateAll(): Record<string, ValidationReport>;

  /** List the ids of all currently bound sources, in bind() order. */
  sourceIds(): string[];
}
