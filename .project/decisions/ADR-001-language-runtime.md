# ADR-001: Language / Runtime Decision

**Date:** 2026-06-02  
**Status:** Accepted

## Context

fplang is extracted from `fpl-elite/sandbox/` — a JS prototype that was regex preprocessing layered on `expr-eval`. We needed to choose the right language and runtime for the production engine.

## Decision: TypeScript core, browser-first, scale-ready later

**Language: TypeScript.** One codebase shared with the CodeMirror editor (which must run in the browser). One parser, one typecheck pass — no round-trips, no second parser per consumer. Python/C++ cannot run in the browser without a server round-trip or a heavy Pyodide/WASM tax (kills the interactive lab).

**Ambition: browser-first, scale-ready later.** Optimize for the interactive lab at FPL scale (~841 players) now, but architect columnar-first so heavier backtests slot in later via a JS-API'd columnar engine — each rung is a swap, not a rewrite.

**Migration: clean rewrite.** Build lexer → parser → typed AST → semantic analysis → columnar evaluator. Drop `expr-eval` and the regex preprocessing.

## Performance escape-hatch ladder

1. **Now:** Compiled closures over `Float64Array` columns. No per-row re-parse. O(n log n) rank. Already imperceptibly fast at 841 rows.
2. **When backtests need it:** DuckDB-WASM (browser + node) or nodejs-polars (Rust-backed, node-only) for the panel operations. Both speak Arrow. No language change — they slot under the TS engine as computation accelerators.
3. **If custom kernels at large scale ever justify it:** Rust→WASM (browser-preserving). The only "go native" path worth considering. Not now.

**Python:** kept for offline research notebooks. Not the runtime backend.  
**C++:** effectively never — ~6 orders of magnitude more headroom than this workload uses.

## Key design constraints that follow

- Lexer/parser must be **span-aware** (`{ from, to }` on every token/node) so the editor can use diagnostics for underlines and hover.
- **Public API** (`parse/analyze/evaluate/listFields`) is the substrate for CodeMirror, not just a CLI tool. No second parser in the editor.
- **Class propagation** through the dependency graph (a factor referencing an XS factor is XS).
- **6 decimal places** at the factor boundary.
- `series(field)` is legal only as the first argument of a `ts_*` call.
- Null propagates through arithmetic; Infinity/NaN → null.
