import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// CR-FE-NITS-2442 (code review 06, frontend chain step FE-4): the small findings NOOP-1, STORE-1, TIMER-1 (rest), RESIZE-1 (rest), RTL-1.
// Node only. The pure pieces (safe storage, the frame coalescer) are run; how the screens use them is checked in the source, as the
// other screen guards do (unit-floor-map-state, unit-shell-timers) - the screens are Lit elements and need a browser to run.
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ------------------------------------------------------------------------------------------------ 06:NOOP-1

test('NOOP-1: the no-op ternary, the unused parameters, the double imports and the duplicate glyphs are gone', () => {
  expect(src('screens/automation-editor-base.ts')).not.toContain('f.maybe_saved ? `${f.message}` : f.message');
  expect(src('screens/schedule-editor.ts')).toContain('private overlapIdx(a: EditSlot, b: EditSlot): boolean {');
  expect(src('screens/devices-building.ts')).toContain('private onAreaLink(e: MouseEvent, id: string) {');
  expect(src('screens/devices-layout.ts')).toContain('private setPickAll(on: boolean) {');
  // the corner radius is read from the input when "apply" is pressed: no closure variable is written on every change
  const panel = src('screens/plan-studio-panel.ts');
  expect(panel).toContain('const typed = Math.min(0.5, max);');
  expect(panel).not.toMatch(/typed = parseFloat/);
  // live-camera: every module once, and the <sw-field> it renders is imported by the file that renders it
  const cam = src('screens/live-camera.ts');
  const imports = cam.split('\n').filter((l) => l.startsWith('import '));
  const from = imports.map((l) => /from '([^']+)';$/.exec(l)?.[1] ?? /^import '([^']+)';$/.exec(l)?.[1] ?? l);
  const sideEffect = imports.filter((l) => /^import '/.test(l));
  expect(new Set(sideEffect).size, 'a side-effect import written twice').toBe(sideEffect.length);
  expect(from.filter((m) => m === '../api/nvr').length).toBe(1);
  expect(cam).toContain('<sw-field');
  expect(sideEffect).toContain("import '../components/sw-field';");
  // home widgets: one drawing per glyph
  const hw = src('screens/home-widgets.ts');
  expect(hw).toContain('const WIND = GLYPHS.wind;');
  expect(hw).toContain('const HAVDALAH = GLYPHS.moon;');
  // system-diagnostics: each doc comment sits on its own method (two stood stacked on the wrong one)
  const diag = src('screens/system-diagnostics.ts');
  expect(diag).toMatch(/could only fail\. \*\/\n {2}private renderNvrLessNotice\(/);
  expect(diag).toMatch(/like the other switches\. \*\/\n {2}private async toggleLocalSafety\(/);
  expect(diag).not.toMatch(/\*\/\n {2}\/\*\* POLISH4-WP7/);
  expect(diag).not.toMatch(/\*\/\n {2}\/\*\* OFFBOX-RESTORE-2300 \(owner answer 2026-10-30\)/);
});
