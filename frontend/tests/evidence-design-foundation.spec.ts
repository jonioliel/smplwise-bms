import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settlePage } from './pixel-settle';

// Design foundation (owner 2026-10-01): one shared structure, skins = tokens + a bounded rule set, light / dark for the whole shell.
//   1. `classic` (the default, today's look) is pixel-stable: toHaveScreenshot against the baselines captured from the build
//      BEFORE the foundation (tests/evidence-design-foundation.spec.ts-snapshots/), 0 differing pixels allowed.
//   2. the evidence matrix: skin (classic | domus | tesla) x scheme (light | dark) on four key screens (home with the building tree
//      screen with its tree panel, a settings screen, a dialog) at 1440 and 390 -> docs/design/evidence/design-foundation/.
// Demo mode (no backend). `?skin=` / `?scheme=` are the session override the app reads (design/skin.ts); nothing is stored.
//   SW_BASE_URL=http://127.0.0.1:4802/ npx playwright test tests/evidence-design-foundation.spec.ts --workers=1 --project=desktop --project=mobile
//   SW_SHOTS_OFF=1 skips the evidence matrix (only the classic baseline check runs).
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/design-foundation');

const SKINS = ['classic', 'domus', 'tesla'] as const;
const SCHEMES = ['light', 'dark'] as const;

const SCREENS = [
  { id: 'home', hash: '/devices' },
  { id: 'map', hash: '/explore/floors/f0' },
  { id: 'settings', hash: '/system/diagnostics?tab=devices' },
] as const;
/** Matrix-only (the card is new, so there is no baseline from before the foundation): הגדרות › כללי with the skin picker. */
const DESIGN_CARD = { id: 'design', hash: '/system/diagnostics' } as const;

async function open(page: Page, hash: string, query = '') {
  await page.clock.setFixedTime(new Date('2026-10-01T13:00:00Z')); // the home clock and the weather strip must not move between runs
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  // performance:full is pinned: the pixel baselines are the classic skin at full, and the auto probe (a blurred layer for ~700 ms at idle) must not run
  // inside the screenshot window (it turns the whole page's LCD text antialiasing to greyscale while it is mounted)
  await page.goto(`/?design=a&look=performance:full${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await settlePage(page); // not a fixed sleep: on a busy runner the map's late fixture answers / buttons missed the old 900 ms window
}

/** A representative dialog: heading, a field, the footer buttons (what every confirmation looks like). */
async function openDialog(page: Page) {
  await page.evaluate(() => {
    const d = document.createElement('sw-dialog') as HTMLElement & { open: boolean; heading: string };
    d.heading = 'לכבות 3 מסכים בקומת קרקע?';
    d.setAttribute('data-evidence-dialog', '');
    d.innerHTML =
      '<p style="margin:0 0 10px">הפעולה תכבה את המסכים שדולקים כרגע. מסכים שכבר כבויים לא נספרים.</p>' +
      '<sw-field label="הערה"><input value="בדיקת עיצוב" /></sw-field>' +
      '<sw-button slot="footer" variant="ghost">ביטול</sw-button><sw-button slot="footer" variant="primary">כבה</sw-button>';
    document.body.appendChild(d);
    d.open = true;
  });
  await settlePage(page);
}

const view = (info: { project: { name: string } }) => (info.project.name === 'mobile' ? '390' : '1440');

/** The committed baselines carry Playwright's platform suffix (-win32). On another OS (the Linux runner) there is no baseline
 *  until one is generated there with `--update-snapshots`; until then the pixel check is skipped instead of failing on a
 *  missing file. Rendering (fonts, text shaping) differs per OS, so baselines are never shared between platforms. */
const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  info.config.updateSnapshots !== 'all' && !fs.existsSync(info.snapshotPath(name));

test.describe('design foundation', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');

  for (const s of SCREENS) {
    test(`classic is pixel-stable: ${s.id}`, async ({ page }, info) => {
      test.skip(info.project.name === 'tablet', 'two widths are enough for the regression check');
      test.skip(noBaseline(info, `classic-${s.id}-${view(info)}.png`), `no ${process.platform} baseline yet (run with --update-snapshots on this platform)`);
      await open(page, s.hash);
      await expect(page).toHaveScreenshot(`classic-${s.id}-${view(info)}.png`, { maxDiffPixels: 0, animations: 'disabled', fullPage: false });
    });
  }

  test('an explicit performance tier never runs the auto probe', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the logic runs once');
    await page.addInitScript(() => {
      (window as unknown as { __probeSeen: number }).__probeSeen = 0;
      new MutationObserver((ms) => {
        for (const m of ms) m.addedNodes.forEach((n) => (n as HTMLElement).hasAttribute?.('data-perf-probe') && ((window as unknown as { __probeSeen: number }).__probeSeen += 1));
      }).observe(document, { childList: true, subtree: true });
    });
    await open(page, '/devices');
    await page.waitForTimeout(3500); // past the idle callback + the 700 ms probe window
    expect(await page.evaluate(() => (window as unknown as { __probeSeen: number }).__probeSeen)).toBe(0);
    await expect(page.locator('html')).toHaveAttribute('data-bubble-performance', 'full');
  });

  test('classic is pixel-stable: dialog', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'two widths are enough for the regression check');
    test.skip(noBaseline(info, `classic-dialog-${view(info)}.png`), `no ${process.platform} baseline yet (run with --update-snapshots on this platform)`);
    await open(page, '/devices');
    await openDialog(page);
    await expect(page).toHaveScreenshot(`classic-dialog-${view(info)}.png`, { maxDiffPixels: 0, animations: 'disabled' });
  });

  test.describe('the picker and the switch (demo mode: the installation is this browser)', () => {
    const card = (page: Page) => page.locator('sw-app system-design');
    const attr = (page: Page, a: string) => page.evaluate((n) => document.documentElement.getAttribute(n), a);

    test('default is classic / light; an unknown ?skin= is ignored; ?skin= and ?scheme= override the page view only', async ({ page }) => {
      await open(page, '/devices');
      expect(await attr(page, 'data-skin')).toBe('classic');
      expect(await attr(page, 'data-theme')).toBe('light');
      await open(page, '/devices', '&skin=glass&scheme=night');
      expect(await attr(page, 'data-skin')).toBe('classic');
      expect(await attr(page, 'data-theme')).toBe('light');
      await open(page, '/devices', '&skin=tesla&scheme=dark');
      expect(await attr(page, 'data-skin')).toBe('tesla');
      expect(await attr(page, 'data-theme')).toBe('dark');
      expect(await page.evaluate(() => localStorage.getItem('sw.ui.design'))).toBeNull(); // nothing stored by the override
    });

    test('the picker: three skins with a swatch each; save applies skin and scheme at once and survives a reload; my own scheme wins and clears', async ({ page }, info) => {
      test.skip(info.project.name === 'mobile', 'the picker is the same component on a phone; one width is enough here');
      await open(page, '/system/diagnostics');
      await expect(card(page).locator('[data-skin-option]')).toHaveCount(4); // classic, domus, tesla, bubble (Bubble foundation)
      await expect(card(page).locator('[data-skin-option="classic"] [data-skin-current]')).toBeVisible();
      await expect(card(page).locator('[data-skin-option] .sw')).toHaveCount(4);
      await expect(card(page).locator('[data-design-save]')).toHaveAttribute('disabled', ''); // nothing changed yet
      await card(page).locator('[data-skin-option="domus"]').click();
      await card(page).locator('[data-scheme-option="dark"]').click();
      expect(await attr(page, 'data-skin')).toBe('classic'); // a choice is a draft until it is saved
      await card(page).locator('[data-design-save]').click();
      await expect(card(page).locator('[data-design-message]')).toBeVisible();
      expect(await attr(page, 'data-skin')).toBe('domus');
      expect(await attr(page, 'data-theme')).toBe('dark');
      // the rules of the skin reached a shadow root: the rail is a floating glass panel
      const radius = await page.locator('sw-app').evaluate((app) => getComputedStyle(app.shadowRoot!.querySelector('nav.rail')!).borderTopLeftRadius);
      expect(parseFloat(radius)).toBeGreaterThan(20);
      await page.reload();
      await page.waitForSelector('sw-app');
      expect(await attr(page, 'data-skin')).toBe('domus');
      expect(await attr(page, 'data-theme')).toBe('dark');
      // my own scheme: light here, whatever the installation says; "כמו המערכת" clears it
      await open(page, '/system/diagnostics');
      await card(page).locator('[data-own-scheme="light"]').click();
      expect(await attr(page, 'data-theme')).toBe('light');
      expect(await attr(page, 'data-skin')).toBe('domus');
      await card(page).locator('[data-own-scheme="system"]').click();
      expect(await attr(page, 'data-theme')).toBe('dark');
    });

    test('auto follows the operating system, live', async ({ page }, info) => {
      test.skip(info.project.name === 'mobile', 'one width is enough');
      await page.emulateMedia({ colorScheme: 'dark' });
      await open(page, '/devices', '&scheme=auto');
      expect(await attr(page, 'data-theme')).toBe('dark');
      await page.emulateMedia({ colorScheme: 'light' });
      await expect.poll(() => attr(page, 'data-theme')).toBe('light');
    });
  });

  test.describe('evidence matrix', () => {
    test.skip(!!process.env.SW_SHOTS_OFF, 'SW_SHOTS_OFF=1');
    for (const skin of SKINS) {
      for (const scheme of SCHEMES) {
        test(`${skin} ${scheme}`, async ({ page }, info) => {
          test.skip(info.project.name === 'tablet', 'two widths are enough');
          fs.mkdirSync(EVIDENCE, { recursive: true });
          const q = `&skin=${skin}&scheme=${scheme}`;
          for (const s of [...SCREENS, DESIGN_CARD]) {
            await open(page, s.hash, q);
            if (skin !== 'classic' || scheme === 'dark') {
              await expect(page.locator('html')).toHaveAttribute('data-skin', skin);
              await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
            }
            await page.screenshot({ path: path.join(EVIDENCE, `${skin}-${scheme}-${s.id}-${view(info)}.png`) });
            if (s.id === 'home' && view(info) === '390') {
              // the phone's equivalent of the building tree panel: the floor cards carry every area row, count and the floor menu
              await page.locator('devices-building').evaluate((el) => el.shadowRoot!.querySelector('section.fcard')!.scrollIntoView({ block: 'start' }));
              await page.waitForTimeout(300);
              await page.screenshot({ path: path.join(EVIDENCE, `${skin}-${scheme}-floors-390.png`) });
            }
          }
          await open(page, '/devices', q);
          await openDialog(page);
          await page.screenshot({ path: path.join(EVIDENCE, `${skin}-${scheme}-dialog-${view(info)}.png`) });
        });
      }
    }
  });
});
