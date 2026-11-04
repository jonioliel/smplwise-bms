/**
 * SETTINGS-INTERCOM-CARDS-2401: strings of the Settings tab "מתגי מסכי כניסה" laid out as collapsible cards (owner 04.11, round 19 Q6 = a)
 * or as two tabs (b) - the card titles, the one-line summaries of the current values and the layout row. Hebrew (the product language) and
 * English, switched by the document's `lang` like i18n/tts-default.ts. UI_COPY_RULES: short plain words, no internal codes.
 * `{x}` placeholders filled by `fill`.
 */
const he = {
  layout: {
    label: 'סידור הלשונית',
    text: 'כרטיסים: כרטיס אחד פתוח בכל פעם והלשונית נכנסת במסך · שתי לשוניות: התצוגה לחוד, ההכרזות והקול לחוד · רשימה אחת: הכול ברצף',
    cards: 'כרטיסים מתקפלים',
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

const en: SettingsCardsText = {
  layout: {
    label: 'Layout of this tab',
    text: 'Cards: one card open at a time and the tab fits the screen · Two tabs: the display apart from the announcements and voice · One list: everything in a row',
    cards: 'Collapsible cards',
    tabs: 'Two tabs',
    list: 'One list',
  },
  voiceTab: 'Announcements and voice',
  voiceTabSub: 'Announcements to stations, the announcement engine and incoming calls',
  announceSub: "The announcement targets, the fixed engine and the quick phrases. Every change is saved with this card's save button.",
  cardsLabel: 'Parts of this tab',
  title: {
    screens: 'Entrance screen switches',
    area: 'WisKey area and embedding',
    display: 'Stations screen display',
    announce: 'Announcements',
    calls: 'Incoming calls from stations',
    parity: 'Comparison with the intercom screens',
    checklist: 'Side-by-side checklist',
    pairing: 'Arx and WisKey pairing',
    diagnostics: 'WisKey sees Arx as',
    validation: 'Station acceptance check',
  },
  sum: {
    loading: 'Loading…',
    failed: 'Not loaded',
    allWiskey: 'All screens: WisKey embedded',
    allArx: 'All screens: Arx',
    someArx: 'Arx: {list} · the rest WisKey embedded',
    areaShown: 'The area is shown',
    areaHidden: 'The area is hidden for everyone',
    phoneOn: 'Phone embedding: on',
    phoneOff: 'Phone embedding: off',
    hint: 'Call hint: {v}',
    talk: 'Talk: {v}',
    talkShown: 'Shown',
    media: 'Video: {v}',
    engineDefault: 'Engine: the system default',
    engine: 'Engine: {v}',
    phrasesBuiltIn: 'Built-in phrases',
    phrases: '{n} phrases',
    callsOff: 'Off',
    callsEveryone: 'Everyone who may answer',
    callsRoles: 'Chosen roles ({n})',
    callsStationsAll: 'All stations',
    callsStations: '{n} stations',
    callsRing: 'Rings',
    callsQuiet: 'Silent',
    parityIdle: 'Not run yet',
    parityBusy: 'Checking…',
    parityFailed: 'The check failed',
    checklist: '{done} of {all} checked',
    pairingTalkReady: 'Talk ready',
    pairingTalkNot: 'Talk not ready',
    diagIdle: 'Not checked yet',
    diagFailed: 'The check failed',
    diag: 'Service identity: {service} · Background channel: {background}',
    validation: 'Per station, runs only when asked',
    unsaved: 'Unsaved changes',
  },
};

export function sct(): SettingsCardsText {
  return (globalThis.document?.documentElement.lang || '').toLowerCase().startsWith('en') ? en : he;
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

export const heSettingsCardsText: SettingsCardsText = he;
export const enSettingsCardsText: SettingsCardsText = en;
