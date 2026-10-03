import { test } from '@playwright/test';
import { installElectricityMock, PERMS, url } from './electricity-mocks';

test('debug overflow', async ({ page }) => {
  await installElectricityMock(page, { perms: PERMS.bills });
  for (const skin of ['bubble', 'classic']) {
    await page.goto('about:blank');
    await page.goto(url('/infra/electricity/meters', skin, 'light'));
    await page.waitForSelector('sw-app elec-meters-page [data-state="ready"]');
    const res = await page.evaluate(() => {
      const main = document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!;
      const mr = main.getBoundingClientRect();
      const out: string[] = [`main client ${main.clientWidth} scroll ${main.scrollWidth} rect ${Math.round(mr.left)}..${Math.round(mr.right)} vw ${innerWidth}`];
      const walk = (root: Document | ShadowRoot | Element) => {
        for (const el of root.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > mr.right + 1 || r.left < mr.left - 1)) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${Math.round(r.left)}..${Math.round(r.right)} w${Math.round(r.width)}`);
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document.querySelector('sw-app')!.shadowRoot!);
      return out.slice(0, 25);
    });
    console.log(skin, JSON.stringify(res, null, 1));
  }
});
