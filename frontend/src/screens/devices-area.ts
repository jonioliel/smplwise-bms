import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-chip';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-dialog';
import type { StateKind } from '../components/sw-badge';
import type { IconName } from '../components/sw-icon';
import { canAnywhere, isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import { fmtTime, subscribeHa, type HaSyncState } from '../api/ha';
import { ALARM_HE, assignEntityArea, CARD_EMPTY, CARD_IDS, HVAC_ACTION_HE, getDevicesArea, getDevicesTree, type CardId, type DeviceAreaDetail, type DeviceCard, type DeviceRow, type DeviceTree } from '../api/devices';
import type { BulkKind } from '../api/device-bulk';
import { alarmTone, REFRESH_WINDOW_MS, STRUCTURE_FLASH_MS } from './devices-building';
import './devices-bulk';
import type { BulkRequest, DevicesBulkDialog } from './devices-bulk';
import { navigate } from '../router';
import { bidi, ltrNum } from '../i18n/bidi';
import { applyDevicesPrefs, DEVICES_PREFS_DEFAULT, devicesStyleTokens, loadDevicesPrefs, type DevicesPrefs } from './devices-style';
import { DevicesLayoutController, shownEntities, TILE_COLS, titleOf, type MeasuredGrid, type TileEntry } from './devices-layout';
import { deg, DeviceControls, deviceControlStyles, rowLabel } from './devices-controls';

export { rowLabel };

/** CR-007 slice 4: a cover of these device classes is a passage, not a shutter - read-only wherever the covers card
 * renders it (device-class-aware wording/icon, `can_control` already false server-side). */
const DOOR_COVER_LABELS: Record<string, string> = { door: 'דלת', garage: 'דלת מוסך', gate: 'שער' };
const COVER_CLASS_LABEL: Record<string, string> = { shutter: 'תריס גלילה', blind: 'תריס', curtain: 'וילון', awning: 'סוכך', window: 'חלון' };
const COVER_CLASS_ICON: Record<string, IconName> = { door: 'lock', garage: 'lock', gate: 'lock' };
/** CR-007 slice 4: the sensors card grouped by device class, compact (services/devices.py SENSOR_GROUP_CLASSES). */
const SENSOR_GROUP_LABELS: Record<string, string> = { temperature: 'טמפרטורה', humidity: 'לחות', power: 'חשמל / אנרגיה', illuminance: 'תאורה סביבתית', co2: 'CO2', battery: 'סוללה', other: 'אחר' };
const SENSOR_GROUP_ORDER = ['temperature', 'humidity', 'power', 'illuminance', 'co2', 'battery'];

/** The cards whose devices are two-up tiles (the others are full-width rows). */
const TILE_CARDS = new Set<CardId>(['lighting', 'switches', 'sensors']);

const CARD_ICON: Record<CardId, IconName> = { lighting: 'light', switches: 'bolt', climate: 'activity', covers: 'layers', security: 'shield', media: 'play', sensors: 'sensor' };

/** CR-007 6a: the area screen's own element rules for the "glass" style (tokens: devices-style.ts) and the compact
 * density - the approved mockup's board 6: glass cards, icon-forward tiles, a blue glow for a lit light and a green
 * one for a running switch, iOS-green toggles. Logical properties only; smplwise + comfortable match none of them. */
const AREA_GLASS = css`
  :host([data-devices-style='glass']) sw-card {
    backdrop-filter: var(--sw-glass-blur);
    -webkit-backdrop-filter: var(--sw-glass-blur);
    padding-block: var(--dv-card-pad-block);
    padding-inline: var(--dv-card-pad-inline);
  }
  :host([data-devices-style='glass']) sw-card[data-empty] {
    background: var(--sw-surface-2);
  }
  :host([data-devices-style='glass']) sw-card > sw-icon[slot='actions'] {
    box-sizing: border-box;
    inline-size: var(--dv-card-badge-size);
    block-size: var(--dv-card-badge-size);
    padding: var(--dv-icon-ring-pad);
    border-radius: 50%;
    background: var(--dv-accent-soft);
    color: var(--dv-accent);
  }
  :host([data-devices-style='glass']) .grid {
    grid-template-columns: repeat(auto-fill, minmax(min(var(--dv-area-card-min), 100%), 1fr));
    gap: var(--dv-gap);
  }
  :host([data-devices-style='glass']) .tiles {
    /* icon + name + switch need room: one column in a narrow card or on a phone, two in a wide one */
    grid-template-columns: repeat(auto-fill, minmax(min(var(--dv-entity-tile-min), 100%), 1fr));
    gap: var(--dv-gap-sm);
  }
  :host([data-devices-style='glass']) .rows {
    gap: var(--dv-gap-sm);
  }
  :host([data-devices-style='glass']) .tile {
    min-block-size: var(--dv-item-min-block);
    padding-block: var(--dv-item-pad-block);
    padding-inline: var(--dv-item-pad-inline);
    gap: 6px;
    background: var(--sw-surface-2);
  }
  :host([data-devices-style='glass']) .tile .t {
    gap: var(--dv-gap-sm);
    font-size: var(--dv-fs-item-name);
    font-weight: var(--sw-fw-semibold);
  }
  :host([data-devices-style='glass']) .tile .t > sw-icon {
    box-sizing: border-box;
    inline-size: var(--dv-icon-ring-size);
    block-size: var(--dv-icon-ring-size);
    padding: var(--dv-icon-ring-pad);
    border-radius: 50%;
    background: var(--dv-icon-ring-bg);
    color: var(--dv-icon-ring-fg);
  }
  :host([data-devices-style='glass']) .tile .s,
  :host([data-devices-style='glass']) .tile .lc {
    padding-inline-start: calc(var(--dv-icon-ring-size) + var(--dv-gap-sm));
  }
  :host([data-devices-style='glass']) sw-card[data-card='lighting'] .tile.on {
    background: linear-gradient(135deg, rgb(var(--dv-tile-on-cool) / var(--dv-glow-fill-start)), rgb(var(--dv-tile-on-cool) / var(--dv-glow-fill-end))), var(--sw-surface-2);
    border-color: rgb(var(--dv-tile-on-cool) / var(--dv-glow-border));
    box-shadow: 0 0 24px rgb(var(--dv-tile-on-cool) / var(--dv-glow-halo));
  }
  :host([data-devices-style='glass']) sw-card[data-card='switches'] .tile.on {
    background: linear-gradient(135deg, rgb(var(--dv-tile-on-switch) / var(--dv-glow-fill-start)), rgb(var(--dv-tile-on-switch) / var(--dv-glow-fill-end))), var(--sw-surface-2);
    border-color: rgb(var(--dv-tile-on-switch) / var(--dv-glow-border));
    box-shadow: 0 0 24px rgb(var(--dv-tile-on-switch) / var(--dv-glow-halo));
  }
  :host([data-devices-style='glass']) sw-card[data-card='lighting'] .tile.on .t > sw-icon,
  :host([data-devices-style='glass']) sw-card[data-card='switches'] .tile.on .t > sw-icon {
    background: var(--dv-icon-ring-on-bg);
    color: var(--dv-icon-ring-fg);
  }
  :host([data-devices-style='glass']) sw-toggle {
    --sw-accent: var(--dv-toggle-on);
  }
  :host([data-devices-style='glass']) .row {
    padding-block: var(--dv-item-pad-block);
    padding-inline: var(--dv-item-pad-inline);
    background: var(--sw-surface-2);
  }
  :host([data-devices-style='glass']) .row .v.big {
    font-size: var(--dv-fs-value-big);
    font-weight: var(--dv-fw-title);
  }
  :host([data-devices-style='glass']) .cover-group {
    border-radius: var(--dv-radius-sm);
    padding-block: var(--dv-gap-sm);
    padding-inline: var(--dv-item-pad-inline);
  }
  :host([data-devices-style='glass']) .bar {
    block-size: 8px;
    border-radius: var(--dv-radius-control);
  }
  :host([data-devices-style='glass']) .bar i {
    border-radius: var(--dv-radius-control);
  }

  /* compact density (either style) */
  :host([data-devices-density='compact']) .grid {
    grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
    gap: 8px;
  }
  :host([data-devices-density='compact']) sw-card {
    padding-block: 10px;
    padding-inline: 10px;
  }
  :host([data-devices-density='compact']) .tiles {
    gap: 6px;
  }
  :host([data-devices-density='compact']) .rows {
    gap: 4px;
  }
  :host([data-devices-density='compact']) .tile {
    min-block-size: 0;
    padding-block: 6px;
    padding-inline: 8px;
    gap: 2px;
  }
  :host([data-devices-density='compact']) .row {
    padding-block: 5px;
    padding-inline: 8px;
  }
  :host([data-devices-style='glass'][data-devices-density='compact']) .tile .t > sw-icon {
    inline-size: calc(var(--dv-icon-ring-size) - 8px);
    block-size: calc(var(--dv-icon-ring-size) - 8px);
    padding: calc(var(--dv-icon-ring-pad) - 3px);
  }
  :host([data-devices-style='glass'][data-devices-density='compact']) .tile .s,
  :host([data-devices-style='glass'][data-devices-density='compact']) .tile .lc {
    padding-inline-start: calc(var(--dv-icon-ring-size) - 8px + var(--dv-gap-sm));
  }
`;

/**
 * חשמל והתקנים › אזור (CR-007 slice 1, read-only): one Home Assistant area as the mockup's cards - lighting, switches,
 * climate, covers, security, media, sensors - with the sibling areas of the same floor as chips and a breadcrumb back
 * to the building tree. Cards with something in them come first; empty ones close the grid with the honest empty
 * state (DomusUI's own layout choice for phones, applied everywhere). No controls in this slice: a lit light is a
 * warm tile, a cover's position is a bar, nothing is a switch or a slider.
 */
@customElement('devices-area')
export class DevicesArea extends LitElement {
  @property() areaId = '';
  @state() private detail: DeviceAreaDetail | null = null;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private notFound = false;
  @state() private sync: HaSyncState | null = null;
  /** CR-007 HA refresh: "מבנה עודכן" for a few seconds after a structure_changed push (an entity moved in or out). */
  @state() private structureFlash = false;
  private flashTimer = 0;
  /** CR-007 slice 4: the "כל התריסים" group control's own draft position (0-100), local until "קבע מיקום" is pressed. */
  @state() private coverGroupPosition = 50;
  /** CR-007 slice 4: the "ללא שיוך" bucket's assign-area dialog - the entity being assigned, and the HA areas to
   * offer (loaded from the tree on demand: the assign action needs installation-wide names, not this caller's
   * possibly-scoped area list). */
  @state() private assigning: DeviceRow | null = null;
  @state() private assignAreas: { area_id: string; name: string; floor_name: string | null }[] | null = null;
  @state() private assignTarget = '';
  @state() private assignBusy = false;
  @state() private assignError = '';
  private stop: (() => void) | null = null;
  private timer = 0;
  private loading = false;
  private loadAgain = false;
  /** CR-007 single-entity controls (devices-controls.ts, shared with the overview tiles' panel). */
  private ctl = new DeviceControls(this);
  /** CR-007 6a: style, density and the sensors card (הגדרות › חשמל והתקנים). */
  @state() private prefs: DevicesPrefs = DEVICES_PREFS_DEFAULT;
  private prefsReady: Promise<void> = Promise.resolve();
  /** CR-007 6b: the area's card layout (one per installation and area; edited with system.configure). */
  private lay = new DevicesLayoutController(this, {
    scope: 'area',
    id: () => this.areaId,
    screenName: () => `מסך האזור › ${this.detail?.area.name ?? ''}`,
    measure: () => this.measureCards(),
    defaultH: () => 30,
    label: (key) => (this.detail ? (this.detail.cards[key.slice(5) as CardId]?.label ?? key) : key),
    compact: () => this.prefs.density === 'compact',
    entities: (key) => {
      const c = this.detail?.cards[key.slice(5) as CardId];
      return c ? this.displayRows(c).map((r) => ({ id: r.entity_id, name: r.name })) : [];
    },
    // 6c: lighting, switches and sensors are two-up tiles; the other cards' rows are the card's full width
    tileSpan: (key) => (TILE_CARDS.has(key.slice(5) as CardId) ? 1 : (TILE_COLS[key.slice(5)] ?? 1)),
  });

  /** A card's devices in the order it draws them automatically (the sensors card: grouped by device class). */
  private displayRows(c: DeviceCard): DeviceRow[] {
    if (c.id !== 'sensors') return c.entities;
    const rank = (g: string | null | undefined) => {
      const i = SENSOR_GROUP_ORDER.indexOf(g ?? 'other');
      return i === -1 ? (g && g !== 'other' ? SENSOR_GROUP_ORDER.length : SENSOR_GROUP_ORDER.length + 1) : i;
    };
    return c.entities
      .map((r, i) => ({ r, i }))
      .sort((a, b) => rank(a.r.group) - rank(b.r.group) || (rank(a.r.group) === SENSOR_GROUP_ORDER.length ? (a.r.group ?? '').localeCompare(b.r.group ?? '') : 0) || a.i - b.i)
      .map((x) => x.r);
  }

  private measureCards(): MeasuredGrid[] {
    const el = this.renderRoot.querySelector<HTMLElement>('[data-lay-grid="cards"]');
    if (!el) return [];
    return [{ el, items: [...el.querySelectorAll<HTMLElement>(':scope > [data-lay-key]')].map((c) => ({ key: c.dataset.layKey!, el: c })) }];
  }

  /** CR-007 slice 3: the area's own bulk actions (the same popover as the tree's area tile), for a holder of
   * devices.control_bulk where the server says it would accept them (`can_bulk`); the dialog alone sends. */
  private get bulkAllowed(): boolean {
    return isApi() && canAnywhere('devices.control_bulk') && this.detail?.can_bulk === true;
  }

  private onBulkRequest = (e: CustomEvent<BulkRequest>) => {
    e.stopPropagation();
    void this.renderRoot.querySelector<DevicesBulkDialog>('devices-bulk-dialog')?.show(e.detail);
  };

  static styles = [devicesStyleTokens, deviceControlStyles, css`
    :host {
      display: block;
    }
    .chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .chips .lbl {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-inline-end: 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 12px;
      align-items: start;
    }
    sw-card[data-empty] {
      background: var(--sw-surface-2);
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .sensor-groups {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sensor-group-label {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-3);
      margin-block-end: 4px;
    }
    .tile .lc {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      min-inline-size: 0;
    }
    .tile.on {
      background: var(--sw-warning-soft);
      border-color: color-mix(in srgb, var(--sw-warning) 40%, var(--sw-border));
    }
    .tile.off {
      color: var(--sw-text-2);
    }
    .tile.unavailable,
    .row.unavailable {
      opacity: 0.6;
    }
    .tile .t {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .tile .t span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tile.on .t sw-icon {
      color: var(--sw-warning);
    }
    .tile .s {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 4px 10px;
      align-items: center;
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .row.on {
      border-color: color-mix(in srgb, var(--sw-warning) 40%, var(--sw-border));
      background: var(--sw-warning-soft);
    }
    .row .n {
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .v {
      font-size: var(--sw-fs-sm);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      text-align: end;
    }
    .row .v.big {
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-semibold);
    }
    .row .d {
      grid-column: 1 / -1;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .bar {
      grid-column: 1 / -1;
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      border-radius: 3px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .row .n .muted {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-regular, normal);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .bulk-safe {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      white-space: normal;
    }
    /* CR-007 slice 4: the covers card's own "כל התריסים" group control */
    .cover-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 8px 10px;
      margin-block-end: 6px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface-2);
    }
    .cover-group .lbl {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
    }
    .cover-group input[type='range'] {
      flex: 1;
      min-inline-size: 80px;
      accent-color: var(--sw-accent);
    }
    /* CR-007 slice 4: assign an unassigned entity to an area */
    .assign-btn {
      grid-column: 1 / -1;
    }
    .assign-select {
      inline-size: 100%;
      font: inherit;
      font-size: var(--sw-fs-sm);
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      padding: 6px 8px;
    }
    .assign-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-block-start: 10px;
      margin-block-start: 8px;
      border-block-start: 1px solid var(--sw-border);
    }
    .assign-err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .assign-muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
  `, AREA_GLASS];

  connectedCallback() {
    super.connectedCallback();
    this.prefsReady = loadDevicesPrefs().then((p) => {
      this.prefs = p;
      applyDevicesPrefs(this, p);
    });
    if (!isApi()) return;
    if (!canAnywhere('devices.read')) {
      this.forbidden = true;
      return;
    }
    this.stop = subscribeHa(
      (m) => {
        // only pushes about this area's own entities refetch it; until the area is loaded every push may be one of them
        if (m.type === 'entity_state_changed') {
          if (!this.detail || this.entityIds.has(m.entity.entity_id)) this.scheduleReload();
        } else if (m.type === 'structure_changed') {
          // the entity filter above cannot see an entity moved INTO this area, nor a rename: refetch whole
          this.scheduleReload();
          this.structureFlash = true;
          window.clearTimeout(this.flashTimer);
          this.flashTimer = window.setTimeout(() => (this.structureFlash = false), STRUCTURE_FLASH_MS);
        } else if (m.type === 'ha_sync_state') {
          if (this.sync) this.sync = { ...this.sync, connected: m.connected };
          this.scheduleReload();
        } else if (m.type === 'heartbeat') this.sync = m.sync;
      },
      (connected) => {
        if (connected) this.scheduleReload();
      },
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stop?.();
    this.stop = null;
    window.clearTimeout(this.timer);
    this.timer = 0;
  }

  /** The loaded area's entity ids (all cards), for the push filter. */
  private get entityIds(): Set<string> {
    if (!this.detail) return new Set();
    return new Set(CARD_IDS.flatMap((id) => this.detail!.cards[id].entities.map((r) => r.entity_id)));
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('areaId') && isApi() && !this.forbidden) {
      void this.lay.load();
      this.detail = null;
      this.notFound = false;
      this.error = '';
      void this.load();
    }
  }

  /** Throttle, as devices-building: one refetch per window while pushes keep coming, one more after they stop. */
  private scheduleReload() {
    if (this.timer) return;
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      void this.load();
    }, REFRESH_WINDOW_MS);
  }

  private async load() {
    if (!this.areaId) return;
    if (this.loading) {
      this.loadAgain = true;
      return;
    }
    this.loading = true;
    const id = this.areaId;
    try {
      const [d] = await Promise.all([getDevicesArea(id), this.prefsReady]); // first paint already in the installation's style
      if (id !== this.areaId) return; // the route moved on while this was in flight
      this.detail = d;
      this.sync = d.sync;
      this.error = '';
      this.notFound = false;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.forbidden = true;
      else if (err instanceof ApiError && err.status === 404) this.notFound = true;
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
    if (!isApi()) {
      return html`<sw-page heading="אזור" subheading="חשמל והתקנים · נתוני הדגמה" backHref="/devices/building" crumbs=${`${heading} | אזור`}><sw-state-panel state="empty" heading="מסך האזור עובד מול השרת" hint="במצב הדגמה אין אזורים להצגה; עץ המבנה מציג נתוני הדגמה."></sw-state-panel></sw-page>`;
    }
    if (this.forbidden) {
      return html`<sw-page heading=${heading} subheading="אזור" backHref="/devices/building"><sw-state-panel data-devices-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בחשמל והתקנים" hint="נדרשת ההרשאה צפייה בחשמל והתקנים. פנה למנהל המערכת."></sw-state-panel></sw-page>`;
    }
    if (this.notFound) {
      return html`<sw-page heading=${heading} subheading="אזור" backHref="/devices/building" crumbs=${`${heading} | אזור`}><sw-state-panel data-devices-state="not_found" state="empty" heading="האזור לא נמצא" hint="האזור אינו קיים, או שאין בו התקנים שבהרשאתך."></sw-state-panel></sw-page>`;
    }
    const d = this.detail;
    if (!d) {
      return html`<sw-page heading=${heading} subheading="אזור" backHref="/devices/building">${this.error
        ? html`<sw-state-panel data-devices-state="load_error" state="error" heading="לא ניתן לטעון את האזור" hint=${this.error}></sw-state-panel>`
        : html`<sw-state-panel state="loading"></sw-state-panel>`}</sw-page>`;
    }
    const floorName = d.area.floor_name ?? '';
    const crumbs = [heading, floorName, d.area.name].filter(Boolean).join(' | ');
    const sub = `${floorName ? `${bidi(floorName)} · ` : ''}${d.counts.entities} התקנים${d.scoped ? ' · לפי הקומות שלך' : ''}`;
    const connected = this.sync?.connected ?? false;
    const cards = CARD_IDS.filter((id) => this.prefs.showSensors || id !== 'sensors').map((id) => d.cards[id]);
    // Owner feedback 2026-09-29 ("hide empty domains"): a domain this area has nothing of is not a card at all. Its saved
    // layout slot stays in the record; a viewer's layout packs its rows away (devices-layout.ts, as for an item gone
    // from Home Assistant), and the card comes back in its saved place when the domain appears.
    const ordered = cards.filter((c) => c.count > 0);
    const anyControllable = cards.some((c) => c.entities.some((r) => r.can_control));
    const bulk = this.bulkAllowed;
    this.lay.prepare([{ id: 'cards', keys: ordered.map((c) => `card:${c.id}`) }]);
    // 6c: "סידור התקנים" - the editor shows the card being arranged alone
    const arranging = this.lay.tileCard ? ordered.find((c) => this.lay.arranging(`card:${c.id}`)) : undefined;
    return html`<sw-page heading=${bidi(d.area.name)} subheading=${sub} backHref="/devices/building" crumbs=${crumbs} wide @bulk-request=${this.onBulkRequest}>
      <div slot="actions">
        ${this.lay.renderEditButton()}
        ${bulk ? html`<devices-bulk-menu scope="area" .targetId=${d.area.area_id} .targetName=${d.area.name} .counts=${d.counts} variant="popover" label="פעולות לאזור" data-bulk-area=${d.area.area_id}></devices-bulk-menu>` : nothing}
        ${d.counts.alarm ? html`<sw-badge data-area-alarm kind=${alarmTone(d.counts.alarm)} label=${`אזעקה: ${ALARM_HE[d.counts.alarm] ?? d.counts.alarm}`}></sw-badge>` : nothing}
        <sw-badge data-devices-sync kind=${connected ? 'live' : 'stale'} label=${connected ? 'מסונכרן' : 'לא מסונכרן'}></sw-badge>
        ${this.structureFlash ? html`<sw-badge data-structure-changed kind="live" label="מבנה עודכן"></sw-badge>` : nothing}
      </div>
      ${d.floor_areas.length > 1
        ? html`<div class="chips" role="navigation" aria-label="אזורים בקומה">
            <span class="lbl">${floorName ? bidi(floorName) : 'אזורים'}:</span>
            ${d.floor_areas.map(
              (a) => html`<sw-chip data-area-chip=${a.area_id} ?selected=${a.area_id === d.area.area_id} .count=${a.counts.entities} @click=${() => navigate(`/devices/areas/${encodeURIComponent(a.area_id)}`)}>${bidi(a.name)}</sw-chip>`,
            )}
          </div>`
        : nothing}
      ${this.error ? html`<sw-state-panel compact state="error" heading="הרענון האחרון נכשל" hint=${this.error}></sw-state-panel>` : nothing}
      ${this.lay.renderBar()}
      ${arranging
        ? this.lay.stage(`card:${arranging.id}`, this.renderCard(arranging))
        : ordered.length
        ? html`<div class=${classMap({ grid: true, 'lay-grid': this.lay.gridOn('cards') })} data-lay-grid="cards" data-lay-cols=${this.lay.gridCols('cards')} ?data-lay-phone-preview=${this.lay.phonePreview('cards')}>
            ${repeat(ordered, (c) => c.id, (c) => this.lay.wrap(`card:${c.id}`, this.renderCard(c)))}
          </div>`
        : html`<sw-state-panel data-devices-state="area_empty" state="empty" heading="אין התקנים באזור הזה" hint="שייכו התקנים לאזור (או מ״ללא שיוך״); כרטיס של תאורה, מתגים, מיזוג, תריסים, אבטחה, מסכים או חיישנים מופיע כשיש באזור התקן מהסוג הזה."></sw-state-panel>`}
      <div class="note">
        ${anyControllable
          ? 'הקשה על מתג, כפתור או החלקה לשליטה בהתקן. המצב המוצג בשורה הוא תמיד המצב שדווח; פקודה שנשלחה מסומנת "ממתין לאישור" עד שהדיווח מגיע, ומתבטלת אם הוא לא מגיע בזמן. תנועת תריס (פתיחה, סגירה או מיקום) דורשת הקשת אישור נוספת.'
          : 'תצוגה לקריאה בלבד: מצב ההתקנים כפי שדווח.'}
      </div>
      ${bulk ? html`<devices-bulk-dialog @bulk-done=${() => void this.load()}></devices-bulk-dialog>` : nothing}
      ${this.canAssignArea ? this.renderAssignDialog() : nothing}
      ${this.lay.renderPanel()}
    </sw-page>`;
  }

  private renderCard(c: DeviceCard) {
    const e = CARD_EMPTY[c.id];
    const it = this.lay.item(`card:${c.id}`); // CR-007 6b: the layout's own title, icon and shown entities
    const ents = shownEntities(it, c.entities);
    // CR-007 6c: an arranged card (or the one being arranged) draws its tiles in the saved order / span / size
    const tiles = c.count ? this.lay.tiles(`card:${c.id}`, this.displayRows(c).map((r) => r.entity_id)) : null;
    return html`<sw-card data-card=${c.id} data-lay-key=${`card:${c.id}`} ?data-empty=${c.count === 0} heading=${titleOf(it, c.label)} subheading=${c.count ? `${c.count} התקנים${c.id === 'lighting' || c.id === 'switches' || c.id === 'climate' || c.id === 'covers' || c.id === 'media' ? ` · ${c.active} פעילים` : ''}` : ''}>
      <sw-icon slot="actions" .name=${it?.icon ?? CARD_ICON[c.id]} size=${18}></sw-icon>
      ${c.count === 0
        ? html`<sw-state-panel compact data-card-empty state="empty" heading=${e.heading} hint=${e.hint}></sw-state-panel>`
        : tiles
          ? this.renderArranged(c, tiles)
          : !ents.length
          ? html`<div class="count" data-card-all-hidden>כל ההתקנים בכרטיס הוסתרו בעורך הפריסה.</div>`
          : c.id === 'sensors'
            ? this.renderSensorGroups(ents)
            : c.id === 'lighting' || c.id === 'switches'
              ? html`<div class="tiles">${repeat(ents, (r) => r.entity_id, (r) => this.renderTile(r, c.id))}</div>`
              : html`${c.id === 'covers' ? this.renderCoverGroupControl() : nothing}<div class="rows">${repeat(ents, (r) => r.entity_id, (r) => this.renderRow(r, c.id))}</div>`}
    </sw-card>`;
  }

  /** CR-007 6c: a card's devices as arranged - one grid of TILE_COLS columns in the saved order, each tile with its
   * span, size and title (the device's own row / tile inside; its controls unchanged). The card's numbers (heading,
   * the floor chips) still count every device, hidden or not; a sensors card arranged by hand is one list. */
  private renderArranged(c: DeviceCard, tiles: TileEntry[]) {
    if (!tiles.length) return html`<div class="count" data-card-all-hidden>כל ההתקנים בכרטיס הוסתרו בעורך הפריסה.</div>`;
    const key = `card:${c.id}`;
    const byId = new Map(c.entities.map((r) => [r.entity_id, r]));
    return html`${c.id === 'covers' && !this.lay.arranging(key) ? this.renderCoverGroupControl() : nothing}<div class="tiles lay-tgrid" data-lay-tiles=${c.id}>${repeat(
      tiles,
      (x) => x.id,
      (x, i) => {
        const raw = byId.get(x.id)!;
        const r = x.t.title ? { ...raw, name: x.t.title } : raw; // the custom title is text only (Lit escapes it)
        return this.lay.wrapTile(key, x, i, tiles.length, TILE_CARDS.has(c.id) ? this.renderTile(r, c.id) : this.renderRow(r, c.id));
      },
    )}</div>`;
  }

  /** CR-007 slice 4: the sensors card grouped by device class, compact - temperature, humidity, power/energy,
   * illuminance, CO2, battery and generic numeric sensors, plus the binary sensors outside the security set. */
  private renderSensorGroups(entities: DeviceRow[]) {
    const groups = new Map<string, DeviceRow[]>();
    for (const r of entities) {
      const g = r.group ?? 'other';
      const list = groups.get(g);
      if (list) list.push(r);
      else groups.set(g, [r]);
    }
    const keys = [...groups.keys()].sort((a, b) => {
      const ia = SENSOR_GROUP_ORDER.indexOf(a);
      const ib = SENSOR_GROUP_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a === 'other' ? 1 : b === 'other' ? -1 : a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return html`<div class="sensor-groups">${keys.map((g) => html`<div class="sensor-group" data-sensor-group=${g}>
      <div class="sensor-group-label">${SENSOR_GROUP_LABELS[g] ?? g}</div>
      <div class="tiles">${repeat(groups.get(g)!, (r) => r.entity_id, (r) => this.renderTile(r, 'sensors'))}</div>
    </div>`)}</div>`;
  }

  private renderTile(raw: DeviceRow, card: CardId) {
    const controllable = raw.can_control && raw.available && raw.state !== 'unavailable' && (card === 'lighting' || card === 'switches');
    const r = raw; // the row's text is always what HA last reported; only the controls show a pending target
    const unavailable = !r.available || r.state === 'unavailable';
    const icon: IconName = card === 'lighting' ? 'light' : card === 'switches' ? 'bolt' : 'sensor';
    const value =
      card === 'sensors'
        ? r.domain === 'sensor'
          ? r.value !== null && r.value !== undefined
            ? `${ltrNum(Number.isInteger(r.value) ? r.value : r.value.toFixed(1))}${r.unit ? ` ${r.unit}` : ''}`
            : (r.state ?? '—')
          : rowLabel(r)
        : rowLabel(r);
    const on = r.active && !unavailable;
    return html`<div class=${classMap({ tile: true, on, off: !on && !unavailable, unavailable, pending: controllable && this.ctl.rowPending(r.entity_id) })} data-entity=${r.entity_id} data-active=${String(on)} ?data-can-control=${controllable} title=${r.entity_id}>
      <div class="t"><sw-icon .name=${icon} size=${15}></sw-icon><span>${bidi(r.name)}</span>${controllable ? this.ctl.renderPowerToggle(r) : nothing}</div>
      <div class="s">${unavailable ? 'לא זמין' : value}</div>
      ${card === 'sensors' && r.last_changed ? html`<div class="lc" data-last-changed>${fmtTime(r.last_changed)}</div>` : nothing}
      ${controllable && card === 'lighting' && (on || this.ctl.live<boolean>(r.entity_id, 'power') === true) ? this.ctl.renderBrightnessSlider(r) : nothing}
      ${controllable ? this.ctl.renderCmdStatus(r.entity_id) : nothing}
      ${this.renderAssignButton(r)}
    </div>`;
  }

  // ---------------------------------------------------------------- CR-007 slice 4: covers card - the "כל התריסים"
  // group control (open all / stop all / close all / position all), the same server-enforced bulk path (never a
  // fan-out path of its own) as the floor/area/building menus - just started from here, with kind covers_open /
  // covers_stop / covers_close / covers_position, scoped to this area.

  /** Wording/icon per device class (CR-007 slice 4): shutter/blind/curtain/awning/window get the shutter controls;
   * door/garage/gate stay read-only (server-side `can_control` is already false for them). */
  private coverLabel(r: DeviceRow): string {
    if (r.door_class) return DOOR_COVER_LABELS[r.device_class ?? ''] ?? 'דלת / שער';
    return COVER_CLASS_LABEL[r.device_class ?? ''] ?? 'תריס';
  }

  private get coverGroupAllowed(): boolean {
    return this.bulkAllowed && (this.detail?.counts.covers ?? 0) > 0;
  }

  private openCoverGroupBulk(kind: BulkKind, position?: number) {
    const d = this.detail;
    if (!d) return;
    void this.renderRoot.querySelector<DevicesBulkDialog>('devices-bulk-dialog')?.show({ scope: 'area', id: d.area.area_id, name: d.area.name, kind, position });
  }

  private renderCoverGroupControl() {
    if (!this.coverGroupAllowed) return nothing;
    const setPos = (ev: Event) => (this.coverGroupPosition = Number((ev.target as HTMLInputElement).value));
    return html`<div class="cover-group" data-cover-group>
      <span class="lbl">כל התריסים:</span>
      <sw-button size="sm" data-cover-group-kind="covers_open" @click=${() => this.openCoverGroupBulk('covers_open')}>פתח הכל</sw-button>
      <sw-button size="sm" data-cover-group-kind="covers_stop" @click=${() => this.openCoverGroupBulk('covers_stop')}>עצור הכל</sw-button>
      <sw-button size="sm" data-cover-group-kind="covers_close" @click=${() => this.openCoverGroupBulk('covers_close')}>סגור הכל</sw-button>
      <input type="range" data-cover-group-position-input min="0" max="100" .value=${String(this.coverGroupPosition)} @input=${setPos} @click=${(e: Event) => e.stopPropagation()} aria-label="מיקום לכל התריסים" />
      <span class="ctl-val">${ltrNum(this.coverGroupPosition)}%</span>
      <sw-button size="sm" variant="primary" data-cover-group-kind="covers_position" @click=${() => this.openCoverGroupBulk('covers_position', this.coverGroupPosition)}>קבע מיקום לכולם</sw-button>
    </div>`;
  }

  // ---------------------------------------------------------------- CR-007 slice 4: assign an unassigned entity

  private get canAssignArea(): boolean {
    return this.detail?.area.area_id === 'unassigned' && this.detail?.can_assign_area === true;
  }

  private renderAssignButton(r: DeviceRow) {
    if (!this.canAssignArea) return nothing;
    return html`<sw-button class="assign-btn" size="sm" variant="ghost" data-assign-entity=${r.entity_id} @click=${(e: Event) => { e.stopPropagation(); void this.openAssign(r); }}>שייך לאזור</sw-button>`;
  }

  private async openAssign(r: DeviceRow) {
    this.assigning = r;
    this.assignTarget = '';
    this.assignError = '';
    this.assignBusy = false;
    if (!this.assignAreas) {
      try {
        const t = await getDevicesTree();
        this.assignAreas = this.flattenAreas(t);
      } catch (err) {
        this.assignError = describeError(err);
      }
    }
  }

  /** The areas offered by the assign dialog: every HA area this caller's tree carries, floor name alongside. */
  private flattenAreas(t: DeviceTree): { area_id: string; name: string; floor_name: string | null }[] {
    return t.floors.flatMap((f) => f.areas.map((a) => ({ area_id: a.area_id, name: a.name, floor_name: f.floor_id === 'none' ? null : f.name })));
  }

  private closeAssign = () => {
    if (this.assignBusy) return;
    this.assigning = null;
  };

  private async confirmAssign() {
    const r = this.assigning;
    if (!r || !this.assignTarget || this.assignBusy) return;
    this.assignBusy = true;
    this.assignError = '';
    try {
      await assignEntityArea(r.entity_id, this.assignTarget);
      this.assigning = null;
      void this.load();
    } catch (err) {
      this.assignError = describeError(err);
    } finally {
      this.assignBusy = false;
    }
  }

  private renderAssignDialog() {
    const r = this.assigning;
    if (!r) return html`<sw-dialog data-assign-dialog="closed"></sw-dialog>`;
    return html`<sw-dialog open data-assign-dialog="open" heading="שיוך לאזור" subheading=${bidi(r.name)} @close=${this.closeAssign}>
      ${this.assignError ? html`<div class="assign-err" data-assign-error>${this.assignError}</div>` : nothing}
      ${this.assignAreas === null
        ? html`<div class="assign-muted">טוען אזורים…</div>`
        : html`<select class="assign-select" data-assign-select @change=${(e: Event) => (this.assignTarget = (e.target as HTMLSelectElement).value)}>
            <option value="" ?selected=${!this.assignTarget} disabled>בחרו אזור</option>
            ${this.assignAreas.map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === this.assignTarget}>${bidi(a.name)}${a.floor_name ? ` · ${bidi(a.floor_name)}` : ''}</option>`)}
          </select>`}
      <div class="assign-actions">
        <sw-button data-assign-cancel autofocus @click=${this.closeAssign}>ביטול</sw-button>
        <sw-button data-assign-confirm variant="primary" ?disabled=${!this.assignTarget || this.assignBusy} @click=${() => void this.confirmAssign()}>שייך</sw-button>
      </div>
    </sw-dialog>`;
  }

  private renderRow(raw: DeviceRow, card: CardId) {
    const controllable = raw.can_control && raw.available && raw.state !== 'unavailable' && (card === 'climate' || card === 'covers' || card === 'media');
    const r = raw; // the row's text is always what HA last reported; only the controls show a pending target
    const unavailable = !r.available || r.state === 'unavailable';
    const on = r.active && !unavailable;
    const pendingCls = controllable && this.ctl.rowPending(r.entity_id);
    if (card === 'climate') {
      const isClimate = r.domain === 'climate';
      return html`<div class=${classMap({ row: true, on, unavailable, pending: pendingCls })} data-entity=${r.entity_id} data-active=${String(r.active)} ?data-can-control=${controllable} title=${r.entity_id}>
        <span class="n">${bidi(r.name)}</span>
        <span class="v big">${unavailable ? 'לא זמין' : isClimate ? deg(r.current_temperature) : rowLabel(r)}</span>
        ${isClimate && !unavailable
          ? html`<div class="d">
              <span>מצב: ${rowLabel(r)}</span>
              ${r.hvac_action ? html`<span>${HVAC_ACTION_HE[r.hvac_action] ?? r.hvac_action}</span>` : nothing}
              ${r.target_temperature !== null && r.target_temperature !== undefined ? html`<span>יעד ${deg(r.target_temperature)}</span>` : nothing}
              ${r.target_temp_low !== null && r.target_temp_low !== undefined && r.target_temp_high !== null && r.target_temp_high !== undefined ? html`<span>טווח ${deg(r.target_temp_low)}–${deg(r.target_temp_high)}</span>` : nothing}
              ${r.fan_mode ? html`<span>מאוורר: ${r.fan_mode}</span>` : nothing}
              ${r.preset_mode ? html`<span>מצב מוגדר: ${r.preset_mode}</span>` : nothing}
              ${r.swing_mode ? html`<span>נדנוד: ${r.swing_mode}</span>` : nothing}
              ${r.target_humidity !== null && r.target_humidity !== undefined ? html`<span>לחות יעד ${ltrNum(r.target_humidity)}%</span>` : nothing}
            </div>`
          : r.domain === 'humidifier' && !unavailable
            ? html`<div class="d">
                ${r.mode ? html`<span>מצב: ${r.mode}</span>` : nothing}
                ${r.current_humidity !== null && r.current_humidity !== undefined ? html`<span>לחות ${ltrNum(r.current_humidity)}%</span>` : nothing}
                ${r.target_humidity !== null && r.target_humidity !== undefined ? html`<span>יעד ${ltrNum(r.target_humidity)}%</span>` : nothing}
              </div>`
            : nothing}
        ${controllable ? this.ctl.renderClimateControls(r) : nothing}
        ${controllable ? this.ctl.renderCmdStatus(r.entity_id) : nothing}
        ${this.renderAssignButton(r)}
      </div>`;
    }
    if (card === 'covers') {
      const coverIcon: IconName = r.door_class ? (COVER_CLASS_ICON[r.device_class ?? ''] ?? 'lock') : 'layers';
      return html`<div class=${classMap({ row: true, on, unavailable, pending: pendingCls })} data-entity=${r.entity_id} data-active=${String(r.active)} data-door-class=${String(!!r.door_class)} ?data-can-control=${controllable} title=${r.entity_id}>
        <span class="n">${r.door_class ? html`<sw-icon .name=${coverIcon} size=${14}></sw-icon> ` : nothing}${bidi(r.name)}<span class="muted"> · ${this.coverLabel(r)}</span></span>
        <span class="v">${rowLabel(r)}</span>
        ${r.position !== null && r.position !== undefined && !unavailable ? html`<div class="bar" role="img" aria-label=${`פתוח ${r.position}%`}><i style=${`inline-size:${r.position}%`}></i></div>` : nothing}
        ${r.tilt !== null && r.tilt !== undefined && !unavailable ? html`<div class="d"><span>הטיה ${ltrNum(r.tilt)}%</span></div>` : nothing}
        ${r.door_class ? html`<div class="d"><span>דלת / שער - תנועה של מעבר, לקריאה בלבד כאן</span></div>` : nothing}
        ${controllable ? this.ctl.renderCoverControls(r) : nothing}
        ${controllable ? this.ctl.renderCmdStatus(r.entity_id) : nothing}
        ${this.renderAssignButton(r)}
      </div>`;
    }
    if (card === 'security') {
      let badge: { kind: StateKind; label: string };
      if (unavailable) badge = { kind: 'offline', label: 'לא זמין' };
      else if (r.kind === 'lock') badge = r.locked ? { kind: 'live', label: 'נעול' } : { kind: 'stale', label: rowLabel(r) };
      else if (r.kind === 'alarm') badge = { kind: alarmTone(r.state), label: rowLabel(r) };
      else if (r.kind === 'camera') badge = { kind: 'neutral', label: 'מצלמת התקן' };
      else badge = { kind: r.state === 'on' ? 'stale' : 'neutral', label: rowLabel(r) };
      const kindIcon: IconName = r.kind === 'lock' ? (r.locked ? 'lock' : 'unlock') : r.kind === 'alarm' ? 'shield' : r.kind === 'camera' ? 'camera' : 'sensor';
      return html`<div class=${classMap({ row: true, unavailable })} data-entity=${r.entity_id} data-kind=${r.kind ?? ''} title=${r.entity_id}>
        <span class="n"><sw-icon .name=${kindIcon} size=${14}></sw-icon> ${bidi(r.name)}</span>
        <sw-badge kind=${badge.kind} label=${badge.label}></sw-badge>
        ${r.kind === 'camera' ? html`<div class="d"><span>אין תמונה ממצלמת התקן במסך הזה עדיין; מצלמות ה־NVR מוצגות ב"מצלמות".</span></div>` : nothing}
        ${this.renderAssignButton(r)}
      </div>`;
    }
    // media
    return html`<div class=${classMap({ row: true, on, unavailable, pending: pendingCls })} data-entity=${r.entity_id} data-active=${String(r.active)} ?data-can-control=${controllable} title=${r.entity_id}>
      <span class="n"><sw-icon name="play" size=${14}></sw-icon> ${bidi(r.name)}</span>
      <span class="v">${rowLabel(r)}</span>
      ${!unavailable && (r.media_title || r.source || r.volume_pct !== null)
        ? html`<div class="d">
            ${r.media_title ? html`<span>${r.media_title}</span>` : nothing}
            ${r.source ? html`<span>מקור: ${r.source}</span>` : nothing}
            ${r.volume_pct !== null && r.volume_pct !== undefined ? html`<span>עוצמה ${ltrNum(r.volume_pct)}%${r.muted ? ' · מושתק' : ''}</span>` : nothing}
          </div>`
        : nothing}
      ${controllable ? this.ctl.renderMediaControls(r) : nothing}
      ${controllable ? this.ctl.renderCmdStatus(r.entity_id) : nothing}
      ${this.renderAssignButton(r)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-area': DevicesArea;
  }
}
