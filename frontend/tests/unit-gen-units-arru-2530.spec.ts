import { test, expect } from '@playwright/test';
import { GEN_SETTINGS, GEN_TEXT_PACKS } from '../src/generator/gen-text';
import { GLT_KEYS, GLT_TABLES } from '../src/i18n/generator-log';
import { he } from '../src/i18n/he';

// GEN-UNITS-ARRU-2530 (acceptance of GEN-UNITS-FIELD-2490: "text changes exist in all 4 languages"): the unit words inside the generator
// settings fields and the labels of those fields have Arabic and Russian words; Hebrew and English are unchanged. Node only, no browser
// (every language pack is installed while lang-packs.ts is evaluated).

type Doc = { documentElement: { lang: string } };
const g = globalThis as { document?: Doc };
function withLang<T>(lang: string, fn: () => T): T {
  const before = g.document;
  g.document = { documentElement: { lang } };
  try {
    return fn();
  } finally {
    if (before === undefined) delete g.document;
    else g.document = before;
  }
}

const HEBREW = /[֐-׿]/;
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
const HE_S = he.generator.settings;
const UNIT_KEYS = Object.keys(HE_S.units) as (keyof typeof HE_S.units)[];
const TH_KEYS = Object.keys(HE_S.th) as (keyof typeof HE_S.th)[];
const LABEL_KEYS = ['rated', 'ratedKva', 'thDefault', 'retAlerts', 'retHistory', 'retStale'] as const;
const LOG_SETTING_KEYS = GLT_KEYS.filter((k) => k === 'setSub' || k === 'setIntro' || k === 'setEnabled' || k.startsWith('set_'));

for (const lang of ['ar', 'ru'] as const) {
  test(`${lang}: every unit word and every unit-field label, same placeholders, no Hebrew, no platform name`, () => {
    const s = GEN_TEXT_PACKS[lang].settings;
    for (const k of UNIT_KEYS) {
      expect(s.units[k], `${lang}.units.${k}`).toBeTruthy();
      expect(s.units[k], `${lang}.units.${k}`).not.toMatch(HEBREW);
    }
    for (const k of TH_KEYS) {
      expect(s.th[k], `${lang}.th.${k}`).toBeTruthy();
      expect(s.th[k], `${lang}.th.${k}`).not.toMatch(HEBREW);
      expect(s.th[k], `${lang}.th.${k}: no unit in the label`).not.toMatch(/\(/);
    }
    for (const k of LABEL_KEYS) {
      expect(s[k], `${lang}.${k}`).toBeTruthy();
      expect(s[k], `${lang}.${k}`).not.toMatch(HEBREW);
      expect(placeholders(s[k]), `${lang}.${k}`).toEqual(placeholders(HE_S[k]));
    }
    expect(JSON.stringify(s)).not.toMatch(/Home Assistant|Ingress/i);
  });

  test(`${lang}: the run-log settings words (the labels of its unit fields)`, () => {
    expect(LOG_SETTING_KEYS.length).toBe(15);
    for (const k of LOG_SETTING_KEYS) {
      const v = GLT_TABLES[lang][k];
      expect(v, `${lang}.${k}`).toBeTruthy();
      expect(v!, `${lang}.${k}`).not.toMatch(HEBREW);
      expect(placeholders(v!), `${lang}.${k}`).toEqual(placeholders(GLT_TABLES.he[k]!));
    }
  });

  test(`${lang} page: GEN_SETTINGS reads the ${lang} unit words and labels, the rest stays Hebrew`, () => {
    withLang(lang, () => {
      expect(GEN_SETTINGS.units.h).toBe(GEN_TEXT_PACKS[lang].settings.units.h);
      expect(GEN_SETTINGS.units.days).toBe(GEN_TEXT_PACKS[lang].settings.units.days);
      expect(GEN_SETTINGS.th.oil_min_bar).toBe(GEN_TEXT_PACKS[lang].settings.th.oil_min_bar);
      expect(GEN_SETTINGS.retStale).toBe(GEN_TEXT_PACKS[lang].settings.retStale);
      // words this row does not translate keep the Hebrew (the main catalogue has no Arabic / Russian column)
      expect(GEN_SETTINGS.save).toBe(HE_S.save);
      expect(GEN_SETTINGS.thIntro).toBe(HE_S.thIntro);
    });
  });
}

test('Hebrew and English pages are unchanged', () => {
  withLang('he', () => {
    expect(GEN_SETTINGS.units).toBe(HE_S.units);
    expect(GEN_SETTINGS.units.h).toBe('שעות');
    expect(GEN_SETTINGS.th.oil_min_bar).toBe('לחץ שמן מינימלי');
  });
  withLang('en', () => {
    expect(GEN_SETTINGS.units.h).toBe('hours');
    expect(GEN_SETTINGS.units.kw).toBe('kW');
    expect(GEN_SETTINGS.th.oil_min_bar).toBe('Minimum oil pressure');
  });
});
