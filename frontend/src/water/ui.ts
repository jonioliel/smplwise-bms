/**
 * CR-WATER78: the small shared pieces of the water pages - the volume formats (m³ with three decimals, owner Q10), the meter's state
 * chip (the electricity chip; an open alert wins: דליפה חשודה / צריכה חריגה), the kind labels, the alert's words, the bar chart (the
 * meter card's chart of electricity/meter-card.ts with the night share and the leak colour of the mockup) and the snooze split button
 * (section 16: the main part snoozes for the default, the arrow lists the configured durations with their end time).
 */
import { LitElement, html, css, svg, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import type { Meter, MeterKind, WaterEvent } from '../api/water';
import type { SnoozeSettings } from '../api/water-billing';
import { fmtM3, snoozeLabel, snoozeUntil } from './billing-format';
import { fmtTime } from '../electricity/format';
import { elecCss } from '../electricity/styles';
import { wt, type WtKey } from './i18n';

/** Litres to the m³ figure (three decimals); null = "-". */
export const m3OfL = (l: number | null | undefined): string => (l === null || l === undefined ? '-' : fmtM3(l / 1000));
/** A night-flow figure: "כבוי", "-" or the litres per hour. */
export const nightText = (v: number | null | 'off' | undefined): string => (v === 'off' ? wt('nightOff') : v === null || v === undefined ? '-' : String(v));

const KIND: Record<MeterKind, WtKey> = { main: 'kMain', sub: 'kSub', irrigation: 'kIrrigation', cooling: 'kCooling', pool: 'kPool', other: 'kOther' };
export const kindLabel = (k: MeterKind | string): string => (k in KIND ? wt(KIND[k as MeterKind]) : k);
export const METER_KINDS = Object.keys(KIND) as MeterKind[];

const LEAK_KINDS = ['night_flow', 'burst'];
/** The open alert that decides a meter's chip: a leak first, then abnormal use. */
export function alertOf(meterId: string, open: WaterEvent[]): 'leak' | 'abnormal' | null {
  const mine = open.filter((e) => e.meter_id === meterId && !e.closed_at);
  if (mine.some((e) => LEAK_KINDS.includes(e.kind))) return 'leak';
  if (mine.some((e) => e.kind === 'abnormal')) return 'abnormal';
  return null;
}

/** The מצב chip (section 5.1): an open alert wins, else the electricity chip (מדווח / לא מדווח מ-HH:MM / מושהה). */
export function meterChip(m: Pick<Meter, 'state' | 'last_report_at'>, alert: 'leak' | 'abnormal' | null): TemplateResult {
  if (alert === 'leak') return html`<span class="chip c-err" data-status="leak">${wt('stLeak')}</span>`;
  if (alert === 'abnormal') return html`<span class="chip c-warn" data-status="abnormal">${wt('stAbnormal')}</span>`;
  if (m.state === 'reporting') return html`<span class="chip c-ok" data-status="reporting">${wt('stReporting')}</span>`;
  if (m.state === 'paused') return html`<span class="chip c-mut" data-status="paused">${wt('stPaused')}</span>`;
  if (m.state === 'retired') return html`<span class="chip c-mut" data-status="retired">${wt('stRetired')}</span>`;
  return html`<span class="chip c-warn" data-status="not_reporting">${m.last_report_at ? wt('stNotReportingSince', { t: fmtTime(m.last_report_at) }) : wt('stNotReporting')}</span>`;
}

const EVENT_KIND: Record<string, WtKey> = { night_flow: 'akNight', burst: 'akBurst', abnormal: 'akAbnormal', offline: 'akOffline', health: 'akHealth' };
export const eventKindLabel = (k: string): string => (k in EVENT_KIND ? wt(EVENT_KIND[k]) : k);

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** The alert's value column: the flow for a leak / burst, today versus the usual day for abnormal use, "-" otherwise. */
export function eventValue(e: Pick<WaterEvent, 'kind' | 'value'>): string {
  const v = e.value ?? {};
  if (e.kind === 'night_flow' || e.kind === 'burst') {
    const rate = num(v.floor_lph ?? v.rate_lph);
    const thr = num(v.threshold_lph);
    if (rate === null) return '-';
    return thr === null ? wt('valueRate', { v: nf.format(rate) }) : wt('valueRateTh', { v: nf.format(rate), t: nf.format(thr) });
  }
  if (e.kind === 'abnormal') {
    const t = num(v.today_l);
    const m = num(v.median_l);
    return t === null ? '-' : wt('valueAbnormal', { v: fmtM3(t / 1000), m: m === null ? '-' : fmtM3(m / 1000) });
  }
  return '-';
}

/** The alert's state chip (the log): snoozed until, open, acknowledged, closed. */
export function eventChip(e: WaterEvent): TemplateResult {
  if (e.closed_at) return html`<span class="chip c-ok" data-event-state="closed">${e.ack_by_display ? wt('asClosedBy', { who: e.ack_by_display }) : wt('asClosed')}</span>`;
  if (e.snoozed_until) return html`<span class="chip c-mut" data-event-state="snoozed">${wt('snoozedUntil', { t: fmtTime(e.snoozed_until) })}</span>`;
  if (e.ack_at) return html`<span class="chip c-acc" data-event-state="acked">${wt('asAcked', { who: e.ack_by_display ?? '' })}</span>`;
  return html`<span class="chip ${e.severity === 'alarm' || LEAK_KINDS.includes(e.kind) ? 'c-err' : 'c-warn'}" data-event-state="open">${wt('asOpen')}</span>`;
}

export interface Bar {
  label: string;
  value: number;
  /** the night part of the bar (drawn darker at its foot), same unit as value */
  night?: number;
  leak?: boolean;
  /** inside the night window (the 24-hour view marks it) */
  win?: boolean;
  title?: string;
}

/** The electricity meter card's bar chart (thin bars, the latest in the accent, a value on the latest and the highest), with the water
 * additions of the mockup: the night share at the foot, leak bars in the danger colour, the night window shaded. */
export function waterBarChart(data: Bar[], ariaLabel: string, fmt: (v: number) => string = (v) => nf.format(v)): TemplateResult {
  const W = 640;
  const H = 170;
  const pad = 26;
  if (!data.length) return html`<div class="mut">${wt('chartNoData')}</div>`;
  const max = Math.max(...data.map((d) => d.value), 1) * 1.15;
  const bw = (W - pad * 2) / data.length;
  const barW = Math.min(bw * 0.64, 24);
  const labelEvery = Math.ceil(data.length / 12);
  const hi = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0);
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label=${ariaLabel} data-chart>
    ${data.map((d, i) => (d.win ? svg`<rect class="win" x=${W - pad - (i + 1) * bw} y="4" width=${bw} height=${H - 26} />` : nothing))}
    ${svg`<line x1=${pad} x2=${W - pad} y1=${H - 22} y2=${H - 22} class="grid" />`}
    ${data.map((d, i) => {
      const bh = Math.max(d.value > 0 ? 2 : 0, (d.value / max) * (H - 44));
      const nh = d.night ? Math.min(bh, Math.max(d.night > 0 ? 2 : 0, (d.night / max) * (H - 44))) : 0;
      const x = W - pad - (i + 1) * bw + (bw - barW) / 2;
      const last = i === data.length - 1;
      const cls = d.leak ? 'bar leak' : last ? 'bar hi' : 'bar';
      return svg`<rect class=${cls} x=${x} y=${H - 22 - bh} width=${barW} height=${bh} rx="3"><title>${d.title ?? `${d.label}: ${fmt(d.value)}`}</title></rect>
        ${nh ? svg`<rect class=${d.leak ? 'bar leak' : 'bar night'} x=${x} y=${H - 22 - nh} width=${barW} height=${nh}><title>${d.title ?? `${d.label}: ${fmt(d.value)}`}</title></rect>` : nothing}
        ${i % labelEvery === 0 || last ? svg`<text x=${x + barW / 2} y=${H - 6} text-anchor="middle">${d.label}</text>` : nothing}
        ${last || i === hi ? svg`<text x=${x + barW / 2} y=${H - 27 - bh} text-anchor="middle" class="val">${fmt(d.value)}</text>` : nothing}`;
    })}
  </svg>`;
}

/**
 * The snooze split button (section 16): the main part snoozes for the configured default ("נדנוד שעה"), the arrow opens the list of the
 * configured durations, each with its end time. Fires `snooze` with `{ minutes }`. Shown only to holders of water.ack (the caller decides).
 */
@customElement('water-snooze')
export class WaterSnooze extends LitElement {
  @property({ attribute: false }) settings: SnoozeSettings | null = null;
  @property({ type: Boolean }) disabled = false;
  @state() private open = false;
  @state() private pos = { top: 0, left: 0 };
  private onDoc = (e: Event) => {
    if (!e.composedPath().includes(this)) this.open = false;
  };
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.open = false;
  };

  static styles = [
    elecCss,
    css`
      :host {
        display: inline-flex;
      }
      .snz {
        display: inline-flex;
      }
      .snz .btn:first-child {
        border-start-end-radius: 0;
        border-end-end-radius: 0;
      }
      .snz .btn + .btn {
        border-start-start-radius: 0;
        border-end-start-radius: 0;
        margin-inline-start: -1px;
        padding-inline: 6px;
      }
      .menu {
        position: fixed;
        z-index: calc(var(--sw-z-modal, 1000) + 5);
        display: flex;
        flex-direction: column;
        min-inline-size: 150px;
        padding: 4px;
        background: var(--sw-menu-surface);
        border: 1px solid var(--sw-border-strong);
        border-radius: var(--sw-r-md);
        box-shadow: var(--sw-shadow-2, 0 8px 24px rgba(0, 0, 0, 0.18));
      }
      .menu button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: var(--sw-r-sm);
        font-size: var(--sw-fs-sm);
        color: var(--sw-text);
      }
      .menu button:hover,
      .menu button:focus-visible {
        background: var(--sw-surface-2);
      }
      .menu .mh {
        padding: 6px 12px 2px;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this.onDoc, true);
    document.addEventListener('keydown', this.onKey);
  }
  disconnectedCallback() {
    document.removeEventListener('click', this.onDoc, true);
    document.removeEventListener('keydown', this.onKey);
    super.disconnectedCallback();
  }

  private fire(minutes: number) {
    this.open = false;
    this.dispatchEvent(new CustomEvent('snooze', { detail: { minutes }, bubbles: true, composed: true }));
  }

  private toggle(e: Event) {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.pos = { top: Math.min(r.bottom + 4, window.innerHeight - 240), left: Math.max(8, Math.min(r.left, window.innerWidth - 200)) };
    this.open = !this.open;
  }

  render() {
    const s = this.settings;
    if (!s) return nothing;
    const now = new Date();
    return html`<span class="snz" @click=${(e: Event) => e.stopPropagation()}>
        <button class="btn sm" type="button" data-snooze=${s.default} ?disabled=${this.disabled} @click=${() => this.fire(s.default)}><sw-icon name="bellOff" size="13"></sw-icon>${wt('snooze', { d: snoozeLabel(s.default) })}</button>
        <button class="btn sm icononly" type="button" data-snooze-menu aria-haspopup="menu" aria-expanded=${this.open ? 'true' : 'false'} aria-label=${wt('snoozeOther')} ?disabled=${this.disabled} @click=${(e: Event) => this.toggle(e)}><sw-icon name="chevronDown" size="13"></sw-icon></button>
      </span>
      ${this.open
        ? html`<div class="menu" role="menu" style="top:${this.pos.top}px;left:${this.pos.left}px" data-snooze-list>
            <div class="mh">${wt('snoozeTo')}</div>
            ${s.durations.filter((d) => d <= s.max).map((d) => html`<button type="button" role="menuitem" data-pick=${d} @click=${(e: Event) => { e.stopPropagation(); this.fire(d); }}>${snoozeLabel(d)} <span class="mut">(${wt('snoozeUntil', { t: snoozeUntil(now, d) })})</span></button>`)}
            <div class="mh">${wt('snoozeFoot')}</div>
          </div>`
        : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'water-snooze': WaterSnooze;
  }
}

/** Reads a stored view choice (per-viewer convenience; storage may be unavailable). */
export function stored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the choice lasts until the page closes */
  }
}

/** Minutes to the words of the rule tile ("שעתיים", "4 שעות", "45 דקות"). */
export function durationWords(min: number): string {
  if (min === 60) return wt('hour1');
  if (min === 120) return wt('hours2');
  if (min % 60 === 0) return wt('hours', { n: min / 60 });
  return wt('minutes', { n: min });
}
