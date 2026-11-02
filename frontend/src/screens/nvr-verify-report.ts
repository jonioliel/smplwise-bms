import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-tabs';
import { ApiError } from '../api/client';
import { nvrBatch, type Batch, type BatchItem } from '../api/nvr-batch';
import type { CameraInfo } from './nvr-camera-batch';
import {
  RECHECK_HINT,
  isVerifyActive,
  outcomeLabel,
  outcomeTone,
  recentLabel,
  recentReports,
  recheckErrorLine,
  reportTitle,
  verifyRows,
  verifySummary,
  verifyTabs,
  whenLabel,
  type VerifyTab,
} from './nvr-verify-logic';

const POLL_MS = 2000;

/**
 * CAM-H264-VERIFY-2361: "דוח בדיקה" of a bulk encoding change (the H.264 preset, any encoding batch, or their undo). Per stream what the
 * server found - "המקליט קיבל" / "המצלמה אישרה (H.264)" / "עדיין H.265" / "צריך אתחול" / "נכשל: <reason>" - with one line that explains it;
 * a tab "מצלמות שלא השתנו" (the worklist), a tab of the streams the change stepped over, and "בדוק שוב" (a READ-ONLY re-check on the server:
 * the NVR's stream list and what each camera sends; nothing is written). The report is kept with the batch: `showList()` opens the earlier ones.
 * The server's lines are rendered as text only. Reads only: the batch by id, the latest batches, and the re-check request.
 */
@customElement('nvr-verify-report')
export class NvrVerifyReport extends LitElement {
  /** camera id -> name and channel (the host's camera list). */
  @property({ attribute: false }) info: Record<string, CameraInfo> = {};
  /** `camera_id:stream_ref` -> the stream's role label. */
  @property({ attribute: false }) streams: Record<string, string> = {};

  @state() private open = false;
  @state() private view: 'report' | 'list' = 'report';
  @state() private fromList = false;
  @state() private batch: Batch | null = null;
  @state() private recent: Batch[] | null = null;
  @state() private tab: VerifyTab = 'all';
  @state() private line = '';
  @state() private busy = false;
  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  static styles = css`
    :host {
      display: contents;
    }
    .sum {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .hint {
      margin: 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .list {
      display: grid;
      align-content: start;
      max-block-size: clamp(180px, 46dvh, 440px);
      overflow-y: auto;
      overscroll-behavior: contain;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 2px 10px;
      align-items: center;
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .nm {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ln {
      grid-column: 1 / -1;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .chip {
      justify-self: end;
      padding: 2px 8px;
      border-radius: var(--sw-r-pill, 999px);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium, 500);
      white-space: nowrap;
      max-inline-size: 46vw;
      overflow: hidden;
      text-overflow: ellipsis;
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .chip.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .chip.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .chip.bad {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .pick {
      all: unset;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 44px;
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .pick:hover {
      background: var(--sw-surface-2);
    }
    .pick:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .msg {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
  `;

  /** Opens one batch's report (and keeps reading it while the server still checks). */
  async show(batchId: string, fromList = false) {
    this.open = true;
    this.view = 'report';
    this.fromList = fromList;
    this.tab = 'all';
    this.line = '';
    this.batch = this.batch?.batch_id === batchId ? this.batch : null;
    await this.read(batchId, ++this.seq);
  }

  /** Opens the list of earlier reports (the latest encoding changes of this installation). */
  async showList() {
    this.stopPolling();
    this.open = true;
    this.view = 'list';
    this.line = '';
    this.recent = null;
    try {
      this.recent = recentReports(await nvrBatch().recent());
    } catch {
      this.recent = [];
      this.line = 'לא ניתן לקרוא את הדוחות.';
    }
  }

  private async read(id: string, mine: number) {
    try {
      const b = await nvrBatch().get(id);
      if (mine !== this.seq || !this.open) return;
      this.batch = b;
      if (this.tab !== 'all' && !verifyRows(b, this.tab).length) this.tab = 'all';
      if (b.state === 'running' || isVerifyActive(b.verify)) this.arm(id, mine);
    } catch (err) {
      if (mine !== this.seq) return;
      this.line = err instanceof ApiError && err.status === 404 ? 'הדוח לא נמצא.' : 'אין חיבור לשרת. ממשיך לנסות.';
      if (!(err instanceof ApiError && err.status === 404)) this.arm(id, mine);
    }
  }

  private arm(id: string, mine: number) {
    this.stopPolling();
    this.timer = setTimeout(() => void this.read(id, mine), POLL_MS);
  }

  private stopPolling() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private close() {
    this.seq++;
    this.stopPolling();
    this.open = false;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.seq++;
    this.stopPolling();
  }

  /** "בדוק שוב": a read-only re-check on the server (sent once per press; the button waits for the answer). */
  private async recheck() {
    const b = this.batch;
    if (!b || this.busy) return;
    this.busy = true;
    this.line = '';
    try {
      this.batch = await nvrBatch().recheck(b.batch_id);
      this.arm(b.batch_id, this.seq);
    } catch (err) {
      const shape = err instanceof ApiError ? { status: err.status, code: err.code, user_message: err.body.user_message } : { status: 0, code: 'network' };
      this.line = recheckErrorLine(shape);
    } finally {
      this.busy = false;
    }
  }

  private nameOf(i: BatchItem): string {
    const cam = i.camera_id ? this.info[i.camera_id]?.name ?? i.camera_id : '—';
    const role = i.camera_id ? this.streams[`${i.camera_id}:${i.stream_ref}`] : '';
    return role ? `${cam} · ${role}` : cam;
  }

  private row(i: BatchItem) {
    const v = i.verify ?? null;
    const label = v ? outcomeLabel(v) : isVerifyActive(this.batch?.verify) ? 'בבדיקה' : 'לא נבדק';
    const ch = i.camera_id ? this.info[i.camera_id]?.channel : undefined;
    return html`<div class="row" role="listitem" data-nvr-verify-item=${i.index} data-outcome=${v?.outcome ?? ''}>
      <span class="nm">${this.nameOf(i)}${ch !== undefined ? html` <span class="meta">ערוץ <span class="ltr">${ch}</span></span>` : nothing}</span>
      <span class="chip ${outcomeTone(v)}" data-nvr-verify-chip title=${label}>${label}</span>
      ${v?.detail ? html`<span class="ln" data-nvr-verify-detail>${v.detail}</span>` : nothing}
    </div>`;
  }

  private renderReport() {
    const b = this.batch;
    if (!b) return html`<p class="msg" role="status">טוען…</p>${this.line ? html`<p class="msg" role="alert">${this.line}</p>` : nothing}`;
    const rows = verifyRows(b, this.tab);
    const tabs = verifyTabs(b);
    const can = !!b.verify?.can_recheck && !this.busy;
    return html`<p class="sum" data-nvr-verify-summary role="status">${verifySummary(b.verify) || 'אין בדיקה לשינוי הזה.'}</p>
      <sw-tabs data-nvr-verify-tabs .items=${tabs} .active=${this.tab} group-label="דוח בדיקה" @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id as VerifyTab)}></sw-tabs>
      ${rows.length
        ? html`<div class="list" role="list" aria-label="זרמים" data-nvr-verify-list=${this.tab}>${repeat(rows, (i) => i.index, (i) => this.row(i))}</div>`
        : html`<p class="msg" data-nvr-verify-empty role="status">${this.tab === 'worklist' ? 'כל המצלמות השתנו.' : 'אין זרמים ברשימה הזו.'}</p>`}
      <p class="hint" data-nvr-verify-hint>${RECHECK_HINT}</p>
      ${this.line ? html`<p class="msg" data-nvr-verify-line role="alert">${this.line}</p>` : nothing}
      ${this.fromList ? html`<sw-button slot="footer" variant="ghost" data-nvr-verify-back @click=${() => void this.showList()}>לכל הדוחות</sw-button>` : nothing}
      <sw-button slot="footer" data-nvr-verify-recheck ?disabled=${!can} title=${RECHECK_HINT} @click=${() => void this.recheck()}>${this.busy ? 'שולח…' : 'בדוק שוב'}</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-verify-close @click=${() => this.close()}>סגור</sw-button>`;
  }

  private renderList() {
    const list = this.recent;
    return html`${list === null
        ? html`<p class="msg" role="status">טוען…</p>`
        : list.length
          ? html`<div class="list" role="list" aria-label="דוחות" data-nvr-verify-reports>${repeat(list, (b) => b.batch_id, (b) => html`<button type="button" class="pick" role="listitem" data-nvr-verify-open=${b.batch_id} @click=${() => void this.show(b.batch_id, true)}>${recentLabel(b)}</button>`)}</div>`
          : html`<p class="msg" data-nvr-verify-none role="status">אין עדיין דוחות של שינוי קידוד.</p>`}
      ${this.line ? html`<p class="msg" role="alert">${this.line}</p>` : nothing}
      <sw-button slot="footer" variant="primary" data-nvr-verify-close @click=${() => this.close()}>סגור</sw-button>`;
  }

  render() {
    const b = this.batch;
    const heading = this.view === 'list' ? 'דוחות בדיקה' : b ? reportTitle(b) : 'דוח בדיקה';
    const sub = this.view === 'report' && b ? whenLabel(b.verify?.checked_at ?? b.created_at ?? null) : '';
    return html`<sw-dialog wide ?open=${this.open} heading=${heading} subheading=${sub} data-nvr-verify data-view=${this.view} @close=${(e: Event) => {
      e.stopPropagation();
      this.close();
    }}>${this.open ? (this.view === 'list' ? this.renderList() : this.renderReport()) : nothing}</sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nvr-verify-report': NvrVerifyReport;
  }
}
