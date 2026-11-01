import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// SYNOPTIC-HA-2310: the building cross-section beside the floor cards and the synoptic map, worst case (1 / 3 / 12 / 24 floors, no data,
// long names), desktop and phone, light and dark. Static demo build, no backend. SHOT_PHASE=before|after picks the evidence folder;
// the layout assertions run in the "after" phase only (the "before" run is the record of the reported problems).

const PHASE = process.env.SHOT_PHASE === 'before' ? 'before' : 'after';
const OUT = join(process.cwd(), '..', 'docs', 'evidence', 'SYNOPTIC-HA-2310', PHASE);
mkdirSync(OUT, { recursive: true });

const FLOORS = '/#/explore/buildings/b1/floors';
const SYN = '/#/devices/synoptic';

async function open(page: Page, url: string, dark: boolean) {
  if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(url);
  await page.reload();
  if (dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(700);
}

const CASES: { id: string; q: string }[] = [
  { id: 'n1', q: 'xsdemo=1' },
  { id: 'n3', q: 'xsdemo=3' },
  { id: 'n12', q: 'xsdemo=12' },
  { id: 'n24', q: 'xsdemo=24' },
  { id: 'n3-nodata', q: 'xsdemo=3&xsdata=none' },
  { id: 'n12-nodata', q: 'xsdemo=12&xsdata=none' },
  { id: 'n5-long', q: 'xsdemo=5&xsnames=long' },
  { id: 'n5-ha', q: 'xsdemo=5&xsdata=ha' },
];

for (const dark of [false, true]) {
  for (const c of CASES) {
    test(`floors + section ${c.id}${dark ? ' dark' : ''}`, async ({ page }, info) => {
      test.skip(info.project.name === 'tablet', 'desktop and phone only');
      await open(page, `${FLOORS}?${c.q}`, dark);
      await expect(page.locator('[data-floor-card]').first()).toBeVisible();
      await page.screenshot({ path: join(OUT, `floors-${c.id}-${info.project.name}${dark ? '-dark' : ''}.png`) });
      if (PHASE !== 'after' || info.project.name !== 'desktop') return;
      // above 16 floors the cards take two columns: the section then fills its own panel top-down (no line to line up with)
      if (c.id === 'n24') {
        await expect(page.locator('[data-xs-aligned]')).toHaveCount(0);
        await expect(page.locator('[data-xsection]')).toBeVisible();
        return;
      }
      await expect(page.locator('[data-xs-aligned]')).toBeVisible();
      // the rows line up with the cards beside them (same top and height, 2 px tolerance), and nothing scrolls
      const pairs = await page.evaluate(() => {
        const host = document.querySelector('sw-app')?.shadowRoot ?? document;
        const deep = (root: Document | ShadowRoot, sel: string): Element[] => {
          const out: Element[] = [...root.querySelectorAll(sel)];
          root.querySelectorAll('*').forEach((el) => { if ((el as HTMLElement).shadowRoot) out.push(...deep((el as HTMLElement).shadowRoot!, sel)); });
          return out;
        };
        const cards = deep(host as Document, '[data-floor-card]');
        const rows = deep(host as Document, '[data-xs-row]');
        return cards.map((cd) => {
          const id = cd.getAttribute('data-floor-card');
          const rw = rows.find((r) => r.getAttribute('data-xs-row') === id);
          const a = cd.getBoundingClientRect();
          const b = rw?.getBoundingClientRect();
          return { id, ct: a.top, ch: a.height, rt: b?.top ?? -1, rh: b?.height ?? -1 };
        });
      });
      for (const p of pairs) {
        expect(Math.abs(p.ct - p.rt), `row ${p.id} top`).toBeLessThanOrEqual(2);
        expect(Math.abs(p.ch - p.rh), `row ${p.id} height`).toBeLessThanOrEqual(2);
      }
      const doc = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(doc).toBeLessThanOrEqual(1);
    });

    test(`synoptic ${c.id}${dark ? ' dark' : ''}`, async ({ page }, info) => {
      test.skip(info.project.name === 'tablet', 'desktop and phone only');
      test.skip(c.id === 'n1' || c.id === 'n3' || c.id === 'n12', 'the board matrix: no data, long names, matched and 24 floors');
      await open(page, `${SYN}?${c.q}`, dark);
      await expect(page.locator('[data-syn-board]')).toBeVisible();
      await page.screenshot({ path: join(OUT, `synoptic-${c.id}-${info.project.name}${dark ? '-dark' : ''}.png`) });
    });
  }
}

test.describe('home-system link (after)', () => {
  test.skip(PHASE !== 'after', 'new in this change');

  test('synoptic: each row says which home-system floor it stands for and how; the unlinked floor is hinted once and links to the editor', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    await open(page, `${SYN}?xsdemo=5&xsdata=ha`, false);
    await expect(page.locator('[data-syn-board]')).toBeVisible();
    await expect(page.locator('[data-syn-match="level"]')).toHaveCount(3);
    await expect(page.locator('[data-syn-match="name"]')).toHaveCount(1);
    await expect(page.locator('[data-syn-match="none"]')).toHaveCount(1);
    await expect(page.locator('[data-syn-hint]')).toHaveCount(1);
    if (info.project.name === 'mobile') {
      // a phone hides the structure tools (ui.mobile hide_structure, default on): the hint says it, without a link
      await expect(page.locator('[data-syn-link]')).toHaveCount(0);
      return;
    }
    await page.locator('[data-syn-link]').click();
    await expect(page).toHaveURL(/explore\/buildings\/.+\/floors\?.*ha=/);
    await expect(page.locator('[data-home-link] select[data-home-add]')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `home-link-editor-${info.project.name}.png`) });
  });

  test('floors screen: nothing matches -> one quiet hint under the section, its link opens the editor; the editor adds and removes areas live', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the section beside the cards is a computer layout');
    await open(page, `${FLOORS}?xsdemo=3&xsdata=none`, false);
    await expect(page.locator('[data-xs-aligned]')).toBeVisible();
    await expect(page.locator('[data-xs-hint]')).toHaveCount(1);
    // no placeholder facade on a floor without data, no stray chip
    await expect(page.locator('[data-xs-row] .fac')).toHaveCount(0);
    await expect(page.locator('[data-xs-row] .chip')).toHaveCount(0);
    await page.locator('[data-xs-link]').click();
    const dlg = page.locator('[data-home-link]');
    await expect(dlg.locator('select[data-home-add]')).toBeVisible();
    await expect(dlg.locator('[data-home-area]')).toHaveCount(0);
    // add an area by hand -> it is listed as "by hand"
    const add = dlg.locator('select[data-home-add]');
    const first = await add.locator('option').nth(1).getAttribute('value');
    await add.selectOption(first!);
    await expect(dlg.locator(`[data-home-area="${first}"] .tag[data-src="manual"]`)).toBeVisible();
    // assign a home-system floor by hand -> its areas come in, marked as the set floor
    await dlg.locator('select[data-home-floor-add]').selectOption({ index: 1 });
    await expect(dlg.locator('[data-home-floor]')).toHaveCount(1);
    await expect(dlg.locator('.tag[data-src="link"]').first()).toBeVisible();
    const before = await dlg.locator('[data-home-area]').count();
    await dlg.locator('[data-home-area]').filter({ has: page.locator('.tag[data-src="link"]') }).first().locator('[data-home-remove]').click();
    await expect(dlg.locator('[data-home-area]')).toHaveCount(before - 1);
    await expect(dlg.locator('[data-home-excluded]')).toHaveCount(1);
    await page.screenshot({ path: join(OUT, 'home-link-editor-edited-desktop.png') });
  });
});
