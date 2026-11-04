/**
 * TTS-DEFAULT-ENGINE-2400: strings of the fixed announcement engine - the two rows of Settings › מתגי מסכי כניסה › תצוגת מסך התחנות and
 * the notes of the announcement dialogs. Hebrew (the product language) and English, switched by the document's `lang` like
 * i18n/wiskey-station-listen.ts. UI_COPY_RULES: no platform names, no internal codes, short words. `{x}` placeholders filled by `fill`.
 */
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
export type TtsDefaultText = Widen<typeof he>;

const en: TtsDefaultText = {
  setting: {
    engine: 'Fixed announcement engine',
    engineText: 'Preselected in every announcement: at a station, from the station drawer and to several stations. Another engine can be picked for one announcement',
    systemDefault: 'System default',
    systemDefaultNow: 'The system default now: {name}',
    language: 'Announcement language',
    languageText: 'From the languages of the chosen engine',
    languageAuto: 'Automatic (Hebrew when available)',
    loading: 'Loading the engine list…',
    listUnavailable: 'The engine list is not available right now. The saved choice stays',
    noEngines: 'No announcement engine is available right now',
    missing: 'The fixed engine {engine} is not available right now',
    missingOption: '{engine} · not available right now',
    missingLanguageOption: '{language} · not supported by the engine',
  },
  dialog: {
    missingEngine: 'The fixed engine {engine} is not available right now. Pick another engine for this announcement',
    missingLanguage: 'The fixed language {language} is not supported by this engine. {auto} was chosen',
    pickEngine: 'Pick an engine…',
    fixedTag: 'fixed',
    overridden: 'For this announcement only. The fixed setting does not change',
  },
};

export function ttt(): TtsDefaultText {
  return (globalThis.document?.documentElement.lang || '').toLowerCase().startsWith('en') ? en : he;
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

export const heTtsDefaultText: TtsDefaultText = he;
export const enTtsDefaultText: TtsDefaultText = en;
