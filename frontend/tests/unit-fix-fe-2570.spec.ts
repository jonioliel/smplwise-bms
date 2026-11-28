import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseAutomationsRoute } from '../src/screens/automations-logic';

// FIX-FE-2570 (deep review 2.56, FE-05 and FE-02). Node only, no page:
//   npx playwright test -c playwright.unit.config.ts tests/unit-fix-fe-2570.spec.ts
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// FE-05: LOWS-FRONTEND-2550 gave the shell `router.ts decodeSegment`; five screens still decoded route segments with the throwing
// `decodeURIComponent` - a pasted or cut link such as `#/devices/automations/scenarios/50%` threw `URIError` in the route handler / render.
const FE05_SCREENS = ['screens/automations-logic.ts', 'screens/devices-automations.ts', 'screens/devices-schedules.ts', 'screens/infra-generator.ts', 'home/home-recordings.ts'];

test.describe('FE-05 route segments outside the shell', () => {
  test('the automations route keeps a broken escape as written and still decodes a valid one', () => {
    const parse = (path: string) => parseAutomationsRoute(path.split('/').filter(Boolean), new URLSearchParams(''));
    expect(() => parse('/devices/automations/scenes/50%')).not.toThrow();
    expect(parse('/devices/automations/scenes/50%').id).toBe('50%');
    expect(parse('/devices/automations/scripts/%E0%A4%A').id).toBe('%E0%A4%A');
    expect(parse('/devices/automations/scenes/%D7%A2%D7%A8%D7%91').id).toBe('ערב');
  });

  for (const file of FE05_SCREENS) {
    test(`${file} decodes route segments with decodeSegment, never the throwing decoder`, () => {
      const s = src(file);
      expect(s).not.toMatch(/decodeURIComponent\(/);
      expect(s).toMatch(/decodeSegment\(|map\(decodeSegment\)/);
    });
  }
});

// FE-02: every switch of the home administration page saves at once, so every one is controlled (the page test is
// tests/fix-fe-2570.spec.ts: a refused save leaves the switch on the server's state).
test('FE-02: every sw-toggle on the home administration page is controlled', () => {
  const toggles = src('home/sw-home-admin.ts').match(/<sw-toggle\b[^>]*>/g) ?? [];
  expect(toggles.length).toBeGreaterThanOrEqual(7);
  for (const t of toggles) expect(t, t.slice(0, 80)).toMatch(/<sw-toggle controlled\b/);
});
