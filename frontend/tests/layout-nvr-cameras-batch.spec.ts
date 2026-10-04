import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { newMock } from './nvr-cameras-write-mock';
import { batchCameras, installBatch, newBatchMock } from './nvr-batch-mock';

// CR-020 S2 phase C: the layout guard (tests/layout-guard.ts) over the multi-camera change - the SVC dialog with its extra button, the checklist
// (a list with its own scroll), the ONE confirmation with the names under "פרטים", the progress dialog (running), the strip while the dialog is
// hidden, and the result of a failure - across widths 320..1440 x light / dark x bubble / classic. FAILS on escape / overflow / floating /
// clipped / target. The toast floats over the page by design and is skipped; the shared sw-button (a component-level size) and the switch are
// skipped as in layout-nvr-cameras.spec.ts, and every dialog's own box is measured here: inside the viewport, no horizontal scroll, every
// list row at least 44 px.
// LAYOUT_QUICK=1 sweeps four widths (the loop); the full sweep runs once at the end. One project runs it:
//   ~/run_remote.sh spec <branch> tests/layout-nvr-cameras-batch.spec.ts --project=desktop
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 800, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1100, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const SKINS = ['bubble', 'classic'] as const;
const PAGE = 'sw-app system-security system-security-cameras';
const B = `${PAGE} nvr-camera-batch`;
const CONFIRM = 'sw-dialog[open][data-nvr-confirm-dialog]';
const SEL = `${B} sw-dialog[open][data-nvr-batch-select]`;
const PROG = `${B} sw-dialog[open][data-nvr-batch-progress]`;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const SKIP = 'nvr-undo-toast, sw-toggle, sw-button, .trap, .vh';

async function check(page: Page, results: Finding[], ctx: string, keep: Finding['cls'][]) {
  await settle(page);
  await page.evaluate(() => document.documentElement.style.setProperty('--sw-touch-desktop', '32'));
  const found = await page.evaluate(inPageCheck, { ctx, skip: SKIP, roots: ['system-security-cameras'], within: 'system-security-cameras' });
  results.push(...found.filter((f) => keep.includes(f.cls)));
}

/** One dialog's own box: inside the viewport, the page does not scroll sideways, the scrolling list inside it keeps its size and its rows are 44 px. */
async function boxCheck(page: Page, results: Finding[], ctx: string, dialog: string, list: boolean) {
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
}

test.describe('layout guard: the multi-camera change', () => {
  test.describe.configure({ timeout: 15 * 60_000 });

  test('checklist, confirmation, progress, strip and result, light and dark, bubble and classic', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    const st = newMock();
    st.canBatch = true;
    const bm = newBatchMock();
    const d = await installBatch(page, st, bm);
    for (const [skin, theme] of SKINS.flatMap((k) => THEMES.map((t) => [k, t] as const))) {
      const own: Finding['cls'][] = skin === 'bubble' ? ['escape', 'overflow', 'floating', 'clipped', 'target'] : ['escape', 'overflow', 'clipped'];
      for (const w of WIDTHS) {
        const ctx = `${skin} ${theme} ${w}`;
        st.cameras = batchCameras(40, { names: { 3: 'שער כניסה ראשי של החניון התת־קרקעי בקומה מינוס שתיים' } });
        bm.batches = [];
        await page.setViewportSize({ width: w, height: height(w) });
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=${skin}&scheme=${theme}#/system/security/cameras`);
        await page.waitForSelector('sw-app');
        await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
        await page.evaluate(() => document.fonts.ready);
        const cards = w < 900;
        const scope = `${PAGE} ${cards ? '[data-nvr-cards]' : '[data-nvr-table]'}`;
        const tog = page.locator(`${scope} ${cards ? '[data-stream-card]' : 'tr[data-stream-row]'}[data-camera="nvr-1:1"][data-stream="101"] sw-toggle[data-svc-toggle]`);
        await expect(tog).toBeVisible();
        await tog.scrollIntoViewIfNeeded();
        // the SVC dialog with the extra button
        await tog.click();
        await expect(page.locator(`${CONFIRM} [data-nvr-extra]`)).toBeVisible();
        runs++;
        await check(page, results, `${ctx} svc-dialog`, own);
        await boxCheck(page, results, `${ctx} svc-dialog`, CONFIRM, false);
        await page.locator(`${CONFIRM} [data-nvr-extra]`).click();
        // the checklist: a window of rows with its own scroll
        await expect(page.locator(`${SEL} [data-nvr-batch-next]`)).toBeVisible();
        for (const ch of [2, 3, 4, 5]) await page.locator(`${SEL} [data-nvr-batch-cam="cam-${ch}"]`).click();
        runs++;
        await check(page, results, `${ctx} checklist`, own);
        await boxCheck(page, results, `${ctx} checklist`, SEL, true);
        // the footer's button must be reachable: inside the viewport (a dialog taller than the screen would hide it)
        const nb = await page.locator(`${SEL} [data-nvr-batch-next]`).boundingBox();
        if (!nb || nb.y + nb.height > height(w) + 0.5 || nb.y < -0.5) results.push({ cls: 'overflow', el: 'checklist footer', detail: `"המשך" outside the viewport (y ${Math.round(nb?.y ?? -1)}, h ${Math.round(nb?.height ?? 0)}, viewport ${height(w)})`, ctx: `${ctx} checklist` });
        await page.locator(`${SEL} [data-nvr-batch-next]`).dispatchEvent('click');
        // the one confirmation, names open
        await page.locator(`${CONFIRM} details summary`).click();
        runs++;
        await check(page, results, `${ctx} confirm`, own);
        await boxCheck(page, results, `${ctx} confirm`, CONFIRM, false);
        await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
        // progress, running
        await expect(page.locator(`${PROG} [data-nvr-batch-list]`)).toBeVisible();
        d.step();
        await expect(page.locator(`${PROG} [data-nvr-batch-item="0"]`)).toHaveAttribute('data-status', 'applied', { timeout: 9000 });
        runs++;
        await check(page, results, `${ctx} progress`, own);
        await boxCheck(page, results, `${ctx} progress`, PROG, true);
        // hidden: the strip and the disabled single controls
        await page.keyboard.press('Escape');
        await expect(page.locator(`${PAGE} [data-nvr-batch-strip]`)).toBeVisible();
        runs++;
        await check(page, results, `${ctx} strip`, own);
        await page.locator(`${PAGE} [data-nvr-batch-show]`).click();
        // the failure at the third camera (the long name): the result with a line per camera
        d.step('failed');
        await expect(page.locator(`${PROG}[data-state="failed"]`)).toHaveCount(1, { timeout: 9000 });
        runs++;
        await check(page, results, `${ctx} result`, own);
        await boxCheck(page, results, `${ctx} result`, PROG, true);
        await page.locator(`${PROG} [data-nvr-batch-close]`).click();
        await expect(page.locator(PROG)).toHaveCount(0);
      }
    }
    const { byCls, lines } = summarize(results);
    console.log(`cameras batch: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
    for (const l of lines) console.log('  ' + l);
    expect(errors, 'page errors').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
  });
});
