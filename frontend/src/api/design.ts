/**
 * Design switch: "SW A" (the 50-screen design handoff, mockups v1.3) and "SW B" (the earlier boards).
 * The product setting `ui.design` is the installation default, a per-browser override can differ, and
 * the names are editable (`ui.design_names`). Applied as `data-design` on <html> so tokens.css and the
 * shell switch together; demo mode (no backend) stays on SW B unless `?design=a` is given.
 */
import { productSettings } from './prefs';
import { isApi } from './session';

export type DesignId = 'a' | 'b';

const OVERRIDE_KEY = 'sw.design.override';
const LAST_KEY = 'sw.design.last';

export const DEFAULT_NAMES: Record<DesignId, string> = { a: 'SW A', b: 'SW B' };

let current: DesignId = 'b';
const listeners = new Set<(d: DesignId) => void>();

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

/** Seed synchronously from what this page load already knows (URL param, per-browser override, the design seen last),
 *  so the shell's first render is already right and screens are not recreated when the product setting arrives. */
function seedDesign(): DesignId {
  try {
    const url = new URLSearchParams(window.location.search).get('design');
    if (url === 'a' || url === 'b') return url;
  } catch {
    /* no window */
  }
  const override = safeGet(OVERRIDE_KEY);
  if (override === 'a' || override === 'b') return override;
  const last = safeGet(LAST_KEY);
  return last === 'a' || last === 'b' ? last : 'b';
}

current = seedDesign();

export function designOverride(): DesignId | null {
  const v = safeGet(OVERRIDE_KEY);
  return v === 'a' || v === 'b' ? v : null;
}

export function setDesignOverride(id: DesignId | null) {
  safeSet(OVERRIDE_KEY, id);
  void resolveDesign();
}

export function currentDesign(): DesignId {
  return current;
}

export function onDesign(fn: (d: DesignId) => void): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

export function applyDesign(id: DesignId) {
  current = id;
  document.documentElement.dataset.design = id;
  safeSet(LAST_KEY, id);
  listeners.forEach((fn) => fn(id));
}

export function parseNames(raw: string | undefined | null): Record<DesignId, string> {
  try {
    const o = raw ? (JSON.parse(raw) as Partial<Record<DesignId, string>>) : {};
    return { a: (o.a || DEFAULT_NAMES.a).slice(0, 24), b: (o.b || DEFAULT_NAMES.b).slice(0, 24) };
  } catch {
    return { ...DEFAULT_NAMES };
  }
}

/** Decide the design for this page load: URL param → per-browser override → product setting → mode default. */
export async function resolveDesign(): Promise<DesignId> {
  const url = new URLSearchParams(window.location.search).get('design');
  if (url === 'a' || url === 'b') {
    applyDesign(url);
    return url;
  }
  const override = designOverride();
  if (override) {
    applyDesign(override);
    return override;
  }
  if (!isApi()) {
    applyDesign('b');
    return 'b';
  }
  // avoid a flash: start from what this browser saw last, then follow the product setting
  const last = safeGet(LAST_KEY);
  if (last === 'a' || last === 'b') applyDesign(last);
  try {
    const s = await productSettings();
    const d = s['ui.design'] === 'b' ? 'b' : 'a';
    applyDesign(d);
    return d;
  } catch {
    applyDesign(last === 'b' ? 'b' : 'a');
    return current;
  }
}

export async function designNames(): Promise<Record<DesignId, string>> {
  if (!isApi()) return { ...DEFAULT_NAMES };
  try {
    return parseNames((await productSettings())['ui.design_names']);
  } catch {
    return { ...DEFAULT_NAMES };
  }
}
