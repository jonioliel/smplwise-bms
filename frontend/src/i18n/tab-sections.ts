/**
 * TABSET-293: the words of the tab registry (הגדרות › כללי › לשוניות): one card per navigation section - its name and the surface it
 * shows on - plus the short notes the editor adds under a card. Hebrew first; English, Arabic and Russian columns follow the document
 * language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native review
 * (dev-marked). `{name}` placeholders are filled by `tst(key, { name })`. Operator wording only: no platform name.
 */
const he = {
  areasLabel: 'ניווט ראשי',
  areasWhere: 'סרגל הצד ופס הניווט התחתון',
  devicesLabel: 'ראשי',
  devicesWhere: 'לשוניות המסך הראשי',
  securityLabel: 'אבטחה',
  securityWhere: 'הבחירה בראש אזור האבטחה',
  securityLiveLabel: 'אבטחה ‹ לייב',
  securityLiveWhere: 'לשוניות לייב',
  securityInvestigateLabel: 'אבטחה ‹ חקירה',
  securityInvestigateWhere: 'לשוניות חקירה',
  exploreLabel: 'מפה',
  exploreWhere: 'לשוניות המפה',
  multimediaLabel: 'מולטימדיה',
  multimediaWhere: 'לשוניות המולטימדיה',
  wiskeyLabel: 'WisKey',
  wiskeyWhere: 'לשוניות WisKey',
  infraLabel: 'תשתיות',
  infraWhere: 'לשוניות התשתיות',
  infraElectricityLabel: 'תשתיות ‹ מוני חשמל',
  infraElectricityWhere: 'דפי מוני החשמל',
  infraGeneratorLabel: 'תשתיות ‹ גנרטור',
  infraGeneratorWhere: 'דפי הגנרטור',
  ticketsWhere: 'לשוניות {name}',
  systemLabel: 'הגדרות',
  systemWhere: 'לשוניות ההגדרות',
  systemSecurityLabel: 'הגדרות ‹ אבטחה',
  systemSecurityWhere: 'לשוניות אבטחה בהגדרות',
  noteOffered: 'לשונית מוצגת רק כשיש במערכת פריטים מסוגה; עד אז היא שומרת את המקום שנקבע לה.',
  level1Hint: 'הסרגל הראשון של כל אזור',
  level2Hint: 'הדפים של לייב, חקירה ותשתיות, ואבטחה בהגדרות',
};

type Key = keyof typeof he;

const en: Record<Key, string> = {
  areasLabel: 'Main navigation',
  areasWhere: 'The side rail and the bottom bar',
  devicesLabel: 'Home',
  devicesWhere: 'The home screen tabs',
  securityLabel: 'Security',
  securityWhere: 'The switch at the top of the security area',
  securityLiveLabel: 'Security › Live',
  securityLiveWhere: 'The live tabs',
  securityInvestigateLabel: 'Security › Investigation',
  securityInvestigateWhere: 'The investigation tabs',
  exploreLabel: 'Map',
  exploreWhere: 'The map tabs',
  multimediaLabel: 'Multimedia',
  multimediaWhere: 'The multimedia tabs',
  wiskeyLabel: 'WisKey',
  wiskeyWhere: 'The WisKey tabs',
  infraLabel: 'Infrastructure',
  infraWhere: 'The infrastructure tabs',
  infraElectricityLabel: 'Infrastructure › Electricity meters',
  infraElectricityWhere: 'The electricity meter pages',
  infraGeneratorLabel: 'Infrastructure › Generator',
  infraGeneratorWhere: 'The generator pages',
  ticketsWhere: 'The {name} tabs',
  systemLabel: 'Settings',
  systemWhere: 'The settings tabs',
  systemSecurityLabel: 'Settings › Security',
  systemSecurityWhere: 'The security tabs in settings',
  noteOffered: 'A tab shows only once the system has items of its kind; until then it keeps the place set for it.',
  level1Hint: 'The first bar of every area',
  level2Hint: 'The live, investigation and infrastructure pages, and security in settings',
};

// initial translation - needs a native review (dev-marked)
const ar: Record<Key, string> = {
  areasLabel: 'التنقل الرئيسي',
  areasWhere: 'الشريط الجانبي وشريط التنقل السفلي',
  devicesLabel: 'الرئيسية',
  devicesWhere: 'علامات تبويب الشاشة الرئيسية',
  securityLabel: 'الأمن',
  securityWhere: 'الاختيار في أعلى منطقة الأمن',
  securityLiveLabel: 'الأمن ‹ مباشر',
  securityLiveWhere: 'علامات تبويب البث المباشر',
  securityInvestigateLabel: 'الأمن ‹ تحقيق',
  securityInvestigateWhere: 'علامات تبويب التحقيق',
  exploreLabel: 'الخريطة',
  exploreWhere: 'علامات تبويب الخريطة',
  multimediaLabel: 'الوسائط المتعددة',
  multimediaWhere: 'علامات تبويب الوسائط المتعددة',
  wiskeyLabel: 'WisKey',
  wiskeyWhere: 'علامات تبويب WisKey',
  infraLabel: 'البنية التحتية',
  infraWhere: 'علامات تبويب البنية التحتية',
  infraElectricityLabel: 'البنية التحتية ‹ عدادات الكهرباء',
  infraElectricityWhere: 'صفحات عدادات الكهرباء',
  infraGeneratorLabel: 'البنية التحتية ‹ المولد',
  infraGeneratorWhere: 'صفحات المولد',
  ticketsWhere: 'علامات تبويب {name}',
  systemLabel: 'الإعدادات',
  systemWhere: 'علامات تبويب الإعدادات',
  systemSecurityLabel: 'الإعدادات ‹ الأمن',
  systemSecurityWhere: 'علامات تبويب الأمن في الإعدادات',
  noteOffered: 'تظهر علامة التبويب فقط عندما توجد في النظام عناصر من نوعها؛ وحتى ذلك الحين تحتفظ بالمكان المحدد لها.',
  level1Hint: 'الشريط الأول في كل منطقة',
  level2Hint: 'صفحات البث المباشر والتحقيق والبنية التحتية، والأمن في الإعدادات',
};

// initial translation - needs a native review (dev-marked)
const ru: Record<Key, string> = {
  areasLabel: 'Главная навигация',
  areasWhere: 'Боковая панель и нижняя панель навигации',
  devicesLabel: 'Главная',
  devicesWhere: 'Вкладки главного экрана',
  securityLabel: 'Безопасность',
  securityWhere: 'Переключатель вверху раздела безопасности',
  securityLiveLabel: 'Безопасность › Прямой эфир',
  securityLiveWhere: 'Вкладки прямого эфира',
  securityInvestigateLabel: 'Безопасность › Расследование',
  securityInvestigateWhere: 'Вкладки расследования',
  exploreLabel: 'Карта',
  exploreWhere: 'Вкладки карты',
  multimediaLabel: 'Мультимедиа',
  multimediaWhere: 'Вкладки мультимедиа',
  wiskeyLabel: 'WisKey',
  wiskeyWhere: 'Вкладки WisKey',
  infraLabel: 'Инфраструктура',
  infraWhere: 'Вкладки инфраструктуры',
  infraElectricityLabel: 'Инфраструктура › Электросчётчики',
  infraElectricityWhere: 'Страницы электросчётчиков',
  infraGeneratorLabel: 'Инфраструктура › Генератор',
  infraGeneratorWhere: 'Страницы генератора',
  ticketsWhere: 'Вкладки раздела «{name}»',
  systemLabel: 'Настройки',
  systemWhere: 'Вкладки настроек',
  systemSecurityLabel: 'Настройки › Безопасность',
  systemSecurityWhere: 'Вкладки безопасности в настройках',
  noteOffered: 'Вкладка показывается, только когда в системе есть элементы её типа; до тех пор она сохраняет заданное ей место.',
  level1Hint: 'Первая панель каждого раздела',
  level2Hint: 'Страницы прямого эфира, расследования и инфраструктуры, а также безопасность в настройках',
};

export type TstKey = Key;
export type TstLang = 'he' | 'en' | 'ar' | 'ru';

export function tstLang(): TstLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<TstLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const TST_DEV_MARKED: readonly TstLang[] = ['ar', 'ru'];

export function tst(key: Key, vars?: Record<string, string | number>, lang: TstLang = tstLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const TST_KEYS = Object.keys(he) as Key[];
export const TST_TABLES = TABLES;
