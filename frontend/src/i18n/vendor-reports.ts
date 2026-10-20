/**
 * VENDORQ2-295: the strings of Settings > the module > message channel > "Reports to vendors" (`<tickets-reports-settings>`): the switch
 * for a module's reports to external contacts through the message queue, the e-mail channel and the documents sent by a temporary link
 * (CR-VENDORQ-294). A settings page may name WhatsApp and e-mail; the home platform is never named. Hebrew first; English, Arabic and
 * Russian columns follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL
 * translation and need a native review. No explanatory paragraphs (clean operator screens): labels and units only.
 */
const he = {
  title: 'דוחות לספקים',
  toContacts: 'שליחת דוחות לאנשי קשר חיצוניים',
  email: 'שליחה גם במייל',
  documents: 'מסמך בקישור זמני',
  hours: 'תוקף הקישור',
  hoursUnit: 'שעות',
  opens: 'הורדות לקישור',
  opensUnit: 'פעמים',
  save: 'שמירה',
  saved: 'נשמר',
  failed: 'השמירה נכשלה',
};

type Key = keyof typeof he;

const en: Record<Key, string> = {
  title: 'Reports to vendors',
  toContacts: 'Send reports to external contacts',
  email: 'Also send by e-mail',
  documents: 'Document by temporary link',
  hours: 'Link validity',
  hoursUnit: 'hours',
  opens: 'Downloads per link',
  opensUnit: 'times',
  save: 'Save',
  saved: 'Saved',
  failed: 'Saving failed',
};

const ar: Record<Key, string> = {
  title: 'التقارير إلى الموردين',
  toContacts: 'إرسال التقارير إلى جهات اتصال خارجية',
  email: 'الإرسال أيضًا بالبريد الإلكتروني',
  documents: 'مستند برابط مؤقت',
  hours: 'مدة صلاحية الرابط',
  hoursUnit: 'ساعة',
  opens: 'عدد التنزيلات لكل رابط',
  opensUnit: 'مرات',
  save: 'حفظ',
  saved: 'تم الحفظ',
  failed: 'فشل الحفظ',
};

const ru: Record<Key, string> = {
  title: 'Отчёты поставщикам',
  toContacts: 'Отправка отчётов внешним контактам',
  email: 'Отправлять также по e-mail',
  documents: 'Документ по временной ссылке',
  hours: 'Срок действия ссылки',
  hoursUnit: 'ч',
  opens: 'Загрузок на ссылку',
  opensUnit: 'раз',
  save: 'Сохранить',
  saved: 'Сохранено',
  failed: 'Не удалось сохранить',
};

export type VrtKey = Key;
export type VrtLang = 'he' | 'en' | 'ar' | 'ru';

export function vrtLang(): VrtLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

export const VRT_TABLES: Record<VrtLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
export const VRT_KEYS = Object.keys(he) as Key[];

export function vrt(key: Key, lang: VrtLang = vrtLang()): string {
  return VRT_TABLES[lang][key] ?? he[key] ?? key;
}
