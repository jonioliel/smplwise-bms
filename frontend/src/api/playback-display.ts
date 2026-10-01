/**
 * Who sees the two technical items of the recording screens (owner decision 2026-10-01): the grey helper line above every
 * timeline and the diagnostics block under the recording player. Installation settings `playback.helper_line` and
 * `playback.diagnostics`: all | installers | hidden. "installers" = callers holding `system.configure` at installation scope,
 * the same check the installer-only screens use (device layout editing, the device catalogue). Presentation only; screens
 * subscribe with `onPlaybackDisplay` and follow a change at once.
 */
import { can } from './session';

export type Visibility = 'all' | 'installers' | 'hidden';
export type PlaybackItem = 'helper_line' | 'diagnostics';

export const VISIBILITY_VALUES: readonly Visibility[] = ['all', 'installers', 'hidden'];
export const VISIBILITY_LABEL: Readonly<Record<Visibility, string>> = { all: 'לכולם', installers: 'מתקינים בלבד', hidden: 'מוסתר' };
export const PLAYBACK_ITEM_LABEL: Readonly<Record<PlaybackItem, string>> = { helper_line: 'שורת העזר בציר הזמן', diagnostics: 'נתוני אבחון בהקלטה' };

let current: Record<PlaybackItem, Visibility> = { helper_line: 'all', diagnostics: 'all' };
const listeners = new Set<() => void>();

export function normalizeVisibility(raw: unknown): Visibility {
  return VISIBILITY_VALUES.includes(raw as Visibility) ? (raw as Visibility) : 'all';
}

export function playbackDisplay(): Readonly<Record<PlaybackItem, Visibility>> {
  return current;
}

/** The installation's values as last read (or saved from the settings screen): every open screen follows at once. */
export function applyPlaybackDisplay(settings: { 'playback.helper_line'?: unknown; 'playback.diagnostics'?: unknown } | null | undefined): void {
  current = { helper_line: normalizeVisibility(settings?.['playback.helper_line']), diagnostics: normalizeVisibility(settings?.['playback.diagnostics']) };
  for (const l of listeners) l();
}

/** Is this item drawn for the signed-in user right now? */
export function showPlaybackItem(item: PlaybackItem): boolean {
  const v = current[item];
  return v === 'all' || (v === 'installers' && can('system.configure'));
}

export function onPlaybackDisplay(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
