import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-dropdown';
import '../components/sw-tabs';
import './nvr-confirm';
import { ApiError } from '../api/client';
import { nvrBatch, type Batch, type EncodingPreview, type PlanItem } from '../api/nvr-batch';
import type { CameraDetail } from '../api/nvr-settings';
import type { DropdownItem } from '../components/sw-dropdown';
import type { ConfirmModel } from './nvr-cameras-edit';
import { FIELD_HE, valueLabel } from './nvr-cameras-edit';
import { ROLE_HE } from './nvr-cameras-logic';
import { windowOf } from './nvr-batch-logic';
import {
  EMPTY_DRAFT,
  LEAVE,
  NO_ENC_FILTERS,
  WEBRTC_NOTE,
  choicesFor,
  chosenStreams,
  deltas,
  encErrorLine,
  encFiltersActive,
  encodingConfirmModel,
  filterStreams,
  hasSettings,
  keptNotes,
  onBitrateMode,
  onCodec,
  previewSummary,
  rangeLabel,
  selectAllStreams,
  settingsOf,
  startRequest,
  streamName,
  toggleStream,
  type EncDraft,
  type EncFilters,
  type EncStream,
  type PreviewTab,
} from './nvr-encoding-logic';

type Phase = 'closed' | 'select' | 'settings' | 'preview' | 'confirm';

const SEL_ROW = 44;
const PREV_ROW = 60;

const CHECK = html`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>`;

/**
 * CR-020 phase D: "שינוי קידוד לכמה מצלמות" - one encoding change on many (or all) streams of the NVR, e.g. every camera to H.264
 * (owner 2026-10-04). Three steps in one dialog: the streams (a searchable checklist with filters by codec, main / sub, SVC and WebRTC, "select
 * all that match"), the target settings (every field "ללא שינוי" by default), and the server's preview (per stream "before → after", values the
 * device needed adjusted, streams that cannot be changed and why, the number of changes). Then the ONE confirmation (the S2C rules: no typed
 * word) and the start; the progress, "עצור", the result and the undo-all are the multi-camera dialog's (nvr-camera-batch), which follows the
 * new batch (`encoding-started`).
 *
 * The server plans every stream against its own device and starts exactly what was previewed (a camera changed meanwhile: the preview is
 * read again). Nothing here retries a write: a lost answer is checked by reading the active batch. Device strings are rendered as text only.
 * Events: `encoding-started` ({batch}).
 */
@customElement('nvr-encoding-batch')
export class NvrEncodingBatch extends LitElement {
  /** Every stream of the NVR with whether it can be chosen (the screen's `encodingStreams`). */
  @property({ attribute: false }) rows: EncStream[] = [];
  /** The cameras' details (their options feed the form's lists). */
  @property({ attribute: false }) details = new Map<string, CameraDetail | 'error'>();

  @state() private phase: Phase = 'closed';
  @state() private selected = new Set<string>();
  @state() private filters: EncFilters = { ...NO_ENC_FILTERS };
  @state() private draft: EncDraft = { ...EMPTY_DRAFT };
  @state() private plan: EncodingPreview | null = null;
  @state() private tab: PreviewTab = 'change';
  @state() private busy = false;
  @state() private line = '';
  @state() private confirmModel: ConfirmModel | null = null;
  @state() private listTop = 0;
  @state() private viewH = 360;

  static styles = css`
    :host {
      display: contents;
    }
    .tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .tools sw-field.q {
      flex: 1 1 180px;
      min-inline-size: 0;
    }
    .count {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .vl {
      contain: inline-size;
      inline-size: 100%;
      box-sizing: border-box;
      block-size: clamp(180px, 42dvh, 420px);
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .vl:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .space {
      box-sizing: border-box;
      inline-size: 100%;
    }
    .sel {
      all: unset;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 10px;
      inline-size: 100%;
      block-size: 44px;
      padding-inline: 12px;
      border-block-end: 1px solid var(--sw-border);
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .sel:hover:not([aria-disabled='true']) {
      background: var(--sw-surface-2);
    }
    .sel:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .sel[aria-disabled='true'] {
      cursor: default;
      color: var(--sw-text-3);
    }
    .box {
      flex: none;
      inline-size: 20px;
      block-size: 20px;
      border-radius: 5px;
      border: 2px solid var(--sw-border-strong);
      display: grid;
      place-items: center;
      color: var(--sw-text-inverse, #fff);
    }
    .sel[aria-checked='true'] .box {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
    }
    .sel[aria-disabled='true'] .box {
      opacity: 0.4;
    }
    .nm {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-inline-size: 50%;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .form {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
      gap: 10px 12px;
    }
    .form sw-dropdown {
      inline-size: 100%;
    }
    .form input {
      direction: ltr;
      text-align: start;
    }
    .msg {
      margin: 0;
      padding: 6px 8px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .note {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .sum {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
    }
    .row {
      box-sizing: border-box;
      display: grid;
      align-content: center;
      gap: 2px;
      block-size: 60px;
      padding-inline: 12px;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .row .nm {
      flex: none;
    }
    .row .ln {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .ln.muted {
      color: var(--sw-text-3);
    }
    .adj {
      color: var(--sw-warning-text, var(--sw-text));
      font-weight: var(--sw-fw-semibold);
    }
    .arrow,
    .muted {
      color: var(--sw-text-3);
    }
  `;

  // ---------------------------------------------------------------------------------------------- the screen's calls

  /** The toolbar's "שינוי קידוד לכמה מצלמות" (or the multi-camera dialog's link): the checklist, nothing chosen yet. */
  open() {
    this.selected = new Set();
    this.filters = { ...NO_ENC_FILTERS };
    this.draft = { ...EMPTY_DRAFT };
    this.plan = null;
    this.line = '';
    this.listTop = 0;
    this.phase = 'select';
  }

  // ---------------------------------------------------------------------------------------------- lists

  protected willUpdate(changed: PropertyValues) {
    if (changed.has('rows') && this.selected.size) {
      const ok = new Set(this.rows.filter((r) => r.selectable).map((r) => r.key));
      const kept = [...this.selected].filter((k) => ok.has(k));
      if (kept.length !== this.selected.size) this.selected = new Set(kept);
    }
  }

  protected updated() {
    const vl = this.renderRoot.querySelector<HTMLElement>('.vl');
    if (vl && vl.clientHeight > 0 && Math.abs(vl.clientHeight - this.viewH) > 1) this.viewH = vl.clientHeight;
  }

  private resetScroll() {
    this.listTop = 0;
    const vl = this.renderRoot.querySelector<HTMLElement>('.vl');
    if (vl) vl.scrollTop = 0;
  }

  private vlist(n: number, rowH: number, kind: string, row: (i: number) => TemplateResult, label: string) {
    const w = windowOf(this.listTop, this.viewH, n, rowH);
    const idx: number[] = [];
    for (let i = w.start; i < w.end; i++) idx.push(i);
    return html`<div class="vl" role="list" aria-label=${label} tabindex="0" data-nvr-enc-list=${kind} data-rows=${n} @scroll=${(e: Event) => (this.listTop = (e.target as HTMLElement).scrollTop)}>
      <div class="space" style="padding-block:${w.top}px ${Math.max(0, w.total - w.top - (w.end - w.start) * rowH)}px">${repeat(idx, (i) => i, (i) => row(i))}</div>
    </div>`;
  }

  private dd(label: string, attr: string, value: string, items: DropdownItem[], on: (id: string) => void) {
    return html`<sw-dropdown data-nvr-enc-dd=${attr} .label=${label} .placeholder=${label} .value=${value} .items=${items} @change=${(e: CustomEvent<{ id: string }>) => on(e.detail.id)}></sw-dropdown>`;
  }

  // ---------------------------------------------------------------------------------------------- step 1: the streams

  private selectRow(r: EncStream) {
    const on = this.selected.has(r.key);
    const meta = r.selectable ? `${r.codec ?? ''}${r.resolution ? ` · ${r.resolution.replace(/x/i, '×')}` : ''}` : r.reason;
    return html`<button type="button" class="sel" role="checkbox" aria-checked=${on ? 'true' : 'false'} aria-disabled=${r.selectable ? 'false' : 'true'} data-nvr-enc-stream=${r.key}
      title=${r.selectable ? '' : r.reason} @click=${() => (this.selected = toggleStream(this.selected, r))}>
      <span class="box" aria-hidden="true">${on ? CHECK : nothing}</span>
      <span class="nm">${r.cameraName} · ${ROLE_HE[r.role]}</span>
      <span class="meta">${r.selectable ? html`<bdi class="ltr">${meta}</bdi>` : meta}</span>
    </button>`;
  }

  private patchFilters(p: Partial<EncFilters>) {
    this.filters = { ...this.filters, ...p };
    this.resetScroll();
  }

  private renderSelect() {
    const f = this.filters;
    const matching = filterStreams(this.rows, f);
    const picked = chosenStreams(this.rows, this.selected).length;
    const selectable = this.rows.filter((r) => r.selectable).length;
    const fl = encFiltersActive(f);
    return html`<div class="tools" data-nvr-enc-filters>
        <sw-field class="q"><input type="search" placeholder="חיפוש מצלמה" aria-label="חיפוש מצלמה" data-nvr-enc-search .value=${f.q} @input=${(e: Event) => this.patchFilters({ q: (e.target as HTMLInputElement).value })} /></sw-field>
        ${this.dd('זרם', 'role', f.role, [{ id: '', label: 'ראשי ומשני' }, { id: 'main', label: 'ראשי' }, { id: 'sub', label: 'משני' }], (id) => this.patchFilters({ role: id as EncFilters['role'] }))}
        ${this.dd('קידוד', 'codec', f.codec, [{ id: '', label: 'כל הקידודים' }, { id: 'h264', label: 'H.264' }, { id: 'h265', label: 'H.265' }, { id: 'other', label: 'אחר' }], (id) => this.patchFilters({ codec: id as EncFilters['codec'] }))}
        ${this.dd('SVC', 'svc', f.svc, [{ id: '', label: 'כל ה־SVC' }, { id: 'on', label: 'SVC פעיל' }, { id: 'off', label: 'SVC כבוי' }, { id: 'none', label: 'ללא SVC' }], (id) => this.patchFilters({ svc: id as EncFilters['svc'] }))}
        ${this.dd('WebRTC', 'webrtc', f.webrtc, [{ id: '', label: 'כל ה־WebRTC' }, { id: 'ok', label: 'מתנגן' }, { id: 'no', label: 'לא מתנגן' }, { id: 'unknown', label: 'לא ידוע' }], (id) => this.patchFilters({ webrtc: id as EncFilters['webrtc'] }))}
      </div>
      <div class="tools">
        <sw-button size="sm" data-nvr-enc-all ?disabled=${!matching.some((r) => r.selectable)} @click=${() => (this.selected = selectAllStreams(this.selected, matching))}>${fl ? `בחר הכל (${matching.filter((r) => r.selectable).length})` : 'בחר הכל'}</sw-button>
        <sw-button size="sm" variant="ghost" data-nvr-enc-clear @click=${() => (this.selected = new Set())}>נקה</sw-button>
        ${fl ? html`<sw-button size="sm" variant="ghost" data-nvr-enc-unfilter @click=${() => this.patchFilters({ ...NO_ENC_FILTERS })}>נקה סינון</sw-button>` : nothing}
      </div>
      <div class="count" data-nvr-enc-count role="status">${`נבחרו ${picked} מתוך ${selectable}`}${fl ? ` · ${matching.length} תוצאות` : ''}</div>
      ${matching.length ? this.vlist(matching.length, SEL_ROW, 'select', (i) => this.selectRow(matching[i]), 'זרמים') : html`<p class="msg" data-nvr-enc-none role="status">אין זרמים שמתאימים לסינון.</p>`}
      ${this.line ? html`<p class="msg" data-nvr-enc-line role="alert">${this.line}</p>` : nothing}
      <sw-button slot="footer" variant="ghost" data-nvr-enc-cancel @click=${() => (this.phase = 'closed')}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-enc-next ?disabled=${picked < 1} @click=${() => this.toSettings()}>המשך</sw-button>`;
  }

  private toSettings() {
    this.line = '';
    this.phase = 'settings';
  }

  // ---------------------------------------------------------------------------------------------- step 2: the target settings

  private renderSettings() {
    const d = this.draft;
    const picked = chosenStreams(this.rows, this.selected);
    const ch = choicesFor(picked, this.details, d.codec);
    const { settings, invalid } = settingsOf(d, ch);
    const leave: DropdownItem = { id: '', label: LEAVE };
    const onOff: DropdownItem[] = [leave, { id: 'on', label: 'פעיל' }, { id: 'off', label: 'כבוי' }];
    const set = (p: Partial<EncDraft>) => (this.draft = { ...this.draft, ...p });
    const num = (f: 'bitrate_kbps' | 'gop', range: { min: number; max: number } | null) => html`<sw-field label=${FIELD_HE[f] + (f === 'bitrate_kbps' ? ' (kbps)' : '')} hint=${invalid.includes(f) ? `טווח ${rangeLabel(range)}` : ''}>
        <input inputmode="numeric" placeholder=${LEAVE} aria-label=${FIELD_HE[f]} data-nvr-enc-input=${f} aria-invalid=${invalid.includes(f) ? 'true' : 'false'} .value=${d[f]} @input=${(e: Event) => set({ [f]: (e.target as HTMLInputElement).value } as Partial<EncDraft>)} />
      </sw-field>`;
    return html`<p class="count" data-nvr-enc-picked>${`נבחרו ${picked.length === 1 ? 'זרם אחד' : `${picked.length} זרמים`}`}</p>
      <div class="form" data-nvr-enc-form>
        <sw-field label=${FIELD_HE.codec}>${this.dd(FIELD_HE.codec, 'codec-target', d.codec, [leave, ...ch.codec.map((c) => ({ id: c, label: c }))], (id) => (this.draft = onCodec(this.draft, id as EncDraft['codec'], choicesFor(picked, this.details, id))))}</sw-field>
        <sw-field label=${FIELD_HE.resolution}>${this.dd(FIELD_HE.resolution, 'resolution', d.resolution, [leave, ...ch.resolution.map((r) => ({ id: r, label: valueLabel('resolution', r) }))], (id) => set({ resolution: id }))}</sw-field>
        <sw-field label=${FIELD_HE.fps}>${this.dd(FIELD_HE.fps, 'fps', d.fps, [leave, ...(ch.fpsFull ? [{ id: 'full', label: 'מלא' }] : []), ...ch.fps.map((f) => ({ id: String(f), label: String(f) }))], (id) => set({ fps: id }))}</sw-field>
        <sw-field label=${FIELD_HE.bitrate_mode}>${this.dd(FIELD_HE.bitrate_mode, 'bitrate_mode', d.bitrate_mode, [leave, ...ch.bitrateMode.map((m) => ({ id: m, label: m }))], (id) => (this.draft = onBitrateMode(this.draft, id as EncDraft['bitrate_mode'])))}</sw-field>
        ${num('bitrate_kbps', ch.bitrate)}
        <sw-field label=${FIELD_HE.quality}>${this.dd(FIELD_HE.quality, 'quality', d.quality, [leave, ...(d.bitrate_mode === 'CBR' ? [] : ch.quality.map((q) => ({ id: String(q), label: String(q) })))], (id) => set({ quality: id }))}</sw-field>
        ${num('gop', ch.gop)}
        ${ch.svc ? html`<sw-field label="SVC">${this.dd('SVC', 'svc-target', d.svc, onOff, (id) => set({ svc: id as EncDraft['svc'] }))}</sw-field>` : nothing}
        ${ch.smart ? html`<sw-field label=${FIELD_HE.smart_codec}>${this.dd(FIELD_HE.smart_codec, 'smart_codec', d.smart_codec, onOff, (id) => set({ smart_codec: id as EncDraft['smart_codec'] }))}</sw-field>` : nothing}
      </div>
      ${d.codec ? html`<p class="note" data-nvr-enc-webrtc>${WEBRTC_NOTE}</p>` : nothing}
      ${this.line ? html`<p class="msg" data-nvr-enc-line role="alert">${this.line}</p>` : nothing}
      <sw-button slot="footer" variant="ghost" data-nvr-enc-back @click=${() => ((this.phase = 'select'), (this.line = ''))}>חזרה</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-enc-preview ?disabled=${!hasSettings(settings) || invalid.length > 0 || this.busy} @click=${() => void this.runPreview()}>${this.busy ? 'בודק…' : 'תצוגה מקדימה'}</sw-button>`;
  }

  // ---------------------------------------------------------------------------------------------- step 3: the preview

  /** A read: the server plans every chosen stream against its device. Never writes. */
  private async runPreview(keepLine = false) {
    const picked = chosenStreams(this.rows, this.selected);
    const { settings, invalid } = settingsOf(this.draft, choicesFor(picked, this.details, this.draft.codec));
    if (!picked.length || !hasSettings(settings) || invalid.length) return;
    this.busy = true;
    if (!keepLine) this.line = '';
    const recorders = new Set(picked.map((r) => r.recorderId));
    try {
      const p = await nvrBatch().previewEncoding({ settings, targets: picked.map((r) => ({ camera_id: r.cameraId, stream_ref: r.streamRef })), ...(recorders.size === 1 ? { recorder_id: picked[0].recorderId } : {}) });
      this.plan = p;
      this.tab = p.counts.change ? 'change' : p.counts.skip ? 'skip' : 'unchanged';
      this.phase = 'preview';
      this.resetScroll();
    } catch (err) {
      const shape = err instanceof ApiError ? { status: err.status, code: err.code, user_message: err.body.user_message } : { status: 0, code: 'network' };
      this.line = encErrorLine(shape).text;
    } finally {
      this.busy = false;
    }
  }

  private nameOf = (it: PlanItem): string => {
    const r = this.rows.find((x) => x.cameraId === it.camera_id && x.streamRef === it.stream_ref);
    return streamName(r?.cameraName ?? it.camera_id, it.role ?? r?.role);
  };

  private previewRow(it: PlanItem) {
    let line: TemplateResult;
    if (it.status === 'skip') line = html`<span class="ln" data-nvr-enc-reason title=${it.message ?? ''}>${it.message ?? ''}</span>`;
    else if (it.status === 'unchanged') line = html`<span class="ln muted">כבר מוגדר כך</span>`;
    else {
      const ds = deltas(it);
      const kept = keptNotes(it);
      const title = [...ds.filter((x) => x.adjusted).map((x) => `${x.label}: ${x.why}`), ...kept.map((k) => `${k.label}: ${k.why}`)].join('\n');
      line = html`<span class="ln" data-nvr-enc-delta title=${title}>${ds.map(
        (x, i) => html`${i ? ' · ' : ''}${x.label} <bdi class="ltr">${x.from}</bdi> <span class="arrow" aria-hidden="true">←</span> <bdi class="ltr ${x.adjusted ? 'adj' : ''}" data-adjusted=${x.adjusted ? 'true' : 'false'}>${x.to}${x.adjusted ? '*' : ''}</bdi>`,
      )}${kept.length ? html` · <span class="muted" data-nvr-enc-kept>${kept.map((k) => k.label).join(', ')} ${'ללא שינוי'}</span>` : nothing}</span>`;
    }
    return html`<div class="row" role="listitem" data-nvr-enc-item=${it.index} data-status=${it.status}><span class="nm">${this.nameOf(it)}</span>${line}</div>`;
  }

  private renderPreview() {
    const p = this.plan;
    if (!p) return nothing;
    const list = p.items.filter((i) => i.status === this.tab);
    const tabs = [
      { id: 'change', label: 'ישתנו', count: p.counts.change },
      { id: 'skip', label: 'לא ניתן', count: p.counts.skip },
      { id: 'unchanged', label: 'כבר מוגדרים', count: p.counts.unchanged },
    ].filter((t) => t.count > 0 || t.id === 'change');
    const adjusted = p.adjusted > 0;
    return html`<p class="sum" data-nvr-enc-summary role="status">${previewSummary(p)}</p>
      ${p.settings.codec ? html`<p class="note" data-nvr-enc-webrtc>${WEBRTC_NOTE}</p>` : nothing}
      ${adjusted ? html`<p class="note" data-nvr-enc-adjusted>* הותאם למה שהמצלמה מאפשרת</p>` : nothing}
      <sw-tabs data-nvr-enc-tabs .items=${tabs} .active=${this.tab} group-label="תצוגה מקדימה" @change=${(e: CustomEvent<{ id: string }>) => ((this.tab = e.detail.id as PreviewTab), this.resetScroll())}></sw-tabs>
      ${list.length ? this.vlist(list.length, PREV_ROW, 'preview', (i) => this.previewRow(list[i]), 'תצוגה מקדימה') : html`<p class="msg" data-nvr-enc-empty role="status">אין זרמים ברשימה הזו.</p>`}
      ${p.batch_in_progress ? html`<p class="msg" data-nvr-enc-busy role="status">מתבצע שינוי מרובה</p>` : nothing}
      ${this.line ? html`<p class="msg" data-nvr-enc-line role="alert">${this.line}</p>` : nothing}
      <sw-button slot="footer" variant="ghost" data-nvr-enc-back @click=${() => ((this.phase = 'settings'), (this.line = ''))}>חזרה</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-enc-apply ?disabled=${!p.counts.change || p.batch_in_progress || this.busy} @click=${() => this.askConfirm()}>${p.counts.change ? `החל על ${p.counts.change === 1 ? 'זרם אחד' : `${p.counts.change} זרמים`}` : 'החל'}</sw-button>`;
  }

  private askConfirm() {
    const p = this.plan;
    if (!p || !p.counts.change) return;
    this.line = '';
    this.confirmModel = encodingConfirmModel(p, this.nameOf);
    this.phase = 'confirm';
  }

  // ---------------------------------------------------------------------------------------------- the start (sent ONCE)

  private async start() {
    const p = this.plan;
    this.confirmModel = null;
    if (!p) return;
    this.busy = true;
    this.phase = 'preview';
    try {
      const b = await nvrBatch().startEncoding(startRequest(p));
      this.handOff(b);
    } catch (err) {
      const sent = !(err instanceof ApiError) || err.status >= 500; // the answer may have been lost after the batch started
      if (sent) {
        try {
          const a = await nvrBatch().active();
          if (a) {
            this.handOff(a);
            return;
          }
        } catch {
          /* cannot read either: say so below */
        }
      }
      const shape = err instanceof ApiError ? { status: err.status, code: err.code, user_message: err.body.user_message } : { status: 0, code: 'network' };
      const l = encErrorLine(shape);
      if (l.reload) {
        this.busy = false;
        await this.runPreview(true); // a read: the new plan replaces the old one; the person confirms again
      }
      this.line = l.text;
    } finally {
      this.busy = false;
    }
  }

  private handOff(b: Batch) {
    this.phase = 'closed';
    this.plan = null;
    this.emit('encoding-started', { batch: b });
  }

  private emit<T>(name: string, detail?: T) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  // ---------------------------------------------------------------------------------------------- render

  render() {
    const open = this.phase === 'select' || this.phase === 'settings' || this.phase === 'preview';
    const heading = this.phase === 'settings' ? 'ההגדרות החדשות' : this.phase === 'preview' ? 'תצוגה מקדימה' : 'שינוי קידוד לכמה מצלמות';
    return html`<sw-dialog wide ?open=${open} heading=${heading} data-nvr-enc data-phase=${this.phase} ?locked=${this.busy} @close=${(e: Event) => {
        e.stopPropagation();
        this.phase = 'closed';
      }}>
        ${this.phase === 'select' ? this.renderSelect() : this.phase === 'settings' ? this.renderSettings() : this.phase === 'preview' ? this.renderPreview() : nothing}
      </sw-dialog>
      <nvr-confirm .model=${this.phase === 'confirm' ? this.confirmModel : null}
        @confirm=${(e: Event) => {
          e.stopPropagation();
          void this.start();
        }}
        @cancel=${(e: Event) => {
          e.stopPropagation();
          this.confirmModel = null;
          this.phase = 'preview';
        }}></nvr-confirm>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nvr-encoding-batch': NvrEncodingBatch;
  }
}
