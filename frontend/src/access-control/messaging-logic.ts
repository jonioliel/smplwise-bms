/**
 * CR-036 S7 / WA: the pure logic of the people screen's message dialog (WhatsApp, one person or a selection) - no DOM, no network, so it
 * is unit-tested in Node (tests/unit-messaging-logic.spec.ts).
 *
 * The real routes exist since slice WA (routers/access_control_messaging.py, typed client api/access-messaging.ts); the WisKey side behind
 * them (ask W11: the send command and its body, the consent model, receipts, limits and error codes) is still unanswered, so the whole
 * path has only ever run against the fake WisKey. The master switch is the administrator's (Settings > access control > messages, OFF
 * until turned on): the screen offers the dialog only when the server's configuration says `feature`.
 *
 * The rules this module owns (owner answers 9 and 10 of 2026-10-12; the server enforces every one of them again):
 *   - approved TEMPLATES and FREE TEXT (an administrator setting): the free-text box starts empty and a template is copied in only when
 *     the sender picks it - nothing is ever inserted automatically;
 *   - a message NEVER carries a PIN or any credential: a template with a credential placeholder is not offered, a text with one
 *     (or one that reads like "code 4821") is not sent;
 *   - the phone number is shown only to a caller who may see it (and then masked); a sender who may not see it (hidden-phone mode)
 *     still sends - the server holds the number;
 *   - the sender sees the recipient's consent, a missing phone, an unreachable service, the allowance, a refusal and an uncertain
 *     outcome as one calm line; "sent" never means "delivered" (there is no receipt), and an uncertain outcome is never retried;
 *   - bulk: one template or text for everyone, a preview that names who will not get it and why, ONE confirmation, sequential sends at
 *     the server's pace, a failure never stops the rest (a refusal that would repeat for everyone does), a per-recipient result table.
 */

export interface MessageTemplate {
  id: string;
  label: string;
  body: string;
}

/** What the server tells THIS caller about messaging (GET /access-control/messaging). Administrator settings (`feature`, `free_text`,
 * `bulk_max`, the templates, the allowance) and the caller's own rights (`can_send`, `can_reveal_phone`) arrive together. */
export interface MessagingConfig {
  /** An administrator switched messaging on (Settings). Off = the screen offers nothing. */
  feature: boolean;
  /** The messaging service is connected (and the feature is on). */
  enabled: boolean;
  /** This caller may send. */
  can_send: boolean;
  /** This caller may see a recipient's phone number (the sensitive level); false = hidden-phone mode. */
  can_reveal_phone: boolean;
  /** Administrator setting: a text typed by the sender is allowed (else templates only). */
  free_text: boolean;
  /** Administrator setting: the most recipients of one bulk send. */
  bulk_max: number;
  text_max: number;
  templates: MessageTemplate[];
  /** The revision of the template catalogue the sender saw: a send carries it back (a changed catalogue is refused, not guessed). */
  templates_revision: number;
  /** Sends allowed in the current window; null = no limit. */
  quota: { limit: number; used: number; resets_in_s: number } | null;
  /** The spacing the server wants between the sends of one bulk run, in milliseconds. */
  pace_ms: number;
}

export type Consent = 'granted' | 'declined' | 'unknown';

export interface RecipientInfo {
  person_id: string;
  name: string;
  /** Null in hidden-phone mode, or when there is no phone. A masked number never has more than its last two digits. */
  phone_masked: string | null;
  /** True / false when the server looked the person up, null when it did not (a selection past the first few): decided as the message goes. */
  has_phone: boolean | null;
  consent: Consent;
  /** False = the caller sees the person but may not message them. Absent = not looked up. */
  allowed?: boolean;
}

/** `template_id` null = free text. For a template, `text` is only what the sender saw (the server renders its own). */
export interface MessageDraft {
  template_id: string | null;
  text: string;
}

export type SendFailure =
  | 'no_phone'
  | 'no_consent'
  | 'no_service'
  | 'not_registered'
  | 'uncertain'
  | 'expired'
  | 'free_text_off'
  | 'rate'
  | 'credential'
  | 'too_long'
  | 'empty'
  | 'forbidden'
  | 'gone'
  | 'template_changed'
  | 'disabled'
  | 'duplicate'
  | 'refused'
  // WA-CONSENT-LINK: consent by link is on and the person has not answered yet / was asked within 30 days / the page cannot serve a link
  | 'consent_pending'
  | 'consent_recent'
  | 'consent_unavailable'
  | 'stopped'
  | 'unknown';

export type SendResult =
  | { ok: true; sent_at: string; quota?: MessagingConfig['quota']; /** WA-CONSENT-LINK: not sent yet - waiting for the person's consent */ held?: 'held' | 'consent_requested' }
  | { ok: false; reason: SendFailure; retry_after_s?: number; /** a rate refusal that passes in moments (the feed's budget), not the hour's allowance */ transient?: boolean; templates_revision?: number };

/** What one send is part of: the revision of the catalogue the sender saw, and - for a bulk run - the run's id and size. */
export interface SendContext {
  templates_revision: number;
  bulk?: { id: string; total: number };
}

export type OutcomeKind = 'sent' | 'refused' | 'unknown' | 'pending' | 'held' | 'dropped'; // held / dropped: WA-CONSENT-LINK

export interface MessageHistoryItem {
  id: string;
  at: string;
  by: string | null;
  kind: 'template' | 'free';
  template_id: string | null;
  template_label: string | null;
  outcome: OutcomeKind;
  reason: string | null;
  bulk: boolean;
}

export interface PersonMessages {
  messages: MessageHistoryItem[];
  /** Set when the person asked not to be messaged (Arx's own list); who marked it and when. */
  opt_out: { at: string; by: string | null } | null;
  consent: Consent;
}

export interface MessagingTransport {
  config(): Promise<MessagingConfig>;
  /** Eligibility of the people the sender picked (names are Arx's own; the phone is masked or absent). */
  recipients(personIds: string[]): Promise<RecipientInfo[]>;
  send(personId: string, draft: MessageDraft, ctx: SendContext): Promise<SendResult>;
  /** The person's message history (who sent which template or "free", when, whether the service accepted it - never the text). */
  history(personId: string): Promise<PersonMessages>;
  /** Mark / clear "asked not to be messaged" (Arx's own list; enforced on every send). */
  setOptOut(personId: string, optedOut: boolean): Promise<{ opt_out: PersonMessages['opt_out']; consent: Consent }>;
}

// ---------------------------------------------------------------- the credential guard

/** A placeholder that would put a credential into a text: {pin}, {code}, {card}, {password}, {token}, {credential...}. */
const CREDENTIAL_PLACEHOLDER = /\{\s*(?:pin|code|passcode|card|password|token|credential|secret)\w*\s*\}/i;
/** The words that introduce a code, followed within a few characters by a run of 4-8 digits: "code 4821", "PIN: 123456", "קוד הגישה 4821". */
const CREDENTIAL_WORDS = /(?:\bpin\b|\bcode\b|passcode|password|קוד|סיסמ[הא]|סיסמת|פין)[^\d\n]{0,14}\d{4,8}/i;

export const hasCredentialPlaceholder = (text: string): boolean => CREDENTIAL_PLACEHOLDER.test(text);

/** The text reads like a PIN or access code (a best-effort guard on what a sender TYPES; templates never carry one, and nothing in the
 * browser knows a PIN). The server runs the same check - services/intercom_messaging.py - and is the judge. */
export const looksLikeCredential = (text: string): boolean => hasCredentialPlaceholder(text) || CREDENTIAL_WORDS.test(text);

/** The templates the dialog may offer: an approved template that carries a credential placeholder is not one (the server refuses to save
 * one; this keeps a faulty catalogue from reaching the sender). */
export function usableTemplates(templates: readonly MessageTemplate[]): MessageTemplate[] {
  return templates.filter((t) => t.id && t.body.trim() && !hasCredentialPlaceholder(t.body));
}

/** A template body with `{name}`-style placeholders replaced; an unknown placeholder is left as is (the server renders for real). */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

// ---------------------------------------------------------------- quota and time

export const quotaLeft = (q: MessagingConfig['quota']): number | null => (q ? Math.max(0, q.limit - q.used) : null);
export const retryMinutes = (seconds: number | undefined): number => Math.max(1, Math.ceil((seconds ?? 60) / 60));

// ---------------------------------------------------------------- the single composer

export type ComposerPhase = 'idle' | 'sending' | 'sent' | 'failed';

export interface ComposerInputs {
  config: MessagingConfig;
  recipient: RecipientInfo | null;
  draft: MessageDraft;
  phase: ComposerPhase;
  failure?: SendFailure;
  retryAfterS?: number;
}

export interface ComposerLine {
  tone: 'ok' | 'warn' | 'err' | 'wait';
  /** A key of i18n/access-people.ts `msg.reason.*` for a failure (the line's text is built by the dialog), or the phase word. */
  kind: 'sending' | 'sent' | 'failed' | 'rate' | 'cant';
  reason?: SendFailure;
  minutes?: number;
}

export interface ComposerView {
  /** Why nothing can be sent now (the sender's text box is dimmed and "send" disabled); null = nothing in the way. */
  blocked: SendFailure | null;
  canSend: boolean;
  textDisabled: boolean;
  line: ComposerLine | null;
}

/** Why a message to this recipient cannot go out at all (before any text is looked at). A recipient the server did not look up
 * (`has_phone` null) is not blocked: it is decided as the message goes. */
export function recipientBlock(config: MessagingConfig, recipient: RecipientInfo | null): SendFailure | null {
  if (!config.enabled) return 'no_service';
  if (!recipient || recipient.has_phone === false) return 'no_phone';
  if (recipient.allowed === false) return 'forbidden';
  if (recipient.consent === 'declined') return 'no_consent';
  return null;
}

/** What the sender can do with this text: null = fine. */
export function draftProblem(config: MessagingConfig, draft: MessageDraft): SendFailure | null {
  const text = draft.text.trim();
  if (!text) return 'empty';
  if (draft.template_id === null && !config.free_text) return 'free_text_off';
  if (text.length > config.text_max) return 'too_long';
  if (looksLikeCredential(text)) return 'credential';
  return null;
}

export function composerView(i: ComposerInputs): ComposerView {
  const blocked = recipientBlock(i.config, i.recipient);
  const exhausted = i.config.quota !== null && quotaLeft(i.config.quota) === 0;
  if (i.phase === 'sending') return { blocked, canSend: false, textDisabled: true, line: { tone: 'wait', kind: 'sending' } };
  if (i.phase === 'sent') return { blocked, canSend: !blocked && !exhausted && draftProblem(i.config, i.draft) === null, textDisabled: false, line: { tone: 'ok', kind: 'sent' } };
  if (blocked) return { blocked, canSend: false, textDisabled: true, line: { tone: 'warn', kind: 'cant', reason: blocked } };
  if (exhausted || (i.phase === 'failed' && i.failure === 'rate')) {
    return { blocked: 'rate', canSend: false, textDisabled: false, line: { tone: 'warn', kind: 'rate', minutes: retryMinutes(i.retryAfterS ?? i.config.quota?.resets_in_s) } };
  }
  const problem = draftProblem(i.config, i.draft);
  if (i.phase === 'failed' && i.failure) return { blocked: null, canSend: problem === null, textDisabled: false, line: { tone: 'err', kind: 'failed', reason: i.failure } };
  if (problem === 'credential' || problem === 'too_long' || problem === 'free_text_off') {
    return { blocked: null, canSend: false, textDisabled: false, line: { tone: 'err', kind: 'cant', reason: problem } };
  }
  return { blocked: null, canSend: problem === null, textDisabled: false, line: null };
}

// ---------------------------------------------------------------- bulk

export interface BulkPlan {
  send: RecipientInfo[];
  skip: { recipient: RecipientInfo; reason: SendFailure }[];
  /** The selection is longer than the administrator's bulk limit. */
  tooMany: boolean;
  /** The quota left is smaller than the number to send (the sender must shrink the selection); null = fits. */
  overQuota: number | null;
  /** Nothing in the way of pressing "send". */
  canSend: boolean;
}

/** Who gets the message and who does not (and why). `recipients` are those the sender selected. */
export function bulkPlan(recipients: readonly RecipientInfo[], config: MessagingConfig, draft: MessageDraft): BulkPlan {
  const send: RecipientInfo[] = [];
  const skip: BulkPlan['skip'] = [];
  for (const r of recipients) {
    const reason = recipientBlock(config, r);
    if (reason) skip.push({ recipient: r, reason });
    else send.push(r);
  }
  const tooMany = recipients.length > config.bulk_max;
  const left = quotaLeft(config.quota);
  const overQuota = left !== null && send.length > left ? left : null;
  return { send, skip, tooMany, overQuota, canSend: send.length > 0 && !tooMany && overQuota === null && draftProblem(config, draft) === null };
}

/** One line of the per-recipient result table. `status`: sent (the service accepted it), failed (it was not sent) or unknown (it was
 * handed on and the answer is unknown - never retried). */
export interface BulkRow {
  id: string;
  status: 'sent' | 'failed' | 'unknown' | 'held'; // held: WA-CONSENT-LINK - waiting for the person's consent
  reason?: SendFailure;
  /** ISO time the service accepted it (sent rows). */
  at?: string;
}

export interface BulkOutcome {
  sent: string[];
  failed: { id: string; reason: SendFailure }[];
  /** Every recipient the run dealt with, in order (the result table's rows, the skipped ones first). */
  rows: BulkRow[];
}

export interface BulkOptions {
  onProgress?: (done: number, total: number) => void;
  /** Milliseconds to wait between two sends (the server's `pace_ms`). */
  paceMs?: number;
  /** Replaceable in tests. */
  sleep?: (ms: number) => Promise<void>;
  /** The sender pressed "stop": no further send is started (the one in flight completes). */
  shouldStop?: () => boolean;
  /** How often a burst refusal ("wait a moment") is waited out and tried again for the same person - it provably sent nothing. */
  burstRetries?: number;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** A refusal that would repeat for every later recipient: the run stops and the rest are reported as not sent for it. */
const HALTS: ReadonlySet<SendFailure> = new Set(['rate', 'no_service', 'disabled', 'template_changed', 'consent_unavailable']);

/** Runs the sends one after another at the server's pace (the allowance is per sender, and WisKey's provider is not for floods). A failure
 * never stops the rest, except one that would repeat for everyone (`HALTS`); a burst refusal is waited out and the same person tried
 * again (nothing was sent); an unknown outcome is never retried. A send that throws is `uncertain`. */
export async function runBulk(
  plan: BulkPlan,
  draft: MessageDraft,
  send: (id: string, draft: MessageDraft) => Promise<SendResult>,
  options: BulkOptions | ((done: number, total: number) => void) = {},
): Promise<BulkOutcome> {
  const o: BulkOptions = typeof options === 'function' ? { onProgress: options, paceMs: 0 } : options;
  const sleep = o.sleep ?? realSleep;
  const out: BulkOutcome = { sent: [], failed: [], rows: plan.skip.map((s) => ({ id: s.recipient.person_id, status: 'failed' as const, reason: s.reason })) };
  const total = plan.send.length;
  let halted: SendFailure | null = null;
  for (let i = 0; i < total; i++) {
    const id = plan.send[i].person_id;
    const stopped = o.shouldStop?.() === true;
    if (halted || stopped) {
      const reason: SendFailure = halted ?? 'stopped';
      out.failed.push({ id, reason });
      out.rows.push({ id, status: 'failed', reason });
      o.onProgress?.(i + 1, total);
      continue;
    }
    if (i > 0 && (o.paceMs ?? 0) > 0) await sleep(o.paceMs!);
    let result: SendResult = { ok: false, reason: 'uncertain' };
    for (let attempt = 0; ; attempt++) {
      try {
        result = await send(id, draft);
      } catch {
        result = { ok: false, reason: 'uncertain' };
      }
      if (!result.ok && result.reason === 'rate' && result.transient && attempt < (o.burstRetries ?? 3)) {
        await sleep(Math.min(Math.max(result.retry_after_s ?? 5, 1), 10) * 1000);
        continue;
      }
      break;
    }
    if (result.ok) {
      out.sent.push(id);
      out.rows.push(result.held ? { id, status: 'held' } : { id, status: 'sent', at: result.sent_at });
    } else {
      out.failed.push({ id, reason: result.reason });
      out.rows.push({ id, status: result.reason === 'uncertain' ? 'unknown' : 'failed', reason: result.reason });
      if (HALTS.has(result.reason)) halted = result.reason;
    }
    o.onProgress?.(i + 1, total);
  }
  return out;
}

/** The result table in the order the sender selected the people (skipped and sent interleaved as they were picked). */
export function orderRows(selected: readonly string[], rows: readonly BulkRow[]): BulkRow[] {
  const by = new Map(rows.map((r) => [r.id, r]));
  return selected.map((id) => by.get(id)).filter((r): r is BulkRow => !!r);
}

/** One line for the run: "N sent" plus, when some were not, how many. */
export function bulkSummary(out: BulkOutcome): { sent: number; failed: number; unknown: number } {
  return { sent: out.sent.length, failed: out.rows.filter((r) => r.status === 'failed').length, unknown: out.rows.filter((r) => r.status === 'unknown').length };
}

/** A new id for one bulk run (the server groups the run's records by it; it checks the run's size and that every message is the same). */
export function newBulkId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `bulk-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
