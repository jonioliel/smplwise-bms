import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-state-panel';
import type { StateKind } from '../components/sw-badge';
import type { DisplayZone } from '../api/intercom';
import { pt } from '../i18n/access-people';
import { formatClock } from '../access-control/people-logic';
import type { MessageHistoryItem, MessagingTransport, PersonMessages } from '../access-control/messaging-logic';
import { UTC_ZONE } from './wiskey-format';

/** An outcome as a badge: "sent" is what the service accepted (never "delivered"), "not sent" a refusal, "unknown" a send whose answer is lost. */
export function outcomeBadge(outcome: MessageHistoryItem['outcome']): { kind: StateKind; label: string } {
  switch (outcome) {
    case 'sent': return { kind: 'recorded', label: pt('hist.sent') };
    case 'refused': return { kind: 'error', label: pt('hist.refused') };
    case 'pending': return { kind: 'stale', label: pt('hist.pending') };
    default: return { kind: 'unknown', label: pt('hist.unknown') };
  }
}

/**
 * The person's message history and the "asked not to be messaged" switch - the drawer's "הודעות" tab (CR-036 WA). It lists what Arx
 * handed to the messaging service for this person: when, who sent it, which template or "free text" - never the text (Arx does not keep
 * it) and never "delivered" (there is no receipt). The switch is Arx's own opt-out list: a person on it cannot be messaged, whatever the
 * messaging service says. Both come from the typed routes; a failed read is said, a failed change puts the switch back.
 */
@customElement('wiskey-person-messages')
export class WiskeyPersonMessages extends LitElement {
  @property({ attribute: false }) transport: MessagingTransport | null = null;
  @property() personId = '';
  @property({ attribute: false }) zone: DisplayZone = UTC_ZONE;
  /** Bumped by the screen after a message was sent: the list is read again. */
  @property({ type: Number }) rev = 0;

  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private data: PersonMessages | null = null;
  @state() private busy = false;
  @state() private failed = false;
  private generation = 0;

  static styles = css`
    :host {
      display: block;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .sw {
      display: flex;
      align-items: center;
      gap: 12px;
      inline-size: 100%;
      min-block-size: 56px;
      padding: 8px 12px;
      box-sizing: border-box;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .sw:disabled {
      cursor: default;
      opacity: var(--sw-disabled-opacity);
    }
    .sw:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .sw .txt {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sw .t {
      font-weight: var(--sw-fw-medium);
    }
    .sw .x {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .track {
      flex: none;
      position: relative;
      inline-size: 42px;
      block-size: 24px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-border-strong);
      transition: background var(--sw-t-fast) var(--sw-ease);
    }
    .track::after {
      content: '';
      position: absolute;
      inset-block-start: 3px;
      inset-inline-start: 3px;
      inline-size: 18px;
      block-size: 18px;
      border-radius: 50%;
      background: var(--sw-toggle-thumb);
      box-shadow: var(--sw-shadow-1);
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    .sw[aria-checked='true'] .track {
      background: var(--sw-toggle-on);
    }
    .sw[aria-checked='true'] .track::after {
      transform: translateX(-18px);
    }
    :host-context([dir='ltr']) .sw[aria-checked='true'] .track::after {
      transform: translateX(18px);
    }
    @media (prefers-reduced-motion: reduce) {
      .track,
      .track::after {
        transition: none;
      }
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    li {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 56px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    li:last-child {
      border-block-end: 0;
    }
    li .main {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    li .t {
      font-weight: var(--sw-fw-medium);
      overflow-wrap: anywhere;
    }
    li .s {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      overflow-wrap: anywhere;
    }
    .sub {
      color: var(--sw-text-3);
    }
    .err {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .skeleton {
      block-size: 14px;
      border-radius: var(--sw-r-xs);
      background: linear-gradient(90deg, var(--sw-surface-3), var(--sw-surface-2), var(--sw-surface-3));
      background-size: 200% 100%;
      animation: shimmer 1.4s linear infinite;
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton {
        animation: none;
      }
    }
    sw-button {
      min-block-size: 44px;
    }
  `;

  protected willUpdate(changed: PropertyValues<this>) {
    if ((changed.has('personId') || changed.has('rev') || changed.has('transport')) && this.personId) void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.generation++;
  }

  private async load() {
    const generation = ++this.generation;
    const transport = this.transport;
    if (!transport) return;
    if (!this.data) this.phase = 'loading';
    try {
      const data = await transport.history(this.personId);
      if (generation !== this.generation) return;
      this.data = data;
      this.phase = 'ready';
    } catch {
      if (generation !== this.generation) return;
      this.phase = 'error';
    }
  }

  private async toggleOptOut() {
    const transport = this.transport;
    if (!transport || !this.data || this.busy) return;
    this.busy = true;
    this.failed = false;
    const id = this.personId;
    try {
      const r = await transport.setOptOut(id, this.data.opt_out === null);
      if (id !== this.personId) return;
      this.data = { ...this.data, opt_out: r.opt_out, consent: r.consent };
    } catch {
      this.failed = true;
    } finally {
      this.busy = false;
    }
  }

  private optOutText(d: PersonMessages): string {
    if (!d.opt_out) return '';
    const date = formatClock(d.opt_out.at, this.zone);
    return d.opt_out.by ? pt('optout.by', { name: d.opt_out.by, date }) : pt('optout.at', { date });
  }

  private renderItem(m: MessageHistoryItem) {
    const b = outcomeBadge(m.outcome);
    const title = m.kind === 'free' ? pt('hist.free') : m.template_label ?? pt('hist.removed_template');
    const meta = [m.by ? pt('hist.by', { name: m.by }) : '', formatClock(m.at, this.zone), m.bulk ? pt('hist.bulk') : ''].filter(Boolean).join(' · ');
    return html`<li data-msg-history-item data-msg-outcome=${m.outcome}>
      <div class="main"><span class="t">${title}</span><span class="s">${meta}</span></div>
      <sw-badge kind=${b.kind} label=${b.label}></sw-badge>
    </li>`;
  }

  render() {
    if (this.phase === 'loading') return html`<section data-person-section="messages" data-msg-history-state="loading" aria-busy="true"><div class="skeleton" style="inline-size:60%"></div><div class="skeleton" style="inline-size:80%"></div><span class="sub" role="status">${pt('hist.loading')}</span></section>`;
    if (this.phase === 'error' || !this.data) {
      return html`<section data-person-section="messages" data-msg-history-state="error"><sw-state-panel compact state="error" heading=${pt('hist.error')} actionLabel=${pt('hist.retry')} @action=${() => void this.load()}></sw-state-panel></section>`;
    }
    const d = this.data;
    const on = d.opt_out !== null;
    return html`<section data-person-section="messages" data-msg-history-state="ready">
      <button type="button" class="sw" role="switch" aria-checked=${String(on)} data-msg-optout ?disabled=${this.busy} @click=${() => void this.toggleOptOut()}>
        <span class="txt"><span class="t">${pt('optout.label')}</span>${on ? html`<span class="x" data-msg-optout-by>${this.optOutText(d)}</span>` : nothing}</span>
        <span class="track" aria-hidden="true"></span>
      </button>
      ${this.failed ? html`<div class="err" role="alert" data-msg-optout-error><sw-icon name="warning" size=${16}></sw-icon><span>${pt('optout.error')}</span></div>` : nothing}
      <h4>${pt('hist.list')}</h4>
      ${d.messages.length === 0 ? html`<span class="sub" data-msg-history-empty>${pt('hist.empty')}</span>` : html`<ul data-msg-history aria-label=${pt('hist.list')}>${d.messages.map((m) => this.renderItem(m))}</ul>`}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-person-messages': WiskeyPersonMessages;
  }
}
