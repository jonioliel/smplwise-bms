import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTITY_ID_SCAN_RE, entityLabel, friendlyLabel, looksLikeEntityId, neutralLabel, NEUTRAL_LABEL } from '../src/i18n/entity-label';
import { withFriendlyNames, type DeviceAreaDetail } from '../src/api/devices';

// ENTIDSWEEP-295 (owner 2026-10-20): operator screens never show a raw Home Assistant entity id. Pure logic + a source guard; the rendered
// scan of the area screen is tests/layout-entity-id-scan.spec.ts.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => fs.readFileSync(path.join(SRC, f), 'utf8');

test.describe('the shared friendly-name fallback chain', () => {
  test('name -> original name -> device name -> unit name -> neutral; an id is never a name', () => {
    expect(entityLabel({ entity_id: 'light.a', name: 'מנורה' })).toBe('מנורה');
    expect(entityLabel({ entity_id: 'light.a', name: 'light.a', original_name: 'Hall lamp' })).toBe('Hall lamp');
    expect(entityLabel({ entity_id: 'light.a', name: '', original_name: 'sensor.x', device_name: 'מכשיר' })).toBe('מכשיר');
    expect(entityLabel({ entity_id: 'light.a', name: null, unit_name: 'יחידה' })).toBe('יחידה');
    expect(entityLabel({ entity_id: 'light.a', name: 'light.a' })).toBe('תאורה ללא שם');
    expect(entityLabel({ entity_id: 'weird.thing', name: '  ' })).toBe(NEUTRAL_LABEL);
    expect(neutralLabel(undefined)).toBe(NEUTRAL_LABEL);
    expect(friendlyLabel([undefined, 'switch.k'], 'x')).toBe('x');
    for (const id of ['light.a', 'binary_sensor.door_1', 'climate.living_ac']) { expect(looksLikeEntityId(id)).toBe(true); expect(ENTITY_ID_SCAN_RE.test(`מזהה ${id}`)).toBe(true); }
    for (const t of ['תאורה מרכזית', 'Room 1.5', 'example.com', 'v1.2']) { expect(looksLikeEntityId(t)).toBe(false); expect(ENTITY_ID_SCAN_RE.test(t)).toBe(false); }
  });

  test('the area detail is normalised once at the API boundary', () => {
    const d = { cards: { lighting: { entities: [{ entity_id: 'light.x', name: 'light.x' }, { entity_id: 'light.y', name: 'ספוטים' }] }, sensors: { entities: [{ entity_id: 'sensor.t', name: '', device_name: 'חיישן סלון' }] } } } as unknown as DeviceAreaDetail;
    withFriendlyNames(d);
    expect(d.cards.lighting.entities.map((r) => r.name)).toEqual(['תאורה ללא שם', 'ספוטים']);
    expect(d.cards.sensors.entities[0].name).toBe('חיישן סלון');
  });

});

test.describe('source guard: the swept screens do not print ids', () => {
  for (const f of ['screens/devices-area.ts', 'screens/devices-area-bubble.ts']) {
    test(`${f}: no id in a tooltip / aria-label`, () => {
      const s = read(f);
      expect(s).not.toMatch(/(title|aria-label)=\$\{[^}]*entity_id[^}]*\}/);
    });
  }
  test('home-edit-panel: no id inside an option label', () => {
    expect(read('screens/home-edit-panel.ts')).not.toMatch(/\$\{[a-z.]*entity_id\}<\/option>/);
    expect(read('screens/home-edit-panel.ts')).not.toMatch(/<option value=\$\{current\} selected>\$\{current\}/);
  });
  test('automation-editor-logic: no `?? <id>` name fallback', () => {
    const s = read('screens/automation-editor-logic.ts');
    expect(s).not.toMatch(/\?\? id,/);
    expect(s).not.toMatch(/\?\? m\.entity_id\}/);
  });
  test('the climate-kind admin prints the id only on the marked technical line', () => {
    const s = read('screens/devices-climate-kind-admin.ts');
    const lines = s.split('\n').filter((l) => /\$\{r\.entity_id\}/.test(l) && !/data-climate-kind=|data-entity=|busyId|choose\(/.test(l));
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('TECH_ID_ATTR');
  });
});
