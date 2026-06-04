# ADR-002: Multi-source data architecture

- **Date**: 2026-06-04
- **Status**: Accepted

## Context

fplang currently has a single hard-coded data path: `data/loadSnapshot.ts` reads the FPL
`bootstrap-static.json` into one `Panel`. The field catalog (`src/catalog/fields.ts`) covers
the FPL API's player fields only.

The factor DSL's value scales directly with data richness. FPL's own fields leave important
signals on the table: Understat provides higher-quality shot data (xG by situation), FBRef
has defensive metrics and chance-quality breakdowns, odds APIs provide implied probabilities
for goals/CS, fixture services provide difficulty ratings. These sources are:

1. **Maintained by third parties** — each evolves independently.
2. **Owned by different people** — a community source might live in a contributor's repo.
3. **Differently shaped** — each has its own schema, update cadence, and missing-data policy.

Coupling all sources into the fplang core repo would bloat it, create hard dependencies on
third-party APIs at test time, and make it impossible for the community to contribute sources
without a core PR.

Separately: the old `docs/05-fields.md` inherited a `source:` concept from the DataLab
pipeline DSL that meant *FPL API endpoints within one application* (`source: players`,
`source: fixtures`, etc.). That terminology conflicts with the pluggable source model; this
ADR supersedes it.

## Decision

### 1. Source = independent repo

Each data source is a standalone module (typically its own repo) that implements the
`DataSource` contract exported by fplang core:

```ts
interface DataSource {
  /** Short identifier, used as the namespace prefix in factor expressions. */
  id: string;

  /** Fields this source contributes; declared upfront for sema/autocomplete. */
  fields: FieldDef[];

  /**
   * Load raw data and return it as a columnar Panel.
   * Column names must match the names in `fields[]`.
   * Rows are indexed to FPL element ids (see §4).
   */
  load(opts?: Record<string, unknown>): Panel | Promise<Panel>;

  /**
   * Optional: fill missing values in a column before the panel is merged.
   * Called per field after load(). Default policy: leave as NaN.
   */
  fillMissing?(col: Float64Array, fieldName: string): void;

  /**
   * Optional: static scaling coefficients applied to fields after load().
   * e.g. { raw_xg: 1.12 } multiplies the raw_xg column by 1.12.
   */
  coefficients?: Record<string, number>;
}
```

The source is responsible for: fetching/reading its raw data, mapping it to the declared
field schema, normalising rows to FPL element ids, and handling its own missing-data policy.
fplang core provides no helpers for HTTP fetching or format conversion — those belong in the
source.

### 2. Dotted namespace syntax in factor expressions

Fields are referenced as `source.field` in the DSL:

```
xg_over = fpl.goals_scored - understat.xg
captain = z(fpl.form) + z(understat.xg_per_90)
```

**Default source rule:** the `fpl` source is the default. Its fields may be referenced either
bare (`goals_scored`) or prefixed (`fpl.goals_scored`) — the two forms are identical.
This preserves full backward compatibility with all existing factor files, tests, and examples.

**Non-default sources** must always be prefixed. Writing `xg` alone when only
`understat.xg` exists is a sema error; there is no implicit "other default".

Grammar change: `source.field` is a new `QualifiedName` expression node in the AST,
distinct from a bare `Identifier`. The lexer tokenises `understat` and `xg` separately with
a `.` token between them; the parser consumes `Identifier DOT Identifier` into a
`QualifiedName` node. Source names (`source.`) are not valid factor definition names.

### 3. Source-aware field catalog

The `fields: FieldDef[]` parameter passed to `analyze()` and `evaluate()` becomes a union of
all active sources' field declarations, with each `FieldDef` extended to carry its source id:

```ts
interface FieldDef {
  name: string;
  source: string;          // 'fpl', 'understat', … — new field
  type: 'number' | 'string' | 'bool';
  description?: string;
}
```

The sema pass resolves `source.field` against `(source, name)` pairs. Diagnostics:
- `Unknown source 'understat'` if no active source has that id.
- `Unknown field 'xg' in source 'understat'` if the source is known but the field is not.

Bare identifiers in the `fpl` source continue to resolve without the prefix.

### 4. Panel merge by join on FPL element id

Before evaluation, each source's `load()` result is merged into one working `Panel` by
joining on the `id` column (FPL element id, integer). Core gains:

```ts
mergePanels(base: Panel, ...sources: Panel[]): Panel
// or as a method: Panel.join(other: Panel, on: 'id'): Panel
```

Each source panel **must** have an `id` column. Rows present in a source but absent from the
base `fpl` panel are dropped. Rows in the base panel absent from a source panel receive NaN
for that source's numeric fields and `''` for string fields (same as the `fillMissing`
default). Sources may override `fillMissing` to substitute a more meaningful default.

Name-based or fuzzy matching across sources is the source's own responsibility — it must
normalise to the FPL element id before returning its `Panel`.

### 5. `data/loadSnapshot.ts` becomes the reference `fpl` source

The existing `loadSnapshot.ts` + `src/catalog/fields.ts` are the reference implementation
of the `DataSource` contract for the built-in `fpl` source. They will be wrapped into a
`fplSource` object (backlog 023); the Panel they return continues to serve as the merge
base.

## Consequences

**Benefits:**
- Third-party source authors have a clean, minimal contract. No fplang core changes needed
  to add a new source — just publish a package and register it.
- The `fpl` source is isolated; its tests and snapshot data don't depend on anything
  external.
- Dotted syntax makes source origin explicit in factor code — auditable, predictable.
- Existing factors/tests/examples work unchanged (bare `fpl` fields remain valid).

**Costs / commitments:**
- **Parser change required** (backlog 019): `source.field` is a new grammar production and
  a new AST node (`QualifiedName`). The lexer, parser, sema, compile, and REPL all need
  updates.
- **Sema change required** (backlog 020): `analyze()` must resolve `QualifiedName` nodes
  against the source-aware catalog.
- **`DataSource` interface + registry** (backlog 021): core gains a registry and a
  catalog-merge utility.
- **Panel join utility** (backlog 022): a constrained join-on-id is now **in scope**. The
  general pipeline `join(source, on: field)` keyword (previously fully deferred in
  `09-roadmap.md`) remains deferred; only the source-merge join is added here.
- **`fpl` source refactor** (backlog 023): `loadSnapshot.ts` wrapped into `fplSource`.
- **Source name collision**: `source` prefixes are reserved identifiers; a user factor
  cannot be named `fpl`, `understat`, etc. Sema enforces this.
- XS/TS evaluation is unaffected — it operates on the merged panel after all sources are
  loaded.
