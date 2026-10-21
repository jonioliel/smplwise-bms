import { css, html, type TemplateResult } from 'lit';

/**
 * UXFIX-NAV-295 (UX audit 2026-10-20, finding 14): a page whose layout draws no visible title (the infrastructure screens: the
 * area chip and the page row already say where the user is) still carries exactly one `<h1>`, so a screen reader, the page outline and
 * the browser tab agree. The heading is visually hidden, never removed from rendering (that would drop it from the accessibility tree);
 * its text is the page's navigation label, so the heading and the navigation never disagree.
 */
export const srHeadingCss = css`
  .sr-h1 {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
`;

/** The visually hidden page heading (render it once per screen, as the first element; include `srHeadingCss` in the styles). */
export function srHeading(text: string): TemplateResult {
  return html`<h1 class="sr-h1" data-page-heading>${text}</h1>`;
}
