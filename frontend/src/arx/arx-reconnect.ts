import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-state-panel';
import { tr } from '../i18n/msg/misc';

/**
 * CLIENT-RESILIENCE-2540 (review FC-03): the remote start-up while a stored sign-in cannot be checked - the installed app opened
 * without a connection (a garage, a lift), or the sign-in service / the server said "try again" (a restart). The sign-in is valid for
 * its whole period, so instead of the username / password form the page shows the shell's own offline state ("no connection, trying
 * again", sw-state-panel `stale`, as the shell's renderRetry does for /me) and boot.ts tries again on a timer, when the browser is back
 * online and on "try now" (the `arx-reconnect-now` event). The page is the sign-in page's backdrop, nothing more.
 */
@customElement('arx-reconnect')
export class ArxReconnect extends LitElement {
  /** A try is running (boot.ts): the button says so and a second press waits for it. */
  @property({ type: Boolean }) busy = false;

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: var(--sw-s-4);
      /* an installed app: clear of the notch, the status bar and the home indicator (a browser without env() keeps the line above) */
      padding: max(var(--sw-s-4), env(safe-area-inset-top)) max(var(--sw-s-4), env(safe-area-inset-right))
        max(var(--sw-s-4), env(safe-area-inset-bottom)) max(var(--sw-s-4), env(safe-area-inset-left));
      box-sizing: border-box;
      font-family: var(--sw-font);
      color: var(--sw-text);
      background: var(--sw-bg);
    }
  `;

  render() {
    return html`<sw-state-panel state="stale" role="status" data-arx-reconnect heading=${tr('אין חיבור לשרת')}
      hint=${tr('הכניסה שלך נשמרה. מנסה להתחבר שוב…')} actionLabel=${this.busy ? tr('מנסה להתחבר…') : tr('נסה עכשיו')}
      @action=${() => this.dispatchEvent(new CustomEvent('arx-reconnect-now'))}></sw-state-panel>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'arx-reconnect': ArxReconnect;
  }
}
