// CR-I18N-LAZY-LANG-2443: language pack table of src/i18n/app-signin.ts, fetched only when the page is in this language (i18n/lang-packs.ts).
// Moved by scripts/i18n-split-langs.mjs; edit the texts here.
/* eslint-disable */

export const en = {
  title: 'Sign-in from the phone app',
  sub: 'For a system administrator. Switching on works from the local network only; switching off works anywhere and disconnects at once.',
  refresh: 'Saved sign-in in the app', refreshHint: 'The app stays signed in without a password every time it opens. Switching it off ends the saved sign-in on every phone at once.',
  exchange: 'App screen sign-in', exchangeHint: 'The app screen opens signed in with a one-time code, without asking for a password. Needs the saved sign-in on.',
  off: 'Off', on: 'On', localOnly: 'Switching on is done from the local network only', needsRefresh: 'Switch the saved sign-in on first',
  accessTooLong: 'While the app screen sign-in is on, the access token lasts at most {max} minutes (now {n}). Shorten it first.',
  save: 'Save', saved: 'Settings saved', savedEnded: 'Settings saved · {n} saved sign-ins ended', confirmTitle: 'Save and disconnect?',
  confirmRefresh: 'The saved sign-in on every phone ends now. Every user will be asked to sign in again in the app.',
  confirmExchange: 'The app screens opened by this sign-in are disconnected now.', confirmGo: 'Save and disconnect', cancel: 'Cancel',
  loadError: 'The phone app sign-in settings could not be loaded', demo: 'Demo data: the settings are saved against a server only.',
};
