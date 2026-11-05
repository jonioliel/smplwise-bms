import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// VIDEO-2403. Node only, read from the sources (the behaviour itself: evidence-nn1-p2.spec.ts installation A and
// evidence-video-sub-fallback-2402.spec.ts kiosk / display wall, on the runner):
//  1. the nightly regression of v2.40.2: GET /media/video-policy (a media-server route) was asked in an installation without live video
//     (NN1, installation A). The one loader asks only with the `live_video` capability; the account menu's video section needs it too.
//  2. owner round 21, Q1 = a: the kiosk and the display wall have no quality choice - their tiles count as automatic (`autoProfile`),
//     so the sub -> main fallback of VIDEO-SUB-FALLBACK-2402 applies to them.
//   npx playwright test -c playwright.unit.config.ts tests/unit-video-2403.spec.ts
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

function body(src: string, name: string): string {
  const i = src.indexOf(name);
  expect(i, name).toBeGreaterThan(-1);
  const start = src.indexOf('{', i);
  let depth = 0;
  for (let k = start; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(start, k);
  }
  throw new Error('unbalanced ' + name);
}

test('the policy loader asks the media route only with live video, before anything is fetched', () => {
  const b = body(read('api/video-transport.ts'), 'export function loadVideoPolicy(');
  const guard = b.indexOf("if (!isApi() || !cap('live_video'))");
  expect(guard).toBeGreaterThan(-1);
  expect(guard).toBeLessThan(b.indexOf('fetchPolicy()'));
  // the only caller of GET media/video-policy is fetchPolicy, reached through loadVideoPolicy alone
  const src = read('api/video-transport.ts');
  expect(src.match(/media\/video-policy/g)?.length).toBe(3); // the doc line, the read, the re-read after the seed
  expect(body(src, 'export async function setPersonalTransport(')).toContain('loadVideoPolicy()');
});

test('no other module asks the policy route itself', () => {
  for (const p of ['api/prefs.ts', 'shell/sw-video-prefs.ts', 'screens/live-camera.ts', 'components/sw-live-player.ts', 'components/wk-station-live.ts']) {
    expect(read(p), p).not.toMatch(/get<[^>]*>\(\s*'media\/video-policy/);
  }
});

test('the account menu offers the video section only with live video', () => {
  expect(body(read('shell/sw-user-menu.ts'), 'private accountItems()')).toMatch(/const video = [^;]*cap\('live_video'\)/);
});

test('the kiosk and the display wall tiles count as automatic quality', () => {
  const kiosk = read('screens/kiosk-wall.ts');
  expect(kiosk).toMatch(/<sw-camera-tile dark data-kiosk-tile[^>]*profile="sub" autoProfile/);
  const wall = read('wall/sw-wall.ts');
  expect(wall.match(/<sw-camera-tile dark noDemo[^>]*profile="sub" autoProfile/g)?.length).toBe(2); // the tile grid and the alert tile
});
