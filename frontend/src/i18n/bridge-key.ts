/**
 * CR-WISKEY-HMAC-ROTATION-295: the words of the "Bridge key" card (Settings › Connections). Hebrew first; English, Arabic and
 * Russian follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL
 * translation and need a native review (dev-marked). Short texts only; no home-system branding.
 */
const he = {
  title: 'מפתח הגשר',
  stateOff: 'כבוי',
  stateReady: 'מוכן',
  stateRotating: 'בהחלפה',
  stateAttention: 'דורש טיפול',
  keyId: 'מזהה מפתח',
  generation: 'דור',
  since: 'פעיל מאז',
  lastRotation: 'החלפה אחרונה',
  none: 'אין',
  switchLabel: 'החלפת מפתח',
  reminder: 'תזכורת להחלפה',
  reminderOff: 'ללא',
  reminderDays: 'כל {n} ימים',
  reminderDue: 'הגיע זמן להחליף מפתח',
  rotate: 'החלפת מפתח',
  hardCut: 'החלפה מיידית',
  resume: 'השלמת החלפה',
  confirmRotate: 'להחליף את מפתח הגשר? שני המפתחות יפעלו יחד עד 3 דקות.',
  confirmHardCut: 'להחליף מיד? המפתח הישן יפסיק לפעול מיד.',
  confirm: 'אישור',
  cancel: 'ביטול',
  retireAt: 'המפתח הישן יבוטל ב־{t}',
  saved: 'נשמר',
  modeRoutine: 'רגילה',
  modeHardCut: 'מיידית',
  // rotation states
  st_prepared: 'מכין',
  st_publishing: 'שולח לגשר',
  st_published: 'הגשר קיבל',
  st_confirmed: 'אומת בגשר',
  st_switching: 'מחליף',
  st_switched: 'הוחלף',
  st_retiring: 'מבטל את הישן',
  st_retired: 'המפתח הישן בוטל',
  st_verified: 'הושלם',
  st_verify_failed: 'האימות נכשל',
  st_rolled_back: 'בוטל, חזרה למפתח הקודם',
  st_needs_repair: 'נדרש זיווג מחדש',
  // why the buttons are disabled
  bl_rotation_off: 'ההחלפה כבויה',
  bl_rotation_not_permitted: 'דורש אישור הפעלה מבעל המערכת',
  bl_peer_unavailable: 'הגשר אינו תומך עדיין',
  bl_rotation_in_progress: 'החלפה מתבצעת',
  bl_repair_required: 'יש להשלים החלפה קודמת',
  bl_key_unreadable: 'המפתח אינו קריא במכונה זו',
  bl_not_paired: 'הגשר לא צומד',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  title: 'Bridge key',
  stateOff: 'Off',
  stateReady: 'Ready',
  stateRotating: 'Rotating',
  stateAttention: 'Needs attention',
  keyId: 'Key id',
  generation: 'Generation',
  since: 'Active since',
  lastRotation: 'Last rotation',
  none: 'None',
  switchLabel: 'Key rotation',
  reminder: 'Rotation reminder',
  reminderOff: 'None',
  reminderDays: 'Every {n} days',
  reminderDue: 'Time to rotate the key',
  rotate: 'Rotate key',
  hardCut: 'Immediate rotation',
  resume: 'Finish rotation',
  confirmRotate: 'Rotate the bridge key? Both keys work together for up to 3 minutes.',
  confirmHardCut: 'Rotate now? The old key stops working at once.',
  confirm: 'Confirm',
  cancel: 'Cancel',
  retireAt: 'The old key is retired at {t}',
  saved: 'Saved',
  modeRoutine: 'Routine',
  modeHardCut: 'Immediate',
  st_prepared: 'Preparing',
  st_publishing: 'Sending to the bridge',
  st_published: 'Bridge received',
  st_confirmed: 'Bridge verified',
  st_switching: 'Switching',
  st_switched: 'Switched',
  st_retiring: 'Retiring the old key',
  st_retired: 'Old key retired',
  st_verified: 'Done',
  st_verify_failed: 'Verification failed',
  st_rolled_back: 'Cancelled, back to the previous key',
  st_needs_repair: 'Re-pairing required',
  bl_rotation_off: 'Rotation is off',
  bl_rotation_not_permitted: 'Needs the owner’s activation permit',
  bl_peer_unavailable: 'The bridge does not support it yet',
  bl_rotation_in_progress: 'A rotation is running',
  bl_repair_required: 'Finish the previous rotation first',
  bl_key_unreadable: 'The key cannot be read on this machine',
  bl_not_paired: 'The bridge is not paired',
};

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = {
  title: 'مفتاح الجسر',
  stateOff: 'متوقف',
  stateReady: 'جاهز',
  stateRotating: 'قيد التبديل',
  stateAttention: 'يحتاج إلى معالجة',
  keyId: 'معرّف المفتاح',
  generation: 'الجيل',
  since: 'نشط منذ',
  lastRotation: 'آخر تبديل',
  none: 'لا يوجد',
  switchLabel: 'تبديل المفتاح',
  reminder: 'تذكير بالتبديل',
  reminderOff: 'بدون',
  reminderDays: 'كل {n} يومًا',
  reminderDue: 'حان وقت تبديل المفتاح',
  rotate: 'تبديل المفتاح',
  hardCut: 'تبديل فوري',
  resume: 'إكمال التبديل',
  confirmRotate: 'هل تريد تبديل مفتاح الجسر؟ يعمل المفتاحان معًا حتى 3 دقائق.',
  confirmHardCut: 'هل تريد التبديل الآن؟ يتوقف المفتاح القديم فورًا.',
  confirm: 'تأكيد',
  cancel: 'إلغاء',
  retireAt: 'يُلغى المفتاح القديم في {t}',
  saved: 'تم الحفظ',
  modeRoutine: 'عادي',
  modeHardCut: 'فوري',
  st_prepared: 'قيد التحضير',
  st_publishing: 'يُرسل إلى الجسر',
  st_published: 'استلمه الجسر',
  st_confirmed: 'تحقق منه الجسر',
  st_switching: 'قيد التبديل',
  st_switched: 'تم التبديل',
  st_retiring: 'يُلغى المفتاح القديم',
  st_retired: 'أُلغي المفتاح القديم',
  st_verified: 'اكتمل',
  st_verify_failed: 'فشل التحقق',
  st_rolled_back: 'أُلغي، عودة إلى المفتاح السابق',
  st_needs_repair: 'يلزم إعادة الاقتران',
  bl_rotation_off: 'التبديل متوقف',
  bl_rotation_not_permitted: 'يحتاج إلى إذن تشغيل من المالك',
  bl_peer_unavailable: 'الجسر لا يدعمه بعد',
  bl_rotation_in_progress: 'يجري تبديل',
  bl_repair_required: 'أكمل التبديل السابق أولًا',
  bl_key_unreadable: 'لا يمكن قراءة المفتاح على هذا الجهاز',
  bl_not_paired: 'الجسر غير مقترن',
};

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = {
  title: 'Ключ моста',
  stateOff: 'Выключено',
  stateReady: 'Готово',
  stateRotating: 'Идёт замена',
  stateAttention: 'Требует внимания',
  keyId: 'Идентификатор ключа',
  generation: 'Поколение',
  since: 'Активен с',
  lastRotation: 'Последняя замена',
  none: 'Нет',
  switchLabel: 'Замена ключа',
  reminder: 'Напоминание о замене',
  reminderOff: 'Нет',
  reminderDays: 'Каждые {n} дн.',
  reminderDue: 'Пора заменить ключ',
  rotate: 'Заменить ключ',
  hardCut: 'Немедленная замена',
  resume: 'Завершить замену',
  confirmRotate: 'Заменить ключ моста? Оба ключа работают вместе до 3 минут.',
  confirmHardCut: 'Заменить сейчас? Старый ключ сразу перестанет работать.',
  confirm: 'Подтвердить',
  cancel: 'Отмена',
  retireAt: 'Старый ключ будет отозван в {t}',
  saved: 'Сохранено',
  modeRoutine: 'Обычная',
  modeHardCut: 'Немедленная',
  st_prepared: 'Подготовка',
  st_publishing: 'Отправка на мост',
  st_published: 'Мост получил',
  st_confirmed: 'Мост подтвердил',
  st_switching: 'Переключение',
  st_switched: 'Переключено',
  st_retiring: 'Отзыв старого ключа',
  st_retired: 'Старый ключ отозван',
  st_verified: 'Готово',
  st_verify_failed: 'Проверка не прошла',
  st_rolled_back: 'Отменено, возврат к прежнему ключу',
  st_needs_repair: 'Нужно повторное сопряжение',
  bl_rotation_off: 'Замена выключена',
  bl_rotation_not_permitted: 'Нужно разрешение владельца на включение',
  bl_peer_unavailable: 'Мост пока не поддерживает',
  bl_rotation_in_progress: 'Идёт замена',
  bl_repair_required: 'Сначала завершите прошлую замену',
  bl_key_unreadable: 'Ключ не читается на этой машине',
  bl_not_paired: 'Мост не сопряжён',
};

export type BktKey = Key;
export type BktLang = 'he' | 'en' | 'ar' | 'ru';

export function bktLang(): BktLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<BktLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const BKT_DEV_MARKED: readonly BktLang[] = ['ar', 'ru'];

export function bkt(key: Key, vars?: Record<string, string | number>, lang: BktLang = bktLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

/** A state / blocked-by code as text (an unknown code falls back to the code itself). */
export function bktCode(prefix: 'st_' | 'bl_', code: string | null | undefined, lang: BktLang = bktLang()): string {
  if (!code) return '';
  const k = `${prefix}${code}` as Key;
  return k in he ? bkt(k, undefined, lang) : code;
}

export const BKT_KEYS = Object.keys(he) as Key[];
export const BKT_TABLES = TABLES;
