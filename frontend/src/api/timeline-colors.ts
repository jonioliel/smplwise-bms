/**
 * Timeline colours (owner 2026-10-01: the person dots and the recording bars were both blue). One colour per kind of thing
 * the investigation timeline draws, an installation setting (`timeline.colors`, הגדרות › וידאו ומדיה › צבעי ציר הזמן).
 * The server stores a palette name or "#rrggbb" per option (backend services/timeline_colors.py keeps the same lists);
 * this module resolves it and publishes it as CSS custom properties on the document root, so every screen that draws
 * a kind - the timeline and its legend, event dots, event lists, filter chips - follows with no re-render.
 * Colours are applied only after validation here too: a value that is not a palette name or "#rrggbb" reads as the default.
 */

export const TIMELINE_OPTIONS = ['recording', 'motion', 'person', 'vehicle', 'door', 'line', 'offline'] as const;
export type TimelineOption = (typeof TIMELINE_OPTIONS)[number];
export type TimelineColors = Record<TimelineOption, string>;

/** The option's name in the settings card and the legend (short). */
export const TIMELINE_OPTION_LABEL: Readonly<Record<TimelineOption, string>> = {
  recording: 'הקלטה',
  motion: 'תנועה',
  person: 'אדם',
  vehicle: 'רכב',
  door: 'דלת',
  line: 'חציית קו',
  offline: 'אובדן וידאו',
};

/** The swatches. Mid-tones that read on the light surface and on a dark one; keep the names in step with the backend. */
export const TIMELINE_PALETTE: Readonly<Record<string, { hex: string; label: string }>> = {
  accent: { hex: '#2767ed', label: 'כחול' },
  red: { hex: '#ef4444', label: 'אדום' },
  orange: { hex: '#ea580c', label: 'כתום' },
  amber: { hex: '#f59e0b', label: 'ענבר' },
  green: { hex: '#22c55e', label: 'ירוק' },
  teal: { hex: '#14b8a6', label: 'טורקיז' },
  cyan: { hex: '#06b6d4', label: 'תכלת' },
  purple: { hex: '#8b5cf6', label: 'סגול' },
  pink: { hex: '#ec4899', label: 'ורוד' },
  gray: { hex: '#6b7280', label: 'אפור' },
};

/** The defaults the backend applies (and what the app uses until the settings arrive); the person is no longer the recording's blue. */
export const DEFAULT_TIMELINE_COLORS: Readonly<TimelineColors> = {
  recording: 'accent',
  motion: 'red',
  person: 'orange',
  vehicle: 'green',
  door: 'purple',
  line: 'amber',
  offline: 'gray',
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** A stored colour (palette name or #rrggbb) as a six-digit lower-case hex, or null when it is neither. */
export function timelineHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (Object.prototype.hasOwnProperty.call(TIMELINE_PALETTE, value)) return TIMELINE_PALETTE[value].hex;
  return HEX.test(value) ? value.toLowerCase() : null;
}

/** The custom property an option's colour is published as; `var(--sw-tl-person)` is what a screen draws with. */
export const timelineVar = (option: TimelineOption): string => `var(--sw-tl-${option})`;

/** A settings value (or anything) in its canonical form: every option present, an unknown colour reads as the default. */
export function normalizeTimelineColors(raw: unknown): TimelineColors {
  const out: TimelineColors = { ...DEFAULT_TIMELINE_COLORS };
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const option of TIMELINE_OPTIONS) {
      const v = (raw as Record<string, unknown>)[option];
      if (timelineHex(v) !== null) out[option] = v as string;
    }
  }
  return out;
}

/** What `var(--sw-tl-<option>)` resolves to for this value: the product accent follows the theme, anything else is its hex. */
function cssColour(value: string): string {
  return value === 'accent' ? 'var(--sw-accent)' : (timelineHex(value) as string);
}

let current: TimelineColors = { ...DEFAULT_TIMELINE_COLORS };
const listeners = new Set<() => void>();

export function timelineColors(): TimelineColors {
  return current;
}

/** Publishes the colours as `--sw-tl-<option>` on the document root (design/tokens.ts holds the defaults). */
export function applyTimelineColors(raw: unknown): void {
  current = normalizeTimelineColors(raw);
  if (typeof document !== 'undefined') {
    const style = document.documentElement.style;
    for (const option of TIMELINE_OPTIONS) style.setProperty(`--sw-tl-${option}`, cssColour(current[option]));
  }
  for (const l of listeners) l();
}

export function onTimelineColors(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Options (other than `option` itself) whose colour is the same as, or nearly the same as, this one's: the settings card warns. */
export function similarTimelineOptions(colors: TimelineColors, option: TimelineOption, threshold = 40): TimelineOption[] {
  const rgb = (v: string): [number, number, number] => {
    const h = timelineHex(v) ?? '#000000';
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  };
  const a = rgb(colors[option]);
  return TIMELINE_OPTIONS.filter((o) => {
    if (o === option) return false;
    const b = rgb(colors[o]);
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < threshold;
  });
}
