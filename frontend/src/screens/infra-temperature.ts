import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-tabs';
import '../components/sw-icon';
import '../components/sw-state-panel';
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
import { INFRA_TABS, applyInfraTemperature, tabStyleOf, visibleTabs } from '../shell/nav';
import { canNav, isApi } from '../api/session';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { leadReserveStyles } from '../styles/lead-reserve';

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

  static styles = [tempCss, leadReserveStyles, css`
    :host {
      display: flex; flex-direction: column; gap: 14px; padding: 14px var(--sw-page-pad) 24px; max-inline-size: var(--sw-content-max);
      inline-size: 100%; box-sizing: border-box;
    }
    .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .top h1 { margin: 0; font-size: var(--sw-fs-3xl); line-height: 1.2; }
    .top .sub { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
    .top .sp { flex: 1; }
    .top .meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .editbanner { display: inline-flex; align-items: center; gap: 6px; color: var(--sw-accent-text); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); }
    .banner {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--sw-offline-soft);
      color: var(--sw-offline-text); font-size: var(--sw-fs-sm);
    }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
    .kpi {
      display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--sw-r-md); background: var(--sw-surface);
      border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); font: inherit; color: inherit; text-align: start; cursor: pointer;
    }
    /* POLISH136: the KPI is a filter button - it answers hover (fine pointers only), press and keyboard like the cards */
    .kpi { transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .kpi:active { transform: scale(0.98); }
    .kpi[aria-pressed='true'] { border-color: var(--c); box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 35%, transparent); }
    .kpi[aria-pressed='true'] span.l { color: var(--sw-text); }
    .kpi .dot { inline-size: 12px; block-size: 12px; border-radius: 50%; background: var(--c); flex: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 18%, transparent); }
    .kpi b { display: block; font-size: var(--sw-fs-2xl); line-height: 1; font-variant-numeric: tabular-nums; }
    .kpi span.l { font-size: var(--sw-fs-state); color: var(--sw-text-2); }
    .kpi[data-k='total'] { --c: var(--sw-accent); }
    .kpi[data-k='door'] { --c: var(--tc-door); }
    .kpi:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(380px, 100%), 1fr)); gap: 16px; }
    .ucard {
      -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
      position: relative; display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: var(--sw-r-lg); overflow: hidden;
      background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); min-inline-size: 0; cursor: pointer;
      /* POLISH136: a tappable card confirms the press (transform only, token durations - zero under reduced motion) */
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    .ucard:active { transform: scale(0.99); }
    .ucard[data-look='alarm'] { border-color: color-mix(in srgb, var(--tc-alarm) 55%, transparent); background: linear-gradient(160deg, color-mix(in srgb, var(--tc-alarm) 10%, transparent), var(--sw-surface) 55%); }
    .ucard[data-look='warn'] { border-color: color-mix(in srgb, var(--tc-warn) 55%, transparent); }
    .ucard[data-look='off'] { border-style: dashed; }
    .ucard:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .uhead { display: flex; align-items: flex-start; gap: 10px; min-inline-size: 0; }
    .uhead h3 { margin: 0; font-size: var(--sw-fs-xl); flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
    .ghead h2 { margin: 0; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-semibold); }
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
    .top .btn, .hand .btn, .add { transition: border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .top .btn:active, .hand .btn:active { transform: scale(0.97); }
    .add:active { transform: scale(0.99); }
    /* POLISH136: the loading state draws the shape of the page (title, KPI row, three cards) instead of a blank screen; .skl was never
       defined for this screen (the generator and elevators screens share the gap - noted for the round) */
    .skl { display: flex; flex-direction: column; gap: 14px; }
    .sk {
      border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); box-sizing: border-box;
      background: linear-gradient(90deg, var(--sw-surface-3) 0%, var(--sw-surface) 50%, var(--sw-surface-3) 100%); background-size: 200% 100%; animation: tp-shimmer 1.4s var(--sw-ease) infinite;
    }
    .sk-top { display: grid; gap: 8px; padding-block: 4px; }
    .sk-h1 { inline-size: 180px; block-size: 30px; }
    .sk-sub { inline-size: 320px; max-inline-size: 100%; block-size: 14px; border-radius: var(--sw-r-xs); }
    .sk-kpi { block-size: 64px; }
    .sk-card { block-size: 236px; border-radius: var(--sw-r-lg); }
    @keyframes tp-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    /* POLISH136: hover is only for fine pointers - a touch must not leave a card lit */
    @media (hover: hover) and (pointer: fine) {
      .ucard:hover { box-shadow: var(--sw-shadow-2); }
      .ucard:hover:not([data-look='alarm']):not([data-look='warn']) { border-color: var(--sw-border-strong); }
      .kpi:hover { border-color: var(--sw-border-strong); }
      .floors button:hover { border-color: var(--sw-border-strong); color: var(--sw-text); }
      .ghead:hover { background: var(--sw-surface-2); }
      .add:hover { border-color: var(--sw-border-strong); color: var(--sw-text); }
    }
    @media (max-width: 600px) {
      .top { flex-direction: column; align-items: stretch; }
      .top .sp { display: none; }
      .ubody { gap: 10px; }
    }
    @media (max-width: 420px) {
      .ubody { flex-direction: row; }
      .chips { justify-content: flex-start; }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
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
    window.clearInterval(this.timer);
    this.stop?.();
    this.offScreenEdit?.();
    super.disconnectedCallback();
  }

  private isLog(): boolean {
    return this.route?.segments[2] === 'log';
  }

  private async load() {
    if (!this.access.view) return;
    try {
      this.data = await listUnits(true);
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
    const cell = (id: KpiKey, look: string, value: number, key: TtKey) => html`<button type="button" class="kpi" data-k=${id} data-look=${look} data-temp-kpi=${id}
      aria-pressed=${String(this.kpi === id)} @click=${() => { this.kpi = this.kpi === id ? null : id; }}><span class="dot" aria-hidden="true"></span><div><b>${value}</b><span class="l">${tt(key)}</span></div></button>`;
    return html`<div class="kpis" role="group" aria-label=${tt('title')}>
      ${cell('total', '', k.total, 'kpiTotal')}${cell('ok', 'ok', k.ok, 'kpiOk')}${cell('warning', 'warn', k.warning, 'kpiWarn')}${cell('alarm', 'alarm', k.alarm, 'kpiAlarm')}
      ${cell('door', '', k.door, 'kpiDoor')}${cell('offline', 'off', k.offline, 'kpiOff')}${k.health ? cell('health', '', k.health, 'kpiHealth') : nothing}
    </div>`;
  }

  private toggleGroup(key: string) {
    const id = key || '-';
    this.collapsed = this.collapsed.includes(id) ? this.collapsed.filter((x) => x !== id) : [...this.collapsed, id];
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(this.collapsed));
    } catch {
      /* per-browser convenience only */
    }
  }

  /** Idea 7: the cards under collapsible area headers (floor and the worst state in the header), or one flat grid. */
  private cards(shown: TempUnit[], stale: boolean, now: number, lang: string, addCard: unknown) {
    const grouped = this.data?.grouping !== 'none';
    const groups = groupUnits(shown, this.floor);
    if (!grouped || (groups.length < 2 && !this.floor)) {
      return html`<div class="grid" data-temp-grid>${(this.floor ? groups.flatMap((g) => g.units) : shown).map((u) => this.card(u, stale, now, lang))}${addCard}</div>`;
    }
    return html`<div class="groups" data-temp-groups>${groups.map((g) => {
      const open = !this.collapsed.includes(g.key || '-');
      return html`<section class="group" data-temp-group=${g.key || '-'}>
        <button type="button" class="ghead" aria-expanded=${String(open)} data-look=${groupLook(g, stale)} data-temp-group-toggle=${g.key || '-'}
          aria-label=${tt(open ? 'groupCollapse' : 'groupExpand', { name: g.name })} @click=${() => this.toggleGroup(g.key)}>
          <span class="dot" aria-hidden="true"></span><h2>${g.name}</h2><small>${[g.floor, tt('groupCount', { n: g.units.length })].filter(Boolean).join(' · ')}</small>
          <sw-icon class="chev" name="chevronDown" size="16"></sw-icon></button>
        ${open ? html`<div class="grid" data-temp-grid>${g.units.map((u) => this.card(u, stale, now, lang))}</div>` : nothing}</section>`;
    })}${addCard ? html`<div class="grid">${addCard}</div>` : nothing}</div>`;
  }

  private floorBar(list: TempUnit[]) {
    const floors = floorsOf(list);
    if (floors.length < 2 || this.data?.grouping === 'none') return nothing;
    return html`<div class="floors" role="group" aria-label=${tt('floorFilter')} data-temp-floors>
      <button type="button" aria-pressed=${String(this.floor === null)} data-temp-floor="" @click=${() => { this.floor = null; }}>${tt('allFloors')}</button>
      ${floors.map((f) => html`<button type="button" aria-pressed=${String(this.floor === f.id)} data-temp-floor=${f.id} @click=${() => { this.floor = this.floor === f.id ? null : f.id; }}>${f.name}</button>`)}</div>`;
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

  private l1() {
    return isApi() && visibleTabs(INFRA_TABS, true, canNav).length < 2
      ? html`<sw-tabs .items=${INFRA_TABS.filter((t) => t.id === 'temperature')} active="temperature" .variant=${tabStyleOf('infra')} data-infra-l1></sw-tabs>`
      : nothing;
  }

  render() {
    if (!this.access.view) return html`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;
    if (this.isLog()) {
      return html`${this.l1()}<temp-log .units=${this.data?.units ?? []} .unitFilter=${this.route?.params.get('unit') ?? ''} .canSend=${this.access.manage}
        @back=${() => { window.location.hash = TEMPERATURE_HREF; }} @report=${(e: CustomEvent<string[]>) => { this.report = e.detail; }}
        @whatsapp=${(e: CustomEvent<string[]>) => { this.wa = { units: e.detail, range: '24h', lang: 'he' }; }}></temp-log>${this.reportOverlays()}`;
    }
    if (!this.data) {
      return this.error
        ? html`${this.l1()}<sw-state-panel state="error" heading=${tt('loadError')} hint=${this.error} actionLabel=${tt('retry')} @action=${() => void this.load()} data-state="error"></sw-state-panel>`
        : html`${this.l1()}<div class="skl" data-state="loading" role="status" aria-busy="true" aria-label=${tt('loading')}>
            <div class="sk-top lead-head"><div class="sk sk-h1"></div><div class="sk sk-sub"></div></div>
            <div class="kpis" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map(() => html`<div class="sk sk-kpi"></div>`)}</div>
            <div class="grid" aria-hidden="true">${[0, 1, 2].map(() => html`<div class="sk sk-card"></div>`)}</div>
          </div>`;
    }
    const list = this.data.units;
    const aff = addAffordances(this.access.manage, this.editing);
    const stale = this.data.stale;
    const now = Date.now();
    const lang = document.documentElement.lang || 'he-IL';
    const withDoor = list.filter((u) => u.door).length;
    const top = html`<div class="top lead-head"><div><h1>${tt('title')}</h1><p class="sub" data-temp-sub>${stale ? tt('subtitleStale') : tt('subtitle', { n: list.length, d: withDoor })}</p></div><span class="sp"></span>
      <div class="meta">
        ${aff.doneButton ? html`<span class="editbanner"><sw-icon name="edit" size="14"></sw-icon>${tt('editBanner')}</span>` : nothing}
        ${list.length ? html`<a class="btn" href=${`${TEMPERATURE_HREF}/log`} data-temp-log><sw-icon name="list" size="16"></sw-icon>${tt('alertLog')}</a>` : nothing}
        ${aff.newButton ? html`<button type="button" class="btn pri" data-temp-new @click=${() => { this.wizard = ''; }}><sw-icon name="plus" size="16"></sw-icon>${tt('newUnit')}</button>` : nothing}
        ${aff.doneButton ? html`<button type="button" class="btn" data-temp-edit-done @click=${() => { this.editing = false; }}><sw-icon name="check" size="16"></sw-icon>${tt('editDone')}</button>` : nothing}
      </div></div>`;
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
      return html`${this.l1()}${top}
        <div class="empty" data-state="empty"><div class="art"><sw-icon name="thermometer" size="34"></sw-icon></div><h2>${tt('emptyTitle')}</h2><p>${tt('emptyBody')}</p>
          ${aff.addCard ? html`<button type="button" class="btn pri" data-temp-add-first @click=${() => { this.wizard = ''; }}><sw-icon name="plus" size="16"></sw-icon>${tt('addFirst')}</button>`
            : this.access.manage ? html`<span class="hint">${tt('emptyHint')}</span>` : nothing}</div>
        ${overlays}`;
    }
    const shown = list.filter((u) => matchesKpi(u, this.kpi, stale));
    const addCard = aff.addCard ? html`<button type="button" class="add" data-temp-add @click=${() => { this.wizard = ''; }}><div><b>+</b>${tt('addCard')}<br /><small>${tt('addCardSub')}</small></div></button>` : nothing;
    return html`${this.l1()}${top}
      ${stale ? html`<div class="banner" role="status" data-temp-stale><sw-icon name="offline" size="18"></sw-icon><span>${tt('staleBanner')}</span></div>` : nothing}
      ${this.kpis(list, stale)}
      ${this.floorBar(list)}
      ${this.cards(shown, stale, now, lang, addCard)}
      ${overlays}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'infra-temperature': InfraTemperature;
  }
}
