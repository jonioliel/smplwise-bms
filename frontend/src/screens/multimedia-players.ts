import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/media-player-card';
import '../components/media-group-dialog';
import './multimedia-edit-panel';
import type { MediaGroupDialog } from '../components/media-group-dialog';
import { ApiError, describeError } from '../api/client';
import { subscribeHa } from '../api/ha';
import { getDevicesTree } from '../api/devices';
import { isApi } from '../api/session';
import { EMPTY_LAYOUT, media, type LayoutResponse, type MediaLayout } from '../api/media-screens';
import { GROUPABLE_KINDS, UNPLACED_LABEL, players, resolveLeader, roomChips, type PlayerDevice, type PlayerLive, type PlayerStatus } from '../api/media-players';
import { loadLayout } from '../api/media-personal';
import { onRouteChange, parseRoute, pushRoute, replaceRoute } from '../router';
import { registerScreenEdit } from '../shell/screen-edit';
import { applyMultimediaKinds } from '../shell/nav';
import { phoneRestricted } from '../shell/phone';
import { bidi } from '../i18n/bidi';
import { applyMediaGlass, mediaGlassStyles } from '../styles/media-glass';
import { mediaPageStyles } from '../styles/media-page';
import { mIcon, nameText } from '../components/media-icons';
import { DEMO_FLOOR_ORDER, NO_FLOOR, floorsOf, isDirty, moveInGroup, setCard, togglePin, type FloorRef } from './multimedia-layout';
import {
  PLAYER_NO_FILTER, PLAYER_STATE_FILTERS, UNPLACED_ID, asLayoutDevices, editPlayerGroups, filterPlayers, installationHasFloors, isFloorSection,
  playerCounts, playerFiltersActive, playerFiltersFromParams, playerFiltersToParams, playerFloors, resolvePlayerGroups, tabView, withTabView,
  type PlayerFilters, type PlayerGroup, type TabbedLayout,
} from './multimedia-players-layout';

type Phase = 'loading' | 'ready' | 'error' | 'forbidden' | 'disabled';

const PATH = '/multimedia/players';
const FALLBACK_LAYOUT: LayoutResponse = { installation: EMPTY_LAYOUT, personal: null, revision: 0, can_edit: false, can_personalize: false };
const asLive = (l: unknown) => l as PlayerLive;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * CR-016 "מולטימדיה › נגנים ורמקולים" (mockup `players-index.html`, always the glass style): one card per physical speaker, player
 * and receiver, grouped by floor with the devices that have no room in a last section "לא משויכים" (an installation without
 * floors shows ONE list "כל החדרים" - the room chips are the filter - plus that section), a large title, scrolling room chips, the
 * floor menu with the floor's "עצור מוזיקה" (confirmed, per-room outcome), a state filter and a search. Non-physical entries
 * (sessions, helper groups, services) never reach this list; they live in the settings. The card is `<media-player-card>`; the
 * player panel opens by the address (`?player=<key>`: Back closes it) as `<media-player-panel>` when that element exists (S3).
 * The editor is the CR-015 one for this tab (order, "מועדפים", show / hide, grouping; the user menu's "עריכת מסך הנגנים",
 * `?edit=1`), saved for everyone (media.layout) in the layout document's `tabs.players`. Loading, empty, error (the last state is
 * kept and marked stale), forbidden and "off" states are all drawn here; nothing is shown that the server would refuse.
 */
@customElement('multimedia-players')
export class MultimediaPlayers extends LitElement {
  /** `?player=<device key>` of the address: the player whose panel is open ('' = none). */
  @property() playerKey = '';
  @state() private phase: Phase = 'loading';
  @state() private devices: PlayerDevice[] = [];
  @state() private status: PlayerStatus | null = null;
  @state() private res: LayoutResponse = FALLBACK_LAYOUT;
  @state() private homeFloors: string[] = [];
  @state() private filters: PlayerFilters = PLAYER_NO_FILTER;
  @state() private floorMenu = false;
  @state() private compactHeader = false;
  @state() private staleError = '';
  @state() private toast = '';
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;
  // the layout editor
  @state() private editing = false;
  @state() private draft: MediaLayout | null = null;
  @state() private base: MediaLayout | null = null;
  @state() private busy = false;
  @state() private saveError = '';
  @state() private conflict = false;
  @state() private confirm: 'reset' | 'cancel' | null = null;
  @query('media-group-dialog') private dialog?: MediaGroupDialog;

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
  private pushedPlayer = false;
  private loading = false;
  private homeFloorsLoaded = false;

  static styles = [mediaGlassStyles, mediaPageStyles, css`
    .shlink[disabled] {
      cursor: default;
    }
    .libchip {
      color: var(--dv-warning-text);
      background: var(--dv-warning-soft);
      border-color: transparent;
    }
    .pgrid > media-player-card {
      min-inline-size: 0;
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    void applyMediaGlass(this);
    this.phoneMq.addEventListener('change', this.onPhone);
    this.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('pointerdown', this.onOutside, true);
    window.addEventListener('keydown', this.onKey);
    // the layout editor is entered from the user menu (shell/screen-edit.ts), never from a button in the page
    this.offEdit = registerScreenEdit({
      id: 'multimedia-players-layout',
      label: 'עריכת מסך הנגנים',
      icon: 'edit',
      can: () => this.canEdit && !this.editing,
      run: () => this.enterEdit(),
    });
    this.offRoute = onRouteChange((r) => {
      if (r.mode !== 'multimedia' || r.segments[1] !== 'players') return;
      const f = playerFiltersFromParams(r.params);
      this.filters = this.typing ? { ...f, q: this.filters.q } : f;
      this.wantsEdit = r.params.get('edit') === '1';
      if (!this.wantsEdit) {
        this.editHandled = false;
        if (this.editing) this.leaveEdit(false);
      }
      this.requestUpdate();
    });
    this.filters = playerFiltersFromParams(parseRoute().params);
    this.wantsEdit = parseRoute().params.get('edit') === '1';
    void this.load();
    if (isApi()) {
      this.offPush = subscribeHa(
        (m) => {
          if (m.type === 'media_state') {
            const was = this.devices.find((d) => d.key === m.device_key)?.live.power;
            this.devices = this.devices.map((d) => (d.key === m.device_key ? { ...d, live: asLive(m.live) } : d));
            if (was && was !== m.live.power) this.scheduleRefresh(800); // `caps` follow the live state: read them again after a power change
          } else if (m.type === 'media_devices_changed') this.scheduleRefresh(200);
        },
        (connected) => {
          if (connected) this.scheduleRefresh(200);
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
    for (const t of [this.refreshTimer, this.toastTimer, this.qTimer]) window.clearTimeout(t);
    window.clearInterval(this.pollTimer);
  }

  protected updated() {
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
    return this.phase === 'ready' && this.res.can_edit && !phoneRestricted('layout_editor');
  }

  private async load() {
    if (this.loading) return;
    this.loading = true;
    try {
      const st = await players().status();
      this.status = st;
      applyMultimediaKinds(st.counts);
      if (!st.enabled) {
        this.phase = 'disabled';
        return;
      }
      if (!st.can.read) {
        this.phase = 'forbidden';
        return;
      }
      const [list, lay] = await Promise.allSettled([players().list({ kind: GROUPABLE_KINDS }), loadLayout()]);
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

  private get doc(): TabbedLayout {
    return this.res.installation as TabbedLayout;
  }

  private floorOrder(): string[] {
    return this.doc.floor_order.length ? this.doc.floor_order : this.homeFloors;
  }

  private get hasFloors(): boolean {
    return installationHasFloors(this.status, this.devices);
  }

  /** The tab's layout as the page draws it (or, while editing, the draft). */
  private view(): MediaLayout {
    return tabView(this.doc, 'players', this.floorOrder());
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

  private setFilters(patch: Partial<PlayerFilters>, immediate = true) {
    this.filters = { ...this.filters, ...patch };
    // a chip of another floor does not survive a floor change
    if (patch.floor !== undefined && patch.area === undefined && this.filters.area) {
      const rooms = roomChips(this.devices.filter((d) => !this.filters.floor || filterPlayers([d], { ...PLAYER_NO_FILTER, floor: this.filters.floor }).length));
      if (!rooms.some((r) => r.id === this.filters.area)) this.filters = { ...this.filters, area: '' };
    }
    const write = () => replaceRoute(PATH, playerFiltersToParams(this.filters, this.params()));
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

  // ------------------------------------------------------------------------------------------------ the panel

  private openPlayer(key: string) {
    const p = this.params();
    p.set('player', key);
    this.pushedPlayer = true;
    pushRoute(PATH, p);
  }

  private closePlayer() {
    if (this.pushedPlayer) {
      this.pushedPlayer = false;
      window.history.back();
    } else this.dropParam('player');
    this.scheduleRefresh(250);
  }

  // ------------------------------------------------------------------------------------------------ the layout editor

  private enterEdit(fromRoute = false) {
    if (!this.canEdit || this.editing) return;
    this.beginDraft();
    this.editing = true;
    this.editHandled = true;
    this.filters = PLAYER_NO_FILTER;
    this.floorMenu = false;
    if (!fromRoute) {
      const p = this.params();
      playerFiltersToParams(PLAYER_NO_FILTER, p);
      p.set('edit', '1');
      replaceRoute(PATH, p);
    }
    this.scrollTo({ top: 0 });
  }

  private beginDraft() {
    const v = this.view();
    this.draft = v;
    this.base = v;
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

  private get dirty(): boolean {
    return !!this.draft && !!this.base && isDirty(this.base, this.draft);
  }

  private askCancel() {
    if (this.dirty) this.confirm = 'cancel';
    else this.leaveEdit();
  }

  /** The document with this tab replaced; the floors' order is the document's own (a floor order still equal to the home screen's stays empty). */
  private payload(view: MediaLayout | null): TabbedLayout {
    const orig = this.doc;
    if (!view) {
      const tabs = { ...orig.tabs };
      delete tabs.players;
      return { ...orig, tabs };
    }
    const next = withTabView(orig, 'players', view);
    return { ...next, floor_order: !orig.floor_order.length && same(view.floor_order, this.homeFloors) ? [] : view.floor_order };
  }

  private async save(reset = false) {
    if (!this.draft || this.busy) return;
    this.busy = true;
    this.saveError = '';
    try {
      this.res = await media().saveLayout(this.payload(reset ? null : this.draft), this.res.revision);
      this.leaveEdit();
      this.say(reset ? 'חזר לברירת המחדל' : 'נשמר');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'revision_conflict') this.conflict = true;
      else this.saveError = describeError(err);
      this.busy = false;
    }
  }

  private async reloadAfterConflict() {
    this.res = await loadLayout();
    await this.load();
    this.beginDraft();
    this.conflict = false;
  }

  private patchDraft(next: MediaLayout) {
    this.draft = next;
  }

  // ------------------------------------------------------------------------------------------------ render

  private sections(): PlayerGroup[] {
    const o = { floors: this.hasFloors, floorOrder: this.floorOrder() };
    if (this.editing && this.draft) return editPlayerGroups(this.devices, this.draft, o);
    return resolvePlayerGroups(filterPlayers(this.devices, this.filters), this.view(), o);
  }

  private chips(d: PlayerDevice, index: number, count: number): TemplateResult {
    const draft = this.draft!;
    const pinned = draft.pinned.includes(d.key);
    const on = (draft.cards[d.key]?.on ?? true) as boolean;
    return html`<span class="ecard" slot="edit">
      <button type="button" aria-label=${`הקדם · ${d.name}`} title="הקדם" ?disabled=${index === 0} @click=${() => this.patchDraft(moveInGroup(draft, asLayoutDevices(this.devices), d.key, -1))}>${mIcon('arrowUp')}</button>
      <button type="button" aria-label=${`אחר · ${d.name}`} title="אחר" ?disabled=${index === count - 1} @click=${() => this.patchDraft(moveInGroup(draft, asLayoutDevices(this.devices), d.key, 1))}>${mIcon('arrowDown')}</button>
      <button type="button" aria-pressed=${String(pinned)} aria-label=${`מועדף · ${d.name}`} title="מועדף" @click=${() => this.patchDraft(togglePin(draft, d.key))}>${mIcon('star')}</button>
      <button type="button" aria-label=${`${on ? 'הסתר' : 'הצג'} · ${d.name}`} title=${on ? 'הסתר' : 'הצג'} @click=${() => this.patchDraft(setCard(draft, d.key, { on: !on }))}>${mIcon(on ? 'eye' : 'eyeOff')}</button>
    </span>`;
  }

  private card(d: PlayerDevice, index: number, count: number): TemplateResult {
    const edit = this.editing && !!this.draft;
    const off = edit && !(this.draft!.cards[d.key]?.on ?? true);
    const lead = d.live.group.role === 'member' ? resolveLeader(d, this.devices) : null;
    return html`<media-player-card data-player-card=${d.key} .device=${d} .leader=${lead && lead.key !== d.key ? lead : null} ?compact=${this.phone} ?editing=${edit} ?data-dimmed=${off}
      @open-player=${(e: CustomEvent<{ key: string }>) => this.openPlayer(e.detail.key)} @media-changed=${() => this.scheduleRefresh(isApi() ? 700 : 30)}>${edit ? this.chips(d, index, count) : nothing}</media-player-card>`;
  }

  private section(g: PlayerGroup): TemplateResult {
    const counts = playerCounts(g.devices);
    const by = (this.editing && this.draft ? this.draft : this.view()).group_by;
    const floor = !this.editing && isFloorSection(g, by, this.hasFloors);
    const canPause = floor && !!this.status?.can.bulk && counts.playing > 0;
    const title = g.id === 'pinned' || g.id === 'all' || this.editing || (!floor && g.id !== UNPLACED_ID)
      ? html`<h2>${nameText(bidi(g.label))}</h2>`
      : html`<h2><button type="button" class="shlink" data-group-open=${g.id} @click=${() => this.setFilters(g.id === UNPLACED_ID ? { floor: UNPLACED_ID, area: '' } : { floor: g.id, area: '' })}>${bidi(g.label)}${mIcon('chevronBack')}</button></h2>`;
    const sub = g.id === UNPLACED_ID
      ? html`<span class="n">${counts.total}</span> ללא חדר`
      : html`<span class="n">${counts.total}</span> התקנים${counts.playing ? html` · <em><span class="n">${counts.playing}</span></em> מנגנים` : nothing}`;
    const pauseBtn = canPause
      ? html`<button type="button" class="btn sm quiet" data-floor-pause=${g.id} @click=${() => void this.dialog?.pause({ scope: 'floor', id: g.id, name: g.label })}>${mIcon('pause')}עצור מוזיקה</button>`
      : nothing;
    return html`<section class="fsec" aria-label=${g.label} data-group=${g.id}>
      <header class="sh"><div>${title}<small>${sub}</small></div><span class="grow"></span>${pauseBtn}</header>
      <div class="pgrid">${repeat(g.devices, (d) => d.key, (d, i) => this.card(d, i, g.devices.length))}</div>
    </section>`;
  }

  private header(): TemplateResult {
    const f = this.filters;
    const scoped = this.devices.filter((d) => filterPlayers([d], { ...PLAYER_NO_FILTER, floor: f.floor }).length);
    const rooms = roomChips(scoped);
    const c = playerCounts(this.devices);
    const { floors, unplaced } = playerFloors(this.devices, this.floorOrder());
    const floorName = f.floor === UNPLACED_ID ? UNPLACED_LABEL : f.floor ? floors.find((x) => x.id === f.floor)?.name ?? 'קומה' : 'כל הקומות';
    const showFloor = this.hasFloors && (floors.length > 1 || unplaced > 0 || !!f.floor);
    const tools = !this.editing && this.phase === 'ready' && this.devices.length > 0;
    const lib = this.status?.library.state;
    return html`<header class=${classMap({ dh: true, compact: this.compactHeader })} data-mm-header>
      <div class="dh-row">
        <h1>נגנים ורמקולים</h1>
        ${tools ? html`<div class="rooms" role="group" aria-label="חדרים" @pointerdown=${this.roomsDrag}>
          <button type="button" class="rc" aria-pressed=${String(!f.area)} data-room="" @click=${() => this.setFilters({ area: '' })}>הכל</button>
          ${rooms.map((r) => html`<button type="button" class="rc" aria-pressed=${String(f.area === r.id)} data-room=${r.id} @click=${() => this.setFilters({ area: r.id })}>${nameText(r.name)}</button>`)}
        </div>` : html`<span class="grow"></span>`}
        ${tools && showFloor ? html`<div class="flwrap"><button type="button" class="floorbtn" aria-haspopup="menu" aria-expanded=${String(this.floorMenu)} data-floor-menu @click=${() => (this.floorMenu = !this.floorMenu)}>${mIcon('layers')}<span>${bidi(floorName)}</span>${mIcon('chevronDown')}</button>
          ${this.floorMenu ? this.floorPop(floors, unplaced) : nothing}</div>` : nothing}
      </div>
      ${tools ? html`<div class="dh-det">
        <span class="amb">${c.playing ? html`<em><span class="n">${c.playing}</span></em> מנגנים מתוך <span class="n">${c.total}</span>` : html`אין ניגון כרגע · <span class="n">${c.total}</span> התקנים`}${c.unavailable ? html` · <span class="n">${c.unavailable}</span> לא זמין` : nothing}</span>
        ${lib && lib !== 'ready' ? html`<span class="chipx libchip" data-lib-state=${lib}>${mIcon('music')}ספרייה לא זמינה</span>` : nothing}
        <span class="grow"></span>
        <div class="seg sm" role="radiogroup" aria-label="סינון לפי מצב">${PLAYER_STATE_FILTERS.map((s) => html`<button type="button" role="radio" aria-checked=${String(f.state === s.id)} data-state-filter=${s.id || 'all'} @click=${() => this.setFilters({ state: s.id })}>${s.label}${s.id === 'playing' ? html` <small>${c.playing}</small>` : s.id === 'unavailable' && c.unavailable ? html` <small>${c.unavailable}</small>` : nothing}</button>`)}</div>
        <label class="search">${mIcon('search')}<span class="vh">חיפוש נגן</span><input type="search" data-search placeholder="חיפוש נגן או חדר" .value=${f.q} @input=${(e: Event) => this.onSearch((e.target as HTMLInputElement).value)} /></label>
      </div>` : nothing}
    </header>`;
  }

  private floorPop(floors: FloorRef[], unplaced: number): TemplateResult {
    const row = (id: string, name: string, n: number, icon: 'home' | 'layers') => html`<button type="button" role="menuitemradio" aria-checked=${String(this.filters.floor === id)} data-floor-pick=${id} @click=${() => { this.floorMenu = false; this.setFilters({ floor: id, area: '' }); }}>${mIcon(icon)}${bidi(name)}<span class="cnt"><span class="n">${n}</span></span></button>`;
    return html`<div class="pop" role="menu" aria-label="קומות">${row('', 'כל הקומות', this.devices.length, 'home')}<hr />${floors.map((x) => row(x.id, x.name, x.count, 'layers'))}${unplaced ? html`<hr />${row(UNPLACED_ID, UNPLACED_LABEL, unplaced, 'layers')}` : nothing}</div>`;
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
    const card = html`<div class="glass" style="display:grid;grid-template-columns:var(--mm-cover-size) minmax(0,1fr) auto;gap:12px 14px;align-items:center;padding:10px 14px 12px 10px"><span class="skl" style="inline-size:var(--mm-cover-size);block-size:var(--mm-cover-size);border-radius:var(--mm-cover-radius)"></span><div style="display:flex;flex-direction:column;gap:8px"><span class="skl" style="block-size:16px;inline-size:55%"></span><span class="skl" style="block-size:12px;inline-size:40%"></span></div><span class="skl" style="inline-size:50px;block-size:50px;border-radius:50%"></span><span class="skl" style="grid-column:1 / -1;block-size:40px;border-radius:999px"></span></div>`;
    return html`<div data-mm-state="loading" aria-busy="true"><div class="pgrid">${Array.from({ length: this.phone ? 3 : 6 }, () => card)}</div></div>`;
  }

  private stateBox(icon: 'speaker' | 'warning' | 'search' | 'power', title: string, action?: TemplateResult): TemplateResult {
    return html`<div class="statebox glass" role="status"><span class="ring">${mIcon(icon)}</span><b>${title}</b>${action ?? nothing}</div>`;
  }

  private editBar(): TemplateResult {
    return html`<div class="editbar" data-mm-editbar>
      <span class="t">${mIcon('edit')}עריכת מסך הנגנים</span>
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
    return html`<sw-dialog open heading=${reset ? 'להחזיר את מסך הנגנים לברירת המחדל לכולם?' : 'לבטל את השינויים?'} data-mm-confirm=${c} @close=${() => (this.confirm = null)}>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-block-start:6px">
        <sw-button data-mm-confirm-no autofocus @click=${() => (this.confirm = null)}>${reset ? 'ביטול' : 'המשך עריכה'}</sw-button>
        <sw-button variant="danger" data-mm-confirm-yes @click=${() => { if (reset) { this.confirm = null; void this.save(true); } else this.leaveEdit(); }}>${reset ? 'החזר' : 'בטל שינויים'}</sw-button>
      </div></sw-dialog>`;
  }

  private body(): TemplateResult | typeof nothing {
    if (this.phase === 'loading') return this.skeleton();
    if (this.phase === 'error') {
      return html`<div data-mm-state="error">${this.stateBox('warning', 'לא ניתן לטעון את הנגנים', html`<button type="button" class="btn sm" data-mm-retry @click=${() => { this.phase = 'loading'; void this.load(); }}>${mIcon('refresh')}נסה שוב</button>`)}</div>`;
    }
    if (this.phase === 'forbidden') return html`<div data-mm-state="forbidden">${this.stateBox('speaker', 'אין הרשאת צפייה בנגנים')}</div>`;
    if (this.phase === 'disabled') return html`<div data-mm-state="disabled">${this.stateBox('power', 'המולטימדיה כבויה')}</div>`;
    if (!this.devices.length) {
      const cfg = this.status?.can.configure;
      return html`<div data-mm-state="empty">${this.stateBox('speaker', 'אין נגנים', cfg ? html`<a class="btn sm" href="#/system/multimedia">להגדרות</a>` : undefined)}</div>`;
    }
    const groups = this.sections();
    const stale = this.staleError ? html`<div class="errbar" role="alert" data-mm-stale>${mIcon('warning')}הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.<button type="button" class="btn sm" @click=${() => void this.load()}>נסה שוב</button></div>` : nothing;
    if (!groups.length) {
      return html`${stale}<div data-mm-state="filtered">${this.stateBox('search', 'לא נמצאו נגנים', playerFiltersActive(this.filters) ? html`<button type="button" class="btn sm" data-clear-filters @click=${() => this.setFilters(PLAYER_NO_FILTER)}>נקה סינון</button>` : undefined)}</div>`;
    }
    return html`${stale}<div class="groups" data-mm-state="ready">${groups.map((g) => this.section(g))}</div>`;
  }

  render() {
    return html`<div class="page" data-screen="multimedia-players">
      ${this.header()}
      ${this.editing && this.draft
        ? html`<div class="editing-stack">${this.editBar()}</div>
          <div class="edit-layout"><multimedia-edit-panel class="edit-side" simple heading="נגנים ורמקולים" .draft=${this.draft} .devices=${asLayoutDevices(this.devices)} scope="all" .floors=${floorsOf(asLayoutDevices(this.devices), this.draft)} @layout-draft=${(e: CustomEvent<MediaLayout>) => this.patchDraft(e.detail)}></multimedia-edit-panel><div class="edit-cards">${this.body()}</div></div>`
        : this.body()}
    </div>
    <media-group-dialog @group-done=${() => void this.load()}></media-group-dialog>
    ${this.confirmDialog()}
    ${this.playerKey && customElements.get('media-player-panel') ? html`<media-player-panel .deviceKey=${this.playerKey} .open=${true} @close=${() => this.closePlayer()}></media-player-panel>` : nothing}
    ${this.toast ? html`<div class="toast" role="status">${mIcon('check')}${this.toast}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'multimedia-players': MultimediaPlayers;
  }
}
