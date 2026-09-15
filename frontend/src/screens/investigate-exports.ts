import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-state-panel';
import type { StateKind } from '../components/sw-badge';
import { demoJobs } from '../fixtures/catalog';
import { isApi } from '../api/session';
import { navigate } from '../router';
import { cancelExport, deleteExport, exportDownloadUrl, exportManifestUrl, formatBytes, listExports, type ExportJob } from '../api/exports';
import { describeError } from '../api/client';

const STATE_LABEL: Record<ExportJob['state'], string> = { queued: 'ממתין', running: 'מוריד', done: 'הושלם', partial: 'חלקי', failed: 'נכשל', cancelled: 'בוטל', interrupted: 'הופסק' };
const STATE_KIND: Record<ExportJob['state'], StateKind> = { queued: 'neutral', running: 'live', done: 'recorded', partial: 'partial', failed: 'error', cancelled: 'unknown', interrupted: 'stale' };

/** SC18 — exports and downloads: durable jobs, progress/cancel/partial/fail, scoped download (chapter 27). */
@customElement('investigate-exports')
export class InvestigateExports extends LitElement {
  @state() private jobs: ExportJob[] | null = null;
  @state() private ffmpeg = true;
  @state() private error = '';
  private timer: number | undefined;

  static styles = css`
    .job {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 180px auto;
      gap: var(--sw-s-3);
      align-items: center;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .job:last-child {
      border-block-end: 0;
    }
    .bar {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
    }
    .bar.fail i {
      background: var(--sw-danger);
    }
    .bar.partial i {
      background: var(--sw-stale);
    }
    .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .title {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .warn {
      font-size: var(--sw-fs-xs);
      color: #b45309;
    }
    @media (max-width: 767px) {
      .job {
        grid-template-columns: 1fr;
      }
    }
  `;

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
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private poll() {
    if (this.jobs?.some((j) => j.state === 'queued' || j.state === 'running')) void this.load();
  }

  private fmt(iso: string, tz: string): string {
    return new Intl.DateTimeFormat('he-IL', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
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
    try {
      await deleteExport(j.id);
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private renderApi() {
    if (this.error && !this.jobs) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel>`;
    if (!this.jobs) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (!this.jobs.length) return html`<sw-state-panel state="empty" heading="אין עבודות ייצוא" hint="פתח הקלטה, בחר טווח ולחץ ייצוא."><div style="margin-block-start:10px"><sw-button variant="primary" icon="history" @click=${() => navigate('/investigate/playback')}>להקלטות</sw-button></div></sw-state-panel>`;
    return html`
      ${this.ffmpeg ? nothing : html`<div class="warn">ffmpeg לא זמין בשרת: קבצי הייצוא נמסרים במיכל המקורי של ה־NVR (Hikvision PS, ניתן לניגון ב־VLC) ולא נחתכים לטווח המדויק.</div>`}
      ${this.error ? html`<div class="warn">${this.error}</div>` : nothing}
      <sw-card>
        ${this.jobs.map((j) => {
          const pct = Math.round((j.progress ?? 0) * 100);
          const done = j.files.filter((f) => f.state === 'downloaded' || f.state === 'remuxed').length;
          return html`<div class="job">
            <div>
              <div class="title"><strong>${j.camera_name}</strong><sw-badge kind=${STATE_KIND[j.state]} label=${STATE_LABEL[j.state]}></sw-badge></div>
              <div class="meta"><span class="ltr">${this.fmt(j.requested_from, j.timezone)} → ${this.fmt(j.requested_to, j.timezone)}</span> · ${j.files.length} קבצים (${done} ירדו) · משוער ${formatBytes(j.estimate_bytes)}${j.actual_from ? html` · בפועל <span class="ltr">${this.fmt(j.actual_from, j.timezone)} → ${this.fmt(j.actual_to ?? j.actual_from, j.timezone)}</span>` : nothing}</div>
              ${j.error ? html`<div class="warn">${j.error}</div>` : nothing}
              ${j.note && (j.state === 'done' || j.state === 'partial') ? html`<div class="meta">${j.note}</div>` : nothing}
              ${j.sha256 ? html`<div class="meta ltr">sha256 ${j.sha256.slice(0, 16)}… · ${j.container}</div>` : nothing}
            </div>
            <div><div class="bar ${j.state === 'failed' ? 'fail' : j.state === 'partial' ? 'partial' : ''}"><i style="inline-size:${pct}%"></i></div><div class="meta">${STATE_LABEL[j.state]} · ${pct}%${j.state === 'running' ? ` · ${formatBytes(j.files.reduce((a, f) => a + f.bytes, 0))}` : ''}</div></div>
            <div class="actions">
              ${j.download_ready ? html`<a href=${exportDownloadUrl(j.id)} download=${j.output_name ?? ''}><sw-button size="sm" icon="download">הורדה</sw-button></a><a href=${exportManifestUrl(j.id)} target="_blank" rel="noopener"><sw-button size="sm" variant="ghost" icon="list">מניפסט</sw-button></a>` : nothing}
              ${j.state === 'queued' || j.state === 'running' ? html`<sw-button size="sm" variant="ghost" icon="close" @click=${() => this.cancel(j)}>בטל</sw-button>` : html`<sw-button size="sm" variant="ghost" icon="trash" @click=${() => this.removeJob(j)}>מחק</sw-button>`}
            </div>
          </div>`;
        })}
      </sw-card>
      <div class="meta">ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר בייצוא, לא שהצילום אותנטי מאז המצלמה. הקבצים נמחקים אוטומטית אחרי תקופת השמירה שבהגדרות.</div>
    `;
  }

  private renderDemo() {
    return html`
      <sw-card>
        ${demoJobs.map(
          (j) => html`<div class="job">
            <div><strong>${j.title}</strong><div class="meta">${j.size} · ${j.hash}</div></div>
            <div><div class="bar ${j.status.startsWith('נכשל') ? 'fail' : ''}"><i style="inline-size:${j.progress}%"></i></div><div class="meta">${j.status} · ${j.progress}%</div></div>
            <div class="actions">
              ${j.progress === 100 ? html`<sw-button size="sm" icon="download">הורדה</sw-button>` : j.status.startsWith('נכשל') ? html`<sw-button size="sm" icon="refresh">נסה שוב</sw-button>` : html`<sw-button size="sm" variant="ghost" icon="close">בטל</sw-button>`}
            </div>
          </div>`,
        )}
      </sw-card>
      <div class="meta">ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר, לא שהצילום אותנטי מאז המצלמה.</div>
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
