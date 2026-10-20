import { openOverlay, menuKey } from './overlay-menu';
import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { whereLine } from './model';
import { tt } from './text';
import { tIcon } from './icons';
import { ticketCardStyles } from './styles';
import { ticketCardListStyles } from './list-styles';
import { listIcon } from './list-icons';
import './elapsed-clock';
import { cardModel, type CardItem } from './list-card-model';
import type { ViewerRole } from './status-sentence';

export type TicketCardAction = 'open' | 'full' | 'copy';

/**
 * CR-038 `<ticket-card .item .href .timelineHref>`: one ticket of a list, in the automation card's anatomy (the approved mock-up v5,
 * TKUI4): the title (a link - the whole card is its target), the "where" line, the state chip (the sub-state "waiting for a part" inside
 * it) and the "..." menu, the one-sentence STATUS (`sentenceFor` - the drawer's words, role-resolved by `.role`), then at most three chips
 * (priority, department, one of to-approve / stuck / reopened) - or, with `.board`, the one ranked warning line instead of the chips -
 * and the footer: the number, when it moved, the link to the timeline and the handler / owner avatar pair. Events (bubble, composed):
 * `card-action` {item, action}. The card changes nothing by itself.
 */
@customElement('ticket-card')
export class TicketCard extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) item!: CardItem;
  @property() href = '';
  @property() timelineHref = '';
  /** D18: the "..." menu offers the full screen unless the installation opens tickets in the drawer only */
  @property({ type: Boolean }) fullScreen = true;
  @property({ attribute: false }) now: Date = new Date();
  /** who reads the card: the sentence and the chips are role-resolved (the host derives it from the department role) */
  @property() role: ViewerRole = 'manager';
  /** the manager board's card: the warning line replaces the chips row */
  @property({ type: Boolean }) board = false;
  @property({ type: Boolean, reflect: true, attribute: 'data-picked' }) picked = false;
  @state() private menu = false;

  static styles = [bubbleChrome, ...automationsStyles, ticketCardStyles, ticketCardListStyles];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    window.addEventListener('pointerdown', this.onOutside, true);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.placeMenu);
    window.addEventListener('scroll', this.placeMenu, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('pointerdown', this.onOutside, true);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.placeMenu);
    window.removeEventListener('scroll', this.placeMenu, true);
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
    if (on) void this.updateComplete.then(() => (this.renderRoot.querySelector('.pop button') as HTMLButtonElement | null)?.focus());
  }
  /** 2.5.5: the "..." menu is a top-layer popover placed beside its button (nothing around the card can clip it). */
  protected updated(): void {
    this.placeMenu();
  }
  private placeMenu = (): void => {
    if (!this.menu) return;
    const pop = this.renderRoot.querySelector('.pop.ov') as HTMLElement | null;
    const btn = this.renderRoot.querySelector('[data-card-menu]') as HTMLElement | null;
    if (pop && btn) openOverlay(pop, btn);
  };
  private onMenuKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.setMenu(false);
      (this.renderRoot.querySelector('[data-card-menu]') as HTMLElement | null)?.focus();
    } else menuKey(e, e.currentTarget as HTMLElement);
  };
  private act(action: TicketCardAction) {
    this.setMenu(false);
    this.dispatchEvent(new CustomEvent('card-action', { detail: { item: this.item, action }, bubbles: true, composed: true }));
  }

  private menuItems(): TemplateResult {
    const row = (action: TicketCardAction, icon: Parameters<typeof tIcon>[0], label: string) =>
      html`<button type="button" role="menuitem" data-card-action=${action} @click=${() => this.act(action)}>${tIcon(icon)}${label}</button>`;
    return html`<div class="pop ov" popover="manual" role="menu" aria-label=${tt('actions')} @keydown=${this.onMenuKey}>
      ${row('open', 'eye', tt('open'))}
      ${this.fullScreen ? row('full', 'expand', tt('fullScreen')) : nothing}
      ${row('copy', 'link', tt('copyLink'))}
    </div>`;
  }

  render() {
    const t = this.item;
    if (!t) return nothing;
    const where = whereLine(t);
    const m = cardModel(t, { role: this.role, now: this.now, board: this.board });
    const stone = m.chip.tone;
    const closed = ['closed', 'cancelled'].includes(t.status);
    return html`<article class=${`tcard${m.urgent ? ' urgent' : ''}${m.stuck ? ' stuck' : ''}${closed ? ' closed' : ''}`} data-ticket=${t.id} data-status=${t.status} aria-label=${t.title}>
      <header>
        <div class="ttl">
          <h3><a class="name" href=${this.href || '#'} title=${t.title} data-card-open>${t.title}</a></h3>
          ${where.strong || where.rest ? html`<div class="where">${tIcon('layers')}${where.strong ? html`<b>${bidi(where.strong)}</b>` : nothing}${where.rest ? html`<span>${bidi(where.rest)}</span>` : nothing}</div>` : nothing}
        </div>
        <div class="ctl">
          <span class=${`chip ${stone}`} data-card-status aria-label=${m.chip.text}><i class=${`dot ${stone === 'ok' ? 'ok' : stone === 'info' ? 'run' : ''}`}></i>${m.chip.label}${m.chip.sub ? html`<span class="subst"> · ${m.chip.sub}</span>` : nothing}</span>
          <button type="button" class="more" aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${tt('moreOf', { title: t.title })} data-card-menu @click=${() => this.setMenu(!this.menu)}>${tIcon('dots')}</button>
        </div>
        ${this.menu ? this.menuItems() : nothing}
      </header>
      <p class="stat" data-card-sentence title=${m.sentence}>${m.sentence}</p>
      ${m.warning
        ? html`<div class=${`cwarn ${m.warning.tone}`} data-card-warning=${m.warning.key} role="note">${m.warning.icon === 'user' ? listIcon('hand') : tIcon('warning')}<span>${m.warning.text}</span></div>`
        : html`<div class="chips" data-card-chips>
            ${m.chips.map((c) => html`<span class=${`chip ${c.tone}`} data-chip=${c.key}>${c.key === 'priority' ? html`<i class=${`dot ${c.tone === 'bad' ? 'bad' : c.tone === 'info' ? 'run' : ''}`}></i>` : c.icon === 'coin' ? listIcon('coin') : c.icon === 'warning' ? tIcon('warning') : c.icon === 'refresh' ? tIcon('refresh') : nothing}${c.key === 'department' ? bidi(c.text) : c.text}</span>`)}
          </div>`}
      <footer>
        <span class="num">#${t.number}</span>
        <span class="run" data-card-run><i class=${`dot ${m.run.tone}`}></i><span>${m.run.text}</span></span>
        <ticket-elapsed .item=${t} data-card-elapsed></ticket-elapsed>
        ${this.timelineHref ? html`<a class="tl" href=${this.timelineHref} data-card-timeline>${tIcon('clock')}${tt('timelineLink')}</a>` : nothing}
        ${m.avatars.length ? html`<span class="pair" data-card-pair>${m.avatars.map((a) => html`<span class=${`av ${a.kind}`} title=${a.label} role="img" aria-label=${a.label}>${a.ini}</span>`)}</span>` : nothing}
      </footer>
    </article>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-card': TicketCard;
  }
}
