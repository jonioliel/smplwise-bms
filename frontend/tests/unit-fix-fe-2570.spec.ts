import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseAutomationsRoute } from '../src/screens/automations-logic';
import { dispositionName } from '../src/api/download';

// FIX-FE-2570 (deep review 2.56, FE-05). Node only, no page:
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

// FE-02 is covered by the page behaviour test tests/fix-fe-2570.spec.ts (a refused save leaves each switch on the server's state) and by
// the structural guard in tests/unit-controlled-toggles-2540.spec.ts (FE2-17).

// The download file name (lead, 28.11): api/download.ts already falls back to the name as sent when it is not a valid escape
// (CR-API-BLOB-2436, try / catch); this pins it.
test.describe('the file name of a download', () => {
  test('a malformed name from the server does not throw: the name is kept as sent', () => {
    expect(() => dispositionName("attachment; filename*=UTF-8''report%E0%A4%A.pdf", 'file.pdf')).not.toThrow();
    expect(dispositionName("attachment; filename*=UTF-8''report%E0%A4%A.pdf", 'file.pdf')).toBe('report%E0%A4%A.pdf');
    expect(dispositionName('attachment; filename="50%.csv"', 'file.csv')).toBe('50%.csv');
  });

  test('a valid encoded name is decoded; no header or no name gives the fallback', () => {
    expect(dispositionName("attachment; filename*=UTF-8''%D7%93%D7%95%D7%97.pdf", 'file.pdf')).toBe('דוח.pdf');
    expect(dispositionName('attachment; filename="costs.csv"', 'file.csv')).toBe('costs.csv');
    expect(dispositionName(null, 'file.pdf')).toBe('file.pdf');
    expect(dispositionName('attachment', 'file.pdf')).toBe('file.pdf');
  });
});
