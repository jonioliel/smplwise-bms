import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { aIcon } from './automation-icons';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bidi } from '../i18n/bidi';
import { areaLine, cardChips, floorLine, runLine } from '../screens/automations-logic';
import type { Item } from '../api/automations';
import type { CardAction } from './sw-automation-card';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

/**
 * POLISH-295 `<automation-row .item .href>` (owner approval 2026-10-25, the approved preview COCKPIT_AUTOMATIONS_HE): one automation as a
 * 52 px row instead of a card - the switch, the name and where, its sentence on ONE line with a bolt, the last run, and the "⋯" menu.
 * Only a real fault keeps a chip on the row (a missing device, an invalid automation); sensitive, view-only and locked parts live in the
 * detail drawer. The whole row is the link into the drawer. Events (bubble, composed): `toggle` {item, enabled}, `action` {item, action}
 * - the same as `<automation-card>`; the row changes nothing by itself.
 */
@customElement('automation-row')
export class AutomationRow extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) item!: Item;
  @property() href = '';
  @property({ attribute: false }) now: Date = new Date();
  @property({ type: Boolean }) busy = false;
  @state() private menu = false;

  static styles = [bubbleChrome, ...automationsStyles, css`
    /* R5-DEVICES-297: a row is a well (one tone step down, rounded, no hairline) inside the glass list; the name is a heading; an
       automation that is off sits a step deeper; the row sinks on pointer-down (the skin's press scale), hover for a fine pointer only */
    :host {
      display: block;
      position: relative;
      min-inline-size: 0;
      margin: 2px 6px;
    }
    :host(:first-of-type) {
      margin-block-start: 6px;
    }
    :host(:last-of-type) {
      margin-block-end: 6px;
    }
    :host([data-menu]) {
      z-index: 20;
    }
    .ar {
      position: relative;
      display: grid;
      grid-template-columns: 44px minmax(0, 1.1fr) minmax(0, 1.6fr) minmax(120px, 0.8fr) 40px;
      align-items: center;
      gap: var(--sw-s-3);
      min-block-size: 56px;
      padding-inline: var(--sw-s-4);
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-2);
      transition: background-color var(--mm-motion) var(--mm-ease), transform var(--sw-t-fast, 120ms) var(--sw-ease, ease-out);
    }
    .ar.off {
      background: var(--dv-surface-3);
    }
    .ar:active {
      transform: scale(var(--sw-press-scale, 1));
      background: var(--sw-pressed-wash, var(--dv-surface-3));
    }
    @media (hover: hover) and (pointer: fine) {
      .ar:hover {
        background: var(--dv-surface-3);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ar {
        transition-duration: 0.01ms;
      }
    }
    a.name {
      display: block;
      font-weight: 700;
      font-size: var(--sw-fs-lg);
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.01em;
      text-decoration: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    a.name::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    a.name:focus-visible {
      outline: none;
    }
    a.name:focus-visible::after {
      outline: var(--sw-focus-w) solid var(--dv-focus);
      outline-offset: -2px;
    }
    .who {
      min-inline-size: 0;
    }
    .where {
      display: block;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .where b {
      color: var(--dv-text);
      font-weight: 600;
    }
    .sent {
      display: flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
      font-size: var(--sw-fs-base);
      color: var(--dv-text);
    }
    .sent .ic {
      flex: none;
      color: var(--dv-text-3);
    }
    .sent span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ar.off .name,
    .ar.off .sent {
      color: var(--dv-text-2);
    }
    .ar.off .name {
      font-weight: 600;
    }
    .ar.off .sent {
      opacity: 0.7;
    }
    .run {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-inline-size: 0;
      font-size: var(--sw-fs-base);
      font-weight: 600;
      color: var(--dv-text);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .run.bad {
      color: var(--sw-danger-text);
      font-weight: 700;
    }
    .ctl,
    .ops {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
    }
    .ops {
      justify-content: flex-end;
    }
    .more {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      color: var(--dv-text-2);
    }
    .more:hover,
    .more[aria-expanded='true'] {
      background: var(--dv-surface-3);
      color: var(--dv-text);
    }
    .pop {
      background: var(--sw-menu-surface);
      inset-block-start: 42px;
      inset-inline-end: 0;
      min-inline-size: 190px;
    }
    .pop button.dz,
    .pop button.dz .ic {
      color: var(--dv-danger);
    }
    @media (max-width: 767px) {
      .ar {
        grid-template-columns: 44px minmax(0, 1fr) auto 36px;
        gap: var(--sw-s-2);
        padding-inline: var(--sw-s-3);
        min-block-size: 56px;
      }
      .ar > .sent {
        display: none;
      }
      .run {
        max-inline-size: 34vw;
      }
      .more {
        inline-size: 44px;
        block-size: 44px;
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    window.addEventListener('pointerdown', this.onOutside, true);
    window.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('pointerdown', this.onOutside, true);
    window.removeEventListener('keydown', this.onKey);
  }

  private onOutside = (e: PointerEvent) => {
    if (this.menu && !e.composedPath().includes(this)) this.setMenu(false);
  };
  private onKey = (e: KeyboardEvent) => {
    if (this.menu && e.key === 'Escape') this.setMenu(false);
  };
  private setMenu(on: boolean) {
    this.menu = on;
    this.toggleAttribute('data-menu', on);
  }
  private fire<T>(name: string, detail: T) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
  private act(action: CardAction) {
    this.setMenu(false);
    this.fire('action', { item: this.item, action });
  }

  private menuItems(): TemplateResult {
    const i = this.item;
    const row = (action: CardAction, icon: Parameters<typeof aIcon>[0], label: string, cls = '', show = true) =>
      show ? html`<button type="button" role="menuitem" class=${cls} data-card-action=${action} @click=${() => this.act(action)}>${aIcon(icon)}${label}</button>` : nothing;
    return html`<div class="pop" role="menu" aria-label=${`פעולות · ${i.name}`}>
      ${row('edit', 'edit', 'עריכה', '', i.can.edit)}
      ${row('run', 'play', 'הרץ עכשיו', '', i.can.run)}
      ${row('dryrun', 'flask', 'בדיקה')}
      ${row('trace', 'history', 'ריצות אחרונות', '', !!i.last_run)}
      ${row('versions', 'history', 'גרסאות', '', i.source === 'ui')}
      ${row('copy', 'copy', 'שכפול', '', i.can.copy)}
      ${i.can.delete ? html`<hr />` : nothing}
      ${row('delete', 'trash', 'מחיקה', 'dz', i.can.delete)}
    </div>`;
  }

  render() {
    const i = this.item;
    if (!i) return nothing;
    const run = runLine(i, this.now);
    // a fault is the only chip a row keeps (the rest is in the drawer)
    const fault = cardChips(i).find((c) => c.tone === 'bad');
    const areas = areaLine(i);
    const on = i.state === 'on' || i.state === 'running';
    const canToggle = i.can.toggle && i.state !== 'invalid' && i.state !== 'unavailable';
    const hasMenu = i.can.edit || i.can.run || i.can.copy || i.can.delete || !!i.last_run || i.source === 'ui';
    return html`<div class=${`ar ${on ? 'on' : 'off'}`} role="row" data-automation=${i.id} data-state=${i.state} aria-label=${i.name}>
      <span class="ctl" role="cell">${canToggle
        ? html`<button type="button" class="tog" role="switch" aria-checked=${String(on)} aria-label=${`${on ? 'כיבוי' : 'הפעלה'} · ${i.name}`} data-card-toggle ?disabled=${this.busy} @click=${() => this.fire('toggle', { item: i, enabled: !on })}></button>`
        : nothing}</span>
      <span class="who" role="cell"><a class="name" href=${this.href || '#'} data-card-open>${bidi(i.name)}</a><span class="where"><b>${bidi(floorLine(i))}</b>${areas ? html` · ${bidi(areas)}` : nothing}</span></span>
      <span class="sent" role="cell" data-card-sentence title=${i.sentence}>${i.sentence ? html`${aIcon('bolt')}<span>${i.sentence}</span>` : nothing}</span>
      <span class=${`run${fault || run.tone === 'bad' ? ' bad' : ''}`} role="cell" data-card-run title=${fault ? fault.label : run.title}>${fault ? html`${aIcon('warning')}<span data-chip=${fault.id}>${fault.label}</span>` : html`<i class=${`dot ${run.tone === 'none' ? '' : run.tone}`}></i>${run.text}`}</span>
      <span class="ops" role="cell">${hasMenu ? html`<button type="button" class="more" aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${`עוד · ${i.name}`} data-card-menu @click=${() => this.setMenu(!this.menu)}>${aIcon('dots')}</button>` : nothing}${this.menu ? this.menuItems() : nothing}</span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'automation-row': AutomationRow;
  }
}
