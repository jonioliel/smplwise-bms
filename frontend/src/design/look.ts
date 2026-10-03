/**
 * The look dials (Bubble foundation, owner decisions 2026-10-02): every presentation option of a skin is a setting the owner
 * can change through the UI, nothing is hard-coded. Backend twin: smplwise_vms/backend/smplwise/services/look.py (same lists,
 * same ranges; a value outside them is a 422 there and reads as "not set" here).
 *
 * One value shape, `ui.look`, owned twice:
 *   - the installation default (`ui.look` product setting): every dial present;
 *   - the user's own override (`ui.look` of /me/prefs): a PARTIAL object - a dial that is absent follows the installation;
 *     null clears the override. The static demo has no backend: the override then lives in this browser only.
 * `?look=density:compact,surface:glass` overrides the page view only (designers, the evidence specs); nothing is stored.
 *
 * `lookOf(dial)` is THE resolver (next to tabModeOf / navSize): the user's dial, else the installation's, else the built-in.
 * Output on <html>: data attributes for the enumerated dials (`data-bubble-density`, `-surface`, `-popup`, `-radius`, `-touch`) and
 * custom properties for the numbers (`--sw-sheet-alpha`, `--sw-look-scale`, `--sw-touch-desktop`). The CSS of css.ts turns the
 * enumerated dials into token bundles keyed on the attributes (any element may carry one, so a preview box can show a draft),
 * and the components read the tokens. The bubble skin is the one that draws all of this; the other skins ignore the attributes.
 */
import { getMyPrefs, putMyPrefs } from '../api/me-prefs';
import { autoTier, readCaps, capsVerdict, type PerformanceMode, type Tier } from './performance';
import rawPalettes from './palettes.json' with { type: 'json' };

/** Only the ids and Hebrew names of the ready palettes are read here (the colours are design/palette.ts's). */
const palettesFile = rawPalettes as unknown as { palettes: { id: string; name: { he: string } }[] };

export type Density = 'wide' | 'regular' | 'compact' | 'row';
export type Surface = 'flat' | 'glass' | 'gradient' | 'fill';
export type Popup = 'sheet' | 'centred' | 'inline';
export type Radius = 'pill' | 'soft' | 'square';
export type Touch = 32 | 44;
/** `default` (the skin's own colours), one of the ten ready palette ids, or `custom-<slug>` (an installation's custom palette, design/palette.ts). */
export type PaletteId = string;
export type Performance = PerformanceMode;

export interface Look {
  density: Density;
  surface: Surface;
  popup: Popup;
  radius: Radius;
  /** Opacity of translucent layers in percent (100 = opaque). */
  transparency: number;
  /** Size of the components in percent. */
  scale: number;
  /** The minimum pointer target on a desktop, in px (touch layouts are always 44). */
  touch: Touch;
  /** What the glass costs: `lite` = no blur on cards, pills, rows and lists (the dock, rail, tree, scrim and the open pop-up keep theirs); `auto` = this device decides (design/performance.ts). */
  performance: Performance;
  palette: PaletteId;
}
export type LookDial = keyof Look;
export type PartialLook = Partial<Look>;

interface ChoiceDial<T extends string | number> {
  kind: 'choice';
  values: readonly T[];
  labelHe: Record<string, string>;
  hintHe: Record<string, string>;
  nameHe: string;
}
interface RangeDial {
  kind: 'range';
  range: readonly [number, number];
  step: number;
  unit: '%';
  nameHe: string;
}

/** The dials, in the order the settings card shows them. The lists and ranges are the backend's (services/look.py). */
export const LOOK_DIALS = {
  density: {
    kind: 'choice',
    values: ['wide', 'regular', 'compact', 'row'],
    nameHe: 'צפיפות',
    labelHe: { wide: 'רחב', regular: 'רגיל', compact: 'דחוס', row: 'שורות' },
    hintHe: { wide: 'כרטיסים גדולים, פחות בשורה', regular: 'כמוסות בגובה 56', compact: 'כמוסות קטנות, יותר בשורה', row: 'רשימה: שורה לכל פריט' },
  } satisfies ChoiceDial<Density>,
  surface: {
    kind: 'choice',
    values: ['flat', 'glass', 'gradient', 'fill'],
    nameHe: 'משטח',
    labelHe: { flat: 'שטוח', glass: 'זכוכית', gradient: 'צבעוני', fill: 'מילוי' },
    hintHe: { flat: 'משטח אחיד', glass: 'שכבה שקופה ומטושטשת', gradient: 'גוון לכל פריט', fill: 'המילוי מראה את העוצמה' },
  } satisfies ChoiceDial<Surface>,
  popup: {
    kind: 'choice',
    values: ['sheet', 'centred', 'inline'],
    nameHe: 'חלון קופץ',
    labelHe: { sheet: 'גיליון', centred: 'ממורכז', inline: 'בתוך הדף' },
    hintHe: { sheet: 'מהתחתית בטלפון, ממורכז במחשב', centred: 'תמיד באמצע המסך', inline: 'נפתח במקום, לא מכסה את עץ הבניין' },
  } satisfies ChoiceDial<Popup>,
  radius: {
    kind: 'choice',
    values: ['pill', 'soft', 'square'],
    nameHe: 'פינות',
    labelHe: { pill: 'כמוסה', soft: 'רכות', square: 'ישרות' },
    hintHe: { pill: 'עגולות לגמרי', soft: 'מעוגלות', square: 'כמעט ישרות' },
  } satisfies ChoiceDial<Radius>,
  transparency: { kind: 'range', range: [40, 100], step: 2, unit: '%', nameHe: 'אטימות' } satisfies RangeDial,
  scale: { kind: 'range', range: [80, 130], step: 5, unit: '%', nameHe: 'גודל' } satisfies RangeDial,
  touch: {
    kind: 'choice',
    values: [32, 44],
    nameHe: 'יעד לחיצה במחשב',
    labelHe: { 32: '32', 44: '44' },
    hintHe: { 32: 'צפוף יותר, לעכבר', 44: 'כמו בטלפון' },
  } satisfies ChoiceDial<Touch>,
  performance: {
    kind: 'choice',
    values: ['auto', 'full', 'lite'],
    nameHe: 'ביצועים',
    labelHe: { auto: 'אוטומטי', full: 'מלא', lite: 'קל' },
    hintHe: { auto: 'המכשיר מחליט לפי כוחו', full: 'טשטוש זכוכית בכל השכבות', lite: 'בלי טשטוש בכרטיסים וברשימות, לטאבלט קיר ולטלפון חלש' },
  } satisfies ChoiceDial<Performance>,
  // the fixed choices = `default` + every palette of design/palettes.json (the backend lists the same file); a `custom-<slug>` id is valid too
  // (CUSTOM_PALETTE_ID). Adding a palette is a data-only change: append it to the file (docs/design/palettes/README.md).
  palette: {
    kind: 'choice',
    values: ['default', ...palettesFile.palettes.map((p) => p.id)],
    nameHe: 'צבעים',
    labelHe: { default: 'ברירת מחדל', ...Object.fromEntries(palettesFile.palettes.map((p) => [p.id, p.name.he])) },
    hintHe: { default: 'הצבעים של סגנון Bubble' },
  } satisfies ChoiceDial<PaletteId>,
} as const;

/** A custom palette's dial value (the backend's CUSTOM_ID_RE): a lower-case kebab slug after `custom-`. */
export const CUSTOM_PALETTE_ID = /^custom-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const LOOK_DIAL_IDS = ['density', 'surface', 'popup', 'radius', 'transparency', 'scale', 'touch', 'performance', 'palette'] as const satisfies readonly LookDial[];

export const LOOK_DEFAULT: Readonly<Look> = { density: 'regular', surface: 'fill', popup: 'sheet', radius: 'pill', transparency: 72, scale: 100, touch: 44, performance: 'auto', palette: 'default' };

/** The backend's rule for one dial: a listed value / a whole in-range number, else null. */
export function normalizeDial<K extends LookDial>(dial: K, v: unknown): Look[K] | null {
  const d = LOOK_DIALS[dial] as ChoiceDial<string | number> | RangeDial;
  if (dial === 'palette') return typeof v === 'string' && (d.kind === 'choice' && (d.values as readonly unknown[]).includes(v) || (v.length <= 40 && CUSTOM_PALETTE_ID.test(v))) ? (v as Look[K]) : null;
  if (d.kind === 'choice') return (d.values as readonly unknown[]).includes(v) ? (v as Look[K]) : null;
  if (typeof v !== 'number' || !Number.isInteger(v)) return null;
  return v >= d.range[0] && v <= d.range[1] ? (v as Look[K]) : null;
}

/** A stored value reduced to the known dials with valid values (a stored string is parsed); never throws. Unknown dials and values are dropped. */
export function normalizeLook(raw: unknown): PartialLook {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  const out: PartialLook = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const dial of LOOK_DIAL_IDS) {
      const v = normalizeDial(dial, (value as Record<string, unknown>)[dial]);
      if (v !== null) (out as Record<string, unknown>)[dial] = v;
    }
  }
  return out;
}

export const sameLook = (a: PartialLook, b: PartialLook): boolean => JSON.stringify(a) === JSON.stringify(b);

// ---- the effective value: ?look= over the user's own over the installation's over the built-in ----

const CACHE_KEY = 'sw.ui.look'; // this user's own override, applied at once on the next load (no flash)
const INST_KEY = 'sw.ui.look.installation'; // the installation's last known default (and, in the static demo, "the installation")
let installation: Look = { ...LOOK_DEFAULT };
let own: PartialLook = {};
let query: PartialLook = {};
let user: string | null = null;
let remote = false;
const listeners = new Set<() => void>();

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

function notify(): void {
  applyLook();
  for (const l of listeners) l();
}

/** The shell, the components with a LookController and the settings card follow every change. */
export function onLook(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** THE resolver: the dial in force. */
export function lookOf<K extends LookDial>(dial: K): Look[K] {
  // the palette is chosen by the installation's system administrator only (owner 2026-10-02): a personal value is never read
  if (dial === 'palette') return (query.palette ?? installation.palette ?? LOOK_DEFAULT.palette) as Look[K];
  return (query[dial] ?? own[dial] ?? installation[dial] ?? LOOK_DEFAULT[dial]) as Look[K];
}
/** A personal override without the palette (an older stored value may carry one; it is ignored). */
const withoutPalette = (v: PartialLook): PartialLook => {
  const { palette: _ignored, ...rest } = v;
  return rest;
};
/** Every dial in force. */
export function look(): Look {
  const out: Record<string, unknown> = {};
  for (const d of LOOK_DIAL_IDS) out[d] = lookOf(d);
  return out as unknown as Look;
}
export const installationLook = (): Look => ({ ...installation });
/** The user's own override (only the dials they set). */
export const ownLook = (): PartialLook => ({ ...own });

/** A Lit reactive controller for a component that depends on a dial (re-renders the host on every change). */
export class LookController {
  private stop?: () => void;
  constructor(private host: { requestUpdate(): void; addController(c: unknown): void }) {
    host.addController(this);
  }
  get value(): Look {
    return look();
  }
  of<K extends LookDial>(dial: K): Look[K] {
    return lookOf(dial);
  }
  hostConnected() {
    this.stop = onLook(() => this.host.requestUpdate());
  }
  hostDisconnected() {
    this.stop?.();
  }
}

// ---- the performance tier: the dial, resolved to what is drawn (`full` | `lite`) ----

let autoResolved: Tier | null = null;
/** `auto` re-resolved (the cache or a weak capability; starts the probe when there is neither). Called at boot and after the probe. */
export function refreshAutoPerformance(): void {
  const before = autoResolved;
  // the probe (a blurred layer over a moving backdrop for ~700 ms) only runs while the dial is `auto`; an explicit full / lite never pays for it
  // (and a page pinned with ?look=performance:full is deterministic: the pixel specs rely on it). If the dial later turns to `auto`, applyLook retries.
  const probe = lookOf('performance') === 'auto';
  probeDeferred = !probe;
  autoResolved = autoTier(() => refreshAutoPerformance(), probe);
  if (before !== autoResolved) notify();
}
let probeDeferred = false;
/** The tier a dial value is drawn as: `full` / `lite` as chosen, `auto` as this device decided. */
export function tierOf(mode: Performance): Tier {
  if (mode !== 'auto') return mode;
  if (autoResolved === null) autoResolved = capsVerdict(readCaps()) ? 'lite' : 'full'; // before boot: the free check only (no probe, no cache read)
  return autoResolved;
}
/** The tier in force on this page. */
export const effectivePerformance = (): Tier => tierOf(lookOf('performance'));

/** The contrast floor of the sheet's alpha, set by design/contrast.ts once the skin and scheme are known (see applyLook). */
let alphaFloor = 0;
export function setAlphaFloor(v: number) {
  alphaFloor = Math.max(0, Math.min(1, v));
  applyLook();
}
/** The alpha of an un-blurred translucent layer in the lite tier (design/contrast.ts computes the floor; apply.ts sets it). */
let liteAlpha = 0.9;
export function setLiteAlpha(v: number) {
  liteAlpha = Math.max(0.5, Math.min(1, v));
  applyLook();
}
export const liteAlphaInForce = (): number => liteAlpha;
/** The sheet alpha in force: the transparency dial, never below the computed contrast floor. */
export function effectiveSheetAlpha(): number {
  return Math.max(alphaFloor, lookOf('transparency') / 100);
}

/** Put the dials on <html>: data attributes for the enumerated ones, custom properties for the numbers. Idempotent. */
export function applyLook(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const set = (name: string, v: string) => {
    if (root.getAttribute(name) !== v) root.setAttribute(name, v);
  };
  set('data-bubble-density', lookOf('density'));
  set('data-bubble-surface', lookOf('surface'));
  set('data-bubble-popup', lookOf('popup'));
  set('data-bubble-radius', lookOf('radius'));
  set('data-bubble-touch', String(lookOf('touch')));
  if (probeDeferred && lookOf('performance') === 'auto') refreshAutoPerformance(); // the dial turned to auto after boot: resolve it now (cache, free check, probe)
  set('data-bubble-performance', effectivePerformance());
  set('data-bubble-palette', lookOf('palette'));
  root.style.setProperty('--sw-sheet-alpha', effectiveSheetAlpha().toFixed(2));
  root.style.setProperty('--sw-look-scale', (lookOf('scale') / 100).toFixed(2));
  root.style.setProperty('--sw-touch-desktop', `${lookOf('touch')}px`);
  root.style.setProperty('--sw-lite-alpha', liteAlpha.toFixed(2));
}

/** The dials as inline attributes + custom properties for a PREVIEW box (the settings card shows a draft without touching <html>). */
export function lookAttributes(l: Look, floor = alphaFloor): { attrs: Record<string, string>; style: Record<string, string> } {
  return {
    attrs: { 'data-bubble-density': l.density, 'data-bubble-surface': l.surface, 'data-bubble-popup': l.popup, 'data-bubble-radius': l.radius, 'data-bubble-touch': String(l.touch), 'data-bubble-performance': tierOf(l.performance), 'data-bubble-palette': l.palette },
    style: { '--sw-sheet-alpha': Math.max(floor, l.transparency / 100).toFixed(2), '--sw-look-scale': (l.scale / 100).toFixed(2), '--sw-touch-desktop': `${l.touch}px`, '--sw-lite-alpha': liteAlpha.toFixed(2) },
  };
}

/** `?look=density:compact,surface:glass` - the page view only. */
function readQuery(): PartialLook {
  try {
    const q = new URLSearchParams(window.location.search).get('look');
    if (!q) return {};
    const obj: Record<string, unknown> = {};
    for (const part of q.split(',')) {
      const [k, v] = part.split(':');
      if (!k || v === undefined) continue;
      obj[k] = /^-?\d+$/.test(v) ? Number(v) : v;
    }
    return normalizeLook(obj);
  } catch {
    return {};
  }
}

/** Boot (design/apply.ts): what is stored, then the dials on <html>. Idempotent. */
let booted = false;
export function bootLook(): void {
  if (booted) return;
  booted = true;
  installation = { ...LOOK_DEFAULT, ...normalizeLook(read(INST_KEY)) };
  const cached = readCache();
  own = cached ? withoutPalette(cached.look) : {};
  query = readQuery();
  refreshAutoPerformance(); // the cached / free verdict of `auto` at once (no flicker); the probe, when needed, runs at idle
  applyLook();
}

/** The installation default (the product settings): at load, and right after the settings screen saved it. */
export function setInstallationLook(v: unknown): void {
  installation = { ...LOOK_DEFAULT, ...normalizeLook(v) };
  write(INST_KEY, JSON.stringify(installation));
  notify();
}

/** The static demo (no backend) keeps "the installation's" default in this browser: same cache, same effect. */
export function saveDemoInstallationLook(v: Look): void {
  setInstallationLook(v);
}

function readCache(): { u: string | null; look: PartialLook } | null {
  try {
    const raw = read(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { u?: unknown; look?: unknown };
    return { u: typeof c.u === 'string' ? c.u : null, look: normalizeLook(c.look) };
  } catch {
    return null;
  }
}
function writeCache(u: string | null, v: PartialLook): void {
  if (!Object.keys(v).length) write(CACHE_KEY, null);
  else write(CACHE_KEY, JSON.stringify({ u, look: v }));
}

/** Once the session is known: this user's cached override at once (a cached copy belongs to one user id), then the server's. */
export async function loadLook(userId: string, api: boolean): Promise<void> {
  user = userId;
  remote = api;
  const cached = readCache();
  own = cached && cached.u === userId ? withoutPalette(cached.look) : {};
  notify();
  if (!api) return;
  try {
    const p = await getMyPrefs();
    if (user !== userId) return;
    const stored = Array.isArray(p.stored) && p.stored.includes('ui.look');
    const v = stored ? normalizeLook(p.prefs['ui.look']) : {};
    writeCache(userId, v);
    own = withoutPalette(v);
    notify();
  } catch {
    /* an older backend, or offline: keep the cached copy */
  }
}

/** Save the user's own override: only the dials in `v` are overridden; `{}` = "לפי ההתקנה" for every dial. Optimistic; reverted when refused. */
export async function saveOwnLook(v: PartialLook): Promise<void> {
  const before = own;
  own = withoutPalette(normalizeLook(v));
  writeCache(user, own);
  notify();
  if (!remote) return;
  const who = user;
  try {
    await putMyPrefs({ 'ui.look': Object.keys(own).length ? ({ ...own } as Record<string, unknown>) : null });
  } catch (err) {
    if (user !== who) return;
    own = before;
    writeCache(user, before);
    notify();
    throw err;
  }
}

// ---- the token bundles of the enumerated dials (css.ts emits them; keyed on the attribute, on any element) ----

/** Density: the pill family's sizes. `row` is the list view (one column; pill rows for devices / events, real tables for admin lists). */
export const DENSITY_BUNDLE: Record<Density, Record<string, string>> = {
  wide: { '--sw-pill-h': '76px', '--sw-icon-ring': '54px', '--sw-sub': '42px', '--sw-fs-name': '17px', '--sw-fs-state': '13.5px', '--sw-gap': '10px', '--sw-gap-grid': '14px', '--sw-grid-min': '400px' },
  regular: { '--sw-pill-h': '56px', '--sw-icon-ring': '40px', '--sw-sub': '36px', '--sw-fs-name': '13px', '--sw-fs-state': '12px', '--sw-gap': '8px', '--sw-gap-grid': '10px', '--sw-grid-min': '280px' },
  compact: { '--sw-pill-h': '46px', '--sw-icon-ring': '32px', '--sw-sub': '32px', '--sw-fs-name': '12.5px', '--sw-fs-state': '11.5px', '--sw-gap': '6px', '--sw-gap-grid': '6px', '--sw-grid-min': '210px' },
  row: { '--sw-pill-h': '54px', '--sw-icon-ring': '40px', '--sw-sub': '36px', '--sw-fs-name': '14px', '--sw-fs-state': '12.5px', '--sw-gap': '2px', '--sw-gap-grid': '2px', '--sw-grid-min': '100%' },
};

/** Radius: the corner scale (video keeps `--sw-r-media`, never the pill radius). */
export const RADIUS_BUNDLE: Record<Radius, Record<string, string>> = {
  pill: { '--sw-r-sm': '12px', '--sw-r-md': '18px', '--sw-r-lg': '28px', '--sw-r-xl': '42px', '--sw-r-pill': '999px', '--sw-r-media': '16px' },
  soft: { '--sw-r-sm': '8px', '--sw-r-md': '12px', '--sw-r-lg': '18px', '--sw-r-xl': '28px', '--sw-r-pill': '999px', '--sw-r-media': '12px' },
  square: { '--sw-r-sm': '4px', '--sw-r-md': '6px', '--sw-r-lg': '8px', '--sw-r-xl': '12px', '--sw-r-pill': '8px', '--sw-r-media': '4px' },
};

/**
 * The lite tier (performance dial): the switches the components read as `var(--sw-perf-blur, <their own blur>)` and
 * `var(--sw-perf-glass-bg, <their own translucent fill>)`. In `full` both are `initial` (tokens.ts), so the component's own value
 * applies; in `lite` the blur is `none` and the glass fill is the sheet colour at the contrast-computed lite alpha (a tinted, near
 * solid fill: contrast.ts liteAlphaFloor). Not overridden in lite: the dock, rail, tree (`--sw-glass-blur-nav`), the sheet scrim
 * (`--sw-backdrop-blur`) and the open pop-up (`--sw-glass-blur-sheet`).
 */
export const PERFORMANCE_BUNDLE: Record<Tier, Record<string, string>> = {
  full: { '--sw-perf-blur': 'initial', '--sw-perf-glass-bg': 'initial' }, // resets what an enclosing lite page set (the settings preview shows both)
  lite: { '--sw-perf-blur': 'none', '--sw-perf-glass-bg': 'rgba(var(--sw-sheet-rgb), var(--sw-lite-alpha))' },
};

/** The CSS of the dial bundles: `[data-bubble-density="compact"]{...}` for the bubble skin only (the attribute may sit on any element). */
export function lookBundlesCss(skinSelector = ':root[data-skin="bubble"]'): string {
  let css = '';
  const emit = (attr: string, bundles: Record<string, Record<string, string>>) => {
    for (const [value, decl] of Object.entries(bundles)) {
      const body = Object.entries(decl)
        .map(([k, v]) => `${k}:${v};`)
        .join('');
      // on <html> itself, and on any descendant that carries the attribute (a preview box)
      css += `${skinSelector}[${attr}="${value}"],${skinSelector} [${attr}="${value}"]{${body}}\n`;
    }
  };
  emit('data-bubble-density', DENSITY_BUNDLE);
  emit('data-bubble-radius', RADIUS_BUNDLE);
  emit('data-bubble-performance', PERFORMANCE_BUNDLE);
  return css;
}
