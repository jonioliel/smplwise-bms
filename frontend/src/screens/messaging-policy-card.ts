import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-card';
import '../components/sw-toggle';
import '../components/sw-button';
import { ApiError, describeError } from '../api/client';
import { messagingPolicyApi, POLICY_ROLES, type PolicyRole, type PolicyView } from '../api/messaging-policy';
import { settingsStyles } from '../styles/settings';
import { bidi } from '../i18n/bidi';
import { mw, type MwKey } from '../i18n/messaging-policy';
import { blocksEverything, minutesValue, pageOf, phoneDigits } from '../messaging/policy-model';
import { timeText } from '../api/day-format';

/**
 * WAPACE-295: the WhatsApp send policy (Settings > messaging channel). Two blocks in one card: the allow-list of handlers and providers
 * who may receive WhatsApp from the add-on (with one switch that makes it binding; a page of five at a time so the card never scrolls), and
 * the timed self-messages test window that ends by itself. The hour and day send limits are the account's own pacing, edited on the account.
 * A change is saved at once (messaging.accounts.manage); a reader without it sees the list.
 */
@customElement('messaging-policy-card')
export class MessagingPolicyCard extends LitElement {
  @state() private view: PolicyView | null = null;
  @state() private state: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private ok = '';
  @state() private busy = false;
  @state() private page = 0;
  @state() private phone = '';
  @state() private label = '';
  @state() private role: PolicyRole = 'handler';
  @state() private minutes = '30';
  private okTimer = 0;
  private tick = 0;

  static styles = [settingsStyles, css`
    :host { display: block; min-inline-size: 0; }
    .head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-block-end: var(--sw-s-2); }
    .head strong { min-inline-size: 0; overflow-wrap: anywhere; }
    .tag { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: var(--sw-fs-xs); background: var(--sw-surface-3); color: var(--sw-text-2); white-space: nowrap; }
    .tag.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .tag.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--sw-s-2); align-items: end; inline-size: 100%; }
    .grid label { display: flex; flex-direction: column; gap: 4px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); min-inline-size: 0; }
    .grid .in { inline-size: 100%; min-inline-size: 0; box-sizing: border-box; }
    .entry { display: flex; align-items: center; gap: var(--sw-s-2); min-inline-size: 0; padding-block: 6px; border-block-start: 1px solid var(--sw-border); }
    .entry .name { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    .pager { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-block-start: 6px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .sect { border-block-start: 1px solid var(--sw-border); margin-block-start: var(--sw-s-2); padding-block-start: var(--sw-s-2); }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
    this.tick = window.setInterval(() => this.view?.self_messages.active && void this.refreshWindow(), 30_000);
  }

  disconnectedCallback(): void {
    window.clearTimeout(this.okTimer);
    window.clearInterval(this.tick);
    super.disconnectedCallback();
  }

  async load(): Promise<void> {
    try {
      this.view = await messagingPolicyApi().view();
      this.state = 'ready';
    } catch (e) {
      this.error = describeError(e);
      this.state = 'error';
    }
  }

  /** A window that ended by itself while the card was open. */
  private async refreshWindow(): Promise<void> {
    try {
      this.view = await messagingPolicyApi().view();
    } catch {
      /* the next tick tries again */
    }
  }

  private get editable(): boolean {
    return !!this.view?.can_manage;
  }

  private async run(fn: () => Promise<PolicyView>, after?: () => void): Promise<void> {
    if (this.busy || !this.editable) return;
    this.busy = true;
    this.error = '';
    try {
      this.view = await fn();
      after?.();
      this.ok = mw('saved');
      window.clearTimeout(this.okTimer);
      this.okTimer = window.setTimeout(() => (this.ok = ''), 2500);
    } catch (e) {
      this.error = e instanceof ApiError && e.status === 422 && JSON.stringify(e.body.details ?? {}).includes('already_listed') ? mw('err_listed') : describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private add(): void {
    if (phoneDigits(this.phone) === null) {
      this.error = mw('err_phone');
      return;
    }
    if (!this.label.trim()) {
      this.error = mw('err_label');
      return;
    }
    const body = { phone: this.phone.trim(), label: this.label.trim(), role: this.role };
    void this.run(() => messagingPolicyApi().add(body), () => {
      this.phone = '';
      this.label = '';
      this.page = Number.MAX_SAFE_INTEGER; // the new entry is on the last page
    });
  }

  private startWindow(): void {
    const range = this.view?.self_messages.minutes_range ?? [1, 240];
    const n = minutesValue(this.minutes, range);
    if (n === null) {
      this.error = mw('err_minutes', { lo: range[0], hi: range[1] });
      return;
    }
    void this.run(() => messagingPolicyApi().selfWindow(n));
  }

  render() {
    if (this.state === 'loading') return nothing;
    if (this.state === 'error' || !this.view) {
      return html`<sw-card data-card="policy" data-state="error"><div class="msg err" role="alert">${mw('loadError')}: ${this.error}
        <sw-button size="sm" variant="ghost" @click=${() => void this.load()}>${mw('retry')}</sw-button></div></sw-card>`;
    }
    const v = this.view;
    const pg = pageOf(v.allow, this.page);
    const off = !this.editable || this.busy;
    return html`<sw-card data-card="policy" data-state="ready">
      <div class="head"><strong>${mw('title')}</strong>
        ${this.editable ? nothing : html`<span class="tag" data-read-only>${mw('readOnly')}</span>`}</div>
      ${this.error ? html`<div class="msg err" role="alert" data-error>${this.error}</div>` : nothing}
      ${this.ok ? html`<div class="msg ok" role="status" data-ok>${this.ok}</div>` : nothing}
      <div class="row"><span class="lbl">${mw('allowTitle')}</span></div>
      <div class="row"><span class="lbl">${mw('enforce')}</span>
        <sw-toggle label=${mw('enforce')} labelHidden data-policy-enforce .checked=${v.enforce} ?disabled=${off}
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.run(() => messagingPolicyApi().setEnforce(e.detail.checked))}></sw-toggle>
        ${v.enforce ? nothing : html`<span class="tag" data-enforce-off>${mw('enforceOff')}</span>`}</div>
      ${blocksEverything(v.enforce, v.allow.length) ? html`<div class="msg err" role="status" data-blocks-all>${mw('blocksAll')}</div>` : nothing}
      <div data-policy-list>
        ${v.allow.length ? repeat(pg.items, (e) => e.id, (e) => html`<div class="entry" data-entry=${e.id}>
          <span class="name">${bidi(e.label)}</span>
          <span class="tag" data-role=${e.role}>${mw(`role_${e.role}` as MwKey)}</span>
          <span class="tag ltr">${e.last4 ? `…${e.last4}` : '–'}</span>
          ${this.editable ? html`<sw-button size="sm" variant="ghost" data-remove ?disabled=${this.busy}
            @click=${() => void this.run(() => messagingPolicyApi().remove(e.id))}>${mw('remove')}</sw-button>` : nothing}</div>`)
          : html`<p class="muted" data-empty>${mw('empty')}</p>`}
        ${pg.pages > 1 ? html`<div class="pager" data-pager>
          <sw-button size="sm" variant="ghost" data-prev ?disabled=${pg.page === 0} @click=${() => (this.page = pg.page - 1)}>${mw('prev')}</sw-button>
          <span>${mw('page', { n: pg.page + 1, m: pg.pages })}</span>
          <sw-button size="sm" variant="ghost" data-next ?disabled=${pg.page >= pg.pages - 1} @click=${() => (this.page = pg.page + 1)}>${mw('next')}</sw-button></div>` : nothing}
      </div>
      ${this.editable ? html`<div class="grid" data-policy-add>
        <label>${mw('phone')}<input class="in ltr" inputmode="tel" data-add="phone" .value=${this.phone} ?disabled=${this.busy}
          @input=${(e: Event) => (this.phone = (e.target as HTMLInputElement).value)}></label>
        <label>${mw('label')}<input class="in" maxlength="80" data-add="label" .value=${this.label} ?disabled=${this.busy}
          @input=${(e: Event) => (this.label = (e.target as HTMLInputElement).value)}></label>
        <label>${mw('role')}<select class="in" data-add="role" ?disabled=${this.busy} @change=${(e: Event) => (this.role = (e.target as HTMLSelectElement).value as PolicyRole)}>
          ${POLICY_ROLES.map((r) => html`<option value=${r} ?selected=${r === this.role}>${mw(`role_${r}` as MwKey)}</option>`)}</select></label>
        <sw-button size="sm" variant="primary" data-add-button ?disabled=${this.busy} @click=${() => this.add()}>${mw('add')}</sw-button></div>` : nothing}
      <div class="sect" data-policy-self>
        <div class="head"><strong>${mw('selfTitle')}</strong>
          ${v.self_messages.active
            ? html`<span class="tag warn" data-self-on>${mw('selfActive', { time: v.self_messages.until ? timeText(new Date(v.self_messages.until)) : '' })}</span>`
            : html`<span class="tag" data-self-off>${mw('selfOff')}</span>`}</div>
        ${this.editable ? html`<div class="grid">
          <label>${mw('selfMinutes')}<input class="in" inputmode="numeric" data-self-minutes .value=${this.minutes} ?disabled=${this.busy}
            @input=${(e: Event) => (this.minutes = (e.target as HTMLInputElement).value)}></label>
          <sw-button size="sm" variant="primary" data-self-start ?disabled=${this.busy} @click=${() => this.startWindow()}>${mw('selfStart')}</sw-button>
          <sw-button size="sm" variant="ghost" data-self-stop ?disabled=${this.busy || !v.self_messages.active}
            @click=${() => void this.run(() => messagingPolicyApi().selfWindow(null))}>${mw('selfStop')}</sw-button></div>` : nothing}
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'messaging-policy-card': MessagingPolicyCard;
  }
}
