/**
 * WKAUDIN-295: strings of listening to a station in the stations screen's drawer, Hebrew (the product language) and English, switched by the
 * document's `lang` like i18n/wiskey-station-media.ts. UI_COPY_RULES: an operator screen never names the platform or a protocol and never
 * shows an internal code; short words, no explanatory paragraphs.
 */
const he = {
  setting: {
    label: 'האזנה לעמדה',
    text: 'שמע מהעמדה במסך התחנות. בלי הקלטה ובלי שליחה לעמדה',
    off: 'כבויה',
    on: 'פועלת',
    probe: 'ניסיון (סשן משותף)',
  },
  label: 'האזנה לעמדה',
  start: 'האזנה',
  starting: 'פותח האזנה…',
  listening: 'מאזין…',
  stop: 'הפסקת האזנה',
  mute: 'השתקה',
  unmute: 'ביטול השתקה',
  muted: 'מושתק',
  level: 'עוצמת הצליל מהעמדה',
  left: 'נותרו {t}',
  ended: 'ההאזנה הסתיימה',
  problems: {
    busy: 'יותר מדי מאזינים לעמדה',
    user_busy: 'כבר פתוחה אצלך האזנה לעמדה אחרת',
    forbidden: 'אין הרשאה להאזין לעמדה',
    unsupported: 'האזנה אינה זמינה בעמדה הזו',
    no_listen: 'העמדה אינה תומכת בהאזנה',
    off: 'האזנה כבויה',
    offline: 'העמדה אינה מחוברת',
    unavailable: 'האזנה אינה זמינה כרגע',
    expired: 'זמן ההאזנה הסתיים',
    upstream: 'ערוץ ההאזנה נסגר',
    network: 'החיבור נותק',
    access_lost: 'ההרשאה להאזנה הוסרה',
    no_audio: 'בדפדפן אין פלט שמע',
    failed: 'לא ניתן לפתוח האזנה',
  },
};

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type StationListenText = Widen<typeof he>;

const en: StationListenText = {
  setting: {
    label: 'Listening to the station',
    text: 'Sound from the station in the stations screen. Nothing is recorded or sent to the station',
    off: 'Off',
    on: 'On',
    probe: 'Trial (shared session)',
  },
  label: 'Listen to the station',
  start: 'Listen',
  starting: 'Opening…',
  listening: 'Listening…',
  stop: 'Stop listening',
  mute: 'Mute',
  unmute: 'Unmute',
  muted: 'Muted',
  level: 'Sound level from the station',
  left: '{t} left',
  ended: 'Listening ended',
  problems: {
    busy: 'Too many people are listening to the station',
    user_busy: 'You are already listening to another station',
    forbidden: 'You may not listen to this station',
    unsupported: 'Listening is not available at this station',
    no_listen: 'The station does not support listening',
    off: 'Listening is turned off',
    offline: 'The station is offline',
    unavailable: 'Listening is not available right now',
    expired: 'The listening time ended',
    upstream: 'The listening channel closed',
    network: 'The connection was lost',
    access_lost: 'The listening permission was removed',
    no_audio: 'This browser has no audio output',
    failed: 'Listening could not be opened',
  },
};

export function slt(): StationListenText {
  return (document.documentElement.lang || '').toLowerCase().startsWith('en') ? en : he;
}

export const heStationListenText: StationListenText = he;
export const enStationListenText: StationListenText = en;
