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
  x_bridge_not_paired: 'בהגדרות › תשתית המערכת: העתיקו את קוד הצימוד והוסיפו בתשתית המערכת את האינטגרציה SMPLWISE Bridge עם הקוד הזה.',
  x_bridge_silent: 'בתשתית המערכת: הגדרות › מכשירים ושירותים › SMPLWISE Bridge - ודאו שהיא טעונה (בלי שגיאה) והפעילו מחדש את תשתית המערכת. אם זה לא עוזר - צימוד מחדש (למטה).',
  x_bridge_update_pending: 'הפעילו מחדש את תשתית המערכת כדי שהגרסה החדשה של הגשר תיטען.',
  x_bridge_rejected: 'לרוב זו הודעת גילוי ישנה שהחזירה לגשר קוד ישן אחרי הפעלה מחדש של תשתית המערכת. Arx מגרסה 2.39.1 מוחק אותה בעצמו. לחצו "צימוד מחדש" למטה (מנהל מערכת). אם הקוד לא נשלח לגשר אוטומטית - הזינו אותו בגשר כפי שמוצג אחרי הצימוד.',
  x_bridge_rejected_after_repair: 'אם הקוד נשלח אוטומטית: המתינו דקה (הגשר בודק את הקוד מול Arx ומחליף אותו בעצמו); אם השורה נשארת אדומה - הפעילו מחדש את תשתית המערכת. אם הקוד לא נשלח: הגדרות › מכשירים ושירותים › SMPLWISE Bridge › מחיקה, ואז הוספת אינטגרציה › SMPLWISE Bridge עם הכתובת והקוד שמוצגים כאן.',
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
  x_provider_local: 'בהגדרות › מתגי מסכי כניסה › מקור הווידאו והדיבור: בחרו "WisKey (וידאו ודיבור)".',
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
  s_entry_single: 'בתשתית המערכת: הגדרות › מכשירים ושירותים › SMPLWISE Bridge - ודאו שיש רשומה אחת בלבד ושהיא טעונה.',
  s_restart_infra: 'הפעילו מחדש את תשתית המערכת (WisKey קורא את קוד הצימוד מהגשר כשהוא נטען).',
  s_check_again: 'חזרו לכאן ולחצו "בדיקה מול WisKey".',
  s_update_wiskey: 'עדכון WisKey הוא פעולה של בעל המערכת (התקנה ידנית, מדיניות B): התקינו את גרסת WisKey המאושרת (2.0.1 ומעלה) והפעילו מחדש את תשתית המערכת.',
  s_provider_choose: 'בהגדרות › מתגי מסכי כניסה › מקור הווידאו והדיבור: "WisKey (וידאו ודיבור)".',
  s_announced_sent: 'הקוד החדש נשלח לגשר הקיים: הגשר בודק אותו מול Arx ומחליף אותו בעצמו, בלי אישור. אם הגשר עוד לא הוגדר - בתשתית המערכת תופיע בקשה להוסיף את SMPLWISE Bridge; אשרו אותה.',
  s_announced_wait: 'המתינו דקה עד שהגשר ישלח עדכון חתום (השורה "גשר Arx" תהפוך לתקינה).',
  s_announced_check: 'לחצו "בדיקה מול WisKey".',
  s_manual_delete: 'בתשתית המערכת: הגדרות › מכשירים ושירותים › SMPLWISE Bridge › שלוש הנקודות › מחיקה. לפני כן רשמו את האפשרויות שהוגדרו בה (משתמש שירות, האצלת שמירה, הרשאות להפעלה): הן נמחקות עם הרשומה.',
  s_manual_add: 'הוספת אינטגרציה › SMPLWISE Bridge.',
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

const en: Record<Key, string> = {
  // line labels: lbl_<key> (LABEL)
  lbl_bridge: 'Arx bridge in the system infrastructure',
  lbl_component: 'WisKey component',
  lbl_key: 'Pairing key',
  lbl_acceptance: 'WisKey accepts the key',
  lbl_discovery: 'Discovery contract (media and talk commands)',
  lbl_provider: 'Video and talk source',
  lbl_rotation: 'Bridge key rotation',
  lbl_events: 'Door events after a restart',
  lbl_last_error: 'Last error',
  // line sentences: l_<reason> (TEXT)
  l_bridge_ok: 'The bridge is installed ({version}) and paired; it sends a signed update every minute.',
  l_bridge_not_paired: 'The bridge is not paired with Arx yet.',
  l_bridge_silent: 'The bridge is paired, but it has not sent a signed update since {since}. It is probably not loaded, or its code differs from the one Arx holds.',
  l_bridge_update_pending: 'The running bridge version ({active}) differs from the installed version ({installed}); the system infrastructure needs a restart.',
  l_bridge_rejected: 'The bridge sends signed updates, but Arx refuses them ({count} since {since}): the bridge signs with a pairing code other than the one Arx holds.',
  l_bridge_rejected_after_repair: 'After pairing again the bridge still signs with the old code: Arx refuses its updates ({count} since {since}). The new code did not reach the bridge.',
  l_component_managed: 'WisKey {version} · installation managed by Arx.',
  l_component_manual: 'WisKey {version} · manual installation (the system owner updates WisKey).',
  l_component_unknown: 'The WisKey version is not known right now: the service channel to WisKey is "{feed}".',
  l_key_ok: 'There is a pairing key and it can sign. Fingerprint: {fingerprint}.',
  l_key_missing: 'There is no pairing key: Arx cannot sign any command to WisKey.',
  l_key_unreadable: 'The bridge key is stored, but it cannot be decrypted on this machine (for example after restoring a backup from another machine).',
  l_key_rotated: 'The bridge key was replaced (key rotation). WisKey accepts only the original pairing code, so Arx no longer signs to it.',
  l_accepted: 'WisKey accepted the signature of Arx and recognised it as a service identity ({checked}).',
  l_refused: 'WisKey refused the signature of Arx ({code}): its code does not match the key of Arx, or the bridge is not loaded on its side.',
  l_probe_key: 'No check was sent: there is no key that can sign (see "Pairing key").',
  l_unreachable: 'The WisKey direct connection could not be reached ({code}). Perhaps this WisKey version does not include it, or WisKey is not loaded.',
  l_probe_error: 'The check did not finish ({code}); the result is not known.',
  l_probe_not_run: 'Not checked against WisKey yet.',
  l_discovery_ok: 'Discovery contract {protocol} version {schema}: {listed} of the 6 media and talk commands are published.',
  l_discovery_talk_missing: 'WisKey publishes video but not the four talk commands ({missing}).',
  l_discovery_media_missing: 'WisKey does not publish the station media commands ({missing}).',
  l_discovery_feed: 'By the service channel: video {video}, talk {talk} (not checked on the direct connection).',
  l_discovery_unknown: 'The discovery contract has not been read yet.',
  l_discovery_clock: 'The clocks of Arx and WisKey are too far apart ({why}); signed commands will be refused.',
  l_provider_auto: 'Arx chooses by itself: the WisKey direct connection, and when it is not available - the signed path through the system infrastructure.',
  l_provider_local: 'The video and talk source is set to "Arx (video only)": Arx does not talk to the stations through WisKey, even when the pairing is fine.',
  l_provider_feed_gate: 'The video and talk source is set to "WisKey (video and talk)", but Arx chooses WisKey only by the command list of the service channel, and the media commands are not listed there ({why}). So video and talk do not go through WisKey, even when the pairing and the direct connection are fine.',
  l_provider_feed_no_talk: 'The service channel publishes the video commands but not the talk commands, so talk does not go through WisKey.',
  l_rotation_off: 'Bridge key rotation is off; the original pairing code stays valid.',
  l_rotation_risk: 'Bridge key rotation is on. A rotation deletes the original pairing code from the bridge, and WisKey stops accepting Arx.',
  l_rotation_blocked_wiskey: 'Bridge key rotation is blocked while WisKey is installed: WisKey verifies Arx only against the original pairing code, and the rotation deletes it from the bridge.',
  l_rotation_done: 'The bridge key was already replaced; that is what disconnects WisKey (see "Pairing key").',
  l_events_off: 'Resuming door events from WisKey is off on this installation; events that happened while Arx or WisKey was off may be missing.',
  l_events_not_run: 'No door events have been read from WisKey since Arx started.',
  l_events_ok: 'Last resume {at}: {delivered} new events, {duplicates} duplicates filtered. {caught}',
  l_events_gap: 'A gap in the door events: {start} to {end} ({why}). The events in this range did not reach Arx - the history there is incomplete.',
  l_events_unsupported: 'This WisKey version does not offer a continuous resume of events, so events that happened while Arx or WisKey was off may be missing.',
  l_events_failed: 'The last resume ({at}) did not succeed ({code}); Arx will try again. An event is not lost as long as WisKey keeps it.',
  l_no_error: 'No error.',
  l_error: '{code}',
  // how to fix: x_<fix_code> (FIX)
  x_bridge_not_paired: 'In Settings › System infrastructure: copy the pairing code and add the SMPLWISE Bridge integration with this code in the system infrastructure.',
  x_bridge_silent: 'In the system infrastructure: Settings › Devices & services › SMPLWISE Bridge - make sure it is loaded (without an error) and restart the system infrastructure. If that does not help - pair again (below).',
  x_bridge_update_pending: 'Restart the system infrastructure so that the new bridge version is loaded.',
  x_bridge_rejected: 'Usually this is an old discovery message that gave the bridge an old code back after a restart of the system infrastructure. Arx 2.39.1 and later deletes it by itself. Press "Pair again" below (system administrator). If the code is not sent to the bridge automatically - enter it in the bridge as shown after pairing.',
  x_bridge_rejected_after_repair: 'If the code was sent automatically: wait a minute (the bridge checks the code with Arx and replaces it by itself); if the row stays red - restart the system infrastructure. If the code was not sent: Settings › Devices & services › SMPLWISE Bridge › Delete, then Add integration › SMPLWISE Bridge with the address and the code shown here.',
  x_component_unknown: 'Check that WisKey is installed and loaded in the system infrastructure. On a manual installation the system owner installs and updates it.',
  x_key_missing: 'Press "Pair again" below (system administrator). Arx will create a new pairing code.',
  x_key_unreadable: 'Press "Pair again" below (system administrator). Arx will create a new pairing code in place of the key that cannot be decrypted.',
  x_key_rotated: 'Press "Pair again" below (system administrator) and leave "Turn off bridge key rotation" checked. The new code goes back to the bridge, and WisKey will accept it.',
  x_refused: 'If the bridge sends updates (the first row is fine): restart the system infrastructure and make sure there is only one SMPLWISE Bridge integration. If the bridge is silent - pair again (below).',
  x_probe_key: 'Fix "Pairing key" first.',
  x_unreachable: 'Make sure WisKey is loaded in the system infrastructure and is version 2.0.1 or later. On a manual installation the system owner updates WisKey. Meanwhile Arx tries the signed path through the system infrastructure.',
  x_probe_error: 'Press "Check the signed connection" again. If it happens again - check that the system infrastructure is available.',
  x_probe_not_run: 'Press "Check the signed connection".',
  x_discovery_talk_missing: 'Update WisKey to a version that publishes the talk commands (on a manual installation - the system owner).',
  x_discovery_media_missing: 'Update WisKey to a version that publishes the station media commands (on a manual installation - the system owner).',
  x_discovery_unknown: 'Press "Check the signed connection".',
  x_discovery_clock: 'Synchronise the clock of the the system infrastructure server (NTP). Arx does not move its own clock.',
  x_provider_local: 'In Settings › Entrance screen switches › Video and talk source: choose "WisKey (video and talk)".',
  x_provider_feed_gate: 'This does not depend on the pairing: an update is needed - either WisKey also publishes the media commands in the command list of the service channel, or Arx chooses by the signed discovery. An open development item, not an action for the system owner.',
  x_provider_feed_no_talk: 'As in the row above: an update of the command list in the service channel or of the choice of Arx is needed. An open development item.',
  x_rotation_risk: 'Do not press "Rotate key" on the bridge key card while WisKey is in use. The rotation can be turned off there, or when pairing again below.',
  x_rotation_done: 'Pairing again (below) brings back an original pairing code.',
  x_error: 'See the row marked in red above.',
  x_events_off: 'Resuming events was turned off on purpose in the installation\'s server settings. To turn it on again - contact support.',
  x_events_not_run: 'Arx reads the events as soon as the service channel to WisKey is ready. If this goes on - check the rows above.',
  x_events_gap: 'There is nothing to fix in Arx: the events in the range can be seen in the entry log (as long as WisKey keeps them). The row returns to normal 7 days after the gap.',
  x_events_unsupported: 'Update WisKey to a version that publishes a continuous resume of events (on a manual installation - the system owner).',
  x_events_failed: 'If it happens again: check the rows "Pairing key" and "WisKey accepts the key" above.',
  // steps outside Arx: s_<code> (STEP; {url} = addon_url)
  s_entry_single: 'In the system infrastructure: Settings › Devices & services › SMPLWISE Bridge - make sure there is only one entry and that it is loaded.',
  s_restart_infra: 'Restart the system infrastructure (WisKey reads the pairing code from the bridge when it loads).',
  s_check_again: 'Come back here and press "Check the signed connection".',
  s_update_wiskey: 'Updating WisKey is an action of the system owner (manual installation, policy B): install the approved WisKey version (2.0.1 or later) and restart the system infrastructure.',
  s_provider_choose: 'In Settings › Entrance screen switches › Video and talk source: "WisKey (video and talk)".',
  s_announced_sent: 'The new code was sent to the existing bridge: the bridge checks it with Arx and replaces it by itself, without approval. If the bridge is not set up yet - the system infrastructure shows a request to add SMPLWISE Bridge; approve it.',
  s_announced_wait: 'Wait a minute until the bridge sends a signed update (the row "Arx bridge" turns normal).',
  s_announced_check: 'Press "Check the signed connection".',
  s_manual_delete: 'In the system infrastructure: Settings › Devices & services › SMPLWISE Bridge › the three dots › Delete. Before that, write down the options set on it (service user, save delegation, permissions to operate): they are deleted with the entry.',
  s_manual_add: 'Add integration › SMPLWISE Bridge.',
  s_manual_url: 'Address: {url} · pairing code: the code shown here.',
  // values that are words: v_<param>_<code>
  v_since_pairing: 'the pairing',
  v_video_yes: 'yes',
  v_video_no: 'no',
  v_talk_yes: 'yes',
  v_talk_no: 'no',
  v_start_unknown: 'unknown',
  v_caught_until: 'Arx is up to date until {caught_at}.',
  v_caught_not_yet: 'Not yet at the end of WisKey\'s list.',
  v_why_first_start: 'Arx started without a resume point',
  v_why_source_replaced: 'WisKey was reinstalled or its event store was reset',
  v_why_source_mismatch: 'WisKey\'s event store changed',
  v_why_cursor_ahead: 'WisKey\'s history went back (a restore)',
  v_why_retention_gap: 'the resume point is too old: WisKey already deleted the events after it',
  v_why_cursor_invalid: 'WisKey did not recognise the resume point',
  v_code_direct_connect_refused: 'WisKey closed the connection without an answer - it did not verify the signature.',
  v_code_reply_unauthenticated: 'WisKey\'s answer is not signed with the key of Arx.',
  v_code_direct_identity_invalid: 'WisKey returned an identity in an unknown format.',
  v_code_direct_unreachable: 'The WisKey direct connection did not open.',
  v_code_direct_hello_timeout: 'WisKey did not open the direct connection in time.',
  v_code_direct_hello_invalid: 'The opening of the WisKey direct connection is in an unknown format.',
  v_code_direct_connect_timeout: 'WisKey did not answer the connection request in time.',
  v_code_direct_connect_failed: 'The direct connection failed.',
  v_code_bridge_not_paired: 'There is no pairing key.',
  v_code_bridge_key_rotated: 'The key was replaced, and WisKey does not accept a replaced key.',
  v_code_outcome_unknown: 'No answer arrived in time.',
  v_code_connection_closed: 'The connection closed midway.',
  v_code_probe_timeout: 'The check did not finish in time.',
  v_code_clock_skew: 'The clocks are too far apart.',
  // the link of the provider line (PROVIDER_ROW)
  link_providerRow: 'Video and talk source',
};

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
