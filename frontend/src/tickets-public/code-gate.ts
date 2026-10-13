/**
 * CR-038 slice 7 (option B, spec 10.5 / 10.7): the "code required" and "locked" states of the handler page - pure logic, no
 * DOM, no framework (the public bundle is small and framework-free; tickets-public/code-gate-view.ts renders it).
 *
 * The page asks `GET /t/api/ticket`; a code-protected link without a code session answers only the number, department and
 * organisation with `code_required: true, code_ok: false` (+ `code_locked_s` while locked). The gate then:
 *   1. "שליחת קוד" -> `POST /t/api/code/send {}` -> 200 {sent, channel, expires_in_s} | 429 rate_limited / code_locked {retry_after_s}
 *      | 503 code_unavailable | 409 code_not_required | 404 (the link is gone);
 *   2. six digits -> `POST /t/api/code/verify {code}` -> 200 {session, expires_in_s} | 422 code_invalid {attempts_left} /
 *      code_expired / code_missing / code_malformed | 429 code_locked {retry_after_s} | 404;
 *   3. a session -> kept in memory and sessionStorage (the page's own token store) and sent as `X-Ticket-Session`; the page
 *      reloads the ticket.
 * The 6 digits are never kept beyond the input field; nothing here logs.
 *
 * Texts in the four page languages (D26: he / ar RTL, en / ru LTR). None of them names the module or the item (the owner's
 * rename of 2026-10-14 - the page says "code", never the item noun). The Arabic and Russian lines need a native speaker's
 * review before the release (slice 8, as the message starters).
 */

export type GateLang = 'he' | 'en' | 'ar' | 'ru';
export type GatePhase = 'idle' | 'sending' | 'sent' | 'verifying' | 'locked' | 'unavailable' | 'done' | 'gone';
export type GateNotice =
  | 'code_invalid' | 'code_expired' | 'code_missing' | 'code_malformed' | 'rate_limited' | 'busy' | 'error' | null;

export interface GateState {
  phase: GatePhase;
  channel: 'whatsapp' | 'email' | null;
  /** epoch ms: when the sent code expires (sent phase) */
  expiresAt: number | null;
  /** epoch ms: when the lock ends (locked phase) or when a new code may be asked for (rate_limited) */
  waitUntil: number | null;
  attemptsLeft: number | null;
  notice: GateNotice;
  session: string | null;
}

export const INITIAL: GateState = { phase: 'idle', channel: null, expiresAt: null, waitUntil: null, attemptsLeft: null, notice: null, session: null };

/** What the page needs from `GET /t/api/ticket`. */
export interface TicketView { code_required?: boolean; code_ok?: boolean; code_locked_s?: number }

/** The gate's state when the ticket view arrives (a reload keeps a sent code's phase unless the server says locked). */
export function fromView(view: TicketView, prev: GateState = INITIAL, now: number = Date.now()): GateState {
  if (!view.code_required || view.code_ok) return { ...INITIAL, phase: 'done', session: prev.session };
  if (view.code_locked_s && view.code_locked_s > 0) return { ...INITIAL, phase: 'locked', waitUntil: now + view.code_locked_s * 1000 };
  if (prev.phase === 'sent' && prev.expiresAt && prev.expiresAt > now) return prev;
  return { ...INITIAL };
}

/** An answer of the public API: the status and the parsed JSON body (or {} for a non-JSON body). */
export interface Answer { status: number; body: Record<string, unknown> }

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function common(s: GateState, a: Answer, now: number): GateState | null {
  const code = typeof a.body.code === 'string' ? a.body.code : '';
  if (a.status === 404) return { ...INITIAL, phase: 'gone' };
  if (a.status === 429 && code === 'code_locked') {
    return { ...INITIAL, phase: 'locked', waitUntil: now + (num(a.body.retry_after_s) ?? 1800) * 1000, attemptsLeft: 0 };
  }
  if (a.status === 429 && code === 'rate_limited') {
    return { ...s, phase: s.expiresAt && s.expiresAt > now ? 'sent' : 'idle', notice: 'rate_limited', waitUntil: now + (num(a.body.retry_after_s) ?? 60) * 1000 };
  }
  if (a.status === 429) return { ...s, phase: s.phase === 'verifying' ? 'sent' : 'idle', notice: 'busy' };
  if (a.status === 503 && code === 'code_unavailable') return { ...INITIAL, phase: 'unavailable' };
  if (a.status === 409 && code === 'code_not_required') return { ...INITIAL, phase: 'done' };
  return null;
}

export function onSendStart(s: GateState): GateState {
  return { ...s, phase: 'sending', notice: null };
}

export function onSendAnswer(s: GateState, a: Answer, now: number = Date.now()): GateState {
  if (a.status === 200 && a.body.sent === true) {
    const ch = a.body.channel === 'email' ? 'email' : 'whatsapp';
    return { ...INITIAL, phase: 'sent', channel: ch, expiresAt: now + (num(a.body.expires_in_s) ?? 600) * 1000 };
  }
  return common(s, a, now) ?? { ...s, phase: 'idle', notice: 'error' };
}

export function onVerifyStart(s: GateState): GateState {
  return { ...s, phase: 'verifying', notice: null };
}

export function onVerifyAnswer(s: GateState, a: Answer, now: number = Date.now()): GateState {
  if (a.status === 200 && typeof a.body.session === 'string') return { ...INITIAL, phase: 'done', session: a.body.session };
  const shared = common(s, a, now);
  if (shared) return shared;
  const code = typeof a.body.code === 'string' ? a.body.code : '';
  if (a.status === 422 && code === 'code_invalid') return { ...s, phase: 'sent', notice: 'code_invalid', attemptsLeft: num(a.body.attempts_left) };
  if (a.status === 422 && code === 'code_malformed') return { ...s, phase: 'sent', notice: 'code_malformed' };
  if (a.status === 422 && (code === 'code_expired' || code === 'code_missing')) {
    return { ...INITIAL, phase: 'idle', notice: code };
  }
  return { ...s, phase: 'sent', notice: 'error' };
}

/** The six digits the field holds, or null (spaces / a dash between groups, any script's digits - like the server's parse). */
export function cleanCode(raw: string): string | null {
  const digits: string[] = [];
  for (const ch of raw.trim()) {
    if (/[\s\-‐-–]/.test(ch)) continue;
    const d = digitOf(ch);
    if (d === null) return null;
    digits.push(d);
    if (digits.length > 6) return null;
  }
  return digits.length === 6 ? digits.join('') : null;
}

const ZEROS = [0x30, 0x660, 0x6f0, 0xff10];
function digitOf(ch: string): string | null {
  const cp = ch.codePointAt(0) ?? -1;
  for (const z of ZEROS) if (cp >= z && cp <= z + 9) return String(cp - z);
  return null;
}

/** Whole minutes (rounded up) left until `until`, at least 1. */
export function minutesLeft(until: number | null, now: number = Date.now()): number {
  return Math.max(1, Math.ceil(((until ?? now) - now) / 60000));
}

export function secondsLeft(until: number | null, now: number = Date.now()): number {
  return Math.max(1, Math.ceil(((until ?? now) - now) / 1000));
}

// ---------------------------------------------------------------- the words (D26)

export const GATE_TEXT = {
  he: {
    title: 'נדרש קוד אימות',
    send: 'שליחת קוד',
    resend: 'שליחת קוד חדש',
    sending: 'שולח…',
    sentWhatsapp: 'הקוד נשלח בוואטסאפ',
    sentEmail: 'הקוד נשלח במייל',
    field: 'קוד בן 6 ספרות',
    verify: 'אישור',
    verifying: 'בודק…',
    code_invalid: 'הקוד שגוי. נותרו {n} ניסיונות',
    code_malformed: 'יש להקליד 6 ספרות',
    code_expired: 'תוקף הקוד פג. בקשו קוד חדש',
    code_missing: 'בקשו קוד חדש',
    rate_limited: 'אפשר לבקש קוד חדש בעוד {s} שניות',
    busy: 'יש עומס. נסו שוב בעוד דקה.',
    error: 'משהו השתבש. נסו שוב',
    locked: 'יותר מדי ניסיונות. נסו שוב בעוד {m} דקות',
    unavailable: 'לא ניתן לשלוח קוד כרגע. פנו למנהל',
  },
  ar: {
    title: 'مطلوب رمز تحقق',
    send: 'إرسال رمز',
    resend: 'إرسال رمز جديد',
    sending: 'جارٍ الإرسال…',
    sentWhatsapp: 'تم إرسال الرمز عبر واتساب',
    sentEmail: 'تم إرسال الرمز بالبريد الإلكتروني',
    field: 'رمز من 6 أرقام',
    verify: 'تأكيد',
    verifying: 'جارٍ التحقق…',
    code_invalid: 'الرمز غير صحيح. المحاولات المتبقية: {n}',
    code_malformed: 'يجب إدخال 6 أرقام',
    code_expired: 'انتهت صلاحية الرمز. اطلبوا رمزًا جديدًا',
    code_missing: 'اطلبوا رمزًا جديدًا',
    rate_limited: 'يمكن طلب رمز جديد بعد {s} ثانية',
    busy: 'يوجد ضغط. حاولوا مرة أخرى بعد دقيقة.',
    error: 'حدث خطأ. حاولوا مرة أخرى',
    locked: 'محاولات كثيرة جدًا. حاولوا مرة أخرى بعد {m} دقيقة',
    unavailable: 'لا يمكن إرسال رمز الآن. توجهوا إلى المدير',
  },
  en: {
    title: 'A verification code is required',
    send: 'Send a code',
    resend: 'Send a new code',
    sending: 'Sending…',
    sentWhatsapp: 'The code was sent by WhatsApp',
    sentEmail: 'The code was sent by e-mail',
    field: '6-digit code',
    verify: 'Confirm',
    verifying: 'Checking…',
    code_invalid: 'Wrong code. {n} attempts left',
    code_malformed: 'Type 6 digits',
    code_expired: 'The code expired. Ask for a new one',
    code_missing: 'Ask for a new code',
    rate_limited: 'A new code can be asked for in {s} seconds',
    busy: 'Busy. Try again in a minute.',
    error: 'Something went wrong. Try again',
    locked: 'Too many attempts. Try again in {m} minutes',
    unavailable: 'A code cannot be sent right now. Contact the manager',
  },
  ru: {
    title: 'Требуется код подтверждения',
    send: 'Отправить код',
    resend: 'Отправить новый код',
    sending: 'Отправка…',
    sentWhatsapp: 'Код отправлен в WhatsApp',
    sentEmail: 'Код отправлен по e-mail',
    field: 'Код из 6 цифр',
    verify: 'Подтвердить',
    verifying: 'Проверка…',
    code_invalid: 'Неверный код. Осталось попыток: {n}',
    code_malformed: 'Введите 6 цифр',
    code_expired: 'Срок действия кода истёк. Запросите новый',
    code_missing: 'Запросите новый код',
    rate_limited: 'Новый код можно запросить через {s} с',
    busy: 'Высокая нагрузка. Повторите через минуту.',
    error: 'Что-то пошло не так. Повторите',
    locked: 'Слишком много попыток. Повторите через {m} мин',
    unavailable: 'Сейчас нельзя отправить код. Обратитесь к менеджеру',
  },
} as const;

export type GateTextKey = keyof (typeof GATE_TEXT)['he'];
export const RTL_LANGS: readonly GateLang[] = ['he', 'ar'];

export function gateText(lang: GateLang, key: GateTextKey, vars?: Record<string, string | number>): string {
  const t: string = (GATE_TEXT[lang] ?? GATE_TEXT.he)[key] ?? GATE_TEXT.he[key];
  return vars ? t.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : t;
}

/** The one status line the gate shows for a state (null = none). */
export function statusLine(s: GateState, lang: GateLang, now: number = Date.now()): string | null {
  switch (s.phase) {
    case 'locked': return gateText(lang, 'locked', { m: minutesLeft(s.waitUntil, now) });
    case 'unavailable': return gateText(lang, 'unavailable');
    default: break;
  }
  if (s.notice === 'code_invalid') return gateText(lang, 'code_invalid', { n: s.attemptsLeft ?? 0 });
  if (s.notice === 'rate_limited') return gateText(lang, 'rate_limited', { s: secondsLeft(s.waitUntil, now) });
  if (s.notice) return gateText(lang, s.notice);
  if (s.phase === 'sent') return gateText(lang, s.channel === 'email' ? 'sentEmail' : 'sentWhatsapp');
  return null;
}

/** What the gate offers in a state: the send button (and its label), the code field with the confirm button. */
export function controls(s: GateState): { send: 'send' | 'resend' | null; field: boolean; busy: boolean } {
  if (s.phase === 'locked' || s.phase === 'unavailable' || s.phase === 'done' || s.phase === 'gone') return { send: null, field: false, busy: false };
  const busy = s.phase === 'sending' || s.phase === 'verifying';
  const sent = s.phase === 'sent' || s.phase === 'verifying';
  return { send: sent ? 'resend' : 'send', field: sent, busy };
}
