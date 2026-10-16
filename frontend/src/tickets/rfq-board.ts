import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-dialog';
import './rfq-quote-dialog';
import './rfq-message-dialog';
import './rfq-order';
import { automationsStyles } from '../styles/automations-glass';
import { mediaPageStyles } from '../styles/media-page';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError } from '../api/client';
import { ticketsS4Api, type Contact } from '../api/tickets-s4';
import type { LineKind } from '../api/tickets-costs';
import { ticketsRfqApi, type RfqAward, type RfqDetail, type RfqMeta, type RfqVendor } from '../api/tickets-rfq';
import { rememberDemoContact } from '../api/tickets-rfq-mock';
import { formatMoney } from './cost-model';
import { ct, type CostTextKey } from './cost-text';
import { tIcon } from './icons';
import { rIcon } from './rfq-icons';
import { rt, type RfqTextKey } from './rfq-text';
import { rfqStyles } from './rfq-styles';
import {
  boardVendors, clientRequestId, dateTime, shortDate, dayToIso, eventLine, initials, invitable, invitePreview, isoToLocal, liveQuotes, localToIso, rfqHref, rfqStateTone,
  remindable, toggleKind, vendorStateTone, windowText,
} from './rfq-model';
import { rfqError } from './rfq-new';
import { tt, ticketsLang } from './text';

type Dlg =
  | { kind: 'remind'; ids: string[] }
  | { kind: 'vendor'; v: RfqVendor }
  | { kind: 'remove' | 'revoke' | 'decline' | 'withdraw'; v: RfqVendor }
  | { kind: 'quote' | 'message'; v: RfqVendor }
  | { kind: 'more' | 'add' | 'edit' | 'cancel' | 'close' | 'delete' | 'send' }
  | { kind: 'second-decline'; a: RfqAward }
  | null;

/**
 * TKRFQ2 `<tickets-rfq-board .rfqId .meta>`: one request for quotation (mock-up v5 "לוח ספקים"): the title with the reference, the
 * place, who opened it and the deadline; the KPI glass tiles (sent to / opened / quotes / not interested / no reply / lowest); the
 * vendors table (channel, state with the decline reason, sent, opened, quote with its time, the row's actions) and the timeline card.
 * A draft offers "send" (the confirmation with the channel mode - never an automatic send); a pending second approval shows its banner
 * with confirm / decline for an approver; an award shows the selected vendor (the approved cost baseline) and, when the server names
 * it, the item it opened; TKRFQ4: below it the work-order step (<tickets-rfq-order>, one card per selected vendor). Actions follow the server's `can` flags only - what the viewer may not do is not shown. Events: `notice`
 * ({ok} | {error}), `gone` (deleted).
 */
@customElement('tickets-rfq-board')
export class TicketsRfqBoard extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property() rfqId = '';
  @property({ attribute: false }) meta: RfqMeta | null = null;
  @state() private d: RfqDetail | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' | 'missing' = 'loading';
  @state() private failed = '';
  @state() private dlg: Dlg = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private reason = '';
  @state() private notify = true;
  @state() private sendMode: 'auto' | 'manual' = 'auto';
  @state() private contacts: Contact[] | null = null;
  @state() private picks = new Set<string>();
  /** TKRFQVP: vendors whose code the directory demands (the server answered 409 vendor_code_locked): the off-switch is disabled */
  @state() private codeLocked = new Set<string>();
  @state() private codeBusy = '';
  @state() private edit = { title: '', description: '', place: '', dueDate: '', dueTime: '', from: '', to: '', kinds: [] as LineKind[] };
  private seq = 0;

  static styles = [bubbleChrome, ...automationsStyles, mediaPageStyles, rfqStyles];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('rfqId') && this.rfqId) {
      this.d = null;
      this.phase = 'loading';
      void this.load();
    }
  }

  async load(): Promise<void> {
    const mine = ++this.seq;
    try {
      const d = await ticketsRfqApi().get(this.rfqId);
      if (mine !== this.seq) return;
      this.d = d;
      this.phase = 'ready';
    } catch (e) {
      if (mine !== this.seq) return;
      if (e instanceof ApiError && e.status === 404) this.phase = 'missing';
      else {
        this.failed = rfqError(e);
        this.phase = 'error';
      }
    }
  }

  private notice(detail: { ok?: string; error?: string }): void {
    this.dispatchEvent(new CustomEvent('notice', { detail, bubbles: true, composed: true }));
  }

  private money(minor: number | null | undefined, currency: string | null | undefined): string {
    return formatMoney(minor ?? null, currency ?? 'ILS', ticketsLang() === 'en' ? 'en' : 'he');
  }

  private open(dlg: Dlg): void {
    this.error = '';
    this.reason = '';
    this.dlg = dlg;
  }

  /** Run one write: the answer becomes the request; a stale copy re-reads it and says so; a refusal stays in the dialog. */
  private async run(fn: () => Promise<RfqDetail | void>, ok: string, keepOpen = false): Promise<boolean> {
    this.busy = true;
    this.error = '';
    try {
      const d = await fn();
      if (d) this.d = d;
      if (!keepOpen) this.dlg = null;
      if (ok) this.notice({ ok });
      return true;
    } catch (e) {
      this.error = rfqError(e);
      if (e instanceof ApiError && (e.code === 'rfq_stale' || e.code === 'quote_stale')) void this.load();
      return false;
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- actions

  private remind(ids: string[]): Promise<boolean> {
    const d = this.d as RfqDetail;
    return this.run(() => ticketsRfqApi().remind(d.id, ids), rt('remindDone', { n: ids.length }));
  }

  private send(): Promise<boolean> {
    const d = this.d as RfqDetail;
    const manual = this.sendMode === 'manual';
    return this.run(() => ticketsRfqApi().send(d.id, d.revision, this.sendMode, clientRequestId()), manual ? rt('sendMarked') : rt('sendDone'));
  }

  private async loadContacts(): Promise<void> {
    this.contacts = null;
    try {
      const [v, p] = await Promise.all([ticketsS4Api().contacts({ kind: 'vendor' }), ticketsS4Api().contacts({ kind: 'person' })]);
      this.contacts = [...v.contacts, ...p.contacts];
    } catch {
      this.contacts = [];
    }
  }

  private async addVendors(): Promise<void> {
    const ids = [...this.picks];
    if (!ids.length) return;
    await this.run(async () => {
      let d = this.d as RfqDetail;
      for (const id of ids) {
        const c = this.contacts?.find((x) => x.id === id);
        if (c) rememberDemoContact(c.id, c.display_name, c.vendor_name ?? c.company);
        d = await ticketsRfqApi().addVendor(d.id, id, d.revision);
        this.d = d;
      }
      return d;
    }, rt('saved'));
  }

  private openEdit(): void {
    const d = this.d as RfqDetail;
    const due = isoToLocal(d.due_at);
    this.edit = { title: d.title, description: d.description, place: d.place.text ?? '', dueDate: due.date, dueTime: due.time, from: isoToLocal(d.work_from).date,
      to: isoToLocal(d.work_to).date, kinds: [...d.allowed_line_kinds] };
    this.open({ kind: 'edit' });
  }

  private saveEdit(): Promise<boolean> {
    const d = this.d as RfqDetail;
    const e = this.edit;
    const draft = d.state === 'draft';
    const body = {
      revision: d.revision,
      ...(draft ? { title: e.title.trim(), description: e.description.trim(), place_text: e.place.trim(), allowed_line_kinds: e.kinds } : {}),
      due_at: localToIso(e.dueDate, e.dueTime || '12:00') || undefined,
      work_from: e.from ? dayToIso(e.from) : undefined, work_to: e.to ? dayToIso(e.to) : undefined,
    };
    return this.run(() => ticketsRfqApi().edit(d.id, body), rt('saved'));
  }

  private async del(): Promise<void> {
    const d = this.d as RfqDetail;
    const ok = await this.run(() => ticketsRfqApi().remove(d.id), rt('deleted'));
    if (ok) this.dispatchEvent(new CustomEvent('gone', { bubbles: true, composed: true }));
  }

  private async confirmSecond(a: RfqAward): Promise<void> {
    const d = this.d as RfqDetail;
    await this.run(async () => (await ticketsRfqApi().confirmAward(d.id, a.id, a.revision)).rfq, rt('secondConfirmed'));
  }

  // ---------------------------------------------------------------- parts

  private vendorName(id: string | null): string {
    const v = this.d?.vendors.find((x) => x.id === id);
    return v ? v.contact.company || v.contact.name : '';
  }

  private header(d: RfqDetail): TemplateResult {
    const quotes = liveQuotes(d);
    const sub = [d.ref, d.place.text, d.department.name].filter(Boolean).join(' · ');
    return html`<header class="dh" data-rfq-board-header>
      <div class="dh-row">
        <div class="titles">
          <div class="crumbs"><a href="#/tickets">${tt('area')}</a> › <a href=${rfqHref({})} data-rfq-crumb>${rt('navTitle')}</a> › <b>${d.ref}</b></div>
          <h1 data-rfq-title>${bidi(d.title)}</h1>
          <div class="subline"><span>${bidi(sub)}</span><span>${rt('createdBy', { when: dateTime(d.sent_at ?? d.created_at), who: d.created_by.name })}</span>
            ${d.due_at ? html`<span>${rt('fDue')}: <b>${dateTime(d.due_at)}</b></span>` : nothing}
            ${d.work_from || d.work_to ? html`<span>${rt('fWindow')}: <b>${windowText(d.work_from, d.work_to)}</b></span>` : nothing}</div>
        </div>
        <span class="grow"></span>
      </div>
      <div class="dh-det">
        <span class=${`chip ${rfqStateTone(d.state)}`} data-rfq-state=${d.state}>${rt(`st_${d.state}` as RfqTextKey)}</span>
        ${d.source_ticket ? html`<a class="chip info" href=${`#/tickets/${d.source_ticket.id}`} data-rfq-source>${tIcon('ticket')}${rt('sourceTicket', { number: d.source_ticket.number })}</a>` : nothing}
        <span class="grow"></span>
        ${d.can.see_amounts && quotes ? html`<a class="btn" href=${rfqHref({ id: d.id, view: 'compare' })} data-rfq-to-compare>${rIcon('columns')}${rt('compareN', { n: quotes })}</a>` : nothing}
        ${d.can.send ? html`<button type="button" class="btn primary" data-rfq-send @click=${() => { this.sendMode = this.meta?.vendor_page === false || !d.vendor_page ? 'manual' : 'auto'; this.open({ kind: 'send' }); }}>${tIcon('send')}${rt('sendTo', { n: d.vendors.filter((v) => v.state === 'draft').length })}</button>` : nothing}
        ${this.moreItems(d).length ? html`<button type="button" class="btn" data-rfq-more aria-haspopup="dialog" @click=${() => this.open({ kind: 'more' })}>${tIcon('dots')}${rt('more')}</button>` : nothing}
      </div>
    </header>`;
  }

  private moreItems(d: RfqDetail): { key: string; label: string; icon: TemplateResult; run: () => void; danger?: boolean }[] {
    const out: { key: string; label: string; icon: TemplateResult; run: () => void; danger?: boolean }[] = [];
    if (d.can.edit) out.push({ key: 'edit', label: rt('edit'), icon: tIcon('edit'), run: () => this.openEdit() });
    if (d.can.add_vendor) out.push({ key: 'add', label: rt('addVendors'), icon: tIcon('plus'), run: () => { this.picks = new Set(); void this.loadContacts(); this.open({ kind: 'add' }); } });
    if (d.can.close) out.push({ key: 'close', label: rt('closeRfq'), icon: tIcon('check'), run: () => this.open({ kind: 'close' }) });
    if (d.can.cancel) out.push({ key: 'cancel', label: rt('cancelRfq'), icon: rIcon('ban'), run: () => { this.notify = true; this.open({ kind: 'cancel' }); }, danger: true });
    if (d.can.delete) out.push({ key: 'delete', label: rt('deleteRfq'), icon: tIcon('trash'), run: () => this.open({ kind: 'delete' }), danger: true });
    return out;
  }

  private banners(d: RfqDetail): TemplateResult {
    const pending = d.awards.find((a) => a.state === 'pending_second');
    const done = d.awards.filter((a) => a.state === 'approved');
    return html`
      ${pending ? html`<div class="banner warn" role="status" data-rfq-pending-second>${tIcon('clock')}
        <div><b>${rt('pendingSecond')}</b><small>${rt('pendingSecondLong', { name: this.vendorName(pending.vendor_id), amount: this.money(pending.total_minor, pending.currency) })}</small></div>
        ${d.can.see_amounts && this.meta && this.mayDecide(d) ? html`<div class="rowacts">
          <button type="button" class="btn sm primary" data-rfq-second-confirm ?disabled=${this.busy} @click=${() => void this.confirmSecond(pending)}>${tIcon('check')}${rt('confirmSecond')}</button>
          <button type="button" class="btn sm" data-rfq-second-decline ?disabled=${this.busy} @click=${() => this.open({ kind: 'second-decline', a: pending })}>${rt('declineSecond')}</button></div>` : nothing}
      </div>` : nothing}
      ${done.map((a) => html`<div class="banner info" role="status" data-rfq-awarded=${a.vendor_id}>${tIcon('check')}
        <div><b>${rt('awardedTo', { name: this.vendorName(a.vendor_id) })}${a.total_minor !== null ? html` · <span class="num">${this.money(a.total_minor, a.currency)}</span>` : nothing}</b>
          <small>${rt('baseline')}</small></div>
        ${a.ticket ? html`<a class="btn sm" href=${`#/tickets/${a.ticket.id}`} data-rfq-order-ticket>${tIcon('ticket')}${rt('orderTicket', { number: a.ticket.number })}</a>` : nothing}
      </div>`)}
      ${d.state === 'cancelled' && d.cancel_reason ? html`<div class="banner bad" role="status">${rIcon('ban')}<div><b>${rt('st_cancelled')}</b><small>${bidi(d.cancel_reason)}</small></div></div>` : nothing}`;
  }

  /** Whether the viewer may decide (the comparison and the second approval): the server's award flag, or an open pending award (the
   * flag is off while one waits - the second approver still confirms it; a refusal names who may). */
  private mayDecide(d: RfqDetail): boolean {
    return d.can.award || (d.can.see_amounts && d.awards.some((a) => a.state === 'pending_second'));
  }

  private kpis(d: RfqDetail): TemplateResult {
    const k = d.kpis;
    const tile = (label: RfqTextKey, value: string | number, attr: string, warn = false) => html`<div class=${`kpi${warn ? ' warn' : ''}`} data-kpi=${attr}><small>${rt(label)}</small><b>${value}</b></div>`;
    return html`<div class="kpis" data-rfq-kpis>
      ${tile('kInvited', k.invited, 'invited')}${tile('kOpened', k.opened, 'opened')}${tile('kQuoted', k.quoted, 'quoted')}
      ${tile('kDeclined', k.declined, 'declined')}${tile('kNoReply', k.no_response, 'no_reply', k.no_response > 0 && d.state === 'due_passed')}
      ${d.can.see_amounts && k.lowest_total_minor !== null ? tile('kLowest', this.money(k.lowest_total_minor, k.currency), 'lowest') : nothing}
    </div>`;
  }

  private chan(v: RfqVendor): TemplateResult {
    const icon = v.channel === 'whatsapp' ? rIcon('chat') : v.channel === 'email' ? rIcon('mail') : tIcon('copy');
    return html`<span class="chan" title=${rt(`ch_${v.channel}` as RfqTextKey)}>${icon}<span class="vh">${rt(`ch_${v.channel}` as RfqTextKey)}</span></span>`;
  }

  /** TKRFQVP (contract 15.6): the per-vendor verification-code switch - managers, a server that takes vendor options, not awarded / removed. */
  private codeSwitchShown(v: RfqVendor): boolean {
    const d = this.d as RfqDetail;
    return !!this.meta?.vendor_options && d.can.edit && typeof v.require_code === 'boolean' && v.state !== 'awarded' && v.state !== 'removed';
  }

  private async setCode(v: RfqVendor, on: boolean): Promise<void> {
    const d = this.d as RfqDetail;
    if (this.codeBusy) return;
    this.codeBusy = v.id;
    try {
      this.d = await ticketsRfqApi().vendorOptions(d.id, v.id, { revision: d.revision, require_code: on });
      this.notice({ ok: rt(on ? 'codeSetOn' : 'codeSetOff') });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'vendor_code_locked') this.codeLocked = new Set(this.codeLocked).add(v.id);
      if (e instanceof ApiError && e.code === 'rfq_stale') void this.load();
      this.notice({ error: rfqError(e) });
    } finally {
      this.codeBusy = '';
    }
  }

  private codeSwitch(v: RfqVendor): TemplateResult {
    const on = !!v.require_code;
    const locked = on && this.codeLocked.has(v.id);
    const name = v.contact.company || v.contact.name;
    return html`<span class="codesw-wrap"><button type="button" class="rc codesw" aria-pressed=${String(on)} aria-label=${rt('codeToggle', { name })} data-rfq-code-toggle=${v.id}
        data-on=${String(on)} ?disabled=${this.codeBusy === v.id || locked} title=${locked ? rt('codeLocked') : ''} @click=${() => void this.setCode(v, !on)}>${tIcon('lock')}<span>${on ? rt('codeOn') : rt('codeOff')}</span></button>
      ${locked ? html`<small class="reason" data-rfq-code-locked>${rt('codeLocked')}</small>` : nothing}</span>`;
  }

  private vendorActions(v: RfqVendor): number {
    const d = this.d as RfqDetail;
    return [v.can.quote_on_behalf, v.can.decline_on_behalf, v.can.remove, v.can.message, v.quote?.state === 'submitted' && v.can.quote_on_behalf, v.link?.state === 'live' && d.can.edit].filter(Boolean).length;
  }

  private row(v: RfqVendor): TemplateResult {
    const d = this.d as RfqDetail;
    const name = v.contact.company || v.contact.name;
    const q = v.quote;
    return html`<tr data-rfq-vendor-row=${v.id} data-vstate=${v.state}>
      <td class="first"><span class="vname"><span class="av" aria-hidden="true">${initials(name)}</span><span><b>${bidi(name)}</b>${v.contact.company ? html`<small>${bidi(v.contact.name)}</small>` : nothing}</span></span></td>
      <td data-l=${rt('colChannel')}><span class="chancol">${this.chan(v)}${this.codeSwitchShown(v) ? this.codeSwitch(v) : nothing}</span></td>
      <td data-l=${rt('colState')}><span><span class=${`chip ${vendorStateTone(v.state)}`} data-vchip>${rt(`v_${v.state}` as RfqTextKey)}</span>
        ${v.decline_reason ? html`<span class="reason">${bidi(v.decline_reason)}</span>` : nothing}</span></td>
      <td data-l=${rt('colSent')} class="num">${dateTime(v.sent_at) || '—'}</td>
      <td data-l=${rt('colOpened')} class="num">${dateTime(v.first_opened_at) || '—'}</td>
      <td data-l=${rt('colQuote')} class="num" data-rfq-quote-cell>${q && q.total_minor !== undefined ? html`<b>${this.money(q.total_minor, q.currency)}</b> <span class="mut">${shortDate(q.created_at)}</span>`
        : q ? html`<span class="mut">${shortDate(q.created_at)}</span>` : '—'}</td>
      <td data-l=${rt('colActions')}><div class="rowacts">
        ${v.can.remind ? html`<button type="button" class="btn sm quiet" data-rfq-remind=${v.id} @click=${() => this.open({ kind: 'remind', ids: [v.id] })}>${rIcon('bell')}${rt('remind')}</button>` : nothing}
        ${q && d.can.see_amounts ? html`<a class="btn sm quiet" href=${rfqHref({ id: d.id, view: 'compare' })} data-rfq-row-compare>${rIcon('columns')}${rt('compare')}</a>` : nothing}
        ${this.vendorActions(v) ? html`<button type="button" class="ibtn" aria-label=${`${rt('more')}: ${name}`} aria-haspopup="dialog" data-rfq-vendor-more=${v.id} @click=${() => this.open({ kind: 'vendor', v })}>${tIcon('dots')}</button>` : nothing}
      </div></td>
    </tr>`;
  }

  private vendorsCard(d: RfqDetail): TemplateResult {
    const list = boardVendors(d.vendors);
    const rem = remindable(d.vendors);
    const quotes = liveQuotes(d);
    return html`<section class="rcard" aria-labelledby="h-vendors" data-rfq-vendors>
      <h2 id="h-vendors">${tIcon('users')}${rt('secVendors')}
        <div class="act">
          ${d.can.remind && rem.length > 1 ? html`<button type="button" class="btn sm quiet" data-rfq-remind-all @click=${() => this.open({ kind: 'remind', ids: rem.map((v) => v.id) })}>${rIcon('bell')}${rt('remindAll')}</button>` : nothing}
          ${quotes && d.can.see_amounts ? html`<a class="btn sm primary" href=${rfqHref({ id: d.id, view: 'compare' })} data-rfq-compare-n>${rIcon('columns')}${rt('compareN', { n: quotes })}</a>` : nothing}
        </div></h2>
      ${list.length ? html`<table class="rtbl">
        <thead><tr><th scope="col">${rt('colVendor')}</th><th scope="col">${rt('colChannel')}</th><th scope="col">${rt('colState')}</th><th scope="col">${rt('colSent')}</th>
          <th scope="col">${rt('colOpened')}</th><th scope="col">${rt('colQuote')}</th><th scope="col"><span class="vh">${rt('colActions')}</span></th></tr></thead>
        <tbody>${repeat(list, (v) => v.id, (v) => this.row(v))}</tbody></table>`
        : html`<div class="note" data-rfq-no-vendors>${rt('noVendorsYet')}</div>`}
      ${d.can.add_vendor ? html`<div><button type="button" class="btn sm quiet" data-rfq-add-vendors @click=${() => { this.picks = new Set(); void this.loadContacts(); this.open({ kind: 'add' }); }}>${tIcon('plus')}${rt('addVendors')}</button></div>` : nothing}
    </section>`;
  }

  private timeline(d: RfqDetail): TemplateResult {
    return html`<section class="rcard" aria-labelledby="h-tl" data-rfq-timeline>
      <h2 id="h-tl">${rIcon('history')}${rt('timeline')}</h2>
      <ol class="tl">${d.timeline.map((e) => {
        const l = eventLine(e, (id) => this.vendorName(id), (m, c) => this.money(m, c));
        return html`<li data-ev=${e.kind}><time datetime=${e.at}>${dateTime(e.at)}</time><span>${bidi(rt(l.key as RfqTextKey, l.vars))}</span></li>`;
      })}</ol>
    </section>`;
  }

  // ---------------------------------------------------------------- dialogs

  private dialog(): TemplateResult | typeof nothing {
    const g = this.dlg;
    const d = this.d;
    if (!g || !d) return nothing;
    const close = () => !this.busy && (this.dlg = null);
    const foot = (label: string, attr: string, run: () => void, disabled = false, danger = false) => html`
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${close}>${rt('cancel')}</button>
      <button slot="footer" type="button" class=${`btn ${danger ? 'danger' : 'primary'}`} data-dlg-ok=${attr} ?disabled=${this.busy || disabled} @click=${run}>${label}</button>`;
    const err = this.error ? html`<div class="err" role="alert" data-dlg-error>${this.error}</div>` : nothing;
    const dlg = (heading: string, attr: string, body: TemplateResult, footer: TemplateResult | typeof nothing, wide = false) => html`<sw-dialog open ?wide=${wide} ?locked=${this.busy}
      heading=${heading} data-rfq-dialog=${attr} @close=${close}><div class="stack">${body}${err}</div>${footer}</sw-dialog>`;
    const vname = (v: RfqVendor) => v.contact.company || v.contact.name;
    switch (g.kind) {
      case 'remind':
        return dlg(rt('remindTitle'), 'remind', html`<p class="note">${rt('remindBody', { n: g.ids.length })}</p>`, foot(rt('remind'), 'remind', () => void this.remind(g.ids)));
      case 'send': {
        const n = d.vendors.filter((v) => v.state === 'draft').length;
        const pageOff = !d.vendor_page || this.meta?.vendor_page === false;
        const first = d.vendors.find((v) => v.state === 'draft');
        const pv = invitePreview({ name: first?.contact.name || rt('previewName'), number: String(d.number), title: d.title, place: d.place.text ?? '', due: dateTime(d.due_at),
          window: windowText(d.work_from, d.work_to) || rt('previewFlexible'), link: rt('previewLink'), organization: '' }, ticketsLang());
        const opt = (m: 'auto' | 'manual', title: RfqTextKey, sub: RfqTextKey, disabled: boolean) => html`<label aria-disabled=${String(disabled)} data-rfq-send-mode=${m}>
          <input type="radio" name="bmode" .checked=${this.sendMode === m} ?disabled=${disabled || this.busy} @change=${() => (this.sendMode = m)} /><b>${rt(title)}</b><small>${disabled ? rt('sendPageOff') : rt(sub)}</small></label>`;
        return dlg(rt('sendTitle'), 'send', html`<p class="note">${rt('sendTo', { n })}</p>
          <div class="choice" role="radiogroup" aria-label=${rt('sendTitle')}>${opt('auto', 'sendAuto', 'sendAutoSub', pageOff)}${opt('manual', 'sendManual', 'sendManualSub', false)}</div>
          ${this.sendMode === 'auto' ? html`<pre class="pv" dir=${ticketsLang() === 'en' ? 'ltr' : 'rtl'} data-rfq-send-preview>${pv}</pre>` : nothing}`,
          foot(rt('sendNow'), 'send', () => void this.send(), pageOff && this.sendMode === 'auto'), true);
      }
      case 'more': {
        const items = this.moreItems(d);
        return dlg(rt('more'), 'more', html`<div class="menu" role="menu">${items.map((i) => html`<button type="button" role="menuitem" class=${`btn ${i.danger ? 'danger' : ''}`} data-more=${i.key}
          @click=${() => { this.dlg = null; i.run(); }}>${i.icon}${i.label}</button>`)}</div>`, nothing);
      }
      case 'vendor': {
        const v = g.v;
        const items: { key: string; label: string; icon: TemplateResult; next: Dlg; danger?: boolean }[] = [];
        if (v.can.message) items.push({ key: 'message', label: rt('writeVendor'), icon: rIcon('chat'), next: { kind: 'message', v } });
        if (v.can.quote_on_behalf) items.push({ key: 'quote', label: rt('onBehalf'), icon: rIcon('coin'), next: { kind: 'quote', v } });
        if (v.quote?.state === 'submitted' && v.can.quote_on_behalf) items.push({ key: 'withdraw', label: rt('withdraw'), icon: tIcon('x'), next: { kind: 'withdraw', v } });
        if (v.can.decline_on_behalf) items.push({ key: 'decline', label: rt('declineBehalf'), icon: rIcon('hand'), next: { kind: 'decline', v } });
        if (v.link?.state === 'live' && d.can.edit) items.push({ key: 'revoke', label: rt('revokeLink'), icon: tIcon('lock'), next: { kind: 'revoke', v }, danger: true });
        if (v.can.remove) items.push({ key: 'remove', label: rt('removeVendor'), icon: tIcon('trash'), next: { kind: 'remove', v }, danger: true });
        return dlg(vname(v), 'vendor', html`<div class="menu" role="menu">${items.map((i) => html`<button type="button" role="menuitem" class=${`btn ${i.danger ? 'danger' : ''}`} data-vmore=${i.key}
          @click=${() => this.open(i.next)}>${i.icon}${i.label}${i.key === 'message' && v.messages ? html`<small class="mut">(${v.messages})</small>` : nothing}</button>`)}</div>`, nothing);
      }
      case 'remove':
        return dlg(rt('removeVendor'), 'remove', html`<p>${rt('removeVendorQ', { name: vname(g.v) })}</p>`,
          foot(rt('removeVendor'), 'remove', () => void this.run(() => ticketsRfqApi().removeVendor(d.id, g.v.id, d.revision), rt('saved')), false, true));
      case 'revoke':
        return dlg(rt('revokeLink'), 'revoke', html`<p>${rt('revokeLinkQ', { name: vname(g.v) })}</p>`,
          foot(rt('revokeLink'), 'revoke', () => void this.run(() => ticketsRfqApi().revokeLink(d.id, g.v.id), rt('saved')), false, true));
      case 'withdraw':
        return dlg(rt('withdraw'), 'withdraw', html`<p>${rt('withdrawQ', { name: vname(g.v) })}</p>`,
          foot(rt('withdraw'), 'withdraw', () => void this.run(() => ticketsRfqApi().withdrawQuote(d.id, g.v.id, g.v.quote?.id ?? '', g.v.quote?.revision ?? 1), rt('saved')), false, true));
      case 'decline':
        return dlg(rt('declineBehalfTitle', { name: vname(g.v) }), 'decline', html`<label class="fld">${rt('declineReason')}<input class="inp" maxlength="200" data-dlg-reason .value=${this.reason}
          @input=${(e: Event) => (this.reason = (e.target as HTMLInputElement).value)} /></label>`,
          foot(rt('confirm'), 'decline', () => void this.run(() => ticketsRfqApi().declineOnBehalf(d.id, g.v.id, this.reason.trim() || undefined), rt('saved'))));
      case 'quote':
        return html`<tickets-rfq-quote-dialog open .rfq=${d} .vendor=${g.v} .currencies=${this.meta?.currencies?.length ? this.meta.currencies : ['ILS']}
          @close=${() => (this.dlg = null)} @saved=${(e: CustomEvent<RfqDetail>) => { this.d = e.detail; this.dlg = null; this.notice({ ok: rt('qSaved') }); }}></tickets-rfq-quote-dialog>`;
      case 'message':
        return html`<tickets-rfq-message-dialog open .rfq=${d} .vendor=${g.v} @close=${() => (this.dlg = null)}
          @saved=${(e: CustomEvent<{ notified: boolean }>) => { this.dlg = null; this.notice({ ok: e.detail.notified ? rt('writeDoneNotified') : rt('writeDone') }); void this.load(); }}></tickets-rfq-message-dialog>`;
      case 'add': {
        const have = new Set(d.vendors.filter((v) => v.state !== 'removed').map((v) => v.contact.id));
        const list = (this.contacts ?? []).filter((c) => invitable(c, d.department.id) && !have.has(c.id));
        return dlg(rt('addVendorsTitle'), 'add', html`<p class="note">${rt('addVendorsNote')}</p>
          ${this.contacts === null ? html`<span class="skl" style="block-size:52px"></span>` : list.length ? html`<div class="vlist" role="group" aria-label=${rt('secVendors')}>
            ${list.map((c) => html`<label class=${`vrow${this.picks.has(c.id) ? ' on' : ''}`} style="grid-template-columns:auto auto minmax(0,1fr)" data-add-pick=${c.id}>
              <input type="checkbox" .checked=${this.picks.has(c.id)} @change=${(e: Event) => { const n = new Set(this.picks); if ((e.target as HTMLInputElement).checked) n.add(c.id); else n.delete(c.id); this.picks = n; }} />
              <span class="av" aria-hidden="true">${initials(c.vendor_name ?? c.company ?? c.display_name)}</span>
              <span class="vname"><span><b>${bidi(c.vendor_name || c.company || c.display_name)}</b><small>${bidi(c.display_name)}</small></span></span></label>`)}
          </div>` : html`<div class="note">${rt('vendorsNone')} · <a href="#/tickets/handlers?seg=vendors">${rt('vendorsToDirectory')}</a></div>`}`,
          foot(rt('save'), 'add', () => void this.addVendors(), !this.picks.size), true);
      }
      case 'edit': {
        const e = this.edit;
        const draft = d.state === 'draft';
        const set = (patch: Partial<typeof e>) => (this.edit = { ...e, ...patch });
        return dlg(rt('editTitle'), 'edit', html`${draft ? html`
            <label class="fld">${rt('fTitle')}<input class="inp" maxlength="120" .value=${e.title} data-edit-title @input=${(x: Event) => set({ title: (x.target as HTMLInputElement).value })} /></label>
            <label class="fld">${rt('fDescription')}<textarea class="inp" style="min-block-size:88px;padding-block:10px" maxlength="4000" .value=${e.description} @input=${(x: Event) => set({ description: (x.target as HTMLTextAreaElement).value })}></textarea></label>
            <label class="fld">${rt('fPlace')}<input class="inp" maxlength="200" .value=${e.place} @input=${(x: Event) => set({ place: (x.target as HTMLInputElement).value })} /></label>
            <div class="kinds" role="group" aria-label=${rt('fKinds')}>${(['labor', 'parts', 'travel', 'other'] as LineKind[]).map((k) => html`<button type="button" class="rc" aria-pressed=${String(e.kinds.includes(k) || k === 'labor')}
              ?disabled=${k === 'labor'} @click=${() => set({ kinds: toggleKind(e.kinds, k) })}>${ct(`k_${k}` as CostTextKey)}</button>`)}</div>` : html`<p class="note">${rt('editLocked')}</p>`}
          <div class="frm">
            <label class="fld">${rt('fDue')}<input class="inp" type="date" data-edit-due .value=${e.dueDate} @change=${(x: Event) => set({ dueDate: (x.target as HTMLInputElement).value })} /></label>
            <label class="fld">${rt('fDueTime')}<input class="inp" type="time" .value=${e.dueTime} @change=${(x: Event) => set({ dueTime: (x.target as HTMLInputElement).value })} /></label>
            <label class="fld">${rt('fWindowFrom')}<input class="inp" type="date" .value=${e.from} @change=${(x: Event) => set({ from: (x.target as HTMLInputElement).value })} /></label>
            <label class="fld">${rt('fWindowTo')}<input class="inp" type="date" .value=${e.to} min=${e.from || ''} @change=${(x: Event) => set({ to: (x.target as HTMLInputElement).value })} /></label>
          </div>`, foot(rt('save'), 'edit', () => void this.saveEdit(), draft && !e.title.trim()), true);
      }
      case 'close':
        return dlg(rt('closeRfq'), 'close', html`<p>${rt('closeQ')}</p>`, foot(rt('closeRfq'), 'close', () => void this.run(() => ticketsRfqApi().close(d.id, d.revision), rt('closed'))));
      case 'cancel': {
        const quoted = d.vendors.some((v) => v.quote && v.quote.state === 'submitted');
        return dlg(rt('cancelQ'), 'cancel', html`<label class="fld">${rt('cancelReason')}<input class="inp" maxlength="500" data-dlg-reason .value=${this.reason}
            @input=${(e: Event) => (this.reason = (e.target as HTMLInputElement).value)} /></label>
          ${quoted ? html`<label class="chk"><input type="checkbox" data-cancel-notify .checked=${this.notify} @change=${(e: Event) => (this.notify = (e.target as HTMLInputElement).checked)} />${rt('cancelNotify')}</label>` : nothing}`,
          foot(rt('cancelRfq'), 'cancel', () => void this.run(() => ticketsRfqApi().cancel(d.id, d.revision, this.reason.trim() || undefined, quoted && this.notify), rt('cancelled')), false, true));
      }
      case 'delete':
        return dlg(rt('deleteRfq'), 'delete', html`<p>${rt('deleteQ')}</p>`, foot(rt('deleteRfq'), 'delete', () => void this.del(), false, true));
      case 'second-decline':
        return dlg(rt('declineSecondTitle'), 'second-decline', html`<label class="fld">${rt('declineSecondReason')}<input class="inp" maxlength="500" required data-dlg-reason .value=${this.reason}
          @input=${(e: Event) => (this.reason = (e.target as HTMLInputElement).value)} /></label>`,
          foot(rt('declineSecond'), 'second-decline', () => void this.run(() => ticketsRfqApi().declineAward(d.id, g.a.id, g.a.revision, this.reason.trim()), rt('secondDeclined')), !this.reason.trim(), true));
      default:
        return nothing;
    }
  }

  render() {
    if (this.phase === 'loading') return html`<div class="page" data-rfq-board data-phase="loading" aria-busy="true"><span class="skl" style="block-size:64px"></span><div class="kpis">${[1, 2, 3, 4].map(() => html`<span class="skl" style="block-size:76px"></span>`)}</div><span class="skl" style="block-size:280px"></span></div>`;
    if (this.phase === 'missing') return html`<div class="page" data-rfq-board data-phase="missing"><div class="statebox glass" role="status"><span class="ring">${tIcon('search')}</span><b>${rt('emptyFiltered')}</b><a class="btn sm" href=${rfqHref({})}>${rt('back')}</a></div></div>`;
    if (this.phase === 'error' || !this.d) {
      return html`<div class="page" data-rfq-board data-phase="error"><div class="statebox glass" role="status"><span class="ring">${tIcon('warning')}</span><b>${rt('loadFailed')}</b>
        <span class="vh">${this.failed}</span><button type="button" class="btn sm" @click=${() => { this.phase = 'loading'; void this.load(); }}>${tIcon('refresh')}${rt('retry')}</button></div></div>`;
    }
    const d = this.d;
    return html`<div class="page" data-rfq-board data-phase="ready" data-rfq-id=${d.id}>
      ${this.header(d)}
      ${this.banners(d)}
      ${d.awards.some((a) => a.state === 'approved') ? html`<tickets-rfq-order .rfq=${d} @changed=${(e: CustomEvent<RfqDetail>) => (this.d = e.detail)}></tickets-rfq-order>` : nothing}
      ${this.kpis(d)}
      <div class="grid2">${this.vendorsCard(d)}${this.timeline(d)}</div>
    </div>${this.dialog()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-rfq-board': TicketsRfqBoard;
  }
}
