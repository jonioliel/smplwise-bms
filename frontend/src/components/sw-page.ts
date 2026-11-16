import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import './sw-button';
import { t } from '../i18n/he';
import { navigate } from '../router';

/** Page frame as on the boards: optional breadcrumb, 18px title, grey one-line subtitle, actions on the end side.
 * `backHref` (owner round 4, 1.11/2.6): a drill-down screen reached by clicking into something (a camera, an
 * event, an editor) has no way back except the browser's own back button - invisible in most mobile/kiosk/HA
 * Ingress contexts. Setting it (a bare router path, e.g. "/live/wall", no leading "#") renders an explicit,
 * always-visible back control before the heading.
 *
 * AUDIT30-B2-PAGE-ACTION (design audit round 30, finding 8; owner gate Q5, option א): slot `primary` - the ONE primary action of the
 * screen ("חדש", "קריאה חדשה"). 768 px and up it sits in the header row at the end of the actions; up to 767 px it floats as one
 * action above the bottom navigation (52 px pill with its label, or a 52 px circle for an icon-only button, --sw-shadow-3, a 0.97
 * press in --sw-t-fast, no hover lift). Empty slot = nothing rendered; the `actions` slot is unchanged.
 *   <sw-page heading="יומנים"><sw-button slot="primary" variant="primary" icon="plus" label="חדש"></sw-button> ...</sw-page> */
@customElement('sw-page')
export class SwPage extends LitElement {
  @property() heading = '';
  @property() subheading = '';
  @property() crumbs = '';
  @property() backHref = '';
  @property({ type: Boolean, reflect: true }) wide = false;
  @property({ type: Boolean, reflect: true }) flush = false;

  /** AUDIT30-B2: the host carries `has-primary` while the primary slot holds an element (the phone keeps room for the floating action). */
  private onPrimarySlot = (e: Event) => {
    const has = (e.target as HTMLSlotElement).assignedElements().some((el) => !el.hasAttribute('hidden'));
    this.toggleAttribute('has-primary', has);
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      padding: 14px var(--sw-page-pad) 24px;
      max-inline-size: var(--sw-content-max);
      inline-size: 100%;
      box-sizing: border-box;
      gap: 14px;
    }
    :host([wide]) {
      max-inline-size: none;
    }
    :host([flush]) {
      padding: 0;
      gap: 0;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 10px 12px;
      /* the shell's floating search / status corner (sw-app, no top bar) sits over the far end of the first row when
         nothing else is above the page; the shell sets this only then (0 elsewhere) */
      padding-inline-end: var(--sw-float-reserve, 0px);
      /* header dropdown placement 4 (shell): the chip sits at the start edge of this row */
      padding-inline-start: var(--sw-lead-reserve, 0px);
    }
    :host([flush]) header {
      padding: 12px 16px 0;
      padding-inline-end: calc(16px + var(--sw-float-reserve, 0px));
      padding-inline-start: calc(16px + var(--sw-lead-reserve, 0px));
    }
    /* the title block may shrink below its content: a scrolling chip row in the crumbs slot (the area page on a phone) otherwise
       widened the block to the whole row and dragged the page sideways */
    .head {
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    .titlebar {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .back {
      flex: none;
      margin-inline-start: -6px;
    }
    .crumbs {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-end: 4px;
    }
    .crumbs sw-icon {
      color: var(--sw-border-strong);
    }
    h1 {
      margin: 0;
      font-family: var(--sw-font-heading, var(--sw-font));
      font-size: var(--sw-h1, var(--sw-fs-2xl));
      font-weight: var(--sw-h1-weight, var(--sw-fw-semibold));
      line-height: 1.2;
      letter-spacing: var(--sw-h1-tracking, -0.01em);
      color: var(--sw-heading, var(--sw-text));
    }
    .sub {
      margin-block-start: 2px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    /* ---- AUDIT30-B2-PAGE-ACTION (finding 8, Q5 = א): the primary action ---- */
    .primary {
      display: none;
      align-items: center;
    }
    :host([has-primary]) .primary {
      display: flex;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-block-size: 0;
      flex: 1;
    }
    @media (max-width: 767px) {
      :host {
        padding: 12px 12px 16px;
      }
      /* the floating action: above the bottom navigation and the home indicator, at the end side, below drawers and dialogs */
      :host([has-primary]) .primary {
        position: fixed;
        inset-block-end: calc(var(--sw-bottomnav-h) + 12px + env(safe-area-inset-bottom));
        inset-inline-end: 14px;
        z-index: calc(var(--sw-z-drawer) - 1);
        border-radius: var(--sw-r-pill);
        box-shadow: var(--sw-shadow-3);
        transition: transform var(--sw-t-fast) var(--sw-ease);
        -webkit-tap-highlight-color: transparent;
      }
      :host([has-primary]) .primary:active {
        transform: scale(0.97);
      }
      /* the slotted key becomes the 52 px pill (or circle when icon-only): its own size / radius tokens, scoped to it */
      ::slotted([slot='primary']) {
        --sw-ctl-h-sm: 52px;
        --sw-ctl-h-md: 52px;
        --sw-ctl-h-lg: 52px;
        --sw-r-xs: var(--sw-r-pill);
        --sw-r-sm: var(--sw-r-pill);
        --sw-fs-sm: var(--sw-fs-md);
        --sw-fs-xs: var(--sw-fs-md);
        --sw-hover-lift: 0px;
      }
      /* the last row of the page stays reachable above the floating action */
      :host([has-primary]) .body {
        padding-block-end: calc(52px + 12px);
      }
      h1 {
        font-size: var(--sw-h1-phone, var(--sw-fs-xl));
      }
    }
  `;

  render() {
    const crumbs = this.crumbs ? this.crumbs.split('|').map((c) => c.trim()) : [];
    return html`
      <header>
        <div class="head">
          ${crumbs.length ? html`<div class="crumbs">${crumbs.map((c, i) => html`${i ? html`<sw-icon name="chevron" size=${11}></sw-icon>` : ''}<span>${c}</span>`)}</div>` : ''}
          <slot name="crumbs"></slot>
          ${this.heading || this.backHref
            ? html`<div class="titlebar">
                ${this.backHref ? html`<sw-button class="back" data-page-back variant="ghost" size="sm" iconOnly icon="chevronBack" label=${t('actions.back')} @click=${() => navigate(this.backHref)}></sw-button>` : ''}
                <h1>${this.heading}</h1>
              </div>`
            : ''}
          ${this.subheading ? html`<div class="sub">${this.subheading}</div>` : ''}
        </div>
        <div class="actions"><slot name="actions"></slot><div class="primary" part="primary" data-page-primary><slot name="primary" @slotchange=${this.onPrimarySlot}></slot></div></div>
      </header>
      <div class="body"><slot></slot></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-page': SwPage;
  }
}
