/**
 * TTS-DEFAULT-ENGINE-2400: strings of the fixed announcement engine - the two rows of Settings › מתגי מסכי כניסה › תצוגת מסך התחנות and
 * the notes of the announcement dialogs. Hebrew (the product language) and English, switched by the document's `lang` like
 * i18n/wiskey-station-listen.ts. UI_COPY_RULES: no platform names, no internal codes, short words. `{x}` placeholders filled by `fill`.
 */
import { docLang, fill as coreFill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  setting: {
    engine: 'מנוע הקראה קבוע',
    engineText: 'נבחר מראש בכל הכרזה: בעמדה, ממגירת העמדה ולכמה עמדות יחד. אפשר לבחור מנוע אחר להכרזה אחת',
    systemDefault: 'ברירת המחדל של המערכת',
    systemDefaultNow: 'ברירת המחדל כעת: {name}',
    language: 'שפת ההקראה',
    languageText: 'מתוך השפות של המנוע שנבחר',
    languageAuto: 'אוטומטית (עברית כשיש)',
    loading: 'טוען את רשימת המנועים…',
    listUnavailable: 'רשימת המנועים אינה זמינה כרגע. הבחירה השמורה נשארת',
    noEngines: 'אין מנוע הקראה זמין כרגע',
    missing: 'המנוע הקבוע {engine} לא זמין כרגע',
    missingOption: '{engine} · לא זמין כרגע',
    missingLanguageOption: '{language} · לא נתמכת במנוע',
  },
  dialog: {
    missingEngine: 'המנוע הקבוע {engine} לא זמין כרגע. בחרו מנוע אחר להכרזה הזו',
    missingLanguage: 'השפה הקבועה {language} לא נתמכת במנוע הזה. נבחרה {auto}',
    pickEngine: 'בחרו מנוע…',
    fixedTag: 'קבוע',
    overridden: 'להכרזה הזו בלבד. ההגדרה הקבועה לא משתנה',
  },
};

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
type TtsDefaultText = Widen<typeof he>;

const en: TtsDefaultText = packTable<typeof import('./lang/en/i18n/tts-default').en>('en', 'i18n/tts-default', 'en');

export function ttt(): TtsDefaultText {
  return docLang(['en']) === 'en' ? en : he;
}

export function fill(template: string, values: Record<string, string | number>): string {
  return coreFill(template, values);
}

export const heTtsDefaultText: TtsDefaultText = he;
export const enTtsDefaultText: TtsDefaultText = en;

registerCatalogue('i18n/tts-default', { he, en });
