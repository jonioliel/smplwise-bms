import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { transportLabel } from '../api/prefs';
import { cachedVideoPolicy, loadVideoPolicy, setPersonalTransport } from '../api/video-transport';
import { normalizeChoice, type TransportChoice, type VideoPolicy } from '../api/video-policy';

/**
 * החשבון שלי › וידאו (VIDEO-TRANSPORT-2400, owner decision 2026-11-04): the viewer's own live-video transport, stored on the server per
 * user (`video.transport`, GET/PUT /me/prefs) so it follows the user to every screen, channel and device. "כמו ההגדרה של המערכת" hands the
 * choice back to the installation (הגדרות › וידאו ומדיה). Every player follows the result exactly: "MSE בלבד" plays MSE only, "WebRTC
 * בלבד" WebRTC only; only "אוטומטי" tries both. It replaces the per-browser choice of earlier versions (read once to seed this one).
 * Same row as the WisKey choices beside it (a native select: the phone's own picker, no custom motion). Mounted only while its section
 * of the user menu is open.
 */
@customElement('sw-video-prefs')
export class SwVideoPrefs extends LitElement {
  @state() private policy: VideoPolicy | null = cachedVideoPolicy();
  @state() private busy = false;
  @state() private failed = false;

  static styles = css`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-block-size: 44px;
    }
    label {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    select {
      min-block-size: 32px;
      max-inline-size: 60%;
      padding: 4px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    select:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .note {
      margin: 2px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      margin: 4px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void loadVideoPolicy().then((p) => (this.policy = p)); // the stored value (once per opening of the section)
  }

  private async pick(select: HTMLSelectElement) {
    this.busy = true;
    this.failed = false;
    try {
      this.policy = await setPersonalTransport(normalizeChoice(select.value));
    } catch {
      this.failed = true;
    } finally {
      this.busy = false;
      select.value = this.policy?.personal ?? ''; // what the server holds (a refused choice springs back)
    }
  }

  render() {
    const p = this.policy;
    const own = p?.personal ?? '';
    const choices: TransportChoice[] = ['auto', 'webrtc', 'mse'];
    return html`
      <div class="row">
        <label for="vid-transport">העברת וידאו חי</label>
        <select id="vid-transport" data-my-video-transport ?disabled=${this.busy || !p} @change=${(e: Event) => void this.pick(e.target as HTMLSelectElement)}>
          <option value="" ?selected=${own === ''}>כמו ההגדרה של המערכת (${transportLabel(p?.installation ?? 'auto')})</option>
          ${choices.map((c) => html`<option value=${c} ?selected=${own === c}>${transportLabel(c)}</option>`)}
        </select>
      </div>
      <p class="note" data-my-video-note>חל על כל המסכים ועל כל מכשיר שבו נכנסים בחשבון הזה.</p>
      ${!p ? html`<p class="note" data-my-video-unavailable>ההגדרה האישית אינה זמינה כרגע</p>` : nothing}
      ${this.failed ? html`<p class="err" role="alert" data-my-video-error>השמירה נכשלה</p>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-video-prefs': SwVideoPrefs;
  }
}
