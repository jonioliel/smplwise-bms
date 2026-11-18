import { LitElement, html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-icon';
import '../components/media-remote';
import { ALARM_HE } from '../api/devices';
import { createClockSubscription } from '../api/clock-ticker';
import {
  calendarText, clockParts, forecastIsDaily, sinceText, untilText, forecastLabel, forecastShown, hasValue, hebrewDate, NO_DATA, QUICK_ACTION_LABEL, SIZE_LABEL, SIZES, valueText, WEATHER_FIELD_LABEL, WEATHER_HE, weatherGlyph,
  type Avail, type HomeConfig, type HomeData, type QuickAction, type WeatherField, type WeatherGlyph, type WidgetId, type WidgetItem,
} from '../api/home-config';
import { ltrNum, bidi } from '../i18n/bidi';
import { canAnywhere, isApi } from '../api/session';
import { isOn, media, type MediaDevice } from '../api/media-screens';
import { isPlaying, players, type PlayerDevice } from '../api/media-players';
import { hwf } from '../i18n/home-widget-failure'; // UXREST2-295: a widget whose own read failed says so, with a retry
import '../components/sw-state-panel';
import { PollController } from '../components/poll-controller'; // CR-HOME-RELOAD-2436: the media poll (visible-only, no overlap)
import { SkinController } from '../design/skin';
import { LookController } from '../design/look';
import '../components/sw-pill';
import { renderAgenda, renderClockTile, renderLauncher, renderWeatherTile, type Bv1Host, type LaunchState } from './home-widgets-bv1';
import { renderElevators } from '../elevators/home-widget'; // CR-INFRA-ELEVATORS 2.8.0
import { renderTemperature } from '../temperature/home-widget'; // CR-INFRA-TEMPERATURE phase 3
import type { TempUnit } from '../api/temperature';
import type { Elevator } from '../api/elevators';
import { renderGenerators } from '../generator/home-widget'; // GENWIDGET 2.9.3
import type { LiveSummaryItem } from '../api/generator';
import { renderDoors } from '../door-windows/home-widget'; // DOORWIN2-295
import type { DoorsWidgetData } from '../door-windows/home-widget-model';
import { renderNotices, type NoticesWidgetData } from '../notices/home-widget'; // NOTICEPAGE-295
import { renderPresence } from './building-presence-widget'; // PRESENCE-2280
import type { BuildingSnapshot } from '../api/building-presence';
import { renderXsMini } from '../xsection/xs-mini-widget'; // XS-MINI-WIDGET-2351
import type { MiniFloor, MiniModel } from '../xsection/xs-mini-model';
import '../door-windows/emergency';
import { homeWidgetsStyles } from './home-widgets-css';

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
/** MULTIBUILDING-HOME-2330 (owner answer 7): the widgets that follow the level (site / building) and carry its tag; clock, weather and
 * Shabbat are the whole site's and carry none. */
const SCOPED_WIDGETS: readonly WidgetId[] = ['alarm', 'elevators', 'quick'];
const DROP = svg`<path d="M12 3c3.5 4.4 6 7.4 6 10.6A6 6 0 0 1 6 13.6C6 10.4 8.5 7.4 12 3Z"/>`;
const WIND = GLYPHS.wind; // the field icon is the weather glyph
const GAUGE = svg`<path d="M4 16a8 8 0 1 1 16 0"/><path d="m12 16 3.5-5"/>`;
const EYE = svg`<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`;
const SUN_HIGH = svg`<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>`;
const EYE_OFF = svg`<path d="M3 3l18 18"/><path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.4 6.9A17 17 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 3.6-.7"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>`;
const CANDLE = svg`<path d="M8 21v-8h3v8M13 21v-6h3v6M6 21h12"/><path d="M9.5 6c1 1 1 2.2 0 3-1-.8-1-2 0-3ZM14.5 8c.8.8.8 1.8 0 2.4-.8-.6-.8-1.6 0-2.4Z"/>`;
const HAVDALAH = GLYPHS.moon; // the end of Shabbat is drawn with the moon glyph
const CAL = svg`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`;
const CLOCK_ICON = svg`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`;
const SHIELD = svg`<path d="M12 3 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>`;
const BOLT = svg`<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>`;
const BULB = svg`<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.6 1.5 2.6h4c0-1 .7-2 1.5-2.6A6 6 0 0 0 12 3z"/>`;
const CHEV = svg`<path d="m15 6-6 6 6 6"/>`;

const FIELD_ICON: Partial<Record<WeatherField, TemplateResult>> = { humidity: DROP, wind: WIND, pressure: GAUGE, visibility: EYE, uv: SUN_HIGH, precipitation: DROP, apparent: DROP };

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
  nomedia: 'אין מסכים או נגנים להצגה',
  nolaunch: 'אין פריט שמותר לך להפעיל',
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
/** CR-HOME-RELOAD-2436: the media widget's poll period (as before: 10 s, while the page is visible). */
const MEDIA_POLL_MS = 10_000;

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
  /** CR-INFRA-ELEVATORS 2.8.0: the elevators the viewer sees (the screen reads and polls them) and whether that read is stale. */
  @property({ attribute: false }) elevators: Elevator[] = [];
  @property({ type: Boolean }) elevatorsStale = false;
  /** CR-INFRA-TEMPERATURE phase 3 (idea 12): the temperature units the viewer sees and whether that read is stale. */
  @property({ attribute: false }) temperatureUnits: TempUnit[] = [];
  @property({ type: Boolean }) temperatureStale = false;
  /** GENWIDGET 2.9.3: the generators the viewer sees (GET /generator/devices/live; the screen reads and polls them). */
  @property({ attribute: false }) generators: LiveSummaryItem[] = [];
  /** DOORWIN2-295: the doors widget's data (the windows and the emergency state, as the door-windows screen reads them; the home screen polls them). */
  @property({ attribute: false }) doors: DoorsWidgetData = { windows: null, emergency: null };
  @state() private doorSheet = false;
  /** NOTICEPAGE-295: the notices active for the viewer (the home screen reads and polls them; null = none to show). */
  @property({ attribute: false }) notices: NoticesWidgetData = { notices: null, emptyMode: 'hide' };
  /** PRESENCE-2280: the building presence answer (the home screen reads and polls it; null = none to show). */
  @property({ attribute: false }) presence: BuildingSnapshot | null = null;
  /** XS-MINI-WIDGET-2351: the mini cross-section's model (the home screen builds it from the catalogue building and the tree; null = not read yet)
   * and which floors open their lights popup. Events: home-xs-floor {id}, home-xs-lights {id}, home-xs-all. */
  @property({ attribute: false }) xsMini: MiniModel | null = null;
  @property({ attribute: false }) xsLightsOk: (f: MiniFloor) => boolean = () => false;
  /** UXREST2-295: the widgets whose own read failed (the screen reads elevators / temperature / generators); each draws a failure panel with a
   * retry (`home-widget-retry {id}`) in its own slot and the other widgets are untouched. */
  @property({ attribute: false }) failed: WidgetId[] = [];
  /** MULTIBUILDING-HOME-2330: on a site of several buildings, the level the scoped widgets speak for ("אתר" / "בניין א"); empty = one building. */
  @property() scopeTag = '';
  @state() private now = new Date();
  @state() private dragId: WidgetId | '' = '';
  /** CR-015: the screens this user may see (null = not loaded / not allowed) and the one whose remote is open. */
  @state() private screens: MediaDevice[] | null = null;
  /** CR-016: the approved speakers, players and receivers this user may see (null / empty = none). */
  @state() private speakers: PlayerDevice[] | null = null;
  /** UXREST2-295: the last media read failed (the previous screens / speakers are kept; the next poll or the retry reads again). */
  @state() private mediaFailed = false;
  @state() private remoteKey = '';
  @state() private remoteKind = '';
  @state() private remoteOpen = false;
  /** CR-HOME-RELOAD-2436 (06:HOME-1 a): the media poll runs only while a media widget is placed, one read at a time (an ask while one
   * runs is folded into one more read right after it). */
  private poll = new PollController(this);
  private mediaBusy = false;
  private mediaAgain = false;
  /** CLOCK-293: the shared wall-clock ticker (api/clock-ticker.ts); a render never touches it, so a live data refresh cannot freeze the clock. */
  private ticker = createClockSubscription((now) => (this.now = now));
  /** Bubble phase C: the skin in force (the quick actions are pills there). */
  private skin = new SkinController(this);
  /** BV1: the surface dial (the surfaceless / glass widgets) - mirrored to `data-surface` on the host. */
  private look = new LookController(this);
  /** BV1: the launcher's in-flight / just-done buttons and its one-line feedback. */
  private launchSt: LaunchState = { busy: new Set(), done: new Set() };
  @state() private launchNote = '';
  /** QUICKHIDE-295: the quick-actions card is switched off in the home settings - the notices card takes the room it left (no hole in the row). */
  @property({ type: Boolean, reflect: true, attribute: 'quick-hidden' }) quickHidden = false;

  static styles = homeWidgetsStyles;

  connectedCallback() {
    super.connectedCallback();
    this.now = new Date();
    this.syncTicker();
    // CR-HOME-RELOAD-2436: the media read starts with a placed media widget (willUpdate -> syncMediaPoll); a reconnect starts it again here
    if (this.hasUpdated) this.syncMediaPoll();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.ticker.stop();
    this.poll.cancel('media'); // the controller pauses on disconnect anyway; dropped so a reconnect registers it afresh
    this.barRo?.disconnect();
  }

  /** POLISH4-WP4 (D2): each card's edit bar reports its height to its card (--wg-e-h), which keeps that much room under its content. */
  private barRo: ResizeObserver | null = null;
  private watchEditBars() {
    if (typeof ResizeObserver === 'undefined') return;
    this.barRo?.disconnect();
    if (!this.editing) return;
    this.barRo ??= new ResizeObserver((entries) => {
      for (const e of entries) {
        const bar = e.target as HTMLElement;
        const h = Math.ceil(e.borderBoxSize?.[0]?.blockSize ?? bar.getBoundingClientRect().height);
        const card = bar.parentElement;
        if (card && h > 0 && card.style.getPropertyValue('--wg-e-h') !== `${h}px`) card.style.setProperty('--wg-e-h', `${h}px`);
      }
    });
    // re-observed after every render: a render may replace a card (or reset its style attribute), and observe() reports at once
    for (const bar of this.renderRoot.querySelectorAll<HTMLElement>('.wg-e')) this.barRo.observe(bar);
  }

  /** The screens and (CR-016) the speakers, players and receivers of the installation that this user may see (media.read; the demo has
   * the mocks). Null when there are none. */
  /** CR-HOME-RELOAD-2436 (06:HOME-1 a): read the media now and every MEDIA_POLL_MS while a media widget is placed (any availability: the
   * remote and the edit ghost need the read); without a media widget there is no media request at all. */
  private syncMediaPoll() {
    if (this.items.some((i) => i.id === 'media')) {
      if (!this.poll.has('media')) {
        void this.loadScreens();
        this.poll.every('media', MEDIA_POLL_MS, () => this.loadScreens());
      }
    } else this.poll.cancel('media');
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('items')) this.syncMediaPoll();
  }

  private async loadScreens(): Promise<void> {
    if (this.mediaBusy) {
      this.mediaAgain = true; // a change or a retry during a read: one more read right after it, never two at once
      return;
    }
    this.mediaBusy = true;
    try {
      await this.readScreens();
    } finally {
      this.mediaBusy = false;
    }
    if (this.mediaAgain) {
      this.mediaAgain = false;
      await this.loadScreens();
    }
  }

  private async readScreens() {
    if (isApi() && !canAnywhere('media.read')) {
      this.screens = null;
      this.speakers = null;
      this.mediaFailed = false;
      return;
    }
    try {
      if (!(await media().status()).enabled) {
        this.screens = null;
        this.speakers = null;
        this.mediaFailed = false;
        return;
      }
      const { devices } = await media().list();
      this.screens = devices.filter((d) => d.kind === 'screen');
      // a failure of the players read never takes the screens away
      this.speakers = await players().list().then((r) => r.devices.filter((d) => ['speaker', 'player', 'receiver'].includes(d.kind))).catch(() => null);
      this.mediaFailed = false;
    } catch {
      this.mediaFailed = true; // the previous screens and speakers stay; the card says the read failed
    }
  }

  /** The widget has something to show: an approved screen, speaker, player or receiver. */
  private get hasMedia(): boolean {
    return !!this.screens?.length || !!this.speakers?.length;
  }

  /** The clock ticks each second only while a card shows seconds, else when the minute changes (cheap and idempotent: a render calls it). */
  private syncTicker() {
    const c = this.config?.clock;
    const secs = !!c && c.on && c.seconds && c.mode !== undefined && this.items.some((i) => i.id === 'clock' && i.avail === 'ok' && i.size !== 's');
    this.ticker.setSeconds(secs);
  }

  protected updated() {
    this.syncTicker();
    this.watchEditBars();
    // BV1: the surface dial on the host (the surfaceless / glass widget rules key on it; the other skins ignore it)
    const surface = this.look.of('surface');
    if (this.getAttribute('data-surface') !== surface) this.setAttribute('data-surface', surface);
  }

  /** BV1: what the tile / agenda / launcher renderers (home-widgets-bv1.ts) need from this element. */
  private get bv1(): Bv1Host {
    return {
      config: this.config, data: this.data, now: this.now, zone: this.zone, editing: this.editing, bubble: this.skin.bubble, quickAllowed: this.quick.allowed,
      shell: (it, cls, extra, body) => this.shell(it, cls, extra, body),
      head: (it, icon, small) => this.head(it, icon, small),
      glyph: (g) => GLYPHS[g],
      emit: (name, detail) => this.emit(name, detail),
      launchNote: this.launchNote,
      setLaunchNote: (v) => (this.launchNote = v),
    };
  }

  render() {
    const items = this.items;
    this.toggleAttribute('hidden', !items.length);
    if (!items.length || !this.config) return nothing;
    return html`<div class="wrap" data-home-widgets role=${this.layout === 'snap' ? 'list' : 'group'} aria-label="ווידג׳טים">${repeat(items, (it) => it.id, (it) => this.item(it))}</div>${this.items.some((i) => i.id === 'media') && this.hasMedia ? html`<media-remote .deviceKey=${this.remoteKey} .kind=${this.remoteKind} .open=${this.remoteOpen} @close=${() => (this.remoteOpen = false)} @media-changed=${() => void this.loadScreens()} @media-remote-open=${() => (this.remoteOpen = true)}></media-remote>` : nothing}`;
  }

  /** A widget card, or its ghost; the media widget (CR-015) asks for itself: without a screen this user may see it is absent
   * from the screen, and a ghost that says so while editing. */
  private item(it: WidgetItem) {
    if (it.id === 'media' && it.avail === 'ok' && !this.hasMedia && !this.mediaFailed) {
      return this.editing ? this.ghost({ ...it, avail: 'nomedia' }) : nothing;
    }
    return it.avail === 'ok' ? this.card(it) : this.ghost(it);
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
    // BV1: `cls` may carry several classes ("wg-weather tile hued"); `extra.style` is the tile's hue
    const classes: Record<string, boolean> = { wg: true, dragging: this.dragId === it.id };
    for (const c of cls.split(' ')) if (c) classes[c] = true;
    return html`<section class=${classMap(classes)} data-home-widget=${it.id} data-size=${it.size} data-w=${it.id} draggable=${d.draggable ?? 'false'} role=${this.layout === 'snap' ? 'listitem' : 'group'} aria-label=${it.title}
      data-cond=${extra.cond ?? nothing} data-tone=${extra.tone ?? nothing} style=${extra.style ?? nothing}
      @dragstart=${d.onDragStart} @dragend=${d.onDragEnd} @dragover=${d.onDragOver} @drop=${d.onDrop}>${body}${this.scopeTag && !this.editing && SCOPED_WIDGETS.includes(it.id) ? html`<span class="wg-scope" data-home-widget-scope>${this.scopeTag}</span>` : nothing}${this.editing ? this.editBar(it) : nothing}</section>`;
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

  /** UXREST2-295: the failure panel of one widget, in the widget's own slot (same state panel as every screen). */
  private failedCard(it: WidgetItem, retry: () => void) {
    return this.shell(it, 'wg-failed', {}, html`<sw-state-panel compact state="error" heading=${it.title} hint=${hwf('failed')} actionLabel=${hwf('retry')} data-home-widget-failed=${it.id} @action=${retry}></sw-state-panel>`);
  }

  private card(it: WidgetItem) {
    if (!this.editing) {
      if (this.failed.includes(it.id)) return this.failedCard(it, () => this.emit('home-widget-retry', { id: it.id }));
      if (it.id === 'media' && this.mediaFailed) return this.failedCard(it, () => void this.loadScreens());
    }
    switch (it.id) {
      case 'clock':
        // BV1: the tile style is the Bubble skin's; every other skin keeps the card
        return this.skin.bubble && this.config.clock.style === 'tile' ? renderClockTile(this.bv1, it, CLOCK_ICON) : this.clock(it);
      case 'weather':
        return this.skin.bubble && this.config.weather.style === 'tile' ? renderWeatherTile(this.bv1, it, (f) => FIELD_ICON[f] ?? DROP) : this.weather(it);
      case 'shabbat':
        return this.shabbat(it);
      case 'alarm':
        return this.alarm(it);
      case 'media':
        return this.mediaCard(it);
      case 'agenda':
        return renderAgenda(this.bv1, it);
      case 'launcher':
        return renderLauncher(this.bv1, it, this.launchSt, new Map(Object.entries(this.data.names ?? {})), () => this.requestUpdate());
      case 'temperature':
        return renderTemperature({ cfg: this.config.temperature, units: this.temperatureUnits, stale: this.temperatureStale, editing: this.editing, shell: (i, cls, extra, body) => this.shell(i, cls, extra, body) }, it);
      case 'elevators':
        return renderElevators({ cfg: this.config.elevators, elevators: this.elevators, stale: this.elevatorsStale, editing: this.editing, now: this.now, shell: (i, cls, extra, body) => this.shell(i, cls, extra, body) }, it);
      case 'generators':
        return renderGenerators({ generators: this.generators, editing: this.editing, shell: (i, cls, extra, body) => this.shell(i, cls, extra, body) }, it);
      case 'doors':
        return html`${renderDoors({ data: this.doors, editing: this.editing, now: this.now, openEmergency: () => (this.doorSheet = true), shell: (i, cls, extra, body) => this.shell(i, cls, extra, body) }, it)}<span style="display:contents"><door-emergency-sheet .open=${this.doorSheet} .data=${this.doors.emergency} @close=${() => (this.doorSheet = false)} @changed=${() => this.emit('home-widget-retry', { id: 'doors' })}></door-emergency-sheet></span>`;
      case 'presence':
        return renderPresence({ snap: this.presence, editing: this.editing, compact: this.layout === 'row', shell: (i, cls, extra, body) => this.shell(i, cls, extra, body) }, it);
      case 'xsection':
        return renderXsMini({ model: this.xsMini, editing: this.editing, multi: !!this.scopeTag, compact: this.layout === 'row', lightsOk: this.xsLightsOk,
          onFloor: (id) => this.emit('home-xs-floor', { id }), onLights: (id) => this.emit('home-xs-lights', { id }), onAll: () => this.emit('home-xs-all', {}),
          shell: (i, cls, extra, body) => this.shell(i, cls, extra, body) }, it);
      case 'notices':
        return renderNotices({ data: this.notices, editing: this.editing, shell: (i, cls, extra, body) => this.shell(i, cls, extra, body) }, it);
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
      ? html`<div class="dts"><div class="d1"><span class="only-s">${p.weekdayShort} · ${p.dateShort}</span><span class="only-m">${p.weekdayLong}, ${p.dateLong}</span><span class="only-l">${p.weekdayLong}, ${p.dateYear}</span></div>${hebrew ? html`<div class="d2 ge-m" data-home-hebrew-date title=${hebrew}>${hebrew}</div>` : nothing}</div>`
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
        <div class="wx-tc">${temp ? html`<span class="wx-t" data-home-temp title=${valueText('temperature', { v: temp.v, unit: temp.unit ?? null })}>${valueText('temperature', { v: temp.v, unit: temp.unit ?? null })}</span>` : nothing}${showCond ? html`<span class="wx-c" data-home-cond>${WEATHER_HE[cond] ?? cond}</span>` : nothing}</div></div>
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

  /** CR-015 §7.5: how many screens are on and - from medium up - those screens as chips; a chip opens the same remote as the
   * screens page. Tapping anything here only opens a remote: nothing is sent, and nothing powers a screen on.
   * CR-016: the players that play right now are counted next to the screens ("מנגנים עכשיו") and, from medium up, listed as chips too;
   * a player's chip opens the player panel through the same drawer. */
  private mediaCard(it: WidgetItem) {
    const all = this.screens ?? [];
    const spk = this.speakers ?? [];
    const on = all.filter((d) => isOn(d.live) || d.live.power === 'art');
    const playing = spk.filter(isPlaying);
    const open = (key: string) => {
      if (this.editing) return;
      this.remoteKey = key;
      this.remoteKind = spk.find((x) => x.key === key)?.kind ?? 'screen';
      this.remoteOpen = true;
    };
    // POLISH2-295: the chips share one row with the counts; a phone's card (one under the other / two / snap) has room for two readable names
    const narrow = this.layout === 'stack' || this.layout === 'two' || this.layout === 'snap';
    const cap = narrow ? 2 : it.size === 'l' ? 6 : 3;
    // the chips are shared: the players that play keep at least one place (up to half of them), the screens fill the rest
    const pMax = Math.min(playing.length, Math.max(1, Math.floor(cap / 2)));
    const sCount = Math.min(on.length, cap - pMax);
    const chips: { key: string; name: string }[] = [...on.slice(0, sCount), ...playing.slice(0, cap - sCount)].map((d) => ({ key: d.key, name: d.name }));
    const rest = on.length + playing.length - chips.length;
    const chip = (d: { key: string; name: string }) => html`<button type="button" class="mchip" data-home-media-chip=${d.key} ?disabled=${this.editing} @click=${() => open(d.key)}><i aria-hidden="true"></i><span>${bidi(d.name)}</span></button>`;
    const first = on[0] ?? playing[0] ?? all[0] ?? spk[0];
    const icon = svg`<rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M8.5 21h7M12 17v4"/><path d="m10.2 8.3 4.3 2.2-4.3 2.2z"/>`;
    const counts = (size: string) => html`${all.length ? html`<div class="mt" style=${size}><b data-home-media-count>${ltrNum(on.length)}</b><span>${on.length === 1 ? 'מסך פועל' : 'מסכים פועלים'}</span></div>` : nothing}
      ${spk.length ? html`<div class="mt" style=${size}><b data-home-media-playing>${ltrNum(playing.length)}</b><span>${playing.length === 1 ? 'מנגן עכשיו' : 'מנגנים עכשיו'}</span></div>` : nothing}`;
    const total = [all.length ? `${ltrNum(all.length)} מסכים` : '', spk.length ? `${ltrNum(spk.length)} נגנים` : ''].filter(Boolean).join(' · ');
    if (it.size === 's') {
      return this.shell(it, 'wg-media', {}, html`<span class="mic"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg></span>
        <div class="mts">${counts('')}</div>
        ${first ? html`<button type="button" class="mchip" style="margin-inline-start:auto" data-home-media-chip=${first.key} aria-label=${`שלט: ${first.name}`} ?disabled=${this.editing} @click=${() => open(first.key)}>${all.length ? 'שלט' : 'נגן'}</button>` : nothing}`);
    }
    // POLISH2-295 (owner feedback 2026-10-25): the card was too tall - the counts read inline ("5 מסכים פועלים") and the chips share their
    // one row (nowrap, a long name shrinks to an ellipsis, the rest is "+N"); no chips row at all when nothing is on
    return this.shell(it, 'wg-media', {}, html`${this.head(it, icon, total)}
      <div class="wg-b mrow" data-home-media-row><div class="mts">${counts('')}</div>
        ${chips.length ? html`<div class="mchips" data-home-media-chips>${chips.map(chip)}${rest > 0 ? html`<span class="mchip more">${ltrNum(`+${rest}`)}</span>` : nothing}</div>` : nothing}</div>`);
  }

  private quickCard(it: WidgetItem) {
    const allowed = this.config.quick.actions.filter((a) => this.quick.allowed[a]);
    if (this.skin.bubble) {
      // the bubble skin: each quick action is a pill row (the lit one for the lights, the accent one for everything), its round
      // sub-button sends the same `home-quick` the button did - the bulk dialog of the screen confirms, nothing is sent from here
      const pill = (a: QuickAction) => {
        const lights = a !== 'all_off';
        const n = lights ? this.quick.lightsOn : this.quick.lightsOn + this.quick.switchesOn;
        return html`<sw-pill variant="plain" ring-static .icon=${lights ? 'light' : 'bolt'} .label=${QUICK_ACTION_LABEL[a]} .state=${lights ? `${ltrNum(this.quick.lightsOn)} דולקות בבית` : `${ltrNum(n)} פעילים בבית`} ?on=${lights && n > 0} ?accent=${!lights} fill-color="var(--sw-lit)" data-home-quick-pill=${a} tabindex="-1">
          <button slot="subs" type="button" class="qsb" data-home-quick=${a} aria-label=${QUICK_ACTION_LABEL[a]} ?disabled=${this.editing} @click=${() => this.emit('home-quick', { action: a })}><sw-icon name="power" size=${18}></sw-icon></button>
        </sw-pill>`;
      };
      return this.shell(it, 'wg-quick', {}, html`${this.head(it, BOLT)}<div class="wg-b"><div class="qa">${allowed.map(pill)}</div>
        <div class="q-x only-l" data-home-quick-summary>${ltrNum(this.quick.lightsOn)} מנורות דולקות · ${ltrNum(this.quick.switchesOn)} מתגים פעילים</div></div>`);
    }
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
