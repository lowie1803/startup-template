/**
 * Builtin function registry for the scalar runtime.
 *
 * Each builtin takes N pre-evaluated arguments (number | string | null) and
 * returns (number | string | null).
 *
 * Null propagation is handled by the caller (compile.ts) for most arithmetic.
 * Builtins that explicitly handle null (iff, coalesce) receive raw values.
 *
 * NOTE: Domain-specific FPL lookup functions (goal_points, cs_points, assist_points,
 * etc.) are intentionally deferred — they require a position/element-type mapping
 * table. Stub them here to give a clear error when called.
 */

export type ScalarValue = number | string | null;
export type BuiltinFn = (args: ScalarValue[]) => ScalarValue;

// ── Null-aware helpers ────────────────────────────────────────────────────────

function toNum(v: ScalarValue, name: string): number {
  if (v === null) return NaN; // propagates to NaN → null in sanitize
  if (typeof v === 'number') return v;
  const n = Number(v);
  if (!isFinite(n)) throw new Error(`${name}: expected a number, got '${v}'`);
  return n;
}

// ── Builtin implementations ───────────────────────────────────────────────────

/** iff(condition, trueVal, falseVal) — null condition → null */
function b_iff(args: ScalarValue[]): ScalarValue {
  const [cond, t, f] = args;
  if (cond === null || cond === undefined) return null;
  return cond !== 0 && cond !== '' ? (t ?? null) : (f ?? null);
}

/** coalesce(a, b) — returns first non-null argument */
function b_coalesce(args: ScalarValue[]): ScalarValue {
  for (const a of args) {
    if (a !== null && a !== undefined) return a;
  }
  return null;
}

/** per90(stat, minutes) — null-safe rate per 90 */
function b_per90(args: ScalarValue[]): ScalarValue {
  const stat = toNum(args[0] ?? null, 'per90');
  const mins = toNum(args[1] ?? null, 'per90');
  if (!isFinite(stat) || !isFinite(mins) || mins === 0) return null;
  return (stat / mins) * 90;
}

function b_min(args: ScalarValue[]): ScalarValue {
  const nums = args.map((a, i) => toNum(a ?? null, `min[${i}]`));
  if (nums.some(n => !isFinite(n))) return null;
  return Math.min(...(nums as number[]));
}

function b_max(args: ScalarValue[]): ScalarValue {
  const nums = args.map((a, i) => toNum(a ?? null, `max[${i}]`));
  if (nums.some(n => !isFinite(n))) return null;
  return Math.max(...(nums as number[]));
}

function b_abs(args: ScalarValue[]): ScalarValue {
  const n = toNum(args[0] ?? null, 'abs');
  return isFinite(n) ? Math.abs(n) : null;
}

function b_sqrt(args: ScalarValue[]): ScalarValue {
  const n = toNum(args[0] ?? null, 'sqrt');
  if (!isFinite(n) || n < 0) return null;
  return Math.sqrt(n);
}

function b_log(args: ScalarValue[]): ScalarValue {
  const n = toNum(args[0] ?? null, 'log');
  if (!isFinite(n) || n <= 0) return null;
  return Math.log(n);
}

function b_pow(args: ScalarValue[]): ScalarValue {
  const base = toNum(args[0] ?? null, 'pow');
  const exp  = toNum(args[1] ?? null, 'pow');
  if (!isFinite(base) || !isFinite(exp)) return null;
  const result = Math.pow(base, exp);
  return isFinite(result) ? result : null;
}

function b_round(args: ScalarValue[]): ScalarValue {
  const n = toNum(args[0] ?? null, 'round');
  return isFinite(n) ? Math.round(n) : null;
}

function b_floor(args: ScalarValue[]): ScalarValue {
  const n = toNum(args[0] ?? null, 'floor');
  return isFinite(n) ? Math.floor(n) : null;
}

function b_ceil(args: ScalarValue[]): ScalarValue {
  const n = toNum(args[0] ?? null, 'ceil');
  return isFinite(n) ? Math.ceil(n) : null;
}

// ── Scalar additions (018 / cleanup) ─────────────────────────────────────────

/** clamp(x, lo, hi) — clamp x to [lo, hi]. Null in → null. */
function b_clamp(args: ScalarValue[]): ScalarValue {
  const x  = toNum(args[0] ?? null, 'clamp');
  const lo = toNum(args[1] ?? null, 'clamp');
  const hi = toNum(args[2] ?? null, 'clamp');
  if (!isFinite(x) || !isFinite(lo) || !isFinite(hi)) return null;
  return Math.min(Math.max(x, lo), hi);
}

/** isnull(x) — 1 if null, 0 otherwise. Never returns null. */
function b_isnull(args: ScalarValue[]): ScalarValue {
  return (args[0] ?? null) === null ? 1 : 0;
}

/** notnull(x) — 1 if not null, 0 otherwise. Never returns null. */
function b_notnull(args: ScalarValue[]): ScalarValue {
  return (args[0] ?? null) !== null ? 1 : 0;
}

/** exp(x) — e^x. Non-finite result → null. */
function b_exp(args: ScalarValue[]): ScalarValue {
  const n = toNum(args[0] ?? null, 'exp');
  if (!isFinite(n)) return null;
  const result = Math.exp(n);
  return isFinite(result) ? result : null;
}

// ── FPL domain lookups (018) ──────────────────────────────────────────────────
//
// Points lookup tables per the official FPL scoring rules:
//   Goals: GKP/DEF = 6, MID = 5, FWD = 4
//   Clean sheets: GKP/DEF = 4, MID = 1, FWD = 0
//   Assists: 3 pts regardless of position (handled as a constant)

/** goal_points(position) — points for a goal by position string. */
function b_goal_points(args: ScalarValue[]): ScalarValue {
  const pos = args[0];
  if (typeof pos !== 'string') return null;
  switch (pos) {
    case 'GKP': case 'DEF': return 6;
    case 'MID': return 5;
    case 'FWD': return 4;
    default: return null;
  }
}

/** cs_points(position) — points for a clean sheet by position string. */
function b_cs_points(args: ScalarValue[]): ScalarValue {
  const pos = args[0];
  if (typeof pos !== 'string') return null;
  switch (pos) {
    case 'GKP': case 'DEF': return 4;
    case 'MID': return 1;
    case 'FWD': return 0;
    default: return null;
  }
}

// ── Registry ─────────────────────────────────────────────────────────────────

export const BUILTINS: Record<string, BuiltinFn> = {
  iff:         b_iff,
  coalesce:    b_coalesce,
  per90:       b_per90,
  min:         b_min,
  max:         b_max,
  abs:         b_abs,
  sqrt:        b_sqrt,
  log:         b_log,
  exp:         b_exp,
  pow:         b_pow,
  round:       b_round,
  floor:       b_floor,
  ceil:        b_ceil,
  clamp:       b_clamp,
  isnull:      b_isnull,
  notnull:     b_notnull,
  goal_points: b_goal_points,
  cs_points:   b_cs_points,
};

/**
 * Bare-identifier runtime constants (not function calls).
 * Corresponds to sema's KNOWN_CONSTANTS in src/catalog/functions.ts.
 *   assist_points = 3 (FPL official scoring)
 */
export const CONSTANTS: Record<string, number> = {
  assist_points: 3,
};
