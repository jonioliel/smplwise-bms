import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME_PANELS, HOME_WARM_PANELS, LAZY_SCREENS, screenDefined, whenScreen } from '../src/shell/lazy-screens';

// CR-HOME-LAZY-2440 (review 06:BUNDLE-1 home side, 07:F4 d; docs/changes/CR-HOME-LAZY-2440.md): the home screen's on-demand parts are
// chunks of their own. Node only: the import graph is read from the sources (static `import` / `export ... from` edges, type-only ones
// are erased by the compiler and do not count).

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src');
const read = (rel: string): string => readFileSync(path.join(SRC, rel), 'utf8');
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

function resolveModule(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  for (const c of [`${base}.ts`, `${base}/index.ts`, base]) if (existsSync(path.join(SRC, c)) && c.endsWith('.ts')) return c;
  return null;
}

function staticImports(rel: string): string[] {
  const out: string[] = [];
  for (const m of code(rel).matchAll(/(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:([^'";]*?)\s+from\s+)?['"]([^'"]+)['"]/g)) {
    if (m[1]) continue;
    const names = m[2] ? /^\{([\s\S]*)\}$/.exec(m[2].trim()) : null;
    if (names && names[1].split(',').map((s) => s.trim()).filter(Boolean).every((s) => s.startsWith('type '))) continue;
    const to = resolveModule(rel, m[3]);
    if (to) out.push(to);
  }
  return out;
}

function eagerClosure(root: string): Set<string> {
  const seen = new Set<string>();
  const stack = [root];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const n of staticImports(f)) stack.push(n);
  }
  return seen;
}

const ON_DEMAND = [
  'screens/devices-tiles-panel.ts',
  'screens/area-quick-sheet.ts',
  'screens/home-edit-panel.ts',
  'screens/home-screen-options.ts',
  'screens/home-site-view.ts',
  'screens/home-site-off.ts',
  'screens/mapping-all.ts',
  'screens/system-mapping.ts',
  'screens/mapping-assistant.ts',
  'screens/mapping-decide.ts',
  'screens/mapping-rules.ts',
  'screens/mapping-health.ts',
];

test('none of the home screen\'s on-demand modules is reachable from main.ts by static imports', () => {
  const eager = eagerClosure('main.ts');
  expect(eager.has('screens/devices-building.ts')).toBe(true); // the landing page itself stays in the entry chunk
  expect(eager.has('screens/mapping-health-chip.ts')).toBe(true); // and the chip of its site bar
  expect(eager.has('screens/devices-bulk.ts')).toBe(true); // the floor / area menus are on the first paint
  for (const m of ON_DEMAND) expect(eager.has(m), m).toBe(false);
  // and the frontend gate's check keeps it so: each one is on its deny-list
  const check = readFileSync(path.join(HERE, '..', 'scripts', 'lazy-tags-check.mjs'), 'utf8');
  for (const m of ON_DEMAND) expect(check, m).toContain(`'${m}'`);
});

test('the home panels are in the shell\'s lazy table, and the check script still passes', () => {
  for (const tag of HOME_PANELS) expect(LAZY_SCREENS[tag], tag).toBeTruthy();
  for (const tag of HOME_WARM_PANELS) expect(HOME_PANELS, tag).toContain(tag);
  expect([...HOME_PANELS].sort()).toEqual(['area-quick-sheet', 'devices-tiles-panel', 'home-edit-panel', 'home-screen-options', 'home-site-off', 'home-site-view']);
  const out = execFileSync(process.execPath, [path.join(HERE, '..', 'scripts', 'lazy-tags-check.mjs')], { encoding: 'utf8' });
  expect(out).toContain('lazy-tags-check: OK');
});

test('the home screen renders its lazy tags through the loader and keeps a used panel in place', () => {
  const b = code('screens/devices-building.ts');
  expect(b).toContain('loadPendingScreens(this.renderRoot, () => this.requestUpdate(), true)');
  // each first-press element appears with its first use (or once the idle warm-up brought its chunk) and stays from then on
  expect(b).toMatch(/if \(this\.panel\) this\.panelUsed = true;\s*if \(!this\.panelUsed && !screenDefined\('devices-tiles-panel'\)\) return nothing;/);
  expect(b).toMatch(/if \(q\) this\.quickUsed = true;\s*if \(!this\.quickUsed && !screenDefined\('area-quick-sheet'\)\) return nothing;/);
  expect(b).toContain('warmHomePanels(() => this.requestUpdate())');
  // a press on "כבה הכל" before the dialog's chunk landed is kept, not lost
  expect(b).toMatch(/if \(!this\.siteOff\?\.show\) \{[\s\S]{0,400}whenScreen\('home-site-off'\)/);
  // the deep link's filter list no longer comes from the panel's module
  expect(b).not.toContain('ITEMS_FILTERS');
  const panel = /export const ITEMS_FILTERS: ItemsFilter\[\] = (\[[^\]]+\]);/.exec(read('screens/devices-tiles-panel.ts'));
  const own = /const PANEL_FILTERS: readonly ItemsFilter\[\] = (\[[^\]]+\]);/.exec(read('screens/devices-building.ts'));
  expect(own?.[1]).toBeTruthy();
  expect(own?.[1]).toBe(panel?.[1]); // one list, written twice: this keeps the two the same
});

test('the chip module carries no part of the settings page or the assistant', () => {
  const imps = staticImports('screens/mapping-health-chip.ts');
  expect(imps.sort()).toEqual(['api/catalog.ts', 'api/mapping-engine.ts', 'api/mapping.ts', 'api/session.ts', 'components/sw-icon.ts', 'router.ts']);
  expect(read('screens/mapping-health-chip.ts')).toContain("@customElement('mapping-health-chip')");
  expect(read('screens/mapping-health.ts')).not.toContain('@customElement(');
  // the settings family still defines the chip (mapping-all -> mapping-health -> the chip module)
  expect(staticImports('screens/mapping-health.ts')).toContain('screens/mapping-health-chip.ts');
  expect(staticImports('screens/mapping-all.ts').sort()).toEqual(['screens/mapping-health.ts', 'screens/system-mapping.ts']);
});

test('the settings page fetches the assistant with both slices when it is first opened, and renders it only then', () => {
  const m = code('screens/system-mapping.ts');
  const imps = staticImports('screens/system-mapping.ts');
  for (const x of ['screens/mapping-assistant.ts', 'screens/mapping-decide.ts', 'screens/mapping-rules.ts']) expect(imps, x).not.toContain(x);
  expect(m).toContain("Promise.all([import('./mapping-assistant'), import('./mapping-decide'), import('./mapping-rules')])");
  expect(m).toContain('const assistant = this.assistant && this.assistantReady');
  expect(m).toMatch(/assistantChunk = null;\s*throw err;/); // a failed fetch may be tried again
  expect((m.match(/<mapping-assistant/g) ?? []).length).toBe(1);
});

test('whenScreen settles at once for a tag that is not lazy; nothing is defined without a browser', async () => {
  await whenScreen('not-a-screen');
  expect(screenDefined('devices-tiles-panel')).toBe(false);
});
