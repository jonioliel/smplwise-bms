import { LitElement, html, nothing, css } from 'lit';
import { liftRef, liftedReset } from '../components/top-layer';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { calendarsApi, cardOf, connErrorText, type CalSettings, type Calendar, type CalendarsApi, type Connection, type ProviderCard, type SyncFlag } from '../api/calendars';
import '../calendars/connect-dialogs';
import type { ConnectMode } from '../calendars/connect-dialogs';
import type { RouteState } from '../router';
import { refreshCalendars } from '../calendars/access';
import { PROVIDER_LABEL, colorVar, hm, pageOf, whenText } from '../calendars/model';
import { calCss } from '../calendars/styles';
import { leadReserveStyles } from '../styles/lead-reserve';
import { tablistKeydown } from '../components/a11y-keys';
import { LongListsController, perPageFor } from '../api/long-lists';
import { tr } from '../i18n/msg/system-a';
import { ToastController } from '../components/toast-controller';

const ORDER: ProviderCard[] = ['ical', 'google', 'microsoft'];
const STAGE: Record<ProviderCard, string> = { ical: tr('ראשון · ללא חשבון'), google: tr('שני'), microsoft: tr('שלישי') };
const LOGO: Record<ProviderCard, string> = { ical: 'iCal', google: 'G', microsoft: 'M' };
const DIRECTION: Record<string, string> = { export: tr('ייצוא'), import: tr('ייבוא'), two_way: tr('דו־כיווני') };
const DETAIL: Record<string, string> = { busy: tr('"תפוס" בלבד'), titles: tr('כותרות') };
const STATE: Record<Connection['state'], [string, string]> = {
  ok: ['ok', tr('פעיל')], error: ['bad', tr('שגיאה, ננסה שוב')], paused: ['', tr('מושהה')], needs_reauth: ['warn', tr('נדרשת הרשאה מחדש')], revoked: ['bad', tr('ההרשאה בוטלה')], pending: ['', tr('ממתין להגדרה')],
};

/** The words of a binding: direction (and "ייעודי" for a dedicated two-way calendar) and what leaves. */
function bindingText(b: Connection['bindings'][number]): string {
  const dir = DIRECTION[b.direction] ?? b.direction;
  return b.direction === 'two_way' ? `${dir}${b.dedicated ? ' · ' + tr('ייעודי') : ''}` : b.direction === 'export' ? `${dir} · ${DETAIL[b.detail] ?? b.detail}` : dir;
}

/** "לפני 6 דק׳" / "לפני 3 שע׳" / "לפני יומיים" */
export function agoText(iso: string | null, now: Date): string {
  if (!iso) return tr('טרם סונכרן');
  const min = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 1) return tr('עכשיו');
  if (min < 60) return tr('לפני {n} דק׳', { n: min });
  const h = Math.round(min / 60);
  if (h < 24) return tr('לפני {n} שע׳', { n: h });
  const d = Math.round(h / 24);
  return d === 1 ? tr('אתמול') : d === 2 ? tr('לפני יומיים') : tr('לפני {n} ימים', { n: d });
}

/**
 * CALENDARS-UI-2310: הגדרות › חיבורי יומן (#/system/calendar-sync). The providers in their order (iCal, Google, Microsoft; D2), each card with
 * its state, the bound calendars and what goes where, "סנכרון עכשיו", pause / resume / remove. A connection that needs a new authorisation
 * offers "הרשאה מחדש" and - owner answer 21 as a setting (`reauth_mode`, default with) - a manual "המשך". The entries the sync flagged for
 * a decision (C9: both kept) are listed with "להשאיר" / "לבטל". Arx never creates an account or keeps a password.
 * CALCONNECT-2330: the connect flow is reachable from each card (calendars/connect-dialogs.ts): "חיבור" / "המשך הגדרה" (the owner's own
 * client, then Google's consent with the pasted loopback address or Microsoft's device code; iCal: the secret address), "הרשאה מחדש",
 * "שיוך יומן" (binding needs connect + edit, owner answer 17) and, on the iCal card, the outgoing feeds. A failing connection shows its
 * status in words (auth expired, quota, rate limit ...). Needs calendar.connect (the server checks every call).
 */
@customElement('system-calendar-sync')
export class SystemCalendarSync extends LitElement {
  static styles = [calCss, leadReserveStyles, liftedReset, css`
    /* PAGING-SETTING-2439: the long lists scroll - the list box scrolls inside itself (the page never does) */
    :host([data-long-lists='scroll']) .flags { max-block-size: 40vh; overflow-y: auto; overscroll-behavior: contain; }
    :host { display: flex; flex-direction: column; min-block-size: 0; flex: 1; padding: 14px var(--sw-page-pad) 20px; gap: 12px; overflow: hidden; }
    .panel { flex: 1; }
    /* CALMSG-POLISH-2331: the title row sits above the panel like Settings › יומנים and every sw-page settings screen (crumb, the skin's h1) */
    h1 { margin: 0; font-family: var(--sw-font-heading, var(--sw-font)); font-size: var(--sw-h1, var(--sw-fs-2xl)); font-weight: var(--sw-h1-weight, var(--sw-fw-bold));
      letter-spacing: var(--sw-h1-tracking, -0.01em); line-height: 1.2; color: var(--sw-heading); }
    .head { display: flex; align-items: flex-end; gap: 10px 16px; flex-wrap: wrap; padding-inline-end: var(--sw-float-reserve, 0px); }
    .ttl { display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; }
    .crumb { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .state { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: none; max-inline-size: 50%; }
    /* the actions sit on the card's floor: three cards of different content keep one action line */
    .pcard > .acts { margin-block-start: auto; }
    .facts { display: flex; gap: 8px; flex: none; }
    .rulesh { margin-block-start: 4px; }
    .ro { font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-regular); color: var(--sw-text-3); }
    .flag .sub .ltr, .flag .name .ltr { display: inline-block; }
    h3 { margin: 0; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); display: flex; align-items: center; gap: 8px; }
    .lock { display: inline-flex; align-items: center; gap: 6px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .prov { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .pcard { background: var(--sw-surface-2); border-radius: var(--sw-r-xl); padding: 14px; display: flex; flex-direction: column; gap: 10px; min-inline-size: 0; }
    .pt { display: flex; align-items: flex-start; gap: 10px; }
    .logo { inline-size: 40px; block-size: 40px; border-radius: var(--sw-r-md); background: var(--sw-surface-solid); display: grid; place-items: center; font-weight: var(--sw-fw-bold);
      color: var(--sw-heading); font-size: var(--sw-fs-sm); flex: none; box-shadow: var(--sw-shadow-1); }
    .pt b { display: block; font-size: var(--sw-fs-xl); color: var(--sw-heading); }
    .pt .stage { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    li { display: flex; align-items: center; gap: 8px; background: var(--sw-surface-solid); border-radius: var(--sw-r-md); padding: 8px 10px; font-size: var(--sw-fs-sm); color: var(--sw-heading); min-inline-size: 0; }
    .acts { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .fine { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .flags { display: grid; gap: 8px; }
    .flag { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); min-inline-size: 0; }
    .warnico { inline-size: 32px; block-size: 32px; border-radius: 50%; background: var(--sw-danger-soft); color: var(--sw-danger-text); display: grid; place-items: center; flex: none; }
    .rules { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
    .rules .row { flex-wrap: wrap; gap: 8px 12px; }
    .err { background: var(--sw-danger-soft); color: var(--sw-danger-text); padding: 8px 12px; border-radius: var(--sw-r-md); font-size: var(--sw-fs-sm); }
    .toast { position: fixed; inset-block-end: 24px; inset-inline-start: 50%; transform: translateX(50%); background: var(--sw-toast-bg); color: var(--sw-toast-text); padding: 10px 16px;
      border-radius: var(--sw-r-pill); font-size: var(--sw-fs-md); z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-3); max-inline-size: calc(100vw - 32px); }
    .dlg p { margin: 0 0 10px; }
    @media (max-width: 1179px) { .rules { grid-template-columns: minmax(0, 1fr); } .wide-only { display: none; } }
    @media (max-width: 899px) { .prov { grid-template-columns: minmax(0, 1fr); gap: 8px; } .pcard { padding: 10px 12px; gap: 8px; } .lockline { display: none; } }
    @media (max-width: 699px) {
      :host { padding: 10px var(--sw-page-pad-phone); gap: 10px; }
      .panel { padding: 12px; gap: 10px; }
      .rules, .rulesh, .newbtn { display: none; }
      .flag { padding: 8px 10px; gap: 6px 8px; flex-wrap: wrap; }
      /* the two decisions go under the entry: the title was cut to a few words beside them */
      .flag .grow { flex-basis: calc(100% - 48px); }
      .facts { inline-size: 100%; justify-content: flex-end; }
      .crumb { display: none; }
      .toast { inset-block-end: calc(var(--sw-bottomnav-h) + 16px + env(safe-area-inset-bottom)); }
    }
  `];

  @property({ attribute: false }) route: RouteState | null = null;
  @state() private conns: Connection[] | null = null;
  @state() private flags: SyncFlag[] = [];
  @state() private cals: Calendar[] = [];
  @state() private s: CalSettings | null = null;
  @state() private canConfigure = false;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private actionError = '';
  @state() private removing: Connection | null = null;
  @state() private newOpen = false;
  @state() private flagPage = 1;
  /** PAGING-SETTING-2439 (owner round 32, Q-SYS-5): the long lists scroll (הגדרות › כללי) -> every item on one page, the list box scrolls
   * inside itself (api/long-lists.ts). */
  private lists = new LongListsController(this, () => (this.flagPage = 1));
  /** CR-CMP2-TOAST-2440 (07:F12): the flash message and its one timer (stopped when the element leaves the page). */
  private readonly toaster = new ToastController(this, { ms: 3200 });
  private get toastText(): string {
    return this.toaster.text;
  }
  @state() private compact = window.innerWidth < 1180 || window.innerHeight < 820;
  @state() private phone = window.innerWidth < 700;
  /** the phone shows one provider at a time (no page scroll); null = the one that needs attention, else the first */
  @state() private shownProvider: ProviderCard | null = null;
  /** CALCONNECT-2330: the open connect / bind / feeds dialog (a new object per opening) */
  @state() private dialog: ConnectMode | null = null;
  private api: CalendarsApi | null = null;
  private onResize = () => {
    this.compact = window.innerWidth < 1180 || window.innerHeight < 820;
    this.phone = window.innerWidth < 700;
  };

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this.onResize);
    void this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.onResize);
  }

  private async load(): Promise<void> {
    this.error = '';
    try {
      this.api ??= await calendarsApi();
      const [c, f, cals, s] = await Promise.all([this.api.connections(), this.api.syncFlags().catch(() => ({ flags: [] as SyncFlag[] })),
        this.api.calendars().catch(() => ({ calendars: [] as Calendar[] })), this.api.settings().catch(() => null)]);
      this.conns = c.connections;
      // the phone opens on the provider that needs attention and stays on it after an action resolves it
      const att = c.connections.find((x) => x.state !== 'ok' && x.state !== 'paused');
      this.shownProvider ??= att ? cardOf(att.provider) : null;
      this.flags = f.flags;
      this.cals = cals.calendars;
      this.s = s?.settings ?? null;
      this.canConfigure = !!s?.can_configure;
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) this.forbidden = true;
      else this.error = describeError(e);
    }
  }

  private dialogDone(message: string): void {
    this.dialog = null;
    if (message) this.toast(message);
    void this.load();
  }

  private fromNew(mode: ConnectMode): void {
    this.newOpen = false;
    this.open(mode);
  }

  private toast(t: string): void {
    this.toaster.show(t);
  }

  private async act(fn: () => Promise<unknown>, done: string): Promise<void> {
    this.actionError = '';
    try {
      await fn();
      this.toast(done);
      await this.load();
    } catch (e) {
      this.actionError = describeError(e);
    }
  }

  private calName(id: string): Calendar | undefined {
    return this.cals.find((c) => c.id === id);
  }

  render() {
    if (this.forbidden) return html`<sw-state-panel state="forbidden" data-sync-state="forbidden" heading=${tr('אין לך הרשאה לחיבורי יומן')} hint=${tr('ההרשאה "יומנים: חיבור יומנים חיצוניים" ניתנת על ידי הבעלים.')}></sw-state-panel>`;
    if (this.error) return html`<sw-state-panel state="error" data-sync-state="error" heading=${tr('לא הצלחנו לטעון את החיבורים')} hint=${this.error} actionLabel=${tr('לנסות שוב')} @action=${() => void this.load()}></sw-state-panel>`;
    if (!this.conns) return html`<div class="panel" data-sync-state="loading" role="status" aria-label=${tr('טוען')}><div class="prov">${ORDER.map(() => html`<div class="skel" style="block-size:180px"></div>`)}</div></div>`;
    const now = new Date();
    return html`
      <div class="head lead-head"><div class="ttl"><span class="crumb">${tr('הגדרות')}</span><h1>${tr('חיבורי יומן')}</h1></div><span class="sp"></span>
        <span class="lock lockline"><sw-icon name="lock" size="14"></sw-icon>${tr('Arx לא יוצר חשבונות ולא שומר סיסמאות')}</span>
        <button type="button" class="btn sm newbtn" data-sync-new @click=${() => (this.newOpen = true)}><sw-icon name="plus" size="14"></sw-icon>${tr('חיבור חדש')}</button></div>
      <section class="panel" data-sync-screen>
        ${this.actionError ? html`<div class="err" role="alert" data-sync-error>${this.actionError}</div>` : nothing}
        ${this.phone ? this.phoneProviders(now) : html`<div class="prov">${ORDER.map((p) => this.card(p, now))}</div>`}
        ${this.flagsBlock(now)}
        ${this.rules()}
      </section>
      ${this.dialogs()}
      ${this.toastText ? html`<div class="toast" role="status" data-sync-toast ${liftRef() /* DIALOG-TOPLAYER-2381: above an open sw-dialog */}>${this.toastText}</div>` : nothing}`;
  }

  private phoneProviders(now: Date) {
    const att = (this.conns ?? []).find((c) => c.state !== 'ok' && c.state !== 'paused');
    const cur = this.shownProvider ?? (att ? cardOf(att.provider) : null) ?? 'ical';
    return html`<div class="seg" role="tablist" aria-label=${tr('ספק')} data-provider-tabs @keydown=${tablistKeydown}>${ORDER.map((p) => {
      const c = this.connOf(p);
      return html`<button type="button" role="tab" style="flex:1" aria-pressed=${String(cur === p)} aria-selected=${String(cur === p)} data-provider-tab=${p} @click=${() => (this.shownProvider = p)}>${PROVIDER_LABEL[p]}${c && c.state !== 'ok' ? html` <span class="dot" aria-label=${tr('דורש טיפול')} style="display:inline-block;--h:var(--sw-warning)"></span>` : nothing}</button>`;
    })}</div>${this.card(cur, now)}`;
  }

  /** The connection a card shows: the first of its provider (both iCal kinds share the iCal card). */
  private connOf(p: ProviderCard): Connection | undefined {
    return (this.conns ?? []).find((x) => cardOf(x.provider) === p && x.provider !== 'ics_out') ?? (this.conns ?? []).find((x) => cardOf(x.provider) === p);
  }

  private open(mode: ConnectMode): void {
    this.actionError = '';
    this.dialog = mode;
  }

  private card(p: ProviderCard, now: Date) {
    const c = this.connOf(p);
    if (!c) {
      return html`<div class="pcard" data-provider=${p}><div class="pt"><span class="logo">${LOGO[p]}</span><div class="grow"><b>${PROVIDER_LABEL[p]}</b><div class="stage">${STAGE[p]}</div></div><span class="chip">${tr('לא מחובר')}</span></div>
        <div class="fine">${p === 'ical' ? tr('פיד יוצא או מנוי נכנס, בלי חשבון.') : tr('חשבון שהבעלים יוצר בעצמו אצל הספק.')}</div>
        <div class="acts"><button type="button" class="btn pri sm" data-connect @click=${() => this.open({ kind: 'connect', card: p, conn: null })}>${p === 'ical' ? tr('מנוי iCal') : tr('חיבור')}</button>
          ${p === 'ical' ? html`<button type="button" class="btn sm" data-feeds @click=${() => this.open({ kind: 'feeds' })}>${tr('פידים יוצאים')}</button>` : nothing}</div></div>`;
    }
    const pendingSetup = !!c.setup && !c.setup.ready && c.state !== 'needs_reauth';
    const [look, label] = pendingSetup ? STATE.pending : STATE[c.state] ?? ['', c.state];
    const max = this.phone ? 2 : this.compact ? 1 : 2;
    const shown = c.bindings.slice(0, max);
    const rest = c.bindings.length - shown.length;
    const reauth = c.state === 'needs_reauth';
    const cont = reauth && (this.s?.reauth_mode ?? 'reauth_and_continue') === 'reauth_and_continue';
    return html`<div class="pcard" data-provider=${p} data-conn=${c.id} data-conn-state=${c.state}>
      <div class="pt"><span class="logo">${LOGO[p]}</span><div class="grow"><b>${PROVIDER_LABEL[p]}</b><div class="stage ell">${STAGE[p]}${p === 'ical' ? '' : ` · ${tr('{name} חיברה', { name: c.owner.name })}`}</div></div><div class="state"><span class=${`chip ${look}`}>${label}</span>${!reauth && c.state !== 'paused' && !pendingSetup ? html`<span class="fine num" data-last-sync title=${tr('הסנכרון האחרון')}>${agoText(c.last_sync_at, now)}</span>` : nothing}</div></div>
      ${reauth ? html`<div class="fine">${tr('ההרשאה פגה {ago}. Arx ממשיך לעבוד מהיומן שלו; השינויים יישלחו אחרי ההרשאה.', { ago: agoText(c.last_sync_at, now) })}</div>` : nothing}
      ${c.state === 'error' && c.error_code ? html`<div class="fine" role="status" data-conn-error=${c.error_code}>${connErrorText(c.error_code)}</div>` : nothing}
      ${pendingSetup ? html`<div class="fine" data-conn-pending>${p === 'ical' ? tr('חסרה כתובת ה־iCal.') : c.setup?.client_id_set ? tr('נשאר לאשר אצל הספק.') : tr('חסרים פרטי האפליקציה שלך אצל הספק.')}</div>` : nothing}
      ${shown.length ? html`<ul>${shown.map((b) => { const cal = this.calName(b.calendar_id); return html`<li><span class="dot" style=${`--h:${colorVar(cal?.color)}`}></span><span class="grow ell" title=${cal?.name ?? ''}>${cal?.name ?? tr('יומן')}</span><span class=${`chip ${b.direction === 'two_way' ? 'acc' : ''}`}>${bindingText(b)}</span></li>`; })}
        ${rest > 0 ? html`<li><span class="grow fine">${tr('ועוד {n} יומנים', { n: rest })}</span></li>` : nothing}</ul>` : html`<div class="fine">${tr('אין עדיין יומן משויך.')}</div>`}
      <div class="acts">
        ${pendingSetup ? html`<button type="button" class="btn pri sm" data-setup @click=${() => this.open({ kind: 'connect', card: p, conn: c })}>${tr('המשך הגדרה')}</button>`
          : !reauth && c.state !== 'paused' ? html`<button type="button" class="btn sm" data-bind @click=${() => this.open({ kind: 'bind', conn: c })}>${tr('שיוך יומן')}</button>` : nothing}
        ${p === 'ical' && !this.phone ? html`<button type="button" class="btn sm wide-only" data-feeds @click=${() => this.open({ kind: 'feeds' })}>${tr('פידים יוצאים')}</button>` : nothing}
        ${reauth ? html`<button type="button" class="btn pri sm" data-reauth @click=${() => this.open({ kind: 'connect', card: p, conn: c })}>${tr('הרשאה מחדש אצל {provider}', { provider: PROVIDER_LABEL[p] })}</button>
          ${cont ? html`<button type="button" class="btn sm" data-continue @click=${() => void this.act(() => (this.api as CalendarsApi).resumeConnection(c.id), tr('החיבור ממשיך; אם הספק עדיין מסרב, הוא יחזור לבקש הרשאה'))}>${tr('המשך')}</button>` : nothing}`
          : c.state === 'paused' ? html`<button type="button" class="btn sm" data-resume @click=${() => void this.act(() => (this.api as CalendarsApi).resumeConnection(c.id), tr('החיבור חודש'))}>${tr('חידוש')}</button>`
          : pendingSetup ? nothing
          : html`<button type="button" class="btn sm" data-sync-now @click=${() => void this.act(() => (this.api as CalendarsApi).syncNow(c.id), tr('הסנכרון התחיל'))}><sw-icon name="refresh" size="14"></sw-icon>${tr('סנכרון עכשיו')}</button>
            <button type="button" class="btn sm wide-only" data-pause @click=${() => void this.act(() => (this.api as CalendarsApi).pauseConnection(c.id), tr('החיבור הושהה'))}>${tr('השהיה')}</button>`}
        ${reauth || c.state === 'paused' || pendingSetup ? html`<button type="button" class="btn sm bad" data-remove @click=${() => (this.removing = c)}>${tr('ניתוק')}</button>` : nothing}
      </div></div>`;
  }

  private flagsBlock(now: Date) {
    if (!this.flags.length) return html`<h3 data-flags-empty>${tr('סומנו להחלטה')} <span class="chip ok">${tr('אין')}</span></h3>`;
    const per = this.phone ? 2 : this.compact ? 2 : 3;
    const p = pageOf(this.flags, this.flagPage, perPageFor(this.lists.paged, per, this.flags.length));
    return html`<h3>${tr('סומנו להחלטה')} <span class="count num" data-flags-count>${this.flags.length}</span></h3>
      <div class="flags">${p.items.map((f) => html`<div class="flag" data-flag=${f.event_id}><span class="warnico"><sw-icon name="warning" size="16"></sw-icon></span>
        <div class="grow"><div class="name ell" title=${f.title ?? ''}>${f.flag === 'deleted_external' ? tr('"{title}" נמחק ביומן החיצוני', { title: f.title ?? tr('אירוע') }) : f.title ?? tr('התנגשות')}${f.flag === 'conflict' ? html` <span class="num ltr">${hm(f.start)}–${hm(f.end)}</span>` : nothing}</div>
          <div class="sub ell">${f.calendar.name} · ${f.flag === 'conflict' ? tr('התנגשות: שתי ההזמנות נשמרו') : tr('נשמר ב־Arx ולא מתפרסם עד החלטה')} · ${this.when(f.start, f.end, now)}</div></div>
        <span class="facts"><button type="button" class="btn sm" data-flag-keep @click=${() => void this.act(() => (this.api as CalendarsApi).resolveFlag(f.event_id, f.revision, 'keep'), tr('נשאר'))}>${tr('להשאיר')}</button>
        <button type="button" class="btn sm bad" data-flag-cancel @click=${() => void this.act(() => (this.api as CalendarsApi).resolveFlag(f.event_id, f.revision, 'cancel'), tr('בוטל'))}>${tr('לבטל')}</button></span></div>`)}</div>
      ${p.pages > 1 ? html`<div class="pager"><button type="button" class="btn icon" aria-label=${tr('הקודם')} ?disabled=${p.page <= 1} @click=${() => (this.flagPage = p.page - 1)}><sw-icon name="chevronBack" size="16"></sw-icon></button>
        <span class="num">${p.page} / ${p.pages}</span><button type="button" class="btn icon" aria-label=${tr('הבא')} ?disabled=${p.page >= p.pages} @click=${() => (this.flagPage = p.page + 1)}><sw-icon name="chevron" size="16"></sw-icon></button></div>` : nothing}`;
  }

  /** The sync rules that are settings (owner answers 18, 21, 22); editable with calendar.configure. */
  private rules() {
    if (!this.s) return nothing;
    const s = this.s;
    const rows: [keyof CalSettings, string, string, [string, string][]][] = [
      ['sync_external_delete', tr('מחיקה מבחוץ של אירוע מ־Arx'), tr('ברירת מחדל: מבוטל ב־Arx'), [['cancel', tr('מבוטל ב־Arx')], ['flag', tr('נשאר ומסומן')]]],
      ['reauth_mode', tr('חיבור שדורש הרשאה מחדש'), tr('ברירת מחדל: הרשאה + "המשך"'), [['reauth_and_continue', tr('הרשאה + "המשך"')], ['reauth_only', tr('הרשאה בלבד')]]],
      ['sync_conflict_display', tr('התנגשות בתצוגת השבוע'), tr('ברירת מחדל: זו לצד זו, מסגרת אדומה'), [['side_by_side', tr('זו לצד זו')], ['list_only', tr('רק ברשימה')]]],
      ['sync_google_scope', tr('היקף הרשאת Google'), tr('ברירת מחדל: יומן מלא, אושר מראש'), [['full', tr('יומן מלא')], ['events', tr('אירועים בלבד')]]],
    ];
    return html`<h3 class="rulesh">${tr('כללי הסנכרון')}${this.canConfigure ? nothing : html` <span class="ro">${tr('צפייה בלבד: שינוי דורש את ההרשאה "יומנים: הגדרות"')}</span>`}</h3>
      <div class="rules" data-sync-rules>${rows.map(([k, name, def, opts]) => html`<div class="row" data-setting=${k}><div class="grow"><div class="name ell">${name}</div><div class="sub">${def}</div></div>
      <sw-segmented radio label=${name} value=${String(s[k])} ?disabled=${!this.canConfigure} @change=${(e: CustomEvent<SegmentedChange>) => void this.saveRule(k, e.detail.value)}
        .options=${opts.map(([v, l]) => ({ value: v, label: l, attrs: { 'data-opt': v } }))}></sw-segmented></div>`)}</div>`;
  }

  /** "ב׳ 26.10 · 10:00–11:30" with the time range as one isolated LTR run (in the RTL line it read "11:30–10:00"). */
  private when(start: string, end: string, now: Date) {
    const t = whenText(start, end, now);
    const i = t.lastIndexOf(' · ');
    return i < 0 ? t : html`${t.slice(0, i + 3)}<span class="num ltr">${t.slice(i + 3)}</span>`;
  }

  private async saveRule(k: keyof CalSettings, v: string): Promise<void> {
    if (!this.s || !this.api || this.s[k] === v) return;
    const before = this.s;
    this.s = { ...this.s, [k]: v } as CalSettings;
    try {
      this.s = (await this.api.saveSettings(this.s)).settings;
      void refreshCalendars();
    } catch (e) {
      this.s = before;
      this.actionError = describeError(e);
    }
  }

  private dialogs() {
    if (this.dialog) {
      return html`<cal-connect-dialog .api=${this.api} .mode=${this.dialog} .cals=${this.cals} .feedsEnabled=${this.s?.feeds_enabled !== false}
        @cal-dialog-done=${(e: CustomEvent<{ message: string }>) => this.dialogDone(e.detail?.message ?? '')}></cal-connect-dialog>`;
    }
    if (this.removing) {
      const c = this.removing;
      return html`<sw-dialog open heading=${tr('לנתק את {provider}?', { provider: PROVIDER_LABEL[c.provider] })} data-remove-confirm @close=${() => (this.removing = null)}><div class="dlg"><p>${tr('ההרשאה תבוטל אצל הספק והמפתחות יימחקו.')}
        ${tr('השיוך של {n} יומנים יוסר; האירועים ב־Arx נשארים.', { n: c.bindings.length })}</p></div>
        <button slot="footer" type="button" class="btn" @click=${() => (this.removing = null)}>${tr('ביטול')}</button>
        <button slot="footer" type="button" class="btn bad fill" data-remove-ok @click=${() => { this.removing = null; void this.act(() => (this.api as CalendarsApi).removeConnection(c.id), tr('החיבור נותק')); }}>${tr('ניתוק')}</button></sw-dialog>`;
    }
    if (this.newOpen) {
      return html`<sw-dialog open heading=${tr('חיבור חדש')} data-new-dialog @close=${() => (this.newOpen = false)}><div class="dlg">
        <p>${tr('הסדר הוא iCal, אחר כך Google, אחר כך Microsoft. Arx לא יוצר חשבון ולא שומר סיסמה: הבעלים יוצר את האפליקציה אצל הספק, מדביק את המזהה והסוד, ומאשר בעצמו בדפדפן.')}</p>
        <div class="acts" data-new-providers>${ORDER.map((p) => html`<button type="button" class="btn sm" data-new-provider=${p} @click=${() => this.fromNew({ kind: 'connect', card: p, conn: null })}>${p === 'ical' ? tr('מנוי iCal') : PROVIDER_LABEL[p]}</button>`)}
          <button type="button" class="btn sm" data-new-feeds @click=${() => this.fromNew({ kind: 'feeds' })}>${tr('פיד iCal יוצא')}</button></div></div>
        <button slot="footer" type="button" class="btn" @click=${() => (this.newOpen = false)}>${tr('סגירה')}</button></sw-dialog>`;
    }
    return nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-calendar-sync': SystemCalendarSync;
  }
}
