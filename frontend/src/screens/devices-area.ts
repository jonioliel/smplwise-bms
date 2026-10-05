import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import './devices-area-nav';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-chip';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-dialog';
import './devices-media-card';
import type { StateKind } from '../components/sw-badge';
import type { IconName } from '../components/sw-icon';
import { can, canAnywhere, isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import { fmtTime, subscribeHa, type HaSyncState } from '../api/ha';
import { productSettings } from '../api/prefs';
import { ALARM_HE, assignEntityArea, CARD_EMPTY, CARD_IDS, HVAC_ACTION_HE, getDevicesArea, getDevicesTree, getEntityRows, type CardId, type DeviceAreaDetail, type DeviceCard, type DeviceRow, type DeviceTree, type EntityRow } from '../api/devices';
import { AREA_DESIGN_KEY, AREA_DESIGN_LABEL, AREA_DESIGNS, mainSlotOf, mainStrip, PERSONALIZE_PERMISSION, resolveAreaDesign, SECTION_BULK, type AreaDesign, type BulkLook } from './devices-area-design';
import type { BulkKind } from '../api/device-bulk';
import { alarmTone, REFRESH_WINDOW_MS, STRUCTURE_FLASH_MS } from './devices-building';
import './devices-bulk';
import './devices-camera-card';
import type { BulkRequest, DevicesBulkDialog } from './devices-bulk';
import { bidi, ltrNum } from '../i18n/bidi';
import { applyDevicesPrefs, DEVICES_PREFS_DEFAULT, devicesStyleTokens, loadDevicesPrefs, type DevicesPrefs } from './devices-style';
import { isCameraSource } from '../api/camera-card';
import { DevicesLayoutController, shownEntities, TILE_COLS, titleOf, type MeasuredGrid, type TileEntry } from './devices-layout';
import { CARD_TYPES, isCardType, type AreaEntity } from './devices-layout-cards';
import { activityTag, ActivityPress } from '../components/device-activity-press';
import { ifDefined } from 'lit/directives/if-defined.js';
import { deg, DeviceControls, deviceControlStyles, rowLabel } from './devices-controls';
import { SkinController, hueOf } from '../design/skin';
import { bubbleAreaStyles, renderBubblePill, renderBubbleSensorTile, renderBubbleSep, renderBubbleSheetBody, sectionIcon } from './devices-area-bubble';
import { mapHrefForArea } from '../api/plan-links';
import './explore-floor-map';

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

const CARD_ICON: Record<CardId, IconName> = { lighting: 'light', switches: 'bolt', climate: 'activity', heating: 'activity', covers: 'layers', security: 'shield', media: 'play', sensors: 'sensor' };

/** Owner decisions 2026-09-30 (area redesign; mockup docs/design/mockups/home/index.html): the two directions of the automatic
 * layout - "tiles" (section cards in columns, dense tiles) and "sections" (one section after the other, title at the side, the
 * sensors beside them) - the security strip, the main sensors strip and the sections' bulk button. A stored layout (the grid)
 * still wins: every rule here is for `.grid:not(.lay-grid)` or for the elements themselves. Declared after the glass rules. */
const AREA_DESIGN = css`
  /* a tighter page: the header, the room tabs, the security strip and the sections sit closer */
  sw-page {
    gap: 8px;
  }
  .sec-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    padding: 8px 12px;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    background: var(--sw-surface);
    box-shadow: var(--sw-shadow-1);
  }
  .sec-lbl {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-inline-end: 6px;
    color: var(--sw-accent);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
  }
  .sec-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border: 1px solid var(--sw-border);
    border-radius: 999px;
    background: var(--sw-surface);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
    text-decoration: none;
    white-space: nowrap;
  }
  .sec-chip b {
    color: var(--sw-text);
    font-weight: var(--sw-fw-medium);
  }
  .sec-chip.ok span {
    color: var(--sw-success, #16a34a);
    font-weight: var(--sw-fw-medium);
  }
  .sec-chip.warn span {
    color: var(--sw-warning);
    font-weight: var(--sw-fw-medium);
  }
  .sec-chip.bad span {
    color: var(--sw-danger);
    font-weight: var(--sw-fw-semibold);
  }
  .sec-chip.off {
    opacity: 0.6;
  }
  a.sec-chip:hover {
    border-color: var(--sw-border-strong);
  }
  /* the main sensors strip and its fold */
  .main-sensors {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .msens {
    display: flex;
    align-items: center;
    gap: 8px;
    min-inline-size: 0;
    padding: 6px 10px;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
  }
  .msens sw-icon {
    flex: none;
    color: var(--sw-accent);
  }
  .msens.hot {
    background: var(--sw-warning-soft);
    border-color: color-mix(in srgb, var(--sw-warning) 40%, var(--sw-border));
  }
  .msens.unavailable {
    opacity: 0.6;
  }
  .msens .mv {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    line-height: 1.2;
  }
  .msens .mv b {
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-semibold);
    font-variant-numeric: tabular-nums;
  }
  .msens .mv span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  .more-sens {
    inline-size: 100%;
    margin-block-start: 6px;
    padding: 5px 10px;
    border: 1px dashed var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: transparent;
    color: var(--sw-accent);
    font: inherit;
    font-size: var(--sw-fs-xs);
    cursor: pointer;
  }
  .more-sens + .sensor-groups {
    margin-block-start: 8px;
  }
  .sec-bulk {
    display: inline-flex;
    gap: 6px;
  }
  .design-personal label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
  }
  .design-personal select {
    font: inherit;
    font-size: var(--sw-fs-xs);
    padding: 3px 6px;
    border: 1px solid var(--sw-border-strong);
    border-radius: 7px;
    background: var(--sw-surface);
    color: var(--sw-text);
  }
  /* dense tiles: icon, name and state on the start side, the switch at the end - one short row; a slider or a status line
     takes the whole row under it */
  .tile {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas: 'ic nm tg' 'ic st tg';
    column-gap: 8px;
    row-gap: 0;
    align-items: center;
    padding: 6px 9px;
  }
  .tile .t {
    display: contents;
  }
  .tile .t > sw-icon {
    grid-area: ic;
  }
  .tile .t > span {
    grid-area: nm;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--sw-fw-medium);
    font-size: var(--sw-fs-sm);
  }
  .tile .t > sw-toggle {
    grid-area: tg;
    margin-inline-start: 0;
  }
  .tile .s {
    grid-area: st;
  }
  .tile > :not(.t):not(.s) {
    grid-column: 1 / -1;
  }
  .rows {
    gap: 4px;
  }
  .row {
    padding: 6px 9px;
    row-gap: 2px;
  }
  .row .v.big {
    font-size: var(--sw-fs-lg);
  }
  .tiles {
    gap: 6px;
  }
  /* compact controls: the buttons and the slider share one line; a brightness slider is a thin line under its tile */
  .ctl-row {
    gap: 4px;
  }
  .ctl-row input[type='range'].ctl-range {
    flex: 1 1 90px;
    inline-size: auto;
    min-inline-size: 90px;
    margin: 0;
  }
  .tile input[type='range'].ctl-range {
    margin: 0;
    block-size: 14px;
  }
  .row .d {
    gap: 4px 8px;
  }
  /* the section's header has "פתח" / "סגור" now (with the confirmation): the group control keeps only what it adds -
     stop all and the position for all - on one short line */
  :host([data-area-design]) .grid:not(.lay-grid) .cover-group {
    padding: 4px 8px;
    margin-block-end: 4px;
  }
  :host([data-area-design]) .grid:not(.lay-grid) .cover-group .lbl,
  :host([data-area-design]) .grid:not(.lay-grid) .cover-group [data-cover-group-kind='covers_open'],
  :host([data-area-design]) .grid:not(.lay-grid) .cover-group [data-cover-group-kind='covers_close'] {
    display: none;
  }
  /* tiles: section cards flow in columns (top to bottom, then the next column) */
  :host([data-area-design='tiles']) .grid:not(.lay-grid) {
    display: block;
    column-width: 360px;
    column-gap: 10px;
  }
  /* the dense direction: a position bar repeats what the slider under it already shows */
  :host([data-area-design]) .grid:not(.lay-grid) .row .bar {
    display: none;
  }
  :host([data-area-design='tiles']) .grid:not(.lay-grid) > sw-card {
    display: block;
    break-inside: avoid;
    margin-block-end: 10px;
    padding: 10px 12px;
  }
  :host([data-area-design='tiles']) .grid:not(.lay-grid) > sw-card > header {
    margin-block-end: 8px;
  }
  /* sections: one section after the other, its title at the side; the sensors card stands beside them */
  :host([data-area-design='sections']) .grid:not(.lay-grid) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 264px;
    grid-auto-flow: row dense;
    gap: 8px 12px;
    align-items: start;
  }
  :host([data-area-design='sections']) .grid:not(.lay-grid) > sw-card {
    grid-column: 1;
    padding: 10px 14px;
  }
  :host([data-area-design='sections']) .grid:not(.lay-grid) > sw-card[data-card='sensors'],
  :host([data-area-design='sections']) .grid:not(.lay-grid) > sw-card[data-card='media'] {
    grid-column: 2;
    grid-row: span 2;
    display: block;
  }
  :host([data-area-design='sections']) .grid:not(.lay-grid) > sw-card:not([data-card='sensors']) .tiles {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }
  :host([data-area-design='sections']) .grid:not(.lay-grid) > sw-card:not([data-card='sensors']):not([data-card='media']) .rows {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
    gap: 6px;
  }
  :host([data-area-design='sections']) .grid:not(.lay-grid) > sw-card .cover-group {
    grid-column: 1 / -1;
  }
  /* a phone: one column of folding sections */
  @media (max-width: 599px) {
    :host([data-area-design]) .grid:not(.lay-grid) {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    :host([data-area-design]) .grid:not(.lay-grid) > sw-card {
      display: block;
      grid-column: auto;
      grid-row: auto;
      margin: 0;
      padding: 10px 12px;
    }
    :host([data-area-design]) .grid:not(.lay-grid) > sw-card .tiles {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    :host([data-area-design]) .grid:not(.lay-grid) > sw-card .rows {
      display: flex;
    }
  }
`;

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
  /** CR-032: long press / menu item / Alt+Enter on a tile the server flagged `activity` opens the device activity popup (components/device-activity.ts). */
  private press = new ActivityPress(this, { area: () => this.detail?.area.name ?? '' });
  /** CR-007 6a: style, density and the sensors card (הגדרות › חשמל והתקנים). */
  @state() private prefs: DevicesPrefs = DEVICES_PREFS_DEFAULT;
  private prefsReady: Promise<void> = Promise.resolve();
  /** Owner decisions 2026-09-30 (area redesign): the direction in force (the installation's `devices.area_design`, or a
   * personaliser's own), the installation's value, devices of the layout that are not this area's own, the sensors sections
   * unfolded, the phone's folded sections and whether this is a phone. */
  @state() private design: AreaDesign = 'tiles';
  @state() private installationDesign: AreaDesign = 'tiles';
  @state() private extra = new Map<string, EntityRow>();
  /** CR-015: per media card key, how many screens its `<media-area-card>` drew (undefined = not known yet). */
  @state() private mediaCount = new Map<string, { n: number; p: number; off: boolean }>();
  @state() private sensOpen = new Set<string>();
  @state() private foldState = new Map<string, boolean>();
  @state() private phone = false;
  private phoneMq: MediaQueryList | null = null;
  private extraKey = '';
  /** Bubble skin (phase C): the skin in force mirrored on the host, and the device whose sheet is open. */
  private skin = new SkinController(this);
  @state() private sheet: { id: string; card: CardId } | null = null;
  /** CR-007 6b: the area's card layout (one per installation and area; edited with system.configure). */
  private lay: DevicesLayoutController = new DevicesLayoutController(this, {
    scope: 'area',
    id: () => this.areaId,
    screenName: () => `מסך האזור › ${this.detail?.area.name ?? ''}`,
    measure: () => this.measureCards(),
    defaultH: () => 30,
    label: (key: string): string => (key.startsWith('card:c-') ? this.lay.customTitle(key) : key.startsWith('camera:') ? this.lay.item(key)?.title || 'מצלמה' : this.detail ? (this.detail.cards[key.slice(5) as CardId]?.label ?? key) : key),
    compact: () => this.prefs.density === 'compact',
    entities: (key) => {
      if (key.startsWith('card:c-')) return this.customRows(key).map((r) => ({ id: r.entity_id, name: r.name }));
      const c = this.detail?.cards[key.slice(5) as CardId];
      return c ? this.displayRows(c).map((r) => ({ id: r.entity_id, name: r.name, group: c.id === 'sensors' ? SENSOR_GROUP_LABELS[r.group ?? 'other'] : undefined })) : [];
    },
    // 6c: lighting, switches and sensors are two-up tiles; the other cards' rows are the card's full width
    tileSpan: (key) => {
      const type = this.lay.customOf(key)?.type;
      if (type) return CARD_TYPES[type as keyof typeof CARD_TYPES]?.tiles ? 1 : (TILE_COLS[type] ?? 2);
      return TILE_CARDS.has(key.slice(5) as CardId) ? 1 : (TILE_COLS[key.slice(5)] ?? 1);
    },
    // owner request 2026-09-30 (card library): every device of the area, for a custom card's picker and the starting picks
    pool: () => this.areaPool(),
    barExtra: () => this.renderDesignPersonal(),
  });

  /** Every device of the area (all the built-in cards' devices the screen shows this caller), as the library lists them. */
  private areaPool(): AreaEntity[] {
    const d = this.detail;
    if (!d) return [];
    return CARD_IDS.filter((id) => this.prefs.showSensors || id !== 'sensors').flatMap((id) => d.cards[id].entities.map((r) => ({ id: r.entity_id, name: r.name, card: id, domain: r.domain, group: r.group, door: r.door_class })));
  }

  private rowIndex(): Map<string, { row: DeviceRow; card: CardId }> {
    const out = new Map<string, { row: DeviceRow; card: CardId }>();
    const d = this.detail;
    if (!d) return out;
    for (const id of CARD_IDS) for (const r of d.cards[id].entities) out.set(r.entity_id, { row: r, card: id });
    for (const [id, r] of this.extra) if (!out.has(id)) out.set(id, { row: r, card: r.card }); // devices of other areas the layout lists
    return out;
  }

  protected updated() {
    // the layout arrives after the area: fetch what its custom cards / main strips list that is not this area's own
    const d = this.detail;
    if (!d) return;
    const own = new Set(CARD_IDS.flatMap((id) => d.cards[id].entities.map((r) => r.entity_id)));
    const want = this.lay.listedEntityIds().filter((id) => !own.has(id)).join(',');
    if (want !== this.extraKey && !(want === '' && this.extra.size === 0)) void this.loadExtra();
  }

  /** A custom card's devices: the rows of the area it lists (one that left the area is skipped), in the order it lists. */
  private customRows(key: string): DeviceRow[] {
    const idx = this.rowIndex();
    return (this.lay.customOf(key)?.entities ?? []).flatMap((id) => (idx.has(id) ? [idx.get(id)!.row] : []));
  }

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
    /* K88: the live plan card */
    .plancard {
      display: block;
      margin-block-end: 16px;
    }
    .plancard explore-floor-map {
      display: flex;
      block-size: 360px;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      border: 1px solid var(--sw-border);
    }
    .plancard .plan-open {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-accent-text, var(--sw-accent));
      font-size: var(--sw-fs-sm);
      text-decoration: none;
    }
    @media (max-width: 767px) {
      .plancard explore-floor-map {
        block-size: 300px;
      }
    }
    :host {
      display: block;
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
    .managed-note {
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
    /* owner 2026-09-30: a camera card is the picture edge to edge (the glass style's card padding does not apply to it) */
    :host sw-card[data-camera-card] {
      padding: 0 !important;
      overflow: hidden;
    }
    .lay-item > sw-card[data-camera-card] {
      display: flex;
      flex-direction: column;
    }
    .lay-item > sw-card[data-camera-card] > devices-camera-card {
      flex: 1 1 auto;
    }
  `, AREA_GLASS, AREA_DESIGN, bubbleAreaStyles];

  connectedCallback() {
    super.connectedCallback();
    this.prefsReady = Promise.all([
      loadDevicesPrefs().then((p) => {
        this.prefs = p;
        applyDevicesPrefs(this, p);
      }),
      this.loadDesign(),
    ]).then(() => undefined);
    try {
      this.phoneMq = window.matchMedia('(max-width: 599px)');
      this.phone = this.phoneMq.matches;
      this.phoneMq.addEventListener('change', this.onPhone);
    } catch {
      this.phoneMq = null;
    }
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
    this.phoneMq?.removeEventListener('change', this.onPhone);
  }

  private onPhone = () => {
    this.phone = this.phoneMq?.matches ?? false;
  };

  /** The direction: the installation's setting, then - for a holder of screen.personalize - this browser's own choice. */
  private async loadDesign() {
    let installation: unknown = 'tiles';
    if (isApi()) {
      try {
        installation = (await productSettings())['devices.area_design' as keyof Awaited<ReturnType<typeof productSettings>>];
      } catch {
        /* the default */
      }
    }
    this.installationDesign = resolveAreaDesign(installation, null, false);
    this.applyDesign();
  }

  private get mayPersonalize(): boolean {
    return isApi() && can(PERSONALIZE_PERMISSION);
  }

  private personalDesign(): string | null {
    try {
      return localStorage.getItem(AREA_DESIGN_KEY);
    } catch {
      return null;
    }
  }

  private applyDesign() {
    this.design = resolveAreaDesign(this.installationDesign, this.personalDesign(), this.mayPersonalize);
    this.setAttribute('data-area-design', this.design);
  }

  private setPersonalDesign(v: AreaDesign | '') {
    try {
      if (v) localStorage.setItem(AREA_DESIGN_KEY, v);
      else localStorage.removeItem(AREA_DESIGN_KEY);
    } catch {
      /* private mode: this visit only */
    }
    this.applyDesign();
  }

  /** The loaded area's entity ids (all cards), for the push filter. */
  private get entityIds(): Set<string> {
    if (!this.detail) return new Set();
    return new Set([...CARD_IDS.flatMap((id) => this.detail!.cards[id].entities.map((r) => r.entity_id)), ...this.extra.keys()]);
  }

  /** Devices a custom card or a main strip lists that are not this area's own are fetched by id (same visibility as the
   * tree); refetched with every load so their state is live. */
  private async loadExtra() {
    const d = this.detail;
    if (!d) return;
    const own = new Set(CARD_IDS.flatMap((id) => d.cards[id].entities.map((r) => r.entity_id)));
    const want = this.lay.listedEntityIds().filter((id) => !own.has(id));
    const key = want.join(',');
    if (!want.length) {
      if (this.extra.size) this.extra = new Map();
      this.extraKey = '';
      return;
    }
    try {
      const r = await getEntityRows(want);
      this.extra = new Map(r.entities.map((e) => [e.entity_id, e]));
      this.extraKey = key;
    } catch {
      this.extraKey = key; // no retry storm: the strip simply shows what it has until the next load
    }
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
      void this.loadExtra();
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
    // the floor is a crumb now (devices-area-nav.ts): the subtitle keeps only the counts
    const sub = `${d.counts.entities} התקנים${d.scoped ? ' · לפי הקומות שלך' : ''}`;
    const connected = this.sync?.connected ?? false;
    const cards = CARD_IDS.filter((id) => this.prefs.showSensors || id !== 'sensors').map((id) => d.cards[id]);
    // Owner feedback 2026-09-29 ("hide empty domains"): a domain this area has nothing of is not a card at all. Its saved
    // layout slot stays in the record; a viewer's layout packs its rows away (devices-layout.ts, as for an item gone
    // from Home Assistant), and the card comes back in its saved place when the domain appears.
    const withDevices = cards.filter((c) => c.count > 0);
    // owner request 2026-09-30 (card library): a built-in card the editor deleted is not drawn (its slot stays a grid key so
    // a viewer's layout packs it away), and the area's custom cards join the grid
    // the security state is a strip above the sections now; its own section is drawn only where the owner laid the screen
    // out (a stored layout, or the editor) - the strip is what a room shows by default
    const showSecuritySection = this.lay.gridOn('cards') || this.lay.editing;
    const ordered = withDevices.filter((c) => !this.lay.isRemoved(`card:${c.id}`) && (c.id !== 'security' || showSecuritySection));
    const customKeys = this.lay.customKeys();
    const gridKeys = [...withDevices.map((c) => `card:${c.id}`), ...customKeys, ...this.lay.removedKeys().filter((k) => !withDevices.some((c) => `card:${c.id}` === k))];
    const anyControllable = cards.some((c) => c.entities.some((r) => r.can_control));
    const bulk = this.bulkAllowed;
    // owner 2026-09-30: camera cards (`camera:<slug>` items of the layout) sit on the same grid as the domain cards
    const cameraKeys = this.lay.keysWithPrefix('camera:').filter((k) => isCameraSource(this.lay.cameraOf(k)));
    this.lay.prepare([{ id: 'cards', keys: [...gridKeys, ...cameraKeys] }]);
    // 6c: "סידור התקנים" - the editor shows the card being arranged alone
    const arranging = this.lay.tileCard ? ordered.find((c) => this.lay.arranging(`card:${c.id}`)) : undefined;
    const arrangingCustom = this.lay.tileCard && customKeys.includes(this.lay.tileCard) && this.lay.arranging(this.lay.tileCard) ? this.lay.tileCard : '';
    const bubble = this.skin.bubble;
    return html`<sw-page heading=${bubble ? '' : bidi(d.area.name)} subheading=${bubble ? '' : sub} wide @bulk-request=${this.onBulkRequest}>
      <devices-area-nav slot="crumbs" .areaId=${d.area.area_id} .areaName=${d.area.name} .floorName=${floorName} .areas=${d.floor_areas}></devices-area-nav>
      <div slot="actions">
        ${d.area.map ? html`<sw-button size="sm" variant="ghost" icon="map" data-show-on-map @click=${() => { location.hash = mapHrefForArea(d.area.map) ?? location.hash; }}>הצג על המפה</sw-button>` : nothing}
        ${bulk ? html`<devices-bulk-menu scope="area" .targetId=${d.area.area_id} .targetName=${d.area.name} .counts=${d.counts} variant="popover" label="פעולות לאזור" mapHref=${mapHrefForArea(d.area.map) ?? ''} data-bulk-area=${d.area.area_id}></devices-bulk-menu>` : nothing}
        ${d.counts.alarm && !bubble ? html`<sw-badge data-area-alarm kind=${alarmTone(d.counts.alarm)} label=${`אזעקה: ${ALARM_HE[d.counts.alarm] ?? d.counts.alarm}`}></sw-badge>` : nothing}
        ${bubble && connected ? nothing : html`<sw-badge data-devices-sync kind=${connected ? 'live' : 'stale'} label=${connected ? 'מסונכרן' : 'לא מסונכרן'}></sw-badge>`}
        ${this.structureFlash ? html`<sw-badge data-structure-changed kind="live" label="מבנה עודכן"></sw-badge>` : nothing}
      </div>
      ${this.error ? html`<sw-state-panel compact state="error" heading="הרענון האחרון נכשל" hint=${this.error}></sw-state-panel>` : nothing}
      ${bubble ? this.renderBubbleHead(d) : nothing}
      ${this.lay.renderBar()}
      ${this.lay.editing ? nothing : this.renderSecurityStrip(d)}
      ${this.lay.editing || !d.area.map || !this.prefs.planSurfaces.includes('area') || !isApi() ? nothing : this.renderPlanCard(d)}
      ${arranging
        ? this.lay.stage(`card:${arranging.id}`, this.renderCard(arranging))
        : arrangingCustom
        ? this.lay.stage(arrangingCustom, this.renderCustomCard(arrangingCustom))
        : ordered.length || customKeys.length || cameraKeys.length || (this.lay.editing && withDevices.length > 0)
        ? html`<div class=${classMap({ grid: true, 'lay-grid': this.lay.gridOn('cards') })} data-lay-grid="cards" data-lay-cols=${this.lay.gridCols('cards')} ?data-lay-phone-preview=${this.lay.phonePreview('cards')}>
            ${repeat(ordered, (c) => c.id, (c) => this.lay.wrap(`card:${c.id}`, this.renderCard(c)))}
            ${repeat(customKeys, (k) => k, (k) => this.lay.wrap(k, this.renderCustomCard(k)))}
            ${repeat(cameraKeys, (k) => k, (k) => this.lay.wrap(k, this.renderCameraCard(k)))}
          </div>`
        : html`<sw-state-panel data-devices-state="area_empty" state="empty" heading="אין התקנים באזור הזה" hint="שייכו התקנים לאזור (או מ״ללא שיוך״); כרטיס של תאורה, מתגים, מיזוג, תריסים, אבטחה, מסכים או חיישנים מופיע כשיש באזור התקן מהסוג הזה."></sw-state-panel>`}
      ${anyControllable ? nothing : html`<div class="note" data-readonly-note>תצוגה לקריאה בלבד: מצב ההתקנים כפי שדווח.</div>`}
      ${bulk ? html`<devices-bulk-dialog @bulk-done=${() => void this.load()}></devices-bulk-dialog>` : nothing}
      ${this.canAssignArea ? this.renderAssignDialog() : nothing}
      ${this.lay.renderPanel()}
      ${bubble ? this.renderBubbleSheet() : nothing}
    </sw-page>`;
  }

  // ---------------------------------------------------------------- Bubble skin (phase C, 2026-10-02): the head pill, the
  // device sheet, the section separators and the pills (devices-area-bubble.ts draws them; the commands are this screen's own)

  private bubbleHost = {
    ctl: this.ctl,
    openSheet: (r: DeviceRow, card: CardId) => {
      this.sheet = { id: r.entity_id, card };
    },
    assignButton: (r: DeviceRow) => (this.canAssignArea ? html`<sw-button slot="subs" class="assign-btn" size="sm" variant="ghost" data-assign-entity=${r.entity_id} @click=${(e: Event) => { e.stopPropagation(); void this.openAssign(r); }}>שייך לאזור</sw-button>` : nothing),
  };

  /** K88 (plan.surfaces has "area"): the area's room on its floor's live plan, the room focused; the title opens the full map. */
  private renderPlanCard(d: DeviceAreaDetail) {
    const link = d.area.map!;
    return html`<sw-card class="plancard" data-area-plan-card heading="על התוכנית">
      <a slot="actions" class="plan-open" href=${mapHrefForArea(link) ?? ''} data-area-plan-open>למפה המלאה<sw-icon name="chevron" size=${12}></sw-icon></a>
      <explore-floor-map embedded compact .floorId=${link.floor_id} .focusZone=${link.zone_id}></explore-floor-map>
    </sw-card>`;
  }

  /** The area's head pill: name, counts, the room temperature (its first temperature sensor), and "כבה הכל" for a bulk holder. */
  private renderBubbleHead(d: DeviceAreaDetail) {
    const c = d.counts;
    const parts = [c.lights_on ? `${ltrNum(c.lights_on)} דולקים` : '', c.climate_active + c.heating_active ? `${ltrNum(c.climate_active + c.heating_active)} מיזוג` : '', c.covers_open ? `${ltrNum(c.covers_open)} פתוחים` : ''].filter(Boolean);
    const state = [parts.length ? parts.join(' · ') : `${ltrNum(c.entities)} התקנים`, d.area.floor_name ?? ''].filter(Boolean).join(' · ');
    const temp = d.cards.sensors.entities.find((r) => r.domain === 'sensor' && r.device_class === 'temperature' && r.available && r.value !== null && r.value !== undefined);
    const alarm = d.counts.alarm;
    return html`<sw-pill class="bhead" variant="plain" ring-static icon="home" .label=${bidi(d.area.name)} .state=${state} .hue=${hueOf(d.area.area_id)} tabindex="-1" data-area-head=${d.area.area_id}>
      ${temp ? html`<span slot="subs" class="chip plain" data-area-temperature title=${bidi(temp.name)}><sw-icon name="thermometer" size=${14}></sw-icon>${deg(temp.value)}</span>` : nothing}
      ${alarm ? html`<a slot="subs" class="chip" href="#/security/alarm" data-area-alarm title="לאזעקה" style="text-decoration:none"><sw-icon name="shield" size=${14}></sw-icon>${ALARM_HE[alarm] ?? alarm}</a>` : nothing}
      ${this.bulkAllowed && (c.lights_on || c.switches_on) ? html`<button slot="subs" type="button" class="sb" aria-label="כבה הכל באזור" data-area-all-off @click=${() => this.openCoverGroupBulk('all_off')}><sw-icon name="power" size=${18}></sw-icon></button>` : nothing}
    </sw-pill>`;
  }

  /** The open device's sheet: its own pill as the head, the full controls as the body. The row is read live from the loaded
   * area (a state push re-renders it), so the sheet follows the device like the pill does. */
  private renderBubbleSheet() {
    const s = this.sheet;
    const hit = s ? this.rowIndex().get(s.id) : undefined;
    const r = hit?.row;
    const card = s?.card ?? hit?.card ?? 'sensors';
    return html`<sw-sheet ?open=${!!r} heading=${r ? bidi(r.name) : ''} data-device-sheet=${r?.entity_id ?? ''} @close=${() => (this.sheet = null)}>
      ${r ? html`<sw-pill slot="head" variant="plain" ring-static .icon=${sectionIcon(card)} .label=${bidi(r.name)} .state=${rowLabel(r)} .hue=${hueOf(r.entity_id)} ?on=${r.active && r.available} fill-color=${card === 'lighting' ? 'var(--sw-lit)' : card === 'climate' || card === 'heating' ? (card === 'heating' ? 'var(--sw-heat)' : 'var(--sw-cool)') : 'var(--sw-accent-soft)'} tabindex="-1" data-sheet-head></sw-pill>${renderBubbleSheetBody(this.bubbleHost, r, card)}` : nothing}
    </sw-sheet>`;
  }

  /** A section in the bubble skin: a separator (icon, label, count, the fold on a phone, the bulk button) and its body. */
  private renderBubbleSection(c: DeviceCard, key: string, body: unknown) {
    const it = this.lay.item(key);
    const folded = this.phone && !this.lay.editing && this.folded(key, c.id === 'sensors');
    const actions = SECTION_BULK[c.id] && this.bulkAllowed && c.count && !this.lay.arranging(key)
      ? html`<span class="sec-bulk" data-section-bulk=${c.id} data-bulk-look=${this.lay.bulkLookOf(key)}>${SECTION_BULK[c.id]!.map((a) => html`<button type="button" class="sb" aria-label=${`${a.label} · ${c.label}`} title=${a.label} data-section-bulk-kind=${a.kind} @click=${() => this.openCoverGroupBulk(a.kind)}><sw-icon .name=${a.icon} size=${18}></sw-icon></button>`)}</span>`
      : nothing;
    return html`${renderBubbleSep({ id: c.id, icon: it?.icon ?? sectionIcon(c.id), label: titleOf(it, c.label), count: c.count ? `${ltrNum(c.count)}` : '', fold: this.phone && !this.lay.editing ? { open: !folded, toggle: () => this.fold(key, !folded) } : null, actions })}
      ${folded ? nothing : body}`;
  }

  /** Owner 2026-09-30: a camera card - one camera as a live picture (screens/devices-camera-card.ts); its title is the
   * layout's own, else the camera's name. Placed by the layout like every card, so it fills the grid item it is given. */
  private renderCameraCard(key: string) {
    const it = this.lay.item(key);
    return html`<sw-card flush data-camera-card=${key} data-lay-key=${key}>
      <devices-camera-card .source=${this.lay.cameraOf(key) ?? null} .title=${it?.title ?? ''} .quality=${this.lay.qualityOf(key)} ?showQuality=${this.lay.editing} ?fill=${this.lay.gridOn('cards')}></devices-camera-card>
    </sw-card>`;
  }

  private renderCard(c: DeviceCard) {
    const e = CARD_EMPTY[c.id];
    const it = this.lay.item(`card:${c.id}`); // CR-007 6b: the layout's own title, icon and shown entities
    const ents = shownEntities(it, c.entities);
    // CR-007 6c: an arranged card (or the one being arranged) draws its tiles in the saved order / span / size
    const tiles = c.count ? this.lay.tiles(`card:${c.id}`, this.displayRows(c).map((r) => r.entity_id)) : null;
    const key = `card:${c.id}`;
    const bubble = this.skin.bubble;
    const body = c.count === 0
      ? html`<sw-state-panel compact data-card-empty state="empty" heading=${e.heading} hint=${e.hint}></sw-state-panel>`
      : tiles
        ? this.renderArranged(c, tiles)
        : !ents.length
        ? html`<div class="count" data-card-all-hidden>כל ההתקנים בכרטיס הוסתרו בעורך הפריסה.</div>`
        : c.id === 'media' && this.mediaHook
        ? this.renderMedia(key, null, ents)
        : c.id === 'sensors'
          ? this.renderSensorsSection(key, ents)
          : bubble
            ? html`${c.id === 'covers' ? this.renderCoverGroupControl() : nothing}<div class="bgrid" data-bubble-grid=${c.id}>${repeat(ents, (r) => r.entity_id, (r) => renderBubblePill(this.bubbleHost, r, c.id))}</div>`
          : c.id === 'lighting' || c.id === 'switches'
            ? html`<div class="tiles">${repeat(ents, (r) => r.entity_id, (r) => this.renderTile(r, c.id))}</div>`
            : html`${c.id === 'covers' ? this.renderCoverGroupControl() : nothing}<div class="rows">${repeat(ents, (r) => r.entity_id, (r) => this.renderRow(r, c.id))}</div>`;
    // the bubble skin: the card is a bare container (the section is a separator + a grid of pills); the layout editor's
    // wrapper, keys and arranged tiles are untouched
    if (bubble) {
      return html`<sw-card data-card=${c.id} data-lay-key=${key} ?data-empty=${c.count === 0} data-bubble-card>${this.renderBubbleSection(c, key, body)}</sw-card>`;
    }
    return html`<sw-card data-card=${c.id} data-lay-key=${key} ?data-empty=${c.count === 0} ?row=${this.rowSections && c.id !== 'sensors' && c.id !== 'media'} ?collapsible=${this.phone && !this.lay.editing} ?collapsed=${this.phone && !this.lay.editing && this.folded(key, c.id === 'sensors')} @sw-card-toggle=${(ev: CustomEvent<{ collapsed: boolean }>) => this.fold(key, ev.detail.collapsed)} heading=${titleOf(it, c.label)} subheading=${c.count ? `${c.count} התקנים${c.id === 'lighting' || c.id === 'switches' || c.id === 'climate' || c.id === 'heating' || c.id === 'covers' || c.id === 'media' ? ` · ${c.active} פעילים` : ''}` : ''}>
      ${this.renderSectionBulk(c, key)}
      <sw-icon slot="actions" .name=${it?.icon ?? CARD_ICON[c.id]} size=${18}></sw-icon>
      ${body}
    </sw-card>`;
  }

  // ---------------------------------------------------------------- owner decisions 2026-09-30: the area redesign

  /** The "sequential sections" direction draws each section as a row (title at the side) - only in the automatic layout. */
  private get rowSections(): boolean {
    return this.design === 'sections' && !this.phone && !this.lay.gridOn('cards');
  }

  /** A phone folds its sections (the sensors section starts folded); a section the user opened or closed stays so. */
  private folded(key: string, byDefault: boolean): boolean {
    return this.foldState.has(key) ? this.foldState.get(key)! : byDefault;
  }

  private fold(key: string, collapsed: boolean) {
    this.foldState = new Map(this.foldState).set(key, collapsed);
  }

  /** The section's "כבה הכל" button(s): the registry (devices-area-design.ts SECTION_BULK) decides which sections have one
   * and what it sends; the section's `bulk_look` (edit mode) decides icon / text / both. Every press opens the bulk flow's
   * confirmation dialog - nothing is sent from here. A holder of devices.control_bulk only (`can_bulk` of the area). */
  private renderSectionBulk(c: DeviceCard, key: string) {
    const actions = SECTION_BULK[c.id];
    if (!actions || !this.bulkAllowed || !c.count || this.lay.arranging(key)) return nothing;
    const look: BulkLook = this.lay.bulkLookOf(key);
    return html`<span slot="actions" class="sec-bulk" data-section-bulk=${c.id} data-bulk-look=${look}>${actions.map((a) =>
      look === 'icon'
        ? html`<sw-button size="sm" iconOnly icon=${a.icon} label=${a.label} data-section-bulk-kind=${a.kind} @click=${() => this.openCoverGroupBulk(a.kind)}></sw-button>`
        : html`<sw-button size="sm" icon=${look === 'both' ? a.icon : undefined} data-section-bulk-kind=${a.kind} @click=${() => this.openCoverGroupBulk(a.kind)}>${a.label}</sw-button>`,
    )}</span>`;
  }

  /** The strip above the sections: the security state at a glance (locks, the alarm, cameras, doors), read-only - the way in
   * to the alarm is its own screen. Only what the area has; absent when it has none of it. */
  private renderSecurityStrip(d: DeviceAreaDetail) {
    const rows = d.cards.security.entities;
    if (!rows.length) return nothing;
    const chip = (r: DeviceRow) => {
      const unavailable = !r.available || r.state === 'unavailable';
      const icon: IconName = r.kind === 'lock' ? (r.locked ? 'lock' : 'unlock') : r.kind === 'alarm' ? 'shield' : r.kind === 'camera' ? 'camera' : 'door';
      const tone = unavailable ? 'off' : r.kind === 'lock' ? (r.locked ? 'ok' : 'warn') : r.kind === 'alarm' ? (r.state === 'triggered' ? 'bad' : r.armed ? 'ok' : 'warn') : r.kind === 'camera' ? 'ok' : r.state === 'on' ? 'warn' : 'ok';
      const text = r.kind === 'camera' ? 'מקוון' : rowLabel(r);
      const inner = html`<sw-icon .name=${icon} size=${14}></sw-icon><b>${bidi(r.name)}</b><span>${text}</span>`;
      return r.kind === 'alarm'
        ? html`<a class="sec-chip ${tone}" href="#/security/alarm" data-sec-chip=${r.entity_id} title="לאזעקה">${inner}</a>`
        : html`<span class="sec-chip ${tone}" data-sec-chip=${r.entity_id}>${inner}</span>`;
    };
    return html`<div class="sec-strip" data-security-strip role="group" aria-label="אבטחה"><span class="sec-lbl"><sw-icon name="shield" size=${15}></sw-icon>אבטחה</span>${rows.map(chip)}</div>`;
  }

  /**
   * The sensors section (owner 2026-09-30): the MAIN strip on top - temperature, humidity, motion and door, only those the
   * area has, or the owner's own pick of any sensors of the installation (edit mode) - and "עוד N חיישנים" folding the rest
   * away. A room whose sensors are none of those four shows them all, as before.
   */
  private renderSensorsSection(key: string, ents: DeviceRow[]) {
    const idx = this.rowIndex();
    const byId = new Map([...idx].map(([id, x]) => [id, x.row]));
    const areaRows = [...idx.values()].filter((x) => !this.extra.has(x.row.entity_id)).map((x) => x.row);
    const { rows: main } = mainStrip(this.lay.mainOf(key), byId, areaRows);
    const mainIds = new Set(main.map((r) => r.entity_id));
    const rest = ents.filter((r) => !mainIds.has(r.entity_id));
    if (!main.length) return this.renderSensorGroups(ents);
    const open = this.sensOpen.has(key);
    const toggle = () => {
      const next = new Set(this.sensOpen);
      if (open) next.delete(key);
      else next.add(key);
      this.sensOpen = next;
    };
    if (this.skin.bubble) {
      return html`<div class="kv" data-main-sensors>${main.map((r) => renderBubbleSensorTile(r, mainSlotOf(r)))}</div>
        ${rest.length ? html`<button type="button" class="bmore" data-sensors-more aria-expanded=${String(open)} @click=${toggle}>${open ? 'הסתר חיישנים' : `עוד ${rest.length} חיישנים`}</button>${open ? this.renderSensorGroups(rest) : nothing}` : nothing}`;
    }
    return html`<div class="main-sensors" data-main-sensors>${main.map((r) => this.renderMainSensor(r))}</div>
      ${rest.length ? html`<button type="button" class="more-sens" data-sensors-more aria-expanded=${String(open)} @click=${toggle}>${open ? 'הסתר חיישנים' : `עוד ${rest.length} חיישנים`}</button>${open ? this.renderSensorGroups(rest) : nothing}` : nothing}`;
  }

  private renderMainSensor(r: DeviceRow) {
    if (this.skin.bubble) return renderBubbleSensorTile(r, mainSlotOf(r));
    const slot = mainSlotOf(r);
    const icon: IconName = slot === 'temperature' ? 'sensor' : slot === 'humidity' ? 'sensor' : slot === 'motion' ? 'activity' : slot === 'door' ? 'door' : 'sensor';
    const unavailable = !r.available || r.state === 'unavailable';
    const value = unavailable ? 'לא זמין' : r.domain === 'sensor' && r.value !== null && r.value !== undefined ? `${ltrNum(Number.isInteger(r.value) ? r.value : r.value.toFixed(1))}${r.unit ? (r.unit.startsWith('°') || r.unit === '%' ? r.unit : ` ${r.unit}`) : ''}` : rowLabel(r);
    return html`<div class=${classMap({ msens: true, unavailable, hot: r.domain === 'binary_sensor' && r.state === 'on' })} data-main-sensor=${r.entity_id} data-slot=${slot ?? ''} title=${r.entity_id}>
      <sw-icon .name=${icon} size=${16}></sw-icon><div class="mv"><b>${value}</b><span>${bidi(r.name)}</span></div>
    </div>`;
  }

  /** The edit bar's own control (a holder of screen.personalize only): this browser's direction, over the installation's. */
  private renderDesignPersonal() {
    if (!this.mayPersonalize) return nothing;
    const own = this.personalDesign();
    return html`<span class="design-personal" data-design-personal><label>כיוון תצוגה (רק אצלי)
      <select data-design-personal-select @change=${(ev: Event) => this.setPersonalDesign(((ev.target as HTMLSelectElement).value as AreaDesign | ''))}>
        <option value="" ?selected=${!own}>ברירת המערכת · ${AREA_DESIGN_LABEL[this.installationDesign]}</option>
        ${AREA_DESIGNS.map((k) => html`<option value=${k} ?selected=${own === k}>${AREA_DESIGN_LABEL[k]}</option>`)}
      </select></label></span>`;
  }

  /** CR-007 6c: a card's devices as arranged - one grid of TILE_COLS columns in the saved order, each tile with its
   * span, size and title (the device's own row / tile inside; its controls unchanged). The card's numbers (heading,
   * the floor chips) still count every device, hidden or not; a sensors card arranged by hand is one list. */
  private renderArranged(c: DeviceCard, tiles: TileEntry[], custom?: { key: string; cardOf: (id: string) => CardId }) {
    if (!tiles.length) return html`<div class="count" data-card-all-hidden>כל ההתקנים בכרטיס הוסתרו בעורך הפריסה.</div>`;
    const key = custom?.key ?? `card:${c.id}`;
    const byId = new Map(c.entities.map((r) => [r.entity_id, r]));
    return html`${!custom && c.id === 'covers' && !this.lay.arranging(key) ? this.renderCoverGroupControl() : nothing}<div class="tiles lay-tgrid" data-lay-tiles=${custom ? key : c.id}>${repeat(
      tiles,
      (x) => x.id,
      (x, i) => {
        const raw = byId.get(x.id)!;
        const r = x.t.title ? { ...raw, name: x.t.title } : raw; // the custom title is text only (Lit escapes it)
        const style = custom ? custom.cardOf(x.id) : c.id; // a custom card draws each device the way its own card does
        return this.lay.wrapTile(key, x, i, tiles.length, TILE_CARDS.has(style) ? this.renderTile(r, style) : this.renderRow(r, style));
      },
    )}</div>`;
  }

  // ---------------------------------------------------------------- CR-015: the media card draws screens, not entities

  /** The media card (built-in or from the library) is drawn by `<media-area-card>` when the caller may see media at all
   * (media.read; the demo has the mock). Without it - or with the feature off, or no approved screen in the area - the
   * card keeps its rows exactly as before. */
  private get mediaHook(): boolean {
    return !isApi() || canAnywhere('media.read');
  }

  /** A row the media card's cards replace: a media player that is not a speaker or a receiver once the card draws screens (the server
   * dedupes the endpoints of one screen into one card), and a speaker or receiver once it also draws the area's players (CR-016). */
  private isScreenRow(r: DeviceRow, screens: boolean, players: boolean): boolean {
    if (r.domain !== 'media_player') return false;
    return r.device_class === 'speaker' || r.device_class === 'receiver' ? players : screens;
  }

  private renderMedia(key: string, entityIds: string[] | null, rows: DeviceRow[]) {
    const d = this.detail!;
    const st = this.mediaCount.get(key);
    const rest = st === undefined ? [] : rows.filter((r) => !this.isScreenRow(r, st.n > 0, st.p > 0));
    const look: BulkLook = this.lay.bulkLookOf(key);
    const ask = () => this.renderRoot.querySelector<HTMLElement & { ask: () => Promise<void> }>(`media-area-card[data-media-card="${key}"]`)?.ask();
    return html`${st?.off && !this.lay.arranging(key)
        ? html`<span slot="actions" class="sec-bulk" data-section-bulk="media" data-bulk-look=${look}>${look === 'icon'
            ? html`<sw-button size="sm" iconOnly icon="power" label="כבה הכל" data-section-bulk-kind="screens_off" @click=${ask}></sw-button>`
            : html`<sw-button size="sm" icon=${look === 'both' ? 'power' : undefined} data-section-bulk-kind="screens_off" @click=${ask}>כבה הכל</sw-button>`}</span>`
        : nothing}
      <media-area-card external data-media-card=${key} .areaId=${d.area.area_id} .areaName=${d.area.name} .entityIds=${entityIds}
        @media-area-state=${(e: CustomEvent<{ screens: number; players?: number; canOff: boolean }>) => {
          const p = e.detail.players ?? 0;
          if (st?.n === e.detail.screens && st.p === p && st.off === e.detail.canOff) return;
          this.mediaCount = new Map(this.mediaCount).set(key, { n: e.detail.screens, p, off: e.detail.canOff });
        }}></media-area-card>
      ${rest.length ? html`<div class="rows">${repeat(rest, (r) => r.entity_id, (r) => this.renderRow(r, 'media'))}</div>` : nothing}`;
  }

  /**
   * Owner request 2026-09-30 (card library): a custom card - its own name, colours, size and device list (any devices of
   * the area, several cards of one type), drawn with the same tiles / rows as the built-in cards, each device the way its
   * own card draws it (a lighting device as a tile with its switch, a climate device as its row ...). The controls are the
   * same single-entity controls with the same permission checks.
   */
  private renderCustomCard(key: string) {
    const custom = this.lay.customOf(key);
    if (!custom || !isCardType(custom.type)) return html``;
    const info = CARD_TYPES[custom.type];
    const it = this.lay.item(key);
    const idx = this.rowIndex();
    const cardOf = (id: string): CardId => idx.get(id)?.card ?? 'sensors';
    const rows = shownEntities(it, this.customRows(key));
    const all = this.customRows(key);
    const pseudo: DeviceCard = { id: 'sensors', label: info.label, entities: all, count: all.length, active: all.filter((r) => r.active).length };
    const tiles = all.length ? this.lay.tiles(key, all.map((r) => r.entity_id)) : null;
    const tileRows = rows.filter((r) => TILE_CARDS.has(cardOf(r.entity_id)));
    const listRows = rows.filter((r) => !TILE_CARDS.has(cardOf(r.entity_id)));
    const bubble = this.skin.bubble;
    const body = !all.length
      ? html`<div class="count" data-card-empty>אין בכרטיס התקנים. בחרו התקנים בחלונית המאפיינים של הכרטיס.</div>`
      : tiles
        ? this.renderArranged(pseudo, tiles, { key, cardOf })
        : !rows.length
          ? html`<div class="count" data-card-all-hidden>כל ההתקנים בכרטיס הוסתרו בעורך הפריסה.</div>`
          : custom.type === 'media' && this.mediaHook
          ? this.renderMedia(key, custom.entities ?? null, rows)
          : bubble
            ? html`<div class="bgrid" data-bubble-grid=${custom.type}>${repeat(rows, (r) => r.entity_id, (r) => renderBubblePill(this.bubbleHost, r, cardOf(r.entity_id)))}</div>`
          : html`${tileRows.length ? html`<div class="tiles">${repeat(tileRows, (r) => r.entity_id, (r) => this.renderTile(r, cardOf(r.entity_id)))}</div>` : nothing}${listRows.length ? html`<div class="rows">${repeat(listRows, (r) => r.entity_id, (r) => this.renderRow(r, cardOf(r.entity_id)))}</div>` : nothing}`;
    if (bubble) {
      const sepCard: DeviceCard = { ...pseudo, id: (isCardType(custom.type) && (CARD_IDS as string[]).includes(custom.type) ? custom.type : 'sensors') as CardId, label: titleOf(it, info.label) };
      return html`<sw-card data-custom-card=${key.slice(5)} data-card-type=${custom.type} data-lay-key=${key} ?data-empty=${all.length === 0} data-bubble-card>${renderBubbleSep({ id: sepCard.id, icon: it?.icon ?? info.icon, label: sepCard.label, count: all.length ? `${ltrNum(all.length)}` : '' })}${body}</sw-card>`;
    }
    return html`<sw-card data-custom-card=${key.slice(5)} data-card-type=${custom.type} data-lay-key=${key} ?data-empty=${all.length === 0} heading=${titleOf(it, info.label)} subheading=${all.length ? `${all.length} התקנים` : ''}>
      <sw-icon slot="actions" .name=${it?.icon ?? info.icon} size=${18}></sw-icon>
      ${body}
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
    if (this.skin.bubble) {
      return html`<div class="sensor-groups">${keys.map((g) => html`<div class="sensor-group" data-sensor-group=${g}>
        <div class="bsh">${SENSOR_GROUP_LABELS[g] ?? g}</div>
        <div class="bgrid" data-bubble-grid="sensors">${repeat(groups.get(g)!, (r) => r.entity_id, (r) => renderBubblePill(this.bubbleHost, r, 'sensors'))}</div>
      </div>`)}</div>`;
    }
    return html`<div class="sensor-groups">${keys.map((g) => html`<div class="sensor-group" data-sensor-group=${g}>
      <div class="sensor-group-label">${SENSOR_GROUP_LABELS[g] ?? g}</div>
      <div class="tiles">${repeat(groups.get(g)!, (r) => r.entity_id, (r) => this.renderTile(r, 'sensors'))}</div>
    </div>`)}</div>`;
  }

  private renderTile(raw: DeviceRow, card: CardId) {
    if (this.skin.bubble) return renderBubblePill(this.bubbleHost, raw, card);
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
    return html`<div class=${classMap({ tile: true, on, off: !on && !unavailable, unavailable, pending: controllable && this.ctl.rowPending(r.entity_id) })} data-entity=${r.entity_id} data-activity=${ifDefined(activityTag(r, rowLabel(r)))} data-active=${String(on)} ?data-can-control=${controllable} title=${r.entity_id}>
      <div class="t"><sw-icon .name=${icon} size=${15}></sw-icon><span>${bidi(r.name)}</span>${controllable ? this.ctl.renderPowerToggle(r) : nothing}</div>
      <div class="s">${unavailable ? 'לא זמין' : value}</div>
      ${card === 'sensors' && r.last_changed ? html`<div class="lc" data-last-changed>${fmtTime(r.last_changed)}</div>` : nothing}
      ${controllable && card === 'lighting' && (on || this.ctl.live<boolean>(r.entity_id, 'power') === true) ? this.ctl.renderBrightnessSlider(r) : nothing}
      ${controllable ? this.ctl.renderCmdStatus(r.entity_id) : nothing}
      ${r.alarm_managed ? html`<div class="managed-note" data-alarm-managed>${r.managed_label ?? 'נשלט ממסך האזעקה'} · <a href="#/security/alarm">לאזעקה</a></div>` : nothing}
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
    if (this.skin.bubble) {
      // the bubble skin: one pill for every cover of the area - a position slider (sent on "קבע") and open / stop / close
      const v = this.coverGroupPosition;
      return html`<sw-pill class="bgroup" variant="slider" icon="layers" label="כל התריסים" .state=${`מיקום לכולם · ${ltrNum(v)}%`} .value=${v / 100} on fill-color="var(--sw-accent-soft)" keep-text data-cover-group
        @input=${(e: CustomEvent<{ value: number }>) => (this.coverGroupPosition = Math.round(e.detail.value * 100))} @toggle=${() => (this.coverGroupPosition = v > 0 ? 0 : 100)}>
        <button slot="subs" type="button" class="sb" aria-label="פתח הכל" data-cover-group-kind="covers_open" @click=${() => this.openCoverGroupBulk('covers_open')}><sw-icon name="arrowUp" size=${18}></sw-icon></button>
        <button slot="subs" type="button" class="sb" aria-label="עצור הכל" data-cover-group-kind="covers_stop" @click=${() => this.openCoverGroupBulk('covers_stop')}><sw-icon name="pause" size=${18}></sw-icon></button>
        <button slot="subs" type="button" class="sb" aria-label="סגור הכל" data-cover-group-kind="covers_close" @click=${() => this.openCoverGroupBulk('covers_close')}><sw-icon name="arrowDown" size=${18}></sw-icon></button>
        <button slot="subs" type="button" class="chip on" data-cover-group-kind="covers_position" @click=${() => this.openCoverGroupBulk('covers_position', this.coverGroupPosition)}>${`קבע ${ltrNum(v)}%`}</button>
      </sw-pill>`;
    }
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
    if (this.skin.bubble) return renderBubblePill(this.bubbleHost, raw, card);
    const controllable = raw.can_control && raw.available && raw.state !== 'unavailable' && (card === 'climate' || card === 'heating' || card === 'covers' || card === 'media');
    const r = raw; // the row's text is always what HA last reported; only the controls show a pending target
    const unavailable = !r.available || r.state === 'unavailable';
    const on = r.active && !unavailable;
    const pendingCls = controllable && this.ctl.rowPending(r.entity_id);
    if (card === 'climate' || card === 'heating') {
      const isClimate = r.domain === 'climate';
      return html`<div class=${classMap({ row: true, on, unavailable, pending: pendingCls })} data-entity=${r.entity_id} data-activity=${ifDefined(activityTag(r, rowLabel(r)))} data-active=${String(r.active)} ?data-can-control=${controllable} title=${r.entity_id}>
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
      return html`<div class=${classMap({ row: true, on, unavailable, pending: pendingCls })} data-entity=${r.entity_id} data-activity=${ifDefined(activityTag(r, rowLabel(r)))} data-active=${String(r.active)} data-door-class=${String(!!r.door_class)} ?data-can-control=${controllable} title=${r.entity_id}>
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
      return html`<div class=${classMap({ row: true, unavailable })} data-entity=${r.entity_id} data-activity=${ifDefined(activityTag(r, rowLabel(r)))} data-kind=${r.kind ?? ''} title=${r.entity_id}>
        <span class="n"><sw-icon .name=${kindIcon} size=${14}></sw-icon> ${bidi(r.name)}</span>
        <sw-badge kind=${badge.kind} label=${badge.label}></sw-badge>
        ${r.kind === 'camera' ? html`<div class="d"><span>אין תמונה ממצלמת התקן במסך הזה עדיין; מצלמות ה־NVR מוצגות ב"מצלמות".</span></div>` : nothing}
        ${this.renderAssignButton(r)}
      </div>`;
    }
    // media
    return html`<div class=${classMap({ row: true, on, unavailable, pending: pendingCls })} data-entity=${r.entity_id} data-activity=${ifDefined(activityTag(r, rowLabel(r)))} data-active=${String(r.active)} ?data-can-control=${controllable} title=${r.entity_id}>
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
