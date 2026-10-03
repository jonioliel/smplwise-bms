/**
 * Runtime of the design layer: which skin and which scheme are in force, and putting them on the page.
 *
 *   skin   = ?skin= (this page view only, for designers and the evidence specs)
 *            > the installation's `ui.skin` (product setting; in the static demo, the choice saved in this browser)
 *            > "classic"
 *   scheme = ?scheme= > this browser's own choice (localStorage, "ההעדפה שלי") > the installation's `ui.scheme` > "light"
 *   "auto" follows the operating system (prefers-color-scheme) live.
 *
 * Output: `data-skin` and `data-theme` on <html> (the CSS of css.ts keys on them), the token <style>, and the skin's component
 * rules as ONE constructable stylesheet adopted into every shadow root (the whole UI lives in Lit shadow roots, which a
 * document stylesheet cannot reach). Replacing that sheet's text re-skins every live component without re-rendering.
 */
import { ReactiveElement } from 'lit';
import { DEFAULT_SKIN, SKIN_IDS, SKINS, isSkinId, type SkinId } from './skins';
import { skinRules, skinTable, tokensCss } from './css';
import { alphaFloor, liteAlpha, sheetModelOf, washCap, washModelOf } from './contrast';
import { bootLook, onLook, setAlphaFloor, setLiteAlpha, setWashCap } from './look';
import { activePaletteTokens, bootPalettes, onPalettes, syncPalette } from './palette';

export type Scheme = 'light' | 'dark' | 'auto';
export type Theme = 'light' | 'dark';
export const SCHEMES: readonly Scheme[] = ['light', 'dark', 'auto'];
export const isScheme = (v: unknown): v is Scheme => v === 'light' || v === 'dark' || v === 'auto';

const CACHE_KEY = 'sw.ui.design'; // the installation's last known { skin, scheme }: applied at once on the next load (no flash)
const OWN_SCHEME_KEY = 'sw.ui.scheme'; // this browser's own scheme choice

interface Installation {
  skin: SkinId;
  scheme: Scheme;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts for this page view only */
  }
}

let installation: Installation = { skin: DEFAULT_SKIN, scheme: 'light' };
let ownScheme: Scheme | null = null;
let queryOverride: { skin: SkinId | null; scheme: Scheme | null } = { skin: null, scheme: null };
let sheet: CSSStyleSheet | null = null;
let sheetSkin: SkinId | null = null;
let darkQuery: MediaQueryList | null = null;
const listeners = new Set<() => void>();

function loadStored() {
  try {
    const c = JSON.parse(read(CACHE_KEY) ?? 'null') as Partial<Installation> | null;
    if (c && isSkinId(c.skin)) installation.skin = c.skin;
    if (c && isScheme(c.scheme)) installation.scheme = c.scheme;
  } catch {
    /* a corrupt cache reads as the defaults */
  }
  const own = read(OWN_SCHEME_KEY);
  ownScheme = isScheme(own) ? own : null;
  try {
    const q = new URLSearchParams(window.location.search);
    const s = q.get('skin');
    const m = q.get('scheme');
    queryOverride = { skin: isSkinId(s) ? s : null, scheme: isScheme(m) ? m : null };
  } catch {
    /* no location */
  }
}

/** The skin in force. */
export const currentSkin = (): SkinId => queryOverride.skin ?? installation.skin;
/** The scheme setting in force (may be "auto"). */
export const currentScheme = (): Scheme => queryOverride.scheme ?? ownScheme ?? installation.scheme;
export const installationDesign = (): Installation => ({ ...installation });
export const ownSchemeChoice = (): Scheme | null => ownScheme;

function systemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}
/** The scheme as the page shows it: "light" or "dark". */
export const resolvedTheme = (): Theme => {
  const s = currentScheme();
  return s === 'auto' ? (systemDark() ? 'dark' : 'light') : s;
};

function apply() {
  const root = document.documentElement;
  const skin = currentSkin();
  const theme = resolvedTheme();
  if (root.getAttribute('data-skin') !== skin) root.setAttribute('data-skin', skin);
  if (root.getAttribute('data-theme') !== theme) root.setAttribute('data-theme', theme);
  if (sheet && sheetSkin !== skin) {
    sheet.replaceSync(skinRules(skin));
    sheetSkin = skin;
  }
  // the translucent sheet never drops below the alpha at which its text reads at 4.5:1 (design/contrast.ts, per skin and scheme)
  const t = skinTable(skin);
  // the palette of the look dial (bubble only): inline custom properties on <html>, so the floor below is computed from ITS colours
  const { palette, tokens: pt } = activePaletteTokens(skin, theme);
  syncPalette(root, pt);
  const model = sheetModelOf((n) => pt?.[n] ?? t[n]?.[theme] ?? '');
  // a palette also carries its own minimum glass opacity (high-contrast: 88 %); the computed floor never goes below it
  setAlphaFloor(Math.max(model ? alphaFloor(model) : 1, palette ? palette.schemes[theme].glass.opacity.min : 0));
  setLiteAlpha(model ? liteAlpha(model) : 1); // the lite tier's tinted layers (no blur) keep the same 4.5:1 guard
  // MD1: the state wash of the tint dial never goes past the share at which text stops reading on a washed tile (per skin x palette x scheme)
  const wash = washModelOf((n) => pt?.[n] ?? t[n]?.[theme] ?? '');
  setWashCap(wash ? washCap(wash) : 0);
  listeners.forEach((fn) => fn());
}

/** Subscribe to skin / scheme changes (called after the page attributes are updated). Returns the unsubscribe. */
export function onDesign(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The installation's `ui.skin` / `ui.scheme` as the product settings carry them (unknown values keep the current ones). */
export function setInstallationDesign(skin: unknown, scheme: unknown) {
  const next: Installation = { skin: isSkinId(skin) ? skin : installation.skin, scheme: isScheme(scheme) ? scheme : installation.scheme };
  if (next.skin === installation.skin && next.scheme === installation.scheme) return;
  installation = next;
  write(CACHE_KEY, JSON.stringify(installation));
  apply();
}

/** The static demo (no backend) keeps "the installation's" choice in this browser: same cache, same effect. */
export function saveDemoDesign(skin: SkinId, scheme: Scheme) {
  installation = { skin, scheme };
  write(CACHE_KEY, JSON.stringify(installation));
  apply();
}

/** This browser's own scheme (null clears it: the installation's applies again). */
export function setOwnScheme(scheme: Scheme | null) {
  ownScheme = scheme;
  write(OWN_SCHEME_KEY, scheme);
  apply();
}

/** Boot: read what is stored, inject the token CSS, adopt the skin sheet into shadow roots, follow the OS scheme. Idempotent. */
let booted = false;
export function bootDesign() {
  if (booted) return;
  booted = true;
  loadStored();
  bootLook(); // the look dials (data-bubble-* and the numeric custom properties on <html>), before the first paint
  bootPalettes(); // the installation's custom palettes as last known (no flash of the default colours)
  // the palette dial and the custom list re-apply the colours (the user's own override, the installation's, `?look=`)
  onLook(() => apply());
  onPalettes(() => apply());
  // the token CSS is a constructable stylesheet: the strict CSP candidate (remote channel) refuses inline <style> elements
  try {
    const tokens = new CSSStyleSheet();
    tokens.replaceSync(tokensCss());
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, tokens];
  } catch {
    const style = document.createElement('style');
    style.id = 'sw-design-tokens';
    style.textContent = tokensCss();
    document.head.appendChild(style);
  }
  try {
    sheet = new CSSStyleSheet();
    // createRenderRoot is protected in Lit's typings; the patch only wraps it
    const proto = ReactiveElement.prototype as unknown as { createRenderRoot(): ShadowRoot | HTMLElement };
    const original = proto.createRenderRoot;
    proto.createRenderRoot = function patched(this: unknown) {
      const root = original.call(this);
      if (sheet && 'adoptedStyleSheets' in root) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      return root;
    };
  } catch {
    sheet = null; // no constructable stylesheets: tokens still apply (the skins' rules are the only thing lost)
  }
  try {
    darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkQuery.addEventListener('change', () => {
      if (currentScheme() === 'auto') apply();
    });
  } catch {
    darkQuery = null;
  }
  apply();
}

export { SKIN_IDS, SKINS };
