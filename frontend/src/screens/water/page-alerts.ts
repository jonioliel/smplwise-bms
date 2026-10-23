import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../../components/sw-icon';
import '../../components/sw-button';
import '../../components/sw-state-panel';
import '../../water/meter-card';
import { describeError } from '../../api/client';
import { DEFAULT_RULES, readableAlerts, water, type EventsSummary, type LeakRules, type WaterEvent } from '../../api/water';
import type { SnoozeSettings } from '../../api/water-billing';
import { navigate } from '../../router';
import { onWaterAccess, waterAccess, type WaterAccess } from '../../water/access';
import { waterCss } from '../../water/styles';
import { durationWords, eventChip, eventKindLabel, eventValue } from '../../water/ui';
import { snoozeLabel, snoozeUntil } from '../../water/billing-format';
import { wt, wtLang } from '../../water/i18n';
import { SkinController } from '../../design/skin';
import { bubbleChrome } from '../../styles/bubble-chrome';

const POLL_MS = 60_000;
const p2 = (n: number) => String(n).padStart(2, '0');
const dm = (iso: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
const csvSafe = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
const csvCell = (s: string) => `"${csvSafe(s).replace(/"/g, '""')}"`;

/**
 * תשתיות › מים › התראות (CR-WATER78 sections 5.3 and 16): the alert log in the meters page's shape - the head row (פתוחות / הכול, ייצוא CSV,
 * "כללי דליפה" for managers), four tiles (פתוחות, נסגרו השבוע, מנודנדות, the rule in force), the table (מונה, אזור, סוג, מאז, ערך, מצב, the
 * actions: אישור + the snooze split button for water.ack) and phone rows. An open row opens the meter card.
 */
@customElement('water-alerts-page')
export class WaterAlertsPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) segments: string[] = [];
  @property({ attribute: false }) params: URLSearchParams = new URLSearchParams();
  @state() private items: WaterEvent[] = [];
  @state() private summary: EventsSummary | null = null;
  @state() private rules: LeakRules = DEFAULT_RULES;
  @state() private snooze: SnoozeSettings | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private actionError = '';
  @state() private notice = '';
  @state() private filter: 'open' | 'all' = 'open';
  @state() private busy = false;
  @state() private access: WaterAccess = waterAccess();
  private stop?: () => void;
  private poll = 0;

  static styles = [waterCss, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onWaterAccess((a) => (this.access = a));
    void this.load(true);
    this.poll = window.setInterval(() => void this.load(false), POLL_MS);
    void readableAlerts().then((c) => {
      if (c) {
        this.rules = c.rules;
        this.snooze = c.snooze;
      }
    });
  }

  disconnectedCallback() {
    this.stop?.();
    window.clearInterval(this.poll);
    super.disconnectedCallback();
  }

  private async load(initial: boolean) {
    if (initial) this.phase = 'loading';
    try {
      const r = await water.events('all');
      this.items = r.items;
      this.summary = r.summary;
      this.phase = 'ready';
    } catch (err) {
      if (initial || this.phase !== 'ready') {
        this.error = describeError(err);
        this.phase = 'error';
      }
    }
  }

  private flash(t: string) {
    this.notice = t;
    window.setTimeout(() => (this.notice = ''), 4000);
  }

  private async act(run: () => Promise<unknown>, done: string) {
    if (this.busy) return;
    this.busy = true;
    this.actionError = '';
    try {
      await run();
      this.flash(done);
      await this.load(false);
    } catch (err) {
      this.actionError = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private snoozeEv(e: WaterEvent, minutes: number) {
    void this.act(() => water.snooze(e.id, this.snooze ? minutes : undefined), wt('snoozedToast', { d: snoozeLabel(minutes), t: snoozeUntil(new Date(), minutes) }));
  }

  private openMeter(e: WaterEvent) {
    if (e.closed_at) return;
    const rec: Record<string, string> = {};
    this.params.forEach((v, k) => (rec[k] = v));
    navigate('/infra/water/alerts', { ...rec, meter: e.meter_id });
  }

  private closeMeter() {
    const rec: Record<string, string> = {};
    this.params.forEach((v, k) => k !== 'meter' && (rec[k] = v));
    navigate('/infra/water/alerts', rec);
  }

  /** The visible rows as CSV (UTF-8 with BOM, formula-safe), built from what the page shows. */
  private exportCsv(rows: WaterEvent[]) {
    const he = wtLang() === 'he';
    const head = [wt('colMeter'), wt('colArea'), wt('colKind'), wt('colSince'), he ? 'עד' : 'Until', wt('colValue'), wt('colState')];
    const state = (e: WaterEvent) => (e.closed_at ? wt('asClosed') : e.snoozed_until ? wt('snoozedUntil', { t: dm(e.snoozed_until) }) : e.ack_at ? wt('asAcked', { who: e.ack_by_display ?? '' }) : wt('asOpen'));
    const lines = [head, ...rows.map((e) => [e.meter_name, [e.area_name, e.floor_name].filter(Boolean).join(' · '), eventKindLabel(e.kind), dm(e.opened_at), e.closed_at ? dm(e.closed_at) : '', eventValue(e), state(e)])];
    const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `water-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.flash(wt('csvDone'));
  }

  private actions(e: WaterEvent) {
    if (e.closed_at || !this.access.ack) return nothing;
    return html`<span class="acts">${e.can_ack ? html`<button class="btn sm pri" type="button" data-ack ?disabled=${this.busy} @click=${(ev: Event) => { ev.stopPropagation(); void this.act(() => water.ack(e.id), wt('acked')); }}>${wt('ack')}</button>` : nothing}
      ${e.can_snooze ? html`<water-snooze .settings=${this.snooze ?? { durations: [60], default: 60, max: 60 }} ?disabled=${this.busy} @snooze=${(ev: CustomEvent<{ minutes: number }>) => this.snoozeEv(e, ev.detail.minutes)}></water-snooze>` : nothing}</span>`;
  }

  render() {
    if (!this.access.view) return html`<sw-state-panel state="forbidden" data-water="alerts" data-state="forbidden"></sw-state-panel>`;
    if (this.phase === 'loading') {
      return html`<div data-water="alerts" data-state="loading" aria-busy="true"><div class="card">${Array.from({ length: 7 }, () => html`<div class="row" style="padding:10px 0"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div></div>`;
    }
    if (this.phase === 'error') {
      return html`<div data-water="alerts" data-state="error"><sw-state-panel state="error" heading=${wt('loadAlertsError')} hint=${this.error} actionLabel=${wt('retry')} @action=${() => void this.load(true)}></sw-state-panel></div>`;
    }
    const weekAgo = Date.now() - 7 * 86_400_000;
    const closedWeek = this.items.filter((e) => e.closed_at && Date.parse(e.closed_at) >= weekAgo).length;
    const rows = this.filter === 'all' ? this.items : this.items.filter((e) => !e.closed_at);
    const s = this.summary;
    const r = this.rules;
    const meterId = this.params.get('meter') ?? '';
    const head = html`<div class="row head">
      <div class="seg" role="group" aria-label=${wt('filter')} data-alert-filter>
        <button type="button" aria-pressed=${this.filter === 'open' ? 'true' : 'false'} data-f="open" @click=${() => (this.filter = 'open')}>${wt('fOpen')}</button>
        <button type="button" aria-pressed=${this.filter === 'all' ? 'true' : 'false'} data-f="all" @click=${() => (this.filter = 'all')}>${wt('fAll')}</button></div>
      <span class="sp"></span>
      <button class="btn" type="button" data-csv ?disabled=${!rows.length} @click=${() => this.exportCsv(rows)}><sw-icon name="download" size="15"></sw-icon>${wt('csv')}</button>
      ${this.access.manage || this.access.configure ? html`<button class="btn" type="button" data-leak-rules @click=${() => navigate('/infra/water/settings', { set: 'alerts' })}>${wt('leakRules')}</button>` : nothing}
    </div>`;
    const tiles = html`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${wt('tOpen')}</div><div class="v" style=${s?.open ? 'color:var(--sw-danger-text)' : ''}><span class="num" data-t-open>${s?.open ?? 0}</span></div></div>
      <div class="tile"><div class="k">${wt('tClosedWeek')}</div><div class="v"><span class="num" data-t-closed>${closedWeek}</span></div></div>
      <div class="tile"><div class="k">${wt('tSnoozed')}</div><div class="v"><span class="num" data-t-snz>${s?.snoozed ?? 0}</span></div></div>
      <div class="tile"><div class="k">${wt('tRule')}</div><div class="v"><span class="num">${r.night_from}-${r.night_to}</span><span class="u">${wt('ruleValue', { lph: r.night_min_lph, dur: durationWords(r.night_min_intervals * 15) })}</span></div></div>
    </div>`;
    const body = !rows.length
      ? html`<sw-state-panel icon="check" state="empty" heading=${wt('emptyAlerts')} data-no-alerts></sw-state-panel>`
      : html`<div class="card flush scrollx desk-only"><table class="t" data-alerts-table>
          <thead><tr><th>${wt('colMeter')}</th><th>${wt('colArea')}</th><th>${wt('colKind')}</th><th>${wt('colSince')}</th><th class="n">${wt('colValue')}</th><th>${wt('colState')}</th><th></th></tr></thead>
          <tbody>${rows.map((e) => html`<tr class=${e.closed_at ? '' : 'pick'} tabindex=${e.closed_at ? -1 : 0} data-alert=${e.id} @click=${() => this.openMeter(e)} @keydown=${(ev: KeyboardEvent) => { if (ev.key === 'Enter' && ev.target === ev.currentTarget) this.openMeter(e); }}>
            <td class="b">${e.meter_name}</td><td>${e.area_name ?? '-'}<span class="mut dsk">${e.floor_name ? ` · ${e.floor_name}` : ''}</span></td><td>${eventKindLabel(e.kind)}</td>
            <td><span class="num">${dm(e.opened_at)}</span>${e.closed_at ? html`<span class="mut"> - <span class="num">${dm(e.closed_at)}</span></span>` : nothing}</td>
            <td class="n">${eventValue(e)}</td><td>${eventChip(e)}</td><td class="n">${this.actions(e)}</td></tr>`)}</tbody></table></div>
        <div class="list phone-only" style="flex-direction:column" data-alerts-rows>${rows.map((e) => html`<div class="li ${e.closed_at ? 'dis' : 'pick'}" data-alert=${e.id} @click=${() => this.openMeter(e)}>
          <div class="grow"><div class="t1">${e.meter_name} · ${eventKindLabel(e.kind)}</div><div class="t2 wrap">${e.area_name ?? ''} · ${wt('colSince')} <span class="num">${dm(e.opened_at)}</span> · ${eventValue(e)}</div></div>${eventChip(e)}${this.actions(e)}</div>`)}</div>`;
    return html`<div class="page" data-water="alerts" data-state=${rows.length ? 'ready' : 'empty'}>
      ${head}
      ${this.notice ? html`<div class="notice" role="status" data-notice>${this.notice}</div>` : nothing}
      ${this.actionError ? html`<div class="alert err" role="alert">${this.actionError}</div>` : nothing}
      ${tiles}${body}
      ${meterId ? html`<water-meter-card .meterId=${meterId} ?canManage=${this.access.manage} ?canAck=${this.access.ack} .rules=${this.rules} .snooze=${this.snooze} @close=${() => this.closeMeter()} @changed=${() => void this.load(false)}></water-meter-card>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'water-alerts-page': WaterAlertsPage;
  }
}
