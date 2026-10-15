import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ApiError } from '../api/client';
import { waNotify, type WaMine } from '../api/notify-whatsapp';
import { nwt, nwtLang } from '../i18n/notify-whatsapp';
import { mediaGlassStyles } from '../styles/media-glass';
import { notifyControls, notifyKnobs } from './notify-css';
import { nIcon } from './notify-icons';
import { waLogic } from './notify-whatsapp-logic';

/**
 * NOTIFWA review F1 / F2: the signed-in user's OWN WhatsApp row - the number notifications would go to (masked, `····NN`), where it comes from,
 * and the user's own consent for exactly that number. Nothing is sent to a number the user has not confirmed here; a changed number shows
 * "המספר השתנה" and waits for a new confirmation. Hidden while the installation's WhatsApp channel is off. Placed by Settings › התראות both for
 * an ordinary user (their only section) and for an administrator (their own row under "ערוצים"). One separable element.
 */
@customElement('notify-whatsapp-mine')
export class NotifyWhatsappMine extends LitElement {
  @state() private mine: WaMine | null = null;
  @state() private busy = false;
  @state() private error = '';

  static styles = [
    mediaGlassStyles,
    notifyKnobs,
    notifyControls,
    css`
      :host {
        display: block;
      }
      :host([hidden]) {
        display: none;
      }
      .box {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding-block: 8px;
        border-block-start: 1px solid var(--sw-border);
      }
      h3 {
        margin: 0;
        font-size: var(--sw-fs-md);
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sub {
        margin: 0;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        min-block-size: 44px;
      }
      .row b {
        font-size: var(--sw-fs-base);
        font-weight: 600;
        min-inline-size: 90px;
      }
      .n {
        font-variant-numeric: tabular-nums;
        direction: ltr;
        unicode-bidi: isolate;
      }
      .warn {
        color: var(--sw-danger-text);
        font-size: var(--sw-fs-sm);
        font-weight: 600;
      }
      .acts {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  /** the settings screen calls this after the channel's switch changed */
  reload(): void {
    void this.load();
  }

  private async load() {
    try {
      this.mine = await waNotify().mine();
    } catch {
      this.mine = null; // the row simply stays hidden: it is a convenience, never a blocker of the screen
    }
  }

  private async set(on: boolean) {
    this.busy = true;
    this.error = '';
    try {
      this.mine = await waNotify().setOptIn(on);
    } catch (err) {
      this.error = err instanceof ApiError ? err.body.user_message || err.code : nwt('error');
    } finally {
      this.busy = false;
    }
  }

  render() {
    const st = waLogic.mineState(this.mine);
    if (st === 'hidden') return nothing;
    const m = this.mine as WaMine;
    const dir = nwtLang() === 'he' || nwtLang() === 'ar' ? 'rtl' : 'ltr';
    const status = st === 'on' ? html`<span class="tag ok" data-wa-mine-status="on">${nIcon('check')}${nwt('mine_on')}</span>`
      : st === 'changed' ? html`<span class="tag bad" data-wa-mine-status="changed">${nIcon('warning')}${nwt('mine_changed')}</span>`
      : st === 'declined' ? html`<span class="tag" data-wa-mine-status="declined">${nwt('mine_declined')}</span>`
      : st === 'none' ? html`<span class="tag" data-wa-mine-status="none">${nwt('mine_none')}</span>`
      : html`<span class="tag" data-wa-mine-status="off">${nwt('mine_off')}</span>`;
    return html`<div class="box" data-wa-mine data-wa-mine-state=${st} dir=${dir}>
      <h3>${nIcon('chat')}${nwt('mine_title')}</h3>
      <p class="sub">${nwt('mine_sub')}</p>
      ${m.has_number ? html`<div class="row"><b>${nwt('mine_number')}</b><span class="n" data-wa-mine-number>${m.masked}</span><small>${nwt(m.source === 'profile' ? 'mine_src_profile' : 'mine_src_directory')}</small></div>` : nothing}
      <div class="row"><b>${nwt('mine_status')}</b>${status}</div>
      ${st === 'off' || st === 'changed' ? html`<div class="acts"><button type="button" class="btn primary sm" data-wa-mine-confirm ?disabled=${this.busy} @click=${() => void this.set(true)}>${nIcon('check')}${nwt('mine_confirm')}</button></div>` : nothing}
      ${st === 'on' ? html`<div class="acts"><button type="button" class="btn quiet sm" data-wa-mine-stop ?disabled=${this.busy} @click=${() => void this.set(false)}>${nwt('mine_stop')}</button></div>` : nothing}
      ${this.error ? html`<div class="warn" role="alert" data-wa-mine-error>${this.error}</div>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notify-whatsapp-mine': NotifyWhatsappMine;
  }
}
