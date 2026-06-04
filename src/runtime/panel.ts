/**
 * Columnar player panel.
 * Numeric fields are stored as Float64Array; string/categorical fields as string[].
 * One row per player; all columns have the same length (rowCount).
 */
export type ColumnData = Float64Array | string[];

export class Panel {
  readonly rowCount: number;
  private readonly columns: Map<string, ColumnData>;

  constructor(rowCount: number, initial?: Record<string, ColumnData>) {
    this.rowCount = rowCount;
    this.columns = new Map();
    if (initial) {
      for (const [name, col] of Object.entries(initial)) {
        this.columns.set(name, col);
      }
    }
  }

  /** Get a column by name, or undefined if it doesn't exist. */
  getColumn(name: string): ColumnData | undefined {
    return this.columns.get(name);
  }

  /** Get a numeric column (Float64Array) or undefined. */
  getNumeric(name: string): Float64Array | undefined {
    const col = this.columns.get(name);
    return col instanceof Float64Array ? col : undefined;
  }

  /** Get a string column or undefined. */
  getString(name: string): string[] | undefined {
    const col = this.columns.get(name);
    return Array.isArray(col) ? col : undefined;
  }

  /** Add or replace a column. Throws if length doesn't match rowCount. */
  addColumn(name: string, data: ColumnData): void {
    if (data.length !== this.rowCount) {
      throw new Error(
        `Column '${name}' length ${data.length} does not match panel rowCount ${this.rowCount}`,
      );
    }
    this.columns.set(name, data);
  }

  /** Names of all columns in insertion order. */
  columnNames(): string[] {
    return Array.from(this.columns.keys());
  }

  /** Whether a column exists. */
  has(name: string): boolean {
    return this.columns.has(name);
  }

  /**
   * Get a scalar value at row i from a column (number or string).
   * Returns null if the column is numeric and the value is NaN/Infinity.
   */
  getValue(name: string, i: number): number | string | null {
    const col = this.columns.get(name);
    if (col === undefined) return null;
    if (col instanceof Float64Array) {
      const v = col[i];
      if (v === undefined || !isFinite(v)) return null;
      return v;
    }
    return col[i] ?? null;
  }

  /**
   * Return a plain object snapshot suitable for JSON serialisation.
   * Float64Arrays are converted to plain number arrays (nulls for non-finite values).
   */
  toObject(): Record<string, (number | null)[] | string[]> {
    const out: Record<string, (number | null)[] | string[]> = {};
    for (const [name, col] of this.columns) {
      if (col instanceof Float64Array) {
        out[name] = Array.from(col, v => (isFinite(v) ? v : null));
      } else {
        out[name] = col.slice();
      }
    }
    return out;
  }
}
