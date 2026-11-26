/**
 * WISKEY-INBOUND-CALLS-2382: strings of the incoming-call banner, the station's call log and the banner setting. Hebrew (the
 * product language) and English, switched by the document's `lang` like i18n/wiskey-station-media.ts. UI_COPY_RULES: an operator
 * screen never names the platform or a protocol and never shows an internal code; short words, no explanatory paragraphs.
 */
import { docLang, fill as coreFill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  banner: {
    region: 'שיחה נכנסת',
    ringing: 'שיחה נכנסת',
    inCall: 'בשיחה',
    from: 'מ{name}',
    answer: 'מענה',
    answering: 'עונה…',
    reject: 'דחייה',
    hangUp: 'סיום',
    door: 'פתיחת דלת',
    doorNamed: 'פתיחת {name}',
    doorAsk: 'לפתוח את {name}?',
    doorYes: 'פתיחה',
    doorNo: 'ביטול',
    doorSending: 'שולח…',
    doorSent: 'נשלחה פקודת פתיחה. זה אינו אישור שהדלת נפתחה.',
    doorFailed: 'הדלת לא נפתחה: {why}',
    doorUnknown: 'לא ידוע אם הפתיחה בוצעה · בדקו במקום לפני שליחה חוזרת',
    doorHeld: 'ממתין לבירור…',
    hide: 'הסתרה',
    station: 'לתחנה',
    more: 'עוד {n}',
    next: 'לשיחה הבאה',
    mute: 'השתקת צלצול',
    unmute: 'השמעת צלצול',
    quiet: 'שעות שקט · בלי צליל',
    soundBlocked: 'הצליל יופעל אחרי נגיעה במסך',
    noPicture: 'אין תמונה',
    offline: 'העמדה אינה מחוברת',
    pictureAlt: 'תמונה מהעמדה {name}',
    noTalk: 'אין דיבור מכאן: {why}. נפתחת התחנה.',
    talkReasonOff: 'דיבור כבוי בהגדרות',
    talkReasonUnsupported: 'דיבור זמין בלוח הקלאסי',
    talkReasonForbidden: 'אין הרשאה לדבר עם העמדה',
    talkReasonUnknown: 'דיבור אינו זמין כרגע',
    failed: 'הפקודה לא בוצעה: {why}',
    answeredElsewhere: 'נענתה במקום אחר',
    ended: 'השיחה הסתיימה',
    mic: { talking: 'מיקרופון פתוח', muted: 'מיקרופון מושתק', starting: 'פותח דיבור…', mute: 'השתקה', unmute: 'ביטול השתקה' },
  },
  log: {
    title: 'שיחות אחרונות',
    empty: 'אין שיחות ביומן',
    loading: 'טוען…',
    error: 'לא ניתן לטעון את יומן השיחות',
    retry: 'נסה שוב',
    more: 'עוד',
    answeredBy: 'נענתה ע״י {name}',
    answeredMe: 'נענתה על ידך',
    answeredElsewhere: 'נענתה במקום אחר',
    rejectedBy: 'נדחתה ע״י {name}',
    rejected: 'נדחתה',
    missed: 'לא נענתה',
    unknown: 'לא ידוע איך הסתיימה',
    ringing: 'מצלצלת עכשיו',
    inCall: 'בשיחה עכשיו',
    door: 'דלת נפתחה ע״י {name}',
    duration: '{t}',
  },
  setting: {
    title: 'שיחות נכנסות מעמדות',
    sub: 'חלון שיחה נכנסת בכל מסך',
    mode: 'מי מקבל את חלון השיחה',
    modeText: 'רק מי שמורשה לשיחות בעמדה',
    off: 'אף אחד (כבוי)',
    everyone: 'כל המורשים לשיחות',
    roles: 'תפקידים נבחרים',
    rolesLabel: 'תפקידים',
    stationsLabel: 'עמדות',
    stationsAll: 'כל העמדות',
    stationsNone: 'אין עמדות זמינות כרגע',
    sound: 'צלצול',
    soundText: 'בשעות השקט – בלי צליל, לפי הגדרות ההתראות',
    save: 'שמירה',
    saved: 'נשמר',
    loading: 'טוען…',
    error: 'לא ניתן לטעון את ההגדרה',
    retry: 'נסה שוב',
    readOnly: 'רק מנהל מערכת יכול לשנות',
    needRole: 'יש לבחור לפחות תפקיד אחד',
  },
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type IncomingCallText = Widen<typeof he>;

const en: IncomingCallText = packTable<typeof import('./lang/en/i18n/incoming-calls').en>('en', 'i18n/incoming-calls', 'en');

export function ict(): IncomingCallText {
  return docLang(['en']) === 'en' ? en : he;
}

export const heIncomingCallText: IncomingCallText = he;
export const enIncomingCallText: IncomingCallText = en;

export function fill(template: string, vars: Record<string, string | number> = {}): string {
  return coreFill(template, vars);
}

registerCatalogue('i18n/incoming-calls', { he, en });
