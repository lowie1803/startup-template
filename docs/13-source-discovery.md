# 13 — Source Discovery Profile

Every data source that enters the fplang ecosystem produces a **discovery profile** before
any implementation begins. The profile is a capability manifest that answers the question
*"can this source feed our system, and how?"* — it drives the Data Manager binding decisions
that come next.

See `docs/discovery/` for worked instances.

---

## Purpose

1. **Gate the work** — a profile establishes whether the source is worth integrating at all
   (coverage, density, join viability) before writing any TypeScript.
2. **Drive the Data Manager binding** — the identity strategy, granularity, and density
   information here map directly to `SourceBinding` fields in `src/manager/types.ts`.
3. **Living reference** — kept in-repo so future contributors understand *why* a source is
   shaped the way it is without re-crawling the upstream API.

---

## Profile template

Each profile is a markdown file at `docs/discovery/<source-id>.md` following the structure
below. Every section is required; use `—` for fields genuinely not applicable.

---

```markdown
# Source Discovery: <source-id>

- **URL**: https://...
- **Crawl date**: YYYY-MM-DD
- **Crawler**: [name / automated]

## Identity

| Field          | Value |
|----------------|-------|
| Auth model     | API key / OAuth / open |
| Free tier      | yes / no — what is accessible |
| Rate limits    | N req / window; header name for remaining quota |
| Versioning     | latest stable version (e.g. v4) |
| Stability      | stable / beta / experimental |

## Endpoints & granularity (free tier)

List only endpoints reachable on the target subscription tier.

| Endpoint | Entity granularity | Key fields returned | Notes |
|----------|--------------------|---------------------|-------|
| /...     | competition / team / player / match | ... | ... |

## Native identity model

How the source keys its entities. This is the core constraint for Data Manager binding.

| Entity | Native key(s) | Handle to FPL | Strategy |
|--------|--------------|---------------|----------|
| team   | `tla` string | fpl `short_name` (+ override table) | team_broadcast |
| player | integer id + `name` | none (name-match only) | name_match (fragile) |

**No FPL player ids** — note explicitly if the source has no direct fpl-element-id. This
determines whether identity resolution is easy (`fpl_id`) or requires mapping logic.

## Candidate fields (FPL-relevant)

Fields from this source worth exposing as `<source>.<field>` in factor expressions.

| Candidate name | Native path | Entity level | Dense? | Fill strategy | Notes |
|----------------|-------------|--------------|--------|---------------|-------|
| table_position | standings.table[n].position | team → player | yes | none | broadcast to all players on team |

**Dense** = every player (or team) has a value in the raw data without special handling.

## Coverage for FPL seasons

Which PL seasons are available? Is historical data accessible on the free tier?

## Marginal value vs existing fpl source

What does this source add that the fpl bootstrap snapshot does NOT already contain?
Cross out any fields that duplicate existing `fpl.*` fields.

## Recommended integration path

One paragraph summarising the recommended `IdentityStrategy`, which fields to expose, and
any caveats (rate limits during snapshot fetch, override tables needed, etc.).

## Raw crawl artifacts

Links or inline samples from the discovery crawl (response shape excerpts). Commit any
raw JSON samples to `docs/discovery/samples/<source-id>/`.
```

---

## Lifecycle

| Stage | Who | Artifact |
|-------|-----|----------|
| 0. Discovery | data engineer | `docs/discovery/<source-id>.md` |
| 1. ADR / binding | architect | `DataManager.bind(source, binding)` call in ADR or integration doc |
| 2. Implementation | engineer | `src/sources/<source-id>/` or separate repo |
| 3. Validation | CI | `tsx bin/validate-source.ts` → exit 0 |

Stage 0 (this doc) is a prerequisite for stages 1–3 and should be reviewed before any code
is written.
