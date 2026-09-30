import { LitElement, html, css, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { clockCard, clockText, hourOf, sizeOf, timeOfState, WEATHER_HE, weatherGlyph, type HomeWidgets, type WeatherGlyph, type WidgetKind } from '../api/home';
import { ltrNum } from '../i18n/bidi';

const GLYPHS: Record<WeatherGlyph, TemplateResult> = {
  sun: svg`<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>`,
  moon: svg`<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>`,
  cloud: svg`<path d="M7 18a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 8.6 4.7 4.7 0 0 1 17 18H7Z"/>`,
  partly: svg`<path d="M8 3v1.5M3.5 8H5M4.8 4.8 6 6M12.5 4.8 11.3 6"/><path d="M8 11.5a3.5 3.5 0 1 1 3-5.3"/><path d="M8 19a3.5 3.5 0 0 1-.4-7 4.6 4.6 0 0 1 8.9-.5A3.8 3.8 0 0 1 16 19H8Z"/>`,
  rain: svg`<path d="M7 15a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 5.6 4.7 4.7 0 0 1 17 15H7Z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/>`,
  snow: svg`<path d="M7 15a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 5.6 4.7 4.7 0 0 1 17 15H7Z"/><path d="M8 19h.01M12 19h.01M16 19h.01M10 21.5h.01M14 21.5h.01"/>`,
  storm: svg`<path d="M7 14a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 4.6 4.7 4.7 0 0 1 17 14"/><path d="m12.5 12-2 4h3l-2 4"/>`,
  fog: svg`<path d="M7 13a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 3.6 4.7 4.7 0 0 1 17 13H7Z"/><path d="M5 16.5h14M8 20h8"/>`,
  wind: svg`<path d="M3 9h11a2.5 2.5 0 1 0-2.4-3.2M3 13h15a2.5 2.5 0 1 1-2.4 3.2M3 17h7"/>`,
};
const DROP = svg`<path d="M12 3c3.5 4.4 6 7.4 6 10.6A6 6 0 0 1 6 13.6C6 10.4 8.5 7.4 12 3Z"/>`;
const WIND = svg`<path d="M3 9h11a2.5 2.5 0 1 0-2.4-3.2M3 13h15a2.5 2.5 0 1 1-2.4 3.2M3 17h7"/>`;
/** Two candles with flames: the Shabbat candle-lighting. */
const CANDLE = svg`<path d="M8 21v-8h3v8M13 21v-6h3v6M6 21h12"/><path d="M9.5 6c1 1 1 2.2 0 3-1-.8-1-2 0-3ZM14.5 8c.8.8.8 1.8 0 2.4-.8-.6-.8-1.6 0-2.4Z"/>`;
/** A star over a horizon: the end of Shabbat (havdalah). */
const HAVDALAH = svg`<path d="m12 3 1.7 3.6 3.9.5-2.9 2.7.8 3.9L12 11.7 8.5 13.7l.8-3.9-2.9-2.7 3.9-.5L12 3Z"/><path d="M4 19h16M7 22h10"/>`;

const CHIP_LABEL: Record<WidgetKind, string> = { clock: 'שעון', weather: 'מזג אוויר', jewish: 'לוח שנה עברי' };

/**
 * The home screen's optional widgets (owner notes 2026-09-30, and the owner's feedback "first-class dashboard tiles"): a
 * clock in the site's time zone, the weather of one Home Assistant `weather.*` entity, and the Jewish-calendar times
 * (parsha, candle lighting, havdalah, optionally the Hebrew date) of the sensors the owner picked. Each is drawn at the
 * size chosen in edit mode: a small chip (mode "chips", in the header row) or a medium / large glass card in the summary
 * tiles' family (mode "cards", beside / above them). Read-only; a widget with nothing to show is not drawn and the host
 * collapses, so it takes no room. Nothing here reaches the network - the forecast row is the weather entity's own attribute.
 */
@customElement('home-widgets')
export class HomeWidgetsView extends LitElement {
  @property({ attribute: false }) data: HomeWidgets | null = null;
  /** "chips": only the widgets set to the small size; "cards": the medium and large ones. */
  @property({ reflect: true, attribute: 'data-mode' }) mode: 'chips' | 'cards' = 'chips';
  /** The screen's fit step (0-2): the cards get shorter so the page still fits the viewport. */
  @property({ type: Number, reflect: true, attribute: 'data-fit' }) fit = 0;
  @state() private now = new Date();
  private timer = 0;

  static styles = css`
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: stretch;
      gap: 6px 8px;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    :host([data-mode='chips']) {
      display: inline-flex;
      align-items: center;
    }
    :host([data-mode='cards']) {
      gap: 8px;
    }
    /* ---- chips ---- */
    .w {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border: 1px solid var(--sw-border);
      border-radius: 999px;
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      line-height: 1.2;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .w b {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .w svg,
    .w sw-icon {
      inline-size: 15px;
      block-size: 15px;
      flex: none;
      color: var(--sw-accent);
      fill: none;
      stroke: currentColor;
      stroke-width: 1.7;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .clock b {
      font-size: var(--sw-fs-sm);
    }
    .sep {
      color: var(--sw-border-strong);
    }
    /* ---- cards: the summary tiles' family (surface, border, radius, shadow; the glass blur when the style is glass) ---- */
    .card {
      --hw-h: 92px;
      flex: 1 1 auto;
      box-sizing: border-box;
      min-block-size: var(--hw-h);
      display: grid;
      align-items: center;
      column-gap: 12px;
      row-gap: 6px;
      padding: 10px 14px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      backdrop-filter: var(--sw-glass-blur, none);
      -webkit-backdrop-filter: var(--sw-glass-blur, none);
      color: var(--sw-text);
      font-variant-numeric: tabular-nums;
      min-inline-size: 0;
    }
    .card[data-size='large'] {
      --hw-h: 132px;
      padding: 12px 18px;
      column-gap: 16px;
    }
    :host([data-fit='1']) .card {
      --hw-h: 76px;
      padding-block: 6px;
    }
    :host([data-fit='1']) .card[data-size='large'] {
      --hw-h: 104px;
    }
    :host([data-fit='2']) .card {
      --hw-h: 62px;
      padding-block: 4px;
    }
    :host([data-fit='2']) .card[data-size='large'] {
      --hw-h: 84px;
    }
    .card .icon {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 10px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
    }
    .card .icon svg,
    .card .ico svg {
      inline-size: 100%;
      block-size: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .card .icon svg {
      inline-size: 22px;
      block-size: 22px;
    }
    .card .ico {
      display: inline-block;
      inline-size: 18px;
      block-size: 18px;
      color: var(--sw-accent);
      flex: none;
    }
    .lbl {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    /* clock */
    .card.clock {
      flex: 0 0 auto;
      grid-template-columns: minmax(0, 1fr);
      min-inline-size: 150px;
      justify-items: start;
    }
    .card.clock[data-size='large'] {
      min-inline-size: 220px;
    }
    .digits {
      font-size: 32px;
      font-weight: var(--sw-fw-bold);
      line-height: 1;
      letter-spacing: -0.02em;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .digits small {
      font-size: 0.5em;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
      margin-inline-start: 4px;
      letter-spacing: 0;
    }
    .card[data-size='large'] .digits {
      font-size: 52px;
    }
    .dateline {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      line-height: 1.25;
    }
    .card[data-size='large'] .dateline {
      font-size: var(--sw-fs-md);
    }
    .dateline b {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .hdate {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    :host([data-fit='2']) .hdate {
      display: none;
    }
    /* weather */
    .card.weather {
      grid-template-columns: auto auto minmax(0, 1fr);
      min-inline-size: 250px;
    }
    .card.weather[data-size='large'] {
      min-inline-size: 340px;
    }
    .wicon {
      inline-size: 44px;
      block-size: 44px;
      color: var(--sw-accent);
    }
    .card[data-size='large'] .wicon {
      inline-size: 60px;
      block-size: 60px;
    }
    .wicon svg {
      inline-size: 100%;
      block-size: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .temp {
      font-size: 30px;
      font-weight: var(--sw-fw-bold);
      line-height: 1;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .card[data-size='large'] .temp {
      font-size: 44px;
    }
    .cond {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      margin-block-start: 3px;
    }
    .facts {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      justify-self: end;
    }
    .facts span {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }
    .forecast {
      grid-column: 1 / -1;
      display: flex;
      gap: 6px;
      justify-content: space-between;
      padding-block-start: 6px;
      border-block-start: 1px solid var(--sw-border);
    }
    :host([data-fit='2']) .forecast {
      display: none;
    }
    .fc {
      display: grid;
      justify-items: center;
      gap: 2px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      min-inline-size: 0;
    }
    .fc b {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .fc svg {
      inline-size: 20px;
      block-size: 20px;
      fill: none;
      stroke: var(--sw-accent);
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    /* Shabbat / parsha */
    .card.jewish {
      grid-template-columns: auto minmax(0, 1fr);
      min-inline-size: 250px;
    }
    .card.jewish[data-size='large'] {
      min-inline-size: 320px;
    }
    .parsha {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      line-height: 1.2;
    }
    .card[data-size='large'] .parsha {
      font-size: var(--sw-fs-xl, 20px);
    }
    .times {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      margin-block-start: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .card[data-size='large'] .times {
      font-size: var(--sw-fs-md);
      margin-block-start: 8px;
    }
    .times span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .times b {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      direction: ltr;
      unicode-bidi: isolate;
    }
    /* a phone: the cards sit in one row that scrolls sideways and snaps */
    @media (max-width: 599px) {
      .w {
        padding: 3px 8px;
      }
      :host([data-mode='cards']) {
        flex-wrap: nowrap;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
        overscroll-behavior-x: contain;
      }
      :host([data-mode='cards'])::-webkit-scrollbar {
        display: none;
      }
      :host([data-mode='cards']) .card {
        flex: 0 0 min(88%, 320px);
        scroll-snap-align: start;
        min-inline-size: 0;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.schedule();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.timer);
    this.timer = 0;
  }

  /** The clock ticks each second only while a card shows seconds, else every 10 s. */
  private schedule() {
    window.clearTimeout(this.timer);
    const step = this.data?.clock_seconds && this.mode === 'cards' && this.data.clock !== 'off' && sizeOf(this.data, 'clock') !== 'chip' ? 1000 : 10_000;
    this.timer = window.setTimeout(() => {
      this.now = new Date();
      this.schedule();
    }, step);
  }

  /** The widgets this instance draws (its mode's sizes) that have something to show. */
  static shown(d: HomeWidgets | null | undefined, mode: 'chips' | 'cards'): WidgetKind[] {
    if (!d) return [];
    const want = (k: WidgetKind) => (sizeOf(d, k) === 'chip') === (mode === 'chips');
    const out: WidgetKind[] = [];
    if (d.clock !== 'off' && want('clock')) out.push('clock');
    if (d.weather && want('weather')) out.push('weather');
    if (d.jewish && Object.keys(d.jewish).length && want('jewish')) out.push('jewish');
    return out;
  }

  static hasAny(d: HomeWidgets | null | undefined, mode: 'chips' | 'cards' = 'chips'): boolean {
    return HomeWidgetsView.shown(d, mode).length > 0;
  }

  protected updated() {
    this.schedule();
  }

  render() {
    const d = this.data;
    const kinds = HomeWidgetsView.shown(d, this.mode);
    this.toggleAttribute('hidden', !kinds.length);
    if (!d || !kinds.length) return nothing;
    return html`${kinds.map((k) => (this.mode === 'chips' ? this.chip(k, d) : this.card(k, d)))}`;
  }

  // ------------------------------------------------------------------------------------------------ chips

  private chip(kind: WidgetKind, d: HomeWidgets) {
    if (kind === 'clock') {
      const c = clockText(this.now, d.clock, d.time_zone);
      return html`<span class="w clock" data-home-widget="clock" data-size="chip" role="timer" aria-label="השעה עכשיו"><sw-icon name="clock" size=${15}></sw-icon><b>${ltrNum(c.time)}</b>${c.date ? html`<span class="sep" aria-hidden="true">·</span><span>${c.date}</span>` : nothing}</span>`;
    }
    if (kind === 'weather') {
      const w = d.weather!;
      return html`<span class="w weather" data-home-widget="weather" data-size="chip" title=${WEATHER_HE[w.condition] ?? w.condition}
        ><svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[weatherGlyph(w.condition)]}</svg>${w.temperature !== null ? html`<b>${ltrNum(Math.round(w.temperature))}${w.unit.startsWith('°') ? w.unit : `°${w.unit}`}</b>` : nothing}<span>${WEATHER_HE[w.condition] ?? w.condition}</span>${w.humidity !== null ? html`<span class="sep" aria-hidden="true">·</span><span title="לחות">${ltrNum(Math.round(w.humidity))}%</span>` : nothing}</span
      >`;
    }
    const j = d.jewish!;
    const candles = timeOfState(j.candles?.state, d.time_zone);
    const havdalah = timeOfState(j.havdalah?.state, d.time_zone);
    const parsha = this.parshaText(j.parsha?.state);
    return html`${parsha ? html`<span class="w" data-home-widget="parsha" data-size="chip"><sw-icon name="calendar" size=${15}></sw-icon><b>${parsha}</b></span>` : nothing}
      ${candles ? html`<span class="w" data-home-widget="candles" data-size="chip" title="הדלקת נרות">הדלקת נרות <b>${ltrNum(candles)}</b></span>` : nothing}
      ${havdalah ? html`<span class="w" data-home-widget="havdalah" data-size="chip" title="צאת שבת">צאת שבת <b>${ltrNum(havdalah)}</b></span>` : nothing}`;
  }

  private parshaText(state: string | undefined): string {
    const p = (state ?? '').trim();
    if (!p || p === 'unknown' || p === 'unavailable') return '';
    return /^פרשת|^פרשה/.test(p) ? p : `פרשת ${p}`;
  }

  // ------------------------------------------------------------------------------------------------ cards

  private card(kind: WidgetKind, d: HomeWidgets) {
    const size = sizeOf(d, kind);
    if (kind === 'clock') {
      const c = clockCard(this.now, d.clock, d.time_zone, !!d.clock_seconds);
      const hebrew = (d.jewish?.date?.state ?? '').trim();
      return html`<div class="card clock" data-home-widget="clock" data-size=${size} role="timer" aria-label="השעה עכשיו">
        <div class="digits">${c.hm}${c.sec ? html`<small>${c.sec}</small>` : nothing}</div>
        ${c.weekday ? html`<div class="dateline"><b>${c.weekday}</b> · ${c.date}</div>` : nothing}
        ${hebrew && hebrew !== 'unknown' && hebrew !== 'unavailable' ? html`<div class="hdate" data-home-hebrew-date>${hebrew}</div>` : nothing}
      </div>`;
    }
    if (kind === 'weather') return this.weatherCard(d, size);
    return this.jewishCard(d, size);
  }

  private weatherCard(d: HomeWidgets, size: string) {
    const w = d.weather!;
    const unit = w.unit.startsWith('°') ? w.unit : `°${w.unit}`;
    const forecast = size === 'large' ? (w.forecast ?? []).filter((f) => hourOf(f.datetime, d.time_zone)).slice(0, 5) : [];
    return html`<div class="card weather" data-home-widget="weather" data-size=${size} title=${WEATHER_HE[w.condition] ?? w.condition}>
      <span class="wicon"><svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[weatherGlyph(w.condition)]}</svg></span>
      <div>
        ${w.temperature !== null ? html`<div class="temp">${Math.round(w.temperature)}${unit}</div>` : nothing}
        <div class="cond">${WEATHER_HE[w.condition] ?? w.condition}</div>
      </div>
      <div class="facts">
        ${w.humidity !== null ? html`<span title="לחות"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${DROP}</svg>${ltrNum(Math.round(w.humidity))}%</span>` : nothing}
        ${w.wind_speed !== null && w.wind_speed !== undefined ? html`<span title="רוח"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${WIND}</svg>${ltrNum(Math.round(w.wind_speed))} ${w.wind_unit === 'km/h' || !w.wind_unit ? 'קמ״ש' : w.wind_unit}</span>` : nothing}
      </div>
      ${forecast.length
        ? html`<div class="forecast" data-home-forecast>${forecast.map((f) => html`<div class="fc"><span>${hourOf(f.datetime, d.time_zone)}</span><svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[weatherGlyph(f.condition)]}</svg>${f.temperature !== null ? html`<b>${Math.round(f.temperature)}°</b>` : nothing}</div>`)}</div>`
        : nothing}
    </div>`;
  }

  private jewishCard(d: HomeWidgets, size: string) {
    const j = d.jewish!;
    const candles = timeOfState(j.candles?.state, d.time_zone);
    const havdalah = timeOfState(j.havdalah?.state, d.time_zone);
    const parsha = this.parshaText(j.parsha?.state);
    const hebrew = (j.date?.state ?? '').trim();
    return html`<div class="card jewish" data-home-widget="jewish" data-size=${size}>
      <span class="icon"><svg viewBox="0 0 24 24" aria-hidden="true">${CANDLE}</svg></span>
      <div>
        ${parsha ? html`<div class="parsha" data-home-widget="parsha">${parsha}</div>` : html`<div class="lbl">${CHIP_LABEL.jewish}</div>`}
        ${hebrew && hebrew !== 'unknown' && hebrew !== 'unavailable' && size === 'large' ? html`<div class="hdate">${hebrew}</div>` : nothing}
        <div class="times">
          ${candles ? html`<span data-home-widget="candles" title="הדלקת נרות"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${CANDLE}</svg>הדלקת נרות <b>${ltrNum(candles)}</b></span>` : nothing}
          ${havdalah ? html`<span data-home-widget="havdalah" title="צאת שבת"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${HAVDALAH}</svg>צאת שבת <b>${ltrNum(havdalah)}</b></span>` : nothing}
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'home-widgets': HomeWidgetsView;
  }
}
