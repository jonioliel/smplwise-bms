import { test, expect, type Page } from '@playwright/test';

// 0.1.157 (integration): the Bubble skin's generic dropdown chip rule must not override the per-style chip rules of sw-dropdown
// (it used to: `:host(sw-dropdown) .chip` out-ranked the non-auto rules, so `field` lost its border and radius and the per-style
// min-height did not apply). Every dd-style x Bubble x light / dark draws a visible chip, `field` keeps its border and r-md radius,
// `auto` keeps the pill look. Needs the Vite DEV server (imports /src/...); run on the Ubuntu runner:
//   ~/run_remote.sh spec <branch> tests/dropdown-bubble-specificity.spec.ts
const STYLES = ['auto', 'pill', 'field', 'underline', 'text', 'prefix', 'tonal'] as const;

async function stage(page: Page, scheme: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('about:blank');
  await page.goto(`./?design=a&skin=bubble&scheme=${scheme}#/devices/building`);
  await page.waitForFunction(() => !!customElements.get('sw-dropdown') && !!customElements.get('sw-tabs'));
  await page.waitForTimeout(800);
  await page.evaluate((list) => {
    document.querySelectorAll('#stage').forEach((e) => e.remove());
    const st = document.createElement('div');
    st.id = 'stage';
    st.style.cssText = 'position:fixed;inset:0;z-index:10;background:var(--sw-bg,#fff);padding:24px 16px;display:flex;flex-direction:column;gap:20px;align-items:flex-start';
    document.body.appendChild(st);
    for (const s of list) {
      const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
      t.setAttribute('variant', 'dropdown');
      t.setAttribute('dd-style', s);
      t.setAttribute('group-label', 'אבטחה');
      t.setAttribute('data-t', s);
      t.items = ['סלון', 'מטבח', 'חדר שינה', 'משרד'].map((label, i) => ({ id: `i${i}`, label }));
      t.active = 'i0';
      st.appendChild(t);
    }
  }, STYLES as unknown as string[]);
  await page.waitForTimeout(400);
}

for (const scheme of ['light', 'dark']) {
  test(`bubble ${scheme}: every dropdown style draws a visible chip; field keeps its border; auto keeps the pill`, async ({ page }) => {
    await stage(page, scheme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
    const r = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.cssText = 'border-radius:var(--sw-r-md);position:fixed;width:10px;height:10px';
      document.body.appendChild(probe);
      const rMd = getComputedStyle(probe).borderTopLeftRadius;
      probe.remove();
      const out: Record<string, { w: number; h: number; border: number; radius: string; bg: string; min: string }> = {};
      document.querySelectorAll('#stage sw-tabs').forEach((t) => {
        const c = (t.shadowRoot!.querySelector('sw-dropdown') as HTMLElement).shadowRoot!.querySelector('.chip') as HTMLElement;
        const cs = getComputedStyle(c);
        const b = c.getBoundingClientRect();
        out[(t as HTMLElement).dataset.t!] = { w: b.width, h: b.height, border: parseFloat(cs.borderTopWidth), radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, min: cs.minBlockSize };
      });
      return { rMd, out };
    });
    for (const s of STYLES) {
      const c = r.out[s];
      expect(c.w, `${s}: the chip is drawn`).toBeGreaterThan(40);
      expect(c.h, `${s}: the chip has height`).toBeGreaterThanOrEqual(28);
    }
    expect(r.out.field.border, 'field keeps its border in Bubble').toBeGreaterThan(0);
    expect(r.out.field.radius, 'field keeps the r-md radius in Bubble').toBe(r.rMd);
    expect(r.out.auto.border, 'auto: borderless (as before)').toBe(0);
    expect(parseFloat(r.out.auto.radius), 'auto: pill (as before)').toBeGreaterThan(parseFloat(r.rMd));
    for (const s of ['auto', 'pill', 'field', 'tonal']) {
      expect(r.out[s].bg, `${s}: a filled chip`).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    }
    for (const s of STYLES.filter((x) => x !== 'auto')) {
      expect(parseFloat(r.out[s].min), `${s}: the per-style min height applies`).toBeGreaterThanOrEqual(28);
    }
  });
}
