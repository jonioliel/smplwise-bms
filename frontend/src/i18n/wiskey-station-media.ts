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
  // WISKEY-TALK-DIAL-2382: "dial the station" in the drawer's call section - Arx's own talk session, its in-call state, and why not
  dial: {
    dial: 'חיוג לעמדה',
    talk: 'דיבור עם העמדה',
    inCall: 'בשיחה',
    hangUp: 'ניתוק',
    classic: 'בלוח הקלאסי',
    reasons: {
      off: 'דיבור מהמסך כבוי בהגדרות (וידאו בלבד)',
      provider_local: 'המקור המקומי מציג וידאו בלבד, בלי דיבור',
      pairing: 'חסר צימוד חתום למערכת האינטרקום, ולכן אין דיבור מהמסך',
      not_listed: 'מערכת האינטרקום לא מפרסמת פקודות דיבור ל-Arx',
      capabilities_unread: 'לא ניתן היה לבדוק מול מערכת האינטרקום אם דיבור זמין; מוצג וידאו בלבד',
      unsupported: 'העמדה הזו לא מציעה דיבור',
      wiskey_unavailable: 'מערכת האינטרקום לא זמינה כרגע; מוצג וידאו מהמקור המקומי',
      forbidden: 'אין הרשאה לדבר עם העמדה',
      unavailable: 'דיבור אינו זמין כרגע',
    },
  },
  // WISKEY-TALK-DIAL-2382: Settings › מתגי מסכי כניסה › תצוגת מסך התחנות - the media source and what WisKey mode still needs
  source: {
    label: 'מקור הווידאו והדיבור',
    local: 'Arx (וידאו בלבד)',
    auto: 'WisKey (וידאו ודיבור)',
    checking: 'בודק מה נדרש למצב WisKey…',
    failed: 'לא ניתן לבדוק כרגע מה נדרש למצב WisKey',
    ok: 'WisKey מוכן: וידאו ודיבור מתוך המסך',
    okLocal: 'WisKey מוכן. בחירה ב-WisKey תאפשר גם דיבור מתוך המסך',
    missing: 'חסר למצב WisKey: {list}',
    fallback: 'עד אז מוצג וידאו מ-Arx בלבד',
    videoOnly: 'עד אז WisKey מציג וידאו בלבד',
    codes: {
      wiskey_unreachable: 'WisKey לא זמין כרגע',
      api_incompatible: 'גרסת WisKey אינה תואמת לגרסה הזו',
      video_not_listed: 'WisKey לא מפרסם פקודות וידאו ל-Arx',
      talk_not_listed: 'WisKey לא מפרסם פקודות דיבור ל-Arx',
      capabilities_unread: 'בדיקת היכולות החתומה מול WisKey נכשלה ({kind})',
      pairing_missing: 'אין צימוד חתום ל-WisKey',
      pairing_key_rotated: 'מפתח הצימוד הוחלף ו-WisKey עוד לא מקבל אותו',
    },
    // WISKEY-TALK-CAPS-2382: why the signed capabilities read failed (services/wiskey_media_caps.py reason_kind)
    capsKinds: {
      unreachable: 'WisKey לא ענה',
      refused: 'WisKey דחה את החיבור החתום',
      clock: 'השעונים של Arx ושל WisKey אינם מתואמים',
      incompatible: 'התשובה של WisKey אינה בפורמט שהגרסה הזו קוראת',
      failed: 'סיבה לא ידועה',
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
  dial: {
    dial: 'Call the station',
    talk: 'Talk to the station',
    inCall: 'In call',
    hangUp: 'Hang up',
    classic: 'In the classic panel',
    reasons: {
      off: 'Talk from this screen is off in Settings (video only)',
      provider_local: 'The local source shows video only, without talk',
      pairing: 'No signed pairing with the intercom, so no talk from this screen',
      not_listed: 'The intercom does not publish talk commands to Arx',
      capabilities_unread: 'Could not check with the intercom whether talk is available; video only',
      unsupported: 'This station offers no talk',
      wiskey_unavailable: 'The intercom is not reachable now; the local source shows the video',
      forbidden: 'No permission to talk to this station',
      unavailable: 'Talk is not available right now',
    },
  },
  source: {
    label: 'Video and talk source',
    local: 'Arx (video only)',
    auto: 'WisKey (video and talk)',
    checking: 'Checking what WisKey mode needs…',
    failed: 'Cannot check what WisKey mode needs right now',
    ok: 'WisKey is ready: video and talk from this screen',
    okLocal: 'WisKey is ready. Choosing WisKey also enables talk from this screen',
    missing: 'WisKey mode still needs: {list}',
    fallback: 'until then Arx shows video only',
    videoOnly: 'until then WisKey shows video only',
    codes: {
      wiskey_unreachable: 'WisKey is not reachable now',
      api_incompatible: 'the WisKey version does not match this one',
      video_not_listed: 'WisKey does not publish video commands to Arx',
      talk_not_listed: 'WisKey does not publish talk commands to Arx',
      capabilities_unread: 'the signed capabilities check with WisKey failed ({kind})',
      pairing_missing: 'no signed pairing with WisKey',
      pairing_key_rotated: 'the pairing key was rotated and WisKey does not accept it yet',
    },
    capsKinds: {
      unreachable: 'WisKey did not answer',
      refused: 'WisKey refused the signed connection',
      clock: 'the clocks of Arx and WisKey disagree',
      incompatible: 'WisKey answered in a format this version does not read',
      failed: 'unknown reason',
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
