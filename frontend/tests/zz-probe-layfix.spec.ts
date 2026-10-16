import { test } from '@playwright/test';
import { url } from './tickets-mocks';
import { CID, installCostsTabMock } from './tickets-costs-tab-mocks';

test('probe', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await installCostsTabMock(page, 'quote');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url(`/tickets/all?t=${CID}&tab=costs`, 'classic', 'light'));
  await page.waitForSelector('sw-app tickets-list ticket-detail ticket-costs-tab [data-costs-tab]:not([data-costs-state="loading"])', { timeout: 20000 });
  for (const w of [768, 360]) {
    await page.setViewportSize({ width: w, height: 1000 });
    await page.waitForTimeout(300);
    const info2 = await page.evaluate(() => {
      const find = (root: ParentNode, sel: string): Element | null => {
        for (const el of Array.from(root.querySelectorAll('*'))) {
          if (el.matches(sel)) return el;
          if (el.shadowRoot) { const f = find(el.shadowRoot, sel); if (f) return f; }
        }
        return null;
      };
      const r = (e: Element | null) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
      const fold = find(document, '[data-requirement-fold]');
      const body = fold?.querySelector('.foldbody') ?? null;
      const kinds = find(document, '[data-kinds-fold]');
      const panel = find(document, 'ticket-detail')?.shadowRoot?.querySelector('.panel') ?? null;
      const ct = find(document, '[data-costs-tab]');
      return { panelCls: panel?.className, panel: r(panel), ct: r(ct), reqOpen: (fold as HTMLDetailsElement | null)?.open, fold: r(fold), body: r(body), kinds: r(kinds), kOpen: (kinds as HTMLDetailsElement | null)?.open, kbody: r(kinds?.querySelector('.foldbody') ?? null), ua: navigator.userAgent };
    });
    console.log('PROBE', w, JSON.stringify(info2));
  }
});
