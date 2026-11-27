import { LitElement, html, nothing } from 'lit';
import { announce } from '../components/announcer';
import '../components/sw-button';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-drawer';
import '../components/sw-state-panel';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import { ackAlert, ackAll, getAlert, getSettings, listAlerts, muteAlert, unmuteAlert, type GenAlert, type GenAlertDetail, type GenDevice, type Severity } from '../api/generator';
import { ApiError, describeError } from '../api/client';
import { confirmDialog } from '../components/confirm-dialog';
import { focusIfLost } from '../components/focus-return';
import { PollController } from '../components/poll-controller';
import { navigate } from '../router';
import { he } from '../i18n/he';
import { elecCss } from '../electricity/styles';
import { SkinController } from '../design/skin';
import { genCss } from './gen-styles';
import { activeFilters, alertCounts, durationMin, EMPTY_FILTER, filterQuery, fill, fmtDateTime, fmtDuration, fmtNum, matchesText, sortOpen, type HistoryFilter } from './gen-logic';
import { dateInputLang } from '../api/day-format';

const G = he.generator;
const POLL_MS = 15_000;
const SNAP_UNITS: Record<string, string> = { fuel_pct: '%', battery_v: 'V', coolant_temp: '°C', oil_pressure: 'bar', load_pct: '%', rpm: 'rpm', gen_kw: 'kW' };
const sev = (s: Severity) => html`<span class="sev ${s}">${G.alerts.sev[s]}</span>`;
/** CR-CMP2-TABLES-GENMAINT-2450 (owner N10): a severity in the shared table is a shared tone chip (the cards and the drawer keep `.sev`) */
const SEV_TONE: Record<Severity, 'bad' | 'warn' | 'info'> = { critical: 'bad', alert: 'warn', info: 'info' };
const sevChip = (s: Severity) => html`<span class="chip" data-tone=${SEV_TONE[s]}>${G.alerts.sev[s]}</span>`;
const durText = (a: GenAlert) => {
  const m = durationMin(a);
  return m >= 60 ? fill(G.alerts.durationH, { n: fmtDuration(m) }) : fill(G.alerts.durationMin, { n: fmtDuration(m) });
};

/**
 * תשתיות › גנרטור › התראות פעילות / היסטוריה (CR-031 GEN1): the open alerts (acknowledge one or all), the history with its filters (window, severity, type,
 * acknowledgement, state, free text) and the alert detail in a drawer (a bottom sheet on the phone) with snapshot, timeline, acknowledge with a note and a 24 h
 * mute. The list polls every 15 s. Acknowledge and mute need generator.view only.
 * RELEASE-2540-TRAIN (DATA-RULES-2540 D-03): a CRITICAL alert's mute needs generator.manage and is capped by the server - a refusal says
 * so in the drawer, a shortened mute names its real end; a running mute can be ended ("ביטול ההשתקה", behind its own confirmation with
 * the focus on cancel, as PHYSICAL-CONFIRM-2540's dialogs).
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
  /** RELEASE-2540-TRAIN: the result line of a mute / un-mute that worked (the refusals stay in `notice`) */
  @state() private info = '';
  @state() private retention = 0;
  /** CR-POLL-FEATURES-2439: the open-alerts re-read every 15 s (alerts mode only) - paused while the tab is hidden, never two at once, caught up on resume. */
  private poll = new PollController(this);
  private seq = 0;

  static styles = [elecCss, genCss];

  connectedCallback() {
    super.connectedCallback();
    this.poll.every('alerts', POLL_MS, () => this.load(true), { when: () => this.mode === 'alerts' });
    if (this.manage) void getSettings().then((s) => (this.retention = s.alert_retention_days)).catch(() => undefined);
  }
  protected updated(c: Map<string, unknown>) {
    if (c.has('device') || c.has('mode')) void this.load();
    if (c.has('alertId')) void this.loadDetail();
    // A11Y-FOLLOWUPS-2560: the mute outcomes are said through the app's one announcer (the visible lines carry no live role of their own)
    if (c.has('notice') && this.notice) announce(this.notice, 'assertive');
    if (c.has('info') && this.info) announce(this.info);
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
    this.info = '';
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

  /** SCR-22: "ack all" reaches every open alert of the device, also ones not on screen - only after a confirmation that says how many. */
  private async ackAllNow(n: number) {
    if (!(await confirmDialog({ heading: G.alerts.ackAllTitle, body: fill(G.alerts.ackAllBody, { n }), confirmLabel: G.alerts.ackAll, focusCancel: true }))) return;
    await this.act(() => ackAll(this.device.id));
  }

  /** RELEASE-2540-TRAIN (DATA-RULES-2540 D-03): mute for 24 h. The server refuses a critical alert without generator.manage (403) and
   * shortens a critical mute; both are said in the drawer, never a silent no-op. */
  private async mute(a: GenAlertDetail) {
    this.busy = true;
    this.notice = '';
    this.info = '';
    const asked = Date.now() + 24 * 3600_000;
    try {
      const r = await muteAlert(a.id, 24);
      await Promise.all([this.load(true), this.loadDetail()]);
      const until = Date.parse(r.muted_until);
      if (Number.isFinite(until) && until < asked - 3600_000) this.info = fill(G.detail.mutedShort, { t: fmtDateTime(r.muted_until) });
      this.dispatchEvent(new CustomEvent('alerts-changed', { bubbles: true, composed: true }));
    } catch (e) {
      this.notice = e instanceof ApiError && e.status === 403 ? G.detail.muteForbidden : describeError(e);
    } finally {
      this.busy = false;
      this.focusOutcome();
    }
  }
  /** A11Y-NEW-2550: the button pressed went away or waited disabled (the un-mute button leaves with the mute) - the focus goes to the
   * outcome line instead of falling back to the page; nothing moves when the focus is anywhere else. */
  private focusOutcome() {
    void this.updateComplete.then(() => focusIfLost(this.renderRoot.querySelector<HTMLElement>('[data-detail] [data-notice], [data-detail] [data-mute-info]')));
  }
  /** RELEASE-2540-TRAIN (DATA-RULES-2540 D-03): end a running mute now - only after its own confirmation (focus on cancel). */
  private async unmute(a: GenAlertDetail) {
    if (!(await confirmDialog({ heading: G.detail.unmuteTitle, body: G.detail.unmuteBody, confirmLabel: G.detail.unmuteOk, focusCancel: true }))) return;
    this.busy = true;
    this.notice = '';
    this.info = '';
    try {
      await unmuteAlert(a.id);
      await Promise.all([this.load(true), this.loadDetail()]);
      this.info = G.detail.unmuted;
      this.dispatchEvent(new CustomEvent('alerts-changed', { bubbles: true, composed: true }));
    } catch (e) {
      this.notice = describeError(e);
    } finally {
      this.busy = false;
      this.focusOutcome();
    }
  }

  private card(a: GenAlert) {
    // A11Y-FOLLOWUPS-2560: the card is not a button (it holds the acknowledge button): the title row is the one real button and its
    // ::after stretches over the whole card, so a click anywhere opens the alert, Enter / Space work on it, and the acknowledge button sits above
    return html`<div class="al ${a.severity}" data-alert=${a.id}>
      <div class="ic"><sw-icon name="warning" size="20"></sw-icon></div>
      <div class="grow"><button type="button" class="t1 open" data-alert-open aria-describedby=${`al-t2-${a.id}`} @click=${() => this.open(a.id)}>${a.title} ${sev(a.severity)}${a.acknowledged ? html`<span class="sev mut">${G.alerts.ackedBy}</span>` : nothing}${a.count > 1 ? html`<span class="sev mut">${fill(G.alerts.repeated, { n: a.count })}</span>` : nothing}</button>
        <div class="t2" id=${`al-t2-${a.id}`}><span><sw-icon name="clock" size="12"></sw-icon> <span class="num">${fmtDateTime(a.raised_at)}</span> · ${durText(a)}</span></div></div>
      ${a.acknowledged ? nothing : html`<sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${(e: Event) => { e.stopPropagation(); void this.act(() => ackAlert(a.id)); }} data-ack>${G.alerts.ack}</sw-button>`}
    </div>`;
  }

  private activeView() {
    const list = sortOpen(this.rows);
    const c = alertCounts(list);
    if (!list.length) return html`<div class="row"><span class="h2">${G.alerts.active}</span></div>
      <div class="card"><div class="empty" data-state="empty"><div class="ic"><sw-icon name="check" size="26"></sw-icon></div><h3>${G.alerts.emptyTitle}</h3><a class="btn ghost sm" href="#/infra/generator/history?device=${encodeURIComponent(this.device.id)}">${G.alerts.toHistory}</a></div></div>`;
    return html`<div class="row"><span class="h2">${G.alerts.active}</span>${c.unacked ? html`<span class="chip c-err">${fill(G.alerts.unacked, { n: c.unacked })}</span>` : nothing}${c.acked ? html`<span class="chip c-mut">${fill(G.alerts.acked, { n: c.acked })}</span>` : nothing}<div class="sp"></div>
      ${c.unacked ? html`<sw-button icon="check" ?disabled=${this.busy} @click=${() => void this.ackAllNow(c.unacked)} data-ack-all>${G.alerts.ackAll}</sw-button>` : nothing}</div>
      <div class="list" data-state="ready" style="flex-direction:column">${list.map((a) => this.card(a))}</div>`;
  }

  private historyView() {
    const f = this.filter;
    const types = (this.device.alert_types ?? []).filter((t) => t.available);
    const shown = this.rows.filter((a) => matchesText(a, f.text));
    const sel = (label: string, key: keyof HistoryFilter, opts: [string, string][]) => html`<select aria-label=${label} .value=${String(f[key])} @change=${(e: Event) => this.setFilter({ [key]: (e.target as HTMLSelectElement).value } as Partial<HistoryFilter>)} data-filter=${key}>${[['', `${label}: ${G.history.all}`] as [string, string], ...opts].map(([v, l]) => html`<option value=${v} ?selected=${f[key] === v}>${l}</option>`)}</select>`;
    // CR-CMP2-TABLES-GENMAINT-2450 (owner N10): the history is the shared table - its cells in the shared vocabulary (tone chips, mut, num)
    const ackCell = (a: GenAlert) => (a.acknowledged ? html`${a.acked_by ? '' : G.alerts.ackedBy} <span class="mut num">${fmtDateTime(a.acked_at)}</span>` : a.state === 'open' ? html`<span class="chip" data-tone="warn">${G.alerts.pending}</span>` : html`<span class="mut">${G.alerts.notNeeded}</span>`);
    const stateCell = (a: GenAlert) => (a.state === 'open' ? html`<span class="chip" data-tone="bad">${G.alerts.open}</span>` : html`<span class="mut">${G.alerts.cleared} <span class="num">${fmtDateTime(a.cleared_at)}</span></span>`);
    const columns: TableColumn<GenAlert>[] = [
      { key: 'raised_at', label: G.history.cols.at, render: (a) => html`<span class="num">${fmtDateTime(a.raised_at)}</span>` },
      { key: 'title', label: G.history.cols.alert, render: (a) => html`<span class="t1">${a.title}</span>` },
      { key: 'severity', label: G.history.cols.severity, kind: 'status', render: (a) => sevChip(a.severity) },
      { key: 'state', label: G.history.cols.state, render: stateCell },
      { key: 'ack', label: G.history.cols.ack, render: ackCell },
    ];
    return html`<div class="row"><span class="h2">${G.history.title}</span>${this.retention ? html`<span class="mut">${fill(G.history.kept, { n: this.retention })}</span>` : nothing}</div>
      <div class="filters" data-filters>
        <input type="search" placeholder=${G.history.search} aria-label=${G.history.search} .value=${f.text} @input=${(e: Event) => this.setFilter({ text: (e.target as HTMLInputElement).value })} data-filter="text" />
        <sw-segmented data-filter="window" value=${f.window} @change=${(e: CustomEvent<SegmentedChange>) => this.setFilter({ window: e.detail.value as HistoryFilter['window'] })}
          .options=${(['today', '7d', '30d', 'custom'] as const).map((w) => ({ value: w, label: G.history.windows[w] }))}></sw-segmented>
        ${f.window === 'custom' ? html`<input type="datetime-local" lang=${dateInputLang()} aria-label="from" .value=${f.from} @change=${(e: Event) => this.setFilter({ from: (e.target as HTMLInputElement).value })} /><input type="datetime-local" lang=${dateInputLang()} aria-label="to" .value=${f.to} @change=${(e: Event) => this.setFilter({ to: (e.target as HTMLInputElement).value })} />` : nothing}
        ${sel(G.history.severity, 'severity', (['critical', 'alert', 'info'] as const).map((s) => [s, G.alerts.sev[s]]))}
        ${sel(G.history.type, 'type', types.map((t) => [t.key, t.title]))}
        ${sel(G.history.ack, 'ack', [['yes', G.history.yes], ['no', G.history.no]])}
        ${sel(G.history.state, 'state', [['open', G.history.stateOpen], ['closed', G.history.stateClosed]])}
        ${activeFilters(f) ? html`<sw-button variant="ghost" size="sm" @click=${() => this.setFilter({ severity: '', type: '', ack: '', state: '' })}>${G.history.clear}</sw-button>` : nothing}</div>
      ${!shown.length ? html`<div class="card"><div class="empty" data-state="empty"><div class="ic"><sw-icon name="check" size="26"></sw-icon></div><h3>${G.history.empty}</h3></div></div>` : html`
        <div class="mut" data-count>${fill(G.history.count, { n: shown.length })}</div>
        <div class="card flush hide-phone" data-state="ready"><sw-table bare data-gen-table data-gen-history-table .columns=${columns as unknown as TableColumn[]} .rows=${shown as unknown as Record<string, unknown>[]}
          .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-alert': String(r.id) })} @row-select=${(e: CustomEvent<{ id: string }>) => this.open(e.detail.id)}></sw-table></div>
        <div class="list only-phone" style="flex-direction:column">${shown.map((a) => html`<button class="li" data-alert=${a.id} @click=${() => this.open(a.id)}><div class="grow"><div class="t1">${a.title}</div><div class="t2 num">${fmtDateTime(a.raised_at)} · ${a.state === 'open' ? G.alerts.open : G.alerts.cleared}</div></div>${sev(a.severity)}</button>`)}</div>
        ${this.next ? html`<sw-button @click=${() => this.load(false, true)}>${G.alerts.loadMore}</sw-button>` : nothing}`}`;
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
        ${a.muted_until ? html`<div class="notice" data-muted>${fill(G.detail.muted, { t: fmtDateTime(a.muted_until) })}</div>` : nothing}
        ${a.acknowledged ? html`<div class="notice" data-acked><sw-icon name="check" size="18"></sw-icon><span>${G.detail.acked} <span class="num">${fmtDateTime(a.acked_at)}</span>${a.ack_note ? ` · ${a.ack_note}` : ''}</span></div>`
          : html`<div class="fld"><label for="ack-note">${G.detail.note}</label><textarea id="ack-note" class="note" placeholder=${G.detail.notePh} .value=${this.note} @input=${(e: Event) => (this.note = (e.target as HTMLTextAreaElement).value)}></textarea></div>`}
        ${this.notice ? html`<div class="alert err" data-notice><span class="x">!</span><div>${this.notice}</div></div>` : nothing}
        ${this.info ? html`<div class="notice" data-mute-info>${this.info}</div>` : nothing}
        <div class="row">${a.acknowledged ? nothing : html`<sw-button variant="primary" icon="check" ?disabled=${this.busy} @click=${() => this.act(() => ackAlert(a.id, this.note.trim()))} data-ack-detail>${G.detail.ack}</sw-button>`}
          ${a.state === 'open' ? html`<sw-button ?disabled=${this.busy} @click=${() => void this.mute(a)} data-mute>${G.detail.mute}</sw-button>` : nothing}
          ${a.muted_until && Date.parse(a.muted_until) > Date.now() ? html`<sw-button variant="ghost" icon="bell" ?disabled=${this.busy} @click=${() => void this.unmute(a)} data-unmute>${G.detail.unmute}</sw-button>` : nothing}</div>
      </div>` : this.notice ? html`<div class="alert err" role="alert"><span class="x">!</span><div>${this.notice}</div></div>` : html`<div class="skl" style="block-size:120px"></div>`}
    </sw-drawer>`;
  }

  render() {
    if (this.phase === 'loading' && !this.rows.length) return html`<div class="col" data-state="loading" aria-busy="true"><div class="skl" style="inline-size:200px"></div><div class="skl" style="block-size:72px"></div><div class="skl" style="block-size:72px"></div></div>`;
    if (this.phase === 'error' && !this.rows.length) return html`<sw-state-panel state="error" heading=${G.loadError} hint=${this.error} actionLabel=${G.retry} @action=${() => void this.load()} data-state="error"></sw-state-panel>`;
    return html`<div class="col" data-gen-alerts=${this.mode}>${this.mode === 'alerts' ? this.activeView() : this.historyView()}</div>${this.drawer()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gen-alerts-page': GenAlertsPage;
  }
}
