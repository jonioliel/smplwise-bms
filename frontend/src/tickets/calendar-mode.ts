/**
 * TKCAL: whether the list is in its calendar mode. The mode is a per-tab choice kept in the session (the cards / table choice is the
 * server preference `tickets.board.view`, which has no calendar value and is not changed by this task: no backend change).
 */
const KEY = 'sw.tickets.list.calendar';

export function calendarWanted(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setCalendarWanted(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(KEY, '1');
    else sessionStorage.removeItem(KEY);
  } catch {
    /* private mode: the mode lasts until the page reloads */
  }
}
