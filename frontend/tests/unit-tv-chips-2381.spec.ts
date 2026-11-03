import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chipFitOf, dropOrder } from '../src/notice-tv/tv-fit';
import { TVFIT_FACTORY, effectiveTvFit, tvFitDefaultsOf } from '../src/notices/display-fit-model';
import {
  INFO_KINDS, SOURCE_MAX, addSource, infoRows, moveInfo, needsSource, offerable, pickedOrder, removeSource, sourceName, toggleInfo,
} from '../src/notices/info-chips-model';
import { NC_KEYS, nc } from '../src/i18n/notice-chips';
import { nt } from '../src/i18n/notices';

// TV-CHIPS-2381 (owner answers 03.11): Q3 = B - the portrait footer hides chips by priority by default (two rows stay a choice; a stored
// rows is kept) and the priority order (a board's chip list) is editable; Q4 = A - the parking / gym chips read entities picked in the
// settings, nothing picked = no chip. Pure rules + the wiring read from the source.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tv-chips-2381.spec.ts --workers=1

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
const HA_WORDS = /Home Assistant|\bHA\b|Supervisor|Ingress|Companion|add-on/i;

// ---------------------------------------------------------------- Q3

test('Q3: drop is the default everywhere; an explicit rows wins at the installation and at the board', () => {
  expect(TVFIT_FACTORY.portrait_chips).toBe('drop');
  expect(tvFitDefaultsOf(undefined).portrait_chips).toBe('drop'); // an older backend / nothing stored
  expect(tvFitDefaultsOf({ portrait_chips: 'rows' }).portrait_chips).toBe('rows'); // stored rows kept
  expect(effectiveTvFit({}, tvFitDefaultsOf({ portrait_chips: 'rows' })).portrait_chips).toBe('rows');
  expect(effectiveTvFit({ portrait_chips: 'rows' }, tvFitDefaultsOf(undefined)).portrait_chips).toBe('rows'); // a board's own rows
  expect(effectiveTvFit({}, tvFitDefaultsOf(undefined)).portrait_chips).toBe('drop');
  expect(chipFitOf(undefined)).toBe('drop');
  expect(chipFitOf({ portrait_chips: 'rows' })).toBe('rows');
});

test('Q3: the priority - healthy first, and within one state the chip lower in the board list leaves first', () => {
  // elevators ok, generator ok, parking ok (the default order): parking, then generator, then elevators
  expect(dropOrder(['ok', 'ok', 'ok'])).toEqual([2, 1, 0]);
  // the administrator moved parking to the top (parking, elevators, generator): the generator now leaves first, parking last
  const list = moveInfo(moveInfo(['elevators', 'generator', 'parking'], 'parking', -1), 'parking', -1);
  expect(list).toEqual(['parking', 'elevators', 'generator']);
  expect(dropOrder(list.map(() => 'ok')).map((i) => list[i])).toEqual(['generator', 'elevators', 'parking']);
  // a problem stays to the end whatever its place
  expect(dropOrder(['ok', 'alarm', 'ok', 'warn'])).toEqual([2, 0, 3, 1]);
});

test('Q3: the editable order - picked kinds in their order, then the others; tick adds last, move swaps, ends are fixed', () => {
  expect(INFO_KINDS).toEqual(['elevators', 'generator', 'parking', 'gym']); // the default order: elevators, generator, parking
  expect(pickedOrder(['parking', 'elevators', 'parking', 'pool'])).toEqual(['parking', 'elevators']);
  expect(infoRows(['generator', 'elevators']).map((r) => [r.kind, r.on, r.pos])).toEqual([
    ['generator', true, 0], ['elevators', true, 1], ['parking', false, -1], ['gym', false, -1]]);
  expect(toggleInfo(['elevators', 'generator', 'parking'], 'gym', true)).toEqual(['elevators', 'generator', 'parking', 'gym']);
  expect(toggleInfo(['elevators', 'generator', 'parking'], 'parking', false)).toEqual(['elevators', 'generator']);
  // the 2.38.0 behaviour of the board page spec: untick parking, tick gym -> elevators, generator, gym
  expect(toggleInfo(toggleInfo(['elevators', 'generator', 'parking'], 'parking', false), 'gym', true)).toEqual(['elevators', 'generator', 'gym']);
  expect(moveInfo(['elevators', 'generator', 'parking'], 'parking', -1)).toEqual(['elevators', 'parking', 'generator']);
  expect(moveInfo(['elevators', 'generator', 'parking'], 'elevators', 1)).toEqual(['generator', 'elevators', 'parking']);
  expect(moveInfo(['elevators', 'generator'], 'elevators', -1)).toEqual(['elevators', 'generator']);
  expect(moveInfo(['elevators', 'generator'], 'generator', 1)).toEqual(['elevators', 'generator']);
  expect(moveInfo(['elevators'], 'gym', -1)).toEqual(['elevators']); // not picked: nothing moves
});

test('Q3: the drop button and hint name the priority order; English twins', () => {
  expect(nt('portraitChips_drop', undefined, 'he')).toBe('שורה אחת, מסתירים לפי סדר העדיפות');
  expect(nt('portraitChipsHint', undefined, 'he')).toContain('ברירת המחדל');
  expect(nt('portraitChipsHint', undefined, 'he')).toContain('מצב הבניין');
  expect(nt('portraitChips_drop', undefined, 'en')).toBe('One row, hidden by priority');
  expect(nc('orderHint', undefined, 'he')).toContain('סדר העדיפות');
  expect(nc('moveUp', { k: 'חניה פנויה' }, 'he')).toBe('הזזה למעלה: חניה פנויה');
});

// ---------------------------------------------------------------- Q4

test('Q4: the source lists - no repeats, at most 8, remove, offer only what is not picked, a missing entity has no name', () => {
  expect(SOURCE_MAX).toBe(8);
  expect(addSource([], 'sensor.lot')).toEqual(['sensor.lot']);
  expect(addSource(['sensor.lot'], 'sensor.lot')).toEqual(['sensor.lot']);
  expect(addSource(['sensor.lot'], '')).toEqual(['sensor.lot']);
  const eight = Array.from({ length: 8 }, (_x, i) => `sensor.s${i}`);
  expect(addSource(eight, 'sensor.more')).toEqual(eight);
  expect(removeSource(['a.b', 'c.d'], 'a.b')).toEqual(['c.d']);
  const cands = [{ entity_id: 'sensor.lot', name: 'חניון' }, { entity_id: 'binary_sensor.spot_1', name: 'מקום 1' }];
  expect(offerable(cands, ['sensor.lot']).map((c) => c.entity_id)).toEqual(['binary_sensor.spot_1']);
  expect(sourceName(cands, 'sensor.lot')).toBe('חניון');
  expect(sourceName(cands, 'sensor.gone')).toBeNull();
});

test('Q4: a picked parking / gym kind without a source says it will not show; unknown sources say nothing', () => {
  expect(needsSource('parking', { parking: [], gym: ['x.y'] })).toBe(true);
  expect(needsSource('gym', { parking: [], gym: ['x.y'] })).toBe(false);
  expect(needsSource('elevators', { parking: [], gym: [] })).toBe(false);
  expect(needsSource('parking', null)).toBe(false);
});

test('Q4: Hebrew and English text for every key, no platform words', () => {
  for (const k of NC_KEYS) {
    expect(nc(k, undefined, 'he'), k).not.toBe(k);
    expect(nc(k, undefined, 'en'), k).not.toBe(k);
    expect(nc(k, undefined, 'he'), k).not.toMatch(HA_WORDS);
    expect(nc(k, undefined, 'en'), k).not.toMatch(HA_WORDS);
    expect(nc(k, undefined, 'he'), k).toMatch(/[֐-׿]/);
  }
  expect(nc('max', { n: 8 }, 'he')).toBe('עד 8 ישויות');
  for (const f of ['src/notices/info-sources.ts', 'src/notices/display-info.ts']) expect(read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')).not.toMatch(HA_WORDS);
});

test('wiring: the sources card in the defaults card (saved at once), the order editor and its source note on the board tab', () => {
  const screen = read('src/screens/system-notices.ts');
  expect(screen).toContain("import '../notices/info-sources';");
  expect(screen).toContain('<notice-info-sources .parking=${st.parking_entities ?? []} .gym=${st.gym_entities ?? []} .candidates=${s.info_entities ?? {}}');
  expect(screen).toContain('@info-sources-change=${(e: CustomEvent<{ parking_entities?: string[]; gym_entities?: string[] }>) => this.patchSettings(e.detail)}');
  expect(screen).toMatch(/<notice-display-info [^>]*\.sources=\$\{s\.parking_entities \?/);
  const src = read('src/notices/info-sources.ts');
  expect(src).toContain('info-sources-change');
  expect(src).toContain('`${kind}_entities`');
  const ed = read('src/notices/display-info.ts');
  for (const s of ['moveInfo(this.value, r.kind, -1)', 'moveInfo(this.value, r.kind, 1)', 'toggleInfo(this.value, r.kind', 'data-info-no-source']) expect(ed).toContain(s);
  const api = read('src/api/notices.ts');
  expect(api).toContain('parking_entities?: string[];');
  expect(api).toContain('info_entities?:');
});
