import { test, expect } from '@playwright/test';
import { ALL_CAPABILITIES, resolveCapabilities, type Capabilities } from '../src/api/capabilities';
import { STANDALONE_RECORDER, isStandaloneRow, nvrSourceShown, visibleCameras, visibleRecorderGroups } from '../src/api/camera-visibility';
import { applyCapabilities, blockKind, capHiddenHref, routeMissing } from '../src/shell/nav-capabilities';
import { SECTION_TABS, applyNvrLess, visibleTabs, type Can } from '../src/shell/nav';
import type { RouteState } from '../src/router';

// NVRLESS-CAMERAS-2411 (owner decision 2א, 08.11): an installation with no NVR shows the camera screens (live, wall, saved views,
// kiosk, camera screen, area camera cards / picker) when it has at least one camera without a recorder (`cameras_available` on /me).
// The recorder-only areas (playback, recordings, reviews, camera health, camera settings) stay hidden. Pure logic, no browser.
const caps = (o: Partial<Capabilities>): Capabilities => ({ ...ALL_CAPABILITIES, ...o });
const NO_NVR = { nvr: false, playback: false, events_recorder: false } as const;
const INST: Record<string, Capabilities> = {
  A: caps({ ...NO_NVR, go2rtc: false, live_video: false, ha_cameras_live: false, cameras_available: false }), // no NVR, no media server
  B: caps({ ...NO_NVR, go2rtc: true, live_video: false, cameras_available: false }), // no NVR, media server, no camera
  AS: caps({ ...NO_NVR, go2rtc: false, live_video: false, ha_cameras_live: false, cameras_available: true }), // A + a camera without a recorder
  BS: caps({ ...NO_NVR, go2rtc: true, live_video: true, cameras_available: true }), // B + a camera without a recorder
  C: caps({ go2rtc: false, live_video: false, playback: false, ha_cameras_live: false, supported: false, unsupported_reason: 'nvr_without_go2rtc' }),
  D: ALL_CAPABILITIES,
};
const ORDER = ['A', 'B', 'AS', 'BS', 'C', 'D'] as const;

const all: Can = () => true;
const route = (path: string): RouteState => ({ path, segments: path.split('/').filter(Boolean), params: new URLSearchParams(), mode: path.split('/').filter(Boolean)[0] as RouteState['mode'] });

// href -> offered per installation [A, B, AS, BS, C, D], written by hand
const TABLE: [string, [boolean, boolean, boolean, boolean, boolean, boolean]][] = [
  ['#/live', [false, false, true, true, false, true]],
  ['#/live/wall', [false, false, true, true, false, true]],
  ['#/live/views', [false, false, true, true, false, true]],
  ['#/kiosk', [false, false, true, true, false, true]],
  ['#/live/cameras/cam-1', [false, false, true, true, true, true]],
  // recorder-only areas: unchanged by a camera without a recorder
  ['#/investigate/playback', [false, false, false, false, false, true]],
  ['#/investigate/playback/sync', [false, false, false, false, false, true]],
  ['#/investigate/floors/f0/history', [false, false, false, false, false, true]],
  ['#/investigate/reviews', [false, false, false, false, true, true]],
  ['#/investigate/events/ev-1', [false, false, false, false, true, true]],
  ['#/investigate/health', [false, false, false, false, true, true]],
  ['#/system/devices', [false, false, false, false, true, true]],
  ['#/system/security/cameras', [false, false, false, false, true, true]],
  // the NVRLESS-295 sensor events list and the NVR settings page (where cameras without a recorder are added) stay as they were
  ['#/investigate/events', [true, true, true, true, true, true]],
  ['#/system/security/nvr', [true, true, true, true, true, true]],
  ['#/devices/building', [true, true, true, true, true, true]],
];

test.afterEach(() => applyCapabilities(null));

test('the route table per installation, with and without a camera without a recorder', () => {
  ORDER.forEach((id, i) => {
    applyCapabilities(INST[id]);
    for (const [href, expected] of TABLE) expect(!capHiddenHref(href), `${id} ${href}`).toBe(expected[i]);
  });
});

test('the live tab row appears without an NVR only when a camera without a recorder exists; investigate keeps its sensor list', () => {
  const rows = (id: (typeof ORDER)[number]) => {
    applyCapabilities(INST[id]);
    return { live: visibleTabs(SECTION_TABS.live, true, all).map((t) => t.id), investigate: visibleTabs(SECTION_TABS.investigate, true, all).map((t) => t.id) };
  };
  expect(rows('A')).toEqual({ live: [], investigate: ['events'] }); // zero cameras without a recorder: nothing changes
  expect(rows('B')).toEqual({ live: [], investigate: ['events'] });
  expect(rows('AS')).toEqual({ live: ['overview', 'wall', 'views'], investigate: ['events'] });
  expect(rows('BS')).toEqual({ live: ['overview', 'wall', 'views'], investigate: ['events'] });
  expect(rows('D').live).toEqual(['overview', 'wall', 'views']);
});

test('a direct URL without cameras gets the "no NVR" panel; with a camera without a recorder it opens', () => {
  applyCapabilities(INST.A);
  expect(routeMissing(route('/live/cameras/c1'))).toEqual(['cameras_available']);
  expect(blockKind(routeMissing(route('/live/cameras/c1')))).toBe('no_nvr');
  expect(blockKind(routeMissing(route('/live/wall')))).toBe('no_nvr');
  applyCapabilities(INST.BS);
  expect(routeMissing(route('/live/cameras/c1'))).toEqual([]);
  expect(routeMissing(route('/live/wall'))).toEqual([]);
  expect(routeMissing(route('/investigate/playback'))).toEqual(['playback']);
  expect(blockKind(routeMissing(route('/investigate/playback')))).toBe('no_nvr');
  applyCapabilities(INST.C); // an NVR without its media server: the video screens still need it
  expect(blockKind(routeMissing(route('/live/wall')))).toBe('no_media');
});

test('resolveCapabilities: cameras_available comes from the block; an older block or mode means "cameras = NVR"', () => {
  expect(resolveCapabilities(null).cameras_available).toBe(true); // the demo has everything
  expect(resolveCapabilities({ mode: 'ha_only' }).cameras_available).toBe(false);
  expect(resolveCapabilities({ mode: 'full' }).cameras_available).toBe(true);
  expect(resolveCapabilities({ capabilities: { nvr: false } as Capabilities }).cameras_available).toBe(false); // a pre-2411 block without the flag
  expect(resolveCapabilities({ capabilities: { nvr: true } as Capabilities }).cameras_available).toBe(true);
  expect(resolveCapabilities({ capabilities: { nvr: false, cameras_available: true } as Capabilities }).cameras_available).toBe(true);
  expect(resolveCapabilities({ capabilities: { nvr: true, cameras_available: false } as Capabilities }).cameras_available).toBe(false); // the block wins
});

test('applyNvrLess (compatibility switch) means no cameras either', () => {
  applyNvrLess(true);
  expect(capHiddenHref('#/live/wall')).toBe(true);
  expect(capHiddenHref('#/live/cameras/c1')).toBe(true);
  applyNvrLess(false);
  expect(capHiddenHref('#/live/wall')).toBe(false);
});

test('camera rows: without an NVR only the cameras without a recorder are shown (NN1 D5 for the leftover NVR rows)', () => {
  const cams = [
    { id: 'c1', recorder_id: 'nvr-1', standalone: false },
    { id: 'c2', recorder_id: STANDALONE_RECORDER, standalone: true },
    { id: 'c3', recorder_id: STANDALONE_RECORDER }, // an older answer without the flag: the recorder id decides
    { id: 'c4', recorder_id: 'nvr-2' },
  ];
  expect(visibleCameras(cams, true).map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
  expect(visibleCameras(cams, false).map((c) => c.id)).toEqual(['c2', 'c3']);
  expect(visibleCameras([], false)).toEqual([]);
  expect(isStandaloneRow(null)).toBe(false);
  expect(isStandaloneRow({ standalone: true })).toBe(true);
});

test('camera picker groups and camera card sources without an NVR', () => {
  const groups = [{ recorder_id: 'nvr-1', cameras: [1, 2] }, { recorder_id: STANDALONE_RECORDER, cameras: [3] }];
  expect(visibleRecorderGroups(groups, true)).toEqual(groups);
  expect(visibleRecorderGroups(groups, false)).toEqual([groups[1]]);
  expect(visibleRecorderGroups([{ id: 'nvr-1' }, { id: STANDALONE_RECORDER }], false)).toEqual([{ id: STANDALONE_RECORDER }]); // GET /cameras `recorders`
  expect(nvrSourceShown({ kind: 'nvr', recorder_id: 'nvr-1' }, false)).toBe(false); // D5
  expect(nvrSourceShown({ kind: 'nvr', recorder_id: STANDALONE_RECORDER }, false)).toBe(true);
  expect(nvrSourceShown({ kind: 'nvr', recorder_id: 'nvr-1' }, true)).toBe(true);
  expect(nvrSourceShown({ kind: 'ha', recorder_id: undefined }, false)).toBe(true); // a Home Assistant camera is not an NVR row
  expect(nvrSourceShown(null, false)).toBe(true);
});
