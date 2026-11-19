import { html, css, nothing, type TemplateResult } from 'lit';
import { liftRef, liftedReset } from '../components/top-layer';
import { leadReserveStyles } from '../styles/lead-reserve';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/media-screen-card';
import '../components/media-bulk-dialog';
import '../components/sw-pager';
import '../components/sw-page';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';
import { PageFit } from '../components/page-fit';
import { MediaCardsScreenBase } from './multimedia-base';
import './multimedia-edit-panel';
import type { MediaBulkDialog } from '../components/media-bulk-dialog';
import { ApiError, describeError } from '../api/client';
import { isApi } from '../api/session';
import {
  bulkCandidates, isLit, media, resolveCards,
  type CardGroup, type MediaDevice, type MediaLayout, type MediaStatus, type Size,
} from '../api/media-screens';
import { savePersonal } from '../api/media-personal';
import type { RouteState } from '../router';
import { phoneRestricted } from '../shell/phone';
import { bidi } from '../i18n/bidi';
import { mediaGlassStyles } from '../styles/media-glass';
import { clearPairChip, publishPairChip } from '../shell/tab-pair';
import { ddPanelOf, ddRingOf, ddSizeOf, ddStyleOf } from '../shell/tabs-mode';
import '../components/sw-dropdown';
import type { DropdownItem } from '../components/sw-dropdown';
import { mIcon, nameText } from '../components/media-icons';
import {
  NO_FILTER, NO_FLOOR, STATE_FILTERS, cardOf, countsOf, editGroups, effective, filterDevices, filtersActive, filtersFromParams, filtersToParams,
  floorsOf, installationPayload, moveInGroup, personalFrom, roomsOf, setCard, startDraft, togglePin, withFloorOrder,
  type EditScope, type Filters, type StateFilter,
} from './multimedia-layout';
import { tr } from '../i18n/msg/media';
import { chipSelected, chipSelectedCheck } from '../styles/chip-selected';

const PATH = '/multimedia/screens';
const SIZE_ORDER: Size[] = ['s', 'm', 'l'];

/**
 * CR-015 "מולטימדיה › מסכים" (mockup v2, always the glass style): one card per physical screen grouped by floor (or room, or one
 * list), a large title, scrolling room chips, the floor menu with the floor's "כבה מסכים", a state filter and a search. The
 * card is `<media-screen-card>`; the remote opens as `<media-remote .deviceKey .open @close>` (S3) by the address
 * (`?remote=<key>`: Back closes it). Addition A: the cards are editable like the home screen - the user menu's "עריכת מסך
 * המולטימדיה" (registerScreenEdit, `?edit=1`) opens the edit bar and `multimedia-edit-panel` (order, "מועדפים", size, desktop /
 * phone visibility, grouping, floor order). The installation layout is saved for everyone (media.layout); a holder of
 * screen.personalize may keep their own override instead (`multimedia.personal`). Loading, empty, error (the last state is
 * kept and marked stale), forbidden and "off" states are all drawn here; nothing is shown that the server would refuse.
 */
@customElement('multimedia-screens')
export class MultimediaScreens extends MediaCardsScreenBase<MediaStatus, MediaDevice, Filters> {
  /** `?remote=<device key>` of the address: the screen whose remote is open ('' = none). */
  @property() remoteKey = '';
  @state() protected filters: Filters = NO_FILTER;
  @state() private scope: EditScope = 'all';
  @query('media-bulk-dialog') private bulk?: MediaBulkDialog;

  protected readonly path = PATH;
  protected readonly tab = 'screens';
  protected readonly editEntry = { id: 'multimedia-layout', label: tr('עריכת מסך המולטימדיה') };
  protected readonly noFilter = NO_FILTER;
  protected readonly panelParam = 'remote';
  /** NOSCROLL-1366-2437: the cards region pages instead of scrolling on a desktop (components/page-fit.ts) */
  protected fit = new PageFit(this, () => this.renderRoot.querySelector<HTMLElement>('.scr'), () => !this.editing);

  static styles = [mediaGlassStyles, leadReserveStyles, liftedReset, css`
    :host {
      display: block;
      position: relative;
      overflow: auto;
      scrollbar-width: thin;
      background: var(--dv-page-backdrop);
      color: var(--dv-text);
      font-family: var(--dv-font);
      font-size: var(--sw-fs-md);
      line-height: 1.5;
    }
    /* AUDIT30-D3 (audit round 30 #6): the page frame is the shared <sw-page class="page" wide> - the title, the one-line summary under
       it and the floor menu at the end of the title row come from it (its padding is --sw-page-pad; --mm-pad mirrors it for the
       edge-to-edge bars below). Below it, the filter bar (.dh) and the cards. */
    .page {
      --mm-pad: var(--sw-page-pad);
    }
    /* the filter bar: the room chips, the pager, the state filter, the search; it sticks and compacts while the page scrolls */
    .dh {
      position: sticky;
      inset-block-start: 0;
      z-index: 15;
      margin-inline: calc(-1 * var(--mm-pad));
      padding: var(--sw-s-1) var(--mm-pad);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2) var(--sw-s-3);
    }
    /* Compacting is purely visual: it never changes the header's height in the flow. A header that shrank at scrollTop ~60
       moved every card under the finger (and, with the scroll clamped, fell back under the threshold and expanded again: the
       list jumped back and forth on a phone). The bar is a layer of the measured height of the title row; what folds away
       fades out in place and stops taking taps, and the cards slide under the transparent rest. */
    .dh::before {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      block-size: var(--mm-bar-h, 64px);
      z-index: -1;
      opacity: 0;
      pointer-events: none;
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border-block-end: 1px solid var(--dv-border);
      box-shadow: var(--dv-shadow-1);
      transition: opacity var(--mm-motion) var(--mm-ease);
    }
    .dh.compact {
      pointer-events: none;
    }
    .dh.compact::before {
      opacity: 1;
      pointer-events: auto;
    }
    .dh.compact .dh-row > * {
      pointer-events: auto;
    }
    .dh-row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      flex: 1 1 320px;
      min-inline-size: 0;
    }
    /* the bar is not the page's first row any more (sw-page's title row is, and it keeps the shell's lead reserve itself) */
    :host .page .dh .dh-row {
      padding-inline-start: 0;
    }
    .rooms {
      flex: 1 1 auto;
      min-inline-size: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
      padding: 6px 18px;
      /* the first chip lines up with the title above: the fade's room hangs outside the text edge */
      margin-inline-start: -18px;
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 18px, #000 calc(100% - 18px), transparent);
      mask-image: linear-gradient(90deg, transparent, #000 18px, #000 calc(100% - 18px), transparent);
      user-select: none;
      touch-action: pan-x;
    }
    .rooms::-webkit-scrollbar {
      display: none;
    }
    .rooms.dragging {
      cursor: grabbing;
    }
    .rc {
      flex: none;
      /* AUDIT30-D1: the chip is a control of the shared height (34 in the classic skin; 44 on touch below) */
      block-size: var(--sw-ctl-h-md);
      padding-inline: 14px;
      border-radius: var(--dv-radius-control);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-2);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      color: var(--dv-text-2);
      white-space: nowrap;
      transition: background var(--mm-motion), color var(--mm-motion), transform var(--sw-t-press) var(--sw-ease-out);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    /* R5-MEDIA-ENERGY-297 (mobile-native): hover only under a pointer that hovers; the chip sinks on pointer-down */
    @media (hover: hover) and (pointer: fine) {
      .rc:hover {
        color: var(--dv-text);
        background: var(--dv-surface);
      }
    }
    .rc:active {
      transform: scale(var(--sw-press-scale, 0.97));
    }
    /* AUDIT30-D1 (audit round 30 #4, owner question 3 answer a): the chosen room is the product's one selected look - the soft accent
       fill with the accent ink (Blue Wash), no border, no shadow; it was a black pill (--dv-text fill) */
    .rc[aria-pressed='true'] {
      ${chipSelected}
    }
    /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
    .rc[aria-pressed='true']::before {
      ${chipSelectedCheck}
    }
    .rc:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
    }
    .flwrap {
      position: relative;
      flex: none;
    }
    .pacts {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
    }
    .dh-det {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      transition: opacity var(--mm-motion), visibility var(--mm-motion);
    }
    .dh-det {
      flex: 0 1 auto;
      min-inline-size: 0;
    }
    .dh.compact .dh-det {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      block-size: 38px;
      padding-inline: 14px;
      border-radius: var(--dv-radius-control);
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border: 1px solid var(--dv-border);
      min-inline-size: 240px;
      color: var(--dv-text-2);
    }
    .search:focus-within {
      outline: 2px solid var(--dv-focus);
      outline-offset: 1px;
    }
    .search input {
      border: 0;
      background: transparent;
      outline: none;
      flex: 1;
      min-inline-size: 0;
      font-size: var(--sw-fs-base);
      color: var(--dv-text);
    }
    .search input::placeholder {
      color: var(--dv-text-2);
    }
    .search .ic {
      font-size: var(--sw-fs-lg);
    }
    /* groups and the grid */
    .groups {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }
    .fsec {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .sh {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      padding-inline: 4px;
    }
    /* AUDIT30-D2 (audit round 30 #17): the floor heading sits one tier under the page title (the 26-30 px / 800 heading competed
       with the title, so the screen read as having several); it is the section step of the scale, semibold */
    .sh h2 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-semibold);
      letter-spacing: -0.01em;
      line-height: 1.2;
      color: var(--sw-heading, var(--dv-text));
    }
    .shlink {
      all: unset;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border-radius: var(--sw-r-sm);
      min-block-size: 28px;
      transition: transform var(--sw-t-press) var(--sw-ease-out);
    }
    .shlink .ic {
      font-size: var(--sw-fs-2xl);
      color: var(--dv-text-3);
      transition: transform var(--mm-motion) var(--mm-ease);
    }
    @media (hover: hover) and (pointer: fine) {
      .shlink:hover .ic {
        transform: translateX(-3px);
        color: var(--dv-text-2);
      }
    }
    .shlink:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
    }
    /* POLISH4-WP5: the floor link sinks on pointer-down like the chips and keys do */
    .shlink:active {
      transform: scale(var(--sw-press-scale, 0.97));
    }
    .sh small {
      display: block;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      margin-block-start: 1px;
    }
    .sh small em {
      font-style: normal;
      color: var(--dv-text);
      font-weight: var(--sw-fw-semibold);
    }
    .sgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
      gap: var(--dv-gap-lg);
      align-items: start;
    }
    .sgrid > .l {
      grid-column: span 2;
    }
    /* edit chips on a card */
    .ecard {
      position: absolute;
      inset-block-start: 18px;
      inset-inline-end: 18px;
      display: flex;
      gap: 2px;
      padding: 3px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-perf-glass-bg, var(--mm-sheet-surface));
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(16px));
      backdrop-filter: var(--sw-perf-blur, blur(16px));
      box-shadow: var(--dv-shadow-control);
      border: 1px solid var(--dv-border);
    }
    .ecard button {
      inline-size: 32px;
      block-size: 32px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      display: grid;
      place-items: center;
      color: var(--dv-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-bold);
      transition: background var(--mm-motion), transform var(--sw-t-press) var(--sw-ease-out);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    @media (hover: hover) and (pointer: fine) {
      .ecard button:hover {
        background: var(--dv-surface-3);
      }
    }
    .ecard button:active {
      transform: scale(var(--sw-press-scale, 0.97));
    }
    .ecard button[aria-pressed='true'] {
      color: var(--dv-accent-text);
      background: var(--dv-accent-soft);
    }
    .ecard button[disabled] {
      opacity: 0.35;
    }
    .ecard .ic {
      font-size: var(--sw-fs-lg);
    }
    /* the confirmation dialogs carry the sheet material (a translucent glass panel over a dimmed page reads as washed out) */
    media-bulk-dialog,
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    .editing-stack {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .edit-layout {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    @media (min-width: 1100px) {
      .edit-layout {
        display: grid;
        grid-template-columns: minmax(340px, 400px) minmax(0, 1fr);
        gap: 24px;
        align-items: start;
      }
      .edit-side {
        position: sticky;
        inset-block-start: 76px;
        max-block-size: calc(100dvh - 96px);
        overflow: auto;
        scrollbar-width: thin;
      }
    }
    .note-bad {
      color: var(--dv-danger);
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
    }
    .toast {
      position: fixed;
      z-index: 90;
      inset-inline: 0;
      margin-inline: auto;
      inline-size: max-content;
      max-inline-size: calc(100% - 24px);
      inset-block-end: 26px;
      background: var(--sw-toast-bg);
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(20px));
      backdrop-filter: var(--sw-perf-blur, blur(20px));
      color: var(--sw-toast-text);
      padding: 11px 20px 11px 16px;
      border-radius: var(--sw-r-pill);
      border: 1px solid color-mix(in srgb, var(--sw-toast-text) 12%, transparent);
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-medium);
      box-shadow: var(--sw-shadow-3);
      display: flex;
      gap: 9px;
      align-items: center;
      animation: mm-pop var(--mm-motion) var(--mm-ease);
    }
    .toast .ic {
      color: var(--sw-success);
      font-size: var(--sw-fs-lg);
    }
    @media (pointer: coarse), (max-width: 767px) {
      .rc,
      .search {
        block-size: 44px;
      }
      .ecard button {
        inline-size: 44px;
        block-size: 44px;
      }
      .shlink {
        min-block-size: 44px;
        margin-block: -8px; /* the hit area grows, the heading row does not */
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .dh::before,
      .shlink .ic,
      .dh-det {
        transition: none;
      }
    }
    @media (max-width: 767px) {
      /* sw-page's phone padding */
      .page {
        --mm-pad: var(--sw-s-3);
      }
      .dh {
        flex-direction: column;
        align-items: stretch;
        flex-wrap: nowrap;
      }
      /* stuck at the top, the room row is what stays: it keeps clear of the shell's floating search / status corner */
      .dh-row {
        flex: none;
        padding-inline-end: var(--sw-float-reserve, 0px);
      }
      .dh-row .rooms {
        margin-inline: calc(-1 * var(--mm-pad));
        padding-inline: var(--mm-pad);
      }
      /* CR-CMP2-SEGMENTED-C-2450: the state filter stays one line and scrolls sideways */
      .dh-det sw-segmented {
        --sw-seg-wrap: nowrap;
      }
      .dh-det sw-segmented::part(track) {
        overflow-x: auto;
        scrollbar-width: none;
      }
      .search {
        min-inline-size: 0;
        flex: 1 1 100%;
      }
      .sgrid {
        grid-template-columns: minmax(0, 1fr);
      }
      .sgrid > .l {
        grid-column: auto;
      }
      .toast {
        inset-block-end: calc(var(--sw-bottomnav-h) + 14px);
      }
      .groups {
        gap: 22px;
      }
    }
    @media (min-width: 768px) and (max-width: 1023px) {
      .sgrid > .l {
        grid-column: auto;
      }
    }
    /* NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30 #5, 549 px at 1366x768). Below 1024 px wide - or on a
       window too short for the header and a row of cards - the region is transparent and the page scrolls as before. From 1024 x 560
       (outside the layout editor) the page takes the screen's height, the header stays and the cards region never scrolls: the cards
       that fit are page 1, the rest are on the next pages (the pager in the filter row). */
    .scr {
      display: contents;
    }
    @media (min-width: 1024px) and (min-height: 560px) {
      :host([data-fit]) {
        overflow: hidden;
      }
      :host([data-fit]) .page {
        block-size: 100%;
        min-block-size: 0;
        padding-block-end: 0;
      }
      :host([data-fit]) .scr {
        display: block;
        flex: 1 1 auto;
        min-block-size: 0;
        overflow: hidden;
        /* the region spans the page's side padding, so a card's shadow and focus ring are never cut at the sides */
        margin-inline: calc(-1 * var(--mm-pad));
        padding: var(--sw-s-1) var(--mm-pad) var(--sw-s-5);
      }
      /* PAGING-SETTING-2439: the long lists scroll (הגדרות › כללי): every card is drawn and the region scrolls inside itself */
      :host([data-fit][data-long-lists='scroll']) .scr {
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
      }
      :host([data-fit]) .groups {
        gap: var(--sw-s-5);
      }
      /* the cards of the other pages (and a section with none on this page) stay in the document, out of the layout */
      :host([data-fit]) [data-off] {
        display: none !important;
      }
    }
  `];

  /** The screens page is the entry of the section: `#/multimedia` alone is this tab. */
  protected ownsRoute(r: RouteState): boolean {
    return (r.segments[1] ?? 'screens') === 'screens';
  }

  /** 0.1.153: the room filter in its dropdown form is drawn by the shell, beside the area's tab chip (shell/tab-pair.ts). */
  private syncPair() {
    const f = this.filters;
    const rooms = roomsOf(this.devices, f.floor);
    const tools = !this.editing && this.phase === 'ready' && this.devices.length > 0;
    if (tools && this.roomsAsDropdown(rooms.length + 1)) {
      publishPairChip(this, { group: 'multimedia', label: tr('חדרים'), value: f.area, items: [{ id: '', label: tr('הכל'), icon: 'home' as const }, { id: '--sep', label: '', divider: true }, ...rooms.map((r) => ({ id: r.id, label: r.name, icon: 'door' as const }))], onPick: (id) => this.setFilters({ area: id }) });
    } else clearPairChip(this);
  }

  protected updated() {
    this.syncPair();
    this.measureBar();
    super.updated();
  }

  /** The compact bar covers the title row only (see `.dh::before`): its height is measured, never guessed, and only written when it changed. */
  private measureBar() {
    const dh = this.renderRoot.querySelector<HTMLElement>('.dh');
    if (!dh) return;
    const top = dh.getBoundingClientRect().top;
    let bottom = 0;
    for (const el of dh.querySelectorAll<HTMLElement>(':scope > .dh-row > *')) bottom = Math.max(bottom, el.getBoundingClientRect().bottom - top);
    const h = `${Math.ceil(bottom + (this.phone ? 8 : 10))}px`;
    if (bottom && dh.style.getPropertyValue('--mm-bar-h') !== h) dh.style.setProperty('--mm-bar-h', h);
  }

  // ------------------------------------------------------------------------------------------------ data

  protected get canEdit(): boolean {
    return this.phase === 'ready' && (this.res.can_edit || this.res.can_personalize) && !phoneRestricted('layout_editor');
  }

  protected readStatus() {
    return media().status();
  }

  protected async listDevices() {
    return (await media().list()).devices;
  }

  protected filtersFromParams(p: URLSearchParams) {
    return filtersFromParams(p);
  }

  protected filtersToParams(f: Filters, p: URLSearchParams) {
    return filtersToParams(f, p);
  }

  protected roomsInFloor() {
    return roomsOf(this.devices, this.filters.floor);
  }

  /** The layout the page draws: the installation's with the personal override, the floors in the order that applies. */
  private display(): MediaLayout {
    return withFloorOrder(effective(this.res.installation, this.res.personal), this.homeFloors);
  }

  // ------------------------------------------------------------------------------------------------ the layout editor

  protected beforeEdit() {
    this.scope = this.res.can_edit ? 'all' : 'me';
  }

  protected startDraft() {
    return startDraft(this.scope, this.res.installation, this.res.personal, this.devices, this.homeFloors);
  }

  private setScope(s: EditScope) {
    if (s === this.scope) return;
    this.scope = s;
    this.beginDraft(); // another base: the changes of the other scope are not carried over
  }

  private async save() {
    if (!this.draft || this.busy) return;
    this.busy = true;
    this.saveError = '';
    try {
      this.res = this.scope === 'all'
        ? await media().saveLayout(installationPayload(this.draft, this.devices, this.res.installation, this.homeFloors), this.res.revision)
        : await savePersonal(personalFrom(this.res.installation, this.draft, this.devices));
      this.leaveEdit();
      this.say(tr('נשמר'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'revision_conflict') this.conflict = true;
      else this.saveError = describeError(err);
      this.busy = false;
    }
  }

  private async resetLayout() {
    this.confirm = null;
    this.busy = true;
    try {
      this.res = this.scope === 'all' ? await media().resetLayout() : await savePersonal(null);
      this.leaveEdit();
      this.say(tr('חזר לברירת המחדל'));
    } catch (err) {
      this.saveError = describeError(err);
      this.busy = false;
    }
  }

  // ------------------------------------------------------------------------------------------------ render

  private groupsToShow(): CardGroup[] {
    if (this.editing && this.draft) return editGroups(this.devices, this.draft);
    return resolveCards(filterDevices(this.devices, this.filters), this.display(), this.phone);
  }

  private floorOfGroup(g: CardGroup): { scope: 'floor' | 'area'; id: string } | null {
    const by = (this.editing && this.draft ? this.draft : this.display()).group_by;
    if (g.id === 'pinned' || g.id === 'all' || g.id === NO_FLOOR || g.id === 'none') return null;
    return { scope: by === 'area' ? 'area' : 'floor', id: g.id };
  }

  private chips(d: MediaDevice, index: number, count: number, size: Size): TemplateResult {
    const draft = this.draft!;
    const c = cardOf(draft, d.key);
    const pinned = draft.pinned.includes(d.key);
    const name = d.name;
    return html`<span class="ecard" slot="edit">
      <button type="button" aria-label=${tr('הקדם · {name}', { name })} title=${tr('הקדם')} ?disabled=${index === 0} @click=${() => this.patchDraft(moveInGroup(draft, this.devices, d.key, -1))}>${mIcon('arrowUp')}</button>
      <button type="button" aria-label=${tr('אחר · {name}', { name })} title=${tr('אחר')} ?disabled=${index === count - 1} @click=${() => this.patchDraft(moveInGroup(draft, this.devices, d.key, 1))}>${mIcon('arrowDown')}</button>
      <button type="button" aria-label=${tr('גודל · {name}', { name })} title=${tr('גודל')} @click=${() => this.patchDraft(setCard(draft, d.key, { size: SIZE_ORDER[(SIZE_ORDER.indexOf(size) + 1) % 3] }))}>${size.toUpperCase()}</button>
      ${this.scope === 'all' ? html`<button type="button" aria-pressed=${String(pinned)} aria-label=${tr('מועדף · {name}', { name })} title=${tr('מועדף')} @click=${() => this.patchDraft(togglePin(draft, d.key))}>${mIcon('star')}</button>` : nothing}
      <button type="button" aria-label=${`${c.on ? tr('הסתר') : tr('הצג')} · ${name}`} title=${c.on ? tr('הסתר') : tr('הצג')} @click=${() => this.patchDraft(setCard(draft, d.key, { on: !c.on }))}>${mIcon(c.on ? 'eye' : 'eyeOff')}</button>
    </span>`;
  }

  private card(d: MediaDevice, size: Size, index: number, count: number, paged = false): TemplateResult {
    const edit = this.editing && !!this.draft;
    const off = edit && !cardOf(this.draft!, d.key).on;
    return html`<media-screen-card class=${classMap({ l: size === 'l' })} data-fit-item ?data-off=${paged} data-screen-card=${d.key} .device=${d} .size=${size} ?compact=${this.phone} ?editing=${edit} ?data-dimmed=${off}
      @open-remote=${(e: CustomEvent<{ key: string }>) => this.openPanel(e.detail.key)} @media-changed=${() => this.scheduleRefresh(isApi() ? 700 : 30)}>${edit ? this.chips(d, index, count, size) : nothing}</media-screen-card>`;
  }

  /** `only`: the page shows this one group - its heading would repeat the filter chip (or, for the no-floor bucket of an installation without floors, say "ללא שיוך" about screens that do have a room), so it is left out. */
  private group(g: CardGroup, only = false, offset = 0): TemplateResult {
    const all = g.items.map((i) => i.device);
    // NOSCROLL-1366-2437: the cards of the other pages are drawn out of the layout ([data-off]); so is a group with none on this page
    const off = (idx: number) => !this.fit.shows(offset + idx);
    const none = g.items.every((_, idx) => off(idx));
    const counts = countsOf(all);
    const target = this.editing ? null : this.floorOfGroup(g);
    const sameScope = this.devices.filter((d) => (target?.scope === 'area' ? (d.area_id ?? '') === target.id : target ? (d.floor_id ?? NO_FLOOR) === target.id : false));
    const offBtn = target && !this.editing && bulkCandidates(sameScope).length
      ? html`<button type="button" class="btn sm quiet dz" data-bulk-off=${target.id} @click=${() => this.bulk?.show({ scope: target.scope, id: target.id, name: g.label })}>${mIcon('power')}${tr('כבה מסכים')}</button>`
      : nothing;
    const title = g.id === 'pinned' || g.id === 'all' || !target || this.editing
      ? html`<h2>${nameText(bidi(g.label))}</h2>`
      : html`<h2><button type="button" class="shlink" data-group-open=${g.id} @click=${() => this.setFilters(target.scope === 'area' ? { area: g.id } : { floor: g.id, area: '' })}>${bidi(g.label)}${mIcon('chevronBack')}</button></h2>`;
    const lit = all.filter((d) => isLit(d.live)).length;
    if (only && !this.editing && (g.id === 'none' || g.id === NO_FLOOR) && !offBtn) {
      return html`<section class="fsec" ?data-off=${none} aria-label=${g.label} data-group=${g.id}><div class="sgrid">${repeat(g.items, (i) => i.device.key, (i, idx) => this.card(i.device, i.size, idx, g.items.length, off(idx)))}</div></section>`;
    }
    return html`<section class="fsec" ?data-off=${none} aria-label=${g.label} data-group=${g.id}>
      <header class="sh"><div>${title}<small><span class="n">${counts.total}</span> ${counts.total === 1 ? tr('מסך') : tr('מסכים')}${lit ? html` · <em><span class="n">${lit}</span></em> ${tr('פועלים')}` : nothing}</small></div><span class="grow"></span>${offBtn}</header>
      <div class="sgrid">${repeat(g.items, (i) => i.device.key, (i, idx) => this.card(i.device, i.size, idx, g.items.length, off(idx)))}</div>
    </section>`;
  }

  /** AUDIT30-D3: the one-line summary under the title (sw-page's subheading); the phone keeps its header short and has none */
  private summary(): string {
    if (this.phone || this.editing || this.phase !== 'ready' || !this.devices.length) return '';
    const c = countsOf(this.devices);
    return `${tr('{on} פועלים מתוך {total}', { on: c.on, total: c.total })}${c.un ? tr(' · {n} לא זמין', { n: c.un }) : ''}`;
  }

  /** AUDIT30-D3: the floor menu sits at the end of sw-page's title row (slot "actions"). */
  private floorAction(): TemplateResult | typeof nothing {
    const floors = floorsOf(this.devices, this.display());
    const showFloor = floors.length > 1 || !!this.filters.floor;
    const tools = !this.editing && this.phase === 'ready' && this.devices.length > 0;
    return tools && showFloor ? html`<div slot="actions" class="pacts">${this.floorChip(floors)}</div>` : nothing;
  }

  /** The filter bar under the title: rooms, the pager, the state filter, the search (sticky and compacting while the page scrolls). */
  private header(): TemplateResult | typeof nothing {
    const f = this.filters;
    const rooms = roomsOf(this.devices, f.floor);
    const c = countsOf(this.devices);
    const tools = !this.editing && this.phase === 'ready' && this.devices.length > 0;
    if (!tools) return nothing;
    return html`<div class=${classMap({ dh: true, compact: this.compactHeader })} data-mm-header>
      <div class="dh-row">
        ${this.roomsAsDropdown(rooms.length + 1) ? html`<span class="grow" data-rooms-in-shell></span>` : html`<div class="rooms" role="group" aria-label=${tr('חדרים')} @pointerdown=${this.roomsDrag}>
          <button type="button" class="rc" aria-pressed=${String(!f.area)} data-room="" @click=${() => this.setFilters({ area: '' })}>${tr('הכל')}</button>
          ${rooms.map((r) => html`<button type="button" class="rc" aria-pressed=${String(f.area === r.id)} data-room=${r.id} @click=${() => this.setFilters({ area: r.id })}>${nameText(r.name)}</button>`)}
        </div>`}
      </div>
      <div class="dh-det">
        ${this.fit.pages > 1 ? html`<sw-pager data-mm-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${(e: CustomEvent<{ page: number }>) => this.fit.go(e.detail.page)}></sw-pager>` : nothing}
        <sw-segmented radio size="sm" label=${tr('סינון לפי מצב')} value=${f.state} @change=${(e: CustomEvent<SegmentedChange>) => this.setFilters({ state: e.detail.value as StateFilter })}
          .options=${STATE_FILTERS.map((s) => ({ value: s.id, label: s.label, count: s.id === 'on' ? String(c.on) : s.id === 'un' && c.un ? String(c.un) : undefined, attrs: { 'data-state-filter': s.id } }))}></sw-segmented>
        <label class="search">${mIcon('search')}<span class="vh">${tr('חיפוש מסך')}</span><input type="search" data-search placeholder=${tr('חיפוש מסך או חדר')} .value=${f.q} @input=${(e: Event) => this.onSearch((e.target as HTMLInputElement).value)} /></label>
      </div>
    </div>`;
  }

  /** The floor filter as the capsule-capable dropdown (0.1.164): the same component, style, size, ring and panel width as every other dropdown of the multimedia group. */
  private floorChip(floors: ReturnType<typeof floorsOf>): TemplateResult {
    const items: DropdownItem[] = [{ id: '', label: tr('כל הקומות'), count: this.devices.length, icon: 'home' }, { id: '--sep', label: '', divider: true }, ...floors.map((x) => ({ id: x.id, label: x.name, count: x.count, icon: 'layers' as const }))];
    return html`<div class="flwrap"><sw-dropdown data-floor-menu label=${tr('קומות')} icon="layers" dd-style=${ddStyleOf('multimedia')} dd-size=${ddSizeOf('multimedia')} dd-ring=${ddRingOf('multimedia')} dd-panel=${ddPanelOf('multimedia')} .items=${items} .value=${this.filters.floor} @change=${(e: CustomEvent<{ id: string }>) => this.setFilters({ floor: e.detail.id, area: '' })}></sw-dropdown></div>`;
  }

  private skeleton(): TemplateResult {
    const card = html`<div class="glass" style="padding:10px 10px 14px;display:flex;flex-direction:column;gap:12px"><span class="skl" style="aspect-ratio:16/6.3;border-radius:var(--sw-r-lg)"></span><div style="display:flex;align-items:center;gap:12px;padding-inline:6px"><div style="flex:1;display:flex;flex-direction:column;gap:8px"><span class="skl" style="block-size:16px;inline-size:55%"></span><span class="skl" style="block-size:12px;inline-size:35%"></span></div><span class="skl" style="inline-size:44px;block-size:44px;border-radius:50%"></span></div><span class="skl" style="block-size:40px;border-radius:var(--sw-r-pill);margin-inline:6px"></span></div>`;
    return html`<div data-mm-state="loading" aria-busy="true"><div class="sgrid">${Array.from({ length: this.phone ? 3 : 6 }, () => card)}</div></div>`;
  }

  private editBar(): TemplateResult {
    const both = this.res.can_edit && this.res.can_personalize;
    return html`<div class="editbar" data-mm-editbar>
      <span class="t">${mIcon('edit')}${tr('עריכת מסך המולטימדיה')}</span>
      ${both ? html`<sw-segmented radio size="sm" label=${tr('עבור מי')} value=${this.scope} @change=${(e: CustomEvent<SegmentedChange>) => this.setScope(e.detail.value === 'me' ? 'me' : 'all')}
        .options=${[{ value: 'all', label: tr('לכולם'), attrs: { 'data-scope': 'all' } }, { value: 'me', label: tr('רק אני'), attrs: { 'data-scope': 'me' } }]}></sw-segmented>` : nothing}
      <span class="grow"></span>
      ${this.conflict ? html`<span class="note-bad" role="alert">${tr('המסך נערך במקום אחר')}</span><button type="button" class="btn sm" @click=${() => void this.reloadAfterConflict()}>${tr('טען מחדש')}</button>` : nothing}
      ${this.saveError ? html`<span class="note-bad" role="alert">${this.saveError}</span>` : nothing}
      <button type="button" class="btn sm quiet" data-mm-cancel ?disabled=${this.busy} @click=${() => this.askCancel()}>${tr('ביטול')}</button>
      <button type="button" class="btn sm quiet dz" data-mm-reset ?disabled=${this.busy} @click=${() => (this.confirm = 'reset')}>${tr('ברירת מחדל')}</button>
      <button type="button" class="btn sm primary" data-mm-save ?disabled=${this.busy || !this.dirty || this.conflict} @click=${() => void this.save()}>${mIcon('check')}${tr('שמור')}</button>
    </div>`;
  }

  private confirmDialog(): TemplateResult {
    const c = this.confirm;
    if (!c) return html`<sw-dialog data-mm-confirm="closed"></sw-dialog>`;
    const reset = c === 'reset';
    const heading = reset ? (this.scope === 'all' ? tr('להחזיר את המסך לברירת המחדל לכולם?') : tr('להחזיר את המסך שלי לברירת המחדל?')) : tr('לבטל את השינויים?');
    return html`<sw-dialog open heading=${heading} data-mm-confirm=${c} @close=${() => (this.confirm = null)}>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-block-start:6px">
        <sw-button data-mm-confirm-no autofocus @click=${() => (this.confirm = null)}>${reset ? tr('ביטול') : tr('המשך עריכה')}</sw-button>
        <sw-button variant="danger" data-mm-confirm-yes @click=${() => (reset ? void this.resetLayout() : this.leaveEdit())}>${reset ? tr('החזר') : tr('בטל שינויים')}</sw-button>
      </div></sw-dialog>`;
  }

  private body(): TemplateResult | typeof nothing {
    if (this.phase === 'loading') return this.skeleton();
    if (this.phase === 'error') {
      return html`<div data-mm-state="error">${this.stateBox('warning', tr('לא ניתן לטעון את המסכים'), html`<button type="button" class="btn sm" data-mm-retry @click=${() => { this.phase = 'loading'; void this.load(); }}>${mIcon('refresh')}${tr('נסה שוב')}</button>`)}</div>`;
    }
    if (this.phase === 'forbidden') return html`<div data-mm-state="forbidden">${this.stateBox('tv', tr('אין הרשאת צפייה במסכים'))}</div>`;
    if (this.phase === 'disabled') return html`<div data-mm-state="disabled">${this.stateBox('power', tr('המולטימדיה כבויה'))}</div>`;
    if (!this.devices.length) {
      const cfg = this.status?.can.configure;
      return html`<div data-mm-state="empty">${this.stateBox('tv', tr('אין מסכים'), cfg ? html`<a class="btn sm" href="#/system/multimedia">${tr('להגדרות')}</a>` : undefined)}</div>`;
    }
    const groups = this.groupsToShow();
    const stale = this.staleError ? html`<div class="errbar" role="alert" data-mm-stale>${mIcon('warning')}${tr('הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.')}<button type="button" class="btn sm" @click=${() => void this.load()}>${tr('נסה שוב')}</button></div>` : nothing;
    if (!groups.length) {
      return html`${stale}<div data-mm-state="filtered">${this.stateBox('search', tr('לא נמצאו מסכים'), filtersActive(this.filters) ? html`<button type="button" class="btn sm" data-clear-filters @click=${() => this.setFilters(NO_FILTER)}>${tr('נקה סינון')}</button>` : undefined)}</div>`;
    }
    let offset = 0;
    const offsets = groups.map((g) => ((offset += g.items.length), offset - g.items.length));
    this.fit.sync(offset, `${groups.map((g) => `${g.id}:${g.items.map((i) => `${i.device.key}/${i.size}`).join(',')}`).join('|')}|${this.phone}`);
    return html`${stale}<div class="groups" data-mm-state="ready">${groups.map((g, gi) => this.group(g, groups.length === 1, offsets[gi]))}</div>`;
  }

  /** overrides the base (which marks the host while the pages are in force): this screen's region also fits while the long lists scroll */
  protected willUpdate() {
    this.toggleAttribute('data-fit', this.fit.fits); // PAGING-SETTING-2439: the region pages, or scrolls inside itself when the long lists scroll
  }

  render() {
    const body = this.body(); // first: it tells the pager in the header how many cards there are
    return html`<sw-page class="page" wide heading=${tr('מסכים')} subheading=${this.summary()} data-screen="multimedia">
      ${this.floorAction()}
      ${this.header()}
      ${this.editing && this.draft
        ? html`<div class="editing-stack">${this.editBar()}</div>
          <div class="edit-layout"><multimedia-edit-panel class="edit-side" .draft=${this.draft} .devices=${this.devices} .scope=${this.scope} .floors=${floorsOf(this.devices, this.draft)} @layout-draft=${(e: CustomEvent<MediaLayout>) => this.patchDraft(e.detail)}></multimedia-edit-panel><div class="edit-cards">${body}</div></div>`
        : html`<div class="scr" data-mm-region>${body}</div>`}
    </sw-page>
    <media-bulk-dialog @bulk-done=${() => void this.load()}></media-bulk-dialog>
    ${this.confirmDialog()}
    ${this.remoteKey ? html`<media-remote .deviceKey=${this.remoteKey} .open=${true} @close=${() => this.closePanel()}></media-remote>` : nothing}
    ${this.toast ? html`<div class="toast" role="status" ${liftRef() /* DIALOG-TOPLAYER-2381: above an open sw-dialog */}>${mIcon('check')}${this.toast}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'multimedia-screens': MultimediaScreens;
  }
}
