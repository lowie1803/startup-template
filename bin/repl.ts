#!/usr/bin/env tsx
/**
 * fplang interactive REPL.
 *
 * Usage:  npm run repl
 *
 * Each line is evaluated as one or more factor definitions against the
 * current player panel. Defined factors accumulate across lines (the panel
 * grows with each new column).
 *
 * Dot commands:
 *   .fields   — list all base data fields from the catalog
 *   .cols     — list all columns currently in the panel (base + defined factors)
 *   .show N   — show first N rows of all factor columns (default 10)
 *   .help     — print this reference
 *   .exit     — quit (also Ctrl-D)
 *
 * Examples:
 *   value = total_points / price
 *   nailed = iff(minutes > 1500, 1, 0)
 *   ppg90 = per90(total_points, minutes)
 *   saves_pts = iff(position == "GKP", saves / 3, 0)
 */

import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { evaluate, listFields, type EvalResult } from '../src/index.js';
import { Panel } from '../src/runtime/panel.js';
import { BUILTINS } from '../src/runtime/builtins.js';
import { buildSamplePanel } from '../data/sample-panel.js';

// ── Session persistence ───────────────────────────────────────────────────────
const SESSION_FILE = path.join(os.homedir(), '.fplang_session');

function sessionLoad(): string[] {
  try {
    return fs.readFileSync(SESSION_FILE, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

function sessionAppend(line: string): void {
  try {
    fs.appendFileSync(SESSION_FILE, line + '\n');
  } catch {
    // non-fatal — don't crash the REPL if the file can't be written
  }
}

function sessionClear(): void {
  try {
    fs.writeFileSync(SESSION_FILE, '');
  } catch { /* non-fatal */ }
}

// ── ANSI colours (disabled if not a TTY) ─────────────────────────────────────
const isTTY = process.stdout.isTTY;
const c = {
  dim:    (s: string) => isTTY ? `\x1b[2m${s}\x1b[0m`  : s,
  bold:   (s: string) => isTTY ? `\x1b[1m${s}\x1b[0m`  : s,
  green:  (s: string) => isTTY ? `\x1b[32m${s}\x1b[0m` : s,
  yellow: (s: string) => isTTY ? `\x1b[33m${s}\x1b[0m` : s,
  red:    (s: string) => isTTY ? `\x1b[31m${s}\x1b[0m` : s,
  cyan:   (s: string) => isTTY ? `\x1b[36m${s}\x1b[0m` : s,
};

const DISPLAY_ROWS = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatValue(v: number | string | null): string {
  if (v === null) return c.dim('null');
  if (typeof v === 'string') return c.cyan(`"${v}"`);
  if (!isFinite(v)) return c.dim('null');
  // Show integers without decimals, others with up to 6dp
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(6).replace(/\.?0+$/, '');
}

function printFactorColumns(
  panel: Panel,
  factorNames: string[],
  limit: number,
): void {
  if (factorNames.length === 0) return;

  const nameCol = panel.getString('web_name');
  const n = Math.min(panel.rowCount, limit);

  for (const fname of factorNames) {
    const col = panel.getColumn(fname);
    if (!col) continue;

    // Check if this is a scalar (all rows same value) — show compact form
    const isNumeric = col instanceof Float64Array;
    let allSame = true;
    const first = isNumeric ? col[0] : (col as string[])[0];
    const firstIsNull = isNumeric && !isFinite(first ?? NaN);
    for (let i = 1; i < panel.rowCount; i++) {
      const v = isNumeric ? col[i] : (col as string[])[i];
      // Treat all non-finite values as equal to each other (null cluster)
      const vIsNull = isNumeric && !isFinite(v as number);
      if (firstIsNull ? !vIsNull : v !== first) { allSame = false; break; }
    }

    if (allSame && panel.rowCount > 1) {
      const val = isNumeric
        ? formatValue(isFinite(col[0] ?? NaN) ? (col[0] ?? null) : null)
        : formatValue((col as string[])[0] ?? null);
      console.log(`  ${c.bold(fname)} = ${val} ${c.dim('(same for all players)')}`);
      continue;
    }

    // Build sorted indices (numeric: descending; string: alphabetical)
    const indices = Array.from({ length: panel.rowCount }, (_, i) => i);
    if (isNumeric) {
      indices.sort((a, b) => {
        const va = col[a] ?? NaN;
        const vb = col[b] ?? NaN;
        if (!isFinite(va) && !isFinite(vb)) return 0;
        if (!isFinite(va)) return 1;
        if (!isFinite(vb)) return -1;
        return vb - va;
      });
    }

    const shown = indices.slice(0, n);
    const maxNameLen = shown.reduce((mx, i) => {
      const nm = nameCol?.[i] ?? `row${i}`;
      return Math.max(mx, nm.length);
    }, 0);

    console.log(`  ${c.bold(fname)}`);
    for (const i of shown) {
      const playerName = nameCol?.[i] ?? `row${i}`;
      const rawVal = isNumeric ? (col[i] ?? null) : ((col as string[])[i] ?? null);
      const displayVal = isNumeric
        ? formatValue(typeof rawVal === 'number' && isFinite(rawVal) ? rawVal : null)
        : formatValue(rawVal as string | null);
      console.log(`    ${playerName.padEnd(maxNameLen)}  ${displayVal}`);
    }
    if (panel.rowCount > n) {
      console.log(`    ${c.dim(`… and ${panel.rowCount - n} more`)}`);
    }
  }
}

function printDiagnostics(text: string, result: EvalResult): void {
  for (const d of result.diagnostics) {
    const snippet = text.slice(d.from, d.to);
    const level = d.severity === 'error' ? c.red('error') : c.yellow('warning');
    console.log(`  ${level}: ${d.message}${snippet ? ` (${c.dim(snippet)})` : ''}`);
  }
}

function printHelp(): void {
  console.log(`
${c.bold('fplang REPL')} — factor expression language for FPL analytics

${c.bold('Syntax:')}
  name = expr          Define a factor. Results shown per player, sorted by value.
  expr                 Evaluate an expression anonymously.

${c.bold('Operators:')}   + - * / %   == != < > <= >=   ( )
${c.bold('Builtins:')}    iff(cond, t, f)    coalesce(a, b)    per90(stat, mins)
              min(a,b)  max(a,b)  abs(n)  sqrt(n)  log(n)  pow(b,e)
              round(n)  floor(n)  ceil(n)

${c.bold('Null rules:')}  arithmetic with null → null   div/0 → null   Infinity/NaN → null
${c.bold('Precision:')}   results rounded to 6 decimal places

${c.bold('Dot commands:')}
  .fields        List base data fields from the catalog
  .cols          List all columns in the current panel
  .show [N]      Show top N rows of factor columns (default 10)
  .reset         Clear the saved session (~/.fplang_session) and restart
  .help          Show this help
  .exit          Quit

${c.bold('Session:')}   Factor definitions persist across sessions in ~/.fplang_session.
            Use .reset to wipe it.
`);
}

function printFields(): void {
  const fields = listFields();
  console.log(`${c.bold('Base fields')} (${fields.length}):`);
  const maxLen = fields.reduce((m, f) => Math.max(m, f.name.length), 0);
  for (const f of fields) {
    const typeTag = c.dim(`[${f.type}]`);
    const desc = f.description ? c.dim(` — ${f.description}`) : '';
    console.log(`  ${f.name.padEnd(maxLen)}  ${typeTag}${desc}`);
  }
}

function printCols(panel: Panel): void {
  const names = panel.columnNames();
  console.log(`${c.bold('Panel columns')} (${names.length}):`);
  const fields = new Set(listFields().map(f => f.name));
  for (const name of names) {
    const tag = fields.has(name) ? c.dim('[base]') : c.green('[factor]');
    const col = panel.getColumn(name);
    const kind = col instanceof Float64Array ? 'numeric' : 'string';
    console.log(`  ${name.padEnd(35)}  ${tag} ${c.dim(kind)}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Tab completion ────────────────────────────────────────────────────────────

const DOT_COMMANDS = ['.fields', '.cols', '.show', '.reset', '.help', '.exit'];
const BUILTIN_NAMES = Object.keys(BUILTINS);
const BASE_FIELD_NAMES = listFields().map(f => f.name);

/**
 * Returns a readline-compatible completer.
 * Closes over a `getPanel` getter so it always sees the live panel columns.
 */
function makeCompleter(getPanel: () => Panel): (line: string) => [string[], string] {
  return (line: string) => {
    // Dot commands: complete only when line starts with '.'
    if (line.startsWith('.')) {
      const hits = DOT_COMMANDS.filter(c => c.startsWith(line));
      return [hits, line];
    }

    // Find the identifier fragment at the cursor (last word-like token)
    const wordMatch = line.match(/[A-Za-z_]\w*$/);
    const word = wordMatch ? wordMatch[0] : '';

    // Completions: base fields + user-defined factors + builtins
    const factorNames = getPanel()
      .columnNames()
      .filter(n => !BASE_FIELD_NAMES.includes(n) && n !== '__tmp__');

    const candidates = [...BASE_FIELD_NAMES, ...factorNames, ...BUILTIN_NAMES];
    const hits = word ? candidates.filter(c => c.startsWith(word)) : candidates;

    return [hits, word];
  };
}

function replaySession(
  lines: string[],
  panel: Panel,
  fields: ReturnType<typeof listFields>,
): Panel {
  for (const line of lines) {
    try {
      const result = evaluate(line, panel, fields);
      if (result.factorNames.length > 0) panel = result.panel;
    } catch {
      // skip broken saved lines silently
    }
  }
  return panel;
}

function main(): void {
  let panel = buildSamplePanel();
  const fields = listFields();

  // ── Replay saved session ─────────────────────────────────────────────────
  const saved = sessionLoad();
  if (saved.length > 0) {
    panel = replaySession(saved, panel, fields);
  }

  console.log(c.bold('\nfplang REPL') + c.dim('  (type .help for commands, .exit to quit)'));
  const sessionNote = saved.length > 0
    ? c.dim(`  Restored ${saved.length} saved factor${saved.length === 1 ? '' : 's'} from ~/.fplang_session\n`)
    : '';
  console.log(c.dim(`  Panel: ${panel.rowCount} players, ${panel.columnNames().length} base columns`) + (sessionNote ? '\n' + sessionNote : '\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: c.green('fplang> '),
    terminal: isTTY,
    completer: makeCompleter(() => panel),
  });

  rl.prompt();

  rl.on('line', (rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      rl.prompt();
      return;
    }

    // ── Dot commands ──────────────────────────────────────────────────────
    if (line.startsWith('.')) {
      const [cmd, ...rest] = line.split(/\s+/);
      switch (cmd) {
        case '.exit':
        case '.quit':
          console.log(c.dim('Bye.'));
          rl.close();
          process.exit(0);
          break;
        case '.help':
          printHelp();
          break;
        case '.fields':
          printFields();
          break;
        case '.cols':
          printCols(panel);
          break;
        case '.show': {
          const n = rest[0] ? parseInt(rest[0], 10) : DISPLAY_ROWS;
          const factorCols = panel.columnNames().filter(
            name => !listFields().some(f => f.name === name),
          );
          printFactorColumns(panel, factorCols, isNaN(n) ? DISPLAY_ROWS : n);
          break;
        }
        case '.reset':
          sessionClear();
          panel = buildSamplePanel();
          console.log(c.yellow('Session cleared.') + c.dim(' Panel reset to base data.'));
          break;
        default:
          console.log(c.red(`Unknown command '${cmd ?? ''}'.`) + c.dim(' Try .help'));
      }
      rl.prompt();
      return;
    }

    // ── Wrap bare expressions as an anonymous factor ──────────────────────
    // A bare expr has no '=' at the "assignment position"
    // (i.e. the first identifier-like token isn't followed by '=').
    // Simple heuristic: if the line contains ' = ' or starts with /\w+\s*=\s*/,
    // treat as-is; otherwise wrap as __tmp__.
    const isAssignment = /^\s*[A-Za-z_]\w*\s*=\s*(?!=)/.test(line);
    const text = isAssignment ? line : `__tmp__ = ${line}`;

    // ── Evaluate ──────────────────────────────────────────────────────────
    let result: EvalResult;
    try {
      result = evaluate(text, panel, fields);
    } catch (err) {
      console.log(c.red('Error: ') + (err instanceof Error ? err.message : String(err)));
      rl.prompt();
      return;
    }

    // Show errors first
    printDiagnostics(text, result);

    if (result.factorNames.length > 0) {
      // Persist panel with new columns
      panel = result.panel;

      // Save successful assignment lines to session (not anonymous expressions)
      if (isAssignment && result.diagnostics.every(d => d.severity !== 'error')) {
        sessionAppend(line);
      }

      // For anonymous exprs, don't pollute .cols — rename internally
      const displayNames = result.factorNames.filter(n => n !== '__tmp__');
      if (displayNames.length > 0) {
        printFactorColumns(result.panel, displayNames, DISPLAY_ROWS);
      } else if (result.factorNames.includes('__tmp__')) {
        // Anonymous expression — relabel __tmp__ with the original text for display
        const tmpCol = result.panel.getColumn('__tmp__');
        if (tmpCol !== undefined) {
          // Build a temporary display panel with the label set to the source line
          const displayPanel = new Panel(result.panel.rowCount, {
            web_name: result.panel.getString('web_name') ?? [],
            [line]: tmpCol,
          });
          printFactorColumns(displayPanel, [line], DISPLAY_ROWS);
        }
        // Remove __tmp__ column from the panel going forward (don't accumulate)
        // We can't remove a column, so just ignore it in future .cols listings
      }
    }

    rl.prompt();
  });

  rl.on('close', () => {
    if (isTTY) console.log(c.dim('\nBye.'));
  });
}

main();
