import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ticketsRfqApi, type RfqAward, type RfqAwardTerms, type RfqDemandAction, type RfqDetail, type RfqInstalment } from '../api/tickets-rfq';
import { formatMoney } from './cost-model';
import { tIcon } from './icons';
import { rIcon } from './rfq-icons';
import { rt, type RfqTextKey } from './rfq-text';
import { rfqStyles } from './rfq-styles';
import { dayToIso, initials, windowText } from './rfq-model';
import { arrivalKey, dueWords, isoLocalDay, scheduleExact } from './rfq-terms-model';
import { rfqError } from './rfq-new';
import { ticketsLang } from './text';

/**
 * CR-RFQ-PAYMENT-SCHEDULE `<tickets-rfq-terms .rfq>` (RFQ contract section 20): per approved award with terms - the approved payment
 * schedule (amounts with tickets.costs.view, else the due rules only), where it came from (the vendor's proposal / edited at approval /
 * the default), the planned arrival, the vendor's confirmation or the date he proposed, and - for an RFQ manager - accept / reject of that
 * date. After a rejection the server offers an editable notice (`terms.draft`); it is sent only by the manager's click on "send"
 * (the thread + the templated `rfq_update` - review F7); nothing else here sends a message. RFQPAY2 (20.11 - 20.13): per schedule row,
 * for a viewer who may decide costs - make the instalment's payment demand, mark it paid (a payment made outside the system) or cancel
 * it, and change a dated instalment's day (reason optional); the row shows "moved" (with the agreed day) and "past its date". Events:
 * `changed` (detail: RfqDetail), `notice` ({ok} | {error}).
 */
/** RFQPAY2: an open date-move editor (an instalment day, or the arrival window `date`..`to`) and its optional vendor notice. */
interface MoveDraft { date: string; to: string; reason: string; notify: boolean; message: string;
  /** RFQPAY2 20.15: re-send the already-sent work order; `orderText` = its preview with the new dates (null = not loaded) */
  resend: boolean; orderText: string | null }

@customElement('tickets-rfq-terms')
export class TicketsRfqTerms extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) rfq: RfqDetail | null = null;
  @state() private busy = '';
  @state() private errors: Record<string, string> = {};
  /** review F7: the manager's edits of each award's rejection notice */
  @state() private drafts: Record<string, string> = {};
  /** RFQPAY2: the open "change date" editors, by `<award id>:<instalment index>` */
  @state() private moving: Record<string, MoveDraft> = {};

  static styles = [bubbleChrome, ...automationsStyles, rfqStyles, css`
    .tcards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: var(--sw-s-4); }
    .tcard { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: var(--sw-r-xl); border: 1px solid var(--dv-border);
      background: var(--dv-surface-2); min-inline-size: 0; }
    .thead { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
    .thead .chip { margin-inline-start: auto; }
    .trow { display: flex; justify-content: space-between; gap: 10px; font-size: var(--sw-fs-sm); }
    .tlist { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
    .tacts { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    .tins { display: flex; flex-direction: column; gap: 6px; padding-block-end: 6px; border-block-end: 1px solid var(--dv-border); }
    .tins:last-child { border-block-end: 0; padding-block-end: 0; }
    .tins[data-overdue='yes'] .trow span:first-child { color: var(--dv-warn, inherit); }
    .tmove { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 8px; }
    .tmove .tacts, .tmove .tfull, .tmove .tcheck { grid-column: 1 / -1; }
    .tpre { white-space: pre-wrap; margin: 4px 0; font: inherit; }
    .tcheck { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); }
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

  private done(next: RfqDetail, ok: string): void {
    this.rfq = next;
    this.dispatchEvent(new CustomEvent('changed', { detail: next }));
    this.dispatchEvent(new CustomEvent('notice', { detail: { ok }, bubbles: true, composed: true }));
  }

  /** RFQPAY2 (20.11): the instalment's payment demand from its schedule row - create (idempotent) / mark paid / cancel. Nothing is sent
   * and nothing is paid: "paid" records a payment made outside the system. */
  private async demand(a: RfqAward, it: RfqInstalment, action: RfqDemandAction): Promise<void> {
    const d = this.rfq;
    const api = ticketsRfqApi();
    if (!d || this.busy || !api.instalmentDemand) return;
    this.busy = a.id;
    this.errors = { ...this.errors, [a.id]: '' };
    try {
      const res = await api.instalmentDemand(d.id, a.id, it.index, action);
      this.done(res.rfq, rt(action === 'create' ? (res.created ? 'insDemandMade' : 'insDemandExists') : action === 'paid' ? 'insPaidDone' : 'insCancelled'));
    } catch (e) {
      this.errors = { ...this.errors, [a.id]: rfqError(e) };
    } finally {
      this.busy = '';
    }
  }

  private openMove(key: string, date: string, to: string): void {
    this.moving = { ...this.moving, [key]: { date, to, reason: '', notify: false, message: '', resend: false, orderText: null } };
  }

  private closeMove(key: string): void {
    const rest = { ...this.moving };
    delete rest[key];
    this.moving = rest;
  }

  /** RFQPAY2 (20.13 / 20.14): save a moved instalment day (`it`) or arrival window (no `it`) - audited, the reason optional; the vendor
   * is told ONLY when the manager ticked "notify the vendor" (his edited text: the thread + the templated notice, in the same act). */
  private async move(a: RfqAward, t: RfqAwardTerms, it: RfqInstalment | null): Promise<void> {
    const d = this.rfq;
    const api = ticketsRfqApi();
    const key = it ? `${a.id}:${it.index}` : `${a.id}:arrival`;
    const m = this.moving[key];
    if (!d || !m?.date || this.busy) return;
    const opts = { reason: m.reason, notify: m.notify, message: m.message, resendOrder: m.resend };
    this.busy = a.id;
    this.errors = { ...this.errors, [a.id]: '' };
    try {
      let next: RfqDetail | null = null;
      if (it && api.moveInstalment) next = await api.moveInstalment(d.id, a.id, it.index, m.date, t.revision, opts);
      if (!it && api.moveArrival) next = await api.moveArrival(d.id, a.id, dayToIso(m.date), m.to ? dayToIso(m.to) : null, t.revision, opts);
      if (!next) return;
      this.closeMove(key);
      this.done(next, rt(m.resend ? 'mvOrderResent' : m.notify ? 'insMovedSent' : it ? 'insMovedDone' : 'arrMovedDone'));
    } catch (e) {
      this.errors = { ...this.errors, [a.id]: rfqError(e) };
    } finally {
      this.busy = '';
    }
  }

  /** RFQPAY2 (20.15): the preview of the re-sent work order - the exact template text with the window about to be saved. */
  private async loadOrderPreview(a: RfqAward, key: string, it: RfqInstalment | null): Promise<void> {
    const d = this.rfq;
    const m = this.moving[key];
    if (!d || !m) return;
    const t = a.terms;
    const from = it ? isoLocalDay(t?.arrival.planned_from) : m.date;
    const to = it ? isoLocalDay(t?.arrival.planned_to) : m.to;
    try {
      const pv = await ticketsRfqApi().orderPreview(d.id, a.id, from ? { work_from: dayToIso(from), work_to: to ? dayToIso(to) : null } : undefined);
      const cur = this.moving[key];
      if (cur) this.moving = { ...this.moving, [key]: { ...cur, orderText: pv.refusals.length ? '' : pv.text } };
    } catch (e) {
      this.errors = { ...this.errors, [a.id]: rfqError(e) };
    }
  }

  /** RFQPAY2: the move editor - the new day (and, for the arrival, the last day), the optional reason, and the "notify the vendor" tick
   * (default off) that opens the editable preview of the notice. */
  private moveEditor(a: RfqAward, t: RfqAwardTerms, it: RfqInstalment | null, key: string, m: MoveDraft, current: string): TemplateResult {
    const set = (patch: Partial<MoveDraft>) => { this.moving = { ...this.moving, [key]: { ...m, ...patch } }; };
    const canNotify = !!t.can.notify_vendor && !!t.notice;
    const preview = (it ? t.notice?.instalment : t.notice?.arrival) ?? '';
    const bad = !m.date || (!it && !!m.to && m.to < m.date) || (m.notify && !m.message.trim()) || (m.resend && !m.orderText);
    return html`<div class="tmove" data-move=${key}>
      <label class="fld">${rt(it ? 'insMoveDate' : 'arrMoveFrom')}<input class="inp" type="date" dir="ltr" .value=${m.date}
        @input=${(e: Event) => set({ date: (e.target as HTMLInputElement).value })}></label>
      ${it ? nothing : html`<label class="fld">${rt('arrMoveTo')}<input class="inp" type="date" dir="ltr" .value=${m.to}
        @input=${(e: Event) => set({ to: (e.target as HTMLInputElement).value })}></label>`}
      <label class="fld">${rt('insMoveReason')}<input class="inp" type="text" maxlength="500" .value=${m.reason}
        @input=${(e: Event) => set({ reason: (e.target as HTMLInputElement).value })}></label>
      ${canNotify ? html`<label class="tcheck" data-move-notify=${key}><input type="checkbox" .checked=${m.notify}
        @change=${(e: Event) => set({ notify: (e.target as HTMLInputElement).checked, message: m.message || preview })}>${rt('mvNotify')}</label>
        ${m.notify ? html`<label class="fld tfull" data-move-message=${key}>${rt('mvMessage')}
          <textarea class="inp" rows="3" maxlength="2000" .value=${m.message}
            @input=${(e: Event) => set({ message: (e.target as HTMLTextAreaElement).value })}></textarea>
          <small class="mut">${rt('mvMessageNote')}</small></label>` : nothing}` : nothing}
      ${a.can?.resend_order ? html`<label class="tcheck" data-move-resend=${key}><input type="checkbox" .checked=${m.resend}
        @change=${(e: Event) => { const on = (e.target as HTMLInputElement).checked; set({ resend: on, orderText: null }); if (on) void this.loadOrderPreview(a, key, it); }}>${rt('mvResend')}</label>
        ${m.resend ? html`<div class="tfull note" data-move-order-preview=${key}>${m.orderText === null ? rt('mvOrderLoading')
          : m.orderText ? html`<pre class="tpre">${m.orderText}</pre>` : rt('mvOrderUnavailable')}<small class="mut">${rt('mvResendNote')}</small></div>` : nothing}` : nothing}
      <div class="tacts"><button type="button" class="btn primary sm" data-move-save=${key} ?disabled=${!!this.busy || bad || m.date === current}
        @click=${() => void this.move(a, t, it)}>${rt(m.notify ? 'mvSaveSend' : 'insMoveSave')}</button>
        <button type="button" class="btn sm" data-move-close=${key} @click=${() => this.closeMove(key)}>${rt('insMoveClose')}</button></div>
    </div>`;
  }

  /** RFQPAY2: one schedule row - the due rule, the moved / overdue markers, the demand state and the actions of a costs decider. */
  private instalment(a: RfqAward, t: RfqAwardTerms, it: RfqInstalment, currency: string, words: { done: string; after: string }): TemplateResult {
    const dm = it.demand ?? null;
    const key = `${a.id}:${it.index}`;
    const m = this.moving[key];
    const api = ticketsRfqApi();
    const canDemand = !!t.can.demand && !!api.instalmentDemand;
    const canMove = !!t.can.reschedule && !!api.moveInstalment && it.due === 'date' && dm?.status !== 'paid';
    const offerCreate = canDemand && it.amount_minor !== 0 && (!dm || dm.status === 'cancelled');
    const actions = it.overdue || dm || offerCreate || (canMove && !m);
    return html`<li class="tins" data-instalment=${it.kind} data-index=${it.index} data-overdue=${it.overdue ? 'yes' : 'no'}>
      <div class="trow"><span>${rt(`pk_${it.kind}` as RfqTextKey)} · ${dueWords(it, words)}
        ${it.agreed_date ? html`<small class="mut" data-moved>${rt('insMoved', { date: dueWords({ due: 'date', date: it.agreed_date, days: null }, words) })}</small>` : nothing}</span>
        ${it.amount_minor !== null ? html`<span class="num">${this.money(it.amount_minor, currency)}</span>` : nothing}</div>
      ${actions ? html`<div class="tacts">
        ${it.overdue ? html`<span class="chip warn" data-overdue-chip>${rt('insOverdue')}</span>` : nothing}
        ${dm ? html`<span class=${`chip ${dm.status === 'paid' ? 'ok' : ''}`} data-demand=${dm.status}>${rt(`ds_${dm.status}` as RfqTextKey)}</span>` : nothing}
        ${offerCreate ? html`<button type="button" class="btn sm" data-demand-create=${key} ?disabled=${!!this.busy}
          @click=${() => void this.demand(a, it, 'create')}>${rt('insDemand')}</button>` : nothing}
        ${canDemand && dm?.status === 'open' ? html`<button type="button" class="btn primary sm" data-demand-paid=${key} ?disabled=${!!this.busy}
          @click=${() => void this.demand(a, it, 'paid')}>${tIcon('check')}${rt('insPaid')}</button>
          <button type="button" class="btn sm" data-demand-cancel=${key} ?disabled=${!!this.busy} @click=${() => void this.demand(a, it, 'cancel')}>${rt('insCancel')}</button>` : nothing}
        ${canMove && !m ? html`<button type="button" class="btn sm" data-move-open=${key} ?disabled=${!!this.busy}
          @click=${() => this.openMove(key, it.date ?? '', '')}>${rIcon('cal')}${rt('insMove')}</button>` : nothing}
      </div>` : nothing}
      ${canMove && m ? this.moveEditor(a, t, it, key, m, it.date ?? '') : nothing}
    </li>`;
  }

  /** RFQPAY2 (20.14): "change the arrival date" for a costs decider while the work is not marked done. */
  private arrivalMove(a: RfqAward, t: RfqAwardTerms): TemplateResult | typeof nothing {
    if (!t.can.reschedule_arrival || !ticketsRfqApi().moveArrival) return nothing;
    const key = `${a.id}:arrival`;
    const m = this.moving[key];
    const from = isoLocalDay(t.arrival.planned_from);
    if (m) return this.moveEditor(a, t, null, key, m, from);
    return html`<div class="tacts"><button type="button" class="btn sm" data-arrival-move-open=${a.id} ?disabled=${!!this.busy}
      @click=${() => this.openMove(key, from, isoLocalDay(t.arrival.planned_to))}>${rIcon('cal')}${rt('arrMove')}</button></div>`;
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
      <div class="trow" data-terms-planned><span>${rIcon('cal')} ${rt('trmPlanned')}
        ${ar.changed_at ? html`<small class="mut" data-arrival-moved>${rt('arrMoved')}</small>` : nothing}</span>
        <b class="num">${windowText(ar.planned_from, ar.planned_to) || rt('trmNone')}</b></div>
      ${this.arrivalMove(a, t)}
      ${ar.state === 'proposed' ? html`<div class="trow" data-terms-proposed><span>${rt('trmProposed')}</span><b class="num">${windowText(ar.proposed_from, ar.proposed_to)}</b></div>` : nothing}
      ${ar.reminders ? html`<div class="note">${rt('trmReminders', { n: ar.reminders })}</div>` : nothing}
      <div class="trow"><b>${rt('trmSchedule')}</b><small class="mut">${rt(src)}</small></div>
      <ul class="tlist" data-terms-schedule>${s.items.map((it) => this.instalment(a, t, it, s.currency, words))}</ul>
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
