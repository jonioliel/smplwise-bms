import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-toggle';
import './sw-button';
import { describeError } from '../api/client';
import { isApi } from '../api/session';
import { getEventControl, retainEvent, setSubLabel, type EventControl } from '../api/frigate-control';
import { he } from '../i18n/he';

/**
 * NN5-F2 (gap closure): the two event actions of a Frigate tracked object on the review detail - keep its footage (the retain flag) and
 * correct its sub-label. Drawn only when the server says the caller may change this event now (`writable`: permission on the event's camera
 * AND the events write class switched on); otherwise the element stays empty and un-`ready`, so the review screen shows nothing at all
 * (clean operator screens: no hints, no badges). One short status line after a change. Both actions are single writes; a refused or lost
 * answer is shown as "not saved" and the controls are re-read, never retried. Tokens only.
 */
@customElement('frigate-event-control')
export class FrigateEventControl extends LitElement {
  @property({ attribute: 'recorder-id' }) recorderId = '';
  @property({ attribute: 'event-id' }) eventId = '';
  /** the object's name, drawn as the row's lead text */
  @property() label = '';
  @property({ type: Boolean, reflect: true }) ready = false;
  @state() private data: EventControl | null = null;
  @state() private draft = '';
  @state() private busy = false;
  @state() private msg: { tone: 'ok' | 'err'; text: string } | null = null;
  private seq = 0;

  static styles = css`
    :host {
      display: none;
    }
    :host([ready]) {
      display: block;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2) var(--sw-s-3);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .lead {
      font-weight: var(--sw-fw-medium);
      min-inline-size: 5em;
    }
    .keep {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
    }
    input {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-1) var(--sw-s-2);
      inline-size: 11em;
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    .msg {
      font-size: var(--sw-fs-xs);
      flex-basis: 100%;
    }
    .msg.ok {
      color: var(--sw-success-text);
    }
    .msg.err {
      color: var(--sw-danger-text);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  updated(changed: Map<string, unknown>) {
    if ((changed.has('eventId') || changed.has('recorderId')) && changed.get('eventId') !== undefined) void this.load();
  }

  private async load() {
    const my = ++this.seq;
    this.data = null;
    this.ready = false;
    if (!isApi() || !this.recorderId || !this.eventId) return;
    try {
      const d = await getEventControl(this.recorderId, this.eventId);
      if (my !== this.seq) return;
      this.data = d.writable ? d : null;
      this.draft = d.sub_label ?? '';
      this.ready = d.writable;
    } catch {
      if (my === this.seq) this.data = null; // not the caller's event, an old server, Frigate unreachable: nothing is drawn
    }
  }

  private flash(tone: 'ok' | 'err', text: string) {
    this.msg = { tone, text };
    window.setTimeout(() => {
      if (this.msg?.text === text) this.msg = null;
    }, 3500);
  }

  private async toggleRetain(e: Event) {
    const el = e.currentTarget as HTMLElement & { checked: boolean };
    const to = el.checked;
    this.busy = true;
    try {
      const r = await retainEvent(this.recorderId, this.eventId, to);
      if (this.data) this.data = { ...this.data, retain: to };
      this.flash('ok', r.verified ? he.frigate.control.saved : he.frigate.control.unverified);
    } catch (err) {
      el.checked = !to;
      this.flash('err', `${he.frigate.control.failed}: ${describeError(err)}`);
      void this.load();
    } finally {
      this.busy = false;
    }
  }

  private async saveLabel() {
    const want = this.draft.trim();
    this.busy = true;
    try {
      const r = await setSubLabel(this.recorderId, this.eventId, want || null);
      if (this.data) this.data = { ...this.data, sub_label: r.sub_label };
      this.draft = r.sub_label ?? '';
      this.flash('ok', r.verified ? he.frigate.control.saved : he.frigate.control.unverified);
    } catch (err) {
      this.flash('err', `${he.frigate.control.failed}: ${describeError(err)}`);
      void this.load();
    } finally {
      this.busy = false;
    }
  }

  render() {
    const d = this.data;
    if (!d) return nothing;
    const c = he.frigate.control;
    const changed = this.draft.trim() !== (d.sub_label ?? '');
    return html`<div class="row" data-event-control=${this.eventId}>
      <span class="lead">${this.label}</span>
      <span class="keep"><span>${c.retain}</span><sw-toggle .checked=${d.retain === true} ?disabled=${this.busy} labelHidden label=${c.retain} data-event-retain @change=${(e: Event) => void this.toggleRetain(e)}></sw-toggle></span>
      <input type="text" maxlength="60" aria-label=${c.subLabel} placeholder=${c.subLabel} data-event-sub-label .value=${this.draft} ?disabled=${this.busy}
        @input=${(e: Event) => (this.draft = (e.target as HTMLInputElement).value)} @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' && changed && !this.busy) void this.saveLabel();
        }} />
      <sw-button size="sm" data-event-sub-label-save ?disabled=${!changed || this.busy} @click=${() => void this.saveLabel()}>${c.subLabelSave}</sw-button>
      ${this.msg ? html`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone === 'err' ? 'alert' : 'status'} data-event-msg>${this.msg.text}</div>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-event-control': FrigateEventControl;
  }
}
