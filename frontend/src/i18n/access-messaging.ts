/**
 * CR-036 WA: the strings of the Settings page "הודעות" (Settings > access control > messages): the administrator's switches, limits and
 * the approved templates. Hebrew, one flat dictionary with a lookup (the pattern of access-people.ts): an unknown key answers the key
 * itself, so a typo is visible in the screen rather than blank. A Settings page keeps the technical truth, but the platform is still not
 * named here (UI_COPY_RULES): the area is "בקרת כניסה", the service is "שירות ההודעות". `{name}` style placeholders are filled by
 * `mt(key, { name: ... })`; the two curly-brace words of the TEMPLATES themselves ({name}, {organization}) are literal text in the
 * strings that mention them (they are only replaced when a variable of that name is passed).
 */
import { docLang, fill, registerCatalogue } from './core';
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
  'service.account_not_covered': 'החשבון שנבחר לא נכלל ברשימה שהתקבלה כרגע משירות ההודעות (הרשימה מוגבלת) · נסו שוב או בחרו חשבון אחר',
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

  // ---- consent by link (WA-CONSENT-LINK)
  'consent.title': 'אישור קבלת הודעות בקישור',
  'consent.sub': 'כשהאפשרות מופעלת, ההודעה הראשונה לאדם שלא ידוע אם הסכים היא בקשת אישור עם קישור. ההודעה המבוקשת נשלחת רק אחרי שהאדם אישר.',
  'consent.switch': 'בקשת אישור לפני ההודעה הראשונה',
  'consent.on': 'מופעל · אדם שלא אישר מקבל קודם בקשת אישור',
  'consent.off': 'כבוי · אפשר לשלוח גם למי שלא ידוע אם הסכים',
  'consent.wait': 'ימים להמתנה לתשובה',
  'consent.wait_hint': 'בין {min} ל־{max} · בלי תשובה ההודעה לא נשלחת והשולח מקבל התראה',
  'consent.language': 'שפת בקשת האישור',
  'consent.lang.he': 'עברית',
  'consent.lang.en': 'אנגלית',
  'consent.lang.ar': 'ערבית (טיוטה)',
  'consent.lang.ru': 'רוסית (טיוטה)',
  'consent.wa_template': 'שם התבנית המאושרת בוואטסאפ',
  'consent.wa_template_hint': 'לפנייה ראשונה. אישור התבנית מול וואטסאפ נעשה על ידי בעל החשבון',
  'consent.wa_language': 'קוד השפה של התבנית',
  'consent.rules': 'בקשת אישור אחת לאדם בכל {days} יום · עד {held} הודעות ממתינות לאדם',
  'consent.problem.module_off': 'הדף הציבורי כבוי · אי אפשר לשלוח בקשת אישור',
  'consent.problem.public_page': 'הדף הציבורי אינו זמין או שאין לו כתובת · אי אפשר לשלוח בקשת אישור',
  'consent.problem.key': 'מפתח הקישורים חסר · אי אפשר לשלוח בקשת אישור',
  'err.bad_name': 'אותיות לטיניות קטנות, ספרות וקו תחתון בלבד',
  'err.bad_language': 'קוד שפה לא תקין (למשל he או en_US)',
  'err.template_send_unsupported': 'שליחת תבנית וואטסאפ מאושרת עדיין אינה נתמכת - השאירו ריק',
  'consent.no_template': 'בקשת האישור נשלחת כהודעת טקסט רגילה. שליחה בתבנית וואטסאפ מאושרת עדיין אינה נתמכת, ולכן אדם שלא כתב לחשבון ב־24 השעות האחרונות עלול לא לקבל אותה',

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

/** English, used when the document language is English (a key missing here falls back to the Hebrew). */
const en: Partial<Record<MessagingKey, string>> = {
  'segment': 'Messages',
  'segments_label': 'Messages',
  'title': 'Messages to people',
  'sub': 'Send WhatsApp messages from the people list: approved templates and free text. Each send is recorded in the system log, without the message content.',
  'loading': 'Loading the settings…',
  'load_failed': 'The settings could not be loaded',
  'retry': 'Try again',
  'service.connected': 'The messaging service is connected',
  'service.account': 'Account: {name}',
  'service.not_connected': 'The messaging service is not connected',
  'service.unknown': 'The messaging service status is unknown',
  'service.unsupported': 'The messaging service is not available in this installation',
  'service.account_required': 'There are several accounts · choose which account sends the messages',
  'service.account_missing': 'The selected account no longer exists · choose an account',
  'service.account_not_covered': 'The selected account is not in the list the messaging service sent this time (the list is limited) · try again or choose another account',
  'service.no_account': 'No messaging account is connected',
  'enabled.title': 'Sending messages',
  'enabled.on': 'On · the people screen has a send button for users with permission',
  'enabled.off': 'Off · the people screen has no send button',
  'free.title': 'Free-text message',
  'free.on': 'The sender can write their own message',
  'free.off': 'Only approved templates can be sent',
  'bulk.title': 'Most recipients in one send',
  'bulk.hint': '{min} to {max}',
  'rate.title': 'Messages per hour',
  'rate.hint': 'For the whole system · {min} to {max}',
  'optout.note': 'A "do not message me" request applies to messages sent from here only; only a system administrator can clear it.',
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
  'org.title': 'Organisation name in messages',
  'org.hint': 'Replaces {organization} in the templates',
  'account.title': 'Sending account',
  'account.only': 'The only account',
  'account.choose': 'Choose an account',
  'templates.title': 'Approved templates',
  'templates.sub': '{name} is replaced by the person\'s name and {organization} by the organisation name. A template cannot contain an access code or sign-in details.',
  'templates.empty': 'No templates · senders can write free-text messages only',
  'template.label': 'Template name',
  'template.body': 'Message text',
  'template.counter': '{n}/{max}',
  'template.add': 'Add a template',
  'template.remove': 'Delete the template',
  'template.insert_name': 'Insert the person\'s name',
  'template.insert_org': 'Insert the organisation name',
  'template.new': 'New template',
  'consent.title': 'Consent to messages by link',
  'consent.sub': 'When this is on, the first message to a person whose consent is unknown is a consent request with a link. The requested message is sent only after the person consents.',
  'consent.switch': 'Ask for consent before the first message',
  'consent.on': 'On · a person who has not consented first gets a consent request',
  'consent.off': 'Off · messages can also go to people whose consent is unknown',
  'consent.wait': 'Days to wait for a reply',
  'consent.wait_hint': '{min} to {max} · without a reply the message is not sent and the sender is notified',
  'consent.language': 'Consent request language',
  'consent.lang.he': 'Hebrew',
  'consent.lang.en': 'English',
  'consent.lang.ar': 'Arabic (draft)',
  'consent.lang.ru': 'Russian (draft)',
  'consent.wa_template': 'Approved WhatsApp template name',
  'consent.wa_template_hint': 'For first contact. The account owner gets the template approved with WhatsApp',
  'consent.wa_language': 'Template language code',
  'consent.rules': 'One consent request per person every {days} days · up to {held} messages waiting per person',
  'consent.problem.module_off': 'The public page is off · a consent request cannot be sent',
  'consent.problem.public_page': 'The public page is unavailable or has no address · a consent request cannot be sent',
  'consent.problem.key': 'The link key is missing · a consent request cannot be sent',
  'err.bad_name': 'Lower-case Latin letters, digits and underscores only',
  'err.bad_language': 'Invalid language code (for example he or en_US)',
  'err.template_send_unsupported': 'Sending an approved WhatsApp template is not supported yet - leave it empty',
  'consent.no_template': 'The consent request goes out as a plain text message. An approved WhatsApp template cannot be sent yet, so a person who has not written to the account in the last 24 hours may not receive it',
  'save': 'Save',
  'saving': 'Saving…',
  'revert': 'Discard changes',
  'saved': 'Saved',
  'unsaved': 'There are unsaved changes',
  'invalid': 'Correct the marked fields',
  'save_failed': 'Saving failed',
  'conflict': 'Someone else saved the settings in the meantime',
  'reload': 'Reload',
  'err.empty': 'Required',
  'err.too_long': 'Too long',
  'err.control_chars': 'Contains characters that cannot be used',
  'err.credential': 'An access code or sign-in details cannot be included',
  'err.unknown_placeholder': 'Only {name} and {organization} are allowed between curly braces',
  'err.bad_braces': 'Invalid curly braces',
  'err.too_many_placeholders': 'Too many replacement words in one template',
  'err.organization_missing': 'The template uses the organisation name, which is not set',
  'err.duplicate_label': 'A template with this name already exists',
  'err.range': 'Out of the allowed range',
  'err.type': 'Enter a whole number',
  'err.too_many': 'Too many templates',
  'err.window_invalid': 'Enter a time like 08:00',
  'err.window_across_midnight': 'The start must be earlier than the end',
  'err.window_empty': 'The start and the end are the same',
  'err.other': 'Invalid value',

};

export function messagingLang(): 'he' | 'en' {
  return docLang(['en']);
}

export function mt(key: MessagingKey, vars?: Record<string, string | number>): string {
  const text: string = (messagingLang() === 'en' ? en[key] : undefined) ?? he[key] ?? key;
  return fill(text, vars);
}

const ERROR_KEYS: ReadonlySet<string> = new Set(Object.keys(he).filter((k) => k.startsWith('err.')).map((k) => k.slice(4)));

/** The words of a problem code (the server's or the browser's); an unknown code reads as a plain "invalid value". */
export function problemText(code: string): string {
  return mt(ERROR_KEYS.has(code) ? (`err.${code}` as MessagingKey) : 'err.other');
}

/** Every key, for the test that none is missing (tests/unit-messaging-strings.spec.ts reads the sources). */
export const MESSAGING_KEYS = Object.keys(he) as MessagingKey[];

registerCatalogue('i18n/access-messaging', { he, en });
