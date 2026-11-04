/**
 * WISKEY-PEOPLE-COMPLETE-2390: the words of the "people on stations only" view, its actions, the people screen's duplicate warning
 * and the editor's PIN check. Hebrew; one flat dictionary with a lookup (the pattern of i18n/access-people.ts): an unknown key answers
 * the key itself. No platform name and no internal code reaches a string a person reads. `{name}` placeholders: `st(key, { name })`.
 */
const he = {
  open: 'בעמדות בלבד',
  title: 'משתמשים שנמצאים רק בעמדות',
  intro: 'משתמשים שרשומים באחת העמדות או יותר, אבל אינם ברשימת האנשים. אפשר לאמץ, להסתיר או למחוק כל אחד מהם.',
  refresh: 'קריאה מחדש מהעמדות',
  reading: 'קורא את העמדות…',
  reading_station: 'קורא את {name}…',
  search: 'חיפוש לפי שם או מספר',
  show_ignored: 'הצגת מוסתרים',
  empty: 'לא נמצאו בעמדות משתמשים שאינם ברשימת האנשים.',
  empty_filtered: 'אין תוצאות לחיפוש.',
  no_stations: 'אין עמדות שבהן מותר לך לנהל אנשים.',
  feed_down: 'בקרת הכניסה אינה זמינה כרגע, ולכן אי אפשר לקרוא את העמדות. נסו שוב בעוד רגע.',
  count: '{n} משתמשים',
  count_one: 'משתמש אחד',
  read_at: 'נקרא {when}',
  cached: 'מהקריאה האחרונה',
  col_name: 'שם בעמדה',
  col_number: 'מספר בעמדה',
  col_stations: 'עמדות',
  col_credentials: 'אמצעי זיהוי',
  col_first_seen: 'נראה לראשונה',
  no_name: 'ללא שם',
  two_names: 'שמות שונים בעמדות',
  pin: 'קוד',
  card: 'כרטיס',
  cards: '{n} כרטיסים',
  face: 'פנים או טביעת אצבע',
  none: 'אין',
  hidden: 'מוסתר',
  hidden_hint: 'אמצעי הזיהוי מוצגים רק עם הרשאה לפרטים רגישים בעמדה.',
  ignored_badge: 'מוסתר',
  station_off: '{name}: לא נקראה ({reason})',
  station_numbers_hidden: '{name}: מספרי המשתמשים בעמדה הזו מוגדרים כפרט רגיש',
  reason_offline: 'העמדה אינה מחוברת',
  reason_busy: 'המערכת עסוקה, נסו שוב בעוד רגע',
  reason_forbidden: 'אין הרשאה לקרוא את העמדה',
  reason_unsupported: 'הגרסה המותקנת אינה תומכת בקריאה הזו',
  reason_generic: 'הקריאה נכשלה',
  // ---- actions
  act_adopt: 'אימוץ',
  act_ignore: 'הסתרה',
  act_unignore: 'ביטול הסתרה',
  act_delete: 'מחיקה מהעמדה',
  actions_for: 'פעולות עבור {name}',
  adopt_title: 'אימוץ משתמש מהעמדה',
  adopt_text: 'ייווצר אדם ברשימת האנשים מתוך המשתמש כפי שהוא רשום בעמדה, כולל הקוד והכרטיסים שלו. שום דבר לא נוצר בעמדה עצמה.',
  adopt_link: 'ברשימת האנשים כבר קיים אדם עם המספר הזה: {name}. האימוץ יקשר אליו את המשתמש בעמדה, בלי ליצור אדם נוסף.',
  adopt_link_hidden: 'ברשימת האנשים כבר קיים אדם עם המספר הזה. האימוץ יקשר אליו את המשתמש בעמדה, בלי ליצור אדם נוסף.',
  adopt_checking: 'בודק אם האדם כבר קיים…',
  adopt_maybe: 'ייתכן שהאדם כבר קיים בשם או בטלפון אחר:',
  adopt_maybe_hidden: 'ייתכן שהאדם כבר קיים ({n} התאמות) ברשומות שאינן בהרשאתך.',
  adopt_maybe_accept: 'בדקתי - זה אדם אחר, לאמץ בכל זאת',
  adopt_check_failed: 'לא ניתן היה לבדוק כפילויות כרגע. האימוץ ייבדק שוב בשרת.',
  adopt_blocked: 'אי אפשר לאמץ את המשתמש כמו שהוא',
  adopt_go: 'אימוץ',
  ignore_title: 'הסתרת משתמש',
  ignore_text: 'המשתמש יוסתר מהרשימה הזו. הוא נשאר בעמדה ויכול להמשיך להיכנס. אפשר לבטל את ההסתרה בכל עת.',
  unignore_title: 'ביטול הסתרה',
  unignore_text: 'המשתמש יחזור להופיע ברשימה.',
  delete_title: 'מחיקת משתמש מהעמדה',
  delete_text: 'המשתמש יימחק מהעמדות שלמטה ולא יוכל עוד להיכנס בהן בקוד, בכרטיס או בפנים. המחיקה מתבצעת בסנכרון ואינה מיידית.',
  delete_type: 'כדי לאשר, הקלידו את מספר המשתמש בעמדה: {n}',
  delete_go: 'מחיקה מהעמדה',
  stations_list: 'עמדות:',
  confirm: 'אישור',
  cancel: 'ביטול',
  close: 'סגירה',
  working: 'שולח…',
  // ---- results
  res_title: 'התוצאה',
  res_ok: 'בוצע',
  res_refused: 'נדחה - לא בוצע',
  res_unknown: 'לא ידוע אם בוצע',
  res_not_sent: 'לא נשלח',
  res_all_ok: 'הפעולה בוצעה בכל העמדות.',
  res_partial: 'הפעולה בוצעה רק בחלק מהעמדות. הפרטים לכל עמדה למטה.',
  res_failed: 'הפעולה לא בוצעה.',
  res_unknown_all: 'לחלק מהעמדות אין תוצאה ברורה. רעננו את הרשימה ובדקו לפני שמנסים שוב.',
  res_pending: 'נשלח - ההסרה מהעמדה תתבצע בסנכרון. רעננו את הרשימה בעוד כמה דקות.',
  res_stored_only: 'הוסתר כאן, אך הסימון בבקרת הכניסה לא עודכן.',
  res_open_person: 'פתיחת האדם',
  // ---- import errors (why a station user cannot be adopted as is)
  imp_unsupported_credentials: 'יש לו פנים או טביעת אצבע בעמדה',
  imp_unmanaged_lock: 'מורשה לדלת שאינה מנוהלת',
  imp_schedule_unverified: 'יש לו לוח זמנים שאי אפשר לאמת',
  imp_pin_device_managed: 'הקוד מנוהל בעמדה עצמה',
  imp_local_validity_needs_conversion: 'התוקף רשום בשעון מקומי',
  imp_device_user_missing: 'כבר לא נמצא בעמדה',
  imp_ignored: 'מוסתר בכל העמדות',
  imp_review_stale: 'השתנה מאז הקריאה - רעננו',
  imp_unknown: 'סיבה לא מוכרת',
  // ---- the people screen's duplicate warning
  dup_strip: 'ייתכן שיש אנשים שרשומים פעמיים ({n} קבוצות)',
  dup_show: 'הצגה',
  dup_hide: 'הסתרה',
  dup_name: 'אותו שם',
  dup_phone: 'אותו טלפון',
  dup_profile: 'אותו ערך ב{label}',
  dup_more: 'ועוד {n}',
  dup_partial: 'הרשימה חלקית.',
  dup_resolve: 'פתחו כל אדם, בדקו אם זה אותו אדם, ותקנו או מחקו את הרשומה הכפולה.',
  // ---- the editor's PIN check
  pin_checking: 'בודק אם הקוד פנוי…',
  pin_free: 'הקוד פנוי כרגע (ייבדק שוב בשמירה).',
  pin_taken: 'הקוד הזה כבר בשימוש אצל אדם אחר. בחרו קוד אחר או צרו קוד פנוי.',
  pin_check_failed: 'לא ניתן היה לבדוק את הקוד כרגע. הוא ייבדק בשמירה.',
  pin_check_limited: 'יותר מדי בדיקות קוד בזמן קצר. הקוד ייבדק בשמירה.',
} as const;

export type StationPeopleKey = keyof typeof he;

export function st(key: StationPeopleKey, vars?: Record<string, string | number>): string {
  const text: string = he[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** A run-time key (`imp_<code>`) or the fallback. */
export function stDynamic(key: string, fallback: StationPeopleKey): string {
  return key in he ? he[key as StationPeopleKey] : he[fallback];
}

export const STATION_PEOPLE_STRINGS: Readonly<Record<string, string>> = he;
