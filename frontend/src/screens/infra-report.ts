import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import type { RouteState } from '../router';
import { navigate } from '../router';
import { ApiError } from '../api/client';
import { downloadReportPdf, getReport, isOff, SECTION_IDS, type ReportModel, type SectionId } from '../api/insights';
import { insightsAccess, onInsightsAccess, STATUS_EVENT, type InsightsAccess } from '../insights/access';
import { canGoNext, chosen, defaultMonth, monthLabel, REASON_ICON, reportEmpty, reportFigures, shiftMonth, storedPicks } from '../insights/model';
import { renderPreview } from '../insights/report-preview';
import { insightCss } from '../insights/styles';
import { kpi, pageHead } from '../insights/chrome';
import { ix, type IxKey, type IxLang } from '../i18n/insights';
import { fmtWhen } from '../insights/model';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const PICKS_KEY = 'sw.insights.report.sections';
type Phase = 'loading' | 'ready' | 'empty' | 'error' | 'off' | 'forbidden';

/**
 * תשתיות › דוח מבנה (CR-INSIGHT215): the monthly building report - the month, the language, the sections, the in-page preview of the report
 * model (the same model the PDF is made from), the PDF download, and the sections that were left out with the reason (no permission, the
 * module is off, the switch is off). The report is installation-wide (reports.building), so there is no places tree here: the model has no
 * place to filter by. Read-only; the PDF is made on demand and not stored.
 */
@customElement('infra-report')
export class InfraReport extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private access: InsightsAccess = insightsAccess();
  @state() private phase: Phase = 'loading';
  @state() private model: ReportModel | null = null;
  @state() private month = '';
  @state() private rlang: IxLang = 'he';
  @state() private picked: Set<SectionId> = new Set(SECTION_IDS);
  @state() private busy = false;
  @state() private pdfError = '';
  private stop?: () => void;
  private seq = 0;
  private readonly redraw = () => this.requestUpdate();

  static styles = [insightCss, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onInsightsAccess((a) => (this.access = a));
    window.addEventListener(STATUS_EVENT, this.redraw);
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(PICKS_KEY);
    } catch {
      raw = null; // storage unavailable: every section
    }
    this.picked = storedPicks(raw, SECTION_IDS);
    const m = this.route?.params.get('month') ?? '';
    this.month = /^\d{4}-\d{2}$/.test(m) ? m : defaultMonth(new Date());
    this.rlang = this.route?.params.get('lang') === 'en' ? 'en' : 'he';
    void this.load();
  }
  disconnectedCallback() {
    this.stop?.();
    window.removeEventListener(STATUS_EVENT, this.redraw);
    super.disconnectedCallback();
  }

  private async load() {
    const n = ++this.seq;
    this.phase = 'loading';
    this.pdfError = '';
    try {
      const model = await getReport({ month: this.month, lang: this.rlang, sections: SECTION_IDS });
      if (n !== this.seq) return;
      this.model = model;
      this.phase = reportEmpty(model) ? 'empty' : 'ready';
    } catch (e) {
      if (n !== this.seq) return;
      this.phase = isOff(e) ? 'off' : e instanceof ApiError && e.status === 403 ? 'forbidden' : 'error';
    }
  }

  private setMonth(m: string) {
    this.month = m;
    void this.load();
  }
  private setLang(l: IxLang) {
    if (l === this.rlang) return;
    this.rlang = l;
    void this.load();
  }
  private toggle(s: SectionId) {
    const next = new Set(this.picked);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    if (!next.size) return; // a report with no section is not a report
    this.picked = next;
    try {
      localStorage.setItem(PICKS_KEY, JSON.stringify([...next]));
    } catch {
      /* storage unavailable: the choice lasts for this page */
    }
  }

  private async download() {
    if (!this.model || this.busy) return;
    const sections = chosen(SECTION_IDS, this.picked, this.model.omitted);
    this.busy = true;
    this.pdfError = '';
    try {
      await downloadReportPdf({ month: this.month, lang: this.rlang, sections });
    } catch (e) {
      this.pdfError = e instanceof ApiError && e.status === 422 ? 'pdfTooBig' : 'pdfFailTitle';
    } finally {
      this.busy = false;
    }
  }

  private onClick(e: Event) {
    const a = (e.target as HTMLElement).closest('[data-go]');
    if (!a) return;
    e.preventDefault();
    navigate(`/tickets/reports/${a.getAttribute('data-go')}`);
  }

  private header() {
    return pageHead('building', ix('pageBuilding'), ix('subReport', { month: monthLabel(this.month, this.rlang) }));
  }

  /** The temperature screen's KPI row: the report's headline numbers (the summary section's figures; the PDF prints them in its summary). */
  private kpiRow() {
    const m = this.model;
    if (!m || this.phase !== 'ready' || !this.picked.has('summary') || m.omitted.some((o) => o.section === 'summary')) return nothing;
    const figs = reportFigures(m, m.lang);
    if (!figs.length) return nothing;
    const look = (t?: string) => (t === 'up' ? 'bad' : t === 'down' ? 'ok' : 'unk');
    return html`<div class="kpis" role="group" aria-label=${ix('sec_summary')} data-kpis>${figs.map((f) => kpi(f.value, ix(f.label, undefined, m.lang), look(f.tone), { unit: f.unit ? ix(f.unit, undefined, m.lang) : undefined, note: f.note, noteTone: f.tone ?? 'muted', key: f.id }))}</div>`;
  }

  private toolbar() {
    const now = new Date();
    return html`<div class="toolbar">
      <div class="month" role="group" aria-label=${ix('month')}>
        <button data-prev aria-label=${ix('prevMonth')} @click=${() => this.setMonth(shiftMonth(this.month, -1))}><sw-icon name="chevron" style="transform:scaleX(-1)"></sw-icon></button>
        <b data-month>${monthLabel(this.month, this.rlang)}</b>
        <button data-next aria-label=${ix('nextMonth')} ?disabled=${!canGoNext(this.month, now)} @click=${() => this.setMonth(shiftMonth(this.month, 1))}><sw-icon name="chevron"></sw-icon></button>
      </div>
      <div class="seg" role="group" aria-label=${ix('language')}>
        <button data-lang="he" aria-pressed=${this.rlang === 'he'} @click=${() => this.setLang('he')}>${ix('langHe')}</button>
        <button data-lang="en" aria-pressed=${this.rlang === 'en'} @click=${() => this.setLang('en')}>${ix('langEn')}</button>
      </div>
      <span class="sp"></span>
      <button class="btn pri" data-download ?disabled=${this.phase !== 'ready' || this.busy} @click=${() => void this.download()}><sw-icon name="download"></sw-icon>${this.busy ? ix('downloading') : ix('download')}</button>
      ${this.model && this.phase === 'ready' ? html`<span class="muted num" data-generated>${ix('generatedAt', { t: fmtWhen(new Date(this.model.generated * 1000).toISOString(), this.model.zone) })}</span>` : nothing}
    </div>`;
  }

  private picker() {
    const off = new Map((this.model?.omitted ?? []).map((o) => [o.section, o.reason]));
    return html`<div class="picker" id="picker" role="group" aria-label=${ix('sectionsGroup')}>${SECTION_IDS.map((s) => {
      const label = ix(`sec_${s}` as IxKey);
      const why = off.get(s);
      if (why) return html`<span class="chip off" data-pick-off=${s} title=${ix(`reason_${why}` as IxKey)}>${label}</span>`;
      const on = this.picked.has(s);
      return html`<button class="chip ${on ? 'sel' : ''}" data-pick=${s} aria-pressed=${on} @click=${() => this.toggle(s)}><sw-icon class="tick" name="check"></sw-icon>${label}</button>`;
    })}</div>`;
  }

  private body() {
    const m = this.model;
    switch (this.phase) {
      case 'loading':
        return html`<div class="rep-loading" aria-busy="true" data-state="loading">${[58, 90, 70].map((h) => html`<div class="rs"><div class="skel" style="block-size:16px;inline-size:140px;margin-block-end:14px"></div><div class="skel" style="block-size:${h}px"></div></div>`)}</div>`;
      case 'error':
        return html`<div class="blank" data-state="error"><sw-icon name="warning" style="color:var(--sw-danger-text)"></sw-icon><b>${ix('errorTitle')}</b><span class="muted">${ix('errorBody')}</span>
          <button class="btn pri" data-retry @click=${() => void this.load()}>${ix('retry')}</button></div>`;
      case 'empty':
        return html`<div class="blank" data-state="empty"><sw-icon name="calendar"></sw-icon><b>${ix('emptyMonthTitle', { month: monthLabel(this.month, this.rlang) })}</b>
          <button class="btn" data-prev-empty @click=${() => this.setMonth(shiftMonth(this.month, -1))}>${ix('prevMonth')}</button></div>`;
      case 'ready':
        return m
          ? html`<div data-state="ready" @click=${(e: Event) => this.onClick(e)}>${renderPreview(m, {
              sections: chosen(SECTION_IDS, this.picked, m.omitted).filter((s) => s !== 'summary' || !reportFigures(m, m.lang).length),
              canDoors: this.access.read,
              canWaste: this.access.read,
              canManage: this.access.manage,
            })}</div>`
          : nothing;
      default:
        return nothing;
    }
  }

  private omitted() {
    const list = this.model?.omitted ?? [];
    if (!list.length || this.phase === 'loading' || this.phase === 'error') return nothing;
    return html`<div class="card omitted" data-omitted><div class="ch-h"><h2>${ix('omittedTitle')}</h2></div>
      ${list.map((o) => html`<div class="o" data-omitted-row=${o.section}><span>${ix(`sec_${o.section}` as IxKey)}</span>
        <span class="reason"><sw-icon name=${REASON_ICON[o.reason]}></sw-icon>${ix(`reason_${o.reason}` as IxKey)}</span></div>`)}</div>`;
  }

  render() {
    if (this.phase === 'off' || this.phase === 'forbidden') {
      return html`<div class="card" data-state=${this.phase}><div class="blank"><sw-icon name=${this.phase === 'off' ? 'offline' : 'lock'}></sw-icon>
        <b>${ix(this.phase === 'off' ? 'offTitle' : 'forbiddenTitle')}</b><a class="btn" href="#/">${ix('toHome')}</a></div></div>`;
    }
    return html`${this.header()}${this.kpiRow()}
      ${this.pdfError ? html`<div class="card" data-state="pdf-error" style="margin-block-end:14px"><div class="blank" style="padding:24px 20px"><sw-icon name="warning" style="color:var(--sw-danger-text)"></sw-icon>
        <b>${ix(this.pdfError === 'pdfTooBig' ? 'pdfTooBig' : 'pdfFailTitle')}</b>${this.pdfError === 'pdfTooBig' ? nothing : html`<span class="muted">${ix('pdfFailBody')}</span>`}
        <div class="row"><button class="btn pri" data-pdf-retry @click=${() => void this.download()}>${ix('retry')}</button>
        <button class="btn" data-pdf-close @click=${() => (this.pdfError = '')}>${ix('close')}</button></div></div></div>` : nothing}
      <div class="card">${this.toolbar()}${this.phase === 'loading' && !this.model ? nothing : this.picker()}${this.body()}</div>
      ${this.omitted()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'infra-report': InfraReport;
  }
}
