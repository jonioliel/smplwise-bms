import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import type { TreeNode } from '../api/tickets-board';
import { nestTree, placeLabel, type TreeBranch } from './board-model';
import { bt } from './board-text';
import { tIcon } from './icons';

/**
 * CR-038 slice 6, D19: the board's side tree of places (mock-up v2: the electricity meters tree - "כל הקומות N" first, then the
 * floors with a per-floor collapse and their rooms, each with its open count from the server). Picking a node filters the board; the
 * picked node is pressed. Events (bubble, composed): `place-pick` {key} ('' = all). The tree decides nothing: the counts come from
 * GET /tickets/board, which counts only what the caller may see.
 */
@customElement('ticket-board-tree')
export class TicketBoardTree extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) nodes: TreeNode[] = [];
  @property() selected = '';
  @property({ type: Number }) total = 0;
  @state() private closed = new Set<string>();

  static styles = [bubbleChrome, ...automationsStyles, css`
    :host { display: block; }
    .tree {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px;
      border-radius: var(--sw-r-2xl);
      box-sizing: border-box;
    }
    .row {
      all: unset;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr) auto;
      align-items: center;
      gap: 6px;
      min-block-size: 40px;
      padding-inline: 8px 12px;
      border-radius: var(--sw-r-lg);
      cursor: pointer;
      color: var(--dv-text);
      font-size: var(--sw-fs-base);
    }
    .row:hover { background: var(--dv-hover, color-mix(in srgb, var(--dv-text) 6%, transparent)); }
    .row[aria-pressed='true'] { background: var(--dv-accent-soft); color: var(--dv-accent-text); font-weight: 700; }
    .row:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: 1px; }
    .row.l0 b { font-weight: 700; }
    .row.l1 { padding-inline-start: 28px; color: var(--dv-text-2); }
    .row.l2 { padding-inline-start: 48px; color: var(--dv-text-2); }
    .row .n { font-variant-numeric: tabular-nums; color: var(--dv-accent-text); font-size: var(--sw-fs-sm); font-weight: 600; }
    .row .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tw {
      all: unset;
      display: inline-grid;
      place-items: center;
      inline-size: 24px;
      block-size: 24px;
      border-radius: var(--sw-r-sm);
      color: var(--dv-text-3);
      cursor: pointer;
    }
    .tw:focus-visible { outline: 2px solid var(--dv-focus); }
    .tw .ic { font-size: var(--sw-fs-lg); transition: transform var(--mm-motion, 160ms) ease; }
    .tw[aria-expanded='false'] .ic { transform: rotate(90deg); }
    :host-context([dir='ltr']) .tw[aria-expanded='false'] .ic { transform: rotate(-90deg); }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  private pick(key: string) {
    this.dispatchEvent(new CustomEvent('place-pick', { detail: { key }, bubbles: true, composed: true }));
  }

  private toggle(key: string) {
    const s = new Set(this.closed);
    if (s.has(key)) s.delete(key);
    else s.add(key);
    this.closed = s;
  }

  private branch(b: TreeBranch, level: number): TemplateResult {
    const n = b.node;
    const open = !this.closed.has(n.key);
    const kids = b.children.length > 0;
    const label = placeLabel(n);
    return html`<div role="treeitem" aria-level=${level + 1} aria-expanded=${kids ? String(open) : nothing as unknown as string} aria-selected=${String(this.selected === n.key)}>
      <div class=${`row l${Math.min(level, 2)}`} role="button" tabindex="0" aria-pressed=${String(this.selected === n.key)} data-place=${n.key}
        @click=${() => this.pick(n.key)} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pick(n.key); } }}>
        ${kids ? html`<button type="button" class="tw" aria-expanded=${String(open)} aria-label=${bt(open ? 'collapse' : 'expand', { name: label })} data-twist=${n.key}
          @click=${(e: Event) => { e.stopPropagation(); this.toggle(n.key); }}>${tIcon('chevronDown')}</button>` : html`<span></span>`}
        <span class="nm">${level === 0 ? html`<b>${bidi(label)}</b>` : bidi(label)}</span>
        <span class="n">${n.count}</span>
      </div>
      ${kids && open ? html`<div role="group">${b.children.map((c) => this.branch(c, level + 1))}</div>` : nothing}
    </div>`;
  }

  render() {
    const roots = nestTree(this.nodes);
    return html`<nav class="tree glass" aria-label=${bt('floors')} data-board-tree>
      <div role="tree" aria-label=${bt('floors')}>
        <div class="row l0" role="button" tabindex="0" aria-pressed=${String(!this.selected)} data-place=""
          @click=${() => this.pick('')} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pick(''); } }}>
          <span></span><span class="nm"><b>${bt('allFloors')}</b></span><span class="n">${this.total}</span>
        </div>
        ${roots.map((b) => this.branch(b, 0))}
      </div>
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-board-tree': TicketBoardTree;
  }
}
