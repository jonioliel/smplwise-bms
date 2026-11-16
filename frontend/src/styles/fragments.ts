import { css } from 'lit';

/**
 * CR-CSS-FRAGMENTS-2440 (review finding 06:CSS-1, step 1 of 06:CMP-2): the rule bodies the screens re-type, written once.
 *
 * The review counted 85 identical declaration sets in three files or more (436 copies). A fragment here is one of those rules with
 * the SELECTOR THE SCREENS ALREADY USE and the declarations exactly as they are typed today, so a screen adopts it by replacing its
 * copy with the fragment in the same place of its sheet:
 *
 *     static styles = css`
 *       ...
 *       ${segTrackStyles}          <- where the screen's own ".seg { ... }" stood
 *       .seg button { ... }        <- the screen's own key (these differ from screen to screen and stay local)
 *       ${segThumbStyles}
 *       ...
 *     `;
 *
 * Interpolating in place keeps the order of the rules, so the cascade - and every pixel - is unchanged. The rules of this file:
 *  - a fragment exists only where the same selector AND the same declarations stand in at least three files of the tree
 *    (the count next to each one is of 2026-11-16, release/2437-train); nothing here is a new look;
 *  - never edit a fragment to suit one screen: a screen that needs a different value keeps its own rule;
 *  - the settings pages' own shared blocks live in styles/settings.ts (which builds on these).
 *
 * This branch adopts them in the settings-card family only; the other families follow in CR-CSS-FRAGMENTS-TAIL.
 * Not here, on purpose: the "ellipsis line", "native input skin" and "skeleton column" sets of the review are identical in their
 * declarations but stand under a different selector in almost every file (`.nm`, `.tt`, `.who`, ...), so there is no selector to
 * share without touching markup; CR-CSS-FRAGMENTS-TAIL decides those per family.
 */

/** The sunken track of a pill segmented control (3 files: system-design, system-look, system-nav-size). */
export const segTrackStyles = css`
  .seg {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    background: var(--sw-surface-3);
    border-radius: var(--sw-r-md);
    flex-wrap: wrap;
  }
`;

/** The chosen key of a segmented control - the lifted thumb, the label in the accent ink (5 files under this selector; the same
 * declarations stand under `.rangepick button.on`, `.tabs button[aria-selected='true']`, ... in 6 more). */
export const segThumbStyles = css`
  .seg button[aria-pressed='true'] {
    background: var(--sw-seg-key, var(--sw-surface));
    color: var(--sw-seg-key-ink, var(--sw-accent-text));
    font-weight: var(--sw-fw-semibold);
    box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
  }
`;

/** The same thumb with the label in the text ink (6 files under this selector). */
export const segThumbPlainStyles = css`
  .seg button[aria-pressed='true'] {
    background: var(--sw-seg-key, var(--sw-surface));
    color: var(--sw-seg-key-ink, var(--sw-text));
    font-weight: var(--sw-fw-semibold);
    box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
  }
`;

/** The button row at the foot of a dialog (3 files). */
export const dialogRowStyles = css`
  .dlgrow {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
`;

/** A "saved" line under a form (11 files). */
export const okLineStyles = css`
  .ok {
    color: var(--sw-success-text);
    font-size: var(--sw-fs-sm);
  }
`;

/** An error line under a form (29 files). */
export const errLineStyles = css`
  .err {
    color: var(--sw-danger-text);
    font-size: var(--sw-fs-sm);
  }
`;

/** A muted note (11 files). */
export const mutedStyles = css`
  .muted {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
`;

/** A left-to-right isolate inside the RTL page - a code, an id, an address (30 files). */
export const ltrStyles = css`
  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }
`;

/** Text for a screen reader only (6 files). */
export const srOnlyStyles = css`
  .sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
`;

/** A block host that may shrink inside a flex or grid parent (32 files). */
export const hostBlockStyles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
`;
