import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-toggle';
import { describeError } from '../api/client';
import { loadTree } from '../api/catalog';
import { listZones } from '../api/zones';
import {
  PEOPLE_DEFAULTS, PEOPLE_RANGES, PROXIMITIES, placeProblems, putPresenceSettings,
  type PeopleSettings, type PresenceBeacon, type PresenceSettings, type PresenceSite, type PresenceWifiSite, type Proximity,
} from '../api/presence';
import { isApi } from '../api/session';
import { peopleProblems, placesBody, problemsOf } from './system-presence-places-logic';
import { pt, type PtKey } from '../i18n/presence';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

type Kind = 'site' | 'beacon' | 'wifi';
interface FloorOpt { id: string; name: string }
interface ZoneOpt { id: string; name: string }

const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const PROBLEM_KEY: Record<string, PtKey> = { coords: 'pBadCoords', radius: 'pBadRadius', uuid: 'pBadUuid', site: 'pNoSite', zone: 'pZoneNoFloor', ssid: 'pNoSsid', max: 'pMax' };
const PROX_KEY: Record<Proximity, PtKey> = { immediate: 'proxImmediate', near: 'proxNear', far: 'proxFar' };

/**
 * הגדרות › אפליקציה לנייד › מקומות (WHOIN034-295, board r035): the geofences, the beacons and the Wi-Fi sites on ONE screen, three cards
 * side by side (stacked on a phone). A beacon or a Wi-Fi site belongs to a geofence and may be placed on a floor (a beacon also on an
 * area of that floor) - that placement is what lets "מי במבנה" put a person on the floor map. Network names are typed once and kept by
 * the server as salted hashes only (never shown again). One save sends the three lists; the server validates them together.
 */
@customElement('system-presence-places')
export class SystemPresencePlaces extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) settings: PresenceSettings | null = null;
  @property({ type: Boolean }) editable = false;
  @state() private sites: PresenceSite[] = [];
  @state() private beacons: PresenceBeacon[] = [];
  @state() private wifi: PresenceWifiSite[] = [];
  @state() private open: { kind: Kind; id: string } | null = null;
  @state() private floors: FloorOpt[] = [];
  @state() private zones: Record<string, ZoneOpt[]> = {};
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  private source = '';

  static styles = [css`
    :host { display: grid; gap: 12px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 12px; align-items: start; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-block-end: 1px solid var(--sw-border); }
    li:last-child { border-block-end: 0; }
    .lbl { flex: 1; min-inline-size: 0; display: grid; gap: 2px; }
    .lbl b { font-weight: var(--sw-fw-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lbl small { color: var(--sw-text-2); font-size: var(--sw-fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    .bad { color: var(--sw-danger); font-size: var(--sw-fs-xs); }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); padding: 6px 0; }
    form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 10px; padding: 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); margin-block: 6px; }
    form .wide { grid-column: 1 / -1; }
    form .acts { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end; }
    textarea { min-block-size: 64px; resize: vertical; }
    .foot { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger); font-size: var(--sw-fs-sm); }
    @media (max-width: 480px) { form { grid-template-columns: minmax(0, 1fr); } }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    void loadTree()
      .then((t) => {
        this.floors = t.sites.flatMap((s) => (s.buildings ?? []).flatMap((b) => (b.floors ?? []).map((f) => ({ id: f.id, name: t.sites.length > 1 || (s.buildings ?? []).length > 1 ? `${b.name} · ${f.name}` : f.name }))));
      })
      .catch(() => (this.floors = []));
  }

  willUpdate() {
    const s = this.settings;
    const key = s ? JSON.stringify([s.sites, s.beacons, s.wifi_sites]) : '';
    if (key !== this.source) {
      this.source = key;
      this.sites = structuredClone(s?.sites ?? []);
      this.beacons = structuredClone(s?.beacons ?? []);
      this.wifi = structuredClone(s?.wifi_sites ?? []);
      this.open = null;
      for (const b of this.beacons) if (b.floor_id) void this.ensureZones(b.floor_id);
    }
  }

  private get dirty(): boolean {
    return JSON.stringify([this.sites, this.beacons, this.wifi]) !== this.source || this.wifi.some((w) => (w.add_ssids ?? []).some((x) => x.trim()));
  }

  private async ensureZones(floorId: string) {
    if (!floorId || this.zones[floorId] || !isApi()) return;
    try {
      const r = await listZones(floorId);
      this.zones = { ...this.zones, [floorId]: r.zones.map((z) => ({ id: z.id, name: z.name || z.id })) };
    } catch {
      this.zones = { ...this.zones, [floorId]: [] };
    }
  }

  private add(kind: Kind) {
    const site = this.sites[0]?.id ?? '';
    if (kind === 'site') this.sites = [...this.sites, { id: rid('site'), name: '', lat: 32.0853, lon: 34.7818, radius_m: 150 }];
    if (kind === 'beacon') this.beacons = [...this.beacons, { id: rid('bcn'), name: '', uuid: '', major: null, minor: null, site_id: site, floor_id: null, zone_id: null }];
    if (kind === 'wifi') this.wifi = [...this.wifi, { id: rid('wifi'), name: '', site_id: site, floor_id: null, ssid_hash_salt: '', ssid_hashes: [], add_ssids: [] }];
    const list = kind === 'site' ? this.sites : kind === 'beacon' ? this.beacons : this.wifi;
    this.open = { kind, id: list[list.length - 1].id };
    this.message = '';
  }

  private dropItem(kind: Kind, id: string) {
    if (kind === 'site') this.sites = this.sites.filter((x) => x.id !== id);
    if (kind === 'beacon') this.beacons = this.beacons.filter((x) => x.id !== id);
    if (kind === 'wifi') this.wifi = this.wifi.filter((x) => x.id !== id);
    if (this.open?.id === id) this.open = null;
    this.message = '';
  }

  private patchSite(id: string, p: Partial<PresenceSite>) {
    this.sites = this.sites.map((x) => (x.id === id ? { ...x, ...p } : x));
  }

  private patchBeacon(id: string, p: Partial<PresenceBeacon>) {
    this.beacons = this.beacons.map((x) => (x.id === id ? { ...x, ...p } : x));
    if (p.floor_id) void this.ensureZones(p.floor_id);
  }

  private patchWifi(id: string, p: Partial<PresenceWifiSite>) {
    this.wifi = this.wifi.map((x) => (x.id === id ? { ...x, ...p } : x));
  }

  private async save() {
    this.busy = true;
    this.error = '';
    try {
      const r = await putPresenceSettings(placesBody(this.sites, this.beacons, this.wifi));
      this.source = '';
      this.dispatchEvent(new CustomEvent<PresenceSettings>('saved', { detail: r.settings }));
      this.message = pt('saved');
      window.setTimeout(() => (this.message = ''), 2500);
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private siteName = (id: string) => this.sites.find((s) => s.id === id)?.name || id;
  private floorName = (id: string | null) => (id ? this.floors.find((f) => f.id === id)?.name ?? id : '');

  private row(kind: Kind, id: string, title: string, meta: unknown, problems: string[]) {
    const ro = !this.editable || this.busy;
    return html`<li data-presence-place=${`${kind}:${id}`}>
      <span class="lbl"><b>${title || '—'}</b><small>${meta}</small>${problems.length ? html`<span class="bad" data-presence-place-problem>${problems.map((p) => pt(PROBLEM_KEY[p] ?? 'pMax')).join(' · ')}</span>` : nothing}</span>
      ${this.editable
        ? html`<sw-button size="sm" variant="ghost" icon="edit" iconOnly label=${pt('edit')} ?disabled=${ro} data-presence-edit=${id} @click=${() => { this.open = this.open?.id === id ? null : { kind, id }; }}></sw-button>
            <sw-button size="sm" variant="ghost" icon="trash" iconOnly label=${pt('remove')} ?disabled=${ro} data-presence-remove=${id} @click=${() => this.dropItem(kind, id)}></sw-button>`
        : nothing}
    </li>`;
  }

  private siteSelect(value: string, on: (v: string) => void) {
    return html`<sw-field label=${pt('site')}><select .value=${value} data-presence-f="site" @change=${(e: Event) => on((e.target as HTMLSelectElement).value)}>
      ${this.sites.map((s) => html`<option value=${s.id} ?selected=${s.id === value}>${s.name || s.id}</option>`)}</select></sw-field>`;
  }

  private floorSelect(value: string | null, on: (v: string | null) => void) {
    return html`<sw-field label=${pt('floor')}><select data-presence-f="floor" @change=${(e: Event) => on((e.target as HTMLSelectElement).value || null)}>
      <option value="" ?selected=${!value}>${pt('none')}</option>
      ${this.floors.map((f) => html`<option value=${f.id} ?selected=${f.id === value}>${f.name}</option>`)}</select></sw-field>`;
  }

  private done() {
    return html`<div class="acts"><sw-button size="sm" data-presence-done @click=${() => { this.open = null; }}>${pt('done')}</sw-button></div>`;
  }

  private sitesCard(problems: string[]) {
    return html`<sw-card heading=${pt('sitesTitle')} subheading=${pt('sitesSub')} data-presence-sites>
      ${this.editable ? html`<sw-button slot="actions" size="sm" icon="plus" ?disabled=${this.busy || this.sites.length >= 20} data-presence-add="site" @click=${() => this.add('site')}>${pt('add')}</sw-button>` : nothing}
      ${this.sites.length ? html`<ul>${this.sites.map((s) => html`${this.row('site', s.id, s.name, html`<span class="ltr">${Number(s.lat).toFixed(5)}, ${Number(s.lon).toFixed(5)} · ${s.radius_m} m</span>`, problemsOf(problems, 'site', s.id))}
          ${this.open?.kind === 'site' && this.open.id === s.id
            ? html`<form data-presence-form="site" @submit=${(e: Event) => e.preventDefault()}>
                <sw-field class="wide" label=${pt('name')}><input maxlength="80" .value=${s.name} data-presence-f="name" @input=${(e: Event) => this.patchSite(s.id, { name: (e.target as HTMLInputElement).value })} /></sw-field>
                <sw-field label=${pt('lat')}><input type="number" step="0.00001" min="-90" max="90" .value=${String(s.lat)} data-presence-f="lat" @input=${(e: Event) => this.patchSite(s.id, { lat: Number((e.target as HTMLInputElement).value) })} /></sw-field>
                <sw-field label=${pt('lon')}><input type="number" step="0.00001" min="-180" max="180" .value=${String(s.lon)} data-presence-f="lon" @input=${(e: Event) => this.patchSite(s.id, { lon: Number((e.target as HTMLInputElement).value) })} /></sw-field>
                <sw-field label=${pt('radius')} hint=${pt('rangeHint', { lo: 30, hi: 5000 })}><input type="number" min="30" max="5000" step="10" .value=${String(s.radius_m)} data-presence-f="radius" @input=${(e: Event) => this.patchSite(s.id, { radius_m: Number((e.target as HTMLInputElement).value) })} /></sw-field>
                ${this.done()}</form>`
            : nothing}`)}</ul>`
        : html`<div class="muted">${pt('emptySites')}</div>`}
    </sw-card>`;
  }

  private beaconsCard(problems: string[]) {
    const noSite = !this.sites.length;
    return html`<sw-card heading=${pt('beaconsTitle')} subheading=${pt('beaconsSub')} data-presence-beacons>
      ${this.editable ? html`<sw-button slot="actions" size="sm" icon="plus" ?disabled=${this.busy || noSite || this.beacons.length >= 100} data-presence-add="beacon" @click=${() => this.add('beacon')}>${pt('add')}</sw-button>` : nothing}
      ${noSite && this.editable ? html`<div class="muted">${pt('needSite')}</div>` : nothing}
      ${this.beacons.length ? html`<ul>${this.beacons.map((b) => {
        const zones = b.floor_id ? this.zones[b.floor_id] ?? [] : [];
        const zone = zones.find((z) => z.id === b.zone_id)?.name ?? '';
        const meta = [this.siteName(b.site_id), this.floorName(b.floor_id), zone].filter(Boolean).join(' · ');
        return html`${this.row('beacon', b.id, b.name || b.uuid, meta, problemsOf(problems, 'beacon', b.id))}
          ${this.open?.kind === 'beacon' && this.open.id === b.id
            ? html`<form data-presence-form="beacon" @submit=${(e: Event) => e.preventDefault()}>
                <sw-field label=${pt('name')}><input maxlength="80" .value=${b.name} data-presence-f="name" @input=${(e: Event) => this.patchBeacon(b.id, { name: (e.target as HTMLInputElement).value })} /></sw-field>
                ${this.siteSelect(b.site_id, (v) => this.patchBeacon(b.id, { site_id: v }))}
                <sw-field class="wide" label=${pt('uuid')}><input class="ltr" maxlength="36" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" .value=${b.uuid} data-presence-f="uuid" @input=${(e: Event) => this.patchBeacon(b.id, { uuid: (e.target as HTMLInputElement).value })} /></sw-field>
                <sw-field label=${pt('major')}><input type="number" min="0" max="65535" .value=${b.major === null ? '' : String(b.major)} data-presence-f="major" @input=${(e: Event) => { const v = (e.target as HTMLInputElement).value; this.patchBeacon(b.id, { major: v === '' ? null : Number(v) }); }} /></sw-field>
                <sw-field label=${pt('minor')}><input type="number" min="0" max="65535" .value=${b.minor === null ? '' : String(b.minor)} data-presence-f="minor" @input=${(e: Event) => { const v = (e.target as HTMLInputElement).value; this.patchBeacon(b.id, { minor: v === '' ? null : Number(v) }); }} /></sw-field>
                ${this.floorSelect(b.floor_id, (v) => this.patchBeacon(b.id, { floor_id: v, zone_id: null }))}
                <sw-field label=${pt('zone')}><select ?disabled=${!b.floor_id} data-presence-f="zone" @change=${(e: Event) => this.patchBeacon(b.id, { zone_id: (e.target as HTMLSelectElement).value || null })}>
                  <option value="" ?selected=${!b.zone_id}>${pt('none')}</option>${zones.map((z) => html`<option value=${z.id} ?selected=${z.id === b.zone_id}>${z.name}</option>`)}</select></sw-field>
                ${this.done()}</form>`
            : nothing}`;
      })}</ul>`
        : html`<div class="muted">${pt('emptyBeacons')}</div>`}
    </sw-card>`;
  }

  private wifiCard(problems: string[]) {
    const noSite = !this.sites.length;
    return html`<sw-card heading=${pt('wifiTitle')} subheading=${pt('wifiSub')} data-presence-wifi>
      ${this.editable ? html`<sw-button slot="actions" size="sm" icon="plus" ?disabled=${this.busy || noSite || this.wifi.length >= 20} data-presence-add="wifi" @click=${() => this.add('wifi')}>${pt('add')}</sw-button>` : nothing}
      ${noSite && this.editable ? html`<div class="muted">${pt('needSite')}</div>` : nothing}
      ${this.wifi.length ? html`<ul>${this.wifi.map((w) => {
        const pending = (w.add_ssids ?? []).filter((s) => s.trim()).length;
        const meta = [this.siteName(w.site_id), this.floorName(w.floor_id), pt('ssidCount', { n: w.ssid_hashes.length + pending })].filter(Boolean).join(' · ');
        return html`${this.row('wifi', w.id, w.name, meta, problemsOf(problems, 'wifi', w.id))}
          ${this.open?.kind === 'wifi' && this.open.id === w.id
            ? html`<form data-presence-form="wifi" @submit=${(e: Event) => e.preventDefault()}>
                <sw-field class="wide" label=${pt('name')}><input maxlength="80" .value=${w.name} data-presence-f="name" @input=${(e: Event) => this.patchWifi(w.id, { name: (e.target as HTMLInputElement).value })} /></sw-field>
                ${this.siteSelect(w.site_id, (v) => this.patchWifi(w.id, { site_id: v }))}
                ${this.floorSelect(w.floor_id, (v) => this.patchWifi(w.id, { floor_id: v }))}
                <sw-field class="wide" label=${pt('ssids')} hint=${pt('ssidsHint')}><textarea class="ltr" autocomplete="off" spellcheck="false" .value=${(w.add_ssids ?? []).join('\n')} data-presence-f="ssids"
                  @input=${(e: Event) => this.patchWifi(w.id, { add_ssids: (e.target as HTMLTextAreaElement).value.split('\n').map((x) => x.slice(0, 32)) })}></textarea></sw-field>
                <div class="acts">${w.ssid_hashes.length ? html`<sw-button size="sm" variant="ghost" icon="trash" data-presence-clear-ssids @click=${() => this.patchWifi(w.id, { ssid_hashes: [] })}>${pt('clearSsids')}</sw-button>` : nothing}
                  <sw-button size="sm" data-presence-done @click=${() => { this.open = null; }}>${pt('done')}</sw-button></div></form>`
            : nothing}`;
      })}</ul>`
        : html`<div class="muted">${pt('emptyWifi')}</div>`}
    </sw-card>`;
  }

  render() {
    const problems = placeProblems(this.sites, this.beacons, this.wifi);
    return html`<div class="cards">${this.sitesCard(problems)}${this.beaconsCard(problems)}${this.wifiCard(problems)}</div>
      ${this.editable
        ? html`<div class="foot">
            <sw-button variant="primary" size="sm" icon="check" data-presence-places-save ?disabled=${!this.dirty || this.busy || problems.length > 0} @click=${() => void this.save()}>${pt('save')}</sw-button>
            ${this.message ? html`<span class="ok" role="status" data-presence-places-message>${this.message}</span>` : nothing}
            ${this.error ? html`<span class="err" role="alert" data-presence-places-error>${this.error}</span>` : nothing}
          </div>`
        : nothing}`;
  }
}

/**
 * הגדרות › אפליקציה לנייד › מסך מי במבנה (WHOIN034-295): every threshold of the screen - how long a geofence state, a beacon report and a
 * network report stay valid, the nearest beacon proximity that counts, names or counts only, the refresh interval - and how many users
 * asked not to appear (never who).
 */
@customElement('system-presence-screen')
export class SystemPresenceScreen extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) settings: PresenceSettings | null = null;
  @property({ type: Boolean }) editable = false;
  @state() private draft: PeopleSettings = { ...PEOPLE_DEFAULTS };
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  private source = '';

  static styles = [css`
    :host { display: block; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 10px 16px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; grid-column: 1 / -1; border-block-start: 1px solid var(--sw-border); }
    .lbl { display: flex; flex-direction: column; gap: 2px; font-weight: var(--sw-fw-medium); }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-regular); }
    .foot { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-block-start: 10px; }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger); font-size: var(--sw-fs-sm); }
  `, bubbleChrome];

  willUpdate() {
    const p = this.settings?.people ?? PEOPLE_DEFAULTS;
    const key = JSON.stringify(p);
    if (key !== this.source) {
      this.source = key;
      this.draft = { ...p };
    }
  }

  private async save() {
    this.busy = true;
    this.error = '';
    try {
      const r = await putPresenceSettings({ people: this.draft });
      this.dispatchEvent(new CustomEvent<PresenceSettings>('saved', { detail: r.settings }));
      this.message = pt('saved');
      window.setTimeout(() => (this.message = ''), 2500);
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private num(key: keyof typeof PEOPLE_RANGES, label: PtKey) {
    const [lo, hi] = PEOPLE_RANGES[key];
    return html`<sw-field label=${pt(label)} hint=${pt('rangeHint', { lo, hi })}><input type="number" min=${lo} max=${hi} step="1" .value=${String(this.draft[key])} ?disabled=${!this.editable || this.busy}
      data-presence-people=${key} @input=${(e: Event) => { this.draft = { ...this.draft, [key]: Number((e.target as HTMLInputElement).value) }; this.message = ''; }} /></sw-field>`;
  }

  render() {
    const d = this.draft;
    const bad = peopleProblems(d);
    const dirty = JSON.stringify(d) !== this.source;
    const n = this.settings?.people_opt_out_count ?? 0;
    return html`<sw-card heading=${pt('screenTitle')} subheading=${pt('screenSub')} data-presence-screen>
      <div class="grid">
        ${this.num('stale_minutes', 'staleMin')}${this.num('beacon_max_age_minutes', 'beaconAge')}${this.num('wifi_max_age_minutes', 'wifiAge')}
        <sw-field label=${pt('minProximity')}><select ?disabled=${!this.editable || this.busy} data-presence-people="min_proximity"
          @change=${(e: Event) => { this.draft = { ...d, min_proximity: (e.target as HTMLSelectElement).value as Proximity }; }}>
          ${PROXIMITIES.map((p) => html`<option value=${p} ?selected=${p === d.min_proximity}>${pt(PROX_KEY[p])}</option>`)}</select></sw-field>
        ${this.num('refresh_seconds', 'refreshSec')}
        <div class="row"><span class="lbl">${pt('showNames')}<span class="muted">${pt('showNamesHint')}</span></span>
          <sw-toggle ?checked=${d.show_names} ?disabled=${!this.editable || this.busy} label=${pt('showNames')} labelHidden data-presence-people="show_names"
            @change=${(e: CustomEvent<{ checked: boolean }>) => { this.draft = { ...d, show_names: e.detail.checked }; }}></sw-toggle></div>
        ${n ? html`<div class="row muted" data-presence-optout-count>${pt('optOutCount', { n })}</div>` : nothing}
      </div>
      ${this.editable
        ? html`<div class="foot"><sw-button variant="primary" size="sm" icon="check" data-presence-screen-save ?disabled=${!dirty || this.busy || bad.length > 0} @click=${() => void this.save()}>${pt('save')}</sw-button>
            ${this.message ? html`<span class="ok" role="status">${this.message}</span>` : nothing}${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}</div>`
        : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-presence-places': SystemPresencePlaces;
    'system-presence-screen': SystemPresenceScreen;
  }
}
