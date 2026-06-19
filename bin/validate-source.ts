#!/usr/bin/env tsx
/**
 * Runtime validator for a fplang DataSource.
 *
 * Usage:
 *   tsx bin/validate-source.ts <source-file> [export-name]
 *
 * <source-file>  Path to the source module (e.g. ../understat-source/src/index.ts).
 *                The module must export a DataSource object.
 * [export-name]  Named export to use as the DataSource (default: 'default').
 *
 * The script runs the full well-formedness pipeline:
 *   load() → applyFills() → validateDataset()
 *
 * Exit code 0 = ok (warnings allowed), 1 = errors found.
 */

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { applyFills }       from '../src/sources/fill.js';
import { validateDataset }  from '../src/validate.js';
import type { DataSource }  from '../src/sources/types.js';

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  dim:    '\x1b[2m',
};
const ok   = `${C.green}✓${C.reset}`;
const fail = `${C.red}✗${C.reset}`;
const warn = `${C.yellow}⚠${C.reset}`;
const bold = (s: string) => `${C.bold}${s}${C.reset}`;
const dim  = (s: string) => `${C.dim}${s}${C.reset}`;

// ── Entry ─────────────────────────────────────────────────────────────────────

const [,, sourcePath, exportName = 'default'] = process.argv;

if (!sourcePath) {
  console.error('Usage: tsx bin/validate-source.ts <source-file> [export-name]');
  process.exit(1);
}

const absPath = resolve(process.cwd(), sourcePath);
const fileUrl = pathToFileURL(absPath).href;

console.log();
console.log(bold(`Validating data source`));
console.log(dim(`  file:   ${absPath}`));
console.log(dim(`  export: ${exportName}`));
console.log();

// ── Import ────────────────────────────────────────────────────────────────────

let source: DataSource;
try {
  const mod = await import(fileUrl);
  const exported = mod[exportName] ?? mod.default;
  if (!exported || typeof exported !== 'object' || typeof exported.load !== 'function') {
    console.error(`${fail} Could not find a DataSource at export '${exportName}' in ${sourcePath}`);
    console.error(`     Expected an object with { id, fields, load }.`);
    process.exit(1);
  }
  source = exported as DataSource;
  console.log(`  ${ok}  Imported   ${bold(source.id)}  (${source.fields.length} fields declared)`);
} catch (err) {
  console.error(`${fail} Import failed: ${(err as Error).message}`);
  process.exit(1);
}

// ── Load ──────────────────────────────────────────────────────────────────────

let panel;
const t0 = Date.now();
try {
  panel = await source.load();
  const ms = Date.now() - t0;
  console.log(`  ${ok}  Loaded     ${panel.rowCount} rows, ${panel.columnNames().length} columns  ${dim(`(${ms}ms)`)}`);
} catch (err) {
  console.error(`  ${fail} load() threw: ${(err as Error).message}`);
  process.exit(1);
}

// ── Fill ──────────────────────────────────────────────────────────────────────

let dense;
try {
  dense = applyFills(panel, source.fields, source);
  console.log(`  ${ok}  Filled     fills applied per FillPolicy`);
} catch (err) {
  console.error(`  ${fail} applyFills() threw: ${(err as Error).message}`);
  process.exit(1);
}

// ── Validate ──────────────────────────────────────────────────────────────────

const report = validateDataset(source.fields, dense);

console.log();
console.log(bold('Results'));
console.log();

// Group errors and warnings by rule code prefix
const ruleOrder = ['SCHEMA', 'NAME', 'SHAPE', 'DENSITY', 'RANGE'];

function rulesWithPrefix(prefix: string) {
  return {
    errors:   report.errors.filter(e => e.code.startsWith(prefix)),
    warnings: report.warnings.filter(w => w.code.startsWith(prefix)),
  };
}

const ruleLabels: Record<string, string> = {
  SCHEMA:  'Schema',
  NAME:    'Names',
  SHAPE:   'Shape',
  DENSITY: 'Density',
  RANGE:   'Range',
};

for (const prefix of ruleOrder) {
  const { errors: errs, warnings: warns } = rulesWithPrefix(prefix);
  const label = ruleLabels[prefix]!.padEnd(10);

  if (errs.length === 0 && warns.length === 0) {
    console.log(`  ${ok}  ${label}  ${dim('all clear')}`);
  } else {
    const icon = errs.length > 0 ? fail : warn;
    const summary = [
      errs.length  > 0 ? `${C.red}${errs.length} error${errs.length > 1 ? 's' : ''}${C.reset}` : '',
      warns.length > 0 ? `${C.yellow}${warns.length} warning${warns.length > 1 ? 's' : ''}${C.reset}` : '',
    ].filter(Boolean).join(', ');
    console.log(`  ${icon}  ${label}  ${summary}`);

    for (const issue of [...errs, ...warns]) {
      const loc = [
        issue.field ? `${C.bold}${issue.field}${C.reset}` : '',
        issue.row !== undefined ? `row ${issue.row}` : '',
      ].filter(Boolean).join('  ');
      const code = dim(issue.code);
      console.log(`       ${loc ? loc + '  ' : ''}${code}`);
      console.log(`       ${dim(issue.message)}`);
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log();
if (report.ok) {
  const warnCount = report.warnings.length;
  const warnNote  = warnCount > 0 ? `  ${warn} ${warnCount} warning${warnCount > 1 ? 's' : ''}` : '';
  console.log(`${C.green}${C.bold}PASS${C.reset}${warnNote}`);
  console.log(dim(`Source '${source.id}' is well-formed — ready to merge.`));
  console.log();
  process.exit(0);
} else {
  console.log(`${C.red}${C.bold}FAIL${C.reset}  ${report.errors.length} error${report.errors.length > 1 ? 's' : ''}`);
  console.log(dim(`Fix the errors above, then re-run.`));
  console.log();
  process.exit(1);
}
