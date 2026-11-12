import { LitElement, html, css, nothing } from 'lit';
import { html as shtml, unsafeStatic } from 'lit/static-html.js';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-tabs';
import '../components/sw-page';
import '../components/sw-state-panel';
import type { TabItem } from '../components/sw-tabs';
import type { RouteState } from '../router';
import { energyAccess, onEnergyAccess, type EnergyAccess } from '../electricity/access';
import { tabStyleOf, INFRA_ELECTRICITY_PAGES, INFRA_MONEY_PAGES, INFRA_TABS, infraPageTabs } from '../shell/nav';
import { isApi } from '../api/session';
import { navigate } from '../router';
import { TabsModeController } from '../shell/tabs-mode';
import { clearPairChip, publishPairChip, type PairChip } from '../shell/tab-pair';
import { infraPagesAsChip, infraPagesChip } from '../shell/infra-pages';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

// Every screen file of the module registers itself: `screens/electricity/page-*.ts` (pages) and `settings-*.ts` (settings sections). A file added by
// the other UI branch needs no edit here (docs/architecture/ELECTRICITY_UI_SHELL.md).
import.meta.glob('./electricity/{page,settings}-*.ts', { eager: true });

export type ElectricityPage = 'meters' | 'accounts' | 'bills' | 'customers';

interface PageDef {
  id: ElectricityPage;
  label: string;
  tag: string;
  /** Needs the bills permission (money): the tab is not offered and the route says "forbidden". */
  money: boolean;
}

/** TABSET-293: ids, labels and the money flag come from the tab registry (shell/nav.ts INFRA_ELECTRICITY_PAGES), which the tabs editor
 * lists as `infra.electricity`; this screen adds the element of each page. */
export const ELECTRICITY_PAGES: PageDef[] = INFRA_ELECTRICITY_PAGES.map((p) => ({ id: p.id as ElectricityPage, label: p.label, tag: `elec-${p.id}-page`, money: INFRA_MONEY_PAGES.includes(p.id) }));

/** The page a route names (`#/infra/electricity/<page>`); the meters page by default. */
export function pageOf(segments: readonly string[]): ElectricityPage {
  const id = segments[1] === 'electricity' ? segments[2] : undefined;
  return ELECTRICITY_PAGES.find((p) => p.id === id)?.id ?? 'meters';
}

/**
 * תשתיות › מוני חשמל: the sub-tab of the infrastructure area and its page row (מונים, חשבונות, חיובים, לקוחות). The shell owns the rows and the
 * routes; each page is its own element (docs/architecture/ELECTRICITY_UI_SHELL.md). The pages for money (חיובים, לקוחות) are offered, and open,
 * only to holders of `energy.bills`.
 */
@customElement('infra-electricity')
export class InfraElectricity extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private access: EnergyAccess = energyAccess();
  private stop?: () => void;
  private readonly tabsMode = new TabsModeController(this, 'area');
  /** The page row as the shell's second chip (the dropdown form), published after each render; null = drawn here as a tab row. */
  private pagesChip: PairChip | null = null;

  /* AUDIT30-E2 (round-30 audit #6, #9): the page is a <sw-page> - its header (the one h1, the logos' and the corner's reserves), padding
     and width come from the shared component instead of a copy here */
  static styles = [css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      inline-size: 100%;
    }
    sw-page {
      flex: 1 1 auto;
      min-block-size: 0;
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    .body {
      min-inline-size: 0;
    }
    .body > * {
      display: block;
    }
    /* NOSCROLL-297 (owner rule: a control screen fits the viewport on a desktop): the meters page takes the height left under the tab
       rows; its table (or cards) and the areas tree scroll inside their own boxes (screens/electricity/page-meters.ts). The other pages
       (accounts, bills, customers) are documents and keep the page scroll. */
    @media (min-width: 900px) {
      .body[data-page='meters'] {
        flex: 1 1 auto;
        min-block-size: 0;
        display: flex;
        flex-direction: column;
      }
      .body[data-page='meters'] > * {
        flex: 1 1 auto;
        min-block-size: 0;
        display: flex;
        flex-direction: column;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onEnergyAccess((a) => (this.access = a));
  }

  disconnectedCallback() {
    this.stop?.();
    clearPairChip(this);
    this.pagesChip = null;
    super.disconnectedCallback();
  }

  private pages(): PageDef[] {
    return ELECTRICITY_PAGES.filter((p) => !p.money || this.access.bills);
  }

  render() {
    const r = this.route;
    const page = pageOf(r?.segments ?? []);
    const def = ELECTRICITY_PAGES.find((p) => p.id === page)!;
    // TABSET-293: the page row follows ui.tabs (`infra.electricity`: order, hidden pages) after the money gate
    const items: TabItem[] = infraPageTabs('infra.electricity', this.pages().map((p) => ({ id: p.id, label: p.label, href: `#/infra/electricity/${p.id}` })), isApi());
    // AUDIT30-E2: no area row of one tab here any more (the lone "מוני חשמל" chip only repeated the page title); the navigation draws the
    // area row itself once it holds two or more tabs
    let body;
    if (!this.access.view || (def.money && !this.access.bills)) {
      body = html`<sw-state-panel state="forbidden" data-elec=${page} data-state="forbidden"></sw-state-panel>`;
    } else if (!customElements.get(def.tag)) {
      body = html`<sw-state-panel icon="bolt" state="empty" heading="אין מסך" data-elec=${page} data-state="empty"></sw-state-panel>`;
    } else {
      const tag = unsafeStatic(def.tag);
      body = shtml`<${tag} .segments=${(r?.segments ?? []).slice(3)} .params=${r?.params ?? new URLSearchParams()}></${tag}>`;
    }
    // the page row follows the tab mode: in the dropdown form the shell draws it as the second chip, beside the area's chip (shell/infra-pages.ts)
    const asChip = infraPagesAsChip(this.tabsMode.value, items.length);
    this.pagesChip = asChip ? infraPagesChip('עמודים', items, page, (id) => navigate(`/infra/electricity/${id}`)) : null;
    const row = asChip ? nothing : html`<sw-tabs .items=${items} .active=${page} .variant=${tabStyleOf('infra.electricity')} data-infra-pages></sw-tabs>`;
    // UXFIX-NAV-295 / AUDIT30-E2: the page's one h1 is sw-page's heading, the navigation label of the area
    const heading = INFRA_TABS.find((x) => x.id === 'electricity')?.label ?? 'מוני חשמל';
    return html`<sw-page heading=${heading} data-infra-page="electricity">${row === nothing ? nothing : html`<div class="rows" data-elec-shell>${row}</div>`}<div class="body" data-page=${page}>${body}</div></sw-page>`;
  }

  protected updated() {
    if (this.pagesChip) publishPairChip(this, this.pagesChip);
    else clearPairChip(this);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'infra-electricity': InfraElectricity;
  }
}
