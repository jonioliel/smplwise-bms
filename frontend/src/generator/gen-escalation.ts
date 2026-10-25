import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-icon';
import { elecCss } from '../electricity/styles';
import { genCss } from './gen-styles';
import { GESC_BODY, gesc } from '../i18n/generator-escalation';

/**
 * הגדרות › תשתיות › גנרטור › ניתוב התראות › "איך התראה קריטית מסלימה" (GENELEV-295): a read-only, collapsed-by-default explainer of what the escalation
 * does as BUILT - who gets an alert, when an unacknowledged critical alert goes on to the escalation recipients, what stops it and where each value is edited.
 * It states facts only (the critical delay is the live value passed in); it has no controls, calls no API and lives in Settings, never on an operator screen.
 */
@customElement('gen-escalation')
export class GenEscalation extends LitElement {
  /** The generator's critical escalation delay in minutes (`critical_escalate_after_min` of the routing response). */
  @property({ type: Number }) minutes = 5;

  static styles = [elecCss, genCss, css`
    :host { display: block; }
    details { border: 1px solid var(--sw-border); border-radius: 14px; padding: 10px 14px; background: var(--sw-surface, transparent); }
    summary { display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 600; min-block-size: var(--elec-touch, 32px); }
    summary small { font-weight: 400; color: var(--sw-text-2); }
    ol { margin: 8px 0 0; padding-inline-start: 22px; display: grid; gap: 8px; color: var(--sw-text-2); line-height: 1.5; }
    li:last-child { font-size: var(--sw-fs-sm); }
  `];

  render() {
    const vars = { n: this.minutes };
    return html`<details data-gen-escalation>
      <summary><sw-icon name="info" size="18"></sw-icon><span>${gesc('title')}</span><small>${gesc('sub')}</small></summary>
      <ol>${GESC_BODY.map((k) => html`<li data-esc=${k}>${gesc(k, vars)}</li>`)}</ol>
    </details>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gen-escalation': GenEscalation;
  }
}
