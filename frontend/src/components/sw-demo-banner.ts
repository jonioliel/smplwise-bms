import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-icon';
import './sw-button';
import { describeError } from '../api/client';
import { can, loadSession, onSession, type Session } from '../api/session';
import { demoLeft, extendDemo, stopDemo } from '../api/readiness';

/** CR-READY96: the demo-mode strip. Shown to EVERY signed-in user while a demo runs (anyone looking at the box must know the data is made up);
 * the extend and exit buttons only for whoever holds demo.run. Presentation only: the server refuses physical actions in demo mode itself. */
@customElement('sw-demo-banner')
export class SwDemoBanner extends LitElement {
  @state() private session: Session | null = null;
  @state() private now = Date.now();
  @state() private busy = false;
  @state() private error = '';
  private stop: (() => void) | null = null;
  private timer = 0;

  connectedCallback() {
    super.connectedCallback();
    this.stop = onSession((s) => (this.session = s));
    this.timer = window.setInterval(() => (this.now = Date.now()), 15000);
  }

  disconnectedCallback() {
    this.stop?.();
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  private async extend() {
    this.busy = true;
    this.error = '';
    try {
      await extendDemo(1);
      await loadSession();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async leave() {
    this.busy = true;
    this.error = '';
    try {
      await stopDemo();
      window.location.reload(); // every screen and cache goes back to the real installation
    } catch (err) {
      this.error = describeError(err);
      this.busy = false;
    }
  }

  render() {
    const d = this.session?.me?.demo;
    if (!d?.active) return nothing;
    const left = demoLeft(d.expires_at, this.now);
    return html`<div class="bar" role="status" aria-live="polite" data-demo-banner>
      <span class="tag"><sw-icon name="play" size=${12}></sw-icon>הדגמה</span>
      <span class="txt">הנתונים מדומים · פעולות למצלמות, לדלתות ולמכשירים חסומות · ההתקנה האמיתית לא נגעה</span>
      <span class="who" data-demo-left>${left ? html`מסתיים אוטומטית בעוד <b>${left}</b> ש׳` : 'ההדגמה מסתיימת'}${d.started_by_name ? ` · הופעל על ידי ${d.started_by_name}` : ''}</span>
      <span class="sp"></span>
      ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
      ${can('demo.run')
        ? html`<sw-button size="sm" variant="ghost" ?disabled=${this.busy} data-demo-extend @click=${() => void this.extend()}>הארכה</sw-button>
            <sw-button size="sm" icon="close" ?disabled=${this.busy} data-demo-exit @click=${() => void this.leave()}>יציאה מההדגמה</sw-button>`
        : nothing}
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
      flex: none;
    }
    .bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 12px;
      padding: 6px 16px;
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      border-block-end: 2px solid var(--sw-warning);
      font-size: var(--sw-fs-sm);
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-warning);
      color: var(--sw-text-inverse);
      font-weight: var(--sw-fw-semibold);
    }
    .who b {
      font-variant-numeric: tabular-nums;
    }
    .sp {
      flex: 1;
    }
    .err {
      color: var(--sw-danger-text);
    }
    @media (max-width: 767px) {
      .bar {
        padding: 6px 12px;
      }
      .txt {
        flex-basis: 100%;
        order: 3;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-demo-banner': SwDemoBanner;
  }
}
