/**
 * AREAEDIT-2290 (owner-approved mockup 2026-10-29, steps 1-2: hide + order): the pure logic of editing the area pop-up - which layout
 * applies to an area (its own, else the site's, else today's fixed one), how a layout filters and orders the sections and the items
 * a person may already see, the hidden-but-alarming sensor, and the draft the editor changes. No Lit and no DOM (the unit spec imports
 * it under Playwright's transpiler). A layout can only REDUCE or REORDER: nothing here adds a device or a section.
 */
import type { DeviceRow } from '../api/devices';
import { EMPTY_LAYOUT, POPUP_ITEM_SECTIONS, POPUP_SECTIONS, type PopupLayout, type PopupState } from '../api/popup-layout';

const SECTION_ORDER: readonly string[] = POPUP_SECTIONS;

/** The layout that applies to an area: its own override replaces the site default (no merging); neither = today's fixed pop-up. */
export function layoutFor(state: PopupState, areaId: string | null | undefined): PopupLayout {
  return (areaId ? state.areas[areaId] : undefined) ?? state.site ?? EMPTY_LAYOUT;
}

/** Items in the saved order: listed ids first, in that order; items the layout does not know (new devices) keep their place after them. */
export function orderBy<T>(list: readonly T[], key: (t: T) => string, order: readonly string[]): T[] {
  if (!order.length) return [...list];
  const rank = new Map(order.map((id, i) => [id, i] as const));
  const known = list.filter((t) => rank.has(key(t))).sort((a, b) => rank.get(key(a))! - rank.get(key(b))!);
  return [...known, ...list.filter((t) => !rank.has(key(t)))];
}

/** A sensor that is in alarm: a binary sensor of a safety / opening class that is on (an ordinary "on" - motion, a plain input - is not an alarm). */
export const ALARM_CLASSES: readonly string[] = ['smoke', 'gas', 'carbon_monoxide', 'moisture', 'tamper', 'problem', 'safety', 'heat', 'vibration', 'door', 'window', 'opening', 'garage_door'];
export function isAlarming(r: Pick<DeviceRow, 'domain' | 'device_class' | 'active' | 'available'>): boolean {
  return r.domain === 'binary_sensor' && r.available && r.active && !!r.device_class && ALARM_CLASSES.includes(r.device_class);
}

/** A sensor that looks technical (a raw input or an idle state): marked "technical" in the editor so it is easy to spot; hiding stays manual. */
export function isTechnical(r: Pick<DeviceRow, 'entity_id' | 'name'>): boolean {
  const id = (r.entity_id.split('.')[1] ?? r.entity_id).toLowerCase();
  const name = (r.name ?? '').trim().toLowerCase();
  const raw = /^(input|inp)[ _-]?\d+$/;
  return raw.test(name) || raw.test(id) || /(^|_)input_?\d+(_|$)/.test(id) || name === 'idle' || /(^|_)idle($|_)/.test(id);
}

export interface ShownItems<T> {
  rows: T[];
  /** Entity ids shown only because they are alarming while hidden (drawn red with a note). */
  revealed: Set<string>;
}

/** The items of one section as the layout shows them: ordered, the hidden ones dropped - except a hidden sensor that is alarming, while the
 * installation's alert choice is `show`. */
export function shownItems(rows: readonly DeviceRow[], section: string, layout: PopupLayout, showAlerting: boolean): ShownItems<DeviceRow> {
  const spec = layout.items[section];
  const ordered = orderBy(rows, (r) => r.entity_id, spec?.order ?? []);
  const revealed = new Set<string>();
  if (!spec || !spec.hidden.length) return { rows: ordered, revealed };
  const out = ordered.filter((r) => {
    if (!spec.hidden.includes(r.entity_id)) return true;
    if (section === 'sensors' && showAlerting && isAlarming(r)) {
      revealed.add(r.entity_id);
      return true;
    }
    return false;
  });
  return { rows: out, revealed };
}

/** The sections of the pop-up as the layout shows them (`available` = what this person may see, in today's order). A hidden sensors
 * section still appears while one of its hidden sensors is alarming (the caller passes true only while the alert choice is `show`). */
export function shownSections<S extends string>(available: readonly S[], layout: PopupLayout, alarmingSensors: boolean): S[] {
  return orderBy(available, (s) => s, layout.sections).filter((s) => !layout.hidden.includes(s) || (s === ('sensors' as S) && alarmingSensors));
}

export interface EditRow {
  id: string;
  hidden: boolean;
}

/** Every section this person can see, in the layout's order, with its hidden flag - what the editor lists (hidden ones stay listed so they can come back). */
export function editSections(available: readonly string[], layout: PopupLayout): EditRow[] {
  return orderBy(available, (s) => s, layout.sections).map((id) => ({ id, hidden: layout.hidden.includes(id) }));
}

/** The items of a section as the editor lists them: all of them, in the layout's order, with the hidden flag. */
export function editItems(rows: readonly DeviceRow[], section: string, layout: PopupLayout): { row: DeviceRow; hidden: boolean }[] {
  const spec = layout.items[section];
  return orderBy(rows, (r) => r.entity_id, spec?.order ?? []).map((row) => ({ row, hidden: !!spec?.hidden.includes(row.entity_id) }));
}

/** The element at `index` moved one place up (-1) or down (+1); the list unchanged at either end. */
export function move<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const j = index + delta;
  if (index < 0 || index >= list.length || j < 0 || j >= list.length) return [...list];
  const out = [...list];
  [out[index], out[j]] = [out[j], out[index]];
  return out;
}

/** The element at `from` dragged to the place of the one at `to` (a drop); the list unchanged for a bad index. */
export function moveTo<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return [...list];
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

const toggle = (list: readonly string[], id: string): string[] => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** The draft after the eye of a section is pressed. */
export function toggleSection(draft: PopupLayout, id: string): PopupLayout {
  return { ...draft, hidden: toggle(draft.hidden, id) };
}

/** The draft after a section is moved: `order` is the section ids as the editor lists them now. */
export function withSectionOrder(draft: PopupLayout, order: readonly string[]): PopupLayout {
  return { ...draft, sections: [...order] };
}

/** The draft after the eye of one item is pressed (`currentOrder` = the item ids as listed now, kept so the order stays explicit). */
export function toggleItem(draft: PopupLayout, section: string, id: string, currentOrder: readonly string[]): PopupLayout {
  const spec = draft.items[section] ?? { order: [], hidden: [] };
  return { ...draft, items: { ...draft.items, [section]: { order: spec.order.length ? spec.order : [...currentOrder], hidden: toggle(spec.hidden, id) } } };
}

/** The draft after an item is moved: `order` = the item ids as the editor lists them now. */
export function withItemOrder(draft: PopupLayout, section: string, order: readonly string[]): PopupLayout {
  const spec = draft.items[section] ?? { order: [], hidden: [] };
  return { ...draft, items: { ...draft.items, [section]: { order: [...order], hidden: spec.hidden } } };
}

/** The layout to save: the sections in the editor's order when it differs from today's, the hidden ones, and only the item lists that say
 * something. An untouched layout saves as null (= nothing configured: the area follows the site default / today's fixed pop-up). */
export function buildLayout(draft: PopupLayout, listedSections: readonly string[]): PopupLayout | null {
  const items: PopupLayout['items'] = {};
  for (const sec of POPUP_ITEM_SECTIONS) {
    const s = draft.items[sec];
    if (s && (s.hidden.length || s.order.length)) items[sec] = { order: [...s.order], hidden: [...s.hidden] };
  }
  const inDefaultOrder = listedSections.every((id, i) => i === 0 || SECTION_ORDER.indexOf(listedSections[i - 1]) <= SECTION_ORDER.indexOf(id));
  const out: PopupLayout = { sections: inDefaultOrder ? [] : [...listedSections], hidden: draft.hidden.filter((h) => listedSections.includes(h)), items };
  return !out.sections.length && !out.hidden.length && !Object.keys(items).length ? null : out;
}

/** Nothing would be visible (every section hidden): the editor warns before saving; the pop-up itself shows "nothing to show". */
export function nothingVisible(rows: readonly EditRow[]): boolean {
  return rows.length > 0 && rows.every((r) => r.hidden);
}

/** How many of a section's items the draft hides (shown in its row). */
export function hiddenCount(draft: PopupLayout, section: string): number {
  return draft.items[section]?.hidden.length ?? 0;
}
