import { LitElement, html, css, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-icon';
import { ALARM_HE } from '../api/devices';
import {
  calendarText, clockParts, forecastIsDaily, sinceText, untilText, forecastLabel, forecastShown, hasValue, hebrewDate, NO_DATA, QUICK_ACTION_LABEL, SIZE_LABEL, SIZES, valueText, WEATHER_FIELD_LABEL, WEATHER_HE, weatherGlyph,
  type Avail, type HomeConfig, type HomeData, type QuickAction, type Size, type WeatherField, type WeatherGlyph, type WidgetId, type WidgetItem,
} from '../api/home-config';
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
const GAUGE = svg`<path d="M4 16a8 8 0 1 1 16 0"/><path d="m12 16 3.5-5"/>`;
const EYE = svg`<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`;
const SUN_HIGH = svg`<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>`;
const EYE_OFF = svg`<path d="M3 3l18 18"/><path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.4 6.9A17 17 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 3.6-.7"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>`;
const CANDLE = svg`<path d="M8 21v-8h3v8M13 21v-6h3v6M6 21h12"/><path d="M9.5 6c1 1 1 2.2 0 3-1-.8-1-2 0-3ZM14.5 8c.8.8.8 1.8 0 2.4-.8-.6-.8-1.6 0-2.4Z"/>`;
const HAVDALAH = svg`<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>`;
const CAL = svg`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`;
const CLOCK_ICON = svg`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`;
const SHIELD = svg`<path d="M12 3 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>`;
const BOLT = svg`<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>`;
const BULB = svg`<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.6 1.5 2.6h4c0-1 .7-2 1.5-2.6A6 6 0 0 0 12 3z"/>`;
const CHEV = svg`<path d="m15 6-6 6 6 6"/>`;

const FIELD_ICON: Partial<Record<WeatherField, TemplateResult>> = { humidity: DROP, wind: WIND, pressure: GAUGE, visibility: EYE, uv: SUN_HIGH, precipitation: DROP, apparent: DROP };

/** What an event of this element carries. */
export interface HomeWidgetSize { id: WidgetId; size: Size }

/** The quick actions' numbers (the "N מנורות דולקות" line of the large card) and which ones this user may run. */
export interface QuickInfo {
  allowed: Partial<Record<QuickAction, boolean>>;
  lightsOn: number;
  switchesOn: number;
}

const GHOST_MSG: Record<Exclude<Avail, 'ok'>, string> = {
  off: 'כבוי',
  none: 'לא נבחרו ישויות',
  unavail: 'הישות לא זמינה כרגע',
  noalarm: 'אין מערכת אזעקה באתר',
  noaction: 'אין הרשאה לפעולות מהירות',
};

/**
 * The home screen's widgets - ONE widget system for the three directions (owner decisions 2026-09-30): the clock, the weather,
 * Shabbat, the alarm status card (read-only) and the quick actions, each a glass card at one of three sizes. The direction
 * only decides where this element sits and how it packs them (`layout`): "hero" a wrapping band above everything (a),
 * "side" a column beside the floors (b), "row" one compact row (c), "snap" a horizontal snap row on a phone. In edit mode
 * (`editing`) every card carries its own controls - size, hide, move (drag, or the arrow buttons / arrow keys on the grip),
 * settings - and a widget that is not shown appears as a dashed ghost that says why. Read-only otherwise; nothing here
 * reaches the network (the forecast row is the weather entity's own attribute).
 *
 * The element draws what it is given: `items` (config/home-config.ts resolveWidgets), `config` and `data`. Events:
 * home-widget-size {id, size}, home-widget-toggle {id}, home-widget-move {id, to}, home-widget-edit {id}, home-quick {action}.
 */
@customElement('home-widgets')
export class HomeWidgetsView extends LitElement {
  @property({ attribute: false }) items: WidgetItem[] = [];
  @property({ attribute: false }) config!: HomeConfig;
  @property({ attribute: false }) data: HomeData = NO_DATA;
  @property({ attribute: false }) quick: QuickInfo = { allowed: {}, lightsOn: 0, switchesOn: 0 };
  @property() zone = 'Asia/Jerusalem';
  @property({ reflect: true }) layout: 'hero' | 'side' | 'row' | 'snap' | 'stack' | 'two' = 'hero';
  @property({ type: Boolean, reflect: true }) editing = false;
  /** The screen's fit step (0-2): the cards get shorter so the page still fits the viewport. */
  @property({ type: Number, reflect: true, attribute: 'data-fit' }) fit = 0;
  @property({ type: Boolean }) alarmLink = false;
  @state() private now = new Date();
  @state() private dragId: WidgetId | '' = '';
  private timer = 0;

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    /* size tiers: .only-s / .only-m / .only-l show in one size; .ge-m from medium up */
    [data-size='s'] :is(.only-m, .only-l, .ge-m) {
      display: none !important;
    }
    [data-size='m'] :is(.only-s, .only-l) {
      display: none !important;
    }
    [data-size='l'] :is(.only-s, .only-m) {
      display: none !important;
    }
    .wrap {
      display: flex;
      gap: 12px;
      min-inline-size: 0;
    }
    .wg {
      position: relative;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 6px;
      min-inline-size: 0;
      padding: 14px 18px;
      background: var(--sw-surface);
      backdrop-filter: var(--sw-glass-blur, none);
      -webkit-backdrop-filter: var(--sw-glass-blur, none);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      overflow: hidden;
      color: var(--sw-text);
      font-variant-numeric: tabular-nums;
    }
    .wg[data-size='s'] {
      padding: 12px 14px;
      gap: 4px;
    }
    .wg-h {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 12px;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .wg-h svg,
    .wg-h sw-icon {
      inline-size: 15px;
      block-size: 15px;
      flex: none;
      color: var(--sw-accent);
    }
    .wg-h small {
      margin-inline-start: auto;
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-3);
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-inline-size: 55%;
    }
    svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .wg-b {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    .ic {
      inline-size: 1em;
      block-size: 1em;
      flex: none;
    }
    /* ---- clock ---- */
    .hm {
      font-size: var(--hm, 52px);
      font-weight: 300;
      letter-spacing: -0.03em;
      line-height: 1;
      direction: ltr;
      unicode-bidi: isolate;
      display: inline-block;
    }
    .hm b {
      font-weight: 300;
      opacity: 0.55;
      margin-inline: 0.03em;
    }
    .ss {
      font-size: calc(var(--hm, 52px) * 0.32);
      color: var(--sw-text-3);
      margin-inline-start: 6px;
      direction: ltr;
      unicode-bidi: isolate;
      display: inline-block;
    }
    .clk {
      display: flex;
      align-items: baseline;
      direction: ltr;
      justify-content: flex-end;
    }
    .wg-clock .dts {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-inline-size: 0;
    }
    .d1 {
      font-size: 13.5px;
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .d2 {
      font-size: 12.5px;
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
    }
    .wg-clock[data-size='s'] .d1 {
      font-size: 11.5px;
    }
    /* ---- weather ---- */
    .wg-weather {
      background: linear-gradient(160deg, var(--sky1, rgba(120, 180, 255, 0.26)), var(--sky2, rgba(255, 206, 120, 0.16)) 70%), var(--sw-surface);
    }
    .wx-main {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .wx-ic {
      inline-size: var(--wxi, 44px);
      block-size: var(--wxi, 44px);
      color: #e58e0b;
      stroke-width: 1.5;
      flex: none;
    }
    .wg-weather[data-cond='cloud'] .wx-ic,
    .wg-weather[data-cond='fog'] .wx-ic {
      color: #7b8aa6;
    }
    .wg-weather[data-cond='rain'] .wx-ic,
    .wg-weather[data-cond='storm'] .wx-ic {
      color: #3d6fd8;
    }
    .wx-tc {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
    }
    .wx-t {
      font-size: var(--wxt, 36px);
      font-weight: 300;
      letter-spacing: -0.03em;
      direction: ltr;
      unicode-bidi: isolate;
      display: inline-block;
      text-align: start;
    }
    .wx-c {
      font-size: 13px;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
      margin-block-start: 2px;
      white-space: nowrap;
    }
    .wx-m {
      display: flex;
      gap: 6px 14px;
      flex-wrap: wrap;
      font-size: 12px;
      color: var(--sw-text-2);
    }
    .wx-m span {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }
    .wx-m svg {
      inline-size: 14px;
      block-size: 14px;
      color: var(--sw-accent);
    }
    .wx-m b {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .wx-fc {
      display: grid;
      grid-template-columns: repeat(var(--fcn, 5), minmax(0, 1fr));
      gap: 4px;
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: 8px;
      margin-block-start: 2px;
    }
    .fc {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      font-size: 11px;
      color: var(--sw-text-3);
    }
    .fc svg {
      inline-size: 20px;
      block-size: 20px;
      color: #e58e0b;
    }
    .fc[data-cond='cloud'] svg,
    .fc[data-cond='fog'] svg {
      color: #7b8aa6;
    }
    .fc[data-cond='rain'] svg,
    .fc[data-cond='storm'] svg {
      color: #3d6fd8;
    }
    .fc b {
      font-size: 12.5px;
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .fc .hl {
      display: flex;
      gap: 5px;
      align-items: baseline;
      direction: ltr;
    }
    .fc i {
      font-style: normal;
      font-size: 11px;
    }
    /* ---- shabbat ---- */
    .wg-shabbat {
      background: linear-gradient(160deg, rgba(255, 184, 86, 0.26), rgba(255, 184, 86, 0.04) 75%), var(--sw-surface);
    }
    .pr {
      font-size: var(--prs, 19px);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.02em;
      line-height: 1.15;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sub {
      font-size: 12px;
      color: var(--sw-text-2);
    }
    .tms {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .tm {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      color: var(--sw-text-2);
    }
    .tm svg {
      inline-size: 16px;
      block-size: 16px;
      color: #d97706;
      flex: none;
    }
    .tm b {
      margin-inline-start: auto;
      font-size: 15px;
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .tm b.txt {
      direction: inherit;
      font-size: 13px;
    }
    .tm2 {
      display: flex;
      gap: 6px;
      align-items: center;
      font-size: 12.5px;
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .tm2 svg {
      color: #d97706;
      inline-size: 14px;
      block-size: 14px;
    }
    .tm2 b {
      direction: ltr;
      unicode-bidi: isolate;
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .cd {
      font-size: 11.5px;
      color: #a15c00;
      font-weight: var(--sw-fw-semibold);
    }
    /* ---- alarm ---- */
    .wg-alarm {
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
    .aic {
      display: grid;
      place-items: center;
      inline-size: var(--ali, 40px);
      block-size: var(--ali, 40px);
      border-radius: 50%;
      background: var(--sw-success-soft);
      color: var(--sw-success, #16a34a);
      flex: none;
    }
    .aic svg {
      inline-size: calc(var(--ali, 40px) * 0.5);
      block-size: calc(var(--ali, 40px) * 0.5);
    }
    .wg-alarm[data-tone='neutral'] .aic {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .wg-alarm[data-tone='err'] {
      background: linear-gradient(160deg, rgba(255, 59, 48, 0.22), rgba(255, 59, 48, 0.04)), var(--sw-surface);
      border-color: rgba(215, 0, 21, 0.35);
    }
    .wg-alarm[data-tone='err'] .aic {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .al-t {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      line-height: 1.2;
    }
    .al-l {
      font-size: 11.5px;
      color: var(--sw-text-3);
    }
    .al-s {
      font-size: var(--als, 16px);
      font-weight: var(--sw-fw-bold);
      white-space: nowrap;
    }
    .al-x {
      font-size: 11.5px;
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .al-go {
      font-size: 11.5px;
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      margin-block-start: 3px;
      display: inline-flex;
      gap: 3px;
      align-items: center;
      text-decoration: none;
    }
    .al-go svg {
      inline-size: 12px;
      block-size: 12px;
    }
    /* ---- quick actions ---- */
    .qa {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .qbtn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-block-size: 38px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      font-size: 12.5px;
      color: var(--sw-text);
      white-space: nowrap;
      cursor: pointer;
    }
    .qbtn:hover {
      background: var(--sw-surface-2);
    }
    .qbtn.danger {
      color: var(--sw-danger);
      border-color: rgba(215, 0, 21, 0.4);
    }
    .qbtn svg {
      inline-size: 16px;
      block-size: 16px;
    }
    .q-x {
      font-size: 11.5px;
      color: var(--sw-text-3);
    }
    .wg-quick[data-size='s'] .qa {
      flex-direction: row;
    }
    .wg-quick[data-size='s'] .qbtn {
      flex: 1;
      min-block-size: 34px;
      padding: 0 6px;
      font-size: 11.5px;
    }
    .qbtn:focus-visible,
    .grip:focus-visible,
    .eb:focus-visible,
    .seg button:focus-visible,
    .al-go:focus-visible {
      outline: 2px solid var(--sw-focus, var(--sw-accent));
      outline-offset: 2px;
    }
    /* ---- ghosts (edit mode: a widget that is off or not available) ---- */
    .wg.ghost {
      border: 2px dashed var(--sw-border-strong);
      background: var(--sw-surface-2);
      box-shadow: none;
      align-items: center;
      text-align: center;
      color: var(--sw-text-3);
      gap: 6px;
      font-size: 12.5px;
      min-block-size: 96px;
    }
    .wg.ghost b {
      color: var(--sw-text-2);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .wg.ghost b svg {
      inline-size: 16px;
      block-size: 16px;
    }
    .wg.ghost.warn {
      border-color: rgba(255, 159, 10, 0.55);
      background: var(--sw-warning-soft);
    }
    .gbtn {
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      border-radius: 999px;
      padding: 4px 12px;
      font: inherit;
      font-size: 12px;
      color: var(--sw-text);
      cursor: pointer;
    }
    /* ---- edit chrome on every shown widget ---- */
    :host([editing]) .wg:not(.ghost) {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
      padding-block-end: 52px;
    }
    :host([editing]) .wg[draggable='true'] {
      cursor: grab;
    }
    .wg.dragging {
      opacity: 0.4;
    }
    .wg-e {
      position: absolute;
      inset-inline: 8px;
      inset-block-end: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--sw-surface);
      border-radius: 999px;
      padding: 3px 4px 3px 8px;
      box-shadow: var(--sw-shadow-2);
      z-index: 3;
    }
    .grip {
      display: inline-grid;
      place-items: center;
      inline-size: 26px;
      block-size: 26px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--sw-text-3);
      cursor: grab;
    }
    .grip:hover,
    .eb:hover {
      background: var(--sw-surface-3);
    }
    .eb {
      display: inline-grid;
      place-items: center;
      inline-size: 26px;
      block-size: 26px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
      padding: 0;
    }
    .eb:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .eb svg,
    .grip svg,
    .grip sw-icon {
      inline-size: 14px;
      block-size: 14px;
    }
    .eb.x {
      margin-inline-start: auto;
    }
    .seg {
      display: inline-flex;
      background: var(--sw-surface-3);
      padding: 2px;
      border-radius: 999px;
      gap: 1px;
    }
    .seg button {
      border: 0;
      background: transparent;
      padding: 2px 9px;
      min-block-size: 24px;
      font: inherit;
      font-size: 11px;
      color: var(--sw-text-2);
      border-radius: 999px;
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    /* ================= directions ================= */
    /* a: control centre - a hero band */
    :host([layout='hero']) .wrap {
      flex-wrap: wrap;
      align-items: stretch;
    }
    :host([layout='hero']) .wg {
      flex: 1 1 var(--wb, 210px);
    }
    :host([layout='hero']) .wg[data-size='s'] {
      --wb: 140px;
      --hm: 36px;
      --wxi: 30px;
      --wxt: 26px;
      --prs: 15px;
      --ali: 30px;
      --als: 14px;
      min-block-size: 104px;
      flex-grow: 0.8;
    }
    :host([layout='hero']) .wg[data-size='m'] {
      --wb: 205px;
      --hm: 54px;
      --wxi: 44px;
      --wxt: 38px;
      --prs: 20px;
      --ali: 46px;
      --als: 18px;
      min-block-size: 146px;
      flex-grow: 1.2;
    }
    :host([layout='hero']) .wg[data-size='l'] {
      --wb: 290px;
      --hm: 74px;
      --wxi: 56px;
      --wxt: 50px;
      --prs: 26px;
      --ali: 54px;
      --als: 20px;
      min-block-size: 176px;
      flex-grow: 1.8;
    }
    :host([layout='hero'][data-fit='1']) .wg,
    :host([layout='hero'][data-fit='2']) .wg {
      padding-block: 10px;
    }
    :host([layout='hero'][data-fit='1']) .wg[data-size='m'] {
      min-block-size: 120px;
      --hm: 44px;
    }
    :host([layout='hero'][data-fit='1']) .wg[data-size='l'] {
      min-block-size: 140px;
      --hm: 58px;
      --wxi: 44px;
      --wxt: 40px;
    }
    :host([layout='hero'][data-fit='1']) .wg[data-size='l'] .wx-fc {
      padding-block-start: 5px;
    }
    :host([layout='hero'][data-fit='1']) .wg[data-size='l'] .wg-b,
    :host([layout='hero'][data-fit='1']) .wg[data-size='l'] {
      gap: 4px;
    }
    :host([layout='hero'][data-fit='2']) .wg[data-size='m'] {
      min-block-size: 96px;
      --hm: 36px;
    }
    :host([layout='hero'][data-fit='2']) .wg[data-size='l'] {
      min-block-size: 110px;
      --hm: 44px;
    }
    :host([layout='hero'][data-fit='2']) .wx-fc,
    :host([layout='hero'][data-fit='2']) .cd,
    :host([layout='hero'][data-fit='2']) .q-x {
      display: none;
    }
    :host([layout='hero']) .wg-weather[data-size='l'] .wg-b,
    :host([layout='side']) .wg-weather[data-size='l'] .wg-b {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      column-gap: 10px;
      row-gap: 8px;
    }
    :host([layout='hero']) .wg-weather[data-size='l'] .wx-fc,
    :host([layout='side']) .wg-weather[data-size='l'] .wx-fc {
      grid-column: 1 / -1;
      margin-block-start: 0;
    }
    :host([layout='hero']) .wg-weather[data-size='l'] .wx-m,
    :host([layout='side']) .wg-weather[data-size='l'] .wx-m {
      flex-direction: column;
      gap: 6px;
    }
    /* b: side panel - a column */
    :host([layout='side']) .wrap {
      flex-direction: column;
      gap: 12px;
    }
    :host([layout='side']) .wg {
      flex: none;
    }
    :host([layout='side']) .wg[data-size='s'] {
      min-block-size: 78px;
      --hm: 34px;
      --wxi: 28px;
      --wxt: 24px;
      --prs: 15px;
      --ali: 32px;
      --als: 14px;
    }
    :host([layout='side']) .wg[data-size='m'] {
      min-block-size: 124px;
      --hm: 46px;
      --wxi: 38px;
      --wxt: 34px;
      --prs: 19px;
      --ali: 40px;
      --als: 16px;
    }
    :host([layout='side']) .wg[data-size='l'] {
      min-block-size: 176px;
      --hm: 64px;
      --wxi: 54px;
      --wxt: 46px;
      --prs: 24px;
      --ali: 46px;
      --als: 18px;
    }
    :host([layout='side'][data-fit='1']) .wg[data-size='m'] {
      min-block-size: 104px;
      padding-block: 10px;
    }
    :host([layout='side'][data-fit='1']) .wg[data-size='l'] {
      min-block-size: 140px;
      padding-block: 10px;
    }
    :host([layout='side'][data-fit='2']) .wg {
      padding-block: 8px;
    }
    :host([layout='side'][data-fit='2']) .wg[data-size='m'],
    :host([layout='side'][data-fit='2']) .wg[data-size='l'] {
      min-block-size: 90px;
    }
    :host([layout='side'][data-fit='2']) .wx-fc,
    :host([layout='side'][data-fit='2']) .cd,
    :host([layout='side'][data-fit='2']) .q-x {
      display: none;
    }
    :host([layout='side']) .wg-clock[data-size='s'] .wg-b {
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
    :host([layout='side']) .wg-quick[data-size='m'] .qa,
    :host([layout='side']) .wg-quick[data-size='l'] .qa {
      flex-direction: row;
      flex-wrap: wrap;
    }
    :host([layout='side']) .wg-quick[data-size='m'] .qbtn,
    :host([layout='side']) .wg-quick[data-size='l'] .qbtn {
      flex: 1 1 120px;
    }
    /* c: compact single row */
    :host([layout='row']) .wrap {
      gap: 10px;
      align-items: stretch;
    }
    :host([layout='row']) .wg {
      flex: 1 1 var(--wb, 220px);
      flex-direction: row;
      align-items: center;
      gap: 14px;
      padding: 10px 16px;
      min-block-size: var(--wh, 88px);
    }
    :host([layout='row']) .wg-h {
      display: none;
    }
    :host([layout='row']) .wg-b {
      flex-direction: row;
      align-items: center;
      gap: 14px;
      flex: 1 1 auto;
    }
    :host([layout='row']) .wg[data-size='s'] {
      --wb: 118px;
      --wh: 70px;
      --hm: 30px;
      --wxi: 28px;
      --wxt: 24px;
      --prs: 14px;
      --ali: 30px;
      --als: 13px;
      padding: 8px 12px;
    }
    :host([layout='row']) .wg[data-size='m'] {
      --wb: 250px;
      --wh: 90px;
      --hm: 42px;
      --wxi: 38px;
      --wxt: 32px;
      --prs: 17px;
      --ali: 38px;
      --als: 15px;
    }
    :host([layout='row']) .wg[data-size='l'] {
      --wb: 330px;
      --wh: 112px;
      --hm: 52px;
      --wxi: 48px;
      --wxt: 38px;
      --prs: 20px;
      --ali: 44px;
      --als: 16px;
      flex-grow: 1.4;
    }
    :host([layout='row']) .wg-weather .wx-m {
      flex-direction: column;
      gap: 2px;
    }
    :host([layout='row']) .wg-weather .wx-fc {
      border-block-start: 0;
      padding-block-start: 0;
      margin: 0;
      border-inline-start: 1px solid var(--sw-border);
      padding-inline-start: 12px;
      grid-template-columns: repeat(var(--fcn, 3), auto);
      gap: 10px;
    }
    :host([layout='row']) .wg-shabbat .wg-b {
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
    }
    :host([layout='row']) .wg-shabbat .tms {
      flex-direction: row;
      gap: 14px;
    }
    :host([layout='row']) .wg-shabbat[data-size='m'] .tms {
      flex-direction: column;
      gap: 2px;
    }
    :host([layout='row']) .wg-quick .qa {
      flex-direction: row;
      gap: 6px;
    }
    :host([layout='row']) .wg-quick[data-size='m'] .qa {
      flex-direction: column;
      gap: 5px;
    }
    :host([layout='row']) .wg-quick .qbtn {
      min-block-size: 32px;
      font-size: 12px;
      padding: 0 10px;
    }
    :host([layout='row']) .wg-quick[data-size='l'] .qa {
      flex-direction: row;
    }
    :host([layout='row']) .wg-clock .clk {
      justify-content: flex-start;
    }
    :host([layout='row']) .wg-clock[data-size='m'] .d1 .only-m {
      display: none !important;
    }
    :host([layout='row']) .wg-clock[data-size='m'] .d1 .only-s {
      display: inline !important;
    }
    :host([layout='row'][editing]) .wrap {
      flex-wrap: wrap;
    }
    :host([layout='row'][data-fit='1']) .wg {
      --wh: 74px;
    }
    :host([layout='row'][data-fit='2']) .wg {
      --wh: 62px;
    }
    /* phone: widgets as a horizontal snap row */
    :host([layout='snap']) .wrap {
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
      overscroll-behavior-x: contain;
      padding-block: 2px 4px;
    }
    :host([layout='snap']) .wrap::-webkit-scrollbar {
      display: none;
    }
    :host([layout='snap']) .wg {
      flex: 0 0 var(--sw, 80%);
      scroll-snap-align: start;
      min-block-size: var(--sh, 150px);
    }
    /* one card under the other: every card the full width (the phone default) */
    :host([layout='stack']) .wrap {
      flex-direction: column;
      gap: 10px;
    }
    :host([layout='stack']) .wg {
      flex: none;
      min-block-size: var(--sh, 96px);
    }
    /* two per row (wrapping): small and medium cards share a row, a large one takes the whole row */
    :host([layout='two']) .wrap {
      flex-wrap: wrap;
      gap: 10px;
    }
    :host([layout='two']) .wg {
      flex: 1 1 calc(50% - 5px);
      min-inline-size: 0;
      min-block-size: var(--sh, 96px);
    }
    :host([layout='two']) .wg[data-size='l'],
    :host([layout='two']) .wg.ghost {
      flex-basis: 100%;
    }
    :host([layout='two']) .wg[data-size='m'] {
      padding-inline: 12px;
    }
    :host(:is([layout='snap'], [layout='stack'], [layout='two'])) .wg[data-size='s'] {
      --sw: 46%;
      --sh: 96px;
      --hm: 32px;
      --wxi: 28px;
      --wxt: 24px;
      --prs: 15px;
      --ali: 30px;
      --als: 14px;
    }
    :host(:is([layout='snap'], [layout='stack'], [layout='two'])) .wg[data-size='m'] {
      --sw: 66%;
      --sh: 140px;
      --hm: 48px;
      --wxi: 40px;
      --wxt: 34px;
      --prs: 19px;
      --ali: 38px;
      --als: 16px;
    }
    :host(:is([layout='snap'], [layout='stack'], [layout='two'])) .wg[data-size='l'] {
      --sw: 86%;
      --sh: 184px;
      --hm: 66px;
      --wxi: 54px;
      --wxt: 46px;
      --prs: 24px;
      --ali: 46px;
      --als: 18px;
    }
    :host(:is([layout='snap'], [layout='stack'], [layout='two'])[editing]) .wg:not(.ghost) {
      padding-block-end: 52px;
    }
    @media (prefers-reduced-motion: reduce) {
      .wrap {
        scroll-behavior: auto;
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
    const c = this.config?.clock;
    const secs = !!c && c.on && c.seconds && c.mode !== undefined && this.items.some((i) => i.id === 'clock' && i.avail === 'ok' && i.size !== 's');
    this.timer = window.setTimeout(() => {
      this.now = new Date();
      this.schedule();
    }, secs ? 1000 : 10_000);
  }

  protected updated() {
    this.schedule();
  }

  render() {
    const items = this.items;
    this.toggleAttribute('hidden', !items.length);
    if (!items.length || !this.config) return nothing;
    return html`<div class="wrap" data-home-widgets role=${this.layout === 'snap' ? 'list' : 'group'} aria-label="ווידג׳טים">${repeat(items, (it) => it.id, (it) => (it.avail === 'ok' ? this.card(it) : this.ghost(it)))}</div>`;
  }

  // ------------------------------------------------------------------------------------------------ edit chrome

  private emit<T>(name: string, detail: T) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private editBar(it: WidgetItem) {
    const vertical = this.layout === 'side';
    const last = this.items.length - 1;
    const earlier = vertical ? 'arrowUp' : 'chevron';
    const later = vertical ? 'arrowDown' : 'chevronBack';
    const name = it.title;
    const pos = this.items.findIndex((x) => x.id === it.id);
    return html`<div class="wg-e" role="group" aria-label=${`עריכה: ${name}`} data-home-edit-bar=${it.id}>
      <button type="button" class="grip" data-home-grip=${it.id} aria-label=${`הזז את ${name}. חצים למעלה או ימינה מקדימים, למטה או שמאלה מאחרים`} title="גרור, או חצים במקלדת" @keydown=${(e: KeyboardEvent) => this.onGripKey(e, it.id, pos)}>
        <sw-icon name="grip" size=${14}></sw-icon>
      </button>
      <button type="button" class="eb" data-home-move-earlier=${it.id} aria-label=${`הקדם את ${name}`} title="הקדם" ?disabled=${pos <= 0} @click=${() => this.emit('home-widget-move', { id: it.id, to: pos - 1 })}><sw-icon name=${earlier} size=${14}></sw-icon></button>
      <button type="button" class="eb" data-home-move-later=${it.id} aria-label=${`אחר את ${name}`} title="אחר" ?disabled=${pos >= last} @click=${() => this.emit('home-widget-move', { id: it.id, to: pos + 1 })}><sw-icon name=${later} size=${14}></sw-icon></button>
      <span class="seg" role="group" aria-label=${`גודל: ${name}`}>${SIZES.map((s) => html`<button type="button" data-home-size=${`${it.id}:${s}`} aria-pressed=${String(it.size === s)} @click=${() => this.emit('home-widget-size', { id: it.id, size: s })}>${SIZE_LABEL[s]}</button>`)}</span>
      <button type="button" class="eb" data-home-widget-settings=${it.id} aria-label=${`הגדרות: ${name}`} title="הגדרות" @click=${() => this.emit('home-widget-edit', { id: it.id })}><sw-icon name="edit" size=${14}></sw-icon></button>
      <button type="button" class="eb x" data-home-hide=${it.id} aria-label=${`הסתר את ${name}`} title="הסתר" @click=${() => this.emit('home-widget-toggle', { id: it.id })}><svg viewBox="0 0 24 24" aria-hidden="true">${EYE_OFF}</svg></button>
    </div>`;
  }

  private onGripKey(e: KeyboardEvent, id: WidgetId, pos: number) {
    const earlier = e.key === 'ArrowUp' || e.key === 'ArrowRight';
    const later = e.key === 'ArrowDown' || e.key === 'ArrowLeft';
    if (!earlier && !later) return;
    e.preventDefault();
    this.emit('home-widget-move', { id, to: pos + (earlier ? -1 : 1) });
    // the screen re-orders the cards on the event: focus the moved card's grip once that render is done
    void this.updateComplete.then(() => requestAnimationFrame(() => this.renderRoot.querySelector<HTMLElement>(`[data-home-grip="${id}"]`)?.focus()));
  }

  private drag(it: WidgetItem) {
    if (!this.editing) return {};
    return {
      draggable: 'true',
      onDragStart: (e: DragEvent) => {
        this.dragId = it.id;
        e.dataTransfer?.setData('text/plain', it.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      },
      onDragEnd: () => (this.dragId = ''),
      onDragOver: (e: DragEvent) => this.dragId && e.preventDefault(),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const id = this.dragId;
        this.dragId = '';
        const to = this.items.findIndex((x) => x.id === it.id);
        if (id && id !== it.id) this.emit('home-widget-move', { id, to });
      },
    };
  }

  private shell(it: WidgetItem, cls: string, extra: Record<string, string>, body: TemplateResult) {
    const d = this.drag(it) as { draggable?: string; onDragStart?: (e: DragEvent) => void; onDragEnd?: () => void; onDragOver?: (e: DragEvent) => void; onDrop?: (e: DragEvent) => void };
    return html`<section class=${classMap({ wg: true, [cls]: true, dragging: this.dragId === it.id })} data-home-widget=${it.id} data-size=${it.size} data-w=${it.id} draggable=${d.draggable ?? 'false'} role=${this.layout === 'snap' ? 'listitem' : 'group'} aria-label=${it.title}
      data-cond=${extra.cond ?? nothing} data-tone=${extra.tone ?? nothing}
      @dragstart=${d.onDragStart} @dragend=${d.onDragEnd} @dragover=${d.onDragOver} @drop=${d.onDrop}>${body}${this.editing ? this.editBar(it) : nothing}</section>`;
  }

  private ghost(it: WidgetItem) {
    const avail = it.avail as Exclude<Avail, 'ok'>;
    const btn = avail === 'off'
      ? html`<button type="button" class="gbtn" data-home-add=${it.id} @click=${() => this.emit('home-widget-toggle', { id: it.id })}>הוסף</button>`
      : avail === 'none' || avail === 'unavail'
        ? html`<button type="button" class="gbtn" data-home-choose=${it.id} @click=${() => this.emit('home-widget-edit', { id: it.id })}>בחר ישות</button>`
        : nothing;
    return html`<section class=${classMap({ wg: true, ghost: true, warn: avail === 'none' || avail === 'unavail' })} data-home-ghost=${it.id} data-home-avail=${avail} data-size="m" data-w=${it.id}>
      <b>${it.title}</b><span>${GHOST_MSG[avail]}</span>${btn}${avail === 'off' ? nothing : html`<span class="sub">מוצג רק במצב עריכה. במסך הרגיל הווידג׳ט לא תופס מקום.</span>`}
    </section>`;
  }

  // ------------------------------------------------------------------------------------------------ the cards

  private card(it: WidgetItem) {
    switch (it.id) {
      case 'clock':
        return this.clock(it);
      case 'weather':
        return this.weather(it);
      case 'shabbat':
        return this.shabbat(it);
      case 'alarm':
        return this.alarm(it);
      default:
        return this.quickCard(it);
    }
  }

  private head(it: WidgetItem, icon: TemplateResult, small = '') {
    return html`<div class="wg-h ge-m"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${it.title}</span>${small ? html`<small>${small}</small>` : nothing}</div>`;
  }

  private clock(it: WidgetItem) {
    const c = this.config.clock;
    const p = clockParts(this.now, this.zone);
    const dated = c.mode === 'datetime';
    const sensor = this.config.calendar.date ? this.data.sensors[this.config.calendar.date] : undefined;
    const hebrew = c.hebrew && dated ? (this.config.calendar.date ? (hasValue(sensor) ? sensor.state : '') : hebrewDate(this.now, this.zone)) : '';
    const dates = dated
      ? html`<div class="dts"><div class="d1"><span class="only-s">${p.weekdayShort} · ${p.dateShort}</span><span class="only-m">${p.weekdayLong}, ${p.dateLong}</span><span class="only-l">${p.weekdayLong}, ${p.dateYear}</span></div>${hebrew ? html`<div class="d2 ge-m" data-home-hebrew-date>${hebrew}</div>` : nothing}</div>`
      : nothing;
    return this.shell(it, 'wg-clock', {}, html`${this.head(it, CLOCK_ICON)}
      <div class="wg-b"><div class="clk" role="timer" aria-label="השעה עכשיו"><span class="hm" data-home-time>${p.h}<b>:</b>${p.m}</span>${c.seconds ? html`<span class="ss only-l">${p.s}</span>` : nothing}</div>${dates}</div>`);
  }

  private weather(it: WidgetItem) {
    const w = this.data.weather!;
    const cfg = this.config.weather;
    const has = (f: WeatherField) => cfg.fields.includes(f);
    const cond = w.condition ?? '';
    const valueOf = (f: WeatherField) => {
      const src = cfg.sources[f];
      if (src) {
        const s = this.data.sensors[src];
        if (hasValue(s)) {
          const n = Number(s.state);
          return Number.isFinite(n) ? { v: n, unit: s.unit } : undefined;
        }
      }
      return w.values[f];
    };
    const temp = has('temperature') ? valueOf('temperature') : undefined;
    const facts = (['apparent', 'humidity', 'wind', 'pressure', 'visibility', 'uv', 'precipitation'] as WeatherField[]).filter((f) => has(f)).map((f) => ({ f, v: valueOf(f) })).filter((x) => x.v);
    const showCond = has('condition') && !!cond;
    const entries = has('forecast') ? forecastShown(w.forecast, cfg.forecast) : [];
    const daily = forecastIsDaily(entries);
    return this.shell(it, 'wg-weather', { cond: weatherGlyph(cond) }, html`${this.head(it, GLYPHS.partly, w.name)}
      <div class="wg-b"><div class="wx-main">${cond && (temp || showCond) ? html`<svg class="wx-ic" viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[weatherGlyph(cond)]}</svg>` : nothing}
        <div class="wx-tc">${temp ? html`<span class="wx-t" data-home-temp>${valueText('temperature', { v: temp.v, unit: temp.unit ?? null })}</span>` : nothing}${showCond ? html`<span class="wx-c" data-home-cond>${WEATHER_HE[cond] ?? cond}</span>` : nothing}</div></div>
      ${facts.length ? html`<div class="wx-m ge-m" data-home-facts>${facts.map(({ f, v }) => html`<span data-home-fact=${f}><svg viewBox="0 0 24 24" aria-hidden="true">${FIELD_ICON[f] ?? DROP}</svg>${WEATHER_FIELD_LABEL[f]} <b>${valueText(f, { v: v!.v, unit: v!.unit ?? null })}</b></span>`)}</div>` : nothing}
      ${entries.length ? html`<div class="wx-fc only-l" data-home-forecast style=${`--fcn:${entries.length}`} aria-label="תחזית לימים הקרובים">${entries.map((e) => html`<div class="fc" data-cond=${weatherGlyph(e.condition)}><span>${forecastLabel(e.datetime, this.zone, daily)}</span><svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[weatherGlyph(e.condition)]}</svg>${e.temperature !== null ? html`<span class="hl"><b>${Math.round(e.temperature)}°</b>${e.templow !== undefined ? html`<i>${Math.round(e.templow)}°</i>` : nothing}</span>` : nothing}</div>`)}</div>` : nothing}</div>`);
  }

  private shabbat(it: WidgetItem) {
    const cal = this.config.calendar;
    const S = this.data.sensors;
    const parsha = calendarText('parsha', S[cal.parsha], this.zone);
    const holiday = calendarText('holiday', S[cal.holiday], this.zone);
    const candles = calendarText('candles', S[cal.candles], this.zone);
    const havdalah = calendarText('havdalah', S[cal.havdalah], this.zone);
    const clockShowsDate = this.config.clock.on && this.config.clock.hebrew && this.config.clock.mode === 'datetime' && this.items.some((i) => i.id === 'clock' && i.avail === 'ok');
    const date = !clockShowsDate ? calendarText('date', S[cal.date], this.zone) : '';
    const extras = cal.extras.map((e) => ({ label: e.label.trim() || S[e.entity_id]?.name || e.entity_id, value: calendarText('extra', S[e.entity_id], this.zone) })).filter((e) => e.value);
    const countdown = hasValue(S[cal.candles]) ? untilText(S[cal.candles].state, this.now) : '';
    const title = parsha || holiday || it.title;
    const line = (icon: TemplateResult, label: string, value: string, field: string) => html`<div class="tm" data-home-field=${field}><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${label}</span><b>${ltrNum(value)}</b></div>`;
    return this.shell(it, 'wg-shabbat', {}, html`${this.head(it, CAL)}
      <div class="wg-b"><div class="pr" data-home-parsha>${title}</div>
        ${parsha && holiday ? html`<div class="sub ge-m" data-home-field="holiday">${holiday}</div>` : nothing}
        ${date ? html`<div class="sub ge-m" data-home-field="date">${date}</div>` : nothing}
        ${candles || havdalah
          ? html`<div class="tm2 only-s">${candles ? html`<svg viewBox="0 0 24 24" aria-hidden="true">${CANDLE}</svg><b>${ltrNum(candles)}</b>` : nothing}${candles && havdalah ? html`<span>·</span>` : nothing}${havdalah ? html`<svg viewBox="0 0 24 24" aria-hidden="true">${HAVDALAH}</svg><b>${ltrNum(havdalah)}</b>` : nothing}</div>
            <div class="tms ge-m">${candles ? line(CANDLE, 'הדלקת נרות', candles, 'candles') : nothing}${havdalah ? line(HAVDALAH, 'צאת שבת', havdalah, 'havdalah') : nothing}</div>`
          : nothing}
        ${extras.length ? html`<div class="tms ge-m" data-home-extras>${extras.slice(0, it.size === 'l' ? extras.length : 2).map((e) => html`<div class="tm"><span>${e.label}</span><b class="txt">${e.value}</b></div>`)}</div>` : nothing}
        ${countdown ? html`<div class="cd only-l">${countdown} להדלקת נרות</div>` : nothing}</div>`);
  }

  private alarm(it: WidgetItem) {
    const a = this.data.alarm!;
    const state = a.available ? a.state ?? '' : 'unavailable';
    const tone = state === 'triggered' ? 'err' : state === 'disarmed' || state === 'unavailable' || state === 'unknown' || state === '' ? 'neutral' : 'ok';
    const since = sinceText(a.since, this.now);
    return this.shell(it, 'wg-alarm', { tone }, html`<span class="aic"><svg viewBox="0 0 24 24" aria-hidden="true">${SHIELD}</svg></span>
      <div class="al-t"><span class="al-l">${it.title}</span><span class="al-s" data-home-alarm-state>${ALARM_HE[state] ?? state}</span>${since ? html`<span class="al-x ge-m">${since}</span>` : nothing}
        ${this.alarmLink && !this.editing && it.size === 'l' ? html`<a class="al-go only-l" href="#/system/security/alarm" data-home-alarm-link>לפרטי האזעקה <svg viewBox="0 0 24 24" aria-hidden="true">${CHEV}</svg></a>` : nothing}</div>`);
  }

  private quickCard(it: WidgetItem) {
    const allowed = this.config.quick.actions.filter((a) => this.quick.allowed[a]);
    const btn = (a: QuickAction) => html`<button type="button" class=${classMap({ qbtn: true, danger: a === 'all_off' })} data-home-quick=${a} ?disabled=${this.editing} @click=${() => this.emit('home-quick', { action: a })}><svg viewBox="0 0 24 24" aria-hidden="true">${a === 'all_off' ? BOLT : BULB}</svg><span class="only-s">${a === 'all_off' ? 'הכל' : 'תאורה'}</span><span class="ge-m">${QUICK_ACTION_LABEL[a]}</span></button>`;
    return this.shell(it, 'wg-quick', {}, html`${this.head(it, BOLT)}<div class="wg-b"><div class="qa">${allowed.map(btn)}</div>
      <div class="q-x only-l" data-home-quick-summary>${ltrNum(this.quick.lightsOn)} מנורות דולקות · ${ltrNum(this.quick.switchesOn)} מתגים פעילים</div></div>`);
  }
}



declare global {
  interface HTMLElementTagNameMap {
    'home-widgets': HomeWidgetsView;
  }
}
