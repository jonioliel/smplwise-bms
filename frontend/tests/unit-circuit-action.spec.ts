import { test, expect } from '@playwright/test';
import type { HaActionSpec } from '../src/api/ha';
import type { CircuitState } from '../src/api/types';
import { circuitAction } from '../src/map/circuit-action';

// T087 task 6 review R1: one circuit-action rule for the circuit strip and a lamp click in the 3D - the switch turns off
// while it is on and on otherwise, and every guard blocks with its own Hebrew reason (the strip's disabled title). Node only.
const spec = (id: string, extra: Partial<HaActionSpec> = {}): HaActionSpec => ({ id, label: id, sensitive: false, arguments: [], ...extra });
const circuit = (extra: Partial<CircuitState> = {}): CircuitState => ({
  entity_id: 'switch.k', name: 'מעגל', color_token: 'circuit-1', member_ids: ['lk'], power_w: 0, state: 'on', known: true, fresh: true, available: true, can_control: true,
  actions: [spec('switch.turn_on'), spec('switch.turn_off')], ...extra,
});
const free = { busy: false, stale: false };

test('circuitAction picks the opposite action and names every block', () => {
  expect(circuitAction(circuit(), free)).toEqual({ spec: spec('switch.turn_off'), blocked: false, why: null });
  expect(circuitAction(circuit({ state: 'off' }), free).spec?.id).toBe('switch.turn_on');
  expect(circuitAction(circuit({ state: null }), free).spec?.id).toBe('switch.turn_on'); // unknown: the first press switches on
  const why = (s: CircuitState, ctx = free) => circuitAction(s, ctx);
  expect(why(circuit({ can_control: false }))).toMatchObject({ blocked: true, why: 'אין הרשאת שליטה בישויות בקומה' });
  expect(why(circuit({ available: false }))).toMatchObject({ blocked: true, why: 'המפסק אינו זמין ב־Home Assistant' });
  expect(why(circuit({ actions: [spec('switch.turn_on')] }))).toMatchObject({ spec: null, blocked: true, why: 'אין פעולה מותרת למפסק הזה' });
  expect(why(circuit({ actions: [spec('switch.turn_off', { granted: false, grant: 'lights.special' })] }))).toMatchObject({ blocked: true, why: 'נדרשת הרשאה נפרדת: lights.special' });
  expect(why(circuit(), { busy: true, stale: false })).toMatchObject({ blocked: true, why: 'פעולה על המפסק כבר בדרך' });
  expect(why(circuit(), { busy: false, stale: true })).toMatchObject({ blocked: true, why: 'המפה אינה מעודכנת — השליטה חוזרת עם החידוש' });
  // the first guard that applies names the block: no permission outranks an unavailable switch
  expect(why(circuit({ can_control: false, available: false })).why).toBe('אין הרשאת שליטה בישויות בקומה');
});
