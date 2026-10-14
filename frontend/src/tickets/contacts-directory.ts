import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-card';
import '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-state-panel';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { ticketsApi } from '../api/tickets';
import { CONTACT_CHANNELS, CONTACT_LANGS, ticketsS4Api, type Contact, type ContactBody, type ContactChannel, type ContactKind, type ContactLang } from '../api/tickets-s4';
import { canAnywhere, isApi } from '../api/session';
import { CURRENCIES, type CostMode } from '../api/tickets-costs';
import { ticketSettingsCss } from './settings-styles';
import { ct } from './cost-text';
import { decimalToMinor, minorToInput } from './cost-model';
import { tt, type TicketTextKey } from './text';

/** The languages by their own names (the page and the messages of a contact speak it). */
const LANG_NAMES: Record<ContactLang, string> = { he: 'עברית', en: 'English', ar: 'العربية', ru: 'Русский' };
type KindFilter = 'all' | ContactKind;
interface Draft {
  kind: ContactKind; display_name: string; company: string; vendor_id: string; phone: string; email: string; preferred_channel: ContactChannel;
  require_code: boolean; share_history: 'default' | 'on' | 'off'; lang: ContactLang; notes: string; active: boolean; departments: string[];
  cost_claim: CostMode | ''; vat_exempt: boolean; vat_default: 'included' | 'excluded'; labor_rate: string; rate_currency: string;
}

function draftOf(c: Contact | null, kind: ContactKind = 'person'): Draft {
  return {
    kind: c?.kind ?? kind, display_name: c?.display_name ?? '', company: c?.company ?? '', vendor_id: c?.vendor_id ?? '',
    phone: c?.phone_full ? c.phone ?? '' : '', email: c?.phone_full ? c.email ?? '' : '', preferred_channel: c?.preferred_channel ?? 'whatsapp',
    require_code: c?.require_code ?? false, share_history: c?.share_history === null || c?.share_history === undefined ? 'default' : c.share_history ? 'on' : 'off',
    lang: c?.lang ?? 'he', notes: c?.notes ?? '', active: c?.active ?? true, departments: [...(c?.departments ?? [])],
    cost_claim: c?.cost_claim ?? '', vat_exempt: c?.vat_exempt ?? false, vat_default: c?.vat_default ?? 'excluded',
    labor_rate: minorToInput(c?.labor_rate_minor), rate_currency: c?.rate_currency ?? 'ILS',
  };
}

/**
 * CR-038 slice 4: Settings › the module › "ספקים ואנשי קשר" - the directory of people who are not users (spec 7.2 / 8 / 15.2). A list
 * at the start (search, the kind filter), the chosen row's card beside it (stacked on a narrow screen, like the departments tab).
 * Editing, erasing and exporting need `tickets.configure` (the server's `can_edit`); a department manager reads the rows allowed in
 * the departments they manage, with the full phone only when they may send outside (the server masks it otherwise - `phone_full`).
 * A phone or e-mail change revokes the contact's live links (the server says how many). Events: `notice` {ok | error}.
 * Owner request 2026-10-14: the directory moved out of Settings into the area's "מטפלים וספקים" page, one segment per kind - `kind`
 * locks the list and the new row to one kind (employee / vendor / person); an employee without an account keeps only the fields that
 * matter for him (name, phone, e-mail, channel, language, departments, notes).
 */
@customElement('tickets-contacts')
export class TicketsContacts extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  /** one kind only (the handlers page's segments); '' = every kind with the kind filter (the old settings tab) */
  @property() kind: ContactKind | '' = '';
  @state() private rows: Contact[] | null = null;
  /** the vendors a person may work for, when the list itself is locked to persons */
  @state() private vendorRows: Contact[] = [];
  @state() private canEdit = false;
  @state() private query = '';
  @state() private filter: KindFilter = 'all';
  @state() private selected = '';
  @state() private creating = false;
  @state() private draft: Draft | null = null;
  @state() private departments: { id: string; name: string }[] = [];
  @state() private busy = false;
  @state() private erasing = false;
  @state() private eraseHistory = false;
  @state() private problem = '';
  @state() private liveLinks = 0;
  @state() private denied = false;
  private searchTimer = 0;
  private loadedKind: ContactKind | '' = '';

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .tools .in[type='search'] {
      flex: 1 1 160px;
    }
    .ditem .kind {
      flex: none;
    }
    .form {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
      inline-size: 100%;
    }
    .form .wide {
      grid-column: 1 / -1;
    }
    .form .fld > .seg {
      align-self: flex-start;
      max-inline-size: 100%;
      flex-wrap: wrap; /* the four cost-claim choices (slice 9b) wrap on a 320 px phone instead of leaving the card (2.5.0 gate) */
    }
    .form .seg button {
      white-space: nowrap;
    }
    .fld .in,
    .fld select.in {
      inline-size: 100%;
    }
    .fld > span {
      font-weight: var(--sw-fw-medium);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .ro {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 6px 14px;
      font-size: var(--sw-fs-sm);
    }
    .ro dt {
      color: var(--sw-text-3);
    }
    .ro dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .danger {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-danger-soft, var(--sw-stale-soft));
      font-size: var(--sw-fs-sm);
    }
    .chk {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 36px;
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
  `, bubbleChrome];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
    void ticketsApi().meta().then((m) => (this.departments = m.departments.map((d) => ({ id: d.id, name: d.name })))).catch(() => undefined);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.searchTimer);
  }

  protected updated(changed: Map<string, unknown>): void {
    // the same element moved to another kind: a fresh list, nothing open
    if (changed.has('kind') && this.kind !== this.loadedKind && this.isConnected) {
      this.selected = '';
      this.creating = false;
      this.draft = null;
      this.rows = null;
      void this.load();
    }
  }

  private notice(detail: { ok?: string; error?: string }): void {
    this.dispatchEvent(new CustomEvent('notice', { detail, bubbles: true, composed: true }));
  }

  private async load(): Promise<void> {
    try {
      this.loadedKind = this.kind;
      const kind = this.kind || (this.filter === 'all' ? undefined : this.filter);
      const page = await ticketsS4Api().contacts({ q: this.query, kind });
      this.rows = page.contacts;
      this.canEdit = page.can_edit;
      if (this.kind === 'person' && page.can_edit && !this.vendorRows.length) {
        void ticketsS4Api().contacts({ kind: 'vendor' }).then((v) => (this.vendorRows = v.contacts)).catch(() => undefined);
      }
      this.denied = false;
      if (this.selected && !page.contacts.some((c) => c.id === this.selected)) this.selected = '';
    } catch (e) {
      this.rows = [];
      if (e instanceof ApiError && e.status === 403) this.denied = true;
      else this.notice({ error: describeError(e) });
    }
  }

  private search(value: string): void {
    this.query = value;
    window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => void this.load(), 250);
  }

  private open(c: Contact | null): void {
    this.selected = c?.id ?? '';
    this.creating = !c;
    this.draft = this.canEdit ? draftOf(c, this.kind || 'person') : null;
    this.erasing = false;
    this.eraseHistory = false;
    this.problem = '';
    this.liveLinks = 0;
    // how many live links a phone / e-mail change would revoke (the row of the list does not carry it)
    if (c && this.canEdit) void ticketsS4Api().contact(c.id).then((full) => { if (this.selected === c.id) this.liveLinks = full.live_links ?? 0; }).catch(() => undefined);
  }

  private set(p: Partial<Draft>): void {
    if (this.draft) this.draft = { ...this.draft, ...p };
    this.problem = '';
  }

  private body(c: Contact | null): ContactBody | null {
    const d = this.draft;
    if (!d) return null;
    const out: ContactBody = {};
    const before = draftOf(c, this.kind || 'person');
    if (!c || d.kind !== before.kind) out.kind = d.kind;
    if (!c || d.display_name.trim() !== before.display_name) out.display_name = d.display_name.trim();
    if (d.company.trim() !== before.company) out.company = d.company.trim();
    if (d.kind === 'person' && d.vendor_id !== before.vendor_id) out.vendor_id = d.vendor_id || null;
    // a masked number is never sent back: only what the editor typed replaces it
    if (d.phone.trim() !== before.phone) out.phone = d.phone.trim() || null;
    if (d.email.trim() !== before.email) out.email = d.email.trim() || null;
    if (d.preferred_channel !== before.preferred_channel) out.preferred_channel = d.preferred_channel;
    if (d.require_code !== before.require_code) out.require_code = d.require_code;
    if (d.share_history !== before.share_history) out.share_history = d.share_history === 'default' ? null : d.share_history === 'on';
    if (d.lang !== before.lang) out.lang = d.lang;
    if (d.notes !== before.notes) out.notes = d.notes;
    if (d.active !== before.active) out.active = d.active;
    // slice 9 (11A.1 / 11A.2): the cost defaults; the rate and its currency travel together
    if (d.cost_claim !== before.cost_claim) out.cost_claim = d.cost_claim || null;
    if (d.vat_exempt !== before.vat_exempt) out.vat_exempt = d.vat_exempt;
    if (d.vat_default !== before.vat_default) out.vat_default = d.vat_default;
    if (d.labor_rate.trim() !== before.labor_rate || (d.labor_rate.trim() && d.rate_currency !== before.rate_currency)) {
      out.labor_rate = d.labor_rate.trim() || null;
      out.rate_currency = d.rate_currency;
    }
    if (JSON.stringify([...d.departments].sort()) !== JSON.stringify([...before.departments].sort())) out.departments = d.departments;
    return out;
  }

  private async save(c: Contact | null): Promise<void> {
    const d = this.draft;
    const b = this.body(c);
    if (!d || !b || this.busy) return;
    if (!d.display_name.trim()) {
      this.problem = tt('required');
      return;
    }
    if (c && !Object.keys(b).length) return;
    if (d.labor_rate.trim() && decimalToMinor(d.labor_rate) === null) {
      this.problem = ct('invalid');
      return;
    }
    this.busy = true;
    try {
      const saved = c ? await ticketsS4Api().patchContact(c.id, { ...b, revision: c.revision }) : await ticketsS4Api().createContact(b);
      const before = this.liveLinks;
      const revoked = c && before > 0 && (saved.live_links ?? 0) < before ? before - (saved.live_links ?? 0) : 0;
      this.notice({ ok: revoked ? `${tt('setSaved')} · ${tt('ctLinksRevoked', { n: revoked })}` : tt('setSaved') });
      await this.load();
      this.open(saved);
    } catch (e) {
      const fields = e instanceof ApiError ? ((e.body as { details?: { fields?: { field: string; code: string }[] } }).details?.fields ?? []) : [];
      this.problem = fields.length ? `${describeError(e)} (${fields.map((f) => f.field).join(', ')})` : describeError(e);
      if (e instanceof ApiError && e.status === 409) await this.load();
    } finally {
      this.busy = false;
    }
  }

  private async erase(c: Contact): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const r = await ticketsS4Api().eraseContact(c.id, this.eraseHistory);
      this.notice({ ok: r.links_revoked ? `${tt('ctErased')} · ${tt('ctLinksRevoked', { n: r.links_revoked })}` : tt('ctErased') });
      this.selected = '';
      this.draft = null;
      await this.load();
    } catch (e) {
      this.notice({ error: describeError(e) });
    } finally {
      this.busy = false;
      this.erasing = false;
    }
  }

  private async exportData(c: Contact): Promise<void> {
    try {
      const data = await ticketsS4Api().exportContact(c.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `contact-${c.id.slice(0, 8)}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      this.notice({ error: describeError(e) });
    }
  }

  // ---------------------------------------------------------------- render

  private listCard(): TemplateResult {
    const rows = this.rows ?? [];
    const filters: KindFilter[] = ['all', 'vendor', 'person', 'employee'];
    const locked = this.kind;
    const heading = locked === 'employee' ? tt('hdEmployees') : locked === 'vendor' ? tt('hdSeg_vendors') : locked === 'person' ? tt('hdSeg_contacts') : tt('ctTitle');
    return html`<sw-card heading=${heading} subheading=${locked ? '' : tt('ctSub')} data-card="contacts" data-contacts-kind=${locked || 'all'}>
      <div class="tools">
        <input class="in" type="search" maxlength="60" data-contacts-search aria-label=${tt('ctSearch')} placeholder=${tt('ctSearch')} .value=${this.query}
          @input=${(e: Event) => this.search((e.target as HTMLInputElement).value)} />
        ${locked ? nothing : html`<span class="seg" role="radiogroup" aria-label=${tt('ctColKind')}>${filters.map((f) => html`<button type="button" role="radio" aria-checked=${String(this.filter === f)}
          aria-pressed=${String(this.filter === f)} data-contacts-filter=${f} @click=${() => { this.filter = f; void this.load(); }}>${f === 'all' ? tt('tabAll') : tt(`ctKind_${f}` as TicketTextKey)}</button>`)}</span>`}
        ${this.canEdit ? html`<sw-button size="sm" variant="primary" icon="plus" data-contact-new ?disabled=${this.busy} @click=${() => this.open(null)}>${locked ? tt(`ctNew_${locked}` as TicketTextKey) : tt('ctNew')}</sw-button>` : nothing}
      </div>
      ${this.rows === null ? html`<sw-state-panel state="loading"></sw-state-panel>` : rows.length ? html`<div class="dlist" role="list" data-contacts-list>
        ${repeat(rows, (c) => c.id, (c) => html`<button type="button" role="listitem" class=${`ditem ${c.active ? '' : 'off'}`} aria-current=${String(c.id === this.selected)}
          data-contact-item=${c.id} @click=${() => this.open(c)}>
          <span class="txt"><span class="nm">${bidi(c.display_name)}</span>
            <span class="sub">${bidi([c.vendor_name ?? c.company, c.phone].filter(Boolean).join(' · ') || '–')}</span></span>
          ${c.require_code ? html`<span class="tag">${tt('lkCode')}</span>` : nothing}
          ${c.open_tickets ? html`<span class="tag acc" data-open-tickets>${c.open_tickets} ${tt('ctColOpen')}</span>` : nothing}
          ${locked ? nothing : html`<span class=${`tag kind ${c.kind === 'vendor' ? 'acc' : ''}`}>${tt(`ctKind_${c.kind}` as TicketTextKey)}</span>`}
          ${c.active ? nothing : html`<span class="tag">${tt('depInactive')}</span>`}
        </button>`)}</div>`
        : html`<sw-state-panel state="empty" heading=${this.query || this.filter !== 'all' ? tt('ctNone') : locked ? tt(`ctEmpty_${locked}` as TicketTextKey) : tt('ctEmpty')}></sw-state-panel>`}
    </sw-card>`;
  }

  private readOnlyCard(c: Contact): TemplateResult {
    const deptNames = c.departments.length ? c.departments.map((id) => this.departments.find((d) => d.id === id)?.name ?? id).join(', ') : tt('ctDepartmentsAll');
    return html`<sw-card heading=${c.display_name} subheading=${tt(`ctKind_${c.kind}` as TicketTextKey)} data-card="contact" data-contact=${c.id}>
      <dl class="ro">
        ${c.company ? html`<dt>${tt('ctCompany')}</dt><dd>${bidi(c.company)}</dd>` : nothing}
        ${c.vendor_name ? html`<dt>${tt('ctVendor')}</dt><dd>${bidi(c.vendor_name)}</dd>` : nothing}
        <dt>${tt('ctPhone')}</dt><dd dir="ltr">${c.phone ?? '–'}${c.phone && !c.phone_full ? html` <span class="tag">${tt('ctMasked')}</span>` : nothing}</dd>
        <dt>${tt('ctLang')}</dt><dd>${LANG_NAMES[c.lang]}</dd>
        <dt>${tt('ctRequireCode')}</dt><dd>${c.require_code ? tt('ctYes') : tt('ctNo')}</dd>
        <dt>${tt('ctDepartments')}</dt><dd>${deptNames}</dd>
      </dl>
    </sw-card>`;
  }

  /** slice 9: the cost-claim defaults of the contact (11A.1 / 11A.2); the hourly rate only for holders of tickets.costs.view (11A.8). */
  private costFields(d: Draft): TemplateResult {
    const rates = !isApi() || canAnywhere('tickets.costs.view');
    const modes: readonly (CostMode | '')[] = ['', 'required', 'optional', 'off'];
    const rateBad = !!d.labor_rate.trim() && decimalToMinor(d.labor_rate) === null;
    return html`<div class="fld wide" data-section="costs"><span>${ct('ctCostSection')}</span>
      <span class="seg" role="radiogroup" aria-label=${ct('ctCostClaim')} data-field="cost_claim">${modes.map((m) => html`<button type="button" role="radio"
        aria-checked=${String(d.cost_claim === m)} aria-pressed=${String(d.cost_claim === m)} data-field=${`cost_claim:${m || 'default'}`}
        @click=${() => this.set({ cost_claim: m })}>${m ? ct(`m_${m}` as 'm_required') : ct('ctCostClaimDefault')}</button>`)}</span></div>
      <div class="row wide"><span class="lbl">${ct('ctVatExempt')}</span>
        <sw-toggle label=${ct('ctVatExempt')} labelHidden .checked=${d.vat_exempt} data-field="vat_exempt" @change=${(e: CustomEvent<{ checked: boolean }>) => this.set({ vat_exempt: e.detail.checked })}></sw-toggle></div>
      ${d.vat_exempt ? nothing : html`<div class="fld wide"><span>${ct('ctVatDefault')}</span>
        <span class="seg" role="radiogroup" aria-label=${ct('ctVatDefault')}>${(['excluded', 'included'] as const).map((v) => html`<button type="button" role="radio"
          aria-checked=${String(d.vat_default === v)} aria-pressed=${String(d.vat_default === v)} data-field=${`vat_default:${v}`}
          @click=${() => this.set({ vat_default: v })}>${v === 'excluded' ? ct('amountsExcl') : ct('amountsIncl')}</button>`)}</span></div>`}
      ${rates ? html`<label class="fld"><span>${ct('ctRate')}</span><input class="in" inputmode="decimal" dir="ltr" maxlength="20" data-field="labor_rate"
          aria-invalid=${String(rateBad)} .value=${d.labor_rate} @input=${(e: Event) => this.set({ labor_rate: (e.target as HTMLInputElement).value })} /></label>
        <label class="fld"><span>${ct('ctRateCurrency')}</span><select class="in" data-field="rate_currency" ?disabled=${!d.labor_rate.trim()}
          @change=${(e: Event) => this.set({ rate_currency: (e.target as HTMLSelectElement).value })}>${CURRENCIES.map((cur) => html`<option value=${cur} ?selected=${cur === d.rate_currency}>${cur}</option>`)}</select></label>` : nothing}`;
  }

  private editorCard(c: Contact | null): TemplateResult {
    const d = this.draft!;
    const vendors = (this.kind === 'person' ? this.vendorRows : this.rows ?? []).filter((x) => x.kind === 'vendor' && x.id !== c?.id && !x.erased);
    const employee = d.kind === 'employee'; // an employee without an account: name, phone, e-mail, channel, language, departments, notes
    const kinds: readonly ContactKind[] = this.kind ? [] : ['person', 'vendor', 'employee'];
    const seg = <T extends string>(label: string, values: readonly T[], current: T, text: (v: T) => string, on: (v: T) => void, attr: string) => html`
      <div class="fld"><span>${label}</span><span class="seg" role="radiogroup" aria-label=${label}>${values.map((v) => html`<button type="button" role="radio"
        aria-checked=${String(current === v)} aria-pressed=${String(current === v)} data-field=${`${attr}:${v}`} @click=${() => on(v)}>${text(v)}</button>`)}</span></div>`;
    const fresh = this.kind ? tt(`ctNew_${this.kind}` as TicketTextKey) : tt('ctFormNew');
    return html`<sw-card heading=${c ? c.display_name : fresh} subheading=${c && !this.kind ? tt(`ctKind_${c.kind}` as TicketTextKey) : ''} data-card="contact-editor" data-contact=${c?.id ?? 'new'} data-contact-kind=${d.kind}>
      <div class="form">
        ${kinds.length ? seg(tt('ctColKind'), kinds, d.kind, (v) => tt(`ctKind_${v}` as TicketTextKey), (v) => this.set({ kind: v, vendor_id: v === 'person' ? d.vendor_id : '' }), 'kind') : nothing}
        <label class="fld"><span>${tt('ctName')} *</span><input class="in" maxlength="80" data-field="display_name" aria-invalid=${String(!!this.problem && !d.display_name.trim())}
          .value=${d.display_name} @input=${(e: Event) => this.set({ display_name: (e.target as HTMLInputElement).value })} /></label>
        ${employee ? nothing : html`<label class="fld"><span>${tt('ctCompany')}</span><input class="in" maxlength="80" data-field="company" .value=${d.company} @input=${(e: Event) => this.set({ company: (e.target as HTMLInputElement).value })} /></label>`}
        ${d.kind === 'person' ? html`<label class="fld"><span>${tt('ctVendor')}</span><select class="in" data-field="vendor_id" @change=${(e: Event) => this.set({ vendor_id: (e.target as HTMLSelectElement).value })}>
          <option value="" ?selected=${!d.vendor_id}>${tt('ctVendorNone')}</option>
          ${vendors.map((v) => html`<option value=${v.id} ?selected=${v.id === d.vendor_id}>${v.display_name}</option>`)}</select></label>` : nothing}
        <label class="fld"><span>${tt('ctPhone')}</span><input class="in" type="tel" dir="ltr" maxlength="40" autocomplete="off" data-field="phone"
          placeholder=${c && c.has_phone && !c.phone_full ? c.phone ?? '' : ''} .value=${d.phone} @input=${(e: Event) => this.set({ phone: (e.target as HTMLInputElement).value })} />
          <span class="hint">${tt('ctPhoneHint')}</span>
          ${c && this.liveLinks > 0 && (d.phone.trim() !== draftOf(c).phone || d.email.trim() !== draftOf(c).email)
            ? html`<span class="err" role="status" data-contact-links-warning>${tt('ctChangeRevokes', { n: this.liveLinks })}</span>` : nothing}</label>
        <label class="fld"><span>${tt('ctEmail')}</span><input class="in" type="email" dir="ltr" maxlength="254" autocomplete="off" data-field="email" .value=${d.email}
          @input=${(e: Event) => this.set({ email: (e.target as HTMLInputElement).value })} /></label>
        ${seg(tt('ctChannel'), CONTACT_CHANNELS, d.preferred_channel, (v) => tt(`ch_${v}` as TicketTextKey), (v) => this.set({ preferred_channel: v }), 'channel')}
        <label class="fld"><span>${tt('ctLang')}</span><select class="in" data-field="lang" @change=${(e: Event) => this.set({ lang: (e.target as HTMLSelectElement).value as ContactLang })}>
          ${CONTACT_LANGS.map((l) => html`<option value=${l} ?selected=${l === d.lang}>${LANG_NAMES[l]}</option>`)}</select></label>
        ${employee ? nothing : html`${seg(tt('ctHistory'), ['default', 'on', 'off'] as const, d.share_history, (v) => tt(`hist_${v}` as TicketTextKey), (v) => this.set({ share_history: v }), 'history')}
        <div class="row wide"><span class="lbl">${tt('ctRequireCode')}<span class="muted">${tt('ctRequireCodeSub')}</span></span>
          <sw-toggle label=${tt('ctRequireCode')} labelHidden .checked=${d.require_code} data-field="require_code" @change=${(e: CustomEvent<{ checked: boolean }>) => this.set({ require_code: e.detail.checked })}></sw-toggle></div>
        ${this.costFields(d)}`}
        <div class="fld wide"><span>${employee ? tt('ctDepartmentsOf') : tt('ctDepartments')}</span>
          <span class="chipsrow" data-field="departments">
            <button type="button" class="rc" aria-pressed=${String(!d.departments.length)} @click=${() => this.set({ departments: [] })}>${tt('ctDepartmentsAll')}</button>
            ${this.departments.map((dep) => html`<button type="button" class="rc" aria-pressed=${String(d.departments.includes(dep.id))} data-dept=${dep.id}
              @click=${() => this.set({ departments: d.departments.includes(dep.id) ? d.departments.filter((x) => x !== dep.id) : [...d.departments, dep.id] })}>${bidi(dep.name)}</button>`)}
          </span></div>
        <label class="fld wide"><span>${tt('ctNotes')}</span><textarea class="in" maxlength="1000" data-field="notes" .value=${d.notes}
          @input=${(e: Event) => this.set({ notes: (e.target as HTMLTextAreaElement).value })}></textarea></label>
        ${c ? html`<div class="row wide"><span class="lbl">${tt('ctActive')}</span>
          <sw-toggle label=${tt('ctActive')} labelHidden .checked=${d.active} data-field="active" @change=${(e: CustomEvent<{ checked: boolean }>) => this.set({ active: e.detail.checked })}></sw-toggle></div>` : nothing}
      </div>
      ${this.problem ? html`<div class="err" role="alert" data-contact-problem>${this.problem}</div>` : nothing}
      <div class="foot">
        <sw-button variant="primary" size="sm" data-contact-save ?disabled=${this.busy} @click=${() => void this.save(c)}>${tt('ctSave')}</sw-button>
        <sw-button size="sm" variant="ghost" data-contact-cancel ?disabled=${this.busy} @click=${() => { this.selected = ''; this.creating = false; this.draft = null; }}>${tt('ctCancel')}</sw-button>
        ${c ? html`<span class="grow"></span>
          <sw-button size="sm" variant="ghost" data-contact-export ?disabled=${this.busy} @click=${() => void this.exportData(c)}>${tt('ctExport')}</sw-button>
          <sw-button size="sm" variant="ghost" data-contact-erase ?disabled=${this.busy || this.erasing} @click=${() => (this.erasing = true)}>${tt('ctErase')}</sw-button>` : nothing}
      </div>
      ${c && this.erasing ? html`<div class="danger" role="group" data-contact-erase-confirm>
        <span>${tt('ctEraseConfirm', { name: c.display_name })}</span>
        <label class="chk"><input type="checkbox" .checked=${this.eraseHistory} @change=${(e: Event) => (this.eraseHistory = (e.target as HTMLInputElement).checked)} />${tt('ctEraseHistory')}</label>
        <span class="chipsrow"><sw-button size="sm" variant="danger" data-contact-erase-ok ?disabled=${this.busy} @click=${() => void this.erase(c)}>${tt('ctErase')}</sw-button>
          <sw-button size="sm" variant="ghost" @click=${() => (this.erasing = false)}>${tt('ctCancel')}</sw-button></span>
      </div>` : nothing}
    </sw-card>`;
  }

  render() {
    if (this.denied) return html`<sw-state-panel state="empty" heading=${tt('ctNoPermission')} data-contacts-denied></sw-state-panel>`;
    const sel = (this.rows ?? []).find((c) => c.id === this.selected) ?? null;
    const side = this.creating && this.draft ? this.editorCard(null) : sel ? (this.draft ? this.editorCard(sel) : this.readOnlyCard(sel)) : nothing;
    return html`<div class="split" data-contacts>
      <div class="stack">${this.listCard()}</div>
      ${side}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-contacts': TicketsContacts;
  }
}
