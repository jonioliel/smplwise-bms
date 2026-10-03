import { test, expect, type Page } from '@playwright/test';

// Owner decision 2026-10-03: how a dropdown opens on a PHONE - a bottom sheet (default) or the regular small list under the field.
// `ui.dd_phone` (sheet | list): the installation's default (admins) and the user's own choice (null = follow), one global value.
// Covers the Settings card "תפריט נפתח בטלפון" (both levels, both options, persistence across a reload, a non-admin), the effect on
// `auto` and on the six styles at phone / tablet / desktop widths, and the full sheet: slide-up, handle, title, search, swipe down to
// close, reduced motion, dark, every skin. One project only (desktop): the widths are set inside the tests. Mock layer, no backend.
//   ~/run_remote.sh spec <branch> tests/dropdown-phone-choice.spec.ts --project=desktop
const ADMIN = ['alarm.view', 'audit.read', 'devices.read', 'devices.control', 'entity.state.read', 'events.read', 'map.read', 'media.browse', 'media.control', 'media.read', 'rbac.assign', 'schedule.view', 'schedule.manage', 'sources.configure', 'system.configure', 'video.live', 'video.playback', 'access.read', 'automation.manage', 'script.run'];
const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;
const WORDS = ['סלון', 'מטבח', 'חדר שינה', 'משרד', 'מרפסת', 'חצר', 'מחסן', 'חדר כביסה', 'חדר ילדים', 'פינת אוכל', 'גג', 'מעלית', 'חניה'];

type Server = { inst: string; own: string | null; patches: Record<string, unknown>[]; puts: Record<string, unknown>[]; canEdit: boolean; refuse: boolean };
const fresh = (): Server => ({ inst: 'sheet', own: null, patches: [], puts: [], canEdit: true, refuse: false });

async function mock(page: Page, srv: Server) {
  await page.route('**/api/v1/**', (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = srv.canEdit ? ADMIN : ADMIN.filter((x) => x !== 'system.configure');
      return json({
        channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    const prefs = () => ({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'multimedia', 'wiskey'], 'ui.dd_phone': srv.own }, stored: srv.own ? ['ui.dd_phone'] : [], updated_at: null });
    if (p === 'me/prefs' && req.method() === 'PUT') {
      const b = req.postDataJSON() as Record<string, unknown>;
      srv.puts.push(b);
      if (srv.refuse) return json({ code: 'validation', user_message: 'ערך לא תקין (בדיקה)', retryable: false, correlation_id: '', details: {} }, 422);
      if ('ui.dd_phone' in b) srv.own = b['ui.dd_phone'] as string | null;
      return json(prefs());
    }
    if (p === 'me/prefs') return json(prefs());
    if (p === 'settings' && req.method() === 'PATCH') {
      const b = req.postDataJSON() as Record<string, unknown>;
      srv.patches.push(b);
      if ('ui.dd_phone' in b) srv.inst = b['ui.dd_phone'] as string;
    }
    if (p === 'settings') return json({ settings: { 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.tabs': {}, 'multimedia.enabled': 'true', 'schedules.enabled': 'true', 'automations.enabled': 'true', 'ui.tabs_mode': 'tabs', 'ui.tabs_mode_groups': {}, 'ui.dd_style': 'auto', 'ui.dd_style_groups': {}, 'ui.dd_phone': srv.inst }, can_edit: srv.canEdit });
    if (p === 'multimedia/status') return json({ enabled: true, counts: { screens: 1, players: 2, groups: 1 } });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

async function stage(page: Page, srv: Server, o: { skin?: string; width?: number; scheme?: string } = {}) {
  await mock(page, srv);
  await page.setViewportSize({ width: o.width ?? 390, height: 800 });
  await page.goto('about:blank'); // a second stage() in one test must really reload (the URL hash is the same)
  await page.goto(`./?design=a&skin=${o.skin ?? 'classic'}&scheme=${o.scheme ?? 'light'}#/devices/building`);
  await page.waitForFunction(() => !!customElements.get('sw-dropdown') && !!customElements.get('sw-tabs'));
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    document.querySelectorAll('#stage').forEach((e) => e.remove());
    const st = document.createElement('div');
    st.id = 'stage';
    st.style.cssText = 'position:fixed;inset:0;z-index:10;background:var(--sw-bg,#fff);padding:24px 16px;display:flex;flex-direction:column;gap:20px;align-items:flex-start';
    document.body.appendChild(st);
  });
}

/** One sw-tabs in dropdown form per style (`auto` included); `n` options. */
async function mount(page: Page, styles: readonly string[], n = 6) {
  await page.evaluate(
    ([list, count, words]) => {
      const items = Array.from({ length: count as number }, (_, i) => ({ id: `i${i}`, label: (words as string[])[i % (words as string[]).length] + (i >= (words as string[]).length ? ` ${i}` : '') }));
      const st = document.querySelector('#stage') as HTMLElement;
      for (const s of list as string[]) {
        const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
        t.setAttribute('variant', 'dropdown');
        t.setAttribute('dd-style', s);
        t.setAttribute('group-label', 'אבטחה');
        t.setAttribute('data-t', s);
        t.items = items;
        t.active = 'i0';
        st.appendChild(t);
      }
    },
    [styles as string[], n, WORDS] as [string[], number, string[]],
  );
  await page.waitForTimeout(300);
}

const chip = (page: Page, s: string) => page.locator(`#stage sw-tabs[data-t="${s}"] sw-dropdown .chip`);
const pop = (page: Page, s: string) => page.locator(`#stage sw-tabs[data-t="${s}"] sw-dropdown .pop`);
const htmlAttr = (page: Page) => page.evaluate(() => document.documentElement.getAttribute('data-dd-phone'));

/** Open the dropdown, wait for the slide-up to end, and measure the open list. */
async function openAndMeasure(page: Page, s: string) {
  await chip(page, s).click();
  await page.waitForTimeout(700);
  const el = pop(page, s);
  return {
    present: await el.getAttribute('data-present'),
    box: await el.evaluate((e) => {
      const b = e.getBoundingClientRect();
      return { l: b.left, r: b.right, top: b.top, bottom: b.bottom, h: b.height, vh: window.innerHeight, vw: document.documentElement.clientWidth };
    }),
  };
}

test.describe('the setting in the Settings screen', () => {
  async function openCard(page: Page, srv: Server, width = 1280) {
    await mock(page, srv);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./?design=a#/system/diagnostics?tab=tabs');
    await page.waitForSelector('system-tabs-mode');
    await page.waitForTimeout(1200);
    return page.locator('[data-dd-phone-card]');
  }

  test('both levels: the default is the bottom sheet; the installation default and the personal choice save and apply at once', async ({ page }) => {
    const srv = fresh();
    const card = await openCard(page, srv);
    await expect(card).toBeVisible();
    await expect(card.locator('[data-dd-phone="inst:sheet"]')).toBeChecked();
    await expect(card.locator('[data-dd-phone="own:follow"]')).toBeChecked();
    await expect(card.locator('[data-dd-phone-effective]')).toContainText('גיליון שעולה מלמטה');
    expect(await htmlAttr(page)).toBe('sheet');
    // the installation default (an administrator)
    await card.locator('[data-dd-phone="inst:list"]').check();
    await expect.poll(() => srv.patches.length).toBe(1);
    expect(srv.patches[0]).toEqual({ 'ui.dd_phone': 'list' });
    await expect(card.locator('[data-dd-phone-effective]')).toContainText('רשימה קטנה מתחת לשדה');
    expect(await htmlAttr(page)).toBe('list');
    expect(srv.puts).toHaveLength(0);
    // the personal choice wins over the installation's
    await card.locator('[data-dd-phone="own:sheet"]').check();
    await expect.poll(() => srv.own).toBe('sheet');
    expect(srv.puts[0]).toEqual({ 'ui.dd_phone': 'sheet' });
    expect(await htmlAttr(page)).toBe('sheet');
    await expect(card.locator('[data-dd-phone-effective]')).toContainText('גיליון שעולה מלמטה');
    await card.locator('[data-dd-phone="own:list"]').check();
    await expect.poll(() => srv.own).toBe('list');
    expect(await htmlAttr(page)).toBe('list');
    // back to "follow the installation"
    await card.locator('[data-dd-phone="own:follow"]').check();
    await expect.poll(() => srv.own).toBeNull();
    expect(srv.puts[srv.puts.length - 1]).toEqual({ 'ui.dd_phone': null });
    expect(srv.patches).toHaveLength(1); // the installation was only touched by the first choice
  });

  test('persistence: a reload keeps the installation default and the personal choice', async ({ page }) => {
    const srv = fresh();
    srv.inst = 'list';
    srv.own = 'sheet';
    const card = await openCard(page, srv);
    await expect(card.locator('[data-dd-phone="inst:list"]')).toBeChecked();
    await expect(card.locator('[data-dd-phone="own:sheet"]')).toBeChecked();
    expect(await htmlAttr(page)).toBe('sheet');
    await page.reload();
    await page.waitForSelector('system-tabs-mode');
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-dd-phone="own:sheet"]')).toBeChecked();
    expect(await htmlAttr(page)).toBe('sheet');
    // a user who follows the installation gets the installation's value
    srv.own = null;
    await page.reload();
    await page.waitForSelector('system-tabs-mode');
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-dd-phone="own:follow"]')).toBeChecked();
    expect(await htmlAttr(page)).toBe('list');
  });

  test('a user without the system permission can only change the personal choice; a refused save is reverted', async ({ page }) => {
    const srv = fresh();
    srv.canEdit = false;
    const card = await openCard(page, srv);
    await expect(card.locator('[data-dd-phone="inst:list"]')).toBeDisabled();
    await expect(card.locator('[data-dd-phone="own:list"]')).toBeEnabled();
    srv.refuse = true;
    await card.locator('[data-dd-phone="own:list"]').click(); // not check(): the optimistic choice is reverted when the server refuses
    await expect.poll(() => srv.puts.length).toBe(1);
    await expect(card.locator('[role=alert]')).toBeVisible();
    await expect(card.locator('[data-dd-phone="own:follow"]')).toBeChecked();
    expect(await htmlAttr(page)).toBe('sheet');
  });

  test('on a phone width: nothing overflows, labels are plain (no Home Assistant), no paragraphs', async ({ page }) => {
    const card = await openCard(page, fresh(), 390);
    await expect(card).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const text = (await card.innerText()).toLowerCase();
    expect(text).not.toContain('home assistant');
    expect(text).not.toContain('ingress');
    await expect(card.locator('.muted')).toHaveCount(0);
    await expect(card.locator('input[type=radio]')).toHaveCount(5);
  });
});

test.describe('what the setting does at phone, tablet and desktop widths', () => {
  const STYLES = ['auto', 'pill', 'field', 'underline', 'text', 'prefix', 'tonal'] as const;

  test('phone + sheet: auto and the six styles open a bottom sheet (full width, at the bottom, handle + title, 48 px options)', async ({ page }) => {
    await stage(page, fresh(), { width: 390 });
    expect(await htmlAttr(page)).toBe('sheet');
    await mount(page, STYLES);
    for (const s of STYLES) {
      const m = await openAndMeasure(page, s);
      expect(m.present, s).toBe('sheet');
      expect(m.box.l, s).toBeLessThanOrEqual(1);
      expect(m.box.r, s).toBeGreaterThanOrEqual(m.box.vw - 1);
      expect(Math.abs(m.box.bottom - m.box.vh), s).toBeLessThanOrEqual(1);
      expect(m.box.h, s).toBeLessThanOrEqual(m.box.vh * 0.72 + 1);
      const inner = await pop(page, s).evaluate((el) => {
        const root = el.getRootNode() as ShadowRoot;
        return { grab: !!root.querySelector('.grab'), ttl: root.querySelector('.ttl')?.textContent, opt: root.querySelector('.opt')!.getBoundingClientRect().height };
      });
      expect(inner.grab, s).toBe(true);
      expect(inner.ttl, s).toBe('אבטחה');
      expect(inner.opt, s).toBeGreaterThanOrEqual(48);
      await page.keyboard.press('Escape');
      await expect(chip(page, s)).toHaveAttribute('aria-expanded', 'false');
    }
  });

  test('phone + list: auto and the six styles open the regular small list under the field, no backdrop', async ({ page }) => {
    const srv = fresh();
    srv.own = 'list';
    await stage(page, srv, { width: 390 });
    expect(await htmlAttr(page)).toBe('list');
    await mount(page, STYLES);
    for (const s of STYLES) {
      await chip(page, s).click();
      await page.waitForTimeout(300);
      await expect(pop(page, s), s).toHaveAttribute('data-present', 'pop');
      const r = await page.evaluate((st) => {
        const dd = document.querySelector(`#stage sw-tabs[data-t="${st}"]`)!.shadowRoot!.querySelector('sw-dropdown')!;
        const p = dd.shadowRoot!.querySelector('.pop') as HTMLElement;
        const c = dd.shadowRoot!.querySelector('.chip') as HTMLElement;
        return { popTop: p.getBoundingClientRect().top, chipBottom: c.getBoundingClientRect().bottom, fullWidth: p.getBoundingClientRect().width >= document.documentElement.clientWidth - 1, grab: !!dd.shadowRoot!.querySelector('.grab') };
      }, s);
      expect(r.popTop, s).toBeGreaterThanOrEqual(r.chipBottom - 1);
      expect(r.fullWidth, s).toBe(false);
      expect(r.grab, s).toBe(false);
      await page.keyboard.press('Escape');
    }
  });

  for (const [name, width] of [['tablet', 1024], ['desktop', 1440], ['just above the phone', 768]] as const) {
    test(`${name} (${width} px): the same popover whatever the setting says`, async ({ page }) => {
      for (const choice of ['sheet', 'list']) {
        const srv = fresh();
        srv.own = choice;
        await stage(page, srv, { width });
        expect(await htmlAttr(page)).toBe(choice);
        await mount(page, ['auto', 'pill']);
        for (const s of ['auto', 'pill']) {
          await chip(page, s).click();
          await page.waitForTimeout(300);
          await expect(pop(page, s), `${choice}/${s}`).toHaveAttribute('data-present', 'pop');
          await page.keyboard.press('Escape');
        }
      }
    });
  }

  test('crossing the phone width while the setting is sheet: the next open follows the new width', async ({ page }) => {
    await stage(page, fresh(), { width: 390 });
    await mount(page, ['auto']);
    await chip(page, 'auto').click();
    await expect(pop(page, 'auto')).toHaveAttribute('data-present', 'sheet');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.waitForTimeout(300);
    await chip(page, 'auto').click();
    await expect(pop(page, 'auto')).toHaveAttribute('data-present', 'pop');
  });

  test('the Bubble popup dial still refines the sheet (centred / inline), while `list` ignores it', async ({ page }) => {
    await stage(page, fresh(), { width: 390, skin: 'bubble' });
    await mount(page, ['auto']);
    await page.evaluate(() => document.documentElement.setAttribute('data-bubble-popup', 'centred'));
    await chip(page, 'auto').click();
    await expect(pop(page, 'auto')).toHaveAttribute('data-present', 'centred');
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-dd-phone', 'list');
    });
    await chip(page, 'auto').click();
    await expect(pop(page, 'auto')).toHaveAttribute('data-present', 'pop');
  });
});

test.describe('the bottom sheet in full (mockup scope)', () => {
  test('a long list: handle, title, search field on top, the options scroll under it, typing filters; Esc and the backdrop close', async ({ page }) => {
    await stage(page, fresh(), { width: 390 });
    await mount(page, ['auto'], 13);
    await chip(page, 'auto').click();
    await page.waitForTimeout(700);
    const r = await pop(page, 'auto').evaluate((el) => {
      const root = el.getRootNode() as ShadowRoot;
      const q = root.querySelector('.search')!.getBoundingClientRect();
      const lb = root.querySelector('.lb') as HTMLElement;
      const g = root.querySelector('.grab')!.getBoundingClientRect();
      return { qTop: q.top - el.getBoundingClientRect().top, grabTop: g.top - el.getBoundingClientRect().top, scrolls: lb.scrollHeight > lb.clientHeight, opts: root.querySelectorAll('.opt').length };
    });
    expect(r.grabTop).toBeLessThan(r.qTop);
    expect(r.scrolls).toBe(true);
    expect(r.opts).toBe(13);
    await page.locator('#stage sw-tabs[data-t="auto"] sw-dropdown .q').fill('מטבח');
    await expect.poll(() => pop(page, 'auto').evaluate((el) => (el.getRootNode() as ShadowRoot).querySelectorAll('.opt').length)).toBe(1);
    await page.keyboard.press('Escape');
    await expect(chip(page, 'auto')).toHaveAttribute('aria-expanded', 'false');
    await chip(page, 'auto').click();
    await page.waitForTimeout(700);
    await page.mouse.click(195, 30); // the dimmed backdrop
    await expect(chip(page, 'auto')).toHaveAttribute('aria-expanded', 'false');
  });

  test('the sheet slides up on open (an animation from below) and the animation is off under prefers-reduced-motion', async ({ page }) => {
    await stage(page, fresh(), { width: 390 });
    await mount(page, ['pill']);
    await chip(page, 'pill').click();
    expect(await pop(page, 'pill').evaluate((el) => getComputedStyle(el).animationName)).toBe('dd-sheet-in');
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await chip(page, 'pill').click();
    expect(await pop(page, 'pill').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });

  test('swipe down on the handle: a short drag springs back, a long one closes the sheet', async ({ page }) => {
    await stage(page, fresh(), { width: 390 });
    await mount(page, ['pill'], 6);
    await chip(page, 'pill').click();
    await page.waitForTimeout(700);
    const grab = page.locator('#stage sw-tabs[data-t="pill"] sw-dropdown .grab');
    const gb = (await grab.boundingBox())!;
    const x = gb.x + gb.width / 2;
    const y = gb.y + gb.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 30, { steps: 4 });
    await page.waitForTimeout(500); // slow: not a flick
    await page.mouse.up();
    await expect(chip(page, 'pill')).toHaveAttribute('aria-expanded', 'true');
    expect(await pop(page, 'pill').evaluate((el) => (el as HTMLElement).style.transform)).toBe('');
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 250, { steps: 8 });
    await page.mouse.up();
    await expect(chip(page, 'pill')).toHaveAttribute('aria-expanded', 'false');
    // it opens normally afterwards
    await chip(page, 'pill').click();
    await expect(chip(page, 'pill')).toHaveAttribute('aria-expanded', 'true');
    expect(await pop(page, 'pill').evaluate((el) => (el as HTMLElement).style.transform)).toBe('');
  });

  for (const skin of SKINS) {
    for (const scheme of ['light', 'dark']) {
      test(`${skin} / ${scheme}: the sheet is readable (opaque enough list text, handle visible, inside the screen)`, async ({ page }) => {
        await stage(page, fresh(), { width: 390, skin, scheme });
        await mount(page, ['auto', 'pill'], 9);
        for (const s of ['auto', 'pill']) {
          await chip(page, s).click();
          await page.waitForTimeout(700);
          const r = await pop(page, s).evaluate((el) => {
            const root = el.getRootNode() as ShadowRoot;
            const cs = getComputedStyle(el);
            const g = getComputedStyle(root.querySelector('.grab')!);
            const b = el.getBoundingClientRect();
            return { present: el.getAttribute('data-present'), bg: cs.backgroundColor, grabBg: g.backgroundColor, text: getComputedStyle(root.querySelector('.opt')!).color, inside: b.left >= -1 && b.right <= document.documentElement.clientWidth + 1 && b.bottom <= window.innerHeight + 1, search: !!root.querySelector('.search') };
          });
          expect(r.present, `${skin}/${scheme}/${s}`).toBe('sheet');
          expect(r.inside, `${skin}/${scheme}/${s}`).toBe(true);
          expect(r.search, `${skin}/${scheme}/${s}`).toBe(true);
          expect(r.grabBg, `${skin}/${scheme}/${s}`).not.toBe('rgba(0, 0, 0, 0)');
          expect(r.text, `${skin}/${scheme}/${s}`).not.toBe(r.bg);
          await page.keyboard.press('Escape');
        }
      });
    }
  }

  test('keyboard keeps working in the sheet: arrows move, Enter chooses and fires change, focus returns to the chip', async ({ page }) => {
    await stage(page, fresh(), { width: 390 });
    await mount(page, ['auto']);
    await page.evaluate(() => {
      (window as unknown as { __chg: string[] }).__chg = [];
      document.querySelector('#stage sw-tabs[data-t="auto"]')!.addEventListener('change', (e) => (window as unknown as { __chg: string[] }).__chg.push(JSON.stringify((e as CustomEvent).detail)));
    });
    await chip(page, 'auto').focus();
    await page.keyboard.press('ArrowDown');
    await expect(pop(page, 'auto')).toHaveAttribute('data-present', 'sheet');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(chip(page, 'auto')).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => (window as unknown as { __chg: string[] }).__chg.length)).toBeGreaterThan(0);
  });
});

/** The bottom sheet slides out for 200 ms after it closes; wait until its popover is really gone (the documented wait for specs that close a sheet). */
async function sheetGone(page: Page, s: string) {
  await expect(pop(page, s)).toBeHidden({ timeout: 2000 });
}

test.describe('the bottom sheet in full: closing, blur, modal page, keyboard', () => {
  test('closing slides out for 200 ms: aria-expanded is false at once, the sheet is gone after the animation; reduced motion closes at once', async ({ page }) => {
    await stage(page, fresh(), { width: 390 });
    await mount(page, ['pill']);
    await chip(page, 'pill').click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await expect(chip(page, 'pill')).toHaveAttribute('aria-expanded', 'false');
    const during = await pop(page, 'pill').evaluate((el) => ({ hidden: el.hasAttribute('hidden'), cls: el.className, anim: getComputedStyle(el).animationName, dur: getComputedStyle(el).animationDuration }));
    expect(during.hidden).toBe(false);
    expect(during.cls).toContain('closing');
    expect(during.anim).toBe('dd-sheet-out');
    expect(during.dur).toBe('0.2s');
    await sheetGone(page, 'pill');
    // opening again during the slide-out works and ends in an open sheet
    await chip(page, 'pill').click();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await chip(page, 'pill').click();
    await page.waitForTimeout(700);
    await expect(chip(page, 'pill')).toHaveAttribute('aria-expanded', 'true');
    expect(await pop(page, 'pill').evaluate((el) => el.className.includes('closing'))).toBe(false);
    await page.keyboard.press('Escape');
    await sheetGone(page, 'pill');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await chip(page, 'pill').click();
    await page.keyboard.press('Escape');
    await expect(pop(page, 'pill')).toBeHidden({ timeout: 300 });
  });

  test('the page behind is blurred 3 px by the scrim; none in the lite performance tier', async ({ page }) => {
    await stage(page, fresh(), { width: 390 });
    await mount(page, ['pill']);
    await chip(page, 'pill').click();
    await page.waitForTimeout(500);
    expect(await pop(page, 'pill').evaluate((el) => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('blur(3px)');
    await page.keyboard.press('Escape');
    await sheetGone(page, 'pill');
    await page.evaluate(() => document.documentElement.style.setProperty('--sw-perf-blur', 'none'));
    await chip(page, 'pill').click();
    await page.waitForTimeout(500);
    expect(await pop(page, 'pill').evaluate((el) => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('none');
  });

  test('phone: the page behind the sheet is inert and Tab stays inside it; everything is live again after closing', async ({ page }) => {
    await stage(page, fresh(), { width: 390 });
    await mount(page, ['auto'], 13);
    await chip(page, 'auto').click();
    await page.waitForTimeout(600);
    const inertNow = await page.evaluate(() => ({ app: (document.querySelector('sw-app') as HTMLElement).inert, stage: (document.querySelector('#stage') as HTMLElement).inert, chip: (document.querySelector('#stage sw-tabs[data-t="auto"]')!.shadowRoot!.querySelector('sw-dropdown')!.shadowRoot!.querySelector('.chip') as HTMLElement).inert }));
    expect(inertNow.app).toBe(true);
    expect(inertNow.chip).toBe(true);
    expect(inertNow.stage).toBe(false); // the stage holds the sheet's own chain
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab');
      const where = await page.evaluate(() => {
        const dd = document.querySelector('#stage sw-tabs[data-t="auto"]')!.shadowRoot!.querySelector('sw-dropdown')!;
        return { inside: dd.shadowRoot!.activeElement?.closest?.('.pop') !== null && !!dd.shadowRoot!.activeElement, open: dd.shadowRoot!.querySelector('.chip')!.getAttribute('aria-expanded') };
      });
      expect(where.inside).toBe(true);
      expect(where.open).toBe('true');
    }
    await page.keyboard.press('Escape');
    await sheetGone(page, 'auto');
    const after = await page.evaluate(() => ({ app: (document.querySelector('sw-app') as HTMLElement).inert, inerts: document.querySelectorAll('[inert]').length, chip: (document.querySelector('#stage sw-tabs[data-t="auto"]')!.shadowRoot!.querySelector('sw-dropdown')!.shadowRoot!.querySelector('.chip') as HTMLElement).inert }));
    expect(after.app).toBe(false);
    expect(after.chip).toBe(false);
    expect(after.inerts).toBe(0);
    await expect(chip(page, 'auto')).toBeFocused();
  });

  test('desktop and tablet are unchanged: nothing becomes inert and Tab still closes the popover', async ({ page }) => {
    for (const width of [1024, 1440]) {
      await stage(page, fresh(), { width });
      await mount(page, ['auto', 'pill'], 13);
      for (const s of ['auto', 'pill']) {
        await chip(page, s).click();
        await page.waitForTimeout(300);
        expect(await page.evaluate(() => document.querySelectorAll('[inert]').length), `${width}/${s}`).toBe(0);
        await page.keyboard.press('Tab');
        await expect(chip(page, s), `${width}/${s}`).toHaveAttribute('aria-expanded', 'false');
        await expect(pop(page, s)).toBeHidden({ timeout: 300 });
      }
    }
  });

  test('the on-screen keyboard (emulated visualViewport): the sheet rises above it and its height is capped by the visible area', async ({ page }) => {
    await stage(page, fresh(), { width: 390 });
    await mount(page, ['auto'], 13);
    await chip(page, 'auto').click();
    await page.waitForTimeout(600);
    const base = await pop(page, 'auto').evaluate((el) => el.getBoundingClientRect().bottom - window.innerHeight);
    expect(Math.abs(base)).toBeLessThanOrEqual(1);
    // a 420 px keyboard: the visual viewport is 380 px tall
    await page.evaluate(() => {
      const vv = window.visualViewport!;
      Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - 420 });
      vv.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(200);
    const up = await pop(page, 'auto').evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { gap: window.innerHeight - b.bottom, h: b.height, vis: window.innerHeight - 420, top: b.top };
    });
    expect(up.gap).toBeGreaterThanOrEqual(418);
    expect(up.gap).toBeLessThanOrEqual(422);
    expect(up.h).toBeLessThanOrEqual(up.vis - 16 + 1);
    expect(up.top).toBeGreaterThanOrEqual(0);
    // the keyboard goes away: back to the bottom edge
    await page.evaluate(() => {
      const vv = window.visualViewport!;
      Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight });
      vv.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(200);
    expect(Math.abs(await pop(page, 'auto').evaluate((el) => el.getBoundingClientRect().bottom - window.innerHeight))).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await sheetGone(page, 'auto');
    expect(await pop(page, 'auto').evaluate((el) => (el as HTMLElement).style.getPropertyValue('--dd-kb'))).toBe('');
  });
});
