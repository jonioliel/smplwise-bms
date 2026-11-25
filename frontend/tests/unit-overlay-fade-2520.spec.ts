import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// OVERLAY-FADE-2520: the overlays whose entrance faded their texts WITHOUT @starting-style (STARTING-STYLE-AUDIT-2520 question B, option a):
// class-toggled transitions (an open state that ends at opacity 1 while an opacity transition is in force) and keyframe entrances (a
// `from` / `0%` frame below opacity 1). Node only, no page: the component sources are read as text. The checker walks ALL of frontend/src,
// so a new fade anywhere fails here; the only fades allowed are
//   - layers that hold no text (a scrim / backdrop, a picture), and
//   - the in-page choreography the owner approved (the screen panels, the home screen change, ...) - an owner decision (question B b),
//     listed in IN_PAGE below with the reason; this row does not change them.
// The exits are not checked here: an exit may fade only while the element is inert (sw-sheet, area-quick-sheet, the user menu and the
// notification centre set `inert` on the closed panel; see the change note's table).
const here = path.dirname(fileURLToPath(import.meta.url));
// SW_AUDIT_SRC: another copy of frontend/src (the change note's proof run points the checker at the base commit's sources)
const SRC = process.env.SW_AUDIT_SRC || path.join(here, '..', 'src');

/** A layer that holds no text may fade: the scrims / backdrops (empty siblings of the panel) and a picture. */
const NO_TEXT = (sel: string) => /::backdrop\b|(^|[\s.>])\.?(scrim|hscrim|backdrop)\b|\bimg\s*$/.test(sel.replace(/\[[^\]]*\]|:host\([^)]*\)/g, ' ').trim());
/** The open state of an overlay, as the app writes it. */
const OPEN = /\[open\]|\[data-open\]|\[data-shown\]|:popover-open|\.(?:in|open|show|shown|visible)\b/g;

type Rule = { start: number; selectors: string[]; decls: Map<string, string>; reduced: boolean };

const blankComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

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

function rules(s: string): Rule[] {
  const reduced = blocks(s, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g);
  const kf = blocks(s, /@keyframes\s+[\w-]+\s*\{/g);
  const within = (r: Array<[number, number]>, at: number) => r.some(([a, b]) => at > a && at < b);
  const out: Rule[] = [];
  const re = /([^{};]+)\{([^{}]*)\}/g;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    const head = m[1].slice(m[1].lastIndexOf('`') + 1).trim(); // the first rule of a css`` template: not the code before it
    if (!head || head.startsWith('@') || within(kf, m.index + m[0].length - 1)) continue;
    const decls = new Map<string, string>();
    for (const d of m[2].split(';')) {
      const c = d.indexOf(':');
      if (c > 0) decls.set(d.slice(0, c).trim(), d.slice(c + 1).trim());
    }
    const selectors = head.split(',').map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean);
    out.push({ start: m.index, selectors, decls, reduced: within(reduced, m.index) });
  }
  return out;
}

/** The selector with its open state and its attribute filters taken away: the open rule and the rules that carry its transition meet here. */
const general = (sel: string) =>
  sel
    .replace(/:not\([^)]*\)/g, '')
    .replace(OPEN, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/:host\(\s*\)/g, ':host')
    .replace(/^:host\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
const fadesBy = (t: string | undefined) => t !== undefined && /\bopacity\b|\ball\b/.test(t) && !/^none\b/.test(t);

/** Class-toggled entrances: an open-state rule that ends at opacity 1 while the transition in force on it lists opacity. The transition in
 * force is the rule's own, else the one of another open-state rule of the same layer (`:host([open]) .panel` for `:host([mode][open]) .panel`),
 * else the closed rule's. A rule inside the reduced-motion query is resolved inside the query first. */
export function entranceFades(text: string): string[] {
  const all = rules(blankComments(text));
  const bad: string[] = [];
  for (const r of all) {
    const v = r.decls.get('opacity');
    if (v === undefined) continue;
    const closedByNot = Number.parseFloat(v) < 1;
    for (const sel of r.selectors) {
      // the open state (ends at opacity 1), or a closed state written as `:not(<open>)` below 1 (the base calendar sheet's reduced motion)
      const shape = closedByNot ? /:not\([^)]*(\[open\]|\[data-shown\]|\.in\b|\.open\b|\.show\b)[^)]*\)/.test(sel) : !!sel.replace(/:not\([^)]*\)/g, '').match(OPEN);
      if (!shape || NO_TEXT(sel)) continue;
      let fades: boolean;
      if (r.decls.has('transition')) fades = fadesBy(r.decls.get('transition'));
      else {
        const g = general(sel);
        const pick = (pool: Rule[]) => {
          const src = pool.filter((q) => q.decls.has('transition') && q.selectors.some((x) => general(x) === g));
          const open = src.filter((q) => q.selectors.some((x) => general(x) === g && x.match(OPEN)));
          return open.length ? open : src;
        };
        let src = r.reduced ? pick(all.filter((q) => q.reduced)) : [];
        if (!src.length) src = pick(all.filter((q) => !q.reduced));
        fades = src.some((q) => fadesBy(q.decls.get('transition')));
      }
      if (fades) bad.push(`${sel} { opacity: ${v} } - an entrance that fades a layer that holds text${r.reduced ? ' (reduced motion)' : ''}`);
    }
  }
  return bad;
}

/** The comma-separated parts of a value at parenthesis depth 0 (`a 1s var(--e, ease), b 2s` -> two animations). */
function topLevel(v: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of v) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Keyframe entrances: a keyframes block whose first frame is below opacity 1, run by a rule on a layer that may hold text. */
export function keyframeFades(text: string): string[] {
  const s = blankComments(text);
  const bad: string[] = [];
  const all = rules(s);
  for (const [a, b] of blocks(s, /@keyframes\s+([\w-]+)\s*\{/g)) {
    const name = /@keyframes\s+([\w-]+)/.exec(s.slice(a, b))![1];
    const first = /(?:^|[{}\s])(?:from|0%)(?:\s*,[^{]*)?\s*\{([^}]*)\}/.exec(s.slice(a, b).replace(/^@keyframes\s+[\w-]+\s*\{/, ' '));
    const op = first && /opacity:\s*([\d.]+)/.exec(first[1]);
    if (!op || Number.parseFloat(op[1]) >= 1) continue;
    // a loop (a pulse: `infinite`, or a count above 1) is a state indicator, not an entrance
    const runs = (val: string) =>
      topLevel(val).some((one) => new RegExp(`(^|\\s)${name}(\\s|$)`).test(one.trim()) && !/\binfinite\b/.test(one) && !/\s([2-9]|\d{2,})(\s|$)/.test(one));
    const users = all.filter((r) => [...r.decls].some(([k, val]) => /^animation(-name)?$/.test(k) && runs(val)));
    const texty = users.flatMap((r) => r.selectors).filter((x) => !NO_TEXT(x));
    if (texty.length) bad.push(`@keyframes ${name} (opacity ${op[1]}) on ${[...new Set(texty)].join(', ')}`);
  }
  return bad;
}

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(p));
    else if (/\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

/** The fades this row leaves, by file and keyframes / selector start: in-page choreography (owner decision, STARTING-STYLE-AUDIT-2520
 * question B b) and not-an-overlay surfaces. A finding must START with one of these to pass. */
const IN_PAGE: Record<string, string[]> = {
  'arx/arx-login.ts': ['@keyframes login-in', '@keyframes login-fade'], // the sign-in page's entrance (in-page)
  // the fresh event on the grid (in-page); the press ring - a 3 px circle, no text (and its reduced-motion twin)
  'calendars/view-calendar.ts': ['@keyframes fresh', '@keyframes ring', '@keyframes ringfade'],
  'components/sw-block-card.ts': ['@keyframes pop'], // an automation block's body unfolding in the page (in-page disclosure)
  'components/sw-fold-cards.ts': ['@keyframes fold-in', '@keyframes fold-fade'], // the folded cards (in-page)
  'components/sw-state-panel.ts': ['@keyframes state-in', '@keyframes state-fade'], // the state panel (in-page)
  'design/skins/polish-motion.ts': ['@keyframes sw-enter'], // the screen panels' entrance (POLISH-BOLD-297, owner-approved)
  'home/home-styles.ts': ['@keyframes hs-rise', '@keyframes hs-fade'], // the home screen change (owner Q-HOME-6 a)
  'screens/devices-building-css.ts': ['@keyframes tree-areas-in'], // the devices tree (in-page)
  'screens/home-screen-css.ts': ['@keyframes hs-up'], // the home screen (in-page)
  'screens/infra-elevators.ts': ['@keyframes el-in', '@keyframes el-fade'], // the elevator cards (in-page)
  'screens/infra-temperature.ts': ['@keyframes tp-in', '@keyframes tp-fade'], // the temperature cards (in-page)
  'screens/kiosk-wall.ts': ['@keyframes k-in', '@keyframes k-rise'], // the kiosk wall (a display, in-page)
  'screens/security-alarm.ts': ['@keyframes state-in'], // the alarm state changing in place (in-page)
  'wall/sw-wall.ts': ['@keyframes ann-in', '@keyframes fade-in', '@keyframes rise', '@keyframes takeover-in'], // the wall display (no interaction)
  'xsection/sw-xsection.ts': ['@keyframes xs-fade', '@keyframes xs-rise'], // the cross-section view (in-page)
};

// the overlays of this row, as they stood at the base (900de0c46), shortened - the checker must catch each pattern
const OLD = {
  sheet: `.sheet { opacity: 0; transition: transform 200ms var(--sw-ease-out), opacity 180ms var(--sw-ease-out), visibility 0s linear 220ms; }
    :host([open]) .sheet { opacity: 1; transition: transform var(--sw-t-sheet) var(--sw-ease-thumb), opacity 250ms var(--sw-ease-dialog), visibility 0s; }
    .backdrop { opacity: 0; transition: opacity var(--sw-t-med) var(--sw-ease); } :host([open]) .backdrop { opacity: 1; }
    :host([open]) .body > ::slotted(*) { animation: focus-in var(--sw-t-sheet) var(--sw-ease-dialog) both; }
    @keyframes focus-in { from { opacity: 0; filter: blur(6px); transform: translateY(8px); } to { opacity: 1; filter: none; transform: none; } }`,
  menu: `@media (min-width: 768px) { .panel { opacity: 0; transition: opacity var(--sw-t-med) var(--sw-ease), transform var(--sw-t-med) var(--sw-ease); }
    :host([open]) .panel { opacity: 1; transform: none; } }`,
  calendar: `.pop { opacity: 0; transform: scale(0.96); transition: opacity 160ms var(--sw-ease-dialog), transform 160ms var(--sw-ease-dialog); }
    .pop.in { opacity: 1; transform: none; }
    @media (prefers-reduced-motion: reduce) { .pop, .pop.in { transform: none; } .sheet, .sheet.in { transform: none; transition: opacity 200ms ease; } .sheet:not(.in) { opacity: 0; } }`,
  quick: `.panel { transition: transform var(--qc-close-ms) var(--sw-ease-out), opacity var(--qc-close-ms) var(--sw-ease-out); }
    :host([open]) .panel { visibility: visible; transition: transform var(--qc-open-ms) var(--qc-spring), opacity 200ms var(--sw-ease-dialog), visibility 0s; }
    :host([mode='popup']) .panel { opacity: 0; } :host([mode='popup'][open][data-shown]) .panel { opacity: 1; transform: translateY(-50%); }
    :host([open][data-shown]) .cols > * { animation: qc-in var(--qc-open-ms) var(--sw-ease-dialog) both; }
    @keyframes qc-in { from { opacity: 0; transform: translateY(6px); } }`,
  popover: `:host { animation: pop var(--sw-t-med) var(--sw-ease); } @keyframes pop { from { opacity: 0; transform: translateY(4px); } }`,
};

test('the checker catches every pattern of the base overlays, and lets the scrims and the transform-only entrances pass', () => {
  expect(entranceFades(OLD.sheet)).toEqual([':host([open]) .sheet { opacity: 1 } - an entrance that fades a layer that holds text']);
  expect(keyframeFades(OLD.sheet)).toEqual(['@keyframes focus-in (opacity 0) on :host([open]) .body > ::slotted(*)']);
  expect(entranceFades(OLD.menu)).toEqual([':host([open]) .panel { opacity: 1 } - an entrance that fades a layer that holds text']);
  expect(entranceFades(OLD.calendar)).toEqual([
    '.pop.in { opacity: 1 } - an entrance that fades a layer that holds text',
    '.sheet:not(.in) { opacity: 0 } - an entrance that fades a layer that holds text (reduced motion)',
  ]);
  expect(entranceFades(OLD.quick)).toEqual([":host([mode='popup'][open][data-shown]) .panel { opacity: 1 } - an entrance that fades a layer that holds text"]);
  expect(keyframeFades(OLD.quick)).toEqual(['@keyframes qc-in (opacity 0) on :host([open][data-shown]) .cols > *']);
  expect(keyframeFades(OLD.popover)).toEqual(['@keyframes pop (opacity 0) on :host']);
  // clean: the open state moves only (its own transition has no opacity), the exit fades; a scrim fades; a keyframe by transform only
  const ok = `.panel { opacity: 0; transition: opacity 180ms ease, transform 180ms ease; } :host([open]) .panel { opacity: 1; transition: transform 240ms ease; }
    .scrim { opacity: 0; transition: opacity 200ms; } .scrim.in { opacity: 1; } :host { animation: pop 1s; } @keyframes pop { from { transform: scale(0.96); } }
    .result img { animation: in 200ms; } @keyframes in { from { opacity: 0; } }`;
  expect(entranceFades(ok)).toEqual([]);
  expect(keyframeFades(ok)).toEqual([]);
});

test('no overlay of the frontend fades its texts in: class-toggled or keyframes (only the listed in-page choreography is left)', () => {
  const bad: string[] = [];
  const left: string[] = [];
  for (const f of sources(SRC)) {
    const text = fs.readFileSync(f, 'utf8');
    if (!/opacity/.test(text)) continue;
    const name = path.relative(SRC, f).replace(/\\/g, '/');
    for (const x of [...entranceFades(text), ...keyframeFades(text)]) {
      if ((IN_PAGE[name] ?? []).some((p) => x.startsWith(p))) left.push(`${name}: ${x}`);
      else bad.push(`${name}: ${x}`);
    }
  }
  expect(bad).toEqual([]);
  // the in-page list is not stale: each entry is still a real fade (one finding per listed keyframes at least)
  for (const [file, pre] of Object.entries(IN_PAGE)) for (const p of pre) expect(left.some((x) => x.startsWith(`${file}: ${p}`)), `${file} ${p}`).toBe(true);
});

test('the changed overlays: transform-only entrances, the exits fade only while inert, reduced motion neither travels nor fades in', () => {
  const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8');
  const sheet = read('components/sw-sheet.ts');
  expect(sheet).toMatch(/:host\(\[open\]\) \.sheet \{\s*transform: translateY\(-50%\) scale\(1\);\s*opacity: 1;\s*visibility: visible;\s*transition: transform var\(--sw-t-sheet\) var\(--sw-ease-thumb\), visibility 0s;/);
  expect(sheet).toContain('?inert=${!this.open}');
  expect(sheet).toMatch(/@keyframes focus-in \{\s*from \{\s*transform: translateY\(8px\);\s*\}\s*to \{\s*transform: none;\s*\}\s*\}/);
  const menu = read('shell/sw-user-menu.ts');
  expect(menu).toMatch(/:host\(\[open\]\) \.panel \{\s*opacity: 1;\s*transform: none;\s*transition: transform var\(--sw-t-med\) var\(--sw-ease\);/);
  expect(menu).toContain('?inert=${!this.open}');
  const nc = read('components/notify-center.ts');
  expect(nc).toMatch(/:host\(\[open\]\) \.panel \{\s*opacity: 1;\s*transform: none;\s*transition: transform 300ms var\(--mm-ease\);/);
  expect(nc).toContain('?inert=${!this.open}');
  expect(nc).toMatch(/prefers-reduced-motion: reduce\) \{[\s\S]*?:host,\s*\.panel,\s*:host\(\[open\]\) \.panel \{\s*transition: none;/);
  const qs = read('screens/area-quick-sheet-css.ts');
  expect(read('screens/area-quick-sheet.ts')).toContain('?inert=${!this.open}');
  expect(qs).toMatch(/:host\(\[mode='popup'\]\[open\]\) \.panel \{\s*opacity: 1;\s*\}/);
  expect(qs).toMatch(/:host\(\[mode='sheet'\]\[open\]\) \.panel \{\s*opacity: 1;\s*transition: none !important;/);
  const cal = read('calendars/grid-overlays.ts');
  expect(cal).toMatch(/\.sheet, \.sheet\.in \{ transform: none; transition: none; \}/);
  expect(read('calendars/view-calendar.ts')).toMatch(/\.toast \{ transform: none; transition: none; \}/);
  expect(read('components/sw-room-card.ts')).toMatch(/:host \{\s*animation: none !important;/);
  // the picture of the camera source dialog keeps its fade (it holds no text)
  expect(read('components/camera-source-dialog.ts')).toMatch(/\.result img \{[\s\S]*?animation: in 200ms/);
});
