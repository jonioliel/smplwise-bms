import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-DIAG-TABS-2440 (review 06:BUNDLE-2, the chunk seam of 06:STRUCT-1; docs/changes/CR-DIAG-TABS-2440.md): the settings screen fetches
// the cards of a tab when the tab is first opened. Node only: the import graph is read from the sources (static `import` /
// `export ... from` edges; type-only ones are erased by the compiler and do not count).

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src');
const read = (rel: string): string => readFileSync(path.join(SRC, rel), 'utf8');
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

function resolveModule(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  for (const c of [`${base}.ts`, `${base}/index.ts`, base]) if (c.endsWith('.ts') && existsSync(path.join(SRC, c))) return c;
  return null;
}

const importCache = new Map<string, string[]>();
function staticImports(rel: string): string[] {
  const hit = importCache.get(rel);
  if (hit) return hit;
  const out: string[] = [];
  for (const m of code(rel).matchAll(/(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:([^'";]*?)\s+from\s+)?['"]([^'"]+)['"]/g)) {
    if (m[1]) continue;
    const names = m[2] ? /^\{([\s\S]*)\}$/.exec(m[2].trim()) : null;
    if (names && names[1].split(',').map((s) => s.trim()).filter(Boolean).every((s) => s.startsWith('type '))) continue;
    const to = resolveModule(rel, m[3]);
    if (to) out.push(to);
  }
  importCache.set(rel, out);
  return out;
}

function closure(roots: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const n of staticImports(f)) stack.push(n);
  }
  return seen;
}

const bytes = (files: Iterable<string>): number => [...files].reduce((n, f) => n + statSync(path.join(SRC, f)).size, 0);

const SCREEN = 'screens/system-diagnostics.ts';
const TAB_FILES = readdirSync(path.join(SRC, 'screens'))
  .filter((f) => /^system-diagnostics-[a-z]+\.ts$/.test(f))
  .map((f) => `screens/${f}`)
  .sort();

/** tag -> the module that defines it (`@customElement('x')`), for every source file. */
function definers(): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const n of readdirSync(path.join(SRC, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${n.name}` : n.name;
      if (n.isDirectory()) walk(rel);
      else if (/\.ts$/.test(n.name) && !/\.d\.ts$/.test(n.name)) for (const m of read(rel).matchAll(/@customElement\(\s*['"]([a-z][a-z0-9]*-[a-z0-9-]+)['"]\s*\)/g)) out.set(m[1], rel);
    }
  };
  walk('');
  return out;
}

test('there is one imports-only module per tab that has cards of its own, and the loader map names each', () => {
  expect(TAB_FILES.map((f) => f.replace(/^screens\/system-diagnostics-|\.ts$/g, ''))).toEqual(['access', 'backup', 'buildings', 'devices', 'health', 'map', 'media', 'mobile', 'remote', 'tabs']);
  const screen = code(SCREEN);
  for (const f of TAB_FILES) {
    const name = f.replace(/^screens\/|\.ts$/g, '');
    expect(screen, name).toContain(`import('./${name}')`);
    expect(code(f).replace(/import\s+'[^']+';/g, '').trim(), `${f} holds imports only`).toBe('');
    expect(staticImports(SCREEN), name).not.toContain(f);
  }
  // both access tabs (layout b splits them) share one set of cards
  expect(screen).toMatch(/\[ACCESS_TAB\]: accessCards,\s*\[VOICE_TAB\]: accessCards,/);
});

test('every tab id of the screen is either in the loader map or needs no chunk', async () => {
  const screen = code(SCREEN);
  const ids = [...screen.slice(screen.indexOf('const TABS = ['), screen.indexOf('];', screen.indexOf('const TABS = ['))).matchAll(/id: '([a-z-]+)'/g)].map((m) => m[1]);
  expect(ids.length).toBe(13);
  const map = screen.slice(screen.indexOf('export const TAB_CHUNKS'), screen.indexOf('};', screen.indexOf('export const TAB_CHUNKS')));
  const keyed = (id: string): boolean => new RegExp(`(^|\\s)${id === 'access-control' ? '\\[ACCESS_TAB\\]' : `'?${id}'?`}:`).test(map);
  expect(ids.filter((id) => !keyed(id))).toEqual(['general', 'ha', 'support']);
});

test('no custom element drawn by the screen is left without a definition: static import, or its tab\'s chunk', () => {
  const def = definers();
  const screen = code(SCREEN);
  const own = closure([SCREEN]);
  const lazy = closure(TAB_FILES);
  const missing: string[] = [];
  for (const m of screen.matchAll(/<([a-z][a-z0-9]*-[a-z0-9-]+)[\s>/]/g)) {
    const mod = def.get(m[1]);
    if (!mod) continue; // not an element of this code base
    if (!own.has(mod) && !lazy.has(mod)) missing.push(m[1]);
  }
  expect([...new Set(missing)]).toEqual([]);
  // the first page's cards stay static: it is the tab the screen opens on
  for (const tag of ['system-design', 'system-brand-logos', 'system-brand-installer', 'system-brand-colors', 'system-look', 'system-nav-size', 'system-mobile-options', 'system-xs-options']) {
    expect(own.has(def.get(tag)!), tag).toBe(true);
  }
});

test('a tab is drawn only after its chunk landed; a failed fetch offers a retry', () => {
  const screen = code(SCREEN);
  const body = screen.slice(screen.indexOf('private renderTab()'), screen.indexOf('render() {', screen.indexOf('private renderTab()')));
  expect(body).toContain("const chunk = TAB_CHUNKS[this.tab] ? this.tabChunks.get(this.tab) : 'ready';");
  expect(body.indexOf("chunk !== 'ready'")).toBeLessThan(body.indexOf('this.renderMedia()'));
  expect(body).toContain('data-tab-chunk-failed');
  expect(body).toContain('this.retryTabChunk(this.tab)');
  expect(screen).toMatch(/protected willUpdate\(\): void \{\s*this\.syncAccessTab\(\);\s*this\.ensureTabChunk\(this\.tab\);/);
  // the tab body is rendered in one place
  expect((screen.match(/this\.renderTab\(\)/g) ?? []).length).toBe(1);
  expect((screen.match(/<system-mapping>/g) ?? []).length).toBe(1);
});

// The chunk budget (06:BUNDLE-2 "add a size budget for this chunk"), on the sources: what the settings screen's own chunk can carry is
// its static closure less what the entry chunk carries anyway. Measured on this branch (2026-11-16): 28 modules, 461,443 source bytes -
// against 108 modules, 1,381,989 bytes when every tab's cards came with the screen. The budget is the measured size plus about ten
// percent; a card imported statically by the screen again (instead of by its tab's module) goes over it. Source bytes, not built
// bytes: no build is needed to check it (the built chunk is roughly a third of its sources).
// RELEASE-2438-TRAIN (18.11): the 2.43.8 train measured 33 modules, 514,314 B (the train before its second part 509,503 B; main
// 2.43.7 had no budget yet). The growth is the train's own content, no card came back statically: the translation of the 3D-map
// settings card (CR-UI-POLISH-2443: its table i18n/msg/api-plan-view.ts +3.4 kB, api/plan-view.ts read through tr() +2.7 kB) and the
// translated / restyled shared settings styles and map texts (styles/settings.ts, i18n/msg/map.ts), partly offset by modules that
// moved to the entry chunk. New budget: the measured size plus about five percent (docs/changes/RELEASE-2438-TRAIN.md section 11).
const OWN_BUDGET = 540_000;

test('source-size budget of the settings screen\'s own chunk', () => {
  const eager = closure(['main.ts']);
  const less = (s: Set<string>): string[] => [...s].filter((f) => !eager.has(f));
  const own = less(closure([SCREEN]));
  const all = less(closure([SCREEN, ...TAB_FILES]));
  const ownBytes = bytes(own);
  const allBytes = bytes(all);
  test.info().annotations.push({ type: 'settings chunk sources', description: `own ${own.length} modules ${ownBytes} B; with every tab ${all.length} modules ${allBytes} B` });
  expect(ownBytes).toBeLessThan(allBytes / 2); // the tabs carry most of what the one chunk used to
  expect(ownBytes).toBeLessThanOrEqual(OWN_BUDGET);
});

test('the lazy tags check still passes', () => {
  const out = execFileSync(process.execPath, [path.join(HERE, '..', 'scripts', 'lazy-tags-check.mjs')], { encoding: 'utf8' });
  expect(out).toContain('lazy-tags-check: OK');
});
