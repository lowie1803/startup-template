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

// ── Deferred domain functions (stubs) ─────────────────────────────────────────

function deferredStub(name: string): BuiltinFn {
  return () => {
    throw new Error(
      `'${name}' is a domain-specific lookup function not yet implemented. ` +
      `It requires a position-to-points mapping table (deferred feature).`,
    );
  };
}

// ── Registry ─────────────────────────────────────────────────────────────────

export const BUILTINS: Record<string, BuiltinFn> = {
  iff:       b_iff,
  coalesce:  b_coalesce,
  per90:     b_per90,
  min:       b_min,
  max:       b_max,
  abs:       b_abs,
  sqrt:      b_sqrt,
  log:       b_log,
  pow:       b_pow,
  round:     b_round,
  floor:     b_floor,
  ceil:      b_ceil,
  // Deferred domain lookups
  goal_points:  deferredStub('goal_points'),
  cs_points:    deferredStub('cs_points'),
  assist_points: deferredStub('assist_points'),
};
