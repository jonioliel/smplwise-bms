import { test, expect } from '@playwright/test';
import { ANCHOR_3D_DEFAULTS, anchor3d, anchor3dKind } from '../src/map/anchor-3d';

// Plan Studio phase 4 (T087, ruling R-P4-8): the mount height and tilt a placed item gets when its anchor stores none.
test('the defaults per anchor kind, and stored values win', () => {
  expect(ANCHOR_3D_DEFAULTS).toEqual({ camera: { mount_height_m: 2.5, tilt_deg: 10 }, door_station: { mount_height_m: 1.4, tilt_deg: 0 }, other: { mount_height_m: 1.2, tilt_deg: 0 } });
  expect(anchor3dKind({ resource_type: 'camera', layer_id: 'cameras' })).toBe('camera');
  expect(anchor3dKind({ resource_type: 'ha_entity', layer_id: 'doors' })).toBe('door_station');
  expect(anchor3dKind({ resource_type: 'ha_entity', layer_id: 'lights' })).toBe('other');
  expect(anchor3dKind({ resource_type: 'ha_entity', layer_id: 'sensors' })).toBe('other');
  expect(anchor3d({ resource_type: 'camera', layer_id: 'cameras' })).toEqual({ mount_height_m: 2.5, tilt_deg: 10, defaulted: true });
  expect(anchor3d({ resource_type: 'camera', layer_id: 'cameras', mount_height_m: 3.2, tilt_deg: null })).toEqual({ mount_height_m: 3.2, tilt_deg: 10, defaulted: true });
  expect(anchor3d({ resource_type: 'camera', layer_id: 'cameras', mount_height_m: 3.2, tilt_deg: -5 })).toEqual({ mount_height_m: 3.2, tilt_deg: -5, defaulted: false });
  expect(anchor3d({ resource_type: 'ha_entity', layer_id: 'doors', mount_height_m: 0 })).toEqual({ mount_height_m: 0, tilt_deg: 0, defaulted: true }); // 0 is a value, not "unset"
});
