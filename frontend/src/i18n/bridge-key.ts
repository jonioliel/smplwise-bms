/**
 * CR-WISKEY-HMAC-ROTATION-295: the words of the "Bridge key" card (Settings › Connections). Hebrew first; English, Arabic and
 * Russian follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL
 * translation and need a native review (dev-marked). Short texts only; no home-system branding.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  title: 'מפתח הגשר',
  stateOff: 'כבוי',
  stateReady: 'מוכן',
  stateRotating: 'בהחלפה',
  stateAttention: 'דורש טיפול',
  keyId: 'מזהה מפתח',
  generation: 'דור',
  since: 'פעיל מאז',
  lastRotation: 'החלפה אחרונה',
  none: 'אין',
  switchLabel: 'החלפת מפתח',
  reminder: 'תזכורת להחלפה',
  reminderOff: 'ללא',
  reminderDays: 'כל {n} ימים',
  reminderDue: 'הגיע זמן להחליף מפתח',
  rotate: 'החלפת מפתח',
  hardCut: 'החלפה מיידית',
  resume: 'השלמת החלפה',
  confirmRotate: 'להחליף את מפתח הגשר? שני המפתחות יפעלו יחד עד 3 דקות.',
  confirmHardCut: 'להחליף מיד? המפתח הישן יפסיק לפעול מיד.',
  confirm: 'אישור',
  cancel: 'ביטול',
  retireAt: 'המפתח הישן יבוטל ב־{t}',
  saved: 'נשמר',
  modeRoutine: 'רגילה',
  modeHardCut: 'מיידית',
  // rotation states
  st_prepared: 'מכין',
  st_publishing: 'שולח לגשר',
  st_published: 'הגשר קיבל',
  st_confirmed: 'אומת בגשר',
  st_switching: 'מחליף',
  st_switched: 'הוחלף',
  st_retiring: 'מבטל את הישן',
  st_retired: 'המפתח הישן בוטל',
  st_verified: 'הושלם',
  st_verify_failed: 'האימות נכשל',
  st_rolled_back: 'בוטל, חזרה למפתח הקודם',
  st_needs_repair: 'נדרש זיווג מחדש',
  // why the buttons are disabled
  bl_rotation_off: 'ההחלפה כבויה',
  bl_rotation_not_permitted: 'דורש אישור הפעלה מבעל המערכת',
  bl_peer_unavailable: 'הגשר טרם עודכן',
  bl_wiskey_present: 'חסום כל עוד WisKey מותקן (WisKey מאמת רק את קוד הצימוד המקורי)',
  bl_rotation_in_progress: 'החלפה מתבצעת',
  bl_repair_required: 'יש להשלים החלפה קודמת',
  bl_key_unreadable: 'המפתח אינו קריא במכונה זו',
  bl_not_paired: 'הגשר לא צומד',
  doorsPaused: 'פתיחת דלתות מרחוק מושהית בזמן החלפת המפתח',
  hygieneNote: 'החלפת מפתח היא תחזוקה שוטפת בלבד, לא טיפול בדליפה. חושדים שהמפתח דלף? יש לבצע צימוד מחדש.',
  autoWaiting: 'ממתין לעדכון הגשר. ההחלפה תתחיל מעצמה.',
  autoScheduled: 'ההחלפה תתחיל מעצמה בקרוב.',
  autoIdle: 'המפתח הוחלף. אין צורך בפעולה.',
  autoAwaitClick: 'הגשר מוכן. החלפת המפתח הראשונה מתחילה בלחיצה אחת.',
  startFirst: 'התחלת החלפה',
  // WXH-LEFTOVERS-2405: owner contacts, the watchdog, the hand-over and the Settings banner
  ownerContacts: 'בעלי המערכת להתראות',
  ownerNone: 'לא נבחרו. התראות על מפתח הגשר נשלחות לכל מנהלי המערכת.',
  ownerAdd: 'הוספת מנהל מערכת',
  ownerRemove: 'הסרה',
  ownerInvalid: 'כבר אינו מנהל מערכת',
  ownerReach: 'התראה על מפתח הגשר תגיע ל־{n} מנהלי מערכת',
  wd_overlap_overdue: 'ההחלפה לא הסתיימה בזמן. Arx כבר לא מקבל את המפתח הישן.',
  wd_needs_repair: 'ההחלפה נעצרה ודורשת השלמה.',
  wd_verify_failed: 'לא אושר שהגשר ביטל את המפתח הישן. מומלץ צימוד מחדש.',
  wd_generation_mismatch: 'הגשר מדווח על דור מפתח {b}, ו־Arx על דור {a}. מומלץ צימוד מחדש.',
  bridgeGen: 'דור המפתח שהגשר מדווח',
  bridgeGenNone: 'הגשר לא מדווח',
  anchorUnavailable: 'הקטנת עוגן השעון אינה זמינה עדיין: WisKey עוד לא מקבל את הדיווח הזה.',
  bannerText: 'התראת אבטחה על מפתח הגשר ממתינה לאישור, ולא נבחרו בעלי מערכת להתראות.',
  bannerOpen: 'למרכז ההתראות',
  bannerContacts: 'לבחירת בעלי מערכת',
  // WXH4-EMERGENCY-REVOKE-2407: the emergency revocation and the re-pair
  stateRevoked: 'בוטל בחירום',
  rvTitle: 'ביטול חירום',
  rvNote: 'אם יש חשד שמפתח הגשר דלף: המפתח נמחק מיד, כל הפעולות דרך הגשר נעצרות, ונוצר קוד צימוד חדש.',
  rvButton: 'ביטול חירום של המפתח',
  rvDlgTitle: 'לבטל את מפתח הגשר בחירום?',
  rvDlg1: 'המפתח הנוכחי נמחק עכשיו ולא ישמש שוב.',
  rvDlg2: 'כל הפעולות דרך הגשר נעצרות עד הצימוד מחדש: דלתות, מכשירים ומצלמות שעוברים דרכו.',
  rvDlg3: 'נוצר קוד צימוד חדש. כשאפשר, הוא נשלח לגשר אוטומטית והגשר בודק אותו מול Arx.',
  rvDlg4: 'הודעה תישלח לאנשי הקשר של הבעלים ולכל מנהלי המערכת, ובה שמך.',
  rvWiskeyWarn: 'WisKey מותקן במערכת: פתיחת דלתות דרך WisKey תיפסק עד הצימוד מחדש.',
  rvWiskeyAck: 'הבנתי שפתיחת דלתות דרך WisKey תיפסק עד הצימוד מחדש',
  rvConfirm: 'ביטול המפתח',
  rvBack: 'חזרה',
  rvRevoked: 'מפתח הגשר בוטל ב־{t} בידי {name}. כל הפעולות דרך הגשר מושבתות עד צימוד מחדש.',
  rvAuto: 'הקוד החדש נשלח לגשר אוטומטית. הגשר בודק אותו מול Arx לפני שהוא מחליף אותו.',
  rvManual: 'הקוד החדש לא יכול להגיע לגשר לבד. הציגו אותו והזינו אותו בגשר.',
  rvRepaired: 'הגשר צומד מחדש ב־{t}.',
  rvReveal: 'הצגת הקוד החדש',
  rvRevealTitle: 'קוד הצימוד החדש',
  rvStepUp: 'לאימות מחדש, הזינו את הקוד הנוכחי מאפליקציית האימות שלכם. כל הצגה נרשמת ביומן.',
  rvStepUpNone: 'כדי להציג את הקוד צריך אימות דו־שלבי בחשבון שלך. הפעילו אותו בחשבון ונסו שוב.',
  rvCodeLabel: 'קוד אימות',
  rvShow: 'הצגה',
  rvCode: 'קוד צימוד',
  rvAddress: 'כתובת',
  rvSteps: 'בתשתית המערכת: הגדרות ‹ מכשירים ושירותים ‹ SMPLWISE Bridge ‹ הגדרה מחדש. הזינו את הכתובת ואת הקוד. הגשר בודק את הקוד מול Arx לפני שהוא מקבל אותו.',
  rvCopy: 'העתקה',
  rvCopied: 'הועתק',
  rvClose: 'סגירה',
  rvDone: 'מפתח הגשר בוטל.',
  bl_bridge_revoked: 'המפתח בוטל בחירום, ממתין לצימוד מחדש',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/bridge-key').en>('en', 'i18n/bridge-key', 'en');

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/bridge-key').ar>('ar', 'i18n/bridge-key', 'ar');

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/bridge-key').ru>('ru', 'i18n/bridge-key', 'ru');

type BktLang = 'he' | 'en' | 'ar' | 'ru';

export function bktLang(): BktLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<BktLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const BKT_DEV_MARKED: readonly BktLang[] = ['ar', 'ru'];

export function bkt(key: Key, vars?: Record<string, string | number>, lang: BktLang = bktLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

/** A state / blocked-by code as text (an unknown code falls back to the code itself). */
export function bktCode(prefix: 'st_' | 'bl_' | 'wd_', code: string | null | undefined, lang: BktLang = bktLang()): string {
  if (!code) return '';
  const k = `${prefix}${code}` as Key;
  return k in he ? bkt(k, undefined, lang) : code;
}

export const BKT_KEYS = Object.keys(he) as Key[];
export const BKT_TABLES = TABLES;

registerCatalogue('i18n/bridge-key', { he, en, ar, ru }, BKT_DEV_MARKED);
