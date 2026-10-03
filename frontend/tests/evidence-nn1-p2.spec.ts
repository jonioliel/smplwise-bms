import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMBOS, installInstallationMock, type Combo, type HaState } from './nn1-p2-mocks';

// NN1 P2 (docs/architecture/CAPABILITIES.md section 4): the shell reacts to the installation's capabilities. Mocked backend
// (tests/nn1-p2-mocks.ts), no device, no NVR, no media server, no Home Assistant. Four installations:
//   A no NVR / no media server   B media server only   C NVR without a media server (unsupported)   D both
// and the Home Assistant states (connected, down, not configured).
//   1. the walk: every shell route per installation is either its screen or the neutral panel (no_nvr / no_media), never an error
//   2. navigation per installation (rail on desktop / tablet, bottom bar on a phone) - identical whatever Home Assistant does
//   3. an older backend without the capability block (read through `mode`)
//   4. the wizard, the health tab and the connections page in installation C (unsupported), the wizard in A and D
//   5. leftover NVR cameras are not offered or drawn without an NVR (camera picker, camera card); a live player opens no socket without live video
//   6. every skin, light and dark, mobile layout guard, operator wording (no infrastructure branding)
// Evidence (fake data only) -> docs/design/evidence/nn1-p2/. Works on the dist preview or the Vite dev server:
//   SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test tests/evidence-nn1-p2.spec.ts --project=desktop --project=tablet --project=mobile
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/nn1-p2');
const RAIL = 'sw-app nav.rail';
const BOTTOM = 'sw-app nav.bottom';
const PANEL = 'sw-app sw-state-panel[data-capability-panel]';

type Outcome = 'ok' | 'no_nvr' | 'no_media';
/** [hash, the screen's tag when it opens, outcome in A, B, C, D] - written by hand from CAPABILITIES.md section 4 */
const WALK: [string, string, Outcome, Outcome, Outcome, Outcome][] = [
  ['/live', 'live-overview', 'no_nvr', 'no_nvr', 'no_media', 'ok'],
  ['/live/wall', 'live-wall', 'no_nvr', 'no_nvr', 'no_media', 'ok'],
  ['/live/views', 'live-views', 'no_nvr', 'no_nvr', 'no_media', 'ok'],
  ['/kiosk', 'kiosk-wall', 'no_nvr', 'no_nvr', 'no_media', 'ok'],
  ['/live/cameras/cam-1', 'live-camera', 'no_nvr', 'no_nvr', 'ok', 'ok'],
  ['/investigate/events', 'investigate-events', 'no_nvr', 'no_nvr', 'ok', 'ok'],
  ['/investigate/events/ev-1', 'investigate-event-detail', 'no_nvr', 'no_nvr', 'ok', 'ok'],
  ['/investigate/reviews', 'investigate-events', 'no_nvr', 'no_nvr', 'ok', 'ok'],
  ['/investigate/search', 'investigate-search', 'no_nvr', 'no_nvr', 'ok', 'ok'],
  ['/investigate/cases', 'investigate-cases', 'no_nvr', 'no_nvr', 'ok', 'ok'],
  ['/investigate/rules', 'investigate-rules', 'no_nvr', 'no_nvr', 'ok', 'ok'],
  ['/investigate/exports', 'investigate-exports', 'no_nvr', 'no_nvr', 'ok', 'ok'],
  ['/investigate/playback', 'investigate-playback', 'no_nvr', 'no_nvr', 'no_media', 'ok'],
  ['/investigate/playback/sync', 'investigate-sync', 'no_nvr', 'no_nvr', 'no_media', 'ok'],
  ['/investigate/floors/f0/history', 'investigate-history-map', 'no_nvr', 'no_nvr', 'no_media', 'ok'],
  ['/investigate/health', 'system-devices', 'no_nvr', 'no_nvr', 'ok', 'ok'],
  ['/system/devices', 'system-devices', 'no_nvr', 'no_nvr', 'ok', 'ok'],
  ['/system/security/cameras', 'system-security', 'no_nvr', 'no_nvr', 'ok', 'ok'],
  ['/system/security/nvr', 'system-security', 'ok', 'ok', 'ok', 'ok'],
  ['/system/storage', 'system-storage', 'ok', 'ok', 'ok', 'ok'],
  ['/system/setup', 'system-setup', 'ok', 'ok', 'ok', 'ok'],
  ['/system/wizard', 'system-wizard', 'ok', 'ok', 'ok', 'ok'],
  ['/system/diagnostics', 'system-diagnostics', 'ok', 'ok', 'ok', 'ok'],
  ['/explore/sites', 'explore-sites', 'ok', 'ok', 'ok', 'ok'],
  ['/devices/building', 'devices-building', 'ok', 'ok', 'ok', 'ok'],
  ['/multimedia/screens', '', 'ok', 'ok', 'ok', 'ok'],
  ['/wiskey/overview', '', 'ok', 'ok', 'ok', 'ok'],
];
const COL: Record<Combo, number> = { A: 2, B: 3, C: 4, D: 5 };

/** The text of the page including shadow roots (innerText stops at the first one). */
async function deepText(page: Page, selector = 'sw-app'): Promise<string> {
  return page.evaluate((sel) => {
    const out: string[] = [];
    const walk = (n: Node) => {
      if (n.nodeType === Node.TEXT_NODE) out.push(n.textContent ?? '');
      if (n instanceof Element) {
        for (const a of ['heading', 'subheading', 'hint', 'label', 'actionLabel', 'title', 'aria-label']) out.push(n.getAttribute(a) ?? '');
        if (n.shadowRoot) n.shadowRoot.childNodes.forEach(walk);
      }
      n.childNodes.forEach(walk);
    };
    const root = document.querySelector(sel);
    if (root) walk(root);
    return out.join(' ');
  }, selector);
}

const BRAND = /Home Assistant|Ingress|Companion|\bHA\b|הום אסיסטנט/;

async function open(page: Page, hash: string, query = '') {
  await page.goto('about:blank');
  await page.goto(`/?design=a${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(700);
}

async function shot(page: Page, name: string, project: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${project}.png`) });
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function navHrefs(page: Page, sel: string): Promise<string[]> {
  return page.locator(`${sel} a`).evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? '').filter((h) => h !== '#/screens' && h !== '#/styleguide'));
}

test.describe('NN1 P2: the shell follows the installation capabilities', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked spec');
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('sw.devices.layout');
      } catch {
        /* storage unavailable */
      }
    });
  });

  for (const combo of COMBOS) {
    test(`${combo}: every shell route is its screen or a neutral panel, never an error`, async ({ page }, info) => {
      test.setTimeout(6 * 60_000);
      await installInstallationMock(page, combo);
      const shot1 = new Set(['/live/wall', '/investigate/events', '/investigate/playback', '/system/security/cameras']);
      for (const row of WALK) {
        const [hash, tag] = row;
        const outcome = row[COL[combo]] as Outcome;
        await open(page, hash);
        if (outcome === 'ok') {
          await expect(page.locator(PANEL), `${combo} ${hash}`).toHaveCount(0);
          if (tag) await expect(page.locator(`sw-app ${tag}`), `${combo} ${hash} mounts ${tag}`).toHaveCount(1, { timeout: 15_000 });
        } else {
          const panel = page.locator(PANEL);
          await expect(panel, `${combo} ${hash}`).toHaveCount(1, { timeout: 15_000 });
          await expect(panel).toHaveAttribute('data-capability-panel', outcome);
          if (tag) await expect(page.locator(`sw-app ${tag}`), `${combo} ${hash} must not mount ${tag}`).toHaveCount(0);
          const words = await deepText(page);
          expect(words, `${combo} ${hash}: no infrastructure branding`).not.toMatch(BRAND);
          if (outcome === 'no_media') expect(words).toContain('שרת מדיה');
          if (outcome === 'no_nvr') expect(words).toContain('ללא NVR');
        }
        expect(await noOverflow(page), `${combo} ${hash}: no horizontal scroll at ${info.project.name}`).toBe(true);
        if (info.project.name !== 'tablet' && shot1.has(hash)) await shot(page, `${combo}-walk-${hash.replace(/\W+/g, '_').replace(/^_|_$/g, '')}`, info.project.name);
      }
    });
  }

  test('navigation per installation: the security area follows what the installation has', async ({ page }, info) => {
    const phone = info.project.name === 'mobile';
    const sel = phone ? BOTTOM : RAIL;
    const seen: Record<string, string[]> = {};
    for (const combo of COMBOS) {
      await installInstallationMock(page, combo);
      await open(page, '/devices/building');
      await expect(page.locator(`${sel} a[href="#/devices/building"]`)).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(500); // the alarm presence answer ("no panel") arrives after the first paint
      const hrefs = await navHrefs(page, sel);
      seen[combo] = hrefs;
      const live = hrefs.filter((h) => h.startsWith('#/live'));
      const inv = hrefs.filter((h) => h.startsWith('#/investigate'));
      if (combo === 'A' || combo === 'B') expect([...live, ...inv], `${combo}: ${hrefs.join(', ')}`).toEqual([]);
      if (combo === 'C') {
        expect(live, `C: ${hrefs.join(', ')}`).toEqual([]); // not supported: no live video areas
        expect(inv.length, `C: ${hrefs.join(', ')}`).toBe(1); // the events, not the playback
        expect(inv[0]).toBe('#/investigate/events');
      }
      if (combo === 'D') expect(live.length + inv.length, `D: ${hrefs.join(', ')}`).toBeGreaterThan(0);
      for (const h of ['#/devices/building', '#/explore/sites']) expect(hrefs, `${combo} keeps ${h}`).toContain(h);
      expect(await deepText(page), `${combo}: no infrastructure branding in the shell`).not.toMatch(BRAND);
      if (info.project.name !== 'tablet') await shot(page, `${combo}-nav`, info.project.name);
      await page.unroute('**/api/v1/**');
    }
    expect(seen.A).toEqual(seen.B); // media server alone changes nothing in the navigation (a sources list is a later design question)
  });

  test('Home Assistant states: connected, down and not configured never move the navigation', async ({ page }, info) => {
    const sel = info.project.name === 'mobile' ? BOTTOM : RAIL;
    for (const combo of ['A', 'C', 'D'] as Combo[]) {
      const rows: Record<HaState, string[]> = { connected: [], down: [], none: [] };
      for (const ha of ['connected', 'down', 'none'] as HaState[]) {
        await installInstallationMock(page, combo, { ha });
        await open(page, '/devices/building');
        await expect(page.locator(`${sel} a[href="#/devices/building"]`)).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(400);
        rows[ha] = await navHrefs(page, sel);
        if (ha === 'down') await expect(page.locator('sw-app [data-sys-pill]')).toHaveAttribute('data-status', 'error', { timeout: 20_000 });
        await page.unroute('**/api/v1/**');
      }
      expect(rows.down, `${combo} down`).toEqual(rows.connected);
      expect(rows.none, `${combo} none`).toEqual(rows.connected);
    }
  });

  test('an older backend without the capability block is read through its mode', async ({ page }, info) => {
    const sel = info.project.name === 'mobile' ? BOTTOM : RAIL;
    await installInstallationMock(page, 'A', { legacy: true });
    await open(page, '/live/wall');
    await expect(page.locator(PANEL)).toHaveAttribute('data-capability-panel', 'no_nvr', { timeout: 15_000 });
    await page.unroute('**/api/v1/**');
    await installInstallationMock(page, 'D', { legacy: true });
    await open(page, '/devices/building');
    await expect(page.locator(`${sel} a[href="#/devices/building"]`)).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(400);
    const hrefs = await navHrefs(page, sel);
    expect(hrefs.filter((h) => h.startsWith('#/live') || h.startsWith('#/investigate')).length).toBeGreaterThan(0);
  });

  test('no request reaches a gated route while the shell is hidden from it (installation A)', async ({ page }) => {
    const log = await installInstallationMock(page, 'A');
    await open(page, '/live/wall');
    await expect(page.locator(PANEL)).toHaveCount(1, { timeout: 15_000 });
    await open(page, '/investigate/events');
    await expect(page.locator(PANEL)).toHaveCount(1, { timeout: 15_000 });
    const hit = log.filter((l) => /(^| )(cameras|events|media\/|playback|recordings|cases|exports|nvr)/.test(l));
    expect(hit, `requests to NVR routes: ${hit.join(' | ')}`).toEqual([]);
  });

  test('installation C is unsupported: the wizard never reaches ready and says why, the health tab and the connections page say so', async ({ page }, info) => {
    await installInstallationMock(page, 'C');
    await open(page, '/system/wizard');
    const warn = page.locator('system-wizard [data-wizard-unsupported]');
    await expect(warn).toBeVisible({ timeout: 20_000 });
    await expect(warn).toContainText('אינה נתמכת');
    await expect(warn).toContainText('מה עושים');
    await expect(page.locator('system-wizard [data-wizard-ready]')).toHaveCount(0);
    await expect(page.locator('system-wizard section[data-step="go2rtc"]')).toHaveAttribute('data-status', 'failed');
    expect(await deepText(page, 'system-wizard [data-wizard-unsupported]')).not.toMatch(BRAND);
    expect(await noOverflow(page)).toBe(true);
    if (info.project.name !== 'tablet') await shot(page, 'C-wizard-unsupported', info.project.name);

    await open(page, '/system/diagnostics?tab=health');
    await expect(page.locator('system-diagnostics [data-health-unsupported]')).toBeVisible({ timeout: 20_000 });
    expect(await noOverflow(page)).toBe(true);
    if (info.project.name !== 'tablet') await shot(page, 'C-health-unsupported', info.project.name);

    await open(page, '/system/setup');
    await expect(page.locator('system-setup [data-go2rtc-required]')).toBeVisible({ timeout: 20_000 });
    if (info.project.name !== 'tablet') await shot(page, 'C-connections-go2rtc-required', info.project.name);

    // the pill carries the server's operator-language item
    await open(page, '/devices/building');
    await expect(page.locator('sw-app [data-sys-pill]')).toHaveAttribute('data-status', 'error', { timeout: 20_000 });
  });

  test('the wizard in A (HA only) and D (full) is ready and shows no unsupported notice; the health tab and connections page stay quiet', async ({ page }, info) => {
    for (const combo of ['A', 'D'] as Combo[]) {
      await installInstallationMock(page, combo);
      await open(page, '/system/wizard');
      await expect(page.locator('system-wizard [data-wizard-ready]'), combo).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('system-wizard [data-wizard-unsupported]')).toHaveCount(0);
      if (info.project.name === 'desktop') await shot(page, `${combo}-wizard-ready`, info.project.name);
      await open(page, '/system/diagnostics?tab=health');
      await expect(page.locator('system-diagnostics [data-health-card="go2rtc"]')).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('system-diagnostics [data-health-unsupported]')).toHaveCount(0);
      await open(page, '/system/setup');
      await expect(page.locator('system-setup [data-connections]')).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('system-setup [data-go2rtc-required]')).toHaveCount(0);
      await page.unroute('**/api/v1/**');
    }
  });

  test('leftover NVR cameras: not offered by the camera picker, not drawn by the camera card, without an NVR (D5)', async ({ page }) => {
    for (const combo of COMBOS) {
      await installInstallationMock(page, combo);
      await open(page, '/devices/building');
      await page.evaluate(() => {
        const picker = document.createElement('devices-camera-picker');
        picker.id = 'nn1-picker';
        const nvr = document.createElement('devices-camera-card') as HTMLElement & { source: unknown };
        nvr.id = 'nn1-card-nvr';
        nvr.source = { kind: 'nvr', recorder_id: 'nvr-1', channel: 1 };
        const ha = document.createElement('devices-camera-card') as HTMLElement & { source: unknown };
        ha.id = 'nn1-card-ha';
        ha.source = { kind: 'ha', entity_id: 'camera.garden' };
        for (const el of [picker, nvr, ha]) {
          el.style.cssText = 'display:block;position:fixed;inset-block-start:0;inset-inline-start:0;inline-size:320px;block-size:200px;z-index:9';
          document.body.append(el);
        }
      });
      await expect(page.locator('#nn1-picker [data-camera-option="ha:camera.garden"]'), combo).toBeVisible({ timeout: 15_000 }); // the Home Assistant camera is always offered
      const nvrOptions = await page.locator('#nn1-picker [data-camera-option^="nvr:"]').count();
      expect(nvrOptions, `${combo}: NVR channels in the picker`).toBe(combo === 'C' || combo === 'D' ? 1 : 0);
      await expect(page.locator('#nn1-card-ha [data-camera-state]'), `${combo}: the Home Assistant camera card`).toHaveCount(1, { timeout: 15_000 });
      await page.waitForTimeout(500);
      const nvrCard = await page.locator('#nn1-card-nvr [data-camera-state]').count();
      expect(nvrCard, `${combo}: NVR camera card`).toBe(combo === 'C' || combo === 'D' ? 1 : 0);
      await page.unroute('**/api/v1/**');
    }
  });

  test('a live player opens no socket without live video (A, C); with it (D) it does', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __live: string[]; WebSocket: typeof WebSocket };
      w.__live = [];
      const Real = w.WebSocket;
      w.WebSocket = new Proxy(Real, { construct(t, a: ConstructorParameters<typeof WebSocket>) { if (String(a[0]).includes('/media/live/')) w.__live.push(String(a[0])); return Reflect.construct(t, a); } });
    });
    const sockets = async (combo: Combo) => {
      await installInstallationMock(page, combo);
      await open(page, '/devices/building');
      await page.evaluate(() => {
        const el = document.createElement('sw-live-player') as HTMLElement & { cameraId: string };
        el.id = 'nn1-player';
        el.cameraId = 'cam-1';
        el.style.cssText = 'display:block;inline-size:320px;block-size:200px';
        document.body.append(el);
      });
      await page.waitForTimeout(800);
      const n = await page.evaluate(() => (window as unknown as { __live: string[] }).__live.length);
      const status = await page.evaluate(() => (document.getElementById('nn1-player') as unknown as { status: string }).status);
      await page.unroute('**/api/v1/**');
      return { n, status };
    };
    for (const combo of ['A', 'C'] as Combo[]) {
      const r = await sockets(combo);
      expect(r.n, `${combo}: sockets`).toBe(0);
      expect(r.status, `${combo}: the player says so`).toBe('error');
    }
    expect((await sockets('D')).n, 'D: sockets').toBeGreaterThan(0);
  });

  for (const skin of ['classic', 'domus', 'tesla', 'bubble']) {
    for (const scheme of ['light', 'dark']) {
      test(`the neutral panels in the ${skin} skin, ${scheme}`, async ({ page }, info) => {
        for (const [combo, hash, kind] of [['A', '/live/wall', 'no_nvr'], ['C', '/live/wall', 'no_media']] as [Combo, string, Outcome][]) {
          await installInstallationMock(page, combo);
          await open(page, hash, `&skin=${skin}&scheme=${scheme}`);
          await expect(page.locator(PANEL)).toHaveAttribute('data-capability-panel', kind, { timeout: 15_000 });
          await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
          expect(await noOverflow(page), `${skin} ${scheme} ${combo}`).toBe(true);
          const box = await page.locator(PANEL).boundingBox();
          expect(box && box.width > 0 && box.height > 0, 'the panel is laid out').toBe(true);
          if (info.project.name === 'desktop' && (skin === 'classic' || scheme === 'dark')) await shot(page, `${combo}-panel-${skin}-${scheme}`, info.project.name);
          await page.unroute('**/api/v1/**');
        }
      });
    }
  }
});
