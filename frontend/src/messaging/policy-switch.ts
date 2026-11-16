import { css, html, nothing, type TemplateResult } from 'lit';

/**
 * CR-DUP-ADMIN-CARDS-2440 (06:DUP-7): the "row with a title, a line of text and a switch track" that the access settings cards
 * ("הודעות", "מדיניות") and the person's "הודעות" tab each carried as a copy. The owning element keeps its own `<button class="sw"
 * role="switch">` (its data attributes, its click, its disabled rule) and puts `switchBody(...)` inside it.
 *
 * `switchTrackStyles` is what all three share: the text column, the second line, the track and its thumb (RTL first, the
 * `dir="ltr"` mirror, no transition under reduced motion) and the disabled look. `policySwitchStyles` adds the flat settings-card
 * row (a hairline above, a hover wash) the two settings cards share; the person's tab draws its own boxed row.
 */
export const switchTrackStyles = css`
  .sw:disabled {
    cursor: default;
    opacity: var(--sw-disabled-opacity);
  }
  .sw .txt {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sw .x {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .track {
    flex: none;
    position: relative;
    inline-size: 42px;
    block-size: 24px;
    border-radius: var(--sw-r-pill);
    background: var(--sw-toggle-off);
    transition: background var(--sw-t-fast) var(--sw-ease);
  }
  .track::after {
    content: '';
    position: absolute;
    inset-block-start: 3px;
    inset-inline-start: 3px;
    inline-size: 18px;
    block-size: 18px;
    border-radius: 50%;
    background: var(--sw-toggle-thumb);
    box-shadow: var(--sw-shadow-1);
    transition: transform var(--sw-t-fast) var(--sw-ease);
  }
  .sw[aria-checked='true'] .track {
    background: var(--sw-toggle-on);
  }
  .sw[aria-checked='true'] .track::after {
    transform: translateX(-18px);
  }
  :host-context([dir='ltr']) .sw[aria-checked='true'] .track::after {
    transform: translateX(18px);
  }
  @media (prefers-reduced-motion: reduce) {
    .track,
    .track::after {
      transition: none;
    }
  }
`;

/** The flat settings-card switch row ("הודעות", "מדיניות"): the row itself + the shared track. */
export const policySwitchStyles = [
  css`
    .sw {
      display: flex;
      align-items: center;
      gap: 14px;
      inline-size: 100%;
      min-block-size: max(64px, var(--_t));
      padding: 10px 14px;
      box-sizing: border-box;
      border: 0;
      border-block-start: 1px solid var(--sw-border);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .sw:not(:disabled):hover {
      background: var(--sw-hover-wash);
    }
    .sw:focus-visible {
      outline-offset: -2px;
    }
    .sw .t {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
  `,
  switchTrackStyles,
];

/**
 * The inside of a switch row: the title, the second line and the track. `text` as a string is wrapped in the `.x` line; a caller
 * that needs its own attributes on that line (or no line at all) passes a template or `nothing`.
 */
export function switchBody(title: string, text: string | TemplateResult | typeof nothing): TemplateResult {
  return html`<span class="txt"><span class="t">${title}</span>${typeof text === 'string' ? html`<span class="x">${text}</span>` : text}</span>
    <span class="track" aria-hidden="true"></span>`;
}
