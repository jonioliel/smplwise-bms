import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';

// VISDIFF-246 (2026-10-12): the layout guard (tests/layout-guard.ts) over the screens the M074 visual matrix covers plus the settings pages
// the 2.4.6 release restyled, in demo mode (every /api/v1 call is aborted: the demo data answers), classic skin, light and dark, at the
// phone (390), the reference tablet (1024) and the desktop (1440) widths. The visual matrix compares pixels against a baseline and only
// warns; this spec states the rules a restyle must keep whatever the pixels: nothing escapes or is clipped inside its container, nothing
// scrolls the page sideways, and every control is a 44 px target on a touch layout. It would have caught the 30 x 28 px cards / list switch
// of the alarm screen that the 2.4.5 zone redesign introduced.
// The shell's own corner (.float, the search / status button) and the pre-existing widgets named in KNOWN keep their own contracts and are
// listed with the reason; a new entry there needs the same: what it is and why the guard may not measure it.
// Run (the dev or preview server of the branch, no backend):
//   SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/layout-visdiff-246.spec.ts --project=desktop --workers=1
//   VISDIFF_REPORT=1 prints every finding without failing (discovery mode).
const REPORT_ONLY = !!process.env.VISDIFF_REPORT;
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [390, 1440] : [390, 1024, 1440];
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 1100 ? 768 : 900);

interface Screen { id: string; hash: string }
const SCREENS: Screen[] = [
  { id: 'devices-home', hash: '/devices' },
  { id: 'devices-schedules', hash: '/devices/schedules' },
  { id: 'live-wall', hash: '/live/wall' },
  { id: 'security-alarm', hash: '/security/alarm' },
  { id: 'multimedia-screens', hash: '/multimedia/screens' },
  { id: 'settings-general', hash: '/system/diagnostics' },
  { id: 'settings-general-tabs', hash: '/system/diagnostics?tab=tabs' },
  { id: 'settings-general-devices', hash: '/system/diagnostics?tab=devices' },
  { id: 'settings-general-health', hash: '/system/diagnostics?tab=health' },
  { id: 'settings-general-backup', hash: '/system/diagnostics?tab=backup' },
  { id: 'settings-notifications', hash: '/system/notifications' },
  { id: 'settings-schedules', hash: '/system/schedules' },
  { id: 'settings-automations', hash: '/system/automations' },
  { id: 'settings-security', hash: '/system/security' },
  { id: 'settings-multimedia', hash: '/system/multimedia' },
  { id: 'settings-access', hash: '/system/access' },
  { id: 'settings-storage', hash: '/system/storage' },
  { id: 'settings-wall', hash: '/system/wall' },
];

// decorative layers and the shell's own items the guard must not measure
const SKIP = '.vh, .gbox, .bg, .veil, .skl, .wx-ic, .fc, .sr-only';
const BUBBLE = '.hero, .zcard, .zrow, .kcard';

async function open(page: Page, hash: string, theme: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=${theme}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
  await page.evaluate(() => document.fonts.ready);
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** Scrolls the shell's main column (the screens are long): the guard measures what is visible, so it sees the second half too. */
async function scrollMain(page: Page, to: 'top' | 'bottom') {
  await page.evaluate((t) => {
    const m = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    if (m) m.scrollTop = t === 'top' ? 0 : m.scrollHeight;
  }, to);
  await page.waitForTimeout(150);
}

test.describe('layout guard: the screens of the visual matrix and the restyled settings pages', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.describe.configure({ timeout: 30 * 60_000 });
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        localStorage.setItem('sw.devices.layout', 'cards');
      } catch {
        /* storage unavailable */
      }
    });
    await page.route('**/api/v1/**', (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('every class, light and dark, phone / tablet / desktop', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the sweep');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const theme of THEMES) {
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: height(w) });
        for (const s of SCREENS) {
          await open(page, s.hash, theme);
          await settle(page);
          runs++;
          results.push(...(await page.evaluate(inPageCheck, { ctx: `${s.id} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP })));
          await scrollMain(page, 'bottom');
          results.push(...(await page.evaluate(inPageCheck, { ctx: `${s.id} ${theme} ${w} bottom`, bubble: BUBBLE, skip: SKIP })));
        }
      }
    }
    const { byCls, lines } = summarize(results, 200);
    console.log(`layout-visdiff-246: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
    for (const l of lines) console.log('  ' + l);
    if (REPORT_ONLY) return;
    expect(errors, 'page errors').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
  });
});
