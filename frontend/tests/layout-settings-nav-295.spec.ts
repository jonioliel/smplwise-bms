import { test, expect, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// PHONENAV-295 (owner 2026-10-21), demo mode (no backend), phone project:
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-settings-nav-295.spec.ts --project=mobile --workers=1
// On a phone Settings keeps the scrolling tab row by default; a personal preference (Settings > General > Tabs) switches it to one
// dropdown whose rows are 44 px, list every sub-page and show the current one. At desktop width the preference changes nothing.
// The tickets (service requests) module is irrelevant here: neither mode offers a ticket action. Screenshots: docs/design/evidence/PHONENAV-295/.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/PHONENAV-295');

interface Probe { variant: string | null; chipH: number; items: number }

/** The settings strip (through shadow roots): its presentation and, in the dropdown form, the chip's box. */
async function strip(page: Page): Promise<Probe | null> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot, sel: string): Element | null => {
      const hit = root.querySelector(sel);
      if (hit) return hit;
      for (const x of root.querySelectorAll('*')) {
        if (x.shadowRoot) {
          const r = find(x.shadowRoot, sel);
          if (r) return r;
        }
      }
      return null;
    };
    const tabs = find(document, 'sw-tabs[data-settings-tabs]') as (HTMLElement & { items?: unknown[] }) | null;
    if (!tabs) return null;
    const dd = tabs.shadowRoot?.querySelector('sw-dropdown') as HTMLElement | null;
    const chip = dd?.shadowRoot?.querySelector('button') as HTMLElement | null;
    return { variant: tabs.getAttribute('data-variant'), chipH: chip ? chip.getBoundingClientRect().height : 0, items: tabs.items?.length ?? 0 };
  });
}

async function go(page: Page, hash: string) {
  await page.goto(`./?skin=domus&scheme=light#${hash}`);
  await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('main'));
  await page.waitForTimeout(1500);
}

/** Pick a mode in the personal card (a real click on the radio), then reload the settings front page. */
async function choose(page: Page, mode: 'tabs' | 'dropdown') {
  await go(page, '/system/diagnostics?tab=tabs');
  await page.locator(`input[data-settings-nav="${mode}"]`).check();
  await expect(page.locator('[data-settings-nav-card] [role="status"]')).toBeVisible();
  await go(page, '/system/diagnostics?tab=general'); // a fresh load: the choice is remembered for this user
}

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== 'mobile', 'the phone navigation is a 390 px behaviour');
  fs.mkdirSync(OUT, { recursive: true });
});

test('default: the scrolling tab row, no dropdown', async ({ page }) => {
  await go(page, '/system/diagnostics?tab=general');
  const s = await strip(page);
  expect(s?.variant).not.toBe('dropdown');
  await expect(page.locator('sw-tabs[data-settings-tabs] >> sw-dropdown')).toHaveCount(0);
  await page.screenshot({ path: path.join(OUT, '01-phone-tab-row.png') });
});

test('the card offers both modes, tab row selected by default, no hint paragraph', async ({ page }) => {
  await go(page, '/system/diagnostics?tab=tabs');
  const card = page.locator('[data-settings-nav-card]');
  await expect(card.locator('input[type=radio]')).toHaveCount(2);
  await expect(card.locator('input[data-settings-nav="tabs"]')).toBeChecked();
  expect(await card.locator('p, .sub, .hint').count()).toBe(0);
  await page.screenshot({ path: path.join(OUT, '02-phone-preference-card.png') });
});

test('dropdown: one select, 44 px chip and rows, every sub-page listed, current one shown; switching back restores the row', async ({ page }) => {
  await choose(page, 'dropdown');
  const s = await strip(page);
  expect(s?.variant).toBe('dropdown');
  expect(s!.chipH).toBeGreaterThanOrEqual(44);
  const chip = page.locator('sw-tabs[data-settings-tabs] >> sw-dropdown >> button').first();
  const before = ((await chip.textContent()) ?? '').trim();
  expect(before.length).toBeGreaterThan(0);
  await chip.click();
  await settle(page); // the open list grows from 97 % (R5 motion): measure it at rest
  const opts = page.locator('sw-tabs[data-settings-tabs] >> sw-dropdown >> [role="option"]');
  await expect(opts).toHaveCount(s!.items);
  const hs = await opts.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  for (const h of hs) expect(h).toBeGreaterThanOrEqual(44);
  const selected = page.locator('sw-tabs[data-settings-tabs] >> sw-dropdown >> [role="option"][aria-selected="true"]');
  await expect(selected).toHaveCount(1);
  await expect(selected).toContainText(before);
  await page.screenshot({ path: path.join(OUT, '03-phone-dropdown-open.png') });
  await opts.nth(2).click();
  await page.waitForTimeout(600);
  expect(((await chip.textContent()) ?? '').trim()).not.toBe(before);
  await page.screenshot({ path: path.join(OUT, '04-phone-dropdown-other-page.png') });

  await choose(page, 'tabs');
  expect((await strip(page))?.variant).not.toBe('dropdown');
});

test('a wide screen ignores the preference', async ({ page }) => {
  await choose(page, 'dropdown');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(600);
  expect((await strip(page))?.variant).not.toBe('dropdown');
});
