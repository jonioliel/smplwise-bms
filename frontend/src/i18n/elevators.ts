/**
 * CR-INFRA-ELEVATORS: the words of the elevators module (Infrastructure screen, home tiles, Settings › תשתיות › מעליות). Hebrew first; English,
 * Arabic and Russian columns follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an
 * INITIAL translation and need a native review (dev-marked). `{n}` placeholders are filled by `elt(key, { n })`. Operator screens never
 * name the home platform; only the settings section says "התשתית".
 */
const he = {
  title: 'מעליות',
  stateFireService: 'פיקוד כבאים',
  stateFault: 'תקלה',
  stateOutOfService: 'בהשבתה',
  stateActive: 'פעילה',
  stateMovingUp: 'עולה',
  stateMovingDown: 'יורדת',
  stateDoorOpen: 'דלת פתוחה',
  stateWaiting: 'ממתינה',
  stateUnknown: 'לא ידוע',
  since: 'מאז {t}',
  stale: 'לא מסונכרן',
  partial: 'חלק מהחיישנים לא זמינים',
  summary: '{n} מעליות',
  summaryFault: '{f} בתקלה',
  summaryFire: '{k} פיקוד כבאים',
  empty: 'אין מעליות',
  loadError: 'לא ניתן לטעון את המעליות',
  roleMovingUp: 'עולה',
  roleMovingDown: 'יורדת',
  roleWaiting: 'ממתינה / עומדת',
  roleFault: 'תקלה',
  roleFireService: 'פיקוד כבאים',
  roleDoorOpen: 'דלת פתוחה',
  roleOutOfService: 'השבתה',
  extras: 'חיישנים נוספים',
  extraLabel: 'שם',
  addExtra: 'הוספת חיישן',
  none: 'ללא',
  missing: 'החיישן לא נמצא בתשתית',
  add: 'הוספת מעלית',
  edit: 'עריכה',
  remove: 'מחיקה',
  removeConfirm: 'למחוק את המעלית {name}?',
  save: 'שמירה',
  cancel: 'ביטול',
  saved: 'נשמר',
  name: 'שם',
  enabled: 'פעילה',
  disabled: 'לא פעילה',
  up: 'למעלה',
  down: 'למטה',
  settingsIntro: 'כל מעלית מקושרת לחיישני מצב (פתוח/סגור) מהתשתית. צריך לפחות חיישן אחד.',
  settingsEmpty: 'עדיין לא הוגדרו מעליות',
  needOne: 'יש לבחור לפחות חיישן אחד',
  permission: 'ניהול מעליות: הגדרה וקישור חיישני מצב',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  title: 'Elevators',
  stateFireService: 'Fire service',
  stateFault: 'Fault',
  stateActive: 'In operation',
  stateOutOfService: 'Out of service',
  stateMovingUp: 'Going up',
  stateMovingDown: 'Going down',
  stateDoorOpen: 'Door open',
  stateWaiting: 'Waiting',
  stateUnknown: 'Unknown',
  since: 'since {t}',
  stale: 'Not synced',
  partial: 'Some sensors are unavailable',
  summary: '{n} elevators',
  summaryFault: '{f} in fault',
  summaryFire: '{k} fire service',
  empty: 'No elevators',
  loadError: 'Could not load the elevators',
  roleMovingUp: 'Going up',
  roleMovingDown: 'Going down',
  roleWaiting: 'Waiting / standing',
  roleFault: 'Fault',
  roleFireService: 'Fire service mode',
  roleDoorOpen: 'Door open',
  roleOutOfService: 'Shutdown (out of service)',
  extras: 'Extra sensors',
  extraLabel: 'Label',
  addExtra: 'Add sensor',
  none: 'None',
  missing: 'The sensor is not in the infrastructure',
  add: 'Add elevator',
  edit: 'Edit',
  remove: 'Delete',
  removeConfirm: 'Delete the elevator {name}?',
  save: 'Save',
  cancel: 'Cancel',
  saved: 'Saved',
  name: 'Name',
  enabled: 'Active',
  disabled: 'Inactive',
  up: 'Up',
  down: 'Down',
  settingsIntro: 'Each elevator links to on/off state sensors of the infrastructure. At least one sensor is required.',
  settingsEmpty: 'No elevators defined yet',
  needOne: 'Choose at least one sensor',
  permission: 'Manage elevators: define and link state sensors',
};

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = {
  title: 'المصاعد',
  stateFault: 'عطل',
  stateOutOfService: 'خارج الخدمة',
  stateMovingUp: 'صاعد',
  stateMovingDown: 'نازل',
  stateDoorOpen: 'الباب مفتوح',
  stateWaiting: 'في الانتظار',
  stateUnknown: 'غير معروف',
  stale: 'غير متزامن',
  summary: '{n} مصاعد',
  summaryFault: '{f} معطلة',
  summaryFire: '{k} وضع الإطفاء',
  stateFireService: 'وضع رجال الإطفاء',
  stateActive: 'قيد التشغيل',
  empty: 'لا توجد مصاعد',
  add: 'إضافة مصعد',
  edit: 'تعديل',
  remove: 'حذف',
  save: 'حفظ',
  cancel: 'إلغاء',
  name: 'الاسم',
};

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = {
  title: 'Лифты',
  stateFault: 'Неисправность',
  stateOutOfService: 'Не работает',
  stateMovingUp: 'Едет вверх',
  stateMovingDown: 'Едет вниз',
  stateDoorOpen: 'Дверь открыта',
  stateWaiting: 'Ожидает',
  stateUnknown: 'Неизвестно',
  stale: 'Нет синхронизации',
  summary: 'Лифтов: {n}',
  summaryFault: 'неисправны: {f}',
  summaryFire: 'пожарный режим: {k}',
  stateFireService: 'Пожарный режим',
  stateActive: 'В работе',
  empty: 'Нет лифтов',
  add: 'Добавить лифт',
  edit: 'Изменить',
  remove: 'Удалить',
  save: 'Сохранить',
  cancel: 'Отмена',
  name: 'Название',
};

export type EltKey = Key;
export type EltLang = 'he' | 'en' | 'ar' | 'ru';

export function eltLang(): EltLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<EltLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const ELT_DEV_MARKED: readonly EltLang[] = ['ar', 'ru'];

export function elt(key: Key, vars?: Record<string, string | number>, lang: EltLang = eltLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const ELT_KEYS = Object.keys(he) as Key[];
export const ELT_TABLES = TABLES;
