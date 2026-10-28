import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-avatar';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-icon';
import { pt } from '../i18n/access-people';
import {
  bulkPlan,
  bulkSummary,
  composerView,
  newBulkId,
  orderRows,
  renderTemplate,
  runBulk,
  usableTemplates,
  type BulkOutcome,
  type BulkRow,
  type ComposerPhase,
  type MessageDraft,
  type MessageTemplate,
  type MessagingConfig,
  type MessagingTransport,
  type RecipientInfo,
  type SendFailure,
} from '../access-control/messaging-logic';
import { timeText } from '../api/day-format';

type Loaded = 'loading' | 'ready' | 'unavailable';

/** The words of a failure, one calm line (never a code, never "delivered"). */
const REASON_KEY = {
  no_phone: 'msg.reason.no_phone',
  no_consent: 'msg.reason.no_consent',
  no_service: 'msg.reason.no_service',
  not_registered: 'msg.reason.not_registered',
  uncertain: 'msg.reason.uncertain',
  expired: 'msg.reason.expired',
  free_text_off: 'msg.reason.free_text_off',
  credential: 'msg.credential_blocked',
  too_long: 'msg.too_long',
  empty: 'msg.reason.empty',
  rate: 'msg.reason.rate',
  person_limit: 'msg.reason.person_limit',
  station_limit: 'msg.reason.station_limit',
  outside_hours: 'msg.reason.outside_hours',
  forbidden: 'msg.reason.forbidden',
  gone: 'msg.reason.gone',
  template_changed: 'msg.reason.template_changed',
  disabled: 'msg.reason.disabled',
  duplicate: 'msg.reason.duplicate',
  refused: 'msg.reason.refused',
  stopped: 'msg.reason.stopped',
  unknown: 'msg.reason.unknown',
  consent_pending: 'msg.reason.consent_pending',
  consent_recent: 'msg.reason.consent_recent',
  consent_unavailable: 'msg.reason.consent_unavailable',
} as const satisfies Record<SendFailure, Parameters<typeof pt>[0]>;
export const reasonText = (r: SendFailure): string => pt(REASON_KEY[r]);

const clock = (iso: string): string => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? timeText(d) : '';
};

/**
 * The message dialog of the people screen (CR-036 S7, real since slice WA): WhatsApp to one person or to a selection, through the
 * `MessagingTransport` the screen hands it - the typed routes of the server (api/access-messaging.ts), or in the static preview a fake
 * that never leaves the page (api/messaging-fake.ts). The rules are in access-control/messaging-logic.ts: approved templates and free
 * text (an administrator setting), never a credential, hidden-phone mode, consent, the allowance, an uncertain outcome is said as such and
 * never retried, "sent" is never "delivered". The server enforces every one of them again.
 *
 * A sender who may not see the number (hidden-phone mode) still sends: the recipient card then says "מספר מוסתר". A person without a
 * phone or who asked not to be messaged dims the text box and says why in one amber line. Bulk: one template or text for all, a preview
 * that names who will not get it, ONE confirmation, sequential sends at the server's pace (a stop button ends the run after the message in
 * flight), a failure never stops the rest, and a per-recipient result table at the end.
 */
@customElement('wiskey-message-dialog')
export class WiskeyMessageDialog extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ attribute: false }) transport: MessagingTransport | null = null;
  /** The people the message is for (one = the single composer). Names are Arx's own. */
  @property({ attribute: false }) people: { id: string; name: string }[] = [];
  /** Test seam: the pause between the sends of a bulk run (defaults to the server's `pace_ms`). */
  @property({ attribute: false }) sleep: ((ms: number) => Promise<void>) | undefined;

  @state() private loaded: Loaded = 'loading';
  @state() private config: MessagingConfig | null = null;
  @state() private recipients: RecipientInfo[] = [];
  @state() private draft: MessageDraft = { template_id: null, text: '' };
  @state() private phase: ComposerPhase = 'idle';
  @state() private failure: SendFailure | undefined;
  @state() private retryAfterS: number | undefined;
  @state() private sentAt = '';
  /** WA-CONSENT-LINK: the message waits for the person's consent (the line says so instead of "sent"). */
  @state() private held: '' | 'msg.held' | 'msg.consent_requested' | 'msg.consent_requested_free' = '';
  @state() private progress: [number, number] | null = null;
  @state() private outcome: BulkOutcome | null = null;
  @state() private confirming = false;
  @state() private stopping = false;
  private generation = 0;
  private stopRequested = false;

  static styles = css`
    :host {
      display: contents;
    }
    .to {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
    }
    .to .col {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    /* R5-SECURITY: the recipient is the dialog's display line - 17/800 in the heading ink; the pills are 12.5/700 fields */
    .to b {
      font-weight: 800;
      font-size: var(--sw-fs-xl);
      letter-spacing: -0.01em;
      color: var(--sw-heading, var(--sw-text));
    }
    .to .meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px 8px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .pill.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .pill.warn {
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
    }
    .pill.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field > label,
    .field > .lbl {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    /* R5-SECURITY: the template chips are raised keys (shadow 1, 600) that sink on pointer-down; the chosen one a filled accent field */
    .chip {
      min-block-size: 44px;
      padding-inline: 14px;
      border-radius: var(--sw-r-pill);
      border: 1px solid transparent;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      max-inline-size: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .chip:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
    }
    .chip[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: transparent;
      color: var(--sw-text-inverse);
      font-weight: var(--sw-fw-bold);
    }
    .chip:disabled {
      opacity: var(--sw-disabled-opacity);
      cursor: default;
    }
    .chip:focus-visible,
    textarea:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    textarea {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: 120px;
      padding: 10px 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-md);
      line-height: 1.5;
      resize: vertical;
    }
    textarea:disabled {
      background: var(--sw-surface-2);
      color: var(--sw-text-3);
    }
    .cnt {
      align-self: flex-end;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
    }
    .line {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .line.ok {
      background: var(--sw-success-soft);
    }
    .line.warn {
      background: var(--sw-stale-soft);
    }
    .line.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .line.wait sw-icon {
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .line.wait sw-icon {
        animation: none;
      }
    }
    .prev {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    sw-button {
      min-block-size: 44px;
    }
    /* the per-recipient result table of a bulk run */
    .results {
      inline-size: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: var(--sw-fs-sm);
    }
    .results caption {
      caption-side: top;
      text-align: start;
      padding-block-end: 6px;
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    .results th {
      text-align: start;
      padding: 6px 8px;
      border-block-end: 1px solid var(--sw-border-strong);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    .results td {
      padding: 8px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
      overflow-wrap: anywhere;
    }
    .results tr:last-child td {
      border-block-end: 0;
    }
    .results .c-name {
      inline-size: 36%;
    }
    .results .c-outcome {
      inline-size: 26%;
    }
    .results .c-detail {
      color: var(--sw-text-2);
    }
  `;

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('open') && this.open) void this.begin();
  }

  private get bulk(): boolean {
    return this.people.length > 1;
  }

  private async begin() {
    const generation = ++this.generation;
    this.loaded = 'loading';
    this.config = null;
    this.recipients = [];
    this.draft = { template_id: null, text: '' };
    this.phase = 'idle';
    this.failure = undefined;
    this.retryAfterS = undefined;
    this.progress = null;
    this.outcome = null;
    this.sentAt = '';
    this.held = '';
    this.confirming = false;
    this.stopping = false;
    this.stopRequested = false;
    const transport = this.transport;
    if (!transport) {
      this.loaded = 'unavailable';
      return;
    }
    try {
      const [config, recipients] = await Promise.all([transport.config(), transport.recipients(this.people.map((p) => p.id)).catch(() => [] as RecipientInfo[])]);
      if (generation !== this.generation) return;
      this.config = { ...config, templates: usableTemplates(config.templates) };
      // the names are Arx's own (the list already shows them); a person the server did not look up (past the first few, or one it
      // could not answer for) is "not known yet": decided as the message goes, never assumed to have no phone
      this.recipients = this.people.map((p) => ({ ...(recipients.find((r) => r.person_id === p.id) ?? { person_id: p.id, phone_masked: null, has_phone: null, consent: 'unknown' as const }), name: p.name }));
      this.loaded = 'ready';
    } catch {
      if (generation !== this.generation) return;
      this.loaded = 'unavailable';
    }
  }

  private close() {
    this.generation++;
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true, detail: { sent: this.phase === 'sent' || (this.outcome?.sent.length ?? 0) > 0 } }));
  }

  private pick(template: MessageTemplate | null) {
    if (!this.config) return;
    this.phase = 'idle';
    this.failure = undefined;
    this.outcome = null;
    this.confirming = false;
    if (!template) {
      this.draft = { template_id: null, text: this.draft.template_id === null ? this.draft.text : '' };
      return;
    }
    // the template's text is copied in only because the sender picked it; `{name}` is filled for one person and stays for many
    this.draft = { template_id: template.id, text: this.bulk ? template.body : renderTemplate(template.body, { name: this.recipients[0]?.name ?? '' }) };
  }

  private edit(text: string) {
    this.phase = this.phase === 'sent' ? 'idle' : this.phase;
    this.failure = undefined;
    this.confirming = false;
    this.draft = { template_id: null, text };
  }

  private async send() {
    const transport = this.transport;
    if (!transport || !this.config || this.phase === 'sending') return;
    // the keyboard shortcut must not get around what the button's state says: nothing goes out that the dialog calls un-sendable
    const ready = this.bulk
      ? bulkPlan(this.recipients, this.config, this.draft).canSend
      : composerView({ config: this.config, recipient: this.recipients[0] ?? null, draft: this.draft, phase: this.phase, failure: this.failure, retryAfterS: this.retryAfterS }).canSend;
    if (!ready) return;
    if (this.bulk && !this.confirming) {
      // ONE confirmation before a run: sending to many is not something to undo
      this.confirming = true;
      return;
    }
    const generation = this.generation;
    const ctx = { templates_revision: this.config.templates_revision };
    this.phase = 'sending';
    this.failure = undefined;
    if (!this.bulk) {
      const result = await transport.send(this.people[0].id, this.draft, ctx);
      if (generation !== this.generation) return;
      if (result.ok) {
        this.phase = 'sent';
        this.sentAt = result.sent_at;
        this.held = !result.held ? '' : result.held === 'held' ? 'msg.held' : this.draft.template_id === null ? 'msg.consent_requested_free' : 'msg.consent_requested';
        if (result.quota !== undefined) this.config = { ...this.config, quota: result.quota };
        else await this.refreshConfig();
      } else {
        this.phase = 'failed';
        this.failure = result.reason;
        this.retryAfterS = result.retry_after_s;
        if (result.reason === 'rate' || result.reason === 'template_changed' || result.reason === 'disabled') {
          await this.refreshConfig();
          if (result.reason === 'template_changed') this.draft = { template_id: null, text: '' };
        }
      }
      return;
    }
    const plan = bulkPlan(this.recipients, this.config, this.draft);
    this.confirming = false;
    this.progress = [0, plan.send.length];
    this.stopRequested = false;
    this.stopping = false;
    const bulkId = newBulkId();
    const outcome = await runBulk(plan, this.draft, (id, d) => transport.send(id, d, { ...ctx, bulk: { id: bulkId, total: plan.send.length } }), {
      onProgress: (done, total) => (this.progress = [done, total]),
      paceMs: this.config.pace_ms,
      sleep: this.sleep,
      shouldStop: () => this.stopRequested,
    });
    if (generation !== this.generation) return;
    this.outcome = outcome;
    this.progress = null;
    this.stopping = false;
    this.phase = 'sent';
    await this.refreshConfig();
  }

  private stop() {
    this.stopRequested = true;
    this.stopping = true;
  }

  private async refreshConfig() {
    try {
      const config = await this.transport?.config();
      if (config) this.config = { ...config, templates: usableTemplates(config.templates) };
    } catch {
      /* the allowance line keeps its last value */
    }
  }

  // ------------------------------------------------------------------ render

  private renderLine(view: ReturnType<typeof composerView>) {
    const l = view.line;
    if (!l) return nothing;
    const icon = l.tone === 'ok' ? 'check' : l.tone === 'wait' ? 'refresh' : l.tone === 'warn' ? 'clock' : 'warning';
    let text = '';
    if (l.kind === 'sending') text = pt('msg.sending');
    else if (l.kind === 'sent') text = this.held ? pt(this.held) : pt('msg.sent', { time: clock(this.sentAt) });
    else if (l.kind === 'rate') text = pt('msg.rate', { minutes: l.minutes ?? 1 });
    else if (l.kind === 'cant') text = pt('msg.cant', { reason: reasonText(l.reason!) });
    else text = l.reason === 'uncertain' ? pt('msg.uncertain') : pt('msg.failed', { reason: reasonText(l.reason!) });
    return html`<div class="line ${l.tone}" role=${l.tone === 'err' ? 'alert' : 'status'} data-msg-line=${l.kind} data-msg-tone=${l.tone}><sw-icon name=${icon} size=${16}></sw-icon><span>${text}</span></div>`;
  }

  private renderTemplates(config: MessagingConfig, disabled: boolean) {
    return html`<div class="field">
      <span class="lbl">${pt('msg.template')}</span>
      <div class="chips" role="group" aria-label=${pt('msg.template')}>
        ${config.templates.map((t) => html`<button type="button" class="chip" data-msg-template=${t.id} aria-pressed=${this.draft.template_id === t.id} ?disabled=${disabled} @click=${() => this.pick(t)}>${t.label}</button>`)}
        ${config.free_text ? html`<button type="button" class="chip" data-msg-free aria-pressed=${this.draft.template_id === null && this.draft.text !== ''} ?disabled=${disabled} @click=${() => this.pick(null)}>${pt('msg.free')}</button>` : nothing}
      </div>
    </div>`;
  }

  private renderText(config: MessagingConfig, disabled: boolean) {
    const shown = this.bulk && this.draft.template_id ? this.draft.text.replaceAll('{name}', '[שם]') : this.draft.text;
    const readOnly = this.draft.template_id !== null && !config.free_text; // with free text allowed, editing a template's text makes it a free text
    return html`<div class="field">
      <label for="msg-text">${pt('msg.text')}</label>
      <textarea id="msg-text" data-msg-text maxlength=${config.text_max} .value=${shown} ?disabled=${disabled} ?readonly=${readOnly}
        @input=${(e: Event) => this.edit((e.target as HTMLTextAreaElement).value)}
        @keydown=${(e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            void this.send();
          }
        }}></textarea>
      <span class="cnt" aria-hidden="true">${pt('msg.counter', { n: this.draft.text.length, max: config.text_max })}</span>
    </div>`;
  }

  private renderSingle(config: MessagingConfig) {
    const r = this.recipients[0];
    const view = composerView({ config, recipient: r ?? null, draft: this.draft, phase: this.phase, failure: this.failure, retryAfterS: this.retryAfterS });
    const phone = r?.has_phone === false ? '—' : r?.phone_masked ? html`<span class="ltr" data-msg-phone>${r.phone_masked}</span>` : html`<span data-msg-phone="hidden">${pt('msg.phone_hidden')}</span>`;
    // (null: the server does not tell this caller - review F2 - so nothing is said; the send answers for itself)
    const consent = r?.consent === 'declined' ? html`<span class="pill warn" data-msg-consent="declined">${pt('msg.consent_declined')}</span>` : r?.consent === 'granted' ? html`<span class="pill ok" data-msg-consent="granted">${pt('msg.consent_granted')}</span>` : r?.consent === null ? nothing : html`<span class="pill" data-msg-consent="unknown">${pt('msg.consent_unknown')}</span>`;
    const sending = this.phase === 'sending';
    const sendLabel = this.phase === 'sent' ? pt('msg.send_again') : this.phase === 'failed' && this.failure === 'uncertain' ? pt('msg.send_anyway') : pt('msg.send');
    return html`
      <div class="to" data-msg-recipient>
        <sw-avatar name=${r?.name ?? ''} size=${40} aria-hidden="true"></sw-avatar>
        <div class="col"><b>${r?.name}</b><span class="meta">${phone}${consent}</span></div>
      </div>
      ${this.renderTemplates(config, view.textDisabled || sending)}
      ${this.renderText(config, view.textDisabled || sending)}
      ${this.renderLine(view)}
      <div slot="footer" style="display:contents">
        <sw-button variant="primary" icon="mail" data-msg-send ?disabled=${!view.canSend || sending} @click=${() => void this.send()}>${sendLabel}</sw-button>
        <sw-button data-msg-cancel @click=${() => this.close()} ?disabled=${sending}>${this.phase === 'sent' ? pt('msg.close') : pt('msg.cancel')}</sw-button>
      </div>`;
  }

  /** The result table: every person of the run in the order the sender picked them - sent, not sent (and why), or unknown. */
  private renderResults(rows: BulkRow[]) {
    const nameOf = (id: string) => this.people.find((p) => p.id === id)?.name ?? id;
    return html`<table class="results" data-msg-results>
      <caption>${pt('msg.results')}</caption>
      <thead><tr><th scope="col" class="c-name">${pt('msg.result_name')}</th><th scope="col" class="c-outcome">${pt('msg.result_outcome')}</th><th scope="col" class="c-detail">${pt('msg.result_detail')}</th></tr></thead>
      <tbody>
        ${rows.map((r) => {
          const tone = r.status === 'sent' ? 'ok' : r.status === 'unknown' || r.status === 'held' ? 'warn' : 'err';
          const label = r.status === 'sent' ? pt('msg.result_sent') : r.status === 'held' ? pt('msg.result_held') : r.status === 'unknown' ? pt('msg.result_unknown') : pt('msg.result_failed');
          const detail = r.status === 'sent' ? clock(r.at ?? '') : r.status === 'held' ? pt('msg.held') : r.status === 'unknown' ? pt('msg.uncertain') : reasonText(r.reason ?? 'unknown');
          return html`<tr data-msg-result=${r.id} data-msg-outcome=${r.status}><td class="c-name">${nameOf(r.id)}</td><td class="c-outcome"><span class="pill ${tone}">${label}</span></td><td class="c-detail">${detail}</td></tr>`;
        })}
      </tbody>
    </table>`;
  }

  private renderBulk(config: MessagingConfig) {
    const plan = bulkPlan(this.recipients, config, this.draft);
    const sending = this.phase === 'sending';
    const names = plan.skip.slice(0, 3).map((s) => `${s.recipient.name} (${reasonText(s.reason)})`).join(', ') + (plan.skip.length > 3 ? '…' : '');
    const previewText = pt('msg.preview_bulk', { send: plan.send.length, skip: plan.skip.length ? pt('msg.preview_skip', { n: plan.skip.length, names }) : '' });
    const done = this.outcome;
    let line: ReturnType<typeof html> | typeof nothing = nothing;
    if (sending && this.progress) {
      line = html`<div class="line wait" role="status" data-msg-line="sending"><sw-icon name="refresh" size=${16}></sw-icon><span>${this.stopping ? pt('msg.stopping') : pt('msg.sending_n', { done: this.progress[0], total: this.progress[1] })}</span></div>`;
    } else if (done) {
      const s = bulkSummary(done);
      const tone = s.failed || s.unknown || s.held ? 'warn' : 'ok';
      line = html`<div class="line ${tone}" role="status" data-msg-line="bulk-done" data-msg-tone=${tone}><sw-icon name="check" size=${16}></sw-icon><span>${pt('msg.bulk_done', { sent: s.sent, failed: (s.held ? pt('msg.bulk_held', { n: s.held }) : '') + (s.failed ? pt('msg.bulk_failed', { n: s.failed }) : '') + (s.unknown ? pt('msg.bulk_unknown', { n: s.unknown }) : '') })}</span></div>`;
    } else if (this.confirming) {
      line = html`<div class="line warn" role="alert" data-msg-line="confirm"><sw-icon name="warning" size=${16}></sw-icon><span>${pt('msg.confirm_bulk', { n: plan.send.length })}</span></div>`;
    } else if (plan.tooMany) {
      line = html`<div class="line err" role="alert" data-msg-line="too-many"><sw-icon name="warning" size=${16}></sw-icon><span>${pt('msg.bulk_too_many', { max: config.bulk_max })}</span></div>`;
    } else if (plan.overQuota !== null) {
      line = html`<div class="line warn" role="status" data-msg-line="over-quota"><sw-icon name="clock" size=${16}></sw-icon><span>${pt('msg.bulk_over_quota', { n: plan.overQuota })}</span></div>`;
    } else {
      const problem = composerView({ config, recipient: this.recipients[0] ?? null, draft: this.draft, phase: 'idle' }).line;
      if (problem?.kind === 'cant' && problem.reason && ['credential', 'too_long', 'free_text_off'].includes(problem.reason)) {
        line = html`<div class="line err" role="alert" data-msg-line="cant"><sw-icon name="warning" size=${16}></sw-icon><span>${pt('msg.cant', { reason: reasonText(problem.reason) })}</span></div>`;
      } else if (!config.enabled) {
        line = html`<div class="line warn" role="status" data-msg-line="cant"><sw-icon name="clock" size=${16}></sw-icon><span>${pt('msg.cant', { reason: reasonText('no_service') })}</span></div>`;
      }
    }
    const footer = done
      ? html`<sw-button variant="primary" data-msg-cancel @click=${() => this.close()}>${pt('msg.close')}</sw-button>`
      : sending
        ? html`<sw-button data-msg-stop icon="close" ?disabled=${this.stopping} @click=${() => this.stop()}>${pt('msg.stop')}</sw-button>`
        : this.confirming
          ? html`<sw-button variant="primary" icon="mail" data-msg-confirm @click=${() => void this.send()}>${pt('msg.confirm_send')}</sw-button>
              <sw-button data-msg-back @click=${() => (this.confirming = false)}>${pt('msg.back')}</sw-button>`
          : html`<sw-button variant="primary" icon="mail" data-msg-send ?disabled=${!plan.canSend} @click=${() => void this.send()}>${pt('msg.send_n', { n: plan.send.length })}</sw-button>
              <sw-button data-msg-cancel @click=${() => this.close()}>${pt('msg.cancel')}</sw-button>`;
    return html`
      ${done ? nothing : this.renderTemplates(config, sending || this.confirming)}
      ${done ? nothing : this.renderText(config, sending || this.confirming || !config.enabled)}
      ${done ? nothing : html`<div class="prev" data-msg-preview><sw-icon name="users" size=${16}></sw-icon><span>${previewText}</span></div>`}
      ${line}
      ${done ? this.renderResults(orderRows(this.people.map((p) => p.id), done.rows)) : nothing}
      <div slot="footer" style="display:contents">${footer}</div>`;
  }

  render() {
    const heading = this.bulk ? pt('msg.title_bulk', { n: this.people.length }) : pt('msg.title');
    return html`<sw-dialog wide ?open=${this.open} ?locked=${this.phase === 'sending'} heading=${heading} @close=${(e: Event) => { e.stopPropagation(); this.close(); }} data-msg-dialog>
      ${this.loaded === 'loading' ? html`<div class="line wait" role="status" data-msg-line="loading"><sw-icon name="refresh" size=${16}></sw-icon><span>${pt('state.detail_loading')}</span></div>` : nothing}
      ${this.loaded === 'unavailable' || !this.config
        ? this.loaded === 'unavailable'
          ? html`<div class="line warn" role="status" data-msg-line="cant"><sw-icon name="clock" size=${16}></sw-icon><span>${pt('msg.cant', { reason: reasonText('no_service') })}</span></div>
              <div slot="footer" style="display:contents"><sw-button data-msg-cancel @click=${() => this.close()}>${pt('msg.close')}</sw-button></div>`
          : nothing
        : this.bulk
          ? this.renderBulk(this.config)
          : this.renderSingle(this.config)}
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-message-dialog': WiskeyMessageDialog;
  }
}
