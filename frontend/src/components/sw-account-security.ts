import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-icon';
import './sw-second-factor';
import './sw-passkeys';
import './sw-device-keys';
import './sw-access-tokens';
import { ownPasskeys } from '../api/passkeys';
import { recoveryStatus, secondFactorStatus } from '../api/second-factor';
import { listDeviceKeys } from '../api/factor-screens';
import { listAccessTokens } from '../api/access-tokens';
import { STEP_UP_VERIFIED } from '../shell/step-up';
import { t } from '../i18n/he';
import { tr } from '../i18n/msg/mfa';

/** One line of the overview; `null` = not known (the read failed or the feature is off): the line is left out. */
interface Overview {
  totp: boolean | null;
  passkeys: number | null;
  deviceKeys: number | null;
  recovery: { remaining: number; total: number; low: boolean } | null;
  longLived: number | null;
}

const EMPTY: Overview = { totp: null, passkeys: null, deviceKeys: null, recovery: null, longLived: null };

const settle = async <T,>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch {
    return null;
  }
};

/**
 * MFA-SCREENS-2510 (slice 11 of the second-factor train): החשבון שלי › אבטחה - the signed-in user's factors in one place. An overview
 * first (authenticator app on / off, passkeys, phone keys, recovery codes left, long-lived tokens), then each factor's own block, as each
 * slice built it: the authenticator code with its recovery codes (sw-second-factor, slice 7's count + regenerate), passkeys
 * (sw-passkeys, slice 4), phone keys (sw-device-keys: read-only list + revoke, slice 8) and access tokens (sw-access-tokens, slice 6).
 * The blocks keep their own look (sw-passkeys brings its own heading); this element only gathers them and adds the overview. The overview is a snapshot of the moment the
 * section opened, read again after a phone key was revoked or a step-up proof was recorded. Loaded lazily by the user menu (it carries
 * the QR code library through sw-second-factor).
 */
@customElement('sw-account-security')
export class SwAccountSecurity extends LitElement {
  @state() private ov: Overview | null = null;

  private onChanged = () => void this.load();

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    window.addEventListener(STEP_UP_VERIFIED, this.onChanged);
    this.addEventListener('factors-changed', this.onChanged);
  }

  disconnectedCallback() {
    window.removeEventListener(STEP_UP_VERIFIED, this.onChanged);
    this.removeEventListener('factors-changed', this.onChanged);
    super.disconnectedCallback();
  }

  private seq = 0;

  async load() {
    const mine = ++this.seq;
    const [sf, pk, dk, tokens] = await Promise.all([settle(secondFactorStatus()), settle(ownPasskeys()), settle(listDeviceKeys()), settle(listAccessTokens())]);
    const rc = sf?.enabled ? await settle(recoveryStatus()) : null;
    if (mine !== this.seq) return;
    this.ov = {
      ...EMPTY,
      totp: sf ? sf.enabled : null,
      passkeys: pk && pk.available ? pk.credentials.length : null,
      deviceKeys: dk ? dk.keys.length : null,
      recovery: rc && rc.total > 0 ? { remaining: rc.remaining, total: rc.total, low: rc.low } : sf?.enabled ? { remaining: 0, total: 0, low: true } : null,
      longLived: tokens ? tokens.tokens.filter((x) => x.kind === 'long_lived').length : null,
    };
  }

  private line(key: string, icon: string, label: string, value: string, tone: 'on' | 'off' | 'warn' = 'on') {
    return html`<li data-sec-line=${key} data-state=${tone}><sw-icon name=${icon} size=${16}></sw-icon><span class="l">${label}</span><span class="v">${value}</span></li>`;
  }

  private renderOverview() {
    const o = this.ov;
    if (!o) return html`<div class="muted" data-sec-loading>${tr('טוען…')}</div>`;
    const n = (v: number) => (v === 0 ? tr('אין') : String(v));
    return html`<ul class="ov" aria-label=${tr('סיכום האבטחה')} data-sec-overview>
      ${o.totp !== null ? this.line('totp', 'shield', tr('אפליקציית אימות'), o.totp ? t('secondFactor.on') : t('secondFactor.off'), o.totp ? 'on' : 'off') : nothing}
      ${o.passkeys !== null ? this.line('passkeys', 'lock', tr('מפתחות גישה'), n(o.passkeys), o.passkeys ? 'on' : 'off') : nothing}
      ${o.deviceKeys !== null ? this.line('device-keys', 'sensor', tr('מפתחות טלפון'), n(o.deviceKeys), o.deviceKeys ? 'on' : 'off') : nothing}
      ${o.recovery !== null
        ? this.line('recovery', 'list', t('secondFactor.recoveryTitle'), o.recovery.total ? tr('{n} מתוך {total}', { n: o.recovery.remaining, total: o.recovery.total }) : tr('אין'), o.recovery.low ? 'warn' : 'on')
        : nothing}
      ${o.longLived !== null ? this.line('long-lived', 'link', tr('אסימונים ארוכי טווח'), n(o.longLived), o.longLived ? 'warn' : 'off') : nothing}
    </ul>`;
  }

  render() {
    return html`
      ${this.renderOverview()}
      <section data-sec-block="totp" aria-labelledby="h-totp"><h3 id="h-totp">${tr('אפליקציית אימות וקודי שחזור')}</h3><sw-second-factor></sw-second-factor></section>
      <section data-sec-block="passkeys"><sw-passkeys></sw-passkeys></section>
      <section data-sec-block="device-keys" aria-labelledby="h-dk"><h3 id="h-dk">${tr('מפתחות טלפון')}</h3><sw-device-keys></sw-device-keys></section>
      <section data-sec-block="tokens" aria-labelledby="h-tk"><h3 id="h-tk">${tr('אסימוני גישה')}</h3><sw-access-tokens></sw-access-tokens></section>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      font-size: var(--sw-fs-sm);
    }
    .ov {
      list-style: none;
      margin: 0;
      padding: var(--sw-s-1) var(--sw-s-3);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      display: flex;
      flex-direction: column;
    }
    .ov li {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: var(--sw-s-8);
    }
    .ov li + li {
      border-block-start: thin solid var(--sw-border);
    }
    .ov sw-icon {
      color: var(--sw-text-3);
      flex-shrink: 0;
    }
    .ov li[data-state='on'] sw-icon {
      color: var(--sw-accent);
    }
    .ov li[data-state='warn'] sw-icon,
    .ov li[data-state='warn'] .v {
      color: var(--sw-warning-text);
    }
    .l {
      flex: 1;
      min-inline-size: 0;
      color: var(--sw-text);
    }
    .v {
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
      unicode-bidi: isolate;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
    }
    section + section {
      padding-block-start: var(--sw-s-3);
      border-block-start: thin solid var(--sw-border);
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-account-security': SwAccountSecurity;
  }
}
