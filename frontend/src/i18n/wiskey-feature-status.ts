/**
 * WISKEY-STATUS-I18N-2520: the words of "מצב WisKey: תכונות בנויות" (הגדרות › מתגי מסכי כניסה › חיבור Arx ל-WisKey) in every language.
 * The server (services/wiskey_feature_status.py) writes each row and reason in Hebrew only; every reason also carries its stable `code`
 * and the values its sentence was filled with (`params`), every row its stable `key`, every link its `href`. This catalogue says the
 * same thing from those:
 *  - Hebrew: the server's own words, unchanged (the Hebrew table below is a copy, held equal to the server's by
 *    tests/unit-wiskey-feature-status-i18n-2520.spec.ts, which reads the code list from the backend source);
 *  - another language: the sentence of the code filled with the params; a code, key, group or link this page has no words for - or a
 *    sentence whose values did not arrive - falls back to the server's Hebrew text (never a made-up or empty sentence).
 * Technical names (commands, settings keys, contract names) stay as written. No ar / ru pack: the screen has none (English only).
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';

const he = {
  // reasons: r_<code> the sentence, f_<code> how to turn it on (services/wiskey_feature_status.py `R`, the same words)
  r_provider_local: 'מקור הווידאו והדיבור מוגדר "Arx (וידאו בלבד)", ולכן החיבור הישיר ל־WisKey לא מופעל.',
  f_provider_local: 'בהגדרות › מתגי מסכי כניסה › מקור הווידאו והדיבור: "WisKey (וידאו ודיבור)", ואז הפעלה מחדש של Arx.',
  r_key_missing: 'אין מפתח צימוד, ולכן Arx לא חותם על פקודות אל WisKey.',
  f_key_missing: 'צימוד מחדש בבלוק "חיבור Arx ל-WisKey" למעלה.',
  r_key_unreadable: 'לא ניתן לפענח את מפתח הגשר במכונה הזו.',
  f_key_unreadable: 'צימוד מחדש בבלוק "חיבור Arx ל-WisKey" למעלה.',
  r_key_rotated: 'מפתח הגשר הוחלף; החיבור הישיר של WisKey (גרסה 1) לא מקבל מפתח עם מזהה מפתח.',
  f_key_rotated: 'צימוד מחדש בבלוק "חיבור Arx ל-WisKey" למעלה, עם כיבוי החלפת מפתח הגשר.',
  r_join_not_started: 'החיבור הישיר לא פעיל כרגע.',
  f_join_not_started: 'Arx מפעיל אותו לבד, בלי הפעלה מחדש, כש"מקור הווידאו והדיבור" הוא WisKey ומפתח הצימוד תקין; אם זה לא קורה - "בדוק חיבור חתום" בבלוק "חיבור Arx ל-WisKey" למעלה.',
  r_join_starting: 'החיבור הישיר {what} כעת.',
  f_join_starting: 'אין צורך בהפעלה מחדש: רעננו את הדף בעוד רגע.',
  r_join_error: 'החיבור הישיר נכשל ({error}); Arx ינסה שוב לבד.',
  f_join_error: '"בדוק חיבור חתום" בבלוק "חיבור Arx ל-WisKey" למעלה.',
  r_not_proven: 'עוד לא הוכח ש־WisKey מקבל את החתימה של Arx.',
  f_not_proven: '"בדוק חיבור חתום" בבלוק "חיבור Arx ל-WisKey" למעלה.',
  r_refused: 'WisKey דחה את החתימה של Arx בבדיקה האחרונה.',
  f_refused: 'ראו את ההנחיות בבלוק "חיבור Arx ל-WisKey" למעלה.',
  r_feed_not_listed: 'Arx בוחר ב־WisKey לפי רשימת הפקודות שבערוץ השירות, ושם פקודות המדיה לא מופיעות ({why}).',
  f_feed_not_listed: 'פריט פתוח בפיתוח: WisKey יפרסם את פקודות המדיה ברשימה, או ש־Arx יבחר לפי הגילוי החתום. לא פעולה של בעל המערכת.',
  r_feed_no_talk: 'ברשימת הפקודות של ערוץ השירות אין את פקודות הדיבור.',
  f_feed_no_talk: 'פריט פתוח בפיתוח (כמו בשורה של הווידאו).',
  r_direct_no_media: 'בגילוי החתום (direct/capabilities) חסרות פקודות מדיה: {missing}.',
  f_direct_no_media: 'עדכון WisKey לגרסה שמפרסמת אותן (בהתקנה ידנית - בעל המערכת).',
  r_no_talk_audio: 'WisKey לא מציע את צליל העמדה בתוך שיחה (station_talk_audio) בגילוי החתום.',
  f_no_talk_audio: 'עדכון WisKey (בהתקנה ידנית - בעל המערכת).',
  r_media_off: 'המתג "מדיה של העמדות" כבוי.',
  f_media_off: 'בהגדרות › מתגי מסכי כניסה: מדיה של העמדות - וידאו (או וידאו ודיבור).',
  r_media_no_talk: 'המתג "מדיה של העמדות" מוגדר לווידאו בלבד.',
  f_media_no_talk: 'בהגדרות › מתגי מסכי כניסה: מדיה של העמדות - וידאו ודיבור.',
  r_listen_off: 'המתג "האזנה לעמדה" כבוי.',
  f_listen_off: 'בהגדרות › מתגי מסכי כניסה: האזנה לעמדה.',
  r_listen_no_downlink: 'הגילוי החתום האחרון של WisKey לא מציע האזנה לעמדה (station_talk_audio עם הבחירה media/talk_open.parameters.listen).',
  f_listen_no_downlink: 'עדכון WisKey לגרסה שמציעה אותה (בהתקנה ידנית - בעל המערכת), ואז "בדוק חיבור חתום".',
  r_listen_offer_rejected: 'WisKey מציע את station_talk_audio בצורה אחרת מזו ש־Arx קורא (arx.station_talk_audio.v1, בחירה, ברירת מחדל כבויה), ולכן Arx לא משתמש בה.',
  f_listen_offer_rejected: 'פריט פתוח מול WisKey; לא פעולה של בעל המערכת.',
  r_listen_unknown: 'עוד לא ידוע אם WisKey מציע האזנה לעמדה: אין גילוי חתום (לא מהחיבור הישיר ולא מבדיקה).',
  f_listen_unknown: '"בדוק חיבור חתום" בבלוק "חיבור Arx ל-WisKey" למעלה.',
  r_policy_b: 'מדיניות B: Arx לא מתקין ולא מנהל את WisKey, והתכונה זמינה רק בהתקנה מנוהלת.',
  f_policy_b: 'ממתין להתקנה מנוהלת (בעבודה, צוות ההתקנה המנוהלת). לא מפעילים את wiskey.auto_install ידנית.',
  r_owner_on_not_permitted: 'הפעלת ההתקנה המנוהלת חסומה בגרסה הזו (OWNER_ON_PERMITTED).',
  f_owner_on_not_permitted: 'ממתין לגרסה עם ההתקנה המנוהלת ואישור בעל המערכת.',
  r_service_grant_manual: 'בהתקנה ידנית אין ב־WisKey כותב להרשאת השירות (native_service_grants_v1), ולכן WisKey עונה service_grant_required.',
  f_service_grant_manual: 'תיפתר עם ההתקנה המנוהלת, או כשבעל המערכת יגדיר הרשאת שירות ב־WisKey (לפי הנחיות WisKey).',
  r_not_built: 'הזרימה לא בנויה עדיין ב־Arx (קבוע בנייה כבוי).',
  f_not_built: 'פריט פיתוח פתוח; אין מה להפעיל כרגע.',
  r_peer_receipt_off: 'מתג אישור הקבלה של WisKey (wiskey.peer_receipt) כבוי, וקריאת רישום העמיתים לא בנויה.',
  f_peer_receipt_off: 'פריט פיתוח פתוח; אין מה להפעיל כרגע.',
  r_acr5_off: 'מתגי הקריאה החוזרת של WisKey כבויים ({on} מתוך 4 פעילים).',
  f_acr5_off: 'הגדרות › אבטחה › WisKey.',
  r_doors_unmapped: '{count} דלתות של WisKey לא משויכות לממסר בעמדה, ופתיחה שלהן נדחית.',
  f_doors_unmapped: 'הגדרות › הקמה › שיוך דלתות: אשרו את ההצעות או שייכו ידנית.',
  r_windows_off: 'חלונות הדלת כבויים (doors.windows.enabled).',
  f_windows_off: 'חלונות דלת › הגדרות.',
  r_emergency_off: 'פתיחת חירום כבויה (doors.emergency.enabled / open_enabled).',
  f_emergency_off: 'חלונות דלת › חירום (מנהל מערכת, עם אישור).',
  r_automation_off: 'פתיחת דלת מאוטומציה כבויה (doors.automation_open).',
  f_automation_off: 'הגדרות › הקמה › פתיחת דלתות מאוטומציה.',
  r_lock_unsupported: 'WisKey מסמן נעילת חירום כלא נתמכת (emergency_secure_unsupported_v1).',
  f_lock_unsupported: 'ממתין ל־WisKey.',
  r_template_off: 'שליחת תבניות וואטסאפ דרך WisKey כבויה (messaging.template_send).',
  f_template_off: 'הגדרות ההודעות › תבניות וואטסאפ.',
  r_owner_excluded: 'פקודות אישור כפול של WisKey מוחרגות בהחלטת בעל המערכת (ההרשאות של Arx הן הסמכות).',
  f_owner_excluded: 'אין צורך להפעיל.',
  r_probe_unknown: 'לא ידוע אם WisKey מקבל את החתימה (הבדיקה לא הסתיימה או לא הגיעה ל־WisKey).',
  f_probe_unknown: '"בדוק חיבור חתום" שוב.',
  r_check_failed: 'לא ניתן לבדוק כרגע ({error}).',
  // the direct join's state inside r_join_starting ({what})
  joinState_starting: 'מופעל',
  joinState_connecting: 'מתחבר',
  joinState_stopping: 'נעצר',
  // rows: row_<key> (`ROWS`)
  row_direct_api: 'החיבור הישיר ל־WisKey (גילוי, זהות שירות)',
  row_w10_video: 'וידאו של עמדה דרך WisKey',
  row_w10_talk: 'דיבור דו־כיווני עם עמדה',
  row_w10_sound: 'צליל העמדה בתוך שיחה',
  row_listen: 'האזנה לעמדה בלי שיחה',
  row_native_people_writes: 'כתיבת אנשים חתומה (Native, שרשרת אישור)',
  row_service_writer: 'כותב השירות של WisKey (יצירה, עדכון, קוד, ביטול זמני)',
  row_readback: 'קריאה חוזרת של הרשאות אדם מ־WisKey',
  row_csv_preview: 'תצוגה מקדימה מאומתת ב־WisKey לייבוא CSV',
  row_capture_lease: 'קליטת כרטיס בחתימה (capture lease)',
  row_door_release: 'פתיחת דלת מ־Arx',
  row_programs_save: 'שמירת תוכניות החזקה פתוחה בעמדה',
  row_door_windows: 'חלונות דלת',
  row_emergency_open: 'פתיחת חירום',
  row_emergency_lock: 'נעילת חירום',
  row_door_automations: 'פתיחת דלת מאוטומציה',
  row_feature_host: 'מארח התכונות של WisKey',
  row_live_media_feature: 'מדיה חיה לתכונות (media ingress)',
  row_template_send: 'שליחת תבניות וואטסאפ דרך WisKey (גרסה 2)',
  row_template_queue: 'תור תבניות וגרסה 3',
  row_event_cursor: 'סמן אירועים עמיד (חידוש אחרי ניתוק)',
  row_relay_map_stage: 'העברת מפת הממסרים ל־WisKey',
  row_job_approvals: 'אישור כפול של WisKey',
  row_managed_install: 'התקנה ועדכון מנוהלים של WisKey',
  row_generation_journal: 'יומן דורות ותחזוקה של ההתקנה',
  // groups: grp_<slug>
  grp_connection: 'חיבור',
  grp_media: 'מדיה ודיבור',
  grp_people: 'אנשים',
  grp_doors: 'דלתות',
  grp_messaging: 'הודעות',
  grp_events: 'אירועים',
  grp_install: 'התקנה',
  // links: link_<slug> (the label of a row's link)
  link_accessTab: 'הגדרות › מתגי מסכי כניסה',
  link_setup: 'הגדרות › הקמה',
  link_securityWiskey: 'הגדרות › אבטחה › WisKey',
  link_doorWindows: 'חלונות דלת',
  link_bridgeTab: 'הגדרות › גשר Arx',
};

type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/wiskey-feature-status').en>('en', 'i18n/wiskey-feature-status', 'en');

type WfsLang = 'he' | 'en';
const TABLES: Record<WfsLang, Partial<Record<Key, string>>> = { he, en };
export const WFS_KEYS = Object.keys(he) as Key[];
export const WFS_TABLES = TABLES;

/** The row's link target -> its slug (services/wiskey_feature_status.py ACCESS_TAB, SETUP, ...). */
export const WFS_LINK_SLUG: Readonly<Record<string, string>> = {
  '#/system/diagnostics?tab=access-control': 'accessTab',
  '#/system/setup': 'setup',
  '#/system/security/wiskey': 'securityWiskey',
  '#/wiskey/door-windows': 'doorWindows',
  '#/system/diagnostics?tab=ha': 'bridgeTab',
};
/** The server's Hebrew group name (the Hebrew table's grp_<slug>) -> its slug. */
export const WFS_GROUP_SLUG: Readonly<Record<string, string>> = Object.fromEntries(
  WFS_KEYS.filter((k) => k.startsWith('grp_')).map((k) => [he[k], k.slice(4)]),
);

function wfsLang(): WfsLang {
  return docLang(['en']);
}

const PLACEHOLDER = /\{(\w+)\}/g;

/** The sentence of `key` in `lang` filled with `vars`, or null when there is none or a placeholder has no value. */
function sentence(key: string, lang: WfsLang, vars: Record<string, unknown> = {}): string | null {
  const raw = (TABLES[lang] as Record<string, string | undefined>)[key];
  if (typeof raw !== 'string' || !raw) return null;
  const names = [...raw.matchAll(PLACEHOLDER)].map((m) => m[1]);
  if (names.some((n) => !(n in vars) || vars[n] === null || vars[n] === undefined || typeof vars[n] === 'object')) return null;
  return fill(raw, vars as Record<string, string | number>);
}

interface WfsReason {
  code: string;
  text: string;
  fix: string | null;
  /** WISKEY-STATUS-I18N-2520 (additive): the values the server filled the sentence with; absent on an older server. */
  params?: Record<string, unknown> | null;
}

function reasonVars(r: WfsReason, lang: WfsLang): Record<string, unknown> | null {
  // an older server sends no `params`: a sentence without values still has its words, one with values falls back to the server's
  const p: Record<string, unknown> = r.params ?? {};
  if (typeof p !== 'object' || Array.isArray(p)) return null;
  const vars: Record<string, unknown> = { ...p };
  if (r.code === 'join_starting') {
    const state = typeof p.state === 'string' ? p.state : '';
    const word = sentence(`joinState_${state}`, lang);
    if (!word) return null;
    vars.what = word;
  }
  return vars;
}

/** The reason's sentence in the page's language (Hebrew: the server's text). */
export function wfsReasonText(r: WfsReason, lang: WfsLang = wfsLang()): string {
  if (lang === 'he') return r.text;
  const vars = reasonVars(r, lang);
  return (vars && sentence(`r_${r.code}`, lang, vars)) || r.text;
}

/** How to turn it on, in the page's language; null when the server gave none. */
export function wfsReasonFix(r: WfsReason, lang: WfsLang = wfsLang()): string | null {
  if (!r.fix || lang === 'he') return r.fix;
  return sentence(`f_${r.code}`, lang) || r.fix;
}

/** The row's label (by its stable key). */
export function wfsRowLabel(row: { key: string; label: string }, lang: WfsLang = wfsLang()): string {
  return lang === 'he' ? row.label : sentence(`row_${row.key}`, lang) || row.label;
}

/** A group heading (the server's Hebrew group name). */
export function wfsGroupLabel(group: string, lang: WfsLang = wfsLang()): string {
  const slug = WFS_GROUP_SLUG[group];
  return lang === 'he' || !slug ? group : sentence(`grp_${slug}`, lang) || group;
}

/** The label of a row's link (by its target). */
export function wfsLinkLabel(link: { href: string; label: string }, lang: WfsLang = wfsLang()): string {
  const slug = WFS_LINK_SLUG[link.href];
  return lang === 'he' || !slug ? link.label : sentence(`link_${slug}`, lang) || link.label;
}

registerCatalogue('i18n/wiskey-feature-status', { he, en });
