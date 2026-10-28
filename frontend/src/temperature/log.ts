import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { downloadLogCsv, listEvents, type LogQuery, type RangeKey, type TempEvent, type TempUnit } from '../api/temperature';
import { eventDuration, eventText, eventValue, heldText, hhmm } from './model';
import { tempCss } from './styles';
import { tt, ttLang } from '../i18n/temperature';
import { dayMonthText } from '../api/day-format';

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
    .scrollx { overflow-x: auto; }
    table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); }
    th, td { text-align: start; padding: 10px 12px; border-block-end: 1px solid var(--sw-border); vertical-align: middle; }
    th { background: var(--sw-surface-2); font-weight: var(--sw-fw-bold); color: var(--sw-heading); white-space: nowrap; font-size: var(--sw-fs-xs); letter-spacing: 0.01em; }
    td { font-size: var(--sw-fs-md); }
    td small { display: block; color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .sev { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; font-weight: var(--sw-fw-bold); color: var(--c-text); background: var(--c-soft); border-radius: var(--sw-r-pill); padding: 3px 10px 3px 8px; font-size: var(--sw-fs-sm); }
    .sev i { inline-size: 9px; block-size: 9px; border-radius: 50%; background: var(--c); }
    .num { white-space: nowrap; }
    .foot { display: flex; justify-content: center; padding: 10px; }
    .err { color: var(--sw-danger-text); padding: 12px; }
    @media (max-width: 700px) {
      .top { flex-direction: column; align-items: stretch; }
      .top .sp { display: none; }
      th:nth-child(5), td:nth-child(5), th:nth-child(6), td:nth-child(6) { display: none; }
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

  render() {
    const lang = document.documentElement.lang || 'he-IL';
    const now = Date.now();
    const area = new Map(this.units.map((u) => [u.id, u.area_name ?? '']));
    const sev = (s: string) => (s === 'alarm' ? 'var(--tc-alarm)' : s === 'warning' ? 'var(--tc-warn)' : 'var(--tc-acc)');
    const day = (iso: string) => {
      const d = new Date(iso);
      return now - d.getTime() > 20 * 3600_000 ? `${dayMonthText(d)} ` : '';
    };
    return html`<div class="top lead-head"><div><h1>${tt('logTitle')}</h1><p class="sub">${tt('logSub')}</p></div><span class="sp"></span>
        <div class="meta">
          <button type="button" class="btn" data-temp-back @click=${() => this.dispatchEvent(new CustomEvent('back'))}><sw-icon name="chevronBack" size="16"></sw-icon>${tt('back')}</button>
          <button type="button" class="btn" ?disabled=${this.busy} data-temp-csv @click=${() => this.csv()}><sw-icon name="download" size="16"></sw-icon>${tt('csv')}</button>
          ${this.canSend ? html`<button type="button" class="btn" data-temp-log-wa @click=${() => this.dispatchEvent(new CustomEvent('whatsapp', { detail: this.q.unit ? [this.q.unit] : this.units.map((u) => u.id) }))}><sw-icon name="share" size="16"></sw-icon>WhatsApp</button>` : nothing}
          <button type="button" class="btn" data-temp-log-pdf @click=${() => this.dispatchEvent(new CustomEvent('report', { detail: this.q.unit ? [this.q.unit] : this.units.map((u) => u.id) }))}><sw-icon name="download" size="16"></sw-icon>${tt('report')}</button>
        </div></div>
      <div class="tcard">
        <div class="filters">
          <select aria-label=${tt('colUnit')} data-f="unit" @change=${(e: Event) => this.set({ unit: (e.target as HTMLSelectElement).value || undefined })}>
            <option value="">${tt('allUnits')}</option>${this.units.map((u) => html`<option value=${u.id} ?selected=${this.q.unit === u.id}>${u.name}</option>`)}</select>
          <select aria-label=${tt('colEvent')} data-f="kind" @change=${(e: Event) => this.set({ kind: (e.target as HTMLSelectElement).value || undefined })}>
            <option value="">${tt('allKinds')}</option><option value="temp">${tt('kTemp')}</option><option value="door">${tt('kDoor')}</option><option value="offline">${tt('kOffline')}</option>
            <option value="defrost">${tt('kDefrost')}</option><option value="health">${tt('kHealth')}</option><option value="maint">${tt('maintBtn')}</option><option value="act">${tt('kAct')}</option></select>
          <select aria-label=${tt('colSev')} data-f="severity" @change=${(e: Event) => this.set({ severity: (e.target as HTMLSelectElement).value || undefined })}>
            <option value="">${tt('allSev')}</option><option value="alarm">${tt('sevAlarm')}</option><option value="warning">${tt('sevWarning')}</option><option value="info">${tt('sevInfo')}</option></select>
          <select aria-label=${tt('colTime')} data-f="range" @change=${(e: Event) => this.set({ range: (e.target as HTMLSelectElement).value as RangeKey })}>
            <option value="24h">${tt('rng24')}</option><option value="7d">${tt('rng7')}</option><option value="30d">${tt('rng30')}</option></select>
          <span class="sp"></span><span class="chip" data-tone="acc" data-temp-count>${tt('count', { n: this.total })}</span>
        </div>
        ${this.error ? html`<p class="err" role="alert">${this.error}</p>` : nothing}
        <div class="scrollx"><table data-temp-log-table>
          <thead><tr><th>${tt('colTime')}</th><th>${tt('colUnit')}</th><th>${tt('colEvent')}</th><th>${tt('colSev')}</th><th>${tt('colValue')}</th><th>${tt('colDur')}</th><th>${tt('colStatus')}</th></tr></thead>
          <tbody>${this.rows.length
            ? this.rows.map((e) => html`<tr data-event=${e.id} data-kind=${e.kind} data-sev=${e.severity}>
                <td class="num">${day(e.started_at)}${hhmm(Date.parse(e.started_at), lang)}</td>
                <td><b>${e.unit_name ?? ''}</b><small>${area.get(e.unit_id) ?? ''}</small></td>
                <td>${eventText(e)}${heldText(e) ? html`<small>${heldText(e)}</small>` : nothing}</td>
                <td><span class="sev" style=${`--c:${sev(e.severity)}`}><i aria-hidden="true"></i>${tt(e.severity === 'alarm' ? 'sevAlarm' : e.severity === 'warning' ? 'sevWarning' : 'sevInfo')}</span></td>
                <td class="num" dir="ltr">${eventValue(e)}</td>
                <td class="num">${eventDuration(e, now)}</td>
                <td><span class="chip" data-tone=${e.ended_at ? 'mut' : 'err'}>${e.ended_at ? tt('closed') : tt('open')}</span></td></tr>`)
            : html`<tr><td colspan="7" class="hint" data-state=${this.loading ? 'loading' : 'empty'}>${this.loading ? '…' : tt('noEvents')}</td></tr>`}</tbody>
        </table></div>
        ${this.rows.length < this.total ? html`<div class="foot"><button type="button" class="btn sm" ?disabled=${this.loading} @click=${() => this.load(true)}>+</button></div>` : nothing}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'temp-log': TempLog;
  }
}
