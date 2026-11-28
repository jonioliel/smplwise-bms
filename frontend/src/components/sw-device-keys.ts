import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-button';
import './sw-icon';
import { ApiError, describeError } from '../api/client';
import {
  appDeviceKey, deviceKeyEnrolment, DeviceKeyCancelled, DeviceKeyNotKept, listDeviceKeys, PHONE_KEY_APP_VERSION, registerDeviceKey, revokeDeviceKey,
  type AppDeviceKey, type DeviceKeyEnrolment, type DeviceKeyList, type DeviceKeyRow,
} from '../api/factor-screens';
import { whenLabel } from '../api/remote';
import { tr } from '../i18n/msg/mfa';

const ATTESTED: Record<DeviceKeyRow['attested'], { label: () => string; kind: 'live' | 'neutral' | 'partial' } | null> = {
  hardware: { label: () => tr('מאומת בחומרה'), kind: 'live' },
  software: { label: () => tr('מפתח תוכנה'), kind: 'partial' },
  none: { label: () => tr('ללא אימות מכשיר'), kind: 'neutral' },
  failed: { label: () => tr('אימות המכשיר נכשל'), kind: 'partial' },
  not_checked: null,
};

/**
 * MFA-SCREENS-2510: החשבון שלי › אבטחה › מפתחות טלפון - the caller's own phone keys (slice 8, registered only in the Android app).
 * A list (name, what unlocks the key, the attestation verdict, created / last used) with a revoke per key. The revoke needs a
 * fresh step-up proof: the server answers 403 `step_up_required`, the shell's dialog asks for it and sends the revoke once more
 * (api/client.ts); a cancelled dialog leaves the key in place and says so. A key that does not count under the attestation mode is
 * marked.
 * FIX-PHONEKEY-2570 (second deep review SA2-01): the ADD. Inside the Android app whose bridge can create a key and whose prompt shows
 * the signed action (api/factor-screens.ts `deviceKeyEnrolment` = ready) the section offers "add a key on this phone"
 * (`registerDeviceKey`: server challenge -> the app's Keystore key -> the phone's prompt signs -> the server registers, audits, and
 * asks for a confirmation first when the account already has a factor). The key of THIS phone is marked in the list; while it is
 * active the add is not offered (the app keeps one key per server and a new one replaces it: revoke first), so a refused registration
 * never costs the phone a key the server still counts. An older app is asked to update; a browser says where a key is added.
 */
@customElement('sw-device-keys')
export class SwDeviceKeys extends LitElement {
  @state() private data: DeviceKeyList | null = null;
  @state() private error = '';
  @state() private message = '';
  @state() private busy = false;
  @state() private armed = '';
  /** FIX-PHONEKEY-2570: can this page register a key, and what the app holds for this server. */
  @state() private enrol: DeviceKeyEnrolment = 'no_app';
  @state() private app: AppDeviceKey | null = null;
  @state() private label = '';
  @state() private adding = false;

  connectedCallback() {
    super.connectedCallback();
    this.enrol = deviceKeyEnrolment();
    void this.load();
  }

  private async readApp() {
    this.app = this.enrol === 'ready' ? await appDeviceKey() : null;
  }

  async load() {
    void this.readApp();
    try {
      this.data = await listDeviceKeys();
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
      this.data = { keys: [], auth_kind: 'biometric_or_screen_lock', attestation: 'off', max: 0 };
    }
  }

  private async revoke(row: DeviceKeyRow) {
    if (this.armed !== row.id) {
      this.armed = row.id;
      return;
    }
    this.armed = '';
    this.busy = true;
    this.message = '';
    this.error = '';
    let failed = '';
    try {
      await revokeDeviceKey(row.id);
      this.message = tr('מפתח הטלפון בוטל.');
      this.dispatchEvent(new CustomEvent('factors-changed', { bubbles: true, composed: true }));
    } catch (err) {
      failed = describeError(err);
      this.error = failed;
    } finally {
      this.busy = false;
      await this.load();
      // FLAKY-FIX-2520: the reload after the revoke clears its own load error (`load()` sets error = ''), which wiped the revoke's
      // reason one round trip after it appeared ("a cancelled step-up keeps the key and says so" showed the line only for a moment).
      // The revoke's reason stays until the next action (a failed reload shows its own reason instead).
      if (failed && !this.error) this.error = failed;
    }
  }

  /** FIX-PHONEKEY-2570 (SA2-01): register this phone's key (a tap: the app refuses a creation the person did not start). */
  private async add(e: Event) {
    e.preventDefault();
    if (this.busy || this.adding) return;
    this.adding = true;
    this.busy = true;
    this.armed = '';
    this.message = '';
    this.error = '';
    let failed = '';
    try {
      await registerDeviceKey(this.label);
      this.label = '';
      this.message = tr('מפתח הטלפון נוסף. מעכשיו אפשר לאשר פעולות בטלפון הזה.');
      this.dispatchEvent(new CustomEvent('factors-changed', { bubbles: true, composed: true }));
    } catch (err) {
      failed = this.explain(err);
      this.error = failed;
    } finally {
      this.adding = false;
      this.busy = false;
      await this.load();
      if (failed && !this.error) this.error = failed;
    }
  }

  /** The person's words for a failed registration: the app's own reason, or the server's message. */
  private explain(err: unknown): string {
    if (err instanceof DeviceKeyNotKept) return tr('המפתח נרשם בחשבון, אבל האפליקציה לא שמרה אותו. בטלו אותו ברשימה ונסו שוב.');
    if (err instanceof DeviceKeyCancelled) {
      const why = err.message;
      if (why === 'cancelled') return tr('הרישום בוטל בטלפון. המפתח לא נוסף.');
      if (why === 'no_gesture') return tr('לחצו שוב על ״הוספת מפתח בטלפון הזה״.');
      if (why === 'unavailable') return tr('בטלפון הזה לא מוגדרים טביעת אצבע, זיהוי פנים או נעילת מסך. הגדירו אחד מהם ונסו שוב.');
      if (why === 'busy') return tr('הטלפון כבר מציג בקשת אישור. סיימו אותה ונסו שוב.');
      return tr('הטלפון לא הצליח ליצור את המפתח. המפתח לא נוסף.');
    }
    // the challenge lives 60 s: a confirmation that took longer leaves it expired (the confirmation itself was recorded)
    if (err instanceof ApiError && err.body.code === 'device_key_invalid' && (err.body.details as { reason?: string } | undefined)?.reason === 'challenge')
      return tr('הזמן לרישום עבר. לחצו שוב על ״הוספת מפתח בטלפון הזה״.');
    return describeError(err);
  }

  /** FIX-PHONEKEY-2570: where a key is added (a browser, an older app), or the add itself (inside the app that can register one). */
  private renderAdd(d: DeviceKeyList) {
    const v = PHONE_KEY_APP_VERSION;
    if (this.enrol === 'no_app') {
      return d.keys.length || this.error
        ? nothing
        : html`<div class="muted" data-device-keys-empty data-device-keys-no-app>${tr('אין מפתחות טלפון. מוסיפים מפתח מתוך אפליקציית Arx ל־Android (גרסה {v} ומעלה): החשבון שלי › אבטחה › מפתחות טלפון.', { v })}</div>`;
    }
    const empty = d.keys.length || this.error ? nothing : html`<div class="muted" data-device-keys-empty>${tr('אין מפתחות טלפון.')}</div>`;
    if (this.enrol === 'update') {
      return html`${empty}<div class="warn" role="note" data-device-keys-update><sw-icon name="warning" size=${14}></sw-icon><span>${tr('כדי להוסיף מפתח טלפון צריך לעדכן את אפליקציית Arx ל־Android לגרסה {v} ומעלה.', { v })}</span></div>`;
    }
    const app = this.app;
    const mine = app?.keyId ? d.keys.find((k) => k.id === app.keyId) : undefined;
    if (mine) return html`${empty}<div class="muted" data-device-key-this-has>${tr('לטלפון הזה כבר יש מפתח פעיל בחשבון. כדי להחליף אותו, בטלו אותו קודם.')}</div>`;
    if (app && !app.available)
      return html`${empty}<div class="warn" role="note" data-device-key-unavailable><sw-icon name="warning" size=${14}></sw-icon><span>${tr('בטלפון הזה לא מוגדרים טביעת אצבע, זיהוי פנים או נעילת מסך. הגדירו אחד מהם ונסו שוב.')}</span></div>`;
    if (d.max > 0 && d.keys.length >= d.max) return html`${empty}<div class="muted" data-device-key-limit>${tr('הגעת למספר המרבי של מפתחות טלפון. בטלו מפתח ישן כדי להוסיף.')}</div>`;
    return html`${empty}<form class="add" data-device-key-add @submit=${(e: Event) => void this.add(e)}>
        <input type="text" maxlength="60" aria-label=${tr('שם הטלפון (לא חובה)')} placeholder=${tr('שם הטלפון (לא חובה)')} .value=${this.label} ?disabled=${this.busy}
          data-device-key-label @input=${(e: Event) => (this.label = (e.target as HTMLInputElement).value)} />
        <sw-button size="sm" variant="primary" icon="plus" ?disabled=${this.busy} data-device-key-add-button @click=${(e: Event) => void this.add(e)}>${this.adding ? tr('ממתין לאישור בטלפון…') : tr('הוספת מפתח בטלפון הזה')}</sw-button>
      </form>
      <div class="muted" data-device-key-add-note>${tr('הטלפון יבקש טביעת אצבע, זיהוי פנים או נעילת מסך. המפתח נשאר בטלפון; השרת שומר רק את החלק הציבורי שלו.')}</div>
      ${app?.exists ? html`<div class="muted" data-device-key-replaces>${tr('בטלפון שמור מפתח קודם שאינו פעיל בחשבון הזה. הוספה תחליף אותו.')}</div>` : nothing}`;
  }

  private renderRow(k: DeviceKeyRow) {
    const att = ATTESTED[k.attested];
    const armed = this.armed === k.id;
    return html`<li data-device-key=${k.id} data-attested=${k.attested}>
      <sw-icon name="sensor" size=${16}></sw-icon>
      <div class="what">
        <div class="top">
          <span class="name">${k.label || tr('טלפון')}</span>
          ${att ? html`<sw-badge kind=${att.kind} label=${att.label()} data-device-key-attested></sw-badge>` : nothing}
          ${k.counts === false ? html`<sw-badge kind="partial" label=${tr('לא נספר')} data-device-key-off></sw-badge>` : nothing}
          ${this.app?.keyId === k.id ? html`<sw-badge kind="neutral" label=${tr('הטלפון הזה')} data-device-key-this></sw-badge>` : nothing}
        </div>
        <div class="sub">
          <span>${k.auth_kind === 'biometric' ? tr('טביעת אצבע או פנים') : tr('טביעת אצבע, פנים או נעילת מסך')}</span>
          <span>· ${tr('נוסף {when}', { when: whenLabel(k.created_at) })}</span>
          ${k.last_used_at ? html`<span>· ${tr('בשימוש {when}', { when: whenLabel(k.last_used_at) })}</span>` : nothing}
        </div>
      </div>
      <span class="acts">
        <sw-button size="sm" variant=${armed ? 'danger' : 'ghost'} icon="trash" data-revoke-device-key ?disabled=${this.busy} @click=${() => void this.revoke(k)}>${armed ? tr('לבטל?') : tr('בטל')}</sw-button>
        ${armed ? html`<sw-button size="sm" variant="ghost" data-revoke-device-key-cancel @click=${() => (this.armed = '')}>${tr('ביטול')}</sw-button>` : nothing}
      </span>
    </li>`;
  }

  render() {
    const d = this.data;
    if (d === null) return html`<div class="muted">${tr('טוען…')}</div>`;
    return html`
      ${d.keys.length ? html`<ul data-device-keys-list>${d.keys.map((k) => this.renderRow(k))}</ul>` : nothing}
      ${this.renderAdd(d)}
      ${d.keys.some((k) => k.counts === false)
        ? html`<div class="warn" role="note" data-device-keys-required><sw-icon name="warning" size=${14}></sw-icon><span>${tr('מפתח שאינו מאומת בחומרה אינו נספר. רשום אותו מחדש באפליקציה.')}</span></div>`
        : nothing}
      ${this.message ? html`<div class="ok" role="status" data-device-keys-message>${this.message}</div>` : nothing}
      ${this.error ? html`<div class="err" role="alert" data-device-keys-error>${this.error}</div>` : nothing}
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    li {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: var(--sw-s-1h) 0;
      border-block-end: thin solid var(--sw-border);
    }
    li:last-child {
      border-block-end: 0;
    }
    li > sw-icon {
      color: var(--sw-text-3);
      flex-shrink: 0;
    }
    .what {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
    }
    .top {
      display: flex;
      align-items: center;
      gap: var(--sw-s-1h);
      flex-wrap: wrap;
    }
    .name {
      overflow-wrap: anywhere;
      unicode-bidi: isolate;
    }
    .sub {
      display: flex;
      gap: var(--sw-s-1);
      flex-wrap: wrap;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .acts {
      display: flex;
      gap: var(--sw-s-1);
      flex-shrink: 0;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .warn {
      display: flex;
      align-items: flex-start;
      gap: var(--sw-s-1h);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
    }
    .warn sw-icon {
      flex-shrink: 0;
      margin-block-start: var(--sw-s-1);
    }
    .add {
      display: flex;
      gap: var(--sw-s-2);
      align-items: center;
      flex-wrap: wrap;
    }
    .add input {
      flex: 1 1 10em;
      min-inline-size: 0;
      min-block-size: var(--sw-s-8);
      padding: var(--sw-s-1) var(--sw-s-2);
      border: thin solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-xs);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-device-keys': SwDeviceKeys;
  }
}
