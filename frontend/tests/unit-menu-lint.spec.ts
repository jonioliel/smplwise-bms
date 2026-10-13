import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MENU_SURFACES, MENU_TOKEN_SETTERS, SKIN_MENU_SELECTORS } from '../src/styles/menu-surface';
import { SKINS, SKIN_IDS } from '../src/design/skins';
import { materialRules } from '../src/styles/material';

// The drift guard of "no transparency in any menu" (owner 2026-10-13): a future menu cannot be translucent by accident. It reads the CSS of
// every component, screen and skin and fails when
//   1. a registered menu surface (src/styles/menu-surface.ts) does not paint `var(--sw-menu-surface)` or has a backdrop-filter;
//   2. a rule is NAMED like a menu (.pop .menu .tray .results .typepop .colspanel .rowpreview ...) or FLOATS like one (position absolute | fixed,
//      the floating shadow, the translucent --sw-surface) and is neither registered nor exempted below with a reason;
//   3. a skin paints a menu selector (a popover, a dropdown's list, the search panel) with anything but the menu token, with a blur, or in one
//      rule together with a dialog or a drawer;
//   4. a stylesheet sets the menu tokens to a value outside the allowed bridges (the glass screens' solid twin, the media Bubble undo, the remote).
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

test('every registered menu surface paints var(--sw-menu-surface) and never a backdrop-filter', () => {
  const bad: string[] = [];
  for (const m of MENU_SURFACES) {
    const rules = (rulesByFile.get(m.file) ?? []).filter((r) => r.selectors.includes(m.selector));
    if (!rules.length) {
      bad.push(`${m.file} | ${m.selector}: no such rule (stale registry entry, or the selector changed)`);
      continue;
    }
    const painted = rules.filter((r) => backgrounds(r.body).some((b) => b.includes('var(--sw-menu-surface)')));
    if (!painted.length) bad.push(`${m.file} | ${m.selector}: none of its ${rules.length} rule(s) paints var(--sw-menu-surface) (${m.what})`);
    for (const r of rules) {
      for (const b of backgrounds(r.body)) if (!b.includes('var(--sw-menu-surface)') && !TRIVIAL.test(b)) bad.push(`${m.file} | ${m.selector}: background: ${b.slice(0, 80)} is not the menu surface`);
      for (const f of blurs(r.body)) if (f !== 'none') bad.push(`${m.file} | ${m.selector}: backdrop-filter: ${f.slice(0, 60)} - a menu does not blur`);
    }
  }
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
