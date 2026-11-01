/**
 * TREE-HIDE-UNASSIGNED-2331 (owner 01.11: "allow hiding the unassigned areas from the tree after I finish editing").
 *
 * The building tree's "ללא שיוך" row (devices without an area) follows home.screen.tree_unassigned: always (default, as before) /
 * only while the screen editor is open / never. This module draws the row's pieces for devices-building:
 *  - the row itself, with a "⋯" for a system.configure holder whose one item "הסתר מהעץ" sets the choice to `editing`;
 *  - the undo notice after hiding ("בטל" puts the previous choice back);
 *  - in the screen editor, the hint that says the row is hidden outside the editor and how to bring it back.
 * Presentation only: the bucket, its screen (#/devices/areas/unassigned) and the "כל המבנה" counts (which include it) never change.
 */
import { css, html, nothing } from 'lit';
import { hs } from '../i18n/home-screen';
import { ltrNum } from '../i18n/bidi';
import { treeUnassignedHint, type TreeUnassigned } from '../api/home-screen';

export const TREE_UNASSIGNED_HREF = '#/devices/areas/unassigned';

/** The undo notice: `hidden` after "הסתר מהעץ" (with the choice to put back), `failed` when the save was refused. */
export interface LooseNotice {
  kind: 'hidden' | 'failed';
  prev: TreeUnassigned;
}

export interface LooseRowOpts {
  name: string;
  count: number;
  /** A system.configure holder, outside the editor: the row carries its "⋯". */
  menu: boolean;
  menuOpen: boolean;
  onOpen: (e: MouseEvent) => void;
  onMenu: (open: boolean) => void;
  onHide: () => void;
}

/** The row at the foot of the tree. Without a menu it is exactly the row it always was. */
export function looseRow(o: LooseRowOpts) {
  const row = html`<a class="tree-row tree-loose" data-tree-unassigned href=${TREE_UNASSIGNED_HREF} @click=${o.onOpen}><sw-icon name="help" size=${15}></sw-icon><span class="nm">${o.name}</span><span class="lit">${ltrNum(o.count)}</span></a>`;
  if (!o.menu) return row;
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && o.menuOpen) {
      e.stopPropagation();
      o.onMenu(false);
    }
  };
  const out = (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (o.menuOpen && !(to && (e.currentTarget as HTMLElement).contains(to))) o.onMenu(false);
  };
  return html`<div class="tree-loose-line" data-tree-unassigned-line @keydown=${key} @focusout=${out}>
    ${row}
    <button type="button" class="tl-more" data-tree-unassigned-menu aria-haspopup="menu" aria-expanded=${String(o.menuOpen)} aria-label=${hs('tuMenu')} title=${hs('tuMenu')} @click=${() => o.onMenu(!o.menuOpen)}><sw-icon name="more" size=${16}></sw-icon></button>
    ${o.menuOpen
      ? html`<div class="tl-menu" role="menu" data-tree-unassigned-pop>
          <button type="button" role="menuitem" data-tree-unassigned-hide @click=${o.onHide}><sw-icon name="eyeOff" size=${15}></sw-icon>${hs('tuHide')}</button>
        </div>`
      : nothing}
  </div>`;
}

/** The screen editor's line under (or, for `never`, instead of) the row: hidden outside the editor, and the way back. */
export function looseHint(mode: TreeUnassigned, onShow: (() => void) | null) {
  const h = treeUnassignedHint(mode);
  if (!h) return nothing;
  return html`<div class="tl-hint" data-tree-unassigned-hint=${h} role="note">
    <sw-icon name="eyeOff" size=${13}></sw-icon>
    <span class="tl-hint-t">${hs(h === 'editing' ? 'tuHintEditing' : 'tuHintNever')}${onShow ? html` · <button type="button" class="tl-link" data-tree-unassigned-show @click=${onShow}>${hs('tuShowAlways')}</button>` : nothing}
      <span class="tl-where">${hs('tuHintWhere')}</span></span>
  </div>`;
}

/** The notice at the foot of the screen (polite live region), with "בטל" while it says the row was hidden. */
export function looseNotice(n: LooseNotice | null, onUndo: () => void, onClose: () => void) {
  if (!n) return nothing;
  return html`<div class="tl-toast" role="status" aria-live="polite" data-tree-unassigned-toast=${n.kind}>
    <span>${hs(n.kind === 'hidden' ? 'tuHidden' : 'tuFailed')}</span>
    ${n.kind === 'hidden' ? html`<button type="button" class="tl-undo" data-tree-unassigned-undo @click=${onUndo}>${hs('tuUndo')}</button>` : nothing}
    <button type="button" class="tl-x" aria-label=${hs('close')} @click=${onClose}><sw-icon name="close" size=${14}></sw-icon></button>
  </div>`;
}

export const TREE_UNASSIGNED_CSS = css`
  .tree-loose-line {
    position: relative;
    display: flex;
    align-items: center;
    margin-block-start: 6px;
    border-block-start: 1px solid var(--sw-border);
  }
  .tree-loose-line .tree-loose {
    flex: 1;
    min-inline-size: 0;
    margin-block-start: 0;
    border-block-start: 0;
  }
  .tl-more {
    position: relative;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--dv-tree-menu-w, 30px);
    block-size: 28px;
    padding: 0;
    border: 0;
    border-radius: var(--sw-r-sm);
    background: transparent;
    color: var(--sw-text-3);
    font: inherit;
    cursor: pointer;
  }
  .tl-more:hover,
  .tl-more[aria-expanded='true'] {
    background: var(--sw-hover-wash);
    color: var(--sw-text);
  }
  .tl-more:focus-visible,
  .tl-menu button:focus-visible,
  .tl-link:focus-visible,
  .tl-undo:focus-visible,
  .tl-x:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 1px;
  }
  @media (pointer: coarse) {
    .tl-more::before {
      content: '';
      position: absolute;
      inset-block: -8px;
      inset-inline: -7px; /* 30 + 14 = 44 px wide, 28 + 16 = 44 px tall */
    }
  }
  .tl-menu {
    position: absolute;
    inset-block-end: calc(100% + 4px);
    inset-inline-end: 0;
    z-index: var(--sw-z-drawer);
    min-inline-size: 160px;
    padding: 4px;
    border: 1px solid var(--sw-menu-border);
    border-radius: var(--sw-r-md);
    background: var(--sw-menu-surface);
    box-shadow: var(--sw-shadow-3);
  }
  .tl-menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    inline-size: 100%;
    min-block-size: 36px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--sw-r-sm);
    background: transparent;
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    text-align: start;
    cursor: pointer;
  }
  .tl-menu button:hover {
    background: var(--sw-hover-wash);
  }
  .tl-hint {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-block-start: 6px;
    padding: 6px 8px;
    border: 1px dashed var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
    line-height: 1.4;
  }
  .tl-hint > sw-icon {
    flex: none;
    margin-block-start: 2px;
    color: var(--sw-text-3);
  }
  .tl-hint-t {
    min-inline-size: 0;
  }
  .tl-where {
    display: block;
    color: var(--sw-text-3);
  }
  .tl-link,
  .tl-undo {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--sw-accent-text);
    font: inherit;
    font-weight: var(--sw-fw-semibold);
    cursor: pointer;
  }
  .tl-toast {
    position: fixed;
    inset-block-end: calc(24px + env(safe-area-inset-bottom, 0px));
    inset-inline-start: 50%;
    transform: translateX(50%);
    z-index: var(--sw-z-toast);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px 8px 16px;
    border-radius: var(--sw-r-md);
    background: var(--sw-toast-bg);
    color: var(--sw-toast-text);
    font-size: var(--sw-fs-sm);
    box-shadow: var(--sw-shadow-3);
    max-inline-size: calc(100vw - 32px);
    box-sizing: border-box;
  }
  .tl-toast:dir(ltr) {
    transform: translateX(-50%);
  }
  .tl-toast .tl-undo {
    color: inherit;
    text-decoration: underline;
    min-block-size: 32px;
  }
  .tl-x {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 32px;
    block-size: 32px;
    padding: 0;
    border: 0;
    border-radius: var(--sw-r-sm);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
`;
