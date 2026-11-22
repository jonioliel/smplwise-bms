import { uiLocale } from '../i18n/locale';
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import { describeError } from '../api/client';
import { downloadLogCsv, listEvents, type LogQuery, type RangeKey, type TempEvent, type TempUnit } from '../api/temperature';
import { eventDuration, eventText, eventValue, heldText, hhmm } from './model';
import { tempCss } from './styles';
import { tt, ttLang } from '../i18n/temperature';
import { dayMonthText } from '../api/day-format';
import '../components/sw-field';

const PAGE = 200;

/**
 * CR-INFRA-TEMPERATURE 2.9.1: תשתיות › טמפרטורות › יומן התראות (`#/infra/temperature/log[?unit=]`): every opening and closing of an alert,
 * long door openings, defrost cycles, sensor outages, acknowledges and mutes - filtered by unit, kind, severity and range, exported as CSV
 * (server-side, the installation's local time plus UTC). A warning held in quiet hours or by a mute says so.
 */
@customElement('temp-log')
export class TempLog extends LitElement {
  @property({ attribute: false }) units: TempUnit[] = [];
  @property() unitFilter = '';
  @property({ type: Boolean }) canSend = false;
  @state() private q: LogQuery = { range: '24h' };
  @state() private rows: TempEvent[] = [];
  @state() private total = 0;
  @state() private error = '';
  @state() private loading = true;
  @state() private busy = false;
  private started = false;

  static styles = [tempCss, css`
    :host { display: flex; flex-direction: column; gap: 14px; }
    .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .top h1 { margin: 0; font-size: var(--sw-fs-3xl); line-height: 1.2; }
    .top .sub { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
    .top .sp { flex: 1; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; }
    /* R5-MEDIA-ENERGY-297: the log table is the page's hero object; its header row and severity marks carry weight */
    .tcard { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); overflow: hidden; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 12px; border-block-end: 1px solid var(--sw-border); }
    .filters select { min-block-size: var(--sw-ctl-h-sm); border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); padding: 0 12px; font: inherit; }
    .filters .sp { flex: 1; }
    /* CR-CMP2-TABLES-2450 (owner N10): the log is the shared table inside the card - the card's header band, the page's reading size,
       never wider than the card (the value and duration columns step out on a phone) */
    sw-table[data-temp-log-table] { --sw-table-min: 0; --sw-table-head-bg: var(--sw-surface-2); --sw-table-cell-pad: 10px 12px; --sw-table-fs: var(--sw-fs-md); }
    .hint { margin: 0; padding: 16px 12px; color: var(--sw-text-3); }
    .foot { display: flex; justify-content: center; padding: 10px; }
    .err { color: var(--sw-danger-text); padding: 12px; }
    @media (max-width: 700px) {
      .top { flex-direction: column; align-items: stretch; }
      .top .sp { display: none; }
    }
  `];

  updated() {
    if (!this.started) {
      this.started = true;
      if (this.unitFilter) this.q = { ...this.q, unit: this.unitFilter };
      void this.load(false);
    }
  }

  private async load(more: boolean) {
    this.loading = true;
    try {
      const r = await listEvents({ ...this.q, limit: PAGE, offset: more ? this.rows.length : 0 });
      this.rows = more ? [...this.rows, ...r.events] : r.events;
      this.total = r.total;
      this.error = '';
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.loading = false;
    }
  }

  private set(patch: Partial<LogQuery>) {
    this.q = { ...this.q, ...patch };
    void this.load(false);
  }

  private async csv() {
    this.busy = true;
    try {
      await downloadLogCsv(this.q, ttLang() === 'en' ? 'en' : 'he');
    } catch (e) {
      this.error = `${tt('csvError')}: ${describeError(e)}`;
    } finally {
      this.busy = false;
    }
  }

  /** CR-CMP2-TABLES-2450: the log columns - time, unit (+ area), event (+ why it was held), severity and status chips in the shared
   * tones, value and duration (LTR isolates; left out on a phone) */
  private columns(now: number, area: Map<string, string>): TableColumn<TempEvent>[] {
    const lang = uiLocale();
    const tone = (s: string) => (s === 'alarm' ? 'bad' : s === 'warning' ? 'warn' : 'info');
    const day = (iso: string) => {
      const d = new Date(iso);
      return now - d.getTime() > 20 * 3600_000 ? `${dayMonthText(d)} ` : '';
    };
    return [
      { key: 'started_at', label: tt('colTime'), render: (e) => html`<span class="num">${day(e.started_at)}${hhmm(Date.parse(e.started_at), lang)}</span>` },
      { key: 'unit', label: tt('colUnit'), render: (e) => html`<span class="t1">${e.unit_name ?? ''}</span><span class="t2">${area.get(e.unit_id) ?? ''}</span>` },
      { key: 'event', label: tt('colEvent'), render: (e) => html`${eventText(e)}${heldText(e) ? html`<span class="t2">${heldText(e)}</span>` : nothing}` },
      { key: 'severity', label: tt('colSev'), kind: 'status', render: (e) => html`<span class="chip" data-tone=${tone(e.severity)}>${tt(e.severity === 'alarm' ? 'sevAlarm' : e.severity === 'warning' ? 'sevWarning' : 'sevInfo')}</span>` },
      { key: 'value', label: tt('colValue'), hideBelow: 'phone', render: (e) => html`<span class="num">${eventValue(e)}</span>` },
      { key: 'duration', label: tt('colDur'), hideBelow: 'phone', render: (e) => html`<span class="num">${eventDuration(e, now)}</span>` },
      { key: 'status', label: tt('colStatus'), kind: 'status', render: (e) => html`<span class="chip" data-tone=${e.ended_at ? nothing : 'bad'}>${e.ended_at ? tt('closed') : tt('open')}</span>` },
    ];
  }

  render() {
    const now = Date.now();
    const area = new Map(this.units.map((u) => [u.id, u.area_name ?? '']));
    return html`<div class="top lead-head"><div><h1>${tt('logTitle')}</h1><p class="sub">${tt('logSub')}</p></div><span class="sp"></span>
        <div class="meta">
          <button type="button" class="btn" data-temp-back @click=${() => this.dispatchEvent(new CustomEvent('back'))}><sw-icon name="chevronBack" size="16"></sw-icon>${tt('back')}</button>
          <button type="button" class="btn" ?disabled=${this.busy} data-temp-csv @click=${() => this.csv()}><sw-icon name="download" size="16"></sw-icon>${tt('csv')}</button>
          ${this.canSend ? html`<button type="button" class="btn" data-temp-log-wa @click=${() => this.dispatchEvent(new CustomEvent('whatsapp', { detail: this.q.unit ? [this.q.unit] : this.units.map((u) => u.id) }))}><sw-icon name="share" size="16"></sw-icon>WhatsApp</button>` : nothing}
          <button type="button" class="btn" data-temp-log-pdf @click=${() => this.dispatchEvent(new CustomEvent('report', { detail: this.q.unit ? [this.q.unit] : this.units.map((u) => u.id) }))}><sw-icon name="download" size="16"></sw-icon>${tt('report')}</button>
        </div></div>
      <div class="tcard">
        <div class="filters">
          <sw-field flow><select aria-label=${tt('colUnit')} data-f="unit" @change=${(e: Event) => this.set({ unit: (e.target as HTMLSelectElement).value || undefined })}>
            <option value="">${tt('allUnits')}</option>${this.units.map((u) => html`<option value=${u.id} ?selected=${this.q.unit === u.id}>${u.name}</option>`)}</select></sw-field>
          <sw-field flow><select aria-label=${tt('colEvent')} data-f="kind" @change=${(e: Event) => this.set({ kind: (e.target as HTMLSelectElement).value || undefined })}>
            <option value="">${tt('allKinds')}</option><option value="temp">${tt('kTemp')}</option><option value="door">${tt('kDoor')}</option><option value="offline">${tt('kOffline')}</option>
            <option value="defrost">${tt('kDefrost')}</option><option value="health">${tt('kHealth')}</option><option value="maint">${tt('maintBtn')}</option><option value="act">${tt('kAct')}</option></select></sw-field>
          <sw-field flow><select aria-label=${tt('colSev')} data-f="severity" @change=${(e: Event) => this.set({ severity: (e.target as HTMLSelectElement).value || undefined })}>
            <option value="">${tt('allSev')}</option><option value="alarm">${tt('sevAlarm')}</option><option value="warning">${tt('sevWarning')}</option><option value="info">${tt('sevInfo')}</option></select></sw-field>
          <sw-field flow><select aria-label=${tt('colTime')} data-f="range" @change=${(e: Event) => this.set({ range: (e.target as HTMLSelectElement).value as RangeKey })}>
            <option value="24h">${tt('rng24')}</option><option value="7d">${tt('rng7')}</option><option value="30d">${tt('rng30')}</option></select></sw-field>
          <span class="sp"></span><span class="chip" data-tone="acc" data-temp-count>${tt('count', { n: this.total })}</span>
        </div>
        ${this.error ? html`<p class="err" role="alert">${this.error}</p>` : nothing}
        <sw-table bare static-rows data-temp-log-table .columns=${this.columns(now, area) as unknown as TableColumn[]} .rows=${this.rows as unknown as Record<string, unknown>[]}
          .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-event': String(r.id), 'data-kind': String(r.kind), 'data-sev': String(r.severity) })}>
          <p slot="empty" class="hint" data-state=${this.loading ? 'loading' : 'empty'}>${this.loading ? '…' : tt('noEvents')}</p></sw-table>
        ${this.rows.length < this.total ? html`<div class="foot"><button type="button" class="btn sm" ?disabled=${this.loading} @click=${() => this.load(true)}>+</button></div>` : nothing}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'temp-log': TempLog;
  }
}
