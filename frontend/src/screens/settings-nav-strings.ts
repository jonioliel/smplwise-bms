import type { SettingsNav } from '../shell/tabs-mode';

/**
 * PHONENAV-295 (owner 2026-10-21): the strings of the personal "Settings navigation on phones" card (Settings > General > Tabs).
 * Screen-local on purpose: that card is the only reader. Hebrew is the product language; he / en / ar / ru by the document language.
 */
interface Strs {
  title: string;
  options: Record<SettingsNav, string>;
  saved: string;
}
const STR: Record<'he' | 'en' | 'ar' | 'ru', Strs> = {
  he: { title: 'ניווט בהגדרות בטלפון', options: { tabs: 'שורת לשוניות', dropdown: 'תפריט נפתח' }, saved: 'ההעדפה נשמרה' },
  en: { title: 'Settings navigation on phones', options: { tabs: 'Tab row', dropdown: 'Dropdown' }, saved: 'Preference saved' },
  ar: { title: 'التنقل في الإعدادات على الهاتف', options: { tabs: 'شريط علامات التبويب', dropdown: 'قائمة منسدلة' }, saved: 'تم حفظ التفضيل' },
  ru: { title: 'Навигация по настройкам на телефоне', options: { tabs: 'Строка вкладок', dropdown: 'Выпадающий список' }, saved: 'Настройка сохранена' },
};

export function settingsNavStrings(lang?: string): Strs {
  let l = lang;
  if (l === undefined) {
    try {
      l = document.documentElement.lang || 'he';
    } catch {
      l = 'he'; // no document (unit specs under node)
    }
  }
  const k = l.toLowerCase().slice(0, 2);
  return k === 'en' || k === 'ar' || k === 'ru' ? STR[k] : STR.he;
}
