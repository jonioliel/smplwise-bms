import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-table';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-drawer';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-state-panel';
import type { TableColumn } from '../components/sw-table';
import { productSettings } from '../api/prefs';
import { describeError } from '../api/client';
import { EVENT_TONE, getEventFacets, listEvents, subscribeEvents, type EventFacets, type UnsupportedFilter, type VmsEvent } from '../api/events';
import { dateInZone } from '../api/recordings';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { INVESTIGATE_R5 } from './investigate-r5-css';
import { hev, type HevKey } from '../i18n/ha-events';
import { SENSOR_TYPES, areaOptions, describeSensorEvent, placeLabel, type SensorEvent } from './ha-events-logic';
import { dateInputLang, timeText, dayMonthText } from '../api/day-format';

/**
 * NVRLESS-295 — the sensor events list: the investigate area of an installation with no recorder events (no NVR). The same stored
 * events the event centre reads (GET /events, `events.read`-scoped), narrowed to the sensors' own (source "ha"); filters by time,
 * area (the plan place of the sensor) and type, free text; list on a desktop, cards on a phone (sw-table); read only. No clip and
 * no picture: a sensor event has no recording to open, and the drawer says so instead of offering a dead player.
 */
@customElement('investigate-ha-events')
export class InvestigateHaEvents extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  /** Route param (#/investigate/events?date=) */
  @property() date = '';

  @state() private events: SensorEvent[] | null = null;
  @state() private selected: string | null = null;
  @state() private error = '';
  @state() private tz = 'Asia/Jerusalem';
  @state() private type = '';
  @state() private area = '';
  @state() private q = '';
  @state() private rangeDays = 1;
  @state() private facets: EventFacets | null = null;
  @state() private unsupported: UnsupportedFilter[] = [];
  @state() private live = false;
  private qTimer = 0;
  private pushTimer = 0;
  private unsubscribe: (() => void) | undefined;
  private reqSeq = 0;

  static styles = [css`
    :host { display: block; }
    .filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .filters sw-field { inline-size: 160px; }
    .filters sw-field:has(input[type='search']) { inline-size: 240px; }
    .filters .grow { flex: 1; }
    .rangepick { display: inline-flex; gap: 2px; background: var(--sw-surface-3); border-radius: var(--sw-r-sm); padding: 2px; }
    .rangepick button { font: inherit; font-size: var(--sw-fs-xs); border: 0; background: transparent; color: var(--sw-text-2); border-radius: var(--sw-r-xs); padding: 4px 8px; cursor: pointer; min-block-size: 28px; }
    .rangepick button.on { background: var(--sw-surface); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1); }
    /* R5-INVESTIGATE-297: the status line reads as a stat strip (the count a display numeral), the rows at 13 px */
    .banner[data-ha-status] { font-size: var(--sw-fs-sm); padding: 8px 14px; background: var(--sw-surface); box-shadow: var(--sw-shadow-1); }
    .banner[data-ha-status] [data-ha-summary] { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    .banner { font-size: var(--sw-fs-xs); padding: 6px 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); border: 1px solid var(--sw-border); color: var(--sw-text-2); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; line-height: 1.5; margin-block: 8px; }
    .banner.warn { background: var(--sw-warning-soft); border-color: color-mix(in srgb, var(--sw-warning) 40%, transparent); color: var(--sw-warning-text); }
    .dot { inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--sw-offline); display: inline-block; box-shadow: 0 0 0 2px var(--sw-offline-soft); flex: none; }
    .dot.on { background: var(--sw-online, var(--sw-accent)); box-shadow: 0 0 0 2px var(--sw-accent-soft); }
    .ro { display: inline-flex; gap: 6px; align-items: center; margin-inline-start: auto; color: var(--sw-text-3); }
    .stage { position: relative; min-block-size: 320px; margin-block-start: 8px; }
    .ty { display: inline-flex; align-items: center; gap: 7px; font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-md); color: var(--sw-heading); }
    .ty i { inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--tone); box-shadow: 0 0 0 2px color-mix(in srgb, var(--tone) 22%, transparent); flex: none; }
    .sub { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0; font-size: var(--sw-fs-sm); }
    dt { color: var(--sw-text-3); }
    dd { margin: 0; }
    .noclip { margin-block-start: 12px; padding: 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); color: var(--sw-text-2); font-size: var(--sw-fs-xs); display: flex; gap: 8px; align-items: flex-start; }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    @media (max-width: 767px) {
      .filters sw-field, .filters sw-field:has(input[type='search']) { inline-size: 100%; }
      .ro { margin-inline-start: 0; }
    }
  `, bubbleChrome, INVESTIGATE_R5];

  connectedCallback() {
    super.connectedCallback();
    void this.init();
    this.unsubscribe = subscribeEvents(
      (ev) => this.onPushed(ev),
      (_state, connected) => { this.live = connected; },
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
    window.clearTimeout(this.qTimer);
    window.clearTimeout(this.pushTimer);
  }

  private async init() {
    try {
      const settings = await productSettings();
      this.tz = settings['time.zone'] ?? 'Asia/Jerusalem';
      if (!this.date) this.date = dateInZone(new Date(), this.tz);
      void this.loadFacets();
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async loadFacets() {
    try {
      this.facets = await getEventFacets();
    } catch {
      this.facets = null;
    }
  }

  private window(): { date?: string; from?: string; to?: string } {
    if (this.rangeDays <= 1) return { date: this.date || undefined };
    const to = new Date(`${this.date || dateInZone(new Date(), this.tz)}T23:59:59.999Z`);
    const from = new Date(to.getTime() - (this.rangeDays - 1) * 86_400_000);
    from.setUTCHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  private async load() {
    const seq = ++this.reqSeq;
    const [kind, id] = this.area.split(':');
    try {
      const r = await listEvents({
        ...this.window(), source: 'ha', type: this.type || undefined, query: this.q.trim() || undefined, limit: 500,
        floorId: kind === 'floor' ? id : undefined, zoneId: kind === 'zone' ? id : undefined,
      });
      if (seq !== this.reqSeq) return; // a newer request answers
      this.events = r.events as SensorEvent[];
      this.unsupported = r.filters?.unsupported ?? [];
      this.error = '';
    } catch (err) {
      if (seq !== this.reqSeq) return;
      this.error = describeError(err);
    }
  }

  /** A sensor event arrived on the socket: the list is re-read (one request, debounced) so the filters stay the server's. */
  private onPushed(ev: VmsEvent) {
    if (ev.source !== 'ha' || !this.events) return;
    window.clearTimeout(this.pushTimer);
    this.pushTimer = window.setTimeout(() => void this.load(), 800);
  }

  private onSearchInput(value: string) {
    this.q = value;
    window.clearTimeout(this.qTimer);
    this.qTimer = window.setTimeout(() => void this.load(), 350);
  }

  private get filtered(): boolean {
    return !!(this.type || this.area || this.q.trim());
  }

  private clearFilters() {
    this.type = '';
    this.area = '';
    this.q = '';
    void this.load();
  }

  private fmt(iso: string): string {
    return timeText(new Date(iso), { timeZone: this.tz, seconds: true });
  }

  private fmtDate(iso: string): string {
    return dayMonthText(new Date(iso), { timeZone: this.tz });
  }

  private sev(s: string): string {
    return s === 'critical' ? hev('sevCritical') : s === 'alert' ? hev('sevAlert') : hev('sevInfo');
  }

  private columns(): TableColumn[] {
    return [
      { key: 'type', label: hev('colEvent'), render: (r) => {
        const ev = r as unknown as SensorEvent;
        return html`<span class="ty" style="--tone:${EVENT_TONE[ev.type] ?? 'var(--sw-tl-offline)'}"><i></i>${describeSensorEvent(ev)}</span>${ev.count > 1 ? html`<div class="sub">${hev('repeats', { n: ev.count })}</div>` : nothing}`;
      } },
      { key: 'camera_name', label: hev('colSensor'), render: (r) => html`${String(r.camera_name ?? '—')}` },
      { key: 'place', label: hev('colArea'), render: (r) => { const p = placeLabel((r as unknown as SensorEvent).place); return p ? html`${p}` : html`<span class="sub">${hev('noArea')}</span>`; } },
      { key: 'occurred_at', label: hev('colTime'), render: (r) => html`<span class="ltr" style="font-weight:700;font-size:var(--sw-fs-md);font-variant-numeric:tabular-nums;color:var(--sw-heading)">${this.fmt(String(r.occurred_at))}</span><div class="sub ltr">${this.fmtDate(String(r.occurred_at))}</div>` },
      { key: 'severity', label: hev('colSeverity'), render: (r) => html`<sw-badge filled kind=${r.severity === 'critical' ? 'error' : r.severity === 'alert' ? 'stale' : 'neutral'} label=${this.sev(String(r.severity))}></sw-badge>` },
    ];
  }

  private renderFilters() {
    const areas = areaOptions(this.facets);
    return html`
      <div class="filters" data-ha-filters>
        <sw-field><input type="search" data-ha-q placeholder=${hev('search')} aria-label=${hev('searchLabel')} .value=${this.q} @input=${(e: Event) => this.onSearchInput((e.target as HTMLInputElement).value)} /></sw-field>
        <sw-field><select aria-label=${hev('type')} data-ha-type @change=${(e: Event) => { this.type = (e.target as HTMLSelectElement).value; void this.load(); }}>
          <option value="" ?selected=${!this.type}>${hev('typeAll')}</option>
          ${SENSOR_TYPES.map((t) => html`<option value=${t.value} ?selected=${this.type === t.value}>${hev(t.label)}</option>`)}
        </select></sw-field>
        <sw-field><select aria-label=${hev('area')} data-ha-area @change=${(e: Event) => { this.area = (e.target as HTMLSelectElement).value; void this.load(); }}>
          <option value="" ?selected=${!this.area}>${hev('areaAll')}</option>
          ${areas.map((a) => html`<option value=${a.value} ?selected=${this.area === a.value}>${a.label}</option>`)}
        </select></sw-field>
        <sw-field><input type="date" lang=${dateInputLang()} .value=${this.date} max=${dateInZone(new Date(), this.tz)} data-ltr data-ha-date aria-label=${hev('dateLabel')} @change=${(e: Event) => { this.date = (e.target as HTMLInputElement).value; void this.load(); }} /></sw-field>
        <span class="rangepick" role="group" aria-label=${hev('rangeLabel')} data-ha-range>
          ${([[1, 'range1'], [7, 'range7'], [30, 'range30']] as [number, HevKey][]).map(([n, k]) => html`<button class=${this.rangeDays === n ? 'on' : ''} aria-pressed=${this.rangeDays === n} data-ha-range-set=${n} @click=${() => { this.rangeDays = n; void this.load(); }}>${hev(k)}</button>`)}
        </span>
      </div>`;
  }

  private renderBody() {
    if (this.error && !this.events) return html`<sw-state-panel state="error" heading=${hev('loadError')} hint=${this.error} actionLabel=${hev('retry')} @action=${() => void this.init()}></sw-state-panel>`;
    if (!this.events) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const rows = this.events;
    const alerts = rows.filter((e) => e.severity !== 'info').length;
    const sensors = new Set(rows.map((e) => String((e.details as { entity_id?: string }).entity_id ?? e.camera_name ?? e.id))).size;
    const ev = rows.find((e) => e.id === this.selected) ?? null;
    return html`
      <div class="banner" data-ha-status>
        <span class="dot ${this.live ? 'on' : ''}"></span>
        <span data-ha-summary>${hev('summary', { n: rows.length, a: alerts, s: sensors })}</span>
        <span>· ${this.live ? hev('live') : hev('liveConnecting')}</span>
        <span class="ro" data-ha-readonly><sw-icon name="eye" size=${14}></sw-icon>${hev('readOnly')}</span>
      </div>
      ${this.unsupported.length ? html`<div class="banner warn" data-ha-unsupported>${hev('unsupported', { why: this.unsupported.map((u) => u.reason).join(' · ') })}</div>` : nothing}
      ${this.error ? html`<div class="banner warn">${this.error}</div>` : nothing}
      ${rows.length >= 500 ? html`<div class="banner" data-ha-truncated>${hev('truncated', { n: rows.length })}</div>` : nothing}
      <div class="stage">
        ${rows.length
          ? html`<sw-table data-ha-table .columns=${this.columns()} .rows=${rows as unknown as Record<string, unknown>[]} .selected=${this.selected} @row-select=${(e: CustomEvent<{ id: string }>) => (this.selected = e.detail.id)}></sw-table>`
          : this.filtered
            ? html`<sw-state-panel icon="filter" state="empty" data-ha-empty="filtered" heading=${hev('emptyFiltered')} hint=${hev('emptyFilteredHint')}><div style="margin-block-start:10px"><sw-button size="sm" data-ha-clear @click=${() => this.clearFilters()}>${hev('clearFilters')}</sw-button></div></sw-state-panel>`
            : html`<sw-state-panel icon="sensor" state="empty" data-ha-empty="none" heading=${hev('emptyTitle')} hint=${hev('emptyHint')}></sw-state-panel>`}
        ${ev ? this.renderDrawer(ev) : nothing}
      </div>`;
  }

  private renderDrawer(ev: SensorEvent) {
    const d = ev.details as { from?: unknown; to?: unknown };
    return html`<sw-drawer open heading=${describeSensorEvent(ev)} subheading=${`${ev.camera_name ?? ''} · ${this.fmt(ev.occurred_at)}`} data-ha-drawer @close=${() => (this.selected = null)}>
      <dl class="r5-facts">
        <div class="wide"><dt>${hev('drawerEvent')}</dt><dd>${describeSensorEvent(ev)}${ev.count > 1 ? ` · ${hev('repeats', { n: ev.count })}` : ''}</dd></div>
        <div><dt>${hev('drawerSensor')}</dt><dd>${ev.camera_name ?? '—'}</dd></div>
        <div><dt>${hev('drawerArea')}</dt><dd>${placeLabel(ev.place) || hev('noArea')}</dd></div>
        <div><dt>${hev('drawerTime')}</dt><dd><span class="ltr">${this.fmtDate(ev.occurred_at)} ${this.fmt(ev.occurred_at)}</span></dd></div>
        <div><dt>${hev('colSeverity')}</dt><dd>${this.sev(ev.severity)}</dd></div>
        ${d.from != null && d.from !== '' ? html`<div><dt>${hev('drawerFrom')}</dt><dd class="ltr">${String(d.from)}</dd></div>` : nothing}
        ${d.to != null && d.to !== '' ? html`<div><dt>${hev('drawerTo')}</dt><dd class="ltr">${String(d.to)}</dd></div>` : nothing}
        <div><dt>${hev('drawerCertainty')}</dt><dd>${hev('drawerMeasured')}</dd></div>
        <div><dt>${hev('drawerSource')}</dt><dd>${hev('drawerSourceValue')}</dd></div>
      </dl>
      <div class="noclip" data-ha-noclip><sw-icon name="info" size=${14}></sw-icon><span>${hev('drawerNoClip')}</span></div>
      <div slot="footer"><sw-button variant="ghost" size="sm" @click=${() => (this.selected = null)}>${hev('close')}</sw-button></div>
    </sw-drawer>`;
  }

  render() {
    return html`
      <sw-page heading=${hev('title')} subheading=${hev('subtitle', { tz: this.tz })}>
        ${this.renderFilters()}
        ${this.renderBody()}
      </sw-page>
    `;
  }
}
