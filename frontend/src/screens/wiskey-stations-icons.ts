/**
 * The few glyphs the stations screen needs that the shared icon set (components/sw-icon.ts) does not have: a handset, a
 * hung-up handset, a window (the classic panel) and a table. Paths are the approved mock-up's (24 x 24, stroke 1.8,
 * `currentColor`), kept here so the shared icon set - a file every slice edits - stays untouched.
 */
import { svg, type TemplateResult } from 'lit';

const PATHS = {
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  hangup: 'M3 14c5-5 13-5 18 0l-2 3-4-2v-3c-2-.7-4-.7-6 0v3l-4 2z',
  window: 'M3 5h18v14H3zM3 9h18M7 7h.01M10 7h.01',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14',
} as const;

export type WkIconName = keyof typeof PATHS;
export const isWkIcon = (name: string): name is WkIconName => name in PATHS;

export function wkIcon(name: WkIconName, size = 16): TemplateResult {
  return svg`<svg viewBox="0 0 24 24" width=${size} height=${size} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d=${PATHS[name]}></path></svg>`;
}
