import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { aIcon } from './automation-icons';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bidi } from '../i18n/bidi';
import { areaLine, cardChips, floorLine, runLine } from '../screens/automations-logic';
import type { Item } from '../api/automations';

export type CardAction = 'edit' | 'run' | 'dryrun' | 'trace' | 'versions' | 'copy' | 'delete';

/**
 * CR-017 `<automation-card .item .href .traceHref>`: one automation of the list (mockup `docs/design/mockups/automations/index.html`, always the
 * glass style): its name (a link: the whole card is the target of the link), the floor and areas of what it touches, the toggle (a state chip
 * instead for a caller who may not switch it), the one-line Hebrew sentence, the last run with its count and "למה זה רץ", and the state chips
 * (sensitive, locked parts, missing device, changed outside, view-only). The "..." menu lists what the caller may do with it.
 * Events (all bubble, composed): `toggle` {item, enabled}, `action` {item, action}. The card changes nothing by itself; the screen calls the API.
 */
@customElement('automation-card')
export class AutomationCard extends LitElement {
  @property({ attribute: false }) item!: Item;
  @property() href = '';
  @property() traceHref = '';
  @property({ attribute: false }) now: Date = new Date();
  @property({ type: Boolean }) sensitiveWarning = true;
  @property({ type: Boolean }) busy = false;
  @property({ type: Boolean, reflect: true, attribute: 'data-picked' }) picked = false;
  @state() private menu = false;

  static styles = [...automationsStyles, css`
    :host {
      display: block;
      min-inline-size: 0;
      position: relative;
    }
    :host([data-menu]) {
      z-index: 20;
    }
    .acard {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 18px 14px;
      block-size: 100%;
      box-sizing: border-box;
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border: 1px solid var(--dv-border);
      border-radius: 24px;
      box-shadow: var(--dv-shadow-1);
      transition: box-shadow var(--mm-motion) var(--mm-ease), transform var(--mm-motion) var(--mm-ease), border-color var(--mm-motion);
    }
    .acard:hover {
      box-shadow: var(--dv-shadow-2);
    }
    .acard:focus-within {
      border-color: color-mix(in srgb, var(--dv-accent) 55%, transparent);
      box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
    }
    :host([data-picked]) .acard {
      border-color: var(--dv-accent);
      box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
    }
    .acard.off .sentence-line {
      color: var(--dv-text-2);
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      min-inline-size: 0;
    }
    .ttl {
      flex: 1;
      min-inline-size: 0;
    }
    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.015em;
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    a.name {
      color: inherit;
      text-decoration: none;
    }
    a.name::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
    a.name:focus-visible {
      outline: none;
    }
    .where {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0 8px;
      margin-block-start: 3px;
      font-size: 13.5px;
      color: var(--dv-text-2);
      min-inline-size: 0;
    }
    .where b {
      color: var(--dv-text);
      font-weight: 700;
      white-space: nowrap;
    }
    .where .ic {
      font-size: 14px;
      color: var(--dv-text-3);
    }
    .where .ar {
      min-inline-size: 0;
    }
    .ctl {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 6px;
      flex: none;
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
    .more .ic {
      font-size: 20px;
    }
    .sentence-line {
      margin: 0;
      font-size: 14.5px;
      line-height: 1.55;
      color: var(--dv-text);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-block-size: 3.1em;
    }
    footer {
      position: relative;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin-block-start: auto;
      font-size: 13px;
      color: var(--dv-text-2);
    }
    .run {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-variant-numeric: tabular-nums;
    }
    a.why {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: var(--dv-accent-text);
      font-weight: 600;
      text-decoration: none;
      min-block-size: 32px;
      border-radius: 8px;
    }
    a.why .ic {
      font-size: 15px;
    }
    a.why:hover {
      text-decoration: underline;
    }
    a.why:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
    }
    .chips {
      position: relative;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .pop {
      background: var(--dv-surface-solid, #fff);
      inset-block-start: 52px;
      inset-inline-end: 12px;
      min-inline-size: 190px;
    }
    .pop button.dz {
      color: var(--dv-danger);
    }
    .pop button.dz .ic {
      color: var(--dv-danger);
    }
    @media (pointer: coarse), (max-width: 767px) {
      .more {
        inline-size: 44px;
        block-size: 44px;
      }
      a.why {
        min-block-size: 44px;
      }
    }
    @media (max-width: 767px) {
      .acard {
        padding: 14px 16px 12px;
        border-radius: 22px;
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
      ${row('trace', 'help', 'למה זה רץ', '', !!i.last_run)}
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
    const chips = cardChips(i, { sensitiveWarning: this.sensitiveWarning });
    const areas = areaLine(i);
    const on = i.state === 'on' || i.state === 'running';
    const canToggle = i.can.toggle && i.state !== 'invalid' && i.state !== 'unavailable';
    const hasMenu = i.can.edit || i.can.run || i.can.copy || i.can.delete || !!i.last_run || i.source === 'ui';
    return html`<article class=${`acard ${on ? 'on' : 'off'}`} data-automation=${i.id} data-state=${i.state} aria-label=${i.name}>
      <header>
        <div class="ttl">
          <h3><a class="name" href=${this.href || '#'} data-card-open>${bidi(i.name)}</a></h3>
          <div class="where">${aIcon('layers')}<b>${bidi(floorLine(i))}</b>${areas ? html`<span class="ar">${bidi(areas)}</span>` : nothing}</div>
        </div>
        <div class="ctl">
          ${canToggle
            ? html`<button type="button" class="tog" role="switch" aria-checked=${String(on)} aria-label=${`${on ? 'כיבוי' : 'הפעלה'} · ${i.name}`} data-card-toggle ?disabled=${this.busy} @click=${() => this.fire('toggle', { item: i, enabled: !on })}></button>`
            : i.state === 'invalid' || i.state === 'unavailable' ? nothing
            : html`<span class=${`chip ${on ? 'ok' : ''}`} data-card-state>${on ? 'פעילה' : 'כבויה'}</span>`}
          ${hasMenu ? html`<button type="button" class="more" aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${`עוד · ${i.name}`} data-card-menu @click=${() => this.setMenu(!this.menu)}>${aIcon('dots')}</button>` : nothing}
        </div>
        ${this.menu ? this.menuItems() : nothing}
      </header>
      ${i.sentence ? html`<p class="sentence-line" data-card-sentence>${i.sentence}</p>` : nothing}
      <footer>
        <span class="run" data-card-run title=${run.title}><i class=${`dot ${run.tone === 'none' ? '' : run.tone}`}></i>${run.text}</span>
        ${i.last_run && this.traceHref ? html`<a class="why" href=${this.traceHref} data-card-why>${aIcon('help')}למה זה רץ</a>` : nothing}
      </footer>
      ${chips.length ? html`<div class="chips" data-card-chips>${chips.map((c) => html`<span class=${`chip ${c.id === 'sensitive' ? 'sens' : c.tone === 'bad' ? 'bad' : c.tone === 'warn' ? 'warn' : c.tone === 'info' ? 'info' : ''}`} data-chip=${c.id}>${aIcon(c.id === 'sensitive' ? 'shield' : c.id === 'locked' ? 'lock' : c.id === 'read_only' ? 'eye' : c.id === 'changed_outside' ? 'history' : 'warning')}${c.label}</span>`)}</div>` : nothing}
    </article>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'automation-card': AutomationCard;
  }
}
