import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError, get, patch } from '../api/client';
import { can, isApi } from '../api/session';
import { statusStyles } from '../access-control/status-css';
import { failurePanel, skeletonRows } from '../access-control/status-panel';
import { POLICY_DEFAULT, POLICY_KEYS, policyValue, type PolicyKey } from '../access-control/status-logic';
import { bubbleChrome } from '../styles/bubble-chrome';
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
    css`
      .sw {
        display: flex;
        align-items: center;
        gap: 14px;
        inline-size: 100%;
        min-block-size: max(64px, var(--_t));
        padding: 10px 14px;
        box-sizing: border-box;
        border: 0;
        border-block-start: 1px solid var(--sw-border);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }
      .sw:disabled {
        cursor: default;
        opacity: var(--sw-disabled-opacity);
      }
      .sw:not(:disabled):hover {
        background: var(--sw-hover-wash);
      }
      .sw:focus-visible {
        outline-offset: -2px;
      }
      .sw .txt {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sw .t {
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading);
      }
      .sw .x {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .track {
        flex: none;
        position: relative;
        inline-size: 42px;
        block-size: 24px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-border-strong);
        transition: background var(--sw-t-fast) var(--sw-ease);
      }
      .track::after {
        content: '';
        position: absolute;
        inset-block-start: 3px;
        inset-inline-start: 3px;
        inline-size: 18px;
        block-size: 18px;
        border-radius: 50%;
        background: var(--sw-toggle-thumb);
        box-shadow: var(--sw-shadow-1);
        transition: transform var(--sw-t-fast) var(--sw-ease);
      }
      .sw[aria-checked='true'] .track {
        background: var(--sw-toggle-on);
      }
      .sw[aria-checked='true'] .track::after {
        transform: translateX(-18px);
      }
      :host-context([dir='ltr']) .sw[aria-checked='true'] .track::after {
        transform: translateX(18px);
      }
      @media (prefers-reduced-motion: reduce) {
        .track,
        .track::after {
          transition: none;
        }
      }
    `,
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
            <span class="txt"><span class="t">${st(WORDS[key].title)}</span><span class="x">${st(WORDS[key].text)}</span></span>
            <span class="track" aria-hidden="true"></span>
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
