import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { settle } from './helpers/settle';
import { mockHome, overview } from './home-simple-mocks';
import type { RoomCardModel } from '../src/components/sw-room-card';

// FIX-HOME-MAPS-2570: pictures for the before / after compare page (private/planning/fix_home_maps_2570_compare_*.html). Runs only when
// SHOTS_DIR is set (the runner job); the same file runs on the base build ("before") and on the branch ("after").
const OUT = process.env.SHOTS_DIR;
test.skip(!OUT, 'evidence pictures: only with SHOTS_DIR');
test.use({ launchOptions: { args: ['--disable-lcd-text'] } });

const NOW = new Date('2026-11-03T10:00:00+02:00');
const home = (page: Page) => page.locator('sw-home');
const save = async (page: Page, el: ReturnType<Page['locator']>, name: string, project: string, scheme: string) => {
  fs.mkdirSync(OUT!, { recursive: true });
  await page.evaluate(async () => { await document.fonts.ready; });
  await settle(page);
  await el.screenshot({ path: path.join(OUT!, `${name}_${project}_${scheme}.jpg`), type: 'jpeg', quality: 70, animations: 'disabled' });
};

for (const scheme of ['light', 'dark'] as const) {
  for (const [name, states] of [['doors-a', { front: 'jammed', gate: 'locking' }], ['doors-b', { front: 'unlocking', gate: 'unlocked' }]] as const) {
    test(`home doors ${name} ${scheme}`, async ({ page }, info) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await mockHome(page, { now: NOW.getTime() });
      const ov = overview('demo');
      for (const r of ov.rooms) for (const l of r.locks as { entity_id: string; state: string; locked: boolean; active?: boolean }[]) {
        const st = (states as Record<string, string>)[l.entity_id.replace('lock.', '')];
        if (st) { l.state = st; l.locked = st === 'locked'; l.active = st === 'locked'; }
      }
      await page.route('**/api/v1/home/overview', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ov) }));
      const layout = { welcomed: true, theme: scheme === 'dark' ? 'midnight' : 'classic', scheme };
      await page.route('**/api/v1/home/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ favourites: {}, layout, seed: {} }) }));
      await page.clock.setFixedTime(NOW);
      await page.goto('about:blank');
      await page.goto('/#/home/doors');
      await home(page).waitFor();
      await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'));
      await page.waitForTimeout(800);
      await save(page, page.locator('body'), name, info.project.name, scheme);
    });
  }

  test(`room card busy line ${scheme}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.goto(`/?design=a&skin=${scheme === 'dark' ? 'midnight' : 'classic'}&scheme=${scheme}#/explore/floors/f0`);
    await page.waitForFunction(() => !!customElements.get('sw-room-card'), undefined, { timeout: 60000 });
    const spec = (id: string, label: string) => ({ id, label, sensitive: false, arguments: [], granted: true });
    const model: RoomCardModel = {
      id: 'z-west', name: 'סלון', levelName: 'קרקע', presence: true, quietMin: null, open: 0,
      lights: [{ entityId: 'light.a', label: 'תאורת תקרה', on: true, spec: spec('light.turn_off', 'כבה'), forbidden: false }, { entityId: 'light.b', label: 'מנורת רצפה', on: true, spec: spec('light.turn_off', 'כבה'), forbidden: false }],
      climate: null, openings: [], cameras: [], areaHref: null, busy: null, stale: false,
    };
    await page.evaluate((m) => {
      const box = document.createElement('div');
      box.id = 'ev-box';
      box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--sw-map-bg, #eef1f5);direction:rtl';
      const card = document.createElement('sw-room-card') as unknown as HTMLElement & Record<string, unknown>;
      card.model = m; card.place = innerWidth < 700 ? 'sheet' : 'side'; card.camera = 'none'; card.sheet = 'full';
      card.bulkBusy = 'other'; // ignored by the build before the change: it has no such property
      box.appendChild(card);
      document.body.appendChild(box);
    }, model);
    await page.locator('#ev-box sw-room-card [data-room-light="light.a"]').waitFor();
    await page.waitForTimeout(600);
    await save(page, page.locator('#ev-box'), 'roomcard', info.project.name, scheme);
  });
}
