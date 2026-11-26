// CR-I18N-LAZY-LANG-2443: language pack table of src/i18n/generator-log.ts, fetched only when the page is in this language (i18n/lang-packs.ts).
// Moved by scripts/i18n-split-langs.mjs; edit the texts here.
/* eslint-disable */

export const ar = {
  page: 'سجل التشغيل',
  title: 'سجل تشغيل المولد',
  kind_test: 'اختبار',
  kind_mains_failure: 'انقطاع الشبكة',
  kind_manual: 'يدوي',
  kind_other: 'آخر',
  kpiRuns: 'مرات التشغيل',
  kpiHours: 'ساعات العمل',
  kpiFuel: 'الوقود المستهلك',
  empty: 'لا توجد مرات تشغيل في النطاق',
  prev: 'السابق',
  next: 'التالي',
  // GEN-UNITS-ARRU-2530: the settings section (Settings > Infrastructure > Generator > run log); the unit sits in the field frame
  setSub: 'سجل التشغيل',
  setIntro: 'يُستمد سجل التشغيل من قراءات وحدة التحكم ولا يرسل أي شيء إلى وحدة التحكم. جميع العتبات والنوافذ هنا.',
  setEnabled: 'عرض سجل التشغيل في شاشة المولد',
  set_min_run_s: 'التشغيل الأقصر من هذا لا يُسجَّل',
  set_mains_lookback_s: 'انقطاع الشبكة خلال هذه المدة قبل التشغيل = انقطاع الشبكة',
  set_test_min_minutes: 'الاختبار الأقصر من هذا يُعلَّم "اختبار قصير"',
  set_test_max_minutes: 'التشغيل بدون حمل الأطول من هذا ليس اختبارًا',
  set_classify_unloaded_as_test: 'التشغيل بدون حمل والشبكة سليمة يُعدّ اختبارًا',
  set_test_interval_days: 'الفترة المتوقعة بين الاختبارات (0 = بدون متابعة)',
  set_no_data_close_min: 'التشغيل بدون قراءات يُغلق بعد',
  set_refill_min_pct: 'ارتفاع المستوى الذي يُعدّ تعبئة',
  set_refill_settle_min: 'تُغلق التعبئة بعد استقرار المستوى',
  set_drop_min_pct: 'انخفاض أثناء التوقف يُسجَّل للفحص',
  set_fuel_window_h: 'نافذة مقارنة مستوى الوقود',
  set_retention_days: 'الاحتفاظ بالسجل',
};
