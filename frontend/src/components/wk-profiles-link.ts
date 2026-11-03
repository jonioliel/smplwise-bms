import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import { isApi } from '../api/session';
import { getProfilesAccess } from '../api/access-profiles';
import { pft } from '../i18n/wiskey-profiles';

/** One answer per page load for every link on the page (the people screen and the Settings view may both show one). */
let ACCESS: Promise<boolean> | null = null;
function canEdit(): Promise<boolean> {
  ACCESS ??= getProfilesAccess().then(
    (a) => a.can_edit === true,
    () => {
      ACCESS = null; // an error is not an answer: ask again next time
      return false;
    },
  );
  return ACCESS;
}

/** Tests only: forget the cached answer. */
export function resetProfilesLinkAccess(): void {
  ACCESS = null;
}

/**
 * WISKEY-PROFILES-EDIT-2390: the entry to "קבוצות ושדות" (`#/wiskey/profiles`) from the people screen's actions and the Settings view of
 * the groups. Renders NOTHING until the server says this user may edit the policy (people management at installation scope) - so for
 * everyone else, and whenever the answer is missing, the screen around it is exactly what it was. A link, never an action.
 */
@customElement('wk-profiles-link')
export class WkProfilesLink extends LitElement {
  @property() variant: 'secondary' | 'ghost' = 'secondary';
  @state() private shown = false;

  connectedCallback(): void {
    super.connectedCallback();
    if (isApi()) void canEdit().then((ok) => (this.shown = ok));
  }

  render() {
    if (!this.shown) return nothing;
    return html`<sw-button variant=${this.variant} icon="users" data-pf-entry title=${pft('entryHint')} @click=${() => (window.location.hash = '#/wiskey/profiles')}>${pft('entry')}</sw-button>`;
  }

  static styles = css`
    :host { display: contents; }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-profiles-link': WkProfilesLink;
  }
}
