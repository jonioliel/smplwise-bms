import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { SKINS_UNDER_TEST } from './helpers/frozen-skins';

// VISDIFF-246 (2026-10-12): the layout guard (tests/layout-guard.ts) over the screens the M074 visual matrix covers plus the settings pages
// the 2.4.6 release restyled, in demo mode (every /api/v1 call is aborted: the demo data answers), classic skin, light and dark, at the
// phone (390), the reference tablet (1024) and the desktop (1440) widths. The visual matrix compares pixels against a baseline and only
// warns; this spec states the rules a restyle must keep whatever the pixels: nothing escapes or is clipped inside its container, nothing
// scrolls the page sideways, and nothing floats over a control. The 44 px rule is held for the controls of the redesigned screens named
// in TARGETS (the classic skins keep their dense admin controls elsewhere; tests/layout-media-admin-list.spec.ts states the same split).
// It would have caught the 30 x 28 px cards / list switch and the 32 px filter chips that the 2.4.5 zone redesign put on the alarm screen,
// and the clipped last segment of the schedules defaults.
// KNOWN lists what the guard does not hold against a screen, each with its reason; a new entry needs the same.
// Run (the dev or preview server of the branch, no backend; one test per screen, `-g <screen id>` runs one):
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
/** What the guard does not hold against a screen, with the reason. */
const KNOWN: { el: RegExp; why: string }[] = [
  { el: /^div\.savebar\b/, why: 'the sticky save bar rests on the content that scrolls under it: covering the rows below it is its job (it has bottom padding, so nothing stays hidden at the end of the page)' },
  { el: /^nav\.sections\.secrow\b/, why: 'the phone\'s sticky section row sits over the content that scrolls under it, by design' },
];
const isKnown = (r: Row) => KNOWN.some((k) => k.el.test(r.el));

/** Controls of the redesigned screens that must be 44 px targets on a touch layout (<= 1100 px): [screen, selector, what]. */
const TARGETS: { screen: string; selector: string; what: string }[] = [
  { screen: 'security-alarm', selector: 'security-alarm .chips button', what: 'the zone filter chips' },
  { screen: 'security-alarm', selector: 'security-alarm [data-alarm-view] button', what: 'the cards / list switch' },
  { screen: 'settings-general', selector: 'system-nav [data-settings-search]', what: 'the settings search field' },
];

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
  test.describe.configure({ timeout: 20 * 60_000 });
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

  for (const s of SCREENS) {
    test(`${s.id}: nothing escapes, is clipped, overflows or floats (light and dark, 390 / 1024 / 1440)`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'one project runs the sweep');
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const results: Row[] = [];
      let runs = 0;
      for (const theme of THEMES) {
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          await open(page, s.hash, theme);
          await settle(page);
          for (const part of ['', ' bottom']) {
            if (part) await scrollMain(page, 'bottom');
            runs++;
            const found = await page.evaluate(inPageCheck, { ctx: `${s.id} ${theme} ${w}${part}`, bubble: BUBBLE, skip: SKIP });
            results.push(...found.map((f) => ({ ...f, w, screen: s.id })));
          }
        }
      }
      // the rules: the geometry classes at every width; 44 px targets are checked per TARGETS below, not here
      const enforced = results.filter((r) => r.cls !== 'target' && !isKnown(r));
      const sum = summarize(enforced, 100);
      console.log(`layout-visdiff-246 ${s.id}: ${runs} checks, findings ${results.length} (${JSON.stringify(summarize(results).byCls)}), enforced ${enforced.length} (${JSON.stringify(sum.byCls)}), page errors ${errors.length}`);
      if (REPORT_ONLY) {
        const uniq = new Map<string, { f: Row; n: number }>();
        for (const f of results) {
          const k = `${f.cls}|${f.el}|${f.detail}`;
          const u = uniq.get(k);
          if (u) u.n++;
          else uniq.set(k, { f, n: 1 });
        }
        for (const { f, n } of uniq.values()) console.log(`FIND|${f.cls}|${f.el}|${f.detail}|${n}|${f.ctx}`);
        return;
      }
      expect(errors, 'page errors').toEqual([]);
      expect(sum.lines, 'layout findings').toEqual([]);
    });
  }

  for (const t of TARGETS) {
    test(`${t.screen}: ${t.what} are 44 px targets on a touch layout`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'one project runs the sweep');
      const small: string[] = [];
      for (const theme of THEMES) {
        for (const w of [390, 1024]) {
          await page.setViewportSize({ width: w, height: height(w) });
          await open(page, SCREENS.find((s) => s.id === t.screen)!.hash, theme);
          const boxes = await page.locator(t.selector).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }));
          expect(boxes.length, `${t.what} rendered (${theme} ${w})`).toBeGreaterThan(0);
          for (const b of boxes) if (b.w < 44 || b.h < 44) small.push(`${theme} ${w}: ${b.w}x${b.h}`);
        }
      }
      expect(small, `${t.what} below 44 px`).toEqual([]);
    });
  }

  test('settings-general: the skin cards share one row wherever the card is wide (no lone card on a second line)', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the sweep');
    for (const w of [1024, 1440]) {
      await page.setViewportSize({ width: w, height: height(w) });
      await open(page, '/system/diagnostics', 'light');
      const tops = await page.locator('[data-skin-option]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      expect(tops.length, `the skin cards rendered (${w})`).toBe(SKINS_UNDER_TEST.length); // BUBBLE-FREEZE-295: the selectable skins (was five with bubble)
      expect(new Set(tops).size, `skin card tops at ${w}: ${tops.join(',')}`).toBe(1);
    }
  });

  test('settings-general: the settings navigation labels keep 4.5:1 against the page (light and dark)', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the sweep');
    await page.setViewportSize({ width: 1440, height: height(1440) });
    for (const theme of THEMES) {
      await open(page, '/system/diagnostics', theme);
      const r = await page.evaluate(() => {
        const nav = document.querySelector('sw-app')?.shadowRoot?.querySelector('system-nav')?.shadowRoot;
        const label = nav?.querySelector('.grp > b');
        if (!nav || !label) return null;
        const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const lum = ([r, g, b]: number[]) => {
          const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const probe = document.createElement('span');
        probe.style.color = 'var(--sw-bg)';
        nav.appendChild(probe);
        const bg = rgb(getComputedStyle(probe).color);
        probe.remove();
        const fg = rgb(getComputedStyle(label).color);
        const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
        return { ratio: (a + 0.05) / (b + 0.05), fg, bg };
      });
      expect(r, `the navigation column rendered (${theme})`).not.toBeNull();
      expect(r!.ratio, `label ${JSON.stringify(r!.fg)} on ${JSON.stringify(r!.bg)} (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
