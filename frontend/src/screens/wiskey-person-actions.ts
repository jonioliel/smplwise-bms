import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-field';
import '../components/sw-icon';
import './wiskey-card-capture';
import { ApiError } from '../api/client';
import { getAcPerson, type AcPerson } from '../api/access-people';
import {
  deleteIntercomPerson,
  getIntercomEditorContext,
  getIntercomPersonForEdit,
  type DisplayZone,
  type IntercomEditorContext,
  type IntercomEditorPerson,
} from '../api/intercom';
import {
  TEMPORARY_CANCEL_REASONS,
  addPersonCard,
  archivePerson,
  cancelTemporaryAccess,
  removePersonCard,
  setPersonActive,
  setPersonPhoto,
  unarchivePerson,
  type PersonWriteReply,
  type TemporaryCancelReason,
} from '../api/access-writes';
import {
  PENDING_CHECKS,
  PENDING_CHECK_MS,
  PHOTO_QUALITIES,
  deleteSettled,
  failureOf,
  fitSize,
  photoFits,
  stateOfReply,
  validCardNumber,
  type PersonAction,
  type WriteState,
} from '../access-control/people-writes-logic';
import { formatClock } from '../access-control/people-logic';
import { wt, type WritesKey } from '../i18n/access-writes';
import { UTC_ZONE } from './wiskey-format';

export type ActionKind = PersonAction | 'menu';

/** What happened, for the page (the list refetches, the person's page reloads, the result line under its header). */
export interface ActionResult {
  kind: PersonAction;
  id: string;
  state: WriteState | 'deleted';
  text: string;
  person: IntercomEditorPerson | null;
}

type Step = 'ask' | 'working' | 'done' | 'checking';

const TITLES: Record<PersonAction, WritesKey> = {
  edit: 'act.edit', deactivate: 'act.deactivate', activate: 'act.activate', temporary_cancel: 'act.temporary_cancel', cards: 'act.cards', photo: 'act.photo',
  archive: 'act.archive', restore: 'act.restore', delete: 'act.delete',
};
const QUESTIONS: Partial<Record<PersonAction, WritesKey>> = {
  deactivate: 'confirm.deactivate', activate: 'confirm.activate', temporary_cancel: 'confirm.temporary_cancel', archive: 'confirm.archive', restore: 'confirm.restore',
  delete: 'confirm.delete',
};
const ICONS: Partial<Record<PersonAction, string>> = {
  deactivate: 'lock', activate: 'check', temporary_cancel: 'clock', cards: 'grid', photo: 'image', archive: 'storage', restore: 'refresh', delete: 'trash',
};

/** The facts of a failed write for people-writes-logic `failureOf`. */
function facts(err: unknown): { status: number | null; code: string | null; outcome: string | null } {
  if (err instanceof ApiError) {
    const outcome = err.body?.details?.outcome;
    return { status: err.status, code: err.code, outcome: typeof outcome === 'string' ? outcome : null };
  }
  return { status: null, code: null, outcome: null };
}

/** A picture file as WisKey's JPEG data URL: drawn at most 512 x 512 (the aspect kept), then the best JPEG quality that fits 32 KB;
 * smaller again when even the lowest quality does not fit. Throws 'not_image' / 'too_big'. Nothing leaves the browser here. */
async function toJpeg(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not_image');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('not_image'));
      el.src = url;
    });
    let max = 512;
    for (let round = 0; round < 4; round++, max = Math.round(max * 0.75)) {
      const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, max);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('not_image');
      ctx.fillStyle = '#ffffff'; // a JPEG has no transparency: a transparent picture is put on white, never on black
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      for (const quality of PHOTO_QUALITIES) {
        const data = canvas.toDataURL('image/jpeg', quality);
        if (photoFits(data)) return data;
      }
    }
    throw new Error('too_big');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * CR-036 S11: the actions of a person's page on the native people screen - one dialog for the menu and each action: switch the
 * person's access off / on, end a visitor's or contractor's access, archive / restore, delete, the cards (a card by number in or
 * out, reading one at a station) and the photo. Every write is ONE typed Arx request (api/access-writes.ts; the editor's delete),
 * sent once per confirmation and never again by itself: an answer that is not clearly a success says "not sent", "not done" or
 * "unknown - reload before trying again", never "done". A delete is sent and PENDING until the person's page is gone from the read
 * model (checked a few times, then "check again"). The server decides who may do what on which person; the dialog only offers what
 * the page said the caller may (`personActions`). Operator copy: a title, one line, the buttons.
 *
 * Events: `action-result` (ActionResult), `close`.
 */
@customElement('wiskey-person-actions')
export class WiskeyPersonActions extends LitElement {
  @property({ attribute: false }) person: AcPerson | null = null;
  @property() kind: ActionKind = 'menu';
  /** The actions the page offers (people-writes-logic `personActions`), for the menu. */
  @property({ attribute: false }) actions: PersonAction[] = [];
  /** The caller may read a card at a station (access.cards.capture somewhere). */
  @property({ type: Boolean }) canCapture = false;
  @property({ attribute: false }) zone: DisplayZone = UTC_ZONE;

  @state() private current: ActionKind = 'menu';
  @state() private step: Step = 'ask';
  @state() private result: { state: WriteState | 'deleted'; text: string } | null = null;
  @state() private reason: TemporaryCancelReason = 'visit_completed';
  // cards and photo work on the editor projection (the masked cards, the revision, the caller's field level)
  @state() private editor: IntercomEditorPerson | null = null;
  @state() private editorError = '';
  @state() private cardNo = '';
  @state() private cardLabel = '';
  @state() private cardProblem = false;
  @state() private removing: string | null = null;
  @state() private ctx: IntercomEditorContext | null = null;
  @state() private capturing = false;
  @state() private photo: { phase: 'idle' | 'processing' | 'ready' | 'error'; data: string; problem: WritesKey | null } = { phase: 'idle', data: '', problem: null };
  @state() private photoRemove = false;
  private checks = 0;
  private checkTimer = 0;
  private generation = 0;

  connectedCallback() {
    super.connectedCallback();
    this.current = this.kind;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.checkTimer);
    this.generation++;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('kind')) this.select(this.kind);
  }

  private select(kind: ActionKind) {
    this.current = kind;
    this.step = 'ask';
    this.result = null;
    if (kind === 'cards' || kind === 'photo') void this.loadEditor();
  }

  private fire(result: ActionResult) {
    this.dispatchEvent(new CustomEvent<ActionResult>('action-result', { detail: result, bubbles: true, composed: true }));
  }

  private close() {
    if (this.step === 'working') return;
    window.clearTimeout(this.checkTimer);
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private async loadEditor() {
    const p = this.person;
    if (!p) return;
    const generation = ++this.generation;
    this.editor = null;
    this.editorError = '';
    try {
      const [r, ctx] = await Promise.all([getIntercomPersonForEdit(p.id), this.current === 'cards' && this.canCapture ? getIntercomEditorContext().catch(() => null) : Promise.resolve(null)]);
      if (generation !== this.generation) return;
      this.editor = r.person;
      if (!r.person) this.editorError = wt('err.unavailable');
      this.ctx = ctx?.context ?? null;
    } catch (err) {
      if (generation !== this.generation) return;
      this.editorError = wt(failureOf(facts(err)).reason);
    }
  }

  // ------------------------------------------------------------------ the writes

  private revision(): number {
    return this.editor?.revision ?? this.person?.revision ?? 0;
  }

  /** One write, sent once. The reply's effect decides "saved" / "pending"; a failure reads by its code. */
  private async write(kind: PersonAction, send: () => Promise<PersonWriteReply | { pending?: boolean; effect?: string }>) {
    const p = this.person;
    if (!p || this.step === 'working') return;
    this.step = 'working';
    this.result = null;
    try {
      const reply = await send();
      const state = stateOfReply(reply);
      const person = 'person' in reply ? (reply.person as IntercomEditorPerson | null) : null;
      if (person) this.editor = person;
      if (kind === 'delete' && state === 'pending') {
        this.result = { state: 'pending', text: wt('res.pending') };
        this.step = 'checking';
        this.checks = 0;
        this.fire({ kind, id: p.id, state: 'pending', text: this.result.text, person: null });
        this.scheduleCheck(p.id);
        return;
      }
      const text = state === 'pending' ? wt('res.pending') : wt('res.saved', { time: formatClock(new Date().toISOString(), this.zone) });
      this.result = { state, text };
      this.step = 'done';
      this.fire({ kind, id: p.id, state, text, person });
    } catch (err) {
      const f = failureOf(facts(err));
      const text = f.state === 'unknown' ? wt('res.unknown') : wt(f.state === 'not_sent' ? 'res.not_sent' : 'res.refused', { reason: wt(f.reason) });
      this.result = { state: f.state, text };
      this.step = 'done';
      this.fire({ kind, id: p.id, state: f.state, text, person: null });
    }
  }

  /** The delete's confirmation by the read model: the person's page no longer found. A few checks, then "check again". */
  private scheduleCheck(id: string) {
    window.clearTimeout(this.checkTimer);
    this.checkTimer = window.setTimeout(() => void this.check(id), PENDING_CHECK_MS);
  }

  private async check(id: string) {
    let status = 200;
    try {
      await getAcPerson(id);
    } catch (err) {
      status = err instanceof ApiError ? err.status : 0;
    }
    if (!this.isConnected) return;
    if (deleteSettled(status) === 'confirmed') {
      this.result = { state: 'deleted', text: wt('res.deleted') };
      this.step = 'done';
      this.fire({ kind: 'delete', id, state: 'deleted', text: this.result.text, person: null });
      return;
    }
    this.checks++;
    if (this.checks < PENDING_CHECKS) this.scheduleCheck(id);
    else this.result = { state: 'pending', text: wt('res.still_pending') };
  }

  private confirm() {
    const p = this.person;
    if (!p) return;
    const rev = this.revision();
    switch (this.current) {
      case 'deactivate': return void this.write('deactivate', () => setPersonActive(p.id, rev, false));
      case 'activate': return void this.write('activate', () => setPersonActive(p.id, rev, true));
      case 'archive': return void this.write('archive', () => archivePerson(p.id, rev));
      case 'restore': return void this.write('restore', () => unarchivePerson(p.id, rev));
      case 'temporary_cancel': return void this.write('temporary_cancel', () => cancelTemporaryAccess(p.id, rev, this.reason));
      case 'delete': return void this.write('delete', () => deleteIntercomPerson(p.id, rev));
      default:
    }
  }

  private addCard() {
    const p = this.person;
    if (!p || !this.editor) return;
    if (!validCardNumber(this.cardNo)) {
      this.cardProblem = true;
      return;
    }
    const card = { card_no: this.cardNo.trim(), label: this.cardLabel.trim(), enabled: true };
    void this.write('cards', () => addPersonCard(p.id, this.revision(), card)).then(() => {
      if (this.result?.state === 'saved' || this.result?.state === 'pending') {
        this.cardNo = ''; // the typed number leaves the form with the request
        this.cardLabel = '';
      }
    });
  }

  private removeCard(cardId: string) {
    const p = this.person;
    if (!p) return;
    this.removing = null;
    void this.write('cards', () => removePersonCard(p.id, this.revision(), cardId));
  }

  private async pickPhoto(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.photo = { phase: 'processing', data: '', problem: null };
    try {
      const data = await toJpeg(file);
      this.photo = { phase: 'ready', data, problem: null };
    } catch (err) {
      this.photo = { phase: 'error', data: '', problem: (err as Error).message === 'too_big' ? 'photo.too_big' : 'photo.not_image' };
    }
  }

  private savePhoto(remove: boolean) {
    const p = this.person;
    if (!p) return;
    const data = remove ? null : this.photo.data;
    if (!remove && !data) return;
    this.photoRemove = false;
    void this.write('photo', () => setPersonPhoto(p.id, this.revision(), data)).then(() => {
      if (this.result?.state === 'saved' || this.result?.state === 'pending') this.photo = { phase: 'idle', data: '', problem: null };
    });
  }

  private captured() {
    this.capturing = false;
    // UNKNOWN_EFFECT: the card capture's confirm is sent; the read model (the person read again) is what says the card is there
    const before = this.editor?.cards?.length ?? 0;
    const p = this.person;
    if (!p) return;
    this.result = { state: 'pending', text: wt('res.pending') };
    void getIntercomPersonForEdit(p.id).then((r) => {
      if (!r.person) return;
      this.editor = r.person;
      const added = (r.person.cards?.length ?? 0) > before;
      this.result = added ? { state: 'saved', text: wt('res.saved', { time: formatClock(new Date().toISOString(), this.zone) }) } : { state: 'pending', text: wt('res.still_pending') };
      this.fire({ kind: 'cards', id: p.id, state: this.result.state, text: this.result.text, person: r.person });
    }).catch(() => undefined);
  }

  // ------------------------------------------------------------------ render

  render() {
    const p = this.person;
    if (!p) return nothing;
    const kind = this.current;
    const heading = kind === 'menu' ? wt('actions.heading') : wt(TITLES[kind]);
    return html`<sw-dialog open heading=${heading} subheading=${p.display_name} ?locked=${this.step === 'working'} data-person-actions=${kind} data-person-actions-step=${this.step}
        @close=${(e: Event) => { e.stopPropagation(); this.close(); }}>
        ${kind === 'menu' ? this.renderMenu() : kind === 'cards' ? this.renderCards() : kind === 'photo' ? this.renderPhoto() : this.renderAsk(kind)}
        ${this.result ? html`<p class="result ${this.result.state}" role="status" data-action-result=${this.result.state}>${this.result.text}</p>` : nothing}
        <div slot="footer" class="footer">${this.renderFooter(kind)}</div>
      </sw-dialog>
      ${this.capturing && this.editor && this.ctx
        ? html`<wiskey-card-capture .person=${this.editor} .stations=${this.ctx.stations.filter((s) => (this.ctx?.capture_stations ?? []).includes(s.id))}
            @capture-close=${() => (this.capturing = false)} @capture-saved=${() => this.captured()} @capture-reload=${() => { this.capturing = false; void this.loadEditor(); }}></wiskey-card-capture>`
        : nothing}`;
  }

  private renderMenu(): TemplateResult {
    const items = this.actions.filter((a) => a !== 'edit');
    return html`<div class="menu">
      ${items.map((a) => html`<button type="button" class="item ${a === 'delete' ? 'danger' : ''}" data-person-action=${a} @click=${() => this.select(a)}>
        <sw-icon name=${(ICONS[a] ?? 'chevron') as 'lock'} size=${18}></sw-icon><span>${wt(TITLES[a])}</span></button>`)}
    </div>`;
  }

  private renderAsk(kind: PersonAction): TemplateResult {
    const p = this.person!;
    const question = QUESTIONS[kind];
    return html`${question && this.step === 'ask' ? html`<p class="ask" data-action-question>${wt(question, { name: p.display_name })}</p>` : nothing}
      ${kind === 'temporary_cancel' && this.step === 'ask'
        ? html`<sw-field label=${wt('reason.label')}>
            <select data-action-reason .value=${live(this.reason)} @change=${(e: Event) => (this.reason = (e.target as HTMLSelectElement).value as TemporaryCancelReason)}>
              ${TEMPORARY_CANCEL_REASONS.map((r) => html`<option value=${r} ?selected=${r === this.reason}>${wt(`reason.${r}` as WritesKey)}</option>`)}
            </select>
          </sw-field>`
        : nothing}`;
  }

  private renderCards(): TemplateResult {
    const e = this.editor;
    if (this.editorError) return html`<p class="result refused" role="status" data-cards-error>${this.editorError}</p>`;
    if (!e) return html`<p class="muted" role="status" data-cards-loading>${wt('cards.loading')}</p>`;
    const cards = e.cards ?? [];
    return html`<ul class="cards" data-person-cards>
        ${cards.length === 0 ? html`<li class="muted" data-cards-none>${wt('cards.none')}</li>` : nothing}
        ${cards.map((c) => html`<li class="card" data-person-card=${c.id}>
          <bdi class="mask" dir="ltr">${c.masked_number}</bdi>
          <span class="label">${c.label}</span>
          ${c.enabled ? nothing : html`<span class="muted">${wt('cards.disabled')}</span>`}
          ${this.removing === c.id
            ? html`<span class="inline-ask"><span>${wt('confirm.remove_card', { mask: c.masked_number })}</span>
                <sw-button size="sm" variant="danger" data-card-remove-confirm ?disabled=${this.step === 'working'} @click=${() => this.removeCard(c.id)}>${wt('btn.remove')}</sw-button>
                <sw-button size="sm" variant="ghost" @click=${() => (this.removing = null)}>${wt('btn.cancel')}</sw-button></span>`
            : html`<sw-button size="sm" variant="ghost" icon="trash" data-card-remove ?disabled=${this.step === 'working'} @click=${() => (this.removing = c.id)}>${wt('btn.remove')}</sw-button>`}
        </li>`)}
      </ul>
      <div class="add" data-card-add-form>
        <sw-field label=${wt('cards.number')} hint=${this.cardProblem ? wt('err.card_invalid') : ''}>
          <input data-card-number dir="ltr" autocomplete="off" maxlength="32" .value=${live(this.cardNo)} aria-invalid=${this.cardProblem ? 'true' : 'false'}
            @input=${(ev: Event) => { this.cardNo = (ev.target as HTMLInputElement).value; this.cardProblem = false; }} />
        </sw-field>
        <sw-field label=${wt('cards.label')}>
          <input data-card-label maxlength="64" .value=${live(this.cardLabel)} @input=${(ev: Event) => (this.cardLabel = (ev.target as HTMLInputElement).value)} />
        </sw-field>
      </div>`;
  }

  private renderPhoto(): TemplateResult {
    const e = this.editor;
    if (this.editorError) return html`<p class="result refused" role="status" data-photo-error>${this.editorError}</p>`;
    const ph = this.photo;
    return html`<div class="photo" data-person-photo-form>
      <div class="frame" aria-label=${wt('photo.preview')}>${ph.phase === 'ready' ? html`<img src=${ph.data} alt=${wt('photo.preview')} data-photo-preview />` : html`<sw-icon name="user" size=${40}></sw-icon>`}</div>
      <div class="col">
        <label class="pick">
          <input type="file" accept="image/*" data-photo-input @change=${(ev: Event) => void this.pickPhoto(ev)} ?disabled=${this.step === 'working'} />
          <span>${wt('btn.choose_photo')}</span>
        </label>
        ${ph.phase === 'processing' ? html`<span class="muted" role="status">${wt('photo.processing')}</span>` : nothing}
        ${ph.phase === 'error' && ph.problem ? html`<span class="result refused" role="status" data-photo-problem=${ph.problem}>${wt(ph.problem)}</span>` : nothing}
        ${e && e.photo_configured === false && ph.phase !== 'ready' ? html`<span class="muted">${wt('photo.none')}</span>` : nothing}
        ${this.photoRemove ? html`<span class="ask">${wt('confirm.remove_photo', { name: this.person?.display_name ?? '' })}</span>` : nothing}
      </div>
    </div>`;
  }

  private renderFooter(kind: ActionKind): TemplateResult {
    const working = this.step === 'working';
    const close = html`<sw-button variant="ghost" data-action-close ?disabled=${working} @click=${() => this.close()}>${wt(this.result ? 'btn.close' : 'btn.cancel')}</sw-button>`;
    if (kind === 'menu') return close;
    if (kind === 'cards') {
      const capture = this.canCapture && (this.ctx?.capture_stations?.length ?? 0) > 0
        ? html`<sw-button icon="wifi" data-card-read ?disabled=${working || !this.editor} @click=${() => (this.capturing = true)}>${wt('btn.read_card')}</sw-button>`
        : nothing;
      return html`${close}${capture}<sw-button variant="primary" icon="plus" data-card-add ?disabled=${working || !this.editor || !this.cardNo.trim()} @click=${() => this.addCard()}>${working ? wt('btn.working') : wt('btn.add_card')}</sw-button>`;
    }
    if (kind === 'photo') {
      const e = this.editor;
      const remove = e?.photo_configured
        ? this.photoRemove
          ? html`<sw-button variant="danger" data-photo-remove-confirm ?disabled=${working} @click=${() => this.savePhoto(true)}>${wt('btn.remove_photo')}</sw-button>`
          : html`<sw-button variant="ghost" icon="trash" data-photo-remove ?disabled=${working} @click=${() => (this.photoRemove = true)}>${wt('btn.remove_photo')}</sw-button>`
        : nothing;
      return html`${close}${remove}<sw-button variant="primary" icon="check" data-photo-save ?disabled=${working || this.photo.phase !== 'ready'} @click=${() => this.savePhoto(false)}>${working ? wt('btn.working') : wt('btn.save_photo')}</sw-button>`;
    }
    if (this.step === 'ask') {
      return html`${close}<sw-button variant=${kind === 'delete' || kind === 'archive' || kind === 'deactivate' || kind === 'temporary_cancel' ? 'danger' : 'primary'} data-action-confirm
        @click=${() => this.confirm()}>${wt('btn.confirm')}</sw-button>`;
    }
    if (this.step === 'checking' || (kind === 'delete' && this.result?.state === 'pending')) {
      const id = this.person?.id ?? '';
      return html`${close}<sw-button variant="ghost" icon="refresh" data-action-check ?disabled=${this.step === 'checking' && this.checks < PENDING_CHECKS} @click=${() => { this.checks = 0; void this.check(id); }}>${wt('btn.check')}</sw-button>`;
    }
    return working ? html`<sw-button variant="primary" disabled>${wt('btn.working')}</sw-button>` : close;
  }

  static styles = css`
    .menu {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 46px;
      padding-inline: 14px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      text-align: start;
      cursor: pointer;
      /* R5-SECURITY: the menu items are raised keys (shadow 1) that sink on pointer-down; a hover only under a fine pointer */
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    @media (hover: hover) and (pointer: fine) {
      .item:hover {
        background: var(--sw-surface-2);
      }
    }
    .item:active {
      transform: scale(var(--sw-press-scale));
    }
    .item.danger {
      background: var(--sw-danger-soft);
    }
    .item:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .item.danger {
      color: var(--sw-danger-text);
    }
    .ask {
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .result {
      margin: 0;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .result.saved,
    .result.deleted {
      background: var(--sw-success-soft);
      color: var(--sw-text);
    }
    .result.pending,
    .result.unknown {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .result.refused,
    .result.not_sent {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .cards {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .card {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      padding: 8px 12px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      min-block-size: 44px;
    }
    .card .mask {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
      font-variant-numeric: tabular-nums;
      color: var(--sw-heading, var(--sw-text));
      direction: ltr;
      unicode-bidi: isolate;
    }
    .card .label {
      flex: 1 1 6rem;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .inline-ask {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      flex-basis: 100%;
      font-size: var(--sw-fs-sm);
    }
    .add {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 10px;
    }
    @media (max-width: 480px) {
      .add {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    input,
    select {
      font: inherit;
      min-block-size: 44px;
      box-sizing: border-box;
      inline-size: 100%;
    }
    .photo {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .frame {
      display: grid;
      place-items: center;
      inline-size: 96px;
      block-size: 96px;
      flex-shrink: 0;
      border-radius: 50%;
      overflow: hidden;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      border: 2px solid var(--sw-border);
    }
    .frame img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
      flex: 1 1 10rem;
    }
    .pick {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-block-size: 44px;
      padding-inline: 14px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      position: relative;
    }
    .pick input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
      min-block-size: 0;
    }
    .pick:focus-within {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    sw-button {
      min-block-size: 44px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-person-actions': WiskeyPersonActions;
  }
}
