/**
 * The built-in `fpl` DataSource — backlog item 023.
 *
 * Wraps data/loadSnapshot.ts as a DataSource so the source registry and the
 * merge pipeline can treat it identically to third-party sources.
 */

import type { DataSource } from '../src/sources/types.js';
import { FPL_FIELDS } from '../src/catalog/fields.js';
import { loadSnapshot } from './loadSnapshot.js';

export const fplSource: DataSource = {
  id: 'fpl',
  fields: FPL_FIELDS,
  load: loadSnapshot,
  // No coefficients needed — FPL values are already in native units.
  // fillMissing is not overridden — FillPolicy in FPL_FIELDS is authoritative.
};
