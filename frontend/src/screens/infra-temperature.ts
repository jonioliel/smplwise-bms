import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-pager';
import '../components/sw-page';
import '../components/sw-button';
import type { RouteState } from '../router';
import { describeError } from '../api/client';
import { listUnits, type ReportParams, type TempUnit, type UnitsResponse } from '../api/temperature';
import { onTemperatureAccess, temperatureAccess, type TemperatureAccess } from '../temperature/access';
import { LOOK_OF, STATUS_ICON, STATUS_KEY, TEMPERATURE_HREF, addAffordances, agoText, chipsOf, durationText, floorsOf, groupLook, groupUnits, kpisOf, matchesKpi, type KpiKey } from '../temperature/model';
import { gauge, spark } from '../temperature/charts';
import { tempCss } from '../temperature/styles';
import '../temperature/detail';
import '../temperature/wizard';
import '../temperature/log';
import '../temperature/report';
import '../temperature/whatsapp';
import { tt, type TtKey } from '../i18n/temperature';
import { registerScreenEdit } from '../shell/screen-edit';
import { applyInfraTemperature } from '../shell/nav';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const POLL_MS = 30_000;
const LONG_PRESS_MS = 480;
/** phase 3 (idea 7): the collapsed area groups, per browser (a convenience only - never shared, never required) */
const COLLAPSED_KEY = 'sw.temperature.collapsed';

function readCollapsed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 200) : [];
  } catch {
    return [];
  }
}

/**
 * תשתיות › טמפרטורות (CR-INFRA-TEMPERATURE 2.9.1, from the owner-approved mockup 2026-10-19): the KPI row (units / OK / warning / alarm /
 * door open now / sensors offline - each a filter), then one card per unit: the gauge (current value, target band, trend), the chips (door,
 * open excursions with "alarm in N min", sensor outage, defrost, mute; for a climate unit its mode / action and setpoint), the 24-hour
 * sparkline with the band, door openings and defrost windows, and the minutes out of range. A tap (or a long press) opens the unit's detail;
 * `#/infra/temperature/log` is the alert log. Managers get "יחידה חדשה" and the add card ONLY in page edit mode, entered from the user menu
 * (shell/screen-edit.ts), like the elevators. Read-only against the infrastructure; polled while shown.
 */
@customElement('infra-temperature')
export class InfraTemperature extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private access: TemperatureAccess = temperatureAccess();
  @state() private data: UnitsResponse | null = null;
  @state() private error = '';
  @state() private editing = false;
  @state() private kpi: KpiKey | null = null;
  @state() private openId: string | null = null;
  /** the wizard: null = closed, '' = a new unit, else the unit id */
  @state() private wizard: string | null = null;
  @state() private toast = '';
  /** phase 2: the PDF report dialog (the preselected units) and the WhatsApp dialog (its params) */
  @state() private report: string[] | null = null;
  @state() private wa: ReportParams | null = null;
  /** phase 3 (idea 7): the floor quick filter and the collapsed area groups */
  @state() private floor: string | null = null;
  @state() private collapsed: string[] = readCollapsed();
  private offScreenEdit?: () => void;
  private stop?: () => void;
  private timer?: number;
  private pressTimer?: number;
  private pressed = false;
  private opener: HTMLElement | null = null;
  /** NOSCROLL-1366-2437: on a desktop (>= 1101 px) the unit cards are pages that fit the screen instead of a page scroll. `per` = cards on a
   * page (0 = not measured yet: every card is drawn, then the fit loop takes whole rows away until nothing overflows). */
  @state() private page = 1;
  @state() private per = 0;
  private desk = window.matchMedia('(min-width: 1101px)');
  private onDesk = () => this.refit();
  private fitObserver?: ResizeObserver;
  private contentObserver?: ResizeObserver;

  /* AUDIT30-E2 (round-30 audit #6, #9): the page is a <sw-page> - the h1 (it was 700 here and 800 everywhere else, because the screen drew
     its own), the subtitle, the padding and the width come from the shared component; the header actions sit in its actions slot */
  static styles = [tempCss, css`
    :host {
      display: flex; flex-direction: column; inline-size: 100%; box-sizing: border-box;
    }
    sw-page { flex: 1 1 auto; min-block-size: 0; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .editbanner { display: inline-flex; align-items: center; gap: 6px; color: var(--sw-accent-text); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); }
    .banner {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--sw-offline-soft);
      color: var(--sw-offline-text); font-size: var(--sw-fs-sm);
    }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    /* POLISH-CONTROL-297 round 2: the number is the hero of the tile (display size, heavy, tight, tabular), the tile on the card elevation */
    /* R5-MEDIA-ENERGY-297 (HOMEFABLE tiers): the counter is a tone step DOWN from the unit cards (surface-2, a hairline, no shadow) so the
       cards read as the page's objects; its label gets two lines before an ellipsis; a chosen counter is a filled status field */
    /* loop 2 (visible-difference test): surface-2 is 3 % from white and read as "another white card"; the counter is now a surface-3 well with
       no outline and no shadow, its mark a 20 px disc with a ring; a counter that is not zero on an alerting status is a filled status field
       (impeccable detect flagged the first try - a 6 px side border - as the "side-tab accent border" tell; replaced by the field) */
    .kpi {
      display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: var(--sw-r-lg); background: var(--sw-surface-3);
      border: 1px solid transparent; box-shadow: none; font: inherit; color: inherit; text-align: start; cursor: pointer; min-inline-size: 0;
      touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
    }
    .kpi > div { min-inline-size: 0; }
    /* POLISH136: the KPI is a filter button - it answers hover (fine pointers only), press and keyboard like the cards */
    .kpi { transition: border-color var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out); }
    .kpi:active { transform: scale(var(--sw-press-scale)); background: var(--sw-surface-3); }
    .kpi[aria-pressed='true'] { border-color: var(--c); background: color-mix(in srgb, var(--c) 20%, var(--sw-surface)); box-shadow: inset 0 0 0 1px var(--c); }
    .kpi[aria-pressed='true'] span.l { color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
    .kpi .dot { inline-size: 20px; block-size: 20px; border-radius: 50%; background: var(--c); flex: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 22%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.35); }
    .kpi b { display: block; font-size: var(--sw-fs-4xl); font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; color: var(--sw-heading, var(--sw-text)); }
    .kpi span.l { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; margin-block-start: 4px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); color: var(--sw-text-2); overflow: hidden; line-height: 1.25; }
    .kpi[data-k='total'] { --c: var(--sw-accent); }
    .kpi[data-nz][data-look='alarm'], .kpi[data-nz][data-look='warn'], .kpi[data-nz][data-look='off'], .kpi[data-nz][data-k='door'] { background: color-mix(in srgb, var(--c) 18%, var(--sw-surface)); }
    .kpi[data-nz][data-look='alarm'] b, .kpi[data-nz][data-look='warn'] b { color: var(--c-text, var(--sw-heading)); }
    .kpi[data-nz] span.l { color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
    .kpi[data-k='door'] { --c: var(--tc-door); }
    .kpi:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(380px, 100%), 1fr)); gap: 16px; }
    .ucard {
      -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
      position: relative; display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: var(--sw-r-lg); overflow: hidden;
      /* R5-MEDIA-ENERGY-297: the unit card is the hero tier - the ladder's second step and a lit top edge */
      background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); min-inline-size: 0; cursor: pointer;
      /* POLISH136: a tappable card confirms the press (transform only, token durations - zero under reduced motion) */
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .ucard:active { transform: scale(var(--sw-press-scale)); box-shadow: var(--sw-shadow-1); }
    /* R5-MEDIA-ENERGY-297 (status as a filled field): an alerting card is a solid tinted field of its colour with a strong frame - readable from
       across the room, in light and in dark - never a 7 % wash */
    .ucard[data-look='alarm'] { border-color: color-mix(in srgb, var(--tc-alarm) 75%, transparent); background: color-mix(in srgb, var(--tc-alarm) 16%, var(--sw-surface)); }
    .ucard[data-look='warn'] { border-color: color-mix(in srgb, var(--tc-warn) 75%, transparent); background: color-mix(in srgb, var(--tc-warn) 14%, var(--sw-surface)); }
    .ucard[data-look='alarm'] .chip, .ucard[data-look='warn'] .chip { background: color-mix(in srgb, var(--sw-surface) 55%, transparent); }
    .ucard[data-look='off'] { border-style: dashed; }
    .ucard:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    /* round 2 (find-animation-opportunities, occasional screen entry): the cards arrive as a 40 ms cascade - transform and opacity only;
       under reduced motion only the fade remains */
    @media (prefers-reduced-motion: no-preference) {
      .ucard { animation: tp-in 360ms var(--sw-ease-out) both; animation-delay: calc(var(--i, 0) * 40ms); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ucard { animation: tp-fade 200ms var(--sw-ease) both; }
    }
    .grid > .ucard:nth-child(2) { --i: 1; } .grid > .ucard:nth-child(3) { --i: 2; } .grid > .ucard:nth-child(4) { --i: 3; }
    .grid > .ucard:nth-child(5) { --i: 4; } .grid > .ucard:nth-child(6) { --i: 5; } .grid > .ucard:nth-child(n + 7) { --i: 6; }
    @keyframes tp-in { from { opacity: 0; transform: translateY(10px) scale(0.985); } }
    @keyframes tp-fade { from { opacity: 0; } }
    .uhead { display: flex; align-items: flex-start; gap: 10px; min-inline-size: 0; }
    /* R5-MEDIA-ENERGY-297: the unit name is the card's title - 20 px / 800 in the heading ink */
    .uhead h3 { margin: 0; font-size: var(--sw-fs-2xl); font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; color: var(--sw-heading); flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .uhead h3 small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-state); font-weight: var(--sw-fw-regular); overflow: hidden; text-overflow: ellipsis; }
    .ubody { display: flex; gap: 14px; align-items: center; min-inline-size: 0; }
    .umeta { flex: 1; display: grid; gap: 6px; min-inline-size: 0; }
    .row2 { display: flex; justify-content: space-between; gap: 8px; color: var(--sw-text-2); font-size: var(--sw-fs-xs); flex-wrap: wrap; }
    .hand { position: absolute; inset-block-start: 10px; inset-inline-end: 10px; }
    .add {
      display: grid; place-items: center; min-block-size: 220px; border-radius: var(--sw-r-lg); border: 2px dashed var(--sw-border); background: transparent;
      color: var(--sw-text-2); text-align: center; padding: 16px; font: inherit; cursor: pointer;
    }
    .add b { display: block; font-size: var(--sw-fs-3xl); color: var(--sw-accent); line-height: 1; }
    .add small { color: var(--sw-text-3); }
    .add:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 3px; }
    .kpi[data-k='health'] { --c: var(--sw-warning); }
    /* phase 3 (idea 7): area groups, like the floors tree of the other screens; a quick floor filter */
    .floors { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .floors button {
      border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text-2); border-radius: var(--sw-r-pill); padding: 4px 12px; font: inherit;
      font-size: var(--sw-fs-sm); cursor: pointer; min-block-size: var(--sw-ctl-h-sm);
      transition: border-color var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    .floors button:active { transform: scale(0.97); }
    .floors button[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); border-color: transparent; font-weight: var(--sw-fw-semibold); }
    .floors button:focus-visible, .ghead:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .groups { display: grid; gap: 18px; }
    .group { display: grid; gap: 10px; }
    .ghead {
      display: flex; align-items: center; gap: 10px; border: 0; background: transparent; padding: 4px 6px; font: inherit; color: inherit; cursor: pointer; text-align: start;
      inline-size: 100%; min-block-size: 32px; border-radius: var(--sw-r-md); transition: background-color var(--sw-t-fast) var(--sw-ease);
    }
    .ghead h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: 800; color: var(--sw-heading); letter-spacing: -0.01em; }
    .ghead small { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .ghead .dot { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--c); flex: none; }
    .ghead .chev { margin-inline-start: auto; color: var(--sw-text-3); transition: transform var(--sw-t-fast) var(--sw-ease-out); }
    .ghead[aria-expanded='false'] .chev { transform: rotate(-90deg); }
    .empty { display: grid; justify-items: center; gap: 10px; text-align: center; padding: 40px 16px; }
    .empty .art { inline-size: 72px; block-size: 72px; border-radius: 50%; display: grid; place-items: center; background: var(--sw-accent-soft); color: var(--sw-accent); }
    .empty h2 { margin: 0; font-size: var(--sw-fs-xl); }
    .empty p { margin: 0; max-inline-size: 520px; color: var(--sw-text-2); }
    .toast {
      position: fixed; inset-block-end: calc(var(--sw-bottomnav-h, 0px) + 20px); inset-inline: 0; margin-inline: auto; inline-size: max-content; max-inline-size: 90vw;
      background: var(--sw-toast-bg); color: var(--sw-toast-text); border-radius: var(--sw-r-pill); padding: 8px 16px; z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-2);
      /* POLISH136: the toast rises in instead of popping (token duration: zero under reduced motion) */
      opacity: 1; transform: translateY(0); transition: opacity var(--sw-t-med) var(--sw-ease), transform var(--sw-t-med) var(--sw-ease);
    }
    @starting-style { .toast { opacity: 0; transform: translateY(8px); } }
    /* POLISH136: the header actions and the add card answer a press like every other control on the page */
    .meta .btn, .hand .btn, .add { transition: border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .meta .btn:active, .hand .btn:active { transform: scale(0.97); }
    .add:active { transform: scale(0.99); }
    /* POLISH136: the loading state draws the shape of the page (title, KPI row, three cards) instead of a blank screen; .skl was never
       defined for this screen (the generator and elevators screens share the gap - noted for the round) */
    .skl { display: flex; flex-direction: column; gap: 14px; }
    .sk {
      border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); box-sizing: border-box;
      background: linear-gradient(90deg, var(--sw-surface-3) 0%, var(--sw-surface) 50%, var(--sw-surface-3) 100%); background-size: 200% 100%; animation: tp-shimmer 1.4s var(--sw-ease) infinite;
    }
    .sk-kpi { block-size: 64px; }
    .sk-card { block-size: 236px; border-radius: var(--sw-r-lg); }
    @keyframes tp-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    /* POLISH136: hover is only for fine pointers - a touch must not leave a card lit */
    @media (hover: hover) and (pointer: fine) {
      .ucard:hover { box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight); }
      .ucard:hover:not([data-look='alarm']):not([data-look='warn']) { border-color: var(--sw-border-strong); }
      .kpi:hover { border-color: var(--sw-border-strong); }
      .floors button:hover { border-color: var(--sw-border-strong); color: var(--sw-text); }
      .ghead:hover { background: var(--sw-surface-2); }
      .add:hover { border-color: var(--sw-border-strong); color: var(--sw-text); }
    }
    /* NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30: 76 px over at 1366x768): from 1101 px (a desktop; the 1024 px tablet keeps the page as it was) the screen keeps
       its box (the shell gives it the room under the tabs) and the unit cards are pages (the pager sits beside "יומן התראות"); a short window
       (<= 820 px high) draws the counters and the cards a step denser, so two rows of cards fit at 1366x768. Tablet and phone unchanged. */
    @media (min-width: 1101px) {
      :host { gap: 12px; }
      .grid { gap: 14px; }
    }
    @media (min-width: 1101px) and (max-height: 820px) {
      :host { padding-block: 10px 16px; }
      .kpi { padding: 8px 14px; gap: 12px; }
      .kpi b { font-size: var(--sw-fs-3xl); }
      .kpi .dot { inline-size: 16px; block-size: 16px; }
      .ucard { padding: 14px 16px; gap: 8px; }
      .ucard .spark { block-size: 44px; }
      .umeta { gap: 4px; }
    }
    @media (max-width: 600px) {
      /* round 2 loop 1: on a phone the tile's word may take two lines instead of an ellipsis */
      .kpi span.l { white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; line-height: 1.25; }
      .ubody { gap: 10px; }
    }
    @media (max-width: 420px) {
      .ubody { flex-direction: row; }
      .chips { justify-content: flex-start; }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.desk.addEventListener('change', this.onDesk);
    if (typeof ResizeObserver !== 'undefined') {
      let w = 0;
      let h = 0;
      this.fitObserver = new ResizeObserver(([e]) => {
        const r = e.contentRect;
        if (Math.abs(r.width - w) < 2 && Math.abs(r.height - h) < 2) return;
        w = r.width;
        h = r.height;
        this.refit();
      });
      this.fitObserver.observe(this);
    }
    this.stop = onTemperatureAccess((a) => {
      this.access = a;
      if (!a.manage) this.editing = false;
    });
    this.offScreenEdit = registerScreenEdit({ id: 'temperature-edit', label: tt('editPage'), icon: 'edit', can: () => this.access.manage && !this.editing && !this.isLog(), run: () => { this.editing = true; } });
    void this.load();
    this.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !this.isLog()) void this.load();
    }, POLL_MS);
  }

  disconnectedCallback() {
    this.desk.removeEventListener('change', this.onDesk);
    this.fitObserver?.disconnect();
    this.contentObserver?.disconnect();
    window.clearInterval(this.timer);
    this.stop?.();
    this.offScreenEdit?.();
    super.disconnectedCallback();
  }

  private isLog(): boolean {
    return this.route?.segments[2] === 'log';
  }

  /** NOSCROLL-1366-2437: measure again from every card drawn (a resize, a filter, new units). */
  private refit() {
    this.per = 0;
  }

  /** The fit loop (desktop only): while the screen is taller than its box, one row of cards fewer per page (never below one row). */
  protected updated() {
    if (!this.desk.matches || this.isLog() || !this.data?.units.length) return;
    // the cards settle after this update (fonts, the gauges): check now, on the next frame, and whenever the cards' box changes size
    this.fitCheck();
    requestAnimationFrame(() => this.fitCheck());
    if (typeof ResizeObserver !== 'undefined') {
      this.contentObserver ??= new ResizeObserver(() => this.fitCheck());
      this.contentObserver.disconnect();
      for (const el of this.renderRoot.querySelectorAll('[data-temp-grid], [data-temp-groups]')) this.contentObserver.observe(el);
    }
  }

  private fitCheck() {
    if (!this.desk.matches || this.isLog() || !this.data?.units.length) return;
    const grid = this.renderRoot.querySelector<HTMLElement>('[data-temp-grid]');
    if (!grid) return;
    const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
    const shownN = this.renderRoot.querySelectorAll('[data-temp-unit]').length;
    // the entry cascade moves the cards 10 px down while it plays: measure when it is over
    const moving = [...this.renderRoot.querySelectorAll<HTMLElement>('.ucard')].flatMap((el) => el.getAnimations()).filter((a) => a.playState === 'running');
    if (moving.length) {
      void Promise.all(moving.map((a) => a.finished.catch(() => undefined))).then(() => this.fitCheck());
      return;
    }
    if (this.scrollHeight - this.clientHeight > 1 && shownN > cols) {
      const per = Math.max(cols, (Math.ceil(shownN / cols) - 1) * cols);
      if (per !== this.per) this.per = per;
    }
  }

  private async load() {
    if (!this.access.view) return;
    try {
      const before = this.data?.units.map((u) => u.id).join() ?? '';
      this.data = await listUnits(true);
      if (this.data.units.map((u) => u.id).join() !== before) this.refit();
      this.error = '';
      applyInfraTemperature(this.data.units.length > 0 || this.access.manage);
      const q = this.route?.params.get('unit');
      if (q && !this.openId && this.data.units.some((u) => u.id === q)) this.openId = q;
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private flash(msg: string) {
    this.toast = msg;
    window.setTimeout(() => {
      if (this.toast === msg) this.toast = '';
    }, 2600);
  }

  private open(id: string, opener: HTMLElement | null) {
    this.opener = opener;
    this.openId = id;
    if (navigator.vibrate && this.pressed) navigator.vibrate(8);
  }

  private closeDetail() {
    this.openId = null;
    const o = this.opener;
    this.opener = null;
    if (o?.isConnected) void this.updateComplete.then(() => o.focus());
  }

  // a tap opens the detail; a long press too (owner: same gesture as the devices screen) - without swallowing a scroll
  private down(e: PointerEvent, id: string) {
    this.pressed = false;
    const el = e.currentTarget as HTMLElement;
    const x = e.clientX;
    const y = e.clientY;
    window.clearTimeout(this.pressTimer);
    this.pressTimer = window.setTimeout(() => {
      this.pressed = true;
      this.open(id, el);
    }, LONG_PRESS_MS);
    const move = (m: PointerEvent) => {
      if (Math.abs(m.clientX - x) > 8 || Math.abs(m.clientY - y) > 8) window.clearTimeout(this.pressTimer);
    };
    el.addEventListener('pointermove', move, { once: false });
    el.addEventListener('pointerup', () => {
      window.clearTimeout(this.pressTimer);
      el.removeEventListener('pointermove', move);
    }, { once: true });
  }

  private tap(e: Event, id: string) {
    if (this.pressed) {
      this.pressed = false;
      return;
    }
    this.open(id, e.currentTarget as HTMLElement);
  }

  private key(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.open(id, e.currentTarget as HTMLElement);
    }
  }

  private kpis(list: TempUnit[], stale: boolean) {
    const k = kpisOf(list, stale);
    const cell = (id: KpiKey, look: string, value: number, key: TtKey) => html`<button type="button" class="kpi" data-k=${id} data-look=${look} data-temp-kpi=${id} ?data-nz=${value > 0}
      aria-pressed=${String(this.kpi === id)} @click=${() => { this.kpi = this.kpi === id ? null : id; this.page = 1; this.refit(); }}><span class="dot" aria-hidden="true"></span><div><b>${value}</b><span class="l">${tt(key)}</span></div></button>`;
    return html`<div class="kpis" role="group" aria-label=${tt('title')}>
      ${cell('total', '', k.total, 'kpiTotal')}${cell('ok', 'ok', k.ok, 'kpiOk')}${cell('warning', 'warn', k.warning, 'kpiWarn')}${cell('alarm', 'alarm', k.alarm, 'kpiAlarm')}
      ${cell('door', '', k.door, 'kpiDoor')}${cell('offline', 'off', k.offline, 'kpiOff')}${k.health ? cell('health', '', k.health, 'kpiHealth') : nothing}
    </div>`;
  }

  private toggleGroup(key: string) {
    const id = key || '-';
    this.collapsed = this.collapsed.includes(id) ? this.collapsed.filter((x) => x !== id) : [...this.collapsed, id];
    this.refit();
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(this.collapsed));
    } catch {
      /* per-browser convenience only */
    }
  }

  /** Idea 7: the cards under collapsible area headers (floor and the worst state in the header), or one flat grid. */
  private isGrouped(shown: TempUnit[]): boolean {
    return this.data?.grouping !== 'none' && (groupUnits(shown, this.floor).length >= 2 || !!this.floor);
  }

  /** The cards in reading order (folded groups give none), the source of the pages. */
  private ordered(shown: TempUnit[]): TempUnit[] {
    if (!this.isGrouped(shown)) return this.floor ? groupUnits(shown, this.floor).flatMap((g) => g.units) : shown;
    return groupUnits(shown, this.floor).filter((g) => !this.collapsed.includes(g.key || '-')).flatMap((g) => g.units);
  }

  private pagesOf(shown: TempUnit[]): number {
    const n = this.ordered(shown).length;
    return this.desk.matches && this.per > 0 ? Math.max(1, Math.ceil(n / this.per)) : 1;
  }

  private pageNo(shown: TempUnit[]): number {
    return Math.min(this.page, this.pagesOf(shown));
  }

  private cards(shown: TempUnit[], stale: boolean, now: number, lang: string, addCard: unknown) {
    const list = this.ordered(shown);
    const pages = this.pagesOf(shown);
    const at = this.pageNo(shown);
    const page = pages > 1 ? list.slice((at - 1) * this.per, at * this.per) : list;
    if (at < pages) addCard = nothing;
    const all = groupUnits(shown, this.floor);
    if (!this.isGrouped(shown)) {
      return html`<div class="grid" data-temp-grid>${page.map((u) => this.card(u, stale, now, lang))}${addCard}</div>`;
    }
    const onPage = new Set(page.map((u) => u.id));
    return html`<div class="groups" data-temp-groups>${all.map((g) => {
      const open = !this.collapsed.includes(g.key || '-');
      const here = g.units.filter((u) => onPage.has(u.id));
      // NOSCROLL-1366-2437: a page shows the groups that have cards on it; a folded group's header stays on the first page
      if (open ? !here.length : this.pageNo(shown) !== 1) return nothing;
      return html`<section class="group" data-temp-group=${g.key || '-'}>
        <button type="button" class="ghead" aria-expanded=${String(open)} data-look=${groupLook(g, stale)} data-temp-group-toggle=${g.key || '-'}
          aria-label=${tt(open ? 'groupCollapse' : 'groupExpand', { name: g.name })} @click=${() => this.toggleGroup(g.key)}>
          <span class="dot" aria-hidden="true"></span><h2>${g.name}</h2><small>${[g.floor, tt('groupCount', { n: g.units.length })].filter(Boolean).join(' · ')}</small>
          <sw-icon class="chev" name="chevronDown" size="16"></sw-icon></button>
        ${open ? html`<div class="grid" data-temp-grid>${here.map((u) => this.card(u, stale, now, lang))}</div>` : nothing}</section>`;
    })}${addCard ? html`<div class="grid">${addCard}</div>` : nothing}</div>`;
  }

  private pager(shown: TempUnit[]) {
    const pages = this.pagesOf(shown);
    return pages > 1 ? html`<sw-pager data-temp-pager .page=${this.pageNo(shown)} .pages=${pages} @page-change=${(e: CustomEvent<{ page: number }>) => { this.page = e.detail.page; }}></sw-pager>` : nothing;
  }

  private floorBar(list: TempUnit[]) {
    const floors = floorsOf(list);
    if (floors.length < 2 || this.data?.grouping === 'none') return nothing;
    return html`<div class="floors" role="group" aria-label=${tt('floorFilter')} data-temp-floors>
      <button type="button" aria-pressed=${String(this.floor === null)} data-temp-floor="" @click=${() => { this.floor = null; this.page = 1; this.refit(); }}>${tt('allFloors')}</button>
      ${floors.map((f) => html`<button type="button" aria-pressed=${String(this.floor === f.id)} data-temp-floor=${f.id} @click=${() => { this.floor = this.floor === f.id ? null : f.id; this.page = 1; this.refit(); }}>${f.name}</button>`)}</div>`;
  }

  private card(u: TempUnit, stale: boolean, now: number, lang: string) {
    const st = stale ? 'unknown' : u.status;
    const look = LOOK_OF[st];
    const chips = chipsOf(u, now, lang);
    const out = u.stats_24h.out_min;
    return html`<article class="ucard" tabindex="0" role="button" data-temp-unit=${u.id} data-status=${st} data-look=${look} ?data-stale=${stale}
        aria-label=${`${u.name}: ${tt(STATUS_KEY[st])}`} @pointerdown=${(e: PointerEvent) => this.down(e, u.id)} @click=${(e: Event) => this.tap(e, u.id)}
        @keydown=${(e: KeyboardEvent) => this.key(e, u.id)} @contextmenu=${(e: Event) => e.preventDefault()}>
      <div class="uhead"><h3>${u.name}${u.area_name ? html`<small>${u.area_name}</small>` : nothing}</h3>
        <span class="badge" data-look=${look}><sw-icon name=${STATUS_ICON[st]} size="14"></sw-icon>${tt(STATUS_KEY[st])}</span></div>
      <div class="ubody">
        ${gauge(u, look, stale || u.status === 'offline' ? null : u.trend === 'flat' && u.status === 'ok' ? null : u.trend)}
        <div class="umeta">
          <div class="chips" data-temp-chips>${chips.map((c) => html`<span class="chip" data-tone=${c.tone} data-chip=${c.id}><sw-icon name=${c.icon} size="12"></sw-icon>${c.text}</span>`)}</div>
          ${spark(u, now)}
          <div class="axis" aria-hidden="true"><span>−24</span><span>−18</span><span>−12</span><span>−6</span><span>${tt('now')}</span></div>
          <div class="row2"><span>${tt('last24')} · ${out ? tt('outOfRange', { d: durationText(out) }) : tt('allInRange')}</span><span>${u.updated_at ? tt('updated', { ago: agoText(u.updated_at, now) }) : ''}</span></div>
        </div>
      </div>
      ${this.editing && this.access.manage
        ? html`<div class="hand"><button type="button" class="btn sm" data-temp-edit=${u.id} aria-label=${`${tt('edit')} ${u.name}`} @pointerdown=${(e: Event) => e.stopPropagation()}
            @click=${(e: Event) => { e.stopPropagation(); this.wizard = u.id; }}><sw-icon name="edit" size="14"></sw-icon></button></div>`
        : nothing}
    </article>`;
  }

  private reportOverlays() {
    const units = this.data?.units ?? [];
    return html`${this.report !== null
      ? html`<temp-report .units=${units} .preselect=${this.report} .canSend=${this.access.manage} .canLink=${this.access.link} @close=${() => { this.report = null; }}
          @done=${(e: CustomEvent<string>) => this.flash(e.detail)} @whatsapp=${(e: CustomEvent<ReportParams>) => { this.report = null; this.wa = e.detail; }}></temp-report>`
      : nothing}
      ${this.wa !== null ? html`<temp-wa .units=${units} .params=${this.wa} @close=${() => { this.wa = null; }}></temp-wa>` : nothing}`;
  }

  render() {
    if (!this.access.view) return html`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;
    if (this.isLog()) {
      return html`<temp-log .units=${this.data?.units ?? []} .unitFilter=${this.route?.params.get('unit') ?? ''} .canSend=${this.access.manage}
        @back=${() => { window.location.hash = TEMPERATURE_HREF; }} @report=${(e: CustomEvent<string[]>) => { this.report = e.detail; }}
        @whatsapp=${(e: CustomEvent<string[]>) => { this.wa = { units: e.detail, range: '24h', lang: 'he' }; }}></temp-log>${this.reportOverlays()}`;
    }
    if (!this.data) {
      return this.error
        ? html`<sw-page heading=${tt('title')} data-infra-page="temperature"><sw-state-panel state="error" heading=${tt('loadError')} hint=${this.error} actionLabel=${tt('retry')} @action=${() => void this.load()} data-state="error"></sw-state-panel></sw-page>`
        : html`<sw-page heading=${tt('title')} data-infra-page="temperature"><div class="skl" data-state="loading" role="status" aria-busy="true" aria-label=${tt('loading')}>
            <div class="kpis" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map(() => html`<div class="sk sk-kpi"></div>`)}</div>
            <div class="grid" aria-hidden="true">${[0, 1, 2].map(() => html`<div class="sk sk-card"></div>`)}</div>
          </div></sw-page>`;
    }
    const list = this.data.units;
    const aff = addAffordances(this.access.manage, this.editing);
    const stale = this.data.stale;
    const now = Date.now();
    const lang = document.documentElement.lang || 'he-IL';
    const withDoor = list.filter((u) => u.door).length;
    const sub = stale ? tt('subtitleStale') : tt('subtitle', { n: list.length, d: withDoor });
    const actions = html`<div class="meta" slot="actions">
        ${aff.doneButton ? html`<span class="editbanner"><sw-icon name="edit" size="14"></sw-icon>${tt('editBanner')}</span>` : nothing}
        ${this.pager(list.filter((u) => matchesKpi(u, this.kpi, stale)))}
        ${list.length ? html`<a class="btn" href=${`${TEMPERATURE_HREF}/log`} data-temp-log><sw-icon name="list" size="16"></sw-icon>${tt('alertLog')}</a>` : nothing}
        ${aff.newButton ? html`<sw-button variant="primary" icon="plus" data-temp-new @click=${() => { this.wizard = ''; }}>${tt('newUnit')}</sw-button>` : nothing}
        ${aff.doneButton ? html`<sw-button icon="check" data-temp-edit-done @click=${() => { this.editing = false; }}>${tt('editDone')}</sw-button>` : nothing}
      </div>`;
    const page = (body: unknown) => html`<sw-page heading=${tt('title')} subheading=${sub} data-infra-page="temperature">${actions}${body}</sw-page>`;
    const overlays = html`
      ${this.openId && list.some((u) => u.id === this.openId)
        ? html`<temp-detail .unit=${list.find((u) => u.id === this.openId)!} .units=${list} .canAck=${this.data.can_ack} .canManage=${this.access.manage} .explain=${this.data.explain !== false} .stale=${stale}
            @close=${() => this.closeDetail()} @open-unit=${(e: CustomEvent<string>) => { this.openId = e.detail; }}
            @edit=${() => { this.wizard = this.openId; }} @report=${(e: CustomEvent<string>) => { this.report = [e.detail]; }} @changed=${(e: CustomEvent<string>) => { this.flash(e.detail); void this.load(); }}></temp-detail>`
        : nothing}
      ${this.wizard !== null
        ? html`<temp-wizard .unitId=${this.wizard || null} @close=${() => { this.wizard = null; }}
            @saved=${(e: CustomEvent<string>) => { this.wizard = null; this.flash(e.detail); void this.load(); }}
            @removed=${(e: CustomEvent<string>) => { this.wizard = null; this.openId = null; this.flash(e.detail); void this.load(); }}></temp-wizard>`
        : nothing}
      ${this.reportOverlays()}
      ${this.toast ? html`<div class="toast" role="status" aria-live="polite">${this.toast}</div>` : nothing}`;
    if (!list.length) {
      return page(html`
        <div class="empty" data-state="empty"><div class="art"><sw-icon name="thermometer" size="34"></sw-icon></div><h2>${tt('emptyTitle')}</h2><p>${tt('emptyBody')}</p>
          ${aff.addCard ? html`<button type="button" class="btn pri" data-temp-add-first @click=${() => { this.wizard = ''; }}><sw-icon name="plus" size="16"></sw-icon>${tt('addFirst')}</button>`
            : this.access.manage ? html`<span class="hint">${tt('emptyHint')}</span>` : nothing}</div>
        ${overlays}`);
    }
    const shown = list.filter((u) => matchesKpi(u, this.kpi, stale));
    const addCard = aff.addCard ? html`<button type="button" class="add" data-temp-add @click=${() => { this.wizard = ''; }}><div><b>+</b>${tt('addCard')}<br /><small>${tt('addCardSub')}</small></div></button>` : nothing;
    return page(html`
      ${stale ? html`<div class="banner" role="status" data-temp-stale><sw-icon name="offline" size="18"></sw-icon><span>${tt('staleBanner')}</span></div>` : nothing}
      ${this.kpis(list, stale)}
      ${this.floorBar(list)}
      ${this.cards(shown, stale, now, lang, addCard)}
      ${overlays}`);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'infra-temperature': InfraTemperature;
  }
}
