import { test, expect, type Page } from '@playwright/test';

// UXFIX-NAV-295 (UX audit 2026-10-20, findings 8, 14, 15), demo mode (no backend):
//   SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/layout-uxfix-nav-295.spec.ts --workers=2
// Settings on a phone (one dropdown, distinct labels), one heading style across the glass and the plain pages, an h1 on the
// infrastructure pages, the home title = its navigation label, the ticket card on a phone (title width, no duplicated status).

interface Hit { text: string; fs: string; ff: string; fw: string; w: number; h: number; display: string; lineClamp: string }

/** Every element matching `sel`, through shadow roots, as plain measurements. */
async function deep(page: Page, sel: string): Promise<Hit[]> {
  return page.evaluate((sel) => {
    const out: Hit[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll(sel)) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        out.push({ text: (el.textContent ?? '').trim(), fs: cs.fontSize, ff: cs.fontFamily, fw: cs.fontWeight, w: r.width, h: r.height, display: cs.display, lineClamp: (cs as unknown as { webkitLineClamp: string }).webkitLineClamp });
      }
      for (const x of root.querySelectorAll('*')) if (x.shadowRoot) walk(x.shadowRoot);
    };
    walk(document);
    return out;
  }, sel);
}

async function open(page: Page, hash: string) {
  await page.goto(`./?skin=domus&scheme=light#${hash}`);
  await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('main'));
  await page.waitForTimeout(1800);
}

async function forceGlass(page: Page) {
  await page.evaluate(() => {
    const walk = (root: Document | ShadowRoot) => {
      for (const x of root.querySelectorAll('*')) {
        if (x.hasAttribute('data-devices-style')) x.setAttribute('data-devices-style', 'glass');
        if (x.shadowRoot) walk(x.shadowRoot);
      }
    };
    walk(document);
  });
  await page.waitForTimeout(200);
}

async function settingsTabsVariants(page: Page): Promise<(string | null)[]> {
  return page.evaluate(() => {
    const out: (string | null)[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll('sw-tabs[data-settings-tabs]')) out.push(el.getAttribute('data-variant'));
      for (const x of root.querySelectorAll('*')) if (x.shadowRoot) walk(x.shadowRoot);
    };
    walk(document);
    return out;
  });
}

test('every screen of the audit carries exactly one h1', async ({ page }) => {
  for (const route of ['/devices/building', '/devices/schedules', '/tickets/all', '/multimedia/players', '/infra/electricity/meters', '/infra/generator/live', '/system/access']) {
    await open(page, route);
    const h1 = (await deep(page, 'h1')).filter((x) => x.display !== 'none' && x.text);
    expect(h1.length, `${route}: ${JSON.stringify(h1.map((x) => x.text))}`).toBe(1);
  }
});

test('the home heading is its navigation label', async ({ page }) => {
  await open(page, '/devices/building');
  const h1 = (await deep(page, 'h1')).filter((x) => x.text);
  expect(h1[0].text).toBe('ראשי');
});

test('the glass pages and the plain pages share one heading size, weight and family', async ({ page }, info) => {
  await open(page, '/system/access');
  const plain = (await deep(page, 'h1')).find((x) => x.text);
  expect(plain).toBeTruthy();
  for (const route of ['/devices/schedules', '/tickets/all']) {
    await open(page, route);
    await forceGlass(page);
    const glass = (await deep(page, 'h1')).find((x) => x.text);
    expect(glass, route).toBeTruthy();
    expect(glass!.fs, `${route} (${info.project.name}) font size`).toBe(plain!.fs);
    expect(glass!.fw, `${route} font weight`).toBe(plain!.fw);
    expect(glass!.ff, `${route} font family`).toBe(plain!.ff);
  }
});

test('settings on a phone: the sub-pages are one dropdown (no third strip) and the title is not the strip label', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'the phone layout');
  await open(page, '/system/diagnostics');
  const variants = await settingsTabsVariants(page);
  expect(variants).toEqual(['dropdown']);
  const h1 = (await deep(page, 'h1')).find((x) => x.text);
  expect(h1!.text).not.toBe('כללי');
});

test('settings on a desktop keep the underline tabs', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the wide layout');
  await open(page, '/system/diagnostics');
  const variants = await settingsTabsVariants(page);
  expect(variants).toHaveLength(1);
  expect(variants[0]).not.toBe('dropdown');
});

test('ticket cards on a phone: the title has the card width, a short title is never cut, and "no handler" is said once', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'the phone layout');
  await open(page, '/tickets/all');
  await page.waitForTimeout(800);
  const cards = await page.evaluate(() => {
    const out: { title: string; titleW: number; cardW: number; cut: boolean; sentence: string; run: string }[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const c of root.querySelectorAll('ticket-card')) {
        const sr = c.shadowRoot;
        const h3 = sr?.querySelector('h3') as HTMLElement | null;
        const art = sr?.querySelector('article') as HTMLElement | null;
        if (!sr || !h3 || !art) continue;
        out.push({
          title: (h3.textContent ?? '').trim(), titleW: h3.getBoundingClientRect().width, cardW: art.getBoundingClientRect().width,
          cut: h3.scrollHeight > h3.clientHeight + 1, sentence: sr.querySelector('[data-card-sentence]')?.textContent ?? '', run: sr.querySelector('[data-card-run]')?.textContent ?? '',
        });
      }
      for (const x of root.querySelectorAll('*')) if (x.shadowRoot) walk(x.shadowRoot);
    };
    walk(document);
    return out;
  });
  expect(cards.length).toBeGreaterThan(0);
  for (const c of cards) {
    expect(c.titleW, c.title).toBeGreaterThan(c.cardW * 0.7);
    if (c.title.length <= 28) expect(c.cut, `short title cut: ${c.title}`).toBe(false);
    if (/שיוך/.test(c.sentence)) expect(c.run, c.title).not.toContain('ללא מטפל');
  }
});

test('the bottom bar label may take two lines instead of ending in an ellipsis', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'the phone bar');
  await open(page, '/devices/building');
  const labels = await deep(page, 'nav.bottom .lbl');
  expect(labels.length).toBeGreaterThan(0);
  for (const l of labels) expect(l.lineClamp, l.text).toBe('2');
});
