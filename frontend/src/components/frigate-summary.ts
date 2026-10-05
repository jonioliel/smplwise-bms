import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import { FEATURE_ORDER, featureLabel, summaryRows, type FrigateCapabilities } from '../api/frigate';
import { he } from '../i18n/he';

/**
 * NN5-F1B: what a Frigate recorder offers, shown under the connection test (version, cameras, detectors, retention, the features
 * Arx discovered on / off). Data only: no actions. Tokens only, so a designer restyles it without touching the logic.
 */
@customElement('frigate-summary')
export class FrigateSummary extends LitElement {
  @property({ attribute: false }) caps: FrigateCapabilities | null = null;

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
    const c = this.caps;
    if (!c) return nothing;
    const s = he.frigate.summary;
    const known = FEATURE_ORDER.filter((f) => f in c.features || ['review_items', 'object_events', 'timeline', 'search_text', 'snapshots'].includes(f));
    return html`<div class="box" data-frigate-summary>
      <h4>${s.title}</h4>
      <dl>
        ${summaryRows(c).map((r) => html`<dt>${r.label}</dt><dd data-frigate-row=${r.key} class=${r.key === 'version' ? 'ltr' : ''}>${r.value}</dd>`)}
      </dl>
      <div>
        <h4>${s.features}</h4>
        <ul class="feats" data-frigate-features>
          ${known.map((f) => {
            const on = c.features[f] === true;
            return html`<li class="feat" data-feature=${f} data-on=${String(on)} aria-label=${`${featureLabel(f)}: ${on ? s.on : s.off}`}><sw-icon name=${on ? 'check' : 'close'} size="12"></sw-icon>${featureLabel(f)}</li>`;
          })}
        </ul>
      </div>
      <div class="note" data-frigate-readonly><sw-icon name="info" size="14"></sw-icon><span>${s.readOnly}${c.restream ? '' : ` ${s.stillOnly}`}</span></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-summary': FrigateSummary;
  }
}
