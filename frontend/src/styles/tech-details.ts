import { css } from 'lit';

/**
 * SHARED-POLISH-2342 (INVREST-POLISH-2331 proposal): the one look of a "פרטים טכניים" disclosure - the raw device values an operator
 * rarely needs, kept behind a quiet summary. The events list (its data-sources line and the drawer's event block) and the event page
 * had two copies of it; both now read this sheet and keep only their own placement (margins) locally.
 *
 *   <details class="tech">
 *     <summary>…<span class="grow"></span>פרטים טכניים<sw-icon class="chev" name="chevron"></sw-icon></summary>
 *     <div class="techbody">…</div>          (or the page's own body: a key / value grid)
 *   </details>
 *
 * The summary is a 28 px row with its own focus ring; the chevron points to the inline end when closed and down when open; the
 * hover wash only under a pointer that hovers (mobile-native). Tokens only.
 */
export const techDetailsStyles = css`
  details.tech {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
  }
  details.tech > summary {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    min-block-size: 28px;
    padding: 2px 4px;
    border-radius: var(--sw-r-xs);
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  details.tech > summary::-webkit-details-marker {
    display: none;
  }
  details.tech > summary:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }
  details.tech > summary .grow {
    flex: 1;
  }
  details.tech .chev {
    flex: none;
    color: var(--sw-text-3);
    transform: rotate(-90deg);
    transition: transform var(--sw-t-fast) var(--sw-ease-out);
  }
  details.tech[open] > summary .chev {
    transform: rotate(90deg);
  }
  @media (hover: hover) and (pointer: fine) {
    details.tech > summary:hover {
      background: var(--sw-hover-wash);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    details.tech .chev {
      transition-duration: 0ms;
    }
  }
  details.tech .techbody {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-block-start: 4px;
    padding: 8px 12px;
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface-2);
    line-height: 1.6;
  }
`;
