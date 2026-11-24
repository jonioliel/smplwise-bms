import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-button';
import './sw-icon';
import { describeError } from '../api/client';
import { listAccessTokens, revokeAccessToken, revokeAllAccessTokens, type TokenList, type TokenRow } from '../api/access-tokens';
import { dayMonthTimeText } from '../api/day-format';
import { whenLabel } from '../api/remote';
import { tr } from '../i18n/msg/components';

const KIND_LABEL: Record<TokenRow['kind'], () => string> = {
  long_lived: () => tr('אסימון ארוך טווח'),
  short_lived: () => tr('כניסה'),
  unknown: () => tr('אסימון'),
  app: () => tr('כניסה שמורה באפליקציה'),
};
const KIND_ICON: Record<TokenRow['kind'], string> = { long_lived: 'lock', short_lived: 'link', unknown: 'link', app: 'sensor' };

/**
 * MFA-TOKENS-2490 (slice 6 of the MFA train): החשבון שלי › אסימוני גישה - the caller's own access tokens. Home Assistant's long-lived
 * tokens and sign-ins are listed read-only, with when and from where (masked) Arx saw them used from outside; Arx never revokes or
 * changes them, so the list says where to revoke them (Home Assistant › Profile › Security). The tokens Arx issued itself (the phone
 * app's saved sign-ins) have a revoke button, and "revoke all" asks once more before it acts. A long-lived token skips the repeated
 * identity check (owner decision Q48), which the list says next to it.
 */
@customElement('sw-access-tokens')
export class SwAccessTokens extends LitElement {
  @state() private data: TokenList | null = null;
  @state() private error = '';
  @state() private message = '';
  @state() private busy = false;
  @state() private armed = false;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  async load() {
    try {
      this.data = await listAccessTokens();
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
      this.data = { ha_listed: false, ha_reason: null, tokens: [], app_enabled: false };
    }
  }

  private async revoke(row: TokenRow) {
    this.busy = true;
    this.message = '';
    this.error = '';
    try {
      await revokeAccessToken(row.id);
      this.message = tr('הכניסה השמורה בוטלה.');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
      await this.load();
    }
  }

  private async revokeAll() {
    if (!this.armed) {
      this.armed = true;
      return;
    }
    this.armed = false;
    this.busy = true;
    this.message = '';
    this.error = '';
    try {
      const r = await revokeAllAccessTokens();
      this.message = tr('בוטלו {n} כניסות שמורות.', { n: r.revoked });
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
      await this.load();
    }
  }

  private renderRow(t: TokenRow) {
    const title = t.name || (t.kind === 'short_lived' && t.client ? t.client : KIND_LABEL[t.kind]());
    const used = t.last_used_at ?? null;
    return html`<li class=${t.current ? 'cur' : ''} data-access-token=${t.id} data-kind=${t.kind} data-source=${t.source}>
      <sw-icon name=${KIND_ICON[t.kind]} size=${16}></sw-icon>
      <div class="what">
        <div class="top">
          <span class="ltr-iso name">${title}</span>
          ${t.name || (t.kind === 'short_lived' && t.client) ? html`<span class="kind">${KIND_LABEL[t.kind]()}</span>` : nothing}
          ${t.current ? html`<sw-badge kind="recorded" label=${tr('המכשיר הזה')} data-current></sw-badge>` : nothing}
          ${t.kind === 'long_lived' ? html`<sw-badge kind="partial" label=${tr('ללא אימות חוזר')} data-exempt></sw-badge>` : nothing}
        </div>
        <div class="sub">
          ${t.created_at ? html`<span>${tr('נוצר {when}', { when: whenLabel(t.created_at) })}</span>` : nothing}
          ${used ? html`<span>· ${tr('בשימוש {when}', { when: whenLabel(used) })}</span>` : nothing}
          ${t.used_in_arx && t.arx_last_seen_at
            ? html`<span data-used-in-arx>· ${tr('ב־Arx מבחוץ {when}', { when: whenLabel(t.arx_last_seen_at) })}</span>${t.arx_address
                  ? html`<span class="ltr-iso">· ${t.arx_address}</span>`
                  : nothing}`
            : t.source === 'ha'
              ? html`<span>· ${tr('לא שימש מבחוץ ב־Arx')}</span>`
              : nothing}
          ${t.expires_at ? html`<span>· ${tr('בתוקף עד {when}', { when: dayMonthTimeText(new Date(t.expires_at)) })}</span>` : nothing}
        </div>
      </div>
      ${t.revocable
        ? html`<sw-button size="sm" variant="ghost" icon="logout" data-revoke-token ?disabled=${this.busy} @click=${() => void this.revoke(t)}>${tr('בטל')}</sw-button>`
        : nothing}
    </li>`;
  }

  private renderNote(d: TokenList) {
    if (d.ha_listed || d.ha_reason === 'local_user') return nothing;
    const text =
      d.ha_reason === 'local_channel'
        ? tr('רשימת האסימונים של תשתית המערכת מוצגת בכניסה מרחוק. כאן מוצג רק מה ש־Arx ראה.')
        : d.ha_reason === 'ha_unavailable'
          ? tr('תשתית המערכת לא זמינה כרגע. מוצג מה ש־Arx ראה.')
          : tr('הכניסה הזו אינה מחזיקה אסימון של תשתית המערכת. מוצג מה ש־Arx ראה.');
    return html`<div class="muted" data-tokens-note=${d.ha_reason ?? ''}>${text}</div>`;
  }

  render() {
    const d = this.data;
    if (d === null) return html`<div class="muted">${tr('טוען אסימונים…')}</div>`;
    const rows = d.tokens;
    const ha = rows.filter((t) => t.kind !== 'app');
    const app = rows.filter((t) => t.kind === 'app');
    const longLived = ha.some((t) => t.kind === 'long_lived');
    return html`
      ${this.renderNote(d)}
      ${rows.length
        ? html`<ul data-access-tokens-list>${ha.map((t) => this.renderRow(t))}${app.map((t) => this.renderRow(t))}</ul>`
        : this.error
          ? nothing
          : html`<div class="muted" data-access-tokens-empty>${tr('אין אסימוני גישה.')}</div>`}
      ${longLived
        ? html`<div class="warn" role="note" data-long-lived-note>
            <sw-icon name="warning" size=${14}></sw-icon>
            <span>${tr('אסימון ארוך טווח נכנס בלי אימות חוזר לפני שינויים. אם אינך מזהה אותו, בטל אותו בתשתית המערכת.')}</span>
          </div>`
        : nothing}
      ${d.ha_reason !== 'local_user' && (ha.length || !d.ha_listed)
        ? html`<div class="muted" data-ha-hint>${tr('את אסימוני תשתית המערכת מבטלים בתשתית המערכת: פרופיל ‹ אבטחה. Arx לא משנה אותם.')}</div>`
        : nothing}
      ${app.length > 1
        ? html`<div class="foot">
            <sw-button size="sm" variant=${this.armed ? 'danger' : 'secondary'} icon="logout" data-revoke-all-tokens ?disabled=${this.busy} @click=${() => void this.revokeAll()}>
              ${this.armed ? tr('לאשר? כל הכניסות השמורות יבוטלו') : tr('בטל את כל הכניסות השמורות')}
            </sw-button>
            ${this.armed ? html`<sw-button size="sm" variant="ghost" @click=${() => (this.armed = false)}>${tr('ביטול')}</sw-button>` : nothing}
          </div>`
        : nothing}
      ${this.message ? html`<div class="ok" role="status" data-access-tokens-message>${this.message}</div>` : nothing}
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
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
      gap: 10px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    li:last-child {
      border-block-end: 0;
    }
    li > sw-icon {
      color: var(--sw-text-3);
      flex-shrink: 0;
    }
    li.cur > sw-icon {
      color: var(--sw-accent);
    }
    .what {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .name {
      overflow-wrap: anywhere;
    }
    .kind {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .sub {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ltr-iso {
      unicode-bidi: isolate;
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .warn {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
    }
    .warn sw-icon {
      flex-shrink: 0;
      margin-block-start: 1px;
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
    'sw-access-tokens': SwAccessTokens;
  }
}
