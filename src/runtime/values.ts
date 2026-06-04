/**
 * Boundary helpers for the scalar runtime.
 * All numeric factor outputs pass through sanitize() + round6() before being
 * stored as column values.
 */

export const NULL_SENTINEL = NaN; // used inside Float64Array to represent null

/**
 * Convert a raw computed number to the stored representation:
 * - Infinity / -Infinity / NaN → NaN (null sentinel)
 * - Finite numbers pass through unchanged (rounding happens at the boundary)
 */
export function sanitize(n: number): number {
  return isFinite(n) ? n : NaN;
}

/**
 * Round a finite number to 6 decimal places.
 * Call this at the factor boundary (after sanitize).
 */
export function round6(n: number): number {
  // Multiply, round, divide — avoids floating-point accumulation in the multiply
  return Math.round(n * 1_000_000) / 1_000_000;
}

/**
 * Apply the null / Infinity guard and 6dp rounding in one pass.
 * Returns NaN (null sentinel) for non-finite inputs.
 */
export function finalize(n: number): number {
  if (!isFinite(n)) return NaN;
  return round6(n);
}

/**
 * Read a Float64Array element and decode the null sentinel to JS null.
 */
export function decodeNull(v: number | undefined): number | null {
  if (v === undefined || !isFinite(v)) return null;
  return v;
}
