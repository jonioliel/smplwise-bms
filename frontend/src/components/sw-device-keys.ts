import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-button';
import './sw-icon';
import { describeError } from '../api/client';
import { listDeviceKeys, revokeDeviceKey, type DeviceKeyList, type DeviceKeyRow } from '../api/factor-screens';
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
 * A read-only list (name, what unlocks the key, the attestation verdict, created / last used) with a revoke per key. The revoke needs a
 * fresh step-up proof: the server answers 403 `step_up_required`, the shell's dialog asks for it and sends the revoke once more
 * (api/client.ts); a cancelled dialog leaves the key in place and says so. A key that does not count under the attestation mode is
 * marked. No add button: a key is created on the phone.
 */
@customElement('sw-device-keys')
export class SwDeviceKeys extends LitElement {
  @state() private data: DeviceKeyList | null = null;
  @state() private error = '';
  @state() private message = '';
  @state() private busy = false;
  @state() private armed = '';

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  async load() {
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
      ${d.keys.length
        ? html`<ul data-device-keys-list>${d.keys.map((k) => this.renderRow(k))}</ul>`
        : this.error
          ? nothing
          : html`<div class="muted" data-device-keys-empty>${tr('אין מפתחות טלפון. מוסיפים מפתח באפליקציית Android.')}</div>`}
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
