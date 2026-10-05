import { LitElement, html, css, nothing } from 'lit';
import { html as shtml, unsafeStatic } from 'lit/static-html.js';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-tabs';
import '../components/sw-state-panel';
import type { TabItem } from '../components/sw-tabs';
import type { RouteState } from '../router';
import { energyAccess, onEnergyAccess, type EnergyAccess } from '../electricity/access';
import { tabStyleOf, INFRA_TABS, visibleTabs } from '../shell/nav';
import { canNav, isApi } from '../api/session';
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

export const ELECTRICITY_PAGES: PageDef[] = [
  { id: 'meters', label: 'מונים', tag: 'elec-meters-page', money: false },
  { id: 'accounts', label: 'חשבונות', tag: 'elec-accounts-page', money: false },
  { id: 'bills', label: 'חיובים', tag: 'elec-bills-page', money: true },
  { id: 'customers', label: 'לקוחות', tag: 'elec-customers-page', money: true },
];

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

  static styles = [css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-block-size: 100%;
      padding: 14px var(--sw-page-pad, 24px) 24px;
      max-inline-size: var(--sw-content-max);
      inline-size: 100%;
      box-sizing: border-box;
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
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onEnergyAccess((a) => (this.access = a));
  }

  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  private pages(): PageDef[] {
    return ELECTRICITY_PAGES.filter((p) => !p.money || this.access.bills);
  }

  render() {
    const r = this.route;
    const page = pageOf(r?.segments ?? []);
    const def = ELECTRICITY_PAGES.find((p) => p.id === page)!;
    const items: TabItem[] = this.pages().map((p) => ({ id: p.id, label: p.label, href: `#/infra/electricity/${p.id}` }));
    // the area row has a single tab until water and generators join: the shell draws it here (a row of one is not drawn by the navigation)
    const l1 = visibleTabs(INFRA_TABS, isApi(), canNav).length < 2 ? html`<sw-tabs .items=${INFRA_TABS.filter((t) => t.id === 'electricity')} active="electricity" .variant=${tabStyleOf(null, 1)} data-infra-l1></sw-tabs>` : nothing;
    let body;
    if (!this.access.view || (def.money && !this.access.bills)) {
      body = html`<sw-state-panel state="forbidden" data-elec=${page} data-state="forbidden"></sw-state-panel>`;
    } else if (!customElements.get(def.tag)) {
      body = html`<sw-state-panel state="empty" heading="אין מסך" data-elec=${page} data-state="empty"></sw-state-panel>`;
    } else {
      const tag = unsafeStatic(def.tag);
      body = shtml`<${tag} .segments=${(r?.segments ?? []).slice(3)} .params=${r?.params ?? new URLSearchParams()}></${tag}>`;
    }
    return html`<div class="rows" data-elec-shell>${l1}<sw-tabs .items=${items} .active=${page} .variant=${tabStyleOf(null, 2)} data-infra-pages></sw-tabs></div><div class="body" data-page=${page}>${body}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'infra-electricity': InfraElectricity;
  }
}
