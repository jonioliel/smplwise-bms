import { LitElement, html, nothing, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { calendarsApi, type CalSettings, type Calendar, type CalendarsApi, type Connection, type SyncFlag } from '../api/calendars';
import type { RouteState } from '../router';
import { refreshCalendars } from '../calendars/access';
import { PROVIDER_LABEL, colorVar, hm, pageOf, whenText } from '../calendars/model';
import { calCss } from '../calendars/styles';
import { leadReserveStyles } from '../styles/lead-reserve';

const ORDER: Connection['provider'][] = ['ical', 'google', 'microsoft'];
const STAGE: Record<Connection['provider'], string> = { ical: 'ראשון · ללא חשבון', google: 'שני', microsoft: 'שלישי' };
const LOGO: Record<Connection['provider'], string> = { ical: 'iCal', google: 'G', microsoft: 'M' };
const DIRECTION: Record<string, string> = { export: 'ייצוא', import: 'ייבוא', two_way: 'דו־כיווני' };
const DETAIL: Record<string, string> = { busy: '"תפוס" בלבד', titles: 'כותרות' };
const STATE: Record<Connection['state'], [string, string]> = {
  ok: ['ok', 'פעיל'], error: ['bad', 'שגיאה, ננסה שוב'], paused: ['', 'מושהה'], needs_reauth: ['warn', 'נדרשת הרשאה מחדש'], revoked: ['bad', 'ההרשאה בוטלה'], pending: ['', 'ממתין להגדרה'],
};

/** The words of a binding: direction (and "ייעודי" for a dedicated two-way calendar) and what leaves. */
export function bindingText(b: Connection['bindings'][number]): string {
  const dir = DIRECTION[b.direction] ?? b.direction;
  return b.direction === 'two_way' ? `${dir}${b.dedicated ? ' · ייעודי' : ''}` : b.direction === 'export' ? `${dir} · ${DETAIL[b.detail] ?? b.detail}` : dir;
}

/** "לפני 6 דק׳" / "לפני 3 שע׳" / "לפני יומיים" */
export function agoText(iso: string | null, now: Date): string {
  if (!iso) return 'טרם סונכרן';
  const min = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'עכשיו';
  if (min < 60) return `לפני ${min} דק׳`;
  const h = Math.round(min / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : d === 2 ? 'לפני יומיים' : `לפני ${d} ימים`;
}

/**
 * CALENDARS-UI-2310: הגדרות › חיבורי יומן (#/system/calendar-sync). The providers in their order (iCal, Google, Microsoft; D2), each card with
 * its state, the bound calendars and what goes where, "סנכרון עכשיו", pause / resume / remove. A connection that needs a new authorisation
 * offers "הרשאה מחדש" and - owner answer 21 as a setting (`reauth_mode`, default with) - a manual "המשך". The entries the sync flagged for
 * a decision (C9: both kept) are listed with "להשאיר" / "לבטל". Arx never creates an account or keeps a password; the owner's own OAuth
 * flow is phase 5 and is not reachable from here yet. Needs calendar.connect (the server checks every call).
 */
@customElement('system-calendar-sync')
export class SystemCalendarSync extends LitElement {
  static styles = [calCss, leadReserveStyles, css`
    :host { display: flex; flex-direction: column; min-block-size: 0; flex: 1; padding: 14px var(--sw-page-pad) 20px; gap: 12px; overflow: hidden; }
    .panel { flex: 1; }
    h1 { margin: 0; font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
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
      .rules, .newbtn { display: none; }
      .flag { padding: 8px 10px; gap: 8px; }
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
  @state() private toastText = '';
  @state() private compact = window.innerWidth < 1180 || window.innerHeight < 820;
  @state() private phone = window.innerWidth < 700;
  /** the phone shows one provider at a time (no page scroll); null = the one that needs attention, else the first */
  @state() private shownProvider: Connection['provider'] | null = null;
  private api: CalendarsApi | null = null;
  private toastTimer = 0;
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
    clearTimeout(this.toastTimer);
  }

  private async load(): Promise<void> {
    this.error = '';
    try {
      this.api ??= await calendarsApi();
      const [c, f, cals, s] = await Promise.all([this.api.connections(), this.api.syncFlags().catch(() => ({ flags: [] as SyncFlag[] })),
        this.api.calendars().catch(() => ({ calendars: [] as Calendar[] })), this.api.settings().catch(() => null)]);
      this.conns = c.connections;
      // the phone opens on the provider that needs attention and stays on it after an action resolves it
      this.shownProvider ??= c.connections.find((x) => x.state !== 'ok' && x.state !== 'paused')?.provider ?? null;
      this.flags = f.flags;
      this.cals = cals.calendars;
      this.s = s?.settings ?? null;
      this.canConfigure = !!s?.can_configure;
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) this.forbidden = true;
      else this.error = describeError(e);
    }
  }

  private toast(t: string): void {
    this.toastText = t;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastText = ''), 3200);
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
    if (this.forbidden) return html`<sw-state-panel state="forbidden" data-sync-state="forbidden" heading="אין לך הרשאה לחיבורי יומן" hint=${'ההרשאה "יומנים: חיבור יומנים חיצוניים" ניתנת על ידי הבעלים.'}></sw-state-panel>`;
    if (this.error) return html`<sw-state-panel state="error" data-sync-state="error" heading="לא הצלחנו לטעון את החיבורים" hint=${this.error} actionLabel="לנסות שוב" @action=${() => void this.load()}></sw-state-panel>`;
    if (!this.conns) return html`<div class="panel" data-sync-state="loading" role="status" aria-label="טוען"><div class="prov">${ORDER.map(() => html`<div class="skel" style="block-size:180px"></div>`)}</div></div>`;
    const now = new Date();
    return html`
      <section class="panel" data-sync-screen>
        <div class="ph lead-head"><h1>חיבורי יומן</h1><span class="sp"></span><span class="lock lockline"><sw-icon name="lock" size="14"></sw-icon>Arx לא יוצר חשבונות ולא שומר סיסמאות</span>
          <button type="button" class="btn sm newbtn" data-sync-new @click=${() => (this.newOpen = true)}><sw-icon name="plus" size="14"></sw-icon>חיבור חדש</button></div>
        ${this.actionError ? html`<div class="err" role="alert" data-sync-error>${this.actionError}</div>` : nothing}
        ${this.phone ? this.phoneProviders(now) : html`<div class="prov">${ORDER.map((p) => this.card(p, now))}</div>`}
        ${this.flagsBlock(now)}
        ${this.rules()}
      </section>
      ${this.dialogs()}
      ${this.toastText ? html`<div class="toast" role="status" data-sync-toast>${this.toastText}</div>` : nothing}`;
  }

  private phoneProviders(now: Date) {
    const attention = (this.conns ?? []).find((c) => c.state !== 'ok' && c.state !== 'paused')?.provider;
    const cur = this.shownProvider ?? attention ?? 'ical';
    return html`<div class="seg" role="tablist" aria-label="ספק" data-provider-tabs>${ORDER.map((p) => {
      const c = (this.conns ?? []).find((x) => x.provider === p);
      return html`<button type="button" role="tab" style="flex:1" aria-pressed=${String(cur === p)} aria-selected=${String(cur === p)} data-provider-tab=${p} @click=${() => (this.shownProvider = p)}>${PROVIDER_LABEL[p]}${c && c.state !== 'ok' ? html` <span class="dot" aria-label="דורש טיפול" style="display:inline-block;--h:var(--sw-warning)"></span>` : nothing}</button>`;
    })}</div>${this.card(cur, now)}`;
  }

  private card(p: Connection['provider'], now: Date) {
    const c = (this.conns ?? []).find((x) => x.provider === p);
    if (!c) {
      return html`<div class="pcard" data-provider=${p}><div class="pt"><span class="logo">${LOGO[p]}</span><div class="grow"><b>${PROVIDER_LABEL[p]}</b><div class="stage">${STAGE[p]}</div></div><span class="chip">לא מחובר</span></div>
        <div class="fine">${p === 'ical' ? 'פיד יוצא או מנוי נכנס, בלי חשבון.' : 'חשבון שהבעלים יוצר בעצמו אצל הספק.'}</div></div>`;
    }
    const [look, label] = STATE[c.state] ?? ['', c.state];
    const max = this.phone ? 2 : this.compact ? 1 : 2;
    const shown = c.bindings.slice(0, max);
    const rest = c.bindings.length - shown.length;
    const reauth = c.state === 'needs_reauth';
    const cont = reauth && (this.s?.reauth_mode ?? 'reauth_and_continue') === 'reauth_and_continue';
    return html`<div class="pcard" data-provider=${p} data-conn=${c.id} data-conn-state=${c.state}>
      <div class="pt"><span class="logo">${LOGO[p]}</span><div class="grow"><b>${PROVIDER_LABEL[p]}</b><div class="stage ell">${STAGE[p]}${p === 'ical' ? '' : ` · ${c.owner.name} חיברה`}</div></div><span class=${`chip ${look}`}>${label}</span></div>
      ${reauth ? html`<div class="fine">ההרשאה פגה ${agoText(c.last_sync_at, now)}. Arx ממשיך לעבוד מהיומן שלו; השינויים יישלחו אחרי ההרשאה.</div>` : nothing}
      ${shown.length ? html`<ul>${shown.map((b) => { const cal = this.calName(b.calendar_id); return html`<li><span class="dot" style=${`--h:${colorVar(cal?.color)}`}></span><span class="grow ell" title=${cal?.name ?? ''}>${cal?.name ?? 'יומן'}</span><span class=${`chip ${b.direction === 'two_way' ? 'acc' : ''}`}>${bindingText(b)}</span></li>`; })}
        ${rest > 0 ? html`<li><span class="grow fine">ועוד ${rest} יומנים</span></li>` : nothing}</ul>` : html`<div class="fine">אין עדיין יומן משויך.</div>`}
      <div class="acts">
        ${reauth ? html`<button type="button" class="btn pri sm" data-reauth @click=${() => this.toast(`ההרשאה מחדש נעשית אצל ${PROVIDER_LABEL[p]} בשלב החיבור המלא (שלב 5)`)}>הרשאה מחדש אצל ${PROVIDER_LABEL[p]}</button>
          ${cont ? html`<button type="button" class="btn sm" data-continue @click=${() => void this.act(() => (this.api as CalendarsApi).resumeConnection(c.id), 'החיבור ממשיך; אם הספק עדיין מסרב, הוא יחזור לבקש הרשאה')}>המשך</button>` : nothing}`
          : c.state === 'paused' ? html`<button type="button" class="btn sm" data-resume @click=${() => void this.act(() => (this.api as CalendarsApi).resumeConnection(c.id), 'החיבור חודש')}>חידוש</button>`
          : html`<button type="button" class="btn sm" data-sync-now @click=${() => void this.act(() => (this.api as CalendarsApi).syncNow(c.id), 'הסנכרון התחיל')}><sw-icon name="refresh" size="14"></sw-icon>סנכרון עכשיו</button>
            <button type="button" class="btn sm wide-only" data-pause @click=${() => void this.act(() => (this.api as CalendarsApi).pauseConnection(c.id), 'החיבור הושהה')}>השהיה</button>`}
        ${reauth || c.state === 'paused' ? html`<button type="button" class="btn sm bad" data-remove @click=${() => (this.removing = c)}>ניתוק</button>` : nothing}
        ${!reauth && c.state !== 'paused' ? html`<span class="fine wide-only">${agoText(c.last_sync_at, now)}</span>` : nothing}
      </div></div>`;
  }

  private flagsBlock(now: Date) {
    if (!this.flags.length) return html`<h3 data-flags-empty>סומנו להחלטה <span class="chip ok">אין</span></h3>`;
    const per = this.phone ? 2 : this.compact ? 2 : 3;
    const p = pageOf(this.flags, this.flagPage, per);
    return html`<h3>סומנו להחלטה <span class="count num" data-flags-count>${this.flags.length}</span></h3>
      <div class="flags">${p.items.map((f) => html`<div class="flag" data-flag=${f.event_id}><span class="warnico"><sw-icon name="warning" size="16"></sw-icon></span>
        <div class="grow"><div class="name ell" title=${f.title ?? ''}>${f.flag === 'deleted_external' ? `"${f.title ?? 'אירוע'}" נמחק ביומן החיצוני` : f.title ?? 'התנגשות'}${f.flag === 'conflict' ? html` <span class="num">${hm(f.start)}–${hm(f.end)}</span>` : nothing}</div>
          <div class="sub ell">${f.calendar.name} · ${f.flag === 'conflict' ? 'התנגשות: שתי ההזמנות נשמרו' : 'נשמר ב־Arx ולא מתפרסם עד החלטה'} · ${whenText(f.start, f.end, now)}</div></div>
        <button type="button" class="btn sm" data-flag-keep @click=${() => void this.act(() => (this.api as CalendarsApi).resolveFlag(f.event_id, f.revision, 'keep'), 'נשאר')}>להשאיר</button>
        <button type="button" class="btn sm bad" data-flag-cancel @click=${() => void this.act(() => (this.api as CalendarsApi).resolveFlag(f.event_id, f.revision, 'cancel'), 'בוטל')}>לבטל</button></div>`)}</div>
      ${p.pages > 1 ? html`<div class="pager"><button type="button" class="btn icon" aria-label="הקודם" ?disabled=${p.page <= 1} @click=${() => (this.flagPage = p.page - 1)}><sw-icon name="chevronBack" size="16"></sw-icon></button>
        <span class="num">${p.page} / ${p.pages}</span><button type="button" class="btn icon" aria-label="הבא" ?disabled=${p.page >= p.pages} @click=${() => (this.flagPage = p.page + 1)}><sw-icon name="chevron" size="16"></sw-icon></button></div>` : nothing}`;
  }

  /** The sync rules that are settings (owner answers 18, 21, 22); editable with calendar.configure. */
  private rules() {
    if (!this.s) return nothing;
    const s = this.s;
    const rows: [keyof CalSettings, string, string, [string, string][]][] = [
      ['sync_external_delete', 'מחיקה מבחוץ של אירוע מ־Arx', 'ברירת מחדל: מבוטל ב־Arx', [['cancel', 'מבוטל ב־Arx'], ['flag', 'נשאר ומסומן']]],
      ['reauth_mode', 'חיבור שדורש הרשאה מחדש', 'ברירת מחדל: הרשאה + "המשך"', [['reauth_and_continue', 'הרשאה + "המשך"'], ['reauth_only', 'הרשאה בלבד']]],
      ['sync_conflict_display', 'התנגשות בתצוגת השבוע', 'ברירת מחדל: זו לצד זו, מסגרת אדומה', [['side_by_side', 'זו לצד זו'], ['list_only', 'רק ברשימה']]],
      ['sync_google_scope', 'היקף הרשאת Google', 'ברירת מחדל: יומן מלא, אושר מראש', [['full', 'יומן מלא'], ['events', 'אירועים בלבד']]],
    ];
    return html`<div class="rules" data-sync-rules>${rows.map(([k, name, def, opts]) => html`<div class="row" data-setting=${k}><div class="grow"><div class="name ell">${name}</div><div class="sub">${def}</div></div>
      <div class="seg" role="radiogroup" aria-label=${name}>${opts.map(([v, l]) => html`<button type="button" role="radio" aria-pressed=${String(s[k] === v)} aria-checked=${String(s[k] === v)} data-opt=${v}
        ?disabled=${!this.canConfigure} @click=${() => void this.saveRule(k, v)}>${l}</button>`)}</div></div>`)}</div>`;
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
    if (this.removing) {
      const c = this.removing;
      return html`<sw-dialog open heading=${`לנתק את ${PROVIDER_LABEL[c.provider]}?`} data-remove-confirm @close=${() => (this.removing = null)}><div class="dlg"><p>ההרשאה תבוטל אצל הספק והמפתחות יימחקו.
        השיוך של ${c.bindings.length} יומנים יוסר; האירועים ב־Arx נשארים.</p></div>
        <button slot="footer" type="button" class="btn" @click=${() => (this.removing = null)}>ביטול</button>
        <button slot="footer" type="button" class="btn bad fill" data-remove-ok @click=${() => { this.removing = null; void this.act(() => (this.api as CalendarsApi).removeConnection(c.id), 'החיבור נותק'); }}>ניתוק</button></sw-dialog>`;
    }
    if (this.newOpen) {
      return html`<sw-dialog open heading="חיבור חדש" data-new-dialog @close=${() => (this.newOpen = false)}><div class="dlg">
        <p>הסדר הוא iCal, אחר כך Google, אחר כך Microsoft. Arx לא יוצר חשבון ולא שומר סיסמה: הבעלים יוצר את האפליקציה אצל הספק, מדביק את המזהה והסוד, ומאשר בעצמו בדפדפן.</p>
        <p>מסך ההרשאה עצמו נבנה בשלב החיבור המלא (שלב 5) ועדיין לא זמין מכאן. פיד iCal יוצא נוצר מהיומן עצמו.</p></div>
        <button slot="footer" type="button" class="btn pri" @click=${() => (this.newOpen = false)}>הבנתי</button></sw-dialog>`;
    }
    return nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-calendar-sync': SystemCalendarSync;
  }
}
