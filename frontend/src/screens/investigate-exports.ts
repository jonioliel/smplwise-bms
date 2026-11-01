import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import type { StateKind } from '../components/sw-badge';
import { demoJobs } from '../fixtures/catalog';
import { isApi } from '../api/session';
import { navigate } from '../router';
import { cancelExport, deleteExport, exportDownloadUrl, exportManifestUrl, formatBytes, listExports, type ExportJob } from '../api/exports';
import { ApiError, describeError } from '../api/client';
import { dayMonthText, timeText } from '../api/day-format';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { INVESTIGATE_R5 } from './investigate-r5-css';

const STATE_LABEL: Record<ExportJob['state'], string> = { queued: 'ממתין', running: 'מוריד', done: 'הושלם', partial: 'חלקי', failed: 'נכשל', cancelled: 'בוטל', interrupted: 'הופסק', paused_disk_full: 'מושהה · אין מקום בדיסק' };
const STATE_KIND: Record<ExportJob['state'], StateKind> = { queued: 'neutral', running: 'live', done: 'recorded', partial: 'partial', failed: 'error', cancelled: 'unknown', interrupted: 'stale', paused_disk_full: 'stale' };
/** INVREST-POLISH-2331: the well's tone by state - only what needs a look is tinted (a finished job stays quiet). */
const STATE_TONE: Partial<Record<ExportJob['state'], 'bad' | 'warn'>> = { failed: 'bad', interrupted: 'warn', partial: 'warn', paused_disk_full: 'warn' };
const ACTIVE: ExportJob['state'][] = ['queued', 'running', 'paused_disk_full'];
const ATTENTION: ExportJob['state'][] = ['failed', 'interrupted', 'partial', 'paused_disk_full'];

/** SC18 — exports and downloads: durable jobs, progress/cancel/partial/fail, scoped download (chapter 27). */
@customElement('investigate-exports')
export class InvestigateExports extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private jobs: ExportJob[] | null = null;
  @state() private ffmpeg = true;
  @state() private error = '';
  @state() private forbidden = false;
  /** INVREST-POLISH-2331: deleting a job removes its files - asked first (it used to go on one click). */
  @state() private confirmDelete: ExportJob | null = null;
  @state() private busy = false;
  private timer: number | undefined;

  static styles = [css`
    /* INVREST-POLISH-2331: from a tablet up the screen takes the height the shell leaves it and never scrolls - the summary and the
       note stay put, the job list scrolls inside its own panel. A phone keeps the page scroll. */
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 0;
      min-inline-size: 0;
    }
    sw-page {
      flex: 1;
      min-block-size: 0;
    }
    @media (min-width: 768px) {
      sw-page {
        block-size: 100%;
      }
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      flex: none;
    }
    .summary .r5-well {
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding: 10px 14px;
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
    }
    .summary .r5-well[data-tone='bad'] {
      background: var(--sw-danger-soft);
      box-shadow: none;
    }
    .summary .r5-well[data-tone='warn'] {
      background: var(--sw-warning-soft);
      box-shadow: none;
    }
    .summary .r5-sub {
      color: var(--sw-text-2);
    }
    /* the list panel: the page's primary object (radius lg, shadow 2); it scrolls in its own box */
    .list {
      flex: 0 1 auto;
      min-block-size: 0;
      overflow: auto;
      overscroll-behavior: contain;
      background: var(--sw-surface);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      padding: 4px 12px 12px;
    }
    .group {
      position: sticky;
      inset-block-start: 0;
      z-index: 1;
      background: var(--sw-surface);
      padding: 10px 4px 6px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
      display: flex;
      gap: 6px;
    }
    .group b {
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    /* a job is a well (tone step, rounded): what | how far | what you can do */
    .job {
      display: grid;
      grid-template-columns: minmax(0, 1fr) clamp(170px, 24%, 260px) minmax(0, auto);
      gap: var(--sw-s-3);
      align-items: center;
      padding: 12px 14px;
      margin-block-end: 8px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    .job:last-child {
      margin-block-end: 0;
    }
    .job[data-tone='bad'] {
      background: var(--sw-danger-soft);
    }
    .job[data-tone='warn'] {
      background: var(--sw-warning-soft);
    }
    /* the demo rows' legacy tones */
    .job[data-state='fail'] {
      background: var(--sw-danger-soft);
    }
    .job[data-state='done'] {
      background: var(--sw-success-soft);
    }
    .title {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-block-end: 2px;
    }
    .title strong {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .range {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .pct {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      margin-block-end: 6px;
    }
    .pct b {
      font-size: var(--sw-fs-xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      color: var(--sw-heading);
    }
    .pct span {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
    }
    .bar {
      block-size: 8px;
      border-radius: var(--sw-r-pill);
      background: color-mix(in srgb, var(--sw-text-3) 18%, transparent);
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      border-radius: inherit;
      background: var(--sw-accent);
      transition: inline-size var(--sw-t-med) var(--sw-ease-out);
    }
    .bar.fail i {
      background: var(--sw-danger);
    }
    .bar.partial i {
      background: var(--sw-stale);
    }
    .bar.done i {
      background: var(--sw-success);
    }
    @media (prefers-reduced-motion: reduce) {
      .bar i {
        transition: none;
      }
    }
    .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .actions a {
      text-decoration: none;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .warn {
      font-size: var(--sw-fs-sm);
      color: var(--sw-warning-text);
      background: var(--sw-warning-soft);
      border-radius: var(--sw-r-sm);
      padding: 8px 12px;
      flex: none;
    }
    .foot {
      flex: none;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      max-inline-size: 90ch;
    }
    @media (max-width: 1023px) {
      .job {
        grid-template-columns: minmax(0, 1fr) clamp(150px, 30%, 220px);
      }
      .job .actions {
        grid-column: 1 / -1;
        justify-content: flex-start;
      }
    }
    @media (max-width: 767px) {
      .summary {
        gap: 6px;
      }
      .summary .r5-well {
        flex-direction: column;
        gap: 0;
        padding: 8px 10px;
      }
      .job {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .list {
        padding: 4px 8px 8px;
      }
    }
  `, bubbleChrome, INVESTIGATE_R5];

  connectedCallback() {
    super.connectedCallback();
    if (isApi()) {
      void this.load();
      this.timer = window.setInterval(() => this.poll(), 3000);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
  }

  private async load() {
    try {
      const r = await listExports();
      this.jobs = r.jobs;
      this.ffmpeg = r.ffmpeg;
      this.error = '';
      this.forbidden = false;
    } catch (err) {
      this.forbidden = err instanceof ApiError && err.status === 403;
      this.error = describeError(err);
    }
  }

  private pausedPolledAt = 0;

  private poll() {
    // every 3 s while something moves; every 30 s while the only waiting jobs are paused for a full disk (they resume
    // on their own, at the earliest after a 15 s back-off)
    if (this.jobs?.some((j) => j.state === 'queued' || j.state === 'running')) void this.load();
    else if (this.jobs?.some((j) => j.state === 'paused_disk_full') && Date.now() - this.pausedPolledAt >= 30_000) {
      this.pausedPolledAt = Date.now();
      void this.load();
    }
  }

  /** "01.11 · 11:43:16–11:53:16" on one day; both days when the range crosses midnight. */
  private range(fromIso: string, toIso: string, tz: string): string {
    const a = new Date(fromIso);
    const b = new Date(toIso);
    const o = { timeZone: tz, seconds: true };
    const da = dayMonthText(a, { timeZone: tz });
    const db = dayMonthText(b, { timeZone: tz });
    return da === db ? `${da} · ${timeText(a, o)}–${timeText(b, o)}` : `${da} ${timeText(a, o)} – ${db} ${timeText(b, o)}`;
  }

  private async cancel(j: ExportJob) {
    try {
      await cancelExport(j.id);
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async removeJob(j: ExportJob) {
    this.busy = true;
    try {
      await deleteExport(j.id);
      this.confirmDelete = null;
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderJob(j: ExportJob) {
    const pct = Math.round((j.progress ?? 0) * 100);
    const done = j.files.filter((f) => f.state === 'downloaded' || f.state === 'remuxed').length;
    const moving = j.state === 'running';
    const barTone = j.state === 'failed' ? 'fail' : j.state === 'partial' ? 'partial' : j.state === 'done' ? 'done' : '';
    return html`<div class="job" data-export-job data-job-state=${j.state} data-tone=${STATE_TONE[j.state] ?? nothing}>
      <div>
        <div class="title"><strong>${j.camera_name}</strong><sw-badge kind=${STATE_KIND[j.state]} label=${STATE_LABEL[j.state]}></sw-badge></div>
        <div class="range"><span class="ltr">${this.range(j.requested_from, j.requested_to, j.timezone)}</span></div>
        <div class="meta">${done} מתוך ${j.files.length} קבצים ירדו · משוער ${formatBytes(j.estimate_bytes)}${j.actual_from ? html` · בפועל <span class="ltr">${this.range(j.actual_from, j.actual_to ?? j.actual_from, j.timezone)}</span>` : nothing}</div>
        ${j.error ? html`<div class="meta" style="color:var(--sw-danger-text)">${j.error}</div>` : nothing}
        ${j.note && (j.state === 'done' || j.state === 'partial') ? html`<div class="meta">${j.note}</div>` : nothing}
        ${j.sha256 ? html`<div class="meta"><span class="ltr" title=${`sha256 ${j.sha256}`}>sha256 ${j.sha256.slice(0, 12)}… · ${j.container}</span></div>` : nothing}
      </div>
      <div>
        <div class="pct"><b>${pct}%</b><span>${moving ? formatBytes(j.files.reduce((a, f) => a + f.bytes, 0)) : STATE_LABEL[j.state]}</span></div>
        <div class="bar ${barTone}" role="progressbar" aria-label=${`${j.camera_name} · ${STATE_LABEL[j.state]}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${pct}><i style="inline-size:${pct}%"></i></div>
      </div>
      <div class="actions">
        ${j.download_ready ? html`<a href=${exportDownloadUrl(j.id)} download=${j.output_name ?? ''}><sw-button size="sm" variant="primary" icon="download">הורדה</sw-button></a><a href=${exportManifestUrl(j.id)} target="_blank" rel="noopener"><sw-button size="sm" variant="ghost" icon="list">מניפסט</sw-button></a>` : nothing}
        ${ACTIVE.includes(j.state)
          ? html`<sw-button size="sm" variant="ghost" icon="close" data-export-cancel @click=${() => this.cancel(j)}>בטל</sw-button>`
          : html`<sw-button size="sm" variant="ghost" icon="trash" data-export-delete @click=${() => (this.confirmDelete = j)}>מחק</sw-button>`}
      </div>
    </div>`;
  }

  private renderApi() {
    if (this.forbidden && !this.jobs) return html`<sw-state-panel state="forbidden" hint="ייצוא והורדה דורשים הרשאת ייצוא וידאו."></sw-state-panel>`;
    if (this.error && !this.jobs) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel>`;
    if (!this.jobs) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (!this.jobs.length) return html`<sw-state-panel icon="download" state="empty" heading="אין עבודות ייצוא" hint="פתח הקלטה, בחר טווח ולחץ ייצוא."><div style="margin-block-start:10px"><sw-button variant="primary" icon="history" @click=${() => navigate('/investigate/playback')}>להקלטות</sw-button></div></sw-state-panel>`;
    const active = this.jobs.filter((j) => ACTIVE.includes(j.state));
    const finished = this.jobs.filter((j) => !ACTIVE.includes(j.state));
    const attention = this.jobs.filter((j) => ATTENTION.includes(j.state)).length;
    const ok = this.jobs.filter((j) => j.state === 'done').length;
    return html`
      <div class="summary" data-export-summary>
        <div class="r5-well"><span class="r5-num sm">${active.length}</span><span class="r5-sub">בתהליך</span></div>
        <div class="r5-well"><span class="r5-num sm">${ok}</span><span class="r5-sub">הושלמו במלואם</span></div>
        <div class="r5-well" data-tone=${attention ? 'warn' : nothing}><span class="r5-num sm">${attention}</span><span class="r5-sub">דורשים תשומת לב</span></div>
      </div>
      ${this.ffmpeg ? nothing : html`<div class="warn">ffmpeg לא זמין בשרת: קבצי הייצוא נמסרים במיכל המקורי של ה־NVR (Hikvision PS, ניתן לניגון ב־VLC) ולא נחתכים לטווח המדויק.</div>`}
      ${this.error ? html`<div class="warn" role="alert">${this.error}</div>` : nothing}
      <div class="list" data-export-list>
        ${active.length ? html`<div class="group">פעילות <b>${active.length}</b></div>${active.map((j) => this.renderJob(j))}` : nothing}
        ${finished.length ? html`<div class="group">הסתיימו <b>${finished.length}</b></div>${finished.map((j) => this.renderJob(j))}` : nothing}
      </div>
      <div class="foot">ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר בייצוא, לא שהצילום אותנטי מאז המצלמה. הקבצים נמחקים אוטומטית אחרי תקופת השמירה שבהגדרות.</div>
      ${this.confirmDelete
        ? html`<sw-dialog open heading="מחיקת עבודת ייצוא" subheading=${`${this.confirmDelete.camera_name} · ${this.range(this.confirmDelete.requested_from, this.confirmDelete.requested_to, this.confirmDelete.timezone)}`} @close=${() => (this.confirmDelete = null)}>
            <div class="meta">הקבצים שירדו לשרת יימחקו. ההקלטה עצמה ב־NVR לא נפגעת, ואפשר לייצא את הטווח שוב.</div>
            <sw-button slot="footer" variant="ghost" @click=${() => (this.confirmDelete = null)}>ביטול</sw-button>
            <sw-button slot="footer" variant="danger" icon="trash" data-export-delete-confirm ?disabled=${this.busy} @click=${() => this.removeJob(this.confirmDelete!)}>מחק</sw-button>
          </sw-dialog>`
        : nothing}
    `;
  }

  private renderDemo() {
    return html`
      <div class="list">
        ${demoJobs.map(
          (j) => html`<div class="job" data-state=${j.status.startsWith('נכשל') ? 'fail' : j.progress === 100 ? 'done' : 'run'}>
            <div><div class="title"><strong>${j.title}</strong></div><div class="meta">${j.size} · ${j.hash}</div></div>
            <div><div class="pct"><b>${j.progress}%</b><span>${j.status}</span></div><div class="bar ${j.status.startsWith('נכשל') ? 'fail' : ''}"><i style="inline-size:${j.progress}%"></i></div></div>
            <div class="actions">
              ${j.progress === 100 ? html`<sw-button size="sm" icon="download">הורדה</sw-button>` : j.status.startsWith('נכשל') ? html`<sw-button size="sm" icon="refresh">נסה שוב</sw-button>` : html`<sw-button size="sm" variant="ghost" icon="close">בטל</sw-button>`}
            </div>
          </div>`,
        )}
      </div>
      <div class="foot">ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר, לא שהצילום אותנטי מאז המצלמה.</div>
    `;
  }

  render() {
    const api = isApi();
    return html`
      <sw-page heading="ייצוא והורדות" subheading=${api ? 'עבודות עמידות · ייצוא חלקי אינו מסומן כהצלחה מלאה' : 'עבודות עמידות · ייצוא חלקי אינו מסומן כהצלחה מלאה · נתוני הדגמה'}>
        <sw-button slot="actions" variant="primary" icon="download" @click=${() => navigate('/investigate/playback')}>ייצוא חדש</sw-button>
        ${api ? this.renderApi() : this.renderDemo()}
      </sw-page>
    `;
  }
}
