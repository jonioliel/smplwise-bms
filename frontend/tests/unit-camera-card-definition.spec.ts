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
