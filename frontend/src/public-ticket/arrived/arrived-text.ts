/**
 * VENDORARRIVAL126B-295: the words of the "I have arrived" card on the vendor's page, in the page's four languages (he / en; ar / ru are
 * an initial translation that needs a native speaker's review, like the other vendor texts). Server codes only on the wire; the
 * sentences are here. The card reads the existing visit block (`GET /t/api/ticket` -> `visit`) and presses the existing
 * `POST /t/api/arrived` (services/tickets/visits.py).
 */
import type { Lang } from '../strings';

const HE = {
  title: 'הגעה לאתר',
  expected: 'מועד הגעה צפוי: {from} – {to}',
  late: 'המועד הצפוי עבר. עדכנו את המנהל שהגעתם, או פנו אליו אם התעכבתם.',
  notYet: 'הכפתור יהיה זמין סמוך למועד ההגעה.',
  button: 'הגעתי לאתר',
  sending: 'שולח…',
  arrived: 'הגעה נרשמה ב-{at}',
  reported: 'דיווחתם על הגעה ב-{at}. המנהל יאשר.',
  access: 'נדרש קוד כניסה? בקשו אותו בכרטיס "כניסה לאתר" למטה. מנהל מאשר כל בקשה.',
  errOffline: 'אין חיבור. נסו שוב.',
  errOutside: 'הדיווח אפשרי רק סמוך למועד ההגעה.',
  errGeneric: 'הדיווח לא נשלח. נסו שוב.',
};
type Key = keyof typeof HE;

const EN: Record<Key, string> = {
  title: 'Arrival on site',
  expected: 'Expected arrival: {from} – {to}',
  late: 'The expected time has passed. Tell the manager you arrived, or contact him if you are delayed.',
  notYet: 'The button becomes available close to the expected time.',
  button: 'I have arrived',
  sending: 'Sending…',
  arrived: 'Arrival recorded at {at}',
  reported: 'You reported your arrival at {at}. A manager will confirm.',
  access: 'Need an entry code? Request it in the "Site access" card below. A manager approves every request.',
  errOffline: 'No connection. Try again.',
  errOutside: 'You can report only close to the expected time.',
  errGeneric: 'The report was not sent. Try again.',
};

const AR: Record<Key, string> = {
  title: 'الوصول إلى الموقع',
  expected: 'موعد الوصول المتوقع: {from} – {to}',
  late: 'انقضى الموعد المتوقع. أبلغوا المدير بوصولكم، أو تواصلوا معه إذا تأخرتم.',
  notYet: 'يتوفر الزر قرب موعد الوصول المتوقع.',
  button: 'وصلت إلى الموقع',
  sending: 'جارٍ الإرسال…',
  arrived: 'تم تسجيل الوصول في {at}',
  reported: 'أبلغتم عن وصولكم في {at}. سيؤكد المدير.',
  access: 'تحتاجون رمز دخول؟ اطلبوه من بطاقة "الدخول إلى الموقع" أدناه. يوافق المدير على كل طلب.',
  errOffline: 'لا يوجد اتصال. حاولوا مرة أخرى.',
  errOutside: 'يمكن الإبلاغ فقط قرب موعد الوصول المتوقع.',
  errGeneric: 'لم يُرسل البلاغ. حاولوا مرة أخرى.',
};

const RU: Record<Key, string> = {
  title: 'Прибытие на объект',
  expected: 'Ожидаемое время прибытия: {from} – {to}',
  late: 'Ожидаемое время прошло. Сообщите менеджеру, что вы прибыли, или свяжитесь с ним, если задерживаетесь.',
  notYet: 'Кнопка станет доступна ближе к ожидаемому времени.',
  button: 'Я прибыл',
  sending: 'Отправка…',
  arrived: 'Прибытие отмечено в {at}',
  reported: 'Вы сообщили о прибытии в {at}. Менеджер подтвердит.',
  access: 'Нужен код входа? Запросите его в карточке «Доступ на объект» ниже. Каждый запрос утверждает менеджер.',
  errOffline: 'Нет соединения. Попробуйте ещё раз.',
  errOutside: 'Сообщить можно только ближе к ожидаемому времени.',
  errGeneric: 'Сообщение не отправлено. Попробуйте ещё раз.',
};

export type ArrivedKey = Key;
const TEXT: Record<Lang, Record<Key, string>> = { he: HE, en: EN, ar: AR, ru: RU };

export function art(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  const s = (TEXT[lang] ?? HE)[key] ?? HE[key];
  return s.replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
