import { test, expect } from '@playwright/test';
import { SKIN_IDS, FROZEN_SKINS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

/**
 * DARK-REVIEW-2342 (owner-approved, 2026-11-01): the dark-scheme review of the screens polished on 01.11 (the *-POLISH-2331 round,
 * SHARED-POLISH-2342, OWNER-R12-2341, POLISH-LEFTOVERS-2341, LIVE-H265-2341, NVR-H264-BULK-2341). Those branches drew their new
 * fills as colour mixes of the state / accent tokens over a surface (a selected row = accent 22-32 % over the surface, a failed row =
 * danger 8-10 % over surface-2, a warning banner, a KPI tile tinted by its own state colour, the settings "well") and put the token
 * inks on them. The token guards (unit-muted-contrast, unit-dark-muted-contrast) check the inks on the token beds; nothing checked the
 * inks on these MIXED beds, and no dark screenshot was taken that day. This spec evaluates every such pair exactly as the CSS writes
 * it (var() chains, color-mix in srgb with its percentages, alpha compositing over the card and the page), per skin, dark column, and
 * holds text at 4.5:1 and graphics / control boundaries at 3:1 (WCAG 1.4.3 / 1.4.11).
 * A new mixed bed on one of these screens adds a row here (screen, selector, ink, bed).
 *   npx playwright test -c playwright.unit.config.ts tests/unit-dark-polish-beds.spec.ts
 */

type Kind = 'text' | 'ui';
interface Pair {
  screen: string;
  where: string;
  ink: string;
  bed: string;
  /** what the bed sits on; default a card (var(--sw-surface)) over the page */
  under?: string;
  /** the ink's own opacity (a quiet count, an off row) */
  alpha?: number;
  kind: Kind;
}

// the one ink opacity left on these screens (insights/styles.ts .chip .n); the source check at the end keeps this file and the CSS in step
const INSIGHTS_CHIP_N_ALPHA = 0.8;

/** the dark edge of an unchecked box (screens/nvr-camera-batch.ts, nvr-encoding-batch.ts) */
const BOX_EDGE_DARK = 'color-mix(in srgb, var(--sw-text-3) 70%, transparent)';

const SURF = 'var(--sw-surface)';
const S2 = 'var(--sw-surface-2)';
const TOAST = 'var(--sw-toast-bg)';
const ACC = 'var(--sw-accent)';
const INK_TEXT = ['var(--sw-heading)', 'var(--sw-text)', 'var(--sw-text-2)'];

const PAIRS: Pair[] = [
  // NVR-H264-BULK-2341: the camera picker of the H.264 batch (screens/nvr-camera-batch.ts)
  ...INK_TEXT.map((ink) => ({ screen: 'nvr-camera-batch', where: '.sel[aria-checked] (resting)', ink, bed: `color-mix(in srgb, ${ACC} 26%, ${SURF})`, kind: 'text' as Kind })),
  // dark hovers at 28 % (light 32 %): at 32 % the --sw-text-2 meta read 4.33 (crystal) / 4.43 (domus)
  ...INK_TEXT.map((ink) => ({ screen: 'nvr-camera-batch', where: '.sel[aria-checked]:hover', ink, bed: `color-mix(in srgb, ${ACC} 28%, ${SURF})`, kind: 'text' as Kind })),
  // the unchecked box: 2 px --sw-border-strong read 1.5-2.3:1 in dark (a checkbox boundary needs 3:1); dark draws it in BOX_EDGE_DARK
  ...['nvr-camera-batch', 'nvr-encoding-batch'].flatMap((screen) => [
    { screen, where: '.sel .box (unchecked edge, resting row)', ink: BOX_EDGE_DARK, bed: SURF, kind: 'ui' as Kind },
    { screen, where: '.sel .box (unchecked edge, hovered row)', ink: BOX_EDGE_DARK, bed: 'var(--sw-surface-3)', kind: 'ui' as Kind },
  ]),
  { screen: 'nvr-camera-batch', where: '.row.bad .ln', ink: 'var(--sw-danger-text)', bed: `color-mix(in srgb, var(--sw-danger) 10%, ${S2})`, kind: 'text' },
  { screen: 'nvr-camera-batch', where: '.row.bad .nm', ink: 'var(--sw-heading)', bed: `color-mix(in srgb, var(--sw-danger) 10%, ${S2})`, kind: 'text' },
  { screen: 'nvr-camera-batch', where: '.row.unk .ln', ink: 'var(--sw-warning-text)', bed: `color-mix(in srgb, var(--sw-warning) 12%, ${S2})`, kind: 'text' },
  // CAMADMIN-POLISH-2331: privacy masks (screens/system-security-privacy-masks.ts)
  { screen: 'privacy-masks', where: '.banner', ink: 'var(--sw-heading)', bed: `color-mix(in srgb, var(--sw-warning) 14%, ${SURF})`, kind: 'text' },
  { screen: 'privacy-masks', where: '.banner secondary line', ink: 'var(--sw-text-2)', bed: `color-mix(in srgb, var(--sw-warning) 14%, ${SURF})`, kind: 'text' },
  ...INK_TEXT.map((ink) => ({ screen: 'privacy-masks', where: '.cam[aria-current] / .pick[aria-pressed]', ink, bed: `color-mix(in srgb, ${ACC} 22%, ${SURF})`, kind: 'text' as Kind })),
  { screen: 'privacy-masks', where: '.history li[diverged] .when', ink: 'var(--sw-text-2)', bed: `color-mix(in srgb, var(--sw-danger) 10%, ${S2})`, kind: 'text' },
  { screen: 'privacy-masks', where: '.rv-card[skipped] figcaption', ink: 'var(--sw-text-2)', bed: `color-mix(in srgb, var(--sw-danger) 8%, ${SURF})`, kind: 'text' },
  { screen: 'privacy-masks', where: 'sw-dialog .count', ink: 'var(--sw-heading)', bed: `color-mix(in srgb, ${ACC} 14%, ${SURF})`, kind: 'text' },
  // INSIGHTS-POLISH-2331: the KPI tiles tinted by their state colour (insights/styles.ts)
  ...['var(--sw-danger)', 'var(--sw-warning)'].flatMap((c) => [
    { screen: 'insights', where: `button.kpi[data-look] .l (${c})`, ink: 'var(--sw-heading)', bed: `color-mix(in srgb, ${c} 18%, ${SURF})`, kind: 'text' as Kind, under: 'var(--sw-bg)' },
    { screen: 'insights', where: `.kpi[aria-pressed] secondary (${c})`, ink: 'var(--sw-text-2)', bed: `color-mix(in srgb, ${c} 20%, ${SURF})`, kind: 'text' as Kind, under: 'var(--sw-bg)' },
    { screen: 'insights', where: `.kpi .dot (${c})`, ink: c, bed: `color-mix(in srgb, ${c} 18%, ${SURF})`, kind: 'ui' as Kind, under: 'var(--sw-bg)' },
  ]),
  { screen: 'insights', where: '.btn.primary', ink: 'var(--sw-text-inverse)', bed: ACC, kind: 'text' },
  // EVENTS-POLISH-2331: a filter chip on hover (screens/investigate-events.ts) - 70 % + 12 %: the remaining 18 % is transparent
  { screen: 'investigate-events', where: '.fchip:hover', ink: 'var(--sw-text)', bed: 'color-mix(in srgb, var(--sw-accent-soft) 70%, var(--sw-accent) 12%)', kind: 'text' },
  { screen: 'investigate-events', where: '.fchip:hover (secondary)', ink: 'var(--sw-text-2)', bed: 'color-mix(in srgb, var(--sw-accent-soft) 70%, var(--sw-accent) 12%)', kind: 'text' },
  // SETUPPLAN-POLISH-2331: the area-link rows (screens/plan-area-links-admin.ts)
  { screen: 'plan-area-links', where: 'linked row', ink: 'var(--sw-text-2)', bed: 'color-mix(in srgb, var(--sw-accent-soft) 45%, transparent)', kind: 'text' },
  { screen: 'plan-area-links', where: '.well', ink: 'var(--sw-text-3)', bed: 'var(--sw-well, var(--sw-surface-2))', kind: 'text' },
  // the shared settings sheet (styles/settings.ts): the well and the hover row
  { screen: 'settings (shared)', where: '--sw-well', ink: 'var(--sw-text-3)', bed: 'color-mix(in srgb, var(--sw-surface-2) 76%, var(--sw-border))', kind: 'text' },
  { screen: 'settings (shared)', where: '--sw-well', ink: 'var(--sw-text-2)', bed: 'color-mix(in srgb, var(--sw-surface-2) 76%, var(--sw-border))', kind: 'text' },
  { screen: 'settings (shared)', where: 'row hover', ink: 'var(--sw-text-3)', bed: 'color-mix(in srgb, var(--sw-surface) 70%, var(--sw-hover-wash))', kind: 'text' },
  { screen: 'messaging-accounts', where: 'well 55 %', ink: 'var(--sw-text-3)', bed: 'color-mix(in srgb, color-mix(in srgb, var(--sw-surface-2) 76%, var(--sw-border)) 55%, transparent)', kind: 'text' },
  // accent fills under the inverse ink (water tree, plan-view range, calendars chip); the water count was at opacity 0.85 (3.72:1)
  { screen: 'water/page-meters', where: '.tree button[aria-current] .cnt', ink: 'var(--sw-text-inverse)', bed: ACC, kind: 'text' },
  { screen: 'system-plan-view', where: '.range button[aria-pressed]', ink: 'var(--sw-text-inverse)', bed: ACC, kind: 'text' },
  { screen: 'system-calendars', where: '.linkrow:hover .chip.acc', ink: 'var(--sw-text-inverse)', bed: ACC, kind: 'text' },
  // failure rows of the cast / players settings (screens/system-cast.ts, system-multimedia-players.ts)
  { screen: 'system-multimedia-players', where: '.err', ink: 'var(--sw-danger-text)', bed: `color-mix(in srgb, var(--sw-danger) 10%, ${SURF})`, kind: 'text' },
  // (its 30 % danger hairline is decoration on an already tinted card whose text says the error - not a 1.4.11 boundary, not measured)
  // the toasts (styles/media-page.ts, screens/system-tickets.ts, screens/tickets-rfqs.ts, screens/devices-automations.ts)
  { screen: 'toast (shared)', where: '.toast text', ink: 'var(--sw-toast-text)', bed: TOAST, kind: 'text' },
  { screen: 'toast (shared)', where: '.toast action', ink: 'var(--sw-toast-action)', bed: TOAST, kind: 'text' },
  { screen: 'toast (shared)', where: '.toast .ic (success)', ink: 'var(--sw-success)', bed: TOAST, kind: 'ui' },
  { screen: 'media-page', where: '.toast.bad .ic', ink: 'color-mix(in srgb, var(--sw-danger) 70%, var(--sw-toast-text))', bed: TOAST, kind: 'ui' },
  { screen: 'system-tickets / tickets-rfqs', where: '.toast.bad .ic', ink: 'var(--sw-danger)', bed: TOAST, kind: 'ui' },
  // SETUPPLAN-POLISH-2331: the default-position star (screens/plan-studio6-panel.ts)
  { screen: 'plan-studio6-panel', where: '.walkrow .star[aria-pressed]', ink: 'var(--sw-warning)', bed: SURF, kind: 'ui' },
  // INSIGHTS-POLISH-2331: the count inside a filter chip (insights/styles.ts): resting at opacity 0.8; selected at full ink (at 0.8 it read 4.47:1, domus)
  { screen: 'insights', where: '.chip .n', ink: 'var(--sw-text-2)', bed: SURF, kind: 'text', alpha: INSIGHTS_CHIP_N_ALPHA },
  { screen: 'insights', where: '.chip.sel .n', ink: 'var(--sw-accent-text)', bed: 'var(--sw-accent-soft)', kind: 'text' },
  // HOMEEDIT-POLISH-2331: the phone line of a widget that is off (screens/home-edit-panel.ts), on the panel's well: the muted ink
  // (it was --sw-text-2 at opacity 0.6: 3.36-3.78:1)
  { screen: 'home-edit-panel', where: '.w.off .w-phone', ink: 'var(--sw-text-3)', bed: 'var(--sw-well)', kind: 'text' },
  // DEVICES-POLISH-2331: the synoptic lights hit area on hover (screens/devices-synoptic.ts)
  { screen: 'devices-synoptic', where: '.lights-hit:hover', ink: 'var(--sw-text)', bed: 'color-mix(in srgb, var(--sw-lit) 14%, transparent)', kind: 'text' },
];

const MIN: Record<Kind, number> = { text: 4.5, ui: 3 };

/** A tiny evaluator of the colour expressions the screens write: var() (with fallback), color-mix(in srgb, A p%, B q%), transparent, literals. */
function makeEval(t: Record<string, { light: string; dark: string }>, scheme: 'light' | 'dark' = 'dark') {
  const split = (s: string): string[] => {
    const out: string[] = [];
    let depth = 0;
    let cur = '';
    for (const ch of s) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const ev = (raw: string, depth = 0): RGBA => {
    const s = raw.trim();
    if (depth > 20) throw new Error(`too deep: ${raw}`);
    if (s === 'transparent') return [0, 0, 0, 0];
    let m = /^var\((--[a-z0-9-]+)\s*(?:,\s*([\s\S]+))?\)$/i.exec(s);
    if (m) {
      const v = t[m[1]]?.[scheme];
      if (v !== undefined && v.trim() !== 'initial') return ev(v, depth + 1); // `initial` = guaranteed-invalid: the fallback applies
      if (m[2]) return ev(m[2], depth + 1);
      throw new Error(`undefined token ${m[1]} without fallback`);
    }
    m = /^color-mix\(\s*in\s+srgb\s*,([\s\S]+)\)$/i.exec(s);
    if (m) {
      const [a, b] = split(m[1]).map((part) => {
        const pm = /^([\s\S]+?)\s+(\d+(?:\.\d+)?)%$/.exec(part);
        return pm ? { c: ev(pm[1], depth + 1), p: Number(pm[2]) / 100 } : { c: ev(part, depth + 1), p: NaN };
      });
      let pa = a.p;
      let pb = b.p;
      if (Number.isNaN(pa) && Number.isNaN(pb)) [pa, pb] = [0.5, 0.5];
      else if (Number.isNaN(pb)) pb = 1 - pa;
      else if (Number.isNaN(pa)) pa = 1 - pb;
      const sum = pa + pb;
      const mult = Math.min(sum, 1);
      const [na, nb] = [pa / sum, pb / sum];
      const alpha = a.c[3] * na + b.c[3] * nb;
      if (alpha === 0) return [0, 0, 0, 0];
      const rgb = [0, 1, 2].map((i) => (a.c[i] * a.c[3] * na + b.c[i] * b.c[3] * nb) / alpha);
      return [rgb[0], rgb[1], rgb[2], alpha * mult];
    }
    const c = parseColor(s);
    if (!c) throw new Error(`cannot parse ${raw}`);
    return c;
  };
  return ev;
}

// the well token lives on the settings host (styles/settings.ts), not in the table: give the evaluator the same definition
const LOCAL = { '--sw-well': { light: 'color-mix(in srgb, var(--sw-surface-2) 76%, var(--sw-border))', dark: 'color-mix(in srgb, var(--sw-surface-2) 76%, var(--sw-border))' } };

function measure(id: (typeof SKIN_IDS)[number], scheme: 'light' | 'dark' = 'dark') {
  const ev = makeEval({ ...skinTable(id), ...LOCAL }, scheme);
  const page = over(ev('var(--sw-bg)'), [0, 0, 0, 1]);
  const card = over(ev(SURF), page);
  return PAIRS.map((p) => {
    const base = p.under ? over(ev(p.under), page) : card;
    const bed = over(ev(p.bed), base);
    const ink = over(ev(p.ink), bed);
    const ratio = contrastRatio(p.alpha !== undefined && p.alpha < 1 ? over([ink[0], ink[1], ink[2], p.alpha], bed) : ink, bed);
    return { ...p, ratio };
  });
}

const SKINS_LIVE = SKIN_IDS.filter((id) => !FROZEN_SKINS.includes(id));

test('dark schemes: the inks of the 01.11 polished screens read on their mixed beds (text 4.5:1, graphics 3:1), every live skin', () => {
  const fails: string[] = [];
  const rows: string[] = [];
  for (const id of SKINS_LIVE) {
    for (const r of measure(id)) {
      const line = `${id}/dark ${r.screen} ${r.where} ${r.ink}: ${r.ratio.toFixed(2)} (min ${MIN[r.kind]})`;
      rows.push(line);
      if (r.ratio < MIN[r.kind]) fails.push(line);
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});

// ---- the chosen key of a segmented control (owner answer A, 2026-11-01; DARK-SEG-ALL-2380, owner-approved 03.11) ----
// DARK-REVIEW-2342 lifted the dark thumb toward the ink (--sw-seg-thumb): a raised key, but only ~1.1-1.3:1 from its track, under
// the 3:1 WCAG 1.4.11 asks of a chosen segment. GATE2370-B gave the SETTINGS key the light pill (--sw-seg-key, its opaque dark label
// --sw-seg-key-ink); DARK-SEG-ALL-2380 moved every other segmented control onto the same two tokens and retired --sw-seg-thumb.
// Every rule in src/ whose background reads var(--sw-seg-key, ..) is collected from the source and its background / color
// expressions are evaluated exactly as written (var() chains, fallbacks), per live skin, dark column, against every track a
// segmented control draws (surface-3 or surface-2 in a card, surface-3 in the user menu, surface-2 on the page, the card surface
// itself): the key 3:1 from the track, its label 4.5:1 on the key. The accent-filled keys and tesla's inverted pill are measured too.

const walkSrc = (d: string = SRC, out: string[] = []): string[] => {
  for (const e of readdirSync(d)) {
    const p = path.join(d, e);
    if (statSync(p).isDirectory()) walkSrc(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
};
const relSrc = (f: string) => path.relative(SRC, f).split(path.sep).join('/');
/** a frozen skin's rules are never drawn (skins/index.ts FROZEN_SKINS); they stay as they were */
const FROZEN_FILES = FROZEN_SKINS.map((id) => `design/skins/${id}.ts`);
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const normSel = (s: string) => stripComments(s).replace(/\s+/g, ' ').trim();
/** the LAST declaration of a property in a rule body (sw-cast-picker writes a fallback colour line, then light-dark()) */
const decl = (body: string, prop: string): string | undefined => {
  const all = [...stripComments(body).matchAll(new RegExp(`(?:^|[;{\\s])${prop}:\\s*([^;{}]+?)\\s*(?:;|$)`, 'g'))];
  return all.length ? all[all.length - 1][1].trim() : undefined;
};
interface KeyRule {
  file: string;
  sel: string;
  body: string;
  bg: string;
  ink: string;
}
/** the chosen-key rules that draw no colour of their own: the label inherits it from the rule named here */
const INHERITED_INK: Record<string, string> = {
  // the skins' sw-tabs pill dresses only the fill / shadow; the label is the component's .on .lbl colour
  "[data-variant='pill']) .on .lbl": 'var(--sw-seg-key-ink, currentColor)',
  // sw-app's security row (design a): the pill inside the chosen link inherits nav.sections a.on
  'nav.secrow a.on .pill': 'var(--sw-seg-key-ink, var(--sw-accent-text))',
  // live-camera's hovered chosen transport key keeps the fill; its label is still .round .transport button.on's
  '.round .transport button.on:hover:not(:disabled)': 'var(--sw-seg-key-ink, var(--sw-accent-text))',
};
function keyRules(): KeyRule[] {
  const out: KeyRule[] = [];
  for (const f of walkSrc()) {
    const file = relSrc(f);
    if (FROZEN_FILES.includes(file)) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const bg = decl(m[2], 'background');
      if (!bg || !bg.includes('var(--sw-seg-key,')) continue;
      const sel = normSel(m[1]);
      const inherited = Object.entries(INHERITED_INK).find(([k]) => sel.endsWith(k));
      out.push({ file, sel, body: m[2], bg, ink: decl(m[2], 'color') ?? inherited?.[1] ?? '' });
    }
  }
  return out;
}
const KEY_TRACKS: Record<string, { track: string; under: string }> = {
  'surface-3 track in a card': { track: 'var(--sw-surface-3)', under: SURF },
  'surface-2 track in a card': { track: 'var(--sw-surface-2)', under: SURF },
  'surface-3 track in the user menu': { track: 'var(--sw-surface-3)', under: 'var(--sw-menu-surface)' },
  'surface-2 track on the page': { track: 'var(--sw-surface-2)', under: 'var(--sw-bg)' },
  'card-surface track on the page': { track: SURF, under: 'var(--sw-bg)' },
};
/** the chosen keys that are NOT the light pill, on the tracks they actually sit on: an accent fill under the inverse ink (the dark
 * accent reads only 2.6-2.9:1 from a surface-3 track in classic / infra / soft, so an accent key there takes the light pill too -
 * home-screen-css .pfl .segs did), tesla's inverted pill (its track is transparent: the card) */
const OTHER_KEYS: { where: string; bg: string; ink: string; tracks: (keyof typeof KEY_TRACKS)[]; skins?: readonly string[] }[] = [
  { where: 'live-wall .layouts (accent key in the raised surface tray)', bg: 'var(--sw-accent)', ink: 'var(--sw-text-inverse)', tracks: ['card-surface track on the page'] },
  { where: 'system-plan-view .range / plan-studio-panel .modes / system-audit .pages (accent key among outlined keys on the card)', bg: 'var(--sw-accent)', ink: 'var(--sw-text-inverse)', tracks: ['card-surface track on the page'] },
  { where: 'design/skins/tesla.ts sw-tabs pill .on .lbl (inverted)', bg: 'var(--sw-text)', ink: 'var(--sw-text-inverse)', tracks: ['card-surface track on the page', 'surface-3 track in a card'], skins: ['tesla'] },
];

function measureKeys(id: (typeof SKIN_IDS)[number], rules: KeyRule[]) {
  const ev = makeEval({ ...skinTable(id), ...LOCAL }, 'dark');
  const page = over(ev('var(--sw-bg)'), [0, 0, 0, 1]);
  const out: { line: string; ok: boolean }[] = [];
  const all = Object.keys(KEY_TRACKS) as (keyof typeof KEY_TRACKS)[];
  const keys = [...rules.map((r) => ({ where: `${r.file} ${r.sel.slice(-70)}`, bg: r.bg, ink: r.ink, tracks: all })), ...OTHER_KEYS.filter((k) => !k.skins || k.skins.includes(id))];
  for (const k of keys) {
    for (const name of k.tracks) {
      const tr = KEY_TRACKS[name];
      const track = over(ev(tr.track), over(ev(tr.under), page));
      const key = over(ev(k.bg), track);
      const fill = contrastRatio(key, track);
      const ink = contrastRatio(over(ev(k.ink), key), key);
      out.push({ line: `${id}/dark ${k.where} - key vs ${name}: ${fill.toFixed(2)} (min 3)`, ok: fill >= 3 });
      out.push({ line: `${id}/dark ${k.where} - label on the key (${name}): ${ink.toFixed(2)} (min 4.5)`, ok: ink >= 4.5 });
    }
  }
  // an unchosen label (--sw-text-2) on each track
  for (const [name, tr] of Object.entries(KEY_TRACKS)) {
    const track = over(ev(tr.track), over(ev(tr.under), page));
    const off = contrastRatio(over(ev('var(--sw-text-2)'), track), track);
    out.push({ line: `${id}/dark unchosen label on ${name}: ${off.toFixed(2)} (min 4.5)`, ok: off >= 4.5 });
  }
  return out;
}

test('dark schemes: every chosen segment key is 3:1 from its track and its label 4.5:1, every live skin (DARK-SEG-ALL-2380)', () => {
  const rules = keyRules();
  const noInk = rules.filter((r) => !r.ink).map((r) => `${r.file}: ${r.sel} - a chosen key without a colour (add color: var(--sw-seg-key-ink, ..))`);
  expect(noInk).toEqual([]);
  const rows = SKINS_LIVE.flatMap((id) => measureKeys(id, rules));
  const summary = rows.filter((r) => !r.ok || /settings\.ts .* key vs surface-3 track in a card|unchosen label on surface-3 track in a card/.test(r.line));
  console.log(`${rules.length} chosen-key rules read --sw-seg-key; ${rows.length} measurements\n` + summary.map((r) => r.line).join('\n'));
  expect(rows.filter((r) => !r.ok).map((r) => r.line)).toEqual([]);
});

test('light schemes: the segment key tokens are `initial` (every user falls back to its own light fill); --sw-seg-thumb is retired', () => {
  for (const id of SKIN_IDS) {
    const t = skinTable(id);
    expect(t['--sw-seg-key'].light, id).toBe('initial');
    expect(t['--sw-seg-key-ink'].light, id).toBe('initial');
    expect(t['--sw-seg-thumb-shadow'].light, id).toBe('initial');
    expect(t['--sw-seg-thumb'], `${id}: --sw-seg-thumb was retired by DARK-SEG-ALL-2380 (use --sw-seg-key / --sw-seg-key-ink)`).toBeUndefined();
  }
});

// GATE2370-B (WCAG 1.4.11, the in-browser check is evidence-polish2-295): the SETTINGS key (styles/settings.ts settingsSegStyles) in
// dark is the light pill --sw-seg-key on the surface-3 track inside a card - 3:1 from the track, its label --sw-seg-key-ink 4.5:1 on
// it, an unselected --sw-text-2 label 4.5:1 on the track; light stays `initial` (the card surface + the accent ink).
test('dark schemes: the chosen settings key is 3:1 from its track and its label 4.5:1, every live skin', () => {
  const rows: { line: string; ok: boolean }[] = [];
  for (const id of SKINS_LIVE) {
    const t = skinTable(id);
    expect(t['--sw-seg-key'].light, id).toBe('initial');
    expect(t['--sw-seg-key-ink'].light, id).toBe('initial');
    const ev = makeEval({ ...t, ...LOCAL }, 'dark');
    const page = over(ev('var(--sw-bg)'), [0, 0, 0, 1]);
    const track = over(ev('var(--sw-surface-3)'), over(ev(SURF), page));
    const key = over(ev('var(--sw-seg-key, var(--sw-surface))'), track);
    const fill = contrastRatio(key, track);
    const on = contrastRatio(over(ev('var(--sw-seg-key-ink, var(--sw-accent-text))'), key), key);
    const off = contrastRatio(over(ev('var(--sw-text-2)'), track), track);
    rows.push({ line: `${id}/dark settings key vs track: ${fill.toFixed(2)} (min 3)`, ok: fill >= 3 });
    rows.push({ line: `${id}/dark settings key label: ${on.toFixed(2)} (min 4.5)`, ok: on >= 4.5 });
    rows.push({ line: `${id}/dark settings unselected label: ${off.toFixed(2)} (min 4.5)`, ok: off >= 4.5 });
  }
  console.log(rows.map((r) => r.line).join('\n'));
  expect(rows.filter((r) => !r.ok).map((r) => r.line)).toEqual([]);
});

// DARK-SEG-ALL-2380: the inventory of the segmented controls (a track of 2-4 keys, one chosen) whose chosen key is a neutral
// surface in light. Each draws the dark light pill: `background: var(--sw-seg-key, <light fill>)`, `color: var(--sw-seg-key-ink,
// <light ink>)` and the edge `box-shadow: var(--sw-seg-thumb-shadow, <light shadow>)`. A control that drops the tokens fails here; a
// NEW one is caught by the pattern check below and joins this list.
const SEG_INVENTORY: [file: string, chosen: string][] = [
  ['access-external/request-dialog.ts', ".seg button[aria-pressed='true']"],
  ['arx/arx-login.ts', 'button.mode.on'],
  ['calendars/cal-page.ts', ".tab[aria-current='page']"],
  ['calendars/resident.ts', ".tabs button[aria-pressed='true']"],
  ['calendars/styles.ts', ".seg button[aria-pressed='true']"],
  ['calendars/view-manage.ts', ".rolepick button[aria-pressed='true']"],
  ['components/device-activity.ts', '.segt button.on'],
  ['components/device-activity.ts', '.vw button.on'],
  ['components/frigate-admin-shared.ts', ".seg button[aria-pressed='true']"],
  ['components/sw-cast-picker.ts', ".seg button[aria-pressed='true']"],
  ['components/sw-tabs.ts', ":host([data-variant='pill']) .on .lbl"],
  ['components/sw-timeline.ts', '.windows button.on'],
  ['components/sw-view-switch.ts', "button[aria-pressed='true']"],
  ['design/skins/crystal.ts', ":host(sw-tabs[data-variant='pill']) .on .lbl"],
  ['design/skins/domus.ts', ":host(sw-tabs[data-variant='pill']) .on .lbl"],
  ['electricity/styles.ts', ".seg button[aria-pressed='true']"],
  ['elevators/elevator-settings.ts', ".seg button[aria-pressed='true']"],
  ['incidents/settings-form.ts', ".seg button[aria-pressed='true']"],
  ['insights/styles.ts', ".seg button[aria-pressed='true']"],
  ['maintenance/round-run.ts', ".vw button[aria-pressed='true']"],
  ['maintenance/styles.ts', ".seg button[aria-pressed='true']"],
  ['notices/styles.ts', ".seg button[aria-pressed='true']"],
  ['screens/area-quick-sheet.ts', '.seg button.on'],
  ['screens/devices-building.ts', ".bswitch button[aria-pressed='true']"],
  ['screens/devices-layout-css.ts', ".lay-seg button[aria-pressed='true']"],
  ['screens/explore-presence.ts', ".seg button[aria-pressed='true']"],
  ['screens/home-screen-css.ts', ".pfl .segs button[aria-pressed='true']"],
  ['screens/home-screen-options.ts', ".seg button[aria-pressed='true']"],
  ['screens/home-widgets.ts', ".seg button[aria-pressed='true']"],
  ['screens/investigate-events.ts', '.rangepick button.on'],
  ['screens/investigate-ha-events.ts', '.rangepick button.on'],
  ['screens/investigate-history-map.ts', ".seg button[aria-pressed='true']"],
  ['screens/investigate-incidents.ts', ".ptabs button[aria-pressed='true']"],
  ['screens/investigate-reviews.ts', ".layers button[aria-selected='true']"],
  ['screens/investigate-reviews.ts', ".seg button[aria-pressed='true']"],
  ['screens/live-camera.ts', '.round .transport button.on'],
  ['screens/plan-studio6-panel.ts', ".seg.sm button[aria-pressed='true']"],
  ['screens/schedule-conditions.ts', ".seg button[aria-pressed='true']"],
  ['screens/schedule-create-dialog.ts', ".tabs button[aria-selected='true']"],
  ['screens/schedule-editor.ts', ".seg button[aria-pressed='true']"],
  ['screens/schedule-entity-picker.ts', ".seg button[aria-pressed='true']"],
  ['screens/security-alarm.ts', ".vt button[aria-pressed='true']"],
  ['screens/system-brand-installer.ts', ".tabs button[aria-selected='true']"],
  ['screens/system-brand-logos.ts', ".seg button[aria-pressed='true']"],
  ['screens/system-brand-logos.ts', ".tabs button[aria-selected='true']"],
  ['screens/system-building-presence.ts', ".seg button[aria-pressed='true']"],
  ['screens/system-design.ts', ".seg button[aria-pressed='true']"],
  ['screens/system-home-screen.ts', ".seg button[aria-pressed='true']"],
  ['screens/system-look.ts', ".seg button[aria-pressed='true']"],
  ['screens/system-mapping.ts', ".seg button[aria-pressed='true']"],
  ['screens/system-nav-size.ts', ".seg button[aria-pressed='true']"],
  ['screens/system-palette-editor.ts', ".seg button[aria-pressed='true']"],
  ['screens/system-presence.ts', ".seg button[aria-pressed='true']"],
  ['screens/system-readiness.ts', ".panes button[aria-selected='true']"],
  ['screens/system-timeline-colors.ts', ".seg button[aria-checked='true']"],
  ['screens/system-update.ts', ".seg button[aria-pressed='true']"],
  ['screens/wiskey-events.ts', ".seg button[aria-pressed='true']"],
  ['screens/wiskey-person-drawer.ts', ".tabs button[aria-selected='true']"],
  ['shell/sw-app.ts', 'nav.sections a.on'],
  ['shell/sw-app.ts', ":host([data-design='a']) nav.secrow a.on .pill"],
  ['shell/sw-home-personal.ts', ".seg button[aria-pressed='true']"],
  ['shell/sw-user-menu.ts', "li.view .seg button[aria-pressed='true']"],
  ['styles/settings.ts', ".seg button[aria-selected='true']"],
  ['temperature/detail.ts', ".seg button[aria-pressed='true']"],
  ['temperature/report.ts', ".seg button[aria-pressed='true']"],
  ['temperature/wizard.ts', ".seg button[aria-pressed='true']"],
];

test('lint: every segmented control in the inventory draws its chosen key with --sw-seg-key / --sw-seg-key-ink (DARK-SEG-ALL-2380)', () => {
  const rules = keyRules();
  const bad: string[] = [];
  for (const [file, chosen] of SEG_INVENTORY) {
    const r = rules.find((k) => k.file === file && k.sel.endsWith(chosen));
    if (!r) {
      bad.push(`${file}: ${chosen} - no rule with background: var(--sw-seg-key, <light fill>)`);
      continue;
    }
    if (!r.ink.includes('--sw-seg-key-ink')) bad.push(`${file}: ${chosen} - color without var(--sw-seg-key-ink, <light ink>)`);
    const sh = decl(r.body, 'box-shadow');
    if (sh && sh !== 'none' && !sh.includes('--sw-seg-thumb-shadow')) bad.push(`${file}: ${chosen} - box-shadow without var(--sw-seg-thumb-shadow, <light shadow>)`);
  }
  expect(rules.length, 'chosen-key rules reading --sw-seg-key (the inventory of DARK-SEG-ALL-2380)').toBeGreaterThanOrEqual(SEG_INVENTORY.length);
  expect(bad).toEqual([]);
});

// a NEW segmented control: a chosen key `.seg / .segs / .segt / .lay-seg / .sevseg / .vw / .tabs / .rangepick / .ptabs / .panes /
// .rolepick / .windows / .bswitch / .transport / .vt button[aria-pressed|aria-selected|aria-checked='true'|.on]` or sw-tabs' pill
// `.on .lbl` drawn with a neutral surface must read the key tokens; nobody reads the retired --sw-seg-thumb fill any more
test('lint: no neutral chosen segment without --sw-seg-key, no --sw-seg-thumb fill (DARK-SEG-ALL-2380)', () => {
  const RULE = /([^{}]*(?:\.(?:seg|segs|segt|lay-seg|sevseg|vw|tabs|rangepick|ptabs|panes|rolepick|windows|bswitch|transport|vt)(?:\.[\w-]+)? button(?:\[aria-(?:pressed|selected|checked)='true'\]|\.on)|\[data-variant='pill'\]\) \.on \.lbl)[^{}]*)\{([^{}]*)\}/g;
  const NEUTRAL_BG = /background:\s*var\(--sw-(?:surface|surface-solid|surface-2|menu-surface)\b/;
  const bad: string[] = [];
  for (const f of walkSrc()) {
    const file = relSrc(f);
    if (FROZEN_FILES.includes(file)) continue;
    const src = readFileSync(f, 'utf8');
    if (/var\(--sw-seg-thumb,/.test(src)) bad.push(`${file}: reads the retired var(--sw-seg-thumb, ..) - use var(--sw-seg-key, ..) with var(--sw-seg-key-ink, ..)`);
    for (const m of src.matchAll(RULE)) {
      const sel = normSel(m[1]);
      // the glass / bubble / tesla hosts carry their own knobs (--mm-seg-thumb, an inverted key) and are not neutral surface keys
      if (/glass|bubble|data-skin|:hover|:active/.test(sel)) continue;
      if (NEUTRAL_BG.test(stripComments(m[2]))) bad.push(`${file}: ${sel.slice(-80)} - a neutral chosen key without var(--sw-seg-key, ..)`);
    }
  }
  expect(bad).toEqual([]);
});

// the fixes this spec models are the CSS the screens ship (a later edit of one of them must update the row above as well)
test('the modelled values are the ones in the screens', () => {
  const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\s+/g, ' ');
  const has = (f: string, needle: string) => expect(read(f), `${f} should contain: ${needle}`).toContain(needle);
  const lacks = (f: string, rx: RegExp) => expect(read(f), `${f} should not match ${rx}`).not.toMatch(rx);
  for (const f of ['screens/nvr-camera-batch.ts', 'screens/nvr-encoding-batch.ts']) {
    has(f, `.sel:not([aria-checked='true']) .box { border-color: light-dark(var(--sw-text-3), ${BOX_EDGE_DARK}); }`);
  }
  has('screens/nvr-camera-batch.ts', 'light-dark(color-mix(in srgb, var(--sw-accent) 32%, var(--sw-surface)), color-mix(in srgb, var(--sw-accent) 28%, var(--sw-surface)))');
  lacks('screens/water/page-meters.ts', /\.tree button\[aria-current='true'\] \.cnt \{[^}]*opacity/);
  has('screens/home-edit-panel.ts', '.w.off .w-phone { color: var(--sw-text-3); }');
  has('insights/styles.ts', `.chip .n { font-variant-numeric: tabular-nums; opacity: ${INSIGHTS_CHIP_N_ALPHA};`);
  has('insights/styles.ts', '.chip.sel .n { opacity: 1; }');
});
