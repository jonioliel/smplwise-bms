import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// PERF-2490: the heaviest on-demand parts the entry chunk still carried load as chunks of their own (docs/changes/PERF-2490.md).
// Node only: the import graph is read from the source (scripts/lazy-tags-check.mjs NOT_IN_ENTRY checks the whole eager closure).

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const code = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
/** The runtime static import specifiers of a module (type-only imports carry no code). */
const staticImports = (rel: string): string[] =>
  [...code(rel).matchAll(/^import\s+(type\s+)?(?:[^'";]*?\s+from\s+)?'([^']+)';/gm)].filter((m) => !m[1]).map((m) => m[2]);
const dynamicImports = (rel: string): string[] => [...code(rel).matchAll(/import\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);

test('the shell no longer imports the device popup, the closing prompt, the cast screen, the push settings or the schedule dialogs', () => {
  const app = staticImports('shell/sw-app.ts');
  for (const m of ['../components/device-activity', '../maintenance/close-prompt', '../screens/system-cast', '../pwa/notifications-settings',
    '../screens/schedule-lowering-dialog', '../screens/schedule-create-dialog', '../screens/schedules-week-view']) expect(app).not.toContain(m);
  expect(app).toContain('./lazy-overlays');
  expect(dynamicImports('shell/lazy-overlays.ts')).toEqual(['../components/device-activity', '../maintenance/close-prompt']);
});

test('the schedules screens import the dialogs they render by tag', () => {
  expect(staticImports('screens/devices-schedules.ts')).toEqual(expect.arrayContaining(['./schedule-lowering-dialog', './schedule-create-dialog', './schedules-week-view']));
  expect(staticImports('screens/schedule-drawer.ts')).toContain('./schedule-lowering-dialog');
});

test('the home widgets, the user menu and the launcher fetch their on-demand parts with import()', () => {
  expect(staticImports('screens/home-widgets.ts')).not.toContain('../components/media-remote');
  expect(dynamicImports('screens/home-widgets.ts')).toContain('../components/media-remote');
  expect(code('screens/home-widgets.ts')).toMatch(/this\.remoteReady && this\.wantsRemote \? html`<media-remote/);
  const menu = staticImports('shell/sw-user-menu.ts');
  expect(menu).not.toContain('../components/sw-passkeys');
  expect(menu).not.toContain('./sw-home-personal');
  // RELEASE-2510-TRAIN: MFA-SCREENS-2510's security section (<sw-account-security>, which carries sw-passkeys) is the lazy chunk now
  expect(menu).not.toContain('../components/sw-account-security');
  expect(dynamicImports('shell/sw-user-menu.ts')).toEqual(expect.arrayContaining(['../components/sw-account-security', './sw-home-personal']));
  expect(code('shell/sw-user-menu.ts')).toMatch(/this\.homeReady \? html`<sw-home-personal>/);
  expect(staticImports('api/launcher.ts')).not.toContain('./automations');
  expect(dynamicImports('api/launcher.ts')).toContain('./automations');
});

test('the cast route is a lazy screen', async () => {
  expect(Object.keys((await import('../src/shell/lazy-screens')).LAZY_SCREENS)).toContain('cast-my-screens');
});

test('lazy-overlays: an event before the chunk is held and sent again, in order, once the element is defined', async () => {
  test.setTimeout(180_000); // the first import of the module graph is transpiled on the fly (slow on a busy workstation)
  const w = globalThis as unknown as { window?: EventTarget; customElements?: unknown };
  const hadWindow = 'window' in w;
  const defined = new Set<string>();
  w.window = new EventTarget();
  w.customElements = { get: (t: string) => (defined.has(t) ? class {} : undefined) };
  try {
    const mod = await import('../src/shell/lazy-overlays');
    const o = mod.LAZY_OVERLAYS.find((x) => x.tag === 'maint-close-prompt')!;
    // the test's stand-in for the chunk: defines the tag and starts listening, as the element's connectedCallback does
    const seen: string[] = [];
    let loads = 0;
    (o as { load: () => Promise<unknown> }).load = async () => {
      loads += 1;
      defined.add(o.tag);
      w.window!.addEventListener(o.event, (e) => seen.push((e as CustomEvent<{ id: string }>).detail.id));
    };
    w.window!.dispatchEvent(new CustomEvent(o.event, { detail: { id: 'a' } }));
    w.window!.dispatchEvent(new CustomEvent(o.event, { detail: { id: 'b' } }));
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual(['a', 'b']);
    expect(loads).toBe(1);
    w.window!.dispatchEvent(new CustomEvent(o.event, { detail: { id: 'c' } })); // defined now: the element alone hears it, once
    expect(seen).toEqual(['a', 'b', 'c']);
  } finally {
    if (!hadWindow) delete w.window;
    delete w.customElements;
  }
});
