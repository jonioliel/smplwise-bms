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

// ---- the selected segment of a segmented control (owner answer A, 2026-11-01) ----
// The thumb (--sw-seg-thumb) on the two tracks the users draw (surface-3: sw-tabs' pill and most `.seg`; surface-2: the presence,
// temperature, notices and request-dialog segments) inside a card, and on the user menu's opaque surface. The selected inks the users
// write: heading, text, accent-text (sw-tabs' pill and the settings `.seg`), text-2 (an unselected label next to it, for the order).
const SEG_TRACKS: Record<string, { track: string; under?: string }> = {
  'surface-3 track in a card': { track: 'var(--sw-surface-3)' },
  'surface-2 track in a card': { track: 'var(--sw-surface-2)' },
  'surface-3 track in the user menu': { track: 'var(--sw-surface-3)', under: 'var(--sw-menu-surface)' },
};
const SEG_INKS = ['var(--sw-heading)', 'var(--sw-text)', 'var(--sw-accent-text)'];
const SEG_RING = 'color-mix(in srgb, var(--sw-text) 20%, transparent)';
/** the thumb's own fill against its track; below this the ring (>= SEG_RING_MIN against the track) carries the shape */
const SEG_FILL_MIN = 1.1;
const SEG_RING_MIN = 1.5;

function measureSeg(id: (typeof SKIN_IDS)[number]) {
  const t = { ...skinTable(id), ...LOCAL };
  const ev = makeEval(t, 'dark');
  const page = over(ev('var(--sw-bg)'), [0, 0, 0, 1]);
  const out: { line: string; ok: boolean }[] = [];
  for (const [name, tr] of Object.entries(SEG_TRACKS)) {
    const base = over(ev(tr.under ?? SURF), page);
    const track = over(ev(tr.track), base);
    const thumb = over(ev('var(--sw-seg-thumb)'), track);
    const fill = contrastRatio(thumb, track);
    const ring = contrastRatio(over(ev(SEG_RING), track), track);
    out.push({ line: `${id}/dark seg thumb vs ${name}: fill ${fill.toFixed(2)} (min ${SEG_FILL_MIN}), ring ${ring.toFixed(2)} (min ${SEG_RING_MIN})`, ok: fill >= SEG_FILL_MIN && ring >= SEG_RING_MIN && fill > 1 });
    for (const ink of SEG_INKS) {
      const r = contrastRatio(over(ev(ink), thumb), thumb);
      out.push({ line: `${id}/dark seg thumb (${name}) ${ink}: ${r.toFixed(2)} (min 4.5)`, ok: r >= 4.5 });
    }
    // the thumb must be LIGHTER than its track in dark (a raised key, not a hole)
    const lum = (c: RGBA) => contrastRatio(c, [0, 0, 0, 1]);
    out.push({ line: `${id}/dark seg thumb lighter than ${name}`, ok: lum(thumb) > lum(track) });
  }
  return out;
}

test('dark schemes: the selected segment is a raised key - lighter than its track, ringed, its inks at 4.5:1, every live skin', () => {
  const rows = SKINS_LIVE.flatMap(measureSeg);
  console.log(rows.map((r) => r.line).join('\n'));
  expect(rows.filter((r) => !r.ok).map((r) => r.line)).toEqual([]);
});

test('light schemes: the segment thumb token is `initial` (every user falls back to its own light fill)', () => {
  for (const id of SKIN_IDS) {
    const t = skinTable(id);
    expect(t['--sw-seg-thumb'].light, id).toBe('initial');
    expect(t['--sw-seg-thumb-shadow'].light, id).toBe('initial');
  }
});

// every selected segment drawn with a neutral surface key reads the dark thumb (a new segmented control must too): the rule of
// `.seg / .segs / .lay-seg / .sevseg button[aria-pressed|aria-checked='true']` and sw-tabs' pill `.on .lbl` in src/ and the skins
test('lint: a neutral segment thumb is var(--sw-seg-thumb, <light fill>) with var(--sw-seg-thumb-shadow, <light shadow>)', () => {
  const walk = (d: string, out: string[] = []): string[] => {
    for (const e of readdirSync(d)) {
      const p = path.join(d, e);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (p.endsWith('.ts')) out.push(p);
    }
    return out;
  };
  const RULE = /([^{}]*(?:\.(?:seg|segs|lay-seg|sevseg) button\[aria-(?:pressed|checked)='true'\]|\[data-variant='pill'\]\) \.on \.lbl)[^{}]*)\{([^{}]*)\}/g;
  const NEUTRAL_BG = /background:\s*var\(--sw-(?:surface|surface-solid|menu-surface)\b/;
  const bad: string[] = [];
  let users = 0;
  // a frozen skin's rules are never drawn (skins/index.ts FROZEN_SKINS); they stay as they were
  const frozen = FROZEN_SKINS.map((id) => path.join(SRC, 'design', 'skins', `${id}.ts`));
  for (const f of walk(SRC)) {
    if (frozen.includes(f)) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(RULE)) {
      const [sel, body] = [m[1], m[2]];
      // the glass / bubble / tesla rules carry their own knobs (--mm-seg-thumb, an inverted key) and are not neutral surface keys
      if (/glass|bubble|data-skin/.test(sel)) continue;
      if (!NEUTRAL_BG.test(body) && !/--sw-seg-thumb/.test(body)) continue;
      users++;
      const rel = path.relative(SRC, f).split(path.sep).join('/');
      if (NEUTRAL_BG.test(body)) bad.push(`${rel}: ${sel.trim().slice(-80)} - background without var(--sw-seg-thumb, ..)`);
      if (/box-shadow:\s*var\(--sw-shadow-[123]\)/.test(body)) bad.push(`${rel}: ${sel.trim().slice(-80)} - box-shadow without var(--sw-seg-thumb-shadow, ..)`);
    }
  }
  expect(users, 'the segmented controls found (the inventory of DARK-REVIEW-2342 is 37)').toBeGreaterThanOrEqual(37);
  expect(bad).toEqual([]);
});

// the fixes this spec models are the CSS the screens ship (a later edit of one of them must update the row above as well)
test('the modelled values are the ones in the screens', () => {
  const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\s+/g, ' ');
  const has = (f: string, needle: string) => expect(read(f), `${f} should contain: ${needle}`).toContain(needle);
  const lacks = (f: string, rx: RegExp) => expect(read(f), `${f} should not match ${rx}`).not.toMatch(rx);
  for (const f of ['screens/nvr-camera-batch.ts', 'screens/nvr-encoding-batch.ts']) {
    has(f, `.sel:not([aria-checked='true']) .box { border-color: light-dark(var(--sw-border-strong), ${BOX_EDGE_DARK}); }`);
  }
  has('screens/nvr-camera-batch.ts', 'light-dark(color-mix(in srgb, var(--sw-accent) 32%, var(--sw-surface)), color-mix(in srgb, var(--sw-accent) 28%, var(--sw-surface)))');
  lacks('screens/water/page-meters.ts', /\.tree button\[aria-current='true'\] \.cnt \{[^}]*opacity/);
  has('screens/home-edit-panel.ts', '.w.off .w-phone { color: var(--sw-text-3); }');
  has('insights/styles.ts', `.chip .n { font-variant-numeric: tabular-nums; opacity: ${INSIGHTS_CHIP_N_ALPHA};`);
  has('insights/styles.ts', '.chip.sel .n { opacity: 1; }');
});
