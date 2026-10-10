/** NN5-F1B: the pure logic of the review screen (selection, keys, optimistic reviewed state, grouping of the list state). */
import type { ReviewItem, ReviewList } from '../api/frigate';

export type ReviewKeyAction = 'next' | 'prev' | 'first' | 'last' | 'toggle-select' | 'toggle-reviewed' | 'open' | 'select-all' | 'escape' | null;

/** The keys of the screen. Typing in a field is never a shortcut (the caller passes the event's target tag). */
export function keyAction(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; target?: { tagName?: string; isContentEditable?: boolean } | null; path?: readonly string[] }): ReviewKeyAction {
  const tag = e.target?.tagName?.toLowerCase() ?? '';
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return null;
  // a key typed into a dropdown (its typeahead) or any field inside a shadow root is the control's, not a shortcut
  const path = e.path ?? [];
  if (path.some((t) => t === 'sw-dropdown' || t === 'input' || t === 'textarea' || t === 'select')) return null;
  // Space and Enter on a focused button or link activate it natively
  if ((e.key === ' ' || e.key === 'Enter') && (tag === 'button' || tag === 'a' || path[0] === 'button' || path[0] === 'a' || tag === 'sw-button')) return null;
  if (e.altKey) return null;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if ((e.ctrlKey || e.metaKey) && k === 'a') return 'select-all';
  if (e.ctrlKey || e.metaKey) return null;
  switch (k) {
    case 'ArrowRight': // RTL: the next card sits to the left, the grid follows reading order: the keys are plain next / previous
    case 'ArrowDown':
    case 'j':
      return 'next';
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'k':
      return 'prev';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case ' ':
    case 'x':
      return 'toggle-select';
    case 'r':
      return 'toggle-reviewed';
    case 'Enter':
      return 'open';
    case 'Escape':
      return 'escape';
    default:
      return null;
  }
}

/** The index after a move, clamped (no wrap: the end of the list is the end). -1 = nothing focused yet. */
export function moveFocus(current: number, delta: 1 | -1, length: number): number {
  if (length <= 0) return -1;
  if (current < 0) return delta === 1 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, current + delta));
}

/** The index a move lands on: Home / End jump, the arrows step (the same clamp as `moveFocus`). */
export function focusAfter(current: number, act: 'next' | 'prev' | 'first' | 'last', length: number): number {
  if (length <= 0) return -1;
  if (act === 'first') return 0;
  if (act === 'last') return length - 1;
  return moveFocus(current, act === 'next' ? 1 : -1, length);
}

/** The filters differ from the screen's defaults (the empty state then offers to clear them). */
export function filtersActive(f: { layer: string; camera: string; period: string; status: string; object: string }, def: { layer: string; camera: string; period: string; status: string; object: string }): boolean {
  return f.camera !== def.camera || f.period !== def.period || f.status !== def.status || f.object !== def.object;
}

export function toggleId(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** The ids a "reviewed" action applies to: the selection when there is one, else the focused card. */
export function targetIds(selected: ReadonlySet<string>, focusedId: string | null): string[] {
  if (selected.size) return [...selected];
  return focusedId ? [focusedId] : [];
}

/** Toggle direction for a set of items: when every one is reviewed the action un-marks, otherwise it marks. */
export function nextReviewedValue(items: readonly ReviewItem[], ids: readonly string[]): boolean {
  const picked = items.filter((i) => ids.includes(i.id));
  return !(picked.length > 0 && picked.every((i) => i.reviewed));
}

/** Apply a reviewed change to the loaded list at once (optimistic) and keep the unreviewed counters honest. */
export function applyReviewed(list: ReviewList, ids: readonly string[], reviewed: boolean): ReviewList {
  const set = new Set(ids);
  const delta: Partial<Record<ReviewItem['layer'], number>> = {};
  const items = list.items.map((i) => {
    if (!set.has(i.id) || i.reviewed === reviewed) return i;
    delta[i.layer] = (delta[i.layer] ?? 0) + (reviewed ? -1 : 1);
    return { ...i, reviewed };
  });
  const unreviewed = { ...list.unreviewed };
  for (const [layer, d] of Object.entries(delta)) unreviewed[layer as ReviewItem['layer']] = Math.max(0, unreviewed[layer as ReviewItem['layer']] + (d as number));
  return { ...list, items, unreviewed };
}

/** What the list area shows (the order of the checks is the screen's contract). */
export type ReviewView = 'loading' | 'forbidden' | 'error' | 'offline-empty' | 'empty' | 'all-reviewed' | 'ready';

export function viewOf(s: { loading: boolean; forbidden: boolean; error: string; list: ReviewList | null; statusUnreviewed: boolean }): ReviewView {
  if (s.forbidden) return 'forbidden';
  if (!s.list) return s.error ? 'error' : 'loading';
  if (s.list.items.length) return 'ready';
  if (s.list.stale) return 'offline-empty';
  if (s.statusUnreviewed && Object.values(s.list.counts).some((n) => n > 0)) return 'all-reviewed';
  return 'empty';
}

/** Merge a next page into the list (ids already shown are kept once). */
export function appendPage(list: ReviewList, page: ReviewList): ReviewList {
  const seen = new Set(list.items.map((i) => i.id));
  return { ...page, items: [...list.items, ...page.items.filter((i) => !seen.has(i.id))] };
}
