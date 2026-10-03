import { test, expect, type Page } from '@playwright/test';

// 0.1.157 round B (DD3): what the approved mockups show and round A skipped, plus the test gaps the review found.
//  - the search field of a long list (8+ options) and the phone sheet / centred / inline presentation (Bubble `popup` dial);
//  - an unknown `dd-style` reads as `auto`;
//  - the per-skin exceptions (Tesla pill hairline, Bubble field r-md, opaque list in classic / Tesla, glass in Domus, text min width);
//  - hybrid at wide width and the 3-vs-4 items threshold; the rooms chip of the multimedia pages on a wide screen; the alarm button
//    and the floating corner reserve at wide width; the areas of a floor (home group) in dropdown mode on a wide screen;
//  - dark rendering of the six styles in the bubble and classic skins;
//  - the settings sub-tabs (11) and the permissions sub-tabs (5) following the tabs mode / style of the settings group.
// Needs the Vite DEV server (imports /src/...); run on the Ubuntu runner:  ~/run_remote.sh spec <branch> tests/dropdown-styles-b.spec.ts
const MODE_URL = '/src/shell/tabs-mode.ts';
const NAV_URL = '/src/shell/nav.ts';
const STYLES = ['pill', 'field', 'underline', 'text', 'prefix', 'tonal'] as const;
const WORDS = ['סלון', 'מטבח', 'חדר שינה', 'משרד', 'מרפסת', 'חצר', 'מחסן', 'חדר כביסה', 'חדר ילדים', 'פינת אוכל', 'גג', 'מעלית', 'חניה'];

async function stage(page: Page, skin = 'classic', width = 1280, scheme = 'light') {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('about:blank');
  await page.goto(`./?design=a&skin=${skin}&scheme=${scheme}#/devices/building`);
  await page.waitForFunction(() => !!customElements.get('sw-dropdown') && !!customElements.get('sw-tabs'));
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.querySelectorAll('#stage').forEach((e) => e.remove());
    const st = document.createElement('div');
    st.id = 'stage';
    st.style.cssText = 'position:fixed;inset:0;z-index:10;background:var(--sw-bg,#fff);padding:24px 16px;display:flex;flex-direction:column;gap:20px;align-items:flex-start';
    document.body.appendChild(st);
  });
}

/** sw-tabs in dropdown form per style; `n` items (the first has a count, the fourth an alert). */
async function mount(page: Page, styles: readonly string[], n = 6, extra: Record<string, string> = {}) {
  await page.evaluate(
    ([list, count, words, attrs]) => {
      const items = Array.from({ length: count as number }, (_, i) => ({ id: `i${i}`, label: (words as string[])[i % (words as string[]).length] + (i >= (words as string[]).length ? ` ${i}` : ''), ...(i === 0 ? { count: 6 } : {}), ...(i === 3 ? { alert: true } : {}) }));
      const st = document.querySelector('#stage') as HTMLElement;
      for (const s of list as string[]) {
        const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
        t.setAttribute('variant', 'dropdown');
        t.setAttribute('dd-style', s);
        t.setAttribute('group-label', 'אבטחה');
        t.setAttribute('data-t', s);
        for (const [k, v] of Object.entries(attrs as Record<string, string>)) t.setAttribute(k, v);
        t.items = items;
        t.active = 'i0';
        st.appendChild(t);
      }
    },
    [styles as string[], n, WORDS, extra] as [string[], number, string[], Record<string, string>],
  );
  await page.waitForTimeout(300);
}

const tabs = (page: Page, s: string) => page.locator(`#stage sw-tabs[data-t="${s}"]`);
const chip = (page: Page, s: string) => tabs(page, s).locator('sw-dropdown .chip');
const popOf = (page: Page, s: string) => tabs(page, s).locator('sw-dropdown .pop');

test.describe('the search field of a long list (mockups: 8+ options)', () => {
  test('7 options: no field; 8 options: a field', async ({ page }) => {
    await stage(page);
    await mount(page, ['pill'], 7);
    await chip(page, 'pill').click();
    await expect(popOf(page, 'pill')).toBeVisible();
    await expect(tabs(page, 'pill').locator('sw-dropdown input.q')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const t = document.querySelector('#stage sw-tabs') as HTMLElement & { items: { id: string; label: string }[] };
      t.items = [...t.items, { id: 'x', label: 'עוד אחד' }];
    });
    await page.waitForTimeout(200);
    await chip(page, 'pill').click();
    await expect(tabs(page, 'pill').locator('sw-dropdown input.q')).toBeVisible();
  });

  test('13 options: Hebrew placeholder, live filter, keyboard flow, aria, empty state', async ({ page }, info) => {
    await stage(page);
    await mount(page, ['pill']);
    await tabs(page, 'pill').evaluate((el, words) => {
      const t = el as HTMLElement & { items: unknown; active: string };
      t.items = (words as string[]).map((w, i) => ({ id: `i${i}`, label: w, ...(i === 0 ? { count: 6 } : {}) }));
      t.active = 'i0';
    }, WORDS);
    await page.waitForTimeout(200);
    const q = tabs(page, 'pill').locator('sw-dropdown input.q');
    const opts = tabs(page, 'pill').locator('sw-dropdown [role=option]');
    await chip(page, 'pill').click();
    await expect(q).toBeVisible();
    await expect(q).toHaveAttribute('placeholder', 'חיפוש');
    await expect(q).toHaveAttribute('aria-label', /חיפוש ב/);
    await expect(q).toHaveAttribute('role', 'combobox');
    await expect(opts).toHaveCount(13);
    if (info.project.name === 'desktop') await expect(q).toBeFocused(); // a pointer: the field takes the focus
    // aria wiring: the field controls the listbox and points at the active option
    const wiring = await tabs(page, 'pill').locator('sw-dropdown').evaluate((dd) => {
      const root = dd.shadowRoot!;
      const input = root.querySelector('input.q')!;
      const lb = root.querySelector('[role=listbox]')!;
      const active = root.querySelector('[role=option][data-active]');
      return { controls: input.getAttribute('aria-controls') === lb.id, active: input.getAttribute('aria-activedescendant') === active?.id, label: lb.getAttribute('aria-label') };
    });
    expect(wiring).toEqual({ controls: true, active: true, label: 'אבטחה' });
    // live filter: "חדר" matches three
    await q.fill('חדר');
    await expect(opts).toHaveCount(3);
    await expect(tabs(page, 'pill').locator('sw-dropdown [role=option][data-active]')).toHaveCount(1);
    // the cursor starts on the first match; ArrowDown moves among the matches and Enter picks
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(tabs(page, 'pill')).toHaveJSProperty('active', 'i7'); // "חדר כביסה", the second match
    await expect(chip(page, 'pill')).toHaveAttribute('aria-expanded', 'false');
    // empty state: nothing found, Enter picks nothing, the list stays open
    await chip(page, 'pill').click();
    await q.fill('zzzz');
    await expect(tabs(page, 'pill').locator('sw-dropdown [data-dd-none]')).toHaveText('לא נמצאו תוצאות');
    await expect(opts).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(chip(page, 'pill')).toHaveAttribute('aria-expanded', 'true');
    // clearing restores the list; End jumps to the last option when the field is empty; Esc closes and returns focus
    await q.fill('');
    await expect(opts).toHaveCount(13);
    await q.focus();
    await page.keyboard.press('End');
    await expect(tabs(page, 'pill').locator('sw-dropdown [role=option][data-active]')).toHaveAttribute('data-id', 'i12');
    // with text typed, Home / End are the caret's (the cursor does not jump)
    await q.fill('ח');
    const before = await tabs(page, 'pill').locator('sw-dropdown [role=option][data-active]').getAttribute('data-id');
    await page.keyboard.press('Home');
    await expect(tabs(page, 'pill').locator('sw-dropdown [role=option][data-active]')).toHaveAttribute('data-id', before!);
    await page.keyboard.press('Escape');
    await expect(chip(page, 'pill')).toHaveAttribute('aria-expanded', 'false');
    expect(await tabs(page, 'pill').locator('sw-dropdown').evaluate((el) => el.shadowRoot!.activeElement?.className)).toContain('chip');
    // the search text is forgotten on the next open
    await chip(page, 'pill').click();
    await expect(q).toHaveValue('');
  });

  test('the field is in every style and every skin that draws a list (a long list keeps its search while scrolling)', async ({ page }) => {
    for (const skin of ['classic', 'bubble']) {
      await stage(page, skin);
      await mount(page, STYLES, 13);
      for (const s of STYLES) {
        await chip(page, s).click();
        const r = await tabs(page, s).locator('sw-dropdown').evaluate((dd) => {
          const root = dd.shadowRoot!;
          const q = root.querySelector('.search')!.getBoundingClientRect();
          const pop = root.querySelector('.pop')!.getBoundingClientRect();
          const lb = root.querySelector('.lb') as HTMLElement;
          return { qTop: q.top - pop.top, scrolls: lb.scrollHeight > lb.clientHeight, h: pop.height };
        });
        expect(r.qTop, `${skin}/${s}: the field sits at the top of the list`).toBeLessThan(16);
        expect(r.scrolls, `${skin}/${s}: 13 options scroll under the field`).toBe(true);
        await page.keyboard.press('Escape');
      }
    }
  });
});

test.describe('the phone: sheet / centred / inline (the Bubble popup dial), a popover on a wide screen', () => {
  test('sheet (default): bottom of the screen, full width, grab bar + title, 48 px options, backdrop press closes', async ({ page }) => {
    await stage(page, 'classic', 390);
    await mount(page, ['pill'], 6);
    await chip(page, 'pill').click();
    const pop = popOf(page, 'pill');
    await expect(pop).toHaveAttribute('data-present', 'sheet');
    const r = await pop.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const root = el.getRootNode() as ShadowRoot;
      const opt = root.querySelector('.opt')!.getBoundingClientRect();
      return { l: b.left, r: b.right, bottom: b.bottom, h: b.height, vh: window.innerHeight, vw: document.documentElement.clientWidth, grab: !!root.querySelector('.grab'), ttl: root.querySelector('.ttl')?.textContent, opt: opt.height };
    });
    expect(r.l).toBeLessThanOrEqual(1);
    expect(r.r).toBeGreaterThanOrEqual(r.vw - 1);
    expect(Math.abs(r.bottom - r.vh)).toBeLessThanOrEqual(1);
    expect(r.h).toBeLessThanOrEqual(r.vh * 0.72 + 1);
    expect(r.grab).toBe(true);
    expect(r.ttl).toBe('אבטחה');
    expect(r.opt).toBeGreaterThanOrEqual(48);
    await page.mouse.click(190, 40); // the dimmed backdrop
    await expect(chip(page, 'pill')).toHaveAttribute('aria-expanded', 'false');
    await chip(page, 'pill').click();
    await page.keyboard.press('Escape');
    await expect(chip(page, 'pill')).toHaveAttribute('aria-expanded', 'false');
  });

  test('the popup dial: centred sits in the middle, inline opens in the flow; a wide screen and `auto` keep the popover', async ({ page }) => {
    await stage(page, 'bubble', 390);
    await mount(page, ['pill', 'auto'], 6);
    await page.evaluate(() => document.documentElement.setAttribute('data-bubble-popup', 'centred'));
    await chip(page, 'pill').click();
    const c = await popOf(page, 'pill').evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { mid: (b.top + b.bottom) / 2, vh: window.innerHeight, l: b.left, r: b.right, vw: document.documentElement.clientWidth };
    });
    expect(Math.abs(c.mid - c.vh / 2)).toBeLessThan(4);
    expect(c.l).toBeGreaterThan(8);
    expect(c.r).toBeLessThan(c.vw - 8);
    await expect(popOf(page, 'pill')).toHaveAttribute('data-present', 'centred');
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.documentElement.setAttribute('data-bubble-popup', 'inline'));
    await chip(page, 'pill').click();
    await expect(popOf(page, 'pill')).toHaveAttribute('data-present', 'inline');
    const inl = await popOf(page, 'pill').evaluate((el) => ({ pos: getComputedStyle(el).position, popover: el.hasAttribute('popover'), top: el.getBoundingClientRect().top, chipBottom: (el.getRootNode() as ShadowRoot).querySelector('.chip')!.getBoundingClientRect().bottom }));
    expect(inl.pos).toBe('static');
    expect(inl.popover).toBe(false);
    expect(inl.top).toBeGreaterThanOrEqual(inl.chipBottom - 1);
    await page.keyboard.press('Escape');
    // `auto` is today's look: a popover under its chip even on the phone and with the dial on inline
    await chip(page, 'auto').click();
    await expect(popOf(page, 'auto')).toHaveAttribute('data-present', 'pop');
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.documentElement.setAttribute('data-bubble-popup', 'sheet'));
    // wide: a popover whatever the dial says
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.documentElement.setAttribute('data-bubble-popup', 'centred'));
    await chip(page, 'pill').click();
    await expect(popOf(page, 'pill')).toHaveAttribute('data-present', 'pop');
  });

  test('the long list (13 options, the settings tabs) as a sheet: it scrolls under the search field; typing a letter filters', async ({ page }) => {
    await stage(page, 'classic', 390);
    await mount(page, ['pill'], 13);
    await chip(page, 'pill').click();
    const r = await popOf(page, 'pill').evaluate((el) => {
      const root = el.getRootNode() as ShadowRoot;
      const lb = root.querySelector('.lb') as HTMLElement;
      const b = el.getBoundingClientRect();
      return { scrolls: lb.scrollHeight > lb.clientHeight, h: b.height, vh: window.innerHeight, search: !!root.querySelector('.search') };
    });
    expect(r.search).toBe(true);
    expect(r.scrolls).toBe(true);
    expect(r.h).toBeLessThanOrEqual(r.vh * 0.72 + 1);
    await tabs(page, 'pill').locator('sw-dropdown input.q').fill('א');
    const n = await tabs(page, 'pill').locator('sw-dropdown [role=option]').count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(13);
  });
});

test.describe('an unknown dd-style reads as auto', () => {
  test('sw-dropdown and sw-tabs: the stray value never gets the styled look', async ({ page }) => {
    await stage(page);
    await mount(page, ['bogus', 'auto', 'pill']);
    const r = await page.evaluate(() => {
      const h = (s: string) => {
        const dd = document.querySelector(`#stage sw-tabs[data-t="${s}"]`)!.shadowRoot!.querySelector('sw-dropdown') as HTMLElement;
        const c = dd.shadowRoot!.querySelector('.chip') as HTMLElement;
        const cs = getComputedStyle(c);
        return { attr: dd.getAttribute('dd-style'), h: Math.round(c.getBoundingClientRect().height), radius: cs.borderTopLeftRadius, bg: cs.backgroundColor };
      };
      return { bogus: h('bogus'), auto: h('auto'), pill: h('pill') };
    });
    expect(r.bogus.attr).toBe('auto');
    expect(r.bogus.h).toBe(32);
    expect(r.bogus.radius).toBe(r.auto.radius);
    expect(r.bogus.bg).toBe(r.auto.bg);
    expect(r.pill.attr).toBe('pill');
  });
});

/** Colour helpers for the dark-mode and surface checks (computed colours may be rgb() or color(srgb ...)). */
const COLOR_JS = `
  window.__c = {
    parse(s) {
      let m = /^rgba?\\(([^)]+)\\)$/.exec(s.trim());
      if (m) { const p = m[1].split(/[,\\s/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; }
      m = /^color\\(srgb ([^)]+)\\)$/.exec(s.trim());
      if (m) { const p = m[1].split(/[\\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] === undefined ? 1 : p[3]]; }
      return [0, 0, 0, 0];
    },
    over(top, bottom) { const a = top[3] + bottom[3] * (1 - top[3]); return a === 0 ? [0, 0, 0, 0] : [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a); },
    lum(c) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); },
    ratio(a, b) { const x = window.__c.lum(a), y = window.__c.lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); },
    /** the opaque colour behind an element: its own and its ancestors' backgrounds (through shadow hosts), composited */
    behind(el) { const layers = []; let n = el; while (n) { if (n instanceof Element) { layers.push(window.__c.parse(getComputedStyle(n).backgroundColor)); } n = n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentNode; } let acc = [255, 255, 255, 1]; for (let i = layers.length - 1; i >= 0; i--) acc = window.__c.over(layers[i], acc); return acc; },
  };
`;

test.describe('dark rendering of the six styles (bubble and classic)', () => {
  for (const skin of ['bubble', 'classic']) {
    test(`skin ${skin}, dark: every style has a readable chip and a readable open list`, async ({ page }) => {
      await stage(page, skin, 1280, 'dark');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await page.evaluate(COLOR_JS);
      await mount(page, STYLES, 6);
      for (const s of STYLES) {
        const chipR = await tabs(page, s).evaluate((el) => {
          const c = (el.shadowRoot!.querySelector('sw-dropdown') as HTMLElement).shadowRoot!.querySelector('.chip') as HTMLElement;
          const w = window as unknown as { __c: Record<string, (...a: unknown[]) => any> };
          const bg = w.__c.behind(c);
          const fg = w.__c.parse(getComputedStyle(c).color);
          const txt = c.querySelector('.txt') as HTMLElement;
          return { ratio: w.__c.ratio(w.__c.over(fg, bg), bg), h: Math.round(c.getBoundingClientRect().height), txt: !!txt && txt.getBoundingClientRect().width > 0 };
        });
        expect(chipR.txt, `${skin}/${s} dark: the label is drawn`).toBe(true);
        expect(chipR.h, `${skin}/${s} dark: chip height`).toBeGreaterThanOrEqual(28);
        expect(chipR.ratio, `${skin}/${s} dark: chip text contrast`).toBeGreaterThanOrEqual(3);
        await chip(page, s).click();
        const listR = await tabs(page, s).evaluate((el) => {
          const dd = el.shadowRoot!.querySelector('sw-dropdown') as HTMLElement;
          const pop = dd.shadowRoot!.querySelector('.pop') as HTMLElement;
          const w = window as unknown as { __c: Record<string, (...a: unknown[]) => any> };
          const popBg = w.__c.behind(pop);
          const plain = [...dd.shadowRoot!.querySelectorAll<HTMLElement>('[role=option]')].find((o) => o.getAttribute('aria-selected') !== 'true')!;
          const sel = dd.shadowRoot!.querySelector<HTMLElement>('[role=option][aria-selected=true]')!;
          const optBg = w.__c.behind(plain);
          const selBg = w.__c.behind(sel);
          const popOwn = w.__c.parse(getComputedStyle(pop).backgroundColor);
          return {
            plain: w.__c.ratio(w.__c.over(w.__c.parse(getComputedStyle(plain).color), optBg), optBg),
            sel: w.__c.ratio(w.__c.over(w.__c.parse(getComputedStyle(sel).color), selBg), selBg),
            popAlpha: popOwn[3],
            popLum: w.__c.lum(popBg),
          };
        });
        expect(listR.plain, `${skin}/${s} dark: option text contrast`).toBeGreaterThanOrEqual(4.5);
        expect(listR.sel, `${skin}/${s} dark: selected option contrast`).toBeGreaterThanOrEqual(3);
        expect(listR.popAlpha, `${skin}/${s} dark: the list is not see-through`).toBeGreaterThanOrEqual(0.6);
        expect(listR.popLum, `${skin}/${s} dark: the list surface is dark`).toBeLessThan(0.4);
        await page.keyboard.press('Escape');
      }
    });
  }
});

test.describe('the mockups\' per-skin notes', () => {
  async function pill(page: Page, s: string) {
    return tabs(page, s).evaluate((el) => {
      const dd = el.shadowRoot!.querySelector('sw-dropdown') as HTMLElement;
      const c = dd.shadowRoot!.querySelector('.chip') as HTMLElement;
      const cs = getComputedStyle(c);
      const probe = document.createElement('div');
      probe.style.cssText = 'border-radius:var(--sw-r-md)';
      document.body.appendChild(probe);
      const rMd = getComputedStyle(probe).borderTopLeftRadius;
      probe.style.cssText = 'border-radius:var(--sw-r-pill)';
      const rPill = getComputedStyle(probe).borderTopLeftRadius;
      probe.remove();
      return { border: cs.borderTopColor, radius: cs.borderTopLeftRadius, rMd, rPill };
    });
  }

  test('Tesla: the pill carries a hairline; classic keeps it borderless; Bubble: the field is rounded to r-md', async ({ page }) => {
    await stage(page, 'tesla');
    await mount(page, ['pill', 'field']);
    const tesla = await pill(page, 'pill');
    expect(tesla.border).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    await stage(page, 'classic');
    await mount(page, ['pill']);
    expect(await pill(page, 'pill')).toMatchObject({ border: expect.stringMatching(/rgba\(0, 0, 0, 0\)|transparent/) });
    await stage(page, 'bubble');
    await mount(page, ['field']);
    const bub = await pill(page, 'field');
    expect(bub.radius).toBe(bub.rMd);
  });

  test('the list surface: opaque in classic and Tesla, glass in Domus; the text style opens a list at least 240 px wide', async ({ page }) => {
    for (const [skin, check] of [['classic', 'opaque'], ['tesla', 'opaque'], ['domus', 'glass']] as const) {
      await stage(page, skin);
      await mount(page, ['pill', 'text']);
      await chip(page, 'pill').click();
      const r = await popOf(page, 'pill').evaluate((el) => {
        const cs = getComputedStyle(el);
        const w = el.getBoundingClientRect().width;
        return { bg: cs.backgroundColor, blur: cs.backdropFilter, w };
      });
      const alpha = /^rgba\(.*,\s*([\d.]+)\)$/.exec(r.bg)?.[1] ?? /\/\s*([\d.]+)\)$/.exec(r.bg)?.[1];
      if (check === 'opaque') expect(alpha === undefined || Number(alpha) === 1, `${skin} list is opaque (${r.bg})`).toBe(true);
      else {
        expect(Number(alpha ?? 1), `${skin} list is the 84% glass (${r.bg})`).toBeLessThan(0.95);
        expect(r.blur).toContain('blur');
      }
      await page.keyboard.press('Escape');
      await chip(page, 'text').click();
      expect((await popOf(page, 'text').evaluate((el) => el.getBoundingClientRect().width)), `${skin} text list width`).toBeGreaterThanOrEqual(240);
      await page.keyboard.press('Escape');
    }
  });
});

/** The shell at a width, in demo mode; the group's mode is the user's own choice (like evidence-tabs-pair). */
async function openShell(page: Page, hash: string, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('about:blank');
  await page.goto(`./?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1200);
}

async function setMode(page: Page, mode: string | null, groups: Record<string, string> = {}) {
  await page.evaluate(async ([url, m, g]) => (await import(/* @vite-ignore */ url as string)).saveOwnTabsMode(m, g), [MODE_URL, mode, groups] as const);
  await page.waitForTimeout(500);
}

const shellFacts = (page: Page) =>
  page.locator('sw-app').evaluate((app) => {
    const root = app.shadowRoot!;
    const row = root.querySelector<HTMLElement>('.tabpair[data-tab-pair]');
    return { pair: !!row, pairChip: row ? row.querySelectorAll('[data-pair-chip]').length : 0, bars: root.querySelectorAll('nav.secrow, nav.sectabs').length, page: { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth } };
  });

test.describe('hybrid at wide width: three stay a bar, four become a dropdown', () => {
  test('sw-tabs adaptive at 1280 px: the threshold is HYBRID_MAX_ITEMS (3)', async ({ page }) => {
    await stage(page, 'classic', 1280);
    const r = await page.evaluate(async (url) => {
      const m = await import(/* @vite-ignore */ url);
      const st = document.querySelector('#stage') as HTMLElement;
      const out: Record<string, unknown> = { max: m.HYBRID_MAX_ITEMS };
      for (const n of [2, 3, 4, 6]) {
        const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
        t.setAttribute('adaptive', '');
        t.setAttribute('group-label', 'אבטחה');
        t.items = Array.from({ length: n }, (_, i) => ({ id: `t${i}`, label: `לשונית ${i + 1}` }));
        t.active = 't0';
        st.appendChild(t);
        await (t as unknown as { updateComplete: Promise<unknown> }).updateComplete;
        await new Promise((r) => setTimeout(r, 50));
        out[`n${n}`] = { variant: t.getAttribute('data-variant'), dropdown: !!t.shadowRoot!.querySelector('sw-dropdown') };
        t.remove();
      }
      return out;
    }, MODE_URL);
    expect(r.max).toBe(3);
    expect(r.n2).toEqual({ variant: 'pill', dropdown: false });
    expect(r.n3).toEqual({ variant: 'pill', dropdown: false });
    expect(r.n4).toEqual({ variant: 'dropdown', dropdown: true });
    expect(r.n6).toEqual({ variant: 'dropdown', dropdown: true });
  });

  test('the shell at 1280 px in hybrid mode: the security pages row is a dropdown only above three pages; the sections (three) stay a bar', async ({ page }) => {
    await openShell(page, '/security/live/wall', 1280);
    await setMode(page, 'hybrid');
    const f = await page.locator('sw-app').evaluate((app) => {
      const root = app.shadowRoot!;
      const pages = root.querySelector('sw-tabs[data-area-tabs]') as HTMLElement | null;
      return { sectionsBar: !!root.querySelector('nav.sections, nav.sectabs'), pagesVariant: pages?.getAttribute('data-variant') ?? null, pagesN: pages ? (pages as unknown as { items: unknown[] }).items.length : 0 };
    });
    expect(f.sectionsBar).toBe(true); // three sections keep their segmented bar
    expect(f.pagesN).toBeGreaterThan(0);
    expect(f.pagesVariant === 'dropdown').toBe(f.pagesN > 3);
  });
});

test.describe('the rooms chip of the multimedia pages on a wide screen (dropdown mode)', () => {
  for (const [name, hash, tag] of [['screens', '/multimedia/screens', 'multimedia-screens'], ['players', '/multimedia/players', 'multimedia-players']] as const) {
    test(`${name}: the rooms chip is in the shell's .tabpair at 1280 px and the local button strip is gone; tabs mode brings the strip back`, async ({ page }) => {
      await openShell(page, hash, 1280);
      await page.evaluate(async (url) => (await import(/* @vite-ignore */ url as string)).applyMultimediaKinds({ screens: 4, players: 3, groups: 1 }), NAV_URL);
      await setMode(page, 'tabs');
      await page.waitForTimeout(500);
      const tabsForm = await page.locator(tag).evaluate((el) => ({ strip: !!el.shadowRoot!.querySelector('.rooms'), inShell: !!el.shadowRoot!.querySelector('[data-rooms-in-shell]') }));
      expect(tabsForm.inShell).toBe(false);
      expect(tabsForm.strip).toBe(true);
      expect((await shellFacts(page)).pairChip).toBe(0);
      await setMode(page, 'dropdown');
      await page.waitForTimeout(600);
      const dd = await page.locator(tag).evaluate((el) => ({ strip: !!el.shadowRoot!.querySelector('.rooms'), inShell: !!el.shadowRoot!.querySelector('[data-rooms-in-shell]') }));
      expect(dd.strip).toBe(false);
      expect(dd.inShell).toBe(true);
      const f = await shellFacts(page);
      expect(f.pair).toBe(true);
      expect(f.pairChip).toBe(1);
      expect(f.page.scroll).toBeLessThanOrEqual(f.page.client + 1);
      // the chip is a real control: it opens (a popover under it on a wide screen) and picks a room
      const handle = await page.locator('sw-app').evaluateHandle((app) => app.shadowRoot!.querySelector('.tabpair [data-pair-chip]')!);
      const ddEl = handle.asElement()!;
      await (await ddEl.evaluateHandle((e) => e.shadowRoot!.querySelector<HTMLElement>('.chip')!)).asElement()!.click();
      expect(await ddEl.evaluate((e) => (e.shadowRoot!.querySelector('.pop') as HTMLElement).getAttribute('data-present'))).toBe('pop');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      await setMode(page, 'tabs');
    });
  }
});

test.describe('the alarm button and the floating corner at wide width (security, dropdown mode)', () => {
  test('1280 px: the row reserves 84 px at its inline end, the pin is 32 px with a hit area larger than the box', async ({ page }) => {
    await openShell(page, '/security/live/wall', 1280);
    await setMode(page, 'dropdown');
    const r = await page.locator('sw-app').evaluate((app) => {
      const root = app.shadowRoot!;
      const row = root.querySelector<HTMLElement>('.tabpair[data-security-row]');
      if (!row) return null;
      const pin = row.querySelector<HTMLElement>('a.alarmpin');
      const rowBox = row.getBoundingClientRect();
      const pb = pin?.getBoundingClientRect();
      const hit = (x: number, y: number) => (root.elementFromPoint(x, y) as HTMLElement | null)?.closest('a.alarmpin') === pin;
      const kids = [...row.children].map((c) => c.getBoundingClientRect());
      return {
        padEnd: getComputedStyle(row).paddingInlineEnd,
        dir: getComputedStyle(row).direction,
        pin: !!pin,
        w: pb ? Math.round(pb.width) : 0,
        h: pb ? Math.round(pb.height) : 0,
        hitOutside: pb ? hit(pb.left - 4, pb.top + pb.height / 2) && hit(pb.right + 4, pb.top + pb.height / 2) && hit(pb.left + pb.width / 2, pb.top - 4) : false,
        hitFar: pb ? hit(pb.left - 12, pb.top + pb.height / 2) : true,
        reserve: Math.min(...kids.map((k) => k.left)) - rowBox.left,
      };
    });
    expect(r).not.toBeNull();
    expect(r!.padEnd).toBe('84px');
    expect(r!.pin).toBe(true);
    expect(r!.w).toBe(32);
    expect(r!.h).toBe(32);
    expect(r!.hitOutside).toBe(true); // the ::after hit area (inset -6 px)
    expect(r!.hitFar).toBe(false);
    expect(r!.reserve).toBeGreaterThanOrEqual(83); // RTL: the reserve is on the left, where the floating search / user corner sits
    const f = await shellFacts(page);
    expect(f.page.scroll).toBeLessThanOrEqual(f.page.client + 1);
  });
});

test.describe('the areas of a floor (home group) in dropdown mode on a wide screen', () => {
  async function mountNav(page: Page, areas: number) {
    await page.evaluate(async (n) => {
      if (!customElements.get('devices-area-nav')) await import(/* @vite-ignore */ ['/src', 'screens', 'devices-area-nav.ts'].join('/'));
      document.querySelectorAll('#nav').forEach((e) => e.remove());
      const el = document.createElement('devices-area-nav') as HTMLElement & { areaId: string; areaName: string; floorName: string; areas: unknown };
      el.id = 'nav';
      el.areaId = 'a1';
      el.areaName = 'אזור 1';
      el.floorName = 'קומה 1';
      el.areas = Array.from({ length: n }, (_, i) => ({ area_id: `a${i + 1}`, name: `אזור ${i + 1}`, counts: { entities: i + 2 } }));
      document.body.appendChild(el);
    }, areas);
    await page.waitForTimeout(500);
  }
  const navFacts = (page: Page) =>
    page.locator('#nav').evaluate((el) => ({ floorCrumb: !!el.shadowRoot!.querySelector('[data-crumb=floor]'), areaCrumb: !!el.shadowRoot!.querySelector('[data-crumb=area]'), inShell: !!el.shadowRoot!.querySelector('[data-areas-in-shell]') }));

  test('dropdown mode at 1280 px: the area row is a selectable chip in the shell; the floor crumb stays; nothing disappears without a replacement', async ({ page }) => {
    await openShell(page, '/devices/building', 1280);
    await setMode(page, 'dropdown');
    await mountNav(page, 5);
    const nav = await navFacts(page);
    expect(nav.floorCrumb).toBe(true);
    expect(nav.areaCrumb).toBe(false);
    expect(nav.inShell).toBe(true);
    const f = await shellFacts(page);
    expect(f.pairChip).toBe(1); // the replacement: the areas as a dropdown chip in the pair row
    const handle = await page.locator('sw-app').evaluateHandle((app) => app.shadowRoot!.querySelector('.tabpair [data-pair-chip]')!);
    const dd = handle.asElement()!;
    expect(await dd.evaluate((e) => (e as HTMLElement & { items: unknown[] }).items.length)).toBe(5);
    await (await dd.evaluateHandle((e) => e.shadowRoot!.querySelector<HTMLElement>('.chip')!)).asElement()!.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => location.hash)).toBe('#/devices/areas/a5');
    // back to tabs: the breadcrumb's area crumb returns and the pair chip goes
    await setMode(page, 'tabs');
    await mountNav(page, 5);
    expect(await navFacts(page)).toEqual({ floorCrumb: true, areaCrumb: true, inShell: false });
    expect((await shellFacts(page)).pairChip).toBe(0);
  });

  test('hybrid at 1280 px: three areas keep the breadcrumb crumb, four become the chip', async ({ page }) => {
    await openShell(page, '/devices/building', 1280);
    await setMode(page, 'hybrid');
    await mountNav(page, 3);
    expect(await navFacts(page)).toEqual({ floorCrumb: true, areaCrumb: true, inShell: false });
    expect((await shellFacts(page)).pairChip).toBe(0);
    await mountNav(page, 4);
    expect(await navFacts(page)).toEqual({ floorCrumb: true, areaCrumb: false, inShell: true });
    expect((await shellFacts(page)).pairChip).toBe(1);
  });
});

test.describe('the settings sub-tabs follow the tabs mode and the style of the settings group', () => {
  for (const [name, hash, sel] of [['settings (11 tabs)', '/system/diagnostics', 'sw-tabs[data-settings-tabs]'], ['permissions (5 tabs)', '/system/access', 'sw-tabs[data-access-tabs]']] as const) {
    test(`${name}: tabs by default, a dropdown in the chosen style in dropdown mode, a search field from 8 options`, async ({ page }) => {
      await openShell(page, hash, 1280);
      const facts = () =>
        page.evaluate((s) => {
          const find = (root: ParentNode): HTMLElement | null => {
            for (const e of root.querySelectorAll('*')) {
              if (e.matches(s)) return e as HTMLElement;
              if (e.shadowRoot) {
                const r = find(e.shadowRoot);
                if (r) return r;
              }
            }
            return null;
          };
          const t = find(document);
          return t ? { variant: t.getAttribute('data-variant'), style: t.getAttribute('dd-style'), n: (t as unknown as { items: unknown[] }).items.length } : null;
        }, sel);
      const before = await facts();
      expect(before).not.toBeNull();
      expect(before!.variant).not.toBe('dropdown');
      await page.evaluate(async (url) => {
        const m = await import(/* @vite-ignore */ url as string);
        await m.saveOwnDdStyle(null, { settings: 'tonal' });
        await m.saveOwnTabsMode(null, { settings: 'dropdown' });
      }, MODE_URL);
      await page.waitForTimeout(700);
      const after = await facts();
      expect(after!.variant).toBe('dropdown');
      expect(after!.style).toBe('tonal');
      // open its chip: a search field exactly when there are 8+ options
      const dd = page.locator(sel).first().locator('sw-dropdown .chip');
      await dd.click();
      await expect(page.locator(sel).first().locator('sw-dropdown input.q')).toHaveCount(after!.n >= 8 ? 1 : 0);
      await page.keyboard.press('Escape');
      await page.evaluate(async (url) => (await import(/* @vite-ignore */ url as string)).saveOwnTabsMode(null, {}), MODE_URL);
    });
  }
});
