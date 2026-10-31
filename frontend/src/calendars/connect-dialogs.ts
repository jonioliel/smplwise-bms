import { LitElement, html, nothing, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-dialog';
import { describeError, resourceUrl } from '../api/client';
import {
  cardOf, serverProviderOf, type AuthorizeStart, type Calendar, type CalendarsApi, type Connection, type ExtCalendar, type Feed, type ProviderCard,
} from '../api/calendars';
import { clientIdOk, directionsFor, firstStep, pasteLooksRight } from './connect-model';
import { PROVIDER_LABEL } from './model';
import { calCss } from './styles';

/** What the dialog is for: connecting / re-authorising one provider, binding calendars of a connection, or the outgoing iCal feeds. */
export type ConnectMode = { kind: 'connect'; card: ProviderCard; conn: Connection | null } | { kind: 'bind'; conn: Connection } | { kind: 'feeds' };

const DIR_HE: Record<string, string> = { import: 'ייבוא ל־Arx', export: 'ייצוא מ־Arx', two_way: 'דו־כיווני (יומן ייעודי)' };
const DETAIL_HE: Record<string, string> = { busy: '"תפוס" בלבד', titles: 'כותרות', details: 'כותרות והערות' };

/**
 * CALCONNECT-2330: the connect flow of הגדרות › חיבורי יומן. Arx never creates an account or keeps a password: the owner registers HIS
 * OWN app at the provider (the steps are listed), pastes its client id (and Google's secret), then approves in his own browser.
 * Google: a new tab opens Google's consent page; afterwards the browser lands on http://127.0.0.1:8749/ (a page that does not load) and
 * the owner pastes that address here. Microsoft: a short code for microsoft.com/devicelogin, approved on any phone or computer; this
 * dialog asks the server every few seconds. iCal: the secret address of the calendar. Binding: a provider calendar to an Arx calendar
 * (owner answer 17: needs the connect permission AND an edit role in that calendar - the server checks). Feeds: secret-address iCal
 * feeds of chosen calendars; the address is shown once.
 */
@customElement('cal-connect-dialog')
export class CalConnectDialog extends LitElement {
  static styles = [calCss, css`
    :host { display: contents; }
    .dlg { display: flex; flex-direction: column; gap: 12px; min-inline-size: 0; }
    .dlg p { margin: 0; color: var(--sw-text); font-size: var(--sw-fs-sm); }
    ol { margin: 0; padding-inline-start: 20px; display: grid; gap: 4px; font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .code { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); letter-spacing: 0.12em; color: var(--sw-heading); text-align: center; padding: 10px; border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2); user-select: all; }
    .err { background: var(--sw-danger-soft); color: var(--sw-danger-text); padding: 8px 12px; border-radius: var(--sw-r-md); font-size: var(--sw-fs-sm); }
    textarea.inp { min-block-size: 72px; padding-block: 8px; resize: vertical; }
    .list { display: grid; gap: 6px; max-block-size: 220px; overflow: auto; }
    .item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); min-inline-size: 0; }
    .check { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); color: var(--sw-heading); }
    .url { font-size: var(--sw-fs-xs); word-break: break-all; padding: 8px 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); user-select: all; }
    a.btn { text-decoration: none; }
    .fine { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
  `];

  @property({ attribute: false }) api: CalendarsApi | null = null;
  @property({ attribute: false }) mode: ConnectMode | null = null;
  @property({ attribute: false }) cals: Calendar[] = [];
  @property({ attribute: false }) feedsEnabled = true;

  @state() private step: 'client' | 'feed' | 'auth' | 'done' = 'client';
  @state() private conn: Connection | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private label = '';
  @state() private scope: 'read' | 'read_write' = 'read_write';
  @state() private clientId = '';
  @state() private clientSecret = '';
  @state() private tenant = 'common';
  @state() private feedUrl = '';
  @state() private start: AuthorizeStart | null = null;
  @state() private pasted = '';
  @state() private pollState = '';
  @state() private ext: ExtCalendar[] | null = null;
  @state() private bExt = '';
  @state() private bCal = '';
  @state() private bDir: 'import' | 'export' | 'two_way' = 'import';
  @state() private bDetail: 'busy' | 'titles' | 'details' = 'titles';
  @state() private bDedicated = false;
  @state() private feeds: Feed[] | null = null;
  @state() private fCals: string[] = [];
  @state() private fDetail: 'busy' | 'titles' = 'busy';
  @state() private shownUrl = '';
  private pollTimer = 0;
  private opened: ConnectMode | null = null;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.pollTimer);
  }

  protected willUpdate(): void {
    if (this.mode === this.opened) return;
    this.opened = this.mode;
    clearTimeout(this.pollTimer);
    Object.assign(this, { error: '', busy: false, start: null, pasted: '', pollState: '', ext: null, feeds: null, shownUrl: '', clientSecret: '' });
    const m = this.mode;
    if (!m) return;
    if (m.kind === 'connect') {
      this.conn = m.conn;
      this.step = firstStep(m.card, m.conn);
      this.label = m.conn?.label ?? '';
      this.scope = m.card === 'ical' ? 'read' : ((m.conn?.scope as 'read' | 'read_write') ?? 'read_write');
      this.tenant = m.conn?.setup?.tenant ?? 'common';
      if (this.step === 'auth') void this.authorize();
    } else if (m.kind === 'bind') {
      this.conn = m.conn;
      const dirs = directionsFor(m.conn);
      this.bDir = dirs[0];
      this.bDetail = cardOf(m.conn.provider) === 'ical' ? 'titles' : 'busy';
      void this.loadExt(m.conn.id);
    } else {
      void this.loadFeeds();
    }
  }

  private close(msg = ''): void {
    clearTimeout(this.pollTimer);
    const m = this.mode;
    if (m?.kind === 'connect' && this.conn && this.step === 'auth' && this.api) void this.api.authorizeCancel(this.conn.id).catch(() => undefined);
    this.dispatchEvent(new CustomEvent('cal-dialog-done', { detail: { message: msg }, bubbles: true, composed: true }));
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.error = '';
    this.busy = true;
    try {
      await fn();
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private get api_(): CalendarsApi {
    return this.api as CalendarsApi;
  }

  // ---------------------------------------------------------------- connect
  private async ensureConn(card: ProviderCard): Promise<Connection> {
    if (this.conn) return this.conn;
    const label = this.label.trim() || PROVIDER_LABEL[card];
    const made = await this.api_.createConnection({ provider: serverProviderOf(card), label, scope: card === 'ical' ? 'read' : this.scope });
    this.conn = made.connection;
    return made.connection;
  }

  private saveClient(card: ProviderCard): Promise<void> {
    return this.run(async () => {
      const c = await this.ensureConn(card);
      const body: { client_id: string; client_secret?: string; tenant?: string } = { client_id: this.clientId.trim() };
      if (this.clientSecret) body.client_secret = this.clientSecret;
      if (card === 'microsoft') body.tenant = this.tenant.trim() || 'common';
      this.conn = (await this.api_.putClient(c.id, body)).connection;
      this.clientSecret = '';
      this.step = 'auth';
      await this.authorize();
    });
  }

  private saveFeed(): Promise<void> {
    return this.run(async () => {
      const c = await this.ensureConn('ical');
      this.conn = (await this.api_.putFeedUrl(c.id, this.feedUrl.trim())).connection;
      this.feedUrl = '';
      this.close('מנוי ה־iCal נשמר. עכשיו אפשר לשייך אותו ליומן.');
    });
  }

  private async authorize(): Promise<void> {
    if (!this.conn) return;
    const id = this.conn.id;
    await this.run(async () => {
      this.start = await this.api_.authorize(id);
      if (this.start.flow === 'device') this.schedulePoll(this.start.interval);
    });
  }

  private schedulePoll(sec: number): void {
    clearTimeout(this.pollTimer);
    this.pollTimer = window.setTimeout(() => void this.poll(), Math.max(1, sec) * 1000);
  }

  private async poll(): Promise<void> {
    if (!this.conn || this.mode?.kind !== 'connect') return;
    try {
      const r = await this.api_.authorizePoll(this.conn.id);
      this.pollState = r.state;
      if (r.state === 'connected') {
        this.step = 'done';
        this.close(`${PROVIDER_LABEL.microsoft} חובר. עכשיו אפשר לשייך יומנים.`);
      } else if (r.state === 'pending' || r.state === 'slow_down') {
        this.schedulePoll(r.interval ?? 5);
      }
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private complete(): Promise<void> {
    return this.run(async () => {
      if (!this.conn) return;
      const r = await this.api_.authorizeComplete(this.conn.id, this.pasted.trim());
      if (r.state === 'connected') {
        this.step = 'done';
        this.close(`${PROVIDER_LABEL.google} חובר. עכשיו אפשר לשייך יומנים.`);
      }
    });
  }

  private connectBody(card: ProviderCard) {
    const name = PROVIDER_LABEL[card];
    if (this.step === 'feed') {
      return html`<div class="dlg" data-connect-step="feed">
        <p>מדביקים את הכתובת הסודית של היומן (iCal / ICS) מאפליקציית היומן. הכתובת נשמרת מוצפנת ולא מוצגת שוב. קריאה בלבד: Arx לא כותב ליומן הזה.</p>
        ${this.conn ? nothing : html`<div class="fld"><label for="cl">שם</label><input id="cl" class="inp" maxlength="80" placeholder="למשל: חגים ומועדים" .value=${this.label}
          @input=${(e: Event) => (this.label = (e.target as HTMLInputElement).value)}></div>`}
        <div class="fld"><label for="fu">כתובת</label><input id="fu" class="inp ltr" dir="ltr" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://… או webcal://…"
          data-feed-url .value=${this.feedUrl} @input=${(e: Event) => (this.feedUrl = (e.target as HTMLInputElement).value)}></div>
        <p class="fine">רק https לכתובת ציבורית, פורט 443. כתובת ברשת הביתית נחסמת.</p>
        ${this.error ? html`<div class="err" role="alert" data-connect-error>${this.error}</div>` : nothing}</div>
        <button slot="footer" type="button" class="btn" @click=${() => this.close()}>ביטול</button>
        <button slot="footer" type="button" class="btn pri" data-connect-save ?disabled=${this.busy || this.feedUrl.trim().length < 10} @click=${() => void this.saveFeed()}>שמירה</button>`;
    }
    if (this.step === 'client') {
      const ok = clientIdOk(card, this.clientId);
      const needSecret = card === 'google' && !this.conn?.setup?.client_secret_set;
      return html`<div class="dlg" data-connect-step="client">
        <p>Arx לא יוצר חשבון ולא שומר סיסמה. יוצרים אפליקציה משלך אצל ${name} ומדביקים כאן את פרטיה:</p>
        ${card === 'google' ? html`<ol><li>פרויקט ב־Google Cloud והפעלת Google Calendar API</li><li>מסך הסכמה (OAuth consent) והוספת עצמך כמשתמש בדיקה</li>
          <li>OAuth client מסוג <b>Desktop app</b></li><li>מדביקים כאן את Client ID ואת Client secret</li></ol>`
          : html`<ol><li>רישום אפליקציה ב־Microsoft Entra</li><li>ב־Authentication: להפעיל <b>Allow public client flows</b></li>
          <li>הרשאת Microsoft Graph מסוג Delegated: Calendars.ReadWrite (או Calendars.Read)</li><li>מדביקים כאן את Application (client) ID</li></ol>`}
        ${this.conn ? nothing : html`<div class="fld"><label for="cl">שם</label><input id="cl" class="inp" maxlength="80" placeholder="למשל: היומן של המשרד" .value=${this.label}
          @input=${(e: Event) => (this.label = (e.target as HTMLInputElement).value)}></div>
          <div class="fld"><span class="lbl">הרשאה</span><div class="seg" role="radiogroup" aria-label="הרשאה">${(['read_write', 'read'] as const).map((v) => html`<button type="button" role="radio"
            aria-checked=${String(this.scope === v)} aria-pressed=${String(this.scope === v)} data-scope=${v} @click=${() => (this.scope = v)}>${v === 'read' ? 'קריאה בלבד' : 'קריאה וכתיבה'}</button>`)}</div></div>`}
        <div class="fld"><label for="ci">Client ID</label><input id="ci" class="inp ltr" dir="ltr" autocomplete="off" spellcheck="false" data-client-id .value=${this.clientId}
          @input=${(e: Event) => (this.clientId = (e.target as HTMLInputElement).value)}></div>
        ${card === 'google' ? html`<div class="fld"><label for="cs">Client secret</label><input id="cs" class="inp ltr" dir="ltr" type="password" autocomplete="off" data-client-secret
          placeholder=${this.conn?.setup?.client_secret_set ? 'נשמר (להחלפה מקלידים חדש)' : ''} .value=${this.clientSecret}
          @input=${(e: Event) => (this.clientSecret = (e.target as HTMLInputElement).value)}></div>`
          : html`<div class="fld"><label for="tn">ספרייה</label><input id="tn" class="inp ltr" dir="ltr" autocomplete="off" spellcheck="false" data-tenant .value=${this.tenant}
          @input=${(e: Event) => (this.tenant = (e.target as HTMLInputElement).value)}></div><p class="fine">common מתאים לרוב החשבונות; ארגון יכול לשים את מזהה הספרייה שלו.</p>`}
        ${this.clientId && !ok ? html`<p class="fine" data-client-hint>${card === 'google' ? 'מזהה של Google נגמר ב־.apps.googleusercontent.com' : 'מזהה של Microsoft הוא GUID (8-4-4-4-12)'}</p>` : nothing}
        ${this.error ? html`<div class="err" role="alert" data-connect-error>${this.error}</div>` : nothing}</div>
        <button slot="footer" type="button" class="btn" @click=${() => this.close()}>ביטול</button>
        <button slot="footer" type="button" class="btn pri" data-connect-save ?disabled=${this.busy || !ok || (needSecret && !this.clientSecret)} @click=${() => void this.saveClient(card)}>שמירה והמשך</button>`;
    }
    const s = this.start;
    if (s?.flow === 'device') {
      const ended = this.pollState === 'denied' || this.pollState === 'expired';
      return html`<div class="dlg" data-connect-step="device">
        <p>פותחים בכל מחשב או טלפון את <a href=${s.verification_url} target="_blank" rel="noopener noreferrer" class="ltr" dir="ltr">${s.verification_url.replace('https://', '')}</a>, מקלידים את הקוד ומאשרים בחשבון שלך:</p>
        <div class="code ltr" dir="ltr" data-user-code>${s.user_code}</div>
        <p class="fine" role="status" data-poll-state=${this.pollState || 'waiting'}>${this.pollState === 'denied' ? 'האישור נדחה אצל Microsoft.' : this.pollState === 'expired' ? 'תוקף הקוד פג.' : 'ממתינים לאישור…'}</p>
        ${this.error ? html`<div class="err" role="alert" data-connect-error>${this.error}</div>` : nothing}</div>
        <button slot="footer" type="button" class="btn" @click=${() => this.close()}>ביטול</button>
        ${ended || this.error ? html`<button slot="footer" type="button" class="btn pri" data-connect-retry @click=${() => { this.pollState = ''; void this.authorize(); }}>קוד חדש</button>` : nothing}
        <button slot="footer" type="button" class="btn sm" data-change-client @click=${() => { clearTimeout(this.pollTimer); this.step = 'client'; }}>פרטי הלקוח</button>`;
    }
    return html`<div class="dlg" data-connect-step="paste">
      <p>1. פותחים את מסך האישור של Google ומאשרים את כל ההרשאות.</p>
      ${s?.flow === 'paste' ? html`<a class="btn pri" href=${s.authorize_url} target="_blank" rel="noopener noreferrer" data-open-consent><sw-icon name="link" size="14"></sw-icon>פתיחת מסך האישור של Google</a>` : html`<div class="spin" role="status" aria-label="טוען"></div>`}
      <p>2. אחרי האישור הדפדפן יעבור לכתובת שמתחילה ב־<span class="ltr" dir="ltr">http://127.0.0.1:8749/</span> ויראה שגיאה - זה תקין. מעתיקים את כל הכתובת משורת הכתובת ומדביקים כאן:</p>
      <textarea class="inp ltr" dir="ltr" spellcheck="false" autocomplete="off" aria-label="הכתובת שהדפדפן הגיע אליה" data-paste .value=${this.pasted}
        @input=${(e: Event) => (this.pasted = (e.target as HTMLTextAreaElement).value)}></textarea>
      <p class="fine">הקוד בכתובת טוב לפעם אחת ולעשר דקות, ושייך רק לבקשה הזו.</p>
      ${this.error ? html`<div class="err" role="alert" data-connect-error>${this.error}</div>` : nothing}</div>
      <button slot="footer" type="button" class="btn" @click=${() => this.close()}>ביטול</button>
      <button slot="footer" type="button" class="btn sm" data-change-client @click=${() => (this.step = 'client')}>פרטי הלקוח</button>
      <button slot="footer" type="button" class="btn pri" data-connect-finish ?disabled=${this.busy || !pasteLooksRight(this.pasted)} @click=${() => void this.complete()}>סיום</button>`;
  }

  // ---------------------------------------------------------------- bind
  private async loadExt(id: string): Promise<void> {
    await this.run(async () => {
      this.ext = (await this.api_.connectionCalendars(id)).calendars;
      this.bExt = this.ext.find((c) => c.is_primary)?.id_ref ?? this.ext[0]?.id_ref ?? '';
    });
  }

  private editable(): Calendar[] {
    return this.cals.filter((c) => !c.archived && (c.my_role === 'edit' || c.my_role === 'manage'));
  }

  private saveBinding(): Promise<void> {
    return this.run(async () => {
      if (!this.conn) return;
      await this.api_.putBinding(this.bCal, { connection_id: this.conn.id, external_calendar_ref: this.bExt, direction: this.bDir, detail: this.bDetail, dedicated: this.bDir === 'two_way' ? true : this.bDedicated });
      this.close('השיוך נשמר; הסנכרון יתחיל בסבב הקרוב.');
    });
  }

  private unbind(calendarId: string): Promise<void> {
    return this.run(async () => {
      await this.api_.putBinding(calendarId, { connection_id: null });
      this.close('השיוך הוסר; האירועים ב־Arx נשארים.');
    });
  }

  private bindBody(conn: Connection) {
    const dirs = directionsFor(conn);
    const ext = this.ext ?? [];
    const cur = ext.find((e) => e.id_ref === this.bExt);
    const writeBlocked = this.bDir !== 'import' && cur && !cur.can_write;
    const mine = this.editable();
    return html`<div class="dlg" data-bind-dialog>
      ${conn.bindings.length ? html`<div class="list">${conn.bindings.map((b) => html`<div class="item" data-bound=${b.calendar_id}><span class="grow ell">${this.cals.find((c) => c.id === b.calendar_id)?.name ?? 'יומן'}</span>
        <span class="chip">${DIR_HE[b.direction] ?? b.direction}</span><button type="button" class="btn sm bad" data-unbind ?disabled=${this.busy} @click=${() => void this.unbind(b.calendar_id)}>הסרה</button></div>`)}</div>` : nothing}
      ${this.ext === null && !this.error ? html`<div class="spin" role="status" aria-label="טוען"></div>` : html`
      <div class="fld"><label for="be">יומן אצל ${PROVIDER_LABEL[cardOf(conn.provider)]}</label><select id="be" class="inp" data-bind-ext @change=${(e: Event) => (this.bExt = (e.target as HTMLSelectElement).value)}>
        ${ext.map((e) => html`<option value=${e.id_ref} ?selected=${e.id_ref === this.bExt}>${e.name}${e.can_write ? '' : ' (קריאה בלבד)'}</option>`)}</select></div>
      <div class="fld"><label for="bc">יומן ב־Arx</label><select id="bc" class="inp" data-bind-cal @change=${(e: Event) => (this.bCal = (e.target as HTMLSelectElement).value)}>
        <option value="" ?selected=${!this.bCal}>בחירה…</option>${mine.map((c) => html`<option value=${c.id} ?selected=${c.id === this.bCal}>${c.name}</option>`)}</select></div>
      ${mine.length ? nothing : html`<p class="fine" data-bind-none>אין יומן שיש לך בו הרשאת עריכה. שיוך דורש חיבור יומנים וגם עריכה ביומן.</p>`}
      <div class="fld"><span class="lbl">כיוון</span><div class="seg" role="radiogroup" aria-label="כיוון">${dirs.map((d) => html`<button type="button" role="radio" aria-checked=${String(this.bDir === d)}
        aria-pressed=${String(this.bDir === d)} data-dir=${d} @click=${() => (this.bDir = d)}>${DIR_HE[d]}</button>`)}</div></div>
      <div class="fld"><span class="lbl">מה עובר</span><div class="seg" role="radiogroup" aria-label="מה עובר">${(['busy', 'titles', 'details'] as const).map((d) => html`<button type="button"
        role="radio" aria-checked=${String(this.bDetail === d)} aria-pressed=${String(this.bDetail === d)} data-detail=${d} @click=${() => (this.bDetail = d)}>${DETAIL_HE[d]}</button>`)}</div></div>
      ${this.bDir === 'two_way' ? html`<p class="fine" data-two-way-note>דו־כיווני רק ליומן שנוצר עבור Arx (לא יומן אישי). שינויים מבחוץ מתקבלים; התנגשות שומרת את שתי ההזמנות ומסמנת להחלטה.</p>` : nothing}
      ${writeBlocked ? html`<p class="fine" data-bind-readonly>היומן הזה אצל הספק לקריאה בלבד; אפשר רק ייבוא.</p>` : nothing}`}
      ${this.error ? html`<div class="err" role="alert" data-connect-error>${this.error}</div>` : nothing}</div>
      <button slot="footer" type="button" class="btn" @click=${() => this.close()}>סגירה</button>
      <button slot="footer" type="button" class="btn pri" data-bind-save ?disabled=${this.busy || !this.bCal || !this.bExt || !!writeBlocked} @click=${() => void this.saveBinding()}>שיוך</button>`;
  }

  // ---------------------------------------------------------------- feeds
  private async loadFeeds(): Promise<void> {
    await this.run(async () => {
      const r = await this.api_.feeds();
      this.feeds = r.feeds.filter((f) => !f.revoked);
      this.feedsEnabled = r.enabled;
    });
  }

  private feedAct(fn: () => Promise<{ feed: Feed; path?: string }>): Promise<void> {
    return this.run(async () => {
      const r = await fn();
      if (r.path) this.shownUrl = resourceUrl(r.path);
      this.fCals = [];
      const all = await this.api_.feeds();
      this.feeds = all.feeds.filter((f) => !f.revoked);
    });
  }

  private feedsBody() {
    const mine = this.editable();
    const names = (ids: string[]) => ids.map((id) => this.cals.find((c) => c.id === id)?.name ?? 'יומן').join(', ');
    return html`<div class="dlg" data-feeds-dialog>
      <p>פיד iCal יוצא: כתובת סודית שאפליקציית יומן נרשמת אליה (קריאה בלבד). עוברים רק אירועים מאושרים, כ"תפוס" או עם כותרת; לעולם לא הערות או פרטי אורחים.</p>
      ${!this.feedsEnabled ? html`<div class="note warn" data-feeds-off>פידים כבויים. מפעילים בהגדרות היומנים.</div>` : nothing}
      ${this.shownUrl ? html`<div class="note" data-feed-url-once><div class="grow"><b>הכתובת מוצגת פעם אחת בלבד</b><div class="url ltr" dir="ltr">${this.shownUrl}</div>
        <span class="fine">עובדת רק במקום שבו Arx נגיש לאפליקציית היומן.</span></div></div>` : nothing}
      ${this.feeds === null && !this.error ? html`<div class="spin" role="status" aria-label="טוען"></div>` : html`<div class="list">${(this.feeds ?? []).map((f) => html`<div class="item" data-feed=${f.id}>
        <span class="grow ell" title=${names(f.calendar_ids)}>${names(f.calendar_ids)}</span><span class="chip">${DETAIL_HE[f.detail]}</span>
        <button type="button" class="btn sm" data-feed-rotate ?disabled=${this.busy || !this.feedsEnabled} @click=${() => void this.feedAct(() => this.api_.rotateFeed(f.id))}>כתובת חדשה</button>
        <button type="button" class="btn sm bad" data-feed-revoke ?disabled=${this.busy} @click=${() => void this.feedAct(() => this.api_.revokeFeed(f.id))}>ביטול</button></div>`)}
        ${(this.feeds ?? []).length ? nothing : html`<p class="fine" data-feeds-empty>אין פידים.</p>`}</div>`}
      ${this.feedsEnabled ? html`<div class="list" role="group" aria-label="יומנים לפיד חדש">${mine.map((c) => html`<label class="check"><input type="checkbox" data-feed-cal=${c.id} .checked=${this.fCals.includes(c.id)}
        @change=${(e: Event) => (this.fCals = (e.target as HTMLInputElement).checked ? [...this.fCals, c.id] : this.fCals.filter((x) => x !== c.id))}>${c.name}</label>`)}</div>
        <div class="seg" role="radiogroup" aria-label="מה עובר">${(['busy', 'titles'] as const).map((d) => html`<button type="button" role="radio" aria-checked=${String(this.fDetail === d)}
          aria-pressed=${String(this.fDetail === d)} data-feed-detail=${d} @click=${() => (this.fDetail = d)}>${DETAIL_HE[d]}</button>`)}</div>` : nothing}
      ${this.error ? html`<div class="err" role="alert" data-connect-error>${this.error}</div>` : nothing}</div>
      <button slot="footer" type="button" class="btn" @click=${() => this.close()}>סגירה</button>
      ${this.feedsEnabled ? html`<button slot="footer" type="button" class="btn pri" data-feed-create ?disabled=${this.busy || !this.fCals.length}
        @click=${() => void this.feedAct(() => this.api_.createFeed(this.fCals, this.fDetail))}>פיד חדש</button>` : nothing}`;
  }

  render() {
    const m = this.mode;
    if (!m) return nothing;
    if (m.kind === 'bind') {
      return html`<sw-dialog open heading=${`שיוך יומנים · ${PROVIDER_LABEL[cardOf(m.conn.provider)]}`} data-cal-dialog="bind" @close=${() => this.close()}>${this.bindBody(this.conn ?? m.conn)}</sw-dialog>`;
    }
    if (m.kind === 'feeds') return html`<sw-dialog open heading="פידים יוצאים (iCal)" data-cal-dialog="feeds" @close=${() => this.close()}>${this.feedsBody()}</sw-dialog>`;
    const reauth = m.conn?.state === 'needs_reauth';
    const heading = `${reauth ? 'הרשאה מחדש' : 'חיבור'} · ${PROVIDER_LABEL[m.card]}`;
    return html`<sw-dialog open heading=${heading} data-cal-dialog="connect" data-card=${m.card} @close=${() => this.close()}>${this.connectBody(m.card)}</sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cal-connect-dialog': CalConnectDialog;
  }
}
