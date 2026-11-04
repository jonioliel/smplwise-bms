import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { FOLDS, foldGeometry, installCardsMock, openAccess, pageOverflow } from './settings-cards-mocks';

// SETTINGS-INTERCOM-CARDS-2401 (owner 04.11, round 19 Q6 = a; owner rule: no scrolling in control screens): Settings › "מתגי מסכי כניסה"
// in layout a (collapsible cards, the default) fits 1440x900 and 1366x768 with NO scroll while ANY one card is open - each card is opened
// in turn and measured: the page (document, the shell's main, the screen's wrapper, the screen) does not scroll, the open card does not
// scroll inside itself, its bottom and the last header are inside the window, and the header column has room for one more header (the
// acceptance-check card, drawn only for whoever may run it). Mocked backend (an administrator: every card has its real content), classic
// light. On the phone the cards stack with no sideways scroll and every header is a 44 px target.
//   ~/run_remote.sh spec <branch> tests/layout-settings-intercom-cards-2401.spec.ts --project=desktop --project=mobile
//   Every measurement is printed; CARDS_SHOTS=<dir> saves a screenshot per card and size.
const SIZES: [number, number][] = [[1440, 900], [1366, 768]];
const SHOTS = process.env.CARDS_SHOTS ?? '';
const HEAD_SLOT = 52; // one more header: 48 px + the 4 px gap

test.describe('layout a fits the screen with any one card open', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  for (const [w, h] of SIZES) {
    test(`${w}x${h}: every card, opened in turn, fits with no scroll`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'the sizes are set by the test itself');
      test.setTimeout(180_000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: w, height: h });
      await installCardsMock(page);
      await openAccess(page);
      await page.locator(`${FOLDS} [data-fold-toggle="screens"]`).waitFor({ timeout: 30_000 });
      // every component has reported (the call banner and the pairing card are drawn once read)
      await expect(page.locator(`${FOLDS} [data-fold-toggle="calls"]`)).toBeVisible({ timeout: 20_000 });
      await expect(page.locator(`${FOLDS} [data-fold-toggle="pairing"]`)).toBeVisible();
      const first = await foldGeometry(page);
      expect(first.wide, 'the open card stands beside the headers').toBe(true);
      expect(first.open, 'the first card is open on arrival').toBe('screens');
      const bad: string[] = [];
      const log: string[] = [];
      for (const id of first.heads) {
        await page.locator(`${FOLDS} [data-fold-toggle="${id}"]`).click();
        await page.mouse.move(0, 0);
        await expect(page.locator(`${FOLDS} [data-fold-toggle="${id}"]`)).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator(`${FOLDS} [aria-expanded="true"]`)).toHaveCount(1);
        // the card's content settles (loading rows, a read) before it is measured
        await page.waitForTimeout(400);
        await page.evaluate(() => document.fonts.ready);
        let o = await pageOverflow(page);
        await expect.poll(async () => { o = await pageOverflow(page); return Math.max(o.doc, o.main, o.wrap, o.screen); }, { timeout: 4_000 }).toBeLessThanOrEqual(1).catch(() => undefined);
        const g = await foldGeometry(page);
        const worst = Math.max(o.doc, o.main, o.wrap, o.screen);
        const line = `${id} @${w}x${h}: page ${worst} (doc ${o.doc} main ${o.main} wrap ${o.wrap} ${o.tag} ${o.screen}) · body ${g.bodyTop}-${g.bodyBottom} (${g.bodyH} px, inner overflow ${g.bodyInner}, scroll ${g.bodyScroll}) · last header ${g.lastHead} · window ${g.win}`;
        log.push(line);
        console.log(`SETTINGS-INTERCOM-CARDS-2401 ${line}`); // the receipts of the change note quote these lines
        if (SHOTS) {
          fs.mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: path.join(SHOTS, `cards-${id}-${w}x${h}.png`) });
        }
        if (worst > 1) bad.push(`${id}: the page scrolls ${worst} px`);
        if (g.bodyScroll || g.bodyInner > 1) bad.push(`${id}: the open card scrolls inside (${g.bodyInner} px)`);
        if (g.bodyBottom > g.win) bad.push(`${id}: the open card ends at ${g.bodyBottom} > ${g.win}`);
        if (g.lastHead > g.win) bad.push(`${id}: the last header ends at ${g.lastHead} > ${g.win}`);
        if (!g.heads.includes('validation') && g.lastHead + HEAD_SLOT > g.win) bad.push(`${id}: no room for the acceptance-check header (${g.lastHead} + ${HEAD_SLOT} > ${g.win})`);
      }
      info.annotations.push({ type: 'measure', description: log.join('\n') });
      expect(bad, `layout a at ${w}x${h}`).toEqual([]);
    });
  }
});

test.describe('layout a on a phone', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('the cards stack, no sideways scroll, every header is a 44 px target; a tap opens one card and a second tap folds it', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'a phone behaviour');
    await installCardsMock(page);
    await openAccess(page);
    await page.locator(`${FOLDS} [data-fold-toggle="screens"]`).waitFor({ timeout: 30_000 });
    await expect(page.locator(`${FOLDS} [data-fold-toggle="calls"]`)).toBeVisible({ timeout: 20_000 });
    let g = await foldGeometry(page);
    expect(g.wide).toBe(false);
    expect(g.docW, 'no sideways scroll').toBeLessThanOrEqual(0);
    for (const hh of g.headH) expect(hh).toBeGreaterThanOrEqual(44);
    for (const id of g.heads) {
      await page.locator(`${FOLDS} [data-fold-toggle="${id}"]`).click();
      await expect(page.locator(`${FOLDS} [data-fold-toggle="${id}"]`)).toHaveAttribute('aria-expanded', 'true');
      g = await foldGeometry(page);
      expect(g.docW, `${id}: no sideways scroll`).toBeLessThanOrEqual(0);
      if (SHOTS) {
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS, `cards-${id}-390.png`), fullPage: true });
      }
    }
    const last = g.heads[g.heads.length - 1];
    await page.locator(`${FOLDS} [data-fold-toggle="${last}"]`).click();
    await expect(page.locator(`${FOLDS} [aria-expanded="true"]`)).toHaveCount(0);
  });
});
