/**
 * CR-036 WA: the typed client of the people screen's message dialog and of the Settings page "הודעות" - the routes of
 * routers/access_control_messaging.py (`/api/v1/access-control/...`). The browser never talks to WisKey and never names a WisKey command;
 * it asks these routes, which apply Arx's own permission (`access.people.message`) and rules and hand ONE text to the messaging service.
 * The WisKey side behind them (ask W11) is unanswered: the whole path has only run against the fake WisKey.
 *
 *   GET  messaging                         -> { messaging: MessagingConfig }
 *   POST messaging/recipients {person_ids} -> { recipients: RecipientInfo[] }       (a read; POST for the list)
 *   GET  people/{id}/messages              -> { messages, opt_out, consent }
 *   POST people/{id}/messages              -> { message: {id, sent_at, outcome: 'sent'}, quota } | an error below
 *   PUT  people/{id}/messages/optout       -> { opt_out, consent }
 *   GET/PUT messaging/settings             -> the administrator's settings and templates
 *
 * A send's body: a template send carries `template_id` + the `templates_revision` the sender saw and NO text (the server renders its own);
 * a free send carries `text`. A bulk run is this call once per person, sequentially, under one `bulk_id`.
 * Errors: 403 message_forbidden | 409 message_no_consent | 422 message_no_phone | 422 message_forbidden_content | 422 message_too_long |
 *   422 message_empty | 403 message_free_text_disabled | 429 message_rate_limited {scope: hour|sender|person|station|burst, retry_after_s} |
 *   409 message_outside_hours {next_allowed_at} | 422 message_bulk_too_many | 403 message_optout_clear_forbidden (opt-out route) | 503
 *   message_service_unavailable | 502 message_not_registered | 504 message_uncertain | 410 message_expired | 409 message_template_changed |
 *   409 message_disabled | 409 message_duplicate | 404 intercom_person_not_found.
 */
import { ApiError, get, post, put } from './client';
import { commandId } from './request-id';
import type { AcReply } from './access-people';
import type { Consent, MessageDraft, MessagingConfig, MessagingTransport, PersonMessages, RecipientInfo, SendContext, SendFailure, SendResult } from '../access-control/messaging-logic';

/** The server's error of a refused or failed message -> the failure the dialog speaks. An unknown refusal is `unknown`; a dropped
 * connection or a server fault is `uncertain` (the request may or may not have gone out: no retry without the sender looking). */
export function sendFailureOf(err: unknown): Extract<SendResult, { ok: false }> {
  if (!(err instanceof ApiError)) return { ok: false, reason: 'uncertain' };
  const details = err.body?.details ?? {};
  const retry = typeof details.retry_after_s === 'number' ? (details.retry_after_s as number) : undefined;
  const map: Record<string, SendFailure> = {
    message_no_phone: 'no_phone',
    message_no_consent: 'no_consent',
    message_service_unavailable: 'no_service',
    message_not_registered: 'not_registered',
    message_uncertain: 'uncertain',
    message_expired: 'expired',
    message_free_text_disabled: 'free_text_off',
    message_rate_limited: 'rate',
    intercom_rate_limited: 'rate',
    intercom_busy: 'rate',
    message_forbidden_content: 'credential',
    message_too_long: 'too_long',
    message_empty: 'empty',
    message_forbidden: 'forbidden',
    intercom_person_not_found: 'gone',
    message_template_changed: 'template_changed',
    message_disabled: 'disabled',
    message_duplicate: 'duplicate',
    message_refused: 'refused',
    message_consent_pending: 'consent_pending',
    message_consent_recently_requested: 'consent_recent',
    message_consent_unavailable: 'consent_unavailable',
  };
  let reason: SendFailure = map[err.code] ?? (err.status >= 500 && err.status !== 503 ? 'uncertain' : 'unknown');
  // review F3 / F4 / F5: the caps of one recipient or one station refuse that person only; the sender's own cap, the run window and the
  // send hours would repeat for everyone (they halt a run)
  if (err.code === 'message_rate_limited' && details.scope === 'person') reason = 'person_limit';
  else if (err.code === 'message_rate_limited' && details.scope === 'station') reason = 'station_limit';
  else if (err.code === 'message_outside_hours') reason = 'outside_hours';
  else if (err.code === 'message_bulk_too_many') reason = 'rate';
  const out: Extract<SendResult, { ok: false }> = { ok: false, reason };
  if (retry !== undefined) out.retry_after_s = retry;
  if (reason === 'rate') out.transient = details.scope === 'burst' || err.code === 'intercom_rate_limited' || err.code === 'intercom_busy';
  if (typeof details.templates_revision === 'number') out.templates_revision = details.templates_revision as number;
  return out;
}

type Wire<T> = AcReply<'messaging', T>;

/** The real transport: the typed routes. A new `client_request_id` for every attempt (a repeated one is refused as a duplicate). */
export function createHttpTransport(): MessagingTransport {
  return {
    async config() {
      const reply = await get<Wire<MessagingConfig>>('access-control/messaging');
      if (!reply.messaging) throw new Error('messaging_unavailable');
      return reply.messaging;
    },
    async recipients(personIds) {
      const reply = await post<{ recipients: RecipientInfo[] }>('access-control/messaging/recipients', { person_ids: personIds });
      return reply.recipients;
    },
    async send(personId: string, draft: MessageDraft, ctx: SendContext): Promise<SendResult> {
      const body: Record<string, unknown> = { client_request_id: commandId(), confirmed: true };
      if (draft.template_id !== null) {
        body.template_id = draft.template_id;
        body.templates_revision = ctx.templates_revision;
      } else {
        body.text = draft.text;
      }
      if (ctx.bulk) {
        body.bulk_id = ctx.bulk.id;
        body.bulk_total = ctx.bulk.total;
      }
      try {
        const r = await post<{ message: { sent_at?: string; outcome?: string }; quota?: MessagingConfig['quota'] }>(`access-control/people/${encodeURIComponent(personId)}/messages`, body);
        // WA-CONSENT-LINK: a 202 - the message waits for the person's consent (`held`), or the consent request went out first (`consent_requested`)
        const held = r.message.outcome === 'held' || r.message.outcome === 'consent_requested' ? r.message.outcome : undefined;
        return { ok: true, sent_at: r.message.sent_at ?? '', quota: r.quota ?? null, ...(held ? { held } : {}) };
      } catch (err) {
        return sendFailureOf(err);
      }
    },
    async history(personId) {
      const r = await get<PersonMessages>(`access-control/people/${encodeURIComponent(personId)}/messages`);
      return { messages: r.messages, opt_out: r.opt_out, consent: r.consent, can_clear_opt_out: r.can_clear_opt_out };
    },
    async setOptOut(personId, optedOut) {
      return put<{ opt_out: PersonMessages['opt_out']; consent: Consent }>(`access-control/people/${encodeURIComponent(personId)}/messages/optout`, { opted_out: optedOut });
    },
  };
}

// ---------------------------------------------------------------- the administrator's settings (Settings > access control > messages)

export interface MessagingTemplateDoc {
  /** Absent on a template not saved yet: the server assigns one. */
  id?: string;
  label: string;
  body: string;
}

export interface MessagingSettingsDoc {
  revision: number;
  enabled: boolean;
  free_text: boolean;
  bulk_max: number;
  rate_per_hour: number;
  /** Review F3 (2.6.5): one sender's messages an hour (refusals included), one recipient's a day, one station's people an hour. */
  per_sender_per_hour: number;
  per_person_per_day: number;
  per_station_per_hour: number;
  /** Review F5: messages leave only between these local times (from < to); null = no send hours. */
  send_hours: { from: string; to: string } | null;
  organization: string;
  /** The messaging account (when WisKey has several); '' = the only one. */
  account: string;
  templates: MessagingTemplateDoc[];
  /** WA-CONSENT-LINK (absent from a server that predates it): the first message to a person whose consent is unknown is a consent request. */
  consent_by_link?: boolean;
  consent_wait_days?: number;
  consent_language?: string;
  consent_wa_template?: string;
  consent_wa_language?: string;
}

/** WA-CONSENT-LINK: whether the public page can serve a consent link now, and the fixed rules the editor shows. */
export interface MessagingConsentInfo {
  /** null = it can; else module_off | public_page | key. */
  page_problem: string | null;
  notice_version: string;
  resend_days: number;
  held_per_person: number;
  wait_days: [number, number];
  languages: string[];
  dev_marked_languages: string[];
  /** integ/270 (review C1): false while a WhatsApp Business template cannot be forwarded - the template fields are hidden, a value is refused */
  template_send_supported?: boolean;
}

export interface MessagingLimits {
  templates_max: number;
  label_max: number;
  body_max: number;
  text_max: number;
  organization_max: number;
  bulk_max: [number, number];
  rate_per_hour: [number, number];
  per_sender_per_hour?: [number, number];
  per_person_per_day?: [number, number];
  per_station_per_hour?: [number, number];
  placeholders: string[];
  placeholders_max: number;
}

export interface MessagingService {
  state: string;
  /** True when WisKey lists the commands and the service answered "connected"; null = could not be asked. */
  connected: boolean | null;
  accounts: { id: string; name: string }[];
  /** `account_required` | `account_missing` | `no_account` | null. */
  problem: string | null;
  last_error: string | null;
}

export interface MessagingSettingsReply {
  state: string;
  settings: MessagingSettingsDoc;
  limits: MessagingLimits;
  service: MessagingService;
  consent?: MessagingConsentInfo;
}

/** One problem of a save, as the server names it (`path` like `templates.1.body`, `code` like `credential`). */
export interface SettingsProblem {
  path: string;
  code: string;
}

export const getMessagingSettings = () => get<MessagingSettingsReply>('access-control/messaging/settings');

export const putMessagingSettings = (doc: MessagingSettingsDoc) =>
  put<MessagingSettingsReply>('access-control/messaging/settings', {
    base_revision: doc.revision,
    enabled: doc.enabled,
    free_text: doc.free_text,
    bulk_max: doc.bulk_max,
    rate_per_hour: doc.rate_per_hour,
    per_sender_per_hour: doc.per_sender_per_hour,
    per_person_per_day: doc.per_person_per_day,
    per_station_per_hour: doc.per_station_per_hour,
    send_hours: doc.send_hours,
    organization: doc.organization,
    account: doc.account,
    templates: doc.templates.map((t) => ({ ...(t.id ? { id: t.id } : {}), label: t.label, body: t.body })),
    ...(doc.consent_by_link === undefined ? {} : {
      consent_by_link: doc.consent_by_link, consent_wait_days: doc.consent_wait_days, consent_language: doc.consent_language,
      consent_wa_template: doc.consent_wa_template, consent_wa_language: doc.consent_wa_language,
    }),
  });

/** The per-field problems of a refused save (422 `message_settings_invalid`), or null for any other error. */
export function settingsProblems(err: unknown): SettingsProblem[] | null {
  if (!(err instanceof ApiError) || err.code !== 'message_settings_invalid') return null;
  const list = err.body.details?.errors;
  return Array.isArray(list) ? (list as SettingsProblem[]).filter((p) => p && typeof p.path === 'string' && typeof p.code === 'string') : [];
}

export const isSettingsConflict = (err: unknown): boolean => err instanceof ApiError && err.code === 'message_settings_conflict';
