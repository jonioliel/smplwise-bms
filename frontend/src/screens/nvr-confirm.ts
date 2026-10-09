import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-dialog';
import '../components/sw-button';
import type { ConfirmModel } from './nvr-cameras-edit';

/**
 * CR-020 S2: the ONE confirmation of every stream change (owner Q3 = A): the heading, one line naming the camera and the stream,
 * the number of changes and two buttons; the field-by-field list is collapsed under "פרטים". Renders only text (device strings
 * such as the codec or the profile are values, never markup). It sits inside the editor drawer when that is open (a modal drawer
 * makes everything outside its top layer inert) and at the screen level for the SVC toggle.
 * Events: `confirm`, `cancel` (also for Escape / the backdrop / the X).
 */
@customElement('nvr-confirm')
export class NvrConfirm extends LitElement {
  @property({ attribute: false }) model: ConfirmModel | null = null;

  static styles = css`
    :host {
      display: contents;
    }
    p {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .count {
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
    }
    details {
      font-size: var(--sw-fs-sm);
    }
    summary {
      cursor: pointer;
      color: var(--sw-accent-text);
      min-block-size: 32px;
      display: flex;
      align-items: center;
    }
    summary:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
      border-radius: var(--sw-r-2xs);
    }
    ul {
      list-style: none;
      margin: 4px 0 0;
      padding: 0;
      display: grid;
      gap: 4px;
    }
    .extra {
      display: flex;
      justify-content: flex-start;
    }
    /* a multi-camera change lists every camera: hundreds scroll inside the list, the dialog keeps its size */
    ul.names {
      max-block-size: min(36dvh, 240px);
      overflow: auto;
      overscroll-behavior: contain;
    }
    ul.names li {
      display: block;
      overflow-wrap: anywhere;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: baseline;
    }
    li .k {
      color: var(--sw-text-3);
    }
    bdi {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .arrow {
      color: var(--sw-text-3);
    }
  `;

  private cancel = () => this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));

  render() {
    const m = this.model;
    return html`<sw-dialog ?open=${!!m} heading=${m?.heading ?? ''} data-nvr-confirm-dialog @close=${(e: Event) => {
      e.stopPropagation();
      this.cancel();
    }}>
      ${m
        ? html`<p data-nvr-confirm-lead>${m.lead}</p>
            <p class="count" data-nvr-confirm-count>${m.count}</p>
            <details data-nvr-confirm-details>
              <summary>פרטים</summary>
              ${m.names
                ? html`<ul class="names" data-nvr-confirm-names tabindex="0" aria-label="המצלמות">${m.names.map((n) => html`<li>${n}</li>`)}</ul>`
                : html`<ul>${m.details.map((d) => html`<li data-field=${d.field}><span class="k">${d.label}</span><bdi>${d.from}</bdi><span class="arrow" aria-hidden="true">←</span><bdi>${d.to}</bdi></li>`)}</ul>`}
            </details>
            ${m.extraLabel
              ? html`<div class="extra"><sw-button variant="ghost" size="sm" data-nvr-extra @click=${() => this.dispatchEvent(new CustomEvent('extra', { bubbles: true, composed: true }))}>${m.extraLabel}</sw-button></div>`
              : nothing}
            <sw-button slot="footer" variant="ghost" data-nvr-cancel @click=${this.cancel}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-nvr-confirm @click=${() => this.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true }))}>${m.confirmLabel}</sw-button>`
        : nothing}
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nvr-confirm': NvrConfirm;
  }
}
