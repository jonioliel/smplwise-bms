/**
 * Runtime of the design layer: which skin and which scheme are in force, and putting them on the page.
 *
 *   skin   = ?skin= (this page view only, for designers and the evidence specs)
 *            > the installation's `ui.skin` (product setting; in the static demo, the choice saved in this browser)
 *            > "classic"
 *   scheme = ?scheme= > this browser's own choice (localStorage, "ההעדפה שלי") > the installation's `ui.scheme` > "light"
 *   "auto" follows the operating system (prefers-color-scheme) live.
 *
 *   rail   = the installation's `ui.rail_tone` (SKINCOMP-297: `auto` | `dark`; only a skin with a dark rail - Arx Infra - draws it)
 *
 * Output: `data-skin`, `data-theme` and (dark rail only) `data-rail="dark"` on <html> (the CSS of css.ts keys on them), the token <style>, and the skin's component
 * rules as ONE constructable stylesheet adopted into every shadow root (the whole UI lives in Lit shadow roots, which a
 * document stylesheet cannot reach). Replacing that sheet's text re-skins every live component without re-rendering.
 */
import { ReactiveElement } from 'lit';
import { DEFAULT_SKIN, SKIN_IDS, SKINS, darkRailOn, isRailTone, isSkinId, resolveSkin, type RailTone, type SkinId } from './skins';
import { skinRules, skinTable, tokensCss } from './css';
import { alphaFloor, liteAlpha, sheetModelOf, washCap, washModelOf } from './contrast';
import { bootLook, onLook, setAlphaFloor, setLiteAlpha, setWashCap } from './look';
import { activePaletteTokens, bootPalettes, onPalettes, syncPalette } from './palette';
import { bootBrand, brandColors, brandTokens, onBrand } from './brand';
import { applyBackground, bootBackground, onBackground } from './background';

export type Scheme = 'light' | 'dark' | 'auto';
export type Theme = 'light' | 'dark';
export const SCHEMES: readonly Scheme[] = ['light', 'dark', 'auto'];
export const isScheme = (v: unknown): v is Scheme => v === 'light' || v === 'dark' || v === 'auto';

/**
 * MOTIONSETTING-297: the installation's motion setting `ui.motion`. auto = follow the OS reduction (prefers-reduced-motion), full =
 * ignore the OS reduction for the non-essential motion the duration tokens drive, reduced = zero durations and press scale 1 (what
 * the OS reduction does). Written as `data-motion` on <html>; css.ts keys on it. Separate from the skin and the scheme.
 */
export type MotionMode = 'auto' | 'full' | 'reduced';
export const MOTION_MODES: readonly MotionMode[] = ['auto', 'full', 'reduced'];
export const isMotionMode = (v: unknown): v is MotionMode => v === 'auto' || v === 'full' || v === 'reduced';

/**
 * 2.29.0: the installation's entrance-animation setting `ui.entry_animations` (on | off, default on). The classic and domus skins let
 * a screen's panels fade in with a small rise (polish-motion.ts ENTER_RULES); `off` zeroes the three entrance tokens through
 * `data-enter="off"` on <html> (css.ts), so the panels simply appear. Independent of `ui.motion`.
 */
export type EnterMode = 'on' | 'off';
export const ENTER_MODES: readonly EnterMode[] = ['on', 'off'];
export const isEnterMode = (v: unknown): v is EnterMode => v === 'on' || v === 'off';

const CACHE_KEY = 'sw.ui.design'; // the installation's last known { skin, scheme, motion }: applied at once on the next load (no flash)
const OWN_SCHEME_KEY = 'sw.ui.scheme'; // this browser's own scheme choice

interface Installation {
  skin: SkinId;
  scheme: Scheme;
  motion: MotionMode;
  /** SKINCOMP-297: `ui.rail_tone`. */
  rail: RailTone;
  /** 2.29.0: `ui.entry_animations`. */
  enter: EnterMode;
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

let installation: Installation = { skin: DEFAULT_SKIN, scheme: 'light', motion: 'auto', rail: 'auto', enter: 'on' };
let ownScheme: Scheme | null = null;
let queryOverride: { skin: SkinId | null; scheme: Scheme | null; motion: MotionMode | null } = { skin: null, scheme: null, motion: null };
let sheet: CSSStyleSheet | null = null;
let sheetSkin: SkinId | null = null;
let darkQuery: MediaQueryList | null = null;
const listeners = new Set<() => void>();

function loadStored() {
  try {
    const c = JSON.parse(read(CACHE_KEY) ?? 'null') as Partial<Installation> | null;
    if (c && isSkinId(c.skin)) installation.skin = resolveSkin(c.skin) ?? DEFAULT_SKIN; // a frozen skin reads as the fallback (skins/index.ts)
    if (c && isScheme(c.scheme)) installation.scheme = c.scheme;
    if (c && isMotionMode(c.motion)) installation.motion = c.motion;
    if (c && isRailTone(c.rail)) installation.rail = c.rail;
    if (c && isEnterMode(c.enter)) installation.enter = c.enter;
  } catch {
    /* a corrupt cache reads as the defaults */
  }
  const own = read(OWN_SCHEME_KEY);
  ownScheme = isScheme(own) ? own : null;
  try {
    const q = new URLSearchParams(window.location.search);
    const s = q.get('skin');
    const m = q.get('scheme');
    const mo = q.get('motion'); // this page view only, for designers and the evidence specs
    queryOverride = { skin: resolveSkin(s), scheme: isScheme(m) ? m : null, motion: isMotionMode(mo) ? mo : null };
  } catch {
    /* no location */
  }
}

/** The skin in force. */
export const currentSkin = (): SkinId => queryOverride.skin ?? installation.skin;
/** The scheme setting in force (may be "auto"). */
export const currentScheme = (): Scheme => queryOverride.scheme ?? ownScheme ?? installation.scheme;
/** The motion setting in force (auto | full | reduced). */
export const currentMotion = (): MotionMode => queryOverride.motion ?? installation.motion;
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

/**
 * 2.29.0: the motion setting reaches EVERY component, including the ones whose CSS carries literal durations instead of the duration
 * tokens. When the motion in force is reduced (`ui.motion` = reduced, or auto under the OS prefers-reduced-motion; `full` ignores the
 * OS), one shared constructable sheet is adopted by the page and every Lit shadow root and zeroes every animation and transition
 * (iteration count 1, so a looping animation cannot flicker at ~0 ms). Colour/opacity state changes still happen, just instantly.
 */
export const REDUCED_ALL_CSS =
  '*,*::before,*::after{animation-duration:0.01ms !important;animation-delay:0s !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important;transition-delay:0s !important;scroll-behavior:auto !important}';
let motionSheet: CSSStyleSheet | null = null;
let motionQuery: MediaQueryList | null = null;
let motionSheetOn = false;
/** True when the motion in force is reduced. */
export function motionReduced(): boolean {
  const m = currentMotion();
  if (m === 'reduced') return true;
  if (m === 'full') return false;
  try {
    return !!motionQuery?.matches;
  } catch {
    return false;
  }
}
function syncMotionSheet() {
  if (!motionSheet) return;
  const on = motionReduced();
  if (on === motionSheetOn) return;
  motionSheetOn = on;
  motionSheet.replaceSync(on ? REDUCED_ALL_CSS : '');
}

function apply() {
  const root = document.documentElement;
  const skin = currentSkin();
  const theme = resolvedTheme();
  if (root.getAttribute('data-skin') !== skin) root.setAttribute('data-skin', skin);
  if (root.getAttribute('data-theme') !== theme) root.setAttribute('data-theme', theme);
  const motion = currentMotion();
  if (root.getAttribute('data-motion') !== motion) root.setAttribute('data-motion', motion);
  if (root.getAttribute('data-enter') !== installation.enter) root.setAttribute('data-enter', installation.enter);
  syncMotionSheet();
  // SKINCOMP-297: the dark rail of the skin (Arx Infra, direction D) - the attribute only while the skin has one and the tone asks for it
  if (darkRailOn(skin, installation.rail)) {
    if (root.getAttribute('data-rail') !== 'dark') root.setAttribute('data-rail', 'dark');
  } else if (root.hasAttribute('data-rail')) root.removeAttribute('data-rail');
  applyBackground(theme); // CRY: the artwork of the scheme (day / night) or the chosen picture, as `--sw-bg-image` on <html>
  if (sheet && sheetSkin !== skin) {
    sheet.replaceSync(skinRules(skin));
    sheetSkin = skin;
  }
  // the translucent sheet never drops below the alpha at which its text reads at 4.5:1 (design/contrast.ts, per skin and scheme)
  const t = skinTable(skin);
  // the palette of the look dial (bubble only): inline custom properties on <html>, so the floor below is computed from ITS colours
  const { palette, tokens: pt } = activePaletteTokens(skin, theme);
  // 2.4.4: the installation's brand colours (accent, switch on) ride the same inline layer, after the palette, so they win over it and
  // over every skin; one owner of the inline properties keeps a skin / palette switch from dropping them (design/brand.ts)
  // POLISH-295: the hover moves away from the label the skin / palette writes on the accent (white in the classic look)
  const bt = brandTokens(brandColors(), theme, pt?.['--sw-text-inverse'] ?? t['--sw-text-inverse']?.[theme] ?? '#ffffff');
  syncPalette(root, pt || Object.keys(bt).length ? { ...(pt ?? {}), ...bt } : null);
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

/** The installation's `ui.skin` / `ui.scheme` / `ui.motion` / `ui.rail_tone` as the product settings carry them (unknown or missing values keep the current ones). */
export function setInstallationDesign(skin: unknown, scheme: unknown, motion?: unknown, rail?: unknown, enter?: unknown) {
  const next: Installation = {
    skin: resolveSkin(skin) ?? installation.skin,
    scheme: isScheme(scheme) ? scheme : installation.scheme,
    motion: isMotionMode(motion) ? motion : installation.motion,
    rail: isRailTone(rail) ? rail : installation.rail,
    enter: isEnterMode(enter) ? enter : installation.enter,
  };
  if (next.skin === installation.skin && next.scheme === installation.scheme && next.motion === installation.motion && next.rail === installation.rail && next.enter === installation.enter) return;
  installation = next;
  write(CACHE_KEY, JSON.stringify(installation));
  apply();
}

/** The static demo (no backend) keeps "the installation's" choice in this browser: same cache, same effect. */
export function saveDemoDesign(skin: SkinId, scheme: Scheme, motion: MotionMode = installation.motion, rail: RailTone = installation.rail, enter: EnterMode = installation.enter) {
  installation = { skin: resolveSkin(skin) ?? DEFAULT_SKIN, scheme, motion, rail, enter };
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
  bootBackground(); // CRY: the background choice as last known (the picture is painted with the first apply)
  // the palette dial and the custom list re-apply the colours (the user's own override, the installation's, `?look=`)
  onLook(() => apply());
  onPalettes(() => apply());
  bootBrand(); // the brand colours as last known (no flash of the default accent)
  onBrand(() => apply());
  onBackground(() => apply());
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
    try {
      motionSheet = new CSSStyleSheet();
      motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      motionQuery.addEventListener('change', () => syncMotionSheet());
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, motionSheet];
    } catch {
      motionSheet = null;
    }
    // createRenderRoot is protected in Lit's typings; the patch only wraps it
    const proto = ReactiveElement.prototype as unknown as { createRenderRoot(): ShadowRoot | HTMLElement };
    const original = proto.createRenderRoot;
    proto.createRenderRoot = function patched(this: unknown) {
      const root = original.call(this);
      if (sheet && 'adoptedStyleSheets' in root) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet, ...(motionSheet ? [motionSheet] : [])];
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
