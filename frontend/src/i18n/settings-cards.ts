/**
 * SETTINGS-INTERCOM-CARDS-2401: strings of the Settings tab "מתגי מסכי כניסה" laid out as collapsible cards (owner 04.11, round 19 Q6 = a)
 * or as two tabs (b) - the card titles, the one-line summaries of the current values and the layout row. Hebrew (the product language) and
 * English, switched by the document's `lang` like i18n/tts-default.ts. UI_COPY_RULES: short plain words, no internal codes.
 * `{x}` placeholders filled by `fill`.
 */
import { docLang, fill as coreFill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  layout: {
    label: 'סידור הלשונית',
    text: 'כרטיס אחד פתוח בכל פעם, לצד הכותרות או מתחת לכותרת · שתי לשוניות: התצוגה לחוד, ההכרזות והקול לחוד · רשימה אחת: הכול ברצף',
    cards: 'כרטיסים: כותרות בצד',
    accordion: 'כרטיסים: נפתחים במקום',
    defaultMark: '(ברירת מחדל)',
    tabs: 'שתי לשוניות',
    list: 'רשימה אחת',
  },
  voiceTab: 'הכרזות וקול',
  voiceTabSub: 'הכרזות לעמדות, מנוע ההקראה ושיחות נכנסות',
  announceSub: 'יעדי ההכרזה, מנוע ההקראה הקבוע והמשפטים המוכנים. כל שינוי נשמר עם כפתור השמירה של הכרטיס הזה.',
  cardsLabel: 'חלקי הלשונית',
  title: {
    screens: 'מתגי מסכי כניסה',
    area: 'אזור WisKey והטמעה',
    display: 'תצוגת מסך התחנות',
    announce: 'הכרזות',
    calls: 'שיחות נכנסות מעמדות',
    parity: 'השוואה למסכי האינטרקום',
    checklist: 'בדיקה ידנית צד לצד',
    pairing: 'חיבור Arx ל-WisKey',
    diagnostics: 'WisKey רואה את Arx כ־',
    validation: 'בדיקת קבלה לעמדות',
  },
  sum: {
    loading: 'טוען…',
    failed: 'לא נטען',
    allWiskey: 'כל המסכים: WisKey מוטמע',
    allArx: 'כל המסכים: Arx',
    someArx: 'Arx: {list} · השאר WisKey מוטמע',
    areaShown: 'האזור מוצג',
    areaHidden: 'האזור מוסתר לכולם',
    phoneOn: 'הטמעה בטלפון: מופעלת',
    phoneOff: 'הטמעה בטלפון: כבויה',
    hint: 'רמז שיחה: {v}',
    talk: 'דיבור: {v}',
    talkShown: 'מוצג',
    media: 'וידאו: {v}',
    engineDefault: 'מנוע: ברירת המחדל',
    engine: 'מנוע: {v}',
    phrasesBuiltIn: 'משפטים מובנים',
    phrases: '{n} משפטים',
    callsOff: 'כבוי',
    callsEveryone: 'לכל מי שרשאי לענות',
    callsRoles: 'לתפקידים נבחרים ({n})',
    callsStationsAll: 'כל העמדות',
    callsStations: '{n} עמדות',
    callsRing: 'עם צלצול',
    callsQuiet: 'בלי צלצול',
    parityIdle: 'עוד לא הורצה',
    parityBusy: 'בודק…',
    parityFailed: 'הבדיקה נכשלה',
    checklist: '{done} מתוך {all} נבדקו',
    pairingTalkReady: 'דיבור מוכן',
    pairingTalkNot: 'דיבור לא מוכן',
    diagIdle: 'עדיין לא נבדק',
    diagFailed: 'הבדיקה נכשלה',
    diag: 'זהות השירות: {service} · ערוץ הרקע: {background}',
    validation: 'לכל עמדה, רצה רק בלחיצה',
    unsaved: 'יש שינויים שלא נשמרו',
  },
};

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type SettingsCardsText = Widen<typeof he>;

const en: SettingsCardsText = packTable<typeof import('./lang/en/i18n/settings-cards').en>('en', 'i18n/settings-cards', 'en');

export function sct(): SettingsCardsText {
  return docLang(['en']) === 'en' ? en : he;
}

export function fill(template: string, values: Record<string, string | number>): string {
  return coreFill(template, values);
}

export const heSettingsCardsText: SettingsCardsText = he;
export const enSettingsCardsText: SettingsCardsText = en;

registerCatalogue('i18n/settings-cards', { he, en });
