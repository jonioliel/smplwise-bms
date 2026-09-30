import { LitElement, html, css, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { clockText, timeOfState, WEATHER_HE, weatherGlyph, type HomeWidgets, type WeatherGlyph } from '../api/home';
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

/**
 * The home screen's optional header widgets (owner notes 2026-09-30): a clock in the site's time zone, the weather of
 * one Home Assistant `weather.*` entity, and the Jewish-calendar times (parsha, candle lighting, havdalah) of the
 * sensors the owner picked. Small read-only chips; each one is drawn only when it has something to show, so an
 * unconfigured or unavailable widget takes no room at all (the host itself collapses when there is nothing).
 */
@customElement('home-widgets')
export class HomeWidgetsView extends LitElement {
  @property({ attribute: false }) data: HomeWidgets | null = null;
  @state() private now = new Date();
  private timer = 0;

  static styles = css`
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 8px;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
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
    @media (max-width: 599px) {
      .w {
        padding: 3px 8px;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.timer = window.setInterval(() => (this.now = new Date()), 10_000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
    this.timer = 0;
  }

  /** The widgets that have something to show, for the host to collapse when there are none. */
  static hasAny(d: HomeWidgets | null | undefined): boolean {
    return !!d && (d.clock !== 'off' || !!d.weather || !!(d.jewish && Object.keys(d.jewish).length));
  }

  render() {
    const d = this.data;
    this.toggleAttribute('hidden', !HomeWidgetsView.hasAny(d));
    if (!d) return nothing;
    const clock = d.clock !== 'off' ? clockText(this.now, d.clock, d.time_zone) : null;
    const w = d.weather;
    const j = d.jewish;
    const candles = timeOfState(j?.candles?.state, d.time_zone);
    const havdalah = timeOfState(j?.havdalah?.state, d.time_zone);
    const parsha = (j?.parsha?.state ?? '').trim();
    const parshaText = parsha && parsha !== 'unknown' && parsha !== 'unavailable' ? (/^פרשת|^פרשה/.test(parsha) ? parsha : `פרשת ${parsha}`) : '';
    return html`
      ${clock ? html`<span class="w clock" data-home-widget="clock" role="timer" aria-label="השעה עכשיו"><sw-icon name="clock" size=${15}></sw-icon><b>${ltrNum(clock.time)}</b>${clock.date ? html`<span class="sep" aria-hidden="true">·</span><span>${clock.date}</span>` : nothing}</span>` : nothing}
      ${w
        ? html`<span class="w weather" data-home-widget="weather" title=${WEATHER_HE[w.condition] ?? w.condition}
            ><svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[weatherGlyph(w.condition)]}</svg>${w.temperature !== null ? html`<b>${ltrNum(Math.round(w.temperature))}${w.unit.startsWith('°') ? w.unit : `°${w.unit}`}</b>` : nothing}<span>${WEATHER_HE[w.condition] ?? w.condition}</span>${w.humidity !== null ? html`<span class="sep" aria-hidden="true">·</span><span title="לחות">${ltrNum(Math.round(w.humidity))}%</span>` : nothing}</span
          >`
        : nothing}
      ${parshaText ? html`<span class="w" data-home-widget="parsha"><sw-icon name="calendar" size=${15}></sw-icon><b>${parshaText}</b></span>` : nothing}
      ${candles ? html`<span class="w" data-home-widget="candles" title="הדלקת נרות">הדלקת נרות <b>${ltrNum(candles)}</b></span>` : nothing}
      ${havdalah ? html`<span class="w" data-home-widget="havdalah" title="צאת שבת">צאת שבת <b>${ltrNum(havdalah)}</b></span>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'home-widgets': HomeWidgetsView;
  }
}
