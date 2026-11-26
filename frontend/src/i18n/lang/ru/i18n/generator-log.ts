// CR-I18N-LAZY-LANG-2443: language pack table of src/i18n/generator-log.ts, fetched only when the page is in this language (i18n/lang-packs.ts).
// Moved by scripts/i18n-split-langs.mjs; edit the texts here.
/* eslint-disable */

export const ru = {
  page: 'Журнал запусков',
  title: 'Журнал запусков генератора',
  kind_test: 'Тест',
  kind_mains_failure: 'Отключение сети',
  kind_manual: 'Вручную',
  kind_other: 'Другое',
  kpiRuns: 'Запуски',
  kpiHours: 'Моточасы',
  kpiFuel: 'Израсходовано топлива',
  empty: 'Нет запусков в диапазоне',
  prev: 'Назад',
  next: 'Далее',
  // GEN-UNITS-ARRU-2530: the settings section (Settings > Infrastructure > Generator > run log); the unit sits in the field frame
  setSub: 'Журнал запусков',
  setIntro: 'Журнал запусков строится по показаниям контроллера и ничего не отправляет в контроллер. Все пороги и окна здесь.',
  setEnabled: 'Показывать журнал запусков на экране генератора',
  set_min_run_s: 'Запуск короче этого не записывается',
  set_mains_lookback_s: 'Сеть пропала за столько до запуска = отключение сети',
  set_test_min_minutes: 'Тест короче этого помечается «короткий тест»',
  set_test_max_minutes: 'Работа без нагрузки дольше этого — не тест',
  set_classify_unloaded_as_test: 'Работа без нагрузки при наличии сети считается тестом',
  set_test_interval_days: 'Ожидаемый интервал тестов (0 = не отслеживать)',
  set_no_data_close_min: 'Запуск без показаний закрывается через',
  set_refill_min_pct: 'Рост уровня, считающийся заправкой',
  set_refill_settle_min: 'Заправка закрывается, когда уровень стабилен',
  set_drop_min_pct: 'Падение в покое, записываемое для проверки',
  set_fuel_window_h: 'Окно сравнения уровня топлива',
  set_retention_days: 'Хранить журнал',
};
