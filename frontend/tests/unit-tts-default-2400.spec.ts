import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IntercomTtsEngines } from '../src/api/intercom';
import {
  TTS_ENGINE_KEY,
  TTS_FIXED_NONE,
  TTS_LANGUAGE_KEY,
  autoLanguage,
  languageFor,
  languageName,
  parseTtsFixed,
  resolveTtsPick,
  systemDefaultEngine,
  validTtsEngine,
  validTtsLanguage,
} from '../src/api/tts-default';
import { announceToStations } from '../src/api/access-stations';
import { enTtsDefaultText, fill, heTtsDefaultText } from '../src/i18n/tts-default';

// TTS-DEFAULT-ENGINE-2400 (owner 04.11, answer 1א): the fixed announcement engine - the preselection every announcement dialog takes from
// the setting, the "not available" rule (never a silent fallback to another engine), the per-send override, the validation that mirrors the
// server's, and the wiring of every announcement path. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tts-default-2400.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

// WisKey's tts/engines reply shape (audio_tts.py available_engines): the default first, then by name
const LIST: IntercomTtsEngines = {
  default: 'tts.piper',
  engines: [
    { engine_id: 'tts.piper', name: 'Piper', supported_languages: ['en', 'he'], default_language: 'he' },
    { engine_id: 'tts.google_translate_en_com', name: 'Google Translate', supported_languages: ['en', 'iw'], default_language: 'en' },
    { engine_id: 'tts.cloud_fr', name: 'Cloud FR', supported_languages: ['fr', 'de'], default_language: 'fr' },
    { engine_id: 'tts.bare', name: 'Bare', supported_languages: [], default_language: null },
  ],
};

test.describe('the setting', () => {
  test('reads "" as the system default / automatic, and a value the server would refuse as the default', () => {
    expect(parseTtsFixed(null)).toEqual(TTS_FIXED_NONE);
    expect(parseTtsFixed({})).toEqual({ engine: '', language: '' });
    expect(parseTtsFixed({ [TTS_ENGINE_KEY]: 'tts.piper', [TTS_LANGUAGE_KEY]: 'he' })).toEqual({ engine: 'tts.piper', language: 'he' });
    expect(parseTtsFixed({ [TTS_ENGINE_KEY]: 'tts piper', [TTS_LANGUAGE_KEY]: 'he ' })).toEqual({ engine: '', language: '' });
    expect(parseTtsFixed({ [TTS_ENGINE_KEY]: 7, [TTS_LANGUAGE_KEY]: null })).toEqual({ engine: '', language: '' });
  });

  test('the validation is the server\'s (routers/settings.py TTS_ENGINE_PATTERN / TTS_LANGUAGE_PATTERN)', () => {
    for (const ok of ['', 'tts.piper', 'google_translate', 'tts.google_translate_en_com', 'e'.repeat(128)]) expect(validTtsEngine(ok), ok).toBe(true);
    for (const bad of [' tts.piper', 'tts piper', 'tts.piper\n', '<b>x</b>', 'x'.repeat(129), '-tts', 'tts.piper;rm', 'טטס']) expect(validTtsEngine(bad), bad).toBe(false);
    for (const ok of ['', 'he', 'en-US', 'zh_Hans', 'x'.repeat(8)]) expect(validTtsLanguage(ok), ok).toBe(true);
    for (const bad of ['he ', '1he', 'en--US', 'x'.repeat(65), 'he\n', 'e n', 'he;']) expect(validTtsLanguage(bad), bad).toBe(false);
    const py = fs.readFileSync(path.join(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'routers', 'settings.py'), 'utf8');
    expect(py).toContain('TTS_ENGINE_PATTERN = r"^$|^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"');
    expect(py).toContain('TTS_LANGUAGE_PATTERN = r"^$|^[A-Za-z]{1,8}([_-][A-Za-z0-9]{1,8}){0,6}$"');
    expect(read('api/tts-default.ts')).toContain('/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/');
    expect(read('api/tts-default.ts')).toContain('/^[A-Za-z]{1,8}([_-][A-Za-z0-9]{1,8}){0,6}$/');
  });
});

test.describe('the preselection', () => {
  test('no fixed engine = the behaviour before the setting: WisKey\'s default, Hebrew when the engine has it', () => {
    expect(resolveTtsPick(LIST, TTS_FIXED_NONE)).toEqual({ engine: 'tts.piper', language: 'he', missingEngine: null, missingLanguage: null });
    expect(systemDefaultEngine({ default: 'tts.gone', engines: LIST.engines })).toBe('tts.piper');
    expect(systemDefaultEngine({ default: null, engines: [] })).toBe('');
    expect(autoLanguage(LIST.engines[1])).toBe('iw');
    expect(autoLanguage(LIST.engines[2])).toBe('fr');
    expect(autoLanguage(LIST.engines[3])).toBe('');
  });

  test('a fixed engine and language are preselected', () => {
    expect(resolveTtsPick(LIST, { engine: 'tts.google_translate_en_com', language: 'en' })).toEqual({ engine: 'tts.google_translate_en_com', language: 'en', missingEngine: null, missingLanguage: null });
    expect(resolveTtsPick(LIST, { engine: 'tts.cloud_fr', language: '' }).language).toBe('fr');
    expect(resolveTtsPick(LIST, { engine: '', language: 'en' })).toEqual({ engine: 'tts.piper', language: 'en', missingEngine: null, missingLanguage: null });
  });

  test('a fixed engine WisKey does not list right now selects NOTHING and is named - never another engine', () => {
    const pick = resolveTtsPick(LIST, { engine: 'tts.gone', language: 'he' });
    expect(pick).toEqual({ engine: '', language: '', missingEngine: 'tts.gone', missingLanguage: null });
    expect(resolveTtsPick({ default: null, engines: [] }, { engine: 'tts.piper', language: '' }).missingEngine).toBe('tts.piper');
    expect(resolveTtsPick(null, { engine: 'tts.piper', language: '' }).engine).toBe('');
  });

  test('a fixed language the engine does not support: the automatic one, and it is said', () => {
    expect(resolveTtsPick(LIST, { engine: 'tts.cloud_fr', language: 'he' })).toEqual({ engine: 'tts.cloud_fr', language: 'fr', missingEngine: null, missingLanguage: 'he' });
    // an engine that lists no languages takes the fixed one as it is (nothing to check it against)
    expect(resolveTtsPick(LIST, { engine: 'tts.bare', language: 'he' })).toEqual({ engine: 'tts.bare', language: 'he', missingEngine: null, missingLanguage: null });
  });

  test('a per-send pick keeps the fixed language where the engine supports it, else the automatic one', () => {
    const fixed = { engine: 'tts.piper', language: 'en' };
    expect(languageFor(LIST, 'tts.google_translate_en_com', fixed)).toBe('en');
    expect(languageFor(LIST, 'tts.cloud_fr', fixed)).toBe('fr');
    expect(languageFor(LIST, 'tts.piper', TTS_FIXED_NONE)).toBe('he');
    expect(languageFor(LIST, 'tts.unknown', fixed)).toBe('');
    expect(fixed).toEqual({ engine: 'tts.piper', language: 'en' }); // the setting itself is never touched by a pick
  });

  test('the multi-station send carries exactly the engine and language it was given', async () => {
    const seen: Array<{ id: string; engine_id: string; language: string | null }> = [];
    const speak = (async (id: string, body: { engine_id: string; language: string | null; message: string }) => {
      seen.push({ id, engine_id: body.engine_id, language: body.language });
      return { tts: null } as never;
    }) as never;
    await announceToStations({ stationIds: ['a', 'b'], engine_id: 'tts.cloud_fr', language: 'fr', message: 'x' }, speak);
    expect(seen).toEqual([{ id: 'a', engine_id: 'tts.cloud_fr', language: 'fr' }, { id: 'b', engine_id: 'tts.cloud_fr', language: 'fr' }]);
  });

  test('language names', () => {
    expect(languageName('he')).toBe('עברית');
    expect(languageName('iw')).toBe('עברית');
    expect(languageName('en-US')).toBe('English');
    expect(languageName('zh_Hans')).toBe('ZH_HANS');
  });
});

test.describe('every announcement path', () => {
  const PATHS = ['screens/wiskey-overview.ts', 'components/wk-announce-dialog.ts'];

  test('the overview dialog and the drawer / multi-station composer preselect through resolveTtsPick, never WisKey\'s default directly', () => {
    for (const rel of PATHS) {
      const src = read(rel);
      expect(src, rel).toContain('resolveTtsPick(');
      expect(src, rel).toContain('parseTtsFixed(');
      expect(src, rel).toContain('missingEngine');
      expect(src, rel).not.toMatch(/tts\.default\s*&&/); // the old inline "WisKey's default else the first engine"
      expect(src, rel).not.toMatch(/langs\.includes\('he'\)/); // the old inline language choice
    }
    // the station drawer's "הכרזה" and the multi-station announcement are the same composer
    expect(read('screens/wiskey-stations.ts')).toContain('<wk-announce-dialog');
    expect(read('screens/wiskey-stations-views.ts')).toContain('v.announce(s.id)');
  });

  test('the settings card offers the two keys, the system default first, and names a missing engine', () => {
    const src = read('screens/system-access-display.ts');
    expect(src).toContain('TTS_ENGINE_KEY');
    expect(src).toContain('TTS_LANGUAGE_KEY');
    expect(src).toContain("['', t.systemDefault]");
    expect(src).toContain('data-tts-fixed-default-now');
    expect(src).toContain('data-tts-fixed-missing');
    expect(src).not.toMatch(/voice/i); // WisKey's tts/start has no voice: none is invented
  });
});

test.describe('words', () => {
  const keys = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [p + k] : keys(v as object, `${p}${k}.`)));
  const strings = (o: object): string[] => Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : strings(v as object)));

  test('Hebrew and English have the same keys and the same placeholders', () => {
    expect(keys(enTtsDefaultText)).toEqual(keys(heTtsDefaultText));
    const he = strings(heTtsDefaultText);
    const en = strings(enTtsDefaultText);
    he.forEach((s, i) => expect((en[i].match(/\{\w+\}/g) ?? []).sort(), `${s} / ${en[i]}`).toEqual((s.match(/\{\w+\}/g) ?? []).sort()));
  });

  test('the not-available sentence is the owner\'s wording, and no platform name or internal code is shown', () => {
    expect(fill(heTtsDefaultText.setting.missing, { engine: 'tts.gone' })).toBe('המנוע הקבוע tts.gone לא זמין כרגע');
    expect(heTtsDefaultText.setting.systemDefault).toBe('ברירת המחדל של המערכת');
    expect(heTtsDefaultText.setting.engine).toBe('מנוע הקראה קבוע');
    for (const s of [...strings(heTtsDefaultText), ...strings(enTtsDefaultText)]) {
      expect(s).not.toMatch(/Home Assistant|\bHA\b|WisKey|TTS|access\.tts|engine_id/);
    }
  });
});
