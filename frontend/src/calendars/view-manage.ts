import { LitElement, html, nothing, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { listRoles, listUsers } from '../api/access';
import { isApi } from '../api/session';
import { CAL_COLORS, CAL_ROLES, CAL_TYPES, type ApprovalMode, type CalColor, type CalRole, type CalType, type Calendar, type Member, type OverlapMode } from '../api/calendars';
import { CAL_EVENTS, emit, type CalCtx } from './ctx';
import { calCss } from './styles';
import { APPROVAL_LABEL, colorVar, OVERLAP_SHORT, pageOf, PROVIDER_LABEL, ROLE_HINT, ROLE_LABEL, rowsThatFit, STRICTNESS, TYPE_LABEL } from './model';

const TYPE_ICON: Record<CalType, 'door' | 'users' | 'wrench' | 'calendar'> = { room: 'door', team: 'users', maintenance: 'wrench', event: 'calendar' };
const KIND_LABEL: Record<Member['subject_kind'], string> = { user: 'משתמש', role: 'תפקיד', department: 'מחלקה', everyone: 'כולם' };
const APPROVAL_LOOK: Record<ApprovalMode, string> = { none: '', always: 'acc', outside_hours: 'acc', on_behalf: 'acc' };
const MAX_MEMBERS = 300;
const HUES: CalColor[] = CAL_COLORS.filter((c) => c !== 'slate');
const OVERLAPS: OverlapMode[] = ['first_holds', 'override_notify', 'block', 'ask'];

interface Draft { name: string; type: CalType; color: CalColor; capacity: string; approval: ApprovalMode; override: OverlapMode | ''; owner: string; buffer: string; horizon: string }

/**
 * CALENDARS-UI-2310 slice B: ניהול יומנים. Three screens behind one tab:
 *  - the list (#/<base>/manage): every calendar the viewer may see, filtered by type (segments with counts), each with its colour, where it is,
 *    its manager, the approval mode, pending requests, the external sync state and the viewer's own role; "..." opens members / archive. Pages.
 *  - a calendar (#/<base>/manage/<id>): its facts and rule chips, the members and their per-calendar role (view / create my own / edit all /
 *    manage and approve - a change is saved at once), "what each role allows" (on a tablet hidden and opened on tap, owner answer 23 as the
 *    setting `tablet_panels`, or narrow), and the calendar's rules form.
 *  - a new calendar (#/<base>/manage/new): name, type, colour (never green), manager, capacity, approval, and the per-calendar overlap mode
 *    only as far as the installation allows (owner answer 9 as the setting `override_scope`: both directions / only stricter / none).
 */
@customElement('cal-view-manage')
export class CalViewManage extends LitElement {
  static styles = [calCss, css`
    :host { display: flex; gap: 14px; min-block-size: 0; min-inline-size: 0; position: relative; }
    .main { flex: 1; }
    .list { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
    .list > .row { flex: none; }
    .cname { flex: 0 0 300px; min-inline-size: 0; cursor: pointer; }
    .cname:hover .name { color: var(--sw-accent-text); }
    .type { flex: 0 0 84px; display: inline-flex; gap: 6px; align-items: center; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .mgr { flex: 0 0 180px; min-inline-size: 0; font-size: var(--sw-fs-sm); }
    .mgr b { color: var(--sw-heading); }
    .missing { color: var(--sw-warning-text); }
    .myrole { flex: 0 0 110px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .menuwrap { position: relative; }
    .menu { position: absolute; inset-block-start: calc(100% + 4px); inset-inline-end: 0; z-index: 5; min-inline-size: 190px; background: var(--sw-menu-surface); border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-3); padding: 6px; display: flex; flex-direction: column; }
    .menu.up { inset-block-start: auto; inset-block-end: calc(100% + 4px); }
    .menu button { font: inherit; font-size: var(--sw-fs-md); text-align: start; border: 0; background: transparent; color: var(--sw-heading); padding: 9px 12px; border-radius: var(--sw-r-md);
      cursor: pointer; display: flex; gap: 8px; align-items: center; }
    .menu button:hover { background: var(--sw-hover-wash); }
    .menu button.bad { color: var(--sw-danger-text); }
    .hint { font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
    /* members */
    .calhead { display: flex; align-items: center; gap: 12px; min-inline-size: 0; flex-wrap: wrap; }
    .calhead .sq { inline-size: 40px; block-size: 40px; border-radius: var(--sw-r-md); }
    .calhead h2 { margin: 0; font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .rulechips { display: flex; gap: 6px; flex-wrap: wrap; max-block-size: 64px; overflow: hidden; }
    table.t { inline-size: 100%; border-collapse: separate; border-spacing: 0 6px; table-layout: fixed; }
    table.t th { text-align: start; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-heading); padding: 8px 12px; background: var(--sw-surface-3); }
    table.t th:first-child { border-start-start-radius: var(--sw-r-md); border-end-start-radius: var(--sw-r-md); }
    table.t th:last-child { border-start-end-radius: var(--sw-r-md); border-end-end-radius: var(--sw-r-md); }
    table.t td { padding: 8px 12px; background: var(--sw-surface-2); vertical-align: middle; font-size: var(--sw-fs-md); }
    table.t td:first-child { border-start-start-radius: var(--sw-r-lg); border-end-start-radius: var(--sw-r-lg); color: var(--sw-text-2); }
    table.t td:last-child { border-start-end-radius: var(--sw-r-lg); border-end-end-radius: var(--sw-r-lg); text-align: end; }
    table.t td .who { font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .rolepick { display: inline-flex; gap: 2px; padding: 3px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); }
    .rolepick button { font: inherit; font-size: var(--sw-fs-sm); border: 0; background: transparent; color: var(--sw-text-2); padding: 5px 10px; border-radius: var(--sw-r-pill); cursor: pointer; white-space: nowrap; }
    .rolepick button[aria-pressed='true'] { background: var(--sw-surface-solid); color: var(--sw-heading); font-weight: var(--sw-fw-bold); box-shadow: var(--sw-shadow-1); }
    .rolepick button[disabled] { cursor: default; }
    aside.panel { inline-size: 360px; flex: none; }
    .rights { display: flex; flex-direction: column; gap: 6px; }
    .rt { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 10px; padding: 10px 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); }
    .rt b { color: var(--sw-heading); }
    .rt span { color: var(--sw-text-2); }
    .addrow { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 10px 12px; border-radius: var(--sw-r-lg); background: var(--sw-accent-soft); }
    .addrow .inp { inline-size: auto; flex: 1; min-inline-size: 140px; background: var(--sw-surface-solid); }
    .addrow select.inp.k { flex: 0 0 120px; min-inline-size: 0; }
    .scrim { position: fixed; inset: 0; background: var(--sw-overlay); z-index: var(--sw-z-modal); }
    aside.overlay { position: fixed; inset-block: 12px; inset-inline-start: 12px; z-index: calc(var(--sw-z-modal) + 1); box-shadow: var(--sw-shadow-3); inline-size: min(380px, calc(100vw - 24px)); }
    :host([shrink]) aside.panel:not(.overlay) { inline-size: 280px; }
    :host([shrink]) .rt { grid-template-columns: minmax(0, 1fr); gap: 2px; }
    /* the calendar form */
    .form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px 24px; align-content: start; }
    .form .fld { grid-template-columns: 110px minmax(0, 1fr); }
    .hues { display: flex; gap: 8px; flex-wrap: wrap; }
    .hue { inline-size: 32px; block-size: 32px; border-radius: 50%; background: var(--h); border: 3px solid transparent; cursor: pointer; box-shadow: inset 0 0 0 2px var(--sw-surface-solid); }
    .hue[aria-pressed='true'] { border-color: var(--sw-heading); }
    .formfoot { display: flex; gap: 8px; margin-block-start: auto; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .center { flex: 1; display: grid; place-items: center; }
    @media (max-width: 1179px) {
      .cname { flex: 1; }
      .form { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 699px) {
      .form .fld { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .calhead h2 { font-size: var(--sw-fs-xl); }
      .addrow .inp, .addrow select.inp.k { flex: 1 1 100%; }
    }
  `];

  @property({ attribute: false }) ctx: CalCtx | null = null;
  @property({ type: Boolean, reflect: true }) shrink = false;
  @state() private typ: CalType | '' = '';
  @state() private page = 1;
  @state() private menuFor = '';
  @state() private confirmArchive: Calendar | null = null;
  @state() private members: Member[] | null = null;
  @state() private memErr = '';
  @state() private rev = 0;
  @state() private side = false;
  @state() private adding = false;
  @state() private addKind: Member['subject_kind'] = 'user';
  @state() private addId = '';
  @state() private addRole: CalRole = 'book';
  @state() private people: { id: string; name: string }[] = [];
  @state() private roles: { id: string; name: string }[] = [];
  @state() private draft: Draft | null = null;
  @state() private editing: Calendar | null = null;
  @state() private formErr = '';
  @state() private busy = false;
  @state() private instOverlap: OverlapMode = 'first_holds';
  @state() private listH = 0;
  @state() private rowH = 0;
  private loadedFor = '';
  private ro: ResizeObserver | null = null;
  private onDoc = (e: Event) => {
    if (this.menuFor && !e.composedPath().some((n) => (n as HTMLElement).classList?.contains('menuwrap'))) this.menuFor = '';
  };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onDoc, true);
    void this.ctx?.api.settings().then((r) => (this.instOverlap = r.settings.maintenance_overlap)).catch(() => undefined);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this.onDoc, true);
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
    const el = this.renderRoot.querySelector('.list, .tablewrap') as HTMLElement | null;
    if (el && Math.abs(el.clientHeight - this.listH) > 4) this.listH = el.clientHeight;
    // the real height of one row (with its gap): a row taller than the estimate (a wrapped chip, a larger type scale) never gets cut
    const row = el?.querySelector('.row, tbody tr') as HTMLElement | null;
    const h = row ? row.offsetHeight + 6 : 0;
    if (h && Math.abs(h - this.rowH) > 2) this.rowH = h;
  }

  protected willUpdate(ch: PropertyValues<this>): void {
    if (!ch.has('ctx') || !this.ctx) return;
    this.shrink = this.ctx.device === 'tablet' && this.ctx.access.ui.tablet_panels === 'shrink';
    const sub = this.ctx.sub;
    if (sub === 'new' && !this.draft) {
      this.draft = this.blank();
      void this.loadPeople();
    }
    if (sub !== 'new' && !this.editing) this.draft = null;
    if (sub && sub !== 'new' && sub !== this.loadedFor) {
      this.loadedFor = sub;
      this.page = 1;
      void this.loadMembers(sub);
    }
    if (!sub) this.loadedFor = '';
  }

  /** The demo's hash parameters travel with the links (a worst-case screen stays worst-case). */
  private href(path: string): string {
    const q = isApi() ? '' : window.location.hash.split('?')[1] ?? '';
    return `${this.ctx?.base ?? '#/calendars'}/manage${path}${q ? `?${q}` : ''}`;
  }

  private canManageAll(): boolean {
    return !!this.ctx?.access.can.manage;
  }

  // ---------------------------------------------------------------- list

  render() {
    if (!this.ctx) return nothing;
    const sub = this.ctx.sub;
    if (sub === 'new' || this.editing) return this.formScreen();
    if (sub) return this.membersScreen(sub);
    return this.listScreen();
  }

  private perPage(rowH: number, fallback: number): number {
    return this.listH ? rowsThatFit(this.listH + 6, Math.max(rowH, this.rowH)) : fallback;
  }

  private listScreen() {
    const ctx = this.ctx as CalCtx;
    const q = ctx.q.trim();
    const all = ctx.cals.filter((c) => (!ctx.floor || !c.floor_id || c.floor_id === ctx.floor) && (!q || c.name.includes(q)));
    if (!ctx.cals.length) {
      return html`<section class="panel main"><div class="center" data-cal-state="empty"><sw-state-panel state="empty" icon="calendar" heading="אין יומנים עדיין"
        hint="יומן לכל חדר, לצוות האחזקה, לצוותים ולאירועים. כל יומן עם מנהל, סוג ואזור זמן." actionLabel=${this.canManageAll() ? 'יומן חדש' : ''}
        @action=${() => (location.hash = this.href('/new'))}></sw-state-panel></div></section>`;
    }
    const list = this.typ ? all.filter((c) => c.type === this.typ) : all;
    const phone = ctx.device === 'phone';
    const pg = pageOf(list, this.page, this.perPage(phone ? 72 : 62, phone ? 5 : 9));
    const counts = CAL_TYPES.map((t) => [t, all.filter((c) => c.type === t).length] as const);
    return html`<section class="panel main" data-manage-list>
      <div class="ph">
        <div class="seg" role="group" aria-label="סוג יומן">
          <button type="button" aria-pressed=${String(!this.typ)} data-type="" @click=${() => { this.typ = ''; this.page = 1; }}>הכל <span class="num">${all.length}</span></button>
          ${counts.filter(([, n]) => n || !phone).map(([t, n]) => html`<button type="button" aria-pressed=${String(this.typ === t)} data-type=${t} @click=${() => { this.typ = t; this.page = 1; }}>${phone ? TYPE_LABEL[t] : TYPE_LABEL[t]} <span class="num">${n}</span></button>`)}
        </div>
        <span class="sp"></span>
        ${ctx.device === 'desktop' ? html`<span class="hint">ההרשאות נקבעות לכל יומן בנפרד</span>` : nothing}
        ${this.canManageAll() ? html`<a class="btn sm" href=${this.href('/new')} data-new-calendar><sw-icon name="plus" size="14"></sw-icon>יומן חדש</a>` : nothing}
      </div>
      ${list.length ? html`<div class="list">${pg.items.map((c, i) => this.calRow(c, i >= pg.items.length - 2))}</div>` : html`<div class="center"><span class="muted">אין יומנים מהסוג הזה</span></div>`}
      ${this.pager(pg.page, pg.pages)}
    </section>
    ${this.confirmArchive ? this.archiveDialog(this.confirmArchive) : nothing}`;
  }

  private syncChip(c: Calendar) {
    if (!c.sync) return html`<span class="chip" data-sync="none">ללא סנכרון</span>`;
    const p = PROVIDER_LABEL[c.sync.provider] ?? c.sync.provider;
    if (c.sync.state === 'ok') return html`<span class="chip ok" data-sync="ok">${p} · מסונכרן</span>`;
    if (c.sync.state === 'needs_reauth') return html`<span class="chip warn" data-sync="reauth">${p} · נדרשת הרשאה</span>`;
    if (c.sync.state === 'paused') return html`<span class="chip" data-sync="paused">${p} · מושהה</span>`;
    return html`<span class="chip bad" data-sync="error">${p} · תקלה</span>`;
  }

  private calRow(c: Calendar, up: boolean) {
    const ctx = this.ctx as CalCtx;
    const dev = ctx.device;
    const mgr = c.owner?.name ? html`${c.owner.name}` : html`<span class="missing">חסר מנהל</span>`;
    const where = [c.floor_name, c.capacity ? `${c.capacity.toLocaleString('he-IL')} מקומות` : '', c.equipment.length ? `${c.equipment.length} פריטי ציוד` : ''].filter(Boolean).join(' · ');
    const pending = c.pending_count ? html`<span class="chip dash num">${c.pending_count > 999 ? '999+' : c.pending_count.toLocaleString('he-IL')} ממתינות</span>` : nothing;
    const go = () => (location.hash = this.href(`/${encodeURIComponent(c.id)}`));
    if (dev === 'phone') {
      return html`<div class="row" data-cal-row=${c.id} @click=${go}><span class="sq" style=${`--h:${colorVar(c.color)}`}></span>
        <div class="grow"><div class="name ell" title=${c.name}>${c.name}</div><div class="sub ell">${TYPE_LABEL[c.type]} · ${mgr}</div></div>${pending}</div>`;
    }
    return html`<div class="row" data-cal-row=${c.id}>
      <span class="sq" style=${`--h:${colorVar(c.color)}`}></span>
      <div class="cname" @click=${go}><div class="name ell" title=${c.name}>${c.name}</div>
        <div class="sub ell">${dev === 'tablet' ? html`${TYPE_LABEL[c.type]} · מנהל: ${mgr} · ${APPROVAL_LABEL[c.approval_mode]}` : where || ' '}</div></div>
      ${dev === 'desktop' ? html`<span class="type"><sw-icon name=${TYPE_ICON[c.type]} size="14"></sw-icon>${TYPE_LABEL[c.type]}</span>
        <div class="mgr ell" title=${c.owner?.name ?? ''}><span class="sub">מנהל: </span><b>${mgr}</b></div>
        <span class=${`chip ${APPROVAL_LOOK[c.approval_mode]}`}>${APPROVAL_LABEL[c.approval_mode]}</span>` : nothing}
      <span class="sp"></span>
      ${pending}${this.syncChip(c)}
      ${dev === 'desktop' ? html`<span class="myrole ell">${c.my_role ? ROLE_LABEL[c.my_role] : '—'}</span>` : nothing}
      <div class="menuwrap"><button type="button" class="btn icon sm" aria-label="פעולות" aria-haspopup="menu" aria-expanded=${String(this.menuFor === c.id)} data-cal-menu=${c.id}
        @click=${() => (this.menuFor = this.menuFor === c.id ? '' : c.id)}><sw-icon name="more" size="16"></sw-icon></button>
        ${this.menuFor === c.id ? html`<div class=${`menu ${up ? 'up' : ''}`} role="menu">
          <button type="button" role="menuitem" @click=${go}><sw-icon name="users" size="14"></sw-icon>חברים ותפקידים</button>
          ${c.my_role === 'manage' ? html`<button type="button" role="menuitem" data-edit-rules @click=${() => { this.menuFor = ''; this.openEdit(c); }}><sw-icon name="edit" size="14"></sw-icon>כללי היומן</button>` : nothing}
          ${this.canManageAll() ? html`<button type="button" role="menuitem" class="bad" data-archive=${c.id} @click=${() => { this.menuFor = ''; this.confirmArchive = c; this.formErr = ''; }}><sw-icon name="trash" size="14"></sw-icon>העברה לארכיון</button>` : nothing}
        </div>` : nothing}</div>
    </div>`;
  }

  private pager(page: number, pages: number) {
    return html`<div class="pager" data-pager><button type="button" class="btn" aria-label="הקודם" ?disabled=${page <= 1} @click=${() => (this.page = page - 1)}><sw-icon name="chevron" size="14"></sw-icon></button>
      <span class="num" data-page>${page} / ${pages}</span>
      <button type="button" class="btn" aria-label="הבא" ?disabled=${page >= pages} @click=${() => (this.page = page + 1)}><sw-icon name="chevronBack" size="14"></sw-icon></button></div>`;
  }

  private archiveDialog(c: Calendar) {
    return html`<div class="scrim" @click=${() => (this.confirmArchive = null)}></div>
      <aside class="panel overlay" style="inset-block:auto 12px" role="dialog" aria-label="העברה לארכיון" data-archive-dialog>
        <div class="ph"><h2 class="ell">להעביר את "${c.name}" לארכיון?</h2></div>
        <div class="muted">היומן יוסתר מכל המסכים. ההזמנות שכבר היו נשמרות; אפשר להחזיר אותו מהארכיון.</div>
        ${this.formErr ? html`<div class="err" role="alert">${this.formErr}</div>` : nothing}
        <div class="formfoot"><button type="button" class="btn bad fill" ?disabled=${this.busy} data-archive-confirm @click=${() => void this.archive(c)}>העברה לארכיון</button>
          <button type="button" class="btn" @click=${() => (this.confirmArchive = null)}>ביטול</button></div>
      </aside>`;
  }

  private async archive(c: Calendar): Promise<void> {
    if (!this.ctx) return;
    this.busy = true;
    try {
      await this.ctx.api.archiveCalendar(c.id, c.revision);
      this.confirmArchive = null;
      emit(this, CAL_EVENTS.toast, `"${c.name}" הועבר לארכיון`);
      emit(this, CAL_EVENTS.changed);
    } catch (e) {
      this.formErr = e instanceof ApiError && e.status === 409 ? 'ביומן יש הזמנות עתידיות מאושרות. צריך לבטל או להעביר אותן לפני ההעברה לארכיון.' : describeError(e);
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- members

  private async loadMembers(id: string): Promise<void> {
    if (!this.ctx) return;
    this.members = null;
    this.memErr = '';
    this.rev = this.ctx.cals.find((c) => c.id === id)?.revision ?? 0;
    try {
      this.members = (await this.ctx.api.members(id)).members;
    } catch (e) {
      this.memErr = e instanceof ApiError && e.status === 403 ? 'רק מנהל היומן רואה ומשנה את החברים.' : describeError(e);
    }
    void this.loadPeople();
  }

  private async loadPeople(): Promise<void> {
    if (this.people.length) return;
    if (!isApi()) {
      const names = [...new Set((this.ctx?.cals ?? []).map((c) => c.owner?.name).filter(Boolean))] as string[];
      this.people = names.map((n, i) => ({ id: `demo-${i}`, name: n }));
      this.roles = [{ id: 'operator', name: 'מפעיל' }, { id: 'viewer', name: 'צופה' }, { id: 'site_admin', name: 'מנהל אתר' }];
      return;
    }
    try {
      const [u, r] = await Promise.all([listUsers(), listRoles()]);
      this.people = u.users.filter((x) => x.active).map((x) => ({ id: x.id, name: x.name || x.username }));
      this.roles = r.roles.map((x) => ({ id: x.id, name: r.labels[x.id] ?? x.name }));
    } catch {
      /* without the directory the member is typed by id */
    }
  }

  private async saveMembers(next: Member[], what: string): Promise<void> {
    if (!this.ctx) return;
    const id = this.ctx.sub;
    const before = this.members;
    this.members = next; // optimistic: the change shows at once and is saved
    this.memErr = '';
    try {
      this.members = (await this.ctx.api.putMembers(id, this.rev, next)).members;
      this.rev += 1;
      emit(this, CAL_EVENTS.toast, what);
    } catch (e) {
      this.members = before;
      this.memErr = e instanceof ApiError && e.code === 'stale' ? 'היומן עודכן בינתיים. הרשימה רועננה; נסו שוב.' : describeError(e);
      if (e instanceof ApiError && e.code === 'stale') void this.loadMembers(id);
    }
  }

  private rules(c: Calendar): string[] {
    const out = [APPROVAL_LABEL[c.approval_mode], `חפיפה: ${c.overlap_override ? OVERLAP_SHORT[c.overlap_override] : 'לפי ההתקנה'}`,
      c.visibility === 'members' ? 'גלוי לחברים; לאחרים "תפוס"' : c.visibility === 'busy_to_all' ? 'לכולם "תפוס"' : 'גלוי לכולם'];
    if (c.buffer_after_min) out.push(`${c.buffer_after_min} דק׳ הפסקה אחרי`);
    if (c.horizon_days) out.push(`עד ${c.horizon_days} יום קדימה`);
    if (c.min_minutes && c.max_minutes) out.push(`${c.min_minutes} דק׳ עד ${c.max_minutes >= 60 ? `${Math.round(c.max_minutes / 60)} שע׳` : `${c.max_minutes} דק׳`}`);
    return out;
  }

  private sidePanel(overlay: boolean) {
    const n = this.members?.length ?? 0;
    return html`<aside class=${`panel ${overlay ? 'overlay' : ''}`} aria-label="מה כל תפקיד מאפשר" data-roles-card>
      <div class="ph"><h2 style="font-size:var(--sw-fs-lg)">מה כל תפקיד מאפשר</h2>${overlay ? html`<span class="sp"></span><button type="button" class="btn icon sm" aria-label="סגירה" @click=${() => (this.side = false)}><sw-icon name="close" size="14"></sw-icon></button>` : nothing}</div>
      <div class="rights">${CAL_ROLES.map((r) => html`<div class="rt"><b>${ROLE_LABEL[r]}</b><span>${ROLE_HINT[r]}</span></div>`)}</div>
      <div class="note"><sw-icon name="info" size="16"></sw-icon><div><b>התפקיד ביומן לא עוקף את המערכת</b><span class="muted">הזמנה בשם חוג או לקוח, חלונות תחזוקה ופרטי אורחים דורשים גם הרשאה במערכת.</span></div></div>
      <span class="sp"></span><div class="muted num">${n.toLocaleString('he-IL')} מתוך ${MAX_MEMBERS} שורות חברות ביומן</div>
    </aside>`;
  }

  private membersScreen(id: string) {
    const ctx = this.ctx as CalCtx;
    const c = ctx.cals.find((x) => x.id === id);
    if (!c) {
      return html`<section class="panel main"><div class="center"><sw-state-panel state="empty" icon="calendar" heading="היומן לא נמצא" hint="ייתכן שהועבר לארכיון או שאין לך גישה אליו."
        actionLabel="לכל היומנים" @action=${() => (location.hash = this.href(''))}></sw-state-panel></div></section>`;
    }
    const phone = ctx.device === 'phone';
    const manage = c.my_role === 'manage';
    const sideMode = ctx.device === 'desktop' || this.shrink ? 'inline' : 'overlay';
    const rules = this.rules(c);
    const shownRules = phone ? rules.slice(0, 2) : rules;
    const all = this.members ?? [];
    // the table's head row takes its own height from the space the member rows share
    const per = this.listH ? rowsThatFit(this.listH - (phone ? 0 : 46), Math.max(phone ? 62 : 54, this.rowH)) : phone ? 4 : 6;
    const pg = pageOf(all, this.page, per);
    return html`<section class="panel main" data-members=${c.id}>
      <div class="calhead">
        <a class="btn icon sm" href=${this.href('')} aria-label="לכל היומנים" data-back><sw-icon name="chevronBack" size="16"></sw-icon></a>
        <span class="sq" style=${`--h:${colorVar(c.color)}`}></span>
        <div class="grow"><h2 class="ell" title=${c.name}>${c.name}</h2>
          <div class="sub ell muted">${[TYPE_LABEL[c.type], c.floor_name, c.capacity ? `${c.capacity.toLocaleString('he-IL')} מקומות` : '', `מנהל: ${c.owner?.name || '—'}`].filter(Boolean).join(' · ')}</div></div>
        ${manage && !phone ? html`<button type="button" class="btn sm" data-edit-rules @click=${() => this.openEdit(c)}><sw-icon name="edit" size="14"></sw-icon>כללי היומן</button>` : nothing}
        ${manage ? html`<button type="button" class="btn sm pri" data-add-member @click=${() => { this.adding = !this.adding; this.addId = ''; }}><sw-icon name="plus" size="14"></sw-icon>${phone ? 'הוספה' : 'הוספת חבר'}</button>` : nothing}
        ${sideMode === 'overlay' && !phone ? html`<button type="button" class="btn icon sm" aria-label="מה כל תפקיד מאפשר" data-roles-open @click=${() => (this.side = true)}><sw-icon name="help" size="16"></sw-icon></button>` : nothing}
      </div>
      <div class="rulechips">${shownRules.map((t, i) => html`<span class=${`chip ${i === 0 && c.approval_mode !== 'none' ? 'acc' : ''}`}>${t}</span>`)}${rules.length > shownRules.length ? html`<span class="chip num">+${rules.length - shownRules.length}</span>` : nothing}</div>
      <div class="ph"><h2 style="font-size:var(--sw-fs-lg)">חברים ותפקידים</h2><span class="sp"></span>${phone ? nothing : html`<span class="hint">${manage ? 'שינוי תפקיד נשמר מיד ונרשם ביומן הפעולות' : 'רק מנהל היומן משנה תפקידים'}</span>`}</div>
      ${this.adding && manage ? this.addRow(c) : nothing}
      ${this.memErr ? html`<div class="note bad" role="alert" data-members-error>${this.memErr}</div>` : nothing}
      ${!this.members && !this.memErr ? html`<div class="tablewrap" style="flex:1">${Array.from({ length: 4 }, () => html`<div class="skel" style="block-size:44px;margin-block-end:6px"></div>`)}</div>`
        : html`<div class="tablewrap" style="flex:1;min-block-size:0;overflow:hidden">${phone ? html`<div class="list">${pg.items.map((m) => this.memberCard(c, m))}</div>` : this.memberTable(c, pg.items, manage)}</div>`}
      ${this.pager(pg.page, pg.pages)}
    </section>
    ${phone ? nothing : sideMode === 'inline' ? this.sidePanel(false) : this.side ? html`<div class="scrim" @click=${() => (this.side = false)}></div>${this.sidePanel(true)}` : nothing}`;
  }

  private isOwner(c: Calendar, m: Member): boolean {
    return m.subject_kind === 'user' && m.subject_id === c.owner?.id;
  }

  private memberTable(c: Calendar, rows: Member[], manage: boolean) {
    const tablet = this.ctx?.device === 'tablet';
    return html`<table class="t"><colgroup><col style="inline-size:${tablet ? 84 : 110}px"><col><col style="inline-size:${tablet ? 330 : 380}px"><col style="inline-size:56px"></colgroup>
      <thead><tr><th>סוג</th><th>מי</th><th>תפקיד ביומן</th><th><span class="vh">הסרה</span></th></tr></thead>
      <tbody>${rows.map((m) => {
        const owner = this.isOwner(c, m);
        return html`<tr data-member=${`${m.subject_kind}:${m.subject_id}`}>
          <td>${KIND_LABEL[m.subject_kind]}</td>
          <td><div style="display:flex;gap:6px;align-items:center;min-inline-size:0"><span class="who ell" title=${m.label}>${m.label || m.subject_id}</span>
            ${owner ? html`<span class="chip">מנהל אחראי</span>` : m.subject_kind === 'everyone' ? html`<span class="chip">רואים רק "תפוס"</span>` : nothing}</div></td>
          <td><span class="rolepick" role="group" aria-label=${`תפקיד של ${m.label}`}>${CAL_ROLES.map((r) => html`<button type="button" aria-pressed=${String(m.cal_role === r)} data-role=${r}
            ?disabled=${!manage || owner} @click=${() => this.setRole(m, r)}>${ROLE_LABEL[r]}</button>`)}</span></td>
          <td>${owner || !manage ? nothing : html`<button type="button" class="btn icon sm" aria-label=${`הסרת ${m.label}`} data-remove @click=${() => this.removeMember(m)}><sw-icon name="close" size="14"></sw-icon></button>`}</td>
        </tr>`;
      })}</tbody></table>`;
  }

  private memberCard(c: Calendar, m: Member) {
    const owner = this.isOwner(c, m);
    return html`<div class="row" data-member=${`${m.subject_kind}:${m.subject_id}`}><div class="grow"><div class="name ell">${m.label || m.subject_id}</div>
      <div class="sub">${KIND_LABEL[m.subject_kind]}${owner ? ' · מנהל אחראי' : ''}</div></div>
      ${c.my_role === 'manage' && !owner ? html`<select class="inp" style="inline-size:auto;min-block-size:36px" aria-label="תפקיד" @change=${(e: Event) => this.setRole(m, (e.target as HTMLSelectElement).value as CalRole)}>
        ${CAL_ROLES.map((r) => html`<option value=${r} ?selected=${m.cal_role === r}>${ROLE_LABEL[r]}</option>`)}</select>` : html`<span class=${`chip ${m.cal_role === 'manage' ? 'acc' : ''}`}>${ROLE_LABEL[m.cal_role]}</span>`}</div>`;
  }

  private setRole(m: Member, r: CalRole): void {
    if (m.cal_role === r || !this.members) return;
    void this.saveMembers(this.members.map((x) => (x === m ? { ...x, cal_role: r } : x)), `${m.label}: ${ROLE_LABEL[r]}`);
  }

  private removeMember(m: Member): void {
    if (!this.members) return;
    void this.saveMembers(this.members.filter((x) => x !== m), `${m.label} הוסר מהיומן`);
  }

  private addRow(c: Calendar) {
    const opts = this.addKind === 'user' ? this.people : this.addKind === 'role' ? this.roles : [];
    const taken = new Set((this.members ?? []).map((m) => `${m.subject_kind}:${m.subject_id}`));
    const full = (this.members?.length ?? 0) >= MAX_MEMBERS;
    return html`<div class="addrow" data-add-row>
      <select class="inp k" aria-label="סוג" @change=${(e: Event) => { this.addKind = (e.target as HTMLSelectElement).value as Member['subject_kind']; this.addId = ''; }}>
        ${(['user', 'role', 'department', 'everyone'] as const).map((k) => html`<option value=${k} ?selected=${k === this.addKind}>${KIND_LABEL[k]}</option>`)}</select>
      ${this.addKind === 'everyone' ? html`<span class="grow muted">כל מי שיש לו צפייה ביומנים</span>`
        : opts.length ? html`<select class="inp" aria-label="מי" @change=${(e: Event) => (this.addId = (e.target as HTMLSelectElement).value)} data-add-who>
            <option value="" ?selected=${!this.addId}>בחירה…</option>${opts.filter((o) => !taken.has(`${this.addKind}:${o.id}`) && o.id !== c.owner?.id).map((o) => html`<option value=${o.id}>${o.name}</option>`)}</select>`
        : html`<input class="inp" aria-label="מזהה" placeholder=${this.addKind === 'department' ? 'מזהה המחלקה' : 'מזהה'} .value=${this.addId} @input=${(e: Event) => (this.addId = (e.target as HTMLInputElement).value.trim())} data-add-who>`}
      <select class="inp k" aria-label="תפקיד" @change=${(e: Event) => (this.addRole = (e.target as HTMLSelectElement).value as CalRole)}>
        ${CAL_ROLES.map((r) => html`<option value=${r} ?selected=${r === this.addRole}>${ROLE_LABEL[r]}</option>`)}</select>
      <button type="button" class="btn sm pri" ?disabled=${full || (this.addKind !== 'everyone' && !this.addId) || taken.has(`${this.addKind}:${this.addKind === 'everyone' ? '*' : this.addId}`)} data-add-confirm
        @click=${() => this.add(opts)}>הוספה</button>
      ${full ? html`<span class="err">הגעת ל-${MAX_MEMBERS} שורות. אפשר לצרף תפקיד או מחלקה במקום אנשים בודדים.</span>` : nothing}
    </div>`;
  }

  private add(opts: { id: string; name: string }[]): void {
    const id = this.addKind === 'everyone' ? '*' : this.addId;
    const label = this.addKind === 'everyone' ? 'כל מי שיש לו צפייה ביומנים' : opts.find((o) => o.id === id)?.name ?? id;
    this.adding = false;
    void this.saveMembers([...(this.members ?? []), { subject_kind: this.addKind, subject_id: id, label, cal_role: this.addRole }], `${label} נוסף/ה כ${ROLE_LABEL[this.addRole]}`);
  }

  // ---------------------------------------------------------------- new calendar / its rules

  private blank(): Draft {
    return { name: '', type: 'room', color: 'blue', capacity: '', approval: 'none', override: '', owner: '', buffer: '', horizon: '' };
  }

  private openEdit(c: Calendar): void {
    this.editing = c;
    this.formErr = '';
    this.draft = { name: c.name, type: c.type, color: c.color, capacity: c.capacity ? String(c.capacity) : '', approval: c.approval_mode, override: c.overlap_override ?? '', owner: c.owner?.id ?? '',
      buffer: c.buffer_after_min !== undefined ? String(c.buffer_after_min) : '', horizon: c.horizon_days !== undefined ? String(c.horizon_days) : '' };
    void this.loadPeople();
  }

  /** Owner answer 9 as the setting `override_scope`: which per-calendar overlap modes a calendar may choose. */
  private allowedOverrides(): OverlapMode[] {
    const scope = this.ctx?.access.ui.override_scope ?? 'both';
    if (scope === 'none') return [];
    if (scope === 'stricter') return OVERLAPS.filter((m) => STRICTNESS[m] >= STRICTNESS[this.instOverlap]);
    return OVERLAPS;
  }

  private formScreen() {
    const d = this.draft ?? this.blank();
    const edit = this.editing;
    const set = (p: Partial<Draft>) => (this.draft = { ...d, ...p });
    const overrides = this.allowedOverrides();
    const scope = this.ctx?.access.ui.override_scope ?? 'both';
    const room = d.type === 'room';
    return html`<section class="panel main" data-cal-form=${edit ? 'edit' : 'new'}>
      <div class="ph"><a class="btn icon sm" href=${this.href(edit ? `/${encodeURIComponent(edit.id)}` : '')} aria-label="חזרה" @click=${() => { this.editing = null; this.draft = null; }}><sw-icon name="chevronBack" size="16"></sw-icon></a>
        <h2>${edit ? `כללי היומן · ${edit.name}` : 'יומן חדש'}</h2></div>
      <div class="form">
        <div class="fld"><label for="cn">שם</label><input id="cn" class="inp" maxlength="80" .value=${d.name} @input=${(e: Event) => set({ name: (e.target as HTMLInputElement).value })} data-f-name></div>
        <div class="fld"><span class="lbl">סוג</span><div class="seg" role="group" aria-label="סוג">${CAL_TYPES.map((t) => html`<button type="button" aria-pressed=${String(d.type === t)} ?disabled=${!!edit && d.type !== t}
          data-f-type=${t} @click=${() => set({ type: t })}>${TYPE_LABEL[t]}</button>`)}</div></div>
        <div class="fld"><span class="lbl">צבע</span><div class="hues" role="group" aria-label="צבע">${HUES.map((h) => html`<button type="button" class="hue" style=${`--h:${colorVar(h)}`} aria-pressed=${String(d.color === h)}
          aria-label=${h} data-f-color=${h} @click=${() => set({ color: h })}></button>`)}</div></div>
        <div class="fld"><label for="co">מנהל</label><select id="co" class="inp" @change=${(e: Event) => set({ owner: (e.target as HTMLSelectElement).value })}>
          <option value="" ?selected=${!d.owner}>${edit ? edit.owner?.name || 'ללא שינוי' : 'אני'}</option>${this.people.filter((p) => !edit || p.id !== edit.owner?.id).map((p) => html`<option value=${p.id} ?selected=${d.owner === p.id}>${p.name}</option>`)}</select></div>
        ${room ? html`<div class="fld"><label for="cc">מקומות</label><input id="cc" class="inp num" type="number" min="1" max="2000" inputmode="numeric" .value=${d.capacity}
          @input=${(e: Event) => set({ capacity: (e.target as HTMLInputElement).value })}></div>` : nothing}
        <div class="fld"><label for="ca">אישור</label><select id="ca" class="inp" @change=${(e: Event) => set({ approval: (e.target as HTMLSelectElement).value as ApprovalMode })} data-f-approval>
          ${(Object.keys(APPROVAL_LABEL) as ApprovalMode[]).map((m) => html`<option value=${m} ?selected=${d.approval === m}>${APPROVAL_LABEL[m]}</option>`)}</select></div>
        ${room ? html`<div class="fld"><label for="cv">חפיפת תחזוקה</label>${overrides.length
          ? html`<select id="cv" class="inp" @change=${(e: Event) => set({ override: (e.target as HTMLSelectElement).value as OverlapMode | '' })} data-f-override>
              <option value="" ?selected=${!d.override}>לפי ההתקנה (${OVERLAP_SHORT[this.instOverlap]})</option>
              ${overrides.map((m) => html`<option value=${m} ?selected=${d.override === m}>${OVERLAP_SHORT[m]}</option>`)}</select>`
          : html`<span class="muted" data-f-override-off>לפי ההתקנה (${OVERLAP_SHORT[this.instOverlap]}). ההגדרות לא מאפשרות ליומן לקבוע אחרת.</span>`}</div>` : nothing}
        ${room ? html`<div class="fld"><label for="cb">הפסקה אחרי</label><input id="cb" class="inp num" type="number" min="0" max="240" inputmode="numeric" placeholder="דקות" .value=${d.buffer}
          @input=${(e: Event) => set({ buffer: (e.target as HTMLInputElement).value })}></div>` : nothing}
        <div class="fld"><label for="ch">טווח קדימה</label><input id="ch" class="inp num" type="number" min="1" max="730" inputmode="numeric" placeholder="ימים" .value=${d.horizon}
          @input=${(e: Event) => set({ horizon: (e.target as HTMLInputElement).value })}></div>
      </div>
      ${scope === 'stricter' && room ? html`<div class="muted">מנהל יומן יכול לבחור רק חפיפה מחמירה מההגדרה הכללית.</div>` : nothing}
      ${this.formErr ? html`<div class="err" role="alert" data-form-error>${this.formErr}</div>` : nothing}
      <div class="formfoot"><button type="button" class="btn pri" ?disabled=${this.busy || !d.name.trim()} data-f-save @click=${() => void this.saveForm()}><sw-icon name="check" size="16"></sw-icon>${edit ? 'שמירה' : 'יצירת היומן'}</button>
        <a class="btn" href=${this.href(edit ? `/${encodeURIComponent(edit.id)}` : '')} @click=${() => { this.editing = null; this.draft = null; }}>ביטול</a></div>
    </section>`;
  }

  private async saveForm(): Promise<void> {
    const d = this.draft;
    if (!this.ctx || !d) return;
    const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
    const room = d.type === 'room';
    const body: Record<string, unknown> = { name: d.name.trim(), color: d.color, approval_mode: d.approval, overlap_override: room ? d.override || null : null };
    if (room && num(d.capacity) !== undefined) body.capacity = num(d.capacity);
    if (room && num(d.buffer) !== undefined) body.buffer_after_min = num(d.buffer);
    if (num(d.horizon) !== undefined) body.horizon_days = num(d.horizon);
    if (d.owner) body.owner_user_id = d.owner;
    this.busy = true;
    this.formErr = '';
    try {
      if (this.editing) {
        const c = this.editing;
        await this.ctx.api.patchCalendar(c.id, { ...body, revision: c.revision });
        this.editing = null;
        this.draft = null;
        emit(this, CAL_EVENTS.toast, 'כללי היומן נשמרו');
        emit(this, CAL_EVENTS.changed);
      } else {
        const { calendar } = await this.ctx.api.createCalendar({ ...body, type: d.type } as Parameters<CalCtx['api']['createCalendar']>[0]);
        this.draft = null;
        emit(this, CAL_EVENTS.toast, `היומן "${calendar.name}" נוצר`);
        emit(this, CAL_EVENTS.changed);
        location.hash = this.href(`/${encodeURIComponent(calendar.id)}`);
      }
    } catch (e) {
      this.formErr = e instanceof ApiError ? (e.code === 'name_taken' ? 'כבר קיים יומן בשם הזה.' : e.code === 'too_many_calendars' ? 'הגעת למספר היומנים המרבי (הגדרות › יומנים).'
        : e.code === 'stale' ? 'היומן עודכן בינתיים. רעננו ונסו שוב.' : e.status === 422 ? `ערך לא תקין: ${describeError(e)}` : describeError(e)) : describeError(e);
    } finally {
      this.busy = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cal-view-manage': CalViewManage;
  }
}
