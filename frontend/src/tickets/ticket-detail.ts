import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import './ticket-cost-card'; // slice 9 (11A.7): the cost card (the Costs tab until TKUI3 rebuilds it)
import { ct } from './cost-text';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-drawer';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { ticketsApi, type DetailMode, type Handler, type Meta, type PatchBody, type TicketDetail, type TicketStatus } from '../api/tickets';
import type { LinkBlock } from '../api/tickets-s4';
import { messagesApi } from '../api/tickets-messages';
import { assigneeRef, handlersOf } from './assignee-model';
import {
  actorName, eventLine, fromLocalInput, listHref, marksInternal, moveTo, priorityTone, shortDateTime,
  ticketHref, toLocalInput, type TicketsRoute,
} from './model';
import { tt } from './text';
import { tIcon } from './icons';
import { ticketDetailStyles, ticketFormStyles } from './styles';
import { onTicketNames } from './naming';
import { codeLockSection, lockText, sendNewLink } from './code-lock';
import { messageEventLine, messagesBlock } from './ticket-messages'; // slice 5b: the delivery lines (D14) and the message events
import { ExternalAssign, externalAssignStyles } from './external-assign';
import { LinkPanel, linkPanelStyles } from './link-panel';
import { deviceBlockStyles, historySection } from './ticket-device-context'; // CR-038 slice 3: the frozen device history
import './delete-dialog'; // owner 14.10: full deletion (tickets.delete)
import { openOverlay, menuKey } from './overlay-menu';
import {
  SIZE_WIDTH, effectiveSize, initialTab, menuActions, parseSheet, primaryAction, quietAction, tabItems,
  type DrawerAction, type DrawerSize, type DrawerTab, type PhoneSheet,
} from './drawer-model';
import { dwt } from './drawer-text';
import { drawerTabs, drawerTabsStyles, tabId, TAB_PANEL_ID } from './drawer-tabs';
import { statusBlock, statusBlockStyles } from './status-block';
import { nowSection, overviewStyles, overviewTab, type OverviewCtx } from './overview-tab';
import { viewerRole } from './status-sentence';
import { loadOwnSize, saveOwnSize } from './drawer-prefs';

interface EditForm { title: string; description: string; department_id: string; category_id: string; priority_id: string }

type Dialog =
  | { kind: 'move'; to: TicketStatus; noteRequired: boolean }
  | { kind: 'assign' }
  | { kind: 'return' }
  | { kind: 'edit' }
  | { kind: 'eta' }
  | null;

type Detail = TicketDetail & { link?: LinkBlock | null };

/** The rows of the Conversation tab until TKUI2 splits it into "עם הספק" / "הצוות": notes, replies and messages. */
const CONV_KINDS = new Set(['note', 'photo', 'inbound', 'late_reply', 'link_sent', 'update_sent', 'code_sent', 'message_unknown', 'message_failed', 'message_fallback']);
/** The photos the Overview shows before "+N" (one row, IA §5). */
const PHOTO_ROW = 4;
const PHONE_QUERY = '(max-width: 767px)';

/**
 * CR-038 `<ticket-detail .ticketId mode="drawer|page">`, rebuilt for release 2.6.0 (TKUI1) on the owner-approved mock-up v5 and the binding
 * IA document (SERVICE_MODULE_UX_IA_2026-10-16): one ticket - the modal drawer over the list (520 / 640 / full screen, the viewer's own
 * choice remembered; on a phone a full or a half sheet) or the full page `#/tickets/<id>` (D18).
 *   - fixed: the header (title ≤ 2 lines, number · place · ONE priority chip, the size switch, "⋯") and the STATUS BLOCK (tickets/status-
 *     block.ts: one chip, the one-sentence status, one warning line, SLA only when near / crossed, ONE role-resolved primary + ≤ 1 quiet);
 *   - the tabs סקירה / שיחה / עלויות / היסטוריה (tickets/drawer-tabs.ts) - ONLY the active tab is rendered, inside the drawer body, so each
 *     tab is exactly one scroll container (tests/layout-tickets-drawer.spec.ts counts them);
 *   - Overview is complete (tickets/overview-tab.ts); שיחה / עלויות / היסטוריה are SLOTS that reuse the existing blocks (messages, notes and
 *     timeline; the cost card; the link audit and the timeline) until TKUI2 / TKUI3 rebuild them - look for `data-slot`.
 * Every action calls the API and shows the server's answer; nothing is decided here. The default tab is the module setting (`ui.detail_tab`,
 * else Overview); a deep link may pass `?tab=` (`initialTab`) and the card's "ציר זמן" opens History.
 * Events (bubble, composed): `ticket-changed` {ticket}, `ticket-gone` {id} (returned by a non-member handler), `drawer-close`.
 */
@customElement('ticket-detail')
export class TicketDetailView extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property() ticketId = '';
  @property({ reflect: true }) mode: 'drawer' | 'page' = 'drawer';
  @property({ type: Boolean }) open = false;
  /** D18: whether the drawer offers the full screen and the page offers the drawer */
  @property() detailMode: DetailMode = 'drawer_fullscreen';
  /** the list the page returns to and the drawer is opened over */
  @property() scope: TicketsRoute['scope'] = 'mine';
  /** the card's "ציר זמן" link: open the History tab at the timeline */
  @property({ type: Boolean }) focusTimeline = false;
  /** TKUI1: a deep link's tab (`?tab=conv|costs|history|overview`), else the module setting `ui.detail_tab` (`defaultTab`) */
  @property() initialTab = '';
  @property() defaultTab = '';
  /** TKUI1: the module settings `ui.drawer_size` (the desktop default - a viewer's own switch wins) and `ui.phone_sheet` (full / half) */
  @property() sizeSetting = '';
  @property() sheetSetting = '';
  /** TKUI1: the new-request sheet's vendor flow, step two (`?assign=contact:<id>`): open the external-assign dialog prefilled, once */
  @property() assignContact = '';
  private assignedFor = '';
  @state() private t: Detail | null = null;
  @state() private failed = '';
  @state() private gone = false;
  @state() private busy = false;
  @state() private dialog: Dialog = null;
  @state() private flash: { text: string; tone: 'ok' | 'bad' } | null = null;
  @state() private composing = false;
  @state() private noteText = '';
  @state() private noteExternal = false;
  @state() private uploading = 0;
  @state() private tab: DrawerTab = 'overview';
  @state() private size: DrawerSize = 'wide';
  @state() private sheet: PhoneSheet = 'full';
  @state() private phone = false;
  @state() private menu = false;
  @state() private descOpen = false;
  @state() private photosAll = false;
  // dialog fields
  @state() private dlgText = '';
  @state() private costGate: { canOverride: boolean } | null = null; // slice 9 (11A.3): the close met a pending required claim
  @state() private dlgOverride = '';
  @state() private dlgNumber = '';
  @state() private dlgError = '';
  @state() private dlgPick = '';
  @state() private dlgFlag = true;
  @state() private dlgReturnKind: 'cannot_handle' | 'not_mine' = 'cannot_handle';
  /** TKSTAFF2: the handlers of the assign dialog - account holders and staff contacts without an account, one list (assignee-model.ts) */
  @state() private eligible: Handler[] | null = null;
  @state() private deleting = false; // owner 14.10: the deletion dialog is open
  @state() private meta: Meta | null = null;
  @state() private edit: EditForm | null = null;
  private loadedFor = '';
  private flashTimer = 0;
  private offNames: (() => void) | null = null;
  private mq: MediaQueryList | null = null;
  // slice 4: sending outside from the assign dialog, and the link panel (the History tab's audit card)
  private readonly ext = new ExternalAssign(this, { busy: () => this.busy, run: (fn, done) => this.run(fn, done) });
  private readonly linkPanel = new LinkPanel(this, {
    busy: () => this.busy, run: (fn, done) => this.run(fn, done || undefined), say: (m, tone) => this.say(m, tone), reload: () => void this.load(),
  });

  static styles = [bubbleChrome, ...automationsStyles, ticketDetailStyles, ticketFormStyles, externalAssignStyles, linkPanelStyles, deviceBlockStyles,
    statusBlockStyles, drawerTabsStyles, overviewStyles, css`
    sw-drawer {
      --sw-drawer-modal-w: 640px;
    }
    /* the title of the header: two lines at most, then an ellipsis (IA §5) */
    sw-drawer::part(title) {
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      font-size: var(--sw-fs-xl);
      font-weight: 700;
      line-height: 1.25;
    }
    sw-dialog {
      --sw-surface: var(--dv-surface-solid);
      --sw-glass-blur: none;
    }
    .hsub {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      margin-block-start: 3px;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
    .hsub .id {
      font-weight: 700;
      color: var(--dv-text);
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .hsub .ic {
      color: var(--dv-text-3);
    }
    .hsub .chip {
      block-size: 22px;
      padding-inline: 8px;
      font-size: var(--sw-fs-xs);
    }
    .hacts {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .sizes {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border-radius: 999px;
      background: var(--dv-surface-3);
    }
    .sizes button {
      display: grid;
      place-items: center;
      inline-size: 34px;
      block-size: 30px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--dv-text-2);
      cursor: pointer;
    }
    .sizes button[aria-pressed='true'] {
      background: var(--mm-seg-thumb, var(--dv-surface-solid));
      color: var(--dv-accent-text);
      box-shadow: var(--dv-shadow-control);
    }
    .sizes button:focus-visible,
    .rb:focus-visible {
      outline: 2px solid var(--dv-focus, var(--dv-accent));
      outline-offset: 1px;
    }
    .sizes .ic {
      font-size: var(--sw-fs-md);
    }
    .strip {
      display: block;
      background: var(--dv-surface-solid);
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 18px;
      min-inline-size: 0;
    }
    .slot-note {
      margin: 0;
      color: var(--dv-text-3);
      font-size: var(--sw-fs-sm);
    }
    .half {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .half .btn {
      align-self: center;
      min-block-size: 44px;
    }
    .photos-more {
      display: grid;
      place-items: center;
      font-weight: 700;
      font-size: var(--sw-fs-md);
      color: var(--dv-text-2);
      border-style: dashed;
      cursor: pointer;
    }
    /* the "⋯" menu: a top-layer popover (tickets/overlay-menu.ts) - never a scroll box inside a tab */
    .pop.ov {
      position: fixed;
      inset: auto;
      margin: 0;
      display: flex;
      flex-direction: column;
      min-inline-size: 220px;
      max-inline-size: calc(100vw - 16px);
      padding: 6px;
      overflow-y: auto;
      overscroll-behavior: contain;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--dv-shadow-2);
      color: var(--dv-text);
    }
    .pop .mh {
      padding: 8px 12px 4px;
      font-size: var(--sw-fs-xs);
      font-weight: 700;
      color: var(--dv-text-3);
    }
    .pop hr {
      border: 0;
      border-block-start: 1px solid var(--dv-border);
      margin: 4px 6px;
    }
    .pop [role='menuitem'] {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 44px;
      padding-inline: 12px;
      border: 0;
      border-radius: var(--sw-r-md);
      background: transparent;
      color: var(--dv-text);
      font: inherit;
      font-size: var(--sw-fs-md);
      text-align: start;
      text-decoration: none;
      cursor: pointer;
    }
    .pop [role='menuitem']:hover,
    .pop [role='menuitem']:focus-visible {
      background: var(--dv-surface-3);
      outline: none;
    }
    .pop [role='menuitem'] .ic {
      font-size: var(--sw-fs-lg);
      color: var(--dv-text-2);
    }
    .pop [role='menuitem'].dz,
    .pop [role='menuitem'].dz .ic {
      color: var(--dv-danger);
    }
    /* ---- the full page: the status block as a hero, the same tabs in one card (IA §4.1: no columns) ---- */
    .page {
      padding: 0 36px 44px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .phead {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px 14px;
      padding-block-start: 18px;
    }
    .phead .tt {
      flex: 1;
      min-inline-size: 0;
    }
    .phead h1 {
      margin: 0;
      font-size: var(--sw-fs-3xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.15;
      overflow-wrap: anywhere;
    }
    .phead .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .hero,
    .tabcard {
      padding: 0;
      overflow: clip;
      border-radius: var(--sw-r-2xl);
    }
    .hero .stat {
      border-block-end: 0;
    }
    .tabcard .rtabs {
      background: transparent;
    }
    .tabcard .panel {
      padding: 16px 18px 20px;
    }
    .flash {
      position: sticky;
      inset-block-start: 0;
      z-index: 5;
    }
    @media (max-width: 767px) {
      .page {
        padding: 0 16px 28px;
      }
      .phead h1 {
        font-size: var(--sw-fs-2xl);
      }
      .tabcard .panel {
        padding: 12px 14px 16px;
      }
      .rb {
        inline-size: 44px;
        block-size: 44px;
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.offNames = onTicketNames(() => this.requestUpdate());
    this.size = effectiveSize(loadOwnSize(), this.sizeSetting);
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mq = window.matchMedia(PHONE_QUERY);
      this.phone = this.mq.matches;
      this.mq.addEventListener?.('change', this.onMq);
    }
    window.addEventListener('pointerdown', this.onOutside, true);
    window.addEventListener('resize', this.placeMenu);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.flashTimer);
    this.offNames?.();
    this.mq?.removeEventListener?.('change', this.onMq);
    window.removeEventListener('pointerdown', this.onOutside, true);
    window.removeEventListener('resize', this.placeMenu);
  }

  private onMq = (e: MediaQueryListEvent) => {
    this.phone = e.matches;
  };

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('sizeSetting')) this.size = effectiveSize(loadOwnSize(), this.sizeSetting);
    if (changed.has('open') && !this.open && this.mode === 'drawer') this.loadedFor = ''; // a ticket opened again is read again
    if ((changed.has('ticketId') || changed.has('open')) && this.ticketId && (this.mode === 'page' || this.open) && this.loadedFor !== this.ticketId) {
      this.loadedFor = this.ticketId;
      this.t = null;
      this.failed = '';
      this.gone = false;
      this.dialog = null;
      this.composing = false;
      this.menu = false;
      this.descOpen = false;
      this.photosAll = false;
      this.tab = initialTab({ deepLink: this.initialTab, focusTimeline: this.focusTimeline, setting: this.defaultTab });
      this.sheet = parseSheet(this.sheetSetting) ?? 'full';
      this.linkPanel.reset();
      void this.load();
    } else if (changed.has('initialTab') && this.initialTab && this.t) {
      this.tab = initialTab({ deepLink: this.initialTab, setting: this.defaultTab });
    }
  }

  private async load(): Promise<void> {
    const id = this.ticketId;
    try {
      const t = await ticketsApi().get(id);
      if (id !== this.ticketId) return;
      this.t = t as Detail;
      if (this.assignContact && this.assignedFor !== id && t.can.assign) {
        this.assignedFor = id;
        this.openDialog({ kind: 'assign' });
        this.ext.preselect(this.assignContact);
        // the screen drops the parameter from the address (a reload never reopens the dialog); cancelling leaves the request unassigned
        this.dispatchEvent(new CustomEvent('assign-consumed', { detail: { id }, bubbles: true, composed: true }));
      }
      if (this.focusTimeline) void this.updateComplete.then(() => this.renderRoot.querySelector('#timeline')?.scrollIntoView({ block: 'start' }));
    } catch (e) {
      if (id !== this.ticketId) return;
      if (e instanceof ApiError && e.status === 404) this.gone = true;
      else this.failed = describeError(e);
    }
  }

  private say(text: string, tone: 'ok' | 'bad' = 'ok'): void {
    this.flash = { text, tone };
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => (this.flash = null), tone === 'bad' ? 7000 : 3500);
  }

  /** One action against the API: the busy flag, the new ticket, the server's message on a refusal (a 409 reloads the ticket). */
  private async run(fn: () => Promise<TicketDetail | { view: 'none' }>, done?: string): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      const next = await fn();
      if ('view' in next && next.view === 'none') {
        this.dispatchEvent(new CustomEvent('ticket-gone', { detail: { id: this.ticketId }, bubbles: true, composed: true }));
        this.gone = true;
        this.t = null;
      } else {
        this.t = next as Detail;
        this.dispatchEvent(new CustomEvent('ticket-changed', { detail: { ticket: this.t }, bubbles: true, composed: true }));
      }
      if (done) this.say(done);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'cost_claim_pending' && this.dialog?.kind === 'move') {
        const details = (e.body as { details?: { can_override?: boolean } }).details;
        this.costGate = { canOverride: !!details?.can_override };
        this.dlgError = describeError(e);
        return false;
      }
      this.say(describeError(e), 'bad');
      if (e instanceof ApiError && (e.status === 409 || e.status === 404)) void this.load();
      return false;
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- actions

  private move(to: TicketStatus): void {
    const t = this.t;
    if (!t) return;
    const m = moveTo(t, to);
    if (!m.allowed) return;
    if (to === 'closed' || to === 'cancelled' || (to === 'new' && t.status === 'closed') || m.noteRequired) {
      this.openDialog({ kind: 'move', to, noteRequired: m.noteRequired });
      return;
    }
    void this.run(() => ticketsApi().status(t.id, { to, revision: t.revision }), tt('saved'));
  }

  /** The one entry of the status block, the menu and the Overview buttons (tickets/drawer-model.ts decides what is offered). */
  private onAction = (a: DrawerAction): void => {
    const t = this.t;
    this.setMenu(false);
    if (!t) return;
    switch (a.kind) {
      case 'assign':
      case 'reassign':
        this.openDialog({ kind: 'assign' });
        return;
      case 'move':
      case 'toggle_wait':
      case 'close':
      case 'cancel':
      case 'reopen':
        if (a.to) this.move(a.to);
        return;
      case 'costs':
      case 'conv':
        this.selectTab(a.tab ?? (a.kind === 'costs' ? 'costs' : 'conv'), false);
        if (a.kind === 'conv' && t.can.note) {
          this.composing = true;
          void this.updateComplete.then(() => (this.renderRoot.querySelector('.composer textarea') as HTMLTextAreaElement | null)?.focus());
        }
        return;
      case 'resend_link':
        void this.run(() => messagesApi().resendLink(t.id), dwt('a_resend'));
        return;
      case 'eta':
        this.openDialog({ kind: 'eta' });
        return;
      case 'return':
        this.openDialog({ kind: 'return' });
        return;
      case 'edit':
        this.openDialog({ kind: 'edit' });
        return;
      case 'delete':
        this.deleting = true;
        return;
      case 'page':
        window.location.href = ticketHref(t.id);
        return;
    }
  };

  private selectTab(tab: DrawerTab, focus: boolean): void {
    this.tab = tab;
    this.composing = tab === 'conv' ? this.composing : false;
    void this.updateComplete.then(() => {
      if (focus) (this.renderRoot.querySelector(`#${tabId(tab)}`) as HTMLElement | null)?.focus();
      const body = this.scrollBox();
      if (body) body.scrollTop = 0;
    });
  }

  /** The tab's one scroll container: the drawer body (inside sw-drawer's shadow), or nothing on the page (the page scrolls). */
  private scrollBox(): HTMLElement | null {
    const d = this.renderRoot.querySelector('sw-drawer');
    return (d?.shadowRoot?.querySelector('.body') as HTMLElement | null) ?? null;
  }

  private setSize(s: DrawerSize): void {
    this.size = s;
    saveOwnSize(s);
  }

  private setMenu(on: boolean): void {
    if (this.menu === on) return;
    this.menu = on;
    if (on) void this.updateComplete.then(() => {
      this.placeMenu();
      (this.renderRoot.querySelector('.pop.ov [role="menuitem"]') as HTMLElement | null)?.focus();
    });
    else {
      const pop = this.renderRoot.querySelector('.pop.ov') as (HTMLElement & { hidePopover?: () => void }) | null;
      try {
        pop?.hidePopover?.();
      } catch {
        /* already hidden */
      }
    }
  }

  private placeMenu = (): void => {
    if (!this.menu) return;
    const pop = this.renderRoot.querySelector('.pop.ov') as HTMLElement | null;
    const btn = this.renderRoot.querySelector('[data-more]') as HTMLElement | null;
    if (pop && btn) openOverlay(pop, btn);
  };

  private onOutside = (e: PointerEvent): void => {
    if (!this.menu) return;
    const path = e.composedPath();
    const pop = this.renderRoot.querySelector('.pop.ov');
    const btn = this.renderRoot.querySelector('[data-more]');
    if ((pop && path.includes(pop)) || (btn && path.includes(btn))) return;
    this.setMenu(false);
  };

  private onMenuKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.setMenu(false);
      (this.renderRoot.querySelector('[data-more]') as HTMLElement | null)?.focus();
      return;
    }
    if (e.key === 'Tab') {
      this.setMenu(false);
      return;
    }
    menuKey(e, e.currentTarget as HTMLElement);
  };

  private openDialog(d: Exclude<Dialog, null>): void {
    this.dlgText = '';
    this.dlgNumber = '';
    this.dlgError = '';
    this.dlgPick = '';
    this.dlgFlag = true;
    this.dlgReturnKind = 'cannot_handle';
    this.costGate = null;
    this.dlgOverride = '';
    this.dialog = d;
    const t = this.t;
    if (!t) return;
    if (d.kind === 'assign') {
      this.eligible = null;
      this.ext.reset();
      void ticketsApi().assignees(t.department?.id ?? '', t.id).then((r) => { this.eligible = handlersOf(r); this.ext.take(r, t); }).catch((e) => { this.eligible = []; this.dlgError = describeError(e); });
    }
    if (d.kind === 'eta') this.dlgText = toLocalInput(t.eta_at);
    if (d.kind === 'edit') {
      this.edit = { title: t.title, description: t.description, department_id: t.department?.id ?? '', category_id: t.category?.id ?? '', priority_id: t.priority?.id ?? '' };
      if (!this.meta) void ticketsApi().meta().then((m) => (this.meta = m)).catch(() => undefined);
    }
  }

  private closeDialog(): void {
    this.dialog = null;
    this.edit = null;
  }

  /** A dialog closed (Escape, its close button): its `close` event must not reach the drawer around it - that would close the drawer too. */
  private onDialogClose = (e: Event) => {
    e.stopPropagation();
    this.closeDialog();
  };

  private async submitMove(to: TicketStatus, noteRequired: boolean): Promise<void> {
    const t = this.t;
    if (!t) return;
    const note = this.dlgText.trim();
    if ((noteRequired || to === 'cancelled') && !note) {
      this.dlgError = tt('required');
      return;
    }
    let duplicateOf: string | null = null;
    if (to === 'cancelled' && this.dlgNumber.trim()) {
      const n = Number(this.dlgNumber.trim().replace(/^#/, ''));
      const found = Number.isInteger(n) && n > 0 ? (await ticketsApi().list({ scope: 'visible', status: 'all', q: String(n), limit: 20 }).catch(() => null))?.items.find((x) => x.number === n) : undefined;
      if (!found || found.id === t.id) {
        this.dlgError = tt('duplicateNotFound');
        return;
      }
      duplicateOf = found.id;
    }
    const override = to === 'closed' && this.costGate?.canOverride ? this.dlgOverride.trim() : '';
    if (to === 'closed' && this.costGate?.canOverride && !override) {
      this.dlgError = tt('required');
      return;
    }
    const body = { to, note: note || null, duplicate_of: duplicateOf, revision: t.revision, ...(override ? { override_claim_reason: override } : {}) };
    if (await this.run(() => ticketsApi().status(t.id, body), tt('saved'))) this.closeDialog();
  }

  private async submitAssign(): Promise<void> {
    const t = this.t;
    if (t && this.ext.outside) { // slice 4: an outside contact / vendor
      if (await this.ext.submit(t, this.dlgText.trim(), this.dlgFlag)) this.closeDialog();
      return;
    }
    const h = this.pickedHandler();
    if (!t || !h) {
      this.dlgError = tt('required');
      return;
    }
    // TKSTAFF2: one submit for every handler - an account holder, or a staff contact (the server sends its personal link)
    const note = this.dlgText.trim();
    if (await this.run(() => ticketsApi().assign(t.id, { assignee: assigneeRef(h), note: note || null, note_external: this.dlgFlag, revision: t.revision }), tt('saved'))) this.closeDialog();
  }

  /** The handler picked in the dialog (its key), when it belongs to the group on show. */
  private pickedHandler(): Handler | null {
    return this.groupHandlers().find((h) => h.key === this.dlgPick) ?? null;
  }

  /** The handlers of the handler group on show: account holders, or staff contacts without an account. */
  private groupHandlers(): Handler[] {
    const staff = this.ext.kind === 'employee';
    return (this.eligible ?? []).filter((h) => h.account !== staff);
  }

  private async submitReturn(): Promise<void> {
    const t = this.t;
    if (!t) return;
    const reason = this.dlgText.trim();
    if (!reason) {
      this.dlgError = tt('required');
      return;
    }
    if (await this.run(() => ticketsApi().giveBack(t.id, { kind: this.dlgReturnKind, reason, revision: t.revision }), tt('saved'))) this.closeDialog();
  }

  private async submitEdit(): Promise<void> {
    const t = this.t;
    const e = this.edit;
    if (!t || !e) return;
    if (!e.title.trim()) {
      this.dlgError = tt('createNeed');
      return;
    }
    const can = new Set(t.can.edit_fields);
    const body: PatchBody = { revision: t.revision };
    if (can.has('title') && e.title.trim() !== t.title) body.title = e.title.trim();
    if (can.has('description') && e.description !== t.description) body.description = e.description;
    if (can.has('department_id') && e.department_id && e.department_id !== t.department?.id) body.department_id = e.department_id;
    if (can.has('category_id') && (e.category_id || null) !== (t.category?.id ?? null)) body.category_id = e.category_id || null;
    if (can.has('priority_id') && e.priority_id && e.priority_id !== t.priority?.id) body.priority_id = e.priority_id;
    if (Object.keys(body).length === 1) {
      this.closeDialog();
      return;
    }
    if (await this.run(() => ticketsApi().patch(t.id, body), tt('saved'))) this.closeDialog();
  }

  private async submitEta(clear: boolean): Promise<void> {
    const t = this.t;
    if (!t) return;
    const value = clear ? null : fromLocalInput(this.dlgText) || null;
    if (!clear && !value) {
      this.dlgError = tt('required');
      return;
    }
    if (await this.run(() => ticketsApi().eta(t.id, value), tt('saved'))) this.closeDialog();
  }

  private async sendNote(): Promise<void> {
    const t = this.t;
    const text = this.noteText.trim();
    if (!t || !text) return;
    if (await this.run(() => ticketsApi().note(t.id, text, this.noteExternal))) {
      this.noteText = '';
      this.composing = false;
    }
  }

  private async onFiles(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    const t = this.t;
    if (!t || !files.length) return;
    let failed = 0;
    for (const f of files) {
      this.uploading += 1;
      try {
        const next = await ticketsApi().upload(t.id, f, false);
        this.t = next as Detail;
      } catch (err) {
        failed += 1;
        this.say(describeError(err), 'bad');
      } finally {
        this.uploading -= 1;
      }
    }
    if (this.t) this.dispatchEvent(new CustomEvent('ticket-changed', { detail: { ticket: this.t }, bubbles: true, composed: true }));
    if (failed > 1) this.say(tt('photosFailed', { n: failed }), 'bad');
  }

  private removePhoto(attId: string): void {
    const t = this.t;
    if (!t) return;
    void this.run(() => ticketsApi().removePhoto(t.id, attId));
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('drawer-close', { bubbles: true, composed: true }));
  }

  /** Owner 14.10: the ticket was deleted - the drawer closes and the list refreshes (`ticket-gone`); the page returns to the list. */
  private onDeleted = (): void => {
    const id = this.ticketId;
    this.deleting = false;
    this.t = null;
    this.gone = true;
    this.dispatchEvent(new CustomEvent('ticket-gone', { detail: { id, deleted: true }, bubbles: true, composed: true }));
    if (this.mode !== 'page') this.close();
    if (this.mode === 'page') window.location.href = listHref(this.scope);
  };

  private deleteDialog(t: TicketDetail): TemplateResult | typeof nothing {
    if (!t.can.delete) return nothing;
    return html`<tickets-delete-dialog .targets=${[{ id: t.id, number: t.number }]} ?open=${this.deleting}
      @delete-close=${() => (this.deleting = false)} @ticket-deleted=${this.onDeleted}></tickets-delete-dialog>`;
  }

  // ---------------------------------------------------------------- the model of this viewer

  private actions(t: Detail): { role: ReturnType<typeof viewerRole>; primary: DrawerAction | null; quiet: DrawerAction | null; menu: DrawerAction[] } {
    const role = viewerRole(t);
    const primary = primaryAction(t, role);
    const quiet = quietAction(t, role, primary);
    const menu = menuActions(t, role, [primary, quiet], { detailMode: this.detailMode, page: this.mode === 'page' });
    return { role, primary, quiet, menu };
  }

  // ---------------------------------------------------------------- render pieces

  /** The header's second line: number · place · ONE priority chip (IA §5). */
  private subLine(t: TicketDetail): TemplateResult {
    const tone = priorityTone(t.priority);
    const place = t.place_text || [t.department?.name, t.category?.name].filter(Boolean).join(' · ');
    return html`<span class="id" data-ticket-number>#${t.number}</span>
      ${place ? html`<span>·</span><span>${tIcon('layers')} ${bidi(place)}</span>` : nothing}
      ${t.priority ? html`<span class=${`chip ${tone}`} data-chip="priority"><i class=${`dot ${tone === 'bad' ? 'bad' : tone === 'info' ? 'run' : ''}`}></i>${t.priority.name}</span>` : nothing}`;
  }

  private moreButton(): TemplateResult {
    return html`<button type="button" class="rb sm" aria-label=${dwt('more')} aria-haspopup="menu" aria-expanded=${String(this.menu)} data-more
      @click=${() => this.setMenu(!this.menu)}>${tIcon('dots')}</button>`;
  }

  private sizeSwitch(): TemplateResult {
    const b = (s: DrawerSize, icon: 'layers' | 'grid' | 'expand') => html`<button type="button" aria-pressed=${String(this.size === s)} aria-label=${dwt(`size_${s}`)} title=${dwt(`size_${s}`)}
      data-size-btn=${s} @click=${() => this.setSize(s)}>${tIcon(icon)}</button>`;
    return html`<span class="sizes" role="group" aria-label=${dwt('size')}>${b('drawer', 'layers')}${b('wide', 'grid')}${b('full', 'expand')}</span>`;
  }

  private sheetToggle(): TemplateResult {
    const full = this.sheet === 'full';
    return html`<button type="button" class="rb sm" aria-label=${full ? dwt('sheetHalf') : dwt('sheetFull')} aria-pressed=${String(full)} data-sheet-toggle=${this.sheet}
      @click=${() => (this.sheet = full ? 'half' : 'full')}>${tIcon(full ? 'shrink' : 'expand')}</button>`;
  }

  /** The "⋯" menu (top layer): every action not on screen, with the hooks the older specs click (data-move, data-assign, ...). */
  private menuPopover(t: Detail, items: DrawerAction[]): TemplateResult | typeof nothing {
    if (!this.menu) return nothing;
    const firstMove = items.findIndex((a) => a.kind === 'move');
    const row = (a: DrawerAction, i: number): TemplateResult => {
      const head = i === firstMove ? html`<div class="mh" role="presentation">${dwt('moveGroup')}</div>` : nothing;
      const sep = a.kind === 'cancel' || (a.kind === 'delete' && !items.some((x) => x.kind === 'cancel')) ? html`<hr role="separator" />` : nothing;
      const cls = a.tone === 'danger' ? 'dz' : '';
      if (a.kind === 'page') return html`${head}${sep}<a role="menuitem" class=${cls} href=${ticketHref(t.id)} data-menu-item=${a.key} data-full-screen>${tIcon(a.icon)}${a.label}</a>`;
      return html`${head}${sep}<button type="button" role="menuitem" class=${cls} data-menu-item=${a.key} ?disabled=${this.busy}
        data-move=${a.kind === 'move' && a.to ? a.to : nothing}
        ?data-assign=${a.kind === 'assign' || a.kind === 'reassign'} ?data-return=${a.kind === 'return'} ?data-eta-edit=${a.kind === 'eta'} ?data-edit=${a.kind === 'edit'}
        ?data-cancel=${a.kind === 'cancel'} ?data-reopen=${a.kind === 'reopen'} ?data-delete-ticket=${a.kind === 'delete'}
        data-waiting-toggle=${a.kind === 'toggle_wait' ? (a.to === 'waiting_part' ? 'mark' : 'back') : nothing}
        @click=${() => this.onAction(a)}>${tIcon(a.icon)}${a.label}</button>`;
    };
    return html`<div class="pop ov" popover="manual" role="menu" aria-label=${dwt('more')} data-drawer-menu data-nested-open @keydown=${this.onMenuKey}>
      ${items.map(row)}
    </div>`;
  }

  /** slice 5b: the messages to the outside handler (D14 lines, "send now" D29, "send again", "send update") - tickets/ticket-messages.ts */
  private messagesSection(t: Detail): TemplateResult | typeof nothing {
    return messagesBlock(t, { busy: this.busy, act: (fn, done) => void this.run(fn, done) });
  }

  /** The photos: one row in Overview with "+N" (expands in place - never an inner scroll box); add / remove as before. */
  private photosSection(t: TicketDetail): TemplateResult | typeof nothing {
    if (!t.attachments.length && !t.can.attach) return nothing;
    const marks = marksInternal(t);
    const shown = this.photosAll ? t.attachments : t.attachments.slice(0, PHOTO_ROW);
    const more = t.attachments.length - shown.length;
    return html`<section class="sect" data-sect="photos">
      <h4><span class="tag">${tIcon('image')}</span>${tt('sPhotos')}<span class="cnt">${t.attachments.length || ''}</span></h4>
      <div class="photos">
        ${repeat(shown, (a) => a.id, (a, i) => html`<figure class="ph" data-photo=${a.id} style="margin:0">
          <img src=${ticketsApi().photoUrl(a)} alt=${tt('photoAlt', { n: i + 1 })} loading="lazy" decoding="async" />
          ${marks && !a.external ? html`<span class="chip tag">${tIcon('lock')}${tt('internal')}</span>` : nothing}
          ${a.can_delete ? html`<button type="button" class="rm" aria-label=${tt('removePhoto')} data-photo-remove ?disabled=${this.busy} @click=${() => this.removePhoto(a.id)}>${tIcon('trash')}</button>` : nothing}
        </figure>`)}
        ${more > 0 ? html`<button type="button" class="ph photos-more" aria-label=${dwt('photosAll')} data-photos-more @click=${() => (this.photosAll = true)}>${dwt('photosMore', { n: more })}</button>` : nothing}
        ${t.can.attach ? html`<label class="ph add" data-photo-add>${tIcon(this.uploading ? 'clock' : 'camera')}<span>${this.uploading ? tt('uploading') : tt('addPhoto')}</span>
          <input type="file" accept="image/jpeg,image/png" multiple ?disabled=${this.uploading > 0} aria-label=${tt('addPhoto')} @change=${this.onFiles} /></label>` : nothing}
      </div>
    </section>`;
  }

  /** The note composer of the Conversation slot (TKUI2 replaces it with the two composers of IA §4.2). */
  private composer(t: TicketDetail): TemplateResult | typeof nothing {
    if (!t.can.note) return nothing;
    const marks = marksInternal(t);
    if (!this.composing) {
      return html`<div class="side"><button type="button" class="btn sm" data-note-open @click=${() => { this.composing = true; void this.updateComplete.then(() => (this.renderRoot.querySelector('.composer textarea') as HTMLTextAreaElement | null)?.focus()); }}>${tIcon('note')}${tt('note')}</button></div>`;
    }
    return html`<div class="composer" data-composer>
      <textarea class="inp" maxlength="2000" aria-label=${tt('addNote')} placeholder=${tt('notePlaceholder')} .value=${this.noteText} @input=${(e: Event) => (this.noteText = (e.target as HTMLTextAreaElement).value)}></textarea>
      <div class="row">
        ${t.can.note_external && marks ? html`<label class="chk"><input type="checkbox" .checked=${this.noteExternal} @change=${(e: Event) => (this.noteExternal = (e.target as HTMLInputElement).checked)} />${tt('noteExternal')}</label>` : nothing}
        <span class="grow"></span>
        <button type="button" class="btn sm" @click=${() => { this.composing = false; this.noteText = ''; }}>${tt('cancel')}</button>
        <button type="button" class="btn sm primary" data-note-send ?disabled=${this.busy || !this.noteText.trim()} @click=${() => void this.sendNote()}>${tIcon('send')}${tt('send')}</button>
      </div>
    </div>`;
  }

  /** The timeline (newest first). `only` limits it to some kinds (the Conversation slot); `id` anchors the card's "ציר זמן". */
  private timeline(t: TicketDetail, opts: { only?: Set<string>; id?: string; sect: string }): TemplateResult {
    const marks = marksInternal(t);
    const rows = [...t.events].reverse().filter((e) => !opts.only || opts.only.has(e.kind));
    return html`<section class="sect" data-sect=${opts.sect} id=${opts.id ?? nothing}>
      <h4><span class="tag t1">${tIcon('clock')}</span>${tt('sTimeline')}<span class="cnt">${rows.length}</span></h4>
      <ol class="tline" data-timeline>
        ${repeat(rows, (e) => e.id, (e) => {
          const line = messageEventLine(e) ?? eventLine(e, t.department ? { [t.department.id]: t.department.name } : {});
          return html`<li data-kind=${e.kind} data-event=${e.id}>
            <span class="ring">${tIcon(line.icon)}</span>
            <div class="tx">
              <span class="meta">${shortDateTime(e.at)} · ${bidi(actorName(e))}${marks && !e.external && (e.kind === 'note' || e.kind === 'photo') ? html` · <b>${tt('internal')}</b>` : nothing}</span>
              <span class="line">${line.text}</span>
              ${e.body ? html`<div class="body">${e.body}</div>` : nothing}
            </div>
          </li>`;
        })}
      </ol>
    </section>`;
  }

  private flashRow(): TemplateResult | typeof nothing {
    if (!this.flash) return nothing;
    return html`<div class=${`banner flash ${this.flash.tone === 'bad' ? 'bad' : 'info'}`} role=${this.flash.tone === 'bad' ? 'alert' : 'status'} data-flash=${this.flash.tone}>${tIcon(this.flash.tone === 'bad' ? 'warning' : 'check')}<div>${this.flash.text}</div></div>`;
  }

  private overviewCtx(t: Detail): OverviewCtx {
    return {
      now: new Date(),
      busy: this.busy,
      descOpen: this.descOpen,
      onToggleDesc: () => (this.descOpen = !this.descOpen),
      onTab: (tab) => this.selectTab(tab, false),
      onReassign: t.can.assign && t.assignee ? () => this.openDialog({ kind: 'assign' }) : null,
      onEdit: t.can.edit_fields.length ? () => this.openDialog({ kind: 'edit' }) : null,
      duplicateHref: t.duplicate_of ? this.hrefOf(t.duplicate_of.id) : '',
      link: this.linkPanel.render(t),
      photos: this.photosSection(t),
      device: historySection(t.device_context),
    };
  }

  /** The active tab's content - the ONLY tab rendered (one scroll container per tab). */
  private tabContent(t: Detail): TemplateResult {
    switch (this.tab) {
      case 'conv':
        // SLOT (TKUI2): the conversation of IA §4.2 replaces this - the delivery lines, the note composer and the message rows of today
        return html`<div class="one" data-tab-content="conv" data-slot="conv">
          ${this.messagesSection(t)}
          ${this.composer(t)}
          ${this.timeline(t, { only: CONV_KINDS, sect: 'conversation' })}
        </div>`;
      case 'costs':
        // SLOT (TKUI3): the two-stage costs of IA §6.3 replace the claim card of slice 9
        return html`<div class="one" data-tab-content="costs" data-slot="costs">
          ${!t.cost || t.cost.status === 'not_required' ? html`<p class="slot-note" data-costs-empty>${dwt('costsEmpty')}</p>` : nothing}
          <ticket-cost-card .ticket=${t} @cost-changed=${() => void this.load()}></ticket-cost-card>
        </div>`;
      case 'history':
        // SLOT (TKUI2): the timeline, the files and the audit card of IA §4.1 - today's full timeline (the link panel stays under the
        // handler card in Overview until the audit card exists: its copy / new / revoke are actions a manager needs one tap away)
        return html`<div class="one" data-tab-content="history" data-slot="history">
          ${this.timeline(t, { id: 'timeline', sect: 'timeline' })}
        </div>`;
      default:
        return html`${codeLockSection(t, { busy: this.busy, onNew: () => void this.run(() => sendNewLink(t.id), lockText('done')) })}${overviewTab(t, this.overviewCtx(t))}`;
    }
  }

  private panel(t: Detail): TemplateResult {
    return html`<div class="panel stack" role="tabpanel" id=${TAB_PANEL_ID} aria-labelledby=${tabId(this.tab)} tabindex="0"
      data-ticket-detail=${t.id} data-view=${t.view} data-tab-panel=${this.tab}>
      ${this.tabContent(t)}
    </div>`;
  }

  // ---------------------------------------------------------------- dialogs

  private dialogs(): TemplateResult | typeof nothing {
    const d = this.dialog;
    const t = this.t;
    if (!d || !t) return nothing;
    const err = this.dlgError ? html`<div class="err" role="alert" data-dialog-error>${this.dlgError}</div>` : nothing;
    const foot = (ok: TemplateResult) => html`<div slot="footer" class="sheetfoot">${ok}<button type="button" class="btn" data-dialog-cancel @click=${() => this.closeDialog()}>${tt('back')}</button></div>`;
    const text = (label: string, required: boolean) => html`<label class="fld"><span>${label}${required ? html` <b class="req">*</b>` : nothing}</span>
      <textarea class="inp" maxlength="2000" data-dialog-text .value=${this.dlgText} @input=${(e: Event) => { this.dlgText = (e.target as HTMLTextAreaElement).value; this.dlgError = ''; }}></textarea></label>`;
    if (d.kind === 'move') {
      const heading = d.to === 'closed' ? tt('closeTitle') : d.to === 'cancelled' ? tt('cancelTitle') : tt('reopenTitle');
      const label = d.to === 'closed' ? (d.noteRequired ? tt('closeReason') : tt('closeSummary')) : d.to === 'cancelled' ? tt('reason') : tt('reasonOptional');
      const ok = d.to === 'closed' ? tt('closeAction') : d.to === 'cancelled' ? tt('cancelTicket') : tt('reopen');
      return html`<sw-dialog open heading=${heading} data-dialog="move" data-to=${d.to} @close=${this.onDialogClose}>
        <div class="form">${text(label, d.noteRequired || d.to === 'cancelled')}
          ${d.to === 'closed' && this.costGate ? html`<div class="fld" data-cost-gate=${this.costGate.canOverride ? 'override' : 'blocked'}><b>${ct('gateTitle')}</b>
            ${this.costGate.canOverride ? html`<label class="fld"><span>${ct('gateOverride')} - ${ct('gateReason')} <b class="req">*</b></span>
              <textarea class="inp" maxlength="500" data-cost-override .value=${this.dlgOverride} @input=${(e: Event) => { this.dlgOverride = (e.target as HTMLTextAreaElement).value; this.dlgError = ''; }}></textarea></label>` : nothing}</div>` : nothing}
          ${d.to === 'cancelled' ? html`<label class="fld"><span>${tt('duplicateOf')}</span><input class="inp" inputmode="numeric" maxlength="12" data-dialog-number .value=${this.dlgNumber} @input=${(e: Event) => { this.dlgNumber = (e.target as HTMLInputElement).value; this.dlgError = ''; }} /></label>` : nothing}
          ${err}</div>
        ${foot(html`<button type="button" class=${`btn ${d.to === 'cancelled' ? 'danger' : 'primary'}`} data-dialog-ok ?disabled=${this.busy} @click=${() => void this.submitMove(d.to, d.noteRequired)}>${ok}</button>`)}
      </sw-dialog>`;
    }
    if (d.kind === 'assign') {
      // slice 4 + owner 2026-10-14: three groups always shown - handlers, employees without an account, vendors and contacts; a group
      // that cannot be used says why in one line with the link to its setting (tickets/external-assign.ts, tickets/readiness-model.ts)
      // TKSTAFF2: the two handler groups (with / without an account) are ONE picker and ONE submit over the `handlers` list
      const outside = this.ext.outside;
      const count = (staff: boolean) => (this.eligible === null ? null : this.eligible.filter((h) => h.account !== staff).length);
      const rows = this.groupHandlers();
      const groupWhy = this.eligible === null ? null : this.ext.blocked(t, this.ext.kind, rows.length);
      const picked = outside ? null : this.pickedHandler();
      return html`<sw-dialog open heading=${tt('assignTitle')} data-dialog="assign" @close=${this.onDialogClose}>
        <div class="form">
          ${this.ext.renderKinds(t, { user: count(false), employee: count(true) })}
          ${outside ? this.ext.renderPicker(t) : this.eligible === null ? html`<span class="skl" style="block-size:44px"></span>` : rows.length && !groupWhy
            ? html`<div class="pick" role="radiogroup" aria-label=${tt('fAssignee')}>${rows.map((h) => html`<label data-eligible=${h.id} data-handler=${h.key}>
                <input type="radio" name="asg" .checked=${this.dlgPick === h.key} @change=${() => { this.dlgPick = h.key; this.dlgError = ''; }} />${bidi(h.name)}
                ${h.member_role === 'manager' ? html`<small>${tt('depManager')}</small>` : nothing}</label>`)}</div>`
            : html`<div data-eligible-none>${groupWhy ? this.ext.reasonLine(groupWhy) : nothing}</div>`}
          ${text(tt('assignNote'), false)}
          ${outside || (picked && !picked.account) || marksInternal(t) ? html`<label class="chk"><input type="checkbox" .checked=${this.dlgFlag} @change=${(e: Event) => (this.dlgFlag = (e.target as HTMLInputElement).checked)} />${tt('noteExternal')}</label>` : nothing}
          ${err}</div>
        ${foot(html`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy || (outside ? !this.ext.ready() : !picked)} @click=${() => void this.submitAssign()}>${tIcon('user')}${tt('assign')}</button>`)}
      </sw-dialog>`;
    }
    if (d.kind === 'return') {
      return html`<sw-dialog open heading=${tt('returnTitle')} data-dialog="return" @close=${this.onDialogClose}>
        <div class="form">
          <div class="seg" role="radiogroup" aria-label=${tt('returnTitle')}>
            ${(['cannot_handle', 'not_mine'] as const).map((k) => html`<button type="button" role="radio" aria-checked=${String(this.dlgReturnKind === k)} data-return-kind=${k} @click=${() => (this.dlgReturnKind = k)}>${k === 'not_mine' ? tt('returnNotMine') : tt('returnCannot')}</button>`)}
          </div>
          ${text(tt('reason'), true)}
          ${err}</div>
        ${foot(html`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${() => void this.submitReturn()}>${tIcon('refresh')}${tt('giveBack')}</button>`)}
      </sw-dialog>`;
    }
    if (d.kind === 'eta') {
      return html`<sw-dialog open heading=${tt('etaTitle')} data-dialog="eta" @close=${this.onDialogClose}>
        <div class="form"><label class="fld"><span>${tt('etaSet')}</span><input class="inp" type="datetime-local" data-dialog-eta .value=${this.dlgText} @input=${(e: Event) => { this.dlgText = (e.target as HTMLInputElement).value; this.dlgError = ''; }} /></label>${err}</div>
        <div slot="footer" class="sheetfoot">
          <button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${() => void this.submitEta(false)}>${tt('save')}</button>
          ${t.eta_at ? html`<button type="button" class="btn" data-eta-clear ?disabled=${this.busy} @click=${() => void this.submitEta(true)}>${tt('etaClear')}</button>` : nothing}
          <button type="button" class="btn" data-dialog-cancel @click=${() => this.closeDialog()}>${tt('back')}</button>
        </div>
      </sw-dialog>`;
    }
    if (d.kind === 'edit' && this.edit) {
      const e = this.edit;
      const can = new Set(t.can.edit_fields);
      const depts = (this.meta?.departments ?? []).filter((x) => x.can_manage || x.id === t.department?.id);
      const dept = this.meta?.departments.find((x) => x.id === e.department_id);
      const set = (patch: Partial<EditForm>) => { this.edit = { ...e, ...patch }; this.dlgError = ''; };
      return html`<sw-dialog open wide heading=${tt('editTitle')} data-dialog="edit" @close=${this.onDialogClose}>
        <div class="form">
          <label class="fld"><span>${tt('fTitle')} <b class="req">*</b></span><input class="inp" maxlength="120" data-edit-title .value=${e.title} ?disabled=${!can.has('title')} @input=${(ev: Event) => set({ title: (ev.target as HTMLInputElement).value })} /></label>
          <label class="fld"><span>${tt('fDescription')}</span><textarea class="inp" maxlength="4000" data-edit-description .value=${e.description} ?disabled=${!can.has('description')} @input=${(ev: Event) => set({ description: (ev.target as HTMLTextAreaElement).value })}></textarea></label>
          ${can.has('department_id') || can.has('category_id') || can.has('priority_id') ? html`<div class="two">
            ${can.has('department_id') && depts.length > 1 ? html`<label class="fld"><span>${tt('fDepartment')}</span><select class="inp" data-edit-department @change=${(ev: Event) => set({ department_id: (ev.target as HTMLSelectElement).value, category_id: '', priority_id: '' })}>${depts.map((x) => html`<option value=${x.id} ?selected=${x.id === e.department_id}>${x.name}</option>`)}</select></label>` : nothing}
            ${can.has('category_id') && dept ? html`<label class="fld"><span>${tt('fCategory')}</span><select class="inp" data-edit-category @change=${(ev: Event) => set({ category_id: (ev.target as HTMLSelectElement).value })}><option value="" ?selected=${!e.category_id}>${tt('fNoCategory')}</option>${dept.categories.map((c) => html`<option value=${c.id} ?selected=${c.id === e.category_id}>${c.name}</option>`)}</select></label>` : nothing}
          </div>` : nothing}
          ${can.has('priority_id') && dept ? html`<div class="fld"><span>${tt('fPriority')}</span><div class="prio" role="radiogroup" aria-label=${tt('fPriority')}>${dept.priorities.map((p) => html`<button type="button" class="rc" role="radio" aria-checked=${String(p.id === e.priority_id)} data-edit-priority=${p.key} @click=${() => set({ priority_id: p.id })}><i class=${`dot ${priorityTone(p) === 'bad' ? 'bad' : priorityTone(p) === 'info' ? 'run' : ''}`}></i>${p.name}</button>`)}</div></div>` : nothing}
          ${err}</div>
        ${foot(html`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${() => void this.submitEdit()}>${tIcon('check')}${tt('save')}</button>`)}
      </sw-dialog>`;
    }
    return nothing;
  }

  // ---------------------------------------------------------------- the two hosts

  private hrefOf(id: string): string {
    return this.detailMode === 'fullscreen' || this.mode === 'page' ? ticketHref(id) : listHref(this.scope, undefined, { t: id });
  }

  private stateBox(): TemplateResult {
    if (this.gone) return html`<div class="statebox glass" role="status" data-ticket-state="gone"><span class="ring">${tIcon('ticket')}</span><b>${tt('notFound')}</b></div>`;
    if (this.failed) return html`<div class="statebox glass" role="status" data-ticket-state="error"><span class="ring">${tIcon('warning')}</span><b>${this.failed}</b><button type="button" class="btn sm" @click=${() => { this.failed = ''; void this.load(); }}>${tIcon('refresh')}${tt('retry')}</button></div>`;
    // IA §5: a skeleton of the header + status block + three rows, never a spinner alone
    return html`<div class="stack" data-ticket-state="loading" aria-busy="true"><span class="skl" style="block-size:96px"></span><span class="skl" style="block-size:44px"></span><span class="skl" style="block-size:64px"></span><span class="skl" style="block-size:64px"></span><span class="skl" style="block-size:64px"></span></div>`;
  }

  private drawer(): TemplateResult {
    const t = this.t;
    const half = this.phone && this.sheet === 'half';
    const width = this.phone ? '100vw' : SIZE_WIDTH[this.size];
    const sheetH = this.phone && !half ? '100dvh' : 'auto';
    const style = `--sw-drawer-modal-w:${width};--sw-drawer-sheet-h:${sheetH};--sw-drawer-sheet-max-h:${this.phone && !half ? '100dvh' : '88dvh'}`;
    const m = t ? this.actions(t) : null;
    const now = new Date();
    return html`<sw-drawer modal .open=${this.open} heading=${t?.title ?? ''} style=${style} data-ticket-drawer data-size=${this.phone ? 'phone' : this.size} data-sheet=${this.phone ? this.sheet : nothing}
      @close=${(e: Event) => { if (e.target === e.currentTarget) this.close(); }}>
      ${t ? html`<span slot="sub" class="hsub">${this.subLine(t)}</span>` : nothing}
      ${t ? html`<span slot="action" class="hacts">${this.phone ? this.sheetToggle() : this.sizeSwitch()}${this.moreButton()}</span>` : nothing}
      ${t && m ? html`<div slot="strip" class="strip">
        ${statusBlock(t, { role: m.role, now, busy: this.busy, primary: m.primary, quiet: m.quiet, onAction: this.onAction })}
        ${half ? nothing : drawerTabs(tabItems(t), this.tab, (id, focus) => this.selectTab(id, focus))}
      </div>` : nothing}
      ${this.flashRow()}
      ${!t ? this.stateBox() : half
        ? html`<div class="half" data-ticket-detail=${t.id} data-half-sheet>${nowSection(t, this.overviewCtx(t))}
            <button type="button" class="btn quiet" data-show-all @click=${() => (this.sheet = 'full')}>${tIcon('expand')}${dwt('showAll')}</button></div>`
        : this.panel(t)}
      ${t && m ? this.menuPopover(t, m.menu) : nothing}
      ${this.dialogs()}
      ${t ? this.deleteDialog(t) : nothing}
    </sw-drawer>`;
  }

  private page(): TemplateResult {
    const t = this.t;
    if (!t) return html`<div class="page"><div class="phead"><a class="rb sm" href=${listHref(this.scope)} aria-label=${tt('toList')} data-back>${tIcon('back')}</a></div>${this.stateBox()}</div>`;
    const m = this.actions(t);
    return html`<div class="page" data-ticket-page=${t.id}>
      <div class="phead">
        <a class="rb sm" href=${listHref(this.scope)} aria-label=${tt('toList')} data-back>${tIcon('back')}</a>
        <div class="tt"><h1 data-ticket-title>${t.title}</h1><div class="hsub">${this.subLine(t)}</div></div>
        <div class="acts">
          ${this.detailMode === 'drawer_fullscreen' ? html`<a class="btn sm quiet" href=${listHref(this.scope, undefined, { t: t.id })} data-to-drawer>${tIcon('shrink')}${dwt('a_toDrawer')}</a>` : nothing}
          ${this.moreButton()}
        </div>
      </div>
      ${this.flashRow()}
      <div class="glass hero">${statusBlock(t, { role: m.role, now: new Date(), busy: this.busy, primary: m.primary, quiet: m.quiet, onAction: this.onAction })}</div>
      <div class="glass tabcard">
        ${drawerTabs(tabItems(t), this.tab, (id, focus) => this.selectTab(id, focus))}
        ${this.panel(t)}
      </div>
      ${this.menuPopover(t, m.menu)}
      ${this.dialogs()}
      ${this.deleteDialog(t)}
    </div>`;
  }

  protected updated(): void {
    this.placeMenu();
  }

  render() {
    return this.mode === 'page' ? this.page() : this.drawer();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-detail': TicketDetailView;
  }
}
