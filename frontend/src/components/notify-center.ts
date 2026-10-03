import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import {
  CATEGORY_LABEL, DOOR_OPEN_IDLE, centerBanners, centerPresentation, doorOpenQuestion, hasDeliveryProblem, layoutInbox, notify, reduceDoorOpen, runDoorOpen,
  type Category, type DoorOpenState, type InboxFilter, type Notification,
} from '../api/notifications';
import { mediaGlassStyles } from '../styles/media-glass';
import { nIcon } from './notify-icons';
import { notifyControls, notifyKnobs } from './notify-css';
import { filterCounts, sourceOptions, subtitleText, visibleRows } from './notify-logic';
import { applyNotifyGlass, notifyStore, type NotifyState } from './notify-store';
import './notify-row';
import './notify-detail';
import type { RowAction } from './notify-row';
import type { DetailAction } from './notify-detail';

const SETTINGS_HREF = '#/system/notifications';

/**
 * CR-018 / CR §6.1: the notification center. Opened from the user menu's bell; desktop: a glass sheet at the content's start edge (the administrator's
 * `notify.center_layout` = 'sheet', the default) or a full screen ('page'); phone: a full-height bottom sheet. Rows grouped by day with the open critical
 * rows pinned on top, folded repeats with counts, read / unread, snooze, acknowledge, the filters (all / unread / critical + a source filter), the row menu,
 * the detail view with its door confirmation (CR §9: "פתח דלת" opens the in-app dialog only; nothing is sent until the signed-in user confirms) and the states
 * loading / empty / error with the banners quiet hours, push unavailable on this device and delivery failed. The data and the actions live in the store
 * (notify-store.ts); this element only presents them. Events: `close`, `navigate` {href}.
 */
@customElement('notify-center')
export class NotifyCenter extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  /** A deep link (#/doors/<id>?confirm=<notification id>): the row whose detail opens first. */
  @property() focusId = '';
  /** Open the door confirmation of `focusId` as soon as the row is loaded (the push button "פתח דלת"). */
  @property({ type: Boolean }) confirmDoor = false;
  @state() private st: NotifyState = notifyStore.state;
  @state() private filter: InboxFilter = 'all';
  @state() private category: Category | null = null;
  @state() private srcMenu = false;
  @state() private detailId: string | null = null;
  @state() private door: DoorOpenState = DOOR_OPEN_IDLE;
  @state() private doorWho = '';
  @state() private toast: { text: string; bad: boolean } | null = null;
  @state() private phone = false;
  private phoneMq = window.matchMedia('(max-width: 767px)');
  private stop: (() => void) | null = null;
  private tickTimer = 0;
  private toastTimer = 0;
  private deepDone = false;

  static styles = [
    ...mediaGlassStyles,
    notifyKnobs,
    notifyControls,
    css`
      :host {
        position: fixed;
        inset: 0;
        z-index: var(--sw-z-modal);
        pointer-events: none;
        visibility: hidden;
        transition: visibility 0s linear var(--mm-motion);
        font-family: var(--dv-font);
        color: var(--dv-text);
        font-size: 14px;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }
      :host([open]) {
        pointer-events: auto;
        visibility: visible;
        transition: none;
      }
      .scrim {
        position: absolute;
        inset: 0;
        background: transparent;
      }
      :host([data-phone]) .scrim {
        background: var(--dv-overlay);
        opacity: 0;
        transition: opacity var(--mm-motion) var(--mm-ease);
      }
      :host([data-phone][open]) .scrim {
        opacity: 1;
      }
      .panel {
        position: absolute;
        inset-block: 12px;
        inset-inline-start: calc(var(--sw-rail-w, 86px) + 12px);
        inline-size: var(--nt-sheet-w);
        background: var(--mm-sheen), var(--mm-sheet-surface);
        -webkit-backdrop-filter: var(--mm-sheet-blur);
        backdrop-filter: var(--mm-sheet-blur);
        border: 1px solid var(--dv-border);
        border-radius: var(--dv-radius-lg);
        box-shadow: var(--dv-shadow-3);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        isolation: isolate;
        outline: none;
        opacity: 0;
        transform: translateX(32px);
        transition: opacity var(--mm-motion) var(--mm-ease), transform 300ms var(--mm-ease);
      }
      :host([open]) .panel {
        opacity: 1;
        transform: none;
      }
      /* the full-screen presentation of a wide screen (notify.center_layout = 'page'): the content column beside the rail */
      :host([data-presentation='page']) .panel {
        inset-block: 0;
        inset-inline: var(--sw-rail-w, 86px) 0;
        inline-size: auto;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        background: var(--dv-backdrop);
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        transform: translateY(14px);
      }
      :host([data-presentation='page']) .inner {
        inline-size: min(760px, 100%);
        margin-inline: auto;
        padding-block-start: 10px;
      }
      /* the phone: a full-height bottom sheet */
      :host([data-presentation='bottom_sheet']) .panel {
        inset: auto 0 0 0;
        inline-size: auto;
        block-size: calc(100% - 20px);
        border-radius: 28px 28px 0 0;
        border-block-end: 0;
        transform: translateY(56px);
        padding-block-end: env(safe-area-inset-bottom, 0px);
      }
      :host([open][data-presentation='bottom_sheet']) .panel {
        transform: none;
      }
      :host([open][data-presentation='page']) .panel {
        transform: none;
      }
      .inner {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-block-size: 0;
        inline-size: 100%;
      }
      .grab {
        display: none;
        inline-size: 40px;
        block-size: 5px;
        border-radius: 3px;
        background: var(--dv-border-strong);
        margin: 8px auto 0;
        flex: none;
      }
      :host([data-presentation='bottom_sheet']) .grab {
        display: block;
      }
      .nh {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 18px 18px 10px;
        flex: none;
      }
      :host([data-presentation='bottom_sheet']) .nh {
        padding: 8px 16px;
      }
      .nh .tx {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.25;
      }
      .nh h3 {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.025em;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .nh h3 .cnt {
        display: inline-grid;
        place-items: center;
        min-inline-size: 26px;
        block-size: 26px;
        padding: 0 8px;
        border-radius: 13px;
        background: var(--dv-accent);
        color: #fff;
        font-size: 12.5px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .nh small {
        font-size: 12.5px;
        color: var(--dv-text-2);
      }
      .nh .crumb {
        font-size: 14px;
        color: var(--dv-text-2);
      }
      .nh .x,
      .nh .back {
        inline-size: 44px;
        block-size: 44px;
        border-radius: 50%;
        border: 0;
        background: var(--dv-surface-3);
        display: grid;
        place-items: center;
        color: var(--dv-text);
        flex: none;
      }
      .nh .back {
        border: 1px solid var(--dv-border);
        background: var(--mm-sheen), var(--dv-surface);
        box-shadow: var(--dv-shadow-control);
      }
      .nh .x .ic,
      .nh .back .ic {
        font-size: 17px;
      }
      .nbars {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 0 16px 8px;
        flex: none;
      }
      .nfilt {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 16px 12px;
        flex: none;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .nfilt::-webkit-scrollbar {
        display: none;
      }
      .nfilt .seg {
        flex: none;
      }
      .srcbtn {
        position: relative;
        flex: none;
      }
      .srcbtn .rc .ic:last-child {
        font-size: 14px;
        transition: transform var(--mm-motion) var(--mm-ease);
      }
      .srcbtn .rc[aria-expanded='true'] .ic:last-child {
        transform: rotate(180deg);
      }
      .srcbtn .pop {
        inset-block-start: calc(100% + 6px);
        inset-inline-end: 0;
        min-inline-size: 250px;
        background: var(--mm-sheet-surface);
        -webkit-backdrop-filter: var(--mm-sheet-blur);
        backdrop-filter: var(--mm-sheet-blur);
      }
      .nbody {
        flex: 1;
        overflow: auto;
        padding: 0 10px 18px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        scrollbar-width: thin;
        overscroll-behavior: contain;
      }
      .nbody > * {
        flex-shrink: 0;
      }
      .gh {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 10px 6px;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--dv-text-3);
        letter-spacing: 0.02em;
      }
      .gh:first-child {
        padding-block-start: 4px;
      }
      .gh i {
        flex: 1;
        block-size: 1px;
        background: var(--dv-border);
      }
      .gh.pin {
        color: var(--nt-sev-critical);
      }
      .gh .ic {
        font-size: 14px;
      }
      .more-btn {
        align-self: center;
        margin-block-start: 8px;
      }
      .nfoot {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px 14px;
        border-block-start: 1px solid var(--dv-border);
        flex: none;
      }
      :host([data-presentation='bottom_sheet']) .nfoot {
        padding-block-end: 16px;
      }
      .nfoot .btn {
        flex: 1;
      }
      .skrow {
        display: grid;
        grid-template-columns: 4px 40px minmax(0, 1fr);
        gap: 12px;
        align-items: center;
        min-block-size: var(--nt-row-min);
        padding: 10px 10px;
      }
      .skrow .skl:first-child {
        block-size: 48px;
        border-radius: 4px;
      }
      .skrow .skl:nth-child(2) {
        inline-size: 40px;
        block-size: 40px;
        border-radius: 50%;
      }
      .skrow .ln {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .skrow .ln .skl {
        block-size: 12px;
      }
      .statebox {
        padding-block: 56px;
      }
      /* the door confirmation (CR §9) is a sibling of the sheet: a fixed element inside a backdrop-filtered parent would be clipped by it */
      .dlgwrap {
        position: absolute;
        inset: 0;
        z-index: 5;
        display: grid;
        place-items: center;
        background: var(--dv-overlay);
        padding: 16px;
      }
      .dlg {
        inline-size: min(400px, 100%);
        background: var(--mm-sheet-surface);
        -webkit-backdrop-filter: var(--mm-sheet-blur);
        backdrop-filter: var(--mm-sheet-blur);
        border: 1px solid var(--dv-border);
        border-radius: var(--dv-radius-lg);
        box-shadow: var(--dv-shadow-3);
        padding: 22px 22px 18px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        animation: mm-pop var(--mm-motion) var(--mm-ease);
      }
      .dlg .dh3 {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .dlg .dh3 .ring {
        inline-size: 46px;
        block-size: 46px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--dv-warning-soft);
        color: var(--dv-warning);
        font-size: 22px;
        flex: none;
      }
      .dlg .dh3 .ring.ok {
        background: var(--dv-success-soft);
        color: var(--dv-success);
      }
      .dlg .dh3 .ring.bad {
        background: var(--dv-danger-soft);
        color: var(--dv-danger);
      }
      .dlg h3 {
        margin: 0;
        font-size: 17.5px;
        font-weight: 700;
        letter-spacing: -0.01em;
        line-height: 1.3;
      }
      .dlg .who {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12.5px;
        color: var(--dv-text-2);
      }
      .dlg .who .ic {
        font-size: 14px;
        color: var(--dv-success);
      }
      .dlg .acts {
        display: flex;
        gap: 8px;
      }
      .dlg .acts .btn {
        flex: 1;
        min-block-size: 46px;
      }
      .toast {
        position: absolute;
        z-index: 8;
        inset-inline: 0;
        margin-inline: auto;
        inline-size: max-content;
        max-inline-size: calc(100% - 24px);
        inset-block-end: 78px;
        background: rgba(28, 28, 30, 0.88);
        -webkit-backdrop-filter: var(--sw-perf-blur, blur(20px));
        backdrop-filter: var(--sw-perf-blur, blur(20px));
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
      .toast.bad .ic {
        color: #ff6961;
      }
      @media (prefers-reduced-motion: reduce) {
        .panel {
          transition: none;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    void applyNotifyGlass(this);
    this.phone = this.phoneMq.matches;
    this.phoneMq.addEventListener('change', this.onMq);
    this.stop = notifyStore.subscribe((s) => (this.st = s));
    this.st = notifyStore.state;
    window.addEventListener('keydown', this.onKey);
  }
  disconnectedCallback() {
    this.phoneMq.removeEventListener('change', this.onMq);
    window.removeEventListener('keydown', this.onKey);
    this.stop?.();
    window.clearInterval(this.tickTimer);
    window.clearTimeout(this.toastTimer);
    super.disconnectedCallback();
  }
  private onMq = () => (this.phone = this.phoneMq.matches);

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('open')) {
      if (this.open) {
        void applyNotifyGlass(this); // the installation's scheme (devices.scheme): the element exists before the session is known
        this.filter = 'all';
        this.category = null;
        this.srcMenu = false;
        this.detailId = null;
        this.door = DOOR_OPEN_IDLE;
        this.deepDone = false;
        void notifyStore.load();
        window.clearInterval(this.tickTimer);
        this.tickTimer = window.setInterval(() => notifyStore.tick(), 30_000);
      } else {
        window.clearInterval(this.tickTimer);
      }
    }
    // the deep link of a push (#/doors/<id>?confirm=<notification id>): the row's detail, and the door confirmation when asked for
    if (this.open && this.focusId && !this.deepDone && this.st.phase === 'ready') {
      this.deepDone = true;
      const row = this.st.rows.find((n) => n.id === this.focusId);
      if (!row) this.say('ההתראה כבר לא זמינה', true);
      else {
        this.detailId = row.id;
        if (this.confirmDoor) this.door = reduceDoorOpen(DOOR_OPEN_IDLE, { type: 'press', notification: row });
      }
    }
  }
  protected updated(changed: Map<string, unknown>) {
    this.toggleAttribute('data-phone', this.phone);
    this.setAttribute('data-presentation', centerPresentation({ center_layout: this.st.layout }, this.phone));
    if (changed.has('open') && this.open) requestAnimationFrame(() => this.renderRoot.querySelector<HTMLElement>('.panel')?.focus({ preventScroll: true }));
    if (changed.has('door') && this.door.phase === 'confirm') void notifyStore.me().then((n) => (this.doorWho = n));
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.open || e.key !== 'Escape') return;
    e.stopPropagation();
    if (this.door.phase === 'confirm' || this.door.phase === 'step_up') this.door = reduceDoorOpen(this.door, { type: 'cancel' });
    else if (this.door.phase === 'done' || this.door.phase === 'failed') this.door = reduceDoorOpen(this.door, { type: 'dismiss' });
    else if (this.door.phase === 'sending') return; // a command is on its way: nothing closes it
    else if (this.srcMenu) this.srcMenu = false;
    else if (this.detailId) this.detailId = null;
    else this.close();
  };

  private close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }
  private go(href: string) {
    this.dispatchEvent(new CustomEvent('navigate', { detail: { href }, bubbles: true, composed: true }));
  }
  private say(text: string, bad = false) {
    this.toast = { text, bad };
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = null), 3500);
  }
  private row(id: string | null): Notification | undefined {
    return id ? this.st.rows.find((n) => n.id === id) : undefined;
  }

  // ---------------------------------------------------------------------------------------------- actions

  private openRow(id: string) {
    this.detailId = id;
    const n = this.row(id);
    if (n && n.me.read_at === null) void notifyStore.read(id);
  }
  private async doAction(id: string, action: RowAction | DetailAction) {
    const n = this.row(id);
    if (!n) return;
    if (action === 'read') return void notifyStore.read(id);
    if (action === 'open') {
      if (n.me.read_at === null) void notifyStore.read(id);
      if (n.link) this.go(n.link);
      return;
    }
    if (action === 'door') {
      this.door = reduceDoorOpen(this.door, { type: 'press', notification: n });
      return;
    }
    const err = action === 'ack' ? await notifyStore.ack(id) : await notifyStore.snooze(id, action === 'snooze' ? 60 : 'until_morning');
    if (err) this.say(err, true);
    else this.say(action === 'ack' ? 'ההתראה אושרה' : action === 'snooze' ? 'הושתק לשעה' : 'הושתק עד הבוקר');
  }

  private async doorConfirm() {
    this.door = reduceDoorOpen(this.door, { type: 'confirm' });
    await this.doorRun();
  }
  private async doorRun() {
    const done = await runDoorOpen(notify(), this.door, (s) => (this.door = s));
    this.door = done;
  }
  private async doorStepUp() {
    // CR-011's step-up sheet is not part of the frontend yet: the request goes out as an event (the future sheet answers it); the demo's mock completes it itself
    window.dispatchEvent(new CustomEvent('sw-step-up-needed', { detail: { origin: 'notification' } }));
    if (!(await import('../api/session')).isApi()) (await import('../api/notifications-mock')).notifyMock().completeStepUp();
    this.door = reduceDoorOpen(this.door, { type: 'step_up_done' });
    await this.doorRun();
  }

  // ---------------------------------------------------------------------------------------------- render

  private renderDoorDialog() {
    const d = this.door;
    if (d.phase === 'idle' || !d.door) return nothing;
    const name = d.door.name;
    const sending = d.phase === 'sending';
    let ring = 'doorOpen';
    let ringCls = '';
    let head = doorOpenQuestion(name);
    let body: unknown = html`<div class="who">${nIcon('check')}מחובר כ־${this.doorWho || '—'} · הפתיחה נרשמת ביומן</div>`;
    let acts: unknown = html`<button type="button" class="btn quiet" data-door-cancel @click=${() => (this.door = reduceDoorOpen(d, { type: 'cancel' }))}>ביטול</button>
      <button type="button" class="btn door" data-door-confirm ?disabled=${sending} @click=${() => void this.doorConfirm()}>${nIcon(sending ? 'refresh' : 'doorOpen')}${sending ? 'פותח…' : 'פתח דלת'}</button>`;
    if (d.phase === 'step_up') {
      head = 'נדרש אימות נוסף';
      ring = 'lock';
      body = nothing;
      acts = html`<button type="button" class="btn quiet" data-door-cancel @click=${() => (this.door = reduceDoorOpen(d, { type: 'cancel' }))}>ביטול</button>
        <button type="button" class="btn door" data-door-stepup @click=${() => void this.doorStepUp()}>${nIcon('shield')}אימות</button>`;
    } else if (d.phase === 'done' || d.phase === 'failed') {
      const ok = d.phase === 'done';
      head = d.text ?? '';
      ring = ok ? 'check' : 'warning';
      ringCls = ok ? 'ok' : 'bad';
      body = nothing;
      acts = html`<button type="button" class="btn" data-door-close @click=${() => (this.door = reduceDoorOpen(d, { type: 'dismiss' }))}>סגור</button>`;
    }
    return html`<div class="dlgwrap" data-door-dialog=${d.phase} @click=${(e: Event) => { if (e.target === e.currentTarget && (d.phase === 'confirm' || d.phase === 'step_up')) this.door = reduceDoorOpen(d, { type: 'cancel' }); }}>
      <div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="door-h">
        <div class="dh3"><span class=${classMap({ ring: true, [ringCls]: !!ringCls })}>${nIcon(ring)}</span><h3 id="door-h" data-door-text>${head}</h3></div>
        ${body}<div class="acts">${acts}</div>
      </div></div>`;
  }

  /** "המסירה לטלפון נכשלה · התראה אחת / 3 התראות" (the contract helper's text reads "1 התראות"). */
  private failedText(): string {
    const n = this.st.rows.filter(hasDeliveryProblem).length;
    return `המסירה לטלפון נכשלה · ${n === 1 ? 'התראה אחת' : `${n} התראות`}`;
  }

  private renderBanners() {
    const s = this.st;
    const list = centerBanners({ settings: s.settings, now: s.now, tz: s.tz, support: s.support, registeredHere: s.registeredHere, rows: s.rows });
    if (!list.length) return nothing;
    return html`<div class="nbars" data-center-banners>${list.map((b) => html`<div class="bnr ${b.kind}" data-banner=${b.kind}>${nIcon(b.kind === 'quiet' ? 'moon' : b.kind === 'push' ? 'bellOff' : 'warning')}<span>${b.kind === 'failed' ? this.failedText() : b.text}</span>
      ${b.kind === 'push' ? html`<button type="button" class="btn sm" data-banner-act @click=${() => this.go(SETTINGS_HREF)}>איך מפעילים</button>` : nothing}
      ${b.kind === 'failed' ? html`<button type="button" class="btn sm" data-banner-act @click=${() => this.go(`${SETTINGS_HREF}?section=log`)}>פרטים</button>` : nothing}</div>`)}</div>`;
  }

  private renderFilters() {
    const s = this.st;
    const c = filterCounts(s.rows, s.now);
    const opts = sourceOptions(s.rows);
    const seg = (f: InboxFilter, label: string, n?: number) => html`<button type="button" data-filter=${f} aria-pressed=${String(this.filter === f)} @click=${() => (this.filter = f)}>${label}${n !== undefined && n > 0 ? html`<small class="n">${n}</small>` : nothing}</button>`;
    return html`<div class="nfilt" data-center-filters>
      <div class="seg" role="group" aria-label="סינון">${seg('all', 'הכל')}${seg('unread', 'לא נקראו', c.unread)}${seg('critical', 'קריטי', c.critical)}</div>
      <div class="srcbtn"><button type="button" class=${classMap({ rc: true, on: this.category !== null })} data-source-filter aria-haspopup="menu" aria-expanded=${String(this.srcMenu)} @click=${() => (this.srcMenu = !this.srcMenu)}>${nIcon('filter')}${this.category ? CATEGORY_LABEL[this.category] : 'מקור'}${nIcon('chevronDown')}</button>
        ${this.srcMenu ? html`<div class="pop" role="menu" data-source-menu>
          <button type="button" role="menuitemradio" aria-checked=${String(this.category === null)} data-source-opt="all" @click=${() => { this.category = null; this.srcMenu = false; }}>${nIcon('list')}כל המקורות<span class="cnt n">${s.rows.length}</span></button>
          ${opts.map((o) => html`<button type="button" role="menuitemradio" aria-checked=${String(this.category === o.category)} data-source-opt=${o.category} @click=${() => { this.category = o.category; this.srcMenu = false; }}>${nIcon(o.icon)}${o.label}<span class="cnt n">${o.count}</span></button>`)}
        </div>` : nothing}</div>
    </div>`;
  }

  private renderList() {
    const s = this.st;
    if (s.phase === 'loading' || s.phase === 'idle') {
      return html`<div class="nbody" data-center-state="loading" aria-busy="true">${[0, 1, 2, 3, 4].map(() => html`<div class="skrow"><span class="skl"></span><span class="skl"></span><span class="ln"><span class="skl" style="inline-size:55%"></span><span class="skl" style="inline-size:35%"></span></span></div>`)}</div>`;
    }
    if (s.phase === 'error') {
      return html`<div class="nbars" data-center-state="error"><div class="errbar" role="alert">${nIcon('warning')}<span>${s.error || 'לא ניתן לטעון התראות'}</span><button type="button" class="btn sm" data-center-retry @click=${() => void notifyStore.load()}>${nIcon('refresh')}נסה שוב</button></div></div>`;
    }
    const rows = visibleRows(s.rows, this.filter, this.category, s.now);
    if (!rows.length) {
      const empty = s.rows.length === 0;
      return html`<div class="nbody" data-center-state="empty"><div class="statebox"><span class="ring">${nIcon(empty ? 'bell' : 'filter', 32)}</span><b>אין התראות</b>${empty ? html`<p>${s.settings ? `${s.settings.retention_days} הימים האחרונים` : 'הכול רגוע'}</p>` : nothing}</div></div>`;
    }
    const lay = layoutInbox(rows, s.now, s.tz);
    const row = (n: Notification) => html`<notify-row .n=${n} .now=${s.now} .tz=${s.tz} .areas=${s.areas} ?selected=${this.detailId === n.id} @row-open=${(e: CustomEvent<{ id: string }>) => this.openRow(e.detail.id)} @row-action=${(e: CustomEvent<{ id: string; action: RowAction }>) => void this.doAction(e.detail.id, e.detail.action)}></notify-row>`;
    return html`<div class="nbody" data-center-state="ready" data-center-list>
      ${lay.pinned.length ? html`<div class="gh pin" data-group="pinned">${nIcon('siren')}דורש אישור<i></i></div>${lay.pinned.map(row)}` : nothing}
      ${lay.days.map((g) => html`<div class="gh" data-group=${g.key}><span>${g.label}</span><i></i></div>${g.rows.map(row)}`)}
      ${s.nextBefore ? html`<button type="button" class="btn sm more-btn" data-center-more @click=${() => void notifyStore.loadMore()}>טען עוד</button>` : nothing}
    </div>`;
  }

  private renderListView() {
    const s = this.st;
    const c = filterCounts(s.rows, s.now);
    const err = s.phase === 'error';
    return html`
      <div class="nh"><div class="tx"><h3>התראות${s.phase === 'ready' && c.unread > 0 ? html`<span class="cnt n" data-center-unread>${c.unread}</span>` : nothing}</h3>${s.phase === 'ready' ? html`<small data-center-sub>${subtitleText(s.rows.length, s.settings?.retention_days ?? null)}</small>` : nothing}</div>
        <button type="button" class="btn quiet sm" data-center-readall ?disabled=${err || c.unread === 0} @click=${() => void notifyStore.readAll()}>${nIcon('checkAll')}הכל נקרא</button>
        <button type="button" class="x" data-center-close aria-label="סגור" title="סגור" @click=${() => this.close()}>${nIcon('close')}</button></div>
      ${this.renderBanners()}
      ${this.renderFilters()}
      ${this.renderList()}
      <div class="nfoot"><button type="button" class="btn full" data-center-settings @click=${() => this.go(SETTINGS_HREF)}>${nIcon('settings')}הגדרות התראות</button></div>`;
  }

  private renderDetailView(n: Notification) {
    const s = this.st;
    return html`
      <div class="nh"><button type="button" class="back" data-detail-back aria-label="חזרה לרשימה" title="חזרה" @click=${() => (this.detailId = null)}>${nIcon('chevronBack')}</button>
        <span class="crumb tx" data-detail-crumb>${CATEGORY_LABEL[n.category]}</span>
        <button type="button" class="x" data-center-close aria-label="סגור" title="סגור" @click=${() => this.close()}>${nIcon('close')}</button></div>
      <notify-detail .n=${n} .now=${s.now} .tz=${s.tz} .areas=${s.areas} .esc=${s.settings?.escalation ?? null} .snapshot=${n.has_snapshot ? notify().snapshotUrl(n.id) : null}
        @detail-action=${(e: CustomEvent<{ id: string; action: DetailAction }>) => void this.doAction(e.detail.id, e.detail.action)}></notify-detail>`;
  }

  render() {
    const n = this.row(this.detailId);
    return html`<div class="scrim" data-center-scrim @click=${() => this.close()}></div>
      <div class="panel" role="dialog" aria-modal="true" aria-label="מרכז התראות" tabindex="-1" data-notify-center ?inert=${!this.open}>
        <span class="grab" aria-hidden="true"></span>
        <div class="inner">${n ? this.renderDetailView(n) : this.renderListView()}</div>
        ${this.toast ? html`<div class="toast ${this.toast.bad ? 'bad' : ''}" role="status" data-center-toast>${nIcon(this.toast.bad ? 'warning' : 'check')}${this.toast.text}</div>` : nothing}
      </div>
      ${this.renderDoorDialog()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notify-center': NotifyCenter;
  }
}
