import { test, expect, type Page } from '@playwright/test';
import { areaDetail, meBody, PERMS } from './guide-mocks';

// Owner report 2026-10-02 (Android Chrome, 390 px): on an area page the whole page ended up scrolled sideways (header, tabs and part of
// the content gone, the switches card clipped at the edge). The page must never overflow horizontally, whatever the chip row does.
//   SW_BASE_URL=http://127.0.0.1:5190/ npx playwright test tests/evidence-area-hscroll.spec.ts --project=mobile

const DEEP = `const deep = (root, sel) => { const f = root.querySelector(sel); if (f) return f; for (const e of root.querySelectorAll('*')) { if (e.shadowRoot) { const r = deep(e.shadowRoot, sel); if (r) return r; } } return null; };`;
const NAMES = ['הורים', 'מסדרון', 'כרמל', 'שירה', 'אורי', 'מקלחת הורים', 'חדר כביסה'];
const emptyCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };

async function install(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (b: unknown, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (p === 'me') return json(meBody(PERMS));
    const m = /^devices\/areas\/([^/]+)$/.exec(p);
    if (m) {
      const d = areaDetail() as Record<string, any>;
      const id = m[1];
      d.floor_areas = NAMES.map((n, i) => ({ area_id: `a${i}`, name: n, icon: null, counts: { ...emptyCounts, entities: 5 + i * 3 } }));
      const idx = Math.max(0, NAMES.length ? Number(id.slice(1)) : 0);
      d.area = { ...d.area, area_id: id, name: NAMES[idx] ?? 'אזור', floor_name: 'מגורים' };
      const sw = ['חימום רצפה', 'הורים מקלחת', 'לד נסתר', 'מגבות', 'ספוטים'].map((n, i) => ({ entity_id: `switch.s${i}`, name: n, domain: 'switch', device_class: null, state: i ? 'off' : 'on', available: true, fresh: true, active: !i, icon: null, last_changed: '2026-09-30T18:00:00Z', can_control: true }));
      d.cards.switches = { id: 'switches', label: 'מתגים', entities: sw, count: sw.length, active: 1 };
      return json(d);
    }
    return json({ code: 'not_found', user_message: 'nf', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

/** Every element that scrolls (crossing shadow roots) with its horizontal overflow, plus the document's. */
const overflow = (page: Page) =>
  page.evaluate(`(() => { ${DEEP}
    const out = [];
    const walk = (root) => { for (const e of root.querySelectorAll('*')) { if (e.scrollLeft !== 0) out.push({ tag: e.tagName.toLowerCase() + '.' + (e.className || ''), left: e.scrollLeft }); if (e.shadowRoot) walk(e.shadowRoot); } };
    walk(document);
    const de = document.documentElement;
    return { docLeft: de.scrollLeft, docOver: de.scrollWidth - de.clientWidth, scrolled: out, vw: innerWidth };
  })()`) as Promise<{ docLeft: number; docOver: number; scrolled: { tag: string; left: number }[]; vw: number }>;

test.describe('area page, phone: no sideways page scroll', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('activating the chips (last one included) leaves the page unscrolled sideways', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone only');
    await install(page);
    await page.goto('./?design=a#/devices/areas/a5');
    await page.waitForSelector('devices-area devices-area-nav .areas sw-chip');
    await page.waitForTimeout(800);
    const chips = page.locator('devices-area devices-area-nav .areas sw-chip');
    const n = await chips.count();
    expect(n).toBeGreaterThan(5);
    const check = async (label: string) => {
      const o = await overflow(page);
      const rowScroll = o.scrolled.filter((s) => !/areas/.test(s.tag));
      expect(o.docLeft, `${label}: document scrollLeft`).toBe(0);
      expect(rowScroll, `${label}: scrolled ancestors`).toEqual([]);
      const wide = await page.evaluate(`(() => { ${DEEP} const r = deep(document, 'devices-area').getBoundingClientRect(); return Math.round(r.width); })()`);
      expect(wide as number, `${label}: the screen is as wide as the viewport`).toBeLessThanOrEqual(o.vw + 1);
    };
    await check('initial');
    for (const i of [n - 1, 0, n - 2, n - 1]) {
      await chips.nth(i).scrollIntoViewIfNeeded();
      await chips.nth(i).click();
      await page.waitForTimeout(500);
      await check(`after chip ${i}`);
    }
    // the header block is still where it was (not dragged away)
    const top = await page.locator('devices-area devices-area-nav').boundingBox();
    expect(top!.x).toBeGreaterThanOrEqual(-1);
    expect(top!.x + top!.width).toBeLessThanOrEqual(391);
  });
});
