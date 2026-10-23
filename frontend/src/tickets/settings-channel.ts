import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-state-panel';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { messagesApi, type ChannelPatch, type ChannelView, type ChannelWarning } from '../api/tickets-messages';
import { ticketsApi } from '../api/tickets';
import { ticketSettingsCss } from './settings-styles';
import { mtt, type MessageTextKey } from './messages-text';
import { tt } from './text';
import './reports-settings';
import './intake-settings'; // CR-INTAKE99: free-text request intake (switches, limits, the managed list of numbers)
import { when } from './ticket-messages';

/**
 * CR-038 slice 5b: Settings › the module › "ערוץ הודעות" (section 14.2; system.configure). The master WhatsApp switch (OFF by default),
 * reply buttons (OFF by default: numbered replies work on every client), the reply-matching window, the e-mail fallback (D13); the
 * ticket uses' account mapping READ-ONLY with a link to Settings › ערוץ ההודעות (slice 5a, where `messaging.accounts.manage` edits it),
 * the accounts' state and last successful send, the warnings of 9.9.3, and the queue's health (spec 17). Naming WhatsApp is allowed on
 * a settings screen; Home Assistant is never named. Events: `notice` {ok | error}.
 */
@customElement('tickets-channel-settings')
export class TicketsChannelSettings extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private view: ChannelView | null = null;
  @state() private failed = '';
  @state() private forbidden = false;
  @state() private busy = false;
  @state() private windowDraft = '';
  @state() private showDepts = false;
  /** CR-DEPT-MANAGER-HANDLERS: "מנהלי מחלקה רואים מספרים מלאים" (null = not read / an older server) */
  @state() private fullPhones: boolean | null = null;

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .chipstate {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-1);
      padding: 2px 10px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
      white-space: nowrap;
    }
    .chipstate[data-state='connected'] {
      color: var(--sw-success-text);
    }
    .chipstate[data-state='disconnected'],
    .chipstate[data-state='missing'] {
      color: var(--sw-danger-text);
    }
    .warn {
      display: flex;
      gap: var(--sw-s-2);
      align-items: flex-start;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .warn[data-severity='red'] {
      border-color: var(--sw-danger);
      color: var(--sw-danger-text);
    }
    .warn[data-severity='amber'] {
      border-color: var(--sw-warning);
    }
    .nums {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: var(--sw-s-2);
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--sw-s-2) var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
    }
    .tile b {
      font-size: var(--sw-fs-lg);
    }
    input.in.short {
      inline-size: 6em;
    }
    .linkish {
      background: none;
      border: 0;
      padding: 0;
      font: inherit;
      color: var(--sw-accent-text);
      cursor: pointer;
    }
  `, bubbleChrome];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private notice(detail: { ok?: string; error?: string }): void {
    this.dispatchEvent(new CustomEvent('notice', { detail, bubbles: true, composed: true }));
  }

  async load(): Promise<void> {
    this.failed = '';
    try {
      this.view = await messagesApi().channel();
      this.windowDraft = String(this.view.whatsapp.reply_window_h);
      void ticketsApi().settings().then((d) => (this.fullPhones = d.directory ? !!d.directory.managers_full_phones : null)).catch(() => undefined);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) this.forbidden = true;
      else this.failed = describeError(e);
    }
  }

  /** CR-DEPT-MANAGER-HANDLERS: the installation document's own revision (the channel view's revision moves with it - reloaded after). */
  private async saveFullPhones(on: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const doc = await ticketsApi().settings();
      const saved = await ticketsApi().saveInstallation(doc.revision, { directory: { managers_full_phones: on } });
      this.fullPhones = !!saved.directory?.managers_full_phones;
      this.notice({ ok: mtt('saved') });
    } catch (e) {
      this.notice({ error: describeError(e) });
    } finally {
      this.busy = false;
      void this.load();
    }
  }

  private async save(patch: ChannelPatch): Promise<void> {
    const v = this.view;
    if (!v || this.busy) return;
    this.busy = true;
    try {
      this.view = await messagesApi().saveChannel(v.revision, patch);
      this.windowDraft = String(this.view.whatsapp.reply_window_h);
      this.notice({ ok: mtt('saved') });
    } catch (e) {
      this.notice({ error: describeError(e) });
      if (e instanceof ApiError && e.status === 409) await this.load();
    } finally {
      this.busy = false;
    }
  }

  private stateLabel(state: string): string {
    return mtt(`state_${state}` as MessageTextKey) || state;
  }

  private accountLabel(key: string | null): string {
    if (!key) return mtt('chUseNone');
    return this.view?.accounts.find((a) => a.key === key)?.label ?? key.replace(/^entry:/, '').slice(0, 8);
  }

  private warningText(w: ChannelWarning): string {
    switch (w.code) {
      case 'required_unmapped':
        return mtt('warn_required_unmapped');
      case 'account_down':
        return mtt('warn_account_down', { state: this.stateLabel(w.state ?? 'unknown') });
      case 'shared_outside':
        return mtt('warn_shared_outside');
      case 'shared_module':
        return mtt('warn_shared_module', { module: w.module ?? '' });
      default:
        return w.code;
    }
  }

  private whatsappCard(v: ChannelView): TemplateResult {
    const win = Number(this.windowDraft);
    const winOk = Number.isInteger(win) && win >= 1 && win <= 336;
    return html`<sw-card heading=${mtt('chCard')} data-card="channel-whatsapp">
      <div class="row"><span class="lbl">${mtt('chEnabled')}<span class="muted">${mtt('chEnabledSub')}</span></span>
        <sw-toggle label=${mtt('chEnabled')} labelHidden .checked=${v.whatsapp.enabled} ?disabled=${this.busy} data-channel-enabled
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ whatsapp: { enabled: e.detail.checked } })}></sw-toggle></div>
      <div class="row"><span class="lbl">${mtt('chButtons')}<span class="muted">${mtt('chButtonsSub')}</span></span>
        <sw-toggle label=${mtt('chButtons')} labelHidden .checked=${v.whatsapp.use_buttons} ?disabled=${this.busy} data-channel-buttons
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ whatsapp: { use_buttons: e.detail.checked } })}></sw-toggle></div>
      <div class="row"><span class="lbl">${mtt('chWindow')}</span>
        <span class="end"><input class="in num short" type="number" min="1" max="336" data-channel-window aria-invalid=${String(!winOk)} .value=${this.windowDraft}
          @input=${(e: Event) => (this.windowDraft = (e.target as HTMLInputElement).value)} /><span class="muted">${mtt('chWindowUnit')}</span>
          <sw-button size="sm" ?disabled=${this.busy || !winOk || win === v.whatsapp.reply_window_h} data-channel-window-save
            @click=${() => void this.save({ whatsapp: { reply_window_h: win } })}>${mtt('save')}</sw-button></span></div>
      <div class="row"><span class="lbl">${mtt('chEmail')}<span class="muted">${mtt('chEmailSub')}</span></span>
        <sw-toggle label=${mtt('chEmail')} labelHidden .checked=${v.email_fallback} ?disabled=${this.busy} data-channel-email
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ email_fallback: e.detail.checked })}></sw-toggle></div>
      <div class="row"><span class="lbl">${mtt('chMailServer')}</span>
        <span class="val" data-mail-state=${v.email.configured ? 'ok' : 'missing'}>${v.email.configured ? mtt('chMailOk') : mtt('chMailMissing')}</span></div>
      <div class="row"><span class="lbl">${tt('otpSettingTitle')}<span class="muted">${tt('otpSettingHint')}</span></span>
        <sw-toggle label=${tt('otpSettingTitle')} labelHidden .checked=${!!v.phone_verify?.required} ?disabled=${this.busy} data-channel-phone-verify
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ phone_verify: { required: e.detail.checked } })}></sw-toggle></div>
      ${this.fullPhones === null ? nothing : html`<div class="row"><span class="lbl">${tt('dmFullPhones')}<span class="muted">${tt('dmFullPhonesHint')}</span></span>
        <sw-toggle label=${tt('dmFullPhones')} labelHidden .checked=${this.fullPhones} ?disabled=${this.busy} data-channel-managers-full-phones
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.saveFullPhones(e.detail.checked)}></sw-toggle></div>`}
    </sw-card>`;
  }

  private usesCard(v: ChannelView): TemplateResult {
    const depts = v.uses.find((u) => u.departments && u.departments.length)?.departments ?? [];
    return html`<sw-card heading=${mtt('chUsesCard')} data-card="channel-uses">
      ${v.uses.map((u) => html`<div class="row" data-use=${u.key}><span class="lbl">${u.label}</span>
        <span class="val">${u.value ? bidi(this.accountLabel(u.value)) : u.inherits_label && u.resolved ? mtt('chUseInherit', { label: u.inherits_label })
          : bidi(this.accountLabel(u.resolved))}</span></div>`)}
      ${depts.length ? html`<div class="row"><span class="lbl">
          <button type="button" class="linkish" data-channel-depts aria-expanded=${String(this.showDepts)} @click=${() => (this.showDepts = !this.showDepts)}>${mtt('chDepartments', { n: depts.length })}</button></span></div>
        ${this.showDepts ? depts.map((d) => html`<div class="row" data-use-dept=${d.id}><span class="lbl">${bidi(d.name)}</span>
          <span class="val">${bidi(this.accountLabel(d.resolved))}</span></div>`) : nothing}` : nothing}
      ${v.warnings.map((w) => html`<div class="warn" data-warning=${w.code} data-severity=${w.severity}>${this.warningText(w)}</div>`)}
      <div class="foot"><sw-button size="sm" variant="ghost" data-channel-manage @click=${() => { window.location.hash = v.accounts_href || '#/system/messaging-accounts'; }}>${mtt('chManage')}</sw-button></div>
    </sw-card>`;
  }

  private accountsCard(v: ChannelView): TemplateResult | typeof nothing {
    const rows = v.accounts.filter((a) => a.ticket);
    if (!rows.length) return nothing;
    return html`<sw-card heading=${mtt('chAccountsCard')} data-card="channel-accounts">
      ${rows.map((a) => html`<div class="row" data-account=${a.key}>
        <span class="lbl">${bidi(a.label)}<span class="muted">${a.last_ok_at ? mtt('chLastOk', { when: when(a.last_ok_at) }) : mtt('chNeverOk')}
          · ${mtt('chToday', { n: a.sends_24h, max: a.per_day ?? '-' })}</span></span>
        <span class="chipstate" data-state=${a.state}>${this.stateLabel(a.state)}</span></div>`)}
    </sw-card>`;
  }

  private healthCard(v: ChannelView): TemplateResult {
    const depth = Object.values(v.health.outbox.depth).reduce((s, n) => s + n, 0);
    const replies = Object.values(v.health.inbound.last_24h).reduce((s, n) => s + n, 0);
    const oldest = v.health.outbox.oldest_open_s;
    const oldestText = oldest == null ? '-' : oldest < 3600 ? `${Math.max(1, Math.round(oldest / 60))}′` : `${Math.round(oldest / 3600)}h`;
    return html`<sw-card heading=${mtt('chHealthCard')} data-card="channel-health">
      <div class="nums">
        <div class="tile" data-health="waiting"><span class="muted">${mtt('chWaiting')}</span><b>${depth}</b></div>
        <div class="tile" data-health="oldest"><span class="muted">${mtt('chOldest')}</span><b>${oldestText}</b></div>
        <div class="tile" data-health="replies"><span class="muted">${mtt('chReplies')}</span><b>${replies}</b></div>
        <div class="tile" data-health="listen"><span class="muted">${mtt('chReplyListen')}</span><b>${v.inbound.wanted ? mtt('chOn') : mtt('chOff')}</b></div>
      </div>
    </sw-card>`;
  }

  render() {
    if (this.forbidden) return html`<sw-state-panel state="forbidden"></sw-state-panel>`;
    if (this.failed) return html`<sw-state-panel state="error" heading=${this.failed}></sw-state-panel>`;
    const v = this.view;
    if (!v) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    return html`<div class="stack cols" data-channel-settings>${this.whatsappCard(v)}${this.usesCard(v)}${this.accountsCard(v)}${this.healthCard(v)}<tickets-reports-settings></tickets-reports-settings><tickets-intake-settings></tickets-intake-settings></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-channel-settings': TicketsChannelSettings;
  }
}
