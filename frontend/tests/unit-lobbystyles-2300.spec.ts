import { test, expect } from '@playwright/test';
import { DESIGNS, LIVE_BGS, SYSTEMS_STATUSES, TV2_FACTORY, URGENT_SCREENS, effectiveTv2, tv2Of } from '../src/notice-tv/tv-logic';
import {
  HX_STEPS, colsFor, familyOf, fxLevelFor, fxStart, fxStep, greetingKey, isSkin, lineBreaks, lobbyDwell, minBodyPx, skyOf, urgentInRotation, lobbyDrift, lobbyPhoto, systemsShown, type FxState,
} from '../src/notice-tv/skin-logic';
import { digitsHtml, numIso, words } from '../src/notice-tv/hx-parts';
import { spring } from '../src/notice-tv/hx-engine';

// LOBBY-STYLES-2300: the pure rules of the lobby notice-board styles (owner decisions 2026-10-30).
//   npx playwright test -c playwright.unit.config.ts tests/unit-lobbystyles-2300.spec.ts

test('the six lobby styles are designs, never a default, and an unknown value reads as the factory value', () => {
  for (const s of ['lumen', 'axis', 'prism', 'gallery', 'concierge', 'stone']) {
    expect(DESIGNS).toContain(s);
    expect(isSkin(s)).toBe(true);
    expect(tv2Of({ design: s }, 'design')).toBe(s);
  }
  expect(TV2_FACTORY.design).toBe('classic');
  expect(tv2Of({ design: 'Lumen' }, 'design')).toBe('classic');
  expect(familyOf('lumen')).toBe('hitech');
  expect(familyOf('stone')).toBe('luxury');
  expect(familyOf('ink')).toBe('station');
});

test('behaviour settings: owner defaults and validation', () => {
  expect(TV2_FACTORY).toMatchObject({ live_bg: 'auto', systems_status: 'problems', urgent_screen: 'style' });
  expect(LIVE_BGS).toEqual(['auto', 'full', 'frozen', 'off']);
  expect(SYSTEMS_STATUSES).toEqual(['problems', 'always']);
  expect(URGENT_SCREENS).toEqual(['style', 'minute', 'always']);
  expect(tv2Of({ live_bg: 'turbo' }, 'live_bg')).toBe('auto');
  expect(effectiveTv2({ live_bg: 'off' }, { ...TV2_FACTORY, live_bg: 'frozen' }).live_bg).toBe('off');
  expect(effectiveTv2({}, { ...TV2_FACTORY, live_bg: 'frozen' }).live_bg).toBe('frozen');
});

test('live background: the setting wins, auto follows the measurement, reduced motion always freezes', () => {
  expect(fxLevelFor('off', 'high', false)).toBe('off');
  expect(fxLevelFor('frozen', 'high', false)).toBe('low');
  expect(fxLevelFor('full', 'off', false)).toBe('high');
  expect(fxLevelFor('full', 'high', true)).toBe('low');
  expect(fxLevelFor('auto', 'high', false)).toBe('high');
  expect(fxLevelFor('auto', 'off', true)).toBe('off');
  expect(fxStart(2)).toBe('low');
  expect(fxStart(8)).toBe('high');
});

test('auto degrade: slow -> low, slow twice -> off, six fast samples -> back one level, never on two cores', () => {
  let s: FxState = { level: 'high', slow: 0, fast: 0 };
  s = fxStep(s, 40, 8);
  expect(s.level).toBe('low');
  s = fxStep(s, 40, 8);
  expect(s.level).toBe('low');
  s = fxStep(s, 40, 8);
  expect(s.level).toBe('off');
  for (let k = 0; k < 5; k++) s = fxStep(s, 16, 8);
  expect(s.level).toBe('off');
  s = fxStep(s, 16, 8);
  expect(s.level).toBe('low');
  for (let k = 0; k < 6; k++) s = fxStep(s, 16, 8);
  expect(s.level).toBe('high');
  let weak: FxState = { level: 'low', slow: 0, fast: 0 };
  for (let k = 0; k < 10; k++) weak = fxStep(weak, 16, 2);
  expect(weak.level).toBe('low');
});

test('Prism sky follows the time of day (sun times when known)', () => {
  expect(skyOf(8 * 60)).toBe('morning');
  expect(skyOf(13 * 60)).toBe('noon');
  expect(skyOf(18 * 60)).toBe('evening');
  expect(skyOf(23 * 60)).toBe('night');
  expect(skyOf(3 * 60)).toBe('night');
  const sun = { rise: '06:30', set: '17:10' };
  expect(skyOf(7 * 60, sun)).toBe('morning');
  expect(skyOf(12 * 60, sun)).toBe('noon');
  expect(skyOf(15 * 60, sun)).toBe('evening');
  expect(skyOf(17 * 60 + 30, sun)).toBe('evening');
  expect(skyOf(18 * 60, sun)).toBe('night');
});

test('urgent behaviour per style: hi-tech full screen in the rotation, luxury the first minute only; the setting overrides', () => {
  expect(urgentInRotation('lumen', 'style')).toBe(true);
  expect(urgentInRotation('prism', 'style')).toBe(true);
  expect(urgentInRotation('gallery', 'style')).toBe(false);
  expect(urgentInRotation('stone', 'style')).toBe(false);
  expect(urgentInRotation('lumen', 'minute')).toBe(false);
  expect(urgentInRotation('gallery', 'always')).toBe(true);
});

test('shrink steps to 55 %, columns for a long body, the 22 px floor', () => {
  expect(HX_STEPS[0]).toBe(1);
  expect(HX_STEPS[HX_STEPS.length - 1]).toBe(0.55);
  expect(minBodyPx('lumen')).toBe(22);
  expect(colsFor(100, true)).toBe(1);
  expect(colsFor(500, true)).toBe(2);
  expect(colsFor(1200, true)).toBe(3);
  expect(colsFor(1200, false)).toBe(2);
  expect(lobbyDwell('critical', 'x')).toBe(2);
  expect(lobbyDwell('info', 'x'.repeat(161))).toBe(2);
  expect(lobbyDwell('info', 'short')).toBe(1);
  expect(lineBreaks([0, 2, 60, 61, 130])).toEqual([[0, 1], [2, 3], [4]]);
  expect(greetingKey(9)).toBe('greetMorning');
  expect(greetingKey(14)).toBe('greetNoon');
  expect(greetingKey(19)).toBe('greetEvening');
  expect(greetingKey(2)).toBe('greetNight');
});

test('markup pieces: words per style, clock digit cells, numbers kept left to right', () => {
  expect(words('lumen', 'שלום <עולם>')).toContain('<span class="nb-wd">שלום</span>');
  expect(words('lumen', '<b>')).not.toContain('<b>');
  expect(words('axis', 'שלום')).toContain('nb-wm');
  expect(digitsHtml('09:41').match(/nb-dv/g)?.length).toBe(4);
  expect(digitsHtml('09:41')).toContain('nb-col');
  expect(numIso('09:00 – 12:30')).toContain('<bdi dir="ltr"');
  expect(numIso('קומה 3')).not.toContain('bdi');
});

test('the spring curve is a linear() that ends at 1', () => {
  const s = spring(1, 0.62);
  expect(s.ms).toBeGreaterThan(300);
  expect(s.ms).toBeLessThan(1500);
  expect(s.ease.startsWith('linear(0')).toBe(true);
  expect(s.ease.endsWith('1)')).toBe(true);
});

test('luxury: the night photo, the single darkened photo, the always-on drift, the systems row only on problems', () => {
  expect(lobbyPhoto(false, 'd', 'n')).toEqual({ src: 'd', dim: false });
  expect(lobbyPhoto(true, 'd', 'n')).toEqual({ src: 'n', dim: false });
  expect(lobbyPhoto(true, 'd', '')).toEqual({ src: 'd', dim: true });
  expect(lobbyPhoto(false, '', 'n')).toEqual({ src: 'n', dim: false });
  expect(lobbyPhoto(true, '', '')).toEqual({ src: '', dim: false });
  expect(lobbyDrift('auto', false)).toBe(true);
  expect(lobbyDrift('full', false)).toBe(true);
  expect(lobbyDrift('auto', true)).toBe(false);
  expect(lobbyDrift('frozen', false)).toBe(false);
  expect(lobbyDrift('off', false)).toBe(false);
  const info = [{ state: 'ok' }, { state: 'warn' }, { state: 'alarm' }, { state: 'off' }];
  expect(systemsShown(info, 'problems').map((x) => x.state)).toEqual(['warn', 'alarm']);
  expect(systemsShown(info, 'always')).toHaveLength(4);
  expect(systemsShown([{ state: 'ok' }], 'problems')).toEqual([]);
});
