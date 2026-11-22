import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-CMP2-TABLES-REST-2470 (owner N10, 19.11; N21: shared tones and breakpoints): the remaining hand-built tables move to `sw-table`
// module by module, one screen at a time. The guard that no hand-built data table comes back in a moved screen (a screen whose other
// table still holds its own controls keeps exactly that many), and the shared role-matrix look (styles/settings.ts) the settings screens
// draw their "who may" tables with.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tables-rest-2470.spec.ts

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');
const tables = (s: string) => (s.match(/<table\b/g) ?? []).length;

/** moved screens: how many hand-built tables each still holds on purpose (controls in the cells, band rows) */
const MOVED: Record<string, number> = {
  'screens/system-announcements.ts': 0,
  'screens/system-schedules.ts': 0,
  'screens/system-presence.ts': 0,
  'screens/system-intercom-ops.ts': 0,
  'screens/system-wall.ts': 0,
  'screens/system-notifications.ts': 2, // the sources matrix (band rows, a switch / segmented / select per row) and the quiet-hours checks
  'screens/system-automations.ts': 0,
  'screens/system-calendars.ts': 1, // the per-calendar approval table (a select per cell)
  'screens/system-setup.ts': 0,
  'screens/system-notices.ts': 0,
  'components/wk-ops-charts.ts': 0,
  'components/wk-installer-confirm.ts': 0,
};

test.describe('CR-CMP2-TABLES-REST-2470: the moved tables', () => {
  test('a moved screen draws sw-table and keeps no other hand-built table', () => {
    for (const [f, left] of Object.entries(MOVED)) {
      const s = read(f);
      expect(s, f).toContain('<sw-table ');
      expect(tables(s), f).toBe(left);
    }
  });

  test('status chips in a moved table take the shared tones (data-tone), not a screen palette class', () => {
    for (const f of ['screens/system-announcements.ts', 'screens/system-presence.ts', 'screens/system-notifications.ts', 'screens/system-calendars.ts']) {
      const s = read(f);
      expect(s, f).toMatch(/<span class="chip" data-tone=/);
    }
    // the delivery log: sent ok, failed / gone bad, the rest neutral
    expect(read('screens/system-notifications.ts')).toContain("{ sent: 'ok', failed: 'bad', gone: 'bad', skipped: undefined, queued: undefined, retry: undefined }");
  });

  test('the role matrix is the shared sw-table.set-matrix: never wider than its card, the tick and the dash through parts', () => {
    const st = read('styles/settings.ts');
    expect(st).toMatch(/sw-table\.set-matrix \{\s*--sw-table-min: 0;\s*--sw-table-fs: var\(--sw-fs-base\);\s*(?:\/\*[\s\S]*?\*\/\s*)?--sw-table-cell-pad: 10px clamp\(var\(--sw-s-1\), 1vw, var\(--sw-s-2\)\);/);
    expect(st).toMatch(/sw-table\.set-matrix::part\(yes\) \{\s*color: var\(--sw-success-text\);/);
    expect(st).toMatch(/sw-table\.set-matrix::part\(no\) \{\s*color: var\(--sw-text-3\);/);
    expect(st).not.toMatch(/(?<![-\w])table\.set-matrix \{|\.set-matrix (th|td)\b/); // the hand-built table rules are gone
    for (const f of ['screens/system-automations.ts', 'screens/system-schedules.ts']) expect(read(f), f).toMatch(/<sw-table class="[^"]*set-matrix[^"]*" bare static-rows/);
  });

  test('the wall list switches table / cards at the shared phone edge and draws only one of them', () => {
    const s = read('screens/system-wall.ts');
    expect(s).toContain("window.matchMedia('(max-width: 767px)')");
    expect(s).toContain('if (!this.phone) return html`<sw-card flush class="table-card"><sw-table');
    expect(s).not.toMatch(/max-width: 720px/);
  });
});
