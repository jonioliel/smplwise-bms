import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { bidi } from '../i18n/bidi';
import { sct } from '../i18n/scenarios';
import { filterChoices, toggledId, type Recipients, type ScenarioChoices } from '../api/scenarios';

/**
 * XSCENARIO109-295 `<scenario-recipients .choices .value>`: who a scenario notification goes to - roles and named users picked by NAME from the
 * server's list (GET /scenarios/choices), never typed ids. The chosen ones show as removable chips; a search narrows the drop-down. Emits
 * `change` {value}. An id the list no longer knows (a removed user) stays as a chip with its id, so it can be removed.
 */
@customElement('scenario-recipients')
export class ScenarioRecipients extends LitElement {
  @property({ attribute: false }) choices: ScenarioChoices | null = null;
  @property({ attribute: false }) value: Recipients = { users: [], roles: [] };
  @state() private open = false;
  @state() private q = '';

  static styles = css`
    :host { display: inline-block; position: relative; min-inline-size: 220px; max-inline-size: 100%; }
    .box { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 3px 6px; border: 1px solid var(--dv-border, #ccd); border-radius: var(--dv-radius-control, 10px); background: var(--dv-surface, #fff); min-block-size: 30px; }
    .chip { display: inline-flex; gap: 4px; align-items: center; padding: 1px 8px; border-radius: 999px; background: var(--dv-accent-soft, #dbe7ff); color: var(--dv-accent-text, #1d3f8a); font-size: var(--sw-fs-sm); }
    .chip button, .add { border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; padding: 0 2px; }
    .add { color: var(--dv-text-2, #556); font-size: var(--sw-fs-base); }
    .hint { color: var(--dv-text-3, #889); font-size: var(--sw-fs-sm); }
    .pop { position: absolute; inset-inline-start: 0; inset-block-start: calc(100% + 4px); z-index: 5; inline-size: max(260px, 100%); max-block-size: 260px; overflow: auto;
      background: var(--sw-menu-surface); color: var(--dv-text, #123); border: 1px solid var(--sw-menu-border); border-radius: var(--sw-r-md); box-shadow: 0 8px 24px rgb(0 0 0 / 18%); padding: 6px; }
    .pop input[type='search'] { inline-size: 100%; box-sizing: border-box; font: inherit; padding: 4px 8px; border: 1px solid var(--dv-border, #ccd); border-radius: var(--sw-r-sm); background: transparent; color: inherit; }
    .sect { font-size: var(--sw-fs-xs); color: var(--dv-text-3, #889); margin: 6px 4px 2px; }
    label { display: flex; gap: 6px; align-items: center; padding: 3px 4px; border-radius: var(--sw-r-xs); cursor: pointer; font-size: var(--sw-fs-base); }
    label:hover { background: var(--dv-surface-2, #f3f5fa); }
  `;

  private emit(value: Recipients) {
    this.value = value;
    this.dispatchEvent(new CustomEvent<{ value: Recipients }>('change', { detail: { value }, bubbles: true, composed: true }));
  }

  private nameOf(kind: 'users' | 'roles', id: string): string {
    return this.choices?.[kind].find((x) => x.id === id)?.name ?? id;
  }

  render() {
    const v = { users: this.value.users ?? [], roles: this.value.roles ?? [] };
    const chips = [...v.roles.map((id) => ['roles', id] as const), ...v.users.map((id) => ['users', id] as const)];
    return html`<div class="box" data-recipients>
      ${chips.length ? chips.map(([k, id]) => html`<span class="chip" data-chip=${`${k}:${id}`}>${bidi(this.nameOf(k, id))}<button type="button" aria-label=${sct('remove')} @click=${() => this.emit({ ...v, [k]: v[k].filter((x) => x !== id) })}>×</button></span>`)
        : html`<span class="hint">${sct('recipientsDefault')}</span>`}
      <button type="button" class="add" data-recipients-open aria-expanded=${String(this.open)} @click=${() => (this.open = !this.open)}>+ ${sct('recipientsPick')}</button>
    </div>
    ${this.open && this.choices ? html`<div class="pop" role="dialog" aria-label=${sct('recipientsPick')} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this.open = false; }}>
      <input type="search" placeholder=${sct('search')} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} />
      <div class="sect">${sct('recipientsRoles')}</div>
      ${filterChoices(this.choices.roles, this.q).map((r) => html`<label><input type="checkbox" data-pick-role=${r.id} .checked=${v.roles.includes(r.id)} @change=${(e: Event) => this.emit({ ...v, roles: toggledId(v.roles, r.id, (e.target as HTMLInputElement).checked) })} />${bidi(r.name)}</label>`)}
      <div class="sect">${sct('recipientsUsers')}</div>
      ${filterChoices(this.choices.users, this.q).map((u) => html`<label><input type="checkbox" data-pick-user=${u.id} .checked=${v.users.includes(u.id)} @change=${(e: Event) => this.emit({ ...v, users: toggledId(v.users, u.id, (e.target as HTMLInputElement).checked) })} />${bidi(u.name)}</label>`)}
    </div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scenario-recipients': ScenarioRecipients;
  }
}
