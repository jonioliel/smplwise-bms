import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-drawer';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-state-panel';
import './devices-bulk';
import type { IconName } from '../components/sw-icon';
import type { DevicesBulkDialog } from './devices-bulk';
import { canAnywhere, isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import { subscribeHa } from '../api/ha';
import { ALARM_HE, getDeviceItems, type DeviceItem, type DeviceItems, type DeviceRow, type ItemsScope, type TileKind } from '../api/devices';
import type { BulkKind } from '../api/device-bulk';
import { bidi, ltrNum } from '../i18n/bidi';
import { DeviceControls, deviceControlStyles, rowLabel } from './devices-controls';
import { runCommand, type CommandPhase } from '../api/device-commands';

/** Which rows a segment shows: `active` = the tile's counted state (lit, on, open, running, playing, locked, armed). */
export type ItemsFilter = 'all' | 'active' | 'inactive' | 'unavailable';
export const ITEMS_FILTERS: ItemsFilter[] = ['all', 'active', 'inactive', 'unavailable'];

interface KindMeta {
  noun: string;
  icon: IconName;
  /** "X פעילים" in the header, and the segment of the counted state. */
  active: string;
  inactive: string;
  unavailable: string;
  /** The "attention" segment comes first after "הכול": the counted state, or (locks) its opposite. */
  order: ItemsFilter[];
  /** Owner 2026-09-29: the master control - one smart on/off button (switches, lights, screens) or open / close
   * (covers); the words live in its aria-label and tooltip only. Climate has none; locks have lock-all (below). */
  master?: { on: BulkKind; off: BulkKind; onLabel: string; offLabel: string } | { open: BulkKind; close: BulkKind; openLabel: string; closeLabel: string };
  emptyHint: string;
}

/** Owner 2026-09-29: the tiles' panel wording per kind (the segmented filter: הכול / פעילים|פתוחים|לא נעולים / כבויים|סגורים|נעולים / לא זמינים). */
export const KIND_META: Record<TileKind, KindMeta> = {
  lights: { noun: 'גופי תאורה', icon: 'light', active: 'דולקים', inactive: 'כבויים', unavailable: 'לא זמינים', order: ['all', 'active', 'inactive', 'unavailable'], master: { on: 'lights_on', off: 'lights_off', onLabel: 'הדלק את כל התאורה', offLabel: 'כבה את כל התאורה' }, emptyHint: 'גופי תאורה המשויכים לאזורים יופיעו כאן.' },
  switches: { noun: 'מתגים', icon: 'bolt', active: 'פעילים', inactive: 'כבויים', unavailable: 'לא זמינים', order: ['all', 'active', 'inactive', 'unavailable'], master: { on: 'switches_on', off: 'switches_off', onLabel: 'הדלק את כל המתגים', offLabel: 'כבה את כל המתגים' }, emptyHint: 'מתגים ודגלים המשויכים לאזורים יופיעו כאן.' },
  covers: { noun: 'תריסים', icon: 'layers', active: 'פתוחים', inactive: 'סגורים', unavailable: 'לא זמינים', order: ['all', 'active', 'inactive', 'unavailable'], master: { open: 'covers_open', close: 'covers_close', openLabel: 'פתח את כל התריסים', closeLabel: 'סגור את כל התריסים' }, emptyHint: 'תריסים, וילונות ושערים המשויכים לאזורים יופיעו כאן.' },
  climate: { noun: 'התקני מיזוג', icon: 'activity', active: 'פעילים', inactive: 'כבויים', unavailable: 'לא זמינים', order: ['all', 'active', 'inactive', 'unavailable'], emptyHint: 'מזגנים, תרמוסטטים, מאווררים ומייבשים יופיעו כאן.' },
  media: { noun: 'מסכים ונגנים', icon: 'play', active: 'דולקים', inactive: 'כבויים', unavailable: 'לא זמינים', order: ['all', 'active', 'inactive', 'unavailable'], master: { on: 'screens_on', off: 'screens_off', onLabel: 'הדלק את כל המסכים', offLabel: 'כבה את כל המסכים' }, emptyHint: 'טלוויזיות, מקרנים ורמקולים יופיעו כאן.' },
  locks: { noun: 'מנעולים', icon: 'lock', active: 'נעולים', inactive: 'לא נעולים', unavailable: 'לא זמינים', order: ['all', 'inactive', 'active', 'unavailable'], emptyHint: 'מנעולים המשויכים לאזורים יופיעו כאן.' },
  alarm: { noun: 'לוחות אזעקה', icon: 'shield', active: 'דרוכים', inactive: 'מנוטרלים', unavailable: 'לא זמינים', order: ['all', 'active', 'inactive', 'unavailable'], emptyHint: 'לוח אזעקה המשויך לאזור יופיע כאן.' },
};

export const SCOPE_WORD: Record<ItemsScope, string> = { building: 'במבנה', floor: 'בקומה', area: 'באזור' };

function rowState(r: DeviceRow): Exclude<ItemsFilter, 'all'> {
  if (!r.available || r.state === 'unavailable' || r.state === null) return 'unavailable';
  if (r.kind === 'alarm') return r.armed ? 'active' : 'inactive';
  return r.active ? 'active' : 'inactive';
}

/** Why a row the user can see has no control (shown on hover and on tap). '' = it has controls. */
export function readOnlyReason(r: DeviceItem, kind: TileKind, demo: boolean): string {
  if (kind === 'alarm') return 'דריכה וניטרול נעשים במסך האזעקה';
  if (demo) return 'נתוני הדגמה - אין שליטה בהתקנים';
  if (rowState(r) === 'unavailable') return 'ההתקן לא זמין כרגע';
  if (r.door_class) return 'דלת / שער - תנועה של מעבר, לקריאה בלבד כאן';
  if (!r.can_control) return kind === 'locks' ? 'שליטה במנעולים דורשת הרשאת שליטה בישויות' : 'אין לך הרשאת שליטה בהתקן הזה';
  if (r.domain === 'humidifier' && !(r.available_modes?.length || (r.target_humidity !== null && r.target_humidity !== undefined))) return 'המייבש אינו מדווח על מצבים או יעד לחות';
  return '';
}

function demoRow(entity_id: string, name: string, area: [string, string, string, string], state: string, extra: Partial<DeviceItem> = {}): DeviceItem {
  const domain = entity_id.split('.')[0];
  const active = ['on', 'open', 'cool', 'playing', 'locked'].includes(state);
  return { entity_id, name, domain, device_class: null, state, available: true, fresh: true, active, icon: null, last_changed: '2026-09-14T07:05:00Z', can_control: false, area_id: area[0], area_name: area[1], floor_id: area[2], floor_name: area[3], ...extra };
}

const LOBBY: [string, string, string, string] = ['lobby', 'לובי', 'ground', 'קרקע'];
const KITCHEN: [string, string, string, string] = ['kitchen', 'מטבח', 'ground', 'קרקע'];
const OFFICE: [string, string, string, string] = ['office', 'משרד', 'first', 'קומה 1'];

/** Demo mode (no server): the same numbers as the building screen's own demo tree. */
const DEMO_ROWS: Record<TileKind, DeviceItem[]> = {
  lights: [
    demoRow('light.lobby_1', 'תאורת לובי', LOBBY, 'on', { brightness_pct: 80 }),
    demoRow('light.lobby_2', 'ספוט כניסה', LOBBY, 'on', { brightness_pct: 40 }),
    demoRow('light.lobby_3', 'תאורת קבלה', LOBBY, 'on'),
    demoRow('light.lobby_4', 'תאורת מסדרון לובי ארוך במיוחד', LOBBY, 'off'),
    demoRow('light.kitchen_1', 'תאורת מטבח', KITCHEN, 'off'),
    demoRow('light.kitchen_2', 'פס לד מטבח', KITCHEN, 'off'),
    demoRow('light.office_1', 'תאורת משרד', OFFICE, 'off'),
    demoRow('light.office_2', 'מנורת שולחן', OFFICE, 'off'),
    demoRow('light.office_3', 'תאורת חלון', OFFICE, 'unavailable', { available: false }),
  ],
  switches: [
    demoRow('switch.lobby_sign', 'שלט מואר', LOBBY, 'on'),
    demoRow('switch.kitchen_boiler', 'דוד מים', KITCHEN, 'off'),
    demoRow('switch.loose', 'מתג ללא אזור', ['unassigned', 'ללא שיוך', 'unassigned', 'ללא שיוך'], 'off'),
  ],
  covers: [
    demoRow('cover.lobby', 'תריס לובי', LOBBY, 'open', { position: 70 }),
    demoRow('cover.kitchen', 'תריס מטבח', KITCHEN, 'closed', { position: 0 }),
    demoRow('cover.office_1', 'תריס משרד', OFFICE, 'open', { position: 100 }),
    demoRow('cover.office_2', 'וילון משרד', OFFICE, 'open', { position: 40 }),
  ],
  climate: [demoRow('climate.lobby', 'מזגן לובי', LOBBY, 'cool', { hvac_mode: 'cool', current_temperature: 24.5, target_temperature: 22 })],
  media: [demoRow('media_player.kitchen_tv', 'מסך מטבח', KITCHEN, 'off')],
  locks: [demoRow('lock.lobby_door', 'דלת ראשית', LOBBY, 'locked', { kind: 'lock', locked: true })],
  alarm: [demoRow('alarm_control_panel.house', 'אזעקת הבניין', LOBBY, 'armed_home', { kind: 'alarm', armed: true })],
};

function demoItems(kind: TileKind, scope: ItemsScope, id: string, name: string): DeviceItems {
  const rows = DEMO_ROWS[kind].filter((r) => scope === 'building' || (scope === 'floor' ? r.floor_id === id : r.area_id === id));
  const floors: DeviceItems['floors'] = [];
  for (const r of rows) {
    let f = floors.find((x) => x.floor_id === r.floor_id);
    if (!f) floors.push((f = { floor_id: r.floor_id ?? '', name: r.floor_name ?? '', level: null, areas: [] }));
    let a = f.areas.find((x) => x.area_id === r.area_id);
    if (!a) f.areas.push((a = { area_id: r.area_id, name: r.area_name, items: [] }));
    a.items.push(r);
  }
  const count = (s: Exclude<ItemsFilter, 'all'>) => rows.filter((r) => rowState(r) === s).length;
  return { kind, scope, id, name, floor_name: null, counts: { total: rows.length, active: count('active'), inactive: count('inactive'), unavailable: count('unavailable') }, floors, truncated: false, scoped: false, can_bulk: false };
}

/** When a row last changed: the time today, else a short date and time (the full instant in the title). */
export function changedAt(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === now.toDateString() ? `השתנה ב־${time}` : `השתנה ב־${d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })} ${time}`;
}

/** How long the panel waits before refetching after a push (the building screen's own window). */
const REFRESH_MS = 400;

/**
 * The overview tiles' panel (owner 2026-09-29): a tile ("0/33 מתגים פעילים") opens every entity of its kind in the
 * scope - the building, or the floor / area whose chip was pressed - as a side drawer on a desktop and a bottom sheet
 * on a phone (sw-drawer `modal`: focus trapped, Escape closes, focus returns to the tile). A header with the counts, a
 * segmented filter, a search, the rows grouped floor › area with the reported state, the last change and the control
 * the row supports - the SAME controls as the area screen (devices-controls.ts: the existing action route, its
 * confirmation and rollback; cover movement arm-then-confirm; unlock only after this panel's own confirmation and only
 * with door.unlock). A bulk action at the top opens the existing confirmation dialog (devices-bulk-dialog), rendered
 * inside the drawer. A row the user may see but not control says why (hover and tap). Live: a state push about a row
 * (or a structure change) refetches, throttled - no polling. The alarm panels are listed with their state only;
 * arming and disarming live on the alarm screen (`#/security/alarm`).
 */
@customElement('devices-tiles-panel')
export class DevicesTilesPanel extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property() kind: TileKind = 'lights';
  @property() scope: ItemsScope = 'building';
  @property() scopeId = '';
  @property() scopeName = 'המבנה';
  @property() filter: ItemsFilter = 'all';
  @state() private data: DeviceItems | null = null;
  @state() private error = '';
  @state() private notFound = false;
  @state() private q = '';
  @state() private why: string | null = null; // the read-only row whose reason is shown (tap)
  @state() private unlocking: DeviceItem | null = null;
  /** Lock-all (owner 2026-09-29): the locks to lock, the dialog's step and each lock's outcome. Never unlock-all. */
  @state() private lockAll: { rows: DeviceItem[]; step: 'confirm' | 'running' | 'done'; out: Record<string, CommandPhase> } | null = null;
  private ctl = new DeviceControls(this, () => this.schedule());
  private stop: (() => void) | null = null;
  private timer = 0;
  private loading = false;
  private again = false;
  private ids = new Set<string>();

  static styles = [
    deviceControlStyles,
    css`
      :host {
        display: contents;
      }
      .top {
        display: flex;
        flex-direction: column;
        gap: 10px;
        position: sticky;
        inset-block-start: -14px;
        z-index: 2;
        margin-block: -14px 0;
        padding-block: 14px 8px;
        background: var(--dv-surface-solid, var(--sw-surface));
      }
      .seg {
        display: flex;
        border: 1px solid var(--sw-border-strong);
        border-radius: 10px;
        overflow: hidden;
      }
      .seg button {
        flex: 1;
        min-inline-size: 0;
        min-block-size: 36px;
        border: 0;
        padding: 4px 6px;
        background: var(--sw-surface);
        color: var(--sw-text);
        font: inherit;
        font-size: var(--sw-fs-xs);
        cursor: pointer;
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
      }
      .seg button + button {
        border-inline-start: 1px solid var(--sw-border-strong);
      }
      .seg button[aria-pressed='true'] {
        background: var(--sw-accent);
        color: var(--sw-on-accent, #fff);
        font-weight: var(--sw-fw-semibold);
      }
      .seg button:focus-visible,
      .search input:focus-visible {
        outline: 2px solid var(--sw-focus, var(--sw-accent));
        outline-offset: -2px;
      }
      .search {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-inline: 10px;
        border: 1px solid var(--sw-border);
        border-radius: 10px;
        background: var(--sw-surface-2);
        color: var(--sw-text-3);
      }
      .search input {
        flex: 1;
        min-inline-size: 0;
        min-block-size: 36px;
        border: 0;
        background: transparent;
        color: var(--sw-text);
        font: inherit;
        font-size: var(--sw-fs-sm);
        outline: none;
      }
      .ctlbar {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ctlbar .seg {
        flex: 1;
        min-inline-size: 0;
      }
      .master-group {
        display: flex;
        gap: 6px;
      }
      /* the master control: an icon-only 44 px button; filled = something is on (a press turns all off) */
      button.master {
        position: relative;
        flex: none;
        display: grid;
        place-items: center;
        inline-size: 44px;
        block-size: 44px;
        padding: 0;
        border: 2px solid var(--sw-accent);
        border-radius: 50%;
        background: transparent;
        color: var(--sw-accent);
        cursor: pointer;
      }
      button.master[data-state='on'],
      button.master[data-state='mixed'] {
        background: var(--sw-accent);
        color: var(--sw-on-accent, #fff);
      }
      button.master:disabled {
        opacity: 0.4;
        cursor: default;
      }
      button.master:focus-visible {
        outline: 2px solid var(--sw-focus, var(--sw-accent));
        outline-offset: 2px;
      }
      button.master .badge {
        position: absolute;
        inset-block-start: -4px;
        inset-inline-end: -4px;
        min-inline-size: 18px;
        block-size: 18px;
        padding-inline: 4px;
        box-sizing: border-box;
        border-radius: 999px;
        background: var(--sw-warning);
        color: #1c1c1e;
        font-size: 11px;
        font-weight: var(--sw-fw-bold);
        line-height: 18px;
        text-align: center;
        font-variant-numeric: tabular-nums;
      }
      .la-list {
        margin: 4px 0 0;
        padding-inline-start: 18px;
        max-block-size: 180px;
        overflow: auto;
        font-size: var(--sw-fs-sm);
      }
      .note {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
      }
      a.alarm-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: 36px;
        color: var(--sw-accent-text, var(--sw-accent));
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-medium);
        text-decoration: none;
      }
      a.alarm-link:hover {
        text-decoration: underline;
      }
      .floor {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .floor > h4 {
        margin: 6px 0 0;
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text-2);
      }
      .area {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .area > h5 {
        margin: 2px 0 0;
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-medium);
        color: var(--sw-text-3);
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 4px 10px;
        padding: 8px 10px;
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-sm);
        background: var(--sw-surface);
      }
      .row.on {
        background: var(--sw-warning-soft);
        border-color: color-mix(in srgb, var(--sw-warning) 40%, var(--sw-border));
      }
      .row.unavailable {
        opacity: 0.65;
      }
      .row > sw-icon {
        color: var(--sw-text-3);
      }
      .row.on > sw-icon {
        color: var(--sw-warning);
      }
      .row .txt {
        min-inline-size: 0;
      }
      .row .nm {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
        overflow-wrap: anywhere;
        font-weight: var(--sw-fw-medium);
        font-size: var(--sw-fs-sm);
        line-height: 1.3;
      }
      .row .st {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-2);
        font-variant-numeric: tabular-nums;
      }
      .row .lc {
        color: var(--sw-text-3);
      }
      .row .end {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      button.ro {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-block-size: 32px;
        padding: 2px 8px;
        border: 1px dashed var(--sw-border-strong);
        border-radius: 999px;
        background: transparent;
        color: var(--sw-text-3);
        font: inherit;
        font-size: var(--sw-fs-xs);
        cursor: help;
        white-space: nowrap;
      }
      .why {
        grid-column: 1 / -1;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-2);
        background: var(--sw-surface-2);
        border-radius: var(--sw-r-sm);
        padding: 4px 8px;
      }
      .unlock-what {
        font-size: var(--sw-fs-sm);
      }
      .unlock-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding-block-start: 8px;
      }
      /* touch: every control a 44 px target */
      @media (max-width: 767px), (pointer: coarse) {
        .seg button,
        .search input {
          min-block-size: 44px;
        }
        .row sw-button {
          min-block-size: 44px;
        }
        .row sw-toggle {
          min-block-size: 44px;
          min-inline-size: 52px;
          justify-content: center;
        }
        .row input[type='range'].ctl-range {
          block-size: 44px;
        }
        .row .ctl-select {
          min-block-size: 44px;
        }
        button.ro,
        a.alarm-link {
          min-block-size: 44px;
        }
      }
    `,
  ];

  protected willUpdate(changed: PropertyValues<this>) {
    if ((changed.has('open') || changed.has('kind') || changed.has('scope') || changed.has('scopeId')) && this.open) {
      if (changed.has('kind') || changed.has('scope') || changed.has('scopeId') || !this.data) {
        this.data = null;
        this.q = '';
        this.why = null;
      }
      this.error = '';
      this.notFound = false;
      void this.load();
    }
    if (changed.has('open')) {
      if (this.open) this.listen();
      else this.unlisten();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unlisten();
  }

  private listen() {
    if (this.stop || !isApi()) return;
    this.stop = subscribeHa(
      (m) => {
        if (m.type === 'entity_state_changed') {
          const id = m.entity.entity_id;
          const domain = id.split('.')[0];
          // a row of this list, or a new entity of this kind (it may have just appeared in the scope)
          if (this.ids.has(id) || (this.domains().includes(domain) && !this.ids.has(id))) this.schedule();
        } else if (m.type === 'structure_changed' || m.type === 'ha_sync_state') this.schedule();
      },
      (connected) => {
        if (connected) this.schedule(); // pushes sent while the socket was down are gone: catch up
      },
    );
  }

  private unlisten() {
    this.stop?.();
    this.stop = null;
    window.clearTimeout(this.timer);
    this.timer = 0;
  }

  private domains(): string[] {
    return { lights: ['light'], switches: ['switch', 'input_boolean'], covers: ['cover'], climate: ['climate', 'fan', 'humidifier'], media: ['media_player'], locks: ['lock'], alarm: ['alarm_control_panel'] }[this.kind];
  }

  /** Throttled like the building screen: one refetch per window while pushes keep coming, one more after. */
  private schedule() {
    if (this.timer) return;
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      void this.load();
    }, REFRESH_MS);
  }

  private async load() {
    if (!isApi()) {
      this.data = demoItems(this.kind, this.scope, this.scopeId, this.scopeName);
      return;
    }
    if (this.loading) {
      this.again = true;
      return;
    }
    this.loading = true;
    const want = `${this.kind}|${this.scope}|${this.scopeId}`;
    try {
      const d = await getDeviceItems(this.kind, this.scope, this.scopeId);
      if (want !== `${this.kind}|${this.scope}|${this.scopeId}`) return;
      this.data = d;
      this.ids = new Set(d.floors.flatMap((f) => f.areas.flatMap((a) => a.items.map((r) => r.entity_id))));
      this.error = '';
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) this.notFound = true;
      else this.error = err instanceof ApiError && err.status === 403 ? 'אין לך הרשאת צפייה בחשמל והתקנים.' : describeError(err);
    } finally {
      this.loading = false;
      if (this.again) {
        this.again = false;
        void this.load();
      }
    }
  }

  /** Review B1: a nested confirmation (unlock, lock-all, the bulk dialog) raises its own composed `close` - only the
   * drawer's own close event (target = the drawer) closes the panel. */
  private onDrawerClose = (e: Event) => {
    if (e.target !== e.currentTarget) return;
    this.close();
  };

  private close() {
    this.open = false;
    this.unlocking = null;
    this.dispatchEvent(new CustomEvent('panel-close', { bubbles: true, composed: true }));
  }

  private setFilter(f: ItemsFilter) {
    this.filter = f;
    this.dispatchEvent(new CustomEvent('panel-filter', { detail: f, bubbles: true, composed: true }));
  }

  private get bulkDialog(): DevicesBulkDialog | null {
    return this.renderRoot.querySelector('devices-bulk-dialog');
  }

  private heading(): string {
    const m = KIND_META[this.kind];
    const where = this.scope === 'building' ? 'במבנה' : `${SCOPE_WORD[this.scope]} ${this.data?.name ?? this.scopeName}`;
    return `${m.noun} ${where}`;
  }

  private subheading(): string {
    const d = this.data;
    if (!d) return '';
    const m = KIND_META[this.kind];
    const c = d.counts;
    return `${ltrNum(c.total)} ${m.noun} · ${ltrNum(c.active)} ${m.active}${c.unavailable ? ` · ${ltrNum(c.unavailable)} ${m.unavailable}` : ''}`;
  }

  render() {
    return html`<sw-drawer modal ?open=${this.open} heading=${this.heading()} subheading=${this.subheading()} data-tiles-panel=${this.kind} data-scope=${this.scope} @close=${this.onDrawerClose}>
      ${this.open ? this.renderBody() : nothing}
    </sw-drawer>`;
  }

  private renderBody() {
    const m = KIND_META[this.kind];
    if (this.notFound) return html`<sw-state-panel data-panel-state="not_found" state="empty" heading="הקומה או האזור לא נמצאו" hint="ייתכן שהמבנה השתנה, או שאין בהם התקנים שבהרשאתך."></sw-state-panel>`;
    if (!this.data) {
      return this.error
        ? html`<sw-state-panel data-panel-state="error" state="error" heading="לא ניתן לטעון את הרשימה" hint=${this.error}></sw-state-panel>`
        : html`<sw-state-panel state="loading"></sw-state-panel>`;
    }
    const d = this.data;
    const c = d.counts;
    const n: Record<ItemsFilter, number> = { all: c.total, active: c.active, inactive: c.inactive, unavailable: c.unavailable };
    const label: Record<ItemsFilter, string> = { all: 'הכול', active: m.active, inactive: m.inactive, unavailable: m.unavailable };
    const q = this.q.trim().toLowerCase();
    const match = (r: DeviceItem) => (this.filter === 'all' || rowState(r) === this.filter) && (!q || `${r.name} ${r.area_name} ${r.floor_name ?? ''} ${r.entity_id}`.toLowerCase().includes(q));
    const floors = d.floors
      .map((f) => ({ ...f, areas: f.areas.map((a) => ({ ...a, items: a.items.filter(match) })).filter((a) => a.items.length) }))
      .filter((f) => f.areas.length);
    const bulkOk = isApi() && !!m.master && d.can_bulk === true && canAnywhere('devices.control_bulk');
    const shown = floors.flatMap((f) => f.areas.flatMap((a) => a.items));
    const narrowed = this.filter !== 'all' || !!q;
    return html`<div class="top">
        ${this.kind === 'alarm' ? html`<a class="alarm-link" href="#/security/alarm" data-alarm-link @click=${() => this.close()}><sw-icon name="shield" size=${15}></sw-icon>פתח במסך האזעקה ›</a>` : nothing}
        <div class="ctlbar">
          <div class="seg" role="group" aria-label="סינון">
            ${m.order.map((f) => html`<button type="button" data-filter=${f} aria-pressed=${String(this.filter === f)} @click=${() => this.setFilter(f)}>${label[f]} <span>(${ltrNum(n[f])})</span></button>`)}
          </div>
          ${bulkOk ? this.renderMaster(shown, narrowed, d.name) : nothing}
          ${this.kind === 'locks' ? this.renderLockAllButton(shown) : nothing}
        </div>
        <label class="search"><sw-icon name="search" size=${14}></sw-icon><input type="search" data-panel-search placeholder=${`חיפוש ב${m.noun}…`} aria-label=${`חיפוש ב${m.noun}`} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /></label>
      </div>
      ${!c.total
        ? html`<sw-state-panel data-panel-state="empty" state="empty" heading=${`אין ${m.noun} ${this.scope === 'building' ? 'במבנה' : `${SCOPE_WORD[this.scope]} ${d.name}`}`} hint=${d.scoped ? 'רק התקנים שהוצבו במפה של הקומות שבהרשאתך מופיעים כאן.' : m.emptyHint}></sw-state-panel>`
        : !floors.length
          ? html`<sw-state-panel data-panel-state="no_match" state="empty" heading="אין פריטים שמתאימים לסינון" hint=${q ? 'נסו חיפוש אחר, או בחרו "הכול".' : 'בחרו "הכול" כדי לראות את כל הפריטים.'}></sw-state-panel>`
          : repeat(
              floors,
              (f) => f.floor_id,
              (f) => html`<section class="floor" data-panel-floor=${f.floor_id}>
                ${d.scope !== 'area' ? html`<h4>${bidi(f.name)}</h4>` : nothing}
                ${repeat(
                  f.areas,
                  (a) => a.area_id,
                  (a) => html`<div class="area" data-panel-area=${a.area_id}>
                    ${d.scope !== 'area' ? html`<h5><sw-icon name="home" size=${12}></sw-icon>${bidi(a.name)}</h5>` : nothing}
                    ${repeat(a.items, (r) => r.entity_id, (r) => this.renderRow(r))}
                  </div>`,
                )}
              </section>`,
            )}
      ${d.truncated ? html`<div class="note">מוצגים 500 הפריטים הראשונים.</div>` : nothing}
      ${bulkOk ? html`<devices-bulk-dialog @bulk-done=${() => void this.load()}></devices-bulk-dialog>` : nothing}
      ${this.kind === 'locks' ? html`${this.renderUnlockDialog()}${this.renderLockAllDialog()}` : nothing}`;
  }

  /** The master control (owner 2026-09-29): acts on the rows the panel shows (its scope, filter and search) through
   * the existing bulk flow - its confirmation dialog, its rules (only what the caller may control in bulk; a switch
   * only when marked bulk-safe), batches, per-item result and audit. On / off: filled while any shown device is on
   * (a press turns them all off), outline when all are off (a press turns them all on), with a count badge when only
   * some are on. Covers: open all and close all. */
  private renderMaster(shown: DeviceItem[], narrowed: boolean, name: string) {
    const master = KIND_META[this.kind].master!;
    const only = narrowed ? shown.map((r) => r.entity_id) : undefined;
    const avail = shown.filter((r) => rowState(r) !== 'unavailable');
    const on = avail.filter((r) => rowState(r) === 'active').length;
    const ask = (kind: BulkKind) => void this.bulkDialog?.show({ scope: this.scope, id: this.scope === 'building' ? '*' : this.scopeId, name, kind, only, ask: true });
    if ('open' in master) {
      return html`<div class="master-group" data-panel-master="covers">
        <button type="button" class="master" data-master=${master.open} aria-label=${master.openLabel} title=${master.openLabel} ?disabled=${!avail.length} @click=${() => ask(master.open)}><sw-icon name="coverOpen" size=${20}></sw-icon></button>
        <button type="button" class="master" data-master=${master.close} aria-label=${master.closeLabel} title=${master.closeLabel} ?disabled=${!avail.length} @click=${() => ask(master.close)}><sw-icon name="coverClose" size=${20}></sw-icon></button>
      </div>`;
    }
    const state = on === 0 ? 'off' : on === avail.length ? 'on' : 'mixed';
    const words = on ? master.offLabel : master.onLabel;
    return html`<button type="button" class="master" data-panel-master=${this.kind} data-master=${on ? master.off : master.on} data-state=${state} aria-pressed=${String(on > 0)}
      aria-label=${state === 'mixed' ? `${words} (${on} מתוך ${avail.length} פעילים)` : words} title=${words} ?disabled=${!avail.length} @click=${() => ask(on ? master.off : master.on)}>
      <sw-icon name="power" size=${20}></sw-icon>${state === 'mixed' ? html`<span class="badge" data-master-badge aria-hidden="true">${ltrNum(on)}</span>` : nothing}
    </button>`;
  }

  /** Lock-all (owner 2026-09-29; never unlock-all). A lock is not a bulk kind - CR-007 keeps locks out of the bulk
   * path entirely - so this is one confirmation for the shown unlocked locks the caller may control, then the
   * ordinary single-entity lock.lock action for each, ONE AT A TIME, each with its own result. */
  private renderLockAllButton(shown: DeviceItem[]) {
    const mine = shown.filter((r) => r.can_control && rowState(r) !== 'unavailable');
    if (!isApi() || !mine.length) return nothing;
    const open = mine.filter((r) => !r.locked);
    const words = 'נעל את כל המנעולים';
    return html`<button type="button" class="master" data-panel-master="locks" data-master="lock_all" aria-label=${open.length ? `${words} (${open.length} לא נעולים)` : `${words} - כולם נעולים`} title=${words} ?disabled=${!open.length}
      @click=${() => (this.lockAll = { rows: open, step: 'confirm', out: {} })}>
      <sw-icon name="lock" size=${20}></sw-icon>${open.length ? html`<span class="badge" aria-hidden="true">${ltrNum(open.length)}</span>` : nothing}
    </button>`;
  }

  private async runLockAll() {
    const la = this.lockAll;
    if (!la || la.step !== 'confirm') return;
    this.lockAll = { ...la, step: 'running' };
    for (const r of la.rows) {
      const key = `${r.entity_id}:lock`;
      await runCommand(key, 'lock', r.entity_id, 'lock.lock', {}, 'locked', (s) => {
        this.ctl.setCmd(key, s);
        if (this.lockAll) this.lockAll = { ...this.lockAll, out: { ...this.lockAll.out, [r.entity_id]: s.phase } };
      }, { label: 'נעילה' });
    }
    if (this.lockAll) this.lockAll = { ...this.lockAll, step: 'done' };
    this.schedule();
  }

  private renderLockAllDialog() {
    const la = this.lockAll;
    if (!la) return html`<sw-dialog data-lock-all-dialog="closed"></sw-dialog>`;
    const word: Record<CommandPhase, string> = { pending: 'ממתין לאישור', confirmed: 'ננעל', sent: 'נשלח', rolled_back: 'לא ננעל' };
    const done = Object.values(la.out).filter((x) => x === 'confirmed').length;
    return html`<sw-dialog open data-lock-all-dialog=${la.step} heading="נעילת מנעולים" subheading="כל מנעול ננעל בפעולה נפרדת, אחד אחרי השני" @close=${() => la.step !== 'running' && (this.lockAll = null)}>
      <div class="unlock-what" data-lock-all-question>${la.step === 'confirm' ? (la.rows.length === 1 ? 'לנעול מנעול אחד?' : `לנעול ${la.rows.length} מנעולים?`) : `ננעלו ${done} מתוך ${la.rows.length}`}</div>
      <details ?open=${la.step !== 'confirm'}><summary>רשימת המנעולים</summary>
        <ul class="la-list">${la.rows.map((r) => html`<li data-lock-all-item=${r.entity_id} data-outcome=${la.out[r.entity_id] ?? ''}>${bidi(r.name)} <span class="note">· ${bidi(r.area_name)}${la.out[r.entity_id] ? ` · ${word[la.out[r.entity_id]]}` : ''}</span></li>`)}</ul>
      </details>
      <div class="unlock-actions">
        ${la.step === 'confirm'
          ? html`<sw-button data-lock-all-cancel autofocus @click=${() => (this.lockAll = null)}>ביטול</sw-button>
              <sw-button data-lock-all-confirm variant="primary" icon="lock" @click=${() => void this.runLockAll()}>נעל (${ltrNum(la.rows.length)})</sw-button>`
          : html`<sw-button data-lock-all-close ?disabled=${la.step === 'running'} @click=${() => (this.lockAll = null)}>סגור</sw-button>`}
      </div>
    </sw-dialog>`;
  }

  private renderRow(r: DeviceItem) {
    const st = rowState(r);
    const reason = readOnlyReason(r, this.kind, !isApi());
    const controllable = !reason;
    const on = st === 'active' && this.kind !== 'locks' && this.kind !== 'alarm';
    const m = KIND_META[this.kind];
    const icon: IconName = this.kind === 'locks' ? (r.locked ? 'lock' : 'unlock') : m.icon;
    const stateText = this.kind === 'alarm' ? (st === 'unavailable' ? 'לא זמין' : (ALARM_HE[r.state ?? ''] ?? r.state ?? 'לא ידוע')) : this.kind === 'locks' ? (st === 'unavailable' ? 'לא זמין' : r.locked ? 'נעול' : r.state === 'unlocked' ? 'לא נעול' : (r.state ?? 'לא ידוע')) : this.kind === 'climate' && r.domain === 'climate' && st !== 'unavailable' ? `${rowLabel(r)}${r.current_temperature !== null && r.current_temperature !== undefined ? ` · ${ltrNum(r.current_temperature)}°` : ''}${r.target_temperature !== null && r.target_temperature !== undefined ? ` · יעד ${ltrNum(r.target_temperature)}°` : ''}` : rowLabel(r);
    const toggleKinds = this.kind === 'lights' || this.kind === 'switches';
    const dimmable = this.kind === 'lights' && r.color_mode !== 'onoff' && (on || this.ctl.live<boolean>(r.entity_id, 'power') === true);
    return html`<div class=${classMap({ row: true, on, unavailable: st === 'unavailable', pending: controllable && this.ctl.rowPending(r.entity_id) })}
      data-entity=${r.entity_id} data-state=${st} ?data-can-control=${controllable}>
      <sw-icon .name=${icon} size=${16}></sw-icon>
      <div class="txt">
        <div class="nm" title=${r.name}>${bidi(r.name)}</div>
        <div class="st"><span data-row-state>${stateText}</span>${r.last_changed ? html` · <span class="lc" data-last-changed title=${new Date(r.last_changed).toLocaleString('he-IL')}>${changedAt(r.last_changed)}</span>` : nothing}</div>
      </div>
      <div class="end">
        ${controllable && toggleKinds ? this.ctl.renderPowerToggle(r) : nothing}
        ${!controllable
          ? html`<button type="button" class="ro" data-readonly title=${reason} aria-expanded=${String(this.why === r.entity_id)} aria-label=${`לקריאה בלבד: ${reason}`} @click=${() => (this.why = this.why === r.entity_id ? null : r.entity_id)}><sw-icon name="info" size=${12}></sw-icon>לקריאה בלבד</button>`
          : nothing}
      </div>
      ${!controllable && this.why === r.entity_id ? html`<div class="why" data-readonly-why role="note">${reason}</div>` : nothing}
      ${controllable && dimmable ? this.ctl.renderBrightnessSlider(r) : nothing}
      ${controllable && this.kind === 'covers' ? this.ctl.renderCoverControls(r) : nothing}
      ${controllable && this.kind === 'climate' ? this.ctl.renderClimateControls(r) : nothing}
      ${controllable && this.kind === 'media' ? this.ctl.renderMediaControls(r) : nothing}
      ${controllable && this.kind === 'locks' ? this.ctl.renderLockControls(r, (row) => (this.unlocking = row as DeviceItem)) : nothing}
      ${controllable ? this.ctl.renderCmdStatus(r.entity_id) : nothing}
    </div>`;
  }

  /** Unlock is never one tap: this dialog names the lock and its place, focus starts on "ביטול", and only its confirm
   * button sends lock.unlock (with the confirmation grant; the server still requires door.unlock). */
  private renderUnlockDialog() {
    const r = this.unlocking;
    if (!r) return html`<sw-dialog data-unlock-dialog="closed"></sw-dialog>`;
    return html`<sw-dialog open data-unlock-dialog="open" heading="פתיחת מנעול" subheading=${`${r.name} · ${r.area_name}`} @close=${() => (this.unlocking = null)}>
      <div class="unlock-what">לפתוח את <b>${bidi(r.name)}</b> (${bidi(r.area_name)})? הדלת תישאר לא נעולה עד שתינעל שוב.</div>
      <div class="unlock-actions">
        <sw-button data-unlock-cancel autofocus @click=${() => (this.unlocking = null)}>ביטול</sw-button>
        <sw-button data-unlock-confirm variant="danger" icon="unlock" @click=${() => {
          const row = this.unlocking;
          this.unlocking = null;
          if (row) this.ctl.runUnlock(row);
        }}>פתח את המנעול</sw-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-tiles-panel': DevicesTilesPanel;
  }
}
