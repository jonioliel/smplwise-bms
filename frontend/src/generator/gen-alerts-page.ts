import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-drawer';
import '../components/sw-state-panel';
import { ackAlert, ackAll, getAlert, getSettings, listAlerts, muteAlert, type GenAlert, type GenAlertDetail, type GenDevice, type Severity } from '../api/generator';
import { describeError } from '../api/client';
import { navigate } from '../router';
import { he } from '../i18n/he';
import { elecCss } from '../electricity/styles';
import { SkinController } from '../design/skin';
import { genCss } from './gen-styles';
import { activeFilters, alertCounts, durationMin, EMPTY_FILTER, filterQuery, fill, fmtDateTime, fmtDuration, fmtNum, matchesText, sortOpen, type HistoryFilter } from './gen-logic';

const G = he.generator;
const POLL_MS = 15_000;
const SNAP_UNITS: Record<string, string> = { fuel_pct: '%', battery_v: 'V', coolant_temp: '°C', oil_pressure: 'bar', load_pct: '%', rpm: 'rpm', gen_kw: 'kW' };
const sev = (s: Severity) => html`<span class="sev ${s}">${G.alerts.sev[s]}</span>`;
const durText = (a: GenAlert) => {
  const m = durationMin(a);
  return m >= 60 ? fill(G.alerts.durationH, { n: fmtDuration(m) }) : fill(G.alerts.durationMin, { n: fmtDuration(m) });
};

/**
 * תשתיות › גנרטור › התראות פעילות / היסטוריה (CR-031 GEN1): the open alerts (acknowledge one or all), the history with its filters (window, severity, type,
 * acknowledgement, state, free text) and the alert detail in a drawer (a bottom sheet on the phone) with snapshot, timeline, acknowledge with a note and a 24 h
 * mute. The list polls every 15 s. Acknowledge and mute need generator.view only.
 */
@customElement('gen-alerts-page')
export class GenAlertsPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) device!: GenDevice;
  @property() mode: 'alerts' | 'history' = 'alerts';
  @property() alertId = '';
  @property({ type: Boolean }) manage = false;
  @state() private rows: GenAlert[] = [];
  @state() private next: string | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private filter: HistoryFilter = { ...EMPTY_FILTER };
  @state() private detail: GenAlertDetail | null = null;
  @state() private note = '';
  @state() private busy = false;
  @state() private notice = '';
  @state() private retention = 0;
  private timer = 0;
  private seq = 0;

  static styles = [elecCss, genCss];

  connectedCallback() {
    super.connectedCallback();
    this.timer = window.setInterval(() => {
      if (!document.hidden && this.mode === 'alerts') void this.load(true);
    }, POLL_MS);
    if (this.manage) void getSettings().then((s) => (this.retention = s.alert_retention_days)).catch(() => undefined);
  }
  disconnectedCallback() {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }
  protected updated(c: Map<string, unknown>) {
    if (c.has('device') || c.has('mode')) void this.load();
    if (c.has('alertId')) void this.loadDetail();
  }

  private async load(quiet = false, more = false) {
    if (!this.device) return;
    const my = ++this.seq;
    if (!quiet && !more) this.phase = 'loading';
    try {
      const q = this.mode === 'alerts' ? { device_id: this.device.id, state: 'open' as const, limit: 100 } : { ...filterQuery(this.filter, this.device.id), ...(more && this.next ? { before: this.next } : {}) };
      const r = await listAlerts(q);
      if (my !== this.seq) return;
      this.rows = more ? [...this.rows, ...r.alerts] : r.alerts;
      this.next = r.next_before;
      this.phase = 'ready';
    } catch (e) {
      if (my !== this.seq) return;
      this.error = describeError(e);
      if (!quiet) this.phase = 'error';
    }
  }
  private async loadDetail() {
    this.note = '';
    this.notice = '';
    if (!this.alertId) {
      this.detail = null;
      return;
    }
    try {
      this.detail = await getAlert(this.alertId);
    } catch (e) {
      this.detail = null;
      this.notice = describeError(e);
    }
  }
  private setFilter(p: Partial<HistoryFilter>) {
    this.filter = { ...this.filter, ...p };
    if (!('text' in p)) void this.load();
  }
  private open(id: string) {
    navigate(`/infra/generator/${this.mode}/${encodeURIComponent(id)}`, { device: this.device.id });
  }
  private close() {
    navigate(`/infra/generator/${this.mode}`, { device: this.device.id });
  }
  private async act(fn: () => Promise<unknown>) {
    this.busy = true;
    try {
      await fn();
      await Promise.all([this.load(true), this.alertId ? this.loadDetail() : Promise.resolve()]);
      this.dispatchEvent(new CustomEvent('alerts-changed', { bubbles: true, composed: true }));
    } catch (e) {
      this.notice = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private card(a: GenAlert) {
    return html`<div class="al ${a.severity}" role="button" tabindex="0" data-alert=${a.id} @click=${() => this.open(a.id)} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.open(a.id)}>
      <div class="ic"><sw-icon name="warning" size="20"></sw-icon></div>
      <div class="grow"><div class="t1">${a.title} ${sev(a.severity)}${a.acknowledged ? html`<span class="sev mut">${G.alerts.ackedBy}</span>` : nothing}${a.count > 1 ? html`<span class="sev mut">${fill(G.alerts.repeated, { n: a.count })}</span>` : nothing}</div>
        <div class="t2"><span><sw-icon name="clock" size="12"></sw-icon> <span class="num">${fmtDateTime(a.raised_at)}</span> · ${durText(a)}</span></div></div>
      ${a.acknowledged ? nothing : html`<button class="btn sm pri" ?disabled=${this.busy} @click=${(e: Event) => { e.stopPropagation(); void this.act(() => ackAlert(a.id)); }} data-ack><sw-icon name="check" size="16"></sw-icon> ${G.alerts.ack}</button>`}
    </div>`;
  }

  private activeView() {
    const list = sortOpen(this.rows);
    const c = alertCounts(list);
    if (!list.length) return html`<div class="row"><span class="h2">${G.alerts.active}</span></div>
      <div class="card"><div class="empty" data-state="empty"><div class="ic"><sw-icon name="check" size="26"></sw-icon></div><h3>${G.alerts.emptyTitle}</h3><a class="btn ghost sm" href="#/infra/generator/history?device=${encodeURIComponent(this.device.id)}">${G.alerts.toHistory}</a></div></div>`;
    return html`<div class="row"><span class="h2">${G.alerts.active}</span>${c.unacked ? html`<span class="chip c-err">${fill(G.alerts.unacked, { n: c.unacked })}</span>` : nothing}${c.acked ? html`<span class="chip c-mut">${fill(G.alerts.acked, { n: c.acked })}</span>` : nothing}<div class="sp"></div>
      ${c.unacked ? html`<button class="btn" ?disabled=${this.busy} @click=${() => this.act(() => ackAll(this.device.id))} data-ack-all><sw-icon name="check" size="16"></sw-icon> ${G.alerts.ackAll}</button>` : nothing}</div>
      <div class="list" data-state="ready" style="flex-direction:column">${list.map((a) => this.card(a))}</div>`;
  }

  private historyView() {
    const f = this.filter;
    const types = (this.device.alert_types ?? []).filter((t) => t.available);
    const shown = this.rows.filter((a) => matchesText(a, f.text));
    const sel = (label: string, key: keyof HistoryFilter, opts: [string, string][]) => html`<select aria-label=${label} .value=${String(f[key])} @change=${(e: Event) => this.setFilter({ [key]: (e.target as HTMLSelectElement).value } as Partial<HistoryFilter>)} data-filter=${key}>${[['', `${label}: ${G.history.all}`] as [string, string], ...opts].map(([v, l]) => html`<option value=${v} ?selected=${f[key] === v}>${l}</option>`)}</select>`;
    const ackCell = (a: GenAlert) => (a.acknowledged ? html`${a.acked_by ? '' : G.alerts.ackedBy} <span class="mut num">${fmtDateTime(a.acked_at)}</span>` : a.state === 'open' ? html`<span class="chip c-warn">${G.alerts.pending}</span>` : html`<span class="mut">${G.alerts.notNeeded}</span>`);
    const stateCell = (a: GenAlert) => (a.state === 'open' ? html`<span class="chip c-err">${G.alerts.open}</span>` : html`<span class="mut">${G.alerts.cleared} ${fmtDateTime(a.cleared_at)}</span>`);
    return html`<div class="row"><span class="h2">${G.history.title}</span>${this.retention ? html`<span class="mut">${fill(G.history.kept, { n: this.retention })}</span>` : nothing}</div>
      <div class="filters" data-filters>
        <input type="search" placeholder=${G.history.search} aria-label=${G.history.search} .value=${f.text} @input=${(e: Event) => this.setFilter({ text: (e.target as HTMLInputElement).value })} data-filter="text" />
        <div class="seg" role="group" data-filter="window">${(['today', '7d', '30d', 'custom'] as const).map((w) => html`<button aria-pressed=${f.window === w} @click=${() => this.setFilter({ window: w })}>${G.history.windows[w]}</button>`)}</div>
        ${f.window === 'custom' ? html`<input type="datetime-local" aria-label="from" .value=${f.from} @change=${(e: Event) => this.setFilter({ from: (e.target as HTMLInputElement).value })} /><input type="datetime-local" aria-label="to" .value=${f.to} @change=${(e: Event) => this.setFilter({ to: (e.target as HTMLInputElement).value })} />` : nothing}
        ${sel(G.history.severity, 'severity', (['critical', 'alert', 'info'] as const).map((s) => [s, G.alerts.sev[s]]))}
        ${sel(G.history.type, 'type', types.map((t) => [t.key, t.title]))}
        ${sel(G.history.ack, 'ack', [['yes', G.history.yes], ['no', G.history.no]])}
        ${sel(G.history.state, 'state', [['open', G.history.stateOpen], ['closed', G.history.stateClosed]])}
        ${activeFilters(f) ? html`<button class="btn ghost sm" @click=${() => this.setFilter({ severity: '', type: '', ack: '', state: '' })}>${G.history.clear}</button>` : nothing}</div>
      ${!shown.length ? html`<div class="card"><div class="empty" data-state="empty"><div class="ic"><sw-icon name="check" size="26"></sw-icon></div><h3>${G.history.empty}</h3></div></div>` : html`
        <div class="mut" data-count>${fill(G.history.count, { n: shown.length })}</div>
        <div class="card flush hide-phone" data-state="ready"><div class="scrollx"><table class="t"><thead><tr><th>${G.history.cols.at}</th><th>${G.history.cols.alert}</th><th>${G.history.cols.severity}</th><th>${G.history.cols.state}</th><th>${G.history.cols.ack}</th></tr></thead>
          <tbody>${shown.map((a) => html`<tr class="go" data-alert=${a.id} @click=${() => this.open(a.id)}><td class="num">${fmtDateTime(a.raised_at)}</td><td class="b">${a.title}</td><td>${sev(a.severity)}</td><td>${stateCell(a)}</td><td>${ackCell(a)}</td></tr>`)}</tbody></table></div></div>
        <div class="list only-phone" style="flex-direction:column">${shown.map((a) => html`<button class="li" data-alert=${a.id} @click=${() => this.open(a.id)}><div class="grow"><div class="t1">${a.title}</div><div class="t2 num">${fmtDateTime(a.raised_at)} · ${a.state === 'open' ? G.alerts.open : G.alerts.cleared}</div></div>${sev(a.severity)}</button>`)}</div>
        ${this.next ? html`<button class="btn" @click=${() => this.load(false, true)}>${G.alerts.loadMore}</button>` : nothing}`}`;
  }

  private drawer() {
    const a = this.detail;
    const open = !!this.alertId;
    const tl = (e: GenAlertDetail['timeline'][number]) => {
      const tone = e.kind === 'raised' ? 'err' : e.kind === 'escalated' ? 'warn' : e.kind === 'delivery_failed' ? 'warn' : e.kind === 'folded' ? 'acc' : 'ok';
      const icon = e.kind === 'raised' || e.kind === 'delivery_failed' ? 'warning' : e.kind === 'folded' || e.kind === 'escalated' ? 'bell' : 'check';
      return html`<div class="ev"><div class="dot ${tone}"><sw-icon name=${icon} size="13"></sw-icon></div><div><b>${G.detail.tl[e.kind]}${e.kind === 'escalated' && e.step ? ` ${e.step}` : ''}</b><small class="num">${fmtDateTime(e.at)}${e.note ? ` · ${e.note}` : ''}</small></div></div>`;
    };
    const snap = a ? Object.entries(a.snapshot ?? {}).filter(([k, v]) => k in SNAP_UNITS && typeof v === 'number') : [];
    return html`<sw-drawer modal .open=${open} heading=${a?.title ?? G.detail.title} subheading=${a ? `${a.device_name ?? ''}` : ''} @close=${() => this.close()} data-drawer>
      ${a ? html`<div class="drawer-body" data-detail>
        <div class="row">${sev(a.severity)}<span class="mut">${G.detail.title}: <span class="num">${fmtDateTime(a.raised_at)}</span> · ${durText(a)}</span>${a.state === 'closed' ? html`<span class="sev cleared">${G.alerts.cleared}</span>` : nothing}</div>
        ${snap.length ? html`<span class="h3">${G.detail.snapshot}</span><div class="snap">${snap.map(([k, v]) => html`<div><span>${(G.snap as Record<string, string>)[k]}</span><b class="num">${fmtNum(v as number, k === 'battery_v' || k === 'oil_pressure' ? 1 : 0)} ${SNAP_UNITS[k]}</b></div>`)}</div>` : nothing}
        <span class="h3">${G.detail.timeline}</span><div class="tl">${a.timeline.map(tl)}</div>
        ${a.muted_until ? html`<div class="notice">${fill(G.detail.muted, { t: fmtDateTime(a.muted_until) })}</div>` : nothing}
        ${a.acknowledged ? html`<div class="notice" data-acked><sw-icon name="check" size="18"></sw-icon><span>${G.detail.acked} <span class="num">${fmtDateTime(a.acked_at)}</span>${a.ack_note ? ` · ${a.ack_note}` : ''}</span></div>`
          : html`<div class="fld"><label for="ack-note">${G.detail.note}</label><textarea id="ack-note" class="note" placeholder=${G.detail.notePh} .value=${this.note} @input=${(e: Event) => (this.note = (e.target as HTMLTextAreaElement).value)}></textarea></div>`}
        ${this.notice ? html`<div class="alert err" role="alert"><span class="x">!</span><div>${this.notice}</div></div>` : nothing}
        <div class="row">${a.acknowledged ? nothing : html`<button class="btn pri" ?disabled=${this.busy} @click=${() => this.act(() => ackAlert(a.id, this.note.trim()))} data-ack-detail><sw-icon name="check" size="16"></sw-icon> ${G.detail.ack}</button>`}
          ${a.state === 'open' ? html`<button class="btn" ?disabled=${this.busy} @click=${() => this.act(() => muteAlert(a.id, 24))} data-mute>${G.detail.mute}</button>` : nothing}</div>
      </div>` : this.notice ? html`<div class="alert err" role="alert"><span class="x">!</span><div>${this.notice}</div></div>` : html`<div class="skl" style="block-size:120px"></div>`}
    </sw-drawer>`;
  }

  render() {
    if (this.phase === 'loading' && !this.rows.length) return html`<div class="col" data-state="loading"><div class="skl" style="inline-size:200px"></div><div class="skl" style="block-size:72px"></div><div class="skl" style="block-size:72px"></div></div>`;
    if (this.phase === 'error' && !this.rows.length) return html`<sw-state-panel state="error" heading=${G.loadError} hint=${this.error} data-state="error"></sw-state-panel>`;
    return html`<div class="col" data-gen-alerts=${this.mode}>${this.mode === 'alerts' ? this.activeView() : this.historyView()}</div>${this.drawer()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gen-alerts-page': GenAlertsPage;
  }
}
