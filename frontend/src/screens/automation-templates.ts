import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { automations, automationErrorText, type AutomationTemplate } from '../api/automations';
import { icon } from './automation-builder-icons';
import { editorShared } from './automation-editor-css';

const TEMPLATE_ICON: Record<string, string> = { motion: 'motion', door: 'door', users: 'users', sunset: 'sunset', drop: 'drop', sun: 'sun', clock: 'clock' };

/**
 * CR-017 S4: the templates gallery of a new automation (CR §4.2.4; mockup 30-31): "מאפס" first, then the server's templates
 * (`GET /automations/templates`: the administrator hides or re-orders them in הגדרות › אוטומציות). A template is a pre-filled draft with
 * the pickers left empty; nothing is saved without review.
 *
 *   template-pick {template: AutomationTemplate | null}   null = from scratch
 */
@customElement('automation-templates')
export class AutomationTemplates extends LitElement {
  @property({ type: Boolean }) enabled = true;
  @state() private rows: AutomationTemplate[] = [];
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';

  static styles = [
    editorShared,
    css`
      :host {
        display: block;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .tpl {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: flex-start;
        text-align: start;
        padding: 14px 14px 12px;
        min-block-size: 132px;
        border-radius: var(--dv-radius-md, 20px);
        border: 1px solid var(--dv-border);
        background: var(--dv-surface-2);
        color: var(--dv-text);
        box-shadow: var(--dv-shadow-1);
        transition: transform var(--ab-motion, 200ms), box-shadow var(--ab-motion, 200ms);
      }
      .tpl:hover {
        box-shadow: var(--dv-shadow-2);
      }
      .tpl.blank {
        border-style: dashed;
        border-color: var(--dv-border-strong);
        background: transparent;
        align-items: center;
        justify-content: center;
        text-align: center;
      }
      .tile {
        display: grid;
        place-items: center;
        inline-size: 40px;
        block-size: 40px;
        border-radius: var(--sw-r-md);
        background: var(--dv-accent-soft);
        color: var(--dv-accent-text);
        font-size: var(--sw-fs-2xl);
      }
      .blank .tile {
        background: var(--dv-surface-3);
        color: var(--dv-text-2);
        border-radius: 50%;
      }
      .tpl b {
        font-size: var(--sw-fs-md);
        font-weight: 700;
      }
      .tpl small {
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-2);
        line-height: 1.4;
      }
      .tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-block-start: auto;
      }
      .state {
        padding: 40px 12px;
        text-align: center;
        color: var(--dv-text-2);
        font-weight: 600;
      }
      .state.err {
        color: var(--dv-danger);
      }
      @media (max-width: 767px) {
        .grid {
          grid-template-columns: 1fr;
        }
        .tpl {
          min-block-size: 96px;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    this.phase = 'loading';
    try {
      this.rows = this.enabled ? (await automations().templates()).templates : [];
      this.phase = 'ready';
    } catch (e) {
      this.error = automationErrorText(e);
      this.phase = 'error';
    }
  }

  private pick(template: AutomationTemplate | null) {
    this.dispatchEvent(new CustomEvent('template-pick', { detail: { template }, bubbles: true, composed: true }));
  }

  render() {
    if (this.phase === 'loading') return html`<div class="state" data-templates-state="loading">טוען…</div>`;
    if (this.phase === 'error') return html`<div class="state err" data-templates-state="error">${this.error}</div>`;
    return html`<div class="grid" data-templates>
      <button class="tpl blank" type="button" data-template="blank" @click=${() => this.pick(null)}>
        <span class="tile">${icon('plus')}</span><b>מאפס</b><small>כאשר · אם · אז</small>
      </button>
      ${this.rows.map((t) => html`<button class="tpl" type="button" data-template=${t.id} @click=${() => this.pick(t)}>
        <span class="tile">${icon(TEMPLATE_ICON[t.icon] ?? 'template')}</span><b>${t.name}</b><small>${t.description}</small>
        ${t.sensitive || t.suggest_schedule ? html`<span class="tags">${t.sensitive ? html`<span class="tag sens">${icon('alarm')}רגיש כברירת מחדל</span>` : nothing}${t.suggest_schedule ? html`<span class="tag acc">${icon('calendar')}גם כתזמון</span>` : nothing}</span>` : nothing}
      </button>`)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'automation-templates': AutomationTemplates;
  }
}
