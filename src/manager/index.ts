/**
 * Data Manager public exports — ADR-003.
 *
 * Types:
 *   DiscoveryProfile, CandidateField       — source capability manifest
 *   IdentityStrategy                        — 'fpl_id' | 'team_broadcast' | 'name_match'
 *   TeamBroadcastConfig, NameMatchConfig    — per-strategy config
 *   SourceBinding                           — DataSource + strategy + config
 *   ManagedDataset                          — { fields, panel, validationReports }
 *   DataManager                             — the orchestrator interface
 *
 * Instance:
 *   dataManager                             — default singleton
 *   DataManagerImpl                         — class (for testing / custom instances)
 */

export type {
  DiscoveryProfile,
  CandidateField,
  IdentityStrategy,
  TeamBroadcastConfig,
  NameMatchConfig,
  SourceBinding,
  ManagedDataset,
  DataManager,
} from './types.js';

export { dataManager, DataManagerImpl } from './dataManager.js';
