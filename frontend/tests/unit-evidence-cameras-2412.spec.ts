import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NVR_LESS_HINT, NVR_LESS_HINT_WITH_CAMERAS, STANDALONE_LABEL, cameraStatusText, editorCameraMeta, editorCameraSource, nvrLessHint,
  STANDALONE_OFFLINE_TILE, cameraPane, standaloneMapNote,
} from '../src/api/camera-visibility';
import { testLine } from '../src/screens/camera-source-logic';

// EVIDENCE-CAMERAS-2412: the fixes the 2.41.x evidence walk found (docs/changes/EVIDENCE-CAMERAS-2412.md) - the no-NVR panel's words
// with cameras without a recorder, the NVR words the floor map card and the plan editor showed for such a camera, and the source
// dialog's box that cut its address fields off. Node-only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-evidence-cameras-2412.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8');
const standalone = { recorder_id: 'standalone', standalone: true, channel: 2, status: 'offline' };
const nvrCam = { recorder_id: 'nvr-1', channel: 3, status: 'online' };

test('the no-NVR panel does not say live / cameras are unavailable when a camera without a recorder exists', () => {
  expect(nvrLessHint(false)).toBe(NVR_LESS_HINT);
  expect(nvrLessHint(true)).toBe(NVR_LESS_HINT_WITH_CAMERAS);
  expect(NVR_LESS_HINT_WITH_CAMERAS).not.toMatch(/לייב, מצלמות/);
  expect(NVR_LESS_HINT_WITH_CAMERAS).toMatch(/הקלטות/);
  expect(NVR_LESS_HINT_WITH_CAMERAS).toMatch(/מצלמות ללא מקליט/);
  // the shell uses the helper, not its own copy of the old text
  const app = read('shell/sw-app.ts');
  expect(app).toContain('hint=${nvrLessHint(this.session.capabilities.cameras_available)}');
  expect(app).not.toContain('hint="ההתקנה פועלת במצב ללא NVR');
});

test('the plan editor: a camera without a recorder is named as such, in Hebrew; an NVR camera keeps its words', () => {
  expect(editorCameraMeta(standalone)).toBe(`${STANDALONE_LABEL} · מנותקת`);
  expect(editorCameraMeta({ ...standalone, status: 'online' })).toBe(`${STANDALONE_LABEL} · מחוברת`);
  expect(editorCameraMeta({ ...standalone, status: 'unknown' })).toBe(`${STANDALONE_LABEL} · מצב לא ידוע`);
  expect(editorCameraMeta(standalone)).not.toMatch(/[A-Za-z]/);
  expect(editorCameraSource(standalone)).toBe(STANDALONE_LABEL);
  expect(editorCameraMeta(nvrCam)).toBe('ch 3 · online');
  expect(editorCameraSource(nvrCam)).toBe('NVR · ch 3');
  expect(cameraStatusText(null)).toBe('מצב לא ידוע');
  const ed = read('screens/explore-plan-editor.ts');
  expect(ed).toContain('${editorCameraMeta(c)}');
  expect(ed).toContain('editorCameraSource(cam)');
});

test('the floor map card: no NVR words for a camera without a recorder', () => {
  expect(standaloneMapNote('still')).not.toMatch(/NVR/);
  expect(standaloneMapNote('offline')).not.toMatch(/NVR/);
  const map = read('screens/explore-floor-map.ts');
  expect(map).toMatch(/standalone\s*\? html`<dt>מקור<\/dt><dd data-standalone-source>\$\{STANDALONE_LABEL\}<\/dd>`/);
  expect(map).toContain("standalone ? standaloneMapNote('offline')");
  expect(map).toContain("standalone ? standaloneMapNote('still')");
  expect(STANDALONE_OFFLINE_TILE).not.toMatch(/NVR/);
  expect(map).toContain("standalone ? STANDALONE_OFFLINE_TILE : t('camera.offlineReason')");
});

test('the video source dialog asks for the wide box: its 560 px body fits (the 440 px default box cut the fields off)', () => {
  const dlg = read('components/camera-source-dialog.ts');
  expect(dlg).toContain('<sw-dialog open wide heading=');
  const body = Number(/\.body \{[^}]*min-inline-size: min\((\d+)px/.exec(dlg)?.[1]);
  const box = read('components/sw-dialog.ts');
  const wide = Number(/:host\(\[wide\]\) \.box \{\s*inline-size: min\((\d+)px/.exec(box)?.[1]);
  expect(body).toBeGreaterThan(440);
  expect(wide).toBeGreaterThan(body);
});

test('the stream test line keeps the resolution as one left-to-right run (RTL drew 1920×1080 as 1080×1920)', () => {
  const line = testLine({ ok: true, width: 1920, height: 1080, codec: 'h264', codec_label: 'H.264', preview: 'data:' });
  expect(line).toContain('⁦1920×1080⁩');
});

test('the camera screen: without the WebRTC server the notice wins, also over a stale offline status', () => {
  expect(cameraPane({ status: 'offline' }, false)).toBe('webrtc_required');
  expect(cameraPane({ status: 'online' }, false)).toBe('webrtc_required');
  expect(cameraPane({ status: 'unknown' }, false)).toBe('webrtc_required');
  // with the server: as before
  expect(cameraPane({ status: 'offline' }, true)).toBe('off');
  expect(cameraPane({ status: 'online' }, true)).toBe('player');
  // no live permission: never the notice; a still camera keeps its still
  expect(cameraPane({ status: 'online', can_view_live: false }, false)).toBe('off');
  expect(cameraPane({ status: 'online', live_kind: 'still' }, false)).toBe('still');
  expect(cameraPane({ status: 'online', live_kind: 'still' }, true)).toBe('still');
  const screen = read('screens/live-camera.ts');
  expect(screen).toContain('const pane = cameraPane(cam, webrtcServer());');
  expect(screen).toContain(": pane === 'webrtc_required'");
});

test('the "cameras without a recorder" rows wrap their actions instead of running off a phone screen', () => {
  const card = read('components/standalone-cameras-card.ts');
  expect(card).toMatch(/li \{\s*display: flex;\s*flex-wrap: wrap;/);
  expect(card).toContain('<span class="acts"><sw-button size="sm" variant="ghost" icon="live"');
  expect(card).toMatch(/li \.acts \{[^}]*margin-inline-start: auto;/);
  expect(card).toMatch(/li \.name \{\s*flex: 1 1 8em;\s*min-inline-size: 7em;/);
});

test('the camera screen styles its "to settings" link (not the browser default blue on the dark video area)', () => {
  expect(read('screens/live-camera.ts')).toMatch(/\.center\[data-webrtc-required\] a \{\s*color: inherit;/);
});
