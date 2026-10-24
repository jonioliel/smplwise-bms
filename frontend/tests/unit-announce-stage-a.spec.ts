import { test, expect } from '@playwright/test';
import type { AnnounceTemplate } from '../src/api/announcements';
import {
  ALL_ROOMS, applyTemplate, blankTemplate, canSend, cleanTemplates, emergencyTemplates, languagesOf, partsOf, removeTemplate, routineTemplates, setField, setKind, spokenLangOf,
  templateName, templatesProblem, toggleLang,
} from '../src/announce/model';
import { ANNOUNCE_DEV_MARKED, ANNOUNCE_TABLES, announceText, type AnnounceUiLang } from '../src/i18n/announce';
import { ANNOUNCE_HREF, DEVICES_TABS, TAB_PERMISSIONS } from '../src/shell/nav';

// ANNOUNCE-295 (stage A): the pure logic of the announce screen and the templates editor, the four string tables and the navigation entry.
// Node only; synthetic template texts.

const T: AnnounceTemplate[] = [
  { id: 'water', kind: 'routine', name: { he: 'מים', en: 'Water', ru: 'Вода' }, text: { he: 'שלום', en: 'Hello', ru: 'Привет' } },
  { id: 'he_only', kind: 'routine', name: { he: 'רק עברית' }, text: { he: 'רק עברית כאן' } },
  { id: 'evac', kind: 'emergency', name: { he: 'פינוי', en: 'Evacuate' }, text: { he: 'פנו', en: 'Evacuate now' } },
];

test('the spoken language follows the screen, Arabic screens speak Hebrew', () => {
  expect(spokenLangOf('he')).toBe('he');
  expect(spokenLangOf('en')).toBe('en');
  expect(spokenLangOf('ru')).toBe('ru');
  expect(spokenLangOf('ar')).toBe('he');
});

test('template names fall back to Hebrew and then to the id; languages are the ones with a text', () => {
  expect(templateName(T[0], 'ru')).toBe('Вода');
  expect(templateName(T[1], 'en')).toBe('רק עברית');
  expect(templateName({ id: 'x', kind: 'routine', name: {}, text: {} }, 'he')).toBe('x');
  expect(languagesOf(T[0])).toEqual(['he', 'en', 'ru']);
  expect(languagesOf(T[2])).toEqual(['he', 'en']);
  expect(routineTemplates(T).map((t) => t.id)).toEqual(['water', 'he_only']);
  expect(emergencyTemplates(T).map((t) => t.id)).toEqual(['evac']);
});

test('picking a template fills the selected languages it has and keeps what is typed in the others', () => {
  expect(applyTemplate({ ru: 'мой текст' }, T[1], ['he', 'ru'])).toEqual({ ru: 'мой текст', he: 'רק עברית כאן' });
  expect(applyTemplate({}, T[0], ['he', 'en'])).toEqual({ he: 'שלום', en: 'Hello' });
});

test('the parts to send are the selected languages in canonical order with a non-empty text', () => {
  expect(partsOf({ ru: ' Привет ', he: 'שלום', en: '   ' }, ['ru', 'he', 'en'])).toEqual([{ language: 'he', text: 'שלום' }, { language: 'ru', text: 'Привет' }]);
  expect(partsOf({ he: 'x'.repeat(201) }, ['he'])).toEqual([]);
});

test('send needs a room, a language and a text in every selected language', () => {
  expect(canSend(ALL_ROOMS, { he: 'שלום' }, ['he'])).toBe(true);
  expect(canSend('', { he: 'שלום' }, ['he'])).toBe(false);
  expect(canSend(ALL_ROOMS, { he: 'שלום' }, ['he', 'en'])).toBe(false);
  expect(canSend(ALL_ROOMS, { he: 'שלום' }, [])).toBe(false);
  expect(canSend(ALL_ROOMS, { he: 'x'.repeat(201) }, ['he'])).toBe(false);
});

test('toggling a language keeps the canonical order and never empties the selection', () => {
  expect(toggleLang(['he'], 'ru', true)).toEqual(['he', 'ru']);
  expect(toggleLang(['ru', 'he'], 'en', true)).toEqual(['he', 'en', 'ru']);
  expect(toggleLang(['he'], 'he', false)).toEqual(['he']);
  expect(toggleLang(['he', 'en'], 'he', false)).toEqual(['en']);
});

test('the templates editor: new ids are unique, edits are immutable, problems are named, the sent list is trimmed', () => {
  const b = blankTemplate(T);
  expect(b.id).toBe('template_4');
  expect(blankTemplate([{ ...b, id: 'template_4' }, ...T]).id).toBe('template_5');
  const edited = setField(T, 'water', 'text', 'en', 'Changed');
  expect(edited[0].text.en).toBe('Changed');
  expect(T[0].text.en).toBe('Hello');
  expect(setField(T, 'water', 'text', 'en', '')[0].text.en).toBeUndefined();
  expect(setKind(T, 'water', 'emergency')[0].kind).toBe('emergency');
  expect(removeTemplate(T, 'water').map((t) => t.id)).toEqual(['he_only', 'evac']);
  expect(templatesProblem(T)).toBe('');
  expect(templatesProblem([...T, { ...T[0] }])).toBe('id');
  expect(templatesProblem([{ ...T[0], id: 'Bad Id' }])).toBe('id');
  expect(templatesProblem([{ ...T[0], text: { en: 'no hebrew' } }])).toBe('he');
  expect(templatesProblem([{ ...T[0], text: { he: 'x'.repeat(201) } }])).toBe('length');
  expect(cleanTemplates([{ id: 'a', kind: 'routine', name: { he: ' א ', en: '  ' }, text: { he: ' ב ' } }])).toEqual([{ id: 'a', kind: 'routine', name: { he: 'א' }, text: { he: 'ב' } }]);
});

test('every string table has the same keys and no empty text; Hebrew, English, Russian and Arabic; the cloud warning is plain in all of them', () => {
  const langs: AnnounceUiLang[] = ['he', 'en', 'ru', 'ar'];
  const keys = Object.keys(ANNOUNCE_TABLES.he).sort();
  for (const l of langs) {
    expect(Object.keys(ANNOUNCE_TABLES[l]).sort()).toEqual(keys);
    for (const [k, v] of Object.entries(ANNOUNCE_TABLES[l])) {
      const strings = typeof v === 'string' ? [v] : Object.values(v as Record<string, string>);
      for (const s of strings) expect(s.trim(), `${l}.${k}`).not.toBe('');
    }
  }
  const warnings = new Set(langs.map((l) => ANNOUNCE_TABLES[l].cloudWarn));
  expect(warnings.size).toBe(4);
  expect(announceText('en').cloudWarn).toContain('leaves the building');
  expect(ANNOUNCE_DEV_MARKED).toEqual(['ar', 'ru']);
  expect(Object.keys(ANNOUNCE_TABLES.ru.src)).toEqual(Object.keys(ANNOUNCE_TABLES.he.src));
});

test('the announce tab is offered to holders of media.announce only', () => {
  expect(DEVICES_TABS.some((t) => t.id === 'announce' && t.href === ANNOUNCE_HREF)).toBe(true);
  expect(TAB_PERMISSIONS[ANNOUNCE_HREF]).toEqual(['media.announce']);
});
