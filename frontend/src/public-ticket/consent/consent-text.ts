/**
 * WA-CONSENT-LINK: the words of the WhatsApp consent page, in the public page's four languages (he and ar right to left, en and ru left
 * to right). The NOTICE text is versioned on the server (services/intercom_consent.py NOTICE_VERSION): a change of its meaning bumps the
 * version there, so the version stored with a consent is the text the person read.
 *
 * ARABIC AND RUSSIAN: written by the developer, NOT yet checked by a native speaker (dev-marked, like the rest of the public page).
 */
import type { Lang } from '../strings';

const he = {
  title: 'הודעות וואטסאפ',
  notice: '{org} מבקשת לשלוח לך הודעות וואטסאפ בנושא הגישה שלך: כרטיס כניסה, תוקף וסגירת כניסה.',
  noCode: 'ההודעות לעולם לא יכילו קוד גישה או סיסמה.',
  revoke: 'אפשר לבקש להפסיק את ההודעות בכל עת דרך {org}.',
  approve: 'מאשר/ת לקבל הודעות',
  decline: 'לא, תודה',
  approved: 'תודה, האישור נשמר.',
  declined: 'בחירתך נשמרה. לא יישלחו אליך הודעות.',
  close: 'אפשר לסגור את הדף.',
  rateLimited: 'יותר מדי ניסיונות. נסו שוב בעוד דקה.',
  offline: 'אין חיבור. בדקו את הקליטה ונסו שוב.',
  error: 'משהו השתבש. נסו שוב.',
};

type ConsentKey = keyof typeof he;

const en: Record<ConsentKey, string> = {
  title: 'WhatsApp messages',
  notice: '{org} asks to send you WhatsApp messages about your access: entry card, validity and entrance closures.',
  noCode: 'The messages will never contain an access code or a password.',
  revoke: 'You can ask to stop the messages at any time through {org}.',
  approve: 'I agree to receive messages',
  decline: 'No, thanks',
  approved: 'Thank you, your consent was saved.',
  declined: 'Your choice was saved. You will not receive messages.',
  close: 'You can close this page.',
  rateLimited: 'Too many attempts. Please try again in a minute.',
  offline: 'No connection. Check your reception and try again.',
  error: 'Something went wrong. Please try again.',
};

const ar: Record<ConsentKey, string> = {
  title: 'رسائل واتساب',
  notice: 'تطلب {org} إرسال رسائل واتساب إليك بخصوص دخولك: بطاقة الدخول، الصلاحية وإغلاق المدخل.',
  noCode: 'لن تحتوي الرسائل أبدًا على رمز دخول أو كلمة مرور.',
  revoke: 'يمكنك طلب إيقاف الرسائل في أي وقت عن طريق {org}.',
  approve: 'أوافق على تلقي الرسائل',
  decline: 'لا، شكرًا',
  approved: 'شكرًا، تم حفظ موافقتك.',
  declined: 'تم حفظ اختيارك. لن تصلك رسائل.',
  close: 'يمكنك إغلاق الصفحة.',
  rateLimited: 'محاولات كثيرة جدًا. حاول مرة أخرى بعد دقيقة.',
  offline: 'لا يوجد اتصال. تحقق من الإشارة وحاول مرة أخرى.',
  error: 'حدث خطأ ما. حاول مرة أخرى.',
};

const ru: Record<ConsentKey, string> = {
  title: 'Сообщения WhatsApp',
  notice: '{org} просит разрешения присылать вам сообщения WhatsApp о вашем доступе: карта входа, срок действия и закрытие входа.',
  noCode: 'Сообщения никогда не будут содержать код доступа или пароль.',
  revoke: 'Вы можете в любое время попросить прекратить сообщения через {org}.',
  approve: 'Я согласен(на) получать сообщения',
  decline: 'Нет, спасибо',
  approved: 'Спасибо, согласие сохранено.',
  declined: 'Ваш выбор сохранён. Сообщения отправляться не будут.',
  close: 'Эту страницу можно закрыть.',
  rateLimited: 'Слишком много попыток. Повторите через минуту.',
  offline: 'Нет соединения. Проверьте связь и повторите.',
  error: 'Что-то пошло не так. Повторите попытку.',
};

export const CONSENT_TEXT: Readonly<Record<Lang, Record<ConsentKey, string>>> = { he, en, ar, ru };
export const DEV_MARKED: readonly Lang[] = ['ar', 'ru'];
export type { ConsentKey };

/** One string: the language's text (Hebrew when missing), then the `{org}` variable (a value is never read as a token). */
export function ct(lang: Lang, key: ConsentKey, vars: Record<string, string> = {}): string {
  const raw = CONSENT_TEXT[lang]?.[key] ?? he[key];
  return raw.replace(/\{([a-z]+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}
