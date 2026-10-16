import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-drawer';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { ticketsS4Api, type Contact } from '../api/tickets-s4';
import type { LineKind } from '../api/tickets-costs';
import { ticketsRfqApi, type RfqChannel, type RfqDetail, type RfqFile, type RfqMeta } from '../api/tickets-rfq';
import { rememberDemoContact } from '../api/tickets-rfq-mock';
import { tIcon } from './icons';
import { rIcon } from './rfq-icons';
import { ct, type CostTextKey } from './cost-text';
import { rt, type RfqTextKey } from './rfq-text';
import { rfqStyles } from './rfq-styles';
import {
  DESCRIPTION_MAX, PLACE_MAX, TITLE_MAX, clientRequestId, dateTime, dayToIso, defaultDue, draftProblems, initials, invitable, invitePreview, localToIso,
  normalizeKinds, plannedChannel, refusalKey, toggleKind, windowText, type DraftField, type RfqDraft,
} from './rfq-model';
import { ticketsLang } from './text';

const CHANNELS: readonly RfqChannel[] = ['whatsapp', 'email', 'manual'];
const ERR: Record<DraftField, RfqTextKey> = { title: 'err_title', description: 'err_description', department: 'err_department', due: 'err_due', window: 'err_window', vendors: 'err_vendors', place: 'err_place' };

/** The server's refusal in the screen's words (a known code), else the server's own message. */
export function rfqError(e: unknown): string {
  const key = e instanceof ApiError ? refusalKey(e.code) : null;
  return key ? rt(key as RfqTextKey) : describeError(e);
}

/**
 * TKRFQ2 `<tickets-rfq-new .open .meta .sourceTicket>`: the new request for quotation as a side sheet (the new-request sheet's frame,
 * mock-up v5 "בקשת הצעת מחיר חדשה"): title, description, department, place, attachments (C2 gap: shown only when the server takes
 * files), the quote deadline, the wanted work window, the allowed line kinds (labour always), the invited vendors from the directory
 * (vendors and persons who may quote: never an employee or an account holder) with their channel and code, and the preview of the
 * outgoing invitation. NOTHING is sent from the sheet: "שמירת טיוטה" creates a draft; "המשך לשליחה" opens the confirmation (the
 * external-assign preview / confirm pattern) where the person chooses the channel mode and confirms. Events: `rfq-saved {id, sent}`,
 * `close`.
 */
@customElement('tickets-rfq-new')
export class TicketsRfqNew extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) meta: RfqMeta | null = null;
  @property({ attribute: false }) sourceTicket = '';
  @state() private d: RfqDraft = this.blank();
  @state() private contacts: Contact[] | null = null;
  @state() private query = '';
  @state() private files: RfqFile[] = [];
  @state() private attempt: '' | 'draft' | 'send' = '';
  @state() private confirm = false;
  @state() private mode: 'auto' | 'manual' = 'auto';
  @state() private busy = false;
  @state() private error = '';
  @state() private previewOpen = true;
  private created: RfqDetail | null = null;
  private crid = clientRequestId();

  static styles = [bubbleChrome, ...automationsStyles, rfqStyles, css`
    :host {
      display: contents;
    }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('open') && this.open) this.reset();
    if (changed.has('meta') && this.meta && !this.d.department_id) this.d = { ...this.d, department_id: this.firstDept() };
  }

  private firstDept(): string {
    return this.meta?.departments.find((x) => x.can_create)?.id ?? '';
  }

  private blank(): RfqDraft {
    const due = defaultDue(new Date(), this.meta?.settings.default_due_days ?? 3);
    return { department_id: '', title: '', description: '', place_text: '', due_date: due.date, due_time: due.time, work_from: '', work_to: '', kinds: ['labor', 'parts'],
      vendors: [], source_ticket_id: '' };
  }

  private reset(): void {
    this.d = { ...this.blank(), department_id: this.firstDept(), source_ticket_id: this.sourceTicket };
    this.query = '';
    this.files = [];
    this.attempt = '';
    this.confirm = false;
    this.mode = this.meta?.vendor_page === false ? 'manual' : 'auto';
    this.error = '';
    this.created = null;
    this.crid = clientRequestId();
    void this.loadContacts();
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

  private set<K extends keyof RfqDraft>(k: K, v: RfqDraft[K]): void {
    this.d = { ...this.d, [k]: v };
  }

  private close(): void {
    if (this.busy) return;
    this.dispatchEvent(new CustomEvent('close'));
  }

  // ---------------------------------------------------------------- vendors

  private eligible(): Contact[] {
    return (this.contacts ?? []).filter((c) => invitable(c, this.d.department_id));
  }

  private chosen(id: string) {
    return this.d.vendors.find((v) => v.contact_id === id);
  }

  private toggleVendor(c: Contact, on: boolean): void {
    if (on && !this.chosen(c.id)) {
      rememberDemoContact(c.id, c.display_name, c.vendor_name ?? c.company); // the demo store's names (a server reads its directory)
      this.set('vendors', [...this.d.vendors, { contact_id: c.id, channel: plannedChannel(c), require_code: c.require_code }]);
    } else if (!on) this.set('vendors', this.d.vendors.filter((v) => v.contact_id !== c.id));
  }

  private setVendorOpt(id: string, patch: Partial<{ channel: RfqChannel; require_code: boolean }>): void {
    this.set('vendors', this.d.vendors.map((v) => (v.contact_id === id ? { ...v, ...patch } : v)));
  }

  private channelOk(c: Contact, ch: RfqChannel): boolean {
    return ch === 'manual' || (ch === 'whatsapp' ? c.has_phone : !!c.email);
  }

  private vendorRow(c: Contact): TemplateResult {
    const v = this.chosen(c.id);
    const name = c.display_name;
    const company = c.vendor_name ?? c.company;
    const options = !!this.meta?.vendor_options;
    const ch = v?.channel ?? plannedChannel(c);
    const code = v?.require_code ?? c.require_code;
    return html`<div class=${`vrow${v ? ' on' : ''}`} data-rfq-vendor=${c.id}>
      <input type="checkbox" id=${`rv-${c.id}`} .checked=${!!v} ?disabled=${this.busy} aria-describedby=${`rvs-${c.id}`}
        @change=${(e: Event) => this.toggleVendor(c, (e.target as HTMLInputElement).checked)} />
      <span class="av" aria-hidden="true">${initials(company || name)}</span>
      <label for=${`rv-${c.id}`} class="vname"><span><b>${bidi(company || name)}</b><small id=${`rvs-${c.id}`}>${bidi([company ? name : '', c.phone ?? c.email ?? ''].filter(Boolean).join(' · '))}</small></span></label>
      <div class="opts">
        ${v && options ? html`<span class="seg sm" role="radiogroup" aria-label=${rt('chTitle')} data-rfq-channel=${c.id}>
            ${CHANNELS.map((x) => html`<button type="button" role="radio" aria-checked=${String(ch === x)} ?disabled=${!this.channelOk(c, x) || this.busy} data-ch=${x}
              @click=${() => this.setVendorOpt(c.id, { channel: x })}>${this.chIcon(x)}<span class="vh">${rt(`ch_${x}`)}</span></button>`)}
          </span>
          <label class="chk" data-rfq-code=${c.id}><input type="checkbox" .checked=${code} ?disabled=${c.require_code || this.busy}
            @change=${(e: Event) => this.setVendorOpt(c.id, { require_code: (e.target as HTMLInputElement).checked })} />${rt('codeOn')}</label>`
        : html`<span class="chan" data-rfq-channel-ro=${ch}>${this.chIcon(ch)}${rt(`ch_${ch}`)}</span>${code ? html`<span class="chip" data-rfq-code-ro>${tIcon('lock')}${rt('codeOn')}</span>` : nothing}`}
      </div>
    </div>`;
  }

  chIcon(ch: RfqChannel): TemplateResult {
    return ch === 'whatsapp' ? rIcon('chat') : ch === 'email' ? rIcon('mail') : tIcon('copy');
  }

  // ---------------------------------------------------------------- files (C2 gap: only when the server takes them)

  private async addFiles(list: FileList | null): Promise<void> {
    const up = ticketsRfqApi().uploadFile;
    if (!list?.length || !up) return;
    this.busy = true;
    try {
      for (const f of Array.from(list).slice(0, 10)) this.files = [...this.files, await up.call(ticketsRfqApi(), f)];
    } catch (e) {
      this.error = rfqError(e);
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- submit

  private problems(forSend: boolean) {
    return draftProblems(this.d, new Date(), forSend);
  }

  private body() {
    const d = this.d;
    return {
      department_id: d.department_id, title: d.title.trim(), description: d.description.trim() || undefined, place_text: d.place_text.trim() || undefined,
      source_ticket_id: d.source_ticket_id || undefined, due_at: localToIso(d.due_date, d.due_time || '12:00'), work_from: dayToIso(d.work_from) || undefined,
      work_to: dayToIso(d.work_to) || undefined, allowed_line_kinds: normalizeKinds(d.kinds), vendors: d.vendors.map((v) => ({ ...v })), client_request_id: this.crid,
      file_ids: this.files.map((f) => f.id),
    };
  }

  private async ensureCreated(): Promise<RfqDetail> {
    if (this.created) return this.created;
    this.created = await ticketsRfqApi().create(this.body());
    return this.created;
  }

  private async saveDraft(): Promise<void> {
    this.attempt = 'draft';
    if (Object.keys(this.problems(false)).length) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await this.ensureCreated();
      this.dispatchEvent(new CustomEvent('rfq-saved', { detail: { id: r.id, sent: false } }));
    } catch (e) {
      this.error = rfqError(e);
    } finally {
      this.busy = false;
    }
  }

  private toSend(): void {
    this.attempt = 'send';
    if (Object.keys(this.problems(true)).length) return;
    this.error = '';
    this.confirm = true;
  }

  private async send(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      const r = await this.ensureCreated();
      await ticketsRfqApi().send(r.id, r.revision, this.mode, clientRequestId());
      this.confirm = false;
      this.dispatchEvent(new CustomEvent('rfq-saved', { detail: { id: r.id, sent: true, manual: this.mode === 'manual' } }));
    } catch (e) {
      this.error = rfqError(e);
      if (this.created) this.created = await ticketsRfqApi().get(this.created.id).catch(() => this.created);
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- render

  private preview(): string {
    const v = this.d.vendors[0];
    const c = v ? this.contacts?.find((x) => x.id === v.contact_id) : undefined;
    const lang = ticketsLang();
    return invitePreview({
      name: c?.display_name ?? rt('previewName'), number: rt('previewNumber'), title: this.d.title.trim() || rt('fTitle'), place: this.d.place_text.trim(),
      due: dateTime(localToIso(this.d.due_date, this.d.due_time || '12:00')), window: windowText(dayToIso(this.d.work_from), dayToIso(this.d.work_to)) || rt('previewFlexible'),
      link: rt('previewLink'), organization: '',
    }, lang);
  }

  private err(f: DraftField, p: Partial<Record<DraftField, true>>): TemplateResult | typeof nothing {
    return this.attempt && p[f] ? html`<span class="err" id=${`e-${f}`} role="alert" data-rfq-err=${f}>${rt(ERR[f])}</span>` : nothing;
  }

  private inv(f: DraftField, p: Partial<Record<DraftField, true>>): string {
    return this.attempt && p[f] ? 'true' : 'false';
  }

  private form(): TemplateResult {
    const d = this.d;
    const p = this.problems(this.attempt === 'send');
    const depts = (this.meta?.departments ?? []).filter((x) => x.can_create);
    const kinds = (this.meta?.line_kinds ?? ['labor', 'parts', 'travel', 'other']) as LineKind[];
    const q = this.query.trim().toLowerCase();
    const list = this.eligible().filter((c) => !q || `${c.display_name} ${c.company} ${c.vendor_name ?? ''}`.toLowerCase().includes(q));
    const chosenFirst = [...list].sort((a, b) => Number(!!this.chosen(b.id)) - Number(!!this.chosen(a.id)));
    return html`<div class="form" data-rfq-new-form>
      ${d.source_ticket_id ? html`<a class="chip info" href=${`#/tickets/${d.source_ticket_id}`} data-rfq-from>${tIcon('ticket')}${rt('fromTicket')}</a>` : nothing}
      <section aria-labelledby="h-req">
        <h3 id="h-req">${tIcon('edit')}${rt('secRequest')}</h3>
        <div class="frm">
          <label class="fld wide">${rt('fTitle')}<input class="inp" data-rfq-title maxlength=${TITLE_MAX} required .value=${d.title} aria-invalid=${this.inv('title', p)}
            aria-describedby="e-title" @input=${(e: Event) => this.set('title', (e.target as HTMLInputElement).value)} />${this.err('title', p)}</label>
          <label class="fld wide">${rt('fDescription')}<textarea class="inp" data-rfq-description maxlength=${DESCRIPTION_MAX} .value=${d.description}
            @input=${(e: Event) => this.set('description', (e.target as HTMLTextAreaElement).value)}></textarea>${this.err('description', p)}</label>
          <label class="fld">${rt('fDepartment')}<select class="inp" data-rfq-department aria-invalid=${this.inv('department', p)} @change=${(e: Event) => this.set('department_id', (e.target as HTMLSelectElement).value)}>
            ${depts.map((x) => html`<option value=${x.id} ?selected=${x.id === d.department_id}>${bidi(x.name)}</option>`)}
          </select>${this.err('department', p)}</label>
          <label class="fld">${rt('fPlace')}<input class="inp" data-rfq-place maxlength=${PLACE_MAX} .value=${d.place_text} @input=${(e: Event) => this.set('place_text', (e.target as HTMLInputElement).value)} />${this.err('place', p)}</label>
          <fieldset class="fld" style="border:0;padding:0;margin:0"><legend>${rt('fDue')}</legend>
            <div class="dates">
              <label><span class="vh">${rt('fDueDate')}</span><input class="inp" type="date" data-rfq-due-date .value=${d.due_date} aria-invalid=${this.inv('due', p)} aria-describedby="e-due"
                @change=${(e: Event) => this.set('due_date', (e.target as HTMLInputElement).value)} /></label>
              <label><span class="vh">${rt('fDueTime')}</span><input class="inp" type="time" data-rfq-due-time .value=${d.due_time} @change=${(e: Event) => this.set('due_time', (e.target as HTMLInputElement).value)} /></label>
            </div>${this.err('due', p)}</fieldset>
          <fieldset class="fld" style="border:0;padding:0;margin:0"><legend>${rt('fWindow')}</legend>
            <div class="dates">
              <label><span class="vh">${rt('fWindowFrom')}</span><input class="inp" type="date" data-rfq-work-from .value=${d.work_from} @change=${(e: Event) => this.set('work_from', (e.target as HTMLInputElement).value)} /></label>
              <label><span class="vh">${rt('fWindowTo')}</span><input class="inp" type="date" data-rfq-work-to .value=${d.work_to} min=${d.work_from || ''} aria-invalid=${this.inv('window', p)}
                @change=${(e: Event) => this.set('work_to', (e.target as HTMLInputElement).value)} /></label>
            </div>${this.err('window', p)}</fieldset>
          <div class="fld wide"><span id="kinds-l">${rt('fKinds')} <span class="mut">(${rt('fKindsSub')})</span></span>
            <div class="kinds" role="group" aria-labelledby="kinds-l" data-rfq-kinds>
              ${kinds.map((k) => html`<button type="button" class="rc" aria-pressed=${String(d.kinds.includes(k) || k === 'labor')} ?disabled=${k === 'labor' || this.busy} data-kind=${k}
                @click=${() => this.set('kinds', toggleKind(d.kinds, k))}>${tIcon(d.kinds.includes(k) || k === 'labor' ? 'check' : 'plus')}${ct(`k_${k}` as CostTextKey)}</button>`)}
            </div></div>
          ${this.meta?.attachments ? html`<div class="fld wide"><span>${rt('fFiles')}</span><div class="files" data-rfq-files>
            ${this.files.map((f) => html`<span class="file">${f.kind === 'pdf' ? rIcon('file') : tIcon('image')}${bidi(f.name)}
              <button type="button" class="ibtn" aria-label=${`${rt('cancel')} ${f.name}`} @click=${() => (this.files = this.files.filter((x) => x.id !== f.id))}>${tIcon('x')}</button></span>`)}
            <label class="btn sm quiet">${tIcon('plus')}${rt('fAttach')}<input class="vh" type="file" multiple accept="image/*,application/pdf" data-rfq-file-input
              @change=${(e: Event) => void this.addFiles((e.target as HTMLInputElement).files)} /></label>
          </div></div>` : nothing}
        </div>
      </section>
      <section aria-labelledby="h-vendors">
        <h3 id="h-vendors">${tIcon('users')}${rt('secVendors')}<span class="mut" data-rfq-chosen>${rt('vendorsChosen', { n: d.vendors.length })}</span></h3>
        <label class="fld"><span class="vh">${rt('vendorsSearch')}</span><input class="inp" type="search" data-rfq-vendor-search maxlength="60" placeholder=${rt('vendorsSearch')}
          .value=${this.query} @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} /></label>
        ${this.contacts === null ? html`<span class="skl" style="block-size:52px" aria-label=${rt('vendorsLoading')}></span>`
          : chosenFirst.length ? html`<div class="vlist" role="group" aria-label=${rt('secVendors')}>${repeat(chosenFirst, (c) => c.id, (c) => this.vendorRow(c))}</div>`
          : html`<div class="note" data-rfq-vendors-none>${rt('vendorsNone')} · <a href="#/tickets/handlers?seg=vendors">${rt('vendorsToDirectory')}</a></div>`}
        ${this.err('vendors', p)}
        <div class="note">${this.meta?.vendor_options ? rt('vendorsHint') : html`${rt('vendorFromDirectory')} · ${rt('vendorsHint')}`}</div>
      </section>
      <section aria-labelledby="h-preview">
        <h3 id="h-preview">${tIcon('eye')}${rt('secPreview')}
          <button type="button" class="btn sm quiet" style="margin-inline-start:auto" aria-expanded=${String(this.previewOpen)} data-rfq-preview-toggle
            @click=${() => (this.previewOpen = !this.previewOpen)}>${this.previewOpen ? rt('previewHide') : rt('previewShow')}</button></h3>
        ${this.previewOpen ? html`<pre class="pv" dir=${ticketsLang() === 'en' ? 'ltr' : 'rtl'} data-rfq-preview>${this.preview()}</pre>` : nothing}
        <div class="note">${rt('previewNote')}</div>
      </section>
      ${this.error && !this.confirm ? html`<div class="err" role="alert" data-rfq-new-error>${this.error}</div>` : nothing}
    </div>`;
  }

  private footer(): TemplateResult {
    return html`<div slot="footer" class="sheetfoot">
      <button type="button" class="btn primary" data-rfq-to-send ?disabled=${this.busy} @click=${() => this.toSend()}>${tIcon('send')}${rt('toSend')}</button>
      <button type="button" class="btn quiet" data-rfq-save-draft ?disabled=${this.busy} @click=${() => void this.saveDraft()}>${tIcon('note')}${rt('saveDraft')}</button>
      <button type="button" class="btn quiet" data-rfq-new-cancel ?disabled=${this.busy} @click=${() => this.close()}>${rt('cancel')}</button>
    </div>`;
  }

  private confirmDialog(): TemplateResult {
    const pageOff = this.meta?.vendor_page === false;
    const n = this.d.vendors.length;
    const opt = (m: 'auto' | 'manual', title: RfqTextKey, sub: RfqTextKey, disabled: boolean) => html`<label aria-disabled=${String(disabled)} data-rfq-send-mode=${m}>
      <input type="radio" name="rfqmode" .checked=${this.mode === m} ?disabled=${disabled || this.busy} @change=${() => (this.mode = m)} />
      <b>${rt(title)}</b><small>${disabled ? rt('sendPageOff') : rt(sub)}</small></label>`;
    return html`<sw-dialog ?open=${this.confirm} ?locked=${this.busy} wide heading=${rt('sendTitle')} subheading=${rt('sendTo', { n })} data-rfq-send-dialog @close=${() => (this.confirm = false)}>
      <div class="stack">
        <div class="choice" role="radiogroup" aria-label=${rt('sendTitle')}>
          ${opt('auto', 'sendAuto', 'sendAutoSub', pageOff)}
          ${opt('manual', 'sendManual', 'sendManualSub', false)}
        </div>
        ${this.mode === 'auto' ? html`<pre class="pv" dir=${ticketsLang() === 'en' ? 'ltr' : 'rtl'} data-rfq-send-preview>${this.preview()}</pre>` : nothing}
        ${this.error ? html`<div class="err" role="alert" data-rfq-send-error>${this.error}</div>` : nothing}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${() => (this.confirm = false)}>${rt('back')}</button>
      <button slot="footer" type="button" class="btn primary" data-rfq-send-confirm ?disabled=${this.busy || (pageOff && this.mode === 'auto')} @click=${() => void this.send()}>${rIcon('bell')}${rt('sendNow')}</button>
    </sw-dialog>`;
  }

  render() {
    return html`<sw-drawer modal .open=${this.open} heading=${rt('newTitle')} subheading=${rt('newSub')} data-rfq-new @close=${() => this.close()}>
      ${this.open ? this.form() : nothing}${this.open ? this.footer() : nothing}
      ${this.open ? this.confirmDialog() : nothing}
    </sw-drawer>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-rfq-new': TicketsRfqNew;
  }
}
