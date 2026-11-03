import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-state-panel';
import './installer-clock';
import { settingsStyles } from '../styles/settings';
import { ApiError } from '../api/client';
import { getOverview, type InstallerOverview, type ToolName } from '../api/installer';
import { installerText as T } from '../i18n/wiskey-installer';

/** The tools of the area, in the order an installer meets them. A tool that is not built yet in this release is not listed. */
export const INSTALLER_TOOLS: readonly ToolName[] = ['clock'];
export const INSTALLER_HREF = '#/system/intercom-installer';

/**
 * WISKEY-INSTALLER-NATIVE-2400 (owner decision 03.11, Q7 "ג"): הגדרות › התקנה ותחזוקת מערכת האינטרקום - WisKey's installer tools,
 * natively in Arx: `#/system/intercom-installer/<tool>`. One tab per tool (the strip scrolls sideways on a phone); each tool is its own
 * element and loads only when shown. system.configure at the installation (the server checks every call; a 403 here shows the
 * forbidden state). The overview says which tools this WisKey offers - one it does not list is shown as unavailable, never guessed.
 */
@customElement('system-intercom-installer')
export class SystemIntercomInstaller extends LitElement {
  @property() view = '';
  @state() private overview: InstallerOverview | null = null;
  @state() private loadState: 'loading' | 'ready' | 'forbidden' | 'error' = 'loading';
  @state() private loadError = '';

  static styles = [
    settingsStyles,
    css`
      :host {
        display: block;
      }
      nav.tabs {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        scrollbar-width: none;
        margin-block-end: 16px;
        border-block-end: 1px solid var(--sw-border);
      }
      nav.tabs::-webkit-scrollbar {
        display: none;
      }
      nav.tabs a {
        flex: none;
        padding: 10px 14px;
        color: var(--sw-text-2);
        text-decoration: none;
        font-weight: var(--sw-fw-medium);
        border-block-end: 2px solid transparent;
        margin-block-end: -1px;
        white-space: nowrap;
      }
      nav.tabs a[aria-current='page'] {
        color: var(--sw-accent-text);
        border-block-end-color: var(--sw-accent);
      }
      nav.tabs a:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: -2px;
      }
      @media (hover: hover) and (pointer: fine) {
        nav.tabs a:hover {
          color: var(--sw-text);
        }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loadState = 'loading';
    try {
      this.overview = await getOverview();
      this.loadState = 'ready';
    } catch (err) {
      this.loadState = err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error';
      this.loadError = err instanceof ApiError ? err.body.user_message : String(err);
    }
  }

  private get tool(): ToolName {
    return (INSTALLER_TOOLS as readonly string[]).includes(this.view) ? (this.view as ToolName) : INSTALLER_TOOLS[0];
  }

  private body(tool: ToolName): TemplateResult {
    const facts = this.overview?.tools[tool];
    if (facts && facts.available === false) {
      return html`<sw-state-panel state="empty" heading=${T.unavailableTool} hint=${facts.missing.join(', ')} data-tool-unavailable></sw-state-panel>`;
    }
    const unknown = facts && facts.available === null ? html`<div class="msg warn" role="status">${T.unknownTool}</div>` : nothing;
    if (tool === 'clock') return html`${unknown}<installer-clock></installer-clock>`;
    return html``;
  }

  render(): TemplateResult {
    const page = (inner: TemplateResult, state: string) =>
      html`<sw-page crumbs="הגדרות" heading=${T.title} subheading=${T.sub} data-installer data-state=${state}>${inner}</sw-page>`;
    if (this.loadState === 'loading') return page(html`<sw-state-panel state="loading" heading=${T.loading}></sw-state-panel>`, 'loading');
    if (this.loadState === 'forbidden') return page(html`<sw-state-panel state="forbidden" heading=${T.forbiddenTitle} hint=${T.forbiddenHint}></sw-state-panel>`, 'forbidden');
    if (this.loadState === 'error') {
      return page(html`<sw-state-panel state="error" heading=${T.errorTitle} hint=${this.loadError} actionLabel=${T.retry} @action=${() => void this.load()}></sw-state-panel>`, 'error');
    }
    const tool = this.tool;
    return page(
      html`<nav class="tabs" aria-label=${T.title}>
          ${INSTALLER_TOOLS.map((t) => html`<a href="${INSTALLER_HREF}/${t}" aria-current=${t === tool ? 'page' : 'false'} data-installer-tab=${t}>${T.tabs[t]}</a>`)}
        </nav>
        <div data-installer-tool=${tool}>${this.body(tool)}</div>`,
      'ready',
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-intercom-installer': SystemIntercomInstaller;
  }
}
