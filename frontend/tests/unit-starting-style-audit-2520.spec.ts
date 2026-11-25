import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// STARTING-STYLE-AUDIT-2520: every `@starting-style` entrance of the frontend is checked for the two faults FLAKY-FIX-2520 found in
// sw-dialog. Node only, no page: the component sources are read as text.
//   1. a dead entrance: a starting style only wins over the rules BEFORE it (same specificity), so a later rule with the same selector
//      that sets the same property makes the starting value never apply - nothing moves;
//   2. a fade of text: a starting `opacity` below 1 on a layer that holds text puts every text inside it below contrast for the length of
//      the fade (axe colour-contrast caught it). Only layers with no text may fade (a ::backdrop, the home scrim - an empty sibling).
const here = path.dirname(fileURLToPath(import.meta.url));
// SW_AUDIT_SRC: another copy of frontend/src (the proof run of the change note points the checker at the base commit's sources)
const SRC = process.env.SW_AUDIT_SRC || path.join(here, '..', 'src');

/** The layers that hold no text and may fade their opacity: the browser's ::backdrop and the home interface's empty scrim sibling. */
const NO_TEXT_LAYER = (sel: string) => /::backdrop\b/.test(sel) || /^\.hscrim\b/.test(sel);
/** A later longhand is overridden by these shorthands as well (the properties the starting styles of the app use). */
const OVERRIDDEN_BY: Record<string, string[]> = { 'background-color': ['background'], '-webkit-backdrop-filter': [], 'backdrop-filter': [] };

type Rule = { start: number; end: number; selectors: string[]; decls: Map<string, string>; inStarting: boolean; inReduced: boolean };

/** Comments blanked to spaces (same length: the positions stay), so a brace or a semicolon in a comment never counts. */
const blankComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** The [start, end) ranges of every block that opens with `re` (brace-matched): the starting styles, the reduced-motion queries. */
function blocks(s: string, re: RegExp): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let m = re.exec(s); m; m = re.exec(s)) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < s.length && depth > 0; i++) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') depth--;
    }
    out.push([m.index, i]);
  }
  return out;
}

/** The innermost rules (`selector { declarations }`) of a source, with whether each sits inside a starting style. */
function rules(text: string): Rule[] {
  const s = blankComments(text);
  const starting = blocks(s, /@starting-style\s*\{/g);
  const reduced = blocks(s, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g);
  const within = (r: Array<[number, number]>, at: number) => r.some(([a, b]) => at > a && at < b);
  const out: Rule[] = [];
  const re = /([^{};]+)\{([^{}]*)\}/g;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    const head = m[1].trim();
    if (!head || head.startsWith('@')) continue;
    const selectors = head.split(',').map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean);
    const decls = new Map<string, string>();
    for (const d of m[2].split(';')) {
      const c = d.indexOf(':');
      if (c > 0) decls.set(d.slice(0, c).trim(), d.slice(c + 1).trim());
    }
    const start = m.index + m[0].indexOf(m[1].trimStart().charAt(0));
    out.push({ start, end: m.index + m[0].length, selectors, decls, inStarting: within(starting, start), inReduced: within(reduced, start) });
  }
  return out;
}

/** Fault 1: a starting-style declaration that a LATER ordinary rule with the same selector overrides (the entrance never runs). A
 * later rule inside `@media (prefers-reduced-motion: reduce)` is the intended override (no travel under reduced motion), not a fault. */
function deadEntrances(text: string): string[] {
  const all = rules(text);
  const bad: string[] = [];
  for (const st of all.filter((r) => r.inStarting)) {
    for (const later of all.filter((r) => !r.inStarting && !r.inReduced && r.start > st.end)) {
      const same = st.selectors.filter((x) => later.selectors.includes(x));
      if (!same.length) continue;
      for (const prop of st.decls.keys()) {
        const hits = [prop, ...(OVERRIDDEN_BY[prop] ?? [])].filter((p) => later.decls.has(p));
        for (const h of hits) bad.push(`${same.join(', ')} { ${prop} } is overridden by a later "${h}" - the entrance is dead`);
      }
    }
  }
  return bad;
}

/** Fault 2: a starting opacity below 1 on a layer that may hold text. */
function textFades(text: string): string[] {
  const bad: string[] = [];
  for (const st of rules(text).filter((r) => r.inStarting)) {
    const v = st.decls.get('opacity');
    if (v === undefined || Number.parseFloat(v) >= 1) continue;
    const texty = st.selectors.filter((x) => !NO_TEXT_LAYER(x));
    if (texty.length) bad.push(`${texty.join(', ')} { opacity: ${v} } - a layer that holds text fades`);
  }
  return bad;
}

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(p));
    else if (/\.ts$/.test(e.name) && fs.readFileSync(p, 'utf8').includes('@starting-style')) out.push(p);
  }
  return out;
}

// the sw-dialog styles as they stood at v2.51.0 (3d71fb183), shortened: the fault FLAKY-FIX-2520 fixed - the checker must catch both parts
const OLD_DIALOG = `
    .backdrop {
      position: fixed;
      opacity: 1;
      transition: opacity var(--sw-t-slow) var(--sw-ease);
    }
    @starting-style {
      .backdrop {
        opacity: 0;
      }
      .box {
        opacity: 0;
        transform: scale(0.96) translateY(6px);
      }
    }
    .box {
      box-sizing: border-box;
      opacity: 1;
      transform: none;
      transition: opacity var(--sw-t-sheet) var(--sw-ease), transform var(--sw-spring-dialog-ms) var(--sw-spring-dialog);
    }
`;

test('the checker catches the sw-dialog fault of v2.51.0: the dead box entrance and the faded text layers', () => {
  const dead = deadEntrances(OLD_DIALOG);
  expect(dead.some((x) => x.startsWith('.box { opacity }'))).toBe(true);
  expect(dead.some((x) => x.startsWith('.box { transform }'))).toBe(true);
  const fades = textFades(OLD_DIALOG);
  expect(fades).toEqual(['.backdrop { opacity: 0 } - a layer that holds text fades', '.box { opacity: 0 } - a layer that holds text fades']);
  // a starting style placed after its rule, by transform, is clean; a ::backdrop and the home scrim may fade
  const ok = `.box { transform: none; } @starting-style { .box { transform: scale(0.96); } } dialog::backdrop { opacity: 1; }
    @starting-style { dialog[open]::backdrop { opacity: 0; } .hscrim {opacity: 0;} }`;
  expect(deadEntrances(ok)).toEqual([]);
  expect(textFades(ok)).toEqual([]);
  // a later shorthand overrides a starting longhand too
  expect(deadEntrances(`@starting-style { .s { background-color: transparent; } } .s { background: red; }`)).toHaveLength(1);
});

test('every @starting-style entrance of the frontend: never dead, never a fade of a layer that holds text', () => {
  const files = sources(SRC);
  // the sites of the audit (STARTING-STYLE-AUDIT-2520): a new one is checked automatically; the list only proves the walk found them
  const rel = files.map((f) => path.relative(SRC, f).replace(/\\/g, '/')).sort();
  for (const f of [
    'components/sw-dialog.ts',
    'components/sw-drawer.ts',
    'components/sw-dropdown.ts',
    'components/sw-recorded-month.ts',
    'home/home-styles.ts',
    'screens/devices-notices-css.ts',
    'screens/door-windows.ts',
    'screens/home-edit-drawer.ts',
    'screens/infra-temperature.ts',
    'screens/mapping-assistant-css.ts',
    'shell/sw-app.ts',
    'tickets/list-toolbar.ts',
  ])
    expect(rel).toContain(f);
  const bad: string[] = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const name = path.relative(SRC, f).replace(/\\/g, '/');
    for (const x of [...deadEntrances(text), ...textFades(text)]) bad.push(`${name}: ${x}`);
  }
  expect(bad).toEqual([]);
});

test('the entrances that hold text no longer transition their opacity (the starting value is gone, so is the transition)', () => {
  const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8');
  const dd = read('components/sw-dropdown.ts');
  expect(dd).toMatch(/\.pop:not\(\.sheet\):not\(\.centred\) \{\s*transform-origin: top center;\s*transition: transform var\(--sw-t-fast\) var\(--sw-ease\);\s*\}/);
  expect(read('components/sw-recorded-month.ts')).toMatch(/transition: transform var\(--sw-t-fast\) var\(--sw-ease\);\s*\}\s*@starting-style \{\s*\.pop:popover-open \{\s*transform: scale\(0\.97\) translateY\(-4px\);/);
  expect(read('tickets/list-toolbar.ts')).toMatch(/transform-origin: top;\s*transition: transform var\(--sw-t-fast\) var\(--sw-ease\);/);
  expect(read('shell/sw-app.ts')).toMatch(/translate: 0 0;\s*transition: translate var\(--sw-t-toast\) var\(--sw-ease\);/);
  expect(read('screens/home-edit-drawer.ts')).toMatch(/transform: none;\s*(\/\*[\s\S]*?\*\/\s*)?transition: transform var\(--sw-t-sheet\) var\(--sw-ease-out\);/);
  // the mapping assistant's starting style now comes after its .sheet transition rule
  const ma = read('screens/mapping-assistant-css.ts');
  expect(ma.indexOf('transform: scale(0.98) translateY(8px);')).toBeGreaterThan(ma.indexOf('transition: transform 220ms'));
  // home: the scrim (no text) still fades; the sheets, the call and the full-screen camera arrive by transform; the ghost copy's exit
  // (.out, inert and hidden from readers) keeps its fade
  const hs = read('home/home-styles.ts');
  expect(hs).toContain('@starting-style { .hscrim {opacity: 0;}');
  expect(hs).toContain('.sheet.dialog, .sheet.umenu {transform: scale(.96);}');
  expect(hs).toContain('.call, .camfull {transform: scale(1.02);} }');
  expect(hs).toContain('@starting-style { .toast2 {transform: translateY(14px);} }');
  expect(hs).toContain('.sheet.dialog.out, .sheet.umenu.out {opacity: 0;');
});
