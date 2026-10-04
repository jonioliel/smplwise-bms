import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-drawer';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { getMeter, meterSeries, pauseMeter, removeMeter, replaceMeter, resumeMeter, type MeterDetail, type MeterStatus, type SeriesPoint, type SeriesStep } from '../api/electricity-meters';
import { fmtDate, fmtDateTime, fmtKwh, fmtTime } from './format';
import { elecCss } from './styles';
import { SkinController } from '../design/skin';

export const STATUS_LABEL: Record<MeterStatus, string> = { reporting: 'מדווח', stale: 'לא מדווח', paused: 'מושהה' };
export const STATUS_CLASS: Record<MeterStatus, string> = { reporting: 'c-ok', stale: 'c-warn', paused: 'c-mut' };

type Range = 'hours' | 'days' | 'months';
const RANGE_LABEL: Record<Range, string> = { hours: '24 שעות', days: '30 ימים', months: '12 חודשים' };
const REASON_LABEL: Record<string, string> = { install: 'התקנה', reset: 'איפוס', replace: 'החלפת מונה', source_change: 'שינוי מקור' };

/** A bar chart of kWh: the oldest bar at the start side (right in RTL), values on the bars when there are few of them. */
export function barChart(data: { label: string; value: number }[], ariaLabel: string) {
  const W = 640;
  const H = 170;
  const pad = 26;
  if (!data.length) return html`<div class="mut">אין נתונים לתקופה</div>`;
  const max = Math.max(...data.map((d) => d.value), 1) * 1.15;
  const bw = (W - pad * 2) / data.length;
  const labelEvery = Math.ceil(data.length / 12);
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label=${ariaLabel} data-chart>
    <line x1=${pad} x2=${W - pad} y1=${H - 22} y2=${H - 22} class="grid" />
    ${data.map((d, i) => {
      const bh = (d.value / max) * (H - 44);
      const x = W - pad - (i + 1) * bw + bw * 0.18;
      const last = i === data.length - 1;
      return html`<rect class=${last ? 'bar hi' : 'bar'} x=${x} y=${H - 22 - bh} width=${bw * 0.64} height=${bh} rx="3" />
        ${i % labelEvery === 0 || last ? html`<text x=${x + bw * 0.32} y=${H - 6} text-anchor="middle">${d.label}</text>` : nothing}
        ${data.length <= 14 ? html`<text x=${x + bw * 0.32} y=${H - 26 - bh} text-anchor="middle" class="val">${Math.round(d.value)}</text>` : nothing}`;
    })}
  </svg>`;
}

/**
 * The meter card (mockup "כרטיס מונה"): a drawer with the status, the reading, the consumption chart, the counter lives (epochs) and the
 * actions - replace the counter, pause or resume, remove. Fires `close` and `changed` (after a change: the list reloads).
 */
@customElement('elec-meter-card')
export class ElecMeterCard extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property() meterId = '';
  @property({ type: Boolean }) canManage = false;

  @state() private detail: MeterDetail | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private range: Range = 'days';
  @state() private points: SeriesPoint[] = [];
  @state() private chartError = false;
  @state() private dlg: '' | 'remove' | 'replace' = '';
  @state() private busy = false;
  @state() private actionError = '';
  @state() private finalReading = '';
  @state() private startReading = '0';
  @state() private note = '';
  @state() private replaceError = '';
  private seq = 0;

  static styles = [
    elecCss,
    css`
      :host {
        display: contents;
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 4px 0 8px;
      }
      dl.kv {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 6px 14px;
        margin: 0;
        font-size: var(--sw-fs-sm);
      }
      dl.kv dt {
        color: var(--sw-text-3);
      }
      dl.kv dd {
        margin: 0;
        min-inline-size: 0;
        overflow-wrap: anywhere;
      }
      h3 {
        margin: 0;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
      }
      svg.chart {
        inline-size: 100%;
        block-size: auto;
        display: block;
      }
      svg.chart .grid {
        stroke: var(--sw-border-strong);
      }
      svg.chart .bar {
        fill: var(--sw-accent);
        opacity: 0.45;
      }
      svg.chart .bar.hi {
        opacity: 1;
      }
      svg.chart text {
        fill: var(--sw-text-3);
        font-size: 11px;
      }
      svg.chart text.val {
        fill: var(--sw-text-2);
      }
      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }
      .form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .form .wide {
        grid-column: 1 / -1;
      }
      @media (max-width: 520px) {
        .form {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('meterId') && this.meterId) void this.load();
  }

  private async load() {
    const my = ++this.seq;
    this.phase = 'loading';
    try {
      const d = await getMeter(this.meterId);
      if (my !== this.seq) return;
      this.detail = d;
      this.phase = 'ready';
      void this.loadSeries();
    } catch (err) {
      if (my !== this.seq) return;
      this.error = describeError(err);
      this.phase = 'error';
    }
  }

  private async loadSeries() {
    const range = this.range;
    const step: SeriesStep = range === 'hours' ? '1h' : '1d';
    const span = range === 'hours' ? 1 : range === 'days' ? 30 : 365;
    const to = new Date();
    const from = new Date(to.getTime() - span * 86_400_000);
    try {
      let pts = await meterSeries(this.meterId, step, from.toISOString(), to.toISOString());
      if (range === 'months') pts = monthly(pts);
      if (range !== this.range) return;
      this.points = pts;
      this.chartError = false;
    } catch {
      this.chartError = true;
    }
  }

  private label(p: SeriesPoint): string {
    const d = new Date(p.t);
    if (this.range === 'hours') return fmtTime(p.t).slice(0, 2);
    if (this.range === 'months') return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
    return String(d.getDate());
  }

  private fire(name: string) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }

  private async toggleStatus() {
    const d = this.detail;
    if (!d || this.busy) return;
    this.busy = true;
    this.actionError = '';
    try {
      await (d.status === 'paused' ? resumeMeter(d) : pauseMeter(d));
      this.fire('changed');
      await this.load();
    } catch (err) {
      this.actionError = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async confirmRemove() {
    const d = this.detail;
    if (!d || this.busy) return;
    this.busy = true;
    this.actionError = '';
    try {
      await removeMeter(d);
      this.dlg = '';
      this.fire('changed');
      this.fire('close');
    } catch (err) {
      this.actionError = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private openReplace() {
    this.finalReading = this.detail?.reading_kwh != null ? String(this.detail.reading_kwh) : '';
    this.startReading = '0';
    this.note = '';
    this.replaceError = '';
    this.dlg = 'replace';
  }

  private async replace() {
    const d = this.detail;
    const fin = Number(this.finalReading);
    const start = Number(this.startReading);
    if (!d || this.busy) return;
    if (this.finalReading.trim() === '' || !Number.isFinite(fin) || fin < 0) return void (this.replaceError = 'צריך להזין קריאה סופית תקינה');
    if (this.startReading.trim() === '' || !Number.isFinite(start) || start < 0) return void (this.replaceError = 'צריך להזין קריאת התחלה תקינה');
    this.busy = true;
    this.replaceError = '';
    try {
      this.detail = await replaceMeter(d, { final_reading_kwh: fin, start_reading_kwh: start, note: this.note.trim() || undefined });
      this.dlg = '';
      this.fire('changed');
    } catch (err) {
      this.replaceError = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderBody(d: MeterDetail) {
    const data = this.points.map((p) => ({ label: this.label(p), value: p.kwh }));
    return html`<div class="body" data-meter-card=${d.id}>
      <div class="row"><span class="chip ${STATUS_CLASS[d.status]}" data-meter-status=${d.status}>${STATUS_LABEL[d.status]}</span></div>
      <dl class="kv">
        <dt>אזור</dt><dd>${d.area_name ?? '-'}${d.floor_name ? ` · ${d.floor_name}` : ''}</dd>
        <dt>קריאה נוכחית</dt><dd><span class="num">${fmtKwh(d.reading_kwh)}</span> <span class="mut">קוט״ש</span></dd>
        <dt>דיווח אחרון</dt><dd><span class="num">${fmtDateTime(d.last_report_at)}</span></dd>
        <dt>יחידה</dt><dd>קוט״ש · מונה מצטבר</dd>
        <dt>בחשבונות</dt><dd>${d.accounts.length ? d.accounts.join(', ') : html`<span class="mut">-</span>`}</dd>
      </dl>
      <div class="row"><h3>צריכה</h3><span class="sp"></span>
        <div class="seg" role="group" aria-label="טווח">${(['hours', 'days', 'months'] as Range[]).map((r) => html`<button type="button" aria-pressed=${this.range === r ? 'true' : 'false'} data-range=${r} @click=${() => { this.range = r; void this.loadSeries(); }}>${RANGE_LABEL[r]}</button>`)}</div></div>
      ${this.chartError ? html`<div class="alert err" role="alert">לא ניתן לטעון את גרף הצריכה</div>` : barChart(data, `גרף צריכה, ${RANGE_LABEL[this.range]}`)}
      <h3>תקופות מונה</h3>
      <div class="list" data-epochs>${d.epochs.map((e) => html`<div class="li"><div class="grow"><div class="t1">${REASON_LABEL[e.reason] ?? e.reason} · <span class="num">${fmtDate(e.started_at)}</span></div>
        <div class="t2 wrap">קריאת התחלה <span class="num">${fmtKwh(e.start_reading_kwh)}</span>${e.ended_at ? html` · עד <span class="num">${fmtDate(e.ended_at)}</span>` : ''}${e.note ? ` · ${e.note}` : ''}</div></div>${e.ended_at ? nothing : html`<span class="chip acc nodot">פעיל</span>`}</div>`)}</div>
      ${this.actionError ? html`<div class="alert err" role="alert" data-meter-action-error>${this.actionError}</div>` : nothing}
      ${this.canManage
        ? html`<div class="actions">
            <sw-button data-meter-replace @click=${() => this.openReplace()}>החלפת מונה</sw-button>
            <sw-button data-meter-pause ?disabled=${this.busy} @click=${() => void this.toggleStatus()}>${d.status === 'paused' ? 'חידוש' : 'השהיה'}</sw-button>
            <span class="sp"></span>
            <sw-button variant="danger" data-meter-remove @click=${() => { this.actionError = ''; this.dlg = 'remove'; }}>הסרה</sw-button>
          </div>`
        : nothing}
    </div>`;
  }

  render() {
    const d = this.detail;
    return html`
      <!-- a dialog opened from the card sits above the drawer's top layer only while the drawer steps aside -->
      <sw-drawer ?open=${!this.dlg} modal heading=${d?.name ?? ''} data-meter-drawer @close=${() => { if (!this.dlg) this.fire('close'); }}>
        ${this.phase === 'loading' ? html`<sw-state-panel state="loading" compact></sw-state-panel>` : nothing}
        ${this.phase === 'error' ? html`<sw-state-panel state="error" compact heading="לא ניתן לטעון את המונה" hint=${this.error} actionLabel="נסה שוב" @action=${() => void this.load()}></sw-state-panel>` : nothing}
        ${this.phase === 'ready' && d ? this.renderBody(d) : nothing}
      </sw-drawer>
      <sw-dialog ?open=${this.dlg === 'remove'} heading="הסרת המונה" data-meter-remove-dialog @close=${() => (this.dlg = '')}>
        <div>המונה יוסר מהרשימה. הנתונים שנאספו יישמרו.</div>
        ${this.actionError && this.dlg === 'remove' ? html`<div class="alert err" role="alert">${this.actionError}</div>` : nothing}
        <sw-button slot="footer" variant="danger" data-meter-remove-confirm ?disabled=${this.busy} @click=${() => void this.confirmRemove()}>הסרה</sw-button>
        <sw-button slot="footer" @click=${() => (this.dlg = '')}>ביטול</sw-button>
      </sw-dialog>
      <sw-dialog ?open=${this.dlg === 'replace'} heading="החלפת מונה" data-meter-replace-dialog @close=${() => (this.dlg = '')}>
        <div class="form">
          <div class="fld"><label for="fr">קריאה סופית של המונה הישן</label><div class="inp ${this.replaceError && !this.finalReading ? 'err' : ''}"><input id="fr" data-replace-final inputmode="decimal" .value=${this.finalReading} @input=${(e: Event) => (this.finalReading = (e.target as HTMLInputElement).value)} /><span class="mut">קוט״ש</span></div></div>
          <div class="fld"><label for="sr">קריאת התחלה של המונה החדש</label><div class="inp"><input id="sr" data-replace-start inputmode="decimal" .value=${this.startReading} @input=${(e: Event) => (this.startReading = (e.target as HTMLInputElement).value)} /><span class="mut">קוט״ש</span></div></div>
          <div class="fld wide"><label for="nt">הערה (לא חובה)</label><div class="inp"><input id="nt" data-replace-note .value=${this.note} @input=${(e: Event) => (this.note = (e.target as HTMLInputElement).value)} /></div></div>
          ${this.replaceError ? html`<div class="alert err wide" role="alert" data-replace-error>${this.replaceError}</div>` : nothing}
        </div>
        <sw-button slot="footer" variant="primary" data-replace-save ?disabled=${this.busy} @click=${() => void this.replace()}>החלפה</sw-button>
        <sw-button slot="footer" @click=${() => (this.dlg = '')}>ביטול</sw-button>
      </sw-dialog>`;
  }
}

/** Daily points to calendar months (sum of kWh). */
function monthly(points: SeriesPoint[]): SeriesPoint[] {
  const by = new Map<string, number>();
  for (const p of points) {
    const d = new Date(p.t);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01T00:00:00Z`;
    by.set(k, (by.get(k) ?? 0) + p.kwh);
  }
  return [...by.entries()].map(([t, kwh]) => ({ t, kwh: Math.round(kwh * 100) / 100 }));
}

declare global {
  interface HTMLElementTagNameMap {
    'elec-meter-card': ElecMeterCard;
  }
}

