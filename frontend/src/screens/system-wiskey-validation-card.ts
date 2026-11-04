import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-card';
import { canAnywhere, isApi } from '../api/session';
import { VALIDATION_HREF } from '../api/wiskey-validation';
import { emitFoldSummary } from '../access-control/settings-cards-logic';
import { sct } from '../i18n/settings-cards';

/**
 * הגדרות › מתגי מסכי כניסה › "בדיקת קבלה לעמדות" (WISKEY-LIVE-VALIDATION-2390): the entry to the acceptance tool, next to the WisKey
 * status. One short card with one link; the tool itself is its own route (#/system/wiskey-validation, system-wiskey-validation.ts).
 * Shown to whoever may run the checks (access.stations.manage somewhere); not in the demo (no backend to run against).
 */
@customElement('system-wiskey-validation-card')
export class SystemWiskeyValidationCard extends LitElement {
  /** SETTINGS-INTERCOM-CARDS-2401: drawn inside a card of layout a - no heading of its own; the summary line is reported instead. */
  @property({ type: Boolean, reflect: true }) bare = false;

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
    .about {
      margin: 0 0 8px;
    }
    /* SETTINGS-INTERCOM-CARDS-2401: inside a card the link is a 44 px target */
    :host([bare]) a {
      display: inline-flex;
      align-items: center;
      min-block-size: 44px;
    }
  `;

  private present(): boolean {
    return isApi() && canAnywhere('access.stations.manage');
  }

  protected updated(): void {
    if (this.bare) emitFoldSummary(this, { card: 'validation', summary: sct().sum.validation, present: this.present() });
  }

  render() {
    if (!this.present()) return nothing; // not in the demo: no existing baseline changes
    const about = 'לכל עמדה: זהות, דלתות, תמונה דרך Arx ודרך WisKey, דיבור, אירועים ושעון. רץ רק כשלוחצים, ונשמר לכל ריצה.';
    return html`<sw-card heading=${this.bare ? '' : 'בדיקת קבלה לעמדות'} subheading=${this.bare ? '' : about}>
      ${this.bare ? html`<p class="muted about">${about}</p>` : nothing}
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
