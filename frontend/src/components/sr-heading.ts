import { css, html, type TemplateResult } from 'lit';

/**
 * UXFIX-NAV-295 (UX audit 2026-10-20, finding 14): a page whose layout draws no visible title still carries exactly one `<h1>`, so a
 * screen reader, the page outline and the browser tab agree. The heading is visually hidden, never removed from rendering (that would
 * drop it from the accessibility tree); its text is the page's navigation label, so the heading and the navigation never disagree.
 *
 * HDRFIX-295 (owner 2026-10-26, "missing titles in the infrastructure screens"): the infrastructure screens draw the heading VISIBLY
 * (`srHeading(text, true)`): the area chip and the page row say where the user is, but every other screen opens with a title, and a
 * screen that does not looks broken. The visible heading is the same single `<h1>`; it takes the page header's look (sw-page) and the
 * start-edge reserve of the developer / installer logos (class `lead-head`, so the screen includes `leadReserveStyles`).
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
  .pg-h1 {
    margin: 0;
    font-family: var(--sw-font-heading, var(--sw-font));
    font-size: var(--sw-h1, var(--sw-fs-2xl));
    font-weight: var(--sw-h1-weight, var(--sw-fw-semibold));
    line-height: 1.2;
    letter-spacing: var(--sw-h1-tracking, -0.01em);
    color: var(--sw-heading, var(--sw-text));
  }
  @media (max-width: 767px) {
    .pg-h1 {
      font-size: var(--sw-h1-phone, var(--sw-fs-xl));
    }
  }
`;

/** The page heading: visually hidden by default, a normal page title with `visible` (render it once per screen, as the first element;
 * include `srHeadingCss`, and `leadReserveStyles` for the visible form). */
export function srHeading(text: string, visible = false): TemplateResult {
  return visible ? html`<h1 class="pg-h1 lead-head" data-page-heading>${text}</h1>` : html`<h1 class="sr-h1" data-page-heading>${text}</h1>`;
}
