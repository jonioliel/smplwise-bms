// Hebrew UI strings. Keys are stable English identifiers so an English catalogue can be added later.
export const he = {
  app: {
    name: 'SMPLWISE VMS',
    search: 'חיפוש מצלמה, קומה, ישות או אירוע…',
    notifications: 'התראות',
    account: 'חשבון',
  },
  modes: {
    live: 'שידור חי',
    explore: 'מפות',
    investigate: 'חקירה',
    system: 'מערכת',
  },
  nav: {
    styleguide: 'ספריית רכיבים',
  },
  breadcrumb: {
    site: 'אתר',
    building: 'מבנה',
    floor: 'קומה',
  },
  floor: {
    switcher: 'בחירת קומה',
    layers: 'שכבות',
    cameras: 'מצלמות',
    doors: 'דלתות',
    lights: 'תאורה',
    sensors: 'חיישנים',
    zoomIn: 'הגדלה',
    zoomOut: 'הקטנה',
    fit: 'התאמה למסך',
    noPlan: 'לקומה הזו עדיין אין תוכנית',
    noPlanHint: 'אפשר להעלות PDF או תמונה של התוכנית, או לעבוד עם רשימת המצלמות בינתיים.',
    uploadPlan: 'העלאת תוכנית',
    listView: 'תצוגת רשימה',
    stalePlan: 'התוכנית מוצגת כרקע בלבד',
  },
  states: {
    loading: 'טוען…',
    empty: 'אין נתונים להצגה',
    error: 'משהו השתבש',
    errorHint: 'לא הצלחנו לטעון את הנתונים. אפשר לנסות שוב.',
    retry: 'נסה שוב',
    forbidden: 'אין הרשאה',
    forbiddenHint: 'למשתמש שלך אין הרשאה לצפות בתוכן הזה. פנה למנהל ה־VMS כדי לקבל שיוך.',
    stale: 'הנתונים אינם עדכניים',
    staleHint: 'החיבור ל־Home Assistant נותק. מוצג המצב האחרון שנקלט.',
    partial: 'חלק מהנתונים חסר',
    offline: 'לא מחובר',
    unknown: 'לא ידוע',
    live: 'חי',
    recorded: 'מוקלט',
    historic: 'צפייה היסטורית',
  },
  camera: {
    preview: 'תצוגה מקדימה',
    enlarge: 'הגדל',
    recordings: 'הקלטות',
    pin: 'הצמד',
    unpin: 'בטל הצמדה',
    snapshot: 'צילום',
    offlineReason: 'המצלמה אינה מחוברת ל־NVR',
    forbiddenReason: 'אין לך הרשאת צפייה במצלמה הזו',
    staleReason: 'מצב המצלמה אינו מעודכן',
    source: 'מקור',
    timeSource: 'זמן מקור',
    quality: 'איכות',
    main: 'ראשי',
    sub: 'משני',
  },
  entity: {
    state: 'מצב',
    lastChanged: 'עודכן לאחרונה',
    control: 'הפעלה',
    noControl: 'אין הרשאה לשליטה',
    openInHa: 'פתח ב־Home Assistant',
    door: 'דלת',
    light: 'תאורה',
    sensor: 'חיישן',
    locked: 'נעול',
    unlocked: 'פתוח',
    on: 'דולק',
    off: 'כבוי',
    confirm: 'אישור פעולה',
  },
  actions: {
    close: 'סגור',
    cancel: 'ביטול',
    save: 'שמירה',
    apply: 'החל',
    refresh: 'רענון',
    more: 'עוד',
    back: 'חזרה',
  },
} as const;

type Path<T> = T extends object ? { [K in keyof T]: `${K & string}.${Path<T[K]>}` | (T[K] extends string ? K & string : never) }[keyof T] : never;
export type I18nKey = Path<typeof he>;

export function t(key: I18nKey): string {
  const value = key.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], he);
  return typeof value === 'string' ? value : key;
}
