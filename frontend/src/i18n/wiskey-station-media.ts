/**
 * Strings of a station's live video and two-way talk in the stations screen's drawer (CR-036 slice S18), Hebrew (the product
 * language) and English, switched by the document's `lang` like i18n/wiskey-stations.ts. UI_COPY_RULES: an operator screen never
 * names the platform or a protocol and never shows an internal code; short words, no explanatory paragraphs. Owner exception 04.11
 * (Q21 "b"): the drawer's "no talk" reasons that describe WisKey itself name it (`dial.reasons` pairing / not_listed /
 * capabilities_unread / wiskey_unavailable); the Settings row (`source`) named it already.
 */
import { docLang, fill as coreFill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  live: {
    label: 'שידור חי',
    quality: 'איכות',
    sub: 'רגילה',
    main: 'גבוהה',
    poster: 'תמונה אחרונה',
    // VIDEO-TRANSPORT-2400: the viewer's video setting allows nothing this station offers (never another transport instead)
    blocked: 'העמדה אינה משדרת בהגדרת הווידאו שלך',
    blockedHint: 'לשינוי: החשבון שלי ‹ וידאו',
  },
  talk: {
    label: 'דיבור',
    start: 'פתח דיבור',
    starting: 'פותח דיבור…',
    muted: 'מיקרופון מושתק',
    talking: 'מיקרופון פתוח',
    mute: 'השתק',
    unmute: 'בטל השתקה',
    headset: 'מומלץ להשתמש באוזניות',
    end: 'סיום דיבור',
    left: 'נותרו {t}',
    openDrawer: 'דיבור',
    busy: 'העמדה בדיבור עם מפעיל אחר',
    ended: 'הדיבור הסתיים',
    problems: {
      insecure: 'מיקרופון זמין רק בחיבור מאובטח',
      denied: 'המיקרופון חסום בדפדפן',
      no_mic: 'לא נמצא מיקרופון',
      mic_busy: 'המיקרופון תפוס',
      busy: 'העמדה בדיבור עם מפעיל אחר',
      user_busy: 'פתוח אצלך דיבור עם עמדה אחרת',
      forbidden: 'אין הרשאה לדבר עם העמדה',
      unsupported: 'דיבור זמין בלוח הקלאסי',
      off: 'דיבור כבוי',
      offline: 'העמדה אינה מחוברת',
      unavailable: 'דיבור אינו זמין כרגע',
      expired: 'זמן הדיבור הסתיים',
      upstream: 'ערוץ הדיבור נסגר',
      network: 'החיבור נותק',
      access_lost: 'ההרשאה לדיבור הוסרה',
      failed: 'לא ניתן לפתוח דיבור',
    },
  },
  // WISKEY-TALK-DIAL-2382: "dial the station" in the drawer's call section - Arx's own talk session, its in-call state, and why not
  dial: {
    dial: 'חיוג לעמדה',
    talk: 'דיבור עם העמדה',
    inCall: 'בשיחה',
    hangUp: 'ניתוק',
    classic: 'בלוח הקלאסי',
    // Owner 04.11 (Q21 "b"): an exception to "no platform name on an operator screen", for these "no talk" reasons only - the four that
    // describe WisKey itself (its signed pairing, the talk commands it publishes, its signed capabilities read, its reachability) name it.
    reasons: {
      off: 'דיבור מהמסך כבוי בהגדרות (וידאו בלבד)',
      provider_local: 'המקור המקומי מציג וידאו בלבד, בלי דיבור',
      pairing: 'חסר צימוד חתום ל-WisKey, ולכן אין דיבור מהמסך',
      not_listed: 'WisKey לא מפרסם פקודות דיבור ל-Arx',
      capabilities_unread: 'לא ניתן היה לבדוק מול WisKey אם דיבור זמין; מוצג וידאו בלבד',
      unsupported: 'העמדה הזו לא מציעה דיבור',
      wiskey_unavailable: 'WisKey לא זמין כרגע; מוצג וידאו מהמקור המקומי',
      forbidden: 'אין הרשאה לדבר עם העמדה',
      unavailable: 'דיבור אינו זמין כרגע',
    },
  },
  // WISKEY-TALK-DIAL-2382: Settings › מתגי מסכי כניסה › תצוגת מסך התחנות - the media source and what WisKey mode still needs
  source: {
    label: 'מקור הווידאו והדיבור',
    local: 'Arx (וידאו בלבד)',
    auto: 'WisKey (וידאו ודיבור)',
    checking: 'בודק מה נדרש למצב WisKey…',
    failed: 'לא ניתן לבדוק כרגע מה נדרש למצב WisKey',
    ok: 'WisKey מוכן: וידאו ודיבור מתוך המסך',
    okLocal: 'WisKey מוכן. בחירה ב-WisKey תאפשר גם דיבור מתוך המסך',
    missing: 'חסר למצב WisKey: {list}',
    fallback: 'עד אז מוצג וידאו מ-Arx בלבד',
    videoOnly: 'עד אז WisKey מציג וידאו בלבד',
    codes: {
      wiskey_unreachable: 'WisKey לא זמין כרגע',
      api_incompatible: 'גרסת WisKey אינה תואמת לגרסה הזו',
      video_not_listed: 'WisKey לא מפרסם פקודות וידאו ל-Arx',
      talk_not_listed: 'WisKey לא מפרסם פקודות דיבור ל-Arx',
      capabilities_unread: 'בדיקת היכולות החתומה מול WisKey נכשלה ({kind})',
      pairing_missing: 'אין צימוד חתום ל-WisKey',
      pairing_key_rotated: 'מפתח הצימוד הוחלף ו-WisKey עוד לא מקבל אותו',
    },
    // WISKEY-TALK-CAPS-2382: why the signed capabilities read failed (services/wiskey_media_caps.py reason_kind)
    capsKinds: {
      unreachable: 'WisKey לא ענה',
      refused: 'WisKey דחה את החיבור החתום',
      clock: 'השעונים של Arx ושל WisKey אינם מתואמים',
      incompatible: 'התשובה של WisKey אינה בפורמט שהגרסה הזו קוראת',
      failed: 'סיבה לא ידועה',
    },
  },
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
type StationMediaText = Widen<typeof he>;

const en: StationMediaText = packTable<typeof import('./lang/en/i18n/wiskey-station-media').en>('en', 'i18n/wiskey-station-media', 'en');

export function smt(): StationMediaText {
  return docLang(['en']) === 'en' ? en : he;
}

export const heStationMediaText: StationMediaText = he;
export const enStationMediaText: StationMediaText = en;

export function fill(template: string, vars: Record<string, string | number> = {}): string {
  return coreFill(template, vars);
}

/** m:ss for the countdown (always LTR digits). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

registerCatalogue('i18n/wiskey-station-media', { he, en });
