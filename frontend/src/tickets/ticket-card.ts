import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import type { TicketItem } from '../api/tickets';
import { priorityTone, runLine, statusLabel, statusTone, whereLine } from './model';
import { tt } from './text';
import { tIcon } from './icons';
import { ticketCardStyles } from './styles';

export type TicketCardAction = 'open' | 'full' | 'copy';

/**
 * CR-038 `<ticket-card .item .href .timelineHref>`: one ticket of a list, in the automation card's anatomy (the approved mock-up v2):
 * the title (a link - the whole card is its target), the "where" line (the place once slice 3 anchors tickets; the department and the
 * category until then), the state chip and the "..." menu, three lines of the description, the run line (the number, when it moved,
 * who has it) with the link to the timeline, and the chips (priority, department, reopened). Events (bubble, composed):
 * `card-action` {item, action}. The card changes nothing by itself.
 */
@customElement('ticket-card')
export class TicketCard extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) item!: TicketItem;
  @property() href = '';
  @property() timelineHref = '';
  /** D18: the "..." menu offers the full screen unless the installation opens tickets in the drawer only */
  @property({ type: Boolean }) fullScreen = true;
  @property({ attribute: false }) now: Date = new Date();
  @property({ type: Boolean, reflect: true, attribute: 'data-picked' }) picked = false;
  @state() private menu = false;

  static styles = [bubbleChrome, ...automationsStyles, ticketCardStyles];

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
    if (on) void this.updateComplete.then(() => (this.renderRoot.querySelector('.pop button') as HTMLButtonElement | null)?.focus());
  }
  private act(action: TicketCardAction) {
    this.setMenu(false);
    this.dispatchEvent(new CustomEvent('card-action', { detail: { item: this.item, action }, bubbles: true, composed: true }));
  }

  private menuItems(): TemplateResult {
    const row = (action: TicketCardAction, icon: Parameters<typeof tIcon>[0], label: string) =>
      html`<button type="button" role="menuitem" data-card-action=${action} @click=${() => this.act(action)}>${tIcon(icon)}${label}</button>`;
    return html`<div class="pop" role="menu" aria-label=${tt('actions')}>
      ${row('open', 'eye', tt('open'))}
      ${this.fullScreen ? row('full', 'expand', tt('fullScreen')) : nothing}
      ${row('copy', 'link', tt('copyLink'))}
    </div>`;
  }

  render() {
    const t = this.item;
    if (!t) return nothing;
    const where = whereLine(t);
    const run = runLine(t, this.now);
    const ptone = priorityTone(t.priority);
    const stone = statusTone(t.status);
    return html`<article class=${`tcard${ptone === 'bad' && !['closed', 'cancelled'].includes(t.status) ? ' urgent' : ''}`} data-ticket=${t.id} data-status=${t.status} aria-label=${t.title}>
      <header>
        <div class="ttl">
          <h3><a class="name" href=${this.href || '#'} data-card-open>${t.title}</a></h3>
          ${where.strong || where.rest ? html`<div class="where">${tIcon('layers')}${where.strong ? html`<b>${bidi(where.strong)}</b>` : nothing}${where.rest ? html`<span>${bidi(where.rest)}</span>` : nothing}</div>` : nothing}
        </div>
        <div class="ctl">
          <span class=${`chip ${stone}`} data-card-status><i class=${`dot ${stone === 'ok' ? 'ok' : stone === 'info' ? 'run' : ''}`}></i>${statusLabel(t.status)}</span>
          <button type="button" class="more" aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${tt('moreOf', { title: t.title })} data-card-menu @click=${() => this.setMenu(!this.menu)}>${tIcon('dots')}</button>
        </div>
        ${this.menu ? this.menuItems() : nothing}
      </header>
      ${t.excerpt ? html`<p class="excerpt" data-card-excerpt>${t.excerpt}</p>` : nothing}
      <footer>
        <span class="num">#${t.number}</span>
        <span class="run" data-card-run><i class=${`dot ${run.tone}`}></i>${run.text}</span>
        ${this.timelineHref ? html`<a class="tl" href=${this.timelineHref} data-card-timeline>${tIcon('clock')}${tt('timelineLink')}</a>` : nothing}
      </footer>
      <div class="chips" data-card-chips>
        ${t.priority ? html`<span class=${`chip ${ptone}`} data-chip="priority"><i class=${`dot ${ptone === 'bad' ? 'bad' : ptone === 'info' ? 'run' : ''}`}></i>${t.priority.name}</span>` : nothing}
        ${t.department ? html`<span class="chip" data-chip="department">${bidi(t.department.name)}</span>` : nothing}
        ${t.reopen_count > 0 ? html`<span class="chip warn" data-chip="reopened">${tIcon('refresh')}${tt('reopenedChip')}</span>` : nothing}
      </div>
    </article>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-card': TicketCard;
  }
}
