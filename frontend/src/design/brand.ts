/**
 * Brand colours (owner 2026-10-10, release 2.4.4): the installation's accent colour and the colour of a switch that is on, chosen by an
 * administrator in הגדרות › כללי › מראה המערכת (`ui.accent`, `ui.toggle_on`; backend services/brand_colors.py keeps the same preset list).
 *
 * A value is "default" (the skin's own colour - the system blue of the classic look), a preset id, or "#rrggbb". A choice other than
 * "default" becomes DU1 tokens for the scheme in force: `--sw-accent` with its hover / soft / text / focus / nav companions, and
 * `--sw-toggle-on`. They are written as inline custom properties on <html> through the same path as the bubble palette
 * (design/apply.ts -> palette.syncPalette), so they win over every skin; the glass screens follow through the `--sw-product-*` aliases
 * (design/tokens.ts). Companions are derived with `color-mix()` so a custom colour gets readable hover / soft / text shades in light
 * and dark without a table per colour.
 */

export const BRAND_DEFAULT = 'default';
/** The switch-on colour only (SET-polish, owner 2026-10-11): follows the accent, now and whenever the accent changes. */
export const BRAND_ACCENT = 'accent';
/** id -> #rrggbb; keep in step with PRESETS in smplwise_vms/backend/smplwise/services/brand_colors.py. */
export const BRAND_PRESETS: Readonly<Record<string, string>> = {
  ios_green: '#34c759',
  ios_blue: '#007aff',
  teal: '#0d9488',
  purple: '#7c3aed',
  orange: '#ea580c',
  pink: '#db2777',
  graphite: '#475569',
};
/** The classic skin's accent (light) - what "default" looks like in the swatch. */
export const SYSTEM_BLUE = '#2767ed';

export interface BrandColors {
  accent: string;
  toggle: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const CACHE_KEY = 'sw.ui.brand'; // the installation's last known choice: applied at once on the next load (no flash of the default)

/** A stored value in canonical form; anything unknown reads as "default". `which` = 'toggle' also admits "accent". */
export function normalizeBrand(v: unknown, which: 'accent' | 'toggle' = 'accent'): string {
  if (typeof v !== 'string') return BRAND_DEFAULT;
  const s = v.trim();
  if (s === BRAND_DEFAULT || Object.prototype.hasOwnProperty.call(BRAND_PRESETS, s)) return s;
  if (s === BRAND_ACCENT && which === 'toggle') return s;
  return HEX.test(s) ? s.toLowerCase() : BRAND_DEFAULT;
}

/** The hex of a value, or null for "default" (the skin's own colour) and for "accent" (whatever the accent resolves to). */
export function brandHex(v: unknown): string | null {
  const s = normalizeBrand(v, 'toggle');
  if (s === BRAND_DEFAULT || s === BRAND_ACCENT) return null;
  return BRAND_PRESETS[s] ?? s;
}

/** WCAG contrast of white text on this colour (the label of a primary button); the settings card warns below 3:1. */
export function contrastOnWhite(hex: string): number {
  const ch = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
  return 1.05 / (l + 0.05);
}

/** The tokens one choice writes for a scheme ({} when both are "default"). */
export function brandTokens(c: BrandColors, theme: 'light' | 'dark'): Record<string, string> {
  const out: Record<string, string> = {};
  const a = brandHex(c.accent);
  if (a) {
    out['--sw-accent'] = a;
    out['--sw-nav'] = a;
    if (theme === 'light') {
      out['--sw-accent-hover'] = `color-mix(in srgb, ${a} 86%, #000000)`;
      out['--sw-accent-soft'] = `color-mix(in srgb, ${a} 10%, #ffffff)`;
      out['--sw-accent-text'] = `color-mix(in srgb, ${a} 82%, #000000)`;
      out['--sw-focus'] = a;
    } else {
      out['--sw-accent-hover'] = `color-mix(in srgb, ${a} 80%, #ffffff)`;
      out['--sw-accent-soft'] = `color-mix(in srgb, ${a} 18%, transparent)`;
      out['--sw-accent-text'] = `color-mix(in srgb, ${a} 62%, #ffffff)`;
      out['--sw-focus'] = `color-mix(in srgb, ${a} 72%, #ffffff)`;
    }
  }
  if (normalizeBrand(c.toggle, 'toggle') === BRAND_ACCENT) out['--sw-toggle-on'] = 'var(--sw-accent)'; // the skin's accent or the one chosen above
  else {
    const t = brandHex(c.toggle);
    if (t) out['--sw-toggle-on'] = t;
  }
  return out;
}

function read(): BrandColors {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Partial<BrandColors> | null;
    return { accent: normalizeBrand(c?.accent), toggle: normalizeBrand(c?.toggle, 'toggle') };
  } catch {
    return { accent: BRAND_DEFAULT, toggle: BRAND_DEFAULT };
  }
}

let current: BrandColors = { accent: BRAND_DEFAULT, toggle: BRAND_DEFAULT };
const listeners = new Set<() => void>();

/** Boot: the last known choice (design/apply.ts calls it before the first paint). */
export function bootBrand(): void {
  current = read();
}

export const brandColors = (): BrandColors => ({ ...current });

/** The installation's `ui.accent` / `ui.toggle_on` as the product settings carry them (unknown values read as "default"). */
export function setBrandColors(accent: unknown, toggle: unknown): void {
  const next = { accent: normalizeBrand(accent), toggle: normalizeBrand(toggle, 'toggle') };
  if (next.accent === current.accent && next.toggle === current.toggle) return;
  current = next;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: the choice applies for this page view */
  }
  listeners.forEach((fn) => fn());
}

export function onBrand(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
