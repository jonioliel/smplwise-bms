/**
 * Strings of a station's live video and two-way talk in the stations screen's drawer (CR-036 slice S18), Hebrew (the product
 * language) and English, switched by the document's `lang` like i18n/wiskey-stations.ts. UI_COPY_RULES: an operator screen never
 * names the platform or a protocol and never shows an internal code; short words, no explanatory paragraphs.
 */
const he = {
  live: {
    label: 'שידור חי',
    quality: 'איכות',
    sub: 'רגילה',
    main: 'גבוהה',
    poster: 'תמונה אחרונה',
  },
  talk: {
    label: 'דיבור',
    start: 'פתח דיבור',
    starting: 'פותח דיבור…',
    muted: 'מיקרופון מושתק',
    talking: 'מיקרופון פתוח',
    mute: 'השתק',
    unmute: 'בטל השתקה',
    headset: 'מומלץ להשתמש באוזניות',
    end: 'סיום דיבור',
    left: 'נותרו {t}',
    openDrawer: 'דיבור',
    busy: 'העמדה בדיבור עם מפעיל אחר',
    ended: 'הדיבור הסתיים',
    problems: {
      insecure: 'מיקרופון זמין רק בחיבור מאובטח',
      denied: 'המיקרופון חסום בדפדפן',
      no_mic: 'לא נמצא מיקרופון',
      mic_busy: 'המיקרופון תפוס',
      busy: 'העמדה בדיבור עם מפעיל אחר',
      user_busy: 'פתוח אצלך דיבור עם עמדה אחרת',
      forbidden: 'אין הרשאה לדבר עם העמדה',
      unsupported: 'דיבור זמין בלוח הקלאסי',
      off: 'דיבור כבוי',
      offline: 'העמדה אינה מחוברת',
      unavailable: 'דיבור אינו זמין כרגע',
      expired: 'זמן הדיבור הסתיים',
      upstream: 'ערוץ הדיבור נסגר',
      network: 'החיבור נותק',
      access_lost: 'ההרשאה לדיבור הוסרה',
      failed: 'לא ניתן לפתוח דיבור',
    },
  },
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type StationMediaText = Widen<typeof he>;

const en: StationMediaText = {
  live: {
    label: 'Live',
    quality: 'Quality',
    sub: 'Standard',
    main: 'High',
    poster: 'Last picture',
  },
  talk: {
    label: 'Talk',
    start: 'Start talk',
    starting: 'Opening talk…',
    muted: 'Microphone muted',
    talking: 'Microphone open',
    mute: 'Mute',
    unmute: 'Unmute',
    headset: 'A headset is recommended',
    end: 'End talk',
    left: '{t} left',
    openDrawer: 'Talk',
    busy: 'Another operator is talking to this station',
    ended: 'Talk ended',
    problems: {
      insecure: 'The microphone needs a secure connection',
      denied: 'The microphone is blocked in the browser',
      no_mic: 'No microphone found',
      mic_busy: 'The microphone is in use',
      busy: 'Another operator is talking to this station',
      user_busy: 'You already talk to another station',
      forbidden: 'No permission to talk to this station',
      unsupported: 'Talk is available in the classic panel',
      off: 'Talk is off',
      offline: 'The station is offline',
      unavailable: 'Talk is not available right now',
      expired: 'Talk time is over',
      upstream: 'The talk channel closed',
      network: 'The connection dropped',
      access_lost: 'Talk permission was removed',
      failed: 'Talk could not be opened',
    },
  },
};

export function smt(): StationMediaText {
  return (document.documentElement.lang || '').toLowerCase().startsWith('en') ? en : he;
}

export const heStationMediaText: StationMediaText = he;
export const enStationMediaText: StationMediaText = en;

export function fill(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** m:ss for the countdown (always LTR digits). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
