// CR-I18N-LAZY-LANG-2443: language pack table of src/i18n/tts-default.ts, fetched only when the page is in this language (i18n/lang-packs.ts).
// Moved by scripts/i18n-split-langs.mjs; edit the texts here.
/* eslint-disable */

export const en = {
  setting: {
    engine: 'Fixed announcement engine',
    engineText: 'Preselected in every announcement: at a station, from the station drawer and to several stations. Another engine can be picked for one announcement',
    systemDefault: 'System default',
    systemDefaultNow: 'The system default now: {name}',
    language: 'Announcement language',
    languageText: 'From the languages of the chosen engine',
    languageAuto: 'Automatic (Hebrew when available)',
    loading: 'Loading the engine list…',
    listUnavailable: 'The engine list is not available right now. The saved choice stays',
    noEngines: 'No announcement engine is available right now',
    missing: 'The fixed engine {engine} is not available right now',
    missingOption: '{engine} · not available right now',
    missingLanguageOption: '{language} · not supported by the engine',
  },
  dialog: {
    missingEngine: 'The fixed engine {engine} is not available right now. Pick another engine for this announcement',
    missingLanguage: 'The fixed language {language} is not supported by this engine. {auto} was chosen',
    pickEngine: 'Pick an engine…',
    fixedTag: 'fixed',
    overridden: 'For this announcement only. The fixed setting does not change',
  },
};
