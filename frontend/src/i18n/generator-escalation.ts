/**
 * GENELEV-295: the words of the "how a critical alert escalates" explainer in Settings > Infrastructure > Generator > alert routing.
 * Every sentence describes what the code does today (services/generator_alerts.py `escalation_after_min` / `critical_escalate_after_min`,
 * services/notify.py `_escalate_at` / `escalation_tick` / `escalation_targets`); nothing here promises behaviour the code does not have.
 * Hebrew first; English, Arabic and Russian follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian
 * columns are an INITIAL translation and need a native review (dev-marked). `{n}` is filled with the critical delay in minutes.
 * Operator words only: the home platform is never named.
 */
const he = {
  title: 'איך התראה קריטית מסלימה',
  sub: 'כך זה עובד היום',
  who: 'כשהתראה נפתחת היא נשלחת לנמענים של סוג ההתראה. סוג ללא נמענים משלו מקבל את ברירת המחדל של החומרה שלו. אם לא נבחר אף אחד, אף אחד לא מקבל אותה בשלב הזה.',
  critical: 'התראה קריטית שלא אושרה תוך {n} דקות נשלחת לנמעני ההסלמה: בעלי הרשאת ניהול התראות (או המשתמשים שנבחרו בהגדרות ההתראות) שמורשים לראות אותה. זה קורה גם כשההסלמה כבויה בהגדרות ההתראות.',
  steps: 'שלבי הסלמה נוספים חוזרים במרווח ובמספר השלבים שנקבעו בהגדרות ההתראות (1 עד 3).',
  other: 'חומרה אחרת מסלימה רק כשההסלמה פעילה בסוג ההתראה, אחרי הדקות שנקבעו שם. בלי ערך משלו היא משתמשת באותן {n} דקות.',
  stops: 'אישור ההתראה, או חזרת המצב לתקין, עוצרים את ההסלמה מיד. התראה קריטית אינה נעצרת בשעות שקט, וגם הסלמה עוקפת אותן.',
  where: 'איפה עורכים: נמענים וערוצים לפי סוג התראה או לפי חומרה בטבלאות למטה. השהיית {n} הדקות בברירת המחדל של "קריטית". הסלמה של סוג בודד בחלונית העריכה שלו. נמעני ההסלמה, מספר השלבים והמרווח בהגדרות ההתראות.',
  perm: 'שינוי הניתוב דורש הרשאת ניהול גנרטור. הוספת WhatsApp דורשת גם הרשאת ניהול התראות.',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  title: 'How a critical alert escalates',
  sub: 'As it works today',
  who: 'When an alert opens it is sent to the recipients of its alert type. A type with no recipients of its own uses the default of its severity. If no one is chosen, no one receives it at this stage.',
  critical: 'A critical alert that is not acknowledged within {n} min is sent to the escalation recipients: the holders of the notification-management permission (or the users chosen in the notification settings) who may see it. This happens even when escalation is off in the notification settings.',
  steps: 'Further escalation steps repeat at the interval, and up to the number of steps, set in the notification settings (1 to 3).',
  other: 'Any other severity escalates only when escalation is on for that alert type, after the minutes set there. With no value of its own it uses the same {n} min.',
  stops: 'Acknowledging the alert, or the condition returning to normal, stops the escalation at once. A critical alert is never held back by quiet hours, and an escalation ignores them.',
  where: 'Where to edit: recipients and channels per alert type or per severity are in the tables below. The {n}-minute delay is in the default of "Critical". Escalation of a single type is in its edit panel. The escalation recipients, the number of steps and the interval are in the notification settings.',
  perm: 'Changing the routing needs the generator-management permission. Adding WhatsApp also needs the notification-management permission.',
};

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = {
  title: 'كيف يتم تصعيد التنبيه الحرج',
  sub: 'كما يعمل اليوم',
  who: 'عند فتح التنبيه يُرسل إلى مستلمي نوع التنبيه. النوع بدون مستلمين خاصين يستخدم الإعداد الافتراضي لخطورته. إذا لم يتم اختيار أحد فلن يستلمه أحد في هذه المرحلة.',
  critical: 'التنبيه الحرج الذي لم يتم تأكيده خلال {n} دقيقة يُرسل إلى مستلمي التصعيد: أصحاب صلاحية إدارة التنبيهات (أو المستخدمون المختارون في إعدادات التنبيهات) ممن يحق لهم رؤيته. يحدث ذلك حتى عندما يكون التصعيد متوقفًا في إعدادات التنبيهات.',
  steps: 'تتكرر مراحل التصعيد الإضافية بالفاصل الزمني وبعدد المراحل المحددين في إعدادات التنبيهات (من 1 إلى 3).',
  other: 'الخطورة الأخرى تُصعَّد فقط عندما يكون التصعيد مفعّلًا لنوع التنبيه، بعد الدقائق المحددة هناك. وبدون قيمة خاصة تستخدم نفس {n} دقيقة.',
  stops: 'تأكيد التنبيه أو عودة الحالة إلى الوضع الطبيعي يوقف التصعيد فورًا. التنبيه الحرج لا يتوقف في ساعات الهدوء، والتصعيد يتجاهلها.',
  where: 'أين يتم التعديل: المستلمون والقنوات حسب نوع التنبيه أو حسب الخطورة في الجداول أدناه. مهلة {n} دقيقة في الإعداد الافتراضي لـ "حرج". تصعيد نوع واحد في نافذة تعديله. مستلمو التصعيد وعدد المراحل والفاصل في إعدادات التنبيهات.',
  perm: 'تغيير التوجيه يتطلب صلاحية إدارة المولد. إضافة WhatsApp تتطلب أيضًا صلاحية إدارة التنبيهات.',
};

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = {
  title: 'Как эскалируется критическое оповещение',
  sub: 'Как это работает сейчас',
  who: 'Когда оповещение открывается, оно отправляется получателям своего типа. Тип без собственных получателей использует настройку по умолчанию для своей важности. Если никто не выбран, на этом этапе его не получает никто.',
  critical: 'Критическое оповещение, не подтверждённое в течение {n} мин, отправляется получателям эскалации: владельцам права управления оповещениями (или пользователям, выбранным в настройках оповещений), которым разрешено его видеть. Это происходит и при выключенной эскалации в настройках оповещений.',
  steps: 'Дальнейшие шаги эскалации повторяются с интервалом и в количестве, заданными в настройках оповещений (от 1 до 3).',
  other: 'Оповещение другой важности эскалируется только при включённой эскалации для его типа, через заданные там минуты. Без собственного значения используются те же {n} мин.',
  stops: 'Подтверждение оповещения или возврат состояния в норму сразу останавливает эскалацию. Критическое оповещение не задерживается в тихие часы, а эскалация их игнорирует.',
  where: 'Где менять: получатели и каналы по типу оповещения или по важности - в таблицах ниже. Задержка {n} мин - в настройке по умолчанию для «Критическое». Эскалация отдельного типа - в его окне редактирования. Получатели эскалации, число шагов и интервал - в настройках оповещений.',
  perm: 'Для изменения маршрутизации нужно право управления генератором. Для добавления WhatsApp нужно также право управления оповещениями.',
};

export type GescKey = Key;
export type GescLang = 'he' | 'en' | 'ar' | 'ru';

export function gescLang(): GescLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<GescLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const GESC_DEV_MARKED: readonly GescLang[] = ['ar', 'ru'];

export function gesc(key: Key, vars?: Record<string, string | number>, lang: GescLang = gescLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

/** The body sentences in reading order (the title and subtitle are separate). */
export const GESC_BODY: readonly Key[] = ['who', 'critical', 'steps', 'other', 'stops', 'where', 'perm'];
export const GESC_KEYS = Object.keys(he) as Key[];
export const GESC_TABLES = TABLES;
