import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError, get, patch } from '../api/client';
import { can, isApi } from '../api/session';
import { statusStyles } from '../access-control/status-css';
import { policySwitchStyles, switchBody } from '../messaging/policy-switch';
import { failurePanel, skeletonRows } from '../access-control/status-panel';
import { POLICY_DEFAULT, POLICY_KEYS, policyValue, type PolicyKey } from '../access-control/status-logic';
import { bubbleChrome } from '../styles/bubble-chrome';
import { accessPanelPolish } from './system-access-polish-css';
import { st, type StKey } from '../i18n/access-status';

interface SettingsReply {
  settings: Record<string, unknown>;
  can_edit: boolean;
}

const WORDS: Record<PolicyKey, { title: StKey; text: StKey }> = {
  'access.event_portrait_audit': { title: 'pol_event_portrait_audit', text: 'pol_event_portrait_audit_text' },
  'access.event_portrait_sensitive': { title: 'pol_event_portrait_sensitive', text: 'pol_event_portrait_sensitive_text' },
  'access.employee_no_sensitive': { title: 'pol_employee_no_sensitive', text: 'pol_employee_no_sensitive_text' },
  'access.sync_errors_everyone': { title: 'pol_sync_errors_everyone', text: 'pol_sync_errors_everyone_text' },
};

/**
 * CR-036 S10: "מדיניות" - the fourth segment of the Settings page "בקרת כניסה": the four administrator settings the owner's answers of
 * 2026-10-12 left open (who sees the event picture and whether each view is logged, whether the employee number is a sensitive field,
 * whether sync error texts are for everyone). The access-control reads obey them on the server (services/intercom_authority.py); this
 * page only shows and sets them - `GET /settings` and `PATCH /settings`, `system.configure` at installation scope, one setting at a
 * time, saved at once. A value the server cannot read is shown as the SAFE choice it acts on (fail closed). A failed save puts the
 * switch back and says so.
 */
@customElement('system-access-policy')
export class SystemAccessPolicy extends LitElement {
  /** The page's refresh counter: a change reads the settings again. */
  @property({ type: Number }) rev = 0;
  @state() private values: Record<PolicyKey, boolean> | null = null;
  @state() private canEdit = false;
  @state() private busy = '';
  @state() private error = '';
  @state() private failed = '';
  @state() private loading = true;
  private lastRev = 0;
  private gen = 0;

  static styles = [
    statusStyles,
    policySwitchStyles,
    accessPanelPolish,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    this.gen += 1;
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('rev') && this.rev !== this.lastRev) {
      this.lastRev = this.rev;
      void this.load();
    }
  }

  private async load(): Promise<void> {
    const gen = ++this.gen;
    this.failed = '';
    try {
      const r = await get<SettingsReply>('settings');
      if (gen !== this.gen) return;
      this.values = this.read(r.settings);
      this.canEdit = !!r.can_edit && (!isApi() || can('system.configure'));
    } catch (err) {
      if (gen !== this.gen) return;
      this.failed = describeError(err);
    } finally {
      if (gen === this.gen) this.loading = false;
    }
  }

  private read(settings: Record<string, unknown>): Record<PolicyKey, boolean> {
    return Object.fromEntries(POLICY_KEYS.map((k) => [k, policyValue(settings, k)])) as Record<PolicyKey, boolean>;
  }

  private async flip(key: PolicyKey): Promise<void> {
    if (!this.values || !this.canEdit || this.busy) return;
    const next = !this.values[key];
    this.busy = key;
    this.error = '';
    try {
      const r = await patch<SettingsReply>('settings', { [key]: String(next) });
      this.values = this.read(r.settings);
    } catch (err) {
      this.error = `${st('policySaveFailed')} · ${describeError(err)}`;
    } finally {
      this.busy = '';
    }
  }

  render() {
    if (this.loading) return html`<div class="stack" data-access-status="loading"><sw-card flush>${skeletonRows(4)}</sw-card></div>`;
    if (!this.values) return html`<div class="stack" data-access-status="error">${failurePanel('error', this.failed, () => void this.load())}</div>`;
    const v = this.values;
    return html`<div class="stack" data-access-status="ready">
      <sw-card flush data-access-card="policy">
        <div class="ch"><div><h3>${st('policyTitle')}</h3><div class="sub">${this.canEdit ? st('policySub') : st('policyNote')}</div></div></div>
        ${POLICY_KEYS.map(
          (key) => html`<button type="button" class="sw" role="switch" aria-checked=${String(v[key])} data-access-policy=${key} data-default=${String(POLICY_DEFAULT[key])} ?disabled=${!this.canEdit || !!this.busy} @click=${() => void this.flip(key)}>
            ${switchBody(st(WORDS[key].title), st(WORDS[key].text))}
          </button>`,
        )}
        ${this.error ? html`<div class="note err" role="alert" data-access-policy-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>` : nothing}
      </sw-card>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-access-policy': SystemAccessPolicy;
  }
}
