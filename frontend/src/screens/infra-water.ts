import { LitElement, html, css, nothing } from 'lit';
import { html as shtml, unsafeStatic } from 'lit/static-html.js';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-tabs';
import '../components/sw-state-panel';
import '../components/sw-button';
import type { TabItem } from '../components/sw-tabs';
import type { RouteState } from '../router';
import { canSettings, onWaterAccess, refreshWaterVisibility, waterAccess, type WaterAccess } from '../water/access';
import { tabStyleOf, INFRA_SETTINGS_HREF, INFRA_TABS, INFRA_WATER_MANAGE_PAGES, INFRA_WATER_MONEY_PAGES, INFRA_WATER_PAGES, infraPageTabs, visibleTabs } from '../shell/nav';
import { canNav, isApi } from '../api/session';
import { navigate } from '../router';
import { TabsModeController } from '../shell/tabs-mode';
import { clearPairChip, publishPairChip, type PairChip } from '../shell/tab-pair';
import { infraPagesAsChip, infraPagesChip } from '../shell/infra-pages';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { leadReserveStyles } from '../styles/lead-reserve'; // LOGOFIX-295: the page row keeps the developer / installer logos' room free
import { srHeading, srHeadingCss } from '../components/sr-heading';
import { wt } from '../water/i18n';
import { openAlertCount, onOpenAlertCount } from '../api/water';

// Every page file of the module registers itself (`screens/water/page-*.ts`), as the electricity shell does.
import.meta.glob('./water/page-*.ts', { eager: true });

export type WaterPage = 'meters' | 'usage' | 'alerts' | 'accounts' | 'bills' | 'customers' | 'settings';

interface PageDef {
  id: WaterPage;
  label: string;
  tag: string;
  /** needs water.bills (money) */
  money: boolean;
  /** needs water.manage or system.configure */
  manage: boolean;
}

/** Ids, labels and the gates come from the tab registry (shell/nav.ts INFRA_WATER_PAGES, `infra.water` in the tabs editor). */
export const WATER_PAGES: PageDef[] = INFRA_WATER_PAGES.map((p) => ({ id: p.id as WaterPage, label: p.label, tag: `water-${p.id}-page`, money: INFRA_WATER_MONEY_PAGES.includes(p.id), manage: INFRA_WATER_MANAGE_PAGES.includes(p.id) }));

/** The page a route names (`#/infra/water/<page>`); the meters page by default. */
export function waterPageOf(segments: readonly string[]): WaterPage {
  const id = segments[1] === 'water' ? segments[2] : undefined;
  return WATER_PAGES.find((p) => p.id === id)?.id ?? 'meters';
}

/** Whether this viewer may open a page (the row offers only these; a deep link to another one shows the lock panel). */
export function pageAllowed(p: Pick<PageDef, 'money' | 'manage'>, a: WaterAccess): boolean {
  return a.view && (!p.money || a.bills) && (!p.manage || canSettings(a));
}

/**
 * תשתיות › מים (CR-WATER78 sections 3, 5 and 16): the sub-tab of the infrastructure area and its page row (מונים · צריכה · התראות ·
 * חשבונות · חיובים · לקוחות · הגדרות), the electricity shell's shape (screens/infra-electricity.ts). The module status gates it: off = the
 * stale panel with "להגדרות" for managers; without water.view = the lock panel. Each page is its own element.
 */
@customElement('infra-water')
export class InfraWater extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private access: WaterAccess = waterAccess();
  @state() private alerts = openAlertCount();
  private stop?: () => void;
  private stopCount?: () => void;
  private readonly tabsMode = new TabsModeController(this, 'area');
  private pagesChip: PairChip | null = null;

  static styles = [srHeadingCss, leadReserveStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-block-size: 100%;
      padding: 14px var(--sw-page-pad) 24px;
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
    this.stop = onWaterAccess((a) => (this.access = a));
    this.stopCount = onOpenAlertCount((n) => (this.alerts = n));
    void refreshWaterVisibility();
  }

  disconnectedCallback() {
    this.stop?.();
    this.stopCount?.();
    clearPairChip(this);
    this.pagesChip = null;
    super.disconnectedCallback();
  }

  private body(page: WaterPage, def: PageDef) {
    const a = this.access;
    const r = this.route;
    if (!a.loaded) return html`<sw-state-panel state="loading" data-water=${page} data-state="loading"></sw-state-panel>`;
    if (a.failed) {
      return html`<sw-state-panel state="error" heading=${wt('loadMetersError')} actionLabel=${wt('retry')} data-water=${page} data-state="error" @action=${() => void refreshWaterVisibility()}></sw-state-panel>`;
    }
    if (!a.enabled) {
      // the stale deep link of a switched-off module (section 5.4): the switch lives in Settings › תשתיות › מים
      return html`<sw-state-panel state="stale" heading=${wt('offTitle')} hint=${wt('offHint')} data-water=${page} data-state="off">
        ${a.manage || a.configure ? html`<sw-button size="sm" data-to-settings @click=${() => navigate(INFRA_SETTINGS_HREF.slice(1))}>${wt('toSettings')}</sw-button>` : nothing}
      </sw-state-panel>`;
    }
    if (!pageAllowed(def, a)) return html`<sw-state-panel state="forbidden" data-water=${page} data-state="forbidden"></sw-state-panel>`;
    if (!customElements.get(def.tag)) return html`<sw-state-panel icon="drop" state="empty" heading=${wt('noScreen')} data-water=${page} data-state="empty"></sw-state-panel>`;
    const tag = unsafeStatic(def.tag);
    return shtml`<${tag} .segments=${(r?.segments ?? []).slice(3)} .params=${r?.params ?? new URLSearchParams()}></${tag}>`;
  }

  render() {
    const a = this.access;
    const page = waterPageOf(this.route?.segments ?? []);
    const def = WATER_PAGES.find((p) => p.id === page)!;
    const on = a.loaded && !a.failed && a.enabled && a.view;
    // the page row: only while the module is on and the viewer may see it (the off panel stands alone); ui.tabs orders and hides it
    const offered = on ? WATER_PAGES.filter((p) => pageAllowed(p, a)) : [];
    const items: TabItem[] = infraPageTabs('infra.water', offered.map((p) => ({ id: p.id, label: p.label, href: `#/infra/water/${p.id}`, ...(p.id === 'alerts' && this.alerts ? { count: this.alerts } : {}) })), isApi());
    // the area row: drawn here only when the navigation would not draw it (a row of one tab)
    const l1 = on && visibleTabs(INFRA_TABS, isApi(), canNav).length < 2 ? html`<sw-tabs .items=${INFRA_TABS.filter((t) => t.id === 'water')} active="water" .variant=${tabStyleOf('infra')} data-infra-l1></sw-tabs>` : nothing;
    const asChip = items.length > 0 && infraPagesAsChip(this.tabsMode.value, items.length);
    this.pagesChip = asChip ? infraPagesChip(wt('pageRow'), items, page, (id) => navigate(`/infra/water/${id}`)) : null;
    const row = asChip || !items.length ? nothing : html`<sw-tabs .items=${items} .active=${page} .variant=${tabStyleOf('infra.water')} data-infra-pages></sw-tabs>`;
    return html`${srHeading(wt('tab'))}<div class="rows lead-head" data-water-shell>${l1}${row}</div><div class="body" data-page=${page}>${this.body(page, def)}</div>`;
  }

  protected updated() {
    if (this.pagesChip) publishPairChip(this, this.pagesChip);
    else clearPairChip(this);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'infra-water': InfraWater;
  }
}
