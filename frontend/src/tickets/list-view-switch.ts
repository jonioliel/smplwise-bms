import { html, type TemplateResult } from 'lit';
// the hosts (screens/tickets-list.ts, tickets-board.ts) register sw-segmented: this module stays importable by the node unit tests
import type { SegmentedChange } from '../components/sw-segmented';
import { listIcon, type ListIconName } from './list-icons';
import { lt, type ListTextKey } from './list-text';

/**
 * TKUI4 (release 2.6.0): the view switch of the list - cards, table and, for a department manager, the manager board (mock-up v5). The
 * modes are a REGISTRY: a mode is one entry here and one renderer in the host (the weekly calendar of task TKCAL is the fourth); nothing
 * else in the page frame changes. The switch keeps the `data-view-switch` / `data-view` hooks of the table slice (tests, automation).
 */
export type ListMode = 'cards' | 'table' | 'board' | 'calendar';

interface ListModeDef {
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

/** The icon segment: the active mode also shows its name on a wide screen (the label hides on a phone, by CSS: `.vsw::part(label)`).
 * CR-CMP2-SEGMENTED-C-2450: the shared sw-segmented (`labels="chosen"`); every key keeps its name as its tooltip, an icon-only key
 * is named by it, and `data-view-switch` / `data-view` stay on the group / the keys. */
export function listViewSwitch(current: ListMode, canManage: boolean, pick: (m: ListMode) => void): TemplateResult {
  return html`<sw-segmented class="vsw" radio size="sm" labels="chosen" label=${lt('lsViewsGroup')} data-view-switch value=${current}
    @change=${(e: CustomEvent<SegmentedChange>) => pick(e.detail.value as ListMode)}
    .options=${visibleModes(canManage).map((m) => ({ value: m.id, label: lt(m.label), title: lt(m.label), icon: listIcon(m.icon), attrs: { 'data-view': m.id } }))}></sw-segmented>`;
}
