import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';

// VISDIFF-246 (2026-10-12): the layout guard (tests/layout-guard.ts) over the screens the M074 visual matrix covers plus the settings pages
// the 2.4.6 release restyled, in demo mode (every /api/v1 call is aborted: the demo data answers), classic skin, light and dark, at the
// phone (390), the reference tablet (1024) and the desktop (1440) widths. The visual matrix compares pixels against a baseline and only
// warns; this spec states the rules a restyle must keep whatever the pixels: nothing escapes or is clipped inside its container, nothing
// scrolls the page sideways, nothing floats over a control, and every control is a 44 px target on a phone (the classic skins keep their
// dense desktop and tablet controls; tests/layout-media-admin-list.spec.ts states the same rule). It would have caught the 30 x 28 px
// cards / list switch of the alarm screen that the 2.4.5 zone redesign introduced.
// KNOWN lists what the guard does not hold against a screen yet, each with its reason; a new entry needs the same.
// Run (the dev or preview server of the branch, no backend):
//   SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/layout-visdiff-246.spec.ts --project=desktop --workers=1
//   VISDIFF_REPORT=1 prints every finding (one `FIND|class|element|detail|count|first context` line each) without failing.
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
// .edit-slot = the layout editor's overlay of the multimedia page (mounted only for the person who edits the layout, inert otherwise)
const SKIP = '.vh, .gbox, .bg, .veil, .skl, .wx-ic, .fc, .sr-only, .edit-slot';
const BUBBLE = '.hero, .zcard, .zrow, .kcard';

type Row = Finding & { w: number; screen: string };
/** Findings the guard does not hold against a screen yet (pre-existing, outside this review); a row names the element and the reason. */
const KNOWN: { screen?: string; el: RegExp; why: string }[] = [];
const isKnown = (r: Row) => KNOWN.some((k) => (!k.screen || k.screen === r.screen) && k.el.test(r.el));

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
    const results: Row[] = [];
    let runs = 0;
    for (const theme of THEMES) {
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: height(w) });
        for (const s of SCREENS) {
          await open(page, s.hash, theme);
          await settle(page);
          runs++;
          for (const part of ['', ' bottom']) {
            if (part) await scrollMain(page, 'bottom');
            const found = await page.evaluate(inPageCheck, { ctx: `${s.id} ${theme} ${w}${part}`, bubble: BUBBLE, skip: SKIP });
            results.push(...found.map((f) => ({ ...f, w, screen: s.id })));
          }
        }
      }
    }
    // the rules: the geometry classes at every width, 44 px targets at the phone width only
    const enforced = results.filter((r) => (r.cls !== 'target' || r.w <= 480) && !isKnown(r));
    const sum = summarize(enforced, 200);
    console.log(`layout-visdiff-246: ${runs} checks, findings ${results.length} (${JSON.stringify(summarize(results).byCls)}), enforced ${enforced.length} (${JSON.stringify(sum.byCls)}), page errors ${errors.length}`);
    // every distinct finding, one machine-readable line each
    const uniq = new Map<string, { f: Row; n: number }>();
    for (const f of results) {
      const k = `${f.cls}|${f.el}|${f.detail}`;
      const u = uniq.get(k);
      if (u) u.n++;
      else uniq.set(k, { f, n: 1 });
    }
    const order = { escape: 0, overflow: 1, clipped: 2, floating: 3, target: 4 } as const;
    for (const { f, n } of [...uniq.values()].sort((a, b) => order[a.f.cls] - order[b.f.cls] || b.n - a.n)) console.log(`FIND|${f.cls}|${f.el}|${f.detail}|${n}|${f.ctx}`);
    if (REPORT_ONLY) return;
    expect(errors, 'page errors').toEqual([]);
    expect(sum.lines, 'layout findings').toEqual([]);
  });
});
