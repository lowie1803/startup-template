#!/usr/bin/env bash
# new-source.sh — scaffold a new fplang DataSource into a separate directory.
#
# Usage:
#   bash scripts/new-source.sh <source-id> <output-dir>
#
# <source-id>   Short lowercase identifier used as the namespace prefix in factor
#               expressions (e.g. "understat", "fbref", "odds").
#               Must match /^[a-z][a-z0-9_]*$/.
#
# <output-dir>  Directory to create (will be created if it doesn't exist).
#
# After scaffolding:
#   1. Fill in the TODOs in src/fields.ts and src/load.ts
#   2. cd <output-dir> && npm install
#   3. Iterate: tsx <fplang>/bin/validate-source.ts src/index.ts
#
# The scaffold creates:
#   src/fields.ts     FieldDef[] — declare your fields here
#   src/load.ts       load() implementation — fetch/normalise raw data
#   src/index.ts      DataSource export (wire fields + load together)
#   test/source.test.ts  end-to-end validation test
#   package.json      with fplang as a file: dependency
#   tsconfig.json

set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────────────────

SOURCE_ID="${1:-}"
OUT_DIR="${2:-}"

if [[ -z "$SOURCE_ID" || -z "$OUT_DIR" ]]; then
  echo "Usage: bash scripts/new-source.sh <source-id> <output-dir>"
  exit 1
fi

if ! [[ "$SOURCE_ID" =~ ^[a-z][a-z0-9_]*$ ]]; then
  echo "Error: source-id must match /^[a-z][a-z0-9_]*$/ (lowercase, no dashes)"
  exit 1
fi

# Absolute paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FPLANG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_ABS="$(mkdir -p "$OUT_DIR" && cd "$OUT_DIR" && pwd)"

# Relative path from output-dir to fplang (for the package.json file: reference)
FPLANG_REL="$(python3 -c "import os.path; print(os.path.relpath('$FPLANG_DIR', '$OUT_ABS'))" 2>/dev/null \
  || realpath --relative-to="$OUT_ABS" "$FPLANG_DIR" 2>/dev/null \
  || echo "../fplang")"

echo ""
echo "Scaffolding fplang source: $SOURCE_ID"
echo "  output dir : $OUT_ABS"
echo "  fplang at  : $FPLANG_REL"
echo ""

# ── Create directories ────────────────────────────────────────────────────────

mkdir -p "$OUT_ABS/src"
mkdir -p "$OUT_ABS/test"

# ── package.json ──────────────────────────────────────────────────────────────

cat > "$OUT_ABS/package.json" <<PKGJSON
{
  "name": "${SOURCE_ID}-source",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "validate": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "fplang": "file:${FPLANG_REL}"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
PKGJSON

# ── tsconfig.json ─────────────────────────────────────────────────────────────

cat > "$OUT_ABS/tsconfig.json" <<TSCFG
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  },
  "include": ["src/**/*", "test/**/*"]
}
TSCFG

# ── src/fields.ts ─────────────────────────────────────────────────────────────

cat > "$OUT_ABS/src/fields.ts" <<FIELDS
import type { FieldDef } from 'fplang';

/**
 * Field declarations for the '${SOURCE_ID}' source.
 *
 * Rules:
 *   - name must match /^[a-z][a-z0-9_]*$/ and must not clash with fpl field names
 *     or fplang reserved words (rank, z, ts_mean, iff, …).
 *   - description is required — it appears in autocomplete hover.
 *   - fill declares how NaN is eliminated before validation:
 *       { kind: 'none' }              field is always present; any NaN → error
 *       { kind: 'zero' }              replace NaN with 0 (e.g. stats for no-stat players)
 *       { kind: 'constant', value: X} replace NaN with a specific value
 *       { kind: 'mean' }              replace NaN with the column mean
 *       { kind: 'median' }            replace NaN with the column median
 *   - range is optional; values outside it produce warnings (not errors).
 *
 * The 'id' field is required — it must carry the FPL element id (integer)
 * so the merge step can join this source onto the fpl base panel.
 */
export const ${SOURCE_ID^^}_FIELDS: FieldDef[] = [
  // ── Join key (required) ────────────────────────────────────────────────────
  {
    name: 'id',
    source: '${SOURCE_ID}',
    type: 'number',
    description: 'FPL element id — normalised from the raw source player identifier',
    fill: { kind: 'none' },
  },

  // ── TODO: add your fields here ─────────────────────────────────────────────
  // {
  //   name: 'example_field',
  //   source: '${SOURCE_ID}',
  //   type: 'number',
  //   description: 'What this measures and its units',
  //   fill: { kind: 'zero' },
  //   range: [0, 100],
  // },
];
FIELDS
# fix the bash-substituted uppercase: SOURCE_ID^^  does not work in all bash versions
# re-write the const name correctly
CONST_NAME="${SOURCE_ID^^}_FIELDS"
# replace the literal '${SOURCE_ID^^}' with the actual uppercased name
sed -i "s/\${SOURCE_ID^^}/${CONST_NAME}/g" "$OUT_ABS/src/fields.ts" 2>/dev/null || true

# ── src/load.ts ───────────────────────────────────────────────────────────────

cat > "$OUT_ABS/src/load.ts" <<'LOAD'
import { Panel } from 'fplang';

/**
 * Load raw data and return a pre-fill columnar Panel.
 *
 * Responsibilities:
 *   1. Fetch / read the raw data (API, file, …).
 *   2. Normalise player rows to FPL element ids — the 'id' column must be
 *      a Float64Array of integer FPL element ids. If your source uses player
 *      names, resolve them to FPL ids here (bundle a lookup table).
 *   3. Build one column per declared FieldDef.name.
 *      - number/bool fields → Float64Array   (NaN for missing values is fine here)
 *      - string fields      → string[]        ('' for missing is fine here)
 *   4. Return new Panel(rowCount, columns).
 *
 * applyFills() is called by the validate pipeline after load() — you do not
 * need to fill NaN here; declare the right FillPolicy in fields.ts instead.
 */
export async function load(): Promise<Panel> {
  // TODO: fetch/read raw data
  // const raw = await fetch('https://...').then(r => r.json());

  // TODO: build columns
  const n = 0; // replace with actual row count
  const id = new Float64Array(n);
  // const example_field = new Float64Array(n);

  return new Panel(n, {
    id,
    // example_field,
  });
}
LOAD

# ── src/index.ts ──────────────────────────────────────────────────────────────

CONST_NAME_UC="${SOURCE_ID^^}_FIELDS"

cat > "$OUT_ABS/src/index.ts" <<INDEX
import type { DataSource } from 'fplang';
import { ${CONST_NAME_UC} } from './fields.js';
import { load } from './load.js';

export const ${SOURCE_ID}Source: DataSource = {
  id: '${SOURCE_ID}',
  fields: ${CONST_NAME_UC},
  load,
  // coefficients: { raw_xg: 1.12 },   // optional: multiply a field by a constant after load
  // fillMissing(col, field) { ... },   // optional: override FillPolicy for specific fields
};

export default ${SOURCE_ID}Source;
INDEX

# ── test/source.test.ts ───────────────────────────────────────────────────────

cat > "$OUT_ABS/test/source.test.ts" <<TEST
import { describe, it, expect } from 'vitest';
import { applyFills, validateDataset } from 'fplang';
import { ${SOURCE_ID}Source } from '../src/index.js';

describe('${SOURCE_ID} source: well-formed', () => {
  it('passes validateDataset after applyFills', async () => {
    const panel  = await ${SOURCE_ID}Source.load();
    const dense  = applyFills(panel, ${SOURCE_ID}Source.fields, ${SOURCE_ID}Source);
    const report = validateDataset(${SOURCE_ID}Source.fields, dense);

    if (!report.ok) {
      for (const e of report.errors.slice(0, 5)) {
        console.error(\`[\${e.code}] \${e.field ?? ''}: \${e.message}\`);
      }
    }

    expect(report.ok).toBe(true);
  });

  it('has an id column with at least one row', async () => {
    const panel = await ${SOURCE_ID}Source.load();
    expect(panel.has('id')).toBe(true);
    expect(panel.rowCount).toBeGreaterThan(0);
  });
});
TEST

# ── Done ──────────────────────────────────────────────────────────────────────

echo "✓  Created:"
echo "     src/fields.ts       — declare your fields here"
echo "     src/load.ts         — fetch and normalise raw data"
echo "     src/index.ts        — DataSource export"
echo "     test/source.test.ts — end-to-end validation test"
echo "     package.json"
echo "     tsconfig.json"
echo ""
echo "Next steps:"
echo "  1. Fill in the TODOs in src/fields.ts and src/load.ts"
echo "  2. cd $OUT_ABS && npm install"
echo "  3. tsx $FPLANG_DIR/bin/validate-source.ts src/index.ts"
echo ""
