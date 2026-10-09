import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { keyed } from 'lit/directives/keyed.js';
import './automation-editors';
import '../components/sw-dialog';
import '../components/sw-automation-card';
import './automation-drawer';
import './scenes-panel';
import './scripts-panel';
import { aIcon } from '../components/automation-icons';
import { automationsStyles } from '../styles/automations-glass';
import { mediaPageStyles, measureHeaderBar } from '../styles/media-page';
import { applyAutomationsGlass, autoApi, autoNow, autoReady, demoControl, demoLoading } from '../api/automations-demo';
import { isApi } from '../api/session';
import { subscribeHa } from '../api/ha';
import { getScheduleStatus } from '../api/schedules';
import type { KavarnitSegments } from '../shell/nav';
import { bidi } from '../i18n/bidi';
import { onRouteChange, navigate, pushRoute, replaceRoute, type RouteState } from '../router';
import { registerScreenEdit } from '../shell/screen-edit';
import {
  mapAutomationError, needsConfirmation, toggleAutomation, visibleKinds,
  type AnyDraft, type AutomationsStatus, type Item, type ItemDetail, type ItemKind, type ScriptDraft,
} from '../api/automations';
import {
  BASE, NO_FILTERS, STATE_FILTERS, applyFilters, banners, countsOf, confirmLine, editPath, editTarget, filtersActive, filtersFromParams, filtersToParams, floorOptions, hiddenScenes, itemPath,
  newButton, newPath, parseAutomationsRoute, screenKind, segmentOf, segmentOfKind, stateCounts, trashPath, SEGMENTS,
  type AutomationsRoute, type ListFilters, type Segment, type StateFilter,
} from './automations-logic';
import type { DrawerResult } from './automation-drawer';
import type { AutomationDrawer } from './automation-drawer';
import type { CardAction } from '../components/sw-automation-card';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

/** 0.1.154: the schedules screen, the first segment of "קברניט" (its address is unchanged). */
const SCHEDULES_PATH = '/devices/schedules';

interface Note { text: string; tone: 'ok' | 'error'; action?: { label: string; run: () => void } }

/**
 * CR-017 "אוטומציות": the third tab of the home area (`#/devices/automations`, mockup `docs/design/mockups/automations/index.html`, always the glass
 * style of the multimedia area, light or dark by `devices.scheme`). One screen, three kinds in a segmented control (אוטומציות · סצנות · סקריפטים):
 * a large title, the floors as chips, the state filter (פעילות · כבויות · רגישות · דורשות תשומת לב) and the search, and "+ חדש". The phone folds the state
 * filter behind "סינון" or keeps its row, by the owner's setting `automations.phone_filter`; the sensitive chip is amber or red by
 * `automations.sensitive_chip`. Automations are `<automation-card>`s (the whole card opens the detail drawer, `<automation-drawer>`); scenes are
 * `<scenes-panel>`; scripts are `<scripts-panel>`. The builder is S4's `<automation-builder>` (the routes `.../<id>/edit` and `.../new/edit`, mounted by
 * the shell). The screen reads the address (filters, the open drawer, its view), loads through the typed client (`autoApi()`), refreshes on the push frame
 * `automations_changed`, and draws every state: loading, empty, no match, error, forbidden, switched off, not configured, offline / stale, view-only.
 * It names no product and carries no hint paragraph; the trash is in the user menu ("סל מחזור").
 */
@customElement('devices-automations')
export class DevicesAutomations extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  /** 0.1.154: the segments of "קברניט" this user is offered (set by the shell); the schedules segment is the first button of the strip. */
  @property({ attribute: false }) kavarnit: KavarnitSegments = { schedules: true, automations: true };
  @state() private schedCount: number | null = null;
  @state() private status: AutomationsStatus | null = null;
  @state() private items: Item[] | null = null;
  @state() private failed = '';
  @state() private noPerm = false;
  @state() private filters: ListFilters = { ...NO_FILTERS };
  @state() private route: AutomationsRoute = parseAutomationsRoute(['devices', 'automations'], new URLSearchParams());
  @state() private compactHeader = false;
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;
  @state() private filtersOpen = false;
  @state() private note: Note | null = null;
  @state() private toggling = new Set<string>();
  @state() private confirm: { item: Item; op: 'enable' } | null = null;
  @state() private whenOpen = false;
  @state() private drawerUsed = false;
  @state() private fieldScripts: ReadonlySet<string> = new Set();
  @state() private now: Date = new Date();
  @state() private cardAction = '';
  /** The raw query of the address (the editor route reads `kind` / `template` from it). */
  @state() private rawParams = new URLSearchParams();
  /** A gallery template the editor route named (`?template= `): its draft once loaded, null while loading or when unknown. */
  @state() private tplDraft: { id: string; draft: AnyDraft | null; done: boolean } | null = null;

  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  private offRoute: (() => void) | null = null;
  private offPush: (() => void) | null = null;
  private offEdit: (() => void) | null = null;
  private noteTimer = 0;
  private urlTimer = 0;
  private pushTimer = 0;
  private lastWritten = '';
  private fieldsFor = '';

  static styles = [bubbleChrome, ...automationsStyles, mediaPageStyles, css`
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    /* the owner's setting automations.sensitive_chip: red instead of amber, for every chip below (custom properties inherit through the shadow roots) */
    :host([data-sens='red']) {
      --au-sens-bg: var(--dv-danger-soft);
      --au-sens-fg: var(--dv-danger);
    }
    .dh-det .seg.kinds button {
      padding-inline: 14px;
    }
    .dh-det .grow {
      min-inline-size: 0;
    }
    .search {
      min-inline-size: 260px;
    }
    .newbtn[disabled] {
      opacity: 0.5;
    }
    .cgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: stretch;
    }
    .tools {
      display: contents;
    }
    .foldbtn {
      display: none;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    /* the note is a popover (top layer): a modal drawer or dialog is open while most notes appear, and must not dim them */
    .toast[popover] {
      inset-block-start: auto;
      margin-block: 0;
      padding: 11px 20px 11px 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      overflow: visible;
    }
    .toast .btn {
      min-block-size: 28px;
      padding-inline: 12px;
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
      border-color: transparent;
      box-shadow: none;
      margin-inline-start: 6px;
    }
    .toast.bad .ic {
      color: #ff453a;
    }
    .dlgform {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-block-start: 4px;
    }
    .dlgform p {
      margin: 0;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-md);
    }
    .dlgrow {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .when {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .when .btn {
      justify-content: flex-start;
      min-block-size: 52px;
      font-size: var(--sw-fs-lg);
    }
    @media (max-width: 767px) {
      .dh-row {
        grid-template-areas: 't .' 'r r';
        grid-template-columns: minmax(0, 1fr) var(--sw-float-reserve, 0px);
      }
      .dh-det {
        gap: 10px;
      }
      .dh-det .seg.kinds {
        order: 1;
        inline-size: 100%;
      }
      .dh-det .seg.kinds button {
        flex: 1;
        padding-inline: 8px;
      }
      .dh-det .stf {
        order: 2;
        inline-size: 100%;
      }
      .dh-det .grow {
        display: none;
      }
      .dh-det .search {
        order: 3;
        flex: 1 1 0;
        min-inline-size: 0;
      }
      .dh-det .newbtn {
        order: 3;
      }
      :host([data-phone-filter='fold']) .stf {
        display: none;
      }
      :host([data-phone-filter='fold']) .stf[data-open] {
        display: inline-flex;
      }
      :host([data-phone-filter='fold']) .foldbtn {
        display: inline-flex;
        order: 3;
      }
      .dh-det .stf {
        overflow-x: auto;
        scrollbar-width: none;
        justify-content: flex-start;
      }
      .dh-det .stf::-webkit-scrollbar {
        display: none;
      }
    }
  `];

  // ------------------------------------------------------------------------------------------------ lifecycle

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.phoneMq.addEventListener('change', this.onPhone);
    this.addEventListener('scroll', this.onScroll, { passive: true });
    this.offEdit = registerScreenEdit({ id: 'automations-trash', label: 'סל מחזור', icon: 'trash', can: () => !!(this.status?.can.manage || this.status?.can.scene_manage || this.status?.can.script_manage), run: () => pushRoute(trashPath()) });
    this.offRoute = onRouteChange((r) => this.onRoute(r));
    void this.load();
    if (isApi()) {
      this.offPush = subscribeHa((m) => {
        if (m.type !== 'automations_changed') return;
        window.clearTimeout(this.pushTimer);
        this.pushTimer = window.setTimeout(() => void this.refresh(), 500);
      });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.phoneMq.removeEventListener('change', this.onPhone);
    this.removeEventListener('scroll', this.onScroll);
    this.offRoute?.();
    this.offPush?.();
    this.offEdit?.();
    window.clearTimeout(this.noteTimer);
    window.clearTimeout(this.urlTimer);
    window.clearTimeout(this.pushTimer);
  }

  protected updated(c: PropertyValues) {
    measureHeaderBar(this.renderRoot, this.phone);
    const t = this.renderRoot.querySelector<HTMLElement>('.toast[popover]');
    if (t) {
      try { if (!t.matches(':popover-open')) t.showPopover(); } catch { /* no popover support: the note stays in the page */ }
    }
    if (c.has('status') && this.status) {
      this.setAttribute('data-phone-filter', this.status.ui.phone_filter === 'rows' ? 'rows' : 'fold');
      this.setAttribute('data-sens', this.status.ui.sensitive_chip === 'red' ? 'red' : 'amber');
    }
  }

  private onScroll = () => {
    const compact = this.scrollTop > 40;
    if (compact !== this.compactHeader) this.compactHeader = compact;
  };

  // ------------------------------------------------------------------------------------------------ routing

  private onRoute(r: RouteState) {
    if (r.segments[0] !== 'devices' || r.segments[1] !== 'automations') return;
    const next = parseAutomationsRoute(r.segments, r.params);
    const incoming = r.params.toString();
    if (incoming !== this.lastWritten) {
      const f = filtersFromParams(r.params);
      this.filters = f;
      this.lastWritten = incoming;
    }
    this.route = next;
    this.rawParams = new URLSearchParams(r.params);
    this.cardAction = r.params.get('do') ?? '';
    const et = editTarget(next, r.params);
    if (et?.template && this.tplDraft?.id !== et.template) void this.loadTemplate(et.template);
    if (next.id || next.trash) this.drawerUsed = true;
  }

  private segment(): Segment {
    const kinds = this.status ? visibleKinds(this.status) : [];
    const want = segmentOf(this.route.segment);
    return kinds.length && !kinds.includes(want.kind) ? segmentOfKind(kinds[0]).id : this.route.segment;
  }

  private extra(): Record<string, string> {
    const r = this.route;
    return { view: r.view === 'detail' ? '' : r.view, run: r.run };
  }
  private params(extra: Record<string, string> = this.extra()): URLSearchParams {
    return filtersToParams(this.filters, extra);
  }
  private hrefOf(segment: Segment, id: string, extra: Record<string, string> = {}): string {
    const q = filtersToParams(this.filters, extra).toString();
    return `#${itemPath(segment, id)}${q ? `?${q}` : ''}`;
  }
  private go(path: string, extra: Record<string, string> = {}) {
    const p = filtersToParams(this.filters, extra);
    this.lastWritten = p.toString();
    pushRoute(path, p);
  }
  private syncUrl(delay = 0) {
    window.clearTimeout(this.urlTimer);
    this.urlTimer = window.setTimeout(() => {
      const p = this.params();
      this.lastWritten = p.toString();
      replaceRoute(this.route.trash ? trashPath() : itemPath(this.route.segment, this.route.id), p);
    }, delay);
  }
  private setFilter(patch: Partial<ListFilters>, delay = 0) {
    this.filters = { ...this.filters, ...patch };
    this.syncUrl(delay);
  }
  private setSegment(s: Segment) {
    if (s === this.segment() && !this.route.id) return;
    this.filters = { ...this.filters, state: 'all', floor: '' };
    this.filtersOpen = false;
    this.go(itemPath(s));
  }

  // ------------------------------------------------------------------------------------------------ data

  /** The count of the schedules segment (best effort: a caller without schedule rights, or an old server, just gets no number). */
  private async loadScheduleCount() {
    try {
      this.schedCount = (await getScheduleStatus()).counts.visible;
    } catch {
      this.schedCount = null;
    }
  }

  private async load() {
    if (demoLoading()) return;
    if (this.kavarnit.schedules) void this.loadScheduleCount();
    await autoReady();
    this.now = autoNow();
    try {
      this.status = await autoApi().status();
    } catch (err) {
      const f = mapAutomationError(err);
      if (f.status === 403) this.noPerm = true;
      else this.failed = f.message;
      return;
    }
    if (this.status.available === 'feature_disabled' || this.status.available === 'not_configured') { this.items = []; return; }
    await this.loadList();
  }

  private async loadList() {
    try {
      const r = await autoApi().list({ limit: 500 });
      this.items = r.items;
      this.failed = '';
      this.now = autoNow();
      void this.loadFieldScripts();
    } catch (err) {
      if (this.items === null) this.failed = mapAutomationError(err).message;
      else this.say(mapAutomationError(err).message, 'error');
    }
  }

  /** The scripts that have fields (the list does not say): their "הפעל…" opens the sheet with the form. */
  private async loadFieldScripts() {
    const scripts = (this.items ?? []).filter((i) => i.kind === 'script');
    const key = scripts.map((s) => `${s.id}:${s.revision ?? ''}`).join('|');
    if (!scripts.length || key === this.fieldsFor) return;
    this.fieldsFor = key;
    const withFields = new Set<string>();
    await Promise.all(scripts.map(async (s) => {
      try {
        const d: ItemDetail = await autoApi().get('script', s.id);
        if ((d.draft as ScriptDraft).fields?.some((f) => f.selector.kind !== 'locked')) withFields.add(s.id);
      } catch { /* a script that cannot be read has no form here */ }
    }));
    this.fieldScripts = withFields;
  }

  private async refresh() {
    try {
      this.status = await autoApi().status();
      if (this.status.available !== 'feature_disabled' && this.status.available !== 'not_configured') await this.loadList();
    } catch { /* keep the last answer */ }
    await this.drawer?.refresh();
  }

  private get drawer(): AutomationDrawer | null {
    return this.renderRoot.querySelector('automation-drawer');
  }

  // ------------------------------------------------------------------------------------------------ feedback

  private say(text: string, tone: Note['tone'] = 'ok', action?: Note['action']) {
    window.clearTimeout(this.noteTimer);
    this.note = { text, tone, action };
    this.noteTimer = window.setTimeout(() => (this.note = null), action ? 10000 : 4000);
  }
  private onResult = (e: CustomEvent<DrawerResult>) => this.say(e.detail.text, e.detail.tone, e.detail.action);

  // ------------------------------------------------------------------------------------------------ actions

  private patchItem(item: Item) {
    this.items = (this.items ?? []).map((x) => (x.kind === item.kind && x.id === item.id ? item : x));
  }

  private async toggle(item: Item, enabled: boolean, confirmed = false) {
    if (this.toggling.has(item.id)) return;
    if (enabled && !confirmed && item.unknown_effects) { this.confirm = { item, op: 'enable' }; return; }
    this.confirm = null;
    this.toggling = new Set([...this.toggling, item.id]);
    try {
      const r = await toggleAutomation(item.id, enabled, { confirm: confirmed || undefined });
      this.patchItem(r.item);
      void this.refreshStatus();
    } catch (err) {
      if (needsConfirmation(err) && !confirmed) this.confirm = { item, op: 'enable' };
      else this.say(mapAutomationError(err).message, 'error');
      await this.loadList();
    } finally {
      this.toggling = new Set([...this.toggling].filter((x) => x !== item.id));
    }
  }

  private async refreshStatus() {
    try { this.status = await autoApi().status(); } catch { /* keep */ }
  }

  private onAction = (e: CustomEvent<{ item: Item; action: CardAction }>) => {
    const { item, action } = e.detail;
    const seg = segmentOfKind(item.kind).id;
    switch (action) {
      case 'edit': navigate(editPath(item.kind, item.id)); break;
      case 'trace': this.go(itemPath(seg, item.id), { view: 'trace' }); break;
      case 'versions': this.go(itemPath(seg, item.id), { view: 'versions' }); break;
      case 'dryrun': this.go(itemPath(seg, item.id), { view: 'dryrun' }); break;
      case 'run': this.go(itemPath(seg, item.id), { do: 'run' }); break;
      case 'copy': this.go(itemPath(seg, item.id), { do: 'copy' }); break;
      case 'delete': this.go(itemPath(seg, item.id), { do: 'delete' }); break;
    }
  };

  private newItem() {
    const seg = this.segment();
    if (seg === 'scenes') return this.go(itemPath('scenes', 'new'));
    if (seg === 'automations' && this.status?.ui.ask_when_on_new) { this.whenOpen = true; return; }
    const n = newPath(segmentOf(seg).kind);
    navigate(n.path, n.params);
  }

  // drawer events
  private onDrawerClose = () => {
    const seg = this.route.trash ? this.segment() : this.route.segment;
    this.go(itemPath(seg));
  };
  private onViewChange = (e: CustomEvent<{ view: string; run: string }>) => {
    const { view, run } = e.detail;
    this.go(itemPath(this.route.segment, this.route.id), { view: view === 'detail' ? '' : view, run });
  };
  private onDeleted = (e: CustomEvent<{ trash_id: string; name: string; kind: string; id: string }>) => {
    const { trash_id, name } = e.detail;
    this.go(itemPath(this.route.segment));
    void this.loadList();
    void this.refreshStatus();
    this.say(`"${name}" נמחק`, 'ok', { label: 'שחזור', run: () => void this.undoDelete(trash_id, name) });
  };
  private async undoDelete(trashId: string, name: string) {
    try {
      await autoApi().restoreTrash(trashId, { client_request_id: `undo-${trashId}-${Date.now()}` });
      this.say(`"${name}" שוחזר`);
      await this.loadList();
    } catch (err) {
      this.say(mapAutomationError(err).message, 'error');
    }
  }
  private onCopied = (e: CustomEvent<{ item: ItemDetail }>) => {
    void this.loadList();
    this.go(itemPath(segmentOfKind(e.detail.item.kind).id, e.detail.item.id));
    this.say('שוכפל');
  };
  private onChanged = () => {
    void this.loadList();
    void this.refreshStatus();
  };
  private onActionDone = () => {
    if (!this.cardAction) return;
    const p = this.params();
    p.delete('do');
    this.cardAction = '';
    replaceRoute(itemPath(this.route.segment, this.route.id), p);
  };

  // ------------------------------------------------------------------------------------------------ the editors (S4) over the list (S3)

  private async loadTemplate(id: string) {
    this.tplDraft = { id, draft: null, done: false };
    try {
      const { templates } = await autoApi().templates();
      const t = templates.find((x) => x.id === id);
      if (this.tplDraft?.id === id) this.tplDraft = { id, draft: t ? (t.draft as AnyDraft) : null, done: true };
    } catch {
      if (this.tplDraft?.id === id) this.tplDraft = { id, draft: null, done: true }; // no gallery for this caller: the editor opens on its own start
    }
  }

  /** Where the editor returns: the item's drawer (automations and scripts have one), else the kind's list. */
  private editorExit(kind: ItemKind, id: string): string {
    const seg = segmentOfKind(kind).id;
    return id && kind !== 'scene' ? itemPath(seg, id) : itemPath(seg);
  }
  private onEditorSaved = (e: CustomEvent<{ kind: ItemKind; id: string; status: 'ok' | 'not_loaded' }>) => {
    const { kind, id, status } = e.detail;
    void this.loadList();
    void this.refreshStatus();
    replaceRoute(this.editorExit(kind, status === 'ok' ? id : ''), filtersToParams(this.filters));
    this.say(status === 'not_loaded' ? 'נשמר, אך עדיין לא נטען' : 'נשמר', status === 'not_loaded' ? 'error' : 'ok');
  };
  private onEditorCancel = (kind: ItemKind, id: string) => {
    replaceRoute(this.editorExit(kind, id), filtersToParams(this.filters));
  };
  private onEditorDeleted = (e: CustomEvent<{ kind: ItemKind; id: string; trash_id: string }>) => {
    const { kind, id, trash_id } = e.detail;
    const name = (this.items ?? []).find((x) => x.kind === kind && x.id === id)?.name ?? '';
    replaceRoute(itemPath(segmentOfKind(kind).id), filtersToParams(this.filters));
    void this.loadList();
    void this.refreshStatus();
    this.say(name ? `"${name}" נמחק` : 'נמחק', 'ok', { label: 'שחזור', run: () => void this.undoDelete(trash_id, name) });
  };

  /** The editor of the route `.../<id>/edit` or `.../new/edit` (S4's sheets, mounted by tag over the list; keyed so another item is a fresh editor). */
  private editorSheet(): TemplateResult | typeof nothing {
    const et = editTarget(this.route, this.rawParams);
    if (!et) return nothing;
    if (et.template && !(this.tplDraft?.id === et.template && this.tplDraft.done)) return nothing;
    const draft0 = et.template ? this.tplDraft?.draft ?? null : null;
    const mode = et.id ? 'edit' : 'create';
    const cancel = () => this.onEditorCancel(et.kind, et.id);
    const changed = () => void this.loadList();
    const key = `${et.kind}:${et.id || 'new'}:${et.template}`;
    const scheme = isApi() ? '' : demoControl().scheme ?? ''; // the demo's scheme; with a backend the editors read devices.scheme like this screen
    if (et.kind === 'script') {
      return html`${keyed(key, html`<script-editor data-auto-editor="script" .itemId=${et.id || null} .mode=${mode} .scheme=${scheme} @saved=${this.onEditorSaved} @cancel=${cancel} @deleted=${this.onEditorDeleted} @item-changed=${changed}></script-editor>`)}`;
    }
    if (et.kind === 'scene') {
      return html`${keyed(key, html`<scene-editor data-auto-editor="scene" .itemId=${et.id || null} .mode=${mode} .scheme=${scheme} @saved=${this.onEditorSaved} @cancel=${cancel} @deleted=${this.onEditorDeleted} @item-changed=${changed}></scene-editor>`)}`;
    }
    return html`${keyed(key, html`<automation-builder data-auto-editor="automation" .itemId=${et.id || null} .mode=${mode} .scheme=${scheme} .draft0=${draft0} @saved=${this.onEditorSaved} @cancel=${cancel} @deleted=${this.onEditorDeleted} @item-changed=${changed}></automation-builder>`)}`;
  }

  // ------------------------------------------------------------------------------------------------ render pieces

  private segItems(seg: Segment): Item[] {
    const kind = segmentOf(seg).kind;
    return (this.items ?? []).filter((i) => i.kind === kind && !(kind === 'scene' && i.hidden));
  }

  private header(seg: Segment): TemplateResult {
    const def = segmentOf(seg);
    const all = this.segItems(seg);
    const kinds = this.status ? visibleKinds(this.status) : [];
    const counts = countsOf(this.items ?? []);
    const floors = floorOptions(all);
    const f = this.filters;
    const sc = stateCounts(all);
    const nb = newButton(this.status, def.kind);
    const active = filtersActive({ ...f, floor: '', q: '' });
    const tools = this.items !== null && !this.failed && !this.noPerm && !!this.status && this.status.available !== 'feature_disabled' && this.status.available !== 'not_configured';
    return html`<header class=${`dh${this.compactHeader ? ' compact' : ''}`} data-auto-header>
      <div class="dh-row">
        <h1 data-auto-title>${def.label}</h1>
        ${tools && floors.length ? html`<div class="rooms" role="group" aria-label="קומות">
          <button type="button" class="rc" aria-pressed=${String(!f.floor)} data-floor="" @click=${() => this.setFilter({ floor: '' })}>הכל</button>
          ${floors.map((x) => html`<button type="button" class="rc" aria-pressed=${String(f.floor === x.id)} data-floor=${x.id} @click=${() => this.setFilter({ floor: x.id })}>${bidi(x.name)}</button>`)}
        </div>` : html`<span class="grow"></span>`}
      </div>
      ${tools ? html`<div class="dh-det">
        ${kinds.length > 1 || (this.kavarnit.schedules && kinds.length) ? html`<div class="seg kinds" role="tablist" aria-label="סוג">${this.kavarnit.schedules ? html`<button type="button" role="tab" aria-selected="false" data-segment="schedules" @click=${() => navigate(SCHEDULES_PATH)}>תזמונים${this.schedCount === null ? nothing : html` <small>${this.schedCount}</small>`}</button>` : nothing}${SEGMENTS.filter((s) => kinds.includes(s.kind)).map((s) => html`<button type="button" role="tab" aria-selected=${String(seg === s.id)} data-segment=${s.id} @click=${() => this.setSegment(s.id)}>${s.label} <small>${counts[s.kind]}</small></button>`)}</div>` : nothing}
        ${def.kind === 'automation' && all.length ? html`<div class="seg sm stf" role="radiogroup" aria-label="סינון לפי מצב" ?data-open=${this.filtersOpen}>${STATE_FILTERS.map((s) => html`<button type="button" role="radio" aria-checked=${String(f.state === s.id)} data-state-filter=${s.id} @click=${() => this.setFilter({ state: s.id as StateFilter })}>${s.label}<small>${sc[s.id]}</small></button>`)}</div>` : nothing}
        ${def.kind === 'automation' && all.length ? html`<button type="button" class="btn foldbtn" data-fold-toggle aria-expanded=${String(this.filtersOpen)} @click=${() => (this.filtersOpen = !this.filtersOpen)}>${aIcon('filter')}סינון${active ? html` <small>${active}</small>` : nothing}</button>` : nothing}
        <span class="grow"></span>
        <label class="search">${aIcon('search')}<span class="sr-only">חיפוש</span><input type="search" data-search placeholder=${this.phone ? 'חיפוש' : def.searchLabel} .value=${f.q} @input=${(e: Event) => this.setFilter({ q: (e.target as HTMLInputElement).value }, 250)} /></label>
        ${nb.shown ? html`<button type="button" class="btn primary newbtn" data-auto-new ?disabled=${nb.disabled} title=${nb.reason} @click=${() => this.newItem()}>${aIcon(seg === 'scenes' ? 'camera' : 'plus')}${def.newLabel}</button>` : nothing}
      </div>` : nothing}
    </header>`;
  }

  private skeleton(): TemplateResult {
    const card = html`<div class="glass" style="padding:18px;display:flex;flex-direction:column;gap:12px;border-radius:24px"><span class="skl" style="block-size:20px;inline-size:55%"></span><span class="skl" style="block-size:13px;inline-size:35%"></span><span class="skl" style="block-size:48px"></span><span class="skl" style="block-size:14px;inline-size:60%"></span></div>`;
    return html`<div data-auto-state="loading" aria-busy="true"><div class="cgrid">${Array.from({ length: this.phone ? 3 : 6 }, () => card)}</div></div>`;
  }

  private stateBox(icon: Parameters<typeof aIcon>[0], title: string, kind: string, action?: TemplateResult): TemplateResult {
    return html`<div class="statebox glass" role="status" data-auto-state=${kind}><span class="ring">${aIcon(icon)}</span><b>${title}</b>${action ?? nothing}</div>`;
  }

  private bannerRow(seg: Segment): TemplateResult | typeof nothing {
    const list = banners(this.status, segmentOf(seg).kind);
    if (!list.length) return nothing;
    return html`<div class="stack">${list.map((b) => html`<div class=${`banner ${b.tone}`} role=${b.tone === 'bad' ? 'alert' : 'status'} data-auto-banner=${b.id}>${aIcon(b.id === 'offline' ? 'wifiOff' : b.id === 'delegation_off' ? 'info' : b.tone === 'info' ? 'info' : 'warning')}<div>${b.title ? html`<b>${b.title}</b><small>${b.text}</small>` : b.text}</div>${b.retry ? html`<button type="button" class="btn sm" data-banner-retry @click=${() => void this.refresh()}>${aIcon('refresh')}נסו שוב</button>` : nothing}</div>`)}</div>`;
  }

  private body(seg: Segment): TemplateResult | typeof nothing {
    const sk = screenKind(this.status, { failed: !!this.failed, noPermission: this.noPerm, loading: this.items === null });
    const settings = this.status?.can.configure ? html`<a class="btn sm" href="#/system/automations" data-open-settings>הגדרות האוטומציות</a>` : undefined;
    if (sk === 'loading') return this.skeleton();
    if (sk === 'error') return this.stateBox('warning', 'לא ניתן לטעון את הרשימה', 'error', html`<button type="button" class="btn sm" data-auto-retry @click=${() => { this.failed = ''; this.items = null; void this.load(); }}>${aIcon('refresh')}נסו שוב</button>`);
    if (sk === 'no_permission') return this.stateBox('lock', 'אין הרשאה לצפות באוטומציות', 'no_permission');
    if (sk === 'feature_disabled') return this.stateBox('settings', 'האוטומציות כבויות', 'feature_disabled', settings);
    if (sk === 'not_configured') return this.stateBox('settings', 'האוטומציות עדיין לא הוגדרו', 'not_configured', settings);
    const def = segmentOf(seg);
    const all = this.segItems(seg);
    const rows = applyFilters(this.items ?? [], this.filters, def.kind).filter((i) => !(def.kind === 'scene' && i.hidden));
    const nb = newButton(this.status, def.kind);
    let content: TemplateResult;
    if (!all.length) {
      content = this.stateBox(seg === 'scenes' ? 'sparkle' : seg === 'scripts' ? 'script' : 'bolt', seg === 'scenes' ? 'אין עדיין סצנות' : seg === 'scripts' ? 'אין עדיין סקריפטים' : 'אין עדיין אוטומציות', 'empty', nb.shown && !nb.disabled ? html`<button type="button" class="btn primary" data-auto-new-empty @click=${() => this.newItem()}>${aIcon('plus')}${def.newLabel}</button>` : undefined);
    } else if (!rows.length) {
      content = this.stateBox('search', seg === 'scenes' ? 'לא נמצאו סצנות' : seg === 'scripts' ? 'לא נמצאו סקריפטים' : 'לא נמצאו אוטומציות', 'no-match', html`<button type="button" class="btn sm" data-clear-filters @click=${() => { this.filters = { ...NO_FILTERS }; this.syncUrl(); }}>נקה סינון</button>`);
    } else if (seg === 'scenes') {
      content = html`<scenes-panel .items=${rows} .hiddenItems=${hiddenScenes(this.items ?? [])} .status=${this.status} .now=${this.now} .sceneId=${this.route.segment === 'scenes' ? this.route.id : ''} @result=${this.onResult} @changed=${this.onChanged}
        @open-scene=${(e: CustomEvent<{ id: string }>) => this.go(itemPath('scenes', e.detail.id))} @close-scene=${() => this.go(itemPath('scenes'))}></scenes-panel>`;
    } else if (seg === 'scripts') {
      content = html`<scripts-panel .items=${rows} .status=${this.status} .now=${this.now} .withFields=${this.fieldScripts} .sensitiveWarning=${this.status?.ui.sensitive_warning !== false} .hrefOf=${(id: string) => this.hrefOf('scripts', id)}
        @result=${this.onResult} @changed=${this.onChanged} @open-script=${(e: CustomEvent<{ id: string }>) => this.go(itemPath('scripts', e.detail.id))}></scripts-panel>`;
    } else {
      content = html`<div class="cgrid" data-auto-grid>${repeat(rows, (i) => i.id, (i) => html`<automation-card .item=${i} .now=${this.now} .href=${this.hrefOf('automations', i.id)} .traceHref=${this.hrefOf('automations', i.id, { view: 'trace' })}
        .sensitiveWarning=${this.status?.ui.sensitive_warning !== false} .busy=${this.toggling.has(i.id)} @toggle=${(e: CustomEvent<{ item: Item; enabled: boolean }>) => void this.toggle(e.detail.item, e.detail.enabled)} @action=${this.onAction}></automation-card>`)}</div>`;
    }
    return html`${this.bannerRow(seg)}${content}`;
  }

  private dialogs(): TemplateResult | typeof nothing {
    if (this.confirm) {
      const c = this.confirm;
      return html`<sw-dialog open heading="להפעיל?" data-dialog="enable" @close=${() => (this.confirm = null)}><div class="dlgform">${confirmLine(c.item) ? html`<p>${confirmLine(c.item)}</p>` : nothing}<div class="dlgrow"><button type="button" class="btn" @click=${() => (this.confirm = null)}>ביטול</button><button type="button" class="btn primary" data-dialog-ok @click=${() => void this.toggle(c.item, true, true)}>הפעל</button></div></div></sw-dialog>`;
    }
    if (this.whenOpen) {
      return html`<sw-dialog open heading="מתי?" data-dialog="when" @close=${() => (this.whenOpen = false)}><div class="when">
        <button type="button" class="btn" data-when="time" @click=${() => { this.whenOpen = false; navigate('/devices/schedules/new/edit'); }}>${aIcon('calendar')}בשעות קבועות</button>
        <button type="button" class="btn" data-when="event" @click=${() => { this.whenOpen = false; const n = newPath('automation'); navigate(n.path, n.params); }}>${aIcon('bolt')}כשמשהו קורה</button></div></sw-dialog>`;
    }
    return nothing;
  }

  render() {
    const seg = this.segment();
    const r = this.route;
    const drawerKind = r.segment === 'scripts' ? 'script' : 'automation';
    const drawerOpen = ((!!r.id && r.id !== 'new' && r.segment !== 'scenes') || r.trash) && !r.edit; // the editor sheet replaces the drawer while it is open
    return html`<div class="page" data-screen="devices-automations" data-segment=${seg}>
      ${this.header(seg)}
      ${this.body(seg)}
    </div>
    ${this.drawerUsed || drawerOpen
      ? html`<automation-drawer .kind=${drawerKind} .itemId=${r.segment === 'scenes' ? '' : r.id} .open=${drawerOpen} .trash=${r.trash} .view=${r.view} .runId=${r.run} .status=${this.status} .now=${this.now} .action=${this.cardAction}
          @drawer-close=${this.onDrawerClose} @view-change=${this.onViewChange} @edit=${(e: CustomEvent<{ kind: 'automation' | 'script' | 'scene'; id: string }>) => navigate(editPath(e.detail.kind, e.detail.id))}
          @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied} @result=${this.onResult} @action-done=${this.onActionDone}></automation-drawer>`
      : nothing}
    ${this.editorSheet()}
    ${this.dialogs()}
    ${this.note ? html`<div class=${`toast${this.note.tone === 'error' ? ' bad' : ''}`} popover="manual" role="status" data-auto-note>${aIcon(this.note.tone === 'error' ? 'warning' : 'check')}${this.note.text}${this.note.action ? html`<button type="button" class="btn sm" data-note-action @click=${() => { const a = this.note?.action; this.note = null; a?.run(); }}>${this.note.action.label}</button>` : nothing}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-automations': DevicesAutomations;
  }
}

export { BASE };
