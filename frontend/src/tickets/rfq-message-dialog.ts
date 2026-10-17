import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ticketsRfqApi, type RfqDetail, type RfqMessage, type RfqVendor } from '../api/tickets-rfq';
import { tIcon } from './icons';
import { rt } from './rfq-text';
import { rfqStyles } from './rfq-styles';
import { MESSAGE_MAX, dateTime } from './rfq-model';
import { rfqError } from './rfq-new';
import { refreshRfqQuestions } from './rfq-questions-store';

/**
 * TKRFQ2 `<tickets-rfq-message-dialog .rfq .vendor .open>`: the private thread with one vendor and a new clarification. The text is
 * stored in the thread (the vendor page shows it); with "notify" the server queues only the templated `rfq_update` notice - free text
 * never travels by WhatsApp / e-mail (contract section 8). Nothing is sent until the person presses the button. Events: `saved`
 * (detail: {notified}), `close`.
 */
@customElement('tickets-rfq-message-dialog')
export class TicketsRfqMessageDialog extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) rfq: RfqDetail | null = null;
  @property({ attribute: false }) vendor: RfqVendor | null = null;
  @state() private items: RfqMessage[] | null = null;
  @state() private text = '';
  @state() private notify = true;
  @state() private busy = false;
  @state() private error = '';

  static styles = [bubbleChrome, ...automationsStyles, rfqStyles];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  /** RFQ-VENDOR-UPLOAD (contract 19.10): the files the vendor attached to this question - each a download (the server says so too). */
  private files(m: RfqMessage) {
    const url = ticketsRfqApi().vendorFileUrl;
    const list = (m.files ?? []).filter((f) => !f.removed);
    if (!list.length || !url || !this.rfq) return nothing;
    const rid = this.rfq.id;
    return html`<small data-rfq-question-files>${rt('rowVendorFiles')}: ${list.map((f, i) => html`${i ? ', ' : ''}<a href=${url(rid, f.id)} download
      rel="noopener noreferrer" data-rfq-question-file=${f.id}>${bidi(f.name)}</a>`)}</small>`;
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('open') && this.open) {
      this.text = '';
      this.notify = this.vendor?.channel !== 'manual';
      this.error = '';
      this.items = null;
      void this.load();
    }
  }

  private async load(): Promise<void> {
    if (!this.rfq || !this.vendor) return;
    try {
      this.items = (await ticketsRfqApi().messages(this.rfq.id, this.vendor.id)).items;
    } catch {
      this.items = [];
    }
    // RFQQUESTIONS: an RFQ manager opened the thread - the vendor's questions are no longer "new" (still pending until answered)
    if (this.rfq.can.answer && (this.vendor.questions?.unread ?? 0) > 0) {
      try {
        await ticketsRfqApi().markRead(this.rfq.id, this.vendor.id);
        refreshRfqQuestions();
      } catch {
        /* the badge stays "new" */
      }
    }
  }

  private async save(): Promise<void> {
    if (!this.rfq || !this.vendor || !this.text.trim()) return;
    this.busy = true;
    this.error = '';
    try {
      const a = await ticketsRfqApi().writeMessage(this.rfq.id, this.vendor.id, this.text.trim(), this.notify);
      this.dispatchEvent(new CustomEvent('saved', { detail: { notified: a.notified.queued } }));
    } catch (e) {
      this.error = rfqError(e);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const name = this.vendor ? this.vendor.contact.company || this.vendor.contact.name : '';
    const canNotify = this.vendor?.channel !== 'manual';
    return html`<sw-dialog ?open=${this.open} ?locked=${this.busy} heading=${rt('writeTitle', { name })} data-rfq-message-dialog @close=${() => this.dispatchEvent(new CustomEvent('close'))}>
      <div class="stack">
        <div class="thread" role="log" aria-label=${rt('thread')} data-rfq-thread>
          ${this.items === null ? html`<span class="skl" style="block-size:40px"></span>`
            : this.items.length ? this.items.map((m) => html`<div class=${`m ${m.direction}`} ?data-rfq-via-whatsapp=${m.via === 'whatsapp'}>${bidi(m.text)}<small>${bidi(m.by)} · ${dateTime(m.at)}${m.via === 'whatsapp' ? ` · ${rt('viaWhatsapp')}` : ''}${m.question ? ` · ${rt(m.question.state === 'answered' ? 'qAnswered' : 'qPendingChip')}` : ''}${m.to_all ? ` · ${rt('qToAll')}` : ''}</small>${this.files(m)}</div>`)
            : html`<span class="note">${rt('threadEmpty')}</span>`}
        </div>
        <label class="fld">${rt('writeVendor')}<textarea class="inp" style="min-block-size:96px;padding-block:10px" maxlength=${MESSAGE_MAX} data-rfq-message-text .value=${this.text}
          @input=${(e: Event) => (this.text = (e.target as HTMLTextAreaElement).value)}></textarea></label>
        ${canNotify ? html`<label class="chk"><input type="checkbox" data-rfq-message-notify .checked=${this.notify} @change=${(e: Event) => (this.notify = (e.target as HTMLInputElement).checked)} />${rt('writeNotify')}</label>` : nothing}
        <div class="note">${rt('writeNote')}</div>
        ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${() => this.dispatchEvent(new CustomEvent('close'))}>${rt('cancel')}</button>
      <button slot="footer" type="button" class="btn primary" data-rfq-message-send ?disabled=${this.busy || !this.text.trim()} @click=${() => void this.save()}>${tIcon('send')}${rt('writeSend')}</button>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-rfq-message-dialog': TicketsRfqMessageDialog;
  }
}
