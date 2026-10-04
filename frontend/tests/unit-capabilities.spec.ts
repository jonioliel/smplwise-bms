import { test, expect } from '@playwright/test';
import { ALL_CAPABILITIES, needsNvrSource, resolveCapabilities, type Capabilities } from '../src/api/capabilities';
import { applyCapabilities, blockKind, capHiddenHref, missing, needsOfSegments, routeMissing, segmentsOfHref } from '../src/shell/nav-capabilities';
import { SECTION_TABS, visibleTabs, type Can } from '../src/shell/nav';
import type { RouteState } from '../src/router';

// NN1 P2: the capability table (route -> needs) and the shell's tab rows per installation. Pure logic, no browser.
// A = no NVR, no media server; B = media server only; C = NVR without a media server (unsupported); D = both.
const caps = (o: Partial<Capabilities>): Capabilities => ({ ...ALL_CAPABILITIES, ...o });
const COMBOS: Record<'A' | 'B' | 'C' | 'D', Capabilities> = {
  A: caps({ nvr: false, go2rtc: false, live_video: false, playback: false, events_recorder: false, ha_cameras_live: false }),
  B: caps({ nvr: false, go2rtc: true, live_video: true, playback: false, events_recorder: false }),
  C: caps({ nvr: true, go2rtc: false, live_video: false, playback: false, events_recorder: true, ha_cameras_live: false, supported: false, unsupported_reason: 'nvr_without_go2rtc' }),
  D: ALL_CAPABILITIES,
};

const all: Can = () => true;
const route = (path: string): RouteState => ({ path, segments: path.split('/').filter(Boolean), params: new URLSearchParams(), mode: path.split('/').filter(Boolean)[0] as RouteState['mode'] });

// href -> expected visibility per installation [A, B, C, D], written by hand (not derived from the table under test)
const TABLE: [string, [boolean, boolean, boolean, boolean]][] = [
  ['#/live', [false, false, false, true]],
  ['#/live/wall', [false, false, false, true]],
  ['#/live/views', [false, false, false, true]],
  ['#/live/cameras/cam-1', [false, false, true, true]],
  ['#/investigate/events', [false, false, true, true]],
  ['#/investigate/events/ev-1', [false, false, true, true]],
  ['#/investigate/reviews', [false, false, true, true]],
  ['#/investigate/search', [false, false, true, true]],
  ['#/investigate/cases', [false, false, true, true]],
  ['#/investigate/rules', [false, false, true, true]],
  ['#/investigate/exports', [false, false, true, true]],
  ['#/investigate/playback', [false, false, false, true]],
  ['#/investigate/playback/sync', [false, false, false, true]],
  ['#/investigate/floors/f0/history', [false, false, false, true]],
  ['#/investigate/health', [false, false, true, true]],
  ['#/system/devices', [false, false, true, true]],
  ['#/system/security/cameras', [false, false, true, true]],
  ['#/system/security/nvr', [true, true, true, true]],
  ['#/system/setup', [true, true, true, true]],
  ['#/system/wizard', [true, true, true, true]],
  ['#/system/notifications', [true, true, true, true]],
  ['#/devices/building', [true, true, true, true]],
  ['#/explore/sites', [true, true, true, true]],
  ['#/explore/floors/f0', [true, true, true, true]],
  ['#/multimedia/screens', [true, true, true, true]],
  ['#/wiskey/overview', [true, true, true, true]],
  ['#/security/alarm', [true, true, true, true]],
];

test.afterEach(() => applyCapabilities(null));

test('resolveCapabilities: the demo (no me) has everything, an older backend is read through its mode, a new one through its block', () => {
  expect(resolveCapabilities(null)).toEqual(ALL_CAPABILITIES);
  expect(resolveCapabilities({})).toEqual(ALL_CAPABILITIES);
  expect(resolveCapabilities({ mode: 'full' })).toEqual(ALL_CAPABILITIES);
  const old = resolveCapabilities({ mode: 'ha_only' });
  expect([old.nvr, old.live_video, old.playback, old.events_recorder, old.supported]).toEqual([false, false, false, false, true]);
  expect(old.ha_cameras_still).toBe(true);
  expect(resolveCapabilities({ mode: 'full', capabilities: COMBOS.C })).toEqual(COMBOS.C); // the block wins over the mode
  expect(resolveCapabilities({ capabilities: { nvr: false } as Capabilities }).go2rtc).toBe(true); // a partial block keeps the rest on
});

test('the route table: every shell href is offered (or not) per installation', () => {
  (['A', 'B', 'C', 'D'] as const).forEach((id, i) => {
    applyCapabilities(COMBOS[id]);
    for (const [href, expected] of TABLE) expect(!capHiddenHref(href), `${id} ${href}`).toBe(expected[i]);
  });
});

test('segments of an href, and what a route needs', () => {
  expect(segmentsOfHref('#/investigate/playback/sync?x=1')).toEqual(['investigate', 'playback', 'sync']);
  expect(needsOfSegments(['live'])).toEqual(['nvr', 'supported']);
  expect(needsOfSegments(['live', 'cameras', 'c1'])).toEqual(['nvr']);
  expect(needsOfSegments(['kiosk'])).toEqual(['nvr', 'supported']);
  expect(needsOfSegments(['investigate'])).toEqual(['playback']); // the bare URL opens playback
  expect(needsOfSegments(['investigate', 'events'])).toEqual(['events_recorder']);
  expect(needsOfSegments(['system', 'security', 'nvr'])).toEqual([]);
  expect(needsOfSegments(['devices', 'building'])).toEqual([]);
});

test('direct URLs: the missing needs and the panel kind (no recorder vs a recorder without its media server)', () => {
  applyCapabilities(COMBOS.A);
  expect(routeMissing(route('/live/wall'))).toEqual(['nvr']);
  expect(blockKind(routeMissing(route('/live/wall')))).toBe('no_nvr');
  expect(blockKind(routeMissing(route('/investigate/playback')))).toBe('no_nvr'); // no NVR at all: not "needs a media server"
  applyCapabilities(COMBOS.C);
  expect(missing(['nvr', 'supported'])).toEqual(['supported']);
  expect(blockKind(routeMissing(route('/live/wall')))).toBe('no_media');
  expect(blockKind(routeMissing(route('/investigate/playback')))).toBe('no_media');
  expect(routeMissing(route('/investigate/events'))).toEqual([]);
  expect(routeMissing(route('/live/cameras/c1'))).toEqual([]);
  applyCapabilities(COMBOS.D);
  expect(routeMissing(route('/live/wall'))).toEqual([]);
  expect(routeMissing(null)).toEqual([]);
});

test('the notification sources that exist only with an NVR', () => {
  for (const s of ['nvr.offline', 'nvr.storage', 'camera.offline']) expect(needsNvrSource(s), s).toBe(true);
  for (const s of ['sensor.leak', 'alarm.triggered', 'device.unavailable', 'system.health', 'backup.failed']) expect(needsNvrSource(s), s).toBe(false);
});

test('the tab rows of the security area per installation (a section with no page left disappears)', () => {
  const rows = (id: 'A' | 'B' | 'C' | 'D') => {
    applyCapabilities(COMBOS[id]);
    return { live: visibleTabs(SECTION_TABS.live, true, all).map((t) => t.id), investigate: visibleTabs(SECTION_TABS.investigate, true, all).map((t) => t.id) };
  };
  expect(rows('A')).toEqual({ live: [], investigate: [] });
  expect(rows('B')).toEqual({ live: [], investigate: [] });
  expect(rows('C')).toEqual({ live: [], investigate: ['events', 'reviews', 'search', 'cases', 'rules', 'exports', 'health'] });
  expect(rows('D').live).toEqual(['overview', 'wall', 'views']);
  expect(rows('D').investigate).toEqual(['events', 'playback', 'sync', 'history', 'reviews', 'search', 'cases', 'rules', 'exports', 'health']);
});
