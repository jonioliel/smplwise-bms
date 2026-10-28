import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../map/sw-plan-canvas';
import { describeError } from '../api/client';
import { loadMap, type MapBundle } from '../api/maps';
import { filterPeople, getPresencePeople, type PeopleResponse, type PeopleSource, type PersonInside } from '../api/presence';
import { agoLabel, occupancyZones, pickFloor } from './explore-presence-logic';
import { can, canAnywhere, isApi, onSession, session } from '../api/session';
import { pt, type PtKey } from '../i18n/presence';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { leadReserveStyles } from '../styles/lead-reserve';

/** The KPI filters of the list: everyone, the people placed on a floor, the people placed on a site only. */
type Kpi = 'all' | 'floors' | 'site';
const SOURCE_KEY: Record<PeopleSource, PtKey> = { beacon: 'srcBeacon', wifi: 'srcWifi', geofence: 'srcGeofence' };
const SOURCE_ICON: Record<PeopleSource, string> = { beacon: 'signal', wifi: 'wifi', geofence: 'map' };
export const PRESENCE_SETTINGS_HREF = '#/system/diagnostics?tab=mobile';
export const PRESENCE_PLACES_HREF = '#/system/diagnostics?tab=mobile&page=places';

/** The static demo (no backend): two people on the demo ground floor and one on the site. */
const DEMO: PeopleResponse = {
  enabled: true, generated_at: new Date().toISOString(), configured: { sites: 1, beacons: 2, wifi_sites: 1 },
  settings: { show_names: true, refresh_seconds: 30, stale_minutes: 30, beacon_max_age_minutes: 10, wifi_max_age_minutes: 15, min_proximity: 'near' },
  people: [
    { user_id: 'u1', name: 'דנה לוי', source: 'beacon', at: new Date(Date.now() - 60_000).toISOString(), site_id: 'site_main', site_name: 'המשרד', floor_id: 'f0', floor_name: 'קומה 0', zone_id: null, zone_name: '' },
    { user_id: 'u2', name: 'יוסי כהן', source: 'wifi', at: new Date(Date.now() - 240_000).toISOString(), site_id: 'site_main', site_name: 'המשרד', floor_id: 'f0', floor_name: 'קומה 0', zone_id: null, zone_name: '' },
    { user_id: 'u3', name: 'רות אברהם', source: 'geofence', at: new Date(Date.now() - 600_000).toISOString(), site_id: 'site_main', site_name: 'המשרד', floor_id: null, floor_name: '', zone_id: null, zone_name: '' },
  ],
  floors: [{ floor_id: 'f0', name: 'קומה 0', level: 0, building: 'מבנה א', count: 2, zones: [] }, { floor_id: 'f-1', name: 'קומה 1-', level: -1, building: 'מבנה א', count: 0, zones: [] }],
  sites: [{ site_id: 'site_main', name: 'המשרד', count: 1 }],
  totals: { inside: 3, named: 3, hidden: 0, on_floors: 2, site_only: 1 },
};

/**
 * מפה › מי במבנה (WHOIN034-295, board r034): who the phone app currently places inside - the KPI row (inside / on a floor / on the site
 * only / asked not to appear), the floor's plan with its areas labelled by how many people are in each (start side) and the list of names
 * (end side). Fits the viewport: no page scroll, the list scrolls inside its own panel; on a phone the map and the list are two views of
 * one panel. Built to the look of the infrastructure screens (temperature, elevators), real components and tokens only. presence.view
 * (sensitive, system_admin by default); the server filters each person by the viewer's floors, never names an opted-out person, and
 * answers counts only when the administrator switched names off. Read-only; polled every `people.refresh_seconds` while shown.
 */
@customElement('explore-presence')
export class ExplorePresence extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private data: PeopleResponse | null = null;
  @state() private error = '';
  @state() private floor: string | null = null;
  @state() private kpi: Kpi = 'all';
  @state() private query = '';
  @state() private bundle: MapBundle | null = null;
  @state() private mapError = '';
  @state() private phoneView: 'map' | 'list' = 'map';
  @state() private busy = false;
  private timer?: number;
  private bundleFor = '';

  static styles = [leadReserveStyles, css`
    :host {
      display: flex; flex-direction: column; gap: 12px; padding: 14px var(--sw-page-pad) 14px; max-inline-size: var(--sw-content-max);
      inline-size: 100%; box-sizing: border-box; min-block-size: 0; overflow: hidden;
    }
    .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: none; }
    .top h1 { margin: 0; font-size: var(--sw-fs-3xl); line-height: 1.2; }
    .top .sub { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
    .top .sp { flex: 1; }
    .top .meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px; block-size: 34px; padding: 0 12px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border);
      background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); cursor: pointer; text-decoration: none;
    }
    .btn:hover { background: var(--sw-surface-2); }
    .btn:focus-visible, .kpi:focus-visible, .chips button:focus-visible, .seg button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; flex: none; }
    .kpi {
      display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--sw-surface);
      border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); font: inherit; color: inherit; text-align: start; cursor: pointer; --c: var(--sw-accent);
    }
    .kpi[aria-pressed='true'] { border-color: var(--c); box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 35%, transparent); }
    .kpi .dot { inline-size: 12px; block-size: 12px; border-radius: 50%; background: var(--c); flex: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 18%, transparent); }
    .kpi b { display: block; font-size: var(--sw-fs-2xl); line-height: 1; font-variant-numeric: tabular-nums; }
    .kpi span.l { font-size: var(--sw-fs-state); color: var(--sw-text-2); }
    .kpi[data-k='floors'] { --c: var(--sw-live); }
    .kpi[data-k='site'] { --c: var(--sw-warning); }
    .kpi[data-k='hidden'] { --c: var(--sw-text-3); cursor: default; }
    .body { flex: 1; min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr); gap: 14px; }
    .panel {
      min-block-size: 0; display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: var(--sw-r-lg); background: var(--sw-surface);
      border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); overflow: hidden;
    }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; flex: none; }
    .chips button {
      border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text-2); border-radius: var(--sw-r-pill); padding: 4px 12px; font: inherit;
      font-size: var(--sw-fs-sm); cursor: pointer; display: inline-flex; gap: 6px; align-items: center;
    }
    .chips button[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); border-color: transparent; font-weight: var(--sw-fw-semibold); }
    .chips .n { font-variant-numeric: tabular-nums; color: var(--sw-text-3); }
    .chips button[aria-pressed='true'] .n { color: inherit; }
    .stage { position: relative; flex: 1; min-block-size: 0; border-radius: var(--sw-r-md); overflow: hidden; background: var(--sw-map-bg); }
    .stage sw-plan-canvas { block-size: 100%; min-block-size: 0; }
    .stage .note {
      position: absolute; inset-inline-start: 10px; inset-block-end: 10px; padding: 4px 10px; border-radius: var(--sw-r-pill); background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong); font-size: var(--sw-fs-sm); color: var(--sw-text-2); box-shadow: var(--sw-shadow-1);
    }
    .stage .center { position: absolute; inset: 0; display: grid; place-items: center; color: var(--sw-text-2); font-size: var(--sw-fs-sm); text-align: center; padding: 16px; }
    .lhead { display: flex; align-items: baseline; gap: 8px; flex: none; }
    .lhead h2 { margin: 0; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-semibold); }
    .lhead small { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    input[type='search'] {
      flex: none; block-size: 34px; padding: 0 10px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-sm); background: var(--sw-surface-2);
      color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); min-inline-size: 0;
    }
    input[type='search']:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
    ul { list-style: none; margin: 0; padding: 0; overflow: auto; flex: 1; min-block-size: 0; overscroll-behavior: contain; }
    li { display: flex; align-items: center; gap: 10px; padding: 8px 4px; border-block-end: 1px solid var(--sw-border); }
    li:last-child { border-block-end: 0; }
    .av {
      inline-size: 30px; block-size: 30px; border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--sw-accent-soft);
      color: var(--sw-accent-text); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold);
    }
    .who { flex: 1; min-inline-size: 0; display: grid; gap: 1px; }
    .who b { font-weight: var(--sw-fw-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .who small { color: var(--sw-text-2); font-size: var(--sw-fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .src { display: inline-flex; align-items: center; gap: 4px; color: var(--sw-text-3); font-size: var(--sw-fs-xs); flex: none; text-align: end; }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .counts { display: grid; gap: 6px; overflow: auto; flex: 1; min-block-size: 0; }
    .counts div { display: flex; justify-content: space-between; gap: 8px; padding: 6px 4px; border-block-end: 1px solid var(--sw-border); }
    .counts b { font-variant-numeric: tabular-nums; }
    .empty { display: grid; justify-items: center; align-content: center; gap: 10px; text-align: center; padding: 24px 16px; flex: 1; min-block-size: 0; }
    .empty .art { inline-size: 72px; block-size: 72px; border-radius: 50%; display: grid; place-items: center; background: var(--sw-accent-soft); color: var(--sw-accent); }
    .empty h2 { margin: 0; font-size: var(--sw-fs-xl); }
    .empty p { margin: 0; max-inline-size: 520px; color: var(--sw-text-2); }
    .empty a { color: var(--sw-accent-text); }
    .skl { border-radius: var(--sw-r-md); background: var(--sw-surface-2); }
    .seg { display: none; }
    @media (max-width: 900px) {
      .body { grid-template-columns: minmax(0, 1fr); }
      .seg { display: inline-flex; border: 1px solid var(--sw-border); border-radius: var(--sw-r-pill); padding: 2px; background: var(--sw-surface-2); flex: none; align-self: flex-start; }
      .seg button { border: 0; background: transparent; font: inherit; font-size: var(--sw-fs-sm); padding: 4px 14px; border-radius: var(--sw-r-pill); color: var(--sw-text-2); cursor: pointer; }
      .seg button[aria-pressed='true'] { background: var(--sw-surface); color: var(--sw-text); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1); }
      .body[data-view='map'] .listpanel, .body[data-view='list'] .mappanel { display: none; }
    }
    @media (max-width: 600px) {
      :host { padding: 10px 12px; gap: 10px; }
      .top h1 { font-size: var(--sw-fs-2xl); }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .kpi { padding: 8px 10px; }
      .kpi b { font-size: var(--sw-fs-xl); }
    }
    /* R5-MAPS-297 (impeccable bolder, HOMEFABLE pattern): the counters carry display digits (26/700) and the pressed counter is a FILLED
       field in its own colour (not a 2 px ring); the map panel is the hero (large radius, shadow 2), the people rows are wells with a
       600 name; press feedback on pointer-down for the counters, the chips and the keys; hover only with a fine pointer. */
    .top h1 { font-weight: var(--sw-fw-bold); color: var(--sw-heading); letter-spacing: -0.02em; }
    .top .sub { font-weight: var(--sw-fw-medium); }
    .kpi {
      border-radius: var(--sw-r-lg); padding: 12px 16px;
      transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent; touch-action: manipulation; user-select: none;
    }
    .kpi b { font-size: var(--sw-fs-3xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); letter-spacing: -0.02em; }
    .kpi span.l { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); }
    /* loop 2: the unpressed counters are WELLS (surface 2, no edge, no shadow) so the pressed one - a filled field in its colour with a 2 px edge
       and shadow 2 - is the one hero; the dot grows to 14 px */
    .kpi { background: var(--sw-surface-2); border: 2px solid transparent; box-shadow: none; }
    .kpi .dot { inline-size: 14px; block-size: 14px; }
    .kpi[aria-pressed='true'] { background: color-mix(in srgb, var(--c) 16%, var(--sw-surface)); border-color: var(--c); box-shadow: var(--sw-shadow-2); }
    .stage { --sw-map-bg: var(--sw-surface-2); }
    @media (hover: hover) and (pointer: fine) { .kpi:not([aria-pressed='true']):not([data-k='hidden']):hover { background: var(--sw-surface-3); } }
    .kpi:active:not([data-k='hidden']), .chips button:active, .btn:active, .seg button:active { transform: scale(var(--sw-press-scale)); }
    .chips button, .btn, .seg button { transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease); -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    @media (hover: none) { .btn:hover { background: var(--sw-surface); } }
    .panel { border-radius: var(--sw-r-lg); }
    .body > .panel:first-child { box-shadow: var(--sw-shadow-2); }
    .lhead h2 { font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    ul { display: grid; gap: 6px; align-content: start; }
    li { padding: 8px 10px; border-block-end: 0; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); }
    .who b { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    .counts div { padding: 8px 10px; border-block-end: 0; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); }
    .counts b { font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .empty h2 { font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .empty .art { background: var(--sw-surface-2); color: var(--sw-text-2); }
  `, bubbleChrome];

  private stopSession?: () => void;

  connectedCallback() {
    super.connectedCallback();
    // the session may arrive after the screen: load once it says the viewer may see it (and redraw a refusal)
    this.stopSession = onSession(() => {
      this.requestUpdate();
      if (!this.data && !this.busy) void this.load();
    });
  }

  disconnectedCallback() {
    window.clearTimeout(this.timer);
    this.stopSession?.();
    super.disconnectedCallback();
  }

  private schedule() {
    window.clearTimeout(this.timer);
    const s = (this.data?.settings.refresh_seconds ?? 30) * 1000;
    this.timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') void this.load();
      else this.schedule();
    }, s);
  }

  private async load() {
    if (!this.allowed()) return;
    this.busy = true;
    try {
      this.data = isApi() ? await getPresencePeople() : DEMO;
      this.error = '';
      this.floor = pickFloor(this.data.floors, this.floor);
      void this.loadBundle();
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
      if (this.isConnected) this.schedule();
    }
  }

  private async loadBundle() {
    const fid = this.floor;
    if (!fid || fid === this.bundleFor) return;
    this.bundleFor = fid;
    this.bundle = null;
    this.mapError = '';
    try {
      const b = await loadMap(fid);
      if (this.floor === fid) this.bundle = b;
    } catch (e) {
      if (this.floor === fid) this.mapError = describeError(e);
    }
  }

  /** null while the session is still loading (nothing decided yet). */
  private allowed(): boolean | null {
    if (session.mode === 'loading') return null;
    if (session.mode === 'demo') return true; // the static demo (no backend) shows its own sample
    return isApi() && canAnywhere('presence.view');
  }

  private chooseFloor(id: string) {
    this.floor = id;
    void this.loadBundle();
  }

  private kpis(d: PeopleResponse) {
    const t = d.totals;
    const cell = (k: Kpi, value: number, key: PtKey) => html`<button type="button" class="kpi" data-k=${k} data-presence-kpi=${k} aria-pressed=${String(this.kpi === k)}
      @click=${() => { this.kpi = this.kpi === k && k !== 'all' ? 'all' : k; }}><span class="dot" aria-hidden="true"></span><div><b>${value}</b><span class="l">${pt(key)}</span></div></button>`;
    return html`<div class="kpis" role="group" aria-label=${pt('title')}>
      ${cell('all', t.inside, 'kpiInside')}${cell('floors', t.on_floors, 'kpiFloors')}${cell('site', t.site_only, 'kpiSite')}
      ${t.hidden ? html`<div class="kpi" data-k="hidden" data-presence-kpi="hidden" title=${pt('hiddenNote', { n: t.hidden })}><span class="dot" aria-hidden="true"></span><div><b>${t.hidden}</b><span class="l">${pt('kpiHidden')}</span></div></div>` : nothing}
    </div>`;
  }

  private mapPanel(d: PeopleResponse) {
    const f = d.floors.find((x) => x.floor_id === this.floor);
    const zones = occupancyZones(this.bundle, f);
    const placed = f ? f.zones.reduce((s, z) => s + z.count, 0) : 0;
    const hasPlan = !!this.bundle && (this.bundle.planStatus !== 'none' || !!this.bundle.planSvg);
    return html`<section class="panel mappanel" data-presence-map>
      ${d.floors.length
        ? html`<div class="chips" role="group" aria-label=${pt('floorFilter')} data-presence-floors>${d.floors.map((x) => html`<button type="button" aria-pressed=${String(x.floor_id === this.floor)}
            data-presence-floor=${x.floor_id} @click=${() => this.chooseFloor(x.floor_id)}>${x.name}<span class="n">${x.count}</span></button>`)}</div>`
        : nothing}
      <div class="stage">
        ${!d.floors.length
          ? html`<div class="center">${pt('noFloors')}</div>`
          : this.mapError
            ? html`<div class="center">${this.mapError}</div>`
            : !this.bundle
              ? html`<div class="center skl" data-state="loading"></div>`
              : hasPlan
                ? html`<sw-plan-canvas alwaysLabel .planWidth=${this.bundle.width} .planHeight=${this.bundle.height} .plan=${this.bundle.planSvg} .imageUrl=${this.bundle.imageUrl}
                    .markers=${[]} .zones=${zones} dimEntities></sw-plan-canvas>`
                : html`<div class="center">${pt('noPlan')}</div>`}
        ${f ? html`<span class="note" data-presence-floor-note>${pt('onFloor', { n: f.count })}${f.count > placed ? ` · ${pt('unplaced', { n: f.count - placed })}` : ''}</span>` : nothing}
      </div>
    </section>`;
  }

  private shown(d: PeopleResponse): PersonInside[] {
    const byKpi = d.people.filter((p) => this.kpi === 'all' || (this.kpi === 'floors' ? !!p.floor_id : !p.floor_id));
    return filterPeople(byKpi, '', this.query);
  }

  private listPanel(d: PeopleResponse) {
    if (!d.settings.show_names) {
      return html`<section class="panel listpanel" data-presence-list>
        <div class="lhead"><h2>${pt('listTitle')}</h2><small>${pt('countsOnly')}</small></div>
        <div class="counts" data-presence-counts>
          ${d.floors.filter((f) => f.count).map((f) => html`<div><span>${f.name}</span><b>${f.count}</b></div>`)}
          ${d.sites.map((s) => html`<div><span>${s.name} · ${pt('siteOnly')}</span><b>${s.count}</b></div>`)}
        </div>
      </section>`;
    }
    const list = this.shown(d);
    const now = Date.now();
    return html`<section class="panel listpanel" data-presence-list>
      <div class="lhead"><h2>${pt('listTitle')}</h2><small data-presence-count>${pt('listCount', { n: list.length })}</small></div>
      <input type="search" .value=${this.query} placeholder=${pt('search')} aria-label=${pt('search')} data-presence-search
        @input=${(e: Event) => { this.query = (e.target as HTMLInputElement).value; }} />
      ${list.length
        ? html`<ul data-presence-people>${list.map((p) => html`<li data-presence-person=${p.user_id}>
            <span class="av" aria-hidden="true">${p.name.trim().slice(0, 1)}</span>
            <span class="who"><b>${p.name}</b><small>${[p.floor_name || p.site_name || pt('siteOnly'), p.zone_name].filter(Boolean).join(' · ')}</small></span>
            <span class="src" title=${pt(SOURCE_KEY[p.source])}><sw-icon name=${SOURCE_ICON[p.source]} size="12"></sw-icon>${agoLabel(p.at, now)}</span>
          </li>`)}</ul>`
        : html`<div class="muted" data-presence-list-empty>${pt('listEmpty')}</div>`}
      ${d.totals.hidden ? html`<div class="muted" data-presence-hidden-note>${pt('hiddenNote', { n: d.totals.hidden })}</div>` : nothing}
    </section>`;
  }

  render() {
    const ok = this.allowed();
    if (ok === null) return html`<div class="skl" style="block-size:160px" data-state="loading"></div>`;
    if (!ok) return html`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;
    const d = this.data;
    const manage = !isApi() || can('system.configure');
    const top = html`<div class="top lead-head"><div><h1>${pt('title')}</h1>
        <p class="sub" data-presence-sub>${!d ? '' : d.enabled ? pt('subtitle', { n: d.totals.inside, ago: agoLabel(d.generated_at) }) : pt('subtitleOff')}</p></div><span class="sp"></span>
      <div class="meta">
        <button type="button" class="btn" data-presence-refresh ?disabled=${this.busy} @click=${() => void this.load()}><sw-icon name="refresh" size="16"></sw-icon>${pt('refresh')}</button>
        ${manage ? html`<a class="btn" href=${PRESENCE_PLACES_HREF} data-presence-places><sw-icon name="system" size="16"></sw-icon>${pt('places')}</a>` : nothing}
      </div></div>`;
    if (!d) {
      return this.error
        ? html`${top}<sw-state-panel state="error" heading=${pt('loadError')} hint=${this.error} data-state="error"></sw-state-panel>`
        : html`${top}<div class="skl" style="block-size:160px" data-state="loading"></div>`;
    }
    if (!d.enabled) {
      return html`${top}<div class="empty" data-state="off"><div class="art"><sw-icon name="users" size="34"></sw-icon></div><h2>${pt('offTitle')}</h2><p>${pt('offBody')}</p>
        ${manage ? html`<a href=${PRESENCE_SETTINGS_HREF} data-presence-settings>${pt('offLink')}</a>` : nothing}</div>`;
    }
    if (!d.configured.sites && !d.configured.beacons && !d.configured.wifi_sites) {
      return html`${top}<div class="empty" data-state="no-places"><div class="art"><sw-icon name="map" size="34"></sw-icon></div><h2>${pt('noPlacesTitle')}</h2><p>${pt('noPlacesBody')}</p>
        ${manage ? html`<a href=${PRESENCE_PLACES_HREF} data-presence-places-empty>${pt('noPlacesLink')}</a>` : nothing}</div>`;
    }
    return html`${top}${this.kpis(d)}
      <div class="seg" role="group" data-presence-seg>
        <button type="button" aria-pressed=${String(this.phoneView === 'map')} @click=${() => { this.phoneView = 'map'; }}>${pt('mapView')}</button>
        <button type="button" aria-pressed=${String(this.phoneView === 'list')} @click=${() => { this.phoneView = 'list'; }}>${pt('listView')}</button>
      </div>
      <div class="body" data-view=${this.phoneView}>${this.mapPanel(d)}${this.listPanel(d)}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'explore-presence': ExplorePresence;
  }
}
