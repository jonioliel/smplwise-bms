import { test } from '@playwright/test';
import { installElectricityMock, PERMS, url } from './electricity-mocks';

test('debug picker row', async ({ page }) => {
  await installElectricityMock(page, { perms: PERMS.bills });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(url('/infra/electricity/meters?add=1', 'classic', 'light'));
  const row = page.locator('sw-app elec-meters-page [data-picker-item="sensor.bakery_daily"]');
  await row.waitFor();
  const res = await page.evaluate(() => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('infra-electricity')!.shadowRoot!.querySelector('elec-meters-page')!.shadowRoot!.querySelector('sw-dialog')!.querySelector('elec-meter-picker')!.shadowRoot!;
    const b = root.querySelector('[data-picker-item="sensor.bakery_daily"]')!;
    const r = (e: Element) => { const x = e.getBoundingClientRect(); return `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} ${Math.round(x.left)}..${Math.round(x.right)} w${Math.round(x.width)} disp=${getComputedStyle(e).display}`; };
    return [r(b), ...[...b.querySelectorAll('*')].map(r), 'list ' + r(b.parentElement!), 'scrollW ' + b.scrollWidth + ' client ' + b.clientWidth];
  });
  console.log(JSON.stringify(res, null, 1));
  await page.screenshot({ path: 'test-results/debug-row.png' });
});
