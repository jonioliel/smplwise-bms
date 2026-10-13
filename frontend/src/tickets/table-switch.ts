import { html, type TemplateResult } from 'lit';
import type { BoardView } from '../api/tickets-table';
import { tbt, type TableTextKey } from './table-text';
import { tbIcon } from './table-icons';

/** The views a board offers today: the cards (slice 1) and the table (slice 6b); the kanban joins when it is built (D24). */
export const BOARD_VIEWS: readonly BoardView[] = ['cards', 'table'];

/**
 * CR-038 slice 6b (D24): the view switch of the tickets board header - an icon `.seg.sm` (the schedules / mock-up v2 pattern) the host
 * renders next to its title; the choice is the user's `tickets.board.view` preference (the host stores it with saveBoardPrefs).
 */
export function boardViewSwitch(view: BoardView, pick: (v: BoardView) => void): TemplateResult {
  return html`<div class="seg sm vsw" role="radiogroup" aria-label=${tbt('viewsGroup')} data-view-switch>
    ${BOARD_VIEWS.map((v) => html`<button type="button" role="radio" aria-checked=${String(view === v)} aria-label=${tbt(`view_${v}` as TableTextKey)} title=${tbt(`view_${v}` as TableTextKey)} data-view=${v}
      @click=${() => pick(v)}>${tbIcon(v === 'cards' ? 'cards' : v === 'table' ? 'table' : 'kanban')}</button>`)}
  </div>`;
}
