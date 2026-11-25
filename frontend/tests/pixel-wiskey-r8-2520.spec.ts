import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { pixelTitle, skinCheck } from './helpers/pixel-skins';
import { SKINS_UNDER_TEST } from './helpers/frozen-skins';
import { ADMIN, installFrigate, newFrigateMock } from './frigate-mocks';

// WISKEY-R8-2520: pixel baselines of the read-only "service approval from WisKey" block of the Bridge key card - the two states with the
// most structure: active (the approved actions, "cards not included", the pointer to WisKey's tools screen) and refused (WisKey's code).
// The block alone is compared (an element shot), so the rest of the card and the shell do not move the picture. Desktop 1440 and phone
// 390, light; the pixel skins (classic, domus) carry baselines, the other skins under test the structural smoke. Mocked backend.

const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const KEY = { kid: 'g3-1a2b3c4d', generation: 3, state: 'current', created_at: '2026-10-20T08:00:00Z', activated_at: '2026-10-20T08:01:00Z', verify_until: null, ended_at: null, readable: true };
const STATUS = {
  enabled: true, go_live_permitted: true, peer_available: true, adopted: true, key: KEY, keys: [KEY], rotation: null, last: null, history: [],
  reminder_days: 0, reminder_values: [0, 30, 90, 180, 365], reminder_due: false, can_start: true, blocked_by: null, automatic: 'idle',
};
const BASE = { reason: null, wiskey_code: null, revision: null, fetched_at: '2026-11-25T08:00:00Z', contract: 'wiskey-native-service-write.v3', commands: [],
  cards_granted: false, owner_actions_in: 'wiskey_owner_screen', owner_screen_tab: 'tools', message_he: 'x', message_en: 'x', card_off_he: 'x', card_off_en: 'x' };
const STATES = [
  { id: 'active', body: { ...BASE, state: 'active', revision: 3, commands: ['users/create', 'users/pin_generate', 'users/temporary_cancel', 'users/update'] } },
  { id: 'refused', body: { ...BASE, state: 'refused', reason: 'wiskey_refused', wiskey_code: 'Unauthorized' } },
] as const;

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, skin: string, body: unknown) {
  await page.clock.setFixedTime(new Date('2026-11-25T09:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installFrigate(page, newFrigateMock({ perms: [...ADMIN, 'access.read'] }));
  await page.route('**/api/v1/system/bridge-key**', async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p.endsWith('/service-grant')) return json(route, body);
    if (p.endsWith('/notice')) return json(route, { show: false, open: 0, contacts_set: false });
    return json(route, STATUS);
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=light#/system/setup`);
  await page.waitForSelector('sw-app');
  const block = page.locator('sw-bridge-key-card [data-bridge-key-grant]');
  await expect(block).toBeVisible({ timeout: 20_000 });
  return block;
}

test.describe('pixel: the service approval block of the Bridge key card', () => {
  for (const skin of SKINS_UNDER_TEST) {
    for (const s of STATES) {
      test(pixelTitle(skin, `the service approval block, ${s.id}`), async ({ page }, info) => {
        test.skip(info.project.name === 'tablet', 'desktop and phone only');
        const check = skinCheck(page, skin);
        const block = await open(page, skin, s.body);
        await expect(block).toHaveAttribute('data-bridge-key-grant', s.id);
        await block.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await settlePage(page);
        const name = `wiskey-r8-${skin}-${s.id}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
        await check(async () => {
          if (noBaseline(info, name)) test.info().annotations.push({ type: 'skipped-pixel', description: `${name}: no baseline on ${process.platform}` });
          else await expect(block).toHaveScreenshot(name, { maxDiffPixels: 60, animations: 'disabled', caret: 'hide' });
        }, block);
      });
    }
  }
});
