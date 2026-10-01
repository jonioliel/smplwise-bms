import { html, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { ICON, glyphPath } from './media-remote-keys';

/** CR-016 S3: the few glyphs the player panel needs on top of the remote's set (same 24 px stroke style, `currentColor`). */
export const PLAYER_ICON: Record<string, string> = {
  shuffle: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="m4 4 5 5"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  receiver: '<rect x="2.5" y="8" width="19" height="9" rx="2"/><circle cx="7.5" cy="12.5" r="1.8"/><circle cx="16.5" cy="12.5" r="1.8"/><path d="M5 20h.01M19 20h.01"/>',
  bt: '<path d="m7 7 10 10-5 5V2l5 5L7 17"/>',
  radio: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="m8 8 8-5"/><circle cx="9" cy="14" r="2.5"/><path d="M15 12h3M15 16h3"/>',
  transfer: '<path d="M5 8h14"/><path d="m15 4 4 4-4 4"/><path d="M19 16H5"/><path d="m9 12-4 4 4 4"/>',
  group: '<rect x="3" y="5" width="8" height="14" rx="2"/><rect x="13" y="5" width="8" height="14" rx="2"/><circle cx="7" cy="14.5" r="1.8"/><circle cx="17" cy="14.5" r="1.8"/>',
  unlink: '<path d="m9 15 6-6"/><path d="M11 6.5 12.4 5a4 4 0 0 1 5.7 5.7L16.7 12"/><path d="m13 17.5-1.4 1.5a4 4 0 0 1-5.7-5.7L7.3 12"/><path d="M3 3l18 18"/>',
};

const ALL: Record<string, string> = { ...ICON, ...PLAYER_ICON };

/** One icon by name (the remote's set, then the player set); an unknown name draws nothing. */
export const ic = (name: string): TemplateResult => html`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${unsafeSVG(ALL[name] ?? '')}</svg>`;
/** A library / now-playing glyph: the item's own glyph, else a note. */
export const gl = (g: string | null | undefined, cls = 'ic gl'): TemplateResult => html`<svg class=${cls} viewBox="0 0 24 24" aria-hidden="true">${unsafeSVG(g === 'radio' ? PLAYER_ICON.radio : glyphPath(g ?? 'music'))}</svg>`;
