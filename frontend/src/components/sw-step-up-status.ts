import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { stepUpStatus, type StepUpStatus } from '../api/second-factor';
import { timeText } from '../api/day-format';
import { t, tf } from '../i18n/he';
import { STEP_UP_VERIFIED } from '../shell/step-up';

/**
 * MFA-STEPUP-TRAIN-2490 slice 2: one muted line under the step-up settings - the caller's own confirmation on THIS session: until when
 * it counts, "not confirmed now", or why step-up does not apply here (off / local network / token / no authenticator app). Read once
 * when shown (GET auth/step-up); nothing when the server does not answer (an old server, the demo).
 */
@customElement('sw-step-up-status')
export class SwStepUpStatus extends LitElement {
  @state() private status: StepUpStatus | null = null;

  static styles = css`
    :host {
      display: inline;
    }
  `;

  private onVerified = () => void this.load();

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener(STEP_UP_VERIFIED, this.onVerified);
    void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener(STEP_UP_VERIFIED, this.onVerified);
  }

  private async load() {
    try {
      this.status = await stepUpStatus();
    } catch {
      this.status = null;
    }
  }

  private text(s: StepUpStatus): string {
    if (s.applies) return s.valid_until ? tf('stepUp.mineValid', { time: timeText(s.valid_until) }) : t('stepUp.mineNone');
    if (s.reason === 'off') return t('stepUp.mineOff');
    if (s.reason === 'local_channel') return t('stepUp.mineLocal');
    if (s.reason === 'bearer_token') return t('stepUp.mineBearer');
    return t('stepUp.mineNoMethod');
  }

  render() {
    const s = this.status;
    return s ? html`<span data-step-up-mine=${s.applies ? (s.valid_until ? 'valid' : 'none') : s.reason ?? ''}>${this.text(s)}</span>` : nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-step-up-status': SwStepUpStatus;
  }
}
