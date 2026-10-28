import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-tabs';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-dialog';
import '../maintenance/cert-row'; // MAINT215B: the nearest inspection / certificate of the elevator (while the maintenance module is on)
import type { RouteState } from '../router';
import { describeError } from '../api/client';
import { listElevators, type Elevator, type ElevatorsResponse } from '../api/elevators';
import { elevatorsAccess, onElevatorsAccess, type ElevatorsAccess } from '../elevators/access';
import { ELEVATORS_SETTINGS_HREF, addAffordances, agoText, barOf, barSummary, chipOf, durationText, historyRows, kpisOf, ledText, ledsOf, type Look } from '../elevators/model';
import { ElevatorHistoryPress } from '../elevators/history-press';
import { doorIcon, elevatorCss, stateBadge } from '../elevators/styles';
import { elt, type EltKey } from '../i18n/elevators';
import { registerScreenEdit } from '../shell/screen-edit';
import { INFRA_TABS, tabStyleOf, visibleTabs } from '../shell/nav';
import { canNav, isApi } from '../api/session';
import { elecCss } from '../electricity/styles';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { leadReserveStyles } from '../styles/lead-reserve';
import { dayMonthTimeText } from '../api/day-format';

const POLL_MS = 15_000;
const DAY_MS = 24 * 3600_000;

/**
 * תשתיות › מעליות (CR-INFRA-ELEVATORS, designed in 2.8.0 from the owner-approved mockup): the KPI row (all / waiting or in operation / in fault /
 * out of service / fire service), then one card per elevator - the door icon in the state colour, the solid state badge, the lights of its
 * linked sensors, the 24-hour state bar and how long ago the state began. Managers get "מעלית חדשה" and an add card (both open the settings
 * section) ONLY in page edit mode, entered from the user menu ("עריכת העמוד"). View only; polled while shown; a stale list shows every elevator as unknown. No direction is shown anywhere (no up / down sensors).
 */
@customElement('infra-elevators')
export class InfraElevators extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private access: ElevatorsAccess = elevatorsAccess();
  @state() private data: ElevatorsResponse | null = null;
  @state() private error = '';
  @state() private historyId: string | null = null;
  /** Page edit mode (owner 2026-10-19): entered from the user menu (shell/screen-edit.ts); only then are the add affordances shown. */
  @state() private editing = false;
  private offScreenEdit?: () => void;
  private historyOpener: HTMLElement | null = null;
  /** 2.9.0: the long press (and its keyboard / menu alternatives) on a card opens that elevator's history, like on the devices screen. */
  readonly press = new ElevatorHistoryPress(this, (id, opener) => this.openHistory(id, opener));
  private timer?: number;
  private stop?: () => void;

  static styles = [elecCss, elevatorCss, leadReserveStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 14px var(--sw-page-pad) 24px;
      max-inline-size: var(--sw-content-max);
      inline-size: 100%;
      box-sizing: border-box;
    }
    .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .top h1 { margin: 0; font-size: var(--sw-fs-3xl); line-height: 1.2; }
    .top .sub { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
    .top .sp { flex: 1; }
    .new {
      display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 8px 16px; text-decoration: none;
      background: var(--sw-accent); color: var(--sw-text-inverse); font-weight: 600; box-shadow: var(--sw-shadow-1);
    }
    button.new { border: 0; font: inherit; cursor: pointer; }
    /* POLISH-CONTROL-297: the focus ring is the product's (the same token as the temperature screen), and every pressable thing answers
       the press (transform only, token durations - zero under reduced motion) */
    .new:focus-visible, .add:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 3px; }
    .new, .add, .hbtn { transition: border-color var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .new:active { transform: scale(0.97); }
    .add:active { transform: scale(0.99); }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    /* POLISH-CONTROL-297 round 2: the number is the hero of the tile - display size, heavy, tight and tabular (dataviz "hero number"),
       the word under it one quiet line; the tile sits on the card elevation with a lit top edge */
    /* R5-MEDIA-ENERGY-297 (HOMEFABLE tiers): the counter is a tone step DOWN from the elevator cards (surface-2, a hairline, no shadow) so
       the cards read as the page's objects; its label gets two lines before an ellipsis */
    /* loop 2 (visible-difference test): surface-2 read as "another white card"; the counter is a surface-3 well with no outline and no shadow,
       its mark a 20 px disc with a ring; a counter that is not zero on fault / fire / out-of-service is a filled status field (impeccable
       detect flagged the first try - a 6 px side border - as the "side-tab accent border" tell; replaced by the field) */
    .kpi {
      display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: var(--sw-r-lg, 22px);
      background: var(--sw-surface-3); border: 1px solid transparent; box-shadow: none; min-inline-size: 0;
    }
    .kpi[data-nz][data-look='fault'], .kpi[data-nz][data-look='fire'], .kpi[data-nz][data-look='off'] { background: color-mix(in srgb, var(--el-c) 18%, var(--sw-surface)); }
    .kpi[data-nz] span.l { color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
    .kpi .dot { inline-size: 20px; block-size: 20px; border-radius: 50%; background: var(--el-c); flex: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--el-c) 22%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.35); }
    .kpi > div { min-inline-size: 0; }
    .kpi b { display: block; font-size: var(--sw-fs-4xl); font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; color: var(--sw-heading, var(--sw-text)); }
    .kpi span.l { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; margin-block-start: 4px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); color: var(--sw-text-2); overflow: hidden; line-height: 1.25; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(330px, 100%), 1fr)); gap: 16px; }
    .ecard {
      -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
      position: relative; display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: var(--sw-r-lg, 26px); overflow: hidden;
      /* R5-MEDIA-ENERGY-297: the elevator card is the hero tier - the ladder's second step and a lit top edge; it sinks on pointer-down */
      background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); min-inline-size: 0;
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .ecard:active { transform: scale(var(--sw-press-scale)); box-shadow: var(--sw-shadow-1); }
    /* round 2 (find-animation-opportunities, occasional screen entry): the cards arrive as a 40 ms cascade - transform and opacity only,
       off the main thread; under reduced motion only the fade remains */
    @media (prefers-reduced-motion: no-preference) {
      .ecard { animation: el-in 360ms var(--sw-ease-out) both; animation-delay: calc(var(--i, 0) * 40ms); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ecard { animation: el-fade 200ms var(--sw-ease) both; }
    }
    @keyframes el-in { from { opacity: 0; transform: translateY(10px) scale(0.985); } }
    @keyframes el-fade { from { opacity: 0; } }
    /* round 2 (taste-skill: no gradients; impeccable detector: no side-tab border): an alerting card is a flat tinted field of its colour,
       the out-of-service card a dashed frame - the state is told by the field, the solid badge and the icon, never by a stripe */
    /* R5-MEDIA-ENERGY-297 (status as a filled field): a solid tinted field with a strong frame, readable across the room in light and dark */
    .ecard[data-look='fire'] { background: color-mix(in srgb, var(--sw-el-fire) 16%, var(--sw-surface)); border-color: color-mix(in srgb, var(--sw-el-fire) 70%, transparent); }
    .ecard[data-look='fault'] { background: color-mix(in srgb, var(--sw-el-fault) 14%, var(--sw-surface)); border-color: color-mix(in srgb, var(--sw-el-fault) 70%, transparent); }
    .ecard[data-look='off'] { border-style: dashed; border-color: color-mix(in srgb, var(--sw-el-off) 70%, transparent); background: color-mix(in srgb, var(--sw-el-off) 8%, var(--sw-surface)); }
    .head { display: flex; align-items: center; gap: 10px; min-inline-size: 0; }
    /* the elevator name is the card's title - 20 px / 800 in the heading ink */
    .head h3 { margin: 0; font-size: var(--sw-fs-2xl); font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; color: var(--sw-heading); flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .head small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-state); font-weight: 400; overflow: hidden; text-overflow: ellipsis; }
    .body { display: flex; gap: 16px; align-items: center; min-inline-size: 0; }
    .meta { flex: 1; display: grid; gap: 8px; min-inline-size: 0; }
    .row2 { display: flex; justify-content: space-between; gap: 8px; color: var(--sw-text-2); font-size: var(--sw-fs-state); font-variant-numeric: tabular-nums; }
    .ext { display: flex; flex-wrap: wrap; gap: 6px; }
    .ecard:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    /* the history button is a real target (32 px, 44 px on touch layouts) with a wash on hover, not a bare glyph that only changes colour */
    .hbtn { border: 0; background: transparent; color: var(--sw-text-2); border-radius: 999px; padding: 0; inline-size: 32px; block-size: 32px; display: inline-grid; place-items: center; cursor: pointer; flex: none; }
    .hbtn:active { transform: scale(0.94); }
    .hbtn:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .hist { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; max-block-size: 60vh; overflow: auto; }
    /* R5-MEDIA-ENERGY-297: history rows are wells inside the dialog (no outlined boxes inside a panel), the state in the heading ink */
    .hist li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--sw-r-md); border: 0; background: var(--sw-surface-2); min-block-size: 44px; }
    .hist .dot { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--el-c); flex: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-c) 18%, transparent); }
    .hist .t { flex: 1; min-inline-size: 0; font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    .hist .w { color: var(--sw-text-2); font-size: var(--sw-fs-state); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .add {
      display: grid; place-items: center; min-block-size: 200px; border-radius: var(--sw-r-lg, 26px); border: 2px dashed var(--sw-border);
      color: var(--sw-text-2); text-decoration: none; text-align: center; padding: 16px;
    }
    .add b { display: block; font-size: calc(var(--sw-fs-3xl) * 1.3); color: var(--sw-accent); line-height: 1; }
    /* the loading state draws the shape of the page (title, the KPI row, three cards) instead of one grey bar - the temperature screen's skeleton */
    .skl { display: flex; flex-direction: column; gap: 14px; block-size: auto; background: none; animation: none; border-radius: 0; }
    .sk {
      border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); box-sizing: border-box;
      background: linear-gradient(90deg, var(--sw-surface-3) 0%, var(--sw-surface) 50%, var(--sw-surface-3) 100%); background-size: 200% 100%; animation: el-shimmer 1.4s var(--sw-ease) infinite;
    }
    .sk-top { display: grid; gap: 8px; padding-block: 4px; }
    .sk-h1 { inline-size: 160px; block-size: 30px; }
    .sk-sub { inline-size: 300px; max-inline-size: 100%; block-size: 14px; border-radius: var(--sw-r-xs); }
    .sk-kpi { block-size: 64px; }
    .sk-card { block-size: 220px; border-radius: var(--sw-r-lg); }
    @keyframes el-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) { .sk { animation: none; } }
    /* hover is only for fine pointers - a touch must not leave a card lit */
    @media (hover: hover) and (pointer: fine) {
      .ecard:hover { box-shadow: var(--sw-shadow-2); }
      .ecard:hover:not([data-look='fire']):not([data-look='fault']):not([data-look='off']) { border-color: var(--sw-border-strong); }
      .kpi:hover { border-color: var(--sw-border-strong); }
      .hbtn:hover { color: var(--sw-accent-text); background: var(--sw-accent-soft); }
      .add:hover { border-color: var(--sw-border-strong); color: var(--sw-text); }
    }
    @media (max-width: 1100px) {
      .hbtn { inline-size: 44px; block-size: 44px; margin-block: -6px; }
    }
    @media (max-width: 600px) {
      /* round 2 loop 1: on a phone the tile's word may take two lines instead of an ellipsis ("ממתינות או פעי...") */
      .kpi span.l { white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; line-height: 1.25; }
      /* the title first, the button under it: the top start corner belongs to the floating search */
      .top { flex-direction: column; align-items: stretch; }
      .top .sp { display: none; }
      .new { align-self: flex-start; }
    }
    @media (max-width: 420px) {
      .body { gap: 12px; }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onElevatorsAccess((a) => {
      this.access = a;
      if (!a.manage) this.editing = false;
    });
    this.offScreenEdit = registerScreenEdit({ id: 'elevators-edit', label: elt('editPage'), icon: 'edit', can: () => this.access.manage && !this.editing, run: () => { this.editing = true; } });
    void this.load();
    this.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void this.load();
    }, POLL_MS);
  }

  disconnectedCallback() {
    window.clearInterval(this.timer);
    this.stop?.();
    this.offScreenEdit?.();
    super.disconnectedCallback();
  }

  private async load() {
    if (!this.access.view) return;
    try {
      this.data = await listElevators(24);
      this.error = '';
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private openHistory(id: string, opener: HTMLElement | null) {
    this.historyOpener = opener;
    this.historyId = id;
  }

  private closeHistory() {
    this.historyId = null;
    const o = this.historyOpener;
    this.historyOpener = null;
    if (o?.isConnected) void this.updateComplete.then(() => o.focus());
  }

  private historyDialog(list: Elevator[], now: number) {
    const e = list.find((x) => x.id === this.historyId);
    if (!e) return nothing;
    const rows = historyRows(e.history, now);
    const t = (iso: string) => dayMonthTimeText(new Date(iso));
    return html`<sw-dialog open heading=${elt('historyTitle', { name: e.name })} subheading=${elt('last24')} data-elevator-history-dialog @close=${() => this.closeHistory()}>
      ${rows.length
        ? html`<ol class="hist" data-history-rows>${rows.map((r) => html`<li data-look=${r.look} data-history-state=${r.state}><span class="dot" aria-hidden="true"></span><span class="t">${r.label}</span><span class="w">${t(r.from)} - ${t(r.to)} · ${durationText(r.minutes)}</span></li>`)}</ol>`
        : html`<p>${elt('noHistory')}</p>`}
    </sw-dialog>`;
  }

  private kpis(list: Elevator[], stale: boolean) {
    const k = kpisOf(list, stale);
    const cell = (look: Look, value: number, key: EltKey, id: string) => html`<div class="kpi" data-look=${look} data-elevators-kpi=${id} ?data-nz=${value > 0}><span class="dot" aria-hidden="true"></span><div><b>${value}</b><span class="l">${elt(key)}</span></div></div>`;
    return html`<div class="kpis" role="group" aria-label=${elt('title')}>
      ${cell('unk', k.total, 'title', 'total')}${cell('wait', k.ok, 'kpiOk', 'ok')}${cell('fault', k.fault, 'kpiFault', 'fault')}${cell('off', k.off, 'kpiOff', 'off')}${cell('fire', k.fire, 'kpiFire', 'fire')}${k.usesTravel ? cell('trav', k.travel, 'kpiTravel', 'travel') : nothing}
    </div>`;
  }

  private card(e: Elevator, stale: boolean, now: number, i = 0) {
    const c = chipOf({ state: e.state, stale: stale || e.stale, roles: e.roles, flags: e.flags });
    const ago = c.state === 'unknown' ? '' : agoText(e.since, new Date(now));
    const bar = barOf(e.history, now - DAY_MS, now);
    const extras = e.extras.filter((x) => x.on !== null);
    return html`<article class="ecard" tabindex="0" style=${`--i:${Math.min(i, 8)}`} data-elevator=${e.id} data-state=${c.state} data-look=${c.look} aria-label=${`${e.name}: ${c.label}`}>
      <div class="head"><h3>${e.name}${e.area_name ? html`<small>${e.area_name}</small>` : nothing}</h3>${stateBadge(c)}<button type="button" class="hbtn" data-elevator-history aria-label=${elt('historyOpen', { name: e.name })} title=${elt('historyOpen', { name: e.name })} @click=${(ev: Event) => this.openHistory(e.id, ev.currentTarget as HTMLElement)}><sw-icon name="clock" size="16"></sw-icon></button></div>
      <div class="body">${doorIcon(c, 74)}
        <div class="meta">
          <div class="leds" role="list" aria-label=${elt('sensorsLit')}>${ledsOf(e, stale || e.stale).map((l) => html`<span class="led" role="listitem" data-look=${l.look} data-on=${String(l.on)} ?data-na=${l.na} data-led=${l.role} aria-label=${ledText(l)} title=${ledText(l)}><i aria-hidden="true"></i>${l.label}</span>`)}</div>
          ${extras.length ? html`<div class="ext">${extras.map((x) => html`<span class="chip ${x.on ? 'c-acc' : 'c-mut'} nodot" data-extra=${x.position}>${x.label}</span>`)}</div>` : nothing}
          ${e.history !== null && e.history !== undefined
            ? html`<div class="tl" data-elevator-bar role="img" aria-label=${barSummary(bar)} title=${barSummary(bar)}>${bar.lead > 0 && bar.parts.length ? html`<span class="lead" style=${`flex:${bar.lead}`}></span>` : nothing}${bar.parts.map((p) => html`<span data-look=${p.look} data-bar-state=${p.state} style=${`flex:${p.pct}`}></span>`)}</div>`
            : nothing}
          <div class="row2"><span>${e.history ? (bar.parts.length ? elt('last24') : elt('noHistory')) : e.partial ? elt('partial') : ''}</span><span data-elevator-ago>${ago}</span></div>
          <maint-cert-row kind="elevator" subjectId=${e.id}></maint-cert-row>
        </div>
      </div>
    </article>`;
  }

  render() {
    const l1 = isApi() && visibleTabs(INFRA_TABS, true, canNav).length < 2 ? html`<sw-tabs .items=${INFRA_TABS.filter((t) => t.id === 'elevators')} active="elevators" .variant=${tabStyleOf('infra')} data-infra-l1></sw-tabs>` : nothing;
    if (!this.access.view) return html`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;
    if (!this.data) {
      return this.error
        ? html`${l1}<sw-state-panel state="error" heading=${elt('loadError')} hint=${this.error} data-state="error"></sw-state-panel>`
        : html`${l1}<div class="skl" data-state="loading" aria-busy="true" aria-label=${elt('title')}>
            <div class="sk-top"><div class="sk sk-h1"></div><div class="sk sk-sub"></div></div>
            <div class="kpis">${[0, 1, 2, 3, 4].map(() => html`<div class="sk sk-kpi"></div>`)}</div>
            <div class="grid">${[0, 1, 2].map(() => html`<div class="sk sk-card"></div>`)}</div>
          </div>`;
    }
    const list = this.data.elevators;
    const manage = this.access.manage;
    const aff = addAffordances(manage, this.editing);
    const stale = this.data.stale;
    const now = Date.now();
    const top = html`<div class="top lead-head"><div><h1>${elt('title')}</h1><p class="sub">${elt('subtitle')}</p></div><span class="sp"></span>
      ${stale ? html`<sw-badge kind="stale" label=${elt('stale')} data-elevators-stale></sw-badge>` : nothing}
      ${aff.newButton ? html`<a class="new" href=${ELEVATORS_SETTINGS_HREF} data-elevators-new><sw-icon name="plus" size="16"></sw-icon>${elt('newElevator')}</a>` : nothing}
      ${aff.doneButton ? html`<button type="button" class="new" data-elevators-edit-done @click=${() => { this.editing = false; }}><sw-icon name="check" size="16"></sw-icon>${elt('editDone')}</button>` : nothing}</div>`;
    if (!list.length) {
      // no elevators: no Infrastructure tab strip (the module is absent until one is defined); the way to add one exists only in page edit mode
      return html`${top}${aff.addCard
        ? html`<div class="grid"><a class="add" href=${ELEVATORS_SETTINGS_HREF} data-elevators-add data-state="empty"><div><b>+</b>${elt('addCard')}</div></a></div>`
        : html`<sw-state-panel icon="elevator" state="empty" heading=${elt('empty')} data-state="empty"></sw-state-panel>`}`;
    }
    return html`${l1}${top}${this.kpis(list, stale)}
      <div class="grid" data-elevators>
        ${list.map((e, i) => this.card(e, stale, now, i))}
        ${aff.addCard ? html`<a class="add" href=${ELEVATORS_SETTINGS_HREF} data-elevators-add><div><b>+</b>${elt('addCard')}</div></a>` : nothing}
      </div>
      ${this.historyDialog(list, now)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'infra-elevators': InfraElevators;
  }
}
