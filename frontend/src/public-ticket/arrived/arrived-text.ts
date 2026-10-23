/**
 * VENDORARRIVAL126-295: the words of the "I have arrived" card on the vendor's page, in the page's four languages (he / en; ar / ru are
 * an initial translation that needs a native speaker's review, like the other vendor texts). Server codes only on the wire; the
 * sentences are here.
 */
import type { Lang } from '../strings';

const HE = {
  title: 'הגעה לאתר',
  expected: 'מועד הגעה צפוי: {from} – {to}',
  late: 'המועד הצפוי עבר. עדכנו את המנהל שהגעתם, או פנו אליו אם התעכבתם.',
  open: 'הגעתם לאתר? לחיצה אחת מעדכנת את המנהל.',
  button: 'הגעתי לאתר',
  sending: 'שולח…',
  arrived: 'הגעה נרשמה ב-{at}',
  access: 'נדרש קוד כניסה? בקשו אותו בכרטיס "כניסה לאתר" למטה. מנהל מאשר כל בקשה.',
  errOffline: 'אין חיבור. נסו שוב.',
  errGeneric: 'הדיווח לא נשלח. נסו שוב.',
};
type Key = keyof typeof HE;

const EN: Record<Key, string> = {
  title: 'Arrival on site',
  expected: 'Expected arrival: {from} – {to}',
  late: 'The expected time has passed. Tell the manager you arrived, or contact him if you are delayed.',
  open: 'Arrived on site? One tap lets the manager know.',
  button: 'I have arrived',
  sending: 'Sending…',
  arrived: 'Arrival recorded at {at}',
  access: 'Need an entry code? Request it in the "Site access" card below. A manager approves every request.',
  errOffline: 'No connection. Try again.',
  errGeneric: 'The report was not sent. Try again.',
};

const AR: Record<Key, string> = {
  title: 'الوصول إلى الموقع',
  expected: 'موعد الوصول المتوقع: {from} – {to}',
  late: 'انقضى الموعد المتوقع. أبلغوا المدير بوصولكم، أو تواصلوا معه إذا تأخرتم.',
  open: 'وصلتم إلى الموقع؟ ضغطة واحدة تُعلم المدير.',
  button: 'وصلت إلى الموقع',
  sending: 'جارٍ الإرسال…',
  arrived: 'تم تسجيل الوصول في {at}',
  access: 'تحتاجون رمز دخول؟ اطلبوه من بطاقة "الدخول إلى الموقع" أدناه. يوافق المدير على كل طلب.',
  errOffline: 'لا يوجد اتصال. حاولوا مرة أخرى.',
  errGeneric: 'لم يُرسل البلاغ. حاولوا مرة أخرى.',
};

const RU: Record<Key, string> = {
  title: 'Прибытие на объект',
  expected: 'Ожидаемое время прибытия: {from} – {to}',
  late: 'Ожидаемое время прошло. Сообщите менеджеру, что вы прибыли, или свяжитесь с ним, если задерживаетесь.',
  open: 'Вы на объекте? Одно нажатие сообщит менеджеру.',
  button: 'Я прибыл',
  sending: 'Отправка…',
  arrived: 'Прибытие отмечено в {at}',
  access: 'Нужен код входа? Запросите его в карточке «Доступ на объект» ниже. Каждый запрос утверждает менеджер.',
  errOffline: 'Нет соединения. Попробуйте ещё раз.',
  errGeneric: 'Сообщение не отправлено. Попробуйте ещё раз.',
};

export type ArrivedKey = Key;
const TEXT: Record<Lang, Record<Key, string>> = { he: HE, en: EN, ar: AR, ru: RU };

export function art(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  const s = (TEXT[lang] ?? HE)[key] ?? HE[key];
  return s.replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
