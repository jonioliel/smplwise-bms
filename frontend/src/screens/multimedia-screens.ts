import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/media-screen-card';
import '../components/media-bulk-dialog';
import './multimedia-edit-panel';
import type { MediaBulkDialog } from '../components/media-bulk-dialog';
import { ApiError, describeError } from '../api/client';
import { subscribeHa } from '../api/ha';
import { getDevicesTree } from '../api/devices';
import { isApi } from '../api/session';
import {
  EMPTY_LAYOUT, bulkCandidates, isLit, media, resolveCards,
  type CardGroup, type LayoutResponse, type MediaDevice, type MediaLayout, type MediaStatus, type Size,
} from '../api/media-screens';
import { loadLayout, savePersonal } from '../api/media-personal';
import { onRouteChange, parseRoute, pushRoute, replaceRoute } from '../router';
import { registerScreenEdit } from '../shell/screen-edit';
import { phoneRestricted } from '../shell/phone';
import { bidi } from '../i18n/bidi';
import { applyMediaGlass, mediaGlassStyles } from '../styles/media-glass';
import { mIcon, nameText } from '../components/media-icons';
import {
  DEMO_FLOOR_ORDER, NO_FILTER, NO_FLOOR, STATE_FILTERS, cardOf, countsOf, editGroups, effective, filterDevices, filtersActive, filtersFromParams, filtersToParams,
  floorsOf, installationPayload, isDirty, moveInGroup, personalFrom, roomsOf, setCard, startDraft, togglePin, withFloorOrder,
  type EditScope, type Filters, type StateFilter,
} from './multimedia-layout';

type Phase = 'loading' | 'ready' | 'error' | 'forbidden' | 'disabled';

const PATH = '/multimedia/screens';
const FALLBACK_LAYOUT: LayoutResponse = { installation: EMPTY_LAYOUT, personal: null, revision: 0, can_edit: false, can_personalize: false };
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
export class MultimediaScreens extends LitElement {
  /** `?remote=<device key>` of the address: the screen whose remote is open ('' = none). */
  @property() remoteKey = '';
  @state() private phase: Phase = 'loading';
  @state() private devices: MediaDevice[] = [];
  @state() private status: MediaStatus | null = null;
  @state() private res: LayoutResponse = FALLBACK_LAYOUT;
  /** The home screen's floor order: what an empty `floor_order` of the layout follows. */
  @state() private homeFloors: string[] = [];
  @state() private filters: Filters = NO_FILTER;
  @state() private floorMenu = false;
  @state() private compactHeader = false;
  @state() private staleError = '';
  @state() private toast = '';
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;
  // the layout editor
  @state() private editing = false;
  @state() private scope: EditScope = 'all';
  @state() private draft: MediaLayout | null = null;
  @state() private base: MediaLayout | null = null;
  @state() private busy = false;
  @state() private saveError = '';
  @state() private conflict = false;
  @state() private confirm: 'reset' | 'cancel' | null = null;
  @query('media-bulk-dialog') private bulk?: MediaBulkDialog;

  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  private offRoute: (() => void) | null = null;
  private offEdit: (() => void) | null = null;
  private offPush: (() => void) | null = null;
  private refreshTimer = 0;
  private pollTimer = 0;
  private toastTimer = 0;
  private qTimer = 0;
  private typing = 0;
  private wantsEdit = false;
  private editHandled = false;
  private pushedRemote = false;
  private loading = false;
  private homeFloorsLoaded = false;

  static styles = [mediaGlassStyles, css`
    :host {
      display: block;
      position: relative;
      overflow: auto;
      scrollbar-width: thin;
      background: var(--dv-backdrop);
      color: var(--dv-text);
      font-family: var(--dv-font);
      font-size: 14px;
      line-height: 1.5;
    }
    .page {
      padding: 0 36px 44px;
      display: flex;
      flex-direction: column;
      gap: 26px;
      min-block-size: 100%;
    }
    /* the header: a large title, rooms, the floor menu; it sticks and compacts while scrolling */
    .dh {
      position: sticky;
      inset-block-start: 0;
      z-index: 15;
      margin-inline: -36px;
      padding: 16px 36px 4px;
      padding-inline-end: calc(36px + var(--sw-float-reserve, 0px));
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: background var(--mm-motion) var(--mm-ease), padding var(--mm-motion) var(--mm-ease), box-shadow var(--mm-motion);
    }
    .dh.compact {
      padding-block: 10px;
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border-block-end: 1px solid var(--dv-border);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    }
    .dh-row {
      display: flex;
      align-items: center;
      gap: 12px 18px;
      min-inline-size: 0;
    }
    h1 {
      margin: 0;
      font-size: var(--mm-fs-page-title);
      font-weight: 700;
      letter-spacing: -0.035em;
      line-height: 1.04;
      flex: none;
      transition: font-size var(--mm-motion) var(--mm-ease);
    }
    .dh.compact h1 {
      font-size: var(--mm-fs-page-title-compact);
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
      block-size: 38px;
      padding-inline: 17px;
      border-radius: var(--dv-radius-control);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-2);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      font-size: 14px;
      font-weight: 500;
      color: var(--dv-text-2);
      white-space: nowrap;
      transition: background var(--mm-motion), color var(--mm-motion);
    }
    .rc:hover {
      color: var(--dv-text);
      background: var(--dv-surface);
    }
    .rc[aria-pressed='true'] {
      background: var(--dv-text);
      border-color: transparent;
      color: var(--mm-text-inverse);
      font-weight: 600;
      box-shadow: var(--dv-shadow-control);
    }
    .flwrap {
      position: relative;
      flex: none;
    }
    .floorbtn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      block-size: 40px;
      padding-inline: 13px 12px;
      border-radius: var(--dv-radius-control);
      border: 1px solid var(--dv-border);
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      box-shadow: var(--dv-shadow-control);
      font-size: 13.5px;
      font-weight: 600;
      color: var(--dv-text);
      white-space: nowrap;
    }
    .floorbtn .ic {
      font-size: 17px;
      color: var(--dv-text-2);
    }
    .floorbtn .ic:last-child {
      font-size: 14px;
      transition: transform var(--mm-motion) var(--mm-ease);
    }
    .floorbtn[aria-expanded='true'] .ic:last-child {
      transform: rotate(180deg);
    }
    .flwrap .pop {
      inset-block-start: calc(100% + 8px);
      inset-inline-end: 0;
    }
    .dh-det {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      max-block-size: 120px;
      transition: max-height var(--mm-motion) var(--mm-ease), opacity var(--mm-motion);
    }
    .dh.compact .dh-det {
      max-block-size: 0;
      opacity: 0;
      overflow: hidden;
      margin-block-end: -12px;
      pointer-events: none;
    }
    .amb {
      font-size: 14px;
      color: var(--dv-text-2);
    }
    .amb em {
      font-style: normal;
      color: var(--dv-text);
      font-weight: 600;
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
      font-size: 13.5px;
      color: var(--dv-text);
    }
    .search input::placeholder {
      color: var(--dv-text-2);
    }
    .search .ic {
      font-size: 16px;
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
    .sh h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.025em;
      line-height: 1.2;
    }
    .shlink {
      all: unset;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border-radius: 8px;
      min-block-size: 28px;
    }
    .shlink .ic {
      font-size: 19px;
      color: var(--dv-text-3);
      transition: transform var(--mm-motion) var(--mm-ease);
    }
    .shlink:hover .ic {
      transform: translateX(-3px);
    }
    .shlink:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
    }
    .sh small {
      display: block;
      font-size: 13px;
      color: var(--dv-text-2);
      margin-block-start: 1px;
    }
    .sh small em {
      font-style: normal;
      color: var(--dv-text);
      font-weight: 600;
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
      border-radius: 999px;
      background: var(--mm-sheet-surface);
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
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
      font-size: 11px;
      font-weight: 700;
    }
    .ecard button:hover {
      background: var(--dv-surface-3);
    }
    .ecard button[aria-pressed='true'] {
      color: var(--dv-accent-text);
      background: var(--dv-accent-soft);
    }
    .ecard button[disabled] {
      opacity: 0.35;
    }
    .ecard .ic {
      font-size: 16px;
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
      font-size: 13px;
      font-weight: 600;
    }
    .toast {
      position: fixed;
      z-index: 90;
      inset-inline: 0;
      margin-inline: auto;
      inline-size: max-content;
      max-inline-size: calc(100% - 24px);
      inset-block-end: 26px;
      background: rgba(28, 28, 30, 0.88);
      -webkit-backdrop-filter: blur(20px);
      backdrop-filter: blur(20px);
      color: #fff;
      padding: 11px 20px 11px 16px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 13.5px;
      font-weight: 500;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
      display: flex;
      gap: 9px;
      align-items: center;
      animation: mm-pop var(--mm-motion) var(--mm-ease);
    }
    .toast .ic {
      color: #30d158;
      font-size: 16px;
    }
    @media (pointer: coarse), (max-width: 767px) {
      .rc,
      .floorbtn,
      .search {
        block-size: 44px;
      }
      .ecard button {
        inline-size: 44px;
        block-size: 44px;
      }
    }
    @media (max-width: 767px) {
      .page {
        padding: 0 14px 26px;
        gap: 18px;
      }
      .dh {
        margin-inline: -14px;
        padding: 12px 14px 2px;
        padding-inline-end: 14px;
        gap: 10px;
      }
      .dh.compact {
        padding-block: 8px;
      }
      .dh-row {
        display: grid;
        /* the third column keeps the row clear of the shell's floating search / status corner */
        grid-template-columns: minmax(0, 1fr) auto var(--sw-float-reserve, 0px);
        grid-template-areas: 't f .' 'r r r';
        gap: 10px;
      }
      .dh-row h1 {
        grid-area: t;
      }
      .dh-row .flwrap {
        grid-area: f;
      }
      .dh-row .rooms {
        grid-area: r;
        margin-inline: -14px;
        padding-inline: 14px;
      }
      .dh.compact .rooms {
        display: none;
      }
      .amb {
        display: none;
      }
      .dh-det .seg {
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
        inset-block-end: calc(var(--sw-bottomnav-h, 66px) + 14px);
      }
      .groups {
        gap: 22px;
      }
    }
    @media (min-width: 768px) and (max-width: 1023px) {
      .page {
        padding-inline: 24px;
      }
      .dh {
        margin-inline: -24px;
        padding-inline: 24px;
        padding-inline-end: calc(24px + var(--sw-float-reserve, 0px));
      }
      .sgrid > .l {
        grid-column: auto;
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    void applyMediaGlass(this);
    this.phoneMq.addEventListener('change', this.onPhone);
    this.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('pointerdown', this.onOutside, true);
    window.addEventListener('keydown', this.onKey);
    // addition A: the layout editor is entered from the user menu (shell/screen-edit.ts), never from a button in the page
    this.offEdit = registerScreenEdit({
      id: 'multimedia-layout',
      label: 'עריכת מסך המולטימדיה',
      icon: 'edit',
      can: () => this.canEdit && !this.editing,
      run: () => this.enterEdit(),
    });
    this.offRoute = onRouteChange((r) => {
      if (r.mode !== 'multimedia' || (r.segments[1] ?? 'screens') !== 'screens') return;
      const f = filtersFromParams(r.params);
      this.filters = this.typing ? { ...f, q: this.filters.q } : f;
      this.wantsEdit = r.params.get('edit') === '1';
      if (!this.wantsEdit) {
        this.editHandled = false;
        if (this.editing) this.leaveEdit(false); // Back / a link took the address out of edit mode
      }
      this.requestUpdate();
    });
    void this.load();
    if (isApi()) {
      this.offPush = subscribeHa(
        (m) => {
          if (m.type === 'media_state') {
            this.devices = this.devices.map((d) => (d.key === m.device_key ? { ...d, live: m.live } : d));
          } else if (m.type === 'media_devices_changed') this.scheduleRefresh(200);
        },
        (connected) => {
          if (connected) this.scheduleRefresh(200); // pushes sent while the socket was down are gone: catch up now
        },
      );
    }
    this.pollTimer = window.setInterval(() => void this.load(), 30_000); // a slow safety net; the push socket does the real work
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.phoneMq.removeEventListener('change', this.onPhone);
    this.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('pointerdown', this.onOutside, true);
    window.removeEventListener('keydown', this.onKey);
    this.offEdit?.();
    this.offRoute?.();
    this.offPush?.();
    this.offEdit = this.offRoute = this.offPush = null;
    for (const t of [this.refreshTimer, this.pollTimer, this.toastTimer, this.qTimer]) window.clearTimeout(t);
    window.clearInterval(this.pollTimer);
  }

  protected updated() {
    // `?edit=1` (the user menu, or a link): entered once the data is there and this user may edit; dropped otherwise
    if (this.wantsEdit && !this.editHandled && this.phase === 'ready') {
      this.editHandled = true;
      if (!this.editing) {
        if (this.canEdit) this.enterEdit(true);
        else this.dropParam('edit');
      }
    }
  }

  // ------------------------------------------------------------------------------------------------ data

  private get canEdit(): boolean {
    return this.phase === 'ready' && (this.res.can_edit || this.res.can_personalize) && !phoneRestricted('layout_editor');
  }

  private async load() {
    if (this.loading) return;
    this.loading = true;
    try {
      const st = await media().status();
      this.status = st;
      if (!st.enabled) {
        this.phase = 'disabled';
        return;
      }
      if (!st.can.read) {
        this.phase = 'forbidden';
        return;
      }
      const [list, lay] = await Promise.allSettled([media().list(), loadLayout()]);
      if (list.status === 'rejected') throw list.reason;
      this.devices = list.value.devices;
      if (lay.status === 'fulfilled' && !this.editing) this.res = lay.value;
      if (!this.homeFloorsLoaded && !this.res.installation.floor_order.length) await this.loadHomeFloors();
      this.phase = 'ready';
      this.staleError = '';
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.phase = 'forbidden';
      else if (err instanceof ApiError && err.code === 'feature_disabled') this.phase = 'disabled';
      else if (this.phase === 'ready') this.staleError = describeError(err);
      else {
        this.phase = 'error';
        this.staleError = describeError(err);
      }
    } finally {
      this.loading = false;
    }
  }

  /** An empty `floor_order` of the layout follows the home screen's floors (MEDIA_API.md §2.4): read once from the devices tree
   * (devices.read; without it the order of the list stands). The static demo has no home screen: the mock's own floor order. */
  private async loadHomeFloors() {
    this.homeFloorsLoaded = true;
    if (!isApi()) {
      this.homeFloors = DEMO_FLOOR_ORDER;
      return;
    }
    try {
      this.homeFloors = (await getDevicesTree()).floors.map((f) => f.floor_id).filter((id) => id !== NO_FLOOR);
    } catch {
      this.homeFloors = [];
    }
  }

  /** The layout the page draws: the installation's with the personal override, the floors in the order that applies. */
  private display(): MediaLayout {
    return withFloorOrder(effective(this.res.installation, this.res.personal), this.homeFloors);
  }

  private scheduleRefresh(ms: number) {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => void this.load(), ms);
  }

  private say(text: string) {
    this.toast = text;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = ''), 3200);
  }

  // ------------------------------------------------------------------------------------------------ address

  private params(): URLSearchParams {
    return new URLSearchParams(parseRoute().params);
  }

  private dropParam(name: string) {
    const p = this.params();
    p.delete(name);
    replaceRoute(PATH, p);
  }

  private setFilters(patch: Partial<Filters>, immediate = true) {
    this.filters = { ...this.filters, ...patch };
    if (patch.floor !== undefined && patch.area === undefined && this.filters.area && !roomsOf(this.devices, this.filters.floor).some((r) => r.id === this.filters.area)) this.filters = { ...this.filters, area: '' };
    const write = () => replaceRoute(PATH, filtersToParams(this.filters, this.params()));
    window.clearTimeout(this.qTimer);
    if (immediate) write();
    else this.qTimer = window.setTimeout(write, 300);
  }

  private onSearch(v: string) {
    this.typing = Date.now();
    this.setFilters({ q: v }, false);
    window.setTimeout(() => {
      if (Date.now() - this.typing >= 900) this.typing = 0;
    }, 950);
  }

  private onScroll = () => {
    const y = this.scrollTop;
    if (!this.compactHeader && y > 60) this.compactHeader = true;
    else if (this.compactHeader && y < 12) this.compactHeader = false;
  };

  private onOutside = (e: Event) => {
    if (this.floorMenu && !e.composedPath().some((n) => (n as HTMLElement).classList?.contains('flwrap'))) this.floorMenu = false;
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.floorMenu) this.floorMenu = false;
  };

  // ------------------------------------------------------------------------------------------------ remote

  private openRemote(key: string) {
    const p = this.params();
    p.set('remote', key);
    this.pushedRemote = true;
    pushRoute(PATH, p);
  }

  private closeRemote() {
    if (this.pushedRemote) {
      this.pushedRemote = false;
      window.history.back();
    } else this.dropParam('remote');
    this.scheduleRefresh(250);
  }

  // ------------------------------------------------------------------------------------------------ the layout editor

  private enterEdit(fromRoute = false) {
    if (!this.canEdit || this.editing) return;
    this.scope = this.res.can_edit ? 'all' : 'me';
    this.beginDraft();
    this.editing = true;
    this.editHandled = true; // the address below is ours: nothing more to act on
    this.filters = NO_FILTER;
    this.floorMenu = false;
    if (!fromRoute) {
      const p = this.params();
      filtersToParams(NO_FILTER, p);
      p.set('edit', '1');
      replaceRoute(PATH, p);
    }
    this.scrollTo({ top: 0 });
  }

  private beginDraft() {
    const d = startDraft(this.scope, this.res.installation, this.res.personal, this.devices, this.homeFloors);
    this.draft = d;
    this.base = d;
    this.saveError = '';
    this.conflict = false;
  }

  private leaveEdit(dropParam = true) {
    this.editing = false;
    this.draft = this.base = null;
    this.confirm = null;
    this.busy = false;
    this.editHandled = dropParam ? false : this.editHandled;
    if (dropParam) this.dropParam('edit');
  }

  private setScope(s: EditScope) {
    if (s === this.scope) return;
    this.scope = s;
    this.beginDraft(); // another base: the changes of the other scope are not carried over
  }

  private get dirty(): boolean {
    return !!this.draft && !!this.base && isDirty(this.base, this.draft);
  }

  private askCancel() {
    if (this.dirty) this.confirm = 'cancel';
    else this.leaveEdit();
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
      this.say('נשמר');
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
      this.say('חזר לברירת המחדל');
    } catch (err) {
      this.saveError = describeError(err);
      this.busy = false;
    }
  }

  private async reloadAfterConflict() {
    this.res = await loadLayout();
    await this.load();
    this.beginDraft();
  }

  private patchDraft(next: MediaLayout) {
    this.draft = next;
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
      <button type="button" aria-label=${`הקדם · ${name}`} title="הקדם" ?disabled=${index === 0} @click=${() => this.patchDraft(moveInGroup(draft, this.devices, d.key, -1))}>${mIcon('arrowUp')}</button>
      <button type="button" aria-label=${`אחר · ${name}`} title="אחר" ?disabled=${index === count - 1} @click=${() => this.patchDraft(moveInGroup(draft, this.devices, d.key, 1))}>${mIcon('arrowDown')}</button>
      <button type="button" aria-label=${`גודל · ${name}`} title="גודל" @click=${() => this.patchDraft(setCard(draft, d.key, { size: SIZE_ORDER[(SIZE_ORDER.indexOf(size) + 1) % 3] }))}>${size.toUpperCase()}</button>
      ${this.scope === 'all' ? html`<button type="button" aria-pressed=${String(pinned)} aria-label=${`מועדף · ${name}`} title="מועדף" @click=${() => this.patchDraft(togglePin(draft, d.key))}>${mIcon('star')}</button>` : nothing}
      <button type="button" aria-label=${`${c.on ? 'הסתר' : 'הצג'} · ${name}`} title=${c.on ? 'הסתר' : 'הצג'} @click=${() => this.patchDraft(setCard(draft, d.key, { on: !c.on }))}>${mIcon(c.on ? 'eye' : 'eyeOff')}</button>
    </span>`;
  }

  private card(d: MediaDevice, size: Size, index: number, count: number): TemplateResult {
    const edit = this.editing && !!this.draft;
    const off = edit && !cardOf(this.draft!, d.key).on;
    return html`<media-screen-card class=${classMap({ l: size === 'l' })} data-screen-card=${d.key} .device=${d} .size=${size} ?compact=${this.phone} ?editing=${edit} ?data-dimmed=${off}
      @open-remote=${(e: CustomEvent<{ key: string }>) => this.openRemote(e.detail.key)} @media-changed=${() => this.scheduleRefresh(isApi() ? 700 : 30)}>${edit ? this.chips(d, index, count, size) : nothing}</media-screen-card>`;
  }

  private group(g: CardGroup): TemplateResult {
    const all = g.items.map((i) => i.device);
    const counts = countsOf(all);
    const target = this.editing ? null : this.floorOfGroup(g);
    const sameScope = this.devices.filter((d) => (target?.scope === 'area' ? (d.area_id ?? '') === target.id : target ? (d.floor_id ?? NO_FLOOR) === target.id : false));
    const offBtn = target && !this.editing && bulkCandidates(sameScope).length
      ? html`<button type="button" class="btn sm quiet dz" data-bulk-off=${target.id} @click=${() => this.bulk?.show({ scope: target.scope, id: target.id, name: g.label })}>${mIcon('power')}כבה מסכים</button>`
      : nothing;
    const title = g.id === 'pinned' || g.id === 'all' || !target || this.editing
      ? html`<h2>${nameText(bidi(g.label))}</h2>`
      : html`<h2><button type="button" class="shlink" data-group-open=${g.id} @click=${() => this.setFilters(target.scope === 'area' ? { area: g.id } : { floor: g.id, area: '' })}>${bidi(g.label)}${mIcon('chevronBack')}</button></h2>`;
    const lit = all.filter((d) => isLit(d.live)).length;
    return html`<section class="fsec" aria-label=${g.label} data-group=${g.id}>
      <header class="sh"><div>${title}<small><span class="n">${counts.total}</span> ${counts.total === 1 ? 'מסך' : 'מסכים'}${lit ? html` · <em><span class="n">${lit}</span></em> פועלים` : nothing}</small></div><span class="grow"></span>${offBtn}</header>
      <div class="sgrid">${repeat(g.items, (i) => i.device.key, (i, idx) => this.card(i.device, i.size, idx, g.items.length))}</div>
    </section>`;
  }

  private header(): TemplateResult {
    const f = this.filters;
    const floors = floorsOf(this.devices, this.display());
    const rooms = roomsOf(this.devices, f.floor);
    const c = countsOf(this.devices);
    const floorName = f.floor ? floors.find((x) => x.id === f.floor)?.name ?? 'קומה' : 'כל הקומות';
    const showFloor = floors.length > 1 || !!f.floor;
    const tools = !this.editing && this.phase === 'ready' && this.devices.length > 0;
    return html`<header class=${classMap({ dh: true, compact: this.compactHeader })} data-mm-header>
      <div class="dh-row">
        <h1>מסכים</h1>
        ${tools ? html`<div class="rooms" role="group" aria-label="חדרים" @pointerdown=${this.roomsDrag}>
          <button type="button" class="rc" aria-pressed=${String(!f.area)} data-room="" @click=${() => this.setFilters({ area: '' })}>הכל</button>
          ${rooms.map((r) => html`<button type="button" class="rc" aria-pressed=${String(f.area === r.id)} data-room=${r.id} @click=${() => this.setFilters({ area: r.id })}>${nameText(r.name)}</button>`)}
        </div>` : html`<span class="grow"></span>`}
        ${tools && showFloor ? html`<div class="flwrap"><button type="button" class="floorbtn" aria-haspopup="menu" aria-expanded=${String(this.floorMenu)} data-floor-menu @click=${() => (this.floorMenu = !this.floorMenu)}>${mIcon('layers')}<span>${bidi(floorName)}</span>${mIcon('chevronDown')}</button>
          ${this.floorMenu ? this.floorPop(floors) : nothing}</div>` : nothing}
      </div>
      ${tools ? html`<div class="dh-det">
        <span class="amb"><em><span class="n">${c.on}</span></em> פועלים מתוך <span class="n">${c.total}</span>${c.un ? html` · <span class="n">${c.un}</span> לא זמין` : nothing}</span>
        <span class="grow"></span>
        <div class="seg sm" role="radiogroup" aria-label="סינון לפי מצב">${STATE_FILTERS.map((s) => html`<button type="button" role="radio" aria-checked=${String(f.state === s.id)} data-state-filter=${s.id} @click=${() => this.setFilters({ state: s.id as StateFilter })}>${s.label}${s.id === 'on' ? html` <small>${c.on}</small>` : s.id === 'un' && c.un ? html` <small>${c.un}</small>` : nothing}</button>`)}</div>
        <label class="search">${mIcon('search')}<span class="vh">חיפוש מסך</span><input type="search" data-search placeholder="חיפוש מסך או חדר" .value=${f.q} @input=${(e: Event) => this.onSearch((e.target as HTMLInputElement).value)} /></label>
      </div>` : nothing}
    </header>`;
  }

  private floorPop(floors: ReturnType<typeof floorsOf>): TemplateResult {
    const row = (id: string, name: string, n: number, icon: 'home' | 'layers') => html`<button type="button" role="menuitemradio" aria-checked=${String(this.filters.floor === id)} data-floor-pick=${id} @click=${() => { this.floorMenu = false; this.setFilters({ floor: id, area: '' }); }}>${mIcon(icon)}${bidi(name)}<span class="cnt"><span class="n">${n}</span></span></button>`;
    return html`<div class="pop" role="menu" aria-label="קומות">${row('', 'כל הקומות', this.devices.length, 'home')}<hr />${floors.map((x) => row(x.id, x.name, x.count, 'layers'))}</div>`;
  }

  /** The room chips scroll by a mouse drag too (a touch scrolls natively). */
  private roomsDrag = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const x0 = e.clientX;
    const s0 = el.scrollLeft;
    let moved = false;
    const move = (m: PointerEvent) => {
      if (Math.abs(m.clientX - x0) > 4) moved = true;
      if (moved) {
        el.classList.add('dragging');
        el.scrollLeft = s0 - (m.clientX - x0) * (getComputedStyle(el).direction === 'rtl' ? -1 : 1);
      }
    };
    const up = (u: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.classList.remove('dragging');
      if (moved) {
        u.preventDefault();
        const stop = (c: Event) => c.stopImmediatePropagation();
        el.addEventListener('click', stop, { capture: true, once: true });
        window.setTimeout(() => el.removeEventListener('click', stop, { capture: true }), 0);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  private skeleton(): TemplateResult {
    const card = html`<div class="glass" style="padding:10px 10px 14px;display:flex;flex-direction:column;gap:12px"><span class="skl" style="aspect-ratio:16/6.3;border-radius:14px"></span><div style="display:flex;align-items:center;gap:12px;padding-inline:6px"><div style="flex:1;display:flex;flex-direction:column;gap:8px"><span class="skl" style="block-size:16px;inline-size:55%"></span><span class="skl" style="block-size:12px;inline-size:35%"></span></div><span class="skl" style="inline-size:44px;block-size:44px;border-radius:50%"></span></div><span class="skl" style="block-size:40px;border-radius:999px;margin-inline:6px"></span></div>`;
    return html`<div data-mm-state="loading" aria-busy="true"><div class="sgrid">${Array.from({ length: this.phone ? 3 : 6 }, () => card)}</div></div>`;
  }

  private stateBox(icon: 'tv' | 'warning' | 'search' | 'power', title: string, action?: TemplateResult): TemplateResult {
    return html`<div class="statebox glass" role="status"><span class="ring">${mIcon(icon)}</span><b>${title}</b>${action ?? nothing}</div>`;
  }

  private editBar(): TemplateResult {
    const both = this.res.can_edit && this.res.can_personalize;
    return html`<div class="editbar" data-mm-editbar>
      <span class="t">${mIcon('edit')}עריכת מסך המולטימדיה</span>
      ${both ? html`<div class="seg sm" role="radiogroup" aria-label="עבור מי">
        <button type="button" role="radio" aria-checked=${String(this.scope === 'all')} data-scope="all" @click=${() => this.setScope('all')}>לכולם</button>
        <button type="button" role="radio" aria-checked=${String(this.scope === 'me')} data-scope="me" @click=${() => this.setScope('me')}>רק אני</button></div>` : nothing}
      <span class="grow"></span>
      ${this.conflict ? html`<span class="note-bad" role="alert">המסך נערך במקום אחר</span><button type="button" class="btn sm" @click=${() => void this.reloadAfterConflict()}>טען מחדש</button>` : nothing}
      ${this.saveError ? html`<span class="note-bad" role="alert">${this.saveError}</span>` : nothing}
      <button type="button" class="btn sm quiet" data-mm-cancel ?disabled=${this.busy} @click=${() => this.askCancel()}>ביטול</button>
      <button type="button" class="btn sm quiet dz" data-mm-reset ?disabled=${this.busy} @click=${() => (this.confirm = 'reset')}>ברירת מחדל</button>
      <button type="button" class="btn sm primary" data-mm-save ?disabled=${this.busy || !this.dirty || this.conflict} @click=${() => void this.save()}>${mIcon('check')}שמור</button>
    </div>`;
  }

  private confirmDialog(): TemplateResult {
    const c = this.confirm;
    if (!c) return html`<sw-dialog data-mm-confirm="closed"></sw-dialog>`;
    const reset = c === 'reset';
    const heading = reset ? (this.scope === 'all' ? 'להחזיר את המסך לברירת המחדל לכולם?' : 'להחזיר את המסך שלי לברירת המחדל?') : 'לבטל את השינויים?';
    return html`<sw-dialog open heading=${heading} data-mm-confirm=${c} @close=${() => (this.confirm = null)}>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-block-start:6px">
        <sw-button data-mm-confirm-no autofocus @click=${() => (this.confirm = null)}>${reset ? 'ביטול' : 'המשך עריכה'}</sw-button>
        <sw-button variant="danger" data-mm-confirm-yes @click=${() => (reset ? void this.resetLayout() : this.leaveEdit())}>${reset ? 'החזר' : 'בטל שינויים'}</sw-button>
      </div></sw-dialog>`;
  }

  private body(): TemplateResult | typeof nothing {
    if (this.phase === 'loading') return this.skeleton();
    if (this.phase === 'error') {
      return html`<div data-mm-state="error">${this.stateBox('warning', 'לא ניתן לטעון את המסכים', html`<button type="button" class="btn sm" data-mm-retry @click=${() => { this.phase = 'loading'; void this.load(); }}>${mIcon('refresh')}נסה שוב</button>`)}</div>`;
    }
    if (this.phase === 'forbidden') return html`<div data-mm-state="forbidden">${this.stateBox('tv', 'אין הרשאת צפייה במסכים')}</div>`;
    if (this.phase === 'disabled') return html`<div data-mm-state="disabled">${this.stateBox('power', 'המולטימדיה כבויה')}</div>`;
    if (!this.devices.length) {
      const cfg = this.status?.can.configure;
      return html`<div data-mm-state="empty">${this.stateBox('tv', 'אין מסכים', cfg ? html`<a class="btn sm" href="#/system/multimedia">להגדרות</a>` : undefined)}</div>`;
    }
    const groups = this.groupsToShow();
    const stale = this.staleError ? html`<div class="errbar" role="alert" data-mm-stale>${mIcon('warning')}הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.<button type="button" class="btn sm" @click=${() => void this.load()}>נסה שוב</button></div>` : nothing;
    if (!groups.length) {
      return html`${stale}<div data-mm-state="filtered">${this.stateBox('search', 'לא נמצאו מסכים', filtersActive(this.filters) ? html`<button type="button" class="btn sm" data-clear-filters @click=${() => this.setFilters(NO_FILTER)}>נקה סינון</button>` : undefined)}</div>`;
    }
    return html`${stale}<div class="groups" data-mm-state="ready">${groups.map((g) => this.group(g))}</div>`;
  }

  render() {
    return html`<div class="page" data-screen="multimedia">
      ${this.header()}
      ${this.editing && this.draft
        ? html`<div class="editing-stack">${this.editBar()}</div>
          <div class="edit-layout"><multimedia-edit-panel class="edit-side" .draft=${this.draft} .devices=${this.devices} .scope=${this.scope} .floors=${floorsOf(this.devices, this.draft)} @layout-draft=${(e: CustomEvent<MediaLayout>) => this.patchDraft(e.detail)}></multimedia-edit-panel><div class="edit-cards">${this.body()}</div></div>`
        : this.body()}
    </div>
    <media-bulk-dialog @bulk-done=${() => void this.load()}></media-bulk-dialog>
    ${this.confirmDialog()}
    ${this.remoteKey ? html`<media-remote .deviceKey=${this.remoteKey} .open=${true} @close=${() => this.closeRemote()}></media-remote>` : nothing}
    ${this.toast ? html`<div class="toast" role="status">${mIcon('check')}${this.toast}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'multimedia-screens': MultimediaScreens;
  }
}
