import { test, expect, type Page } from '@playwright/test';

// SKINCOMP-297 (owner 2026-10-27): the component rules of the Arx skins in a real browser, demo mode (no backend). For Arx Infra and Arx
// Soft: the KPI tile is dot · number · word (no icon box), the rail reads the --sw-rail-* tokens; for Arx Soft only: pill buttons, the
// 51 x 31 switch. Option D: the rail tone "dark" (saved in הגדרות › כללי › מראה המערכת) paints Arx Infra's rail navy, is ignored by Soft
// and by classic. Classic keeps its own components (the 30 px icon box, the 42 x 24 switch, the 8 px button radius, the white rail).
// No pixel baselines (owner: not yet).
//   SW_BASE_URL=http://127.0.0.1:4802/ npx playwright test tests/smoke-skincomp-297.spec.ts --project=desktop --workers=1

async function load(page: Page, query: string, hash = '/devices/building', ready = 'devices-building') {
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(ready, { state: 'attached', timeout: 20_000 });
  await page.waitForTimeout(400);
}

/** Mount one KPI tile, one switch (on) and one button of each size beside the app; their shadow roots adopt the skin sheet like any other. */
async function probe(page: Page) {
  return page.evaluate(async () => {
    const box = document.createElement('div');
    box.setAttribute('data-probe', '');
    box.style.cssText = 'position:fixed;inset-block-start:0;inset-inline-start:0;z-index:9999;inline-size:320px;';
    box.innerHTML = '<sw-kpi label="מצלמות" value="12" tone="live"></sw-kpi><sw-kpi layout="compact" label="מצלמות" value="12"></sw-kpi><sw-toggle checked label="x"></sw-toggle><sw-button>שמור</sw-button><sw-button size="sm">שמור</sw-button>';
    document.body.appendChild(box);
    await Promise.all([...box.querySelectorAll('*')].map((e) => (e as unknown as { updateComplete?: Promise<unknown> }).updateComplete));
    await new Promise((r) => setTimeout(r, 300));
    const kpis = [...box.querySelectorAll('sw-kpi')].map((k) => {
      const icon = k.shadowRoot!.querySelector('.icon') as HTMLElement;
      const glyph = icon.querySelector('sw-icon') as HTMLElement;
      const r = icon.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), radius: getComputedStyle(icon).borderRadius, glyph: getComputedStyle(glyph).visibility, dir: getComputedStyle(k).flexDirection };
    });
    const tb = box.querySelector('sw-toggle')!.shadowRoot!.querySelector('button')!;
    const tr = tb.getBoundingClientRect();
    const knob = getComputedStyle(tb, '::after');
    const btns = [...box.querySelectorAll('sw-button')].map((b) => getComputedStyle(b.shadowRoot!.querySelector('button')!).borderTopLeftRadius);
    box.remove();
    return { kpis, toggle: { w: Math.round(tr.width), h: Math.round(tr.height), knob: knob.inlineSize ?? knob.width }, btns };
  });
}

/** The rail's fill, the colour of a plain item and of the current item. */
async function rail(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('sw-app')!.shadowRoot!;
    const nav = root.querySelector('nav.rail') as HTMLElement;
    const plain = root.querySelector('nav.rail a.item.a:not(.active)') as HTMLElement;
    const active = root.querySelector('nav.rail a.item.a.active') as HTMLElement | null;
    return {
      bg: getComputedStyle(nav).backgroundColor,
      plain: getComputedStyle(plain).color,
      active: active ? getComputedStyle(active).color : '',
      activeBg: active ? getComputedStyle(active).backgroundColor : '',
      tone: document.documentElement.getAttribute('data-rail'),
    };
  });
}

test.describe('SKINCOMP-297: the Arx component rules and the dark rail', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');

  test('classic keeps its components; Infra and Soft draw the KPI dot; Soft draws pill buttons and the 51 x 31 switch', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'component sizes: one width is enough');
    for (const scheme of ['light', 'dark']) {
      await load(page, `skin=classic&scheme=${scheme}`);
      const c = await probe(page);
      expect(c.kpis.map((k) => `${k.w}x${k.h}`), `classic/${scheme} icon boxes`).toEqual(['30x30', '32x32']);
      expect(c.kpis[0].glyph).toBe('visible');
      expect(c.kpis[0].dir).toBe('column');
      expect(`${c.toggle.w}x${c.toggle.h}`, `classic/${scheme} switch`).toBe('42x24');
      expect(c.btns, `classic/${scheme} buttons`).toEqual(['8px', '6px']);

      for (const id of ['infra', 'soft']) {
        await load(page, `skin=${id}&scheme=${scheme}`);
        const p = await probe(page);
        expect(p.kpis.map((k) => `${k.w}x${k.h}`), `${id}/${scheme}: the dot`).toEqual(['10x10', '10x10']);
        expect(p.kpis.every((k) => k.glyph === 'hidden'), `${id}/${scheme}: no glyph`).toBe(true);
        expect(p.kpis[0].dir, `${id}/${scheme}: the dot beside the number`).toBe('row');
        if (id === 'soft') {
          expect(`${p.toggle.w}x${p.toggle.h}`, `soft/${scheme} switch`).toBe('51x31');
          expect(p.btns, `soft/${scheme} pill buttons`).toEqual(['999px', '999px']);
        } else {
          expect(`${p.toggle.w}x${p.toggle.h}`, `infra/${scheme} switch`).toBe('42x24');
          expect(p.btns, `infra/${scheme} buttons`).toEqual(['8px', '6px']);
        }
      }
    }
  });

  test('the elevator state colours are tokens on the page, the same values as before', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one width is enough');
    for (const id of ['classic', 'infra', 'soft']) {
      await load(page, `skin=${id}&scheme=light`);
      const v = await page.evaluate(() => ['wait', 'act', 'trav', 'fault', 'off', 'fire', 'unk'].map((n) => getComputedStyle(document.documentElement).getPropertyValue(`--sw-el-${n}`).trim()));
      expect(v, id).toEqual(['#15803d', '#1d4ed8', '#0e7490', '#c81e1e', '#c2410c', '#881337', '#667085']);
    }
  });

  test('option D: the rail tone "dark" paints the Arx Infra rail navy (light scheme), is ignored by Soft and classic, and survives a reload', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the rail is a desktop / tablet surface');
    // Infra, rail as the skin draws it
    await load(page, 'scheme=light', '/system/diagnostics', 'system-design');
    const card = page.locator('sw-app system-design');
    await expect(card.locator('[data-rail-row]')).toHaveCount(0); // classic has no dark rail: no row
    await card.locator('[data-skin-option="infra"]').click();
    await expect(card.locator('[data-rail-row]')).toBeVisible();
    await card.locator('[data-design-save]').click();
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'infra');
    await load(page, 'scheme=light');
    const own = await rail(page);
    expect(own.tone).toBeNull();
    expect(own.bg).toBe('rgb(255, 255, 255)');
    expect(own.plain).toBe('rgb(75, 89, 118)'); // #4b5976
    expect(own.active).toBe('rgb(32, 98, 236)'); // #2062ec
    expect(own.activeBg).toBe('rgb(233, 240, 255)'); // #e9f0ff

    // the dark rail
    await load(page, 'scheme=light', '/system/diagnostics', 'system-design');
    await card.locator('[data-rail-option="dark"]').click();
    await card.locator('[data-design-save]').click();
    await expect(page.locator('html')).toHaveAttribute('data-rail', 'dark');
    await load(page, 'scheme=light');
    const navy = await rail(page);
    expect(navy.tone).toBe('dark');
    expect(navy.bg).toBe('rgb(20, 27, 43)'); // #141b2b
    expect(navy.plain).toBe('rgb(170, 182, 204)'); // #aab6cc
    expect(navy.active).toBe('rgb(255, 255, 255)');
    // dark scheme: Infra's own navy rail (the setting changes nothing there)
    await load(page, 'scheme=dark');
    expect((await rail(page)).bg).toBe('rgb(15, 21, 38)'); // #0f1526

    // Soft and classic ignore the tone (the stored tone stays "dark")
    for (const id of ['soft', 'classic']) {
      await load(page, `skin=${id}&scheme=light`);
      const r = await rail(page);
      expect(r.tone, id).toBeNull();
      if (id === 'classic') expect(r.bg, 'classic rail').toBe('rgb(255, 255, 255)');
    }

    // back to the skin's own rail
    await load(page, 'scheme=light', '/system/diagnostics', 'system-design');
    await card.locator('[data-rail-option="auto"]').click();
    await card.locator('[data-design-save]').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-rail', 'dark');
  });
});
