import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-drawer';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-toggle';
import './nvr-confirm';
import { nvrSettings, type EncodingField, type NvrCamera, type StreamChange, type StreamEncoding, type StreamOptions } from '../api/nvr-settings';
import { ROLE_HE } from './nvr-cameras-logic';
import { runUndo, runWrite, type ActionResult } from './nvr-cameras-actions';
import {
  FIELD_HE,
  STATUS_HE,
  changeFields,
  confirmModel,
  diffDraft,
  draftOf,
  errorLine,
  fieldName,
  invalidFields,
  lastChanges,
  lockedBy,
  reconcile,
  shownFields,
  undoable,
  type ConfirmModel,
  type Draft,
} from './nvr-cameras-edit';
import type { EncodingChanges } from '../api/nvr-settings';

/** The editor's line when "שמור" cannot open the confirmation: the press always answers (owner report 2026-10-04: "nothing happens"). */
export const SAVE_LINE = {
  gone: 'הזרם אינו זמין כרגע. סגרו את החלונית ופתחו שוב.',
  loading: 'טוען את האפשרויות של הקידוד. נסו שוב בעוד רגע.',
  no_options: 'יכולות הזרם אינן ידועות, ולכן אי אפשר לשמור.',
  invalid: 'יש לבחור ערך תקין',
  nothing: 'אין שינויים לשמירה.',
  failed: 'השינוי לא נשמר. נסו שוב.',
} as const;

/**
 * CR-020 S2: the editor of one stream (the pencil of a table row / card). A modal drawer: a side panel on desktop and tablet, a
 * bottom sheet on a phone. Every field the device offers (from the stream's options) is a select / number / switch; a codec change
 * re-reads the resolution and profile lists (`options?codec=`); a locked field is disabled (the reason is in its tooltip only);
 * a field the stream does not support is not drawn. "שמור" is enabled only when something changed and every value is valid, and
 * opens the ONE confirmation (inside the drawer, since a modal drawer makes the rest of the page inert). The last five changes of
 * the stream are listed (no XML, ever) with "בטל" on the newest applied one - that press is the undo's confirmation.
 *
 * Events: `written` ({ result: ActionResult } - the outcome of a write or an undo, successful or not: on success the screen
 * updates the row, closes the drawer and shows the toast; on a failure the editor shows the line itself and the screen only
 * re-reads the camera when `result.line.reload` says so - a read, never a repeat of the write), `close`.
 */
@customElement('nvr-camera-editor')
export class NvrCameraEditor extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) camera: NvrCamera | null = null;
  @property({ attribute: false }) stream: StreamEncoding | null = null;
  @property({ attribute: false }) options: StreamOptions | null = null;
  @state() private draft: Draft | null = null;
  /** The options of the codec the draft is on (the stream's own options until the codec changes). */
  @state() private opts: StreamOptions | null = null;
  /** The codec `opts` were read for; a codec change whose lists could not be read leaves it behind, and Save stays off. */
  @state() private optsCodec = '';
  /** The options of a newly chosen codec are being read. */
  @state() private loading = false;
  @state() private confirm: ConfirmModel | null = null;
  @state() private busy = false;
  @state() private line = '';
  @state() private history: StreamChange[] | null = null;
  private pending: EncodingChanges | null = null;
  /** Sequence guards: a late answer of an older request never overwrites a newer one (history and options separately). */
  private hseq = 0;
  private oseq = 0;
  private key = '';

  static styles = css`
    :host {
      display: contents;
    }
    form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    @media (max-width: 480px) {
      form {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .f {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    .f.sw {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      min-block-size: 44px;
      padding: 0 2px;
    }
    .f > span.l,
    .f.sw > span.l {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    .f.sw > span.l {
      font-size: var(--sw-fs-sm);
    }
    select,
    input {
      inline-size: 100%;
      box-sizing: border-box;
      min-block-size: 44px;
      padding: 5px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      direction: ltr;
      text-align: start;
      font-variant-numeric: tabular-nums;
    }
    select:focus,
    input:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    select:disabled,
    input:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .bad select,
    .bad input {
      border-color: var(--sw-danger);
    }
    sw-toggle {
      padding: 10px 1px;
    }
    .line {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-sm);
      padding: 8px 10px;
    }
    details.history {
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: 8px;
      font-size: var(--sw-fs-sm);
    }
    details.history summary {
      cursor: pointer;
      color: var(--sw-text-2);
      min-block-size: 36px;
      display: flex;
      align-items: center;
    }
    details.history summary:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
      border-radius: var(--sw-r-2xs);
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    ol li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 2px 8px;
      align-items: center;
      padding-block: 4px;
      border-block-end: 1px solid var(--sw-border);
    }
    ol li:last-child {
      border-block-end: 0;
    }
    .when {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
    }
    .what {
      grid-column: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 2px 10px;
    }
    li sw-button {
      grid-column: 2;
      grid-row: 1 / span 2;
    }
    bdi {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .muted {
      color: var(--sw-text-3);
    }
  `;

  protected willUpdate(changed: PropertyValues) {
    const s = this.stream;
    const key = this.open && s && this.camera ? `${this.camera.camera_id}:${s.stream_ref}:${s.etag}` : '';
    if (key !== this.key) {
      const reopened = !this.key && !!key;
      this.key = key;
      if (key && s) {
        this.draft = draftOf(s);
        this.opts = this.options;
        this.optsCodec = s.codec ?? '';
        this.oseq++;
        this.loading = false;
        if (reopened) {
          this.line = '';
          this.history = null;
        }
        void this.loadHistory();
      }
    } else if (changed.has('options') && this.draft && s && this.draft.codec === (s.codec ?? '')) {
      this.opts = this.options;
      this.optsCodec = s.codec ?? '';
    }
  }

  /** The options in hand belong to the codec the draft is on (after a codec change, only once its own lists arrived). */
  private get optsFit(): boolean {
    return !!this.opts && !!this.draft && !this.loading && this.optsCodec === this.draft.codec;
  }

  /** A select's chosen option follows the draft even after the user touched it (a codec change clears the profile): the DOM value is synced here. */
  protected updated() {
    const d = this.draft;
    if (!d) return;
    for (const sel of this.renderRoot.querySelectorAll<HTMLSelectElement>('select[data-f]')) {
      const want = String(d[sel.dataset.f as keyof Draft] ?? '');
      if (sel.value !== want) sel.value = want;
    }
  }

  private async loadHistory() {
    const cam = this.camera;
    const s = this.stream;
    if (!cam?.camera_id || !s) return;
    const mine = ++this.hseq;
    try {
      const r = await nvrSettings().changes(cam.camera_id, 30);
      if (mine !== this.hseq) return;
      this.history = lastChanges(r.changes, s.stream_ref, 5);
    } catch {
      if (mine === this.hseq) this.history = [];
    }
  }

  private set<K extends keyof Draft>(k: K, v: Draft[K]) {
    if (!this.draft) return;
    this.draft = { ...this.draft, [k]: v };
    this.line = '';
  }

  private async onCodec(v: string) {
    const cam = this.camera;
    const s = this.stream;
    if (!this.draft || !cam?.camera_id || !s) {
      this.line = SAVE_LINE.gone;
      return;
    }
    this.set('codec', v);
    const mine = ++this.oseq;
    this.loading = true;
    try {
      const o = await nvrSettings().options(cam.camera_id, s.stream_ref, v);
      if (mine !== this.oseq || !this.draft) return;
      if (!o) {
        // the lists of the new codec are unknown: the old codec's lists must not validate the new one (optsCodec stays behind, Save stays off)
        this.line = errorLine({ status: 503, code: 'capabilities_unreadable' }).text;
        return;
      }
      this.opts = o;
      this.optsCodec = v;
      this.draft = reconcile(this.draft, o);
    } catch (err) {
      if (mine !== this.oseq) return;
      this.line = errorLine({ status: (err as { status?: number }).status ?? 0, code: (err as { code?: string }).code ?? 'network', user_message: (err as Error).message }).text;
    } finally {
      if (mine === this.oseq) this.loading = false;
    }
  }

  /** The press on "שמור": the ONE confirmation, or - when nothing can be confirmed - a short line saying why. Never silent. */
  private save = () => {
    try {
      const s = this.stream;
      const o = this.opts;
      if (!s || !this.draft || !this.camera?.camera_id) return void (this.line = SAVE_LINE.gone);
      if (this.loading) return void (this.line = SAVE_LINE.loading);
      if (!o || !this.optsFit) return void (this.line = SAVE_LINE.no_options);
      const bad = invalidFields(s, o, this.draft);
      if (bad.length) return void (this.line = `${SAVE_LINE.invalid}: ${bad.map((f) => FIELD_HE[f]).join(', ')}`);
      const changes = diffDraft(s, o, this.draft);
      if (!Object.keys(changes).length) return void (this.line = SAVE_LINE.nothing);
      this.line = '';
      this.pending = changes;
      this.confirm = confirmModel(this.camera.name, s, changes);
    } catch (err) {
      console.error('nvr editor: save failed', err); // eslint-disable-line no-console
      this.pending = null;
      this.confirm = null;
      this.line = SAVE_LINE.failed;
    }
  };

  private async confirmed() {
    const cam = this.camera;
    const s = this.stream;
    const changes = this.pending;
    this.confirm = null;
    this.pending = null;
    if (!cam?.camera_id || !s || !changes) {
      this.line = SAVE_LINE.gone;
      return;
    }
    this.busy = true;
    this.line = '';
    try {
      const r = await runWrite(cam.camera_id, s, changes);
      this.result(r);
    } catch (err) {
      console.error('nvr editor: write failed', err); // eslint-disable-line no-console
      this.line = SAVE_LINE.failed;
    } finally {
      this.busy = false;
    }
  }

  private async undo(id: string) {
    this.busy = true;
    this.line = '';
    const r = await runUndo(id);
    this.busy = false;
    this.result(r);
  }

  private result(r: ActionResult) {
    if (!r.ok) this.line = r.line.text; // the editor shows the one muted line itself; the screen only refreshes the row (stale / unknown outcome)
    this.dispatchEvent(new CustomEvent('written', { detail: { result: r }, bubbles: true, composed: true }));
  }

  private close = () => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));

  private select(f: EncodingField, label: string, values: string[], lock: string | null, bad: boolean, shown?: (v: string) => string) {
    const d = this.draft as Draft;
    const cur = String(d[f as keyof Draft] ?? '');
    return html`<label class="f ${bad ? 'bad' : ''}" data-field=${f}>
      <span class="l">${label}</span>
      <select data-f=${f} aria-label=${label} title=${lock ?? ''} ?disabled=${!!lock || this.busy} @change=${(e: Event) => (f === 'codec' ? void this.onCodec((e.target as HTMLSelectElement).value) : this.set(f as keyof Draft, (e.target as HTMLSelectElement).value as never))}>
        ${cur === '' || !values.includes(cur) ? html`<option value="" selected disabled>—</option>` : nothing}
        ${values.map((v) => html`<option value=${v} ?selected=${v === cur}>${shown ? shown(v) : v}</option>`)}
      </select>
    </label>`;
  }

  private number(f: 'bitrate_kbps' | 'gop', label: string, min: number, max: number, lock: string | null, bad: boolean) {
    const d = this.draft as Draft;
    return html`<label class="f ${bad ? 'bad' : ''}" data-field=${f}>
      <span class="l">${label}</span>
      <input type="number" inputmode="numeric" min=${min} max=${max} step="1" aria-label=${label} title=${lock ?? ''} .value=${d[f]} ?disabled=${!!lock || this.busy} @input=${(e: Event) => this.set(f, (e.target as HTMLInputElement).value)} />
    </label>`;
  }

  private toggle(f: 'svc' | 'smart_codec', label: string, lock: string | null) {
    const d = this.draft as Draft;
    return html`<div class="f sw" data-field=${f}>
      <span class="l">${label}</span>
      <sw-toggle label=${label} labelHidden .checked=${d[f] === true} ?disabled=${!!lock || this.busy} title=${lock ?? ''} data-editor-toggle=${f}
        @change=${(e: CustomEvent<{ checked: boolean }>) => this.set(f, e.detail.checked)}></sw-toggle>
    </div>`;
  }

  private fields() {
    const s = this.stream as StreamEncoding;
    const o = this.opts as StreamOptions;
    const d = this.draft as Draft;
    const bad = new Set(invalidFields(s, o, d));
    const codec = d.codec || s.codec || '';
    const lock = (f: EncodingField) => {
      const by = lockedBy(f, s, o, d);
      return by ? `${FIELD_HE[f]} נעול` : null;
    };
    return shownFields(s, o, d).map((f) => {
      switch (f) {
        case 'codec':
          return this.select(f, FIELD_HE[f], o.codec, lock(f), bad.has(f));
        case 'profile':
          return this.select(f, FIELD_HE[f], o.profile[codec] ?? [], lock(f), bad.has(f));
        case 'resolution':
          return this.select(f, FIELD_HE[f], o.resolution[codec] ?? [], lock(f), bad.has(f), (v) => v.replace(/x/i, '×'));
        case 'fps':
          return this.select(f, FIELD_HE[f], [...(o.fps_full ? ['full'] : []), ...o.fps.map(String)], lock(f), bad.has(f), (v) => (v === 'full' ? 'מלא' : v));
        case 'bitrate_mode':
          return this.select(f, FIELD_HE[f], o.bitrate_mode, lock(f), bad.has(f));
        case 'quality':
          return this.select(f, FIELD_HE[f], o.quality.map(String), lock(f), bad.has(f));
        case 'bitrate_kbps':
          return this.number(f, FIELD_HE[f], o.bitrate_kbps.min, o.bitrate_kbps.max, lock(f), bad.has(f));
        case 'gop':
          return this.number(f, FIELD_HE[f], o.gop.min, o.gop.max, lock(f), bad.has(f));
        case 'svc':
        case 'smart_codec':
          return this.toggle(f, FIELD_HE[f], lock(f));
        default:
          return nothing;
      }
    });
  }

  private when(iso: string): string {
    const t = new Date(iso);
    return Number.isNaN(t.getTime()) ? '' : t.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  }

  private renderHistory() {
    const list = this.history;
    if (!list || !list.length) return nothing;
    const last = undoable(list);
    return html`<details class="history" data-nvr-history>
      <summary>שינויים אחרונים</summary>
      <ol>${list.map(
        (c) => html`<li data-change=${c.id} data-status=${c.status}>
          <span class="when">${this.when(c.created_at)} · ${STATUS_HE[c.status] ?? c.status}</span>
          <span class="what">${changeFields(c).map((x) => html`<span>${fieldName(x.field)} <bdi>${x.from}</bdi> ← <bdi>${x.to}</bdi></span>`)}</span>
          ${last && last.id === c.id ? html`<sw-button size="sm" data-nvr-undo-change ?disabled=${this.busy} @click=${() => void this.undo(c.id)}>בטל</sw-button>` : nothing}
        </li>`,
      )}</ol>
    </details>`;
  }

  render() {
    const s = this.stream;
    const cam = this.camera;
    const ready = this.open && !!s && !!cam && !!this.draft && !!this.opts;
    const changes = ready ? diffDraft(s as StreamEncoding, this.opts as StreamOptions, this.draft as Draft) : {};
    const dirty = Object.keys(changes).length > 0;
    const valid = ready ? invalidFields(s as StreamEncoding, this.opts as StreamOptions, this.draft as Draft).length === 0 : false;
    return html`<sw-drawer modal ?open=${this.open} heading=${cam?.name ?? ''} subheading=${s ? `${ROLE_HE[s.role]}` : ''} data-nvr-editor @close=${(e: Event) => {
      e.stopPropagation();
      this.close();
    }}>
      ${ready
        ? html`<form @submit=${(e: Event) => e.preventDefault()} data-nvr-editor-form aria-busy=${this.busy}>${this.fields()}</form>
            ${this.line ? html`<p class="line" role="status" data-nvr-editor-line>${this.line}</p>` : nothing}
            ${this.renderHistory()}
            <sw-button slot="footer" variant="ghost" data-nvr-editor-cancel @click=${this.close}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-nvr-editor-save ?disabled=${!dirty || !valid || this.busy || !this.optsFit} @click=${this.save}>שמור</sw-button>`
        : nothing}
      <nvr-confirm .model=${this.confirm} @confirm=${() => void this.confirmed()} @cancel=${() => ((this.confirm = null), (this.pending = null))}></nvr-confirm>
    </sw-drawer>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nvr-camera-editor': NvrCameraEditor;
  }
}
