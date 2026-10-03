import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { install, newMock } from './nvr-cameras-write-mock';

// CR-020 S2 phase B: the layout guard (tests/layout-guard.ts) over the cameras screen WITH its write controls - the table / cards
// with the SVC switch and the pencil, the ONE confirmation, the editor drawer - across widths 320..1440 x light / dark. FAILS on
// escape / overflow / floating / clipped / target. The undo toast floats over the page by design (bottom, ten seconds) and is skipped
// for "floating"; its buttons are 44 px by their own CSS. The switch's own 24 px button sits inside a host box padded to 44 px in
// touch layouts: the guard measures the host (the part a finger hits), see `hostTargets` below.
// One project runs the whole sweep. Run on the runner (dev server): ~/run_remote.sh spec <branch> tests/layout-nvr-cameras.spec.ts --project=desktop
const WIDTHS = [320, 360, 390, 480, 600, 768, 820, 1024, 1100, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
// bubble: the guard's own skin (its touch dial makes 44 px controls); classic: the guard's overflow / escape / clipped classes only
// (classic components are 26-32 px by design, so "target" is judged in bubble and on the screen's own controls below)
const SKINS = ['bubble', 'classic'] as const;
const PAGE = 'sw-app system-security system-security-cameras';
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
// decorative / own-layer items the guard must not measure: the toast (floats by design), the switch's inner button (its host is checked), the drawer's focus traps
const SKIP = 'nvr-undo-toast, sw-toggle, sw-button, .trap, .vh';

/** Only this screen is measured (`within`): the shell's own tabs and navigation have their own specs. */
async function check(page: Page, results: Finding[], ctx: string, keep: Finding['cls'][]) {
  await settle(page);
  // the desktop touch dial of the guard: 32 px (the cameras table is a dense settings table; touch layouts need 44 px)
  await page.evaluate(() => document.documentElement.style.setProperty('--sw-touch-desktop', '32'));
  const found = await page.evaluate(inPageCheck, { ctx, skip: SKIP, roots: ['system-security-cameras'], within: 'system-security-cameras' });
  results.push(...found.filter((f) => keep.includes(f.cls)));
}

/** The editor is a modal drawer in the browser's top layer: the guard walks the composed tree, where the shell's clipped column is its ancestor, so
 * "clipped" / "floating" are false positives there. Its own box is measured here instead: inside the viewport, no horizontal scroll, every control inside the panel. */
async function drawerCheck(page: Page, results: Finding[], ctx: string) {
  const bad = await page.locator('sw-app system-security system-security-cameras nvr-camera-editor sw-drawer').evaluate((el) => {
    const out: string[] = [];
    const dlg = el.shadowRoot!.querySelector('dialog')!;
    const r = dlg.getBoundingClientRect();
    if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5 || r.top < -0.5) out.push(`panel outside the viewport (${Math.round(r.left)}..${Math.round(r.right)} of ${innerWidth}, bottom ${Math.round(r.bottom)} of ${innerHeight})`);
    const body = el.shadowRoot!.querySelector('.body') as HTMLElement;
    if (body.scrollWidth > body.clientWidth + 1) out.push(`body scrolls horizontally (${body.scrollWidth} > ${body.clientWidth})`);
    for (const c of el.querySelectorAll('select, input, sw-toggle, sw-button')) {
      const b = c.getBoundingClientRect();
      if (b.width && (b.left < r.left - 1 || b.right > r.right + 1)) out.push(`${c.tagName.toLowerCase()} outside the panel`);
    }
    return out;
  });
  for (const d of bad) results.push({ cls: 'overflow', el: 'editor drawer', detail: d, ctx });
}

/** The host box of the switch (what a finger hits; its padded box counts) is at least
 * 44 x 44 in touch layouts. The guard skips the switch (it would measure the inner 24 px button) and the shared sw-button (a component-level size, 30-40 px by pointer: its own audit). */
async function hostTargets(page: Page, results: Finding[], ctx: string, tags: string[]) {
  if ((page.viewportSize()?.width ?? 1440) > 1100) return;
  const small = await page.evaluate((want) => {
    const out: string[] = [];
    const walk = (root: ShadowRoot) => {
      for (const el of root.querySelectorAll('*')) {
        if (want.includes(el.tagName)) {
          const r = el.getBoundingClientRect();
          if (r.width && r.height && (r.width < 43.5 || r.height < 43.5)) out.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    const find = (root: Document | ShadowRoot): ShadowRoot | null => {
      for (const el of root.querySelectorAll('*')) {
        if (el.tagName === 'SYSTEM-SECURITY-CAMERAS') return el.shadowRoot;
        const inner = el.shadowRoot && find(el.shadowRoot);
        if (inner) return inner;
      }
      return null;
    };
    const screen = find(document);
    if (screen) walk(screen);
    return out;
  }, tags);
  for (const s of small) results.push({ cls: 'target', el: 'host', detail: `${s} < 44`, ctx });
}

test.describe('layout guard: the cameras screen with its write controls', () => {
  test.describe.configure({ timeout: 10 * 60_000 });

  test('table / cards, the confirmation and the editor, light and dark, 320..1440', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    const st = newMock();
    await install(page, st);
    for (const [skin, theme] of SKINS.flatMap((k) => THEMES.map((t) => [k, t] as const))) {
      const own: Finding['cls'][] = skin === 'bubble' ? ['escape', 'overflow', 'floating', 'clipped', 'target'] : ['escape', 'overflow', 'clipped'];
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('about:blank');
      await page.goto(`/?design=a&skin=${skin}&scheme=${theme}#/system/security/cameras`);
      await page.waitForSelector('sw-app');
      await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
      await expect(page.locator(`${PAGE} sw-toggle[data-svc-toggle]`).first()).toBeAttached();
      await expect.poll(() => st.hits.filter((h) => /^GET nvr\/cameras\/cam-\d$/.test(h)).length).toBeGreaterThanOrEqual(3);
      await page.evaluate(() => document.fonts.ready);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: height(w) });
        await page.waitForTimeout(150);
        const ctx = `${skin} ${theme} ${w}`;
        runs++;
        await check(page, results, `${ctx} list`, own);
        await hostTargets(page, results, `${ctx} list`, ['SW-TOGGLE']);
        const phone = w < 900; // a holder of nvr.configure gets the cards below 900 px (the table needs about that with the switch and pencil columns)
        if (!phone) {
          // the table itself fits its box with the switch and pencil columns (the S1 rule: no scrolling inside the table at tablet widths)
          const inner = await page.locator(`${PAGE} [data-nvr-table]`).evaluate((el) => el.scrollWidth - el.clientWidth);
          if (inner > 0) results.push({ cls: 'overflow', el: 'table box', detail: `table scrolls by ${inner}px`, ctx });
        }
        const scope = `${PAGE} ${phone ? '[data-nvr-cards]' : '[data-nvr-table]'}`;
        const tog = page.locator(`${scope} ${phone ? '[data-stream-card]' : 'tr[data-stream-row]'}[data-camera="nvr-1:1"][data-stream="101"] sw-toggle[data-svc-toggle]`);
        await tog.scrollIntoViewIfNeeded();
        // the confirmation
        await tog.click();
        await expect(page.locator('sw-dialog[open][data-nvr-confirm-dialog] [data-nvr-confirm]')).toBeVisible();
        await page.locator('sw-dialog[open][data-nvr-confirm-dialog] details summary').click();
        runs++;
        
        await check(page, results, `${ctx} confirm`, own);
        await page.locator('sw-dialog[open][data-nvr-confirm-dialog] [data-nvr-cancel]').click();
        await expect(page.locator('sw-dialog[open][data-nvr-confirm-dialog]')).toHaveCount(0);
        // the editor (a modal drawer: side panel / bottom sheet)
        await page.locator(`${scope} ${phone ? '[data-stream-card]' : 'tr[data-stream-row]'}[data-camera="nvr-1:1"][data-stream="101"] button[data-edit-stream]`).click();
        await expect(page.locator(`${PAGE} nvr-camera-editor sw-drawer[open] [data-nvr-editor-form]`)).toBeVisible();
        runs++;
        await drawerCheck(page, results, `${ctx} editor`);
        if (skin === 'bubble') await check(page, results, `${ctx} editor`, ['target']);
        await page.keyboard.press('Escape');
        await expect(page.locator(`${PAGE} nvr-camera-editor sw-drawer[open]`)).toHaveCount(0);
      }
    }
    const { byCls, lines } = summarize(results);
    console.log(`cameras write: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
    for (const l of lines) console.log('  ' + l);
    expect(errors, 'page errors').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
  });
});
