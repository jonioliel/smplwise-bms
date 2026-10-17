import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ticketsRfqApi, type RfqAward, type RfqAwardTerms, type RfqDetail } from '../api/tickets-rfq';
import { formatMoney } from './cost-model';
import { tIcon } from './icons';
import { rIcon } from './rfq-icons';
import { rt, type RfqTextKey } from './rfq-text';
import { rfqStyles } from './rfq-styles';
import { initials, windowText } from './rfq-model';
import { arrivalKey, dueWords, scheduleExact } from './rfq-terms-model';
import { rfqError } from './rfq-new';
import { ticketsLang } from './text';

/**
 * CR-RFQ-PAYMENT-SCHEDULE `<tickets-rfq-terms .rfq>` (RFQ contract section 19): per approved award with terms - the approved payment
 * schedule (amounts with tickets.costs.view, else the due rules only), where it came from (the vendor's proposal / edited at approval /
 * the default), the planned arrival, the vendor's confirmation or the date he proposed, and - for an RFQ manager - accept / reject of that
 * date. After a rejection the server offers an editable notice (`terms.draft`); it is sent only by the manager's click on "send"
 * (the thread + the templated `rfq_update` - review F7); nothing else here sends a message. Events:
 * `changed` (detail: RfqDetail), `notice` ({ok} | {error}).
 */
@customElement('tickets-rfq-terms')
export class TicketsRfqTerms extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) rfq: RfqDetail | null = null;
  @state() private busy = '';
  @state() private errors: Record<string, string> = {};
  /** review F7: the manager's edits of each award's rejection notice */
  @state() private drafts: Record<string, string> = {};

  static styles = [bubbleChrome, ...automationsStyles, rfqStyles, css`
    .tcards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: var(--sw-s-4); }
    .tcard { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: var(--sw-r-xl); border: 1px solid var(--dv-border);
      background: var(--dv-surface-2); min-inline-size: 0; }
    .thead { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
    .thead .chip { margin-inline-start: auto; }
    .trow { display: flex; justify-content: space-between; gap: 10px; font-size: var(--sw-fs-sm); }
    .tlist { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
    .tacts { display: flex; flex-wrap: wrap; gap: 10px; }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  private money(minor: number | null | undefined, currency: string): string {
    return formatMoney(minor ?? null, currency, ticketsLang() === 'en' ? 'en' : 'he');
  }

  private vendorName(id: string): string {
    const v = this.rfq?.vendors.find((x) => x.id === id);
    return v ? v.contact.company || v.contact.name : '';
  }

  private async decide(a: RfqAward, t: RfqAwardTerms, action: 'accept' | 'reject'): Promise<void> {
    const d = this.rfq;
    const api = ticketsRfqApi();
    if (!d || this.busy || !api.decideArrival) return;
    this.busy = a.id;
    this.errors = { ...this.errors, [a.id]: '' };
    try {
      const next = await api.decideArrival(d.id, a.id, action, t.revision);
      this.rfq = next;
      this.dispatchEvent(new CustomEvent('changed', { detail: next }));
      this.dispatchEvent(new CustomEvent('notice', { detail: { ok: rt(action === 'accept' ? 'trmAccepted' : 'trmRejected') }, bubbles: true, composed: true }));
    } catch (e) {
      this.errors = { ...this.errors, [a.id]: rfqError(e) };
    } finally {
      this.busy = '';
    }
  }

  /** Review F7: the manager's explicit send of the rejection notice (the award-draft pattern: the thread + the templated `rfq_update`;
   * the server restarts the reminder clock only when the notice was queued). */
  private async sendDraft(a: RfqAward, t: RfqAwardTerms): Promise<void> {
    const d = this.rfq;
    const draft = t.draft;
    if (!d || !draft || this.busy) return;
    const text = (this.drafts[a.id] ?? draft.text).trim();
    if (!text) return;
    this.busy = a.id;
    this.errors = { ...this.errors, [a.id]: '' };
    try {
      await ticketsRfqApi().writeMessage(d.id, a.vendor_id, text, true, draft.send.source);
      const next = await ticketsRfqApi().get(d.id);
      this.rfq = next;
      this.dispatchEvent(new CustomEvent('changed', { detail: next }));
      this.dispatchEvent(new CustomEvent('notice', { detail: { ok: rt('trmDraftSent') }, bubbles: true, composed: true }));
    } catch (e) {
      this.errors = { ...this.errors, [a.id]: rfqError(e) };
    } finally {
      this.busy = '';
    }
  }

  private card(a: RfqAward, t: RfqAwardTerms): TemplateResult {
    const name = this.vendorName(a.vendor_id);
    const key = arrivalKey(t);
    const s = t.schedule;
    const words = { done: rt('pdDone'), after: rt('pdAfter') };
    const src = { vendor: 'trmSourceVendor', manager: 'trmSourceManager', default: 'trmSourceDefault' }[s.source] as RfqTextKey;
    const ar = t.arrival;
    const err = this.errors[a.id];
    return html`<article class="tcard" data-rfq-terms-card=${a.vendor_id} data-award=${a.id} data-arrival=${ar.state} aria-label=${`${rt('trmSection')}: ${name}`}>
      <div class="thead"><span class="av" aria-hidden="true">${initials(name)}</span><b>${bidi(name)}</b>
        <span class=${`chip ${key === 'trm_confirmed' ? 'ok' : key === 'trm_proposed' ? 'warn' : ''}`} data-arrival-chip=${key}>${rt(key)}</span></div>
      <div class="trow" data-terms-planned><span>${rIcon('cal')} ${rt('trmPlanned')}</span><b class="num">${windowText(ar.planned_from, ar.planned_to) || rt('trmNone')}</b></div>
      ${ar.state === 'proposed' ? html`<div class="trow" data-terms-proposed><span>${rt('trmProposed')}</span><b class="num">${windowText(ar.proposed_from, ar.proposed_to)}</b></div>` : nothing}
      ${ar.reminders ? html`<div class="note">${rt('trmReminders', { n: ar.reminders })}</div>` : nothing}
      <div class="trow"><b>${rt('trmSchedule')}</b><small class="mut">${rt(src)}</small></div>
      <ul class="tlist" data-terms-schedule>${s.items.map((it) => html`<li class="trow" data-instalment=${it.kind}>
        <span>${rt(`pk_${it.kind}` as RfqTextKey)} · ${dueWords(it, words)}</span>
        ${it.amount_minor !== null ? html`<span class="num">${this.money(it.amount_minor, s.currency)}</span>` : nothing}</li>`)}</ul>
      ${s.total_minor !== null ? html`<div class="trow"><span>${rt('rowTotal')}</span><b class="num">${this.money(s.total_minor, s.currency)}</b></div>` : nothing}
      ${scheduleExact(t) ? nothing : html`<div class="err" role="alert">${rt('trmInexact')}</div>`}
      ${t.can.decide_arrival && ticketsRfqApi().decideArrival ? html`<div class="tacts">
        <button type="button" class="btn primary sm" data-arrival-accept=${a.id} ?disabled=${!!this.busy} @click=${() => void this.decide(a, t, 'accept')}>${tIcon('check')}${rt('trmAccept')}</button>
        <button type="button" class="btn sm" data-arrival-reject=${a.id} ?disabled=${!!this.busy} @click=${() => void this.decide(a, t, 'reject')}>${rt('trmReject')}</button></div>` : nothing}
      ${t.draft ? html`<label class="fld" data-terms-draft=${a.id}>${rt('trmDraft')}
        <textarea class="inp" rows="3" maxlength="2000" .value=${this.drafts[a.id] ?? t.draft.text}
          @input=${(e: Event) => { this.drafts = { ...this.drafts, [a.id]: (e.target as HTMLTextAreaElement).value }; }}></textarea></label>
        <div class="tacts"><button type="button" class="btn sm" data-terms-draft-send=${a.id} ?disabled=${!!this.busy} @click=${() => void this.sendDraft(a, t)}>${rt('trmDraftSend')}</button></div>` : nothing}
      ${err ? html`<div class="err" role="alert" data-terms-error>${err}</div>` : nothing}
    </article>`;
  }

  render() {
    const d = this.rfq;
    const list = (d?.awards ?? []).filter((a) => a.state === 'approved' && a.terms);
    if (!d || !list.length) return nothing;
    return html`<section class="rcard" aria-labelledby="h-terms" data-rfq-terms>
      <h2 id="h-terms">${rIcon('cal')}${rt('trmSection')}</h2>
      <p class="note">${rt('trmSub')}</p>
      <div class="tcards">${list.map((a) => this.card(a, a.terms as RfqAwardTerms))}</div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-rfq-terms': TicketsRfqTerms;
  }
}
