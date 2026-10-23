import { test, expect } from '@playwright/test';
import { GLT_DEV_MARKED, GLT_KEYS, GLT_TABLES, glt } from '../src/i18n/generator-log';
import { TT_KEYS, TT_TABLES } from '../src/i18n/temperature';
import { factorText, FACTOR_ICON } from '../src/temperature/explain-model';
import type { ExplainFactor, ExplainKey } from '../src/api/temperature';

// GENLOG092-295 + TEMPEXPLAIN093-295: the strings of the generator run log and the words of the "why did it warm?" factors (pure, no DOM).

const f = (key: ExplainKey, vars: ExplainFactor['vars'] = {}): ExplainFactor => ({ key, score: 80, vars });

test('run log strings: Hebrew and English complete, placeholders match, no platform name', () => {
  for (const k of GLT_KEYS) {
    expect([k, (GLT_TABLES.en[k] ?? '').length > 0]).toEqual([k, true]);
    const he = (GLT_TABLES.he[k] ?? '').match(/\{\w+\}/g) ?? [];
    const en = (GLT_TABLES.en[k] ?? '').match(/\{\w+\}/g) ?? [];
    expect([k, en.sort()]).toEqual([k, he.sort()]);
    expect([k, /Home Assistant|\bHA\b|Ingress/.test(GLT_TABLES.he[k] ?? '')]).toEqual([k, false]);
  }
  expect(GLT_DEV_MARKED).toEqual(['ar', 'ru']);
  expect(glt('page_of', { p: 2, n: 5 }, 'he')).toBe('עמוד 2 מתוך 5');
  expect(glt('kind_mains_failure', undefined, 'ar')).toBeTruthy();
  expect(glt('setIntro', undefined, 'ru')).toBe(GLT_TABLES.he.setIntro); // falls back to Hebrew
  // every setting of the server's LOG_SPECS has its label
  for (const k of ['min_run_s', 'mains_lookback_s', 'test_min_minutes', 'test_max_minutes', 'classify_unloaded_as_test', 'test_interval_days', 'no_data_close_min',
    'refill_min_pct', 'refill_settle_min', 'drop_min_pct', 'fuel_window_h', 'retention_days']) expect(GLT_KEYS).toContain(`set_${k}`);
  for (const r of ['mode_test', 'start_reason', 'mains_lost', 'mode_manual', 'unloaded', 'none']) expect(GLT_KEYS).toContain(`why_${r}`);
});

test('explanation words: every factor key has words and an icon, in Hebrew and English', () => {
  const all: ExplainKey[] = ['maint', 'defrost', 'door', 'outage', 'compressor_off', 'compressor_no_power', 'compressor_on', 'unit_off', 'setpoint', 'gap', 'spike', 'shared', 'local', 'gradual'];
  for (const k of all) {
    expect(FACTOR_ICON[k]).toBeTruthy();
    for (const lang of ['he', 'en'] as const) {
      const s = factorText(f(k), 'high', lang);
      expect([k, lang, s.length > 3, s.includes('fx_')]).toEqual([k, lang, true, false]);
    }
  }
  for (const k of TT_KEYS.filter((x) => x.startsWith('fx_') || x.startsWith('why') || x.startsWith('explain'))) expect([k, (TT_TABLES.en[k] ?? '').length > 0]).toEqual([k, true]);
});

test('explanation words carry the evidence', () => {
  expect(factorText(f('door', { count: 2, total_min: 6.5, lead_min: 8, open_at_start: false }), 'high', 'he')).toBe('הדלת נפתחה 2 פעמים, 6.5 דק׳ בסך הכול, החל מ-8 דק׳ לפני');
  expect(factorText(f('door', { count: 1, total_min: 4, lead_min: 2, open_at_start: true }), 'high', 'en')).toBe('The door was open when the excursion started (4 min in total)');
  expect(factorText(f('outage', { device_name: '', lead_min: 30, minutes: 45 }), 'high', 'en')).toBe('Mains power outage (per the generator), 30 min before, lasting 45 min');
  expect(factorText(f('shared', { n_moved: 2, n_total: 3, names: ['A', 'B'] }), 'low', 'en')).toContain('cooled too (A, B)');
  expect(factorText(f('setpoint', { sp_from: 4, sp_to: 7 }), 'high', 'en')).toBe('The setpoint was changed from 4° to 7°');
  expect(factorText(f('maint', { reason: 'ניקוי' }), 'high', 'he')).toBe('חלון תחזוקה היה פתוח: ניקוי');
  expect(factorText(f('gap', { gap_min: 25, silent: false }), 'high', 'en')).toBe('The sensor did not report for 25 min before the excursion');
});
