/**
 * CR-036 S7: the pure logic of the people screen's message dialog (WhatsApp, one person or a selection) - no DOM, no network, so it
 * is unit-tested in Node (tests/unit-messaging-logic.spec.ts).
 *
 * THE REAL SEND PATH DOES NOT EXIST YET. The WisKey side (ask W11: the send command and its body, the consent model, receipts,
 * limits and error codes, whether the service identity may send at all) is not delivered, and the backend has no message route.
 * The dialog is built against the draft contract below and the fakes in api/messaging-fake.ts; the screen offers it only when the
 * server's `features` reply lists `messaging` as available (never in this build) or in the static preview (demo data).
 *
 * The rules this module owns (owner answers 9 and 10 of 2026-10-12):
 *   - approved TEMPLATES and FREE TEXT (a setting): the free-text box starts empty and a template is copied in only when the sender
 *     picks it - nothing is ever inserted automatically;
 *   - a message NEVER carries a PIN or any credential: a template with a credential placeholder is not offered, a text with one
 *     (or one that reads like "code 4821") is not sent;
 *   - the phone number is shown only to a caller who may see it (and then masked until they ask); a sender who may not see it
 *     (hidden-phone mode) still sends - the server holds the number;
 *   - the sender sees the recipient's consent, a missing phone, an unreachable service, the quota, a refusal and an uncertain
 *     outcome as one calm line; "sent" never means "delivered" (there is no receipt);
 *   - bulk: one template or text for everyone, a preview that names who will not get it and why, sequential sends, a failure never
 *     stops the rest.
 */

export interface MessageTemplate {
  id: string;
  label: string;
  body: string;
}

/** What the server tells THIS caller about messaging (draft contract: GET /access-control/messaging). Administrator settings
 * (`free_text`, `bulk_max`, the templates) and the caller's own rights (`can_send`, `can_reveal_phone`) arrive together. */
export interface MessagingConfig {
  /** The messaging service is connected. */
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
  /** Sends allowed in the current window; null = no limit. */
  quota: { limit: number; used: number; resets_in_s: number } | null;
}

export type Consent = 'granted' | 'declined' | 'unknown';

export interface RecipientInfo {
  person_id: string;
  name: string;
  /** Null in hidden-phone mode, or when there is no phone. A masked number never has more than its last two digits. */
  phone_masked: string | null;
  has_phone: boolean | null;
  consent: Consent;
}

/** `template_id` null = free text. For a template the `text` is the rendered body the sender saw (the server renders again). */
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
  | 'unknown';

export type SendResult = { ok: true; sent_at: string } | { ok: false; reason: SendFailure; retry_after_s?: number };

export interface MessagingTransport {
  config(): Promise<MessagingConfig>;
  /** Eligibility of the people the sender picked (names are Arx's own; the phone is masked or absent). */
  recipients(personIds: string[]): Promise<RecipientInfo[]>;
  send(personId: string, draft: MessageDraft): Promise<SendResult>;
}

// ---------------------------------------------------------------- the credential guard

/** A placeholder that would put a credential into a text: {pin}, {code}, {card}, {password}, {token}, {credential...}. */
const CREDENTIAL_PLACEHOLDER = /\{\s*(?:pin|code|passcode|card|password|token|credential|secret)\w*\s*\}/i;
/** The words that introduce a code, followed within a few characters by a run of 4-8 digits: "code 4821", "PIN: 123456", "קוד הגישה 4821". */
const CREDENTIAL_WORDS = /(?:\bpin\b|\bcode\b|passcode|password|קוד|סיסמ[הא]|סיסמת|פין)[^\d\n]{0,14}\d{4,8}/i;

export const hasCredentialPlaceholder = (text: string): boolean => CREDENTIAL_PLACEHOLDER.test(text);

/** The text reads like a PIN or access code (a best-effort guard on what a sender TYPES; templates never carry one). */
export const looksLikeCredential = (text: string): boolean => hasCredentialPlaceholder(text) || CREDENTIAL_WORDS.test(text);

/** The templates the dialog may offer: an approved template that carries a credential placeholder is not one (the server must
 * not send them either; this keeps a faulty catalogue from reaching the sender). */
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

/** Why a message to this recipient cannot go out at all (before any text is looked at). */
export function recipientBlock(config: MessagingConfig, recipient: RecipientInfo | null): SendFailure | null {
  if (!config.enabled) return 'no_service';
  if (!recipient || recipient.has_phone === false) return 'no_phone';
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

export interface BulkOutcome {
  sent: string[];
  failed: { id: string; reason: SendFailure }[];
}

/** Runs the sends one after another (the rate limit is per sender, and a failure never stops the rest). A `rate` refusal stops
 * the run: every later send would be refused the same way, so the remaining people are reported as not sent for that reason. */
export async function runBulk(
  plan: BulkPlan,
  draft: MessageDraft,
  send: (id: string, draft: MessageDraft) => Promise<SendResult>,
  onProgress?: (done: number, total: number) => void,
): Promise<BulkOutcome> {
  const out: BulkOutcome = { sent: [], failed: [] };
  const total = plan.send.length;
  let halted: SendFailure | null = null;
  for (let i = 0; i < total; i++) {
    const r = plan.send[i];
    if (halted) {
      out.failed.push({ id: r.person_id, reason: halted });
      onProgress?.(i + 1, total);
      continue;
    }
    let result: SendResult;
    try {
      result = await send(r.person_id, draft);
    } catch {
      result = { ok: false, reason: 'uncertain' };
    }
    if (result.ok) out.sent.push(r.person_id);
    else {
      out.failed.push({ id: r.person_id, reason: result.reason });
      if (result.reason === 'rate' || result.reason === 'no_service') halted = result.reason;
    }
    onProgress?.(i + 1, total);
  }
  return out;
}
