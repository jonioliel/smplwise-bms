import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import './ticket-cost-card'; // slice 9 (11A.7): the cost card
import { ct } from './cost-text';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-drawer';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { ticketsApi, type DetailMode, type Handler, type Meta, type PatchBody, type TicketDetail, type TicketStatus } from '../api/tickets';
import { assigneeRef, handlersOf } from './assignee-model';
import {
  FINAL, STATUS_LINE, actorName, eventLine, fromLocalInput, listHref, marksInternal, moveTo, priorityTone, relTime, shortDateTime, sideMoves,
  chipLabel, isWaitingPart, lineStatus, statusLabel, statusTone, waitingToggle, ticketHref, toLocalInput, type TicketsRoute,
} from './model';
import { tt } from './text';
import { tIcon } from './icons';
import { ticketDetailStyles, ticketFormStyles } from './styles';
import { onTicketNames } from './naming';
import { codeLockSection, lockText, sendNewLink } from './code-lock';
import { messageEventLine, messagesBlock } from './ticket-messages'; // slice 5b: the delivery lines (D14) and the message events
import { ExternalAssign, externalAssignStyles } from './external-assign';
import { LinkPanel, linkPanelStyles } from './link-panel';
import { deviceBlockStyles, historySection } from './ticket-device-context'; // CR-038 slice 3: the frozen device history
import './delete-dialog'; // owner 14.10: full deletion (tickets.delete)
import { dlt } from './delete-text';

interface EditForm { title: string; description: string; department_id: string; category_id: string; priority_id: string }

type Dialog =
  | { kind: 'move'; to: TicketStatus; noteRequired: boolean }
  | { kind: 'assign' }
  | { kind: 'return' }
  | { kind: 'edit' }
  | { kind: 'eta' }
  | null;

/**
 * CR-038 `<ticket-detail .ticketId mode="drawer|page">`: one ticket - the drawer over the list (`sw-drawer` modal, 480 px; a bottom sheet on a
 * phone) or the full screen `#/tickets/<id>` (D18), in the approved mock-up's anatomy: the sentence box (description, number, department,
 * who opened it), the state strip (the moves this caller may make are the enabled buttons - `transitions` from the server), the handler
 * block (assign / reassign for a manager, return and ETA for the handler), the photos (internal ones marked once a ticket went outside -
 * slice 4) and the timeline with the note composer. Every action calls the API and shows the server's answer; nothing is decided here.
 * Events (bubble, composed): `ticket-changed` {ticket}, `ticket-gone` {id} (returned by a non-member handler), `drawer-close`.
 */
@customElement('ticket-detail')
export class TicketDetailView extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property() ticketId = '';
  @property({ reflect: true }) mode: 'drawer' | 'page' = 'drawer';
  @property({ type: Boolean }) open = false;
  /** D18: whether the drawer offers the full screen and the page offers the drawer */
  @property() detailMode: DetailMode = 'drawer_fullscreen';
  /** the list the page returns to and the drawer is opened over */
  @property() scope: TicketsRoute['scope'] = 'mine';
  /** the card's "ציר זמן" link: scroll to the timeline once loaded */
  @property({ type: Boolean }) focusTimeline = false;
  @state() private t: TicketDetail | null = null;
  @state() private failed = '';
  @state() private gone = false;
  @state() private busy = false;
  @state() private dialog: Dialog = null;
  @state() private flash: { text: string; tone: 'ok' | 'bad' } | null = null;
  @state() private composing = false;
  @state() private noteText = '';
  @state() private noteExternal = false;
  @state() private uploading = 0;
  // dialog fields
  @state() private dlgText = '';
  @state() private costGate: { canOverride: boolean } | null = null; // slice 9 (11A.3): the close met a pending required claim
  @state() private dlgOverride = '';
  @state() private dlgNumber = '';
  @state() private dlgError = '';
  @state() private dlgPick = '';
  @state() private dlgFlag = true;
  @state() private dlgReturnKind: 'cannot_handle' | 'not_mine' = 'cannot_handle';
  /** TKSTAFF2: the handlers of the assign dialog - account holders and staff contacts without an account, one list (assignee-model.ts) */
  @state() private eligible: Handler[] | null = null;
  @state() private deleting = false; // owner 14.10: the deletion dialog is open
  @state() private meta: Meta | null = null;
  @state() private edit: EditForm | null = null;
  private loadedFor = '';
  private flashTimer = 0;
  private offNames: (() => void) | null = null;
  // slice 4: sending outside from the assign dialog, and the link panel of the handler block
  private readonly ext = new ExternalAssign(this, { busy: () => this.busy, run: (fn, done) => this.run(fn, done) });
  private readonly linkPanel = new LinkPanel(this, {
    busy: () => this.busy, run: (fn, done) => this.run(fn, done || undefined), say: (m, tone) => this.say(m, tone), reload: () => void this.load(),
  });

  static styles = [bubbleChrome, ...automationsStyles, ticketDetailStyles, ticketFormStyles, externalAssignStyles, linkPanelStyles, deviceBlockStyles, css`
    sw-drawer {
      --sw-drawer-modal-w: 480px;
    }
    sw-dialog {
      --sw-surface: var(--dv-surface-solid);
      --sw-glass-blur: none;
    }
    .page {
      padding: 0 36px 44px;
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    .phead {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 16px;
      padding-block-start: 18px;
    }
    .phead h1 {
      margin: 0;
      font-size: var(--sw-fs-3xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.15;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .phead .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-inline-start: auto;
    }
    .pmeta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-md);
    }
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
      gap: 22px;
      align-items: start;
    }
    .cols > .stack {
      min-inline-size: 0;
    }
    .card {
      padding: 16px;
      border-radius: var(--sw-r-2xl);
    }
    .flash {
      position: sticky;
      inset-block-start: 0;
      z-index: 5;
    }
    @media (max-width: 1023px) {
      .cols {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    @media (max-width: 767px) {
      .page {
        padding: 0 16px 28px;
      }
      .phead h1 {
        font-size: var(--sw-fs-2xl);
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.offNames = onTicketNames(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.flashTimer);
    this.offNames?.();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('open') && !this.open && this.mode === 'drawer') this.loadedFor = ''; // a ticket opened again is read again
    if ((changed.has('ticketId') || changed.has('open')) && this.ticketId && (this.mode === 'page' || this.open) && this.loadedFor !== this.ticketId) {
      this.loadedFor = this.ticketId;
      this.t = null;
      this.failed = '';
      this.gone = false;
      this.dialog = null;
      this.composing = false;
      this.linkPanel.reset();
      void this.load();
    }
  }

  private async load(): Promise<void> {
    const id = this.ticketId;
    try {
      const t = await ticketsApi().get(id);
      if (id !== this.ticketId) return;
      this.t = t;
      if (this.focusTimeline) void this.updateComplete.then(() => this.renderRoot.querySelector('#timeline')?.scrollIntoView({ block: 'start' }));
    } catch (e) {
      if (id !== this.ticketId) return;
      if (e instanceof ApiError && e.status === 404) this.gone = true;
      else this.failed = describeError(e);
    }
  }

  private say(text: string, tone: 'ok' | 'bad' = 'ok'): void {
    this.flash = { text, tone };
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => (this.flash = null), tone === 'bad' ? 7000 : 3500);
  }

  /** One action against the API: the busy flag, the new ticket, the server's message on a refusal (a 409 reloads the ticket). */
  private async run(fn: () => Promise<TicketDetail | { view: 'none' }>, done?: string): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      const next = await fn();
      if ('view' in next && next.view === 'none') {
        this.dispatchEvent(new CustomEvent('ticket-gone', { detail: { id: this.ticketId }, bubbles: true, composed: true }));
        this.gone = true;
        this.t = null;
      } else {
        this.t = next as TicketDetail;
        this.dispatchEvent(new CustomEvent('ticket-changed', { detail: { ticket: this.t }, bubbles: true, composed: true }));
      }
      if (done) this.say(done);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'cost_claim_pending' && this.dialog?.kind === 'move') {
        const details = (e.body as { details?: { can_override?: boolean } }).details;
        this.costGate = { canOverride: !!details?.can_override };
        this.dlgError = describeError(e);
        return false;
      }
      this.say(describeError(e), 'bad');
      if (e instanceof ApiError && (e.status === 409 || e.status === 404)) void this.load();
      return false;
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- actions

  private move(to: TicketStatus): void {
    const t = this.t;
    if (!t) return;
    const m = moveTo(t, to);
    if (!m.allowed) return;
    if (to === 'closed' || to === 'cancelled' || (to === 'new' && t.status === 'closed') || m.noteRequired) {
      this.openDialog({ kind: 'move', to, noteRequired: m.noteRequired });
      return;
    }
    void this.run(() => ticketsApi().status(t.id, { to, revision: t.revision }), tt('saved'));
  }

  private openDialog(d: Exclude<Dialog, null>): void {
    this.dlgText = '';
    this.dlgNumber = '';
    this.dlgError = '';
    this.dlgPick = '';
    this.dlgFlag = true;
    this.dlgReturnKind = 'cannot_handle';
    this.costGate = null;
    this.dlgOverride = '';
    this.dialog = d;
    const t = this.t;
    if (!t) return;
    if (d.kind === 'assign') {
      this.eligible = null;
      this.ext.reset();
      void ticketsApi().assignees(t.department?.id ?? '', t.id).then((r) => { this.eligible = handlersOf(r); this.ext.take(r, t); }).catch((e) => { this.eligible = []; this.dlgError = describeError(e); });
    }
    if (d.kind === 'eta') this.dlgText = toLocalInput(t.eta_at);
    if (d.kind === 'edit') {
      this.edit = { title: t.title, description: t.description, department_id: t.department?.id ?? '', category_id: t.category?.id ?? '', priority_id: t.priority?.id ?? '' };
      if (!this.meta) void ticketsApi().meta().then((m) => (this.meta = m)).catch(() => undefined);
    }
  }

  private closeDialog(): void {
    this.dialog = null;
    this.edit = null;
  }

  /** A dialog closed (Escape, its close button): its `close` event must not reach the drawer around it - that would close the drawer too. */
  private onDialogClose = (e: Event) => {
    e.stopPropagation();
    this.closeDialog();
  };

  private async submitMove(to: TicketStatus, noteRequired: boolean): Promise<void> {
    const t = this.t;
    if (!t) return;
    const note = this.dlgText.trim();
    if ((noteRequired || to === 'cancelled') && !note) {
      this.dlgError = tt('required');
      return;
    }
    let duplicateOf: string | null = null;
    if (to === 'cancelled' && this.dlgNumber.trim()) {
      const n = Number(this.dlgNumber.trim().replace(/^#/, ''));
      const found = Number.isInteger(n) && n > 0 ? (await ticketsApi().list({ scope: 'visible', status: 'all', q: String(n), limit: 20 }).catch(() => null))?.items.find((x) => x.number === n) : undefined;
      if (!found || found.id === t.id) {
        this.dlgError = tt('duplicateNotFound');
        return;
      }
      duplicateOf = found.id;
    }
    const override = to === 'closed' && this.costGate?.canOverride ? this.dlgOverride.trim() : '';
    if (to === 'closed' && this.costGate?.canOverride && !override) {
      this.dlgError = tt('required');
      return;
    }
    const body = { to, note: note || null, duplicate_of: duplicateOf, revision: t.revision, ...(override ? { override_claim_reason: override } : {}) };
    if (await this.run(() => ticketsApi().status(t.id, body), tt('saved'))) this.closeDialog();
  }

  private async submitAssign(): Promise<void> {
    const t = this.t;
    if (t && this.ext.outside) { // slice 4: an outside contact / vendor
      if (await this.ext.submit(t, this.dlgText.trim(), this.dlgFlag)) this.closeDialog();
      return;
    }
    const h = this.pickedHandler();
    if (!t || !h) {
      this.dlgError = tt('required');
      return;
    }
    // TKSTAFF2: one submit for every handler - an account holder, or a staff contact (the server sends its personal link)
    const note = this.dlgText.trim();
    if (await this.run(() => ticketsApi().assign(t.id, { assignee: assigneeRef(h), note: note || null, note_external: this.dlgFlag, revision: t.revision }), tt('saved'))) this.closeDialog();
  }

  /** The handler picked in the dialog (its key), when it belongs to the group on show. */
  private pickedHandler(): Handler | null {
    return this.groupHandlers().find((h) => h.key === this.dlgPick) ?? null;
  }

  /** The handlers of the handler group on show: account holders, or staff contacts without an account. */
  private groupHandlers(): Handler[] {
    const staff = this.ext.kind === 'employee';
    return (this.eligible ?? []).filter((h) => h.account !== staff);
  }

  private async submitReturn(): Promise<void> {
    const t = this.t;
    if (!t) return;
    const reason = this.dlgText.trim();
    if (!reason) {
      this.dlgError = tt('required');
      return;
    }
    if (await this.run(() => ticketsApi().giveBack(t.id, { kind: this.dlgReturnKind, reason, revision: t.revision }), tt('saved'))) this.closeDialog();
  }

  private async submitEdit(): Promise<void> {
    const t = this.t;
    const e = this.edit;
    if (!t || !e) return;
    if (!e.title.trim()) {
      this.dlgError = tt('createNeed');
      return;
    }
    const can = new Set(t.can.edit_fields);
    const body: PatchBody = { revision: t.revision };
    if (can.has('title') && e.title.trim() !== t.title) body.title = e.title.trim();
    if (can.has('description') && e.description !== t.description) body.description = e.description;
    if (can.has('department_id') && e.department_id && e.department_id !== t.department?.id) body.department_id = e.department_id;
    if (can.has('category_id') && (e.category_id || null) !== (t.category?.id ?? null)) body.category_id = e.category_id || null;
    if (can.has('priority_id') && e.priority_id && e.priority_id !== t.priority?.id) body.priority_id = e.priority_id;
    if (Object.keys(body).length === 1) {
      this.closeDialog();
      return;
    }
    if (await this.run(() => ticketsApi().patch(t.id, body), tt('saved'))) this.closeDialog();
  }

  private async submitEta(clear: boolean): Promise<void> {
    const t = this.t;
    if (!t) return;
    const value = clear ? null : fromLocalInput(this.dlgText) || null;
    if (!clear && !value) {
      this.dlgError = tt('required');
      return;
    }
    if (await this.run(() => ticketsApi().eta(t.id, value), tt('saved'))) this.closeDialog();
  }

  private async sendNote(): Promise<void> {
    const t = this.t;
    const text = this.noteText.trim();
    if (!t || !text) return;
    if (await this.run(() => ticketsApi().note(t.id, text, this.noteExternal))) {
      this.noteText = '';
      this.composing = false;
    }
  }

  private async onFiles(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    const t = this.t;
    if (!t || !files.length) return;
    let failed = 0;
    for (const f of files) {
      this.uploading += 1;
      try {
        const next = await ticketsApi().upload(t.id, f, false);
        this.t = next;
      } catch (err) {
        failed += 1;
        this.say(describeError(err), 'bad');
      } finally {
        this.uploading -= 1;
      }
    }
    if (this.t) this.dispatchEvent(new CustomEvent('ticket-changed', { detail: { ticket: this.t }, bubbles: true, composed: true }));
    if (failed > 1) this.say(tt('photosFailed', { n: failed }), 'bad');
  }

  private removePhoto(attId: string): void {
    const t = this.t;
    if (!t) return;
    void this.run(() => ticketsApi().removePhoto(t.id, attId));
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('drawer-close', { bubbles: true, composed: true }));
  }

  /** Owner 14.10: the ticket was deleted - the drawer closes and the list refreshes (`ticket-gone`); the page returns to the list. */
  private onDeleted = (): void => {
    const id = this.ticketId;
    this.deleting = false;
    this.t = null;
    this.gone = true;
    this.dispatchEvent(new CustomEvent('ticket-gone', { detail: { id, deleted: true }, bubbles: true, composed: true }));
    if (this.mode !== 'page') this.close();
    if (this.mode === 'page') window.location.href = listHref(this.scope);
  };

  private deleteButton(t: TicketDetail, cls: string): TemplateResult | typeof nothing {
    if (!t.can.delete) return nothing;
    return html`<button type="button" class=${cls} data-delete-ticket ?disabled=${this.busy} @click=${() => (this.deleting = true)}>${tIcon('trash')}${dlt('action')}</button>`;
  }

  private deleteDialog(t: TicketDetail): TemplateResult | typeof nothing {
    if (!t.can.delete) return nothing;
    return html`<tickets-delete-dialog .targets=${[{ id: t.id, number: t.number }]} ?open=${this.deleting}
      @delete-close=${() => (this.deleting = false)} @ticket-deleted=${this.onDeleted}></tickets-delete-dialog>`;
  }

  // ---------------------------------------------------------------- render pieces

  private sentence(t: TicketDetail): TemplateResult {
    const meta = [`#${t.number}`, t.department?.name, t.category?.name, t.priority?.name].filter(Boolean).join(' · ');
    return html`<div class="sentence" data-sect="sentence">${tIcon('ticket')}<div>
      <span class="desc">${t.description || t.title}</span>
      <small>${bidi(meta)} · ${tt('openedBy', { when: shortDateTime(t.created_at), who: t.created_by.name })}</small>
      ${t.duplicate_of ? html`<small><a href=${this.hrefOf(t.duplicate_of.id)} data-duplicate-of>${tt('duplicateOfLine', { n: t.duplicate_of.number })}</a></small>` : nothing}
      ${t.close_note && FINAL.includes(t.status) ? html`<small data-close-note>${tt('closedNote', { note: t.close_note })}</small>` : nothing}
    </div></div>`;
  }

  private statusSection(t: TicketDetail): TemplateResult {
    const side = sideMoves(t);
    const shown = lineStatus(t.status);
    const onLine = (STATUS_LINE as readonly string[]).includes(shown);
    const toggle = waitingToggle(t);
    return html`<section class="sect" data-sect="status">
      <h4><span class="tag t3">${tIcon('check')}</span>${tt('sStatus')}<span class=${`chip ${statusTone(t.status)}`} data-current-status>${chipLabel(t.status)}</span></h4>
      ${onLine ? html`<div class="seg strip" role="group" aria-label=${tt('sStatus')} data-strip>
        ${STATUS_LINE.map((s) => {
          const m = moveTo(t, s);
          const current = s === shown;
          return html`<button type="button" aria-pressed=${String(current)} ?disabled=${current || !m.allowed || this.busy} data-move=${s} @click=${() => this.move(s)}>${statusLabel(s)}${current && isWaitingPart(t.status) ? html`<small class="sub" data-waiting-sub>${statusLabel('waiting_part')}</small>` : nothing}</button>`;
        })}
      </div>` : nothing}
      ${onLine && toggle ? html`<div class="side"><button type="button" class="btn sm quiet" data-waiting-toggle=${toggle.to === 'waiting_part' ? 'mark' : 'back'} ?disabled=${this.busy} @click=${() => this.move(toggle.to)}>${tIcon(toggle.to === 'waiting_part' ? 'clock' : 'refresh')}${toggle.label}</button></div>` : nothing}
      ${side.cancel || side.reopen || (t.reopen_until && t.status === 'closed') ? html`<div class="side">
        ${side.reopen ? html`<button type="button" class="btn sm" data-reopen ?disabled=${this.busy} @click=${() => this.move('new')}>${tIcon('refresh')}${tt('reopen')}</button>` : nothing}
        ${side.cancel ? html`<button type="button" class="btn sm quiet dz" data-cancel ?disabled=${this.busy} @click=${() => this.move('cancelled')}>${tIcon('x')}${tt('cancelTicket')}</button>` : nothing}
        ${t.reopen_until && t.status === 'closed' ? html`<span class="muted">${tt('reopenUntil', { when: shortDateTime(t.reopen_until) })}</span>` : nothing}
      </div>` : nothing}
    </section>`;
  }

  private assigneeSection(t: TicketDetail): TemplateResult {
    const a = t.assignee;
    const lastReturn = t.status === 'returned' ? t.assignments.find((x) => x.end_reason === 'returned') : undefined;
    return html`<section class="sect" data-sect="assignee">
      <h4><span class="tag">${tIcon('user')}</span>${tt('sAssignee')}<span class="sp"></span>
        ${t.can.assign ? html`<button type="button" class="btn sm" data-assign ?disabled=${this.busy} @click=${() => this.openDialog({ kind: 'assign' })}>${tIcon('user')}${a ? tt('reassign') : tt('assign')}</button>` : nothing}
      </h4>
      <div class="blk" data-assignee=${a?.id ?? ''}>
        <span class="bi">${tIcon(a ? 'user' : 'users')}</span>
        <div class="bt"><span class="who">${a ? bidi(a.name) : tt('noAssignee')}</span>
          ${a ? html`<small>${tt('assignedSince', { when: relTime(a.since) })}${a.acknowledged_at ? ` · ${tt('acknowledgedAt', { when: relTime(a.acknowledged_at) })}` : ''}</small>` : nothing}
          ${lastReturn?.return_reason ? html`<small data-return-reason>${tt('returnedBy', { reason: lastReturn.return_reason })}</small>` : nothing}
          ${t.eta_at ? html`<small data-eta>${tt('etaLine', { when: shortDateTime(t.eta_at) })}</small>` : nothing}
        </div>
        <div class="acts">
          ${t.can.eta ? html`<button type="button" class="btn sm quiet" data-eta-edit ?disabled=${this.busy} @click=${() => this.openDialog({ kind: 'eta' })}>${tIcon('clock')}${tt('etaSet')}</button>` : nothing}
          ${t.can.return ? html`<button type="button" class="btn sm quiet" data-return ?disabled=${this.busy} @click=${() => this.openDialog({ kind: 'return' })}>${tIcon('refresh')}${tt('giveBack')}</button>` : nothing}
        </div>
      </div>
      ${this.linkPanel.render(t)}
    </section>`;
  }

  /** slice 5b: the messages to the outside handler (D14 lines, "send now" D29, "send again", "send update") - tickets/ticket-messages.ts */
  private messagesSection(t: TicketDetail): TemplateResult | typeof nothing {
    return messagesBlock(t, { busy: this.busy, act: (fn, done) => void this.run(fn, done) });
  }

  private photosSection(t: TicketDetail): TemplateResult | typeof nothing {
    if (!t.attachments.length && !t.can.attach) return nothing;
    const marks = marksInternal(t);
    return html`<section class="sect" data-sect="photos">
      <h4><span class="tag">${tIcon('image')}</span>${tt('sPhotos')}<span class="cnt">${t.attachments.length || ''}</span></h4>
      <div class="photos">
        ${repeat(t.attachments, (a) => a.id, (a, i) => html`<figure class="ph" data-photo=${a.id} style="margin:0">
          <img src=${ticketsApi().photoUrl(a)} alt=${tt('photoAlt', { n: i + 1 })} loading="lazy" decoding="async" />
          ${marks && !a.external ? html`<span class="chip tag">${tIcon('lock')}${tt('internal')}</span>` : nothing}
          ${a.can_delete ? html`<button type="button" class="rm" aria-label=${tt('removePhoto')} data-photo-remove ?disabled=${this.busy} @click=${() => this.removePhoto(a.id)}>${tIcon('trash')}</button>` : nothing}
        </figure>`)}
        ${t.can.attach ? html`<label class="ph add" data-photo-add>${tIcon(this.uploading ? 'clock' : 'camera')}<span>${this.uploading ? tt('uploading') : tt('addPhoto')}</span>
          <input type="file" accept="image/jpeg,image/png" multiple ?disabled=${this.uploading > 0} aria-label=${tt('addPhoto')} @change=${this.onFiles} /></label>` : nothing}
      </div>
    </section>`;
  }

  private timelineSection(t: TicketDetail): TemplateResult {
    const marks = marksInternal(t);
    const rows = [...t.events].reverse();
    return html`<section class="sect" data-sect="timeline" id="timeline">
      <h4><span class="tag t1">${tIcon('clock')}</span>${tt('sTimeline')}<span class="cnt">${t.events.length}</span><span class="sp"></span>
        ${t.can.note && !this.composing ? html`<button type="button" class="btn sm" data-note-open @click=${() => { this.composing = true; void this.updateComplete.then(() => (this.renderRoot.querySelector('.composer textarea') as HTMLTextAreaElement | null)?.focus()); }}>${tIcon('note')}${tt('note')}</button>` : nothing}
      </h4>
      ${this.composing ? html`<div class="composer" data-composer>
        <textarea class="inp" maxlength="2000" aria-label=${tt('addNote')} placeholder=${tt('notePlaceholder')} .value=${this.noteText} @input=${(e: Event) => (this.noteText = (e.target as HTMLTextAreaElement).value)}></textarea>
        <div class="row">
          ${t.can.note_external && marks ? html`<label class="chk"><input type="checkbox" .checked=${this.noteExternal} @change=${(e: Event) => (this.noteExternal = (e.target as HTMLInputElement).checked)} />${tt('noteExternal')}</label>` : nothing}
          <span class="grow"></span>
          <button type="button" class="btn sm" @click=${() => { this.composing = false; this.noteText = ''; }}>${tt('cancel')}</button>
          <button type="button" class="btn sm primary" data-note-send ?disabled=${this.busy || !this.noteText.trim()} @click=${() => void this.sendNote()}>${tIcon('send')}${tt('send')}</button>
        </div>
      </div>` : nothing}
      <ol class="tline" data-timeline>
        ${repeat(rows, (e) => e.id, (e) => {
          const line = messageEventLine(e) ?? eventLine(e, t.department ? { [t.department.id]: t.department.name } : {});
          return html`<li data-kind=${e.kind} data-event=${e.id}>
            <span class="ring">${tIcon(line.icon)}</span>
            <div class="tx">
              <span class="meta">${shortDateTime(e.at)} · ${bidi(actorName(e))}${marks && !e.external && (e.kind === 'note' || e.kind === 'photo') ? html` · <b>${tt('internal')}</b>` : nothing}</span>
              <span class="line">${line.text}</span>
              ${e.body ? html`<div class="body">${e.body}</div>` : nothing}
            </div>
          </li>`;
        })}
      </ol>
    </section>`;
  }

  private flashRow(): TemplateResult | typeof nothing {
    if (!this.flash) return nothing;
    return html`<div class=${`banner flash ${this.flash.tone === 'bad' ? 'bad' : 'info'}`} role=${this.flash.tone === 'bad' ? 'alert' : 'status'} data-flash=${this.flash.tone}>${tIcon(this.flash.tone === 'bad' ? 'warning' : 'check')}<div>${this.flash.text}</div></div>`;
  }

  // ---------------------------------------------------------------- dialogs

  private dialogs(): TemplateResult | typeof nothing {
    const d = this.dialog;
    const t = this.t;
    if (!d || !t) return nothing;
    const err = this.dlgError ? html`<div class="err" role="alert" data-dialog-error>${this.dlgError}</div>` : nothing;
    const foot = (ok: TemplateResult) => html`<div slot="footer" class="sheetfoot">${ok}<button type="button" class="btn" data-dialog-cancel @click=${() => this.closeDialog()}>${tt('back')}</button></div>`;
    const text = (label: string, required: boolean) => html`<label class="fld"><span>${label}${required ? html` <b class="req">*</b>` : nothing}</span>
      <textarea class="inp" maxlength="2000" data-dialog-text .value=${this.dlgText} @input=${(e: Event) => { this.dlgText = (e.target as HTMLTextAreaElement).value; this.dlgError = ''; }}></textarea></label>`;
    if (d.kind === 'move') {
      const heading = d.to === 'closed' ? tt('closeTitle') : d.to === 'cancelled' ? tt('cancelTitle') : tt('reopenTitle');
      const label = d.to === 'closed' ? (d.noteRequired ? tt('closeReason') : tt('closeSummary')) : d.to === 'cancelled' ? tt('reason') : tt('reasonOptional');
      const ok = d.to === 'closed' ? tt('closeAction') : d.to === 'cancelled' ? tt('cancelTicket') : tt('reopen');
      return html`<sw-dialog open heading=${heading} data-dialog="move" data-to=${d.to} @close=${this.onDialogClose}>
        <div class="form">${text(label, d.noteRequired || d.to === 'cancelled')}
          ${d.to === 'closed' && this.costGate ? html`<div class="fld" data-cost-gate=${this.costGate.canOverride ? 'override' : 'blocked'}><b>${ct('gateTitle')}</b>
            ${this.costGate.canOverride ? html`<label class="fld"><span>${ct('gateOverride')} - ${ct('gateReason')} <b class="req">*</b></span>
              <textarea class="inp" maxlength="500" data-cost-override .value=${this.dlgOverride} @input=${(e: Event) => { this.dlgOverride = (e.target as HTMLTextAreaElement).value; this.dlgError = ''; }}></textarea></label>` : nothing}</div>` : nothing}
          ${d.to === 'cancelled' ? html`<label class="fld"><span>${tt('duplicateOf')}</span><input class="inp" inputmode="numeric" maxlength="12" data-dialog-number .value=${this.dlgNumber} @input=${(e: Event) => { this.dlgNumber = (e.target as HTMLInputElement).value; this.dlgError = ''; }} /></label>` : nothing}
          ${err}</div>
        ${foot(html`<button type="button" class=${`btn ${d.to === 'cancelled' ? 'danger' : 'primary'}`} data-dialog-ok ?disabled=${this.busy} @click=${() => void this.submitMove(d.to, d.noteRequired)}>${ok}</button>`)}
      </sw-dialog>`;
    }
    if (d.kind === 'assign') {
      // slice 4 + owner 2026-10-14: three groups always shown - handlers, employees without an account, vendors and contacts; a group
      // that cannot be used says why in one line with the link to its setting (tickets/external-assign.ts, tickets/readiness-model.ts)
      // TKSTAFF2: the two handler groups (with / without an account) are ONE picker and ONE submit over the `handlers` list
      const outside = this.ext.outside;
      const count = (staff: boolean) => (this.eligible === null ? null : this.eligible.filter((h) => h.account !== staff).length);
      const rows = this.groupHandlers();
      const groupWhy = this.eligible === null ? null : this.ext.blocked(t, this.ext.kind, rows.length);
      const picked = outside ? null : this.pickedHandler();
      return html`<sw-dialog open heading=${tt('assignTitle')} data-dialog="assign" @close=${this.onDialogClose}>
        <div class="form">
          ${this.ext.renderKinds(t, { user: count(false), employee: count(true) })}
          ${outside ? this.ext.renderPicker(t) : this.eligible === null ? html`<span class="skl" style="block-size:44px"></span>` : rows.length && !groupWhy
            ? html`<div class="pick" role="radiogroup" aria-label=${tt('fAssignee')}>${rows.map((h) => html`<label data-eligible=${h.id} data-handler=${h.key}>
                <input type="radio" name="asg" .checked=${this.dlgPick === h.key} @change=${() => { this.dlgPick = h.key; this.dlgError = ''; }} />${bidi(h.name)}
                ${h.member_role === 'manager' ? html`<small>${tt('depManager')}</small>` : nothing}</label>`)}</div>`
            : html`<div data-eligible-none>${groupWhy ? this.ext.reasonLine(groupWhy) : nothing}</div>`}
          ${text(tt('assignNote'), false)}
          ${outside || (picked && !picked.account) || marksInternal(t) ? html`<label class="chk"><input type="checkbox" .checked=${this.dlgFlag} @change=${(e: Event) => (this.dlgFlag = (e.target as HTMLInputElement).checked)} />${tt('noteExternal')}</label>` : nothing}
          ${err}</div>
        ${foot(html`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy || (outside ? !this.ext.ready() : !picked)} @click=${() => void this.submitAssign()}>${tIcon('user')}${tt('assign')}</button>`)}
      </sw-dialog>`;
    }
    if (d.kind === 'return') {
      return html`<sw-dialog open heading=${tt('returnTitle')} data-dialog="return" @close=${this.onDialogClose}>
        <div class="form">
          <div class="seg" role="radiogroup" aria-label=${tt('returnTitle')}>
            ${(['cannot_handle', 'not_mine'] as const).map((k) => html`<button type="button" role="radio" aria-checked=${String(this.dlgReturnKind === k)} data-return-kind=${k} @click=${() => (this.dlgReturnKind = k)}>${k === 'not_mine' ? tt('returnNotMine') : tt('returnCannot')}</button>`)}
          </div>
          ${text(tt('reason'), true)}
          ${err}</div>
        ${foot(html`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${() => void this.submitReturn()}>${tIcon('refresh')}${tt('giveBack')}</button>`)}
      </sw-dialog>`;
    }
    if (d.kind === 'eta') {
      return html`<sw-dialog open heading=${tt('etaTitle')} data-dialog="eta" @close=${this.onDialogClose}>
        <div class="form"><label class="fld"><span>${tt('etaSet')}</span><input class="inp" type="datetime-local" data-dialog-eta .value=${this.dlgText} @input=${(e: Event) => { this.dlgText = (e.target as HTMLInputElement).value; this.dlgError = ''; }} /></label>${err}</div>
        <div slot="footer" class="sheetfoot">
          <button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${() => void this.submitEta(false)}>${tt('save')}</button>
          ${t.eta_at ? html`<button type="button" class="btn" data-eta-clear ?disabled=${this.busy} @click=${() => void this.submitEta(true)}>${tt('etaClear')}</button>` : nothing}
          <button type="button" class="btn" data-dialog-cancel @click=${() => this.closeDialog()}>${tt('back')}</button>
        </div>
      </sw-dialog>`;
    }
    if (d.kind === 'edit' && this.edit) {
      const e = this.edit;
      const can = new Set(t.can.edit_fields);
      const depts = (this.meta?.departments ?? []).filter((x) => x.can_manage || x.id === t.department?.id);
      const dept = this.meta?.departments.find((x) => x.id === e.department_id);
      const set = (patch: Partial<EditForm>) => { this.edit = { ...e, ...patch }; this.dlgError = ''; };
      return html`<sw-dialog open wide heading=${tt('editTitle')} data-dialog="edit" @close=${this.onDialogClose}>
        <div class="form">
          <label class="fld"><span>${tt('fTitle')} <b class="req">*</b></span><input class="inp" maxlength="120" data-edit-title .value=${e.title} ?disabled=${!can.has('title')} @input=${(ev: Event) => set({ title: (ev.target as HTMLInputElement).value })} /></label>
          <label class="fld"><span>${tt('fDescription')}</span><textarea class="inp" maxlength="4000" data-edit-description .value=${e.description} ?disabled=${!can.has('description')} @input=${(ev: Event) => set({ description: (ev.target as HTMLTextAreaElement).value })}></textarea></label>
          ${can.has('department_id') || can.has('category_id') || can.has('priority_id') ? html`<div class="two">
            ${can.has('department_id') && depts.length > 1 ? html`<label class="fld"><span>${tt('fDepartment')}</span><select class="inp" data-edit-department @change=${(ev: Event) => set({ department_id: (ev.target as HTMLSelectElement).value, category_id: '', priority_id: '' })}>${depts.map((x) => html`<option value=${x.id} ?selected=${x.id === e.department_id}>${x.name}</option>`)}</select></label>` : nothing}
            ${can.has('category_id') && dept ? html`<label class="fld"><span>${tt('fCategory')}</span><select class="inp" data-edit-category @change=${(ev: Event) => set({ category_id: (ev.target as HTMLSelectElement).value })}><option value="" ?selected=${!e.category_id}>${tt('fNoCategory')}</option>${dept.categories.map((c) => html`<option value=${c.id} ?selected=${c.id === e.category_id}>${c.name}</option>`)}</select></label>` : nothing}
          </div>` : nothing}
          ${can.has('priority_id') && dept ? html`<div class="fld"><span>${tt('fPriority')}</span><div class="prio" role="radiogroup" aria-label=${tt('fPriority')}>${dept.priorities.map((p) => html`<button type="button" class="rc" role="radio" aria-checked=${String(p.id === e.priority_id)} data-edit-priority=${p.key} @click=${() => set({ priority_id: p.id })}><i class=${`dot ${priorityTone(p) === 'bad' ? 'bad' : priorityTone(p) === 'info' ? 'run' : ''}`}></i>${p.name}</button>`)}</div></div>` : nothing}
          ${err}</div>
        ${foot(html`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${() => void this.submitEdit()}>${tIcon('check')}${tt('save')}</button>`)}
      </sw-dialog>`;
    }
    return nothing;
  }

  // ---------------------------------------------------------------- the two hosts

  private hrefOf(id: string): string {
    return this.detailMode === 'fullscreen' || this.mode === 'page' ? ticketHref(id) : listHref(this.scope, undefined, { t: id });
  }

  private body(t: TicketDetail): TemplateResult {
    return html`<div class="stack" data-ticket-detail=${t.id} data-view=${t.view}>
      ${this.flashRow()}
      ${this.sentence(t)}
      ${this.statusSection(t)}
      ${codeLockSection(t, { busy: this.busy, onNew: () => void this.run(() => sendNewLink(t.id), lockText('done')) })}
      ${this.assigneeSection(t)}
      <ticket-cost-card .ticket=${t} @cost-changed=${() => void this.load()}></ticket-cost-card>
      ${this.messagesSection(t)}
      ${this.photosSection(t)}
      ${historySection(t.device_context)}
      ${this.timelineSection(t)}
    </div>`;
  }

  private stateBox(): TemplateResult {
    if (this.gone) return html`<div class="statebox glass" role="status" data-ticket-state="gone"><span class="ring">${tIcon('ticket')}</span><b>${tt('notFound')}</b></div>`;
    if (this.failed) return html`<div class="statebox glass" role="status" data-ticket-state="error"><span class="ring">${tIcon('warning')}</span><b>${this.failed}</b><button type="button" class="btn sm" @click=${() => { this.failed = ''; void this.load(); }}>${tIcon('refresh')}${tt('retry')}</button></div>`;
    return html`<div class="stack" data-ticket-state="loading" aria-busy="true"><span class="skl" style="block-size:96px"></span><span class="skl" style="block-size:44px"></span><span class="skl" style="block-size:64px"></span><span class="skl" style="block-size:160px"></span></div>`;
  }

  private drawer(): TemplateResult {
    const t = this.t;
    const sub = t ? [`#${t.number}`, chipLabel(t.status), t.priority?.name].filter(Boolean).join(' · ') : '';
    const footer = t && (t.can.edit_fields.length || this.detailMode === 'drawer_fullscreen' || t.can.delete);
    return html`<sw-drawer modal .open=${this.open} heading=${t?.title ?? ''} subheading=${sub} data-ticket-drawer @close=${(e: Event) => { if (e.target === e.currentTarget) this.close(); }}>
      ${t && this.detailMode === 'drawer_fullscreen' ? html`<a slot="action" class="btn sm quiet" href=${ticketHref(t.id)} data-full-screen aria-label=${tt('fullScreen')}>${tIcon('expand')}</a>` : nothing}
      ${t ? this.body(t) : this.stateBox()}
      ${footer && t ? html`<div slot="footer" class="foot2">
        ${t.can.edit_fields.length ? html`<button type="button" class="btn sm" data-edit ?disabled=${this.busy} @click=${() => this.openDialog({ kind: 'edit' })}>${tIcon('edit')}${tt('edit')}</button>` : nothing}
        ${this.deleteButton(t, 'btn sm quiet dz')}
      </div>` : nothing}
      ${this.dialogs()}
      ${t ? this.deleteDialog(t) : nothing}
    </sw-drawer>`;
  }

  private page(): TemplateResult {
    const t = this.t;
    if (!t) return html`<div class="page"><div class="phead"><a class="rb sm" href=${listHref(this.scope)} aria-label=${tt('toList')} data-back>${tIcon('back')}</a></div>${this.stateBox()}</div>`;
    const meta = [`#${t.number}`, t.department?.name, t.category?.name, t.priority?.name].filter(Boolean).join(' · ');
    return html`<div class="page" data-ticket-page=${t.id}>
      <div class="phead">
        <a class="rb sm" href=${listHref(this.scope)} aria-label=${tt('toList')} data-back>${tIcon('back')}</a>
        <h1 data-ticket-title>${t.title}</h1>
        <span class=${`chip ${statusTone(t.status)}`}>${chipLabel(t.status)}</span>
        <div class="acts">
          ${t.can.assign ? html`<button type="button" class="btn primary" data-assign-top ?disabled=${this.busy} @click=${() => this.openDialog({ kind: 'assign' })}>${tIcon('user')}${t.assignee ? tt('reassign') : tt('assign')}</button>` : nothing}
          ${t.can.note ? html`<button type="button" class="btn" @click=${() => { this.composing = true; this.renderRoot.querySelector('#timeline')?.scrollIntoView({ block: 'start' }); }}>${tIcon('note')}${tt('note')}</button>` : nothing}
          ${t.can.edit_fields.length ? html`<button type="button" class="btn" data-edit ?disabled=${this.busy} @click=${() => this.openDialog({ kind: 'edit' })}>${tIcon('edit')}${tt('edit')}</button>` : nothing}
          ${this.detailMode === 'drawer_fullscreen' ? html`<a class="btn" href=${listHref(this.scope, undefined, { t: t.id })} data-to-drawer>${tIcon('shrink')}${tt('toDrawer')}</a>` : nothing}
          ${this.deleteButton(t, 'btn quiet dz')}
        </div>
      </div>
      <div class="pmeta">${tIcon('layers')}${bidi(meta)}</div>
      ${this.flashRow()}
      <div class="cols">
        <div class="stack">${this.sentence(t)}${this.statusSection(t)}<div class="glass card">${this.timelineSection(t)}</div></div>
        <div class="stack">${this.assigneeSection(t)}${this.messagesSection(t)}${this.photosSection(t)}${historySection(t.device_context)}</div>
      </div>
      ${this.dialogs()}
      ${this.deleteDialog(t)}
    </div>`;
  }

  render() {
    return this.mode === 'page' ? this.page() : this.drawer();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-detail': TicketDetailView;
  }
}
