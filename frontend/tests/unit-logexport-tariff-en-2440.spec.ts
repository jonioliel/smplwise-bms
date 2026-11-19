import { expect, test } from '@playwright/test';
import { registeredCatalogues } from '../src/i18n/core';
import { lxt, type LogExportKey } from '../src/i18n/log-export';
import { LOG_EXPORT_LEVELS, LOG_EXPORT_MINUTES } from '../src/api/health';
import { heOrEn, israelTemplate, NAME_EN_MAX, nameEnValid, touName } from '../src/electricity/elec-tou';

// CR-FE-LOGEXPORT-TARIFF-EN-2440 (Node only):
//   the log export catalogue - every key has its English, English is English, the same {placeholders}; every window / level the
//   card offers has its option label and its sentence phrase; the windows are inside the server's 1-1440 minutes, 60 is offered;
//   the tariff English names - the server's name_en rule (no Hebrew letter, up to 40 characters, empty allowed) and the shown name:
//   Hebrew interface always name_he; English: the entry's name_en, else the server's names_en, else the template's (same id AND
//   Hebrew name), else name_he.

type Doc = { documentElement: { lang: string } };
const g = globalThis as unknown as { document?: Doc };
function withLang<T>(lang: string, fn: () => T): T {
  const prev = g.document;
  g.document = { documentElement: { lang } };
  try {
    return fn();
  } finally {
    if (prev === undefined) delete g.document;
    else g.document = prev;
  }
}
const HEBREW = /[֐-׿]/;
const placeholders = (s: string): string => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('log export catalogue: complete, English, same placeholders, registered', () => {
  const cat = registeredCatalogues().find((c) => c.name === 'i18n/log-export');
  expect(cat).toBeTruthy();
  const he = cat!.tables.he as Record<string, string>;
  const en = cat!.tables.en as Record<string, string>;
  expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
  for (const k of Object.keys(he)) {
    expect(HEBREW.test(he[k]), `he ${k}`).toBe(true);
    expect(HEBREW.test(en[k]), `en ${k}`).toBe(false);
    expect(placeholders(en[k]), k).toBe(placeholders(he[k]));
    expect(`${he[k]} ${en[k]}`).not.toMatch(/home assistant|\bHA\b/i); // no platform name
  }
  withLang('he', () => expect(lxt('title')).toBe('ייצוא יומן מצונזר'));
  withLang('en', () => expect(lxt('done', { name: 'a.json' })).toBe('a.json was downloaded'));
});

test('log export choices: every window and level has its label and phrase; 60 minutes, server range', () => {
  expect(LOG_EXPORT_MINUTES).toContain(60);
  for (const m of LOG_EXPORT_MINUTES) {
    expect(m).toBeGreaterThanOrEqual(1);
    expect(m).toBeLessThanOrEqual(1440);
    for (const p of ['o', 'w']) withLang('en', () => expect(lxt(`${p}${m}` as LogExportKey)).not.toBe(`${p}${m}`));
  }
  expect(Math.max(...LOG_EXPORT_MINUTES)).toBe(1440);
  expect(LOG_EXPORT_LEVELS[0]).toBe('INFO');
  for (const l of LOG_EXPORT_LEVELS) for (const p of ['o', 'p']) withLang('he', () => expect(lxt(`${p}${l}` as LogExportKey)).not.toBe(`${p}${l}`));
  withLang('he', () => expect(lxt('confirmBody', { window: lxt('w60'), level: lxt('pINFO') })).toContain('בשעה האחרונה (מידע, אזהרות ושגיאות)'));
});

test('tariff name_en rule matches the server: no Hebrew letter, up to 40 characters, empty allowed', () => {
  expect(NAME_EN_MAX).toBe(40);
  expect(nameEnValid('')).toBe(true);
  expect(nameEnValid('Peak')).toBe(true);
  expect(nameEnValid('Fri & holiday eves (2)')).toBe(true);
  expect(nameEnValid('x'.repeat(40))).toBe(true);
  expect(nameEnValid(`  ${'x'.repeat(40)}  `)).toBe(true); // the server measures the stripped text
  expect(nameEnValid('x'.repeat(41))).toBe(false);
  expect(nameEnValid('פסגה')).toBe(false);
  expect(nameEnValid('Peak שיא')).toBe(false);
});

test('tariff names: Hebrew always name_he; English name_en > names_en > template > name_he', () => {
  const t = israelTemplate();
  const peak = t.bands.find((b) => b.id === 'peak')!;
  expect(peak.name_en).toBe('Peak');
  withLang('he', () => {
    expect(touName('bands', peak)).toBe('פסגה');
    expect(touName('bands', { id: 'b1', name_he: 'לילה', name_en: 'Night' })).toBe('לילה');
    expect(heOrEn('מקור', 'Source')).toBe('מקור');
  });
  withLang('en', () => {
    expect(touName('bands', { id: 'b1', name_he: 'לילה', name_en: 'Night' })).toBe('Night');
    expect(touName('bands', { id: 'b1', name_he: 'לילה', name_en: '  ' }, { bands: { b1: 'Night (server)' } })).toBe('Night (server)');
    // a version saved before English names existed: the template's English while id AND Hebrew name are the template's
    expect(touName('seasons', { id: 'summer', name_he: 'קיץ' })).toBe('Summer');
    expect(touName('day_types', { id: 'saturday', name_he: 'שבת וחג' })).toBe('Shabbat and holidays');
    expect(touName('seasons', { id: 'summer', name_he: 'קיץ חם' })).toBe('קיץ חם'); // renamed: no English
    expect(touName('bands', { id: 'peak', name_he: 'פסגה' }, { bands: { peak: 'Peak (server)' } })).toBe('Peak (server)');
    expect(heOrEn('מקור', 'Source')).toBe('Source');
    expect(heOrEn('מקור', undefined)).toBe('מקור');
  });
  // the template's English names are the server's (services/energy_tou.py israel_template)
  expect(t.seasons.map((s) => s.name_en)).toEqual(['Summer', 'Winter', 'Transition']);
  expect(t.day_types.map((s) => s.name_en)).toEqual(['Weekdays', 'Fridays and holiday eves', 'Shabbat and holidays']);
  expect(t.bands.map((s) => s.name_en)).toEqual(['Off-peak', 'Peak']);
});
