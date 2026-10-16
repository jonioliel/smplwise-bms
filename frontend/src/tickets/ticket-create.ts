import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-drawer';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { describeError } from '../api/client';
import { assigneeRef, handlersOf } from './assignee-model';
import { newRequestId, ticketsApi, type Handler, type Meta, type NewTicketMode, type TicketDetail, type TicketItem } from '../api/tickets';
import { listHref, priorityTone, ticketHref, type TicketsRoute } from './model';
import { tt } from './text';
import { tIcon } from './icons';
import { ticketDetailStyles, ticketFormStyles } from './styles';
import { onTicketNames } from './naming';
import { deviceBlock, deviceBlockStyles, type DeviceRef } from './ticket-device-context';
import { isApi } from '../api/session';
import { ticketsS4Api, type AssigneesAnswer, type ExternalAssignee, type Readiness } from '../api/tickets-s4';
import { LATER, createAssignGroups, parsePick, type CreateGroupKey } from './create-assign-model';
import { dwt, type DrawerTextKey } from './drawer-text';

/**
 * CR-038 `<ticket-create .open .meta mode="sheet|dialog">`: the create form (D22: a side sheet - the automation builder's 620 px sheet - or a
 * centred dialog), in the approved mock-up's order: department and category, title, priority (chips), description, photos (uploaded right
 * after the ticket exists, through the one validator), and for a manager of the department the handler ("assign later" by default). While
 * the title is typed, open tickets with a similar title are listed (the duplicate hint; slice 3 lists the device's open tickets first).
 * The request carries a client request id, so a retry after a lost answer never opens the ticket twice.
 * Events: `created` {ticket, id, number, result, failedPhotos}, `close`.
 */
@customElement('ticket-create')
export class TicketCreate extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) meta: Meta | null = null;
  @property() mode: NewTicketMode = 'sheet';
  @property() scope: TicketsRoute['scope'] = 'mine';
  /** D18: where a similar ticket opens */
  @property() detailMode: 'drawer' | 'fullscreen' | 'drawer_fullscreen' = 'drawer_fullscreen';
  /** CR-038 slice 3: a ticket opened from a device (the device window): the device, its place, its open tickets first (the duplicate hint),
   * what history will be attached, the category preselected by the device's domain; the server resolves the place itself. */
  @property({ attribute: false }) device: DeviceRef | null = null;
  @state() private dept = '';
  @state() private category = '';
  @state() private priority = '';
  /** the title being typed (not `title`: that is the element's own tooltip attribute) */
  @state() private ttl = '';
  @state() private description = '';
  @state() private files: File[] = [];
  @state() private assignTo = '';
  /** TKSTAFF2: the department's handlers (account holders and staff contacts without an account); ssignTo is a handler key */
  @state() private eligible: Handler[] | null = null;
  /** TKUI1 (owner 16.10): the outside contacts of the department (the vendor flow, two steps) and what sending outside needs */
  @state() private contacts: ExternalAssignee[] | null = null;
  @state() private external = false;
  @state() private publicReady = false;
  @state() private readiness: Readiness | null = null;
  @state() private asgQuery = '';
  @state() private similar: TicketItem[] = [];
  @state() private busy = false;
  @state() private error = '';
  @state() private tried = false;
  private requestId = newRequestId();
  private similarTimer = 0;
  private offNames: (() => void) | null = null;
  private previews = new Map<File, string>();

  static styles = [bubbleChrome, ...automationsStyles, ticketDetailStyles, ticketFormStyles, deviceBlockStyles, css`
    sw-drawer {
      --sw-drawer-modal-w: 620px;
    }
    sw-dialog {
      --sw-surface: var(--dv-surface-solid);
      --sw-glass-blur: none;
    }
    .pick.grouped .ghead {
      padding: 6px 4px 0;
      font-size: var(--sw-fs-xs);
      font-weight: 700;
      color: var(--dv-text-3);
    }
    .xreason {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: var(--sw-r-lg);
      border: 1px dashed var(--dv-border);
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
    .xreason a {
      color: var(--dv-accent-text);
      font-weight: 600;
    }
    .hint {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.offNames = onTicketNames(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.similarTimer);
    this.offNames?.();
    this.dropPreviews();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('open') && this.open) this.reset();
    if ((changed.has('meta') || changed.has('open')) && this.open && !this.dept) {
      const first = this.creatable()[0];
      if (first) this.pickDepartment(first.id);
    }
  }

  private creatable(): Meta['departments'] {
    return (this.meta?.departments ?? []).filter((d) => d.can_create);
  }

  private reset(): void {
    this.dept = '';
    this.category = '';
    this.priority = '';
    this.ttl = '';
    this.description = '';
    this.dropPreviews();
    this.files = [];
    this.assignTo = '';
    this.eligible = null;
    this.contacts = null;
    this.asgQuery = '';
    this.similar = [];
    this.error = '';
    this.tried = false;
    this.requestId = newRequestId();
  }

  private dropPreviews(): void {
    for (const url of this.previews.values()) URL.revokeObjectURL(url);
    this.previews.clear();
  }

  private pickDepartment(id: string): void {
    this.dept = id;
    const d = this.meta?.departments.find((x) => x.id === id);
    this.category = '';
    this.priority = d?.priorities.find((p) => p.is_default)?.id ?? d?.priorities[0]?.id ?? '';
    const domain = this.device?.id.split('.')[0];
    const byDomain = domain ? d?.categories.find((c) => c.domains?.includes(domain)) : undefined;
    if (byDomain) this.pickCategory(byDomain.id);
    this.assignTo = '';
    this.eligible = null;
    this.contacts = null;
    if (d?.can_manage) void ticketsApi().assignees(id).then((r) => {
      if (this.dept !== id) return;
      this.eligible = handlersOf(r);
      this.takeOutside(r as AssigneesAnswer, id);
    }).catch(() => { this.eligible = []; this.contacts = []; });
  }

  private pickCategory(id: string): void {
    this.category = id;
    const d = this.meta?.departments.find((x) => x.id === this.dept);
    const c = d?.categories.find((x) => x.id === id);
    if (c?.default_priority_id) this.priority = c.default_priority_id;
  }

  /** slice 2: a department's opening template prefills the form (title, description, category, priority); the person edits on. */
  private applyTemplate(id: string): void {
    const d = this.meta?.departments.find((x) => x.id === this.dept);
    const t = d?.templates?.find((x) => x.id === id);
    if (!d || !t) return;
    if (t.category_id && d.categories.some((c) => c.id === t.category_id)) this.pickCategory(t.category_id);
    const p = t.priority_key ? d.priorities.find((x) => x.key === t.priority_key) : undefined;
    if (p) this.priority = p.id;
    if (t.body) this.description = t.body;
    if (t.title) this.onTitle(t.title);
  }

  private onTitle(v: string): void {
    this.ttl = v;
    this.error = '';
    window.clearTimeout(this.similarTimer);
    const q = v.trim();
    if (q.length < 4) {
      this.similar = [];
      return;
    }
    this.similarTimer = window.setTimeout(() => {
      void ticketsApi().list({ scope: 'visible', status: 'open', q, limit: 3 }).then((r) => { if (this.ttl.trim() === q) this.similar = r.items; }).catch(() => undefined);
    }, 350);
  }

  private onFiles(e: Event): void {
    const input = e.target as HTMLInputElement;
    const picked = [...(input.files ?? [])].filter((f) => /^image\/(jpeg|png)$/.test(f.type) || /\.(jpe?g|png)$/i.test(f.name));
    input.value = '';
    this.files = [...this.files, ...picked].slice(0, 10);
  }

  private removeFile(f: File): void {
    const url = this.previews.get(f);
    if (url) URL.revokeObjectURL(url);
    this.previews.delete(f);
    this.files = this.files.filter((x) => x !== f);
  }

  private previewOf(f: File): string {
    let url = this.previews.get(f);
    if (!url) {
      url = URL.createObjectURL(f);
      this.previews.set(f, url);
    }
    return url;
  }

  /** The outside part of GET tickets/assignees (a server carries it; the demo store answers it from the slice-4 store). */
  private takeOutside(r: AssigneesAnswer, dept: string): void {
    const set = (x: AssigneesAnswer) => {
      if (this.dept !== dept) return;
      this.contacts = x.contacts ?? [];
      this.external = !!x.external;
      this.publicReady = !!x.public_ready;
      this.readiness = x.readiness ?? null;
    };
    if (r.contacts !== undefined || isApi()) set(r);
    else void ticketsS4Api().externalAssignees(dept, '').then(set).catch(() => (this.contacts = []));
  }

  /** The picked handler as the create route's `assign` ({kind, id}), or null ("assign later" - and a vendor: never assigned here). */
  private assignee(): { kind: 'user' | 'contact'; id: string } | null {
    const p = parsePick(this.assignTo);
    if (p.kind !== 'handler') return null;
    const h = (this.eligible ?? []).find((x) => x.key === p.id);
    return h ? assigneeRef(h) : null;
  }

  private async submit(): Promise<void> {
    this.tried = true;
    if (!this.ttl.trim() || !this.dept || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const answer = await ticketsApi().create({
        department_id: this.dept, category_id: this.category || null, priority_id: this.priority || null, title: this.ttl.trim(),
        description: this.description.trim(), assign: this.assignee(), client_request_id: this.requestId,
        ...(this.device ? { entity_id: this.device.id } : {}),
      });
      let ticket: TicketDetail | null = 'events' in answer ? (answer as TicketDetail) : null;
      let failed = 0;
      if (ticket && answer.result === 'created') {
        for (const f of this.files) {
          try {
            ticket = await ticketsApi().upload(ticket.id, f, false);
          } catch {
            failed += 1;
          }
        }
      }
      // TKUI1: a vendor is assigned in step two - the screen opens the new request with the external-assign dialog prefilled
      const pick = parsePick(this.assignTo);
      const assignContact = pick.kind === 'vendor' && answer.result === 'created' ? pick.id : undefined;
      this.dispatchEvent(new CustomEvent('created', { detail: { ticket, id: answer.id, number: answer.number, result: answer.result, failedPhotos: failed, assignContact }, bubbles: true, composed: true }));
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private hrefOf(id: string): string {
    return this.detailMode === 'fullscreen' ? ticketHref(id) : listHref(this.scope, undefined, { t: id });
  }

  private form(): TemplateResult {
    const depts = this.creatable();
    const d = this.meta?.departments.find((x) => x.id === this.dept);
    if (!this.meta) return html`<div class="form" aria-busy="true"><span class="skl" style="block-size:44px"></span><span class="skl" style="block-size:44px"></span><span class="skl" style="block-size:120px"></span></div>`;
    if (!depts.length) return html`<div class="statebox glass" role="status" data-create-state="no-department"><span class="ring">${tIcon('ticket')}</span><b>${tt('createNoDepartment')}</b></div>`;
    const titleMissing = this.tried && !this.ttl.trim();
    return html`<div class="form" data-create-form>
      ${this.device ? deviceBlock(this.device, (id) => this.hrefOf(id)) : nothing}
      <div class="two">
        <label class="fld"><span>${tt('fDepartment')}</span>
          <select class="inp" data-create-department @change=${(e: Event) => this.pickDepartment((e.target as HTMLSelectElement).value)}>${depts.map((x) => html`<option value=${x.id} ?selected=${x.id === this.dept}>${x.name}</option>`)}</select></label>
        <label class="fld"><span>${tt('fCategory')}</span>
          <select class="inp" data-create-category @change=${(e: Event) => this.pickCategory((e.target as HTMLSelectElement).value)}>
            <option value="" ?selected=${!this.category}>${tt('fNoCategory')}</option>
            ${(d?.categories ?? []).map((c) => html`<option value=${c.id} ?selected=${c.id === this.category}>${c.name}</option>`)}
          </select></label>
      </div>
      ${d?.templates?.length ? html`<label class="fld"><span>${tt('tplCard')}</span>
        <select class="inp" data-create-template @change=${(e: Event) => this.applyTemplate((e.target as HTMLSelectElement).value)}>
          <option value="">${tt('tplAny')}</option>
          ${d.templates.map((t) => html`<option value=${t.id}>${t.name}</option>`)}
        </select></label>` : nothing}
      <label class="fld"><span>${tt('fTitle')} <b class="req">*</b></span>
        <input class="inp" maxlength="120" autocomplete="off" data-create-title placeholder=${tt('fTitlePh')} aria-invalid=${String(titleMissing)} .value=${this.ttl} @input=${(e: Event) => this.onTitle((e.target as HTMLInputElement).value)} />
        ${titleMissing ? html`<span class="err" role="alert">${tt('createNeed')}</span>` : nothing}</label>
      ${this.similar.length ? html`<div class="similar" data-similar><b>${tt('similar')}</b>${this.similar.map((s) => html`<a href=${this.hrefOf(s.id)} data-similar-item=${s.id}>#${s.number} · ${s.title}</a>`)}</div>` : nothing}
      ${d?.priorities.length ? html`<div class="fld"><span>${tt('fPriority')}</span><div class="prio" role="radiogroup" aria-label=${tt('fPriority')}>
        ${d.priorities.map((p) => html`<button type="button" class="rc" role="radio" aria-checked=${String(p.id === this.priority)} data-create-priority=${p.key} @click=${() => (this.priority = p.id)}><i class=${`dot ${priorityTone(p) === 'bad' ? 'bad' : priorityTone(p) === 'info' ? 'run' : ''}`}></i>${p.name}</button>`)}
      </div></div>` : nothing}
      <label class="fld"><span>${tt('fDescription')}</span>
        <textarea class="inp" maxlength="4000" data-create-description placeholder=${tt('fDescriptionPh')} .value=${this.description} @input=${(e: Event) => (this.description = (e.target as HTMLTextAreaElement).value)}></textarea></label>
      <div class="fld"><span>${tt('fPhotos')}</span>
        <div class="thumbs">
          ${this.files.map((f, i) => html`<figure class="ph" style="margin:0" data-create-photo><img src=${this.previewOf(f)} alt=${tt('photoAlt', { n: i + 1 })} /><button type="button" class="rm" aria-label=${tt('removePhoto')} @click=${() => this.removeFile(f)}>${tIcon('trash')}</button></figure>`)}
          <label class="ph add" data-create-photo-add>${tIcon('plus')}<span>${tt('addPhoto')}</span><input type="file" accept="image/jpeg,image/png" multiple aria-label=${tt('addPhoto')} @change=${this.onFiles} /></label>
        </div>
      </div>
      ${d?.can_manage ? this.assigneePicker() : nothing}
      ${this.error ? html`<div class="banner bad" role="alert" data-create-error>${tIcon('warning')}<div>${this.error}</div></div>` : nothing}
    </div>`;
  }

  /** TKUI1 (owner 16.10): "assign later" first, then three headed groups - with an account / without an account / vendors and outside
   * contacts (a disabled group says why, with the link to its setting); a search field above six entries (tickets/create-assign-model.ts). */
  private assigneePicker(): TemplateResult {
    if (this.eligible === null) return html`<div class="fld" data-create-assignee><span>${tt('fAssignee')}</span><span class="skl" style="block-size:44px"></span></div>`;
    const { groups, searchable } = createAssignGroups({ handlers: this.eligible, contacts: this.contacts, external: this.external, publicReady: this.publicReady || !isApi(), readiness: this.readiness, query: this.asgQuery });
    const cur = this.assignTo || LATER;
    const radio = (value: string, label: TemplateResult | string, attrs: { handler?: string; id?: string; vendor?: string }, sub = '') =>
      html`<label data-handler=${attrs.handler ?? nothing} data-eligible=${attrs.id ?? nothing} data-create-vendor=${attrs.vendor ?? nothing} data-create-option=${value}>
        <input type="radio" name="asg" .checked=${cur === value} @change=${() => (this.assignTo = value === LATER ? '' : value)} />${label}${sub ? html`<small>${bidi(sub)}</small>` : nothing}</label>`;
    const shown = groups.filter((g) => g.key !== 'later' && (g.total > 0 || g.key === 'vendor'));
    const none = !!this.asgQuery.trim() && shown.every((g) => !g.options.length);
    const picked = parsePick(cur);
    const heading = (k: CreateGroupKey) => html`<div class="ghead" role="presentation" data-create-group=${k}>${dwt(`cg_${k}` as DrawerTextKey)}</div>`;
    return html`<div class="fld" data-create-assignee><span>${tt('fAssignee')}</span>
      ${searchable ? html`<input class="inp" type="search" data-create-asg-search placeholder=${dwt('cgSearch')} aria-label=${dwt('cgSearch')} .value=${this.asgQuery}
        @input=${(e: Event) => (this.asgQuery = (e.target as HTMLInputElement).value)} />` : nothing}
      <div class="pick grouped" role="radiogroup" aria-label=${tt('fAssignee')}>
        ${radio(LATER, tt('fAssignLater'), {})}
        ${shown.map((g) => html`${heading(g.key)}
          ${g.blocked ? html`<div class="xreason" data-create-vendor-blocked=${g.blocked.key}>${tIcon('lock')}<span>${tt(g.blocked.text)}</span><a href=${g.blocked.href}>${tt(g.blocked.link)}</a></div>` : nothing}
          ${g.options.map((o) => {
            const p = parsePick(o.value);
            const h = p.kind === 'handler' ? this.eligible?.find((x) => x.key === p.id) : undefined;
            return radio(o.value, bidi(o.label), p.kind === 'vendor' ? { vendor: p.id } : { handler: p.id, id: h?.id }, p.kind === 'vendor' ? o.sub : '');
          })}`)}
        ${none ? html`<div class="muted" data-create-asg-none>${dwt('cgNoMatch')}</div>` : nothing}
      </div>
      ${picked.kind === 'vendor' ? html`<small class="hint" data-create-vendor-note>${tIcon('send')}${dwt('cgVendorNext')}</small>` : nothing}
    </div>`;
  }

  private footer(): TemplateResult {
    return html`<div slot="footer" class="sheetfoot">
      <button type="button" class="btn primary" data-create-submit ?disabled=${this.busy || !this.creatable().length} @click=${() => void this.submit()}>${tIcon('check')}${tt('createSubmit')}</button>
      <button type="button" class="btn quiet" data-create-cancel @click=${() => this.close()}>${tt('cancel')}</button>
      ${!this.ttl.trim() ? html`<span class="hint">${tt('createNeed')}</span>` : this.files.length ? html`<span class="hint">${tt('photosAfter')}</span>` : nothing}
    </div>`;
  }

  render() {
    const d = this.meta?.departments.find((x) => x.id === this.dept);
    if (this.mode === 'dialog') {
      return html`<sw-dialog .open=${this.open} wide heading=${tt('newTitle')} subheading=${d?.name ?? ''} data-create="dialog" @close=${() => this.close()}>${this.open ? this.form() : nothing}${this.open ? this.footer() : nothing}</sw-dialog>`;
    }
    return html`<sw-drawer modal .open=${this.open} heading=${tt('newTitle')} subheading=${d?.name ?? ''} data-create="sheet" @close=${() => this.close()}>${this.open ? this.form() : nothing}${this.open ? this.footer() : nothing}</sw-drawer>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-create': TicketCreate;
  }
}
