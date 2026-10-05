import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-field';
import './nvr-confirm';
import { onRemote } from '../api/session';
import { ApiError } from '../api/client';
import { nvrBatch, type Batch, type BatchItem } from '../api/nvr-batch';
import type { ConfirmModel } from './nvr-cameras-edit';
import {
  LAST_KEY,
  MIN_BATCH,
  batchConfirmModel,
  batchView,
  chosen,
  clearSelection,
  filterCandidates,
  focusIndex,
  isTerminal,
  isUnsettled,
  itemLine,
  scrollFor,
  selectAllMatching,
  startErrorLine,
  tally,
  toggleSelection,
  toneOf,
  undoConfirmModel,
  windowOf,
  type BatchCandidate,
  type Tone,
} from './nvr-batch-logic';

type Phase = 'closed' | 'select' | 'confirm' | 'undo-confirm' | 'progress';

/** What the screen needs to know about each camera to name a row (the batch's items carry only the camera id). */
export interface CameraInfo {
  name: string;
  channel: number;
}

const SEL_ROW = 44;
const PROG_ROW = 52;

const CHECK = html`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
const CROSS = html`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>`;

const rememberLast = (id: string | null) => {
  try {
    if (id) window.localStorage.setItem(LAST_KEY, id);
    else window.localStorage.removeItem(LAST_KEY);
  } catch {
    /* storage can be blocked (private window, preview): the server still knows the running batch */
  }
};
const recallLast = (): string | null => {
  try {
    return window.localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
};

/**
 * CR-020 S2 phase C: the multi-camera SVC change of הגדרות › אבטחה › מצלמות - the checklist, the ONE confirmation, the progress of the run
 * the server does in the background, "עצור", the result of a stop or a failure (a line per camera) and the undo of everything the batch saved.
 *
 * Owner decisions 2026-10-03: always on (the server decides `can_batch`), no cap on the number of cameras (the lists draw only the rows in
 * view, the search has "select all that match", progress and result keep the failing camera in view), the run survives closing the page (the
 * screen calls `resume()` after every load), one confirmation for the batch and one for the undo (the press on the toast's "בטל" is that
 * confirmation: `undoAll` sends it at once), after an unknown outcome the SERVER stops and checks read-only - this element only reports it.
 *
 * Talks to the server only through api/nvr-batch.ts; never repeats a request whose answer was lost (it asks for the active batch instead).
 * Events: `batch-change` ({batch}, every poll; null when nothing is shown), `batch-finished` ({batch}: completed in front of the person -
 * the screen shows its toast), `batch-refresh` (the cameras changed or are stale: read the list again).
 */
@customElement('nvr-camera-batch')
export class NvrCameraBatch extends LitElement {
  /** Cameras that can be chosen (the screen's `batchCandidates`). */
  @property({ attribute: false }) candidates: BatchCandidate[] = [];
  @property({ attribute: false }) info: Record<string, CameraInfo> = {};
  /** CR-020 phase D: `camera_id:stream_ref` -> the stream's role label (an encoding batch may hold the main AND the sub of one camera). */
  @property({ attribute: false }) streams: Record<string, string> = {};

  @state() private phase: Phase = 'closed';
  @state() private selected = new Set<string>();
  @state() private fixedId: string | null = null;
  @state() private q = '';
  @state() private line = '';
  @state() private starting = false;
  @state() private batch: Batch | null = null;
  @state() private stopping = false;
  @state() private offline = false;
  @state() private confirmFor: { model: ConfirmModel; run: () => void } | null = null;
  @state() private listTop = 0;
  @state() private viewH = 360;

  private pollSeq = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private follow = true;
  private focusedKey = '';

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
    .tools sw-field {
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
      block-size: clamp(180px, 46dvh, 440px);
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
    @media (max-width: 1100px) {
      .tools sw-field input {
        min-block-size: 44px;
      }
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
      background: transparent;
    }
    .sel[aria-checked='true'] .box {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
    }
    .sel[aria-disabled='true'] .box {
      opacity: 0.6;
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
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .row {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 10px;
      block-size: 52px;
      padding-inline: 12px;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row .txt {
      flex: 1;
      min-inline-size: 0;
      display: grid;
      gap: 1px;
    }
    .row .ln {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row.bad .ln,
    .row.unk .ln {
      color: var(--sw-text-2);
    }
    .row.skip .nm {
      color: var(--sw-text-3);
    }
    .ic {
      flex: none;
      inline-size: 22px;
      block-size: 22px;
      border-radius: 50%;
      display: grid;
      place-items: center;
    }
    .ic.ok {
      color: var(--sw-success, #15803d);
      background: var(--sw-success-soft, #e7f6ec);
    }
    .ic.bad {
      color: var(--sw-danger);
      background: var(--sw-danger-soft);
    }
    .ic.unk {
      color: var(--sw-warning-text, var(--sw-text-2));
      background: var(--sw-warning-soft, var(--sw-surface-2));
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
    }
    .ic.wait::before,
    .ic.skip::before {
      content: '';
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-text-4, #9aa3b2);
    }
    .ic.skip::before {
      opacity: 0.5;
    }
    .ic.spin::before {
      content: '';
      inline-size: 16px;
      block-size: 16px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong);
      border-block-start-color: var(--sw-accent);
      animation: nvr-b-spin 0.8s linear infinite;
    }
    @keyframes nvr-b-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ic.spin::before {
        animation: none;
      }
    }
    .bar {
      block-size: 4px;
      border-radius: 2px;
      background: var(--sw-surface-3, var(--sw-border));
      overflow: hidden;
    }
    .bar > i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      transition: inline-size 0.3s var(--sw-ease, ease);
    }
    .bar.error > i {
      background: var(--sw-danger);
    }
    .bar.done > i {
      background: var(--sw-success, #15803d);
    }
    .msg {
      margin: 0;
      padding: 6px 8px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      .sel {
        block-size: 44px;
      }
    }
  `;

  // ---------------------------------------------------------------------------------------------- the screen's calls

  /** The SVC dialog's "החל גם על מצלמות נוספות": the camera the person started from is ticked and fixed. */
  openSelect(cameraId: string) {
    this.fixedId = cameraId;
    this.selected = new Set([cameraId]);
    this.q = '';
    this.line = '';
    this.listTop = 0;
    this.phase = 'select';
  }

  /** After every load of the screen: a running batch (or the last one the person was looking at) comes back on screen. */
  async resume() {
    if (this.batch) return; // already following one
    try {
      const a = await nvrBatch().active();
      if (a) {
        this.adopt(await this.full(a), true);
        return;
      }
      const last = recallLast();
      if (last) this.adopt(await nvrBatch().get(last), true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) rememberLast(null);
      // anything else: nothing is shown; the screen asks again on its next load
    }
  }

  /** The strip's "הצג". */
  show() {
    if (this.batch) {
      this.follow = true;
      this.phase = 'progress';
    }
  }

  /** The toast's "בטל": the press IS the confirmation (owner Q3 = A), so the request carries it at once. */
  async undoAll(batchId: string) {
    await this.runUndo(batchId);
  }

  /** CR-020 phase D: a bulk encoding batch the encoding dialog just started - followed here exactly like an SVC batch (progress, "עצור", result,
   * undo-all). A batch that already finished by the first read is a live completion (the toast). */
  async followBatch(b: Batch) {
    this.line = '';
    this.phase = 'progress';
    try {
      this.adopt(await this.full(b), false, true);
    } catch {
      this.adopt(b, false, true); // the start's own answer until the next poll reads the whole batch
    }
  }

  // ---------------------------------------------------------------------------------------------- the batch's life

  /** The server pages a batch's items and the start / listing answers carry at most a page: the screen always reads the whole batch by id. */
  private async full(b: Batch): Promise<Batch> {
    return nvrBatch().get(b.batch_id);
  }

  private emit<T>(name: string, detail?: T) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  /** `showNow`: found after a reload - the dialog opens on it (a finished one shows its result). `live`: the person just started it - a batch that already
   * finished by the time of the first read (a short one) is a live completion (the toast), not a result found later. */
  private adopt(b: Batch, showNow = false, live = false) {
    this.pollSeq++;
    this.stopping = false;
    this.offline = false;
    this.focusedKey = '';
    this.follow = true;
    this.batch = b;
    rememberLast(b.batch_id);
    this.emit('batch-change', { batch: b });
    if (showNow) this.phase = 'progress';
    if (this.timer) clearTimeout(this.timer);
    const wait = this.nextDelay(b);
    if (wait !== null) this.armPoll(b.batch_id, wait);
    if (live && isTerminal(b.state)) this.finished(b);
  }

  private nextDelay(b: Batch): number | null {
    if (b.state === 'running') return 1500;
    return isUnsettled(b) ? 5000 : null; // an unknown outcome is settled by the server; keep reading until it is
  }

  /** One pending read at a time; a newer one (or a new batch) replaces it. */
  private armPoll(id: string, delay: number) {
    if (this.timer) clearTimeout(this.timer);
    const mine = this.pollSeq;
    this.timer = setTimeout(() => void this.poll(id, mine), delay);
  }

  private async poll(id: string, mine: number) {
    if (mine !== this.pollSeq) return;
    let b: Batch | null = null;
    try {
      b = await nvrBatch().get(id);
      this.offline = false;
    } catch (err) {
      if (mine !== this.pollSeq) return;
      if (err instanceof ApiError && err.status === 404) {
        this.forget();
        return;
      }
      this.offline = true; // the run goes on at the server; a read is simply tried again
    }
    if (mine !== this.pollSeq) return;
    if (b) this.apply(b);
    const cur = this.batch;
    if (cur && cur.batch_id === id) {
      const wait = b ? this.nextDelay(b) : 3000;
      if (wait !== null) this.armPoll(id, wait);
    }
  }

  private apply(b: Batch) {
    const prev = this.batch;
    this.batch = b;
    if (b.state !== 'running' || (prev && prev.batch_id !== b.batch_id)) this.stopping = false;
    this.emit('batch-change', { batch: b });
    if (prev && prev.batch_id === b.batch_id && prev.state === 'running' && isTerminal(b.state)) this.finished(b);
  }

  private finished(b: Batch) {
    this.emit('batch-refresh');
    if (b.state === 'completed') {
      // finished in front of the person: the toast tells it (with the undo for a write); the dialog gets out of the way
      this.phase = 'closed';
      rememberLast(null);
      this.emit('batch-finished', { batch: b });
    } else {
      this.phase = 'progress'; // a stop, a failure, an unknown outcome or an interruption needs to be seen
      this.follow = true;
    }
  }

  private forget() {
    this.pollSeq++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.batch = null;
    this.phase = 'closed';
    rememberLast(null);
    this.emit('batch-change', { batch: null });
  }

  private closeDialog() {
    if (this.phase === 'progress' && this.batch && isTerminal(this.batch.state) && !isUnsettled(this.batch)) {
      // the person has seen the result: it does not come back after a reload
      this.forget();
      return;
    }
    this.phase = 'closed';
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.pollSeq++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // ---------------------------------------------------------------------------------------------- start, stop, undo

  private nameOf = (i: BatchItem): string => {
    const cam = i.camera_id ? this.info[i.camera_id]?.name ?? i.camera_id : '—';
    const role = this.batch?.mode === 'encoding' && i.camera_id ? this.streams[`${i.camera_id}:${i.stream_ref}`] : '';
    return role ? `${cam} · ${role}` : cam;
  };

  private pickedNames(): string[] {
    return chosen(this.candidates, this.selected).map((c) => c.name);
  }

  private askStart() {
    if (chosen(this.candidates, this.selected).length < MIN_BATCH) return;
    this.line = '';
    this.confirmFor = { model: batchConfirmModel(this.pickedNames()), run: () => void this.start() };
    this.phase = 'confirm';
  }

  /** The request is sent ONCE. A refusal sends the person back to the checklist; a lost answer is checked by reading the active batch (never by repeating). */
  private async start() {
    this.confirmFor = null;
    const picked = chosen(this.candidates, this.selected);
    if (picked.length < MIN_BATCH) {
      this.phase = 'select';
      return;
    }
    const targets = picked.map((c) => ({ camera_id: c.cameraId, stream_ref: c.streamRef, if_match: c.etag }));
    const recorder = new Set(picked.map((c) => c.recorderId));
    this.starting = true;
    this.batch = null;
    this.line = '';
    this.phase = 'progress';
    try {
      const b = await nvrBatch().start({ confirm: true, changes: { svc: false }, targets, ...(recorder.size === 1 ? { recorder_id: picked[0].recorderId } : {}) });
      this.adopt(await this.full(b), false, true);
      this.starting = false;
    } catch (err) {
      this.starting = false;
      const sent = !(err instanceof ApiError) || err.status >= 500; // the answer may have been lost after the batch started
      if (sent) {
        try {
          const a = await nvrBatch().active();
          if (a) {
            this.adopt(await this.full(a));
            return;
          }
        } catch {
          /* cannot read either: say so below */
        }
      }
      const shape = err instanceof ApiError ? { status: err.status, code: err.code, user_message: err.body.user_message, details: err.body.details ?? {} } : { status: 0, code: 'network' };
      const l = startErrorLine(shape, (idx) => {
        const c = picked[idx];
        return c ? c.name : null;
      });
      this.line = l.text;
      this.phase = 'select';
      if (l.reload) this.emit('batch-refresh');
    }
  }

  private async stop() {
    const b = this.batch;
    if (!b || this.stopping) return;
    this.stopping = true;
    this.line = '';
    try {
      const after = await nvrBatch().stop(b.batch_id);
      if (after) this.apply(after);
    } catch (err) {
      if (!(err instanceof ApiError)) this.offline = true;
      else this.line = startErrorLine({ status: err.status, code: err.code, user_message: err.body.user_message }).text;
      this.stopping = false;
    }
    if (this.batch && this.batch.batch_id === b.batch_id && !isTerminal(this.batch.state)) this.armPoll(b.batch_id, 400);
  }

  /** The result's "בטל את מה שנשמר": one confirmation, then the rollback batch. */
  private askUndo() {
    const b = this.batch;
    if (!b) return;
    const sourceId = b.kind === 'rollback' ? b.rollback_of : b.batch_id;
    if (!sourceId) return;
    const names = (b.items ?? []).filter((i) => (b.kind === 'rollback' ? toneOf(i) !== 'ok' : i.status === 'applied')).map(this.nameOf);
    this.line = '';
    this.confirmFor = { model: undoConfirmModel(names, b.mode), run: () => void this.runUndo(sourceId) };
    this.phase = 'undo-confirm';
  }

  private async runUndo(sourceId: string) {
    this.confirmFor = null;
    const keep = this.batch;
    this.starting = true;
    this.line = '';
    this.phase = 'progress';
    try {
      const b = await nvrBatch().undo(sourceId);
      this.adopt(await this.full(b), false, true);
      this.starting = false;
    } catch (err) {
      this.starting = false;
      const sent = !(err instanceof ApiError) || err.status >= 500;
      if (sent) {
        try {
          const a = await nvrBatch().active();
          if (a) {
            this.adopt(await this.full(a));
            return;
          }
        } catch {
          /* fall through to the line */
        }
      }
      const shape = err instanceof ApiError ? { status: err.status, code: err.code, user_message: err.body.user_message, details: err.body.details ?? {} } : { status: 0, code: 'network' };
      this.line = startErrorLine(shape).text;
      if (keep) {
        this.batch = keep;
        this.phase = 'progress';
      } else this.phase = 'closed';
    }
  }

  // ---------------------------------------------------------------------------------------------- lists

  protected willUpdate(changed: PropertyValues) {
    if (changed.has('candidates') && this.selected.size) {
      const ids = new Set(this.candidates.map((c) => c.cameraId));
      const kept = [...this.selected].filter((id) => ids.has(id));
      if (kept.length !== this.selected.size) this.selected = new Set(kept);
      if (this.fixedId && !ids.has(this.fixedId)) this.fixedId = null;
    }
  }

  protected updated() {
    const vl = this.renderRoot.querySelector<HTMLElement>('.vl');
    if (!vl) return;
    if (Math.abs(vl.clientHeight - this.viewH) > 1 && vl.clientHeight > 0) this.viewH = vl.clientHeight;
    // progress: keep the camera in flight (or the failed one) in view until the person scrolls by hand
    if (this.phase === 'progress' && this.batch?.items?.length && this.follow) {
      const b = this.batch;
      const key = `${b.batch_id}:${b.state}:${focusIndex(b)}`;
      if (key !== this.focusedKey) {
        this.focusedKey = key;
        vl.scrollTop = scrollFor(focusIndex(b), vl.clientHeight || this.viewH, PROG_ROW);
      }
    }
  }

  private onScroll = (e: Event) => {
    this.listTop = (e.target as HTMLElement).scrollTop;
  };

  private takeControl = () => {
    this.follow = false;
  };

  private vlist(n: number, rowH: number, kind: 'select' | 'progress', row: (i: number) => TemplateResult, label: string) {
    const w = windowOf(this.listTop, this.viewH, n, rowH);
    const idx: number[] = [];
    for (let i = w.start; i < w.end; i++) idx.push(i);
    return html`<div class="vl" role="list" aria-label=${label} tabindex="0" data-nvr-batch-list=${kind} data-rows=${n} @scroll=${this.onScroll} @wheel=${this.takeControl} @touchstart=${this.takeControl} @pointerdown=${this.takeControl}>
      <div class="space" style="padding-block:${w.top}px ${Math.max(0, w.total - w.top - (w.end - w.start) * rowH)}px">${repeat(idx, (i) => i, (i) => row(i))}</div>
    </div>`;
  }

  private selectRow(c: BatchCandidate) {
    const on = this.selected.has(c.cameraId);
    const fixed = c.cameraId === this.fixedId;
    return html`<button type="button" class="sel" role="checkbox" aria-checked=${on ? 'true' : 'false'} aria-disabled=${fixed ? 'true' : 'false'} data-nvr-batch-cam=${c.cameraId}
      @click=${() => (this.selected = toggleSelection(this.selected, c.cameraId, this.fixedId))}>
      <span class="box" aria-hidden="true">${on ? CHECK : nothing}</span><span class="nm">${c.name}</span><span class="meta">ערוץ <span class="ltr">${c.channel}</span> · <bdi class="ltr">H.264</bdi></span>
    </button>`;
  }

  private renderSelect() {
    const matching = filterCandidates(this.candidates, this.q);
    const ticked = chosen(this.candidates, this.selected).length;
    const filtered = this.q.trim().length > 0;
    return html`<sw-dialog wide ?open=${this.phase === 'select'} heading="כיבוי SVC בכמה מצלמות" data-nvr-batch-select @close=${(e: Event) => {
      e.stopPropagation();
      this.phase = 'closed';
    }}>
      ${this.phase === 'select'
        ? html`<div class="tools">
              <sw-field><input type="search" placeholder="חיפוש מצלמה" aria-label="חיפוש מצלמה" data-nvr-batch-search .value=${this.q} @input=${(e: Event) => {
                this.q = (e.target as HTMLInputElement).value;
                this.listTop = 0;
                const vl = this.renderRoot.querySelector<HTMLElement>('.vl');
                if (vl) vl.scrollTop = 0;
              }} /></sw-field>
              <sw-button size="sm" data-nvr-batch-all ?disabled=${!matching.length} @click=${() => (this.selected = selectAllMatching(this.selected, matching))}>${filtered ? `בחר הכל (${matching.length})` : 'בחר הכל'}</sw-button>
              <sw-button size="sm" variant="ghost" data-nvr-batch-clear @click=${() => (this.selected = clearSelection(this.fixedId))}>נקה</sw-button>
            </div>
            <div class="count" data-nvr-batch-count role="status">${`נבחרו ${ticked} מתוך ${this.candidates.length}`}${filtered ? ` · ${matching.length} תוצאות` : ''}</div>
            ${matching.length
              ? this.vlist(matching.length, SEL_ROW, 'select', (i) => this.selectRow(matching[i]), 'מצלמות')
              : html`<p class="msg" data-nvr-batch-none role="status">אין מצלמות שמתאימות לחיפוש.</p>`}
            ${this.line ? html`<p class="msg" data-nvr-batch-line role="alert">${this.line}</p>` : nothing}
            ${onRemote() ? nothing : html`<div><sw-button size="sm" variant="ghost" data-nvr-batch-to-encoding @click=${() => {
              this.phase = 'closed';
              this.emit('encoding-open');
            }}>שינוי קידוד לכמה מצלמות</sw-button></div>`}
            <sw-button slot="footer" variant="ghost" data-nvr-batch-cancel @click=${() => (this.phase = 'closed')}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-nvr-batch-next ?disabled=${ticked < MIN_BATCH} @click=${() => this.askStart()}>המשך</sw-button>`
        : nothing}
    </sw-dialog>`;
  }

  private icon(t: Tone) {
    return html`<span class="ic ${t}" aria-hidden="true">${t === 'ok' ? CHECK : t === 'bad' ? CROSS : t === 'unk' ? '?' : nothing}</span>`;
  }

  private progressRow(b: Batch, i: BatchItem) {
    const t = toneOf(i);
    const line = itemLine(i, b.kind);
    const info = i.camera_id ? this.info[i.camera_id] : null;
    return html`<div class="row ${t}" role="listitem" data-nvr-batch-item=${i.index} data-status=${i.status}>
      ${this.icon(t)}
      <div class="txt"><span class="nm">${this.nameOf(i)}${info ? html` <span class="meta">ערוץ <span class="ltr">${info.channel}</span></span>` : nothing}</span>${line ? html`<span class="ln" data-nvr-batch-item-line title=${line}>${line}</span>` : nothing}</div>
    </div>`;
  }

  private renderProgress() {
    const b = this.batch;
    const open = this.phase === 'progress';
    if (!open) return html`<sw-dialog wide data-nvr-batch-progress></sw-dialog>`;
    if (!b) {
      // the request was sent; the server's answer has not arrived
      return html`<sw-dialog wide open heading=${this.starting ? 'מתחיל' : 'שינוי מרובה'} data-nvr-batch-progress @close=${(e: Event) => { e.stopPropagation(); this.phase = 'closed'; }}>
        ${this.starting ? html`<div class="bar" role="progressbar" aria-label="מתחיל"><i style="inline-size:8%"></i></div>` : nothing}
        ${this.line ? html`<p class="msg" data-nvr-batch-line role="alert">${this.line}</p>` : nothing}
        ${this.starting ? nothing : html`<sw-button slot="footer" variant="primary" data-nvr-batch-close @click=${() => (this.phase = 'closed')}>סגור</sw-button>`}
      </sw-dialog>`;
    }
    const v = batchView(b, this.nameOf, this.stopping);
    const t = tally(b);
    const pct = t.total ? Math.round((t.processed / t.total) * 100) : 0;
    const items = b.items ?? [];
    return html`<sw-dialog wide open heading=${v.title} subheading=${v.sub} data-nvr-batch-progress data-state=${b.state} data-kind=${b.kind} @close=${(e: Event) => {
      e.stopPropagation();
      this.closeDialog();
    }}>
      <div class="bar ${v.tone === 'error' || v.tone === 'warn' ? 'error' : v.tone === 'done' ? 'done' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax=${t.total} aria-valuenow=${t.processed} aria-label="התקדמות"><i style="inline-size:${pct}%"></i></div>
      ${this.vlist(items.length, PROG_ROW, 'progress', (i) => this.progressRow(b, items[i]), 'מצלמות')}
      ${this.offline ? html`<p class="msg" data-nvr-batch-offline role="status">אין חיבור לשרת. ממשיך לנסות.</p>` : nothing}
      ${this.line ? html`<p class="msg" data-nvr-batch-line role="alert">${this.line}</p>` : nothing}
      ${v.canStop ? html`<sw-button slot="footer" variant="danger" data-nvr-batch-stop @click=${() => void this.stop()}>עצור</sw-button>` : nothing}
      ${v.showUndo ? html`<sw-button slot="footer" data-nvr-batch-undo ?disabled=${!v.canUndo} title=${v.canUndo ? '' : 'לא ברור אם בוצע. נבדק מול ה־NVR.'} @click=${() => this.askUndo()}>בטל את מה שנשמר</sw-button>` : nothing}
      ${v.showRetry ? html`<sw-button slot="footer" data-nvr-batch-retry @click=${() => this.askUndo()}>נסה שוב</sw-button>` : nothing}
      ${isTerminal(b.state) ? html`<sw-button slot="footer" variant="primary" data-nvr-batch-close @click=${() => this.closeDialog()}>סגור</sw-button>` : nothing}
    </sw-dialog>`;
  }

  render() {
    return html`${this.renderSelect()}
      <nvr-confirm .model=${this.phase === 'confirm' || this.phase === 'undo-confirm' ? this.confirmFor?.model ?? null : null}
        @confirm=${(e: Event) => {
          e.stopPropagation();
          const f = this.confirmFor;
          if (f) f.run();
        }}
        @cancel=${(e: Event) => {
          e.stopPropagation();
          const back = this.phase === 'confirm' ? 'select' : 'progress';
          this.confirmFor = null;
          this.phase = back;
        }}></nvr-confirm>
      ${this.renderProgress()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nvr-camera-batch': NvrCameraBatch;
  }
}

