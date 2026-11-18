import { css } from 'lit';
import { okLineStyles } from '../styles/fragments';

/**
 * CR-MULTIMEDIA-BASE-2440 (06:DUP-5): the CSS the multimedia settings lists carried as copies - הגדרות › מולטימדיה
 * (system-multimedia.ts), its speakers / players card (system-multimedia-players.ts) and the casting card (system-cast.ts).
 * Only rules that were the same declaration for declaration are here; each screen lists the fragment BEFORE its own block, so a
 * rule of its own (a touch size, a phone layout) still wins exactly as it did. The list itself (table, filters, columns) is
 * `mediaAdminListCss` / `adminTable` in media-admin-list.ts; the pure part stays in media-admin-list-logic.ts (no Lit there).
 */

/** A settings row (label + control) and its muted second line: the players card and the casting card. */
export const mediaAdminRowCss = css`
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 10px 0;
    border-block-end: 1px solid var(--sw-border);
    flex-wrap: wrap;
  }
  .row:last-child {
    border-block-end: 0;
  }
  .lbl {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-medium);
  }
  .muted {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-regular);
  }
`;

/** The device form that opens inside a list row (screens and players): its lines and fields, the endpoint rows, the link button. */
export const mediaAdminFormCss = css`
  .dev {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px 0 0;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 10px 16px;
    flex-wrap: wrap;
  }
  .line .grow {
    flex: 1;
  }
  .f {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    /* 0.1.162: the form opens inside the list's padded detail row; a field never grows past it (the profile select's
       longest option, "זיהוי אוטומטי · ...", is wider than a 320 px phone's row) */
    max-inline-size: 100%;
    min-inline-size: 0;
  }
  .f.inline {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  select {
    max-inline-size: 100%;
    min-inline-size: 0;
  }
  input[type='number'] {
    inline-size: 88px;
  }
  .ep {
    display: grid;
    grid-template-columns: minmax(140px, 1.4fr) minmax(90px, 0.8fr) minmax(0, 2fr) auto;
    gap: 6px 12px;
    align-items: center;
    padding: 6px 0;
    font-size: var(--sw-fs-sm);
    border-block-end: 1px dashed var(--sw-border);
  }
  .ep:last-child {
    border-block-end: 0;
  }
  .link {
    color: var(--sw-accent-text);
    font-size: var(--sw-fs-sm);
    cursor: pointer;
    background: none;
    border: 0;
    padding: 0;
    font-family: inherit;
    min-block-size: 32px;
  }
  .ib:disabled {
    opacity: 0.35;
    cursor: default;
  }
  ${okLineStyles}
`;
