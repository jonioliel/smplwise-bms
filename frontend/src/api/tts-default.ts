/**
 * TTS-DEFAULT-ENGINE-2400 (owner 04.11, answer 1א): the installation's fixed announcement engine and language - ONE product setting
 * (`access.tts_engine`, `access.tts_language`, routers/settings.py; Settings › מתגי מסכי כניסה › תצוגת מסך התחנות, `system.configure`,
 * audited), applied as the preselection of EVERY announcement path: the intercom overview's "הכרזה בעמדה" (screens/wiskey-overview.ts),
 * the station drawer's "הכרזה" and the multi-station composer (components/wk-announce-dialog.ts). Each send may still pick another engine
 * or language for that one announcement; that never changes the setting.
 *
 * "" in either key = the behaviour before the setting: WisKey's reported default engine (`tts.async_default_engine`, chosen by the
 * platform itself) and the automatic language (Hebrew when the engine has it, else the engine's default). WisKey's `tts/start` takes
 * an engine, a language and the text only (audio_tts.py `allowed` keys) - there is no voice to fix, so none is offered.
 *
 * The one rule: a fixed engine that is not in WisKey's current list is NEVER silently replaced by another engine. `resolveTtsPick`
 * then selects nothing and names the missing engine, so the dialog says so plainly and the user picks another engine for that send.
 * Pure functions (no DOM): the unit spec runs them in node.
 */
import type { IntercomTtsEngine, IntercomTtsEngines } from './intercom';

export const TTS_ENGINE_KEY = 'access.tts_engine';
export const TTS_LANGUAGE_KEY = 'access.tts_language';
/** WisKey's own bounds for `tts/start` (engine 1..128, language <= 64), mirrored by the server's validation. */
export const TTS_ENGINE_MAX = 128;
export const TTS_LANGUAGE_MAX = 64;
const ENGINE_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const LANGUAGE_RE = /^[A-Za-z]{1,8}([_-][A-Za-z0-9]{1,8}){0,6}$/;

/** The fixed choice: '' = the system default engine / the automatic language. */
export interface TtsFixed {
  engine: string;
  language: string;
}

export const TTS_FIXED_NONE: TtsFixed = { engine: '', language: '' };

export const validTtsEngine = (v: string): boolean => v === '' || (v.length <= TTS_ENGINE_MAX && ENGINE_RE.test(v));
export const validTtsLanguage = (v: string): boolean => v === '' || (v.length <= TTS_LANGUAGE_MAX && LANGUAGE_RE.test(v));

/** The setting as the server stores it; a value the server would refuse reads as the default (never sent to WisKey). */
export function parseTtsFixed(settings: Record<string, unknown> | null | undefined): TtsFixed {
  const get = (k: string): string => (typeof settings?.[k] === 'string' ? (settings[k] as string) : '');
  const engine = get(TTS_ENGINE_KEY);
  const language = get(TTS_LANGUAGE_KEY);
  return { engine: validTtsEngine(engine) ? engine : '', language: validTtsLanguage(language) ? language : '' };
}

/** WisKey's own choice of language (tts-controls.ts): Hebrew when the engine has it, else its default, else its first. */
export function autoLanguage(engine: IntercomTtsEngine | undefined): string {
  const langs = engine?.supported_languages ?? [];
  return langs.includes('he') ? 'he' : langs.includes('iw') ? 'iw' : (engine?.default_language ?? langs[0] ?? '');
}

/** The engine "ברירת המחדל של המערכת" means today: WisKey's reported default when it is listed, else the first listed engine (the
 * behaviour before this setting); '' when WisKey lists none. */
export function systemDefaultEngine(list: IntercomTtsEngines | null | undefined): string {
  const engines = list?.engines ?? [];
  return list?.default && engines.some((e) => e.engine_id === list.default) ? list.default : (engines[0]?.engine_id ?? '');
}

/** The language for `engineId`: the fixed language when that engine supports it (or lists no languages at all), else automatic. */
export function languageFor(list: IntercomTtsEngines | null | undefined, engineId: string, fixed: TtsFixed): string {
  const engine = list?.engines.find((e) => e.engine_id === engineId);
  if (!engine) return '';
  const langs = engine.supported_languages ?? [];
  if (fixed.language && (langs.length === 0 || langs.includes(fixed.language))) return fixed.language;
  return autoLanguage(engine);
}

export interface TtsPick {
  /** The preselected engine; '' when the fixed engine is not available (the user must pick one for this send). */
  engine: string;
  language: string;
  /** The fixed engine id WisKey does not list right now (shown by name-less id: WisKey no longer gives its name), else null. */
  missingEngine: string | null;
  /** The fixed language the selected engine does not support (the automatic language is selected instead, and the dialog says so). */
  missingLanguage: string | null;
}

/** The preselection of an announcement dialog from WisKey's engine list and the installation's fixed choice. */
export function resolveTtsPick(list: IntercomTtsEngines | null | undefined, fixed: TtsFixed): TtsPick {
  const engines = list?.engines ?? [];
  if (fixed.engine && !engines.some((e) => e.engine_id === fixed.engine)) {
    return { engine: '', language: '', missingEngine: fixed.engine, missingLanguage: null };
  }
  const engine = fixed.engine || systemDefaultEngine(list);
  const language = languageFor(list, engine, fixed);
  const missingLanguage = engine && fixed.language && language !== fixed.language ? fixed.language : null;
  return { engine, language, missingEngine: null, missingLanguage };
}

const LANGUAGE_NAMES: Record<string, string> = { he: 'עברית', iw: 'עברית', en: 'English', ar: 'العربية', ru: 'Русский', fr: 'Français', es: 'Español', de: 'Deutsch' };

/** A language code in words where it is a common one ("he" -> "עברית"), else the code itself in capitals. */
export const languageName = (code: string): string => LANGUAGE_NAMES[code.toLowerCase().split(/[-_]/)[0]] ?? code.toUpperCase();
