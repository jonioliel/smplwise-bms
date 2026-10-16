import { css, html, type TemplateResult } from 'lit';
import { tabKey, type DrawerTab, type TabItem } from './drawer-model';
import { dwt } from './drawer-text';

/**
 * TKUI1 (release 2.6.0): the request's tab bar - סקירה / שיחה / עלויות / היסטוריה (IA §4.1). A real ARIA tab list: `role="tablist"`, each
 * tab `role="tab"` with `aria-selected` and `aria-controls`, a roving tabindex (only the active tab is in the Tab order), the arrow keys
 * move in the reading direction and Home / End jump; the badge is part of the accessible name ("שיחה, הודעה אחת חדשה"). Desktop: the
 * underline row; phone: the 44 px segmented bar of the mock-up. Rendered inside the host's shadow root; `onSelect` switches the tab
 * (the host renders ONLY the active tab's content, so each tab is one scroll container).
 */
export const TAB_PANEL_ID = 'dpanel';
export const tabId = (id: DrawerTab) => `dtab-${id}`;

export function drawerTabs(items: readonly TabItem[], active: DrawerTab, onSelect: (id: DrawerTab, focus: boolean) => void): TemplateResult {
  const onKey = (e: KeyboardEvent) => {
    const rtl = getComputedStyle(e.currentTarget as Element).direction === 'rtl';
    const next = tabKey(active, e.key, rtl);
    if (!next) return;
    e.preventDefault();
    onSelect(next, true);
  };
  return html`<div class="rtabs" role="tablist" aria-label=${dwt('tabs')} data-drawer-tabs @keydown=${onKey}>
    ${items.map((it) => html`<button type="button" role="tab" id=${tabId(it.id)} class=${it.id === active ? 'on' : ''} aria-selected=${String(it.id === active)}
      aria-controls=${TAB_PANEL_ID} tabindex=${it.id === active ? '0' : '-1'} aria-label=${it.name} data-tab=${it.id} @click=${() => onSelect(it.id, false)}>
      <span>${it.label}</span>${it.badge ? html`<span class=${`bdg ${it.tone}`} aria-hidden="true" data-badge=${it.badge}>${it.badge}</span>` : ''}
    </button>`)}
  </div>`;
}

export const drawerTabsStyles = css`
  .rtabs {
    display: flex;
    gap: 2px;
    padding-inline: 12px;
    border-block-end: 1px solid var(--dv-border);
    background: var(--dv-surface-solid);
  }
  .rtabs [role='tab'] {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 44px;
    padding-inline: 14px;
    border: 0;
    background: transparent;
    color: var(--dv-text-2);
    font: inherit;
    font-size: var(--sw-fs-md);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition: color var(--mm-motion, 120ms) var(--mm-ease, ease);
  }
  .rtabs [role='tab']:hover {
    color: var(--dv-text);
  }
  .rtabs [role='tab'].on {
    color: var(--dv-accent-text);
  }
  .rtabs [role='tab'].on::after {
    content: '';
    position: absolute;
    inset-inline: 10px;
    inset-block-end: -1px;
    block-size: 2px;
    border-radius: 2px;
    background: var(--dv-accent);
  }
  .rtabs [role='tab']:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: -4px;
    border-radius: var(--sw-r-sm);
  }
  .bdg {
    min-inline-size: 18px;
    block-size: 18px;
    padding-inline: 6px;
    border-radius: 999px;
    display: inline-grid;
    place-items: center;
    box-sizing: border-box;
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
  }
  .bdg.info {
    background: var(--dv-accent);
    color: var(--sw-text-inverse);
  }
  .bdg.warn {
    background: var(--dv-warning-soft);
    color: var(--au-warn-text);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dv-warning) 50%, transparent);
  }
  [role='tabpanel']:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: -2px;
  }
  @media (max-width: 767px) {
    .rtabs {
      margin: 10px 14px 4px;
      padding: 3px;
      border: 0;
      border-radius: 999px;
      background: var(--dv-surface-3);
    }
    .rtabs [role='tab'] {
      flex: 1;
      justify-content: center;
      min-block-size: 44px;
      padding-inline: 6px;
      border-radius: 999px;
      font-size: var(--sw-fs-sm);
    }
    .rtabs [role='tab'].on {
      background: var(--mm-seg-thumb, var(--dv-surface-solid));
      color: var(--dv-text);
      box-shadow: var(--dv-shadow-control);
    }
    .rtabs [role='tab'].on::after {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .rtabs [role='tab'] {
      transition: none;
    }
  }
`;
