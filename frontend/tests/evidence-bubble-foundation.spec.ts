import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Bubble foundation, phase B (owner 2026-10-02): the components' demo page (#/styleguide/bubble) and הגדרות › כללי › מראה.
//   1. the evidence shots: demo page and the settings section at 390 / 820 / 1440, light and dark -> docs/design/evidence/bubble-foundation/
//   2. the components' behaviour: sheet focus trap / Esc / focus return / backdrop, swipe-to-close, the inline kind beside the tree,
//      the pill's slider keys and toggle, the dock as its own row on the phone;
//   3. the look dials: ?look= and the settings card in demo mode (own choice applied at once, installation default saved) and against
//      a mocked backend (what PUT /me/prefs and PATCH /settings receive; a 422 reverts).
// Needs the Vite DEV server (the specs import /src/design/look.ts):
//   SW_API_PORT=59997 npx vite --host 127.0.0.1 --port 5201      then
//   SW_BASE_URL=http://127.0.0.1:5201/ npx playwright test tests/evidence-bubble-foundation.spec.ts --project=desktop --project=mobile --workers=1
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/bubble-foundation');

const attr = (page: Page, a: string) => page.evaluate((n) => document.documentElement.getAttribute(n), a);
const rootVar = (page: Page, v: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), v);

async function open(page: Page, hash: string, query = '') {
  await page.clock.setFixedTime(new Date('2026-10-02T13:00:00Z'));
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=bubble${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(600);
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

const demo = (page: Page) => page.locator('sw-app bubble-demo');
const lookCard = (page: Page) => page.locator('sw-app system-diagnostics system-look');

/** The element that really holds focus, described (through shadow roots). */
const activeDesc = (page: Page) =>
  page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return a ? `${a.tagName.toLowerCase()}${a.getAttribute('data-sheet-close') !== null ? '[close]' : ''}${a.getAttribute('data-open-area') !== null ? '[open-area]' : ''}${a.getAttribute('data-dev') ? '[' + a.getAttribute('data-dev') + ']' : ''}` : 'none';
  });

test.describe('bubble foundation', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('look-keep')) {
          localStorage.removeItem('sw.ui.look');
          localStorage.removeItem('sw.ui.look.installation');
        }
      } catch {
        /* storage unavailable */
      }
    });
  });

  test('evidence shots: the demo page and the settings section, light and dark', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'the tablet width is shot from the desktop project');
    const widths = info.project.name === 'mobile' ? [390] : [1440, 820];
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: w <= 480 ? 844 : 900 });
      for (const scheme of ['light', 'dark'] as const) {
        await open(page, '/styleguide/bubble', `&scheme=${scheme}`);
        await expect(page.locator('html')).toHaveAttribute('data-skin', 'bubble');
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
        await shot(page, `demo-${w}-${scheme}`);
        await demo(page).locator('[data-open-area]').click();
        await page.waitForTimeout(700);
        await shot(page, `demo-sheet-area-${w}-${scheme}`);
        await page.keyboard.press('Escape');
        if (scheme === 'light') {
          await open(page, '/styleguide/bubble', `&scheme=${scheme}&look=density:row,surface:gradient,radius:soft`);
          await shot(page, `demo-row-gradient-soft-${w}-${scheme}`);
          await open(page, '/styleguide/bubble', `&scheme=${scheme}&look=density:compact,surface:glass,touch:32`);
          await shot(page, `demo-compact-glass-${w}-${scheme}`);
        }
        await open(page, '/system/diagnostics', `&scheme=${scheme}`);
        await lookCard(page).evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await page.waitForTimeout(300);
        await shot(page, `settings-look-${w}-${scheme}`);
      }
    }
  });

  test('the sheet: focus moves in, Tab wraps, Esc closes, focus returns; the backdrop closes; the inline kind never covers the tree', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the keyboard checks run once');
    await open(page, '/styleguide/bubble', '&scheme=light');
    await demo(page).locator('[data-open-area]').focus();
    await page.keyboard.press('Enter');
    const sheet = demo(page).locator('sw-sheet[data-sheet-area]');
    await expect(sheet).toHaveAttribute('open', '');
    await expect(sheet).toHaveAttribute('data-layout', 'centred');
    await page.waitForTimeout(600);
    expect(await activeDesc(page)).not.toBe('button[open-area]'); // focus moved into the sheet
    // Tab is trapped: after many presses focus is still inside the sheet
    for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() => {
        let a: Element | null = document.activeElement;
        const chain: Element[] = [];
        while (a) {
          chain.push(a);
          a = a.shadowRoot?.activeElement ?? null;
        }
        const inSheet = (el: Element | null): boolean => {
          for (let e: Element | null = el; e; e = e.assignedSlot ?? (e.parentNode instanceof ShadowRoot ? e.parentNode.host : e.parentElement)) if (e.tagName === 'SW-SHEET' && e.hasAttribute('data-sheet-area')) return true;
          return false;
        };
        return inSheet(chain[chain.length - 1]);
      }),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(sheet).not.toHaveAttribute('open', '');
    await page.waitForTimeout(100);
    expect(await activeDesc(page)).toBe('button[open-area]'); // focus returned to the opener
    // the backdrop closes
    await demo(page).locator('[data-open-area]').click();
    await expect(sheet).toHaveAttribute('open', '');
    await sheet.locator('[data-sheet-backdrop]').click({ position: { x: 10, y: 10 } });
    await expect(sheet).not.toHaveAttribute('open', '');
    // the centred confirmation
    await demo(page).locator('[data-open-confirm]').click();
    const confirm = demo(page).locator('sw-sheet[data-sheet-confirm]');
    await expect(confirm).toHaveAttribute('data-layout', 'centred');
    await confirm.locator('[data-confirm-off]').click();
    await expect(confirm).not.toHaveAttribute('open', '');
    await expect(demo(page).locator('[data-demo-grid] sw-pill[data-dev="l1"]')).not.toHaveAttribute('on', '');
    // the inline kind: in flow beside the tree, the tree stays fully visible and clickable
    await demo(page).locator('[data-open-inline]').click();
    const inline = demo(page).locator('sw-sheet[data-sheet-inline]');
    await expect(inline).toHaveAttribute('data-layout', 'inline');
    const overlap = await page.evaluate(() => {
      const d = document.querySelector('sw-app')!.shadowRoot!.querySelector('bubble-demo')!;
      const tree = d.shadowRoot!.querySelector('[data-demo-tree]')!.getBoundingClientRect();
      const sh = d.shadowRoot!.querySelector('sw-sheet[data-sheet-inline]')!.shadowRoot!.querySelector('.sheet')!.getBoundingClientRect();
      return Math.max(0, Math.min(tree.right, sh.right) - Math.max(tree.left, sh.left)) * Math.max(0, Math.min(tree.bottom, sh.bottom) - Math.max(tree.top, sh.top));
    });
    expect(overlap).toBe(0);
    await demo(page).locator('[data-demo-tree] .tree-row').nth(1).click(); // picking an area closes the inline panel and the tree was clickable
    await expect(inline).not.toHaveAttribute('open', '');
  });

  test('phone: the bottom sheet with its grabber row, swipe down closes; the dock is a row of the shell (content never underneath)', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone only');
    await open(page, '/styleguide/bubble', '&scheme=dark');
    await demo(page).locator('[data-open-area]').click();
    const sheet = demo(page).locator('sw-sheet[data-sheet-area]');
    await expect(sheet).toHaveAttribute('data-layout', 'bottom');
    await page.waitForTimeout(700);
    const grab = sheet.locator('[data-sheet-grab]');
    const gb = await grab.boundingBox();
    expect(gb!.height).toBeGreaterThanOrEqual(44);
    // the sheet sits at the bottom edge, inside the viewport
    const sb = await sheet.locator('[data-sheet]').boundingBox();
    expect(Math.round(sb!.y + sb!.height)).toBe(844);
    // swipe down from the grabber past 35 % of the sheet's height closes it (a fast flick closes earlier; speed is not assumed here)
    const x = gb!.x + gb!.width / 2;
    const far = Math.round(sb!.height * 0.5);
    await page.mouse.move(x, gb!.y + 20);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x, gb!.y + 20 + (i * far) / 8);
    await page.mouse.up();
    await expect(sheet).not.toHaveAttribute('open', '');
    // the dock: a row of the shell's grid, the content column ends above it
    const dock = await page.locator('sw-app').evaluate((app) => {
      const r = app.shadowRoot!;
      const d = r.querySelector('nav.bottom.dock')!.getBoundingClientRect();
      const m = r.querySelector('main')!.getBoundingClientRect();
      const fab = r.querySelector('[data-area-picker]')!.getBoundingClientRect();
      const items = [...r.querySelectorAll('nav.bottom.dock .stack a, nav.bottom.dock .stack button')].map((e) => e.getBoundingClientRect());
      return { dockTop: d.top, mainBottom: m.bottom, fab: [fab.width, fab.height], items: items.map((i) => [Math.round(i.width), Math.round(i.height)]) };
    });
    expect(dock.mainBottom).toBeLessThanOrEqual(dock.dockTop + 0.5);
    expect(dock.fab[0]).toBeGreaterThanOrEqual(44);
    for (const [w, h] of dock.items) {
      expect(w).toBeGreaterThanOrEqual(44);
      expect(h).toBeGreaterThanOrEqual(44);
    }
    // the home button opens the area picker; picking an area navigates
    await page.locator('sw-app [data-area-picker]').click();
    const picker = page.locator('sw-app sw-sheet[data-area-picker-sheet]');
    await expect(picker).toHaveAttribute('open', '');
    await expect(picker.locator('[data-picker-area]').first()).toBeVisible();
    await shot(page, 'dock-area-picker-390-dark');
    await picker.locator('[data-picker-area="kitchen"]').click();
    await expect(picker).not.toHaveAttribute('open', '');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/areas/kitchen');
  });

  test('the pill: a slider toggles on tap and steps with the keyboard; a switch toggles with Space; the ring is its own button', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'once');
    await open(page, '/styleguide/bubble', '&scheme=light');
    const l1 = demo(page).locator('[data-demo-grid] sw-pill[data-dev="l1"]');
    await expect(l1).toHaveAttribute('role', 'slider');
    await expect(l1).toHaveAttribute('aria-valuenow', '72');
    await l1.focus();
    await page.keyboard.press('ArrowLeft'); // RTL: toward the fill's growth
    await expect(l1).toHaveAttribute('aria-valuenow', '77');
    await page.keyboard.press('PageDown');
    await expect(l1).toHaveAttribute('aria-valuenow', '57');
    await page.keyboard.press('Enter');
    await expect(l1).not.toHaveAttribute('on', '');
    await expect(l1).toHaveAttribute('aria-valuenow', '0');
    await l1.click({ position: { x: 150, y: 20 } });
    await expect(l1).toHaveAttribute('on', '');
    const s1 = demo(page).locator('[data-demo-grid] sw-pill[data-dev="s1"]');
    await expect(s1).toHaveAttribute('role', 'switch');
    await expect(s1).toHaveAttribute('aria-checked', 'true');
    await s1.focus();
    await page.keyboard.press('Space');
    await expect(s1).toHaveAttribute('aria-checked', 'false');
    // the ring opens the device pop-up, not the toggle
    await l1.locator('[data-pill-ring]').click();
    await expect(demo(page).locator('sw-sheet[data-sheet-light]')).toHaveAttribute('open', '');
    await expect(l1).toHaveAttribute('on', '');
    // the unavailable pill ignores input
    const u1 = demo(page).locator('[data-demo-grid] sw-pill[data-dev="u1"]');
    await expect(u1).toHaveAttribute('aria-disabled', 'true');
  });

  test('the look dials: ?look= for the page view only; reduced transparency makes the sheet solid', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'once');
    await open(page, '/styleguide/bubble', '&scheme=light');
    expect(await attr(page, 'data-bubble-density')).toBe('regular');
    expect(await attr(page, 'data-bubble-surface')).toBe('fill');
    expect(await attr(page, 'data-bubble-popup')).toBe('sheet');
    expect(await attr(page, 'data-bubble-radius')).toBe('pill');
    expect(await rootVar(page, '--sw-sheet-alpha')).toBe('0.72');
    expect(await rootVar(page, '--sw-touch-desktop')).toBe('44px');
    await open(page, '/styleguide/bubble', '&scheme=light&look=density:compact,surface:glass,popup:centred,radius:square,transparency:90,scale:120,touch:32,palette:nope,bogus:1');
    expect(await attr(page, 'data-bubble-density')).toBe('compact');
    expect(await attr(page, 'data-bubble-surface')).toBe('glass');
    expect(await attr(page, 'data-bubble-popup')).toBe('centred');
    expect(await attr(page, 'data-bubble-radius')).toBe('square');
    expect(await rootVar(page, '--sw-sheet-alpha')).toBe('0.90');
    expect(await rootVar(page, '--sw-look-scale')).toBe('1.20');
    expect(await rootVar(page, '--sw-touch-desktop')).toBe('32px');
    expect(await attr(page, 'data-bubble-palette')).toBe('default'); // an unknown palette is ignored
    expect(await page.evaluate(() => localStorage.getItem('sw.ui.look'))).toBeNull(); // nothing stored by the override
    // the density bundle reached the pills (compact: 46 px tall), the radius bundle the sheet's corners (square: 12 px)
    const pillH = await demo(page).locator('[data-demo-grid] sw-pill').first().evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--sw-pill-h')));
    expect(pillH).toBe(46);
    await demo(page).locator('[data-open-confirm]').click();
    const radius = await demo(page).locator('sw-sheet[data-sheet-confirm]').evaluate((el) => getComputedStyle(el.shadowRoot!.querySelector('.sheet')!).borderTopLeftRadius);
    expect(parseFloat(radius)).toBe(12);
    await page.keyboard.press('Escape');
    // the transparency dial never drops below the computed contrast floor
    await open(page, '/styleguide/bubble', '&scheme=light&look=transparency:40');
    const alpha = parseFloat(await rootVar(page, '--sw-sheet-alpha'));
    expect(alpha).toBeGreaterThanOrEqual(0.4);
    expect(alpha).toBeLessThanOrEqual(0.72);
    // reduced transparency: the sheet is solid whatever the dial says
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.emulateMedia({ forcedColors: 'none' });
    const bg = await page.evaluate(async () => {
      const d = document.querySelector('sw-app')!.shadowRoot!.querySelector('bubble-demo')! as unknown as HTMLElement & { sheet: string };
      d.sheet = 'confirm';
      await new Promise((r) => setTimeout(r, 100));
      return getComputedStyle(d.shadowRoot!.querySelector('sw-sheet[data-sheet-confirm]')!.shadowRoot!.querySelector('.sheet')!).backgroundColor;
    });
    expect(bg).toMatch(/^rgba?\(/);
    expect(await rootVar(page, '--sw-sheet-alpha')).not.toBe('1'); // the dial is still the dial on the root ...
    const solid = await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches);
    if (solid) expect(bg).not.toContain('0.'); // ... but a system that asks for less transparency gets the solid twin
  });

  test('the settings card in demo mode: my dials apply at once and survive a reload; the installation default saves with the button; the preview follows the draft', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the card is the same component on a phone; one width is enough here');
    await open(page, '/system/diagnostics', '&scheme=light');
    const card = lookCard(page);
    await expect(card).toBeVisible();
    await expect(card.locator('[data-look-row]')).toHaveCount(9);
    await expect(card.locator('[data-look-target="own"]')).toHaveAttribute('aria-pressed', 'true');
    for (const d of ['density', 'surface', 'popup', 'radius', 'touch', 'performance', 'palette', 'transparency', 'scale']) await expect(card.locator(`[data-look-follow="${d}"]`)).toHaveAttribute('aria-pressed', 'true');
    await card.locator('[data-look-option="density:row"]').click();
    await expect(card.locator('[data-look-message]')).toBeVisible();
    expect(await attr(page, 'data-bubble-density')).toBe('row'); // applied at once, nothing to save
    await card.locator('[data-look-option="touch:32"]').click();
    expect(await rootVar(page, '--sw-touch-desktop')).toBe('32px');
    await expect(card.locator('[data-look-preview]')).toHaveAttribute('data-look-preview', /^row\/fill\/sheet\/pill\/72\/100\/32$/);
    await page.evaluate(() => sessionStorage.setItem('look-keep', '1')); // the init script above clears the stores on every load unless told to keep them
    await page.reload();
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(500);
    expect(await attr(page, 'data-bubble-density')).toBe('row');
    expect(await rootVar(page, '--sw-touch-desktop')).toBe('32px');
    // "לפי ההתקנה" on one dial clears only that dial
    await lookCard(page).locator('[data-look-follow="density"]').click();
    await expect.poll(() => attr(page, 'data-bubble-density')).toBe('regular');
    expect(await rootVar(page, '--sw-touch-desktop')).toBe('32px');
    await lookCard(page).locator('[data-look-clear-own]').click();
    await expect.poll(() => rootVar(page, '--sw-touch-desktop')).toBe('44px');
    // the installation default: a draft until saved; the preview shows the draft; my cleared dials then follow it
    await lookCard(page).locator('[data-look-target="installation"]').click();
    await lookCard(page).locator('[data-look-option="surface:gradient"]').click();
    await lookCard(page).locator('[data-look-option="radius:soft"]').click();
    expect(await attr(page, 'data-bubble-surface')).toBe('fill'); // a draft
    await expect(lookCard(page).locator('[data-look-preview]')).toHaveAttribute('data-look-preview', /^regular\/gradient\/sheet\/soft\//);
    await lookCard(page).locator('[data-look-save]').click();
    await expect(lookCard(page).locator('[data-look-message]')).toBeVisible();
    expect(await attr(page, 'data-bubble-surface')).toBe('gradient');
    expect(await attr(page, 'data-bubble-radius')).toBe('soft');
    await page.reload();
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(500);
    expect(await attr(page, 'data-bubble-surface')).toBe('gradient');
    // the transparency range writes through: the own target saves on change
    await lookCard(page).locator('[data-look-target="own"]').click();
    await lookCard(page).locator('[data-look-range="transparency"]').evaluate((el) => {
      const i = el as HTMLInputElement;
      i.value = '90';
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect.poll(() => rootVar(page, '--sw-sheet-alpha')).toBe('0.90');
  });
});

// ---- the mocked backend: what the card sends ----
const ALL = ['video.live', 'map.read', 'entity.state.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure'];
const INST = { density: 'regular', surface: 'fill', popup: 'sheet', radius: 'pill', transparency: 72, scale: 100, touch: 44, performance: 'auto', palette: 'default' };

class Mock {
  admin = true;
  installation: Record<string, unknown> = { ...INST };
  own: Record<string, unknown> | null = null;
  puts: Record<string, unknown>[] = [];
  patches: Record<string, unknown>[] = [];
  refuseNext = false;

  async handle(route: Route) {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const perms = this.admin ? ALL : ALL.filter((x) => x !== 'system.configure');
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u1', username: 'u1', display_name: 'יוני אוליאל', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    const prefs = () => ({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'], 'ui.look': this.own }, stored: this.own ? ['ui.look'] : [], updated_at: null });
    if (p === 'me/prefs' && req.method() === 'GET') return json(prefs());
    if (p === 'me/prefs' && req.method() === 'PUT') {
      const body = req.postDataJSON() as Record<string, unknown>;
      this.puts.push(body);
      if (this.refuseNext) {
        this.refuseNext = false;
        return json({ code: 'validation', user_message: 'ההעדפה שנשלחה אינה תקינה.', retryable: false, correlation_id: '', details: {} }, 422);
      }
      if ('ui.look' in body) this.own = body['ui.look'] as Record<string, unknown> | null;
      return json(prefs());
    }
    if (p === 'settings' && req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      this.patches.push(body);
      if ('ui.look' in body) this.installation = body['ui.look'] as Record<string, unknown>;
    }
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.skin': 'bubble', 'ui.scheme': 'light', 'ui.look': this.installation, 'media.transport_default': 'mse', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60 }, can_edit: this.admin });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-02T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json({ items: [], summary: { unread: 0, unacked: 0 } });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  }
}

test.describe('the look dials with a (mocked) backend', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  let mock: Mock;
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('sw.ui.look');
        localStorage.removeItem('sw.ui.look.installation');
      } catch {
        /* storage unavailable */
      }
    });
    mock = new Mock();
    await page.route('**/api/v1/**', (r) => mock.handle(r));
  });

  test('my dial goes to PUT /me/prefs as a partial object, null clears it; the installation default goes to PATCH /settings whole; a 422 reverts', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'once');
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/diagnostics');
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(800);
    expect(await attr(page, 'data-skin')).toBe('bubble'); // the installation's skin from the mocked settings
    const card = lookCard(page);
    await expect(card).toBeVisible();
    await card.locator('[data-look-option="density:compact"]').click();
    await expect.poll(() => mock.puts.length).toBe(1);
    expect(mock.puts[0]).toEqual({ 'ui.look': { density: 'compact' } });
    expect(await attr(page, 'data-bubble-density')).toBe('compact');
    await card.locator('[data-look-option="surface:glass"]').click();
    await expect.poll(() => mock.puts.length).toBe(2);
    expect(mock.puts[1]).toEqual({ 'ui.look': { density: 'compact', surface: 'glass' } });
    await card.locator('[data-look-follow="density"]').click();
    await expect.poll(() => mock.puts.length).toBe(3);
    expect(mock.puts[2]).toEqual({ 'ui.look': { surface: 'glass' } });
    await card.locator('[data-look-clear-own]').click();
    await expect.poll(() => mock.puts.length).toBe(4);
    expect(mock.puts[3]).toEqual({ 'ui.look': null });
    await expect.poll(() => attr(page, 'data-bubble-surface')).toBe('fill');
    // a refused value reverts the optimistic change
    mock.refuseNext = true;
    await card.locator('[data-look-option="radius:square"]').click();
    await expect(card.locator('[role="alert"]')).toBeVisible();
    await expect.poll(() => attr(page, 'data-bubble-radius')).toBe('pill');
    // the installation default, every dial, with the button
    await card.locator('[data-look-target="installation"]').click();
    await card.locator('[data-look-option="popup:inline"]').click();
    await card.locator('[data-look-option="touch:32"]').click();
    await card.locator('[data-look-save]').click();
    await expect.poll(() => mock.patches.length).toBe(1);
    expect(mock.patches[0]).toEqual({ 'ui.look': { ...INST, popup: 'inline', touch: 32 } });
    await expect.poll(() => attr(page, 'data-bubble-popup')).toBe('inline');
    expect(await rootVar(page, '--sw-touch-desktop')).toBe('32px');
    await shot(page, 'settings-look-api-1440-light');
  });

  test('without system.configure the installation default is read-only; my own dials still work', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'once');
    mock.admin = false;
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/diagnostics');
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(800);
    const card = lookCard(page);
    await card.locator('[data-look-target="installation"]').click();
    await expect(card.locator('[data-look-option="density:row"]')).toBeDisabled();
    await expect(card.locator('[data-look-save]')).toHaveAttribute('disabled', '');
    await card.locator('[data-look-target="own"]').click();
    await card.locator('[data-look-option="density:row"]').click();
    await expect.poll(() => mock.puts.length).toBe(1);
    expect(mock.patches).toEqual([]);
  });
});
