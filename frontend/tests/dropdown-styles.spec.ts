import { test, expect, type Page } from '@playwright/test';

// 0.1.157 (owner decision 2026-10-03: all six dropdown styles approved): the `dd-style` of sw-dropdown / sw-tabs, the resolver
// (user group > user global > installation group > installation global > auto), every style rendering in every skin, aria and keyboard
// kept, the touch / radius / performance dials, the shell using a style on a wide screen, and the Settings card "סגנון תפריט נפתח"
// against a mocked backend. Needs the Vite DEV server (imports /src/...):
//   $env:SW_API_PORT='59999'; npx vite --host 127.0.0.1 --port 5196   then
//   $env:SW_BASE_URL='http://127.0.0.1:5196/'; npx playwright test dropdown-styles --project=desktop --workers=1
const MODE_URL = '/src/shell/tabs-mode.ts';
const STYLES = ['auto', 'pill', 'field', 'underline', 'text', 'prefix', 'tonal', 'capsule'] as const;
const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;
const ADMIN = ['alarm.view', 'audit.read', 'devices.read', 'devices.control', 'entity.state.read', 'events.read', 'map.read', 'media.browse', 'media.control', 'media.read', 'rbac.assign', 'schedule.view', 'schedule.manage', 'sources.configure', 'system.configure', 'video.live', 'video.playback', 'access.read', 'automation.manage', 'script.run'];

type Server = { inst: { style: string; groups: Record<string, string> }; own: { style: string | null; groups: Record<string, string> | null }; patches: Record<string, unknown>[]; puts: Record<string, unknown>[] };
const fresh = (): Server => ({ inst: { style: 'auto', groups: {} }, own: { style: null, groups: null }, patches: [], puts: [] });

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
      if (srv.own.style) stored.push('ui.dd_style');
      if (srv.own.groups && Object.keys(srv.own.groups).length) stored.push('ui.dd_style_groups');
      return { prefs: { 'nav.order': ['devices', 'security', 'explore', 'multimedia', 'wiskey'], 'ui.dd_style': srv.own.style, 'ui.dd_style_groups': srv.own.groups }, stored, updated_at: null };
    };
    if (p === 'me/prefs' && req.method() === 'PUT') {
      const b = req.postDataJSON() as Record<string, unknown>;
      srv.puts.push(b);
      if ('ui.dd_style' in b) srv.own.style = b['ui.dd_style'] as string | null;
      if ('ui.dd_style_groups' in b) srv.own.groups = b['ui.dd_style_groups'] as Record<string, string> | null;
      return json(prefs());
    }
    if (p === 'me/prefs') return json(prefs());
    if (p === 'settings' && req.method() === 'PATCH') {
      const b = req.postDataJSON() as Record<string, unknown>;
      srv.patches.push(b);
      if ('ui.dd_style' in b) srv.inst.style = b['ui.dd_style'] as string;
      if ('ui.dd_style_groups' in b) srv.inst.groups = b['ui.dd_style_groups'] as Record<string, string>;
    }
    if (p === 'settings') return json({ settings: { 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.tabs': {}, 'multimedia.enabled': 'true', 'schedules.enabled': 'true', 'automations.enabled': 'true', 'ui.tabs_mode': 'tabs', 'ui.tabs_mode_groups': {}, 'ui.dd_style': srv.inst.style, 'ui.dd_style_groups': srv.inst.groups }, can_edit: true });
    if (p === 'multimedia/status') return json({ enabled: true, counts: { screens: 1, players: 2, groups: 1 } });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

async function stage(page: Page, skin: string = 'classic', width = 900) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(`./?design=a&skin=${skin}#/devices/building`);
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

/** One sw-tabs in dropdown form per style, six items, one carrying an alert, a count on the first. */
async function mount(page: Page, styles: readonly string[], extra = '') {
  await page.evaluate(
    ([list, css]) => {
      const items = [{ id: 'a', label: 'סלון', count: 6 }, { id: 'b', label: 'מטבח' }, { id: 'c', label: 'חדר שינה' }, { id: 'd', label: 'משרד', alert: true }, { id: 'e', label: 'מרפסת' }, { id: 'f', label: 'חצר' }];
      const st = document.querySelector('#stage') as HTMLElement;
      st.style.cssText += css;
      for (const s of list as string[]) {
        const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
        t.setAttribute('variant', 'dropdown');
        t.setAttribute('dd-style', s);
        t.setAttribute('group-label', 'אבטחה');
        t.setAttribute('data-t', s);
        t.items = items;
        t.active = 'a';
        st.appendChild(t);
      }
    },
    [styles as string[], extra] as [string[], string],
  );
  await page.waitForTimeout(300);
}

/** Computed values of the chip inside <sw-tabs data-t=style>'s dropdown. */
const chipInfo = (page: Page, style: string) =>
  page.evaluate((s) => {
    const dd = document.querySelector(`#stage sw-tabs[data-t="${s}"]`)!.shadowRoot!.querySelector('sw-dropdown')!;
    const chip = dd.shadowRoot!.querySelector('.chip') as HTMLElement;
    const cs = getComputedStyle(chip);
    const r = chip.getBoundingClientRect();
    return { attr: dd.getAttribute('dd-style'), bg: cs.backgroundColor, border: cs.borderTopColor, borderW: cs.borderTopWidth, radius: cs.borderTopLeftRadius, fs: cs.fontSize, h: Math.round(r.height), shadow: cs.boxShadow, color: cs.color, pre: !!dd.shadowRoot!.querySelector('[data-dd-prefix]') };
  }, style);

test.describe('the resolver (shell/tabs-mode.ts)', () => {
  test('auto by default; user group > user global > installation group > installation global; a bogus stored value reads as auto', async ({ page }) => {
    await mock(page, fresh());
    await page.goto('./?design=a#/devices/building');
    await page.waitForSelector('sw-app');
    const r = await page.evaluate(async (url) => {
      const m = await import(/* @vite-ignore */ url);
      const out: Record<string, unknown> = {};
      const at = () => ['home', 'area', 'multimedia', 'security', 'settings'].map((g) => m.ddStyleOf(g));
      m.setInstallationTabsMode({});
      await m.saveOwnDdStyle(null, {});
      out.fresh = at();
      m.setInstallationTabsMode({ 'ui.dd_style': 'pill', 'ui.dd_style_groups': { security: 'field' } });
      out.inst = at();
      await m.saveOwnDdStyle('tonal', {});
      out.ownGlobal = at();
      await m.saveOwnDdStyle('tonal', { settings: 'text' });
      out.ownGroup = at();
      await m.saveOwnDdStyle(null, {});
      out.followed = at();
      out.source = [m.resolveDdStyle('security').source, m.resolveDdStyle('area').source];
      m.setInstallationTabsMode({ 'ui.dd_style': 'bogus', 'ui.dd_style_groups': { ghost: 'pill', home: 'nonsense' } });
      out.bogus = at();
      out.labels = m.DD_STYLES.map((s: string) => m.DD_STYLE_LABEL[s]);
      return out;
    }, MODE_URL);
    expect(r.fresh).toEqual(['auto', 'auto', 'auto', 'auto', 'auto']);
    expect(r.inst).toEqual(['pill', 'pill', 'pill', 'field', 'pill']);
    expect(r.ownGlobal).toEqual(['tonal', 'tonal', 'tonal', 'tonal', 'tonal']);
    expect(r.ownGroup).toEqual(['tonal', 'tonal', 'tonal', 'tonal', 'text']);
    expect(r.followed).toEqual(['pill', 'pill', 'pill', 'field', 'pill']);
    expect(r.source).toEqual(['installation-group', 'installation']);
    expect(r.bogus).toEqual(['auto', 'auto', 'auto', 'auto', 'auto']);
    expect(r.labels).toHaveLength(8);
  });
});

test.describe('every style renders (sw-dropdown inside sw-tabs)', () => {
  test('six styles + auto are different looks of one control; aria and keyboard are the same in all', async ({ page }) => {
    await stage(page);
    await mount(page, STYLES);
    const seen = new Set<string>(); // the six real styles are all different (auto is today's look, which may equal one of them in a skin)
    for (const s of STYLES) {
      const c = await chipInfo(page, s);
      expect(c.attr).toBe(s);
      if (s !== 'auto') seen.add(`${c.bg}|${c.border}|${c.radius}|${c.fs}|${c.shadow}`);
      expect(c.pre).toBe(s === 'prefix');
    }
    expect(seen.size).toBe(7);
    // the distinguishing marks
    expect((await chipInfo(page, 'text')).fs).not.toBe((await chipInfo(page, 'pill')).fs);
    expect((await chipInfo(page, 'field')).borderW).toBe('1px');
    expect((await chipInfo(page, 'pill')).borderW).toBe('1px'); // transparent border, same box
    for (const s of STYLES) {
      const tabs = page.locator(`#stage sw-tabs[data-t="${s}"]`);
      const chip = tabs.locator('sw-dropdown .chip');
      await expect(chip).toHaveAttribute('aria-haspopup', 'listbox');
      await expect(chip).toHaveAttribute('aria-expanded', 'false');
      await chip.focus();
      await page.keyboard.press('ArrowDown');
      await expect(chip).toHaveAttribute('aria-expanded', 'true');
      const list = tabs.locator('sw-dropdown [role=listbox]');
      await expect(list).toBeVisible();
      await expect(list.locator('[role=option]')).toHaveCount(6);
      await expect(list.locator('[role=option][aria-selected=true]')).toHaveCount(1);
      await expect(list.locator('.dot[data-alert=alert]')).toHaveCount(1);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(chip).toHaveAttribute('aria-expanded', 'false');
      await expect(tabs).toHaveJSProperty('active', 'b');
      await tabs.evaluate((e) => ((e as HTMLElement & { active: string }).active = 'a'));
      await chip.focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await expect(chip).toHaveAttribute('aria-expanded', 'false');
    }
  });

  test('the prefix style shows the group name before the value; the others do not', async ({ page }) => {
    await stage(page);
    await mount(page, ['prefix', 'pill']);
    await expect(page.locator('#stage sw-tabs[data-t=prefix] sw-dropdown [data-dd-prefix]')).toHaveText('אבטחה');
    await expect(page.locator('#stage sw-tabs[data-t=pill] sw-dropdown [data-dd-prefix]')).toHaveCount(0);
  });

  for (const skin of SKINS) {
    test(`skin ${skin}: all styles draw a visible chip and an openable list`, async ({ page }) => {
      await stage(page, skin);
      await mount(page, STYLES);
      for (const s of STYLES) {
        const c = await chipInfo(page, s);
        expect(c.h, `${skin}/${s} chip height`).toBeGreaterThanOrEqual(28);
        const tabs = page.locator(`#stage sw-tabs[data-t="${s}"]`);
        await tabs.locator('sw-dropdown .chip').click();
        const list = tabs.locator('sw-dropdown [role=listbox]');
        await expect(list).toBeVisible();
        const box = await list.boundingBox();
        expect(box && box.width > 100 && box.height > 100).toBe(true);
        await page.keyboard.press('Escape');
      }
    });
  }

  test('tokens only: the accent token recolours underline and tonal; the radius token reshapes the pill and the field', async ({ page }) => {
    await stage(page);
    await mount(page, ['underline', 'tonal', 'pill', 'field']);
    const before = { u: await chipInfo(page, 'underline'), t: await chipInfo(page, 'tonal'), p: await chipInfo(page, 'pill'), f: await chipInfo(page, 'field') };
    await page.evaluate(() => {
      const st = document.querySelector('#stage') as HTMLElement;
      st.style.setProperty('--sw-accent', '#d6336c');
      st.style.setProperty('--sw-accent-text', '#d6336c');
      st.style.setProperty('--sw-accent-soft', '#fde0ea');
      st.style.setProperty('--sw-r-pill', '3px');
      st.style.setProperty('--sw-r-sm', '2px');
    });
    await page.waitForTimeout(100);
    const after = { u: await chipInfo(page, 'underline'), t: await chipInfo(page, 'tonal'), p: await chipInfo(page, 'pill'), f: await chipInfo(page, 'field') };
    expect(after.u.shadow).not.toBe(before.u.shadow);
    expect(after.t.bg).not.toBe(before.t.bg);
    expect(after.p.radius).toBe('3px');
    expect(after.f.radius).toBe('2px');
  });

  test('the touch dial (44 / 32) sets the chip and the option height; the hit area stays the dial', async ({ page }) => {
    await stage(page);
    await mount(page, ['pill'], ';--sw-touch-desktop:44px');
    const chip44 = (await chipInfo(page, 'pill')).h;
    const opt = async () => {
      const tabs = page.locator('#stage sw-tabs[data-t=pill]');
      await tabs.locator('sw-dropdown .chip').click();
      const h = await tabs.locator('sw-dropdown [role=option]').first().evaluate((e) => Math.round(e.getBoundingClientRect().height));
      await page.keyboard.press('Escape');
      return h;
    };
    const opt44 = await opt();
    await page.evaluate(() => (document.querySelector('#stage') as HTMLElement).style.setProperty('--sw-touch-desktop', '32px'));
    await page.waitForTimeout(100);
    const chip32 = (await chipInfo(page, 'pill')).h;
    const opt32 = await opt();
    expect(chip44).toBe(32);
    expect(chip32).toBe(28);
    expect(opt44).toBe(44);
    expect(opt32).toBe(32);
  });

  test('the performance tier: no backdrop-filter on the list when --sw-perf-blur is none; today\'s auto look keeps its blur in full', async ({ page }) => {
    await stage(page);
    await mount(page, ['pill', 'auto']);
    const blur = (s: string) =>
      page.evaluate(async (style) => {
        const tabs = document.querySelector(`#stage sw-tabs[data-t="${style}"]`)!;
        const dd = tabs.shadowRoot!.querySelector('sw-dropdown')!;
        (dd.shadowRoot!.querySelector('.chip') as HTMLElement).click();
        await new Promise((r) => setTimeout(r, 200));
        const v = getComputedStyle(dd.shadowRoot!.querySelector('.pop') as HTMLElement).backdropFilter;
        (dd.shadowRoot!.querySelector('.chip') as HTMLElement).click();
        await new Promise((r) => setTimeout(r, 100));
        return v;
      }, s);
    expect(await blur('auto')).toContain('blur');
    await page.evaluate(() => (document.querySelector('#stage') as HTMLElement).style.setProperty('--sw-perf-blur', 'none'));
    expect(await blur('auto')).toBe('none');
    expect(await blur('pill')).toBe('none');
  });

  test('text style on a narrow pair chip and long labels: the chip ellipsises instead of overflowing', async ({ page }) => {
    await stage(page, 'classic', 390);
    await page.evaluate(() => {
      const st = document.querySelector('#stage') as HTMLElement;
      st.style.alignItems = 'stretch';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;inline-size:100%';
      for (const s of ['text', 'prefix']) {
        const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
        t.setAttribute('variant', 'dropdown');
        t.setAttribute('dd-style', s);
        t.setAttribute('block', '');
        t.setAttribute('group-label', 'הגדרות');
        t.setAttribute('data-t', s);
        t.items = [{ id: 'a', label: 'משתמשים והרשאות ארוך מאוד מאוד מאוד' }, { id: 'b', label: 'ב' }];
        t.active = 'a';
        row.appendChild(t);
      }
      st.appendChild(row);
    });
    await page.waitForTimeout(300);
    const w = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(w).toBe(true);
  });
});

test.describe('the shell uses the group\'s style on a wide screen (0.1.157: no phone-only gate)', () => {
  test('security row at 1280 px: dropdown chips carry the installation style; a personal group choice wins', async ({ page }) => {
    const srv = fresh();
    srv.inst = { style: 'pill', groups: {} };
    await mock(page, srv);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?design=a#/live');
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1200);
    const styles = () =>
      page.evaluate(() => {
        const out: string[] = [];
        const walk = (root: ParentNode, inCard: boolean) => {
          root.querySelectorAll('*').forEach((e) => {
            const card = inCard || e.tagName === 'SYSTEM-TABS-MODE';
            if (e.tagName === 'SW-DROPDOWN' && !card) out.push(e.getAttribute('dd-style') ?? '');
            if (e.shadowRoot) walk(e.shadowRoot, card);
          });
        };
        walk(document, false);
        return out;
      });
    // the installation default is auto -> pill only when the mode is a dropdown: switch the security group to a dropdown (personal)
    await page.evaluate(async (url) => {
      const m = await import(/* @vite-ignore */ url);
      await m.saveOwnTabsMode(null, { security: 'dropdown' });
    }, MODE_URL);
    await expect.poll(async () => (await styles()).length).toBeGreaterThan(0);
    expect((await styles()).every((s) => s === 'pill')).toBe(true);
    await page.evaluate(async (url) => {
      const m = await import(/* @vite-ignore */ url);
      await m.saveOwnDdStyle(null, { security: 'underline' });
    }, MODE_URL);
    await expect.poll(async () => (await styles()).every((s) => s === 'underline')).toBe(true);
    // a chip is a real control at this width and the row keeps the alarm button
    await expect(page.locator('sw-app [data-tab-pair]')).toHaveCount(1);
  });
});

test.describe('הגדרות › כללי › לשוניות › סגנון תפריט נפתח', () => {
  async function openCard(page: Page, srv: Server, width = 1280) {
    await mock(page, srv);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./?design=a#/system/diagnostics?tab=tabs');
    await page.waitForSelector('system-tabs-mode');
    await page.waitForTimeout(1200);
    return page.locator('system-tabs-mode');
  }

  test('lists the eight styles, shows each live, defaults to auto and names the source of every group', async ({ page }) => {
    const card = await openCard(page, fresh());
    await expect(card.locator('[data-dd-global=inst] option')).toHaveCount(8);
    await expect(card.locator('[data-dd-global=own] option')).toHaveCount(9); // follow + 8
    await expect(card.locator('[data-dd-group-row]')).toHaveCount(10); // 5 groups x (installation, personal)
    await expect(card.locator('[data-dd-preview]')).toHaveCount(8);
    await expect(card.locator('[data-dd-effective-group]')).toHaveCount(5);
    await expect(card.locator('[data-dd-effective-group=security]')).toHaveAttribute('data-dd-style', 'auto');
    for (const s of STYLES) await expect(card.locator(`[data-dd-preview=${s}] sw-tabs`)).toHaveAttribute('dd-style', s);
  });

  test('the installation default and a per-group override save to ui.dd_style / ui.dd_style_groups and apply at once', async ({ page }) => {
    const srv = fresh();
    const card = await openCard(page, srv);
    await card.locator('[data-dd-global=inst]').selectOption('tonal');
    await expect.poll(() => srv.patches.length).toBe(1);
    expect(srv.patches[0]).toEqual({ 'ui.dd_style': 'tonal', 'ui.dd_style_groups': {} });
    await card.locator('[data-dd-group="inst:settings"]').selectOption('underline');
    await expect.poll(() => srv.inst.groups).toEqual({ settings: 'underline' });
    await expect(card.locator('[data-dd-effective-group=settings]')).toHaveAttribute('data-dd-style', 'underline');
    await expect(card.locator('[data-dd-effective-group=security]')).toHaveAttribute('data-dd-style', 'tonal');
    await card.locator('[data-dd-group="inst:settings"]').selectOption('');
    await expect.poll(() => srv.inst.groups).toEqual({});
  });

  test('"ההעדפה שלי" is its own choice (/me/prefs), wins over the installation, can be reset', async ({ page }) => {
    const srv = fresh();
    srv.inst = { style: 'pill', groups: {} };
    const card = await openCard(page, srv);
    await card.locator('[data-dd-global=own]').selectOption('field');
    await expect.poll(() => srv.own.style).toBe('field');
    expect(srv.puts[0]).toEqual({ 'ui.dd_style': 'field', 'ui.dd_style_groups': null });
    await card.locator('[data-dd-group="own:security"]').selectOption('text');
    await expect.poll(() => srv.own.groups).toEqual({ security: 'text' });
    await expect(card.locator('[data-dd-effective-group=security]')).toHaveAttribute('data-source', 'own-group');
    await expect(card.locator('[data-dd-effective-group=area]')).toHaveAttribute('data-source', 'own');
    expect(srv.patches).toHaveLength(0); // the installation was not touched
    await card.locator('[data-dd-own-reset]').click();
    await expect.poll(() => [srv.own.style, srv.own.groups]).toEqual([null, null]);
    await expect(card.locator('[data-dd-effective-group=security]')).toHaveAttribute('data-dd-style', 'pill');
  });

  test('works on a phone width too; nothing in the card names Home Assistant', async ({ page }) => {
    const card = await openCard(page, fresh(), 390);
    await expect(card.locator('[data-dd-style-card]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const text = (await card.innerText()).toLowerCase();
    expect(text).not.toContain('home assistant');
    expect(text).not.toContain('ingress');
  });
});
