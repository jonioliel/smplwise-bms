/**
 * CR-NAV-LABELS-2436 (review 07:F3, 08:F02): the labels the shell's navigation needs, and only those - so `shell/nav.ts` (and
 * `api/notifications.ts`) no longer pull fifteen whole dictionaries into the entry chunk for one tab name each.
 *
 * This module is the ONE home of these strings: each dictionary keeps its key and reads the value from the table here
 * (`tab: NAV_XT.he.tab`), so no string exists twice and every getter of a dictionary (`xt('tab')`, `XT_TABLES`, `XT_KEYS`) answers
 * as before. The getters below follow each dictionary's own rule word for word: the document language (two or four columns), a
 * missing column falls back to the Hebrew, `{var}`s are filled last, and the tickets families render the module's configured name
 * with tn() (owner decision D33).
 *
 * It imports nothing but tickets/naming.ts (which imports nothing): a dictionary imports this module, so this module must never
 * import a dictionary (a cycle would read a table before it exists). The two labels whose dictionaries this branch may not edit
 * (`i18n/he.ts`, `tickets/rfq-text.ts`) are read through `i18n/nav-label-bridges.ts`.
 */
import { DEFAULT_TICKET_NAMES, ticketNames, tn, type TicketLang } from '../tickets/naming';

type Lang2 = 'he' | 'en';
type Lang4 = 'he' | 'en' | 'ar' | 'ru';
type Vars = Record<string, string | number>;

function docLang(): string {
  return typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
}
/** The two-column rule (insights, transit, cross-section, presence, incidents, the tickets screens): English or the product's Hebrew. */
function lang2(): Lang2 {
  return docLang().startsWith('en') ? 'en' : 'he';
}
/** The four-column rule (external access, door windows, announce, tab registry, maintenance). */
function lang4(): Lang4 {
  const l = docLang();
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}
function fill(raw: string, vars?: Vars): string {
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}
/** A tickets-family template: the document's column (Hebrew when English lacks it), the module's name rendered, then `{var}`s. */
function named<K extends string>(table: Record<Lang2, Partial<Record<K, string>>>, key: K, vars?: Vars): string {
  const lang = ticketsLang();
  const raw = (lang === 'en' ? table.en[key] : undefined) ?? table.he[key] ?? key;
  return fill(tn(raw, lang as TicketLang), vars);
}

/** The language of the tickets screens: the document's (English or the product's Hebrew). tickets/text.ts re-exports it. */
export function ticketsLang(): 'he' | 'en' {
  return typeof document !== 'undefined' && (document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'he';
}

/** tickets/text.ts (+ hdTitle of tickets/text-s4.ts): the area, its scopes, its four sections and two pages - templates rendered by tn(). */
export type NavTtKey = 'area' | 'settingsTab' | 'tabMine' | 'tabDepartment' | 'tabAll' | 'secRequests' | 'secRequestsShort' | 'secRequestsNamed' | 'secMaintenance' | 'secMaintenanceShort' | 'secVendors' | 'secVendorsShort' | 'secReports' | 'secReportsShort' | 'pageList' | 'hdTitle';
export const NAV_TT: Record<Lang2, Record<NavTtKey, string>> = {
  he: {
    area: '{module}',
    settingsTab: '{module}',
    tabMine: 'שלי',
    tabDepartment: 'המחלקה',
    tabAll: 'הכול',
    secRequests: 'בקשות',
    secRequestsShort: 'בקשות',
    secRequestsNamed: '{tickets}',
    secMaintenance: 'תחזוקה ובקרה',
    secMaintenanceShort: 'תחזוקה',
    secVendors: 'ספקים וכספים',
    secVendorsShort: 'ספקים',
    secReports: 'סקירה ודוחות',
    secReportsShort: 'סקירה',
    pageList: 'רשימה',
    hdTitle: 'מטפלים וספקים',
  },
  en: {
    area: '{module}',
    settingsTab: '{module}',
    tabMine: 'Mine',
    tabDepartment: 'Department',
    tabAll: 'All',
    secRequests: 'Requests',
    secRequestsShort: 'Requests',
    secRequestsNamed: '{tickets}',
    secMaintenance: 'Maintenance & checks',
    secMaintenanceShort: 'Maintenance',
    secVendors: 'Vendors & finance',
    secVendorsShort: 'Vendors',
    secReports: 'Overview & reports',
    secReportsShort: 'Overview',
    pageList: 'List',
    hdTitle: 'Handlers and vendors',
  },
};

/** tickets/board-text.ts: the manager board tab. */
export type NavBtKey = 'tabBoard';
export const NAV_BT: Record<Lang2, Record<NavBtKey, string>> = {
  he: {
    tabBoard: 'לוח מנהל',
  },
  en: {
    tabBoard: 'Board',
  },
};

/** tickets/overview-text.ts: the overview tab. */
export type NavOtKey = 'tab';
export const NAV_OT: Record<Lang2, Record<NavOtKey, string>> = {
  he: {
    tab: 'סקירה',
  },
  en: {
    tab: 'Overview',
  },
};

/** tickets/cost-text.ts: the vendor accounts tab. */
export type NavCtKey = 'vaTitle';
export const NAV_CT: Record<Lang2, Record<NavCtKey, string>> = {
  he: {
    vaTitle: 'חשבון ספקים',
  },
  en: {
    vaTitle: 'Vendor accounts',
  },
};

/** i18n/access-external.ts: the external-access tab. */
export type NavXtKey = 'tab';
export const NAV_XT: Record<Lang4, Record<NavXtKey, string>> = {
  he: {
    tab: 'גישת חוץ',
  },
  en: {
    tab: 'External access',
  },
  ar: {
    tab: 'وصول خارجي',
  },
  ru: {
    tab: 'Внешний доступ',
  },
};

/** i18n/door-windows.ts: the door-windows tab. */
export type NavDwtKey = 'tab';
export const NAV_DWT: Record<Lang4, Record<NavDwtKey, string>> = {
  he: {
    tab: 'חלונות פתיחה',
  },
  en: {
    tab: 'Door windows',
  },
  ar: {
    tab: 'نوافذ فتح الأبواب',
  },
  ru: {
    tab: 'Окна открытия',
  },
};

/** i18n/announce.ts: the announce tab (`announceText().title`). */
export type NavAnnounceKey = 'title';
export const NAV_ANNOUNCE: Record<Lang4, Record<NavAnnounceKey, string>> = {
  he: {
    title: 'הכרזות',
  },
  en: {
    title: 'Announcements',
  },
  ar: {
    title: 'الإعلانات',
  },
  ru: {
    title: 'Объявления',
  },
};

/** i18n/tab-sections.ts: the names and surfaces of the tab registry sections. */
export type NavTstKey = 'areasLabel' | 'areasWhere' | 'devicesLabel' | 'devicesWhere' | 'securityLabel' | 'securityWhere' | 'securityLiveLabel' | 'securityLiveWhere' | 'securityInvestigateLabel' | 'securityInvestigateWhere' | 'exploreLabel' | 'exploreWhere' | 'multimediaLabel' | 'multimediaWhere' | 'wiskeyLabel' | 'wiskeyWhere' | 'infraLabel' | 'infraWhere' | 'infraElectricityLabel' | 'infraElectricityWhere' | 'infraGeneratorLabel' | 'infraGeneratorWhere' | 'infraWaterLabel' | 'infraWaterWhere' | 'ticketsWhere' | 'ticketsSectionLabel' | 'ticketsSectionWhere' | 'ticketsScopesLabel' | 'ticketsScopesWhere' | 'systemLabel' | 'systemWhere' | 'systemSecurityLabel' | 'systemSecurityWhere';
export const NAV_TST: Record<Lang4, Record<NavTstKey, string>> = {
  he: {
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
    infraWaterLabel: 'תשתיות ‹ מים',
    infraWaterWhere: 'דפי מוני המים',
    ticketsWhere: 'לשוניות {name}',
    ticketsSectionLabel: '{name} ‹ {section}',
    ticketsSectionWhere: 'דפי {section}',
    ticketsScopesLabel: '{name} ‹ היקף הרשימה',
    ticketsScopesWhere: 'שלי · המחלקה · הכול ברשימת הבקשות',
    systemLabel: 'הגדרות',
    systemWhere: 'לשוניות ההגדרות',
    systemSecurityLabel: 'הגדרות ‹ אבטחה',
    systemSecurityWhere: 'לשוניות אבטחה בהגדרות',
  },
  en: {
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
    infraWaterLabel: 'Infrastructure › Water',
    infraWaterWhere: 'The water meter pages',
    ticketsWhere: 'The {name} tabs',
    ticketsSectionLabel: '{name} › {section}',
    ticketsSectionWhere: 'The {section} pages',
    ticketsScopesLabel: '{name} › List scope',
    ticketsScopesWhere: 'Mine · Department · All on the request list',
    systemLabel: 'Settings',
    systemWhere: 'The settings tabs',
    systemSecurityLabel: 'Settings › Security',
    systemSecurityWhere: 'The security tabs in settings',
  },
  ar: {
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
    infraWaterLabel: 'البنية التحتية ‹ المياه',
    infraWaterWhere: 'صفحات عدادات المياه',
    ticketsWhere: 'علامات تبويب {name}',
    ticketsSectionLabel: '{name} ‹ {section}',
    ticketsSectionWhere: 'صفحات {section}',
    ticketsScopesLabel: '{name} ‹ نطاق القائمة',
    ticketsScopesWhere: 'طلباتي · القسم · الكل في قائمة الطلبات',
    systemLabel: 'الإعدادات',
    systemWhere: 'علامات تبويب الإعدادات',
    systemSecurityLabel: 'الإعدادات ‹ الأمن',
    systemSecurityWhere: 'علامات تبويب الأمن في الإعدادات',
  },
  ru: {
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
    infraWaterLabel: 'Инфраструктура › Вода',
    infraWaterWhere: 'Страницы водосчётчиков',
    ticketsWhere: 'Вкладки раздела «{name}»',
    ticketsSectionLabel: '{name} › {section}',
    ticketsSectionWhere: 'Страницы «{section}»',
    ticketsScopesLabel: '{name} › Охват списка',
    ticketsScopesWhere: 'Мои · Отдел · Все в списке заявок',
    systemLabel: 'Настройки',
    systemWhere: 'Вкладки настроек',
    systemSecurityLabel: 'Настройки › Безопасность',
    systemSecurityWhere: 'Вкладки безопасности в настройках',
  },
};

/** i18n/maintenance.ts: the maintenance section (Arabic and Russian fall back to the Hebrew, as in mt()). */
export type NavMtKey = 'section';
export const NAV_MT: Record<Lang2, Record<NavMtKey, string>> = {
  he: {
    section: 'תחזוקה ובקרה',
  },
  en: {
    section: 'Maintenance & inspections',
  },
};

/** i18n/insights.ts: the building report page. */
export type NavIxKey = 'pageBuilding';
export const NAV_IX: Record<Lang2, Record<NavIxKey, string>> = {
  he: {
    pageBuilding: 'דוחות בניין',
  },
  en: {
    pageBuilding: 'Building reports',
  },
};

/** i18n/transit.ts: the public-transport tab. */
export type NavTrKey = 'tab';
export const NAV_TR: Record<Lang2, Record<NavTrKey, string>> = {
  he: {
    tab: 'תחבורה ציבורית',
  },
  en: {
    tab: 'Public transport',
  },
};

/** i18n/xsection.ts: the synoptic tab. */
export type NavXsKey = 'synTab';
export const NAV_XS: Record<Lang2, Record<NavXsKey, string>> = {
  he: {
    synTab: 'מפה סינופטית',
  },
  en: {
    synTab: 'Synoptic map',
  },
};

/** i18n/presence.ts: the "who is in" tab. */
export type NavPtKey = 'tab';
export const NAV_PT: Record<Lang2, Record<NavPtKey, string>> = {
  he: {
    tab: 'מי במבנה',
  },
  en: {
    tab: 'Who is in',
  },
};

/** i18n/incidents.ts: the live incident tab. */
export type NavItKey = 'tab';
export const NAV_IT: Record<Lang2, Record<NavItKey, string>> = {
  he: {
    tab: 'אירוע חי',
  },
  en: {
    tab: 'Live incident',
  },
};

// ------------------------------------------------------------------------------------------------ the getters (each as its dictionary's)

/** A plain column lookup: the language's value, else the Hebrew, else the key (the dictionaries' `TABLES[lang][key] ?? he[key] ?? key`). */
function col<L extends string, K extends string>(table: Partial<Record<L, Partial<Record<K, string>>>> & { he: Record<K, string> }, lang: L, key: K, vars?: Vars): string {
  return fill(table[lang]?.[key] ?? table.he[key] ?? key, vars);
}

/** As tt() of tickets/text.ts for the keys above. */
export const navTt = (key: NavTtKey, vars?: Vars): string => named(NAV_TT, key, vars);
/** As bt() / ot() / ct() of the board, overview and cost catalogues. */
export const navBt = (key: NavBtKey, vars?: Vars): string => named(NAV_BT, key, vars);
export const navOt = (key: NavOtKey, vars?: Vars): string => named(NAV_OT, key, vars);
export const navCt = (key: NavCtKey, vars?: Vars): string => named(NAV_CT, key, vars);

/** SERVICEIA1-295: the name of one section of the area (`short` = the phone label). The requests section is "בקשות" while the item names
 * are the defaults, else the configured plural (D33: a renamed module renames its first section too). tickets/text.ts re-exports it. */
export function ticketsSectionLabel(section: 'requests' | 'maintenance' | 'vendors' | 'reports' | string, short = false): string {
  if (section === 'requests') {
    const lang = ticketsLang();
    const n = ticketNames(lang as TicketLang);
    const d = DEFAULT_TICKET_NAMES[lang as TicketLang];
    if (n.one !== d.one || n.many !== d.many) return navTt('secRequestsNamed');
    return navTt(short ? 'secRequestsShort' : 'secRequests');
  }
  const key = section === 'maintenance' ? 'secMaintenance' : section === 'vendors' ? 'secVendors' : section === 'reports' ? 'secReports' : null;
  if (!key) return section;
  return navTt(short ? (`${key}Short` as NavTtKey) : key);
}

/** As xt() of i18n/access-external.ts, dwt() of i18n/door-windows.ts, tst() of i18n/tab-sections.ts (four columns). */
export const navXt = (key: NavXtKey, vars?: Vars, lang: Lang4 = lang4()): string => col(NAV_XT, lang, key, vars);
export const navDwt = (key: NavDwtKey, vars?: Vars, lang: Lang4 = lang4()): string => col(NAV_DWT, lang, key, vars);
export const navTst = (key: NavTstKey, vars?: Vars, lang: Lang4 = lang4()): string => col(NAV_TST, lang, key, vars);
/** As `announceText(lang)[key]` of i18n/announce.ts. */
export const navAnnounce = (key: NavAnnounceKey, lang: Lang4 = lang4()): string => NAV_ANNOUNCE[lang][key];
/** As mt() of i18n/maintenance.ts: four document languages, Arabic and Russian read the Hebrew. */
export const navMt = (key: NavMtKey, vars?: Vars, lang: Lang4 = lang4()): string => col<Lang4, NavMtKey>(NAV_MT, lang, key, vars);
/** As ix(), tr(), xt() of i18n/xsection.ts, pt(), it() (two columns). */
export const navIx = (key: NavIxKey, vars?: Vars, lang: Lang2 = lang2()): string => col(NAV_IX, lang, key, vars);
export const navTr = (key: NavTrKey, vars?: Vars, lang: Lang2 = lang2()): string => col(NAV_TR, lang, key, vars);
export const navXs = (key: NavXsKey, vars?: Vars, lang: Lang2 = lang2()): string => col(NAV_XS, lang, key, vars);
export const navPt = (key: NavPtKey, vars?: Vars, lang: Lang2 = lang2()): string => col(NAV_PT, lang, key, vars);
export const navIt = (key: NavItKey, vars?: Vars, lang: Lang2 = lang2()): string => col(NAV_IT, lang, key, vars);
