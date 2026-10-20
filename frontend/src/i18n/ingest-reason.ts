/** UXFIX-RTL (finding 6): the events banner used to print the ingest's internal code ("מנותק (nvr_not_configured)"). The codes map to plain
 * sentences in four languages; the code itself stays in a tooltip for support. Codes come from services/events_ingest.py: `nvr_not_configured`,
 * `disconnected`, `http_<status>`, and the exception class name of a failed connection (ConnectError, ReadTimeout, ...). */

export type IngestLang = 'he' | 'en' | 'ar' | 'ru';
export type IngestReasonKey = 'notConfigured' | 'rejected' | 'notFound' | 'serverError' | 'timeout' | 'unreachable' | 'disconnected' | 'unknown';

const TEXT: Record<IngestLang, Record<IngestReasonKey, string>> = {
  he: {
    notConfigured: 'לא חובר NVR',
    rejected: 'ה־NVR דחה את פרטי הכניסה',
    notFound: 'ה־NVR לא מגיש את שירות ההתראות',
    serverError: 'ה־NVR החזיר שגיאה',
    timeout: 'ה־NVR לא ענה בזמן',
    unreachable: 'אין חיבור ל־NVR',
    disconnected: 'החיבור נותק',
    unknown: 'סיבה לא ידועה',
  },
  en: {
    notConfigured: 'No NVR is connected',
    rejected: 'The NVR rejected the sign-in details',
    notFound: 'The NVR does not serve the alert stream',
    serverError: 'The NVR returned an error',
    timeout: 'The NVR did not answer in time',
    unreachable: 'The NVR cannot be reached',
    disconnected: 'The connection was lost',
    unknown: 'Unknown reason',
  },
  ar: {
    notConfigured: 'لم يتم ربط جهاز NVR',
    rejected: 'رفض جهاز NVR بيانات الدخول',
    notFound: 'جهاز NVR لا يوفّر خدمة التنبيهات',
    serverError: 'أعاد جهاز NVR خطأ',
    timeout: 'لم يردّ جهاز NVR في الوقت المناسب',
    unreachable: 'لا يمكن الوصول إلى جهاز NVR',
    disconnected: 'انقطع الاتصال',
    unknown: 'سبب غير معروف',
  },
  ru: {
    notConfigured: 'NVR не подключён',
    rejected: 'NVR отклонил данные для входа',
    notFound: 'NVR не предоставляет поток тревог',
    serverError: 'NVR вернул ошибку',
    timeout: 'NVR не ответил вовремя',
    unreachable: 'Нет связи с NVR',
    disconnected: 'Соединение потеряно',
    unknown: 'Причина неизвестна',
  },
};

export function ingestReasonKey(code: string | null | undefined): IngestReasonKey {
  const c = String(code ?? '').trim();
  if (!c) return 'unknown';
  if (c === 'nvr_not_configured') return 'notConfigured';
  if (c === 'disconnected') return 'disconnected';
  const http = /^http_(\d{3})$/.exec(c);
  if (http) {
    const n = Number(http[1]);
    if (n === 401 || n === 403) return 'rejected';
    if (n === 404) return 'notFound';
    if (n >= 500) return 'serverError';
    return 'unknown';
  }
  if (/timeout|timedout/i.test(c)) return 'timeout';
  if (/connect|network|resolve|refused|unreachable|ssl|eof|remoteprotocol|readerror/i.test(c)) return 'unreachable';
  return 'unknown';
}

export function ingestLang(): IngestLang {
  const l = (typeof document !== 'undefined' ? document.documentElement.lang : '').toLowerCase().slice(0, 2);
  return l === 'en' || l === 'ar' || l === 'ru' ? l : 'he';
}

/** The plain sentence for an ingest `last_error` code. Never returns the code itself. */
export function ingestReason(code: string | null | undefined, lang: IngestLang = ingestLang()): string {
  return TEXT[lang][ingestReasonKey(code)];
}

export const INGEST_REASON_TEXT = TEXT;
