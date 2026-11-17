/**
 * TABSET-293: the words of the tab registry (הגדרות › כללי › לשוניות): one card per navigation section - its name and the surface it
 * shows on - plus the short notes the editor adds under a card. Hebrew first; English, Arabic and Russian columns follow the document
 * language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native review
 * (dev-marked). `{name}` placeholders are filled by `tst(key, { name })`. Operator wording only: no platform name.
 */
import { NAV_TST } from './nav-labels'; // CR-NAV-LABELS-2436: the shell's labels live there

const he = {
  areasLabel: NAV_TST.he.areasLabel,
  areasWhere: NAV_TST.he.areasWhere,
  devicesLabel: NAV_TST.he.devicesLabel,
  devicesWhere: NAV_TST.he.devicesWhere,
  securityLabel: NAV_TST.he.securityLabel,
  securityWhere: NAV_TST.he.securityWhere,
  securityLiveLabel: NAV_TST.he.securityLiveLabel,
  securityLiveWhere: NAV_TST.he.securityLiveWhere,
  securityInvestigateLabel: NAV_TST.he.securityInvestigateLabel,
  securityInvestigateWhere: NAV_TST.he.securityInvestigateWhere,
  exploreLabel: NAV_TST.he.exploreLabel,
  exploreWhere: NAV_TST.he.exploreWhere,
  multimediaLabel: NAV_TST.he.multimediaLabel,
  multimediaWhere: NAV_TST.he.multimediaWhere,
  wiskeyLabel: NAV_TST.he.wiskeyLabel,
  wiskeyWhere: NAV_TST.he.wiskeyWhere,
  infraLabel: NAV_TST.he.infraLabel,
  infraWhere: NAV_TST.he.infraWhere,
  infraElectricityLabel: NAV_TST.he.infraElectricityLabel,
  infraElectricityWhere: NAV_TST.he.infraElectricityWhere,
  infraGeneratorLabel: NAV_TST.he.infraGeneratorLabel,
  infraGeneratorWhere: NAV_TST.he.infraGeneratorWhere,
  infraWaterLabel: NAV_TST.he.infraWaterLabel,
  infraWaterWhere: NAV_TST.he.infraWaterWhere,
  ticketsWhere: NAV_TST.he.ticketsWhere,
  ticketsSectionLabel: NAV_TST.he.ticketsSectionLabel,
  ticketsSectionWhere: NAV_TST.he.ticketsSectionWhere,
  ticketsScopesLabel: NAV_TST.he.ticketsScopesLabel,
  ticketsScopesWhere: NAV_TST.he.ticketsScopesWhere,
  ticketsSingleRowLabel: 'שורת המקטעים למי שרואה מקטע אחד',
  ticketsSingleRowHint: 'שורת הדפים של המקטע מוצגת בכל מקרה',
  ticketsSingleRowHide: 'הסתרה (ברירת מחדל)',
  ticketsSingleRowShow: 'הצגה תמיד',
  systemLabel: NAV_TST.he.systemLabel,
  systemWhere: NAV_TST.he.systemWhere,
  systemSecurityLabel: NAV_TST.he.systemSecurityLabel,
  systemSecurityWhere: NAV_TST.he.systemSecurityWhere,
  noteOffered: 'לשונית מוצגת רק כשיש במערכת פריטים מסוגה; עד אז היא שומרת את המקום שנקבע לה.',
  level1Hint: 'הסרגל הראשון של כל אזור',
  level2Hint: 'הדפים של לייב, חקירה ותשתיות, ואבטחה בהגדרות',
};

type Key = keyof typeof he;

const en: Record<Key, string> = {
  areasLabel: NAV_TST.en.areasLabel,
  areasWhere: NAV_TST.en.areasWhere,
  devicesLabel: NAV_TST.en.devicesLabel,
  devicesWhere: NAV_TST.en.devicesWhere,
  securityLabel: NAV_TST.en.securityLabel,
  securityWhere: NAV_TST.en.securityWhere,
  securityLiveLabel: NAV_TST.en.securityLiveLabel,
  securityLiveWhere: NAV_TST.en.securityLiveWhere,
  securityInvestigateLabel: NAV_TST.en.securityInvestigateLabel,
  securityInvestigateWhere: NAV_TST.en.securityInvestigateWhere,
  exploreLabel: NAV_TST.en.exploreLabel,
  exploreWhere: NAV_TST.en.exploreWhere,
  multimediaLabel: NAV_TST.en.multimediaLabel,
  multimediaWhere: NAV_TST.en.multimediaWhere,
  wiskeyLabel: NAV_TST.en.wiskeyLabel,
  wiskeyWhere: NAV_TST.en.wiskeyWhere,
  infraLabel: NAV_TST.en.infraLabel,
  infraWhere: NAV_TST.en.infraWhere,
  infraElectricityLabel: NAV_TST.en.infraElectricityLabel,
  infraElectricityWhere: NAV_TST.en.infraElectricityWhere,
  infraGeneratorLabel: NAV_TST.en.infraGeneratorLabel,
  infraGeneratorWhere: NAV_TST.en.infraGeneratorWhere,
  infraWaterLabel: NAV_TST.en.infraWaterLabel,
  infraWaterWhere: NAV_TST.en.infraWaterWhere,
  ticketsWhere: NAV_TST.en.ticketsWhere,
  ticketsSectionLabel: NAV_TST.en.ticketsSectionLabel,
  ticketsSectionWhere: NAV_TST.en.ticketsSectionWhere,
  ticketsScopesLabel: NAV_TST.en.ticketsScopesLabel,
  ticketsScopesWhere: NAV_TST.en.ticketsScopesWhere,
  ticketsSingleRowLabel: 'The sections row for a user who sees one section',
  ticketsSingleRowHint: 'The page row of the section shows either way',
  ticketsSingleRowHide: 'Hide (default)',
  ticketsSingleRowShow: 'Always show',
  systemLabel: NAV_TST.en.systemLabel,
  systemWhere: NAV_TST.en.systemWhere,
  systemSecurityLabel: NAV_TST.en.systemSecurityLabel,
  systemSecurityWhere: NAV_TST.en.systemSecurityWhere,
  noteOffered: 'A tab shows only once the system has items of its kind; until then it keeps the place set for it.',
  level1Hint: 'The first bar of every area',
  level2Hint: 'The live, investigation and infrastructure pages, and security in settings',
};

// initial translation - needs a native review (dev-marked)
const ar: Record<Key, string> = {
  areasLabel: NAV_TST.ar.areasLabel,
  areasWhere: NAV_TST.ar.areasWhere,
  devicesLabel: NAV_TST.ar.devicesLabel,
  devicesWhere: NAV_TST.ar.devicesWhere,
  securityLabel: NAV_TST.ar.securityLabel,
  securityWhere: NAV_TST.ar.securityWhere,
  securityLiveLabel: NAV_TST.ar.securityLiveLabel,
  securityLiveWhere: NAV_TST.ar.securityLiveWhere,
  securityInvestigateLabel: NAV_TST.ar.securityInvestigateLabel,
  securityInvestigateWhere: NAV_TST.ar.securityInvestigateWhere,
  exploreLabel: NAV_TST.ar.exploreLabel,
  exploreWhere: NAV_TST.ar.exploreWhere,
  multimediaLabel: NAV_TST.ar.multimediaLabel,
  multimediaWhere: NAV_TST.ar.multimediaWhere,
  wiskeyLabel: NAV_TST.ar.wiskeyLabel,
  wiskeyWhere: NAV_TST.ar.wiskeyWhere,
  infraLabel: NAV_TST.ar.infraLabel,
  infraWhere: NAV_TST.ar.infraWhere,
  infraElectricityLabel: NAV_TST.ar.infraElectricityLabel,
  infraElectricityWhere: NAV_TST.ar.infraElectricityWhere,
  infraGeneratorLabel: NAV_TST.ar.infraGeneratorLabel,
  infraGeneratorWhere: NAV_TST.ar.infraGeneratorWhere,
  infraWaterLabel: NAV_TST.ar.infraWaterLabel,
  infraWaterWhere: NAV_TST.ar.infraWaterWhere,
  ticketsWhere: NAV_TST.ar.ticketsWhere,
  ticketsSectionLabel: NAV_TST.ar.ticketsSectionLabel,
  ticketsSectionWhere: NAV_TST.ar.ticketsSectionWhere,
  ticketsScopesLabel: NAV_TST.ar.ticketsScopesLabel,
  ticketsScopesWhere: NAV_TST.ar.ticketsScopesWhere,
  ticketsSingleRowLabel: 'صف الأقسام لمن يرى قسمًا واحدًا',
  ticketsSingleRowHint: 'صف صفحات القسم يظهر في كل الأحوال',
  ticketsSingleRowHide: 'إخفاء (افتراضي)',
  ticketsSingleRowShow: 'إظهار دائمًا',
  systemLabel: NAV_TST.ar.systemLabel,
  systemWhere: NAV_TST.ar.systemWhere,
  systemSecurityLabel: NAV_TST.ar.systemSecurityLabel,
  systemSecurityWhere: NAV_TST.ar.systemSecurityWhere,
  noteOffered: 'تظهر علامة التبويب فقط عندما توجد في النظام عناصر من نوعها؛ وحتى ذلك الحين تحتفظ بالمكان المحدد لها.',
  level1Hint: 'الشريط الأول في كل منطقة',
  level2Hint: 'صفحات البث المباشر والتحقيق والبنية التحتية، والأمن في الإعدادات',
};

// initial translation - needs a native review (dev-marked)
const ru: Record<Key, string> = {
  areasLabel: NAV_TST.ru.areasLabel,
  areasWhere: NAV_TST.ru.areasWhere,
  devicesLabel: NAV_TST.ru.devicesLabel,
  devicesWhere: NAV_TST.ru.devicesWhere,
  securityLabel: NAV_TST.ru.securityLabel,
  securityWhere: NAV_TST.ru.securityWhere,
  securityLiveLabel: NAV_TST.ru.securityLiveLabel,
  securityLiveWhere: NAV_TST.ru.securityLiveWhere,
  securityInvestigateLabel: NAV_TST.ru.securityInvestigateLabel,
  securityInvestigateWhere: NAV_TST.ru.securityInvestigateWhere,
  exploreLabel: NAV_TST.ru.exploreLabel,
  exploreWhere: NAV_TST.ru.exploreWhere,
  multimediaLabel: NAV_TST.ru.multimediaLabel,
  multimediaWhere: NAV_TST.ru.multimediaWhere,
  wiskeyLabel: NAV_TST.ru.wiskeyLabel,
  wiskeyWhere: NAV_TST.ru.wiskeyWhere,
  infraLabel: NAV_TST.ru.infraLabel,
  infraWhere: NAV_TST.ru.infraWhere,
  infraElectricityLabel: NAV_TST.ru.infraElectricityLabel,
  infraElectricityWhere: NAV_TST.ru.infraElectricityWhere,
  infraGeneratorLabel: NAV_TST.ru.infraGeneratorLabel,
  infraGeneratorWhere: NAV_TST.ru.infraGeneratorWhere,
  infraWaterLabel: NAV_TST.ru.infraWaterLabel,
  infraWaterWhere: NAV_TST.ru.infraWaterWhere,
  ticketsWhere: NAV_TST.ru.ticketsWhere,
  ticketsSectionLabel: NAV_TST.ru.ticketsSectionLabel,
  ticketsSectionWhere: NAV_TST.ru.ticketsSectionWhere,
  ticketsScopesLabel: NAV_TST.ru.ticketsScopesLabel,
  ticketsScopesWhere: NAV_TST.ru.ticketsScopesWhere,
  ticketsSingleRowLabel: 'Строка разделов для пользователя с одним разделом',
  ticketsSingleRowHint: 'Строка страниц раздела показывается в любом случае',
  ticketsSingleRowHide: 'Скрывать (по умолчанию)',
  ticketsSingleRowShow: 'Показывать всегда',
  systemLabel: NAV_TST.ru.systemLabel,
  systemWhere: NAV_TST.ru.systemWhere,
  systemSecurityLabel: NAV_TST.ru.systemSecurityLabel,
  systemSecurityWhere: NAV_TST.ru.systemSecurityWhere,
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
