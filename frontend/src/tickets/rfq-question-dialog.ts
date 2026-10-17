import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ticketsRfqApi, type RfqAnswerPreview, type RfqDetail, type RfqQuestion } from '../api/tickets-rfq';
import { tIcon } from './icons';
import { rt, type RfqTextKey } from './rfq-text';
import { rfqStyles } from './rfq-styles';
import { clientRequestId, dateTime } from './rfq-model';
import { ANSWER_MAX, QUESTION_SHOWN_MAX, answerBody, answerProblems } from './rfq-questions';
import { rfqError } from './rfq-new';
import { ticketsLang } from './text';

/**
 * RFQQUESTIONS `<tickets-rfq-question-dialog .rfq .question .open>`: the manager answers ONE vendor question from where he saw it (the
 * pending section of the board, a badge of the comparison). Step 1 - the question, the answer, "send to": only the vendor who asked (the
 * default) or every vendor of the request (the question as the others will read it - editable, the asker's name only when ticked).
 * Step 2 - "לשלוח הודעה לספק?": the server's exact text per recipient and whether a notice goes; NOTHING is stored until "שליחת התשובה".
 * The text stays in each vendor's private thread; a notice carries no text (contract 8). Events: `saved` ({rfq, copies, notified}), `close`.
 */
@customElement('tickets-rfq-question-dialog')
export class TicketsRfqQuestionDialog extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) rfq: RfqDetail | null = null;
  @property({ attribute: false }) question: RfqQuestion | null = null;
  @state() private text = '';
  @state() private scope: 'vendor' | 'all' = 'vendor';
  @state() private shown = '';
  @state() private named = false;
  @state() private notify = true;
  @state() private preview: RfqAnswerPreview | null = null;
  @state() private busy = false;
  @state() private error = '';
  private crid = '';

  static styles = [bubbleChrome, ...automationsStyles, rfqStyles];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if ((changed.has('open') || changed.has('question')) && this.open) {
      this.text = '';
      this.scope = 'vendor';
      this.shown = this.question?.text ?? '';
      this.named = false;
      this.notify = true;
      this.preview = null;
      this.error = '';
      this.crid = clientRequestId();
    }
  }

  private body() {
    return answerBody(this.text, this.scope, this.shown, this.named, this.notify);
  }

  private async toPreview(): Promise<void> {
    if (!this.rfq || !this.question || answerProblems(this.body(), this.question.text).length) return;
    this.busy = true;
    this.error = '';
    try {
      this.preview = await ticketsRfqApi().answerPreview(this.rfq.id, this.question.id, this.body());
    } catch (e) {
      this.error = rfqError(e);
    } finally {
      this.busy = false;
    }
  }

  private async send(): Promise<void> {
    if (!this.rfq || !this.question) return;
    this.busy = true;
    this.error = '';
    try {
      const a = await ticketsRfqApi().answer(this.rfq.id, this.question.id, this.body(), this.crid);
      this.dispatchEvent(new CustomEvent('saved', { detail: { rfq: a.rfq, copies: a.answer.items.length, notified: a.answer.notified } }));
    } catch (e) {
      this.error = rfqError(e);
    } finally {
      this.busy = false;
    }
  }

  private close = () => {
    if (!this.busy) this.dispatchEvent(new CustomEvent('close'));
  };

  private form() {
    const q = this.question as RfqQuestion;
    const problems = answerProblems(this.body(), q.text);
    const opt = (s: 'vendor' | 'all', title: RfqTextKey, sub: RfqTextKey) => html`<label data-rfq-answer-scope=${s}>
      <input type="radio" name="qscope" .checked=${this.scope === s} ?disabled=${this.busy} @change=${() => (this.scope = s)} /><b>${rt(title)}</b><small>${rt(sub)}</small></label>`;
    return html`<div class="stack">
        <div class="qbox" data-rfq-answer-question><small>${rt('qQuestion')} · ${dateTime(q.at)}${q.unverified ? ` · ${rt('qViaWhatsapp')}` : ''}</small><p>${bidi(q.text)}</p></div>
        <label class="fld">${rt('qAnswerLabel')}<textarea class="inp" style="min-block-size:96px;padding-block:10px" maxlength=${ANSWER_MAX} data-rfq-answer-text .value=${this.text}
          @input=${(e: Event) => (this.text = (e.target as HTMLTextAreaElement).value)}></textarea></label>
        <div class="choice" role="radiogroup" aria-label=${rt('qScope')}>${opt('vendor', 'qScopeVendor', 'qScopeVendorSub')}${opt('all', 'qScopeAll', 'qScopeAllSub')}</div>
        ${this.scope === 'all' ? html`<label class="fld">${rt('qShownAs')}<textarea class="inp" style="min-block-size:64px;padding-block:10px" maxlength=${QUESTION_SHOWN_MAX} data-rfq-answer-shown
            .value=${this.shown} @input=${(e: Event) => (this.shown = (e.target as HTMLTextAreaElement).value)}></textarea><small class="mut">${rt('qShownNote')}</small></label>
          <label class="chk"><input type="checkbox" data-rfq-answer-named .checked=${this.named} @change=${(e: Event) => (this.named = (e.target as HTMLInputElement).checked)} />${rt('qNameAsker')}</label>` : nothing}
        <label class="chk"><input type="checkbox" data-rfq-answer-notify .checked=${this.notify} @change=${(e: Event) => (this.notify = (e.target as HTMLInputElement).checked)} />${rt('qNotify')}</label>
        <div class="note">${rt('writeNote')}</div>
        ${this.error ? html`<div class="err" role="alert" data-dlg-error>${this.error}</div>` : nothing}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${this.close}>${rt('cancel')}</button>
      <button slot="footer" type="button" class="btn primary" data-rfq-answer-preview ?disabled=${this.busy || problems.length > 0} @click=${() => void this.toPreview()}>${rt('qPreview')}</button>`;
  }

  private confirm() {
    const p = this.preview as RfqAnswerPreview;
    const dir = ticketsLang() === 'en' ? 'ltr' : 'rtl';
    return html`<div class="stack">
        <p class="note">${rt('qSendAskNote')}</p>
        <ul class="thr" data-rfq-answer-recipients>${p.recipients.map((r) => html`<li data-rfq-answer-to=${r.vendor_id}>
          <b>${bidi(r.vendor.company || r.vendor.name)}</b>${r.asker ? html` <span class="chip info">${rt('qAsker')}</span>` : nothing}
          <small class="mut">${r.notify_channel ? rt('qWillNotify', { channel: rt(`ch_${r.notify_channel}` as RfqTextKey) }) : rt('qNoNotify')}</small>
          <pre class="pv" dir=${dir}>${r.text}</pre></li>`)}</ul>
        ${this.error ? html`<div class="err" role="alert" data-dlg-error>${this.error}</div>` : nothing}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${() => (this.preview = null)}>${rt('qBack')}</button>
      <button slot="footer" type="button" class="btn primary" data-rfq-answer-send ?disabled=${this.busy} @click=${() => void this.send()}>${tIcon('send')}${rt('qSend')}</button>`;
  }

  render() {
    const q = this.question;
    if (!this.open || !q) return nothing;
    const name = q.vendor.company || q.vendor.name;
    const heading = this.preview ? (this.preview.recipients.length > 1 ? rt('qSendAskAll', { n: this.preview.recipients.length }) : rt('qSendAsk')) : rt('qTitle', { name });
    return html`<sw-dialog open wide ?locked=${this.busy} heading=${heading} data-rfq-question-dialog=${this.preview ? 'confirm' : 'form'} @close=${this.close}>
      ${this.preview ? this.confirm() : this.form()}
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-rfq-question-dialog': TicketsRfqQuestionDialog;
  }
}
