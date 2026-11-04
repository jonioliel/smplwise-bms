import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dropOrder } from '../src/notice-tv/tv-fit';
import { INVERT_DOMAINS, canInvert, toggleInvert } from '../src/notices/info-chips-model';
import { NC_KEYS, nc } from '../src/i18n/notice-chips';
import { nt } from '../src/i18n/notices';

// BOARD-ANSWERS-2400 (owner answers 04.11, round 18): Q12 imperative labels, Q13 the copy is kept when the TV connects (screen text),
// Q15 a fault outlasts a healthy chip, Q16 "הפוך" per picked on / off entity, Q17 only a system administrator edits the sources.
// Pure rules + the wiring read from the source. Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-board-answers-2400.spec.ts --workers=1

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
const HA_WORDS = /Home Assistant|\bHA\b|Supervisor|Ingress|Companion|add-on/i;

test('Q12: the board buttons are imperative, as built', () => {
  expect(nt('copyLink', undefined, 'he')).toBe('העתק קישור');
  expect(nt('newLink', undefined, 'he')).toBe('החלף קישור');
  expect(nt('copyAsk2', undefined, 'he')).toBe('החלף קישור');
  expect(nt('resend', undefined, 'he')).toBe('שלח שוב');
});

test('Q13: a board still without a stored copy says the copy is kept the next time the TV connects', () => {
  const he = nt('noStoredLink', undefined, 'he');
  expect(he).toContain('יישמר בפעם הבאה שהטלוויזיה מתחברת');
  expect(he).toContain('העתק קישור');
  expect(nt('linkPending', undefined, 'he')).toContain('יישמר בפעם הבאה שהטלוויזיה מתחברת');
  for (const k of ['noStoredLink', 'linkPending'] as const) {
    expect(nt(k, undefined, 'en')).not.toBe(nt(k, undefined, 'he'));
    expect(nt(k, undefined, 'en')).toContain('next time the TV connects');
    expect(nt(k, undefined, 'he')).not.toMatch(HA_WORDS);
  }
  const src = read('src/screens/system-notices.ts');
  expect(src).toContain("b.has_stored_link === false ? html`<p class=\"hint\" data-link-pending>${nt('linkPending')}</p>`");
  expect(src).toContain("${c?.legacy ? html`<p data-no-stored-link>${nt('noStoredLink')}</p>` : nothing}");
});

test('Q15: a chip with a fault or a warning outlasts a healthy chip higher in the list', () => {
  // healthy chips leave first (the lower one first), then "off", then warnings, an alarm last
  expect(dropOrder(['alarm', 'ok', 'warn', 'ok'])).toEqual([3, 1, 2, 0]);
  expect(dropOrder(['ok', 'off'])).toEqual([0, 1]);
  expect(nc('orderHint', undefined, 'he')).toContain('תקלה נשארת עד הסוף');
});

test('Q16: only on / off entities can be inverted, read from the id', () => {
  expect([...INVERT_DOMAINS]).toEqual(['binary_sensor', 'input_boolean', 'switch', 'schedule']);
  for (const id of ['binary_sensor.spot_1', 'input_boolean.gym', 'switch.spot', 'schedule.gym_hours']) expect(canInvert(id), id).toBe(true);
  for (const id of ['sensor.lot_free', 'input_number.lot', 'counter.lot', 'input_select.lot', 'select.gym_mode', 'nonsense', '']) expect(canInvert(id), id).toBe(false);
});

test('Q16: toggling "הפוך" keeps a picked, invertible subset in the picked order', () => {
  const picked = ['sensor.lot', 'binary_sensor.b', 'switch.a'];
  expect(toggleInvert(picked, [], 'switch.a', true)).toEqual(['switch.a']);
  expect(toggleInvert(picked, ['switch.a'], 'binary_sensor.b', true)).toEqual(['binary_sensor.b', 'switch.a']);
  expect(toggleInvert(picked, ['binary_sensor.b', 'switch.a'], 'switch.a', false)).toEqual(['binary_sensor.b']);
  expect(toggleInvert(picked, [], 'sensor.lot', true), 'a number cannot be inverted').toEqual([]);
  expect(toggleInvert(picked, ['binary_sensor.gone'], 'switch.a', true), 'a flag of a source no longer picked is dropped').toEqual(['switch.a']);
  expect(toggleInvert(picked, [], 'switch.not_picked', true)).toEqual([]);
});

test('Q16: Hebrew and English text for every key, no platform words', () => {
  for (const k of NC_KEYS) {
    expect(nc(k, { n: 'x', k: 'y' }, 'he'), k).not.toMatch(HA_WORDS);
    expect(nc(k, { n: 'x', k: 'y' }, 'en'), k).not.toMatch(HA_WORDS);
    expect(nc(k, undefined, 'en'), k).not.toBe(nc(k, undefined, 'he'));
  }
  expect(nc('invert', undefined, 'he')).toBe('הפוך');
  expect(nc('invertOne', { n: 'חניה 1' }, 'he')).toBe('הפוך: חניה 1');
  expect(nc('invertParking', undefined, 'he')).toContain('פעיל = פנוי');
  expect(nc('invertGym', undefined, 'he')).toContain('פעיל = סגור');
});

test('Q16 + Q17: the wiring - the checkbox sends <kind>_inverted, the screen passes the lists, the card is the administrator\'s', () => {
  const el = read('src/notices/info-sources.ts');
  expect(el).toContain('${canInvert(id) ? html`<label class="inv"');
  expect(el).toContain('this.send({ [`${kind}_inverted`]: toggleInvert(list, inv, id, (e.target as HTMLInputElement).checked) })');
  expect(el).toContain('data-info-source-invert');
  const screen = read('src/screens/system-notices.ts');
  expect(screen).toContain('.inverted=${{ parking: st.parking_inverted ?? [], gym: st.gym_inverted ?? [] }}');
  expect(screen).toContain('${can.configure ? this.defaultsCard() : nothing}'); // the sources (and "הפוך") live in the defaults card only
  const api = read('src/api/notices.ts');
  expect(api).toContain('parking_inverted?: string[];');
  expect(api).toContain('gym_inverted?: string[];');
});
