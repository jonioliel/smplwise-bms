import { test, expect, type Page } from '@playwright/test';
import { D, FOLDS, installCardsMock, openAccess, pageOverflow } from './settings-cards-mocks';

// SETTINGS-CARDS-ACCORDION-2402 (owner 04.11 night, round 20 Q2 = a): Settings › "מתגי מסכי כניסה" with `access.settings_layout` =
// accordion - the cards open IN PLACE, one at a time, on a desktop too. At 1440x900 and 1366x768 every card is opened in turn: one card
// open, its content right under its own header and above the next header, one column, and NO sideways scroll anywhere (the page, the
// shell's main, the cards); the page may scroll vertically (the owner accepted it for this layout) - the amount is printed. A second
// press folds the card. The layout row switches cards -> accordion. On the phone the accordion is the same as the cards (the phone layout
// does not change). Mocked backend (an administrator), classic light.
//   ~/run_remote.sh spec <branch> tests/layout-settings-cards-accordion-2402.spec.ts --project=desktop --project=mobile
const SIZES: [number, number][] = [[1440, 900], [1366, 768]];

const geometry = (page: Page) =>
  page.evaluate(() => {
    const app = document.querySelector('sw-app')?.shadowRoot;
    const main = app?.querySelector('main') as HTMLElement | null;
    const diag = app?.querySelector('system-diagnostics');
    const fold = diag?.shadowRoot?.querySelector('sw-fold-cards') as HTMLElement | null;
    const list = fold?.shadowRoot?.querySelector('.list') as HTMLElement | null;
    const heads = [...(fold?.shadowRoot?.querySelectorAll<HTMLElement>('.head') ?? [])].filter((h) => !h.hidden);
    const open = heads.find((h) => h.getAttribute('aria-expanded') === 'true');
    const id = open?.dataset.foldToggle ?? '';
    const body = id ? (diag?.shadowRoot?.querySelector<HTMLElement>(`.afold-body[data-access-fold="${id}"]`) ?? null) : null;
    const i = open ? heads.indexOf(open) : -1;
    const next = i >= 0 && i + 1 < heads.length ? heads[i + 1].getBoundingClientRect() : null;
    const se = document.scrollingElement!;
    const sideways = (el: Element | null | undefined) => (el ? el.scrollWidth - el.clientWidth : 0);
    return {
      inplace: fold?.hasAttribute('inplace') ?? false,
      wide: list?.dataset.foldWide === 'true',
      heads: heads.map((h) => h.dataset.foldToggle ?? ''),
      headH: heads.map((h) => Math.round(h.getBoundingClientRect().height)),
      lefts: [...new Set(heads.map((h) => Math.round(h.getBoundingClientRect().left)))],
      open: id,
      headBottom: open ? Math.round(open.getBoundingClientRect().bottom) : 0,
      bodyTop: body ? Math.round(body.getBoundingClientRect().top) : 0,
      bodyBottom: body ? Math.round(body.getBoundingClientRect().bottom) : 0,
      bodyLeft: body ? Math.round(body.getBoundingClientRect().left) : 0,
      nextTop: next ? Math.round(next.top) : null,
      bodyScroll: !!body?.hasAttribute('data-fold-scroll'),
      side: { doc: sideways(se), main: sideways(main), fold: sideways(fold), body: sideways(body) },
    };
  });

test.describe('layout "כרטיסים: נפתחים במקום" (accordion) on a desktop', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  for (const [w, h] of SIZES) {
    test(`${w}x${h}: every card opens in place under its header, one at a time, never sideways`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'the sizes are set by the test itself');
      test.setTimeout(180_000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: w, height: h });
      await installCardsMock(page, { layout: 'accordion' });
      await openAccess(page);
      await page.locator(`${FOLDS} [data-fold-toggle="screens"]`).waitFor({ timeout: 30_000 });
      await expect(page.locator(`${FOLDS} [data-fold-toggle="calls"]`)).toBeVisible({ timeout: 20_000 });
      await expect(page.locator(`${D} sw-fold-cards[data-access-layout="accordion"][inplace]`)).toHaveCount(1);
      const first = await geometry(page);
      expect(first.wide, 'one column at a desktop width').toBe(false);
      expect(first.lefts, 'every header starts at the same edge').toHaveLength(1);
      expect(first.open, 'the first card is open on arrival').toBe('screens');
      const bad: string[] = [];
      for (const id of first.heads) {
        const head = page.locator(`${FOLDS} [data-fold-toggle="${id}"]`);
        if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
        await page.mouse.move(0, 0);
        await expect(head).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator(`${FOLDS} [aria-expanded="true"]`)).toHaveCount(1);
        await page.waitForTimeout(400);
        const g = await geometry(page);
        const o = await pageOverflow(page);
        const line = `${id} @${w}x${h}: header bottom ${g.headBottom} · card ${g.bodyTop}-${g.bodyBottom} · next header ${g.nextTop ?? '-'} · vertical page scroll ${Math.max(o.doc, o.main, o.wrap, o.screen)} · sideways ${JSON.stringify(g.side)}`;
        console.log(`SETTINGS-CARDS-ACCORDION-2402 ${line}`);
        if (g.bodyTop < g.headBottom) bad.push(`${id}: the card starts above its header`);
        if (g.nextTop !== null && g.nextTop < g.bodyBottom) bad.push(`${id}: the next header is not below the card`);
        if (g.bodyLeft !== first.lefts[0]) bad.push(`${id}: the card is not in the column (${g.bodyLeft} vs ${first.lefts[0]})`);
        if (g.bodyScroll) bad.push(`${id}: the card scrolls inside itself`);
        for (const [k, v] of Object.entries(g.side)) if (v > 0) bad.push(`${id}: ${k} scrolls sideways (${v} px)`);
      }
      expect(bad, `accordion at ${w}x${h}`).toEqual([]);
      // a second press folds the open card: all closed
      const last = first.heads[first.heads.length - 1];
      await page.locator(`${FOLDS} [data-fold-toggle="${last}"]`).click();
      await expect(page.locator(`${FOLDS} [aria-expanded="true"]`)).toHaveCount(0);
    });
  }

  test('the layout row: "כרטיסים: כותרות בצד" -> "כרטיסים: נפתחים במקום" and back', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one project');
    const m = await installCardsMock(page);
    await openAccess(page);
    await expect(page.locator(`${D} sw-fold-cards[data-access-layout="cards"]:not([inplace])`)).toHaveCount(1, { timeout: 30_000 });
    await page.locator(`${FOLDS} [data-fold-toggle="area"]`).click();
    const layout = page.locator(`${D} select[data-set-access-layout]`);
    await expect(layout.locator('option')).toHaveText(['כרטיסים: כותרות בצד (ברירת מחדל)', 'כרטיסים: נפתחים במקום', 'שתי לשוניות', 'רשימה אחת']);
    await layout.selectOption('accordion');
    await page.locator(`${D} sw-button[data-save-access-area] button`).click();
    await expect.poll(() => m.access.patches.at(-1)).toEqual({ 'access.settings_layout': 'accordion' });
    await expect(page.locator(`${D} sw-fold-cards[data-access-layout="accordion"][inplace]`)).toHaveCount(1);
    await expect(page.locator(`${FOLDS} [data-fold-summary="area"]`)).toHaveText('האזור מוצג · הטמעה בטלפון: כבויה · כרטיסים: נפתחים במקום');
    // the area card stays open after the switch (the same card, now in place)
    await expect(page.locator(`${FOLDS} [data-fold-toggle="area"]`)).toHaveAttribute('aria-expanded', 'true');
    await page.locator(`${D} select[data-set-access-layout]`).selectOption('cards');
    await page.locator(`${D} sw-button[data-save-access-area] button`).click();
    await expect(page.locator(`${D} sw-fold-cards[data-access-layout="cards"]:not([inplace])`)).toHaveCount(1);
  });
});

test.describe('the phone layout does not change', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('accordion and cards draw the same stacked cards on a phone', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'a phone behaviour');
    const measure = async (layout: 'cards' | 'accordion') => {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await installCardsMock(page, { layout });
      await openAccess(page);
      await page.locator(`${FOLDS} [data-fold-toggle="screens"]`).waitFor({ timeout: 30_000 });
      await expect(page.locator(`${FOLDS} [data-fold-toggle="calls"]`)).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(300);
      const g = await geometry(page);
      return { wide: g.wide, heads: g.heads, headH: g.headH, lefts: g.lefts, open: g.open, card: [g.bodyTop, g.bodyBottom], side: g.side };
    };
    const cards = await measure('cards');
    const accordion = await measure('accordion');
    expect(cards.wide).toBe(false);
    expect(accordion).toEqual(cards);
    for (const v of Object.values(accordion.side)) expect(v).toBeLessThanOrEqual(0);
  });
});
