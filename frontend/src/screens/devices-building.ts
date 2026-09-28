import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-kpi';
import '../components/sw-state-panel';
import type { StateKind } from '../components/sw-badge';
import type { IconName } from '../components/sw-icon';
import { canAnywhere, isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import { subscribeHa, type HaSyncState } from '../api/ha';
import { ALARM_HE, getDevicesTree, type DeviceArea, type DeviceCounts, type DeviceFloor, type DeviceTree } from '../api/devices';
import { bidi, ltrNum } from '../i18n/bidi';

/** A refetch is coalesced: a burst of state pushes (a scene, a bulk action from HA) becomes one request. */
const REFRESH_DEBOUNCE_MS = 400;

/** What a tile / floor row shows for each kind that exists there: icon, "on/total", and whether "on" is the warm state. */
export interface CountPill {
  key: keyof DeviceCounts;
  icon: IconName;
  label: string;
  total: number;
  on: number | null;
  warm: boolean;
}

export function pillsOf(c: DeviceCounts): CountPill[] {
  const out: CountPill[] = [];
  if (c.lights) out.push({ key: 'lights', icon: 'light', label: 'תאורה', total: c.lights, on: c.lights_on, warm: c.lights_on > 0 });
  if (c.switches) out.push({ key: 'switches', icon: 'bolt', label: 'מתגים', total: c.switches, on: c.switches_on, warm: c.switches_on > 0 });
  if (c.covers) out.push({ key: 'covers', icon: 'layers', label: 'תריסים פתוחים', total: c.covers, on: c.covers_open, warm: c.covers_open > 0 });
  if (c.climate) out.push({ key: 'climate', icon: 'activity', label: 'מיזוג פעיל', total: c.climate, on: c.climate_active, warm: c.climate_active > 0 });
  if (c.media) out.push({ key: 'media', icon: 'play', label: 'מסכים דולקים', total: c.media, on: c.media_on, warm: c.media_on > 0 });
  if (c.locks) out.push({ key: 'locks', icon: 'lock', label: 'נעולים', total: c.locks, on: c.locks_locked, warm: false });
  if (c.cameras) out.push({ key: 'cameras', icon: 'camera', label: 'מצלמות', total: c.cameras, on: null, warm: false });
  if (c.sensors) out.push({ key: 'sensors', icon: 'sensor', label: 'חיישנים', total: c.sensors, on: null, warm: false });
  return out;
}

export function alarmTone(state: string | null): StateKind {
  if (!state) return 'neutral';
  if (state === 'triggered') return 'error';
  if (state === 'disarmed') return 'neutral';
  if (state === 'unavailable' || state === 'unknown') return 'offline';
  return 'live';
}

const DEMO: DeviceTree = {
  floors: [
    {
      floor_id: 'ground', name: 'קרקע', level: 0, icon: null,
      counts: { entities: 14, lights: 6, lights_on: 3, switches: 2, switches_on: 1, covers: 2, covers_open: 1, climate: 1, climate_active: 1, media: 1, media_on: 0, locks: 1, locks_locked: 1, alarm: 'armed_home', cameras: 1, sensors: 2 },
      areas: [
        { area_id: 'lobby', name: 'לובי', icon: null, floor_id: 'ground', has_camera: true, counts: { entities: 8, lights: 4, lights_on: 3, switches: 1, switches_on: 1, covers: 1, covers_open: 1, climate: 1, climate_active: 1, media: 0, media_on: 0, locks: 1, locks_locked: 1, alarm: 'armed_home', cameras: 1, sensors: 1 } },
        { area_id: 'kitchen', name: 'מטבח', icon: null, floor_id: 'ground', has_camera: false, counts: { entities: 6, lights: 2, lights_on: 0, switches: 1, switches_on: 0, covers: 1, covers_open: 0, climate: 0, climate_active: 0, media: 1, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 1 } },
      ],
    },
    {
      floor_id: 'first', name: 'קומה 1', level: 1, icon: null,
      counts: { entities: 5, lights: 3, lights_on: 0, switches: 0, switches_on: 0, covers: 2, covers_open: 2, climate: 0, climate_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 },
      areas: [{ area_id: 'office', name: 'משרד', icon: null, floor_id: 'first', has_camera: false, counts: { entities: 5, lights: 3, lights_on: 0, switches: 0, switches_on: 0, covers: 2, covers_open: 2, climate: 0, climate_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 } }],
    },
  ],
  unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: { entities: 1, lights: 0, lights_on: 0, switches: 1, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 } },
  building: { entities: 20, lights: 9, lights_on: 3, switches: 3, switches_on: 1, covers: 4, covers_open: 3, climate: 1, climate_active: 1, media: 1, media_on: 0, locks: 1, locks_locked: 1, alarm: 'armed_home', cameras: 1, sensors: 2 },
  scoped: false,
  sync: { connected: false, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 0, entities: 20, started_at: null, ha_version: null },
};

/**
 * חשמל והתקנים › המבנה (CR-007 slice 1, read-only): the building's live counts, then Home Assistant's floors in level
 * order, each with its areas as tiles that open the area screen. Everything here is a projection of the synced HA
 * catalogue; a state push on /ha/ws makes the screen refetch (no local mutation, so the counts always say what the
 * backend last computed). No controls of any kind in this slice - a lit light is a warm tile, nothing more.
 */
@customElement('devices-building')
export class DevicesBuilding extends LitElement {
  @state() private tree: DeviceTree | null = null;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private sync: HaSyncState | null = null;
  private stop: (() => void) | null = null;
  private timer = 0;
  private loading = false;
  private loadAgain = false;

  static styles = css`
    :host {
      display: block;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    .floor {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-block-start: 6px;
    }
    .floor-head {
      display: flex;
      align-items: baseline;
      gap: 10px;
      flex-wrap: wrap;
    }
    .floor-head h2 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
    }
    .level {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .floor-sum {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-inline-start: auto;
    }
    .floor-sum span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-variant-numeric: tabular-nums;
    }
    .floor-sum .warm {
      color: #b45309;
      font-weight: var(--sw-fw-medium);
    }
    .areas {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 10px;
    }
    a.tile {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      min-block-size: 92px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      color: inherit;
      text-decoration: none;
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    a.tile:hover,
    a.tile:focus-visible {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
      outline: none;
    }
    a.tile.on {
      background: linear-gradient(180deg, var(--sw-warning-soft), var(--sw-surface) 70%);
      border-color: #f3d9a4;
    }
    a.tile.empty {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    a.tile.unassigned {
      border-style: dashed;
    }
    .tile-head {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tile-head .name {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tile-head .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-warning);
      flex: none;
    }
    .pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .pills span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-variant-numeric: tabular-nums;
    }
    .pills .warm {
      color: #b45309;
      font-weight: var(--sw-fw-medium);
    }
    .pills .none {
      color: var(--sw-text-3);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .areas {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }
      .floor-sum {
        margin-inline-start: 0;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (!isApi()) {
      this.tree = DEMO;
      this.sync = DEMO.sync;
      return;
    }
    if (!canAnywhere('devices.read')) {
      this.forbidden = true;
      return;
    }
    void this.load();
    this.stop = subscribeHa(
      (m) => {
        if (m.type === 'entity_state_changed') this.scheduleReload();
        else if (m.type === 'ha_sync_state') {
          if (this.sync) this.sync = { ...this.sync, connected: m.connected };
          this.scheduleReload();
        } else if (m.type === 'heartbeat') this.sync = m.sync;
      },
      (connected) => {
        if (connected) this.scheduleReload(); // pushes sent while the socket was down are gone: catch up now
      },
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stop?.();
    this.stop = null;
    window.clearTimeout(this.timer);
  }

  private scheduleReload() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.load(), REFRESH_DEBOUNCE_MS);
  }

  private async load() {
    if (this.loading) {
      this.loadAgain = true;
      return;
    }
    this.loading = true;
    try {
      const t = await getDevicesTree();
      this.tree = t;
      this.sync = t.sync;
      this.error = '';
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.forbidden = true;
      else this.error = describeError(err);
    } finally {
      this.loading = false;
      if (this.loadAgain) {
        this.loadAgain = false;
        void this.load();
      }
    }
  }

  render() {
    const heading = 'חשמל והתקנים';
    if (this.forbidden) {
      return html`<sw-page heading=${heading} subheading="המבנה"><sw-state-panel data-devices-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בחשמל והתקנים" hint="נדרשת ההרשאה צפייה בחשמל והתקנים. פנה למנהל המערכת."></sw-state-panel></sw-page>`;
    }
    const t = this.tree;
    if (!t) {
      return html`<sw-page heading=${heading} subheading="המבנה">${this.error
        ? html`<sw-state-panel data-devices-state="load_error" state="error" heading="לא ניתן לטעון את עץ המבנה" hint=${this.error}></sw-state-panel>`
        : html`<sw-state-panel state="loading"></sw-state-panel>`}</sw-page>`;
    }
    const floors = t.floors.filter((f) => f.floor_id !== 'none').length;
    const areas = t.floors.reduce((n, f) => n + f.areas.length, 0);
    const sub = `${floors} קומות · ${areas} אזורים · ${t.building.entities} התקנים${!isApi() ? ' · נתוני הדגמה' : ''}`;
    const connected = this.sync?.connected ?? false;
    return html`<sw-page heading=${heading} subheading=${sub} wide>
      <div slot="actions">
        ${t.scoped ? html`<sw-badge kind="partial" label="לפי הקומות שלך"></sw-badge>` : nothing}
        ${isApi() ? html`<sw-badge data-devices-sync kind=${connected ? 'live' : 'stale'} label=${connected ? 'מסונכרן עם Home Assistant' : 'לא מסונכרן עם Home Assistant'}></sw-badge>` : nothing}
      </div>
      ${this.error ? html`<sw-state-panel compact state="error" heading="הרענון האחרון נכשל" hint=${this.error}></sw-state-panel>` : nothing}
      ${this.renderKpis(t.building)}
      ${t.floors.length
        ? repeat(t.floors, (f) => f.floor_id, (f) => this.renderFloor(f))
        : html`<sw-state-panel data-devices-state="empty" state="empty" heading=${t.scoped ? 'אין התקנים בקומות שלך' : 'אין קומות ואזורים מ־Home Assistant'} hint=${t.scoped ? 'רק ישויות שהוצבו על המפה של הקומות שבהרשאתך מופיעות כאן.' : 'צרו קומות ואזורים ב־Home Assistant ושייכו אליהם התקנים; העץ יתעדכן מעצמו אחרי סנכרון הרישום.'}></sw-state-panel>`}
      ${t.unassigned.counts.entities || !t.scoped
        ? html`<section class="floor" data-floor="unassigned">
            <div class="floor-head"><h2>ללא שיוך</h2><span class="level">התקנים שאינם משויכים לאזור ב־Home Assistant</span></div>
            <div class="areas">${this.renderTile({ area_id: 'unassigned', name: t.unassigned.name, icon: null, floor_id: null, counts: t.unassigned.counts, has_camera: false }, true)}</div>
          </section>`
        : nothing}
      <div class="note">תצוגה לקריאה בלבד: מצב ההתקנים כפי ש־Home Assistant מדווח אותו. שליטה מגיעה בשלב הבא.</div>
    </sw-page>`;
  }

  private renderKpis(c: DeviceCounts) {
    const kpi = (label: string, on: number, total: number, icon: IconName, warm = true) =>
      html`<sw-kpi data-kpi=${label} data-value=${`${on}/${total}`} label=${label} value=${`${on}/${total}`} .icon=${icon} tone=${total === 0 ? 'unknown' : warm && on > 0 ? 'live' : 'neutral'} detail=${total === 0 ? 'אין במבנה' : ''}></sw-kpi>`;
    return html`<div class="kpis">
      ${kpi('תאורה דולקת', c.lights_on, c.lights, 'light')}
      ${kpi('מתגים פעילים', c.switches_on, c.switches, 'bolt')}
      ${kpi('תריסים פתוחים', c.covers_open, c.covers, 'layers')}
      ${kpi('מיזוג פעיל', c.climate_active, c.climate, 'activity')}
      ${kpi('מסכים דולקים', c.media_on, c.media, 'play')}
      ${c.locks ? html`<sw-kpi data-kpi="נעולים" data-value=${`${c.locks_locked}/${c.locks}`} label="מנעולים נעולים" value=${`${c.locks_locked}/${c.locks}`} icon="lock" tone=${c.locks_locked === c.locks ? 'live' : 'stale'} detail=${c.locks_locked === c.locks ? 'הכול נעול' : 'יש מנעול פתוח'}></sw-kpi>` : nothing}
      ${c.alarm ? html`<sw-kpi data-kpi="אזעקה" label="אזעקה" value=${ALARM_HE[c.alarm] ?? c.alarm} icon="shield" tone=${alarmTone(c.alarm)}></sw-kpi>` : nothing}
    </div>`;
  }

  private renderFloor(f: DeviceFloor) {
    const pills = pillsOf(f.counts);
    return html`<section class="floor" data-floor=${f.floor_id}>
      <div class="floor-head">
        <h2>${bidi(f.name)}</h2>
        ${f.level !== null && f.floor_id !== 'none' ? html`<span class="level">מפלס ${ltrNum(f.level)}</span>` : nothing}
        <span class="level">${f.areas.length} אזורים</span>
        <div class="floor-sum">
          ${pills.map((p) => html`<span class=${classMap({ warm: p.warm })} title=${p.label}><sw-icon .name=${p.icon} size=${13}></sw-icon>${p.on === null ? p.total : `${p.on}/${p.total}`}</span>`)}
          ${f.counts.alarm ? html`<span class=${classMap({ warm: f.counts.alarm !== 'disarmed' })} title="אזעקה"><sw-icon name="shield" size=${13}></sw-icon>${ALARM_HE[f.counts.alarm] ?? f.counts.alarm}</span>` : nothing}
        </div>
      </div>
      <div class="areas">${repeat(f.areas, (a) => a.area_id, (a) => this.renderTile(a))}</div>
    </section>`;
  }

  private renderTile(a: DeviceArea, unassigned = false) {
    const c = a.counts;
    const pills = pillsOf(c);
    const anythingOn = c.lights_on + c.switches_on + c.covers_open + c.climate_active + c.media_on > 0;
    return html`<a
      class=${classMap({ tile: true, on: anythingOn, empty: c.entities === 0, unassigned })}
      href=${`#/devices/areas/${encodeURIComponent(a.area_id)}`}
      data-area=${a.area_id}
      data-on=${String(anythingOn)}
      data-counts=${pills.map((p) => `${p.key}:${p.on === null ? p.total : `${p.on}/${p.total}`}`).join(' ')}
      aria-label=${`${a.name} · ${c.entities} התקנים`}
    >
      <div class="tile-head">
        <sw-icon .name=${unassigned ? 'help' : 'home'} size=${16}></sw-icon>
        <span class="name">${bidi(a.name)}</span>
        ${anythingOn ? html`<span class="dot" title="יש התקן פעיל"></span>` : nothing}
      </div>
      <div class="pills">
        ${pills.length
          ? pills.map((p) => html`<span class=${classMap({ warm: p.warm })} title=${p.label}><sw-icon .name=${p.icon} size=${12}></sw-icon>${p.on === null ? p.total : `${p.on}/${p.total}`}</span>`)
          : html`<span class="none">אין התקנים</span>`}
        ${c.alarm ? html`<span class=${classMap({ warm: c.alarm !== 'disarmed' })} title="אזעקה"><sw-icon name="shield" size=${12}></sw-icon>${ALARM_HE[c.alarm] ?? c.alarm}</span>` : nothing}
      </div>
    </a>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-building': DevicesBuilding;
  }
}
