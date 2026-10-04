import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-state-panel';
import '../components/sw-toggle';
import '../components/sw-icon';
import './nvr-camera-editor';
import './nvr-confirm';
import './nvr-undo-toast';
import './nvr-camera-batch';
import './nvr-encoding-batch';
import { keyed } from 'lit/directives/keyed.js';
import type { Batch } from '../api/nvr-batch';
import type { NvrCameraBatch, CameraInfo } from './nvr-camera-batch';
import type { NvrEncodingBatch } from './nvr-encoding-batch';
import { encodingStreams } from './nvr-encoding-logic';
import { batchCandidates, doneToast, tally } from './nvr-batch-logic';
import { ApiError, describeError } from '../api/client';
import { nvrSettings, type CameraDetail, type CameraList, type EncodingChanges, type NvrCamera, type Recorder, type StreamEncoding } from '../api/nvr-settings';
import type { SwToggle } from '../components/sw-toggle';
import { runUndo, runWrite, type ActionResult } from './nvr-cameras-actions';
import { confirmModel, control, type Control, type ConfirmModel } from './nvr-cameras-edit';
import {
  DASH,
  DEFAULT_SORT,
  NO_FILTERS,
  ROLE_HE,
  VERDICT_HE,
  applyFilters,
  bitrateLabel,
  codecLabel,
  counts,
  filtersActive,
  flatten,
  fpsLabel,
  nextSort,
  numberLabel,
  resolutionLabel,
  sortRows,
  startsGroup,
  svcLabel,
  type CodecFilter,
  type Filters,
  type RoleFilter,
  type Sort,
  type SortKey,
  type StreamRow,
  type SvcFilter,
  type VerdictFilter,
} from './nvr-cameras-logic';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const STALE_NOTE = 'ה־NVR אינו זמין. מוצגים הערכים האחרונים.';

interface Toast {
  /** A new number per toast: the element is re-created, so its 10 s timer starts again. */
  n: number;
  message: string;
  undo?: { changeId: string; cameraId: string; ref: string };
  /** CR-020 S2C: the "בטל" of a finished multi-camera change: the id of the batch to undo (the press IS the confirmation). */
  batchUndo?: string;
  reboot?: boolean;
  busy?: boolean;
}

/** Said when a single change is refused or disabled because a multi-camera change is running. */
const BATCH_BUSY = 'מתבצע שינוי מרובה';

/** Table columns in display order; `sort` is the column's sort key (none: not sortable). */
const COLUMNS: { id: string; label: string; sort?: SortKey }[] = [
  { id: 'channel', label: 'ערוץ', sort: 'channel' },
  { id: 'camera', label: 'מצלמה', sort: 'camera' },
  { id: 'role', label: 'זרם', sort: 'role' },
  { id: 'codec', label: 'קידוד', sort: 'codec' },
  { id: 'svc', label: 'SVC', sort: 'svc' },
  { id: 'resolution', label: 'רזולוציה', sort: 'resolution' },
  { id: 'fps', label: 'FPS', sort: 'fps' },
  { id: 'bitrate', label: 'קצב', sort: 'bitrate' },
  { id: 'gop', label: 'GOP', sort: 'gop' },
  { id: 'webrtc', label: 'WebRTC', sort: 'webrtc' },
];

const CHECK = html`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
const CROSS = html`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>`;

/**
 * הגדרות › אבטחה › מצלמות (CR-020 slice S1): every camera of the NVR with the video settings of each of its streams - codec,
 * SVC, resolution, frame rate, bitrate, GOP, profile, stream type and whether the browser plays it over WebRTC - in one
 * table with a search, filters and column sort. System administrators only (`system.configure`; the server checks it, the tab is
 * only offered to them).
 *
 * Slice S2 phase B (single-stream write): whoever holds `nvr.configure` (the list's `can_write`) also gets, per stream, an SVC
 * switch and a pencil that opens the editor drawer. The switch never moves by itself: a press opens the ONE confirmation, then the
 * row is pending, then the data decides (success: the switch moves and a toast offers "בטל" for 10 s - that press is the undo's
 * confirmation; failure: the switch stays and one muted line says why). A control is offered only after the camera's detail was
 * read (`writable` is null in the list); one that cannot act is disabled with the reason in its tooltip only. Nothing is ever
 * retried: an unknown outcome says "הסטטוס נבדק" and the camera is read again (a read). Everyone else sees the S1 table, unchanged.
 * Values the device does not report show "—" (never a guessed default). Technical names are exact (H.264, SVC, GOP):
 * this is a settings screen. Numbers, codecs and resolutions stay left-to-right inside the right-to-left page.
 */
@customElement('system-security-cameras')
export class SystemSecurityCameras extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private data: CameraList | null = null;
  @state() private recorder: Recorder | null = null;
  @state() private loading = true;
  /** A failure with nothing to show: the error panel (a partial failure is `data.stale`). */
  @state() private failure: { status: number; code: string; message: string } | null = null;
  @state() private filters: Filters = { ...NO_FILTERS };
  @state() private sort: Sort = { ...DEFAULT_SORT };
  /** By camera id: the detail (options, `writable`) once read, or 'error'. Only read for a holder of `nvr.configure`. */
  @state() private details = new Map<string, CameraDetail | 'error'>();
  /** Rows with a write in flight (`cameraId:streamRef`). */
  @state() private busy = new Set<string>();
  /** The one muted line under a row (row key -> text); cleared by the next action on that row. */
  @state() private lines = new Map<string, string>();
  /** The pending confirmation of an SVC switch (the editor has its own, inside its drawer). */
  @state() private confirm: { model: ConfirmModel; cameraId: string; ref: string; changes: EncodingChanges } | null = null;
  @state() private editing: { cameraId: string; ref: string } | null = null;
  @state() private toast: Toast | null = null;
  /** The multi-camera change the page is following (running, or finished and not yet closed); null when none. */
  @state() private batch: Batch | null = null;
  private seq = 0;
  private toasts = 0;

  static styles = [css`
    :host {
      display: block;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .toolbar sw-field {
      inline-size: 150px;
    }
    .toolbar sw-field.search {
      inline-size: 240px;
    }
    .count {
      margin-inline-start: auto;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .note {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 8px 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-stale-soft);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    .wrap {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      overflow-x: auto;
      max-inline-size: 100%;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    th,
    td {
      padding: 8px 10px;
      text-align: start;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
      white-space: nowrap;
    }
    th {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface);
      padding: 0;
    }
    th button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 9px 10px;
      cursor: pointer;
      color: inherit;
      font: inherit;
    }
    th button:hover,
    th[aria-sort='ascending'] button,
    th[aria-sort='descending'] button {
      color: var(--sw-text);
    }
    th button:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
      border-radius: 4px;
    }
    .arrow {
      inline-size: 8px;
      font-size: 9px;
      color: var(--sw-accent-text);
    }
    tbody tr.first td {
      border-block-start: 2px solid var(--sw-border);
    }
    tbody tr:first-child td {
      border-block-start: 0;
    }
    tbody tr:last-child td {
      border-block-end: 0;
    }
    tbody tr:hover {
      background: var(--sw-surface-2);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
      display: inline-block;
    }
    .muted {
      color: var(--sw-text-3);
    }
    .repeat .cam {
      color: var(--sw-text-3);
    }
    .off .cam {
      color: var(--sw-text-3);
    }
    .dot {
      display: inline-block;
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-text-4, #9aa3b2);
      margin-inline-end: 6px;
      vertical-align: middle;
    }
    .v {
      display: inline-grid;
      place-items: center;
      inline-size: 22px;
      block-size: 22px;
      border-radius: 50%;
    }
    .v.ok {
      color: var(--sw-success, #15803d);
      background: var(--sw-success-soft, #e7f6ec);
    }
    .v.no {
      color: var(--sw-danger);
      background: var(--sw-danger-soft);
    }
    .v.unknown {
      color: var(--sw-text-3);
    }
    .chan {
      display: none;
      font-size: var(--sw-fs-xs);
    }
    /* tablet widths: the channel folds into the camera cell and the cells tighten, so all columns fit without scrolling */
    @media (max-width: 1100px) {
      .c-chan {
        display: none;
      }
      .chan {
        display: inline;
      }
      th button {
        padding: 8px 6px;
      }
      td {
        padding: 7px 6px;
      }
    }
    /* S2: the SVC switch, the pencil, the pending spinner and the one muted line under a row */
    .vh {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    td.act {
      inline-size: 1%;
      text-align: end;
    }
    .swc {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    sw-toggle {
      vertical-align: middle;
    }
    .spin {
      inline-size: 14px;
      block-size: 14px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong);
      border-block-start-color: var(--sw-accent);
      animation: nvr-spin 0.8s linear infinite;
    }
    @keyframes nvr-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spin {
        animation: none;
      }
    }
    .pen {
      all: unset;
      box-sizing: border-box;
      display: inline-grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .pen:hover:not([disabled]) {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .pen:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .pen[disabled] {
      opacity: 0.45;
      cursor: not-allowed;
    }
    tr.msg td {
      white-space: normal;
      color: var(--sw-text-2);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
    .msgline {
      color: var(--sw-text-2);
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-sm);
      padding: 6px 8px;
      font-size: var(--sw-fs-sm);
    }
    .svcline {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    /* touch layouts: the switch's box and the pencil are 44 px targets */
    @media (max-width: 1100px) {
      sw-toggle {
        padding: 10px 1px;
      }
      .pen {
        inline-size: 44px;
        block-size: 44px;
      }
      /* the toolbar's fields and the sort headers are 44 px targets in touch layouts (layout guard) */
      .toolbar sw-field select,
      .toolbar sw-field input {
        min-block-size: 44px;
      }
      th button {
        min-block-size: 44px;
        min-inline-size: 44px;
        justify-content: center;
      }
    }
    .cards {
      display: none;
    }
    .card {
      display: grid;
      gap: 3px;
      padding: 10px 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      font-size: var(--sw-fs-sm);
    }
    .card .head {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-semibold);
    }
    .card .line {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      align-items: center;
    }
    .card .facts {
      color: var(--sw-text-2);
    }
    @media (max-width: 767px) {
      .wrap {
        display: none;
      }
      .cards {
        display: grid;
        gap: 8px;
      }
      .toolbar sw-field,
      .toolbar sw-field.search {
        inline-size: calc(50% - 4px);
      }
      .toolbar sw-field.search {
        inline-size: 100%;
      }
      .count {
        inline-size: 100%;
        margin: 0;
      }
    }
    /* S2: with the switch and pencil columns the table needs about 900 px; a holder of nvr.configure gets the cards below that */
    @media (max-width: 899px) {
      :host([data-rw]) .wrap {
        display: none;
      }
      :host([data-rw]) .cards {
        display: grid;
        gap: 8px;
      }
      :host([data-rw]) .toolbar sw-field,
      :host([data-rw]) .toolbar sw-field.search {
        inline-size: calc(50% - 4px);
      }
      :host([data-rw]) .toolbar sw-field.search {
        inline-size: 100%;
      }
      :host([data-rw]) .count {
        inline-size: 100%;
        margin: 0;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  protected willUpdate() {
    this.toggleAttribute('data-rw', !!this.data?.can_write);
  }

  private async load() {
    const mine = ++this.seq;
    this.loading = true;
    try {
      const api = nvrSettings();
      const [list, recs] = await Promise.all([api.cameras(), api.recorders().catch(() => null)]);
      if (mine !== this.seq) return;
      this.data = list;
      this.recorder = recs?.recorders[0] ?? null;
      this.failure = null;
      this.details = new Map();
      this.lines = new Map();
      // the device could not be read and the registry knows nothing: the same as an error with nothing to show
      if (list.stale && !list.cameras.length) {
        this.data = null;
        this.failure = { status: 503, code: list.error ?? 'source_unavailable', message: STALE_NOTE };
      } else {
        void this.prefetch(list, mine);
        // a multi-camera change that is running (or the last one the person was looking at) comes back on screen
        if (list.can_write && !list.stale) void this.updateComplete.then(() => this.batchEl()?.resume());
      }
    } catch (err) {
      if (mine !== this.seq) return;
      this.data = null;
      this.failure = { status: err instanceof ApiError ? err.status : 0, code: err instanceof ApiError ? err.code : 'network', message: describeError(err) };
    } finally {
      if (mine === this.seq) this.loading = false;
    }
  }

  // ---------------------------------------------------------------------------------------------- S2: detail, controls, writes

  /** `writable` is null in the list: a holder of `nvr.configure` reads each camera's detail (three at a time) before a switch is offered.
   * CR-020 S2C (hundreds of cameras): the answers are committed to the screen in groups (every 25 cameras or 150 ms), not one render of the whole table per camera. */
  private async prefetch(list: CameraList, mine: number) {
    if (!list.can_write || list.stale) return;
    const ids = list.cameras.filter((c) => c.camera_id && c.streams.length).map((c) => c.camera_id as string);
    let next = 0;
    const sink = new Map<string, CameraDetail | 'error'>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (mine !== this.seq || !sink.size) return;
      this.commitDetails(new Map(sink));
      sink.clear();
    };
    const worker = async () => {
      while (next < ids.length && mine === this.seq) {
        await this.readCamera(ids[next++], mine, sink);
        if (sink.size >= 25) flush();
        else if (!timer) timer = setTimeout(flush, 150);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    flush();
  }

  /** Several detail answers at once: one new `details` map and one new `data` (the list's streams take the detail's copy, which carries `writable`). */
  private commitDetails(got: Map<string, CameraDetail | 'error'>) {
    this.details = new Map([...this.details, ...got]);
    if (!this.data) return;
    const streams = new Map<string, StreamEncoding[]>();
    for (const [id, d] of got) if (d !== 'error' && d.camera.streams.length) streams.set(id, d.camera.streams);
    if (streams.size) this.data = { ...this.data, cameras: this.data.cameras.map((c) => (c.camera_id && streams.has(c.camera_id) ? { ...c, streams: streams.get(c.camera_id) as StreamEncoding[] } : c)) };
  }

  /** A READ of one camera (the options and `writable`); also how a row is refreshed after stale / diverged / an unknown outcome. With a `sink` the answer is
   * handed to the caller (the prefetch commits groups) instead of being committed here. */
  private async readCamera(id: string, mine = this.seq, sink?: Map<string, CameraDetail | 'error'>) {
    let got: CameraDetail | 'error';
    try {
      got = await nvrSettings().camera(id);
    } catch {
      got = 'error';
    }
    if (mine !== this.seq) return;
    if (sink) sink.set(id, got);
    else this.commitDetails(new Map([[id, got]]));
  }

  private cameraById(id: string): NvrCamera | null {
    return this.data?.cameras.find((c) => c.camera_id === id) ?? null;
  }

  private streamOf(id: string, ref: string): StreamEncoding | null {
    return this.cameraById(id)?.streams.find((s) => s.stream_ref === ref) ?? null;
  }

  private ctrl(kind: 'svc' | 'edit', r: StreamRow): Control {
    const d = this.data;
    if (!d || !r.cameraId) return { show: false, enabled: false, reason: '' };
    const c = control(kind, { camera_id: r.cameraId, online: r.online }, r.stream, { canWrite: d.can_write, stale: d.stale, detail: this.details.get(r.cameraId) ?? null });
    // a multi-camera change is running: the server refuses single changes, so no single control acts (the reason is in the tooltip, the strip says it)
    return c.show && this.batchRunning ? { show: true, enabled: false, reason: BATCH_BUSY } : c;
  }

  private get batchRunning(): boolean {
    return this.batch?.state === 'running';
  }

  private batchEl(): NvrCameraBatch | null {
    return this.renderRoot.querySelector<NvrCameraBatch>('nvr-camera-batch');
  }

  /** The names the batch's rows show (its items carry only the camera id). */
  private cameraInfo(): Record<string, CameraInfo> {
    const out: Record<string, CameraInfo> = {};
    for (const c of this.data?.cameras ?? []) if (c.camera_id) out[c.camera_id] = { name: c.name, channel: c.channel };
    return out;
  }

  /** CR-020 phase D: `camera_id:stream_ref` -> the role label, for the rows of an encoding batch (main and sub of one camera). */
  private streamRoles(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const c of this.data?.cameras ?? []) if (c.camera_id) for (const s of c.streams) out[`${c.camera_id}:${s.stream_ref}`] = ROLE_HE[s.role];
    return out;
  }

  private encEl(): NvrEncodingBatch | null {
    return this.renderRoot.querySelector<NvrEncodingBatch>('nvr-encoding-batch');
  }

  /** "שינוי קידוד לכמה מצלמות": the toolbar's button and the multi-camera checklist's link. */
  private openEncoding() {
    if (this.batchRunning) return;
    this.toast = null;
    this.encEl()?.open();
  }

  private isBusy(r: StreamRow): boolean {
    return !!r.cameraId && !!r.stream && this.busy.has(`${r.cameraId}:${r.stream.stream_ref}`);
  }

  private setBusy(key: string, on: boolean) {
    const b = new Set(this.busy);
    if (on) b.add(key);
    else b.delete(key);
    this.busy = b;
  }

  private setLine(rowKey: string, text: string | null) {
    const m = new Map(this.lines);
    if (text) m.set(rowKey, text);
    else m.delete(rowKey);
    this.lines = m;
  }

  /** The new stream of a write / undo / stale answer replaces the row's (the list and the detail copy); `writable` is kept when the answer has none. */
  private replaceStream(cameraId: string, s: StreamEncoding) {
    const merge = (old?: StreamEncoding): StreamEncoding => ({ ...s, writable: s.writable ?? old?.writable ?? null, not_writable_reason: s.not_writable_reason ?? old?.not_writable_reason ?? null });
    const swap = (c: NvrCamera): NvrCamera => ({ ...c, streams: c.streams.map((x) => (x.stream_ref === s.stream_ref ? merge(x) : x)) });
    if (this.data) this.data = { ...this.data, cameras: this.data.cameras.map((c) => (c.camera_id === cameraId ? swap(c) : c)) };
    const d = this.details.get(cameraId);
    if (d && d !== 'error') this.details = new Map(this.details).set(cameraId, { ...d, camera: swap(d.camera) });
  }

  private showToast(message: string, extra: Partial<Toast> = {}) {
    this.toast = { n: ++this.toasts, message, ...extra };
  }

  /** What a finished write / undo does to the screen. `from`: the row's switch / toast (a line under the row) or the editor (its own line). */
  private applyResult(cameraId: string, ref: string, r: ActionResult, from: 'row' | 'editor') {
    const rowKey = `${this.cameraById(cameraId)?.recorder_id ?? 'nvr-1'}:${this.cameraById(cameraId)?.source_ref ?? ''}:${ref}`;
    if (r.ok) {
      this.replaceStream(cameraId, r.stream);
      if (from === 'editor') this.editing = null;
      this.setLine(rowKey, null);
      if (r.kind === 'undo') this.showToast(r.rebootRequired ? 'השינוי בוטל. ה־NVR מבקש הפעלה מחדש.' : 'השינוי בוטל', r.rebootRequired ? { reboot: true } : {});
      else if (r.unchanged || !r.change) this.showToast('ללא שינוי');
      else this.showToast(r.rebootRequired ? 'נשמר. ה־NVR מבקש הפעלה מחדש.' : 'נשמר', { undo: { changeId: r.change.id, cameraId, ref }, ...(r.rebootRequired ? { reboot: true } : {}) });
      return;
    }
    if (r.stream) this.replaceStream(cameraId, r.stream);
    if (from === 'row') this.setLine(rowKey, r.line.text);
    // a READ of the camera (never a repeat of the write): the server's own state replaces ours
    if (r.line.reload) void this.readCamera(cameraId);
    // the server refused because a multi-camera change runs (another administrator started it): the strip appears
    if (r.code === 'batch_in_progress') void this.batchEl()?.resume();
  }

  private onSvc(e: Event, r: StreamRow) {
    const s = r.stream;
    // the switch flips itself on a press: put it back at once - the data (the device's answer) decides where it stands
    (e.target as SwToggle).checked = s?.svc === true;
    if (!s || !r.cameraId || this.isBusy(r) || !this.ctrl('svc', r).enabled) return;
    const changes: EncodingChanges = { svc: s.svc !== true };
    this.setLine(r.key, null);
    const model = confirmModel(r.cameraName, s, changes);
    // SVC off on a camera that qualifies, with at least one more candidate: the same dialog offers the multi-camera change (always on; the server's `can_batch`)
    const others = this.batchCandidates();
    if (changes.svc === false && this.data?.can_batch === true && others.length >= 2 && others.some((c) => c.cameraId === r.cameraId)) model.extraLabel = 'החל גם על מצלמות נוספות';
    this.confirm = { model, cameraId: r.cameraId, ref: s.stream_ref, changes };
  }

  private batchCandidates() {
    const d = this.data;
    return d ? batchCandidates(d.cameras, this.details, d.stale) : [];
  }

  /** "החל גם על מצלמות נוספות": the single dialog gives way to the checklist (the current camera ticked and fixed). */
  private openBatch() {
    const c = this.confirm;
    this.confirm = null;
    if (c) this.batchEl()?.openSelect(c.cameraId);
  }

  private onBatchFinished(b: Batch) {
    const t = doneToast(b);
    this.showToast(t.message, t.undo ? { batchUndo: b.batch_id } : {});
  }

  private async confirmed() {
    const c = this.confirm;
    this.confirm = null;
    const s = c && this.streamOf(c.cameraId, c.ref);
    if (!c || !s) return;
    const key = `${c.cameraId}:${c.ref}`;
    this.toast = null;
    this.setBusy(key, true);
    const r = await runWrite(c.cameraId, s, c.changes);
    this.setBusy(key, false);
    this.applyResult(c.cameraId, c.ref, r, 'row');
  }

  private async undoToast() {
    const t = this.toast;
    if (t?.batchUndo && !t.busy) {
      // the press on "נשמר ב־N מצלמות · בטל" IS the confirmation of the undo-all: the request carries it at once, and the progress opens
      const id = t.batchUndo;
      this.toast = null;
      await this.batchEl()?.undoAll(id);
      return;
    }
    if (!t?.undo || t.busy) return;
    const { changeId, cameraId, ref } = t.undo;
    this.toast = { ...t, busy: true };
    this.setBusy(`${cameraId}:${ref}`, true);
    const r = await runUndo(changeId); // the press on the toast IS the confirmation: `confirm: true` goes with it
    this.setBusy(`${cameraId}:${ref}`, false);
    this.toast = null;
    this.applyResult(cameraId, ref, r, 'row');
  }

  private openEditor(r: StreamRow) {
    if (!r.cameraId || !r.stream || !this.ctrl('edit', r).enabled || this.isBusy(r)) return;
    this.toast = null;
    this.setLine(r.key, null);
    this.editing = { cameraId: r.cameraId, ref: r.stream.stream_ref };
  }

  private renderSvc(r: StreamRow) {
    const c = this.ctrl('svc', r);
    const s = r.stream;
    if (!c.show || !s) return svcLabel(s);
    const busy = this.isBusy(r);
    const name = `SVC · ${r.cameraName} · ${ROLE_HE[s.role]}`;
    return html`<span class="swc ${busy ? 'pending' : ''}"><sw-toggle data-svc-toggle .checked=${s.svc === true} ?disabled=${!c.enabled || busy} label=${name} labelHidden title=${c.reason || nothing}
      aria-busy=${busy ? 'true' : 'false'} @change=${(e: Event) => this.onSvc(e, r)}></sw-toggle>${busy ? html`<span class="spin" role="status" aria-label="שומר" data-pending></span>` : nothing}</span>`;
  }

  private renderPen(r: StreamRow) {
    const c = this.ctrl('edit', r);
    if (!c.show || !r.stream) return nothing;
    return html`<button type="button" class="pen" data-edit-stream aria-label=${`עריכה · ${r.cameraName} · ${ROLE_HE[r.stream.role]}`} title=${c.reason || 'עריכה'} ?disabled=${!c.enabled || this.isBusy(r)} @click=${() => this.openEditor(r)}><sw-icon name="edit" size="16"></sw-icon></button>`;
  }

  private renderEditor() {
    const e = this.editing;
    const cam = e ? this.cameraById(e.cameraId) : null;
    const s = e ? this.streamOf(e.cameraId, e.ref) : null;
    const d = e ? this.details.get(e.cameraId) : null;
    const options = s && d && d !== 'error' ? d.options?.[s.stream_ref] ?? null : null;
    return html`<nvr-camera-editor ?open=${!!(e && cam && s && options)} .camera=${cam} .stream=${s} .options=${options}
      @close=${() => (this.editing = null)} @written=${(ev: CustomEvent<{ result: ActionResult }>) => e && this.applyResult(e.cameraId, e.ref, ev.detail.result, 'editor')}></nvr-camera-editor>`;
  }

  private renderToast() {
    const t = this.toast;
    if (!t) return nothing;
    return keyed(t.n, html`<nvr-undo-toast message=${t.message} actionLabel=${t.undo || t.batchUndo ? 'בטל' : ''} linkLabel=${t.reboot ? 'ל־NVR' : ''} linkHref=${t.reboot ? '#/system/security/nvr' : ''} ?busy=${!!t.busy}
      @undo=${() => void this.undoToast()} @dismiss=${() => !t.busy && (this.toast = null)}></nvr-undo-toast>`);
  }

  private patch(p: Partial<Filters>) {
    this.filters = { ...this.filters, ...p };
  }

  private select(label: string, key: keyof Filters, options: [string, string][], attr: string) {
    return html`<sw-field><select aria-label=${label} data-nvr-filter=${attr} .value=${this.filters[key]} @change=${(e: Event) => this.patch({ [key]: (e.target as HTMLSelectElement).value } as Partial<Filters>)}>
      ${options.map(([v, l]) => html`<option value=${v} ?selected=${v === this.filters[key]}>${l}</option>`)}
    </select></sw-field>`;
  }

  private renderToolbar(shown: number, total: number) {
    const f = this.filters;
    return html`<div class="toolbar" data-nvr-toolbar>
      <sw-field class="search"><input type="search" placeholder="חיפוש מצלמה, קידוד, רזולוציה" aria-label="חיפוש" data-nvr-search .value=${f.q} @input=${(e: Event) => this.patch({ q: (e.target as HTMLInputElement).value })} /></sw-field>
      ${this.select('קידוד', 'codec', [['', 'כל הקידודים'], ['h264', 'H.264'], ['h265', 'H.265'], ['other', 'אחר']] satisfies [CodecFilter, string][], 'codec')}
      ${this.select('סוג זרם', 'role', [['', 'כל הזרמים'], ['main', 'ראשי'], ['sub', 'משני'], ['other', 'נוסף']] satisfies [RoleFilter, string][], 'role')}
      ${this.select('SVC', 'svc', [['', 'כל ה־SVC'], ['on', 'SVC פעיל'], ['off', 'SVC כבוי'], ['none', 'ללא SVC']] satisfies [SvcFilter, string][], 'svc')}
      ${this.select('WebRTC', 'webrtc', [['', 'כל ה־WebRTC'], ['ok', 'מתנגן'], ['no', 'לא מתנגן'], ['unknown', 'לא ידוע']] satisfies [VerdictFilter, string][], 'webrtc')}
      ${filtersActive(f) ? html`<sw-button size="sm" variant="ghost" data-nvr-clear @click=${() => (this.filters = { ...NO_FILTERS })}>נקה</sw-button>` : nothing}
      ${this.data?.can_batch === true && !this.data.stale
        ? html`<sw-button size="sm" data-nvr-encoding-open ?disabled=${this.batchRunning} title=${this.batchRunning ? BATCH_BUSY : ''} @click=${() => this.openEncoding()}>שינוי קידוד לכמה מצלמות</sw-button>`
        : nothing}
      <sw-button size="sm" icon="refresh" data-nvr-refresh ?disabled=${this.loading} @click=${() => void this.load()}>רענון</sw-button>
      <span class="count" data-nvr-count>${filtersActive(f) ? `${shown} מתוך ${total} זרמים` : `${total} זרמים`}</span>
    </div>`;
  }

  private headerCell(c: (typeof COLUMNS)[number]) {
    const on = this.sort.key === c.sort;
    const aria = on ? (this.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return html`<th scope="col" class=${c.id === 'channel' ? 'c-chan' : ''} aria-sort=${aria} data-col=${c.id}>
      ${c.sort ? html`<button type="button" data-nvr-sort=${c.sort} @click=${() => (this.sort = nextSort(this.sort, c.sort as SortKey))}>${c.label}<span class="arrow" aria-hidden="true">${on ? (this.sort.dir === 'asc' ? '▲' : '▼') : ''}</span></button>` : html`<span style="padding:9px 10px;display:inline-block">${c.label}</span>`}
    </th>`;
  }

  private verdict(r: StreamRow) {
    const v = r.stream?.webrtc ?? 'unknown';
    const known = r.stream !== null;
    return html`<span class="v ${known ? v : 'unknown'}" role="img" aria-label=${known ? VERDICT_HE[v] : DASH} title=${known ? VERDICT_HE[v] : ''} data-verdict=${known ? v : 'none'}>${known ? (v === 'ok' ? CHECK : v === 'no' ? CROSS : DASH) : DASH}</span>`;
  }

  private renderRow(rows: StreamRow[], i: number) {
    const r = rows[i];
    const s = r.stream;
    const first = startsGroup(rows, i);
    const line = this.lines.get(r.key);
    return html`<tr class="${first ? 'first' : 'repeat'} ${r.enabledInArx ? '' : 'off'}" data-stream-row data-camera=${r.cameraKey} data-stream=${s?.stream_ref ?? ''}>
      <td class="muted c-chan" data-col="channel"><span class="ltr">${r.channel}</span></td>
      <td data-col="camera"><span class="cam">${r.online === false ? html`<span class="dot" title="לא מקוונת" data-offline></span>` : nothing}${r.cameraName}</span><span class="chan muted"> ערוץ <span class="ltr">${r.channel}</span></span></td>
      <td data-col="role">${s ? ROLE_HE[s.role] : html`<span class="muted" data-unread>לא נקרא</span>`}</td>
      <td data-col="codec"><span class="ltr"><bdi>${codecLabel(s)}</bdi>${s?.profile ? html` <bdi class="muted">${s.profile}</bdi>` : nothing}</span></td>
      <td data-col="svc">${this.renderSvc(r)}</td>
      <td data-col="resolution"><bdi class="ltr">${resolutionLabel(s)}</bdi></td>
      <td data-col="fps"><span class="ltr">${fpsLabel(s)}</span></td>
      <td data-col="bitrate"><span class="ltr"><bdi>${bitrateLabel(s)}</bdi>${s?.bitrate_mode && s.bitrate_kbps ? html` <span class="muted">${s.bitrate_mode}</span>` : nothing}</span></td>
      <td data-col="gop"><span class="ltr">${numberLabel(s?.gop)}</span></td>
      <td data-col="webrtc">${this.verdict(r)}</td>
      ${this.data?.can_write ? html`<td data-col="edit" class="act">${this.renderPen(r)}</td>` : nothing}
    </tr>${line ? html`<tr class="msg" data-row-line-row><td colspan=${COLUMNS.length + 1} data-nvr-line role="status">${line}</td></tr>` : nothing}`;
  }

  private renderCard(r: StreamRow) {
    const s = r.stream;
    return html`<div class="card ${r.enabledInArx ? '' : 'off'}" data-stream-card data-camera=${r.cameraKey} data-stream=${s?.stream_ref ?? ''}>
      <div class="head"><span class="cam">${r.online === false ? html`<span class="dot" title="לא מקוונת"></span>` : nothing}${r.cameraName}</span><span class="muted">ערוץ <span class="ltr">${r.channel}</span></span><span style="margin-inline-start:auto;display:inline-flex;align-items:center;gap:6px">${this.verdict(r)}${this.renderPen(r)}</span></div>
      ${s
        ? html`<div class="line"><span>${ROLE_HE[s.role]}</span><bdi class="ltr">${codecLabel(s)}</bdi><bdi class="ltr">${resolutionLabel(s)}</bdi><span class="ltr">${fpsLabel(s)}</span></div>
          <div class="line facts"><span class="svcline">SVC ${this.renderSvc(r)}</span><bdi class="ltr">${bitrateLabel(s)}${s.bitrate_mode && s.bitrate_kbps ? ` ${s.bitrate_mode}` : ''}</bdi><span>GOP <span class="ltr">${numberLabel(s.gop)}</span></span>${s.profile ? html`<bdi class="ltr muted">${s.profile}</bdi>` : nothing}</div>`
        : html`<div class="line muted" data-unread>לא נקרא</div>`}
      ${this.lines.get(r.key) ? html`<div class="msgline" data-nvr-line role="status">${this.lines.get(r.key)}</div>` : nothing}
    </div>`;
  }

  private renderBody() {
    const data = this.data;
    if (!data) return nothing;
    const all = flatten(data.cameras);
    const shown = sortRows(applyFilters(all, this.filters), this.sort);
    const c = counts(all);
    const body = !all.length
      ? html`<sw-state-panel state="empty" heading="לא נמצאו מצלמות ב־NVR." actionLabel="רענן" data-nvr-empty @action=${() => void this.load()}></sw-state-panel>`
      : !shown.length
        ? html`<sw-state-panel state="empty" heading="אין זרמים שמתאימים לסינון." actionLabel="נקה סינון" data-nvr-no-match @action=${() => (this.filters = { ...NO_FILTERS })}></sw-state-panel>`
        : html`<div class="wrap" data-nvr-table>
              <table>
                <thead><tr>${COLUMNS.map((col) => this.headerCell(col))}${data.can_write ? html`<th scope="col" data-col="edit"><span class="vh">עריכה</span></th>` : nothing}</tr></thead>
                <tbody>${shown.map((_, i) => this.renderRow(shown, i))}</tbody>
              </table>
            </div>
            <div class="cards" data-nvr-cards>${shown.map((r) => this.renderCard(r))}</div>`;
    return html`
      ${this.batchRunning && this.batch ? this.renderStrip(this.batch) : nothing}
      ${data.stale ? html`<div class="note" data-nvr-stale role="status"><span>${STALE_NOTE}</span><sw-button size="sm" data-nvr-retry ?disabled=${this.loading} @click=${() => void this.load()}>נסה שוב</sw-button></div>` : nothing}
      ${all.length ? this.renderToolbar(shown.length, c.streams) : nothing}
      ${body}`;
  }

  /** A multi-camera change is running: the screen says so and offers the progress ("הצג"). Single changes are disabled meanwhile. */
  private renderStrip(b: Batch) {
    const t = tally(b);
    return html`<div class="note" data-nvr-batch-strip role="status"><span data-nvr-batch-strip-text>${BATCH_BUSY} · <span class="ltr">${t.processed}</span> מתוך <span class="ltr">${t.total}</span></span><sw-button size="sm" data-nvr-batch-show @click=${() => this.batchEl()?.show()}>הצג</sw-button></div>`;
  }

  private renderBatch() {
    const d = this.data;
    if (!d?.can_write) return nothing;
    return html`<nvr-camera-batch .candidates=${this.batchCandidates()} .info=${this.cameraInfo()} .streams=${this.streamRoles()}
      @batch-change=${(e: CustomEvent<{ batch: Batch | null }>) => (this.batch = e.detail.batch)}
      @batch-finished=${(e: CustomEvent<{ batch: Batch }>) => this.onBatchFinished(e.detail.batch)}
      @batch-refresh=${() => void this.load()}
      @encoding-open=${() => this.openEncoding()}></nvr-camera-batch>
      ${d.can_batch === true
        ? html`<nvr-encoding-batch .rows=${encodingStreams(d.cameras, this.details, d.stale)} .details=${this.details}
            @encoding-started=${(e: CustomEvent<{ batch: Batch }>) => void this.batchEl()?.follow(e.detail.batch)}></nvr-encoding-batch>`
        : nothing}`;
  }

  private subheading(): string {
    const r = this.recorder;
    if (!r) return '';
    return [r.name, r.model].filter(Boolean).join(' · ');
  }

  render() {
    const f = this.failure;
    let content;
    if (this.loading && !this.data) content = html`<sw-state-panel state="loading" data-nvr-loading></sw-state-panel>`;
    else if (f?.status === 403) content = html`<sw-state-panel state="forbidden" data-nvr-forbidden></sw-state-panel>`;
    else if (f?.code === 'nvr_not_configured')
      content = html`<sw-state-panel state="empty" heading="אין NVR מחובר" actionLabel="לחיבורים" data-nvr-none @action=${() => (window.location.hash = '#/system/setup')}></sw-state-panel>`;
    else if (f) content = html`<sw-state-panel state="error" heading="ה־NVR אינו זמין." hint=${f.status === 503 ? '' : f.message} actionLabel="נסה שוב" data-nvr-error @action=${() => void this.load()}></sw-state-panel>`;
    else content = this.renderBody();
    return html`<sw-page heading="הגדרות מצלמות" subheading=${this.subheading()}><div data-nvr-cameras data-state=${this.loading && !this.data ? 'loading' : f ? 'error' : this.data?.stale ? 'stale' : 'ready'} style="display:contents">${content}</div></sw-page>
      ${this.data?.can_write ? this.renderEditor() : nothing}
      ${this.renderBatch()}
      <nvr-confirm .model=${this.confirm?.model ?? null} @confirm=${() => void this.confirmed()} @cancel=${() => (this.confirm = null)} @extra=${() => this.openBatch()}></nvr-confirm>
      ${this.renderToast()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-security-cameras': SystemSecurityCameras;
  }
}
