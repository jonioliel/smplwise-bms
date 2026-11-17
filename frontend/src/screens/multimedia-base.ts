import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { ApiError, describeError } from '../api/client';
import { subscribeHa, type HaPush } from '../api/ha';
import { getDevicesTree } from '../api/devices';
import { isApi } from '../api/session';
import { EMPTY_LAYOUT, type LayoutResponse, type MediaLayout } from '../api/media-screens';
import { loadLayout } from '../api/media-personal';
import { onRouteChange, parseRoute, pushRoute, replaceRoute, type RouteState } from '../router';
import { registerScreenEdit } from '../shell/screen-edit';
import { applyMultimediaKinds } from '../shell/nav';
import { clearPairChip } from '../shell/tab-pair';
import { HYBRID_MAX_ITEMS, TabsModeController } from '../shell/tabs-mode';
import { applyMediaGlass } from '../styles/media-glass';
import { PollController } from '../components/poll-controller';
import { mIcon, type MediaIconName } from '../components/media-icons';
import { DEMO_FLOOR_ORDER, NO_FLOOR, isDirty } from './multimedia-layout';
import type { PageFit } from '../components/page-fit';

/**
 * CR-MULTIMEDIA-BASE-2440 (06:DUP-1, D2): the plumbing the three multimedia screens - "מסכים" (multimedia-screens.ts), "נגנים
 * ורמקולים" (multimedia-players.ts) and "קבוצות" (multimedia-groups.ts) - each carried as a copy.
 *
 * `MediaScreenBase` (all three): the phases and the frame of a read (status first, then the screen's own lists; the last state is
 * kept and marked stale when a refresh fails), the push subscription and its catch-up after a reconnect, the 30 s safety-net poll,
 * the delayed refresh, the toast, the phone breakpoint, the user-menu entry of the editor and the `?edit=1` hand-off.
 *
 * `MediaCardsScreenBase` (screens and players): the filters in the address (with the debounced search), the compacting header,
 * the panel opened by an address parameter, the layout editor's draft (begin / leave / dirty / cancel), the home screen's floor
 * order, the room chips' mouse drag and the state box.
 *
 * Every screen keeps its own render, its own filter rules and its own save. D2: the poll is the shared `PollController` - the
 * period is the same 30 s; it does not run while the page is hidden or offline and catches up once on resume.
 */

export type MediaPhase = 'loading' | 'ready' | 'error' | 'forbidden' | 'disabled';

export const FALLBACK_LAYOUT: LayoutResponse = { installation: EMPTY_LAYOUT, personal: null, revision: 0, can_edit: false, can_personalize: false };

/** What a read needs of the status document (MediaStatus and PlayerStatus both have it). */
interface StatusLike {
  enabled: boolean;
  can: { read: boolean };
  counts: Parameters<typeof applyMultimediaKinds>[0];
}

export abstract class MediaScreenBase<St extends StatusLike, D extends { key: string }> extends LitElement {
  @state() protected phase: MediaPhase = 'loading';
  @state() protected devices: D[] = [];
  @state() protected status: St | null = null;
  @state() protected staleError = '';
  @state() protected toast = '';
  @state() protected phone = window.matchMedia('(max-width: 767px)').matches;
  @state() protected editing = false;
  @state() protected busy = false;

  protected phoneMq = window.matchMedia('(max-width: 767px)');
  protected onPhone = () => (this.phone = this.phoneMq.matches);
  private offRoute: (() => void) | null = null;
  private offEdit: (() => void) | null = null;
  private offPush: (() => void) | null = null;
  private refreshTimer = 0;
  private toastTimer = 0;
  protected wantsEdit = false;
  protected editHandled = false;
  private loading = false;
  /** D2: a slow safety net; the push socket does the real work. */
  private poll = new PollController(this);

  /** The screen's address, e.g. `/multimedia/players`. */
  protected abstract readonly path: string;
  /** The second segment of that address. */
  protected abstract readonly tab: string;
  /** The editor's entry in the user menu (shell/screen-edit.ts) - the editor is never entered from a button in the page. */
  protected abstract readonly editEntry: { id: string; label: string };
  /** NOSCROLL-1366-2437: the cards region pages instead of scrolling on a desktop (components/page-fit.ts). */
  protected abstract fit: PageFit;

  protected abstract get canEdit(): boolean;
  protected abstract enterEdit(fromRoute?: boolean): void;
  /** The address left edit mode (Back, or a link). */
  protected abstract routeLeftEdit(): void;
  protected abstract readStatus(): Promise<St>;
  /** The screen's own lists, read once the status allows it. A rejection is the read's failure. */
  protected abstract readContent(): Promise<void>;
  protected abstract pushed(m: HaPush): void;

  /** A route change of this screen: its own parameters (the filters). */
  protected readRoute(_params: URLSearchParams): void {}
  /** What the screen reads of the address when it connects, whatever the route is. */
  protected atConnect(): void {}
  /** After a successful read. */
  protected loaded(): void {}

  protected ownsRoute(r: RouteState): boolean {
    return r.segments[1] === this.tab;
  }

  connectedCallback() {
    super.connectedCallback();
    void applyMediaGlass(this);
    this.phoneMq.addEventListener('change', this.onPhone);
    this.offEdit = registerScreenEdit({
      ...this.editEntry,
      icon: 'edit',
      can: () => this.canEdit && !this.editing,
      run: () => this.enterEdit(),
    });
    this.offRoute = onRouteChange((r) => {
      if (r.mode !== 'multimedia' || !this.ownsRoute(r)) return;
      this.readRoute(r.params);
      this.wantsEdit = r.params.get('edit') === '1';
      if (!this.wantsEdit) {
        this.editHandled = false;
        this.routeLeftEdit();
      }
      this.requestUpdate();
    });
    this.atConnect();
    void this.load();
    if (isApi()) {
      this.offPush = subscribeHa(
        (m) => this.pushed(m),
        (connected) => {
          if (connected) this.scheduleRefresh(200); // pushes sent while the socket was down are gone: catch up now
        },
      );
    }
    this.poll.every('load', 30_000, () => this.load());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.phoneMq.removeEventListener('change', this.onPhone);
    this.offEdit?.();
    this.offRoute?.();
    this.offPush?.();
    this.offEdit = this.offRoute = this.offPush = null;
    for (const t of [this.refreshTimer, this.toastTimer]) window.clearTimeout(t);
    this.poll.cancel('load');
  }

  /** `?edit=1` (the user menu, or a link): entered once the data is there and this user may edit; dropped otherwise. */
  protected updated() {
    if (this.wantsEdit && !this.editHandled && this.phase === 'ready') {
      this.editHandled = true;
      if (!this.editing) {
        if (this.canEdit) this.enterEdit(true);
        else this.dropParam('edit');
      }
    }
  }

  protected willUpdate() {
    this.toggleAttribute('data-fit', this.fit.on);
  }

  protected async load() {
    if (this.loading) return;
    this.loading = true;
    try {
      const st = await this.readStatus();
      this.status = st;
      applyMultimediaKinds(st.counts); // the players / groups tabs are offered by the counts: every screen of the section reports them
      if (!st.enabled) {
        this.phase = 'disabled';
        return;
      }
      if (!st.can.read) {
        this.phase = 'forbidden';
        return;
      }
      await this.readContent();
      this.phase = 'ready';
      this.staleError = '';
      this.loaded();
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

  protected scheduleRefresh(ms: number) {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => void this.load(), ms);
  }

  protected say(text: string) {
    this.toast = text;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = ''), 3200);
  }

  protected params(): URLSearchParams {
    return new URLSearchParams(parseRoute().params);
  }

  protected dropParam(name: string) {
    const p = this.params();
    p.delete(name);
    replaceRoute(this.path, p);
  }
}

/** The filters both card screens keep in the address. */
interface FiltersLike {
  floor: string;
  area: string;
  q: string;
}

export abstract class MediaCardsScreenBase<St extends StatusLike, D extends { key: string; live: { power: unknown } }, F extends FiltersLike> extends MediaScreenBase<St, D> {
  @state() protected res: LayoutResponse = FALLBACK_LAYOUT;
  /** The home screen's floor order: what an empty `floor_order` of the layout follows (MEDIA_API.md §2.4). */
  @state() protected homeFloors: string[] = [];
  @state() protected compactHeader = false;
  // the layout editor
  @state() protected draft: MediaLayout | null = null;
  @state() protected base: MediaLayout | null = null;
  @state() protected saveError = '';
  @state() protected conflict = false;
  @state() protected confirm: 'reset' | 'cancel' | null = null;

  /** 0.1.153: the multimedia group's presentation (tabs = the room chips, today). */
  protected tabsMode = new TabsModeController(this, 'multimedia');
  private qTimer = 0;
  private typing = 0;
  private pushedPanel = false;
  private homeFloorsLoaded = false;

  protected abstract filters: F;
  protected abstract readonly noFilter: F;
  /** The address parameter that opens the screen's panel (`player`, `remote`). */
  protected abstract readonly panelParam: string;
  protected abstract filtersFromParams(p: URLSearchParams): F;
  protected abstract filtersToParams(f: F, p: URLSearchParams): URLSearchParams;
  /** The rooms a chip may name under the chosen floor (a chip of another floor does not survive a floor change). */
  protected abstract roomsInFloor(): { id: string }[];
  protected abstract listDevices(): Promise<D[]>;
  /** The editor's starting draft. */
  protected abstract startDraft(): MediaLayout;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('scroll', this.onScroll, { passive: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearPairChip(this);
    this.removeEventListener('scroll', this.onScroll);
    window.clearTimeout(this.qTimer);
  }

  protected readRoute(params: URLSearchParams) {
    const f = this.filtersFromParams(params);
    this.filters = this.typing ? { ...f, q: this.filters.q } : f;
  }

  protected routeLeftEdit() {
    if (this.editing) this.leaveEdit(false); // Back / a link took the address out of edit mode
  }

  // ------------------------------------------------------------------------------------------------ data

  protected async readContent() {
    const [list, lay] = await Promise.allSettled([this.listDevices(), loadLayout()]);
    if (list.status === 'rejected') throw list.reason;
    this.devices = list.value;
    if (lay.status === 'fulfilled' && !this.editing) this.res = lay.value;
    if (!this.homeFloorsLoaded && !this.res.installation.floor_order.length) await this.loadHomeFloors();
  }

  /** Read once from the devices tree (devices.read; without it the order of the list stands). The static demo has no home screen:
   * the mock's own floor order. */
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

  protected pushed(m: HaPush) {
    if (m.type === 'media_state') {
      const was = this.devices.find((d) => d.key === m.device_key)?.live.power;
      this.devices = this.devices.map((d) => (d.key === m.device_key ? { ...d, live: m.live as unknown as D['live'] } : d)); // a frame of the other kind matches no device here
      if (was && was !== m.live.power) this.scheduleRefresh(800); // `caps` follow the live state: read them again after a power change
    } else if (m.type === 'media_devices_changed') this.scheduleRefresh(200);
  }

  // ------------------------------------------------------------------------------------------------ address

  protected setFilters(patch: Partial<F>, immediate = true) {
    this.filters = { ...this.filters, ...patch };
    if (patch.floor !== undefined && patch.area === undefined && this.filters.area && !this.roomsInFloor().some((r) => r.id === this.filters.area)) this.filters = { ...this.filters, area: '' };
    const write = () => replaceRoute(this.path, this.filtersToParams(this.filters, this.params()));
    window.clearTimeout(this.qTimer);
    if (immediate) write();
    else this.qTimer = window.setTimeout(write, 300);
  }

  protected onSearch(v: string) {
    this.typing = Date.now();
    this.setFilters({ q: v } as Partial<F>, false);
    window.setTimeout(() => {
      if (Date.now() - this.typing >= 900) this.typing = 0;
    }, 950);
  }

  /** The page scroll (phone, narrow or short windows): the header compacts. */
  protected onScroll = () => {
    const y = this.scrollTop;
    if (!this.compactHeader && y > 60) this.compactHeader = true;
    else if (this.compactHeader && y < 12) this.compactHeader = false;
  };

  protected scrollHome() {
    this.scrollTo({ top: 0 });
  }

  // ------------------------------------------------------------------------------------------------ the panel

  /** The panel opens by the address: Back closes it. */
  protected openPanel(key: string) {
    const p = this.params();
    p.set(this.panelParam, key);
    this.pushedPanel = true;
    pushRoute(this.path, p);
  }

  protected closePanel() {
    if (this.pushedPanel) {
      this.pushedPanel = false;
      window.history.back();
    } else this.dropParam(this.panelParam);
    this.scheduleRefresh(250);
  }

  // ------------------------------------------------------------------------------------------------ the layout editor

  /** Before the draft is taken (the screens page picks its scope here). */
  protected beforeEdit(): void {}

  protected enterEdit(fromRoute = false) {
    if (!this.canEdit || this.editing) return;
    this.beforeEdit();
    this.beginDraft();
    this.editing = true;
    this.editHandled = true; // the address below is ours: nothing more to act on
    this.filters = this.noFilter;
    if (!fromRoute) {
      const p = this.params();
      this.filtersToParams(this.noFilter, p);
      p.set('edit', '1');
      replaceRoute(this.path, p);
    }
    this.scrollHome();
  }

  protected beginDraft() {
    const d = this.startDraft();
    this.draft = d;
    this.base = d;
    this.saveError = '';
    this.conflict = false;
  }

  protected leaveEdit(dropParam = true) {
    this.editing = false;
    this.draft = this.base = null;
    this.confirm = null;
    this.busy = false;
    this.editHandled = dropParam ? false : this.editHandled;
    if (dropParam) this.dropParam('edit');
  }

  protected get dirty(): boolean {
    return !!this.draft && !!this.base && isDirty(this.base, this.draft);
  }

  protected askCancel() {
    if (this.dirty) this.confirm = 'cancel';
    else this.leaveEdit();
  }

  protected async reloadAfterConflict() {
    this.res = await loadLayout();
    await this.load();
    this.beginDraft();
  }

  protected patchDraft(next: MediaLayout) {
    this.draft = next;
  }

  // ------------------------------------------------------------------------------------------------ render pieces

  /** 0.1.153: the room filter as one dropdown - always in dropdown mode, in hybrid only for a list longer than three. */
  protected roomsAsDropdown(items: number): boolean {
    const m = this.tabsMode.value;
    return m === 'dropdown' || (m === 'hybrid' && items > HYBRID_MAX_ITEMS);
  }

  /** The room chips scroll by a mouse drag too (a touch scrolls natively). */
  protected roomsDrag = (e: PointerEvent) => {
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

  protected stateBox(icon: MediaIconName, title: string, action?: TemplateResult): TemplateResult {
    return html`<div class="statebox glass" role="status"><span class="ring">${mIcon(icon)}</span><b>${title}</b>${action ?? nothing}</div>`;
  }
}
