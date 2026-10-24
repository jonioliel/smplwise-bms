import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { nt } from '../i18n/notices';

import { PLACE_ALL, type PlaceNode, visibleNodes } from './places-model';

export * from './places-model';

export const placesCss = css`
  .with-tree { display: grid; grid-template-columns: 232px minmax(0, 1fr); gap: 14px; align-items: start; }
  .with-tree > .main { min-inline-size: 0; }
  .tree-m { display: none; }
  @media (max-width: 767px) {
    .with-tree { grid-template-columns: minmax(0, 1fr); }
    .with-tree > notice-places { display: none; }
    .tree-m { display: block; padding: 10px 10px 0; }
    .tree-m select { inline-size: 100%; font: inherit; color: var(--sw-text); background: var(--sw-surface-solid); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-md); padding: 8px 10px; min-block-size: 44px; }
  }
`;

/** The phone's select over the same nodes (the page draws it inside the list panel). */
export function placesSelect(nodes: readonly PlaceNode[], value: string, onPick: (id: string) => void) {
  return html`<div class="tree-m"><select aria-label=${nt('placeSelect')} data-place-select @change=${(e: Event) => onPick((e.target as HTMLSelectElement).value)}>
    ${nodes.map((p) => html`<option value=${p.id} ?selected=${p.id === value}>${p.depth ? '- '.repeat(p.depth) : ''}${p.name} (${p.count})</option>`)}</select></div>`;
}

@customElement('notice-places')
export class NoticePlaces extends LitElement {
  static styles = css`
    :host { display: block; }
    .box { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-xl); overflow: hidden; }
    nav { display: flex; flex-direction: column; gap: 2px; padding: var(--sw-s-2, 8px); }
    .ttl { padding: var(--sw-s-2, 8px) var(--sw-s-3, 12px) var(--sw-s-1, 4px); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); }
    .line { display: flex; align-items: stretch; gap: 2px; }
    button { font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text); display: flex; align-items: center; gap: var(--sw-s-2, 8px); min-block-size: 36px; padding-inline: var(--sw-s-3, 12px);
      border: 0; border-radius: var(--sw-r-sm, 6px); background: transparent; cursor: pointer; text-align: start; }
    button:hover { background: var(--sw-hover-wash, var(--sw-surface-2)); }
    button:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: -2px; }
    button.pick { flex: 1; min-inline-size: 0; }
    button.pick .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    button.fold { justify-content: center; min-inline-size: 36px; padding-inline: 0; color: var(--sw-text-3); }
    button.fold sw-icon { transition: transform var(--sw-t-fast, 120ms) var(--sw-ease, ease); }
    button.fold[aria-expanded='false'] sw-icon { transform: rotate(var(--fold-rot, 90deg)); }
    :host-context([dir='ltr']) { --fold-rot: -90deg; }
    .grp .name { font-weight: var(--sw-fw-semibold); }
    .d1 { padding-inline-start: var(--sw-s-4, 16px); }
    .d2 { padding-inline-start: calc(var(--sw-s-4, 16px) * 2); }
    button[aria-current='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    .n { font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-variant-numeric: tabular-nums; }
    .dot { flex: none; inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--c, var(--sw-unknown)); }
    [data-look='warn'] { --c: var(--sw-warning); }
    [data-look='alarm'] { --c: var(--sw-danger); }
    [data-look='acc'], [data-look='ok'] { --c: var(--sw-accent); }
  `;

  @property({ attribute: false }) nodes: PlaceNode[] = [];
  @property() value = PLACE_ALL;
  @state() private folded = new Set<string>();

  private toggle(id: string): void {
    const next = new Set(this.folded);
    if (!next.delete(id)) next.add(id);
    this.folded = next;
  }

  private pick(id: string): void {
    this.dispatchEvent(new CustomEvent<string>('place-change', { detail: id, bubbles: true, composed: true }));
  }

  render() {
    return html`<div class="box"><nav aria-label=${nt('places')} data-places>
      <div class="ttl">${nt('places')}</div>
      ${visibleNodes(this.nodes, this.folded).map((p) => html`<div class="line ${p.foldable ? 'grp' : ''}" data-place-line=${p.id}>
        ${p.foldable ? html`<button type="button" class="fold" aria-expanded=${String(!this.folded.has(p.id))} aria-label=${nt(this.folded.has(p.id) ? 'unfoldPlace' : 'foldPlace', { name: p.name })}
          data-place-fold=${p.id} @click=${() => this.toggle(p.id)}><sw-icon name="chevronDown" size="14"></sw-icon></button>` : nothing}
        <button type="button" class="pick d${p.depth}" aria-current=${String(this.value === p.id)} data-place=${p.id} @click=${() => this.pick(p.id)}>
          ${p.kind === 'all' ? html`<sw-icon name="building" size="14"></sw-icon>` : p.look ? html`<span class="dot" data-look=${p.look} aria-hidden="true"></span>` : nothing}
          <span class="name">${p.name}</span><span class="n">${p.count}</span></button></div>`)}
    </nav></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-places': NoticePlaces;
  }
}
