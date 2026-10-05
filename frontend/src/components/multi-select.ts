/**
 * The pure selection logic of a multi-select dropdown (sw-dropdown `multiple`, 2.0.1, owner request 2026-10-05: the recordings
 * screen's camera comparison picker). No Lit, no DOM: the unit specs import it under Playwright's own transpiler.
 */

/** The outcome of a toggle: the next ids, and `refused` when the pick was a `max + 1`th one (the ids are then unchanged). */
export interface TogglePick {
  ids: string[];
  refused: boolean;
}

/**
 * Toggle `id` in `values`, never past `max` selections (`max` <= 0 = no limit). Order is kept: a new pick joins the end, a removed one
 * leaves the others in place. The 5th pick is REFUSED, not swapped for the oldest (the chips of 2.0.0 dropped the oldest extra).
 */
export function toggleCapped(values: readonly string[], id: string, max: number): TogglePick {
  if (!id) return { ids: [...values], refused: false };
  if (values.includes(id)) return { ids: values.filter((v) => v !== id), refused: false };
  if (max > 0 && values.length >= max) return { ids: [...values], refused: true };
  return { ids: [...values, id], refused: false };
}

/** The count shown on the chip and in the list's foot: "n מתוך N". `base` adds a fixed member to both sides (the recordings screen counts
 * the lead camera, chosen elsewhere, in its "עד 4"). With no limit, just the number picked. */
export function pickedCount(picked: number, max: number, base = 0): string {
  const n = picked + base;
  return max > 0 ? `${n} מתוך ${max + base}` : String(n);
}

/** The short, calm refusal of a pick past the limit (the limit as the user sees it, `max + base`). */
export function limitNotice(max: number, base = 0): string {
  return `אפשר לבחור עד ${max + base}`;
}

/** The chip's text: the picked labels in pick order, or the placeholder when nothing is picked. */
export function pickedSummary(labels: readonly string[], placeholder: string): string {
  return labels.length ? labels.join(', ') : placeholder;
}

/**
 * The recordings screen's `extra` route parameter (#/investigate/playback?camera=<lead>&extra=<id>,<id>): the known cameras in the
 * given order, without the lead, without repeats, at most `max` of them (the group is the lead plus up to three). Kept exactly as the
 * chips of 2.0.0 read it, so a link from the floor map, the synchronized-playback screen or a case keeps opening the same comparison.
 */
export function extraFromParam(param: string, lead: string, knownIds: readonly string[], max = 3): string[] {
  const out: string[] = [];
  for (const id of param.split(',')) {
    if (!id || id === lead || !knownIds.includes(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}
