import { test, expect, type Page } from '@playwright/test';
import { areaDetail, installBubbleMock } from './bubble-mocks';
import { ENTITY_ID_SCAN_RE } from '../src/i18n/entity-label';
import { skinsUnderTest } from './helpers/frozen-skins';

// ENTIDSWEEP-295 (owner 2026-10-20): the REAL area screen (mocked backend, synthetic names) renders no Home Assistant entity id in any
// visible text, title, aria-label, placeholder or alt - even when the server sends a row whose name IS its id or is empty.
// Elements marked data-tech-id (an administrator's explicit technical line) are exempt; data-* attributes are not text.
//   SW_API_PORT=59997 npx vite --host 127.0.0.1 --port 5215   then
//   SW_BASE_URL=http://127.0.0.1:5215/ npx playwright test tests/layout-entity-id-scan.spec.ts --project=desktop --workers=1

async function scan(page: Page): Promise<string[]> {
  return page.evaluate((src) => {
    const re = new RegExp(src);
    const hits: string[] = [];
    const walk = (root: ParentNode) => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.closest('[data-tech-id]')) continue;
        for (const a of ['title', 'aria-label', 'placeholder', 'alt']) {
          const v = el.getAttribute(a);
          if (v && re.test(v)) hits.push(`${el.tagName.toLowerCase()}[${a}]=${v}`);
        }
        for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && n.textContent && re.test(n.textContent)) hits.push(`${el.tagName.toLowerCase()} text=${n.textContent.trim().slice(0, 80)}`);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return hits;
  }, ENTITY_ID_SCAN_RE.source);
}

test('area screen: no entity id in text / title / aria, also for rows named by their id', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one project is enough');
  await installBubbleMock(page);
  // layered on top of the shared mock: two rows the server could not name
  await page.route('**/api/v1/devices/areas/living', async (route) => {
    const d = areaDetail('living');
    d.cards.lighting.entities[0].name = 'light.living_main';
    d.cards.sensors.entities[0].name = '';
    (d.cards.sensors.entities[0] as Record<string, unknown>).device_name = 'חיישן סלון';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  });
  for (const skin of skinsUnderTest(['bubble', 'default'])) {
    await page.goto('about:blank');
    await page.goto(`/?design=a&skin=${skin}&scheme=light#/devices/areas/living`);
    await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('devices-area')?.shadowRoot?.querySelector('[data-entity]'), undefined, { timeout: 20_000 });
    await page.waitForTimeout(300);
    expect(await scan(page), `entity ids rendered (${skin})`).toEqual([]);
  }
});
