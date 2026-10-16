import { html, type TemplateResult } from 'lit';
import { listIcon, type ListIconName } from './list-icons';
import { lt, type ListTextKey } from './list-text';

/**
 * TKUI4 (release 2.6.0): the view switch of the list - cards, table and, for a department manager, the manager board (mock-up v5). The
 * modes are a REGISTRY: a mode is one entry here and one renderer in the host (the weekly calendar of task TKCAL is the fourth); nothing
 * else in the page frame changes. The switch keeps the `data-view-switch` / `data-view` hooks of the table slice (tests, automation).
 */
export type ListMode = 'cards' | 'table' | 'board' | 'calendar';

export interface ListModeDef {
  id: ListMode;
  icon: ListIconName;
  label: ListTextKey;
  /** offered only to a holder of tickets.manage (the board is the managers' screen) */
  managerOnly: boolean;
}

export const LIST_MODES: readonly ListModeDef[] = [
  { id: 'cards', icon: 'cardsView', label: 'lsView_cards', managerOnly: false },
  { id: 'table', icon: 'tableView', label: 'lsView_table', managerOnly: false },
  { id: 'board', icon: 'boardView', label: 'lsView_board', managerOnly: true },
  // TKCAL: the weekly calendar of visits and targets (tickets/calendar-view.ts)
  { id: 'calendar', icon: 'calendar', label: 'lsView_calendar', managerOnly: false },
];

export function visibleModes(canManage: boolean): readonly ListModeDef[] {
  return LIST_MODES.filter((m) => !m.managerOnly || canManage);
}

/** The icon segment: the active mode also shows its name on a wide screen (the label hides on a phone, by CSS). */
export function listViewSwitch(current: ListMode, canManage: boolean, pick: (m: ListMode) => void): TemplateResult {
  return html`<div class="seg sm vsw" role="radiogroup" aria-label=${lt('lsViewsGroup')} data-view-switch>
    ${visibleModes(canManage).map((m) => html`<button type="button" role="radio" aria-checked=${String(current === m.id)} aria-label=${lt(m.label)} title=${lt(m.label)} data-view=${m.id}
      @click=${() => pick(m.id)}>${listIcon(m.icon)}${current === m.id ? html`<span class="lbl">${lt(m.label)}</span>` : ''}</button>`)}
  </div>`;
}
