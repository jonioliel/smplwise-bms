import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AR, BIDI, EMAIL, EMOJI, LONG_HE, MIXED, ONE, RU, UNBREAK, UNBREAK_HE, digest, measure } from './breakui-worst';

// BREAKUI-295: the floor / area pickers of the area screen (devices-area-nav, the phone chips) against WORST-CASE names: a 100-character floor and
// area, an unbreakable one, one letter, Arabic / Russian / mixed / emoji / bidi, 30 floors, 60 areas with counts of 10^11, a tree that is
// empty or fails, a single area. Both phone dropdown choices (popover list and bottom sheet) at 400 px and the desktop. Mock layer, no backend.
// SW_SHOTS=1 -> docs/design/evidence/BREAKUI-295.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/BREAKUI-295');
const ADMIN = ['devices.read', 'devices.control', 'entity.state.read', 'map.read', 'system.configure'];
const NAMES = [LONG_HE, UNBREAK, UNBREAK_HE, EMAIL, MIXED, AR, RU, ONE, EMOJI, BIDI];

type Tree = 'big' | 'empty' | 'error' | 'single';

async function stage(page: Page, tree: Tree, dd: 'list' | 'sheet', scheme: 'light' | 'dark') {
  await page.route('**/api/v1/**', (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.dd_phone': dd }, can_edit: false });
    if (p.startsWith('devices/tree')) {
      if (tree === 'error') return json({ code: 'internal', user_message: UNBREAK, retryable: false, correlation_id: '', details: {} }, 500);
      const c = (n: number) => ({ entities: n });
      const floors = tree === 'empty' ? [] : Array.from({ length: tree === 'single' ? 1 : 30 }, (_, f) => ({
        floor_id: `f${f}`, name: NAMES[f % NAMES.length] + (f > 9 ? ` ${f}` : ''), counts: c(99999999999),
        areas: Array.from({ length: tree === 'single' ? 1 : f === 0 ? 60 : 3 }, (_, a) => ({ area_id: `a${f}_${a}`, name: NAMES[(a + f) % NAMES.length] + (a > 9 ? ` ${a}` : ''), counts: c(a === 0 ? 0 : 99999999999) })),
      }));
      return json({ floors, unassigned: { counts: c(0) }, counts: c(0) });
    }
    return json({ code: 'not_found', user_message: 'x', retryable: false, correlation_id: '', details: {} }, 404);
  });
  await page.goto(`./?design=a&skin=classic&scheme=${scheme}#/devices/areas/a0_0`);
  await page.waitForFunction(() => !!customElements.get('devices-area-nav'));
  await page.waitForTimeout(500);
  await page.evaluate(([mode, floorName, areaName]) => {
    document.documentElement.setAttribute('data-dd-phone', mode);
    document.querySelectorAll('#stage').forEach((e) => e.remove());
    const st = document.createElement('div');
    st.id = 'stage';
    st.style.cssText = 'position:fixed;inset:0;z-index:10;background:var(--sw-bg,#fff);padding:24px 16px';
    const nav = document.createElement('devices-area-nav') as HTMLElement & { areas: unknown[] };
    nav.id = 'nav';
    nav.setAttribute('areaId', 'a0_0');
    nav.setAttribute('areaName', areaName);
    nav.setAttribute('floorName', floorName);
    const c = { entities: 99999999999, lights: 0, lights_on: 0 };
    nav.areas = Array.from({ length: 60 }, (_, i) => ({ area_id: `a0_${i}`, name: i === 0 ? areaName : `${areaName.slice(0, 20)} ${i}`, counts: c }));
    st.appendChild(nav);
    document.body.appendChild(st);
  }, [dd, tree === 'big' ? LONG_HE + ' ' + UNBREAK : tree === 'single' ? ONE : EMOJI, tree === 'big' ? UNBREAK + UNBREAK : ONE] as const);
  await page.waitForTimeout(300);
}
async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}
async function check(page: Page, label: string) {
  const r = await measure(page, label, '#stage');
  const text = digest(label, r);
  console.log(text);
  expect(r.scroll, `${label} horizontal page scroll`).toBeLessThanOrEqual(1);
  expect(r.found, text).toEqual([]);
  if ((page.viewportSize()?.width ?? 1440) <= 480) expect(r.targets, text).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  for (const tree of ['big', 'empty', 'error', 'single'] as const) {
    for (const dd of ['list', 'sheet'] as const) {
      test(`area nav worst case [${tree}, ${dd}, ${scheme}]`, async ({ page }) => {
        const w = test.info().project.name === 'mobile' ? 400 : 1440;
        await page.setViewportSize({ width: w, height: w === 400 ? 800 : 900 });
        await stage(page, tree, dd, scheme);
        const nav = page.locator('#nav');
        await check(page, `closed ${tree} ${dd} ${scheme}`);
        await shot(page, `an-${tree}-${dd}-closed-${scheme}`);
        for (const which of ['floor', 'area'] as const) {
          await nav.locator(`[data-crumb="${which}"]`).click();
          await expect(nav.locator(`[data-nav-menu="${which}"]`)).toBeVisible();
          await check(page, `open-${which} ${tree} ${dd} ${scheme}`);
          await shot(page, `an-${tree}-${dd}-${which}-${scheme}`);
          await page.keyboard.press('Escape');
        }
      });
    }
  }
}
