import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-state-panel';
import '../components/wk-triage-panel';
import { canAnywhere, isApi } from '../api/session';
import type { RouteState } from '../router';
import { replaceRoute } from '../router';
import { tt } from '../i18n/wiskey-triage';
import { mayOpenTriage } from '../api/wiskey-triage';

/**
 * "התנגשויות והתראות עמדות" (WISKEY-CONFLICTS-2400): #/wiskey/conflicts and #/wiskey/alerts - one Arx screen with two tabs (the address
 * follows the tab without a history entry). Native: never the embedded panel. The content is <wk-triage-panel mode="full">.
 */
@customElement('wiskey-triage')
export class WiskeyTriage extends LitElement {
  @property({ attribute: false }) route: RouteState | null = null;

  static styles = css`
    :host {
      display: block;
    }
  `;

  private get tab(): 'conflicts' | 'alerts' {
    return this.route?.segments[1] === 'alerts' ? 'alerts' : 'conflicts';
  }

  render() {
    if (isApi() && !mayOpenTriage(canAnywhere)) {
      return html`<sw-page heading=${tt.title}><sw-state-panel state="forbidden" heading=${tt.title} hint=${tt.readOnly} data-wkt-forbidden></sw-state-panel></sw-page>`;
    }
    return html`<sw-page heading=${tt.title} subheading=${tt.subtitle} wide>
      <wk-triage-panel mode="full" .tab=${this.tab} @wkt-tab=${(e: CustomEvent<{ tab: string }>) => replaceRoute(`/wiskey/${e.detail.tab}`)}></wk-triage-panel>
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-triage': WiskeyTriage;
  }
}
