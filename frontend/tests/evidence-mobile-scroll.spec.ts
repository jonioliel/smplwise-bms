import { test, expect, type Page } from '@playwright/test';

// Owner reports 2026-10-01 (phone): (1) "in the multimedia screen the scrolling jumps", (2) "after tapping the search the pages can no
// longer be scrolled". Measurable regressions, in demo mode with 24 extra screens over five floors:
//  - the sticky header compacts at scrollTop > 60 WITHOUT changing the height it takes in the flow (it used to shrink by ~180 px, which
//    moved every card under the finger, clamped the scroll back under the threshold and expanded it again: the list jumped back and forth)
//  - a state push (the poll) does not move the list
//  - the search popover has no full-screen layer: a swipe that starts outside it scrolls and closes it, a tap closes without pressing
//    what was under the finger, a route change closes it; two overlapping drawers hand the scroll lock back
//   SW_BASE_URL=http://127.0.0.1:4751 npx playwright test tests/evidence-mobile-scroll.spec.ts --project=mobile

const MOCK_URL = '/src/api/media-screens-mock.ts';

/** `querySelector` through open shadow roots (as source text for page.evaluate). */
const DEEP = `const deep = (root, sel) => { const f = root.querySelector(sel); if (f) return f; for (const e of root.querySelectorAll('*')) { if (e.shadowRoot) { const r = deep(e.shadowRoot, sel); if (r) return r; } } return null; };`;

async function many(page: Page, n = 24) {
  await page.goto('./');
  await page.evaluate(
    async ([url, count]) => {
      const mod = await import(/* @vite-ignore */ url);
      mod.resetMediaMock();
      const m = mod.mediaMock();
      const base = m.rows.slice();
      const floors = [['קומת קרקע', 'g'], ['קומה 1', 'u1'], ['מרתף', 'b'], ['קומה 2', 'u2'], ['גג', 'r']];
      for (let i = 0; i < (count as number); i++) {
        const c = structuredClone(base[i % base.length]);
        c.device.key = `md-x${i}`;
        c.device.name = `מסך ${i}`;
        const f = floors[i % floors.length];
        c.device.floor_id = f[1];
        c.device.floor_name = f[0];
        c.device.area_id = `a${i % 7}`;
        c.device.area_name = `חדר ${i % 7}`;
        m.rows.push(c);
      }
    },
    [MOCK_URL, n] as const,
  );
  await page.evaluate(() => {
    location.hash = '#/multimedia/screens';
  });
  await page.waitForSelector('multimedia-screens [data-screen-card]');
  await page.waitForTimeout(1200);
}

interface Probe { st: number; cardTop: number; hdr: number; compact: boolean; max: number }
const probe = (page: Page) =>
  page.evaluate(`(() => { ${DEEP}
    const ms = deep(document, 'multimedia-screens'); const root = ms.shadowRoot;
    const card = root.querySelector('media-screen-card'); const dh = root.querySelector('.dh');
    return { st: ms.scrollTop, cardTop: card.getBoundingClientRect().top, hdr: dh.getBoundingClientRect().height, compact: dh.classList.contains('compact'), max: ms.scrollHeight - ms.clientHeight };
  })()`) as Promise<Probe>;

for (const [w, h] of [[390, 844], [360, 740]] as const) {
  test.describe(`multimedia screens, ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test('stepping the list down and up never jumps: a card moves exactly as far as the scroll, the header keeps its height', async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'phone only');
      await many(page);
      await page.mouse.move(w / 2, h / 2);
      const first = await probe(page);
      expect(first.max).toBeGreaterThan(1500); // many screens: a long list
      let prev = first;
      let worst = 0;
      let compacted = false;
      const walk = async (dy: number, steps: number) => {
        for (let i = 0; i < steps; i++) {
          await page.mouse.wheel(0, dy);
          await page.waitForTimeout(260);
          const p = await probe(page);
          const shift = p.cardTop - prev.cardTop + (p.st - prev.st); // 0 when the card moved exactly with the scroll
          worst = Math.max(worst, Math.abs(shift));
          expect(Math.abs(p.hdr - first.hdr), `header height at scrollTop ${p.st}`).toBeLessThanOrEqual(2);
          compacted ||= p.compact;
          prev = p;
        }
      };
      await walk(15, 14); // crossing the 60 px threshold in small steps (the old code fell back to 0 here)
      await walk(220, 5);
      for (let i = 0; i < 80 && prev.st > 0; i++) await walk(-30, 1); // and back up through the threshold, expanding again
      expect(compacted).toBe(true);
      expect(prev.compact).toBe(false);
      info.annotations.push({ type: 'worst-shift-px', description: String(worst) });
      expect(worst).toBeLessThanOrEqual(2);
    });

    test('a state push (the poll) while the list is scrolled does not move it', async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'phone only');
      await many(page);
      await page.mouse.move(w / 2, h / 2);
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(500);
      const a = await probe(page);
      expect(a.st).toBeGreaterThan(600);
      // the screens change their state; the page re-reads on its own (poll) and on focus
      await page.evaluate(async (url) => {
        const m = (await import(/* @vite-ignore */ url)).mediaMock();
        for (const r of m.rows) if (r.device.live.power === 'on') r.device.live.volume = (r.device.live.volume ?? 10) + 3;
        m.rows[0].device.live.power = m.rows[0].device.live.power === 'on' ? 'off' : 'on';
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
      }, MOCK_URL);
      await page.waitForTimeout(3500);
      const b = await probe(page);
      expect(Math.abs(b.st - a.st)).toBeLessThanOrEqual(2);
      expect(Math.abs(b.cardTop - a.cardTop)).toBeLessThanOrEqual(2);
    });
  });
}

test.describe('the search popover and the scroll lock (phone)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const scrollOf = (page: Page) => probe(page).then((p) => p.st);
  const searchState = (page: Page) =>
    page.evaluate(`(() => { ${DEEP}
      const app = deep(document, 'sw-app').shadowRoot;
      const hit = app.elementFromPoint(195, 600);
      return { panel: !!app.querySelector('[data-search-panel]'), fixedLayer: !!app.querySelector('[data-search-scrim], .searchscrim') || !hit || !hit.closest('main'), locked: [deep(document, 'multimedia-screens'), deep(document, 'main'), document.documentElement].map((e) => e && e.style.overflow) };
    })()`) as Promise<{ panel: boolean; fixedLayer: boolean; locked: (string | null)[] }>;

  /** A real touch swipe (CDP touch events), starting at (x, y), the finger moving up by `dy` px in small steps. */
  async function swipe(page: Page, x: number, y: number, dy: number) {
    const cdp = await page.context().newCDPSession(page);
    const pt = (yy: number) => [{ x, y: yy, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(y) });
    for (let i = 1; i <= 20; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y - (dy * i) / 20) });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(600);
  }

  test('control: a touch swipe scrolls the list when the search was never opened', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone only');
    await many(page);
    await swipe(page, 195, 650, 300);
    expect(await scrollOf(page)).toBeGreaterThan(150);
  });

  test('opening the search puts no full-screen layer over the page; a swipe outside scrolls it and closes the popover', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone only');
    await many(page);
    await page.locator('[data-search-open]').tap();
    await expect(page.locator('[data-search-panel]')).toBeVisible();
    expect((await searchState(page)).fixedLayer).toBe(false);
    const before = await scrollOf(page);
    await swipe(page, 195, 650, 300);
    const after = await scrollOf(page);
    info.annotations.push({ type: 'swipe-scroll-px', description: `${before} -> ${after}` });
    expect(after - before).toBeGreaterThan(150);
    await expect(page.locator('[data-search-panel]')).toHaveCount(0);
  });

  test('a tap outside closes the popover and does not press what is under the finger', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone only');
    await many(page);
    await page.locator('[data-search-open]').tap();
    await expect(page.locator('[data-search-panel]')).toBeVisible();
    // the first card's power button is the thing that must NOT be pressed by the closing tap
    const power = (await page.evaluate(`(() => { ${DEEP} const b = deep(document, 'media-screen-card').shadowRoot.querySelector('button.pw'); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`)) as number[];
    const sent = () => page.evaluate(async (url) => (await import(/* @vite-ignore */ url)).mediaMock().sent.length, MOCK_URL);
    const sentBefore = await sent();
    await page.touchscreen.tap(power[0], power[1]);
    await expect(page.locator('[data-search-panel]')).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(await sent()).toBe(sentBefore);
    // and the next tap works normally again
    await page.waitForTimeout(800);
    await page.touchscreen.tap(power[0], power[1]);
    await page.waitForTimeout(800);
    expect(await sent()).toBeGreaterThan(sentBefore);
  });

  for (const how of ['route', 'back', 'escape'] as const) {
    test(`closing by ${how} leaves nothing behind: no popover, no layer, the page scrolls`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'phone only');
      await many(page);
      if (how === 'back') {
        await page.evaluate(() => {
          location.hash = '#/multimedia/players';
        });
        await page.waitForTimeout(400);
      }
      await page.locator('[data-search-open]').tap();
      await expect(page.locator('[data-search-panel]')).toBeVisible();
      if (how === 'route') await page.evaluate(() => { location.hash = '#/multimedia/players'; });
      if (how === 'back') await page.goBack();
      if (how === 'escape') await page.keyboard.press('Escape');
      await expect(page.locator('[data-search-panel]')).toHaveCount(0);
      await page.evaluate(() => {
        location.hash = '#/multimedia/screens';
      });
      await page.waitForSelector('multimedia-screens [data-screen-card]');
      await page.waitForTimeout(600);
      const s = await searchState(page);
      expect(s.fixedLayer).toBe(false);
      expect(s.locked.every((v) => !v)).toBe(true);
      await page.mouse.move(195, 500);
      const a = await scrollOf(page);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(400);
      expect((await scrollOf(page)) - a).toBeGreaterThan(200);
      expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
    });
  }

  test('two drawers that overlap hand the scroll lock back whatever the order they close in', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone only');
    await many(page);
    const res = await page.evaluate(async () => {
      await customElements.whenDefined('sw-drawer');
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;overflow:auto;z-index:1';
      const a = document.createElement('sw-drawer') as any;
      const b = document.createElement('sw-drawer') as any;
      a.modal = b.modal = true;
      box.append(a, b);
      document.body.append(box);
      const tick = () => new Promise((r) => setTimeout(r, 150));
      const out: Record<string, string> = {};
      for (const order of [['a', 'b'], ['b', 'a']]) {
        a.open = true;
        await tick();
        b.open = true;
        await tick();
        out[`${order.join('')}-both-open`] = box.style.overflow;
        for (const k of order) {
          (k === 'a' ? a : b).open = false;
          await tick();
        }
        out[`${order.join('')}-closed`] = box.style.overflow;
        out[`${order.join('')}-html`] = document.documentElement.style.overflow;
      }
      box.remove();
      return out;
    });
    expect(res['ab-both-open']).toBe('hidden');
    expect(res['ab-closed']).toBe('auto'); // the inline value the container had before the first lock
    expect(res['ba-closed']).toBe('auto');
    // the document element is locked by every drawer whatever it computes to: the second used to save the first one's "hidden"
    expect(res['ab-html']).toBe('');
    expect(res['ba-html']).toBe('');
  });
});
