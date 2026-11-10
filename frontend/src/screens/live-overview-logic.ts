/** WARMUP-POLISH-2421: the room the attention pager takes at the card's end (px). */
export const PAGER_H = 34;

/** WARMUP-POLISH-2421: how many attention items fit when the card's content ends at `limit` (viewport px) and the items end at
 * `bottoms`: all of them when they all fit, else as many as fit above the pager - at least one. */
export function attentionFit(limit: number, bottoms: readonly number[], pager = PAGER_H): number {
  if (bottoms.every((b) => b <= limit + 0.5)) return bottoms.length;
  const n = bottoms.filter((b) => b <= limit - pager + 0.5).length;
  return Math.max(1, n);
}
