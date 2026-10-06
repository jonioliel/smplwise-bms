import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import { FEATURE_CORE, FEATURE_ORDER, featureLabel, recorderCapabilities, summaryRows, type FrigateCapabilities } from '../api/frigate';
import { anyWriteOn, getPolicy } from '../api/frigate-control';
import { he } from '../i18n/he';

/**
 * NN5-F1B: what a Frigate recorder offers (version, cameras, detectors, retention, the features Arx discovered on / off). Data only: no
 * actions. Either `caps` is given (the connection test: the server then knows only the version and the camera count, so the rest is
 * announced as coming after the save) or `recorderId` names a saved recorder and the card reads its status itself.
 * Tokens only, so a designer restyles it without touching the logic.
 */
@customElement('frigate-summary')
export class FrigateSummary extends LitElement {
  @property({ attribute: false }) caps: FrigateCapabilities | null = null;
  @property({ attribute: 'recorder-id' }) recorderId = '';
  @state() private loaded: FrigateCapabilities | null = null;
  @state() private failed = false;
  /** F2: some write class is on for this recorder, so "read only" would be untrue (the policy is read best-effort; no permission = unchanged text) */
  @state() private writesOn = false;
  private onPolicy = (e: Event) => {
    this.writesOn = (e as CustomEvent<{ anyOn: boolean }>).detail.anyOn;
  };

  connectedCallback() {
    super.connectedCallback();
    if (this.recorderId && !this.caps) void this.load();
    document.addEventListener('frigate-control-policy', this.onPolicy);
    if (this.recorderId && !this.caps) void getPolicy(this.recorderId).then((p) => (this.writesOn = anyWriteOn(p))).catch(() => undefined);
  }

  disconnectedCallback() {
    document.removeEventListener('frigate-control-policy', this.onPolicy);
    super.disconnectedCallback();
  }

  private async load() {
    try {
      this.loaded = await recorderCapabilities(this.recorderId);
      this.failed = false;
    } catch {
      this.failed = true;
    }
  }

  static styles = css`
    :host {
      display: block;
    }
    .box {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      padding: var(--sw-s-3);
      display: grid;
      gap: var(--sw-s-3);
      font-size: var(--sw-fs-sm);
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    dl {
      margin: 0;
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: var(--sw-s-1) var(--sw-s-3);
    }
    dt {
      color: var(--sw-text-2);
    }
    dd {
      margin: 0;
      color: var(--sw-text);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    dd.ltr {
      direction: ltr;
      text-align: start;
    }
    .feats {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-1h);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .feat {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px var(--sw-s-2);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .feat[data-on='true'] {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .note {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      display: flex;
      gap: var(--sw-s-1h);
      align-items: flex-start;
    }
    .note sw-icon {
      flex: none;
      margin-block-start: 1px;
    }
  `;

  render() {
    const c = this.caps ?? this.loaded;
    const s = he.frigate.summary;
    if (!c) return this.failed ? html`<div class="note" data-frigate-summary-failed><sw-icon name="info" size="14"></sw-icon><span>${s.unavailable}</span></div>` : nothing;
    const feats = c.features;
    const known = feats ? FEATURE_ORDER.filter((f) => FEATURE_CORE.includes(f) || f in feats) : [];
    return html`<div class="box" data-frigate-summary>
      <h4>${s.title}</h4>
      <dl>
        ${summaryRows(c).map((r) => html`<dt>${r.label}</dt><dd data-frigate-row=${r.key} class=${r.key === 'version' ? 'ltr' : ''}>${r.value}</dd>`)}
      </dl>
      ${feats ? html`<div>
        <h4>${s.features}</h4>
        <ul class="feats" data-frigate-features>
          ${known.map((f) => {
            const on = feats![f] === true;
            return html`<li class="feat" data-feature=${f} data-on=${String(on)} aria-label=${`${featureLabel(f)}: ${on ? s.on : s.off}`}><sw-icon name=${on ? 'check' : 'close'} size="12"></sw-icon>${featureLabel(f)}</li>`;
          })}
        </ul>
      </div>` : html`<div class="note" data-frigate-more-after-save><sw-icon name="info" size="14"></sw-icon><span>${s.moreAfterSave}</span></div>`}
      <div class="note" data-frigate-readonly><sw-icon name="info" size="14"></sw-icon><span>${this.writesOn ? he.frigate.control.settings.summaryWrites : s.readOnly}${c.restream ? '' : ` ${s.stillOnly}`}</span></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-summary': FrigateSummary;
  }
}
