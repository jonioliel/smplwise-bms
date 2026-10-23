import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-drawer';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-state-panel';
import './ui';
import { ApiError, describeError } from '../api/client';
import { DEFAULT_RULES, nightRuleOff, water, type LeakRules, type ManualReading, type MeterDetail, type WaterEvent } from '../api/water';
import type { SnoozeSettings } from '../api/water-billing';
import { fmtDate, fmtDateTime, fmtTime } from '../electricity/format';
import { SkinController } from '../design/skin';
import { snoozeLabel, snoozeUntil } from './billing-format';
import { waterCss } from './styles';
import { alertOf, eventKindLabel, eventValue, kindLabel, m3OfL, meterChip, METER_KINDS, nightText, waterBarChart, type Bar } from './ui';
import { wt } from './i18n';

type Range = 'hours' | 'days' | 'months';
const RANGE_KEY = { hours: 'r24h', days: 'r30d', months: 'r12m' } as const;
const REASON_KEY: Record<string, 'reasonFirst' | 'reasonReplaced' | 'reasonSource'> = { first: 'reasonFirst', replaced: 'reasonReplaced', source_changed: 'reasonSource' };
const p2 = (n: number) => String(n).padStart(2, '0');
const localInput = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
const inWindow = (t: Date, r: Pick<LeakRules, 'night_from' | 'night_to'>) => {
  const m = t.getHours() * 60 + t.getMinutes();
  const [fh, fm] = r.night_from.split(':').map(Number);
  const [th, tm] = r.night_to.split(':').map(Number);
  const f = fh * 60 + fm;
  const to = th * 60 + tm;
  return f <= to ? m >= f && m < to : m >= f || m < to;
};

/**
 * The water meter card (section 5.1): the electricity card's drawer (electricity/meter-card.ts) with water content - the chip, the facts
 * (אזור, קריאה נוכחית, דיווח אחרון, יחידה, סוג, ספיקת לילה, כללי דליפה), the consumption chart 24 שעות / 30 ימים / 12 חודשים (the 24-hour
 * view shades the night window; a leak paints its bars red), the open alerts with אישור + the snooze split button (water.ack), the counter
 * lives, the manual readings (water.manage) and the actions row (שינוי שם, החלפת מונה, השהיה / חידוש, הסרה). Fires `close` and `changed`.
 */
@customElement('water-meter-card')
export class WaterMeterCard extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property() meterId = '';
  @property({ type: Boolean }) canManage = false;
  @property({ type: Boolean }) canAck = false;
  @property({ attribute: false }) rules: LeakRules = DEFAULT_RULES;
  @property({ attribute: false }) snooze: SnoozeSettings | null = null;
  @property({ attribute: false }) night: number | null | 'off' | undefined = undefined;

  @state() private detail: MeterDetail | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private range: Range = 'hours';
  @state() private bars: Bar[] = [];
  @state() private chartError = false;
  @state() private alerts: WaterEvent[] = [];
  @state() private readings: ManualReading[] = [];
  @state() private dlg: '' | 'remove' | 'replace' | 'rename' | 'reading' = '';
  @state() private busy = false;
  @state() private actionError = '';
  @state() private notice = '';
  @state() private f1 = '';
  @state() private f2 = '';
  @state() private f3 = '';
  @state() private unit: 'm3' | 'L' = 'm3';
  @state() private kind = '';
  private seq = 0;

  static styles = [
    waterCss,
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

  private fire(name: string) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }

  private async load() {
    const my = ++this.seq;
    this.phase = 'loading';
    try {
      const d = await water.meter(this.meterId);
      if (my !== this.seq) return;
      this.detail = d;
      this.phase = 'ready';
      if (this.canManage) void this.loadReadings();
      await this.loadAlerts(); // the 24-hour chart paints a leak's night bars: the alerts first
      if (my === this.seq) void this.loadSeries();
    } catch (err) {
      if (my !== this.seq) return;
      this.error = describeError(err);
      this.phase = 'error';
    }
  }

  private async refresh() {
    try {
      this.detail = await water.meter(this.meterId);
    } catch {
      /* the card keeps what it has */
    }
  }

  private async loadAlerts() {
    try {
      this.alerts = (await water.events('open', this.meterId)).items;
    } catch {
      this.alerts = [];
    }
  }

  private async loadReadings() {
    try {
      this.readings = await water.manualReadings(this.meterId);
    } catch {
      this.readings = [];
    }
  }

  private async loadSeries() {
    const range = this.range;
    const to = new Date();
    const span = range === 'hours' ? 1 : range === 'days' ? 30 : 365;
    const from = new Date(to.getTime() - span * 86_400_000);
    try {
      const items = await water.series(this.meterId, range === 'hours' ? '1h' : '1d', from.toISOString(), to.toISOString());
      if (range !== this.range) return;
      const leak = alertOf(this.meterId, this.alerts) === 'leak';
      if (range === 'hours') {
        this.bars = items.map((i) => {
          const t = new Date(i.start);
          const win = inWindow(t, this.rules);
          return { label: p2(t.getHours()), value: i.litres ?? 0, win, leak: win && leak };
        });
      } else if (range === 'days') {
        this.bars = items.map((i) => ({ label: String(new Date(i.start).getDate()), value: (i.litres ?? 0) / 1000 }));
      } else {
        const by = new Map<string, number>();
        for (const i of items) {
          const d = new Date(i.start);
          const k = `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
          by.set(k, (by.get(k) ?? 0) + (i.litres ?? 0) / 1000);
        }
        this.bars = [...by.entries()].map(([label, value]) => ({ label, value }));
      }
      this.chartError = false;
    } catch {
      this.chartError = true;
    }
  }

  private flash(t: string) {
    this.notice = t;
    window.setTimeout(() => (this.notice = ''), 4000);
  }

  private async act(run: () => Promise<unknown>, after?: () => void) {
    if (this.busy) return;
    this.busy = true;
    this.actionError = '';
    try {
      await run();
      after?.();
      this.fire('changed');
    } catch (err) {
      this.actionError = err instanceof ApiError && err.code === 'revision_conflict' ? wt('conflict') : describeError(err);
      if (err instanceof ApiError && err.code === 'revision_conflict') await this.refresh();
    } finally {
      this.busy = false;
    }
  }

  private ack(e: WaterEvent) {
    void this.act(() => water.ack(e.id), () => {
      this.flash(wt('acked'));
      void this.loadAlerts();
    });
  }

  private doSnooze(e: WaterEvent, minutes: number) {
    const exact = !!this.snooze;
    void this.act(() => water.snooze(e.id, exact ? minutes : undefined), () => {
      this.flash(wt('snoozedToast', { d: snoozeLabel(minutes), t: snoozeUntil(new Date(), minutes) }));
      void this.loadAlerts();
    });
  }

  private openDlg(k: 'remove' | 'replace' | 'rename' | 'reading') {
    const d = this.detail;
    this.actionError = '';
    this.f1 = k === 'rename' ? d?.display_name ?? '' : k === 'replace' ? (d?.value_l != null ? String(d.value_l / 1000) : '') : k === 'reading' ? localInput(new Date()) : '';
    this.f2 = k === 'replace' ? '0' : '';
    this.f3 = '';
    this.kind = d?.kind ?? 'other';
    this.unit = 'm3';
    this.dlg = k;
  }

  private save() {
    const d = this.detail;
    if (!d) return;
    if (this.dlg === 'rename') {
      const name = this.f1.trim();
      if (!name) return void (this.actionError = wt('nameRequired'));
      void this.act(() => water.patchMeter(d, { display_name: name, ...(this.kind !== d.kind ? { kind: this.kind as MeterDetail['kind'] } : {}) }), () => {
        this.dlg = '';
        void this.refresh();
      });
    } else if (this.dlg === 'replace') {
      const fin = Number(this.f1);
      const start = Number(this.f2);
      if (this.f1.trim() === '' || !Number.isFinite(fin) || fin < 0 || this.f2.trim() === '' || !Number.isFinite(start) || start < 0) return void (this.actionError = wt('replaceBad'));
      void this.act(() => water.replaceMeter(d, { old_final_reading_l: fin * 1000, new_start_reading_l: start * 1000, note: this.f3.trim() || undefined }), () => {
        this.dlg = '';
        void this.load();
      });
    } else if (this.dlg === 'reading') {
      const v = this.f2.trim().replace(',', '.');
      if (!v || !Number.isFinite(Number(v)) || Number(v) < 0 || !this.f1) return void (this.actionError = wt('replaceBad'));
      void this.act(() => water.addManual(d.id, { read_at: new Date(this.f1).toISOString(), value: v, unit: this.unit, note: this.f3.trim() || undefined }), () => {
        this.dlg = '';
        this.flash(wt('readingSaved'));
        void this.loadReadings();
        void this.refresh();
      });
    } else if (this.dlg === 'remove') {
      void this.act(() => water.retireMeter(d), () => {
        this.dlg = '';
        this.fire('close');
      });
    }
  }

  private renderAlerts() {
    if (!this.alerts.length) return nothing;
    return html`<h3 class="sec">${wt('openAlerts')}</h3>
      <div class="list" data-open-alerts>${this.alerts.map((e) => html`<div class="li" data-alert=${e.id}>
        <div class="grow"><div class="t1">${eventKindLabel(e.kind)} · ${eventValue(e)}</div><div class="t2 wrap">${wt('colSince')} <span class="num">${fmtTime(e.opened_at)}</span>${e.snoozed_until ? html` · ${wt('snoozedUntil', { t: fmtTime(e.snoozed_until) })}` : nothing}</div></div>
        ${this.canAck ? html`<span class="acts">${e.can_ack ? html`<button class="btn sm pri" type="button" data-ack ?disabled=${this.busy} @click=${() => this.ack(e)}>${wt('ack')}</button>` : nothing}
          ${e.can_snooze ? html`<water-snooze .settings=${this.snooze ?? { durations: [60], default: 60, max: 60 }} ?disabled=${this.busy} @snooze=${(ev: CustomEvent<{ minutes: number }>) => this.doSnooze(e, ev.detail.minutes)}></water-snooze>` : nothing}</span>` : nothing}
      </div>`)}</div>`;
  }

  private renderReadings() {
    if (!this.canManage) return nothing;
    return html`<div class="row"><h3 class="sec">${wt('readings')}</h3><span class="sp"></span><button class="btn sm" type="button" data-reading @click=${() => this.openDlg('reading')}>${wt('manualReading')}</button></div>
      ${this.readings.length
        ? html`<div class="list" data-readings>${this.readings.slice(0, 5).map((r) => html`<div class="li"><div class="grow"><div class="t1"><span class="num">${m3OfL(r.litres)}</span> ${wt('m3')}</div>
            <div class="t2">${fmtDateTime(r.read_at)} · ${r.voided_at ? wt('readingVoided') : r.effect === 'allocation' ? wt('effAllocation') : wt('effRecorded')}${r.note ? ` · ${r.note}` : ''}</div></div>
            ${r.voided_at ? nothing : html`<button class="btn sm ghost" type="button" data-undo-reading ?disabled=${this.busy} @click=${() => void this.act(() => water.undoManual(this.meterId, r.id), () => void this.loadReadings())}>${wt('readingUndo')}</button>`}</div>`)}</div>`
        : html`<div class="mut">${wt('noReadings')}</div>`}`;
  }

  private renderBody(d: MeterDetail) {
    const alert = alertOf(d.id, this.alerts);
    const off = nightRuleOff(d);
    const w = `${this.rules.night_from}-${this.rules.night_to}`;
    const own = d.rules && Object.keys(d.rules).length > 0;
    return html`<div class="body" data-meter-card=${d.id}>
      <div class="row">${meterChip(d, alert)}</div>
      ${this.notice ? html`<div class="notice" role="status">${this.notice}</div>` : nothing}
      <dl class="kv">
        <dt>${wt('fArea')}</dt><dd>${d.area_name ?? '-'}${d.floor_name ? ` · ${d.floor_name}` : ''}</dd>
        <dt>${wt('fReading')}</dt><dd><span class="num">${m3OfL(d.value_l)}</span> <span class="mut">${wt('m3')}</span></dd>
        <dt>${wt('fLast')}</dt><dd><span class="num">${fmtDateTime(d.last_report_at)}</span></dd>
        <dt>${wt('fUnit')}</dt><dd>${wt('fUnitValue')}</dd>
        <dt>${wt('fKind')}</dt><dd>${kindLabel(d.kind)}</dd>
        <dt>${wt('fNight')}</dt><dd>${off ? wt('fNightOff') : this.night === null || this.night === undefined ? '-' : html`<span class="num ${alert === 'leak' ? 'bad' : ''}">${nightText(this.night)}</span> ${wt('lph')}`}</dd>
        <dt>${wt('fRules')}</dt><dd>${own ? wt('fRulesOwn', { w }) : wt('fRulesDefault', { w })}</dd>
      </dl>
      <div class="row"><h3 class="sec">${wt('usage')}</h3><span class="sp"></span>
        <div class="seg" role="group" aria-label=${wt('range')}>${(['hours', 'days', 'months'] as Range[]).map((r) => html`<button type="button" aria-pressed=${this.range === r ? 'true' : 'false'} data-range=${r} @click=${() => { this.range = r; void this.loadSeries(); }}>${wt(RANGE_KEY[r])}</button>`)}</div></div>
      ${this.chartError ? html`<div class="alert err" role="alert">${wt('chartError')}</div>` : waterBarChart(this.bars, wt('chartAria', { r: wt(RANGE_KEY[this.range]) }), this.range === 'hours' ? (v) => String(Math.round(v)) : (v) => v.toFixed(v < 10 ? 2 : 1))}
      ${this.range === 'hours' ? html`<div class="mut">${wt('nightNote', { w })}</div>` : nothing}
      ${this.renderAlerts()}
      <h3 class="sec">${wt('epochs')}</h3>
      <div class="list" data-epochs>${d.epochs.map((e) => html`<div class="li"><div class="grow"><div class="t1">${REASON_KEY[e.reason] ? wt(REASON_KEY[e.reason]) : e.reason} · <span class="num">${fmtDate(e.started_at)}</span></div>
        <div class="t2 wrap">${wt('epochStart')} <span class="num">${m3OfL(e.start_reading_l)}</span>${e.ended_at ? html` · ${wt('epochUntil')} <span class="num">${fmtDate(e.ended_at)}</span>` : ''}${e.note ? ` · ${e.note}` : ''}</div></div>${e.ended_at ? nothing : html`<span class="chip c-acc nodot">${wt('epochActive')}</span>`}</div>`)}</div>
      ${this.renderReadings()}
      ${this.actionError && !this.dlg ? html`<div class="alert err" role="alert" data-meter-action-error>${this.actionError}</div>` : nothing}
      ${this.canManage
        ? html`<div class="actions">
            <sw-button data-meter-rename @click=${() => this.openDlg('rename')}>${wt('rename')}</sw-button>
            <sw-button data-meter-replace @click=${() => this.openDlg('replace')}>${wt('replace')}</sw-button>
            <sw-button data-meter-pause ?disabled=${this.busy || d.status === 'retired'} @click=${() => void this.act(() => water.patchMeter(d, { status: d.status === 'paused' ? 'active' : 'paused' }), () => void this.load())}>${d.status === 'paused' ? wt('resume') : wt('pause')}</sw-button>
            <span class="sp"></span>
            <sw-button variant="danger" data-meter-remove @click=${() => this.openDlg('remove')}>${wt('remove')}</sw-button>
          </div>`
        : nothing}
    </div>`;
  }

  private field(id: string, label: string, value: string, set: (v: string) => void, o: { type?: string; wide?: boolean; suffix?: string } = {}) {
    return html`<div class="fld ${o.wide ? 'wide' : ''}"><label for=${id}>${label}</label><div class="inp"><input id=${id} type=${o.type ?? 'text'} inputmode=${o.type ? 'text' : 'decimal'} .value=${value} @input=${(e: Event) => set((e.target as HTMLInputElement).value)} />${o.suffix ? html`<span class="mut">${o.suffix}</span>` : nothing}</div></div>`;
  }

  private renderDialogs() {
    const err = this.actionError && this.dlg ? html`<div class="alert err wide" role="alert">${this.actionError}</div>` : nothing;
    const foot = (label: string, danger = false) => html`<sw-button slot="footer" variant=${danger ? 'danger' : 'primary'} data-dialog-save ?disabled=${this.busy} @click=${() => this.save()}>${label}</sw-button><sw-button slot="footer" @click=${() => (this.dlg = '')}>${wt('cancel')}</sw-button>`;
    return html`
      <sw-dialog ?open=${this.dlg === 'remove'} heading=${wt('removeTitle')} data-meter-remove-dialog @close=${() => (this.dlg = '')}>
        <div>${wt('removeBody')}</div>${err}${foot(wt('remove'), true)}
      </sw-dialog>
      <sw-dialog ?open=${this.dlg === 'rename'} heading=${wt('renameTitle')} data-meter-rename-dialog @close=${() => (this.dlg = '')}>
        <div class="form">${this.field('wrn', wt('meterName'), this.f1, (v) => (this.f1 = v), { type: 'text', wide: true })}
          <div class="fld wide"><label for="wkd">${wt('meterKind')}</label><div class="inp"><select id="wkd" @change=${(e: Event) => (this.kind = (e.target as HTMLSelectElement).value)}>${METER_KINDS.map((k) => html`<option value=${k} ?selected=${k === this.kind}>${kindLabel(k)}</option>`)}</select></div></div>${err}</div>
        ${foot(wt('save'))}
      </sw-dialog>
      <sw-dialog ?open=${this.dlg === 'replace'} heading=${wt('replace')} data-meter-replace-dialog @close=${() => (this.dlg = '')}>
        <div class="form">${this.field('wfr', wt('replaceFinal'), this.f1, (v) => (this.f1 = v), { suffix: wt('m3') })}${this.field('wsr', wt('replaceStart'), this.f2, (v) => (this.f2 = v), { suffix: wt('m3') })}
          ${this.field('wnt', wt('replaceNote'), this.f3, (v) => (this.f3 = v), { type: 'text', wide: true })}${err}</div>
        ${foot(wt('replace'))}
      </sw-dialog>
      <sw-dialog ?open=${this.dlg === 'reading'} heading=${wt('manualReading')} data-meter-reading-dialog @close=${() => (this.dlg = '')}>
        <div class="form">${this.field('wra', wt('readingAt'), this.f1, (v) => (this.f1 = v), { type: 'datetime-local', wide: true })}
          ${this.field('wrv', wt('readingValue'), this.f2, (v) => (this.f2 = v))}
          <div class="fld"><label for="wru">${wt('fUnit')}</label><div class="inp"><select id="wru" @change=${(e: Event) => (this.unit = (e.target as HTMLSelectElement).value as 'm3' | 'L')}><option value="m3" ?selected=${this.unit === 'm3'}>${wt('m3')}</option><option value="L" ?selected=${this.unit === 'L'}>${wt('litre')}</option></select></div></div>
          ${this.field('wrn2', wt('readingNote'), this.f3, (v) => (this.f3 = v), { type: 'text', wide: true })}${err}</div>
        ${foot(wt('save'))}
      </sw-dialog>`;
  }

  render() {
    const d = this.detail;
    const sub = d ? [kindLabel(d.kind), d.area_name, d.floor_name].filter(Boolean).join(' · ') : '';
    return html`
      <sw-drawer ?open=${!this.dlg} modal heading=${d?.display_name ?? ''} subheading=${sub} data-meter-drawer @close=${() => { if (!this.dlg) this.fire('close'); }}>
        ${this.phase === 'loading' ? html`<sw-state-panel state="loading" compact></sw-state-panel>` : nothing}
        ${this.phase === 'error' ? html`<sw-state-panel state="error" compact heading=${wt('cardLoadError')} hint=${this.error} actionLabel=${wt('retry')} @action=${() => void this.load()}></sw-state-panel>` : nothing}
        ${this.phase === 'ready' && d ? this.renderBody(d) : nothing}
      </sw-drawer>
      ${this.renderDialogs()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'water-meter-card': WaterMeterCard;
  }
}
