import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { extraPeople, install, newMock } from './wiskey-people-mock';
import { skinsUnderTest } from './helpers/frozen-skins';

// CR-036 S7: the layout guard (tests/layout-guard.ts) over the native people screen - the list / table / cards, the selection bar,
// the person's page and the message dialog - across widths 320..1440 x light / dark x the guard's own skin (bubble: its touch
// dial makes 44 px controls) and classic (the default look). FAILS on escape / overflow / floating / clipped / target.
// The shared sw-button is a component-level size (30-40 px by pointer: its own audit) and is skipped by the guard here; this
// screen's OWN controls (the filter selects, the search field, the view switch, the checkboxes, the rows and cards, the tabs of the
// person's page, the template chips) are measured below: at least 44 px high in touch layouts.
// The person's page is a modal drawer in the browser's top layer and the message dialog a fixed layer: the guard walks the composed
// tree, where the shell's clipped column is their ancestor, so their boxes are measured by `layerCheck` instead.
// One project runs the whole sweep.   npx playwright test tests/layout-wiskey-people.spec.ts --project=desktop
// SW_LAYOUT_QUICK=1: the quick local loop (three widths, light only); the runner runs the whole sweep
const QUICK = process.env.SW_LAYOUT_QUICK === '1';
// SW_LAYOUT_WIDTHS=390,1440 and SW_LAYOUT_SKINS=classic narrow the sweep further when a finding is being chased
const WIDTHS = process.env.SW_LAYOUT_WIDTHS ? process.env.SW_LAYOUT_WIDTHS.split(',').map(Number) : QUICK ? [390, 1024, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1100, 1280, 1440];
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const ALL_SKINS = skinsUnderTest(['bubble', 'classic'] as const);
const SKINS = process.env.SW_LAYOUT_SKINS ? ALL_SKINS.filter((k) => process.env.SW_LAYOUT_SKINS!.split(',').includes(k)) : ALL_SKINS;
const NOW = '2026-10-12T10:00:00Z';
const SCREEN = 'wiskey-people';
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const SKIP = 'sw-button, sw-badge, sw-avatar, .trap, .sk, .skeletons';
const log = (...a: unknown[]) => process.env.SW_LAYOUT_LOG === '1' && console.log(new Date().toISOString().slice(11, 19), ...a);

async function check(page: Page, results: Finding[], ctx: string, keep: Finding['cls'][]) {
  await settle(page);
  await page.evaluate(() => document.documentElement.style.setProperty('--sw-touch-desktop', '32'));
  const found = await page.evaluate(inPageCheck, { ctx, skip: SKIP, roots: [SCREEN], within: SCREEN });
  results.push(...found.filter((f) => keep.includes(f.cls)));
}

/** This screen's own controls: at least 44 px high (and wide where they are icon buttons) in touch layouts. */
async function ownTargets(page: Page, results: Finding[], ctx: string) {
  if ((page.viewportSize()?.width ?? 1440) > 1100) return;
  const small = await page.evaluate(() => {
    const out: string[] = [];
    const SEL = '.fchip select, .fchip input, .fchip, .search input, .seg button, .cbx, .row, .card, tbody tr, .linkbtn, .clear, .tabs button, .chip, .colopt';
    const visit = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) visit(el.shadowRoot);
        if (!el.matches(SEL)) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.height < 43.5) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    };
    const find = (root: Document | ShadowRoot): Element | null => {
      for (const el of root.querySelectorAll('*')) {
        if (el.tagName === 'WISKEY-PEOPLE') return el;
        const inner = el.shadowRoot && find(el.shadowRoot);
        if (inner) return inner;
      }
      return null;
    };
    const host = find(document);
    if (host?.shadowRoot) visit(host.shadowRoot);
    for (const tag of ['wiskey-person-drawer', 'wiskey-message-dialog']) {
      const inner = host?.shadowRoot?.querySelector(tag);
      if (inner?.shadowRoot) visit(inner.shadowRoot);
    }
    return out;
  });
  for (const s of small) results.push({ cls: 'target', el: 'own control', detail: `${s} < 44`, ctx });
}

/** A top-layer drawer / a fixed dialog: inside the viewport, no horizontal scroll in its body, every control inside its box. */
async function layerCheck(page: Page, results: Finding[], ctx: string, kind: 'drawer' | 'dialog') {
  const bad = await page.evaluate((k) => {
    const out: string[] = [];
    const find = (root: Document | ShadowRoot, tag: string): Element | null => {
      for (const el of root.querySelectorAll('*')) {
        if (el.tagName === tag) return el;
        const inner = el.shadowRoot && find(el.shadowRoot, tag);
        if (inner) return inner;
      }
      return null;
    };
    const host = find(document, k === 'drawer' ? 'SW-DRAWER' : 'SW-DIALOG');
    if (!host) return ['not found'];
    const box = (k === 'drawer' ? host.shadowRoot!.querySelector('dialog') : host.shadowRoot!.querySelector('.box')) as HTMLElement | null;
    if (!box) return ['no box'];
    const r = box.getBoundingClientRect();
    if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5) out.push(`box outside the viewport (${Math.round(r.left)}..${Math.round(r.right)} of ${innerWidth}, bottom ${Math.round(r.bottom)} of ${innerHeight})`);
    const body = host.shadowRoot!.querySelector('.body') as HTMLElement | null;
    if (body && body.scrollWidth > body.clientWidth + 1) out.push(`body scrolls horizontally (${body.scrollWidth} > ${body.clientWidth})`);
    const inside = (root: ParentNode) => {
      for (const c of root.querySelectorAll('select, input, textarea, button, sw-button, sw-badge, sw-avatar')) {
        const b = c.getBoundingClientRect();
        if (b.width && (b.left < r.left - 1 || b.right > r.right + 1)) out.push(`${c.tagName.toLowerCase()} outside the box`);
      }
    };
    inside(host);
    inside(host.shadowRoot!);
    return out;
  }, kind);
  for (const d of bad) results.push({ cls: 'overflow', el: kind, detail: d, ctx });
}

/** In the page: a directory longer than the screen must scroll in the shell's main column - nothing clipped, the filter row at its
 * height, the last row reachable. (A screen host with `display: contents` once handed the page to a column that held it to the
 * viewport: the list was cut off and could not be scrolled, and the filter row shrank to a sliver in the cards view.) */
function probeLongList(view: string): string[] {
  const root = document.querySelector('sw-app')!.shadowRoot!;
  const main = root.querySelector('main') as HTMLElement;
  const sr = (root.querySelector('wiskey-people') as HTMLElement).shadowRoot!;
  const out: string[] = [];
  if (main.scrollHeight - main.clientHeight < 200) out.push(`the page does not scroll (${main.scrollHeight} vs ${main.clientHeight})`);
  const filters = sr.querySelector('.filters') as HTMLElement;
  const fh = filters.getBoundingClientRect().height;
  if (fh < 44) out.push(`the filter row is ${Math.round(fh)}px high`);
  const box = sr.querySelector(view === 'list' ? '.rows' : view === 'table' ? '.scroll' : '.grid') as HTMLElement | null;
  if (!box) return [...out, `no ${view} container`];
  if (box.scrollHeight - box.clientHeight > 1) out.push(`the ${view} is clipped (${box.scrollHeight} > ${box.clientHeight})`);
  const rows = sr.querySelectorAll('[data-person-row]');
  const last = rows[rows.length - 1] as HTMLElement;
  last.scrollIntoView({ block: 'end', behavior: 'instant' as ScrollBehavior });
  const lr = last.getBoundingClientRect();
  const mr = main.getBoundingClientRect();
  if (lr.bottom > mr.bottom + 1 || lr.top < mr.top - 1) out.push(`the last row cannot be reached (${Math.round(lr.top)}..${Math.round(lr.bottom)} in ${Math.round(mr.top)}..${Math.round(mr.bottom)})`);
  main.scrollTop = 0;
  return out;
}

test.describe('layout guard: the native people screen', () => {
  test.describe.configure({ timeout: 15 * 60_000 });

  test('a long directory scrolls: nothing is clipped, the filter row keeps its height, the last row can be reached', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    page.setDefaultTimeout(20_000);
    const st = newMock('admin');
    st.people = [...st.people, ...extraPeople(40)];
    await page.clock.setFixedTime(new Date(NOW));
    await install(page, st);
    const bad: string[] = [];
    for (const [w, h] of [[390, 844], [820, 1100], [1440, 900]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('about:blank');
      await page.goto('/?design=a&skin=classic&scheme=light#/wiskey/people');
      await page.waitForSelector('sw-app');
      await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
      await expect(page.locator(`${SCREEN} [data-person-row]`).first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const view of w < 1000 ? ['list', 'cards'] : ['table', 'list', 'cards']) {
        await page.locator(`${SCREEN} [data-people-view="${view}"]`).click();
        await settle(page);
        expect(await page.locator(`${SCREEN} [data-person-row]`).count(), `${view} ${w}: all the people are listed`).toBeGreaterThan(45);
        for (const f of await page.evaluate(probeLongList, view)) bad.push(`${view} ${w}: ${f}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test('list / table / cards, the selection bar, the person\'s page and the message dialog, light and dark, 320..1440', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    page.setDefaultTimeout(20_000); // a step that cannot proceed fails in seconds, not at the end of the test
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('crash', () => log('PAGE CRASHED'));
    const results: Finding[] = [];
    let runs = 0;
    const st = newMock('admin');
    st.messaging = true;
    await page.clock.setFixedTime(new Date(NOW));
    await install(page, st);
    for (const [skin, theme] of SKINS.flatMap((k) => THEMES.map((t) => [k, t] as const))) {
      const own: Finding['cls'][] = skin === 'bubble' ? ['escape', 'overflow', 'floating', 'clipped', 'target'] : ['escape', 'overflow', 'clipped'];
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('about:blank');
      await page.goto(`/?design=a&skin=${skin}&scheme=${theme}#/wiskey/people`);
      await page.waitForSelector('sw-app');
      await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
      await expect(page.locator(`${SCREEN} [data-person-row]`).first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: height(w) });
        await page.waitForTimeout(150);
        const ctx = `${skin} ${theme} ${w}`;
        log('width', ctx);
        runs++;
        // the width's own view: the table from 768 px, the list below (the choice is kept in the browser's storage)
        const phone = w < 1000; // under 1000 px the screen has no table (it needs about 850 px)
        await page.locator(`${SCREEN} [data-people-view="${phone ? 'list' : 'table'}"]`).click();
        await check(page, results, `${ctx} default`, own);
        await ownTargets(page, results, `${ctx} default`);
        if (!phone) {
          const scroll = page.locator(`${SCREEN} .scroll`);
          await expect(scroll).toHaveCount(1);
          const inner = await scroll.evaluate((el) => el.scrollWidth - el.clientWidth);
          if (inner > 0) results.push({ cls: 'overflow', el: 'table box', detail: `the table scrolls by ${inner}px`, ctx });
        }
        log('cards');
        await page.locator(`${SCREEN} [data-people-view="cards"]`).click();
        await check(page, results, `${ctx} cards`, own);
        await ownTargets(page, results, `${ctx} cards`);
        log('selection');
        await page.locator(`${SCREEN} [data-people-view="list"]`).click();
        await page.locator(`${SCREEN} [data-people-select-mode]`).click();
        for (const id of ['p1', 'p2', 'p4']) await page.locator(`${SCREEN} [data-person-select="${id}"]`).click();
        await check(page, results, `${ctx} selection`, own);
        await ownTargets(page, results, `${ctx} selection`);
        log('bulk dialog');
        await page.locator(`${SCREEN} [data-people-bulk-message]`).click();
        await expect(page.locator('wiskey-message-dialog [data-msg-preview]')).toBeVisible();
        await page.locator('wiskey-message-dialog [data-msg-template="closure"]').click();
        await layerCheck(page, results, `${ctx} bulk dialog`, 'dialog');
        await page.locator('wiskey-message-dialog [data-msg-cancel]').click();
        await page.locator(`${SCREEN} [data-people-select-mode]`).click();
        log('drawer');
        await page.locator(`${SCREEN} [data-person-row="p3"]`).click();
        await expect(page.locator('wiskey-person-drawer [data-person-section="sensitive"]')).toBeVisible();
        await layerCheck(page, results, `${ctx} drawer details`, 'drawer');
        await page.locator('wiskey-person-drawer [data-person-tab="access"]').click();
        await layerCheck(page, results, `${ctx} drawer access`, 'drawer');
        await ownTargets(page, results, `${ctx} drawer`);
        await page.locator('wiskey-person-drawer [data-person-message]').click();
        await expect(page.locator('wiskey-message-dialog [data-msg-recipient]')).toBeVisible();
        await page.locator('wiskey-message-dialog [data-msg-template="closure"]').click();
        await layerCheck(page, results, `${ctx} message dialog`, 'dialog');
        await page.locator('wiskey-message-dialog [data-msg-cancel]').click();
        await page.keyboard.press('Escape');
        await expect(page.locator('wiskey-person-drawer sw-drawer[open]')).toHaveCount(0);
      }
    }
    const { byCls, lines } = summarize(results);
    expect(errors, 'page errors').toEqual([]);
    expect(results.length, `${runs} runs; ${JSON.stringify(byCls)}\n${lines.join('\n')}`).toBe(0);
  });
});
