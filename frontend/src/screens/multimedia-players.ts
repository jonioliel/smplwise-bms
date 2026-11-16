import { html, css, nothing, type TemplateResult } from 'lit';
import { liftRef } from '../components/top-layer';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/media-player-card';
import '../components/media-group-dialog';
import '../components/media-player-panel';
import '../components/media-now-hero';
import './multimedia-edit-panel';
import '../components/sw-pager';
import '../components/sw-page';
import { PageFit } from '../components/page-fit';
import { MediaCardsScreenBase } from './multimedia-base';
import { SkinController } from '../design/skin';
import type { MediaGroupDialog } from '../components/media-group-dialog';
import { ApiError, describeError } from '../api/client';
import { isApi } from '../api/session';
import { media, type MediaLayout } from '../api/media-screens';
import { GROUPABLE_KINDS, isPlaying, UNPLACED_LABEL, players, resolveLeader, roomChips, type PlayerDevice, type PlayerStatus } from '../api/media-players';
import { parseRoute } from '../router';
import { phoneRestricted } from '../shell/phone';
import { bidi } from '../i18n/bidi';
import { mediaGlassStyles } from '../styles/media-glass';
import { mediaPageStyles, measureHeaderBar } from '../styles/media-page';
import { clearPairChip, publishPairChip } from '../shell/tab-pair';
import { ddPanelOf, ddRingOf, ddSizeOf, ddStyleOf } from '../shell/tabs-mode';
import '../components/sw-dropdown';
import type { DropdownItem } from '../components/sw-dropdown';
import { mIcon, nameText } from '../components/media-icons';
import { NO_FLOOR, floorsOf, moveInGroup, setCard, togglePin, type FloorRef } from './multimedia-layout';
import {
  PLAYER_NO_FILTER, PLAYER_STATE_FILTERS, UNPLACED_ID, asLayoutDevices, editPlayerGroups, filterPlayers, installationHasFloors, isFloorSection,
  playerCounts, playerFiltersActive, playerFiltersFromParams, playerFiltersToParams, playerFloors, resolvePlayerGroups, tabView, withTabView,
  type PlayerFilters, type PlayerGroup, type TabbedLayout,
} from './multimedia-players-layout';

const PATH = '/multimedia/players';
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
export class MultimediaPlayers extends MediaCardsScreenBase<PlayerStatus, PlayerDevice, PlayerFilters> {
  /** `?player=<device key>` of the address: the player whose panel is open ('' = none). */
  @property() playerKey = '';
  @state() protected filters: PlayerFilters = PLAYER_NO_FILTER;
  @query('media-group-dialog') private dialog?: MediaGroupDialog;

  protected readonly path = PATH;
  protected readonly tab = 'players';
  protected readonly editEntry = { id: 'multimedia-players-layout', label: 'עריכת מסך הנגנים' };
  protected readonly noFilter = PLAYER_NO_FILTER;
  protected readonly panelParam = 'player';
  /** Bubble phase C: the skin in force (the now-playing hero above the groups, the cards as pill rows). */
  private skin = new SkinController(this);
  /** NOSCROLL-1366-2437: the cards region pages instead of scrolling on a desktop (components/page-fit.ts) */
  protected fit = new PageFit(this, () => this.renderRoot.querySelector<HTMLElement>('.scr'), () => !this.editing);

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
    /* the bubble skin: the pill rows in --sw-grid-min columns (row density = one column), the hero on top */
    :host([data-skin='bubble']) .pgrid {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, max(var(--sw-grid-min), 280px)), 1fr));
      gap: var(--sw-gap-grid);
    }
    :host([data-skin='bubble']) media-now-hero {
      margin-block-end: 4px;
    }
    :host([data-skin='bubble']) .dh.compact {
      background: var(--sw-nav-glass);
      -webkit-backdrop-filter: var(--sw-glass-blur-nav);
      backdrop-filter: var(--sw-glass-blur-nav);
      box-shadow: none;
      border: 0;
    }
    .pacts {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
    }
    /* the loading skeleton: one placeholder card per slot, in the card's own geometry */
    .skc {
      display: grid;
      grid-template-columns: var(--mm-cover-size) minmax(0, 1fr) auto;
      gap: var(--sw-s-3) var(--sw-s-4);
      align-items: center;
      padding: var(--sw-s-3) var(--sw-s-4) var(--sw-s-3) var(--sw-s-3);
    }
    .skc .cv {
      inline-size: var(--mm-cover-size);
      block-size: var(--mm-cover-size);
      border-radius: var(--mm-cover-radius);
    }
    .skc .tx {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
    }
    .skc .l1 {
      block-size: 16px;
      inline-size: 55%;
    }
    .skc .l2 {
      block-size: 12px;
      inline-size: 40%;
    }
    .skc .kn {
      inline-size: 50px;
      block-size: 50px;
      border-radius: 50%;
    }
    .skc .bar {
      grid-column: 1 / -1;
      block-size: 40px;
      border-radius: var(--sw-r-pill);
    }
    .dlg-acts {
      display: flex;
      justify-content: flex-end;
      gap: var(--sw-s-2);
      padding-block-start: var(--sw-s-2);
    }
    /* MEDIA-POLISH-2331 (owner rule: a control screen never scrolls on a desktop). Below 1024 px wide - or on a window too short to
       hold the header and a row of cards - the region is transparent (display: contents) and the page scrolls exactly as before, with
       the compacting header. From 1024 x 560 the page takes the screen's height: the header (title, rooms, floors, state filter,
       search) and the edit bar stay in place and only the cards region scrolls, inside its own box. */
    .scr {
      display: contents;
    }
    @media (min-width: 1024px) and (min-height: 560px) {
      :host {
        overflow: hidden;
      }
      /* the shared frame (sw-page) takes the screen's height; its body is a flex column, the region its growing child */
      .page {
        block-size: 100%;
        min-block-size: 0;
        padding-block-end: 0;
      }
      .scr {
        display: block;
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-gutter: stable;
        /* the region spans the page's side padding, so its scrollbar sits at the screen's edge and a focus ring is never clipped */
        margin-inline: calc(-1 * var(--mm-pad));
        padding: var(--sw-s-1) var(--mm-pad) var(--sw-s-8);
      }
      /* NOSCROLL-1366-2437 (audit round 30 #5: this region scrolled 1,537 px at 1366x768, all the cards in one panel): outside the
         editor the region never scrolls; the cards that fit are page 1, the rest are on the next pages (the pager in the filter row) */
      :host([data-fit]) .scr:not(.editing) {
        overflow: hidden;
        scrollbar-gutter: auto;
        padding-block-end: var(--sw-s-5);
      }
      /* the cards of the other pages (and a section with none on this page) stay in the document, out of the layout */
      :host([data-fit]) [data-off] {
        display: none !important;
      }
      /* scrolled: the cards slide out under a soft fade instead of a hard cut against the filters */
      .scr.scrolled {
        -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 var(--sw-s-5));
        mask-image: linear-gradient(180deg, transparent 0, #000 var(--sw-s-5));
      }
    }
    @media (min-width: 1100px) and (min-height: 560px) {
      /* the editor: two panes that scroll on their own; the settings pane and the edit bar never leave the screen */
      .scr.editing {
        overflow: hidden;
        padding-block-end: var(--sw-s-4);
      }
      .scr.editing .edit-layout {
        block-size: 100%;
        align-items: stretch;
      }
      .scr.editing .edit-side {
        position: static;
        max-block-size: none;
        min-block-size: 0;
      }
      .scr.editing .edit-cards {
        min-block-size: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        padding: var(--sw-s-1);
      }
    }
  `];

  /** The hero's player (bubble skin): the first that plays and is not a member, else the first paused, else none. */
  private nowPlaying(): PlayerDevice | null {
    const lead = this.devices.filter((d) => d.live.group.role !== 'member');
    return lead.find((d) => isPlaying(d)) ?? lead.find((d) => d.live.power === 'on' && d.live.play === 'paused') ?? null;
  }

  /** What the address says when the screen connects (the route listener only speaks for this tab's own routes). */
  protected atConnect() {
    this.filters = playerFiltersFromParams(parseRoute().params);
    this.wantsEdit = parseRoute().params.get('edit') === '1';
  }

  /** 0.1.153: the room filter in its dropdown form is drawn by the shell, beside the area's tab chip (shell/tab-pair.ts). */
  private syncPair() {
    const f = this.filters;
    const scoped = this.devices.filter((d) => filterPlayers([d], { ...PLAYER_NO_FILTER, floor: f.floor }).length);
    const rooms = roomChips(scoped);
    const tools = !this.editing && this.phase === 'ready' && this.devices.length > 0;
    if (tools && this.roomsAsDropdown(rooms.length + 1)) {
      publishPairChip(this, { group: 'multimedia', label: 'חדרים', value: f.area, items: [{ id: '', label: 'הכל', count: scoped.length, icon: 'home' as const }, { id: '--sep', label: '', divider: true }, ...rooms.map((r) => ({ id: r.id, label: r.name, count: r.count, icon: 'door' as const }))], onPick: (id) => this.setFilters({ area: id }) });
    } else clearPairChip(this);
  }

  protected updated() {
    this.syncPair();
    measureHeaderBar(this.renderRoot, this.phone);
    super.updated();
  }

  // ------------------------------------------------------------------------------------------------ data

  protected get canEdit(): boolean {
    return this.phase === 'ready' && this.res.can_edit && !phoneRestricted('layout_editor');
  }

  protected readStatus() {
    return players().status();
  }

  protected async listDevices() {
    return (await players().list({ kind: GROUPABLE_KINDS })).devices;
  }

  protected filtersFromParams(p: URLSearchParams) {
    return playerFiltersFromParams(p);
  }

  protected filtersToParams(f: PlayerFilters, p: URLSearchParams) {
    return playerFiltersToParams(f, p);
  }

  protected roomsInFloor() {
    return roomChips(this.devices.filter((d) => !this.filters.floor || filterPlayers([d], { ...PLAYER_NO_FILTER, floor: this.filters.floor }).length));
  }

  /** The editor starts from the tab's layout as the page draws it. */
  protected startDraft() {
    return this.view();
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

  /** MEDIA-POLISH-2331: the cards region's own scroll (a desktop that fits the screen). The header never leaves the screen there, so it
   * stays whole (its filters keep working); the region only fades its top edge once the cards slide under it. */
  private onRegionScroll = (e: Event) => {
    const el = e.currentTarget as HTMLElement;
    el.classList.toggle('scrolled', el.scrollTop > 2);
  };

  protected scrollHome() {
    super.scrollHome();
    this.renderRoot.querySelector<HTMLElement>('.scr')?.scrollTo({ top: 0 });
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

  private card(d: PlayerDevice, index: number, count: number, paged = false): TemplateResult {
    const edit = this.editing && !!this.draft;
    const off = edit && !(this.draft!.cards[d.key]?.on ?? true);
    const lead = d.live.group.role === 'member' ? resolveLeader(d, this.devices) : null;
    return html`<media-player-card data-fit-item ?data-off=${paged} data-player-card=${d.key} .device=${d} .leader=${lead && lead.key !== d.key ? lead : null} ?compact=${this.phone} ?editing=${edit} ?data-dimmed=${off}
      @open-player=${(e: CustomEvent<{ key: string }>) => this.openPanel(e.detail.key)} @media-changed=${() => this.scheduleRefresh(isApi() ? 700 : 30)}>${edit ? this.chips(d, index, count) : nothing}</media-player-card>`;
  }

  private section(g: PlayerGroup, offset = 0): TemplateResult {
    const counts = playerCounts(g.devices);
    // NOSCROLL-1366-2437: the cards of the other pages are drawn out of the layout ([data-off]); so is a section with none on this page
    const off = (i: number) => !this.fit.shows(offset + i);
    const none = g.devices.every((_, i) => off(i));
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
    return html`<section class="fsec" ?data-off=${none} aria-label=${g.label} data-group=${g.id}>
      <header class="sh"><div>${title}<small>${sub}</small></div><span class="grow"></span>${pauseBtn}</header>
      <div class="pgrid">${repeat(g.devices, (d) => d.key, (d, i) => this.card(d, i, g.devices.length, off(i)))}</div>
    </section>`;
  }

  /** AUDIT30-D3: the one-line summary under the title (sw-page's subheading); the phone keeps its header short and has none */
  private summary(): string {
    if (this.phone || this.editing || this.phase !== 'ready' || !this.devices.length) return '';
    const c = playerCounts(this.devices);
    return `${c.playing ? `${c.playing} מנגנים מתוך ${c.total}` : `אין ניגון כרגע · ${c.total} התקנים`}${c.unavailable ? ` · ${c.unavailable} לא זמין` : ''}`;
  }

  /** AUDIT30-D3: the floor menu sits at the end of sw-page's title row (slot "actions"). */
  private floorAction(): TemplateResult | typeof nothing {
    const { floors, unplaced } = playerFloors(this.devices, this.floorOrder());
    const showFloor = this.hasFloors && (floors.length > 1 || unplaced > 0 || !!this.filters.floor);
    const tools = !this.editing && this.phase === 'ready' && this.devices.length > 0;
    return tools && showFloor ? this.floorChip(floors, unplaced) : nothing;
  }

  /** The filter bar under the title: rooms, the pager, the state filter, the search (sticky and compacting while the page scrolls). */
  private header(): TemplateResult | typeof nothing {
    const f = this.filters;
    const scoped = this.devices.filter((d) => filterPlayers([d], { ...PLAYER_NO_FILTER, floor: f.floor }).length);
    const rooms = roomChips(scoped);
    const c = playerCounts(this.devices);
    const tools = !this.editing && this.phase === 'ready' && this.devices.length > 0;
    const lib = this.status?.library.state;
    if (!tools) return nothing;
    return html`<div class=${classMap({ dh: true, compact: this.compactHeader })} data-mm-header>
      <div class="dh-row">
        ${this.roomsAsDropdown(rooms.length + 1) ? html`<span class="grow" data-rooms-in-shell></span>` : html`<div class="rooms" role="group" aria-label="חדרים" @pointerdown=${this.roomsDrag}>
          <button type="button" class="rc" aria-pressed=${String(!f.area)} data-room="" @click=${() => this.setFilters({ area: '' })}>הכל</button>
          ${rooms.map((r) => html`<button type="button" class="rc" aria-pressed=${String(f.area === r.id)} data-room=${r.id} @click=${() => this.setFilters({ area: r.id })}>${nameText(r.name)}</button>`)}
        </div>`}
      </div>
      <div class="dh-det">
        ${lib && lib !== 'ready' ? html`<span class="chipx libchip" data-lib-state=${lib}>${mIcon('music')}ספרייה לא זמינה</span>` : nothing}
        ${this.fit.pages > 1 ? html`<sw-pager data-mm-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${(e: CustomEvent<{ page: number }>) => this.fit.go(e.detail.page)}></sw-pager>` : nothing}
        <div class="seg sm" role="radiogroup" aria-label="סינון לפי מצב">${PLAYER_STATE_FILTERS.map((s) => html`<button type="button" role="radio" aria-checked=${String(f.state === s.id)} data-state-filter=${s.id || 'all'} @click=${() => this.setFilters({ state: s.id })}>${s.label}${s.id === 'playing' ? html` <small>${c.playing}</small>` : s.id === 'unavailable' && c.unavailable ? html` <small>${c.unavailable}</small>` : nothing}</button>`)}</div>
        <label class="search">${mIcon('search')}<span class="vh">חיפוש נגן</span><input type="search" data-search placeholder="חיפוש נגן או חדר" .value=${f.q} @input=${(e: Event) => this.onSearch((e.target as HTMLInputElement).value)} /></label>
      </div>
    </div>`;
  }

  /** The floor filter as the capsule-capable dropdown (0.1.164): the same component, style, size, ring and panel width as every other dropdown of the multimedia group. */
  private floorChip(floors: FloorRef[], unplaced: number): TemplateResult {
    const items: DropdownItem[] = [{ id: '', label: 'כל הקומות', count: this.devices.length, icon: 'home' }, { id: '--sep', label: '', divider: true }, ...floors.map((x) => ({ id: x.id, label: x.name, count: x.count, icon: 'layers' as const }))];
    if (unplaced) items.push({ id: '--sep2', label: '', divider: true }, { id: UNPLACED_ID, label: UNPLACED_LABEL, count: unplaced, icon: 'layers' });
    return html`<div class="flwrap"><sw-dropdown data-floor-menu label="קומות" icon="layers" dd-style=${ddStyleOf('multimedia')} dd-size=${ddSizeOf('multimedia')} dd-ring=${ddRingOf('multimedia')} dd-panel=${ddPanelOf('multimedia')} .items=${items} .value=${this.filters.floor} @change=${(e: CustomEvent<{ id: string }>) => this.setFilters({ floor: e.detail.id, area: '' })}></sw-dropdown></div>`;
  }

  private skeleton(): TemplateResult {
    const card = html`<div class="glass skc" aria-hidden="true"><span class="skl cv"></span><div class="tx"><span class="skl l1"></span><span class="skl l2"></span></div><span class="skl kn"></span><span class="skl bar"></span></div>`;
    return html`<div data-mm-state="loading" aria-busy="true"><div class="pgrid">${Array.from({ length: this.phone ? 3 : 6 }, () => card)}</div></div>`;
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
      <div class="dlg-acts">
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
    let offset = 0;
    const offsets = groups.map((g) => ((offset += g.devices.length), offset - g.devices.length));
    this.fit.sync(offset, `${groups.map((g) => `${g.id}:${g.devices.map((d) => d.key).join(',')}`).join('|')}|${this.phone}`);
    const hero = this.skin.bubble && !this.editing ? this.nowPlaying() : null;
    return html`${stale}${hero ? html`<media-now-hero .device=${hero} @media-changed=${() => this.scheduleRefresh(300)}></media-now-hero>` : nothing}<div class="groups" data-mm-state="ready">${groups.map((g, gi) => this.section(g, offsets[gi]))}</div>`;
  }

  render() {
    const editing = this.editing && !!this.draft;
    const body = this.body(); // first: it tells the pager in the header how many cards there are
    const floor = this.floorAction();
    return html`<sw-page class="page" wide heading="נגנים ורמקולים" subheading=${this.summary()} data-screen="multimedia-players">
      ${floor === nothing ? nothing : html`<div slot="actions" class="pacts">${floor}</div>`}
      ${this.header()}
      ${editing ? html`<div class="editing-stack">${this.editBar()}</div>` : nothing}
      <div class=${classMap({ scr: true, editing })} data-mm-region @scroll=${this.onRegionScroll}>
        ${editing
          ? html`<div class="edit-layout"><multimedia-edit-panel class="edit-side" simple heading="נגנים ורמקולים" .draft=${this.draft!} .devices=${asLayoutDevices(this.devices)} scope="all" .floors=${floorsOf(asLayoutDevices(this.devices), this.draft!).map((f) => (f.id === NO_FLOOR ? { ...f, name: UNPLACED_LABEL } : f))} @layout-draft=${(e: CustomEvent<MediaLayout>) => this.patchDraft(e.detail)}></multimedia-edit-panel><div class="edit-cards">${body}</div></div>`
          : body}
      </div>
    </sw-page>
    <media-group-dialog @group-done=${() => void this.load()}></media-group-dialog>
    ${this.confirmDialog()}
    ${this.playerKey ? html`<media-player-panel .deviceKey=${this.playerKey} .open=${true} @close=${() => this.closePanel()}></media-player-panel>` : nothing}
    ${this.toast ? html`<div class="toast" role="status" ${liftRef() /* DIALOG-TOPLAYER-2381: above an open sw-dialog */}>${mIcon('check')}${this.toast}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'multimedia-players': MultimediaPlayers;
  }
}
