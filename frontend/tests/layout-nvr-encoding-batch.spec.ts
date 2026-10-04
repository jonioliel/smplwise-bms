import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { newMock } from './nvr-cameras-write-mock';
import { batchCameras, installBatch, newBatchMock } from './nvr-batch-mock';

// CR-020 phase D: the layout guard (tests/layout-guard.ts) over "שינוי קידוד לכמה מצלמות" - the checklist with its filters (a list with its own
// scroll), the target settings form, the preview (tabs + a list of two-line rows) and the ONE confirmation - across widths 320..1440 x light /
// dark x the four skins (classic, domus, tesla, bubble). FAILS on escape / overflow / floating / clipped / target (target in bubble, as the
// multi-camera spec). Every dialog's own box is measured too: inside the viewport, no horizontal scroll, every list row at least 44 px, the
// footer's primary button reachable. Skipped as in the multi-camera spec: the shared sw-button and sw-dropdown (component-level sizes: the
// dropdown's 32 px chip carries its own 44 px hit area). LAYOUT_QUICK=1 sweeps four widths. One project runs it:
//   ~/run_remote.sh spec <branch> tests/layout-nvr-encoding-batch.spec.ts --project=desktop
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 800, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;
const PAGE = 'sw-app system-security system-security-cameras';
const ENC = `${PAGE} nvr-encoding-batch`;
const DLG = `${ENC} sw-dialog[open][data-nvr-enc]`;
const CONFIRM = `${ENC} sw-dialog[open][data-nvr-confirm-dialog]`;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const SKIP = 'nvr-undo-toast, sw-toggle, sw-button, sw-dropdown, .trap, .vh';

async function check(page: Page, results: Finding[], ctx: string, keep: Finding['cls'][]) {
  await settle(page);
  // with its unit: a unitless value makes every var(--sw-touch-desktop) size invalid (the bubble skin's tab buttons then collapse to their text)
  await page.evaluate(() => document.documentElement.style.setProperty('--sw-touch-desktop', '32px'));
  const found = await page.evaluate(inPageCheck, { ctx, skip: SKIP, roots: ['system-security-cameras'], within: 'system-security-cameras' });
  results.push(...found.filter((f) => keep.includes(f.cls)));
}

async function boxCheck(page: Page, results: Finding[], ctx: string, dialog: string, list: boolean, footer?: string) {
  const bad = await page.locator(dialog).evaluate((el, hasList) => {
    const out: string[] = [];
    const box = (el.shadowRoot as ShadowRoot).querySelector('.box') as HTMLElement;
    const r = box.getBoundingClientRect();
    if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5) out.push(`box outside the viewport (${Math.round(r.left)}..${Math.round(r.right)} of ${innerWidth}, ${Math.round(r.top)}..${Math.round(r.bottom)} of ${innerHeight})`);
    if (document.documentElement.scrollWidth > innerWidth) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${innerWidth})`);
    const body = (el.shadowRoot as ShadowRoot).querySelector('.body') as HTMLElement;
    if (body.scrollWidth > body.clientWidth + 1) out.push(`dialog body scrolls sideways (${body.scrollWidth} > ${body.clientWidth})`);
    if (hasList) {
      const walk = (root: ParentNode): HTMLElement | null => {
        const f = root.querySelector<HTMLElement>('.vl');
        if (f) return f;
        for (const e of root.querySelectorAll('*')) {
          const inner = e.shadowRoot && walk(e.shadowRoot);
          if (inner) return inner;
        }
        return null;
      };
      const vl = walk(el);
      if (!vl) out.push('no list');
      else {
        if (vl.scrollWidth > vl.clientWidth + 1) out.push(`list scrolls sideways (${vl.scrollWidth} > ${vl.clientWidth})`);
        if (vl.clientHeight < 120) out.push(`list is only ${vl.clientHeight}px tall`);
        for (const row of vl.querySelectorAll<HTMLElement>('.sel, .row')) {
          const b = row.getBoundingClientRect();
          if (b.height < 43.5) out.push(`row ${Math.round(b.height)}px < 44`);
          if (b.right > vl.getBoundingClientRect().right + 1 || b.left < vl.getBoundingClientRect().left - 1) out.push('row outside the list');
        }
      }
    }
    return out;
  }, list);
  for (const d of bad) results.push({ cls: 'overflow', el: dialog.split(' ').pop() ?? dialog, detail: d, ctx });
  if (footer) {
    const nb = await page.locator(`${dialog} ${footer}`).boundingBox();
    const h = page.viewportSize()?.height ?? 900;
    if (!nb || nb.y + nb.height > h + 0.5 || nb.y < -0.5) results.push({ cls: 'overflow', el: footer, detail: `footer button outside the viewport (y ${Math.round(nb?.y ?? -1)})`, ctx });
  }
}

test.describe('layout guard: the bulk encoding change', () => {
  test.describe.configure({ timeout: 25 * 60_000 });

  test('checklist, settings, preview and confirmation, four skins, light and dark', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    const st = newMock();
    st.canBatch = true;
    const bm = newBatchMock();
    bm.encSkip['cam-4:401'] = 'codec_not_offered';
    await installBatch(page, st, bm);
    for (const [skin, theme] of SKINS.flatMap((k) => THEMES.map((t) => [k, t] as const))) {
      const own: Finding['cls'][] = skin === 'bubble' ? ['escape', 'overflow', 'floating', 'clipped', 'target'] : ['escape', 'overflow', 'clipped'];
      for (const w of WIDTHS) {
        const ctx = `${skin} ${theme} ${w}`;
        st.cameras = batchCameras(30, { h265: [2, 5, 9], names: { 3: 'שער כניסה ראשי של החניון התת־קרקעי בקומה מינוס שתיים' } });
        bm.batches = [];
        await page.setViewportSize({ width: w, height: height(w) });
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=${skin}&scheme=${theme}#/system/security/cameras`);
        await page.waitForSelector('sw-app');
        await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
        await page.evaluate(() => document.fonts.ready);
        await page.locator(`${PAGE} [data-nvr-encoding-open]`).click();
        await expect(page.locator(`${DLG} [data-nvr-enc-stream="cam-1:101"]`)).toHaveAttribute('aria-disabled', 'false');
        for (const k of ['cam-1:101', 'cam-2:201', 'cam-3:301', 'cam-3:302', 'cam-4:401']) await page.locator(`${DLG} [data-nvr-enc-stream="${k}"]`).click();
        runs++;
        await check(page, results, `${ctx} checklist`, own);
        await boxCheck(page, results, `${ctx} checklist`, DLG, true, '[data-nvr-enc-next]');
        await page.locator(`${DLG} [data-nvr-enc-next]`).dispatchEvent('click');
        await page.locator(`${DLG} sw-dropdown[data-nvr-enc-dd="codec-target"] [data-dropdown-chip]`).click();
        await page.locator(`${DLG} sw-dropdown[data-nvr-enc-dd="codec-target"] [role="option"][data-id="H.264"]`).click();
        await page.locator(`${DLG} [data-nvr-enc-input="gop"]`).fill('25');
        runs++;
        await check(page, results, `${ctx} settings`, own);
        await boxCheck(page, results, `${ctx} settings`, DLG, false, '[data-nvr-enc-preview]');
        await page.locator(`${DLG} [data-nvr-enc-preview]`).dispatchEvent('click');
        await expect(page.locator(DLG)).toHaveAttribute('data-phase', 'preview');
        runs++;
        await check(page, results, `${ctx} preview`, own);
        await boxCheck(page, results, `${ctx} preview`, DLG, true, '[data-nvr-enc-apply]');
        await page.locator(`${DLG} [data-nvr-enc-apply]`).dispatchEvent('click');
        await page.locator(`${CONFIRM} details summary`).click();
        runs++;
        await check(page, results, `${ctx} confirm`, own);
        await boxCheck(page, results, `${ctx} confirm`, CONFIRM, false);
        await page.locator(`${CONFIRM} [data-nvr-cancel]`).click();
        await page.keyboard.press('Escape');
      }
    }
    const { byCls, lines } = summarize(results);
    console.log(`encoding batch: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
    for (const l of lines) console.log('  ' + l);
    expect(errors, 'page errors').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
  });
});
