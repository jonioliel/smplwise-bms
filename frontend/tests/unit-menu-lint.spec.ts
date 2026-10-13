import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HUD_SURFACES, MENU_SURFACES, MENU_TOKEN_SETTERS, SKIN_MENU_SELECTORS, type MenuSurface } from '../src/styles/menu-surface';
import { SKINS, SKIN_IDS } from '../src/design/skins';
import { materialRules } from '../src/styles/material';

// The drift guard of "no transparency in any menu" (owner 2026-10-13) and of its second half the same day, "the HUD panels over the plan are
// opaque too": a future menu or HUD panel cannot be translucent by accident. It reads the CSS of every component, screen and skin and fails when
//   1. a registered menu surface (src/styles/menu-surface.ts) does not paint `var(--sw-menu-surface)` or has a backdrop-filter;
//   2. a rule is NAMED like a menu (.pop .menu .tray .results .typepop .colspanel .rowpreview ...) or FLOATS like one (position absolute | fixed,
//      the floating shadow, the translucent --sw-surface) and is neither registered nor exempted below with a reason;
//   3. a skin paints a menu selector (a popover, a dropdown's list, the search panel) with anything but the menu token, with a blur, or in one
//      rule together with a dialog or a drawer;
//   4. a stylesheet sets the menu tokens to a value outside the allowed bridges (the glass screens' solid twin, the media Bubble undo, the remote);
//   5. a registered HUD panel (HUD_SURFACES) does not paint the menu token (or re-point the surface token for the controls it holds) or blurs;
//   6. a rule that FLOATS over a canvas (a screen that mounts the plan canvas or the 3D element, or one of the map's own elements: position
//      absolute | fixed) paints a translucent fill or a blur and is neither registered nor exempted below with a reason;
//   7. the CSS of a registered HUD panel or of a menu in such a file colours its text with an ink that fails 4.5:1 on the opaque surface in some
//      skin x scheme (`--sw-text-3`, a bare state colour, the bare accent).
//   npx playwright test -c playwright.unit.config.ts tests/unit-menu-lint.spec.ts
// The browser twin (opens real menus in every skin x scheme and reads the computed alpha and blur) is tests/evidence-menu-opaque.spec.ts.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

/** Rules that look like a menu to the scan and are not one, with the reason (a new entry needs a reason too). Key: `<file> | <selector>`. */
const EXEMPT: Record<string, string> = {
  'components/media-player-css.ts | .pop': 'an in-flow list inside the remote panel (no position), over the remote\'s own opaque surface - it floats over nothing',
  'components/sw-drawer.ts | .panel': 'a drawer is a modal layer (translucency bounded by the contrast floor over a dimmed scrim), not a menu',
  'screens/devices-layout-css.ts | .lay-panel': 'the layout editor\'s docked side panel: a panel on the page, not a menu',
  'screens/wiskey-people.ts | .colmenu': 'WisKey code (other engineers merge it); already opaque through --sw-surface-solid - migrate with the WisKey merge',
};

const MENU_CLASS = /^(pop|popup|popover|menu|tray|typepop|pickpop|colmenu|colspanel|rowpreview|tlpreview|timepop|results|searchpanel|listbox|dropdown)$/;

// ---- reading CSS out of the sources ----
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/');

interface Rule {
  selectors: string[];
  body: string;
  at: string;
}

/** The selectors of a rule head, split at the top-level commas. */
function splitSelectors(head: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of head) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim().replace(/\s+/g, ' '));
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim().replace(/\s+/g, ' '));
  return out;
}

/** The rules of a CSS text, nested @media / @supports flattened (with the at-rule that wraps them). */
function parseRules(css: string, at = ''): Rule[] {
  const out: Rule[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const head = css.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (head.startsWith('@')) {
      if (/^@(media|supports|container|layer)/.test(head)) out.push(...parseRules(body, `${at} ${head}`.trim()));
    } else if (head) out.push({ selectors: splitSelectors(head), body, at });
    i = j;
  }
  return out;
}

/** The CSS template literals of a module (css`...`), `${...}` interpolations blanked. */
function cssOf(src: string): string[] {
  return [...src.matchAll(/css`([\s\S]*?)`/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, ' '));
}

const decls = (body: string, prop: string): string[] => [...body.matchAll(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`, 'gm'))].map((m) => m[1].trim());
const backgrounds = (body: string) => [...decls(body, 'background'), ...decls(body, 'background-color')];
const blurs = (body: string) => [...decls(body, 'backdrop-filter'), ...decls(body, '-webkit-backdrop-filter')];
const TRIVIAL = /^(transparent|none|inherit|initial|unset|currentColor)$/i;

/** The last compound of a selector (after the last top-level combinator). */
function tailOf(sel: string): string {
  let depth = 0;
  let idx = -1;
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (depth === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) idx = i;
  }
  return sel.slice(idx + 1);
}

const files = walk(SRC)
  .map((f) => ({ abs: f, rel: rel(f) }))
  .filter((f) => !f.rel.startsWith('design/') && f.rel !== 'styles/menu-surface.ts');
const rulesByFile = new Map<string, Rule[]>();
for (const f of files) rulesByFile.set(f.rel, cssOf(readFileSync(f.abs, 'utf8')).flatMap((c) => parseRules(c)));

test('the scan reads the product (it finds the CSS of the shell, the components, the screens and the media styles)', () => {
  const total = [...rulesByFile.values()].reduce((n, r) => n + r.length, 0);
  expect(total).toBeGreaterThan(4000);
  for (const f of ['shell/sw-user-menu.ts', 'components/sw-dropdown.ts', 'styles/media-glass.ts', 'map/sw-plan-3d.ts']) expect(rulesByFile.get(f)?.length, f).toBeGreaterThan(10);
});

/** What is wrong with the registered surfaces (an empty list = they all paint the menu token and none blurs). A HUD entry that re-points the
 * surface token (`via: 'surface-token'`) is checked for the two declarations instead of a background. */
function badPaint(list: readonly (MenuSurface & { via?: 'background' | 'surface-token' | 'fill' })[]): string[] {
  const bad: string[] = [];
  for (const m of list) {
    const rules = (rulesByFile.get(m.file) ?? []).filter((r) => r.selectors.includes(m.selector));
    if (!rules.length) {
      bad.push(`${m.file} | ${m.selector}: no such rule (stale registry entry, or the selector changed)`);
      continue;
    }
    if (m.via === 'fill') {
      const fills = (r: Rule) => decls(r.body, 'fill');
      if (!rules.some((r) => fills(r).some((v) => v.includes('var(--sw-menu-surface)')))) bad.push(`${m.file} | ${m.selector}: none of its ${rules.length} rule(s) fills with var(--sw-menu-surface) (${m.what})`);
      for (const r of rules) for (const v of fills(r)) if (!v.includes('var(--sw-menu-surface)') && !TRIVIAL.test(v)) bad.push(`${m.file} | ${m.selector}: fill: ${v.slice(0, 80)} is not the menu surface`);
      for (const r of rules) for (const v of decls(r.body, 'fill-opacity')) if (Number(v) !== 1) bad.push(`${m.file} | ${m.selector}: fill-opacity: ${v} - a label pill is opaque`);
      continue;
    }
    if (m.via === 'surface-token') {
      const set = rules.filter((r) => decls(r.body, '--sw-surface').includes('var(--sw-menu-surface)') && decls(r.body, '--sw-surface-2').includes('var(--sw-surface-2-solid)'));
      if (!set.length) bad.push(`${m.file} | ${m.selector}: none of its ${rules.length} rule(s) re-points --sw-surface at var(--sw-menu-surface) and --sw-surface-2 at var(--sw-surface-2-solid) (${m.what})`);
      for (const r of rules) for (const f of blurs(r.body)) if (f !== 'none') bad.push(`${m.file} | ${m.selector}: backdrop-filter: ${f.slice(0, 60)} - a HUD panel does not blur`);
      continue;
    }
    const painted = rules.filter((r) => backgrounds(r.body).some((b) => b.includes('var(--sw-menu-surface)')));
    if (!painted.length) bad.push(`${m.file} | ${m.selector}: none of its ${rules.length} rule(s) paints var(--sw-menu-surface) (${m.what})`);
    for (const r of rules) {
      for (const b of backgrounds(r.body)) if (!b.includes('var(--sw-menu-surface)') && !TRIVIAL.test(b)) bad.push(`${m.file} | ${m.selector}: background: ${b.slice(0, 80)} is not the menu surface`);
      for (const f of blurs(r.body)) if (f !== 'none') bad.push(`${m.file} | ${m.selector}: backdrop-filter: ${f.slice(0, 60)} - a menu does not blur`);
    }
  }
  return bad;
}

test('every registered menu surface paints var(--sw-menu-surface) and never a backdrop-filter', () => {
  const bad = badPaint(MENU_SURFACES);
  expect(bad, bad.join('\n')).toEqual([]);
});

test('a rule named like a menu (.pop .menu .tray .results ...) or floating like one is registered, or exempted with a reason; no stale exemption', () => {
  const registered = new Set(MENU_SURFACES.map((m) => `${m.file} | ${m.selector}`));
  const flagged = new Set<string>();
  const unregistered: string[] = [];
  for (const [file, rules] of rulesByFile) {
    for (const r of rules) {
      const bgs = backgrounds(r.body);
      const bdf = blurs(r.body);
      const position = decls(r.body, 'position').pop() ?? '';
      const shadow = decls(r.body, 'box-shadow').join(' ');
      for (const sel of r.selectors) {
        if (/::/.test(sel)) continue; // a scrim (::backdrop) or a decoration (::before / ::after) is not the surface
        const key = `${file} | ${sel}`;
        const classes = [...tailOf(sel).matchAll(/\.([a-z0-9_-]+)/gi)].map((x) => x[1]);
        const named = classes.some((c) => MENU_CLASS.test(c)) && (bgs.length > 0 || bdf.length > 0);
        const floats = /^(absolute|fixed)$/.test(position) && /shadow-3/.test(shadow) && bgs.some((b) => /var\(--sw-surface\)/.test(b));
        if (!named && !floats) continue;
        const clean = bgs.every((b) => b.includes('var(--sw-menu-surface)') || TRIVIAL.test(b)) && bdf.every((f) => f === 'none');
        if (clean && !floats) continue; // an opaque menu rule that is already clean needs no entry
        if (registered.has(key)) continue;
        flagged.add(key);
        if (!(key in EXEMPT)) unregistered.push(`${key}  (background: ${bgs.join(' ; ').slice(0, 60)}${bdf.length ? `; backdrop-filter: ${bdf.join(' ; ').slice(0, 30)}` : ''}${r.at ? ` ${r.at}` : ''})`);
      }
    }
  }
  const stale = Object.keys(EXEMPT).filter((k) => !flagged.has(k));
  expect(unregistered, `a menu-like rule that is neither a registered menu surface nor exempted - paint var(--sw-menu-surface) (and add it to MENU_SURFACES in src/styles/menu-surface.ts), or add it to EXEMPT with the reason it is not a menu:\n${unregistered.join('\n')}`).toEqual([]);
  expect(stale, `stale EXEMPT entries (the rule is gone or now clean):\n${stale.join('\n')}`).toEqual([]);
});

test('the skins paint a menu selector (a popover, a dropdown list, the search panel) with the menu token only: no blur, and never in one rule with a dialog or a drawer', () => {
  const bad: string[] = [];
  let seen = 0;
  for (const id of SKIN_IDS) {
    const css = SKINS[id].rules + materialRules(id);
    for (const r of parseRules(css)) {
      const menu = r.selectors.filter((s) => SKIN_MENU_SELECTORS.includes(s));
      if (!menu.length) continue;
      seen++;
      // a rule that only adds a layer or a shadow (the material layer's `background-image`) may name a menu with its neighbours; one that PAINTS the
      // surface (a colour or a blur) is the menu's alone - sharing it with a dialog or a drawer is how a menu once inherited their glass
      const paints = backgrounds(r.body).length > 0 || blurs(r.body).length > 0;
      if (paints && menu.length !== r.selectors.length) bad.push(`${id}: ${r.selectors.join(', ').slice(0, 120)} paints a menu together with another surface (a dialog / drawer / pill): give the menu its own rule`);
      for (const b of backgrounds(r.body)) if (!b.includes('var(--sw-menu-surface)') && !TRIVIAL.test(b)) bad.push(`${id}: ${menu.join(', ')} paints background: ${b.slice(0, 80)} - a menu paints var(--sw-menu-surface)`);
      for (const f of blurs(r.body)) if (f !== 'none') bad.push(`${id}: ${menu.join(', ')} has backdrop-filter: ${f.slice(0, 50)} - a menu does not blur`);
    }
  }
  expect(seen, 'the skins do style the menus (the scan sees their rules)').toBeGreaterThanOrEqual(8);
  expect(bad, bad.join('\n')).toEqual([]);
});

test('the menu tokens are set in the allowed bridges only, to the allowed (opaque) values', () => {
  const bad: string[] = [];
  let seen = 0;
  for (const [file, rules] of rulesByFile) {
    for (const r of rules) {
      for (const prop of ['--sw-menu-surface', '--sw-menu-border']) {
        for (const v of decls(r.body, prop)) {
          seen++;
          const allowed = MENU_TOKEN_SETTERS[file];
          if (!allowed) bad.push(`${file}: sets ${prop}: ${v} - only ${Object.keys(MENU_TOKEN_SETTERS).join(', ')} may`);
          else if (!allowed.includes(v)) bad.push(`${file}: sets ${prop}: ${v} - allowed: ${allowed.join(' | ')}`);
        }
      }
    }
  }
  expect(seen, 'the bridges exist').toBeGreaterThanOrEqual(6);
  expect(bad, bad.join('\n')).toEqual([]);
});

// ---- the HUD panels over the plan and 3D canvases (owner 2026-10-13, second report)

/** The fills a rule that floats over a canvas must not paint: the translucent glass surfaces, a mix / rgba / hsla, a soft state tone on its own, a
 * scrim, the image badge. `--sw-menu-surface`, the `-solid` twins, the map ground, the accent and the toast colour are opaque and pass - and so does a
 * value built ON the menu surface (a tone laid over it, a mix with it) unless it mixes it with `transparent` or an rgba. */
const GLASS = /var\(--sw-(surface|surface-2|surface-3)\)|color-mix\(|rgba?\(|hsla?\(|var\(--sw-[a-z0-9-]*-soft\)|var\(--sw-overlay\)|var\(--sw-video-scrim[a-z-]*\)|var\(--sw-on-image-bg\)/i;
const TRANSLUCENT = { test: (v: string): boolean => GLASS.test(v) && !(v.includes('var(--sw-menu-surface)') && !/transparent|rgba?\(|hsla?\(/i.test(v)) };

/** The elements the canvases are mounted by or made of: a file that mounts one, plus the map's own implementers. */
const CANVAS_TAG = /<(sw-plan-canvas|sw-plan-3d|sw-plan-stills|sw-wall-plan|sw-floor-image-align)\b/;
const CANVAS_IMPLEMENTERS = ['map/sw-plan-canvas.ts', 'map/sw-plan-3d.ts', 'map/walk-hud.ts', 'map/sw-floor-image-align.ts', 'map/sw-plan-stills.ts'];
/** A file that mounts a canvas element but whose floating chrome is not over a plan (with the reason). */
const CANVAS_HOST_SKIP: Record<string, string> = {
  'wall/sw-wall.ts': 'the live wall display: its floating chrome (the settings panel, the "updated" chip, the take-over layer) sits over camera video in its own dark wall palette (--wall-*); the plan band it mounts is a separate element whose HUD is hidden (kiosk)',
};

/** A rule that floats over a canvas, paints a translucent fill or blurs, and is not a HUD panel - with the reason. Key: `<file> | <selector>`. */
const HUD_EXEMPT: Record<string, string> = {
  'screens/investigate-event-detail.ts | .chip': 'a pill on the camera\'s snapshot / clip, not on the plan: the on-video HUD family (a dark scrim with white text; its contrast does not depend on the picture)',
  'map/walk-hud.ts | .stick': 'the joystick ring under the thumb: no text, it must show the scene beneath the finger',
  'map/walk-hud.ts | .target': 'the mark where a tap sent the walk: no text, it must show the scene',
  'map/sw-plan-3d.ts | .vignette': 'a pointer-events:none edge darkening of the realistic view: no text, no control',
};

const canvasHosts = files.filter((f) => {
  if (f.rel in CANVAS_HOST_SKIP) return false;
  return CANVAS_IMPLEMENTERS.includes(f.rel) || CANVAS_TAG.test(readFileSync(f.abs, 'utf8'));
});

test('the scan finds the canvas hosts (the floor map, the editor, the history and event maps, the 3D element, the walk, the 2D canvas)', () => {
  const names = canvasHosts.map((f) => f.rel);
  for (const f of ['screens/explore-floor-map.ts', 'screens/explore-plan-editor.ts', 'screens/investigate-history-map.ts', 'screens/investigate-event-detail.ts', ...CANVAS_IMPLEMENTERS]) expect(names, f).toContain(f);
});

test('every registered HUD panel paints var(--sw-menu-surface) (or re-points the surface token for the controls it holds) and never blurs', () => {
  const bad = badPaint(HUD_SURFACES);
  expect(bad, bad.join('\n')).toEqual([]);
  // the HUD registry and the menu registry never name the same rule twice (one owner per surface)
  const menus = new Set(MENU_SURFACES.map((m) => `${m.file} | ${m.selector}`));
  expect(HUD_SURFACES.filter((h) => menus.has(`${h.file} | ${h.selector}`)).map((h) => `${h.file} | ${h.selector}`)).toEqual([]);
  // every registered HUD surface lives in a canvas host (a panel somewhere else is a card or a menu, not a HUD panel)
  const hosts = new Set(canvasHosts.map((f) => f.rel));
  expect(HUD_SURFACES.filter((h) => !hosts.has(h.file)).map((h) => `${h.file} | ${h.selector}`)).toEqual([]);
});

test('a rule that floats over a canvas and paints a translucent fill or a blur is a registered menu / HUD panel, or exempted with a reason; no stale exemption', () => {
  const registered = new Set([...MENU_SURFACES, ...HUD_SURFACES].map((m) => `${m.file} | ${m.selector}`));
  const flagged = new Set<string>();
  const unregistered: string[] = [];
  for (const f of canvasHosts) {
    for (const r of rulesByFile.get(f.rel) ?? []) {
      const position = decls(r.body, 'position').pop() ?? '';
      if (!/^(absolute|fixed)$/.test(position)) continue;
      const bgs = backgrounds(r.body);
      const bdf = blurs(r.body);
      const translucent = bgs.some((b) => TRANSLUCENT.test(b)) || bdf.some((v) => v !== 'none');
      if (!translucent) continue;
      for (const sel of r.selectors) {
        if (/::/.test(sel)) continue; // a decoration (::before / ::after) is not the surface
        const key = `${f.rel} | ${sel}`;
        if (registered.has(key)) continue; // (a registered rule that still paints a translucent fill is the previous tests' failure)
        flagged.add(key);
        if (!(key in HUD_EXEMPT)) unregistered.push(`${key}  (background: ${bgs.join(' ; ').slice(0, 70)}${bdf.length ? `; backdrop-filter: ${bdf.join(' ; ').slice(0, 30)}` : ''}${r.at ? ` ${r.at}` : ''})`);
      }
    }
  }
  const stale = Object.keys(HUD_EXEMPT).filter((k) => !flagged.has(k));
  expect(unregistered, `a rule floating over a canvas paints a translucent fill: make it opaque (background: var(--sw-menu-surface), border var(--sw-menu-border), no backdrop-filter) and add it to HUD_SURFACES in src/styles/menu-surface.ts, or add it to HUD_EXEMPT here with the reason it is not a panel:\n${unregistered.join('\n')}`).toEqual([]);
  expect(stale, `stale HUD_EXEMPT entries (the rule is gone or now opaque):\n${stale.join('\n')}`).toEqual([]);
});

/** The ink a text may have on the opaque surface in every skin x scheme (tests/unit-hud-opaque.spec.ts proves each pair at 4.5:1): the body, heading and
 * secondary ink, the text twins of the state colours and of the accent, the thermometer ink, the ink of an accent fill, a custom ink a pill brings
 * (map/pill-ink.ts maps the scene's bare colours to their readable twins). */
const INK_OK = /^(inherit|currentColor|var\(--sw-(text|heading|text-2|text-inverse|accent-text|map-temp|(live|recorded|offline|stale|unknown|danger|warning|forbidden)-text)(, var\(--sw-[a-z0-9-]+\))?\)|var\(--lbl(, var\(--sw-text\))?\))$/;

test('the text of a HUD panel (and of a menu over a canvas) is coloured with a readable ink only: never --sw-text-3, a bare state colour or the bare accent', () => {
  const bad: string[] = [];
  const roots = new Map<string, Set<string>>();
  for (const m of [...MENU_SURFACES, ...HUD_SURFACES]) {
    if (!canvasHosts.some((f) => f.rel === m.file)) continue;
    const root = /^[.a-z][a-z0-9_-]*/i.exec(m.selector)?.[0];
    if (!root || !root.startsWith('.')) continue;
    (roots.get(m.file) ?? roots.set(m.file, new Set()).get(m.file)!).add(root);
  }
  let seen = 0;
  for (const [file, set] of roots) {
    for (const r of rulesByFile.get(file) ?? []) {
      for (const sel of r.selectors) {
        const head = /^(\.[a-z0-9_-]+)/i.exec(sel)?.[1];
        if (!head || !set.has(head)) continue;
        for (const c of decls(r.body, 'color')) {
          seen++;
          if (!INK_OK.test(c)) bad.push(`${file} | ${sel}: color: ${c} - on the opaque surface use --sw-text, --sw-text-2, --sw-accent-text or a -text twin (--sw-text-3 and the bare state colours fail 4.5:1 on a light skin)`);
        }
      }
    }
  }
  expect(seen, 'the scan reads the colours of the HUD panels').toBeGreaterThan(20);
  expect(bad, bad.join('\n')).toEqual([]);
});

test('a label pill drawn in the plan canvas (an SVG rect inside a chip or a note, or a label -bg shape) fills with the opaque surface, never glass or a white mix', () => {
  const bad: string[] = [];
  let seen = 0;
  for (const r of rulesByFile.get('map/sw-plan-canvas.ts') ?? []) {
    for (const sel of r.selectors) {
      const t = tailOf(sel);
      if (!(t === 'rect' || /(lbl|zl|label)-bg$/.test(t))) continue;
      for (const f of decls(r.body, 'fill')) {
        seen++;
        if (TRANSLUCENT.test(f)) bad.push(`map/sw-plan-canvas.ts | ${sel}: fill: ${f.slice(0, 70)} - a label pill over the plan is opaque: fill: var(--sw-menu-surface) (and register it in HUD_SURFACES with via: 'fill')`);
      }
    }
  }
  expect(seen, 'the scan reads the label pills of the canvas').toBeGreaterThanOrEqual(6);
  expect(bad, bad.join('\n')).toEqual([]);
});
