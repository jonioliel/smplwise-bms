import { LitElement, html, css, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-card';
import { canAnywhere, isApi } from '../api/session';
import { VALIDATION_HREF } from '../api/wiskey-validation';

/**
 * הגדרות › מתגי מסכי כניסה › "בדיקת קבלה לעמדות" (WISKEY-LIVE-VALIDATION-2390): the entry to the acceptance tool, next to the WisKey
 * status. One short card with one link; the tool itself is its own route (#/system/wiskey-validation, system-wiskey-validation.ts).
 * Shown to whoever may run the checks (access.stations.manage somewhere) and in the demo.
 */
@customElement('system-wiskey-validation-card')
export class SystemWiskeyValidationCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 16px;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    a {
      color: var(--sw-accent);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  `;

  render() {
    if (isApi() && !canAnywhere('access.stations.manage')) return nothing;
    return html`<sw-card heading="בדיקת קבלה לעמדות" subheading="לכל עמדה: זהות, דלתות, תמונה דרך Arx ודרך WisKey, דיבור, אירועים ושעון. רץ רק כשלוחצים, ונשמר לכל ריצה.">
      <div class="row" data-lv-card>
        <span class="muted">פתיחת דלת עם עד היא פעולה נפרדת, למנהל מערכת בלבד.</span>
        <a href=${VALIDATION_HREF} data-lv-card-link>פתח את בדיקת הקבלה</a>
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-wiskey-validation-card': SystemWiskeyValidationCard;
  }
}
