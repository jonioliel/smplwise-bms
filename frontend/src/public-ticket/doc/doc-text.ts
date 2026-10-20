/**
 * CR-VENDORQ-294: the words of the document page (a report sent by a temporary link, `#d.<token>`), in the public page's four languages.
 *
 * ARABIC AND RUSSIAN: written by the developer, NOT yet checked by a native speaker (dev-marked, like the rest of the public page).
 */
import type { Lang } from '../strings';

const he = {
  title: 'מסמך',
  lead: 'נשלח אליכם מסמך. אפשר להוריד אותו עד {until}.',
  size: 'גודל: {size}',
  left: 'הורדות שנותרו: {n}',
  download: 'הורדת המסמך',
  done: 'המסמך הורד.',
  usedUp: 'ההורדות לקישור הזה נוצלו.',
  rateLimited: 'יותר מדי ניסיונות. נסו שוב בעוד דקה.',
  offline: 'אין חיבור. בדקו את הקליטה ונסו שוב.',
  error: 'משהו השתבש. נסו שוב.',
};

type DocKey = keyof typeof he;

const en: Record<DocKey, string> = {
  title: 'Document',
  lead: 'A document was sent to you. You can download it until {until}.',
  size: 'Size: {size}',
  left: 'Downloads left: {n}',
  download: 'Download the document',
  done: 'The document was downloaded.',
  usedUp: 'The downloads of this link are used up.',
  rateLimited: 'Too many attempts. Please try again in a minute.',
  offline: 'No connection. Check your reception and try again.',
  error: 'Something went wrong. Please try again.',
};

const ar: Record<DocKey, string> = {
  title: 'مستند',
  lead: 'تم إرسال مستند إليك. يمكنك تنزيله حتى {until}.',
  size: 'الحجم: {size}',
  left: 'التنزيلات المتبقية: {n}',
  download: 'تنزيل المستند',
  done: 'تم تنزيل المستند.',
  usedUp: 'تم استنفاد التنزيلات لهذا الرابط.',
  rateLimited: 'محاولات كثيرة جدًا. حاول مرة أخرى بعد دقيقة.',
  offline: 'لا يوجد اتصال. تحقق من الإشارة وحاول مرة أخرى.',
  error: 'حدث خطأ ما. حاول مرة أخرى.',
};

const ru: Record<DocKey, string> = {
  title: 'Документ',
  lead: 'Вам отправлен документ. Его можно скачать до {until}.',
  size: 'Размер: {size}',
  left: 'Осталось скачиваний: {n}',
  download: 'Скачать документ',
  done: 'Документ скачан.',
  usedUp: 'Скачивания по этой ссылке исчерпаны.',
  rateLimited: 'Слишком много попыток. Повторите через минуту.',
  offline: 'Нет соединения. Проверьте связь и повторите.',
  error: 'Что-то пошло не так. Повторите попытку.',
};

export const DOC_TEXT: Readonly<Record<Lang, Record<DocKey, string>>> = { he, en, ar, ru };
export const DEV_MARKED: readonly Lang[] = ['ar', 'ru'];
export type { DocKey };

/** One string: the language's text (Hebrew when missing), then its `{var}` values (a value is never read as a placeholder). */
export function dt(lang: Lang, key: DocKey, vars: Record<string, string> = {}): string {
  const raw = DOC_TEXT[lang]?.[key] ?? he[key];
  return raw.replace(/\{([a-z]+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

/** A size in the units people read (pure; unit-tested). */
export function sizeText(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The only file names the page ever gives a download: the server's own `[A-Za-z0-9._-]` name ending .pdf / .html, else a fixed one. */
export function safeName(name: unknown, type: unknown): string {
  const fallback = type === 'text/html' ? 'document.html' : 'document.pdf';
  return typeof name === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,75}\.(pdf|html)$/.test(name) ? name : fallback;
}
