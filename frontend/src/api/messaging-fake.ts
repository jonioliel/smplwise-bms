/**
 * CR-036 S7: the message dialog's client - FAKES ONLY. Every function and class here is named `Fake` / `Draft` on purpose: there
 * is NO real send path in this build. The WisKey side (ask W11) is not delivered, the backend has no message route, and nothing in
 * this file can reach a person's phone.
 *
 *   createFakeDemoTransport()   the static preview's (no backend) in-browser fake: scripted people, a small quota, deterministic
 *                               outcomes; nothing leaves the page.
 *   createFakeDraftTransport()  the DRAFT contract a later slice implements on the server once W11 answers (the routes below).
 *                               The people screen creates it only when the server's `features` reply lists `messaging` as
 *                               available - the real backend never does in this build, so in production it is never created.
 *                               The Playwright specs mock these routes (tests/wiskey-people-mock.ts), which makes that mock the
 *                               executable form of the contract.
 *
 * Draft routes (all under /api/v1/access-control/, Arx RBAC + Arx audit on the server; the audit hook is documented in
 * docs/changes/CR-036-S7-NOTES.md):
 *   GET  messaging                         -> { state, ..., messaging: MessagingConfig }
 *   POST messaging/recipients {person_ids} -> { recipients: RecipientInfo[] }       (a read; POST for the list)
 *   POST people/{id}/messages {template_id|null, text, client_request_id, confirmed:true}
 *                                          -> 200 { sent_at } | an error code below
 *   errors: 403 message_forbidden | 409 message_no_consent | 422 message_no_phone | 422 message_forbidden_content |
 *           422 message_too_long | 403 message_free_text_disabled | 429 message_rate_limited {retry_after_s} |
 *           503 message_service_unavailable | 502 message_not_registered | 504 message_uncertain | 410 message_expired
 * A bulk send is the browser calling the single route one person at a time (sequential, under the rate limit).
 */
import { ApiError, get, post } from './client';
import { commandId } from './request-id';
import type { AcReply } from './access-people';
import { maskPhone } from '../access-control/people-logic';
import type { MessageDraft, MessagingConfig, MessagingTransport, RecipientInfo, SendFailure, SendResult } from '../access-control/messaging-logic';

/** The server's error code of a refused or failed message -> the failure the dialog speaks. An unknown code is `unknown`; a
 * dropped connection is `uncertain` (the request may or may not have gone out: no retry without the sender looking). */
export function sendFailureOf(err: unknown): { reason: SendFailure; retry_after_s?: number } {
  if (!(err instanceof ApiError)) return { reason: 'uncertain' };
  const retry = typeof err.body?.details?.retry_after_s === 'number' ? (err.body.details.retry_after_s as number) : undefined;
  const map: Record<string, SendFailure> = {
    message_no_phone: 'no_phone',
    message_no_consent: 'no_consent',
    message_service_unavailable: 'no_service',
    message_not_registered: 'not_registered',
    message_uncertain: 'uncertain',
    message_expired: 'expired',
    message_free_text_disabled: 'free_text_off',
    message_rate_limited: 'rate',
    message_forbidden_content: 'credential',
    message_too_long: 'too_long',
  };
  const reason = map[err.code] ?? (err.status >= 500 && err.status !== 503 ? 'uncertain' : 'unknown');
  return retry !== undefined ? { reason, retry_after_s: retry } : { reason };
}

export function createFakeDraftTransport(): MessagingTransport {
  return {
    async config() {
      const reply = await get<AcReply<'messaging', MessagingConfig>>('access-control/messaging');
      if (!reply.messaging) throw new Error('messaging_unavailable');
      return reply.messaging;
    },
    async recipients(personIds) {
      const reply = await post<{ recipients: RecipientInfo[] }>('access-control/messaging/recipients', { person_ids: personIds });
      return reply.recipients;
    },
    async send(personId, draft) {
      try {
        const r = await post<{ sent_at: string }>(`access-control/people/${encodeURIComponent(personId)}/messages`, {
          template_id: draft.template_id,
          text: draft.text,
          client_request_id: commandId(),
          confirmed: true,
        });
        return { ok: true, sent_at: r.sent_at };
      } catch (err) {
        return { ok: false, ...sendFailureOf(err) };
      }
    },
  };
}

// ---------------------------------------------------------------- the static preview's fake (no backend: nothing leaves the page)

interface DemoRecipient {
  name: string;
  phone: string | null;
  consent: RecipientInfo['consent'];
  unregistered?: boolean;
}

/** People of the static preview (the ids of the screen's demo page). Invented numbers in the documentation range. */
const DEMO_RECIPIENTS: Record<string, DemoRecipient> = {
  p1: { name: 'דנה כהן', phone: '050-000-0001', consent: 'granted' },
  p2: { name: 'יוסי לוי', phone: '050-000-0002', consent: 'granted' },
  p3: { name: 'מאיה כץ', phone: null, consent: 'unknown' },
  p4: { name: 'אורן ברק', phone: '050-000-0004', consent: 'declined' },
  p5: { name: 'נועה שלו', phone: '050-000-0005', consent: 'unknown', unregistered: true },
};

const DEMO_TEMPLATES = [
  { id: 'card_ready', label: 'כרטיס מוכן', body: 'שלום {name}, כרטיס הכניסה שלך מוכן לאיסוף במשרד.' },
  { id: 'validity_reminder', label: 'תזכורת תוקף', body: 'שלום {name}, תוקף הכניסה שלך מסתיים בקרוב. נא לפנות למשרד.' },
  { id: 'closure', label: 'הכניסה סגורה', body: 'שלום {name}, הכניסה לחניון סגורה היום בין 12:00 ל־14:00.' },
];

export function createFakeDemoTransport(delayMs = 350): MessagingTransport {
  const quota = { limit: 6, used: 0, resets_in_s: 1800 };
  const config = (): MessagingConfig => ({
    enabled: true, can_send: true, can_reveal_phone: true, free_text: true, bulk_max: 20, text_max: 1000, templates: DEMO_TEMPLATES.map((t) => ({ ...t })), quota: { ...quota },
  });
  const wait = () => new Promise<void>((r) => setTimeout(r, delayMs));
  return {
    async config() {
      return config();
    },
    async recipients(ids) {
      return ids.map((id) => {
        const d = DEMO_RECIPIENTS[id];
        return { person_id: id, name: d?.name ?? id, phone_masked: d?.phone ? maskPhone(d.phone) : null, has_phone: d ? d.phone !== null : false, consent: d?.consent ?? 'unknown' };
      });
    },
    async send(id, draft: MessageDraft): Promise<SendResult> {
      await wait();
      const d = DEMO_RECIPIENTS[id];
      if (!d?.phone) return { ok: false, reason: 'no_phone' };
      if (d.consent === 'declined') return { ok: false, reason: 'no_consent' };
      if (quota.used >= quota.limit) return { ok: false, reason: 'rate', retry_after_s: quota.resets_in_s };
      if (d.unregistered) return { ok: false, reason: 'not_registered' };
      if (!draft.text.trim()) return { ok: false, reason: 'empty' };
      quota.used += 1;
      return { ok: true, sent_at: new Date().toISOString() };
    },
  };
}
