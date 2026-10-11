import { test, expect, type Page } from '@playwright/test';
import { areaDetail, meBody, PERMS } from './guide-mocks';

// Owner report 2026-10-02 (Android Chrome, 390 px): on an area page the whole page ended up scrolled sideways (header, tabs and part of
// the content gone, the switches card clipped at the edge). The page must never overflow horizontally, whatever the area navigation does
// (since the HOME polish of 2026-10-10: the floor and the area pickers, the areas in the area picker's bottom sheet).
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

  // HOME polish (owner 2026-10-10): the floor's areas are no longer a scrollable chip row on the phone but the list of the area picker
  // (a bottom sheet); the guarantee is the same - choosing any area, the last one included, never leaves the page scrolled sideways,
  // and now nothing at all may be scrolled sideways (there is no chip row left whose own scroll was allowed).
  test('choosing areas from the area picker (last one included) leaves the page unscrolled sideways', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone only');
    await install(page);
    await page.goto('./?design=a#/devices/areas/a5');
    const nav = page.locator('devices-area devices-area-nav');
    const picker = nav.locator('[data-crumb="area"]');
    await expect(picker).toBeVisible();
    await page.waitForTimeout(800);
    const options = nav.locator('[data-nav-menu="area"] [data-nav-option]');
    await picker.click();
    await expect(options).toHaveCount(NAMES.length); // the floor's seven areas
    await page.keyboard.press('Escape'); // shut again (focus is on the picker)
    await expect(options).toHaveCount(0);
    const n = NAMES.length;
    const check = async (label: string) => {
      const o = await overflow(page);
      expect(o.docLeft, `${label}: document scrollLeft`).toBe(0);
      expect(o.docOver, `${label}: document wider than the viewport`).toBeLessThanOrEqual(0);
      expect(o.scrolled, `${label}: scrolled ancestors`).toEqual([]);
      const wide = await page.evaluate(`(() => { ${DEEP} const r = deep(document, 'devices-area').getBoundingClientRect(); return Math.round(r.width); })()`);
      expect(wide as number, `${label}: the screen is as wide as the viewport`).toBeLessThanOrEqual(o.vw + 1);
      // the two pickers stay inside the viewport
      for (const c of ['floor', 'area']) {
        const b = (await nav.locator(`[data-crumb="${c}"]`).boundingBox())!;
        expect(b.x, `${label}: ${c} picker left edge`).toBeGreaterThanOrEqual(-1);
        expect(b.x + b.width, `${label}: ${c} picker right edge`).toBeLessThanOrEqual(o.vw + 1);
      }
    };
    await check('initial');
    for (const i of [n - 1, 0, n - 2, n - 1]) {
      await picker.click();
      await options.nth(i).click();
      await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#/devices/areas/a${i}`);
      await expect(picker.locator('h1')).toHaveText(NAMES[i]);
      await page.waitForTimeout(500);
      await check(`after area ${i}`);
    }
    // the header block is still where it was (not dragged away)
    const top = await page.locator('devices-area devices-area-nav').boundingBox();
    expect(top!.x).toBeGreaterThanOrEqual(-1);
    expect(top!.x + top!.width).toBeLessThanOrEqual(391);
  });
});
