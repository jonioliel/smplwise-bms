import { test, expect } from '@playwright/test';
import { DEMO_CAMERAS } from '../src/plan-wizard/wizard-demo';
import { CAMERA_PLACED_HE, WHERE_HE, cameraPlacements, isCamera, roomTypeOfTags } from '../src/plan-wizard/wizard-model';
import { WIZARD_NOTE } from '../src/plan-wizard/wizard-backend';

// PLAN3D-R28-WIZARD2-2434: the pure additions of the wizard's second round (src/plan-wizard/wizard-model.ts). Node only.

test('cameras wait for a click each: no place, no area, marked as cameras', () => {
  const list = cameraPlacements(DEMO_CAMERAS);
  expect(list).toHaveLength(3);
  expect(list.every((p) => isCamera(p) && p.where === 'manual' && p.x === null && p.y === null && p.room === null && p.domain === 'camera')).toBe(true);
  expect(list.map((p) => p.entity_id)).toEqual(DEMO_CAMERAS.map((c) => c.id));
  expect(isCamera({ resource: undefined })).toBe(false); // a device of the catalogue (the first round's placements carry no resource)
  expect(WHERE_HE.manual).toBe('בחר ולחץ על המפה');
  expect(CAMERA_PLACED_HE).not.toBe(WHERE_HE.centre); // a camera is where the person put it, not "the centre of the room"
});

test('a resumed room reads its type back from the tags the wizard wrote', () => {
  expect(roomTypeOfTags(['living'])).toBe('living');
  expect(roomTypeOfTags(['wc'])).toBe('wc');
  expect(roomTypeOfTags(['kitchen', 'custom'])).toBe('kitchen');
  expect(roomTypeOfTags([])).toBe('other');
  expect(roomTypeOfTags(null)).toBe('other');
  expect(roomTypeOfTags(['something-else'])).toBe('other');
});

test('the wizard note is the one the backend test drives (tests/test_plan_wizard_api_2434.py WIZARD_NOTE)', () => {
  expect(WIZARD_NOTE).toBe('אשף תוכנית חדשה');
});
