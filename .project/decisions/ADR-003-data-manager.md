# ADR-003: Data Manager

- **Date**: 2026-06-07
- **Status**: accepted

## Context

ADR-002 introduced a `DataSource` contract where **each source is responsible for mapping
itself to FPL element ids** before returning its Panel. This worked cleanly for the `fpl`
source (which naturally has fpl ids) but creates a problem when integrating foreign sources:

- **football-data.org** (and by extension most external sources) has no FPL player ids.
  Its native keys are its own integers, team `tla` codes, and player names.
- The current `DataSource.load()` contract forces identity resolution *into* each source.
  A source author must embed fpl-id mapping logic (team-broadcast, name-match, override
  tables) inside their `load()` implementation, coupling data ingestion to identity mapping.
- The source registry (`src/sources/registry.ts`) and merged catalog were built but **never
  wired into `evaluate` / `analyze`** — the public API still accepts naked `Panel + FieldDef[]`
  and callers assemble them manually. There is no single orchestrated entry point.
- `DataSource.coefficients` was declared in the contract but never applied anywhere — dead field.

The **Data Manager** is the layer that absorbs these responsibilities so sources can stay
close to their raw shape.

## Decision

Introduce a `DataManager` class (`src/manager/`) positioned **above `DataSource`/
`SourceRegistry`** and **below `evaluate`/`analyze`**.

### Responsibilities

**1. Registry** — wraps the existing `sourceRegistry`. Sources are registered once via
`DataManager.bind()` (not the raw registry directly), pairing each source with a binding.

**2. Centralized identity resolution** — an `IdentityStrategy` declares *how* a source's
panel is mapped to FPL-element-id rows. The Data Manager applies the strategy so source
`load()` can return its raw native-keyed panel, delegating the mapping to the binding:

| Strategy | Description | When to use |
|----------|-------------|-------------|
| `'fpl_id'` | Panel already carries fpl element ids. No mapping needed. | fpl source |
| `'team_broadcast'` | Map team-level stats to all players on each team via a tla→fpl-short-name lookup table. | football-data standings |
| `'name_match'` | Fuzzy name + DOB match against fpl roster. Fragile; opt-in only. | last resort; not recommended for dense fields |

The resolved panel is then handed to the existing `mergePanels` (`src/runtime/merge.ts:26`).

**3. Field projection** — each binding declares which raw columns from the source panel are
exposed as `FieldDef[]` (with `source` set, descriptions, fill policies). The Data Manager
builds the merged catalog from all bound sources' projected fields.

**4. Pipeline orchestration** — `DataManager.panel()` runs the full pipeline:
```
load() → [apply coefficients] → applyFills() → identity resolve → mergePanels() → validateDataset()
```
Returns `{ fields: FieldDef[], panel: Panel }` ready for `evaluate`/`analyze`.

**5. Wire-in hook** (deferred — ticket 029) — `src/index.ts`'s `evaluate` and `analyze`
will optionally accept a `DataManager` in place of bare `Panel + FieldDef[]`. Until then,
the manager's output `{ fields, panel }` is passed explicitly.

### Backward compatibility

- `DataSource` contract is unchanged. Sources implementing `'fpl_id'` strategy (like `fpl`)
  require no modification — their `load()` already returns fpl-id panels.
- `SourceRegistry` is retained and wrapped (not replaced).
- `evaluate(text, panel, fields)` and `analyze(text, fields)` signatures are unchanged for
  ticket 029; the manager is an additive entry point.

### Disposition of dead fields

- **`coefficients`** — formally adopted in the Data Manager pipeline. Applied as a per-column
  scalar multiply *after* `load()` and *before* `applyFills()`. If `coefficients` is undefined
  or empty, the step is a no-op (no behavioral change for existing sources).
- **`fillMissing(col, field: FieldDef)`** — the correct signature is confirmed: `field` is
  a `FieldDef`, not a string. The docs bug (`docs/11-data-sources.md`) will be corrected in
  ticket 028.

### Source discovery prerequisite

Every source integrated via the Data Manager must first produce a **discovery profile**
(`docs/discovery/<source-id>.md`, see `docs/13-source-discovery.md`) that documents its
identity model, candidate fields, and density. The profile determines the `IdentityStrategy`
and binding configuration before any code is written.

## Consequences

**Positive:**
- Sources stay close to their raw data shape; identity mapping is a first-class concern in
  the binding layer, not buried in each source's `load()`.
- Single orchestrated entry point eliminates the manual `load → fill → merge` wiring each
  consumer had to do.
- `coefficients` is no longer dead code — it applies before fill, enabling unit alignment.
- Standardized discovery profiles make future source onboarding auditable and repeatable.

**Negative / trade-offs:**
- Adds a new layer; team-broadcast and name-match strategies require the `DataManager` to
  have access to the fpl base panel (to know which players are on which team). The base
  source (`fpl`) must be the first source bound — a documented ordering constraint.
- The `SourceBinding` type (pairing a `DataSource` with an `IdentityStrategy` + config) is
  a new concept that source authors must understand, even though it lives outside the source
  itself.
- Full wire-in to `evaluate`/`analyze` is deferred (ticket 029) to keep this ticket scoped
  to skeleton only.
