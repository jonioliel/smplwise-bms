import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-field';
import { listRoles, type RoleInfo } from '../api/access';
import { sa } from '../i18n/search-access';
import { SEARCH_MODES, parseSearchRoles, searchModeOf, toggleSearchRole, type SearchMode } from '../api/search-access';

/**
 * TOPPILL-295 (owner 2026-10-24): who may use the search in the top-left pill. Off by default - a search is a way to reach places a
 * person was not sent to. The page that owns the settings passes the stored values and writes what this element reports
 * (`sw-search-access-change`, detail {mode, roles}); the server enforces it on GET /search, so hiding the button is not the guard.
 */
@customElement('sw-search-access')
export class SwSearchAccess extends LitElement {
  @property() mode: SearchMode = 'off';
  @property() roles = '';
  @property({ type: Boolean }) disabled = false;
  @state() private options: RoleInfo[] = [];
  private loaded = false;

  static styles = css`
    :host { display: grid; gap: var(--sw-s-2); }
    .roles { display: flex; flex-wrap: wrap; gap: var(--sw-s-2) var(--sw-s-4); }
    label.role { display: inline-flex; align-items: center; gap: var(--sw-s-2); font-size: var(--sw-fs-sm, 0.875rem); }
    .hint { color: var(--sw-text-muted); font-size: var(--sw-fs-sm, 0.875rem); }
  `;

  protected willUpdate(): void {
    if (this.mode === 'roles' && !this.disabled && !this.loaded) {
      this.loaded = true;
      void listRoles().then((r) => (this.options = r.roles.filter((x) => x.id !== 'system_admin'))).catch(() => (this.loaded = false));
    }
  }

  private emit(mode: SearchMode, roles: string[]) {
    this.dispatchEvent(new CustomEvent('sw-search-access-change', { detail: { mode, roles: roles.join(',') }, bubbles: true, composed: true }));
  }

  render() {
    const mode = searchModeOf(this.mode);
    const chosen = parseSearchRoles(this.roles);
    return html`
      <sw-field class="ctl"><select data-set-global-search ?disabled=${this.disabled} @change=${(e: Event) => this.emit((e.target as HTMLSelectElement).value as SearchMode, chosen)}>
        ${SEARCH_MODES.map((m) => html`<option value=${m} ?selected=${m === mode}>${sa(m)}</option>`)}
      </select></sw-field>
      ${mode === 'roles'
        ? html`<div class="roles" data-search-roles role="group" aria-label=${sa('rolesTitle')}>
            ${this.options.map((r) => html`<label class="role"><input type="checkbox" data-search-role=${r.id} .checked=${chosen.includes(r.id)} ?disabled=${this.disabled}
              @change=${(e: Event) => this.emit(mode, toggleSearchRole(chosen, r.id, (e.target as HTMLInputElement).checked))} />${r.name}</label>`)}
          </div>`
        : nothing}
    `;
  }
}
