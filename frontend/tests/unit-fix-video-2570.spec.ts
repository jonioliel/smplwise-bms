import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// FIX-VIDEO-2570 (final deep review 2.56, area VIDEO-DEVICES): source checks that need no page. The behaviour is covered by
// tests/evidence-fix-video-2570.spec.ts (camera OSD, schedules bulk) and smplwise_vms/backend/tests/test_fix_video_2570.py (NVR writes).
//   npx playwright test -c playwright.unit.config.ts tests/unit-fix-video-2570.spec.ts
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const src = (p: string) => readFileSync(path.join(SRC, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

test('VD-03: no command carrying a request id is stamped from the device clock (Date.now() next to commandId())', () => {
  const bad: string[] = [];
  for (const p of walk(SRC)) {
    if (/-mock\.ts$|[\\/]mocks?[\\/]/.test(p) || p.endsWith('server-clock.ts')) continue;
    readFileSync(p, 'utf8').split('\n').forEach((ln, i) => {
      if (/commandId\(\)/.test(ln) && /Date\.now\(\) *\+/.test(ln)) bad.push(`${path.relative(SRC, p)}:${i + 1}`);
      if (/\.(bulkRun|pauseRun)\(/.test(ln) && /Date\.now\(\)/.test(ln)) bad.push(`${path.relative(SRC, p)}:${i + 1}`);
    });
  }
  expect(bad).toEqual([]);
  // the area "all off" of the multimedia card uses the shared 15 s server-clock expiry
  expect(src('screens/devices-media-card.ts')).toMatch(/media\(\)\.bulkRun\('area', this\.areaId, commandId\(\), expiry\(\)\)/);
});

test('SCR-29: the date-format list follows what the NVR holds (live binding), and a failed write re-reads the recorder', () => {
  const s = src('screens/live-camera.ts');
  expect(s).toMatch(/data-osd-date-style \.value=\$\{live\(o\.datetime\.date_style\)\}/);
  const act = s.slice(s.indexOf('private async osdAction('), s.indexOf('private async rereadOsd('));
  expect(act).toMatch(/const reread = await this\.rereadOsd\(gen\);/);
  expect(act).toMatch(/err\.body\?\.details\?\.outcome === 'unknown'/);
  expect(act).not.toMatch(/retry|setTimeout/); // never re-sent
});

test('SCR-54: the bulk bar acts on the page on screen - the same page computation as the list', () => {
  const s = src('screens/devices-schedules.ts');
  expect(s).toMatch(/return pickedShown\(this\.pageView\(this\.shownRows\(this\.scopedItems\(\)\)\)\.items, this\.selected\);/);
  const list = s.slice(s.indexOf('private renderList('), s.indexOf('private renderBulk('));
  expect(list).toMatch(/const \{ items: pageItems, page, pages \} = this\.pageView\(rows\);/);
});
