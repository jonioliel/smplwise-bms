import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { skinTable } from '../src/design/css';
import { TABLET_L, band, install, live, newMock, open, stills, type PlanCfg } from './wall-plan-mocks';
import { skinsUnderTest } from './helpers/frozen-skins';

// Plan Studio 6, slice S5-B (CR-029 sections 3.3 / 3.4, CR-030 sections 4 / 8; docs/changes/CR-029-ST7-S5B-NOTES.md): the plan in the map
// band of a portrait wall display, against a mocked backend. The wall user's profile carries the screen's own plan setting; the band
// draws the baked stills (no WebGL) or the live 3D in the bare kiosk view; the screen's setting beats the installation's dials, `follow`
// hands a dial down; a live view idles into the baked still and wakes on a touch; the plan takes the wall's theme; a profile with no
// floor keeps the empty surface; a pushed configuration changes the band live. Plus the settings drawer's map section.
// Run on the runner: `run_smart.py spec <branch> tests/evidence-wall-plan.spec.ts --project=desktop`; screenshots: SW_SHOTS=../docs/evidence/ST7-S5B.
const SHOTS = process.env.SW_SHOTS ?? '';

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

test.describe('the plan in the map band of a portrait wall (mocked backend)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'the device is emulated by the spec itself; one project is enough');
  });

  test('stills by the screen\'s own setting: the lit room comes from the circuit, no WebGL is drawn, nothing is operable', async ({ page }) => {
    await open(page, newMock({ scheme: 'light', plan: { mode: 'stills', quality: 'follow', idle_s: 'follow' } }));
    await expect(stills(page)).toHaveCount(1);
    await expect(band(page).locator('sw-plan-3d')).toHaveCount(0);
    await expect(stills(page).locator('svg[data-stills]')).toBeVisible();
    await expect(stills(page).locator('[data-lit-room="z0"]')).toHaveCount(1); // the lamp's circuit is on: its room shows the lights-on picture
    await expect(stills(page).locator('[data-lit-room]')).toHaveCount(1);
    expect(await stills(page).evaluate((n) => n.shadowRoot!.querySelectorAll('canvas').length)).toBe(0);
    await expect(stills(page).locator('svg[data-stills]')).toHaveAttribute('data-style', 'dark'); // the wall is dark: so is the plan, whatever the installation's scheme
    await expect(band(page)).toHaveAttribute('role', 'img');
    await shot(page, 'wall-plan-stills-dark');
  });

  test('a lamp circuit switched off leaves its room dark on the next refresh of the floor', async ({ page }) => {
    const st = newMock({ plan: { mode: 'stills', quality: 'follow', idle_s: 'follow' } });
    await open(page, st);
    await expect(stills(page).locator('[data-lit-room="z0"]')).toHaveCount(1);
    st.circuit = 'off';
    await band(page).locator('sw-wall-plan').evaluate((n) => (n as unknown as { refresh(): Promise<void> }).refresh()); // the 30 s timer's job, asked now
    await expect(stills(page).locator('[data-lit-room]')).toHaveCount(0);
  });

  for (const [name, plan, dials, want] of [
    ["the installation says live, the screen says stills -> stills", { mode: 'stills', quality: 'follow', idle_s: 'follow' }, { wall_display: 'live' }, 'stills'],
    ['the installation says stills, the screen follows -> stills', { mode: 'follow', quality: 'follow', idle_s: 'follow' }, { wall_display: 'stills' }, 'stills'],
    ['the installation says stills, the screen says live -> the live 3D', { mode: 'live', quality: 'follow', idle_s: 'follow' }, { wall_display: 'stills' }, 'live'],
    ['a configuration from before the block existed reads as follow', null, { wall_display: 'stills' }, 'stills'],
  ] as const) {
    test(`the screen's setting beats the installation, follow hands the dial down: ${name}`, async ({ page }) => {
      test.setTimeout(90_000);
      await open(page, newMock({ plan: plan as PlanCfg | null, dials }));
      if (want === 'stills') {
        await expect(stills(page)).toHaveCount(1);
        await expect(band(page).locator('sw-plan-3d')).toHaveCount(0);
      } else {
        // QUARANTINE-295: the band draws sw-plan-3d only once its lazy module (three.js with it, fetched when a live view is wanted)
        // has loaded; until then it shows the stills. A cold chunk in a fresh browser on a busy runner took longer than the default
        // 5 s of the count below. Wait for exactly that precondition (the element's definition, event-driven), then the count holds.
        await page.evaluate(() => customElements.whenDefined('sw-plan-3d'));
        await expect(live(page)).toHaveCount(1);
        await expect(live(page)).toHaveAttribute('data-ready', '', { timeout: 30_000 });
      }
    });
  }

  test('live: the bare kiosk view; the screen forces its quality over the viewer\'s own choice', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => { try { localStorage.setItem('sw.plan3d.quality', '2'); } catch { /* storage */ } }); // this browser's person chose "full"
    await open(page, newMock({ plan: { mode: 'live', quality: 'schematic', idle_s: 0 } }));
    const el = live(page);
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30_000 });
    await expect(el).toHaveAttribute('data-quality-mode', 'schematic');
    await expect(el).toHaveAttribute('data-quality', '1');
    await expect(el.locator('[data-3d-bar]')).toBeHidden();
    await expect(el.locator('[data-3d-strip]')).toBeHidden();
    expect(await el.evaluate((n) => (n as unknown as { idleS: number }).idleS)).toBe(0);
    expect(await el.evaluate((n) => getComputedStyle(n.shadowRoot!.querySelector('.stage') as HTMLElement).pointerEvents)).toBe('none'); // a touch on the plan is a touch on the wall
    await shot(page, 'wall-plan-live-schematic');
  });

  test('live: after the idle time the baked still takes the band and the frame loop stops; a touch wakes it', async ({ page }) => {
    test.setTimeout(150_000);
    await open(page, newMock({ plan: { mode: 'live', quality: 'schematic', idle_s: 10 } }));
    const el = live(page);
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30_000 });
    await expect(el).toHaveAttribute('data-idle', '', { timeout: 40_000 });
    await expect(el).toHaveAttribute('data-paused', '');
    await expect(el.locator('.idle-still[data-on]')).toBeVisible();
    await expect(el.locator('sw-plan-stills[slot="idle-still"] svg[data-stills]')).toBeVisible();
    await shot(page, 'wall-plan-idle-still');
    const frozen = Number((await el.getAttribute('data-frames')) ?? 0);
    await page.waitForTimeout(2500);
    expect(Number((await el.getAttribute('data-frames')) ?? 0)).toBe(frozen);
    await page.mouse.move(400, 900);
    await page.mouse.down();
    await page.mouse.up();
    await expect(el).not.toHaveAttribute('data-idle', '');
    await expect(el.locator('.idle-still[data-on]')).toHaveCount(0);
  });

  test('a profile with no floor keeps the empty surface; the band takes no copy', async ({ page }) => {
    await open(page, newMock({ floor: null }));
    await expect(band(page)).toHaveCount(1);
    await expect(band(page).locator('sw-wall-plan')).toHaveCount(0);
    await expect(band(page)).toHaveAttribute('aria-hidden', 'true');
    expect((await band(page).innerText()).trim()).toBe('');
  });

  test('a pushed configuration changes the band live: stills -> live -> stills', async ({ page }) => {
    test.setTimeout(120_000);
    const st = newMock({ plan: { mode: 'stills', quality: 'follow', idle_s: 'follow' } });
    await open(page, st);
    await expect(stills(page)).toHaveCount(1);
    await expect.poll(() => st.ws !== null).toBe(true);
    st.plan = { mode: 'live', quality: 'schematic', idle_s: 'follow' };
    st.version = 2;
    st.ws!.send(JSON.stringify({ version: 1, type: 'config', payload: { version: 2 } }));
    await expect(live(page)).toHaveCount(1, { timeout: 30_000 });
    await expect(live(page)).toHaveAttribute('data-quality-mode', 'schematic', { timeout: 30_000 });
    st.plan = { mode: 'stills', quality: 'follow', idle_s: 'follow' };
    st.version = 3;
    st.ws!.send(JSON.stringify({ version: 1, type: 'config', payload: { version: 3 } }));
    await expect(stills(page)).toHaveCount(1, { timeout: 30_000 });
    await expect(band(page).locator('sw-plan-3d')).toHaveCount(0);
  });

  for (const skin of skinsUnderTest(['classic', 'bubble'] as const)) {
    for (const [scheme, theme] of [['light', 'dark'], ['dark', 'light'], ['light', 'follow']] as const) {
      test(`the plan takes the wall's theme, not the installation's: ${skin} installation ${scheme}, wall ${theme}`, async ({ page }) => {
        await open(page, newMock({ skin, scheme, theme, plan: { mode: 'stills', quality: 'follow', idle_s: 'follow' } }));
        await expect(stills(page).locator('svg[data-stills]')).toBeVisible();
        const want = theme === 'follow' ? scheme : theme;
        await expect(stills(page).locator('svg[data-stills]')).toHaveAttribute('data-style', want === 'dark' ? 'dark' : 'light');
        // the backdrop token inside the band is the wanted column's, whatever the page's scheme
        const bg = await band(page).locator('sw-wall-plan').evaluate((n) => {
          const fill = n.shadowRoot!.querySelector('.fill') as HTMLElement;
          return getComputedStyle(fill).getPropertyValue('--sw-map-bg').trim();
        });
        expect(bg.toLowerCase()).toBe(skinTable(skin)['--sw-map-bg'][want === 'dark' ? 'dark' : 'light'].toLowerCase());
        await shot(page, `wall-plan-${skin}-inst-${scheme}-wall-${theme}`);
      });
    }
  }

  test('landscape tablets have no map band', async ({ page }) => {
    await open(page, newMock(), TABLET_L);
    await expect(page.locator('sw-wall [data-wall-map-slot]')).toHaveCount(0);
  });
});

test.describe('הגדרות › מסכי קיר: the drawer\'s map section (mocked backend)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project is enough for the drawer');
  });

  test('show the map, choose the plan view, the quality and the idle time; follow is the default; the PATCH carries the plan block', async ({ page }) => {
    const st = newMock({ admin: true, plan: { mode: 'follow', quality: 'follow', idle_s: 'follow' } });
    await install(page, st);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?design=a#/system/wall');
    await page.locator('system-wall [data-wall-edit="u-wall"]').first().click();
    const drawer = page.locator('sw-drawer[data-wall-drawer]');
    const map = drawer.locator('[data-wall-section="map"]');
    await expect(map).toContainText('מפה');
    // the map is shown on this mocked profile: the three dials are there, every one on "like the installation"
    await expect(map.locator('select[data-wall-field="plan-mode"]')).toHaveValue('follow');
    await expect(map.locator('select[data-wall-field="plan-quality"]')).toHaveValue('follow');
    await expect(map.locator('select[data-wall-field="plan-idle"]')).toHaveValue('follow');
    await map.locator('select[data-wall-field="plan-mode"]').selectOption('stills');
    await map.locator('select[data-wall-field="plan-quality"]').selectOption('schematic');
    await map.locator('select[data-wall-field="plan-idle"]').selectOption('120');
    await shot(page, 'wall-settings-drawer-map');
    await drawer.locator('[data-wall-save]').click();
    await expect.poll(() => st.patched.length).toBe(1);
    const plan = (st.patched[0].config as { plan: unknown }).plan;
    expect(plan).toEqual({ mode: 'stills', quality: 'schematic', idle_s: 120 }); // idle is a number on the wire, not a string
  });

  test('the toggle shows and hides the three dials; a wall with no floor says the map will not show', async ({ page }) => {
    const st = newMock({ admin: true, floor: null });
    await install(page, st);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?design=a#/system/wall');
    await page.locator('system-wall [data-wall-edit="u-wall"]').first().click();
    const map = page.locator('sw-drawer[data-wall-drawer] [data-wall-section="map"]');
    await expect(map.locator('select[data-wall-field="plan-mode"]')).toBeVisible();
    await expect(map.locator('[data-wall-map-nofloor]')).toContainText('המפה לא תוצג');
    await map.locator('sw-toggle[data-wall-field="show-map"]').click();
    await expect(map.locator('select[data-wall-field="plan-mode"]')).toHaveCount(0);
    await expect(map.locator('[data-wall-map-nofloor]')).toHaveCount(0);
  });
});
