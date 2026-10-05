import { test, expect, type Page } from '@playwright/test';

// Unreleased (owner request 2026-10-04): the `capsule` dropdown style and the SIZE dial (dd-size: sm / md / lg).
//  - the items API: `icon`, `count` and a `divider` item; the other styles ignore icon and divider;
//  - the closed capsule (ring, fill, shadow, icon at the start, chevron at the end, chevron up while open) and the open panel (radius, translucent
//    surface, tinted selected row, icon at the start and the COUNT at the other end of every row, a divider after the first row), RTL;
//  - keyboard and screen-reader behaviour unchanged (listbox / option roles, arrows skip the divider, Home / End, type-ahead, Escape);
//  - the sizes (trigger height, font, icon, row height, panel padding) grow sm < md < lg; the touch target stays 44 px on a phone;
//  - the resolver (user group > user global > installation group > installation global > md) and the Settings card against a mocked backend.
// Needs the Vite DEV server (imports /src/...); run on the Ubuntu runner:  ~/run_remote.sh spec <branch> tests/dropdown-capsule.spec.ts
const MODE_URL = '/src/shell/tabs-mode.ts';
const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const ADMIN = ['alarm.view', 'audit.read', 'devices.read', 'devices.control', 'entity.state.read', 'events.read', 'map.read', 'media.browse', 'media.control', 'media.read', 'rbac.assign', 'schedule.view', 'schedule.manage', 'sources.configure', 'system.configure', 'video.live', 'video.playback', 'access.read', 'automation.manage', 'script.run'];
const ITEMS = [
  { id: 'all', label: 'כל הקומות', icon: 'home', count: 14 },
  { id: 'd1', label: '', divider: true },
  { id: 'f0', label: 'קומת קרקע', icon: 'layers', count: 6 },
  { id: 'f1', label: 'קומה ראשונה', icon: 'layers', count: 5 },
  { id: 'f2', label: 'גג', icon: 'layers', count: 3 },
];

type Server = { inst: { size: string; groups: Record<string, string> }; own: { size: string | null; groups: Record<string, string> | null }; patches: Record<string, unknown>[]; puts: Record<string, unknown>[]; xi: Record<string, unknown>; xo: Record<string, unknown> };
// xi / xo: the installation's and the user's values of the ring / panel keys (ui.dd_ring*, ui.dd_panel*), kept generically
const fresh = (): Server => ({ inst: { size: 'md', groups: {} }, own: { size: null, groups: null }, patches: [], puts: [], xi: {}, xo: {} });
const isDial = (k: string) => k.startsWith('ui.dd_ring') || k.startsWith('ui.dd_panel');

async function mock(page: Page, srv: Server) {
  await page.route('**/api/v1/**', (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    const prefs = () => {
      const stored: string[] = [];
      if (srv.own.size) stored.push('ui.dd_size');
      if (srv.own.groups && Object.keys(srv.own.groups).length) stored.push('ui.dd_size_groups');
      for (const [k, v] of Object.entries(srv.xo)) if (v !== null && !(typeof v === 'object' && Object.keys(v as object).length === 0)) stored.push(k);
      return { prefs: { 'nav.order': ['devices', 'security', 'explore', 'multimedia', 'wiskey'], 'ui.dd_size': srv.own.size, 'ui.dd_size_groups': srv.own.groups, 'ui.dd_ring': null, 'ui.dd_ring_groups': null, 'ui.dd_panel': null, 'ui.dd_panel_groups': null, ...srv.xo }, stored, updated_at: null };
    };
    if (p === 'me/prefs' && req.method() === 'PUT') {
      const b = req.postDataJSON() as Record<string, unknown>;
      srv.puts.push(b);
      if ('ui.dd_size' in b) srv.own.size = b['ui.dd_size'] as string | null;
      if ('ui.dd_size_groups' in b) srv.own.groups = b['ui.dd_size_groups'] as Record<string, string> | null;
      for (const [k, v] of Object.entries(b)) if (isDial(k)) srv.xo[k] = v;
      return json(prefs());
    }
    if (p === 'me/prefs') return json(prefs());
    if (p === 'settings' && req.method() === 'PATCH') {
      const b = req.postDataJSON() as Record<string, unknown>;
      srv.patches.push(b);
      if ('ui.dd_size' in b) srv.inst.size = b['ui.dd_size'] as string;
      if ('ui.dd_size_groups' in b) srv.inst.groups = b['ui.dd_size_groups'] as Record<string, string>;
      for (const [k, v] of Object.entries(b)) if (isDial(k)) srv.xi[k] = v;
    }
    if (p === 'settings') return json({ settings: { 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.tabs': {}, 'multimedia.enabled': 'true', 'schedules.enabled': 'true', 'automations.enabled': 'true', 'ui.tabs_mode': 'tabs', 'ui.tabs_mode_groups': {}, 'ui.dd_style': 'auto', 'ui.dd_style_groups': {}, 'ui.dd_size': srv.inst.size, 'ui.dd_size_groups': srv.inst.groups, ...srv.xi }, can_edit: true });
    if (p === 'multimedia/status') return json({ enabled: true, counts: { screens: 1, players: 2, groups: 1 } });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

async function stage(page: Page, skin: string = 'classic', width = 1280, scheme = 'light') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('about:blank');
  await page.goto(`./?design=a&skin=${skin}&scheme=${scheme}#/devices/building`);
  await page.waitForFunction(() => !!customElements.get('sw-dropdown') && !!customElements.get('sw-tabs'));
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    document.querySelectorAll('#stage').forEach((e) => e.remove());
    const st = document.createElement('div');
    st.id = 'stage';
    st.style.cssText = 'position:fixed;inset:0;z-index:10;background:var(--sw-bg,#fff);padding:24px 16px;display:flex;flex-direction:column;gap:20px;align-items:flex-start';
    document.body.appendChild(st);
  });
}

/** One sw-tabs in dropdown form per `style:size` key (`capsule:md`), the capsule sample items. */
async function mount(page: Page, keys: readonly string[], extra: Record<string, string> = {}) {
  await page.evaluate(
    ([list, items, attrs]) => {
      const st = document.querySelector('#stage') as HTMLElement;
      for (const k of list as string[]) {
        const [style, size] = k.split(':');
        const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
        t.setAttribute('variant', 'dropdown');
        t.setAttribute('dd-style', style);
        if (size) t.setAttribute('dd-size', size);
        t.setAttribute('group-label', 'קומה');
        t.setAttribute('data-t', k);
        for (const [a, v] of Object.entries(attrs as Record<string, string>)) t.setAttribute(a, v);
        t.items = items;
        t.active = 'all';
        st.appendChild(t);
      }
    },
    [keys as string[], ITEMS, extra] as [string[], unknown[], Record<string, string>],
  );
  await page.waitForTimeout(250);
}

const tabs = (page: Page, k: string) => page.locator(`#stage sw-tabs[data-t="${k}"]`);
const chip = (page: Page, k: string) => tabs(page, k).locator('sw-dropdown .chip');
const pop = (page: Page, k: string) => tabs(page, k).locator('sw-dropdown .pop');

/** Measures inside the dropdown's shadow root. */
const measure = <T>(page: Page, k: string, fn: (root: ShadowRoot, host: HTMLElement) => T): Promise<T> =>
  tabs(page, k).locator('sw-dropdown').evaluate((el, src) => (new Function('root', 'host', `return (${src})(root, host)`)(el.shadowRoot, el)), fn.toString()) as Promise<T>;

test.describe('the items API: icon, count, divider', () => {
  test('capsule draws the icon, the count and the divider; the divider is not an option; the other styles show none of the three', async ({ page }) => {
    await stage(page);
    await mount(page, ['capsule:md', 'pill:md']);
    for (const k of ['capsule:md', 'pill:md']) await chip(page, k).click().then(() => page.keyboard.press('Escape'));
    // capsule
    await chip(page, 'capsule:md').click();
    const c = await measure(page, 'capsule:md', (root) => {
      const vis = (el: Element | null) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
      const opts = [...root.querySelectorAll('[role=option]')];
      const first = opts[0];
      const lbl = first.querySelector('.lbl')!.getBoundingClientRect();
      const ico = first.querySelector('.oi')!.getBoundingClientRect();
      const cnt = first.querySelector('.cnt')!.getBoundingClientRect();
      return {
        options: opts.length, seps: [...root.querySelectorAll('.sep')].filter(vis).length, sepAria: root.querySelector('.sep')!.getAttribute('aria-hidden'),
        icons: opts.filter((o) => vis(o.querySelector('.oi'))).length, counts: opts.map((o) => o.querySelector('.cnt')?.textContent), oldCounts: opts.filter((o) => vis(o.querySelector('.n'))).length,
        rtl: getComputedStyle(root.host).direction === 'rtl', ico: { l: ico.left, r: ico.right }, lbl: { l: lbl.left, r: lbl.right }, cnt: { l: cnt.left, r: cnt.right },
        selected: root.querySelector('[role=option][aria-selected=true]')?.getAttribute('data-id'),
      };
    });
    expect(c.options, 'the divider is not an option').toBe(4);
    expect(c.seps, 'one divider').toBe(1);
    expect(c.sepAria).toBe('true');
    expect(c.icons, 'every row has an icon').toBe(4);
    expect(c.counts).toEqual(['14', '6', '5', '3']);
    expect(c.oldCounts, 'the "(n)" form is not drawn in the capsule').toBe(0);
    expect(c.selected).toBe('all');
    // the icon is at the start, the count at the other end
    if (c.rtl) {
      expect(c.ico.l).toBeGreaterThan(c.lbl.r - 1);
      expect(c.cnt.r).toBeLessThanOrEqual(c.lbl.l + 1);
    } else {
      expect(c.ico.r).toBeLessThanOrEqual(c.lbl.l + 1);
      expect(c.cnt.l).toBeGreaterThan(c.lbl.r - 1);
    }
    await page.keyboard.press('Escape');
    // pill: nothing new is drawn
    await chip(page, 'pill:md').click();
    const p = await measure(page, 'pill:md', (root) => {
      const vis = (el: Element | null) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
      const opts = [...root.querySelectorAll('[role=option]')];
      return { options: opts.length, seps: [...root.querySelectorAll('.sep')].filter(vis).length, icons: opts.filter((o) => vis(o.querySelector('.oi'))).length, oldCounts: opts.filter((o) => vis(o.querySelector('.n'))).length, newCounts: opts.filter((o) => vis(o.querySelector('.cnt'))).length };
    });
    expect(p).toEqual({ options: 4, seps: 0, icons: 0, oldCounts: 4, newCounts: 0 });
  });

  test('a count is read by a screen reader in both forms (the option name carries it)', async ({ page }) => {
    await stage(page);
    await mount(page, ['capsule:md']);
    await chip(page, 'capsule:md').click();
    const names = await tabs(page, 'capsule:md').locator('sw-dropdown [role=option]').evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()));
    expect(names[0]).toContain('14');
    expect(names[1]).toContain('6');
  });
});

test.describe('closed and open look', () => {
  test('closed: a ring, a soft fill, a bottom shadow, an icon at the start and a chevron at the end; up while open; the ring stays', async ({ page }) => {
    await stage(page);
    await mount(page, ['capsule:md']);
    const closed = await measure(page, 'capsule:md', (root) => {
      const ch = root.querySelector('.chip') as HTMLElement;
      const b = getComputedStyle(ch, '::before');
      const icon = root.querySelector('.chip .ci')!.getBoundingClientRect();
      const chev = root.querySelector('.chip .chev')!.getBoundingClientRect();
      const txt = root.querySelector('.chip .txt') as HTMLElement;
      return {
        ring: b.borderTopWidth, ringColor: b.borderTopColor, fill: b.backgroundImage, shadow: b.boxShadow, radius: parseFloat(b.borderTopLeftRadius), h: parseFloat(b.height), fs: getComputedStyle(ch).fontSize, fw: getComputedStyle(ch).fontWeight,
        icon: icon.left, chev: chev.left, rtl: getComputedStyle(ch).direction === 'rtl', label: txt.textContent?.trim(), chevT: getComputedStyle(root.querySelector('.chip .chev')!).transform,
        count: !!root.querySelector('.chip .n') && getComputedStyle(root.querySelector('.chip .n')!).display !== 'none',
      };
    });
    expect(closed.ring, 'a 2 px ring (a fractional border is snapped to 1 px on a 1x screen)').toBe('2px');
    expect(closed.ringColor).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(closed.fill).toContain('linear-gradient');
    expect(closed.shadow).not.toBe('none');
    expect(closed.radius).toBeGreaterThan(20);
    expect(closed.h).toBe(46);
    expect(closed.fs).toBe('16px');
    expect(Number(closed.fw)).toBeGreaterThanOrEqual(600);
    expect(closed.label).toBe('כל הקומות');
    expect(closed.count, 'no count on the closed chip').toBe(false);
    // RTL: the icon on the right (start), the chevron on the left (end)
    if (closed.rtl) expect(closed.icon).toBeGreaterThan(closed.chev);
    else expect(closed.icon).toBeLessThan(closed.chev);
    expect(closed.chevT).toBe('none');
    await chip(page, 'capsule:md').click();
    await expect(chip(page, 'capsule:md')).toHaveAttribute('aria-expanded', 'true');
    await page.waitForTimeout(400); // the chevron turns over a short transition
    const open = await measure(page, 'capsule:md', (root) => {
      const ch = root.querySelector('.chip') as HTMLElement;
      return { chevT: getComputedStyle(root.querySelector('.chip .chev')!).transform, ring: getComputedStyle(ch, '::before').borderTopWidth, shadow: getComputedStyle(ch, '::before').boxShadow };
    });
    expect(open.chevT, 'the chevron points up').toMatch(/matrix\(-1/);
    expect(open.ring, 'the ring stays').toBe('2px');
    expect(open.shadow, 'a stronger ring while open').not.toBe(closed.shadow);
  });

  test('open: a rounded translucent panel as wide as the chip or wider, a tinted selected row with its icon, a thin divider, generous rows', async ({ page }) => {
    await stage(page);
    await mount(page, ['capsule:md']);
    const chipW = (await chip(page, 'capsule:md').boundingBox())!.width;
    await chip(page, 'capsule:md').click();
    const r = await measure(page, 'capsule:md', (root) => {
      const pp = root.querySelector('.pop') as HTMLElement;
      const ps = getComputedStyle(pp);
      const sel = root.querySelector('[role=option][aria-selected=true]') as HTMLElement;
      const other = root.querySelectorAll('[role=option]')[1] as HTMLElement;
      const sep = root.querySelector('.sep') as HTMLElement;
      const bg = getComputedStyle(sel).backgroundColor;
      return {
        radius: parseFloat(ps.borderTopLeftRadius), w: pp.getBoundingClientRect().width, bg: ps.backgroundColor, blur: ps.backdropFilter, shadow: ps.boxShadow,
        selBg: bg, otherBg: getComputedStyle(other).backgroundColor, selH: sel.getBoundingClientRect().height, sepH: sep.getBoundingClientRect().height,
        selIcon: !!sel.querySelector('.oi sw-icon'), selIconName: (sel.querySelector('.oi sw-icon') as unknown as { name: string }).name, selColor: getComputedStyle(sel).color, otherColor: getComputedStyle(other).color,
      };
    });
    expect(r.radius).toBeGreaterThanOrEqual(16);
    expect(r.radius).toBeLessThanOrEqual(22);
    expect(r.w).toBeGreaterThanOrEqual(chipW - 1);
    expect(r.bg, 'translucent, not opaque').toMatch(/rgba|color\(/);
    expect(r.blur).toContain('blur');
    expect(r.shadow).not.toBe('none');
    expect(r.selBg, 'the chosen row is tinted').not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(r.otherBg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(r.selColor).not.toBe(r.otherColor);
    expect(r.selH).toBeGreaterThanOrEqual(50);
    expect(r.sepH).toBe(1);
    expect(r.selIconName).toBe('home');
  });

  for (const skin of SKINS) {
    for (const scheme of ['light', 'dark']) {
      test(`skin ${skin}, ${scheme}: the capsule draws, opens, and the label is readable`, async ({ page }) => {
        await stage(page, skin, 1280, scheme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
        await mount(page, ['capsule:md']);
        const b = await chip(page, 'capsule:md').boundingBox();
        expect(b && b.width > 120 && b.height >= 44).toBe(true);
        const ring = await measure(page, 'capsule:md', (root) => getComputedStyle(root.querySelector('.chip')!, '::before').borderTopWidth);
        expect(ring).toBe('2px');
        await chip(page, 'capsule:md').click();
        const box = await tabs(page, 'capsule:md').locator('sw-dropdown [role=listbox]').boundingBox();
        expect(box && box.width > 200 && box.height > 150).toBe(true);
        const sel = await measure(page, 'capsule:md', (root) => {
          const s = root.querySelector('[role=option][aria-selected=true]') as HTMLElement;
          return getComputedStyle(s).backgroundColor;
        });
        expect(sel).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
        await page.keyboard.press('Escape');
      });
    }
  }

  test('the dials: the radius token reshapes it, the accent token recolours the ring, the performance dial removes the blur', async ({ page }) => {
    await stage(page);
    await mount(page, ['capsule:md']);
    const probe = () => measure(page, 'capsule:md', (root) => {
      const b = getComputedStyle(root.querySelector('.chip')!, '::before');
      return { radius: b.borderTopLeftRadius, ring: b.borderTopColor };
    });
    const before = await probe();
    await page.evaluate(() => {
      const st = document.querySelector('#stage') as HTMLElement;
      st.style.setProperty('--sw-accent', '#d6336c');
      st.style.setProperty('--sw-r-pill', '6px');
      st.style.setProperty('--sw-perf-blur', 'none');
    });
    await page.waitForTimeout(100);
    const after = await probe();
    expect(after.radius).toBe('6px');
    expect(after.ring).not.toBe(before.ring);
    await chip(page, 'capsule:md').click();
    const blur = await measure(page, 'capsule:md', (root) => getComputedStyle(root.querySelector('.pop')!).backdropFilter);
    expect(blur).toBe('none');
  });
});

test.describe('keyboard and screen reader (unchanged by the capsule)', () => {
  test('roles; Arrow keys skip the divider; Home / End; type-ahead; Enter chooses; Escape closes and returns the focus to the chip', async ({ page }) => {
    await stage(page);
    await mount(page, ['capsule:md']);
    const c = chip(page, 'capsule:md');
    await expect(c).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(c).toHaveAttribute('aria-expanded', 'false');
    await c.focus();
    await page.keyboard.press('ArrowDown');
    await expect(c).toHaveAttribute('aria-expanded', 'true');
    const lb = tabs(page, 'capsule:md').locator('sw-dropdown [role=listbox]');
    await expect(lb.locator('[role=option]')).toHaveCount(4);
    await expect(lb.locator('[role=separator]')).toHaveCount(0); // the divider is presentational
    const active = () => lb.locator('[role=option][data-active]').getAttribute('data-id');
    expect(await active()).toBe('all');
    await page.keyboard.press('ArrowDown');
    expect(await active(), 'the divider is skipped').toBe('f0');
    await page.keyboard.press('ArrowUp');
    expect(await active()).toBe('all');
    await page.keyboard.press('End');
    expect(await active()).toBe('f2');
    await page.keyboard.press('Home');
    expect(await active()).toBe('all');
    // a Hebrew letter has no key name in Playwright's keyboard: send the key event itself (what a real keyboard layout delivers)
    await lb.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ג', bubbles: true, composed: true })));
    expect(await active(), 'type-ahead').toBe('f2');
    await page.keyboard.press('Enter');
    await expect(c).toHaveAttribute('aria-expanded', 'false');
    await expect(tabs(page, 'capsule:md')).toHaveJSProperty('active', 'f2');
    await expect(c).toBeFocused();
    await expect(c).toHaveAttribute('aria-label', /גג/);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(c).toHaveAttribute('aria-expanded', 'false');
    await expect(c).toBeFocused();
  });

  test('a click on the divider does nothing', async ({ page }) => {
    await stage(page);
    await mount(page, ['capsule:md']);
    await chip(page, 'capsule:md').click();
    await tabs(page, 'capsule:md').locator('sw-dropdown .sep').click({ force: true });
    await expect(chip(page, 'capsule:md')).toHaveAttribute('aria-expanded', 'true');
    await page.waitForTimeout(400); // the chevron turns over a short transition
    await expect(tabs(page, 'capsule:md')).toHaveJSProperty('active', 'all');
  });

  test('a long list keeps its search; a divider is not drawn while the search narrows the list', async ({ page }) => {
    await stage(page);
    await page.evaluate(() => {
      const st = document.querySelector('#stage') as HTMLElement;
      const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
      t.setAttribute('variant', 'dropdown');
      t.setAttribute('dd-style', 'capsule');
      t.setAttribute('data-t', 'long');
      t.setAttribute('group-label', 'קומה');
      t.items = [{ id: 'all', label: 'הכל', icon: 'home' }, { id: 'd', label: '', divider: true }, ...Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, label: `חדר ${i}`, icon: 'door', count: i }))];
      t.active = 'all';
      st.appendChild(t);
    });
    await page.waitForTimeout(200);
    await chip(page, 'long').click();
    const dd = tabs(page, 'long').locator('sw-dropdown');
    await expect(dd.locator('[data-dd-search]')).toBeVisible();
    await expect(dd.locator('.sep')).toHaveCount(1);
    await dd.locator('[data-dd-search]').fill('חדר 3');
    await expect(dd.locator('[role=option]')).toHaveCount(1);
    await expect(dd.locator('.sep')).toHaveCount(0);
  });
});

test.describe('the size dial', () => {
  test('sm < md < lg: trigger height, font, icon, row height, panel padding; md is the reference (46 px, 16 px, 20 px, 52 px)', async ({ page }) => {
    await stage(page);
    const got: Record<string, { h: number; fs: number; icon: number; row: number; pad: number; w: number }> = {};
    for (const z of SIZES) {
      await page.evaluate(() => document.querySelectorAll('#stage sw-tabs').forEach((e) => e.remove()));
      await mount(page, [`capsule:${z}`]);
      await chip(page, `capsule:${z}`).click();
      got[z] = await measure(page, `capsule:${z}`, (root) => {
        const ch = root.querySelector('.chip') as HTMLElement;
        const row = root.querySelector('[role=option]') as HTMLElement;
        return {
          h: parseFloat(getComputedStyle(ch, '::before').height), fs: parseFloat(getComputedStyle(ch).fontSize), icon: root.querySelector('.chip .ci sw-icon')!.getBoundingClientRect().width,
          row: Math.round(row.getBoundingClientRect().height), pad: parseFloat(getComputedStyle(root.querySelector('.lb')!).paddingTop), w: root.querySelector('.pop')!.getBoundingClientRect().width,
        };
      });
      await page.keyboard.press('Escape');
    }
    expect(got.md).toMatchObject({ h: 46, fs: 16, icon: 20, row: 52, pad: 8 });
    expect(got.sm.h).toBeLessThan(got.md.h);
    expect(got.md.h).toBeLessThan(got.lg.h);
    expect(got.sm.fs).toBeLessThan(got.md.fs);
    expect(got.md.fs).toBeLessThan(got.lg.fs);
    expect(got.sm.icon).toBeLessThan(got.md.icon);
    expect(got.md.icon).toBeLessThan(got.lg.icon);
    expect(got.sm.row).toBeLessThan(got.md.row);
    expect(got.md.row).toBeLessThan(got.lg.row);
    expect(got.sm.pad).toBeLessThan(got.md.pad);
    expect(got.md.pad).toBeLessThan(got.lg.pad);
    expect(got.sm.w).toBeLessThanOrEqual(got.md.w);
    expect(got.md.w).toBeLessThanOrEqual(got.lg.w);
  });

  test('an unknown size reads as md', async ({ page }) => {
    await stage(page);
    await mount(page, ['capsule:huge']);
    await expect(tabs(page, 'capsule:huge').locator('sw-dropdown')).toHaveAttribute('dd-size', 'md');
  });

  test('touch targets: the chip box and the rows keep 44 px on a phone and on the 44 px desktop dial, also at sm', async ({ page }) => {
    for (const [w, dial] of [[390, '44px'], [1280, '44px']] as const) {
      await stage(page, 'classic', w);
      await page.evaluate((d) => document.documentElement.style.setProperty('--sw-touch-desktop', d), dial);
      await mount(page, ['capsule:sm']);
      const b = await chip(page, 'capsule:sm').boundingBox();
      expect(b!.height, `${w}: the sm chip box`).toBeGreaterThanOrEqual(44);
      await chip(page, 'capsule:sm').click();
      const rows = await tabs(page, 'capsule:sm').locator('sw-dropdown [role=option]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      for (const h of rows) expect(h, `${w}: an sm row`).toBeGreaterThanOrEqual(44);
      await page.keyboard.press('Escape');
    }
  });

  test('the dial reaches the other styles too: md is today, lg is bigger, sm smaller (the hit area stays 44 px)', async ({ page }) => {
    await stage(page);
    await mount(page, ['pill:sm', 'pill:md', 'pill:lg', 'auto:sm', 'auto:md', 'auto:lg']);
    const h = async (k: string) => Math.round((await chip(page, k).boundingBox())!.height);
    expect(await h('pill:md')).toBe(32);
    expect(await h('auto:md')).toBe(32);
    expect(await h('pill:sm')).toBeLessThan(32);
    expect(await h('pill:lg')).toBeGreaterThan(32);
    expect(await h('auto:sm')).toBeLessThan(32);
    expect(await h('auto:lg')).toBeGreaterThan(32);
  });

  test('phone: the capsule opens as the bottom sheet with 48 px rows; the pair-row chip does not overflow at 320 px', async ({ page }) => {
    await stage(page, 'classic', 320);
    await page.evaluate(() => document.documentElement.setAttribute('data-dd-phone', 'sheet')); // the default is the small list (2026-10-05)
    await page.evaluate(() => {
      const st = document.querySelector('#stage') as HTMLElement;
      st.style.alignItems = 'stretch';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;inline-size:100%';
      for (const z of ['md', 'lg']) {
        const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
        t.setAttribute('variant', 'dropdown');
        t.setAttribute('dd-style', 'capsule');
        t.setAttribute('dd-size', z);
        t.setAttribute('block', '');
        t.setAttribute('group-label', 'קומה');
        t.setAttribute('data-t', `capsule:${z}`);
        t.items = [{ id: 'all', label: 'כל הקומות ארוך מאוד מאוד', icon: 'home', count: 14 }, { id: 'd', label: '', divider: true }, { id: 'a', label: 'ב', icon: 'layers', count: 2 }];
        t.active = 'all';
        row.appendChild(t);
      }
      st.appendChild(row);
    });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await chip(page, 'capsule:md').click();
    await expect(pop(page, 'capsule:md')).toHaveClass(/sheet/);
    const rows = await tabs(page, 'capsule:md').locator('sw-dropdown [role=option]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    for (const h of rows) expect(h).toBeGreaterThanOrEqual(48);
  });
});

test.describe('the resolver (shell/tabs-mode.ts)', () => {
  test('md by default; user group > user global > installation group > installation global; a bogus stored value reads as md', async ({ page }) => {
    await mock(page, fresh());
    await page.goto('./?design=a#/devices/building');
    await page.waitForSelector('sw-app');
    const r = await page.evaluate(async (url) => {
      const m = await import(/* @vite-ignore */ url);
      const out: Record<string, unknown> = {};
      const at = () => ['home', 'area', 'multimedia', 'security', 'settings'].map((g) => m.ddSizeOf(g));
      m.setInstallationTabsMode({});
      await m.saveOwnDdSize(null, {});
      out.fresh = at();
      m.setInstallationTabsMode({ 'ui.dd_size': 'lg', 'ui.dd_size_groups': { security: 'sm' } });
      out.inst = at();
      await m.saveOwnDdSize('sm', {});
      out.ownGlobal = at();
      await m.saveOwnDdSize('sm', { settings: 'lg' });
      out.ownGroup = at();
      await m.saveOwnDdSize(null, {});
      out.followed = at();
      out.source = [m.resolveDdSize('security').source, m.resolveDdSize('area').source];
      m.setInstallationTabsMode({ 'ui.dd_size': 'bogus', 'ui.dd_size_groups': { ghost: 'sm', home: 'nonsense' } });
      out.bogus = at();
      out.labels = m.DD_SIZES.map((s: string) => m.DD_SIZE_LABEL[s]);
      out.style = m.DD_STYLE_LABEL.capsule;
      out.props = m.tabModeProps('security', 'pill');
      return out;
    }, MODE_URL);
    expect(r.fresh).toEqual(['md', 'md', 'md', 'md', 'md']);
    expect(r.inst).toEqual(['lg', 'lg', 'lg', 'sm', 'lg']);
    expect(r.ownGlobal).toEqual(['sm', 'sm', 'sm', 'sm', 'sm']);
    expect(r.ownGroup).toEqual(['sm', 'sm', 'sm', 'sm', 'lg']);
    expect(r.followed).toEqual(['lg', 'lg', 'lg', 'sm', 'lg']);
    expect(r.source).toEqual(['installation-group', 'installation']);
    expect(r.bogus).toEqual(['md', 'md', 'md', 'md', 'md']);
    expect(r.labels).toEqual(['קטן', 'רגיל', 'גדול']);
    expect(r.style).toBe('קפסולה');
    expect(r.props).toMatchObject({ ddSize: 'md' });
  });

  test('the shell: the security chips of a wide screen carry the group size and style', async ({ page }) => {
    await mock(page, fresh());
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?design=a#/live');
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1000);
    await page.evaluate(async (url) => {
      const m = await import(/* @vite-ignore */ url);
      await m.saveOwnTabsMode(null, { security: 'dropdown' });
      await m.saveOwnDdStyle('capsule', {});
      await m.saveOwnDdSize(null, { security: 'lg' });
    }, MODE_URL);
    await expect.poll(() => page.evaluate(() => {
      const out: string[] = [];
      const walk = (root: ParentNode) => {
        root.querySelectorAll('*').forEach((e) => {
          if (e.tagName === 'SW-DROPDOWN' && e.getAttribute('dd-style') === 'capsule') out.push(e.getAttribute('dd-size') ?? '');
          if (e.shadowRoot) walk(e.shadowRoot);
        });
      };
      walk(document);
      return out.length > 0 && out.every((s) => s === 'lg');
    })).toBe(true);
  });
});

test.describe('הגדרות › כללי › לשוניות › סגנון תפריט נפתח: the size', () => {
  async function openCard(page: Page, srv: Server, width = 1280) {
    await mock(page, srv);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./?design=a#/system/diagnostics?tab=tabs');
    await page.waitForSelector('system-tabs-mode');
    await page.waitForTimeout(1200);
    return page.locator('system-tabs-mode');
  }

  test('three sizes, a live preview of each, capsule among the styles, md by default, the source of every group named', async ({ page }) => {
    const card = await openCard(page, fresh());
    await expect(card.locator('[data-dd-size-global=inst] option')).toHaveCount(3);
    await expect(card.locator('[data-dd-size-global=own] option')).toHaveCount(4); // follow + 3
    await expect(card.locator('[data-dd-size-global=inst] option')).toHaveText(['קטן', 'רגיל', 'גדול']);
    await expect(card.locator('[data-dd-size-group-row]')).toHaveCount(10);
    await expect(card.locator('[data-dd-size-preview]')).toHaveCount(3);
    for (const z of SIZES) await expect(card.locator(`[data-dd-size-preview=${z}] sw-tabs`)).toHaveAttribute('dd-size', z);
    await expect(card.locator('[data-dd-global=inst] option[value=capsule]')).toHaveText('קפסולה');
    await expect(card.locator('[data-dd-preview=capsule] sw-tabs')).toHaveAttribute('dd-style', 'capsule');
    await expect(card.locator('[data-dd-effective-group=security]')).toHaveAttribute('data-dd-size', 'md');
    const heights = await card.locator('[data-dd-size-preview] sw-tabs').evaluateAll((els) => els.map((e) => (e.shadowRoot!.querySelector('sw-dropdown') as HTMLElement).shadowRoot!.querySelector('.chip')!.getBoundingClientRect().height));
    expect(heights[0]).toBeLessThanOrEqual(heights[1]);
    expect(heights[1]).toBeLessThan(heights[2]);
  });

  test('the installation default and a per-group override save to ui.dd_size / ui.dd_size_groups and apply at once', async ({ page }) => {
    const srv = fresh();
    const card = await openCard(page, srv);
    await card.locator('[data-dd-size-global=inst]').selectOption('lg');
    await expect.poll(() => srv.patches.length).toBe(1);
    expect(srv.patches[0]).toEqual({ 'ui.dd_size': 'lg', 'ui.dd_size_groups': {} });
    await card.locator('[data-dd-size-group="inst:settings"]').selectOption('sm');
    await expect.poll(() => srv.inst.groups).toEqual({ settings: 'sm' });
    await expect(card.locator('[data-dd-effective-group=settings]')).toHaveAttribute('data-dd-size', 'sm');
    await expect(card.locator('[data-dd-effective-group=security]')).toHaveAttribute('data-dd-size', 'lg');
    await card.locator('[data-dd-size-group="inst:settings"]').selectOption('');
    await expect.poll(() => srv.inst.groups).toEqual({});
  });

  test('"ההעדפה שלי" is its own choice (/me/prefs), wins over the installation, can be reset', async ({ page }) => {
    const srv = fresh();
    srv.inst = { size: 'lg', groups: {} };
    const card = await openCard(page, srv);
    await card.locator('[data-dd-size-global=own]').selectOption('sm');
    await expect.poll(() => srv.own.size).toBe('sm');
    expect(srv.puts[0]).toEqual({ 'ui.dd_size': 'sm', 'ui.dd_size_groups': null });
    await card.locator('[data-dd-size-group="own:security"]').selectOption('lg');
    await expect.poll(() => srv.own.groups).toEqual({ security: 'lg' });
    await expect(card.locator('[data-dd-effective-group=security]')).toHaveAttribute('data-dd-size-source', 'own-group');
    await expect(card.locator('[data-dd-effective-group=area]')).toHaveAttribute('data-dd-size-source', 'own');
    expect(srv.patches).toHaveLength(0); // the installation was not touched
    await card.locator('[data-dd-size-own-reset]').click();
    await expect.poll(() => [srv.own.size, srv.own.groups]).toEqual([null, null]);
    await expect(card.locator('[data-dd-effective-group=security]')).toHaveAttribute('data-dd-size', 'lg');
  });

  test('works on a phone width too', async ({ page }) => {
    const card = await openCard(page, fresh(), 390);
    await expect(card.locator('[data-dd-size-previews]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});


// ---- Unreleased (owner decisions 2026-10-04): the pill style is labelled "כדור מלא"; the capsule gets a ring thickness and an open-panel width ----
const DD_URL = '/src/components/dd-style.ts';
const PANEL_BASE = { button: 0, '240': 240, '300': 300 } as const;

test.describe('capsule polish: the ring thickness and the open-panel width (components)', () => {
  test('ring: 1 / 2 / 3 px draw as set (2 px is the default; an unknown value reads as 2 px); the other styles ignore it', async ({ page }) => {
    await stage(page);
    await mount(page, ['capsule:md'], { 'dd-ring': '1' });
    await mount(page, ['capsule:md'], {});
    // two capsules share a data-t: tell them apart by order
    const ring = (i: number) => tabs(page, 'capsule:md').nth(i).locator('sw-dropdown').evaluate((el) => getComputedStyle(el.shadowRoot!.querySelector('.chip')!, '::before').borderTopWidth);
    expect(await ring(0)).toBe('1px');
    expect(await ring(1), 'default').toBe('2px');
    await page.evaluate(() => document.querySelectorAll('#stage sw-tabs').forEach((e) => e.remove()));
    for (const r of ['2', '3', 'bogus']) {
      await page.evaluate(() => document.querySelectorAll('#stage sw-tabs').forEach((e) => e.remove()));
      await mount(page, ['capsule:md'], { 'dd-ring': r });
      expect(await ring(0), r).toBe(r === '3' ? '3px' : '2px');
    }
    await expect(tabs(page, 'capsule:md').locator('sw-dropdown')).toHaveAttribute('dd-ring', '2'); // the stray value reads back as the default
    // the other styles: the thickness does nothing
    await page.evaluate(() => document.querySelectorAll('#stage sw-tabs').forEach((e) => e.remove()));
    await mount(page, ['pill:md', 'field:md', 'auto:md'], { 'dd-ring': '3' });
    const plain = (k: string) => measure(page, k, (root) => { const c = getComputedStyle(root.querySelector('.chip')!); return [c.borderTopWidth, getComputedStyle(root.querySelector('.chip')!, '::before').borderTopWidth].join('|'); });
    const withRing = [await plain('pill:md'), await plain('field:md'), await plain('auto:md')];
    await page.evaluate(() => document.querySelectorAll('#stage sw-tabs').forEach((e) => e.setAttribute('dd-ring', '1')));
    await page.waitForTimeout(150);
    expect([await plain('pill:md'), await plain('field:md'), await plain('auto:md')]).toEqual(withRing);
  });

  // The browser snaps a fractional border to whole device pixels, and Playwright's emulated scale factor does not change that snapping (even at
  // devicePixelRatio 2 the computed width of 1.5px reads 1px), so a real 1.5 px ring cannot be measured here: what is checked is the dial itself
  // (the unsnapped custom property the border reads). The retina look is a manual check on a real retina screen.
  test('ring 1.5 px: the dial reaches the border (the custom property), whatever the screen snaps it to', async ({ page }) => {
    await stage(page);
    const got: Record<string, string> = {};
    for (const r of ['1', '1.5', '2', '3']) {
      await page.evaluate(() => document.querySelectorAll('#stage sw-tabs').forEach((e) => e.remove()));
      await mount(page, ['capsule:md'], { 'dd-ring': r });
      got[r] = await measure(page, 'capsule:md', (_root, host) => getComputedStyle(host).getPropertyValue('--_cring').trim());
    }
    expect(got).toEqual({ '1': '1px', '1.5': '1.5px', '2': '2px', '3': '3px' });
  });

  test('panel: as wide as the button / 240 / 300 px at md; scales with the size dial; the default is 240; the other styles ignore it', async ({ page }) => {
    await stage(page);
    const popW = async (extra: Record<string, string>, size: string) => {
      await page.evaluate(() => document.querySelectorAll('#stage sw-tabs').forEach((e) => e.remove()));
      await mount(page, [`capsule:${size}`], extra);
      const chipW = (await chip(page, `capsule:${size}`).boundingBox())!.width;
      await chip(page, `capsule:${size}`).click();
      const w = await measure(page, `capsule:${size}`, (root) => root.querySelector('.pop')!.getBoundingClientRect().width);
      await page.keyboard.press('Escape');
      return { w, chipW };
    };
    const md = await popW({}, 'md');
    expect(md.w, 'default 240').toBeCloseTo(240, 0);
    const btn = await popW({ 'dd-panel': 'button' }, 'md');
    // "as wide as the button" is a floor: never narrower than the button (a long label can still make the panel wider)
    expect(btn.w, 'never narrower than the button').toBeGreaterThanOrEqual(btn.chipW - 1);
    expect(btn.w, 'narrower than the 240 panel for this short list').toBeLessThan(md.w);
    expect((await popW({ 'dd-panel': '240' }, 'md')).w).toBeCloseTo(240, 0);
    expect((await popW({ 'dd-panel': '300' }, 'md')).w).toBeCloseTo(300, 0);
    // the size dial scales it as it does today (200 / 240 / 280 for the 240 base)
    expect((await popW({ 'dd-panel': '240' }, 'sm')).w).toBeCloseTo(200, 0);
    expect((await popW({ 'dd-panel': '240' }, 'lg')).w).toBeCloseTo(280, 0);
    expect((await popW({ 'dd-panel': '300' }, 'sm')).w).toBeCloseTo(250, 0);
    expect((await popW({ 'dd-panel': '300' }, 'lg')).w).toBeCloseTo(350, 0);
    expect((await popW({ 'dd-panel': 'bogus' }, 'md')).w, 'an unknown value reads as 240').toBeCloseTo(240, 0);
    // pill: the panel keeps its own width whatever the attribute says
    await page.evaluate(() => document.querySelectorAll('#stage sw-tabs').forEach((e) => e.remove()));
    await mount(page, ['pill:md'], { 'dd-panel': '300' });
    await chip(page, 'pill:md').click();
    const pw = await measure(page, 'pill:md', (root) => root.querySelector('.pop')!.getBoundingClientRect().width);
    expect(pw).toBeLessThan(260);
  });

  test('the floor helper: button = no floor; the dial scales 240 / 300', async ({ page }) => {
    await mock(page, fresh());
    await page.goto('./?design=a#/devices/building');
    await page.waitForSelector('sw-app');
    const r = await page.evaluate(async (url) => {
      const m = await import(/* @vite-ignore */ url);
      return { button: m.ddPanelFloor('button', 'lg'), a: ['sm', 'md', 'lg'].map((z) => m.ddPanelFloor('240', z)), b: ['sm', 'md', 'lg'].map((z) => m.ddPanelFloor('300', z)), d: [m.DD_RING_DEFAULT, m.DD_PANEL_DEFAULT] };
    }, DD_URL);
    expect(r).toEqual({ button: 0, a: [200, 240, 280], b: [250, 300, 350], d: ['2', '240'] });
    expect(PANEL_BASE['240']).toBe(240);
  });
});

test.describe('capsule polish: the resolver and the label', () => {
  test('ring / panel: defaults 2 / 240; user group > user global > installation group > installation global; a bogus stored value reads as the default; the pill label', async ({ page }) => {
    await mock(page, fresh());
    await page.goto('./?design=a#/devices/building');
    await page.waitForSelector('sw-app');
    const r = await page.evaluate(async (url) => {
      const m = await import(/* @vite-ignore */ url);
      const out: Record<string, unknown> = {};
      const groups = ['home', 'area', 'multimedia', 'security', 'settings'];
      const ring = () => groups.map((g) => m.ddRingOf(g));
      const panel = () => groups.map((g) => m.ddPanelOf(g));
      m.setInstallationTabsMode({});
      await m.saveOwnDdRing(null, {});
      await m.saveOwnDdPanel(null, {});
      out.fresh = [ring(), panel()];
      m.setInstallationTabsMode({ 'ui.dd_ring': '3', 'ui.dd_ring_groups': { security: '1' }, 'ui.dd_panel': '300', 'ui.dd_panel_groups': { security: 'button' } });
      out.inst = [ring(), panel()];
      await m.saveOwnDdRing('1.5', {});
      await m.saveOwnDdPanel('240', {});
      out.ownGlobal = [ring(), panel()];
      await m.saveOwnDdRing('1.5', { settings: '3' });
      await m.saveOwnDdPanel('240', { settings: 'button' });
      out.ownGroup = [ring(), panel()];
      await m.saveOwnDdRing(null, {});
      await m.saveOwnDdPanel(null, {});
      out.followed = [ring(), panel()];
      out.source = [m.resolveDdRing('security').source, m.resolveDdRing('area').source, m.resolveDdPanel('security').source];
      m.setInstallationTabsMode({ 'ui.dd_ring': 'bogus', 'ui.dd_ring_groups': { ghost: '1', home: '7' }, 'ui.dd_panel': '999', 'ui.dd_panel_groups': '{not json' });
      out.bogus = [ring(), panel()];
      out.pill = m.DD_STYLE_LABEL.pill;
      out.ids = [m.DD_STYLES.includes('pill'), m.DD_STYLE_LABEL.capsule];
      out.labels = [m.DD_RINGS.map((x: string) => m.DD_RING_LABEL[x]), m.DD_PANELS.map((x: string) => m.DD_PANEL_LABEL[x])];
      return out;
    }, MODE_URL);
    expect(r.fresh).toEqual([['2', '2', '2', '2', '2'], ['240', '240', '240', '240', '240']]);
    expect(r.inst).toEqual([['3', '3', '3', '1', '3'], ['300', '300', '300', 'button', '300']]);
    expect(r.ownGlobal).toEqual([['1.5', '1.5', '1.5', '1.5', '1.5'], ['240', '240', '240', '240', '240']]);
    expect(r.ownGroup).toEqual([['1.5', '1.5', '1.5', '1.5', '3'], ['240', '240', '240', '240', 'button']]);
    expect(r.followed).toEqual([['3', '3', '3', '1', '3'], ['300', '300', '300', 'button', '300']]);
    expect(r.source).toEqual(['installation-group', 'installation', 'installation-group']);
    expect(r.bogus).toEqual([['2', '2', '2', '2', '2'], ['240', '240', '240', '240', '240']]);
    expect(r.pill, 'the style id stays pill, only its label changes').toBe('כדור מלא');
    expect(r.ids).toEqual([true, 'קפסולה']);
    expect(r.labels).toEqual([['1 פיקסל', '1.5 פיקסל', '2 פיקסלים', '3 פיקסלים'], ['ברוחב הכפתור', '240 פיקסלים', '300 פיקסלים']]);
  });

  test('the shell: the chips of a group carry its ring and panel', async ({ page }) => {
    await mock(page, fresh());
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?design=a#/live');
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1000);
    await page.evaluate(async (url) => {
      const m = await import(/* @vite-ignore */ url);
      await m.saveOwnTabsMode(null, { security: 'dropdown' });
      await m.saveOwnDdStyle('capsule', {});
      await m.saveOwnDdRing(null, { security: '3' });
      await m.saveOwnDdPanel(null, { security: '300' });
    }, MODE_URL);
    await expect.poll(() => page.evaluate(() => {
      const out: string[] = [];
      const walk = (root: ParentNode) => {
        root.querySelectorAll('*').forEach((e) => {
          if (e.tagName === 'SW-DROPDOWN' && e.getAttribute('dd-style') === 'capsule') out.push(`${e.getAttribute('dd-ring')}/${e.getAttribute('dd-panel')}`);
          if (e.shadowRoot) walk(e.shadowRoot);
        });
      };
      walk(document);
      return out.length > 0 && out.every((s) => s === '3/300');
    })).toBe(true);
  });
});

test.describe('הגדרות › כללי › לשוניות › סגנון תפריט נפתח: the ring thickness and the panel width', () => {
  async function openCard(page: Page, srv: Server, width = 1280) {
    await mock(page, srv);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./?design=a#/system/diagnostics?tab=tabs');
    await page.waitForSelector('system-tabs-mode');
    await page.waitForTimeout(1200);
    return page.locator('system-tabs-mode');
  }

  test('the pill style reads "כדור מלא" in the style list, capsule stays "קפסולה"; ring has 4 options and the retina note, panel has 3', async ({ page }) => {
    const card = await openCard(page, fresh());
    await expect(card.locator('[data-dd-global=inst] option[value=pill]')).toHaveText('כדור מלא');
    await expect(card.locator('[data-dd-preview=pill] .muted')).toHaveText('כדור מלא');
    await expect(card.locator('[data-dd-global=inst] option[value=capsule]')).toHaveText('קפסולה');
    await expect(card.locator('[data-dd-dial-global="ring:inst"] option')).toHaveText(['1 פיקסל', '1.5 פיקסל', '2 פיקסלים', '3 פיקסלים']);
    await expect(card.locator('[data-dd-dial-global="ring:inst"]')).toHaveValue('2');
    await expect(card.locator('[data-dd-dial-global="panel:inst"] option')).toHaveText(['ברוחב הכפתור', '240 פיקסלים', '300 פיקסלים']);
    await expect(card.locator('[data-dd-dial-global="panel:inst"]')).toHaveValue('240');
    await expect(card.locator('[data-dd-dial-global="ring:own"] option')).toHaveCount(5); // follow + 4
    await expect(card.locator('[data-dd-dial-global="panel:own"] option')).toHaveCount(4);
    await expect(card.locator('[data-dd-dial-fieldset=ring]').first()).toContainText('רטינה');
    await expect(card.locator('[data-dd-dial-group-row^="ring:"]')).toHaveCount(10); // 5 groups, installation + own
    await expect(card.locator('[data-dd-dial-group-row^="panel:"]')).toHaveCount(10);
  });

  test('the installation default and a per-group override save to ui.dd_ring* / ui.dd_panel* and show in the live preview', async ({ page }) => {
    const srv = fresh();
    const card = await openCard(page, srv);
    await card.locator('[data-dd-dial-global="ring:inst"]').selectOption('3');
    await expect.poll(() => srv.patches.length).toBe(1);
    expect(srv.patches[0]).toEqual({ 'ui.dd_ring': '3', 'ui.dd_ring_groups': {} });
    await card.locator('[data-dd-dial-group="ring:inst:settings"]').selectOption('1');
    await expect.poll(() => srv.xi['ui.dd_ring_groups']).toEqual({ settings: '1' });
    await card.locator('[data-dd-dial-global="panel:inst"]').selectOption('300');
    await expect.poll(() => srv.xi['ui.dd_panel']).toBe('300');
    expect(srv.patches[2]).toEqual({ 'ui.dd_panel': '300', 'ui.dd_panel_groups': {} });
    await card.locator('[data-dd-dial-group="panel:inst:security"]').selectOption('button');
    await expect.poll(() => srv.xi['ui.dd_panel_groups']).toEqual({ security: 'button' });
    await expect(card.locator('[data-dd-effective-group=settings]')).toHaveAttribute('data-dd-ring', '1');
    await expect(card.locator('[data-dd-effective-group=area]')).toHaveAttribute('data-dd-ring', '3');
    await expect(card.locator('[data-dd-effective-group=security]')).toHaveAttribute('data-dd-panel', 'button');
    await expect(card.locator('[data-dd-size-preview=md] sw-tabs')).toHaveAttribute('dd-ring', '3');
    await expect(card.locator('[data-dd-size-preview=md] sw-tabs')).toHaveAttribute('dd-panel', '300');
    const ring = await card.locator('[data-dd-size-preview=md] sw-tabs').evaluate((e) => getComputedStyle((e.shadowRoot!.querySelector('sw-dropdown') as HTMLElement).shadowRoot!.querySelector('.chip')!, '::before').borderTopWidth);
    expect(ring).toBe('3px');
    await card.locator('[data-dd-dial-group="ring:inst:settings"]').selectOption('');
    await expect.poll(() => srv.xi['ui.dd_ring_groups']).toEqual({});
  });

  test('"ההעדפה שלי": its own choice (/me/prefs), wins over the installation, has its own reset; the installation is untouched', async ({ page }) => {
    const srv = fresh();
    srv.xi = { 'ui.dd_ring': '3', 'ui.dd_panel': '300' };
    const card = await openCard(page, srv);
    await expect(card.locator('[data-dd-ring-own-reset]')).toHaveCount(0);
    await card.locator('[data-dd-dial-global="ring:own"]').selectOption('1.5');
    await expect.poll(() => srv.xo['ui.dd_ring']).toBe('1.5');
    expect(srv.puts[0]).toEqual({ 'ui.dd_ring': '1.5', 'ui.dd_ring_groups': null });
    await card.locator('[data-dd-dial-group="panel:own:security"]').selectOption('240');
    await expect.poll(() => srv.xo['ui.dd_panel_groups']).toEqual({ security: '240' });
    await expect(card.locator('[data-dd-effective-group=area]')).toHaveAttribute('data-dd-ring', '1.5');
    await expect(card.locator('[data-dd-effective-group=security]')).toHaveAttribute('data-dd-panel', '240');
    await expect(card.locator('[data-dd-effective-group=area]')).toHaveAttribute('data-dd-panel', '300');
    expect(srv.patches).toHaveLength(0);
    await card.locator('[data-dd-ring-own-reset]').click();
    await expect.poll(() => [srv.xo['ui.dd_ring'], srv.xo['ui.dd_ring_groups']]).toEqual([null, null]);
    await card.locator('[data-dd-panel-own-reset]').click();
    await expect.poll(() => [srv.xo['ui.dd_panel'], srv.xo['ui.dd_panel_groups']]).toEqual([null, null]);
    await expect(card.locator('[data-dd-effective-group=area]')).toHaveAttribute('data-dd-ring', '3');
    await expect(card.locator('[data-dd-effective-group=security]')).toHaveAttribute('data-dd-panel', '300');
  });

  test('works on a phone width too', async ({ page }) => {
    const card = await openCard(page, fresh(), 390);
    await expect(card.locator('[data-dd-dial-global="ring:inst"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
