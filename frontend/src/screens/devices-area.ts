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
import { ApiError, describeError, put } from '../api/client';
import { fmtTime, stateLabel, subscribeHa, type HaSyncState } from '../api/ha';
import { ALARM_HE, assignEntityArea, CARD_EMPTY, CARD_IDS, HVAC_ACTION_HE, HVAC_HE, getDevicesArea, getDevicesTree, type CardId, type DeviceAreaDetail, type DeviceCard, type DeviceRow, type DeviceTree } from '../api/devices';
import { debouncedCommand, runCommand, supersede, type CommandState } from '../api/device-commands';
import type { BulkKind } from '../api/device-bulk';
import { alarmTone, REFRESH_WINDOW_MS, STRUCTURE_FLASH_MS } from './devices-building';
import './devices-bulk';
import type { BulkRequest, DevicesBulkDialog } from './devices-bulk';
import { navigate } from '../router';
import { bidi, ltrNum } from '../i18n/bidi';
import { applyDevicesPrefs, DEVICES_PREFS_DEFAULT, devicesStyleTokens, loadDevicesPrefs, type DevicesPrefs } from './devices-style';

/** CR-007 slice 4: a cover of these device classes is a passage, not a shutter - read-only wherever the covers card
 * renders it (device-class-aware wording/icon, `can_control` already false server-side). */
const DOOR_COVER_LABELS: Record<string, string> = { door: 'דלת', garage: 'דלת מוסך', gate: 'שער' };
const COVER_CLASS_LABEL: Record<string, string> = { shutter: 'תריס גלילה', blind: 'תריס', curtain: 'וילון', awning: 'סוכך', window: 'חלון' };
const COVER_CLASS_ICON: Record<string, IconName> = { door: 'lock', garage: 'lock', gate: 'lock' };
/** CR-007 slice 4: the sensors card grouped by device class, compact (services/devices.py SENSOR_GROUP_CLASSES). */
const SENSOR_GROUP_LABELS: Record<string, string> = { temperature: 'טמפרטורה', humidity: 'לחות', power: 'חשמל / אנרגיה', illuminance: 'תאורה סביבתית', co2: 'CO2', battery: 'סוללה', other: 'אחר' };
const SENSOR_GROUP_ORDER = ['temperature', 'humidity', 'power', 'illuminance', 'co2', 'battery'];

/** The modes the add-on's allow-list accepts (services/ha_bridge.HVAC_MODES); the menu shows the entity's own
 * hvac_modes that are among them - never a mode the entity does not report. */
const HVAC_SELECTABLE = ['off', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only'];
/** How long a "one gesture to arm, one tap to confirm" control stays armed (cover open / close / position: attention
 * risk in the allow-list, services/ha_bridge.py - a confirmation is required, but a modal is overkill for a card). */
const ARM_MS = 4000;

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

function deg(n: number | null | undefined, unit = '°'): string {
  return n === null || n === undefined ? '—' : `${ltrNum(Number.isInteger(n) ? n : n.toFixed(1))}${unit}`;
}

/** The read-only label of a row in words: "דולק · 50%", "פתוח · 70%", "נעול", "23.5 °C" ... (api/ha stateLabel's rules). */
export function rowLabel(r: DeviceRow): string {
  if (r.state === 'unavailable' || !r.available) return 'לא זמין';
  if (r.domain === 'light') return r.active ? (r.brightness_pct !== null && r.brightness_pct !== undefined ? `דולק · ${ltrNum(r.brightness_pct)}%` : 'דולק') : 'כבוי';
  if (r.domain === 'cover') {
    const s = r.state === 'open' ? 'פתוח' : r.state === 'closed' ? 'סגור' : r.state === 'opening' ? 'נפתח…' : r.state === 'closing' ? 'נסגר…' : (r.state ?? 'לא ידוע');
    return r.position !== null && r.position !== undefined && !r.moving ? `${s} · ${ltrNum(r.position)}%` : s;
  }
  if (r.domain === 'climate') return r.hvac_mode ? (HVAC_HE[r.hvac_mode] ?? r.hvac_mode) : 'לא ידוע';
  if (r.domain === 'alarm_control_panel') return ALARM_HE[r.state ?? ''] ?? r.state ?? 'לא ידוע';
  if (r.domain === 'media_player') return r.state === 'playing' ? 'מנגן' : r.state === 'paused' ? 'מושהה' : r.state === 'idle' ? 'דולק · ללא תוכן' : r.state === 'on' ? 'דולק' : r.state === 'standby' ? 'המתנה' : r.state === 'off' ? 'כבוי' : (r.state ?? 'לא ידוע');
  if (r.domain === 'fan') return r.active ? (r.percentage !== null && r.percentage !== undefined ? `פועל · ${ltrNum(r.percentage)}%` : 'פועל') : 'כבוי';
  if (r.domain === 'humidifier') return r.active ? 'פועל' : 'כבוי';
  return stateLabel({ domain: r.domain, state: r.state, unit: r.unit ?? null, device_class: r.device_class, attributes: {} });
}

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
  /** One control's command state per key (`entityId:control` - power, brightness, position, temp, mode, fan,
   * mute, playpause; each independent so a slider drag never supersedes a button tap on the same entity). */
  @state() private commands: Record<string, CommandState<unknown>> = {};
  /** A cover movement control (open / close / position) armed by a first gesture, expiring if no confirming tap comes. */
  @state() private armed: Record<string, number> = {};
  /** A cover position dragged but not yet confirmed (per `entityId:position`): shown on the slider only, never sent. */
  @state() private drafts: Record<string, number> = {};
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
  private debouncedRange = debouncedCommand<number>();
  /** CR-007 6a: style, density and the sensors card (הגדרות › חשמל והתקנים). */
  @state() private prefs: DevicesPrefs = DEVICES_PREFS_DEFAULT;
  private prefsReady: Promise<void> = Promise.resolve();

  /** CR-007 slice 3: the area's own bulk actions (the same popover as the tree's area tile), for a holder of
   * devices.control_bulk where the server says it would accept them (`can_bulk`); the dialog alone sends. */
  private get bulkAllowed(): boolean {
    return isApi() && canAnywhere('devices.control_bulk') && this.detail?.can_bulk === true;
  }

  private onBulkRequest = (e: CustomEvent<BulkRequest>) => {
    e.stopPropagation();
    void this.renderRoot.querySelector<DevicesBulkDialog>('devices-bulk-dialog')?.show(e.detail);
  };

  static styles = [devicesStyleTokens, css`
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
    /* CR-007 slice 2: single-entity controls */
    .tile.pending,
    .row.pending {
      opacity: 0.7;
    }
    .tile sw-toggle {
      margin-inline-start: auto;
    }
    input[type='range'].ctl-range {
      grid-column: 1 / -1;
      inline-size: 100%;
      accent-color: var(--sw-accent);
      block-size: 20px;
      margin: 2px 0;
    }
    .tile input[type='range'].ctl-range {
      margin-top: 4px;
    }
    .ctl-row {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .ctl-val {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      min-inline-size: 34px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .ctl-select {
      font: inherit;
      font-size: var(--sw-fs-xs);
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      padding: 3px 6px;
    }
    .rollback-note,
    .cmd-status {
      grid-column: 1 / -1;
      font-size: var(--sw-fs-xs);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .rollback-note {
      color: var(--sw-danger);
    }
    .cmd-status.pending {
      color: var(--sw-text);
      background: var(--sw-warning-soft);
      border-radius: var(--sw-r-sm);
      padding: 2px 6px;
      font-weight: var(--sw-fw-medium);
    }
    .cmd-status.pending .dot {
      flex: none;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-warning);
      animation: sw-cmd-pulse 1s ease-in-out infinite;
    }
    .cmd-status.sent {
      color: var(--sw-text-2);
    }
    .cmd-status.confirmed {
      color: var(--sw-text-2);
    }
    .cmd-status.confirmed::before {
      content: '';
      flex: none;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-success);
    }
    @keyframes sw-cmd-pulse {
      50% {
        opacity: 0.3;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .cmd-status.pending .dot {
        animation: none;
      }
    }
    .tile .rollback-note,
    .tile .cmd-status {
      white-space: normal;
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

  // ---------------------------------------------------------------- CR-007 slice 2: single-entity controls

  private setCmd = (key: string, s: CommandState<unknown>) => {
    this.commands = { ...this.commands, [key]: s };
    if (s.phase === 'confirmed' || s.phase === 'sent') window.setTimeout(() => this.clearCmd(key, s), 2500);
    else if (s.phase === 'rolled_back') window.setTimeout(() => this.clearCmd(key, s), 4000);
  };

  /** Only clears the slot if nothing newer took it over in the meantime (a superseded rollback must not erase a
   * fresher pending/confirmed state the user already triggered again). */
  private clearCmd(key: string, was: CommandState<unknown>) {
    if (this.commands[key] === was) {
      const next = { ...this.commands };
      delete next[key];
      this.commands = next;
    }
  }

  private entityCommands(entityId: string): CommandState<unknown>[] {
    return Object.entries(this.commands)
      .filter(([k]) => k.startsWith(`${entityId}:`))
      .map(([, v]) => v);
  }

  private rowPending(entityId: string): boolean {
    return this.entityCommands(entityId).some((v) => v.phase === 'pending');
  }

  /** The value a control shows: the target while its command is pending (or just confirmed, until the refetch lands),
   * otherwise the real one. Only controls read this - the row's own text always shows what HA last reported. */
  private live<T>(entityId: string, control: string): T | undefined {
    const c = this.commands[`${entityId}:${control}`] as CommandState<T> | undefined;
    return c && (c.phase === 'pending' || c.phase === 'confirmed') ? c.optimistic : undefined;
  }

  /** The visible command line under a row: "ממתין לאישור" while pending (never the target as the row's fact), "נשלח"
   * for an action with nothing observable, "אושר" once HA reported the effect, the rollback reason otherwise. */
  private renderCmdStatus(entityId: string) {
    const all = this.entityCommands(entityId);
    const pick = (p: CommandState<unknown>['phase']) => all.find((c) => c.phase === p);
    const pending = pick('pending');
    if (pending) return html`<div class="cmd-status pending" data-cmd-status="pending" role="status"><span class="dot"></span>ממתין לאישור מ־Home Assistant${pending.label ? ` · ${pending.label}` : ''}</div>`;
    const rolled = pick('rolled_back');
    if (rolled) return html`<div class="rollback-note" data-rollback data-cmd-status="rolled_back" role="status">${rolled.label ? `${rolled.label}: ` : ''}${rolled.note}</div>`;
    const sent = pick('sent');
    if (sent) return html`<div class="cmd-status sent" data-cmd-status="sent" role="status">נשלח ל־Home Assistant${sent.label ? ` · ${sent.label}` : ''} · אין דיווח מצב שמאשר את הביצוע</div>`;
    const confirmed = pick('confirmed');
    if (confirmed) return html`<div class="cmd-status confirmed" data-cmd-status="confirmed" role="status">אושר${confirmed.label ? ` · ${confirmed.label}` : ''}</div>`;
    return nothing;
  }

  private isArmed(key: string): boolean {
    const exp = this.armed[key];
    return !!exp && exp > Date.now();
  }

  private disarm(key: string) {
    const next = { ...this.armed };
    delete next[key];
    this.armed = next;
    if (key in this.drafts) {
      const d = { ...this.drafts };
      delete d[key];
      this.drafts = d;
    }
  }

  private arm(key: string) {
    this.armed = { ...this.armed, [key]: Date.now() + ARM_MS };
    window.setTimeout(() => {
      if (this.armed[key] && this.armed[key] <= Date.now()) this.disarm(key);
    }, ARM_MS + 50);
  }

  /** First tap arms a sensitive button (shows "לאשר?" for ARM_MS); the second tap within the window runs it. */
  private tapArmed(key: string, run: () => void) {
    if (this.isArmed(key)) {
      this.disarm(key);
      run();
      return;
    }
    this.arm(key);
  }

  private renderPowerToggle(r: DeviceRow) {
    const key = `${r.entity_id}:power`;
    const pending = this.commands[key]?.phase === 'pending';
    const domain = ['light', 'input_boolean', 'media_player', 'fan'].includes(r.domain) ? r.domain : 'switch';
    const checked = this.live<boolean>(r.entity_id, 'power') ?? r.active;
    const change = (ev: Event) => {
      ev.stopPropagation();
      if (pending) return;
      const next = !checked;
      void runCommand(key, r.domain, r.entity_id, `${domain}.${next ? 'turn_on' : 'turn_off'}`, {}, next, (s) => this.setCmd(key, s), { label: next ? 'הדלקה' : 'כיבוי' });
    };
    return html`<sw-toggle data-control="power" .checked=${checked} ?disabled=${pending} label=${bidi(r.name)} labelHidden @click=${(e: Event) => e.stopPropagation()} @change=${change}></sw-toggle>`;
  }

  private renderBrightnessSlider(r: DeviceRow) {
    const key = `${r.entity_id}:brightness`;
    const value = this.live<number>(r.entity_id, 'brightness') ?? r.brightness_pct ?? 100;
    const onInput = (ev: Event) => {
      const pct = Number((ev.target as HTMLInputElement).value);
      this.debouncedRange(key, 'light', r.entity_id, 'light.turn_on', { brightness_pct: pct }, pct, (s) => this.setCmd(key, s), { label: `בהירות ${pct}%` });
    };
    return html`<input type="range" class="ctl-range" data-control="brightness" min="1" max="100" .value=${String(value)} @input=${onInput} @click=${(e: Event) => e.stopPropagation()} aria-label="בהירות" />`;
  }

  /** Cover movement - open, close or a position - is one physical action whichever control starts it (coordinator
   * ruling, CR-007 s7): all three are "attention" in the allow-list, so each arms on the first gesture (a tap, or
   * the slider's release) and runs on the confirming tap, with confirmation_grant sent. Stop is never gated or
   * disabled: it must work exactly while something moves. */
  private renderCoverControls(r: DeviceRow) {
    const entityId = r.entity_id;
    const openKey = `${entityId}:open`;
    const closeKey = `${entityId}:close`;
    const stopKey = `${entityId}:stop`;
    const posKey = `${entityId}:position`;
    const moving = [openKey, closeKey, posKey].some((k) => this.commands[k]?.phase === 'pending');
    const move = (key: string, actionId: string, args: Record<string, unknown>, target: unknown, label: string) =>
      void runCommand(key, 'cover', entityId, actionId, args, target, (s) => this.setCmd(key, s), { confirmed: true, label });
    const doOpen = () => this.tapArmed(openKey, () => move(openKey, 'cover.open_cover', {}, 'open', 'פתיחה'));
    const doClose = () => this.tapArmed(closeKey, () => move(closeKey, 'cover.close_cover', {}, 'closed', 'סגירה'));
    const doStop = () => {
      // Stop ends the movement: whatever open / close / position is still awaiting its confirmation is superseded at
      // once (its late outcome is dropped, no "not confirmed in time" note follows) and the controls come back now
      const next = { ...this.commands };
      for (const k of [openKey, closeKey, posKey]) {
        supersede(k);
        delete next[k];
        if (k in this.armed || k in this.drafts) this.disarm(k);
      }
      this.commands = next;
      void runCommand(stopKey, 'cover', entityId, 'cover.stop_cover', {}, 'stopped', (s) => this.setCmd(stopKey, s), { label: 'עצירה' });
    };
    const draft = this.drafts[posKey];
    const armedPos = this.isArmed(posKey) && draft !== undefined;
    const posValue = draft ?? this.live<number>(entityId, 'position') ?? r.position ?? 0;
    const onPosInput = (ev: Event) => {
      this.drafts = { ...this.drafts, [posKey]: Number((ev.target as HTMLInputElement).value) }; // local only: nothing is sent while dragging
    };
    const onPosRelease = (ev: Event) => {
      this.drafts = { ...this.drafts, [posKey]: Number((ev.target as HTMLInputElement).value) };
      this.arm(posKey);
    };
    const confirmPos = () => {
      const pct = this.drafts[posKey];
      if (pct === undefined || !this.isArmed(posKey)) return;
      this.disarm(posKey);
      move(posKey, 'cover.set_cover_position', { position: pct }, pct, `מיקום ${pct}%`);
    };
    // CR-007 slice 4: tilt - open/close/stop/position, the same arm-then-confirm pattern (one physical movement
    // whichever control starts it), independent of the top position/open/close (a device may decouple the two axes)
    const openTiltKey = `${entityId}:open-tilt`;
    const closeTiltKey = `${entityId}:close-tilt`;
    const stopTiltKey = `${entityId}:stop-tilt`;
    const tiltPosKey = `${entityId}:tilt-position`;
    const tiltMoving = [openTiltKey, closeTiltKey, tiltPosKey].some((k) => this.commands[k]?.phase === 'pending');
    const moveTilt = (key: string, actionId: string, args: Record<string, unknown>, target: unknown, label: string) =>
      void runCommand(key, 'cover', entityId, actionId, args, target, (s) => this.setCmd(key, s), { confirmed: true, label });
    const doOpenTilt = () => this.tapArmed(openTiltKey, () => moveTilt(openTiltKey, 'cover.open_cover_tilt', {}, 'open', 'פתיחת הטיה'));
    const doCloseTilt = () => this.tapArmed(closeTiltKey, () => moveTilt(closeTiltKey, 'cover.close_cover_tilt', {}, 'closed', 'סגירת הטיה'));
    const doStopTilt = () => {
      const next = { ...this.commands };
      for (const k of [openTiltKey, closeTiltKey, tiltPosKey]) {
        supersede(k);
        delete next[k];
        if (k in this.armed || k in this.drafts) this.disarm(k);
      }
      this.commands = next;
      void runCommand(stopTiltKey, 'cover', entityId, 'cover.stop_cover_tilt', {}, 'stopped', (s) => this.setCmd(stopTiltKey, s), { label: 'עצירת הטיה' });
    };
    const tiltDraft = this.drafts[tiltPosKey];
    const armedTiltPos = this.isArmed(tiltPosKey) && tiltDraft !== undefined;
    const tiltValue = tiltDraft ?? this.live<number>(entityId, 'tilt-position') ?? r.tilt ?? 0;
    const onTiltInput = (ev: Event) => {
      this.drafts = { ...this.drafts, [tiltPosKey]: Number((ev.target as HTMLInputElement).value) };
    };
    const onTiltRelease = (ev: Event) => {
      this.drafts = { ...this.drafts, [tiltPosKey]: Number((ev.target as HTMLInputElement).value) };
      this.arm(tiltPosKey);
    };
    const confirmTiltPos = () => {
      const pct = this.drafts[tiltPosKey];
      if (pct === undefined || !this.isArmed(tiltPosKey)) return;
      this.disarm(tiltPosKey);
      moveTilt(tiltPosKey, 'cover.set_cover_tilt_position', { tilt_position: pct }, pct, `מיקום הטיה ${pct}%`);
    };
    return html`<div class="ctl-row" data-control="cover">
        <sw-button size="sm" ?disabled=${moving} data-control="open" @click=${doOpen}>${this.isArmed(openKey) ? 'לאשר פתיחה?' : 'פתיחה'}</sw-button>
        <sw-button size="sm" data-control="stop" @click=${doStop}>עצירה</sw-button>
        <sw-button size="sm" ?disabled=${moving} data-control="close" @click=${doClose}>${this.isArmed(closeKey) ? 'לאשר סגירה?' : 'סגירה'}</sw-button>
        ${r.position !== null && r.position !== undefined
          ? html`<input type="range" class="ctl-range" data-control="position" min="0" max="100" ?disabled=${moving} .value=${String(posValue)} @input=${onPosInput} @change=${onPosRelease} aria-label="מיקום התריס" />
              ${armedPos ? html`<sw-button size="sm" variant="primary" data-control="position-confirm" @click=${confirmPos}>${`לאשר מיקום ${draft}%?`}</sw-button>` : nothing}`
          : nothing}
      </div>
      ${r.tilt !== null && r.tilt !== undefined
        ? html`<div class="ctl-row" data-control="cover-tilt">
            <sw-button size="sm" ?disabled=${tiltMoving} data-control="open-tilt" @click=${doOpenTilt}>${this.isArmed(openTiltKey) ? 'לאשר פתיחת הטיה?' : 'פתיחת הטיה'}</sw-button>
            <sw-button size="sm" data-control="stop-tilt" @click=${doStopTilt}>עצירת הטיה</sw-button>
            <sw-button size="sm" ?disabled=${tiltMoving} data-control="close-tilt" @click=${doCloseTilt}>${this.isArmed(closeTiltKey) ? 'לאשר סגירת הטיה?' : 'סגירת הטיה'}</sw-button>
            <input type="range" class="ctl-range" data-control="tilt-position" min="0" max="100" ?disabled=${tiltMoving} .value=${String(tiltValue)} @input=${onTiltInput} @change=${onTiltRelease} aria-label="מיקום הטיה" />
            ${armedTiltPos ? html`<sw-button size="sm" variant="primary" data-control="tilt-position-confirm" @click=${confirmTiltPos}>${`לאשר הטיה ${tiltDraft}%?`}</sw-button>` : nothing}
          </div>`
        : nothing}`;
  }

  private renderClimateControls(r: DeviceRow) {
    const entityId = r.entity_id;
    if (r.domain === 'climate') {
      const tempKey = `${entityId}:temp`;
      const min = Math.max(5, r.min_temp ?? 5);
      const max = Math.min(35, r.max_temp ?? 35);
      const step = r.target_temp_step && r.target_temp_step > 0 ? r.target_temp_step : 0.5;
      const reported = r.target_temperature;
      const target = this.live<number>(entityId, 'temp') ?? reported;
      const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 10) / 10));
      const setTemp = (next: number) => this.debouncedRange(tempKey, 'climate', entityId, 'climate.set_temperature', { temperature: next }, next, (s) => this.setCmd(tempKey, s), { label: `טמפרטורת יעד ${next}°` });
      const modeKey = `${entityId}:mode`;
      const modePending = this.commands[modeKey]?.phase === 'pending';
      const modes = (r.hvac_modes ?? []).filter((m) => HVAC_SELECTABLE.includes(m));
      const mode = this.live<string>(entityId, 'mode') ?? r.hvac_mode ?? '';
      const changeMode = (ev: Event) => {
        const v = (ev.target as HTMLSelectElement).value;
        const label = `מצב ${HVAC_HE[v] ?? v}`;
        if (v === 'off') void runCommand(modeKey, 'climate', entityId, 'climate.turn_off', {}, 'off', (s) => this.setCmd(modeKey, s), { label });
        else void runCommand(modeKey, 'climate', entityId, 'climate.set_hvac_mode', { hvac_mode: v }, v, (s) => this.setCmd(modeKey, s), { label });
      };
      const fanKey = `${entityId}:fan`;
      const fanPending = this.commands[fanKey]?.phase === 'pending';
      const fanModes = r.fan_modes ?? [];
      const fan = this.live<string>(entityId, 'fan') ?? r.fan_mode ?? '';
      const changeFan = (ev: Event) => {
        const v = (ev.target as HTMLSelectElement).value;
        if (v) void runCommand(fanKey, 'climate', entityId, 'climate.set_fan_mode', { fan_mode: v }, v, (s) => this.setCmd(fanKey, s), { label: `מאוורר ${v}` });
      };
      // CR-007 slice 4: preset / swing - only the modes this entity itself reports
      const presetKey = `${entityId}:preset`;
      const presetPending = this.commands[presetKey]?.phase === 'pending';
      const presetModes = r.preset_modes ?? [];
      const preset = this.live<string>(entityId, 'preset') ?? r.preset_mode ?? '';
      const changePreset = (ev: Event) => {
        const v = (ev.target as HTMLSelectElement).value;
        if (v) void runCommand(presetKey, 'climate', entityId, 'climate.set_preset_mode', { preset_mode: v }, v, (s) => this.setCmd(presetKey, s), { label: `מצב מוגדר ${v}` });
      };
      const swingKey = `${entityId}:swing`;
      const swingPending = this.commands[swingKey]?.phase === 'pending';
      const swingModes = r.swing_modes ?? [];
      const swing = this.live<string>(entityId, 'swing') ?? r.swing_mode ?? '';
      const changeSwing = (ev: Event) => {
        const v = (ev.target as HTMLSelectElement).value;
        if (v) void runCommand(swingKey, 'climate', entityId, 'climate.set_swing_mode', { swing_mode: v }, v, (s) => this.setCmd(swingKey, s), { label: `נדנוד ${v}` });
      };
      // CR-007 slice 4: a climate entity's own target humidity (separate from a humidifier's) - only when it reports one
      const humKey = `${entityId}:humidity`;
      const humMin = r.min_humidity ?? 0;
      const humMax = r.max_humidity ?? 100;
      const humidity = this.live<number>(entityId, 'humidity') ?? r.target_humidity;
      const setHumidity = (next: number) => void runCommand(humKey, 'climate', entityId, 'climate.set_humidity', { humidity: next }, next, (s) => this.setCmd(humKey, s), { label: `לחות יעד ${next}%` });
      return html`<div class="ctl-row" data-control="climate">
        ${target !== null && target !== undefined
          ? html`<sw-button size="sm" iconOnly icon="minus" label="הורדת טמפרטורה" data-control="temp-down" ?disabled=${target <= min} @click=${() => setTemp(clamp(target - step))}></sw-button>
              <span class="ctl-val" data-control="temp-value">${deg(target)}</span>
              <sw-button size="sm" iconOnly icon="plus" label="העלאת טמפרטורה" data-control="temp-up" ?disabled=${target >= max} @click=${() => setTemp(clamp(target + step))}></sw-button>`
          : nothing}
        ${modes.length
          ? html`<select class="ctl-select" data-control="mode" aria-label="מצב פעולה" ?disabled=${modePending} @change=${changeMode}>
              ${modes.includes(mode) ? nothing : html`<option value="" selected disabled>${HVAC_HE[mode] ?? (mode || 'מצב')}</option>`}
              ${modes.map((m) => html`<option value=${m} ?selected=${m === mode}>${HVAC_HE[m] ?? m}</option>`)}
            </select>`
          : nothing}
        ${fanModes.length
          ? html`<select class="ctl-select" data-control="fan-mode" aria-label="מצב מאוורר" ?disabled=${fanPending} @change=${changeFan}>
              ${fanModes.includes(fan) ? nothing : html`<option value="" selected disabled>${fan || 'מאוורר'}</option>`}
              ${fanModes.map((m) => html`<option value=${m} ?selected=${m === fan}>${m}</option>`)}
            </select>`
          : nothing}
        ${presetModes.length
          ? html`<select class="ctl-select" data-control="preset-mode" aria-label="מצב מוגדר מראש" ?disabled=${presetPending} @change=${changePreset}>
              ${presetModes.includes(preset) ? nothing : html`<option value="" selected disabled>${preset || 'מצב מוגדר'}</option>`}
              ${presetModes.map((m) => html`<option value=${m} ?selected=${m === preset}>${m}</option>`)}
            </select>`
          : nothing}
        ${swingModes.length
          ? html`<select class="ctl-select" data-control="swing-mode" aria-label="מצב נדנוד" ?disabled=${swingPending} @change=${changeSwing}>
              ${swingModes.includes(swing) ? nothing : html`<option value="" selected disabled>${swing || 'נדנוד'}</option>`}
              ${swingModes.map((m) => html`<option value=${m} ?selected=${m === swing}>${m}</option>`)}
            </select>`
          : nothing}
        ${humidity !== null && humidity !== undefined
          ? html`<sw-button size="sm" iconOnly icon="minus" label="הפחתת לחות יעד" data-control="humidity-down" ?disabled=${humidity <= humMin} @click=${() => setHumidity(Math.max(humMin, humidity - 5))}></sw-button>
              <span class="ctl-val" data-control="humidity-value">${ltrNum(humidity)}%</span>
              <sw-button size="sm" iconOnly icon="plus" label="הגברת לחות יעד" data-control="humidity-up" ?disabled=${humidity >= humMax} @click=${() => setHumidity(Math.min(humMax, humidity + 5))}></sw-button>`
          : nothing}
      </div>`;
    }
    if (r.domain === 'fan') {
      const pctKey = `${entityId}:percentage`;
      const value = this.live<number>(entityId, 'percentage') ?? r.percentage ?? 0;
      const setPct = (ev: Event) => {
        const v = Number((ev.target as HTMLInputElement).value);
        this.debouncedRange(pctKey, 'fan', entityId, 'fan.set_percentage', { percentage: v }, v, (s) => this.setCmd(pctKey, s), { label: `עוצמה ${v}%` });
      };
      return html`<div class="ctl-row" data-control="fan">
        ${this.renderPowerToggle(r)}
        <input type="range" class="ctl-range" data-control="percentage" min="0" max="100" .value=${String(value)} @input=${setPct} aria-label="עוצמת מאוורר" />
      </div>`;
    }
    // CR-007 slice 4: humidifier - its own mode list and target humidity (turn_on/off is not in the allow-list;
    // the row's own badge already shows on/off from the state HA reports)
    const modeKeyH = `${entityId}:mode`;
    const modePendingH = this.commands[modeKeyH]?.phase === 'pending';
    const modesH = r.available_modes ?? [];
    const modeH = this.live<string>(entityId, 'mode') ?? r.mode ?? '';
    const changeModeH = (ev: Event) => {
      const v = (ev.target as HTMLSelectElement).value;
      if (v) void runCommand(modeKeyH, 'humidifier', entityId, 'humidifier.set_mode', { mode: v }, v, (s) => this.setCmd(modeKeyH, s), { label: `מצב ${v}` });
    };
    const humKeyH = `${entityId}:humidity`;
    const humMinH = r.min_humidity ?? 0;
    const humMaxH = r.max_humidity ?? 100;
    const humidityH = this.live<number>(entityId, 'humidity') ?? r.target_humidity;
    const setHumidityH = (next: number) => void runCommand(humKeyH, 'humidifier', entityId, 'humidifier.set_humidity', { humidity: next }, next, (s) => this.setCmd(humKeyH, s), { label: `לחות יעד ${next}%` });
    return html`<div class="ctl-row" data-control="humidifier">
      ${modesH.length
        ? html`<select class="ctl-select" data-control="mode" aria-label="מצב לחות" ?disabled=${modePendingH} @change=${changeModeH}>
            ${modesH.includes(modeH) ? nothing : html`<option value="" selected disabled>${modeH || 'מצב'}</option>`}
            ${modesH.map((m) => html`<option value=${m} ?selected=${m === modeH}>${m}</option>`)}
          </select>`
        : nothing}
      ${humidityH !== null && humidityH !== undefined
        ? html`<sw-button size="sm" iconOnly icon="minus" label="הפחתת לחות יעד" data-control="humidity-down" ?disabled=${humidityH <= humMinH} @click=${() => setHumidityH(Math.max(humMinH, humidityH - 5))}></sw-button>
            <span class="ctl-val" data-control="humidity-value">${ltrNum(humidityH)}%</span>
            <sw-button size="sm" iconOnly icon="plus" label="הגברת לחות יעד" data-control="humidity-up" ?disabled=${humidityH >= humMaxH} @click=${() => setHumidityH(Math.min(humMaxH, humidityH + 5))}></sw-button>`
        : nothing}
    </div>`;
  }

  private renderMediaControls(r: DeviceRow) {
    const entityId = r.entity_id;
    const muteKey = `${entityId}:mute`;
    const ppKey = `${entityId}:playpause`;
    const muted = this.live<boolean>(entityId, 'mute') ?? Boolean(r.muted);
    const toggleMute = () =>
      void runCommand(muteKey, 'media_player', entityId, 'media_player.volume_mute', { is_volume_muted: !muted }, !muted, (s) => this.setCmd(muteKey, s), { label: muted ? 'ביטול השתקה' : 'השתקה' });
    const playing = (this.live<string>(entityId, 'playpause') ?? r.state) === 'playing';
    // media_play / media_pause (not play_pause): each has a state Home Assistant reports, so it can be confirmed
    const playPause = () =>
      void runCommand(ppKey, 'media_player', entityId, playing ? 'media_player.media_pause' : 'media_player.media_play', {}, playing ? 'paused' : 'playing', (s) => this.setCmd(ppKey, s), { label: playing ? 'השהיה' : 'ניגון' });
    return html`<div class="ctl-row" data-control="media">
      ${this.renderPowerToggle(r)}
      <sw-button size="sm" icon=${playing ? 'pause' : 'play'} iconOnly label=${playing ? 'השהה' : 'נגן'} data-control="playpause" ?disabled=${this.commands[ppKey]?.phase === 'pending'} @click=${playPause}></sw-button>
      <sw-button size="sm" icon="volume" iconOnly label=${muted ? 'בטל השתקה' : 'השתקה'} data-control="mute" ?disabled=${this.commands[muteKey]?.phase === 'pending'} @click=${toggleMute}></sw-button>
    </div>`;
  }

  render() {
    const heading = 'חשמל והתקנים';
    if (!isApi()) {
      return html`<sw-page heading="אזור" subheading="חשמל והתקנים · נתוני הדגמה" backHref="/devices/building" crumbs=${`${heading} | אזור`}><sw-state-panel state="empty" heading="מסך האזור עובד מול השרת" hint="במצב הדגמה אין אזורים של Home Assistant להצגה; עץ המבנה מציג נתוני הדגמה."></sw-state-panel></sw-page>`;
    }
    if (this.forbidden) {
      return html`<sw-page heading=${heading} subheading="אזור" backHref="/devices/building"><sw-state-panel data-devices-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בחשמל והתקנים" hint="נדרשת ההרשאה צפייה בחשמל והתקנים. פנה למנהל המערכת."></sw-state-panel></sw-page>`;
    }
    if (this.notFound) {
      return html`<sw-page heading=${heading} subheading="אזור" backHref="/devices/building" crumbs=${`${heading} | אזור`}><sw-state-panel data-devices-state="not_found" state="empty" heading="האזור לא נמצא" hint="האזור אינו קיים ב־Home Assistant, או שאין בו התקנים שבהרשאתך."></sw-state-panel></sw-page>`;
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
    const filled = cards.filter((c) => c.count > 0);
    const empty = cards.filter((c) => c.count === 0);
    const anyControllable = cards.some((c) => c.entities.some((r) => r.can_control));
    const bulk = this.bulkAllowed;
    return html`<sw-page heading=${bidi(d.area.name)} subheading=${sub} backHref="/devices/building" crumbs=${crumbs} wide @bulk-request=${this.onBulkRequest}>
      <div slot="actions">
        ${bulk ? html`<devices-bulk-menu scope="area" .targetId=${d.area.area_id} .targetName=${d.area.name} .counts=${d.counts} variant="popover" label="פעולות לאזור" data-bulk-area=${d.area.area_id}></devices-bulk-menu>` : nothing}
        ${d.counts.alarm ? html`<sw-badge data-area-alarm kind=${alarmTone(d.counts.alarm)} label=${`אזעקה: ${ALARM_HE[d.counts.alarm] ?? d.counts.alarm}`}></sw-badge>` : nothing}
        <sw-badge data-devices-sync kind=${connected ? 'live' : 'stale'} label=${connected ? 'מסונכרן עם Home Assistant' : 'לא מסונכרן עם Home Assistant'}></sw-badge>
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
      <div class="grid">
        ${repeat([...filled, ...empty], (c) => c.id, (c) => this.renderCard(c))}
      </div>
      <div class="note">
        ${anyControllable
          ? 'הקשה על מתג, כפתור או החלקה לשליטה בהתקן. המצב המוצג בשורה הוא תמיד מה ש־Home Assistant דיווח; פקודה שנשלחה מסומנת "ממתין לאישור" עד שהדיווח מגיע, ומתבטלת אם הוא לא מגיע בזמן. תנועת תריס (פתיחה, סגירה או מיקום) דורשת הקשת אישור נוספת.'
          : 'תצוגה לקריאה בלבד: מצב ההתקנים כפי ש־Home Assistant מדווח אותו.'}
      </div>
      ${bulk ? html`<devices-bulk-dialog @bulk-done=${() => void this.load()}></devices-bulk-dialog>` : nothing}
      ${this.canAssignArea ? this.renderAssignDialog() : nothing}
    </sw-page>`;
  }

  private renderCard(c: DeviceCard) {
    const e = CARD_EMPTY[c.id];
    return html`<sw-card data-card=${c.id} ?data-empty=${c.count === 0} heading=${c.label} subheading=${c.count ? `${c.count} התקנים${c.id === 'lighting' || c.id === 'switches' || c.id === 'climate' || c.id === 'covers' || c.id === 'media' ? ` · ${c.active} פעילים` : ''}` : ''}>
      <sw-icon slot="actions" .name=${CARD_ICON[c.id]} size=${18}></sw-icon>
      ${c.count === 0
        ? html`<sw-state-panel compact data-card-empty state="empty" heading=${e.heading} hint=${e.hint}></sw-state-panel>`
        : c.id === 'sensors'
          ? this.renderSensorGroups(c.entities)
          : c.id === 'lighting' || c.id === 'switches'
            ? html`<div class="tiles">${repeat(c.entities, (r) => r.entity_id, (r) => this.renderTile(r, c.id))}</div>`
            : html`${c.id === 'covers' ? this.renderCoverGroupControl() : nothing}<div class="rows">${repeat(c.entities, (r) => r.entity_id, (r) => this.renderRow(r, c.id))}</div>`}
    </sw-card>`;
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
    return html`<div class=${classMap({ tile: true, on, off: !on && !unavailable, unavailable, pending: controllable && this.rowPending(r.entity_id) })} data-entity=${r.entity_id} data-active=${String(on)} ?data-can-control=${controllable} title=${r.entity_id}>
      <div class="t"><sw-icon .name=${icon} size=${15}></sw-icon><span>${bidi(r.name)}</span>${controllable ? this.renderPowerToggle(r) : nothing}</div>
      <div class="s">${unavailable ? 'לא זמין' : value}</div>
      ${card === 'sensors' && r.last_changed ? html`<div class="lc" data-last-changed>${fmtTime(r.last_changed)}</div>` : nothing}
      ${controllable && card === 'lighting' && (on || this.live<boolean>(r.entity_id, 'power') === true) ? this.renderBrightnessSlider(r) : nothing}
      ${controllable ? this.renderCmdStatus(r.entity_id) : nothing}
      ${card === 'switches' && r.bulk_reason ? this.renderBulkSafe(r) : nothing}
      ${this.renderAssignButton(r)}
    </div>`;
  }

  /** CR-007 slice 3, review rounds 1-2: a switch enters a bulk action only when an administrator marked it safe (a
   * door / gate release relay is a switch too); a lighting circuit's switch only gets the suggestion. Shown to a bulk
   * holder; the mark is set here with system.configure. */
  private renderBulkSafe(r: DeviceRow) {
    const label =
      r.bulk_reason === 'marked'
        ? 'נכלל בכיבוי מרוכז (סומן כבטוח)'
        : r.bulk_reason === 'circuit_not_marked'
          ? 'לא נכלל בכיבוי מרוכז · מפסק של מעגל תאורה - מומלץ לסמן כבטוח'
          : r.bulk_reason === 'doors_layer'
            ? 'לא נכלל בכיבוי מרוכז (שכבת הדלתות)'
            : 'לא נכלל בכיבוי מרוכז (לא סומן כבטוח לכיבוי קבוצתי)';
    const canToggle = this.detail?.can_mark_bulk_safe === true && r.bulk_reason !== 'doors_layer';
    return html`<div class="bulk-safe" data-bulk-safe=${r.bulk_reason ?? ''}>
      ${label}${canToggle
        ? html` <sw-button size="sm" variant="ghost" data-bulk-safe-toggle title="סמנו רק מתג שאינו שחרור דלת / שער ושבטוח לכבות יחד עם התאורה" @click=${() => void this.toggleBulkSafe(r)}>${r.bulk_reason === 'marked' ? 'בטל סימון' : 'סמן כבטוח לכיבוי מרוכז'}</sw-button>`
        : nothing}
    </div>`;
  }

  private async toggleBulkSafe(r: DeviceRow) {
    try {
      await put(`devices/entities/${encodeURIComponent(r.entity_id)}/bulk-safe`, { bulk_safe: r.bulk_reason !== 'marked' });
    } catch (err) {
      this.error = describeError(err);
    }
    void this.load();
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
    const pendingCls = controllable && this.rowPending(r.entity_id);
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
        ${controllable ? this.renderClimateControls(r) : nothing}
        ${controllable ? this.renderCmdStatus(r.entity_id) : nothing}
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
        ${controllable ? this.renderCoverControls(r) : nothing}
        ${controllable ? this.renderCmdStatus(r.entity_id) : nothing}
        ${this.renderAssignButton(r)}
      </div>`;
    }
    if (card === 'security') {
      let badge: { kind: StateKind; label: string };
      if (unavailable) badge = { kind: 'offline', label: 'לא זמין' };
      else if (r.kind === 'lock') badge = r.locked ? { kind: 'live', label: 'נעול' } : { kind: 'stale', label: rowLabel(r) };
      else if (r.kind === 'alarm') badge = { kind: alarmTone(r.state), label: rowLabel(r) };
      else if (r.kind === 'camera') badge = { kind: 'neutral', label: 'מצלמת HA' };
      else badge = { kind: r.state === 'on' ? 'stale' : 'neutral', label: rowLabel(r) };
      const kindIcon: IconName = r.kind === 'lock' ? (r.locked ? 'lock' : 'unlock') : r.kind === 'alarm' ? 'shield' : r.kind === 'camera' ? 'camera' : 'sensor';
      return html`<div class=${classMap({ row: true, unavailable })} data-entity=${r.entity_id} data-kind=${r.kind ?? ''} title=${r.entity_id}>
        <span class="n"><sw-icon .name=${kindIcon} size=${14}></sw-icon> ${bidi(r.name)}</span>
        <sw-badge kind=${badge.kind} label=${badge.label}></sw-badge>
        ${r.kind === 'camera' ? html`<div class="d"><span>אין תמונה ממצלמת Home Assistant במסך הזה עדיין; מצלמות ה־NVR מוצגות ב"מצלמות".</span></div>` : nothing}
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
      ${controllable ? this.renderMediaControls(r) : nothing}
      ${controllable ? this.renderCmdStatus(r.entity_id) : nothing}
      ${this.renderAssignButton(r)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-area': DevicesArea;
  }
}
