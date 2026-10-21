import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-card';
import '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { messagingPacingApi, PACING_CLASSES, PACING_MODES, type PacingAccount, type PacingClass, type PacingMode, type PacingView } from '../api/messaging-pacing';
import { settingsStyles } from '../styles/settings';
import { bidi } from '../i18n/bidi';
import { mp, type MpKey } from '../i18n/messaging-pacing';
import { BURST_RANGE, MINUTE_RANGE, changedWaits, intValue, span, tone, waitValue } from '../messaging/pacing-model';

/**
 * CR-WA-PACING-295: the shared send budget (Settings > messaging channel). One card: the mode (conservative by default), whether WisKey
 * sends from the same number, the longest wait per class before a message ends visibly, and per account the counters of the last 24
 * hours. No hint paragraphs, no ticket action anywhere: with the tickets module off the card only says "inactive". A change is saved at
 * once (messaging.accounts.manage); a reader without it sees the numbers.
 */
@customElement('messaging-pacing-card')
export class MessagingPacingCard extends LitElement {
  /** account key -> the label the parent screen shows */
  @property({ attribute: false }) labels: Record<string, string> = {};
  @state() private view: PacingView | null = null;
  @state() private state: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private ok = '';
  @state() private busy = false;
  @state() private edited: Partial<Record<PacingClass, string>> = {};
  private okTimer = 0;

  static styles = [settingsStyles, css`
    .tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; font-size: var(--sw-fs-xs); background: var(--sw-surface-3); color: var(--sw-text-2); white-space: nowrap; }
    .tag.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .tag.bad { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
    .tag.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
    .head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-block-end: var(--sw-s-2); }
    .grow { flex: 1; }
    .waits { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--sw-s-2); inline-size: 100%; }
    .waits label { display: flex; flex-direction: column; gap: 4px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    .waits input { inline-size: 100%; min-inline-size: 0; }
    .acct { border-block-start: 1px solid var(--sw-border); padding-block: var(--sw-s-2); }
    .kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 4px var(--sw-s-3); margin-block-start: 6px; }
    .kv div { display: flex; justify-content: space-between; gap: 8px; font-size: var(--sw-fs-sm); }
    .kv b { font-variant-numeric: tabular-nums; }
    .ltr { direction: ltr; unicode-bidi: isolate; }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    window.clearTimeout(this.okTimer);
    super.disconnectedCallback();
  }

  async load(): Promise<void> {
    try {
      this.view = await messagingPacingApi().view();
      this.state = 'ready';
      this.edited = {};
    } catch (e) {
      this.error = describeError(e);
      this.state = 'error';
    }
  }

  private get editable(): boolean {
    return !!this.view?.can_manage;
  }

  private async save(body: Parameters<ReturnType<typeof messagingPacingApi>['save']>[0]): Promise<void> {
    if (this.busy || !this.editable) return;
    this.busy = true;
    this.error = '';
    try {
      this.view = await messagingPacingApi().save(body);
      this.edited = {};
      this.ok = mp('saved');
      window.clearTimeout(this.okTimer);
      this.okTimer = window.setTimeout(() => (this.ok = ''), 2500);
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private commitWaits(): void {
    if (!this.view) return;
    const parsed: Partial<Record<PacingClass, number>> = {};
    for (const k of PACING_CLASSES) {
      const raw = this.edited[k];
      if (raw === undefined) continue;
      const n = waitValue(raw);
      if (n === null) {
        this.error = mp('err_range');
        return;
      }
      parsed[k] = n;
    }
    const changed = changedWaits(this.view, parsed);
    if (Object.keys(changed).length) void this.save({ max_wait_min: changed });
    else this.edited = {};
  }

  private commitRate(field: 'per_minute' | 'burst', raw: string): void {
    const range = field === 'per_minute' ? MINUTE_RANGE : BURST_RANGE;
    const n = intValue(raw, range[0], range[1]);
    if (n === null) {
      this.error = mp(field === 'per_minute' ? 'err_minute' : 'err_burst');
      return;
    }
    void this.save({ [field]: n });
  }

  private duration(seconds: number): string {
    const s = span(seconds);
    return mp(`unit_${s.u}` as MpKey, { n: s.n });
  }

  private accountRow(a: PacingAccount): TemplateResult {
    const c = a.counters_24h;
    const t = tone(a);
    const until = a.backoff ? new Date(a.backoff.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return html`<div class="acct" data-pacing-account=${a.account_key} data-tone=${t}>
      <div class="head"><strong>${bidi(this.labels[a.account_key] ?? a.account_key)}</strong>
        ${a.backoff ? html`<span class="tag warn" data-backoff><sw-icon name="warning" size="14"></sw-icon>${mp('backoffUntil', { time: until })}</span>` : nothing}
        ${a.wiskey.unknown ? html`<span class="tag" data-wiskey-unknown>${mp('wiskeyUnknown')}</span>` : nothing}
        ${a.pairs_in_backoff ? html`<span class="tag warn" data-pairs>${mp('pairs', { n: a.pairs_in_backoff })}</span>` : nothing}
        ${c.expired ? html`<span class="tag bad" data-expired>${mp('expired')}: ${c.expired}</span>` : nothing}</div>
      <div class="kv">
        <div data-k="sent"><span>${mp('sentHour')}</span><b>${a.sends_1h}</b></div>
        <div data-k="wiskey"><span>${mp('wiskeyHour')}</span><b>${a.wiskey_1h}</b></div>
        <div data-k="waiting"><span>${mp('waiting')}</span><b>${a.waiting}</b></div>
        <div data-k="oldest"><span>${mp('oldest')}</span><b>${a.oldest_wait_s === null ? '–' : this.duration(a.oldest_wait_s)}</b></div>
        <div data-k="deferred"><span>${mp('deferred')}</span><b>${c.deferred}</b></div>
        <div data-k="slowed"><span>${mp('slowed')}</span><b>${c.backoff + c.pair_backoff}</b></div>
      </div>
    </div>`;
  }

  render() {
    if (this.state === 'loading') return nothing;
    if (this.state === 'error' || !this.view) {
      return html`<sw-card data-card="pacing" data-state="error"><div class="msg err" role="alert">${mp('loadError')}: ${this.error}
        <sw-button size="sm" variant="ghost" @click=${() => void this.load()}>${mp('retry')}</sw-button></div></sw-card>`;
    }
    const v = this.view;
    return html`<sw-card data-card="pacing" data-state="ready" data-mode=${v.mode}>
      <div class="head"><strong>${mp('title')}</strong>
        ${v.budget ? html`<span class="tag ltr" data-budget>${mp('budget', { n: v.budget.per_minute, b: v.budget.burst })}</span>` : nothing}
        ${v.applies ? nothing : html`<span class="tag" data-inactive>${mp('inactive')}</span>`}
        <span class="grow"></span></div>
      ${this.error ? html`<div class="msg err" role="alert" data-error>${this.error}</div>` : nothing}
      ${this.ok ? html`<div class="msg ok" role="status" data-ok>${this.ok}</div>` : nothing}
      <div class="row"><span class="lbl">${mp('mode')}</span>
        <span class="ctl"><select class="in" data-pacing-mode aria-label=${mp('mode')} ?disabled=${!this.editable || this.busy}
          @change=${(e: Event) => void this.save({ mode: (e.target as HTMLSelectElement).value as PacingMode })}>
          ${PACING_MODES.map((m) => html`<option value=${m} ?selected=${m === v.mode}>${mp(`mode_${m}` as MpKey)}</option>`)}
        </select></span></div>
      <div class="row"><span class="lbl">${mp('wiskey')}</span>
        <sw-toggle label=${mp('wiskey')} labelHidden data-pacing-wiskey .checked=${v.wiskey_shared} ?disabled=${!this.editable || this.busy}
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ wiskey_shared: e.detail.checked })}></sw-toggle></div>
      <div class="row stack"><span class="lbl">${mp('perMinute')} / ${mp('burstLbl')}</span>
        <div class="waits" data-pacing-rate>
          <label>${mp('perMinute')}<input class="in" inputmode="numeric" data-rate="per_minute" .value=${String(v.budget?.per_minute ?? '')} ?disabled=${!this.editable || this.busy || !v.budget}
            @change=${(e: Event) => this.commitRate('per_minute', (e.target as HTMLInputElement).value)}></label>
          <label>${mp('burstLbl')}<input class="in" inputmode="numeric" data-rate="burst" .value=${String(v.budget?.burst ?? '')} ?disabled=${!this.editable || this.busy || !v.budget}
            @change=${(e: Event) => this.commitRate('burst', (e.target as HTMLInputElement).value)}></label></div></div>
      <div class="row stack"><span class="lbl">${mp('limits')}</span>
        <div class="waits" data-pacing-limits>${PACING_CLASSES.map((k) => html`<label>${mp(`cls_${k}` as MpKey)}
          <input class="in" inputmode="numeric" data-wait=${k} .value=${this.edited[k] ?? String(v.max_wait_min[k])} ?disabled=${!this.editable || this.busy}
            @input=${(e: Event) => (this.edited = { ...this.edited, [k]: (e.target as HTMLInputElement).value })} @change=${() => this.commitWaits()}></label>`)}</div></div>
      <div data-pacing-accounts>${v.accounts.length ? repeat(v.accounts, (a) => a.account_key, (a) => this.accountRow(a)) : html`<p class="muted" data-no-accounts>${mp('noAccounts')}</p>`}</div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'messaging-pacing-card': MessagingPacingCard;
  }
}
