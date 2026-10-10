import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-toggle';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { isApi, session } from '../api/session';
import { isFramed } from './register';
import {
  currentSubscription,
  endpointHash,
  getPrefs,
  listSubscriptions,
  pushSupport,
  rotateKey,
  putPrefs,
  sendTest,
  serviceName,
  subscribeThisDevice,
  unsubscribeThisDevice,
  deleteSubscription,
  type PushCategory,
  type PushPrefs,
  type PushSubscriptionRow,
  type PushSupport,
} from './push';

const CATEGORIES: { id: PushCategory; label: string; detail: string }[] = [
  { id: 'alerts', label: 'התראות מחוקים', detail: 'כל התראה שחוק ב"חוקים והתראות" מעלה: תנועה, חציית קו, אדם, רכב' },
  { id: 'doors', label: 'דלתות וכניסה', detail: 'פתיחה, נעילה ושחרור של דלתות ומנעולים מ־Home Assistant (אירועי WisKey כשיהיו זמינים)' },
  { id: 'device_faults', label: 'תקלות בהתקנים', detail: 'מצלמה שאיבדה וידאו, חבלה, דיסק, חיישן שנעלם' },
  { id: 'system', label: 'בריאות המערכת', detail: 'אירועי מערכת של ה־NVR (רשת, התנגשות כתובות, גישה לא חוקית)' },
];

const SUPPORT_TEXT: Record<Exclude<PushSupport, 'ok'>, string> = {
  insecure: 'התראות Push דורשות חיבור מאובטח (https). פתחו את Arx בכתובת https או דרך Home Assistant בכתובת https.',
  unsupported: 'הדפדפן הזה אינו תומך בהתראות Push.',
  ios_install: 'באייפון ובאייפד ההתראות מגיעות רק לאפליקציה שהותקנה: ב־Safari הקישו שיתוף ← "הוספה למסך הבית", פתחו את Arx מהמסך הבית וחזרו לכאן.',
  denied: 'ההתראות חסומות בדפדפן לאתר הזה. שחררו אותן בהגדרות האתר (סמל המנעול ליד הכתובת) ורעננו.',
  android_shell: 'אפליקציית Android עדיין לא מקבלת התראות Push. כדי לקבל התראות בטלפון, פתחו את Arx בדפדפן Chrome (או התקינו אותו משם למסך הבית) והפעילו כאן את ההתראות.',
};

/** CR-008 P3 - הגדרות › התראות: per user. This device's push subscription, which kinds of alert reach the user's
 * devices, quiet hours, a test button and the list of the user's subscribed devices. Every user reaches it; the server
 * only ever sends what the user may see (their camera / area scope). */
@customElement('arx-notifications-settings')
export class ArxNotificationsSettings extends LitElement {
  /** CR-018 (owner 4ב): users have no personal categories or quiet hours - only this device's registration (the administrator decides what is sent). */
  @property({ type: Boolean, attribute: 'devices-only' }) devicesOnly = false;
  /** Rendered inside another screen (the administrator's "ערוצים" section): no page frame of its own. */
  @property({ type: Boolean }) embedded = false;
  @state() private support: PushSupport = 'ok';
  @state() private rows: PushSubscriptionRow[] = [];
  @state() private thisHash: string | null = null;
  @state() private prefs: PushPrefs | null = null;
  @state() private draft: PushPrefs | null = null;
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  @state() private loaded = false;
  @state() private rotateArmed = false;

  static styles = css`
    .sections {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-inline-size: 760px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 9px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-inline-size: 0;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      line-height: 1.55;
      padding-block: 4px 8px;
    }
    .times {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .times input {
      inline-size: 110px;
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      padding-block-start: 10px;
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-error);
      font-size: var(--sw-fs-sm);
    }
    .dev {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    @media (max-width: 767px) {
      .row {
        flex-wrap: wrap;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    this.support = pushSupport();
    if (!isApi()) {
      this.prefs = this.draft = { categories: { alerts: true, doors: true, device_faults: true, system: true }, quiet: { enabled: false, from: '22:00', to: '07:00', allow_critical: true }, updated_at: null };
      this.loaded = true;
      return;
    }
    try {
      const [subs, prefs] = await Promise.all([listSubscriptions(), this.devicesOnly ? Promise.resolve(null) : getPrefs()]);
      this.rows = subs.subscriptions;
      if (prefs) {
        this.prefs = prefs;
        this.draft = structuredClone(prefs);
      }
      const sub = this.support === 'ok' ? await currentSubscription().catch(() => null) : null;
      this.thisHash = sub ? await endpointHash(sub.endpoint) : null;
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
    this.loaded = true;
  }

  private get subscribedHere(): boolean {
    return !!this.thisHash && this.rows.some((r) => r.endpoint_hash === this.thisHash);
  }

  private flash(text: string) {
    this.message = text;
    this.error = '';
    setTimeout(() => {
      if (this.message === text) this.message = '';
    }, 4000);
  }

  private async run(fn: () => Promise<void>) {
    this.busy = true;
    this.error = '';
    try {
      await fn();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private enable() {
    return this.run(async () => {
      await subscribeThisDevice();
      await this.load();
      this.flash('ההתראות הופעלו במכשיר הזה.');
    });
  }

  private disable() {
    return this.run(async () => {
      await unsubscribeThisDevice(this.rows);
      await this.load();
      this.flash('ההתראות כובו במכשיר הזה.');
    });
  }

  private removeRow(row: PushSubscriptionRow) {
    return this.run(async () => {
      await deleteSubscription(row.id);
      await this.load();
      this.flash('המכשיר הוסר.');
    });
  }

  private test() {
    return this.run(async () => {
      const r = await sendTest();
      this.flash(r.sent ? `נשלחה התראת בדיקה ל־${r.sent} ${r.sent === 1 ? 'מכשיר' : 'מכשירים'}.` : 'שירות ה־Push לא אישר את המשלוח; ראו את מצב המכשירים למטה.');
      await this.load();
    });
  }

  private save() {
    const d = this.draft;
    if (!d) return;
    return this.run(async () => {
      this.prefs = await putPrefs({ categories: d.categories, quiet: d.quiet });
      this.draft = structuredClone(this.prefs);
      this.flash('ההעדפות נשמרו.');
    });
  }

  private rotate() {
    if (!this.rotateArmed) {
      this.rotateArmed = true;
      return;
    }
    this.rotateArmed = false;
    return this.run(async () => {
      const r = await rotateKey();
      await this.load();
      this.flash(`נוצר מפתח חדש; ${r.subscriptions_removed} הרשמות הוסרו. מכשירים שמאשרים התראות יירשמו מחדש בפתיחה הבאה של Arx.`);
    });
  }

  private renderKey() {
    if (!isApi() || !(session.me?.permissions_installation ?? []).includes('system.configure')) return nothing;
    return html`<sw-card heading="מפתח ההתראות של ההתקנה">
      <div class="note">מפתח ה־VAPID חותם על כל ההתראות של ההתקנה. החלפה מוחקת את כל ההרשמות של כל המשתמשים; כל מכשיר שמאשר התראות נרשם מחדש בפתיחה הבאה של Arx. רק אם המפתח נחשף (למשל גיבוי Home Assistant שיצא מהשליטה).</div>
      <div class="foot"><sw-button variant=${this.rotateArmed ? 'danger' : 'secondary'} icon="refresh" data-push-rotate ?disabled=${this.busy} @click=${() => this.rotate()}>${this.rotateArmed ? 'לחצו שוב לאישור ההחלפה' : 'החלפת המפתח'}</sw-button></div>
    </sw-card>`;
  }

  private setCat(id: PushCategory, on: boolean) {
    if (!this.draft) return;
    this.draft = { ...this.draft, categories: { ...this.draft.categories, [id]: on } };
  }

  private setQuiet(patch: Partial<PushPrefs['quiet']>) {
    if (!this.draft) return;
    this.draft = { ...this.draft, quiet: { ...this.draft.quiet, ...patch } };
  }

  private fmt(iso: string | null): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  private renderDevice() {
    const api = isApi();
    const here = this.subscribedHere;
    const supported = this.support === 'ok';
    return html`<sw-card heading="המכשיר הזה">
      ${supported ? nothing : html`<div class="note" data-push-support=${this.support}>${SUPPORT_TEXT[this.support as Exclude<PushSupport, 'ok'>]}</div>`}
      ${isFramed() ? html`<div class="note">Arx פתוח כאן בתוך Home Assistant. ההרשמה נרשמת על אותו משתמש גם בגישה מרחוק; לחיצה על התראה פותחת את Arx ב־Home Assistant.</div>` : nothing}
      <div class="row">
        <span class="lbl">התראות Push במכשיר הזה<span class="muted">${here ? 'פעיל: התראות יגיעו גם כשהאפליקציה סגורה' : 'כבוי'}</span></span>
        <span data-push-state=${here ? 'on' : 'off'}><sw-badge kind=${here ? 'live' : 'neutral'} label=${here ? 'פעיל' : 'כבוי'}></sw-badge></span>
      </div>
      <div class="foot">
        ${here
          ? html`<sw-button data-push-disable ?disabled=${this.busy || !api} @click=${() => this.disable()}>כיבוי במכשיר הזה</sw-button>`
          : html`<sw-button variant="primary" icon="bell" data-push-enable ?disabled=${this.busy || !api || !supported} @click=${() => this.enable()}>הפעלת התראות במכשיר הזה</sw-button>`}
        <sw-button icon="bell" data-push-test ?disabled=${this.busy || !api || !this.rows.length} @click=${() => this.test()}>שליחת התראת בדיקה</sw-button>
        ${this.message ? html`<span class="ok" data-push-message>${this.message}</span>` : nothing}
        ${this.error ? html`<span class="err" data-push-error>${this.error}</span>` : nothing}
      </div>
    </sw-card>`;
  }

  private renderCategories() {
    const d = this.draft;
    return html`<sw-card heading="אילו התראות לשלוח">
      <div class="note">רק מה שמותר לך לראות: התראה על מצלמה מגיעה רק למי שיש לו גישה למצלמה או לקומה שלה.</div>
      ${CATEGORIES.map(
        (c) => html`<div class="row">
          <span class="lbl">${c.label}<span class="muted">${c.detail}</span></span>
          <sw-toggle data-push-cat=${c.id} label=${c.label} labelHidden ?checked=${d?.categories[c.id] ?? true} @change=${(e: CustomEvent<{ checked: boolean }>) => this.setCat(c.id, e.detail.checked)}></sw-toggle>
        </div>`,
      )}
    </sw-card>`;
  }

  private renderQuiet() {
    const q = this.draft?.quiet;
    return html`<sw-card heading="שעות שקט">
      <div class="row">
        <span class="lbl">שעות שקט<span class="muted">בטווח הזה לא יישלחו התראות (לפי אזור הזמן של המערכת)</span></span>
        <sw-toggle data-push-quiet label="שעות שקט" labelHidden ?checked=${q?.enabled ?? false} @change=${(e: CustomEvent<{ checked: boolean }>) => this.setQuiet({ enabled: e.detail.checked })}></sw-toggle>
      </div>
      <div class="row">
        <span class="lbl">מ־ עד<span class="muted">טווח לילה (למשל 22:00–07:00) עובר את חצות</span></span>
        <span class="times">
          <sw-field><input type="time" data-push-from aria-label="תחילת שעות השקט" .value=${q?.from ?? '22:00'} ?disabled=${!q?.enabled} @change=${(e: Event) => this.setQuiet({ from: (e.target as HTMLInputElement).value })} /></sw-field>
          <span>–</span>
          <sw-field><input type="time" data-push-to aria-label="סוף שעות השקט" .value=${q?.to ?? '07:00'} ?disabled=${!q?.enabled} @change=${(e: Event) => this.setQuiet({ to: (e.target as HTMLInputElement).value })} /></sw-field>
        </span>
      </div>
      <div class="row">
        <span class="lbl">התראות קריטיות גם בשעות השקט<span class="muted">למשל מצלמה שאיבדה וידאו או דיסק שנכשל</span></span>
        <sw-toggle data-push-critical label="קריטיות גם בשקט" labelHidden ?checked=${q?.allow_critical ?? true} ?disabled=${!q?.enabled} @change=${(e: CustomEvent<{ checked: boolean }>) => this.setQuiet({ allow_critical: e.detail.checked })}></sw-toggle>
      </div>
    </sw-card>`;
  }

  private renderDevices() {
    if (!this.rows.length) return nothing;
    return html`<sw-card heading="המכשירים שלי" data-push-devices>
      ${this.rows.map(
        (r) => html`<div class="row" data-push-row=${r.id}>
          <span class="dev"><sw-icon name=${r.endpoint_hash === this.thisHash ? 'check' : 'bell'} size=${18}></sw-icon><span class="lbl">${serviceName(r.endpoint_host)}${r.endpoint_hash === this.thisHash ? ' · המכשיר הזה' : ''}<span class="muted">נרשם ${this.fmt(r.created_at)} · נשלח אחרון ${this.fmt(r.last_ok_at)}${r.failures ? ` · ${r.failures} כשלים` : ''}${r.channel ? html` · <span class="ltr">${r.channel}</span>` : ''}</span></span></span>
          <sw-button size="sm" variant="ghost" icon="trash" ?disabled=${this.busy} @click=${() => this.removeRow(r)}>הסרה</sw-button>
        </div>`,
      )}
    </sw-card>`;
  }

  render() {
    const dirty = JSON.stringify(this.draft?.categories) !== JSON.stringify(this.prefs?.categories) || JSON.stringify(this.draft?.quiet) !== JSON.stringify(this.prefs?.quiet);
    const body = html`<div class="sections" data-push-settings data-loaded=${this.loaded ? '1' : '0'}>
        ${this.renderDevice()}
        ${this.devicesOnly
          ? nothing
          : html`${this.renderCategories()} ${this.renderQuiet()}
            <div class="foot"><sw-button variant="primary" icon="check" data-push-save ?disabled=${!dirty || this.busy || !isApi()} @click=${() => this.save()}>שמירת ההעדפות</sw-button></div>`}
        ${this.renderDevices()} ${this.renderKey()}
      </div>`;
    if (this.embedded) return body;
    return html`<sw-page heading="התראות" subheading=${isApi() ? (this.devicesOnly ? 'המכשירים שלך' : 'התראות Push לטלפון ולמחשב שלך · לכל משתמש בנפרד') : 'התראות Push · נתוני הדגמה'}>${body}</sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'arx-notifications-settings': ArxNotificationsSettings;
  }
}
