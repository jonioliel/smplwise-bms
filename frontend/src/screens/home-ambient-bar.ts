import { LitElement, html, css, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { ALARM_HE } from '../api/devices';
import { createClockSubscription } from '../api/clock-ticker';
import { calendarText, clockParts, hasValue, valueText, WEATHER_HE, type HomeConfig, type HomeData, type WidgetId, type WidgetItem } from '../api/home-config';
import { ltrNum } from '../i18n/bidi';
import { pl } from '../i18n/polish';

/** The widgets the thin bar carries in place of their large cards (POLISH-295). */
export const AMBIENT_WIDGETS: readonly WidgetId[] = ['clock', 'weather', 'shabbat', 'alarm'];

const CLOUD = svg`<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 11a3.5 3.5 0 0 0 0 7Z"/>`;
const CANDLE = svg`<path d="M12 3c1.2 1.5 1.8 2.6 1.8 3.4a1.8 1.8 0 0 1-3.6 0c0-.8.6-1.9 1.8-3.4Z"/><rect x="9.5" y="10" width="5" height="10.5" rx="1"/>`;

/**
 * POLISH-295 `<home-ambient-bar>` (owner approval 2026-10-25, `home.info_style` = bar, the default): the clock, the weather, the
 * Shabbat times and the alarm as one thin glass strip in the home screen's header row, so the upper half of the screen goes back to
 * the floors and areas. Each part shows only when its widget is on and has something to show (the same `items` the cards use); the
 * texts come from the same helpers as the cards. On a phone the strip keeps the time and the temperature. Read-only: nothing here acts.
 */
@customElement('home-ambient-bar')
export class HomeAmbientBar extends LitElement {
  @property({ attribute: false }) items: WidgetItem[] = [];
  @property({ attribute: false }) config!: HomeConfig;
  @property({ attribute: false }) data!: HomeData;
  @property() zone = 'Asia/Jerusalem';
  @state() private now = new Date();
  private clock = createClockSubscription((d) => (this.now = d));

  static styles = css`
    :host {
      display: inline-flex;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    .bar {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-4);
      min-block-size: var(--sw-ctl-h-lg);
      box-sizing: border-box; /* GATE-FIX-2270: one control row high, its 1 px border included (R5 large control = 40 px; it drew 42) */
      padding-inline: var(--sw-s-3);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      -webkit-backdrop-filter: var(--sw-glass-blur);
      backdrop-filter: var(--sw-glass-blur);
      border: 1px solid var(--sw-border);
      box-shadow: inset 0 1px 0 var(--sw-highlight), var(--sw-shadow-1);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      white-space: nowrap;
      min-inline-size: 0;
      overflow: hidden;
    }
    .part {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
    }
    .part + .part {
      padding-inline-start: var(--sw-s-4);
      border-inline-start: 1px solid var(--sw-border);
    }
    b {
      color: var(--sw-heading);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
    }
    sw-icon,
    svg {
      color: var(--sw-text-3);
      flex: none;
    }
    svg {
      inline-size: 15px;
      block-size: 15px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .alarm[data-tone='ok'] {
      color: var(--sw-success-text);
    }
    .alarm[data-tone='ok'] sw-icon {
      color: inherit;
    }
    .alarm[data-tone='err'] {
      color: var(--sw-danger-text);
      font-weight: var(--sw-fw-semibold);
    }
    .alarm[data-tone='err'] sw-icon {
      color: inherit;
    }
    @media (max-width: 1279px) {
      .wx-c,
      .date {
        display: none;
      }
    }
    @media (max-width: 767px) {
      .bar {
        gap: var(--sw-s-3);
        padding-inline: var(--sw-s-2);
        background: transparent;
        border-color: transparent;
        box-shadow: none;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }
      .part + .part {
        padding-inline-start: 0;
        border-inline-start: 0;
      }
      .shabbat,
      .alarm,
      .part sw-icon,
      .part svg {
        display: none;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.clock.setSeconds(false);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.clock.stop();
  }

  private has(id: WidgetId): boolean {
    return this.items.some((i) => i.id === id && i.avail === 'ok');
  }

  render() {
    if (!this.config || !this.data) return nothing;
    const parts = [this.clockPart(), this.weatherPart(), this.shabbatPart(), this.alarmPart()].filter((p) => p !== nothing);
    if (!parts.length) return nothing;
    return html`<div class="bar" role="group" data-home-ambient>${parts}</div>`;
  }

  private clockPart() {
    if (!this.has('clock')) return nothing;
    const p = clockParts(this.now, this.zone);
    const dated = this.config.clock.mode === 'datetime';
    return html`<span class="part" data-ambient="clock"><sw-icon name="clock" size=${15}></sw-icon><b role="timer" data-home-time>${p.h}:${p.m}</b>${dated ? html`<span class="date">${p.weekdayShort}, ${p.dateShort}</span>` : nothing}</span>`;
  }

  private weatherPart() {
    if (!this.has('weather') || !this.data.weather) return nothing;
    const w = this.data.weather;
    const src = this.config.weather.sources.temperature;
    const s = src ? this.data.sensors[src] : undefined;
    const n = hasValue(s) ? Number(s.state) : NaN;
    const temp = Number.isFinite(n) ? { v: n, unit: s?.unit ?? null } : w.values.temperature ? { v: w.values.temperature.v, unit: w.values.temperature.unit ?? null } : null;
    const cond = w.condition ? WEATHER_HE[w.condition] ?? w.condition : '';
    if (!temp && !cond) return nothing;
    return html`<span class="part" data-ambient="weather"><svg viewBox="0 0 24 24" aria-hidden="true">${CLOUD}</svg>${temp ? html`<b data-home-temp>${valueText('temperature', temp)}</b>` : nothing}${cond ? html`<span class="wx-c">${cond}</span>` : nothing}</span>`;
  }

  private shabbatPart() {
    if (!this.has('shabbat')) return nothing;
    const cal = this.config.calendar;
    const S = this.data.sensors;
    const candles = calendarText('candles', S[cal.candles], this.zone);
    const havdalah = calendarText('havdalah', S[cal.havdalah], this.zone);
    if (!candles && !havdalah) return nothing;
    return html`<span class="part shabbat" data-ambient="shabbat"><svg viewBox="0 0 24 24" aria-hidden="true">${CANDLE}</svg>${candles ? html`${pl('candles')} <b data-ambient-field="candles">${ltrNum(candles)}</b>` : nothing}${candles && havdalah ? html`<span aria-hidden="true">·</span>` : nothing}${havdalah ? html`${pl('havdalah')} <b data-ambient-field="havdalah">${ltrNum(havdalah)}</b>` : nothing}</span>`;
  }

  private alarmPart() {
    if (!this.has('alarm') || !this.data.alarm) return nothing;
    const a = this.data.alarm;
    const state = a.available ? a.state ?? '' : 'unavailable';
    const tone = state === 'triggered' ? 'err' : state === 'disarmed' || state === 'unavailable' || state === 'unknown' || state === '' ? 'neutral' : 'ok';
    return html`<span class="part alarm" data-ambient="alarm" data-tone=${tone}><sw-icon name="shield" size=${15}></sw-icon>${pl('alarm')} · <span data-home-alarm-state>${ALARM_HE[state] ?? state}</span></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'home-ambient-bar': HomeAmbientBar;
  }
}
