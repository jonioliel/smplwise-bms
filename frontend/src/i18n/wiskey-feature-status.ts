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

const en: Record<Key, string> = {
  // reasons
  r_provider_local: 'The video and talk source is set to "Arx (video only)", so the direct connection to WisKey is not started.',
  f_provider_local: 'In Settings › Entrance screen switches › Video and talk source: "WisKey (video and talk)", then restart Arx.',
  r_key_missing: 'There is no pairing key, so Arx does not sign commands to WisKey.',
  f_key_missing: 'Pair again in the "Arx connection to WisKey" block above.',
  r_key_unreadable: 'The bridge key cannot be decrypted on this machine.',
  f_key_unreadable: 'Pair again in the "Arx connection to WisKey" block above.',
  r_key_rotated: 'The bridge key was replaced; the WisKey direct connection (version 1) does not accept a key with a key id.',
  f_key_rotated: 'Pair again in the "Arx connection to WisKey" block above, with bridge key rotation turned off.',
  r_join_not_started: 'The direct connection is not active right now.',
  f_join_not_started: 'Arx starts it by itself, without a restart, when the "Video and talk source" is WisKey and the pairing key is valid; if that does not happen - "Check the signed connection" in the "Arx connection to WisKey" block above.',
  r_join_starting: 'The direct connection is {what} right now.',
  f_join_starting: 'No restart is needed: refresh the page in a moment.',
  r_join_error: 'The direct connection failed ({error}); Arx will try again by itself.',
  f_join_error: '"Check the signed connection" in the "Arx connection to WisKey" block above.',
  r_not_proven: 'It is not proven yet that WisKey accepts the signature of Arx.',
  f_not_proven: '"Check the signed connection" in the "Arx connection to WisKey" block above.',
  r_refused: 'WisKey refused the signature of Arx in the last check.',
  f_refused: 'See the instructions in the "Arx connection to WisKey" block above.',
  r_feed_not_listed: 'Arx chooses WisKey by the command list of the service channel, and the media commands are not listed there ({why}).',
  f_feed_not_listed: 'An open development item: WisKey will publish the media commands in the list, or Arx will choose by the signed discovery. Not an action for the system owner.',
  r_feed_no_talk: 'The command list of the service channel does not have the talk commands.',
  f_feed_no_talk: 'An open development item (as in the video row).',
  r_direct_no_media: 'The signed discovery (direct/capabilities) is missing media commands: {missing}.',
  f_direct_no_media: 'Update WisKey to a version that publishes them (on a manual installation - the system owner).',
  r_no_talk_audio: 'WisKey does not offer the station sound within a call (station_talk_audio) in the signed discovery.',
  f_no_talk_audio: 'Update WisKey (on a manual installation - the system owner).',
  r_media_off: 'The "Station media" switch is off.',
  f_media_off: 'In Settings › Entrance screen switches: Station media - video (or video and talk).',
  r_media_no_talk: 'The "Station media" switch is set to video only.',
  f_media_no_talk: 'In Settings › Entrance screen switches: Station media - video and talk.',
  r_listen_off: 'The "Listen to station" switch is off.',
  f_listen_off: 'In Settings › Entrance screen switches: Listen to station.',
  r_listen_no_downlink: 'WisKey\'s last signed discovery does not offer listening to a station (station_talk_audio with the option media/talk_open.parameters.listen).',
  f_listen_no_downlink: 'Update WisKey to a version that offers it (on a manual installation - the system owner), then "Check the signed connection".',
  r_listen_offer_rejected: 'WisKey offers station_talk_audio in a different shape from the one Arx reads (arx.station_talk_audio.v1, an option, off by default), so Arx does not use it.',
  f_listen_offer_rejected: 'An open item with WisKey; not an action for the system owner.',
  r_listen_unknown: 'It is not known yet whether WisKey offers listening to a station: there is no signed discovery (neither from the direct connection nor from a check).',
  f_listen_unknown: '"Check the signed connection" in the "Arx connection to WisKey" block above.',
  r_policy_b: 'Policy B: Arx does not install or manage WisKey, and the feature is available only on a managed installation.',
  f_policy_b: 'Waiting for the managed installation (in progress, managed installation team). Do not turn on wiskey.auto_install by hand.',
  r_owner_on_not_permitted: 'Turning on the managed installation is blocked in this version (OWNER_ON_PERMITTED).',
  f_owner_on_not_permitted: 'Waiting for a version with the managed installation and the approval of the system owner.',
  r_service_grant_manual: 'On a manual installation WisKey has no writer for the service grant (native_service_grants_v1), so WisKey answers service_grant_required.',
  f_service_grant_manual: 'Solved by the managed installation, or when the system owner sets a service grant in WisKey (per the WisKey instructions).',
  r_not_built: 'The flow is not built in Arx yet (a build constant is off).',
  f_not_built: 'An open development item; there is nothing to turn on right now.',
  r_peer_receipt_off: 'WisKey\'s receipt switch (wiskey.peer_receipt) is off, and reading the peer register is not built.',
  f_peer_receipt_off: 'An open development item; there is nothing to turn on right now.',
  r_acr5_off: 'WisKey\'s read-back switches are off ({on} of 4 on).',
  f_acr5_off: 'Settings › Security › WisKey.',
  r_doors_unmapped: '{count} WisKey doors are not mapped to a relay on a station, and opening them is refused.',
  f_doors_unmapped: 'Settings › Setup › Door mapping: approve the suggestions or map them by hand.',
  r_windows_off: 'Door windows are off (doors.windows.enabled).',
  f_windows_off: 'Door windows › Settings.',
  r_emergency_off: 'Emergency opening is off (doors.emergency.enabled / open_enabled).',
  f_emergency_off: 'Door windows › Emergency (system administrator, with confirmation).',
  r_automation_off: 'Door opening from an automation is off (doors.automation_open).',
  f_automation_off: 'Settings › Setup › Door opening from automations.',
  r_lock_unsupported: 'WisKey marks emergency lock as not supported (emergency_secure_unsupported_v1).',
  f_lock_unsupported: 'Waiting for WisKey.',
  r_template_off: 'Sending WhatsApp templates through WisKey is off (messaging.template_send).',
  f_template_off: 'Messaging settings › WhatsApp templates.',
  r_owner_excluded: 'WisKey\'s dual-approval commands are excluded by the system owner\'s decision (the permissions of Arx are the authority).',
  f_owner_excluded: 'No need to turn it on.',
  r_probe_unknown: 'It is not known whether WisKey accepts the signature (the check did not finish or did not reach WisKey).',
  f_probe_unknown: '"Check the signed connection" again.',
  r_check_failed: 'It cannot be checked right now ({error}).',
  // the direct join's state inside r_join_starting ({what})
  joinState_starting: 'starting',
  joinState_connecting: 'connecting',
  joinState_stopping: 'stopping',
  // rows
  row_direct_api: 'The direct connection to WisKey (discovery, service identity)',
  row_w10_video: 'Station video through WisKey',
  row_w10_talk: 'Two-way talk with a station',
  row_w10_sound: 'Station sound within a call',
  row_listen: 'Listen to a station without a call',
  row_native_people_writes: 'Signed people writes (Native, approval chain)',
  row_service_writer: 'WisKey\'s service writer (create, update, code, temporary suspension)',
  row_readback: 'Read-back of a person\'s permissions from WisKey',
  row_csv_preview: 'A preview validated in WisKey for CSV import',
  row_capture_lease: 'Signed card capture (capture lease)',
  row_door_release: 'Door opening from Arx',
  row_programs_save: 'Saving hold-open programs on the station',
  row_door_windows: 'Door windows',
  row_emergency_open: 'Emergency opening',
  row_emergency_lock: 'Emergency lock',
  row_door_automations: 'Door opening from an automation',
  row_feature_host: 'WisKey\'s feature host',
  row_live_media_feature: 'Live media for features (media ingress)',
  row_template_send: 'Sending WhatsApp templates through WisKey (version 2)',
  row_template_queue: 'Template queue and version 3',
  row_event_cursor: 'Durable event cursor (resume after a disconnect)',
  row_relay_map_stage: 'Handing the relay map to WisKey',
  row_job_approvals: 'WisKey\'s dual approval',
  row_managed_install: 'Managed installation and update of WisKey',
  row_generation_journal: 'Generation journal and maintenance of the installation',
  // groups
  grp_connection: 'Connection',
  grp_media: 'Media and talk',
  grp_people: 'People',
  grp_doors: 'Doors',
  grp_messaging: 'Messaging',
  grp_events: 'Events',
  grp_install: 'Installation',
  // links
  link_accessTab: 'Settings › Entrance screen switches',
  link_setup: 'Settings › Setup',
  link_securityWiskey: 'Settings › Security › WisKey',
  link_doorWindows: 'Door windows',
  link_bridgeTab: 'Settings › Arx bridge',
};

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

export interface WfsReason {
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
