/**
 * LocalStorage-backed factor library persistence.
 *
 * Two tiers:
 *   1. Auto-save ring  — fplang:autosave  — up to 20 timestamped snapshots, rolling.
 *   2. Named saves     — fplang:libraries — pinned, never evicted.
 */

const AUTOSAVE_KEY   = 'fplang:autosave';
const LIBRARIES_KEY  = 'fplang:libraries';
const AUTOSAVE_LIMIT = 20;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AutosaveEntry {
  ts: string;   // ISO timestamp
  text: string;
}

export interface NamedLibrary {
  name: string;
  text: string;
  savedAt: string; // ISO timestamp
}

// ── Auto-save ring ─────────────────────────────────────────────────────────────

export function autosavePush(text: string): void {
  const ring = autosaveList();
  ring.unshift({ ts: new Date().toISOString(), text });
  if (ring.length > AUTOSAVE_LIMIT) ring.length = AUTOSAVE_LIMIT;
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(ring));
  } catch {
    // Storage quota exceeded — drop oldest and retry once
    ring.length = Math.max(1, ring.length - 5);
    try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(ring)); } catch { /* ignore */ }
  }
}

export function autosaveList(): AutosaveEntry[] {
  try {
    return JSON.parse(localStorage.getItem(AUTOSAVE_KEY) ?? '[]') as AutosaveEntry[];
  } catch {
    return [];
  }
}

/** Return the most recent autosaved text, or null if the ring is empty. */
export function autosaveLatest(): string | null {
  return autosaveList()[0]?.text ?? null;
}

// ── Named saves ───────────────────────────────────────────────────────────────

function loadLibraries(): Record<string, NamedLibrary> {
  try {
    return JSON.parse(localStorage.getItem(LIBRARIES_KEY) ?? '{}') as Record<string, NamedLibrary>;
  } catch {
    return {};
  }
}

function saveLibraries(libs: Record<string, NamedLibrary>): void {
  localStorage.setItem(LIBRARIES_KEY, JSON.stringify(libs));
}

export function librarySave(name: string, text: string): void {
  const libs = loadLibraries();
  libs[name] = { name, text, savedAt: new Date().toISOString() };
  saveLibraries(libs);
}

export function libraryLoad(name: string): string | null {
  return loadLibraries()[name]?.text ?? null;
}

export function libraryDelete(name: string): void {
  const libs = loadLibraries();
  delete libs[name];
  saveLibraries(libs);
}

export function libraryList(): NamedLibrary[] {
  return Object.values(loadLibraries()).sort(
    (a, b) => b.savedAt.localeCompare(a.savedAt),
  );
}

// ── Download ──────────────────────────────────────────────────────────────────

export function downloadFactors(name: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${name.replace(/[^a-z0-9_-]/gi, '_')}.factors`;
  a.click();
  URL.revokeObjectURL(url);
}
