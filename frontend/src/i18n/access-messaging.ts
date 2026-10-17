/**
 * CR-036 WA: the strings of the Settings page "הודעות" (Settings > access control > messages): the administrator's switches, limits and
 * the approved templates. Hebrew, one flat dictionary with a lookup (the pattern of access-people.ts): an unknown key answers the key
 * itself, so a typo is visible in the screen rather than blank. A Settings page keeps the technical truth, but the platform is still not
 * named here (UI_COPY_RULES): the area is "בקרת כניסה", the service is "שירות ההודעות". `{name}` style placeholders are filled by
 * `mt(key, { name: ... })`; the two curly-brace words of the TEMPLATES themselves ({name}, {organization}) are literal text in the
 * strings that mention them (they are only replaced when a variable of that name is passed).
 */
const he = {
  'segment': 'הודעות',
  'segments_label': 'הודעות',
  'title': 'הודעות לאנשים',
  'sub': 'שליחת הודעות וואטסאפ מרשימת האנשים: תבניות מאושרות והודעה חופשית. השליחה נרשמת ביומן המערכת, בלי תוכן ההודעה.',
  'loading': 'טוען את ההגדרות…',
  'load_failed': 'לא ניתן לטעון את ההגדרות',
  'retry': 'נסה שוב',

  // ---- the service
  'service.connected': 'שירות ההודעות מחובר',
  'service.account': 'חשבון: {name}',
  'service.not_connected': 'שירות ההודעות אינו מחובר',
  'service.unknown': 'מצב שירות ההודעות לא ידוע',
  'service.unsupported': 'שירות ההודעות אינו זמין בהתקנה הזו',
  'service.account_required': 'יש כמה חשבונות · בחרו מאיזה חשבון נשלחות ההודעות',
  'service.account_missing': 'החשבון שנבחר אינו קיים יותר · בחרו חשבון',
  'service.no_account': 'אין חשבון הודעות מחובר',

  // ---- the switches and the limits
  'enabled.title': 'שליחת הודעות',
  'enabled.on': 'מופעל · במסך האנשים יש כפתור שליחה לבעלי ההרשאה',
  'enabled.off': 'כבוי · במסך האנשים אין כפתור שליחה',
  'free.title': 'הודעה חופשית',
  'free.on': 'השולח יכול לכתוב הודעה בעצמו',
  'free.off': 'אפשר לשלוח תבניות מאושרות בלבד',
  'bulk.title': 'נמענים מרבי בשליחה אחת',
  'bulk.hint': 'בין {min} ל־{max}',
  'rate.title': 'מכסת הודעות לשעה',
  'rate.hint': 'לכל המערכת · בין {min} ל־{max}',
  'optout.note': 'בקשת "לא לקבל הודעות" חלה על הודעות שנשלחות מכאן בלבד; רק מנהל מערכת יכול לבטל אותה.',
  'sender.title': 'הודעות לשעה לכל שולח',
  'sender.hint': 'כולל הודעות שנדחו · בין {min} ל־{max}',
  'person.title': 'הודעות ביום לכל נמען',
  'person.hint': 'לפי האדם ולפי מספר הטלפון · בין {min} ל־{max}',
  'station.title': 'הודעות לשעה לאנשי עמדה',
  'station.hint': 'לכל עמדה בנפרד · בין {min} ל־{max}',
  'hours.title': 'שעות שליחה',
  'hours.on': 'הודעות נשלחות רק בין השעות שנבחרו (שעון ההתקנה)',
  'hours.off': 'ללא הגבלת שעות',
  'hours.from': 'משעה',
  'hours.to': 'עד שעה',
  'org.title': 'שם הארגון בהודעות',
  'org.hint': 'מחליף את {organization} בתבניות',
  'account.title': 'חשבון השליחה',
  'account.only': 'החשבון היחיד',
  'account.choose': 'בחרו חשבון',

  // ---- the templates
  'templates.title': 'תבניות מאושרות',
  'templates.sub': '{name} מוחלף בשם האדם ו־{organization} בשם הארגון. אי אפשר לכתוב בתבנית קוד גישה או פרטי כניסה.',
  'templates.empty': 'אין תבניות · השולחים יוכלו לכתוב הודעה חופשית בלבד',
  'template.label': 'שם התבנית',
  'template.body': 'נוסח ההודעה',
  'template.counter': '{n}/{max}',
  'template.add': 'הוספת תבנית',
  'template.remove': 'מחיקת התבנית',
  'template.insert_name': 'הוספת שם האדם',
  'template.insert_org': 'הוספת שם הארגון',
  'template.new': 'תבנית חדשה',

  // ---- saving
  'save': 'שמירה',
  'saving': 'שומר…',
  'revert': 'ביטול שינויים',
  'saved': 'נשמר',
  'unsaved': 'יש שינויים שלא נשמרו',
  'invalid': 'יש לתקן את השדות המסומנים',
  'save_failed': 'השמירה נכשלה',
  'conflict': 'ההגדרות נשמרו בינתיים על ידי מישהו אחר',
  'reload': 'טעינה מחדש',

  // ---- the problems (the server's and the browser's codes)
  'err.empty': 'חובה למלא',
  'err.too_long': 'ארוך מדי',
  'err.control_chars': 'יש תווים שאי אפשר להשתמש בהם',
  'err.credential': 'אי אפשר לכלול קוד גישה או פרטי כניסה',
  'err.unknown_placeholder': 'בין סוגריים מסולסלים מותר {name} ו־{organization} בלבד',
  'err.bad_braces': 'סוגריים מסולסלים לא תקינים',
  'err.too_many_placeholders': 'יותר מדי מילים להחלפה בתבנית אחת',
  'err.organization_missing': 'התבנית משתמשת בשם הארגון והוא לא הוגדר',
  'err.duplicate_label': 'יש כבר תבנית בשם הזה',
  'err.range': 'מחוץ לטווח המותר',
  'err.type': 'יש להזין מספר שלם',
  'err.too_many': 'יותר מדי תבניות',
  'err.window_invalid': 'יש להזין שעה בתבנית 08:00',
  'err.window_across_midnight': 'שעת ההתחלה חייבת להיות לפני שעת הסיום',
  'err.window_empty': 'שעת ההתחלה ושעת הסיום זהות',
  'err.other': 'ערך לא תקין',
} as const;

export type MessagingKey = keyof typeof he;

/** English for the keys added with the 2.6.5 review (the rest of the page falls back to Hebrew until it is translated as a whole). */
const en: Partial<Record<MessagingKey, string>> = {
  'sender.title': 'Messages per sender per hour',
  'sender.hint': 'Refused messages count too · {min} to {max}',
  'person.title': 'Messages per recipient per day',
  'person.hint': 'By person and by phone number · {min} to {max}',
  'station.title': "Messages per hour to a station's people",
  'station.hint': 'Each station separately · {min} to {max}',
  'hours.title': 'Send hours',
  'hours.on': 'Messages go out only between these times (installation time)',
  'hours.off': 'No time restriction',
  'hours.from': 'From',
  'hours.to': 'Until',
  'err.window_invalid': 'Enter a time like 08:00',
  'err.window_across_midnight': 'The start must be earlier than the end',
  'err.window_empty': 'The start and the end are the same',
  'err.range': 'Out of the allowed range',
  'err.type': 'Enter a whole number',
  'err.credential': 'An access code or sign-in details cannot be included',
  'optout.note': 'A "do not message me" request applies to messages sent from here only; only a system administrator can clear it.',
};

export function messagingLang(): 'he' | 'en' {
  return typeof document !== 'undefined' && (document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'he';
}

export function mt(key: MessagingKey, vars?: Record<string, string | number>): string {
  const text: string = (messagingLang() === 'en' ? en[key] : undefined) ?? he[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

const ERROR_KEYS: ReadonlySet<string> = new Set(Object.keys(he).filter((k) => k.startsWith('err.')).map((k) => k.slice(4)));

/** The words of a problem code (the server's or the browser's); an unknown code reads as a plain "invalid value". */
export function problemText(code: string): string {
  return mt(ERROR_KEYS.has(code) ? (`err.${code}` as MessagingKey) : 'err.other');
}

/** Every key, for the test that none is missing (tests/unit-messaging-strings.spec.ts reads the sources). */
export const MESSAGING_KEYS = Object.keys(he) as MessagingKey[];
