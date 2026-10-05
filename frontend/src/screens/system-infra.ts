import { LitElement, html, css } from 'lit';
import { html as shtml, unsafeStatic } from 'lit/static-html.js';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-tabs';
import '../components/sw-state-panel';
import type { TabItem } from '../components/sw-tabs';
import type { RouteState } from '../router';
import { energyAccess, onEnergyAccess, type EnergyAccess } from '../electricity/access';
import { generatorAccess } from '../generator/access';
import '../generator/gen-settings'; // CR-031: הגדרות › תשתיות › גנרטור
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

// the sections register themselves (`screens/electricity/settings-*.ts`); see docs/architecture/ELECTRICITY_UI_SHELL.md
import.meta.glob('./electricity/{page,settings}-*.ts', { eager: true });

type Section = 'prices' | 'calendar' | 'business' | 'retention' | 'generator';
interface SectionDef {
  id: Section;
  label: string;
  tag: string;
  allowed: (a: EnergyAccess, g: { manage: boolean }) => boolean;
}

const SECTIONS: SectionDef[] = [
  { id: 'prices', label: 'מחירים ומע״מ', tag: 'elec-settings-prices', allowed: (a) => a.manage },
  // EL5: the holidays and eves of time-of-use tariffs
  { id: 'calendar', label: 'ימים מיוחדים', tag: 'elec-settings-calendar', allowed: (a) => a.manage },
  { id: 'business', label: 'פרטי העסק', tag: 'elec-settings-business', allowed: (a) => a.manage },
  { id: 'retention', label: 'שמירת נתונים', tag: 'elec-settings-retention', allowed: (a) => a.system || a.manage },
  // CR-031 GEN1: the generator's detection, sensor mapping, thresholds and alert routing (generator.manage)
  { id: 'generator', label: 'גנרטור', tag: 'gen-settings', allowed: (_a, g) => g.manage },
];

/**
 * הגדרות › תשתיות › חשמל: three sections - מחירים ומע״מ, פרטי העסק, שמירת נתונים (`#/system/infra/<section>`). This element draws the strip and mounts the
 * section element; the retention section is `elec-settings-retention`, the other two come from the billing UI branch.
 */
@customElement('system-infra')
export class SystemInfra extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private access: EnergyAccess = energyAccess();
  private stop?: () => void;

  static styles = [
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 14px var(--sw-page-pad, 24px) 24px;
        max-inline-size: var(--sw-content-max);
        inline-size: 100%;
        box-sizing: border-box;
      }
      .strip {
        align-self: flex-start;
        max-inline-size: 100%;
      }
    `,
    bubbleChrome,
  ];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onEnergyAccess((a) => (this.access = a));
  }

  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  render() {
    const offered = SECTIONS.filter((s) => s.allowed(this.access, generatorAccess()));
    if (!offered.length) return html`<sw-state-panel state="forbidden" data-elec="settings" data-state="forbidden"></sw-state-panel>`;
    const asked = this.route?.segments[2];
    const cur = offered.find((s) => s.id === asked) ?? offered[0];
    const items: TabItem[] = offered.map((s) => ({ id: s.id, label: s.label, href: `#/system/infra/${s.id}` }));
    const tag = unsafeStatic(cur.tag);
    const body = customElements.get(cur.tag) ? shtml`<${tag} .route=${this.route}></${tag}>` : html`<sw-state-panel state="empty" heading="אין מסך" data-state="empty"></sw-state-panel>`;
    return html`<sw-tabs class="strip" segmented .items=${items} .active=${cur.id} data-infra-settings-tabs></sw-tabs><div data-infra-section=${cur.id}>${body}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-infra': SystemInfra;
  }
}
