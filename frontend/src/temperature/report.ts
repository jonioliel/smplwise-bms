import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { downloadReportPdf, getReportPreview, type ReportModel, type ReportParams, type TempUnit } from '../api/temperature';
import { REPORT_RANGES, deg, durationText, eventText, friendlyName, localInput } from './model';
import { bigChart } from './charts';
import { tempCss } from './styles';
import { tt, type TtKey } from '../i18n/temperature';

export { REPORT_RANGES, localInput } from './model';

/**
 * CR-INFRA-TEMPERATURE 2.9.1 phase 2: the PDF report dialog (owner-approved mockup): the range (presets and a custom range), one unit or
 * several (a page per unit), Hebrew or English, the content switches (chart, signature LINE - owner decision 4 -, alert list), a live paper
 * preview of the first unit drawn from the server's report MODEL (the same numbers the PDF and the WhatsApp text use), "ייצוא PDF" (made on
 * the server) and "שליחה ב-WhatsApp" (opens the WhatsApp dialog with the same choices).
 */
@customElement('temp-report')
export class TempReport extends LitElement {
  @property({ attribute: false }) units: TempUnit[] = [];
  @property({ attribute: false }) preselect: string[] = [];
  @property({ type: Boolean }) canSend = false;
  @state() private p: ReportParams = { units: [], range: '24h', lang: 'he', chart: true, events: true, signature: true };
  @state() private model: ReportModel | null = null;
  @state() private err = '';
  @state() private busy = false;
  private timer?: number;
  private seq = 0;

  static styles = [tempCss, css`
    :host { position: fixed; inset: 0; z-index: var(--sw-z-modal); display: grid; place-items: center; padding: 16px; box-sizing: border-box; }
    .ovl { position: absolute; inset: 0; background: var(--sw-overlay); }
    .sheet { position: relative; inline-size: min(1040px, 100%); max-block-size: calc(100dvh - 32px); display: flex; flex-direction: column; background: var(--sw-bg); border-radius: var(--sw-r-2xl); box-shadow: var(--sw-shadow-3); overflow: hidden; }
    .wh { display: flex; align-items: flex-start; gap: 10px; padding: 16px 20px 8px; }
    .wh h2 { margin: 0; font-size: var(--sw-fs-xl); }
    .wh small { color: var(--sw-text-2); }
    .wh .t { flex: 1; }
    .icb { inline-size: 36px; block-size: 36px; padding: 0; justify-content: center; }
    .wb { flex: 1; overflow: auto; padding: 8px 20px 16px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 18px; align-items: start; }
    .col { display: grid; gap: 14px; }
    .field { display: grid; gap: 6px; }
    .field > .lbl { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); }
    .presets { display: flex; flex-wrap: wrap; gap: 6px; }
    .presets button { border: 1px solid var(--sw-border); background: var(--sw-surface); border-radius: var(--sw-r-pill); padding: 5px 12px; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text); cursor: pointer; }
    .presets button[aria-pressed='true'] { border-color: var(--sw-accent); background: var(--sw-accent-soft); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); }
    .f2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .in { min-block-size: var(--sw-ctl-h-sm); border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); padding: 0 10px; font: inherit; }
    .ulist { display: grid; gap: 4px; max-block-size: 220px; overflow: auto; }
    .sw { display: inline-flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); cursor: pointer; }
    .sw input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .seg { display: inline-flex; background: var(--sw-surface-2); border-radius: var(--sw-r-pill); padding: 3px; gap: 2px; }
    .seg button { border: 0; background: transparent; border-radius: var(--sw-r-pill); padding: 5px 14px; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text-2); cursor: pointer; }
    .seg button[aria-pressed='true'] { background: var(--sw-surface); color: var(--sw-text); box-shadow: var(--sw-shadow-1); font-weight: var(--sw-fw-semibold); }
    .paper { background: var(--sw-surface-solid); border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); padding: 18px 20px; box-shadow: var(--sw-shadow-2); display: grid; gap: 10px; min-inline-size: 0; }
    .ph { display: flex; justify-content: space-between; gap: 10px; border-block-end: 2px solid var(--sw-text); padding-block-end: 6px; }
    .ph h3 { margin: 0; font-size: var(--sw-fs-lg); }
    .ph small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-2xs); }
    .st { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
    .st div { border: 1px solid var(--sw-border); border-radius: var(--sw-r-xs); padding: 6px; }
    .st span { display: block; font-size: var(--sw-fs-2xs); color: var(--sw-text-2); }
    .st b { font-size: var(--sw-fs-md); }
    .chart { block-size: 170px; }
    .chart svg { inline-size: 100%; block-size: 100%; }
    table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-xs); }
    td, th { border-block-end: 1px solid var(--sw-border); padding: 4px; text-align: start; }
    tr[data-verdict='exc'] td { color: var(--sw-danger-text); }
    tr[data-verdict='none'] td { color: var(--sw-text-3); }
    th { color: var(--sw-text-2); }
    .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-block-start: 12px; }
    .sig div { border-block-start: 1px solid var(--sw-text); padding-block-start: 4px; font-size: var(--sw-fs-xs); }
    .foot { font-size: var(--sw-fs-2xs); color: var(--sw-text-3); }
    .wf { display: flex; gap: 8px; align-items: center; padding: 12px 20px; border-block-start: 1px solid var(--sw-border); background: var(--sw-surface); }
    .wf .sp { flex: 1; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    @media (max-width: 860px) {
      .wb { grid-template-columns: minmax(0, 1fr); }
      .st { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 600px) {
      :host { padding: 0; }
      .sheet { inline-size: 100%; max-block-size: 100dvh; block-size: 100dvh; border-radius: 0; }
    }
  `];

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
    const now = Date.now();
    this.p = { ...this.p, units: this.preselect.length ? [...this.preselect] : this.units.slice(0, 1).map((u) => u.id), lang: document.documentElement.lang.startsWith('en') ? 'en' : 'he',
      from: localInput(now - 7 * 86400_000), to: localInput(now) };
    this.refresh();
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.onKey);
    window.clearTimeout(this.timer);
    super.disconnectedCallback();
  }

  /** The server params: a custom range is sent as ISO instants (the inputs are the browser's local time). */
  params(): ReportParams {
    const p = { ...this.p };
    if (p.range === 'custom') {
      p.from = p.from ? new Date(p.from).toISOString() : undefined;
      p.to = p.to ? new Date(p.to).toISOString() : undefined;
    }
    return p;
  }

  private set(patch: Partial<ReportParams>) {
    this.p = { ...this.p, ...patch };
    this.refresh();
  }

  private refresh() {
    window.clearTimeout(this.timer);
    if (!this.p.units.length) {
      this.model = null;
      return;
    }
    const n = ++this.seq;
    this.timer = window.setTimeout(async () => {
      try {
        const m = await getReportPreview(this.params());
        if (n === this.seq) {
          this.model = m;
          this.err = '';
        }
      } catch (e) {
        if (n === this.seq) this.err = describeError(e);
      }
    }, 250);
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private async exportPdf() {
    if (!this.p.units.length) {
      this.err = tt('repNeedUnit');
      return;
    }
    this.busy = true;
    this.err = '';
    try {
      await downloadReportPdf(this.params());
      this.dispatchEvent(new CustomEvent('done', { detail: tt('repDone') }));
    } catch (e) {
      this.err = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private paper() {
    const m = this.model;
    if (!m || !m.units.length) return html`<div class="paper" data-rep-paper><p class="hint">${this.p.units.length ? '…' : tt('repNeedUnit')}</p></div>`;
    const u = m.units[0];
    const s = u.stats;
    const lang = m.lang;
    const T = (k: TtKey) => tt(k, undefined, lang);
    const stats: [TtKey, string][] = [['statMin', deg(s.min)], ['statMax', deg(s.max)], ['statAvg', deg(s.avg)], ['statOut', durationText(s.out_min)],
      ['tlDoor', u.door ? `${s.door_opens} · ${durationText(s.door_total_min)}` : '—'], ['alertsTitle', String(s.alarms + s.warnings)]];
    const pts = (u.points ?? []).map((p) => [p[0], p[1]] as [number, number]);
    return html`<div class="paper" dir=${lang === 'he' ? 'rtl' : 'ltr'} lang=${lang} data-rep-paper>
      <div class="ph"><div><h3>${m.layout === 'haccp' ? T('repHaccp') : T('repTitle').replace(' (PDF)', '')} · ${u.name}</h3><small>${[u.area, friendlyName(u.sensor, '')].filter(Boolean).join(' · ')} · ${T('lgBand', )
        .replace('{lo}', deg(u.low)).replace('{hi}', deg(u.high))}</small><small dir="ltr">${m.range_text}</small></div><b>SmplWise</b></div>
      <div class="st">${stats.map(([k, v]) => html`<div><span>${T(k)}</span><b class="num" dir="ltr">${v}</b></div>`)}</div>
      ${m.chart && pts.length ? html`<div class="chart">${bigChart({ points: pts, setpoints: u.source === 'climate' ? (u.points ?? []).map((p) => [p[0], p[2]] as [number, number | null]) : undefined,
        low: u.low, high: u.high, doors: u.doors ?? [], defrost: u.defrost ?? [], t0: m.from, t1: m.to, step: 300 }, 600, 170, lang === 'he' ? 'he-IL' : 'en-GB', null)}</div>` : nothing}
      ${m.events ? html`<table><thead><tr><th>${T('colTime')}</th><th>${T('colEvent')}</th><th>${T('colValue')}</th></tr></thead><tbody>
        ${(u.events ?? []).slice(0, 6).map((e) => html`<tr><td dir="ltr">${new Date(e.started_at).toLocaleString(lang === 'he' ? 'he-IL' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
          <td>${eventText({ ...e, id: '', unit_id: '', warned_at: null, alarmed_at: null, suppressed: null, ack_at: null, ack_by_name: e.by_name ?? null, notified: false, detail: { reason: e.reason ?? undefined } })}</td><td dir="ltr">${deg(e.peak ?? e.value)}</td></tr>`)}
      </tbody></table>` : nothing}
      ${u.daily ? html`<table data-rep-daily><thead><tr><th>${T('dailyTitle')}</th><th>${T('statMin')}</th><th>${T('statMax')}</th><th>${T('statOut')}</th><th>${T('coverage')}</th><th></th></tr></thead><tbody>
        ${u.daily.slice(0, 8).map((d) => html`<tr data-verdict=${d.verdict}><td dir="ltr">${d.day.slice(8, 10)}.${d.day.slice(5, 7)}</td><td dir="ltr">${deg(d.min)}</td><td dir="ltr">${deg(d.max)}</td>
          <td>${d.out_min ? durationText(d.out_min) : '0'}</td><td dir="ltr">${Math.round(d.coverage)}%</td><td>${T(d.verdict === 'ok' ? 'dayOk' : d.verdict === 'exc' ? 'dayExc' : 'dayNone')}</td></tr>`)}
        ${u.daily.length > 8 ? html`<tr><td colspan="6" class="hint" dir="ltr">+${u.daily.length - 8}</td></tr>` : nothing}
      </tbody></table>` : nothing}
      ${m.signature ? html`<div class="sig" style=${m.layout === 'haccp' ? 'grid-template-columns:1fr 1fr 1fr' : ''}>${m.layout === 'haccp' ? html`<div>${T('repSignName')}</div>` : nothing}<div>${T('repSign')}</div><div>${T('repDate')}</div></div>` : nothing}
      <div class="foot" dir="ltr">SmplWise Arx · ${m.zone} · sha256 ${m.digest.slice(0, 16)}${m.units.length > 1 ? ` · +${m.units.length - 1}` : ''}</div>
    </div>`;
  }

  render() {
    const p = this.p;
    return html`<div class="ovl" @click=${() => this.close()}></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rep-title" data-temp-report>
        <div class="wh"><div class="t"><h2 id="rep-title">${tt('repTitle')}</h2><small>${tt('repSub')}</small></div>
          <button type="button" class="btn icb" aria-label=${tt('close')} @click=${() => this.close()}><sw-icon name="close" size="16"></sw-icon></button></div>
        <div class="wb">
          <div class="col">
            <div class="field"><span class="lbl">${tt('repRange')}</span><div class="presets" role="group">${REPORT_RANGES.map((r) => html`<button type="button" aria-pressed=${String(p.range === r)} data-rep-range=${r}
              @click=${() => this.set({ range: r })}>${tt(`rp${r}` as TtKey)}</button>`)}</div>
              ${p.range === 'custom' ? html`<div class="f2"><label class="field"><span class="lbl">${tt('repFrom')}</span><input class="in" type="datetime-local" .value=${p.from ?? ''}
                  @change=${(e: Event) => this.set({ from: (e.target as HTMLInputElement).value })} data-rep-from /></label>
                <label class="field"><span class="lbl">${tt('repTo')}</span><input class="in" type="datetime-local" .value=${p.to ?? ''}
                  @change=${(e: Event) => this.set({ to: (e.target as HTMLInputElement).value })} data-rep-to /></label></div>` : nothing}</div>
            <div class="field"><span class="lbl">${tt('repUnits')} <span class="hint">· ${tt('repUnitsHint')}</span></span><div class="ulist">
              ${this.units.map((u) => html`<label class="sw"><input type="checkbox" .checked=${p.units.includes(u.id)} data-rep-unit=${u.id}
                @change=${(e: Event) => this.set({ units: (e.target as HTMLInputElement).checked ? [...p.units, u.id] : p.units.filter((x) => x !== u.id) })} />${u.name}${u.area_name ? html` <span class="hint">· ${u.area_name}</span>` : nothing}</label>`)}</div></div>
            <div class="f2">
              <div class="field"><span class="lbl">${tt('repLang')}</span><span class="seg" role="group"><button type="button" aria-pressed=${String(p.lang === 'he')} data-rep-lang="he" @click=${() => this.set({ lang: 'he' })}>עברית</button>
                <button type="button" aria-pressed=${String(p.lang === 'en')} data-rep-lang="en" @click=${() => this.set({ lang: 'en' })}>English</button></span></div>
              <div class="field"><span class="lbl">${tt('repContent')}</span>
                <label class="sw"><input type="checkbox" .checked=${p.chart !== false} @change=${(e: Event) => this.set({ chart: (e.target as HTMLInputElement).checked })} />${tt('repChart')}</label>
                <label class="sw"><input type="checkbox" .checked=${p.signature !== false} @change=${(e: Event) => this.set({ signature: (e.target as HTMLInputElement).checked })} data-rep-sig />${tt('repSig')}</label>
                <label class="sw"><input type="checkbox" .checked=${p.events !== false} @change=${(e: Event) => this.set({ events: (e.target as HTMLInputElement).checked })} />${tt('repEvents')}</label></div>
            </div>
            <div class="field" data-rep-layout><span class="lbl">${tt('repLayout')}</span><span class="seg" role="group">
              <button type="button" aria-pressed=${String(p.layout !== 'haccp')} data-rep-layout-btn="standard" @click=${() => this.set({ layout: 'standard' })}>${tt('repStandard')}</button>
              <button type="button" aria-pressed=${String(p.layout === 'haccp')} data-rep-layout-btn="haccp"
                @click=${() => this.set({ layout: 'haccp', range: p.range === '24h' ? 'prev_month' : p.range, signature: true })}>${tt('repHaccp')}</button></span>
              ${p.layout === 'haccp' ? html`<span class="hint">${tt('repHaccpHint')}</span>` : nothing}</div>
            <span class="hint">${tt('repEngine')}</span>
          </div>
          ${this.paper()}
        </div>
        <div class="wf">
          ${this.canSend ? html`<button type="button" class="btn" ?disabled=${!p.units.length} data-rep-wa @click=${() => this.dispatchEvent(new CustomEvent('whatsapp', { detail: this.params() }))}><sw-icon name="share" size="16"></sw-icon>${tt('repWa')}</button>` : nothing}
          <span class="sp"></span>${this.err ? html`<span class="err" role="alert">${this.err}</span>` : nothing}
          <button type="button" class="btn ghost" @click=${() => this.close()}>${tt('cancel')}</button>
          <button type="button" class="btn pri" ?disabled=${this.busy || !p.units.length} data-rep-export @click=${() => this.exportPdf()}><sw-icon name="download" size="16"></sw-icon>${tt('repExport')}</button>
        </div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'temp-report': TempReport;
  }
}
