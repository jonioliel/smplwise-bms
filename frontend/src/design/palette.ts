/**
 * Colour palettes of the Bubble skin (release 0.1.156). A palette is data: a closed set of colour tokens for the light and the dark
 * scheme (docs/design/palettes/palettes.schema.json; the ten ready ones are design/palettes.json, a copy of the design asset that a
 * unit spec keeps identical). Backend twin: smplwise_vms/backend/smplwise/services/palettes.py (same schema, same contrast pairs,
 * same Hebrew refusal text; the backend is the authority, this file refuses a bad palette before it is sent and before it is applied).
 *
 *   - the palette DIAL lives in `ui.look` (design/look.ts): `default` | one of the ten ids | `custom-<slug>`;
 *   - the custom palettes of an installation (`ui.palettes`, saved by an administrator in הגדרות › כללי › מראה) are held here;
 *   - `paletteTokens` maps a palette + scheme to `--sw-*` custom properties, `syncPalette` puts them on <html> inline (an inline
 *     declaration beats the skin's stylesheet, so no rule and no token table changes) - only while the bubble skin is in force;
 *   - a palette that does not pass every contrast pair (text 4.5:1, non-text 3:1; contrast.ts maths) is NEVER applied: the previous
 *     valid palette stays (or `default` when there was none).
 *
 * Defaults chosen for the open owner questions (all one-line changes, see DEFAULTS_FOR_OPEN_QUESTIONS below):
 *   1. dark accent: the palette's own accent (the lighter blue with dark text on it, not the product's #4c6fd9);
 *   2. icon rings follow the palette accent (RING_MODE 'accent'); `entity.*` colours are not wired, the gradient pairs only feed the washes;
 *   3. all ten palettes are offered, plus `default` (the skin's own colours).
 */
import { over, parseColor, type RGBA } from './contrast';
import { lookOf } from './look';
import rawPalettes from './palettes.json' with { type: 'json' };

export type Scheme = 'light' | 'dark';

export interface PaletteScheme {
  bg: string;
  surface: string;
  surface2: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentContrast: string;
  accentText: string;
  glass: { tint: string; opacity: { min: number; default: number; max: number }; layer: string; overlay: string; blurPx: number };
  state: { on: string; off: string; unavailable: string; success: string; warning: string; danger: string; successText: string; warningText: string; dangerText: string };
  entity: { light: string; climate: string; cover: string; media: string; security: string; camera: string; icon: string };
  gradient: { pairs: [string, string][]; text: string };
  slider: { fill: string; fillCool: string; onFill: string; edge: string; track: string };
  wallpaper: { stops: string[]; angle: number };
}
export interface Palette {
  id: string;
  name: { he: string; en: string };
  character?: string;
  schemes: { light: PaletteScheme; dark: PaletteScheme };
}

/** The decisions taken for the open owner questions of docs/design/palettes/README.md (change here, nowhere else). */
export const DEFAULTS_FOR_OPEN_QUESTIONS = {
  /** 'accent': every icon ring is the palette accent with its contrast text; 'pairs': rings take the start colours of the gradient pairs (decorative hues). */
  RING_MODE: 'accent' as 'accent' | 'pairs',
  /** The ten ready palettes offered in the dial (all of them); a subset is a one-line filter of this list. */
  OFFERED: null as string[] | null,
};

export const MAX_CUSTOM = 12;
export const CUSTOM_PREFIX = 'custom-';
export const CUSTOM_ID_RE = /^custom-[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DEFAULT_PALETTE_ID = 'default';

const FILE = rawPalettes as unknown as { defaultPalette: string; palettes: Palette[] };
/** The ten ready palettes, in the file's order. */
export const BUILTIN_PALETTES: readonly Palette[] = FILE.palettes.filter((p) => !DEFAULTS_FOR_OPEN_QUESTIONS.OFFERED || DEFAULTS_FOR_OPEN_QUESTIONS.OFFERED.includes(p.id));
export const BUILTIN_IDS: readonly string[] = BUILTIN_PALETTES.map((p) => p.id);
export const isBuiltinId = (id: string): boolean => BUILTIN_IDS.includes(id);
export const isCustomId = (id: string): boolean => id.length <= 40 && CUSTOM_ID_RE.test(id);

// ---- the schema (a closed set; the same list as the backend and validate_palettes.mjs) ----

type Kind = 'hex' | 'color' | 'number' | 'hex[]' | 'pairs';
export const SCHEMA: Record<string, Kind> = {
  bg: 'hex', surface: 'hex', surface2: 'hex', surfaceElevated: 'hex', text: 'hex', textMuted: 'hex', border: 'color',
  accent: 'hex', accentContrast: 'hex', accentText: 'hex',
  'glass.tint': 'hex', 'glass.opacity.min': 'number', 'glass.opacity.default': 'number', 'glass.opacity.max': 'number',
  'glass.layer': 'color', 'glass.overlay': 'color', 'glass.blurPx': 'number',
  'state.on': 'hex', 'state.off': 'hex', 'state.unavailable': 'hex', 'state.success': 'hex', 'state.warning': 'hex', 'state.danger': 'hex',
  'state.successText': 'hex', 'state.warningText': 'hex', 'state.dangerText': 'hex',
  'entity.light': 'hex', 'entity.climate': 'hex', 'entity.cover': 'hex', 'entity.media': 'hex', 'entity.security': 'hex', 'entity.camera': 'hex', 'entity.icon': 'hex',
  'gradient.pairs': 'pairs', 'gradient.text': 'hex',
  'slider.fill': 'hex', 'slider.fillCool': 'hex', 'slider.onFill': 'hex', 'slider.edge': 'hex', 'slider.track': 'hex',
  'wallpaper.stops': 'hex[]', 'wallpaper.angle': 'number',
};
const KNOWN = new Set(Object.keys(SCHEMA));
const HEX = /^#[0-9a-f]{6}$/i;

const get = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Structural problems of a palette object (English, for tests and logs); empty = well-formed. */
export function schemaErrors(pal: unknown): string[] {
  const errs: string[] = [];
  if (!pal || typeof pal !== 'object' || Array.isArray(pal)) return ['palette must be an object'];
  const p = pal as Record<string, unknown>;
  const extra = Object.keys(p).filter((k) => !['id', 'name', 'character', 'schemes'].includes(k));
  if (extra.length) errs.push(`unknown palette keys: ${extra.slice(0, 5).join(', ')}`);
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(String(p.id ?? ''))) errs.push('id: lower-case kebab id required');
  const name = p.name as Record<string, unknown> | undefined;
  if (!name || typeof name !== 'object' || !['he', 'en'].every((k) => typeof name[k] === 'string' && (name[k] as string).trim()) || Object.keys(name).some((k) => k !== 'he' && k !== 'en')) errs.push('name.he and name.en required');
  else if (['he', 'en'].some((k) => (name[k] as string).length > 40)) errs.push('name: at most 40 characters');
  if ('character' in p && !(typeof p.character === 'string' && p.character.length <= 200)) errs.push('character: text up to 200 characters');
  const schemes = p.schemes as Record<string, unknown> | undefined;
  if (!schemes || typeof schemes !== 'object' || Object.keys(schemes).length !== 2 || !('light' in schemes) || !('dark' in schemes)) return [...errs, 'schemes.light and schemes.dark required'];
  for (const sc of ['light', 'dark']) {
    const s = schemes[sc];
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      errs.push(`schemes.${sc} must be an object`);
      continue;
    }
    for (const [path, kind] of Object.entries(SCHEMA)) {
      const v = get(s, path);
      const at = `schemes.${sc}.${path}`;
      if (v === undefined || v === null) {
        errs.push(`${at} missing`);
        continue;
      }
      if (kind === 'hex' && !(typeof v === 'string' && HEX.test(v))) errs.push(`${at} must be #rrggbb`);
      else if (kind === 'color' && !(typeof v === 'string' && parseColor(v))) errs.push(`${at}: unsupported colour`);
      else if (kind === 'number' && !isNum(v)) errs.push(`${at} must be a number`);
      else if (kind === 'hex[]' && !(Array.isArray(v) && v.length >= 2 && v.length <= 5 && v.every((x) => typeof x === 'string' && HEX.test(x)))) errs.push(`${at} must be 2-5 #rrggbb stops`);
      else if (kind === 'pairs' && !(Array.isArray(v) && v.length >= 2 && v.length <= 8 && v.every((q) => Array.isArray(q) && q.length === 2 && q.every((x) => typeof x === 'string' && HEX.test(x))))) errs.push(`${at} must be 2-8 [#start, #end] pairs`);
    }
    const o = get(s, 'glass.opacity') as Record<string, unknown> | undefined;
    if (o && ['min', 'default', 'max'].every((k) => isNum(o[k]))) {
      const [a, b, c] = [o.min as number, o.default as number, o.max as number];
      if (!(a > 0 && a <= b && b <= c && c <= 1)) errs.push(`schemes.${sc}.glass.opacity: need 0 < min <= default <= max <= 1`);
    }
    const blur = get(s, 'glass.blurPx');
    if (isNum(blur) && (blur < 0 || blur > 60)) errs.push(`schemes.${sc}.glass.blurPx: 0..60`);
    const walk = (x: Record<string, unknown>, pre: string) => {
      for (const [k, v] of Object.entries(x)) {
        const path = pre ? `${pre}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v) && !KNOWN.has(path)) walk(v as Record<string, unknown>, path);
        else if (!KNOWN.has(path)) errs.push(`schemes.${sc}.${path.slice(0, 40)}: unknown token (closed set)`);
      }
    };
    walk(s as Record<string, unknown>, '');
  }
  return errs;
}

// ---- the contrast pairs (the same pairs as validate_palettes.mjs and the backend) ----

export const TEXT_MIN = 4.5;
export const UI_MIN = 3;
export interface Row {
  group: string;
  what: string;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  ok: boolean;
}

const lum = (c: RGBA): number => {
  const [r, g, b] = [c[0], c[1], c[2]].map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// note: the same sRGB constants as the validator (0.04045); contrast.ts uses WCAG's older 0.03928, which differs only below 8-bit resolution
const ratio = (a: RGBA, b: RGBA): number => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const col = (s: PaletteScheme, p: string): RGBA => {
  const c = parseColor(String(get(s, p)));
  if (!c) throw new Error(`bad colour at ${p}`);
  return c;
};

/** Every contrast pair of one (well-formed) scheme; `ok` is the verdict. */
export function checkScheme(s: PaletteScheme): Row[] {
  const C = (p: string) => col(s, p);
  const rows: Row[] = [];
  const add = (group: string, what: string, fg: string, f: RGBA, bgName: string, b: RGBA, min: number, altOk = false) => {
    const r = ratio(f, b);
    rows.push({ group, what, fg, bg: bgName, ratio: Math.round(r * 100) / 100, min, ok: r >= min || altOk });
  };
  const opaque: Record<string, RGBA> = { bg: C('bg'), surface: C('surface'), surface2: C('surface2'), surfaceElevated: C('surfaceElevated') };
  for (const t of ['text', 'textMuted']) for (const [n, b] of Object.entries(opaque)) add('text', `${t} on ${n}`, t, C(t), n, b, TEXT_MIN);

  const stops = s.wallpaper.stops.map((x) => parseColor(x) as RGBA);
  const byLum = [...stops].sort((a, b) => lum(b) - lum(a));
  const extremes: [string, RGBA][] = [['lightest stop', byLum[0]], ['darkest stop', byLum[byLum.length - 1]]];
  const a = s.glass.opacity.min;
  const tint = C('glass.tint');
  const glass: Record<string, RGBA> = {};
  const pct = Math.round(a * 100);
  for (const [wn, w] of extremes) {
    glass[`glass card @${pct}% / ${wn}`] = over([tint[0], tint[1], tint[2], a], w);
    const sheet = over([tint[0], tint[1], tint[2], a], over(C('glass.overlay'), w));
    glass[`pop-up sheet @${pct}% / dimmed ${wn}`] = sheet;
    glass[`pill layer in sheet / dimmed ${wn}`] = over(C('glass.layer'), sheet);
  }
  for (const t of ['text', 'textMuted']) for (const [n, b] of Object.entries(glass)) add('glass', `${t} on ${n}`, t, C(t), n, b, TEXT_MIN);
  for (const [n, b] of Object.entries(glass)) if (!n.startsWith('pill')) add('glass', `accentText on ${n}`, 'accentText', C('accentText'), n, b, TEXT_MIN);
  stops.forEach((w, i) => add('wallpaper', `text on wallpaper stop ${i + 1}`, 'text', C('text'), `wallpaper.stops[${i}]`, w, TEXT_MIN));

  add('accent', 'accentContrast on accent', 'accentContrast', C('accentContrast'), 'accent', C('accent'), TEXT_MIN);
  for (const n of ['bg', 'surface', 'surfaceElevated']) add('accent', `accentText on ${n}`, 'accentText', C('accentText'), n, opaque[n], TEXT_MIN);
  for (const n of ['bg', 'surface']) add('accent', `accent (toggle, focus) vs ${n}`, 'accent', C('accent'), n, opaque[n], UI_MIN);

  const worstGlass = (f: RGBA) => {
    let w = { r: 99, n: '', b: f };
    for (const [n, b] of Object.entries(glass)) {
      const r = ratio(f, b);
      if (r < w.r) w = { r, n, b };
    }
    return w;
  };
  for (const st of ['on', 'off', 'unavailable', 'success', 'warning', 'danger']) {
    const p = `state.${st}`;
    const f = C(p);
    for (const n of ['bg', 'surface', 'surfaceElevated']) add('state', `${st} vs ${n}`, p, f, n, opaque[n], UI_MIN);
    const w = worstGlass(f);
    add('state', `${st} vs ${w.n}`, p, f, w.n, w.b, UI_MIN);
  }
  for (const st of ['successText', 'warningText', 'dangerText']) for (const n of ['surface', 'surfaceElevated']) add('state', `${st} on ${n}`, `state.${st}`, C(`state.${st}`), n, opaque[n], TEXT_MIN);

  for (const e of ['light', 'climate', 'cover', 'media', 'security', 'camera']) {
    const p = `entity.${e}`;
    for (const n of ['bg', 'surface']) add('entity', `${e} ring vs ${n}`, p, C(p), n, opaque[n], UI_MIN);
    add('entity', `icon on ${e} ring`, 'entity.icon', C('entity.icon'), p, C(p), UI_MIN);
  }
  s.gradient.pairs.forEach((pr, i) => pr.forEach((c, j) => add('gradient', `gradient text on pair ${i + 1} ${j ? 'end' : 'start'}`, 'gradient.text', C('gradient.text'), `gradient.pairs[${i}][${j}]`, parseColor(c) as RGBA, TEXT_MIN)));

  for (const f of ['fill', 'fillCool']) {
    add('slider', `onFill on ${f}`, 'slider.onFill', C('slider.onFill'), `slider.${f}`, C(`slider.${f}`), TEXT_MIN);
    const direct = ratio(C(`slider.${f}`), C('slider.track'));
    const eF = ratio(C('slider.edge'), C(`slider.${f}`));
    const eT = ratio(C('slider.edge'), C('slider.track'));
    const edgeOk = eF >= UI_MIN && eT >= UI_MIN;
    add('slider', `${f} vs track (position)`, `slider.${f}`, C(`slider.${f}`), 'slider.track', C('slider.track'), UI_MIN, edgeOk);
    if (direct < UI_MIN) {
      add('slider', `edge vs ${f}`, 'slider.edge', C('slider.edge'), `slider.${f}`, C(`slider.${f}`), UI_MIN);
      add('slider', `edge vs track (${f})`, 'slider.edge', C('slider.edge'), 'slider.track', C('slider.track'), UI_MIN);
    }
  }
  return rows;
}

export interface FailingRow extends Row {
  scheme: Scheme;
}
/** The failing rows of a well-formed palette, both schemes. */
export function failingPairs(pal: Palette): FailingRow[] {
  const out: FailingRow[] = [];
  for (const sc of ['light', 'dark'] as const) for (const r of checkScheme(pal.schemes[sc])) if (!r.ok) out.push({ ...r, scheme: sc });
  return out;
}

// ---- the Hebrew message of a refusal (the backend builds the same text) ----

const FG_HE: Record<string, string> = {
  text: 'טקסט', textMuted: 'טקסט משני', accent: 'צבע הדגש', accentContrast: 'טקסט על הדגש', accentText: 'טקסט בצבע הדגש',
  'gradient.text': 'טקסט על גוון', 'slider.onFill': 'טקסט על המילוי', 'slider.edge': 'קו קצה של מחוון', 'slider.fill': 'מילוי מחוון', 'slider.fillCool': 'מילוי מחוון קר',
  'entity.icon': 'סמל על טבעת', 'state.on': 'מצב פעיל', 'state.off': 'מצב כבוי', 'state.unavailable': 'לא זמין', 'state.success': 'הצלחה', 'state.warning': 'אזהרה',
  'state.danger': 'שגיאה', 'state.successText': 'טקסט הצלחה', 'state.warningText': 'טקסט אזהרה', 'state.dangerText': 'טקסט שגיאה',
};
const BG_HE: Record<string, string> = { bg: 'הרקע', surface: 'המשטח', surface2: 'המשטח המשני', surfaceElevated: 'המשטח המוגבה', accent: 'הדגש', 'slider.track': 'מסלול המחוון' };
const fgHe = (p: string): string => FG_HE[p] ?? (p.startsWith('entity.') ? `טבעת ${p.split('.')[1]}` : p);
function bgHe(n: string): string {
  if (BG_HE[n]) return BG_HE[n];
  if (n.startsWith('glass card')) return 'כרטיס זכוכית';
  if (n.startsWith('pop-up sheet')) return 'חלון קופץ';
  if (n.startsWith('pill layer')) return 'שכבת כמוסה';
  if (n.startsWith('wallpaper.stops')) return 'הרקע המצויר';
  if (n.startsWith('gradient.pairs')) return 'גוון';
  if (n.startsWith('slider.')) return 'מילוי מחוון';
  if (n.startsWith('entity.')) return `טבעת ${n.split('.')[1]}`;
  return n;
}

export function describeFailures(rows: FailingRow[], limit = 3): string {
  const worst = [...rows].sort((a, b) => a.ratio - b.ratio).slice(0, limit);
  const parts = worst.map((r) => `${r.scheme === 'light' ? 'בהיר' : 'כהה'}: ${fgHe(r.fg)} על ${bgHe(r.bg)} - ${r.ratio.toFixed(2)}:1 (נדרש ${r.min}:1)`);
  const more = rows.length > limit ? ` ועוד ${rows.length - limit}` : '';
  return `ערכת הצבעים נדחתה: ניגודיות נמוכה מדי ב־${rows.length} זוגות. ${parts.join('; ')}${more}.`;
}

export type Verdict = { ok: true; palette: Palette } | { ok: false; message: string; rows: FailingRow[] };
/** Shape and contrast. A palette that fails is refused with a Hebrew message; it is never applied or stored. */
export function validatePalette(pal: unknown, opts: { custom?: boolean } = {}): Verdict {
  const errs = schemaErrors(pal);
  if (errs.length) return { ok: false, message: `ערכת הצבעים אינה תקינה: ${errs[0]}`, rows: [] };
  const p = pal as Palette;
  if (opts.custom && !isCustomId(p.id)) return { ok: false, message: 'מזהה ערכה מותאמת חייב להתחיל ב־custom- (אותיות קטנות, ספרות ומקפים)', rows: [] };
  const rows = failingPairs(p);
  if (rows.length) return { ok: false, message: describeFailures(rows), rows };
  return { ok: true, palette: p };
}

// ---- colour helpers for the token mapping ----

const hex2 = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
export const toHex = (c: RGBA): string => `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;
const rgbaStr = (c: RGBA, a: number): string => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${Math.round(a * 100) / 100})`;
/** `a` toward `b` by `t` (0..1), in sRGB. */
const mix = (a: RGBA, b: RGBA, t: number): RGBA => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1];

/** The third surface level (hover, tracks): the secondary surface nudged 8 % toward the text colour. */
export const surface3Of = (s: PaletteScheme): string => toHex(mix(col(s, 'surface2'), col(s, 'text'), 0.08));

/** A palette + scheme as `--sw-*` custom properties (the names of tokens.ts; only colours, glass blur and the wallpaper). */
export function paletteTokens(pal: Palette, scheme: Scheme): Record<string, string> {
  const s = pal.schemes[scheme];
  const dark = scheme === 'dark';
  const C = (p: string) => col(s, p);
  const t: Record<string, string> = {};
  const accent = C('accent');
  const tint = C('glass.tint');
  t['--sw-bg'] = s.bg;
  t['--sw-canvas'] = `linear-gradient(${s.wallpaper.angle}deg, ${s.wallpaper.stops.join(', ')})`;
  t['--sw-surface'] = s.surface;
  t['--sw-surface-2'] = s.surface2;
  t['--sw-surface-3'] = surface3Of(s);
  t['--sw-surface-solid'] = s.surfaceElevated;
  t['--sw-surface-2-solid'] = s.surface2;
  t['--sw-surface-3-solid'] = surface3Of(s);
  t['--sw-border-strong'] = s.border;
  t['--sw-overlay'] = s.glass.overlay;
  t['--sw-text'] = s.text;
  t['--sw-heading'] = s.text;
  t['--sw-text-2'] = s.textMuted;
  t['--sw-text-3'] = s.textMuted;
  t['--sw-text-inverse'] = s.accentContrast;
  t['--sw-accent'] = s.accent;
  t['--sw-nav'] = s.accent;
  t['--sw-focus'] = s.accent;
  t['--sw-toggle-on'] = s.state.on;
  t['--sw-accent-hover'] = toHex(mix(accent, C('text'), 0.12));
  t['--sw-accent-soft'] = rgbaStr(accent, dark ? 0.26 : 0.14);
  t['--sw-accent-text'] = s.accentText;
  t['--sw-recorded'] = s.accent;
  t['--sw-recorded-soft'] = rgbaStr(accent, dark ? 0.26 : 0.14);
  t['--sw-recorded-text'] = s.accentText;
  t['--sw-sheet-rgb'] = `${Math.round(tint[0])}, ${Math.round(tint[1])}, ${Math.round(tint[2])}`;
  t['--sw-layer'] = s.glass.layer;
  const layer = C('glass.layer');
  t['--sw-layer-2'] = rgbaStr(layer, Math.min(1, layer[3] * 1.45));
  t['--sw-nav-glass'] = rgbaStr(tint, s.glass.opacity.default);
  t['--sw-glass-blur-sheet'] = `blur(${s.glass.blurPx}px) saturate(160%)`;
  t['--sw-glass-blur-nav'] = `blur(${Math.round(s.glass.blurPx * 0.7)}px) saturate(150%)`;
  // states: the same colour names the rest of the product reads (live / stale / forbidden and so on follow success / warning / danger)
  const st: [string[], keyof PaletteScheme['state'], keyof PaletteScheme['state']][] = [
    [['--sw-success', '--sw-live'], 'success', 'successText'],
    [['--sw-warning', '--sw-stale'], 'warning', 'warningText'],
    [['--sw-danger', '--sw-forbidden'], 'danger', 'dangerText'],
  ];
  for (const [names, base, text] of st) {
    const c = C(`state.${base}`);
    for (const n of names) {
      t[n] = s.state[base];
      t[`${n}-soft`] = rgbaStr(c, dark ? 0.22 : 0.14);
      t[`${n}-text`] = s.state[text];
    }
  }
  t['--sw-offline'] = s.state.off;
  t['--sw-offline-soft'] = rgbaStr(C('state.off'), dark ? 0.2 : 0.14);
  t['--sw-offline-text'] = s.textMuted;
  t['--sw-unknown'] = s.state.unavailable;
  t['--sw-unknown-soft'] = rgbaStr(C('state.unavailable'), dark ? 0.22 : 0.16);
  t['--sw-unknown-text'] = s.textMuted;
  // the lit fill and its text
  t['--sw-lit'] = s.slider.fill;
  t['--sw-lit-cool'] = s.slider.fillCool;
  t['--sw-lit-soft'] = rgbaStr(C('slider.fill'), 0.32);
  t['--sw-on-lit'] = s.slider.onFill;
  const needsEdge = ratio(C('slider.fill'), C('slider.track')) < UI_MIN || ratio(C('slider.fillCool'), C('slider.track')) < UI_MIN;
  t['--sw-fill-edge'] = needsEdge ? s.slider.edge : 'transparent';
  // icon rings
  if (DEFAULTS_FOR_OPEN_QUESTIONS.RING_MODE === 'accent') {
    for (let i = 1; i <= 8; i++) t[`--sw-hue-${i}`] = s.accent;
    t['--sw-ring-on-hue'] = s.accentContrast;
  } else {
    for (let i = 1; i <= 8; i++) t[`--sw-hue-${i}`] = s.gradient.pairs[(i - 1) % s.gradient.pairs.length][0];
    t['--sw-ring-on-hue'] = s.gradient.text;
  }
  t['--sw-cool'] = s.entity.climate;
  return t;
}

// ---- the custom palettes of the installation (`ui.palettes`) and the resolver ----

const CACHE_KEY = 'sw.ui.palettes';
let customs: Palette[] = [];
let lastGood: Palette | null = null;
const listeners = new Set<() => void>();

function readStorage(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}
function writeStorage(v: string | null): void {
  try {
    if (v === null) localStorage.removeItem(CACHE_KEY);
    else localStorage.setItem(CACHE_KEY, v);
  } catch {
    /* storage unavailable: the list lasts for this page view only */
  }
}

/** A stored / served list reduced to the palettes that are well-formed custom palettes; the rest is dropped (a bad one is never applied). */
export function normalizeCustoms(raw: unknown): Palette[] {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  const out: Palette[] = [];
  for (const p of v.slice(0, MAX_CUSTOM)) {
    const r = validatePalette(p, { custom: true });
    if (r.ok && !out.some((o) => o.id === r.palette.id)) out.push(r.palette);
  }
  return out;
}

/** Subscribe to changes of the custom list (apply.ts re-applies; the settings card re-renders). */
export function onPalettes(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const customPalettes = (): readonly Palette[] => customs;
/** The installation's custom palettes (product settings at load, and right after the editor saved them). */
export function setCustomPalettes(raw: unknown): void {
  customs = normalizeCustoms(raw);
  writeStorage(customs.length ? JSON.stringify(customs) : null);
  listeners.forEach((fn) => fn());
}
/** Boot: the last known list (applied at once on the next load). */
export function bootPalettes(): void {
  const raw = readStorage();
  customs = raw ? normalizeCustoms(raw) : [];
}

export const allPalettes = (): Palette[] => [...BUILTIN_PALETTES, ...customs];
/** A palette by id (`default` and an unknown id are null: the skin's own colours). */
export function paletteById(id: string): Palette | null {
  return allPalettes().find((p) => p.id === id) ?? null;
}

/**
 * The palette in force: the dial's value resolved. `default` and an id with no palette behind it (deleted) = null (the skin's own
 * colours); a palette that fails validation is NOT applied: the previous valid palette stays, else null.
 */
export function resolvePalette(id: string = lookOf('palette')): Palette | null {
  const p = paletteById(id);
  if (!p) return null;
  const v = validatePalette(p, { custom: !isBuiltinId(p.id) });
  if (!v.ok) return lastGood;
  lastGood = p;
  return p;
}

// ---- putting it on the page ----

let appliedNames: string[] = [];
/** Replace the palette's inline custom properties on <html> (none when `tokens` is null: the skin's own colours show). Idempotent. */
export function syncPalette(root: HTMLElement, tokens: Record<string, string> | null): void {
  const next = tokens ?? {};
  for (const n of appliedNames) if (!(n in next)) root.style.removeProperty(n);
  for (const [n, v] of Object.entries(next)) if (root.style.getPropertyValue(n) !== v) root.style.setProperty(n, v);
  appliedNames = Object.keys(next);
}

/** The tokens of the palette in force for a scheme, only while the bubble skin draws it. */
export function activePaletteTokens(skin: string, scheme: Scheme): { palette: Palette | null; tokens: Record<string, string> | null } {
  if (skin !== 'bubble') return { palette: null, tokens: null };
  const palette = resolvePalette();
  return { palette, tokens: palette ? paletteTokens(palette, scheme) : null };
}
