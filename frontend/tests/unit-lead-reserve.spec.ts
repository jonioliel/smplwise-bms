import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guard (2026-10-17): header dropdown placement 4 hangs the tab group's chip at the START edge of the page's first row and the shell
// publishes the room it needs as --sw-lead-reserve. A screen that draws its OWN top-level header (an <h1>, or the shared `.dh` header
// family) must keep that room free: include styles/lead-reserve.ts (media-page.ts already does), or read the variable itself, or use
// <sw-page> (which reads it). Node only: it reads the sources. A new screen with a header and none of that fails here.

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
const DIRS = ['screens', 'tickets'];

/** Screens that legitimately have NO header under the shell's page chrome. Each needs a reason; a stale entry fails too. */
const ALLOW: Record<string, string> = {
  'screens/kiosk-wall.ts': 'full-screen kiosk wall: it replaces the application, no shell chrome and no tab-group dropdown',
  'screens/bubble-demo.ts': 'style-guide fixture page (#/styleguide/bubble), not a product screen',
  'screens/devices-area-nav.ts': "drawn only inside sw-page's header (the crumbs slot of devices-area), which keeps the reserve: its own doubled it (2.7.2)",
};

const HEADER = /<h1\b|<header class="dh\b|<header class=\$\{[^}]*\bdh\b|\bdh: true\b|`dh\$\{/;
const HONOURS = /leadReserveStyles|mediaPageStyles|--sw-lead-reserve|<sw-page\b/;

function files(): string[] {
  const out: string[] = [];
  for (const d of DIRS) for (const f of readdirSync(join(SRC, d))) if (f.endsWith('.ts')) out.push(`${d}/${f}`);
  return out;
}

test.describe('header dropdown placement 4: every screen header keeps the lead reserve free', () => {
  test('the shared snippet reads the variable and the media-page family includes it', () => {
    const snip = readFileSync(join(SRC, 'styles/lead-reserve.ts'), 'utf8');
    expect(snip).toContain('padding-inline-start: var(--sw-lead-reserve, 0px)');
    expect(snip).toContain('.lead-head');
    expect(snip).toContain('.dh .dh-row');
    // inside the mediaPageStyles css`` block itself (2.7.2: it had slipped into measureHeaderBar's template string, so no media-page
    // header kept the reserve and --mm-bar-h became an invalid value)
    const media = readFileSync(join(SRC, 'styles/media-page.ts'), 'utf8');
    const start = media.indexOf('export const mediaPageStyles = css`');
    const end = media.indexOf('\n  `;', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(media.slice(start, end)).toContain('${leadReserveStyles}');
    expect(media.slice(end)).not.toContain('${leadReserveStyles}');
    expect(readFileSync(join(SRC, 'components/sw-page.ts'), 'utf8')).toContain('var(--sw-lead-reserve, 0px)');
  });

  test('every screen with its own top-level header honours the reserve (or is on the allow-list)', () => {
    const bad: string[] = [];
    for (const f of files()) {
      const src = readFileSync(join(SRC, f), 'utf8');
      if (!HEADER.test(src) || f in ALLOW) continue;
      if (!HONOURS.test(src)) bad.push(f);
    }
    expect(bad, `screens with a header and no --sw-lead-reserve handling (import leadReserveStyles from styles/lead-reserve.ts and put class "lead-head" on the first row, or use .dh/.dh-row via mediaPageStyles): ${bad.join(', ')}`).toEqual([]);
  });

  test('a screen that includes the snippet really marks a first row (lead-head, or the .dh .dh-row family)', () => {
    const bad: string[] = [];
    for (const f of files()) {
      const src = readFileSync(join(SRC, f), 'utf8');
      if (!/leadReserveStyles/.test(src) || f in ALLOW) continue;
      if (!/lead-head|dh-row/.test(src.replace(/leadReserveStyles/g, ''))) bad.push(f);
    }
    expect(bad).toEqual([]);
  });

  test('the allow-list has no stale entries', () => {
    for (const f of Object.keys(ALLOW)) {
      expect(existsSync(join(SRC, f)), f).toBe(true);
      expect(HEADER.test(readFileSync(join(SRC, f), 'utf8')), `${f} no longer has a header: remove it from the allow-list`).toBe(true);
    }
  });
});
