import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// The definition the card library imports (owner 2026-09-30), read as source: the element module registers custom elements
// and needs a DOM, so this Node spec checks the exported shape and the layout item against the backend's own schema
// (smplwise_vms/backend/smplwise/routers/device_layouts.py) textually - the same "compare the two" approach as the icon list.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const card = readFileSync(path.join(ROOT, 'frontend/src/screens/devices-camera-card.ts'), 'utf8');
const layouts = readFileSync(path.join(ROOT, 'smplwise_vms/backend/smplwise/routers/device_layouts.py'), 'utf8');

test.describe('cameraCardDefinition (source)', () => {
  test('exports the names the library imports', () => {
    expect(card).toMatch(/export function cameraCardDefinition\(\): CameraCardDefinition/);
    expect(card).toMatch(/@customElement\('devices-camera-card'\)/);
    expect(card).toMatch(/import '\.\/devices-camera-picker'/); // importing the card registers the picker too
    const picker = readFileSync(path.join(ROOT, 'frontend/src/screens/devices-camera-picker.ts'), 'utf8');
    expect(picker).toMatch(/@customElement\('devices-camera-picker'\)/);
    expect(card).toMatch(/label: 'מצלמה'/);
    expect(card).toMatch(/permission: 'video\.live'/);
  });

  test('the layout key and the item follow the backend schema (camera:<slug>, v 2, max cards, the source kinds)', () => {
    const key = /isLayoutKey: \(key\) => \/(.+)\/\.test\(key\)/.exec(card)?.[1];
    const serverKey = /CAMERA_KEY_RE = re\.compile\(r"(.+)"\)/.exec(layouts)?.[1];
    expect(key).toBe(serverKey);
    expect(layouts).toMatch(/MAX_CAMERA_CARDS = 12/);
    expect(layouts).toMatch(/kind: Literal\["nvr"\]/);
    expect(layouts).toMatch(/kind: Literal\["ha"\]/);
    expect(layouts).toMatch(/LAYOUT_VERSION = 2/);
    // the default size fits the 12-column grid
    const size = /defaultSize: \{ w: (\d+), h: (\d+) \}/.exec(card);
    expect(Number(size?.[1])).toBeLessThanOrEqual(12);
    expect(Number(size?.[2])).toBeLessThanOrEqual(400); // MAX_SPAN_ROWS
  });
});

// A standalone Home Assistant camera shown live (owner 2026-09-30, docs/design/CAMERA_CARD_HA_SOURCE.md): the client and the
// server agree on the state, the routes and the relay path, and the picture stays the fallback. Read as source, like the above.
test.describe('a standalone camera shown live (source)', () => {
  const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
  const api = read('frontend/src/api/camera-card.ts');
  const picker = read('frontend/src/screens/devices-camera-picker.ts');
  const player = read('frontend/src/components/sw-live-player.ts');
  const cards = read('smplwise_vms/backend/smplwise/services/camera_cards.py');
  const routes = read('smplwise_vms/backend/smplwise/routers/device_cameras.py');
  const media = read('smplwise_vms/backend/smplwise/routers/media.py');
  const streams = read('smplwise_vms/backend/smplwise/services/ha_camera_streams.py');

  test('the state, the toggle routes and the relay path match the backend', () => {
    expect(cards).toMatch(/HA_LIVE = "ha_live"/);
    expect(api).toMatch(/'ha_live'/);
    expect(routes).toMatch(/@router\.put\("\/devices\/camera-card\/ha-live\/\{entity_id\}"\)/);
    expect(routes).toMatch(/@router\.delete\("\/devices\/camera-card\/ha-live\/\{entity_id\}"\)/);
    expect(api).toMatch(/`\$\{BASE\}\/ha-live\/\$\{encodeURIComponent\(entityId\)\}`/);
    expect(api).toMatch(/method: 'PUT'/);
    expect(api).toMatch(/method: 'DELETE'/);
    expect(media).toMatch(/@router\.websocket\("\/media\/live-ha\/\{entity_id\}\/ws"\)/);
    expect(streams).toMatch(/return f"media\/live-ha\/\{entity_id\}\/ws"/);
  });

  test('the card plays the server-named path through the same player, transport per settings, and falls back to the picture', () => {
    expect(card).toMatch(/case 'ha_live':/);
    expect(card).toMatch(/livePath=\$\{r\.live_path/);
    expect(card).toMatch(/HA_LIVE_RETRY_MS/);
    expect(card).toMatch(/haFailedAt/);
    expect(player).toMatch(/@property\(\) livePath = ''/);
    expect(player).toMatch(/relayWsUrl\(this\.livePath\)/);
  });

  test('the toggle is offered only to who may configure sources, per camera', () => {
    expect(picker).toMatch(/d\.ha_live\?\.ready && !!d\.ha_live\.can_configure/);
    expect(picker).toMatch(/data-camera-live-toggle/);
    expect(picker).toMatch(/הצג בזרם חי/);
    expect(routes).toMatch(/require\(conn, principal, "sources\.configure", INSTALLATION\)/);
  });
});
