/**
 * WKAUDIN-295: strings of listening to a station in the stations screen's drawer, Hebrew (the product language) and English, switched by the
 * document's `lang` like i18n/wiskey-station-media.ts. UI_COPY_RULES: an operator screen never names the platform or a protocol and never
 * shows an internal code; short words, no explanatory paragraphs.
 */
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';
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
type StationListenText = Widen<typeof he>;

const en: StationListenText = packTable<typeof import('./lang/en/i18n/wiskey-station-listen').en>('en', 'i18n/wiskey-station-listen', 'en');

export function slt(): StationListenText {
  return docLang(['en']) === 'en' ? en : he;
}

export const heStationListenText: StationListenText = he;
export const enStationListenText: StationListenText = en;

registerCatalogue('i18n/wiskey-station-listen', { he, en });
