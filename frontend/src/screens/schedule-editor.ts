import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import '../components/sw-toggle';
import '../components/sw-state-panel';
import '../components/sw-schedule-grid';
import type { GridRowView, GridSlotView, SwScheduleGrid } from '../components/sw-schedule-grid';
import { LEGEND } from '../components/sw-schedule-grid';
import './schedule-slot-panel';
import './schedule-table-view';
import './schedule-entity-picker';
import './schedule-conditions';
import './schedule-lowering-dialog';
import './schedule-create-dialog';
import './schedules-week-view';
import '../components/sw-schedule-bar';
import { ApiError, describeError } from '../api/client';
import { isApi } from '../api/session';
import { DEMO_SUN } from '../api/schedules-mock';
import {
  DAY_LONG,
  DAY_ORDER,
  DAY_SHORT,
  SUN_FALLBACK,
  actionLabel,
  approximateUpcoming,
  conditionSummary,
  createSchedule,
  daysLabel,
  detectPreset,
  draftFromSchedule,
  emptyDraft,
  formatTime,
  getSchedule,
  getScheduleCatalog,
  getScheduleStatus,
  parseTime,
  previewSchedule,
  resolveDays,
  splitSchedule,
  subscribeSchedules,
  updateSchedule,
  whenLabel,
  type CatalogEntity,
  type ConditionPreset,
  type DayId,
  type DraftConditions,
  type PreviewResult,
  type Problem,
  type RepeatType,
  type Schedule,
  type ScheduleConditions,
  type ScheduleDraft,
  type ScheduleStatus,
  type SunTimes,
} from '../api/schedules';
import { navigate, parseRoute } from '../router';
import { devicesStyleTokens } from './devices-style';
import { mediaGlassKnobs, mediaBubbleKnobs } from '../styles/media-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import {
  addEntitiesToSlots,
  classOfEntity,
  cloneSlots,
  compareDrafts,
  entitiesOf,
  estimateSun,
  groupActions,
  isLoweringAction,
  isSensitiveAction,
  loweringSummary,
  makeOffSlot,
  metaFromCatalog,
  metaFromSchedule,
  motzashDraft,
  newSlotActions,
  pairedOffSlot,
  planSplit,
  plainSlots,
  removeEntityFromSlots,
  sameDraft,
  slotOfPath,
  validateDraft,
  withUid,
  type EditSlot,
  type LoweringSummary,
  type MetaMap,
} from './schedule-edit-logic';
import {
  addSlot,
  createSlot,
  dayRows,
  duplicateSlot,
  isSun,
  moveSlot,
  removeSlot,
  resizeSlot,
  slotCategory,
  sorted,
  spanOf,
  toggleDay,
  tokensOf,
  type OpOptions,
  type SlotCategory,
} from './schedule-grid-logic';
import { NEW_DRAFT_KEY } from './schedule-create-dialog';
import { TEMPLATES, templateById, withPreset, type TemplateDraft } from './schedule-templates';

/**
 * CR-014 S4: the schedule editor (mockup 05-09, 17-19 editor level, 21, 24-25).
 *
 * Route (S3 mounts it): `#/devices/schedules/<id>/edit` → `<schedule-editor .scheduleId=${id}>`, and
 * `#/devices/schedules/new/edit?template=<id>&preset=<id>` (or `?draft=1` from the quick create) for a new one.
 *
 * One model drives the three views of the 24-hour scheme: the week grid (7 days x 24 h, the days of the schedule linked - the
 * component keeps ONE set of slots and ONE day set per schedule), the day view (a vertical timeline on a phone) and the table
 * of the same rows. A difference for some days only is the split: "עריכה רק ל…" edits those days as a separate arrangement and
 * saving asks to split the schedule (server op `split`), never silently.
 *
 * Everything the server decides stays the server's: the preview validates and lists the next runs, a save carries the
 * revision it was based on (409 → the conflict banner), a schedule that lowers protection needs the explicit confirmation.
 */

type EditView = 'week' | 'day' | 'table';
/** A finding with its path always present (the server may leave it out). */
type Found = Problem & { path: string };
const withPath = (p: Problem): Found => ({ ...p, path: p.path ?? '' });
interface EditDraft extends Omit<ScheduleDraft, 'slots'> {
  slots: EditSlot[];
}

const VIEW_KEY = 'sw.schedules.editor_view';
const STASH_PREFIX = 'sw.schedules.stash.';

function readView(): EditView | null {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'week' || v === 'day' || v === 'table' ? v : null;
  } catch {
    return null;
  }
}

function safeSession(op: 'get' | 'set' | 'del', key: string, value?: string): string | null {
  try {
    if (op === 'get') return sessionStorage.getItem(key);
    if (op === 'set') sessionStorage.setItem(key, value ?? '');
    else sessionStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
  return null;
}

const CAT_ICON: Record<SlotCategory, GridSlotView['icon']> = { on: 'power', off: 'power', level: 'light', climate: 'thermo', cover: 'blinds', secure: 'shield', custom: 'lock', empty: 'plus' };

@customElement('schedule-editor')
export class ScheduleEditor extends LitElement {
  /** The schedule's id; empty (or "new") = a new schedule. */
  @property() scheduleId = '';
  /** A new schedule: the template of the create flow (`?template=`) and the holiday preset laid over it (`?preset=`). */
  @property() template = '';
  @property() preset = '';
  /** CR-032: a device to start a new schedule with (the activity popup's "תזמון חדש להתקן"); the route's `entity` parameter does the same. */
  @property() entity = '';
  /** Today's sunrise / sunset in minutes, when the caller knows them (else the demo / fallback values, marked as estimates). */
  @property({ attribute: false }) sun: SunTimes | null = null;

  @state() private loading = true;
  @state() private loadError = '';
  @state() private forbidden = false;
  @state() private status: ScheduleStatus | null = null;
  @state() private schedule: Schedule | null = null;
  @state() private draft: EditDraft = { ...emptyDraft(), slots: [] };
  @state() private override: { days: DayId[]; slots: EditSlot[] } | null = null;
  @state() private meta: MetaMap = new Map();
  @state() private lockedUids: Record<string, Problem[]> = {};
  @state() private enabledNew = true;
  @state() private view: EditView = 'week';
  @state() private day: DayId = 'sun';
  @state() private selected = '';
  @state() private snap = 15;
  @state() private phone = false;
  @state() private phoneTab: 'board' | 'settings' = 'board';
  @state() private preview: PreviewResult | null = null;
  @state() private showErrors = false;
  @state() private saving = false;
  @state() private saveError = '';
  @state() private note = '';
  @state() private pickerOpen = false;
  @state() private copyOpen = false;
  @state() private copyPick: DayId[] = [];
  @state() private splitDialog: { name: string } | null = null;
  @state() private lowering: { summary: LoweringSummary; needsCode: boolean; kind: 'save' | 'split'; error: string } | null = null;
  @state() private conflict: { current: Schedule } | null = null;
  @state() private compareOpen = false;
  @state() private leave: { href: string } | null = null;
  @state() private gone = false;
  @state() private stash: { draft: ScheduleDraft } | null = null;
  @state() private nowMin = 0;
  @state() private condNames: Record<string, string> = {};
  @state() private chosen: string[] = [];

  private baseline: ScheduleDraft = emptyDraft();
  private baseRevision = '';
  private previewToken = 0;
  private previewTimer = 0;
  private stopSub: (() => void) | null = null;
  private clockTimer = 0;
  private mq: MediaQueryList | null = null;
  private loadedFor = '';
  private loadedKey = '\u0000';
  private savedOk = false;

  static styles = [...devicesStyleTokens, mediaGlassKnobs, mediaBubbleKnobs, css`
    :host {
      display: block;
      min-block-size: 100%;
    }
    .actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .ver {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-pill);
      padding: 1px 8px;
      font-family: var(--sw-font-mono);
    }
    .banner {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 10px 14px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      border: 1px solid transparent;
    }
    .banner .sp {
      flex: 1;
      min-inline-size: 8px;
    }
    .banner.warn {
      background: var(--sw-warning-soft);
      color: #92400e;
      border-color: #fde3b0;
    }
    .banner.err {
      background: var(--sw-danger-soft);
      color: #991b1b;
      border-color: #f6c7c7;
    }
    .banner.info {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .banner.ok {
      background: var(--sw-success-soft);
      color: #166534;
    }
    .banner ul {
      margin: 0;
      padding-inline-start: 18px;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 14px;
      align-items: start;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-inline-size: 0;
    }
    .card {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      padding: 14px 16px;
      box-shadow: var(--sw-shadow-1);
      min-inline-size: 0;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 10px;
    }
    .toolbar .sp {
      flex: 1;
    }
    .seg {
      display: inline-flex;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 2px;
    }
    .seg button {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 0;
      background: none;
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding: 5px 12px;
      border-radius: 6px;
      color: var(--sw-text-2);
      cursor: pointer;
      min-block-size: 30px;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
      font-weight: var(--sw-fw-semibold);
    }
    .seg button:focus-visible {
      outline: 2px solid var(--sw-focus);
    }
    label.snap {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    select,
    input[type='text'],
    input[type='date'] {
      min-block-size: 32px;
      box-sizing: border-box;
      padding: 4px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    select:focus,
    input:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      align-items: center;
      margin-block-end: 8px;
    }
    .legend .k {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .legend .sw {
      inline-size: 14px;
      block-size: 10px;
      border-radius: 3px;
      border-inline-start: 4px solid var(--c);
      background: var(--bg);
    }
    .legend .now {
      display: inline-block;
      inline-size: 14px;
      block-size: 2px;
      background: var(--sw-danger);
    }
    .c-on {
      --c: #16a34a;
      --bg: rgba(34, 197, 94, 0.16);
    }
    .c-off {
      --c: #64748b;
      --bg: rgba(100, 116, 139, 0.15);
    }
    .c-level {
      --c: #d97706;
      --bg: rgba(245, 158, 11, 0.18);
    }
    .c-climate {
      --c: #2767ed;
      --bg: rgba(39, 103, 237, 0.14);
    }
    .c-cover {
      --c: #0d9488;
      --bg: rgba(20, 184, 166, 0.16);
    }
    .c-secure {
      --c: #7c3aed;
      --bg: rgba(139, 92, 246, 0.15);
    }
    .linked {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 9px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    .chip.sens {
      background: rgba(139, 92, 246, 0.14);
      color: #6d28d9;
    }
    .chip.warn {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .foot {
      margin-block-start: 8px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .dayrow {
      display: flex;
      gap: 6px;
      margin-block-end: 10px;
    }
    .dayrow button {
      flex: 1;
      min-block-size: 46px;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      border-radius: var(--sw-r-md);
      font: inherit;
      color: var(--sw-text);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
    }
    .dayrow button b {
      font-size: var(--sw-fs-md);
    }
    .dayrow button small {
      font-size: 10px;
      color: var(--sw-text-3);
    }
    .dayrow button[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
    }
    .dayrow button[aria-pressed='true'] small {
      color: rgba(255, 255, 255, 0.85);
    }
    .dayrow button.off {
      border-style: dashed;
      color: var(--sw-text-3);
    }
    /* ------------------------------------------------------------------ side */
    .side h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 8px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .side h4 small {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    .sec {
      padding-block: 14px;
      border-block-start: 1px solid var(--sw-border);
    }
    .sec:first-child {
      border-block-start: 0;
      padding-block-start: 0;
    }
    .status {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      margin-block-end: 14px;
    }
    .status.ok {
      background: var(--sw-success-soft);
      color: #166534;
    }
    .status.bad {
      background: var(--sw-danger-soft);
      color: #991b1b;
    }
    .status ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .status button {
      border: 0;
      background: none;
      font: inherit;
      color: inherit;
      text-align: start;
      padding: 0;
      cursor: pointer;
      text-decoration: underline;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-block-end: 8px;
    }
    .field > label {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    .field input[type='text'] {
      inline-size: 100%;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .ent {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 4px 2px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-sm);
    }
    .ent button {
      display: grid;
      place-items: center;
      inline-size: 20px;
      block-size: 20px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--sw-text-3);
      cursor: pointer;
    }
    .ent button:hover {
      background: var(--sw-border);
      color: var(--sw-text);
    }
    .days {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-block-end: 8px;
    }
    .days button {
      inline-size: 34px;
      block-size: 34px;
      border-radius: 50%;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      color: var(--sw-text);
    }
    .days button[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
    }
    .days button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .quick {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .quick button {
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      border-radius: var(--sw-r-sm);
      padding: 4px 10px;
      min-block-size: 30px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      color: var(--sw-text);
    }
    .quick button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .hint {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin-block-start: 6px;
    }
    .repeat {
      display: flex;
    }
    .repeat button {
      flex: 1;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      padding: 6px 4px;
      cursor: pointer;
      color: var(--sw-text);
    }
    .repeat button:first-child {
      border-start-start-radius: var(--sw-r-sm);
      border-end-start-radius: var(--sw-r-sm);
    }
    .repeat button:last-child {
      border-start-end-radius: var(--sw-r-sm);
      border-end-end-radius: var(--sw-r-sm);
    }
    .repeat button[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
    }
    .dates {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .dates .field {
      margin: 0;
    }
    .dates input {
      inline-size: 100%;
    }
    .runs {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .runs li {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      padding: 6px 10px;
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-sm);
    }
    .runs li span:last-child {
      color: var(--sw-text-2);
    }
    .runs .cond {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .tabs {
      display: none;
    }
    .panelcard {
      margin-block-start: 14px;
    }
    .empty-board {
      padding: 26px 12px;
      text-align: center;
      color: var(--sw-text-3);
    }
    .weekhead {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    @media (max-width: 1100px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    @media (max-width: 767px) {
      .tabs {
        display: flex;
        background: var(--sw-surface);
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
        overflow: hidden;
      }
      .tabs button {
        flex: 1;
        border: 0;
        background: none;
        font: inherit;
        font-weight: var(--sw-fw-medium);
        padding: 10px;
        color: var(--sw-text-2);
        cursor: pointer;
      }
      .tabs button[aria-selected='true'] {
        background: var(--sw-accent);
        color: #fff;
      }
      .layout[data-tab='board'] .side,
      .layout[data-tab='settings'] .boardcol {
        display: none;
      }
      .card {
        padding: 12px;
      }
      .toolbar .seg button {
        padding: 5px 9px;
      }
    }
  `];

  // ------------------------------------------------------------------------------------------------ lifecycle

  connectedCallback() {
    super.connectedCallback();
    // owner 2026-10-04 (docs/design/schedules-parity.md): the editor wears the automations area's material - the glass knobs bridged
    // to the v2 tokens every rule below and every nested component reads (styles/devices-themes.ts), light or dark by devices.scheme,
    // the bubble skin through its knobs. Only the token layer: the editor keeps its own layout (the week board needs the full page).
    applyAutomationsGlass(this);
    this.mq = window.matchMedia('(max-width: 767px)');
    this.phone = this.mq.matches;
    this.mq.addEventListener('change', this.onMq);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    document.addEventListener('click', this.onDocClick, true);
    this.tick();
    this.clockTimer = window.setInterval(() => this.tick(), 30_000);
    this.stopSub = subscribeSchedules(() => void this.refreshRemote());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mq?.removeEventListener('change', this.onMq);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    document.removeEventListener('click', this.onDocClick, true);
    window.clearInterval(this.clockTimer);
    window.clearTimeout(this.previewTimer);
    this.stopSub?.();
    this.stopSub = null;
    // leaving with unsaved edits (a nav-rail click, the back button): keep the draft for the next visit
    if (this.dirty && !this.savedOk && this.loadedFor) safeSession('set', STASH_PREFIX + this.loadedFor, JSON.stringify({ draft: this.currentDraft() }));
  }

  private onMq = (e: MediaQueryListEvent) => {
    this.phone = e.matches;
    if (e.matches && this.view === 'week') this.view = 'day';
  };

  private tick() {
    const d = new Date();
    this.nowMin = d.getHours() * 60 + d.getMinutes();
  }

  willUpdate() {
    this.valCache = null;
    this.ebuCache = null;
    // the route decides what opens: an id, or nothing / "new" plus the template and preset of the create flow
    const key = `${this.scheduleId}|${this.template}|${this.preset}`;
    if (key !== this.loadedKey) {
      this.loadedKey = key;
      this.loadedFor = this.creating ? 'new' : this.scheduleId;
      void this.load();
    }
  }

  // ------------------------------------------------------------------------------------------------ derived state

  /** No id (S3's `#/devices/schedules/new/edit` passes an empty one) or the word "new": a schedule being created. */
  private get creating() {
    return !this.scheduleId || this.scheduleId === 'new';
  }

  private get sunBase(): SunTimes {
    return this.sun ?? (isApi() ? SUN_FALLBACK : DEMO_SUN);
  }

  private get sunNow(): SunTimes {
    return this.preview ? estimateSun({ slots: this.draft.slots }, this.preview.upcoming, this.sunBase) : this.sunBase;
  }

  private get allowNegativeSun() {
    return !!this.status?.capabilities.negative_sun_offset;
  }

  private get opts(): OpOptions {
    return { step: this.snap, sun: this.sunNow, allowNegativeSun: this.allowNegativeSun };
  }

  /** The person cannot change this schedule (no permission, unsupported content, writes blocked): a viewing mode. */
  private get readOnly(): boolean {
    if (this.creating) return !this.status?.can.manage || this.status.writable === false;
    return !this.schedule || !this.schedule.can.edit;
  }

  private get work(): EditSlot[] {
    return this.override ? this.override.slots : this.draft.slots;
  }

  private currentDraft(): ScheduleDraft {
    return { ...this.draft, name: (this.draft.name ?? '').trim() === '' ? (this.creating ? '' : this.draft.name ?? '') : this.draft.name, slots: plainSlots(this.draft.slots) };
  }

  private get dirty(): boolean {
    if (this.loading || !this.loadedFor) return false;
    return !!this.override || !sameDraft(this.currentDraft(), this.baseline);
  }

  private get classOf() {
    return (id: string | null) => classOfEntity(this.meta, id);
  }

  private valCache: { errors: Found[]; warnings: Found[] } | null = null;
  private ebuCache: Record<string, Problem[]> | null = null;

  private get validation(): { errors: Found[]; warnings: Found[] } {
    return (this.valCache ??= this.computeValidation());
  }

  private computeValidation(): { errors: Found[]; warnings: Found[] } {
    const v = validateDraft(this.currentDraft(), { creating: this.creating, meta: this.meta, sun: this.sunNow, original: this.baseline, lockedConditions: this.schedule?.conditions.items ?? [] });
    let errors: Found[] = v.errors.map(withPath);
    const warnings: Found[] = v.warnings.map(withPath);
    if (this.override) {
      const o = validateDraft({ ...this.currentDraft(), weekdays: tokensOf(this.override.days), slots: plainSlots(this.override.slots) }, { creating: false, meta: this.meta, sun: this.sunNow, original: this.baseline, lockedConditions: this.schedule?.conditions.items ?? [] });
      errors = [...errors, ...o.errors.map(withPath).filter((e) => e.path.startsWith('slots')).map((e) => ({ ...e, path: `override.${e.path}` }))];
    }
    // the server's own findings (preview) join, without repeating what is already said
    for (const e of (this.preview?.errors ?? []).map(withPath)) if (!errors.some((x) => x.path === e.path && x.message === e.message)) errors = [...errors, e];
    for (const w of (this.preview?.warnings ?? []).map(withPath)) if (!warnings.some((x) => x.path === w.path && x.message === w.message)) warnings.push(w);
    return { errors, warnings };
  }

  private errorsByUid(): Record<string, Problem[]> {
    return (this.ebuCache ??= this.computeErrorsByUid());
  }

  private computeErrorsByUid(): Record<string, Problem[]> {
    const out: Record<string, Problem[]> = {};
    for (const e of this.validation.errors) {
      const over = e.path.startsWith('override.');
      const i = slotOfPath(over ? e.path.slice('override.'.length) : e.path);
      const slot = i >= 0 ? (over ? this.override?.slots[i] : this.draft.slots[i]) : undefined;
      if (slot) (out[slot.uid] ??= []).push(e);
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------------ loading

  private async load() {
    this.loading = true;
    this.loadError = '';
    this.forbidden = false;
    this.override = null;
    this.selected = '';
    this.conflict = null;
    this.gone = false;
    this.savedOk = false;
    this.preview = null;
    this.stash = null;
    const id = this.scheduleId;
    const key = this.loadedKey;
    try {
      const [status, sched, cat] = await Promise.all([
        getScheduleStatus().catch(() => null),
        this.creating ? Promise.resolve(null) : getSchedule(id),
        getScheduleCatalog().catch(() => null),
      ]);
      if (key !== this.loadedKey) return;
      this.status = status;
      this.snap = status?.settings.snap_minutes ?? 15;
      const catalog = cat?.entities ?? [];
      const stored = readView();
      this.view = this.phone ? 'day' : stored ?? 'week';
      let meta: MetaMap = metaFromSchedule(sched);
      meta = metaFromCatalog(catalog, meta);
      this.meta = meta;
      if (sched) this.adopt(sched);
      else this.startNew(status, meta);
      const raw = safeSession('get', STASH_PREFIX + this.loadedFor);
      if (raw) {
        try {
          this.stash = JSON.parse(raw) as { draft: ScheduleDraft };
        } catch {
          this.stash = null;
        }
      }
      const active = resolveDays(this.draft.weekdays) ?? [];
      const today = DAY_ORDER[new Date().getDay()];
      this.day = active.includes(today) ? today : active[0] ?? 'sun';
      this.loading = false;
      this.schedulePreview(0);
      // a new schedule from a template starts with the device picker (the template says what, not for which devices)
      if (this.creating && this.draft.slots.length && !entitiesOf(this.draft.slots).length && !this.readOnly) this.pickerOpen = true;
    } catch (e) {
      if (key !== this.loadedKey) return;
      this.loading = false;
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) this.forbidden = true;
      this.loadError = describeError(e);
    }
  }

  /** Take a loaded schedule as the editor's state (first load, "load the latest", a silent refresh). */
  private adopt(s: Schedule) {
    this.schedule = s;
    this.baseRevision = s.revision;
    const d = draftFromSchedule(s);
    const slots = d.slots.map(withUid);
    const locked: Record<string, Problem[]> = {};
    s.slots.forEach((sl, i) => {
      if (!sl.supported) locked[slots[i].uid] = sl.unsupported.length ? sl.unsupported : [{ code: 'unsupported_content', message: 'התזמון כולל תוכן שהמערכת אינה מציגה במלואו.' }];
    });
    this.lockedUids = locked;
    this.chosen = [];
    this.meta = metaFromSchedule(s, new Map(this.meta));
    this.draft = { ...d, slots: sorted(slots, this.sunNow).slots };
    this.baseline = this.currentDraft();
    this.override = null;
    this.conflict = null;
    if (!this.draft.slots.some((x) => x.uid === this.selected)) this.selected = '';
  }

  private startNew(status: ScheduleStatus | null, meta: MetaMap) {
    const params = parseRoute().params;
    const sensor = status?.settings.shabbat_sensor?.entity_id ?? null;
    const repeat: RepeatType = status?.settings.default_repeat ?? 'repeat';
    let td: TemplateDraft | null = null;
    if (params.get('draft')) {
      const raw = safeSession('get', NEW_DRAFT_KEY);
      safeSession('del', NEW_DRAFT_KEY);
      if (raw) {
        try {
          const d = JSON.parse(raw) as ScheduleDraft;
          td = { ...d, slots: d.slots };
        } catch {
          td = null;
        }
      }
    }
    if (!td) {
      // the properties come from the route (S3); the address is read as well for a page that mounts the element by hand
      const tpl = templateById(this.template || params.get('template')) ?? TEMPLATES.find((t) => t.id === 'blank')!;
      td = tpl.build({ sensor, defaultRepeat: repeat, now: new Date() });
      const p = this.preset || params.get('preset');
      td = withPreset(td, p === 'only_holy_days' || p === 'not_holy_days' ? (p as ConditionPreset) : null, sensor);
    }
    this.schedule = null;
    this.baseRevision = '';
    this.meta = meta;
    this.lockedUids = {};
    const wanted = this.entity || params.get('entity') || '';
    this.chosen = wanted && meta.has(wanted) ? [wanted] : [];
    const slots = td.slots.map(withUid);
    this.draft = { ...td, slots: sorted(slots, this.sunNow).slots };
    this.baseline = this.currentDraft();
    this.enabledNew = true;
  }

  /** A change made elsewhere: quietly adopt it when nothing is unsaved here, else offer the choices. */
  private async refreshRemote() {
    if (this.creating || !this.scheduleId || this.loading || this.saving) return;
    try {
      const fresh = await getSchedule(this.scheduleId);
      if (fresh.revision === this.baseRevision) return;
      if (!this.dirty) this.adopt(fresh);
      else this.conflict = { current: fresh };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) this.gone = true;
    }
  }

  // ------------------------------------------------------------------------------------------------ unsaved guard

  private onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  /** A link inside the app that would leave the editor with edits unsaved: ask first. */
  private onDocClick = (e: MouseEvent) => {
    if (!this.dirty || e.defaultPrevented) return;
    const a = e.composedPath().find((n): n is HTMLAnchorElement => n instanceof HTMLAnchorElement && (n.getAttribute('href') ?? '').startsWith('#/'));
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    if (href.split('?')[0] === window.location.hash.split('?')[0]) return;
    e.preventDefault();
    e.stopPropagation();
    this.leave = { href };
  };

  private cancel() {
    const target = this.creating || !this.scheduleId ? '#/devices/schedules' : `#/devices/schedules/${encodeURIComponent(this.scheduleId)}`;
    if (this.dirty) {
      this.leave = { href: target };
      return;
    }
    this.go(target);
  }

  private go(href: string) {
    this.savedOk = true; // nothing to stash: the person chose to leave
    safeSession('del', STASH_PREFIX + this.loadedFor);
    if (href.startsWith('#')) navigate(href.slice(1).split('?')[0], Object.fromEntries(new URLSearchParams(href.split('?')[1] ?? '')));
    else window.location.assign(href);
  }

  // ------------------------------------------------------------------------------------------------ editing

  private mark() {
    this.valCache = null;
    this.ebuCache = null;
    this.saveError = '';
    this.savedOk = false;
    this.schedulePreview();
  }

  private setWork(slots: EditSlot[], keep?: string) {
    const s = sorted(slots, this.sunNow).slots;
    if (this.override) this.override = { ...this.override, slots: s };
    else this.draft = { ...this.draft, slots: s };
    if (keep) this.selected = keep;
    this.mark();
  }

  private patch(p: Partial<EditDraft>) {
    this.draft = { ...this.draft, ...p };
    this.mark();
  }

  private idxOf(uid: string, list: EditSlot[] = this.work) {
    return list.findIndex((s) => s.uid === uid);
  }

  private grid(): SwScheduleGrid | null {
    return this.renderRoot.querySelector('sw-schedule-grid');
  }

  private say(text: string) {
    this.grid()?.announce(text);
  }

  private onCreate(from: number, to: number) {
    const work = this.work;
    const r = createSlot(work, from, to, this.opts, withUid);
    if (!r) return this.say('אין מקום פנוי כאן.');
    const uid = r.slots[r.index].uid;
    const actions = newSlotActions(plainSlots(work), this.meta, (s) => spanOf(s, this.sunNow)?.start ?? 0, this.chosen);
    const slots = r.slots.map((s) => (s.uid === uid ? { ...s, actions } : s));
    this.setWork(slots, uid);
    this.reveal();
    this.say(`נוצרה משבצת ${(r.index ?? 0) + 1}.`);
  }

  private onAddButton() {
    const work = this.work;
    const r = addSlot(work, this.opts, 8 * 60, withUid);
    if (!r) return this.say('אין מקום למשבצת נוספת.');
    const uid = r.slots[r.index].uid;
    const actions = newSlotActions(plainSlots(work), this.meta, (s) => spanOf(s, this.sunNow)?.start ?? 0, this.chosen);
    this.setWork(r.slots.map((s) => (s.uid === uid ? { ...s, actions: s.actions.length ? s.actions : actions } : s)), uid);
    this.reveal();
  }

  /** On a phone the panel sits far below the timeline: bring it into view. On a wide screen it is already next to the board
   * and the page must not move under a pointer that is still working on the grid. */
  private reveal() {
    if (!this.phone) return;
    void this.updateComplete.then(() => this.renderRoot.querySelector('[data-panel-card]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  private onGrid(name: string, d: Record<string, unknown>) {
    const work = this.work;
    const key = String(d.key ?? '');
    const i = this.idxOf(key, work);
    switch (name) {
      case 'slot-select':
        this.selected = key;
        this.reveal();
        break;
      case 'slot-create':
        this.onCreate(Number(d.from), Number(d.to));
        break;
      case 'slot-move': {
        if (i < 0) return;
        const r = moveSlot(work, i, Number(d.delta), this.opts);
        this.setWork(r.slots, key);
        break;
      }
      case 'slot-resize': {
        if (i < 0) return;
        const r = resizeSlot(work, i, d.edge as 'start' | 'end', Number(d.minute), { ...this.opts, detach: !!d.detach });
        this.setWork(r.slots, key);
        break;
      }
      case 'slot-remove':
        if (i >= 0) this.removeAt(i);
        break;
      case 'row-add':
        if (!this.override) {
          this.patch({ weekdays: toggleDay(this.draft.weekdays, d.row as DayId) });
          this.day = d.row as DayId;
        }
        break;
      case 'row-select':
        if (DAY_ORDER.includes(d.row as DayId)) this.day = d.row as DayId;
        break;
    }
  }

  private removeAt(i: number) {
    const gone = this.work[i];
    if (!gone) return;
    this.setWork(removeSlot(this.work, i));
    if (this.selected === gone.uid) this.selected = '';
    this.say('המשבצת נמחקה.');
  }

  private onSlotChange(slot: EditSlot) {
    const i = this.idxOf(slot.uid);
    if (i < 0) return;
    const next = this.work.slice();
    next[i] = slot;
    this.setWork(next, slot.uid);
  }

  private onDuplicate(uid: string) {
    const i = this.idxOf(uid);
    if (i < 0) return;
    const r = duplicateSlot(this.work, i, this.opts, withUid);
    if (!r) return this.say('אין מקום לשכפול.');
    this.setWork(r.slots, r.slots[r.index].uid);
  }

  private onPairOff(on: boolean) {
    const i = this.idxOf(this.selected);
    if (i < 0) return;
    const work = this.work;
    const plain = plainSlots(work);
    if (!on) {
      const j = pairedOffSlot(plain, i);
      if (j !== null) this.setWork(removeSlot(work, j), work[i].uid);
      return;
    }
    const off = makeOffSlot(plain[i]);
    if (!off) return;
    const next = [...work, withUid(off)];
    if (sorted(next, this.sunNow).slots.some((_, a, all) => all.slice(a + 1).some((b, k) => this.overlapIdx(all[a], b, k)))) {
      this.saveError = '';
      this.note = 'אין מקום לכיבוי בסיום: קיימת משבצת בשעה הזו.';
      return;
    }
    this.setWork(next, work[i].uid);
  }

  private overlapIdx(a: EditSlot, b: EditSlot, _k: number): boolean {
    const x = spanOf(a, this.sunNow);
    const y = spanOf(b, this.sunNow);
    return !!x && !!y && x.start < y.end && y.start < x.end;
  }

  private setView(v: EditView) {
    this.view = v;
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* not persisted */
    }
  }

  // ------------------------------------------------------------------------------------------------ split (one day / some days)

  private get canSplit(): boolean {
    if (this.creating || this.readOnly || this.override) return false;
    const days = resolveDays(this.draft.weekdays);
    return !!days && days.length >= 2;
  }

  private startOverride(days: DayId[]) {
    this.override = { days, slots: cloneSlots(this.draft.slots) };
    this.selected = '';
    this.mark();
  }

  private cancelOverride() {
    this.override = null;
    this.selected = '';
    this.mark();
  }

  private openCopyDays() {
    this.copyPick = this.override ? [...this.override.days] : [];
    this.copyOpen = true;
  }

  private applyCopyDays() {
    if (this.override) {
      const all = resolveDays(this.draft.weekdays) ?? [];
      const days = all.filter((d) => this.copyPick.includes(d));
      if (days.length && days.length < all.length) this.override = { ...this.override, days };
    } else if (this.copyPick.length) {
      const cur = resolveDays(this.draft.weekdays) ?? [];
      this.patch({ weekdays: tokensOf([...new Set([...cur, ...this.copyPick])]) });
    }
    this.copyOpen = false;
  }

  // ------------------------------------------------------------------------------------------------ devices

  /** The devices in the slots' actions. */
  private get slotEntityIds(): string[] {
    return [...new Set([...entitiesOf(this.draft.slots), ...(this.override ? entitiesOf(this.override.slots) : [])])];
  }

  /** The schedule's devices: those in the slots and those chosen before any slot does something with them. */
  private get entityIds(): string[] {
    return [...new Set([...this.slotEntityIds, ...this.chosen.filter((id) => this.meta.has(id))])];
  }

  private onPicked(ids: string[], entities: CatalogEntity[]) {
    this.pickerOpen = false;
    const meta = metaFromCatalog(entities, new Map(this.meta));
    this.meta = meta;
    const have = this.slotEntityIds;
    const adds = ids.filter((id) => !have.includes(id)).map((id) => meta.get(id)).filter((m): m is NonNullable<typeof m> => !!m);
    const drops = have.filter((id) => !ids.includes(id));
    const apply = (slots: EditSlot[]) => drops.reduce((acc, id) => removeEntityFromSlots(acc, id), addEntitiesToSlots(slots, adds));
    this.chosen = ids;
    this.draft = { ...this.draft, slots: apply(this.draft.slots) };
    if (this.override) this.override = { ...this.override, slots: apply(this.override.slots) };
    this.mark();
  }

  private removeEntity(id: string) {
    this.chosen = this.chosen.filter((x) => x !== id);
    this.draft = { ...this.draft, slots: removeEntityFromSlots(this.draft.slots, id) };
    if (this.override) this.override = { ...this.override, slots: removeEntityFromSlots(this.override.slots, id) };
    this.mark();
  }

  // ------------------------------------------------------------------------------------------------ preview

  private schedulePreview(delay = 450) {
    window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => void this.runPreview(), delay);
  }

  private async runPreview() {
    if (this.loading || this.readOnly && !this.creating) {
      this.preview = null;
      return;
    }
    const draft = this.currentDraft();
    if (!draft.slots.length) {
      this.preview = null;
      return;
    }
    const token = ++this.previewToken;
    try {
      const p = await previewSchedule(draft, this.creating ? null : this.scheduleId, 6);
      if (token === this.previewToken) this.preview = p;
    } catch {
      if (token === this.previewToken) this.preview = null;
    }
  }

  // ------------------------------------------------------------------------------------------------ saving

  private sensitiveSig(d: ScheduleDraft): string {
    return d.slots
      .flatMap((s) => s.actions.filter((a) => isSensitiveAction(a, classOfEntity(this.meta, a.entity_id))).map((a) => `${a.service}|${a.entity_id}`))
      .sort()
      .join(',');
  }

  private async onSave() {
    if (this.readOnly || this.saving) return;
    this.showErrors = true;
    this.note = '';
    const { errors } = this.validation;
    if (errors.length) {
      const first = errors.find((e) => slotOfPath(e.path.replace(/^override\./, '')) >= 0);
      if (first) {
        const over = first.path.startsWith('override.');
        const list = over ? this.override?.slots : this.draft.slots;
        const s = list?.[slotOfPath(first.path.replace(/^override\./, ''))];
        if (s) this.selected = s.uid;
      }
      this.phoneTab = 'settings';
      return;
    }
    if (this.override) {
      const same = plainSlots(this.override.slots);
      if (JSON.stringify(same) === JSON.stringify(plainSlots(this.draft.slots))) this.override = null;
      else {
        this.splitDialog = { name: `${(this.draft.name ?? '').trim() || 'תזמון'} · ${this.override.days.map((d) => DAY_SHORT[d]).join(', ')}` };
        return;
      }
    }
    await this.persist();
  }

  /** Create or update; asks for the explicit confirmation of a sensitive schedule first. */
  private async persist(confirmed = false, alarmCode: string | null = null) {
    const draft = this.currentDraft();
    this.saving = true;
    this.saveError = '';
    try {
      const p = await previewSchedule(draft, this.creating ? null : this.scheduleId, 6);
      this.preview = p;
      if (!p.valid) {
        this.showErrors = true;
        this.saving = false;
        return;
      }
      const summary = loweringSummary(draft, this.meta);
      const sensitiveChanged = this.creating || this.sensitiveSig(draft) !== this.sensitiveSig(this.baseline);
      if (!confirmed && (p.requires.confirm_lowering || summary.lowering || (summary.sensitive && sensitiveChanged) || p.requires.alarm_code)) {
        this.lowering = { summary, needsCode: p.requires.alarm_code, kind: 'save', error: '' };
        this.saving = false;
        return;
      }
      const wire = { confirm_lowering: summary.lowering || p.requires.confirm_lowering, alarm_code: alarmCode };
      if (this.creating) {
        const r = await createSchedule(draft, { enabled: this.enabledNew, ...wire });
        this.lowering = null;
        this.savedOk = true;
        this.dispatchEvent(new CustomEvent('saved', { detail: { id: 'schedule' in r ? r.schedule.id : '' }, bubbles: true, composed: true }));
        if ('schedule' in r) {
          this.note = 'התזמון נוצר.';
          this.go(`#/devices/schedules/${encodeURIComponent(r.schedule.id)}`);
        } else {
          this.note = r.message;
          this.go('#/devices/schedules');
        }
      } else {
        const r = await updateSchedule(this.scheduleId, draft, this.baseRevision, wire);
        this.lowering = null;
        this.savedOk = true;
        this.adopt(r.schedule);
        this.note = 'השינויים נשמרו.';
        this.dispatchEvent(new CustomEvent('saved', { detail: { id: r.schedule.id }, bubbles: true, composed: true }));
        this.go(`#/devices/schedules/${encodeURIComponent(r.schedule.id)}`);
      }
    } catch (e) {
      this.handleSaveError(e, 'save');
    }
    this.saving = false;
  }

  private handleSaveError(e: unknown, kind: 'save' | 'split') {
    if (e instanceof ApiError) {
      const details = (e.body.details ?? {}) as Record<string, unknown>;
      if (e.code === 'schedule_changed' && details.current) {
        this.lowering = null;
        this.conflict = { current: details.current as Schedule };
        return;
      }
      if (e.code === 'lowering_confirmation_required' || e.code === 'code_required') {
        this.lowering = { summary: loweringSummary(this.currentDraft(), this.meta), needsCode: e.code === 'code_required', kind, error: '' };
        return;
      }
      if (e.code === 'wrong_code' && this.lowering) {
        this.lowering = { ...this.lowering, error: e.message };
        return;
      }
      if (e.code === 'validation' || e.code === 'slots_overlap') {
        const errs = (details.errors as Problem[] | undefined) ?? [];
        this.preview = { ...(this.preview ?? { valid: false, warnings: [], upcoming: [], conditional: false, sensitive: false, lowering: false, requires: { sensitive_permission: false, confirm_lowering: false, alarm_code: false } }), valid: false, errors: errs.length ? errs : [{ path: '', code: e.code, message: e.message }] };
        this.showErrors = true;
        this.lowering = null;
        return;
      }
    }
    if (this.lowering) this.lowering = { ...this.lowering, error: describeError(e) };
    this.saveError = describeError(e);
  }

  /** "עריכה רק ל…" saved: split first (the server copies the schedule for the chosen days), then write the halves. */
  private async persistSplit(name: string, confirmed = false, alarmCode: string | null = null) {
    if (!this.override) return;
    const plan = planSplit(this.currentDraft(), this.baseline, { days: this.override.days, slots: plainSlots(this.override.slots) });
    if (!plan.ok) {
      this.saveError = plan.error;
      this.splitDialog = null;
      return;
    }
    const summaries = [loweringSummary(plan.created, this.meta), loweringSummary(plan.originalUpdate ?? plan.afterSplit, this.meta)];
    const lowers = summaries.some((s) => s.lowering);
    if (!confirmed && (lowers || summaries.some((s) => s.sensitive && this.sensitiveSig(plan.created) !== this.sensitiveSig(this.baseline)))) {
      const merged: LoweringSummary = { entities: [...new Set(summaries.flatMap((s) => s.entities))], kinds: [...new Set(summaries.flatMap((s) => s.kinds))], times: summaries.map((s) => s.times).filter(Boolean).join(', '), sensitive: summaries.some((s) => s.sensitive), lowering: lowers };
      this.splitDialog = { name };
      this.lowering = { summary: merged, needsCode: false, kind: 'split', error: '' };
      return;
    }
    this.saving = true;
    this.saveError = '';
    const wire = { confirm_lowering: lowers, alarm_code: alarmCode };
    let stage = 'split';
    try {
      const s = await splitSchedule(this.scheduleId, this.baseRevision, plan.days, name.trim() || null);
      stage = 'update';
      if (plan.originalUpdate) await updateSchedule(s.original.id, plan.originalUpdate, s.original.revision, wire);
      await updateSchedule(s.created.id, { ...plan.created, name: name.trim() || s.created.name }, s.created.revision, wire);
      this.lowering = null;
      this.splitDialog = null;
      this.savedOk = true;
      this.override = null;
      this.dispatchEvent(new CustomEvent('saved', { detail: { id: s.original.id }, bubbles: true, composed: true }));
      this.go(`#/devices/schedules/${encodeURIComponent(s.original.id)}`);
    } catch (e) {
      this.splitDialog = null;
      this.handleSaveError(e, 'split');
      if (stage === 'update') this.saveError = `הפיצול בוצע, אך שמירת השינויים בתזמון נכשלה: ${this.saveError || describeError(e)} בדקו את שני התזמונים ברשימה.`;
    }
    this.saving = false;
  }

  private onLoweringConfirm(code: string | null) {
    const kind = this.lowering?.kind;
    if (kind === 'split') void this.persistSplit(this.splitDialog?.name ?? '', true, code);
    else void this.persist(true, code);
  }

  private keepMine() {
    if (!this.conflict) return;
    this.baseRevision = this.conflict.current.revision;
    this.conflict = null;
    void this.onSave();
  }

  private loadLatest() {
    if (!this.conflict) return;
    this.adopt(this.conflict.current);
    this.mark();
  }

  private restoreStash() {
    if (!this.stash) return;
    const d = this.stash.draft;
    this.draft = { ...d, slots: sorted(d.slots.map(withUid), this.sunNow).slots };
    this.stash = null;
    safeSession('del', STASH_PREFIX + this.loadedFor);
    this.mark();
  }

  private dropStash() {
    this.stash = null;
    safeSession('del', STASH_PREFIX + this.loadedFor);
  }

  // ------------------------------------------------------------------------------------------------ view models

  private slotView(s: EditSlot, order: number, count: number): GridSlotView {
    const span = spanOf(s, this.sunNow) ?? { start: 0, end: 1 };
    const cat = slotCategory(s, this.classOf);
    const g = groupActions(s.actions);
    const locked = !!this.lockedUids[s.uid];
    const first = g[0];
    const title = !first ? 'בחרו פעולה' : `${actionLabel({ service: first.service, data: first.data })}${g.length > 1 ? ` +${g.length - 1}` : ''}`;
    const st = parseTime(s.start);
    const sp = s.stop ? parseTime(s.stop) : null;
    // "שקיעה +00:30" keeps its sign after the offset: an LRM in front of the sign (the word before it is right-to-left)
    const shown = (t: ReturnType<typeof parseTime>) => formatTime(t).replace(/ ([+−])/, ' ‎$1');
    const timeLabel = `${shown(st)}${s.stop ? `–${s.stop === '00:00:00' ? '00:00' : shown(sp)}` : ''}`;
    const lowering = s.actions.some((a) => {
      const m = a.entity_id ? this.meta.get(a.entity_id) : undefined;
      return isLoweringAction(a, m?.class ?? null, m?.actions);
    });
    const sensitive = s.actions.some((a) => isSensitiveAction(a, classOfEntity(this.meta, a.entity_id)));
    const bad = !!this.errorsByUid()[s.uid]?.length;
    return {
      key: s.uid,
      start: span.start,
      end: span.end,
      category: locked ? 'custom' : cat,
      title,
      timeLabel,
      icon: CAT_ICON[cat],
      point: s.stop == null,
      sunStart: isSun(s.start),
      sunEnd: isSun(s.stop),
      locked,
      sensitive,
      lowering,
      invalid: this.showErrors && bad,
      aria: `משבצת ${order + 1} מתוך ${count}: ${title}, ${timeLabel}${lowering ? ', פותח או מנטרל' : sensitive ? ', פעולה רגישה' : ''}${locked ? ', לקריאה בלבד' : ''}`,
    };
  }

  private slotViews(slots: EditSlot[]): GridSlotView[] {
    return slots.map((s, i) => this.slotView(s, i, slots.length));
  }

  private gridRows(): GridRowView[] {
    const info = dayRows(this.draft.weekdays);
    const today = DAY_ORDER[new Date().getDay()];
    const ov = this.override;
    if (!info) return [{ key: 'all', label: daysLabel(this.draft.weekdays), active: true, slots: this.slotViews(this.draft.slots) }];
    return info.map((r) => {
      const inOv = !!ov && ov.days.includes(r.day);
      const slots = inOv ? ov!.slots : this.draft.slots;
      return {
        key: r.day,
        label: DAY_LONG[r.day],
        sub: r.active ? (r.day === today ? 'היום' : ov ? (inOv ? 'פיצול' : 'מקושר') : r.linked > 1 ? 'מקושר' : '') : r.day === today ? 'היום' : '',
        today: r.day === today,
        active: r.active,
        slots: r.active ? this.slotViews(slots) : [],
        addLabel: `הוספת ${DAY_LONG[r.day]} לתזמון`,
        readOnly: !!ov && !inOv,
      };
    });
  }

  private nextByUid(): Record<string, string> {
    const out: Record<string, string> = {};
    const up = this.preview?.upcoming ?? [];
    const cond = this.draft.conditions.items.length > 0;
    for (const u of up) {
      const s = this.draft.slots[u.slot_index];
      if (s && !out[s.uid]) out[s.uid] = `${whenLabel(u.at)}${cond ? ' · בתנאי' : ''}`;
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------------ render

  private renderBanners() {
    const reasons = this.schedule?.read_only?.reasons ?? [];
    return html`
      ${this.readOnly && !this.creating && this.schedule
        ? html`<div class="banner warn" data-readonly-banner><sw-icon name="lock" size="16"></sw-icon><div>מצב צפייה.${reasons.length ? html` ${reasons.map((r) => html`<div>${r.message}</div>`)}` : nothing}</div></div>`
        : this.creating && this.readOnly
          ? html`<div class="banner warn" data-readonly-banner><sw-icon name="lock" size="16"></sw-icon><div>שמירת תזמונים אינה זמינה כרגע.</div></div>`
          : nothing}
      ${this.gone ? html`<div class="banner err" data-gone-banner><sw-icon name="warning" size="16"></sw-icon><span>התזמון נמחק במקום אחר.</span></div>` : nothing}
      ${this.conflict
        ? html`<div class="banner err" role="alert" data-conflict-banner>
            <sw-icon name="warning" size="16"></sw-icon>
            <span><b>התזמון שונה במקום אחר</b> (גרסה ${this.baseRevision.slice(0, 4)} ← ${this.conflict.current.revision.slice(0, 4)}). השינויים שלכם עדיין לא נשמרו.</span>
            <span class="sp"></span>
            <sw-button size="sm" data-conflict-compare @click=${() => (this.compareOpen = true)}>השוואה</sw-button>
            <sw-button size="sm" data-conflict-latest @click=${() => this.loadLatest()}>טעינת הגרסה החדשה</sw-button>
            <sw-button size="sm" variant="danger" data-conflict-mine @click=${() => this.keepMine()}>שמירה בכל זאת</sw-button>
          </div>`
        : nothing}
      ${this.saveError
        ? html`<div class="banner err" role="alert" data-save-error><sw-icon name="warning" size="16"></sw-icon><span><b>השמירה לא הושלמה.</b> ${this.saveError}</span><span class="sp"></span><sw-button size="sm" data-save-retry @click=${() => this.onSave()}>ניסיון נוסף</sw-button></div>`
        : nothing}
      ${this.note ? html`<div class="banner ok" role="status" data-note>${this.note}</div>` : nothing}
      ${this.stash
        ? html`<div class="banner info" data-stash-banner><sw-icon name="info" size="16"></sw-icon><span>נמצאה טיוטה שלא נשמרה מהעריכה הקודמת.</span><span class="sp"></span><sw-button size="sm" data-stash-restore @click=${() => this.restoreStash()}>שחזור</sw-button><sw-button size="sm" variant="ghost" @click=${() => this.dropStash()}>התעלמות</sw-button></div>`
        : nothing}
      ${this.override
        ? html`<div class="banner info" data-override-banner><sw-icon name="link" size="16"></sw-icon><span>עורכים רק את ${this.override.days.map((d) => DAY_LONG[d]).join(', ')}. בשמירה יפוצל תזמון נפרד ליום הזה.</span><span class="sp"></span><sw-button size="sm" data-override-cancel @click=${() => this.cancelOverride()}>ביטול הפיצול</sw-button></div>`
        : nothing}
      ${this.status && !this.status.writable && !this.readOnly ? html`<div class="banner warn"><sw-icon name="offline" size="16"></sw-icon><span>שמירת שינויים אינה זמינה כרגע.</span></div>` : nothing}`;
  }

  private renderLegend() {
    return html`<div class="legend" aria-label="מקרא צבעים">
      ${LEGEND.map((l) => html`<span class="k"><span class="sw c-${l.cat}"></span>${l.label}</span>`)}
      <span class="k"><sw-icon name="clock" size="12"></sw-icon>זריחה / שקיעה (משוער)</span>
      <span class="k"><span class="now"></span>עכשיו</span>
    </div>`;
  }

  private renderBoard() {
    const rows = this.gridRows();
    const activeDays = resolveDays(this.draft.weekdays);
    const linkedCount = activeDays?.length ?? 0;
    const ro = this.readOnly;
    const dayRow = rows.find((r) => r.key === this.day) ?? rows[0];
    const vertical = this.phone && this.view === 'day';
    const work = this.work;
    const editingDays = this.override ? this.override.days : null;
    return html`<div class="card" data-board>
      <div class="toolbar">
        <div class="seg" role="group" aria-label="תצוגה">
          <button type="button" data-view-btn="week" aria-pressed=${this.view === 'week'} @click=${() => this.setView('week')}><sw-icon name="calendar" size="14"></sw-icon>שבוע</button>
          <button type="button" data-view-btn="day" aria-pressed=${this.view === 'day'} @click=${() => this.setView('day')}><sw-icon name="clock" size="14"></sw-icon>יום</button>
          <button type="button" data-view-btn="table" aria-pressed=${this.view === 'table'} @click=${() => this.setView('table')}><sw-icon name="list" size="14"></sw-icon>טבלה</button>
        </div>
        <span class="sp"></span>
        ${this.view === 'table'
          ? nothing
          : html`<label class="snap">הצמדה <select data-snap aria-label="הצמדת זמן" .value=${String(this.snap)} @change=${(e: Event) => (this.snap = Number((e.target as HTMLSelectElement).value))}>
              ${[5, 15, 30].map((n) => html`<option value=${n} ?selected=${this.snap === n}>${n} דק׳</option>`)}
            </select></label>`}
        ${ro || this.view === 'table' ? nothing : html`<sw-button size="sm" icon="plus" data-add-slot @click=${() => this.onAddButton()}>משבצת</sw-button>`}
      </div>
      ${this.view === 'table' ? nothing : this.renderLegend()}
      ${this.view === 'table' || !activeDays
        ? nothing
        : html`<div class="linked">
            ${linkedCount > 1 && !this.override ? html`<span class="chip" data-linked-chip><sw-icon name="link" size="12"></sw-icon>${linkedCount} ימים מקושרים</span><span>כל שינוי במשבצת חל על כל הימים: ${daysLabel(this.draft.weekdays)}.</span>` : nothing}
            ${this.canSplit ? html`<sw-button size="sm" icon="link" data-split-start @click=${() => this.startOverride([this.day])}>עריכה רק ל${DAY_LONG[this.day]}…</sw-button>` : nothing}
            ${editingDays ? html`<span class="chip" data-override-chip>עורכים: ${editingDays.map((d) => DAY_SHORT[d]).join(', ')}</span>` : nothing}
          </div>`}
      ${this.view === 'day' && activeDays
        ? html`<div class="dayrow" role="group" aria-label="בחירת יום">${rows.map((r) => html`<button type="button" class=${r.active ? '' : 'off'} data-day-btn=${r.key} aria-pressed=${this.day === r.key} @click=${() => (this.day = r.key as DayId)}><b>${DAY_SHORT[r.key as DayId]}</b><small>${r.today ? 'היום' : r.active ? 'בתזמון' : 'לא בתזמון'}</small></button>`)}</div>`
        : nothing}
      ${this.view === 'table'
        ? html`<schedule-table-view
            .slots=${work}
            .meta=${this.meta}
            .sun=${this.sunNow}
            .snap=${this.snap}
            .allowNegativeSun=${this.allowNegativeSun}
            .readOnly=${ro}
            .selected=${this.selected}
            .lockedUids=${this.lockedUids}
            .errorsByUid=${this.errorsByUid()}
            .nextByUid=${this.nextByUid()}
            .pairOf=${(i: number) => pairedOffSlot(plainSlots(work), i)}
            @slots-change=${(e: CustomEvent<{ slots: EditSlot[]; uid: string }>) => this.setWork(e.detail.slots, e.detail.uid)}
            @slot-change=${(e: CustomEvent<{ slot: EditSlot }>) => this.onSlotChange(e.detail.slot)}
            @slot-select=${(e: CustomEvent<{ uid: string }>) => (this.selected = e.detail.uid)}
            @slot-delete=${(e: CustomEvent<{ uid: string }>) => this.removeAt(this.idxOf(e.detail.uid))}
            @slot-duplicate=${(e: CustomEvent<{ uid: string }>) => this.onDuplicate(e.detail.uid)}
            @slot-add=${() => this.onAddButton()}
          ></schedule-table-view>`
        : html`<sw-schedule-grid
            data-grid
            .rows=${this.view === 'day' && dayRow ? [dayRow] : rows}
            .snap=${this.snap}
            .editable=${!ro}
            .sun=${this.sunNow}
            .now=${this.nowMin}
            .selected=${this.selected}
            .orientation=${vertical ? 'vertical' : 'horizontal'}
            @slot-select=${(e: CustomEvent) => this.onGrid('slot-select', e.detail)}
            @slot-create=${(e: CustomEvent) => this.onGrid('slot-create', e.detail)}
            @slot-move=${(e: CustomEvent) => this.onGrid('slot-move', e.detail)}
            @slot-resize=${(e: CustomEvent) => this.onGrid('slot-resize', e.detail)}
            @slot-remove=${(e: CustomEvent) => this.onGrid('slot-remove', e.detail)}
            @row-add=${(e: CustomEvent) => this.onGrid('row-add', e.detail)}
            @row-select=${(e: CustomEvent) => this.onGrid('row-select', e.detail)}
          ></sw-schedule-grid>
          ${ro ? nothing : html`<div class="foot">גררו על ציר ריק ליצירה · גררו משבצת להזזה · משכו קצה לשינוי אורך · הצמדה ל־${this.snap} דקות · הקצה העבה הוא רגע הביצוע</div>`}`}
    </div>`;
  }

  private renderPanel() {
    const i = this.idxOf(this.selected);
    const slot = i >= 0 ? this.work[i] : null;
    if (!slot) return nothing;
    const plain = plainSlots(this.work);
    const paired = pairedOffSlot(plain, i) !== null;
    const errs = this.errorsByUid()[slot.uid] ?? [];
    return html`<div class="card panelcard" data-panel-card>
      <schedule-slot-panel
        .slotData=${slot}
        .index=${i}
        .count=${this.work.length}
        .meta=${this.meta}
        .entityIds=${this.entityIds}
        .allowNegativeSun=${this.allowNegativeSun}
        .readOnly=${this.readOnly}
        .locked=${this.lockedUids[slot.uid] ?? []}
        .errors=${errs}
        .paired=${paired}
        .canPair=${!!makeOffSlot(plain[i])}
        .canCopyDays=${!!resolveDays(this.draft.weekdays)}
        @slot-change=${(e: CustomEvent<{ slot: EditSlot }>) => this.onSlotChange(e.detail.slot)}
        @slot-delete=${() => this.removeAt(i)}
        @slot-duplicate=${() => this.onDuplicate(slot.uid)}
        @slot-copy-days=${() => this.openCopyDays()}
        @slot-close=${() => (this.selected = '')}
        @pair-off=${(e: CustomEvent<{ on: boolean }>) => this.onPairOff(e.detail.on)}
      ></schedule-slot-panel>
    </div>`;
  }

  private renderSide() {
    const v = this.validation;
    const ro = this.readOnly;
    const d = this.draft;
    const days = resolveDays(d.weekdays);
    const ids = this.entityIds;
    const upcoming = this.preview?.upcoming?.length ? this.preview.upcoming : this.schedule?.upcoming?.length ? this.schedule.upcoming : approximateUpcoming(this.currentDraft(), new Date(), this.sunNow);
    const cond = d.conditions.items.length > 0;
    const sensor = this.status?.settings.shabbat_sensor ?? null;
    const condWarn = v.warnings.filter((w) => w.path.startsWith('conditions'));
    const summaryFor = (u: { slot_index: number; summary?: string }) => u.summary ?? this.slotSummaryText(u.slot_index);
    return html`<aside class="card side" data-side>
      <div class="status ${v.errors.length && this.showErrors ? 'bad' : v.errors.length ? '' : 'ok'}" data-validation-status style=${v.errors.length && !this.showErrors ? 'display:none' : ''}>
        <sw-icon name=${v.errors.length ? 'warning' : 'check'} size="16"></sw-icon>
        ${v.errors.length
          ? html`<ul>${v.errors.map((e) => html`<li><button type="button" @click=${() => this.jumpTo(e)}>${e.message}</button></li>`)}</ul>`
          : html`<span>${ro ? 'התזמון תקין.' : 'התזמון תקין ומוכן לשמירה.'}${v.warnings.filter((w) => !w.path.startsWith('conditions')).map((w) => html`<div>${w.message}</div>`)}</span>`}
      </div>
      <div class="sec">
        <h4>פרטים ${this.schedule?.sensitive || this.entityIds.some((id) => this.meta.get(id)?.sensitive) ? html`<span class="chip sens"><sw-icon name="shield" size="12"></sw-icon>רגיש</span>` : nothing}</h4>
        <div class="field"><label for="name">שם</label><input id="name" type="text" data-editor-name maxlength="80" ?disabled=${ro} .value=${d.name ?? ''} placeholder=${this.creating ? 'שם התזמון' : ''} @input=${(e: Event) => this.patch({ name: (e.target as HTMLInputElement).value })} /></div>
        ${this.creating && !ro ? html`<div class="field"><sw-toggle .checked=${this.enabledNew} label="התזמון פעיל" @change=${(e: CustomEvent<{ checked: boolean }>) => (this.enabledNew = e.detail.checked)}></sw-toggle></div>` : nothing}
        ${d.tags.length || this.status?.capabilities.tags ? html`<div class="tags" data-tags>${d.tags.map((t) => html`<span class="chip">${t}</span>`)}</div>` : nothing}
      </div>
      <div class="sec" data-devices>
        <h4>התקנים <small>(${ids.length})</small></h4>
        <div class="tags">${ids.map((id) => html`<span class="ent">${this.meta.get(id)?.name ?? id}${ro ? nothing : html`<button type="button" aria-label="הסרת ${this.meta.get(id)?.name ?? id}" @click=${() => this.removeEntity(id)}><sw-icon name="close" size="12"></sw-icon></button>`}</span>`)}</div>
        ${ro ? nothing : html`<div style="margin-block-start:8px"><sw-button size="sm" icon="plus" data-open-picker @click=${() => (this.pickerOpen = true)}>בחירת התקנים…</sw-button></div>`}
      </div>
      <div class="sec" data-days>
        <h4>ימים</h4>
        <div class="days" role="group" aria-label="ימי התזמון">
          ${DAY_ORDER.map((day) => html`<button type="button" data-day-chip=${day} aria-pressed=${!!days?.includes(day)} aria-label=${DAY_LONG[day]} ?disabled=${ro || !!this.override} @click=${() => this.patch({ weekdays: toggleDay(d.weekdays, day) })}>${DAY_SHORT[day]}</button>`)}
        </div>
        ${!days ? html`<div class="chip">${daysLabel(d.weekdays)}</div>` : nothing}
        ${ro ? nothing : html`<div class="quick">
          <button type="button" data-days-preset="daily" ?disabled=${!!this.override} @click=${() => this.patch({ weekdays: ['daily'] })}>כל יום</button>
          <button type="button" data-days-preset="work" ?disabled=${!!this.override} @click=${() => this.patch({ weekdays: ['sun', 'mon', 'tue', 'wed', 'thu'] })}>א׳–ה׳</button>
          <button type="button" data-days-preset="weekend" ?disabled=${!!this.override} @click=${() => this.patch({ weekdays: ['fri', 'sat'] })}>סוף שבוע</button>
        </div>`}
      </div>
      <div class="sec" data-repeat>
        <h4>חזרה</h4>
        <div class="repeat" role="group" aria-label="חזרה">
          ${(['repeat', 'pause', 'single'] as RepeatType[]).map((r) => html`<button type="button" data-repeat-btn=${r} aria-pressed=${d.repeat === r} ?disabled=${ro} @click=${() => this.patch({ repeat: r })}>${{ repeat: 'חוזר', pause: 'פעם אחת, מושהה', single: 'פעם אחת, נמחק' }[r]}</button>`)}
        </div>
        ${d.repeat === 'single' ? html`<div class="hint" style="color:#92400e" data-single-warning>התזמון יימחק אחרי ההרצה האחרונה.</div>` : nothing}
      </div>
      <div class="sec" data-period>
        <h4>תקופה</h4>
        <div class="dates">
          <div class="field"><label for="from">מתאריך</label><input id="from" type="date" data-date-from ?disabled=${ro} .value=${d.start_date ?? ''} @change=${(e: Event) => this.patch({ start_date: (e.target as HTMLInputElement).value || null })} /></div>
          <div class="field"><label for="to">עד תאריך</label><input id="to" type="date" data-date-to ?disabled=${ro} .value=${d.end_date ?? ''} @change=${(e: Event) => this.patch({ end_date: (e.target as HTMLInputElement).value || null })} /></div>
        </div>
      </div>
      <div class="sec" data-conditions-sec>
        <h4>תנאים <small>${cond ? '' : 'ללא תנאים'}</small></h4>
        <schedule-conditions
          .conditions=${d.conditions}
          .views=${this.schedule?.conditions.items ?? []}
          .sensor=${sensor}
          .canConfigure=${!!this.status?.can.configure}
          .warnings=${condWarn}
          .readOnly=${ro}
          @conditions-change=${(e: CustomEvent<{ conditions: DraftConditions; names?: Record<string, string> }>) => {
            if (e.detail.names) this.condNames = { ...this.condNames, ...e.detail.names };
            this.patch({ conditions: e.detail.conditions });
          }}
          @preset-motzash=${() => this.applyMotzash()}
        ></schedule-conditions>
      </div>
      <div class="sec" data-upcoming>
        <h4>ההרצות הבאות</h4>
        ${upcoming.length
          ? html`<ul class="runs">${upcoming.slice(0, 5).map((u) => html`<li><span>${whenLabel(u.at)}${cond ? html` <span class="cond">· בתנאי</span>` : nothing}</span><span>${summaryFor(u)}</span></li>`)}</ul>`
          : html`<div class="hint">אין הרצה קרובה.</div>`}
      </div>
    </aside>`;
  }

  /** The draft's conditions in the read model's shape, for S3's condition chip (shared with the list and the drawer). */
  private condView(): ScheduleConditions {
    const d = this.draft.conditions;
    const sensor = this.status?.settings.shabbat_sensor?.entity_id ?? null;
    const names: Record<string, string> = { ...this.condNames };
    for (const v of this.schedule?.conditions.items ?? []) names[v.entity_id] = v.name;
    if (this.status?.settings.shabbat_sensor) names[this.status.settings.shabbat_sensor.entity_id] = this.status.settings.shabbat_sensor.name;
    return {
      items: d.items.map((c) => ({ ...c, name: names[c.entity_id] ?? c.entity_id, readable: true, state: null, available: null, locked: false })),
      type: d.type,
      track: d.track,
      uniform: true,
      summary: conditionSummary(d, names, sensor),
      preset: detectPreset(d, sensor),
    };
  }

  private slotSummaryText(index: number): string {
    const s = this.draft.slots[index];
    if (!s) return '';
    const g = groupActions(s.actions)[0];
    return g ? `${actionLabel({ service: g.service, data: g.data })} · ${g.entities.map((e) => (e ? this.meta.get(e)?.name ?? e : '')).join(', ')}` : '';
  }

  private applyMotzash() {
    const sensor = this.status?.settings.shabbat_sensor?.entity_id;
    if (!sensor || this.readOnly) return;
    const m = motzashDraft(sensor);
    const patch: Partial<EditDraft> = { weekdays: m.weekdays, conditions: m.conditions };
    if (!this.draft.slots.length) {
      const slot = withUid({ start: m.start, stop: null, actions: [] });
      patch.slots = addEntitiesToSlots([{ ...slot, intent: { kind: 'off' } }], this.entityIds.map((id) => this.meta.get(id)).filter((x): x is NonNullable<typeof x> => !!x));
    }
    this.override = null;
    this.patch(patch);
  }

  private jumpTo(e: Found) {
    const over = e.path.startsWith('override.');
    const i = slotOfPath(e.path.replace(/^override\./, ''));
    const list = over ? this.override?.slots : this.draft.slots;
    if (i >= 0 && list?.[i]) {
      this.selected = list[i].uid;
      this.phoneTab = 'board';
      this.reveal();
    }
  }

  private renderDialogs() {
    const cmp = this.conflict ? compareDrafts(this.currentDraft(), draftFromSchedule(this.conflict.current), (id) => (id ? this.meta.get(id)?.name ?? id : 'ללא התקן'), daysLabel) : [];
    const allDays = resolveDays(this.draft.weekdays) ?? [];
    const activeSet = new Set(allDays);
    return html`
      <schedule-entity-picker ?open=${this.pickerOpen} .selected=${this.entityIds} @close=${() => (this.pickerOpen = false)} @confirm=${(e: CustomEvent<{ ids: string[]; entities: CatalogEntity[] }>) => this.onPicked(e.detail.ids, e.detail.entities)}></schedule-entity-picker>
      <schedule-lowering-dialog
        ?open=${!!this.lowering}
        .summary=${this.lowering?.summary ?? { entities: [], kinds: [], times: '', sensitive: true, lowering: true }}
        .needsCode=${this.lowering?.needsCode ?? false}
        .busy=${this.saving}
        .error=${this.lowering?.error ?? ''}
        @confirm=${(e: CustomEvent<{ alarm_code: string | null }>) => this.onLoweringConfirm(e.detail.alarm_code)}
        @close=${() => (this.lowering = null)}
      ></schedule-lowering-dialog>
      <sw-dialog ?open=${!!this.splitDialog && !this.lowering} heading="פיצול התזמון" data-split-dialog @close=${() => (this.splitDialog = null)}>
        ${this.override
          ? html`<div>נפצל לשני תזמונים: <b>${this.override.days.map((d) => DAY_LONG[d]).join(', ')}</b> יהיו תזמון נפרד, ו<b>שאר הימים</b> יישארו בתזמון הנוכחי. שני התזמונים יכללו את אותם התקנים, תנאים ותקופה.</div>
              <div class="field" style="margin-block-start:10px"><label for="split-name">שם התזמון החדש</label><input id="split-name" type="text" data-split-name style="inline-size:100%" .value=${this.splitDialog?.name ?? ''} @input=${(e: Event) => (this.splitDialog = { name: (e.target as HTMLInputElement).value })} /></div>`
          : nothing}
        <div slot="footer" style="display:contents">
          <sw-button ?disabled=${this.saving} @click=${() => (this.splitDialog = null)}>ביטול</sw-button>
          <sw-button variant="primary" data-split-ok ?disabled=${this.saving} @click=${() => void this.persistSplit(this.splitDialog?.name ?? '')}>${this.saving ? 'מפצל…' : 'פיצול ושמירה'}</sw-button>
        </div>
      </sw-dialog>
      <sw-dialog ?open=${this.copyOpen} heading=${this.override ? 'העתקת הסידור לימים' : 'העתקה לימים'} data-copy-dialog @close=${() => (this.copyOpen = false)}>
        <div class="days" role="group" aria-label="ימים">
          ${DAY_ORDER.map((day) => {
            const inSchedule = activeSet.has(day);
            const on = this.copyPick.includes(day) || (!this.override && inSchedule);
            const disabled = this.override ? !inSchedule : inSchedule;
            return html`<button type="button" data-copy-day=${day} aria-pressed=${on} ?disabled=${disabled} aria-label=${DAY_LONG[day]} @click=${() => (this.copyPick = this.copyPick.includes(day) ? this.copyPick.filter((x) => x !== day) : [...this.copyPick, day])}>${DAY_SHORT[day]}</button>`;
          })}
        </div>
        <div class="hint">${this.override ? 'הימים שיקבלו את הסידור הזה (כולם יפוצלו יחד לתזמון נפרד).' : 'הימים שנוספים לתזמון יקבלו את אותן משבצות, כמו שאר הימים המקושרים.'}</div>
        <div slot="footer" style="display:contents">
          <sw-button @click=${() => (this.copyOpen = false)}>ביטול</sw-button>
          <sw-button variant="primary" data-copy-ok @click=${() => this.applyCopyDays()}>אישור</sw-button>
        </div>
      </sw-dialog>
      <sw-dialog ?open=${this.compareOpen} heading="השוואה לגרסה החדשה" data-compare-dialog @close=${() => (this.compareOpen = false)}>
        ${cmp.length
          ? html`<table style="inline-size:100%;border-collapse:collapse;font-size:var(--sw-fs-sm)">
              <thead><tr><th style="text-align:start;padding:4px">שדה</th><th style="text-align:start;padding:4px">אצלכם</th><th style="text-align:start;padding:4px">בגרסה החדשה</th></tr></thead>
              <tbody>${cmp.map((r) => html`<tr style="vertical-align:top"><td style="padding:4px;font-weight:600">${r.label}</td><td style="padding:4px;white-space:pre-line">${r.mine}</td><td style="padding:4px;white-space:pre-line">${r.theirs}</td></tr>`)}</tbody>
            </table>`
          : html`<div>אין הבדלים בתוכן.</div>`}
        <div slot="footer" style="display:contents"><sw-button variant="primary" @click=${() => (this.compareOpen = false)}>סגירה</sw-button></div>
      </sw-dialog>
      <sw-dialog ?open=${!!this.leave} heading="יש שינויים שלא נשמרו" data-leave-dialog @close=${() => (this.leave = null)}>
        <div>אם תצאו עכשיו, השינויים שערכתם יאבדו.</div>
        <div slot="footer" style="display:contents">
          <sw-button data-leave-stay @click=${() => (this.leave = null)}>הישארות</sw-button>
          <sw-button variant="danger" data-leave-go @click=${() => this.leave && this.go(this.leave.href)}>יציאה בלי לשמור</sw-button>
        </div>
      </sw-dialog>`;
  }

  render() {
    if (this.loading) return html`<sw-page wide heading="עריכת תזמון"><sw-state-panel state="loading" data-editor-state="loading"></sw-state-panel></sw-page>`;
    if (this.forbidden || (this.loadError && !this.schedule && !this.creating)) {
      return html`<sw-page wide heading="עריכת תזמון" crumbs="תזמונים|עריכה"><sw-state-panel data-editor-state=${this.forbidden ? 'forbidden' : 'error'} state=${this.forbidden ? 'forbidden' : 'error'} heading=${this.forbidden ? 'התזמון לא נמצא' : ''} hint=${this.forbidden ? 'ייתכן שנמחק, או שאינו בהרשאתכם.' : this.loadError} actionLabel=${this.forbidden ? '' : 'נסה שוב'} @action=${() => void this.load()}></sw-state-panel></sw-page>`;
    }
    if (this.creating && !this.status?.can.manage && this.status) {
      return html`<sw-page wide heading="תזמון חדש" crumbs="תזמונים|חדש"><sw-state-panel data-editor-state="forbidden" state="forbidden" hint="אין הרשאה ליצור תזמונים."></sw-state-panel></sw-page>`;
    }
    const title = (this.draft.name ?? '').trim() || (this.schedule?.display_name ?? (this.creating ? 'תזמון חדש' : 'תזמון'));
    const ro = this.readOnly;
    const sensitive = this.entityIds.some((id) => this.meta.get(id)?.sensitive) || !!this.schedule?.sensitive;
    return html`<sw-page wide heading=${title} crumbs=${`תזמונים|${this.creating ? 'חדש' : 'עריכה'}`} data-editor data-editor-mode=${ro ? 'view' : this.creating ? 'new' : 'edit'}>
      <div slot="actions" class="actions">
        ${this.schedule ? html`<span class="ver" title="גרסה">גרסה ${this.schedule.revision.slice(0, 4)}</span>` : nothing}
        <schedule-condition-chip data-condition-chip .conditions=${this.condView()}></schedule-condition-chip>
        ${sensitive ? html`<sw-schedule-markers data-sensitive-badge .sensitive=${true} .lowering=${loweringSummary(this.currentDraft(), this.meta).lowering}></sw-schedule-markers>` : nothing}
        <sw-button data-editor-cancel @click=${() => this.cancel()}>${ro ? 'חזרה' : 'ביטול'}</sw-button>
        ${ro ? nothing : html`<sw-button variant="primary" icon="check" data-editor-save ?disabled=${!this.dirty || this.saving} @click=${() => void this.onSave()}>${this.saving ? 'שומר…' : 'שמירה'}</sw-button>`}
      </div>
      ${this.renderBanners()}
      <div class="tabs" role="tablist">
        <button type="button" role="tab" aria-selected=${this.phoneTab === 'board'} data-phone-tab="board" @click=${() => (this.phoneTab = 'board')}>לוח זמנים</button>
        <button type="button" role="tab" aria-selected=${this.phoneTab === 'settings'} data-phone-tab="settings" @click=${() => (this.phoneTab = 'settings')}>הגדרות</button>
      </div>
      <div class="layout" data-tab=${this.phoneTab}>
        <div class="col boardcol">${this.renderBoard()}${this.renderPanel()}</div>
        ${this.renderSide()}
      </div>
      ${this.renderDialogs()}
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-editor': ScheduleEditor;
  }
}
