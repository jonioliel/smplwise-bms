import { test, expect, type Page } from '@playwright/test';
import { SKIN_IDS } from '../src/design/skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installStationsMock, newMock, openStations } from './wiskey-stations-mocks';
import { installStationMediaMock, newMediaMock } from './wiskey-station-media-mocks';

// CR-036 slice S18: the layout guard (tests/layout-guard.ts) over a station's drawer with the live video and the push-to-talk, against
// the MOCKED backend, in every skin x light / dark x widths 320-1440: the idle drawer (player + quality + talk), the talking state
// (countdown + end), a refused start (a problem line), and a station without talk (the classic link). It FAILS on escape / overflow /
// clipped, a sideways page scroll, a page error, or a control of the S18 components smaller than the hit area (44 px in touch
// layouts, the look dial on a desktop).
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-wiskey-station-media.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg, video';
const SCREEN = 'wiskey-stations';

/** Runs inside the page: the S18 components' own interactive elements smaller than the hit area. */
function ownTargets(args: { ctx: string }): string[] {
  const out: string[] = [];
  const min = innerWidth <= 1100 ? 44 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sw-touch-desktop')) || 44;
  const mine = new Set(['WK-STATION-LIVE', 'WK-TALK-BUTTON', 'WK-ACTION-BUTTON']);
  const walk = (root: ParentNode, inside: boolean) => {
    for (const el of Array.from(root.querySelectorAll('*'))) {
      if (inside && el.matches('button, a[href]') && !(el as HTMLButtonElement).disabled) {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && (r.width < min - 0.5 || r.height < min - 0.5)) {
          out.push(`${args.ctx}: ${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)} < ${min}`);
        }
      }
      if (mine.has(el.tagName) && el.shadowRoot) walk(el.shadowRoot, true);
    }
  };
  const host = document.querySelector('sw-app')?.shadowRoot?.querySelector('wiskey-stations')?.shadowRoot?.querySelector('wk-station-live');
  if (host) walk(host.shadowRoot ?? host, true);
  return out;
}

async function settle(page: Page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(120);
}

test.describe('station media layout guard', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.describe.configure({ timeout: 30 * 60_000 });

  test('drawer: live video, two-way talk idle / talking / refused, the classic link - skins x themes x widths', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    const own: string[] = [];
    let runs = 0;
    const base = newMock();
    await installStationsMock(page, base);
    const mm = newMediaMock({ mode: 'video_talk', station: { lobby: 'video_only' } });
    await installStationMediaMock(page, base, mm);
    const check = async (ctx: string) => {
      runs++;
      const found = await page.evaluate(inPageCheck, { ctx, skip: SKIP, within: SCREEN, roots: [SCREEN] });
      results.push(...found.filter((f) => f.cls === 'escape' || f.cls === 'overflow' || f.cls === 'clipped'));
      own.push(...(await page.evaluate(ownTargets, { ctx })));
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${ctx}: sideways scroll`).toBeLessThanOrEqual(1);
    };
    const drawer = (sel: string) => page.locator(`${SCREEN} sw-drawer[data-wk-drawer] ${sel}`);
    for (const skin of SKIN_IDS) {
      for (const theme of THEMES) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openStations(page, { skin, scheme: theme });
        await page.waitForSelector(`${SCREEN} [data-wk-station]`, { timeout: 30_000 });
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          const ctx = `${skin} ${theme} ${w}`;
          await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="gate"] button.open`).click();
          await drawer('wk-station-live wk-talk-button').waitFor();
          await settle(page);
          await check(`${ctx} idle`);
          const btn = drawer('wk-station-live wk-talk-button [data-wk-ptt]');
          const box = (await btn.boundingBox())!;
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.up(); // WKF01F02-295: one click opens a full-duplex talk (no press-and-hold)
          await expect(btn).toHaveAttribute('data-phase', 'talking', { timeout: 10_000 });
          await settle(page);
          await check(`${ctx} talking`);
          await drawer('wk-station-live wk-talk-button [data-wk-talk-end]').click();
          await expect(btn).toHaveAttribute('data-phase', 'idle');
          await page.keyboard.press('Escape');
          await settle(page);
          // a station without talk: the classic link under the player
          await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="lobby"] button.open`).click();
          await drawer('wk-station-live [data-wk-talk="classic"]').waitFor();
          await settle(page);
          await check(`${ctx} classic`);
          await page.keyboard.press('Escape');
          await settle(page);
        }
      }
    }
    // a refused start (a problem line) at the narrowest and the widest width
    mm.startFail = { status: 409, code: 'intercom_talk_user_busy' };
    for (const w of [320, 1440]) {
      await page.setViewportSize({ width: w, height: height(w) });
      await openStations(page);
      await page.waitForSelector(`${SCREEN} [data-wk-station]`, { timeout: 30_000 });
      await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="gate"] button.open`).click();
      const btn = drawer('wk-station-live wk-talk-button [data-wk-ptt]');
      await btn.click();
      await expect(drawer('wk-station-live wk-talk-button [data-wk-talk-line]')).toHaveAttribute('data-problem', 'user_busy');
      await settle(page);
      await check(`refused ${w}`);
    }
    const { byCls, lines } = summarize(results);
    console.log(`layout-wiskey-station-media: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), own targets under the hit area ${own.length}, page errors ${errors.length}`);
    for (const l of lines) console.log('  ' + l);
    for (const l of [...new Set(own)].slice(0, 40)) console.log('  [own target] ' + l);
    expect(errors, 'page errors').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
    expect([...new Set(own)], 'controls below the hit area').toEqual([]);
  });
});
