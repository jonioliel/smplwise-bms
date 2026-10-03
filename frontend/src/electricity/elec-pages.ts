/**
 * CR-023: the page elements the shell mounts (docs/architecture/ELECTRICITY_UI_SHELL.md): <elec-accounts-page> (the list, the wizard,
 * one account with its history and bills tabs, the edit mode) and <elec-bills-page> (the list, one bill). The shell sets `.segments`
 * (the route segments after the page name) and `.params`; <elec-customers-page> lives in elec-customers.ts, the settings sections
 * in elec-settings.ts.
 */
import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ElecBase } from './elec-ui';
import './elec-account-list';
import './elec-account-page';
import './elec-wizard';
import './elec-bills-list';
import './elec-bill-page';
import './elec-customers';
import './elec-settings';

@customElement('elec-accounts-page')
export class ElecAccountsPage extends ElecBase {
  @property({ attribute: false }) segments: string[] = [];
  @property({ attribute: false }) params: URLSearchParams = new URLSearchParams();

  render() {
    const [a, b] = this.segments;
    if (!a) return html`<elec-accounts-list></elec-accounts-list>`;
    if (a === 'new') return html`<elec-account-wizard></elec-account-wizard>`;
    if (b === 'edit') return html`<elec-account-wizard .accountId=${a}></elec-account-wizard>`;
    const tab = b === 'history' || b === 'bills' ? b : 'status';
    return html`<elec-account-page .accountId=${a} .tab=${tab}></elec-account-page>`;
  }
}

@customElement('elec-bills-page')
export class ElecBillsPage extends ElecBase {
  @property({ attribute: false }) segments: string[] = [];
  @property({ attribute: false }) params: URLSearchParams = new URLSearchParams();

  render() {
    const [id] = this.segments;
    return id ? html`<elec-bill-page .billId=${id}></elec-bill-page>` : html`<elec-bills-list></elec-bills-list>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elec-accounts-page': ElecAccountsPage;
    'elec-bills-page': ElecBillsPage;
  }
}
