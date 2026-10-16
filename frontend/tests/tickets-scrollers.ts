import type { Page } from '@playwright/test';

// TKUI7: the one-scroll probe shared by the service-module layout specs (the same walk as layout-tickets-drawer / -conversation).
/** The scroll containers inside the open drawer's dialog (through shadow roots and slots), top-layer menus and dialogs excluded. */
export async function drawerScrollers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const find = (root: ParentNode, sel: string): Element | null => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.matches(sel)) return el;
        if (el.shadowRoot) {
          const f = find(el.shadowRoot, sel);
          if (f) return f;
        }
      }
      return null;
    };
    const td = find(document, 'ticket-detail') as HTMLElement | null;
    const dlg = td?.shadowRoot?.querySelector('sw-drawer')?.shadowRoot?.querySelector('dialog');
    if (!dlg) return ['(no drawer)'];
    const out: string[] = [];
    const scrolls = (e: Element) => {
      const cs = getComputedStyle(e);
      return /(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX);
    };
    const skip = '[popover], sw-dialog, tickets-delete-dialog';
    const walk = (n: ParentNode) => {
      for (const e of Array.from(n.children)) {
        if (e.matches(skip)) continue;
        if (scrolls(e)) out.push(`${e.tagName.toLowerCase()}.${(e as HTMLElement).className || ''}`.trim());
        if (e instanceof HTMLSlotElement) for (const a of e.assignedElements({ flatten: true })) {
          if (a.matches(skip)) continue;
          if (scrolls(a)) out.push(`slotted ${a.tagName.toLowerCase()}`);
          if (a.shadowRoot) walk(a.shadowRoot);
          walk(a);
        }
        if (e.shadowRoot) walk(e.shadowRoot);
        walk(e);
      }
    };
    walk(dlg);
    return out;
  });
}
