/**
 * WISKEY-PAIRING-I18N-2520: the words of the pairing lines of "חיבור Arx ל-WisKey" (הגדרות › מתגי מסכי כניסה) in every language - the
 * lines, their "how to fix", the steps outside Arx (`owner_steps`) and the steps after a re-pair (`steps`). The server
 * (services/wiskey_pairing.py) writes them in Hebrew only; every line also carries its stable `reason`, `fix_code` and the values its
 * sentence was filled with (`params`, with `<name>_code` for a value that is itself a word), and every list of steps its codes
 * (`owner_step_codes`, `step_codes`). This catalogue says the same thing from those:
 *  - Hebrew: the server's own words, unchanged (the Hebrew table below is a copy, held equal to the server's by
 *    smplwise_vms/backend/tests/test_wiskey_pairing_i18n_2520.py; tests/unit-wiskey-pairing-i18n-2520.spec.ts reads the code lists from
 *    the backend source);
 *  - another language: the sentence of the code filled with the params; a code this page has no words for, or a sentence whose values
 *    did not arrive, falls back to the server's Hebrew text (never a made-up or empty sentence).
 * Technical names (codes, commands, versions, the integration's name) stay as written. No ar / ru pack: the screen has none.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';

const he = {
  // line labels: lbl_<key> (LABEL)
  lbl_bridge: 'גשר Arx בתשתית המערכת',
  lbl_component: 'רכיב WisKey',
  lbl_key: 'מפתח הצימוד',
  lbl_acceptance: 'WisKey מקבל את המפתח',
  lbl_discovery: 'חוזה הגילוי (פקודות מדיה ודיבור)',
  lbl_provider: 'מקור הווידאו והדיבור',
  lbl_rotation: 'החלפת מפתח הגשר',
  lbl_events: 'אירועי דלת אחרי הפעלה מחדש',
  lbl_last_error: 'שגיאה אחרונה',
  // line sentences: l_<reason> (TEXT)
  l_bridge_ok: 'הגשר מותקן ({version}) ומצומד; הוא שולח עדכון חתום כל דקה.',
  l_bridge_not_paired: 'הגשר עוד לא צומד ל־Arx.',
  l_bridge_silent: 'הגשר צומד, אבל לא שלח עדכון חתום מאז {since}. כנראה שהוא לא טעון או שהקוד שלו שונה מזה של Arx.',
  l_bridge_update_pending: 'גרסת הגשר שרצה ({active}) שונה מהגרסה שהותקנה ({installed}); נדרשת הפעלה מחדש של תשתית המערכת.',
  l_bridge_rejected: 'הגשר שולח עדכונים חתומים, אבל Arx דוחה אותם ({count} מאז {since}): הגשר חותם בקוד צימוד אחר מזה של Arx.',
  l_bridge_rejected_after_repair: 'אחרי הצימוד מחדש הגשר עדיין חותם בקוד הישן: Arx דוחה את העדכונים שלו ({count} מאז {since}). הקוד החדש לא הגיע לגשר.',
  l_component_managed: 'WisKey {version} · התקנה מנוהלת על ידי Arx.',
  l_component_manual: 'WisKey {version} · התקנה ידנית (בעל המערכת מעדכן את WisKey בעצמו).',
  l_component_unknown: 'גרסת WisKey לא ידועה כרגע: ערוץ השירות אל WisKey במצב "{feed}".',
  l_key_ok: 'יש מפתח צימוד והוא יכול לחתום. טביעה: {fingerprint}.',
  l_key_missing: 'אין מפתח צימוד: Arx לא יכול לחתום על שום פקודה אל WisKey.',
  l_key_unreadable: 'מפתח הגשר שמור, אבל לא ניתן לפענח אותו במכונה הזו (למשל אחרי שחזור גיבוי ממכונה אחרת).',
  l_key_rotated: 'מפתח הגשר הוחלף (החלפת מפתח). WisKey מקבל רק את קוד הצימוד המקורי, ולכן Arx לא חותם אליו יותר.',
  l_accepted: 'WisKey קיבל את החתימה של Arx וזיהה אותו כזהות שירות ({checked}).',
  l_refused: 'WisKey דחה את החתימה של Arx ({code}): הקוד שאצלו לא תואם את המפתח של Arx, או שהגשר לא טעון אצלו.',
  l_probe_key: 'לא נשלחה בדיקה: אין מפתח שיכול לחתום (ראו "מפתח הצימוד").',
  l_unreachable: 'לא ניתן היה להגיע לחיבור הישיר של WisKey ({code}). אולי גרסת WisKey לא כוללת אותו, או ש־WisKey לא טעון.',
  l_probe_error: 'הבדיקה לא הסתיימה ({code}); התוצאה לא ידועה.',
  l_probe_not_run: 'עוד לא נבדק מול WisKey.',
  l_discovery_ok: 'חוזה גילוי {protocol} גרסה {schema}: {listed} מתוך 6 פקודות המדיה והדיבור מפורסמות.',
  l_discovery_talk_missing: 'WisKey מפרסם וידאו אבל לא את ארבע פקודות הדיבור ({missing}).',
  l_discovery_media_missing: 'WisKey לא מפרסם את פקודות המדיה של העמדות ({missing}).',
  l_discovery_feed: 'לפי ערוץ השירות: וידאו {video}, דיבור {talk} (לא נבדק בחיבור הישיר).',
  l_discovery_unknown: 'חוזה הגילוי לא נקרא עדיין.',
  l_discovery_clock: 'השעונים של Arx ו־WisKey רחוקים מדי זה מזה ({why}); פקודות חתומות יידחו.',
  l_provider_auto: 'Arx בוחר לבד: החיבור הישיר של WisKey, ואם הוא לא זמין - הנתיב החתום דרך תשתית המערכת.',
  l_provider_local: 'מקור הווידאו והדיבור מוגדר "Arx (וידאו בלבד)": Arx לא מדבר עם העמדות דרך WisKey, גם כשהצימוד תקין.',
  l_provider_feed_gate: 'מקור הווידאו והדיבור מוגדר "WisKey (וידאו ודיבור)", אבל Arx בוחר ב־WisKey רק לפי רשימת הפקודות שבערוץ השירות, ושם פקודות המדיה לא מופיעות ({why}). לכן וידאו ודיבור לא עוברים דרך WisKey, גם כשהצימוד והחיבור הישיר תקינים.',
  l_provider_feed_no_talk: 'ערוץ השירות מפרסם את פקודות הווידאו אבל לא את פקודות הדיבור, ולכן דיבור לא עובר דרך WisKey.',
  l_rotation_off: 'החלפת מפתח הגשר כבויה; קוד הצימוד המקורי נשאר בתוקף.',
  l_rotation_risk: 'החלפת מפתח הגשר מופעלת. החלפה תמחק את קוד הצימוד המקורי מהגשר, ו־WisKey יפסיק לקבל את Arx.',
  l_rotation_blocked_wiskey: 'החלפת מפתח הגשר חסומה כל עוד WisKey מותקן: WisKey מאמת את Arx רק מול קוד הצימוד המקורי, וההחלפה מוחקת אותו מהגשר.',
  l_rotation_done: 'מפתח הגשר כבר הוחלף; זה מה שמנתק את WisKey (ראו "מפתח הצימוד").',
  l_events_off: 'המשכת אירועי הדלת מ־WisKey כבויה בהתקנה הזו; אירועים שקרו בזמן ש־Arx או WisKey היו כבויים עלולים לחסור.',
  l_events_not_run: 'עוד לא נקראו אירועי דלת מ־WisKey מאז ש־Arx עלה.',
  l_events_ok: 'המשך אחרון {at}: {delivered} אירועים חדשים, {duplicates} כפולים סוננו. {caught}',
  l_events_gap: 'פער באירועי הדלת: {start} עד {end} ({why}). האירועים בטווח הזה לא הגיעו ל־Arx - ההיסטוריה שם לא שלמה.',
  l_events_unsupported: 'גרסת WisKey לא מציעה המשך רציף של אירועים, ולכן אירועים שקרו בזמן ש־Arx או WisKey היו כבויים עלולים לחסור.',
  l_events_failed: 'ההמשך האחרון ({at}) לא הצליח ({code}); Arx ינסה שוב. אירוע לא הולך לאיבוד כל עוד WisKey שומר אותו.',
  l_no_error: 'אין שגיאה.',
  l_error: '{code}',
  // how to fix: x_<fix_code> (FIX)
  x_bridge_not_paired: 'בהגדרות ‹ תשתית המערכת: העתיקו את קוד הצימוד והוסיפו בתשתית המערכת את האינטגרציה SMPLWISE Bridge עם הקוד הזה.',
  x_bridge_silent: 'בתשתית המערכת: הגדרות ‹ מכשירים ושירותים ‹ SMPLWISE Bridge - ודאו שהיא טעונה (בלי שגיאה) והפעילו מחדש את תשתית המערכת. אם זה לא עוזר - צימוד מחדש (למטה).',
  x_bridge_update_pending: 'הפעילו מחדש את תשתית המערכת כדי שהגרסה החדשה של הגשר תיטען.',
  x_bridge_rejected: 'לרוב זו הודעת גילוי ישנה שהחזירה לגשר קוד ישן אחרי הפעלה מחדש של תשתית המערכת. Arx מגרסה 2.39.1 מוחק אותה בעצמו. לחצו "צימוד מחדש" למטה (מנהל מערכת). אם הקוד לא נשלח לגשר אוטומטית - הזינו אותו בגשר כפי שמוצג אחרי הצימוד.',
  x_bridge_rejected_after_repair: 'אם הקוד נשלח אוטומטית: המתינו דקה (הגשר בודק את הקוד מול Arx ומחליף אותו בעצמו); אם השורה נשארת אדומה - הפעילו מחדש את תשתית המערכת. אם הקוד לא נשלח: הגדרות ‹ מכשירים ושירותים ‹ SMPLWISE Bridge ‹ מחיקה, ואז הוספת אינטגרציה ‹ SMPLWISE Bridge עם הכתובת והקוד שמוצגים כאן.',
  x_component_unknown: 'בדקו ש־WisKey מותקן וטעון בתשתית המערכת. בהתקנה ידנית בעל המערכת מתקין ומעדכן אותו בעצמו.',
  x_key_missing: 'לחצו "צימוד מחדש" למטה (מנהל מערכת). Arx ייצור קוד צימוד חדש.',
  x_key_unreadable: 'לחצו "צימוד מחדש" למטה (מנהל מערכת). Arx ייצור קוד צימוד חדש במקום המפתח שאי אפשר לפענח.',
  x_key_rotated: 'לחצו "צימוד מחדש" למטה (מנהל מערכת) והשאירו את "לכבות את החלפת מפתח הגשר" מסומן. הקוד החדש יחזור לגשר, ו־WisKey יקבל אותו.',
  x_refused: 'אם הגשר שולח עדכונים (השורה הראשונה תקינה): הפעילו מחדש את תשתית המערכת וודאו שיש רק אינטגרציית SMPLWISE Bridge אחת. אם הגשר שקט - צימוד מחדש (למטה).',
  x_probe_key: 'תקנו קודם את "מפתח הצימוד".',
  x_unreachable: 'ודאו ש־WisKey טעון בתשתית המערכת ובגרסה 2.0.1 ומעלה. בהתקנה ידנית בעל המערכת מעדכן את WisKey. Arx ינסה בינתיים את הנתיב החתום דרך תשתית המערכת.',
  x_probe_error: 'לחצו שוב "בדיקה מול WisKey". אם זה חוזר - בדקו שתשתית המערכת זמינה.',
  x_probe_not_run: 'לחצו "בדיקה מול WisKey".',
  x_discovery_talk_missing: 'עדכנו את WisKey לגרסה שמפרסמת את פקודות הדיבור (בהתקנה ידנית - בעל המערכת).',
  x_discovery_media_missing: 'עדכנו את WisKey לגרסה שמפרסמת את פקודות המדיה של העמדות (בהתקנה ידנית - בעל המערכת).',
  x_discovery_unknown: 'לחצו "בדיקה מול WisKey".',
  x_discovery_clock: 'סנכרנו את השעון של שרת תשתית המערכת (NTP). Arx לא מזיז את השעון שלו.',
  x_provider_local: 'בהגדרות ‹ מתגי מסכי כניסה ‹ מקור הווידאו והדיבור: בחרו "WisKey (וידאו ודיבור)".',
  x_provider_feed_gate: 'זה לא תלוי בצימוד: נדרש עדכון - או ש־WisKey יפרסם את פקודות המדיה גם ברשימת הפקודות של ערוץ השירות, או ש־Arx יבחר לפי הגילוי החתום. פריט פתוח בפיתוח, לא פעולה של בעל המערכת.',
  x_provider_feed_no_talk: 'כמו בשורה למעלה: נדרש עדכון של רשימת הפקודות בערוץ השירות או של בחירת Arx. פריט פתוח בפיתוח.',
  x_rotation_risk: 'אל תלחצו "החלפת מפתח" בכרטיס מפתח הגשר כל עוד WisKey בשימוש. אפשר לכבות את ההחלפה שם, או בצימוד מחדש למטה.',
  x_rotation_done: 'צימוד מחדש (למטה) מחזיר קוד צימוד מקורי.',
  x_error: 'ראו את השורה שמסומנת באדום למעלה.',
  x_events_off: 'המשכת האירועים כובתה במכוון בהגדרת השרת של ההתקנה. כדי להפעיל אותה שוב - פנו לתמיכה.',
  x_events_not_run: 'Arx קורא את האירועים ברגע שערוץ השירות אל WisKey מוכן. אם זה נמשך - בדקו את השורות למעלה.',
  x_events_gap: 'אין מה לתקן ב־Arx: את האירועים שבטווח אפשר לראות ביומן הכניסות (כל עוד WisKey שומר אותם). השורה חוזרת לתקינה 7 ימים אחרי הפער.',
  x_events_unsupported: 'עדכנו את WisKey לגרסה שמפרסמת המשך רציף של אירועים (בהתקנה ידנית - בעל המערכת).',
  x_events_failed: 'אם זה חוזר: בדקו את השורות "מפתח הצימוד" ו"WisKey מקבל את המפתח" למעלה.',
  // steps outside Arx: s_<code> (STEP; {url} = addon_url)
  s_entry_single: 'בתשתית המערכת: הגדרות ‹ מכשירים ושירותים ‹ SMPLWISE Bridge - ודאו שיש רשומה אחת בלבד ושהיא טעונה.',
  s_restart_infra: 'הפעילו מחדש את תשתית המערכת (WisKey קורא את קוד הצימוד מהגשר כשהוא נטען).',
  s_check_again: 'חזרו לכאן ולחצו "בדיקה מול WisKey".',
  s_update_wiskey: 'עדכון WisKey הוא פעולה של בעל המערכת (התקנה ידנית, מדיניות B): התקינו את גרסת WisKey המאושרת (2.0.1 ומעלה) והפעילו מחדש את תשתית המערכת.',
  s_provider_choose: 'בהגדרות ‹ מתגי מסכי כניסה ‹ מקור הווידאו והדיבור: "WisKey (וידאו ודיבור)".',
  s_announced_sent: 'הקוד החדש נשלח לגשר הקיים: הגשר בודק אותו מול Arx ומחליף אותו בעצמו, בלי אישור. אם הגשר עוד לא הוגדר - בתשתית המערכת תופיע בקשה להוסיף את SMPLWISE Bridge; אשרו אותה.',
  s_announced_wait: 'המתינו דקה עד שהגשר ישלח עדכון חתום (השורה "גשר Arx" תהפוך לתקינה).',
  s_announced_check: 'לחצו "בדיקה מול WisKey".',
  s_manual_delete: 'בתשתית המערכת: הגדרות ‹ מכשירים ושירותים ‹ SMPLWISE Bridge ‹ שלוש הנקודות ‹ מחיקה. לפני כן רשמו את האפשרויות שהוגדרו בה (משתמש שירות, האצלת שמירה, הרשאות להפעלה): הן נמחקות עם הרשומה.',
  s_manual_add: 'הוספת אינטגרציה ‹ SMPLWISE Bridge.',
  s_manual_url: 'כתובת: {url} · קוד הצימוד: הקוד שמוצג כאן.',
  // values that are words: v_<param>_<code>
  v_since_pairing: 'הצימוד',
  v_video_yes: 'כן',
  v_video_no: 'לא',
  v_talk_yes: 'כן',
  v_talk_no: 'לא',
  v_start_unknown: 'לא ידוע',
  v_caught_until: 'Arx מעודכן עד {caught_at}.',
  v_caught_not_yet: 'עוד לא הגיע לסוף הרשימה של WisKey.',
  v_why_first_start: 'Arx התחיל בלי נקודת המשך',
  v_why_source_replaced: 'WisKey הותקן מחדש או שמאגר האירועים שלו אופס',
  v_why_source_mismatch: 'מאגר האירועים של WisKey התחלף',
  v_why_cursor_ahead: 'ההיסטוריה של WisKey חזרה אחורה (שחזור)',
  v_why_retention_gap: 'נקודת ההמשך ישנה מדי: WisKey כבר מחק את האירועים שאחריה',
  v_why_cursor_invalid: 'WisKey לא זיהה את נקודת ההמשך',
  v_code_direct_connect_refused: 'WisKey סגר את החיבור בלי תשובה - החתימה לא אומתה אצלו.',
  v_code_reply_unauthenticated: 'התשובה של WisKey לא חתומה במפתח של Arx.',
  v_code_direct_identity_invalid: 'WisKey החזיר זהות בפורמט לא מוכר.',
  v_code_direct_unreachable: 'החיבור הישיר של WisKey לא נפתח.',
  v_code_direct_hello_timeout: 'WisKey לא פתח את החיבור הישיר בזמן.',
  v_code_direct_hello_invalid: 'פתיחת החיבור הישיר של WisKey בפורמט לא מוכר.',
  v_code_direct_connect_timeout: 'WisKey לא ענה בזמן על בקשת החיבור.',
  v_code_direct_connect_failed: 'החיבור הישיר נכשל.',
  v_code_bridge_not_paired: 'אין מפתח צימוד.',
  v_code_bridge_key_rotated: 'המפתח הוחלף, ו־WisKey לא מקבל מפתח מוחלף.',
  v_code_outcome_unknown: 'לא התקבלה תשובה בזמן.',
  v_code_connection_closed: 'החיבור נסגר באמצע.',
  v_code_probe_timeout: 'הבדיקה לא הסתיימה בזמן.',
  v_code_clock_skew: 'השעונים רחוקים מדי.',
  // the link of the provider line (PROVIDER_ROW)
  link_providerRow: 'מקור הווידאו והדיבור',
};

type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/wiskey-pairing-status').en>('en', 'i18n/wiskey-pairing-status', 'en');

type WpsLang = 'he' | 'en';
const TABLES: Record<WpsLang, Partial<Record<Key, string>>> = { he, en };
export const WPS_KEYS = Object.keys(he) as Key[];
export const WPS_TABLES = TABLES;
/** The target of the provider line's link (services/wiskey_pairing.py PROVIDER_ROW). */
export const WPS_PROVIDER_ROW_HREF = '#/system/diagnostics?tab=access-control';

function wpsLang(): WpsLang {
  return docLang(['en']);
}

const PLACEHOLDER = /\{(\w+)\}/g;

/** The sentence of `key` in `lang` filled with `vars`, or null when there is none or a placeholder has no value. */
function sentence(key: string, lang: WpsLang, vars: Record<string, unknown> = {}): string | null {
  const raw = (TABLES[lang] as Record<string, string | undefined>)[key];
  if (typeof raw !== 'string' || !raw) return null;
  const names = [...raw.matchAll(PLACEHOLDER)].map((m) => m[1]);
  if (names.some((n) => !(n in vars) || vars[n] === null || vars[n] === undefined || typeof vars[n] === 'object')) return null;
  return fill(raw, vars as Record<string, string | number>);
}

export interface WpsLine {
  key: string;
  label: string;
  reason: string;
  text: string;
  fix: string | null;
  /** WISKEY-PAIRING-I18N-2520 (additive): absent on an older server. */
  fix_code?: string | null;
  params?: Record<string, unknown> | null;
}

/** The values of a line's sentence: the params, with every `<name>_code` turned into the word `v_<name>_<code>` (null: a word this page
 * does not have - the line keeps the server's text). */
function lineVars(l: WpsLine, lang: WpsLang): Record<string, unknown> | null {
  const p: Record<string, unknown> = l.params ?? {};
  if (typeof p !== 'object' || Array.isArray(p)) return null;
  const vars: Record<string, unknown> = { ...p };
  for (const [k, v] of Object.entries(p)) {
    if (!k.endsWith('_code') || k === '_code') continue;
    const word = typeof v === 'string' ? sentence(`v_${k.slice(0, -5)}_${v}`, lang, p) : null;
    if (!word) return null;
    vars[k.slice(0, -5)] = word;
  }
  return vars;
}

/** The line's label (by its stable key). */
export function wpsLineLabel(l: Pick<WpsLine, 'key' | 'label'>, lang: WpsLang = wpsLang()): string {
  return lang === 'he' ? l.label : sentence(`lbl_${l.key}`, lang) || l.label;
}

/** The line's sentence in the page's language (Hebrew: the server's text). */
export function wpsLineText(l: WpsLine, lang: WpsLang = wpsLang()): string {
  if (lang === 'he') return l.text;
  const vars = lineVars(l, lang);
  return (vars && sentence(`l_${l.reason}`, lang, vars)) || l.text;
}

/** How to fix the line, in the page's language; null when the server gave none. */
export function wpsLineFix(l: WpsLine, lang: WpsLang = wpsLang()): string | null {
  if (!l.fix || lang === 'he' || !l.fix_code) return l.fix;
  return sentence(`x_${l.fix_code}`, lang) || l.fix;
}

/** A list of steps in the page's language: by their codes when the server sent them (one per step), else the server's Hebrew. */
export function wpsSteps(texts: readonly string[], codes: readonly string[] | null | undefined, vars: Record<string, unknown> = {}, lang: WpsLang = wpsLang()): string[] {
  if (lang === 'he' || !Array.isArray(codes) || codes.length !== texts.length) return [...texts];
  return texts.map((t, i) => (typeof codes[i] === 'string' && sentence(`s_${codes[i]}`, lang, vars)) || t);
}

/** The label of the provider line's link (by its target). */
export function wpsProviderRowLabel(row: { href: string; label: string }, lang: WpsLang = wpsLang()): string {
  return lang === 'he' || row.href !== WPS_PROVIDER_ROW_HREF ? row.label : sentence('link_providerRow', lang) || row.label;
}

registerCatalogue('i18n/wiskey-pairing-status', { he, en });
