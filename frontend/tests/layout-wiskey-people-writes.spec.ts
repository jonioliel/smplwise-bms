import { test, expect, type Page } from '@playwright/test';
import { summarize, type Finding } from './layout-guard';
import { install, newMock } from './wiskey-people-mock';
import { installWrites, newWrites } from './wiskey-writes-mock';
import { skinsUnderTest } from './helpers/frozen-skins';

// CR-036 S11: the layout guard over the person WRITES of the native people screen - the actions dialog (the menu, a question with a
// reason, a result, the cards with a removal question and the add form, the photo), the result line under the person's page header,
// and the editor's new parts (the access category and the weekly timing form) - across widths 320..1440 x light / dark x bubble (its
// touch dial makes 44 px controls) and classic (the default look). Like layout-wiskey-people.spec.ts: the dialogs are fixed layers
// over a top-layer drawer, so their boxes are measured by `layerCheck` (inside the viewport, no horizontal scroll in the body, every
// control inside the box) and the screen's OWN controls by `ownTargets` (at least 44 px high in touch layouts); the shared sw-button is
// a component-level size with its own audit. FAILS on any finding.
// One project runs the whole sweep.   npx playwright test tests/layout-wiskey-people-writes.spec.ts --project=desktop
// SW_LAYOUT_QUICK=1: three widths, light only (the local loop); the runner runs the whole sweep.
const QUICK = process.env.SW_LAYOUT_QUICK === '1';
const WIDTHS = process.env.SW_LAYOUT_WIDTHS ? process.env.SW_LAYOUT_WIDTHS.split(',').map(Number) : QUICK ? [390, 1024, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1100, 1280, 1440];
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const ALL_SKINS = skinsUnderTest(['bubble', 'classic'] as const);
const SKINS = process.env.SW_LAYOUT_SKINS ? ALL_SKINS.filter((k) => process.env.SW_LAYOUT_SKINS!.split(',').includes(k)) : ALL_SKINS;
const NOW = '2026-10-12T10:00:00Z';
const SCREEN = 'wiskey-people';
const ACTIONS = 'wiskey-person-actions';
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** The box of a fixed dialog (`host`: the element whose shadow root holds the sw-dialog), the drawer, or the editor's dialog. */
async function layerCheck(page: Page, results: Finding[], ctx: string, host: 'wiskey-person-actions' | 'wiskey-person-editor' | 'drawer') {
  await settle(page);
  const bad = await page.evaluate((h) => {
    const out: string[] = [];
    const find = (root: Document | ShadowRoot, tag: string): Element | null => {
      for (const el of root.querySelectorAll('*')) {
        if (el.tagName === tag) return el;
        const inner = el.shadowRoot && find(el.shadowRoot, tag);
        if (inner) return inner;
      }
      return null;
    };
    // the drawer: sw-drawer's <dialog>; the actions: the sw-dialog in wiskey-person-actions; the editor: its own .pane
    let layer: Element | null;
    if (h === 'drawer') layer = find(document, 'SW-DRAWER');
    else if (h === 'wiskey-person-editor') layer = find(document, 'WISKEY-PERSON-EDITOR');
    else layer = find(document, 'WISKEY-PERSON-ACTIONS')?.shadowRoot?.querySelector('sw-dialog[open]') ?? null;
    if (!layer?.shadowRoot) return ['not found'];
    const box = layer.shadowRoot.querySelector(h === 'drawer' ? 'dialog' : h === 'wiskey-person-editor' ? '.pane' : '.box') as HTMLElement | null;
    if (!box) return ['no box'];
    const r = box.getBoundingClientRect();
    if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5) out.push(`box outside the viewport (${Math.round(r.left)}..${Math.round(r.right)} of ${innerWidth}, bottom ${Math.round(r.bottom)} of ${innerHeight})`);
    const body = layer.shadowRoot.querySelector('.body') as HTMLElement | null;
    if (body && body.scrollWidth > body.clientWidth + 1) out.push(`body scrolls horizontally (${body.scrollWidth} > ${body.clientWidth})`);
    const inside = (root: ParentNode) => {
      for (const c of root.querySelectorAll('select, input, textarea, button, sw-button, sw-badge, .result, .card, .item')) {
        const b = c.getBoundingClientRect();
        if (b.width && (b.left < r.left - 1 || b.right > r.right + 1)) out.push(`${c.tagName.toLowerCase()}${c.className ? '.' + String(c.className).split(' ')[0] : ''} outside the box`);
        if (c.shadowRoot) inside(c.shadowRoot);
      }
    };
    inside(layer);
    inside(layer.shadowRoot);
    const owner = h === 'drawer' ? null : find(document, h.toUpperCase());
    if (owner?.shadowRoot) inside(owner.shadowRoot);
    return out;
  }, host);
  for (const d of bad) results.push({ cls: 'overflow', el: host, detail: d, ctx });
}

/** The writes' OWN controls: at least 44 px high in touch layouts (the menu items, the fields, the photo picker, a card row). */
async function ownTargets(page: Page, results: Finding[], ctx: string) {
  if ((page.viewportSize()?.width ?? 1440) > 1100) return;
  const small = await page.evaluate(() => {
    const out: string[] = [];
    const find = (root: Document | ShadowRoot, tag: string): Element | null => {
      for (const el of root.querySelectorAll('*')) {
        if (el.tagName === tag) return el;
        const inner = el.shadowRoot && find(el.shadowRoot, tag);
        if (inner) return inner;
      }
      return null;
    };
    const OWN: Record<string, string> = {
      'WISKEY-PERSON-ACTIONS': '.item, input:not([type="checkbox"]):not([type="file"]), select, .pick, .card',
      // the editor's S11 parts only (its older fields have their own audit)
      'WISKEY-PERSON-EDITOR': '[data-wiskey-editor-section="category"] select, [data-wiskey-editor-section="category"] input, [data-wiskey-editor-section="timing"] select, [data-wiskey-editor-section="timing"] input:not([type="checkbox"]), .day',
    };
    for (const [tag, sel] of Object.entries(OWN)) {
      const host = find(document, tag);
      if (!host?.shadowRoot) continue;
      for (const el of host.shadowRoot.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.height < 43.5) out.push(`${tag.toLowerCase()} ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return out;
  });
  for (const s of small) results.push({ cls: 'target', el: 'own control', detail: `${s} < 44`, ctx });
}

test.describe('layout guard: the person writes', () => {
  test.describe.configure({ timeout: 20 * 60_000 });

  test('the actions dialog, the result line, the cards, the photo and the editor\'s timing, light and dark, 320..1440', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    page.setDefaultTimeout(20_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    const st = newMock('admin');
    const w = newWrites();
    await page.clock.setFixedTime(new Date(NOW));
    await install(page, st);
    await installWrites(page, st, w);
    const actions = page.locator(`${ACTIONS} sw-dialog`);
    const openActions = async (id: string) => {
      await page.locator(`${SCREEN} [data-person-row="${id}"]`).click();
      await expect(page.locator('wiskey-person-drawer [data-person-section="details"]')).toBeVisible();
      await page.locator('wiskey-person-drawer [data-person-actions-open]').click();
      await expect(actions).toHaveAttribute('data-person-actions', 'menu');
    };
    const leave = async () => {
      await page.locator(`${ACTIONS} [data-action-close]`).click();
      await expect(page.locator(ACTIONS)).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(page.locator('wiskey-person-drawer sw-drawer[open]')).toHaveCount(0);
    };
    for (const [skin, theme] of SKINS.flatMap((k) => THEMES.map((t) => [k, t] as const))) {
      for (const width of WIDTHS) {
        // a fresh directory for every width: the writes below change it
        Object.assign(st, { ...newMock('admin'), hits: [], sockets: st.sockets });
        Object.assign(w, newWrites());
        await page.setViewportSize({ width, height: height(width) });
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=${skin}&scheme=${theme}#/wiskey/people`);
        await page.waitForSelector('sw-app');
        await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => document.documentElement.style.setProperty('--sw-touch-desktop', '32'));
        const ctx = `${skin} ${theme} ${width}`;
        runs++;

        // the menu, a question, the result, the line under the header
        await openActions('p1');
        await layerCheck(page, results, `${ctx} menu`, ACTIONS);
        await ownTargets(page, results, `${ctx} menu`);
        await page.locator(`${ACTIONS} [data-person-action="deactivate"]`).click();
        await layerCheck(page, results, `${ctx} question`, ACTIONS);
        await page.locator(`${ACTIONS} [data-action-confirm]`).click();
        await expect(page.locator(`${ACTIONS} [data-action-result="saved"]`)).toBeVisible();
        await layerCheck(page, results, `${ctx} result`, ACTIONS);
        await page.locator(`${ACTIONS} [data-action-close]`).click();
        await expect(page.locator('wiskey-person-drawer [data-person-result="saved"]')).toBeVisible();
        await layerCheck(page, results, `${ctx} drawer with the result line`, 'drawer');

        // the cards: two rows, a removal question, the add form with a refused number
        await page.locator('wiskey-person-drawer [data-person-actions-open]').click();
        await page.locator(`${ACTIONS} [data-person-action="cards"]`).click();
        await expect(page.locator(`${ACTIONS} [data-person-card]`)).toHaveCount(1);
        await page.locator(`${ACTIONS} [data-card-number]`).fill('QX7731ZK');
        await page.locator(`${ACTIONS} [data-card-label]`).fill('תג חניון לרכב השירות של המחלקה');
        await page.locator(`${ACTIONS} [data-card-add]`).click();
        await expect(page.locator(`${ACTIONS} [data-person-card]`)).toHaveCount(2);
        await page.locator(`${ACTIONS} [data-person-card] [data-card-remove]`).first().click();
        await page.locator(`${ACTIONS} [data-card-number]`).fill('bad number!');
        await page.locator(`${ACTIONS} [data-card-add]`).click();
        await layerCheck(page, results, `${ctx} cards`, ACTIONS);
        await ownTargets(page, results, `${ctx} cards`);
        await page.locator(`${ACTIONS} [data-action-close]`).click();
        await expect(page.locator(ACTIONS)).toHaveCount(0);

        // the photo
        await page.locator('wiskey-person-drawer [data-person-actions-open]').click();
        await page.locator(`${ACTIONS} [data-person-action="photo"]`).click();
        await page.locator(`${ACTIONS} [data-photo-remove]`).click(); // p1 has a photo: the removal question
        await layerCheck(page, results, `${ctx} photo`, ACTIONS);
        await ownTargets(page, results, `${ctx} photo`);
        await leave();

        // a visitor's temporary cancel: the reason
        await openActions('p8');
        await page.locator(`${ACTIONS} [data-person-action="temporary_cancel"]`).click();
        await expect(page.locator(`${ACTIONS} select[data-action-reason]`)).toBeVisible();
        await layerCheck(page, results, `${ctx} reason`, ACTIONS);
        await ownTargets(page, results, `${ctx} reason`);
        await leave();

        // the editor: a contractor's category and the weekly timing with two windows
        await page.locator(`${SCREEN} [data-person-row="p2"]`).click();
        await page.locator('wiskey-person-drawer [data-wiskey-person-edit]').click();
        await expect(page.locator('wiskey-person-editor [data-wiskey-editor-name]')).toBeVisible({ timeout: 15_000 });
        await page.locator('wiskey-person-editor [data-wiskey-editor-category]').selectOption('contractor');
        await page.locator('wiskey-person-editor [data-wiskey-editor-timing-select]').selectOption('weekly');
        await page.locator('wiskey-person-editor [data-timing-add-period]').click();
        await page.locator('wiskey-person-editor [data-wiskey-editor-section="timing"]').scrollIntoViewIfNeeded();
        await layerCheck(page, results, `${ctx} editor timing`, 'wiskey-person-editor');
        await ownTargets(page, results, `${ctx} editor timing`);
        await page.locator('wiskey-person-editor [data-wiskey-editor-cancel]').click();
        await page.locator('wiskey-person-editor [data-wiskey-editor-close-discard]').click();
        await expect(page.locator('wiskey-person-editor')).toHaveCount(0);
      }
    }
    const { byCls, lines } = summarize(results);
    expect(errors, 'page errors').toEqual([]);
    expect(results.length, `${runs} runs; ${JSON.stringify(byCls)}\n${lines.join('\n')}`).toBe(0);
  });
});
