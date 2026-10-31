import { LitElement, html, nothing, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import type { CalRequest, Occurrence } from '../api/calendars';
import { CAL_EVENTS, emit, type CalCtx } from './ctx';
import { calCss } from './styles';
import { addDays, colorVar, ddmm, DAY_SHORT, hm, pageOf, queueOrder, rowsThatFit, startOfDay, whenText } from './model';

/** One decision the viewer made in this session (the "הוחלטו לאחרונה" segment). */
interface Decided { r: CalRequest; decision: 'approve' | 'reject'; at: Date; displaced: boolean }

/** A held / competing lane of the contested window detail. */
interface Lane { id: string; title: string; who: string; start: string; end: string; holder: boolean; req: CalRequest | null; color: string }

/**
 * CALENDARS-UI-2310 slice B: אישורים - the inbox of the requests waiting for the viewer (the calendars he manages). Each card: the calendar's
 * dot, the title, when (a series shows its summary), who asked and for whom, the headcount, and chips for the decision deadline, a conflict, the
 * guest details and "N מבקשים לחלון" (contract C2: a pending request does not hold the slot - the first confirmed one does). The side panel
 * explains the selected window: the competing requesters on a mini timeline in the order the installation chose (owner answer 11 as a setting,
 * `contested_order`: first come - the first in line is offered first; by kind; manual - nothing preselected) and the two ways out: approve one
 * and displace the holder (only while `allow_displace` is on, answer 12) or keep the holder and reject the requests. A series opens its dates
 * so single occurrences can be left out. Tablet: the panel is hidden and opens on tap (answer 23, `tablet_panels` = collapse) or stays narrow
 * (`shrink`). The list pages instead of scrolling. "הוחלטו לאחרונה" lists the decisions taken on this screen since it opened.
 */
@customElement('cal-view-approvals')
export class CalViewApprovals extends LitElement {
  static styles = [calCss, css`
    :host { display: flex; gap: 14px; min-block-size: 0; min-inline-size: 0; position: relative; }
    .main { flex: 1; }
    .list { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
    .req { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 16px; align-items: center; padding: 12px 16px; border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2); border: 1.5px solid transparent; cursor: pointer; min-inline-size: 0; text-align: start; flex: none; }
    .req[aria-current='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .req:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
    .req .info { display: flex; flex-direction: column; gap: 4px; min-inline-size: 0; }
    .ttl { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); min-inline-size: 0; }
    .when { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; min-inline-size: 0; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; align-items: center; }
    .meta > span { max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .acts { display: flex; gap: 8px; }
    .yes { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }
    .no { color: var(--sw-danger-text); }
    .hintline { font-size: var(--sw-fs-sm); color: var(--sw-text-3); display: inline-flex; gap: 6px; align-items: center; }
    aside.panel { inline-size: 440px; flex: none; }
    aside .lanes { display: flex; flex-direction: column; gap: 8px; }
    .lane { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 4px 10px; align-items: center; }
    .lane .ln { display: flex; flex-direction: column; min-inline-size: 0; }
    .lane .ln b { font-size: var(--sw-fs-md); color: var(--sw-heading); }
    .lane .ln span { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .lane .chipcell { grid-column: 2; justify-self: start; display: flex; gap: 4px; flex-wrap: wrap; }
    .mini { position: relative; block-size: 28px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); direction: ltr; overflow: hidden; }
    .mini .ev { position: absolute; inset-block: 4px; padding: 0; }
    .axis { display: flex; justify-content: space-between; direction: ltr; font-size: var(--sw-fs-xs); color: var(--sw-text-3); padding-inline-end: 140px; }
    .opt { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 1.5px solid transparent;
      cursor: pointer; text-align: start; font: inherit; color: inherit; inline-size: 100%; }
    .opt[aria-checked='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .opt[aria-disabled='true'] { opacity: var(--sw-disabled-opacity); cursor: default; }
    .opt .rad { inline-size: 18px; block-size: 18px; border-radius: 50%; border: 2px solid var(--sw-border-strong); flex: none; margin-block-start: 2px; }
    .opt[aria-checked='true'] .rad { border: 5px solid var(--sw-accent); }
    .opt b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .opt small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-sm); margin-block-start: 2px; }
    .dates { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
    .date { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-block-size: 34px; padding: 0 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2);
      border: 0; font: inherit; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-heading); cursor: pointer; }
    .date[aria-pressed='true'] { background: var(--sw-danger-soft); color: var(--sw-danger-text); text-decoration: line-through; }
    .ok-ic { color: var(--sw-success-text); }
    .foot { display: flex; gap: 8px; margin-block-start: auto; }
    .foot .btn:first-child { flex: 1; }
    textarea.inp { padding: 10px 12px; min-block-size: 72px; resize: none; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .scrim { position: fixed; inset: 0; background: var(--sw-overlay); z-index: var(--sw-z-modal); }
    aside.overlay { position: fixed; inset-block: 12px; inset-inline-start: 12px; z-index: calc(var(--sw-z-modal) + 1); inline-size: min(440px, calc(100vw - 24px)); box-shadow: var(--sw-shadow-3); }
    aside.overlay.short { inset-block: auto 12px; }
    :host([shrink]) aside.panel:not(.overlay) { inline-size: 320px; }
    :host([shrink]) .lane { grid-template-columns: 96px minmax(0, 1fr); }
    :host([shrink]) .axis { padding-inline-end: 106px; }
    .reqs-empty { flex: 1; display: grid; place-items: center; }
    .lbl { font-size: var(--sw-fs-sm); color: var(--sw-text-2); font-weight: var(--sw-fw-semibold); }
    @media (max-width: 699px) {
      .req { grid-template-columns: minmax(0, 1fr); padding: 12px; }
      .acts .btn { flex: 1; }
      aside.overlay { inset: auto 0 0 0; inline-size: 100%; max-block-size: 88dvh; border-end-start-radius: 0; border-end-end-radius: 0; padding-block-end: calc(16px + env(safe-area-inset-bottom)); }
    }
  `];

  @property({ attribute: false }) ctx: CalCtx | null = null;
  @property({ type: Boolean, reflect: true }) shrink = false;
  @state() private reqs: CalRequest[] | null = null;
  @state() private error = '';
  @state() private seg: 'pending' | 'decided' = 'pending';
  @state() private page = 1;
  @state() private selId = '';
  @state() private choice: 'approve' | 'keep' = 'approve';
  @state() private pick = '';
  @state() private lanes: Lane[] = [];
  @state() private series: Occurrence[] = [];
  @state() private skip = new Set<string>();
  @state() private rejecting: CalRequest | null = null;
  @state() private note = '';
  @state() private busy = false;
  @state() private actErr = '';
  @state() private overlay = false;
  @state() private listH = 0;
  private decided: Decided[] = [];
  private ro: ResizeObserver | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
  }

  protected firstUpdated(): void {
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this);
  }

  protected updated(): void {
    this.measure();
  }

  private measure(): void {
    const el = this.renderRoot.querySelector('.list') as HTMLElement | null;
    if (el && Math.abs(el.clientHeight - this.listH) > 4) this.listH = el.clientHeight;
  }

  protected willUpdate(ch: PropertyValues<this>): void {
    if (ch.has('ctx')) this.shrink = this.ctx?.device === 'tablet' && this.ctx.access.ui.tablet_panels === 'shrink';
  }

  private get device() {
    return this.ctx?.device ?? 'desktop';
  }

  /** The side panel: always on a wide screen; on a tablet per the setting (collapse = on tap as an overlay, shrink = narrow); a sheet on a phone. */
  private panelMode(): 'inline' | 'overlay' {
    if (this.device === 'desktop') return 'inline';
    if (this.device === 'tablet' && this.ctx?.access.ui.tablet_panels === 'shrink') return 'inline';
    return 'overlay';
  }

  private async load(): Promise<void> {
    if (!this.ctx) return;
    try {
      const { requests } = await this.ctx.api.requests();
      this.reqs = requests;
      this.error = '';
      const keep = requests.find((r) => r.event_id === this.selId);
      if (!keep) {
        this.selId = '';
        if (this.panelMode() === 'inline') {
          const first = requests.find((r) => r.competing_count > 1) ?? requests.find((r) => r.recurring) ?? requests[0];
          if (first) void this.select(first, false);
        }
      }
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private perPage(): number {
    const rowH = this.device === 'phone' ? 222 : this.device === 'tablet' ? 136 : 122;
    return this.listH ? rowsThatFit(this.listH + 8, rowH) : this.device === 'desktop' ? 4 : 2;
  }

  private holderOf(r: CalRequest): string {
    return r.room_calendar_id ?? r.calendar.id;
  }

  /** The requests competing for the same window of the same calendar, in the order of the setting. */
  private rivals(r: CalRequest): CalRequest[] {
    const h = this.holderOf(r);
    const group = (this.reqs ?? []).filter((o) => this.holderOf(o) === h && o.start < r.end && o.end > r.start);
    return queueOrder(group, this.ctx?.access.ui.contested_order ?? 'first_come');
  }

  private async select(r: CalRequest, open = true): Promise<void> {
    if (!this.ctx) return;
    this.selId = r.event_id;
    this.actErr = '';
    this.skip = new Set();
    this.series = [];
    this.lanes = [];
    if (open && this.panelMode() === 'overlay') this.overlay = true;
    const order = this.ctx.access.ui.contested_order;
    const rivals = this.rivals(r);
    // owner answer 11: first come / by kind name the first in line; manual leaves the choice to the manager (nothing preselected)
    this.pick = order === 'manual' ? (rivals.length > 1 ? '' : r.event_id) : (rivals.find((x) => x.suggested) ?? rivals[0] ?? r).event_id;
    this.choice = 'approve';
    const h = this.holderOf(r);
    const from = startOfDay(new Date(r.start));
    try {
      if (r.recurring) {
        const { occurrences } = await this.ctx.api.occurrences(from.toISOString(), addDays(from, 61).toISOString(), [h]);
        this.series = occurrences.filter((o) => o.event_id === r.event_id).slice(0, 12);
      }
      const { occurrences } = await this.ctx.api.occurrences(from.toISOString(), addDays(from, 1).toISOString(), [h]);
      const held = occurrences.filter((o) => o.state === 'confirmed' && o.start < r.end && o.end > r.start && o.kind !== 'holiday' && !rivals.some((q) => q.event_id === o.event_id));
      const color = this.ctx.cals.find((c) => c.id === h)?.color ?? r.calendar.color;
      this.lanes = [
        ...held.map((o): Lane => ({ id: o.event_id, title: o.title ?? 'תפוס', who: o.organizer?.name ?? o.on_behalf_label ?? '', start: o.start, end: o.end, holder: true, req: null, color })),
        ...rivals.map((q): Lane => ({ id: q.event_id, title: q.title ?? 'בקשה', who: [q.organizer?.name, q.headcount ? `${q.headcount.toLocaleString('he-IL')} משתתפים` : ''].filter(Boolean).join(' · '), start: q.start, end: q.end, holder: false, req: q, color: q.calendar.color })),
      ];
    } catch {
      this.lanes = rivals.map((q): Lane => ({ id: q.event_id, title: q.title ?? 'בקשה', who: q.organizer?.name ?? '', start: q.start, end: q.end, holder: false, req: q, color: q.calendar.color }));
    }
  }

  private async decide(r: CalRequest, decision: 'approve' | 'reject', opts: { displace?: boolean; note?: string; except?: string[] } = {}): Promise<boolean> {
    if (!this.ctx) return false;
    this.busy = true;
    this.actErr = '';
    try {
      await this.ctx.api.decide(r.event_id, { decision, revision: r.revision, room_calendar_id: r.room_calendar_id, note: opts.note || undefined, displace_existing: opts.displace || undefined,
        except_occurrences: opts.except?.length ? opts.except : undefined });
      this.decided = [{ r, decision, at: new Date(), displaced: !!opts.displace }, ...this.decided].slice(0, 50);
      const t = r.title ?? 'הבקשה';
      emit(this, CAL_EVENTS.toast, decision === 'approve' ? (opts.displace ? `"${t}" אושרה; ההזמנה שהחזיקה את החלון נדחקה` : `"${t}" אושרה`) : `"${t}" נדחתה`);
      emit(this, CAL_EVENTS.changed);
      this.overlay = false;
      await this.load();
      return true;
    } catch (e) {
      this.actErr = this.errText(e);
      if (e instanceof ApiError && e.code === 'slot_held') await this.select(r);
      if (e instanceof ApiError && e.code === 'slot_held') this.actErr = this.errText(e);
      return false;
    } finally {
      this.busy = false;
    }
  }

  private errText(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.code === 'slot_held') return 'החלון כבר תפוס על ידי הזמנה שאושרה קודם. אפשר לאשר עם דחיקה או לדחות.';
      if (e.code === 'displace_disabled') return 'בהתקנה הזאת אי אפשר לדחוק הזמנה שאושרה. אפשר לדחות את הבקשה.';
      if (e.status === 403) return 'דחיקה של הזמנה מאושרת דורשת את אישור מנהל היומן עצמו.';
      if (e.code === 'stale') return 'הבקשה עודכנה בינתיים. הרשימה רועננה.';
    }
    return describeError(e);
  }

  /** Approve the picked request (displacing the holder when one holds the window), or keep the holder and reject every request of the window. */
  private async applyChoice(r: CalRequest): Promise<void> {
    const rivals = this.rivals(r);
    if (this.choice === 'keep') {
      for (const q of rivals) if (!(await this.decide(q, 'reject', { note: 'החלון נשאר להזמנה שאושרה קודם' }))) return;
      return;
    }
    const target = rivals.find((q) => q.event_id === this.pick) ?? r;
    const held = this.lanes.some((l) => l.holder) || target.conflicts_now > 0;
    await this.decide(target, 'approve', { displace: held && this.ctx?.access.ui.allow_displace !== false, except: [...this.skip] });
  }

  render() {
    if (!this.ctx) return nothing;
    if (this.error && !this.reqs) {
      return html`<section class="panel main" data-cal-state="error"><sw-state-panel state="error" heading="הבקשות לא נטענו" hint=${this.error} actionLabel="לנסות שוב" @action=${() => void this.load()}></sw-state-panel></section>`;
    }
    if (!this.reqs) return html`<section class="panel main" aria-busy="true">${Array.from({ length: 4 }, () => html`<div class="skel" style="block-size:96px"></div>`)}</section>`;
    const r = this.reqs.find((x) => x.event_id === this.selId) ?? null;
    const mode = this.panelMode();
    return html`
      <section class="panel main" data-approvals>
        <div class="ph">
          <div class="seg" role="group" aria-label="בקשות">
            <button type="button" aria-pressed=${String(this.seg === 'pending')} data-seg="pending" @click=${() => { this.seg = 'pending'; this.page = 1; }}>ממתינות <span class="num">${this.reqs.length}</span></button>
            <button type="button" aria-pressed=${String(this.seg === 'decided')} data-seg="decided" @click=${() => { this.seg = 'decided'; this.page = 1; }}>הוחלטו לאחרונה</button>
          </div>
          <span class="sp"></span>
          ${this.device === 'phone' ? nothing : this.managedDots()}
        </div>
        ${this.actErr && !(r && (mode === 'inline' || this.overlay)) && !this.rejecting ? html`<div class="note bad" role="alert" data-act-error>${this.actErr}</div>` : nothing}
        ${this.seg === 'pending' ? this.pendingList() : this.decidedList()}
      </section>
      ${r && mode === 'inline' ? this.detail(r, false) : nothing}
      ${r && mode === 'overlay' && this.overlay ? html`<div class="scrim" @click=${() => (this.overlay = false)}></div>${this.detail(r, true)}` : nothing}
      ${this.rejecting ? this.rejectDialog(this.rejecting) : nothing}`;
  }

  private managedDots() {
    const mine = (this.ctx?.cals ?? []).filter((c) => c.my_role === 'manage');
    return html`<span class="hintline">יומנים שבניהולך: ${mine.slice(0, 8).map((c) => html`<span class="dot" style=${`--h:${colorVar(c.color)}`}></span>`)}<span class="num">${mine.length}</span></span>`;
  }

  private pendingList() {
    const list = this.reqs ?? [];
    if (!list.length) {
      return html`<div class="reqs-empty" data-cal-state="empty"><sw-state-panel state="empty" icon="calendar" heading="אין בקשות שממתינות לך"
        hint="כשמישהו יבקש חדר ביומן שבאחריותך, הבקשה תופיע כאן ותקבל התראה."></sw-state-panel></div>`;
    }
    const pg = pageOf(list, this.page, this.perPage());
    return html`<div class="list" data-req-list>${pg.items.map((q) => this.card(q))}</div>${this.pager(pg.page, pg.pages)}`;
  }

  private card(q: CalRequest) {
    const now = this.ctx?.now ?? new Date();
    const hours = (new Date(q.start).getTime() - now.getTime()) / 3_600_000;
    const timeout = this.ctx?.cals.find((c) => c.id === (q.room_calendar_id ?? q.calendar.id))?.approval_timeout_h ?? 2;
    const left = Math.floor(hours - timeout);
    const [day, span] = whenText(q.start, q.end, now).split(' · ');
    return html`<div class="req" role="button" tabindex="0" aria-current=${String(q.event_id === this.selId)} data-req=${q.event_id}
        @click=${(e: Event) => { if (!(e.target as HTMLElement).closest('button')) void this.select(q); }}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' && e.target === e.currentTarget) void this.select(q); }}>
      <div class="info">
        <div class="ttl"><span class="dot" style=${`--h:${colorVar(q.calendar.color)}`}></span><span class="ell" title=${q.title ?? ''}>${q.title ?? 'בקשה'}</span></div>
        <div class="when"><span>${day} · <span class="ltr num">${span}</span></span>${q.recurring ? html`<span class="chip"><sw-icon name="refresh" size="12"></sw-icon><span class="ell">${q.recurring_summary ?? 'סדרה'}</span></span>` : nothing}</div>
        <div class="meta">
          <span title=${q.calendar.name}>${q.calendar.name}</span>${q.organizer?.name ? html`<span title=${q.organizer.name}>${q.organizer.name}</span>` : nothing}
          <span title=${q.on_behalf_label ?? ''}>${q.on_behalf_label ? `בשם: ${q.on_behalf_label}` : html`<span class="muted">ללא תווית</span>`}</span>
          ${q.headcount ? html`<span class="num">${q.headcount.toLocaleString('he-IL')} משתתפים</span>` : nothing}
          ${q.conflicts_now && q.competing_count <= 1 ? html`<span class="chip bad" data-chip="conflict"><sw-icon name="warning" size="12"></sw-icon>חופף להזמנה מאושרת</span>` : nothing}
          ${hours > 0 && left >= 0 && left <= 12 ? html`<span class="chip warn num" data-chip="deadline">נשארו ${left} שע׳ להחלטה</span>` : nothing}
          ${q.competing_count > 1 ? html`<span class="chip warn num" data-chip="contest"><sw-icon name="users" size="12"></sw-icon>${q.competing_count.toLocaleString('he-IL')} מבקשים לחלון</span>` : nothing}
          ${q.guests_count ? html`<span class="chip num" data-chip="guests"><sw-icon name="lock" size="12"></sw-icon>פרטי אורח: ${q.guests_count}</span>` : nothing}
          ${q.suggested && this.ctx?.access.ui.contested_order !== 'manual' ? html`<span class="chip acc" data-chip="first">ראשון בתור</span>` : nothing}
        </div>
      </div>
      <div class="acts">
        <button type="button" class="btn yes" ?disabled=${this.busy} data-approve=${q.event_id} @click=${() => void this.quickApprove(q)}><sw-icon name="check" size="14"></sw-icon>אישור</button>
        <button type="button" class="btn no" ?disabled=${this.busy} data-reject=${q.event_id} @click=${() => { this.rejecting = q; this.note = ''; this.actErr = ''; }}><sw-icon name="close" size="14"></sw-icon>דחייה</button>
      </div>
    </div>`;
  }

  /** A card's own "אישור": a plain request is approved at once; a contested window or a held slot opens the detail to choose explicitly. */
  private async quickApprove(q: CalRequest): Promise<void> {
    if (q.competing_count > 1 || q.conflicts_now > 0) {
      await this.select(q);
      return;
    }
    await this.decide(q, 'approve');
  }

  private decidedList() {
    if (!this.decided.length) {
      return html`<div class="reqs-empty" data-cal-state="decided-empty"><sw-state-panel state="empty" icon="check" heading="עוד לא הוחלט דבר מאז שנפתח המסך" hint="החלטות שתקבל כאן יופיעו ברשימה הזאת."></sw-state-panel></div>`;
    }
    const pg = pageOf(this.decided, this.page, this.perPage() + 2);
    return html`<div class="list">${pg.items.map((d) => html`<div class="row" data-decided=${d.r.event_id}>
      <span class="dot" style=${`--h:${colorVar(d.r.calendar.color)}`}></span>
      <div class="grow"><div class="name ell">${d.r.title ?? 'בקשה'}</div><div class="sub ell">${d.r.calendar.name} · ${whenText(d.r.start, d.r.end, this.ctx?.now ?? new Date())}</div></div>
      ${d.displaced ? html`<span class="chip warn">נדחקה הזמנה</span>` : nothing}
      <span class=${`chip ${d.decision === 'approve' ? 'ok' : 'bad'}`}>${d.decision === 'approve' ? 'אושר' : 'נדחה'} · <span class="num">${hm(d.at)}</span></span></div>`)}</div>${this.pager(pg.page, pg.pages)}`;
  }

  private pager(page: number, pages: number) {
    return html`<div class="pager" data-pager><button type="button" class="btn" aria-label="הקודם" ?disabled=${page <= 1} @click=${() => (this.page = page - 1)}><sw-icon name="chevron" size="14"></sw-icon></button>
      <span class="num" data-page>${page} / ${pages}</span>
      <button type="button" class="btn" aria-label="הבא" ?disabled=${page >= pages} @click=${() => (this.page = page + 1)}><sw-icon name="chevronBack" size="14"></sw-icon></button></div>`;
  }

  private detail(r: CalRequest, overlay: boolean) {
    const contested = this.lanes.length > 1 || r.competing_count > 1;
    const series = r.recurring && !contested;
    const head = contested ? `${r.calendar.name} · ${whenText(r.start, r.end, this.ctx?.now ?? new Date()).split(' · ')[0]}` : r.title ?? 'בקשה';
    return html`<aside class=${`panel ${overlay ? 'overlay' : ''}`} role=${overlay ? 'dialog' : 'complementary'} aria-label="פרטי הבקשה" data-detail=${contested ? 'contested' : series ? 'series' : 'single'}>
      <div class="ph"><h2 class="ell" title=${head}>${head}</h2>
        ${overlay ? html`<span class="sp"></span><button type="button" class="btn icon sm" aria-label="סגירה" data-detail-close @click=${() => (this.overlay = false)}><sw-icon name="close" size="14"></sw-icon></button>` : nothing}</div>
      ${series ? this.seriesBody(r) : this.contestBody(r)}
      ${this.actErr ? html`<div class="err" role="alert" data-act-error>${this.actErr}</div>` : nothing}
    </aside>`;
  }

  private contestBody(r: CalRequest) {
    const lanes = this.lanes.length ? this.lanes : [{ id: r.event_id, title: r.title ?? 'בקשה', who: r.organizer?.name ?? '', start: r.start, end: r.end, holder: false, req: r, color: r.calendar.color }];
    const a = new Date(Math.min(...lanes.map((l) => new Date(l.start).getTime())));
    a.setMinutes(0, 0, 0);
    a.setHours(a.getHours() - 1);
    const b = new Date(Math.max(...lanes.map((l) => new Date(l.end).getTime())));
    b.setMinutes(0, 0, 0);
    b.setHours(b.getHours() + 2);
    const total = b.getTime() - a.getTime();
    const pos = (iso: string) => ((new Date(iso).getTime() - a.getTime()) / total) * 100;
    const holder = lanes.find((l) => l.holder);
    const reqs = lanes.filter((l) => !l.holder);
    const ui = this.ctx?.access.ui;
    const target = reqs.find((l) => l.id === this.pick)?.req ?? (reqs.length === 1 ? reqs[0].req : null) ?? null;
    const approveBlocked = !!holder && ui?.allow_displace === false;
    const choice = approveBlocked ? 'keep' : this.choice;
    const order = ui?.contested_order ?? 'first_come';
    const mid = new Date((a.getTime() + b.getTime()) / 2);
    const needPick = choice === 'approve' && !target;
    return html`
      <div class="muted"><b class="num" style="color:var(--sw-heading)">${reqs.length}</b> ${reqs.length === 1 ? 'מבקש' : 'מבקשים'} לאותו חלון${holder ? ' · מי שאושר ראשון מחזיק' : ''}
        · ${order === 'manual' ? 'הסדר: המנהל בוחר' : order === 'by_kind' ? 'הסדר: לפי סוג' : 'הסדר: לפי סדר הגעה'}</div>
      <div class="lanes" data-lanes>${lanes.map((l) => html`<div class="lane" data-lane=${l.holder ? 'holder' : 'request'} data-lane-id=${l.id}>
        <div class="ln"><b class="ell" title=${l.title}>${l.title}</b><span class="ell" title=${l.who}>${l.who}</span></div>
        <div class="mini"><div class="ev" data-mark=${l.holder ? 'ok' : 'pending'} style=${`--h:${colorVar(l.color)};left:${pos(l.start)}%;width:${Math.max(2, pos(l.end) - pos(l.start))}%`}></div></div>
        <span class="chipcell">${l.holder ? html`<span class="chip ok">מאושר · מחזיק את החלון</span>`
          : html`<span class="chip dash num">בקשה ${reqs.indexOf(l) + 1}${l.req?.requested_at ? html` · ${hm(l.req.requested_at)}` : nothing}</span>${l.req?.suggested && order !== 'manual' ? html`<span class="chip acc" data-first-in-line>ראשון בתור</span>` : nothing}`}</span></div>`)}</div>
      <div class="axis"><span class="num">${hm(a)}</span><span class="num">${hm(mid)}</span><span class="num">${hm(b)}</span></div>
      ${reqs.length > 1 && choice === 'approve' ? html`<label style="display:flex;flex-direction:column;gap:4px"><span class="lbl">איזו בקשה לאשר</span><select class="inp" data-pick @change=${(e: Event) => (this.pick = (e.target as HTMLSelectElement).value)}>
        ${order === 'manual' ? html`<option value="" ?selected=${!this.pick}>בחירה…</option>` : nothing}
        ${reqs.map((l, i) => html`<option value=${l.id} ?selected=${l.id === this.pick}>${i + 1}. ${l.title}</option>`)}</select></label>` : nothing}
      <div role="radiogroup" aria-label="מה לעשות" style="display:flex;flex-direction:column;gap:8px">
        <button type="button" class="opt" role="radio" aria-checked=${String(choice === 'approve')} aria-disabled=${String(approveBlocked)} data-choice="approve"
          @click=${() => { if (!approveBlocked) this.choice = 'approve'; }}><span class="rad"></span><span>
          <b>${target ? `לאשר את "${target.title ?? 'הבקשה'}"` : 'לאשר את הבקשה שתבחר'}${holder ? ' ולדחוק' : ''}</b>
          <small>${approveBlocked ? 'בהתקנה הזאת דחיקה של הזמנה מאושרת כבויה (הגדרות › יומנים). אפשר רק לדחות את הבקשות.'
            : holder ? `"${holder.title}" נדחקת ולא נמחקת; ${holder.who || 'המארגן'} יבחר זמן חלופי מתוך 3 הצעות.${reqs.length > 1 ? ' שאר הבקשות נשארות ממתינות.' : ''}`
            : reqs.length > 1 ? 'הבקשה מאושרת; שאר הבקשות לחלון נשארות ממתינות ויוכרעו מול ההזמנה שאושרה.' : 'הבקשה מאושרת והמבקש מקבל הודעה.'}</small></span></button>
        <button type="button" class="opt" role="radio" aria-checked=${String(choice === 'keep')} data-choice="keep" @click=${() => (this.choice = 'keep')}><span class="rad"></span><span>
          <b>${holder ? 'להשאיר למחזיק ולדחות את הבקשות' : 'לדחות את כל הבקשות לחלון'}</b>
          <small>${reqs.length > 1 ? `${reqs.length} הבקשות נדחות עם הערה` : 'הבקשה נדחית עם הערה'} והמבקשים מקבלים הצעות לזמן אחר.</small></span></button>
      </div>
      <div class="hintline"><sw-icon name="shield" size="14"></sw-icon>${ui?.displace_approver === 'any_manager' ? 'מחליט: מנהל היומן, מנהל האזור או מנהל המערכת' : 'מחליט: מנהל היומן. דחיקה רק באישור מנהל היומן עצמו'}</div>
      <div class="foot">
        <button type="button" class="btn yes" ?disabled=${this.busy || needPick} data-apply @click=${() => { this.choice = choice; void this.applyChoice(r); }}>
          <sw-icon name="check" size="14"></sw-icon>${choice === 'keep' ? 'דחיית הבקשות' : holder ? 'אישור ודחיקה' : 'אישור'}</button>
        <button type="button" class="btn no" ?disabled=${this.busy || !target} @click=${() => { if (target) { this.rejecting = target; this.note = ''; } }}>דחייה עם הערה</button>
      </div>`;
  }

  private localKey(o: Occurrence): string {
    return o.occurrence_id.split('@')[1] ?? o.start;
  }

  private seriesBody(r: CalRequest) {
    const occ = this.series;
    const first = occ[0];
    return html`
      <div class="muted">${r.calendar.name}${r.organizer?.name ? ` · ביקש/ה ${r.organizer.name}` : ''}</div>
      ${first ? html`<div style="font-weight:700;color:var(--sw-heading)">המועד הראשון: <span class="num">${DAY_SHORT[new Date(first.start).getDay()]} ${ddmm(new Date(first.start))} · <span class="ltr">${hm(first.start)}–${hm(first.end)}</span></span></div>` : nothing}
      <div style="font-weight:700;color:var(--sw-heading)">${occ.length ? html`<span class="num">${occ.length}</span> מועדים` : r.recurring_summary ?? 'סדרה'}</div>
      ${occ.length ? html`<div class="dates" data-dates>${occ.map((o) => {
        const k = this.localKey(o);
        const off = this.skip.has(k);
        return html`<button type="button" class="date" aria-pressed=${String(off)} title=${off ? 'יידחה' : 'יאושר'} data-date=${k}
          @click=${() => { const s = new Set(this.skip); if (off) s.delete(k); else s.add(k); this.skip = s; }}>
          <span class="num">${ddmm(new Date(o.start))}</span>${o.contested && !off ? html`<span class="chip bad">מתנגש</span>` : off ? html`<sw-icon name="close" size="12"></sw-icon>` : html`<sw-icon class="ok-ic" name="check" size="12"></sw-icon>`}</button>`;
      })}</div>` : nothing}
      <div class="note"><sw-icon name="info" size="16"></sw-icon><div><b>אפשר לאשר את הסדרה ולדחות מועדים בודדים</b><span class="muted">לחיצה על תאריך מוציאה אותו. המבקש יראה "אושר למעט N מועדים".</span></div></div>
      <div class="foot">
        <button type="button" class="btn yes" ?disabled=${this.busy} data-apply @click=${() => void this.decide(r, 'approve', { except: [...this.skip] })}>
          <sw-icon name="check" size="14"></sw-icon>${this.skip.size ? html`אישור למעט <span class="num">${this.skip.size}</span>` : 'אישור הסדרה'}</button>
        <button type="button" class="btn no" ?disabled=${this.busy} @click=${() => { this.rejecting = r; this.note = ''; }}>דחייה עם הערה</button>
      </div>`;
  }

  private rejectDialog(r: CalRequest) {
    return html`<div class="scrim" @click=${() => (this.rejecting = null)}></div>
      <aside class="panel overlay short" role="dialog" aria-label="דחיית בקשה" data-reject-dialog>
        <div class="ph"><h2 class="ell">לדחות את "${r.title ?? 'הבקשה'}"?</h2></div>
        <div class="muted">${r.calendar.name} · ${whenText(r.start, r.end, this.ctx?.now ?? new Date())}</div>
        <label class="lbl" for="note">הערה למבקש (לא חובה, עד 300 תווים)</label>
        <textarea id="note" class="inp" maxlength="300" .value=${this.note} @input=${(e: Event) => (this.note = (e.target as HTMLTextAreaElement).value)} data-reject-note></textarea>
        ${this.actErr ? html`<div class="err" role="alert">${this.actErr}</div>` : nothing}
        <div class="foot">
          <button type="button" class="btn bad fill" ?disabled=${this.busy} data-reject-confirm @click=${async () => { if (await this.decide(r, 'reject', { note: this.note })) this.rejecting = null; }}>דחייה</button>
          <button type="button" class="btn" @click=${() => (this.rejecting = null)}>ביטול</button>
        </div>
      </aside>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cal-view-approvals': CalViewApprovals;
  }
}
